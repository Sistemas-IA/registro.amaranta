import Busboy from 'busboy';

export const config = { api: { bodyParser: false } };

// ── Configuración / Parámetros ──
const ALLOWED_HOST         = 'registro.amaranta.ar';
const RATE_LIMIT_HOURLY   = 10;     // envíos IP por hora
const RATE_LIMIT_DAILY    = 50;    // envíos IP por día
const RATE_LIMIT_GLOBAL   = 5000;  // envíos totales por día
const TTL_HOURLY          = 3600;  // segundos
const TTL_DAILY           = 86400; // segundos

const REDIS_URL           = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN         = process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_AUTH_HEADER   = `Bearer ${REDIS_TOKEN}`;

const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const RECAPTCHA_SECRET     = process.env.RECAPTCHA_SECRET_KEY;
const GAS_ENDPOINT_URL     = process.env.GAS_ENDPOINT_URL;

/* ───────────── Patrones y mensajes ───────────── */
const PATTERNS = {
  nombre:       /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s-]{2,30}$/,  
  apellido:     /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s-]{2,30}$/,  
  dni:          /^\d{8}$/,  
  codArea:      /^\d{2,4}$/,  
  numeroTelefono:/^\d{7,9}$/,  
  email:        /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,   
  direccion:    /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ.,#\/º°()\-\s]{5,100}$/,  
  comentarios:  /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ., ()\/\#º°\n\r\-]{0,300}$/  // opcional
};

/* ───────────── Sanitización anti-XSS ───────────── */
const sanitizeHtml = str => String(str)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

const ERR = {
  dni_invalido:    "DNI inválido",
  tel_invalido:    "Teléfono inválido",
  email_invalido:  "E-mail inválido",
  direccion_invalida: "Dirección inválida",
  campos_bot:      "Campo oculto no debe tener contenido",
  recaptcha:       "Fallo en reCAPTCHA",
  duplicado_dni:   "DNI ya registrado",
  duplicado_tel:   "Teléfono ya registrado",
  duplicado_email: "E-mail ya registrado",
  generic:         "Error inesperado, intentá de nuevo más tarde"
};

/* ───────────── Upstash Redis helpers (rate-limit) ───────────── */
async function incrTTL(key, ttl) {
  const { result: n } = await fetch(`${REDIS_URL}/incr/${encodeURIComponent(key)}`, {
    headers: { Authorization: REDIS_AUTH_HEADER }
  }).then(r => r.json());
  if (n === 1 && ttl) {
    await fetch(`${REDIS_URL}/expire/${encodeURIComponent(key)}/${ttl}`, {
      headers: { Authorization: REDIS_AUTH_HEADER }
    });
  }
  return n;
}

const clientIP = req =>
  (req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '')
    .split(',')[0].trim();

/* ───────────── Handler ───────────── */
export default async function handler(req, res) {

  /* —— CORS / CSRF: origen exacto —— */
  const originHeader = req.headers.origin || req.headers.referer || '';
  let isAllowedOrigin = false;
  try { isAllowedOrigin = new URL(originHeader).host === ALLOWED_HOST; }
  catch { /* origin vacío o no es URL ⇒ false */ }

  if (!isAllowedOrigin) return res.status(403).json({ error: 'CSRF' });

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Origin', originHeader);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Método no permitido' });

  /* —— Rate-limit: 5 IP/h · 20 IP/día · 5 000 global/día —— */
  const ip  = clientIP(req);
  const now = Date.now();
  const day = new Date().toISOString().slice(0,10);

  const hKey = `rate:${ip}:h:${Math.floor(now / 3_600_000)}`;
  const dKey = `rate:${ip}:d:${day}`;
  const gKey = `rate:global:${day}`;

  const [hHits, dHits, gHits] = await Promise.all([
    incrTTL(hKey, TTL_HOURLY),
    incrTTL(dKey, TTL_DAILY),
    incrTTL(gKey, TTL_DAILY)
  ]);

  if (gHits > RATE_LIMIT_GLOBAL)
    return res.status(503).json({ error: 'Servicio saturado' });

  if (hHits > RATE_LIMIT_HOURLY || dHits > RATE_LIMIT_DAILY) {
    const retryAfter = hHits > RATE_LIMIT_HOURLY ? TTL_HOURLY : TTL_DAILY;
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({ error: 'rate_limit' });
  }

  /* ─ Parsear multipart ─ */
  const fields = {};
  await new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    busboy.on('field', (name, val) => { fields[name] = val.trim(); });
    busboy.on('finish', resolve).on('error', reject);
    req.pipe(busboy);
  });

  /* ─ Honeypots ─ */
  if ((fields.zona || '').trim() !== '' || (fields.estado || '').trim() !== '')
    return res.status(200).json({ error: 'campos_bot' });

  /* ─ Validación espejo ─ */
  for (const key of Object.keys(PATTERNS)) {
    const value = fields[key] || '';
    if (!PATTERNS[key].test(value)) {
      const errKey = (key === 'numeroTelefono' || key === 'codArea')
        ? 'tel_invalido' : `${key}_invalido`;
      return res.status(200).json({ error: errKey });
    }
  }

  /* ─ reCAPTCHA v2 Invisible ─ */
  const verify = await fetch(RECAPTCHA_VERIFY_URL, {
    method:'POST',
    headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: RECAPTCHA_SECRET, response: fields['g-recaptcha-response'] })
  }).then(r => r.json()).catch(() => ({ success:false }));

  if (!verify.success)
    return res.status(200).json({ error: 'recaptcha' });

  /* ─ Normalizar y construir payload ─ */
  const telefono = '549' + fields.codArea + fields.numeroTelefono;

  const payload = {
    nombre:       fields.nombre,
    apellido:     fields.apellido,
    dni:          fields.dni,
    telefono,
    email:        fields.email,
    direccion:    sanitizeHtml(fields.direccion),
    comentarios:  sanitizeHtml(fields.comentarios || ''),
    zona:         'Pendiente',
    estado:       'Pendiente',
    lista:        fields.lista || '',
    timestamp:    new Date().toISOString(),
    ip
  };

  /* ─ Enviar a GAS ─ */
  try {
    const resp = await fetch(GAS_ENDPOINT_URL, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    if (data.status === 'OK') return res.status(200).json({ ok:true });
    return res.status(200).json({ error: data.error || 'generic' });
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: 'generic' });
  }
}

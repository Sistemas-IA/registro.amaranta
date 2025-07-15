// === /api/register.js ===
import Busboy from 'busboy';

export const config = { api: { bodyParser: false } };

// ── Configuración / Parámetros ──
const ALLOWED_HOST            = 'registro.amaranta.ar';
const RECAPTCHA_VERIFY_URL    = 'https://www.google.com/recaptcha/api/siteverify';  // corregido
const RECAPTCHA_SECRET_KEY    = process.env.RECAPTCHA_SECRET_KEY;
const GAS_ENDPOINT_URL        = process.env.GAS_ENDPOINT_URL;
const SCRIPT_SECRET           = process.env.SCRIPT_SECRET;  // tu clave compartida con GAS
const REDIS_URL               = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN             = process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_AUTH_HEADER       = `Bearer ${REDIS_TOKEN}`;

const RATE_LIMIT_HOURLY       = 10;     // envíos IP por hora
const RATE_LIMIT_DAILY        = 50;     // envíos IP por día
const RATE_LIMIT_GLOBAL       = 5000;   // envíos globales por día
const TTL_HOURLY              = 3600;   // segundos
const TTL_DAILY               = 86400;  // segundos

/* ───────────── Patrones y mensajes ───────────── */
const PATTERNS = {
  nombre:         /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s-]{2,30}$/,
  apellido:       /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s-]{2,30}$/,
  dni:            /^\d{8}$/,
  codArea:        /^\d{2,4}$/,
  numeroTelefono: /^\d{7,9}$/,
  email:          /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  direccion:      /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ.,#\/º°()\-\s]{5,100}$/,
  comentarios:    /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ., ()\/#º°\n\r\-]{0,300}$/
};

const ERR = {
  dni_invalido:       "DNI inválido",
  tel_invalido:       "Teléfono inválido",
  email_invalido:     "E-mail inválido",
  direccion_invalida: "Dirección inválida",
  campos_bot:         "Campo oculto no debe tener contenido",
  recaptcha:          "Fallo en reCAPTCHA",
  duplicado_dni:      "DNI ya registrado",
  duplicado_tel:      "Teléfono ya registrado",
  duplicado_email:    "E-mail ya registrado",
  lista_invalida:     "Lista inválida (debe ser 1–99)",
  generic:            "Error inesperado, intentá de nuevo más tarde"
};

/* ───────────── Sanitización anti-XSS ───────────── */
const sanitizeHtml = str => String(str)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

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

function clientIP(req) {
  return (req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '')
    .split(',')[0].trim();
}

/* ───────────── Handler ───────────── */
export default async function handler(req, res) {
  // — CORS / CSRF ↔ solo tu dominio —
  const originHeader = req.headers.origin || req.headers.referer || '';
  let isAllowedOrigin = false;
  try { isAllowedOrigin = new URL(originHeader).host === ALLOWED_HOST; }
  catch { /* no es URL válida */ }
  if (!isAllowedOrigin) {
    return res.status(403).json({ error: 'CSRF' });
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Origin', originHeader);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // — Rate-limit con Upstash Redis —
  const ip  = clientIP(req);
  const now = Date.now();
  const day = new Date().toISOString().slice(0, 10);
  const hKey = `rate:${ip}:h:${Math.floor(now / 3_600_000)}`;
  const dKey = `rate:${ip}:d:${day}`;
  const gKey = `rate:global:${day}`;

  const [hHits, dHits, gHits] = await Promise.all([
    incrTTL(hKey, TTL_HOURLY),
    incrTTL(dKey, TTL_DAILY),
    incrTTL(gKey, TTL_DAILY)
  ]);

  if (gHits > RATE_LIMIT_GLOBAL) {
    return res.status(503).json({ error: 'Servicio saturado' });
  }
  if (hHits > RATE_LIMIT_HOURLY || dHits > RATE_LIMIT_DAILY) {
    const retryAfter = hHits > RATE_LIMIT_HOURLY ? TTL_HOURLY : TTL_DAILY;
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({ error: 'rate_limit' });
  }

  // — Parsear multipart/form-data —
  const fields = {};
  await new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    busboy.on('field', (name, val) => { fields[name] = val.trim(); });
    busboy.on('finish', resolve).on('error', reject);
    req.pipe(busboy);
  });

  // — Honeypots —
  if ((fields.zona || '') !== '' || (fields.estado || '') !== '') {
    return res.status(200).json({ error: 'campos_bot' });
  }

  // — Validación espejo —
  for (const key of Object.keys(PATTERNS)) {
    const val = fields[key] || '';
    if (!PATTERNS[key].test(val)) {
      const errKey = (key === 'numeroTelefono' || key === 'codArea')
        ? 'tel_invalido' : `${key}_invalido`;
      return res.status(200).json({ error: errKey });
    }
  }

  // — Validar lista 1–99 —
  const listaNum = parseInt(fields.lista || '', 10);
  if (isNaN(listaNum) || listaNum < 1 || listaNum > 99) {
    return res.status(400).json({ error: 'lista_invalida' });
  }

  // — reCAPTCHA v2 Invisible —
  console.log('🔍 reCAPTCHA token:', fields['g-recaptcha-response']);
  const verify = await fetch(RECAPTCHA_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret:   RECAPTCHA_SECRET_KEY,
      response: fields['g-recaptcha-response']
    })
  })
  .then(r => r.json())
  .catch(err => {
    console.error('⚠️ Error llamando a Google reCAPTCHA:', err);
    return { success: false };
  });

  console.log('🔍 reCAPTCHA verify response:', verify);
  if (!verify.success) {
    return res.status(200).json({ error: 'recaptcha' });
  }

  // — Construir payload para GAS —
  const telefono = '549' + fields.codArea + fields.numeroTelefono;
  const payload = {
    scriptKey:   SCRIPT_SECRET,
    nombre:      fields.nombre,
    apellido:    fields.apellido,
    dni:         fields.dni,
    telefono,
    email:       fields.email,
    direccion:   sanitizeHtml(fields.direccion),
    comentarios: sanitizeHtml(fields.comentarios || ''),
    zona:        'Pendiente',
    estado:      'Pendiente',
    lista:       listaNum,
    timestamp:   new Date().toISOString(),
    ip
  };

  // — Enviar a Google Apps Script —
  try {
    const resp = await fetch(GAS_ENDPOINT_URL, {
      method: 'POST',
      headers:{ 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    if (data.status === 'OK') {
      return res.status(200).json({ ok: true });
    } else {
      return res.status(200).json({ error: data.error || 'generic' });
    }
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: 'generic' });
  }
}

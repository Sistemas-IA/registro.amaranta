// === /api/register.js ===
import Busboy from 'busboy';

export const config = { api: { bodyParser: false } };

// ── Configuración ──
const ALLOWED_HOST       = 'registro.amaranta.ar';
const RECAPTCHA_VERIFY   = 'https://www.google.com/recaptcha/api/siteverify';
const RECAPTCHA_SECRET   = process.env.RECAPTCHA_SECRET_KEY;
const GAS_URL            = process.env.GAS_ENDPOINT_URL;
const SCRIPT_SECRET      = process.env.SCRIPT_SECRET;  // <-- nueva
const REDIS_URL          = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN        = process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_AUTH_HEADER  = `Bearer ${REDIS_TOKEN}`;
// … otros constantes de rate-limit …

// ── Helpers Upstash ── (incrTTL, clientIP) … copia los tuyos …

// ── Handler ──
export default async function handler(req, res) {
  // CORS/CSRF …
  // Rate-limit …

  // Parse multipart
  const fields = {};
  await new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    busboy.on('field', (name, val) => { fields[name] = val.trim(); });
    busboy.on('finish', resolve).on('error', reject);
    req.pipe(busboy);
  });

  // Honeypots …
  // Validación espejo …

  // 1) Validar lista 1–99
  const listaNum = parseInt(fields.lista || '', 10);
  if (isNaN(listaNum) || listaNum < 1 || listaNum > 99) {
    return res.status(400).json({ error: 'lista_invalida' });
  }

  // 2) reCAPTCHA v2
  const verify = await fetch(RECAPTCHA_VERIFY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: RECAPTCHA_SECRET,
      response: fields['g-recaptcha-response']
    })
  }).then(r => r.json()).catch(() => ({ success: false }));
  if (!verify.success) {
    return res.status(200).json({ error: 'recaptcha' });
  }

  // 3) Armar payload e incluir scriptKey
  const telefono = '549' + fields.codArea + fields.numeroTelefono;
  const payload = {
    scriptKey: SCRIPT_SECRET,
    nombre:    fields.nombre,
    apellido:  fields.apellido,
    dni:       fields.dni,
    telefono,
    email:     fields.email,
    direccion: sanitizeHtml(fields.direccion),
    comentarios: sanitizeHtml(fields.comentarios || ''),
    zona:      'Pendiente',
    estado:    'Pendiente',
    lista:     listaNum,
    timestamp: new Date().toISOString(),
    ip:        clientIP(req)
  };

  // 4) Envío a GAS
  try {
    const resp = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    if (data.status === 'OK') return res.status(200).json({ ok: true });
    return res.status(200).json({ error: data.error || 'generic' });
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: 'generic' });
  }
}

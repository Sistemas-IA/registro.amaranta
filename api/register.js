// /api/register.js
export const config = { api: { bodyParser: true } };

const ALLOWED_HOST          = 'registro.amaranta.ar';
const RECAPTCHA_VERIFY_URL  = 'https://www.google.com/recaptcha/api/siteverify';
const RECAPTCHA_SECRET_KEY  = process.env.RECAPTCHA_SECRET_KEY;
const GAS_ENDPOINT_URL      = process.env.GAS_ENDPOINT_URL;
const SCRIPT_SECRET         = process.env.SCRIPT_SECRET;

// Copia aquí tus constantes y funciones de rate-limit y patrones:
const PATTERNS = {
  nombre:         /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s-]{2,30}$/,
  apellido:       /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s-]{2,30}$/,
  dni:            /^\d{8}$/,
  codArea:        /^\d{2,4}$/,
  numeroTelefono: /^\d{7,9}$/,
  email:          /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  direccion:      /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ.,#\/º°()\-\s]{5,100}$/,
  comentarios:    /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ., ()\/#º°\n\r-]{0,300}$/
};
const ERR = {
  duplicado_dni:   "duplicado_dni",
  duplicado_tel:   "duplicado_tel",
  duplicado_email: "duplicado_email",
  lista_invalida:  "lista_invalida",
  campos_bot:      "campos_bot",
  recaptcha:       "recaptcha",
  rate_limit:      "rate_limit",
  generic:         "generic"
};

// Inserta tus funciones incrTTL, clientIP y la lógica de rate-limit aquí…

export default async function handler(req, res) {
  // CORS/CSRF
  const origin = req.headers.origin || req.headers.referer || '';
  if (new URL(origin).host !== ALLOWED_HOST)
    return res.status(403).json({ error: 'CSRF' });
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Origin', origin);
  if (req.method === 'OPTIONS')
    return res.status(204).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: ERR.generic });

  // Rate-limit…
  // const ip = clientIP(req);
  // …incrTTL / chequear límites…

  const fields = req.body;
  console.log('🛠️ fields recibidos:', fields);

  // Honeypots
  if (fields.zona || fields.estado)
    return res.status(200).json({ error: ERR.campos_bot });

  // Validación espejo
  for (let key in PATTERNS) {
    if (!PATTERNS[key].test(fields[key] || '')) {
      const errKey = (key === 'numeroTelefono' || key === 'codArea')
        ? ERR.tel_invalido : `${key}_invalido`;
      return res.status(200).json({ error: errKey });
    }
  }

  // Validar lista 1–99
  const listaNum = parseInt(fields.lista || '', 10);
  if (isNaN(listaNum) || listaNum < 1 || listaNum > 99)
    return res.status(400).json({ error: ERR.lista_invalida });

  // reCAPTCHA v2 Invisible
  console.log('🔍 token:', fields['g-recaptcha-response']);
  const googleRes = await fetch(RECAPTCHA_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${encodeURIComponent(RECAPTCHA_SECRET_KEY)}&response=${encodeURIComponent(fields['g-recaptcha-response'])}`
  });
  console.log('🔄 Google status:', googleRes.status);
  const verify = await googleRes.json();
  console.log('🔍 Google dice:', verify);
  if (!verify.success)
    return res.status(200).json({ error: ERR.recaptcha });

  // Armar payload y enviar a GAS
  const telefono = '549' + fields.codArea + fields.numeroTelefono;
  const payload = {
    scriptKey: SCRIPT_SECRET,
    nombre:    fields.nombre,
    apellido:  fields.apellido,
    dni:       fields.dni,
    telefono,
    email:     fields.email,
    direccion: fields.direccion,
    comentarios: fields.comentarios || '',
    zona:      'Pendiente',
    estado:    'Pendiente',
    lista:     listaNum,
    timestamp: new Date().toISOString(),
    ip:        req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress
  };

  try {
    const r2 = await fetch(GAS_ENDPOINT_URL, {
      method: 'POST',
      headers:{ 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const j2 = await r2.json();
    if (j2.status === 'OK') return res.status(200).json({ ok: true });
    return res.status(200).json({ error: j2.error || ERR.generic });
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: ERR.generic });
  }
}

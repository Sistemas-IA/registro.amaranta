// Node 18 ESM
import { google }   from 'googleapis';
import { Redis }    from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

/* ---------- 1) RATE‑LIMIT ---------- */
const redis     = Redis.fromEnv();                        // lee URL/TOKEN
const ratelimit = new Ratelimit({
  redis,
  limiter   : Ratelimit.slidingWindow(5, '5 m'),          // 5 peticiones / 5 min
  analytics : true                                        // métrica en Upstash
});

/* ---------- 2) GOOGLE SHEETS ---------- */
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
  scopes     : ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets         = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME     = process.env.SHEET_NAME || 'Clientes';

/* ---------- 3) HANDLER ---------- */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  /* 3.0 CORS: autoriza sólo tu dominio */
  const ALLOWED_ORIGIN = 'https://registro.amaranta.ar';   // ← CAMBIA aquí
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);

  /* 3.1 IP real del cliente */
  const ipHeader = (req.headers['x-forwarded-for'] ?? '').split(',')[0] || '';
  const ip       = ipHeader || req.socket.remoteAddress || req.body?.ip || 'unknown';

  /* 3.2 Rate‑limit */
  const { success } = await ratelimit.limit(ip);
  if (!success)
    return res.status(429).json({ ok:false, error:'Demasiadas peticiones, intenta de nuevo luego.' });

  try {
    /* 3.3 Datos del formulario */
    const {
      nombre, apellido, dni, codigo, numero, email,
      direccion = '', comentarios = '', lista = '',
      recaptchaToken
    } = req.body || {};

    /* 1. reCAPTCHA v3 */
    const score = await verifyCaptcha(recaptchaToken, ip);
    if (score < 0.5) throw new Error('reCAPTCHA rechazó al usuario');

    /* 2. Normalizar teléfono y comprobar unicidad */
    const telefono = normalizarTel(codigo, numero);

    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range        : `${SHEET_NAME}!A2:E`
    });

    if (existing.data.values?.some(r =>
          r[2] === dni ||
          r[3] === telefono ||
          r[4]?.toLowerCase() === email.toLowerCase()
    )) throw new Error('DNI, teléfono o email ya registrado');

    /* 3. Sanitizar e insertar */
    const fila = [
      sanitize(nombre),    sanitize(apellido), sanitize(dni),
      telefono,            // ya normalizado
      sanitize(email),
      sanitize(direccion),
      sanitize(comentarios),
      'Pendiente',         // zona (col H)
      'Pendiente',         // estado (col I)
      sanitize(lista),
      new Date().toISOString(),
      ip
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId  : SPREADSHEET_ID,
      range          : `${SHEET_NAME}!A:Z`,
      valueInputOption: 'RAW',
      requestBody    : { values: [fila] }
    });

    res.json({ ok:true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ ok:false, error: err.message });
  }
}

/* ---------- 4) HELPERS ---------- */
async function verifyCaptcha(token, ip) {
  const params = new URLSearchParams({
    secret   : process.env.RECAPTCHA_SECRET,
    response : token,
    remoteip : ip
  });
  const r = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method : 'POST',
    body   : params
  }).then(r => r.json());
  return r.score || 0;
}

function normalizarTel(cod = '', num = '') {
  return '549' + cod + num;
}

function sanitize(value = '') {
  if (typeof value !== 'string') return value;
  return value
    .trim()
    .replace(/^[=+\-@]/, "'$&")  // bloquea fórmulas en Sheets
    .replace(/[<>]/g, '');       // evita XSS/HTML
}

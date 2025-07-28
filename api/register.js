// Node 18 ESM
import { google }    from 'googleapis';
import { Redis }     from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

/* ---------- 1) RATE‑LIMIT ---------- */
const redis     = Redis.fromEnv();
const ratelimit = new Ratelimit({
  redis,
  limiter  : Ratelimit.slidingWindow(5, '5 m'),
  analytics: true
});

/* ---------- 2) GOOGLE SHEETS ---------- */
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets         = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME     = process.env.SHEET_NAME || 'Clientes';
const FAIL_SHEET     = 'IntentosFallidos';   // pestaña para rechazos

/* ---------- 3) HANDLER ---------- */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const ALLOWED_ORIGIN = 'https://registro.amaranta.ar';
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);

  const ip = (req.headers['x-forwarded-for'] ?? '').split(',')[0]
           || req.socket.remoteAddress || 'unknown';

  /* Honeypot: zona o estado rellenos */
  if (req.body?.zona || req.body?.estado) {
    await logFail(ip, 'Honeypot');
    return res.status(400).end();
  }

  const { success } = await ratelimit.limit(ip);
  if (!success) {
    await logFail(ip, 'Rate‑limit 429');
    return res.status(429).json({ ok:false, error:'Demasiadas peticiones, intenta luego.' });
  }

  try {
    const {
      nombre, apellido, dni, codigo, numero, email,
      direccion = '', comentarios = '', lista = '',
      recaptchaToken
    } = req.body || {};

    /* reCAPTCHA */
    const score = await verifyCaptcha(recaptchaToken, ip);
    if (score < 0.5) throw new Error('reCAPTCHA rechazó al usuario');

    /* Unicidad */
    const telefono = normalizarTel(codigo, numero);
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:E`
    });

    if (existing.data.values?.some(r =>
          r[2] === dni || r[3] === telefono ||
          r[4]?.toLowerCase() === email.toLowerCase()
    )) throw new Error('DNI, teléfono o email ya registrado');

    /* Sanitizar e insertar */
    const fila = [
      sanitize(nombre), sanitize(apellido), sanitize(dni),
      telefono, sanitize(email),
      sanitize(direccion), sanitize(comentarios),
      'Pendiente','Pendiente',
      sanitize(lista), new Date().toISOString(), ip
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId : SPREADSHEET_ID,
      range         : `${SHEET_NAME}!A:Z`,
      valueInputOption:'RAW',
      requestBody   : { values: [fila] }
    });

    res.json({ ok:true });
  } catch (err) {
    /* --- Manejo de cuota --- */
    const quota = err?.code === 429 || err?.code === 403 ||
                  /quota|rate/i.test(err?.errors?.[0]?.reason || '');
    await logFail(ip, err.message || String(err));

    if (quota) {
      return res.status(503).json({
        ok:false,
        error:'Servicio saturado, intenta nuevamente en unos minutos.'
      });
    }

    console.error(err);
    res.status(400).json({ ok:false, error: err.message });
  }
}

/* ---------- HELPERS ---------- */
async function verifyCaptcha(token, ip) {
  const params = new URLSearchParams({
    secret   : process.env.RECAPTCHA_SECRET,
    response : token,
    remoteip : ip
  });
  const r = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method:'POST', body:params
  }).then(r=>r.json());
  return r.score || 0;
}

function normalizarTel(c='', n=''){ return '549'+c+n; }

function sanitize(v=''){
  return String(v).trim()
    .replace(/^[=+\-@]/,"'$&")
    .replace(/[<>]/g,'');
}

/* Guarda rechazos en la hoja "IntentosFallidos" */
async function logFail(ip,msg){
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId : SPREADSHEET_ID,
      range         : `${FAIL_SHEET}!A:C`,
      valueInputOption:'RAW',
      requestBody   : { values:[[ new Date().toISOString(), ip, msg ]] }
    });
  } catch{}   // si la pestaña no existe o no hay cuota, lo ignoramos
}

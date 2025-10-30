// Node 18 ESM
import { google }    from 'googleapis';
import { Redis }     from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

/* ---------- 1) RATE‑LIMITS ---------- */
const redis = Redis.fromEnv();

/* 5 envíos / IP / 5 min */
const rlIp = new Ratelimit({ redis,
  limiter  : Ratelimit.slidingWindow(5, '5 m'),
  prefix   : 'ip',
  analytics: true
});

/* 2 envíos / DNI·e‑mail / 1 h */
const rlId = new Ratelimit({ redis,
  limiter  : Ratelimit.slidingWindow(2, '1 h'),
  prefix   : 'id',
  analytics: true
});

/* 100 envíos totales / 5 min */
const rlGlobal = new Ratelimit({ redis,
  limiter  : Ratelimit.slidingWindow(100, '5 m'),
  prefix   : 'glob',
  analytics: true
});

/* ---------- 2) GOOGLE SHEETS ---------- */
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
  scopes     : ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets         = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME     = process.env.SHEET_NAME || 'Clientes';
const FAIL_SHEET     = 'IntentosFallidos';

const RE_NUM_1_50 = /^(?:[1-9]|[1-4]\d|50)$/;

/* ---------- 3) HANDLER ---------- */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  res.setHeader('Access-Control-Allow-Origin', 'https://registro.amaranta.ar');

  const ip = (req.headers['x-forwarded-for'] ?? '').split(',')[0]
           || req.socket.remoteAddress || 'unknown';

  /* 3.1 Rate‑limit IP */
  if (!(await rlIp.limit(ip)).success) {
    await logFail(ip, 'Rate‑limit IP');
    return res.status(429).json({ ok:false, error:'Demasiadas peticiones, intenta luego.' });
  }

  /* 3.2 Rate‑limit global */
  if (!(await rlGlobal.limit('global')).success) {
    await logFail(ip, 'Rate‑limit global');
    return res.status(503).json({ ok:false, error:'Servicio saturado, intenta nuevamente en unos minutos.' });
  }

  try {
    const {
      nombre, apellido, dni, telefono, email,
      direccion = '', comentarios = '', lista = '',
      recaptchaToken
    } = req.body || {};

    /* 3.3 reCAPTCHA */
    const score = await verifyCaptcha(recaptchaToken, ip);
    if (score < 0.5) throw new Error('reCAPTCHA rechazó al usuario');

    /* 3.4 Rate‑limit por identidad (DNI o e‑mail) */
    const identity = (dni || email || '').toLowerCase();
    if (identity && !(await rlId.limit(identity)).success)
      throw new Error('Demasiados intentos con el mismo DNI/e‑mail');

    /* 3.5 Validar lista 1‑50 */
    if (lista && !RE_NUM_1_50.test(lista))
      throw new Error('Lista inválida (debe ser número 1‑50)');

    
    /* 3.5.b Validaciones de campos */
    function isAllSameDigits(s){ return /^(\d)\1+$/.test(s); }
    function isSequentialAsc(s){ return s === '0123456789' || s === '1234567890'; }
    function isSequentialDesc(s){ return s === '9876543210'; }

    function vNombre(v){ return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]{2,50}$/.test(String(v||'').trim()); }
    function vApellido(v){ return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]{2,50}$/.test(String(v||'').trim()); }
    function vDni(v){
      const s = String(v||'').trim();
      if (!/^\d{7,8}$/.test(s)) return false;
      if (/^0/.test(s)) return false;
      if (isAllSameDigits(s)) return false;
      if (s === '12345678' || s === '87654321') return false;
      return true;
    }
    function vTel10(v){
      const s = String(v||'').replace(/\D+/g,'');
      if (!/^\d{10}$/.test(s)) return false;
      if (!(s.startsWith('11') || /^[23]/.test(s))) return false;
      if (isAllSameDigits(s)) return false;
      if (isSequentialAsc(s) || isSequentialDesc(s)) return false;
      return true;
    }
    function vEmail(v){ const s=String(v||'').trim(); return s.length<=100 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
    function vDireccion(v){ const s=String(v||'').trim(); return s.length>=3 && s.length<=100; }
    function vComentarios(v){ return String(v||'').trim().length <= 250; }

    if (!vNombre(nombre))        throw new Error('Nombre inválido');
    if (!vApellido(apellido))    throw new Error('Apellido inválido');
    if (!vDni(dni))              throw new Error('DNI inválido');
    if (!vTel10(telefono))       throw new Error('Teléfono inválido');
    if (!vEmail(email))          throw new Error('E-mail inválido');
    if (!vDireccion(direccion))  throw new Error('Dirección inválida');
    if (!vComentarios(comentarios)) throw new Error('Comentarios muy largos');

    const telefonoNSN10 = String(telefono||'').replace(/\D+/g,''); // 10 dígitos garantizado
/* 3.6 Unicidad en Sheets */
    const telefono = telefonoNSN10;
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range        : `${SHEET_NAME}!A2:E`
    });

    if (existing.data.values?.some(r =>
          r[2] === dni || r[3] === telefono ||
          r[4]?.toLowerCase() === email.toLowerCase()
    )) throw new Error('DNI, teléfono o email ya registrado');

    /* 3.7 Limitar longitudes y sanitizar */
    const fila = [
      sanitize(nombre), sanitize(apellido), sanitize(dni),
      telefonoNSN10, sanitize(email),
      sanitize(direccion.slice(0,100)),
      sanitize(comentarios.slice(0,250)),
      'Z-00','Pendiente',
      sanitize(lista.slice(0,50)),
      new Date().toISOString(), ip
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId : SPREADSHEET_ID,
      range         : `${SHEET_NAME}!A:Z`,
      valueInputOption:'RAW',
      requestBody   : { values: [fila] }
    });

    res.json({ ok:true });

  } catch (err) {
    const quota = err?.code === 429 || err?.code === 403 ||
                  /quota|rate/i.test(err?.errors?.[0]?.reason || '');
    await logFail(ip, err.message || String(err));

    return res.status(quota ? 503 : 400).json({
      ok:false,
      error: err.message || 'Error interno'
    });
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
async function logFail(ip,msg){
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range        : `${FAIL_SHEET}!A:C`,
      valueInputOption:'RAW',
      requestBody  : { values:[[ new Date().toISOString(), ip, msg ]] }
    });
  } catch {}
}

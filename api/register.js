// @ts-check
import crypto from 'node:crypto';
import { kv } from '@vercel/kv';

const MAX = Number(process.env.RATE_LIMIT_MAX ?? 5);         // intentos
const WINDOW = Number(process.env.RATE_LIMIT_WINDOW ?? 60);   // seg
const RECAPTCHA_URL = 'https://www.google.com/recaptcha/api/siteverify';

/** Valida email rápido (RFC‑ish) */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
/** Escapa caracteres problemáticos y bloquea fórmulas en Sheets */
const sanitize = (s = '') =>
  s.trim()
   .replace(/^[=\+\-@']/,'')
   .replace(/[<>"&]/g, c => ({ '<':'&lt;','>':'&gt;','"':'&quot;','&':'&amp;' }[c]));

/** GET client IP lo‑fi */
const getIP = req => (req.headers['x-forwarded-for'] || '').split(',')[0] || req.ip || '0.0.0.0';

/** Simple rate‑limit con Vercel KV */
async function isRateLimited(key) {
  const now = Math.floor(Date.now() / 1000);
  const bucket = `rl:${key}:${Math.floor(now / WINDOW)}`; // ventana temporal
  const count = await kv.incr(bucket);
  if (count === 1) await kv.expire(bucket, WINDOW);        // set TTL la 1.ª vez
  return count > MAX;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok:false, error:'Método no permitido' });
  }

  const ip = getIP(req);
  if (await isRateLimited(ip)) {
    return res.status(429).json({ ok:false, error:'Demasiados intentos (rate‑limit)' });
  }

  const { nombre = '', email = '', recaptchaToken = '' } = req.body ?? {};
  if (!nombre.trim() || nombre.length > 120) {
    return res.status(400).json({ ok:false, error:'Nombre inválido' });
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ ok:false, error:'Email inválido' });
  }
  if (!recaptchaToken) {
    return res.status(400).json({ ok:false, error:'Falta token reCAPTCHA' });
  }

  /* 1) Verificar reCAPTCHA */
  const recRes = await fetch(RECAPTCHA_URL, {
    method: 'POST',
    headers: { 'Content-Type':'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: process.env.RECAPTCHA_SECRET ?? '',
      response: recaptchaToken
    })
  }).then(r => r.json());

  if (!recRes.success || (recRes.score ?? 0) < 0.5) {
    return res.status(400).json({ ok:false, error:'reCAPTCHA rechazado', score:recRes.score });
  }

  /* 2) Sanitizar */
  const data = {
    nombre: sanitize(nombre),
    email: sanitize(email)
  };

  /* 3) Enviar a Google Sheets (WebApp) */
  try {
    const hmac = crypto
      .createHmac('sha256', process.env.HMAC_SECRET ?? '')
      .update(JSON.stringify(data))
      .digest('hex');

    const gasRes = await fetch(process.env.SHEETS_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'X-HMAC': hmac },
      body: JSON.stringify(data),
      timeout: 10_000
    });

    const gasJson = await gasRes.json();
    if (!gasRes.ok || !gasJson.ok) {
      throw new Error(gasJson.error || `GAS ${gasRes.status}`);
    }
  } catch (err) {
    console.error('Error escribiendo en Sheets', err);
    return res.status(502).json({ ok:false, error:'Fallo al grabar en Sheets' });
  }

  return res.status(200).json({ ok:true });
}

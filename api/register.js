// api/register.js
import { kv } from '@vercel/kv';
import { writeRow } from '../services/sheetsService';
import { isValidEmail, isValidLength } from '../utils/validator';
import { sanitize } from '../utils/sanitizer';
import {
  RECAPTCHA_SECRET,
  RATE_LIMIT_WINDOW,
  RATE_LIMIT_MAX
} from '../config/constants';

export default async function handler(req, res) {
  // ─── 0) Rate‑limit por IP ─────────────────────────────────
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket.remoteAddress;
  const key = `rl:${ip}`;
  // obtener contador actual
  let count = parseInt(await kv.get(key)) || 0;
  if (count >= RATE_LIMIT_MAX) {
    return res
      .status(429)
      .json({ error: 'Demasiadas solicitudes, inténtalo más tarde' });
  }
  // incrementar contador y fijar expiración
  await kv.set(key, count + 1, { ex: RATE_LIMIT_WINDOW });

  // ─── 1) Método permitido ───────────────────────────────────
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { nombre, email, recaptchaToken } = req.body;

  // ─── 2) Validación reCAPTCHA v3 ────────────────────────────
  if (!recaptchaToken) {
    return res.status(400).json({ error: 'Falta token de reCAPTCHA' });
  }
  const recRes = await fetch(
    'https://www.google.com/recaptcha/api/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(RECAPTCHA_SECRET)}&response=${encodeURIComponent(recaptchaToken)}`
    }
  );
  const recJson = await recRes.json();
  console.log('>> reCAPTCHA result:', recJson);
  if (
    !recJson.success ||
    recJson.action !== 'register' ||
    recJson.score < 0.5
  ) {
    return res.status(403).json({ error: 'reCAPTCHA verification failed' });
  }

  // ─── 3) Validaciones de datos ───────────────────────────────
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Email inválido' });
  }
  if (!isValidLength(nombre, 50)) {
    return res.status(400).json({ error: 'Nombre inválido o demasiado largo' });
  }

  // ─── 4) Sanitización ────────────────────────────────────────
  const data = {
    nombre: sanitize(nombre),
    email: sanitize(email)
  };

  // ─── 5) Escritura en Google Sheets ─────────────────────────
  try {
    await writeRow(data);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Error escribiendo en Sheets:', e);
    return res.status(500).json({ error: 'Error al escribir en la base de datos' });
  }
}

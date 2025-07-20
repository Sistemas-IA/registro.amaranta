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
  // ─── SECURITY HEADERS ─────────────────────────────────────────
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Content-Security-Policy', "default-src 'none';");
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  try {
    // ─── Rate-limit por IP ──────────────────────────────────────
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket.remoteAddress;
    const key = `rl:${ip}`;
    let count = parseInt(await kv.get(key)) || 0;
    if (count >= RATE_LIMIT_MAX) {
      return res
        .status(429)
        .json({ error: 'Demasiadas solicitudes, inténtalo más tarde' });
    }
    await kv.set(key, count + 1, { ex: RATE_LIMIT_WINDOW });

    // ─── Solo POST ───────────────────────────────────────────────
    if (req.method !== 'POST') {
      return res
        .status(405)
        .json({ error: `Method ${req.method} Not Allowed` });
    }

    const { nombre, email, recaptchaToken } = req.body;

    // ─── reCAPTCHA v3 ────────────────────────────────────────────
    if (!recaptchaToken) {
      return res.status(400).json({ error: 'Falta token de reCAPTCHA' });
    }
    const recRes = await fetch(
      'https://www.google.com/recaptcha/api/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${encodeURIComponent(
          RECAPTCHA_SECRET
        )}&response=${encodeURIComponent(recaptchaToken)}`
      }
    );
    const recJson = await recRes.json();
    if (
      !recJson.success ||
      recJson.action !== 'register' ||
      recJson.score < 0.5
    ) {
      return res.status(403).json({ error: 'reCAPTCHA verification failed' });
    }

    // ─── Validaciones de datos ───────────────────────────────────
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }
    if (!isValidLength(nombre, 50)) {
      return res
        .status(400)
        .json({ error: 'Nombre inválido o demasiado largo' });
    }

    // ─── Sanitización ────────────────────────────────────────────
    const data = {
      nombre: sanitize(nombre),
      email: sanitize(email)
    };

    // ─── Escritura en Google Sheets ─────────────────────────────
    await writeRow(data);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Unhandled error:', err);
    return res.status(500).json({ error: err.message });
  }
}

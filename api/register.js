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
  try {
    // ─── RATE‑LIMIT por IP ───────────────────────────────────
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

    // ─── SOLO POST ────────────────────────────────────────────
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res
        .status(405)
        .json({ error: `Method ${req.method} Not Allowed` });
    }

    const { nombre, email, recaptchaToken } = req.body;

    // ─── reCAPTCHA v3 ────────────────────────────────────────
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
    console.log('>> reCAPTCHA result:', recJson);
    if (
      !recJson.success ||
      recJson.action !== 'register' ||
      recJson.score < 0.5
    ) {
      return res
        .status(403)
        .json({ error: 'reCAPTCHA verification failed' });
    }

    // ─── VALIDACIONES ────────────────────────────────────────
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }
    if (!isValidLength(nombre, 50)) {
      return res
        .status(400)
        .json({ error: 'Nombre inválido o demasiado largo' });
    }

    // ─── SANITIZACIÓN ────────────────────────────────────────
    const data = {
      nombre: sanitize(nombre),
      email: sanitize(email)
    };

    // ─── ESCRITURA EN SHEETS ─────────────────────────────────
    await writeRow(data);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Unhandled error:', err);
    // Para depurar, devolvemos el mensaje real del error
    return res
      .status(500)
      .json({ error: err.message });
  }
}

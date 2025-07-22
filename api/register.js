// api/register.js
import { kv } from '@vercel/kv';
import { writeRow } from '../services/sheetsService';
import { sanitize } from '../utils/sanitizer';
import {
  RECAPTCHA_SECRET,
  RATE_LIMIT_WINDOW,
  RATE_LIMIT_MAX
} from '../config/constants';

// Patrones de validación
const PATTERNS = {
  name:    /^[A-Za-zÁÉÍÓÚáéíóúÑñ ]{1,30}$/,
  dni:     /^\d{8}$/,
  phone:   /^\d{9,13}$/,
  email:   /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
  lista:   /^[1-9][0-9]?$/,
};

export default async function handler(req, res) {
  // ─── SECURITY HEADERS ───────────────────────────────────
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Content-Security-Policy', "default-src 'none';");
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  try {
    // ─── RATE‑LIMIT por IP ───────────────────────────────────
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket.remoteAddress;
    const key = `rl:${ip}`;
    let count = parseInt(await kv.get(key)) || 0;
    if (count >= RATE_LIMIT_MAX) {
      return res.status(429).json({ error: 'Demasiadas solicitudes, inténtalo más tarde' });
    }
    await kv.set(key, count + 1, { ex: RATE_LIMIT_WINDOW });

    // ─── SOLO POST ───────────────────────────────────────────
    if (req.method !== 'POST') {
      return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const {
      nombre,
      apellido,
      dni,
      telefono,
      email,
      direccion,
      comentarios,
      zona,
      estado,
      lista,
      recaptchaToken
    } = req.body;

    // ─── HONEYPOTS ──────────────────────────────────────────
    if (zona) {
      return res.status(400).json({ error: 'Spam detectado (zona)' });
    }
    if (estado !== 'Pendiente') {
      return res.status(400).json({ error: 'Spam detectado (estado)' });
    }

    // ─── VALIDACIONES ───────────────────────────────────────
    const errors = {};
    if (!nombre || !PATTERNS.name.test(nombre))        errors.nombre    = 'Nombre inválido';
    if (!apellido || !PATTERNS.name.test(apellido))    errors.apellido  = 'Apellido inválido';
    if (!dni || !PATTERNS.dni.test(dni))               errors.dni       = 'DNI inválido';
    if (!telefono || !PATTERNS.phone.test(telefono))   errors.telefono  = 'Teléfono inválido';
    if (!email || !PATTERNS.email.test(email))         errors.email     = 'Email inválido';
    if (!direccion || direccion.length > 100)          errors.direccion = 'Dirección inválida';
    if (comentarios && comentarios.length > 300)       errors.comentarios = 'Comentarios muy largos';
    if (lista && !PATTERNS.lista.test(lista))         errors.lista     = 'Lista inválida';

    if (Object.keys(errors).length) {
      return res.status(400).json({ error: 'Validación fallida', fields: errors });
    }

    // ─── reCAPTCHA v3 ───────────────────────────────────────
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
    if (!recJson.success || recJson.action !== 'register' || recJson.score < 0.5) {
      return res.status(403).json({ error: 'reCAPTCHA verification failed' });
    }

    // ─── DEDUPLICACIÓN con Redis (Upstash KV) ─────────────
    const [existsEmail, existsDni, existsPhone] = await Promise.all([
      kv.sismember('set:emails', email),
      kv.sismember('set:dnis', dni),
      kv.sismember('set:phones', telefono)
    ]);
    if (existsEmail || existsDni || existsPhone) {
      return res.status(409).json({ error: 'Ya existe un registro con ese DNI, teléfono o email' });
    }
    // Agregamos a los sets
    await Promise.all([
      kv.sadd('set:emails', email),
      kv.sadd('set:dnis', dni),
      kv.sadd('set:phones', telefono)
    ]);

    // ─── PREPARAR DATOS + SANITIZAR ─────────────────────────
    const safeData = {
      timestamp: new Date().toISOString(),
      ip,
      nombre: sanitize(nombre),
      apellido: sanitize(apellido),
      dni,
      telefono,
      email: sanitize(email),
      direccion: sanitize(direccion),
      comentarios: sanitize(comentarios || ''),
      zona: 'Pendiente',
      estado: 'Pendiente',
      lista: lista || ''
    };

    // ─── ESCRITURA EN SHEETS ───────────────────────────────
    await writeRow(safeData);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Unhandled error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

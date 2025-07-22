// api/register.js
import { writeRow } from '../services/sheetsService';
import { isValidEmail, isValidLength } from '../utils/validator';
import { sanitize } from '../utils/sanitizer';
import { RECAPTCHA_SECRET } from '../config/constants';

export default async function handler(req, res) {
  console.log('>> nuevo request:', req.method);
  console.log('>> body recibido:', req.body);

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { nombre, email, recaptchaToken } = req.body;

  // ─── 1) Verificación reCAPTCHA v3 ─────────────────────────
  if (!recaptchaToken) {
    return res.status(400).json({ error: 'Falta token de reCAPTCHA' });
  }

  const recRes = await fetch(
    'https://www.google.com/recaptcha/api/siteverify',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `secret=${encodeURIComponent(RECAPTCHA_SECRET)}&response=${encodeURIComponent(recaptchaToken)}`
    }
  );

  const recJson = await recRes.json();
  console.log('>> reCAPTCHA result:', recJson);

  // Ajusta el umbral (0.5) y asegura que la acción coincida
  if (
    !recJson.success ||
    recJson.action !== 'register' ||
    recJson.score < 0.5
  ) {
    return res.status(403).json({ error: 'reCAPTCHA verification failed' });
  }

  // ─── 2) Validaciones de datos ─────────────────────────────
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Email inválido' });
  }
  if (!isValidLength(nombre, 50)) {
    return res.status(400).json({ error: 'Nombre inválido o demasiado largo' });
  }

  // ─── 3) Sanitización ───────────────────────────────────────
  const data = {
    nombre: sanitize(nombre),
    email:  sanitize(email)
  };

  // ─── 4) Escritura en Google Sheets ─────────────────────────
  try {
    await writeRow(data);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Error escribiendo en Sheets:', e);
    return res.status(500).json({ error: 'Error al escribir en la base de datos' });
  }
}

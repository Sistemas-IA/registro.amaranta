// api/register.js
import { writeRow } from '../services/sheetsService';
import { isValidEmail, isValidLength } from '../utils/validator';
import { sanitize } from '../utils/sanitizer';

export default async function handler(req, res) {
  console.log('>> nuevo request:', req.method);
  console.log('>> body recibido:', req.body);

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { nombre, email } = req.body;

  // 1) Validaciones
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Email inválido' });
  }
  if (!isValidLength(nombre, 50)) {
    return res.status(400).json({ error: 'Nombre inválido o demasiado largo' });
  }

  // 2) Sanitización
  const data = {
    nombre: sanitize(nombre),
    email: sanitize(email)
  };

  // 3) Escritura en Sheets
  try {
    await writeRow(data);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Error escribiendo en Sheets:', e);
    return res.status(500).json({ error: 'Error al escribir en la base de datos' });
  }
}

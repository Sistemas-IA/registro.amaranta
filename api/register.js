// api/register.js
import { writeRow } from '../services/sheetsService';

export default async function handler(req, res) {
  console.log('>> nuevo request:', req.method);
  console.log('>> body recibido:', req.body);

  if (req.method === 'POST') {
    try {
      await writeRow(req.body);
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('Error escribiendo en Sheets:', e);
      return res.status(500).json({ error: 'Error al escribir en la base de datos' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

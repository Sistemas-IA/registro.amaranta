// api/registrar.js  (reenviando el token al backend GAS)
import { API_URL, API_KEY } from '../src/constants.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  // req.body ya incluye el token
  const body = JSON.stringify(req.body);

  const response = await fetch(API_URL + '?route=register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    },
    body
  });

  const data = await response.json();
  // Reenvía tal cual la respuesta del backend
  return res.status(response.status).json(data);
}
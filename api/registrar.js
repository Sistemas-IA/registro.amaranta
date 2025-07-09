// api/registrar.js  (reenviando el token al backend GAS)
// --- Pon tus valores aquí ---
const API_URL = "https://script.google.com/macros/s/AKfycbyhOmXxYWg8qz1PtZmtzkRtOmA5PdA8cNXGL11b8D8nNw17o746GT4lVDvYgiexy3CDWA/exec";
const API_KEY = "c4c164f9-f6ab-4b29-a8b6-91394cf17e27
";   // la misma que tienes en GAS
// ----------------------------

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

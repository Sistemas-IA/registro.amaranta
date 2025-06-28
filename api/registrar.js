// Archivo: /api/registrar.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  try {
    const response = await fetch("https://script.google.com/macros/s/AKfycbxeihypxexCu1lPpsl2EN9_Zi3Gv9a1YtufuTeCdhLhi9DISqZcCy7QIGamvRbAHZCLGw/exec", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    const result = await response.json();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error de conexión con Apps Script.' });
  }
}

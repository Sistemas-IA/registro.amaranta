// /api/registrar.js

const https = require('https');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    const {
      nombre,
      apellido,
      dni,
      telefono,
      email,
      direccion,
      comentarios
    } = req.body;

    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    const gasUrl = process.env.GAS_ENDPOINT_URL;

    const payload = JSON.stringify({
      nombre,
      apellido,
      dni,
      telefono,
      email,
      direccion,
      comentarios
    });

    const url = new URL(gasUrl);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      }
    };

    const responseFromGAS = await new Promise((resolve, reject) => {
      const request = https.request(options, (resp) => {
        let data = '';
        resp.on('data', chunk => data += chunk);
        resp.on('end', () => resolve(data));
      });

      request.on('error', reject);
      request.write(payload);
      request.end();
    });

    res.status(200).json({ success: true, response: JSON.parse(responseFromGAS) });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al enviar datos a GAS' });
  }
};

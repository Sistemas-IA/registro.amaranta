import Busboy from 'busboy';

export const config = {
  api: {
    bodyParser: false, // Necesario para usar Busboy
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Método no permitido" });
  }

  const fields = {};

  // Parsear los campos del form usando Busboy
  await new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });

    busboy.on('field', (fieldname, val) => {
      fields[fieldname] = val;
    });

    busboy.on('finish', resolve);
    busboy.on('error', reject);

    req.pipe(busboy);
  });

  const {
    nombre, apellido, dni, telefono,
    email, direccion, comentarios,
    zona = "", estado = "",
    ["g-recaptcha-response"]: recaptchaToken
  } = fields;

  // Verificar honeypot
  const honeypotActiva = zona.trim() !== "" || estado.trim() !== "";
  if (honeypotActiva) {
    console.warn("Intento con honeypot activo");
    return res.status(200).json({ message: "Error al enviar, intentá de nuevo más tarde" });
  }

  // Verificar reCAPTCHA con Google
  const verifyResponse = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: process.env.RECAPTCHA_SECRET_KEY || "6LdNAXUrAAAAAPIQkyTVFPqs1S0a6Eb2oczOnsG8",
      response: recaptchaToken,
    }),
  });

  const recaptchaData = await verifyResponse.json();

  if (!recaptchaData.success || recaptchaData.score < 0.5) {
    console.warn("Fallo reCAPTCHA", recaptchaData);
    return res.status(200).json({ message: "Error al enviar, intentá de nuevo más tarde" });
  }

  // Obtener IP real
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || "";

  // Preparar datos para GAS
  const GAS_URL = process.env.GAS_ENDPOINT_URL;
  const payload = {
    nombre,
    apellido,
    dni,
    telefono,
    email,
    direccion,
    comentarios,
    zona: "Pendiente",
    estado: "Pendiente",
    timestamp: new Date().toISOString(),
    ip,
  };

  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) throw new Error("Error al registrar en GAS");

    return res.status(200).json({ message: "Registro exitoso" });

  } catch (err) {
    console.error("Error al enviar a GAS:", err);
    return res.status(500).json({ message: "Error al enviar, intentá de nuevo más tarde" });
  }
}

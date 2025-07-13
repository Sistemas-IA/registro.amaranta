import Busboy from 'busboy';

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Método no permitido" });
  }

  /* ─ Parsear multipart ─ */
  const fields = {};
  await new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    busboy.on('field', (name, val) => { fields[name] = val; });
    busboy.on('finish', resolve).on('error', reject);
    req.pipe(busboy);
  });

  /* ─ Extraer campos ─ */
  const {
    nombre, apellido, dni,
    codArea, numeroTelefono,          // ← nuevos
    email, direccion, comentarios,
    lista = "", zona = "", estado = "",
    ["g-recaptcha-response"]: recaptchaToken
  } = fields;

  /* ─ Honeypot ─ */
  if (zona.trim() || estado.trim()) {
    return res.status(200).json({ message:"Error al enviar, intentá de nuevo más tarde" });
  }

  /* ─ Verificar reCAPTCHA ─ */
  const verify = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method:"POST",
    headers:{ "Content-Type":"application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: process.env.RECAPTCHA_SECRET_KEY,
      response: recaptchaToken,
    }),
  }).then(r => r.json());

  if (!verify.success) {
    return res.status(200).json({ message:"Error al enviar, intentá de nuevo más tarde" });
  }

  /* ─ Construir teléfono ─ */
  const telefono = '549' + codArea + numeroTelefono;

  /* ─ Preparar payload para GAS ─ */
  const ip = req.headers["x-forwarded-for"]?.split(',')[0] || req.socket?.remoteAddress || "";
  const payload = {
    nombre,
    apellido,
    dni,
    telefono,                 // ← ya concatenado
    email,
    direccion,
    comentarios,
    zona:"Pendiente",
    estado:"Pendiente",
    lista,
    timestamp: new Date().toISOString(),
    ip,
  };

  try {
    const resp = await fetch(process.env.GAS_ENDPOINT_URL, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) throw new Error("Error al registrar en GAS");
    return res.status(200).json({ message:"Registro exitoso" });
  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ message:"Error al enviar, intentá de nuevo más tarde" });
  }
}

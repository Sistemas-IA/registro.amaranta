import Busboy from 'busboy';

export const config = {
  api: { bodyParser: false },
};

/* ───────────── Patrones y mensajes ───────────── */

const PATTERNS = {
  nombre: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s-]{2,30}$/,
  apellido: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s-]{2,30}$/,
  dni: /^\d{8}$/,
  codArea: /^\d{2,4}$/,
  numeroTelefono: /^\d{7,9}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  direccion: /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ.,#\/º°()\-\s]{5,100}$/,
  comentarios: /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ., ()\n\r-]{0,300}$/, // opcional
};
/* ───────────── Sanitización anti‑XSS ───────────── */
function sanitizeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}


const ERR = {
  dni_invalido: "DNI inválido",
  tel_invalido: "Teléfono inválido",
  email_invalido: "E‑mail inválido",
  direccion_invalida: "Dirección inválida",
  campos_bot: "Campo oculto no debe tener contenido",
  recaptcha: "Fallo en reCAPTCHA",
  duplicado_dni: "DNI ya registrado",
  duplicado_tel: "Teléfono ya registrado",
  duplicado_email: "E‑mail ya registrado",
  generic: "Error inesperado, intentá de nuevo más tarde"
};

/* ───────────── Handler ───────────── */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  /* ─ Parsear multipart ─ */
  const fields = {};
  await new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    busboy.on('field', (name, val) => { fields[name] = val.trim(); });
    busboy.on('finish', resolve).on('error', reject);
    req.pipe(busboy);
  });

  /* ─ Honeypots ─ */
  if ((fields.zona || "").trim() !== "" || (fields.estado || "").trim() !== "") {
    return res.status(200).json({ error: "campos_bot" });
  }

  /* ─ Validación espejo ─ */
  for (const key of Object.keys(PATTERNS)) {
    const value = fields[key] || "";
    if (!PATTERNS[key].test(value)) {
      const errorKey = (key === 'numeroTelefono' || key === 'codArea') ? 'tel_invalido' : key + '_invalido';
      return res.status(200).json({ error: errorKey });
    }
  }

  /* ─ reCAPTCHA v2 Invisible ─ */
  const recaptchaToken = fields["g-recaptcha-response"];
  const verify = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method:"POST",
    headers:{ "Content-Type":"application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: process.env.RECAPTCHA_SECRET_KEY,
      response: recaptchaToken,
    }),
  }).then(r => r.json()).catch(()=>({success:false}));

  if (!verify.success) {
    return res.status(200).json({ error: "recaptcha" });
  }

  /* ─ Normalizar y construir payload ─ */
  const telefono = '549' + fields.codArea + fields.numeroTelefono;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";

  const payload = {
    nombre: fields.nombre,
    apellido: fields.apellido,
    dni: fields.dni,
    telefono,
    email: fields.email,
    direccion: sanitizeHtml(fields.direccion),
    comentarios: sanitizeHtml(fields.comentarios || ""),
    zona: "Pendiente",
    estado: "Pendiente",
    lista: fields.lista || "",
    timestamp: new Date().toISOString(),
    ip
  };

  /* ─ Enviar a GAS ─ */
  try {
    const resp = await fetch(process.env.GAS_ENDPOINT_URL, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();
    if (data.status === "OK") {
      return res.status(200).json({ ok:true });
    } else {
      // data.error tendrá códigos duplicados o invalidos
      return res.status(200).json({ error: data.error || "generic" });
    }
  } catch (err) {
    console.error("API error:", err);
    return res.status(500).json({ error: "generic" });
  }
}

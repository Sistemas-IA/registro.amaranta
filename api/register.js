import Busboy from 'busboy';

export const config = { api: { bodyParser: false } };

/* ───────────── Patrones y mensajes ───────────── */
const PATTERNS = {
  nombre: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s-]{2,30}$/,
  apellido: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s-]{2,30}$/,
  dni: /^\d{8}$/,
  codArea: /^\d{2,4}$/,
  numeroTelefono: /^\d{7,9}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  direccion: /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ.,#\/º°()\-\s]{5,100}$/,
  comentarios: /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ., ()\/#º°\n\r-]{0,300}$/,
};
/* ───────────── Sanitización anti-XSS ───────────── */
const sanitizeHtml = str => String(str)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

const ERR = {
  dni_invalido: "DNI inválido",
  tel_invalido: "Teléfono inválido",
  email_invalido: "E-mail inválido",
  direccion_invalida: "Dirección inválida",
  campos_bot: "Campo oculto no debe tener contenido",
  recaptcha: "Fallo en reCAPTCHA",
  duplicado_dni: "DNI ya registrado",
  duplicado_tel: "Teléfono ya registrado",
  duplicado_email: "E-mail ya registrado",
  generic: "Error inesperado, intentá de nuevo más tarde"
};

/* ───────────── Upstash Redis rate-limit ───────────── */
const RURL  = process.env.UPSTASH_REDIS_REST_URL;
const RAUTH = `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`;

async function incrTTL(key, ttl) {
  const r1 = await fetch(`${RURL}/INCR/${key}`, { headers: { Authorization: RAUTH } })
    .then(r => r.json());
  if (r1.result === 1 && ttl) {
    await fetch(`${RURL}/EXPIRE/${key}/${ttl}`, { headers: { Authorization: RAUTH } });
  }
  return r1.result;
}
const clientIP = req =>
  (req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '')
    .split(',')[0].trim();

/* ───────────── Handler ───────────── */
export default async function handler(req, res) {
  /* ─ CSRF / CORS ─ */
  const allowedOrigins = ["https://registro.amaranta.ar"];
  const originHeader = req.headers.origin || req.headers.referer || '';
  const isAllowed = allowedOrigins.some(o => originHeader && originHeader.startsWith(o));
  if (!isAllowed) return res.status(403).json({ error: "CSRF" });

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Origin', originHeader);
  if (req.method === "OPTIONS") {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  /* ─ Rate-limit antes de trabajar ─ */
  const ip = clientIP(req);
  const now = Date.now();
  const today = new Date().toISOString().slice(0,10);
  const hourKey = `rate:${ip}:h:${Math.floor(now/3_600_000)}`;
  const dayKey  = `rate:${ip}:d:${today}`;
  const globKey = `rate:global:${today}`;

  const [hHits, dHits, gHits] = await Promise.all([
    incrTTL(hourKey, 3600),     // 5 req / IP / h
    incrTTL(dayKey,  86400),    // 20 req / IP / día
    incrTTL(globKey, 86400)     // 5 000 global / día
  ]);

  if (gHits > 5000) return res.status(503).json({ error: "Servicio saturado" });
  if (hHits > 5 || dHits > 20) {
    res.setHeader('Retry-After', hHits > 5 ? 3600 : 86400);
    return res.status(429).json({ error: "Demasiados intentos, intentá más tarde" });
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
      const errKey = (key === 'numeroTelefono' || key === 'codArea')
        ? 'tel_invalido' : `${key}_invalido`;
      return res.status(200).json({ error: errKey });
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
      remoteip: ip            // ← añadido
    }),
  }).then(r => r.json()).catch(()=>({success:false}));

  if (!verify.success) return res.status(200).json({ error: "recaptcha" });

  /* ─ Normalizar y construir payload ─ */
  const telefono = '549' + fields.codArea + fields.numeroTelefono;
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
    if (data.status === "OK") return res.status(200).json({ ok:true });
    return res.status(200).json({ error: data.error || "generic" });
  } catch (err) {
    console.error("API error:", err);
    return res.status(500).json({ error: "generic" });
  }
}

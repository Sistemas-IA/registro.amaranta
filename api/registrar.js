import { CONFIG_SERVER } from "../lib/config.server.js";
import {
  esDNIValido, esEmailValido, esTelefonoValido, esTextoValido,
  esDireccionValida, esComentarioValido, esListaPermitida,
  esHoneypotVacio, normalizarTelefono, sanitizar
} from "../public/src/validaciones.js";

/**
 * Serverless Function – /api/registrar
 * Compatible con reCAPTCHA v2 Invisible + GAS (10 Jul 2025)
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ exito: false, mensaje: "Método no permitido" });
  }

  /* ─── Parsear body ─── */
  const rawBody = req.body;
  const datos   = typeof rawBody === "string" ? JSON.parse(rawBody) : (rawBody || {});

  /* ─── Validar reCAPTCHA ─── */
  try {
    const token = datos.recaptcha;
    if (!token) throw new Error("Token vacío");

    const resp = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${CONFIG_SERVER.RECAPTCHA_SECRET_KEY}&response=${token}`
    });

    const resultado = await resp.json();
    console.log("reCAPTCHA-DEBUG →", resultado);   // mira esta línea en los Logs

    if (!resultado.success) {
      /* ← devolvemos también la respuesta de Google para depurar */
      return res.status(403).json({
        exito: false,
        mensaje: "Verificación fallida. Sospecha de bot.",
        google: resultado          // <— aquí vienen los “error-codes”
      });
    }
  } catch (err) {
    console.error("reCAPTCHA error:", err);
    return res.status(403).json({ exito: false, mensaje: "Error en reCAPTCHA." });
  }

  /* ─── Sanitizar + validaciones espejo ─── */
  const nombre      = sanitizar(datos.Nombre || "");
  const apellido    = sanitizar(datos.Apellido || "");
  const dni         = sanitizar(datos.DNI || "");
  const email       = sanitizar(datos.Email || "").toLowerCase();
  const codArea     = sanitizar(datos.CodArea || "");
  const numero      = sanitizar(datos.Numero || "");
  const direccion   = sanitizar(datos.Direccion || "");
  const comentarios = sanitizar(datos.Comentarios || "");
  const lista       = sanitizar(datos.Lista || "");
  const zona        = datos.Zona || "";
  const estado      = datos.Estado || "";

  if (!esTextoValido(nombre))            return res.status(400).json({ exito:false, mensaje:"Nombre inválido" });
  if (!esTextoValido(apellido))          return res.status(400).json({ exito:false, mensaje:"Apellido inválido" });
  if (!esDNIValido(dni))                 return res.status(400).json({ exito:false, mensaje:"DNI inválido" });
  if (!esEmailValido(email))             return res.status(400).json({ exito:false, mensaje:"Email inválido" });
  if (!esTelefonoValido(codArea,numero)) return res.status(400).json({ exito:false, mensaje:"Teléfono inválido" });
  if (!esDireccionValida(direccion))     return res.status(400).json({ exito:false, mensaje:"Dirección inválida" });
  if (!esComentarioValido(comentarios))  return res.status(400).json({ exito:false, mensaje:"Comentarios inválidos" });
  if (!esListaPermitida(lista))          return res.status(400).json({ exito:false, mensaje:"Lista inválida" });
  if (!esHoneypotVacio(zona) || !esHoneypotVacio(estado))
                                         return res.status(400).json({ exito:false, mensaje:"Sospecha de bot." });

  /* ─── Bloqueo simple por IP ─── */
  const ip         = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || "";
  const claveCache = `registro_ip_${ip}`;
  const ahoraISO   = new Date().toISOString();

  const cache = global.ipCache ||= {};
  cache[claveCache] ||= [];
  cache[claveCache] = cache[claveCache].filter(ts => (
    new Date(ts).toDateString() === new Date().toDateString()
  ));

  if (cache[claveCache].length >= CONFIG_SERVER.LIMITE_REGISTROS_POR_IP) {
    return res.status(429).json({ exito:false, mensaje:"Límite diario de registros por IP alcanzado." });
  }
  cache[claveCache].push(ahoraISO);

  /* ─── Enviar a GAS ─── */
  const fila = [
    nombre, apellido, dni, normalizarTelefono(codArea,numero), email,
    direccion, comentarios, "Pendiente", "Pendiente", lista, ahoraISO, ip
  ];

  try {
    const respGAS = await fetch(CONFIG_SERVER.GAS_ENDPOINT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: fila })        // el GAS espera { data: [...] }
    });

    const texto = await respGAS.text();
    if (texto.trim() === "OK") {
      return res.status(200).json({ exito:true });
    } else {
      console.error("GAS respondió:", texto);
      return res.status(500).json({ exito:false, mensaje:"Error al guardar en la planilla" });
    }
  } catch (err) {
    console.error("❌ Error al enviar a GAS:", err);
    return res.status(500).json({ exito:false, mensaje:"Error interno en el servidor" });
  }
}

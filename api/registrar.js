import { CONFIG_SERVER } from "../../lib/config.server.js";
import {
  esDNIValido, esEmailValido, esTelefonoValido, esTextoValido,
  esDireccionValida, esComentarioValido, esListaPermitida,
  esHoneypotVacio, normalizarTelefono, sanitizar
} from "../../public/src/validaciones.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ exito:false, mensaje:"Método no permitido" });
  }

  const datos = req.body;

  /* ---------- reCAPTCHA ---------- */
  try {
    const recaptchaToken = datos.recaptcha;
    if (!recaptchaToken) throw new Error("Token vacío");

    const validacion = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${CONFIG_SERVER.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`
    });

    const resultado = await validacion.json();
    console.log("reCAPTCHA-DEBUG →", resultado);   // 👈 NUEVO

    if (!resultado.success) {
      return res.status(403).json({ exito:false, mensaje:"Verificación fallida. Sospecha de bot." });
    }
  } catch (err) {
    return res.status(403).json({ exito:false, mensaje:"Error en reCAPTCHA." });
  }

  /* ---------- Validaciones espejo ---------- */
  // … (idéntico a tu código)

  /* ---------- Enviar a GAS ---------- */
  const fila = [ /* … */ ];
  try {
    const respuesta = await fetch(CONFIG_SERVER.GAS_ENDPOINT_URL, {
      method: "POST",
      body: JSON.stringify({ data: fila }),          // 👈  data, no fila
      headers: { "Content-Type": "application/json" }
    });

    const texto = await respuesta.text();            // 👈  texto, no JSON
    if (texto.trim() === "OK") {
      return res.status(200).json({ exito:true });
    } else {
      return res.status(500).json({ exito:false, mensaje:"Error al guardar en planilla" });
    }
  } catch (err) {
    console.error("❌ Error al enviar a GAS:", err);
    return res.status(500).json({ exito:false, mensaje:"Error interno en el servidor" });
  }
}

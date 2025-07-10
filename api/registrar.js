import { CONFIG } from "../../public/src/config.js";
import { CONFIG_SERVER } from "../../lib/config.server.js";
import { CONFIG_SERVER } from "../../lib/config.server.js";

// Validador espejo importado del frontend
import {
  esDNIValido,
  esEmailValido,
  esTelefonoValido,
  esTextoValido,
  esDireccionValida,
  esComentarioValido,
  esListaPermitida,
  esHoneypotVacio,
  normalizarTelefono,
  sanitizar
} from "../../public/src/validaciones.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ exito: false, mensaje: "Método no permitido" });
  }

  const datos = req.body;

  // Validación reCAPTCHA (invisible v2)
  try {
    const recaptchaToken = datos.recaptcha;
    if (!recaptchaToken) throw new Error("Token vacío");

    const validacion = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${CONFIG_SERVER.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`
    });

    const resultado = await validacion.json();
    if (!resultado.success) {
      return res.status(403).json({ exito: false, mensaje: "Verificación fallida. Sospecha de bot." });
    }
  } catch (error) {
    return res.status(403).json({ exito: false, mensaje: "Error en reCAPTCHA." });
  }

  // Sanitización + validación espejo
  const nombre = sanitizar(datos.Nombre || "");
  const apellido = sanitizar(datos.Apellido || "");
  const dni = sanitizar(datos.DNI || "");
  const email = sanitizar(datos.Email || "").toLowerCase();
  const codArea = sanitizar(datos.CodArea || "");
  const numero = sanitizar(datos.Numero || "");
  const direccion = sanitizar(datos.Direccion || "");
  const comentarios = sanitizar(datos.Comentarios || "");
  const lista = sanitizar(datos.Lista || "");
  const zona = datos.Zona || "";
  const estado = datos.Estado || "";

  if (!esTextoValido(nombre)) return res.status(400).json({ exito: false, mensaje: "Nombre inválido" });
  if (!esTextoValido(apellido)) return res.status(400).json({ exito: false, mensaje: "Apellido inválido" });
  if (!esDNIValido(dni)) return res.status(400).json({ exito: false, mensaje: "DNI inválido" });
  if (!esEmailValido(email)) return res.status(400).json({ exito: false, mensaje: "Email inválido" });
  if (!esTelefonoValido(codArea, numero)) return res.status(400).json({ exito: false, mensaje: "Teléfono inválido" });
  if (!esDireccionValida(direccion)) return res.status(400).json({ exito: false, mensaje: "Dirección inválida" });
  if (!esComentarioValido(comentarios)) return res.status(400).json({ exito: false, mensaje: "Comentarios inválidos" });
  if (!esListaPermitida(lista)) return res.status(400).json({ exito: false, mensaje: "Lista inválida" });
  if (!esHoneypotVacio(zona) || !esHoneypotVacio(estado)) return res.status(400).json({ exito: false, mensaje: "Sospecha de bot." });

  // Bloqueo por IP
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.connection.remoteAddress;
  const claveCache = `registro_ip_${ip}`;
  const ahora = new Date().toISOString();

  const cache = global.ipCache ||= {};
  cache[claveCache] ||= [];
  cache[claveCache] = cache[claveCache].filter(ts => new Date(ts).toDateString() === new Date().toDateString());

  if (cache[claveCache].length >= CONFIG.LIMITE_REGISTROS_POR_IP) {
    return res.status(429).json({ exito: false, mensaje: CONFIG.MENSAJE_LIMITE_IP });
  }

  cache[claveCache].push(ahora);

  // Armar datos para GAS
  const fila = [
    nombre,
    apellido,
    dni,
    normalizarTelefono(codArea, numero),
    email,
    direccion,
    comentarios,
    CONFIG.VALORES_DEFECTO.Zona,
    CONFIG.VALORES_DEFECTO.Estado,
    lista,
    ahora,
    ip
  ];

  try {
    const respuesta = await fetch(CONFIG_SERVER.GAS_ENDPOINT_URL, {
      method: "POST",
      body: JSON.stringify({ fila }),
      headers: { "Content-Type": "application/json" }
    });

    const resultado = await respuesta.json();

    if (resultado.exito) {
      return res.status(200).json({ exito: true });
    } else {
      return res.status(500).json({ exito: false, mensaje: "Error al guardar en planilla" });
    }
  } catch (error) {
    console.error("❌ Error al enviar a GAS:", error);
    return res.status(500).json({ exito: false, mensaje: "Error interno en el servidor" });
  }
}

// api/registrar.js

import { CONFIG } from "../src/config.js";
import { MENSAJES } from "../src/mensajes.js";
import {
  esTextoValido,
  esDNIValido,
  esTelefonoValido,
  normalizarTelefono,
  esEmailValido,
  esDireccionValida,
  esComentarioValido,
  esHoneypotVacio,
  esListaPermitida,
  sanitizar
} from "../src/validaciones.js";

let cache = {
  dni: new Set(),
  email: new Set(),
  telefono: new Set(),
  ipTrack: {}
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  const now = new Date().toISOString();
  const {
    Nombre,
    Apellido,
    DNI,
    Telefono,
    Email,
    Direccion,
    Comentarios,
    Zona,
    Estado,
    Lista,
    recaptchaToken
  } = req.body;

  // Límite por IP
  cache.ipTrack[ip] = (cache.ipTrack[ip] || 0) + 1;
  if (cache.ipTrack[ip] > CONFIG.LIMITE_REGISTROS_POR_IP) {
    return res.status(429).json({ error: MENSAJES.ERROR_IP });
  }

  // Validaciones backend
  try {
    if (!esTextoValido(Nombre)) throw MENSAJES.ERROR_NOMBRE;
    if (!esTextoValido(Apellido)) throw MENSAJES.ERROR_APELLIDO;
    if (!esDNIValido(DNI)) throw MENSAJES.ERROR_DNI;
    if (!esTelefonoValido(Telefono.slice(3, 5), Telefono.slice(5))) throw MENSAJES.ERROR_TEL;
    if (!esEmailValido(Email)) throw MENSAJES.ERROR_EMAIL;
    if (!esDireccionValida(Direccion)) throw MENSAJES.ERROR_DIRECCION;
    if (!esComentarioValido(Comentarios)) throw MENSAJES.ERROR_COMENTARIO;
    if (!esHoneypotVacio(Zona) || !esHoneypotVacio(Estado)) throw MENSAJES.ERROR_HONEYPOT;
    if (!esListaPermitida(Lista)) throw MENSAJES.ERROR_LISTA;
  } catch (err) {
    return res.status(400).json({ error: err });
  }

  // Chequeo de duplicados
  const dni = DNI.trim();
  const email = Email.trim().toLowerCase();
  const tel = Telefono.trim();

  if (cache.dni.has(dni)) return res.status(409).json({ error: MENSAJES.ERROR_DNI_REPETIDO });
  if (cache.email.has(email)) return res.status(409).json({ error: MENSAJES.ERROR_EMAIL_REPETIDO });
  if (cache.telefono.has(tel)) return res.status(409).json({ error: MENSAJES.ERROR_TEL_REPETIDO });

  // Verificar reCAPTCHA
  try {
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${CONFIG.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`
    });
    const data = await response.json();
    if (!data.success || data.score < 0.5) {
      return res.status(403).json({ error: MENSAJES.ERROR_CAPTCHA });
    }
  } catch (_) {
    return res.status(500).json({ error: MENSAJES.ERROR_CAPTCHA });
  }

  // Enviar a Google Apps Script
  try {
    const valores = [
      sanitizar(Nombre),
      sanitizar(Apellido),
      dni,
      tel,
      email,
      sanitizar(Direccion),
      sanitizar(Comentarios || ""),
      CONFIG.VALORES_DEFECTO.Zona,
      CONFIG.VALORES_DEFECTO.Estado,
      Lista,
      now,
      ip
    ];

    const response = await fetch(CONFIG.GAS_ENDPOINT_URL, {
      method: "POST",
      body: JSON.stringify({ data: valores })
    });

    const gasResponse = await response.text();
    if (!gasResponse.includes("OK")) throw new Error();

    // Agregar a cache
    cache.dni.add(dni);
    cache.email.add(email);
    cache.telefono.add(tel);

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: MENSAJES.ERROR_GENERAL });
  }
}

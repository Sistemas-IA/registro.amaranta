// mensajes.js

const MENSAJES = {
  EXITO: "✅ Registro exitoso. ¡Gracias por inscribirte!",

  // Errores de campos
  ERROR_NOMBRE: "⚠️ El nombre es obligatorio y debe contener solo letras (2-30 caracteres).",
  ERROR_APELLIDO: "⚠️ El apellido es obligatorio y debe contener solo letras (2-30 caracteres).",
  ERROR_DNI: "⚠️ El DNI debe tener exactamente 8 números.",
  ERROR_DNI_REPETIDO: "⚠️ Este DNI ya fue registrado.",
  ERROR_TEL: "⚠️ El teléfono no es válido. Verificá código de área y número.",
  ERROR_TEL_REPETIDO: "⚠️ Este número de teléfono ya fue registrado.",
  ERROR_EMAIL: "⚠️ El email no tiene un formato válido.",
  ERROR_EMAIL_REPETIDO: "⚠️ Este email ya fue registrado.",
  ERROR_DIRECCION: "⚠️ La dirección debe tener al menos 5 caracteres.",
  ERROR_COMENTARIO: "⚠️ El comentario no puede superar los 300 caracteres.",
  ERROR_LISTA: "⚠️ Lista no válida. Verificá que accediste desde el enlace correcto.",
  ERROR_HONEYPOT: "🚫 Error inesperado. (Bot detectado)",

  // Seguridad / control
  ERROR_IP: "⚠️ Se superó el límite de registros permitidos desde esta red. Si necesitás registrar más personas, comunicate con soporte.",
  ERROR_CAPTCHA: "⚠️ No se pudo verificar que sos humano. Recargá la página e intentá de nuevo.",

  // Errores generales
  ERROR_GENERAL: "❌ Ocurrió un error inesperado. Intentá de nuevo en unos minutos."
};

if (typeof module !== 'undefined') {
  module.exports = { MENSAJES };
}


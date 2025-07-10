// Public configuration - no secrets here
// config.js

const CONFIG = {
  // reCAPTCHA v2 invisible (clave del sitio - frontend)
  RECAPTCHA_SITE_KEY: "6LdNAXUrAAAAAIz5Vi5nLnkSHF-fjoTXPSKa2x6y",

  // reCAPTCHA secret key (solo para backend)

  // Límite de registros por IP por día
  LIMITE_REGISTROS_POR_IP: 10,

  // Lista blanca de códigos de lista válidos desde la URL (?l=)
  LISTAS_PERMITIDAS: Array.from({ length: 100 }, (_, i) => i.toString()),

  // Campos esperados (orden y nombres exactos como en Google Sheets)
  CAMPOS_CLIENTE: [
    "Nombre",
    "Apellido",
    "DNI",
    "Telefono",
    "Email",
    "Direccion",
    "Comentarios",
    "Zona",
    "Estado",
    "Lista",
    "Timestamp",
    "IP"
  ],

  // Valores por defecto para campos internos
  VALORES_DEFECTO: {
    Zona: "Pendiente",
    Estado: "Pendiente"
  },

  // Mensaje por defecto si se supera el límite por IP
  MENSAJE_LIMITE_IP: "⚠️ Esta red alcanzó el límite de registros diarios. Por favor, comunicate con soporte si necesitás registrar más personas.",

  // URL del endpoint de Google Apps Script
};

if (typeof module !== 'undefined') {
  module.exports = { CONFIG };
}

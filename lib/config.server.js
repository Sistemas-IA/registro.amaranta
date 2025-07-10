// lib/config.server.js
// ⚠️ Todo lo que esté aquí solo se usa en el back-end.
//    Las claves vienen de Variables de Entorno de Vercel.

export const CONFIG_SERVER = {
  RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY,
  GAS_ENDPOINT_URL:     process.env.GAS_ENDPOINT_URL,
  LIMITE_REGISTROS_POR_IP: 10               // cambia el número si quieres otro límite diario
};

// lib/config.server.js
// Este archivo sólo se importa desde código que corre en el servidor (pages/api/* en Vercel)
export const CONFIG_SERVER = {
  RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY,
  GAS_ENDPOINT_URL: process.env.GAS_ENDPOINT_URL,
  LIMITE_REGISTROS_POR_IP: 10,
  LISTAS_PERMITIDAS: Array.from({ length: 100 }, (_, i) => i.toString()),
};
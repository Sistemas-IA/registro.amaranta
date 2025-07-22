// services/sheetsService.js
import { SHEETS_WEBAPP_URL } from '../config/constants';

export async function writeRow(data) {
  // 1) Mostrar la URL que estamos usando
  console.log('>> writeRow – URL:', SHEETS_WEBAPP_URL);
  if (!SHEETS_WEBAPP_URL) {
    throw new Error('SHEETS_WEBAPP_URL no está definido');
  }

  // 2) Hacer el fetch al Web App de GAS
  const res = await fetch(SHEETS_WEBAPP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  // 3) Loguear status y texto crudo de la respuesta
  console.log('>> writeRow – status:', res.status, res.statusText);
  const text = await res.text();
  console.log('>> writeRow – respuesta raw:', text);

  // 4) Si no es 200, lanzamos error con detalle
  if (!res.ok) {
    throw new Error(`Sheets write failed ${res.status}: ${text}`);
  }

  // 5) Devolver el JSON parseado
  return JSON.parse(text);
}

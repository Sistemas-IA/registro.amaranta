// services/sheetsService.js
import { SHEETS_WEBAPP_URL } from '../config/constants';

export async function writeRow(data) {
  console.log('>> writeRow – URL:', SHEETS_WEBAPP_URL);
  if (!SHEETS_WEBAPP_URL) {
    throw new Error('SHEETS_WEBAPP_URL no está definido');
  }

  const res = await fetch(SHEETS_WEBAPP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  console.log('>> writeRow – status:', res.status, res.statusText);
  const text = await res.text();
  console.log('>> writeRow – respuesta raw:', text);

  if (!res.ok) {
    throw new Error(`Sheets write failed ${res.status}: ${text}`);
  }
  return JSON.parse(text);
}

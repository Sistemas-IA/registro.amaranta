// services/sheetsService.js
import { SHEETS_WEBAPP_URL } from '../config/constants';

export async function writeRow(data) {
  if (!SHEETS_WEBAPP_URL) {
    throw new Error('No se ha configurado SHEETS_WEBAPP_URL');
  }
  const res = await fetch(SHEETS_WEBAPP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets write failed ${res.status}: ${text}`);
  }
  return res.json();
}

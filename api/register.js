// Node 18 ESM
import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME     = process.env.SHEET_NAME || 'Clientes';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const {
      nombre, apellido, dni, codigo, numero, email,
      direccion, comentarios = '', lista, recaptchaToken, ip
    } = req.body || {};

    // 1. Verificar reCAPTCHA v3 (>0.5)
    const score = await verifyCaptcha(recaptchaToken, ip);
    if (score < 0.5) throw new Error('reCAPTCHA rechazó al usuario');

    // 2. Validaciones únicas (dni, teléfono, email)
    const uniqueCols = ['dni', 'telefono', 'email'];   // mapeo simplificado
    const existing   = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:F`
    });
    if (existing.data.values?.some(r =>
        r[2] === dni ||             // DNI
        r[4] === normalizarTel(codigo, numero) ||
        r[5] === email.toLowerCase())
    ) throw new Error('DNI, teléfono o email ya registrado');

    // 3. Insertar fila
    const fila = [
      nombre, apellido, dni,
      codigo, normalizarTel(codigo, numero), email,
      direccion, comentarios,
      'Pendiente',   // zona
      'Pendiente',   // estado
      lista,
      new Date().toISOString(),
      ip
    ];
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:Z`,
      valueInputOption: 'RAW',
      requestBody: { values: [fila] }
    });

    // 4. Enviar e‑mail de cortesía (opcional)
    //    await sendMail(nombre, email);

    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
}

async function verifyCaptcha(token, ip) {
  const params = new URLSearchParams({
    secret   : process.env.RECAPTCHA_SECRET,
    response : token,
    remoteip : ip
  });
  const r = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method : 'POST',
    body   : params
  }).then(r => r.json());
  return r.score || 0;
}

function normalizarTel(cod, num) {
  return '549' + cod + num;
}

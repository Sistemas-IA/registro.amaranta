import { google } from 'googleapis';

const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
const sheets = google.sheets({
  version: 'v4',
  auth: new google.auth.JWT(
    creds.client_email,
    null,
    creds.private_key,
    ['https://www.googleapis.com/auth/spreadsheets']
  )
});

export async function getExistingKeys() {
  // Columnas B (DNI), C (Tel), D (Email) – A=Timestamp
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: `${process.env.SHEET_NAME}!B:D`,
    majorDimension: 'COLUMNS'
  });
  const [dnis = [], tels = [], emails = []] = data.values || [];
  return { dnis: new Set(dnis), tels: new Set(tels), emails: new Set(emails) };
}

export async function appendRow(rowArray) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: `${process.env.SHEET_NAME}!A:K`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [rowArray] }
  });
}

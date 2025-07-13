/**
 * Hoja y bloqueo
 * ————————————————————————————————————————
 * 1) ID DE LA SPREADSHEET en PropertiesService → menos riesgo de apuntar
 *    a la hoja equivocada si clonas el proyecto.
 * 2) LockService para evitar que dos envíos simultáneos pisen la misma fila.
 * 3) Todas las respuestas en JSON para que el frontend pueda interpretarlas.
 */

const SHEET_ID   = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
const SHEET_NAME = 'Registros';

function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return out({ status: 'ERROR_LOCK', message: 'Demasiados envíos simultáneos' });
  }

  try {
    const data = JSON.parse(e.postData.contents || '{}');

    const safe = {
      nombre:       esc(data.nombre),
      apellido:     esc(data.apellido),
      dni:          esc(data.dni),
      telefono:     esc(data.telefono),
      email:        esc(data.email),
      direccion:    esc(data.direccion),
      comentarios:  esc(data.comentarios),
      zona:         'Pendiente',
      estado:       'Pendiente',
      timestamp:    new Date().toISOString(),
      ip:           esc(data.ip),
    };

    const ss   = SpreadsheetApp.openById(SHEET_ID);
    const hoja = ss.getSheetByName(SHEET_NAME);
    hoja.appendRow(Object.values(safe));

    return out({ status: 'OK' });

  } catch (err) {
    console.error('Error en doPost:', err);
    return out({ status: 'ERROR', message: err.message });
  } finally {
    lock.releaseLock();
  }
}

function esc(value) {
  const str = String(value || '').trim();
  return str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')
    ? "'" + str
    : str;
}

function out(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
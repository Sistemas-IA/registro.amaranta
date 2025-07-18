/**
 * Formulario autoregistro – Validaciones espejo y control de duplicados
 * Hoja: Clientes
 * Columnas: nombre, apellido, dni, telefono, email, direccion, comentarios, zona, estado, lista, timestamp, ip
 */

/* ——— Config ——— */
const props      = PropertiesService.getScriptProperties();
const SHEET_ID   = props.getProperty('SHEET_ID');
const SHEET_NAME = props.getProperty('SHEET_NAME');

/* ——— Patrones (mismos que frontend y API) ——— */
const PATTERNS = {
  nombre: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s-]{2,30}$/,  
  apellido: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s-]{2,30}$/,  
  dni: /^\d{8}$/,  
  telefono: /^549\d{9,13}$/,                 // ya normalizado
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,   
  direccion: /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ.,#\/º°()\-\s]{5,100}$/,  
  comentarios: /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ., ()\/\#º°\n\r\-]{0,300}$/,  
};

/* ——— Sanitización anti‑XSS ——— */
function htmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/* ——— Helpers ——— */
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

/* ——— Handler ——— */
function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return out({ status: 'ERROR_LOCK', message: 'Demasiados envíos simultáneos' });
  }

  try {
    const data = JSON.parse(e.postData.contents || '{}');

    /* —— Validaciones espejo —— */
    for (var k in PATTERNS) {
      if (!PATTERNS[k].test(data[k] || '')) {
        return out({ status: 'ERROR_VALIDACION', error: k + '_invalido' });
      }
    }

    /* —— Duplicados —— */
    const ss   = SpreadsheetApp.openById(SHEET_ID);
    const hoja = ss.getSheetByName(SHEET_NAME);
    const last = hoja.getLastRow();

    // Columnas: 3 = DNI, 4 = Tel, 5 = Email
    if (last > 1) {
      // DNI
      if (hoja.getRange(2, 3, last-1, 1).createTextFinder(String(data.dni)).findNext()) {
        return out({ status: 'ERROR_DUPLICADO', error: 'duplicado_dni' });
      }
      // Teléfono
      if (hoja.getRange(2, 4, last-1, 1).createTextFinder(String(data.telefono)).findNext()) {
        return out({ status: 'ERROR_DUPLICADO', error: 'duplicado_tel' });
      }
      // Email
      if (hoja.getRange(2, 5, last-1, 1).createTextFinder(String(data.email)).findNext()) {
        return out({ status: 'ERROR_DUPLICADO', error: 'duplicado_email' });
      }
    }

    /* —— Escapar y Normalizar Datos —— */
    const safe = {
      nombre:       esc(data.nombre),
      apellido:     esc(data.apellido),
      dni:          esc(data.dni),
      telefono:     esc(data.telefono),
      email:        esc(data.email),
      direccion:    htmlEscape(esc(data.direccion)),
      comentarios:  htmlEscape(esc(data.comentarios)),
      zona:         'Pendiente',
      estado:       'Pendiente',
      lista:        esc(data.lista),
      timestamp:    new Date().toISOString(),
      ip:           esc(data.ip),
    };

    hoja.appendRow(Object.values(safe));

    return out({ status: 'OK' });

  } catch (err) {
    console.error('Error en doPost:', err);
    return out({ status: 'ERROR', message: err.message });
  } finally {
    lock.releaseLock();
  }
}

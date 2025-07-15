// === Code.gs ===
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
  nombre:     /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s-]{2,30}$/,
  apellido:   /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s-]{2,30}$/,
  dni:        /^\d{8}$/,
  telefono:   /^549\d{9,13}$/,
  email:      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  direccion:  /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ.,#\/º°()\-\s]{5,100}$/,
  comentarios:/^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ., ()\/\#º°\n\r\-]{0,300}$/
};

/* ——— Sanitización anti-XSS ——— */
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
  // 1) Verificar SCRIPT_SECRET
  const EXPECTED = props.getProperty('SCRIPT_SECRET');
  let sentKey = null;
  try {
    const json = JSON.parse(e.postData.contents || '{}');
    sentKey = json.scriptKey;
  } catch (_) {}
  if (sentKey !== EXPECTED) {
    return out({ status: 'ERROR_AUTORIZACION', error: 'no autorizado' });
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return out({ status: 'ERROR_LOCK', message: 'Demasiados envíos simultáneos' });
  }

  try {
    const data = JSON.parse(e.postData.contents || '{}');

    // 2) Validaciones espejo
    for (let k in PATTERNS) {
      if (!PATTERNS[k].test(data[k] || '')) {
        return out({ status: 'ERROR_VALIDACION', error: k + '_invalido' });
      }
    }

    // 3) Validar lista entre 1 y 99
    const listaNum = parseInt(data.lista, 10);
    if (isNaN(listaNum) || listaNum < 1 || listaNum > 99) {
      return out({ status: 'ERROR_VALIDACION', error: 'lista_invalida' });
    }

    // 4) Control de duplicados (lectura en bloque)
    const ss   = SpreadsheetApp.openById(SHEET_ID);
    const hoja = ss.getSheetByName(SHEET_NAME);
    const last = hoja.getLastRow();
    if (last > 1) {
      // cargo arrays
      const dnis  = hoja.getRange(2, 3, last - 1, 1).getValues().flat();
      const tels  = hoja.getRange(2, 4, last - 1, 1).getValues().flat();
      const mails = hoja.getRange(2, 5, last - 1, 1).getValues().flat();

      if (dnis.includes(String(data.dni))) {
        return out({ status: 'ERROR_DUPLICADO', error: 'duplicado_dni' });
      }
      if (tels.includes(String(data.telefono))) {
        return out({ status: 'ERROR_DUPLICADO', error: 'duplicado_tel' });
      }
      if (mails.includes(String(data.email))) {
        return out({ status: 'ERROR_DUPLICADO', error: 'duplicado_email' });
      }
    }

    // 5) Escapar y normalizar datos
    const safe = {
      nombre:      esc(data.nombre),
      apellido:    esc(data.apellido),
      dni:         esc(data.dni),
      telefono:    esc(data.telefono),
      email:       esc(data.email),
      direccion:   htmlEscape(esc(data.direccion)),
      comentarios: htmlEscape(esc(data.comentarios)),
      zona:        'Pendiente',
      estado:      'Pendiente',
      lista:       listaNum.toString(),
      timestamp:   new Date().toISOString(),
      ip:          esc(data.ip)
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

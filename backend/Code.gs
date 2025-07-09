const SHEET_NAME = 'Clientes';
const FAIL_SHEET = 'IntentosFallidos';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    const errs = validarDatos(data);
    if (Object.keys(errs).length) return rechazo(data, 'validacion');

    escribirFila(data);
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log(err);
    return rechazo({}, 'error_interno');
  }
}

function validarDatos(d) {
  const errs = {};
  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]{2,30}$/.test(d.nombre)) errs.nombre = true;
  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]{2,30}$/.test(d.apellido)) errs.apellido = true;
  if (!/^\d{8}$/.test(d.dni)) errs.dni = true;
  if (!/^549\d{9,13}$/.test(d.telefono)) errs.telefono = true;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) errs.email = true;
  if (d.direccion.length < 3 || d.direccion.length > 100) errs.direccion = true;
  if (d.comentarios && d.comentarios.length > 300) errs.comentarios = true;
  if (d.Zona || d.Estado) errs.honeypot = true;
  return errs;
}

function sanitizar(v) {
  return String(v).trim().replace(/^[=+\-@]/, '\\u200B$&');
}

function escribirFila(d) {
  const ss = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const now = new Date();
  ss.appendRow([
    sanitizar(d.nombre),
    sanitizar(d.apellido),
    sanitizar(d.dni),
    sanitizar(d.telefono),
    sanitizar(d.email),
    sanitizar(d.direccion),
    sanitizar(d.comentarios),
    'Pendiente',
    sanitizar(d.lista),
    'Pendiente',
    now,
    sanitizar(d.ip || '')
  ]);
}

function rechazo(data, motivo) {
  const ss = SpreadsheetApp.getActive().getSheetByName(FAIL_SHEET);
  ss.appendRow([new Date(), motivo, JSON.stringify(data).slice(0, 500)]);
  return ContentService.createTextOutput(JSON.stringify({ ok: false, motivo }))
    .setMimeType(ContentService.MimeType.JSON)
    .setResponseCode(400);
}

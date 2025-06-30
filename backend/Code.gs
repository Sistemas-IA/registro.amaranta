
const HOJA = 'Registro';
const HOJA_FALLIDOS = 'IntentosFallidos';

const MENSAJES = {
  EXITO: "¡Registro exitoso!",
  ERROR_GENERAL: "Ocurrió un error inesperado. Por favor, intentá nuevamente.",
  DUPLICADO: "Ya existe un registro con ese DNI, teléfono o email.",
  NOMBRE_INVALIDO: "Nombre inválido.",
  APELLIDO_INVALIDO: "Apellido inválido.",
  DNI_INVALIDO: "DNI inválido.",
  TELEFONO_INVALIDO: "Teléfono inválido.",
  EMAIL_INVALIDO: "Email inválido.",
  DIRECCION_INVALIDA: "Dirección inválida.",
  COMENTARIOS_LARGOS: "Los comentarios son demasiado largos.",
  LISTA_INVALIDA: "Lista inválida."
};

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = ss.getSheetByName(HOJA);
    const hojaFallidos = ss.getSheetByName(HOJA_FALLIDOS) || ss.insertSheet(HOJA_FALLIDOS);
    const data = JSON.parse(e.postData.contents);

    const ip = data.ip || "IP no detectada";
    const timestamp = new Date();

    const limpiarCampo = (v) => String(v || '').trim().replace(/^[=+\-@]/, '').replace(/[\r\n]/g, ' ');

    const nombre = limpiarCampo(data.nombre);
    const apellido = limpiarCampo(data.apellido);
    const dni = limpiarCampo(data.dni);
    const codArea = limpiarCampo(data.codArea);
    const telefono = limpiarCampo(data.telefono);
    const email = limpiarCampo(data.email);
    const direccion = limpiarCampo(data.direccion);
    const comentarios = limpiarCampo(data.comentarios);
    const lista = limpiarCampo(data.lista);

    if (nombre.length < 2 || nombre.length > 40 || /[^a-zA-ZÁ-ú ]/.test(nombre)) throw MENSAJES.NOMBRE_INVALIDO;
    if (apellido.length < 2 || apellido.length > 40 || /[^a-zA-ZÁ-ú ]/.test(apellido)) throw MENSAJES.APELLIDO_INVALIDO;
    if (!/^\d{8}$/.test(dni)) throw MENSAJES.DNI_INVALIDO;
    if (!/^\d{2,4}$/.test(codArea)) throw MENSAJES.TELEFONO_INVALIDO;
    if (!/^\d{6,8}$/.test(telefono)) throw MENSAJES.TELEFONO_INVALIDO;
    if (!/^.{1,100}@.{1,100}\..{2,}$/.test(email)) throw MENSAJES.EMAIL_INVALIDO;
    if (direccion.length < 3 || direccion.length > 120) throw MENSAJES.DIRECCION_INVALIDA;
    if (comentarios.length > 200) throw MENSAJES.COMENTARIOS_LARGOS;
    if (lista.length === 0 || lista.length > 5) throw MENSAJES.LISTA_INVALIDA;

    const registros = hoja.getDataRange().getValues();
    const existe = registros.some(row => row[2] == dni || row[3] == telefono || row[4] == email);
    if (existe) throw MENSAJES.DUPLICADO;

    const fila = [
      nombre,
      apellido,
      dni,
      codArea + telefono,
      email,
      direccion,
      comentarios,
      "Pendiente",
      lista,
      "Pendiente",
      timestamp,
      ip
    ];

    hoja.appendRow(fila);
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: MENSAJES.EXITO })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    const mensaje = typeof error === 'string' ? error : MENSAJES.ERROR_GENERAL;
    if (e && e.postData) {
      const hojaFallidos = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_FALLIDOS);
      hojaFallidos.appendRow([new Date(), e.postData.contents, mensaje]);
    }
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: mensaje })).setMimeType(ContentService.MimeType.JSON);
  }
}

const HOJA = 'Registro';
const HOJA_FALLIDOS = 'IntentosFallidos';
const MAX_COMENTARIOS = 200;

// 🧾 Mensajes personalizables
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
  COMENTARIOS_LARGOS: "Los comentarios son demasiado largos."
};

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = ss.getSheetByName(HOJA);
    const hojaFallidos = ss.getSheetByName(HOJA_FALLIDOS) || ss.insertSheet(HOJA_FALLIDOS);
    const data = JSON.parse(e.postData.contents);

    const ip = data.ip || "IP no detectada";
    const registros = hoja.getDataRange().getValues();
    const encabezados = registros[0];
    const dniIndex = 2, telIndex = 3, emailIndex = 4;

    if (!data.nombre || data.nombre.length < 2 || data.nombre.length > 40)
      return registrarFallido(MENSAJES.NOMBRE_INVALIDO, data, ip, hojaFallidos);

    if (!data.apellido || data.apellido.length < 2 || data.apellido.length > 40)
      return registrarFallido(MENSAJES.APELLIDO_INVALIDO, data, ip, hojaFallidos);
        
    if (!/^\d{8}$/.test(data.dni))
      return registrarFallido(MENSAJES.DNI_INVALIDO, data, ip, hojaFallidos);

    if (!/^\d{10,15}$/.test(data.telefono))
      return registrarFallido(MENSAJES.TELEFONO_INVALIDO, data, ip, hojaFallidos);

    if (!/^\S+@\S+\.\S+$/.test(data.email) || data.email.length > 60)
      return registrarFallido(MENSAJES.EMAIL_INVALIDO, data, ip, hojaFallidos);

    if (!data.direccion || data.direccion.length < 3 || data.direccion.length > 80)
      return registrarFallido(MENSAJES.DIRECCION_INVALIDA, data, ip, hojaFallidos);

    if (data.comentarios && data.comentarios.length > MAX_COMENTARIOS)
      return registrarFallido(MENSAJES.COMENTARIOS_LARGOS, data, ip, hojaFallidos);

    const duplicado = registros.some(row =>
      row[dniIndex] == data.dni || row[telIndex] == data.telefono || row[emailIndex] == data.email
    );
    if (duplicado)
      return registrarFallido(MENSAJES.DUPLICADO, data, ip, hojaFallidos);

    // ✅ Guardar DNI como texto para conservar ceros iniciales
    hoja.appendRow([
      data.nombre,
      data.apellido,
      String(data.dni),
      data.telefono,
      data.email,
      data.direccion,
      data.comentarios || '',
      "Pendiente",
      data.l || '',
      "a revisar",
      new Date(),
      ip
    ]);

    return ContentService.createTextOutput(JSON.stringify({ success: true, message: MENSAJES.EXITO }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, message: MENSAJES.ERROR_GENERAL })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function registrarFallido(motivo, data, ip, hojaFallidos) {
  hojaFallidos.appendRow([
    new Date(),
    motivo,
    data.dni,
    data.telefono,
    data.email,
    ip
  ]);
  return ContentService.createTextOutput(
    JSON.stringify({ success: false, message: motivo })
  ).setMimeType(ContentService.MimeType.JSON);
}


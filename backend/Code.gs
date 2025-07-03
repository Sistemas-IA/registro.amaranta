const MENSAJES = {
  YA_REGISTRADO: "Ya existe un registro con estos datos.",
  BOT_DETECTADO: "Bot detectado. Operación cancelada.",
  ERROR_GENERAL: "Ha ocurrido un error. Por favor, intente nuevamente.",
};

function doPost(e) {
  try {
    const datos = JSON.parse(e.postData.contents);

    if (!datos || typeof datos !== 'object') {
      return respuestaError("Datos inválidos");
    }

    // Verificar honeypot
    if (!datos.hasOwnProperty("camposExtra") || datos.camposExtra.trim() !== "") {
      registrarIntentoFallido(datos, "honeypot");
      return respuestaError(MENSAJES.BOT_DETECTADO);
    }

    const hoja = SpreadsheetApp.getActive().getSheetByName("Registro");
    const intentos = SpreadsheetApp.getActive().getSheetByName("IntentosFallidos");
    const ip = e?.postData?.headers?.["X-Forwarded-For"] || "desconocida";

    const dni = sanitizar(datos.dni);
    const email = sanitizar(datos.email);
    const telefono = normalizarTelefono(datos.telefono);

    // Verificar duplicados
    const registros = hoja.getDataRange().getValues();
    if (registros.some(row => row[2] === dni || row[4] === telefono || row[5] === email)) {
      registrarIntentoFallido(datos, "duplicado");
      return respuestaError(MENSAJES.YA_REGISTRADO);
    }

    // Control por IP
    const hoy = Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd");
    const intentosHoy = intentos.getDataRange().getValues().filter(r => 
      r[0] && r[0].toString().includes(hoy) && r[5] === ip
    );
    if (intentosHoy.length >= 10) {
      registrarIntentoFallido(datos, "limite IP");
      return respuestaError("Límite diario alcanzado para esta IP.");
    }

    hoja.appendRow([
      new Date(),
      sanitizar(datos.nombre),
      dni,
      sanitizar(datos.apellido),
      telefono,
      email,
      sanitizar(datos.direccion),
      sanitizar(datos.comentarios),
      "Pendiente", // Estado
      "Pendiente", // Zona
      sanitizar(datos.lista),
    ]);

    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return respuestaError(MENSAJES.ERROR_GENERAL);
  }
}

function respuestaError(msg) {
  return ContentService.createTextOutput(JSON.stringify({ success: false, message: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

function sanitizar(valor) {
  if (typeof valor !== 'string') return '';
  return valor.toString().trim()
    .replace(/^[=+@\-]/, "'")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizarTelefono(tel) {
  tel = tel.replace(/\D/g, "");
  if (tel.length >= 9 && tel.length <= 13) {
    return "+549" + tel;
  }
  return tel;
}

function registrarIntentoFallido(datos, motivo) {
  const hoja = SpreadsheetApp.getActive().getSheetByName("IntentosFallidos");
  hoja.appendRow([
    new Date(),
    datos.dni || '',
    datos.email || '',
    datos.telefono || '',
    motivo,
    Session.getActiveUser().getEmail()
  ]);
}
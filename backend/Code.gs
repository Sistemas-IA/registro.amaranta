const HOJA = 'Registro';
const HOJA_FALLIDOS = 'IntentosFallidos';
const MAX_COMENTARIOS = 200;

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = ss.getSheetByName(HOJA);
    const hojaFallidos = ss.getSheetByName(HOJA_FALLIDOS) || ss.insertSheet(HOJA_FALLIDOS);
    const data = JSON.parse(e.postData.contents);

    const ip = data.ip || "IP no detectada";

    // 🛡️ Anti fórmula: detectar si algún valor comienza con símbolo peligroso
    const campos = [data.nombre, data.apellido, data.dni, data.telefono, data.email, data.direccion, data.comentarios];
    if (campos.some(c => /^[=+\-@]/.test(c))) return registrarFallido("Datos potencialmente peligrosos", data, ip, hojaFallidos);

    // 🕵️ Honeypot
    if (data.extra && data.extra.trim() !== "") return registrarFallido("Bot detectado (honeypot)", data, ip, hojaFallidos);

    if (!data.nombre || data.nombre.length < 2 || data.nombre.length > 40)
      return registrarFallido("Nombre inválido.", data, ip, hojaFallidos);

    if (!data.apellido || data.apellido.length < 2 || data.apellido.length > 40)
      return registrarFallido("Apellido inválido.", data, ip, hojaFallidos);

    if (!/^\d{8}$/.test(data.dni))
      return registrarFallido("DNI inválido.", data, ip, hojaFallidos);

    if (!/^\d{10,15}$/.test(data.telefono))
      return registrarFallido("Teléfono inválido.", data, ip, hojaFallidos);

    if (!/^\S+@\S+\.\S+$/.test(data.email) || data.email.length > 60)
      return registrarFallido("Email inválido.", data, ip, hojaFallidos);

    if (!data.direccion || data.direccion.length < 3 || data.direccion.length > 80)
      return registrarFallido("Dirección inválida.", data, ip, hojaFallidos);

    if (data.comentarios && data.comentarios.length > MAX_COMENTARIOS)
      return registrarFallido("Comentarios demasiado largos.", data, ip, hojaFallidos);

    hoja.appendRow([
      String(data.nombre),
      String(data.apellido),
      String(data.dni),
      String(data.telefono),
      String(data.email),
      String(data.direccion),
      String(data.comentarios || ""),
      new Date(),
      ip
    ]);

    return ContentService.createTextOutput(JSON.stringify({ exito: true, mensaje: "¡Registro exitoso!" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ exito: false, mensaje: "Error inesperado." }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function registrarFallido(motivo, data, ip, hoja) {
  hoja.appendRow([
    new Date(), motivo,
    String(data.nombre || ""), String(data.apellido || ""), String(data.dni || ""),
    String(data.telefono || ""), String(data.email || ""), ip
  ]);
  return ContentService.createTextOutput(JSON.stringify({ exito: false, mensaje: motivo }))
    .setMimeType(ContentService.MimeType.JSON);
}

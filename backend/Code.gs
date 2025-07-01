const TOKEN_EXPIRATION_MINUTES = 15;

function doGet(e) {
  const token = Utilities.getUuid();
  const cache = CacheService.getScriptCache();
  cache.put(token, "valid", TOKEN_EXPIRATION_MINUTES * 60);
  return ContentService.createTextOutput(JSON.stringify({ token })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const token = String(data.token || "").trim();
    const cache = CacheService.getScriptCache();
    const valid = cache.get(token);

    if (!valid) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "token_expired" })).setMimeType(ContentService.MimeType.JSON);
    }

    cache.remove(token);  // Eliminar token usado

    // Sanitizar y guardar datos
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Respuestas");
    const fila = [
      String(data.nombre || ""),
      String(data.apellido || ""),
      String(data.dni || ""),
      String(data.telefono || ""),
      String(data.email || ""),
      String(data.direccion || ""),
      String(data.comentarios || ""),
      new Date()
    ];
    sheet.appendRow(fila);

    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "internal_error" })).setMimeType(ContentService.MimeType.JSON);
  }
}

const TOKEN_EXPIRATION_MS = 15 * 60 * 1000;

function doGet(e) {
  const token = Utilities.getUuid();
  const timestamp = Date.now();
  const props = PropertiesService.getScriptProperties();
  props.setProperty(token, String(timestamp));
  return ContentService.createTextOutput(JSON.stringify({ token })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const token = String(data.token || "").trim();
    const props = PropertiesService.getScriptProperties();
    const created = parseInt(props.getProperty(token), 10);

    if (!created || (Date.now() - created > TOKEN_EXPIRATION_MS)) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "token_expired" })).setMimeType(ContentService.MimeType.JSON);
    }

    props.deleteProperty(token);  // Evitar reuso

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

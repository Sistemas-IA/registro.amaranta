function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  const data = JSON.parse(e.postData.contents);

  const now = new Date();
  const ip = e.parameter.ip || ""; // Si se incluye IP en la URL, opcional

  sheet.appendRow([
    data.nombre || "",
    data.apellido || "",
    data.dni || "",
    data.telefono || "",
    data.email || "",
    data.direccion || "",
    data.comentarios || "",
    "", // Zona (completado luego)
    "", // Estado (completado luego)
    "", // Lista (completado luego)
    Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"),
    ip
  ]);

  return ContentService.createTextOutput(JSON.stringify({ success: true }))
                       .setMimeType(ContentService.MimeType.JSON);
}

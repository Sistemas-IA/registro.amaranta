function doPost(e) {
  try {
    const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Registros");
    const data = JSON.parse(e.postData.contents);

    hoja.appendRow([
      data.nombre || "",
      data.apellido || "",
      data.dni || "",
      data.telefono || "",
      data.email || "",
      data.direccion || "",
      data.comentarios || "",
      data.zona || "Pendiente",
      data.estado || "Pendiente",
      data.timestamp || new Date().toISOString(),
      data.ip || ""
    ]);

    return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);

  } catch (err) {
    console.error("Error en doPost:", err);
    return ContentService.createTextOutput("ERROR").setMimeType(ContentService.MimeType.TEXT);
  }
}


function doPost(e){
  var sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if(!sheetId){
    return ContentService.createTextOutput(JSON.stringify({status:"ERR_CFG"}))
           .setMimeType(ContentService.MimeType.JSON);
  }
  var ss = SpreadsheetApp.openById(sheetId);
  var sh = ss.getSheetByName('Registros') || ss.getSheets()[0];
  var data = JSON.parse(e.postData.contents);
  function esc(v){ return (typeof v==='string' && /^[=+\-@]/.test(v)) ? "'"+v : v; }
  sh.appendRow([
    new Date(), esc(data.ip), esc(data.nombre), esc(data.apellido),
    esc(data.dni), esc(data.telefono), esc(data.email),
    esc(data.direccion), esc(data.comentarios),
    data.zona, data.estado, data.lista
  ]);
  return ContentService.createTextOutput(JSON.stringify({status:"OK"}))
         .setMimeType(ContentService.MimeType.JSON);
}

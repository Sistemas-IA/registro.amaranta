
const DURACION_TOKEN_SEGUNDOS = 600;
const LIMITE_POR_IP_DIARIO = 10;

function doGet(e) {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(token, "valido", DURACION_TOKEN_SEGUNDOS);

  const lista = e.parameter.l || "";
  const template = HtmlService.createTemplateFromFile("index");
  template.token = token;
  template.lista = lista;
  return template.evaluate().setTitle("Registro Amaranta").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  const hojaRegistro = SpreadsheetApp.getActive().getSheetByName("Registro");
  const hojaLog = SpreadsheetApp.getActive().getSheetByName("IntentosFallidos");
  const hojaIP = SpreadsheetApp.getActive().getSheetByName("ControlIP") || SpreadsheetApp.getActive().insertSheet("ControlIP");
  const datos = JSON.parse(e.postData.contents);

  const ip = e?.parameter?.ip || e?.headers?.["X-Forwarded-For"] || "desconocida";
  const timestamp = new Date();

  function limpiar(str) {
    return str.toString().trim()
      .replace(/^=/, "'=")
      .replace(/[;"\\]/g, "")
      .replace(/\s{2,}/g, " ");
  }

  const campos = ["nombre", "apellido", "dni", "telefono", "email", "direccion", "comentarios", "zona", "lista", "estado"];
  const entrada = {};
  for (let campo of campos) {
    entrada[campo] = limpiar(datos[campo] || "");
  }

  const tokenRecibido = datos.token;
  const tokenValido = CacheService.getScriptCache().get(tokenRecibido);
  if (!tokenValido) {
    hojaLog.appendRow([timestamp, ip, entrada.nombre, entrada.dni, "Token inválido o vencido"]);
    return ContentService.createTextOutput("Token inválido o vencido");
  }

  const validaciones = {
    nombre: v => /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]{2,30}$/.test(v),
    apellido: v => /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]{2,30}$/.test(v),
    dni: v => /^\d{8}$/.test(v),
    telefono: v => /^549\d{9,13}$/.test(v),
    email: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    direccion: v => v.length >= 3 && v.length <= 100,
    comentarios: v => v.length <= 300
  };

  for (let campo in validaciones) {
    if (!validaciones[campo](entrada[campo])) {
      hojaLog.appendRow([timestamp, ip, entrada.nombre, entrada.dni, "Validación fallida: " + campo]);
      return ContentService.createTextOutput("Validación fallida en " + campo);
    }
  }

  if (entrada.zona !== "" || entrada.estado !== "") {
    hojaLog.appendRow([timestamp, ip, entrada.nombre, entrada.dni, "Honeypot detectado"]);
    return ContentService.createTextOutput("Solicitud rechazada.");
  }

  entrada.zona = "Pendiente";
  entrada.estado = "Pendiente";

  const registros = hojaRegistro.getDataRange().getValues();
  for (let fila of registros) {
    const [_, __, dni, telefono, email] = fila;
    if (dni == entrada.dni || telefono == entrada.telefono || email == entrada.email) {
      hojaLog.appendRow([timestamp, ip, entrada.nombre, entrada.dni, "Duplicado detectado"]);
      return ContentService.createTextOutput("Ya estás registrado.");
    }
  }

  // Control por IP
  const hoy = Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd");
  const datosIP = hojaIP.getDataRange().getValues();
  let encontrada = false;
  for (let i = 1; i < datosIP.length; i++) {
    if (datosIP[i][0] == ip && datosIP[i][1] == hoy) {
      if (datosIP[i][2] >= LIMITE_POR_IP_DIARIO) {
        hojaLog.appendRow([timestamp, ip, entrada.nombre, entrada.dni, "Límite por IP superado"]);
        return ContentService.createTextOutput("Demasiados intentos desde esta IP.");
      } else {
        hojaIP.getRange(i + 1, 3).setValue(datosIP[i][2] + 1);
        encontrada = true;
        break;
      }
    }
  }
  if (!encontrada) {
    hojaIP.appendRow([ip, hoy, 1]);
  }

  hojaRegistro.appendRow([
    entrada.nombre,
    entrada.apellido,
    entrada.dni,
    entrada.telefono,
    entrada.email,
    entrada.direccion,
    entrada.comentarios,
    entrada.zona,
    entrada.lista,
    entrada.estado,
    timestamp,
    ip
  ]);

  return ContentService.createTextOutput("Registrado con éxito");
}

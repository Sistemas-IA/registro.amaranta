
function doPost(e) {
  const hojaRegistro = SpreadsheetApp.getActive().getSheetByName("Registro");
  const hojaLog = SpreadsheetApp.getActive().getSheetByName("IntentosFallidos");
  const datos = JSON.parse(e.postData.contents);

  
  // Verificar reCAPTCHA con Google
  const tokenRecaptcha = datos.tokenRecaptcha || "";
  const respuestaGoogle = UrlFetchApp.fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "post",
    payload: {
      secret: "6LdNAXUrAAAAAPIQkyTVFPqs1S0a6Eb2oczOnsG8",
      response: tokenRecaptcha
    }
  });
  const resultadoRecaptcha = JSON.parse(respuestaGoogle.getContentText());

  if (!resultadoRecaptcha.success || resultadoRecaptcha.score < 0.4) {
    hojaLog.appendRow([new Date(), ip, entrada.nombre, entrada.dni, "reCAPTCHA inválido o sospechoso"]);
    return ContentService.createTextOutput("reCAPTCHA inválido o sospechoso.");
  }

const ip = e?.parameter?.ip || e?.headers?.["X-Forwarded-For"] || "desconocida";
  const timestamp = new Date();

  // Sanitizar
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

  // Validaciones espejo
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

  // Honeypots: zona y estado deben estar vacíos
  if (entrada.zona !== "" || entrada.estado !== "") {
    hojaLog.appendRow([timestamp, ip, entrada.nombre, entrada.dni, "Honeypot detectado"]);
    return ContentService.createTextOutput("Solicitud rechazada.");
  }

  // Reforzar campos internos
  entrada.zona = "Pendiente";
  entrada.estado = "Pendiente";

  // Verificar duplicados
  const registros = hojaRegistro.getDataRange().getValues();
  for (let fila of registros) {
    const [_, __, dni, telefono, email] = fila;
    if (dni == entrada.dni || telefono == entrada.telefono || email == entrada.email) {
      hojaLog.appendRow([timestamp, ip, entrada.nombre, entrada.dni, "Duplicado detectado"]);
      return ContentService.createTextOutput("Ya estás registrado.");
    }
  }

  // Guardar registro
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

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaRegistro = ss.getSheetByName("Registro");
    const hojaIntentos = ss.getSheetByName("IntentosFallidos");
    const payload = JSON.parse(e.postData.contents);

    // Función de sanitización
    const sanitizar = (valor) => {
      const limpio = String(valor).trim();
      if (/^[=+\-@]/.test(limpio)) return "'" + limpio; // previene fórmulas
      return limpio.replace(/[<>]/g, ""); // remueve etiquetas HTML
    };

    // Honeypot
    if (payload.honeypot && payload.honeypot.trim() !== "") {
      hojaIntentos.appendRow([new Date(), "Honeypot activado", JSON.stringify(payload)]);
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Solicitud bloqueada" })).setMimeType(ContentService.MimeType.JSON);
    }

    // Token
    const TOKEN_ESPERADO = "TOKEN_SEGURO_GENERADO";
    if (payload.token !== TOKEN_ESPERADO) {
      hojaIntentos.appendRow([new Date(), "Token inválido", JSON.stringify(payload)]);
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Token inválido" })).setMimeType(ContentService.MimeType.JSON);
    }

    // Validaciones
    const validarCampo = (valor, regex) => regex.test(String(valor).trim());

    if (!validarCampo(payload.nombre, /^.{3,40}$/)) throw "Nombre inválido";
    if (!validarCampo(payload.apellido, /^.{3,40}$/)) throw "Apellido inválido";
    if (!validarCampo(payload.dni, /^[0-9]{8}$/)) throw "DNI inválido";
    if (!validarCampo(payload.telefono, /^\+549[0-9]{10,12}$/)) throw "Teléfono inválido";
    if (!validarCampo(payload.email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/)) throw "Email inválido";
    if (!validarCampo(payload.direccion, /^.{3,}$/)) throw "Dirección inválida";
    if (!validarCampo(payload.comentarios || "", /^.{0,200}$/)) throw "Comentarios demasiado largos";
    if (!payload.lista || payload.lista === "no definida") throw "Lista no especificada";

    // Duplicados
    const valores = hojaRegistro.getDataRange().getValues();
    for (let i = 1; i < valores.length; i++) {
      const fila = valores[i];
      const [,, dni, telefono, email] = fila;
      if ([dni, telefono, email].includes(payload.dni) || telefono === payload.telefono || email === payload.email) {
        throw "Ya existe un registro con esos datos (DNI, teléfono o email)";
      }
    }

    const ip = e?.headers?.["x-forwarded-for"] || "desconocida";

    // Armar fila sanitizada
    const fila = [
      sanitizar(payload.nombre),
      sanitizar(payload.apellido),
      sanitizar(payload.dni),
      sanitizar(payload.telefono),
      sanitizar(payload.email),
      sanitizar(payload.direccion),
      sanitizar(payload.comentarios),
      "Pendiente",
      sanitizar(payload.lista),
      "a revisar",
      new Date(),
      ip
    ];

    hojaRegistro.appendRow(fila);

    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    const hojaIntentos = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("IntentosFallidos");
    hojaIntentos.appendRow([new Date(), error, e.postData.contents]);
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: error })).setMimeType(ContentService.MimeType.JSON);
  }
}
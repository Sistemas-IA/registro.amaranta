/* ---------------------------------------------------------------
   Lógica del front–end: lee el formulario, ejecuta reCAPTCHA v2
   invisible y envía los datos al back-end.
---------------------------------------------------------------- */
import {
  sanitizar,
  esTextoValido,
  esDNIValido,
  esEmailValido,
  esTelefonoValido,
  esDireccionValida,
  esComentarioValido,
  esListaPermitida,
  normalizarTelefono
} from "./validaciones.js";

/* ───── Helpers ───── */
const form = document.getElementById("form");     // ajusta el id si cambiaste
function obtenerDatos() {
  const f = form.elements;
  return {
    Nombre:      sanitizar(f.Nombre.value),
    Apellido:    sanitizar(f.Apellido.value),
    DNI:         sanitizar(f.DNI.value),
    Email:       sanitizar(f.Email.value).toLowerCase(),
    CodArea:     sanitizar(f.CodArea.value),
    Numero:      sanitizar(f.Numero.value),
    Direccion:   sanitizar(f.Direccion.value),
    Comentarios: sanitizar(f.Comentarios.value),
    Lista:       sanitizar(f.Lista.value),
    Zona:        f.Zona.value,     // honeypots
    Estado:      f.Estado.value
  };
}
function validarCliente(d) {
  const errs = [];
  if (!esTextoValido(d.Nombre))             errs.push("Nombre");
  if (!esTextoValido(d.Apellido))           errs.push("Apellido");
  if (!esDNIValido(d.DNI))                  errs.push("DNI");
  if (!esEmailValido(d.Email))              errs.push("Email");
  if (!esTelefonoValido(d.CodArea, d.Numero)) errs.push("Teléfono");
  if (!esDireccionValida(d.Direccion))      errs.push("Dirección");
  if (!esComentarioValido(d.Comentarios))   errs.push("Comentarios");
  if (!esListaPermitida(d.Lista))           errs.push("Lista");
  return errs;
}

/* ───── Interceptar envío ───── */
form.addEventListener("submit", e => {
  e.preventDefault();
  const datos = obtenerDatos();
  const errores = validarCliente(datos);
  if (errores.length) {
    alert("Corrige: " + errores.join(", "));
    return;
  }
  grecaptcha.execute();          // lanza reCAPTCHA invisible
});

/* ───── Callback global para Google ───── */
async function onCaptchaSuccess(token) {
  const datos = obtenerDatos();
  datos.recaptcha = token;       // añade token

  try {
    const resp = await fetch("/api/registrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos)
    });
    const json = await resp.json();
    console.log("Respuesta back-end →", json);
    alert(json.exito ? "✅ ¡Registrado!" : (json.mensaje || "Error"));
  } catch (err) {
    console.error(err);
    alert("Error de red");
  } finally {
    grecaptcha.reset();          // permite nuevo intento
    form.reset();
  }
}
/* ← esta línea lo hace visible para reCAPTCHA */
window.onCaptchaSuccess = onCaptchaSuccess;

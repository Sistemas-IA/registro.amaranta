import {
  sanitizar,
  esTextoValido,
  esEmailValido,
  esComentarioValido,
  esHoneypotVacio
} from "./validaciones.js";

/* Log para confirmar que el módulo sí se carga */
console.log("✅ main.js cargado");

const form = document.getElementById("form");
form.addEventListener("submit", e => {
  e.preventDefault();          // evita recargar la página
  grecaptcha.execute();        // dispara el captcha invisible
});

/* Google llama a esta función cuando emite el token */
function onCaptchaSuccess(token) {
  console.log("🔑 TOKEN-recaptcha:", token.slice(0,10), "…");
  const f = form.elements;
  const datos = {
    Nombre:      sanitizar(f.Nombre.value),
    Email:       sanitizar(f.Email.value).toLowerCase(),
    Comentarios: "",
    Zona:        f.Zona.value,
    Estado:      f.Estado.value,
    recaptcha:   token
  };

  // Validaciones mínimas de ejemplo
  if (!esTextoValido(datos.Nombre) || !esEmailValido(datos.Email) ||
      !esComentarioValido(datos.Comentarios) ||
      !esHoneypotVacio(datos.Zona) || !esHoneypotVacio(datos.Estado)) {
    alert("🔴 Datos inválidos");
    grecaptcha.reset();
    return;
  }

  fetch("/api/registrar", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(datos)
  })
  .then(r => r.json())
  .then(j => {
    console.log("Respuesta backend:", j);
    alert(j.exito ? "✅ Registrado" : (j.mensaje||"Error"));
    grecaptcha.reset();
    form.reset();
  })
  .catch(err => {
    console.error(err);
    alert("Error de red");
    grecaptcha.reset();
  });
}

/* Hacemos el callback GLOBAL para Google */
window.onCaptchaSuccess = onCaptchaSuccess;

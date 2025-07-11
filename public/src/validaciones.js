/* ------------------------------------------------------------------
   Validaciones del formulario – versión mínima y autosuficiente
   Edita las expresiones o reglas según tus requisitos reales.
------------------------------------------------------------------ */

/* ───── Utilidades ───── */
export function sanitizar(texto = "") {
  return String(texto).replace(/[<>"'=]/g, "").trim();
}
export function normalizarTelefono(codArea, numero) {
  return `${codArea}${numero}`.replace(/\D/g, "");
}
function longitud(txt, min, max) {
  const l = txt.trim().length;
  return l >= min && l <= max;
}

/* ───── Validaciones de campos ───── */
export function esTextoValido(txt) {
  return /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/.test(txt) && longitud(txt, 2, 30);
}
export function esDNIValido(dni) {
  return /^\d{8}$/.test(dni);
}
export function esEmailValido(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}
export function esTelefonoValido(codArea, numero) {
  const tel = normalizarTelefono(codArea, numero);
  return /^\d{9,13}$/.test(tel);
}
export function esDireccionValida(dir) {
  return longitud(dir, 3, 100);
}
export function esComentarioValido(com) {
  return longitud(com, 0, 300);
}
export function esListaPermitida(lista) {
  return /^\d{1,2}$/.test(lista);
}
export function esHoneypotVacio(valor) {
  return valor.trim() === "";
}

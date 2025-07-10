// validaciones.js

// Constantes de validación
const LISTAS_PERMITIDAS = Array.from({ length: 100 }, (_, i) => i.toString());

function esTextoValido(valor, min = 2, max = 30) {
  const regex = new RegExp(`^[a-zA-ZÁÉÍÓÚáéíóúÑñ\s]{${min},${max}}$`);
  return regex.test(valor.trim());
}

function esDNIValido(dni) {
  const limpio = dni.trim().replace(/^0+/, ''); // eliminar ceros a izquierda
  return /^\d{8}$/.test(limpio);
}

function esTelefonoValido(codArea, numero) {
  const cod = codArea.trim();
  const num = numero.trim();
  const completo = cod + num;
  return /^\d{9,13}$/.test(completo);
}

function normalizarTelefono(codArea, numero) {
  return '549' + codArea.trim() + numero.trim();
}

function esEmailValido(email) {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim().toLowerCase());
}

function esDireccionValida(direccion) {
  return /^[a-zA-Z0-9\s.,º#\-]{5,100}$/.test(direccion.trim());
}

function esComentarioValido(comentario) {
  return comentario.trim().length <= 300;
}

function esHoneypotVacio(valor) {
  return valor.trim() === '';
}

function esListaPermitida(valor) {
  return LISTAS_PERMITIDAS.includes(valor.trim());
}

function sanitizar(valor) {
  return valor.replace(/["'=<>]/g, '').trim();
}

// Exportación
if (typeof module !== 'undefined') {
  module.exports = {
    esTextoValido,
    esDNIValido,
    esTelefonoValido,
    normalizarTelefono,
    esEmailValido,
    esDireccionValida,
    esComentarioValido,
    esHoneypotVacio,
    esListaPermitida,
    sanitizar,
    LISTAS_PERMITIDAS
  };
}


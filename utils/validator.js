// utils/validator.js

/**
 * Valida formato de email básico.
 */
export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && re.test(email);
}

/**
 * Valida que str exista y no exceda max caracteres.
 */
export function isValidLength(str, max = 100) {
  return typeof str === 'string' && str.length > 0 && str.length <= max;
}

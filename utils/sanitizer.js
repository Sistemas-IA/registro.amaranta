// utils/sanitizer.js

/**
 * Elimina prefijos "=" para evitar fórmulas,
 * escapa "<" y ">" para prevenir XSS,
 * trim final.
 */
export function sanitize(input) {
  if (typeof input !== 'string') return '';
  let s = input;
  // Quitar cualquier "=" al principio
  s = s.replace(/^=+/, '');
  // Escapar etiquetas
  s = s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return s.trim();
}

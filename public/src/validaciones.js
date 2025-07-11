export const sanitizar = t => String(t).replace(/[<>"'=]/g,"").trim();
export const esTextoValido   = t => /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]{2,30}$/.test(t);
export const esEmailValido   = e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
export const esComentarioValido = c => c.trim().length <= 300;       // ¡ya existe!
export const esHoneypotVacio   = v => v.trim() === "";

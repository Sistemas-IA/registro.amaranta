export const config = {
  telPrefix: '549',
  maxComment: 300,
  limits: { maxBodyBytes: 1000000, maxPerMinute: 5, maxPerDay: 50 },
  patterns: {
    nombre:/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\-\s]{2,30}$/,
    apellido:/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\-\s]{2,30}$/,
    dni:/^\d{8}$/,
    codArea:/^\d{2,4}$/,
    numeroTelefono:/^\d{7,9}$/,
    email:/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
    direccion:/^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ.,#\/º°()\-\s]{5,100}$/,
    comentarios:/^[\s\S]{0,300}$/
  },
  texts: {
    success:'✅ Registro enviado correctamente',
    errorRecaptcha:'❌ Error en reCAPTCHA, intentá de nuevo',
    errorServer:'❌ Error de servidor, intentalo más tarde'
  }
};

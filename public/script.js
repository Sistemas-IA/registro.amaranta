// public/script.js

document.addEventListener('DOMContentLoaded', () => {
  const form  = document.getElementById('register-form');
  const error = document.getElementById('error');
  const btn   = document.getElementById('submit-btn');

  btn.addEventListener('click', async () => {
    // Limpiar errores anteriores
    error.style.display = 'none';
    error.textContent   = '';

    const nombre = form.nombre.value.trim();
    const email  = form.email.value.trim();

    // Validación mínima
    if (!nombre || !email) {
      error.textContent = 'Nombre y email son obligatorios.';
      error.style.display = 'block';
      return;
    }

    try {
      // Esperar a que recaptcha esté listo
      await grecaptcha.ready();
      // Generar token
      const token = await grecaptcha.execute(
        '6Le2sYMrAAAAABmpey7GOWmQHVua3PxJ5gnHsbGp',
        { action: 'register' }
      );

      // Llamada AJAX a tu API
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email, recaptchaToken: token })
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        alert('Registro exitoso 🎉');
        form.reset();
      } else {
        alert('Error: ' + (data.error || 'Algo salió mal'));
      }
    } catch (err) {
      console.error('Error al enviar:', err);
      alert('No se pudo conectar al servidor o reCAPTCHA falló.');
    }
  });
});

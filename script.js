/* global grecaptcha */
(() => {
  const SITE_KEY = '6Le2sYMrAAAAABmpey7GOWmQHVua3PxJ5gnHsbGp';           // <- tu clave de sitio
  const form     = document.getElementById('f');

  // lee parámetro l (?l=5) o 0
  const lista = new URL(location.href).searchParams.get('l') || '0';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;

    const btn = form.querySelector('button');
    btn.disabled = true;

    try {
      const data  = Object.fromEntries(new FormData(form));
      data.lista  = lista;
      data.ip     = await (await fetch('https://api.ipify.org?format=json')).json().then(r => r.ip);

      const token = await grecaptcha.execute(SITE_KEY, { action: 'submit' });
      const res   = await fetch('/api/register', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ ...data, recaptchaToken: token })
      });
      const json  = await res.json();
      if (!json.ok) throw new Error(json.error);
      alert('¡Registro recibido! Revisá tu correo ✔');
      form.reset();
      history.replaceState(null, '', location.pathname);         // limpia ?l
    } catch (err) {
      alert(err.message || 'Error de red');
    } finally {
      btn.disabled = false;
    }
  });
})();

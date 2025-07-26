/* global grecaptcha */
(() => {
  const SITE_KEY = '6Le2sYMrAAAAABmpey7GOWmQHVua3PxJ5gnHsbGp';
  const f = document.getElementById('f');

  // pre‑carga parámetro l
  const url = new URL(location.href);
  const l = url.searchParams.get('l') || '0';

  f.addEventListener('submit', async e => {
    e.preventDefault();
    if (!f.reportValidity()) return;

    const btn = f.querySelector('button');
    btn.disabled = true;

    const datos = Object.fromEntries(new FormData(f));
    datos.l = l;

    try {
      const token = await grecaptcha.execute(SITE_KEY,{action:'submit'});
      const res = await fetch('/api/register', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...datos, recaptchaToken:token})
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      alert('Registro recibido. Revisá tu correo ✔️');
      f.reset();
      history.replaceState(null,'',location.pathname);
    } catch(err){
      alert(err.message || 'Error de red');
    } finally{ btn.disabled = false; }
  });
})();

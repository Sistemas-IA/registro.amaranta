import { CLAVES_PUBLICAS, MENSAJES } from './lib/constantes.js';
import { validar, fusionTelefono } from './lib/validadores.js';

const form = document.getElementById('registro');
const btn = document.getElementById('btn');
const spinner = document.getElementById('spinner');

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();

  const datos = {
    nombre: form.nombre.value.trim(),
    apellido: form.apellido.value.trim(),
    dni: form.dni.value.trim(),
    codArea: form.codArea.value.trim(),
    numCel: form.numCel.value.trim(),
    email: form.email.value.trim(),
    direccion: form.direccion.value.trim(),
    comentarios: form.comentarios.value.trim(),
    lista: new URLSearchParams(location.search).get('l') ?? ''
  };

  document.querySelectorAll('.msg').forEach(n => n.textContent = '');
  const errs = validar(datos);
  if (Object.keys(errs).length) {
    for (const k in errs) document.getElementById('err-' + k).textContent = errs[k];
    return;
  }

  btn.disabled = true;
  spinner.classList.remove('hidden');

  try {
    const token = await grecaptcha.execute(CLAVES_PUBLICAS.RECAPTCHA_SITE_KEY, { action: 'submit' });

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...datos, telefono: fusionTelefono(datos.codArea, datos.numCel), token })
    });

    if (res.status === 409) {
      alert(MENSAJES.DUPLICADO);
    } else if (res.ok) {
      alert(MENSAJES.EXITO);
      form.reset();
    } else if (res.status === 400) {
      alert(MENSAJES.ERROR_CAPTCHA);
    } else {
      alert(MENSAJES.ERROR_GENERAL);
    }
  } catch (err) {
    console.error(err);
    alert(MENSAJES.ERROR_GENERAL);
  } finally {
    btn.disabled = false;
    spinner.classList.add('hidden');
  }
});

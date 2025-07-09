import { CLAVES_PUBLICAS, MENSAJES } from './lib/constantes.js';
import { validar, fusionTelefono } from './lib/validadores.js';

const f = document.getElementById('registro');
const btn = document.getElementById('btn');
const spinner = document.getElementById('spinner');

f.addEventListener('submit', async (e) => {
  e.preventDefault();

  const datos = {
    nombre: f.nombre.value.trim(),
    apellido: f.apellido.value.trim(),
    dni: f.dni.value.trim(),
    codArea: f.codArea.value.trim(),
    numCel: f.numCel.value.trim(),
    email: f.email.value.trim(),
    direccion: f.direccion.value.trim(),
    comentarios: f.comentarios.value.trim(),
    lista: new URLSearchParams(location.search).get('l') ?? ''
  };

  document.querySelectorAll('.msg').forEach((m) => (m.textContent = ''));

  const errs = validar(datos);
  if (Object.keys(errs).length) {
    for (const k in errs) document.getElementById('err-' + k).textContent = errs[k];
    return;
  }

  btn.disabled = true;
  spinner.classList.remove('hidden');

  try {
    const token = await grecaptcha.execute(CLAVES_PUBLICAS.RECAPTCHA_SITE_KEY, { action: 'submit' });

    const payload = {
      ...datos,
      telefono: fusionTelefono(datos.codArea, datos.numCel),
      token
    };

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.status === 409) {
      const { campo } = await res.json();
      alert(MENSAJES.DUPLICADO.replace('{campo}', campo));
    } else if (res.ok) {
      alert(MENSAJES.EXITO);
      f.reset();
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

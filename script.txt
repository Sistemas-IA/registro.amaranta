/* ---------- CONFIG  ---------- */
const UI_TEXT = {
  placeholders: {
    nombre      : '👤 Nombre',
    apellido    : '👤 Apellido',
    dni         : '🪪 DNI (sin puntos)',
    codigo      : '📞 Cod. área (sin 0)',
    numero      : '📞 Número de celular (sin 15)',
    email       : '✉ Correo electrónico',
    direccion   : '📍 Dirección para la entrega de tu vianda',
    comentarios : '📝 [OPCIONAL] Comentarios adicionales sobre la dirección de entrega'
  },
  errors: {
    required   : 'Este campo es obligatorio',
    nombre     : 'Solo letras y espacios',
    apellido   : 'Solo letras y espacios',
    dni        : '7‑8 dígitos',
    codigo     : '2‑4 dígitos',
    numero     : '6‑9 dígitos',
    email      : 'Correo inválido',
    direccion  : 'Máx. 100 caracteres',
    comentarios: 'Máx. 250 caracteres'
  },
  serverError : 'No se pudo procesar el registro',
  captchaFail : 'reCAPTCHA falló, recarga la página'
};

const RULES = {
  nombre  : v => /^[A-Za-zÁÉÍÓÚÑáéíóúñ\s]{2,50}$/.test(v),
  apellido: v => /^[A-Za-zÁÉÍÓÚÑáéíóúñ\s]{2,50}$/.test(v),
  dni     : v => /^\d{7,8}$/.test(v),
  codigo  : v => /^\d{2,4}$/.test(v),
  numero  : v => /^\d{6,9}$/.test(v),
  email   : v => v.length <= 100 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  direccion  : v => v.length <= 100,
  comentarios: v => v.length <= 250            // opcional
};

/* ---------- ELEMENTOS ---------- */
const form  = document.getElementById('form');
const modal = document.getElementById('modal');
const mMsg  = document.getElementById('modal-msg');

/* placeholders */
for (const [id, t] of Object.entries(UI_TEXT.placeholders)) {
  const el = document.getElementById(id);
  if (el) el.placeholder = t;
}

/* lista desde ?l= */
document.getElementById('lista').value =
  new URLSearchParams(location.search).get('l') || '';

/* desactiva validación HTML */
form.noValidate = true;

/* ---------- SUBMIT ---------- */
form.addEventListener('submit', async e => {
  e.preventDefault();
  clearErrors();

  if (!validate()) return;

  const btn = document.getElementById('btnEnviar');
  btn.disabled = true;

  try {
    const token = await grecaptcha.execute('6Le2sYMrAAAAABmpey7GOWmQHVua3PxJ5gnHsbGp', { action: 'submit' });
    if (!token) throw new Error(UI_TEXT.captchaFail);

    const payload = Object.fromEntries(new FormData(form).entries());
    payload.recaptchaToken = token;

    const r = await fetch('/api/register', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(payload)
    }).then(r => r.json());

    if (!r.ok) throw new Error(r.error || UI_TEXT.serverError);

    showModal('¡Registro enviado con éxito!');
    form.reset();
  } catch (err) {
    showModal(err.message || UI_TEXT.serverError);
  } finally {
    btn.disabled = false;
  }
});

/* ---------- VALIDACIÓN ---------- */
function validate() {
  let ok = true;
  for (const field of form.elements) {
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) continue;
    if (field.type === 'hidden') continue;

    const id  = field.id;
    const val = field.value.trim();

    if (!val) {
      if (id !== 'comentarios') {       // comentarios opcional
        setErr(field, UI_TEXT.errors.required);
        ok = false;
      }
      continue;
    }
    if (RULES[id] && !RULES[id](val)) {
      setErr(field, UI_TEXT.errors[id]);
      ok = false;
    }
  }
  return ok;
}

function setErr(field, msg) {
  const e = field.nextElementSibling;
  if (e) e.textContent = msg;
  field.classList.add('invalid');
}
function clearErrors() {
  form.querySelectorAll('.error').forEach(el => el.textContent = '');
  form.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
}

/* ---------- MODAL ---------- */
function showModal(msg) {
  mMsg.textContent = msg;
  modal.style.display = 'flex';
  modal.onclick = () => modal.style.display = 'none';
}

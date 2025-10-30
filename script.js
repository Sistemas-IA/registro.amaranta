/* ---------- CONFIG  ---------- */
const UI_TEXT = {
  placeholders: {
    nombre      : '👤 Nombre',
    apellido    : '👤 Apellido',
    dni         : '🪪 DNI (sin puntos)',
    telefono    : '📞 Teléfono (10 dígitos, sin 0/54)',
    email       : '✉ Correo electrónico',
    direccion   : '📍 Dirección para la entrega de tu vianda',
    comentarios : '📝 [OPCIONAL] Comentarios adicionales sobre la dirección de entrega'
  },
  errors: {
    required   : 'Este campo es obligatorio',
    nombre     : 'Solo letras y espacios',
    apellido   : 'Solo letras y espacios',
    dni        : 'DNI inválido',
    telefono   : 'Teléfono inválido',
    email      : 'Correo inválido',
    direccion  : '3–100 caracteres',
    comentarios: 'Máx. 250 caracteres'
  },
  serverError : 'No se pudo procesar el registro',
  captchaFail : 'reCAPTCHA falló, recarga la página'
};

const RULES = {
  nombre     : v => /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]{2,50}$/.test((v||'').trim()),
  apellido   : v => /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]{2,50}$/.test((v||'').trim()),
  dni        : v => {
    const s = (v||'').trim();
    if (!/^\d{7,8}$/.test(s)) return false;
    if (/^0/.test(s)) return false;
    if (/^(\d)\1{6,7}$/.test(s)) return false;
    if (s === '12345678' || s === '87654321') return false;
    return true;
  },
  telefono   : v => {
    const s = (v||'').trim();
    if (!/^\d{10}$/.test(s)) return false;
    if (!(s.startsWith('11') || /^[23]/.test(s))) return false;
    if (/^(\d)\1{9}$/.test(s)) return false;
    if (s === '0123456789' || s === '1234567890' || s === '9876543210') return false;
    return true;
  },
  email      : v => {
    const s = (v||'').trim();
    return s.length <= 100 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  },
  direccion  : v => {
    const s = (v||'').trim();
    return s.length >= 3 && s.length <= 100;
  },
  comentarios: v => ((v||'').trim()).length <= 250,
  lista      : v => {
    const s = ((v ?? '') + '').trim();
    if (s === '') return true;
    const n = Number(s);
    return Number.isInteger(n) && n >= 1 && n <= 50;
  }
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

/* ----------  CONFIGURACIÓN CENTRALIZADA  ---------- */
const UI_TEXT = {
  placeholders: {
    nombre      : 'Nombre',
    apellido    : 'Apellido',
    dni         : 'DNI (sin puntos)',
    codigo      : 'Cod. área',
    numero      : 'Teléfono',
    email       : 'Correo electrónico',
    direccion   : 'Dirección',
    comentarios : 'Comentarios'
  },
  errors: {
    required   : 'Este campo es obligatorio',
    nombre     : 'Solo letras y espacios',
    apellido   : 'Solo letras y espacios',
    dni        : 'Debe tener 7‑8 dígitos',
    codigo     : 'Solo números (2‑4 dígitos)',
    numero     : 'Solo números (6‑9 dígitos)',
    email      : 'Formato de correo inválido'
  },
  recaptchaError : 'reCAPTCHA falló, recarga la página',
  serverError    : 'No se pudo procesar el registro'
};

/* ----------  VALIDACIONES  ---------- */
const RULES = {
  nombre  : v => /^[A-Za-zÁÉÍÓÚÑáéíóúñ\s]{2,50}$/.test(v),
  apellido: v => /^[A-Za-zÁÉÍÓÚÑáéíóúñ\s]{2,50}$/.test(v),
  dni     : v => /^\d{7,8}$/.test(v),
  codigo  : v => /^\d{2,4}$/.test(v),
  numero  : v => /^\d{6,9}$/.test(v),
  email   : v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
};

/* ----------  INICIALIZACIÓN  ---------- */
const form    = document.getElementById('form-registro');
const success = document.getElementById('success');

/* 1) Placeholder en cada input */
for (const [id, text] of Object.entries(UI_TEXT.placeholders)) {
  const el = document.getElementById(id);
  if (el) el.placeholder = text;
}

/* 2) Rellenar campo oculto "lista" desde la URL ?l= */
const params     = new URLSearchParams(window.location.search);
const listaParam = params.get('l') || '';
document.getElementById('lista').value = listaParam;

/* 3) Envío del formulario */
form.addEventListener('submit', async e => {
  e.preventDefault();
  clearErrors();
  success.style.display = 'none';

  // Cliente validations
  let valid = true;
  for (const field of form.elements) {
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) continue;
    if (field.type === 'hidden') continue;       // omite lista oculta

    const id  = field.id;
    const val = field.value.trim();

    // requerido
    if (field.required && !val) {
      setError(field, UI_TEXT.errors.required);
      valid = false;
      continue;
    }
    // regla específica
    if (RULES[id] && val && !RULES[id](val)) {
      setError(field, UI_TEXT.errors[id]);
      valid = false;
    }
  }
  if (!valid) return;

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;

  try {
    // token reCAPTCHA
    const token = await grecaptcha.execute('YOUR_SITE_KEY', { action:'submit' });
    if (!token) throw new Error(UI_TEXT.recaptchaError);

    const payload = Object.fromEntries(new FormData(form).entries());
    payload.recaptchaToken = token;

    const res = await fetch('/api/register', {
      method : 'POST',
      headers: { 'Content-Type':'application/json' },
      body   : JSON.stringify(payload)
    }).then(r => r.json());

    if (!res.ok) throw new Error(res.error || UI_TEXT.serverError);

    form.reset();
    success.style.display = 'block';
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
  }
});

/* ----------  helpers  ---------- */
function setError(field, message) {
  const errEl = field.nextElementSibling;
  if (errEl) errEl.textContent = message;
  field.classList.add('invalid');
}

function clearErrors() {
  form.querySelectorAll('.error').forEach(el => (el.textContent = ''));
  form.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
}

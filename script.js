/* ----------  CONFIGURACIÓN CENTRALIZADA  ---------- */
const UI_TEXT = {
  placeholders: {
    nombre      : 'Ej.: Juan',
    apellido    : 'Ej.: Pérez',
    dni         : 'Sin puntos, solo números',
    codigo      : 'Ej.: 11',
    numero      : 'Ej.: 12345678',
    email       : 'ejemplo@correo.com',
    direccion   : 'Calle y número',
    comentarios : 'Escribe tus notas'
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

/* ----------  EXPRESSIONS DE VALIDACIÓN  ---------- */
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

/* 1) Coloca placeholders automáticamente */
for (const [id, text] of Object.entries(UI_TEXT.placeholders)) {
  const el = document.getElementById(id);
  if (el) el.placeholder = text;
}

/* 2) Manejador de envío */
form.addEventListener('submit', async e => {
  e.preventDefault();
  clearErrors();
  success.style.display = 'none';

  // 2.1) Validaciones cliente
  let valid = true;
  for (const field of form.elements) {
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement))
      continue;

    const id   = field.id;
    const val  = field.value.trim();

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

  // 2.2) Disable botón mientras enviamos
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;

  try {
    // 2.3) reCAPTCHA v3 token
    const token = await grecaptcha.execute('YOUR_SITE_KEY', { action:'submit' });
    if (!token) throw new Error(UI_TEXT.recaptchaError);

    // 2.4) Construir payload
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.recaptchaToken = token;

    // 2.5) Enviar al API
    const res = await fetch('/api/register', {
      method : 'POST',
      headers: { 'Content-Type':'application/json' },
      body   : JSON.stringify(payload)
    }).then(r => r.json());

    if (!res.ok) throw new Error(res.error || UI_TEXT.serverError);

    // 2.6) OK!
    form.reset();
    success.style.display = 'block';
  } catch (err) {
    alert(err.message);         // último recurso; no bloquea la UI
  } finally {
    btn.disabled = false;
  }
});

/* ----------  helpers de UI  ---------- */
function setError(field, message) {
  const errorEl = field.nextElementSibling;
  if (errorEl) errorEl.textContent = message;
  field.classList.add('invalid');
}

function clearErrors() {
  form.querySelectorAll('.error').forEach(el => (el.textContent = ''));
  form.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
}

/* ---------- CONFIG  ---------- */
const UI_TEXT = {
  placeholders: {
    nombre: "👤 Nombre",
    apellido: "👤 Apellido",
    dni: "🪪 DNI (sin puntos)",
    codigo: "📞 Cod. área (sin 0)",
    numero: "📞 Número de celular (sin 15)",
    email: "📧 Correo electrónico",
    direccion: "📍 Dirección para la entrega de tu vianda",
    comentarios: "✏️ [OPCIONAL] Comentarios adicionales sobre la dirección de entrega",
  },
  errors: {
    required: "Este campo es obligatorio",
    nombre: "Solo letras y espacios",
    apellido: "Solo letras y espacios",
    dni: "7-8 dígitos (sin 0 inicial)",
    codigo: "2-4 dígitos",
    numero: "6-9 dígitos",
    email: "Correo inválido",
    direccion: "Máx. 100 caracteres",
    comentarios: "Máx. 250 caracteres",
  },
  serverError: "No se pudo procesar el registro",
  captchaFail: "reCAPTCHA falló, recargá la página",
};

const RULES = {
  nombre: (v) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ\s]{2,50}$/.test(v),
  apellido: (v) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ\s]{2,50}$/.test(v),
  dni: (v) => /^[1-9]\d{6,7}$/.test(v),
  codigo: (v) => /^\d{2,4}$/.test(v),
  numero: (v) => /^\d{6,9}$/.test(v),
  email: (v) => v.length <= 100 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  direccion: (v) => v.length > 0 && v.length <= 100,
  comentarios: (v) => v.length <= 250, // opcional
};

/* ---------- ELEMENTOS ---------- */
const form = document.getElementById("form");

// Modal nuevo
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modal-title");
const modalClave = document.getElementById("modal-clave");
const modalSave = document.getElementById("modal-save");
const modalX = document.getElementById("modal-x");

let lastClave = "";

/* placeholders */
for (const [id, t] of Object.entries(UI_TEXT.placeholders)) {
  const el = document.getElementById(id);
  if (el) el.placeholder = t;
}

/* lista desde ?l= (campo reservado) */
document.getElementById("lista").value =
  new URLSearchParams(location.search).get("l") || "";

/* desactiva validación HTML */
form.noValidate = true;

/* ---------- SUBMIT ---------- */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrors();

  if (!validate()) return;

  const btn = document.getElementById("btnEnviar");
  btn.disabled = true;

  try {
    const token = await grecaptcha.execute(
      "6Le2sYMrAAAAABmpey7GOWmQHVua3PxJ5gnHsbGp",
      { action: "submit" }
    );
    if (!token) throw new Error(UI_TEXT.captchaFail);

    const payload = Object.fromEntries(new FormData(form).entries());
    payload.recaptchaToken = token;

    const resp = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await resp.json().catch(() => ({}));

    if (!data.ok) throw new Error(data.error || UI_TEXT.serverError);

    // OK
    lastClave = String(data.clave || "").trim();
    showSuccessModal(lastClave);

    form.reset();
    // volver a poner lista desde URL (si había)
    document.getElementById("lista").value =
      new URLSearchParams(location.search).get("l") || "";
  } catch (err) {
    showErrorModal(err.message || UI_TEXT.serverError);
  } finally {
    btn.disabled = false;
  }
});

/* ---------- VALIDACIÓN ---------- */
function validate() {
  let ok = true;

  for (const field of form.elements) {
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement))
      continue;

    // No validamos hidden, ni honeypot
    if (field.type === "hidden") continue;
    if (field.id === "website") continue;

    const id = field.id;
    const val = field.value.trim();

    if (!val) {
      // comentarios opcional
      if (id !== "comentarios") {
        setErr(field, UI_TEXT.errors.required);
        ok = false;
      }
      continue;
    }

    if (RULES[id] && !RULES[id](val)) {
      setErr(field, UI_TEXT.errors[id] || UI_TEXT.errors.required);
      ok = false;
    }
  }

  return ok;
}

function setErr(field, msg) {
  const e = field.nextElementSibling;
  if (e) e.textContent = msg;
  field.classList.add("invalid");
}

function clearErrors() {
  form.querySelectorAll(".error").forEach((el) => (el.textContent = ""));
  form.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));
}

/* ---------- MODAL ---------- */
function showSuccessModal(clave) {
  modalTitle.textContent = "¡Registro enviado!";
  modalClave.textContent = clave || "—";
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
}

function showErrorModal(msg) {
  modalTitle.textContent = msg || UI_TEXT.serverError;
  modalClave.textContent = "";
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
  lastClave = "";
}

/* X con fricción mínima:
   - intenta copiar la clave (si existe)
   - cierra
*/
modalX.addEventListener("click", async () => {
  if (lastClave) {
    await tryCopy(lastClave);
  }
  closeModal();
});

/* Botón único: Guardar clave y cerrar
   - copia a portapapeles (best effort)
   - descarga una imagen simple con la clave
   - cierra
*/
modalSave.addEventListener("click", async () => {
  const clave = lastClave || "";
  if (clave) {
    await tryCopy(clave);
    downloadClaveImage(clave);
  }
  closeModal();
});

// clic fuera del card también cierra (y copia best-effort si hay clave)
modal.addEventListener("click", async (e) => {
  if (e.target === modal) {
    if (lastClave) await tryCopy(lastClave);
    closeModal();
  }
});

async function tryCopy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* Genera un PNG liviano con Canvas (sin libs)
   Nota: en iPhone descarga a "Archivos".
*/
function downloadClaveImage(clave) {
  const w = 1080;
  const h = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Fondo claro
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  // Marco suave
  ctx.strokeStyle = "rgba(63,116,95,.25)";
  ctx.lineWidth = 12;
  ctx.strokeRect(60, 60, w - 120, h - 120);

  // Título
  ctx.fillStyle = "#2d5246";
  ctx.font = "700 64px Poppins, system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("AMARANTA", 120, 220);

  // Subtítulo
  ctx.fillStyle = "#1e2a26";
  ctx.font = "500 42px Poppins, system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("Tu clave de acceso", 120, 310);

  // Caja clave
  ctx.fillStyle = "rgba(63,116,95,.08)";
  roundRect(ctx, 120, 420, w - 240, 220, 28);
  ctx.fill();

  ctx.fillStyle = "#1e2a26";
  ctx.font = "800 140px Poppins, system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(clave, w / 2, 530);

  // Nota
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#3f745f";
  ctx.font = "500 40px Poppins, system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("Guardala: la vas a usar junto con tu DNI.", 120, 760);

  // Descargar
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = `amaranta-clave-${clave}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

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
    dni: "7-8 dígitos",
    codigo: "2-4 dígitos",
    numero: "6-9 dígitos",
    email: "Correo inválido",
    direccion: "Máx. 100 caracteres",
    comentarios: "Máx. 250 caracteres",
  },
  serverError: "No se pudo procesar el registro",
  captchaFail: "reCAPTCHA falló, recarga la página",
};

const RULES = {
  nombre: (v) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ\s]{2,50}$/.test(v),
  apellido: (v) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ\s]{2,50}$/.test(v),
  dni: (v) => /^\d{7,8}$/.test(v),
  codigo: (v) => /^\d{2,4}$/.test(v),
  numero: (v) => /^\d{6,9}$/.test(v),
  email: (v) => v.length <= 100 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  direccion: (v) => v.length <= 100 && v.length > 0,
  comentarios: (v) => v.length <= 250,
};

/* ---------- ELEMENTOS ---------- */
const form = document.getElementById("form");
const modal = document.getElementById("modal");
const modalBox = document.getElementById("modal-box");
const modalTitle = document.getElementById("modal-title");
const modalMsg = document.getElementById("modal-msg");
const modalClave = document.getElementById("modal-clave");
const modalAction = document.getElementById("modal-action");
const modalX = document.getElementById("modal-x");

/* placeholders */
for (const [id, t] of Object.entries(UI_TEXT.placeholders)) {
  const el = document.getElementById(id);
  if (el) el.placeholder = t;
}

/* lista desde ?l= */
function setListaFromQuery() {
  const el = document.getElementById("lista");
  if (!el) return;
  el.value = new URLSearchParams(location.search).get("l") || "";
}
setListaFromQuery();

/* desactiva validación HTML */
form.noValidate = true;

/* ---------- MODAL STATE ---------- */
let lastClave = "";
let modalMode = "none"; // "success" | "error"
let closeArmedUntil = 0;

function openSuccessModal(clave) {
  modalMode = "success";
  lastClave = String(clave || "").trim();

  modalTitle.textContent = "¡Registro enviado!";
  modalMsg.textContent = "Guardá tu clave de acceso:";
  modalClave.textContent = lastClave || "";
  modalAction.textContent = "Guardar clave y cerrar";

  closeArmedUntil = 0;
  modal.style.display = "flex";
}

function openErrorModal(message) {
  modalMode = "error";
  lastClave = "";

  modalTitle.textContent = "No se pudo registrar";
  modalMsg.textContent = message || UI_TEXT.serverError;
  modalClave.textContent = "";
  modalAction.textContent = "Cerrar";

  closeArmedUntil = 0;
  modal.style.display = "flex";
}

function closeModal() {
  modal.style.display = "none";
  modalMode = "none";
  lastClave = "";
  closeArmedUntil = 0;
}

/* No cerrar tocando afuera (evita cierres accidentales) */
modal.addEventListener("click", (e) => {
  // click en fondo -> ignorar
  if (e.target === modal) return;
});
modalBox.addEventListener("click", (e) => e.stopPropagation());

/* X: mínima fricción (doble toque) */
modalX.addEventListener("click", () => {
  if (modalMode !== "success") return closeModal();

  const now = Date.now();
  if (now < closeArmedUntil) {
    // Segundo toque dentro de la ventana -> cerrar
    return closeModal();
  }

  // Primer toque -> avisar y armar ventana
  closeArmedUntil = now + 2500; // 2.5s
  modalMsg.textContent = "Antes de cerrar, guardá tu clave. Tocá ✕ otra vez para cerrar igual.";
  setTimeout(() => {
    // volver al texto normal si sigue abierto y no cerró
    if (modal.style.display === "flex" && modalMode === "success") {
      modalMsg.textContent = "Guardá tu clave de acceso:";
    }
  }, 2600);
});

/* Botón principal */
modalAction.addEventListener("click", async () => {
  if (modalMode !== "success") {
    closeModal();
    return;
  }

  const clave = lastClave;
  const textToSave = `Clave de acceso Amaranta: ${clave}`;

  // 1) Intentar compartir en celular
  try {
    if (navigator.share) {
      await navigator.share({
        title: "Amaranta",
        text: textToSave,
      });
      // si compartió, cerramos y listo
      closeModal();
      return;
    }
  } catch (_) {
    // si canceló o falló, caemos al copy
  }

  // 2) Fallback: copiar
  try {
    await navigator.clipboard.writeText(textToSave);
    modalMsg.textContent = "Copiada ✅ (pegala en Notas/WhatsApp)";
    setTimeout(() => closeModal(), 700);
  } catch (_) {
    modalMsg.textContent = "No se pudo copiar. Hacé una captura de pantalla y cerrá con ✕.";
  }
});

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

    const r = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => r.json());

    if (!r.ok) throw new Error(r.error || UI_TEXT.serverError);

    // limpiar form (y volver a setear lista desde URL)
    form.reset();
    setListaFromQuery();
    clearErrors();

    openSuccessModal(r.clave || "");
  } catch (err) {
    openErrorModal(err.message || UI_TEXT.serverError);
  } finally {
    btn.disabled = false;
  }
});

/* ---------- VALIDACIÓN ---------- */
function validate() {
  let ok = true;
  for (const field of form.elements) {
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) continue;
    if (field.type === "hidden") continue;

    const id = field.id;
    const val = field.value.trim();

    if (!val) {
      if (id !== "comentarios") {
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
  field.classList.add("invalid");
}
function clearErrors() {
  form.querySelectorAll(".error").forEach((el) => (el.textContent = ""));
  form.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));
}

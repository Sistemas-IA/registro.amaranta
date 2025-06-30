document.getElementById('registrationForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  let hasError = false;

  function showError(id, message) {
    document.getElementById(id).textContent = message;
    hasError = true;
  }

  document.querySelectorAll('.error-msg').forEach(e => e.textContent = "");

  const nombre = document.getElementById("nombre").value.trim();
  const apellido = document.getElementById("apellido").value.trim();
  const dni = document.getElementById("dni").value.trim();
  const codArea = document.getElementById("codArea").value.trim();
  const telefono = document.getElementById("telefono").value.trim();
  const email = document.getElementById("email").value.trim();
  const direccion = document.getElementById("direccion").value.trim();
  const comentarios = document.getElementById("comentarios").value.trim();

  const params = new URLSearchParams(window.location.search);
  const lista = params.get("l") || "";

  // Validaciones
  if (!/^[0-9]{8}$/.test(dni)) showError("error-dni", "El DNI debe tener exactamente 8 dígitos.");
  if (nombre.length < 2 || nombre.length > 40) showError("error-nombre", "Nombre inválido.");
  if (apellido.length < 2 || apellido.length > 40) showError("error-apellido", "Apellido inválido.");
  if (!/^[0-9]{2,4}$/.test(codArea)) showError("error-telefono", "Código de área inválido.");
  else if (!/^[0-9]{6,8}$/.test(telefono)) showError("error-telefono", "Número telefónico inválido.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) showError("error-email", "Email inválido.");
  if (direccion.length < 3 || direccion.length > 120) showError("error-direccion", "Dirección inválida.");
  if (lista.length === 0 || lista.length > 5) {
    mostrarModal("El link de acceso no es válido o ha expirado.");
    return;
  }

  if (hasError) return;

  const payload = {
    nombre,
    apellido,
    dni,
    codArea,
    telefono,
    email,
    direccion,
    comentarios,
    lista,
    ip: await obtenerIP()
  };

  mostrarSpinner();

  try {
    const response = await fetch("/api/registrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    mostrarModal(result.message);
    if (result.success) document.getElementById("registrationForm").reset();
  } catch (err) {
    mostrarModal("No se pudo enviar el formulario. Intentalo nuevamente.");
  } finally {
    ocultarSpinner();
  }
});

function mostrarSpinner() {
  document.getElementById("spinner").classList.add("active");
  document.getElementById("submitBtn").disabled = true;
}

function ocultarSpinner() {
  document.getElementById("spinner").classList.remove("active");
  document.getElementById("submitBtn").disabled = false;
}

function mostrarModal(msg) {
  document.getElementById("modal-message").textContent = msg;
  const modal = document.getElementById("modal");
  modal.classList.remove("hidden");
  modal.classList.add("active");
}

function closeModal() {
  const modal = document.getElementById("modal");
  modal.classList.add("hidden");
  modal.classList.remove("active");
}

async function obtenerIP() {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    return data.ip;
  } catch {
    return "IP no detectada";
  }
}

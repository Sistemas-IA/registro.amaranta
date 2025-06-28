const URL_BACKEND = "https://script.google.com/macros/s/AKfycbxeihypxexCu1lPpsl2EN9_Zi3Gv9a1YtufuTeCdhLhi9DISqZcCy7QIGamvRbAHZCLGw/exec";
const MENSAJE_EXITO = "¡Gracias por registrarte!";
const MENSAJE_ERROR = "Ocurrió un error inesperado. Intentá de nuevo.";
const LIMITE_COMENTARIOS = 200;

// const API_TOKEN = "abc123";  // Futuro uso

document.getElementById('registroForm').addEventListener('submit', async function (e) {
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
  const telefono = document.getElementById("telefono").value.trim();
  const email = document.getElementById("email").value.trim();
  const direccion = document.getElementById("direccion").value.trim();
  const comentarios = document.getElementById("comentarios").value.trim();
  const lista = new URLSearchParams(window.location.search).get("lista") || "no definida";

  if (nombre.length < 2 || nombre.length > 40) showError("error-nombre", "Nombre inválido.");
  if (apellido.length < 2 || apellido.length > 40) showError("error-apellido", "Apellido inválido.");
  if (!/^[0-9]{7,9}$/.test(dni)) showError("error-dni", "DNI inválido.");
  if (!/^[0-9]{10,15}$/.test(telefono)) showError("error-telefono", "Teléfono inválido.");
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 60) showError("error-email", "Email inválido.");
  if (direccion.length < 3 || direccion.length > 80) showError("error-direccion", "Dirección inválida.");
  if (comentarios.length > LIMITE_COMENTARIOS) showError("error-comentarios", "Máximo 200 caracteres.");

  if (hasError) return;

  const payload = {
    nombre,
    apellido,
    dni,
    telefono,
    email,
    direccion,
    comentarios,
    zona: "Pendiente",
    lista,
    estado: "a revisar"
  };

  try {
    const res = await fetch(URL_BACKEND, {
      method: "POST",
      body: JSON.stringify(payload),
      // headers: { "x-api-key": API_TOKEN } // si se activa token
    });

    const result = await res.json();

    if (result.success) {
      document.getElementById("registroForm").style.display = "none";
      const successBox = document.getElementById("mensajeExito");
      successBox.querySelector("p").textContent = MENSAJE_EXITO;
      successBox.style.display = "block";
    } else {
      alert(result.message || MENSAJE_ERROR);
    }

  } catch (err) {
    alert(MENSAJE_ERROR);
  }
});

function closeModal() {
  document.getElementById("mensajeExito").style.display = "none";
  document.getElementById("registroForm").reset();
}
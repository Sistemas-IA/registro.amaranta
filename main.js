
document.getElementById('registrationForm').addEventListener('submit', function(e) {
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

  if (nombre.length < 2) showError("error-nombre", "Nombre inválido.");
  if (apellido.length < 2) showError("error-apellido", "Apellido inválido.");
  if (!/^[0-9]{7,9}$/.test(dni)) showError("error-dni", "DNI inválido.");
  if (!/^[0-9]{2,5}$/.test(codArea)) showError("error-celular", "Código de área inválido.");
  else if (!/^[0-9]{6,10}$/.test(telefono)) showError("error-celular", "Número celular inválido.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) showError("error-email", "Email inválido.");
  if (direccion.length < 3) showError("error-direccion", "Dirección inválida.");

  if (!hasError) {
    document.getElementById("modal").classList.remove("hidden");
  }
});

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
  document.getElementById("registrationForm").reset();
}

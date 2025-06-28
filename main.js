
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  document.getElementById('l').value = params.get('l') || 'no definida';

  const form = document.getElementById('registrationForm');
  const modal = document.getElementById('modal');

  function showError(id, msg) {
    document.getElementById(id).textContent = msg;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    document.querySelectorAll('.error-msg').forEach(el => el.textContent = '');

    const nombre = document.getElementById("nombre").value.trim();
    const apellido = document.getElementById("apellido").value.trim();
    const dni = document.getElementById("dni").value.trim();
    const codArea = document.getElementById("codArea").value.trim();
    const telefono = document.getElementById("telefono").value.trim();
    const email = document.getElementById("email").value.trim();
    const direccion = document.getElementById("direccion").value.trim();
    const comentarios = document.getElementById("comentarios").value.trim();
    const lista = document.getElementById("l").value;

    let hasError = false;

    if (nombre.length < 2 || nombre.length > 40) showError("error-nombre", "Nombre inválido"), hasError = true;
    if (apellido.length < 2 || apellido.length > 40) showError("error-apellido", "Apellido inválido"), hasError = true;
    if (!/^[0-9]{7,9}$/.test(dni)) showError("error-dni", "DNI inválido"), hasError = true;
    if (!/^[0-9]{2,5}$/.test(codArea) || !/^[0-9]{6,10}$/.test(telefono)) showError("error-celular", "Teléfono inválido"), hasError = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 60) showError("error-email", "Email inválido"), hasError = true;
    if (direccion.length < 3 || direccion.length > 80) showError("error-direccion", "Dirección inválida"), hasError = true;

    if (hasError) return;

    const payload = {
      nombre,
      apellido,
      dni,
      telefono: `549${codArea}${telefono}`,
      email,
      direccion,
      comentarios,
      zona: "Pendiente",
      lista,
      estado: "a revisar",
      ip: await (await fetch("https://api64.ipify.org?format=json")).json().then(res => res.ip).catch(() => "")
    };

    try {
      const res = await fetch("https://script.google.com/macros/s/AKfycbyiKb7h2EmZm7d64zmbLWbaiKy5qXHEfJjGNIQcN9lafpNTuMe8e4amTZo9uCaARqdmlQ/exec", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success) modal.classList.remove("hidden");
      else alert(result.message || "Error");
    } catch {
      alert("Error de conexión");
    }
  });
});

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
  document.getElementById("registrationForm").reset();
}

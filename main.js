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
  const lista = params.get("l") || "no definida";

  if (!/^[0-9]{8}$/.test(dni)) showError("error-dni", "El DNI debe tener exactamente 8 dígitos.");
  if (nombre.length < 2) showError("error-nombre", "Nombre inválido.");
  if (apellido.length < 2) showError("error-apellido", "Apellido inválido.");
  if (!/^[0-9]{2,5}$/.test(codArea)) showError("error-celular", "Código de área inválido.");
  else if (!/^[0-9]{6,10}$/.test(telefono)) showError("error-celular", "Número celular inválido.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) showError("error-email", "Email inválido.");
  if (direccion.length < 3) showError("error-direccion", "Dirección inválida.");

  if (!hasError) {
    const fullTelefono = `549${codArea}${telefono}`;

    // Activar loader y overlay
    document.getElementById("submit-button").disabled = true;
    document.getElementById("loader").classList.remove("hidden");
    document.getElementById("overlay").classList.remove("hidden");

    try {
      const ipRes = await fetch("https://api.ipify.org?format=json");
      const ipData = await ipRes.json();
      const ip = ipData.ip;

      const payload = {
        nombre, apellido, dni,
        telefono: fullTelefono,
        email, direccion, comentarios,
        l: lista,
        ip
      };

      const res = await fetch("/api/registrar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      // Ocultar loader y overlay
      document.getElementById("submit-button").disabled = false;
      document.getElementById("loader").classList.add("hidden");
      document.getElementById("overlay").classList.add("hidden");

      if (result.success) {
        document.getElementById("registrationForm").reset(); // ✅ solo si fue exitoso
        document.getElementById("modal-text").textContent = result.message || "¡Registro exitoso!";
        document.getElementById("form-wrapper").classList.add("blur");
        document.getElementById("modal").classList.remove("hidden");
      } else {
        document.getElementById("modal-text").textContent = result.message || "Error al registrar.";
        document.getElementById("form-wrapper").classList.add("blur");
        document.getElementById("modal").classList.remove("hidden");
      }
    } catch (err) {
      document.getElementById("submit-button").disabled = false;
      document.getElementById("loader").classList.add("hidden");
      document.getElementById("overlay").classList.add("hidden");

      document.getElementById("modal-text").textContent = "Error de conexión.";
      document.getElementById("form-wrapper").classList.add("blur");
      document.getElementById("modal").classList.remove("hidden");
    }
  }
});

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
  document.getElementById("form-wrapper").classList.remove("blur");
}

// Validaciones para campos
function contieneCaracteresInvalidos(texto) {
  const regex = /[=+<>\[\]{}$%#@^&*()_\\|~`]/;
  return regex.test(texto);
}

function contieneEmoji(texto) {
  return /[\u{1F600}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(texto);
}

function contieneSoloLetras(texto) {
  return /^[A-Za-zÁÉÍÓÚáéíóúÑñ ]+$/.test(texto);
}

function mostrarModalError(mensaje) {
  const modal = document.getElementById('modal-alerta');
  const contenido = document.getElementById('modal-mensaje');
  contenido.textContent = mensaje;
  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 4000);
}

// Asignar validaciones en tiempo real
document.addEventListener("DOMContentLoaded", function () {
  const camposLetras = [document.getElementById("nombre"), document.getElementById("apellido")];
  const camposTexto = [document.getElementById("direccion"), document.getElementById("comentarios")];

  camposLetras.forEach(campo => {
    campo.addEventListener("input", () => {
      if (!contieneSoloLetras(campo.value)) {
        mostrarModalError("Solo se permiten letras y espacios en este campo.");
        campo.value = campo.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ ]/g, "");
      }
    });
  });

  camposTexto.forEach(campo => {
    campo.addEventListener("input", () => {
      if (contieneCaracteresInvalidos(campo.value) || contieneEmoji(campo.value)) {
        mostrarModalError("No se permiten caracteres especiales ni emojis.");
        campo.value = campo.value.replace(/[=+<>\[\]{}$%#@^&*()_\\|~`]/g, "");
      }
    });
  });
});
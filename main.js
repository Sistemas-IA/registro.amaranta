
// === CONFIGURACIÓN GLOBAL ===
const CONFIG = {
  CLAVE_RECAPTCHA: "6LdNAXUrAAAAAIz5Vi5nLnkSHF-fjoTXPSKa2x6y",
  RECAPTCHA_ACTION: "submit",
  TIEMPO_MIN_MS: 2000,
  MOUSE_REQUERIDO: true,
  URL_API: "/api/registrar",
  DEBUG: false
};

let usuarioActivo = false;
let tiempoInicio = Date.now();

document.addEventListener("mousemove", () => usuarioActivo = true);
document.addEventListener("touchstart", () => usuarioActivo = true);



const form = document.getElementById("registrationForm");
const boton = form.querySelector('button[type="submit"]');
const modal = document.getElementById("modalExito");

// Capturar parámetro 'l' de la URL y asignar a campo oculto 'lista'
const urlParams = new URLSearchParams(window.location.search);
const listaParam = urlParams.get('l') || '';
document.getElementById("lista").value = listaParam;

// Validaciones espejo
function validarCampo(nombre, valor) {
  valor = valor.trim();
  switch (nombre) {
    case "nombre":
    case "apellido":
      return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]{2,30}$/.test(valor);
    case "dni":
      return /^\d{8}$/.test(valor);
    case "codArea":
      return /^\d{2,4}$/.test(valor);
    case "telefono":
      return /^\d{7,9}$/.test(valor);
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
    case "direccion":
      return valor.length >= 3 && valor.length <= 100;
    case "comentarios":
      return valor.length <= 300;
    default:
      return true;
  }
}

function sanitizar(valor) {
  return valor.toString().trim()
    .replace(/^=/, "'=")
    .replace(/[;"\\]/g, '')
    .replace(/\s{2,}/g, ' ');
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  boton.disabled = true;
  boton.textContent = "Enviando...";

  const datos = {};
  let valido = true;

  ["nombre", "apellido", "dni", "codArea", "telefono", "email", "direccion", "comentarios"].forEach((campo) => {
    const el = document.getElementById(campo);
    const valor = sanitizar(el.value);
    if (!validarCampo(campo, valor)) {
      document.getElementById("error-" + campo).textContent = "Dato incorrecto";
      valido = false;
    } else {
      document.getElementById("error-" + campo).textContent = "";
    }
    datos[campo] = valor;
  });

  // Validar y combinar teléfono
  if (validarCampo("codArea", datos.codArea) && validarCampo("telefono", datos.telefono)) {
    datos.telefono = "549" + datos.codArea + datos.telefono;
  } else {
    document.getElementById("error-telefono").textContent = "Dato incorrecto";
    valido = false;
  }

  // Validar honeypots (deben estar vacíos)
  if (document.getElementById("zona").value || document.getElementById("estado").value) {
    alert("Solicitud inválida.");
    return;
  }

  // Agregar honeypots y lista
  datos.zona = "";
  datos.estado = "";
  datos.lista = document.getElementById("lista").value;

  if (!valido) {
    boton.disabled = false;
    boton.textContent = "Registrarse";
    return;
  }

  try {
    const res = await grecaptcha.ready(async () => {
    const tokenRecaptcha = await grecaptcha.execute(CONFIG.CLAVE_RECAPTCHA, { action: CONFIG.RECAPTCHA_ACTION });
    const respuesta = await fetch(CONFIG.URL_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...datos, tokenRecaptcha })
    });
    const resultado = await respuesta.json();
    if (CONFIG.DEBUG) console.log("Respuesta del backend:", resultado);
    // Resto del código de respuesta...
});      method: "POST",
      body: JSON.stringify(datos),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const texto = await res.text();
    if (texto.includes("Registrado")) {
      modal.style.display = "flex";
      form.reset();
    } else {
      alert("Error al registrar: " + texto);
    }
  } catch (err) {
    alert("Error de conexión.");
  }

  boton.disabled = false;
  boton.textContent = "Registrarse";
});

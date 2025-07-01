const form = document.getElementById('registrationForm');
const boton = form.querySelector('button[type="submit"]');
const modal = document.getElementById('modalExito');

const campos = {
  nombre: {
    label: 'Nombre',
    validar: valor => valor.trim().length >= 3 && valor.trim().length <= 40,
    mensaje: 'El nombre debe tener entre 3 y 40 caracteres.'
  },
  apellido: {
    label: 'Apellido',
    validar: valor => valor.trim().length >= 3 && valor.trim().length <= 40,
    mensaje: 'El apellido debe tener entre 3 y 40 caracteres.'
  },
  dni: {
    label: 'DNI',
    validar: valor => /^[0-9]{8}$/.test(valor),
    mensaje: 'El DNI debe tener exactamente 8 dígitos numéricos.'
  },
  codArea: {
    label: 'Código de área',
    validar: valor => /^[0-9]{2,4}$/.test(valor),
    mensaje: 'Código de área inválido (debe tener entre 2 y 4 dígitos).'
  },
  telefono: {
    label: 'Teléfono',
    validar: valor => /^[0-9]{8}$/.test(valor),
    mensaje: 'El número de teléfono debe tener exactamente 8 dígitos.'
  },
  email: {
    label: 'Email',
    validar: valor => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor),
    mensaje: 'Email inválido.'
  },
  direccion: {
    label: 'Dirección',
    validar: valor => valor.trim().length >= 3,
    mensaje: 'La dirección debe tener al menos 3 caracteres.'
  },
  comentarios: {
    label: 'Comentarios',
    validar: valor => valor.length <= 200,
    mensaje: 'Los comentarios no pueden superar los 200 caracteres.'
  }
};

function mostrarError(idCampo, mensaje) {
  const errorElement = document.getElementById(`error-${idCampo}`);
  if (errorElement) errorElement.textContent = mensaje;
}

function limpiarErrores() {
  document.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
}

function mostrarModalExito() {
  if (modal) {
    modal.classList.remove("hidden");
    setTimeout(() => {
      modal.classList.add("hidden");
    }, 5000);
  }
}

form.addEventListener('submit', async function (e) {
  e.preventDefault();
  limpiarErrores();

  boton.disabled = true;
  const textoOriginal = boton.textContent;
  boton.textContent = "Enviando...";

  let hasError = false;
  const datos = {};
  for (const id in campos) {
    datos[id] = document.getElementById(id)?.value.trim() || "";
  }

  datos.telefonoCompleto = `+549${datos.codArea}${datos.telefono}`;
  const comentarios = datos.comentarios;

  for (const campo in campos) {
    if (!campos[campo].validar(datos[campo])) {
      mostrarError(campo, campos[campo].mensaje);
      hasError = true;
    }
  }

  if (hasError) {
    boton.disabled = false;
    boton.textContent = textoOriginal;
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const lista = params.get("l") || "no definida";

  // TODO: implementar obtención real de token si se requiere
  const token = "TOKEN_SEGURO_GENERADO";

  const payload = {
    nombre: datos.nombre,
    apellido: datos.apellido,
    dni: datos.dni,
    telefono: datos.telefonoCompleto,
    email: datos.email,
    direccion: datos.direccion,
    comentarios,
    lista,
    honeypot: document.getElementById('extra')?.value || "",
    token
  };

  try {
    const response = await fetch('/api/registrar.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!result.success) {
      alert(result.message || 'Error en el registro.');
    } else {
      mostrarModalExito();
      form.reset();
    }
  } catch (err) {
    console.error('Error al registrar:', err);
    alert('No se pudo conectar al servidor. Revisá tu conexión.');
  } finally {
    boton.disabled = false;
    boton.textContent = textoOriginal;
  }
});
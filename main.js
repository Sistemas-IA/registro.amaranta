window.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const listaParam = urlParams.get("l") || "";

  try {
    const respuesta = await fetch(
      `https://script.google.com/macros/s/AKfycbyfxDdgdOebZKt77ylaYG1CuySomvGTOkEyyy3DEG7sMtM6PBd5Eg2gvpF4GW7kVtIN/exec?l=${encodeURIComponent(listaParam)}`
    );
    const data = await respuesta.json();

    if (data.token && data.lista) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("lista", data.lista);

      // Limpiar ?l=... de la URL sin recargar
      if (window.history.replaceState) {
        const nuevaUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, nuevaUrl);
      }
    } else {
      console.error("No se recibió token o lista válida");
    }
  } catch (error) {
    console.error("Error al obtener token:", error);
  }
});

document.getElementById("formulario").addEventListener("submit", async function (e) {
  e.preventDefault();

  const boton = document.getElementById("botonRegistro");
  boton.disabled = true;
  boton.textContent = "Enviando...";

  // ⚠️ Limpiar errores anteriores
  document.querySelectorAll(".error-mensaje").forEach(el => el.textContent = "");

  const token = localStorage.getItem("token");
  const lista = localStorage.getItem("lista");

  const nombre = document.getElementById("nombre").value.trim();
  const apellido = document.getElementById("apellido").value.trim();
  const dni = document.getElementById("dni").value.trim();
  const codigoArea = document.getElementById("codigoArea").value.trim();
  const numeroCelular = document.getElementById("numeroCelular").value.trim();
  const email = document.getElementById("email").value.trim();
  const direccion = document.getElementById("direccion").value.trim();
  const comentarios = document.getElementById("comentarios").value.trim();
  const zona = document.getElementById("zona").value.trim(); // honeypot
  const estado = document.getElementById("estado").value.trim(); // honeypot

  const errores = [];

  if (nombre.length < 1 || nombre.length > 30) errores.push({ campo: "nombre", mensaje: "Nombre inválido" });
  if (apellido.length < 1 || apellido.length > 30) errores.push({ campo: "apellido", mensaje: "Apellido inválido" });
  if (!/^[0-9]{8}$/.test(dni)) errores.push({ campo: "dni", mensaje: "DNI debe tener 8 dígitos" });
  if (!/^[0-9]{2,4}$/.test(codigoArea)) errores.push({ campo: "codigoArea", mensaje: "Código de área inválido" });
  if (!/^[0-9]{7,9}$/.test(numeroCelular)) errores.push({ campo: "numeroCelular", mensaje: "Número celular inválido" });
  if (!email.includes("@")) errores.push({ campo: "email", mensaje: "Email inválido" });
  if (direccion.length < 3) errores.push({ campo: "direccion", mensaje: "Dirección demasiado corta" });
  if (zona !== "") errores.push({ campo: "zona", mensaje: "Campo inválido" });
  if (estado !== "") errores.push({ campo: "estado", mensaje: "Campo inválido" });
  if (!token) errores.push({ campo: "formulario", mensaje: "Token ausente. Refrescar página." });
  if (!lista) errores.push({ campo: "formulario", mensaje: "Lista no detectada. Refrescar página." });

  // ⚠️ Mostrar errores visualmente
  if (errores.length > 0) {
    errores.forEach(({ campo, mensaje }) => {
      const campoInput = document.getElementById(campo);
      const errorElement = campoInput?.nextElementSibling;
      if (errorElement && errorElement.classList.contains("error-mensaje")) {
        errorElement.textContent = mensaje;
      }
    });

    boton.disabled = false;
    boton.textContent = "Registrarse";
    return;
  }

  const telefono = "549" + codigoArea + numeroCelular;

  const datos = {
    nombre,
    apellido,
    dni,
    telefono,
    email,
    direccion,
    comentarios,
    zona,
    estado,
    lista,
    token
  };

  try {
    const respuesta = await fetch("/api/registrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos)
    });

    const resultado = await respuesta.json();

    if (resultado.success || resultado === "Registrado con éxito") {
      alert("¡Registro exitoso!");
      document.getElementById("formulario").reset();
    } else {
      alert("Error: " + (resultado.message || resultado));
    }

  } catch (error) {
    alert("Error al enviar el formulario.");
    console.error(error);
  }

  boton.disabled = false;
  boton.textContent = "Registrarse";
});

document.getElementById('formulario').addEventListener('submit', async function (e) {
  e.preventDefault();

  const btn = document.getElementById('boton-enviar');
  const spinner = document.getElementById('spinner');
  const mensaje = document.getElementById('mensaje');
  mensaje.innerText = '';

  // 🔐 Sanitizador
  const sanitizar = (input) => String(input).trim().replace(/^[-=+@'"`;]/g, '');

  // 🧾 Obtener campos
  const nombre = sanitizar(document.getElementById('nombre').value);
  const apellido = sanitizar(document.getElementById('apellido').value);
  const dni = sanitizar(document.getElementById('dni').value);
  const telefonoRaw = sanitizar(document.getElementById('telefono').value);
  const email = sanitizar(document.getElementById('email').value);
  const direccion = sanitizar(document.getElementById('direccion').value);
  const comentarios = sanitizar(document.getElementById('comentarios').value);
  const lista = sanitizar(new URLSearchParams(window.location.search).get('l') || '');
  const trampa = document.getElementById('middle_name').value;
  const token = document.getElementById('token').value;

  // 🧪 Validaciones
  const errores = [];

  if (nombre.length < 3 || nombre.length > 30) errores.push("Nombre inválido");
  if (apellido.length < 3 || apellido.length > 30) errores.push("Apellido inválido");
  if (!/^\d{8}$/.test(dni)) errores.push("DNI debe tener exactamente 8 dígitos");
  if (!/^(\d{2,4})(\d{7,9})$/.test(telefonoRaw)) errores.push("Teléfono inválido");
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) errores.push("Email inválido");
  if (direccion.length < 3 || direccion.length > 100) errores.push("Dirección inválida");
  if (comentarios.length > 200) errores.push("Comentarios demasiado largos");
  if (!/^[a-zA-Z0-9_-]{1,5}$/.test(lista)) errores.push("Código de lista inválido");
  if (trampa !== "") errores.push("Error inesperado");
  if (!token) errores.push("Token faltante");

  if (errores.length > 0) {
    mensaje.innerText = errores.join('\n');
    return;
  }

  // 📞 Formatear teléfono
  const partes = telefonoRaw.match(/^(\d{2,4})(\d{7,9})$/);
  const telefono = `+549${partes[1]}${partes[2]}`;

  // ⏳ Spinner ON
  btn.disabled = true;
  spinner.style.display = 'inline-block';

  try {
    const url = new URL('TU_URL_DEL_BACKEND'); // ← Cambiar por URL real
    url.searchParams.set('nombre', nombre);
    url.searchParams.set('apellido', apellido);
    url.searchParams.set('dni', dni);
    url.searchParams.set('telefono', telefono);
    url.searchParams.set('email', email);
    url.searchParams.set('direccion', direccion);
    url.searchParams.set('comentarios', comentarios);
    url.searchParams.set('lista', lista);
    url.searchParams.set('middle_name', trampa);
    url.searchParams.set('token', token);

    const res = await fetch(url, { method: 'GET' });
    const data = await res.json();

    if (data?.ok) {
      // 🎉 Éxito
      document.getElementById('formulario').reset();
      alert("Registro exitoso. Pronto revisaremos tus datos.");
    } else {
      throw new Error(data?.error || "Error desconocido");
    }

  } catch (err) {
    mensaje.innerText = "Error: " + err.message;
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
  }
});

function obtenerDatos() {
  const f = form.elements;
  return {
    Nombre: sanitizar(f.Nombre.value),
    Email:  sanitizar(f.Email.value).toLowerCase(),
    // Apellido eliminado
    Zona:   f.Zona.value,
    Estado: f.Estado.value
  };
}

function validarCliente(d) {
  const errs = [];
  if (!esTextoValido(d.Nombre))  errs.push("Nombre");
  if (!esEmailValido(d.Email))   errs.push("Email");
  // Apellido ya no se valida
  return errs;
}

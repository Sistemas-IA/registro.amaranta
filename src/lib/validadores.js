const soloLetras = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]{2,30}$/u;
const dniReg = /^\d{8}$/;
const codAreaReg = /^\d{2,4}$/;
const numCelReg = /^\d{7,9}$/;
const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const direccionReg = /^.{3,100}$/;
const comentReg = /^.{0,300}$/s;

export function validar(datos) {
  const errs = {};

  if (!soloLetras.test(datos.nombre)) errs.nombre = 'Nombre inválido';
  if (!soloLetras.test(datos.apellido)) errs.apellido = 'Apellido inválido';
  if (!dniReg.test(datos.dni)) errs.dni = 'DNI debe tener 8 dígitos exactos';

  if (!codAreaReg.test(datos.codArea) || !numCelReg.test(datos.numCel))
    errs.telefono = 'Teléfono inválido';

  if (!emailReg.test(datos.email)) errs.email = 'E-mail inválido';
  if (!direccionReg.test(datos.direccion)) errs.direccion = 'Dirección muy corta/larga';
  if (!comentReg.test(datos.comentarios)) errs.comentarios = 'Máx. 300 caracteres';

  return errs;
}

export function fusionTelefono(cod, num) {
  return `549${cod}${num}`;
}

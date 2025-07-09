const soloLetras = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]{2,30}$/u;
const dniReg = /^\d{8}$/;
const codAreaReg = /^\d{2,4}$/;
const numCelReg = /^\d{7,9}$/;
const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const direccionReg = /^.{3,100}$/;
const comentReg = /^.{0,300}$/s;

export function validar(d) {
  const e = {};
  if (!soloLetras.test(d.nombre)) e.nombre = 'Nombre inválido';
  if (!soloLetras.test(d.apellido)) e.apellido = 'Apellido inválido';
  if (!dniReg.test(d.dni)) e.dni = 'DNI inválido';
  if (!codAreaReg.test(d.codArea) || !numCelReg.test(d.numCel)) e.telefono = 'Teléfono inválido';
  if (!emailReg.test(d.email)) e.email = 'Email inválido';
  if (!direccionReg.test(d.direccion)) e.direccion = 'Dirección inválida';
  if (!comentReg.test(d.comentarios)) e.comentarios = 'Comentarios demasiado largos';
  return e;
}

export const fusionTelefono = (cod, num) => `549${cod}${num}`;

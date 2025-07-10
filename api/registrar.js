export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ exito: false, mensaje: "Método no permitido" });
  }

  try {
    const datos = req.body;

    console.log("🟢 Datos recibidos por backend:", datos);

    // Validaciones básicas espejo (simplificadas para debug)
    if (!datos.Nombre || typeof datos.Nombre !== "string") {
      return res.status(400).json({ exito: false, mensaje: "Nombre inválido" });
    }

    if (!datos.DNI || !/^\d{8}$/.test(datos.DNI)) {
      return res.status(400).json({ exito: false, mensaje: "DNI inválido" });
    }

    if (!datos.Direccion || datos.Direccion.length < 3) {
      return res.status(400).json({ exito: false, mensaje: "Dirección inválida" });
    }

    // TODO: Validar reCAPTCHA y continuar si todo es válido
    return res.status(200).json({ exito: true, mensaje: "Simulación exitosa (sin guardar aún)" });
  } catch (error) {
    console.error("❌ Error en registrar.js:", error);
    return res.status(500).json({ exito: false, mensaje: "Error inesperado en backend" });
  }
}

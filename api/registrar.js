
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Método no permitido");
  }

  const datos = req.body;

  // Filtro básico por seguridad
  if (typeof datos !== "object" || !datos.nombre || !datos.dni) {
    return res.status(400).send("Solicitud inválida");
  }

  try {
    const response = await fetch("https://script.google.com/macros/s/AKfycbw9iz_vkca6qT8NzKeHybVM0HvSYjs5B1AmqJpfB3xdciYsghA6yWKPo78MySb0Z6asOA/exec", {
      method: "POST",
      body: JSON.stringify(datos),
      headers: {
        "Content-Type": "application/json"
      }
    });

    const texto = await response.text();
    res.status(200).send(texto);
  } catch (error) {
    res.status(500).send("Error al conectar con el servidor");
  }
}

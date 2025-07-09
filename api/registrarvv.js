
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
    const response = await fetch("https://script.google.com/macros/s/AKfycbyhOmXxYWg8qz1PtZmtzkRtOmA5PdA8cNXGL11b8D8nNw17o746GT4lVDvYgiexy3CDWA/exec", {
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

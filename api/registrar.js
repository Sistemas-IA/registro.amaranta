export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Método no permitido" });
  }

  try {
    const scriptUrl = "https://script.google.com/macros/s/AKfycbzRL0fBBpDv0rvemjI-m88pzHtmJybwiTQma1mIMd-JewjiiY_g6YQykPRcXyhObKiuEA/exec"; // Reemplazar

    const respuesta = await fetch(scriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });

    const resultado = await respuesta.json();
    return res.status(200).json(resultado);

  } catch (error) {
    return res.status(500).json({ success: false, message: "Error en el proxy", error: error.message });
  }
}

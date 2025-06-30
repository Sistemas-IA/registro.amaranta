const GAS_URL = "https://script.google.com/macros/s/AKfycbyDdUNP-mNlz270DS5nwHqhR2BSRpHR4a2stNJ2mN3spHZ05GHco8JjdMFAEnLoe4NP6A/exec";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Método no permitido" });
  }

  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const result = await response.json();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al conectar con el servidor de registros" });
  }
}

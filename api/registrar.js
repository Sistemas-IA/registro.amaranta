
const GAS_URL = "https://script.google.com/macros/s/AKfycbyRXF1Wd_X_gfSzsRLH_yOht0qKWcRhB6XTIe0CCU2yh4kLtYb9cOZfR8Bb0znFqrB9xg/exec";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Método no permitido" });
  }

  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(req.body),
    });

    const result = await response.json();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error al conectar con GAS" });
  }
}

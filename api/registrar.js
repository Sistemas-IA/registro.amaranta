
const GAS_URL = "https://script.google.com/macros/s/AKfycby50ir3nm_EO7G0JyW8Z_o_7wW9dxi-nN8zLC0GIPLEmaqUq5fbJuvDeMEhwbPLIuhRAg/exec";

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

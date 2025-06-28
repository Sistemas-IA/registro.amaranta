
const GAS_URL = "https://script.google.com/macros/s/AKfycbzLALjHRxSx-8YG9XM8uIBZkCOSeESZSxZ5AAjb1oAN_4Ji_o7KAXnu9EtSxh2uA2Fc9Q/exec";

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

export default function handler(req, res) {
  // Logueamos método y body para ver qué llega
  console.log('>> nuevo request:', req.method);
  console.log('>> body recibido:', req.body);

  if (req.method === 'POST') {
    res.status(200).json({ ok: true });
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

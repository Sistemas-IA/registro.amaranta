import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import { validar } from '../src/lib/validadores.js';

const HMAC_SECRET = process.env.HMAC_SECRET!;
const GAS_ENDPOINT = process.env.GAS_ENDPOINT!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const firma = req.headers['x-amaranta-firma'] as string;
  const body = req.body;

  const crypto = await import('crypto');
  const hash = crypto.createHmac('sha256', HMAC_SECRET).update(JSON.stringify(body)).digest('hex');
  if (hash !== firma) return res.status(401).json({ error: 'firma inválida' });

  const errs = validar(body);
  if (Object.keys(errs).length) return res.status(400).json({ error: 'validacion', errs });

  try {
    const gasRes = await fetch(GAS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, ip: req.headers['x-forwarded-for'] ?? '' })
    });

    const result = await gasRes.json();
    return gasRes.ok ? res.status(200).json(result) : res.status(500).json({ error: 'gas' });
  } catch (e) {
    return res.status(500).json({ error: 'gas_down' });
  }
}

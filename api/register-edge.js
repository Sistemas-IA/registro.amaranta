import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const ip = req.headers.get('x-forwarded-for') ?? '0.0.0.0';
  const body = await req.json();

  const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET;
  const GAS_ENDPOINT = process.env.GAS_ENDPOINT;
  const IP_OK = 10;

  // reCAPTCHA
  const cap = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: RECAPTCHA_SECRET, response: body.token })
  }).then(r => r.json());
  if (!cap.success) return json({ error: 'captcha' }, 400);

  const okKey = `ok:${ip}`;
  const okCnt = (await kv.incr(okKey)) ?? 1;
  await kv.expire(okKey, 86400);
  if (okCnt > IP_OK) return json({ error: 'limite_ip' }, 429);

  const dup =
    (await kv.get(`dni:${body.dni}`)) ? 'dni' :
    (await kv.get(`tel:${body.telefono}`)) ? 'telefono' :
    (await kv.get(`mail:${body.email}`)) ? 'email' : null;
  if (dup) return json({ campo: dup }, 409);

  const res = await fetch(GAS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, ip })
  });

  const txt = await res.text();
  return new Response(txt, { status: res.status, headers: { 'content-type': 'application/json' } });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { kv } from '@vercel/kv';

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET!;
const HMAC_SECRET = process.env.HMAC_SECRET!;
const { IP_OK, IP_FAIL } = { IP_OK: 10, IP_FAIL: 30 };

export const config = { matcher: '/api/register' };

export default async function middleware(req: NextRequest) {
  if (req.method !== 'POST') return NextResponse.json({ error: 'Método no permitido' }, { status: 405 });

  const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? '0.0.0.0';
  const body = await req.clone().json();

  // 1. reCAPTCHA
  const capRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: RECAPTCHA_SECRET, response: body.token })
  }).then((r) => r.json());

  if (!capRes.success) return NextResponse.json({ error: 'captcha' }, { status: 400 });

  // 2. Rate limit
  const okKey = `ok:${ip}`;
  const failKey = `fail:${ip}`;
  const okCount = (await kv.incr(okKey)) ?? 1;
  await kv.expire(okKey, 60 * 60 * 24);

  if (okCount > IP_OK) return NextResponse.json({ error: 'limite_ip' }, { status: 429 });

  // 3. Duplicados
  const dupCampo =
    (await kv.get(`dni:${body.dni}`)) ? 'dni' :
    (await kv.get(`tel:${body.telefono}`)) ? 'telefono' :
    (await kv.get(`mail:${body.email}`)) ? 'email' : null;

  if (dupCampo) {
    const fails = (await kv.incr(failKey)) ?? 1;
    if (IP_FAIL && fails > IP_FAIL) await kv.expire(failKey, 60 * 60 * 24);
    return NextResponse.json({ campo: dupCampo }, { status: 409 });
  }

  // 4. HMAC
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(HMAC_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(JSON.stringify(body)));
  const sigHex = Buffer.from(signature).toString('hex');

  const res = NextResponse.next();
  res.headers.set('X-Amaranta-Firma', sigHex);
  return res;
}

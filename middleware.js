// middleware.js – Vercel Edge Runtime
import { NextResponse } from 'next/server';

export const config = {
  matcher: ['/api/:path*', '/'],  // protege API y página
  runtime: 'edge'
};

// Cambia al dominio real donde vive tu formulario:
const ALLOWED_ORIGIN = 'https://tu-dominio.com';

export default function middleware(req) {
  const origin  = req.headers.get('origin')  || '';
  const referer = req.headers.get('referer') || '';

  const badOrigin  = origin && origin !== ALLOWED_ORIGIN;
  const badReferer = referer && !referer.startsWith(ALLOWED_ORIGIN);

  if (badOrigin || badReferer) {
    return new Response('Forbidden', { status: 403 });
  }

  const res = NextResponse.next();
  res.headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  return res;
}

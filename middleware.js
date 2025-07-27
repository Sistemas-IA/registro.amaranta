// middleware.js – Vercel Edge Middleware (framework‑agnostic)
export const config = {
  matcher: ['/api/:path*', '/'],   // protege API y página
  // nada de runtime aquí
};

const ALLOWED_ORIGIN = 'https://tu-dominio.com'; // <-- CAMBIA por tu dominio real

export default function middleware(request) {
  const origin  = request.headers.get('origin')  || '';
  const referer = request.headers.get('referer') || '';

  const badOrigin  = origin && origin !== ALLOWED_ORIGIN;
  const badReferer = referer && !referer.startsWith(ALLOWED_ORIGIN);

  if (badOrigin || badReferer) {
    return new Response('Forbidden', { status: 403 });
  }

  // Continuar la cadena sin modificar respuesta
  return;                 // equivalente a “Next” en middleware genérico
}

import Busboy from 'busboy';

export const config = { api: { bodyParser: false } };

// ── Parámetros ──
const ALLOWED_HOST           = 'registro.amaranta.ar';
const RATE_LIMIT_HOURLY      = 10;
const RATE_LIMIT_DAILY       = 50;
const RATE_LIMIT_GLOBAL      = 5000;
const TTL_HOURLY             = 3600;
const TTL_DAILY              = 86400;

const REDIS_URL              = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN            = process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_AUTH_HEADER      = `Bearer ${REDIS_TOKEN}`;

const RECAPTCHA_VERIFY_URL   = 'https://www.google.com/recaptcha/api/siteverify';
const RECAPTCHA_SECRET_V3    = process.env.RECAPTCHA_SECRET_KEY_V3;    // ✔ Agregar en Vercel
const RECAPTCHA_SECRET_V2    = process.env.RECAPTCHA_SECRET_KEY;       // o RENOMBRAR a ..._KEY_V2
const GAS_ENDPOINT_URL       = process.env.GAS_ENDPOINT_URL;

// … tus PATTERNS, sanitizeHtml, ERR, incrTTL, clientIP …

export default async function handler(req, res) {
  // … CORS/CSRF, OPTIONS, rate-limit, parsing Busboy, honeypots, validación espejo …

  // ── 1) Verificar reCAPTCHA v3 ──
  const tokenV3 = fields.tokenV3;
  if (!tokenV3) {
    return res.status(200).json({ error: 'recaptcha' });
  }
  const v3 = await fetch(RECAPTCHA_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type':'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret:   RECAPTCHA_SECRET_V3,
      response: tokenV3
    })
  }).then(r => r.json()).catch(() => ({ score: 0 }));

  // Umbral configurable (0.5 recomendado)
  if (v3.score < 0.5) {
    // pedimos reto v2 Invisible
    return res.status(200).json({ needV2: true });
  }

  // ── 2) Si vino token v2, verificarlo ──
  const tokenV2 = fields['g-recaptcha-response'];
  if (tokenV2) {
    const v2 = await fetch(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type':'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret:   RECAPTCHA_SECRET_V2,
        response: tokenV2
      })
    }).then(r => r.json()).catch(() => ({ success: false }));

    if (!v2.success) {
      return res.status(200).json({ error: 'recaptcha' });
    }
  }

  // ── 3) Ya sos humano verificado, continúa tu lógica…
  // Normalizar teléfono, sanear direcciones, armar payload y enviarlo a GAS
  // …
  // if todo OK: res.status(200).json({ ok: true });

  // En caso de error en GAS:
  // return res.status(200).json({ error: data.error || 'generic' });
}

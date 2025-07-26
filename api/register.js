// @ts-check
import { kv } from '@vercel/kv';
import crypto from 'node:crypto';
import { getExistingKeys, appendRow } from '../services/sheetsService.js';
import { sendConfirmation } from '../services/emailService.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const DNI_RE   = /^\d{8}$/;
const CODE_RE  = /^\d{2,4}$/;          // área sin 0
const CELL_RE  = /^\d{7,9}$/;          // número sin 15
const LIST_RE  = /^\d{1,2}$/;          // 0‑99

// -------- utils --------
const sanitize = s =>
  s.trim().replace(/^[=+\-@']/,'').replace(/[<>"&]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;','&':'&amp;'}[c]));

const ip = req => (req.headers['x-forwarded-for'] || '').split(',')[0] || req.ip || '0.0.0.0';

const limited = async key => {
  const bucket = `rl:${key}:${Math.floor(Date.now() / (process.env.RATE_LIMIT_WINDOW ?? 3600))}`;
  const n = await kv.incr(bucket);
  if (n === 1) kv.expire(bucket, Number(process.env.RATE_LIMIT_WINDOW ?? 3600));
  return n > Number(process.env.RATE_LIMIT_MAX ?? 5);
};

// -------- handler --------
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Método no permitido' });

  if (await limited(ip(req))) return res.status(429).json({ ok:false, error:'Demasiados intentos' });

  const {
    nombre = '', apellido = '', dni = '', codigo = '', numero = '',
    email = '', direccion = '', comentarios = '', l = '0',
    zona = '', estado = ''
  } = req.body ?? {};

  // --- honeypots
  if (zona || estado) return res.status(400).json({ ok:false, error:'Spam detectado' });

  // --- validaciones
  if (!nombre.trim() || nombre.length > 60)      return bad(res,'Nombre inválido');
  if (!apellido.trim() || apellido.length > 60)  return bad(res,'Apellido inválido');
  if (!DNI_RE.test(dni))                         return bad(res,'DNI inválido (8 dígitos)');
  if (!CODE_RE.test(codigo))                     return bad(res,'Código área inválido');
  if (!CELL_RE.test(numero))                     return bad(res,'Número celular inválido');
  if (!EMAIL_RE.test(email) || email.length>254) return bad(res,'Email inválido');
  if (!LIST_RE.test(l))                          return bad(res,'Lista inválida');

  // --- reCAPTCHA
  const rec = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({secret:process.env.RECAPTCHA_SECRET,response:req.body.recaptchaToken})
  }).then(r=>r.json());
  if (!rec.success || (rec.score??0)<0.5) return bad(res,'reCAPTCHA rechazado');

  // --- anti‑duplicados
  const { dnis, tels, emails } = await getExistingKeys();
  const telNormalized = `549${codigo}${numero}`;
  if (dnis.has(dni)      ) return bad(res,'DNI ya registrado');
  if (emails.has(email)  ) return bad(res,'Email ya registrado');
  if (tels.has(telNormalized)) return bad(res,'Teléfono ya registrado');

  // --- armamos la fila
  const ts = new Date().toISOString();
  const row = [
    ts,                             // Timestamp
    dni,                            // DNI (B)
    telNormalized,                  // Tel. (C)
    email,                          // Email (D)
    sanitize(nombre),               // E
    sanitize(apellido),             // F
    sanitize(direccion),            // G
    sanitize(comentarios),          // H
    'Pendiente',                    // Zona (I)
    'Pendiente',                    // Estado (J)
    l                               // Lista (K)
  ];

  try {
    await appendRow(row);
    await sendConfirmation(email, { nombre });
    return res.json({ ok:true });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ ok:false, error:'Fallo al guardar o enviar mail' });
  }
}

function bad(res,msg){ return res.status(400).json({ ok:false, error:msg }); }


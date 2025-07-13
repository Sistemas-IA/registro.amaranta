/**
 * api/register.js – versión 2025-07-13
 * • Mantiene Busboy, regex y reCAPTCHA tal cual
 * • Añade rate-limit (10 req/min/IP) + alerta opcional a Slack
 */

import Busboy from 'busboy';

/* — Config para que Vercel no intente parsear el body — */
export const config = { api: { bodyParser: false } };

/* — Variables de entorno — */
const GAS_URL          = process.env.GAS_ENDPOINT_URL;       // URL de tu Apps Script
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY;   // clave secreta v2
const SLACK_HOOK       = process.env.SLACK_HOOK || '';       // opcional

/* — Rate-limit en memoria — */
const hits   = new Map();          // { ip: [timestamps] }
const LIMIT  = 10;                 // máx 10 peticiones
const WINDOW = 60_000;             // en 60 s

/* — Regex espejo (los mismos del front) — */
const RX = {
  nombre:  /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s-]{2,30}$/,
  apellido:/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s-]{2,30}$/,
  dni:     /^\d{8}$/,
  area:    /^\d{2,4}$/,
  num:     /^\d{7,9}$/,
  email:   /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  direccion:/^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ.,#\/º°()\-\s]{5,100}$/,
  comentarios:/^.{0,300}$/
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  /* 1 ▪ Rate-limit (10 req/min/IP) */
  const ip  = (req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown';
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < WINDOW);
  if (arr.length >= LIMIT) {
    if (SLACK_HOOK && arr.length === LIMIT) alertSlack(`🚫 Rate-limit desde ${ip}`);
    return res.status(429).json({ error: 'rate' });
  }
  arr.push(now); hits.set(ip, arr);

  /* 2 ▪ Parsear multipart/form-data con Busboy */
  const campos = {};
  const busboy = Busboy({ headers: req.headers });
  busboy.on('field', (name, val) => { campos[name] = val.trim(); });
  busboy.on('finish', () => procesar(campos, ip, res));
  req.pipe(busboy);
}

/* ———————————————————————————————————————————————— */
/*  Funciones auxiliares                                                     */
/* ———————————————————————————————————————————————— */
async function procesar(f, ip, res) {

  /* Validaciones espejo */
  if (!RX.nombre.test(f.nombre))           return res.json({error:'nombre_invalido'});
  if (!RX.apellido.test(f.apellido))       return res.json({error:'apellido_invalido'});
  if (!RX.dni.test(f.dni))                 return res.json({error:'dni_invalido'});
  if (!RX.area.test(f.codArea) ||
      !RX.num.test(f.numeroTelefono))      return res.json({error:'tel_invalido'});
  if (!RX.email.test(f.email))             return res.json({error:'email_invalido'});
  if (!RX.direccion.test(f.direccion))     return res.json({error:'dir_invalida'});
  if (!RX.comentarios.test(f.comentarios)) return res.json({error:'comentarios'});

  /* Verificar reCAPTCHA v2 Invisible */
  const token = f['g-recaptcha-response'] || '';
  const rc = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method:'POST',
    body: new URLSearchParams({ secret: RECAPTCHA_SECRET, response: token })
  }).then(r=>r.json()).catch(()=>({success:false}));

  if (!rc.success) return res.json({ error:'recaptcha' });

  /* Armar payload normalizado para GAS */
  const body = {
    nombre:   f.nombre,
    apellido: f.apellido,
    dni:      f.dni,
    tel:      '549' + f.codArea + f.numeroTelefono,
    email:    f.email,
    direccion:f.direccion,
    comentarios:f.comentarios,
    zona:     f.zona   || 'Pendiente',
    estado:   f.estado || 'Pendiente',
    lista:    f.lista  || '',
    ip
  };

  /* Enviar a GAS */
  const gas = await fetch(GAS_URL, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(body)
  }).then(r=>r.json()).catch(()=>({error:'gas'}));

  /* Alertar duplicados (opcional) */
  if (gas.error && gas.error.startsWith('duplicado')) {
    alertSlack(`⚠️ ${gas.error} desde ${ip}`);
  }

  res.json(gas);           // { ok:true }  o  { error:'duplicado_dni' } …
}

function alertSlack(text){
  if (!SLACK_HOOK) return;
  fetch(SLACK_HOOK, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ text })
  }).catch(()=>{});
}

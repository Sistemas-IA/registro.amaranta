/**
 * api/register.js – versión 2025-07-13
 * – Mantiene reCAPTCHA, validaciones, llamada a GAS.
 * – Añade rate-limit (10 req/min/IP) y alerta opcional a Slack.
 */

const hits = new Map();                          // { ip: [timestamps] }
const GAS_URL          = process.env.GAS_ENDPOINT_URL;
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY;

/* Regex espejo (sin +549) */
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
  /* — Solo POST — */
  if (req.method !== 'POST') return res.status(405).end();

  /* 1 ─── Rate-limit 10 req/min por IP —————————— */
  const ip  = (req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown';
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  if (arr.length >= 10) {
    notify(ip, 'rate-limit');
    return res.status(429).json({ error:'rate' });
  }
  arr.push(now); hits.set(ip, arr);

  /* 2 ─── Parse FormData ———————————————————— */
  const form = await req.formData();                 // Next.js / Vercel Edge
  const get  = k => form.get(k) || '';

  const datos = {
    nombre:   get('nombre').trim(),
    apellido: get('apellido').trim(),
    dni:      get('dni').trim(),
    codArea:  get('codArea').trim(),
    numeroTelefono: get('numeroTelefono').trim(),
    email:    get('email').trim(),
    direccion:get('direccion').trim(),
    comentarios:get('comentarios').trim(),
    zona:     get('zona')   || 'Pendiente',
    estado:   get('estado') || 'Pendiente',
    lista:    get('lista')  || '',
    token:    get('g-recaptcha-response') || ''
  };

  /* 3 ─── Validaciones espejo ————————————————— */
  if (!RX.nombre.test(datos.nombre))           return res.json({error:'nombre_invalido'});
  if (!RX.apellido.test(datos.apellido))       return res.json({error:'apellido_invalido'});
  if (!RX.dni.test(datos.dni))                 return res.json({error:'dni_invalido'});
  if (!RX.area.test(datos.codArea) ||
      !RX.num.test(datos.numeroTelefono))      return res.json({error:'tel_invalido'});
  if (!RX.email.test(datos.email))             return res.json({error:'email_invalido'});
  if (!RX.direccion.test(datos.direccion))     return res.json({error:'dir_invalida'});
  if (!RX.comentarios.test(datos.comentarios)) return res.json({error:'comentarios'});

  /* 4 ─── reCAPTCHA v2 invisible ——————————— */
  const rec = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method:'POST',
    body: new URLSearchParams({ secret:RECAPTCHA_SECRET, response:datos.token })
  }).then(r=>r.json());

  if (!rec.success) return res.json({ error:'recaptcha' });

  /* 5 ─── Construir payload normalizado para GAS — */
  const payload = {
    nombre: datos.nombre,
    apellido: datos.apellido,
    dni: datos.dni,
    tel: '549' + datos.codArea + datos.numeroTelefono,
    email: datos.email,
    direccion: datos.direccion,
    comentarios: datos.comentarios,
    zona: datos.zona,
    estado: datos.estado,
    lista: datos.lista,
    ip
  };

  /* 6 ─── Enviar a GAS ———————————————— */
  const gasResp = await fetch(GAS_URL, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  }).then(r=>r.json());

  /* 7 ─── Propagar duplicados / éxito ——————— */
  if (gasResp.error) {
    if (gasResp.error.startsWith('duplicado')) notify(ip, gasResp.error);
    return res.json(gasResp);         // {error:'duplicado_dni', …}
  }

  return res.json({ ok:true });
}

/* — Alerta opcional a Slack/Discord — */
function notify(ip, type){
  const hook = process.env.SLACK_HOOK;
  if (!hook) return;
  fetch(hook, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ text:`⚠️ ${type} desde ${ip}` })
  }).catch(()=>{});
}

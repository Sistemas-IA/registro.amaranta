import Busboy from 'busboy';
export const config={api:{bodyParser:false}};

// Parámetros
const ALLOWED_HOST='registro.amaranta.ar';
const RL_H=10, RL_D=50, RL_G=5000;
const TTL_H=3600, TTL_D=86400;
const REDIS_URL=process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN=process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_AUTH=`Bearer ${REDIS_TOKEN}`;
const VERIFY_URL='https://www.google.com/recaptcha/api/siteverify';
const SECRET_V3=process.env.RECAPTCHA_SECRET_KEY_V3;
const SECRET_V2=process.env.RECAPTCHA_SECRET_KEY;
const GAS_URL=process.env.GAS_ENDPOINT_URL;

// Helpers Redis
async function incr(key,ttl){const r=await fetch(`${REDIS_URL}/incr/${encodeURIComponent(key)}`,{headers:{Authorization:REDIS_AUTH}}).then(r=>r.json()); if(r.result===1&&ttl) await fetch(`${REDIS_URL}/expire/${encodeURIComponent(key)}/${ttl}`,{headers:{Authorization:REDIS_AUTH}}); return r.result;}
const getIP=req=>(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim();

export default async function handler(req,res){
  // Origen
  const origin=req.headers.origin||req.headers.referer||'';
  if(!(new URL(origin||'http://').host===ALLOWED_HOST)) return res.status(403).json({error:'CSRF'});
  res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Origin',origin);
  if(req.method==='OPTIONS') return res.status(204).setHeader('Access-Control-Allow-Methods','POST,OPTIONS').setHeader('Access-Control-Allow-Headers','Content-Type').end();
  if(req.method!=='POST') return res.status(405).json({error:'Método no permitido'});

  // Rate-limit
  const ip=getIP(req), day=new Date().toISOString().slice(0,10), now=Date.now();
  const [h,d,g]=await Promise.all([
    incr(`rl:${ip}:h:${Math.floor(now/3600000)}`,TTL_H),
    incr(`rl:${ip}:d:${day}`,TTL_D),
    incr(`rl:global:${day}`,TTL_D)
  ]);
  if(g>RL_G) return res.status(503).json({error:'generic'});
  if(h>RL_H||d>RL_D) return res.status(429).json({error:'rate_limit'});

  // Leer fields
  const f={}; await new Promise((r,x)=>{const b=Busboy({headers:req.headers});b.on('field',(n,v)=>f[n]=v.trim());b.on('finish',r).on('error',x);req.pipe(b);});
  // Honeypots
  if(f.zona||f.estado) return res.json({error:'campos_bot'});

  // Validación espejo (Patterns iguales a front)
  const PATTERS={nombre:/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s-]{2,30}$/,apellido:/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s-]{2,30}$/,dni:/^\d{8}$/,codArea:/^\d{2,4}$/,numeroTelefono:/^\d{7,9}$/,email:/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,direccion:/^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ.,#\/º°()\-\s]{5,100}$/,comentarios:/^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ., ()\/#º°\n\r\-]{0,300}$/};
  for(const k in PATTERS) if(!PATTERS[k].test(f[k]||'')) return res.json({error:k==='numeroTelefono'||k==='codArea'?'tel_invalido':`${k}_invalido`});

  // reCAPTCHA v3
  if(!f.tokenV3) return res.json({error:'recaptcha'});
  const score=await fetch(VERIFY_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({secret:SECRET_V3,response:f.tokenV3})}).then(r=>r.json()).then(j=>j.score||0).catch(()=>0);
  if(score<0.5) return res.json({needV2:true});

  // reCAPTCHA v2
  if(f['g-recaptcha-response']){
    const ok=await fetch(VERIFY_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({secret:SECRET_V2,response:f['g-recaptcha-response']})}).then(r=>r.json()).then(j=>j.success).catch(()=>false);
    if(!ok) return res.json({error:'recaptcha'});
  }

  // Payload y envío
  const telefono=`549${f.codArea}${f.numeroTelefono}`;
  const sap=JSON.stringify({nombre:f.nombre,apellido:f.apellido,dni:f.dni,telefono,email:f.email,direccion:f.direccion,comentarios:f.comentarios||'',lista:f.lista||'',timestamp:new Date().toISOString(),ip});
  try{
    const r=await fetch(GAS_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:sap});
    const d=await r.json(); return d.status==='OK'?res.json({ok:true}):res.json({error:d.error||'generic'});
  }catch(e){console.error(e);return res.status(500).json({error:'generic'});}  
}

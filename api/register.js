
import Busboy from 'busboy';

export const config = { api: { bodyParser: false } };

/* ────────── Regex de validación ────────── */
const PATTERNS = {
  nombre: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s-]{2,30}$/,
  apellido: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s-]{2,30}$/,
  dni: /^\d{8}$/,
  codArea: /^\d{2,4}$/,
  numeroTelefono: /^\d{7,9}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  direccion: /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ.,#\/º°()\-\s]{5,100}$/,
  comentarios: /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ., ()\/#º°\n\r-]{0,300}$/
};

/* ────────── Anti‑XSS ────────── */
const htmlEscape = s => String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#x27;');

/* ────────── Upstash helpers ────────── */
const RURL  = process.env.UPSTASH_REDIS_REST_URL;
const RAUTH = `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`;
async function upstash(path){
  const res = await fetch(`${RURL}/${path}`,{headers:{Authorization:RAUTH}});
  return res.json();
}
async function incrTTL(key,ttl){
  const {result:n}=await upstash(`incr/${encodeURIComponent(key)}`);
  if(n===1&&ttl) await upstash(`expire/${encodeURIComponent(key)}/${ttl}`);
  return n;
}
async function setNX(key,ttl){
  const {result}=await upstash(`set/${encodeURIComponent(key)}/1/EX/${ttl}/NX`);
  return result==="OK";
}
const clientIP=req=>(req.headers["x-forwarded-for"]??req.socket.remoteAddress??"").split(",")[0].trim();

/* ────────── Handler ────────── */
export default async function handler(req,res){
  /* CORS / CSRF host exacto */
  const originHeader=req.headers.origin||req.headers.referer||"";
  let okOrigin=false;
  try{ okOrigin=new URL(originHeader).host==="registro.amaranta.ar"; }catch{}
  if(!okOrigin) return res.status(403).json({error:"CSRF"});
  res.setHeader("Vary","Origin");
  res.setHeader("Access-Control-Allow-Origin",originHeader);
  if(req.method==="OPTIONS"){
    res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers","Content-Type");
    return res.status(204).end();
  }
  if(req.method!=="POST") return res.status(405).json({error:"Método no permitido"});

  /* Rate‑limit */
  const ip=clientIP(req);
  const now=Date.now(), day=new Date().toISOString().slice(0,10);
  const hKey=`rate:${ip}:h:${Math.floor(now/3600000)}`;
  const dKey=`rate:${ip}:d:${day}`;
  const gKey=`rate:global:${day}`;
  const [hHits,dHits,gHits]=await Promise.all([
    incrTTL(hKey,3600), incrTTL(dKey,86400), incrTTL(gKey,86400)
  ]);
  if(gHits>5000) return res.status(503).json({error:"rate_limit"});
  if(hHits>5||dHits>20){
    res.setHeader("Retry-After",hHits>5?3600:86400);
    return res.status(429).json({error:"rate_limit"});
  }

  /* Parsear multipart */
  const fields={};
  await new Promise((resolve,reject)=>{
    const bb=Busboy({headers:req.headers});
    bb.on("field",(n,v)=>{fields[n]=v.trim();});
    bb.on("finish",resolve).on("error",reject);
    req.pipe(bb);
  });

  /* Honeypot */
  if((fields.zona||"").trim()!==""||(fields.estado||"").trim()!=="")
    return res.status(200).json({error:"campos_bot"});

  /* Validaciones */
  for(const k of Object.keys(PATTERNS)){
    if(!PATTERNS[k].test(fields[k]||"")){
      const err=(k==="numeroTelefono"||k==="codArea")?"tel_invalido":k+"_invalido";
      return res.status(200).json({error:err});
    }
  }

  /* Duplicados (reserva 10 min) */
  const telefono="549"+fields.codArea+fields.numeroTelefono;
  const duplicates=[
    {key:`dup:dni:${fields.dni}`,err:"duplicado_dni"},
    {key:`dup:tel:${telefono}`,err:"duplicado_tel"},
    {key:`dup:mail:${fields.email.toLowerCase()}`,err:"duplicado_email"}
  ];
  for(const d of duplicates){
    const ok=await setNX(d.key,600);
    if(!ok) return res.status(200).json({error:d.err});
  }

  /* reCAPTCHA */
  const verify=await fetch("https://www.google.com/recaptcha/api/siteverify",{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({
      secret:process.env.RECAPTCHA_SECRET_KEY,
      response:fields["g-recaptcha-response"],
      remoteip:ip
    })
  }).then(r=>r.json()).catch(()=>({success:false}));
  if(!verify.success) return res.status(200).json({error:"recaptcha"});

  /* Payload */
  const payload={
    nombre:fields.nombre,
    apellido:fields.apellido,
    dni:fields.dni,
    telefono,
    email:fields.email,
    direccion:htmlEscape(fields.direccion),
    comentarios:htmlEscape(fields.comentarios||""),
    zona:"Pendiente",
    estado:"Pendiente",
    lista:fields.lista||"",
    timestamp:new Date().toISOString(),
    ip
  };

  /* Enviar a GAS */
  try{
    const resp=await fetch(process.env.GAS_ENDPOINT_URL,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload)
    });
    const data=await resp.json();
    if(data.status==="OK") return res.status(200).json({ok:true});
    return res.status(200).json({error:data.error||"generic"});
  }catch(e){
    console.error(e);
    return res.status(500).json({error:"generic"});
  }
}

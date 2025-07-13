import Busboy from 'busboy';
import { config } from './config.mjs'; const { patterns,telPrefix,limits,texts }=config;
const hits=new Map(); export const configRuntime={api:{bodyParser:false}};
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({message:'Método no permitido'});
 if(+req.headers['content-length']>limits.maxBodyBytes)return res.status(413).json({message:texts.errorServer});
 const ip=(req.headers['x-forwarded-for']||'').split(',')[0]||req.socket?.remoteAddress||'';
 const now=Date.now(); const arr=hits.get(ip)||[]; const recent=arr.filter(t=>now-t<60000);
 if(recent.length>=limits.maxPerMinute)return res.status(429).json({message:texts.errorServer});
 hits.set(ip,[...recent,now]);
 const fields={}; await new Promise((resv,rej)=>{const b=Busboy({headers:req.headers});
 b.on('field',(n,v)=>fields[n]=v);b.on('finish',resv).on('error',rej);req.pipe(b);});
 for(const k of Object.keys(patterns)){if(!patterns[k])continue;
  const re=new RegExp(patterns[k]); if(k==='comentarios'&&!(fields[k]||'').trim())continue;
  if(!re.test((fields[k]||'').trim()))return res.status(422).json({field:k,message:'inválido'});
 }
 const tel=telPrefix+(fields.codArea||'')+(fields.numeroTelefono||'');
 const payload={nombre:fields.nombre||'',apellido:fields.apellido||'',dni:fields.dni||'',telefono:tel,
 email:fields.email||'',direccion:fields.direccion||'',comentarios:fields.comentarios||'',
 zona:'Pendiente',estado:'Pendiente',lista:fields.lista||'',timestamp:new Date().toISOString(),ip};
 try{const r=await fetch(process.env.GAS_ENDPOINT_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
     if(!r.ok)throw new Error('GAS');return res.status(200).json({message:'OK'});}
 catch(e){console.error(e);return res.status(500).json({message:texts.errorServer});}}

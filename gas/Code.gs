const LOCK_WAIT_MS=2000;
function esc(v){const s=String(v||'').trim();return /^([=+\-@])/.test(s)?"'"+s:s;}
function out(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}
function doPost(e){
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(LOCK_WAIT_MS))return out({status:'ERROR_LOCK',message:'Demasiados envíos simultáneos'});
 try{
   const d=JSON.parse(e.postData.contents||'{}');
   const ss=SpreadsheetApp.openById('18jX4rlx4hOGIa-6whQT0-jDxcU5UoeL0na655rwDxew');
   const hoja=ss.getSheetByName('Clientes');
   hoja.appendRow([esc(d.nombre),esc(d.apellido),esc(d.dni),esc(d.telefono),
                   esc(d.email),esc(d.direccion),esc(d.comentarios),'Pendiente','Pendiente',
                   esc(d.lista),d.timestamp,esc(d.ip)]);
   return out({status:'OK'});
 }catch(err){console.error(err);return out({status:'ERROR',message:err.message});}
 finally{lock.releaseLock();}
}

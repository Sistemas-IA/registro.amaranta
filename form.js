import { config } from './config.js';
const { patterns, texts } = config;
const form=document.getElementById('registro-form');
const submitBtn=form.querySelector('button');
const msgBox=document.getElementById('form-msg');
document.getElementById('lista').value=new URLSearchParams(location.search).get('l')??'';
function showError(i,m){const s=i.nextElementSibling;s.textContent=m;s.style.display=m?'block':'none';}
function showMsg(t,m){msgBox.textContent=m;msgBox.className=t;msgBox.hidden=false;}
function validate(i){const k=i.name||i.id;if(!patterns[k])return true;
 const v=i.value.trim(),t=i.dataset.touched==='true',req=k!=='comentarios';
 const pass=v===''?false:patterns[k].test(v);
 const valid=req?(v!==''&&pass):(v===''||pass);
 showError(i,t&&v!==''&&!pass?'Valor inválido':'');return valid;}
function toggle(){const ok=[...form.elements].filter(el=>el.type!=='hidden'&&el.tagName!=='BUTTON').every(validate);submitBtn.disabled=!ok;}
form.querySelectorAll('input, textarea').forEach(el=>{if(el.type==='hidden')return;
 el.addEventListener('blur',()=>{el.dataset.touched='true';validate(el);toggle();});
 el.addEventListener('input',()=>{validate(el);toggle();});});
window.addEventListener('load',()=>{submitBtn.disabled=true;toggle();});
form.addEventListener('submit',e=>{e.preventDefault();if(submitBtn.disabled)return;grecaptcha.execute();});
window.onSubmit=tok=>{const d=new FormData(form);d.append('g-recaptcha-response',tok);
 fetch('/api/register',{method:'POST',body:d})
   .then(r=>r.json())
   .then(()=>{showMsg('ok',texts.success);form.reset();submitBtn.disabled=true;})
   .catch(()=>{showMsg('err',texts.errorServer);});
};

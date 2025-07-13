import { config } from '/config.js';  // ruta absoluta

// Precompilar patrones a RegExp con bandera Unicode
const patterns = {};
for (const k in config.patterns) {
  patterns[k] = new RegExp(config.patterns[k], 'u');
}

const texts = config.texts;
const form=document.getElementById('registro-form');
const submitBtn=form.querySelector('button');
const msgBox=document.getElementById('form-msg');
document.getElementById('lista').value=new URLSearchParams(location.search).get('l') ?? '';

function showError(i,m){const s=i.nextElementSibling;s.textContent=m;s.style.display=m?'block':'none';}
function showMsg(t,m){msgBox.textContent=m;msgBox.className=t;msgBox.hidden=false;}

function validate(i){
  const k=i.name||i.id;
  if(!patterns[k]) return true;
  const v=i.value.trim();
  const touched=i.dataset.touched==='true';
  const required=k!=='comentarios';
  const pass=v===''?false:patterns[k].test(v);
  const valid = required ? (v!=='' && pass) : (v==='' || pass);
  showError(i, touched && v!=='' && !pass ? 'Valor inválido' : '');
  return valid;
}
function toggle(){
  submitBtn.disabled=[...form.elements].filter(el=>el.type!=='hidden' && el.tagName!=='BUTTON').some(el=>!validate(el));
}

form.querySelectorAll('input, textarea').forEach(el=>{
  if(el.type==='hidden') return;
  el.addEventListener('blur',()=>{el.dataset.touched='true';validate(el);toggle();});
  el.addEventListener('input',()=>{validate(el);toggle();});
});
window.addEventListener('load',()=>{submitBtn.disabled=true;toggle();});

form.addEventListener('submit',e=>{
  e.preventDefault();
  if(submitBtn.disabled) return;
  grecaptcha.execute();
});

window.onSubmit = token =>{
  const data=new FormData(form);
  data.append('g-recaptcha-response',token);
  fetch('/api/register',{method:'POST',body:data})
    .then(r=>r.json())
    .then(()=>{showMsg('ok',texts.success);form.reset();submitBtn.disabled=true;})
    .catch(()=>{showMsg('err',texts.errorServer);});
};

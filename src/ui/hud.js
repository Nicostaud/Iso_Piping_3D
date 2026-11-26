/** Entry panel (HUD) for typed lengths, projections and angles; drawing plane and entry mode. */
import { esc, fa, fmt } from '../core/format.js';
import { axisAligned, az3, azOf, clamp, deg } from '../core/geom.js';
import { R_, axn, dirWords, projTxt, sgn } from '../core/labels.js';
import { AXES } from '../data/frames.js';
import { F, S } from '../state.js';
import { $ } from './dom.js';
import { hint } from './panels.js';
import { commitPreview, draw2D, endDraw, preview, startFit } from './sketch.js';

export const fields=()=>S.cons==='ortho'?['L']:S.entry==='XY'?AXES[S.cons].map((a,i)=>'P'+i):S.cons==='R3'?['L','A','I']:['L','A'];
export function clearF(){for(const k in F)F[k]='';S.fld=fields()[0];}
export const numF=k=>{const s=String(F[k]).replace(',','.').trim();if(s===''||s==='-'||s==='.'||s==='-.')return null;const v=+s;return Number.isFinite(v)?v:null;};
export const anyF=()=>Object.values(F).some(v=>v!=='');
export const consName=k=>k==='EO'?R_().v1:k==='NS'?R_().v2:{ortho:'Ortho',H:'Horiz.',R3:'3D'}[k];
const hud=$('#hud');
export function hudShow(){const on=S.tool==='pipe'&&!!S.drawFrom;hud.hidden=!on;$('#p2d').classList.toggle('drawing',on);}
export function hudBuild(){
  document.querySelectorAll('#entrySeg [data-e]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.e===S.entry));
  $('#entrySeg').style.display=S.cons==='ortho'?'none':'';
  $('#hPlane').textContent=S.cons==='ortho'?'Ortho · direction by mouse':`Plane ${consName(S.cons)}${S.entry==='XY'?' · projection sense: mouse':''}`;
  const lab={L:['Length','mm'],A:[S.cons==='R3'||S.cons==='H'?(S.M.meta.ref==='ship'?'Bearing':'Azimuth'):'Angle','°'],I:['Inclination','°']};
  $('#hFields').innerHTML=fields().map(k=>{
    const [t,u]=k[0]==='P'?['Proj. '+axn(AXES[S.cons][+k[1]]),'mm']:lab[k];
    return `<label class="hf" data-k="${k}"><span>${t}</span><span class="in"><input data-h="${k}" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="${t}"><i>${u}</i>${k[0]==='P'?'<b></b>':''}</span></label>`;
  }).join('');
  $('#hTip').textContent=S.entry==='XY'&&S.cons!=='ortho'?'Tab: next field · “-” forces the sense':'Tab: next field';
  hudSync();
}
export function hudSync(){
  for(const k of fields()){const el=hud.querySelector(`[data-h="${k}"]`);if(el)el.value=F[k];}
  hud.querySelectorAll('.hf').forEach(e=>e.classList.toggle('on',e.dataset.k===S.fld));
  hudUpdate();
}
export function hudUpdate(){
  if(hud.hidden)return;
  const pv=preview(),ph=pv?pv.ph:{};
  for(const k of fields()){
    const el=hud.querySelector(`[data-h="${k}"]`);if(!el)continue;
    el.placeholder=ph[k]!=null?(k==='A'?fa(ph[k]):fmt(Math.round(ph[k]))):(k==='I'?'0':'');
    if(k[0]==='P'){const ax=AXES[S.cons][+k[1]],b=el.parentElement.querySelector('b');if(b)b.textContent=pv&&pv.R&&Math.abs(pv.R[ax])>.5?sgn(ax,pv.R[ax]>0):'';}
  }
  const res=$('#hRes');$('#hOk').disabled=!(pv&&pv.R);
  if(!pv||!pv.R){res.innerHTML='<div class="sub">Point the direction with the mouse, or type the values</div>';return;}
  const R=pv.R,big=[],sub=[];
  big.push(`<span>${fmt(Math.round(pv.Lr))} <small>mm</small></span>`);
  if(S.cons==='ortho')big.unshift(`<span>${esc(dirWords(pv.dir))}</span>`);
  else if(S.cons==='R3'){
    big.push(`<span>${R_().az} ${az3(azOf(pv.dir))}°</span>`);
    const inc=deg(Math.asin(clamp(pv.dir[2],-1,1)));big.push(`<span>${inc>=0?'+':'−'}${fa(Math.abs(inc))}° <small>incl.</small></span>`);
    sub.push(`horizontal run ${fmt(Math.round(Math.hypot(R[0],R[1])))} mm`);
  }else{
    const [a0,a1]=AXES[S.cons],g=deg(Math.atan2(Math.abs(R[a1]),Math.abs(R[a0])));
    if(S.cons==='H'){big.push(`<span>${fa(g)}° <small>/ ${axn(0)}</small></span>`);sub.push(`${fa(90-g)}° / ${axn(1)}`);if(Math.hypot(R[0],R[1])>.5)sub.push(`${R_().az} ${az3(azOf(pv.dir))}°`);}
    else{big.push(`<span>${fa(g)}° <small>slope ${R[a1]>=0?'rising':'falling'}</small></span>`);sub.push(`${fa(90-g)}° / vertical`);}
  }
  if(S.entry==='LA'||S.cons==='ortho'){const pt=projTxt(R);if(pt&&!axisAligned(pv.dir))sub.unshift('projections '+pt);}
  const sf=startFit(pv.dir);if(sf)sub.push(sf);
  res.innerHTML=`<div class="big">${big.join('')}</div>${sub.length?`<div class="sub">${esc(sub.join(' · '))}</div>`:''}`;
}
export function setCons(k){
  S.cons=k;document.querySelectorAll('#consSeg [data-k]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.k===k));
  $('#stepSel').disabled=k==='ortho'||S.entry==='XY';clearF();if(S.drawFrom)hudBuild();hint();draw2D();
}
export function setEntry(e){S.entry=e;$('#stepSel').disabled=S.cons==='ortho'||S.entry==='XY';clearF();if(S.drawFrom)hudBuild();hint();draw2D();}
export function applyRef(){
  $('#consSeg [data-k="EO"]').textContent=R_().v1;$('#consSeg [data-k="NS"]').textContent=R_().v2;
  if(S.drawFrom)hudBuild();
}

export function initHud(){
hud.addEventListener('input',e=>{const k=e.target.dataset.h;if(!k)return;F[k]=e.target.value;S.fld=k;hud.querySelectorAll('.hf').forEach(x=>x.classList.toggle('on',x.dataset.k===S.fld));hudUpdate();draw2D();});
hud.addEventListener('focusin',e=>{const k=e.target.dataset.h;if(k){S.fld=k;hud.querySelectorAll('.hf').forEach(x=>x.classList.toggle('on',x.dataset.k===S.fld));}});
hud.addEventListener('keydown',e=>{
  if(!e.target.dataset.h)return;
  if(e.key==='Enter'){e.preventDefault();if(commitPreview()){const f=hud.querySelector('[data-h]');if(f)f.focus();}}
  else if(e.key==='Escape'){e.preventDefault();if(anyF()){clearF();hudSync();draw2D();}else{e.target.blur();endDraw();}}
});
$('#entrySeg').addEventListener('click',e=>{const b=e.target.closest('[data-e]');if(b){setEntry(b.dataset.e);b.blur();}});
$('#hOk').onclick=()=>commitPreview();
$('#consSeg').addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(b){setCons(b.dataset.k);b.blur();}});
$('#stepSel').addEventListener('change',e=>{S.step=+e.target.value;e.target.blur();hudUpdate();draw2D();});
}

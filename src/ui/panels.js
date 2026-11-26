/** Side panel (selection, settings, MTO), catalogue palette, tools, title block, toasts. */
import { esc, fmt } from '../core/format.js';
import { azOf, clamp, clean, deg, dirAI, dot3, len3 } from '../core/geom.js';
import { changed, commit } from '../core/history.js';
import { R_, angTxt, compDes, dirWords, nm } from '../core/labels.js';
import { canRedirect, eraseObj, fitName, nd, redirect, segDir, segLen, segR, skLen } from '../core/model.js';
import { csv, table } from '../core/mto.js';
import { persist } from '../core/store.js';
import { CLS } from '../data/bolting.js';
import { CAT, ENDS, FAM, FIG, famSel, figOf } from '../data/catalogue.js';
import { MAT } from '../data/materials.js';
import { NPS, SCHS, WT, kgm, lpm, schL, schOf, wtOf } from '../data/pipe.js';
import { RD, S, U, drawHist } from '../state.js';
import { $ } from './dom.js';
import { applyRef, clearF, hudShow } from './hud.js';
import { bomHTML, fname, saveFile } from './sheet.js';
import { cv, draw2D, placeType, startDraw, symbol } from './sketch.js';
import { theme } from './theme.js';
import { mark3D, setView } from '../view3d/scene.js';

export function refreshSel(){draw2D();renderSide();mark3D();}
/** UI refresh after any model change (end of the legacy changed()). */
export function refreshUI(){draw2D();mark3D();renderSide();hudShow();$('#bUndo').disabled=!U.length;$('#bRedo').disabled=!RD.length;$('#mEch').textContent=`Not to scale · 1 cell = ${S.M.meta.scale} mm`;hint();}
function iconURL(type){
  const T=theme(),c=document.createElement('canvas');c.width=88;c.height=60;const x=c.getContext('2d');x.scale(2,2);
  x.strokeStyle=T.ink;x.lineWidth=2;x.lineCap='round';x.beginPath();x.moveTo(2,16);x.lineTo(42,16);x.stroke();
  symbol(x,type,[22,16],[1,0],[0,-1],7,T.ink,T.panel,false);return c.toDataURL();
}
export function buildPalette(){
  const f=FAM[S.tool]?S.tool:null;$('#pbar').hidden=!f;if(!f)return;
  $('#pal').innerHTML=Object.entries(CAT).filter(([,v])=>v.f===f).map(([k,v])=>`<button data-ct="${k}" aria-pressed="${famSel[f]===k}" title="${esc(v.n)}"><img src="${iconURL(k)}" alt="">${esc(v.sh)}</button>`).join('');
  const t=famSel[f],showFig=t==='hu'||t==='plug';$('#figWrap').hidden=!showFig;
  if(showFig)$('#figSel').innerHTML=`<option value="auto">Auto (classe)</option>`+Object.entries(FIG).map(([k,v])=>`<option value="${k}"${S.figPick===k?' selected':''}>${k} · ${v}</option>`).join('');
}
export function setTool(t){
  S.tool=t;S.drawFrom=null;clearF();drawHist.length=0;S.hov=S.hovSeg=S.hovObj=null;
  if(t!=='select'&&S.view==='3d')setView('2d');
  document.querySelectorAll('#tools [data-t]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===t));
  $('#dbar').hidden=t!=='pipe';buildPalette();cv.style.cursor='';hudShow();hint();draw2D();if(S.D)renderSide();
}
export function hint(){
  const t={select:'Click: select · hover: spec, projections and angle · drag: pan · Del: delete',
    pipe:S.drawFrom?'Click or Enter: confirm · Tab: next field · M: projections/angle · ⌫: undo last · Esc: finish'
      :'Click a node, a line (branch start) or a grid point · P: plane · M: projections or angle',
    erase:'Click a segment, component or node to delete it'};
  const pt=placeType();
  $('#hint').textContent=pt?`Click a segment to place: ${CAT[pt].n.toLowerCase()} (spec taken from the segment)`:t[S.tool];
}
export function delSel(){if(!S.sel)return;const h=S.sel;commit(()=>{eraseObj(h);S.sel=null;});}
const npsOpts=v=>NPS.map((n,i)=>`<option value="${i}"${i===v?' selected':''}>${S.M.meta.unit==='dn'?`DN${n.dn} · ${n.n}`:`${n.n} · DN${n.dn}`}</option>`).join('');
const schOpts=(i,v)=>SCHS.filter(s=>WT[i][s]!=null).map(s=>`<option value="${s}"${s===v?' selected':''}>${schL(s)} · ${fmt(WT[i][s],2)} mm</option>`).join('');
const clsOpts=v=>Object.entries(CLS).map(([k,l])=>`<option value="${k}"${k===String(v)?' selected':''}>${l}</option>`).join('');
const matOpts=v=>Object.entries(MAT).map(([k,o])=>`<option value="${k}"${k===v?' selected':''}>${o.n}</option>`).join('');
const r1=v=>Math.round(v*10)/10;
function specFields(s,pre){
  return `<label class="f"><span>Size</span><select data-f="${pre}nps">${npsOpts(s.nps)}</select></label>
  <label class="f"><span>Schedule</span><select data-f="${pre}sch">${schOpts(s.nps,schOf(s))}</select></label>
  <label class="f"><span>Pressure class</span><select data-f="${pre}cls">${clsOpts(s.cls)}</select></label>
  <label class="f"><span>Material</span><select data-f="${pre}mat">${matOpts(s.mat)}</select></label>`;
}
function selHTML(){
  if(!S.sel)return '<p class="mute">Click a segment, component or node (Select tool, V key) to edit it.</p>';
  const d3=R_().d3;
  if(S.sel.k==='seg'){
    const s=S.D.SM.get(S.sel.id),d=segDir(s),R=segR(s),n=skLen(s),vert=Math.abs(d[2])>.9999,at=angTxt(R);
    const az=vert?'':r1(azOf(d)),inc=r1(deg(Math.asin(clamp(d[2],-1,1)))),t=wtOf(s);
    return `<div class="kv"><span>Segment</span><b>#${s.id}</b><span>Direction</span><b>${esc(dirWords(d))}</b>${at?`<span>Angles</span><b>${at}</b>`:''}<span>WT / ID</span><b>${fmt(t,2)} / ${fmt(NPS[s.nps].od-2*t,1)} mm</b><span>Weight / volume</span><b>${fmt(kgm(s),1)} kg/m · ${fmt(lpm(s),1)} L/m</b></div>
    ${schOf(s)!==s.sch?`<p class="warn">${schL(s.sch)} does not exist in ${nm(s.nps)}: ${schL(schOf(s))} used.</p>`:''}
    <h3>Actual projections (mm)</h3>
    <div class="p3i"><label>Δ ${d3[0]}<input data-f="pE" type="number" step="any" inputmode="decimal" value="${Math.round(R[0])}"></label><label>Δ ${d3[1]}<input data-f="pN" type="number" step="any" inputmode="decimal" value="${Math.round(R[1])}"></label><label>Δ ${d3[2]}<input data-f="pZ" type="number" step="any" inputmode="decimal" value="${Math.round(R[2])}"></label></div>
    <div class="f"><span>${S.M.meta.ref==='ship'?'Bearing':'Azimuth'} / inclination<small>in degrees</small></span><span class="u2"><input data-f="saz" type="number" step="any" value="${az}" placeholder="—" aria-label="Azimuth"><input data-f="sinc" type="number" step="any" min="-90" max="90" value="${inc}" aria-label="Inclination"></span></div>
    <label class="f"><span>Actual length</span><span class="u"><input data-f="L" type="number" min="1" step="1" inputmode="numeric" placeholder="${Math.round(n*S.M.meta.scale)} auto" value="${s.L??''}"><i>mm</i></span></label>
    <h3>Line spec</h3>${specFields(s,'s')}
    <div class="row"><button data-a="specline" title="Copies size, schedule, class and material through elbows, up to tees and reducers">Spec up to tees</button><button data-a="specall" title="Copies the spec to the whole connected network">Spec to whole network</button></div>
    <div class="row"><button data-a="from">Draw from here</button><button data-a="del" class="danger">Delete</button></div>`;
  }
  if(S.sel.k==='comp'){
    const c=S.M.comps.find(c=>c.id===S.sel.id),s=S.D.SM.get(c.seg),k=CAT[c.type];
    const opts=Object.entries(FAM).map(([f,fn])=>`<optgroup label="${fn}">${Object.entries(CAT).filter(([,v])=>v.f===f).map(([kk,v])=>`<option value="${kk}"${kk===c.type?' selected':''}>${esc(v.n)}</option>`).join('')}</optgroup>`).join('');
    return `<div class="kv"><span>${FAM[k.f]}</span><b>#${c.id}</b><span>Segment</span><b>#${s.id} · ${nm(s.nps)} ${CLS[s.cls]}</b><span>Position</span><b>${fmt(Math.round(segLen(s)*c.t))} mm from origin</b></div>
    <p class="mute">${esc(compDes(c))}${k.s?` · ${esc(k.s)}`:''}</p>
    <label class="f"><span>Type</span><select data-f="ctype">${opts}</select></label>
    ${c.type==='hu'||c.type==='plug'?`<label class="f"><span>WECO figure</span><select data-f="cfig"><option value="auto"${c.fig==='auto'?' selected':''}>Auto (${figOf({fig:'auto'},s)})</option>${Object.entries(FIG).map(([kk,v])=>`<option value="${kk}"${c.fig===kk?' selected':''}>${kk} · ${v}</option>`).join('')}</select></label>`:''}
    <label class="f"><span>Position ${Math.round(c.t*100)} %</span><input data-f="ct" type="range" min="5" max="95" step="1" value="${Math.round(c.t*100)}"></label>
    <div class="row">${c.type==='check'||c.type==='dcheck'?'<button data-a="flip">Reverse flow</button>':''}<button data-a="del" class="danger">Delete</button></div>`;
  }
  const f=S.D.fit.get(S.sel.id),p=S.D.pos.get(S.sel.id),n=nd(S.sel.id);
  return `<div class="kv"><span>Node</span><b>#${S.sel.id}</b><span>Fitting</span><b>${fitName(f)}</b><span>${d3[0]}</span><b>${fmt(Math.round(p[0]))} mm</b><span>${d3[1]}</span><b>${fmt(Math.round(p[1]))} mm</b><span>Elevation</span><b>EL ${fmt(Math.round(p[2]))} mm</b></div>
  ${f.type==='bout'?`<label class="f"><span>Termination</span><select data-f="nend">${Object.entries(ENDS).map(([k,v])=>`<option value="${k}"${(n.end||'')===k?' selected':''}>${v}</option>`).join('')}</select></label>${n.end==='hucap'?`<label class="f"><span>WECO figure</span><select data-f="nfig"><option value="">Auto</option>${Object.entries(FIG).map(([k,v])=>`<option value="${k}"${n.fig===k?' selected':''}>${k} · ${v}</option>`).join('')}</select></label>`:''}`:''}
  <div class="row"><button data-a="from">Draw from this node</button><button data-a="del" class="danger">Delete connected segments</button></div>`;
}
export function renderSide(){
  const m=S.M.meta;
  $('#sideDyn').innerHTML=`<section><h2>Selection</h2>${selHTML()}</section>
  <section><h2>Settings</h2>
  <div class="f"><span>Reference frame</span><div class="seg sm" role="group"><button data-a="ref" data-val="geo" aria-pressed="${m.ref==='geo'}">N/E</button><button data-a="ref" data-val="ship" aria-pressed="${m.ref==='ship'}">FWD/SB</button></div></div>
  <div class="f"><span>Sizes</span><div class="seg sm" role="group"><button data-a="unit" data-val="in" aria-pressed="${m.unit==='in'}">Inch</button><button data-a="unit" data-val="dn" aria-pressed="${m.unit==='dn'}">DN</button></div></div>
  <h3>Default spec for new segments</h3>${specFields({nps:m.dn,sch:m.sch,cls:m.cls,mat:m.mat},'m')}
  <label class="f"><span>1 grid cell</span><span class="u"><input data-f="scale" type="number" min="10" step="10" inputmode="numeric" value="${m.scale}"><i>mm</i></span></label>
  <div class="chk"><label><input type="checkbox" data-f="dims"${m.dims?' checked':''}>Dimensions, projections and angles</label><label><input type="checkbox" data-f="els"${m.els?' checked':''}>Elevations</label></div></section>
  <section><h2>Bill of materials (MTO)</h2>${bomHTML()}</section>`;
}
const side=$('#sideDyn');
let rangeSnap=null;
const cartF={mProjet:'projet',mLigne:'ligne',mFluide:'fluide',mRev:'rev'};
export function fillCart(){for(const [id,k] of Object.entries(cartF))$('#'+id).value=S.M.meta[k]||'';}
export function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('on');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('on'),2800);}

export function initPanels(){
$('#pal').addEventListener('click',e=>{const b=e.target.closest('[data-ct]');if(!b||!FAM[S.tool])return;famSel[S.tool]=b.dataset.ct;buildPalette();hint();b.blur();});
$('#figSel').addEventListener('change',e=>{S.figPick=e.target.value;e.target.blur();});
$('#tools').addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(b){setTool(b.dataset.t);b.blur();}});
side.addEventListener('input',e=>{
  if(e.target.dataset.f!=='ct'||!S.sel)return;
  if(!rangeSnap)rangeSnap=JSON.stringify(S.M);
  const c=S.M.comps.find(c=>c.id===S.sel.id);c.t=+e.target.value/100;
  const lb=e.target.parentElement.querySelector('span');if(lb)lb.textContent=`Position ${e.target.value} %`;draw2D();
});
side.addEventListener('change',e=>{
  const f=e.target.dataset.f,v=e.target.value;if(!f)return;
  const seg=()=>S.D.SM.get(S.sel.id),comp=()=>S.M.comps.find(c=>c.id===S.sel.id),q=n=>+(side.querySelector(`[data-f="${n}"]`).value||0);
  switch(f){
    case 'mnps':S.M.meta.dn=+v;persist();renderSide();break;
    case 'msch':S.M.meta.sch=v;persist();break;
    case 'mcls':S.M.meta.cls=v;persist();break;
    case 'mmat':S.M.meta.mat=v;persist();break;
    case 'scale':{const x=Math.round(+v);if(x>0)commit(()=>{S.M.meta.scale=x;});else renderSide();break;}
    case 'dims':case 'els':S.M.meta[f]=e.target.checked;persist();draw2D();break;
    case 'L':{const x=Math.round(+v);commit(()=>{seg().L=v===''||!(x>0)?null:x;});break;}
    case 'snps':commit(()=>{seg().nps=+v;});break;
    case 'ssch':commit(()=>{seg().sch=v;});break;
    case 'scls':commit(()=>{seg().cls=v;});break;
    case 'smat':commit(()=>{seg().mat=v;});break;
    case 'pE':case 'pN':case 'pZ':{
      const s=seg(),R=[q('pE'),q('pN'),q('pZ')],Lr=len3(R);
      if(!R.every(Number.isFinite)||Lr<1){toast('Zero projections: segment unchanged');renderSide();break;}
      const nd2=clean(R.map(c=>c/Lr)),same=dot3(nd2,segDir(s))>.999999;
      if(!same&&!canRedirect(s)){toast('This segment is part of a closed loop: direction cannot change');renderSide();break;}
      commit(()=>{if(!same)redirect(s,nd2);s.L=Math.round(Lr);});
      toast(`Length ${fmt(Math.round(Lr))} mm${angTxt(R)?' · '+angTxt(R).split(' · ')[0]:''}`);break;
    }
    case 'saz':case 'sinc':{
      const s=seg(),az=q('saz'),inc=q('sinc');
      if(!Number.isFinite(az)||!Number.isFinite(inc)){renderSide();break;}
      if(!canRedirect(s)){toast('This segment is part of a closed loop: angle cannot change');renderSide();break;}
      commit(()=>redirect(s,dirAI(az,inc)));break;
    }
    case 'ctype':commit(()=>{comp().type=v;});break;
    case 'cfig':commit(()=>{comp().fig=v;});break;
    case 'nend':commit(()=>{const n=nd(S.sel.id);if(v)n.end=v;else delete n.end;});break;
    case 'nfig':commit(()=>{const n=nd(S.sel.id);if(v)n.fig=v;else delete n.fig;});break;
    case 'ct':if(rangeSnap){U.push(rangeSnap);RD.length=0;rangeSnap=null;}changed();break;
  }
});
side.addEventListener('click',e=>{
  const b=e.target.closest('[data-a]');if(!b)return;const a=b.dataset.a;
  if(a==='del')delSel();
  else if(a==='ref'){S.M.meta.ref=b.dataset.val;persist();applyRef();changed();buildPalette();}
  else if(a==='unit'){S.M.meta.unit=b.dataset.val;persist();changed();}
  else if(a==='from'){const pt=S.sel.k==='node'?nd(S.sel.id):nd(S.D.SM.get(S.sel.id).b);setTool('pipe');startDraw(pt);}
  else if(a==='flip')commit(()=>{const c=S.M.comps.find(c=>c.id===S.sel.id);c.rev=!c.rev;});
  else if(a==='specline'||a==='specall'){
    const s0=S.D.SM.get(S.sel.id),sp={nps:s0.nps,sch:s0.sch,cls:s0.cls,mat:s0.mat};
    commit(()=>{
      const seen=new Set([s0.id]),q=[s0];
      while(q.length){const s=q.pop();Object.assign(s,sp);for(const id of [s.a,s.b]){const f=S.D.fit.get(id);if(a==='specline'&&f.type!=='coude'&&f.type!=='droit')continue;for(const t of f.segs)if(!seen.has(t.id)){seen.add(t.id);q.push(t);}}}
    });
  }
  else if(a==='bomcopy')navigator.clipboard.writeText(table('\t')).then(()=>toast('MTO copied (tab-separated, paste into a spreadsheet)')).catch(()=>toast('Copy refused by the browser'));
  else if(a==='bomcsv')saveFile(fname()+'-MTO.csv',csv());
});
for(const [id,k] of Object.entries(cartF))$('#'+id).addEventListener('input',e=>{S.M.meta[k]=e.target.value;persist();});
$('#cartT').onclick=()=>{const c=$('#cart');c.classList.toggle('min');$('#cartT').setAttribute('aria-expanded',!c.classList.contains('min'));};
}

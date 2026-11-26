/** Header buttons (new, open, save, PNG, undo/redo) and global keyboard shortcuts. */
import { changed, pushUndo, redo, undo } from '../core/history.js';
import { blank, normalize } from '../core/model.js';
import { CONSK } from '../data/frames.js';
import { F, S, drawHist } from '../state.js';
import { $ } from './dom.js';
import { anyF, applyRef, clearF, consName, fields, hudBuild, hudShow, hudSync, hudUpdate, setCons, setEntry } from './hud.js';
import { delSel, fillCart, hint, refreshSel, setTool, toast } from './panels.js';
import { exportPNG, fname, saveFile } from './sheet.js';
import { commitPreview, draw2D, endDraw, fit2D } from './sketch.js';
import { generate, mark3D, setView } from '../view3d/scene.js';
import { platform } from '../platform/index.js';

/** Header buttons (files, undo/redo) and global keyboard shortcuts. */
export function initActions(){
addEventListener('keydown',e=>{
  if(e.target.closest&&e.target.closest('input,select,textarea'))return;
  const k=e.key,kl=k.toLowerCase();
  if((e.ctrlKey||e.metaKey)&&kl==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
  if((e.ctrlKey||e.metaKey)&&kl==='y'){e.preventDefault();redo();return;}
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(S.drawFrom){
    const fl=fields();if(!fl.includes(S.fld))S.fld=fl[0];
    if(/^[0-9.,]$/.test(k)||(k==='-'&&!F[S.fld])){e.preventDefault();F[S.fld]=(F[S.fld]+(k===','?'.':k)).slice(0,9);hudSync();draw2D();return;}
    if(k==='Tab'){e.preventDefault();S.fld=fl[(fl.indexOf(S.fld)+(e.shiftKey?fl.length-1:1))%fl.length];hudSync();return;}
    if(k==='Backspace'){
      e.preventDefault();
      if(F[S.fld])F[S.fld]=F[S.fld].slice(0,-1);
      else if(anyF()){const f=fl.find(x=>F[x]);if(f)F[f]=F[f].slice(0,-1);}
      else if(drawHist.length){const f=drawHist.pop(),h=[...drawHist];if(undo()){S.drawFrom=f;drawHist.push(...h);hudShow();hudBuild();hint();}}
      hudSync();draw2D();return;
    }
    if(k==='Enter'){e.preventDefault();if(anyF())commitPreview();else endDraw();return;}
    if(kl==='m'&&S.cons!=='ortho'){setEntry(S.entry==='XY'?'LA':'XY');toast(S.entry==='XY'?'Entry by projections':'Entry by angle');return;}
  }
  if(k==='Escape'){if(anyF()){clearF();hudSync();draw2D();}else if(S.drawFrom)endDraw();else if(S.sel){S.sel=null;refreshSel();}return;}
  if(k==='Delete'||k==='Backspace'){if(S.sel){e.preventDefault();delSel();}return;}
  if(kl==='p'){setCons(CONSK[(CONSK.indexOf(S.cons)+1)%CONSK.length]);toast('Plane: '+consName(S.cons));return;}
  if(kl==='m'){if(S.cons==='ortho'){setCons('H');setEntry('XY');}else setEntry(S.entry==='XY'?'LA':'XY');toast(S.entry==='XY'?'Entry by projections · plane '+consName(S.cons):'Entry by angle');return;}
  if(kl==='a'){const ss=[45,30,15,5,1];S.step=ss[(ss.indexOf(S.step)+1)%ss.length];$('#stepSel').value=S.step;if(S.cons==='ortho')setCons('H');if(S.entry==='XY')setEntry('LA');hudUpdate();draw2D();toast('Entry by angle · step '+S.step+'°');return;}
  const map={v:'select',s:'select',t:'pipe','1':'v','2':'r','3':'i','4':'s',x:'erase',e:'erase'};
  if(map[kl]){setTool(map[kl]);return;}
  if(kl==='f')fit2D();
  if(kl==='g'){if(S.view==='3d')setView('2d');else generate();}
});
$('#bSave').onclick=()=>saveFile(fname()+'.json',JSON.stringify(S.M,null,1));
$('#bOpen').onclick=async()=>{
  const f=await platform.openProject();if(!f)return;
  try{const m=normalize(JSON.parse(f.text));pushUndo();S.M=m;S.sel=null;S.drawFrom=null;applyRef();changed();fillCart();fit2D();if(S.G3)S.G3.fitted=false;mark3D();toast('File opened: '+f.name);}catch(err){toast('File not recognised (Iso Piping JSON expected)');}
};
$('#bPng').onclick=exportPNG;
$('#bNew').onclick=()=>{pushUndo();S.M=blank({...S.M.meta,projet:'',ligne:'',fluide:'',rev:'A'});S.sel=null;S.drawFrom=null;changed();fillCart();fit2D();if(S.G3)S.G3.fitted=false;setTool('pipe');toast('Blank sheet · Ctrl+Z to go back');};
$('#bUndo').onclick=undo;
$('#bRedo').onclick=redo;
}

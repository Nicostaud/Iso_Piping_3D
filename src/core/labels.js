/** Labels that depend on the model settings: frame axes, size names, component designations, angle / projection texts. */
import { fa, fmt } from './format.js';
import { DV, axisAligned, az3, azOf, clamp, deg, dot3 } from './geom.js';
import { CLS, face } from '../data/bolting.js';
import { CAT, FIG, figOf, valveOp } from '../data/catalogue.js';
import { REF } from '../data/frames.js';
import { MAT } from '../data/materials.js';
import { NPS, schL, schOf } from '../data/pipe.js';
import { S } from '../state.js';

export const R_=()=>REF[S.M.meta.ref]||REF.geo;
export const axn=i=>R_().ax[i],sgn=(i,pos)=>R_().sg[i][pos?0:1];
export const nm=i=>S.M.meta.unit==='dn'?'DN'+NPS[i].dn:NPS[i].n;
export const nm2=i=>S.M.meta.unit==='dn'?`DN${NPS[i].dn} (${NPS[i].n})`:`${NPS[i].n} (DN${NPS[i].dn})`;
const specTxt=s=>`${nm(s.nps)} ${schL(schOf(s))} · ${CLS[s.cls]} · ${MAT[s.mat].n}`;
export function compDes(c){
  const s=S.D.SM.get(c.seg),k=CAT[c.type],z=`${nm(s.nps)} ${CLS[s.cls]}`;
  if(k.f==='v'){
    if(c.type==='plug')return `${k.n} ${nm(s.nps)} Fig ${figOf(c,s)} (${FIG[figOf(c,s)]})`;
    if(c.type==='needle')return `${k.n} ${nm(s.nps)} NPT`;
    const op=valveOp(c,s);return `${k.n} ${z} ${face(s.cls)}${op?' · '+op:''}`;
  }
  if(c.type==='hu')return `Hammer union ${nm(s.nps)} Fig ${figOf(c,s)} (${FIG[figOf(c,s)]})`;
  if(c.type==='spec'||c.type==='ystr')return `${k.n} ${z} ${face(s.cls)}`;
  if(c.type==='flange')return `Flange joint ${z} ${face(s.cls)}`;
  if(k.f==='s')return `${k.n} for ${nm(s.nps)}`;
  return `${k.n} ${nm(s.nps)}`;
}
export function dirWords(d){
  if(axisAligned(d)){const i=DV.findIndex(o=>dot3(o.v,d)>.999);if(i>=0)return R_().dir[i];}
  const inc=deg(Math.asin(clamp(d[2],-1,1)));
  return `${R_().az} ${az3(azOf(d))}° · incl. ${inc>=0?'+':'−'}${fa(Math.abs(inc))}°`;
}
export function angTxt(R){
  const nz=[0,1,2].filter(i=>Math.abs(R[i])>.5);if(nz.length!==2)return '';
  const [i1,i2]=nz,g=deg(Math.atan2(Math.abs(R[i2]),Math.abs(R[i1])));
  return i2===2?`slope ${fa(g)}° ${R[2]>0?'rising':'falling'} · ${fa(90-g)}° / vertical`:`${fa(g)}° / ${axn(0)} · ${fa(90-g)}° / ${axn(1)}`;
}
export const projTxt=R=>[0,1,2].filter(i=>Math.abs(R[i])>.5).map(i=>`${fmt(Math.round(Math.abs(R[i])))} ${sgn(i,R[i]>0)}`).join(' · ');

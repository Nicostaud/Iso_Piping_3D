/** Piping model: nodes, segments, components; editing, topology (derive), normalize() and the built-in sample. */
import { fa } from './format.js';
import { EPS, axisAligned, clamp, deg, dot3, len3, r4, vsub } from './geom.js';
import { CLS } from '../data/bolting.js';
import { CAT, ENDS, FIG } from '../data/catalogue.js';
import { REF } from '../data/frames.js';
import { MAT } from '../data/materials.js';
import { NPS, OLDNPS, SCHS } from '../data/pipe.js';
import { S } from '../state.js';

export const DEFMETA={projet:'',ligne:'',fluide:'',rev:'A',scale:1000,dn:8,sch:'40',cls:'150',mat:'A106B',ref:'geo',unit:'in',dims:true,els:false};
export const blank=meta=>({v:4,nid:1,nodes:[],segs:[],comps:[],meta:Object.assign({},DEFMETA,meta||{})});
export const nd=id=>S.NM.get(id);
export const other=(s,id)=>s.a===id?s.b:s.a;
export const skLen=s=>len3(vsub(nd(s.b),nd(s.a)));
export const segLen=s=>s.L??skLen(s)*S.M.meta.scale;
export function dirOf(s,from){const v=vsub(nd(other(s,from)),nd(from)),l=len3(v)||1;return [v[0]/l,v[1]/l,v[2]/l];}
export const segDir=s=>dirOf(s,s.a);
export const segR=s=>{const d=segDir(s),L=segLen(s);return d.map(c=>c*L);};
export const skFor=(dir,L)=>axisAligned(dir)?Math.max(1,Math.round(L/S.M.meta.scale)):Math.max(2,L/S.M.meta.scale);
function addNode(x,y,z){const n={id:S.M.nid++,x:r4(x),y:r4(y),z:r4(z)};S.M.nodes.push(n);S.NM.set(n.id,n);return n;}
export const findNode=(x,y,z)=>S.M.nodes.find(n=>Math.abs(n.x-x)+Math.abs(n.y-y)+Math.abs(n.z-z)<EPS);
const newSeg=(a,b,L)=>({id:S.M.nid++,a,b,nps:S.M.meta.dn,sch:S.M.meta.sch,cls:S.M.meta.cls,mat:S.M.meta.mat,L});
export function interiorT(s,x,y,z){
  const a=nd(s.a),ab=vsub(nd(s.b),a),L2=dot3(ab,ab);if(!L2)return null;
  const ap=[x-a.x,y-a.y,z-a.z],t=dot3(ap,ab)/L2,L=Math.sqrt(L2);
  if(t*L<EPS||(1-t)*L<EPS)return null;
  return len3([ap[0]-ab[0]*t,ap[1]-ab[1]*t,ap[2]-ab[2]*t])<EPS?t:null;
}
function splitSeg(s,f,x,y,z){
  const m=addNode(x,y,z),s2={...s,id:S.M.nid++,a:m.id,b:s.b,L:null};
  if(s.L!=null){const l1=Math.round(s.L*f);s2.L=Math.max(1,s.L-l1);s.L=Math.max(1,l1);}
  s.b=m.id;S.M.segs.push(s2);
  for(const c of S.M.comps)if(c.seg===s.id){if(c.t>f){c.seg=s2.id;c.t=(c.t-f)/(1-f);}else c.t=c.t/f;}
  return m;
}
function ensureNode(x,y,z){
  const n=findNode(x,y,z);if(n)return n;
  for(const s of S.M.segs){const t=interiorT(s,x,y,z);if(t!=null)return splitSeg(s,t,x,y,z);}
  return addNode(x,y,z);
}
export function addRun(st,dir,len,L){
  const A=ensureNode(st.x,st.y,st.z),B=ensureNode(st.x+dir[0]*len,st.y+dir[1]*len,st.z+dir[2]*len);
  if(A===B)return {end:B,seg:null};
  const ab=vsub(B,A),Lab=len3(ab),u=ab.map(c=>c/Lab),inner=[];
  for(const m of S.M.nodes){
    if(m===A||m===B)continue;const v=vsub(m,A),t=dot3(v,u);
    if(t<EPS||t>Lab-EPS)continue;
    if(len3([v[0]-u[0]*t,v[1]-u[1]*t,v[2]-u[2]*t])<EPS)inner.push([t,m]);
  }
  inner.sort((a,b)=>a[0]-b[0]);
  const chain=[[0,A],...inner,[Lab,B]];let first=null;
  for(let i=1;i<chain.length;i++){
    const p=chain[i-1][1],q=chain[i][1];
    if(S.M.segs.some(s=>(s.a===p.id&&s.b===q.id)||(s.a===q.id&&s.b===p.id)))continue;
    const s=newSeg(p.id,q.id,L!=null?Math.max(1,Math.round(L*(chain[i][0]-chain[i-1][0])/Lab)):null);
    S.M.segs.push(s);first=first||s;
  }
  delete A.end;
  return {end:B,seg:first};
}
function prune(){const u=new Set();for(const s of S.M.segs){u.add(s.a);u.add(s.b);}S.M.nodes=S.M.nodes.filter(n=>u.has(n.id));}
function delSeg(id){S.M.segs=S.M.segs.filter(s=>s.id!==id);S.M.comps=S.M.comps.filter(c=>c.seg!==id);prune();}
export function eraseObj(h){
  if(h.k==='comp')S.M.comps=S.M.comps.filter(c=>c.id!==h.id);
  else if(h.k==='seg')delSeg(h.id);
  else if(h.k==='node')for(const s of S.M.segs.filter(s=>s.a===h.id||s.b===h.id))delSeg(s.id);
}
function reach(start,skip){
  const seen=new Set([start]),q=[start];
  while(q.length){const id=q.pop();for(const s of S.D.adj.get(id)){if(s.id===skip)continue;const o=other(s,id);if(!seen.has(o)){seen.add(o);q.push(o);}}}
  return seen;
}
export const canRedirect=s=>!reach(s.b,s.id).has(s.a);
export function redirect(s,dir){
  const len=skLen(s),sa=reach(s.a,s.id),sb=reach(s.b,s.id),A=nd(s.a),B=nd(s.b);
  let ids,dl;
  if(sb.size<=sa.size){ids=sb;dl=[A.x+dir[0]*len-B.x,A.y+dir[1]*len-B.y,A.z+dir[2]*len-B.z];}
  else{ids=sa;dl=[B.x-dir[0]*len-A.x,B.y-dir[1]*len-A.y,B.z-dir[2]*len-A.z];}
  for(const id of ids){const n=nd(id);n.x=r4(n.x+dl[0]);n.y=r4(n.y+dl[1]);n.z=r4(n.z+dl[2]);}
}
export function derive(){
  S.NM=new Map(S.M.nodes.map(n=>[n.id,n]));
  const SM=new Map(S.M.segs.map(s=>[s.id,s])),adj=new Map(S.M.nodes.map(n=>[n.id,[]]));
  for(const s of S.M.segs){adj.get(s.a).push(s);adj.get(s.b).push(s);}
  const pos=new Map(),seen=new Set(),sc=S.M.meta.scale;let loop=false;
  for(const r of S.M.nodes){
    if(pos.has(r.id))continue;
    pos.set(r.id,[r.x*sc,r.y*sc,r.z*sc]);const q=[r.id];
    while(q.length){
      const id=q.shift(),p=pos.get(id);
      for(const s of adj.get(id)){
        if(seen.has(s.id))continue;seen.add(s.id);
        const o=other(s,id),d=dirOf(s,id),L=segLen(s),np=[p[0]+d[0]*L,p[1]+d[1]*L,p[2]+d[2]*L];
        if(pos.has(o)){const e=pos.get(o);if(Math.abs(e[0]-np[0])+Math.abs(e[1]-np[1])+Math.abs(e[2]-np[2])>2)loop=true;}
        else{pos.set(o,np);q.push(o);}
      }
    }
  }
  const fit=new Map();
  for(const n of S.M.nodes){
    const ss=adj.get(n.id),f={type:'libre',segs:ss,ang:null};
    if(ss.length===1)f.type='bout';
    else if(ss.length===2){
      const a=dirOf(ss[0],n.id),b=dirOf(ss[1],n.id),defl=deg(Math.acos(clamp(-dot3(a,b),-1,1)));
      if(defl<.5)f.type=ss[0].nps!==ss[1].nps?'reduc':'droit';else{f.type='coude';f.ang=defl;}
    }else if(ss.length>=3){
      f.type=ss.length===3?'te':'croix';
      const ds=ss.map(s=>dirOf(s,n.id));
      outer:for(let i=0;i<ds.length;i++)for(let j=i+1;j<ds.length;j++)if(dot3(ds[i],ds[j])<-.999){
        const k=[0,1,2].find(x=>x!==i&&x!==j);if(ss.length===3)f.ang=deg(Math.acos(Math.abs(dot3(ds[i],ds[k]))));f.run=[i,j];break outer;}
    }
    fit.set(n.id,f);
  }
  S.D={SM,adj,pos,fit,loop};
}
export const fitName=f=>f.type==='coude'?`Elbow ${fa(f.ang)}°`:f.type==='te'?(f.ang!=null&&Math.abs(f.ang-90)>.5?`Branch ${fa(f.ang)}°`:'Tee'):{croix:'Cross',reduc:'Reducer',droit:'Straight run',bout:'Open end',libre:'Isolated node'}[f.type];
export function normalize(o){
  if(!o||typeof o!=='object'||!Array.isArray(o.nodes))throw new Error('format');
  const old=!(o.v>=4),I=v=>Number.isFinite(+v)?Math.round(+v):0,Fl=v=>Number.isFinite(+v)?r4(+v):0,m=blank(),om=o.meta||{};
  const mapN=v=>{v=I(v);if(old)return OLDNPS[v]??8;return NPS[v]?v:8;};
  for(const k of ['projet','ligne','fluide','rev'])if(om[k]!=null)m.meta[k]=String(om[k]).slice(0,80);
  if(+om.scale>0)m.meta.scale=Math.round(+om.scale);
  if(om.dn!=null)m.meta.dn=mapN(om.dn);
  if(SCHS.includes(String(om.sch)))m.meta.sch=String(om.sch);
  if(CLS[om.cls])m.meta.cls=String(om.cls);
  if(MAT[om.mat])m.meta.mat=om.mat;
  if(REF[om.ref])m.meta.ref=om.ref;
  if(om.unit==='dn'||om.unit==='in')m.meta.unit=om.unit;
  m.meta.dims=om.dims!==false;m.meta.els=!!om.els;
  m.nodes=o.nodes.map(n=>{const x={id:I(n.id),x:Fl(n.x),y:Fl(n.y),z:Fl(n.z)};if(ENDS[n.end]&&n.end)x.end=n.end;if(n.fig&&FIG[n.fig])x.fig=n.fig;return x;});
  const nmap=new Map(m.nodes.map(n=>[n.id,n]));
  m.segs=(o.segs||[]).filter(s=>{const a=nmap.get(+s.a),b=nmap.get(+s.b);return a&&b&&a!==b&&len3(vsub(a,b))>EPS;})
    .map(s=>({id:I(s.id),a:+s.a,b:+s.b,nps:mapN(s.nps),sch:SCHS.includes(String(s.sch))?String(s.sch):m.meta.sch,cls:CLS[s.cls]?String(s.cls):m.meta.cls,mat:MAT[s.mat]?s.mat:m.meta.mat,L:+s.L>0?Math.round(+s.L):null}));
  const sid=new Set(m.segs.map(s=>s.id));
  m.comps=(o.comps||[]).filter(c=>sid.has(+c.seg)&&CAT[c.type]).map(c=>({id:I(c.id),seg:+c.seg,t:clamp(+c.t||.5,.02,.98),type:c.type,rev:!!c.rev,fig:FIG[c.fig]?c.fig:'auto'}));
  m.nid=Math.max(0,...m.nodes.map(n=>n.id),...m.segs.map(s=>s.id),...m.comps.map(c=>c.id))+1;
  const used=new Set();m.segs.forEach(s=>{used.add(s.a);used.add(s.b);});m.nodes=m.nodes.filter(n=>used.has(n.id));
  return m;
}
export function sample(){
  S.M=blank({projet:'Example — seawater + kill line',ligne:'6"-SW-2001-D1',fluide:'Seawater / mud',ref:'ship'});S.NM=new Map();
  let p={x:0,y:0,z:0};
  const run=(d,n,L)=>{const r=addRun(p,d,n,L);p=r.end;return r.seg;};
  const cp=(s,t,type,fig)=>S.M.comps.push({id:S.M.nid++,seg:s.id,t,type,rev:false,fig:fig||'auto'});
  const E=[1,0,0],W=[-1,0,0],N=[0,1,0],Up=[0,0,1],Dn=[0,0,-1];
  Object.assign(S.M.meta,{dn:10,sch:'40',cls:'150',mat:'DSS'});
  const s1=run(E,4,3600);cp(s1,.12,'flange');cp(s1,.35,'ystr');cp(s1,.6,'bfly');cp(s1,.85,'dcheck');
  const s2=run(Up,3);cp(s2,.25,'anchor');cp(s2,.6,'pg');
  run(N,2);const o1=run([.8,.6,0],2.5,2500);cp(o1,.5,'hanger');
  run(N,1.5);const s4=run(E,2);cp(s4,.3,'shoe');cp(s4,.7,'spec');const s5=run(Dn,3);cp(s5,.85,'flange');
  Object.assign(S.M.meta,{dn:5,sch:'80',cls:'150',mat:'DSS'});
  p={x:4,y:1,z:3};const b1=run(W,3);cp(b1,.25,'guide');cp(b1,.6,'ball');const be=p;
  Object.assign(S.M.meta,{dn:7,sch:'XXS',cls:'A15',mat:'A333'});
  p={x:-5,y:-4,z:0};const k1=run(N,3);cp(k1,.15,'hu');cp(k1,.45,'plug');cp(k1,.75,'hu');
  run(Up,2);const k3=run(E,2.5);cp(k3,.35,'pg');cp(k3,.7,'choke');const ke=p;
  Object.assign(S.M.meta,{dn:8,sch:'40',cls:'150',mat:'A106B'});
  S.NM.get(be.id).end='blind';S.NM.get(ke.id).end='hucap';
}
export function validSel(){
  if(!S.sel)return;
  const ok=S.sel.k==='seg'?S.D.SM.has(S.sel.id):S.sel.k==='node'?S.NM.has(S.sel.id):S.M.comps.some(c=>c.id===S.sel.id);
  if(!ok)S.sel=null;
}

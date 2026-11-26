/** 2D iso sheet: view transform, snapping, segment preview, canvas rendering and pointer interaction. */
import { fa, fmt } from '../core/format.js';
import { C30, DV, EPS, P, axisAligned, clamp, clean, deg, dirAI, dot3, len3, norm360, planeDir, r4, unit, vsub } from '../core/geom.js';
import { commit } from '../core/history.js';
import { R_, angTxt, compDes, nm, projTxt } from '../core/labels.js';
import { addRun, dirOf, eraseObj, findNode, interiorT, nd, other, segDir, segLen, segR, skFor, skLen } from '../core/model.js';
import { CLS } from '../data/bolting.js';
import { CAT, FAM, famSel } from '../data/catalogue.js';
import { AXES } from '../data/frames.js';
import { NPS, schL, schOf } from '../data/pipe.js';
import { F, S, V, drawHist } from '../state.js';
import { $ } from './dom.js';
import { anyF, clearF, hudBuild, hudShow, hudSync, hudUpdate, numF } from './hud.js';
import { hint, refreshSel, toast } from './panels.js';
import { theme } from './theme.js';

const toS=(x,y,z)=>{const p=P(x,y,z);return [V.ox+p[0]*V.s,V.oy+p[1]*V.s];};
const toSn=id=>{const n=nd(id);return toS(n.x,n.y,n.z);};
function latticeNear(sx,sy){
  const X=(sx-V.ox)/V.s,Y=(sy-V.oy)/V.s,xr=(X/C30+2*Y)/2,yr=(X/C30-2*Y)/2;let best=null;
  for(const u of [Math.floor(xr),Math.ceil(xr)])for(const v of [Math.floor(yr),Math.ceil(yr)]){
    const q=toS(u,v,0),d=(q[0]-sx)**2+(q[1]-sy)**2;if(!best||d<best.d)best={u,v,sx:q[0],sy:q[1],d};
  }
  return best;
}
function perp(s){
  const d=segDir(s),st=Math.abs(d[2])>.9?[1,0,0]:[0,0,1],k=dot3(st,d),o=[st[0]-d[0]*k,st[1]-d[1]*k,st[2]-d[2]*k];
  const ps=P(...o),pd=P(...d),u=unit(ps[0],ps[1]),ud=unit(pd[0],pd[1]);
  if(Math.abs(u[0]*ud[1]-u[1]*ud[0])<.25){const q=[-ud[1],ud[0]];return q[1]>0?[-q[0],-q[1]]:q;}
  return u;
}
function nearSeg(x,y,tol){
  let best=null;
  for(const s of S.M.segs){
    const a=toSn(s.a),b=toSn(s.b),dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy||1;
    const t=clamp(((x-a[0])*dx+(y-a[1])*dy)/l2,0,1),d=Math.hypot(a[0]+dx*t-x,a[1]+dy*t-y);
    if(d<tol&&(!best||d<best.d))best={s,t,d};
  }
  return best;
}
function hit(x,y){
  for(const c of S.M.comps){const s=S.D.SM.get(c.seg),a=toSn(s.a),b=toSn(s.b);if(Math.hypot(a[0]+(b[0]-a[0])*c.t-x,a[1]+(b[1]-a[1])*c.t-y)<12)return {k:'comp',id:c.id};}
  for(const n of S.M.nodes){const p=toS(n.x,n.y,n.z);if(Math.hypot(p[0]-x,p[1]-y)<7)return {k:'node',id:n.id};}
  const h=nearSeg(x,y,9);return h?{k:'seg',id:h.s.id}:null;
}
function pickStart(sx,sy){
  let best=null;
  for(const n of S.M.nodes){const p=toS(n.x,n.y,n.z),d=Math.hypot(p[0]-sx,p[1]-sy);if(d<10&&(!best||d<best.d-.5||(Math.abs(d-best.d)<=.5&&n.id>best.id)))best={d,id:n.id,pt:{x:n.x,y:n.y,z:n.z},sx:p[0],sy:p[1],kind:'node'};}
  if(best)return best;
  const h=nearSeg(sx,sy,8);
  if(h){
    const s=h.s,a=nd(s.a),L=skLen(s),dir=segDir(s);let d=Math.round(h.t*L*2)/2;
    if(d<=EPS||d>=L-EPS)d=h.t*L;
    if(d>EPS&&d<L-EPS){const pt={x:r4(a.x+dir[0]*d),y:r4(a.y+dir[1]*d),z:r4(a.z+dir[2]*d)},p=toS(pt.x,pt.y,pt.z);return {pt,sx:p[0],sy:p[1],kind:'seg'};}
  }
  const g=latticeNear(sx,sy);return {pt:{x:g.u,y:g.v,z:0},sx:g.sx,sy:g.sy,kind:'grid'};
}
function zoomAt(x,y,f){const ns=clamp(V.s*f,6,200);V.ox=x-(x-V.ox)*ns/V.s;V.oy=y-(y-V.oy)*ns/V.s;V.s=ns;draw2D();}
export function fitTo(W,H,x0=0,y0=0){
  if(!S.M.nodes.length){V.s=44;V.ox=x0+W/2;V.oy=y0+H/2;return;}
  let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;
  for(const n of S.M.nodes){const p=P(n.x,n.y,n.z);a=Math.min(a,p[0]);b=Math.min(b,p[1]);c=Math.max(c,p[0]);d=Math.max(d,p[1]);}
  const pad=Math.min(80,W*.12);
  V.s=clamp(Math.min((W-2*pad)/Math.max(1,c-a),(H-2*pad)/Math.max(1,d-b)),10,90);
  V.ox=x0+W/2-(a+c)/2*V.s;V.oy=y0+H/2-(b+d)/2*V.s;
}
export const fit2D=()=>{fitTo(S.W2,S.H2);draw2D();};
function mouseVec(){
  if(!S.mouse||!S.drawFrom)return null;
  const a=toS(S.drawFrom.x,S.drawFrom.y,S.drawFrom.z),dX=(S.mouse.x-a[0])/V.s,dY=(S.mouse.y-a[1])/V.s;
  if(Math.hypot(dX,dY)*V.s<5)return null;
  if(S.cons==='ortho'){let bd=-Infinity,di=0;DV.forEach((d,i)=>{const t=dX*d.s[0]+dY*d.s[1];if(t>bd){bd=t;di=i;}});return {di,n:Math.max(0,Math.round(bd))};}
  if(S.cons==='H'||S.cons==='R3'){const dx=(dX/C30+2*dY)/2,dy=(dX/C30-2*dY)/2;return {v:[dx,dy,0],raw:deg(Math.atan2(dx,dy))};}
  if(S.cons==='EO'){const dx=dX/C30,dz=.5*dx-dY;return {v:[dx,0,dz],raw:deg(Math.atan2(dz,dx))};}
  const dy=dX/C30,dz=-.5*dy-dY;return {v:[0,dy,dz],raw:deg(Math.atan2(dz,dy))};
}
export function preview(){
  if(!S.drawFrom)return null;
  const sc=S.M.meta.scale,mv=mouseVec();let dir=null,len=0,L=null,typed=false;const ph={};
  if(S.cons==='ortho'){
    const Lt=numF('L');
    if(mv){dir=DV[mv.di].v;if(Lt>0){len=skFor(dir,Lt);L=Lt;typed=true;}else len=mv.n;ph.L=mv.n*sc;}
  }else if(S.entry==='XY'){
    const R=[0,0,0];
    AXES[S.cons].forEach((ax,i)=>{
      const k='P'+i,t=numF(k),m=mv?mv.v[ax]*sc:0,mr=Math.round(m/50)*50;
      ph[k]=S.cons==='R3'&&ax===2?0:Math.abs(mr);
      if(t!=null){typed=true;R[ax]=/^\s*-/.test(F[k])?t:Math.abs(t)*(m<0?-1:1);}
      else R[ax]=S.cons==='R3'&&ax===2?0:mr;
    });
    const Lr=len3(R);
    if(Lr>0){dir=clean(R.map(c=>c/Lr));len=typed?skFor(dir,Lr):axisAligned(dir)?Math.max(1,Math.round(Lr/sc)):Lr/sc;if(typed)L=Lr;}
  }else{
    const Lt=numF('L'),At=numF('A'),It=numF('I');let a=At;
    if(a==null&&mv)a=norm360(Math.round(mv.raw/S.step)*S.step);
    if(mv)ph.A=norm360(Math.round(mv.raw/S.step)*S.step);
    if(a!=null)dir=S.cons==='R3'?dirAI(a,It??0):planeDir(S.cons,a);
    if(dir){
      typed=Lt>0||At!=null||It!=null;
      const ml=mv?Math.max(0,Math.round(dot3(mv.v,dir)*2)/2):0;ph.L=ml*sc;
      if(Lt>0){len=skFor(dir,Lt);L=Lt;}else len=ml>0?ml:(At!=null?1:0);
    }
  }
  if(dir&&!typed&&mv){
    let bd=14;
    for(const n of S.M.nodes){
      const v=[n.x-S.drawFrom.x,n.y-S.drawFrom.y,n.z-S.drawFrom.z],t=dot3(v,dir);if(t<.01)continue;
      if(len3([v[0]-dir[0]*t,v[1]-dir[1]*t,v[2]-dir[2]*t])>EPS)continue;
      const p=toS(n.x,n.y,n.z),d=Math.hypot(p[0]-S.mouse.x,p[1]-S.mouse.y);if(d<bd){bd=d;len=t;}
    }
  }
  if(!dir||!(len>0))return {dir,len:0,L:null,typed,ph};
  const Lr=L??len*sc;
  return {dir,len,L:L!=null?Math.round(L):null,typed,ph,Lr,R:dir.map(c=>c*Lr)};
}
export function startFit(d){
  const n=findNode(S.drawFrom.x,S.drawFrom.y,S.drawFrom.z);let ss=n?S.D.adj.get(n.id)||[]:[];
  if(n&&ss.length===1){
    const g=deg(Math.acos(clamp(-dot3(dirOf(ss[0],n.id),d),-1,1)));
    return g<.5?'in line with the previous segment':`elbow at start ${fa(g)}°`;
  }
  let run=null;
  if(n&&ss.length>=2){const ds=ss.map(s=>dirOf(s,n.id));for(let i=0;i<ds.length&&!run;i++)for(let j=i+1;j<ds.length;j++)if(dot3(ds[i],ds[j])<-.999){run=ds[i];break;}}
  if(!n)for(const s of S.M.segs)if(interiorT(s,S.drawFrom.x,S.drawFrom.y,S.drawFrom.z)!=null){run=segDir(s);break;}
  return run?`branch ${fa(deg(Math.acos(Math.abs(dot3(run,d)))))}° off the line`:'';
}
export const ln=(ctx,a,b)=>{ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();};
const circ=(ctx,p,r,fill)=>{ctx.beginPath();ctx.arc(p[0],p[1],r,0,Math.PI*2);fill?ctx.fill():ctx.stroke();};
const pw=s=>clamp(1.6+s.nps*.17,1.6,4.8)*clamp(V.s/44,.7,1.3);
function grid(ctx,W,H,T){
  const inv=(sx,sy)=>{const X=(sx-V.ox)/V.s,Y=(sy-V.oy)/V.s;return [(X/C30+2*Y)/2,(X/C30-2*Y)/2];};
  const cs=[inv(0,0),inv(W,0),inv(0,H),inv(W,H)],us=cs.map(c=>c[0]),vs=cs.map(c=>c[1]);
  const u0=Math.floor(Math.min(...us))-1,u1=Math.ceil(Math.max(...us))+1,v0=Math.floor(Math.min(...vs))-1,v1=Math.ceil(Math.max(...vs))+1;
  const coarse=V.s<16;ctx.lineWidth=1;
  for(const major of [false,true]){
    if(coarse&&!major)continue;
    const want=i=>(((i%5)+5)%5===0)===major;
    ctx.strokeStyle=major?T.grid2:T.grid;ctx.beginPath();
    for(let v=v0;v<=v1;v++)if(want(v)){const a=toS(u0,v,0),b=toS(u1,v,0);ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);}
    for(let u=u0;u<=u1;u++)if(want(u)){const a=toS(u,v0,0),b=toS(u,v1,0);ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);}
    for(let k=u0+v0;k<=u1+v1;k++)if(want(k)){const x=V.ox+C30*k*V.s;if(x<-2||x>W+2)continue;ctx.moveTo(x,0);ctx.lineTo(x,H);}
    ctx.stroke();
  }
}
function hatch(ctx,col){
  const c=document.createElement('canvas');c.width=c.height=8;const x=c.getContext('2d');
  x.strokeStyle=col;x.globalAlpha=.55;x.lineWidth=1;x.beginPath();x.moveTo(0,8);x.lineTo(8,0);x.moveTo(-2,2);x.lineTo(2,-2);x.moveTo(6,10);x.lineTo(10,6);x.stroke();
  return ctx.createPattern(c,'repeat');
}
function txtBox(ctx,t,x,y,fs,col,T,weight=600){
  ctx.font=`${weight} ${fs}px "Barlow Condensed",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
  const w=ctx.measureText(t).width;ctx.fillStyle=T.paper;ctx.fillRect(x-w/2-2,y-fs/2,w+4,fs);ctx.fillStyle=col;ctx.fillText(t,x,y);
}
function offsetTri(ctx,a,c,R,T,st){
  const nz=[0,1,2].filter(i=>Math.abs(c[i])>1e-6);if(nz.length<2)return;
  const A=toS(a.x,a.y,a.z),B=toS(a.x+c[0],a.y+c[1],a.z+c[2]);
  if(!st.live&&Math.hypot(B[0]-A[0],B[1]-A[1])<26)return;
  const fs=st.fs,lbl=(p,q,i,cen)=>{if(!st.legs||Math.hypot(q[0]-p[0],q[1]-p[1])<22)return;const mx=(p[0]+q[0])/2,my=(p[1]+q[1])/2,o=unit(mx-cen[0],my-cen[1]);txtBox(ctx,fmt(Math.round(Math.abs(R[i]))),mx+o[0]*(fs*.75),my+o[1]*(fs*.75),fs-1,st.col,T,500);};
  if(nz.length===2){
    const [i1,i2]=nz,lg=[0,0,0];lg[i1]=c[i1];const K=toS(a.x+lg[0],a.y+lg[1],a.z+lg[2]),cen=[(A[0]+B[0]+K[0])/3,(A[1]+B[1]+K[1])/3];
    ctx.beginPath();ctx.moveTo(A[0],A[1]);ctx.lineTo(K[0],K[1]);ctx.lineTo(B[0],B[1]);ctx.closePath();ctx.fillStyle=st.pat;ctx.fill();
    ctx.strokeStyle=st.col;ctx.lineWidth=1;if(st.live)ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(A[0],A[1]);ctx.lineTo(K[0],K[1]);ctx.lineTo(B[0],B[1]);ctx.stroke();ctx.setLineDash([]);
    const g=deg(Math.atan2(Math.abs(R[i2]),Math.abs(R[i1]))),t1=Math.atan2(K[1]-A[1],K[0]-A[0]),t2=Math.atan2(B[1]-A[1],B[0]-A[0]);
    let dt=t2-t1;while(dt>Math.PI)dt-=2*Math.PI;while(dt<-Math.PI)dt+=2*Math.PI;
    ctx.beginPath();ctx.arc(A[0],A[1],18,t1,t1+dt,dt<0);ctx.stroke();
    const bi=t1+dt/2;txtBox(ctx,fa(g)+'°',A[0]+Math.cos(bi)*33,A[1]+Math.sin(bi)*33,fs,st.live?T.acc:T.ink,T,700);
    lbl(A,K,i1,cen);lbl(K,B,i2,cen);
  }else{
    const p1=toS(a.x+c[0],a.y,a.z),p2=toS(a.x+c[0],a.y+c[1],a.z),cen=[(A[0]+B[0])/2,(A[1]+B[1])/2];
    ctx.strokeStyle=st.col;ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(A[0],A[1]);ctx.lineTo(p1[0],p1[1]);ctx.lineTo(p2[0],p2[1]);ctx.lineTo(B[0],B[1]);ctx.stroke();ctx.setLineDash([]);
    lbl(A,p1,0,cen);lbl(p1,p2,1,cen);lbl(p2,B,2,cen);
  }
}
export function symbol(ctx,type,c,d,p,r,col,paper,rev){
  const pt=(a,b)=>[c[0]+d[0]*a+p[0]*b,c[1]+d[1]*a+p[1]*b],L=(a,b)=>{ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);};
  const poly=(pts,fill,stroke=true)=>{ctx.beginPath();pts.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke)ctx.stroke();};
  const w=r*.72,tri=(sg,fill)=>poly([c,pt(sg*r,w),pt(sg*r,-w)],fill);
  const bow=(k=1)=>{poly([c,pt(-r*k,w*k),pt(-r*k,-w*k)],paper);poly([c,pt(r*k,w*k),pt(r*k,-w*k)],paper);};
  const bars=(o,h,lw=2.2)=>{ctx.save();ctx.lineWidth=lw;ctx.beginPath();for(const a of [-o,o])L(pt(a,-h),pt(a,h));ctx.stroke();ctx.restore();};
  const stemT=(h,bw)=>{ctx.beginPath();L(c,pt(0,h));L(pt(-bw,h),pt(bw,h));ctx.stroke();};
  const ground=(y)=>{ctx.beginPath();L(pt(-r*.95,y),pt(r*.95,y));for(let i=-2;i<=2;i++)L(pt(i*r*.4,y),pt(i*r*.4-r*.3,y+r*.35*Math.sign(y||-1)));ctx.lineWidth=1.2;ctx.stroke();ctx.lineWidth=1.6;};
  ctx.save();ctx.strokeStyle=col;ctx.fillStyle=paper;ctx.lineWidth=1.6;ctx.lineJoin='miter';ctx.lineCap='butt';
  switch(type){
    case 'gate':bow();stemT(r*1.25,r*.55);break;
    case 'globe':bow();ctx.fillStyle=col;circ(ctx,c,r*.3,true);stemT(r*1.25,r*.55);break;
    case 'ball':bow();ctx.fillStyle=paper;circ(ctx,c,r*.36,true);circ(ctx,c,r*.36,false);break;
    case 'plug':bow();poly([pt(-r*.18,-r*.42),pt(r*.18,-r*.42),pt(r*.18,r*.42),pt(-r*.18,r*.42)],col);ctx.beginPath();L(c,pt(0,r*1.1));L(pt(-r*.6,r*1.1),pt(r*.6,r*1.1));ctx.stroke();break;
    case 'check':{bow();const f=rev?-1:1;tri(f,col);const a=pt(-f*r*.7,w+7),b=pt(f*r*.7,w+7),h1=pt(f*r*.7-f*5,w+4),h2=pt(f*r*.7-f*5,w+10);ctx.lineWidth=1.3;ctx.beginPath();L(a,b);L(h1,b);ctx.lineTo(h2[0],h2[1]);ctx.stroke();break;}
    case 'dcheck':{bars(r*.45,r*.95);const f=rev?-1:1;poly([pt(f*r*.32,0),pt(-f*r*.25,r*.45),pt(-f*r*.25,-r*.45)],col);break;}
    case 'bfly':bars(r*.45,r*.95);ctx.fillStyle=paper;circ(ctx,c,r*.38,true);circ(ctx,c,r*.38,false);ctx.beginPath();L(pt(-r*.3,-r*.55),pt(r*.3,r*.55));ctx.stroke();stemT(r*1.35,r*.5);break;
    case 'needle':bow(.75);ctx.beginPath();L(c,pt(0,r*1.15));ctx.stroke();poly([pt(0,r*.55),pt(-r*.28,r*1.15),pt(r*.28,r*1.15)],col);break;
    case 'choke':{bow();ctx.beginPath();const a=pt(-r*1.05,-r*.95),b=pt(r*1.05,r*.95);L(a,b);ctx.stroke();const u=unit(b[0]-a[0],b[1]-a[1]);poly([b,[b[0]-u[0]*7-u[1]*3.5,b[1]-u[1]*7+u[0]*3.5],[b[0]-u[0]*7+u[1]*3.5,b[1]-u[1]*7-u[0]*3.5]],col);break;}
    case 'psv':{bow();ctx.beginPath();L(c,pt(0,r*.55));let y=r*.55;for(let i=0;i<4;i++){L(pt(i%2?-r*.4:r*.4,y),pt(i%2?r*.4:-r*.4,y+r*.25));y+=r*.25;}ctx.stroke();ctx.beginPath();L(pt(-r*.5,y+r*.1),pt(r*.5,y+r*.1));ctx.stroke();break;}
    case 'flange':bars(2.6,r*.85,2.4);break;
    case 'hu':bars(2.4,r*.7,2.2);ctx.beginPath();L(pt(0,-r*.95),pt(0,r*.95));ctx.lineWidth=2.6;ctx.stroke();for(const sg of [-1,1])poly([pt(0,sg*r*.95),pt(-r*.3,sg*r*1.2),pt(r*.3,sg*r*1.2)],col,false);break;
    case 'vic':poly([pt(-r*.42,-r*.62),pt(r*.42,-r*.62),pt(r*.42,r*.62),pt(-r*.42,r*.62)],paper);ctx.beginPath();L(pt(0,-r*.62),pt(0,r*.62));ctx.stroke();break;
    case 'tu':ctx.lineWidth=1.8;ctx.beginPath();L(pt(-3,-r*.55),pt(-3,r*.55));L(pt(0,-r*.85),pt(0,r*.85));L(pt(3,-r*.55),pt(3,r*.55));ctx.stroke();break;
    case 'spec':ctx.lineWidth=2.4;ctx.beginPath();L(pt(0,-r*.7),pt(0,r*1.2));ctx.stroke();ctx.fillStyle=col;circ(ctx,pt(0,r*1.45),r*.32,true);ctx.lineWidth=1.6;circ(ctx,pt(0,-r*1.0),r*.32,false);break;
    case 'ystr':{bars(r*.75,r*.6,1.8);const e=pt(r*.55,-r*1.15);ctx.beginPath();L(pt(-r*.1,0),e);ctx.lineWidth=2.2;ctx.stroke();ctx.lineWidth=1.6;ctx.beginPath();L(pt(r*.25,-r*1.25),pt(r*.85,-r*1.05));ctx.stroke();break;}
    case 'pg':{ctx.beginPath();L(c,pt(0,r*1.15));ctx.stroke();const g=pt(0,r*1.7);ctx.fillStyle=paper;circ(ctx,g,r*.55,true);circ(ctx,g,r*.55,false);ctx.beginPath();L(g,[g[0]+r*.35,g[1]-r*.2]);ctx.stroke();break;}
    case 'tg':{ctx.beginPath();L(c,pt(0,r*1.2));ctx.stroke();poly([pt(-r*.22,r*1.2),pt(r*.22,r*1.2),pt(r*.22,r*2.1),pt(-r*.22,r*2.1)],paper);ctx.fillStyle=col;circ(ctx,pt(0,r*1.2),r*.2,true);break;}
    case 'shoe':case 'guide':{poly([pt(0,-r*.32),pt(-r*.65,-r*1.25),pt(r*.65,-r*1.25)],col);ground(-r*1.45);if(type==='guide'){ctx.lineWidth=2;ctx.beginPath();for(const sg of [-1,1])L(pt(-r*.9,sg*r*.55),pt(r*.9,sg*r*.55));ctx.stroke();}break;}
    case 'anchor':{const q=[pt(-r*.7,-r*.7),pt(r*.7,-r*.7),pt(r*.7,r*.7),pt(-r*.7,r*.7)];poly(q,paper);ctx.beginPath();L(q[0],q[2]);L(q[1],q[3]);ctx.stroke();break;}
    case 'hanger':{ctx.beginPath();L(c,pt(0,r*1.9));L(pt(-r*.8,r*1.9),pt(r*.8,r*1.9));for(let i=-2;i<=2;i++)L(pt(i*r*.35,r*1.9),pt(i*r*.35+r*.28,r*2.25));ctx.stroke();ctx.fillStyle=paper;circ(ctx,c,r*.32,true);circ(ctx,c,r*.32,false);break;}
  }
  ctx.restore();
}
function endSymbol(ctx,type,c,u,p,r,col,paper){
  const pt=(a,b)=>[c[0]+u[0]*a+p[0]*b,c[1]+u[1]*a+p[1]*b];
  ctx.save();ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=1.8;
  if(type==='cap'){const an=Math.atan2(u[1],u[0]);ctx.beginPath();ctx.arc(c[0],c[1],r*.62,an-Math.PI/2,an+Math.PI/2);ctx.stroke();}
  else if(type==='blind'){ctx.lineWidth=2.2;ctx.beginPath();ctx.moveTo(...pt(0,-r*.85));ctx.lineTo(...pt(0,r*.85));ctx.stroke();ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(...pt(4.5,-r*.85));ctx.lineTo(...pt(4.5,r*.85));ctx.stroke();}
  else if(type==='plug'){const q=[pt(0,-r*.35),pt(r*.6,-r*.35),pt(r*.6,r*.35),pt(0,r*.35)];ctx.beginPath();q.forEach((v,i)=>i?ctx.lineTo(v[0],v[1]):ctx.moveTo(v[0],v[1]));ctx.closePath();ctx.fill();}
  else if(type==='hucap'){ctx.lineWidth=2.6;ctx.beginPath();ctx.moveTo(...pt(2,-r*.9));ctx.lineTo(...pt(2,r*.9));ctx.stroke();for(const sg of [-1,1]){ctx.beginPath();ctx.moveTo(...pt(2,sg*r*.9));ctx.lineTo(...pt(-1,sg*r*1.2));ctx.lineTo(...pt(5,sg*r*1.2));ctx.closePath();ctx.fill();}const an=Math.atan2(u[1],u[0]);ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(...pt(6,0),r*.45,an-Math.PI/2,an+Math.PI/2);ctx.stroke();}
  ctx.restore();
}
function compass(ctx,cx,cy,T,big){
  const k=big?36:30,n=[C30,-.5],e=[C30,.5],R=R_(),lo=k*.8+17;
  const hull=S.M.meta.ref==='ship';
  if(hull){const q=[[-.45,-1.05],[.45,-1.05],[.45,.45],[0,1.15],[-.45,.45]].map(([ee,nn])=>[cx+(e[0]*ee+n[0]*nn)*k,cy+(e[1]*ee+n[1]*nn)*k]);ctx.beginPath();q.forEach((v,i)=>i?ctx.lineTo(v[0],v[1]):ctx.moveTo(v[0],v[1]));ctx.closePath();ctx.fillStyle=T.grid;ctx.globalAlpha=.7;ctx.fill();ctx.globalAlpha=1;ctx.strokeStyle=T.grid2;ctx.lineWidth=1;ctx.stroke();}
  ctx.strokeStyle=T.ink;ctx.fillStyle=T.ink;ctx.lineWidth=1.6;
  ln(ctx,[cx-n[0]*k*.8,cy-n[1]*k*.8],[cx+n[0]*k,cy+n[1]*k]);ln(ctx,[cx-e[0]*k*.8,cy-e[1]*k*.8],[cx+e[0]*k*.8,cy+e[1]*k*.8]);
  const tip=[cx+n[0]*k,cy+n[1]*k];ctx.beginPath();ctx.moveTo(tip[0],tip[1]);ctx.lineTo(tip[0]-n[0]*9-n[1]*4.5,tip[1]-n[1]*9+n[0]*4.5);ctx.lineTo(tip[0]-n[0]*9+n[1]*4.5,tip[1]-n[1]*9-n[0]*4.5);ctx.closePath();ctx.fill();
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font='700 15px "Barlow Condensed",sans-serif';ctx.fillText(R.north,cx+n[0]*(k+13),cy+n[1]*(k+13));
  ctx.font='600 13px "Barlow Condensed",sans-serif';ctx.fillStyle=T.mute;
  ctx.fillText(R.south,cx-n[0]*lo,cy-n[1]*lo);ctx.fillText(R.east,cx+e[0]*lo,cy+e[1]*lo);ctx.fillText(R.west,cx-e[0]*lo,cy-e[1]*lo);
}
function tag(ctx,x,y,txt,T,W){
  ctx.font='600 13px Barlow,sans-serif';const w=ctx.measureText(txt).width+14;
  x=clamp(x,4,W-w-4);ctx.fillStyle=T.ink;ctx.fillRect(x,y-11,w,22);ctx.fillStyle=T.paper;ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(txt,x+7,y);
}
export const placeType=()=>FAM[S.tool]?famSel[S.tool]:null;
export function paint(ctx,W,H,exp){
  const T=theme(),m=S.M.meta,SP=new Map();
  ctx.fillStyle=T.paper;ctx.fillRect(0,0,W,H);
  grid(ctx,W,H,T);
  for(const n of S.M.nodes)SP.set(n.id,toS(n.x,n.y,n.z));
  const isSel=(k,id)=>!exp&&S.sel&&S.sel.k===k&&S.sel.id===id,isHov=(k,id)=>!exp&&S.hovObj&&S.hovObj.k===k&&S.hovObj.id===id;
  const fs=clamp(V.s*.3,11,15);
  if(m.dims){const st={pat:hatch(ctx,T.mute),col:T.mute,fs,legs:true,live:false};for(const s of S.M.segs){const a=nd(s.a);offsetTri(ctx,a,vsub(nd(s.b),a),segR(s),T,st);}}
  ctx.lineCap='round';ctx.lineJoin='round';
  for(const s of S.M.segs){
    const a=SP.get(s.a),b=SP.get(s.b);
    if(isHov('seg',s.id)){ctx.strokeStyle=T.acc;ctx.globalAlpha=.3;ctx.lineWidth=pw(s)+8;ln(ctx,a,b);ctx.globalAlpha=1;}
    ctx.strokeStyle=isSel('seg',s.id)?T.acc:T.ink;ctx.lineWidth=pw(s);ln(ctx,a,b);
  }
  const r=clamp(V.s*.2,6,13);
  for(const [id,f] of S.D.fit){
    const p=SP.get(id);if(!p)continue;const col=isSel('node',id)?T.acc:T.ink;
    if(f.type==='te'||f.type==='croix'){ctx.fillStyle=col;circ(ctx,p,clamp(V.s*.08,2.6,4.6),true);}
    else if(f.type==='reduc'){
      const s0=f.segs[0],s1=f.segs[1],q=SP.get(other(s0,id)),d=unit(q[0]-p[0],q[1]-p[1]),pp=perp(s0),big=NPS[s0.nps].od>NPS[s1.nps].od;
      const w0=(big?.8:.42)*r,w1=(big?.42:.8)*r,L=r*.9,A=(a,b)=>[p[0]+d[0]*a+pp[0]*b,p[1]+d[1]*a+pp[1]*b],pts=[A(L,w0),A(L,-w0),A(-L,-w1),A(-L,w1)];
      ctx.beginPath();pts.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.closePath();
      ctx.fillStyle=T.paper;ctx.fill();ctx.strokeStyle=col;ctx.lineWidth=1.6;ctx.stroke();
    }else if(f.type==='bout'&&nd(id).end){
      const s=f.segs[0],q=SP.get(other(s,id));endSymbol(ctx,nd(id).end,p,unit(p[0]-q[0],p[1]-q[1]),perp(s),r,col,T.paper);
    }
  }
  for(const c of S.M.comps){
    const s=S.D.SM.get(c.seg),a=SP.get(s.a),b=SP.get(s.b),d=unit(b[0]-a[0],b[1]-a[1]),cc=[a[0]+(b[0]-a[0])*c.t,a[1]+(b[1]-a[1])*c.t];
    if(isHov('comp',c.id)){ctx.fillStyle=T.acc;ctx.globalAlpha=.25;circ(ctx,cc,r*1.5,true);ctx.globalAlpha=1;}
    symbol(ctx,c.type,cc,d,perp(s),r,isSel('comp',c.id)?T.acc:T.ink,T.paper,c.rev);
  }
  if(m.dims){
    for(const s of S.M.segs){
      const a=SP.get(s.a),b=SP.get(s.b);if(Math.hypot(b[0]-a[0],b[1]-a[1])<30)continue;
      const ts=S.M.comps.filter(c=>c.seg===s.id).map(c=>c.t),tt=[.5,.3,.7,.2,.8].find(t=>ts.every(v=>Math.abs(v-t)>.12))??.5;
      const p=perp(s),off=fs*.9+6,x=a[0]+(b[0]-a[0])*tt-p[0]*off,y=a[1]+(b[1]-a[1])*tt-p[1]*off;
      let an=Math.atan2(b[1]-a[1],b[0]-a[0]);if(an>Math.PI/2-1e-3)an-=Math.PI;else if(an<-Math.PI/2-1e-3)an+=Math.PI;
      const t=String(Math.round(segLen(s)));ctx.save();ctx.translate(x,y);ctx.rotate(an);
      ctx.font=`600 ${fs}px "Barlow Condensed",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
      const w=ctx.measureText(t).width;ctx.fillStyle=T.paper;ctx.fillRect(-w/2-3,-fs/2-1,w+6,fs+2);
      ctx.fillStyle=s.L!=null?T.ink:T.mute;ctx.fillText(t,0,0);ctx.restore();
    }
  }
  if(m.els){
    ctx.font=`500 ${fs-1}px "Barlow Condensed",sans-serif`;ctx.textAlign='left';ctx.textBaseline='middle';const done=[];
    for(const [id,f] of S.D.fit){
      if(f.type==='droit')continue;const p=SP.get(id);if(done.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<3))continue;done.push(p);
      const z=Math.round(S.D.pos.get(id)[2]),t='EL '+(z>0?'+':z<0?'−':'±')+Math.abs(z),w=ctx.measureText(t).width;
      ctx.fillStyle=T.paper;ctx.fillRect(p[0]+7,p[1]-17,w+6,fs);ctx.fillStyle=T.acc;ctx.fillText(t,p[0]+10,p[1]-17+fs/2);
    }
  }
  if(exp){compass(ctx,70,H-70,T,true);return;}
  compass(ctx,W-74,108,T,false);
  if(!S.M.segs.length&&!S.drawFrom){ctx.fillStyle=T.mute;ctx.font='500 16px Barlow,sans-serif';ctx.textAlign='center';ctx.fillText('Pipe tool (T), then click the grid to start a line',W/2,H/2-40);}
  if(S.sel&&S.sel.k==='node'&&SP.get(S.sel.id)){ctx.strokeStyle=T.acc;ctx.lineWidth=2;circ(ctx,SP.get(S.sel.id),8,false);}
  if(S.hovObj&&S.hovObj.k==='node'&&SP.get(S.hovObj.id)){ctx.strokeStyle=T.acc;ctx.lineWidth=2;circ(ctx,SP.get(S.hovObj.id),8,false);}
  if(S.tool==='pipe'){
    if(S.drawFrom){
      const a=toS(S.drawFrom.x,S.drawFrom.y,S.drawFrom.z),pv=preview();ctx.fillStyle=T.acc;circ(ctx,a,4.5,true);
      if(pv&&pv.R){
        const c=pv.dir.map(v=>v*pv.len),b=toS(S.drawFrom.x+c[0],S.drawFrom.y+c[1],S.drawFrom.z+c[2]);
        offsetTri(ctx,S.drawFrom,c,pv.R,T,{pat:hatch(ctx,T.acc),col:T.acc,fs:Math.max(13,fs),legs:true,live:true});
        ctx.setLineDash([8,5]);ctx.strokeStyle=T.acc;ctx.lineWidth=2.8;ctx.lineCap='round';ln(ctx,a,b);ctx.setLineDash([]);ctx.fillStyle=T.acc;circ(ctx,b,4.5,true);
        const u=unit(b[0]-a[0],b[1]-a[1]);txtBox(ctx,fmt(Math.round(pv.Lr))+' mm',b[0]+u[0]*34,b[1]+u[1]*34,Math.max(13,fs),T.acc,T,700);
      }else if(S.mouse&&!anyF())tag(ctx,S.mouse.x+16,S.mouse.y+22,'Click: finish the line',T,W);
    }else if(S.hov){
      ctx.strokeStyle=T.acc;ctx.fillStyle=T.acc;ctx.lineWidth=2;
      if(S.hov.kind==='node')circ(ctx,[S.hov.sx,S.hov.sy],7,true);
      else if(S.hov.kind==='seg'){ctx.beginPath();ctx.moveTo(S.hov.sx,S.hov.sy-7);ctx.lineTo(S.hov.sx+7,S.hov.sy);ctx.lineTo(S.hov.sx,S.hov.sy+7);ctx.lineTo(S.hov.sx-7,S.hov.sy);ctx.closePath();ctx.fill();if(S.mouse)tag(ctx,S.mouse.x+16,S.mouse.y+22,'Branch start',T,W);}
      else circ(ctx,[S.hov.sx,S.hov.sy],5,false);
    }
  }
  const pt=placeType();
  if(pt&&S.hovSeg){
    const s=S.hovSeg.s,a=SP.get(s.a),b=SP.get(s.b),t=snapT(S.hovSeg.t);ctx.globalAlpha=.75;
    symbol(ctx,pt,[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],unit(b[0]-a[0],b[1]-a[1]),perp(s),r,T.acc,T.paper,false);ctx.globalAlpha=1;
    if(S.mouse)tag(ctx,S.mouse.x+16,S.mouse.y+22,`${CAT[pt].n} · ${nm(s.nps)} ${CLS[s.cls]}`,T,W);
  }
  if((S.tool==='select'||S.tool==='erase')&&S.hovObj&&S.mouse&&!S.ptr){
    if(S.hovObj.k==='seg'){const s=S.D.SM.get(S.hovObj.id),R=segR(s),at=angTxt(R);tag(ctx,S.mouse.x+16,S.mouse.y+22,`${nm(s.nps)} ${schL(schOf(s))} · L ${fmt(Math.round(segLen(s)))} mm · ${projTxt(R)}${at?' · '+at.split(' · ')[0]:''}`,T,W);}
    else if(S.hovObj.k==='comp'){const c=S.M.comps.find(c=>c.id===S.hovObj.id);if(c)tag(ctx,S.mouse.x+16,S.mouse.y+22,compDes(c),T,W);}
  }
}
const snapT=t=>clamp(Math.round(t*20)/20,.1,.9);
export const cv=$('#cv');
let need2=false;
export function draw2D(){
  if(need2)return;need2=true;
  requestAnimationFrame(()=>{need2=false;if(!S.W2)return;const ctx=cv.getContext('2d');ctx.setTransform(S.dpr,0,0,S.dpr,0,0);paint(ctx,S.W2,S.H2,false);});
}
function updHover(x,y){
  S.hov=null;S.hovSeg=null;S.hovObj=null;
  if(S.tool==='pipe'){if(!S.drawFrom)S.hov=pickStart(x,y);}
  else if(placeType())S.hovSeg=nearSeg(x,y,16);
  else S.hovObj=hit(x,y);
}
function commitRun(dir,len,L){
  const from={...S.drawFrom};
  commit(()=>{const r=addRun(S.drawFrom,dir,len,L);S.drawFrom={x:r.end.x,y:r.end.y,z:r.end.z};if(r.seg)S.sel={k:'seg',id:r.seg.id};clearF();});
  drawHist.push(from);hudSync();
}
export function commitPreview(){
  const pv=preview();
  if(!pv||!pv.R){toast(anyF()?'Incomplete values: also point the direction with the mouse':'Point the direction or type the values');return false;}
  commitRun(pv.dir,pv.len,pv.L);return true;
}
export function startDraw(pt){S.drawFrom={x:pt.x,y:pt.y,z:pt.z};clearF();drawHist.length=0;hudShow();hudBuild();hint();draw2D();}
export function endDraw(){S.drawFrom=null;clearF();drawHist.length=0;hudShow();hint();draw2D();}
function click(x,y){
  S.mouse={x,y};
  if(S.tool==='pipe'){
    if(!S.drawFrom){startDraw(pickStart(x,y).pt);return;}
    const pv=preview();
    if(pv&&pv.R)commitRun(pv.dir,pv.len,pv.L);else if(!anyF())endDraw();
    return;
  }
  const pt=placeType();
  if(pt){
    const h=nearSeg(x,y,16);if(!h)return;
    commit(()=>{const c={id:S.M.nid++,seg:h.s.id,t:snapT(h.t),type:pt,rev:false,fig:(pt==='hu'||pt==='plug')?S.figPick:'auto'};S.M.comps.push(c);S.sel={k:'comp',id:c.id};});
    return;
  }
  const h=hit(x,y);
  if(S.tool==='erase'){if(h)commit(()=>eraseObj(h));return;}
  S.sel=h?{k:h.k,id:h.id}:null;refreshSel();
}
const p2d=$('#p2d');

export function initSketch(){
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);S.ptr={x:e.offsetX,y:e.offsetY,lx:e.offsetX,ly:e.offsetY,b:e.button,moved:false};});
cv.addEventListener('pointermove',e=>{
  const x=e.offsetX,y=e.offsetY;S.mouse={x,y};
  if(S.ptr){
    if(!S.ptr.moved&&Math.hypot(x-S.ptr.x,y-S.ptr.y)>5)S.ptr.moved=true;
    if(S.ptr.moved){V.ox+=x-S.ptr.lx;V.oy+=y-S.ptr.ly;cv.style.cursor='grabbing';}
    S.ptr.lx=x;S.ptr.ly=y;
  }
  updHover(x,y);draw2D();if(S.drawFrom)hudUpdate();
});
cv.addEventListener('pointerup',e=>{
  if(!S.ptr)return;const p=S.ptr;S.ptr=null;cv.style.cursor='';if(p.moved)return;
  if(p.b===0)click(e.offsetX,e.offsetY);
  else if(p.b===2){if(S.drawFrom)endDraw();else{S.sel=null;refreshSel();}}
  updHover(e.offsetX,e.offsetY);draw2D();
});
cv.addEventListener('pointercancel',()=>{S.ptr=null;cv.style.cursor='';});
cv.addEventListener('pointerleave',()=>{if(!S.ptr){S.hov=null;S.hovSeg=null;S.hovObj=null;draw2D();}});
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.offsetX,e.offsetY,Math.exp(-e.deltaY*.0015));},{passive:false});
$('#zIn').onclick=()=>zoomAt(S.W2/2,S.H2/2,1.25);
$('#zOut').onclick=()=>zoomAt(S.W2/2,S.H2/2,.8);
$('#zFit').onclick=fit2D;
new ResizeObserver(()=>{
  const w=p2d.clientWidth,h=p2d.clientHeight;if(w<2||h<2)return;
  const first=!S.W2,ow=S.W2,oh=S.H2;S.dpr=Math.min(2,devicePixelRatio||1);S.W2=w;S.H2=h;
  cv.width=Math.round(w*S.dpr);cv.height=Math.round(h*S.dpr);
  if(first){fitTo(S.W2,S.H2);if(S.W2<560)$('#cart').classList.add('min');}else{V.ox+=(S.W2-ow)/2;V.oy+=(S.H2-oh)/2;}
  draw2D();
}).observe(p2d);
}

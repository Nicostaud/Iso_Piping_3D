/** three.js scene: init, build from the model, camera fit, 2D/3D view switching. */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { rad } from '../core/geom.js';
import { R_ } from '../core/labels.js';
import { nd, other, segLen } from '../core/model.js';
import { NPS } from '../data/pipe.js';
import { S } from '../state.js';
import { $ } from '../ui/dom.js';
import { refreshSel, toast } from '../ui/panels.js';
import { fname, saveFile } from '../ui/sheet.js';
import { draw2D, endDraw } from '../ui/sketch.js';
import { theme } from '../ui/theme.js';
import { compObj, endObj } from './kit.js';

let dirty3=true,need3=false;
const v3=$('#v3'),msg3=$('#msg3');
function init3D(){
  if(S.G3)return true;
  if(!THREE||!OrbitControls){msg3.textContent='3D library unavailable (connection to the three.js CDN required).';msg3.hidden=false;return false;}
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));renderer.outputEncoding=THREE.sRGBEncoding;
  v3.appendChild(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.01,5000),controls=new OrbitControls(camera,renderer.domElement);
  controls.addEventListener('change',()=>render3());
  scene.add(new THREE.HemisphereLight(0xffffff,0x6b7785,.8));
  const dl=new THREE.DirectionalLight(0xffffff,.7);dl.position.set(.6,1,.8);camera.add(dl);scene.add(camera);
  const group=new THREE.Group(),helpers=new THREE.Group();scene.add(group,helpers);
  const SM_=(c,m,r)=>new THREE.MeshStandardMaterial({color:c,metalness:m,roughness:r});
  const mats={pipe:SM_(0xa3adb8,.25,.45),fit:SM_(0x8f9aa6,.25,.45),sel:SM_(0xff5a36,.1,.5),valve:SM_(0xc0331d,.15,.5),body:SM_(0x4a5561,.3,.5),flange:SM_(0x737f8b,.3,.45),arrow:SM_(0xf0b323,.1,.6),sup:SM_(0xc9a033,.15,.6),supD:SM_(0x8d6b1c,.2,.55),hu:SM_(0xb8361f,.2,.5),vic:SM_(0xe0752a,.15,.55),dial:SM_(0xf2f2ee,.05,.7),black:SM_(0x262b31,.2,.5),blue:SM_(0x2d5aa6,.2,.5)};
  S.G3={renderer,scene,camera,controls,group,helpers,mats,fitted:false};
  new ResizeObserver(resize3).observe(v3);
  const rc=new THREE.Raycaster();let pd=null;
  renderer.domElement.addEventListener('pointerdown',e=>{pd=[e.clientX,e.clientY,e.button];});
  renderer.domElement.addEventListener('pointerup',e=>{
    if(!pd||pd[2]!==0||Math.hypot(e.clientX-pd[0],e.clientY-pd[1])>4){pd=null;return;}pd=null;
    const r=renderer.domElement.getBoundingClientRect();
    rc.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);
    let o=(rc.intersectObjects(group.children,true)[0]||{}).object;while(o&&!o.userData.ref)o=o.parent;
    S.sel=o?{...o.userData.ref}:null;refreshSel();
  });
  return true;
}
function resize3(){if(!S.G3)return;const w=v3.clientWidth,h=v3.clientHeight;if(w<2||h<2)return;S.G3.renderer.setSize(w,h);S.G3.camera.aspect=w/h;S.G3.camera.updateProjectionMatrix();render3();}
function render3(){if(S.G3)S.G3.renderer.render(S.G3.scene,S.G3.camera);}
function clearG(g,all){g.traverse(o=>{if(o.geometry)o.geometry.dispose();if(all&&o.material){if(o.material.map)o.material.map.dispose();o.material.dispose();}});g.clear();}
export function mark3D(){
  dirty3=true;if(S.view==='2d'||!S.G3||need3)return;need3=true;
  requestAnimationFrame(()=>{need3=false;build3D();if(!S.G3.fitted&&S.M.segs.length)fit3D('iso');else render3();});
}
function build3D(){
  if(!S.G3)return;dirty3=false;
  const {group,helpers,mats,scene}=S.G3,T=theme();clearG(group,false);clearG(helpers,true);
  scene.background=new THREE.Color(T.sky);
  msg3.textContent='Nothing to generate: draw a line in the 2D sketch.';msg3.hidden=S.M.segs.length>0;
  if(!S.M.segs.length){render3();return;}
  const UP=new THREE.Vector3(0,1,0),k=.001;
  const Wp=id=>{const p=S.D.pos.get(id);return new THREE.Vector3(p[0]*k,p[2]*k,-p[1]*k);};
  const od=s=>NPS[s.nps].od*k,lenM=s=>segLen(s)*k;
  const isSel=(t,id)=>S.sel&&S.sel.k===t&&S.sel.id===id;
  const mk=(geo,mat,ref)=>{const m=new THREE.Mesh(geo,mat);m.userData.ref=ref;return m;};
  const trim=new Map();
  for(const [id,f] of S.D.fit){
    const ss=f.segs;if(!ss.length)continue;const P0=Wp(id),ref={k:'node',id},mat=isSel('node',id)?mats.sel:mats.fit;
    if(f.type==='coude'){
      const o=Math.max(od(ss[0]),od(ss[1])),inch=Math.max(NPS[ss[0].nps].in,NPS[ss[1].nps].in);
      const d1=Wp(other(ss[0],id)).sub(P0).normalize(),d2=Wp(other(ss[1],id)).sub(P0).normalize();
      if(f.ang>178){const m=mk(new THREE.SphereGeometry(o/2*1.1,18,12),mat,ref);m.position.copy(P0);group.add(m);continue;}
      const dl=rad(f.ang),tn=Math.tan(dl/2);
      const R=Math.max(o*.55,Math.min(Math.max(.0381,.0381*inch),.45*Math.min(lenM(ss[0]),lenM(ss[1]))/tn)),t=R*tn;
      const T1=P0.clone().addScaledVector(d1,t),T2=P0.clone().addScaledVector(d2,t);
      const C=P0.clone().addScaledVector(d1.clone().add(d2).normalize(),R/Math.cos(dl/2));
      const X=T1.clone().sub(C).normalize(),w=T2.clone().sub(C),Y=w.clone().addScaledVector(X,-w.dot(X)).normalize(),Z=new THREE.Vector3().crossVectors(X,Y);
      const m=mk(new THREE.TorusGeometry(R,o/2,16,Math.max(6,Math.round(28*dl/(Math.PI/2))),dl),mat,ref);
      m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X,Y,Z));m.position.copy(C);group.add(m);trim.set(id,t);
    }else if(f.type==='reduc'){
      const o0=od(ss[0]),o1=od(ss[1]),L=Math.max(.05,1.2*Math.max(o0,o1)),d=Wp(other(ss[0],id)).sub(P0).normalize();
      const m=mk(new THREE.CylinderGeometry(o0/2,o1/2,L,24),mat,ref);m.quaternion.setFromUnitVectors(UP,d);m.position.copy(P0);group.add(m);trim.set(id,L/2);
    }else if(f.type==='te'||f.type==='croix'){
      const o=Math.max(...ss.map(od)),dirs=ss.map(s=>Wp(other(s,id)).sub(P0).normalize()),run=f.run;
      if(run){
        const m=mk(new THREE.CylinderGeometry(o/2*1.07,o/2*1.07,o*2.1,24),mat,ref);m.quaternion.setFromUnitVectors(UP,dirs[run[0]]);m.position.copy(P0);group.add(m);
        dirs.forEach((d,i)=>{if(run.includes(i))return;const ob=od(ss[i]),b=mk(new THREE.CylinderGeometry(ob/2*1.07,ob/2*1.07,o*1.05,24),mat,ref);b.quaternion.setFromUnitVectors(UP,d);b.position.copy(P0).addScaledVector(d,o*.525);group.add(b);});
      }else{const m=mk(new THREE.SphereGeometry(o/2*1.18,20,14),mat,ref);m.position.copy(P0);group.add(m);}
    }else if(f.type==='bout'&&nd(id).end)group.add(endObj(nd(id),ss[0],Wp,mats,isSel('node',id)));
  }
  for(const s of S.M.segs){
    const a=Wp(s.a),b=Wp(s.b),v=b.clone().sub(a),L=v.length();if(L<1e-6)continue;const d=v.divideScalar(L);
    const ta=trim.get(s.a)||0,tb=trim.get(s.b)||0,l=Math.max(.001,L-ta-tb);
    const m=mk(new THREE.CylinderGeometry(od(s)/2,od(s)/2,l,22),isSel('seg',s.id)?mats.sel:mats.pipe,{k:'seg',id:s.id});
    m.quaternion.setFromUnitVectors(UP,d);m.position.copy(a).addScaledVector(d,ta+l/2);group.add(m);
  }
  for(const c of S.M.comps)group.add(compObj(c,S.D.SM.get(c.seg),Wp,mats,isSel('comp',c.id)));
  const box=new THREE.Box3().setFromObject(group),sz=box.getSize(new THREE.Vector3()),ce=box.getCenter(new THREE.Vector3());
  const size=Math.max(4,Math.ceil(Math.max(sz.x,sz.z)+3)),gs=size%2?size+1:size,gy=box.min.y-.05;
  const gh=new THREE.GridHelper(gs,gs,new THREE.Color(T.mute),new THREE.Color(T.grid2));
  gh.position.set(Math.round(ce.x),gy,Math.round(ce.z));helpers.add(gh);
  const acc=new THREE.Color(T.acc),Rf=R_(),label=(txt,pos,sc,col)=>{const cvs=document.createElement('canvas');cvs.width=256;cvs.height=128;const cx=cvs.getContext('2d');cx.fillStyle=col;cx.font='700 88px "Barlow Condensed",sans-serif';cx.textAlign='center';cx.textBaseline='middle';cx.fillText(txt,128,68);const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cvs),depthTest:false}));sp.scale.set(sc*2,sc,1);sp.position.copy(pos);helpers.add(sp);};
  const al=Math.max(1,size*.08);
  if(S.M.meta.ref==='ship'){
    const mx=Math.max(1,sz.x*.15)+.8,x0=box.min.x-mx,x1=box.max.x+mx,zA=box.max.z+mx,zF=box.min.z-mx,bow=(x1-x0)*.55,y=gy+.01;
    const pts=[[x0,zA],[x1,zA],[x1,zF],[(x0+x1)/2,zF-bow],[x0,zF]].map(([x,z])=>new THREE.Vector3(x,y,z));
    helpers.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:new THREE.Color(T.mute)})));
    const cxm=(x0+x1)/2,ls=al*.4,mc=T.mute;label('FWD',new THREE.Vector3(cxm,y,zF-bow-ls),ls,T.acc);label('AFT',new THREE.Vector3(cxm,y,zA+ls),ls,mc);label('PS',new THREE.Vector3(x0-ls*1.2,y,(zA+zF)/2),ls,mc);label('SB',new THREE.Vector3(x1+ls*1.2,y,(zA+zF)/2),ls,mc);
  }else{
    const org=new THREE.Vector3(box.min.x-al*.8,gy+.01,box.max.z+al*.2);
    helpers.add(new THREE.ArrowHelper(new THREE.Vector3(0,0,-1),org,al,acc,al*.3,al*.18));
    label(Rf.north,org.clone().add(new THREE.Vector3(0,0,-al-al*.3)),al*.45,T.acc);
  }
  render3();
}
function fit3D(mode){
  if(!S.G3)return;const {camera,controls,group}=S.G3;
  const box=new THREE.Box3().setFromObject(group);let c=new THREE.Vector3(),r=3;
  if(!box.isEmpty()){const s=box.getBoundingSphere(new THREE.Sphere());c=s.center;r=Math.max(s.radius,.3);}
  const dir=mode==='top'?new THREE.Vector3(0,1,.0001):mode==='keep'?camera.position.clone().sub(controls.target):new THREE.Vector3(1,1,1);
  dir.normalize();let dist=r/Math.sin(THREE.MathUtils.degToRad(camera.fov/2))*1.05;if(camera.aspect<1)dist/=camera.aspect;
  camera.position.copy(c).addScaledVector(dir,dist);camera.near=dist/300;camera.far=dist*60;camera.updateProjectionMatrix();
  controls.target.copy(c);controls.update();S.G3.fitted=true;render3();
}
export function setView(v){
  S.view=v;$('#work').dataset.v=v;$('#bGen').textContent=v==='3d'?'Back to 2D':'Generate 3D';
  if(v==='3d'&&S.drawFrom)endDraw();
  document.querySelectorAll('#viewSeg [data-v]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===v));
  requestAnimationFrame(()=>{if(v!=='2d'&&init3D()){resize3();if(dirty3)build3D();if(!S.G3.fitted&&S.M.segs.length)fit3D('iso');else render3();}draw2D();});
}
export function generate(){
  if(!S.M.segs.length){toast('Draw a line in the 2D sketch first');return;}
  if(S.view!=='3d')setView('3d');
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(S.G3){build3D();fit3D('iso');}}));
}

export function initScene(){
document.querySelector('.p3d .over').addEventListener('click',e=>{
  const b=e.target.closest('[data-c]');if(!b||!S.G3)return;const c=b.dataset.c;
  if(c==='png'){render3();S.G3.renderer.domElement.toBlob(bl=>{if(bl)saveFile(fname()+'-3d.png',bl);},'image/png');}
  else if(c==='fs'){
    const el=$('#p3d');
    try{const pr=document.fullscreenElement?document.exitFullscreen():el.requestFullscreen&&el.requestFullscreen();if(pr&&pr.catch)pr.catch(()=>toast('Full screen not allowed in this view'));else if(!pr&&!document.fullscreenElement)toast('Full screen not available in this view');}
    catch(err){toast('Full screen not allowed in this view');}
  }
  else fit3D(c==='fit'?'keep':c);
});
$('#viewSeg').addEventListener('click',e=>{const b=e.target.closest('[data-v]');if(b){if(b.dataset.v==='3d')generate();else setView('2d');}});
document.addEventListener('fullscreenchange',()=>{const b=document.querySelector('[data-c="fs"]');if(b)b.textContent=document.fullscreenElement?'Exit full screen':'Full screen';setTimeout(resize3,60);});
$('#bGen').onclick=()=>{if(S.view==='3d')setView('2d');else generate();};
}

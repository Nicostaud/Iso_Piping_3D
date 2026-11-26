/** 3D component and end-cap geometry. */
import * as THREE from 'three';
import { other } from '../core/model.js';
import { NPS } from '../data/pipe.js';

function kit(g,mats,selected,Dm){
  const add=(geo,mat,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geo,selected?mats.sel:mat);m.position.set(x,y,z);g.add(m);return m;};
  const cyl=(r,h,n=22)=>new THREE.CylinderGeometry(r,r,h,n),cylZ=(r,h,n=22)=>cyl(r,h,n).rotateX(Math.PI/2),cylX=(r,h,n=22)=>cyl(r,h,n).rotateZ(Math.PI/2),box=(x,y,z)=>new THREE.BoxGeometry(x,y,z);
  const rf=Dm*.85+.012,tf=Dm*.14+.01;
  const flanges=hl=>{for(const sg of [-1,1])add(cyl(rf,tf,28),mats.flange,0,sg*(hl-tf/2),0);};
  const bolts=(len,n=8)=>{for(let i=0;i<n;i++){const a=(i+.5)*Math.PI*2/n;add(cyl(Dm*.05+.005,len,8),mats.body,Math.cos(a)*rf*.8,0,Math.sin(a)*rf*.8);}};
  const wheel=(z,R)=>{add(new THREE.TorusGeometry(R,R*.07+.003,10,32),mats.valve,0,0,z);add(box(R*2,R*.07+.004,R*.07+.004),mats.valve,0,0,z);add(box(R*.07+.004,R*2,R*.07+.004),mats.valve,0,0,z);};
  const sideWheel=(x,z,R)=>{const t=new THREE.TorusGeometry(R,R*.08+.003,10,28).rotateY(Math.PI/2);add(t,mats.valve,x,0,z);};
  const gear=(z)=>{const b=Math.max(.06,Dm*.45);add(box(b*1.2,b,b*.9),mats.blue,0,0,z);sideWheel(b*.6+.03,z,Math.max(.06,Dm*.4));};
  const lever=(z,len)=>add(box(Dm*.12+.006,len,Dm*.06+.005),mats.valve,0,len*.35,z);
  const huNut=(y)=>{const r=Dm*.78+.012,l=Dm*.6+.01;add(cyl(r,l,6),mats.hu,0,y,0);for(let i=0;i<3;i++){const a=i*Math.PI*2/3+Math.PI/2;add(box(Dm*.18+.01,l*.8,Dm*.45+.02),mats.hu,Math.cos(a)*(r+Dm*.18),y,Math.sin(a)*(r+Dm*.18)).rotation.y=-a+Math.PI/2;}};
  return {add,cyl,cylZ,cylX,box,rf,tf,flanges,bolts,wheel,gear,lever,huNut};
}
export function compObj(c,s,Wp,mats,selected){
  const a=Wp(s.a),b=Wp(s.b),v=b.clone().sub(a),L=v.length(),dir=v.clone().normalize(),Dm=NPS[s.nps].od/1000;
  const g=new THREE.Group();g.userData.ref={k:'comp',id:c.id};
  const stem=Math.abs(dir.y)>.9?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0);stem.addScaledVector(dir,-stem.dot(dir)).normalize();
  const X=new THREE.Vector3().crossVectors(dir,stem);
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X,dir,stem));g.position.copy(a).addScaledVector(dir,L*c.t);
  const K=kit(g,mats,selected,Dm),{add,cyl,cylZ,cylX,box,rf,tf,flanges,bolts,wheel,gear,lever,huNut}=K;
  const ring=r=>new THREE.TorusGeometry(Dm/2+.004,r,8,28).rotateX(Math.PI/2);
  const shoe=(m)=>{const h=Dm*.55+.02,bt=Dm*.06+.01;add(box(Dm*.9,Dm*1.8+.04,h),m,0,0,-(Dm/2+h/2));add(box(Dm*1.5+.05,Dm*2.2+.06,bt),m,0,0,-(Dm/2+h+bt/2));return -(Dm/2+h);};
  const wafer=(hw)=>{for(const sg of [-1,1])add(cyl(rf,tf,28),mats.flange,0,sg*(hw+tf/2),0);bolts(2*hw+2*tf+.04);};
  switch(c.type){
    case 'gate':{const hl=Dm*1.05+tf;add(cyl(Dm*.58,2*hl),mats.body);add(new THREE.SphereGeometry(Dm*.78,22,16),mats.body);flanges(hl);add(cylZ(Dm*.36,Dm),mats.body,0,0,Dm*1.1);add(cylZ(Dm*.05+.003,Dm*.9),mats.flange,0,0,Dm*2);wheel(Dm*2.42,Dm*.7);break;}
    case 'globe':{const hl=Dm*1.1+tf;add(cyl(Dm*.55,2*hl),mats.body);const sp=add(new THREE.SphereGeometry(Dm*.92,22,16),mats.body);sp.scale.set(1,1.15,.9);flanges(hl);add(cylZ(Dm*.4,Dm*.7),mats.body,0,0,Dm*1.05);add(cylZ(Dm*.05+.003,Dm*.8),mats.flange,0,0,Dm*1.75);wheel(Dm*2.1,Dm*.6);break;}
    case 'ball':{const hl=Dm*.95+tf;add(cyl(Dm*.6,2*hl),mats.body);add(new THREE.SphereGeometry(Dm*.88,22,16),mats.body);flanges(hl);add(cylZ(Dm*.08+.003,Dm*.5),mats.flange,0,0,Dm*1.05);if(s.nps>=10)gear(Dm*1.45);else lever(Dm*1.32,Dm*2.4);break;}
    case 'bfly':{const hw=Dm*.22+.01;add(cyl(rf*.7,2*hw,28),mats.body);wafer(hw);add(cylZ(Dm*.1+.008,rf*.75),mats.body,0,0,rf*.7+rf*.35);const zt=rf*1.45;if(s.nps>=11)gear(zt+Dm*.2);else{add(cylZ(Dm*.04+.004,Dm*.15),mats.flange,0,0,zt);lever(zt+Dm*.08,Dm*2);}break;}
    case 'plug':{add(box(Dm*1.5,Dm*1.9,Dm*1.5),mats.body);for(const sg of [-1,1]){add(cyl(Dm*.55,Dm*.5),mats.body,0,sg*Dm*1.1,0);huNut(sg*Dm*1.45);}add(box(Dm*.3,Dm*.3,Dm*.6),mats.flange,0,0,Dm*1.05);add(box(Dm*2.4,Dm*.14+.006,Dm*.14+.006),mats.valve,0,0,Dm*1.4);break;}
    case 'check':{const hl=Dm*1.15+tf,f=c.rev?-1:1;add(cyl(Dm*.72,2*hl),mats.body);flanges(hl);add(cylZ(Dm*.55,Dm*.36),mats.body,0,0,Dm*.88);const cone=new THREE.ConeGeometry(Dm*.2+.004,Dm*.5+.01,16);if(f<0)cone.rotateZ(Math.PI);add(cone,mats.arrow,0,f*Dm*.3,Dm*1.3);add(cyl(Dm*.06+.002,Dm*.7,10),mats.arrow,0,-f*Dm*.2,Dm*1.3);break;}
    case 'dcheck':{const hw=Dm*.2+.01,f=c.rev?-1:1;add(cyl(rf*.7,2*hw,28),mats.body);wafer(hw);add(new THREE.TorusGeometry(Dm*.12+.01,Dm*.03+.003,8,16).rotateY(Math.PI/2),mats.flange,0,0,rf*.7+Dm*.12);const cone=new THREE.ConeGeometry(Dm*.12+.004,Dm*.3+.01,12);if(f<0)cone.rotateZ(Math.PI);add(cone,mats.arrow,rf*.72,0,0);break;}
    case 'needle':{const r=Math.max(Dm*.8,.025);add(cyl(r,Math.max(Dm*1.6,.07),6),mats.body);add(cylZ(r*.45,Math.max(Dm*.8,.04)),mats.body,0,0,r+Math.max(Dm*.4,.02));add(box(Math.max(Dm*1.2,.06),r*.25,r*.25),mats.valve,0,0,r+Math.max(Dm*.85,.045));break;}
    case 'choke':{const hl=Dm*1.25+tf;add(box(Dm*1.5,2*hl-2*tf,Dm*1.5),mats.body);flanges(hl);add(cylZ(Dm*.45,Dm*1.0),mats.body,0,0,Dm*1.25);add(cylZ(Dm*.06+.003,Dm*.8),mats.flange,0,0,Dm*2.1);wheel(Dm*2.5,Dm*.55);add(box(Dm*.6,Dm*.05+.004,Dm*.3),mats.dial,Dm*.5,0,Dm*1.3);break;}
    case 'psv':{const hl=Dm*.95+tf;add(cyl(Dm*.6,2*hl),mats.body);add(new THREE.SphereGeometry(Dm*.8,20,14),mats.body);flanges(hl);const cn=new THREE.ConeGeometry(Dm*.55,Dm*.8,20).rotateX(Math.PI/2);add(cn,mats.valve,0,0,Dm*1.15);add(cylZ(Dm*.32,Dm*1.3),mats.valve,0,0,Dm*2.1);add(cylZ(Dm*.22,Dm*.3),mats.black,0,0,Dm*2.9);add(cylX(Dm*.4,Dm*.9),mats.body,Dm*.75,0,0);add(cylX(rf*.85,tf,28),mats.flange,Dm*1.2,0,0);break;}
    case 'flange':{for(const sg of [-1,1])add(cyl(rf,tf,28),mats.flange,0,sg*(tf/2+.003),0);bolts(2*tf+.03);break;}
    case 'hu':{for(const sg of [-1,1])add(cyl(Dm*.6,Dm*.55),mats.body,0,sg*Dm*.33,0);huNut(Dm*.05);break;}
    case 'vic':{add(cyl(Dm*.64+.008,Dm*.42,24),mats.vic);for(const sg of [-1,1]){add(box(Dm*.28+.02,Dm*.34,Dm*.22+.015),mats.vic,sg*(Dm*.72+.012),0,0);add(cylZ(Dm*.05+.004,Dm*.45+.03,8),mats.black,sg*(Dm*.74+.012),0,0);}break;}
    case 'tu':{add(cyl(Dm*.75+.004,Dm*.55,6),mats.body);for(const sg of [-1,1])add(cyl(Dm*.62,Dm*.25),mats.flange,0,sg*Dm*.38,0);break;}
    case 'spec':{const tp=Dm*.08+.006;for(const sg of [-1,1])add(cyl(rf,tf,28),mats.flange,0,sg*(tp/2+tf/2),0);bolts(tp+2*tf+.04);add(cyl(rf*.72,tp,28),mats.arrow);add(box(rf*1.1,tp,rf*.25),mats.arrow,rf*1.2,0,0);add(new THREE.TorusGeometry(rf*.55,rf*.16,10,28).rotateX(Math.PI/2),mats.arrow,rf*2.2,0,0);break;}
    case 'ystr':{const hl=Dm*1.1+tf;add(cyl(Dm*.62,2*hl),mats.body);flanges(hl);const lg=cyl(Dm*.45,Dm*1.3).rotateX(-Math.PI/4);add(lg,mats.body,0,Dm*.46,-Dm*.46);const cp=cyl(Dm*.55,Dm*.14).rotateX(-Math.PI/4);add(cp,mats.flange,0,Dm*.95,-Dm*.95);break;}
    case 'pg':case 'tg':{const st=Math.max(Dm*.12,.012),h=Math.max(Dm*.3,.06)+.04;add(cylZ(st,h,10),mats.flange,0,0,Dm/2+h/2);add(cylZ(st*1.6,.03,6),mats.body,0,0,Dm/2+h);
      if(c.type==='pg'){add(cylX(.055,.03,24),mats.black,0,0,Dm/2+h+.07);add(cylX(.048,.032,24),mats.dial,.002,0,Dm/2+h+.07);}
      else{add(cylZ(.012,.09,8),mats.flange,0,0,Dm/2+h+.06);add(cylX(.045,.025,24),mats.black,0,0,Dm/2+h+.14);add(cylX(.039,.027,24),mats.dial,.002,0,Dm/2+h+.14);}break;}
    case 'shoe':shoe(mats.sup);break;
    case 'guide':{const z0=shoe(mats.sup),ph=Dm*.5-z0+.02;for(const sg of [-1,1])add(box(Dm*.08+.008,Dm*1.1+.03,ph),mats.supD,sg*(Dm/2+Dm*.12+.02),0,z0+ph/2-Dm*.08);break;}
    case 'anchor':{shoe(mats.supD);for(const sg of [-1,1])add(ring(Dm*.07+.006),mats.supD,0,sg*Dm*.55,0);add(box(Dm*.06+.008,Dm*1.6,Dm*.5),mats.supD,0,0,-(Dm/2+Dm*.25));break;}
    case 'hanger':{const rl=Math.max(.35,Dm*3);add(ring(Dm*.07+.006),mats.supD);add(cylZ(Dm*.04+.006,rl),mats.sup,0,0,Dm/2+rl/2);add(box(Dm*1.2+.08,Dm*1.2+.08,.02),mats.supD,0,0,Dm/2+rl+.01);break;}
  }
  return g;
}
export function endObj(n,s,Wp,mats,selected){
  const P0=Wp(n.id),o=Wp(other(s,n.id)),u=P0.clone().sub(o).normalize(),Dm=NPS[s.nps].od/1000;
  const g=new THREE.Group();g.userData.ref={k:'node',id:n.id};g.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),u);g.position.copy(P0);
  const K=kit(g,mats,selected,Dm),{add,cyl,rf,tf,bolts,huNut}=K;
  if(n.end==='cap'){const h=add(new THREE.SphereGeometry(Dm/2,22,12,0,Math.PI*2,0,Math.PI/2),mats.fit);h.scale.set(1,.5,1);}
  else if(n.end==='blind'){add(cyl(rf,tf,28),mats.flange,0,tf/2,0);add(cyl(rf,tf*1.1,28),mats.flange,0,tf*1.6+.004,0);bolts(2.2*tf+.03);}
  else if(n.end==='plug')add(cyl(Dm*.42,Dm*.45,6),mats.body,0,Dm*.22,0);
  else if(n.end==='hucap'){add(cyl(Dm*.6,Dm*.4),mats.body,0,Dm*.2,0);huNut(Dm*.5);const h=add(new THREE.SphereGeometry(Dm*.55,20,10,0,Math.PI*2,0,Math.PI/2),mats.hu,0,Dm*.8,0);h.scale.set(1,.45,1);}
  return g;
}

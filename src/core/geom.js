/** Pure geometry: vectors, isometric projection P, directions, angles. */
export const C30=Math.sqrt(3)/2,EPS=1e-3;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const r4=v=>Math.round(v*1e4)/1e4,deg=r=>r*180/Math.PI,rad=d=>d*Math.PI/180,norm360=a=>((a%360)+360)%360;
export const clean=v=>v.map(c=>Math.abs(c)<1e-9?0:c);
export const vsub=(a,b)=>[a.x-b.x,a.y-b.y,a.z-b.z];
export const len3=v=>Math.hypot(v[0],v[1],v[2]),dot3=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const axisAligned=d=>d.filter(c=>Math.abs(c)>1e-6).length===1;
export const unit=(x,y)=>{const l=Math.hypot(x,y)||1;return [x/l,y/l];};
export const P=(x,y,z)=>[C30*(x+y),-(0.5*(y-x)+z)];
export const DV=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].map(v=>({v,s:P(...v)}));
export const dirAI=(az,inc)=>{const a=rad(az),i=rad(clamp(inc,-90,90));return clean([Math.cos(i)*Math.sin(a),Math.cos(i)*Math.cos(a),Math.sin(i)]);};
export function planeDir(c,a){const r=rad(a);return clean(c==='H'?[Math.sin(r),Math.cos(r),0]:c==='EO'?[Math.cos(r),0,Math.sin(r)]:[0,Math.cos(r),Math.sin(r)]);}
export const azOf=d=>norm360(deg(Math.atan2(d[0],d[1])));
export const az3=a=>String(Math.round(a*10)/10).padStart(3,'0');

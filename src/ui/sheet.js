/** Printable sheet: MTO table, PNG export of the iso + MTO, file names and downloads. */
import { esc, fmt } from '../core/format.js';
import { SEC, mto, qtyTxt } from '../core/mto.js';
import { S, V } from '../state.js';
import { toast } from './panels.js';
import { platform } from '../platform/index.js';
import { fitTo, ln, paint } from './sketch.js';
import { theme } from './theme.js';

export function bomHTML(){
  const {rows,tot}=mto();if(!rows.length)return '<p class="mute">Nothing yet.</p>';
  let h='<table class="bom"><tbody>',cur='';
  for(const r of rows){if(r.sec!==cur){cur=r.sec;h+=`<tr><th colspan="3">${SEC[cur]}</th></tr>`;}h+=`<tr><td class="rp">${r.rep}</td><td>${esc(r.des)}${r.sub?`<small>${esc(r.sub)}</small>`:''}</td><td class="q">${qtyTxt(r)}</td></tr>`;}
  h+='</tbody></table>';
  h+=`<div class="tot"><span>Pipe length</span><b>${fmt(tot.len/1000,2)} m</b><span>Pipe weight</span><b>${fmt(Math.round(tot.kg))} kg</b><span>Internal volume</span><b>${fmt(Math.round(tot.vol))} L</b><span>Butt welds</span><b>${tot.welds}</b><span>Inch-dia</span><b>${fmt(tot.idia,1)}</b></div>`;
  h+=`${S.D.loop?'<p class="warn">Closed loop: actual lengths do not close, the 3D ignores one segment.</p>':''}<p class="tag">Weights: pipe only. Bolting per ASME B16.5; stud length depends on facing and gasket. Validate data before procurement.</p>`;
  return h+'<div class="row"><button data-a="bomcopy" title="Copies as tab-separated text, pastes into any spreadsheet">Copy</button><button data-a="bomcsv">Export CSV</button></div>';
}
function drawSheet(ctx,W,H,T,x,cw){
  const m=S.M.meta,{rows,tot}=mto();
  ctx.fillStyle=T.paper;ctx.fillRect(x-20,0,W-x+20,H);
  const fitTxt=(t,mw)=>{t=String(t||'—');if(ctx.measureText(t).width<=mw)return t;while(t.length>1&&ctx.measureText(t+'…').width>mw)t=t.slice(0,-1);return t+'…';};
  ctx.textBaseline='middle';let y=26,cur='';
  ctx.font='700 20px "Barlow Condensed",sans-serif';ctx.fillStyle=T.ink;ctx.textAlign='left';ctx.fillText('Bill of materials (MTO)',x,y);y+=24;
  for(const r of rows){
    if(r.sec!==cur){cur=r.sec;y+=6;ctx.font='700 14px "Barlow Condensed",sans-serif';ctx.fillStyle=T.mute;ctx.textAlign='left';ctx.fillText(SEC[cur],x,y);ctx.strokeStyle=T.ink;ctx.lineWidth=1;ln(ctx,[x,y+9],[x+cw,y+9]);y+=20;}
    ctx.font='500 13px Barlow,sans-serif';ctx.fillStyle=T.mute;ctx.textAlign='left';ctx.fillText(String(r.rep),x,y);
    ctx.fillStyle=T.ink;ctx.fillText(fitTxt(r.des,cw-110),x+26,y);ctx.textAlign='right';ctx.fillText(qtyTxt(r),x+cw,y);
    ctx.strokeStyle=T.grid2;ln(ctx,[x,y+9],[x+cw,y+9]);y+=19;
  }
  y+=10;ctx.font='600 13px Barlow,sans-serif';ctx.fillStyle=T.ink;ctx.textAlign='left';
  ctx.fillText(`Pipe ${fmt(tot.len/1000,2)} m · ${fmt(Math.round(tot.kg))} kg · ${fmt(Math.round(tot.vol))} L · ${tot.welds} butt welds · ${fmt(tot.idia,1)} inch-dia`,x,y);
  const cr=[['Project',m.projet],['Line',m.ligne],['Fluid',m.fluide],['Revision',m.rev],['Frame',m.ref==='ship'?'Ship (FWD / AFT / PS / SB)':'Geographic (N / S / E / W)'],['Scale',`Not to scale · 1 cell = ${m.scale} mm`],['Date',new Date().toISOString().slice(0,10)]];
  const rh=26,ch=cr.length*rh,cy=H-ch-20;
  ctx.fillStyle=T.paper;ctx.fillRect(x,cy,cw,ch);ctx.strokeStyle=T.ink;ctx.lineWidth=1.5;ctx.strokeRect(x,cy,cw,ch);
  cr.forEach((r,i)=>{const yy=cy+i*rh;if(i)ln(ctx,[x,yy],[x+cw,yy]);ctx.textAlign='left';ctx.font='500 14px "Barlow Condensed",sans-serif';ctx.fillStyle=T.mute;ctx.fillText(r[0],x+8,yy+rh/2);ctx.font='600 17px "Barlow Condensed",sans-serif';ctx.fillStyle=T.ink;ctx.fillText(fitTxt(r[1],cw-104),x+96,yy+rh/2);});
  ln(ctx,[x+88,cy],[x+88,cy+ch]);
  ctx.strokeStyle=T.ink;ctx.lineWidth=1;ln(ctx,[x-20,14],[x-20,H-14]);
}
export function exportPNG(){
  const {rows}=mto(),secs=new Set(rows.map(r=>r.sec)).size,need=90+rows.length*19+secs*26+60+7*26+40;
  const W=2000,H=Math.max(1150,need),cw=520,x=W-cw-20,k=2,c=document.createElement('canvas');c.width=W*k;c.height=H*k;
  const ctx=c.getContext('2d');ctx.scale(k,k);const keep={...V},ks=S.sel;S.sel=null;
  fitTo(x-40,H,0,0);paint(ctx,W,H,true);drawSheet(ctx,W,H,theme(),x,cw);Object.assign(V,keep);S.sel=ks;
  c.toBlob(b=>{if(b)saveFile(fname()+'.png',b);},'image/png');
}
export const fname=()=>((S.M.meta.ligne||S.M.meta.projet||'iso-piping').trim().replace(/"/g,'in').replace(/[^\w.-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,60))||'iso-piping';
export async function saveFile(name,data){
  const r=await platform.saveFile({name,data});
  if(r===false)toast('Download unavailable in this view');
  else if(r&&platform.isDesktop)toast('Saved: '+name);
}

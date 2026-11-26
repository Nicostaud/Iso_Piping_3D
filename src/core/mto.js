/** Bill of materials (MTO) and its CSV / tab-separated export. */
import { fa, fmt } from './format.js';
import { compDes, nm, nm2 } from './labels.js';
import { nd, segLen } from './model.js';
import { CLS, boltOf, face, isAPI } from '../data/bolting.js';
import { CAT, FIG, FIGAUTO, figOf } from '../data/catalogue.js';
import { MAT } from '../data/materials.js';
import { NPS, kgm, lpm, schL, schOf, wtOf } from '../data/pipe.js';
import { S } from '../state.js';

export const SEC={T:'Pipe',F:'Butt-weld fittings',B:'Flanges',J:'Gaskets',G:'Bolting',V:'Valves',R:'Inline items',I:'Instrumentation',S:'Supports'};
export function mto(){
  const it=new Map(),tot={kg:0,vol:0,welds:0,idia:0,len:0};
  const add=(sec,key,des,sub,q,u,ord=0,kg=0)=>{const k=sec+'|'+key,e=it.get(k)||{sec,des,sub,q:0,u,ord,kg:0};e.q+=q;e.kg+=kg;it.set(k,e);};
  const weld=(n,inch)=>{tot.welds+=n;tot.idia+=n*inch;};
  const flg=(s,wn,blind,gk,sets,long)=>{
    const z=`${nm(s.nps)} ${CLS[s.cls]} ${face(s.cls)}`,mt=MAT[s.mat],o=-s.nps*100,api=isAPI(s.cls);
    if(wn)add('B',`wn|${s.nps}|${s.cls}|${schOf(s)}|${s.mat}`,api?`API 6A flange ${CLS[s.cls].replace('API ','')} ${face(s.cls)} for ${nm(s.nps)} pipe`:`WN flange ${z} ${schL(schOf(s))}`,`${api?'API 6A':'ASME B16.5'} · ${mt.fl}`,wn,'u',o);
    if(blind)add('B',`bl|${s.nps}|${s.cls}|${s.mat}`,api?`API 6A blind flange ${CLS[s.cls].replace('API ','')} for ${nm(s.nps)}`:`Blind flange ${z}`,`${api?'API 6A':'ASME B16.5'} · ${mt.fl}`,blind,'u',o+1);
    if(gk){const rtj=face(s.cls)==='RTJ',bx=s.cls==='A10'||s.cls==='A15';add('J',`gk|${s.nps}|${s.cls}`,rtj?`Ring gasket ${bx?'BX':'R/RX'} ${z}`:`Spiral wound gasket ${z} SS316/graphite`,rtj?(api?'API 6A':'ASME B16.20 · ring number per size'):'ASME B16.20 · inner and outer rings',gk,'u',o);}
    if(sets){
      const b=boltOf(s.cls,s.nps);
      if(b){add('G',`st|${b.d}|${s.mat}|${long?1:0}`,`Stud bolts ${b.d}"${long?' long (wafer / spectacle)':''}`,`${mt.bolt} · per ASME B16.5 (${b.n} per flange)`,b.n*sets,'u',-frac(b.d)*10);
            add('G',`nut|${b.d}|${s.mat}`,`Heavy hex nuts ${b.d}"`,mt.bolt.split(' / ')[1]||'',b.n*sets*2,'u',-frac(b.d)*10+.5);}
      else add('G',`set|${s.nps}|${s.cls}`,`Stud bolt set + nuts ${z}`,api?'API 6A · per flange size':'outside ASME B16.5 table',sets,'set',o);
    }
    weld(wn,NPS[s.nps].in);
  };
  for(const s of S.M.segs){
    const L=segLen(s),k=kgm(s);tot.len+=L;tot.kg+=k*L/1000;tot.vol+=lpm(s)*L/1000;
    add('T',`${s.nps}|${schOf(s)}|${s.mat}`,`Pipe ${nm2(s.nps)} ${schL(schOf(s))}`,`${MAT[s.mat].n} · ASME B36.10M · WT ${fmt(wtOf(s),2)} mm · ${fmt(k,1)} kg/m`,L/1000,'m',-s.nps*100,k*L/1000);
  }
  for(const [id,f] of S.D.fit){
    const ss=f.segs;if(!ss.length)continue;
    const big=ss.reduce((a,b)=>NPS[b.nps].od>NPS[a.nps].od?b:a),sm=ss.reduce((a,b)=>NPS[b.nps].od<NPS[a.nps].od?b:a),fit=MAT[big.mat].fit,inch=NPS[big.nps].in,o=-big.nps*100;
    if(f.type==='coude'){
      const a=Math.round(f.ang*10)/10,std=Math.abs(a-90)<.5||Math.abs(a-45)<.5;
      add('F',`el|${big.nps}|${schOf(big)}|${a}|${big.mat}`,std?`Elbow ${fa(a)}° LR ${nm(big.nps)} ${schL(schOf(big))}`:`Elbow ${fa(a)}° ${nm(big.nps)} ${schL(schOf(big))} (cut from 90° LR)`,`ASME B16.9 · ${fit}`,1,'u',o-a/1000);weld(2,inch);
    }else if(f.type==='te'){
      const lat=f.ang!=null&&Math.abs(f.ang-90)>.5,eq=big.nps===sm.nps;
      add('F',`te|${big.nps}|${sm.nps}|${lat?Math.round(f.ang):90}|${big.mat}`,lat?`Branch ${fa(f.ang)}° ${nm(big.nps)} × ${nm(sm.nps)} (fabricated)`:eq?`Equal tee ${nm(big.nps)} ${schL(schOf(big))}`:`Reducing tee ${nm(big.nps)} × ${nm(sm.nps)} ${schL(schOf(big))}`,lat?`reinforcement per ASME B31.3 · ${MAT[big.mat].n}`:`ASME B16.9 · ${fit}`,1,'u',o+1);
      weld(3,inch);
    }else if(f.type==='croix'){add('F',`cx|${big.nps}|${big.mat}`,`Cross ${nm(big.nps)} ${schL(schOf(big))}`,`ASME B16.9 · ${fit}`,1,'u',o+2);weld(4,inch);}
    else if(f.type==='reduc'){add('F',`rd|${big.nps}|${sm.nps}|${big.mat}`,`Concentric reducer ${nm(big.nps)} × ${nm(sm.nps)} ${schL(schOf(big))} × ${schL(schOf(sm))}`,`ASME B16.9 · ${fit}`,1,'u',o+3);weld(2,inch);}
    else if(f.type==='bout'){
      const e=nd(id).end,s=ss[0];
      if(e==='cap'){add('F',`cap|${s.nps}|${schOf(s)}|${s.mat}`,`Cap ${nm(s.nps)} ${schL(schOf(s))}`,`ASME B16.9 · ${MAT[s.mat].fit}`,1,'u',-s.nps*100+4);weld(1,NPS[s.nps].in);}
      else if(e==='blind')flg(s,1,1,1,1,false);
      else if(e==='plug')add('F',`plg|${s.nps}`,`Threaded plug ${nm(s.nps)} NPT 3000#`,`ASME B16.11 · ${MAT[s.mat].fl}`,1,'u',-s.nps*100+5);
      else if(e==='hucap'){const fg=nd(id).fig||FIGAUTO[s.cls]||'206';add('R',`huc|${s.nps}|${fg}`,`Hammer union cap ${nm(s.nps)} Fig ${fg} (${FIG[fg]})`,'cap + wing nut · BW sub',1,'u',-s.nps*100);weld(1,NPS[s.nps].in);}
    }
  }
  for(const c of S.M.comps){
    const s=S.D.SM.get(c.seg),k=CAT[c.type],o=-s.nps*100,inch=NPS[s.nps].in;
    switch(k.ends){
      case 'FL':flg(s,2,0,2,2,false);add(k.f==='v'?'V':'R',`${c.type}|${s.nps}|${s.cls}`,compDes(c),k.s||'',1,'u',o);break;
      case 'WAF':flg(s,2,0,c.type==='bfly'?0:2,1,true);add('V',`${c.type}|${s.nps}|${s.cls}`,compDes(c),c.type==='bfly'?`${k.s} · elastomer liner, no separate gasket`:k.s,1,'u',o);break;
      case 'FLJ':flg(s,2,0,1,1,false);break;
      case 'SPEC':flg(s,2,0,2,1,true);add('R',`spec|${s.nps}|${s.cls}`,compDes(c),k.s,1,'u',o);break;
      case 'HU':add(k.f==='v'?'V':'R',`${c.type}|${s.nps}|${figOf(c,s)}`,compDes(c),c.type==='hu'?'male + female + wing nut · BW subs':`${k.s} · hammer union ends`,1,'u',o);weld(2,inch);break;
      case 'GRV':add('R',`vic|${s.nps}`,compDes(c),k.s,1,'u',o);break;
      case 'THD':add(k.f==='v'?'V':'R',`${c.type}|${s.nps}`,compDes(c),k.s,1,'u',o);break;
      case 'TAP':{
        const pg=c.type==='pg',sz=pg?'1/2"':'3/4"';
        add('I',`olet|${sz}|${s.nps}`,`Thredolet ${sz} NPT 3000# on ${nm(s.nps)}`,`MSS SP-97 · ${MAT[s.mat].fl}`,1,'u',pg?1:2);weld(1,pg?.5:.75);
        if(pg){add('I','pgv','Isolation valve 1/2" NPT (needle)','6,000 psi',1,'u',3);add('I','pgg','Pressure gauge Ø100 1/2" NPT','EN 837-1 · range TBD',1,'u',4);}
        else{add('I','tgw','Thermowell 3/4" NPT','bar stock · length per line size',1,'u',5);add('I','tgt','Bimetal thermometer Ø100','EN 13190 · range TBD',1,'u',6);}
        break;}
      case 'SUP':add('S',`${c.type}|${s.nps}`,compDes(c),'per pipe support standard',1,'u',o);break;
    }
  }
  const order=Object.keys(SEC),rows=[...it.values()].sort((a,b)=>order.indexOf(a.sec)-order.indexOf(b.sec)||a.ord-b.ord||a.des.localeCompare(b.des));
  rows.forEach((r,i)=>r.rep=i+1);
  return {rows,tot};
}
function frac(d){const m=String(d).match(/^(\d+)?-?(\d+)\/(\d+)$/);if(!m)return +d||0;return (+(m[1]||0))+(+m[2])/(+m[3]);}
export const qtyTxt=r=>r.u==='m'?fmt(r.q,2)+' m':r.u==='set'?r.q+' set'+(r.q>1?'s':''):String(r.q);
export function table(sep){
  const {rows,tot}=mto(),q=v=>sep===','?'"'+String(v).replace(/"/g,'""')+'"':String(v).replace(/\t/g,' ');
  const lines=[['Item','Section','Description','Standard / material','Qty','Unit','Weight (kg)'].join(sep),...rows.map(r=>[r.rep,q(SEC[r.sec]),q(r.des),q(r.sub),r.u==='m'?r.q.toFixed(2):r.q,r.u,r.kg?r.kg.toFixed(1):''].join(sep))];
  lines.push('',['','Total','Pipe weight','',tot.kg.toFixed(0),'kg'].join(sep),['','Total','Internal volume','',tot.vol.toFixed(0),'L'].join(sep),['','Total','Butt welds','',tot.welds,'u'].join(sep),['','Total','Inch-dia','',tot.idia.toFixed(1),'in-dia'].join(sep));
  return lines.join('\n');
}
export const csv=()=>'﻿'+table(',');

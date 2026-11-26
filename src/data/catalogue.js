/** Component catalogue (valves, inline items, instruments, supports), end types, WECO figures. */
export const FIG={'100':'1,000 psi','200':'2,000 psi','206':'2,000 psi','400':'2,500–4,000 psi','602':'6,000 psi','1002':'10,000 psi','1502':'15,000 psi','2002':'20,000 psi','2202':'15,000 psi H2S'};
export const FIGAUTO={150:'206',300:'206',600:'206',900:'400',1500:'602',2500:'1002',A2:'206',A3:'400',A5:'602',A10:'1002',A15:'1502'};
export const CAT={
 gate:{f:'v',sh:'Gate',n:'Gate valve',s:'API 600',ends:'FL'},
 globe:{f:'v',sh:'Globe',n:'Globe valve',s:'BS 1873',ends:'FL'},
 ball:{f:'v',sh:'Ball',n:'Ball valve',s:'API 6D',ends:'FL'},
 bfly:{f:'v',sh:'Butterfly',n:'Butterfly valve, wafer',s:'API 609',ends:'WAF'},
 plug:{f:'v',sh:'Plug',n:'Plug valve, union ends',s:'high-pressure service',ends:'HU'},
 check:{f:'v',sh:'Check',n:'Swing check valve',s:'BS 1868',ends:'FL'},
 dcheck:{f:'v',sh:'Dual check',n:'Dual plate check valve, wafer',s:'API 594',ends:'WAF'},
 needle:{f:'v',sh:'Needle',n:'Needle valve',s:'NPT 6,000 psi',ends:'THD'},
 choke:{f:'v',sh:'Choke',n:'Adjustable choke',s:'API 6A',ends:'FL'},
 psv:{f:'v',sh:'PSV',n:'Pressure safety valve (PSV)',s:'API 526 · set pressure TBD',ends:'FL'},
 flange:{f:'r',sh:'Flanges',n:'Flange joint',ends:'FLJ'},
 hu:{f:'r',sh:'Hammer union',n:'WECO hammer union',ends:'HU'},
 vic:{f:'r',sh:'Victaulic',n:'Grooved coupling',s:'AWWA C606 · grooved ends',ends:'GRV'},
 tu:{f:'r',sh:'Thd union',n:'Threaded union 3000# NPT',s:'ASME B16.11',ends:'THD'},
 spec:{f:'r',sh:'Spectacle',n:'Spectacle blind',s:'ASME B16.48',ends:'SPEC'},
 ystr:{f:'r',sh:'Y-strainer',n:'Y-strainer',s:'stainless screen',ends:'FL'},
 pg:{f:'i',sh:'Gauge',n:'Pressure gauge',ends:'TAP'},
 tg:{f:'i',sh:'Thermometer',n:'Thermometer in thermowell',ends:'TAP'},
 shoe:{f:'s',sh:'Shoe',n:'Pipe shoe',ends:'SUP'},
 guide:{f:'s',sh:'Guide',n:'Guide',ends:'SUP'},
 anchor:{f:'s',sh:'Anchor',n:'Anchor',ends:'SUP'},
 hanger:{f:'s',sh:'Hanger',n:'Hanger',ends:'SUP'}};
export const FAM={v:'Valves',r:'Inline items',i:'Instruments',s:'Supports'};
export const famSel={v:'gate',r:'flange',i:'pg',s:'shoe'};
export const ENDS={'':'Open end',cap:'Cap (BW)',blind:'Blind flange',plug:'Threaded plug',hucap:'Hammer union cap'};
export const figOf=(c,s)=>c.fig&&c.fig!=='auto'&&FIG[c.fig]?c.fig:FIGAUTO[s.cls]||'206';
export function valveOp(c,s){
  if(c.type==='gate'||c.type==='globe'||c.type==='choke')return 'handwheel';
  if(c.type==='ball')return s.nps>=10?'gearbox':'lever';
  if(c.type==='bfly')return s.nps>=11?'gearbox':'lever';
  if(c.type==='plug')return 'T-wrench';
  return '';
}

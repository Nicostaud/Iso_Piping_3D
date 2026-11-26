/** Theme colours read from CSS custom properties; re-render on theme change. */
import { S } from '../state.js';
import { $ } from './dom.js';
import { buildPalette } from './panels.js';
import { draw2D } from './sketch.js';
import { mark3D } from '../view3d/scene.js';

export function theme(){
  if(S.TC)return S.TC;const pr=$('#probe'),g=v=>{pr.style.color=`var(${v})`;return getComputedStyle(pr).color;};
  S.TC={paper:g('--paper'),panel:g('--panel'),ink:g('--ink'),mute:g('--mute'),grid:g('--grid'),grid2:g('--grid2'),acc:g('--acc'),sky:g('--sky')};
  return S.TC;
}
const reTheme=()=>{S.TC=null;draw2D();mark3D();buildPalette();};

export function initTheme(){
new MutationObserver(reTheme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',reTheme);}catch(e){}
}

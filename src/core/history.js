/** Undo / redo and the change pipeline (derive → validate selection → persist → UI hook). */
import { derive, validSel } from './model.js';
import { persist } from './store.js';
import { RD, S, U, drawHist } from '../state.js';

/**
 * UI callbacks, registered by main.js so that core/ never imports ui/.
 * afterChange runs at the end of changed(); resetEntry clears the entry fields.
 */
const hooks = { afterChange() {}, resetEntry() {} };
/** @param {{afterChange?: () => void, resetEntry?: () => void}} h */
export function setHistoryHooks(h) { Object.assign(hooks, h); }

export function pushUndo(){U.push(JSON.stringify(S.M));if(U.length>200)U.shift();RD.length=0;}
function swap(from,to){
  if(!from.length)return false;to.push(JSON.stringify(S.M));
  const keep={...S.M.meta};S.M=JSON.parse(from.pop());
  for(const k of ['projet','ligne','fluide','rev','dims','els','dn','sch','cls','mat','ref','unit'])S.M.meta[k]=keep[k];
  S.drawFrom=null;hooks.resetEntry();drawHist.length=0;changed();return true;
}
export const undo=()=>swap(U,RD),redo=()=>swap(RD,U);
export function commit(fn){pushUndo();fn();changed();}
export function changed(){derive();validSel();persist();hooks.afterChange();}

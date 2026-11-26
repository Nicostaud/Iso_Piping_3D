/** localStorage persistence and migration of older storage keys (v4 → v1). */
import { S } from '../state.js';
import { normalize } from './model.js';

export const KEYS=['isopiping.v4','isopiping.v3','isopiping.v2','isopiping.v1'];
let onPersist=()=>{};
/** Registers a callback run after every persist (used for the unsaved-changes marker). */
export function setPersistHook(fn){onPersist=fn;}
export function persist(){try{localStorage.setItem(KEYS[0],JSON.stringify(S.M));}catch(e){}onPersist();}

/**
 * Loads the last model from localStorage, newest key first (v4 → v1), always
 * through normalize(). The bundled example of older versions is skipped.
 * @returns {object|null} normalized model, or null when nothing usable is stored
 */
export function loadStored(){
  let m=null;
  try{
    for(const key of KEYS){
      const t=localStorage.getItem(key);if(!t)continue;
      const o=JSON.parse(t),pj=(o.meta&&o.meta.projet)||'';if(/^Exemple/.test(pj)||(key!==KEYS[0]&&/^Example/.test(pj)))continue;
      m=normalize(o);break;
    }
  }catch(e){m=null;}
  return m;
}

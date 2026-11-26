/**
 * Bootstrap: assets, UI wiring and startup sequence (same order as V4.1).
 * No business logic here — see core/ (model, MTO, history, storage) and ui/.
 */
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './styles.css';

import { S, U, V } from './state.js';
import { changed, setHistoryHooks } from './core/history.js';
import { derive, normalize, sample } from './core/model.js';
import { csv, mto } from './core/mto.js';
import { loadStored, setPersistHook } from './core/store.js';
import { $ } from './ui/dom.js';
import { applyRef, clearF, initHud, setCons } from './ui/hud.js';
import { buildPalette, fillCart, initPanels, refreshUI, setTool, toast } from './ui/panels.js';
import { draw2D, initSketch } from './ui/sketch.js';
import { initActions } from './ui/actions.js';
import { initTheme } from './ui/theme.js';
import { initDocument, markDirty, openInitialProject, setDocument } from './ui/document.js';
import { initUpdates } from './ui/update.js';
import { initScene, mark3D, setView } from './view3d/scene.js';

setHistoryHooks({ afterChange: refreshUI, resetEntry: clearF });
setPersistHook(markDirty);
initDocument();
initHud();
initSketch();
initPanels();
initActions();
initScene();
initTheme();

if (new URLSearchParams(location.search).has('debug') || import.meta.env.MODE === 'test') {
  window.__iso = { S, V, mto, csv, derive, normalize };
}

S.M = loadStored();
const fresh = !S.M;
if (fresh) sample();
derive();
fillCart();
applyRef();
setCons('ortho');
setTool('pipe');
changed();
U.length = 0;
$('#bUndo').disabled = true;
setView('2d');
setDocument(null, null); // startup model comes from local storage: no file yet, nothing unsaved
initUpdates();
openInitialProject();
if (document.fonts) document.fonts.ready.then(() => { draw2D(); mark3D(); buildPalette(); });
setTimeout(() => toast(fresh ? 'Offshore example loaded · catalogue: keys 1–4 · MTO on the right · G: 3D model' : 'Catalogue: keys 1–4 · MTO on the right · G: 3D model'), 700);

/**
 * Current project document: file name, unsaved-changes marker and the
 * New / Open / Save / Save as commands (.isop project files, CLAUDE.md §7).
 */
import { changed, pushUndo } from '../core/history.js';
import { blank } from '../core/model.js';
import { parseProject, projectFileName, serializeProject, MIME } from '../core/project-file.js';
import { platform } from '../platform/index.js';
import { S } from '../state.js';
import { $ } from './dom.js';
import { applyRef } from './hud.js';
import { fillCart, setTool, toast } from './panels.js';
import { fname } from './sheet.js';
import { fit2D } from './sketch.js';
import { mark3D } from '../view3d/scene.js';

/** name: file name shown in the header (null = untitled); path: opaque platform path */
const doc = { name: null, path: null, dirty: false };

function render() {
  const label = (doc.name || 'Untitled') + (doc.dirty ? '*' : '');
  const el = $('#docName');
  if (el) {
    el.textContent = label;
    el.title = doc.dirty ? 'Unsaved changes' : '';
  }
  document.title = doc.name || doc.dirty ? `${label} — Iso Piping 3D` : 'Iso Piping 3D';
}

export const isDirty = () => doc.dirty;
export const docInfo = () => ({ ...doc });

/** Called on every persisted model change. */
export function markDirty() {
  if (doc.dirty) return;
  doc.dirty = true;
  render();
}

/** Associates the model with a file (or none) and clears the unsaved marker. */
export function setDocument(name, path) {
  doc.name = name || null;
  doc.path = path || null;
  doc.dirty = false;
  render();
}

/** New blank sheet (undoable with Ctrl+Z, as in V4.1). */
export function newProject() {
  pushUndo();
  S.M = blank({ ...S.M.meta, projet: '', ligne: '', fluide: '', rev: 'A' });
  S.sel = null; S.drawFrom = null;
  changed(); fillCart(); fit2D();
  if (S.G3) S.G3.fitted = false;
  setTool('pipe');
  setDocument(null, null);
  toast('Blank sheet · Ctrl+Z to go back');
}

/** Opens an .isop project or a raw Iso Piping JSON model (v1 to v4). */
export async function openProject() {
  let f;
  try { f = await platform.openProject(); } catch (e) { toast('File could not be read'); return; }
  if (!f) return;
  let m;
  try {
    m = parseProject(f.text).model;
  } catch (err) {
    toast(err && err.message === 'newer' ? 'Project saved by a newer version of Iso Piping 3D' : 'File not recognised (Iso Piping project or JSON expected)');
    return;
  }
  pushUndo();
  S.M = m; S.sel = null; S.drawFrom = null;
  applyRef(); changed(); fillCart(); fit2D();
  if (S.G3) S.G3.fitted = false;
  mark3D();
  setDocument(f.name, f.path);
  toast('File opened: ' + f.name);
}

/** Saves the project in place when possible; saveAs always asks for a location. */
export async function saveProject(saveAs = false) {
  const name = projectFileName(doc.name, fname());
  let r;
  try {
    r = await platform.saveProject({ text: serializeProject(S.M), name, path: doc.path || undefined, saveAs, mime: MIME });
  } catch (e) {
    toast('Project not saved' + (e && e.message ? ': ' + e.message : ''));
    return;
  }
  if (!r) return; // cancelled
  setDocument(r.name, r.path);
  toast('Saved: ' + r.name);
}

export function initDocument() {
  render();
  platform.onBeforeClose(() => doc.dirty && !!doc.name);
  // File shortcuts work everywhere, including inside form fields.
  addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 's') { e.preventDefault(); e.stopImmediatePropagation(); saveProject(e.shiftKey); }
    else if (k === 'o' && !e.shiftKey) { e.preventDefault(); e.stopImmediatePropagation(); openProject(); }
    else if (k === 'n' && !e.shiftKey) { e.preventDefault(); e.stopImmediatePropagation(); newProject(); }
  }, true);
}

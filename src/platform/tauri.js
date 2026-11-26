/**
 * Desktop implementation of the platform contract (Tauri v2, see ./index.js).
 * Native dialogs (plugin-dialog) and file access (plugin-fs). The fs scope is
 * empty: only paths picked in a dialog are allowed, added at runtime by the
 * dialog plugin, plus an .isop file opened from Explorer (see src-tauri/src/lib.rs).
 */
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ask, open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeFile, writeTextFile } from '@tauri-apps/plugin-fs';

const FILTERS = {
  png: { name: 'PNG image', extensions: ['png'] },
  csv: { name: 'CSV file', extensions: ['csv'] },
  json: { name: 'JSON file', extensions: ['json'] },
  isop: { name: 'Iso Piping project', extensions: ['isop'] },
};
const OPEN_FILTERS = [{ name: 'Iso Piping project', extensions: ['isop', 'json'] }];

const ext = (name) => (name.match(/\.([^.\\/]+)$/) || [])[1]?.toLowerCase();
/** File name of a Windows or POSIX path. */
export const baseName = (p) => String(p).split(/[\\/]/).pop();
/** Same directory as `path`, other file name. */
export const sibling = (path, name) => String(path).replace(/[^\\/]*$/, name);
const isProject = (p) => /\.isop$/i.test(String(p || ''));

async function write(path, data) {
  if (typeof data === 'string') return writeTextFile(path, data);
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(await data.arrayBuffer());
  return writeFile(path, bytes);
}

/**
 * @param {{ name: string, mime?: string, data: string | Blob | Uint8Array }} f
 * @returns {Promise<boolean|null>} true saved, false failed, null cancelled
 */
async function saveFile({ name, data }) {
  const f = FILTERS[ext(name)];
  const path = await save({ defaultPath: name, ...(f ? { filters: [f] } : {}) });
  if (!path) return null;
  try {
    await write(path, data);
    return true;
  } catch (e) {
    return false;
  }
}

/** @returns {Promise<{ name: string, path: string, text: string } | null>} */
async function openProject() {
  const path = await open({ multiple: false, directory: false, filters: OPEN_FILTERS });
  if (!path || typeof path !== 'string') return null;
  return { name: baseName(path), path, text: await readTextFile(path) };
}

/**
 * Writes in place when the document is an .isop file and saveAs is false;
 * otherwise asks for a location (next to the current file when there is one).
 * @param {{ text: string, name: string, path?: string, saveAs?: boolean }} p
 * @returns {Promise<{ path: string, name: string } | null>} null when cancelled
 */
async function saveProject({ text, name, path, saveAs }) {
  let target = !saveAs && isProject(path) ? path : null;
  if (!target) {
    target = await save({ defaultPath: path ? sibling(path, name) : name, filters: [FILTERS.isop] });
    if (!target) return null;
  }
  await writeTextFile(target, text);
  return { path: target, name: baseName(target) };
}

/** @param {() => boolean} handler true when closing must be confirmed */
function onBeforeClose(handler) {
  getCurrentWindow().onCloseRequested(async (e) => {
    if (!handler()) return;
    const close = await ask('There are unsaved changes. Close Iso Piping 3D without saving?', {
      title: 'Unsaved changes',
      kind: 'warning',
      okLabel: 'Close without saving',
      cancelLabel: 'Cancel',
    });
    if (!close) e.preventDefault();
  });
}

/** @param {string} title */
function setTitle(title) {
  getCurrentWindow().setTitle(title).catch(() => {});
}

/** Project file passed on the command line (file association), if any. */
async function initialProject() {
  try {
    return (await invoke('initial_file')) || null;
  } catch (e) {
    return null;
  }
}

export const tauriPlatform = {
  isDesktop: true,
  saveFile,
  openProject,
  saveProject,
  onBeforeClose,
  setTitle,
  initialProject,
};

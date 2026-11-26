/**
 * Web implementation of the platform contract (see ./index.js).
 * Uses the File System Access API when available (Chromium: Chrome, Edge),
 * otherwise <a download> for saving and <input type="file"> for opening.
 */

const hasSavePicker = () => typeof window.showSaveFilePicker === 'function';
const hasOpenPicker = () => typeof window.showOpenFilePicker === 'function';
const isAbort = (e) => e && (e.name === 'AbortError' || e.code === 20);

/** File handles of opened/saved projects, keyed by an opaque path id. */
const handles = new Map();
let nextHandle = 1;
const keep = (h) => { const id = `web-handle:${nextHandle++}`; handles.set(id, h); return id; };

const PROJECT_TYPE = { description: 'Iso Piping project', accept: { 'application/json': ['.isop', '.json'] } };
const TYPES = {
  png: { description: 'PNG image', accept: { 'image/png': ['.png'] } },
  csv: { description: 'CSV file', accept: { 'text/csv': ['.csv'] } },
  json: { description: 'JSON file', accept: { 'application/json': ['.json'] } },
  isop: { description: 'Iso Piping project', accept: { 'application/json': ['.isop'] } },
};
const ext = (name) => (name.match(/\.([^.]+)$/) || [])[1]?.toLowerCase();
const toBlob = (data, mime) => (data instanceof Blob ? data : new Blob([data], mime ? { type: mime } : undefined));

function download(name, blob) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 5000);
}

async function writeHandle(handle, blob) {
  const w = await handle.createWritable();
  await w.write(blob);
  await w.close();
}

/**
 * @param {{ name: string, mime?: string, data: string | Blob | Uint8Array }} f
 * @returns {Promise<boolean|null>} true saved, false failed, null cancelled by the user
 */
async function saveFile({ name, mime, data }) {
  const blob = toBlob(data, mime);
  if (hasSavePicker()) {
    try {
      const t = TYPES[ext(name)];
      const h = await window.showSaveFilePicker({ suggestedName: name, ...(t ? { types: [t] } : {}) });
      await writeHandle(h, blob);
      return true;
    } catch (e) {
      if (isAbort(e)) return null;
      // picker refused (e.g. inside a cross-origin iframe): fall back to a download
    }
  }
  try {
    download(name, blob);
    return true;
  } catch (e) {
    return false;
  }
}

function pickWithInput(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => resolve((input.files && input.files[0]) || null));
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

/**
 * @returns {Promise<{ name: string, path?: string, text: string } | null>} null when cancelled
 */
async function openProject() {
  if (hasOpenPicker()) {
    try {
      const [h] = await window.showOpenFilePicker({ types: [PROJECT_TYPE], multiple: false });
      const f = await h.getFile();
      return { name: f.name, path: keep(h), text: await f.text() };
    } catch (e) {
      if (isAbort(e)) return null;
    }
  }
  const f = await pickWithInput('.isop,.json,application/json');
  if (!f) return null;
  return { name: f.name, text: await f.text() };
}

/**
 * Saves a project. Writes in place when the document has a writable handle and
 * saveAs is false; otherwise asks for a location (or downloads).
 * @param {{ text: string, name: string, path?: string, saveAs?: boolean }} p
 * @returns {Promise<{ path?: string, name: string } | null>} null when cancelled
 * @throws {Error} when writing fails
 */
async function saveProject({ text, name, path, saveAs }) {
  const blob = toBlob(text, 'application/json');
  const h = path && handles.get(path);
  if (h && !saveAs && h.name.toLowerCase().endsWith('.isop')) {
    await writeHandle(h, blob);
    return { path, name: h.name };
  }
  if (hasSavePicker()) {
    try {
      const nh = await window.showSaveFilePicker({ suggestedName: name, types: [TYPES.isop] });
      await writeHandle(nh, blob);
      return { path: keep(nh), name: nh.name };
    } catch (e) {
      if (isAbort(e)) return null;
    }
  }
  download(name, blob);
  return { name };
}

/**
 * @param {() => boolean} handler returns true when closing should be confirmed
 */
function onBeforeClose(handler) {
  window.addEventListener('beforeunload', (e) => {
    if (handler()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

export const webPlatform = {
  isDesktop: false,
  saveFile,
  openProject,
  saveProject,
  onBeforeClose,
};

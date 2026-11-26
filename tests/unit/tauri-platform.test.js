// Desktop platform logic with the Tauri modules mocked (the real app is built in CI on Windows).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls = { save: [], open: [], writeText: [], writeBin: [], read: [], title: [], ask: [] };
let saveResult, openResult, askResult, closeHandler;

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(async (o) => { calls.save.push(o); return saveResult; }),
  open: vi.fn(async (o) => { calls.open.push(o); return openResult; }),
  ask: vi.fn(async (m, o) => { calls.ask.push([m, o]); return askResult; }),
}));
vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async (p, t) => { calls.writeText.push([p, t]); }),
  writeFile: vi.fn(async (p, b) => { calls.writeBin.push([p, b]); }),
  readTextFile: vi.fn(async (p) => { calls.read.push(p); return '{"text":1}'; }),
}));
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    setTitle: async (t) => { calls.title.push(t); },
    onCloseRequested: (h) => { closeHandler = h; },
  }),
}));
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (cmd) => (cmd === 'initial_file' ? { path: 'C:\\p\\a.isop', name: 'a.isop', text: '{}' } : null)),
  isTauri: () => true,
}));

const { tauriPlatform: P, baseName, sibling } = await import('../../src/platform/tauri.js');
const { platform } = await import('../../src/platform/index.js');

beforeEach(() => { for (const k in calls) calls[k].length = 0; saveResult = openResult = askResult = undefined; });

describe('desktop platform (Tauri)', () => {
  it('is selected when running inside Tauri', () => {
    expect(platform).toBe(P);
    expect(P.isDesktop).toBe(true);
  });

  it('path helpers handle Windows paths', () => {
    expect(baseName('C:\\Users\\eng\\line 6.isop')).toBe('line 6.isop');
    expect(sibling('C:\\Users\\eng\\old.json', 'old.isop')).toBe('C:\\Users\\eng\\old.isop');
  });

  it('saveFile: native dialog with a type filter, text and binary writes, cancel → null', async () => {
    saveResult = 'C:\\out\\line-MTO.csv';
    expect(await P.saveFile({ name: 'line-MTO.csv', data: '\uFEFFItem' })).toBe(true);
    expect(calls.save[0]).toEqual({ defaultPath: 'line-MTO.csv', filters: [{ name: 'CSV file', extensions: ['csv'] }] });
    expect(calls.writeText).toEqual([['C:\\out\\line-MTO.csv', '\uFEFFItem']]);

    saveResult = 'C:\\out\\line.png';
    expect(await P.saveFile({ name: 'line.png', data: new Blob([new Uint8Array([137, 80, 78, 71])]) })).toBe(true);
    expect(calls.writeBin[0][1]).toEqual(new Uint8Array([137, 80, 78, 71]));

    saveResult = null;
    expect(await P.saveFile({ name: 'x.png', data: 'x' })).toBeNull();
  });

  it('openProject: .isop / .json filter, reads the picked file', async () => {
    openResult = 'D:\\rig\\kill line.isop';
    expect(await P.openProject()).toEqual({ name: 'kill line.isop', path: 'D:\\rig\\kill line.isop', text: '{"text":1}' });
    expect(calls.open[0].filters).toEqual([{ name: 'Iso Piping project', extensions: ['isop', 'json'] }]);
    openResult = null;
    expect(await P.openProject()).toBeNull();
  });

  it('saveProject: in place for an .isop path, dialog otherwise', async () => {
    expect(await P.saveProject({ text: 'T1', name: 'a.isop', path: 'C:\\p\\a.isop' })).toEqual({ path: 'C:\\p\\a.isop', name: 'a.isop' });
    expect(calls.save).toHaveLength(0);
    expect(calls.writeText).toEqual([['C:\\p\\a.isop', 'T1']]);

    saveResult = 'C:\\p\\b.isop';
    expect(await P.saveProject({ text: 'T2', name: 'a.isop', path: 'C:\\p\\a.isop', saveAs: true })).toEqual({ path: 'C:\\p\\b.isop', name: 'b.isop' });
    expect(calls.save[0]).toEqual({ defaultPath: 'C:\\p\\a.isop', filters: [{ name: 'Iso Piping project', extensions: ['isop'] }] });

    // a raw .json document is never overwritten: Save asks for an .isop next to it
    saveResult = 'C:\\p\\old.isop';
    await P.saveProject({ text: 'T3', name: 'old.isop', path: 'C:\\p\\old.json' });
    expect(calls.save[1].defaultPath).toBe('C:\\p\\old.isop');

    saveResult = null;
    expect(await P.saveProject({ text: 'T4', name: 'n.isop' })).toBeNull();
  });

  it('close confirmation only when the handler reports unsaved changes', async () => {
    let dirty = false;
    P.onBeforeClose(() => dirty);
    const evt = () => ({ prevented: false, preventDefault() { this.prevented = true; } });
    let e = evt(); await closeHandler(e);
    expect(calls.ask).toHaveLength(0); expect(e.prevented).toBe(false);
    dirty = true; askResult = false; e = evt(); await closeHandler(e);
    expect(calls.ask).toHaveLength(1); expect(e.prevented).toBe(true);
    askResult = true; e = evt(); await closeHandler(e);
    expect(e.prevented).toBe(false);
  });

  it('window title and file association', async () => {
    P.setTitle('Iso Piping 3D — a.isop*');
    await Promise.resolve();
    expect(calls.title).toEqual(['Iso Piping 3D — a.isop*']);
    expect(await P.initialProject()).toEqual({ path: 'C:\\p\\a.isop', name: 'a.isop', text: '{}' });
  });
});

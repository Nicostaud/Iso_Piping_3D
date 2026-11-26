// .isop project files: header name + unsaved marker, Ctrl+S / Ctrl+Shift+S / Ctrl+O / Ctrl+N,
// download / file-input fallback and File System Access API (mocked pickers).
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectErrors, noPickers } from './helpers.js';

const FX = (f) => fileURLToPath(new URL(`../fixtures/${f}`, import.meta.url));
const model = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__iso.S.M)));
const docName = (page) => page.locator('#docName');

test('fallback: save downloads an .isop, open reads .isop and raw .json', async ({ page }) => {
  const errors = collectErrors(page);
  await noPickers(page);
  await page.goto('/?debug=1');
  await expect(docName(page)).toHaveText('Untitled');
  await expect(page).toHaveTitle('Iso Piping 3D');

  // Ctrl+S → download of <line>.isop
  const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
  expect(dl.suggestedFilename()).toBe('6in-SW-2001-D1.isop');
  const saved = JSON.parse(readFileSync(await dl.path(), 'utf8'));
  expect(saved).toMatchObject({ app: 'iso-piping-3d', format: 1 });
  expect(Date.parse(saved.savedAt)).toBeGreaterThan(0);
  expect(saved.model).toEqual(await model(page));
  await expect(docName(page)).toHaveText('6in-SW-2001-D1.isop');

  // Any change → '*'
  await page.locator('#mRev').fill('B');
  await expect(docName(page)).toHaveText('6in-SW-2001-D1.isop*');
  await expect(page).toHaveTitle('6in-SW-2001-D1.isop* — Iso Piping 3D');

  // Ctrl+O → .isop fixture
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Control+o')]);
  expect(await fc.element().getAttribute('accept')).toBe('.isop,.json,application/json');
  await fc.setFiles(FX('hp-600.isop'));
  await expect(docName(page)).toHaveText('hp-600.isop');
  expect(await model(page)).toEqual(JSON.parse(readFileSync(FX('hp-600.isop'), 'utf8')).model);
  await expect(page.locator('#mProjet')).toHaveValue('HP gas - test fixture');

  // Open… button → raw v3 JSON (migrated through normalize)
  const [fc2] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#bOpen').click()]);
  await fc2.setFiles(FX('legacy-v3.json'));
  await expect(docName(page)).toHaveText('legacy-v3.json');
  const m = await model(page);
  expect(m.v).toBe(4);
  expect(m.meta.ligne).toBe('8in-PW-3001');
  // saving a .json document creates an .isop, never overwrites the raw JSON
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.locator('#bSave').click()]);
  expect(dl2.suggestedFilename()).toBe('legacy-v3.isop');

  // Undo brings back the previous document's geometry (V4.1 undo keeps the current title block)
  await page.keyboard.press('Control+z');
  expect((await model(page)).segs).toEqual(JSON.parse(readFileSync(FX('hp-600.isop'), 'utf8')).model.segs);

  // Unrecognised file
  const [fc3] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Control+o')]);
  await fc3.setFiles({ name: 'bad.isop', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await expect(page.locator('#toast')).toHaveText('File not recognised (Iso Piping project or JSON expected)');

  // Ctrl+N → blank untitled sheet
  await page.keyboard.press('Control+n');
  await expect(docName(page)).toHaveText('Untitled');
  expect((await model(page)).segs).toEqual([]);
  expect(errors).toEqual([]);
});

test('File System Access API: save in place, Save as, open with handle', async ({ page }) => {
  const errors = collectErrors(page);
  const openText = readFileSync(FX('geo-utility.isop'), 'utf8');
  await page.addInitScript((openText) => {
    const log = (window.__fs = { save: [], writes: [] });
    const handle = (name) => ({
      name,
      async createWritable() {
        let buf = '';
        return { async write(b) { buf += typeof b === 'string' ? b : await b.text(); }, async close() { log.writes.push({ name, text: buf }); } };
      },
      async getFile() { return new File([openText], name, { type: 'application/json' }); },
    });
    let n = 0;
    window.showSaveFilePicker = async (opts) => { log.save.push(opts); n++; return handle(n === 1 ? 'picked.isop' : 'copy.isop'); };
    window.showOpenFilePicker = async () => [handle('site-survey.isop')];
  }, openText);
  await page.goto('/?debug=1');

  await page.keyboard.press('Control+s');
  await expect(docName(page)).toHaveText('picked.isop');
  let fs = await page.evaluate(() => window.__fs);
  expect(fs.save).toHaveLength(1);
  expect(fs.save[0].suggestedName).toBe('6in-SW-2001-D1.isop');
  expect(fs.writes.map((w) => w.name)).toEqual(['picked.isop']);

  // edit + Ctrl+S → written in place, no picker
  await page.locator('#mFluide').fill('Seawater');
  await expect(docName(page)).toHaveText('picked.isop*');
  await page.keyboard.press('Control+s');
  await expect(docName(page)).toHaveText('picked.isop');
  fs = await page.evaluate(() => window.__fs);
  expect(fs.save).toHaveLength(1);
  expect(fs.writes).toHaveLength(2);
  expect(JSON.parse(fs.writes[1].text).model.meta.fluide).toBe('Seawater');

  // Ctrl+Shift+S → picker again
  await page.keyboard.press('Control+Shift+s');
  await expect(docName(page)).toHaveText('copy.isop');
  fs = await page.evaluate(() => window.__fs);
  expect(fs.save).toHaveLength(2);

  // Open through the picker, then save in place to the opened file
  await page.keyboard.press('Control+o');
  await expect(docName(page)).toHaveText('site-survey.isop');
  expect((await model(page)).meta.ligne).toBe('6"-UW-1001-A1');
  await page.locator('#bSave').click();
  await expect.poll(() => page.evaluate(() => window.__fs.writes.at(-1).name)).toBe('site-survey.isop');
  fs = await page.evaluate(() => window.__fs);
  expect(fs.save).toHaveLength(2);

  // PNG export goes through the save picker with a PNG type
  await page.locator('#bPng').click();
  await expect.poll(() => page.evaluate(() => window.__fs.save.length)).toBe(3);
  fs = await page.evaluate(() => window.__fs);
  expect(fs.save[2].suggestedName).toBe('6in-UW-1001-A1.png');
  expect(Object.keys(fs.save[2].types[0].accept)).toEqual(['image/png']);
  expect(errors).toEqual([]);
});

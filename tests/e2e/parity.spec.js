// Parity with legacy/index.html (CLAUDE.md §9): same CSV byte for byte,
// 2D canvas within 0.5 % of pixels, same number of 3D meshes, no console error.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { routeLegacy, seed, LEGACY_URL } from './parity-harness.js';
import { guardNetwork, collectErrors } from './helpers.js';

const fixture = (f) => JSON.parse(readFileSync(new URL(`../fixtures/${f}`, import.meta.url), 'utf8'));

const CASES = [
  { name: 'sample', seed: null },
  { name: 'geo-utility', seed: { key: 'isopiping.v4', model: fixture('geo-utility.isop').model } },
  { name: 'hp-600', seed: { key: 'isopiping.v4', model: fixture('hp-600.isop').model } },
  // Raw v3 model under the v3 storage key: exercises the KEYS migration + normalize().
  { name: 'legacy-v3', seed: { key: 'isopiping.v3', model: fixture('legacy-v3.json') } },
];
const VIEWPORTS = [{ width: 1440, height: 900 }, { width: 390, height: 844 }];
const THEMES = ['light', 'dark'];
// CLAUDE.md §9 allows up to 0.5 %. The refactor renders pixel-identical, and a 0.5 % budget
// misses real regressions (a +1 px stroke on every pipe changes only ~0.04 %), so require 0.
const MAX_DIFF = 0;

const SIDES = {
  legacy: { hook: 'window.__t', G3: 'window.__t.G3' },
  app: { hook: 'window.__iso', G3: 'window.__iso.S.G3' },
};

async function open(browser, side, c, viewport, colorScheme) {
  const ctx = await browser.newContext({ viewport, colorScheme, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  const external = side === 'legacy' ? await routeLegacy(page) : await guardNetwork(page);
  await seed(page, c.seed);
  await page.goto(side === 'legacy' ? LEGACY_URL : '/?debug=1');
  await page.waitForFunction((h) => !!eval(h), SIDES[side].hook);
  await page.evaluate(() => document.fonts.ready);
  await settle(page);
  return { ctx, page, errors, external, side };
}

const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));

const csvOf = (s) => s.page.evaluate((h) => eval(h).csv(), SIDES[s.side].hook);
const canvasPng = async (page, sel) => PNG.sync.read(Buffer.from((await page.evaluate((q) => {
  const c = document.querySelector(q);
  return c.toDataURL('image/png');
}, sel)).split(',')[1], 'base64'));

function diffRatio(a, b, testInfo, label) {
  expect([a.width, a.height], `${label} canvas size`).toEqual([b.width, b.height]);
  const out = new PNG({ width: a.width, height: a.height });
  const n = pixelmatch(a.data, b.data, out.data, a.width, a.height, { threshold: 0 });
  const ratio = n / (a.width * a.height);
  testInfo.annotations.push({ type: `${label} pixel diff`, description: `${n} px (${(ratio * 100).toFixed(4)} %)` });
  if (ratio > 0) testInfo.attach(`${label}-diff.png`, { body: PNG.sync.write(out), contentType: 'image/png' });
  return ratio;
}

const meshCount = (s) => s.page.evaluate((g) => {
  let n = 0;
  eval(g).scene.traverse((o) => { if (o.isMesh) n++; });
  return n;
}, SIDES[s.side].G3);

for (const c of CASES) {
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`parity ${c.name} · ${vp.width}x${vp.height} · ${theme}`, async ({ browser }, testInfo) => {
        const L = await open(browser, 'legacy', c, vp, theme);
        const A = await open(browser, 'app', c, vp, theme);
        try {
          // MTO / CSV, byte for byte.
          const [cl, ca] = [await csvOf(L), await csvOf(A)];
          expect(ca.length).toBeGreaterThan(100);
          expect(ca).toBe(cl);

          // 2D canvas.
          const [l2, a2] = [await canvasPng(L.page, '#cv'), await canvasPng(A.page, '#cv')];
          const r2 = diffRatio(l2, a2, testInfo, '2d');
          await A.page.screenshot({ path: testInfo.outputPath('app-2d.png') });
          expect(r2, '2D pixel difference ratio').toBeLessThanOrEqual(MAX_DIFF);

          // 3D: same UI action on both sides, then mesh count and pixels.
          for (const s of [L, A]) {
            await s.page.locator('#bGen').click();
            await s.page.waitForFunction((g) => { const G = eval(g); return G && G.group.children.length > 0; }, SIDES[s.side].G3);
            await settle(s.page);
          }
          const [ml, ma] = [await meshCount(L), await meshCount(A)];
          expect(ma).toBeGreaterThan(0);
          expect(ma, '3D mesh count').toBe(ml);
          const [l3, a3] = [await canvasPng(L.page, '#v3 canvas'), await canvasPng(A.page, '#v3 canvas')];
          const r3 = diffRatio(l3, a3, testInfo, '3d');
          await A.page.screenshot({ path: testInfo.outputPath('app-3d.png') });
          expect(r3, '3D pixel difference ratio').toBeLessThanOrEqual(MAX_DIFF);

          expect(L.external, 'legacy test copy: no external request').toEqual([]);
          expect(A.external, 'app: no external request').toEqual([]);
          expect(L.errors, 'legacy console errors').toEqual([]);
          expect(A.errors, 'app console errors').toEqual([]);
        } finally {
          await L.ctx.close();
          await A.ctx.close();
        }
      });
    }
  }
}

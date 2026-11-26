// Interaction parity: the same mouse/keyboard script is played on the legacy
// test copy and on the app, in lockstep. After every step the model, the
// selection, the tool and the view must be identical; at the end the CSV and
// the 2D canvas must match as well. This covers the UI wiring that the static
// parity test cannot see (tools, HUD entry, side panel, undo/redo, eraser…).
import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { routeLegacy, seed, LEGACY_URL } from './parity-harness.js';
import { guardNetwork, collectErrors } from './helpers.js';

const VIEWPORT = { width: 1440, height: 900 };
const HOOK = { legacy: 'window.__t', app: 'window.__iso.S' };

async function open(browser, side) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, serviceWorkers: 'block', colorScheme: 'light' });
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  const external = side === 'legacy' ? await routeLegacy(page) : await guardNetwork(page);
  await seed(page, null);
  await page.goto(side === 'legacy' ? LEGACY_URL : '/?debug=1');
  await page.waitForFunction((h) => { try { return !!eval(h).M; } catch (e) { return false; } }, HOOK[side]);
  await page.evaluate(() => document.fonts.ready);
  await settle(page);
  return { side, ctx, page, errors, external };
}

const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

const snapshot = (s) => s.page.evaluate((h) => {
  const o = eval(h);
  return { M: JSON.stringify(o.M), sel: o.sel, tool: o.tool, view: o.view };
}, HOOK[s.side]);

/** Screen point (page coordinates) of a model feature, computed on the app side. */
async function at(s, kind, idx, t) {
  const box = await s.page.locator('#cv').boundingBox();
  const [x, y] = await s.page.evaluate(([kind, idx, t]) => {
    const { S, V } = window.__iso;
    const C30 = Math.sqrt(3) / 2, P = (x, y, z) => [C30 * (x + y), -(0.5 * (y - x) + z)];
    const nd = (id) => S.M.nodes.find((q) => q.id === id);
    const toS = (p) => { const q = P(p.x, p.y, p.z); return [V.ox + q[0] * V.s, V.oy + q[1] * V.s]; };
    const segPt = (s, tt) => { const a = toS(nd(s.a)), b = toS(nd(s.b)); return [a[0] + (b[0] - a[0]) * tt, a[1] + (b[1] - a[1]) * tt]; };
    if (kind === 'seg') {
      const s = S.M.segs[idx];
      let tt = t;
      if (tt == null) { // a spot far from any component on that segment
        const ts = S.M.comps.filter((c) => c.seg === s.id).map((c) => c.t);
        tt = [0.5, 0.3, 0.7, 0.15, 0.85].find((v) => ts.every((u) => Math.abs(u - v) > 0.12)) ?? 0.5;
      }
      return segPt(s, tt);
    }
    if (kind === 'comp') { const c = S.M.comps[idx]; return segPt(S.M.segs.find((q) => q.id === c.seg), c.t); }
    if (kind === 'node') return toS(nd(idx));
    if (kind === 'grid') return [idx, t];
    throw new Error(kind);
  }, [kind, idx, t]);
  return [box.x + x, box.y + y];
}

test('interaction parity: tools, HUD entry, side panel, undo/redo, eraser, 3D', async ({ browser }) => {
  test.setTimeout(120_000);
  const L = await open(browser, 'legacy');
  const A = await open(browser, 'app');
  let n = 0;
  const step = async (label, fn) => {
    n++;
    for (const s of [L, A]) {
      await fn(s.page, s);
      await settle(s.page);
    }
    const [sl, sa] = [await snapshot(L), await snapshot(A)];
    expect(sa, `step ${n}: ${label}`).toEqual(sl);
    // Same errors on both sides at the same step (legacy bugs are reproduced, not fixed).
    expect(A.errors, `step ${n}: ${label} — console errors`).toEqual(L.errors);
  };
  // Coordinates are computed once on the app page and replayed on both sides.
  const click = async (page, pt) => { await page.mouse.move(pt[0], pt[1]); await page.mouse.click(pt[0], pt[1]); };
  const P = {};
  const where = async (key, kind, idx, t) => { P[key] = await at(A, kind, idx, t); };

  try {
    await step('initial state', async () => {});

    // Valves palette (key 1) → place a gate, then a ball from the palette.
    await where('s0', 'seg', 0);
    await step('key 1 + place gate', async (p) => { await p.keyboard.press('1'); await click(p, P.s0); });
    await where('s2', 'seg', 2);
    await step('palette ball + place', async (p) => { await p.locator('[data-ct="ball"]').click(); await click(p, P.s2); });
    await step('inline items (key 2) + place flange', async (p) => { await p.keyboard.press('2'); await click(p, P.s2); });

    // Select a segment, edit its spec and length from the side panel.
    await where('s1', 'seg', 1);
    await step('select segment', async (p) => { await p.keyboard.press('v'); await click(p, P.s1); });
    await step('size from side panel', async (p) => { await p.locator('[data-f="snps"]').selectOption('9'); });
    await step('length from side panel', async (p) => { await p.locator('[data-f="L"]').fill('2750'); await p.locator('[data-f="L"]').dispatchEvent('change'); });
    await step('spec to whole network', async (p) => { await p.locator('[data-a="specall"]').click(); });
    await step('class from side panel', async (p) => { await p.locator('[data-f="scls"]').selectOption('A5'); });
    await step('undo x2 / redo', async (p) => { await p.keyboard.press('Control+z'); await p.keyboard.press('Control+z'); await p.keyboard.press('Control+y'); });

    // Pipe tool: grid start, Horiz. plane with typed projections, then ortho with typed length.
    await where('g1', 'grid', 140, 160);
    await where('g1m', 'grid', 330, 260);
    await step('pipe: start on grid', async (p) => { await p.keyboard.press('t'); await click(p, P.g1); });
    await step('plane H, projections 1200 / -800', async (p) => {
      await p.keyboard.press('p');
      await p.mouse.move(P.g1m[0], P.g1m[1]);
      await p.keyboard.type('1200');
      await p.keyboard.press('Tab');
      await p.keyboard.type('-800');
      await p.keyboard.press('Enter');
    });
    await step('angle entry (M), 1500 @ 30°', async (p) => {
      await p.keyboard.press('m');
      await p.mouse.move(P.g1m[0] + 60, P.g1m[1] - 40);
      await p.keyboard.type('1500');
      await p.keyboard.press('Tab');
      await p.keyboard.type('30');
      await p.keyboard.press('Enter');
    });
    await step('backspace undoes last segment, Esc ends', async (p) => {
      await p.keyboard.press('Backspace');
      await p.keyboard.press('Escape');
    });
    await step('ortho plane, mouse direction + 900', async (p) => {
      await p.locator('#consSeg [data-k="ortho"]').click();
      await click(p, P.g1);
      await p.mouse.move(P.g1[0] + 120, P.g1[1] + 70);
      await p.keyboard.type('900');
      await p.keyboard.press('Enter');
      await p.keyboard.press('Enter');
    });

    // Eraser on a component, Delete on a selected segment.
    await where('c0', 'comp', 0);
    await step('eraser on a component', async (p) => { await p.keyboard.press('x'); await click(p, P.c0); });
    await where('s3', 'seg', 3);
    await step('select + Delete', async (p) => { await p.keyboard.press('v'); await click(p, P.s3); await p.keyboard.press('Delete'); });

    // Settings and title block.
    await step('frame N/E and DN sizes', async (p) => {
      await p.locator('[data-a="ref"][data-val="geo"]').click();
      await p.locator('[data-a="unit"][data-val="dn"]').click();
    });
    await step('default spec + elevations', async (p) => {
      await p.locator('[data-f="mcls"]').selectOption('300');
      await p.locator('[data-f="els"]').check();
    });
    await step('title block', async (p) => { await p.locator('#mProjet').fill('Parity run'); await p.locator('#mRev').fill('D'); });

    // Node termination from the side panel (first open end).
    const openEnd = await A.page.evaluate(() => { const { S } = window.__iso; for (const [id, f] of S.D.fit) if (f.type === 'bout') return id; return null; });
    await where('end', 'node', openEnd);
    await step('select open end + cap', async (p) => { await click(p, P.end); await p.locator('[data-f="nend"]').selectOption('cap'); });

    // New sheet, then undo.
    await step('new sheet + undo', async (p) => { await p.locator('#bNew').click(); await p.keyboard.press('Control+z'); });

    // 3D round trip.
    await step('generate 3D (G)', async (p) => { await p.keyboard.press('g'); await p.waitForFunction(() => document.querySelector('#v3 canvas')); });
    await step('top view, back to 2D', async (p) => { await p.locator('[data-c="top"]').click(); await p.keyboard.press('g'); });

    expect(await A.page.evaluate(() => window.__iso.csv())).toBe(await L.page.evaluate(() => window.__t.csv()));
    await settle(L.page); await settle(A.page);
    const png = async (s) => PNG.sync.read(Buffer.from((await s.page.evaluate(() => document.querySelector('#cv').toDataURL())).split(',')[1], 'base64'));
    const [pl, pa] = [await png(L), await png(A)];
    const diff = pixelmatch(pl.data, pa.data, null, pl.width, pl.height, { threshold: 0 });
    expect(diff, '2D pixels differing after the interaction script').toBe(0);
    // Known legacy bug, reproduced on purpose (parity first, fixed later): deleting the
    // hovered segment with the Delete key leaves a stale hover reference, so paint()
    // throws until the mouse moves again. Any other console error fails the test.
    const KNOWN = /Cannot read properties of undefined \(reading 'a'\)/;
    expect(L.errors.filter((e) => !KNOWN.test(e))).toEqual([]);
    expect(A.errors.filter((e) => !KNOWN.test(e))).toEqual([]);
    expect([...L.external, ...A.external]).toEqual([]);
  } finally {
    await L.ctx.close();
    await A.ctx.close();
  }
});

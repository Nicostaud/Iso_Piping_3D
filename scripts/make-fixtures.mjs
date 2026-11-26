// Builds the reference models in tests/fixtures/ with the LEGACY code itself
// (addRun/normalize of V4.1), so fixtures are valid by construction.
// Usage: node scripts/make-fixtures.mjs
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { routeLegacy, seed, LEGACY_URL } from '../tests/e2e/parity-harness.js';

const builders = {
  // Geographic frame, inch sizes, 6" Cl.150 carbon steel: elbows 90/45,
  // reducing tee, concentric reducer, flanged valves, instruments, cap + blind.
  'geo-utility': () => {
    const t = window.__t;
    t.M = t.blank({ projet: 'Utility water - test fixture', ligne: '6"-UW-1001-A1', fluide: 'Utility water', rev: 'C', ref: 'geo' });
    t.NM = new Map();
    const M = t.M; let p = { x: 0, y: 0, z: 0 };
    const run = (d, n, L) => { const r = t.addRun(p, d, n, L); p = r.end; return r.seg; };
    const cp = (s, tt, type, extra) => M.comps.push({ id: M.nid++, seg: s.id, t: tt, type, rev: false, fig: 'auto', ...extra });
    const E = [1, 0, 0], N = [0, 1, 0], S = [0, -1, 0], Up = [0, 0, 1];
    Object.assign(M.meta, { dn: 10, sch: '40', cls: '150', mat: 'A106B' });
    const s1 = run(E, 4, 3000); cp(s1, 0.25, 'gate'); cp(s1, 0.8, 'flange');
    const s2 = run(N, 2); cp(s2, 0.5, 'globe');
    const s3 = run(Up, 2); cp(s3, 0.5, 'tg');
    const s4 = run([Math.SQRT1_2, Math.SQRT1_2, 0], 2.5, 2500); cp(s4, 0.5, 'pg');
    const s5 = run(E, 2); cp(s5, 0.4, 'psv'); cp(s5, 0.75, 'ystr');
    Object.assign(M.meta, { dn: 8, sch: '80' });
    const s6 = run(E, 2); cp(s6, 0.5, 'shoe');
    const capEnd = p;
    p = { x: 2, y: 0, z: 0 };
    Object.assign(M.meta, { dn: 8, sch: '40' });
    const b1 = run(S, 3); cp(b1, 0.4, 'ball'); cp(b1, 0.7, 'guide');
    const blindEnd = p;
    t.NM.get(capEnd.id).end = 'cap'; t.NM.get(blindEnd.id).end = 'blind';
    Object.assign(M.meta, { dn: 10, sch: '40', dims: true, els: false });
    return t.normalize(JSON.parse(JSON.stringify(M)));
  },
  // Ship frame, DN sizes, elevations on, 6" Cl.600 SS316L + 3" Cl.900 (RTJ):
  // wafer/spectacle bolting, threaded items, sloped 3D run, supports, plug end.
  'hp-600': () => {
    const t = window.__t;
    t.M = t.blank({ projet: 'HP gas - test fixture', ligne: '6"-HG-2002-F6', fluide: 'Gas', rev: 'B', ref: 'ship', unit: 'dn', els: true });
    t.NM = new Map();
    const M = t.M; let p = { x: 0, y: 0, z: 0 };
    const run = (d, n, L) => { const r = t.addRun(p, d, n, L); p = r.end; return r.seg; };
    const cp = (s, tt, type, extra) => M.comps.push({ id: M.nid++, seg: s.id, t: tt, type, rev: false, fig: 'auto', ...extra });
    const N = [0, 1, 0], W = [-1, 0, 0], E = [1, 0, 0], Up = [0, 0, 1];
    Object.assign(M.meta, { dn: 10, sch: '80', cls: '600', mat: 'SS316' });
    const s1 = run(N, 3, 3000); cp(s1, 0.25, 'check', { rev: true }); cp(s1, 0.55, 'dcheck'); cp(s1, 0.85, 'spec');
    const s2 = run(Up, 2); cp(s2, 0.5, 'anchor');
    const s3 = run(W, 2); cp(s3, 0.3, 'bfly'); cp(s3, 0.7, 'vic');
    const s4 = run([0.6, 0, 0.8], 2.5, 2500); cp(s4, 0.5, 'hanger');
    const s5 = run(W, 1.5); cp(s5, 0.5, 'tu'); cp(s5, 0.8, 'needle');
    t.NM.get(p.id).end = 'plug';
    p = { x: 3, y: -2, z: 0 };
    Object.assign(M.meta, { dn: 7, sch: '160', cls: '900', mat: 'X52' });
    const k1 = run(E, 3); cp(k1, 0.3, 'choke'); cp(k1, 0.7, 'flange');
    t.NM.get(p.id).end = 'blind';
    p = { x: 3, y: -2, z: 0 };
    Object.assign(M.meta, { dn: 5, sch: 'XXS', cls: 'A10', mat: 'A333' });
    const k2 = run(Up, 2); cp(k2, 0.3, 'hu', { fig: '1502' }); cp(k2, 0.65, 'plug');
    t.NM.get(p.id).end = 'hucap';
    Object.assign(M.meta, { dn: 10, sch: '80', cls: '600', mat: 'SS316' });
    return t.normalize(JSON.parse(JSON.stringify(M)));
  },
};

const browser = await chromium.launch();
for (const [name, fn] of Object.entries(builders)) {
  const page = await browser.newPage();
  await routeLegacy(page);
  await seed(page, null);
  await page.goto(LEGACY_URL);
  await page.waitForFunction(() => window.__t && window.__t.M);
  const model = await page.evaluate(fn);
  const file = { app: 'iso-piping-3d', format: 1, savedAt: '2026-01-01T00:00:00.000Z', model };
  writeFileSync(`tests/fixtures/${name}.isop`, JSON.stringify(file, null, 1) + '\n');
  console.log(name, model.segs.length, 'segs', model.comps.length, 'comps');
  await page.close();
}
await browser.close();

// Engineering reference data — values verified against ASME B36.10M (wall
// thickness) and ASME B16.5 (studs per flange). Any change to these tables
// must cite its source and update this file (CLAUDE.md §3.2).
import { describe, it, expect } from 'vitest';
import { NPS, WT, schOf, wtOf } from '../../src/data/pipe.js';
import { BOLT, CLS, boltOf, isAPI, face } from '../../src/data/bolting.js';

const idx = (n) => NPS.findIndex((p) => p.n === n);

describe('ASME B36.10M wall thickness (mm)', () => {
  it.each([
    ['4"', 11.13, 13.49, 17.12],
    ['5"', 12.70, 15.88, 19.05],
    ['6"', 14.27, 18.26, 21.95],
  ])('%s sch 120 / 160 / XXS', (n, s120, s160, xxs) => {
    const w = WT[idx(n)];
    expect(w['120']).toBe(s120);
    expect(w['160']).toBe(s160);
    expect(w.XXS).toBe(xxs);
  });

  it('has one thickness row per size', () => {
    expect(WT).toHaveLength(NPS.length);
  });

  it('falls back to STD when a schedule does not exist for the size', () => {
    const s = { nps: idx('2"'), sch: '120' };
    expect(schOf(s)).toBe('STD');
    expect(wtOf(s)).toBe(3.91);
  });
});

describe('ASME B16.5 bolting', () => {
  it('6" Cl.150: 8 studs 3/4"', () => {
    expect(boltOf('150', idx('6"'))).toEqual({ n: 8, d: '3/4' });
  });
  it('6" Cl.600: 12 studs 1"', () => {
    expect(boltOf('600', idx('6"'))).toEqual({ n: 12, d: '1' });
  });
  it('has one entry per size for every ASME class', () => {
    for (const c of ['150', '300', '600', '900', '1500', '2500']) expect(BOLT[c].split(',')).toHaveLength(NPS.length);
  });
  it('Cl.2500 above 12" is not tabulated (known backlog)', () => {
    expect(boltOf('2500', idx('14"'))).toBeNull();
  });
  it('API 6A classes have no per-stud table and use RTJ', () => {
    expect(isAPI('A10')).toBe(true);
    expect(boltOf('A10', idx('6"'))).toBeNull();
    expect(face('A10')).toBe('RTJ');
    expect(face('900')).toBe('RTJ');
    expect(face('600')).toBe('RF');
    expect(Object.keys(CLS)).toHaveLength(11);
  });
});

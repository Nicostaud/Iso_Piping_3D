import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalize, sample, blank, derive, DEFMETA } from '../../src/core/model.js';
import { mto } from '../../src/core/mto.js';
import { S } from '../../src/state.js';

const fx = (f) => JSON.parse(readFileSync(new URL(`../fixtures/${f}`, import.meta.url), 'utf8'));

describe('normalize()', () => {
  it('v4: is idempotent on the reference fixtures', () => {
    for (const f of ['geo-utility.isop', 'hp-600.isop']) {
      const m = fx(f).model;
      expect(m.v).toBe(4);
      expect(normalize(m)).toEqual(m);
    }
  });

  it('v4: the built-in sample survives a JSON round trip', () => {
    sample();
    const m = JSON.parse(JSON.stringify(S.M));
    expect(normalize(m)).toEqual(m);
  });

  it('v3: maps old size indices through OLDNPS and fills defaults', () => {
    const m = normalize(fx('legacy-v3.json'));
    expect(m.v).toBe(4);
    expect(m.meta).toMatchObject({ dn: 11, sch: '40', cls: '300', mat: 'A333', scale: 500, rev: 'B', ref: 'geo', unit: 'in', dims: true, els: false });
    expect(m.segs.map((s) => s.nps)).toEqual([11, 11, 8]); // 8" 8" 4"
    expect(m.segs[1]).toMatchObject({ sch: '40', cls: '300', mat: 'A333', L: null });
    expect(m.segs[2].sch).toBe('80');
    expect(m.nodes.find((n) => n.id === 4).end).toBe('cap');
    expect(m.comps).toEqual([
      { id: 8, seg: 5, t: 0.5, type: 'gate', rev: false, fig: 'auto' },
      { id: 9, seg: 6, t: 0.4, type: 'flange', rev: false, fig: 'auto' },
    ]);
    expect(m.nid).toBe(10);
  });

  it('v2: model without version uses the old size table', () => {
    const m = normalize({ meta: { dn: 3 }, nodes: [{ id: 1, x: 0, y: 0, z: 0 }, { id: 2, x: 1, y: 0, z: 0 }], segs: [{ id: 3, a: 1, b: 2, nps: 3 }] });
    expect(m.meta.dn).toBe(4); // OLDNPS[3] → 1-1/2"
    expect(m.segs[0].nps).toBe(4);
    expect(m.comps).toEqual([]);
  });

  it('v1: drops invalid content and keeps the model consistent', () => {
    const m = normalize({
      v: 1,
      meta: { projet: 'x'.repeat(200), scale: -5, sch: 'BAD', cls: 'BAD', mat: 'BAD', ref: 'mars', unit: 'mm' },
      nodes: [{ id: 1, x: 0, y: 0, z: 0 }, { id: 2, x: 2, y: 0, z: 0 }, { id: 3, x: 2, y: 0, z: 0 }, { id: 9, x: 5, y: 5, z: 5, end: 'bogus' }],
      segs: [
        { id: 4, a: 1, b: 2, nps: 99, sch: '40' },
        { id: 5, a: 2, b: 3 }, // zero length
        { id: 6, a: 1, b: 42 }, // missing node
      ],
      comps: [{ id: 7, seg: 4, t: 5, type: 'gate' }, { id: 8, seg: 4, type: 'teleporter' }, { id: 10, seg: 6, type: 'ball' }],
    });
    expect(m.meta.projet).toHaveLength(80);
    expect(m.meta).toMatchObject({ scale: DEFMETA.scale, sch: '40', cls: '150', mat: 'A106B', ref: 'geo', unit: 'in' });
    expect(m.segs.map((s) => s.id)).toEqual([4]);
    expect(m.segs[0].nps).toBe(8); // out of range old index → default
    expect(m.nodes.map((n) => n.id)).toEqual([1, 2]); // unused nodes pruned
    expect(m.comps).toEqual([{ id: 7, seg: 4, t: 0.98, type: 'gate', rev: false, fig: 'auto' }]);
    expect(m.nid).toBe(10); // legacy: computed before node pruning, after comp filtering
  });

  it('rejects data that is not a model', () => {
    expect(() => normalize(null)).toThrow('format');
    expect(() => normalize({ segs: [] })).toThrow('format');
    expect(() => normalize('{}')).toThrow('format');
  });
});

describe('derive()', () => {
  it('classifies fittings of the sample', () => {
    sample();
    derive();
    const types = [...S.D.fit.values()].map((f) => f.type);
    expect(types).toContain('coude');
    expect(types).toContain('bout');
    expect(S.D.loop).toBe(false);
    expect(mto().rows.length).toBeGreaterThan(20);
  });
  it('blank model is empty', () => {
    S.M = blank();
    derive();
    expect(mto().rows).toEqual([]);
  });
});

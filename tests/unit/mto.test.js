import { describe, it, expect } from 'vitest';
import { blank, addRun, derive } from '../../src/core/model.js';
import { mto, csv } from '../../src/core/mto.js';
import { S } from '../../src/state.js';

/** One straight 6" line with a single flange joint in the middle. */
function flangedLine(cls) {
  S.M = blank({ dn: 10, sch: '40', cls, mat: 'A106B' });
  S.NM = new Map();
  const r = addRun({ x: 0, y: 0, z: 0 }, [1, 0, 0], 4, 4000);
  S.M.comps.push({ id: S.M.nid++, seg: r.seg.id, t: 0.5, type: 'flange', rev: false, fig: 'auto' });
  derive();
  return mto().rows;
}
const row = (rows, re) => rows.find((r) => re.test(r.des));

describe('MTO bolting per flange pair', () => {
  it('6" Cl.150 → 8 studs 3/4" + 16 nuts', () => {
    const rows = flangedLine('150');
    expect(row(rows, /^Stud bolts/)).toMatchObject({ des: 'Stud bolts 3/4"', q: 8 });
    expect(row(rows, /^Heavy hex nuts/)).toMatchObject({ des: 'Heavy hex nuts 3/4"', q: 16 });
    expect(row(rows, /^WN flange/)).toMatchObject({ q: 2 });
    expect(row(rows, /gasket/)).toMatchObject({ q: 1 });
  });
  it('6" Cl.600 → 12 studs 1"', () => {
    const rows = flangedLine('600');
    expect(row(rows, /^Stud bolts/)).toMatchObject({ des: 'Stud bolts 1"', q: 12 });
  });
  it('pipe length and welds', () => {
    const { tot, rows } = (flangedLine('150'), mto());
    expect(row(rows, /^Pipe/)).toMatchObject({ q: 4, u: 'm' });
    expect(tot.welds).toBe(2); // two WN flanges
    expect(tot.idia).toBe(12);
  });
  it('CSV starts with a UTF-8 BOM and the header', () => {
    flangedLine('150');
    expect(csv().startsWith('﻿Item,Section,Description,Standard / material,Qty,Unit,Weight (kg)')).toBe(true);
  });
});

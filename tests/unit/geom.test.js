import { describe, it, expect, beforeEach } from 'vitest';
import { P, C30, dirAI, planeDir, azOf } from '../../src/core/geom.js';
import { angTxt, projTxt } from '../../src/core/labels.js';
import { blank } from '../../src/core/model.js';
import { S } from '../../src/state.js';

describe('isometric projection P', () => {
  it('maps the axes to the 30° iso lattice', () => {
    expect(P(1, 0, 0)).toEqual([C30, 0.5]);
    expect(P(0, 1, 0)).toEqual([C30, -0.5]);
    expect(P(0, 0, 1)).toEqual([0, -1]);
    expect(P(0, 0, 0)).toEqual([0, -0]);
  });
  it('is linear', () => {
    const a = P(2, 3, 4), b = P(2, 0, 0), c = P(0, 3, 0), d = P(0, 0, 4);
    expect(a[0]).toBeCloseTo(b[0] + c[0] + d[0], 12);
    expect(a[1]).toBeCloseTo(b[1] + c[1] + d[1], 12);
  });
});

describe('angle from projections', () => {
  beforeEach(() => { S.M = blank(); });
  it('X = 1000, Y = 1000 → 45.0°', () => {
    expect(angTxt([1000, 1000, 0])).toBe('45° / E-W · 45° / N-S');
  });
  it('X = 1000, Y = 577.35 → 30.0°', () => {
    expect(angTxt([1000, 577.35, 0])).toBe('30° / E-W · 60° / N-S');
  });
  it('vertical plane gives a slope', () => {
    expect(angTxt([1000, 0, -1000])).toBe('slope 45° falling · 45° / vertical');
  });
  it('uses the ship frame labels', () => {
    S.M = blank({ ref: 'ship' });
    expect(angTxt([1000, 1000, 0])).toBe('45° / PS-SB · 45° / AFT-FWD');
    expect(projTxt([-1500, 2000, 0])).toBe('1,500 PS · 2,000 FWD');
  });
});

describe('directions', () => {
  it('azimuth / inclination', () => {
    expect(dirAI(90, 0)).toEqual([1, 0, 0]);
    expect(azOf([0, 1, 0])).toBe(0);
    expect(azOf([-1, 0, 0])).toBe(270);
    expect(planeDir('EO', 90)).toEqual([0, 0, 1]);
  });
});

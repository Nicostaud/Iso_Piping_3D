import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { serializeProject, parseProject, projectFileName, APP_ID, FORMAT } from '../../src/core/project-file.js';
import { sample } from '../../src/core/model.js';
import { S } from '../../src/state.js';

const fx = (f) => readFileSync(new URL(`../fixtures/${f}`, import.meta.url), 'utf8');

describe('.isop project files', () => {
  it('round trip: save then reload gives the same model', () => {
    sample();
    const text = serializeProject(S.M, new Date('2026-03-04T05:06:07.000Z'));
    const o = JSON.parse(text);
    expect(o).toMatchObject({ app: APP_ID, format: FORMAT, savedAt: '2026-03-04T05:06:07.000Z' });
    const r = parseProject(text);
    expect(r.wrapped).toBe(true);
    expect(r.model).toEqual(JSON.parse(JSON.stringify(S.M)));
    expect(serializeProject(r.model, new Date('2026-03-04T05:06:07.000Z'))).toBe(text);
  });

  it('reads the reference fixtures', () => {
    for (const f of ['geo-utility.isop', 'hp-600.isop']) {
      const r = parseProject(fx(f));
      expect(r.wrapped).toBe(true);
      expect(r.model).toEqual(JSON.parse(fx(f)).model);
    }
  });

  it('accepts a raw model (V4.1 .json, older versions) through normalize()', () => {
    const r = parseProject(fx('legacy-v3.json'));
    expect(r.wrapped).toBe(false);
    expect(r.model.v).toBe(4);
    expect(r.model.segs.map((s) => s.nps)).toEqual([11, 11, 8]);
  });

  it('tolerates a UTF-8 BOM', () => {
    sample();
    expect(parseProject('﻿' + serializeProject(S.M)).model.segs.length).toBe(S.M.segs.length);
  });

  it('rejects other content and newer formats', () => {
    expect(() => parseProject('not json')).toThrow();
    expect(() => parseProject('{"hello":1}')).toThrow('format');
    expect(() => parseProject(JSON.stringify({ app: APP_ID, format: 99, model: {} }))).toThrow('newer');
    expect(() => parseProject(JSON.stringify({ app: APP_ID, format: 1, model: { nodes: 'x' } }))).toThrow('format');
  });

  it('derives the project file name', () => {
    expect(projectFileName(null, '6in-SW-2001')).toBe('6in-SW-2001.isop');
    expect(projectFileName('line.isop', 'x')).toBe('line.isop');
    expect(projectFileName('old-line.json', 'x')).toBe('old-line.isop');
    expect(projectFileName(null, '')).toBe('iso-piping.isop');
  });
});

/**
 * Single mutable application state.
 *
 * The legacy script reassigned top-level bindings (M = blank(), undo, tool
 * switches…). An ES module importer cannot reassign an imported binding, so
 * every reassigned value lives on S. Objects that are only mutated in place
 * (entry fields, draw history, undo/redo stacks, 2D view transform) are
 * exported as constants.
 */
export const S = {
  /** current model (v:4) — always produced by normalize()/blank() */
  M: null,
  /** node id → node */
  NM: new Map(),
  /** derived topology: { SM, adj, pos, fit, loop } (see derive()) */
  D: null,
  /** selection {k:'seg'|'node'|'comp', id} */
  sel: null,
  tool: 'pipe',
  /** start point of the segment being drawn, or null */
  drawFrom: null,
  view: '2d',
  /** drawing plane: 'ortho' | 'H' | 'EO' | 'NS' | 'R3' */
  cons: 'ortho',
  /** entry mode: 'XY' (projections) | 'LA' (length/angle) */
  entry: 'XY',
  step: 15,
  /** focused entry field */
  fld: 'L',
  figPick: 'auto',
  hov: null, hovSeg: null, hovObj: null,
  mouse: null, ptr: null,
  W2: 0, H2: 0, dpr: 1,
  /** cached theme colours */
  TC: null,
  /** three.js context, created on first 3D view */
  G3: null,
};

export const F={L:'',A:'',I:'',P0:'',P1:'',P2:''};
export const drawHist=[];
export const U=[],RD=[];
export const V={s:44,ox:0,oy:0};

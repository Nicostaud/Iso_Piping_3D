# Iso Piping 3D

Isometric piping sketch on an iso grid, 3D model generation and bill of materials (MTO)
for onshore and offshore Oil & Gas piping. Works fully offline once loaded.

> Functional reference: [`legacy/index.html`](legacy/index.html) (V4.1, single file).
> It is kept **unchanged** and is used by the parity tests.

## Install

Requires Node.js ≥ 20.19 (LTS).

```bash
npm ci
```

## Usage

```bash
npm run dev       # Vite dev server on http://localhost:5173
npm run build     # production build → dist/
npm run preview   # serve dist/ locally
```

`dist/` is a static site with no runtime network dependency: three.js (r147, pinned) and the
Barlow / Barlow Condensed fonts are bundled.

Quick reference (also in the app, *Shortcuts and conventions*):

- `T` pipe, `V` select, `1`–`4` catalogue (valves, inline items, instruments, supports), `X` eraser
- `P` drawing plane, `M` entry by projections or angle, `G` generate the 3D model
- Geographic (N/E/S/W) or ship (FWD/AFT/PS/SB) reference frame; sizes in inch or DN; lengths in mm

## Tests

```bash
npm test          # Vitest unit tests
npm run test:e2e  # Playwright (builds, then serves dist/ on :4173)
```

E2E tests block every non-local request to prove offline operation. WebGL runs headless
through SwiftShader. In CI, screenshots and the HTML report are uploaded as the
`playwright-results` artifact.

## Known limits

- Weights cover pipe only (flanges, valves and fittings are not weighed).
- Stud bolt length is not calculated; API bolting is counted per set.
- Cl. 2500 above 12" is not in the bolting table.
- No automatic reducer when the size changes at an elbow.
- Lengths in mm only. No CAD export yet (PCF / DXF planned).

Validate all engineering data before procurement.

## Project layout

```
legacy/index.html   V4.1 reference — do not modify
index.html          Vite shell (markup + CSS of V4.1)
src/                application sources
tests/unit          Vitest
tests/e2e           Playwright
```

See [`CLAUDE.md`](CLAUDE.md) for the roadmap (PWA, Windows desktop app with Tauri v2).

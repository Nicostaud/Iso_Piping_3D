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

### Online app (PWA)

- Live: **https://nicostaud.github.io/Iso_Piping_3D/** (deployed from `main` by `.github/workflows/pages.yml`).
- **Offline**: the service worker precaches the whole build on the first visit; the app then starts
  and works without network. When a new version is deployed, a *New version available — Reload*
  prompt appears.
- **Install**: Chrome / Edge → install icon in the address bar (or menu → *Install Iso Piping 3D*);
  Android → *Add to Home screen*; iPhone / iPad → Safari → Share → *Add to Home Screen*.
- **Other hosts** (Cloudflare Pages, Netlify, any static server): build with the default base
  (`npm run build`) and publish `dist/`. For a sub-path, set `BASE_PATH`, e.g.
  `BASE_PATH=/tools/iso/ npm run build`.

### Desktop app (Windows 10/11, Tauri v2)

Same code base as the web app, packaged with [Tauri v2](https://tauri.app) (system WebView2).
Native open / save dialogs, `.isop` files associated with the app, confirmation when closing
with unsaved changes, window title `Iso Piping 3D — <file>`.

**Installers** (GitHub *Releases*, built by `.github/workflows/release.yml`):

| File | Use |
|---|---|
| `IsoPiping3D_<version>_x64.msi` / `IsoPiping3D_<version>_x64_setup.exe` | Standard. Downloads Microsoft WebView2 if it is missing (already present on up-to-date Windows 10/11). |
| `IsoPiping3D_<version>_x64_offshore.msi` / `…_offshore_setup.exe` | **Offshore**: WebView2 embedded (larger), installs **without internet**. |

The `setup.exe` (NSIS) installs per user without admin rights; the `.msi` suits IT deployment.

> **SmartScreen warning.** The installers are **not code-signed** yet. Windows may show
> *"Windows protected your PC"*: click **More info → Run anyway**. Signing can be enabled later
> with a code signing certificate stored in GitHub Secrets (`WINDOWS_CERTIFICATE`,
> `WINDOWS_CERTIFICATE_PASSWORD`, see `release.yml`) and `bundle.windows.certificateThumbprint`.

**Release a version**

```bash
npm version 0.2.0          # bumps package.json, syncs src-tauri/tauri.conf.json + Cargo.toml, commits, tags v0.2.0
git push --follow-tags     # the tag triggers release.yml → draft release with the 4 installers
```

Then review and publish the draft release on GitHub. Every PR also builds the standard
installers (`windows-installers` artifact of the CI run) for testing.

**Develop / build locally** (needs [Rust](https://rustup.rs) and, on Windows, the
[Tauri prerequisites](https://tauri.app/start/prerequisites/)):

```bash
npm run tauri:dev            # desktop window on the Vite dev server
npm run tauri:build          # Windows installers → src-tauri/target/release/bundle/
npm run tauri:build:offshore # offshore variant (WebView2 offline installer)
npm run version:check        # package.json = tauri.conf.json = Cargo.toml
```

Installers are built on Windows only (CI `windows-latest`); cross-compiling from Linux is not used.
File access is limited to the files picked in a dialog (Tauri capabilities in
`src-tauri/capabilities/default.json`, no static file system scope). The desktop build has no
service worker: everything ships with the installer.

### Project files (.isop)

| Action | Shortcut |
|---|---|
| New blank sheet (undoable) | `Ctrl+N` |
| Open an `.isop` project or a V4.1 `.json` | `Ctrl+O` |
| Save | `Ctrl+S` |
| Save as | `Ctrl+Shift+S` |

- An `.isop` file is UTF-8 JSON: `{ "app": "iso-piping-3d", "format": 1, "savedAt": "<ISO 8601>", "model": { … } }`.
  Raw model JSON from V4.1 and earlier versions opens too (always migrated through `normalize()`).
- The header shows the file name, followed by `*` when there are unsaved changes.
- In Chrome / Edge, files are saved in place (File System Access API); other browsers download a copy.
  Exports (PNG, CSV) use the same save dialog when available.
- The current sheet is also kept in the browser storage, as in V4.1.
- In a regular browser tab, `Ctrl+N` is reserved by the browser; use the *New* button (the shortcut
  works in the installed app window).

### Quick reference

Also in the app, under *Shortcuts and conventions*:

- `T` pipe, `V` select, `1`–`4` catalogue (valves, inline items, instruments, supports), `X` eraser
- `P` drawing plane, `M` entry by projections or angle, `G` generate the 3D model
- Geographic (N/E/S/W) or ship (FWD/AFT/PS/SB) reference frame; sizes in inch or DN; lengths in mm

## Tests

```bash
npm test          # Vitest unit tests (data tables, geometry, normalize, MTO)
npm run test:e2e  # Playwright (builds, then serves dist/ on :4173)
```

- **Smoke** — draw, generate 3D, export CSV with every external request blocked.
- **Parity** — `legacy/index.html` and the app are loaded with the same models
  (built-in sample + `tests/fixtures/`), at 1440×900 and 390×844, light and dark:
  identical CSV (byte for byte), 2D canvas within 0.5 % of pixels, same 3D mesh count,
  no console error. The legacy test copy is generated on the fly (CDN and Google Fonts
  routed to the same local files the app bundles); the file on disk is never modified.
- **Interaction parity** — one mouse/keyboard script played on both, model compared
  after every step.
- **PWA** — manifest and icons, Chrome installability (CDP), offline reload + drawing + 3D.
- **Project files** — save / open / save as, unsaved marker, download fallback and mocked
  File System Access pickers.

- **Desktop** (unit) — `platform/tauri.js` with the Tauri modules mocked (dialogs, in-place save,
  Save as, close confirmation, file association), packaging settings, capabilities, single version.
  The Windows installers themselves are built by CI (`desktop-windows` job).
- **Desktop runtime smoke** — `scripts/desktop-smoke.mjs` drives the real app through
  `tauri-driver` (usage in the file header): file association, in-place save, refused paths.

Parity requires pixel-identical canvases (stricter than the 0.5 % allowed by CLAUDE.md §9).

Fixtures are rebuilt with the legacy code itself: `node scripts/make-fixtures.mjs`.
Icons are rendered from `public/icons/icon.svg`: `node scripts/make-icons.mjs` (web) and
`node scripts/make-app-icon.mjs && npx tauri icon src-tauri/app-icon.png` (desktop).

E2E tests run WebGL headless through SwiftShader. In CI, screenshots and the HTML report
are uploaded as the `playwright-results` artifact.

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
index.html          Vite shell (V4.1 markup)
src/
  main.js           bootstrap and UI wiring only
  state.js          single mutable state object S (+ undo stacks, entry fields, 2D view)
  styles.css        V4.1 stylesheet
  data/             engineering tables: pipe (B36.10M), bolting (B16.5), materials, catalogue, frames
  core/             pure logic: geometry, model + normalize(), history, MTO/CSV, storage, .isop files, labels
  ui/               2D sketch, entry HUD, side panel, sheet/PNG export, document, PWA updates, keyboard, theme
  view3d/           three.js scene and component geometry
  platform/         web / desktop differences: web.js (browser), tauri.js (desktop)
tests/unit          Vitest
tests/e2e           Playwright (smoke, parity, interaction parity)
tests/fixtures      reference models (*.isop, raw v3 JSON)
public/icons        PWA icons (generated from icon.svg)
src-tauri/          desktop shell: Rust entry point, tauri.conf.json (+ offshore overlay), capabilities, icons
scripts/            fixtures, icons, version sync
```

`core/` never imports `ui/`: UI refresh after a model change is injected by `main.js`
(`setHistoryHooks`). Append `?debug=1` to the URL to expose `window.__iso`
(`S`, `V`, `mto`, `csv`, `derive`, `normalize`) for debugging and tests.

See [`CLAUDE.md`](CLAUDE.md) for the roadmap.

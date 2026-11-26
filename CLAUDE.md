# CLAUDE.md — Iso Piping 3D

> **Mode d'emploi (lecteur humain)**
> 1. Créer un dépôt GitHub `iso-piping-3d`. Choisir *public* pour un hébergement GitHub Pages gratuit, ou *privé* avec GitHub Pro/Team, Cloudflare Pages ou Netlify.
> 2. Déposer à la racine du dépôt `CLAUDE.md` et `index.html` (la V4.1 actuelle) avec *Add file → Upload files*.
> 3. Aller sur claude.ai/code, choisir le dépôt et lancer une session par bloc :
>    - Session 1 : « Lis CLAUDE.md. Réalise la phase 0 puis la phase 1, une PR par phase. Signale tout écart de parité avec le legacy. »
>    - Session 2 : « Réalise la phase 2 de CLAUDE.md (PWA + déploiement en ligne). »
>    - Session 3 : « Réalise la phase 3 de CLAUDE.md (logiciel PC Windows + workflow de release). »
> 4. Après chaque PR : relire, vérifier que la CI est verte, merger.
>    - Après la phase 2 : *Settings → Pages → Source : GitHub Actions*.
>    - Après la phase 3 : pousser un tag `v0.1.0`. Les installateurs Windows apparaissent dans *Releases*.

---

## 1. Contexte produit

- Outil de tracé d'ISO piping sur grille isométrique, avec génération 3D et nomenclature (MTO), pour le secteur Oil & Gas onshore et offshore.
- **Utilisateurs** : ingénieurs et superviseurs terrain, sur des laptops Windows, avec une connexion intermittente (rig offshore). **Le fonctionnement hors ligne est obligatoire.**
- **Source de vérité fonctionnelle** : `legacy/index.html`.
  - V4.1, un seul fichier (~1 600 lignes), interface en anglais.
  - three.js r147 en UMD, chargé depuis le CDN jsDelivr ; polices Barlow et Barlow Condensed chargées depuis Google Fonts.
  - Persistance dans localStorage, avec migration des anciennes versions de stockage.
- **Ce fichier legacy ne doit jamais être modifié.** Il sert de référence pour les tests de parité.

## 2. Livrables

| ID | Cible | Forme |
|----|-------|-------|
| L1 | Logiciel en ligne | PWA statique, installable (Chrome/Edge/Android, « Ajouter à l'écran d'accueil » sur iOS), utilisable hors ligne après la première visite |
| L2 | Logiciel PC | Application Windows x64 sous **Tauri v2**, installateurs `.msi` et `.exe` (NSIS), fichiers projet natifs |

Une seule base de code pour les deux cibles. Les différences passent uniquement par la couche plateforme (§7).

## 3. Règles non négociables

1. **Parité d'abord.** La phase 1 est un refactor pur : aucun changement fonctionnel, visuel ou de calcul.
2. **Données d'ingénierie intouchables sans source.** Cela couvre `WT`, `BOLT`, `CLS`, `MAT`, `FIG`, `FIGAUTO` et `CAT`.
   - Toute modification exige une référence normative en commentaire (ASME B36.10M / B36.19M, B16.5, B16.47, API 6A, catalogue fabricant…) et un test unitaire mis à jour.
   - Épaisseurs vérifiées à préserver telles quelles, en mm (sch 120 / 160 / XXS) :
     - 4" : 11.13 / 13.49 / 17.12
     - 5" : 12.70 / 15.88 / 19.05
     - 6" : 14.27 / 18.26 / 21.95
3. **Aucune dépendance réseau à l'exécution.** three.js et les polices sont embarqués dans le build.
4. **Compatibilité des données.**
   - Le modèle `M` (`v:4`) reste lisible.
   - La migration localStorage (`KEYS = ['isopiping.v4','isopiping.v3','isopiping.v2','isopiping.v1']`) est conservée.
   - `normalize()` reste le point d'entrée de toute donnée chargée.
5. **Pas de framework UI** (React, Vue…) en phases 0 à 3. On conserve le DOM et le canvas existants.
6. **Interface en anglais.** Les unités et conventions existantes sont conservées : mm / inch, référentiels géographique et navire (AFT / FWD / PORTSIDE / STARBOARD).
7. **Petites PR**, une par phase au minimum, et CI verte obligatoire avant merge.

## 4. Stack cible

- **Build** : Vite, avec JavaScript en modules ES + JSDoc (`// @ts-check` bienvenu). TypeScript est hors périmètre des phases 0 à 3, pour limiter les régressions lors du portage.
- **Node** : LTS ≥ 20.
- **3D** : `three@0.147.0` **épinglé**, pour garantir la parité de rendu (à partir de r155, la gestion de l'éclairage change).
  ```js
  import * as THREE from 'three';
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
  ```
  La montée de version de three.js est une tâche séparée, hors roadmap.
- **Polices** : `@fontsource/barlow` et `@fontsource/barlow-condensed`.
- **PWA** : `vite-plugin-pwa` (Workbox : precache, `registerType: 'autoUpdate'` ou prompt de mise à jour).
- **Desktop** : Tauri v2, avec `@tauri-apps/plugin-dialog` et `@tauri-apps/plugin-fs`.
  - Electron n'est envisagé qu'en cas de blocage WebGL / WebView2 avéré, documenté dans une issue avant toute bascule.
- **Tests** : Vitest (tests unitaires sur la logique pure) et Playwright (e2e + parité avec le legacy).

## 5. Arborescence cible

```
iso-piping-3d/
├─ CLAUDE.md
├─ README.md                  # EN : install, usage, limits, build
├─ legacy/index.html          # V4.1 de référence — NE PAS MODIFIER
├─ index.html                 # shell Vite (markup + CSS de la V4.1)
├─ public/icons/              # icônes PWA/desktop (192, 512, maskable), générées depuis icon.svg
├─ src/
│  ├─ main.js                 # bootstrap, câblage UI
│  ├─ state.js                # état mutable unique (voir §6)
│  ├─ styles.css              # CSS extrait du legacy
│  ├─ data/      pipe.js  bolting.js  materials.js  catalogue.js  frames.js
│  ├─ core/      geom.js  model.js  history.js  mto.js  store.js  project-file.js
│  ├─ ui/        sketch.js  hud.js  panels.js  sheet.js  theme.js
│  ├─ view3d/    scene.js  kit.js
│  └─ platform/  index.js  web.js  tauri.js
├─ src-tauri/                 # phase 3
├─ tests/
│  ├─ unit/                   # Vitest
│  ├─ e2e/                    # Playwright
│  └─ fixtures/               # modèles JSON de référence (*.isop)
└─ .github/workflows/  ci.yml  pages.yml  release.yml
```

## 6. Découpage du legacy

**Liste indicative.** Le mapping exact est à confirmer en lisant le legacy ; un symbole non listé va dans le module le plus proche.

| Module | Symboles legacy |
|--------|-----------------|
| `data/pipe.js` | `NPS OLDNPS SCHS WT schL schOf wtOf kgm lpm nd` |
| `data/bolting.js` | `BOLT CLS boltOf isAPI` |
| `data/materials.js` | `MAT` |
| `data/catalogue.js` | `CAT FAM famSel ENDS FIG FIGAUTO figOf specTxt compDes valveOp` |
| `data/frames.js` | `REF CONSK AXES` |
| `core/geom.js` | `C30 P DV r4 clamp vsub len3 unit axisAligned dirAI planeDir azOf az3 latticeNear perp` |
| `core/model.js` | `DEFMETA blank addNode findNode newSeg interiorT splitSeg ensureNode addRun prune delSeg eraseObj reach canRedirect redirect derive normalize sample skLen segLen dirOf segDir segR skFor other` |
| `core/history.js` | `pushUndo undo swap commit changed` |
| `core/mto.js` | `mto frac qtyTxt table csv` |
| `core/store.js` | `KEYS persist` + chargement/migration au démarrage |
| `ui/sketch.js` | `paint grid hatch ln circ txtBox tag symbol endSymbol compass offsetTri draw2D preview mouseVec startFit zoomAt fitTo fit2D nearSeg hit pickStart snapT` |
| `ui/hud.js` | `hud hudShow hudBuild hudSync hudUpdate fields clearF numF anyF angTxt projTxt dirWords consName setCons setEntry` |
| `ui/panels.js` | `selHTML renderSide side specFields npsOpts schOpts clsOpts matOpts buildPalette setTool hint delSel cartF fillCart iconURL toast` |
| `ui/sheet.js` | `bomHTML drawSheet exportPNG fname` |
| `ui/theme.js` | `TC theme reTheme` |
| `view3d/scene.js` | `G3 v3 init3D resize3 render3 clearG mark3D build3D fit3D setView generate` |
| `view3d/kit.js` | `kit compObj endObj` |
| `platform/*` | remplace `DL` et `window.claude.use('downloads')`, qui sont propres à l'hébergement artefact Claude et doivent être supprimés |

**Piège ESM.** `M` et d'autres globales (`F`, `hov`, l'outil courant, la vue…) sont **réaffectées** dans le legacy, par exemple `M = blank()` ou lors d'un undo. Un module importateur ne peut pas réaffecter un binding importé. Il faut donc regrouper tout l'état mutable dans un objet unique `S` exporté par `state.js` (`S.M`, `S.sel`, `S.tool`, `S.view`, `S.undo`…), puis remplacer les accès en conséquence.

**Hook de test.** Exposer `window.__iso = { S, mto, csv, derive, normalize }` lorsque `?debug=1` est présent dans l'URL ou en mode test.

## 7. Couche plateforme

```js
// src/platform/index.js
export const platform = isTauri() ? tauriImpl : webImpl; // isTauri() : @tauri-apps/api/core (v2)

// Contrat commun
platform.isDesktop                                   // boolean
platform.saveFile({ name, mime, data })              // data : string | Blob | Uint8Array → Promise<boolean>
platform.openProject()                               // → Promise<{ name, path?, text } | null>
platform.saveProject({ text, path?, saveAs? })       // → Promise<{ path?, name } | null>
platform.onBeforeClose(handler)                      // confirmation si modifications non enregistrées
```

- **Web**
  - Utiliser `showSaveFilePicker` / `showOpenFilePicker` quand ils sont disponibles (Chromium).
  - Sinon : `<a download>` + Blob pour l'enregistrement, `<input type="file">` pour l'ouverture.
- **Tauri**
  - Dialogues natifs via `plugin-dialog`, lecture/écriture via `plugin-fs`.
  - Permissions minimales déclarées dans `src-tauri/capabilities/` : uniquement les chemins choisis par l'utilisateur. Vérifier la configuration du scope fs dans la doc Tauri v2.
- **Fichier projet `.isop`** (JSON UTF-8)
  - Structure : `{ "app": "iso-piping-3d", "format": 1, "savedAt": ISO8601, "model": M }`.
  - À l'ouverture, accepter aussi un JSON `M` brut (v1 à v4), toujours via `normalize()`.
  - Raccourcis : `Ctrl+N / Ctrl+O / Ctrl+S / Ctrl+Shift+S`.
  - Afficher le nom du fichier, suivi de `*` en cas de modifications non enregistrées.
  - Ces fichiers projet sont **la seule nouveauté fonctionnelle autorisée** avant la phase 4.

## 8. Commandes

```bash
npm ci
npm run dev          # Vite dev server
npm run build        # → dist/
npm run preview
npm test             # Vitest
npm run test:e2e     # Playwright (parité + smoke)
npm run tauri:dev    # phase 3
npm run tauri:build  # phase 3 — sous Windows uniquement (voir §10)
```

## 9. Tests et Definition of Done

**Tests unitaires (Vitest)**, sur des cas de référence vérifiés :
- MTO 6" Cl.150 : 8 goujons de 3/4" par paire de brides.
- MTO 6" Cl.600 : 12 goujons de 1".
- Épaisseurs du §3.
- Angle calculé depuis des projections :
  - X = 1000, Y = 1000 → 45.0° ;
  - X = 1000, Y = 577.35 → 30.0°.
- Projection isométrique `P`.
- `normalize()` sur des modèles v1 à v4.
- Aller-retour `.isop` : sauvegarde puis rechargement donnent le même modèle.

**Parité avec le legacy (Playwright)**
- Charger le legacy et la nouvelle application avec les mêmes fixtures : `sample()` + 2 à 3 modèles dans `tests/fixtures/`.
- Le legacy dépend du CDN. Pour les tests, en générer une copie dans laquelle les URLs jsDelivr pointent vers `node_modules/three/build/three.min.js` et `node_modules/three/examples/js/controls/OrbitControls.js` (présents en r147).
- Bloquer Google Fonts des deux côtés, ou les router vers les mêmes fichiers locaux.
- Les `function` et `const` de premier niveau du legacy sont accessibles par leur nom via `page.evaluate`. À défaut, injecter un `window.__t` dans la copie de test.
- Comparaisons attendues :
  - sortie `csv()` identique octet par octet ;
  - canvas 2D avec un écart de pixels ≤ 0,5 % ;
  - 3D : même nombre de meshes dans la scène ;
  - zéro erreur console.
- Viewports à couvrir : 1440×900 et 390×844 (mobile), thèmes clair et sombre.
- WebGL en headless : `--use-angle=swiftshader --enable-unsafe-swiftshader`.

**Réseau de l'environnement cloud**
- Si `npm ci` ou `npx playwright install chromium` est bloqué, le signaler dans la PR.
- Les e2e tournent alors dans `ci.yml` (GitHub Actions).
- Ne jamais désactiver la vérification TLS.

**Definition of Done, pour chaque PR**
- Build OK, tests unitaires et e2e verts en CI, zéro erreur console.
- Captures Playwright uploadées en artefacts de CI.
- README à jour.
- Description de PR listant les écarts connus.

## 10. Roadmap

### Phase 0 — Socle
- `git mv index.html legacy/index.html`.
- Initialiser `package.json`, Vite, Vitest et Playwright.
- Créer `ci.yml` : install, build, unit, e2e, sur push et PR.
- Premier `index.html` Vite = copie du legacy. Seuls changements autorisés : three.js et les polices passent en dépendances locales, et `window.claude` / `DL` sont supprimés.
- **Critère** : `dist/` fonctionne sans réseau, et le test smoke e2e (tracer, générer la 3D, exporter le CSV) passe.

### Phase 1 — Modularisation (refactor pur)
- Découpage selon le §6 : objet d'état `S`, couche plateforme (implémentation web seulement).
- Ajout des tests de parité.
- **Critère** : tous les tests de parité du §9 sont verts, et `main.js` ne contient plus de logique métier.

### Phase 2 — Logiciel en ligne (PWA)
- **Manifest**
  - `name: "Iso Piping 3D"`, `short_name: "IsoPiping"`.
  - `display: "standalone"`, `theme_color` et `background_color` alignés sur le thème.
  - Icônes 192, 512 et maskable.
- **Service worker** : precache de tout `dist/`, toast « New version available — Reload ».
- **Fichiers projet `.isop`** dans l'implémentation web (§7).
- **Déploiement** via `pages.yml` : sur push `main`, build puis `actions/upload-pages-artifact` puis `actions/deploy-pages`.
  - Le `base` Vite est paramétrable par `BASE_PATH`, pour fonctionner à la fois sous `/iso-piping-3d/` (GitHub Pages) et à la racine (Cloudflare / Netlify).
- **Critères**
  - Application installable dans Chrome et Edge.
  - Test e2e hors ligne : `context.setOffline(true)` après la première visite, rechargement, tracé et génération de la 3D OK.
  - Utilisable sur iPhone via « Ajouter à l'écran d'accueil ».

### Phase 3 — Logiciel PC Windows (Tauri v2)
- **Initialisation** de `src-tauri/` :
  - `frontendDist: "../dist"`, `devUrl: "http://localhost:5173"`, `beforeBuildCommand: "npm run build"` ;
  - fenêtre de 1400×900 (minimum 1024×700), titre « Iso Piping 3D — <fichier> » ;
  - icônes générées par `tauri icon`.
- **Fonctions** :
  - plugins dialog et fs, implémentation `platform/tauri.js` ;
  - confirmation à la fermeture si des modifications ne sont pas enregistrées ;
  - association de l'extension `.isop` (optionnelle).
- **Version** unique : `package.json` et `tauri.conf.json` synchronisés par script.
- **Bundle** : `targets: ["msi", "nsis"]`.
  - Prévoir une **variante « offshore »** avec `bundle.windows.webviewInstallMode = offlineInstaller`. L'installateur est plus lourd mais s'installe sans internet ; l'installateur standard télécharge WebView2 s'il est absent.
- **`release.yml`** : sur tag `v*`, `tauri-apps/tauri-action` sur `windows-latest`, puis création d'une GitHub Release en brouillon avec les installateurs.
- **Signature de code** : non activée. Prévoir les emplacements de secrets et documenter l'avertissement SmartScreen dans le README.
- **Session cloud** :
  - ne pas tenter la compilation croisée Windows depuis Linux ;
  - si la toolchain Rust ou crates.io est indisponible, se limiter à `npm run build` et à la validation de configuration, puis laisser la CI construire.
- **Critère** : l'installateur produit par la CI s'installe et lance l'application sur Windows 10/11, avec ouverture, enregistrement et exports PNG/CSV vers le disque.

### Phase 4 — Options (hors périmètre sauf demande explicite)
- Builds macOS (signature et notarisation) et Linux.
- Mobile : Tauri mobile ou Capacitor.
- Auto-update (`tauri-plugin-updater`, qui exige des clés de signature).
- Montée de version de three.js.
- Passage à TypeScript.

## 11. Backlog connu — ne pas corriger en phases 0 à 3

- Masses calculées pour le tube uniquement : brides, vannes et raccords ne sont pas pesés.
- Longueur des goujons non calculée.
- Boulonnerie API comptée par set.
- Cl.2500 au-delà de 12" absente de la table.
- Disponibilité des tailles WECO non vérifiée.
- Pas de réduction automatique quand le DN change au niveau d'un coude.
- Longueurs exprimées en mm uniquement.
- Pas d'export CAO. Valeur ajoutée prioritaire : **export PCF (Isogen)**, puis DXF.

## 12. Conventions

- Code, commentaires, README et interface en anglais.
- Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `ci:`, `docs:`).
- Une branche `phase-N-<slug>` par phase, avec PR vers `main`.
- Aucun secret dans le dépôt : les certificats et clés vont dans GitHub Secrets.
- En cas de doute sur une valeur d'ingénierie : ne rien changer, ouvrir une issue avec la question et la source envisagée.

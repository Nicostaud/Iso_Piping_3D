// Parity harness: serves a test copy of legacy/index.html (never modified on
// disk) on a fake origin, with the jsDelivr scripts and Google Fonts routed to
// the same local files the new app bundles, so both sides render with
// identical three.js code and identical fonts.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const NM_DIR = resolve('node_modules');
const THREE_DIR = join(NM_DIR, 'three');
const FONT_DIRS = {
  barlow: join(NM_DIR, '@fontsource/barlow'),
  'barlow-condensed': join(NM_DIR, '@fontsource/barlow-condensed'),
};
// Same families/weights as the legacy Google Fonts URL and src/ imports.
const FONT_SHEETS = [
  ['barlow', 400], ['barlow', 500], ['barlow', 600], ['barlow', 700],
  ['barlow-condensed', 500], ['barlow-condensed', 600], ['barlow-condensed', 700],
];

export const LEGACY_URL = 'http://legacy.test/index.html';

// Exposes block-scoped legacy bindings (M, G3, csv…) to page.evaluate.
const HOOK = `
window.__t={get M(){return M},set M(v){M=v},get NM(){return NM},set NM(v){NM=v},get D(){return D},get G3(){return G3},
 get sel(){return sel},get tool(){return tool},get view(){return view},V,mto,csv,table,derive,normalize,sample,blank,addRun,changed,generate,setView,fit2D};
`;

export function legacyTestHtml() {
  let h = readFileSync('legacy/index.html', 'utf8');
  const sub = (from, to) => {
    if (!h.includes(from)) throw new Error('legacy test copy: pattern not found: ' + from);
    h = h.replace(from, to);
  };
  sub('https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js', '/__three/three.min.js');
  sub('https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/controls/OrbitControls.js', '/__three/OrbitControls.js');
  h = h.replace(/<link href="https:\/\/fonts\.googleapis\.com\/css2[^"]*" rel="stylesheet">/, '<link href="/__fonts.css" rel="stylesheet">');
  h = h.replace(/<link rel="preconnect"[^>]*>\n?/g, '');
  const end = h.lastIndexOf('}\n</script>');
  if (end < 0) throw new Error('legacy test copy: script end not found');
  return h.slice(0, end) + HOOK + h.slice(end);
}

function fontsCss() {
  return FONT_SHEETS.map(([fam, w]) =>
    readFileSync(join(FONT_DIRS[fam], `${w}.css`), 'utf8').replace(/url\(\.\/files\//g, `url(/__fonts/${fam}/`),
  ).join('\n');
}

/**
 * Routes the fake legacy origin. Any other non-local request is aborted and recorded.
 * @param {import('@playwright/test').Page} page
 */
export async function routeLegacy(page) {
  const external = [];
  const html = legacyTestHtml();
  const css = fontsCss();
  await page.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    if (u.host !== 'legacy.test') {
      external.push(u.href);
      return route.abort();
    }
    if (u.pathname === '/index.html') return route.fulfill({ contentType: 'text/html', body: html });
    if (u.pathname === '/__fonts.css') return route.fulfill({ contentType: 'text/css', body: css });
    if (u.pathname === '/__three/three.min.js') return route.fulfill({ path: join(THREE_DIR, 'build/three.min.js'), contentType: 'text/javascript' });
    if (u.pathname === '/__three/OrbitControls.js') return route.fulfill({ path: join(THREE_DIR, 'examples/js/controls/OrbitControls.js'), contentType: 'text/javascript' });
    const m = u.pathname.match(/^\/__fonts\/([\w-]+)\/([\w.-]+\.woff2?)$/);
    if (m && FONT_DIRS[m[1]]) return route.fulfill({ path: join(FONT_DIRS[m[1]], 'files', m[2]), contentType: m[2].endsWith('2') ? 'font/woff2' : 'font/woff' });
    return route.fulfill({ status: 404, body: '' });
  });
  return external;
}

/**
 * Seeds localStorage before the page scripts run.
 * @param {import('@playwright/test').Page} page
 * @param {{key: string, model: object} | null} seed
 */
export async function seed(page, seed) {
  await page.addInitScript((s) => {
    try {
      localStorage.clear();
      if (s) localStorage.setItem(s.key, JSON.stringify(s.model));
    } catch (e) { /* ignore */ }
  }, seed);
}

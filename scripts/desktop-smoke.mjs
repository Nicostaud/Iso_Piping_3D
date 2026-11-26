// Runtime smoke test of the real desktop app through tauri-driver (WebDriver).
// Checks the .isop file association, window title, unsaved marker, in-place save
// (fs scope granted at runtime), refused paths/commands (capabilities), 3D, no SW.
//
// Linux (WebKitGTK build), from the repository root:
//   sudo apt-get install libwebkit2gtk-4.1-dev webkit2gtk-driver xvfb   # + Tauri Linux prerequisites
//   cargo install tauri-driver --locked
//   npx tauri build --no-bundle
//   tauri-driver --port 4444 &
//   xvfb-run node scripts/desktop-smoke.mjs src-tauri/target/release/IsoPiping3D /tmp tests/fixtures/geo-utility.isop
// On Windows, use msedgedriver with tauri-driver (see the Tauri WebDriver guide) and IsoPiping3D.exe.
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [bin, dir, fixture] = process.argv.slice(2);
const proj = join(dir, 'kill line.isop');
copyFileSync(fixture, proj);
const W = 'http://127.0.0.1:4444';
const req = async (method, path, body) => {
  const r = await fetch(W + path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  const j = await r.json();
  if (j.value && j.value.error) throw new Error(`${path}: ${j.value.error} ${j.value.message}`);
  return j.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, info) => { results.push([ok ? 'PASS' : 'FAIL', name, info ?? '']); };

const s = await req('POST', '/session', { capabilities: { alwaysMatch: { 'tauri:options': { application: bin, args: [proj] } } } });
const id = s.sessionId;
const js = (script, args = []) => req('POST', `/session/${id}/execute/sync`, { script, args });
const jsa = (script, args = []) => req('POST', `/session/${id}/execute/async`, { script, args });
try {
  // wait for the app and the initial file
  let st;
  for (let i = 0; i < 40; i++) {
    st = await js("const d=document.querySelector('#docName');return {doc:d&&d.textContent,title:document.title,tauri:!!window.__TAURI_INTERNALS__,ligne:(document.querySelector('#mLigne')||{}).value,segs:document.querySelectorAll('#sideDyn').length}");
    if (st.doc === 'kill line.isop') break;
    await sleep(250);
  }
  check('runs inside Tauri', st.tauri);
  check('file association: .isop passed on the command line is opened', st.doc === 'kill line.isop', JSON.stringify(st));
  check('model loaded from that file', st.ligne === '6"-UW-1001-A1', st.ligne);
  check('window title "Iso Piping 3D — <file>"', st.title === 'Iso Piping 3D — kill line.isop', st.title);

  // edit → dirty marker
  await js("const i=document.querySelector('#mRev');i.value='Z9';i.dispatchEvent(new Event('input',{bubbles:true}));");
  await sleep(200);
  st = await js("return {doc:document.querySelector('#docName').textContent,title:document.title}");
  check('unsaved marker', st.doc === 'kill line.isop*' && st.title === 'Iso Piping 3D — kill line.isop*', JSON.stringify(st));

  // Ctrl+S → saved in place (fs scope granted at runtime for that file only)
  await js("window.dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true}))");
  let saved = null;
  for (let i = 0; i < 20; i++) {
    await sleep(250);
    try { const o = JSON.parse(readFileSync(proj, 'utf8')); if (o.model.meta.rev === 'Z9') { saved = o; break; } } catch (e) { /* not yet */ }
  }
  check('Ctrl+S writes the .isop in place', !!saved && saved.app === 'iso-piping-3d' && saved.format === 1, saved ? saved.savedAt : 'file unchanged');
  st = await js("return {doc:document.querySelector('#docName').textContent,toast:document.querySelector('#toast').textContent}");
  check('marker cleared after save', st.doc === 'kill line.isop', JSON.stringify(st));

  // minimal scope: other paths are refused
  const other = join(dir, 'other.txt');
  writeFileSync(other, 'secret');
  const r = await jsa("const done=arguments[arguments.length-1];window.__TAURI_INTERNALS__.invoke('plugin:fs|read_text_file',{path:arguments[0]}).then(v=>done('ALLOWED'),e=>done('REFUSED: '+String(e)))", [other]);
  check('fs scope refuses a path that was not picked', r.startsWith('REFUSED'), r);
  const r2 = await jsa("const done=arguments[arguments.length-1];window.__TAURI_INTERNALS__.invoke('plugin:fs|remove',{path:arguments[0]}).then(v=>done('ALLOWED'),e=>done('REFUSED: '+String(e)))", [proj]);
  check('commands not granted in the capability are refused (fs remove)', r2.startsWith('REFUSED'), r2);

  // 3D renders in the system webview
  await js("document.querySelector('#bGen').click()");
  await sleep(1500);
  st = await js("const c=document.querySelector('#v3 canvas');return {canvas:!!c,msg:document.querySelector('#msg3').hidden,w:c&&c.width}");
  check('3D view (WebGL) in the system webview', st.canvas && st.msg, JSON.stringify(st));
  st = await js("return navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then(r=>r.length) : 0");
  check('no service worker in the desktop build', st === 0 || st === undefined || (st && st.then), String(st));
} finally {
  await req('DELETE', `/session/${id}`).catch(() => {});
}
for (const r of results) console.log(r.join(' | '));
process.exit(results.some((r) => r[0] === 'FAIL') ? 1 : 0);

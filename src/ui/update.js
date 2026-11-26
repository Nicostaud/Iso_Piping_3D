/**
 * Service worker registration (offline cache) and the "new version" prompt.
 * The app is fully precached: after the first visit it starts without network.
 */
import { registerSW } from 'virtual:pwa-register';
import { toast } from './panels.js';

function showUpdate(reload) {
  if (document.getElementById('upd')) return;
  const bar = document.createElement('div');
  bar.id = 'upd';
  bar.setAttribute('role', 'alert');
  bar.innerHTML = '<span>New version available</span><button type="button" class="pri">Reload</button><button type="button" aria-label="Dismiss">×</button>';
  const [ok, close] = bar.querySelectorAll('button');
  ok.onclick = () => { ok.disabled = true; reload(); };
  close.onclick = () => bar.remove();
  document.body.appendChild(bar);
}

export function initUpdates() {
  if (!('serviceWorker' in navigator)) return;
  const update = registerSW({
    onNeedRefresh() { showUpdate(() => update(true)); },
    onOfflineReady() { toast('Ready to work offline'); },
  });
}

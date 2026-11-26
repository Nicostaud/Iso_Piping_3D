// PWA: manifest, installability (Chrome criteria via CDP) and offline start.
import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { collectErrors, storedModel } from './helpers.js';

test.use({ serviceWorkers: 'allow' });

/** Waits until the service worker is active, controls the page and has precached the build. */
async function waitForServiceWorker(page) {
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
    await page.reload();
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  }
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

test('manifest, icons and installability', async ({ page }) => {
  await page.goto('/');
  const res = await page.request.get('/manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m).toMatchObject({ name: 'Iso Piping 3D', short_name: 'IsoPiping', display: 'standalone', theme_color: '#ffffff', background_color: '#e9ecef', start_url: '/', scope: '/' });
  const sizes = {};
  for (const icon of m.icons.filter((i) => i.type === 'image/png')) {
    const r = await page.request.get('/' + icon.src);
    expect(r.ok(), icon.src).toBe(true);
    const png = PNG.sync.read(await r.body());
    expect(`${png.width}x${png.height}`).toBe(icon.sizes);
    sizes[icon.purpose + ' ' + icon.sizes] = true;
  }
  expect(Object.keys(sizes).sort()).toEqual(['any 192x192', 'any 512x512', 'maskable 512x512']);

  // iOS "Add to Home Screen"
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/icons/apple-touch-icon.png');
  expect((await page.request.get('/icons/apple-touch-icon.png')).ok()).toBe(true);
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');

  await waitForServiceWorker(page);
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors).toEqual([]);
});

test('offline after the first visit: reload, draw and generate 3D', async ({ page, context }, testInfo) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await waitForServiceWorker(page);

  await context.setOffline(true);
  expect(await page.evaluate(() => fetch('/manifest.webmanifest?x=' + Math.random()).then(() => 'online', () => 'offline'))).toBe('offline');
  errors.length = 0; // the probe above logs a network error by design
  await page.reload();
  await expect(page.locator('#cv')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const before = (await storedModel(page)).segs.length;

  const box = await page.locator('#cv').boundingBox();
  const x0 = box.x + 120, y0 = box.y + box.height - 120;
  await page.mouse.click(x0, y0);
  await page.mouse.move(x0 + 160, y0 + 90);
  await page.keyboard.type('1200');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await storedModel(page)).segs.length).toBeGreaterThan(before);

  await page.locator('#bGen').click();
  await expect(page.locator('#v3 canvas')).toBeVisible();
  await expect(page.locator('#msg3')).toBeHidden();
  await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath('offline-3d.png') });
  // Barlow is served from the precache too
  expect(await page.evaluate(() => document.fonts.check('600 16px "Barlow Condensed"'))).toBe(true);
  expect(errors).toEqual([]);
});

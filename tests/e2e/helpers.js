// Shared e2e helpers: offline guard and console error collection.

/**
 * Blocks every request that does not target the local preview server and
 * records it, so a test can assert that the app needs no network at runtime.
 * @param {import('@playwright/test').Page} page
 */
export async function guardNetwork(page) {
  const external = [];
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.protocol === 'data:' || url.protocol === 'blob:') {
      return route.continue();
    }
    external.push(url.href);
    return route.abort();
  });
  return external;
}

/** @param {import('@playwright/test').Page} page */
export function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

/** Reads the persisted model (localStorage key isopiping.v4). */
export function storedModel(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('isopiping.v4') || 'null'));
}

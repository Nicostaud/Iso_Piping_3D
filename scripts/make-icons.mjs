// Renders the PWA / desktop icons from public/icons/icon.svg with Chromium.
// Usage: node scripts/make-icons.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/icons/icon.svg', 'utf8');
const uri = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
// maskable: full-bleed square background, artwork scaled into the 80 % safe zone
const OUT = [
  { file: 'icon-192.png', size: 192, mask: false },
  { file: 'icon-512.png', size: 512, mask: false },
  { file: 'maskable-512.png', size: 512, mask: true },
  { file: 'apple-touch-icon.png', size: 180, mask: true },
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const o of OUT) {
  await page.setViewportSize({ width: o.size, height: o.size });
  const inner = o.mask ? Math.round(o.size * 0.8) : o.size;
  await page.setContent(`<html><body style="margin:0;background:${o.mask ? '#15181c' : 'transparent'};display:grid;place-items:center;width:${o.size}px;height:${o.size}px">
    <img src="${uri}" width="${inner}" height="${inner}"></body></html>`);
  await page.screenshot({ path: `public/icons/${o.file}`, omitBackground: !o.mask });
  console.log(o.file);
}
await browser.close();

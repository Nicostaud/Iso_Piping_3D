// Renders the 1024 px source for `tauri icon` from public/icons/icon.svg.
// Usage: node scripts/make-app-icon.mjs && npx tauri icon src-tauri/app-icon.png
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const uri = 'data:image/svg+xml;base64,' + Buffer.from(readFileSync('public/icons/icon.svg', 'utf8')).toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
await page.setContent(`<body style="margin:0"><img src="${uri}" width="1024" height="1024"></body>`);
await page.screenshot({ path: 'src-tauri/app-icon.png', omitBackground: true });
await browser.close();

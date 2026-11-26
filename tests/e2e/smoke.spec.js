import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { guardNetwork, collectErrors, storedModel, noPickers } from './helpers.js';

test('smoke: draw a pipe, generate 3D, export CSV — without network', async ({ page }, testInfo) => {
  const external = await guardNetwork(page);
  const errors = collectErrors(page);
  await noPickers(page);

  await page.goto('/');
  await expect(page.locator('#cv')).toBeVisible();
  // Fresh storage → the offshore example is loaded and persisted.
  await expect.poll(async () => (await storedModel(page))?.segs.length ?? 0).toBeGreaterThan(0);
  const before = (await storedModel(page)).segs.length;

  // Draw: Pipe tool is active at startup. Start on the grid, point East-ish, type 1500, Enter.
  const box = await page.locator('#cv').boundingBox();
  const x0 = box.x + 120, y0 = box.y + box.height - 120;
  await page.mouse.move(x0, y0);
  await page.mouse.click(x0, y0);
  await expect(page.locator('#hud')).toBeVisible();
  await page.mouse.move(x0 + 160, y0 + 90);
  await page.keyboard.type('1500');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter'); // empty fields → finish the line
  await expect(page.locator('#hud')).toBeHidden();
  await expect.poll(async () => (await storedModel(page)).segs.length).toBeGreaterThan(before);
  const m = await storedModel(page);
  expect(m.segs.some((s) => s.L === 1500)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('2d.png') });

  // Generate 3D.
  await page.locator('#bGen').click();
  await expect(page.locator('#work')).toHaveAttribute('data-v', '3d');
  await expect(page.locator('#v3 canvas')).toBeVisible();
  await expect(page.locator('#msg3')).toBeHidden();
  await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath('3d.png') });

  // Export CSV.
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-a="bomcsv"]').click()]);
  expect(dl.suggestedFilename()).toMatch(/-MTO\.csv$/);
  const text = await readFile(await dl.path(), 'utf8');
  expect(text.startsWith('﻿Item,Section,Description')).toBe(true);
  expect(text).toContain('"Pipe"');
  expect(text).toContain('Butt welds');

  expect(external, 'no external request at runtime').toEqual([]);
  expect(errors, 'no console error').toEqual([]);
});

/*
 * Renders the Reedslip UI mocks and fictional logos in this folder to PNG files under ../assets (run: node library/content/assets-src/render.ts).
 * Screens: editor, search, sync, plugins, each cropped tightly to its window or panel at 2x with a transparent background outside the rounded corners and no shadow. Logos: each .logo element of logos.html with a transparent background, at 2x for crisp edges.
 */
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const assets = join(here, '..', 'assets');
const SCREENS = ['editor', 'search', 'sync', 'plugins'];
const LOGOS = ['beichen', 'yunling', 'halden', 'qinghe', 'meridian', 'dukou'];

await mkdir(join(assets, 'logos'), { recursive: true });
const browser = await chromium.launch();
try {
  const screens = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  for (const name of SCREENS) {
    const page = await screens.newPage();
    await page.goto(pathToFileURL(join(here, `${name}.html`)).href);
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.window, .panel').first().screenshot({ path: join(assets, `${name}.png`), omitBackground: true });
    await page.close();
  }
  const logos = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
  const page = await logos.newPage();
  await page.goto(pathToFileURL(join(here, 'logos.html')).href);
  await page.evaluate(() => document.fonts.ready);
  for (const id of LOGOS) {
    await page.locator(`#${id}`).screenshot({ path: join(assets, 'logos', `${id}.png`), omitBackground: true });
  }
} finally {
  await browser.close();
}

/*
 * Renders the generated images to PNG with Playwright's Chromium, for looking at them (nothing here is shipped).
 * node systems/paper-editorial/images/src/preview.mjs            -> out/pe-works/images-contact.png, a nine-image contact sheet on the paper colour
 * node systems/paper-editorial/images/src/preview.mjs <id> [...] -> out/pe-images/<id>.png at native size, one per id
 * Reads images/<id>.svg (or the generated images/<id>.webp) through file:// URLs from a temporary HTML page, so what you see is what an <img> in a built page shows (no page fonts, no CSS variables).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { HEX } from './lib/palette.mjs';
import { IMAGE_IDS } from './ids.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const imagesDir = fileURLToPath(new URL('../', import.meta.url));

async function shoot(browser, html, width, height, outFile) {
  mkdirSync(`${root}out/pe-images`, { recursive: true });
  const page = await browser.newPage({ viewport: { width, height } });
  const htmlFile = `${root}out/pe-images/sheet.html`;
  writeFileSync(htmlFile, html);
  await page.goto(`file://${htmlFile}`);
  await page.screenshot({ path: outFile, fullPage: true });
  await page.close();
}

const fileOf = (id) => ['svg', 'webp', 'png'].map((ext) => `${imagesDir}${id}.${ext}`).find((file) => existsSync(file));

const sizeOf = (id) => {
  const file = fileOf(id);
  if (!file.endsWith('.svg')) return [1600, 1340];
  const head = readFileSync(file, 'utf8').slice(0, 400);
  const [, w, h] = head.match(/viewBox="0 0 (\d+) (\d+)"/);
  return [Number(w), Number(h)];
};

export async function preview(ids) {
  const browser = await chromium.launch();
  if (ids.length) {
    for (const id of ids) {
      const [w, h] = sizeOf(id);
      await shoot(browser, `<body style="margin:0;background:${HEX.paper}"><img src="file://${fileOf(id)}" width="${w}" style="display:block"></body>`, w, h, `${root}out/pe-images/${id}.png`);
    }
  } else {
    mkdirSync(`${root}out/pe-works`, { recursive: true });
    const cells = IMAGE_IDS.map((id) => {
      const [w, h] = sizeOf(id);
      const wide = w >= 1000;
      return `<figure style="margin:0;grid-column:span ${wide ? 3 : 2}"><img src="file://${fileOf(id)}" style="width:100%;display:block"><figcaption style="font:13px/1.6 monospace;color:${HEX['ink-3']};padding-top:6px">${id} ${w}x${h}</figcaption></figure>`;
    }).join('');
    const html = `<body style="margin:0;background:${HEX.paper};padding:32px"><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:28px;width:1800px">${cells}</div></body>`;
    await shoot(browser, html, 1864, 900, `${root}out/pe-works/images-contact.png`);
  }
  await browser.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await preview(process.argv.slice(2));
}

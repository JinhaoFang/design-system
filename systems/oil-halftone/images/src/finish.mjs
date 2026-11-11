/*
 * Finishing step for generated pictures (生图成品): white-balances the model's paper to this system's paper colour and writes a resized WebP. Run from the repository root:
 *   node systems/<体系>/images/src/finish.mjs <源图.png> <输出.webp> [--width <px>] [--quality <0-1>] [--crop <x,y,w,h 0-1 比例>] [--no-balance] [--clamp]
 * The paper reference is the median of the four corner patches (16x16 px each) of the (cropped) source; every channel is scaled so that reference lands on color.paper from system.tokens.json, clamped to 0-255.
 * Highlights brighter than the paper are scaled the same way, so the fade-out margin of a picture meets the page without a visible edge. Default width 1600, quality 0.86, no crop. --no-balance skips the white balance, for pictures whose corners are not paper (a painting on a solid teal ground).
 * --clamp caps every channel at the paper value after balancing, so nothing in the picture is lighter than the page: a faded painting then matches the paper even while it is composited on its own layer during an entrance.
 * Rendering happens in headless Chromium through Playwright (a dev dependency already used by the build). Deterministic for a given source.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const [src, out] = args;
if (!src || !out) {
  console.error('用法：node systems/<体系>/images/src/finish.mjs <源图.png> <输出.webp> [--width 像素] [--quality 0-1] [--crop x,y,w,h] [--no-balance] [--clamp]');
  process.exit(2);
}
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i > 0 ? args[i + 1] : fallback; };
const tokens = JSON.parse(readFileSync(new URL('../../system.tokens.json', import.meta.url), 'utf8'));
const paperHex = tokens.color.paper.$value.hex;
const paper = [1, 3, 5].map((i) => parseInt(paperHex.slice(i, i + 2), 16));
const width = Number(opt('width', 1600));
const quality = Number(opt('quality', 0.86));
const crop = opt('crop', '0,0,1,1').split(',').map(Number);
const balance = !args.includes('--no-balance');
const clamp = args.includes('--clamp');
const dataUrl = `data:image/png;base64,${readFileSync(resolve(src)).toString('base64')}`;

const browser = await chromium.launch();
const page = await browser.newPage();
const webp = await page.evaluate(async ({ dataUrl, paper, width, quality, crop, balance, clamp }) => {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const [cx, cy, cw, ch] = [crop[0] * img.width, crop[1] * img.height, crop[2] * img.width, crop[3] * img.height];
  const w = Math.min(width, Math.round(cw));
  const h = Math.round(ch * (w / cw));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSizeSmoothingQuality = 'high';
  ctx.drawImage(img, cx, cy, cw, ch, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const samples = [[], [], []];
  for (const [ox, oy] of [[0, 0], [w - 16, 0], [0, h - 16], [w - 16, h - 16]]) {
    for (let y = oy; y < oy + 16; y++) for (let x = ox; x < ox + 16; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) samples[c].push(px[i + c]);
    }
  }
  if (!balance) return canvas.toDataURL('image/webp', quality);
  const ref = samples.map((s) => s.sort((a, b) => a - b)[s.length >> 1]);
  const gain = ref.map((r, c) => paper[c] / Math.max(r, 1));
  for (let i = 0; i < px.length; i += 4) for (let c = 0; c < 3; c++) px[i + c] = Math.min(clamp ? paper[c] : 255, Math.round(px[i + c] * gain[c]));
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL('image/webp', quality);
}, { dataUrl, paper, width, quality, crop, balance, clamp });
await browser.close();
writeFileSync(resolve(out), Buffer.from(webp.split(',')[1], 'base64'));
console.log(out);

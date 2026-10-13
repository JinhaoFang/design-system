/*
 * Two-drum separation for generated pictures (生图分色): turns a picture from the image model into a strict two-ink riso print, so the image model's own colours never reach the page.
 * Run from the repository root:
 *   node systems/riso-print/images/src/separate.mjs <source.png> <out.webp> [--width <px>] [--quality <0-1>] [--diffuse <0-1>] [--trim] [--screen [--cell <px>] [--soften <px>]]
 * Default mode (snap): keeps the picture's own dot structure and snaps every pixel to the nearest of the four colours two drums can print (paper, blue, pink, pink-over-blue purple), compared in CIELAB after
 *   white-balancing the source's paper (median of the top and bottom rows, or the corner pixel before --trim crops the margin) to the system paper; the rounding error is diffused to the neighbours (Floyd–Steinberg, --diffuse 0..1, default 0.85), so mid-tones become
 *   a fine grain of blue, purple and paper the way riso ink sits on uncoated stock instead of flattening into solid blue. Use this for pictures the model already drew as a two-colour riso print. Output is lossless WebP (Chromium encodes quality 1 losslessly), so the file decodes to exactly those four colours; --quality only applies to --screen.
 * --trim crops the paper margin the model leaves around the print (rows and columns less than 60% inked), for pictures that run full bleed.
 * --screen mode: for every pixel it finds the pink and blue coverage (0..1 each) whose multiplied overprint on the paper colour comes closest to the source colour (a lookup over a 21x21 coverage grid, matched in linear light),
 * then re-screens both plates as amplitude-modulated halftone dots: blue at 15°, pink at 75°, one dot per cell, dot area equal to coverage up to the point where round dots touch, then growing to a solid. Inks multiply, so pink over blue prints the system's purple.
 * The source is softened first (Gaussian blur of --soften px, default 0.6 cell) so the model's own dot pattern does not beat against the new screen. Plates stay in register (SYSTEM.md 错版: images carry no misregistration).
 * Colours come from system.tokens.json (paper, blue, pink). Rendering happens in headless Chromium through Playwright (a dev dependency already used by the build), output is WebP. Deterministic for a given source.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const [src, out] = args;
if (!src || !out) {
  console.error('用法：node systems/riso-print/images/src/separate.mjs <源图.png> <输出.webp> [--width 像素] [--quality 0-1] [--diffuse 0-1] [--trim] [--screen [--cell 像素] [--soften 像素]]');
  process.exit(2);
}
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i > 0 ? Number(args[i + 1]) : fallback; };
const tokens = JSON.parse(readFileSync(new URL('../../system.tokens.json', import.meta.url), 'utf8'));
const hex = (name) => tokens.color[name].$value.hex;
const config = { trim: args.includes('--trim'), mode: args.includes('--screen') ? 'screen' : 'snap', paper: hex('paper'), blue: hex('blue'), pink: hex('pink'), width: opt('width', 1600), cell: opt('cell', 6), soften: opt('soften', NaN), quality: opt('quality', 0.86), diffuse: opt('diffuse', 0.85) };
const dataUrl = `data:image/png;base64,${readFileSync(resolve(src)).toString('base64')}`;

const browser = await chromium.launch();
const page = await browser.newPage();
const result = await page.evaluate(async ({ dataUrl, config }) => {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const W = config.width;
  const soften = Number.isFinite(config.soften) ? config.soften : config.cell * 0.6;
  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight, paperRef = null;
  if (config.trim) {
    const probe = document.createElement('canvas');
    probe.width = sw; probe.height = sh;
    const pc = probe.getContext('2d', { willReadFrequently: true });
    pc.drawImage(img, 0, 0);
    const d = pc.getImageData(0, 0, sw, sh).data;
    const ref = [0, 1, 2].map((c) => d[(2 * sw + 2) * 4 + c]);
    paperRef = ref;
    const inked = (x, y) => { const i = (y * sw + x) * 4; return Math.abs(d[i] - ref[0]) + Math.abs(d[i + 1] - ref[1]) + Math.abs(d[i + 2] - ref[2]) > 60; };
    const rowInk = (y) => { let n = 0; for (let x = 0; x < sw; x += 4) n += inked(x, y); return n / (sw / 4); };
    const colInk = (x) => { let n = 0; for (let y = 0; y < sh; y += 4) n += inked(x, y); return n / (sh / 4); };
    let top = 0, bottom = sh - 1, left = 0, right = sw - 1;
    while (top < sh / 4 && rowInk(top) < 0.6) top++;
    while (bottom > (sh * 3) / 4 && rowInk(bottom) < 0.6) bottom--;
    while (left < sw / 4 && colInk(left) < 0.6) left++;
    while (right > (sw * 3) / 4 && colInk(right) < 0.6) right--;
    const pad = Math.round(Math.min(sw, sh) * 0.006);
    sx = left + pad; sy = top + pad; sw = right - left - 2 * pad; sh = bottom - top - 2 * pad;
  }
  const H = Math.round((sh / sw) * W);
  const read = document.createElement('canvas');
  read.width = W; read.height = H;
  const rc = read.getContext('2d', { willReadFrequently: true });
  if (config.mode === 'screen') rc.filter = `blur(${soften}px)`;
  rc.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  const px = rc.getImageData(0, 0, W, H).data;

  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const P = rgb(config.paper).map(lin), B = rgb(config.blue).map(lin), K = rgb(config.pink).map(lin);
  const steps = 20;
  const grid = [];
  for (let b = 0; b <= steps; b++) for (let k = 0; k <= steps; k++) {
    const cb = b / steps, ck = k / steps;
    grid.push([cb, ck, ...[0, 1, 2].map((i) => P[i] * (1 - cb + cb * (B[i] / P[i])) * (1 - ck + ck * (K[i] / P[i])))]);
  }
  const cache = new Map();
  const cover = (r, g, b) => {
    const key = (r >> 3) << 10 | (g >> 3) << 5 | (b >> 3);
    let hit = cache.get(key);
    if (hit) return hit;
    const t = [lin(((r >> 3) << 3 | 4) / 255), lin(((g >> 3) << 3 | 4) / 255), lin(((b >> 3) << 3 | 4) / 255)].map((v) => Math.cbrt(v));
    let best = Infinity;
    for (const [cb, ck, x, y, z] of grid) {
      const d = (Math.cbrt(x) - t[0]) ** 2 + (Math.cbrt(y) - t[1]) ** 2 + (Math.cbrt(z) - t[2]) ** 2;
      if (d < best) { best = d; hit = [cb, ck]; }
    }
    cache.set(key, hit);
    return hit;
  };
  if (config.mode === 'snap') {
    const inks = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([cb, ck]) => [0, 1, 2].map((i) => P[i] * (1 - cb + cb * (B[i] / P[i])) * (1 - ck + ck * (K[i] / P[i]))));
    const paperSrc = paperRef ? paperRef.map((v) => lin(v / 255)) : [0, 1, 2].map((c) => { const v = []; for (let x = 0; x < W; x += 7) { v.push(px[(2 * W + x) * 4 + c], px[((H - 3) * W + x) * 4 + c]); } v.sort((a, b) => a - b); return lin(v[v.length >> 1] / 255); });
    const toLab = (l) => { const x = (0.4124 * l[0] + 0.3576 * l[1] + 0.1805 * l[2]) / 0.9505, y = 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2], z = (0.0193 * l[0] + 0.1192 * l[1] + 0.9505 * l[2]) / 1.089; const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]; };
    const inkLab = inks.map(toLab);
    const out8 = inks.map((l) => l.map((v) => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055))));
    const snapped = rc.createImageData(W, H);
    const lab = new Float32Array(W * H * 3);
    for (let i = 0; i < W * H; i++) {
      const t = toLab([0, 1, 2].map((c) => Math.min(1, (lin(px[i * 4 + c] / 255) / paperSrc[c]) * P[c])));
      lab[i * 3] = t[0]; lab[i * 3 + 1] = t[1]; lab[i * 3 + 2] = t[2];
    }
    const spread = (i, e, w) => { if (i < 0 || i >= W * H) return; lab[i * 3] += e[0] * w; lab[i * 3 + 1] += e[1] * w; lab[i * 3 + 2] += e[2] * w; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, t = [lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2]];
      let best = Infinity, k = 0;
      inkLab.forEach((q, j) => { const d = (q[0] - t[0]) ** 2 + 0.5 * ((q[1] - t[1]) ** 2 + (q[2] - t[2]) ** 2); if (d < best) { best = d; k = j; } });
      const e = [0, 1, 2].map((c) => (t[c] - inkLab[k][c]) * config.diffuse);
      if (x + 1 < W) spread(i + 1, e, 7 / 16);
      if (y + 1 < H) { if (x > 0) spread(i + W - 1, e, 3 / 16); spread(i + W, e, 5 / 16); if (x + 1 < W) spread(i + W + 1, e, 1 / 16); }
      const o = out8[k]; snapped.data[i * 4] = o[0]; snapped.data[i * 4 + 1] = o[1]; snapped.data[i * 4 + 2] = o[2]; snapped.data[i * 4 + 3] = 255;
    }
    rc.putImageData(snapped, 0, 0);
    return { url: read.toDataURL('image/webp', 1), W, H };
  }
  const coverage = [new Float32Array(W * H), new Float32Array(W * H)];
  for (let i = 0; i < W * H; i++) {
    const [cb, ck] = cover(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
    coverage[0][i] = cb; coverage[1][i] = ck;
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = W; outCanvas.height = H;
  const oc = outCanvas.getContext('2d');
  oc.fillStyle = config.paper;
  oc.fillRect(0, 0, W, H);
  const screen = (plate, color, degrees) => {
    const layer = document.createElement('canvas');
    layer.width = W; layer.height = H;
    const lc = layer.getContext('2d');
    lc.fillStyle = '#ffffff';
    lc.fillRect(0, 0, W, H);
    lc.fillStyle = color;
    const a = (degrees * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a), s = config.cell;
    const reach = Math.ceil(Math.hypot(W, H) / s) + 2;
    for (let u = -reach; u <= reach; u++) for (let v = -reach; v <= reach; v++) {
      const x = (u * cos - v * sin) * s + W / 2, y = (u * sin + v * cos) * s + H / 2;
      if (x < -s || y < -s || x > W + s || y > H + s) continue;
      const xi = Math.min(W - 1, Math.max(0, Math.round(x))), yi = Math.min(H - 1, Math.max(0, Math.round(y)));
      const c = plate[yi * W + xi];
      if (c < 0.02) continue;
      lc.beginPath();
      const r = c < 0.785 ? Math.sqrt(c / Math.PI) : 0.5 + ((c - 0.785) / 0.215) * 0.22;
      lc.arc(x, y, r * s, 0, Math.PI * 2);
      lc.fill();
    }
    oc.globalCompositeOperation = 'multiply';
    oc.drawImage(layer, 0, 0);
    oc.globalCompositeOperation = 'source-over';
  };
  screen(coverage[0], config.blue, 15);
  screen(coverage[1], config.pink, 75);
  return { url: outCanvas.toDataURL('image/webp', config.quality), W, H };
}, { dataUrl, config });
await browser.close();
writeFileSync(resolve(out), Buffer.from(result.url.split(',')[1], 'base64'));
console.log(`已写出 ${out}（${result.W}×${result.H}）`);

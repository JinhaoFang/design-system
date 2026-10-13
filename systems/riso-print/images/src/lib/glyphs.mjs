/*
 * Text to outline paths, so standalone SVG images and fragment drawings show the system's own fonts without needing @font-face (an SVG used as <img> cannot load page fonts).
 * Fonts come from the git-ignored cache that `pnpm ds fetch-fonts` fills (.cache/fonts at the repository root, or FONT_CACHE); glyphs are read with harfbuzzjs (already a repository dependency).
 * FONTS keys: sans400 / sans700 (Noto Sans SC), qingke (ZCOOL QingKe HuangYou), grot500 / grot700 (Space Grotesk).
 * textPath(str, {font, size, x, y, anchor, track, fill, opacity}) -> {svg, width}: horizontal run, x/y is the baseline origin, track in em.
 * verticalPath(str, {font, size, x, y, track, fill}) -> {svg, height}: top-to-bottom column, x is the column centre, y the top.
 * measure(str, font, size, track) returns the advance width. Missing glyphs throw, so a broken label never ships silently.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Blob, Face, Font } from 'harfbuzzjs';
import { f } from './random.mjs';

const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const cache = process.env.FONT_CACHE ?? `${root}.cache/fonts`;

const FILES = {
  sans400: 'NotoSansSC-Regular.otf',
  sans700: 'NotoSansSC-Bold.otf',
  qingke: 'ZCOOLQingKeHuangYou-Regular.ttf',
  grot500: 'SpaceGrotesk-Medium.ttf',
  grot700: 'SpaceGrotesk-Bold.ttf',
};

const loaded = new Map();
const pathCache = new Map();

export function baseline(font, size, lineHeight) {
  const { ascender, descender } = fontOf(font).font.hExtents();
  return (lineHeight * size + (ascender + descender) * size / fontOf(font).upem) / 2;
}

function fontOf(key) {
  if (loaded.has(key)) return loaded.get(key);
  const file = `${cache}/${FILES[key]}`;
  if (!FILES[key] || !existsSync(file)) throw new Error(`font ${key} not found at ${file}; run pnpm ds fetch-fonts or set FONT_CACHE`);
  const face = new Face(new Blob(readFileSync(file)));
  const entry = { font: new Font(face), upem: face.upem };
  loaded.set(key, entry);
  return entry;
}

function glyphOf(key, char) {
  const id = `${key}:${char}`;
  if (pathCache.has(id)) return pathCache.get(id);
  const { font, upem } = fontOf(key);
  const gid = font.nominalGlyph(char.codePointAt(0));
  if (gid === undefined || (gid === 0 && char !== ' ')) throw new Error(`glyph ${char} (U+${char.codePointAt(0).toString(16)}) missing in ${key}`);
  const entry = { d: font.glyphToPath(gid), advance: font.glyphHAdvance(gid) / upem };
  pathCache.set(id, entry);
  return entry;
}

export function measure(str, font, size, track = 0) {
  let w = 0;
  const chars = [...str];
  chars.forEach((c, i) => {
    w += glyphOf(font, c).advance * size + (i < chars.length - 1 ? track * size : 0);
  });
  return w;
}

const scaleOf = (font, size) => Math.round((size / fontOf(font).upem) * 100000) / 100000;

export function textPath(str, { font, size, x = 0, y = 0, anchor = 'start', track = 0, fill = 'currentColor', opacity = 1, halo }) {
  const width = measure(str, font, size, track);
  const x0 = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  const s = scaleOf(font, size);
  let cursor = 0;
  const parts = [];
  for (const c of str) {
    const g = glyphOf(font, c);
    if (c !== ' ' && g.d) parts.push(`<path transform="translate(${f(cursor)} 0)" d="${g.d}"/>`);
    cursor += (g.advance * size + track * size) / s;
  }
  const o = (opacity === 1 ? '' : ` opacity="${opacity}"`) + (halo ? ` stroke="${halo.color}" stroke-width="${f((halo.width / s) * 100) / 100}" stroke-linejoin="round" paint-order="stroke"` : '');
  return { svg: `<g fill="${fill}"${o} transform="translate(${f(x0)} ${f(y)}) scale(${s} ${-s})">${parts.join('')}</g>`, width };
}

export function verticalPath(str, { font, size, x = 0, y = 0, track = 0, fill = 'currentColor', opacity = 1 }) {
  const s = scaleOf(font, size);
  const parts = [];
  let cursor = y;
  for (const c of str) {
    const g = glyphOf(font, c);
    const gx = x - (g.advance * size) / 2;
    const gy = cursor + size * 0.86;
    parts.push(`<path transform="translate(${f(gx)} ${f(gy)}) scale(${s} ${-s})" d="${g.d}"/>`);
    cursor += size * (1 + track);
  }
  const o = opacity === 1 ? '' : ` opacity="${opacity}"`;
  return { svg: `<g fill="${fill}"${o}>${parts.join('')}</g>`, height: cursor - y - size * track };
}

export function textMixed(str, { cjk = 'sans400', latin = 'grot500', size, x = 0, y = 0, anchor = 'start', track = 0, gap = 0.18, fill = 'currentColor', halo }) {
  const runs = str.match(/[\u0000-ɏ]+|[^\u0000-ɏ]+/g) ?? [];
  const items = runs
    .map((run) => {
      const isLatin = /^[\u0000-ɏ]/.test(run);
      return { run: isLatin ? run.trim() : run, font: isLatin ? latin : cjk };
    })
    .filter((item) => item.run);
  const widths = items.map((item) => measure(item.run, item.font, size, track));
  const total = widths.reduce((a, b) => a + b, 0) + gap * size * Math.max(0, items.length - 1);
  let cursor = anchor === 'middle' ? x - total / 2 : anchor === 'end' ? x - total : x;
  const parts = items.map((item, i) => {
    const t = textPath(item.run, { font: item.font, size, x: cursor, y, track, fill, halo });
    cursor += widths[i] + gap * size;
    return t.svg;
  });
  return { svg: parts.join(''), width: total };
}

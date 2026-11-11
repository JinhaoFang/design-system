/*
 * Text to outline paths for standalone SVG images (an SVG used as <img> cannot load page fonts). Adapted from riso-print's helper with this system's fonts.
 * Fonts come from the git-ignored cache that `pnpm ds fetch-fonts` fills (.cache/fonts at the repository root, or FONT_CACHE); glyphs are read with harfbuzzjs (already a repository dependency).
 * FONTS keys: sans400 (Noto Sans SC Regular).
 * textPath(str, {font, size, x, y, anchor, track, fill}) -> {svg, width}: horizontal run, x/y is the baseline origin, track in em. measure(str, font, size, track) returns the advance width.
 * Missing glyphs throw, so a broken label never ships silently.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Blob, Face, Font } from 'harfbuzzjs';

const f = (n) => Math.round(n * 100) / 100;

const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const cache = process.env.FONT_CACHE ?? `${root}.cache/fonts`;

const FILES = {
  sans400: 'NotoSansSC-Regular.otf',
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

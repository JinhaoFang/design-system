/*
 * Leaf arrangements for the showcase and layouts, all deterministic. Every function returns leaf specs { species, color, x, y, w, angle, seed } in percent of a field (left/top of the leaf box, width),
 * consumed by works/common.mjs leaf(). Fields are square unless noted, so percentages of width and height match.
 *   bouquet(n, seed, r): leaves on a golden-angle spiral inside a disc of radius r (percent), tips pointing outward, so they read as one round bunch.
 *   drift(points, seed): a handful of single leaves at given [x, y] positions, turned at random, for the letter margins (leaves coming off the bunch).
 *   tree(n, seed): a crown (ellipse) of leaves pointing up and out, in a field 5:6 (width:height); trunk() is the matching cut-paper trunk as an svg string.
 *   ground(n, seed): leaves lying along the bottom of a wide field (aspect 10:1), as if they have just fallen.
 *   sheet(fill, holes, { width, height, id }) builds the negative-shape sheet: a coloured rectangle with leaf-shaped windows cut by an svg mask (id must be unique on the page).
 */
import { leafPath, rng, SPECIES } from '../lib/leaves.mjs';

export const COLORS = ['vermilion', 'persimmon', 'peach', 'mustard', 'cobalt', 'indigo', 'pine', 'sprout'];
const r1 = (n) => Math.round(n * 10) / 10;
const H = 124 / 120;

export function bouquet(n = 44, seed = 3, r = 38) {
  const rand = rng(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const rr = r * Math.sqrt(t);
    const th = i * 2.399963;
    const w = 13 + 7 * t + rand() * 3;
    const cx = 50 + rr * Math.cos(th), cy = 50 + rr * Math.sin(th);
    out.push({ species: SPECIES[(i * 7 + Math.floor(rand() * 3)) % SPECIES.length], color: COLORS[(i * 5 + Math.floor(rand() * 2)) % COLORS.length], x: r1(cx - w / 2), y: r1(cy - (w * H) / 2), w: r1(w), angle: r1((th * 180) / Math.PI + 90 + (rand() - 0.5) * 30), seed: i + seed });
  }
  return out.reverse();
}

export function drift(points, seed = 11, w = 16) {
  const rand = rng(seed);
  return points.map(([x, y], i) => ({ species: SPECIES[(i * 3 + seed) % SPECIES.length], color: COLORS[(i * 3 + seed) % COLORS.length], x, y, w: r1(w * (0.8 + rand() * 0.5)), angle: r1((rand() - 0.5) * 140), seed: seed + i }));
}

export function tree(n = 40, seed = 5) {
  const rand = rng(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const rr = Math.sqrt(t);
    const th = i * 2.399963;
    const cx = 50 + 38 * rr * Math.cos(th), cy = 34 + 26 * rr * Math.sin(th);
    const w = 12 + rand() * 5;
    out.push({ species: SPECIES[(i * 7 + 2) % SPECIES.length], color: COLORS[(i * 3 + Math.floor(rand() * 2)) % COLORS.length], x: r1(cx - w / 2), y: r1(cy - (w * H * 5) / 6 / 2), w: r1(w), angle: r1(((cx - 50) / 38) * 50 + (rand() - 0.5) * 30), seed: i + 40 });
  }
  return out.sort((a, b) => a.y - b.y);
}

export function trunk(fill) {
  return `<svg viewBox="0 0 100 120" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M46 120 C47 100 47 84 45 70 C41 62 33 56 24 50 C34 53 42 58 47 64 C48 54 47 46 44 38 C49 45 51 53 51 62 C55 55 62 50 72 46 C64 52 57 59 54 68 C52 84 53 102 55 120 Z" fill="${fill}"/></svg>`;
}

export function ground(n = 14, seed = 9) {
  const rand = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    const w = 5.2 + rand() * 2.4;
    return { species: SPECIES[(i * 3 + 1) % SPECIES.length], color: COLORS[(i * 5 + 2) % COLORS.length], x: r1((i + 0.15 + rand() * 0.5) * (100 / n) - w / 2 + 2), y: r1(10 + rand() * 30), w: r1(w), angle: r1((i % 2 ? 1 : -1) * (70 + rand() * 40)), seed: seed + i };
  });
}

export function sheet(fill, holes, { width = 400, height = 520, id = 'cut-holes' } = {}) {
  const parts = holes.map(({ species, seed, x, y, w, angle }) => {
    const s = (w / 120) * width / 100;
    return `<path transform="translate(${r1((x / 100) * width)} ${r1((y / 100) * height)}) scale(${r1(s * 100) / 100}) rotate(${angle} 0 -50)" d="${leafPath(species, seed).d}"/>`;
  });
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="一张剪去了叶子形状的色纸，留下一个个叶形的窗"><defs><mask id="${id}"><rect width="${width}" height="${height}" fill="#fff"/><g fill="#000">${parts.join('')}</g></mask></defs><rect width="${width}" height="${height}" fill="${fill}" mask="url(#${id})"/></svg>`;
}

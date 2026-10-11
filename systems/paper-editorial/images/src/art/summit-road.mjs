/*
 * images/summit-road.svg (1600x900): a contour map of Kestrel Ridge with the 38 km mountain road winding up to the dome.
 * The terrain is a height field (a main summit, two spurs, a valley with a stream, layered noise); contours are real marching-squares isolines every 40 m (index contours every 200 m, thicker and labelled
 * in italic numerals; the summit is 2860 m as in the setting), smoothed and drawn in ink. Hill shading is stipple on the slopes facing away from the light (upper left).
 * The road is a double line that spirals up from the town (鹿溪镇) to the summit; kilometre ticks every 5 km are measured along the real polyline length so the total reads 38 km.
 * Vermilion marks only the end of the route: the dome symbol and its name. Map furniture: neatline with border ticks, north arrow.
 * summitRoad(P) -> SVG document string. Deterministic; labels are outlined glyph paths.
 */
import { f, fbm2, rng, smoothPath, smoothstep } from '../lib/random.mjs';
import { dotsPath } from '../lib/dots.mjs';
import { textPath, textMixed, measure } from '../lib/glyphs.mjs';
import { svgFile } from '../lib/svgdoc.mjs';

const W = 1600;
const H = 900;
const X0 = 52;
const Y0 = 52;
const X1 = 1548;
const Y1 = 848;
const MASSIF = [690, 400];
const TOWN = [1150, 800];
const STEP = 6;

const gauss = (x, y, cx, cy, sx, sy, a = 1) => a * Math.exp(-(((x - 110 - cx) / sx) ** 2 + ((y - cy) / sy) ** 2));

function height(x, y) {
  let h = gauss(x, y, MASSIF[0], MASSIF[1], 330, 250, 1.0);
  h += gauss(x, y, 330, 620, 230, 160, 0.42) + gauss(x, y, 1130, 230, 260, 150, 0.46) + gauss(x, y, 520, 150, 200, 120, 0.3);
  h += gauss(x, y, 960, 520, 160, 190, 0.24);
  h -= gauss(x, y, 1250, 560, 150, 260, 0.2);
  h += (fbm2(x / 180, y / 180, 12, 4) - 0.5) * 0.26 + (fbm2(x / 60, y / 60, 3, 3) - 0.5) * 0.04;
  h -= (y - 400) * 0.00006 * (x / 1600);
  return h;
}

const nx = Math.floor((X1 - X0) / STEP);
const ny = Math.floor((Y1 - Y0) / STEP);
const grid = [];
let hMin = Infinity;
let hMax = -Infinity;
for (let j = 0; j <= ny; j += 1) {
  const row = [];
  for (let i = 0; i <= nx; i += 1) {
    const v = height(X0 + i * STEP, Y0 + j * STEP);
    row.push(v);
    hMin = Math.min(hMin, v);
    hMax = Math.max(hMax, v);
  }
  grid.push(row);
}
const norm = (v) => (v - hMin) / (hMax - hMin);
const PEAK = (() => {
  let best = [0, 0, -Infinity];
  grid.forEach((row, j) => row.forEach((v, i) => { if (v > best[2]) best = [X0 + i * STEP, Y0 + j * STEP, v]; }));
  return [best[0], best[1]];
})();
const ELEV = (u) => 1180 + u * 1680;

function contourAt(level) {
  const segs = new Map();
  const link = (a, b) => {
    if (!segs.has(a.id)) segs.set(a.id, []);
    if (!segs.has(b.id)) segs.set(b.id, []);
    segs.get(a.id).push(b);
    segs.get(b.id).push(a);
  };
  const edgePoint = (i, j, horizontal) => {
    const a = norm(grid[j][i]);
    const b = horizontal ? norm(grid[j][i + 1]) : norm(grid[j + 1][i]);
    const t = (level - a) / (b - a);
    return horizontal
      ? { id: `h${i}:${j}`, p: [X0 + (i + t) * STEP, Y0 + j * STEP] }
      : { id: `v${i}:${j}`, p: [X0 + i * STEP, Y0 + (j + t) * STEP] };
  };
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const v = [norm(grid[j][i]), norm(grid[j][i + 1]), norm(grid[j + 1][i + 1]), norm(grid[j + 1][i])];
      const code = (v[0] > level ? 1 : 0) | (v[1] > level ? 2 : 0) | (v[2] > level ? 4 : 0) | (v[3] > level ? 8 : 0);
      if (code === 0 || code === 15) continue;
      const top = () => edgePoint(i, j, true);
      const bottom = () => edgePoint(i, j + 1, true);
      const left = () => edgePoint(i, j, false);
      const right = () => edgePoint(i + 1, j, false);
      const table = {
        1: [[left, top]], 2: [[top, right]], 3: [[left, right]], 4: [[right, bottom]], 5: [[left, top], [right, bottom]], 6: [[top, bottom]], 7: [[left, bottom]],
        8: [[left, bottom]], 9: [[top, bottom]], 10: [[top, right], [left, bottom]], 11: [[right, bottom]], 12: [[left, right]], 13: [[top, right]], 14: [[left, top]],
      };
      for (const [a, b] of table[code]) link(a(), b());
    }
  }
  const used = new Set();
  const lines = [];
  for (const [id, nbrs] of segs) {
    if (used.has(id) || nbrs.length !== 1) continue;
    lines.push(walk(id, segs, used));
  }
  for (const [id] of segs) if (!used.has(id)) lines.push(walk(id, segs, used));
  return lines;
}

function walk(startId, segs, used) {
  const pts = [];
  let prev = null;
  let cur = startId;
  const pointOf = new Map();
  for (const [id, nbrs] of segs) for (const n of nbrs) pointOf.set(n.id, n.p);
  while (cur && !used.has(cur)) {
    used.add(cur);
    pts.push(pointOf.get(cur));
    const next = (segs.get(cur) ?? []).find((n) => n.id !== prev && !used.has(n.id));
    prev = cur;
    cur = next ? next.id : null;
  }
  return pts;
}

function simplify(pts, every = 2) {
  const out = pts.filter((_, i) => i % every === 0);
  if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]);
  return out;
}

function gradient(x, y) {
  const e = 3;
  return [(height(x + e, y) - height(x - e, y)) / (2 * e), (height(x, y + e) - height(x, y - e)) / (2 * e)];
}

function road(grade = 0.075, run = 430, first = -1) {
  const pts = [[TOWN[0], TOWN[1]]];
  let [x, y] = TOWN;
  let sign = first;
  let phi = sign > 0 ? Math.atan(grade) : Math.PI - Math.atan(grade);
  let travelled = 0;
  let turning = 0;
  let target = phi;
  const step = 3;
  for (let i = 0; i < 6000; i += 1) {
    const [gx, gy] = gradient(x, y);
    const gl = Math.hypot(gx, gy) + 1e-9;
    const ux = gx / gl;
    const uy = gy / gl;
    const tx = -uy;
    const ty = ux;
    if (turning === 0) {
      const ahead = [x + (Math.cos(phi) * tx + Math.sin(phi) * ux) * 60, y + (Math.cos(phi) * ty + Math.sin(phi) * uy) * 60];
      const outside = ahead[0] < X0 + 40 || ahead[0] > X1 - 40 || ahead[1] < Y0 + 40 || ahead[1] > Y1 - 40;
      if (travelled > run || outside) {
        turning = 16;
        sign = -sign;
        target = sign > 0 ? Math.atan(grade) : Math.PI - Math.atan(grade);
        travelled = 0;
      }
    }
    if (turning > 0) {
      phi += (target - phi) / turning;
      turning -= 1;
    } else {
      phi = target;
    }
    const dx = Math.cos(phi) * tx + Math.sin(phi) * ux;
    const dy = Math.cos(phi) * ty + Math.sin(phi) * uy;
    x += dx * step;
    y += dy * step;
    travelled += step;
    pts.push([x, y]);
    if (Math.hypot(x - PEAK[0], y - PEAK[1]) < 34 || norm(height(x, y)) > 0.985) break;
  }
  pts.push([PEAK[0], PEAK[1]]);
  return pts;
}

function along(pts, dist) {
  let acc = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + seg >= dist) {
      const t = (dist - acc) / seg;
      return { p: [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t], a: Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]) };
    }
    acc += seg;
  }
  return { p: pts[pts.length - 1], a: 0 };
}

const pathLength = (pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);

function numeral(str, size, x, y, P, anchor = 'middle', fill) {
  return textPath(str, { font: 'latin400i', size, x, y, anchor, fill: fill ?? P['ink-2'] }).svg;
}

export function summitRoad(P) {
  const rand = rng(33);
  let body = `<clipPath id="map"><rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}"/></clipPath><g clip-path="url(#map)">`;
  body += `<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${P.paper}"/>`;

  const shade = [];
  for (let tries = 0; shade.length < 9000 && tries < 200000; tries += 1) {
    const x = X0 + rand() * (X1 - X0);
    const y = Y0 + rand() * (Y1 - Y0);
    const [gx, gy] = gradient(x, y);
    const slope = Math.hypot(gx, gy) * (hMax - hMin);
    const facing = -(gx + gy) / Math.SQRT2 / (Math.hypot(gx, gy) + 1e-9);
    const dark = smoothstep(-0.1, 0.9, -facing) * smoothstep(0.0006, 0.004, Math.hypot(gx, gy));
    if (rand() > dark * 0.9 || slope < 0) continue;
    shade.push([x, y, 0.8 + rand() * 0.9]);
  }
  body += dotsPath(shade, { color: P['ink-2'], opacity: 0.8 });

  const INTERVAL = 40 / 1680;
  const index = [];
  for (let k = Math.ceil(0 / INTERVAL) + 1; k * INTERVAL < 0.995; k += 1) {
    const level = k * INTERVAL;
    const isIndex = Math.round(ELEV(level)) % 200 === 0 || k % 5 === 0;
    for (const raw of contourAt(level)) {
      if (raw.length < 6) continue;
      const pts = simplify(raw, 2);
      const closed = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < STEP * 1.5;
      const d = smoothPath(pts, false);
      body += `<path d="${d}${closed ? 'Z' : ''}" fill="none" stroke="${P.ink}" stroke-width="${isIndex ? 1.7 : 0.8}" stroke-linejoin="round" opacity="${isIndex ? 1 : 0.8}"/>`;
      if (isIndex && pts.length > 40) index.push({ pts, elev: Math.round(ELEV(level) / 20) * 20, level });
    }
  }

  const labelled = new Set();
  index
    .sort((a, b) => b.pts.length - a.pts.length)
    .forEach((c, i) => {
      if (i > 14 || labelled.has(c.elev)) return;
      labelled.add(c.elev);
      const k = Math.floor(c.pts.length * (0.3 + 0.35 * rand()));
      const a = c.pts[k];
      const b = c.pts[Math.min(k + 3, c.pts.length - 1)];
      let ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
      if (ang > 90) ang -= 180;
      if (ang < -90) ang += 180;
      const w = measure(String(c.elev), 'latin400i', 17) + 10;
      body += `<g transform="translate(${f(a[0])} ${f(a[1])}) rotate(${f(ang)})"><rect x="${f(-w / 2)}" y="-10" width="${f(w)}" height="18" fill="${P.paper}"/>${numeral(String(c.elev), 17, 0, 5, P, 'middle', P['ink-2'])}</g>`;
    });

  const rd = road();
  const rdPath = smoothPath(rd.filter((_, i) => i % 2 === 0));
  body += `<path d="${rdPath}" fill="none" stroke="${P.paper}" stroke-width="13" stroke-linejoin="round" stroke-linecap="round"/>`;
  body += `<path d="${rdPath}" fill="none" stroke="${P.ink}" stroke-width="6.4" stroke-linejoin="round" stroke-linecap="round"/><path d="${rdPath}" fill="none" stroke="${P.paper}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>`;

  const total = pathLength(rd);
  for (let km = 5; km < 38; km += 5) {
    const { p, a } = along(rd, (km / 38) * total);
    const nxv = -Math.sin(a);
    const nyv = Math.cos(a);
    body += `<path d="M${f(p[0] - nxv * 10)} ${f(p[1] - nyv * 10)}L${f(p[0] + nxv * 10)} ${f(p[1] + nyv * 10)}" stroke="${P.ink}" stroke-width="1.8"/>`;
    const side = nxv > 0 ? 1 : -1;
    body += textPath(String(km), { font: 'latin400', size: 21, x: p[0] + nxv * side * 26, y: p[1] + nyv * side * 26 + 7, anchor: 'middle', fill: P.ink, halo: { color: P.paper, width: 6 } }).svg;
  }

  const dx = PEAK[0];
  const dy = PEAK[1];
  body += `<circle cx="${dx}" cy="${dy}" r="34" fill="${P.paper}"/>`;
  body += `<path d="M${dx - 22} ${dy + 12}A22 22 0 0 1 ${dx + 22} ${dy + 12}Z" fill="${P.zhu}"/><path d="M${dx - 3} ${dy - 10}V${dy + 12}" stroke="${P.paper}" stroke-width="5"/><path d="M${dx - 26} ${dy + 12}H${dx + 26}" stroke="${P.zhu}" stroke-width="3"/>`;
  body += `<circle cx="${dx}" cy="${dy - 2}" r="38" fill="none" stroke="${P.zhu}" stroke-width="1.6"/>`;
  body += textPath('鹞岭天文台', { font: 'kai', size: 27, x: dx + 52, y: dy - 18, fill: P.zhu, halo: { color: P.paper, width: 7 } }).svg;
  body += textPath('2860 m', { font: 'latin400i', size: 22, x: dx + 52, y: dy + 14, fill: P.ink, halo: { color: P.paper, width: 7 } }).svg;

  const tx = TOWN[0];
  const ty = TOWN[1];
  body += `<circle cx="${tx}" cy="${ty}" r="22" fill="${P.paper}" stroke="${P.ink}" stroke-width="1.6"/>`;
  for (const [ox, oy] of [[-8, -6], [3, -9], [7, 1], [-4, 6], [8, 8]]) body += `<rect x="${tx + ox - 3}" y="${ty + oy - 3}" width="6" height="6" fill="${P.ink}"/>`;
  body += textPath('鹿溪镇', { font: 'kai', size: 27, x: tx + 34, y: ty + 9, fill: P.ink, halo: { color: P.paper, width: 7 } }).svg;
  body += textMixed('起点 0 km', { size: 20, x: tx + 34, y: ty + 36, fill: P['ink-2'], halo: { color: P.paper, width: 6 } }).svg;

  body += textPath('38 km', { font: 'latin400i', size: 22, x: dx - 52, y: dy + 58, anchor: 'end', fill: P.ink, halo: { color: P.paper, width: 7 } }).svg;

  body += '</g>';

  body += `<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="none" stroke="${P.ink}" stroke-width="2"/>`;
  let ticks = '';
  for (let x = X0 + 100; x < X1; x += 100) ticks += `M${x} 30V${Y0}M${x} ${Y1}V870`;
  for (let y = Y0 + 100; y < Y1; y += 100) ticks += `M30 ${y}H${X0}M${X1} ${y}H1570`;
  body += `<path d="${ticks}" stroke="${P['ink-3']}" stroke-width="1.2"/>`;

  const nxp = 1478;
  const nyp = 134;
  body += `<g><path d="M${nxp} ${nyp + 46}V${nyp - 30}" stroke="${P.ink}" stroke-width="1.6"/><path d="M${nxp} ${nyp - 44}L${nxp + 9} ${nyp - 20}H${nxp - 9}Z" fill="${P.ink}"/>${textPath('北', { font: 'song600', size: 26, x: nxp, y: nyp + 78, anchor: 'middle', fill: P.ink }).svg}</g>`;
  body += `<g>${textPath('等高距　四十米', { font: 'song400', size: 20, x: X0 + 22, y: Y1 - 22, fill: P['ink-2'], track: 0.08 }).svg}</g>`;

  return svgFile({ w: W, h: H, title: '盘山路的尽头，山顶的圆顶', body, P, plate: false });
}

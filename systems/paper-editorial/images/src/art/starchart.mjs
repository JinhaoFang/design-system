/*
 * Northern-sky star chart (circular dial) with real catalogue coordinates, ported from the direction prototype and extended.
 * starChart({size, P, idPrefix, labels, seed, dense}) -> inline <svg> string, square viewBox 0..size, centred on the celestial pole.
 *   Projection: azimuthal equidistant about the pole, right ascension counter-clockwise (as the sky is seen looking up), declination 90 to MIN_DEC.
 *   Stars: bright stars from STARS (RA hours, Dec degrees, magnitude, Chinese name), faint field stars sampled with a density that follows the galactic plane (real galactic latitude from RA/Dec), so the Milky Way shows as a stipple band.
 *   Dial: double ring, 144 ticks, a ring of the 24 mountain directions (twelve branches, ten stems and four trigram directions, all outlined with the kai font), hour numerals, declination circles.
 *   Colour: ink and ink-2 only; the single zhu mark is the circle around M31 (Andromeda galaxy) with its label, as the system allows one or two zhu spots per picture.
 * m31Position(size) returns the pixel position of M31 for callers that want to point at it. Text is outlined (glyphs.mjs), so the drawing needs no fonts.
 */
import { f, fbm2, rng, smoothstep } from '../lib/random.mjs';
import { textPath } from '../lib/glyphs.mjs';

export const MIN_DEC = 28;

const STARS = {
  polaris: [2.53, 89.26, 2.0, '勾陈一'], yildun: [17.54, 86.59, 4.4], epsUMi: [16.77, 82.04, 4.2], zetaUMi: [15.73, 77.79, 4.3],
  kochab: [14.85, 74.16, 2.1, '北极二'], pherkad: [15.35, 71.83, 3.0], etaUMi: [16.29, 75.76, 5.0],
  dubhe: [11.06, 61.75, 1.8, '天枢'], merak: [11.03, 56.38, 2.4, '天璇'], phecda: [11.9, 53.69, 2.4], megrez: [12.26, 57.03, 3.3],
  alioth: [12.9, 55.96, 1.8, '玉衡'], mizar: [13.4, 54.93, 2.2], alkaid: [13.79, 49.31, 1.9, '摇光'],
  caph: [0.15, 59.15, 2.3], schedar: [0.68, 56.54, 2.2, '王良四'], gcas: [0.95, 60.72, 2.2], ruchbah: [1.43, 60.24, 2.7], segin: [1.91, 63.67, 3.4],
  deneb: [20.69, 45.28, 1.25, '天津四'], delta_cyg: [19.75, 45.13, 2.9], sadr: [20.37, 40.26, 2.2], gienah: [20.77, 33.97, 2.5],
  capella: [5.28, 46.0, 0.1, '五车二'], menkalinan: [6.0, 44.95, 1.9], theta_aur: [5.99, 37.21, 2.6], elnath: [5.44, 28.61, 1.7], iota_aur: [4.95, 33.17, 2.7],
  vega: [18.62, 38.78, 0.0, '织女一'],
  alderamin: [21.31, 62.59, 2.5], errai: [23.66, 77.63, 3.2], alfirk: [21.48, 70.56, 3.2], zcep: [22.18, 58.2, 3.4],
  eltanin: [17.94, 51.49, 2.2], rastaban: [17.51, 52.3, 2.8], thuban: [14.07, 64.38, 3.7], edra: [19.21, 67.66, 3.1], aldhibah: [17.15, 65.71, 3.2],
  mirfak: [3.41, 49.86, 1.8, '天船三'], algol: [3.14, 40.96, 2.1, '大陵五'],
  alpheratz: [0.14, 29.09, 2.1], mirach: [1.16, 35.62, 2.1], almach: [2.06, 42.33, 2.1], mu_and: [0.94, 38.5, 3.9], nu_and: [0.83, 41.08, 4.5],
  castor: [7.58, 31.89, 1.6], pollux: [7.76, 28.03, 1.1],
};

const LINES_INK = [
  ['polaris', 'yildun'], ['yildun', 'epsUMi'], ['epsUMi', 'zetaUMi'], ['zetaUMi', 'kochab'], ['kochab', 'pherkad'], ['pherkad', 'etaUMi'], ['etaUMi', 'zetaUMi'],
  ['caph', 'schedar'], ['schedar', 'gcas'], ['gcas', 'ruchbah'], ['ruchbah', 'segin'],
  ['alderamin', 'alfirk'], ['alfirk', 'errai'], ['errai', 'zcep'], ['zcep', 'alderamin'],
  ['eltanin', 'rastaban'], ['rastaban', 'aldhibah'], ['aldhibah', 'edra'], ['edra', 'thuban'],
  ['deneb', 'sadr'], ['sadr', 'gienah'], ['delta_cyg', 'sadr'],
  ['capella', 'menkalinan'], ['menkalinan', 'theta_aur'], ['theta_aur', 'elnath'], ['elnath', 'iota_aur'], ['iota_aur', 'capella'],
  ['alpheratz', 'mirach'], ['mirach', 'almach'], ['mirach', 'mu_and'], ['mu_and', 'nu_and'], ['mirfak', 'algol'],
];

const DIPPER = [['dubhe', 'merak'], ['merak', 'phecda'], ['phecda', 'megrez'], ['megrez', 'dubhe'], ['megrez', 'alioth'], ['alioth', 'mizar'], ['mizar', 'alkaid']];

const MOUNTAINS = ['子', '癸', '丑', '艮', '寅', '甲', '卯', '乙', '辰', '巽', '巳', '丙', '午', '丁', '未', '坤', '申', '庚', '酉', '辛', '戌', '乾', '亥', '壬'];
const BRANCHES = new Set(['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']);

const M31 = [0.712, 41.27];
const GP_RA = (12.857 / 24) * Math.PI * 2;
const GP_DEC = (27.128 * Math.PI) / 180;

const galacticSin = (raHours, decDeg) => {
  const ra = (raHours / 24) * Math.PI * 2;
  const dec = (decDeg * Math.PI) / 180;
  return Math.sin(dec) * Math.sin(GP_DEC) + Math.cos(dec) * Math.cos(GP_DEC) * Math.cos(ra - GP_RA);
};

const projector = (size) => {
  const c = size / 2;
  const R = size * 0.385;
  const pos = (raHours, dec) => {
    const r = ((90 - dec) / (90 - MIN_DEC)) * R;
    const a = (raHours / 24) * Math.PI * 2;
    return [c - r * Math.sin(a), c - r * Math.cos(a)];
  };
  return { c, R, pos };
};

export const m31Position = (size) => projector(size).pos(M31[0], M31[1]);

export function starChart({ size = 1000, P, idPrefix = 'sc', labels = true, seed = 11, dense = false }) {
  const { c, R, pos } = projector(size);
  const rand = rng(seed);
  const s = size / 1000;
  let out = `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="北天星图，朱圈标出仙女星系">`;
  out += `<defs><clipPath id="${idPrefix}-clip"><circle cx="${c}" cy="${c}" r="${R}"/></clipPath></defs>`;

  out += `<circle cx="${c}" cy="${c}" r="${f(R + 70 * s)}" fill="none" stroke="${P.rule}" stroke-width="${f(1 * s)}"/>`;
  out += `<circle cx="${c}" cy="${c}" r="${f(R + 62 * s)}" fill="none" stroke="${P.ink}" stroke-width="${f(3 * s)}"/>`;
  out += `<circle cx="${c}" cy="${c}" r="${f(R + 40 * s)}" fill="none" stroke="${P.ink}" stroke-width="${f(1 * s)}"/>`;
  out += `<circle cx="${c}" cy="${c}" r="${f(R + 28 * s)}" fill="none" stroke="${P.ink}" stroke-width="${f(1 * s)}"/>`;
  for (let m = 0; m < 144; m += 1) {
    const a = (m / 144) * Math.PI * 2;
    const long = m % 6 === 0;
    const mid = m % 3 === 0;
    const r1 = R + 28 * s;
    const r2 = R + (long ? 40 : mid ? 36 : 33) * s;
    out += `<line x1="${f(c + r1 * Math.sin(a))}" y1="${f(c - r1 * Math.cos(a))}" x2="${f(c + r2 * Math.sin(a))}" y2="${f(c - r2 * Math.cos(a))}" stroke="${P.ink}" stroke-width="${f((long ? 1.4 : 0.8) * s)}"/>`;
  }
  out += `<circle cx="${c}" cy="${c}" r="${f(R + 8 * s)}" fill="${P['paper-deep']}"/>`;
  out += `<circle cx="${c}" cy="${c}" r="${f(R + 8 * s)}" fill="none" stroke="${P.ink}" stroke-width="${f(1.2 * s)}"/>`;

  MOUNTAINS.forEach((ch, k) => {
    const a = (k / 24) * Math.PI * 2;
    const r = R + 55 * s;
    const size1 = (BRANCHES.has(ch) ? 21 : 15.5) * s;
    const t = textPath(ch, { font: 'kai', size: size1, x: c + r * Math.sin(a), y: c - r * Math.cos(a) + size1 * 0.36, anchor: 'middle', fill: BRANCHES.has(ch) ? P.ink : P['ink-2'] });
    out += t.svg;
  });

  out += '<g>';
  for (let h = 0; h < 24; h += 2) {
    const a = (h / 24) * Math.PI * 2;
    const r = R - 16 * s;
    const t = textPath(`${h}h`, { font: 'latin400', size: 13 * s, x: c - r * Math.sin(a), y: c - r * Math.cos(a) + 4.5 * s, anchor: 'middle', fill: P['ink-3'] });
    out += t.svg;
  }
  out += '</g>';

  out += `<g clip-path="url(#${idPrefix}-clip)">`;
  for (const dec of [80, 70, 60, 50, 40, 30]) {
    const r = ((90 - dec) / (90 - MIN_DEC)) * R;
    out += `<circle cx="${c}" cy="${c}" r="${f(r)}" fill="none" stroke="${P.rule}" stroke-width="${f(0.9 * s)}" stroke-dasharray="${f(2 * s)} ${f(6 * s)}"/>`;
  }
  for (let h = 0; h < 24; h += 1) {
    const [x1, y1] = pos(h, 85);
    const [x2, y2] = pos(h, MIN_DEC);
    out += `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${P['rule-light']}" stroke-width="${f((h % 6 === 0 ? 1.1 : 0.7) * s)}"/>`;
  }

  const field = dense ? 7200 : 5600;
  let dots = '';
  let faint = '';
  let count = 0;
  while (count < field) {
    const r = R * Math.sqrt(rand());
    const a = rand() * Math.PI * 2;
    const dec = 90 - (r / R) * (90 - MIN_DEC);
    const ra = (a / (Math.PI * 2)) * 24;
    const sb = Math.abs(galacticSin(ra, dec));
    const band = Math.exp(-Math.pow(sb / 0.15, 2));
    const cloud = fbm2(Math.sin(a) * 4 + 9, Math.cos(a) * 4 + r / 90, seed, 3);
    const keep = 0.2 + 0.8 * band * smoothstep(0.28, 0.62, cloud);
    if (rand() > keep) continue;
    count += 1;
    const m = Math.pow(rand(), 3.6);
    const rr = (0.5 + m * 1.5) * s;
    const piece = `<circle cx="${f(c - r * Math.sin(a))}" cy="${f(c - r * Math.cos(a))}" r="${f(rr)}"/>`;
    if (m > 0.3) dots += piece;
    else faint += piece;
  }
  out += `<g fill="${P.ink}" opacity="0.92">${dots}</g><g fill="${P['ink-2']}" opacity="0.7">${faint}</g>`;

  const P2 = Object.fromEntries(Object.entries(STARS).map(([k, v]) => [k, pos(v[0], v[1])]));
  for (const [a, b] of LINES_INK) out += `<line x1="${f(P2[a][0])}" y1="${f(P2[a][1])}" x2="${f(P2[b][0])}" y2="${f(P2[b][1])}" stroke="${P['ink-2']}" stroke-width="${f(1.2 * s)}"/>`;
  for (const [a, b] of DIPPER) out += `<line x1="${f(P2[a][0])}" y1="${f(P2[a][1])}" x2="${f(P2[b][0])}" y2="${f(P2[b][1])}" stroke="${P.ink}" stroke-width="${f(2 * s)}"/>`;
  const [px, py] = P2.polaris;
  const [mx, my] = P2.merak;
  const [dx, dy] = P2.dubhe;
  out += `<line x1="${f(mx)}" y1="${f(my)}" x2="${f(px + (px - dx) * 0.05)}" y2="${f(py + (py - dy) * 0.05)}" stroke="${P['ink-2']}" stroke-width="${f(1 * s)}" stroke-dasharray="${f(3 * s)} ${f(5 * s)}"/>`;

  for (const [k, v] of Object.entries(STARS)) {
    const [x, y] = P2[k];
    const r = (1.7 + Math.max(0, 4.6 - v[2]) * 1.05) * s;
    out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${P.ink}"/>`;
    if (v[2] < 2.0) out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 1.9)}" fill="none" stroke="${P.ink}" stroke-width="${f(0.8 * s)}"/>`;
    if (k === 'polaris') out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 3.2)}" fill="none" stroke="${P.ink}" stroke-width="${f(0.8 * s)}"/>`;
    if (labels && v[3]) {
      const t = textPath(v[3], { font: 'kai', size: 17 * s, x: x + r + 7 * s, y: y - r - 2 * s, fill: P['ink-2'] });
      out += t.svg;
    }
  }

  const [x, y] = pos(M31[0], M31[1]);
  out += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(22 * s)}" ry="${f(7.5 * s)}" transform="rotate(-38 ${f(x)} ${f(y)})" fill="${P.zhu}"/>`;
  out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(40 * s)}" fill="none" stroke="${P.zhu}" stroke-width="${f(2 * s)}"/>`;
  out += '</g>';
  if (labels) out += textPath('仙女星系', { font: 'kai', size: 25 * s, x: x + 52 * s, y: y + 38 * s, fill: P.zhu }).svg;
  out += '</svg>';
  return out;
}

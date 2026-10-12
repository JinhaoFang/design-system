/*
 * images/dome-night.svg (1600x900): the observatory dome at night, the slit open, the Milky Way crossing above the ridge. No people.
 * Layers back to front: stippled sky (dot density follows a Milky Way band with dark rifts, a few cross-ticked bright stars), three far ridges drawn as contour-style stacks of repeated
 * profile lines, the dome in elevation (graticule ribs, shell shading by stipple, the slit as a notch through the crown, the telescope tube hatched inside it, a reception hall beside it),
 * and the foreground ridge that carries the dome pad. Colour is ink only; the single vermilion marks are the circled Andromeda galaxy and a tiny red-lit window.
 * domeNight(P) -> SVG document string (palette P from lib/palette.mjs). Deterministic; text is outlined glyph paths.
 */
import { f, fbm2, noise2, rng, smoothstep, smoothPath } from '../lib/random.mjs';
import { dotsPath, starCross } from '../lib/dots.mjs';
import { textPath } from '../lib/glyphs.mjs';
import { svgFile } from '../lib/svgdoc.mjs';

const W = 1600;
const H = 900;
const CX = 1000;
const WALL_TOP = 622;
const PAD = 662;
const R = 246;
const SLIT = 60;
const SLX = CX - 8;

const bandY = (x) => 650 - 0.21 * x;

function sky(P) {
  const rand = rng(21);
  const pts = [];
  const bright = [];
  for (let tries = 0; pts.length < 30000 && tries < 1200000; tries += 1) {
    const x = 52 + rand() * 1496;
    const y = 52 + rand() * 700;
    const across = (y - bandY(x)) / (1 + 0.0003 * x);
    const core = Math.exp(-Math.pow(across / 92, 2));
    const halo = Math.exp(-Math.pow(across / 210, 2));
    const cloud = smoothstep(0.3, 0.62, fbm2(x / 80, y / 80, 5, 4));
    const rift = 1 - 0.85 * smoothstep(0.52, 0.72, fbm2(x / 38 + 40, y / 95, 9, 3)) * core;
    const p = (0.02 + 0.14 * halo * (0.4 + 0.6 * cloud) + 1.0 * core * (0.5 + 0.5 * cloud)) * rift;
    if (rand() > p) continue;
    const m = Math.pow(rand(), 4.5);
    pts.push([x, y, 0.75 + m * 1.7]);
  }
  for (let i = 0; i < 16; i += 1) bright.push([90 + rand() * 1400, 80 + rand() * 480, 5 + rand() * 6]);
  const crosses = bright.map(([x, y, s]) => starCross(x, y, s, P.ink)).join('');
  return `<g>${dotsPath(pts, { color: P.ink })}${crosses}</g>`;
}

const ridgeFor = (seed, base, amp, scale, tilt = 0) => (x) => base + tilt * (x - 800) + (fbm2(x / scale, seed, seed, 4) - 0.5) * 2 * amp;

const nearRidge = (x) => {
  const u = Math.max(0, Math.abs(x - 1090) - 400);
  return PAD + 138 * (1 - Math.exp(-u / 330)) + (fbm2(x / 90, 31, 31, 3) - 0.5) * 26 * smoothstep(0, 220, u);
};

function contourLayer({ profile, fill, stroke, width, lines, gap, wobble, seed, ticks = false, P }) {
  const xs = [];
  for (let x = 40; x <= 1560; x += 10) xs.push(x);
  const line = (dy, amp, s) => smoothPath(xs.map((x) => [x, profile(x) + dy + (noise2(x / 120, dy / 20, s) - 0.5) * amp]));
  let out = `<path d="${line(0, 0, seed)}L1560 870L40 870Z" fill="${fill}"/>`;
  out += `<path d="${line(0, 0, seed)}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"/>`;
  for (let j = 1; j <= lines; j += 1) {
    const dy = j * gap * (1 + j * 0.02);
    out += `<path d="${line(dy, wobble * j, seed + j)}" fill="none" stroke="${stroke}" stroke-width="${f(width * 0.5)}" opacity="${f(Math.max(0.28, 0.85 - j * 0.045))}"/>`;
  }
  if (ticks) {
    const rand = rng(seed + 100);
    let d = '';
    for (let i = 0; i < 70; i += 1) {
      const x = 60 + rand() * 1480;
      const y = profile(x) + 2 + rand() * 14;
      const h = 8 + rand() * 10;
      d += `M${f(x)} ${f(y)}l${f(-2.6)} ${f(h)}M${f(x)} ${f(y)}l${f(2.6)} ${f(h)}M${f(x)} ${f(y)}v${f(h)}`;
    }
    out += `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="0.9" stroke-linecap="round"/>`;
  }
  return out;
}

function dome(P) {
  const rand = rng(77);
  const sh = (x) => WALL_TOP - Math.sqrt(R * R - (x - CX) * (x - CX));
  const xl = SLX - SLIT;
  const xr = SLX + SLIT;
  let out = '';

  const shellL = `M${CX - R} ${WALL_TOP}A${R} ${R} 0 0 1 ${xl} ${f(sh(xl))}V${WALL_TOP}Z`;
  const shellR = `M${xr} ${f(sh(xr))}A${R} ${R} 0 0 1 ${CX + R} ${WALL_TOP}H${xr}Z`;

  const tube = (() => {
    const bx = SLX - 10;
    const by = WALL_TOP + 4;
    let t = `<g transform="translate(${bx} ${by}) rotate(9) scale(1.3)">`;
    t += `<rect x="-26" y="-182" width="52" height="190" fill="${P.paper}"/>`;
    for (let i = -24; i <= 24; i += 3) {
      const dark = (i + 24) / 48;
      t += `<line x1="${i}" y1="-182" x2="${i}" y2="8" stroke="${P.ink}" stroke-width="${f(0.5 + dark * 1.1)}" opacity="${f(0.35 + dark * 0.65)}"/>`;
    }
    t += `<rect x="-26" y="-182" width="52" height="190" fill="none" stroke="${P.ink}" stroke-width="2.2"/>`;
    t += `<path d="M-26 -150H26M-26 -146H26M-26 -60H26M-26 -56H26" stroke="${P.ink}" stroke-width="1.4"/>`;
    t += `<ellipse cx="0" cy="-182" rx="26" ry="8" fill="${P.ink}"/><ellipse cx="0" cy="-182" rx="19" ry="5" fill="${P.paper}"/><ellipse cx="0" cy="-181" rx="12" ry="3" fill="${P.ink}"/>`;
    t += `<rect x="31" y="-128" width="9" height="86" fill="${P.paper}" stroke="${P.ink}" stroke-width="1.6"/><path d="M26 -118H31M26 -50H31" stroke="${P.ink}" stroke-width="1.4"/>`;
    t += '</g>';
    return t;
  })();

  out += `<clipPath id="gap"><rect x="${xl}" y="320" width="${SLIT * 2}" height="${WALL_TOP - 320}"/></clipPath>`;
  out += `<g clip-path="url(#gap)">${tube}</g>`;

  out += `<path d="${shellL}" fill="${P.paper}"/><path d="${shellR}" fill="${P.paper}"/>`;

  const ribs = [0.31, 0.59, 0.81, 0.95];
  let ribPath = '';
  for (const k of ribs) ribPath += `M${f(CX - R * k)} ${WALL_TOP}A${f(R * k)} ${R} 0 0 1 ${f(CX + R * k)} ${WALL_TOP}`;
  out += `<clipPath id="shells"><path d="${shellL}"/><path d="${shellR}"/></clipPath>`;
  out += `<g clip-path="url(#shells)" fill="none" stroke="${P.ink}" stroke-width="0.9"><path d="${ribPath}"/>`;
  for (const lat of [18, 36, 54, 70, 82]) {
    const a = (lat * Math.PI) / 180;
    const y = WALL_TOP - R * Math.sin(a);
    const hw = R * Math.cos(a);
    out += `<path d="M${f(CX - hw)} ${f(y)}Q${CX} ${f(y + 16 * Math.cos(a))} ${f(CX + hw)} ${f(y)}"/>`;
  }
  out += '</g>';

  let hatchA = '';
  let hatchB = '';
  for (let k = -R; k < R * 2; k += 7) hatchA += `M${CX + k} ${WALL_TOP + 20}L${CX + k + R} ${WALL_TOP - R - 20}`;
  for (let k = -R; k < R * 2; k += 6) hatchB += `M${CX + k} ${WALL_TOP - R - 20}L${CX + k + R} ${WALL_TOP + 20}`;
  out += `<clipPath id="shade1"><rect x="${CX + R * 0.18}" y="${WALL_TOP - R - 10}" width="${R}" height="${R + 10}"/></clipPath><clipPath id="shade2"><rect x="${CX + R * 0.58}" y="${WALL_TOP - R - 10}" width="${R}" height="${R + 10}"/></clipPath>`;
  out += `<g clip-path="url(#shells)"><g clip-path="url(#shade1)"><path d="${hatchA}" stroke="${P.ink}" stroke-width="0.7" opacity="0.7" fill="none"/></g><g clip-path="url(#shade2)"><path d="${hatchB}" stroke="${P.ink}" stroke-width="0.7" opacity="0.8" fill="none"/></g></g>`;

  out += `<g fill="none" stroke="${P.ink}" stroke-linejoin="round"><path d="M${CX - R} ${WALL_TOP}A${R} ${R} 0 0 1 ${xl} ${f(sh(xl))}V${WALL_TOP}" stroke-width="2.4"/><path d="M${xr} ${f(sh(xr))}A${R} ${R} 0 0 1 ${CX + R} ${WALL_TOP}" stroke-width="2.4"/><path d="M${xr} ${f(sh(xr))}V${WALL_TOP}" stroke-width="2.4"/>`;
  out += `<path d="M${xl + 7} ${f(sh(xl + 7) + 2)}V${WALL_TOP}M${xr - 7} ${f(sh(xr - 7) + 2)}V${WALL_TOP}" stroke-width="0.9"/></g>`;

  out += `<rect x="${CX - R - 6}" y="${WALL_TOP - 6}" width="${R * 2 + 12}" height="10" fill="${P.paper}" stroke="${P.ink}" stroke-width="2"/>`;
  out += `<rect x="${CX - R}" y="${WALL_TOP + 4}" width="${R * 2}" height="${PAD - WALL_TOP - 4}" fill="${P.paper}" stroke="${P.ink}" stroke-width="2"/>`;
  let wallHatch = '';
  for (let x = CX - R + 8; x < CX + R; x += 9) wallHatch += `M${x} ${WALL_TOP + 6}V${PAD - 2}`;
  out += `<path d="${wallHatch}" stroke="${P.ink}" stroke-width="0.6" opacity="0.55" fill="none"/>`;
  out += `<rect x="${CX - 128}" y="${WALL_TOP + 8}" width="26" height="26" fill="${P.paper}" stroke="${P.ink}" stroke-width="1.6"/>`;
  out += `<rect x="${CX + 96}" y="${WALL_TOP + 12}" width="12" height="9" fill="${P.zhu}"/>`;

  const hallX = CX + R + 70;
  out += `<path d="M${hallX} ${PAD}V${PAD - 52}H${hallX + 150}V${PAD}Z" fill="${P.paper}" stroke="${P.ink}" stroke-width="2"/>`;
  out += `<path d="M${hallX - 10} ${PAD - 52}L${hallX + 20} ${PAD - 78}H${hallX + 160}V${PAD - 52}Z" fill="${P.paper}" stroke="${P.ink}" stroke-width="2"/>`;
  let roof = '';
  for (let x = hallX + 4; x < hallX + 150; x += 7) roof += `M${x} ${PAD - 52}L${x + 6} ${PAD - 77}`;
  out += `<path d="${roof}" stroke="${P.ink}" stroke-width="0.6" fill="none"/>`;
  for (let i = 0; i < 5; i += 1) out += `<rect x="${hallX + 16 + i * 27}" y="${PAD - 38}" width="14" height="20" fill="${P.ink}"/>`;
  return out;
}


function road(P) {
  const pts = [[96, 876], [250, 826], [420, 790], [560, 752], [672, 716], [760, 684], [836, 664]];
  const d = smoothPath(pts);
  const total = pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0) * 1.01;
  const n = 18;
  const seg = total / n;
  const piece = (color, extra, i) => {
    const w = 34 - (i / (n - 1)) * 24 + extra;
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${f(w)}" stroke-dasharray="${f(seg + 1)} ${f(total * 2)}" stroke-dashoffset="${f(-seg * i + 0.5)}"/>`;
  };
  let out = '';
  for (let i = 0; i < n; i += 1) out += piece(P.ink, 4, i);
  for (let i = 0; i < n; i += 1) out += piece(P.paper, 0, i);
  out += `<path d="${d}" fill="none" stroke="${P.ink}" stroke-width="1" stroke-dasharray="14 12" opacity="0.7"/>`;
  return out;
}

export function domeNight(P) {
  const L0 = ridgeFor(3, 520, 46, 280, 0.03);
  const L1 = ridgeFor(8, 572, 48, 220, -0.02);
  const L2 = ridgeFor(15, 612, 40, 170, 0.012);
  let body = `<clipPath id="plate"><rect x="52" y="52" width="1496" height="796"/></clipPath><g clip-path="url(#plate)">`;
  body += sky(P);
  body += contourLayer({ profile: L0, fill: P.paper, stroke: P['ink-3'], width: 1.1, lines: 6, gap: 8, wobble: 1.6, seed: 41, P });
  body += contourLayer({ profile: L1, fill: P.paper, stroke: P['ink-2'], width: 1.3, lines: 8, gap: 9, wobble: 2, seed: 52, ticks: true, P });
  body += contourLayer({ profile: L2, fill: P.paper, stroke: P['ink-2'], width: 1.5, lines: 8, gap: 10, wobble: 2.4, seed: 63, ticks: true, P });
  body += dome(P);
  body += contourLayer({ profile: nearRidge, fill: P.paper, stroke: P.ink, width: 2, lines: 16, gap: 10, wobble: 3, seed: 74, ticks: true, P });
  body += road(P);
  body += '</g>';

  const mx = 300;
  const my = 190;
  body += `<ellipse cx="${mx}" cy="${my}" rx="13" ry="4.5" transform="rotate(-38 ${mx} ${my})" fill="${P.zhu}"/><circle cx="${mx}" cy="${my}" r="24" fill="none" stroke="${P.zhu}" stroke-width="1.8"/>`;
  body += textPath('仙女星系', { font: 'kai', size: 24, x: mx + 36, y: my + 34, fill: P.zhu }).svg;
  const gx = 520;
  const gy = bandY(gx) - 120;
  body += `<g transform="rotate(-12 ${gx} ${gy})">${textPath('银河', { font: 'kai', size: 26, x: gx, y: gy, track: 0.25, fill: P.ink, halo: { color: P.paper, width: 9 } }).svg}</g>`;

  return svgFile({ w: W, h: H, title: '圆顶开缝，银河横过山脊上方', body, P });
}

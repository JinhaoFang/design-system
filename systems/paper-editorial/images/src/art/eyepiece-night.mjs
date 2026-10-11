/*
 * images/eyepiece-night.svg (1600x900): an observing night inside the dome. A visitor on tiptoe leans in to the eyepiece, a volunteer beside them speaks quietly and holds a red torch.
 * The night is a field of densely packed fine horizontal lines (broken into short segments whose weight follows a tone function: darkest at the dome's edges, thinning toward the open slit and around the red torch),
 * so figures and instrument stand out as paper-coloured outlines. The slit is a band along the telescope axis showing a stippled sky; faint seams of the dome run across the lines.
 * The telescope is a hatched tube on a pier with a side eyepiece barrel whose end is placed from the visitor's actual head position. Vermilion appears only as the small red torch lens.
 * eyepieceNight(P) -> SVG document string. Deterministic; people are posture-driven silhouettes from figures.mjs (no faces).
 */
import { f, fbm2, rng, smoothstep } from '../lib/random.mjs';
import { dotsPath, starCross } from '../lib/dots.mjs';
import { svgFile } from '../lib/svgdoc.mjs';
import { figure, hull } from './figures.mjs';

const W = 1600;
const H = 900;
const FLOOR = 806;
const A = [505, 742];
const B = [790, 92];
const TW = 150;

const clampIndex = (k, max) => Math.max(0, Math.min(max, k));

const axisDir = (() => {
  const l = Math.hypot(B[0] - A[0], B[1] - A[1]);
  return [(B[0] - A[0]) / l, (B[1] - A[1]) / l];
})();
const axisNormal = [axisDir[1] * -1, axisDir[0]];
const axisAt = (y) => A[0] + ((A[1] - y) / (A[1] - B[1])) * (B[0] - A[0]);
const offAxis = (x, y) => Math.abs(x - axisAt(y)) * Math.abs(axisDir[1]);

function night(P, torch) {
  const rand = rng(14);
  const buckets = [[], [], [], [], [], []];
  const widths = [0.4, 0.68, 0.95, 1.25, 1.55, 1.85];
  for (let y = 54; y < FLOOR; y += 4.6) {
    for (let x = 52; x < 1548; x += 6) {
      const slit = Math.exp(-Math.pow(offAxis(x + 7, y) / 250, 2)) * (y < 520 ? 1 : Math.exp(-Math.pow((y - 520) / 160, 2)));
      const glow = torch ? Math.exp(-(Math.pow((x - torch[0]) / 150, 2) + Math.pow((y - torch[1]) / 110, 2))) : 0;
      const floorGlow = smoothstep(FLOOR - 150, FLOOR, y) * 0.35;
      const edge = smoothstep(220, 700, Math.abs(x - 800)) * 0.12;
      const dark = 0.9 - 0.52 * slit - 0.5 * glow - floorGlow + edge + (fbm2(x / 260, y / 200, 4, 3) - 0.5) * 0.3 + (rand() - 0.5) * 0.03;
      if (dark < 0.2) continue;
      const k = clampIndex(Math.floor((dark - 0.2) / 0.12), 5);
      buckets[k].push(`M${f(x)} ${f(y)}h6.4`);
    }
  }
  let out = '';
  buckets.forEach((b, k) => {
    out += `<path d="${b.join('')}" stroke="${P.ink}" stroke-width="${widths[k]}" fill="none" stroke-linecap="butt"/>`;
  });
  return out;
}

function seams(P) {
  let d = '';
  for (const r of [360, 560, 760, 960, 1160]) d += `M${f(750 - r)} 860A${r} ${r * 1.15} 0 0 1 ${f(750 + r)} 860`;
  return `<path d="${d}" fill="none" stroke="${P.paper}" stroke-width="2.4" opacity="0.5"/>`;
}

function slit(P) {
  const rand = rng(88);
  const half = 125;
  const yTop = 52;
  const yBot = 540;
  const xt = axisAt(yTop);
  const xb = axisAt(yBot);
  const poly = `M${f(xt - half)} ${yTop}L${f(xt + half)} ${yTop}L${f(xb + half)} ${yBot}A${half} 70 0 0 1 ${f(xb - half)} ${yBot}Z`;
  const pts = [];
  for (let i = 0; i < 1900; i += 1) {
    const y = yTop + rand() * (yBot + 60 - yTop);
    const x = axisAt(y) + (rand() - 0.5) * half * 2;
    pts.push([x, y, 0.7 + Math.pow(rand(), 4) * 1.8]);
  }
  const stars = [];
  for (let i = 0; i < 6; i += 1) {
    const y = yTop + 40 + rand() * 300;
    stars.push(starCross(axisAt(y) + (rand() - 0.5) * half * 1.7, y, 5 + rand() * 6, P.ink));
  }
  return {
    clip: `<clipPath id="slit"><path d="${poly}"/></clipPath>`,
    fill: `<path d="${poly}" fill="${P.paper}"/><g clip-path="url(#slit)">${dotsPath(pts, { color: P.ink })}${stars.join('')}</g>`,
    edge: `<path d="${poly}" fill="none" stroke="${P.ink}" stroke-width="3" stroke-linejoin="round"/><path d="M${f(xt - half - 9)} ${yTop}L${f(xb - half - 9)} ${yBot + 8}M${f(xt + half + 9)} ${yTop}L${f(xb + half + 9)} ${yBot + 8}" stroke="${P.paper}" stroke-width="1.6" opacity="0.8"/>`,
  };
}

function tubeShape(P, eyeEnd) {
  const ang = (Math.atan2(B[1] - A[1], B[0] - A[0]) * 180) / Math.PI;
  const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
  let out = `<g transform="translate(${A[0]} ${A[1]}) rotate(${f(ang)})">`;
  out += `<rect x="0" y="${-TW / 2}" width="${f(len)}" height="${TW}" fill="${P.paper}"/>`;
  let hatch = '';
  for (let k = -TW / 2 + 4; k < TW / 2; k += 4.2) {
    const dark = (k + TW / 2) / TW;
    hatch += `<line x1="0" y1="${f(k)}" x2="${f(len)}" y2="${f(k)}" stroke="${P.ink}" stroke-width="${f(0.4 + dark * dark * 1.5)}" opacity="${f(0.25 + dark * 0.6)}"/>`;
  }
  out += hatch;
  out += `<rect x="0" y="${-TW / 2}" width="${f(len)}" height="${TW}" fill="none" stroke="${P.ink}" stroke-width="2.6"/>`;
  for (const t of [0.12, 0.34, 0.9]) out += `<path d="M${f(len * t)} ${-TW / 2}V${TW / 2}M${f(len * t + 9)} ${-TW / 2}V${TW / 2}" stroke="${P.ink}" stroke-width="1.8"/>`;
  out += `<ellipse cx="${f(len)}" cy="0" rx="14" ry="${TW / 2}" fill="${P.ink}"/><ellipse cx="${f(len)}" cy="0" rx="9" ry="${TW / 2 - 9}" fill="${P.paper}"/><ellipse cx="${f(len)}" cy="0" rx="4" ry="${TW / 2 - 24}" fill="${P.ink}"/>`;
  out += '</g>';

  const e0 = [axisAt(540) + (TW / 2) * Math.abs(axisNormal[0]) * 1.0 + 6, 540];
  const dx = eyeEnd[0] - e0[0];
  const dy = eyeEnd[1] - e0[1];
  const l = Math.hypot(dx, dy);
  const ang2 = (Math.atan2(dy, dx) * 180) / Math.PI;
  out += `<g transform="translate(${f(e0[0])} ${f(e0[1])}) rotate(${f(ang2)})">`;
  out += `<rect x="-8" y="-17" width="${f(l * 0.34)}" height="34" fill="${P.paper}" stroke="${P.ink}" stroke-width="2.2"/>`;
  out += `<rect x="${f(l * 0.34 - 8)}" y="-11" width="${f(l * 0.66)}" height="22" fill="${P.paper}" stroke="${P.ink}" stroke-width="2.2"/>`;
  out += `<rect x="${f(l - 12)}" y="-15" width="12" height="30" fill="${P.ink}"/><path d="M${f(l * 0.34)} -11V11M${f(l * 0.34 + 8)} -11V11" stroke="${P.ink}" stroke-width="1.4"/>`;
  out += '</g>';
  return out;
}


const PIVOT_Y = 676;

function pier(P) {
  const px = axisAt(PIVOT_Y);
  const col = `M${f(px - 84)} ${FLOOR}V${PIVOT_Y + 20}H${f(px + 84)}V${FLOOR}Z`;
  let out = `<path d="${col}" fill="${P.paper}"/>`;
  let hatch = '';
  for (let k = 0; k < 170; k += 4.4) hatch += `M${f(px - 84 + k * 0.5 + 40)} ${FLOOR}V${PIVOT_Y + 20}`;
  out += `<clipPath id="pier"><path d="${col}"/></clipPath><g clip-path="url(#pier)"><path d="${hatch}" stroke="${P.ink}" stroke-width="0.9" fill="none" opacity="0.8"/></g>`;
  out += `<path d="${col}" fill="none" stroke="${P.ink}" stroke-width="2.6" stroke-linejoin="round"/>`;
  out += `<rect x="${f(px - 128)}" y="${FLOOR - 26}" width="256" height="26" fill="${P.paper}" stroke="${P.ink}" stroke-width="2.6"/><path d="M${f(px - 128)} ${FLOOR - 14}H${f(px + 128)}" stroke="${P.ink}" stroke-width="1.2"/>`;
  out += `<circle cx="${f(px)}" cy="${PIVOT_Y}" r="62" fill="${P.paper}" stroke="${P.ink}" stroke-width="2.6"/><circle cx="${f(px)}" cy="${PIVOT_Y}" r="40" fill="none" stroke="${P.ink}" stroke-width="1.4"/><circle cx="${f(px)}" cy="${PIVOT_Y}" r="12" fill="${P.ink}"/>`;
  return out;
}

function floor(P) {
  let d = '';
  for (let i = 0; i < 9; i += 1) d += `M60 ${f(FLOOR + 8 + i * i * 0.6 + i * 3.4)}H1540`;
  return `<rect x="52" y="${FLOOR}" width="1496" height="${848 - FLOOR}" fill="${P.paper}"/><path d="${d}" stroke="${P.ink}" stroke-width="0.7" opacity="0.5" fill="none"/><path d="M52 ${FLOOR}H1548" stroke="${P.ink}" stroke-width="2.4"/>`;
}

function shadow(x, w, P) {
  let d = '';
  for (let i = 0; i < 9; i += 1) d += `M${f(x - w / 2 + i * 4)} ${FLOOR + 6 + i * 3.4}H${f(x + w / 2 + i * 6)}`;
  return `<path d="${d}" stroke="${P.ink}" stroke-width="1" opacity="0.7" fill="none"/>`;
}

export function eyepieceNight(P) {
  const visitor = figure({
    id: 'vis', x: 925, floor: FLOOR, h: 470, facing: -1, P, line: 2,
    pose: { lean: 20, head: -10, armF: [60, 120], armB: [30, 80], legF: [4, 2], legB: [-5, -2], tiptoe: 58 },
  });
  const volunteer = figure({
    id: 'vol', x: 1150, floor: FLOOR, h: 520, facing: -1, P, line: 2, fill: P['paper-deep'],
    pose: { lean: 8, head: -14, reach: { x: 985, y: 215, bend: 1 }, armB: [-12, -22], legF: [8, 3], legB: [-9, -4] },
  });
  const eyeEnd = [visitor.anchors.headC[0] - 44, visitor.anchors.headC[1] + 6];
  const torch = [volunteer.anchors.handB[0] + 4, volunteer.anchors.handB[1] + 22];
  const sl = slit(P);

  let body = `<clipPath id="plate"><rect x="52" y="52" width="1496" height="796"/></clipPath><g clip-path="url(#plate)">`;
  body += night(P, torch);
  body += seams(P);
  body += sl.clip + sl.fill + sl.edge;
  body += floor(P);
  body += shadow(905, 150, P) + shadow(1150, 170, P) + shadow(axisAt(PIVOT_Y), 300, P);
  body += pier(P);
  body += tubeShape(P, eyeEnd);
  body += visitor.svg;
  body += volunteer.svg;
  const [tx, ty] = torch;
  body += `<path d="${hull([tx + 2, ty - 18, 6], [tx - 4, ty + 6, 9])}" fill="${P.ink}"/><circle cx="${f(tx - 5)}" cy="${f(ty + 10)}" r="8" fill="${P.zhu}"/>`;
  body += '</g>';
  return svgFile({ w: W, h: H, title: '观测夜，访客在目镜前观看', body, P });
}

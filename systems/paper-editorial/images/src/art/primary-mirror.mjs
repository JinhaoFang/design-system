/*
 * images/primary-mirror.svg (1600x900): an engineering-drawing plate of the 1.6 m primary mirror in the clean room.
 * Left: the mirror on its cradle seen face-on, its surface drawn as broken concentric ring-arcs (lighter toward the upper left, where the light comes from), two reflected ceiling-light strips,
 * two small inverted reflections of the staff, a centre bore, centre lines, and the 1.6 m dimension line above it (the vermilion mark). Three staff silhouettes stand and crouch around it
 * (posture only, no faces). Right: section A-A of the mirror with hatching, centre bore and the 20 cm thickness dimension, and a title block with facts from the setting (口径 1.6 m, 厚约 20 cm, 重约 1 t).
 * primaryMirror(P) -> SVG document string. Deterministic; every label is outlined glyph paths.
 */
import { f, rng, smoothstep } from '../lib/random.mjs';
import { textPath, measure } from '../lib/glyphs.mjs';
import { svgFile } from '../lib/svgdoc.mjs';
import { figure, hull } from './figures.mjs';

const W = 1600;
const H = 900;
const MX = 600;
const MY = 405;
const MR = 232;
const FLOOR = 772;

function arrowLine(x1, y1, x2, y2, P, width = 1.2) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const head = (x, y, dir) => {
    const ax = x + Math.cos(a) * 11 * dir;
    const ay = y + Math.sin(a) * 11 * dir;
    return `M${f(ax - Math.sin(a) * 3.6)} ${f(ay + Math.cos(a) * 3.6)}L${f(x)} ${f(y)}L${f(ax + Math.sin(a) * 3.6)} ${f(ay - Math.cos(a) * 3.6)}`;
  };
  return `<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}${head(x1, y1, 1)}${head(x2, y2, -1)}" fill="none" stroke="${P.ink}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;
}

function mirrorFace(P) {
  const rand = rng(9);
  const hub = MR * 0.13;
  let out = '';
  out += `<ellipse cx="${MX + 15}" cy="${MY + 11}" rx="${MR}" ry="${MR * 0.985}" fill="${P.paper}" stroke="${P.ink}" stroke-width="2.4"/>`;
  let thick = '';
  for (let i = 0; i < 70; i += 1) {
    const a = -0.2 + i * 0.026;
    const x1 = MX + Math.cos(a) * MR;
    const y1 = MY + Math.sin(a) * MR * 0.985;
    thick += `M${f(x1)} ${f(y1)}L${f(x1 + 15)} ${f(y1 + 11)}`;
  }
  out += `<path d="${thick}" stroke="${P.ink}" stroke-width="0.8" opacity="0.8" fill="none"/>`;
  out += `<ellipse cx="${MX}" cy="${MY}" rx="${MR}" ry="${MR * 0.985}" fill="${P.paper}" stroke="${P.ink}" stroke-width="3"/>`;
  out += `<ellipse cx="${MX}" cy="${MY}" rx="${MR - 10}" ry="${(MR - 10) * 0.985}" fill="none" stroke="${P.ink}" stroke-width="1"/>`;
  let rings = '';
  for (let r = hub + 7; r < MR - 14; r += 6.2) {
    const ry = r * 0.985;
    let a = rand() * 0.4;
    while (a < Math.PI * 2) {
      const dark = 0.5 - 0.5 * Math.cos(a - 0.9);
      const span = (0.12 + rand() * 0.7) * (0.45 + dark);
      const keep = 0.28 + 0.72 * smoothstep(0.1, 0.95, dark);
      if (rand() < keep) {
        const a2 = Math.min(a + span, Math.PI * 2);
        rings += `M${f(MX + Math.cos(a) * r)} ${f(MY + Math.sin(a) * ry)}A${f(r)} ${f(ry)} 0 ${a2 - a > Math.PI ? 1 : 0} 1 ${f(MX + Math.cos(a2) * r)} ${f(MY + Math.sin(a2) * ry)}`;
      }
      a += span + 0.05 + rand() * 0.22 * (1.2 - dark);
    }
  }
  out += `<clipPath id="face"><ellipse cx="${MX}" cy="${MY}" rx="${MR - 12}" ry="${(MR - 12) * 0.985}"/></clipPath>`;
  out += `<g clip-path="url(#face)"><path d="${rings}" fill="none" stroke="${P.ink}" stroke-width="0.8" opacity="0.85"/>`;
  out += `<g transform="rotate(-24 ${MX - 95} ${MY - 120})"><rect x="${MX - 190}" y="${MY - 134}" width="190" height="26" rx="13" fill="${P.paper}" stroke="${P.ink}" stroke-width="1"/><rect x="${MX - 178}" y="${MY - 100}" width="120" height="14" rx="7" fill="${P.paper}" stroke="${P.ink}" stroke-width="1"/></g>`;
  out += `<g transform="rotate(-24 ${MX + 55} ${MY - 105})"><rect x="${MX - 20}" y="${MY - 120}" width="150" height="20" rx="10" fill="${P.paper}" stroke="${P.ink}" stroke-width="1"/></g>`;
  out += '</g>';
  out += `<circle cx="${MX}" cy="${MY}" r="${hub}" fill="${P['paper-deep']}" stroke="${P.ink}" stroke-width="2"/><circle cx="${MX}" cy="${MY}" r="${hub * 0.62}" fill="${P.ink}"/>`;
  out += `<path d="M${MX - MR - 60} ${MY}H${MX + MR + 60}M${MX} ${MY - MR - 50}V${MY + MR + 50}" stroke="${P.ink}" stroke-width="0.8" stroke-dasharray="16 4 2 4" fill="none" opacity="0.8"/>`;
  return out;
}


function cradle(P) {
  let out = '';
  const post = (cx, topY, sx) => {
    const d = `M${f(cx - 22)} ${topY}H${f(cx + 22)}L${f(cx + 22 + sx * 36)} ${FLOOR - 26}H${f(cx - 22 + sx * 36)}Z`;
    let hatch = '';
    for (let k = 0; k < 44; k += 5) hatch += `M${f(cx - 22 + k + 12)} ${topY}L${f(cx - 22 + k + 12 + sx * 36)} ${FLOOR - 26}`;
    return `<clipPath id="post${sx > 0 ? 'r' : 'l'}"><path d="${d}"/></clipPath><path d="${d}" fill="${P.paper}"/><g clip-path="url(#post${sx > 0 ? 'r' : 'l'})"><path d="${hatch}" stroke="${P.ink}" stroke-width="0.8" fill="none" opacity="0.75"/></g><path d="${d}" fill="none" stroke="${P.ink}" stroke-width="2.6" stroke-linejoin="round"/>`;
  };
  const yoke = (a0, a1, r, w) => {
    const p = (a) => [MX + Math.cos(a) * r, MY + Math.sin(a) * r * 0.985];
    const [x0, y0] = p(a0);
    const [x1, y1] = p(a1);
    const d = `M${f(x0)} ${f(y0)}A${r} ${f(r * 0.985)} 0 0 1 ${f(x1)} ${f(y1)}`;
    return `<path d="${d}" fill="none" stroke="${P.ink}" stroke-width="${w + 5}" stroke-linecap="butt"/><path d="${d}" fill="none" stroke="${P.paper}" stroke-width="${w}"/><path d="${d}" fill="none" stroke="${P.ink}" stroke-width="1" stroke-dasharray="3 7" opacity="0.8"/>`;
  };
  out += post(MX - 176, MY + MR - 10, -1) + post(MX + 176, MY + MR - 10, 1);
  out += `<rect x="${MX - 176 - 52}" y="${FLOOR - 142}" width="${(176 + 52) * 2}" height="18" fill="${P.paper}" stroke="${P.ink}" stroke-width="2.4"/>`;
  out += `<path d="M${MX - 176 - 40} ${FLOOR - 124}L${MX + 176 + 40} ${FLOOR - 62}M${MX + 176 + 40} ${FLOOR - 124}L${MX - 176 - 40} ${FLOOR - 62}" stroke="${P.ink}" stroke-width="1.2" fill="none"/>`;
  out += `<rect x="${MX - 176 - 76}" y="${FLOOR - 62}" width="${(176 + 76) * 2}" height="16" fill="${P.paper}" stroke="${P.ink}" stroke-width="2.4"/>`;
  for (const sx of [-1, 1]) {
    out += `<rect x="${f(MX + sx * 190 - 34)}" y="${FLOOR - 30}" width="68" height="14" fill="${P.paper}" stroke="${P.ink}" stroke-width="2.2"/><circle cx="${MX + sx * 190}" cy="${FLOOR - 8}" r="11" fill="${P.paper}" stroke="${P.ink}" stroke-width="2.2"/><circle cx="${MX + sx * 190}" cy="${FLOOR - 8}" r="3" fill="${P.ink}"/>`;
  }
  out += yoke(0.55, Math.PI - 0.55, MR + 16, 12);
  return out;
}

function ghost(x, y, s, P) {
  const parts = [hull([x, y, 11 * s], [x, y, 11 * s]), hull([x, y + 22 * s, 17 * s], [x, y + 96 * s, 13 * s])];
  const id = `gh${Math.round(x)}`;
  return `<clipPath id="${id}"><path d="${parts.join('')}"/></clipPath><g clip-path="url(#face)"><path d="${parts.join('')}" fill="${P['paper-shade']}" opacity="0.8"/><g clip-path="url(#${id})"><path d="M${f(x - 20 * s)} ${f(y + 30 * s)}l${f(40 * s)} ${f(-40 * s)}M${f(x - 20 * s)} ${f(y + 60 * s)}l${f(40 * s)} ${f(-40 * s)}M${f(x - 20 * s)} ${f(y + 90 * s)}l${f(40 * s)} ${f(-40 * s)}" stroke="${P['ink-2']}" stroke-width="0.7" opacity="0.6"/></g></g>`;
}

function floorLines(P) {
  let d = '';
  for (let i = 0; i < 12; i += 1) {
    const y = FLOOR + 8 + i * i * 0.55 + i * 3;
    if (y > 840) break;
    d += `M${f(90 + i * 4)} ${f(y)}H${f(1510 - i * 4)}`;
  }
  return `<path d="${d}" stroke="${P.ink}" stroke-width="0.7" opacity="0.5" fill="none"/><path d="M60 ${FLOOR}H1540" stroke="${P.ink}" stroke-width="1.8"/>`;
}

function sectionView(P) {
  const x0 = 1030;
  const x1 = 1420;
  const w = x1 - x0;
  const cx = (x0 + x1) / 2;
  const top = 330;
  const th = 58;
  const sag = 14;
  const bore = 34;
  const topY = (x) => top + sag * (1 - Math.pow((x - cx) / (w / 2), 2));
  const pts = (fn) => {
    const a = [];
    for (let x = x0; x <= x1; x += 10) a.push([x, fn(x)]);
    return a;
  };
  const upper = pts(topY);
  const lower = pts((x) => topY(x) + th);
  const outline = `M${upper.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}L${f(x1)} ${f(lower[lower.length - 1][1])}L${lower.slice().reverse().map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`;
  let out = `<clipPath id="sec"><path d="${outline}"/></clipPath><path d="${outline}" fill="${P.paper}"/>`;
  let hatch = '';
  for (let k = -th; k < w + th; k += 6.5) hatch += `M${f(x0 + k)} ${top + th + sag + 6}l${th + sag + 12} ${-(th + sag + 12)}`;
  out += `<g clip-path="url(#sec)"><path d="${hatch}" stroke="${P.ink}" stroke-width="0.9" fill="none"/></g>`;
  out += `<rect x="${cx - bore}" y="${top - 4}" width="${bore * 2}" height="${th + sag + 8}" fill="${P.paper}"/>`;
  out += `<path d="${outline}" fill="none" stroke="${P.ink}" stroke-width="2.2" stroke-linejoin="round"/>`;
  out += `<path d="M${cx - bore} ${f(topY(cx - bore))}V${f(topY(cx - bore) + th)}M${cx + bore} ${f(topY(cx + bore))}V${f(topY(cx + bore) + th)}" stroke="${P.ink}" stroke-width="2.2"/>`;
  out += `<path d="M${cx} ${top - 14}V${top + th + sag + 70}" stroke="${P.ink}" stroke-width="0.8" stroke-dasharray="16 4 2 4"/>`;
  out += arrowLine(x1 + 34, f(topY(x1)), x1 + 34, f(topY(x1) + th), P);
  out += `<path d="M${x1 + 6} ${f(topY(x1))}H${x1 + 44}M${x1 + 6} ${f(topY(x1) + th)}H${x1 + 44}" stroke="${P.ink}" stroke-width="0.8"/>`;
  out += textPath('20 cm', { font: 'latin400i', size: 24, x: x1 + 52, y: f(topY(x1) + th / 2 + 8), fill: P.ink }).svg;
  const yd = top + th + sag + 52;
  out += `<path d="M${x0} ${f(topY(x0) + th + 6)}V${yd + 10}M${x1} ${f(topY(x1) + th + 6)}V${yd + 10}" stroke="${P.ink}" stroke-width="0.8"/>`;
  out += arrowLine(x0, yd, x1, yd, P);
  const lab = '1.6 m';
  const lw = measure(lab, 'latin400i', 26);
  out += `<rect x="${f(cx - lw / 2 - 8)}" y="${yd - 14}" width="${f(lw + 16)}" height="28" fill="${P.paper}"/>`;
  out += textPath(lab, { font: 'latin400i', size: 26, x: cx, y: yd + 9, anchor: 'middle', fill: P.ink }).svg;
  out += textPath('剖面　A—A', { font: 'song400', size: 24, x: x0, y: top - 56, fill: P['ink-2'], track: 0.1 }).svg;
  out += textPath('星光自上落下，汇于焦点', { font: 'kai', size: 21, x: x0, y: top - 24, fill: P['ink-3'] }).svg;
  return out;
}

function titleBlock(P) {
  const x0 = 1040;
  const y0 = 622;
  const w = 470;
  const rows = [['名称', '主镜（光学望远镜）'], ['口径', '1.6 m'], ['厚度', '约 20 cm'], ['重量', '约 1 t']];
  const rh = 41;
  let out = `<rect x="${x0}" y="${y0}" width="${w}" height="${rh * rows.length}" fill="${P.paper}" stroke="${P.ink}" stroke-width="2"/>`;
  rows.forEach(([k, v], i) => {
    const y = y0 + i * rh;
    if (i) out += `<path d="M${x0} ${y}H${x0 + w}" stroke="${P.ink}" stroke-width="0.9"/>`;
    out += textPath(k, { font: 'song600', size: 21, x: x0 + 16, y: y + 28, fill: P['ink-2'], track: 0.3 }).svg;
    const latin = /^[0-9]|^约/.test(v);
    if (latin) {
      let cursor = x0 + 128;
      for (const part of v.match(/[0-9.]+|[a-z]+|[^\s0-9.a-z]+/g) ?? []) {
        const font = /[0-9.a-z]/.test(part[0]) ? 'latin400' : 'song400';
        const t = textPath(part, { font, size: 23, x: cursor, y: y + 28, fill: P.ink });
        out += t.svg;
        cursor += t.width + 7;
      }
    } else out += textPath(v, { font: 'song400', size: 23, x: x0 + 128, y: y + 28, fill: P.ink }).svg;
  });
  out += `<path d="M${x0 + 100} ${y0}V${y0 + rh * rows.length}" stroke="${P.ink}" stroke-width="0.9"/>`;
  return out;
}

export function primaryMirror(P) {
  let body = `<clipPath id="plate"><rect x="52" y="52" width="1496" height="796"/></clipPath><g clip-path="url(#plate)">`;
  body += floorLines(P);
  body += cradle(P);
  body += mirrorFace(P);

  const yTop = MY - MR - 52;
  body += `<path d="M${MX - MR} ${yTop + 6}V${MY - 30}M${MX + MR} ${yTop + 6}V${MY - 30}" stroke="${P.ink}" stroke-width="0.8" stroke-dasharray="2 4" fill="none"/>`;
  body += arrowLine(MX - MR, yTop, MX + MR, yTop, P);
  const lab = '1.6 m';
  const lw = measure(lab, 'latin400i', 30);
  body += `<rect x="${f(MX - lw / 2 - 10)}" y="${yTop - 20}" width="${f(lw + 20)}" height="40" fill="${P.paper}"/>`;
  body += textPath(lab, { font: 'latin400i', size: 30, x: MX, y: yTop + 10, anchor: 'middle', fill: P.zhu }).svg;

  body += ghost(MX - 118, MY + 70, 1, P) + ghost(MX + 92, MY + 96, 0.86, P);

  const staff = [];
  staff.push(figure({ id: 'wa', x: 228, floor: FLOOR, h: 505, facing: 1, P, pose: { lean: 12, head: 14, reach: { x: MX - MR + 36, y: MY + 6, bend: 1 }, armB: [8, 18], legF: [10, 4], legB: [-9, -4] } }));
  staff.push(figure({ id: 'wb', x: 936, floor: FLOOR, h: 488, facing: -1, P, pose: { lean: 8, head: 16, armF: [26, 70], armB: [14, 58], legF: [6, 2], legB: [-7, -3] } }));
  staff.push(figure({ id: 'wc', x: 792, floor: FLOOR, h: 440, facing: -1, P, pose: { lean: 20, head: 20, reach: { x: MX + 168, y: MY + MR + 14, bend: -1 }, armB: [30, 60], legF: [64, -30], legB: [-22, -72] } }));
  staff.forEach((s) => {
    body += s.svg;
  });


  body += sectionView(P);
  body += titleBlock(P);
  const zx = MX - MR + 36;
  body += `<circle cx="${zx}" cy="${MY + 6}" r="15" fill="none" stroke="${P.zhu}" stroke-width="2"/>`;
  body += '</g>';
  return svgFile({ w: W, h: H, title: '洁净室里的 1.6 米主镜与检修人员', body, P });
}

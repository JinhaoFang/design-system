/*
 * The five partner marks (images/mark-*.svg, 640x240, transparent background, ink only), drawn like woodblock colophon plates and seal impressions rather than flat logos:
 * thick-and-thin ruled borders, carved symbols built from solid ink shapes and engraved lines, outlined glyph names (Song bold, spaced).
 *   mark-beizhu-univ   北渚大学天文系: ruled tablet; round seal with the pole star over an islet and waves, a ring of 24 ticks.
 *   mark-xingye-optics 星野光学仪器: wordmark between double rules, a convex lens with converging rays, a graduated scale under the name.
 *   mark-luxi-town     鹿溪镇人民政府: round emblem of a stag's head over stream lines, official side rules, town name below.
 *   mark-wandu-society 晚渡业余天文协会: arch-topped tablet with a small ferry under a star on the water, name in two lines.
 *   mark-jiahe-school  嘉禾中学天文社: wreath of rice ears around a star over an open book, name beside it.
 * marks(P) -> { id: svg string }. Only P.ink is used (a mark is monochrome); reversed text uses an SVG mask, whose black and white are not painted colours.
 */
import { f } from '../lib/random.mjs';
import { textPath } from '../lib/glyphs.mjs';

const W = 640;
const H = 240;

const wrap = (title, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">\n<title>${title}</title>\n${body}\n</svg>\n`;

const wave = (x0, x1, y, amp, wl) => {
  let d = `M${f(x0)} ${f(y)}`;
  for (let x = x0; x < x1; x += wl) d += `q${f(wl / 4)} ${f(-amp)} ${f(wl / 2)} 0t${f(wl / 2)} 0`;
  return d;
};

const star4 = (x, y, r, k = 0.26) => {
  const pts = [];
  for (let i = 0; i < 8; i += 1) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * k;
    pts.push(`${f(x + Math.cos(a) * rr)} ${f(y + Math.sin(a) * rr)}`);
  }
  return `<path d="M${pts.join('L')}Z"/>`;
};

const ticks = (cx, cy, r1, r2, n, longEvery = 6) => {
  let d = '';
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    const rr = i % longEvery === 0 ? r2 + 5 : r2;
    d += `M${f(cx + Math.sin(a) * r1)} ${f(cy - Math.cos(a) * r1)}L${f(cx + Math.sin(a) * rr)} ${f(cy - Math.cos(a) * rr)}`;
  }
  return d;
};

function beizhu(P) {
  const ink = P.ink;
  const cx = 124;
  const cy = 120;
  let b = `<rect x="8" y="8" width="624" height="224" fill="none" stroke="${ink}" stroke-width="4"/><rect x="18" y="18" width="604" height="204" fill="none" stroke="${ink}" stroke-width="1.4"/>`;
  b += `<clipPath id="b-c"><circle cx="${cx}" cy="${cy}" r="70"/></clipPath>`;
  b += `<circle cx="${cx}" cy="${cy}" r="86" fill="none" stroke="${ink}" stroke-width="3.6"/><circle cx="${cx}" cy="${cy}" r="76" fill="none" stroke="${ink}" stroke-width="1.2"/>`;
  b += `<path d="${ticks(cx, cy, 90, 96, 48, 12)}" stroke="${ink}" stroke-width="1.4" fill="none"/>`;
  b += `<g clip-path="url(#b-c)"><g fill="${ink}">${star4(cx, cy - 34, 24, 0.22)}</g>`;
  b += `<path d="M${cx - 62} ${cy + 36}Q${cx - 30} ${cy - 2} ${cx - 4} ${cy + 6}Q${cx + 22} ${cy - 8} ${cx + 62} ${cy + 36}Z" fill="${ink}"/>`;
  for (let i = 0; i < 4; i += 1) b += `<path d="${wave(cx - 78, cx + 82, cy + 46 + i * 11, 6, 22)}" fill="none" stroke="${ink}" stroke-width="${f(2.2 - i * 0.3)}" stroke-linecap="round"/>`;
  b += `<path d="M${cx - 66} ${cy + 40}H${cx + 66}" stroke="${ink}" stroke-width="2"/></g>`;
  b += textPath('北渚大学', { font: 'song600', size: 72, x: 246, y: 128, track: 0.14, fill: ink }).svg;
  b += `<path d="M248 150H606" stroke="${ink}" stroke-width="1.4"/><path d="M248 156H606" stroke="${ink}" stroke-width="3.4"/>`;
  b += textPath('天文系', { font: 'song400', size: 40, x: 248, y: 202, track: 0.62, fill: ink }).svg;
  b += `<g fill="${ink}"><path d="M584 176l8 14 -8 14 -8 -14z"/></g>`;
  return wrap('北渚大学天文系标识', b);
}

function xingye(P) {
  const ink = P.ink;
  let b = `<path d="M24 24H616" stroke="${ink}" stroke-width="5"/><path d="M24 33H616" stroke="${ink}" stroke-width="1.4"/><path d="M24 207H616" stroke="${ink}" stroke-width="1.4"/><path d="M24 216H616" stroke="${ink}" stroke-width="5"/>`;
  const cx = 112;
  const cy = 120;
  b += `<path d="M${cx} ${cy - 62}Q${cx + 30} ${cy} ${cx} ${cy + 62}Q${cx - 30} ${cy} ${cx} ${cy - 62}Z" fill="${ink}"/>`;
  for (const dy of [-38, 0, 38]) {
    const yy = cy + dy;
    const tipX = cx + 88;
    b += `<path d="M30 ${yy}H${cx - 14 + (Math.abs(dy) > 0 ? 6 : 0)}" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`;
    b += `<path d="M${cx + 14 - (Math.abs(dy) > 0 ? 4 : 0)} ${yy * 0.0 + cy + dy * 0.82}L${tipX - 14} ${cy}" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>`;
  }
  b += `<g fill="${ink}">${star4(cx + 90, cy, 17, 0.2)}</g>`;
  b += textPath('星野', { font: 'song600', size: 88, x: 236, y: 146, track: 0.08, fill: ink }).svg;
  b += textPath('光学仪器', { font: 'song400', size: 38, x: 424, y: 146, track: 0.12, fill: ink }).svg;
  let scale = '';
  for (let i = 0; i <= 38; i += 1) {
    const x = 240 + i * 9.4;
    scale += `M${f(x)} 168v${i % 5 === 0 ? 20 : 10}`;
  }
  b += `<path d="${scale}M240 168H${f(240 + 38 * 9.4)}" stroke="${ink}" stroke-width="1.5" fill="none"/>`;
  return wrap('星野光学仪器标识', b);
}

function luxi(P) {
  const ink = P.ink;
  const cx = 320;
  const cy = 98;
  let b = `<clipPath id="l-c"><circle cx="${cx}" cy="${cy}" r="62"/></clipPath>`;
  b += `<circle cx="${cx}" cy="${cy}" r="76" fill="none" stroke="${ink}" stroke-width="4"/><circle cx="${cx}" cy="${cy}" r="68" fill="none" stroke="${ink}" stroke-width="1.3"/>`;
  b += `<path d="${ticks(cx, cy, 80, 84, 36, 9)}" stroke="${ink}" stroke-width="1.3" fill="none"/>`;
  b += `<g clip-path="url(#l-c)">`;
  b += `<path d="M${cx - 17} ${cy - 8}L${cx + 17} ${cy - 8}L${cx + 11} ${cy + 22}L${cx} ${cy + 36}L${cx - 11} ${cy + 22}Z" fill="${ink}"/>`;
  b += `<path d="M${cx - 15} ${cy - 10}Q${cx - 34} ${cy - 20} ${cx - 33} ${cy - 2}Q${cx - 24} ${cy - 2} ${cx - 15} ${cy - 2}Z" fill="${ink}"/><path d="M${cx + 15} ${cy - 10}Q${cx + 34} ${cy - 20} ${cx + 33} ${cy - 2}Q${cx + 24} ${cy - 2} ${cx + 15} ${cy - 2}Z" fill="${ink}"/>`;
  const antler = (s) => {
    const X = (v) => cx + s * v;
    return `<path d="M${X(8)} ${cy - 8}C${X(10)} ${cy - 24} ${X(22)} ${cy - 40} ${X(20)} ${cy - 58}M${X(14)} ${cy - 24}C${X(26)} ${cy - 28} ${X(36)} ${cy - 36} ${X(40)} ${cy - 48}M${X(18)} ${cy - 40}C${X(8)} ${cy - 46} ${X(4)} ${cy - 54} ${X(6)} ${cy - 64}M${X(20)} ${cy - 56}C${X(28)} ${cy - 60} ${X(32)} ${cy - 66} ${X(33)} ${cy - 72}" fill="none" stroke="${ink}" stroke-width="3.2" stroke-linecap="round"/>`;
  };
  b += antler(1) + antler(-1);
  for (let i = 0; i < 4; i += 1) b += `<path d="${wave(cx - 70, cx + 74, cy + 40 + i * 8, 4, 18)}" fill="none" stroke="${ink}" stroke-width="${f(2.4 - i * 0.4)}" stroke-linecap="round"/>`;
  b += '</g>';
  for (const s of [-1, 1]) {
    b += `<path d="M${cx + s * 100} ${cy}H${cx + s * 270}" stroke="${ink}" stroke-width="1.5"/><path d="M${cx + s * 100} ${cy + 6}H${cx + s * 230}" stroke="${ink}" stroke-width="3.6"/><path d="M${cx + s * 282} ${cy}l${s * -8} -8 ${s * -8} 8 ${s * 8} 8z" fill="${ink}"/>`;
  }
  b += textPath('鹿溪镇人民政府', { font: 'song600', size: 42, x: cx, y: 216, anchor: 'middle', track: 0.2, fill: ink }).svg;
  return wrap('鹿溪镇人民政府标识', b);
}

function wandu(P) {
  const ink = P.ink;
  let b = `<clipPath id="w-c"><path d="M32 214V86A68 68 0 0 1 168 86V214Z"/></clipPath>`;
  b += `<path d="M24 222V86A76 76 0 0 1 176 86V222Z" fill="none" stroke="${ink}" stroke-width="4.4" stroke-linejoin="round"/><path d="M32 214V86A68 68 0 0 1 168 86V214Z" fill="none" stroke="${ink}" stroke-width="1.4"/>`;
  b += `<g clip-path="url(#w-c)">`;
  b += `<g fill="${ink}">${star4(100, 62, 20, 0.22)}</g>`;
  b += `<path d="M104 92V148" stroke="${ink}" stroke-width="3.4"/>`;
  b += `<path d="M107 94L146 138H107Z" fill="${ink}"/>`;
  b += `<path d="M96 100L62 140H96Z" fill="none" stroke="${ink}" stroke-width="2"/><path d="M92 112L76 138M86 124L82 138" stroke="${ink}" stroke-width="1.4"/>`;
  b += `<path d="M52 148H156L146 168Q100 182 62 168Z" fill="${ink}"/>`;
  for (let i = 0; i < 5; i += 1) b += `<path d="${wave(26, 176, 178 + i * 10, 5, 24, i)}" fill="none" stroke="${ink}" stroke-width="${f(2.4 - i * 0.3)}" stroke-linecap="round"/>`;
  b += '</g>';
  b += `<path d="M206 40V200" stroke="${ink}" stroke-width="1.6"/>`;
  b += textPath('晚渡业余', { font: 'song600', size: 66, x: 232, y: 108, track: 0.12, fill: ink }).svg;
  b += textPath('天文协会', { font: 'song600', size: 66, x: 232, y: 190, track: 0.12, fill: ink }).svg;
  b += `<path d="M232 128H556" stroke="${ink}" stroke-width="1.4"/>`;
  return wrap('晚渡业余天文协会标识', b);
}

function jiahe(P) {
  const ink = P.ink;
  const cx = 120;
  const cy = 118;
  let b = `<circle cx="${cx}" cy="${cy}" r="92" fill="none" stroke="${ink}" stroke-width="4"/><circle cx="${cx}" cy="${cy}" r="84" fill="none" stroke="${ink}" stroke-width="1.2"/>`;
  const ear = (s) => {
    let stem = '';
    for (let i = 0; i <= 40; i += 1) {
      const phi = (i / 40) * 2.6;
      stem += `${i ? 'L' : 'M'}${f(cx + s * 62 * Math.sin(phi))} ${f(cy + 62 * Math.cos(phi))}`;
    }
    let grains = '';
    const n = 9;
    for (let i = 1; i <= n + 1; i += 1) {
      const t = i / (n + 1);
      const phi = 0.28 + t * 2.32;
      const px = cx + s * 62 * Math.sin(phi);
      const py = cy + 62 * Math.cos(phi);
      const tang = Math.atan2(-Math.sin(phi), s * Math.cos(phi));
      const dirs = i === n + 1 ? [0] : [-0.8, 0.8];
      for (const o of dirs) {
        const ang = tang + o;
        const len = 17 - t * 4;
        const gx = px + Math.cos(ang) * len * 0.5;
        const gy = py + Math.sin(ang) * len * 0.5;
        grains += `<ellipse cx="${f(gx)}" cy="${f(gy)}" rx="${f(len / 2)}" ry="${f(4.2 - t * 1.1)}" transform="rotate(${f((ang * 180) / Math.PI)} ${f(gx)} ${f(gy)})"/>`;
      }
    }
    return `<path d="${stem}" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/><g fill="${ink}">${grains}</g>`;
  };
  b += ear(1) + ear(-1);
  b += `<path d="M${cx - 16} ${cy + 76}L${cx} ${cy + 62}L${cx + 16} ${cy + 76}M${cx - 14} ${cy + 80}L${cx} ${cy + 64}L${cx + 14} ${cy + 80}" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
  b += `<g fill="${ink}">${star4(cx, cy - 2, 30, 0.24)}</g>`;
  b += textPath('嘉禾中学', { font: 'song600', size: 72, x: 246, y: 128, track: 0.1, fill: ink }).svg;
  b += `<path d="M248 148H612" stroke="${ink}" stroke-width="4"/><path d="M248 156H612" stroke="${ink}" stroke-width="1.3"/>`;
  b += textPath('天文社', { font: 'song400', size: 42, x: 248, y: 204, track: 0.7, fill: ink }).svg;
  return wrap('嘉禾中学天文社标识', b);
}

export function marks(P) {
  return {
    'mark-beizhu-univ': beizhu(P),
    'mark-xingye-optics': xingye(P),
    'mark-luxi-town': luxi(P),
    'mark-wandu-society': wandu(P),
    'mark-jiahe-school': jiahe(P),
  };
}

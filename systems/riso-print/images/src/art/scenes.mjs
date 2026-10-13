/*
 * The four standard-sample scenes of riso-print as two-drum prints (1200x800, transparent ground): a blue plate and a pink plate, multiplied, the pink one shifted by the fixed misregistration.
 * Flat shapes, dot-screen tints and halftone gradients only; paper-coloured shapes inside a plate are knock-outs (no ink there). Overlaps of the two inks are the purple.
 *   domeNight()    圆顶开缝、银河横过山脊: blue sky gradient with knocked-out stars, solid ridge, the dome with its slit open and the telescope inside; pink Milky Way band and horizon glow.
 *   summitRoad()   傍晚的盘山路通向山顶圆顶: pink dusk sky and sun, two blue mountain plates, the road a knocked-out ribbon climbing to the small dome at the summit.
 *   primaryMirror() 洁净室里检修 1.6 米主镜: the mirror as a large blue halftone disc in its cell, pink lamp reflections, three suited workers in outline, a row of pink ceiling lamps.
 *   eyepieceNight() 红光下的目镜前: night in blue, red light as pink over it; the tube, a visitor on tiptoe at the eyepiece, a volunteer with a red torch whose beam is a pink dot cone.
 * Each returns an SVG file string. Deterministic.
 */
import { HEX, defs, dotField, pinkPlate, plate, screen, svgFile } from '../lib/plate.mjs';
import { f, fbm2, rng, smoothstep } from '../lib/random.mjs';

const W = 1200, H = 800;
const B = HEX.blue, P = HEX.pink, K = HEX.paper;

const ridgePath = (pts, bottom = H) => `M0 ${bottom}L${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}L${W} ${bottom}Z`;
const ridge = (seed, base, amp, step = 24) => {
  const pts = [];
  for (let x = 0; x <= W; x += step) pts.push([x, base - amp * fbm2(x / 260, seed, seed, 4)]);
  return pts;
};
const at = (pts, x) => {
  const i = Math.min(pts.length - 2, Math.max(0, Math.floor(x / (W / (pts.length - 1)))));
  const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
};

export function domeNight() {
  const R = rng(3);
  const far = ridge(2, 600, 120);
  const cx = 760, base = at(far, 760) + 4, dr = 150;
  const sky = dotField({ w: W, h: 620, cell: 12, angle: 15, seed: 4, value: (x, y) => 0.78 - (y / 620) * 0.55 });
  let stars = '';
  for (let i = 0; i < 70; i++) stars += `<circle cx="${f(R() * W)}" cy="${f(R() * 420)}" r="${f(2.4 + R() * 3.6)}" fill="${K}"/>`;
  const band = dotField({ w: W, h: H, cell: 10, angle: 75, seed: 5, value: (x, y) => {
    const d = Math.abs(y - (560 - x * 0.42)) / 110;
    return Math.max(0, 0.85 - d) * (0.55 + 0.6 * fbm2(x / 90, y / 90, 9, 3));
  } });
  const glow = dotField({ w: W, h: H, cell: 10, angle: 75, seed: 6, value: (x, y) => smoothstep(380, 620, y) * 0.5 * (y < 640 ? 1 : 0) });
  const dome = `<path d="M${cx - dr} ${base}A${dr} ${dr} 0 0 1 ${cx + dr} ${base}Z" fill="${B}"/>
<rect x="${cx - dr - 14}" y="${base}" width="${2 * dr + 28}" height="${H - base}" fill="${B}"/>
<path d="M${cx - 30} ${base - dr + 8}L${cx + 30} ${base - dr + 8}L${cx + 24} ${base + 2}L${cx - 24} ${base + 2}Z" fill="${K}"/>`;
  const scope = `<path d="M${cx - 30} ${base - dr + 8}L${cx + 30} ${base - dr + 8}L${cx + 24} ${base + 2}L${cx - 24} ${base + 2}Z" fill="url(#dn-p)"/><rect x="${cx - 11}" y="${base - dr + 26}" width="22" height="92" transform="rotate(-22 ${cx} ${base - 30})" fill="${P}"/>`;
  const body = `${defs(screen('dn-p', P, { cell: 8, r: 2.4, angle: 75 }))}
${plate(`<path d="${sky}" fill="${B}"/>${stars}<path d="${ridgePath(far)}" fill="${B}"/>${dome}`)}
${pinkPlate(`<path d="${band}" fill="${P}"/><path d="${glow}" fill="${P}"/>${scope}<circle cx="190" cy="150" r="46" fill="${P}"/>`, W)}`;
  return svgFile({ w: W, h: H, title: '圆顶开缝，银河横过山脊上方', body });
}

export function summitRoad() {
  const far = ridge(7, 470, 200, 20);
  const near = ridge(11, 700, 150, 20);
  const top = far.reduce((m, p) => (p[1] < m[1] ? p : m), far[0]);
  const sky = dotField({ w: W, h: 560, cell: 11, angle: 75, seed: 8, value: (x, y) => 0.15 + (y / 560) * 0.8 });
  const farTint = dotField({ w: W, h: H, cell: 10, angle: 15, seed: 9, value: (x, y) => (y > at(far, x) ? 0.42 + 0.25 * fbm2(x / 120, y / 120, 3, 3) : 0) });
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const y = H + 20 - t * (H + 20 - top[1] - 8);
    const x = top[0] + Math.sin(t * Math.PI * 4.2) * (1 - t) * 260 + (1 - t) * 80;
    pts.push([x, y]);
  }
  const road = `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}`;
  const dome = `<path d="M${top[0] - 16} ${top[1] + 2}A16 16 0 0 1 ${top[0] + 16} ${top[1] + 2}Z" fill="${K}"/><path d="M${top[0] - 16} ${top[1] + 2}A16 16 0 0 1 ${top[0] + 16} ${top[1] + 2}" fill="none" stroke="${B}" stroke-width="3"/>`;
  const body = `${defs()}
${plate(`<path d="${farTint}" fill="${B}"/><path d="${ridgePath(near)}" fill="${B}"/><path d="${road}" fill="none" stroke="${K}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>${dome}`)}
${pinkPlate(`<path d="${sky}" fill="${P}"/><circle cx="260" cy="${f(at(far, 260) - 10)}" r="70" fill="${P}"/><path d="${road}" fill="none" stroke="${P}" stroke-width="2.5" stroke-dasharray="10 14"/>`, W)}`;
  return svgFile({ w: W, h: H, title: '盘山路的尽头，山顶的圆顶', body });
}

export function primaryMirror() {
  const cx = 560, cy = 420, r = 270;
  const disc = dotField({ w: W, h: H, cell: 11, angle: 15, seed: 12, value: (x, y) => {
    const d = Math.hypot(x - cx, y - cy) / r;
    return d > 1 ? 0 : 0.25 + 0.6 * d * d + 0.12 * Math.sin((x + y) / 40);
  } });
  const refl = dotField({ w: W, h: H, cell: 9, angle: 75, seed: 13, value: (x, y) => {
    const d = Math.hypot(x - cx, y - cy) / r;
    if (d > 0.97) return 0;
    const a = Math.hypot(x - (cx - 90), (y - (cy - 110)) * 1.6) / 120;
    const b = Math.hypot(x - (cx + 120), (y - (cy - 60)) * 1.6) / 80;
    return Math.max(0, 0.9 - a) + Math.max(0, 0.8 - b);
  } });
  const floor = Array.from({ length: 9 }, (_, i) => `<path d="M${600 + (i - 4) * 40} 690L${600 + (i - 4) * 220} ${H}" stroke="${B}" stroke-width="2.4"/>`).join('');
  const worker = (x, y, s, flip = 1) => `<g transform="translate(${x} ${y}) scale(${s * flip} ${s})" fill="${K}" stroke="${B}" stroke-width="${f(5 / s)}" stroke-linejoin="round">
<path d="M-40 0C-44 -80 -36 -150 0 -160C36 -150 44 -80 40 0Z"/><circle cx="0" cy="-190" r="34"/><path d="M-20 -196h40v16h-40z" fill="${B}"/><path d="M34 -120L86 -88"/></g>`;
  const lamps = [180, 420, 680, 940].map((x) => `<ellipse cx="${x}" cy="46" rx="58" ry="14" fill="${P}"/>`).join('');
  const body = `${defs()}
${plate(`<rect x="0" y="682" width="${W}" height="6" fill="${B}"/>${floor}<circle cx="${cx}" cy="${cy}" r="${r + 26}" fill="none" stroke="${B}" stroke-width="22"/><path d="${disc}" fill="${B}"/><rect x="${cx - 40}" y="${cy + r + 30}" width="80" height="${682 - cy - r - 30}" fill="${B}"/>${worker(920, 682, 1.15)}${worker(1060, 682, 1, -1)}${worker(210, 682, 1.1, -1)}`)}
${pinkPlate(`${lamps}<path d="${refl}" fill="${P}"/><circle cx="1000" cy="570" r="16" fill="${P}"/>`, W)}`;
  return svgFile({ w: W, h: H, title: '洁净室里的 1.6 米主镜与检修人员', body });
}

export function eyepieceNight() {
  const night = dotField({ w: W, h: H, cell: 10, angle: 15, seed: 21, value: (x, y) => 0.92 - 0.25 * smoothstep(0, H, y) });
  const glow = dotField({ w: W, h: H, cell: 9, angle: 75, seed: 22, value: (x, y) => {
    const a = Math.hypot(x - 760, y - 470) / 330;
    const beam = (() => { const dx = x - 920, dy = y - 430; const ang = Math.atan2(dy, dx); return dx < 0 && Math.abs(ang - Math.PI * 0.86) < 0.22 ? 0.8 * (1 - Math.hypot(dx, dy) / 520) : 0; })();
    return Math.max(0, 0.75 - a) + Math.max(0, beam);
  } });
  const tube = `<g transform="rotate(-28 420 420)"><rect x="80" y="330" width="560" height="150" fill="${B}"/><rect x="620" y="370" width="70" height="70" fill="${B}"/></g><path d="M420 470L360 ${H}M420 470L500 ${H}M420 470L430 ${H}" stroke="${B}" stroke-width="14"/>`;
  const visitor = `<path d="M690 ${H}L700 640C690 590 700 540 720 500C730 470 760 452 790 460C812 466 820 490 812 520L800 600L816 ${H}Z" fill="${K}"/><circle cx="752" cy="430" r="34" fill="${K}"/><path d="M700 ${H}L700 760M800 ${H}L806 770" stroke="${K}" stroke-width="10"/>`;
  const volunteer = `<path d="M900 ${H}L905 580C905 540 925 520 950 520C980 520 995 545 995 585L1000 ${H}Z" fill="${K}"/><circle cx="950" cy="486" r="32" fill="${K}"/><path d="M915 600L930 440" stroke="${K}" stroke-width="16" stroke-linecap="round"/>`;
  const rim = `<path d="M720 500C730 470 760 452 790 460" stroke="${P}" stroke-width="8" fill="none"/><circle cx="752" cy="430" r="34" fill="none" stroke="${P}" stroke-width="6" stroke-dasharray="60 160"/><circle cx="928" cy="432" r="14" fill="${P}"/>`;
  const body = `${defs()}
${plate(`<path d="${night}" fill="${B}"/>${tube}${visitor}${volunteer}`)}
${pinkPlate(`<path d="${glow}" fill="${P}"/>${rim}`, W)}`;
  return svgFile({ w: W, h: H, title: '观测夜，访客在目镜前观看', body });
}

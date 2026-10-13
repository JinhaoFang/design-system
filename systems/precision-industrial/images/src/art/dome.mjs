/*
 * dome-night (images/dome-night.svg, 1600x1000): elevation of the 10 m dome with the slit open at night, drawn as a technical illustration.
 * Upper half: a stippled night sky with the Milky Way as a denser diagonal band (deterministic noise), the ridge profile as one ink line.
 * Lower half: the dome in elevation (hemisphere on a cylindrical drum), the shutter slit open with the telescope tube rising through it on its fork mount, section hatch on the drum wall,
 * a centre line and a sourced diameter dimension (Ø 10 000 mm), and the caption strip text. No people. Signal orange marks only the slit opening edges.
 * Height and telescope proportions are schematic: no unsupported dimensions or print scale are claimed.
 * domeNight(P) -> svg body (without the file wrapper).
 */
import { f, rng, noise2 } from '../lib/random.mjs';
import { centerline, dimH, dimV, hatchDef, label } from '../lib/draft.mjs';

export function domeNight(P) {
  const W = 1600, H = 1000, cx = 800, base = 860, R = 300, drum = 150;
  const r = rng(29);
  let s = `<defs>${hatchDef('dn-h', P, 9)}</defs>`;
  let dots = '';
  for (let i = 0; i < 2600; i += 1) {
    const x = r() * W, y = r() * 520;
    const band = Math.exp(-(((y - (560 - x * 0.32)) / 120) ** 2));
    const n = noise2(x / 90, y / 90, 7);
    if (r() > 0.18 + band * 0.75 * (0.4 + n)) continue;
    const big = r() > 0.985;
    dots += `<circle cx="${f(x)}" cy="${f(y)}" r="${big ? 2.6 : f(0.7 + r() * 0.9)}"/>`;
  }
  s += `<g fill="${P['ink-2']}">${dots}</g>`;
  let ridge = `M0 ${base - 210}`;
  for (let x = 0; x <= W; x += 20) ridge += `L${x} ${f(base - 210 + Math.sin(x / 210) * 24 + noise2(x / 60, 3, 11) * 34 - (Math.abs(x - cx) < 420 ? 40 * Math.cos(((x - cx) / 420) * Math.PI / 2) : 0))}`;
  s += `<path d="${ridge}L${W} ${H}L0 ${H}Z" fill="${P.alu}"/><path d="${ridge}" fill="none" stroke="${P.ink}" stroke-width="1.6"/>`;
  const top = base - drum;
  s += `<rect x="${cx - R}" y="${top}" width="${R * 2}" height="${drum}" fill="${P['alu-light']}" stroke="${P.ink}" stroke-width="2"/>`;
  s += `<rect x="${cx - R}" y="${top}" width="22" height="${drum}" fill="url(#dn-h)" stroke="${P.ink}" stroke-width="1"/><rect x="${cx + R - 22}" y="${top}" width="22" height="${drum}" fill="url(#dn-h)" stroke="${P.ink}" stroke-width="1"/>`;
  s += `<path d="M${cx - R} ${top}A${R} ${R} 0 0 1 ${cx + R} ${top}Z" fill="${P['alu-light']}" stroke="${P.ink}" stroke-width="2"/>`;
  for (let k = 1; k < 6; k += 1) {
    const yy = top - R * Math.sin((k / 6) * Math.PI / 2), xx = R * Math.cos((k / 6) * Math.PI / 2);
    s += `<line x1="${f(cx - xx)}" y1="${f(yy)}" x2="${f(cx + xx)}" y2="${f(yy)}" stroke="${P.rule}" stroke-width="1"/>`;
  }
  const sw = 64;
  s += `<path d="M${cx - sw} ${top}V${f(top - Math.sqrt(R * R - sw * sw))}A${R} ${R} 0 0 1 ${cx + sw} ${f(top - Math.sqrt(R * R - sw * sw))}V${top}Z" fill="${P.alu}" stroke="${P.ink}" stroke-width="1.6"/>`;
  s += `<path d="M${cx - sw} ${top}V${f(top - Math.sqrt(R * R - sw * sw))}M${cx + sw} ${top}V${f(top - Math.sqrt(R * R - sw * sw))}" stroke="${P.signal}" stroke-width="3"/>`;
  s += `<g transform="rotate(-16 ${cx} ${top + 40})"><rect x="${cx - 34}" y="${top - 250}" width="68" height="300" fill="${P['alu-deep']}" stroke="${P.ink}" stroke-width="1.8"/><rect x="${cx - 40}" y="${top - 262}" width="80" height="18" fill="${P.ink}"/><line x1="${cx - 34}" y1="${top - 120}" x2="${cx + 34}" y2="${top - 120}" stroke="${P.ink}" stroke-width="1"/></g>`;
  s += `<path d="M${cx - 70} ${top + 120}L${cx - 50} ${top + 40}H${cx + 50}L${cx + 70} ${top + 120}Z" fill="${P['alu-deep']}" stroke="${P.ink}" stroke-width="1.6"/>`;
  s += `<rect x="${cx - 110}" y="${top + 120}" width="220" height="${drum - 120}" fill="url(#dn-h)" stroke="${P.ink}" stroke-width="1.2"/>`;
  s += centerline(cx, 120, cx, base + 40, P);
  s += `<line x1="0" y1="${base}" x2="${W}" y2="${base}" stroke="${P.ink}" stroke-width="2"/>`;
  s += dimH({ x1: cx - R, x2: cx + R, y: base + 70, from: base + 6, text: 'Ø 10 000 mm', P, size: 24 });
  s += label('DOME · ELEVATION · SLIT OPEN', { x: 60, y: base + 120, size: 20, fill: P['ink-2'] });
  s += label('SCHEMATIC / NTS', { x: W - 60, y: base + 120, size: 20, anchor: 'end', fill: P['ink-2'] });
  return { w: W, h: H, body: s };
}

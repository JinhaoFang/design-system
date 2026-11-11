/*
 * The five partner marks of the test content (images/mark-*.svg, 640x200, transparent ground) for oil-halftone: one ink colour, a small emblem drawn with 2px hairlines
 * and halftone dots (the system's sign for machines), and the name outlined in Noto Serif SC Light so the mark reads like a gallery label.
 *   mark-beizhu-univ   北渚大学天文系: a circle with the pole star over an islet line.
 *   mark-xingye-optics 星野光学仪器: a lens of two arcs and a halftone focus.
 *   mark-luxi-town     鹿溪镇人民政府: a square seal with three stream lines.
 *   mark-wandu-society 晚渡业余天文协会: an arch over a small ferry with a halftone star field.
 *   mark-jiahe-school  嘉禾中学天文社: an open book under a star.
 * marks(ink) -> { id: svg string }.
 */
import { textPath } from '../lib/glyphs.mjs';

const W = 640, H = 200;
const r2 = (n) => Math.round(n * 100) / 100;
const dots = (cx, cy, radius, ink, step = 7) => {
  const out = [];
  for (let y = cy - radius; y <= cy + radius; y += step) for (let x = cx - radius; x <= cx + radius; x += step) {
    const d = Math.hypot(x - cx, y - cy) / radius;
    if (d < 1) out.push(`<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(2.8 * (1 - d) + 0.4)}" fill="${ink}"/>`);
  }
  return out.join('');
};
const star = (x, y, r, ink) => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.42 : r;
    pts.push(`${r2(x + rr * Math.cos(a))} ${r2(y + rr * Math.sin(a))}`);
  }
  return `<path d="M${pts.join('L')}Z" fill="${ink}"/>`;
};
const file = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${body}</svg>\n`;
const name = (text, ink) => textPath(text, { font: 'serif300', size: 46, x: 190, y: 118, fill: ink, track: -0.02 }).svg;

export function marks(ink) {
  const line = `fill="none" stroke="${ink}" stroke-width="2"`;
  return {
    'mark-beizhu-univ': file(`<circle cx="96" cy="100" r="62" ${line}/>${star(96, 76, 16, ink)}<path d="M54 122 Q96 104 138 122" ${line}/><path d="M66 136 H126" ${line}/>${name('北渚大学天文系', ink)}`),
    'mark-xingye-optics': file(`<path d="M70 40 Q40 100 70 160" ${line}/><path d="M70 40 Q100 100 70 160" ${line}/><path d="M70 100 H150" ${line} stroke-dasharray="4 6"/>${dots(150, 100, 22, ink)}${name('星野光学仪器', ink)}`),
    'mark-luxi-town': file(`<rect x="40" y="44" width="112" height="112" ${line}/><path d="M56 88 Q76 78 96 88 T136 88 M56 108 Q76 98 96 108 T136 108 M56 128 Q76 118 96 128 T136 128" ${line}/>${name('鹿溪镇人民政府', ink)}`),
    'mark-wandu-society': file(`<path d="M40 150 V100 A56 56 0 0 1 152 100 V150" ${line}/>${dots(96, 86, 26, ink, 8)}<path d="M64 138 H128 L118 150 H74 Z" fill="${ink}"/><path d="M48 156 Q72 150 96 156 T144 156" ${line}/>${name('晚渡业余天文协会', ink)}`),
    'mark-jiahe-school': file(`${star(96, 60, 18, ink)}<path d="M40 150 Q68 132 96 146 Q124 132 152 150 V104 Q124 88 96 102 Q68 88 40 104 Z" ${line}/><path d="M96 102 V146" ${line}/>${name('嘉禾中学天文社', ink)}`),
  };
}

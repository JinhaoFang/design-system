/*
 * The five partner marks of the test content (images/mark-*.svg, 640x200, transparent ground) for cut-paper: each emblem is two or three hand-cut gouache shapes in one leaf colour,
 * and the name is outlined Noto Sans SC Regular in ink, so the mark reads like a paper label stuck next to a cut-out.
 *   mark-beizhu-univ   北渚大学天文系: a cobalt disc with a cut star window.
 *   mark-xingye-optics 星野光学仪器: two pine lens halves.
 *   mark-luxi-town     鹿溪镇人民政府: a vermilion leaf over three stream strips.
 *   mark-wandu-society 晚渡业余天文协会: an indigo boat with a mustard star.
 *   mark-jiahe-school  嘉禾中学天文社: a sprout ear of rice made of five leaves.
 * marks(colors) -> { id: svg string }; colors maps token names to hex.
 */
import { textPath } from '../lib/glyphs.mjs';
import { leafPath } from '../lib/leaves.mjs';

const W = 640, H = 200;
const file = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${body}</svg>\n`;
const leafAt = (species, seed, x, y, s, angle, fill) => `<path transform="translate(${x} ${y}) scale(${s}) rotate(${angle} 0 -50)" d="${leafPath(species, seed).d}" fill="${fill}" fill-rule="evenodd"/>`;
const star = (x, y, r) => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${Math.round((x + rr * Math.cos(a)) * 10) / 10} ${Math.round((y + rr * Math.sin(a)) * 10) / 10}`);
  }
  return `M${pts.join('L')}Z`;
};

export function marks(c) {
  const name = (text) => textPath(text, { font: 'sans400', size: 40, x: 184, y: 114, fill: c.ink }).svg;
  return {
    'mark-beizhu-univ': file(`<path d="M96 38a62 62 0 1 1 0 124a62 62 0 1 1 0-124Z${star(96, 96, 30)}" fill="${c.cobalt}" fill-rule="evenodd"/>${name('北渚大学天文系')}`),
    'mark-xingye-optics': file(`<path d="M86 36 C54 64 54 136 86 164 C98 130 98 70 86 36Z" fill="${c.pine}"/><path d="M106 36 C138 64 138 136 106 164 C94 130 94 70 106 36Z" fill="${c.pine}"/>${name('星野光学仪器')}`),
    'mark-luxi-town': file(`${leafAt('maple', 3, 96, 126, 0.9, 0, c.vermilion)}<path d="M40 140 C70 132 110 148 150 138 L150 148 C110 158 70 142 40 150Z M48 158 C76 152 112 166 144 158 L144 166 C112 174 76 160 48 166Z" fill="${c.vermilion}"/>${name('鹿溪镇人民政府')}`),
    'mark-wandu-society': file(`<path d="M42 120 H150 C140 146 120 156 96 156 C72 156 52 146 42 120Z" fill="${c.indigo}"/><path d="M92 120 V60 L128 112Z" fill="${c.indigo}"/><path d="${star(60, 66, 18)}" fill="${c.mustard}"/>${name('晚渡业余天文协会')}`),
    'mark-jiahe-school': file(`<path d="M95 170 C96 130 98 90 104 40" fill="none" stroke="${c.sprout}" stroke-width="5" stroke-linecap="round"/>${[[100, 70, -30], [104, 92, 35], [99, 112, -32], [102, 132, 34], [98, 152, -30]].map(([x, y, a], i) => leafAt('eucalyptus', i + 1, x, y, 0.42, a, c.sprout)).join('')}${name('嘉禾中学天文社')}`),
  };
}

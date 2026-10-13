/*
 * The five partner marks of riso-print (images/mark-*.svg, 640x240, transparent ground) as two-drum stamps: a geometric emblem whose solid parts are blue and whose one accent is pink
 * (overprinting to purple where they meet), with the name set in outlined Noto Sans SC bold in blue. No outlines thinner than the stencil can hold.
 *   mark-beizhu-univ   北渚大学天文系: a round seal, pole star over an islet and two wave bars.
 *   mark-xingye-optics 星野光学仪器: a lens (two arcs) with three converging rays to a pink focus dot.
 *   mark-luxi-town     鹿溪镇人民政府: a roundel with a stag's antlers over three stream lines.
 *   mark-wandu-society 晚渡业余天文协会: an arch with a small ferry and a pink star above the water.
 *   mark-jiahe-school  嘉禾中学天文社: an open book under a pink star, flanked by two rice-ear strokes.
 * marks() -> { id: svg string }.
 */
import { textPath } from '../lib/glyphs.mjs';
import { HEX, defs, pinkPlate, plate, svgFile } from '../lib/plate.mjs';

const B = HEX.blue, P = HEX.pink, K = HEX.paper;
const W = 640, H = 240;
const star = (x, y, r, fill) => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.42 : r;
    pts.push(`${(x + rr * Math.cos(a)).toFixed(1)} ${(y + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `<path d="M${pts.join('L')}Z" fill="${fill}"/>`;
};

function mark(title, emblemBlue, emblemPink, lines) {
  const text = lines.map(([s, size, y]) => textPath(s, { font: 'sans700', size, x: 230, y, track: 0.06, fill: B }).svg).join('');
  const body = `${defs()}${plate(`${emblemBlue}${text}`)}${pinkPlate(emblemPink, W)}`;
  return svgFile({ w: W, h: H, title, body });
}

export function marks() {
  return {
    'mark-beizhu-univ': mark('北渚大学天文系标识',
      `<circle cx="120" cy="120" r="92" fill="none" stroke="${B}" stroke-width="12"/><path d="M60 150h120v12H60zM74 172h92v10H74z" fill="${B}"/><path d="M84 146c10-30 62-30 72 0z" fill="${B}"/>`,
      star(120, 82, 26, P),
      [['北渚大学', 52, 118], ['天文系', 36, 172]]),
    'mark-xingye-optics': mark('星野光学仪器标识',
      `<path d="M100 40c-40 50-40 110 0 160c40-50 40-110 0-160z" fill="${B}"/><path d="M110 80L190 120L110 160M110 120H190" stroke="${B}" stroke-width="8" fill="none"/>`,
      `<circle cx="196" cy="120" r="14" fill="${P}"/>`,
      [['星野光学', 56, 118], ['仪器', 36, 172]]),
    'mark-luxi-town': mark('鹿溪镇人民政府标识',
      `<circle cx="120" cy="120" r="94" fill="${B}"/><path d="M120 138V96M120 96L92 62M120 96L148 62M104 80L86 84M136 80L154 84" stroke="${K}" stroke-width="10" stroke-linecap="round" fill="none"/><path d="M66 160h108M78 178h84" stroke="${K}" stroke-width="8"/>`,
      `<circle cx="120" cy="120" r="94" fill="none" stroke="${P}" stroke-width="10"/>`,
      [['鹿溪镇', 56, 118], ['人民政府', 36, 172]]),
    'mark-wandu-society': mark('晚渡业余天文协会标识',
      `<path d="M40 210V110a80 80 0 0 1 160 0v100z" fill="none" stroke="${B}" stroke-width="12"/><path d="M70 170h100l-16 22H86z" fill="${B}"/><path d="M118 170V122l30 40z" fill="${B}"/><path d="M52 200h136" stroke="${B}" stroke-width="8"/>`,
      star(120, 86, 22, P),
      [['晚渡业余', 52, 118], ['天文协会', 36, 172]]),
    'mark-jiahe-school': mark('嘉禾中学天文社标识',
      `<path d="M50 150q70-24 70 6q0-30 70-6v44q-70-24-70 6q0-30-70-6z" fill="${B}"/><path d="M36 190Q30 110 70 60M204 190Q210 110 170 60" stroke="${B}" stroke-width="9" fill="none" stroke-linecap="round"/>`,
      star(120, 90, 30, P),
      [['嘉禾中学', 52, 118], ['天文社', 36, 172]]),
  };
}

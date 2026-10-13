/*
 * The four partner marks of the riso-print showcase「纱厂屋顶 · 秋夜露天电影季」(images/mark-*.svg, 640x240, transparent ground), single blue ink like every partner mark of the system (SYSTEM.md 图像与画风).
 *   mark-nanan-street   南岸街道社区中心: a roundel with three roofs of a lane over a river line.
 *   mark-erhao-press    二号孔版工作室: two offset drums (circles) on a feed tray, the system's own printing gesture.
 *   mark-shiye-books    拾页书店: an open book whose right page lifts like a turned leaf.
 *   mark-mill-park      南岸纱厂文创园: the mill's sawtooth roof with its chimney.
 * All organisations are fictional. Names are outlined from Noto Sans SC bold through lib/glyphs.mjs, so the marks need the font cache. cinemaMarks() -> { id: svg string }.
 */
import { textPath } from '../lib/glyphs.mjs';
import { HEX, defs, plate, svgFile } from '../lib/plate.mjs';

const B = HEX.blue, K = HEX.paper;
const W = 640, H = 240;

function mark(title, emblem, lines) {
  const text = lines.map(([s, size, y]) => textPath(s, { font: 'sans700', size, x: 230, y, track: 0.06, fill: B }).svg).join('');
  return svgFile({ w: W, h: H, title, body: `${defs()}${plate(`${emblem}${text}`)}` });
}

export function cinemaMarks() {
  return {
    'mark-nanan-street': mark('南岸街道社区中心标识',
      `<circle cx="120" cy="120" r="94" fill="${B}"/><path d="M58 128l22-24 22 24zM98 128l22-28 22 28zM138 128l22-24 22 24z" fill="${K}"/><path d="M58 128h124v14H58z" fill="${K}"/><path d="M62 164q14-10 29 0t29 0 29 0 29 0" stroke="${K}" stroke-width="9" fill="none" stroke-linecap="round"/>`,
      [['南岸街道', 52, 118], ['社区中心', 36, 172]]),
    'mark-erhao-press': mark('二号孔版工作室标识',
      `<circle cx="92" cy="104" r="54" fill="none" stroke="${B}" stroke-width="14"/><circle cx="148" cy="104" r="54" fill="none" stroke="${B}" stroke-width="14"/><path d="M34 190h172v16H34z" fill="${B}"/><path d="M60 172h120" stroke="${B}" stroke-width="8"/>`,
      [['二号孔版', 52, 118], ['工作室', 36, 172]]),
    'mark-shiye-books': mark('拾页书店标识',
      `<path d="M30 70q50-18 90 8v122q-40-26-90-8z" fill="${B}"/><path d="M128 78q30-30 82-24l-14 122q-40-6-68 24z" fill="none" stroke="${B}" stroke-width="12" stroke-linejoin="round"/><path d="M146 110l44-6M144 140l42-6" stroke="${B}" stroke-width="8" stroke-linecap="round"/>`,
      [['拾页书店', 56, 118], ['SHIYE BOOKS', 30, 172]]),
    'mark-mill-park': mark('南岸纱厂文创园标识',
      `<path d="M150 30h26v102h-26z" fill="${B}"/><path d="M28 206V132l40-30v30l40-30v30l40-30v30l40-30v104z" fill="${B}"/><path d="M50 160h22v28H50zM96 160h22v28H96zM142 160h22v28h-22z" fill="${K}"/>`,
      [['南岸纱厂', 52, 118], ['文创园', 36, 172]]),
  };
}

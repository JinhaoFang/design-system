/*
 * Drafting primitives shared by the precision-industrial drawings, in the vocabulary of an engineering sheet: every function takes the palette P (HEX for standalone files, VAR for inline fragments) and returns SVG markup.
 *   svgFile({w, h, title, body, P}) wraps a standalone image on the aluminium ground (no frame: the page supplies crop marks and the caption strip).
 *   hatchDef(id, P, gap) a 45-degree section-hatch pattern; centerline(x1, y1, x2, y2, P) the long-short dash line; cross(x, y, r, P) a registration crosshair.
 *   dimH / dimV draw a dimension with extension lines, filled arrowheads and an outlined mono label; scaleBar draws a graduated bar with its units; label(str, opts) is a mono outline label.
 * Sizes are in drawing units (the viewBox), labels are outlined through glyphs.mjs so files never depend on page fonts.
 */
import { f } from './random.mjs';
import { textPath, measure } from './glyphs.mjs';

export function svgFile({ w, h, title, body, P }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img">\n<title>${title}</title>\n<rect width="${w}" height="${h}" fill="${P.alu}"/>\n${body}\n</svg>\n`;
}

export const hatchDef = (id, P, gap = 10, color = P['ink-2']) =>
  `<pattern id="${id}" width="${gap}" height="${gap}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="${gap}" stroke="${color}" stroke-width="1"/></pattern>`;

export const centerline = (x1, y1, x2, y2, P, w = 1) =>
  `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${P['ink-2']}" stroke-width="${w}" stroke-dasharray="22 5 4 5"/>`;

export const cross = (x, y, r, P, color = P['ink-2']) =>
  `<path d="M${f(x - r)} ${f(y)}H${f(x + r)}M${f(x)} ${f(y - r)}V${f(y + r)}" stroke="${color}" stroke-width="1"/>`;

export function label(str, { x, y, size = 20, anchor = 'start', font = 'mono400', fill, track = 0.04 }) {
  const runs = str.match(/[0-9][0-9.,]*|[^0-9]+/g) ?? [];
  const fonts = runs.map((run) => /^[0-9]/.test(run) ? 'num500' : font);
  const widths = runs.map((run, index) => measure(run, fonts[index], size, track));
  const total = widths.reduce((sum, width) => sum + width, 0);
  let cursor = anchor === 'middle' ? x - total / 2 : anchor === 'end' ? x - total : x;
  return runs.map((run, index) => {
    const svg = textPath(run, { font: fonts[index], size, x: cursor, y, track, fill }).svg;
    cursor += widths[index];
    return svg;
  }).join('');
}

const arrow = (x, y, dx, dy, s, fill) => {
  const nx = -dy, ny = dx;
  return `<path d="M${f(x)} ${f(y)}L${f(x - dx * s * 2.6 + nx * s * 0.75)} ${f(y - dy * s * 2.6 + ny * s * 0.75)}L${f(x - dx * s * 2.6 - nx * s * 0.75)} ${f(y - dy * s * 2.6 - ny * s * 0.75)}Z" fill="${fill}"/>`;
};

export function dimH({ x1, x2, y, from, text, P, size = 20, color = P.ink, s = 6 }) {
  let out = '';
  if (from !== undefined) out += `<path d="M${f(x1)} ${f(from)}V${f(y + s * 2)}M${f(x2)} ${f(from)}V${f(y + s * 2)}" stroke="${color}" stroke-width="0.8"/>`;
  out += `<line x1="${f(x1)}" y1="${f(y)}" x2="${f(x2)}" y2="${f(y)}" stroke="${color}" stroke-width="1"/>`;
  out += arrow(x1, y, -1, 0, s, color) + arrow(x2, y, 1, 0, s, color);
  if (text) out += label(text, { x: (x1 + x2) / 2, y: y - s * 1.6, size, anchor: 'middle', fill: color });
  return out;
}

export function dimV({ y1, y2, x, from, text, P, size = 20, color = P.ink, s = 6, side = 'right' }) {
  let out = '';
  if (from !== undefined) out += `<path d="M${f(from)} ${f(y1)}H${f(x + (side === 'right' ? s * 2 : -s * 2))}M${f(from)} ${f(y2)}H${f(x + (side === 'right' ? s * 2 : -s * 2))}" stroke="${color}" stroke-width="0.8"/>`;
  out += `<line x1="${f(x)}" y1="${f(y1)}" x2="${f(x)}" y2="${f(y2)}" stroke="${color}" stroke-width="1"/>`;
  out += arrow(x, y1, 0, -1, s, color) + arrow(x, y2, 0, 1, s, color);
  if (text) out += label(text, { x: side === 'right' ? x + s * 2.4 : x - s * 2.4, y: (y1 + y2) / 2 + size * 0.35, size, anchor: side === 'right' ? 'start' : 'end', fill: color });
  return out;
}

export function scaleBar({ x, y, len, steps, unit, P, size = 18 }) {
  let out = `<rect x="${f(x)}" y="${f(y)}" width="${f(len)}" height="6" fill="none" stroke="${P.ink}" stroke-width="1"/>`;
  for (let i = 0; i < steps; i += 2) out += `<rect x="${f(x + (len / steps) * i)}" y="${f(y)}" width="${f(len / steps)}" height="6" fill="${P.ink}"/>`;
  out += label('0', { x, y: y + 6 + size * 1.3, size, anchor: 'middle', fill: P['ink-2'] });
  out += label(unit, { x: x + len, y: y + 6 + size * 1.3, size, anchor: 'middle', fill: P['ink-2'] });
  return out;
}

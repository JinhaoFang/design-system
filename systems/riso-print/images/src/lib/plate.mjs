/*
 * Two-drum riso plates for the riso-print drawings. Colours come from the system's token file (pink, blue, paper, purple), so a picture can only ever use the two inks and the paper.
 * HEX: hex values by role. MISREG: zero for standard scenes. The opening title owns the one-per-screen misregistration budget; its CSS uses web space-1 and half that step.
 * screen(id, color, {cell, r, angle}) -> <pattern> of round dots: a flat tint of one ink. Blue screens run at 15°, pink at 75°, so the two never moiré into a grid.
 * dotField({w, h, cell, angle, color, value(x, y) -> 0..1, seed}) -> path data of dots whose radius follows value: a halftone gradient (the coverage of a cell is value).
 * plate(color, body, {dx, dy}) wraps one drum's shapes in a multiply group with the slight edge wobble of a stencil (#rp-rough); overlaps of the two plates read as purple.
 * defs(...patterns) adds the shared filter; svgFile({w, h, title, body}) writes a standalone SVG with a transparent ground (the page paper shows through, as on a print).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { f, rng } from './random.mjs';

const tokens = JSON.parse(readFileSync(fileURLToPath(new URL('../../../system.tokens.json', import.meta.url)), 'utf8'));
export const HEX = Object.fromEntries(Object.entries(tokens.color).filter(([key]) => !key.startsWith('$')).map(([key, value]) => [key, value.$value.hex]));

export const MISREG = { dx: 0, dy: 0 };

export const screen = (id, color, { cell = 10, r = 3.4, angle = 15 } = {}) =>
  `<pattern id="${id}" width="${cell}" height="${cell}" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})"><circle cx="${cell / 2}" cy="${cell / 2}" r="${r}" fill="${color}"/></pattern>`;

export function dotField({ w, h, cell = 12, angle = 15, value, seed = 1, x0 = 0, y0 = 0 }) {
  const R = rng(seed);
  const a = (angle * Math.PI) / 180;
  const ca = Math.cos(a), sa = Math.sin(a);
  const span = Math.hypot(w, h);
  const parts = [];
  for (let u = -span; u < span; u += cell) {
    for (let v = -span; v < span; v += cell) {
      const x = w / 2 + u * ca - v * sa, y = h / 2 + u * sa + v * ca;
      if (x < -cell || y < -cell || x > w + cell || y > h + cell) continue;
      const t = value(x, y);
      if (t <= 0.02) continue;
      const r = Math.min(cell * 0.62, (cell / 2) * Math.sqrt(Math.min(1, t)) * (0.96 + R() * 0.08) * 1.13);
      parts.push(`M${f(x0 + x - r)} ${f(y0 + y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`);
    }
  }
  return parts.join('');
}

export const ROUGH = '<filter id="rp-rough" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="5" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.8"/></filter>';

export const plate = (body, { dx = 0, dy = 0 } = {}) => `<g style="mix-blend-mode:multiply" transform="translate(${f(dx)} ${f(dy)})" filter="url(#rp-rough)">${body}</g>`;

export const pinkPlate = (body, w) => plate(body, { dx: (MISREG.dx * w) / 1000, dy: (MISREG.dy * w) / 1000 });

export const defs = (...items) => `<defs>${ROUGH}${items.join('')}</defs>`;

export const svgFile = ({ w, h, title, body }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img"><title>${title}</title><g style="isolation:isolate">${body}</g></svg>\n`;

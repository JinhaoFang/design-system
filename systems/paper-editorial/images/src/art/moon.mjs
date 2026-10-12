/*
 * Moon phases computed from real dates, drawn in code.
 * moonAge(y, m, d) -> age in days since new moon at 13:00 UTC on that date (evening in China), from the new moon of 2026-11-09 07:00 UTC and the mean synodic month 29.530589 days.
 * NIGHTS: the eight public observing nights (2026-11-21 and 28, 2026-12-19 and 26, 2027-01-16 and 23, 2027-02-20 and 27) from library/content/SETTING.md.
 * moonGlyph({age, r, P, id}) -> SVG fragment centred on 0,0: dark disc in ink, lit part in paper bounded by the terminator ellipse, a few maria dots in the lit part (clipped), thin outline.
 *   Waxing moons are lit on the right, waning on the left (northern hemisphere view).
 */
import { f, rng } from '../lib/random.mjs';

const SYNODIC = 29.530589;
const NEW_MOON = Date.UTC(2026, 10, 9, 7);

export const NIGHTS = [[2026, 11, 21], [2026, 11, 28], [2026, 12, 19], [2026, 12, 26], [2027, 1, 16], [2027, 1, 23], [2027, 2, 20], [2027, 2, 27]];

export const moonAge = (y, m, d) => ((((Date.UTC(y, m - 1, d, 13) - NEW_MOON) / 86400000) % SYNODIC) + SYNODIC) % SYNODIC;

export function moonGlyph({ age, r, P, id }) {
  const p = age / SYNODIC;
  const rx = f(r * Math.abs(Math.cos(p * Math.PI * 2)));
  let d;
  if (p < 0.5) d = `M0 ${-r} A${r} ${r} 0 0 1 0 ${r} A${rx} ${r} 0 0 ${p < 0.25 ? 0 : 1} 0 ${-r}Z`;
  else d = `M0 ${-r} A${r} ${r} 0 0 0 0 ${r} A${rx} ${r} 0 0 ${p < 0.75 ? 0 : 1} 0 ${-r}Z`;
  const rand = rng(Math.round(age * 100) + 7);
  let dots = '';
  for (let i = 0; i < 16; i += 1) {
    const a = rand() * Math.PI * 2;
    const rr = Math.sqrt(rand()) * r * 0.85;
    dots += `<circle cx="${f(Math.cos(a) * rr)}" cy="${f(Math.sin(a) * rr)}" r="${f(r * (0.04 + rand() * 0.1))}"/>`;
  }
  return `<clipPath id="${id}"><path d="${d}"/></clipPath><circle r="${r}" fill="${P.ink}"/><path d="${d}" fill="${P.paper}"/><g clip-path="url(#${id})" fill="${P['paper-shade']}">${dots}</g><circle r="${r}" fill="none" stroke="${P.ink}" stroke-width="${f(Math.max(1, r * 0.05))}"/>`;
}

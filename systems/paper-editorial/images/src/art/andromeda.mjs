/*
 * Stipple plate of the Andromeda galaxy (M31) for the square standard sample.
 * andromedaPlate({w, h, P, seed}) -> inline <svg> with a hairline plate frame. The galaxy is an inclined disc (long axis about 3.3 times the short axis, position angle 35 degrees, rising to the right)
 * drawn only with ink dots: a dense bulge, a disc whose density follows a logarithmic spiral modulation, a dust lane on the near side that removes dots, the compact companion M32 below the disc
 * and the diffuse companion M110 beyond its far end, plus a sparse field of foreground stars with a few cross-ticked bright ones. No colour beyond ink: the plate is evidence, not decoration.
 * Dots are packed into a few <path> elements (lib/dots.mjs); the drawing is deterministic.
 */
import { rng, smoothstep } from '../lib/random.mjs';
import { dotsPath, starCross } from '../lib/dots.mjs';

export function andromedaPlate({ w = 400, h = 340, P, seed = 17 }) {
  const rand = rng(seed);
  const cx = w * 0.5;
  const cy = h * 0.52;
  const a = w * 0.42;
  const b = a / 3.3;
  const pa = (-35 * Math.PI) / 180;
  const cosA = Math.cos(pa);
  const sinA = Math.sin(pa);
  const toLocal = (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    return [dx * cosA + dy * sinA, -dx * sinA + dy * cosA];
  };
  const pts = [];
  let tries = 0;
  while (pts.length < 11000 && tries < 900000) {
    tries += 1;
    const x = 8 + rand() * (w - 16);
    const y = 8 + rand() * (h - 16);
    const [u, v] = toLocal(x, y);
    const re = Math.hypot(u / a, v / b);
    const rho = Math.hypot(u, v * (a / b));
    const theta = Math.atan2(v * (a / b), u);
    const spiral = 0.55 + 0.45 * Math.cos(2 * (theta - 3.1 * Math.log(rho + 4)));
    const bulge = Math.exp(-Math.pow(rho / (a * 0.09), 1.1)) * 1.6;
    const disc = Math.exp(-re / 0.42) * spiral * 1.0 * smoothstep(0, 0.12, re);
    const dust = 1 - 0.85 * Math.exp(-Math.pow((v - b * 0.34) / (b * 0.07), 2)) * smoothstep(0.1, 0.45, re) * (1 - smoothstep(0.7, 1.0, re));
    const halo = Math.exp(-re / 1.1) * 0.1;
    const m32 = Math.exp(-(Math.pow(x - (cx - 28), 2) + Math.pow(y - (cy + 56), 2)) / (2 * 6 * 6)) * 1.6;
    const m110 = Math.exp(-(Math.pow((x - (cx + 118)) / 28, 2) + Math.pow((y - (cy - 66)) / 14, 2))) * 0.38;
    const field = 0.005;
    const p = ((bulge + disc + halo) * dust + m32 + m110 + field) * 1.05;
    if (rand() > Math.min(1, p)) continue;
    const core = bulge + m32;
    pts.push([x, y, 0.85 + Math.pow(rand(), 3) * 1.1 + core * 0.15]);
  }
  const crosses = [[48, 60, 7], [338, 280, 6], [86, 286, 5], [356, 52, 5]].map(([x, y, s]) => starCross(x, y, s, P.ink, 0.9)).join('');
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="仙女星系的点描图版"><rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="none" stroke="${P['ink-3']}" stroke-width="1.2"/>${dotsPath(pts, { color: P.ink, buckets: [0.9, 1.3, 1.8, 2.4] })}${crosses}</svg>`;
}

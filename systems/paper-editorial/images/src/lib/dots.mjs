/*
 * Stipple helpers. dotsPath(points, {color, widths, opacity}) packs many dots into a few <path> elements: each dot is a zero-length round-capped subpath (`M x y h0`),
 * grouped by diameter bucket, which keeps the SVG small and renders as crisp ink points. points are [x, y, d] with d the dot diameter in px.
 * starCross(x, y, size, color, width) is a four-point diffraction cross for a few bright stars.
 */
import { f } from './random.mjs';

export function dotsPath(points, { color, buckets = [0.9, 1.3, 1.8, 2.5], opacity = 1 }) {
  const groups = buckets.map(() => []);
  for (const [x, y, d] of points) {
    let k = 0;
    while (k < buckets.length - 1 && d > (buckets[k] + buckets[k + 1]) / 2) k += 1;
    groups[k].push(`M${f(x)} ${f(y)}h0`);
  }
  const o = opacity === 1 ? '' : ` opacity="${opacity}"`;
  return groups
    .map((g, k) => (g.length ? `<path d="${g.join('')}" fill="none" stroke="${color}" stroke-width="${buckets[k]}" stroke-linecap="round"${o}/>` : ''))
    .join('');
}

export const starCross = (x, y, size, color, width = 0.9) =>
  `<g stroke="${color}" stroke-width="${width}" stroke-linecap="round"><path d="M${f(x - size)} ${f(y)}H${f(x + size)}M${f(x)} ${f(y - size)}V${f(y + size)}"/></g><circle cx="${f(x)}" cy="${f(y)}" r="${f(size * 0.16)}" fill="${color}"/>`;

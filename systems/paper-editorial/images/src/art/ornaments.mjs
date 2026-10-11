/*
 * Small printed ornaments of the system, as SVG/HTML strings for the fragments.
 * brushStroke({w, h, T, seed, fill, tilt}) -> inline <svg>: the vermilion hand-brushed underline (识别符号). A filled, tapered shape rather than a constant-width stroke:
 *   it starts with a quick blunt press, swells slightly, then thins to a light flick at the end; the centre line rises and falls a little and the edges carry a small wobble.
 *   Width w and height h are CSS pixels (the SVG is sized to them, or with fluid: true stretched to the width of its container at height h); T is the maximum thickness (the system allows 4 to 8 px).
 * yuwei({w, fill}) -> inline <svg>: the small black fish-tail mark used beside titles (path from the direction prototype, viewBox 24x16); up flips it.
 * roughFilter(id) -> a zero-size <svg> holding the feTurbulence + feDisplacementMap edge filter, with ink-holes, that gives seals their slightly worn edge.
 */
import { f, noise2, smoothPath } from '../lib/random.mjs';

export function brushStroke({ w, h = 24, T = 7, seed = 3, fill, tilt = -0.012, fluid = false }) {
  const n = 40;
  const top = [];
  const bottom = [];
  for (let i = 0; i <= n; i += 1) {
    const u = i / n;
    const x = u * (w - 6) + 3;
    const sway = Math.sin((u * 1.15 + seed * 0.37) * Math.PI * 2) * h * 0.1 + (noise2(u * 5, seed, seed) - 0.5) * h * 0.16;
    const yc = h / 2 + sway + (u - 0.5) * w * tilt;
    const press = 1 - Math.exp(-u * 26);
    const lift = Math.pow(Math.max(0, 1 - Math.pow(u, 2.4)), 0.7);
    const swell = 0.82 + 0.18 * Math.sin(u * Math.PI);
    const t = Math.max(0.5, T * press * lift * swell + (noise2(u * 14, seed + 4, seed) - 0.5) * T * 0.16);
    top.push([x, yc - t * 0.55]);
    bottom.push([x, yc + t * 0.45]);
  }
  const d = `${smoothPath(top)}L${f(bottom[n][0])} ${f(bottom[n][1])}${smoothPath(bottom.slice().reverse()).replace(/^M[^C]*/, '')}Z`;
  const size = fluid ? `width="100%" height="${h}" preserveAspectRatio="none"` : `width="${w}" height="${h}"`;
  return `<svg ${size} viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" fill="${fill}"/></svg>`;
}

export function yuwei({ w = 24, fill, up = false }) {
  const h = (w * 16) / 24;
  const flip = up ? ' transform="translate(0 16) scale(1 -1)"' : '';
  return `<svg width="${w}" height="${f(h)}" viewBox="0 0 24 16" aria-hidden="true"><path${flip} d="M0 0H24V10L17 5.5L12 11.5L7 5.5L0 10Z" fill="${fill}"/></svg>`;
}

export function roughFilter(id) {
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="${id}" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="2.4" result="d"/><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="2" seed="9" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.1 1.92" result="holes"/><feComposite in="d" in2="holes" operator="in"/></filter></svg>`;
}

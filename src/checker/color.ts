/*
 * Color math for rules, done in Node on the computed-color strings Chromium returns (rgb()/rgba() for legacy input; oklch/lab/color(...) stay in their own space).
 * parseColor -> culori color (alpha 0 for transparent); colorDistance = Euclidean distance in OKLab (alpha ignored), so a hex/rgb notation of a token and its oklch form compare equal within rounding.
 * flatten composites translucent layers over an opaque base in sRGB (gamut-clamped); contrastRatio is the WCAG 2 relative-luminance ratio of two opaque colors, never rounded.
 * isLargeText follows WCAG large-scale text: >= 24px, or >= 18.66px (14pt) at weight >= 700; CJK uses the same numbers (WCAG gives none).
 */
import { clampRgb, converter, parse, wcagContrast } from 'culori';
import type { Color, Rgb } from 'culori';

const toOklab = converter('oklab');
const toRgb = converter('rgb');

export const WHITE: Rgb = { mode: 'rgb', r: 1, g: 1, b: 1 };

export function parseColor(css: string): Color | undefined {
  return parse(css.trim());
}

export function alphaOf(color: Color): number {
  return color.alpha ?? 1;
}

export function colorDistance(a: Color, b: Color): number {
  const x = toOklab(a);
  const y = toOklab(b);
  return Math.hypot((x.l ?? 0) - (y.l ?? 0), (x.a ?? 0) - (y.a ?? 0), (x.b ?? 0) - (y.b ?? 0));
}

function srgb(color: Color): Rgb {
  const { r, g, b } = clampRgb(toRgb(color));
  return { mode: 'rgb', r, g, b };
}

export function flatten(layers: Color[], base: Rgb = WHITE): Rgb {
  let result = base;
  for (const layer of layers) {
    const alpha = alphaOf(layer);
    const top = srgb(layer);
    result = {
      mode: 'rgb',
      r: top.r * alpha + result.r * (1 - alpha),
      g: top.g * alpha + result.g * (1 - alpha),
      b: top.b * alpha + result.b * (1 - alpha),
    };
  }
  return result;
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  return wcagContrast(a, b);
}

export function isLargeText(fontSizePx: number, fontWeight: number): boolean {
  return fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700);
}

/*
 * The values a work may use, derived from the resolved per-carrier tokens (ratio x base already applied): systemColors (color.* tokens plus the colors inside shadow.* tokens),
 * and systemPx for the px ladders --ds-type-*, --ds-space-*, --ds-radius-*. SIZE_TOLERANCE_PX is the +-0.5px tolerance; COLOR_TOLERANCE is the OKLab distance within which two colors count as the same.
 * pxFromTokens / colorFromTokens answer "is this measured value one of the system's?" for the value-compliance rules; a color matches a token at any alpha (a translucent system color is still a system color).
 */
import type { Color } from 'culori';
import type { ResolvedTokens } from '../tokens.ts';
import { colorDistance, parseColor } from './color.ts';

export const SIZE_TOLERANCE_PX = 0.5;
export const COLOR_TOLERANCE = 0.005;
export const COLOR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^)]*\)/g;

export function systemPx(tokens: ResolvedTokens, group: 'type' | 'space' | 'radius'): number[] {
  return tokens.entries
    .filter((entry) => entry.cssVar.startsWith(`--ds-${group}-`) && entry.number !== undefined)
    .map((entry) => entry.number!);
}

export function systemColors(tokens: ResolvedTokens): Color[] {
  const colors: Color[] = [];
  for (const entry of tokens.entries) {
    const sources = entry.cssVar.startsWith('--ds-color-')
      ? [entry.css]
      : entry.cssVar.startsWith('--ds-shadow-')
        ? (entry.css.match(COLOR_FUNCTION) ?? [])
        : [];
    for (const source of sources) {
      const color = parseColor(source);
      if (color) colors.push(color);
    }
  }
  return colors;
}

export function pxFromTokens(px: number, allowed: number[]): boolean {
  return allowed.some((value) => Math.abs(value - px) <= SIZE_TOLERANCE_PX);
}

export function colorFromTokens(color: Color, allowed: Color[]): boolean {
  return allowed.some((candidate) => colorDistance(color, candidate) <= COLOR_TOLERANCE);
}

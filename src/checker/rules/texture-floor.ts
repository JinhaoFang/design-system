/*
 * Texture-floor rule texture-floor/pure-black-white (error): pure black #000 or pure white #fff in text color, background, borders or shadows.
 * Only fully opaque colors count (transparent rgba(0,0,0,0) is not black); other color spaces are converted to sRGB first.
 * Thresholds for the later "hueless gray" and shadow-angle rules will live in the craft spec data, not here.
 */
import { parse, rgb } from 'culori';
import type { Hit, Rule } from '../registry.ts';

const COLOR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^)]*\)/g;
const SIDES = ['top', 'right', 'bottom', 'left'] as const;

function pureKind(css: string): 'black' | 'white' | undefined {
  const color = parse(css);
  if (!color || (color.alpha ?? 1) < 1) return undefined;
  const { r, g, b } = rgb(color);
  const [red, green, blue] = [r, g, b].map((channel) => Math.round(Math.min(1, Math.max(0, channel)) * 255));
  if (red === 0 && green === 0 && blue === 0) return 'black';
  if (red === 255 && green === 255 && blue === 255) return 'white';
  return undefined;
}

const LABEL = { black: '纯黑 #000', white: '纯白 #fff' } as const;

export const pureBlackWhite: Rule = {
  id: 'texture-floor/pure-black-white',
  category: 'texture-floor',
  severity: 'error',
  description: '文字、背景、边框、阴影中出现纯黑 #000 或纯白 #fff',
  check({ snapshot }) {
    const hits: Hit[] = [];
    for (const element of snapshot.elements) {
      const location = {
        ...(element.unit !== undefined && { unit: element.unit }),
        ...(element.layout !== undefined && { layout: element.layout }),
        ...(element.slot !== undefined && { slot: element.slot }),
        selector: element.selector,
      };
      const report = (kind: 'black' | 'white', where: string, value: string) =>
        hits.push({ location, message: `${where}使用了${LABEL[kind]}（${value}）` });
      const { styles } = element;

      if (element.hasOwnText) {
        const kind = pureKind(styles['color'] ?? '');
        if (kind) report(kind, '文字颜色', styles['color']!);
      }
      const background = pureKind(styles['background-color'] ?? '');
      if (background) report(background, '背景色', styles['background-color']!);
      for (const side of SIDES) {
        const visible =
          parseFloat(styles[`border-${side}-width`] ?? '0') > 0 &&
          !['none', 'hidden'].includes(styles[`border-${side}-style`] ?? 'none');
        const kind = visible ? pureKind(styles[`border-${side}-color`] ?? '') : undefined;
        if (kind) report(kind, '边框颜色', styles[`border-${side}-color`]!);
      }
      for (const property of ['box-shadow', 'text-shadow']) {
        for (const value of styles[property]?.match(COLOR_FUNCTION) ?? []) {
          const kind = pureKind(value);
          if (kind) report(kind, '阴影颜色', value);
        }
      }
    }
    return hits;
  },
};

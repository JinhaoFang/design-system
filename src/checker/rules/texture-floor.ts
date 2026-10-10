/*
 * Texture-floor rule texture-floor/pure-black-white (error): pure black #000 or pure white #fff in text color, background, borders or shadows.
 * Only fully opaque colors count (transparent rgba(0,0,0,0) is not black); other color spaces are converted to sRGB first.
 * The other texture-floor rules live in hueless-gray.ts, shadow-direction.ts and radius-nesting.ts; their thresholds are in ../rule-data.ts.
 */
import { parse, rgb } from 'culori';
import type { Hit, Rule } from '../registry.ts';
import { colorSources, locationOf } from './color-sources.ts';

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
      for (const { where, value } of colorSources(element)) {
        const kind = pureKind(value);
        if (kind) hits.push({ location: locationOf(element), message: `${where}使用了${LABEL[kind]}（${value}）` });
      }
    }
    return hits;
  },
};

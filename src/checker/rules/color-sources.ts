/*
 * Shared helpers for rules that inspect the colors an element actually paints: colorSources lists text color (only when the element owns text), background, visible borders and shadow colors
 * as { where, value } pairs of CSS color strings; locationOf builds the report location of an element.
 */
import type { Location } from '../../types.ts';
import type { ElementSnapshot } from '../snapshot.ts';

const COLOR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^)]*\)/g;
const SIDES = ['top', 'right', 'bottom', 'left'] as const;

export interface ColorSource {
  where: string;
  value: string;
}

export function colorSources(element: ElementSnapshot): ColorSource[] {
  const { styles } = element;
  const sources: ColorSource[] = [];
  if (element.hasOwnText) sources.push({ where: '文字颜色', value: styles['color'] ?? '' });
  sources.push({ where: '背景色', value: styles['background-color'] ?? '' });
  for (const side of SIDES) {
    const visible =
      parseFloat(styles[`border-${side}-width`] ?? '0') > 0 &&
      !['none', 'hidden'].includes(styles[`border-${side}-style`] ?? 'none');
    if (visible) sources.push({ where: '边框颜色', value: styles[`border-${side}-color`] ?? '' });
  }
  for (const property of ['box-shadow', 'text-shadow']) {
    for (const value of styles[property]?.match(COLOR_FUNCTION) ?? []) sources.push({ where: '阴影颜色', value });
  }
  return sources;
}

export function locationOf(element: ElementSnapshot): Location {
  return {
    ...(element.unit !== undefined && { unit: element.unit }),
    ...(element.layout !== undefined && { layout: element.layout }),
    ...(element.slot !== undefined && { slot: element.slot }),
    selector: element.selector,
  };
}

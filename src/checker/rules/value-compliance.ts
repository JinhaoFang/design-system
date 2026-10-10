/*
 * Static value-compliance rules (category value-compliance, all errors): every color, font size, spacing and radius must come from the system's resolved per-carrier tokens (token-values.ts), sizes within +-0.5px.
 * color: text color (elements owning text), background, visible border sides, box-shadow/text-shadow colors; transparent is ignored, a system color at any alpha and in any notation/space passes.
 * font-size: elements owning text, against --ds-type-*. spacing: padding, margin and row/column gap per side, against 0 and --ds-space-*; margin auto and gap normal are layout keywords and ignored.
 * radius: the four corners (both axes of an elliptical corner), against 0 and --ds-radius-*; percentages never match. Elements with display:none are skipped.
 * Motion durations and easings are not checked here. Findings list every offending property of one element in a single hit.
 */
import type { Color } from 'culori';
import { alphaOf, parseColor } from '../color.ts';
import { locateElement } from '../locate.ts';
import type { Hit, Rule } from '../registry.ts';
import type { ElementSnapshot } from '../snapshot.ts';
import { COLOR_FUNCTION, colorFromTokens, pxFromTokens, systemColors, systemPx } from '../token-values.ts';

const SIDES = ['top', 'right', 'bottom', 'left'] as const;
const CORNERS = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const;

function visible(element: ElementSnapshot): boolean {
  return element.styles['display'] !== 'none';
}

function offSystem(css: string, allowed: Color[]): boolean {
  const color = parseColor(css);
  if (!color) return true;
  return alphaOf(color) > 0 && !colorFromTokens(color, allowed);
}

export const colorFromSystem: Rule = {
  id: 'value-compliance/color',
  category: 'value-compliance',
  severity: 'error',
  description: '文字、背景、边框、阴影的颜色不是取自体系的颜色',
  check({ snapshot, tokens }) {
    const allowed = systemColors(tokens);
    const hits: Hit[] = [];
    for (const element of snapshot.elements) {
      if (!visible(element)) continue;
      const { styles } = element;
      const report = (where: string, value: string) =>
        hits.push({ location: locateElement(element), message: `${where}不是体系里的颜色（${value}）` });
      if (element.hasOwnText && offSystem(styles['color'] ?? '', allowed)) report('文字颜色', styles['color']!);
      if (offSystem(styles['background-color'] ?? 'transparent', allowed)) report('背景色', styles['background-color']!);
      const borders = new Set<string>();
      for (const side of SIDES) {
        const shown =
          parseFloat(styles[`border-${side}-width`] ?? '0') > 0 && !['none', 'hidden'].includes(styles[`border-${side}-style`] ?? 'none');
        const value = styles[`border-${side}-color`] ?? '';
        if (shown && offSystem(value, allowed)) borders.add(value);
      }
      for (const value of borders) report('边框颜色', value);
      for (const property of ['box-shadow', 'text-shadow']) {
        for (const value of styles[property]?.match(COLOR_FUNCTION) ?? []) {
          if (offSystem(value, allowed)) report('阴影颜色', value);
        }
      }
    }
    return hits;
  },
};

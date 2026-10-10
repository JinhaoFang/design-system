/*
 * Static value-compliance rules (category value-compliance, all errors): every color, font size, spacing and radius must come from the system's resolved per-carrier tokens (token-values.ts), sizes within +-0.5px.
 * color: text color (elements owning text), background, visible border sides, box-shadow/text-shadow colors; transparent is ignored, a system color at any alpha and in any notation/space passes.
 * font-size: elements owning text, against --ds-type-*. spacing: padding, margin and row/column gap per side, against 0 and --ds-space-*; margin auto and gap normal are layout keywords and ignored.
 * radius: the four corners (both axes of an elliptical corner), against 0 and --ds-radius-*; percentages never match. Elements with display:none are skipped.
 * Pure black and pure white (opaque) are left to texture-floor/pure-black-white so they are reported once, not twice.
 * Motion durations and easings are not checked here. Findings list every offending property of one element in a single hit.
 */
import type { Color } from 'culori';
import { alphaOf, parseColor } from '../color.ts';
import { locateElement } from '../locate.ts';
import type { Hit, Rule } from '../registry.ts';
import type { ElementSnapshot } from '../snapshot.ts';
import { pureKind } from './texture-floor.ts';
import { COLOR_FUNCTION, colorFromTokens, pxFromTokens, systemColors, systemPx } from '../token-values.ts';

const SIDES = ['top', 'right', 'bottom', 'left'] as const;
const CORNERS = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const;

function visible(element: ElementSnapshot): boolean {
  return element.styles['display'] !== 'none';
}

function offSystem(css: string, allowed: Color[]): boolean {
  const color = parseColor(css);
  if (!color) return true;
  if (pureKind(css)) return false;
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

function px(value: string | undefined): number | undefined {
  const match = /^(-?\d+(?:\.\d+)?)px$/.exec((value ?? '').trim());
  return match ? Number(match[1]) : undefined;
}

function ladder(allowed: number[]): string {
  return `0、${allowed.slice(1).map((value) => `${value}px`).join('、')}`;
}

export const fontSizeFromSystem: Rule = {
  id: 'value-compliance/font-size',
  category: 'value-compliance',
  severity: 'error',
  description: '字号不在体系的字阶里（允许 ±0.5px）',
  check({ snapshot, tokens }) {
    const allowed = systemPx(tokens, 'type');
    const hits: Hit[] = [];
    for (const element of snapshot.elements) {
      if (!visible(element) || !element.hasOwnText) continue;
      const size = px(element.styles['font-size']);
      if (size === undefined || !pxFromTokens(size, allowed)) {
        hits.push({
          location: locateElement(element),
          message: `字号 ${element.styles['font-size']} 不在体系的字阶里（可用：${allowed.map((value) => `${value}px`).join('、')}）`,
        });
      }
    }
    return hits;
  },
};

export const spacingFromSystem: Rule = {
  id: 'value-compliance/spacing',
  category: 'value-compliance',
  severity: 'error',
  description: '外边距、内边距、间隙不在体系的间距阶梯里（允许 ±0.5px）',
  check({ snapshot, tokens }) {
    const allowed = [0, ...systemPx(tokens, 'space')];
    const properties = [
      ...(['padding', 'margin'] as const).flatMap((kind) => SIDES.map((side) => `${kind}-${side}`)),
      'row-gap',
      'column-gap',
    ];
    const hits: Hit[] = [];
    for (const element of snapshot.elements) {
      if (!visible(element)) continue;
      const bad: string[] = [];
      for (const property of properties) {
        const value = element.styles[property];
        if (value === undefined || value === 'auto' || value === 'normal') continue;
        const size = px(value);
        if (size === undefined || !pxFromTokens(size, allowed)) bad.push(`${property} ${value}`);
      }
      if (bad.length) {
        hits.push({ location: locateElement(element), message: `间距不在体系的阶梯里：${bad.join('、')}（可用：${ladder(allowed)}）` });
      }
    }
    return hits;
  },
};

export const radiusFromSystem: Rule = {
  id: 'value-compliance/radius',
  category: 'value-compliance',
  severity: 'error',
  description: '圆角不在体系的圆角阶梯里（允许 ±0.5px）',
  check({ snapshot, tokens }) {
    const allowed = [0, ...systemPx(tokens, 'radius')];
    const hits: Hit[] = [];
    for (const element of snapshot.elements) {
      if (!visible(element)) continue;
      const bad: string[] = [];
      for (const corner of CORNERS) {
        const value = element.styles[`border-${corner}-radius`] ?? '0px';
        const sizes = value.trim().split(/\s+/).map(px);
        if (sizes.some((size) => size === undefined || !pxFromTokens(size, allowed))) bad.push(`${corner} ${value}`);
      }
      if (bad.length) {
        hits.push({ location: locateElement(element), message: `圆角不在体系的阶梯里：${bad.join('、')}（可用：${ladder(allowed)}）` });
      }
    }
    return hits;
  },
};

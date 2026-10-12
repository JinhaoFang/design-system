/*
 * Text contrast rules (category contrast), WCAG 2 AA, for every element that owns visible text.
 * Background = the backdrop chain recorded in the snapshot: the element's own and its ancestors' background colors, nearest first, composited down to the first opaque one (white if none, as for an unstyled page); semi-transparent text is blended over that result first.
 * contrast/insufficient (error): ratio below 4.5, or below 3 for large text (>= 24px, or >= 18.66px at weight >= 700; see color.ts). The ratio is compared unrounded.
 * contrast/text-over-image (warning, "无法计算，需人工确认"): the text sits on a background image or gradient, or its line boxes overlap an img/video/canvas or a background-image element; such text is not scored.
 * Not modelled: element opacity, mix-blend-mode, filters and text clipped to backgrounds.
 */
import type { Color } from 'culori';
import { alphaOf, contrastRatio, flatten, isLargeText, parseColor } from '../color.ts';
import { locateElement } from '../locate.ts';
import type { Hit, Rule } from '../registry.ts';
import type { ElementSnapshot } from '../snapshot.ts';

const AA_BODY = 4.5;
const AA_LARGE = 3;

interface Backdrop {
  image: boolean;
  layers: Color[];
}

function resolveBackdrop(element: ElementSnapshot): Backdrop | undefined {
  const { backdrop } = element;
  if (!backdrop) return undefined;
  const layers: Color[] = [];
  let image = backdrop.mediaOverlap;
  for (const layer of backdrop.chain) {
    if (layer.image) {
      image = true;
      break;
    }
    const color = parseColor(layer.color);
    if (!color || alphaOf(color) === 0) continue;
    layers.push(color);
    if (alphaOf(color) >= 1) break;
  }
  return { image, layers: layers.reverse() };
}

function textColor(element: ElementSnapshot): Color | undefined {
  if (!element.hasOwnText || element.styles['display'] === 'none' || element.styles['visibility'] === 'hidden') return undefined;
  const color = parseColor(element.styles['color'] ?? '');
  return color && alphaOf(color) > 0 ? color : undefined;
}

export const insufficientContrast: Rule = {
  id: 'contrast/insufficient',
  category: 'contrast',
  severity: 'error',
  description: '文字与背景的对比度低于 WCAG 2 AA：正文 4.5，大字 3',
  check({ snapshot }) {
    const hits: Hit[] = [];
    for (const element of snapshot.elements) {
      const color = textColor(element);
      const backdrop = resolveBackdrop(element);
      if (!color || !backdrop || backdrop.image) continue;
      const background = flatten(backdrop.layers);
      const ratio = contrastRatio(flatten([color], background), background);
      const size = parseFloat(element.styles['font-size'] ?? '16');
      const large = isLargeText(size, Number(element.styles['font-weight'] ?? 400));
      const required = large ? AA_LARGE : AA_BODY;
      if (ratio < required) {
        hits.push({
          location: locateElement(element),
          message: `文字对比度 ${(Math.floor(ratio * 100) / 100).toFixed(2)} 低于 WCAG AA 要求的 ${required}（${large ? '大字' : '正文'}，${element.styles['font-size']}，文字 ${element.styles['color']}）`,
        });
      }
    }
    return hits;
  },
};

export const textOverImage: Rule = {
  id: 'contrast/text-over-image',
  category: 'contrast',
  severity: 'warning',
  description: '文字压在图片或渐变上，对比度无法计算，需人工确认',
  check({ snapshot }) {
    const hits: Hit[] = [];
    for (const element of snapshot.elements) {
      if (!textColor(element) || !resolveBackdrop(element)?.image) continue;
      hits.push({ location: locateElement(element), message: '文字压在图片或渐变上，对比度无法计算，需人工确认' });
    }
    return hits;
  },
};

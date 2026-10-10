/*
 * Composition rules (warnings): composition/jump-rate, composition/layout-rate, composition/image-rate, each compared with the [min, max] range the system declares for the carrier
 * (tokens.constraints.composition[carrier]) with RULE_DATA.composition.rangeSlack of slack. Measurement is over snapshot.viewport, which is the whole canvas for social, one page for slides
 * (rules run per slide) and the first viewport for web (both widths); only what lies inside the viewport counts.
 *   jump rate   = largest font size / body font size; the body size is the font size with the most characters among text in the viewport (a tie picks the smaller size).
 *   layout rate = area of the union of content boxes (tight bounds of each text block's rendered characters, and image boxes) clipped to the viewport / viewport area.
 *   image rate  = area of the union of image boxes (img, svg, video, canvas, picture, url() backgrounds) clipped to the viewport / viewport area.
 * A text block counts when its text box overlaps the viewport; hidden (visibility) elements never count. Jump rate is skipped when the viewport holds no text.
 */
import { RULE_DATA } from '../rule-data.ts';
import type { CheckContext, Hit, Rule } from '../registry.ts';
import type { PageSnapshot, Rect } from '../snapshot.ts';
import type { Location } from '../../types.ts';
import { locationOf } from './color-sources.ts';

export interface Composition {
  jumpRate?: number;
  largestSelector?: string;
  largestSize?: number;
  bodySize?: number;
  layoutRate: number;
  imageRate: number;
}

function clip(rect: Rect, width: number, height: number): [number, number, number, number] | undefined {
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(width, rect.left + rect.width);
  const bottom = Math.min(height, rect.top + rect.height);
  return right > left && bottom > top ? [left, top, right, bottom] : undefined;
}

function unionArea(boxes: [number, number, number, number][]): number {
  const xs = [...new Set(boxes.flatMap((b) => [b[0], b[2]]))].sort((a, b) => a - b);
  let total = 0;
  for (let i = 0; i < xs.length - 1; i += 1) {
    const [x0, x1] = [xs[i]!, xs[i + 1]!];
    const spans = boxes.filter((b) => b[0] <= x0 && b[2] >= x1).map((b) => [b[1], b[3]] as const).sort((a, b) => a[0] - b[0]);
    let covered = 0;
    let end = -Infinity;
    for (const [top, bottom] of spans) {
      if (bottom <= end) continue;
      covered += bottom - Math.max(top, end);
      end = bottom;
    }
    total += covered * (x1 - x0);
  }
  return total;
}

export function measureComposition(snapshot: PageSnapshot): Composition {
  const { width, height } = snapshot.viewport;
  const textBoxes: [number, number, number, number][] = [];
  const imageBoxes: [number, number, number, number][] = [];
  const charsBySize = new Map<number, number>();
  let largest: { size: number; selector: string } | undefined;
  for (const element of snapshot.elements) {
    if (element.styles['visibility'] === 'hidden') continue;
    if (element.isImage) {
      const box = clip(element.rect, width, height);
      if (box) imageBoxes.push(box);
    }
    const textBox = element.textBox && clip(element.textBox, width, height);
    if (textBox) {
      textBoxes.push(textBox);
      for (const [size, chars] of element.textSizes ?? []) {
        charsBySize.set(size, (charsBySize.get(size) ?? 0) + chars);
        if (!largest || size > largest.size) largest = { size, selector: element.selector };
      }
    }
  }
  const canvas = width * height;
  const result: Composition = {
    layoutRate: unionArea([...textBoxes, ...imageBoxes]) / canvas,
    imageRate: unionArea(imageBoxes) / canvas,
  };
  if (largest) {
    const body = [...charsBySize.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0];
    result.bodySize = body;
    result.largestSize = largest.size;
    result.largestSelector = largest.selector;
    result.jumpRate = largest.size / body;
  }
  return result;
}

type Measure = 'jumpRate' | 'layoutRate' | 'imageRate';

function compositionRule(measure: Measure, id: string, label: string, description: string): Rule {
  return {
    id,
    category: 'composition',
    severity: 'warning',
    description,
    check(context: CheckContext): Hit[] {
      const range = context.tokens.constraints?.composition[context.tokens.carrier]?.[measure];
      if (!range) return [];
      const measured = measureComposition(context.snapshot);
      const value = measured[measure];
      if (value === undefined) return [];
      const { rangeSlack } = RULE_DATA.composition;
      if (value >= range[0] - rangeSlack && value <= range[1] + rangeSlack) return [];
      const detail =
        measure === 'jumpRate' ? `（最大字号 ${measured.largestSize}px ÷ 正文字号 ${measured.bodySize}px）` : '';
      const location: Location =
        measure === 'jumpRate' && measured.largestSelector ? { selector: measured.largestSelector } : {};
      return [
        {
          location,
          message: `${label} ${value.toFixed(2)}${detail}不在体系为${context.tokens.carrier}声明的范围 [${range[0]}, ${range[1]}] 内`,
        },
      ];
    },
  };
}

export const jumpRate = compositionRule('jumpRate', 'composition/jump-rate', '跳跃率', '跳跃率（最大字号 ÷ 正文字号）超出体系声明的范围');
export const layoutRate = compositionRule('layoutRate', 'composition/layout-rate', '版面率', '版面率（内容区面积 ÷ 画布面积）超出体系声明的范围');
export const imageRate = compositionRule('imageRate', 'composition/image-rate', '图版率', '图版率（图片面积 ÷ 画布面积）超出体系声明的范围');

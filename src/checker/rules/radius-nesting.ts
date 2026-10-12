/*
 * Texture-floor rule texture-floor/radius-nesting (warning): where a rounded child sits in a corner of its rounded parent, the parent's corner radius should equal the child's radius plus the gap
 * (parent padding + border width, averaged over the two sides meeting at that corner). Only direct parent/child pairs are compared, per corner, and only when the child actually sits at that corner
 * (its offset from the parent's border box equals the gap on both sides, within tolerance); a floating child is not part of a nesting. Radii are the horizontal radius, clamped to half the box size.
 * One hit per child lists every deviating corner. Tolerance: RULE_DATA['texture-floor/radius-nesting'].tolerancePx.
 */
import { RULE_DATA } from '../rule-data.ts';
import type { Hit, Rule } from '../registry.ts';
import type { ElementSnapshot } from '../snapshot.ts';
import { locationOf } from './color-sources.ts';

const CORNERS = [
  { name: '左上', radius: 'top-left', sides: ['top', 'left'] },
  { name: '右上', radius: 'top-right', sides: ['top', 'right'] },
  { name: '右下', radius: 'bottom-right', sides: ['bottom', 'right'] },
  { name: '左下', radius: 'bottom-left', sides: ['bottom', 'left'] },
] as const;

function px(value: string | undefined): number {
  return parseFloat(value ?? '0') || 0;
}

function effectiveRadius(element: ElementSnapshot, corner: string): number {
  const first = (element.styles[`border-${corner}-radius`] ?? '0px').trim().split(/\s+/)[0]!;
  const { width, height } = element.rect;
  const raw = first.endsWith('%') ? (parseFloat(first) / 100) * width : px(first);
  return Math.max(0, Math.min(raw, width / 2, height / 2));
}

function inset(parent: ElementSnapshot, side: string): number {
  return px(parent.styles[`padding-${side}`]) + px(parent.styles[`border-${side}-width`]);
}

function offset(child: ElementSnapshot, parent: ElementSnapshot, side: string): number {
  if (side === 'top') return child.rect.top - parent.rect.top;
  if (side === 'left') return child.rect.left - parent.rect.left;
  if (side === 'bottom') return parent.rect.top + parent.rect.height - (child.rect.top + child.rect.height);
  return parent.rect.left + parent.rect.width - (child.rect.left + child.rect.width);
}

export const radiusNesting: Rule = {
  id: 'texture-floor/radius-nesting',
  category: 'texture-floor',
  severity: 'warning',
  description: '父子元素圆角嵌套：外圆角应等于内圆角加内边距',
  check({ snapshot }) {
    const { tolerancePx } = RULE_DATA['texture-floor/radius-nesting'];
    const hits: Hit[] = [];
    for (const child of snapshot.elements) {
      const parent = child.parent === undefined ? undefined : snapshot.elements[child.parent];
      if (!parent || child.rect.width === 0 || child.rect.height === 0) continue;
      const deviations: string[] = [];
      for (const corner of CORNERS) {
        const outer = effectiveRadius(parent, corner.radius);
        const inner = effectiveRadius(child, corner.radius);
        if (outer <= 0 || inner <= 0) continue;
        const gaps = corner.sides.map((side) => inset(parent, side));
        const flush = corner.sides.every((side, i) => Math.abs(offset(child, parent, side) - gaps[i]!) <= tolerancePx);
        if (!flush) continue;
        const gap = (gaps[0]! + gaps[1]!) / 2;
        if (Math.abs(outer - (inner + gap)) > tolerancePx) {
          deviations.push(`${corner.name}：外圆角 ${outer}px，内圆角 ${inner}px + 内边距 ${gap}px = ${inner + gap}px`);
        }
      }
      if (deviations.length) {
        hits.push({ location: locationOf(child), message: `圆角嵌套偏差超过 ${tolerancePx}px（${deviations.join('；')}）` });
      }
    }
    return hits;
  },
};

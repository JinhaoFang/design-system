/*
 * Motion rules (category motion), all errors; they read snapshot.motion (animation records, see motion-audit.ts) and the resolved tokens:
 *   motion/duration-off-ladder: an animation duration that matches no step of the system's duration ladder (--ds-duration-*, in ms for this carrier, tolerance 0.5 ms).
 *   motion/easing-off-set: an easing that matches no curve of the system's easing set (--ds-easing-*); CSS keywords (ease, ease-in, ease-out, ease-in-out, linear) are compared as the cubic-bezier they stand for, tolerance 0.001.
 *   motion/non-compositor-property: an animation that changes a property other than transform and opacity (translate, rotate and scale count as transform).
 *   motion/transform-under-reduced-motion: in the pass rendered with reduced motion emulated, an animation still changes transform (or translate, rotate, scale).
 * The first three read the normal-motion pass, the last reads the reduced pass. Each hit is located by slide (slides), unit, layout, slot and selector of the animated element.
 */
import type { AnimationRecord } from '../motion-audit.ts';
import type { Hit, Rule } from '../registry.ts';

const TRANSFORM_FAMILY = ['transform', 'translate', 'rotate', 'scale'];
const ALLOWED_PROPERTIES = [...TRANSFORM_FAMILY, 'opacity'];
const KEYWORDS: Record<string, number[]> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
};

function bezierPoints(css: string): number[] | undefined {
  const text = css.trim();
  if (text in KEYWORDS) return KEYWORDS[text];
  const match = /^cubic-bezier\(([^)]*)\)$/.exec(text);
  if (!match) return undefined;
  const points = match[1]!.split(',').map((part) => Number(part.trim()));
  return points.length === 4 && points.every((point) => Number.isFinite(point)) ? points : undefined;
}

function locationOf(record: AnimationRecord) {
  return {
    ...(record.slide !== undefined && { slide: record.slide }),
    ...(record.unit !== undefined && { unit: record.unit }),
    ...(record.layout !== undefined && { layout: record.layout }),
    ...(record.slot !== undefined && { slot: record.slot }),
    selector: record.selector,
  };
}

function label(record: AnimationRecord): string {
  const kind = { 'css-animation': 'CSS 动画', 'css-transition': 'CSS 过渡', script: '脚本动画' }[record.source];
  return record.name ? `${kind} ${record.name}` : kind;
}

export const durationOffLadder: Rule = {
  id: 'motion/duration-off-ladder',
  category: 'motion',
  severity: 'error',
  description: '动画时长不在体系的时长阶梯内',
  check({ snapshot, tokens }) {
    const ladder = tokens.entries.filter((entry) => entry.cssVar.startsWith('--ds-duration-') && entry.number !== undefined).map((entry) => entry.number!);
    const hits: Hit[] = [];
    for (const record of snapshot.motion?.animations ?? []) {
      if (record.durationMs === null || ladder.some((step) => Math.abs(step - record.durationMs!) <= 0.5)) continue;
      hits.push({
        location: locationOf(record),
        message: `${label(record)}的时长 ${record.durationMs}ms 不在体系的时长阶梯内（${ladder.join('、')}ms）`,
      });
    }
    return hits;
  },
};

export const easingOffSet: Rule = {
  id: 'motion/easing-off-set',
  category: 'motion',
  severity: 'error',
  description: '动画缓动不在体系的缓动集内',
  check({ snapshot, tokens }) {
    const curves = tokens.entries.filter((entry) => entry.cssVar.startsWith('--ds-easing-')).map((entry) => ({ css: entry.css, points: bezierPoints(entry.css) }));
    const hits: Hit[] = [];
    for (const record of snapshot.motion?.animations ?? []) {
      for (const easing of record.easings) {
        const points = bezierPoints(easing);
        const inSet = points !== undefined && curves.some((curve) => curve.points?.every((value, index) => Math.abs(value - points[index]!) <= 0.001));
        if (inSet) continue;
        hits.push({
          location: locationOf(record),
          message: `${label(record)}的缓动 ${easing} 不在体系的缓动集内（${curves.map((curve) => curve.css).join('；')}）`,
        });
      }
    }
    return hits;
  },
};

export const nonCompositorProperty: Rule = {
  id: 'motion/non-compositor-property',
  category: 'motion',
  severity: 'error',
  description: '动画改变了 transform 和 opacity 以外的属性',
  check({ snapshot }) {
    const hits: Hit[] = [];
    for (const record of snapshot.motion?.animations ?? []) {
      const others = record.properties.filter((property) => !ALLOWED_PROPERTIES.includes(property));
      if (others.length) hits.push({ location: locationOf(record), message: `${label(record)}改变了 transform 和 opacity 以外的属性：${others.join('、')}` });
    }
    return hits;
  },
};

export const transformUnderReducedMotion: Rule = {
  id: 'motion/transform-under-reduced-motion',
  category: 'motion',
  severity: 'error',
  description: '模拟「减少动态效果」时仍有动画改变 transform',
  check({ snapshot }) {
    const hits: Hit[] = [];
    for (const record of snapshot.motion?.reduced ?? []) {
      const moving = record.properties.filter((property) => TRANSFORM_FAMILY.includes(property));
      if (moving.length) hits.push({ location: locationOf(record), message: `开启「减少动态效果」后，${label(record)}仍在改变 ${moving.join('、')}（应去掉位移）` });
    }
    return hits;
  },
};

export const MOTION_RULES: Rule[] = [durationOffLadder, easingOffSet, nonCompositorProperty, transformUnderReducedMotion];

/*
 * Texture-floor rule texture-floor/shadow-direction (error): the offset of every box-shadow and text-shadow layer must point away from the system's light.
 * Convention for constraints.lightAngleDeg: the direction toward the light source, counterclockwise from the +x axis with y pointing up (90 = light from above, 135 = from the upper left).
 * A layer's shadow direction is atan2(-offsetY, offsetX) in the same frame (CSS y points down) and must equal lightAngleDeg + 180 within RULE_DATA toleranceDeg.
 * Layers whose offset is shorter than minOffsetPx have no direction (pure glow/blur) and are skipped. Computed shadows are split on commas outside parentheses.
 */
import { RULE_DATA } from '../rule-data.ts';
import type { Hit, Rule } from '../registry.ts';
import { locationOf } from './color-sources.ts';

function splitLayers(value: string): string[] {
  const layers: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const ch = value[index];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (ch === ',' && depth === 0) {
      layers.push(value.slice(start, index));
      start = index + 1;
    }
  }
  layers.push(value.slice(start));
  return layers.map((layer) => layer.trim()).filter((layer) => layer !== '' && layer !== 'none');
}

function offsetOf(layer: string): { x: number; y: number } | undefined {
  const lengths = layer.replace(/\b[a-z-]+\([^)]*\)/g, ' ').match(/-?\d*\.?\d+(?=px)/g);
  if (!lengths || lengths.length < 2) return undefined;
  return { x: Number(lengths[0]), y: Number(lengths[1]) };
}

function angleDifference(a: number, b: number): number {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180);
}

export const shadowDirection: Rule = {
  id: 'texture-floor/shadow-direction',
  category: 'texture-floor',
  severity: 'error',
  description: '阴影偏移方向与体系声明的光源方向相差超过容差',
  check({ snapshot, tokens }) {
    const light = tokens.constraints?.lightAngleDeg;
    if (light === undefined) return [];
    const { toleranceDeg, minOffsetPx } = RULE_DATA['texture-floor/shadow-direction'];
    const expected = (light + 180) % 360;
    const hits: Hit[] = [];
    for (const element of snapshot.elements) {
      for (const property of ['box-shadow', 'text-shadow']) {
        for (const layer of splitLayers(element.styles[property] ?? '')) {
          const offset = offsetOf(layer);
          if (!offset || Math.hypot(offset.x, offset.y) < minOffsetPx) continue;
          const actual = (Math.atan2(-offset.y, offset.x) * 180) / Math.PI;
          const difference = angleDifference(actual, expected);
          if (difference > toleranceDeg) {
            hits.push({
              location: locationOf(element),
              message: `${property} 的阴影偏移 (${offset.x}px, ${offset.y}px) 方向为 ${((actual + 360) % 360).toFixed(1)}°，光源方向 ${light}° 要求 ${expected}°，相差 ${difference.toFixed(1)}°，超过 ${toleranceDeg}°`,
            });
          }
        }
      }
    }
    return hits;
  },
};

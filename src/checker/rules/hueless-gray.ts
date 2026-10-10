/*
 * Texture-floor rule texture-floor/hueless-gray (error): a color painted by an element (text, background, border, shadow) whose OKLCH lightness is in the mid band and whose chroma is below the threshold.
 * Fully transparent colors are skipped; colors are parsed by culori and converted to OKLCH in Node. Thresholds: RULE_DATA['texture-floor/hueless-gray'].
 */
import { converter, parse } from 'culori';
import { RULE_DATA } from '../rule-data.ts';
import type { Hit, Rule } from '../registry.ts';
import { colorSources, locationOf } from './color-sources.ts';

const toOklch = converter('oklch');

export const huelessGray: Rule = {
  id: 'texture-floor/hueless-gray',
  category: 'texture-floor',
  severity: 'error',
  description: '明度在中段、色度低于阈值的颜色（不带色相的灰）',
  check({ snapshot }) {
    const { lightness, chromaBelow } = RULE_DATA['texture-floor/hueless-gray'];
    const hits: Hit[] = [];
    for (const element of snapshot.elements) {
      for (const { where, value } of colorSources(element)) {
        const parsed = parse(value);
        if (!parsed || (parsed.alpha ?? 1) === 0) continue;
        const { l, c } = toOklch(parsed);
        if (l >= lightness[0] && l <= lightness[1] && c < chromaBelow) {
          hits.push({
            location: locationOf(element),
            message: `${where}是不带色相的灰（${value}，OKLCH 明度 ${l.toFixed(2)}，色度 ${c.toFixed(3)}，阈值 ${chromaBelow}）`,
          });
        }
      }
    }
    return hits;
  },
};

/*
 * Rule data (规则数据): the one place that holds the initial thresholds of the checker rules, keyed by rule id. Rules import their entry from here and never hard-code a number;
 * the craft spec (工艺规范) document references this same object, so changing a rule's threshold means editing this file only. The values are proposals to be tuned from the judge's feedback.
 *   texture-floor/hueless-gray: a color is a hueless gray when its OKLCH lightness is within lightness [min, max] and its chroma is below chromaBelow.
 *   texture-floor/shadow-direction: a shadow with an offset of at least minOffsetPx is reported when its direction differs from the system's light direction by more than toleranceDeg.
 *   texture-floor/radius-nesting: a child sitting in the corner of a rounded parent should have parent radius = child radius + parent padding (+ border); reported beyond tolerancePx.
 *   composition/*: measured ratios are compared with the system's declared [min, max] range with a slack of rangeSlack (absolute, in ratio units) so float noise never trips a boundary.
 */
export const RULE_DATA = {
  'texture-floor/hueless-gray': { lightness: [0.2, 0.9], chromaBelow: 0.01 },
  'texture-floor/shadow-direction': { toleranceDeg: 15, minOffsetPx: 0.5 },
  'texture-floor/radius-nesting': { tolerancePx: 1 },
  composition: { rangeSlack: 0.005 },
} as const;

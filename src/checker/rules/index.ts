/*
 * Central rule list. Add a rule file under rules/, import it here and append it to ALL_RULES.
 */
import type { Rule } from '../registry.ts';
import { adjacentSameLayout } from './adjacent-layout.ts';
import { lineEndForbidden, lineStartForbidden, missingSpacing, orphanLine } from './cjk-typography.ts';
import { imageRate, jumpRate, layoutRate } from './composition.ts';
import { insufficientContrast, textOverImage } from './contrast.ts';
import { equalCardGrid } from './equal-card-grid.ts';
import { MOTION_RULES } from './motion.ts';
import { licenseCarrier, missingGlyph, notInManifest } from './fonts.ts';
import { huelessGray } from './hueless-gray.ts';
import { radiusNesting } from './radius-nesting.ts';
import { shadowDirection } from './shadow-direction.ts';
import { pureBlackWhite } from './texture-floor.ts';
import { colorFromSystem, fontSizeFromSystem, radiusFromSystem, spacingFromSystem } from './value-compliance.ts';

export const ALL_RULES: Rule[] = [
  pureBlackWhite,
  missingSpacing,
  lineStartForbidden,
  lineEndForbidden,
  orphanLine,
  colorFromSystem,
  fontSizeFromSystem,
  spacingFromSystem,
  radiusFromSystem,
  insufficientContrast,
  textOverImage,
  notInManifest,
  missingGlyph,
  licenseCarrier,
  huelessGray,
  shadowDirection,
  radiusNesting,
  jumpRate,
  layoutRate,
  imageRate,
  adjacentSameLayout,
  equalCardGrid,
  ...MOTION_RULES,
];

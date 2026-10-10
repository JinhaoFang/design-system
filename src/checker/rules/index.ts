/*
 * Central rule list. Add a rule file under rules/, import it here and append it to ALL_RULES.
 */
import type { Rule } from '../registry.ts';
import { lineEndForbidden, lineStartForbidden, missingSpacing, orphanLine } from './cjk-typography.ts';
import { imageRate, jumpRate, layoutRate } from './composition.ts';
import { licenseCarrier, missingGlyph, notInManifest } from './fonts.ts';
import { huelessGray } from './hueless-gray.ts';
import { radiusNesting } from './radius-nesting.ts';
import { shadowDirection } from './shadow-direction.ts';
import { pureBlackWhite } from './texture-floor.ts';

export const ALL_RULES: Rule[] = [pureBlackWhite, missingSpacing, lineStartForbidden, lineEndForbidden, orphanLine, notInManifest, missingGlyph, licenseCarrier];
ALL_RULES.push(huelessGray, shadowDirection, radiusNesting, jumpRate, layoutRate, imageRate);

/*
 * Central rule list. Add a rule file under rules/, import it here and append it to ALL_RULES.
 */
import type { Rule } from '../registry.ts';
import { lineEndForbidden, lineStartForbidden, missingSpacing, orphanLine } from './cjk-typography.ts';
import { huelessGray } from './hueless-gray.ts';
import { radiusNesting } from './radius-nesting.ts';
import { shadowDirection } from './shadow-direction.ts';
import { pureBlackWhite } from './texture-floor.ts';

export const ALL_RULES: Rule[] = [pureBlackWhite, missingSpacing, lineStartForbidden, lineEndForbidden, orphanLine];
ALL_RULES.push(huelessGray, shadowDirection, radiusNesting);

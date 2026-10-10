/*
 * Central rule list. Add a rule file under rules/, import it here and append it to ALL_RULES.
 */
import type { Rule } from '../registry.ts';
import { lineEndForbidden, lineStartForbidden, missingSpacing, orphanLine } from './cjk-typography.ts';
import { pureBlackWhite } from './texture-floor.ts';
import { colorFromSystem } from './value-compliance.ts';

export const ALL_RULES: Rule[] = [pureBlackWhite, missingSpacing, lineStartForbidden, lineEndForbidden, orphanLine, colorFromSystem];

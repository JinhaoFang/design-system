/*
 * Shared types and constants: finding/report shapes, the eight checker categories, and BuildError (validation failures that stop a build before rendering).
 * Report format version 1: { version, system, work, summary, findings[] }; every finding carries ruleId, category, severity, location, message.
 */

export type Severity = 'error' | 'warning';

export const CATEGORIES = {
  'value-compliance': '数值合规',
  contrast: '对比度',
  composition: '构图比率',
  'cjk-typography': '中文排版',
  'texture-floor': '质感底线',
  motion: '动效',
  fonts: '字体',
  'anti-homogeneity': '防同质化',
} as const;

export type Category = keyof typeof CATEGORIES;

export interface Location {
  unit?: string;
  layout?: string;
  slot?: string;
  selector?: string;
}

export interface Finding {
  ruleId: string;
  category: Category;
  severity: Severity;
  location: Location;
  message: string;
}

export interface Report {
  version: 1;
  system: string;
  work: { concept: string; carrier: string; canvas: string };
  summary: { errors: number; warnings: number };
  findings: Finding[];
}

export class BuildError extends Error {
  issues: string[];
  constructor(issues: string[]) {
    super(issues.join('\n'));
    this.name = 'BuildError';
    this.issues = issues;
  }
}

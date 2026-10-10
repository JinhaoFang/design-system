/*
 * Rule registry and runner. A Rule has an id (category/name), a category, a default severity and check(context) -> hits.
 * Rules are listed centrally in rules/index.ts; adding a rule means adding a file there plus one line, never touching the pipeline.
 * runRules turns hits into Findings (rule id, category, severity, location, message) in a deterministic order.
 */
import type { Category, Finding, Location, Severity } from '../types.ts';
import { CATEGORIES } from '../types.ts';
import type { ResolvedTokens } from '../tokens.ts';
import type { Work } from '../work.ts';
import type { PageSnapshot } from './snapshot.ts';

export interface CheckContext {
  snapshot: PageSnapshot;
  work: Work;
  tokens: ResolvedTokens;
}

export interface Hit {
  location: Location;
  message: string;
  severity?: Severity;
}

export interface Rule {
  id: string;
  category: Category;
  severity: Severity;
  description: string;
  check(context: CheckContext): Hit[];
}

export function runRules(rules: Rule[], context: CheckContext): Finding[] {
  const ids = new Set<string>();
  const findings: Finding[] = [];
  for (const rule of rules) {
    if (ids.has(rule.id)) throw new Error(`duplicate rule id: ${rule.id}`);
    ids.add(rule.id);
    for (const hit of rule.check(context)) {
      findings.push({
        ruleId: rule.id,
        category: rule.category,
        severity: hit.severity ?? rule.severity,
        location: hit.location,
        message: hit.message,
      });
    }
  }
  const order = Object.keys(CATEGORIES);
  return findings.sort(
    (a, b) =>
      order.indexOf(a.category) - order.indexOf(b.category) ||
      a.ruleId.localeCompare(b.ruleId) ||
      (a.location.selector ?? '').localeCompare(b.location.selector ?? ''),
  );
}

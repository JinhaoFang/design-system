/* Doc drift check for library/craft.md (工艺规范): every checker rule id cited in the document exists in ALL_RULES, every registered rule is cited, every cited rule-data key exists in RULE_DATA, and every rule section carries 规则 / 理由 / 适用边界 / 检查. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { RULE_DATA } from '../src/checker/rule-data.ts';
import { ALL_RULES } from '../src/checker/rules/index.ts';
import { repoRoot } from './helpers.ts';

const doc = await readFile(join(repoRoot, 'library', 'craft.md'), 'utf8');
const quoted = (pattern: RegExp) => [...doc.matchAll(pattern)].map((match) => match[1]!);

describe('craft spec document', () => {
  test('cited rule ids exist and every registered rule is cited', () => {
    const registered = new Set(ALL_RULES.map((rule) => rule.id));
    const cited = new Set(quoted(/`([a-z-]+\/[a-z-]+)`/g));
    expect([...cited].filter((id) => !registered.has(id))).toEqual([]);
    expect([...registered].filter((id) => !cited.has(id))).toEqual([]);
  });

  test('cited rule-data keys exist', () => {
    const keys = quoted(/rule-data 键 `([^`]+)`/g);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter((key) => !(key in RULE_DATA))).toEqual([]);
  });

  test('every rule section has rule, reason, boundary and check; automatic ones cite a rule id', () => {
    const sections = doc.split(/^### /m).slice(1);
    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) {
      const title = section.split('\n')[0];
      for (const part of ['**规则**', '**理由**', '**适用边界**', '**检查**']) expect(section, `${title} 缺 ${part}`).toContain(part);
      const check = section.split('**检查**')[1]!;
      if (check.includes('人工把关')) continue;
      expect(check, `${title} 的自动检查没有引用规则标识`).toMatch(/`[a-z-]+\/[a-z-]+`/);
    }
  });
});

/*
 * Comment guardrail tests run the public command against temporary Git repos.
 * Only exit codes and diagnostics are asserted; fixture source is data, not
 * executable test code. Each repository is removed after the test.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, expect, test } from 'vitest';

const command = resolve(import.meta.dirname, '../scripts/check-comments.ts');
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'ds-comments-'));
  roots.push(root);
  execFileSync('git', ['init', '--quiet', root]);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  execFileSync('git', ['add', '--', '.'], { cwd: root });
  return root;
}

function run(root: string, ...args: string[]) {
  return spawnSync(process.execPath, [command, ...args], { cwd: root, encoding: 'utf8' });
}

test('allows a single header block, consecutive lines, optional shebang and no header', () => {
  const root = fixture({
    'block.ts': '/* Header\n * explanation\n */\nexport {};',
    'lines.mts': '// Header\n  // continued\nexport {};',
    'shebang.cts': '#!/usr/bin/env node\n/* Header */\nexport {};',
    'lines.js': '#!/usr/bin/env node\n// Header\r\n// continued\r\nconst value = 1;',
    'bare.mjs': 'export {};',
    'empty.cjs': '',
    'header-only.ts': '// Header\n// continued\n',
    'block-only.js': '/* Header */',
  });
  const result = run(root, root);
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
});

test.each([
  ['middle line', 'export {};\n// explanation\nconst value = 1;', 2],
  ['middle block', 'export {};\n/* explanation\ncontinued */', 2],
  ['trailing line', 'const value = 1; // explanation', 1],
  ['trailing block', 'const value = 1; /* explanation */', 1],
  ['second header block', '/* Header */\n/* Second */\nexport {};', 2],
  ['adjacent header blocks', '/* Header *//* Second */\nexport {};', 1],
  ['separated header lines', '// Header\n\n// Second\nexport {};', 3],
  ['line then block header', '// Header\n/* Second */\nexport {};', 2],
  ['block then line header', '/* Header */\n// Second\nexport {};', 2],
  ['header only second block', '/* Header */\n/* Second */', 2],
  ['shebang second header', '#!/usr/bin/env node\n/* Header */\n// Second\nexport {};', 3],
  ['template expression', 'const text = `/* text */ ${\n/* explanation */ 1} // tail`;', 2],
  ['type directive', 'export {};\n// @ts-expect-error reason\nconst value: string = 1;', 2],
  ['lint directive', 'export {};\n/* eslint-disable rule */', 2],
])('rejects %s at its line', (_name, code, line) => {
  const result = run(fixture({ 'sample.ts': code }));
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(`sample.ts:${line} 注释只能写在文件头的第一段说明中`);
  expect(result.stderr).not.toContain('用法：');
});

test('protects strings, regexps, template text and nested template expressions', () => {
  const result = run(fixture({
    'literals.ts': [
      'const url = "https://example.test/* text */";',
      "const single = '// text /* text */';",
      'const pattern = /https?:\\/\\/[^/]+/;',
      'const stars = /[/*]+/;',
      'const plain = `/* text */ // text`;',
      'const template = `/* head */ ${"// string"} /* middle */ ${`// nested ${/[/]/}`} // tail`;',
      'const quotient = 10 / 2 / 5;',
    ].join('\n'),
  }));
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
});

test('checks all six tracked extensions, image scripts and skill scripts, reporting every violation', () => {
  const files = Object.fromEntries(['ts', 'mts', 'cts', 'js', 'mjs', 'cjs'].map((ext) => [
    `sample.${ext}`, 'const value = 1; // explanation',
  ]));
  const root = fixture({
    ...files,
    'systems/sample/images/generate.mjs': 'const value = 1; // explanation',
    '.claude/skills/run-spec/scripts/sample.ts': 'export {};\n/* explanation */',
    'template.liquid': '// ignored',
    'style.css': 'a {} /* ignored */',
    'view.tsx': 'export {}; // outside scope',
  });
  const result = run(root);
  expect(result.status).toBe(1);
  for (const path of Object.keys(files)) expect(result.stderr).toContain(`${path}:1 `);
  expect(result.stderr).toContain('systems/sample/images/generate.mjs:1 ');
  expect(result.stderr).toContain('.claude/skills/run-spec/scripts/sample.ts:2 ');
  expect(result.stderr.match(/注释只能写/g)).toHaveLength(8);
});

test('ignores all untracked files but checks force-tracked ignored paths and working-tree edits', () => {
  const root = fixture({ '.gitignore': 'out/\nreferences/\n', 'tracked.ts': 'export {}; ' });
  writeFileSync(join(root, 'untracked.ts'), 'export {}; // ignored');
  mkdirSync(join(root, 'out'));
  writeFileSync(join(root, 'out/ignored.js'), 'export {}; // ignored');
  writeFileSync(join(root, 'out/tracked.js'), 'export {}; // violation');
  execFileSync('git', ['add', '--force', '--', 'out/tracked.js'], { cwd: root });
  writeFileSync(join(root, 'tracked.ts'), 'export {};\n// working-tree violation');
  const result = run(root);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('out/tracked.js:1 ');
  expect(result.stderr).toContain('tracked.ts:2 ');
  expect(result.stderr.match(/注释只能写/g)).toHaveLength(2);
});

test('help exits 0 and invalid arguments exit 2 with usage', () => {
  const root = fixture({});
  const help = run(root, '--help');
  expect(help.status).toBe(0);
  expect(help.stdout).toContain('用法：node scripts/check-comments.ts [仓库根目录]');
  expect(help.stderr).toBe('');
  for (const args of [['--unknown'], [root, 'extra']]) {
    const result = run(root, ...args);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('最多提供一个仓库根目录');
    expect(result.stderr).toContain('用法：');
  }
});

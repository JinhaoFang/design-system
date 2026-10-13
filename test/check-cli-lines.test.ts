/*
 * Long-line guardrail tests drive the public command against temporary Markdown
 * fixtures. Assert exit status, file/line/length diagnostics and code/table
 * exclusions; the default scope remains docs/cli.md in the working directory.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, expect, test } from 'vitest';

const command = resolve(import.meta.dirname, '../scripts/check-cli-lines.ts');
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(text: string): string {
  const root = mkdtempSync(join(tmpdir(), 'ds-cli-lines-'));
  roots.push(root);
  mkdirSync(join(root, 'docs'));
  writeFileSync(join(root, 'docs/cli.md'), text);
  writeFileSync(join(root, 'other.md'), '字'.repeat(500));
  return root;
}

function run(root: string, ...args: string[]) {
  return spawnSync(process.execPath, [command, ...args], { cwd: root, encoding: 'utf8' });
}

test('checks only the manual by default and accepts exactly 160 Unicode characters', () => {
  const result = run(fixture(`${'字'.repeat(160)}\r\n${'😀'.repeat(160)}\r\n`));
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
});

test('reports all long lines with their file, physical line number and Unicode length', () => {
  const root = fixture(`short\r\n${'字'.repeat(161)}\r\n${'😀'.repeat(162)}\r\n`);
  const path = join(root, 'docs/cli.md');
  const result = run(root, path);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(`${path}:2 长度 161 个字符，超过上限 160。`);
  expect(result.stderr).toContain(`${path}:3 长度 162 个字符，超过上限 160。`);
  expect(result.stderr).not.toContain('用法：');
});

test('skips pipe table rows and fenced or indented code, including fence information strings', () => {
  const long = '字'.repeat(300);
  const result = run(fixture([
    `| 标题 | ${long} |`,
    '  | --- | --- |',
    `  | 数据 | ${long} |`,
    `\`\`\`\`text ${long}`,
    long,
    '```',
    '~~~',
    long,
    '````',
    '   ~~~md',
    long,
    '   ~~~~~',
    `    ${long}`,
    `\t${long}`,
    'short',
  ].join('\n')));
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
});

test('resumes checking after code blocks and does not exempt ordinary inline pipes or code', () => {
  const long = '字'.repeat(161);
  const result = run(fixture(['```', long, '```', long, `text | ${long}`, `\`${long}\``].join('\n')));
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('docs/cli.md:4 长度 161');
  expect(result.stderr).toContain('docs/cli.md:5 长度 168');
  expect(result.stderr).toContain('docs/cli.md:6 长度 163');
  expect(result.stderr.match(/超过上限/g)).toHaveLength(3);
});

test('skips table rows with optional outer pipes and resumes at the next paragraph', () => {
  const long = '字'.repeat(161);
  const result = run(fixture([`${long} | 标题`, ':--- | ---:', `${long} | 数据`, '', long].join('\n')));
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('docs/cli.md:5 长度 161');
  expect(result.stderr.match(/超过上限/g)).toHaveLength(1);
});

test('help exits 0 and invalid arguments or missing files exit 2', () => {
  const root = fixture('short');
  const help = run(root, '--help');
  expect(help.status).toBe(0);
  expect(help.stdout).toContain('用法：node scripts/check-cli-lines.ts');
  expect(help.stderr).toBe('');
  for (const args of [['--unknown'], ['first.md', 'second.md']]) {
    const result = run(root, ...args);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('最多提供一个文件路径');
    expect(result.stderr).toContain('用法：');
  }
  const missing = run(root, 'missing.md');
  expect(missing.status).toBe(2);
  expect(missing.stderr).toContain('文件或程序不存在');
});

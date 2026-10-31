/*
 * Verification-entry tests run a copy of scripts/verify.ts in a temporary package
 * whose scripts only echo or exit, so the step table and exit codes are observed
 * without the real checks. Cover the full run, --static skipping tests, a failing
 * static step, --help, and argument errors exiting 2 before any step.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, expect, test } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '..');
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(scripts: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'ds-verify-'));
  roots.push(root);
  mkdirSync(join(root, 'scripts'));
  for (const name of ['verify.ts', 'cli.ts']) copyFileSync(join(repoRoot, 'scripts', name), join(root, 'scripts', name));
  const echo = (name: string) => `node -e "console.log('ran ${name}')"`;
  writeFileSync(join(root, 'package.json'), JSON.stringify({
    name: 'verify-fixture',
    private: true,
    type: 'module',
    scripts: {
      typecheck: echo('typecheck'),
      'check:comments': echo('comments'),
      'check:doc-commands': echo('doc-commands'),
      'check:cli-lines': echo('cli-lines'),
      test: 'node -e "process.exit(7)"',
      ...scripts,
    },
  }));
  return root;
}

function run(root: string, ...args: string[]) {
  return spawnSync(process.execPath, ['scripts/verify.ts', ...args], { cwd: root, encoding: 'utf8' });
}

test('full verification runs every step and keeps the failing test exit code', () => {
  const result = run(fixture());
  expect(result.status).toBe(7);
  for (const name of ['typecheck', 'comments', 'doc-commands', 'cli-lines']) expect(result.stdout).toContain(`ran ${name}`);
  expect(result.stdout).toContain('[verify] 测试');
}, 30000);

test('static verification runs every check but not the tests', () => {
  const result = run(fixture(), '--static');
  expect(result.status, result.stdout + result.stderr).toBe(0);
  for (const name of ['typecheck', 'comments', 'doc-commands', 'cli-lines']) expect(result.stdout).toContain(`ran ${name}`);
  expect(result.stdout).not.toContain('[verify] 测试');
  expect(result.stdout).toContain('[verify] 静态检查通过（未运行测试）');
}, 30000);

test('a failing static step stops static verification with its exit code', () => {
  const result = run(fixture({ 'check:comments': 'node -e "process.exit(3)"' }), '--static');
  expect(result.status).toBe(3);
  expect(result.stdout).not.toContain('ran doc-commands');
  expect(result.stdout).not.toContain('静态检查通过');
}, 30000);

test('help exits 0 and invalid arguments exit 2 before any step', () => {
  const root = fixture();
  const help = run(root, '--help');
  expect(help.status).toBe(0);
  expect(help.stdout).toMatch(/^用法：pnpm verify \[--static\] \[--help\]/);
  for (const args of [['--unknown'], ['extra']]) {
    const result = run(root, ...args);
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/^出错：/);
    expect(result.stdout).not.toContain('[verify]');
  }
});

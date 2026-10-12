/* CLI contract tests run a minimal fixture command and assert exit codes and output. */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const command = fileURLToPath(new URL('./fixtures/commands/check-cli.ts', import.meta.url));

function run(...args: string[]) {
  return spawnSync(process.execPath, [command, ...args], { encoding: 'utf8' });
}

test('a clean check exits 0 without diagnostics', () => {
  const result = run('--mode', 'clean');
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
});

test('help prints Chinese usage and skips required arguments', () => {
  const result = run('--help');
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('用法：check-cli');
  expect(result.stderr).toBe('');
});

test.each([
  [[], '缺少 --mode 参数。'],
  [['--mode', 'unknown'], '未知模式：unknown'],
  [['--unknown'], '参数无效'],
  [['--mode'], '参数无效'],
  [['extra'], '参数无效'],
])('invalid arguments %j exit 2 with Chinese diagnostics and usage', (args, diagnostic) => {
  const result = run(...args);
  expect(result.status).toBe(2);
  expect(result.stderr).toContain(`出错：${diagnostic}`);
  expect(result.stderr).toContain('用法：check-cli');
  expect(result.stdout).toBe('');
});

test('violations exit 1 and report every issue in Chinese', () => {
  const result = run('--mode', 'violation');
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('检查未通过：');
  expect(result.stderr).toContain('夹具文件:1 第一项违规。');
  expect(result.stderr).toContain('夹具文件:2 第二项违规。');
  expect(result.stderr).not.toContain('用法：');
  expect(result.stdout).toBe('');
});

test('runtime errors exit 2 with translated diagnostics', () => {
  const result = run('--mode', 'runtime');
  expect(result.status).toBe(2);
  expect(result.stderr).toContain('出错：文件或程序不存在：');
  expect(result.stderr).not.toContain('ENOENT:');
  expect(result.stderr).not.toContain('用法：');
});

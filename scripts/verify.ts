/*
 * Run verification steps in table order from the repository root, printing each
 * label before starting its command. Stop on the first failure and preserve its
 * exit code; process launch failures and signals also stop verification.
 * Add future checks to STEPS between typecheck and test, using argument arrays.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { errorMessage } from './cli.ts';

const STEPS = [
  { label: '类型检查', command: ['pnpm', 'typecheck'] },
  { label: '注释位置检查', command: ['pnpm', 'check:comments'] },
  { label: '测试', command: ['pnpm', 'test'] },
];

for (const { label, command } of STEPS) {
  console.log(`\n[verify] ${label}`);
  const result = spawnSync(command[0]!, command.slice(1), {
    cwd: resolve(import.meta.dirname, '..'),
    stdio: 'inherit',
  });
  if (result.error) {
    console.error(`出错：${errorMessage(result.error)}`);
    process.exitCode = 2;
    break;
  }
  if (result.status !== 0) {
    if (result.signal) console.error(`出错：${label}被信号 ${result.signal} 终止。`);
    process.exitCode = result.status ?? 1;
    break;
  }
}

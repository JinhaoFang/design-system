/*
 * Run verification steps in table order from the repository root, printing each
 * label before starting its command. Stop on the first failure and preserve its
 * exit code; process launch failures and signals also stop verification.
 * Add future checks to STEPS between typecheck and test, using argument arrays.
 * `pnpm verify --static` runs every step except TEST_STEP; --help prints usage,
 * and invalid arguments exit 2 with a Chinese diagnostic before any step runs.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { errorMessage } from './cli.ts';

const USAGE = 'pnpm verify [--static] [--help]';
const TEST_STEP = { label: '测试', command: ['pnpm', 'test'] };
const STEPS = [
  { label: '类型检查', command: ['pnpm', 'typecheck'] },
  { label: '注释位置检查', command: ['pnpm', 'check:comments'] },
  { label: '文档命令检查', command: ['pnpm', 'check:doc-commands'] },
  { label: '命令手册长行检查', command: ['pnpm', 'check:cli-lines'] },
  TEST_STEP,
];

let values: { static?: boolean; help?: boolean };
try {
  ({ values } = parseArgs({ options: { static: { type: 'boolean' }, help: { type: 'boolean' } } }));
} catch (error) {
  console.error(`出错：${errorMessage(error)}\n用法：${USAGE}`);
  process.exit(2);
}
if (values.help) {
  console.log(`用法：${USAGE}\n默认运行全部步骤；--static 跳过测试，只运行类型检查和各项护栏。`);
  process.exit(0);
}

for (const { label, command } of values.static ? STEPS.filter((step) => step !== TEST_STEP) : STEPS) {
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

if (values.static && !process.exitCode) console.log('\n[verify] 静态检查通过（未运行测试）');

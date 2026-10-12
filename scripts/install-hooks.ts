/*
 * Install the versioned commit-msg hook through pnpm's prepare lifecycle.
 * Use a repository-local relative hooksPath so every worktree reads its own
 * .githooks directory. --help has no side effects; no pre-commit hook is added.
 */
import { execFileSync } from 'node:child_process';
import { runCheckCommand, usageError } from './cli.ts';

process.exitCode = await runCheckCommand('node scripts/install-hooks.ts（无需参数）', (args) => {
  if (args.length) throw usageError('此命令无需参数。');
  execFileSync('git', ['config', '--local', 'core.hooksPath', '.githooks'], { stdio: 'pipe' });
  console.log('已启用提交信息钩子：.githooks/commit-msg');
  return [];
});

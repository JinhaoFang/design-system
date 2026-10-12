/*
 * Check final messages of all non-merge commits in base..HEAD. Resolve the base
 * as a commit before constructing the range; never strip editor-like # lines.
 * The explicit source branch also works for CI's detached HEAD. Report every
 * failing commit by full hash, and preserve the shared CLI exit-code contract.
 */
import { execFileSync } from 'node:child_process';
import { checkCommitMessage } from './check-commit-message.ts';
import { runCheckCommand, usageError } from './cli.ts';

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', stdio: 'pipe' });
}

process.exitCode = await runCheckCommand('pnpm check:commits <起点> <来源分支名>', (args) => {
  const [base, branch, ...extra] = args;
  if (!base || !branch || extra.length) throw usageError('请提供起点和来源分支名。');
  const start = git(['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`]).trim();
  const commits = git(['rev-list', '--no-merges', `${start}..HEAD`]).trim().split('\n').filter(Boolean);
  const issues: string[] = [];
  let failed = 0;
  for (const commit of commits) {
    const message = git(['show', '--no-patch', '--format=%B', commit]);
    const violations = checkCommitMessage(message, branch);
    const label = `${commit} ${message.split('\n')[0]}`;
    if (violations.length === 0) {
      console.log(`通过：${label}`);
      continue;
    }
    failed += 1;
    issues.push(`未通过：${label}`, ...violations.map(({ rule, message }) => `规则 ${rule}：${message}`));
  }
  const summary = `${commits.length} 个非合并提交（${base}..HEAD，分支 ${branch}）`;
  if (failed) issues.push(`提交信息检查未通过：${failed}/${summary}。`);
  else console.log(`提交信息检查通过：${summary}。`);
  return issues;
});

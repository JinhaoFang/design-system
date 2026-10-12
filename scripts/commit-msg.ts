/*
 * Validate Git's message file through the shared checker and CLI contract.
 * Run from the repository root; skip only when MERGE_HEAD exists. The current
 * branch is empty in detached HEAD. Strip editor # lines and scissors content;
 * range checks instead inspect final messages without stripping.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { checkCommitMessage } from './check-commit-message.ts';
import { runCheckCommand, usageError } from './cli.ts';

process.exitCode = await runCheckCommand('node scripts/commit-msg.ts <提交信息文件>', (args) => {
  const [path, ...extra] = args;
  if (!path || extra.length) throw usageError('请提供一个提交信息文件。');
  const mergeHead = execFileSync('git', ['rev-parse', '--git-path', 'MERGE_HEAD'], {
    encoding: 'utf8', stdio: 'pipe',
  }).trim();
  if (existsSync(mergeHead)) return [];
  const branch = execFileSync('git', ['branch', '--show-current'], {
    encoding: 'utf8', stdio: 'pipe',
  }).trim();
  return checkCommitMessage(readFileSync(path, 'utf8'), branch, { stripComments: true })
    .map(({ rule, message }) => `规则 ${rule}：${message}`);
});

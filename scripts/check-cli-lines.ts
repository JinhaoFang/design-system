/*
 * Guard docs/cli.md against physical lines longer than 160 Unicode code points.
 * Run from the repository root; an optional file path supports manual checks
 * and command-driven fixtures without expanding the default document scope.
 * Count Markdown syntax and whitespace, excluding line terminators. Skip pipe
 * table rows and backtick/tilde fenced code; closing fences must
 * use the same character and at least the opening run length. Use shared CLI
 * diagnostics and exit codes: 0 clean, 1 violations, 2 usage/environment errors.
 */
import { readFileSync } from 'node:fs';
import { runCheckCommand, usageError } from './cli.ts';

const MAX_LINE_LENGTH = 160;

process.exitCode = await runCheckCommand('node scripts/check-cli-lines.ts [文件路径（默认 docs/cli.md）]', (args) => {
  if (args.length > 1 || args.some((arg) => arg.startsWith('-'))) {
    throw usageError('最多提供一个文件路径，不接受其他选项。');
  }
  const path = args[0] ?? 'docs/cli.md';
  const lines = readFileSync(path, 'utf8').split(/\r\n|\n|\r/);
  const issues: string[] = [];
  let fence: { character: string; length: number } | undefined;
  let table = false;
  const tableSeparator = /^ {0,3}\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)+\|?[ \t]*$/;

  for (const [index, line] of lines.entries()) {
    if (fence) {
      const closing = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line)?.[1];
      if (closing && closing[0] === fence.character && closing.length >= fence.length) fence = undefined;
      continue;
    }
    const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (opening && (opening[1]![0] === '~' || !opening[2]!.includes('`'))) {
      fence = { character: opening[1]![0]!, length: opening[1]!.length };
      table = false;
      continue;
    }
    if (tableSeparator.test(lines[index + 1] ?? '') && line.includes('|')) table = true;
    if (table && !line.includes('|')) table = false;
    if (/^ {0,3}\|/.test(line) || table) continue;
    const length = Array.from(line).length;
    if (length > MAX_LINE_LENGTH) {
      issues.push(`${path}:${index + 1} 长度 ${length} 个字符，超过上限 ${MAX_LINE_LENGTH}。`);
    }
  }
  return issues;
});

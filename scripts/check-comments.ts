/*
 * Check tracked TS/JS working-tree files via the TypeScript 6 compiler API;
 * TypeScript 7 remains the typechecker and does not expose createSourceFile.
 * AST literal spans protect strings, regexps and template text while scanning
 * comments. Only the first header block or consecutive header line comments
 * after an optional shebang are allowed; directives have no exemptions.
 * Run node scripts/check-comments.ts [repository-root]; use the shared CLI
 * contract for Chinese diagnostics and exit codes 0 (clean), 1 (violations), 2
 * (usage/environment errors). Missing tracked files are pending deletions.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript-parser';
import { runCheckCommand, usageError } from './cli.ts';

function checkFile(path: string, text: string): string[] {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const spans: { start: number; end: number }[] = [];
  function visit(node: ts.Node): void {
    if (
      ts.isStringLiteralLike(node) || ts.isRegularExpressionLiteral(node) ||
      ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)
    ) {
      spans.push({ start: node.getStart(source), end: node.end });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  spans.sort((a, b) => a.start - b.start);
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, text);
  const issues: string[] = [];
  const prefixEnd = ts.getShebang(text)?.length ?? 0;
  let headerEnd = prefixEnd;
  let headerLine = false;
  let headerStarted = false;
  let spanIndex = 0;

  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    const start = scanner.getTokenPos();
    while (spans[spanIndex] && spans[spanIndex]!.end <= start) spanIndex += 1;
    const span = spans[spanIndex];
    if (span && start >= span.start && start < span.end) {
      scanner.setTextPos(span.end);
      continue;
    }
    if (token !== ts.SyntaxKind.SingleLineCommentTrivia && token !== ts.SyntaxKind.MultiLineCommentTrivia) continue;
    const gap = text.slice(headerEnd, start);
    const lineComment = token === ts.SyntaxKind.SingleLineCommentTrivia;
    const firstHeader = !headerStarted && /^\s*$/.test(gap);
    const continuedHeader = headerStarted && headerLine && lineComment &&
      /^[^\S\r\n\u2028\u2029]*(?:\r\n|[\r\n\u2028\u2029])[^\S\r\n\u2028\u2029]*$/.test(gap);
    if (firstHeader || continuedHeader) {
      headerStarted = true;
      headerLine = lineComment;
      headerEnd = scanner.getTextPos();
      continue;
    }
    const line = source.getLineAndCharacterOfPosition(start).line + 1;
    issues.push(`${path}:${line} 注释只能写在文件头的第一段说明中（可选 shebang 后的一段块注释或连续行注释）。`);
  }
  return issues;
}

process.exitCode = await runCheckCommand('node scripts/check-comments.ts [仓库根目录]', (args) => {
  if (args.length > 1 || args.some((arg) => arg.startsWith('-'))) {
    throw usageError('最多提供一个仓库根目录，不接受其他选项。');
  }
  const root = resolve(args[0] ?? process.cwd());
  const paths = execFileSync('git', ['ls-files', '--cached', '-z'], {
    cwd: root, encoding: 'utf8', stdio: 'pipe',
  }).split('\0');
  const issues: string[] = [];
  for (const path of [...new Set(paths)].filter((path) => /\.(?:ts|mts|cts|js|mjs|cjs)$/.test(path)).sort()) {
    let text: string;
    try {
      text = readFileSync(resolve(root, path), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    issues.push(...checkFile(path, text));
  }
  return issues;
});

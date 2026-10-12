/*
 * node scripts/check-doc-commands.ts [repository-root]: inspect backtick spans
 * and fences in tracked root rules (AGENTS/CLAUDE/README/GLOSSARY), docs Markdown
 * except reports/ADR, and tracked .agents/.claude skill Markdown. Read scripts
 * and the data-only src/cli-commands.json registry; never execute document text
 * or import CLI code. pnpm's static snapshot must match packageManager.
 * Check literal command names even when their arguments contain placeholders.
 * Node entry paths are repository-relative tracked files, normalized lexically;
 * ignored untracked paths, options, placeholders, dynamic and absolute paths
 * are skipped. Deleted tracked documents are skipped. Print scan counts and
 * file:line command reason diagnostics via runCheckCommand (0/1/2 contract).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { posix, resolve, win32 } from 'node:path';
import { runCheckCommand, usageError } from './cli.ts';
import { PNPM_BUILTINS, PNPM_BUILTINS_VERSION } from './pnpm-builtins.ts';

const ROOT_RULES = new Set(['AGENTS.md', 'CLAUDE.md', 'README.md', 'GLOSSARY.md']);
const VALUE_OPTIONS = new Set([
  '-C', '--dir', '--filter', '-F', '--filter-prod', '--reporter', '--registry',
  '--store-dir', '--state-dir', '--loglevel', '--workspace-concurrency',
]);

function isRuleDocument(path: string): boolean {
  return ROOT_RULES.has(path) || (path.endsWith('.md') && (
    (path.startsWith('docs/') && !/^docs\/(?:reports|adr)\//.test(path)) ||
    /^\.(?:agents|claude)\/skills\/[^/]+\//.test(path)
  ));
}

function isDynamic(value: string): boolean {
  return /<[^>\r\n]+>|[$`~*?{}]/.test(value);
}

function commandName(tokens: string[]): string | undefined {
  while (tokens[0]?.startsWith('-')) {
    const option = tokens.shift()!;
    if (VALUE_OPTIONS.has(option)) tokens.shift();
  }
  return tokens.shift();
}

function readDsCommands(root: string): Set<string> {
  const table: unknown = JSON.parse(readFileSync(resolve(root, 'src/cli-commands.json'), 'utf8'));
  if (!table || typeof table !== 'object' || Array.isArray(table)) {
    throw new Error('ds 子命令表必须是按处理器分组的命令数组。');
  }
  const groups: unknown[] = Object.values(table);
  if (!groups.length || !groups.every((group) => Array.isArray(group) && group.every((name) => typeof name === 'string'))) {
    throw new Error('ds 子命令表必须是按处理器分组的命令数组。');
  }
  return new Set(groups.flat() as string[]);
}

function ignoredNodePaths(root: string, files: string[]): Set<string> {
  const ignored = new Set<string>();
  const parts = files.map((file) => ({ file, segments: file.split('/').filter(Boolean) }));
  for (let depth = 1; depth <= Math.max(...parts.map(({ segments }) => segments.length)); depth += 1) {
    const candidates = parts.filter(({ file, segments }) => !ignored.has(file) && segments.length >= depth);
    if (!candidates.length) break;
    const prefixes = [...new Set(candidates.map(({ segments }) => segments.slice(0, depth).join('/')))];
    const result = spawnSync('git', ['check-ignore', '--stdin', '-z'], {
      cwd: root, encoding: 'utf8', input: prefixes.join('\0') + '\0',
    });
    if (result.error) throw result.error;
    if (result.status !== 0 && result.status !== 1) throw new Error('无法读取 git 忽略规则。');
    const ignoredPrefixes = new Set(result.stdout.split('\0').filter(Boolean));
    for (const { file, segments } of candidates) {
      if (ignoredPrefixes.has(segments.slice(0, depth).join('/'))) ignored.add(file);
    }
  }
  return ignored;
}

process.exitCode = await runCheckCommand('node scripts/check-doc-commands.ts [仓库根目录]', (args) => {
  if (args.length > 1 || args[0]?.startsWith('-')) throw usageError('最多提供一个仓库根目录。');
  const root = resolve(args[0] ?? process.cwd());
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const scripts = new Set(Object.keys(manifest.scripts ?? {}));
  const dsCommands = readDsCommands(root);
  const tracked = new Set(execFileSync('git', ['ls-files', '--cached', '-z'], {
    cwd: root, encoding: 'utf8', stdio: 'pipe',
  }).split('\0').filter(Boolean));
  const issues: string[] = [];
  const version = /^pnpm@([^+]+)(?:\+.*)?$/.exec(manifest.packageManager ?? '')?.[1];
  if (version !== PNPM_BUILTINS_VERSION) {
    issues.push(`package.json:1 pnpm 内置命令快照版本 ${PNPM_BUILTINS_VERSION} 与 packageManager 版本 ${version ?? manifest.packageManager ?? '未声明'} 不一致；请按 scripts/pnpm-builtins.ts 文件头更新快照和版本。`);
  }
  const nodeCandidates: { file: string; diagnostic: string }[] = [];
  let files = 0;
  let commands = 0;
  let skipped = 0;
  for (const path of [...tracked].filter(isRuleDocument).sort()) {
    const absolute = resolve(root, path);
    if (!existsSync(absolute)) continue;
    files += 1;
    const text = readFileSync(absolute, 'utf8');
    for (const span of text.matchAll(/(?<!`)(`+)(?!`)([\s\S]*?)\1(?!`)/g)) {
      for (const invocation of span[2]!.matchAll(
        /(?:^|[\r\n]|&&|\|\||[;|])\s*(pnpm|node)\s+((?:"[^"\r\n]*"|'[^'\r\n]*'|[^\r\n;&|])*)/g,
      )) {
        commands += 1;
        const command = `${invocation[1]} ${invocation[2]!.trim()}`;
        const tokens = (invocation[2]!.match(/"[^"]*"|'[^']*'|[^\s]+/g) ?? [])
          .map((token) => token.replace(/^(?:"(.*)"|'(.*)')$/, '$1$2'));
        const offset = span.index + span[1]!.length + invocation.index + invocation[0].indexOf(invocation[1]!);
        const line = text.slice(0, offset).split('\n').length;
        const diagnostic = `${path}:${line} ${command}`;
        if (invocation[1] === 'node') {
          const file = tokens[0];
          if (!file || file.startsWith('-') || isDynamic(file) || posix.isAbsolute(file) || win32.isAbsolute(file)) {
            skipped += 1;
            continue;
          }
          const normalized = posix.normalize(file);
          if (normalized === '..' || normalized.startsWith('../')) {
            issues.push(`${diagnostic} node 脚本文件未进 git 或不存在：${file}`);
          } else if (!tracked.has(normalized)) nodeCandidates.push({ file: normalized, diagnostic });
          continue;
        }
        let name = commandName(tokens);
        const explicitRun = name === 'run' || name === 'run-script';
        if (explicitRun) name = commandName(tokens);
        if (!name || isDynamic(name)) {
          skipped += 1;
          continue;
        }
        if (!scripts.has(name) && (explicitRun || !PNPM_BUILTINS.has(name))) {
          issues.push(`${diagnostic} 项目脚本${explicitRun ? '' : '或 pnpm 内置命令'}不存在：${name}`);
          continue;
        }
        if (name === 'ds') {
          const subcommand = tokens[0];
          if (subcommand && !subcommand.startsWith('-') && !isDynamic(subcommand) && !dsCommands.has(subcommand)) {
            issues.push(`${diagnostic} ds 子命令不存在：${subcommand}`);
          }
        }
      }
    }
  }
  if (nodeCandidates.length) {
    const ignored = ignoredNodePaths(root, nodeCandidates.map(({ file }) => file));
    for (const { file, diagnostic } of nodeCandidates) {
      if (ignored.has(file)) skipped += 1;
      else issues.push(`${diagnostic} node 脚本文件未进 git 或不存在：${file}`);
    }
  }
  console.log(`文档命令检查：扫描 ${files} 个文件、${commands} 条命令（跳过 ${skipped} 条），${issues.length} 个问题。`);
  return issues;
});

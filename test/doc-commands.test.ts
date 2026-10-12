/*
 * Drive the document checker CLI against tracked temporary repositories.
 * Assert public exit codes, diagnostics, scope and counts; fixture scripts and
 * the CLI entry contain traps so merely documenting them cannot execute them.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, test } from 'vitest';

const command = fileURLToPath(new URL('../scripts/check-doc-commands.ts', import.meta.url));
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(files: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ds-doc-commands-'));
  roots.push(root);
  const git = (...args: string[]) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
  };
  const write = (path: string, content: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  };
  const defaults = {
    'package.json': JSON.stringify({
      packageManager: 'pnpm@12.7.0',
      scripts: { ds: 'node src/cli.ts', qa: 'exit 99', verify: 'exit 99' },
    }),
    'src/cli-commands.json': JSON.stringify({ core: ['build', 'preview'], exemplars: ['validate-exemplars'] }),
    'src/cli.ts': 'throw new Error("CLI was executed");',
  };
  for (const [path, content] of Object.entries({ ...defaults, ...files })) write(path, content);
  git('init', '--quiet');
  git('add', '--', ...Object.keys({ ...defaults, ...files }));
  return { root, git, write };
}

function run(...args: string[]) {
  return spawnSync(process.execPath, [command, ...args], { encoding: 'utf8' });
}

test('built-ins, aliases, scripts and ds commands pass without execution', () => {
  const { root } = fixture({
    'AGENTS.md': [
      '`pnpm install --frozen-lockfile` `pnpm exec never-execute` `pnpm run qa`',
      '`pnpm -s qa` `pnpm --filter package run qa` `pnpm run-script verify`',
      '`pnpm ds build --system <dir>` `pnpm run ds preview` `pnpm ds validate-exemplars`',
      '`pnpm pipeline build` `pnpm dist-tags ls package` `pnpm runtime` `pnpm ss`',
      '`pnpm licences` `pnpm owners` `pnpm change` `pnpm with current --version`',
      '`pnpm completion-server` `pnpm pm clean` `pnpm stop`',
    ].join('\n'),
  });
  const result = run(root);
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout).toContain('扫描 1 个文件、20 条命令');
});

test('missing built-ins, scripts and ds commands report every position', () => {
  const { root } = fixture({
    'docs/cli.md': [
      '# Commands',
      '```bash',
      'pnpm <command>',
      'pnpm absent && pnpm run removed',
      'pnpm run install',
      'pnpm ds missing --system <dir>',
      'pnpm run ds removed',
      'pnpm server',
      '```',
      'Outside backticks: pnpm outside',
    ].join('\n'),
  });
  const result = run(root);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('docs/cli.md:4 pnpm absent 项目脚本或 pnpm 内置命令不存在');
  expect(result.stderr).toContain('docs/cli.md:4 pnpm run removed 项目脚本不存在');
  expect(result.stderr).toContain('docs/cli.md:5 pnpm run install 项目脚本不存在');
  expect(result.stderr).toContain('docs/cli.md:6 pnpm ds missing --system <dir> ds 子命令不存在');
  expect(result.stderr).toContain('docs/cli.md:7 pnpm run ds removed ds 子命令不存在');
  expect(result.stderr).toContain('docs/cli.md:8 pnpm server 项目脚本或 pnpm 内置命令不存在');
  expect(result.stderr).not.toContain('pnpm outside');
  expect(result.stdout).toContain('6 个问题');
});

test('node paths use tracked files, with quoted spaces and lexical normalization', () => {
  const { root, write } = fixture({
    'scripts/exists.ts': 'throw new Error("node script was executed");',
    'scripts/with space.ts': 'throw new Error("node script was executed");',
    'docs/cli.md': [
      '`node scripts/exists.ts --help` `node "./scripts/with space.ts"`',
      '`node scripts/../scripts/exists.ts`',
      '`node scripts/missing.ts`',
      '`node scripts/local.ts`',
      '`node scripts/`',
    ].join('\n'),
  });
  write('scripts/local.ts', 'export {};');
  const result = run(root);
  expect(result.status).toBe(1);
  for (const [line, path] of [[3, 'scripts/missing.ts'], [4, 'scripts/local.ts'], [5, 'scripts/']] as const) {
    expect(result.stderr).toContain(`docs/cli.md:${line} node ${path} node 脚本文件未进 git 或不存在`);
  }
  expect(result.stdout).toContain('3 个问题');
});

test('placeholders, dynamic and absolute paths, options and ignored paths skip', () => {
  const { root } = fixture({
    '.gitignore': 'references\n.agents\n.claude/skills/third-party/\n',
    'AGENTS.md': [
      '`pnpm <command>` `pnpm run <script>` `pnpm ds <subcommand>`',
      '`pnpm --version` `pnpm ds` `pnpm ds --help`',
      '`node <path>/script.ts` `node "$ROOT/script.ts"` `node scripts/*.ts`',
      '`node /absolute/file.ts` `node "C:\\external\\file.ts"` `node ~/file.ts`',
      '`node -e "throw new Error()"` `node --test`',
      '`node references/missing.mjs` `node .agents/skills/missing/entry.ts`',
      '`node .claude/skills/third-party/missing.ts`',
    ].join('\n'),
  });
  symlinkSync(join(root, 'src'), join(root, 'references'));
  const result = run(root);
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout).toContain('0 个问题');
});

test('scan tracked root rules, docs and owned skills but exclude historical and untracked documents', () => {
  const checked = ['AGENTS.md', 'CLAUDE.md', 'README.md', 'GLOSSARY.md', 'docs/new-rule.md',
    '.claude/skills/owned/SKILL.md', '.agents/skills/owned/notes.md'];
  const ignored = ['docs/reports/old.md', 'docs/adr/old.md', 'systems/mini/SYSTEM.md', 'library/craft.md'];
  const { root, write } = fixture(Object.fromEntries([...checked, ...ignored].map((path) => [path, '`pnpm missing`'])));
  write('docs/local.md', '`pnpm missing`');
  write('.claude/skills/untracked/SKILL.md', '`pnpm missing`');
  const result = run(root);
  expect(result.status).toBe(1);
  for (const path of checked) expect(result.stderr).toContain(`${path}:1 pnpm missing`);
  for (const path of [...ignored, 'docs/local.md']) expect(result.stderr).not.toContain(path);
  expect(result.stdout).toContain(`扫描 ${checked.length} 个文件、${checked.length} 条命令`);
});

test('tracked documents and node files remain valid git targets even when ignored', () => {
  const { root, write } = fixture({
    'docs/tracked.md': '`pnpm absent` `node scripts/exists.ts`',
    'scripts/exists.ts': 'export {};',
  });
  write('.gitignore', 'docs/\nscripts/\n');
  const result = run(root);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('docs/tracked.md:1 pnpm absent');
  expect(result.stdout).toContain('1 个问题');
});

test.each(['pnpm@12.7.0', 'pnpm@12.7.0+sha512.fixture'])('snapshot version accepts %s', (packageManager) => {
  const { root } = fixture({ 'package.json': JSON.stringify({ packageManager }) });
  const result = run(root);
  expect(result.status, result.stderr).toBe(0);
});

test.each(['pnpm@12.8.0', 'npm@12.7.0', undefined])('version mismatch %s fails with update instructions', (packageManager) => {
  const { root } = fixture({ 'package.json': JSON.stringify({ packageManager }) });
  const result = run(root);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('package.json:1 pnpm 内置命令快照版本 12.7.0');
  expect(result.stderr).toContain(packageManager?.replace(/^pnpm@/, '') ?? '未声明');
  expect(result.stderr).toContain('scripts/pnpm-builtins.ts 文件头更新快照和版本');
});

test('help succeeds, invalid arguments and unreadable registries exit 2', () => {
  const help = run('--help');
  expect(help.status).toBe(0);
  expect(help.stdout).toContain('用法：');
  expect(help.stderr).toBe('');
  for (const args of [['--unknown'], ['one', 'two']]) {
    const result = run(...args);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('用法：');
  }
  const { root, write } = fixture();
  write('src/cli-commands.json', '{"core": "bad table"}');
  const result = run(root);
  expect(result.status).toBe(2);
  expect(result.stderr).toContain('ds 子命令表必须是');
});

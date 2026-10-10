/* Behavior tests for the build-and-check entry point (the only test seam): fixture system + fixture works in, report + artifacts + exit status out. */
import { execFile } from 'node:child_process';
import { cp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, test } from 'vitest';
import { fixtures, patchedWork, pngSize, run, tempDir } from './helpers.ts';

const execFileAsync = promisify(execFile);

describe('clean work', () => {
  test('has no findings, exits 0 and renders a 1080x1440 PNG for xiaohongshu', async () => {
    const result = await run(fixtures.work('clean'));
    expect(result.report.findings).toEqual([]);
    expect(result.exitCode).toBe(0);
    expect(result.artifacts.images).toHaveLength(1);
    expect(await pngSize(result.artifacts.images[0]!)).toEqual({ width: 1080, height: 1440 });
  });

  test.each([
    ['wechat-cover', 900, 383],
    ['xiaohongshu', 1080, 1440],
    ['square', 1080, 1080],
  ])('renders the %s canvas at exactly %dx%d', async (canvas, width, height) => {
    const work = await patchedWork('clean', (w) => {
      w.canvas = canvas;
    });
    const result = await run(work);
    expect(result.report.findings).toEqual([]);
    expect(await pngSize(result.artifacts.images[0]!)).toEqual({ width, height });
  });
});

describe('texture floor: pure black and pure white', () => {
  test('pure black text is an error located at the unit, layout and slot, and the exit status is non-zero', async () => {
    const result = await run(fixtures.work('black'));
    expect(result.exitCode).not.toBe(0);
    expect(result.report.findings).toEqual([
      expect.objectContaining({
        ruleId: 'texture-floor/pure-black-white',
        category: 'texture-floor',
        severity: 'error',
        location: expect.objectContaining({ unit: 'title', layout: 'blackout', slot: 'title' }),
      }),
    ]);
  });

  test('pure white background is an error located at the unit and layout', async () => {
    const result = await run(fixtures.work('white'));
    expect(result.exitCode).not.toBe(0);
    expect(result.report.findings).toEqual([
      expect.objectContaining({
        ruleId: 'texture-floor/pure-black-white',
        severity: 'error',
        location: expect.objectContaining({ unit: 'title', layout: 'whiteout' }),
      }),
    ]);
  });
});

describe('report files', () => {
  test('are written as JSON and Chinese Markdown grouped by category with rule, severity, location and message', async () => {
    const result = await run(fixtures.work('black'));
    const json = JSON.parse(await readFile(result.artifacts.reportJson, 'utf8'));
    expect(json.summary).toEqual({ errors: 1, warnings: 0 });
    expect(json.findings[0]).toEqual({
      ruleId: 'texture-floor/pure-black-white',
      category: 'texture-floor',
      severity: 'error',
      location: expect.objectContaining({ unit: 'title', layout: 'blackout', slot: 'title', selector: expect.any(String) }),
      message: expect.stringContaining('纯黑'),
    });

    const markdown = await readFile(result.artifacts.reportMarkdown, 'utf8');
    expect(markdown).toContain('## 质感底线');
    expect(markdown).toContain('错误');
    expect(markdown).toContain('texture-floor/pure-black-white');
    expect(markdown).toContain('槽位 title');
  });

  test('state that nothing was found for a clean work', async () => {
    const result = await run(fixtures.work('clean'));
    expect(await readFile(result.artifacts.reportMarkdown, 'utf8')).toContain('没有发现');
    expect(JSON.parse(await readFile(result.artifacts.reportJson, 'utf8')).findings).toEqual([]);
  });
});

describe('validation before rendering', () => {
  test('fails when the work references a layout the system does not have', async () => {
    const work = await patchedWork('clean', (w) => {
      w.sequence[0].layout = 'no-such-layout';
    });
    await expect(run(work)).rejects.toThrow(/no-such-layout/);
  });

  test('fails when the work references a unit that does not exist', async () => {
    const work = await patchedWork('clean', (w) => {
      w.sequence[0].unit = 'no-such-unit';
    });
    await expect(run(work)).rejects.toThrow(/no-such-unit/);
  });

  test('fails when the work fills a slot that does not exist', async () => {
    const work = await patchedWork('clean', (w) => {
      w.sequence[0].content.footnote = '多出来的槽位';
    });
    await expect(run(work)).rejects.toThrow(/footnote/);
  });

  test('fails when content exceeds the slot character limit', async () => {
    const work = await patchedWork('clean', (w) => {
      w.sequence[0].content.title = '这是一个明显超过十六个字上限的非常非常非常长的标题';
    });
    await expect(run(work)).rejects.toThrow(/字数上限/);
  });
});

describe('fonts', () => {
  test('a font file that cannot be loaded fails the build instead of rendering with a fallback', async () => {
    const cache = join(await tempDir(), 'font-cache');
    await cp(fixtures.fontCache, cache, { recursive: true });
    await writeFile(join(cache, 'NotoSansSC-Regular.subset.woff2'), 'not a font');
    await expect(run(fixtures.work('clean'), { fontCacheDir: cache })).rejects.toThrow(/字体加载失败/);
  });

  test('a font missing from the local font cache fails the build and points at fetch-fonts', async () => {
    const cache = await tempDir('ds-empty-cache-');
    await expect(run(fixtures.work('clean'), { fontCacheDir: cache })).rejects.toThrow(/本地字体缓存[\s\S]*fetch-fonts/);
  });
});

describe('command line entry', () => {
  const cli = (work: string, out: string) =>
    execFileAsync(
      process.execPath,
      ['src/cli.ts', 'build', '--system', fixtures.system, '--work', work, '--out', out, '--library', fixtures.library, '--font-cache', fixtures.fontCache],
      { cwd: join(import.meta.dirname, '..') },
    );

  test('exits 0 for a clean work and writes the output directory', async () => {
    const out = await tempDir();
    await cli(fixtures.work('clean'), out);
    expect(JSON.parse(await readFile(join(out, 'report.json'), 'utf8')).findings).toEqual([]);
    expect(await pngSize(join(out, 'social-xiaohongshu.png'))).toEqual({ width: 1080, height: 1440 });
  });

  test('exits non-zero when the report has errors', async () => {
    const out = await tempDir();
    await expect(cli(fixtures.work('black'), out)).rejects.toMatchObject({ code: 1 });
    expect(await readFile(join(out, 'report.md'), 'utf8')).toContain('texture-floor/pure-black-white');
  });

  test('exits non-zero with the reason when validation fails', async () => {
    const work = await patchedWork('clean', (w) => {
      w.sequence[0].layout = 'no-such-layout';
    });
    await expect(cli(work, await tempDir())).rejects.toMatchObject({ code: 2, stderr: expect.stringContaining('no-such-layout') });
  });
});

/*
 * Behavior tests for line detection in vertical writing (each column is a line; line start is the top, line end the bottom), driven only through buildAndCheck.
 * The vertical layouts are written into a temp copy of the fixture system so the shared fixture system (overview and regression builds) stays unchanged.
 * Block height is fixed at 7.25 em, so the column breaks after seven characters.
 */
import { cp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { fixtures, patchedWork, run, tempDir } from './helpers.ts';

function layout(writingMode: string, lineBreak: string): string {
  return `<style>
  :scope {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: var(--ds-space-4);
    display: flex;
    flex-direction: column;
    justify-content: center;
    background: var(--ds-color-paper);
    color: var(--ds-color-ink);
    font-family: var(--ds-font-body);
  }
  .title { font-weight: 400; font-size: var(--ds-type-0); line-height: 1.5; margin: 0; writing-mode: ${writingMode}; height: calc(var(--ds-type-0) * 7.25); line-break: ${lineBreak}; }
</style>
<h1 class="title">{{ slots.title }}</h1>
`;
}

async function verticalSystem(): Promise<string> {
  const dir = await tempDir('ds-vertical-');
  await cp(fixtures.system, dir, { recursive: true });
  const titles = join(dir, 'layouts', 'social', 'title');
  await writeFile(join(titles, 'vertical-rl.liquid'), layout('vertical-rl', 'auto'));
  await writeFile(join(titles, 'vertical-lr.liquid'), layout('vertical-lr', 'auto'));
  await writeFile(join(titles, 'sideways-lr.liquid'), layout('sideways-lr', 'auto'));
  await writeFile(join(titles, 'vertical-anywhere.liquid'), layout('vertical-rl', 'anywhere'));
  return dir;
}

async function runVertical(layoutName: string, title: string) {
  const work = await patchedWork('cjk-orphan', (w) => {
    w.sequence[0].layout = layoutName;
    w.sequence[0].content.title = title;
  });
  return run(work, { systemDir: await verticalSystem() });
}

describe('cjk vertical writing', () => {
  const PUNCTUATED = '发布二点零，新版。「更新」';

  test.each(['vertical-rl', 'vertical-lr', 'sideways-lr'])('%s: punctuation that sits correctly in a column has no findings', async (name) => {
    const result = await runVertical(name, PUNCTUATED);
    expect(result.report.findings).toEqual([]);
    expect(result.exitCode).toBe(0);
  });

  test('a column that genuinely starts with a period is an error at the column start', async () => {
    const result = await runVertical('vertical-anywhere', '发布二点零新版。更新很快');
    expect(result.exitCode).not.toBe(0);
    expect(result.report.findings).toEqual([
      expect.objectContaining({ ruleId: 'cjk-typography/line-start-forbidden', severity: 'error', message: expect.stringContaining('。') }),
    ]);
  });

  test('a column that genuinely ends with an opening quote is an error at the column end', async () => {
    const result = await runVertical('vertical-anywhere', '发布二点零新「版本」更新');
    expect(result.report.findings).toEqual([
      expect.objectContaining({ ruleId: 'cjk-typography/line-end-forbidden', severity: 'error', message: expect.stringContaining('「') }),
    ]);
  });

  test.each(['vertical-rl', 'vertical-lr'])('%s: a last column holding a single Han character is an orphan warning', async (name) => {
    const result = await runVertical(name, '发布二点零新版本');
    expect(result.exitCode).toBe(0);
    expect(result.report.findings).toEqual([
      expect.objectContaining({ ruleId: 'cjk-typography/orphan-line', severity: 'warning', message: expect.stringContaining('本') }),
    ]);
  });

  test('a single column is not an orphan', async () => {
    const result = await runVertical('vertical-rl', '发布二点零');
    expect(result.report.findings).toEqual([]);
  });
});

/* Behavior tests for the Chinese typesetting rules, driven only through buildAndCheck with fixture works (see build-and-check.test.ts). */
import { describe, expect, test } from 'vitest';
import { fixtures, patchedWork, run } from './helpers.ts';

describe('cjk line edges (kinsoku)', () => {
  test('a period at the start of a line is an error located at the unit, layout and slot', async () => {
    const result = await run(fixtures.work('cjk-line-start'));
    expect(result.exitCode).not.toBe(0);
    expect(result.report.findings).toEqual([
      expect.objectContaining({
        ruleId: 'cjk-typography/line-start-forbidden',
        category: 'cjk-typography',
        severity: 'error',
        location: expect.objectContaining({ unit: 'title', layout: 'column-anywhere', slot: 'title' }),
        message: expect.stringContaining('。'),
      }),
    ]);
  });

  test('an ellipsis at the start of a line is only a warning (strict-level kinsoku)', async () => {
    const work = await patchedWork('cjk-line-start', (w) => {
      w.sequence[0].content.title = '发布二点零新版…更新很快';
    });
    const result = await run(work);
    expect(result.exitCode).toBe(0);
    expect(result.report.findings).toEqual([
      expect.objectContaining({ ruleId: 'cjk-typography/line-start-forbidden', severity: 'warning' }),
    ]);
  });

  test('an opening quote at the end of a line is an error', async () => {
    const result = await run(fixtures.work('cjk-line-end'));
    expect(result.exitCode).not.toBe(0);
    expect(result.report.findings).toEqual([
      expect.objectContaining({
        ruleId: 'cjk-typography/line-end-forbidden',
        severity: 'error',
        location: expect.objectContaining({ unit: 'title', layout: 'column-anywhere', slot: 'title' }),
        message: expect.stringContaining('「'),
      }),
    ]);
  });

  test('the same text under the browser default line breaking, which already avoids bad line edges, has no findings', async () => {
    const result = await run(fixtures.work('cjk-kinsoku-respected'));
    expect(result.report.findings).toEqual([]);
  });
});

describe('cjk orphan', () => {
  test('a last line holding a single Han character is a warning and does not fail the build', async () => {
    const result = await run(fixtures.work('cjk-orphan'));
    expect(result.exitCode).toBe(0);
    expect(result.report.findings).toEqual([
      expect.objectContaining({
        ruleId: 'cjk-typography/orphan-line',
        category: 'cjk-typography',
        severity: 'warning',
        location: expect.objectContaining({ unit: 'title', layout: 'column', slot: 'title' }),
        message: expect.stringContaining('本'),
      }),
    ]);
  });

  test('a last line of a single Han character followed by punctuation is still an orphan', async () => {
    const work = await patchedWork('cjk-orphan', (w) => {
      w.sequence[0].content.title = '发布二点零新版本。';
    });
    const result = await run(work);
    expect(result.report.findings).toEqual([expect.objectContaining({ ruleId: 'cjk-typography/orphan-line' })]);
  });

  test('a single-line paragraph is not an orphan', async () => {
    const work = await patchedWork('cjk-orphan', (w) => {
      w.sequence[0].content.title = '发布';
    });
    expect((await run(work)).report.findings).toEqual([]);
  });
});

describe('cjk spacing', () => {
  test('Chinese touching Latin text across an inline element boundary is an error', async () => {
    const result = await run(fixtures.work('cjk-unspaced-inline'));
    expect(result.report.findings).toEqual([
      expect.objectContaining({
        ruleId: 'cjk-typography/missing-spacing',
        severity: 'error',
        location: expect.objectContaining({ unit: 'title', layout: 'unspaced-inline' }),
      }),
    ]);
  });

  test('inline elements separated by whitespace are not reported', async () => {
    const result = await run(fixtures.work('cjk-spaced-inline'));
    expect(result.report.findings).toEqual([]);
  });

  test('content with Chinese touching Latin text and digits is spaced at build time and stays finding-free', async () => {
    const result = await run(fixtures.work('cjk-mixed'));
    expect(result.report.findings).toEqual([]);
    expect(result.exitCode).toBe(0);
  });

  test('Chinese directly touching Latin text written in the layout is an error located at the unit and layout', async () => {
    const result = await run(fixtures.work('cjk-unspaced'));
    expect(result.exitCode).not.toBe(0);
    expect(result.report.findings).toEqual([
      expect.objectContaining({
        ruleId: 'cjk-typography/missing-spacing',
        category: 'cjk-typography',
        severity: 'error',
        location: expect.objectContaining({ unit: 'title', layout: 'unspaced' }),
        message: expect.stringContaining('持M'),
      }),
    ]);
  });
});

/* Behavior tests for the value-compliance rules (color, font size, spacing, radius), driven through buildAndCheck with custom fragments that use or break the fixture system's values. */
import { describe, expect, test } from 'vitest';
import { box, runCustom } from './custom-work.ts';

describe('a compliant custom fragment', () => {
  test('has no findings', async () => {
    const { result } = await runCustom(box());
    expect(result.report.findings).toEqual([]);
    expect(result.exitCode).toBe(0);
  });
});

describe('value-compliance/color', () => {
  const RULE = 'value-compliance/color';

  test('text color outside the system colors is an error located at the custom unit', async () => {
    const { result, findings } = await runCustom(box('color:#336699;'), RULE);
    expect(findings).toEqual([
      expect.objectContaining({
        category: 'value-compliance',
        severity: 'error',
        location: expect.objectContaining({ unit: 'custom' }),
        message: expect.stringContaining('文字颜色'),
      }),
    ]);
    expect(result.exitCode).toBe(1);
  });

  test('background and border colors outside the system colors are errors', async () => {
    const { findings } = await runCustom(box('background:#ccddee;border:2px solid #aa3344;'), RULE);
    expect(findings.map((f) => f.message.slice(0, 3)).sort()).toEqual(['背景色', '边框颜'].sort());
  });

  test.each([
    ['the hex notation of a token', 'color:#2e241d;'],
    ['an rgb() notation', 'color:rgb(46, 36, 29);'],
    ['the oklch token written out', 'color:oklch(0.27 0.02 60);'],
    ['a translucent variant of a system color', 'color:color-mix(in oklch, var(--ds-color-ink) 50%, transparent);'],
    ['a system color in another color space', 'color:color(display-p3 0.1739 0.1436 0.1162);'],
  ])('%s is accepted', async (_name, css) => {
    const { findings } = await runCustom(box(css), RULE);
    expect(findings).toEqual([]);
  });

  test('a color mixed from system colors is not a system color', async () => {
    const { findings } = await runCustom(box('color:color-mix(in oklch, var(--ds-color-ink) 50%, var(--ds-color-paper));'), RULE);
    expect(findings).toHaveLength(1);
  });

  test('a transparent background is not a color violation', async () => {
    const { findings } = await runCustom(box('background:transparent;'), RULE);
    expect(findings).toEqual([]);
  });

  test('colors used by a system shadow are accepted in box-shadow', async () => {
    const { findings } = await runCustom(box('box-shadow:var(--ds-shadow-raised);'), RULE);
    expect(findings).toEqual([]);
  });

  test('a shadow color outside the system is an error', async () => {
    const { findings } = await runCustom(box('box-shadow:2px 4px 12px 0 rgb(200 30 30 / 0.4);'), RULE);
    expect(findings).toEqual([expect.objectContaining({ message: expect.stringContaining('阴影颜色') })]);
  });
});

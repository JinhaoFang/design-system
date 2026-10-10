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

describe('value-compliance/font-size', () => {
  const RULE = 'value-compliance/font-size';

  test('a font size outside the type scale is an error', async () => {
    const { result, findings } = await runCustom(box('font-size:17px;'), RULE);
    expect(findings).toEqual([
      expect.objectContaining({ severity: 'error', category: 'value-compliance', location: expect.objectContaining({ unit: 'custom' }), message: expect.stringContaining('17px') }),
    ]);
    expect(result.exitCode).toBe(1);
  });

  test('sizes within 0.5px of a scale step pass and beyond it fail (social body 40px, ratio 1.5 -> 60px)', async () => {
    expect((await runCustom(box('font-size:60.4px;'), RULE)).findings).toEqual([]);
    expect((await runCustom(box('font-size:59.6px;'), RULE)).findings).toEqual([]);
    expect((await runCustom(box('font-size:60.7px;'), RULE)).findings).toHaveLength(1);
  });

  test('a computed size that lands on the scale passes however it is written', async () => {
    const { findings } = await runCustom(box('font-size:calc(var(--ds-type-0) * 1.5);'), RULE);
    expect(findings).toEqual([]);
  });

  test('slides are judged against the slides base values', async () => {
    const { findings } = await runCustom(box('font-size:17px;'), RULE, 'slides');
    expect(findings).toHaveLength(1);
  });
});

describe('value-compliance/spacing', () => {
  const RULE = 'value-compliance/spacing';

  test('padding outside the space ladder is an error naming the property', async () => {
    const { result, findings } = await runCustom(box('padding:13px;'), RULE);
    expect(findings).toEqual([
      expect.objectContaining({ severity: 'error', category: 'value-compliance', location: expect.objectContaining({ unit: 'custom' }), message: expect.stringContaining('padding') }),
    ]);
    expect(result.exitCode).toBe(1);
  });

  test('margin and gap outside the ladder are errors', async () => {
    const margin = await runCustom(box('margin-bottom:7px;'), RULE);
    expect(margin.findings).toEqual([expect.objectContaining({ message: expect.stringContaining('margin-bottom') })]);
    const gap = await runCustom(`<style>.row{display:flex;gap:10px;margin:0;padding:0}</style><div class="row"><p>甲</p><p>乙</p></div>`, RULE);
    expect(gap.findings.map((f) => f.message).join()).toContain('gap');
  });

  test('tolerance is 0.5px around a ladder value (social space unit 24px)', async () => {
    expect((await runCustom(box('padding:24.4px;'), RULE)).findings).toEqual([]);
    expect((await runCustom(box('padding:24.7px;'), RULE)).findings).toHaveLength(1);
  });

  test('zero, auto margins and normal gaps are fine', async () => {
    const html = `<style>.row{display:flex;margin:0;padding:0}.in{width:300px;margin:0 auto;padding:0}</style><div class="row"><p class="in">甲</p></div>`;
    expect((await runCustom(html, RULE)).findings).toEqual([]);
  });

  test('browser default margins on unstyled elements are reported', async () => {
    const { findings } = await runCustom(`<p>未重置边距</p>`, RULE);
    expect(findings).not.toEqual([]);
  });
});

describe('value-compliance/radius', () => {
  const RULE = 'value-compliance/radius';

  test('a corner radius outside the radius ladder is an error', async () => {
    const { result, findings } = await runCustom(box('border-radius:7px;'), RULE);
    expect(findings).toEqual([
      expect.objectContaining({ severity: 'error', category: 'value-compliance', location: expect.objectContaining({ unit: 'custom' }), message: expect.stringContaining('7px') }),
    ]);
    expect(result.exitCode).toBe(1);
  });

  test('ladder values pass (social space unit 24px, ratio 0.5 -> 12px) and 50% does not', async () => {
    expect((await runCustom(box('border-radius:var(--ds-radius-2);'), RULE)).findings).toEqual([]);
    expect((await runCustom(box('border-radius:12.4px;'), RULE)).findings).toEqual([]);
    expect((await runCustom(box('border-radius:50%;'), RULE)).findings).toHaveLength(1);
  });

  test('only the offending corner is reported', async () => {
    const { findings } = await runCustom(box('border-radius:var(--ds-radius-2) var(--ds-radius-2) 9px var(--ds-radius-2);'), RULE);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain('bottom-right');
  });
});

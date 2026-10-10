/* Behavior tests for texture-floor (hueless gray, shadow direction, radius nesting) and composition ratios, driven through buildAndCheck with fixture works. */
import { describe, expect, test } from 'vitest';
import { fixtures, patchedWork, run } from './helpers.ts';
import { NS, editJson, patchedSystem, tokensFile } from './system-helpers.ts';

describe('texture floor: hueless gray', () => {
  test('a mid-lightness gray text color with no chroma is an error at the custom unit', async () => {
    const result = await run(fixtures.work('gray-text'));
    expect(result.exitCode).not.toBe(0);
    expect(result.report.findings).toEqual([
      expect.objectContaining({
        ruleId: 'texture-floor/hueless-gray',
        category: 'texture-floor',
        severity: 'error',
        location: expect.objectContaining({ unit: 'custom' }),
      }),
    ]);
  });

  test('a gray with a warm hue passes', async () => {
    const result = await run(fixtures.work('warm-gray-text'));
    expect(result.report.findings).toEqual([]);
  });
});

const shadowWork = (shadow: string) =>
  patchedWork('shadow-consistent', (work) => {
    work.sequence[0].custom = work.sequence[0].custom.replace('4px 6px 12px', shadow);
  });

describe('texture floor: shadow direction', () => {
  test('a shadow falling toward the light (system light angle 135) is an error at the shadowed element', async () => {
    const result = await run(fixtures.work('shadow-wrong-direction'));
    expect(result.exitCode).not.toBe(0);
    expect(result.report.findings).toEqual([
      expect.objectContaining({
        ruleId: 'texture-floor/shadow-direction',
        category: 'texture-floor',
        severity: 'error',
        location: expect.objectContaining({ unit: 'custom', selector: expect.stringContaining('div') }),
      }),
    ]);
  });

  test('a shadow falling away from the light passes', async () => {
    expect((await run(fixtures.work('shadow-consistent'))).report.findings).toEqual([]);
  });

  test('an offset 15.3 degrees off the expected direction is reported, 11.3 degrees off is not', async () => {
    const off = await run(await shadowWork('4px 7px 12px'));
    expect(off.report.findings.map((f) => f.ruleId)).toEqual(['texture-floor/shadow-direction']);
    const near = await run(await shadowWork('4px 6px 12px'));
    expect(near.report.findings).toEqual([]);
  });

  test('a shadow with no offset has no direction and is not reported', async () => {
    expect((await run(await shadowWork('0px 0px 12px'))).report.findings).toEqual([]);
  });

  test('the light angle comes from the system constraints', async () => {
    const system = await patchedSystem(async (dir) => {
      await editJson(tokensFile(dir), (j) => {
        j.$extensions[NS].constraints.lightAngleDeg = 45;
      });
    });
    const result = await run(fixtures.work('shadow-consistent'), { systemDir: system });
    expect(result.report.findings.map((f) => f.ruleId)).toEqual(['texture-floor/shadow-direction']);
  });
});

const radiusWork = (edit: (css: string) => string) =>
  patchedWork('radius-nested', (work) => {
    work.sequence[0].custom = edit(work.sequence[0].custom);
  });

describe('texture floor: radius nesting', () => {
  test('inner and outer radius both 24 with padding 12 is a warning at the inner element, exit status stays 0', async () => {
    const result = await run(fixtures.work('radius-mismatch'));
    expect(result.exitCode).toBe(0);
    expect(result.report.findings).toEqual([
      expect.objectContaining({
        ruleId: 'texture-floor/radius-nesting',
        category: 'texture-floor',
        severity: 'warning',
        location: expect.objectContaining({ unit: 'custom', selector: expect.stringContaining('div:nth-of-type(1) > div:nth-of-type(1)') }),
      }),
    ]);
  });

  test('outer radius equal to inner radius plus padding passes', async () => {
    expect((await run(fixtures.work('radius-nested'))).report.findings).toEqual([]);
  });

  test('a deviation of 0.5px passes and a deviation of 1.5px is a warning', async () => {
    const within = await run(await radiusWork((css) => css.replace('border-radius:12px', 'border-radius:11.5px')));
    expect(within.report.findings).toEqual([]);
    const beyond = await run(await radiusWork((css) => css.replace('border-radius:12px', 'border-radius:10.5px')));
    expect(beyond.report.findings.map((f) => f.ruleId)).toEqual(['texture-floor/radius-nesting']);
  });

  test('a rounded child that is not in the corner of its parent is not checked', async () => {
    const floating = await run(
      await radiusWork((css) => css.replace('.inner{', '.inner{margin:40px;').replace('border-radius:12px', 'border-radius:30px')),
    );
    expect(floating.report.findings).toEqual([]);
  });

  test('a child with no radius is not checked', async () => {
    const square = await run(await radiusWork((css) => css.replace('border-radius:12px', 'border-radius:0')));
    expect(square.report.findings).toEqual([]);
  });
});

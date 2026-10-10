/* Behavior tests for texture-floor (hueless gray, shadow direction, radius nesting) and composition ratios, driven through buildAndCheck with fixture works. */
import { describe, expect, test } from 'vitest';
import { fixtures, run } from './helpers.ts';

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

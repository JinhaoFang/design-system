/*
 * Behavior tests for the layout overview (排法总览), driven through buildOverview, which generates a work per carrier from a system's layouts and the shared sample content and runs buildAndCheck on it.
 * Uses the fixture system with the real skeletons and the real shared content; the fixture system's deliberately dirty layouts (pure black, pure white) show that the checker really runs on the overview.
 */
import { readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { SOCIAL_CANVASES } from '../src/carriers.ts';
import { buildOverview } from '../src/overview.ts';
import { fixtures, pngSize, tempDir } from './helpers.ts';
import { overviewLibrary } from './overview-helpers.ts';
import { patchedSystem } from './system-helpers.ts';

async function overview(carriers: ('web' | 'slides' | 'social')[], systemDir = fixtures.system, canvases?: string[]) {
  return buildOverview({
    systemDir,
    outDir: await tempDir(),
    libraryDir: await overviewLibrary(),
    fontCacheDir: fixtures.fontCache,
    carriers,
    ...(canvases && { canvases }),
  });
}

const layoutsOf = async (system: string, carrier: string, unit: string) =>
  (await readdir(join(system, 'layouts', carrier, unit))).map((name) => name.replace(/\.liquid$/, '')).sort();

describe('overview for slides and web', () => {
  test('slides: one deck with a slide for every layout of every unit, in skeleton order, through build-and-check', async () => {
    const result = await overview(['slides']);
    expect(result.builds).toHaveLength(1);
    const build = result.builds[0]!;
    const sequence = JSON.parse(await readFile(build.workPath, 'utf8')).sequence as { unit: string; layout: string }[];
    expect(sequence.map((item) => `${item.unit}/${item.layout}`)).toEqual([
      'cover/corner',
      'cover/stack',
      'statement/blackout',
      'statement/centered',
      'closing/plain',
    ]);
    expect(build.result.artifacts.images).toHaveLength(5);
    expect(build.result.report.work.carrier).toBe('slides');
    expect(build.result.report.findings).toEqual([
      expect.objectContaining({ ruleId: 'texture-floor/pure-black-white', location: expect.objectContaining({ slide: 3, layout: 'blackout' }) }),
    ]);
    expect(result.exitCode).toBe(1);
  });

  test('web: one page with a section for every layout, so the checker sees the grid layouts too', async () => {
    const result = await overview(['web']);
    const build = result.builds[0]!;
    const sequence = JSON.parse(await readFile(build.workPath, 'utf8')).sequence as { unit: string; layout: string }[];
    const expected = [
      ...(await layoutsOf(fixtures.system, 'web', 'hero')).map((layout) => `hero/${layout}`),
      ...(await layoutsOf(fixtures.system, 'web', 'features')).map((layout) => `features/${layout}`),
    ];
    expect(sequence.map((item) => `${item.unit}/${item.layout}`)).toEqual(expected);
    expect(build.result.report.findings.map((finding) => finding.ruleId)).toContain('anti-homogeneity/equal-card-grid');
    expect(result.exitCode).toBe(0);
  });

  test('units the system has no layouts for are listed as uncovered, not silently dropped', async () => {
    const result = await overview(['slides']);
    expect(result.uncovered).toEqual(expect.arrayContaining([{ carrier: 'slides', unit: 'agenda', reason: '体系没有这个单元的排法' }]));
    expect(result.uncovered.map((entry) => entry.unit)).not.toContain('cover');
  });

  test('writes a summary listing every build with its error and warning counts', async () => {
    const result = await overview(['slides', 'web']);
    const summary = await readFile(result.summary, 'utf8');
    expect(summary).toContain('slides');
    expect(summary).toContain('web');
    expect(summary).toMatch(/1 个错误/);
  });
});

describe('overview for social', () => {
  test('one image per layout per canvas, each build at its exact canvas size', async () => {
    const system = await patchedSystem(async (dir) => {
      const titles = join(dir, 'layouts', 'social', 'title');
      for (const name of await readdir(titles)) if (!['stack.liquid', 'column.liquid'].includes(name)) await rm(join(titles, name));
    });
    const result = await overview(['social'], system);
    expect(result.builds).toHaveLength(2 * Object.keys(SOCIAL_CANVASES).length);
    for (const build of result.builds) {
      const size = SOCIAL_CANVASES[build.canvas as keyof typeof SOCIAL_CANVASES];
      expect(build.unit).toBe('title');
      expect(await pngSize(build.result.artifacts.images[0]!)).toEqual({ width: size.width, height: size.height });
    }
    expect(new Set(result.builds.map((build) => build.canvas))).toEqual(new Set(Object.keys(SOCIAL_CANVASES)));
    expect(result.exitCode).toBe(0);
  });

  test('the canvases option limits the canvas set', async () => {
    const result = await overview(['social'], fixtures.system, ['square']);
    expect(new Set(result.builds.map((build) => build.canvas))).toEqual(new Set(['square']));
  });
});

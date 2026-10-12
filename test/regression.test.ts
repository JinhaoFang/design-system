/*
 * Behavior tests for the regression command (回归), driven through regress(): for every system found under the systems directory (<systems>/<id>/ holding SYSTEM.md, tokens, layouts and
 * works/*.json standard-sample works) it runs buildAndCheck on each sample and on the layout overview, builds the system page beside them (linked to both), and exits 1 when anything has an error, fails validation or has no samples.
 * The systems are temp copies of the fixture system: a clean one (dirty layouts removed) and the original, whose pure black / pure white layouts the overview reaches.
 * The all-carrier success case gets 120 seconds: it includes several builds and was measured at 59.395 seconds against the old 60-second limit on a two-core CI runner.
 */
import { cp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { regress } from '../src/regress.ts';
import { fixtures, tempDir } from './helpers.ts';
import { overviewLibrary } from './overview-helpers.ts';

const DIRTY = [
  ['social', 'title', ['blackout', 'whiteout', 'system-font', 'unspaced', 'unspaced-inline', 'spaced-inline', 'column-anywhere']],
  ['slides', 'statement', ['blackout']],
] as const;

async function installSystem(systemsDir: string, id: string, options: { clean: boolean; samples: string[] }): Promise<void> {
  const dir = join(systemsDir, id);
  await cp(fixtures.system, dir, { recursive: true });
  if (options.clean) {
    for (const [carrier, unit, names] of DIRTY) for (const name of names) await rm(join(dir, 'layouts', carrier, unit, `${name}.liquid`), { force: true });
  }
  if (options.samples.length) {
    await mkdir(join(dir, 'works'), { recursive: true });
    for (const sample of options.samples) await cp(fixtures.work(sample), join(dir, 'works', `${sample}.json`));
  }
}

async function run(systemsDir: string) {
  return regress({ systemsDir, outDir: await tempDir(), libraryDir: await overviewLibrary(), fontCacheDir: fixtures.fontCache, canvases: ['square'] });
}

describe('regression', () => {
  test('passes with exit 0 when every sample and overview of every system is free of errors', async () => {
    const systemsDir = await tempDir('ds-systems-');
    await installSystem(systemsDir, 'good', { clean: true, samples: ['clean', 'slides-clean', 'web-clean'] });
    const result = await run(systemsDir);
    expect(result.systems.flatMap((system) => system.problems)).toEqual([]);
    expect(result.exitCode).toBe(0);
    expect(result.systems.map((system) => system.id)).toEqual(['good']);
    const good = result.systems[0]!;
    expect(good.samples.map((sample) => sample.name).sort()).toEqual(['clean', 'slides-clean', 'web-clean']);
    expect(good.samples.every((sample) => sample.exitCode === 0)).toBe(true);
    expect(good.overview!.builds.length).toBeGreaterThan(0);
    expect(good.problems).toEqual([]);
    expect((await readdir(join(result.outDir, 'good'))).sort()).toEqual(['overview', 'system', 'works']);
    expect(good.systemPage!.errors).toBe(0);
    const page = await readFile(join(result.outDir, 'good', 'system', 'index.html'), 'utf8');
    expect(page).toContain('../overview/web/index.html');
    expect(page).toContain('../works/web-clean/index.html');
  }, 120_000);

  test('exits 1 when an overview has an error, while still checking the other systems', async () => {
    const systemsDir = await tempDir('ds-systems-');
    await installSystem(systemsDir, 'good', { clean: true, samples: ['clean'] });
    await installSystem(systemsDir, 'dirty', { clean: false, samples: ['clean'] });
    const result = await run(systemsDir);
    expect(result.exitCode).toBe(1);
    const byId = Object.fromEntries(result.systems.map((system) => [system.id, system]));
    expect(byId['good']!.problems).toEqual([]);
    expect(byId['dirty']!.problems.join('\n')).toContain('排法总览');
  });

  test('exits 1 when a sample has an error', async () => {
    const systemsDir = await tempDir('ds-systems-');
    await installSystem(systemsDir, 'good', { clean: true, samples: ['clean', 'slides-black'] });
    const result = await run(systemsDir);
    expect(result.exitCode).toBe(1);
    expect(result.systems[0]!.problems.join('\n')).toContain('slides-black');
  });

  test('exits 1 for a system without standard-sample works', async () => {
    const systemsDir = await tempDir('ds-systems-');
    await installSystem(systemsDir, 'bare', { clean: true, samples: [] });
    const result = await run(systemsDir);
    expect(result.exitCode).toBe(1);
    expect(result.systems[0]!.problems.join('\n')).toContain('标准样张');
  });

  test('an empty systems directory passes with nothing to check, a missing one is a usage failure', async () => {
    const empty = await tempDir('ds-systems-');
    expect((await run(empty)).systems).toEqual([]);
    await expect(run(join(empty, 'missing'))).rejects.toThrow(/体系目录/);
  });
});

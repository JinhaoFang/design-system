/*
 * Extra entrance wait behavior through buildAndCheck: web loading/scrolling and slide initial/settled-turn entries, persisted normal/reduced motion records and pre-render validation.
 * Built pages are opened only to verify entered() waits for the delayed entrance. CLI is the pipeline's thin wrapper for validation exit status; no internal helper assertions or pixel comparisons.
 */
import { execFile } from 'node:child_process';
import { cp, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { beforeAll, describe, expect, test } from 'vitest';
import type { BuildResult } from '../src/build-and-check.ts';
import type { MotionSnapshot } from '../src/checker/motion-audit.ts';
import { fixtures, repoRoot, run, tempDir } from './helpers.ts';
import { editText } from './system-helpers.ts';
import { transitionSystem } from './slides-transition-fixture.ts';

const execFileAsync = promisify(execFile);
const results = {} as Record<'web' | 'slides', BuildResult>;
let systemDir: string;

beforeAll(async () => {
  systemDir = await transitionSystem();
  await cp(join(repoRoot, 'test/fixtures/entrance-wait'), systemDir, { recursive: true });
  results.web = await run(fixtures.work('web-entrance-wait'), { systemDir });
  results.slides = await run(fixtures.work('slides-entrance-wait'), { systemDir });
});

describe.each(['web', 'slides'] as const)('%s extra entrance wait', (carrier) => {
  test('layout and custom records add the named wait without slowing peers; reduced motion removes every delay', async () => {
    const result = results[carrier];
    expect(result.exitCode).toBe(0);
    expect(result.report.findings).toEqual([]);
    const motion: MotionSnapshot = JSON.parse(await readFile(result.artifacts.motionJson!, 'utf8'));
    for (const unit of [carrier === 'web' ? 'hero' : 'statement', 'custom']) {
      const normal = motion.animations.filter((record) => record.unit === unit);
      expect(normal.map((record) => [record.entrance, record.durationMs, record.delayMs])).toEqual([
        ['rise', 480, 0],
        ['draw-x', 240, 540],
        ['fade', 240, 60],
        ['fade', 240, 360],
        ['rise', 240, 300],
      ]);
      const reduced = motion.reduced.filter((record) => record.unit === unit);
      expect(reduced.map((record) => [record.entrance, record.durationMs, record.delayMs])).toEqual([
        ['rise', 120, 0],
        ['fade', 120, 0],
        ['fade', 120, 0],
        ['rise', 120, 0],
      ]);
      expect(reduced.every((record) => !record.properties.includes('transform'))).toBe(true);
    }
    expect(motion.animations.filter((record) => record.entrance)).toHaveLength(10);
    expect(motion.reduced.filter((record) => record.entrance)).toHaveLength(8);
  });

  test.each(['layout', 'custom'])('an unknown wait in %s fails before rendering and the CLI exits 2 with the element and name', async (origin) => {
    const invalidSystem = join(await tempDir(), 'system');
    await cp(systemDir, invalidSystem, { recursive: true });
    const path = origin === 'custom'
      ? 'works/fragments/entrance-wait.html'
      : `layouts/${carrier}/${carrier === 'web' ? 'hero' : 'statement'}/wait.liquid`;
    await editText(join(invalidSystem, path), (html) => html.replace('data-ds-wait="slow"', 'data-ds-wait="glacial"'));
    const message = /data-ds-wait="glacial".*序列第 [12] 项.*元素：<div class="underline"/;
    await expect(run(fixtures.work(`${carrier}-entrance-wait`), { systemDir: invalidSystem })).rejects.toThrow(message);
    const outDir = await tempDir();
    await expect(execFileAsync(process.execPath, [
      join(repoRoot, 'src/cli.ts'), 'build', '--system', invalidSystem,
      '--work', fixtures.work(`${carrier}-entrance-wait`), '--out', outDir,
      '--library', fixtures.library, '--font-cache', fixtures.fontCache,
    ])).rejects.toMatchObject({ code: 2, stderr: expect.stringMatching(message) });
    expect(await readdir(outDir)).toEqual([]);
  });
});

test('entered remains pending through the turn and the extra wait, until the last entrance finishes', async () => {
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
    await page.goto(pathToFileURL(results.slides.artifacts.index).href);
    const state = await page.evaluate(async () => {
      const api = (window as any).dsSlides;
      await api.entered();
      api.next();
      const target = document.querySelector('[data-ds-slide="2"]')!;
      const line = target.querySelector('.underline')!;
      let done = false;
      const waiting = api.entered().then(() => { done = true; });
      const duringTurn = { done, entranceCount: line.getAnimations().length };
      document.getAnimations().forEach((animation) => animation.finish());
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const delayed = line.getAnimations()[0]!;
      delayed.pause();
      delayed.currentTime = (delayed.effect as KeyframeEffect).getTiming().delay! - 1;
      target.getAnimations({ subtree: true }).filter((animation) => animation !== delayed).forEach((animation) => animation.finish());
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const duringWait = { done, delayMs: delayed.effect!.getTiming().delay, progress: delayed.effect!.getComputedTiming().progress, turning: document.querySelectorAll('[data-turning],[data-leaving]').length };
      delayed.finish();
      await waiting;
      return { duringTurn, duringWait, done, remaining: target.getAnimations({ subtree: true }).length };
    });
    expect(state).toEqual({
      duringTurn: { done: false, entranceCount: 0 },
      duringWait: { done: false, delayMs: 540, progress: 0, turning: 0 },
      done: true,
      remaining: 0,
    });
  } finally {
    await browser.close();
  }
});

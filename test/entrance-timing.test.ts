/*
 * Separate opacity timing through buildAndCheck fixtures: system defaults, independent element overrides, all transform entrances, reduced behavior and pre-render validation.
 * DS_47_QA_DIR optionally persists built fixtures and rise records for ticket acceptance. All numeric values reuse the mini/action fixtures.
 */
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { beforeAll, describe, expect, test } from 'vitest';
import type { BuildResult } from '../src/build-and-check.ts';
import type { MotionSnapshot } from '../src/checker/motion-audit.ts';
import { fixtures, patchedWork, repoRoot, run } from './helpers.ts';
import { editJson, editText, NS, patchedSystem, tokensFile } from './system-helpers.ts';
import { transitionSystem } from './slides-transition-fixture.ts';

const EASE = { settle: 'cubic-bezier(0.2, 0.8, 0.2, 1)', drag: 'cubic-bezier(0.4, 0, 0.6, 1)' };
const results = {} as Record<'web' | 'slides', BuildResult>;
let systemDir: string;

beforeAll(async () => {
  systemDir = await transitionSystem();
  await cp(join(repoRoot, 'test/fixtures/entrance'), systemDir, { recursive: true });
  await editJson(tokensFile(systemDir), (json) => {
    json.motion = { stampScale: { $type: 'number', $value: 1.5 } };
    json.$extensions[NS].entrance = { opacity: { step: 'quick', ease: 'settle' } };
  });
  for (const path of ['layouts/web/hero/actions.liquid', 'layouts/slides/statement/actions.liquid', 'works/fragments/entrance-actions.html']) {
    await editText(join(systemDir, path), (html) => html.replace('<div data-ds-stagger="tight">', `<div data-ds-stagger="tight">
<p data-ds-enter="rise" data-ds-order="0" data-ds-step="slow" data-ds-ease="drag">发布二点零</p>
<p data-ds-enter="fall" data-ds-order="0" data-ds-opacity-step="slow">发布二点零</p>
<p data-ds-enter="left" data-ds-order="0" data-ds-opacity-ease="drag">发布二点零</p>
<p data-ds-enter="right" data-ds-order="0" data-ds-opacity-step="slow" data-ds-opacity-ease="drag" data-ds-wait="quick">发布二点零</p>`));
  }
  for (const carrier of ['web', 'slides'] as const) {
    results[carrier] = await run(fixtures.work(`${carrier}-entrance-actions`), { systemDir });
    const qa = process.env.DS_47_QA_DIR;
    if (qa) {
      await mkdir(qa, { recursive: true });
      await cp(results[carrier].artifacts.outDir, join(qa, `timing-${carrier}`), { recursive: true });
      const motion: MotionSnapshot = JSON.parse(await readFile(results[carrier].artifacts.motionJson!, 'utf8'));
      await writeFile(join(qa, `rise-${carrier}.json`), JSON.stringify(motion.animations.filter((record) => record.entrance === 'rise'), null, 2));
    }
  }
  if (process.env.DS_47_QA_DIR) await cp(systemDir, join(process.env.DS_47_QA_DIR, 'timing-system'), { recursive: true });
});

describe.each(['web', 'slides'] as const)('%s independent opacity timing', (carrier) => {
  test('system defaults and each independent override produce two records sharing the entrance delay', async () => {
    const result = results[carrier];
    expect(result.exitCode).toBe(0);
    expect(result.report.findings).toEqual([]);
    const motion: MotionSnapshot = JSON.parse(await readFile(result.artifacts.motionJson!, 'utf8'));
    for (const unit of [carrier === 'web' ? 'hero' : 'statement', 'custom']) {
      const records = motion.animations.filter((record) => record.unit === unit);
      for (const effect of ['rise', 'fall', 'left', 'right', 'draw-x', 'draw-y', 'stamp', 'peel-left', 'peel-right', 'peel-up', 'peel-down']) {
        const pair = records.filter((record) => record.entrance === effect);
        expect(pair).toHaveLength(2);
        const transform = pair.find((record) => record.properties.includes('transform'))!;
        const opacity = pair.find((record) => record.properties.includes('opacity'))!;
        expect(transform.properties).toEqual(['transform']);
        expect(opacity.properties).toEqual(['opacity']);
        expect(transform.delayMs).toBe(opacity.delayMs);
        expect(transform.durationMs).toBe(['rise', 'draw-x'].includes(effect) || effect.startsWith('peel-') ? 480 : 240);
        expect(transform.easings).toEqual([['rise', 'draw-x'].includes(effect) ? EASE.drag : EASE.settle]);
        expect(opacity.durationMs).toBe(['fall', 'right'].includes(effect) ? 480 : 120);
        expect(opacity.easings).toEqual([['left', 'right'].includes(effect) ? EASE.drag : EASE.settle]);
        if (effect === 'right') expect(opacity.delayMs).toBe(120);
        expect(opacity.keyframes!.map((frame) => frame['opacity'])).toEqual(effect.startsWith('peel-') ? ['1', '0'] : ['0', '1']);
      }
      const reduced = motion.reduced.filter((record) => record.unit === unit);
      expect(reduced).toHaveLength(9);
      expect(reduced.every((record) => record.properties.join() === 'opacity' && record.durationMs === 120 && record.delayMs === 0)).toBe(true);
      expect(reduced.filter((record) => record.entrance === 'rise')[0]!.easings).toEqual([EASE.drag]);
    }
  });
});

test('entered waits for the longer opacity animation after transform finishes', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto(pathToFileURL(results.slides.artifacts.index).href);
    const state = await page.evaluate(async () => {
      const api = (window as any).dsSlides;
      await api.entered();
      api.next();
      document.getAnimations().forEach((animation) => animation.finish());
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const target = document.querySelector('[data-active] [data-ds-enter="fall"]')!;
      const opacity = target.getAnimations().find((animation) => (animation.effect as KeyframeEffect).getKeyframes()[0]!['opacity'] !== undefined)!;
      opacity.pause();
      opacity.currentTime = 0;
      let done = false;
      const waiting = api.entered().then(() => { done = true; });
      document.getAnimations().filter((animation) => animation !== opacity).forEach((animation) => animation.finish());
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const before = { done, transform: getComputedStyle(target).transform, duration: opacity.effect!.getTiming().duration };
      opacity.finish();
      await waiting;
      return { before, done };
    });
    expect(state).toEqual({ before: { done: false, transform: 'none', duration: 480 }, done: true });
  } finally { await browser.close(); }
});

test.each(['step', 'ease'] as const)('unknown system opacity %s fails before rendering', async (field) => {
  const invalid = await patchedSystem(async (dir) => editJson(tokensFile(dir), (json) => {
    json.$extensions[NS].entrance = { opacity: { step: 'quick', ease: 'settle', [field]: 'unknown' } };
  }));
  await expect(run(fixtures.work('web-clean'), { systemDir: invalid })).rejects.toThrow(new RegExp(`entrance\\.opacity\\.${field}="unknown"`));
});

test.each(['step', 'ease'] as const)('unknown element opacity %s fails before rendering', async (field) => {
  const work = await patchedWork('web-clean', (json) => {
    json.sequence = [{ custom: `<p data-ds-enter="rise" data-ds-opacity-${field}="unknown">发布二点零</p>`, serves: '验证透明度计时' }];
  });
  await expect(run(work)).rejects.toThrow(`data-ds-opacity-${field}="unknown"`);
});

test('element timing works without a system default', async () => {
  const systemDir = await patchedSystem(async (dir) => editText(join(dir, 'layouts/web/hero/split.liquid'), (html) =>
    html.replace('<h1 class="headline" data-ds-enter="rise" data-ds-step="slow">', '<h1 class="headline" data-ds-enter="rise" data-ds-opacity-step="slow">')));
  const result = await run(fixtures.work('web-clean'), { systemDir });
  expect(result.exitCode).toBe(0);
  const motion: MotionSnapshot = JSON.parse(await readFile(result.artifacts.motionJson!, 'utf8'));
  expect(motion.animations.filter((record) => record.entrance === 'rise' && record.selector.includes('h1')).map((record) => [record.properties, record.durationMs, record.easings])).toEqual([
    [['transform'], 240, [EASE.settle]], [['opacity'], 480, [EASE.settle]],
  ]);
});

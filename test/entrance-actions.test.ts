/*
 * Entrance action behavior through buildAndCheck fixtures: draw (both axes), stamp (required system number), peel (four directions), animation records and rule results.
 * Built artifacts are opened only to check visible terminal states, scroll/slide replay and print behavior. No internal function tests or pixel comparisons.
 */
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { BuildResult } from '../src/build-and-check.ts';
import type { MotionSnapshot } from '../src/checker/motion-audit.ts';
import { fixtures, patchedWork, pngSize, repoRoot, run } from './helpers.ts';
import { editJson, editText, patchedSystem, tokensFile } from './system-helpers.ts';
import { transitionSystem } from './slides-transition-fixture.ts';

const EFFECTS = ['draw-x', 'draw-y', 'stamp', 'peel-left', 'peel-right', 'peel-up', 'peel-down'];
const SIZES = { web: { width: 1440, height: 900 }, slides: { width: 1920, height: 1080 } };
const results = {} as Record<'web' | 'slides', BuildResult>;
let browser: Browser;
let systemDir: string;
let transitioned: BuildResult;

beforeAll(async () => {
  systemDir = await patchedSystem(async (dir) => {
    await cp(join(repoRoot, 'test/fixtures/entrance'), dir, { recursive: true });
    await editJson(tokensFile(dir), (json) => { json.motion = { stampScale: { $type: 'number', $value: 1.5 } }; });
  });
  results.web = await run(fixtures.work('web-entrance-actions'), { systemDir });
  results.slides = await run(fixtures.work('slides-entrance-actions'), { systemDir });
  const turnSystem = await transitionSystem();
  await cp(join(repoRoot, 'test/fixtures/entrance'), turnSystem, { recursive: true });
  await editJson(tokensFile(turnSystem), (json) => { json.motion = { stampScale: { $type: 'number', $value: 1.5 } }; });
  await editText(join(turnSystem, 'works/fragments/entrance-actions.html'), (html) => html.replaceAll('<p>发布二点零</p>', '<p data-ds-enter="fade">发布二点零</p>'));
  transitioned = await run(fixtures.work('slides-entrance-actions'), { systemDir: turnSystem });
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

async function finish(page: Page): Promise<void> {
  await page.evaluate(async () => {
    document.getAnimations().forEach((animation) => animation.finish());
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

async function coverStates(page: Page) {
  return page.locator('[data-ds-enter^="peel-"]').evaluateAll((elements) => elements.map((el) => {
    const style = getComputedStyle(el);
    return { effect: el.getAttribute('data-ds-enter'), opacity: style.opacity, visibility: style.visibility, transform: style.transform, width: el.clientWidth, height: el.clientHeight };
  }));
}

describe.each(['web', 'slides'] as const)('%s entrance actions', (carrier) => {
  test('layouts and custom fragments are clean, with motion records stored only in motion.json', async () => {
    const result = results[carrier];
    expect(result.exitCode).toBe(0);
    expect(result.report.findings).toEqual([]);
    const written = JSON.parse(await readFile(result.artifacts.reportJson, 'utf8'));
    expect(written).not.toHaveProperty('motion');
    expect(result.report).not.toHaveProperty('motion');
    const motion: MotionSnapshot = JSON.parse(await readFile(result.artifacts.motionJson!, 'utf8'));
    const normal = motion.animations.filter((record) => EFFECTS.includes(record.entrance ?? ''));
    const reduced = motion.reduced.filter((record) => EFFECTS.includes(record.entrance ?? ''));
    expect(normal).toHaveLength(14);
    expect(reduced).toHaveLength(10);
    for (const effect of EFFECTS) {
      const records = normal.filter((record) => record.entrance === effect);
      expect(records).toHaveLength(2);
      expect(records.map((record) => record.unit)).toContain('custom');
      expect(records.map((record) => record.layout)).toContain('actions');
      for (const record of records) {
        expect(record.durationMs).toBe(effect === 'draw-x' || effect.startsWith('peel-') ? 480 : 240);
        expect(record.easings).toEqual([effect === 'draw-x' ? 'cubic-bezier(0.4, 0, 0.6, 1)' : 'cubic-bezier(0.2, 0.8, 0.2, 1)']);
        expect(record.properties.sort()).toEqual(effect === 'stamp' ? ['opacity', 'transform'] : ['transform']);
        if (effect === 'stamp') expect(record.keyframes![0]!['transform']).toBe('scale(1.5)');
        if (effect.startsWith('peel-')) {
          const end = { 'peel-left': 'translateX(-100%)', 'peel-right': 'translateX(100%)', 'peel-up': 'translateY(-100%)', 'peel-down': 'translateY(100%)' };
          expect(record.keyframes!.at(-1)!['transform']).toBe(end[effect as keyof typeof end]);
        }
      }
    }
    const layout = normal.filter((record) => record.layout === 'actions');
    expect(layout.map((record) => record.delayMs)).toEqual([0, 60, 120, 180, 240, 300, 360]);
    for (const record of reduced) {
      expect(record.durationMs).toBe(120);
      expect(record.delayMs).toBe(0);
      expect(record.properties).toEqual(['opacity']);
      expect(record.easings).toEqual(['cubic-bezier(0.2, 0.8, 0.2, 1)']);
      if (record.entrance!.startsWith('peel-')) {
        expect(record.keyframes![0]!['opacity']).toBe('1');
        expect(record.keyframes!.at(-1)!['opacity']).toBe('0');
      }
    }
    expect(result.artifacts.video).toBeDefined();
    expect((await readFile(result.artifacts.video!)).subarray(0, 4).toString('hex')).toBe('1a45dfa3');
    if (carrier === 'web') {
      expect((await pngSize(result.artifacts.images[0]!)).width).toBe(1440);
      expect((await pngSize(result.artifacts.images[1]!)).width).toBe(390);
    } else {
      expect(result.artifacts.images).toHaveLength(4);
      for (const image of result.artifacts.images) expect(await pngSize(image)).toEqual(SIZES.slides);
      const pdf = (await readFile(result.artifacts.pdf!)).toString('latin1');
      expect([...pdf.matchAll(/\/Type\s*\/Page(?![s\w])/g)]).toHaveLength(4);
    }
  });

  test('static mode finalizes every cover, including off-screen and unvisited content', async () => {
    const context = await browser.newContext({ viewport: SIZES[carrier] });
    try {
      await context.addInitScript(() => {
        const mark = () => document.documentElement.setAttribute('data-render', 'static');
        if (document.documentElement) mark();
        else new MutationObserver((_records, observer) => {
          if (document.documentElement) { mark(); observer.disconnect(); }
        }).observe(document, { childList: true });
      });
      const page = await context.newPage();
      await page.goto(pathToFileURL(results[carrier].artifacts.index).href);
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
      const states = await coverStates(page);
      expect(states).toHaveLength(8);
      for (const state of states) {
        expect(state.opacity).toBe('0');
        expect(state.visibility).toBe('hidden');
      }
      if (carrier === 'web') {
        for (const state of states) {
          const [x, y] = state.transform.match(/matrix\((.*)\)/)![1]!.split(',').slice(4).map(Number);
          expect(x).toBe(state.effect === 'peel-left' ? -state.width : state.effect === 'peel-right' ? state.width : 0);
          expect(y).toBe(state.effect === 'peel-up' ? -state.height : state.effect === 'peel-down' ? state.height : 0);
        }
      }
    } finally {
      await context.close();
    }
  });

  test.each(['no-preference', 'reduce'] as const)('%s plays on scroll/page entry and retains the revealed state', async (reducedMotion) => {
    const context = await browser.newContext({ viewport: SIZES[carrier], reducedMotion });
    try {
      const page = await context.newPage();
      await page.goto(pathToFileURL(results[carrier].artifacts.index).href);
      if (carrier === 'slides') await page.keyboard.press('ArrowRight');
      await finish(page);
      if (carrier === 'web') {
        await page.locator('[data-ds-custom]').scrollIntoViewIfNeeded();
        await page.waitForTimeout(60);
      } else await page.keyboard.press('ArrowRight');
      await finish(page);
      for (const state of await coverStates(page)) {
        expect(state.opacity).toBe('0');
        expect(state.visibility).toBe('hidden');
        if (reducedMotion === 'reduce') expect(state.transform).toBe('none');
      }
      if (carrier === 'slides') {
        await page.keyboard.press('ArrowLeft');
        expect(await page.locator('[data-active] [data-ds-enter^="peel-"]').evaluateAll((els) => els.every((el) => !el.hasAttribute('data-ds-revealed')))).toBe(true);
        await finish(page);
        expect(await page.locator('[data-active] [data-ds-enter^="peel-"]').evaluateAll((els) => els.every((el) => getComputedStyle(el).visibility === 'hidden'))).toBe(true);
      }
    } finally {
      await context.close();
    }
  });
});

test.each(['instant', 'transition'] as const)('printing finalizes all covers before any action slide was visited (%s)', async (mode) => {
  const context = await browser.newContext({ viewport: SIZES.slides });
  try {
    const page = await context.newPage();
    const result = mode === 'instant' ? results.slides : transitioned;
    expect(result.exitCode).toBe(0);
    expect(result.report.findings).toEqual([]);
    await page.goto(pathToFileURL(result.artifacts.index).href);
    await page.emulateMedia({ media: 'print' });
    for (const state of await coverStates(page)) {
      expect(state.opacity).toBe('0');
      expect(state.visibility).toBe('hidden');
      expect(state.transform).not.toBe('none');
    }
    expect(await page.locator('[data-ds-enter^="peel-"] *').evaluateAll((els) => els.every((el) => getComputedStyle(el).visibility === 'hidden'))).toBe(true);
  } finally {
    await context.close();
  }
});

test.each(['no-preference', 'reduce'] as const)('printing during navigation reveals content and hides cover subtrees (%s)', async (reducedMotion) => {
  const context = await browser.newContext({ viewport: SIZES.slides, reducedMotion });
  try {
    const page = await context.newPage();
    await page.goto(pathToFileURL(transitioned.artifacts.index).href);
    await page.evaluate(() => (window as any).dsSlides.go(2));
    expect(await page.locator('[data-turning]').count()).toBe(reducedMotion === 'reduce' ? 0 : 1);
    await page.emulateMedia({ media: 'print' });
    expect(await page.locator('[data-ds-enter^="peel-"],[data-ds-enter^="peel-"] *').evaluateAll((els) => els.every((el) => getComputedStyle(el).visibility === 'hidden'))).toBe(true);
    expect(await page.locator('[data-ds-enter]:not([data-ds-enter^="peel-"],[data-ds-enter^="peel-"] *)').evaluateAll((els) => els.every((el) => getComputedStyle(el).visibility === 'visible'))).toBe(true);
    expect(await page.locator('.ds-slide').evaluateAll((els) => els.map((el) => [getComputedStyle(el).transform, getComputedStyle(el).opacity]))).toEqual(Array(4).fill(['none', '1']));
    expect(await page.locator('.ds-slide-shade').evaluateAll((els) => els.every((el) => getComputedStyle(el).display === 'none'))).toBe(true);
  } finally {
    await context.close();
  }
});

test('all new entrance variants are subject to all four motion rules', async () => {
  const result = await run(fixtures.work('web-entrance-actions-invalid'), { systemDir });
  expect(result.exitCode).toBe(1);
  const motion: MotionSnapshot = JSON.parse(await readFile(result.artifacts.motionJson!, 'utf8'));
  for (const effect of EFFECTS) {
    const record = motion.animations.find((item) => item.entrance === effect && item.source === 'css-animation')!;
    expect(record).toBeDefined();
    const rules = result.report.findings.filter((item) => item.location.selector === record.selector && item.category === 'motion').map((item) => item.ruleId);
    expect(new Set(rules)).toEqual(new Set(['motion/duration-off-ladder', 'motion/easing-off-set', 'motion/non-compositor-property', 'motion/transform-under-reduced-motion']));
  }
});

test.each(['"stamp"', "'stamp'", 'stamp'])('stamp %s fails before rendering when its token is missing', async (value) => {
  const systemDir = await patchedSystem(async () => {});
  const work = await patchedWork('web-clean', (json) => {
    json.sequence = [{ custom: `<p data-ds-enter=${value}>发布二点零</p>`, serves: '验证倍率必填' }];
  });
  await expect(run(work, { systemDir })).rejects.toThrow(/motion\.stampScale.*number.*大于 1/);
});

test.each([
  { $type: 'number', $value: 1 },
  { $type: 'number', $value: -1 },
  { $type: 'number', $value: '1.5' },
  { $type: 'dimension', $value: { value: 2, unit: 'px' } },
])('invalid stampScale %j fails validation', async (token) => {
  const systemDir = await patchedSystem(async (dir) => editJson(tokensFile(dir), (json) => { json.motion = { stampScale: token }; }));
  await expect(run(fixtures.work('web-entrance-actions'), { systemDir })).rejects.toThrow(/motion\.stampScale/);
});


test('covers stay over content throughout first, revisited and superseded turns, then reveal after settling', async () => {
  const context = await browser.newContext({ viewport: SIZES.slides });
  try {
    const page = await context.newPage();
    await page.goto(pathToFileURL(transitioned.artifacts.index).href);
    const records = await page.evaluate(async () => {
      const api = (window as any).dsSlides;
      await api.entered();
      const records: unknown[] = [];
      const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const covers = () => [...document.querySelectorAll<HTMLElement>('[data-active] [data-ds-enter^="peel-"]')];
      const capture = (phase: string) => ({ phase, turning: !!document.querySelector('[data-turning]'), covers: covers().map((el) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const parent = el.parentElement!.getBoundingClientRect();
        return { effect: el.getAttribute('data-ds-enter'), visibility: style.visibility, opacity: style.opacity, transform: style.transform,
          coversContent: Math.abs(rect.x - parent.x) < 0.5 && Math.abs(rect.y - parent.y) < 0.5 && Math.abs(rect.width - parent.width) < 0.5 && Math.abs(rect.height - parent.height) < 0.5,
          childrenVisible: [...el.querySelectorAll('*')].every((child) => getComputedStyle(child).visibility === 'visible'), animations: el.getAnimations().length };
      }) });
      for (const visit of ['first', 'revisit', 'superseded']) {
        if (visit !== 'first') {
          api.go(0);
          document.getAnimations().forEach((animation) => animation.finish());
          await api.entered();
        }
        if (visit === 'superseded') api.go(1);
        api.go(2);
        const turns = document.getAnimations();
        turns.forEach((animation) => animation.pause());
        for (const fraction of [0, 0.5, 0.99]) {
          turns.forEach((animation) => { animation.currentTime = Number(animation.effect!.getTiming().duration) * fraction; });
          await frame();
          records.push(capture(`${visit}-turn-${fraction}`));
        }
        turns.forEach((animation) => animation.finish());
        await frame();
        covers().flatMap((el) => el.getAnimations()).forEach((animation) => { animation.pause(); animation.currentTime = 0; });
        records.push(capture(`${visit}-settled-before-peel`));
        document.getAnimations().forEach((animation) => animation.finish());
        await api.entered();
        records.push(capture(`${visit}-revealed`));
      }
      return records;
    }) as { phase: string; turning: boolean; covers: { visibility: string; opacity: string; transform: string; coversContent: boolean; childrenVisible: boolean; animations: number }[] }[];
    for (const record of records) {
      expect(record.covers).toHaveLength(4);
      for (const cover of record.covers) {
        if (record.phase.endsWith('-revealed')) expect(cover.visibility).toBe('hidden');
        else {
          expect(cover.visibility).toBe('visible');
          expect(cover.opacity).toBe('1');
          if (record.turning) expect(cover.transform).toBe('none');
          expect(cover.coversContent).toBe(true);
          expect(cover.childrenVisible).toBe(true);
          if (record.turning) expect(cover.animations).toBe(0);
          else expect(cover.animations).toBe(1);
        }
      }
    }
    const qa = process.env.DS_47_QA_DIR;
    if (qa) {
      await mkdir(qa, { recursive: true });
      await writeFile(join(qa, 'cover-visibility.json'), JSON.stringify(records, null, 2));
      await cp(transitioned.artifacts.outDir, join(qa, 'cover-slides'), { recursive: true });
    }
  } finally { await context.close(); }
});

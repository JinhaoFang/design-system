/* Page-turn behavior through buildAndCheck fixtures: real animation records/checker findings, entrance sequencing, rapid/reverse navigation and static export specifications. No internal function or pixel assertions. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import type { Browser } from 'playwright';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { BuildResult } from '../src/build-and-check.ts';
import { fixtures, pngSize, run } from './helpers.ts';
import { editText } from './system-helpers.ts';
import { transitionSystem } from './slides-transition-fixture.ts';

let clean: BuildResult;
let browser: Browser;

beforeAll(async () => {
  clean = await run(fixtures.work('slides-clean'), { systemDir: await transitionSystem() });
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

test('clean turns are audited in both preferences and preserve PNG, PDF and video specifications', async () => {
  expect(clean.exitCode).toBe(0);
  expect(clean.report.findings).toEqual([]);
  const motion = JSON.parse(await readFile(join(clean.artifacts.outDir, 'motion.json'), 'utf8'));
  const turns = motion.animations.filter((record: any) => !record.unit);
  expect(turns).toHaveLength(6);
  for (const record of turns) {
    expect(record.durationMs).toBe(480);
    expect(record.easings).toEqual(['cubic-bezier(0.2, 0.8, 0.2, 1)']);
    expect(record.properties.every((property: string) => ['transform', 'opacity'].includes(property))).toBe(true);
  }
  expect(motion.reduced).toHaveLength(2);
  for (const record of motion.reduced) {
    expect(record.durationMs).toBe(120);
    expect(record.properties).toEqual(['opacity']);
  }
  expect(clean.artifacts.images).toHaveLength(3);
  for (const path of clean.artifacts.images) expect(await pngSize(path)).toEqual({ width: 1920, height: 1080 });
  const pdf = (await readFile(clean.artifacts.pdf!)).toString('latin1');
  expect([...pdf.matchAll(/\/Type\s*\/Page(?![s\w])/g)]).toHaveLength(3);
  for (const match of pdf.matchAll(/\/MediaBox\s*\[([^\]]+)\]/g)) expect(match[1]!.trim().split(/\s+/).map(Number)).toEqual([0, 0, 1440, 810]);
  expect((await readFile(clean.artifacts.video!)).subarray(0, 4).toString('hex')).toBe('1a45dfa3');
});

test('the checker reports actual off-ladder duration and easing on page-turn wrappers', async () => {
  const systemDir = await transitionSystem();
  await editText(join(systemDir, 'layouts/slides/cover/stack.liquid'), (text) => text + '<style media="all">:root{--ds-duration-slow:300ms;--ds-easing-settle:ease-in-out}</style>');
  const bad = await run(fixtures.work('slides-clean'), { systemDir });
  expect(bad.exitCode).toBe(1);
  const wrapperHits = bad.report.findings.filter((finding) => !finding.location.unit);
  expect(new Set(wrapperHits.map((finding) => finding.ruleId))).toEqual(new Set(['motion/duration-off-ladder', 'motion/easing-off-set']));
  expect(wrapperHits.every((finding) => finding.location.slide && finding.location.selector && finding.severity === 'error')).toBe(true);
});

test('unknown or incomplete declarations fail before rendering', async () => {
  const systemDir = await transitionSystem();
  await editText(join(systemDir, 'slides.transition.json'), () => '{"duration":"--ds-duration-missing","extra":"ignored"}');
  await expect(run(fixtures.work('slides-clean'), { systemDir })).rejects.toThrow(/duration.*easing.*shadow.*shadeColor.*retreat/s);
});

test('entrance hooks wait for the turn; entered waits for both; wrapper/shade state clears', async () => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  try {
    const page = await context.newPage();
    await page.goto(pathToFileURL(clean.artifacts.index).href);
    const result = await page.evaluate(async () => {
      const api = (window as any).dsSlides;
      const events: number[] = [];
      document.addEventListener('ds:slide-enter', (event) => events.push((event as CustomEvent).detail.index));
      api.next();
      const target = document.querySelector('[data-ds-slide="2"]')!;
      const marked = target.querySelector('[data-ds-enter]')!;
      const initial = { visible: [...document.querySelectorAll('.ds-slide')].filter((slide) => getComputedStyle(slide).display !== 'none').length, entrance: marked.getAnimations().length, visibility: getComputedStyle(marked).visibility, events: [...events] };
      let done = false;
      const waiting = api.entered().then(() => { done = true; });
      document.getAnimations().forEach((animation) => animation.finish());
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const duringEntrance = { events: [...events], entrance: marked.getAnimations().length, done, turning: document.querySelectorAll('[data-turning],[data-leaving]').length };
      document.getAnimations().forEach((animation) => animation.finish());
      await waiting;
      return { initial, duringEntrance, done, final: [getComputedStyle(target).transform, getComputedStyle(target.querySelector('.ds-slide-shade')!).opacity, getComputedStyle(marked).opacity] };
    });
    expect(result.initial).toEqual({ visible: 2, entrance: 0, visibility: 'hidden', events: [] });
    expect(result.duringEntrance).toEqual({ events: [1], entrance: 1, done: false, turning: 0 });
    expect(result.done).toBe(true);
    expect(result.final).toEqual(['none', '0', '1']);
  } finally { await context.close(); }
});

test('rapid keyboard changes settle only the latest page and reverse the full-width direction', async () => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  try {
    const page = await context.newPage();
    await page.goto(pathToFileURL(clean.artifacts.index).href);
    const result = await page.evaluate(async () => {
      const api = (window as any).dsSlides;
      const events: number[] = [];
      document.addEventListener('ds:slide-enter', (event) => events.push((event as CustomEvent).detail.index));
      const key = (value: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key: value }));
      key('ArrowRight');
      const waiting = api.entered();
      key('ArrowRight');
      key('ArrowLeft');
      const incoming = document.querySelector('[data-turning]')!;
      const from = (incoming.getAnimations()[0]!.effect as KeyframeEffect).getKeyframes()[0]!['transform'];
      await waiting;
      return { from, events, index: api.index, transient: document.querySelectorAll('[data-turning],[data-leaving],[data-reverse]').length, visible: [...document.querySelectorAll('.ds-slide')].filter((slide) => getComputedStyle(slide).display !== 'none').map((slide) => slide.getAttribute('data-ds-slide')), animations: document.getAnimations().length };
    });
    expect(result).toEqual({ from: 'translateX(-100%)', events: [1], index: 1, transient: 0, visible: ['2'], animations: 0 });
  } finally { await context.close(); }
});

test('reduced and static presentation switch directly, and print strips a live turn', async () => {
  for (const preference of ['reduce', 'no-preference'] as const) {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: preference });
    try {
      const page = await context.newPage();
      await page.goto(pathToFileURL(clean.artifacts.index).href);
      if (preference === 'no-preference') await page.evaluate(() => document.documentElement.setAttribute('data-render', 'static'));
      await page.evaluate(() => (window as any).dsSlides.next());
      expect(await page.evaluate(() => document.querySelectorAll('[data-turning],[data-leaving]').length)).toBe(0);
      await page.evaluate(() => (window as any).dsSlides.entered());
      expect(await page.evaluate(() => getComputedStyle(document.querySelector('[data-active]')!).transform)).toBe('none');
    } finally { await context.close(); }
  }
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  try {
    const page = await context.newPage();
    await page.goto(pathToFileURL(clean.artifacts.index).href);
    await page.evaluate(() => (window as any).dsSlides.next());
    await page.emulateMedia({ media: 'print' });
    expect(await page.evaluate(() => [...document.querySelectorAll('.ds-slide')].map((slide) => [getComputedStyle(slide).transform, getComputedStyle(slide).opacity, getComputedStyle(slide.querySelector('.ds-slide-shade')!).display]))).toEqual(Array(3).fill(['none', '1', 'none']));
  } finally { await context.close(); }
});

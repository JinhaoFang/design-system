/* Behavior tests for motion through buildAndCheck: the motion rules (duration/easing ladder, compositor-only properties, transform under reduced motion) on web and slides fixtures, and the declarative entrance choreography helper in the built pages. */
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { describe, expect, test } from 'vitest';
import { patchedWork, run } from './helpers.ts';

const FRAME = ':scope{box-sizing:border-box;padding:32px;background:var(--ds-color-paper);color:var(--ds-color-ink);font-family:var(--ds-font-body)} p,h2{margin:0;font-size:18px}';
const SLIDE_FRAME = ':scope{box-sizing:border-box;width:100%;height:100%;padding:128px;background:var(--ds-color-paper);color:var(--ds-color-ink);font-family:var(--ds-font-body)} p,h2{margin:0;font-size:40px}';

const withCustom = (base: string, html: string, at = 1) =>
  patchedWork(base, (w) => {
    w.sequence.splice(at, 0, { custom: html, serves: '验证动效检查' });
  });

const webFragment = (css: string, body = '<p class="mover">一段会动的文字</p>') => `<style>${FRAME} ${css}</style>${body}`;
const slideFragment = (css: string, body = '<p class="mover">一段会动的文字</p>') => `<style>${SLIDE_FRAME} ${css}</style>${body}`;

const rise = (duration: string, easing: string) =>
  `.mover{animation:rise ${duration} ${easing} both} @keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}`;

const fade = (duration: string, easing: string) =>
  `.mover{animation:fade ${duration} ${easing} both} @keyframes fade{from{opacity:0}to{opacity:1}}`;

const choreographed = (frame: string) =>
  `<style>${frame}</style>
<div data-ds-stagger="tight">
<h2 data-ds-enter="rise">第一行</h2>
<p data-ds-enter="rise" data-ds-order="1">第二行</p>
<p data-ds-enter="fade" data-ds-order="2" data-ds-step="slow" data-ds-ease="drag">第三行</p>
</div>`;

const farBelow = (frame: string) =>
  `<style>${frame}</style><div style="height:2400px"></div><p id="late" data-ds-enter="rise" data-ds-step="slow">远处的一行</p>`;

describe('motion rules on web', () => {
  test('animating a property other than transform and opacity is an error located on the unit', async () => {
    const result = await run(
      await withCustom('web-clean', webFragment('.mover{animation:grow var(--ds-duration-base) var(--ds-easing-settle) both} @keyframes grow{from{width:10px}to{width:200px}}')),
    );
    expect(result.exitCode).toBe(1);
    expect(result.report.findings).toEqual([
      expect.objectContaining({
        ruleId: 'motion/non-compositor-property',
        category: 'motion',
        severity: 'error',
        location: expect.objectContaining({ unit: 'custom' }),
        message: expect.stringContaining('width'),
      }),
    ]);
  });

  test('a duration off the ladder is an error', async () => {
    const result = await run(await withCustom('web-clean', webFragment(fade('300ms', 'var(--ds-easing-settle)'))));
    expect(result.report.findings).toEqual([
      expect.objectContaining({ ruleId: 'motion/duration-off-ladder', category: 'motion', location: expect.objectContaining({ unit: 'custom' }), message: expect.stringContaining('300') }),
    ]);
  });

  test('an easing outside the set is an error, a CSS keyword included', async () => {
    const result = await run(await withCustom('web-clean', webFragment(fade('var(--ds-duration-base)', 'ease-in-out'))));
    expect(result.report.findings.map((finding) => finding.ruleId)).toEqual(['motion/easing-off-set']);
  });

  test('a transform animation that survives reduced motion is an error; guarding it with a media query is clean', async () => {
    const unguarded = await run(await withCustom('web-clean', webFragment(rise('var(--ds-duration-base)', 'var(--ds-easing-settle)'))));
    expect(unguarded.report.findings).toEqual([
      expect.objectContaining({ ruleId: 'motion/transform-under-reduced-motion', location: expect.objectContaining({ unit: 'custom' }), message: expect.stringContaining('transform') }),
    ]);
    const guarded = await run(
      await withCustom(
        'web-clean',
        webFragment(`${rise('var(--ds-duration-base)', 'var(--ds-easing-settle)')} @media (prefers-reduced-motion: reduce){.mover{animation:none}}`),
      ),
    );
    expect(guarded.report.findings).toEqual([]);
  });
});

describe('entrance choreography on web', () => {
  test('a page staged with the helper has no findings', async () => {
    const result = await run(await withCustom('web-clean', choreographed(FRAME)));
    expect(result.report.findings).toEqual([]);
    expect(result.exitCode).toBe(0);
  });

  test('uses only ladder values, staggers by order, ends in the natural state, enters on scroll and fades only under reduced motion', async () => {
    const result = await run(await withCustom('web-clean', choreographed(FRAME) + farBelow(FRAME).replace(/<style>.*?<\/style>/, ''), 0));
    const browser = await chromium.launch();
    try {
      const url = pathToFileURL(result.artifacts.index).href;
      const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' })).newPage();
      await page.goto(url);
      const started = await page.evaluate(() =>
        document.getAnimations().filter((animation) => !(animation.effect as KeyframeEffect).target!.closest('[data-ds-layout]')).map((animation) => {
          const timing = (animation.effect as KeyframeEffect).getTiming();
          return { text: (animation.effect as KeyframeEffect).target!.textContent, duration: timing.duration, delay: timing.delay, easing: timing.easing, props: Object.keys((animation.effect as KeyframeEffect).getKeyframes()[0]!).filter((key) => !['offset', 'computedOffset', 'easing', 'composite'].includes(key)) };
        }),
      );
      expect(started).toEqual([
        { text: '第一行', duration: 240, delay: 0, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', props: ['opacity', 'transform'] },
        { text: '第二行', duration: 240, delay: 60, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', props: ['opacity', 'transform'] },
        { text: '第三行', duration: 480, delay: 120, easing: 'cubic-bezier(0.4, 0, 0.6, 1)', props: ['opacity'] },
      ]);
      await page.evaluate(() => document.querySelector('#late')!.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(80);
      expect(await page.evaluate(() => document.querySelector('#late')!.getAnimations().length)).toBe(1);
      await page.evaluate(() => document.getAnimations().forEach((animation) => animation.finish()));
      expect(await page.evaluate(() => { const style = getComputedStyle(document.querySelector('#late')!); return [style.opacity, style.transform]; })).toEqual(['1', 'none']);

      const reduced = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })).newPage();
      await reduced.goto(url);
      const calm = await reduced.evaluate(() =>
        document.getAnimations().filter((animation) => !(animation.effect as KeyframeEffect).target!.closest('[data-ds-layout]')).map((animation) => {
          const effect = animation.effect as KeyframeEffect;
          return { duration: effect.getTiming().duration, delay: effect.getTiming().delay, transform: effect.getKeyframes().some((keyframe) => 'transform' in keyframe) };
        }),
      );
      expect(calm).toHaveLength(3);
      for (const entry of calm) expect(entry).toEqual({ duration: 120, delay: 0, transform: false });

      const still = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
      await still.addInitScript(() => {
        const mark = () => document.documentElement.setAttribute('data-render', 'static');
        if (document.documentElement) mark();
        else new MutationObserver((_records, observer) => { if (document.documentElement) { mark(); observer.disconnect(); } }).observe(document, { childList: true });
      });
      await still.goto(url);
      expect(await still.evaluate(() => document.getAnimations().length)).toBe(0);
    } finally {
      await browser.close();
    }
  });

  test('a name that is not in the system stops the build with a message', async () => {
    await expect(run(await withCustom('web-clean', '<p data-ds-enter="rise" data-ds-step="glacial">慢</p>'))).rejects.toThrow(/data-ds-step="glacial"/);
  });
});

describe('motion on slides', () => {
  test('violations are located on the slide', async () => {
    const result = await run(
      await withCustom(
        'slides-clean',
        slideFragment('.mover{animation:grow 300ms var(--ds-easing-settle) both} @keyframes grow{from{width:10px;opacity:0}to{width:200px;opacity:1}}'),
        2,
      ),
    );
    expect(result.exitCode).toBe(1);
    expect(result.report.findings.map((finding) => [finding.ruleId, finding.location.slide])).toEqual([
      ['motion/duration-off-ladder', 3],
      ['motion/non-compositor-property', 3],
    ]);
  });

  test('a transform animation that survives reduced motion is an error on its slide', async () => {
    const result = await run(await withCustom('slides-clean', slideFragment(rise('var(--ds-duration-base)', 'var(--ds-easing-settle)')), 1));
    expect(result.report.findings).toEqual([expect.objectContaining({ ruleId: 'motion/transform-under-reduced-motion', location: expect.objectContaining({ slide: 2, unit: 'custom' }) })]);
  });

  test('slides staged with the helper have no findings and the stills show the natural state', async () => {
    const result = await run(await withCustom('slides-clean', choreographed(SLIDE_FRAME), 1));
    expect(result.report.findings).toEqual([]);
    expect(result.exitCode).toBe(0);
    const browser = await chromium.launch();
    try {
      const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
      await page.goto(`${pathToFileURL(result.artifacts.index).href}`);
      await page.evaluate(() => (window as any).dsSlides.go(1));
      const delays = await page.evaluate(() => document.getAnimations().map((animation) => (animation.effect as KeyframeEffect).getTiming().delay));
      expect(delays).toEqual([0, 60, 120]);
      await page.evaluate(() => (window as any).dsSlides.entered());
      expect(await page.evaluate(() => [...document.querySelectorAll('[data-ds-enter]')].map((el) => getComputedStyle(el).opacity))).toEqual(['1', '1', '1']);
    } finally {
      await browser.close();
    }
  });
});

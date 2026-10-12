/* Behavior tests for the HTML slides carrier, driven through buildAndCheck: per-slide PNGs, PDF, recording, per-slide findings, and the built page opened straight from disk. */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { BuildResult } from '../src/build-and-check.ts';
import { fixtures, pngSize, run } from './helpers.ts';

async function pdfPages(path: string): Promise<{ count: number; boxes: number[][] }> {
  const text = (await readFile(path)).toString('latin1');
  const count = [...text.matchAll(/\/Type\s*\/Page(?![s\w])/g)].length;
  const boxes = [...text.matchAll(/\/MediaBox\s*\[([^\]]+)\]/g)].map((match) => match[1]!.trim().split(/\s+/).map(Number));
  return { count, boxes };
}

let clean: BuildResult;

beforeAll(async () => {
  clean = await run(fixtures.work('slides-clean'));
});

describe('clean slides', () => {
  test('have no findings and render one 1920x1080 PNG per slide', async () => {
    expect(clean.report.findings).toEqual([]);
    expect(clean.exitCode).toBe(0);
    expect(clean.artifacts.images).toHaveLength(3);
    for (const image of clean.artifacts.images) expect(await pngSize(image)).toEqual({ width: 1920, height: 1080 });
  });

  test('also produce a PDF with one 1920x1080px page (1440x810 pt) per slide', async () => {
    expect(clean.artifacts.pdf).toBeDefined();
    const { count, boxes } = await pdfPages(clean.artifacts.pdf!);
    expect(count).toBe(3);
    expect(boxes).not.toHaveLength(0);
    for (const box of boxes) expect(box).toEqual([0, 0, 1440, 810]);
  });

  test('also produce a WebM recording of the page flips', async () => {
    expect(clean.artifacts.video).toBeDefined();
    const bytes = await readFile(clean.artifacts.video!);
    expect(bytes.subarray(0, 4).toString('hex')).toBe('1a45dfa3');
    expect(bytes.length).toBeGreaterThan(2000);
  });
});

describe('slides checker', () => {
  test('runs on every slide and locates a finding by slide number, unit, layout and slot', async () => {
    const result = await run(fixtures.work('slides-black'));
    expect(result.exitCode).not.toBe(0);
    expect(result.report.findings).toEqual([
      expect.objectContaining({
        ruleId: 'texture-floor/pure-black-white',
        severity: 'error',
        location: expect.objectContaining({ slide: 2, unit: 'statement', layout: 'blackout', slot: 'claim' }),
      }),
    ]);
    const json = JSON.parse(await readFile(result.artifacts.reportJson, 'utf8'));
    expect(json.work).toEqual(expect.objectContaining({ carrier: 'slides' }));
    expect(json.findings[0].location.slide).toBe(2);
    expect(await readFile(result.artifacts.reportMarkdown, 'utf8')).toContain('第 2 页');
  });
});

describe('the built page opened straight from disk', () => {
  let browser: Browser;
  let page: Page;

  const visibleSlides = () =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.ds-slide')]
        .filter((slide) => getComputedStyle(slide).display !== 'none')
        .map((slide) => Number(slide.dataset['dsSlide'])),
    );

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  const open = async (viewport: { width: number; height: number }, hash = '') => {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
    page = await context.newPage();
    await page.goto(`${pathToFileURL(clean.artifacts.index).href}${hash}`);
    await page.evaluate(() => document.fonts.ready);
    return context;
  };

  test('shows the first slide, scales the 1920x1080 stage to fit and centers it', async () => {
    const context = await open({ width: 960, height: 800 });
    expect(await visibleSlides()).toEqual([1]);
    const box = await page.evaluate(() => {
      const rect = document.querySelector('.ds-stage')!.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    expect(box).toEqual({ x: 0, y: 130, width: 960, height: 540 });
    await context.close();
  });

  test('turns pages with the right arrow, space and left arrow, and stops at both ends', async () => {
    const context = await open({ width: 1280, height: 720 });
    const sequence: [string, number][] = [
      ['ArrowLeft', 1],
      ['ArrowRight', 2],
      ['Space', 3],
      ['ArrowRight', 3],
      ['ArrowLeft', 2],
    ];
    for (const [key, expected] of sequence) {
      await page.keyboard.press(key);
      expect(await visibleSlides()).toEqual([expected]);
    }
    await context.close();
  });

  test('runs entrance hooks for each slide as it is entered and announces it with an event', async () => {
    const context = await open({ width: 1280, height: 720 });
    await page.evaluate(() => {
      const log: number[] = [];
      const events: number[] = [];
      (window as any).__entered = log;
      (window as any).__events = events;
      (window as any).dsSlides.onEnter((_slide: Element, index: number) => log.push(index));
      document.addEventListener('ds:slide-enter', (event) => events.push((event as CustomEvent).detail.index));
    });
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    expect(await page.evaluate(() => (window as any).__entered)).toEqual([1, 2, 1]);
    expect(await page.evaluate(() => (window as any).__events)).toEqual([1, 2, 1]);
    await context.close();
  });

  test('waits for the animations a hook returned before reporting the slide as entered', async () => {
    const context = await open({ width: 1280, height: 720 });
    const finished = await page.evaluate(async () => {
      const api = (window as any).dsSlides;
      let animation: Animation | undefined;
      api.onEnter((slide: Element) => {
        animation = slide.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: 'both' });
        return animation;
      });
      api.next();
      await api.entered();
      return animation!.playState;
    });
    expect(finished).toBe('finished');
    await context.close();
  });

  test('opens on the slide named in the URL hash', async () => {
    const context = await open({ width: 1280, height: 720 }, '#3');
    expect(await visibleSlides()).toEqual([3]);
    await context.close();
  });
});

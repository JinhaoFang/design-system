/*
 * Initial font gating through buildAndCheck fixtures and the resulting public HTML. Real font responses are held until explicitly released;
 * animation start times, visibility, timeout fallback, scroll/navigation and entered() are observed without internal calls or pixel comparisons.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { BuildResult } from '../src/build-and-check.ts';
import { patchedWork, run } from './helpers.ts';

const results = {} as Record<'web' | 'slides', BuildResult>;
let browser: Browser;
const content = (id: string): string => `<p id="${id}" data-ds-enter="rise" data-ds-step="slow">发布二点零</p>`;

beforeAll(async () => {
  for (const carrier of ['web', 'slides'] as const) {
    const style = '<style>:scope{font-family:var(--ds-font-body);color:var(--ds-color-ink);background:var(--ds-color-paper)} p{margin:0;font-size:var(--ds-type-body)}</style>';
    const work = await patchedWork(`${carrier}-clean`, (work) => {
      work.sequence = carrier === 'web'
        ? [{ custom: `${style}${content('initial')}<div style="height:2400px"></div>${content('later')}`, serves: '验证字体等待与滚动批次' }]
        : ['initial', 'later'].map((id) => ({ custom: `${style}${content(id)}`, serves: '验证字体等待与进页' }));
    });
    results[carrier] = await run(work);
  }
  browser = await chromium.launch();
});

afterAll(async () => { await browser?.close(); });

async function heldFonts(carrier: 'web' | 'slides', reducedMotion: 'no-preference' | 'reduce' = 'no-preference'): Promise<{ context: BrowserContext; page: Page; release(): void }> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await context.route('http://font-wait.test/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith('/fonts/')) await gate;
    await route.fulfill({ body: await readFile(join(results[carrier].artifacts.outDir, path)), contentType: path.endsWith('.html') ? 'text/html' : 'font/woff2' });
  });
  await context.addInitScript(() => {
    const state = { readyAt: null as number | null, starts: [] as { id: string; at: number; fontStatus: string }[] };
    (window as any).fontEvidence = state;
    const original = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, keyframes: any, options?: any) {
      state.starts.push({ id: this.id, at: performance.now(), fontStatus: document.fonts.status });
      return original.call(this, keyframes, options);
    };
    document.fonts.addEventListener('loadingdone', () => { state.readyAt = performance.now(); });
  });
  const page = await context.newPage();
  await page.goto('http://font-wait.test/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.fonts.status === 'loading');
  return { context, page, release };
}

describe.each(['web', 'slides'] as const)('%s initial font readiness', (carrier) => {
  test.each(['no-preference', 'reduce'] as const)('late font responses delay the entire initial entrance under %s', async (preference) => {
    const { context, page, release } = await heldFonts(carrier, preference);
    try {
      await page.waitForTimeout(700);
      expect(await page.evaluate(() => ({ starts: (window as any).fontEvidence.starts, visibility: getComputedStyle(document.querySelector('#initial')!).visibility }))).toEqual({ starts: [], visibility: 'hidden' });
      if (carrier === 'slides') {
        await page.evaluate(() => {
          (window as any).entryDone = false;
          (window as any).dsSlides.entered().then(() => { (window as any).entryDone = true; });
        });
        expect(await page.evaluate(() => (window as any).entryDone)).toBe(false);
      }
      release();
      await page.waitForFunction(() => (window as any).fontEvidence.starts.length > 0 && (window as any).fontEvidence.readyAt !== null);
      const evidence = await page.evaluate(() => (window as any).fontEvidence);
      expect(evidence.starts).toHaveLength(1);
      expect(evidence.starts[0].id).toBe('initial');
      expect(evidence.starts[0].fontStatus).toBe('loaded');
      expect(evidence.starts[0].at).toBeGreaterThanOrEqual(evidence.readyAt);
      expect(await page.evaluate(() => getComputedStyle(document.querySelector('#initial')!).visibility)).toBe('visible');
      if (carrier === 'slides') {
        expect(await page.evaluate(() => (window as any).entryDone)).toBe(false);
        await page.evaluate(() => (window as any).dsSlides.entered());
        expect(await page.evaluate(() => (window as any).entryDone)).toBe(true);
      }
    } finally {
      release();
      await context.close();
    }
  });

  test('a stalled font starts content after the bounded wait and later readiness does not replay it', async () => {
    const { context, page, release } = await heldFonts(carrier);
    try {
      await page.waitForFunction(() => (window as any).fontEvidence.starts.length > 0, undefined, { timeout: 5000 });
      const state = await page.evaluate(() => ({ evidence: (window as any).fontEvidence, visibility: getComputedStyle(document.querySelector('#initial')!).visibility }));
      expect(state.evidence.readyAt).toBeNull();
      expect(state.evidence.starts).toHaveLength(1);
      expect(state.evidence.starts[0].fontStatus).toBe('loading');
      expect(state.evidence.starts[0].at).toBeGreaterThanOrEqual(3000);
      expect(state.evidence.starts[0].at).toBeLessThan(4500);
      expect(state.visibility).toBe('visible');
      release();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(100);
      expect(await page.evaluate(() => (window as any).fontEvidence.starts.length)).toBe(1);
    } finally {
      release();
      await context.close();
    }
  });

  test('later scroll/navigation starts immediately even while initial fonts are pending', async () => {
    const { context, page, release } = await heldFonts(carrier);
    try {
      await page.evaluate((carrier) => {
        if (carrier === 'web') document.querySelector('#later')!.scrollIntoView();
        else (window as any).dsSlides.next();
      }, carrier);
      await page.waitForFunction(() => (window as any).fontEvidence.starts.some((start: any) => start.id === 'later'));
      const starts = await page.evaluate(() => (window as any).fontEvidence.starts);
      expect(starts).toHaveLength(1);
      expect(starts[0].fontStatus).toBe('loading');
      expect(starts[0].at).toBeLessThan(3000);
      release();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(100);
      if (carrier === 'slides') {
        expect(await page.evaluate(() => (window as any).fontEvidence.starts.map((start: any) => start.id))).toEqual(['later']);
        await page.evaluate(() => (window as any).dsSlides.prev());
        await page.evaluate(() => (window as any).dsSlides.entered());
        expect(await page.evaluate(() => (window as any).fontEvidence.starts.map((start: any) => start.id))).toEqual(['later', 'initial']);
      }
    } finally {
      release();
      await context.close();
    }
  });
});

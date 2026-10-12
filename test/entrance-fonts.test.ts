/*
 * Initial font gating through buildAndCheck fixtures and the resulting public HTML. Real font responses are held until explicitly released;
 * animation start times, visibility, timeout fallback, scroll/navigation and entered() are observed without internal calls or pixel comparisons.
 * Streaming the generated HTML without its trailing runtime verifies visibility from the first paint; disabled scripts, missing runtime, errors, rejections and print verify terminal fallbacks.
 */
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
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
    const state = { readyAt: null as number | null, starts: [] as { id: string; at: number; fontStatus: string; beforeVisibility: string }[] };
    (window as any).fontEvidence = state;
    const original = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, keyframes: any, options?: any) {
      state.starts.push({ id: this.id, at: performance.now(), fontStatus: document.fonts.status, beforeVisibility: getComputedStyle(this).visibility });
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
      expect(await page.locator('#later').evaluate((el) => getComputedStyle(el).visibility)).toBe('hidden');
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
      expect(evidence.starts[0].beforeVisibility).toBe('hidden');
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
      expect(starts[0].beforeVisibility).toBe('hidden');
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

  test('without scripts the entrance content is visible', async () => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      await page.goto(new URL(`file://${results[carrier].artifacts.index}`).href);
      expect(await page.locator('#initial').isVisible()).toBe(true);
      expect(await page.locator('#initial').evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
      })).toBe(true);
      if (carrier === 'web') expect(await page.locator('#later').isVisible()).toBe(true);
    } finally { await context.close(); }
  });

  test('parsing content before the runtime arrives never exposes pending entrances', async () => {
    const html = await readFile(results[carrier].artifacts.index, 'utf8');
    const split = html.indexOf('<script>', html.indexOf('<body'));
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const server = createServer(async (request, response) => {
      if (request.url === '/index.html') {
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.write(html.slice(0, split));
        await gate;
        response.end(html.slice(split));
      } else {
        response.end(await readFile(join(results[carrier].artifacts.outDir, request.url!)));
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      const address = server.address() as { port: number };
      const navigation = page.goto(`http://127.0.0.1:${address.port}/index.html`);
      await page.waitForSelector('#initial', { state: 'attached' });
      const samples = await page.evaluate(async () => {
        const samples: string[] = [];
        for (let frame = 0; frame < 10; frame += 1) {
          await new Promise(requestAnimationFrame);
          samples.push(getComputedStyle(document.querySelector('#initial')!).visibility);
        }
        return samples;
      });
      expect(samples).toEqual(Array(10).fill('hidden'));
      release();
      await navigation;
      await page.waitForFunction(() => getComputedStyle(document.querySelector('#initial')!).visibility === 'visible');
      expect(await page.locator('#initial').isVisible()).toBe(true);
    } finally {
      release();
      await context.close();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test.each(['error', 'rejection', 'missing-runtime'] as const)('%s releases pending content instead of hiding it forever', async (failure) => {
    const context = await browser.newContext();
    try {
      const html = await readFile(results[carrier].artifacts.index, 'utf8');
      const split = html.indexOf('<script>', html.indexOf('<body'));
      await context.route('http://entrance-fallback.test/**', async (route) => {
        const pathname = new URL(route.request().url()).pathname;
        if (pathname === '/index.html') {
          await route.fulfill({ contentType: 'text/html', body: failure === 'missing-runtime'
            ? `${html.slice(0, split)}</body></html>` : html });
        } else await route.fulfill({ body: await readFile(join(results[carrier].artifacts.outDir, pathname)) });
      });
      const page = await context.newPage();
      await page.goto('http://entrance-fallback.test/index.html');
      if (failure === 'error') {
        await page.evaluate(() => window.setTimeout(() => { throw new Error('entrance fixture failure'); }, 0));
      } else if (failure === 'rejection') {
        await page.evaluate(() => window.setTimeout(() => { void Promise.reject(new Error('entrance fixture rejection')); }, 0));
      }
      await page.waitForFunction(() => getComputedStyle(document.querySelector('#initial')!).visibility === 'visible');
      expect(await page.locator('#initial').isVisible()).toBe(true);
      expect(await page.locator('#later').evaluate((el) => getComputedStyle(el).visibility)).toBe('visible');
    } finally { await context.close(); }
  });

  test('printing during font waiting reveals pending content', async () => {
    const { context, page, release } = await heldFonts(carrier);
    try {
      await page.emulateMedia({ media: 'print' });
      expect(await page.locator('#initial').evaluate((el) => getComputedStyle(el).visibility)).toBe('visible');
      expect(await page.locator('#later').evaluate((el) => getComputedStyle(el).visibility)).toBe('visible');
    } finally {
      release();
      await context.close();
    }
  });
});

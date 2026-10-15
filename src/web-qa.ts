/*
 * Web-work QA artifacts using only Playwright and Node. Static full-page PNGs are sliced on a separate canvas page, never by scrolling the work (so fixed/sticky content is not repeated).
 * During the existing real-time recording, CDP captures the viewport every 200 ms without Playwright's screenshot font wait or animation handling. It does not replace the video's screencast.
 * Capture starts with the pre-navigation viewport and finishes on the first scheduled frame after the entrance viewing hold. Each frame records its scheduled and actual capture time.
 * Slow screenshot calls may delay sampling; actual timestamps and capture durations are retained rather than claiming an exact cadence. The final regular sample preserves the frame-count/duration relationship.
 * A browser-native three-column contact sheet uses 1/3-size desktop frames and default text styling for timestamps. JSON records segment geometry and contact-sheet timing/layout for non-pixel verification.
 * Segment names sort after web-desktop.png so existing thumbnail consumers keep using the full-page image.
 * Only buildAndCheck web works opt in; system-page rendering keeps its existing artifacts. Old numbered segments are removed before writing replacements.
 */
import { readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { Page } from 'playwright';

const FRAME_INTERVAL_MS = 200;
const COLUMNS = 3;

export async function writeWebSegments(page: Page, png: Buffer, outDir: string, name: string, segmentHeight: number) {
  const prefix = `web-segment-${name}-`;
  for (const file of await readdir(outDir)) {
    if (file.startsWith(prefix) && /^\d+\.png$/.test(file.slice(prefix.length))) await rm(join(outDir, file));
  }
  const source = `data:image/png;base64,${png.toString('base64')}`;
  const result = await page.evaluate(async ({ source, segmentHeight }) => {
    const image = new Image();
    image.src = source;
    await image.decode();
    const segments = [];
    for (let y = 0; y < image.height; y += segmentHeight) {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = Math.min(segmentHeight, image.height - y);
      canvas.getContext('2d')!.drawImage(image, 0, y, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
      segments.push({ y, height: canvas.height, data: canvas.toDataURL('image/png').split(',')[1]! });
    }
    return { width: image.width, height: image.height, segments };
  }, { source, segmentHeight });
  const segments = [];
  for (const [index, segment] of result.segments.entries()) {
    const file = `${prefix}${String(index + 1).padStart(3, '0')}.png`;
    await writeFile(join(outDir, file), Buffer.from(segment.data, 'base64'));
    segments.push({ file, y: segment.y, height: segment.height });
  }
  return { width: result.width, height: result.height, segmentHeight, segments };
}

export async function startWebEntranceCapture(page: Page) {
  const session = await page.context().newCDPSession(page);
  const frames: { scheduledMs: number; timeMs: number; captureDurationMs: number; data: string }[] = [];
  const started = performance.now();
  let stopping = false;
  let aborted = false;
  const capture = async (scheduledMs: number) => {
    const at = performance.now();
    const { data } = await session.send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: false, optimizeForSpeed: true,
      clip: { x: 0, y: 0, ...page.viewportSize()!, scale: 1 / COLUMNS },
    });
    frames.push({ scheduledMs, timeMs: Math.round(at - started), captureDurationMs: Math.round(performance.now() - at), data });
  };
  try {
    await capture(0);
  } catch (error) {
    await session.detach();
    throw error;
  }
  const running = (async () => {
    for (let index = 1; !aborted; index += 1) {
      const scheduledMs = index * FRAME_INTERVAL_MS;
      await delay(Math.max(0, started + scheduledMs - performance.now()));
      if (aborted) break;
      const last = stopping;
      await capture(scheduledMs);
      if (last) break;
    }
  })();
  void running.catch(() => {});
  return {
    async finish(sheet: Page, outDir: string) {
      stopping = true;
      try {
        await running;
      } finally {
        await session.detach();
      }
      await sheet.setViewportSize({ width: page.viewportSize()!.width, height: page.viewportSize()!.height });
      await sheet.setContent(`<style>body{margin:0}main{display:grid;grid-template-columns:repeat(${COLUMNS},1fr)}img{width:100%;display:block}</style><main>${frames.map((frame) => `<div><img src="data:image/png;base64,${frame.data}"><div>${frame.timeMs} ms</div></div>`).join('')}</main>`);
      await sheet.locator('img').evaluateAll(async (images) => Promise.all(images.map((image) => (image as HTMLImageElement).decode())));
      const layout = await sheet.locator('main').evaluate((main) => {
        const cell = main.firstElementChild!.getBoundingClientRect();
        return { width: main.clientWidth, height: main.clientHeight, cellWidth: cell.width, cellHeight: cell.height };
      });
      const file = 'web-entrance.png';
      await sheet.locator('main').screenshot({ path: join(outDir, file) });
      return {
        file, intervalMs: FRAME_INTERVAL_MS, durationMs: frames.at(-1)!.scheduledMs,
        actualDurationMs: frames.at(-1)!.timeMs, columns: COLUMNS, ...layout,
        frames: frames.map(({ data: _data, ...frame }) => frame),
      };
    },
    async abort() {
      aborted = true;
      await running.catch(() => {});
      await session.detach().catch(() => {});
    },
  };
}

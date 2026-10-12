/*
 * Rendering with Playwright Chromium: fixed viewport, deviceScaleFactor 1, no-preference motion. After navigation it waits for every declared font face to load
 * (a face that fails to load aborts the build), finishes animations, waits for two animation frames so those changes can be painted, takes the checker snapshot, then screenshots the exact canvas as PNG.
 * One browser is launched per call and always closed.
 */
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import type { Page } from 'playwright';
import { collectSnapshot } from './checker/snapshot.ts';
import type { PageSnapshot } from './checker/snapshot.ts';
import { BuildError } from './types.ts';

export async function settle(page: Page): Promise<void> {
  const failed = await page.evaluate(async () => {
    const faces = [...document.fonts];
    const results = await Promise.allSettled(faces.map((face) => face.load()));
    await document.fonts.ready;
    for (const animation of document.getAnimations()) {
      try {
        animation.finish();
      } catch {
        animation.cancel();
      }
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    return faces.filter((_face, index) => results[index]!.status === 'rejected').map((face) => face.family);
  });
  if (failed.length) throw new BuildError([`字体加载失败：${failed.join('、')}`]);
}

export async function renderImage(
  htmlPath: string,
  size: { width: number; height: number },
  pngPath: string,
): Promise<PageSnapshot> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    await page.goto(pathToFileURL(htmlPath).href);
    await settle(page);
    const snapshot = await collectSnapshot(page);
    await page.screenshot({ path: pngPath, type: 'png' });
    await context.close();
    return snapshot;
  } finally {
    await browser.close();
  }
}

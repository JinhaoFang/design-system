/*
 * Rendering with Playwright Chromium: fixed viewport, deviceScaleFactor 1, no-preference motion. After navigation it waits for every declared font face to load
 * (a face that fails to load aborts the build), finishes animations, waits for two animation frames so those changes can be painted, takes the checker snapshot, then screenshots the exact canvas as PNG.
 * One browser is launched per call and always closed.
 * waitForRecordingEntrance is only for real-time video: it waits for fonts and visible running/pending animations, including declarative extra waits and split opacity timing.
 * Slides also wait for dsSlides.entered() (page turn and entrance hooks). Two idle frames let font-gated/observer entrances start and their final state paint.
 * Once an animation is seen in view, it remains part of the wait even if a peel/displacement moves its target out of view before its other timing finishes.
 * The entire wait is capped at 10000 ms per screen/page, including font readiness: the initial 3000 ms font gate leaves 7000 ms for staggered entrances and page turns,
 * while stalled fonts, paused/infinite animations or unresolved slide hooks cannot block recording forever. On timeout it continues without finishing/canceling animations.
 * The caller then applies its existing viewing hold (web 800 ms, slides 600 ms). Static rendering and motion audits do not use this helper.
 */
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import type { Page } from 'playwright';
import { collectSnapshot } from './checker/snapshot.ts';
import type { PageSnapshot } from './checker/snapshot.ts';
import { BuildError } from './types.ts';

export async function waitForRecordingEntrance(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => {
    let ready = false;
    let idleFrames = 0;
    let frame = 0;
    const observed = new WeakSet<Animation>();
    const done = (): void => {
      window.clearTimeout(timeout);
      cancelAnimationFrame(frame);
      resolve();
    };
    const timeout = window.setTimeout(done, 10000);
    const inView = (element: Element): boolean => {
      const rect = element.getBoundingClientRect();
      return rect.top < window.innerHeight && rect.bottom > 0;
    };
    const check = (): void => {
      const waiting = [...document.querySelectorAll('[data-ds-font-wait]')].some(inView);
      let active = false;
      for (const animation of document.getAnimations()) {
        if (animation.playState === 'finished' || animation.playState === 'idle') continue;
        const target = (animation.effect as KeyframeEffect | null)?.target;
        if (!target || inView(target)) observed.add(animation);
        if (observed.has(animation)) active = true;
      }
      idleFrames = ready && !waiting && !active ? idleFrames + 1 : 0;
      if (idleFrames >= 2) done();
      else frame = requestAnimationFrame(check);
    };
    void (async () => {
      await Promise.allSettled([...document.fonts].map((face) => face.load()));
      await document.fonts.ready;
      if (document.body.getAttribute('data-carrier') === 'slides') await (window as any).dsSlides.entered();
      ready = true;
    })();
    frame = requestAnimationFrame(check);
  }));
}

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

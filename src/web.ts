/*
 * Web carrier (展示型网页) rendering: a fluid page made of the work's units stacked in one <main>, rendered at two widths and recorded once.
 * buildWebPage assembles the HTML (same tokens/fonts as other carriers, no fixed canvas). renderWeb writes index.html and returns the artifacts and one checker snapshot per width.
 * Static passes (screenshots and checker): viewports 1440x900 and 390x844, deviceScaleFactor 1, no-preference motion, <html data-render="static"> set before any page script runs
 * (layouts reveal-on-scroll content under that switch), fonts loaded, every animation finished, then a full-page PNG whose width equals the viewport width: web-desktop.png, web-mobile.png.
 * Recording pass: a separate 1440x900 context with recordVideo; fonts load but animations are NOT finished, so entry motion plays in real time; the page scrolls to the bottom at a steady speed
 * (SCROLL_SPEED px/s) after a short lead-in, holds briefly, and the file is saved as web-scroll.webm (VP8 25 fps).
 * checkWeb runs the rule set on both snapshots; findings that appear only at 390 get a "（手机宽度 390）" suffix, and a finding already reported at 1440 is not repeated.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import type { Page } from 'playwright';
import { collectSnapshot } from './checker/snapshot.ts';
import type { PageSnapshot } from './checker/snapshot.ts';
import { ALL_RULES } from './checker/rules/index.ts';
import { runRules } from './checker/registry.ts';
import type { CheckContext } from './checker/registry.ts';
import { CARRIERS } from './carriers.ts';
import type { FontEntry } from './library.ts';
import { fontFaceCss, rootVarsCss } from './page.ts';
import { settle } from './render.ts';
import type { Finding } from './types.ts';

export const WEB_VIEWPORTS = {
  desktop: { width: CARRIERS.web.canvases.desktop.width, height: 900 },
  mobile: { width: CARRIERS.web.canvases.mobile.width, height: 844 },
} as const;

type WebViewport = keyof typeof WEB_VIEWPORTS;

const SCROLL_SPEED = 900;
const LEAD_IN_MS = 800;
const HOLD_MS = 600;

export interface WebPageInput {
  title: string;
  cssVars: Record<string, string>;
  fonts: FontEntry[];
  unitsHtml: string[];
}

export function buildWebPage(input: WebPageInput): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${input.title}</title>
<style>
${fontFaceCss(input.fonts)}
${rootVarsCss(input.cssVars)}
html,body{margin:0;padding:0}
</style>
</head>
<body data-carrier="web">
<main class="ds-flow">
${input.unitsHtml.join('\n')}
</main>
</body>
</html>
`;
}

export interface WebRender {
  index: string;
  images: string[];
  video: string;
  snapshots: Record<WebViewport, PageSnapshot>;
}

const markStatic = (): void => {
  const set = () => document.documentElement.setAttribute('data-render', 'static');
  if (document.documentElement) set();
  else {
    new MutationObserver((_records, observer) => {
      if (document.documentElement) {
        set();
        observer.disconnect();
      }
    }).observe(document, { childList: true });
  }
};

async function waitForFonts(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await Promise.allSettled([...document.fonts].map((face) => face.load()));
    await document.fonts.ready;
  });
}

async function scrollToBottom(page: Page): Promise<void> {
  await page.evaluate(
    (speed) =>
      new Promise<void>((resolve) => {
        const distance = document.documentElement.scrollHeight - window.innerHeight;
        const start = performance.now();
        const step = (now: number) => {
          const travelled = Math.min(distance, ((now - start) / 1000) * speed);
          window.scrollTo(0, travelled);
          if (travelled >= distance) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    SCROLL_SPEED,
  );
}

export async function renderWeb(input: WebPageInput & { outDir: string }): Promise<WebRender> {
  const index = join(input.outDir, 'index.html');
  await writeFile(index, buildWebPage(input));
  const url = pathToFileURL(index).href;
  const browser = await chromium.launch();
  try {
    const images: string[] = [];
    const snapshots = {} as Record<WebViewport, PageSnapshot>;
    for (const name of ['desktop', 'mobile'] as const) {
      const context = await browser.newContext({ viewport: WEB_VIEWPORTS[name], deviceScaleFactor: 1, reducedMotion: 'no-preference' });
      await context.addInitScript(markStatic);
      const page = await context.newPage();
      await page.goto(url);
      await settle(page);
      snapshots[name] = await collectSnapshot(page);
      const png = join(input.outDir, `web-${name}.png`);
      await page.screenshot({ path: png, type: 'png', fullPage: true });
      images.push(png);
      await context.close();
    }

    const recordings = await mkdtemp(join(tmpdir(), 'ds-web-video-'));
    try {
      const size = WEB_VIEWPORTS.desktop;
      const context = await browser.newContext({
        viewport: size,
        deviceScaleFactor: 1,
        reducedMotion: 'no-preference',
        recordVideo: { dir: recordings, size },
      });
      const page = await context.newPage();
      await page.goto(url);
      await waitForFonts(page);
      await page.waitForTimeout(LEAD_IN_MS);
      await scrollToBottom(page);
      await page.waitForTimeout(HOLD_MS);
      const recording = page.video()!;
      await context.close();
      const video = join(input.outDir, 'web-scroll.webm');
      await recording.saveAs(video);
      return { index, images, video, snapshots };
    } finally {
      await rm(recordings, { recursive: true, force: true });
    }
  } finally {
    await browser.close();
  }
}

export function checkWeb(snapshots: Record<WebViewport, PageSnapshot>, context: Omit<CheckContext, 'snapshot'>): Finding[] {
  const key = (finding: Finding) => `${finding.ruleId}|${finding.location.selector ?? ''}|${finding.message}`;
  const desktop = runRules(ALL_RULES, { ...context, snapshot: snapshots.desktop });
  const seen = new Set(desktop.map(key));
  const mobile = runRules(ALL_RULES, { ...context, snapshot: snapshots.mobile })
    .filter((finding) => !seen.has(key(finding)))
    .map((finding) => ({ ...finding, message: `${finding.message}（手机宽度 ${WEB_VIEWPORTS.mobile.width}）` }));
  return [...desktop, ...mobile];
}

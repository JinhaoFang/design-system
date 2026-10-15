/*
 * Web carrier (展示型网页) rendering: a fluid page made of the work's units stacked in one <main>, rendered at two widths and recorded once.
 * buildWebPage assembles the HTML (same tokens/fonts as other carriers, no fixed canvas). renderWeb writes index.html and returns the artifacts and one checker snapshot per width.
 * Static passes (screenshots and checker): viewports 1440x900 and 390x844, deviceScaleFactor 1, no-preference motion, <html data-render="static"> set before any page script runs
 * (layouts reveal-on-scroll content under that switch), fonts loaded, every animation finished, then a full-page PNG whose width equals the viewport width: web-desktop.png, web-mobile.png.
 * Recording pass: a separate 1440x900 context with recordVideo; fonts load but animations are NOT finished, so entry motion plays in real time; the page scrolls to the bottom at a steady speed
 * (SCROLL_SPEED px/s) after visible initial entrances finish and an 800 ms viewing hold, holds briefly at the bottom, and saves web-scroll.webm (VP8 25 fps).
 * The entrance wait includes fonts and is capped at 10000 ms by waitForRecordingEntrance (render.ts): 3000 ms for the initial font gate plus 7000 ms for staggered motion,
 * preventing stalled/paused/infinite entrances from blocking the recording. Timeout preserves real-time animations; screenshots and checker passes are unchanged.
 * Motion audit (motion-audit.ts): two extra passes at 1440, one with normal motion and one with reduced motion emulated, each scrolling down in steps so scroll-triggered entrances start; their animation records
 * are attached to the desktop snapshot only (snapshot.motion), so motion findings are reported once. buildWebPage embeds the entrance choreography script (choreography.ts) when given one.
 * Its head bootstrap hides pending entrances before content can paint; the runtime releases each scroll batch only after creating its animations. No-script and error paths show terminal content.
 * checkWeb runs the rule set (ALL_RULES, or the list passed in) on both snapshots; findings that appear only at 390 get a "（手机宽度 390）" suffix, and a finding already reported at 1440 is not repeated.
 * Extras for pages that are not works (the system page, system-page.ts): WebPageInput.style / script add one <style> to the head and one inline script after the choreography script;
 * Web works opt into qa: viewport-height segments, a real-time entrance contact sheet and web-qa.json (web-qa.ts), beside the full-page PNGs.
 * RenderWebOptions.audit replaces the scroll-through that drives the two motion audit passes (it may click replay controls), and recording: false skips the scroll recording (no video is returned).
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
import { runRules, sortFindings } from './checker/registry.ts';
import type { CheckContext, Rule } from './checker/registry.ts';
import { CARRIERS } from './carriers.ts';
import type { FontEntry } from './library.ts';
import { CHOREOGRAPHY_HEAD } from './choreography.ts';
import { fontFaceCss, rootVarsCss } from './page.ts';
import { auditMotion } from './checker/motion-audit.ts';
import { settle, waitForRecordingEntrance } from './render.ts';
import type { Finding } from './types.ts';
import { startWebEntranceCapture, writeWebSegments } from './web-qa.ts';

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
  choreography?: string;
  style?: string;
  script?: string;
}

export interface RenderWebOptions {
  audit?: (page: Page) => Promise<void>;
  recording?: boolean;
  qa?: boolean;
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
:root{${rootVarsCss(input.cssVars)}}
html,body{margin:0;padding:0}
</style>
${input.style ? `<style>\n${input.style}\n</style>\n` : ''}
${input.choreography ? CHOREOGRAPHY_HEAD : ''}
</head>
<body data-carrier="web">
<main class="ds-flow">
${input.unitsHtml.join('\n')}
</main>
${input.choreography ? `<script>${input.choreography}</script>\n` : ''}${input.script ? `<script>${input.script}</script>\n` : ''}</body>
</html>
`;
}

export interface WebRender {
  index: string;
  images: string[];
  video?: string;
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

async function scrollThrough(page: Page): Promise<void> {
  const stops = await page.evaluate(() => Math.ceil((document.documentElement.scrollHeight - window.innerHeight) / (window.innerHeight * 0.6)));
  for (let step = 1; step <= stops; step += 1) {
    await page.evaluate((fraction) => window.scrollTo(0, window.innerHeight * 0.6 * fraction), step);
    await page.waitForTimeout(120);
  }
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

export async function renderWeb(input: WebPageInput & { outDir: string }, options: RenderWebOptions = {}): Promise<WebRender> {
  const index = join(input.outDir, 'index.html');
  await writeFile(index, buildWebPage(input));
  const url = pathToFileURL(index).href;
  const browser = await chromium.launch();
  try {
    const images: string[] = [];
    const qaPage = options.qa ? await browser.newPage() : undefined;
    const segments: Record<string, Awaited<ReturnType<typeof writeWebSegments>>> = {};
    const snapshots = {} as Record<WebViewport, PageSnapshot>;
    for (const name of ['desktop', 'mobile'] as const) {
      const context = await browser.newContext({ viewport: WEB_VIEWPORTS[name], deviceScaleFactor: 1, reducedMotion: 'no-preference' });
      await context.addInitScript(markStatic);
      const page = await context.newPage();
      await page.goto(url);
      await settle(page);
      snapshots[name] = await collectSnapshot(page);
      const png = join(input.outDir, `web-${name}.png`);
      const buffer = await page.screenshot({ path: png, type: 'png', fullPage: true });
      if (qaPage) segments[name] = await writeWebSegments(qaPage, buffer, input.outDir, name, WEB_VIEWPORTS[name].height);
      images.push(png);
      await context.close();
    }

    const step = options.audit ?? scrollThrough;
    snapshots.desktop.motion = {
      animations: await auditMotion(browser, url, { viewport: WEB_VIEWPORTS.desktop, reducedMotion: 'no-preference', step }),
      reduced: await auditMotion(browser, url, { viewport: WEB_VIEWPORTS.desktop, reducedMotion: 'reduce', step }),
    };

    if (options.recording === false) return { index, images, snapshots };

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
      const capture = qaPage ? await startWebEntranceCapture(page) : undefined;
      try {
        await page.goto(url);
        capture?.navigationFinished();
        await waitForRecordingEntrance(page);
        await page.waitForTimeout(LEAD_IN_MS);
        if (capture) {
          const entrance = await capture.finish(qaPage!, input.outDir);
          await writeFile(join(input.outDir, 'web-qa.json'), `${JSON.stringify({ segments, entrance }, null, 2)}\n`);
        }
      } finally {
        await capture?.abort();
      }
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

export function checkWeb(snapshots: Record<WebViewport, PageSnapshot>, context: Omit<CheckContext, 'snapshot'>, rules: Rule[] = ALL_RULES): Finding[] {
  const key = (finding: Finding) => `${finding.ruleId}|${finding.location.selector ?? ''}|${finding.message}`;
  const desktop = runRules(rules, { ...context, snapshot: snapshots.desktop });
  const seen = new Set(desktop.map(key));
  const mobile = runRules(rules, { ...context, snapshot: snapshots.mobile })
    .filter((finding) => !seen.has(key(finding)))
    .map((finding) => ({ ...finding, message: `${finding.message}（手机宽度 ${WEB_VIEWPORTS.mobile.width}）` }));
  return sortFindings([...desktop, ...mobile]);
}

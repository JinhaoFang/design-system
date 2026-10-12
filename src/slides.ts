/*
 * Slides carrier: writes the page (slides-page.ts), then renders it with one Chromium at 1920x1080, device scale 1, no-preference motion.
 * Per slide (1-based number n): enter it through the runtime (dsSlides.go), settle (fonts loaded, animations finished), snapshot only that slide, run all rules on that snapshot, screenshot slide-<nn>.png.
 * Every finding gets location.slide = n. Rules run once per slide with CheckContext.slide set; the work description is passed whole.
 * After the last slide the same page is printed to slides.pdf (print media stacks every slide, entered ones already in their final state): one 1920x1080px page per slide.
 * Motion audit (motion-audit.ts): before the still pass, two audit passes (normal motion, reduced motion emulated) flip through every slide and record the animations each slide starts; each slide's records become its snapshot.motion.
 * The built page embeds the entrance choreography script (choreography.ts). The two motion record lists are saved only in motion.json; its path is returned to the build pipeline.
 * Recording: a second context with recordVideo (real time, 1920x1080) opens the page, waits for fonts only, then presses ArrowRight through the deck, waiting for dsSlides.entered() and holding HOLD_MS on each slide.
 * Stills use data-render="static" to bypass page turns and declarative entrances; print also strips wrapper transforms, shade and projection. motion.json preserves both audit passes.
 * Outputs in outDir: index.html, slide-<nn>.png (exact 1920x1080), slides.pdf, slides.webm, motion.json.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import { ALL_RULES } from './checker/rules/index.ts';
import { runRules, sortFindings } from './checker/registry.ts';
import type { FontCheckData } from './checker/font-data.ts';
import { collectSnapshot } from './checker/snapshot.ts';
import type { FontEntry } from './library.ts';
import { auditMotion } from './checker/motion-audit.ts';
import type { MotionSnapshot } from './checker/motion-audit.ts';
import { buildChoreographyScript } from './choreography.ts';
import { settle } from './render.ts';
import { SLIDE_HEIGHT, SLIDE_WIDTH, buildSlidesPage } from './slides-page.ts';
import type { ResolvedTokens } from './tokens.ts';
import type { Finding } from './types.ts';
import type { Work } from './work.ts';
import type { SlidesTransition } from './slides-transition.ts';

export interface SlidesInput {
  work: Work;
  tokens: ResolvedTokens;
  fonts: FontEntry[];
  fontCheck: FontCheckData;
  unitsHtml: string[];
  outDir: string;
  transition?: SlidesTransition | undefined;
}

export interface SlidesOutput {
  index: string;
  images: string[];
  pdf: string;
  video: string;
  findings: Finding[];
  motionJson: string;
}

function slideFileName(number: number, count: number): string {
  return `slide-${String(number).padStart(Math.max(2, String(count).length), '0')}.png`;
}

const HOLD_MS = 600;

async function flipThrough(page: Page, count: number): Promise<void> {
  for (let number = 1; number <= count; number += 1) {
    await page.evaluate((target) => (window as any).dsSlides.go(target), number - 1);
    await page.evaluate(() => (window as any).dsSlides.entered());
    await page.waitForTimeout(60);
  }
}

async function recordFlip(browser: Browser, index: string, count: number, target: string): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'ds-slides-video-'));
  try {
    const context = await browser.newContext({
      viewport: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT },
      deviceScaleFactor: 1,
      reducedMotion: 'no-preference',
      recordVideo: { dir, size: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT } },
    });
    const page = await context.newPage();
    await page.goto(pathToFileURL(index).href);
    await page.evaluate(async () => {
      await Promise.all([...document.fonts].map((face) => face.load()));
      await document.fonts.ready;
    });
    for (let number = 1; number <= count; number += 1) {
      if (number > 1) await page.keyboard.press('ArrowRight');
      await page.evaluate(() => (window as any).dsSlides.entered());
      await page.waitForTimeout(HOLD_MS);
    }
    const video = page.video()!;
    await context.close();
    await video.saveAs(target);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function buildSlides(input: SlidesInput): Promise<SlidesOutput> {
  const { work, tokens, outDir } = input;
  const count = input.unitsHtml.length;
  await mkdir(outDir, { recursive: true });
  const index = join(outDir, 'index.html');
  await writeFile(index, buildSlidesPage({ title: work.concept, cssVars: tokens.cssVars, fonts: input.fonts, unitsHtml: input.unitsHtml, choreography: buildChoreographyScript(tokens), transition: input.transition }));

  const pdf = join(outDir, 'slides.pdf');
  const video = join(outDir, 'slides.webm');
  const motionJson = join(outDir, 'motion.json');
  const images: string[] = [];
  const findings: Finding[] = [];
  let motion: MotionSnapshot;
  const browser = await chromium.launch();
  try {
    const stage = { width: SLIDE_WIDTH, height: SLIDE_HEIGHT };
    const audit = { viewport: stage, step: (page: Page) => flipThrough(page, count) };
    motion = {
      animations: await auditMotion(browser, pathToFileURL(index).href, { ...audit, reducedMotion: 'no-preference' }),
      reduced: await auditMotion(browser, pathToFileURL(index).href, { ...audit, reducedMotion: 'reduce' }),
    };
    await writeFile(motionJson, `${JSON.stringify(motion, null, 2)}\n`);
    const context = await browser.newContext({
      viewport: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT },
      deviceScaleFactor: 1,
      reducedMotion: 'no-preference',
    });
    await context.addInitScript(() => {
      const mark = () => document.documentElement.setAttribute('data-render', 'static');
      if (document.documentElement) mark();
      else new MutationObserver((_records, observer) => {
        if (document.documentElement) { mark(); observer.disconnect(); }
      }).observe(document, { childList: true });
    });
    const page = await context.newPage();
    await page.goto(pathToFileURL(index).href);
    for (let number = 1; number <= count; number += 1) {
      await page.evaluate((target) => (window as any).dsSlides.go(target), number - 1);
      await settle(page);
      const snapshot = await collectSnapshot(page, `[data-ds-slide="${number}"]`);
      snapshot.motion = {
        animations: motion.animations.filter((record) => record.slide === number),
        reduced: motion.reduced.filter((record) => record.slide === number),
      };
      for (const finding of runRules(ALL_RULES, { snapshot, work, tokens, fonts: input.fontCheck, slide: number })) {
        findings.push({ ...finding, location: { slide: number, ...finding.location } });
      }
      const png = join(outDir, slideFileName(number, count));
      await page.screenshot({ path: png, type: 'png' });
      images.push(png);
    }
    await page.pdf({ path: pdf, width: `${SLIDE_WIDTH}px`, height: `${SLIDE_HEIGHT}px`, printBackground: true });
    await context.close();
    await recordFlip(browser, index, count, video);
  } finally {
    await browser.close();
  }
  return { index, images, pdf, video, findings: sortFindings(findings), motionJson };
}

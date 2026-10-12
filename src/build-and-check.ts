/*
 * The build-and-check pipeline (the product's one entry point): validate system -> validate work -> tokens to CSS -> render layouts to HTML -> render PNG -> run rules -> write report.
 * Input: system directory, work description file, output directory, library directory (skeleton + font list + optional shared content).
 * Output files in outDir: index.html, fonts/, report.json, report.md, plus per carrier: social-<canvas>.png (social); web-desktop.png, web-mobile.png (full page) and web-scroll.webm (web, built by web.ts; canvas reported as "1440+390");
 * slide-<nn>.png, slides.pdf, slides.webm (slides, built by slides.ts; the stage canvas is reported as "stage"). Returns the Report, artifact paths and the exit status (0 = no errors, 1 = errors found).
 * validateSystem is the first stage on its own (the validate-system subcommand): SYSTEM.md, token file, font references and system units; it throws one BuildError listing every problem.
 * Image ids referenced by the work (briefs in <library>/content/images.json) are resolved to files in <system>/images/ and copied into outDir/images/ (assets.ts); a missing id fails the build before rendering.
 * Entrance choreography attributes (data-ds-enter and friends, choreography.ts) in the rendered units are validated against the system's tokens before rendering.
 * Slides optionally load <system>/slides.transition.json (token references, slides-transition.ts) before assembling their page; motion.json stores both animation audit passes.
 * Web/slides motion.json is the sole persisted copy of { animations, reduced }, the same animation records used by the checker (duration, easing, properties, entrance, delay and keyframes).
 * CJK fonts are subset from the final page before rendering (font-subset.ts); font checks read the shipped files in outDir/fonts.
 * Validation problems (bad system, work, fonts or image files) throw BuildError before or during rendering and produce no report. Carriers without a renderer yet (see RENDERABLE_CARRIERS) fail after validation.
 */
import { writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { resolveWorkImages } from './assets.ts';
import { assertChoreography, buildChoreographyScript } from './choreography.ts';
import { ALL_RULES } from './checker/rules/index.ts';
import { loadFontCheckData } from './checker/font-data.ts';
import type { MotionSnapshot } from './checker/motion-audit.ts';
import { runRules } from './checker/registry.ts';
import { RENDERABLE_CARRIERS, SOCIAL_CANVASES } from './carriers.ts';
import type { CarrierId } from './carriers.ts';
import { loadFontManifest, loadImageBriefs, loadSharedContent, loadSkeleton, loadSystemUnits, mergeUnits } from './library.ts';
import type { FontEntry, FontManifest, Skeleton } from './library.ts';
import { DEFAULT_FONT_CACHE } from './fonts.ts';
import { copyFonts } from './font-subset.ts';
import { renderCustom, renderUnit } from './layout.ts';
import { buildPage } from './page.ts';
import { renderImage } from './render.ts';
import { buildSlides } from './slides.ts';
import { buildSlidesPage, SLIDE_WIDTH, SLIDE_HEIGHT } from './slides-page.ts';
import { loadSlidesTransition } from './slides-transition.ts';
import { exitCodeFor, makeReport, reportToMarkdown } from './report.ts';
import { validateSystemDoc } from './system.ts';
import type { SystemMeta } from './system.ts';
import { checkTokenRequirements, readTokenFile, resolveForCarrier } from './tokens.ts';
import type { ParsedTokens, ResolvedTokens } from './tokens.ts';
import { BuildError } from './types.ts';
import type { Finding, Report } from './types.ts';
import { loadWork, resolveFragments, validateWork } from './work.ts';
import { WEB_VIEWPORTS, buildWebPage, checkWeb, renderWeb } from './web.ts';
import type { Work } from './work.ts';

export interface BuildOptions {
  systemDir: string;
  workPath: string;
  outDir: string;
  libraryDir: string;
  fontCacheDir?: string;
}

export interface ValidateOptions {
  systemDir: string;
  libraryDir: string;
}

export interface ValidatedSystem {
  meta: SystemMeta;
  tokens: ParsedTokens;
  manifest: FontManifest;
  skeletons: Partial<Record<CarrierId, Skeleton>>;
}

export interface BuildResult {
  exitCode: 0 | 1;
  report: Report;
  artifacts: { outDir: string; index: string; images: string[]; pdf?: string; video?: string; motionJson?: string; reportJson: string; reportMarkdown: string };
}

async function collect<T>(issues: string[], action: () => Promise<T>): Promise<T | undefined> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof BuildError) {
      issues.push(...error.issues);
      return undefined;
    }
    throw error;
  }
}

export async function validateSystem(options: ValidateOptions): Promise<ValidatedSystem> {
  const { systemDir, libraryDir } = options;
  const issues: string[] = [];
  const doc = await validateSystemDoc(join(systemDir, 'SYSTEM.md'));
  issues.push(...doc.issues);
  const tokenFile = await readTokenFile(join(systemDir, 'system.tokens.json'));
  issues.push(...tokenFile.issues);
  const manifest = await collect(issues, () => loadFontManifest(libraryDir));
  const carriers = doc.meta?.carriers ?? [];

  if (tokenFile.parsed && manifest) {
    issues.push(
      ...checkTokenRequirements(tokenFile.parsed, { carriers, fontIds: new Set(manifest.fonts.map((font) => font.id)) }),
    );
  }
  const skeletons: Partial<Record<CarrierId, Skeleton>> = {};
  for (const carrier of carriers) {
    const skeleton = await collect(issues, async () =>
      mergeUnits(await loadSkeleton(libraryDir, carrier), await loadSystemUnits(systemDir, carrier), carrier),
    );
    if (skeleton) skeletons[carrier] = skeleton;
  }
  if (issues.length || !doc.meta || !tokenFile.parsed || !manifest) throw new BuildError([...new Set(issues)]);
  return { meta: doc.meta, tokens: tokenFile.parsed, manifest, skeletons };
}

async function writeReport(outDir: string, report: Report): Promise<{ reportJson: string; reportMarkdown: string }> {
  const reportJson = join(outDir, 'report.json');
  const reportMarkdown = join(outDir, 'report.md');
  await writeFile(reportJson, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(reportMarkdown, reportToMarkdown(report));
  return { reportJson, reportMarkdown };
}

async function finishSlides(input: {
  systemDir: string;
  work: Work;
  tokens: ResolvedTokens;
  usedFonts: FontEntry[];
  manifest: FontManifest;
  fontCacheDir: string;
  unitsHtml: string[];
  outDir: string;
}): Promise<BuildResult> {
  const { systemDir, work, tokens, usedFonts, manifest, fontCacheDir, unitsHtml, outDir } = input;
  const transition = await loadSlidesTransition(systemDir, tokens);
  const html = buildSlidesPage({ title: work.concept, cssVars: tokens.cssVars, fonts: usedFonts, unitsHtml, choreography: buildChoreographyScript(tokens), transition });
  await copyFonts({ fontCacheDir, fonts: usedFonts, manifest, outDir, html, viewports: [{ width: SLIDE_WIDTH, height: SLIDE_HEIGHT }] });
  const fontCheck = await loadFontCheckData(manifest.fonts, usedFonts, join(outDir, 'fonts'));
  const slides = await buildSlides({ work, tokens, fonts: usedFonts, fontCheck, unitsHtml, outDir, transition });
  const report = makeReport(
    { system: basename(systemDir), work: { concept: work.concept, carrier: work.carrier, canvas: work.canvas ?? 'stage' } },
    slides.findings,
  );
  const files = await writeReport(outDir, report);
  return { exitCode: exitCodeFor(report), report, artifacts: { outDir, index: slides.index, images: slides.images, pdf: slides.pdf, video: slides.video, motionJson: slides.motionJson, ...files } };
}

export async function buildAndCheck(options: BuildOptions): Promise<BuildResult> {
  const { systemDir, workPath, outDir, libraryDir } = options;
  const fontCacheDir = options.fontCacheDir ?? DEFAULT_FONT_CACHE;
  const system = await validateSystem({ systemDir, libraryDir });

  const rawWork = await resolveFragments(await loadWork(workPath), systemDir);
  const skeleton = system.skeletons[rawWork.carrier];
  if (!skeleton) {
    throw new BuildError([`体系「${system.meta.id}」不支持载体 ${rawWork.carrier}，它支持：${system.meta.carriers.join('、')}`]);
  }
  const validated = validateWork(rawWork, skeleton, await loadSharedContent(libraryDir, rawWork.carrier), await loadImageBriefs(libraryDir));
  const work = await resolveWorkImages(validated, systemDir, outDir);
  const tokens = resolveForCarrier(system.tokens, work.carrier);
  const usedFonts = tokens.fontIds.map((id) => system.manifest.fonts.find((entry) => entry.id === id)!);
  if (!RENDERABLE_CARRIERS.includes(work.carrier)) {
    throw new BuildError([`载体 ${work.carrier} 的渲染尚未实现，目前可渲染：${RENDERABLE_CARRIERS.join('、')}`]);
  }

  const unitsHtml: string[] = [];
  for (const [index, item] of work.sequence.entries()) {
    unitsHtml.push(
      item.kind === 'custom' ? renderCustom(item, index) : await renderUnit(systemDir, work.carrier, item, skeleton.units[item.unit]!),
    );
  }

  assertChoreography(unitsHtml, tokens);
  if (work.carrier === 'slides') return finishSlides({ systemDir, work, tokens, usedFonts, manifest: system.manifest, fontCacheDir, unitsHtml, outDir });
  const pageInput = { title: work.concept, cssVars: tokens.cssVars, fonts: usedFonts, unitsHtml, choreography: buildChoreographyScript(tokens) };
  const size = work.carrier === 'web' ? WEB_VIEWPORTS.desktop : SOCIAL_CANVASES[work.canvas as keyof typeof SOCIAL_CANVASES];
  const html = work.carrier === 'web' ? buildWebPage(pageInput) : buildPage({ ...pageInput, ...size });
  await copyFonts({ fontCacheDir, fonts: usedFonts, manifest: system.manifest, outDir, html, viewports: work.carrier === 'web' ? Object.values(WEB_VIEWPORTS) : [size] });
  const fontCheck = await loadFontCheckData(system.manifest.fonts, usedFonts, join(outDir, 'fonts'));

  let index: string;
  let images: string[];
  let video: string | undefined;
  let findings: Finding[];
  let canvas: string;
  let motion: MotionSnapshot | undefined;
  if (work.carrier === 'web') {
    const web = await renderWeb({ outDir, ...pageInput });
    ({ index, images, video } = web);
    findings = checkWeb(web.snapshots, { work, tokens, fonts: fontCheck });
    motion = web.snapshots.desktop.motion;
    canvas = `${WEB_VIEWPORTS.desktop.width}+${WEB_VIEWPORTS.mobile.width}`;
  } else {
    canvas = work.canvas!;
    index = join(outDir, 'index.html');
    await writeFile(index, html);
    const png = join(outDir, `social-${canvas}.png`);
    const snapshot = await renderImage(index, size, png);
    images = [png];
    findings = runRules(ALL_RULES, { snapshot, work, tokens, fonts: fontCheck });
  }

  const report = makeReport(
    { system: basename(systemDir), work: { concept: work.concept, carrier: work.carrier, canvas } },
    findings,
  );
  const files = await writeReport(outDir, report);
  const motionJson = motion ? join(outDir, 'motion.json') : undefined;
  if (motionJson) await writeFile(motionJson, `${JSON.stringify(motion, null, 2)}\n`);

  return { exitCode: exitCodeFor(report), report, artifacts: { outDir, index, images, ...(video !== undefined && { video }), ...(motionJson && { motionJson }), ...files } };
}

/*
 * The build-and-check pipeline (the product's one entry point): validate system -> validate work -> tokens to CSS -> render layouts to HTML -> render PNG -> run rules -> write report.
 * Input: system directory, work description file, output directory, library directory (skeleton + font list + optional shared content).
 * Output files in outDir: index.html, fonts/, report.json, report.md, plus per carrier: social-<canvas>.png (social); web-desktop.png, web-mobile.png (full page) and web-scroll.webm (web, built by web.ts; canvas reported as "1440+390");
 * slide-<nn>.png, slides.pdf, slides.webm (slides, built by slides.ts; the stage canvas is reported as "stage"). Returns the Report, artifact paths and the exit status (0 = no errors, 1 = errors found).
 * validateSystem is the first stage on its own (the validate-system subcommand): SYSTEM.md, token file, font references and system units; it throws one BuildError listing every problem.
 * Validation problems (bad system, work or fonts) throw BuildError before or during rendering and produce no report. Carriers without a renderer yet (see RENDERABLE_CARRIERS) fail after validation.
 */
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { ALL_RULES } from './checker/rules/index.ts';
import { loadFontCheckData } from './checker/font-data.ts';
import type { FontCheckData } from './checker/font-data.ts';
import { runRules } from './checker/registry.ts';
import { RENDERABLE_CARRIERS, SOCIAL_CANVASES } from './carriers.ts';
import type { CarrierId } from './carriers.ts';
import { loadFontManifest, loadSharedContent, loadSkeleton, loadSystemUnits, mergeUnits } from './library.ts';
import type { FontEntry, FontManifest, Skeleton } from './library.ts';
import { DEFAULT_FONT_CACHE } from './fonts.ts';
import { renderCustom, renderUnit } from './layout.ts';
import { buildPage } from './page.ts';
import { renderImage } from './render.ts';
import { buildSlides } from './slides.ts';
import { exitCodeFor, makeReport, reportToMarkdown } from './report.ts';
import { validateSystemDoc } from './system.ts';
import type { SystemMeta } from './system.ts';
import { checkTokenRequirements, readTokenFile, resolveForCarrier } from './tokens.ts';
import type { ParsedTokens, ResolvedTokens } from './tokens.ts';
import { BuildError } from './types.ts';
import type { Finding, Report } from './types.ts';
import { loadWork, validateWork } from './work.ts';
import { WEB_VIEWPORTS, checkWeb, renderWeb } from './web.ts';
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
  artifacts: { outDir: string; index: string; images: string[]; pdf?: string; video?: string; reportJson: string; reportMarkdown: string };
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

async function copyFonts(fontCacheDir: string, fonts: FontEntry[], outDir: string): Promise<void> {
  await mkdir(join(outDir, 'fonts'), { recursive: true });
  for (const font of fonts) {
    try {
      await copyFile(join(fontCacheDir, font.file), join(outDir, 'fonts', font.file));
    } catch {
      throw new BuildError([`本地字体缓存里没有字体文件：${join(fontCacheDir, font.file)}（先运行「抓取字体」：pnpm ds fetch-fonts）`]);
    }
  }
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
  fontCheck: FontCheckData;
  unitsHtml: string[];
  outDir: string;
}): Promise<BuildResult> {
  const { systemDir, work, tokens, usedFonts, fontCheck, unitsHtml, outDir } = input;
  const slides = await buildSlides({ work, tokens, fonts: usedFonts, fontCheck, unitsHtml, outDir });
  const report = makeReport(
    { system: basename(systemDir), work: { concept: work.concept, carrier: work.carrier, canvas: work.canvas ?? 'stage' } },
    slides.findings,
  );
  const files = await writeReport(outDir, report);
  return { exitCode: exitCodeFor(report), report, artifacts: { outDir, index: slides.index, images: slides.images, pdf: slides.pdf, video: slides.video, ...files } };
}

export async function buildAndCheck(options: BuildOptions): Promise<BuildResult> {
  const { systemDir, workPath, outDir, libraryDir } = options;
  const fontCacheDir = options.fontCacheDir ?? DEFAULT_FONT_CACHE;
  const system = await validateSystem({ systemDir, libraryDir });

  const rawWork = await loadWork(workPath);
  const skeleton = system.skeletons[rawWork.carrier];
  if (!skeleton) {
    throw new BuildError([`体系「${system.meta.id}」不支持载体 ${rawWork.carrier}，它支持：${system.meta.carriers.join('、')}`]);
  }
  const work = validateWork(rawWork, skeleton, await loadSharedContent(libraryDir, rawWork.carrier));
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

  await copyFonts(fontCacheDir, usedFonts, outDir);
  const fontCheck = await loadFontCheckData(system.manifest.fonts, usedFonts, fontCacheDir);
  if (work.carrier === 'slides') return finishSlides({ systemDir, work, tokens, usedFonts, fontCheck, unitsHtml, outDir });

  let index: string;
  let images: string[];
  let video: string | undefined;
  let findings: Finding[];
  let canvas: string;
  if (work.carrier === 'web') {
    const web = await renderWeb({ outDir, title: work.concept, cssVars: tokens.cssVars, fonts: usedFonts, unitsHtml });
    ({ index, images, video } = web);
    findings = checkWeb(web.snapshots, { work, tokens, fonts: fontCheck });
    canvas = `${WEB_VIEWPORTS.desktop.width}+${WEB_VIEWPORTS.mobile.width}`;
  } else {
    canvas = work.canvas!;
    const size = SOCIAL_CANVASES[canvas as keyof typeof SOCIAL_CANVASES];
    index = join(outDir, 'index.html');
    await writeFile(
      index,
      buildPage({ title: work.concept, cssVars: tokens.cssVars, fonts: usedFonts, ...size, unitsHtml }),
    );
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

  return { exitCode: exitCodeFor(report), report, artifacts: { outDir, index, images, ...(video !== undefined && { video }), ...files } };
}

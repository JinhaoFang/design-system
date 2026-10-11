/*
 * System page (体系总览页): buildSystemPage generates, for any system directory, one interactive page that shows the system's intent, material anchor, colors, fonts (with licenses), type/space/radius steps,
 * composition constraints, textures, identity marks, motion (live replays) and layouts, and links to the layout overview, the standard samples and the approved exemplars. Markup lives in system-page-html.ts.
 * Input: system directory, output directory, library directory (skeletons, font list, exemplars), font cache, optional overviewDir (output of the layout overview) and worksDir (a directory of built standard samples,
 * one build per sub-directory); the links are built from whatever artifacts (directories with an index.html) those directories contain, as relative paths from outDir.
 * Content: SYSTEM.md sections (header and prose), the token file resolved for the system's web carrier (or its first carrier), the font list entries the tokens use, the layouts directory.
 * Optional custom fragment: <system>/system-page/header.html replaces the default header; it is a Liquid template with system.{id,name,category,materialAnchor,scenarios,carriers}, may carry one <style> (scoped to the header).
 * Output files in outDir: index.html, fonts/, web-desktop.png and web-mobile.png (full-page screenshots, widths 1440 and 390), exemplars/<id>/<media> (approved exemplars of this system), replays.json,
 * report.json and report.md. The page goes through the same web rendering and checking as a work (web.ts), with the composition and anti-homogeneity rules left out; every other rule applies.
 * Motion audit: the two audit passes (normal and reduced motion emulated) scroll through the page and click every replay control; the normal pass then flips the page's reduced-motion switch and clicks every control again.
 * The animation records of both passes are returned as `replays` and written to replays.json.
 * exitCode: 0 = no errors in the report, 1 = errors. Validation problems throw BuildError.
 */
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join, relative, sep } from 'node:path';
import { Liquid } from 'liquidjs';
import type { Page } from 'playwright';
import { scanArtifacts } from './artifact-scan.ts';
import type { ArtifactEntry } from './artifact-scan.ts';
import { copyFonts, validateSystem } from './build-and-check.ts';
import { assertChoreography, buildChoreographyScript } from './choreography.ts';
import { loadFontCheckData } from './checker/font-data.ts';
import type { AnimationRecord } from './checker/motion-audit.ts';
import { ALL_RULES } from './checker/rules/index.ts';
import { CARRIERS } from './carriers.ts';
import type { CarrierId } from './carriers.ts';
import { DEFAULT_FONT_CACHE } from './fonts.ts';
import { escapeHtml } from './layout.ts';
import { inline, renderMarkdown } from './markdown-lite.ts';
import { layoutsOf } from './overview.ts';
import { exitCodeFor, makeReport, reportToMarkdown } from './report.ts';
import { parseSections, splitHeader } from './system.ts';
import type { Section } from './system.ts';
import { renderSystemPage } from './system-page-html.ts';
import type { ExemplarView, FontView, LayoutView, LinkGroup, LinkView, PageModel } from './system-page-html.ts';
import { resolveForCarrier } from './tokens.ts';
import { BuildError } from './types.ts';
import type { Report } from './types.ts';
import { WEB_VIEWPORTS, checkWeb, renderWeb } from './web.ts';
import type { Work } from './work.ts';

export interface SystemPageOptions {
  systemDir: string;
  outDir: string;
  libraryDir: string;
  fontCacheDir?: string;
  overviewDir?: string;
  worksDir?: string;
}

export interface SystemPageResult {
  exitCode: 0 | 1;
  report: Report;
  replays: { animations: AnimationRecord[]; reduced: AnimationRecord[] };
  artifacts: { outDir: string; index: string; images: string[]; replays: string; reportJson: string; reportMarkdown: string };
}

const SKIPPED_CATEGORIES = new Set(['composition', 'anti-homogeneity']);
const CUSTOM_HEADER = join('system-page', 'header.html');

const headerEngine = new Liquid({ outputEscape: (value: unknown) => escapeHtml(String(value)), strictVariables: true, strictFilters: true, jsTruthy: true });

function flatten(sections: Section[]): Section[] {
  return sections.flatMap((section) => [section, ...flatten(section.children)]);
}

function find(sections: Section[], level: number, title: string): Section | undefined {
  return flatten(sections).find((section) => section.level === level && section.title === title);
}

function proseOf(section: Section | undefined): string {
  if (!section) return '';
  const children = section.children.map((child) => `<h4>${inline(child.title)}</h4>\n${proseOf(child)}`).join('\n');
  return [renderMarkdown(section.own), children].filter(Boolean).join('\n');
}

function posix(path: string): string {
  return path.split(sep).join('/');
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await readdir(path);
    return true;
  } catch {
    return false;
  }
}

function linkTo(outDir: string, entry: ArtifactEntry): string {
  return posix(relative(outDir, join(entry.dir, 'index.html')));
}

function noteOf(entry: ArtifactEntry): string {
  const counts = entry.errors !== undefined ? `${entry.errors} 个错误，${entry.warnings ?? 0} 个警告` : '';
  return [entry.concept, counts].filter(Boolean).join(' · ');
}

async function overviewLinks(outDir: string, overviewDir: string | undefined): Promise<LinkGroup[]> {
  if (!overviewDir) return [];
  const groups = new Map<string, LinkView[]>();
  for (const entry of await scanArtifacts(overviewDir)) {
    const parts = entry.rel.split('/');
    const carrier = parts[0] as CarrierId;
    const label = carrier in CARRIERS ? CARRIERS[carrier].label : (parts[0] ?? '排法总览');
    const title = parts[0] === 'social' && parts.length > 2 ? `${label} · ${parts[1]}` : label;
    const link: LinkView = { href: linkTo(outDir, entry), label: parts[parts.length - 1] || '排法总览', note: noteOf(entry) };
    groups.set(title, [...(groups.get(title) ?? []), link]);
  }
  return [...groups].map(([title, links]) => ({ title, links }));
}

async function workLinks(outDir: string, worksDir: string | undefined): Promise<LinkView[]> {
  if (!worksDir) return [];
  return (await scanArtifacts(worksDir)).map((entry) => ({ href: linkTo(outDir, entry), label: entry.rel || basename(entry.dir), note: noteOf(entry) }));
}

const SOURCE_LABEL: Record<string, string> = { external: '外部收集', copy: '临摹', original: '原创' };

async function approvedExemplars(libraryDir: string, systemId: string, outDir: string): Promise<ExemplarView[]> {
  const root = join(libraryDir, 'exemplars');
  let names: string[];
  try {
    names = (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  } catch {
    return [];
  }
  const views: ExemplarView[] = [];
  for (const name of names) {
    let record: any;
    try {
      record = JSON.parse(await readFile(join(root, name, 'exemplar.json'), 'utf8'));
    } catch {
      continue;
    }
    if (record.approval?.status !== 'approved' || !Array.isArray(record.systems) || !record.systems.includes(systemId)) continue;
    const view: ExemplarView = {
      id: name,
      title: String(record.title ?? name),
      carrier: String(record.carrier ?? ''),
      sourceType: SOURCE_LABEL[record.sourceType] ?? String(record.sourceType ?? ''),
      copyright: String(record.copyright ?? ''),
      ...(typeof record.sourceUrl === 'string' && record.sourceUrl !== '' && { sourceUrl: record.sourceUrl }),
    };
    if (record.media?.status === 'present' && typeof record.media.file === 'string') {
      const source = join(root, name, record.media.file);
      try {
        await mkdir(join(outDir, 'exemplars', name), { recursive: true });
        await copyFile(source, join(outDir, 'exemplars', name, record.media.file));
        view.media = { href: `exemplars/${name}/${record.media.file}`, kind: record.media.kind === 'recording' ? 'recording' : 'screenshot' };
      } catch {
        delete view.media;
      }
    }
    views.push(view);
  }
  return views;
}

async function customHeader(systemDir: string, meta: PageModel['meta']): Promise<string | undefined> {
  let source: string;
  try {
    source = await readFile(join(systemDir, CUSTOM_HEADER), 'utf8');
  } catch {
    return undefined;
  }
  try {
    const html = await headerEngine.parseAndRender(source, {
      system: { id: meta.id, name: meta.name, category: meta.category, materialAnchor: meta.materialAnchor, scenarios: meta.scenarios, carriers: meta.carriers },
    });
    return html.replace(/<style>([\s\S]*?)<\/style>/g, (_match: string, css: string) => `<style>@scope (header[data-ds-custom-header]) {${css}}</style>`);
  } catch (error) {
    throw new BuildError([`体系的自定义页头 ${join(systemDir, CUSTOM_HEADER)} 有误：${(error as Error).message}`]);
  }
}

async function layoutViews(systemDir: string, system: Awaited<ReturnType<typeof validateSystem>>): Promise<LayoutView[]> {
  const views: LayoutView[] = [];
  for (const carrier of system.meta.carriers) {
    const units: LayoutView['units'] = [];
    for (const [id, spec] of Object.entries(system.skeletons[carrier]?.units ?? {})) {
      const layouts = await layoutsOf(systemDir, carrier, id);
      if (layouts.length) units.push({ id, label: spec.label, layouts });
    }
    views.push({ carrier, units });
  }
  return views;
}

async function driveReplays(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    const reach = document.documentElement.scrollHeight - window.innerHeight;
    for (let y = 0; y <= reach; y += window.innerHeight * 0.6) {
      window.scrollTo(0, y);
      await wait(80);
    }
    window.scrollTo(0, 0);
    const clickAll = async () => {
      for (const button of document.querySelectorAll<HTMLElement>('[data-ds-replay]')) {
        button.click();
        await wait(20);
      }
    };
    await clickAll();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelector<HTMLElement>('[data-ds-reduce-toggle]')?.click();
      await clickAll();
    }
  });
}

export async function buildSystemPage(options: SystemPageOptions): Promise<SystemPageResult> {
  const { systemDir, outDir, libraryDir } = options;
  const fontCacheDir = options.fontCacheDir ?? DEFAULT_FONT_CACHE;
  const system = await validateSystem({ systemDir, libraryDir });
  const carrier: CarrierId = system.meta.carriers.includes('web') ? 'web' : system.meta.carriers[0]!;
  const tokens = resolveForCarrier(system.tokens, carrier);
  const usedFonts = tokens.fontIds.map((id) => system.manifest.fonts.find((entry) => entry.id === id)!);

  const fonts: FontView[] = system.tokens.tokens
    .filter((token) => token.path[0] === 'font' && token.fontId)
    .map((token) => ({ role: token.path[1]!, cssVar: `--ds-${token.path.join('-')}`, entry: system.manifest.fonts.find((entry) => entry.id === token.fontId)! }));

  const text = await readFile(join(systemDir, 'SYSTEM.md'), 'utf8');
  const sections = parseSections(splitHeader(text).body);
  const top = (title: string) => find(sections, 2, title);
  const visual = top('视觉语言')?.children ?? [];
  const mark = find(visual, 3, '识别符号');

  await mkdir(outDir, { recursive: true });
  const header = await customHeader(systemDir, system.meta);
  const model: PageModel = {
    meta: system.meta,
    tokens,
    parsed: system.tokens,
    fonts,
    intentHtml: proseOf(top('意图')),
    anchorHtml: proseOf(top('材质锚点')),
    colorHtml: proseOf(find(visual, 3, '色彩')),
    fontsHtml: proseOf(find(visual, 3, '字体')),
    layoutHtml: proseOf(find(visual, 3, '版面')),
    shapeHtml: proseOf(find(visual, 3, '形态')),
    imageryHtml: proseOf(find(visual, 3, '图像与画风')),
    marksHtml: renderMarkdown(mark?.own ?? []),
    motionHtml: proseOf(top('动效语言')),
    layouts: await layoutViews(systemDir, system),
    ...(header !== undefined && { customHeader: header }),
    overview: await overviewLinks(outDir, options.overviewDir && (await pathExists(options.overviewDir)) ? options.overviewDir : undefined),
    works: await workLinks(outDir, options.worksDir && (await pathExists(options.worksDir)) ? options.worksDir : undefined),
    exemplars: await approvedExemplars(libraryDir, system.meta.id, outDir),
  };
  const page = renderSystemPage(model);
  assertChoreography([page.body], tokens);

  await copyFonts(fontCacheDir, usedFonts, outDir);
  const fontCheck = await loadFontCheckData(system.manifest.fonts, usedFonts, fontCacheDir);
  const render = await renderWeb(
    { outDir, title: page.title, cssVars: tokens.cssVars, fonts: usedFonts, unitsHtml: [page.body], choreography: buildChoreographyScript(tokens), style: page.style, script: page.script },
    { audit: driveReplays, recording: false },
  );
  const work: Work = { system: system.meta.id, carrier: 'web', concept: page.title, sequence: [] };
  const rules = ALL_RULES.filter((rule) => !SKIPPED_CATEGORIES.has(rule.category));
  const findings = checkWeb(render.snapshots, { work, tokens, fonts: fontCheck }, rules);
  const report = makeReport(
    { system: system.meta.id, work: { concept: page.title, carrier: 'web', canvas: `${WEB_VIEWPORTS.desktop.width}+${WEB_VIEWPORTS.mobile.width}` } },
    findings,
  );
  const reportJson = join(outDir, 'report.json');
  const reportMarkdown = join(outDir, 'report.md');
  await writeFile(reportJson, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(reportMarkdown, reportToMarkdown(report));
  const replays = { animations: render.snapshots.desktop.motion?.animations ?? [], reduced: render.snapshots.desktop.motion?.reduced ?? [] };
  const replaysPath = join(outDir, 'replays.json');
  await writeFile(replaysPath, `${JSON.stringify(replays, null, 2)}\n`);

  return { exitCode: exitCodeFor(report), report, replays, artifacts: { outDir, index: render.index, images: render.images, replays: replaysPath, reportJson, reportMarkdown } };
}

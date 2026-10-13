/*
 * System page (体系总览页): buildSystemPage generates, for any system directory, one interactive page that shows the system's intent, material anchor, colors, fonts (grouped by family, with licenses), type/space/radius steps,
 * composition constraints, textures, identity marks, motion (live replays) and layouts, with thumbnails of the layout overview and the system samples (linked to their builds) and the approved exemplars. Markup lives in system-page-html.ts.
 * Input: system directory, output directory, library directory (skeletons, font list, exemplars), font cache, optional overviewDir (output of the layout overview) and worksDir (a directory of built system samples,
 * one build per sub-directory); the links and thumbnails are built from whatever artifacts (directories with an index.html and PNGs) those directories contain, as relative paths from outDir.
 * Social thumbnails use their overview build (prefer xiaohongshu); web thumbnails are static 1440px Chromium screenshots of each section[data-ds-unit][data-ds-layout], stored in layout-thumbnails/.
 * Slide thumbnails use the matching slide-NN.png with the slide hash; web links point at the overview build. preview-meta.json carries name, material anchor, tone, carriers and token colors for the navigation home.
 * Content: SYSTEM.md sections (header and prose), the token file resolved for the system's web carrier (or its first carrier), the font list entries the tokens use, the layouts directory.
 * Tables of SYSTEM.md are rendered as tables, except three kinds that are taken out of the prose and used as data: the layout table (a header with 排法, rows "`id` 中文名" + 说明) gives each layout its name and description,
 * a duration or easing table keyed by `name` gives the live motion cells their 用在 note, and (read, not removed) the color table is the legend of the color bands.
 * Optional custom fragment: <system>/system-page/header.html replaces the default header; it is a Liquid template with system.{id,name,category,materialAnchor,scenarios,carriers}, may carry one <style> (scoped to the header).
 * Output files in outDir: index.html, fonts/, web-desktop.png and web-mobile.png (full-page screenshots, widths 1440 and 390), exemplars/<id>/<media> (approved exemplars of this system), replays.json,
 * report.json and report.md. The page goes through the same web rendering and checking as a work (web.ts), with the composition and anti-homogeneity rules left out; every other rule applies.
 * Motion audit: the two audit passes (normal and reduced motion emulated) scroll through the page and click every replay control; the normal pass then flips the page's reduced-motion switch and clicks every control again.
 * The animation records of both passes are returned as `replays` and written to replays.json.
 * exitCode: 0 = no errors in the report, 1 = errors. Validation problems throw BuildError.
 */
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { settle } from './render.ts';
import { basename, join, relative, sep } from 'node:path';
import { Liquid } from 'liquidjs';
import type { Page } from 'playwright';
import { scanArtifacts } from './artifact-scan.ts';
import type { ArtifactEntry } from './artifact-scan.ts';
import { validateSystem } from './build-and-check.ts';
import { copyFonts } from './font-subset.ts';
import { assertChoreography, buildChoreographyScript } from './choreography.ts';
import { loadFontCheckData } from './checker/font-data.ts';
import type { AnimationRecord } from './checker/motion-audit.ts';
import { ALL_RULES } from './checker/rules/index.ts';
import { CARRIERS } from './carriers.ts';
import type { CarrierId } from './carriers.ts';
import { DEFAULT_FONT_CACHE } from './fonts.ts';
import { escapeHtml } from './layout.ts';
import { findTables, inline, renderMarkdown } from './markdown-lite.ts';
import type { MdTable } from './markdown-lite.ts';
import { layoutsOf } from './overview.ts';
import { exitCodeFor, makeReport, reportToMarkdown } from './report.ts';
import { parseSections, splitHeader } from './system.ts';
import type { Section } from './system.ts';
import { previewMetadata, renderSystemPage } from './system-page-html.ts';
import type { ExemplarView, FontView, LayoutItem, LayoutView, LinkView, PageModel } from './system-page-html.ts';
import { resolveForCarrier } from './tokens.ts';
import { BuildError } from './types.ts';
import type { Report } from './types.ts';
import { WEB_VIEWPORTS, buildWebPage, checkWeb, renderWeb } from './web.ts';
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

function proseOf(section: Section | undefined, skipStatement = false): string {
  if (!section) return '';
  const children = section.children.map((child) => `<h4>${inline(child.title)}</h4>\n${proseOf(child)}`).join('\n');
  const own = skipStatement ? section.own.filter((line, index, lines) => !(/^\*\*[^*]+\*\*$/.test(line.trim()) && lines.slice(0, index).every((before) => before.trim() === ''))) : section.own;
  return [renderMarkdown(own), children].filter(Boolean).join('\n');
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
  return [entry.canvas, counts].filter(Boolean).join('  ');
}

function thumbnailOf(outDir: string, entry: ArtifactEntry): string | undefined {
  const image = entry.images[0];
  return image === undefined ? undefined : posix(relative(outDir, join(entry.dir, image)));
}

function linkOf(outDir: string, entry: ArtifactEntry, label: string): LinkView {
  const image = thumbnailOf(outDir, entry);
  return { href: linkTo(outDir, entry), label, note: noteOf(entry), ...(image !== undefined && { image }), ...(entry.carrier === 'web' && { cropped: true }) };
}

const PREFERRED_CANVAS = 'xiaohongshu';

async function workLinks(outDir: string, worksDir: string | undefined): Promise<LinkView[]> {
  if (!worksDir) return [];
  return (await scanArtifacts(worksDir)).map((entry) => {
    const concept = entry.concept || entry.rel || basename(entry.dir);
    const [label, ...rest] = concept.split(/[：:]/);
    const detail = rest.join('：');
    return { ...linkOf(outDir, entry, label!), ...(detail !== '' && { detail }) };
  });
}

interface OverviewIndex {
  whole: Map<string, LinkView>;
  social: Map<string, LinkView>;
  web: Map<string, LinkView>;
  slides: Map<string, LinkView>;
}

async function indexOverview(outDir: string, overviewDir: string | undefined): Promise<OverviewIndex | undefined> {
  if (!overviewDir) return undefined;
  const index: OverviewIndex = { whole: new Map(), social: new Map(), web: new Map(), slides: new Map() };
  const canvasOf = new Map<string, string>();
  for (const entry of await scanArtifacts(overviewDir)) {
    const parts = entry.rel.split('/');
    if (parts.length === 1) {
      index.whole.set(parts[0]!, linkOf(outDir, entry, CARRIERS[parts[0] as CarrierId]?.label ?? parts[0]!));
      if (parts[0] === 'web' || parts[0] === 'slides') await unitThumbnails(outDir, entry, index[parts[0]]);
    }
    if (parts[0] === 'social' && parts.length === 3) {
      const key = parts[2]!;
      const canvas = parts[1]!;
      const known = canvasOf.get(key);
      if (known === PREFERRED_CANVAS || (known !== undefined && canvas !== PREFERRED_CANVAS && known < canvas)) continue;
      canvasOf.set(key, canvas);
      index.social.set(key, linkOf(outDir, entry, key));
    }
  }
  return index;
}

async function unitThumbnails(outDir: string, entry: ArtifactEntry, target: Map<string, LinkView>): Promise<void> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await context.addInitScript(() => document.documentElement ? document.documentElement.dataset.render = 'static' : new MutationObserver((_r, observer) => {
      if (document.documentElement) { document.documentElement.dataset.render = 'static'; observer.disconnect(); }
    }).observe(document, { childList: true }));
    const page = await context.newPage();
    await page.goto(pathToFileURL(join(entry.dir, 'index.html')).href);
    await settle(page);
    const units = page.locator('section[data-ds-unit][data-ds-layout]');
    await mkdir(join(outDir, 'layout-thumbnails'), { recursive: true });
    for (let i = 0; i < await units.count(); i++) {
      const unit = units.nth(i);
      const id = await unit.getAttribute('data-ds-unit');
      const layout = await unit.getAttribute('data-ds-layout');
      const key = `${id}-${layout}`;
      const link = linkOf(outDir, entry, key);
      if (entry.carrier === 'slides') {
        const slide = await unit.evaluate((el) => el.closest('[data-ds-slide]')?.getAttribute('data-ds-slide'));
        const image = entry.images.find((name) => name === `slide-${String(slide).padStart(2, '0')}.png`);
        if (image) target.set(key, { ...link, href: `${link.href}#${slide}`, image: posix(relative(outDir, join(entry.dir, image))) });
      } else {
        const image = `layout-thumbnails/web-${key}.png`;
        await unit.screenshot({ path: join(outDir, image), animations: 'disabled' });
        target.set(key, { ...link, image });
      }
    }
    await context.close();
  } finally {
    await browser.close();
  }
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

interface Notes {
  layouts: Map<string, { name: string; description: string }>;
  durations: Record<string, string>;
  easings: Record<string, string>;
  colorLegend: boolean;
  compositionTable: boolean;
}

function takeNotes(sections: Section[], durationNames: Set<string>, easingNames: Set<string>): Notes {
  const notes: Notes = { layouts: new Map(), durations: {}, easings: {}, colorLegend: false, compositionTable: false };
  for (const section of flatten(sections)) {
    const drop = new Set<number>();
    const takeLines = (table: MdTable) => {
      for (let index = table.start; index < table.end; index++) drop.add(index);
      const label = section.own[table.start - 2];
      if (table.start >= 2 && section.own[table.start - 1]!.trim() === '' && label !== undefined && /^\*\*[^*]+\*\*$/.test(label.trim())) {
        drop.add(table.start - 2);
        drop.add(table.start - 1);
      }
    };
    for (const table of findTables(section.own)) {
      if (section.title === '色彩') notes.colorLegend = true;
      if (table.header.some((cell) => cell.includes('跳跃率'))) notes.compositionTable = true;
      const layoutColumn = table.header.findIndex((cell) => cell.includes('排法'));
      const describeColumn = table.header.findIndex((cell) => cell.includes('说明'));
      if (layoutColumn >= 0 && describeColumn >= 0) {
        for (const row of table.rows) {
          const match = /^`([^`]+)`\s*(.*)$/.exec(row[layoutColumn] ?? '');
          if (match) notes.layouts.set(match[1]!, { name: match[2]!, description: row[describeColumn] ?? '' });
        }
        takeLines(table);
        continue;
      }
      const keys = table.rows.map((row) => /^`([^`]+)`$/.exec(row[0] ?? '')?.[1]);
      if (!table.rows.length || !keys.every((key): key is string => key !== undefined)) continue;
      const head = table.header[0] ?? '';
      const kind = head.includes('时长') ? 'durations' : head.includes('缓动') ? 'easings' : keys.every((key) => durationNames.has(key)) ? 'durations' : keys.every((key) => easingNames.has(key)) ? 'easings' : undefined;
      if (!kind) continue;
      table.rows.forEach((row, index) => {
        notes[kind][keys[index]!] = row.slice(2).filter(Boolean).join(' · ');
      });
      takeLines(table);
    }
    if (drop.size) section.own = section.own.filter((_line, index) => !drop.has(index));
  }
  return notes;
}

async function layoutViews(systemDir: string, system: Awaited<ReturnType<typeof validateSystem>>, notes: Notes, overview: OverviewIndex | undefined): Promise<LayoutView[]> {
  const views: LayoutView[] = [];
  for (const carrier of system.meta.carriers) {
    const units: LayoutView['units'] = [];
    for (const [id, spec] of Object.entries(system.skeletons[carrier]?.units ?? {})) {
      const names = await layoutsOf(systemDir, carrier, id);
      const layouts: LayoutItem[] = names.map((name) => {
        const build = overview?.[carrier].get(`${id}-${name}`);
        const note = notes.layouts.get(name);
        return {
          id: name,
          ...(note && { name: note.name, description: note.description }),
          ...(build && { href: build.href, ...(build.image !== undefined && { image: build.image }), ...(build.note && { note: build.note }) }),
        };
      });
      if (layouts.length) units.push({ id, label: spec.label, layouts });
    }
    const overall = overview?.whole.get(carrier);
    views.push({ carrier, units, ...(overall && { overall }) });
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
  const durationNames = new Set(tokens.entries.filter((entry) => entry.cssVar.startsWith('--ds-duration-')).map((entry) => entry.cssVar.slice('--ds-duration-'.length)));
  const easingNames = new Set(tokens.entries.filter((entry) => entry.cssVar.startsWith('--ds-easing-')).map((entry) => entry.cssVar.slice('--ds-easing-'.length)));
  const notes = takeNotes(sections, durationNames, easingNames);
  const overview = await indexOverview(outDir, options.overviewDir && (await pathExists(options.overviewDir)) ? options.overviewDir : undefined);
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
    anchorHtml: proseOf(top('材质锚点'), true),
    colorHtml: proseOf(find(visual, 3, '色彩')),
    fontsHtml: proseOf(find(visual, 3, '字体')),
    layoutHtml: proseOf(find(visual, 3, '版面')),
    shapeHtml: proseOf(find(visual, 3, '形态')),
    imageryHtml: proseOf(find(visual, 3, '图像与画风')),
    marksHtml: renderMarkdown(mark?.own ?? []),
    motionHtml: proseOf(top('动效语言')),
    layouts: await layoutViews(systemDir, system, notes, overview),
    ...(header !== undefined && { customHeader: header }),
    overviewGenerated: overview !== undefined,
    colorLegend: notes.colorLegend,
    compositionTable: notes.compositionTable,
    durationNotes: notes.durations,
    easingNotes: notes.easings,
    works: await workLinks(outDir, options.worksDir && (await pathExists(options.worksDir)) ? options.worksDir : undefined),
    exemplars: await approvedExemplars(libraryDir, system.meta.id, outDir),
  };
  await writeFile(join(outDir, 'preview-meta.json'), `${JSON.stringify(previewMetadata(model), null, 2)}\n`);
  const page = renderSystemPage(model);
  assertChoreography([page.body], tokens);

  const pageInput = { outDir, title: page.title, cssVars: tokens.cssVars, fonts: usedFonts, unitsHtml: [page.body], choreography: buildChoreographyScript(tokens), style: page.style, script: page.script };
  await copyFonts({ fontCacheDir, fonts: usedFonts, manifest: system.manifest, outDir, html: buildWebPage(pageInput), viewports: Object.values(WEB_VIEWPORTS) });
  const fontCheck = await loadFontCheckData(system.manifest.fonts, usedFonts, join(outDir, 'fonts'));
  const render = await renderWeb(
    pageInput,
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

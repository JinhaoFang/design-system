/*
 * Behavior tests for the system page (体系总览页), driven through buildSystemPage with the fixture system and the fixture library.
 * They assert artifact specs only: the files that come out, the system's values appearing in the page text, the animation records the replays produce under normal and reduced motion,
 * the links to the layout overview, standard samples and approved exemplars, and the checker report (zero errors, composition and anti-homogeneity skipped). No DOM structure, no pixels.
 * One page is built once for the whole file (a real Chromium run), with a layout overview, a standard sample and a few exemplars linked into it.
 */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';
import { buildAndCheck } from '../src/build-and-check.ts';
import { buildOverview } from '../src/overview.ts';
import { buildSystemPage } from '../src/system-page.ts';
import type { SystemPageResult } from '../src/system-page.ts';
import { fixtures, pngSize, tempDir } from './helpers.ts';
import { overviewLibrary } from './overview-helpers.ts';
import { patchedSystem, writeFileDeep } from './system-helpers.ts';

async function writeExemplar(library: string, id: string, patch: Record<string, unknown>): Promise<void> {
  const dir = join(library, 'exemplars', id);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'screenshot.png'), 'png');
  const record = {
    id,
    title: `范例${id}`,
    sourceType: 'external',
    sourceUrl: `https://example.com/${id}`,
    copyright: '示例工作室',
    carrier: 'web',
    systems: ['mini'],
    media: { kind: 'screenshot', status: 'present', file: 'screenshot.png' },
    annotation: { highlights: '留白', reasons: '节奏', scenes: '长文', materialAnchor: '纸', tonality: { 静动: 1, 疏密: 1, 冷暖: 1, 轻重: 1, 庄谐: 1 } },
    approval: { status: 'approved', date: '2026-10-11' },
    ...patch,
  };
  await writeFile(join(dir, 'exemplar.json'), JSON.stringify(record));
}

let library: string;
let overviewDir: string;
let worksDir: string;
let page: SystemPageResult;
let html: string;

beforeAll(async () => {
  library = await overviewLibrary();
  await writeExemplar(library, 'shown-web', {});
  await writeExemplar(library, 'shown-slides', { carrier: 'slides', sourceType: 'original', sourceUrl: undefined });
  await writeExemplar(library, 'still-candidate', { approval: { status: 'candidate' } });
  await writeExemplar(library, 'other-system', { systems: ['someone-else'] });

  const base = await tempDir('ds-system-page-');
  overviewDir = join(base, 'overview');
  worksDir = join(base, 'works');
  await buildOverview({ systemDir: fixtures.system, outDir: overviewDir, libraryDir: library, fontCacheDir: fixtures.fontCache, carriers: ['web'] });
  await buildAndCheck({ systemDir: fixtures.system, workPath: fixtures.work('web-clean'), outDir: join(worksDir, 'web-clean'), libraryDir: library, fontCacheDir: fixtures.fontCache });

  page = await buildSystemPage({
    systemDir: fixtures.system,
    outDir: join(base, 'system'),
    libraryDir: library,
    fontCacheDir: fixtures.fontCache,
    overviewDir,
    worksDir,
  });
  html = await readFile(page.artifacts.index, 'utf8');
}, 240_000);

describe('system page content', () => {
  test('writes the page, its fonts and screenshots at both web widths', async () => {
    expect(page.artifacts.index.endsWith('index.html')).toBe(true);
    expect(html.length).toBeGreaterThan(0);
    const [desktop, mobile] = page.artifacts.images;
    expect((await pngSize(desktop!)).width).toBe(1440);
    expect((await pngSize(mobile!)).width).toBe(390);
    expect(html).toContain('fonts/NotoSansSC-Regular.subset.woff2');
  });

  test('shows the intent, the material anchor, the identity marks and the tone of SYSTEM.md', () => {
    expect(html).toContain('夹具体系');
    expect(html).toContain('暖白哑光纸上的油墨印刷');
    expect(html).toContain('用最少的内容满足体系格式的全部必填项');
    expect(html).toContain('左上角的细线章节标记');
    expect(html).toContain('页脚的小号序号');
  });

  test('shows every colour, font, type step, space step, radius, duration, stagger and easing of the token file', () => {
    for (const color of ['paper', 'ink', 'surface', 'mute', 'accent']) expect(html).toContain(color);
    expect(html).toContain('Noto Sans SC');
    expect(html).toContain('OFL-1.1');
    for (const size of ['18px', '27px', '45px']) expect(html).toContain(size);
    for (const space of ['8px', '16px', '32px', '64px', '96px']) expect(html).toContain(space);
    for (const radius of ['4px', '8px', '16px']) expect(html).toContain(radius);
    for (const [name, ms] of [['quick', '120ms'], ['base', '240ms'], ['slow', '480ms'], ['tight', '60ms']]) {
      expect(html).toContain(name);
      expect(html).toContain(ms);
    }
    expect(html).toContain('settle');
    expect(html).toContain('cubic-bezier(0.2, 0.8, 0.2, 1)');
    expect(html).toContain('drag');
    expect(html).toContain('cubic-bezier(0.4, 0, 0.6, 1)');
  });

  test('shows the composition ratio constraints and the layouts of every carrier', () => {
    expect(html).toContain('web');
    for (const layout of ['corner', 'blackout', 'cards', 'columns', 'split', 'whiteout']) expect(html).toContain(layout);
  });
});

const slotsOf = (records: SystemPageResult['replays']['animations']) => new Set(records.map((record) => record.slot));
const exists = (path: string) => access(path).then(() => true, () => false);

describe('motion replays', () => {
  test('replaying every control records an animation for each entrance type, duration step, easing and stagger step', () => {
    const slots = slotsOf(page.replays.animations);
    for (const effect of ['fade', 'rise', 'fall', 'left', 'right']) expect(slots).toContain(`enter-${effect}`);
    for (const step of ['quick', 'base', 'slow']) expect(slots).toContain(`duration-${step}`);
    for (const easing of ['settle', 'drag']) expect(slots).toContain(`easing-${easing}`);
    expect(slots).toContain('stagger-tight');
  });

  test('the recorded durations and easings are the system ladder and curves', () => {
    const durationOf = (slot: string) => page.replays.animations.filter((record) => record.slot === slot).map((record) => record.durationMs);
    expect(durationOf('duration-quick')).toContain(120);
    expect(durationOf('duration-base')).toContain(240);
    expect(durationOf('duration-slow')).toContain(480);
    const easingOf = (slot: string) => page.replays.animations.filter((record) => record.slot === slot).flatMap((record) => record.easings);
    expect(easingOf('easing-settle')).toContain('cubic-bezier(0.2, 0.8, 0.2, 1)');
    expect(easingOf('easing-drag')).toContain('cubic-bezier(0.4, 0, 0.6, 1)');
    const ladder = new Set([120, 240, 480]);
    for (const record of page.replays.animations) expect(ladder.has(record.durationMs!)).toBe(true);
  });

  test('with reduced motion on, replays only fade for the shortest duration step and never move', () => {
    expect(page.replays.reduced.length).toBeGreaterThan(0);
    for (const record of page.replays.reduced.filter((entry) => entry.slot?.match(/^(enter|duration|easing|stagger)-/))) {
      expect(record.properties).toEqual(['opacity']);
      expect(record.durationMs).toBe(120);
    }
    expect(slotsOf(page.replays.reduced)).toContain('enter-rise');
  });

  test('flipping the on-page reduced-motion switch turns later replays into plain fades', () => {
    const rise = page.replays.animations.filter((record) => record.slot === 'enter-rise');
    expect(rise.some((record) => record.properties.includes('transform'))).toBe(true);
    expect(rise.some((record) => record.properties.length === 1 && record.properties[0] === 'opacity')).toBe(true);
  });

  test('writes the animation records next to the page', async () => {
    const written = JSON.parse(await readFile(page.artifacts.replays, 'utf8'));
    expect(written.animations.length).toBe(page.replays.animations.length);
    expect(written.reduced.length).toBe(page.replays.reduced.length);
  });
});

describe('checks on the page', () => {
  test('the page has zero errors and the report records which system and carrier it is', async () => {
    expect(page.report.summary.errors, JSON.stringify(page.report.findings, null, 1)).toBe(0);
    expect(page.exitCode).toBe(0);
    expect(page.report.system).toBe('mini');
    expect(page.report.work.carrier).toBe('web');
    expect(await exists(page.artifacts.reportJson)).toBe(true);
    expect(await exists(page.artifacts.reportMarkdown)).toBe(true);
  });

  test('composition and anti-homogeneity rules are not run on the page', () => {
    for (const finding of page.report.findings) expect(['composition', 'anti-homogeneity']).not.toContain(finding.category);
  });
});

describe('links', () => {
  const localLinks = () => [...html.matchAll(/href="([^"#:]+)"/g)].map((match) => match[1]!);

  test('links to the layout overview and the standard samples, and every local link points at something that exists', async () => {
    const links = localLinks();
    expect(links).toContain('../overview/web/index.html');
    expect(links).toContain('../works/web-clean/index.html');
    for (const link of links) expect(await exists(join(page.artifacts.outDir, link)), link).toBe(true);
  });

  test('lists only the approved exemplars of this system, web ones with their source link', async () => {
    expect(html).toContain('范例shown-web');
    expect(html).toContain('https://example.com/shown-web');
    expect(html).toContain('范例shown-slides');
    expect(html).not.toContain('still-candidate');
    expect(html).not.toContain('other-system');
    expect(await exists(join(page.artifacts.outDir, 'exemplars', 'shown-web', 'screenshot.png'))).toBe(true);
  });
});

describe('the page without links and with a custom header', () => {
  test('stands without overview, samples or exemplars, and says they are missing', async () => {
    const bare = await buildSystemPage({ systemDir: fixtures.system, outDir: await tempDir(), libraryDir: fixtures.library, fontCacheDir: fixtures.fontCache });
    const text = await readFile(bare.artifacts.index, 'utf8');
    expect(bare.report.summary.errors).toBe(0);
    expect(text).toContain('排法总览还没有生成');
    expect(text).toContain('标准样张还没有生成');
    expect(text).toContain('还没有已批准的范例');
  });

  test('uses the header fragment from the system directory in place of the default header', async () => {
    const system = await patchedSystem(async (dir) => {
      await writeFileDeep(
        join(dir, 'system-page', 'header.html'),
        '<style>h1{font-size:var(--ds-type-2)}</style><h1>定制页头：{{ system.name }}</h1><p>{{ system.id }}</p>',
      );
    });
    const custom = await buildSystemPage({ systemDir: system, outDir: await tempDir(), libraryDir: fixtures.library, fontCacheDir: fixtures.fontCache });
    const text = await readFile(custom.artifacts.index, 'utf8');
    expect(text).toContain('定制页头：夹具体系');
    expect(custom.report.summary.errors, JSON.stringify(custom.report.findings, null, 1)).toBe(0);
  });
});

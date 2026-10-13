/*
 * Preview navigation for regression-shaped output (used by preview.ts): the grouped home page and the generated per-system overview listing.
 * detectLayout(root, entries) -> how the served directory is shaped, from the artifacts found by artifact-scan.ts:
 *   "systems": one or more systems (regression output <id>/system, <id>/works/<name>, <id>/overview/<builds>; or a single system folder with system/, works/, overview/ at its top), plus "others", builds outside any system;
 *   "overview": a lone layout overview (overview.md at the top, builds beside it);
 *   "flat": anything else (a single build, an arbitrary folder), which keeps the flat listing in preview.ts.
 * A folder counts as a system when it has a system/ page build or overview/overview.md.
 * groupedHome(root, layout, flatSection) -> the home page: per system the system page as the primary entry, the system samples as thumbnails with error and warning counts, and one "排法总览" entry with its totals
 * The v2 home reads preview-meta.json emitted by buildSystemPage; it includes sticky navigation, cover panoramas, sample shelves, persisted folds/theme and a report table containing every build.
 * The overview action opens overviewListing at OVERVIEW_ROUTE + <overview folder>/; the overview builds and their reports are not listed on the home page; "others" are rendered by the flatSection callback. A lone overview shows its listing directly.
 * overviewListing(root, entries, base, home) -> the listing page for the builds under the overview folder `base` (relative path, "" for the root), grouped by carrier and canvas, each a thumbnail that opens the build,
 * with links to its report and to overview.md. listingBases(layout) are the folders for which that page exists. pageShell/encodePath/countsText/FLAT_CSS are shared with the flat listing.
 */
import { readFileSync } from 'node:fs';
import { access, readdir, readFile, open } from 'node:fs/promises';
import { join } from 'node:path';
import type { ArtifactEntry } from './artifact-scan.ts';
import { CARRIERS } from './carriers.ts';
import type { CarrierId } from './carriers.ts';
import { TONE_PAIRS } from './system.ts';
import type { ToneKey } from './system.ts';
import { escapeHtml } from './layout.ts';

export const OVERVIEW_ROUTE = '/_overview/';

export interface SystemGroup {
  id: string;
  system?: ArtifactEntry;
  works: ArtifactEntry[];
  overview: ArtifactEntry[];
  overviewBase: string;
}

export type PreviewLayout =
  | { kind: 'systems'; systems: SystemGroup[]; others: ArtifactEntry[] }
  | { kind: 'overview'; entries: ArtifactEntry[] }
  | { kind: 'flat' };

const NAV_CSS = readFileSync(new URL('./preview-nav.css', import.meta.url), 'utf8');
const NAV_SCRIPT = readFileSync(new URL('./preview-nav-runtime.js', import.meta.url), 'utf8');
export const FLAT_CSS = '';

export function encodePath(rel: string): string {
  return rel.split('/').map(encodeURIComponent).join('/');
}

export function pageShell(title: string, dir: string, body: string, css = '', jumps = '', entries: ArtifactEntry[] = []): string {
  const sum = totals(entries);
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${NAV_CSS}\n${css}</style></head><body>
<header class="top"><div class="wrap"><a class="brand" href="/"><b>设计体系库</b><span>预览</span></a><nav class="jump" aria-label="体系">${jumps}</nav><div class="status">${status(sum.errors, sum.warnings)}<button class="theme" type="button" aria-label="切换深浅色" data-theme-toggle>◐</button></div></div></header>
<main class="wrap"><section class="hero"><div class="rise"><h1>${escapeHtml(title)}</h1><p>${title === '体系目录' ? '每套都有一页体系总览、自己的体系样张，以及用同一份测试内容排出的排法总览。' : '按载体和画幅查看构建与检查报告。'}</p></div><div class="dir rise" title="${escapeHtml(dir)}"><bdi>${escapeHtml(dir)}</bdi></div></section>${body}<footer class="foot"><span>本页由 <code>pnpm ds preview</code> 生成，只在本机提供。</span><span>重新生成：<code>pnpm ds regress</code></span></footer></main><script>${NAV_SCRIPT}</script></body></html>`;
}

function status(errors: number, warnings: number): string {
  return `<span class="pill${errors ? ' bad' : ''}"><i></i>${errors} 个错误</span><span class="pill warn"><i></i>${warnings} 个警告</span>`;
}

function fold(id: string, title: string, count: string, body: string, open: boolean): string {
  return `<div class="fold"><button class="fold-head" type="button" aria-expanded="${open}" aria-controls="${escapeHtml(id)}"><b>${title}</b><span class="n num">${count}</span><i class="chev"></i></button><div class="fold-body" id="${escapeHtml(id)}"${open ? ' data-open' : ''}><div><div class="fold-inner">${body}</div></div></div></div>`;
}

export function countsText(errors: number | undefined, warnings: number | undefined): string {
  if (errors === undefined) return '';
  return `<span class="n${errors > 0 ? ' bad' : ''}">${errors} 个错误 · ${warnings ?? 0} 个警告</span>`;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function underPrefix(entries: ArtifactEntry[], prefix: string): ArtifactEntry[] {
  return prefix === '' ? entries : entries.filter((entry) => entry.rel.startsWith(`${prefix}/`));
}

function buildGroup(entries: ArtifactEntry[], id: string): { group: SystemGroup; rest: ArtifactEntry[] } {
  const group: SystemGroup = { id, works: [], overview: [], overviewBase: id === '' ? 'overview' : `${id}/overview` };
  const rest: ArtifactEntry[] = [];
  for (const entry of underPrefix(entries, id)) {
    const sub = id === '' ? entry.rel : entry.rel.slice(id.length + 1);
    if (sub === 'system') group.system = entry;
    else if (sub.startsWith('works/')) group.works.push(entry);
    else if (sub.startsWith('overview/')) group.overview.push(entry);
    else rest.push(entry);
  }
  return { group, rest };
}

async function isSystem(root: string, entries: ArtifactEntry[], id: string): Promise<boolean> {
  if (entries.some((entry) => entry.rel === (id === '' ? 'system' : `${id}/system`))) return true;
  return exists(join(root, id, 'overview', 'overview.md'));
}

export async function detectLayout(root: string, entries: ArtifactEntry[]): Promise<PreviewLayout> {
  if (entries.length === 0 || entries.some((entry) => entry.rel === '')) return { kind: 'flat' };
  if (await exists(join(root, 'overview.md'))) return { kind: 'overview', entries };
  if (await isSystem(root, entries, '')) {
    const { group, rest } = buildGroup(entries, '');
    return { kind: 'systems', systems: [group], others: rest };
  }
  const ids = [...new Set(entries.filter((entry) => entry.rel.includes('/')).map((entry) => entry.rel.split('/')[0]!))];
  const systems: SystemGroup[] = [];
  const others = new Set(entries);
  for (const id of ids) {
    if (!(await isSystem(root, entries, id))) continue;
    const { group, rest } = buildGroup(entries, id);
    systems.push(group);
    for (const entry of underPrefix(entries, id)) if (!rest.includes(entry)) others.delete(entry);
  }
  if (systems.length === 0) return { kind: 'flat' };
  return { kind: 'systems', systems, others: [...others] };
}

export function listingBases(layout: PreviewLayout): string[] {
  if (layout.kind === 'overview') return [''];
  if (layout.kind === 'systems') return layout.systems.filter((system) => system.overview.length > 0).map((system) => system.overviewBase);
  return [];
}

function thumbOf(entry: ArtifactEntry): string | undefined {
  const name = entry.images.find((image) => image.includes('desktop')) ?? entry.images.find((image) => !image.includes('mobile')) ?? entry.images[0];
  return name === undefined ? undefined : `/${encodePath(entry.rel)}/${encodeURIComponent(name)}`;
}

async function card(entry: ArtifactEntry, label: string, links = ''): Promise<string> {
  const thumb = thumbOf(entry);
  const picture = thumb === undefined ? '<span class="ph"></span>' : `<img src="${thumb}" alt="" loading="lazy">`;
  let ratio = entry.carrier === 'web' ? 281 / 176 : 1;
  const name = thumb?.split('/').pop();
  if (name && entry.carrier !== 'web') {
    try {
      const file = await open(join(entry.dir, decodeURIComponent(name)), 'r');
      try {
        const header = Buffer.alloc(24);
        await file.read(header, 0, 24, 0);
        if (header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && header.readUInt32BE(20) > 0) ratio = header.readUInt32BE(16) / header.readUInt32BE(20);
      } finally { await file.close(); }
    } catch {}
  }
  const state = entry.errors ? `${entry.errors} 错误` : entry.warnings ? `${entry.warnings} 警告` : '通过';
  return `<li class="card" style="--ratio:${ratio}" data-warnings="${entry.warnings ?? 0}"><a href="/${encodePath(entry.rel)}/"><div class="thumb${entry.carrier === 'web' ? ' web' : ''}">${picture}</div><div class="card-meta"><b title="${escapeHtml(label)}">${escapeHtml(label)}</b><span class="${entry.errors ? 'bad' : entry.warnings ? 'w' : 'zero'}">${state}</span></div></a><div class="card-sub">${escapeHtml(groupLabel(entry))}</div>${links}</li>`;
}

async function reportLinks(entry: ArtifactEntry): Promise<string> {
  const names = new Set(await readdir(entry.dir));
  const links = ['report.md', 'report.json'].filter((name) => names.has(name)).map((name) => `<a href="/${encodePath(entry.rel)}/${name}">${name}</a>`);
  return links.length ? `<div class="links">${links.join('')}</div>` : '';
}

function totals(entries: ArtifactEntry[]): { errors: number; warnings: number } {
  return {
    errors: entries.reduce((sum, entry) => sum + (entry.errors ?? 0), 0),
    warnings: entries.reduce((sum, entry) => sum + (entry.warnings ?? 0), 0),
  };
}

function groupLabel(entry: ArtifactEntry): string {
  const parts = [CARRIERS[entry.carrier as CarrierId]?.label ?? entry.carrier, entry.canvas].filter(Boolean);
  if (parts.length > 0) return parts.join(' / ');
  const segments = entry.rel.split('/');
  return segments.length > 1 ? segments.slice(0, -1).join(' / ') : segments[0]!;
}

export async function overviewListing(root: string, entries: ArtifactEntry[], base: string, home: boolean): Promise<string> {
  const builds = underPrefix(entries, base);
  const groups = new Map<string, ArtifactEntry[]>();
  for (const entry of builds) groups.set(groupLabel(entry), [...(groups.get(groupLabel(entry)) ?? []), entry]);
  const sections: string[] = [];
  let index = 0;
  for (const [label, items] of groups) {
    const cards: string[] = [];
    for (const entry of items) cards.push(await card(entry, entry.rel.split('/').pop() ?? entry.rel, await reportLinks(entry)));
    sections.push(fold(`overview-${encodePath(base)}-${index++}`, escapeHtml(label), `${items.length} 件 · ${totals(items).warnings} 个警告`, `<ul class="grid">${cards.join('')}</ul>`, true));
  }
  const sum = totals(builds);
  const mdHref = `${base === '' ? '' : `/${encodePath(base)}`}/overview.md`;
  const md = (await exists(join(root, base, 'overview.md'))) ? `<a href="${mdHref}">overview.md</a>` : '';
  const head = `<div class="actions">${home ? '' : '<a class="btn" href="/">← 预览导航</a>'}<span>${builds.length} 件构建 · ${countsText(sum.errors, sum.warnings)}</span>${md}<label><input type="checkbox" data-warnings-only> 只看有警告</label></div>`;
  return pageShell('排法总览', join(root, base), head + sections.join('\n'), '', '', builds);
}

interface PreviewMeta {
  id: string;
  name: string;
  materialAnchor?: string;
  tone?: Record<string, number>;
  carriers?: string[];
  colors?: { name: string; css: string }[];
  accent?: string;
}

async function metaOf(group: SystemGroup): Promise<PreviewMeta> {
  try {
    return JSON.parse(await readFile(join(group.system!.dir, 'preview-meta.json'), 'utf8'));
  } catch {
    return { id: group.id || group.system?.system || 'system', name: group.id || group.system?.system || '体系' };
  }
}

async function systemSection(group: SystemGroup, meta: PreviewMeta, index: number): Promise<string> {
  const entries = [...(group.system ? [group.system] : []), ...group.works, ...group.overview];
  const sum = totals(entries);
  const main = group.works.find((w) => w.carrier === 'web') ?? group.works[0];
  const thumb = main && thumbOf(main);
  const systemHref = group.system ? `/${encodePath(group.system.rel)}/` : `${OVERVIEW_ROUTE}${encodePath(group.overviewBase)}/`;
  const overviewHref = `${OVERVIEW_ROUTE}${encodePath(group.overviewBase)}/`;
  const colors = meta.colors ?? [];
  const accent = meta.accent ?? colors.find((c) => /accent|primary|brand|pink/.test(c.name))?.css;
  const palette = colors.map((c) => `<i${/^(paper|ink)$/.test(c.name) ? ' class="wide"' : ''} style="background:${escapeHtml(c.css)}"></i>`).join('');
  const tone = Object.entries(meta.tone ?? {}).map(([label, value]) => `<span>${escapeHtml(TONE_PAIRS[label as ToneKey] ?? label)}<em>${[1, 2, 3, 4, 5].map((n) => `<i${n === value ? ' class="on"' : ''}></i>`).join('')}</em></span>`).join('');
  const cards = (await Promise.all(group.works.map((entry) => card(entry, entry.concept?.split(/[：:]/)[0] || entry.rel.split('/').pop() || entry.rel)))).join('');
  const rows: string[] = [];
  for (const entry of entries) rows.push(`<tr><td><a href="/${encodePath(entry.rel)}/">${escapeHtml(entry === group.system ? '体系总览页' : entry.concept || entry.rel)}</a></td><td>${escapeHtml(entry.carrier ?? '')}</td><td class="r ${entry.errors ? 'bad' : 'zero'}">${entry.errors ?? '—'}</td><td class="r ${entry.warnings ? 'w' : 'zero'}">${entry.warnings ?? '—'}</td><td>${await reportLinks(entry)}</td></tr>`);
  const table = `<div class="reports-wrap"><table class="reports"><thead><tr><th>构建</th><th>载体</th><th>错误</th><th>警告</th><th>报告</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  return `<article class="sys rise" id="${escapeHtml(meta.id)}" style="--i:${index + 1}${accent ? `;--sys:${escapeHtml(accent)}` : ''}"><div class="sys-grid"><a class="cover" href="${systemHref}" aria-label="打开${escapeHtml(meta.name)}的体系总览">${thumb ? `<img src="${thumb}" alt="">` : ''}<span class="cover-tag">悬停预览整页 · 网页样张</span></a><div class="info"><div class="kick"><i class="dot"></i>${String(index + 1).padStart(2, '0')} · ${escapeHtml(meta.id)}</div><h2>${escapeHtml(meta.name)}</h2><p class="anchor">${escapeHtml(meta.materialAnchor ?? '')}</p><div class="palette" aria-label="主要颜色">${palette}</div><dl class="facts"><dt>调性</dt><dd class="tone">${tone}</dd><dt>载体</dt><dd>${escapeHtml((meta.carriers ?? []).slice().sort((a, b) => ['web', 'slides', 'social'].indexOf(a) - ['web', 'slides', 'social'].indexOf(b)).map((c) => ({ web: '网页', slides: '幻灯片', social: '社交配图' }[c] ?? c)).join(' · '))}</dd><dt>检查</dt><dd>${status(sum.errors, sum.warnings)}</dd></dl><div class="actions"><a class="btn primary" href="${systemHref}">打开体系总览 <span class="arr">→</span></a><a class="btn" href="${overviewHref}">排法总览 <small>${group.overview.length} 件</small></a></div></div></div>${fold(`${meta.id}-works`, '体系样张', `${group.works.length} 件`, `<ul class="shelf">${cards}</ul>`, true)}${fold(`${meta.id}-reports`, '检查报告', `${entries.length} 份 · ${sum.errors} 错误 · ${sum.warnings} 警告`, table, false)}</article>`;
}

export async function groupedHome(root: string, layout: Exclude<PreviewLayout, { kind: 'flat' }>, flatSection: (entries: ArtifactEntry[]) => Promise<string>): Promise<string> {
  if (layout.kind === 'overview') return overviewListing(root, layout.entries, '', true);
  const metas = await Promise.all(layout.systems.map(metaOf));
  const sections: string[] = [];
  for (const [i, group] of layout.systems.entries()) sections.push(await systemSection(group, metas[i]!, i));
  if (layout.others.length) sections.push(await flatSection(layout.others));
  const jumps = metas.map((m) => `<a href="#${escapeHtml(m.id)}"${m.colors?.length ? ` style="--sys:${escapeHtml(m.accent ?? m.colors.find((c) => /accent|primary|pink/.test(c.name))?.css ?? m.colors[0]!.css)}"` : ''}><i class="dot"></i>${escapeHtml(m.name)}</a>`).join('');
  return pageShell('体系目录', root, sections.join('\n'), '', jumps, [...layout.systems.flatMap((g) => [...(g.system ? [g.system] : []), ...g.works, ...g.overview]), ...layout.others]);
}

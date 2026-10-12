/*
 * Preview navigation for regression-shaped output (used by preview.ts): the grouped home page and the generated per-system overview listing.
 * detectLayout(root, entries) -> how the served directory is shaped, from the artifacts found by artifact-scan.ts:
 *   "systems": one or more systems (regression output <id>/system, <id>/works/<name>, <id>/overview/<builds>; or a single system folder with system/, works/, overview/ at its top), plus "others", builds outside any system;
 *   "overview": a lone layout overview (overview.md at the top, builds beside it);
 *   "flat": anything else (a single build, an arbitrary folder), which keeps the flat listing in preview.ts.
 * A folder counts as a system when it has a system/ page build or overview/overview.md.
 * groupedHome(root, layout, flatSection) -> the home page: per system the system page as the primary entry, the standard samples as thumbnails with error and warning counts, and one "排法总览" entry with its totals
 * that opens overviewListing at OVERVIEW_ROUTE + <overview folder>/; the overview builds and their reports are not listed on the home page; "others" are rendered by the flatSection callback. A lone overview shows its listing directly.
 * overviewListing(root, entries, base, home) -> the listing page for the builds under the overview folder `base` (relative path, "" for the root), grouped by carrier and canvas, each a thumbnail that opens the build,
 * with links to its report and to overview.md. listingBases(layout) are the folders for which that page exists. pageShell/encodePath/countsText/FLAT_CSS are shared with the flat listing.
 */
import { access, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ArtifactEntry } from './artifact-scan.ts';
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

const BASE_CSS = `:root{color-scheme:light dark;--bg:#f4efe6;--fg:#1d1a16;--mute:#7a7266;--line:#d9d0c0;--bad:#b3261e}
@media (prefers-color-scheme:dark){:root{--bg:#171512;--fg:#efe9dd;--mute:#9b9384;--line:#38332b;--bad:#ff8a80}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 "Noto Serif SC","Source Han Serif SC","Songti SC",Georgia,serif;padding:clamp(24px,6vw,96px) clamp(16px,6vw,96px)}
h1{font-size:clamp(32px,5vw,56px);line-height:1.1;margin:0 0 8px;font-weight:600;letter-spacing:.02em}
.dir{color:var(--mute);margin:0 0 56px;word-break:break-all;font-size:14px}
h2{font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:var(--mute);border-top:1px solid var(--fg);padding-top:12px;margin:48px 0 0;font-weight:500}
a{color:inherit}
.n{font-size:13px;color:var(--mute)}
.n.bad{color:var(--bad)}
.empty{color:var(--mute)}`;

export const FLAT_CSS = `ul.flat{list-style:none;margin:0;padding:0}
.flat li{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr) auto;gap:4px 24px;align-items:baseline;padding:14px 0;border-bottom:1px solid var(--line)}
a.open{display:flex;flex-direction:column;text-decoration:none}
a.open b{font-size:20px;font-weight:600}
a.open i{font-style:normal;color:var(--mute);font-size:14px}
a.open:hover b{text-decoration:underline;text-underline-offset:4px}
.meta{font-size:13px;color:var(--mute)}
.files{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:4px 16px;font-size:13px}
.m{color:var(--mute)}
@media (max-width:640px){.flat li{grid-template-columns:1fr}}`;

const NAV_CSS = `.back{display:inline-block;margin:0 0 16px;color:var(--mute);font-size:14px}
.primary{display:block;margin:32px 0 0;padding:28px 0;border-top:1px solid var(--fg);border-bottom:1px solid var(--line);text-decoration:none}
.primary b{display:block;font-size:clamp(28px,4vw,44px);line-height:1.2;font-weight:600}
.primary:hover b{text-decoration:underline;text-underline-offset:6px}
.primary .n{display:block;margin-top:4px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:24px 20px;margin:20px 0 0;padding:0;list-style:none}
.card{display:block;text-decoration:none}
.card img,.card .ph{display:block;width:100%;aspect-ratio:4/3;background:var(--line);border:1px solid var(--line)}
.card img{object-fit:cover;object-position:top}
.card b{display:block;margin-top:8px;font-size:15px;font-weight:600;word-break:break-all}
.card:hover b{text-decoration:underline;text-underline-offset:4px}
.card .n{display:block}
.links{font-size:13px;color:var(--mute);display:flex;gap:12px;margin:2px 0 0}
.entry{display:flex;justify-content:space-between;align-items:baseline;gap:16px;margin:32px 0 0;padding:16px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);text-decoration:none}
.entry b{font-size:20px;font-weight:600}
.entry:hover b{text-decoration:underline;text-underline-offset:4px}
.sys{margin:72px 0 0}
.sys>h2{font-size:15px;letter-spacing:.08em;text-transform:none;color:var(--fg)}`;

export function encodePath(rel: string): string {
  return rel.split('/').map(encodeURIComponent).join('/');
}

export function pageShell(title: string, dir: string, body: string, css: string): string {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
<style>
${BASE_CSS}
${css}
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<p class="dir">${escapeHtml(dir)}</p>
${body}
</body></html>
`;
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

function card(entry: ArtifactEntry, label: string, links = ''): string {
  const thumb = thumbOf(entry);
  const picture = thumb === undefined ? '<span class="ph"></span>' : `<img src="${thumb}" alt="" loading="lazy">`;
  return `<li><a class="card" href="/${encodePath(entry.rel)}/">${picture}<b>${escapeHtml(label)}</b>${countsText(entry.errors, entry.warnings)}</a>${links}</li>`;
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
  const parts = [entry.carrier, entry.canvas].filter(Boolean);
  if (parts.length > 0) return parts.join(' / ');
  const segments = entry.rel.split('/');
  return segments.length > 1 ? segments.slice(0, -1).join(' / ') : segments[0]!;
}

export async function overviewListing(root: string, entries: ArtifactEntry[], base: string, home: boolean): Promise<string> {
  const builds = underPrefix(entries, base);
  const groups = new Map<string, ArtifactEntry[]>();
  for (const entry of builds) groups.set(groupLabel(entry), [...(groups.get(groupLabel(entry)) ?? []), entry]);
  const sections: string[] = [];
  for (const [label, items] of groups) {
    const cards: string[] = [];
    for (const entry of items) cards.push(card(entry, entry.rel.split('/').pop() ?? entry.rel, await reportLinks(entry)));
    sections.push(`<section><h2>${escapeHtml(label)}</h2><ul class="grid">${cards.join('')}</ul></section>`);
  }
  const sum = totals(builds);
  const mdHref = `${base === '' ? '' : `/${encodePath(base)}`}/overview.md`;
  const md = (await exists(join(root, base, 'overview.md'))) ? `<p class="links"><a href="${mdHref}">overview.md</a></p>` : '';
  const back = home ? '' : '<a class="back" href="/">← 预览导航</a>';
  const head = `${back}<p>${builds.length} 件构建 · ${countsText(sum.errors, sum.warnings)}</p>${md}`;
  return pageShell(home ? '预览导航 · 排法总览' : '排法总览', join(root, base), head + sections.join('\n'), NAV_CSS);
}

function systemSection(group: SystemGroup): string {
  const parts: string[] = [];
  if (group.system) {
    parts.push(`<a class="primary" href="/${encodePath(group.system.rel)}/"><b>体系总览页</b>${countsText(group.system.errors, group.system.warnings)}</a>`);
  }
  if (group.works.length > 0) {
    const cards = group.works.map((entry) => card(entry, entry.rel.split('/').pop() ?? entry.rel));
    parts.push(`<h2>标准样张</h2><ul class="grid">${cards.join('')}</ul>`);
  }
  if (group.overview.length > 0) {
    const sum = totals(group.overview);
    parts.push(`<a class="entry" href="${OVERVIEW_ROUTE}${encodePath(group.overviewBase)}/"><b>排法总览</b><span>${group.overview.length} 件构建 · ${countsText(sum.errors, sum.warnings)}</span></a>`);
  }
  return `<section class="sys">${group.id === '' ? '' : `<h2>${escapeHtml(group.id)}</h2>`}${parts.join('')}</section>`;
}

export async function groupedHome(root: string, layout: PreviewLayout, flatSection: (entries: ArtifactEntry[]) => Promise<string>): Promise<string> {
  if (layout.kind === 'overview') return overviewListing(root, layout.entries, '', true);
  if (layout.kind !== 'systems') return '';
  const sections = layout.systems.map(systemSection);
  if (layout.others.length > 0) sections.push(await flatSection(layout.others));
  return pageShell('预览导航', root, sections.join('\n'), `${FLAT_CSS}\n${NAV_CSS}`);
}

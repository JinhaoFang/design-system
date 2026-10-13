/*
 * System page markup (体系总览页): turns a PageModel (the system's SYSTEM.md prose, token file, resolved tokens, font list entries, layouts and links) into { title, style, body, script }.
 * Everything is typeset with the system's own values: colors, fonts, type/space/radius steps, shadows and grain come from the resolved CSS custom properties of the system's web carrier (picked by position in
 * the ladders, never by name, so any system works); the background, text, secondary text and hairline colors are picked by role name (paper/ink/ink-2/rule and common synonyms), the accent by name or else the most chromatic color
 * (the accent only marks hover, replay demos and the system's own header), everything falls back to lightness extremes.
 * A system may bring its own header fragment (customHeader, <system>/system-page/header.html, rendered with system.* variables by system-page.ts); without one a default header is drawn.
 * The generator emits the v2 TOC rail, mobile dialog, section buttons with matching aria-controls, carrier tab panels, and tables longer than six rows as details.
 * Static mode expands all disclosures; interactions use system-page-runtime.js and system-page-v2.css. Only the header has scroll entrances.
 * Sections (a one-line head each, number + title + count, full-width content): 意图 (prose, tone meter, key rules as rule | 理由 | 适用边界 columns), 样张 (thumbnails of the standard samples, approved exemplars), 排法 (a thumbnail card per layout with
 * its Chinese name and description, linked to its overview build), 材质锚点 (statement and table), 色彩 (colors grouped by the name before the first "-" as contiguous bands; the SYSTEM.md table is the legend), 字体 (one block per family: specimen,
 * the loaded weights and styles side by side, license in one line, roles), 字阶间距 (type ladder one row per step with the sample clipped to one line, space and radius steps), 版面, 质感与符号, 动效.
 * The motion section is live: every entrance type (data-ds-replay="enter"), duration step ("duration"), easing ("easing") and stagger step ("stagger") has a replay button whose target carries data-ds-slot="<kind>-<name>";
 * a switch (data-ds-reduce-toggle) flips the page into "reduced motion" (initially the OS setting), where replays drop displacement and stagger and only fade for the shortest duration step, like the choreography runtime.
 * Replays use element.animate with durations and easings straight from the system's ladders; the duration and easing cells carry the 用在 note of the SYSTEM.md tables.
 * Constraints kept so the page passes the checker: no default margins (all spacing from the space ladder), every text element has a type-ladder size, only system colors, no monospace/system fonts, buttons and links restyled,
 * code in tables does not wrap (a wrapped curve would start a line with a forbidden character), italic specimens are set in italic; *emphasis* is real italic when the system loads an italic face, otherwise upright with an underline.
 * Sample captions have the existing 14rem card minimum (capped at the available width), independent of thumbnail proportions or lazy image loading.
 * Web thumbnails keep the existing 20:16 crop as a responsive 5:4 box anchored at the top; other thumbnails retain their natural aspect ratio within the existing 16rem height limit.
 * Exemplar HTTP(S) source links show only the hostname; href and title keep the full URL. Other source strings keep their original label.
 * Source rows stay on one line and ellipsize within the card, including unusually long hostnames; this display policy does not exempt any text from CJK checking.
 */
import { readFileSync } from 'node:fs';
import { TONE_PAIRS } from './system.ts';
import type { SystemMeta, ToneKey } from './system.ts';
import { converter, parse } from 'culori';
import { CARRIERS } from './carriers.ts';
import type { CarrierId } from './carriers.ts';
import { escapeHtml } from './layout.ts';
import { spaceCjkLatin } from './cjk-spacing.ts';
import { fontStyleOf } from './fonts.ts';
import type { FontEntry } from './fonts.ts';
import type { ParsedTokens, ResolvedEntry, ResolvedTokens } from './tokens.ts';

export interface FontView {
  role: string;
  cssVar: string;
  entry: FontEntry;
}

export interface LinkView {
  href: string;
  label: string;
  note?: string;
  detail?: string;
  image?: string;
  cropped?: boolean;
}

export interface ExemplarView {
  id: string;
  title: string;
  carrier: string;
  sourceType: string;
  sourceUrl?: string;
  copyright: string;
  media?: { href: string; kind: 'screenshot' | 'recording' };
}

export interface LayoutItem {
  id: string;
  name?: string;
  description?: string;
  href?: string;
  image?: string;
  note?: string;
}

export interface LayoutView {
  carrier: CarrierId;
  overall?: LinkView;
  units: { id: string; label: string; layouts: LayoutItem[] }[];
}

export interface PageModel {
  meta: SystemMeta;
  tokens: ResolvedTokens;
  parsed: ParsedTokens;
  fonts: FontView[];
  intentHtml: string;
  anchorHtml: string;
  colorHtml: string;
  fontsHtml: string;
  layoutHtml: string;
  shapeHtml: string;
  imageryHtml: string;
  marksHtml: string;
  motionHtml: string;
  layouts: LayoutView[];
  customHeader?: string;
  overviewGenerated: boolean;
  colorLegend: boolean;
  compositionTable: boolean;
  durationNotes: Record<string, string>;
  easingNotes: Record<string, string>;
  works: LinkView[];
  exemplars: ExemplarView[];
}

export interface RenderedPage {
  title: string;
  style: string;
  body: string;
  script: string;
}

export const ENTER_EFFECTS = [
  { name: 'fade', label: '淡入，原地不动' },
  { name: 'rise', label: '自下方升起' },
  { name: 'fall', label: '自上方落下' },
  { name: 'left', label: '自左侧滑入' },
  { name: 'right', label: '自右侧滑入' },
] as const;

const BACKGROUND_NAMES = ['paper', 'background', 'bg', 'canvas', 'base'];
const INK_NAMES = ['ink', 'text', 'foreground', 'fg'];
const SOFT_NAMES = ['ink-2', 'text-2', 'secondary'];
const ACCENT_NAMES = ['accent', 'primary', 'brand'];
const LINE_NAMES = ['line', 'rule', 'border', 'hairline', 'mute', 'muted'];
const DISPLAY_ROLES = ['display', 'heading', 'title'];
const CHROMATIC = 0.06;

const toOklch = converter('oklch');

const esc = (text: string): string => escapeHtml(spaceCjkLatin(text).replace(/ · /g, '\u00a0· '));
const px = (value: number): string => `${Math.round(value * 1000) / 1000}px`;
const ms = (value: number): string => `${Math.round(value * 1000) / 1000}ms`;

interface Step {
  name: string;
  cssVar: string;
  value: number;
  entry: ResolvedEntry;
}

function steps(tokens: ResolvedTokens, prefix: string): Step[] {
  return tokens.entries
    .filter((entry) => entry.cssVar.startsWith(prefix) && entry.number !== undefined)
    .map((entry) => ({ name: entry.cssVar.slice(prefix.length), cssVar: entry.cssVar, value: entry.number!, entry }))
    .sort((a, b) => a.value - b.value);
}

function at(list: Step[], fraction: number): string {
  if (list.length === 0) return '0';
  return `var(${list[Math.round(fraction * (list.length - 1))]!.cssVar})`;
}

interface ColorView {
  name: string;
  cssVar: string;
  css: string;
  hex?: string;
  lightness: number;
  chroma: number;
}

function colorViews(model: PageModel): ColorView[] {
  const byVar = new Map(model.tokens.entries.map((entry) => [entry.cssVar, entry.css]));
  return model.parsed.tokens
    .filter((token) => token.path[0] === 'color')
    .map((token) => {
      const cssVar = `--ds-${token.path.join('-')}`;
      const css = byVar.get(cssVar) ?? '';
      const hex = typeof token.value?.hex === 'string' ? token.value.hex : undefined;
      const parsed = parse(css);
      const oklch = parsed ? toOklch(parsed) : undefined;
      return { name: token.path.slice(1).join('.'), cssVar, css, ...(hex !== undefined && { hex }), lightness: oklch?.l ?? 0, chroma: oklch?.c ?? 0 };
    });
}

function pickColor(colors: ColorView[], names: string[]): ColorView | undefined {
  for (const name of names) {
    const found = colors.find((color) => color.name === name);
    if (found) return found;
  }
  return undefined;
}

interface Palette {
  bg: string;
  ink: string;
  soft: string;
  accent: string;
  line: string;
}

function palette(colors: ColorView[]): Palette {
  const byLightness = [...colors].sort((a, b) => a.lightness - b.lightness);
  const bg = pickColor(colors, BACKGROUND_NAMES) ?? byLightness[byLightness.length - 1]!;
  const ink = pickColor(colors, INK_NAMES) ?? byLightness[0]!;
  const vivid = [...colors].sort((a, b) => b.chroma - a.chroma)[0];
  const accent = pickColor(colors, ACCENT_NAMES) ?? (vivid && vivid.chroma > CHROMATIC ? vivid : ink);
  const soft = pickColor(colors, SOFT_NAMES) ?? ink;
  const line = pickColor(colors, LINE_NAMES) ?? ink;
  const ref = (color: ColorView) => `var(${color.cssVar})`;
  return { bg: ref(bg), ink: ref(ink), soft: ref(soft), accent: ref(accent), line: ref(line) };
}

function fontStack(model: PageModel, role: string): string {
  const view = model.fonts.find((font) => font.role === role);
  const cjk = model.fonts.find((font) => font.role === 'cjk');
  const parts = [view, cjk].filter((font): font is FontView => font !== undefined).map((font) => `var(${font.cssVar})`);
  return [...new Set(parts)].join(', ');
}

function styleSheet(model: PageModel): string {
  const { tokens } = model;
  const types = steps(tokens, '--ds-type-');
  const spaces = steps(tokens, '--ds-space-');
  const radii = steps(tokens, '--ds-radius-').filter((step) => step.value > 0);
  const colors = colorViews(model);
  const { bg, ink, soft, accent, line } = palette(colors);
  const T = (fraction: number) => at(types, fraction);
  const S = (fraction: number) => at(spaces, fraction);
  const R = radii.length ? `var(${radii[0]!.cssVar})` : '0';
  const displayFont = model.fonts.find((font) => DISPLAY_ROLES.some((name) => font.role === name || font.role.endsWith(`-${name}`)));
  const body = fontStack(model, 'body') || fontStack(model, 'cjk');
  const display = body;
  const nameWeight = displayFont ? displayFont.entry.weight : 400;
  const hasItalic = model.fonts.some((font) => fontStyleOf(font.entry) === 'italic');
  const hasGrain = tokens.entries.some((entry) => entry.cssVar === '--ds-grain-max');
  const grainSvg = encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='160' height='160' filter='url(#n)'/></svg>",
  );
  const small = T(0.125);
  const text = T(0.25);

  return `*{margin:0;padding:0;box-sizing:border-box}
html{background:${bg};color:${ink};font-family:${body};font-size:${text};line-height:1.7;line-break:strict;overflow-wrap:anywhere}
body{background:${bg};color:${ink}}
h1,h2,h3,h4,button,input{font:inherit;color:inherit}
ul,ol{list-style:none}
a{color:${ink};text-decoration:underline;text-underline-offset:0.2em;text-decoration-color:${line}}
a:hover{text-decoration-color:${accent}}
code{font-family:inherit;font-size:inherit;white-space:nowrap}
pre{font-family:inherit;font-size:inherit;white-space:pre-wrap}
img{display:block;max-width:100%}
button{background:${bg};color:${ink};border:1px solid ${ink};border-radius:${R};padding:${S(0.02)} ${S(0.15)};cursor:pointer;font-size:${small}}
button:hover{background:${ink};color:${bg}}
button[aria-pressed="true"]{background:${ink};color:${bg}}
.sp{max-width:84rem;margin-inline:auto;padding-inline:${S(0.3)}}
.sp-header{display:grid;gap:${S(0.3)};padding-block:${S(0.7)} ${S(0.5)}}
.sp-header[data-ds-custom-header]{display:block;padding-block:${S(0.3)} 0}
.sp-kicker{font-size:${small};letter-spacing:0.12em;text-transform:uppercase;color:${soft}}
.sp-name{font-family:${display};font-weight:${nameWeight};font-size:${T(0.875)};line-height:1.1;letter-spacing:-0.01em}
.sp-lead{font-family:${display};font-size:${T(0.5)};line-height:1.45;max-width:36em}
.sp-nav{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:${S(0.02)} ${S(0.3)};padding-block:${S(0.1)};background:${bg};border-top:1px solid ${ink};border-bottom:1px solid ${line};font-size:${small}}
.sp-section{display:grid;grid-template-columns:minmax(0,1fr);gap:${S(0.3)};padding-block:${S(0.5)} ${S(0.2)}}
.sp-head{display:flex;align-items:baseline;gap:${S(0.3)};padding-bottom:${S(0.05)};border-bottom:1px solid ${ink}}
.sp-no{font-family:${display};font-size:${T(0.625)};line-height:1.25;color:${soft}}
.sp-title{font-family:${display};font-size:${T(0.625)};line-height:1.25}
.sp-main{display:grid;grid-template-columns:minmax(0,1fr);gap:${S(0.2)};min-width:0}
.sp-sub{font-size:${small};letter-spacing:0.12em;text-transform:uppercase;color:${soft};padding-top:${S(0.1)}}
.sp-two{display:grid;grid-template-columns:minmax(0,1fr);gap:${S(0.4)};align-items:start}
.sp-prose{display:grid;gap:${S(0.2)};max-width:46em;min-width:0}
.sp-prose-wide{max-width:none}
.sp-prose ul,.sp-prose ol{display:grid;gap:${S(0.1)}}
.sp-prose h4{font-size:${small};letter-spacing:0.12em;color:${soft}}
.sp-prose li{padding-left:${S(0.2)};border-left:1px solid ${line}}
.sp-prose li:has(> ul){display:grid;grid-template-columns:minmax(0,1fr);gap:${S(0.1)} ${S(0.4)};padding:${S(0.15)} 0 ${S(0.15)};border-left:0;border-top:1px solid ${line}}
.sp-prose li:has(> ul) > ul{display:contents}
.sp-prose li:has(> ul) > ul > li{padding-left:0;border-left:0;font-size:${small};color:${soft}}
em{font-style:${hasItalic ? 'italic' : 'normal'}}${hasItalic ? '' : `em{text-decoration:underline;text-decoration-color:${line};text-underline-offset:0.25em}`}
.sp-label{display:block;color:${ink};letter-spacing:0.12em}
.sp-prose table{border-collapse:collapse;width:100%;font-size:${small}}
.sp-prose th{text-align:left;font-weight:inherit;letter-spacing:0.08em;color:${soft};padding:${S(0.05)} ${S(0.2)} ${S(0.05)} 0;border-bottom:1px solid ${ink}}
.sp-prose td{vertical-align:top;padding:${S(0.05)} ${S(0.2)} ${S(0.05)} 0;border-bottom:1px solid ${line}}
.sp-prose td code{white-space:nowrap}
.sp-tablewrap{overflow-x:auto}
.sp-statement{font-family:${display};font-size:${T(0.625)};line-height:1.3;max-width:24em}
.sp-tones{display:grid;gap:${S(0.05)}}
.sp-tone{display:grid;grid-template-columns:minmax(0,5rem) 1fr;gap:${S(0.2)};align-items:center;font-size:${small}}
.sp-ticks{display:flex;gap:${S(0.05)}}
.sp-tick{display:block;width:2rem;height:0.5rem;border:1px solid ${ink}}
.sp-tick[data-on]{background:${ink}}
.sp-scenarios{display:grid;gap:${S(0.05)};font-size:${small};color:${soft}}
.sp-bands{display:flex;flex-wrap:wrap;gap:${S(0.3)}}
.sp-band{display:grid;gap:${S(0.05)};align-content:start;min-width:0}
.sp-band-chips{display:flex;border:1px solid ${line}}
.sp-chipcol{flex:1 1 0;min-width:0;display:grid;align-content:start}
.sp-swatch{height:${S(0.7)};border-bottom:1px solid ${line}}
.sp-chipcol-label{padding:${S(0.05)};font-size:${small};line-height:1.35;color:${soft};word-break:normal}
.sp-chipcol-label b{display:block;font-weight:inherit;color:${ink}}
.sp-family{display:grid;grid-template-columns:minmax(0,1fr);gap:${S(0.1)} ${S(0.5)};padding-block:${S(0.15)};border-bottom:1px solid ${line}}
.sp-family-side{display:grid;gap:${S(0.05)};align-content:start}
.sp-family-main{display:grid;gap:${S(0.1)};min-width:0}
.sp-family-name{font-size:${small};letter-spacing:0.12em;text-transform:uppercase}
.sp-meta{font-size:${small};color:${soft}}
.sp-specimen{font-size:${T(0.625)};line-height:1.3;overflow:hidden;white-space:nowrap}
.sp-weights{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(11rem,100%),1fr));gap:${S(0.1)} ${S(0.3)}}
.sp-weight{display:grid;gap:0;min-width:0;border-top:1px solid ${line};padding-top:${S(0.05)}}
.sp-weight-phrase{font-size:${T(0.375)};line-height:1.4;overflow:hidden;white-space:nowrap}
.sp-ladder{display:grid}
.sp-step{display:grid;grid-template-columns:minmax(0,8rem) minmax(0,1fr);gap:${S(0.2)};align-items:baseline;padding-block:${S(0.02)};border-bottom:1px solid ${line}}
.sp-step-k{font-size:${small};color:${soft};line-height:1.3}
.sp-step-sample{line-height:1.2;overflow:hidden;white-space:nowrap}
.sp-scales{display:grid;gap:${S(0.1)};align-content:start}
.sp-space{display:grid;grid-template-columns:minmax(0,3.5rem) minmax(0,3.5rem) minmax(0,1fr);gap:${S(0.1)};align-items:center;font-size:${small};padding-block:0}
.sp-bar{height:${S(0.1)};background:${ink};min-width:1px;max-width:100%}
.sp-radii{display:flex;flex-wrap:wrap;gap:${S(0.3)}}
.sp-box{width:4rem;height:4rem;background:${bg};border:1px solid ${ink}}
.sp-box-k{font-size:${small};color:${soft}}
.sp-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(10rem,100%),1fr));gap:${S(0.3)}}
.sp-fact{display:grid;gap:0;border-top:1px solid ${ink};padding-top:${S(0.05)}}
.sp-fact-k{font-size:${small};color:${soft}}
.sp-fact-v{font-family:${display};font-size:${T(0.5)};line-height:1.2}
.sp-shadow{width:7rem;height:4rem;background:${bg};border:1px solid ${line}}
.sp-grain{position:relative;height:${S(0.6)};background:${line};overflow:hidden}
.sp-grain i{position:absolute;inset:0;background-image:url("data:image/svg+xml,${grainSvg}");${hasGrain ? 'opacity:var(--ds-grain-max)' : 'opacity:0'}}
.sp-textures{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(14rem,100%),1fr));gap:${S(0.3)};align-items:start}
.sp-marks{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(14rem,100%),1fr));gap:${S(0.3)};counter-reset:mark}
.sp-marks li{counter-increment:mark;font-family:${display};font-size:${T(0.375)};line-height:1.4;padding-top:${S(0.1)};border-top:1px solid ${ink}}
.sp-marks li::before{content:counter(mark,decimal-leading-zero);display:block;font-size:${small};letter-spacing:0.12em;font-family:${body};color:${soft}}
.sp-controls{display:flex;flex-wrap:wrap;gap:${S(0.2)};align-items:center;padding-block:${S(0.1)};border-top:1px solid ${ink};border-bottom:1px solid ${ink}}
.sp-live{font-size:${small}}
.sp-cells{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(13rem,100%),1fr));gap:${S(0.3)} ${S(0.3)}}
.sp-cell{display:grid;gap:${S(0.02)};align-content:start;border-top:1px solid ${line};padding-top:${S(0.1)}}
.sp-cell-top{display:flex;align-items:baseline;justify-content:space-between;gap:${S(0.1)}}
.sp-cell-k{font-size:${text}}
.sp-cell-v{font-size:${small};color:${soft}}
.sp-cell-use{font-size:${small};color:${soft}}
.sp-stage{display:flex;align-items:center;min-height:${S(0.4)}}
.sp-chip{display:block;width:4rem;height:${S(0.3)};background:${ink}}
.sp-track{position:relative;width:100%;height:${S(0.3)};border-bottom:1px solid ${ink}}
.sp-fill{display:block;height:${S(0.1)};width:100%;background:${ink};transform-origin:left center}
.sp-dot{display:block;width:${S(0.2)};height:${S(0.2)};background:${ink}}
.sp-marker{position:absolute;left:0;bottom:0;width:${S(0.2)};height:${S(0.2)};background:${ink}}
.sp-dots{display:flex;gap:${S(0.1)}}
.sp-units{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(16rem,100%),1fr));gap:${S(0.4)} ${S(0.4)};align-items:start}
.sp-unit{display:grid;gap:${S(0.1)};align-content:start;min-width:0}
.sp-unit-k{font-size:${small};letter-spacing:0.12em;color:${soft};padding-bottom:${S(0.05)};border-bottom:1px solid ${ink}}
.sp-layouts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:${S(0.2)}}
.sp-layout{display:grid;gap:${S(0.05)};align-content:start;min-width:0}
.sp-layout img{width:100%;height:auto;border:1px solid ${line}}
.sp-layout-name{font-size:${text};line-height:1.35}
.sp-layout-id{font-size:${small};color:${soft}}
.sp-layout-note{font-size:${small};color:${soft};line-height:1.5}
.sp-overall{display:grid;gap:${S(0.05)};max-width:16rem}
.sp-overall img{width:100%;height:12rem;object-fit:cover;object-position:top;border:1px solid ${line}}
.sp-works{display:flex;flex-wrap:wrap;gap:${S(0.4)} ${S(0.5)};align-items:flex-end}
.sp-work{display:grid;gap:${S(0.05)};align-content:start;min-width:min(14rem,100%);max-width:100%}
.sp-work > :not(a){width:0;min-width:100%}
.sp-work img{height:auto;width:auto;max-height:16rem;max-width:100%;border:1px solid ${line}}
.sp-work img[data-cropped]{width:20rem;aspect-ratio:5 / 4;max-height:none;object-fit:cover;object-position:top}
.sp-work-k{font-size:${text}}
.sp-work-v{font-size:${small};color:${soft}}
.sp-exemplars{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(14rem,100%),1fr));gap:${S(0.3)}}
.sp-ex{display:grid;gap:${S(0.1)};align-content:start;min-width:0}
.sp-ex img{width:100%;height:auto;border:1px solid ${line}}
.sp-ex-source{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.sp-missing{font-size:${small};color:${soft}}
@media(min-width:900px){
.sp{padding-inline:${S(0.5)}}
.sp-two{grid-template-columns:minmax(0,3fr) minmax(0,2fr);column-gap:${S(0.6)}}
.sp-two-scale{grid-template-columns:minmax(0,5fr) minmax(0,3fr)}
.sp-prose-cols{display:block;column-count:2;column-gap:${S(0.6)}}
.sp-prose-cols > *{break-inside:avoid;margin-bottom:${S(0.2)}}
.sp-family{grid-template-columns:minmax(0,2fr) minmax(0,5fr)}
.sp-prose li:has(> ul){grid-template-columns:minmax(0,5fr) minmax(0,4fr) minmax(0,4fr)}
}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}`;
}

function sectionBlock(id: string, no: string, title: string, content: string): string {
  return `<section id="${id}" class="sp-section" data-ds-unit="${id}">
<h2 class="sp-head"><button type="button" class="v2-toggle" aria-expanded="true" aria-controls="${id}-body"><span class="sp-no">${no}</span><span class="sp-title">${esc(title)}</span><span class="v2-meta">${esc(sectionCount(id, content))}</span><span class="v2-chev" aria-hidden="true"></span></button></h2>
<div class="v2-body" id="${id}-body"><div class="sp-main">
${content}
</div></div><div class="v2-collapsed-note">已收起，点标题展开</div>
</section>`;
}

function sub(title: string): string {
  return `<h3 class="sp-sub">${esc(title)}</h3>`;
}

function prose(html: string, extra = ''): string {
  const labelled = html
    .replace(/<li>(理由|适用边界)[：:]\s*/g, '<li><span class="sp-label">$1</span>')
    .replace(/<table>/g, '<div class="sp-tablewrap"><table>')
    .replace(/<\/table>/g, '</table></div>');
  return `<div class="sp-prose${extra}">${labelled}</div>`;
}

function toneMeter(meta: SystemMeta): string {
  return (Object.keys(TONE_PAIRS) as ToneKey[])
    .map((key) => {
      const value = meta.tone[key];
      const ticks = [1, 2, 3, 4, 5].map((n) => `<i class="sp-tick"${n === value ? ' data-on' : ''}></i>`).join('');
      return `<div class="sp-tone"><div>${esc(TONE_PAIRS[key])}</div><div class="sp-ticks" role="img" aria-label="${esc(`${TONE_PAIRS[key]}：${value} / 5`)}">${ticks}</div></div>`;
    })
    .join('');
}

function defaultHeader(model: PageModel): string {
  const { meta } = model;
  const carriers = meta.carriers.map((carrier) => CARRIERS[carrier].label).join(' / ');
  return `<div class="sp-kicker">${esc(`${meta.category} · ${meta.id} · ${carriers}`)}</div>
<h1 class="sp-name" data-ds-enter="rise">${esc(meta.name)}</h1>
<p class="sp-lead" data-ds-enter="rise" data-ds-order="1">${esc(meta.materialAnchor)}</p>`;
}

function sectionCount(id: string, content: string): string {
  const n = (pattern: RegExp) => [...content.matchAll(pattern)].length;
  switch (id) {
    case 'intent': return `${[...content.matchAll(/<li><strong>规则<\/strong>/g)].length || [...(content.split('sp-prose-wide')[1] ?? '').matchAll(/<li>(?!<span)/g)].length} 条关键规则`;
    case 'works': return `${n(/class="sp-work"/g)} 件样张 · ${n(/class="sp-ex"/g)} 件范例`;
    case 'layouts': return `${n(/class="sp-unit"/g)} 个叙事单元 · ${n(/class="sp-layout"/g)} 种排法`;
    case 'color': return `${n(/class="sp-chipcol"/g)} 色 · ${n(/class="sp-band"/g)} 组`;
    case 'type': return `${n(/class="sp-family"/g)} 款字体`;
    case 'scale': return `${n(/class="sp-step"/g)} 档字阶 · ${n(/class="sp-space"/g)} 档间距`;
    case 'motion': return `${n(/data-ds-replay=/g)} 个可重放演示`;
    default: return '';
  }
}

function navigation(model: PageModel, blocks: string[]): string {
  const items = blocks.map((block) => {
    const id = /<section id="([^"]+)"/.exec(block)![1]!;
    const no = /class="sp-no">([^<]+)/.exec(block)![1]!;
    const title = /class="sp-title"[^>]*>([^<]+)/.exec(block)![1]!;
    const count = /class="v2-meta">([^<]*)/.exec(block)![1]!;
    const subs = id === 'layouts' ? '' : [...block.matchAll(/<h3 class="sp-sub" id="([^"]+)">([^<]+)/g)].map((m) => `<a href="#${m[1]}"><span></span><span>${m[2]}</span></a>`).join('');
    return { id, no, title, count, subs };
  });
  const links = (mobile: boolean) => items.map((it) => `<a href="#${it.id}" data-for="${it.id}"><span class="v2-n">${it.no}</span><span>${it.title}${mobile && it.count ? `<span class="v2-meta">${it.count}</span>` : ''}</span></a>${!mobile && it.subs ? `<div class="v2-subs" data-subs="${it.id}"><div>${it.subs}</div></div>` : ''}`).join('');
  const progress = '<div class="v2-progress"><i></i></div>';
  const overall = model.layouts.find((g) => g.overall)?.overall;
  const overview = overall ? `<a data-overview-listing="${escapeHtml(overall.href.replace(/[^/]+\/index.html$/, ''))}" href="${escapeHtml(overall.href.replace(/[^/]+\/index.html$/, 'overview.md'))}">排法总览</a>` : '';
  return `<aside class="v2-rail" aria-label="目录"><div class="v2-rail-inner"><div class="v2-rail-top"><div class="v2-rail-k">${esc(model.meta.name)} · 目录</div><nav class="v2-toc">${links(false)}<i class="v2-thumb"></i></nav></div><div class="v2-tools">${progress}<div class="v2-row"><button type="button" data-all="close">全部收起</button><button type="button" data-all="open">全部展开</button></div><button type="button" data-reduce aria-pressed="false">减少动态效果</button><a href="/">← 预览导航</a>${overview}</div></div></aside><div class="v2-main"><div class="v2-bar"><div class="v2-bar-now"><b>${esc(model.meta.name)}</b><span data-now></span></div><button type="button" data-open-sheet aria-expanded="false">目录</button>${progress}</div>${blocks.join('\n')}</div><div class="v2-sheet" role="dialog" aria-modal="true" aria-label="目录" inert><div class="v2-sheet-head"><b>${esc(model.meta.name)} · 目录</b><button type="button" data-close-sheet>关闭</button></div><nav class="v2-toc">${links(true)}</nav></div>`;
}

function enhanceBlocks(blocks: string[]): string[] {
  return blocks.map((block) => {
    const id = /<section id="([^"]+)"/.exec(block)![1]!;
    let index = 0;
    block = block.replace(/<h3 class="sp-sub">/g, () => `<h3 class="sp-sub" id="${id}-s${++index}">`);
    let tableIndex = 0;
    return block.replace(/<div class="sp-tablewrap"><table>[\s\S]*?<\/table><\/div>/g, (table, offset: number) => {
      const rows = [...(table.split('<tbody>')[1] ?? '').matchAll(/<tr>/g)].length;
      if (rows <= 6) return table;
      const heading = [...block.slice(0, offset).matchAll(/<h[34][^>]*>(.*?)<\/h[34]>/g)].at(-1)?.[1] ?? '完整表格';
      return `<details class="v2-more" data-fold-key="${id}-table-${++tableIndex}"><summary><span>${heading} · ${rows} 行</span></summary>${table}</details>`;
    });
  });
}

function intentSection(model: PageModel, no: string): string {
  const { meta } = model;
  const scenarios = meta.scenarios.map((scenario) => `<li>${esc(scenario)}</li>`).join('');
  const parts = model.intentHtml.split(/(?=<p><strong>关键规则)/);
  const lead = parts[0]!;
  const rules = parts.slice(1).join('');
  return sectionBlock(
    'intent',
    no,
    '意图与调性',
    `<div class="sp-two">${prose(lead)}<div class="sp-tones">${toneMeter(meta)}${sub('适用场景')}<ul class="sp-scenarios">${scenarios}</ul></div></div>
${rules ? prose(rules, ' sp-prose-wide') : ''}`,
  );
}

function anchorSection(model: PageModel, no: string): string {
  return sectionBlock('anchor', no, '材质锚点', `<p class="sp-statement">${esc(model.meta.materialAnchor)}</p>${prose(model.anchorHtml, ' sp-prose-wide')}`);
}

function colorGroups(colors: ColorView[]): ColorView[][] {
  const groups = new Map<string, ColorView[]>();
  for (const color of colors) {
    const key = color.name.split(/[-.]/)[0]!;
    groups.set(key, [...(groups.get(key) ?? []), color]);
  }
  return [...groups.values()];
}

function colorSection(model: PageModel, no: string): string {
  const bands = colorGroups(colorViews(model))
    .map((group) => {
      const chips = group
        .map(
          (color) =>
            `<div class="sp-chipcol"><div class="sp-swatch" style="background:var(${color.cssVar})"></div><div class="sp-chipcol-label"><b>${esc(color.name)}</b><code>${esc(color.css)}</code>${
              !model.colorLegend && color.hex ? `<br>${esc(color.hex)}` : ''
            }</div></div>`,
        )
        .join('');
      return `<div class="sp-band" style="flex:${group.length} 1 ${group.length * 7}rem"><div class="sp-band-chips">${chips}</div></div>`;
    })
    .join('');
  return sectionBlock('color', no, '色彩', `<div class="sp-bands">${bands}</div>${prose(model.colorHtml, ' sp-prose-wide')}`);
}

function yesNo(value: boolean): string {
  return value ? '可' : '否';
}

interface Family {
  name: string;
  entries: FontEntry[];
  roles: FontView[];
}

function families(model: PageModel): Family[] {
  const byName = new Map<string, Family>();
  const seen = new Set<string>();
  for (const font of model.fonts) {
    const family = byName.get(font.entry.family) ?? { name: font.entry.family, entries: [], roles: [] };
    if (!seen.has(font.entry.id)) {
      seen.add(font.entry.id);
      family.entries.push(font.entry);
    }
    family.roles.push(font);
    byName.set(font.entry.family, family);
  }
  return [...byName.values()];
}

function latinName(model: PageModel): string {
  return model.meta.id
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function familyBlock(model: PageModel, family: Family): string {
  const cjk = family.entries.some((entry) => entry.scripts.includes('cjk'));
  const anchor = model.meta.materialAnchor;
  const full = cjk ? anchor : `${latinName(model)} 0123456789`;
  const phrase = cjk ? (anchor.split(/[，,；;。]/)[0] ?? anchor) : `${latinName(model)} 2024`;
  const ordered = [...family.entries].sort((a, b) => Number(fontStyleOf(a) === 'italic') - Number(fontStyleOf(b) === 'italic') || a.weight - b.weight);
  const regular = ordered.find((entry) => fontStyleOf(entry) === 'normal' && entry.weight === 400) ?? ordered.find((entry) => fontStyleOf(entry) === 'normal') ?? ordered[0]!;
  const face = (entry: FontEntry) => `font-family:&quot;${escapeHtml(entry.family)}&quot;;font-weight:${entry.weight};font-style:${fontStyleOf(entry)}`;
  const weights = ordered
    .map(
      (entry) =>
        `<div class="sp-weight"><div class="sp-meta">${esc(`${fontStyleOf(entry) === 'italic' ? '斜体 ' : ''}${entry.weight}`)}</div><div class="sp-weight-phrase" style="${face(entry)}">${esc(phrase)}</div></div>`,
    )
    .join('');
  const first = family.entries[0]!;
  const licenses = [...new Set(family.entries.map((entry) => entry.license.name))].join(' / ');
  const carriers = [...new Set(family.entries.flatMap((entry) => entry.carriers))].map((carrier) => CARRIERS[carrier as CarrierId]?.label ?? carrier).join('、');
  const all = (pick: (entry: FontEntry) => boolean) => yesNo(family.entries.every(pick));
  const licenseLine = `${licenses} · 商用 ${all((entry) => entry.permissions.commercial)} · 网页嵌入 ${all((entry) => entry.permissions.webEmbed)} · 文件嵌入 ${all((entry) => entry.permissions.fileEmbed)} · 载体 ${carriers} · PPT 安全 ${all((entry) => entry.pptSafe)}`;
  const roles = family.roles.map((font) => `${font.role} ${font.entry.weight}${fontStyleOf(font.entry) === 'italic' ? ' 斜体' : ''}`).join(' · ');
  const scripts = first.scripts.map((script) => (script === 'cjk' ? '中文' : '西文')).join(' + ');
  return `<div class="sp-family">
<div class="sp-family-side"><h3 class="sp-family-name">${escapeHtml(family.name)} · ${esc(scripts)}</h3><div class="sp-meta">${esc(licenseLine)} · <a href="${escapeHtml(first.license.url)}" target="_blank" rel="noopener">${esc('授权全文')}</a></div><div class="sp-meta">${esc(`角色：${roles}`)}</div></div>
<div class="sp-family-main"><div class="sp-specimen" style="${face(regular)}">${esc(full)}</div><div class="sp-weights">${weights}</div></div>
</div>`;
}

function sampleFor(model: PageModel, size: number, width: number): string {
  const characters = [...model.meta.materialAnchor];
  const count = Math.max(2, Math.min(characters.length, Math.floor(width / size)));
  return characters.slice(0, count).join('');
}

function scaleSection(model: PageModel, no: string): string {
  const { tokens } = model;
  const types = steps(tokens, '--ds-type-');
  const ratios = new Map(model.parsed.tokens.filter((t) => t.path[0] === 'ratio' && t.path[1] === 'type').map((t) => [t.path[2]!, t.number!]));
  const ladder = types
    .map((step) => {
      const ratio = ratios.get(step.name);
      return `<div class="sp-step"><div class="sp-step-k">${esc(`${step.name} · ${px(step.value)}${ratio !== undefined ? ` · ×${ratio}` : ''}`)}</div><div class="sp-step-sample" style="font-size:var(${step.cssVar})">${esc(sampleFor(model, step.value, 640))}</div></div>`;
    })
    .join('');
  const spaces = steps(tokens, '--ds-space-');
  const radii = steps(tokens, '--ds-radius-');
  const spaceRows = spaces
    .map((step) => `<div class="sp-space"><div>${esc(step.name)}</div><div>${esc(px(step.value))}</div><div class="sp-bar" style="width:${px(step.value)}"></div></div>`)
    .join('');
  const radiusBoxes = radii
    .map((step) => `<div><div class="sp-box" style="border-radius:var(${step.cssVar})"></div><div class="sp-box-k">${esc(`${step.name} · ${px(step.value)}`)}</div></div>`)
    .join('');
  return sectionBlock(
    'scale',
    no,
    '字阶、间距与圆角',
    `<div class="sp-two sp-two-scale"><div class="sp-ladder">${ladder}</div><div class="sp-scales">${sub('间距')}<div>${spaceRows}</div>${sub('圆角')}<div class="sp-radii">${radiusBoxes}</div></div></div>`,
  );
}

function typeSection(model: PageModel, no: string): string {
  const blocks = families(model).map((family) => familyBlock(model, family)).join('');
  return sectionBlock('type', no, '字体', `${blocks}${prose(model.fontsHtml, ' sp-prose-wide')}`);
}

function layoutSection(model: PageModel, no: string): string {
  const composition = model.parsed.constraints?.composition ?? {};
  const percent = (range: [number, number]) => `${Math.round(range[0] * 100)}–${Math.round(range[1] * 100)}%`;
  const rows = (Object.keys(composition) as CarrierId[])
    .map((carrier) => {
      const ranges = composition[carrier]!;
      return `<tr><td>${esc(CARRIERS[carrier].label)}</td><td>${esc(carrier)}</td><td>${esc(`${ranges.jumpRate[0]}–${ranges.jumpRate[1]}`)}</td><td>${esc(percent(ranges.layoutRate))}</td><td>${esc(percent(ranges.imageRate))}</td></tr>`;
    })
    .join('');
  const fallback =
    !model.compositionTable && rows
      ? `<div class="sp-prose sp-prose-wide"><div class="sp-tablewrap"><table><thead><tr><th>${esc('载体')}</th><th>id</th><th>${esc('跳跃率')}</th><th>${esc('版面率')}</th><th>${esc('图版率')}</th></tr></thead><tbody>${rows}</tbody></table></div></div>`
      : '';
  const shape = model.shapeHtml ? `<div class="sp-main">${sub('形态')}${prose(model.shapeHtml, ' sp-prose-wide')}</div>` : '';
  return sectionBlock('layout', no, '版面与形态', `<div class="sp-two"><div class="sp-main">${prose(model.layoutHtml, ' sp-prose-wide')}${fallback}</div>${shape}</div>`);
}

function textureSection(model: PageModel, no: string): string {
  const { tokens, parsed } = model;
  const shadows = tokens.entries.filter((entry) => entry.cssVar.startsWith('--ds-shadow-'));
  const shadowItems = shadows
    .map((entry) => `<div class="sp-fact"><div class="sp-fact-k">${esc(`阴影 ${entry.cssVar.slice('--ds-shadow-'.length)}`)}</div><div class="sp-shadow" style="box-shadow:var(${entry.cssVar})"></div><div class="sp-fact-k">${esc(entry.css)}</div></div>`)
    .join('');
  const grain = tokens.entries.find((entry) => entry.cssVar === '--ds-grain-max');
  const springs = new Map<string, string[]>();
  for (const entry of tokens.entries) {
    const match = /^--ds-spring-(.+)-(stiffness|damping|mass)$/.exec(entry.cssVar);
    if (match) springs.set(match[1]!, [...(springs.get(match[1]!) ?? []), `${match[2]} ${entry.css}`]);
  }
  const constraints = parsed.constraints;
  const fact = (key: string, value: string) => `<div class="sp-fact"><div class="sp-fact-k">${esc(key)}</div><div class="sp-fact-v">${esc(value)}</div></div>`;
  const facts = [
    constraints ? fact('光源方向', `${constraints.lightAngleDeg}°`) : '',
    constraints ? fact('强调色预算', `${Math.round(constraints.accentBudget * 100)}%`) : '',
    constraints ? fact('颗粒上限', String(constraints.grainMax)) : '',
    ...[...springs].map(([name, values]) => fact(`弹簧 ${name}`, values.join(' · '))),
  ].join('');
  const surface = `<div class="sp-textures">${shadowItems}${grain ? `<div class="sp-fact"><div class="sp-fact-k">${esc(`颗粒强度 ${grain.css}`)}</div><div class="sp-grain"><i></i></div></div>` : ''}</div>`;
  const marks = model.marksHtml.replace(/^<ul>/, '<ul class="sp-marks">');
  return sectionBlock('texture', no, '质感与符号', `<div class="sp-facts">${facts}</div>${surface}${prose(model.imageryHtml, ' sp-prose-wide sp-prose-cols')}${sub('识别符号')}${marks}`);
}

function replayButton(kind: string, key: string): string {
  return `<button type="button" data-ds-replay="${kind}" data-key="${escapeHtml(key)}">${esc('重放')}</button>`;
}

function motionSection(model: PageModel, no: string): string {
  const { tokens } = model;
  const durations = steps(tokens, '--ds-duration-');
  const staggers = steps(tokens, '--ds-stagger-');
  const easings = tokens.entries.filter((entry) => entry.cssVar.startsWith('--ds-easing-'));
  const cell = (key: string, value: string, use: string | undefined, stage: string, kind: string, name: string) =>
    `<div class="sp-cell"><div class="sp-cell-top"><div class="sp-cell-k">${esc(key)}</div>${replayButton(kind, name)}</div><div class="sp-cell-v">${esc(value)}</div>${use ? `<div class="sp-cell-use">${esc(use)}</div>` : ''}<div class="sp-stage">${stage}</div></div>`;
  const enters = ENTER_EFFECTS.map((effect) => cell(effect.name, effect.label, undefined, `<span class="sp-chip" data-ds-slot="enter-${effect.name}"></span>`, 'enter', effect.name)).join('');
  const durationCells = durations
    .map((step) => cell(step.name, ms(step.value), model.durationNotes[step.name], `<span class="sp-fill" data-ds-slot="duration-${escapeHtml(step.name)}"></span>`, 'duration', step.name))
    .join('');
  const easingCells = easings
    .map((entry) => {
      const name = entry.cssVar.slice('--ds-easing-'.length);
      return cell(name, entry.css, model.easingNotes[name], `<div class="sp-track"><span class="sp-marker" data-ds-slot="easing-${escapeHtml(name)}"></span></div>`, 'easing', name);
    })
    .join('');
  const staggerCells = staggers
    .map((step) => {
      const dots = [0, 1, 2, 3, 4].map(() => `<span class="sp-dot" data-ds-slot="stagger-${escapeHtml(step.name)}"></span>`).join('');
      return cell(step.name, ms(step.value), undefined, `<div class="sp-dots">${dots}</div>`, 'stagger', step.name);
    })
    .join('');
  const controls = `<div class="sp-controls"><button type="button" data-ds-reduce-toggle aria-pressed="false">${esc('减少动态效果')}</button><span class="sp-live" data-ds-reduce-state aria-live="polite"></span></div>`;
  return sectionBlock(
    'motion',
    no,
    '动效',
    `${prose(model.motionHtml, ' sp-prose-wide sp-prose-cols')}
${controls}
${sub(staggers.length ? '入场方式与错峰' : '入场方式')}<div class="sp-cells">${enters}${staggerCells}</div>
${sub('时长阶梯')}<div class="sp-cells">${durationCells}</div>
${sub('缓动')}<div class="sp-cells">${easingCells}</div>`,
  );
}

function layoutCard(layout: LayoutItem): string {
  const image = layout.image ? `<img src="${escapeHtml(layout.image)}" alt="${esc(layout.name ?? layout.id)}" loading="lazy">` : '';
  const picture = layout.href ? `<a href="${escapeHtml(layout.href)}">${image || esc(layout.name ?? layout.id)}</a>` : image;
  return `<div class="sp-layout">${picture}<div class="sp-layout-name">${esc(layout.name ?? layout.id)}</div><div class="sp-layout-id">${escapeHtml(layout.id)}</div>${layout.description ? `<div class="sp-layout-note">${esc(layout.description)}</div>` : ''}</div>`;
}

function layoutsSection(model: PageModel, no: string): string {
  const filled = model.layouts.filter((group) => group.units.length).sort((a, b) => ['web', 'slides', 'social'].indexOf(a.carrier) - ['web', 'slides', 'social'].indexOf(b.carrier));
  const empty = model.layouts.filter((group) => !group.units.length).map((group) => CARRIERS[group.carrier].label);
  const groups = filled
    .map((group) => {
      const units = group.units
        .map((unit) => `<div class="sp-unit"><div class="sp-unit-k">${esc(unit.label)}</div><div class="sp-layouts">${unit.layouts.map(layoutCard).join('')}</div></div>`)
        .join('');
      const overall = group.overall
        ? `<div class="sp-overall"><a href="${escapeHtml(group.overall.href)}">${group.overall.image ? `<img src="${escapeHtml(group.overall.image)}" alt="${esc(group.overall.label)}" loading="lazy">` : esc(group.overall.label)}</a><div class="sp-layout-note">${esc('整体排法总览：全部排法依次排成一页')}</div></div>`
        : '';
      const wholeOnly = group.units.every((unit) => unit.layouts.every((layout) => !layout.image));
      return `<div class="v2-panel" role="tabpanel" id="layouts-${group.carrier}" ${filled.length > 1 ? `aria-labelledby="tab-${group.carrier}"` : ''}>${sub(`${CARRIERS[group.carrier].label} · ${group.carrier}`)}<div class="sp-units">${units}</div>${wholeOnly ? overall : ''}</div>`;
    })
    .join('');
  const note = !model.overviewGenerated ? `<p class="sp-missing">${esc('这套体系的排法总览还没有生成。')}</p>` : '';
  const none = empty.length ? `<p class="sp-missing">${esc(`${empty.join('、')}：还没有排法。`)}</p>` : '';
  const tabs = filled.length > 1 ? `<div class="v2-tabs" role="tablist" aria-label="排法载体">${filled.map((g, i) => `<button type="button" role="tab" id="tab-${g.carrier}" aria-controls="layouts-${g.carrier}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(CARRIERS[g.carrier].label)}<span> ${g.units.reduce((n, u) => n + u.layouts.length, 0)}</span></button>`).join('')}<i class="v2-tabline"></i></div>` : '';
  return sectionBlock('layouts', no, '排法', `${note}${tabs}${groups}${none}`);
}

function workCard(work: LinkView): string {
  const image = work.image ? `<img src="${escapeHtml(work.image)}" alt="${esc(work.label)}" loading="lazy"${work.cropped ? ' data-cropped' : ''}>` : '';
  return `<div class="sp-work"><a href="${escapeHtml(work.href)}">${image || esc(work.label)}</a><div class="sp-work-k">${esc(work.label)}</div>${work.detail ? `<div class="sp-work-v">${esc(work.detail)}</div>` : ''}${work.note ? `<div class="sp-work-v">${esc(work.note)}</div>` : ''}</div>`;
}

function exemplarSourceLabel(sourceUrl: string): string {
  try {
    const url = new URL(sourceUrl);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.hostname : sourceUrl;
  } catch {
    return sourceUrl;
  }
}

function exemplarCard(exemplar: ExemplarView): string {
  const source = exemplar.sourceUrl
    ? `<div class="sp-work-v sp-ex-source">${esc('来源：')}<a href="${escapeHtml(exemplar.sourceUrl)}" title="${escapeHtml(exemplar.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(exemplarSourceLabel(exemplar.sourceUrl))}</a></div>`
    : '';
  const media =
    exemplar.media?.kind === 'screenshot'
      ? `<img src="${escapeHtml(exemplar.media.href)}" alt="${escapeHtml(exemplar.title)}" loading="lazy">`
      : exemplar.media
        ? `<div class="sp-work-v"><a href="${escapeHtml(exemplar.media.href)}">${esc('查看录屏')}</a></div>`
        : '';
  return `<div class="sp-ex">${media}<div class="sp-work-k">${esc(exemplar.title)}</div><div class="sp-work-v">${esc(`${exemplar.carrier} · ${exemplar.sourceType} · ${exemplar.copyright}`)}</div>${source}</div>`;
}

function worksSection(model: PageModel, no: string): string {
  const works = model.works.length ? `<div class="sp-works">${model.works.map(workCard).join('')}</div>` : `<p class="sp-missing">${esc('这套体系的体系样张还没有生成。')}</p>`;
  const exemplars = model.exemplars.length
    ? `<div class="sp-exemplars">${model.exemplars.map(exemplarCard).join('')}</div>`
    : `<p class="sp-missing">${esc('这套体系还没有已批准的范例。')}</p>`;
  return sectionBlock('works', no, '体系样张与范例', `${works}${sub('已批准的范例')}${exemplars}`);
}

export function replayScript(tokens: ResolvedTokens): string {
  const config = {
    durations: Object.fromEntries(steps(tokens, '--ds-duration-').map((step) => [step.name, step.value])),
    staggers: Object.fromEntries(steps(tokens, '--ds-stagger-').map((step) => [step.name, step.value])),
    easings: Object.fromEntries(tokens.entries.filter((entry) => entry.cssVar.startsWith('--ds-easing-')).map((entry) => [entry.cssVar.slice('--ds-easing-'.length), entry.css])),
    distance: (() => {
      const spaces = steps(tokens, '--ds-space-');
      return spaces.length ? spaces[Math.floor((spaces.length - 1) / 2)]!.value : 16;
    })(),
    on: '已开启：只做淡入，不位移、不错峰，时长取最短一档',
    off: '已关闭：按体系的入场方式、时长和缓动重放',
  };
  return `(${replay.toString()})(${JSON.stringify(config)});`;
}

function replay(config: {
  durations: Record<string, number>;
  staggers: Record<string, number>;
  easings: Record<string, string>;
  distance: number;
  on: string;
  off: string;
}): void {
  const root = document.documentElement;
  const toggle = document.querySelector('[data-ds-reduce-toggle]') as HTMLElement | null;
  const state = document.querySelector('[data-ds-reduce-state]') as HTMLElement | null;
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  let preference = false;
  let reduced = media.matches;
  const durationValues = Object.values(config.durations);
  const shortest = Math.min(...durationValues);
  const longest = Math.max(...durationValues);
  const names = Object.keys(config.durations);
  const base = 'base' in config.durations ? config.durations['base']! : config.durations[names.slice().sort((a, b) => config.durations[a]! - config.durations[b]!)[Math.floor((names.length - 1) / 2)]!]!;
  const easingNames = Object.keys(config.easings);
  const settle = config.easings['settle'] ?? config.easings[easingNames[0]!]!;

  const paint = (): void => {
    root.setAttribute('data-reduce', reduced ? 'true' : 'false');
    if (toggle) toggle.setAttribute('aria-pressed', reduced ? 'true' : 'false');
    if (state) state.textContent = reduced ? config.on : config.off;
  };
  paint();
  if (toggle) {
    toggle.addEventListener('click', () => {
      preference = !preference;
      reduced = media.matches || preference;
      paint();
    });
  }

  media.addEventListener('change', () => { reduced = media.matches || preference; paint(); });

  const offset = (effect: string): string => {
    const moves: Record<string, string> = {
      rise: `translate3d(0, ${config.distance}px, 0)`,
      fall: `translate3d(0, ${-config.distance}px, 0)`,
      left: `translate3d(${-config.distance}px, 0, 0)`,
      right: `translate3d(${config.distance}px, 0, 0)`,
    };
    return moves[effect] ?? 'none';
  };

  const run = (el: Element, from: Keyframe, to: Keyframe, duration: number, easing: string, delay: number): void => {
    const animation = el.animate([from, to], { duration, easing, delay, fill: 'backwards' });
    animation.finished.catch(() => undefined);
  };

  const fadeOnly = (el: Element, easing: string, delay = 0): void => run(el, { opacity: 0 }, { opacity: 1 }, shortest, easing, delay);

  const play = (button: HTMLElement): void => {
    const kind = button.getAttribute('data-ds-replay') ?? '';
    const key = button.getAttribute('data-key') ?? '';
    const targets = [...document.querySelectorAll(`[data-ds-slot="${kind}-${key}"]`)];
    targets.forEach((el, index) => {
      if (kind === 'enter') {
        if (reduced) return fadeOnly(el, settle);
        const moved = key === 'fade' ? { opacity: 0 } : { opacity: 0, transform: offset(key) };
        const rest = key === 'fade' ? { opacity: 1 } : { opacity: 1, transform: 'none' };
        return run(el, moved, rest, base, settle, 0);
      }
      if (kind === 'duration') {
        if (reduced) return fadeOnly(el, settle);
        return run(el, { transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }, config.durations[key]!, settle, 0);
      }
      if (kind === 'easing') {
        const easing = config.easings[key]!;
        if (reduced) return fadeOnly(el, easing);
        const track = el.parentElement as HTMLElement;
        const travel = Math.max(0, track.clientWidth - (el as HTMLElement).offsetWidth);
        return run(el, { transform: 'translateX(0px)' }, { transform: `translateX(${travel}px)` }, longest, easing, 0);
      }
      if (reduced) return fadeOnly(el, settle);
      return run(el, { opacity: 0, transform: offset('rise') }, { opacity: 1, transform: 'none' }, base, settle, index * (config.staggers[key] ?? 0));
    });
  };

  document.addEventListener('click', (event) => {
    const button = (event.target as Element).closest('[data-ds-replay]') as HTMLElement | null;
    if (button) play(button);
  });
}

export function renderSystemPage(model: PageModel): RenderedPage {
  const header = model.customHeader ?? defaultHeader(model);
  const headerTag = model.customHeader !== undefined ? 'data-ds-custom-header' : 'data-ds-default-header';
  const sections: [string, string, (model: PageModel, no: string) => string][] = [
    ['intent', '意图', intentSection],
    ['works', '样张', worksSection],
    ['layouts', '排法', layoutsSection],
    ['anchor', '材质', anchorSection],
    ['color', '色彩', colorSection],
    ['type', '字体', typeSection],
    ['scale', '字阶间距', scaleSection],
    ['layout', '版面', layoutSection],
    ['texture', '质感', textureSection],
    ['motion', '动效', motionSection],
  ];
  const blocks = enhanceBlocks(sections.map(([, , render], index) => render(model, String(index + 1).padStart(2, '0'))));
  const nav = navigation(model, blocks);
  const body = `<div class="sp" data-system="${escapeHtml(model.meta.id)}">
<header class="sp-header" data-ds-unit="header" ${headerTag}>
${header}
</header>
<div class="v2-frame">${nav}</div>
</div>`;
  return { title: `${model.meta.name} · 体系总览页`, style: styleSheet(model) + navigationStyle(model), body, script: replayScript(model.tokens) + readFileSync(new URL('./system-page-runtime.js', import.meta.url), 'utf8') };
}

function navigationStyle(model: PageModel): string {
  const colors = palette(colorViews(model));
  const space = steps(model.tokens, '--ds-space-');
  const type = steps(model.tokens, '--ds-type-');
  const duration = steps(model.tokens, '--ds-duration-');
  const easing = model.tokens.entries.filter((e) => e.cssVar.startsWith('--ds-easing-'));
  const values: Record<string, string> = {
    '--ds-color-paper': colors.bg, '--ds-color-ink': colors.ink, '--ds-color-ink-2': colors.soft, '--ds-color-rule': colors.line,
    '--ds-type-caption': at(type, .125), '--ds-type-note': at(type, .25), '--ds-type-body': at(type, .25),
    '--ds-duration-turn': at(duration, 0), '--ds-duration-ink': at(duration, .5), '--ds-duration-glide': at(duration, .75),
    '--ds-easing-paper': `var(${easing[0]!.cssVar})`, '--ds-easing-ink': `var(${easing[Math.min(1, easing.length - 1)]!.cssVar})`,
  };
  for (let n = 1; n <= 8; n++) values[`--ds-space-${n}`] = at(space, (n - 1) / 8);
  const names = new Set(model.tokens.entries.map((e) => e.cssVar));
  const numberedSpaces = Array.from({ length: 8 }, (_value, i) => `--ds-space-${i + 1}`).every((name) => names.has(name));
  const css = readFileSync(new URL('./system-page-v2.css', import.meta.url), 'utf8').replace(/var\((--ds-[^)]+)\)/g, (match, key: string) => names.has(key) && (numberedSpaces || !key.startsWith('--ds-space-')) ? match : values[key] ?? match);
  return css + `:root{--sp-body-gap:${numberedSpaces && names.has('--ds-space-5') ? 'var(--ds-space-5)' : at(space, .5)};--sp-middle:${at(duration, .5)};--sp-fold:${at(duration, .75)};--sp-ease:var(${easing[0]!.cssVar})}`;
}

export function previewMetadata(model: PageModel): object {
  const colors = colorViews(model);
  const accentVar = palette(colors).accent;
  return { id: model.meta.id, name: model.meta.name, materialAnchor: model.meta.materialAnchor, tone: model.meta.tone, carriers: model.meta.carriers,
    colors: colors.map((c) => ({ name: c.name, css: c.css })), accent: colors.find((c) => `var(${c.cssVar})` === accentVar)?.css };
}

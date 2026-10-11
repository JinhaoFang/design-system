/*
 * System page markup (体系总览页): turns a PageModel (the system's SYSTEM.md prose, token file, resolved tokens, font list entries, layouts and links) into { title, style, body, script }.
 * Everything is typeset with the system's own values: colors, fonts, type/space/radius steps, shadows and grain come from the resolved CSS custom properties of the system's web carrier (picked by position in
 * the ladders, never by name, so any system works); the background, text, accent and hairline colors are picked by role name (paper/ink/accent/mute and common synonyms) and fall back to lightness extremes.
 * A system may bring its own header fragment (customHeader, <system>/system-page/header.html, rendered with system.* variables by system-page.ts); without one a default header is drawn.
 * Sections: 意图与调性, 材质锚点, 色彩, 字体, 间距圆角与构图比率, 质感, 识别符号, 动效, 排法, 链接. The motion section is live: every entrance type (data-ds-replay="enter"), duration step ("duration"), easing ("easing") and
 * stagger step ("stagger") has a replay button whose target carries data-ds-slot="<kind>-<name>"; a switch (data-ds-reduce-toggle) flips the page into "reduced motion" (initially the OS setting), where replays
 * drop displacement and stagger and only fade for the shortest duration step, like the choreography runtime. Replays use element.animate with durations and easings straight from the system's ladders.
 * Constraints kept so the page passes the checker: no default margins (all spacing from the space ladder), every text element has a type-ladder size, only system colors, no monospace/system fonts, buttons and links restyled.
 */
import { TONE_PAIRS } from './system.ts';
import type { SystemMeta, ToneKey } from './system.ts';
import { converter, parse } from 'culori';
import { CARRIERS } from './carriers.ts';
import type { CarrierId } from './carriers.ts';
import { escapeHtml } from './layout.ts';
import { spaceCjkLatin } from './cjk-spacing.ts';
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
}

export interface LinkGroup {
  title: string;
  links: LinkView[];
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

export interface LayoutView {
  carrier: CarrierId;
  units: { id: string; label: string; layouts: string[] }[];
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
  overview: LinkGroup[];
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
const ACCENT_NAMES = ['accent', 'primary', 'brand'];
const LINE_NAMES = ['line', 'rule', 'border', 'hairline', 'mute', 'muted'];
const DISPLAY_ROLES = ['display', 'heading', 'title'];

const toOklch = converter('oklch');
const oklchLightness = (css: string): number => {
  const parsed = parse(css);
  return parsed ? (toOklch(parsed).l ?? 0) : 0;
};

const esc = (text: string): string => escapeHtml(spaceCjkLatin(text));
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
}

function colorViews(model: PageModel): ColorView[] {
  const byVar = new Map(model.tokens.entries.map((entry) => [entry.cssVar, entry.css]));
  return model.parsed.tokens
    .filter((token) => token.path[0] === 'color')
    .map((token) => {
      const cssVar = `--ds-${token.path.join('-')}`;
      const css = byVar.get(cssVar) ?? '';
      const hex = typeof token.value?.hex === 'string' ? token.value.hex : undefined;
      return { name: token.path.slice(1).join('.'), cssVar, css, ...(hex !== undefined && { hex }), lightness: oklchLightness(css) };
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
  accent: string;
  line: string;
}

function palette(colors: ColorView[]): Palette {
  const byLightness = [...colors].sort((a, b) => a.lightness - b.lightness);
  const bg = pickColor(colors, BACKGROUND_NAMES) ?? byLightness[byLightness.length - 1]!;
  const ink = pickColor(colors, INK_NAMES) ?? byLightness[0]!;
  const accent = pickColor(colors, ACCENT_NAMES) ?? ink;
  const line = pickColor(colors, LINE_NAMES) ?? ink;
  const ref = (color: ColorView) => `var(${color.cssVar})`;
  return { bg: ref(bg), ink: ref(ink), accent: ref(accent), line: ref(line) };
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
  const { bg, ink, accent, line } = palette(colors);
  const T = (fraction: number) => at(types, fraction);
  const S = (fraction: number) => at(spaces, fraction);
  const R = radii.length ? `var(${radii[0]!.cssVar})` : '0';
  const displayRole = model.fonts.find((font) => DISPLAY_ROLES.includes(font.role))?.role ?? 'body';
  const body = fontStack(model, 'body') || fontStack(model, 'cjk');
  const display = fontStack(model, displayRole) || body;
  const hasGrain = tokens.entries.some((entry) => entry.cssVar === '--ds-grain-max');
  const grainSvg = encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='160' height='160' filter='url(#n)'/></svg>",
  );

  return `*{margin:0;padding:0;box-sizing:border-box}
html{background:${bg};color:${ink};font-family:${body};font-size:${T(0)};line-height:1.7;line-break:strict;overflow-wrap:anywhere}
body{background:${bg};color:${ink}}
h1,h2,h3,h4,button,input{font:inherit;color:inherit}
ul,ol{list-style:none}
a{color:${ink};text-decoration:underline;text-underline-offset:0.2em}
code,pre{font-family:inherit;font-size:inherit;white-space:pre-wrap}
em{font-style:italic}
button{background:${bg};color:${ink};border:1px solid ${ink};border-radius:${R};padding:${S(0.05)} ${S(0.25)};cursor:pointer}
button:hover{background:${ink};color:${bg}}
button[aria-pressed="true"]{background:${ink};color:${bg}}
.sp{max-width:84rem;margin-inline:auto;padding-inline:${S(0.35)}}
.sp-header{display:grid;gap:${S(0.35)};padding-block:${S(0.9)} ${S(0.6)}}
.sp-kicker{font-size:${T(0)};letter-spacing:0.12em;text-transform:uppercase}
.sp-name{font-family:${display};font-size:${T(1)};line-height:1.1;letter-spacing:-0.01em}
.sp-lead{font-family:${display};font-size:${T(0.5)};line-height:1.45;max-width:36em}
.sp-nav{display:flex;flex-wrap:wrap;gap:${S(0.1)} ${S(0.35)};padding-block:${S(0.25)};border-top:1px solid ${ink};border-bottom:1px solid ${line}}
.sp-section{display:grid;grid-template-columns:minmax(0,1fr);gap:${S(0.4)};padding-block:${S(0.8)};border-top:1px solid ${line}}
.sp-head{display:grid;gap:${S(0.1)};align-content:start}
.sp-no{font-family:${display};font-size:${T(1)};line-height:1;color:${accent}}
.sp-title{font-family:${display};font-size:${T(0.55)};line-height:1.25}
.sp-main{display:grid;gap:${S(0.4)};min-width:0}
.sp-sub{font-size:${T(0)};letter-spacing:0.12em;text-transform:uppercase;padding-bottom:${S(0.1)};border-bottom:1px solid ${ink}}
.sp-prose{display:grid;gap:${S(0.25)};max-width:44em}
.sp-prose ul,.sp-prose ol{display:grid;gap:${S(0.1)}}
.sp-prose h4{font-size:${T(0)};letter-spacing:0.12em}
.sp-prose li{padding-left:${S(0.25)};border-left:1px solid ${accent}}
.sp-statement{font-family:${display};font-size:${T(0.7)};line-height:1.3;max-width:24em}
.sp-rows{display:grid}
.sp-row{display:grid;grid-template-columns:minmax(0,1fr);gap:${S(0.1)};padding-block:${S(0.25)};border-bottom:1px solid ${line};align-items:center}
.sp-k{font-size:${T(0)};letter-spacing:0.04em}
.sp-v{font-size:${T(0)};word-break:break-all}
.sp-viz{min-width:0}
.sp-chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(11rem,1fr));gap:${S(0.4)} ${S(0.3)}}
.sp-swatch{display:grid;gap:${S(0.05)};align-content:start}
.sp-swatch-chip{height:${S(0.75)};border:1px solid ${line}}
.sp-font{display:grid;gap:${S(0.25)};padding-block:${S(0.25)};border-bottom:1px solid ${line}}
.sp-specimen{font-size:${T(1)};line-height:1.2}
.sp-facts{display:grid;gap:${S(0.05)};grid-template-columns:minmax(0,1fr)}
.sp-fact{display:grid;grid-template-columns:minmax(0,7rem) minmax(0,1fr);gap:${S(0.2)}}
.sp-bar{height:${S(0.1)};background:${accent};min-width:1px}
.sp-box{width:5rem;height:5rem;background:${bg};border:1px solid ${ink}}
.sp-boxes{display:flex;flex-wrap:wrap;gap:${S(0.35)}}
.sp-shadow{width:7rem;height:5rem;background:${bg};border:1px solid ${line}}
.sp-grain{position:relative;height:${S(0.8)};background:${line};overflow:hidden}
.sp-grain i{position:absolute;inset:0;background-image:url("data:image/svg+xml,${grainSvg}");${hasGrain ? 'opacity:var(--ds-grain-max)' : 'opacity:0'}}
.sp-tone{display:grid;grid-template-columns:minmax(0,5rem) 1fr;gap:${S(0.2)};align-items:center}
.sp-ticks{display:flex;gap:${S(0.1)}}
.sp-tick{display:block;width:2.5rem;height:0.5rem;border:1px solid ${ink}}
.sp-tick[data-on]{background:${ink}}
.sp-marks{display:grid;gap:${S(0.3)};counter-reset:mark}
.sp-marks li{counter-increment:mark;font-family:${display};font-size:${T(0.55)};line-height:1.3;padding-top:${S(0.15)};border-top:1px solid ${ink}}
.sp-marks li::before{content:counter(mark,decimal-leading-zero);display:block;font-size:${T(0)};letter-spacing:0.12em;font-family:${body}}
.sp-controls{display:flex;flex-wrap:wrap;gap:${S(0.2)};align-items:center;padding-block:${S(0.2)};border-top:1px solid ${ink};border-bottom:1px solid ${ink}}
.sp-live{font-size:${T(0)}}
.sp-stage{display:flex;align-items:center;min-height:${S(0.6)}}
.sp-chip{display:block;width:5rem;height:${S(0.4)};background:${accent}}
.sp-track{position:relative;height:${S(0.4)};border-bottom:1px solid ${ink}}
.sp-fill{display:block;height:${S(0.2)};width:100%;background:${accent};transform-origin:left center}
.sp-dot{display:block;width:${S(0.25)};height:${S(0.25)};background:${accent}}
.sp-marker{position:absolute;left:0;bottom:0;width:${S(0.3)};height:${S(0.3)};background:${accent}}
.sp-dots{display:flex;gap:${S(0.15)}}
.sp-enter{display:grid;grid-template-columns:repeat(auto-fill,minmax(11rem,1fr));gap:${S(0.3)}}
.sp-enter-item{display:grid;gap:${S(0.15)};padding:${S(0.2)};border:1px solid ${line}}
.sp-units{display:grid;gap:${S(0.1)}}
.sp-unit{display:grid;grid-template-columns:minmax(0,1fr);gap:${S(0.05)};padding-block:${S(0.15)};border-bottom:1px solid ${line}}
.sp-layouts{display:flex;flex-wrap:wrap;gap:${S(0.05)} ${S(0.25)}}
.sp-links{display:grid;gap:${S(0.1)}}
.sp-link{display:grid;gap:${S(0.02)};padding-block:${S(0.12)};border-bottom:1px solid ${line}}
.sp-ex{display:grid;gap:${S(0.15)};align-content:start}
.sp-ex img{display:block;width:100%;height:auto;border:1px solid ${line}}
.sp-missing{font-size:${T(0)}}
@media(min-width:900px){
.sp-section{grid-template-columns:minmax(0,1fr) minmax(0,3.2fr);column-gap:${S(0.6)}}
.sp-row{grid-template-columns:minmax(0,9rem) minmax(0,15rem) minmax(0,1fr);column-gap:${S(0.4)}}
.sp-facts{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:${S(0.4)}}
.sp-tone{grid-template-columns:minmax(0,7rem) 1fr}
}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}`;
}

function sectionBlock(id: string, no: string, title: string, content: string): string {
  return `<section id="${id}" class="sp-section" data-ds-unit="${id}">
<div class="sp-head"><div class="sp-no" data-ds-enter="fade">${no}</div><h2 class="sp-title" data-ds-enter="rise">${esc(title)}</h2></div>
<div class="sp-main">
${content}
</div>
</section>`;
}

function sub(title: string): string {
  return `<h3 class="sp-sub">${esc(title)}</h3>`;
}

function row(key: string, value: string, viz = ''): string {
  return `<div class="sp-row"><div class="sp-k">${esc(key)}</div><div class="sp-v">${esc(value)}</div><div class="sp-viz">${viz}</div></div>`;
}

function toneMeter(meta: SystemMeta): string {
  return (Object.keys(TONE_PAIRS) as ToneKey[])
    .map((key) => {
      const value = meta.tone[key];
      const ticks = [1, 2, 3, 4, 5].map((n) => `<i class="sp-tick"${n === value ? ' data-on' : ''}></i>`).join('');
      return `<div class="sp-tone"><div class="sp-k">${esc(TONE_PAIRS[key])}</div><div class="sp-ticks" role="img" aria-label="${esc(`${TONE_PAIRS[key]}：${value} / 5`)}">${ticks}</div></div>`;
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

function navigation(): string {
  const items = [
    ['intent', '意图与调性'],
    ['anchor', '材质锚点'],
    ['color', '色彩'],
    ['type', '字体'],
    ['scale', '间距与构图'],
    ['texture', '质感'],
    ['marks', '识别符号'],
    ['motion', '动效'],
    ['layouts', '排法'],
    ['links', '链接'],
  ];
  return `<nav class="sp-nav">${items.map(([id, label]) => `<a href="#${id}">${esc(label!)}</a>`).join('')}</nav>`;
}

function intentSection(model: PageModel): string {
  const { meta } = model;
  const scenarios = meta.scenarios.map((scenario) => `<li>${esc(scenario)}</li>`).join('');
  return sectionBlock(
    'intent',
    '01',
    '意图与调性',
    `<div class="sp-prose">${model.intentHtml}</div>
${sub('适用场景')}
<ul class="sp-prose">${scenarios}</ul>
${sub('调性位置')}
<div class="sp-rows">${toneMeter(meta)}</div>`,
  );
}

function anchorSection(model: PageModel): string {
  return sectionBlock(
    'anchor',
    '02',
    '材质锚点',
    `<p class="sp-statement">${esc(model.meta.materialAnchor)}</p>
<div class="sp-prose">${model.anchorHtml}</div>`,
  );
}

function colorSection(model: PageModel): string {
  const swatches = colorViews(model)
    .map(
      (color) => `<div class="sp-swatch"><div class="sp-swatch-chip" style="background:var(${color.cssVar})"></div><div class="sp-k">${esc(color.name)}</div><div class="sp-v">${esc(color.css)}</div>${
        color.hex ? `<div class="sp-v">${esc(color.hex)}</div>` : ''
      }</div>`,
    )
    .join('');
  return sectionBlock('color', '03', '色彩', `<div class="sp-prose">${model.colorHtml}</div><div class="sp-chips">${swatches}</div>`);
}

function yesNo(value: boolean): string {
  return value ? '允许' : '不允许';
}

function fontCard(font: FontView, cjkCapable: boolean): string {
  const { entry } = font;
  const sample = cjkCapable ? '纸上的光，慢慢停住 Aa 0123' : 'The quick brown fox Aa 0123';
  const facts: [string, string][] = [
    ['角色', font.role],
    ['家族', entry.family],
    ['字重', String(entry.weight)],
    ['覆盖', entry.scripts.join(' / ')],
    ['授权', entry.license.name],
    ['商用', yesNo(entry.permissions.commercial)],
    ['网页嵌入', yesNo(entry.permissions.webEmbed)],
    ['文件嵌入', yesNo(entry.permissions.fileEmbed)],
    ['可用载体', entry.carriers.join(' / ')],
    ['PPT 安全字体', entry.pptSafe ? '是' : '否'],
  ];
  const rows = facts
    .map(([key, value]) => `<div class="sp-fact"><div class="sp-k">${esc(key)}</div><div class="sp-v">${esc(value)}</div></div>`)
    .join('');
  return `<div class="sp-font">
<div class="sp-specimen" style="font-family:var(${font.cssVar}), var(--ds-font-cjk)">${esc(sample)}</div>
<div class="sp-facts">${rows}<div class="sp-fact"><div class="sp-k">${esc('授权链接')}</div><div class="sp-v"><a href="${escapeHtml(entry.license.url)}" target="_blank" rel="noopener">${escapeHtml(entry.license.url)}</a></div></div></div>
</div>`;
}

function typeSection(model: PageModel): string {
  const types = steps(model.tokens, '--ds-type-');
  const ratios = new Map(model.parsed.tokens.filter((t) => t.path[0] === 'ratio' && t.path[1] === 'type').map((t) => [t.path[2]!, t.number!]));
  const ladder = types
    .map((step) => {
      const ratio = ratios.get(step.name);
      return `<div class="sp-row"><div class="sp-k">${esc(`字阶 ${step.name}`)}</div><div class="sp-v">${esc(`${px(step.value)}${ratio !== undefined ? ` · ×${ratio}` : ''}`)}</div><div class="sp-viz" style="font-size:var(${step.cssVar});line-height:1.25">${esc('纸上的光 Aa 0123')}</div></div>`;
    })
    .join('');
  const cards = model.fonts.map((font) => fontCard(font, font.entry.scripts.includes('cjk'))).join('');
  return sectionBlock(
    'type',
    '04',
    '字体',
    `${sub('字体搭配与授权')}${cards}
<div class="sp-prose">${model.fontsHtml}</div>
${sub('字阶')}<div class="sp-rows">${ladder}</div>`,
  );
}

function scaleSection(model: PageModel): string {
  const { tokens } = model;
  const spaces = steps(tokens, '--ds-space-');
  const radii = steps(tokens, '--ds-radius-');
  const spaceRows = spaces.map((step) => row(`间距 ${step.name}`, px(step.value), `<div class="sp-bar" style="width:${px(step.value)}"></div>`)).join('');
  const radiusBoxes = radii
    .map((step) => `<div class="sp-boxes"><div><div class="sp-box" style="border-radius:var(${step.cssVar})"></div><div class="sp-k">${esc(`圆角 ${step.name}`)}</div><div class="sp-v">${esc(px(step.value))}</div></div></div>`)
    .join('');
  const composition = model.parsed.constraints?.composition ?? {};
  const percent = (range: [number, number]) => `${Math.round(range[0] * 100)}–${Math.round(range[1] * 100)}%`;
  const compositionRows = (Object.keys(composition) as CarrierId[])
    .map((carrier) => {
      const ranges = composition[carrier]!;
      return row(
        CARRIERS[carrier].label,
        `${carrier} · 跳跃率 ${ranges.jumpRate[0]}–${ranges.jumpRate[1]} · 版面率 ${percent(ranges.layoutRate)} · 图版率 ${percent(ranges.imageRate)}`,
      );
    })
    .join('');
  return sectionBlock(
    'scale',
    '05',
    '间距、圆角与构图比率',
    `<div class="sp-prose">${model.layoutHtml}${model.shapeHtml}</div>
${sub('间距阶梯')}<div class="sp-rows">${spaceRows}</div>
${sub('圆角阶梯')}<div class="sp-boxes">${radiusBoxes}</div>
${sub('构图比率')}<div class="sp-rows">${compositionRows || row('构图比率', '体系没有声明')}</div>`,
  );
}

function textureSection(model: PageModel): string {
  const { tokens, parsed } = model;
  const shadows = tokens.entries.filter((entry) => entry.cssVar.startsWith('--ds-shadow-'));
  const shadowItems = shadows
    .map((entry) => `<div class="sp-row"><div class="sp-k">${esc(`阴影 ${entry.cssVar.slice('--ds-shadow-'.length)}`)}</div><div class="sp-v">${esc(entry.css)}</div><div class="sp-viz"><div class="sp-shadow" style="box-shadow:var(${entry.cssVar})"></div></div></div>`)
    .join('');
  const grain = tokens.entries.find((entry) => entry.cssVar === '--ds-grain-max');
  const springs = new Map<string, string[]>();
  for (const entry of tokens.entries) {
    const match = /^--ds-spring-(.+)-(stiffness|damping|mass)$/.exec(entry.cssVar);
    if (match) springs.set(match[1]!, [...(springs.get(match[1]!) ?? []), `${match[2]} ${entry.css}`]);
  }
  const constraints = parsed.constraints;
  const facts = [
    constraints ? row('光源方向', `${constraints.lightAngleDeg}°`) : '',
    constraints ? row('强调色预算', `${Math.round(constraints.accentBudget * 100)}%`) : '',
    constraints ? row('颗粒上限', String(constraints.grainMax)) : '',
    grain ? row('颗粒强度', grain.css, '<div class="sp-grain"><i></i></div>') : '',
    ...[...springs].map(([name, values]) => row(`弹簧 ${name}`, values.join(' · '))),
  ].join('');
  return sectionBlock('texture', '06', '质感', `<div class="sp-prose">${model.imageryHtml}</div>${sub('阴影')}<div class="sp-rows">${shadowItems || row('阴影', '体系没有声明')}</div>${sub('光源、颗粒与弹簧')}<div class="sp-rows">${facts}</div>`);
}

function marksSection(model: PageModel): string {
  const list = model.marksHtml.replace(/^<ul>/, '<ul class="sp-marks">');
  return sectionBlock('marks', '07', '识别符号', list);
}

function replayButton(kind: string, key: string): string {
  return `<button type="button" data-ds-replay="${kind}" data-key="${escapeHtml(key)}">${esc('重放')}</button>`;
}

function motionSection(model: PageModel): string {
  const { tokens } = model;
  const durations = steps(tokens, '--ds-duration-');
  const staggers = steps(tokens, '--ds-stagger-');
  const easings = tokens.entries.filter((entry) => entry.cssVar.startsWith('--ds-easing-'));
  const enters = ENTER_EFFECTS.map(
    (effect) => `<div class="sp-enter-item"><div class="sp-k">${esc(effect.name)}</div><div class="sp-v">${esc(effect.label)}</div><div class="sp-stage"><span class="sp-chip" data-ds-slot="enter-${effect.name}"></span></div>${replayButton('enter', effect.name)}</div>`,
  ).join('');
  const durationRows = durations
    .map((step) => `<div class="sp-row"><div class="sp-k">${esc(step.name)}</div><div class="sp-v">${esc(ms(step.value))}</div><div class="sp-viz"><div class="sp-stage"><span class="sp-fill" data-ds-slot="duration-${escapeHtml(step.name)}"></span></div>${replayButton('duration', step.name)}</div></div>`)
    .join('');
  const easingRows = easings
    .map((entry) => {
      const name = entry.cssVar.slice('--ds-easing-'.length);
      return `<div class="sp-row"><div class="sp-k">${esc(name)}</div><div class="sp-v">${esc(entry.css)}</div><div class="sp-viz"><div class="sp-track"><span class="sp-marker" data-ds-slot="easing-${escapeHtml(name)}"></span></div>${replayButton('easing', name)}</div></div>`;
    })
    .join('');
  const staggerRows = staggers
    .map((step) => {
      const dots = [0, 1, 2, 3, 4].map(() => `<span class="sp-dot" data-ds-slot="stagger-${escapeHtml(step.name)}"></span>`).join('');
      return `<div class="sp-row"><div class="sp-k">${esc(step.name)}</div><div class="sp-v">${esc(ms(step.value))}</div><div class="sp-viz"><div class="sp-dots">${dots}</div>${replayButton('stagger', step.name)}</div></div>`;
    })
    .join('');
  const controls = `<div class="sp-controls"><button type="button" data-ds-reduce-toggle aria-pressed="false">${esc('减少动态效果')}</button><span class="sp-live" data-ds-reduce-state aria-live="polite"></span></div>`;
  return sectionBlock(
    'motion',
    '08',
    '动效',
    `<div class="sp-prose">${model.motionHtml}</div>
${controls}
${sub('入场方式')}<div class="sp-enter">${enters}</div>
${sub('时长阶梯')}<div class="sp-rows">${durationRows}</div>
${sub('缓动')}<div class="sp-rows">${easingRows}</div>
${staggers.length ? `${sub('错峰')}<div class="sp-rows">${staggerRows}</div>` : ''}`,
  );
}

function layoutsSection(model: PageModel): string {
  const groups = model.layouts
    .map((group) => {
      const units = group.units
        .map(
          (unit) =>
            `<div class="sp-unit"><div class="sp-k">${esc(unit.label)}</div><div class="sp-v">${esc(unit.id)}</div><ul class="sp-layouts">${unit.layouts.map((layout) => `<li>${esc(layout)}</li>`).join('')}</ul></div>`,
        )
        .join('');
      return `${sub(`${CARRIERS[group.carrier].label} · ${group.carrier}`)}<div class="sp-units">${units || `<p class="sp-missing">${esc('这个载体还没有排法。')}</p>`}</div>`;
    })
    .join('');
  return sectionBlock('layouts', '09', '排法', groups);
}

function linkList(links: LinkView[]): string {
  return `<ul class="sp-links">${links
    .map((link) => `<li class="sp-link"><a href="${escapeHtml(link.href)}">${esc(link.label)}</a>${link.note ? `<div class="sp-v">${esc(link.note)}</div>` : ''}</li>`)
    .join('')}</ul>`;
}

function exemplarCard(exemplar: ExemplarView): string {
  const source = exemplar.sourceUrl
    ? `<div class="sp-v">${esc('来源：')}<a href="${escapeHtml(exemplar.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(exemplar.sourceUrl)}</a></div>`
    : '';
  const media =
    exemplar.media?.kind === 'screenshot'
      ? `<img src="${escapeHtml(exemplar.media.href)}" alt="${escapeHtml(exemplar.title)}" loading="lazy">`
      : exemplar.media
        ? `<div class="sp-v"><a href="${escapeHtml(exemplar.media.href)}">${esc('查看录屏')}</a></div>`
        : '';
  return `<div class="sp-ex">${media}<div class="sp-k">${esc(exemplar.title)}</div><div class="sp-v">${esc(`${exemplar.carrier} · ${exemplar.sourceType} · ${exemplar.copyright}`)}</div>${source}</div>`;
}

function linksSection(model: PageModel): string {
  const overview = model.overview.length
    ? model.overview.map((group) => `${sub(group.title)}${linkList(group.links)}`).join('')
    : `<p class="sp-missing">${esc('这套体系的排法总览还没有生成。')}</p>`;
  const works = model.works.length ? linkList(model.works) : `<p class="sp-missing">${esc('这套体系的标准样张还没有生成。')}</p>`;
  const exemplars = model.exemplars.length
    ? `<div class="sp-chips">${model.exemplars.map(exemplarCard).join('')}</div>`
    : `<p class="sp-missing">${esc('这套体系还没有已批准的范例。')}</p>`;
  return sectionBlock('links', '10', '链接', `${sub('排法总览')}${overview}${sub('标准样张')}${works}${sub('已批准的范例')}${exemplars}`);
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
  let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
      reduced = !reduced;
      paint();
    });
  }

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
  const body = `<div class="sp">
<header class="sp-header" data-ds-unit="header" ${headerTag}>
${header}
</header>
${navigation()}
${intentSection(model)}
${anchorSection(model)}
${colorSection(model)}
${typeSection(model)}
${scaleSection(model)}
${textureSection(model)}
${marksSection(model)}
${motionSection(model)}
${layoutsSection(model)}
${linksSection(model)}
</div>`;
  return { title: `${model.meta.name} · 体系总览页`, style: styleSheet(model), body, script: replayScript(model.tokens) };
}

/*
 * Sixteen reusable web layouts of cut-paper, two per shared narrative unit (SYSTEM.md 网页排法). build.mjs writes layouts/web/<unit>/<id>.liquid.
 * Layout content uses only declared shared slots. Leaves in layouts are decoration only, five at most per layout (SYSTEM.md 关键规则 2), in fields marked aria-hidden.
 * List slots that are read like a letter (problem points, feature lines) use the paper veil, one item per line. Links point at in-page anchors because layouts do not know a work's addresses.
 */
import { drift, ground, sheet } from '../art/arrange.mjs';
import { leafSvg } from '../lib/leaves.mjs';
import { button, enter, leaf, section } from './common.mjs';

const s = (name) => `{{ slots.${name} }}`;
const deco = (cls, points, seed, w = 18) => `<div class="field ${cls}" aria-hidden="true" data-ds-stagger="leaf">${drift(points, seed, w).map((l, i) => leaf(l, i, 'fall', '7')).join('')}</div>`;
const veiled = (slot, cls = 'letter') =>
  `<ul class="${cls}" data-ds-stagger="sentence">{% for item in slots.${slot} %}<li class="s">{{ item }}<span class="veil" aria-hidden="true" data-ds-enter="peel-right" data-ds-order="{{ forloop.index0 }}" data-ds-step="read" data-ds-ease="read" data-ds-wait="settle"></span></li>{% endfor %}</ul>`;
const pic = (order = 1, effect = 'fade') => `<figure class="pic" ${enter(order, effect, 'drift', 'drift', '5')}>${s('visual')}</figure>`;
const PIC_CSS = `.pic img { display:block; width:100%; height:auto; }`;
const stats = (cls) => `<dl class="${cls}" data-ds-stagger="leaf">{% for stat in slots.stats %}<div class="stat stat-{{ forloop.index }}" ${enter('{{ forloop.index0 }}', 'fall', 'drift', 'drift', '6')}><dt class="num">{{ stat }}</dt><dd>{{ slots.statLabels[forloop.index0] }}</dd></div>{% endfor %}</dl>`;
const logos = `<div class="logos">{% for logo in slots.logos %}{{ logo }}{% endfor %}</div>`;
const LOGO_CSS = `.logos { display:flex; flex-wrap:wrap; gap:var(--ds-space-6); align-items:center; margin-top:var(--ds-space-7); }.logos img { height:var(--ds-space-7); width:auto; }`;
const HOLE = [{ species: 'monstera', seed: 4, x: 50, y: 62, w: 80, angle: -14 }];

export const LAYOUTS = {
  'hero/huashu': section(
    `<div class="center">${deco('ring', [[2, 6], [80, 0], [88, 56], [0, 64], [44, 88]], 5, 13)}<figure class="pic" ${enter(0, 'fade', 'drift')}>${s('visual')}</figure></div><div class="copy"><p class="note" ${enter(0)}>${s('eyebrow')}</p><h1 class="t-head" ${enter(1)}>${s('headline')}</h1><p class="lead" ${enter(2)}>${s('lead')}</p><div ${enter(3)}>${button(s('cta'), '#action')}</div></div>`,
    `.copy h1 { font-size:var(--ds-type-title); line-height:1.25; }@media(max-width:860px){.copy h1{font-size:var(--ds-type-head);}}.center { position:relative; width:min(720px, 100%); margin:0 auto; }.ring { position:absolute; inset:-6% -10%; }.center .pic { position:relative; }${PIC_CSS}.copy { display:grid; justify-items:center; text-align:center; gap:var(--ds-space-4); margin-top:var(--ds-space-7); }.copy .lead { max-width:28em; }`
  ),
  'hero/tiepian': section(
    `<div class="duo"><div class="stack"><p class="note" ${enter(0)}>${s('eyebrow')}</p><h1 class="t-head" ${enter(0)}>${s('headline')}</h1><p class="lead" ${enter(1)}>${s('lead')}</p><div ${enter(2)}>${button(s('cta'), '#action')}</div></div><div class="mount"><span class="sheet" aria-hidden="true"></span>${pic(1, 'fall')}</div></div>`,
    `.duo h1 { font-size:var(--ds-type-title); line-height:1.25; }@media(max-width:860px){.duo h1{font-size:var(--ds-type-head);}}.duo { display:grid; grid-template-columns:minmax(0,5fr) minmax(0,7fr); gap:var(--ds-space-8); align-items:center; }.mount { position:relative; padding:var(--ds-space-6); }.sheet { position:absolute; inset:0; background:var(--ds-color-mustard); transform:rotate(-3deg); }.mount .pic { position:relative; transform:rotate(1.5deg); }${PIC_CSS}@media(max-width:860px){.duo{grid-template-columns:1fr;}}`
  ),
  'problem/xinzhong': section(
    `<div class="col"><h2 class="t-sub" ${enter(0)}>${s('heading')}</h2><p class="lead" ${enter(1)}>${s('body')}</p>${veiled('points')}</div>`,
    `.col { max-width:30em; margin:0 auto; display:grid; gap:var(--ds-space-6); }`
  ),
  'problem/yechuang': section(
    `<div class="duo"><figure class="neg" ${enter(0, 'fade', 'drift')}>${sheet('var(--ds-color-pine)', HOLE, { width: 400, height: 460, id: 'layout-window' })}</figure><div class="stack"><h2 class="t-sub" ${enter(0)}>${s('heading')}</h2><p class="body" ${enter(1)}>${s('body')}</p><ul class="pts" data-ds-stagger="line">{% for point in slots.points %}<li ${enter('{{ forloop.index0 }}')}>{{ point }}</li>{% endfor %}</ul></div></div>`,
    `.duo { display:grid; grid-template-columns:minmax(0,4fr) minmax(0,7fr); gap:var(--ds-space-8); align-items:center; }.neg svg { display:block; width:100%; height:auto; }.pts { display:grid; gap:var(--ds-space-3); }.pts li { padding-left:var(--ds-space-5); position:relative; }.pts li::before { content:""; position:absolute; left:0; top:.8em; width:var(--ds-space-2); height:var(--ds-space-2); border-radius:var(--ds-radius-pill); background:var(--ds-color-pine); }@media(max-width:860px){.duo{grid-template-columns:1fr;}.neg{max-width:240px;}}`
  ),
  'solution/kaichuang': section(
    `<div class="duo"><figure class="window" ${enter(0, 'fade', 'drift')}>${s('visual')}</figure><div class="stack"><h2 class="t-sub" ${enter(0)}>${s('heading')}</h2><p class="lead" ${enter(1)}>${s('body')}</p></div></div>`,
    `.duo { display:grid; grid-template-columns:minmax(0,7fr) minmax(0,5fr); gap:var(--ds-space-8); align-items:center; }.window img { display:block; width:100%; aspect-ratio:1; object-fit:cover; border-radius:var(--ds-radius-pill) var(--ds-radius-leaf) var(--ds-radius-pill) var(--ds-radius-leaf); }@media(max-width:860px){.duo{grid-template-columns:1fr;}}`
  ),
  'solution/pingtie': section(
    `<h2 class="t-sub head" ${enter(0)}>${s('heading')}</h2><div class="plate">${pic(1, 'rise')}<span class="corner" aria-hidden="true" ${enter(2, 'fall', 'drift', 'drift', '7')}>${leafSvg('maple', 'var(--ds-color-vermilion)', { seed: 2, angle: 24, paper: 'var(--ds-color-paper)' })}</span></div><p class="lead below" ${enter(3)}>${s('body')}</p>`,
    `.head { max-width:20em; margin-bottom:var(--ds-space-6); }.plate { position:relative; max-width:900px; }${PIC_CSS}.corner { position:absolute; right:-4%; bottom:-10%; width:16%; }.corner svg { display:block; width:100%; height:auto; overflow:visible; }.below { margin-top:var(--ds-space-7); max-width:30em; }`
  ),
  'features/yeqian': section(
    `<div class="intro"><h2 class="t-sub" ${enter(0)}>${s('heading')}</h2><p class="lead" ${enter(1)}>${s('lead')}</p></div><ul class="tags" data-ds-stagger="leaf">{% for item in slots.itemTitles %}<li class="tag" ${enter('{{ forloop.index0 }}', 'fall', 'drift', 'drift', '6')}><span class="dot dot-{{ forloop.index }}" aria-hidden="true"></span><span class="label"><span class="name">{{ item }}</span><span class="what">{{ slots.itemBodies[forloop.index0] }}</span></span></li>{% endfor %}</ul>`,
    `.intro { display:grid; gap:var(--ds-space-4); max-width:30em; margin-bottom:var(--ds-space-7); }.tags { display:grid; grid-template-columns:1fr 1fr; gap:var(--ds-space-5) var(--ds-space-8); }.tag { display:grid; grid-template-columns:var(--ds-space-6) minmax(0,1fr); gap:var(--ds-space-4); align-items:center; }.tag:nth-child(even) { margin-top:var(--ds-space-6); }.dot { width:var(--ds-space-6); height:var(--ds-space-6); border-radius:var(--ds-radius-pill) 0; background:var(--ds-color-sprout); }.dot-2 { background:var(--ds-color-vermilion); }.dot-3 { background:var(--ds-color-cobalt); }.dot-4 { background:var(--ds-color-mustard); }.dot-5 { background:var(--ds-color-pine); }.dot-6 { background:var(--ds-color-persimmon); }.label { display:grid; gap:var(--ds-space-1); background:var(--ds-color-paper-deep); padding:var(--ds-space-3) var(--ds-space-6) var(--ds-space-3) var(--ds-space-4); clip-path:polygon(0 0,100% 0,calc(100% - var(--ds-space-4)) 50%,100% 100%,0 100%); }.name { font-size:var(--ds-type-lead); }.what { font-size:var(--ds-type-note); color:var(--ds-color-ink-2); }@media(max-width:860px){.tags{grid-template-columns:1fr;}.tag:nth-child(even){margin-top:0;}}`
  ),
  'features/hangjian': section(
    `<div class="duo"><div class="stack"><h2 class="t-sub" ${enter(0)}>${s('heading')}</h2><p class="lead" ${enter(1)}>${s('lead')}</p></div><ul class="letter" data-ds-stagger="sentence">{% for item in slots.itemTitles %}<li class="s"><span class="t">{{ item }}</span>：{{ slots.itemBodies[forloop.index0] }}<span class="veil" aria-hidden="true" data-ds-enter="peel-right" data-ds-order="{{ forloop.index0 }}" data-ds-step="read" data-ds-ease="read" data-ds-wait="settle"></span></li>{% endfor %}</ul></div>`,
    `.duo { display:grid; grid-template-columns:minmax(0,4fr) minmax(0,8fr); gap:var(--ds-space-8); align-items:start; }.letter { font-size:var(--ds-type-body); }@media(max-width:860px){.duo{grid-template-columns:1fr;}}`
  ),
  'evidence/jianzi': section(
    `<h2 class="t-sub" ${enter(0)}>${s('heading')}</h2>${stats('cut')}<blockquote class="q" ${enter(1)}><p class="lead">${s('quote')}</p><p class="note">${s('quoteBy')}</p></blockquote>${logos}`,
    `.cut { display:flex; flex-wrap:wrap; gap:var(--ds-space-6) var(--ds-space-9); align-items:flex-end; margin:var(--ds-space-7) 0; }.stat dt { font-family:var(--ds-font-num); font-weight:700; font-size:var(--ds-type-title); line-height:1; letter-spacing:-.03em; color:var(--ds-color-cobalt); }.stat-1 dt { font-size:var(--ds-type-colossal); color:var(--ds-color-vermilion); }.stat-3 dt { color:var(--ds-color-pine); }.stat-4 dt { color:var(--ds-color-indigo); }.stat dd { font-size:var(--ds-type-note); color:var(--ds-color-ink-2); margin-top:var(--ds-space-2); }.q { display:grid; gap:var(--ds-space-3); max-width:30em; border-left:var(--ds-space-1) solid var(--ds-color-mustard); padding-left:var(--ds-space-5); }${LOGO_CSS}@media(max-width:860px){.stat-1 dt{font-size:var(--ds-type-display);}.stat dt{font-size:var(--ds-type-head);}}`
  ),
  'evidence/luokuan': section(
    `<div class="note-card"><h2 class="note" ${enter(0)}>${s('heading')}</h2><blockquote ${enter(1)}><p class="t-sub">${s('quote')}</p><p class="by">${s('quoteBy')}</p></blockquote></div>${stats('row')}${logos}`,
    `.note-card { max-width:34em; margin:0 auto; display:grid; gap:var(--ds-space-5); }.by { text-align:right; color:var(--ds-color-ink-2); margin-top:var(--ds-space-4); }.row { display:flex; flex-wrap:wrap; justify-content:center; gap:var(--ds-space-5) var(--ds-space-8); margin-top:var(--ds-space-8); }.stat { text-align:center; }.stat dt { font-size:var(--ds-type-head); line-height:1.2; }.stat dd { font-size:var(--ds-type-note); color:var(--ds-color-ink-2); }${LOGO_CSS}.logos { justify-content:center; }`
  ),
  'process/luoye': section(
    `<h2 class="t-sub" ${enter(0)}>${s('heading')}</h2><ol class="fall" data-ds-stagger="leaf">{% for step in slots.steps %}<li class="st st-{{ forloop.index }}" ${enter('{{ forloop.index0 }}', 'fall', 'drift', 'drift', '7')}><span class="mk" aria-hidden="true"></span><span class="txt"><span class="name">{{ step }}</span><span class="note">{{ slots.stepNotes[forloop.index0] }}</span></span></li>{% endfor %}</ol>`,
    `.fall { display:grid; gap:var(--ds-space-4); margin-top:var(--ds-space-7); }.st { display:grid; grid-template-columns:var(--ds-space-6) minmax(0,1fr); gap:var(--ds-space-4); align-items:center; max-width:30em; }.st-2 { margin-left:var(--ds-space-8); }.st-3 { margin-left:var(--ds-space-9); }.st-4 { margin-left:var(--ds-space-10); }.st-5 { margin-left:var(--ds-space-11); }.st-6 { margin-left:var(--ds-space-12); }.mk { width:var(--ds-space-6); height:var(--ds-space-6); border-radius:var(--ds-radius-pill) 0; background:var(--ds-color-persimmon); }.st:nth-child(even) .mk { background:var(--ds-color-pine); border-radius:0 var(--ds-radius-pill); }.txt { display:grid; }.name { font-size:var(--ds-type-lead); }@media(max-width:860px){.st-2,.st-3,.st-4,.st-5,.st-6{margin-left:0;}}`
  ),
  'process/xiaojing': section(
    `<h2 class="t-sub" ${enter(0)}>${s('heading')}</h2><ol class="path" data-ds-stagger="line">{% for step in slots.steps %}<li ${enter('{{ forloop.index0 }}')}><span class="num n">{{ forloop.index }}</span><span class="name">{{ step }}</span><span class="note">{{ slots.stepNotes[forloop.index0] }}</span></li>{% endfor %}</ol>`,
    `.path { display:grid; grid-auto-flow:column; grid-auto-columns:minmax(0,1fr); gap:var(--ds-space-5); margin-top:var(--ds-space-7); border-top:2px dashed var(--ds-color-rule); padding-top:var(--ds-space-5); }.path li { display:grid; gap:var(--ds-space-1); align-content:start; }.path li:nth-child(odd) { padding-top:var(--ds-space-5); }.n { font-size:var(--ds-type-sub); color:var(--ds-color-pine); line-height:1; }.name { font-size:var(--ds-type-lead); }@media(max-width:860px){.path{grid-auto-flow:row;}.path li:nth-child(odd){padding-top:0;}}`
  ),
  'cta/zhongshu': section(
    `<div class="hug" id="action">${deco('around', [[0, 10], [86, 4], [6, 70], [84, 66]], 31, 9)}<div class="copy"><h2 class="t-head" ${enter(0)}>${s('headline')}</h2><p class="lead" ${enter(1)}>${s('lead')}</p><div ${enter(2)}>${button(s('action'), '#top')}</div><p class="note" ${enter(3)}>${s('note')}</p></div></div>`,
    `.hug { position:relative; padding:var(--ds-space-8) 0; }.around { position:absolute; inset:0; }.copy { position:relative; display:grid; justify-items:center; text-align:center; gap:var(--ds-space-4); max-width:28em; margin:0 auto; }`
  ),
  'cta/huixin': section(
    `<div class="reply" id="action"><p class="note" ${enter(0)}>回信</p><h2 class="t-sub" ${enter(0)}>${s('headline')}</h2><p class="lead" ${enter(1)}>${s('lead')}</p><p class="note" ${enter(2)}>${s('note')}</p><div ${enter(3)}>${button(s('action'), '#top')}</div></div>`,
    `.reply { max-width:30em; display:grid; gap:var(--ds-space-4); margin-left:var(--ds-space-9); padding-left:var(--ds-space-6); border-left:var(--ds-space-1) solid var(--ds-color-peach); }@media(max-width:860px){.reply{margin-left:0;}}`
  ),
  'footer/diye': section(
    `<div class="field floor" aria-hidden="true" data-ds-stagger="leaf">${ground(14, 9).map((l, i) => leaf(l, i, 'fall', '6')).join('')}</div><div class="foot"><p class="brand">${s('brand')}</p><nav class="links">{% for link in slots.links %}<a href="#top">{{ link }}</a>{% endfor %}</nav><p class="note legal">${s('legal')}</p></div>`,
    `:scope { background:var(--ds-color-paper-deep); padding-top:var(--ds-space-6); padding-bottom:var(--ds-space-7); }.floor { aspect-ratio:10 / 1; margin-bottom:var(--ds-space-6); }.foot { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,2fr); gap:var(--ds-space-4) var(--ds-space-8); }.brand { font-size:var(--ds-type-sub); }.links { display:flex; flex-wrap:wrap; gap:var(--ds-space-3) var(--ds-space-5); }.legal { grid-column:2; }@media(max-width:860px){.foot{grid-template-columns:1fr;}.legal{grid-column:1;}}`
  ),
  'footer/jianmo': section(
    `<div class="foot"><p class="brand">${s('brand')}</p><nav class="links">{% for link in slots.links %}<a href="#top">{{ link }}</a>{% endfor %}</nav><p class="note legal">${s('legal')}</p></div>`,
    `:scope { padding-top:var(--ds-space-7); padding-bottom:var(--ds-space-7); }.foot { display:grid; justify-items:center; text-align:center; gap:var(--ds-space-3); }.links { display:flex; flex-wrap:wrap; justify-content:center; gap:var(--ds-space-3) var(--ds-space-5); }`
  ),
};

/*
 * Sixteen reusable web layouts of oil-halftone, two per shared narrative unit (SYSTEM.md 网页排法). build.mjs writes layouts/web/<unit>/<id>.liquid.
 * Layout content uses only declared shared slots. Pictures are faded oil paintings on the system paper, so they sit on paper without frames (multiply blend); text never sits on a painting.
 * Links in layouts point at in-page anchors (#action, #top) because layouts do not know a work's real addresses; works that need real links use fragments.
 */
import { button, enter, section } from './common.mjs';

const s = (name) => `{{ slots.${name} }}`;
const paint = (name = 'visual', order = 1, effect = 'right', step = 'settle', distance = '6', cls = '') =>
  `<figure class="paint${cls ? ` ${cls}` : ''}" ${enter(order, effect, step, 'drift', distance)}>${s(name)}</figure>`;
const rows = (titles, bodies, numbered = true) =>
  `<ol class="rows" data-ds-stagger="line">{% for item in slots.${titles} %}<li class="row" ${enter('{{ forloop.index0 }}')}>${numbered ? `<span class="row-n serif">{{ forloop.index }}</span>` : ''}<h3>{{ item }}</h3><p>{{ slots.${bodies}[forloop.index0] }}</p></li>{% endfor %}</ol>`;
const rowCSS = `.rows { border-top:1px solid var(--ds-color-rule); }.row { display:grid; grid-template-columns:var(--ds-space-8) minmax(0,1fr) minmax(0,2fr); gap:var(--ds-space-5); padding:var(--ds-space-5) 0; border-bottom:1px solid var(--ds-color-rule); align-items:baseline; }.row-n { font-size:var(--ds-type-head); line-height:1; color:var(--ds-color-teal); }.row h3 { font-size:var(--ds-type-lead); font-weight:400; }.row p { color:var(--ds-color-ink-2); }@media(max-width:860px){.row{grid-template-columns:var(--ds-space-7) minmax(0,1fr);gap:var(--ds-space-3);}.row p{grid-column:2;}}`;
const stats = `<dl class="stats" data-ds-stagger="line">{% for stat in slots.stats %}<div class="stat" ${enter('{{ forloop.index0 }}')}><dt class="num">{{ stat }}</dt><dd>{{ slots.statLabels[forloop.index0] }}</dd></div>{% endfor %}</dl>`;
const logos = `<div class="logos">{% for logo in slots.logos %}{{ logo }}{% endfor %}</div>`;
const logoCSS = `.logos { display:flex; flex-wrap:wrap; gap:var(--ds-space-6); align-items:center; }.logos img { height:var(--ds-space-7); width:auto; }`;
const footer = (big) => section(
  `<div class="${big ? 'foot-big' : 'foot-line'}"><p class="brand serif">${s('brand')}</p><nav class="links">{% for link in slots.links %}<a href="#top">{{ link }}</a>{% endfor %}</nav><p class="note legal">${s('legal')}</p></div>`,
  big
    ? `:scope { background:var(--ds-color-paper-deep); padding-top:var(--ds-space-8); padding-bottom:var(--ds-space-7); }.foot-big { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:var(--ds-space-6) var(--ds-space-8); }.brand { font-size:var(--ds-type-title); grid-row:span 2; }.links { display:flex; flex-wrap:wrap; gap:var(--ds-space-3) var(--ds-space-5); align-self:end; }.legal { max-width:32em; }@media(max-width:860px){.foot-big{grid-template-columns:1fr;}.brand{font-size:var(--ds-type-head);grid-row:auto;}}`
    : `:scope { padding-top:var(--ds-space-6); padding-bottom:var(--ds-space-6); }.foot-line { display:flex; flex-wrap:wrap; gap:var(--ds-space-4) var(--ds-space-7); align-items:baseline; border-top:1px solid var(--ds-color-ink); padding-top:var(--ds-space-5); }.brand { font-size:var(--ds-type-sub); }.links { display:flex; gap:var(--ds-space-5); flex-wrap:wrap; }.legal { flex-basis:100%; }`
);

export const LAYOUTS = {
  'hero/huakuang': section(
    `<div class="split hero"><div class="stack"><p class="eyebrow" ${enter(0)}>${s('eyebrow')}</p><h1 class="serif t-title" ${enter(0)}>${s('headline')}</h1><p class="lead" ${enter(1)}>${s('lead')}</p><div class="actions" ${enter(2)}>${button(s('cta'), '#action')}</div></div>${paint('visual', 1, 'right', 'linger', '7', 'bleed-r')}</div>`,
    `.hero { grid-template-columns:minmax(0,5fr) minmax(0,7fr); }@media(max-width:860px){.hero h1{font-size:var(--ds-type-head);}}`
  ),
  'hero/dazi': section(
    `<p class="eyebrow" ${enter(0)}>${s('eyebrow')}</p><h1 class="serif t-display big" ${enter(0)}>${s('headline')}</h1><div class="under"><div class="stack"><p class="lead" ${enter(1)}>${s('lead')}</p><div class="actions" ${enter(2)}>${button(s('cta'), '#action')}</div></div>${paint('visual', 1, 'fall', 'linger', '6')}</div>`,
    `.big { max-width:14em; margin:var(--ds-space-5) 0 var(--ds-space-7); }.under { display:grid; grid-template-columns:minmax(0,4fr) minmax(0,8fr); gap:var(--ds-space-8); align-items:end; }@media(max-width:860px){.under{grid-template-columns:1fr;gap:var(--ds-space-6);}}`
  ),
  'problem/duiwen': section(
    `<div class="center"><h2 class="serif t-title" ${enter(0)}>${s('heading')}</h2><p class="lead" ${enter(1)}>${s('body')}</p></div><ul class="tags" data-ds-stagger="float">{% for point in slots.points %}<li class="tag tag-{{ forloop.index }}" ${enter('{{ forloop.index0 }}', 'fade', 'settle')}>{{ point }}</li>{% endfor %}</ul>`,
    `.center { text-align:center; max-width:44em; margin:0 auto; display:grid; gap:var(--ds-space-5); justify-items:center; }.center .lead { text-align:left; max-width:30em; }.tags { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:var(--ds-space-5); margin-top:var(--ds-space-8); }.tag { border-top:1px solid var(--ds-color-ink); padding-top:var(--ds-space-3); font-size:var(--ds-type-note); color:var(--ds-color-ink-2); }.tag-2,.tag-4 { margin-top:var(--ds-space-7); }@media(max-width:860px){.tags{grid-template-columns:1fr 1fr;}}`
  ),
  'problem/zhanqian': section(
    `<div class="split"><div class="stack"><h2 class="serif t-head" ${enter(0)}>${s('heading')}</h2><p class="body" ${enter(1)}>${s('body')}</p></div><ul class="label" data-ds-stagger="line">{% for point in slots.points %}<li ${enter('{{ forloop.index0 }}')}>{{ point }}</li>{% endfor %}</ul></div>`,
    `.label { background:var(--ds-color-sage); border-radius:var(--ds-radius-panel); padding:var(--ds-space-6) var(--ds-space-7); }.label li { padding:var(--ds-space-4) 0; border-bottom:1px solid var(--ds-color-celadon); }.label li:last-child { border-bottom:0; }`
  ),
  'solution/bingpai': section(
    `<div class="split side">${paint('visual', 0, 'left', 'settle', '6', 'bleed-l')}<div class="stack"><h2 class="serif t-head" ${enter(0)}>${s('heading')}</h2><p class="body" ${enter(1)}>${s('body')}</p></div></div>`,
    `.side { grid-template-columns:minmax(0,7fr) minmax(0,5fr); }`
  ),
  'solution/manfu': section(
    `<h2 class="serif t-title wide" ${enter(0)}>${s('heading')}</h2>${paint('visual', 1, 'rise', 'settle', '6')}<p class="body cols" ${enter(2)}>${s('body')}</p>`,
    `.wide { max-width:16em; margin-bottom:var(--ds-space-6); }.cols { columns:2; column-gap:var(--ds-space-7); max-width:none; margin-top:var(--ds-space-6); }@media(max-width:860px){.cols{columns:1;}}`
  ),
  'features/cuoluo': section(
    `<div class="split top"><h2 class="serif t-head" ${enter(0)}>${s('heading')}</h2><p class="lead" ${enter(1)}>${s('lead')}</p></div><ul class="cards" data-ds-stagger="float">{% for item in slots.itemTitles %}<li class="card card-{{ forloop.index }}" ${enter('{{ forloop.index0 }}', 'rise', 'settle', 'drift', '5')}><h3>{{ item }}</h3><p>{{ slots.itemBodies[forloop.index0] }}</p></li>{% endfor %}</ul>`,
    `.top { align-items:end; margin-bottom:var(--ds-space-7); }.cards { display:grid; grid-template-columns:repeat(12,minmax(0,1fr)); gap:var(--ds-space-4); }.card { background:var(--ds-color-sage); border-radius:var(--ds-radius-card); padding:var(--ds-space-5); grid-column:span 4; display:grid; gap:var(--ds-space-3); align-content:start; }.card h3 { font-family:var(--ds-font-serif); font-weight:300; font-size:var(--ds-type-sub); letter-spacing:-.02em; line-height:1.3; }.card p { color:var(--ds-color-ink-2); }.card-1 { grid-column:1 / span 5; }.card-2 { grid-column:7 / span 6; margin-top:var(--ds-space-7); }.card-3 { grid-column:2 / span 5; }.card-4 { grid-column:8 / span 5; margin-top:var(--ds-space-6); }.card-5 { grid-column:1 / span 6; }.card-6 { grid-column:7 / span 5; margin-top:var(--ds-space-5); }@media(max-width:860px){.card,.card-1,.card-2,.card-3,.card-4,.card-5,.card-6{grid-column:1 / -1;margin-top:0;}}`
  ),
  'features/tiaomu': section(`<div class="split top"><h2 class="serif t-head" ${enter(0)}>${s('heading')}</h2><p class="lead" ${enter(1)}>${s('lead')}</p></div>${rows('itemTitles', 'itemBodies')}`, `.top { align-items:end; margin-bottom:var(--ds-space-7); }${rowCSS}`),
  'evidence/shenqing': section(
    `<blockquote class="serif t-head quote" ${enter(0)}>${s('quote')}<p class="by">${s('quoteBy')}</p></blockquote><h2 class="eyebrow on-teal" ${enter(1)}>${s('heading')}</h2>${stats}<div class="marks">${logos}</div>`,
    `:scope { background:var(--ds-color-teal); color:var(--ds-color-paper); }.quote { max-width:20em; }.by { font-family:var(--ds-font-body); font-size:var(--ds-type-note); letter-spacing:0; margin-top:var(--ds-space-5); }.on-teal { color:var(--ds-color-paper); margin:var(--ds-space-8) 0 var(--ds-space-4); }.stats { display:grid; grid-template-columns:minmax(0,5fr) minmax(0,4fr) minmax(0,4fr) minmax(0,3fr); gap:var(--ds-space-3); }.stat { background:var(--ds-color-paper); color:var(--ds-color-ink); border-radius:var(--ds-radius-card); padding:var(--ds-space-5); display:grid; gap:var(--ds-space-2); }.stat dt { font-size:var(--ds-type-head); line-height:1; letter-spacing:-.02em; }.stat dd { font-size:var(--ds-type-note); color:var(--ds-color-ink-2); }.marks { margin-top:var(--ds-space-7); background:var(--ds-color-paper); border-radius:var(--ds-radius-panel); padding:var(--ds-space-5) var(--ds-space-6); }${logoCSS}@media(max-width:860px){.stats{grid-template-columns:1fr 1fr;}}`
  ),
  'evidence/yinyan': section(
    `<div class="split q"><span class="mark serif" aria-hidden="true"></span><blockquote class="serif t-sub" ${enter(0)}>${s('quote')}<p class="by">${s('quoteBy')}</p></blockquote></div><h2 class="eyebrow rule-top" ${enter(1)}>${s('heading')}</h2>${stats}${logos}`,
    `.q { grid-template-columns:minmax(0,3fr) minmax(0,9fr); align-items:start; margin-bottom:var(--ds-space-8); }.mark::before { content:"\\201C"; display:block; font-size:var(--ds-type-colossal); line-height:.8; color:var(--ds-color-teal); }.by { font-family:var(--ds-font-body); font-size:var(--ds-type-note); color:var(--ds-color-ink-2); letter-spacing:0; margin-top:var(--ds-space-4); }.stats { display:flex; flex-wrap:wrap; gap:var(--ds-space-5) var(--ds-space-8); margin:var(--ds-space-5) 0 var(--ds-space-7); }.stat dt { font-size:var(--ds-type-title); font-family:var(--ds-font-serif); font-weight:300; letter-spacing:-.03em; line-height:1; }.stat dd { font-size:var(--ds-type-note); color:var(--ds-color-ink-2); }${logoCSS}@media(max-width:860px){.q{grid-template-columns:1fr;}.mark::before{font-size:var(--ds-type-display);}.stat dt{font-size:var(--ds-type-head);}}`
  ),
  'process/buzhou': section(
    `<h2 class="serif t-head" ${enter(0)}>${s('heading')}</h2><ol class="steps" data-ds-stagger="line">{% for step in slots.steps %}<li ${enter('{{ forloop.index0 }}')}><span class="n serif">{{ forloop.index }}</span><h3>{{ step }}</h3><p>{{ slots.stepNotes[forloop.index0] }}</p></li>{% endfor %}</ol>`,
    `.steps { display:grid; grid-auto-flow:column; grid-auto-columns:minmax(0,1fr); gap:var(--ds-space-5); margin-top:var(--ds-space-7); }.steps li:nth-child(even) { margin-top:var(--ds-space-7); }.steps li { border-top:1px solid var(--ds-color-ink); padding-top:var(--ds-space-4); display:grid; gap:var(--ds-space-2); align-content:start; }.n { font-size:var(--ds-type-head); color:var(--ds-color-teal); line-height:1; }.steps h3 { font-size:var(--ds-type-lead); font-weight:400; }.steps p { color:var(--ds-color-ink-2); font-size:var(--ds-type-note); }@media(max-width:860px){.steps{grid-auto-flow:row;}.steps li:nth-child(even){margin-top:0;}}`
  ),
  'process/zongzhou': section(
    `<div class="split axis"><h2 class="serif t-head" ${enter(0)}>${s('heading')}</h2>${rows('steps', 'stepNotes')}</div>`,
    `.axis { align-items:start; }${rowCSS}.rows { border-top:0; border-left:1px solid var(--ds-color-ink); padding-left:var(--ds-space-5); }.row { grid-template-columns:var(--ds-space-7) minmax(0,1fr); border-bottom:0; }.row p { grid-column:2; }`
  ),
  'cta/yunkai': section(
    `<div id="action" class="cta"><h2 class="serif t-title" ${enter(0)}>${s('headline')}</h2><p class="lead" ${enter(1)}>${s('lead')}</p><div class="actions" ${enter(2)}>${button(s('action'), '#top')}</div><p class="note" ${enter(3)}>${s('note')}</p></div>`,
    `.cta { display:grid; gap:var(--ds-space-5); justify-items:center; text-align:center; max-width:28em; margin:0 auto; }`
  ),
  'cta/mianban': section(
    `<div id="action" class="panel"><div class="stack"><h2 class="serif t-head" ${enter(0)}>${s('headline')}</h2><p class="body" ${enter(1)}>${s('lead')}</p><p class="note" ${enter(3)}>${s('note')}</p></div><div class="actions" ${enter(2)}>${button(s('action'), '#top')}</div></div>`,
    `.panel { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:var(--ds-space-7); align-items:center; background:var(--ds-color-sage); border-radius:var(--ds-radius-panel); padding:var(--ds-space-8); }.panel .note { color:var(--ds-color-ink-2); }@media(max-width:860px){.panel{grid-template-columns:1fr;padding:var(--ds-space-6);}}`
  ),
  'footer/zhanting': footer(true),
  'footer/qianjian': footer(false),
};

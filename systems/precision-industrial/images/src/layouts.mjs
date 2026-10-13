/*
 * Generates the sixteen web layout fragments and the shared aluminium vocabulary used by custom works.
 * Layout variants change the reading structure (split sheet / full figure / table / vertical record), not just alignment.
 * CSS uses the design/ind token vocabulary, paper-editorial's existing 1240px content width and 860px breakpoint.
 * The surface is a deterministic horizontal SVG engraving at the declared grain ceiling; a pair of hairlines expresses machined edges.
 * TODO(design): confirm the two per-unit variants and the chosen section density; no new visual token values are introduced here.
 */
import { HEX } from './lib/palette.mjs';

const brush = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="8"><path d="M0 1H240M0 5H240" stroke="${HEX['ink-2']}" stroke-width="1"/></svg>`);

export const surface = () => `
:scope{position:relative;box-sizing:border-box;background:var(--ds-color-alu);color:var(--ds-color-ink);font-family:var(--ds-font-body);font-size:var(--ds-type-body);font-weight:400;font-variant-numeric:tabular-nums lining-nums;line-height:1.7;padding:var(--ds-space-9) var(--ds-space-8);border-top:1px solid var(--ds-color-edge-hi);border-bottom:1px solid var(--ds-color-edge-lo)}
:scope::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:var(--ds-grain-max);background-image:url("data:image/svg+xml,${brush}")}
:scope *{box-sizing:border-box;min-width:0}
h1,h2,h3,p,figure,figcaption,blockquote,dl,dt,dd,ul,ol,li{margin:0;padding:0}
ul,ol{list-style:none}
a{color:inherit;text-decoration:none}
.wrap{max-width:1240px;margin:0 auto;position:relative}
.split{display:grid;grid-template-columns:minmax(0,4fr) minmax(0,7fr);gap:var(--ds-space-8);align-items:start}
.tag{font-family:var(--ds-font-mono);font-size:var(--ds-type-note);color:var(--ds-color-ink-2);letter-spacing:.06em}
.heading{font-family:var(--ds-font-cjk-strong);font-weight:700;font-size:var(--ds-type-head);line-height:1.35;letter-spacing:0;text-wrap:balance}
.title{font-family:var(--ds-font-cjk-strong);font-weight:700;font-size:var(--ds-type-display);line-height:1.16;letter-spacing:0;text-wrap:balance}
.body{color:var(--ds-color-ink-2);text-wrap:pretty;max-width:38em}
.lead{font-size:var(--ds-type-lead);color:var(--ds-color-ink-2);text-wrap:pretty}
.stack>*+*{margin-top:var(--ds-space-5)}
.drawing{position:relative;padding:var(--ds-space-3);border:1px solid var(--ds-color-rule)}
.drawing img,.drawing>svg{display:block;width:100%;height:auto}
.drawing figcaption{font-family:var(--ds-font-mono);font-size:var(--ds-type-note);color:var(--ds-color-ink-2);margin-top:var(--ds-space-3)}
.bevel{background:var(--ds-color-alu-light);border-top:1px solid var(--ds-color-edge-hi);border-left:1px solid var(--ds-color-edge-hi);border-right:1px solid var(--ds-color-edge-lo);border-bottom:1px solid var(--ds-color-edge-lo);padding:var(--ds-space-4)}
.key{position:relative;display:inline-block;background:var(--ds-color-alu-light);border-top:1px solid var(--ds-color-edge-hi);border-left:1px solid var(--ds-color-edge-hi);border-right:1px solid var(--ds-color-edge-lo);border-bottom:1px solid var(--ds-color-edge-lo);outline:1px solid var(--ds-color-ink-2);font-family:var(--ds-font-mono);font-size:var(--ds-type-body);padding:var(--ds-space-3) var(--ds-space-5);border-radius:0}
.key::before{content:"";display:inline-block;width:var(--ds-space-1);height:var(--ds-space-1);margin-right:var(--ds-space-3);background:var(--ds-color-signal);opacity:.5;transition:opacity var(--ds-duration-tick) var(--ds-easing-fade)}
.key:hover::before,.key:focus-visible::before{opacity:1}
.key:focus-visible{outline:2px solid var(--ds-color-ink)}
.table{border-top:2px solid var(--ds-color-ink)}
.table>li,.table>div{display:grid;grid-template-columns:var(--ds-space-8) minmax(0,3fr) minmax(0,5fr);gap:var(--ds-space-5);align-items:baseline;padding:var(--ds-space-4) 0;border-bottom:1px solid var(--ds-color-rule)}
.table h3{font-size:var(--ds-type-lead);font-family:var(--ds-font-body);font-weight:400;line-height:1.5}
.table p{color:var(--ds-color-ink-2);text-wrap:pretty}
.index{font-family:var(--ds-font-num);font-size:var(--ds-type-note);font-weight:500;color:var(--ds-color-ink-2);font-variant-numeric:tabular-nums lining-nums}
.numbers>div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--ds-space-4);padding:var(--ds-space-4) 0;border-bottom:1px solid var(--ds-color-rule);align-items:baseline}
.numbers dt{color:var(--ds-color-ink-2)}
.numbers dd{font-family:var(--ds-font-num);font-weight:500;font-size:var(--ds-type-head);font-variant-numeric:tabular-nums lining-nums;white-space:nowrap}
.logos{display:flex;flex-wrap:wrap;gap:var(--ds-space-4) var(--ds-space-5);margin-top:var(--ds-space-7);padding-top:var(--ds-space-5);border-top:1px solid var(--ds-color-rule)}
.logos img{width:auto;height:var(--ds-space-6);max-width:100%}
.nav{display:flex;flex-wrap:wrap;gap:var(--ds-space-3) var(--ds-space-5);font-size:var(--ds-type-note)}
.nav a{text-decoration:underline;text-underline-offset:.2em}
.heading+.body{margin-top:var(--ds-space-5)}
.heading+.table,.heading+.numbers{margin-top:var(--ds-space-7)}
@media(max-width:860px){:scope{padding:var(--ds-space-8) var(--ds-space-5)}.split{grid-template-columns:minmax(0,1fr);gap:var(--ds-space-6)}.title{font-size:var(--ds-type-head)}.heading{font-size:var(--ds-type-sub)}.lead{font-size:var(--ds-type-body)}.table>li,.table>div{grid-template-columns:var(--ds-space-5) minmax(0,1fr);gap:var(--ds-space-2) var(--ds-space-3)}.table p{grid-column:2}.numbers dd{font-size:var(--ds-type-sub)}}
@media(prefers-reduced-motion:reduce){.key::before{transition:none}}
`;

export const enter = (order = 0, effect = 'rise') => `data-ds-enter="${effect}" data-ds-step="${effect === 'fade' ? 'snap' : 'slide'}" data-ds-ease="${effect === 'fade' ? 'fade' : 'snap'}" data-ds-distance="2" data-ds-order="${order}"`;

export function fragment(css, html) {
  return `<style>\n${surface()}\n${css}\n</style>\n${html}\n`;
}

const heading = (tag) => `<div class="stack" ${enter(0)}><p class="tag">${tag} / KRO-1600 · REV.A</p><h2 class="heading">{{ slots.heading }}</h2></div>`;
const features = `<ol class="table" data-ds-stagger="tick">{% for title in slots.itemTitles %}<li ${enter('{{ forloop.index0 }}','fade')}><span class="index">{{ forloop.index }}</span><h3>{{ title }}</h3><p>{{ slots.itemBodies[forloop.index0] }}</p></li>{% endfor %}</ol>`;
const points = `<ol class="checks" data-ds-stagger="tick">{% for point in slots.points %}<li ${enter('{{ forloop.index0 }}','fade')}><span class="index">{{ forloop.index }}</span><p>{{ point }}</p></li>{% endfor %}</ol>`;
const numbers = `<dl class="numbers" data-ds-stagger="tick">{% for stat in slots.stats %}<div ${enter('{{ forloop.index0 }}','fade')}><dt>{{ slots.statLabels[forloop.index0] }}</dt><dd>{{ stat }}</dd></div>{% endfor %}</dl>`;
const logos = `<div class="logos" ${enter(5,'fade')}>{% for logo in slots.logos %}{{ logo }}{% endfor %}</div>`;
const quote = `<div class="stack" ${enter(1,'fade')}><blockquote class="lead">{{ slots.quote }}</blockquote><p class="tag">{{ slots.quoteBy }}</p></div>`;
const steps = `<ol class="table" data-ds-stagger="tick">{% for step in slots.steps %}<li ${enter('{{ forloop.index0 }}','fade')}><span class="index">{{ forloop.index }}</span><h3>{{ step }}</h3><p>{{ slots.stepNotes[forloop.index0] }}</p></li>{% endfor %}</ol>`;
const action = `<div class="stack" ${enter(1,'fade')}><a class="key" href="https://kestrelridge.example/book">{{ slots.action }}</a><p class="tag">{{ slots.note }}</p></div>`;
const links = `<nav class="nav" aria-label="页脚导航">{% for link in slots.links %}<a href="#document-top">{{ link }}</a>{% endfor %}</nav>`;

export function layouts() {
  const result = {};
  const add = (unit, name, css, html) => { result[`${unit}/${name}`] = `{% comment %}Generated by images/src/build.mjs; edit images/src/layouts.mjs. ${unit}/${name}: aluminium technical sheet, token-only values, explicit per-row stagger.{% endcomment %}\n${fragment(css, `<div class="wrap">${html}</div>`)}`; };
  const hero = `<div class="stack" ${enter(0)}><p class="tag">{{ slots.eyebrow }} / KRO-1600 · REV.A</p><h1 class="title">{{ slots.headline }}</h1><p class="lead">{{ slots.lead }}</p><a class="key" href="https://kestrelridge.example/book">{{ slots.cta }}</a></div><figure class="drawing" ${enter(2,'fade')}>{{ slots.visual }}<figcaption>FIG.01 / DOME / SCHEMATIC</figcaption></figure>`;
  add('hero','tuzhi',':scope{min-height:100vh}.split{align-items:center}.sheet-title{margin-top:var(--ds-space-7)}',`<div class="split">${hero}</div><p class="bevel tag sheet-title" ${enter(3,'fade')}>KRO-1600 / PRODUCT DATA SHEET / REV.A</p>`);
  add('hero','mingpai','.cover{display:grid;gap:var(--ds-space-7)}.cover>.stack{border-top:2px solid var(--ds-color-ink);padding-top:var(--ds-space-5)}.cover>.drawing{max-width:860px}',`<div class="cover">${hero}</div>`);
  const checkCss = '.checks{border-top:2px solid var(--ds-color-ink)}.checks li{display:grid;grid-template-columns:var(--ds-space-5) minmax(0,1fr);gap:var(--ds-space-3);padding:var(--ds-space-4) 0;border-bottom:1px solid var(--ds-color-rule)}';
  add('problem','duizhao',checkCss,`<div class="split"><div class="stack">${heading('01 / LIMITS')}<p class="body" ${enter(1,'fade')}>{{ slots.body }}</p></div>${points}</div>`);
  add('problem','jianyan',`${checkCss}.record{max-width:860px}.record>.body{margin-block:var(--ds-space-6)}.checks{border-left:1px solid var(--ds-color-rule);padding-left:var(--ds-space-5)}`,`<div class="record">${heading('01 / INSPECTION')}<p class="body" ${enter(1,'fade')}>{{ slots.body }}</p>${points}</div>`);
  const solution = `<div class="stack">${heading('02 / ASSEMBLY')}<p class="body" ${enter(1,'fade')}>{{ slots.body }}</p></div><figure class="drawing" ${enter(2,'fade')}>{{ slots.visual }}<figcaption>FIG.02 / PRIMARY MIRROR / SCHEMATIC</figcaption></figure>`;
  add('solution','poumian','',`<div class="split">${solution}</div>`);
  add('solution','zongtu','.full{display:flex;flex-direction:column-reverse;gap:var(--ds-space-6)}.full>.stack{display:grid;grid-template-columns:minmax(0,4fr) minmax(0,7fr);gap:var(--ds-space-6)}@media(max-width:860px){.full>.stack{grid-template-columns:minmax(0,1fr)}}',`<div class="full">${solution}</div>`);
  add('features','canshu','.specs{margin-top:var(--ds-space-6)}.intro{display:flex;align-items:baseline;gap:var(--ds-space-8);flex-wrap:wrap}',`<div class="intro">${heading('03 / SPECIFICATIONS')}<p class="body" ${enter(1,'fade')}>{{ slots.lead }}</p></div><div class="specs">${features}</div>`);
  add('features','biaozhu','.table>li{grid-template-columns:var(--ds-space-5) minmax(0,1fr)}.table p{grid-column:2}',`<div class="split"><div class="stack">${heading('03 / ANNOTATIONS')}<p class="body" ${enter(1,'fade')}>{{ slots.lead }}</p></div>${features}</div>`);
  add('evidence','jiance','',`<div class="split"><div class="stack">${heading('04 / VERIFICATION')}${quote}</div>${numbers}</div>${logos}`);
  add('evidence','dushu','.numbers{margin-block:var(--ds-space-6)}.numbers>div{grid-template-columns:auto minmax(0,1fr)}.numbers dd{grid-column:1;grid-row:1;font-size:var(--ds-type-display)}.numbers dt{grid-column:2;grid-row:1}.statement{max-width:860px}@media(max-width:860px){.numbers dd{font-size:var(--ds-type-head)}}',`${heading('04 / READINGS')}${numbers}<div class="statement">${quote}</div>${logos}`);
  add('process','gongxu','.operations{margin-top:var(--ds-space-7)}',`${heading('05 / BUILD RECORD')}<div class="operations">${steps}</div>`);
  add('process','licheng','.table{border-top:0;border-left:1px solid var(--ds-color-rule);padding-left:var(--ds-space-5)}.table>li{grid-template-columns:var(--ds-space-5) minmax(0,1fr);border-bottom:0;padding-block:var(--ds-space-5)}.table p{grid-column:2}',`<div class="split">${heading('05 / MILESTONES')}${steps}</div>`);
  const cta = `<div class="stack" ${enter(0)}><p class="tag">06 / RELEASE / REV.A</p><h2 class="heading">{{ slots.headline }}</h2><p class="lead">{{ slots.lead }}</p></div>${action}`;
  add('cta','mingban','.split{align-items:center;border-top:2px solid var(--ds-color-ink);padding-top:var(--ds-space-7)}',`<div class="split" id="booking">${cta}</div>`);
  add('cta','qianfa','.release{max-width:860px}.release>.stack+.stack{margin-top:var(--ds-space-6);padding-top:var(--ds-space-5);border-top:1px solid var(--ds-color-rule)}',`<div class="release">${cta}</div>`);
  const footer = `<h2 class="heading">{{ slots.brand }}</h2>${links}<p class="body tag">{{ slots.legal }}</p><p class="tag">KRO-1600 / REV.A / END OF DOCUMENT</p>`;
  add('footer','tulan',':scope{padding-block:var(--ds-space-6)}.foot{display:grid;grid-template-columns:minmax(0,4fr) minmax(0,7fr);gap:var(--ds-space-5)}.foot>.body{grid-column:1/-1;max-width:none}@media(max-width:860px){.foot{grid-template-columns:minmax(0,1fr)}}',`<div class="foot" ${enter(0,'fade')}>${footer}</div>`);
  add('footer','banben',':scope{padding-block:var(--ds-space-6)}.foot{border-top:1px solid var(--ds-color-edge-hi);border-bottom:1px solid var(--ds-color-edge-lo);padding-block:var(--ds-space-5)}',`<div class="foot stack" ${enter(0,'fade')}>${footer}</div>`);
  return result;
}

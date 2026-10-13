/*
 * Sixteen reusable web layouts, two per shared narrative unit. build.mjs writes layouts/web/<unit>/<id>.liquid.
 * Layout content uses only declared shared slots; scoped styles use the common riso token vocabulary.
 * TODO(design): confirm the compact pink-overprint heading bands and large blue numbering; review unused alternatives in the generated layout overview, especially the dense evidence press sheet.
 */
import { enter, section } from './common.mjs';
const s = (name) => `{{ slots.${name} }}`;
const stripe = '<div class="stripe" aria-hidden="true"></div>';
const heading = (name = 'heading', printed = false) => `<h2 class="heading${printed ? ' print-heading' : ''}" ${enter()}>${s(name)}</h2>`;
const phraseHeading = `<h2 class="heading print-heading" data-ds-slot="heading" ${enter()}>{% assign phrases = slots.heading.html | strip_html | split: '，' %}{% for phrase in phrases %}<span class="heading-phrase">{{ phrase }}{% unless forloop.last %}，{% endunless %}</span>{% endfor %}</h2>`;
const image = (name = 'visual') => `<figure ${enter(2, 'left', 'roll')}>${s(name)}</figure>`;
const stamp = (name) => `<a class="stamp" href="https://kestrelridge.example/book" ${enter(3,'stamp','press','press','roll')}>${s(name)}</a>`;
const rows = (titles,bodies) => `<ol class="rows" data-ds-stagger="line">{% for item in slots.${titles} %}<li class="row" ${enter('{{ forloop.index0 }}','left')}><span class="num">{{ forloop.index | prepend: '0' }}</span><h3>{{ item }}</h3><p>{{ slots.${bodies}[forloop.index0] }}</p></li>{% endfor %}</ol>`;
const logos = `<div class="logos">{% for logo in slots.logos %}{{ logo }}{% endfor %}</div>`;
const quote = `<blockquote>${s('quote')}<p class="cite">${s('quoteBy')}</p></blockquote>`;
const stats = `<dl class="stats">{% for stat in slots.stats %}<div><dt class="num">{{ stat }}</dt><dd>{{ slots.statLabels[forloop.index0] }}</dd></div>{% endfor %}</dl>`;
const statCSS = `.stats { display:grid; grid-template-columns:1fr 1fr; gap:var(--ds-space-6); }.stats dt { font-size:var(--ds-type-head); font-weight:700; }.stats dd { font-size:var(--ds-type-note); }`;
const hero = (block) => section(`<p class="kicker">${s('eyebrow')}</p><div class="split"><div class="stack"><h1 ${enter()} class="hero-title">${s('headline')}</h1><p class="lead" ${enter(1)}>${s('lead')}</p>${stamp('cta')}</div>${image()}</div>`, `.hero-title{font-size:var(--ds-type-title);font-family:var(--ds-font-cjk-strong);font-weight:700;line-height:1.16;text-wrap:balance;} ${block ? ':scope{border-top:var(--ds-space-5) solid var(--ds-color-pink);}.hero-title{background:var(--ds-color-blue);color:var(--ds-color-paper);padding:var(--ds-space-5);}' : ''}@media(max-width:860px){.hero-title{font-size:var(--ds-type-title);}}`);
const footer = (colophon) => section(`<div class="${colophon ? 'split' : 'stack'}"><h2 class="heading">${s('brand')}</h2><div class="stack"><nav class="links">{% for link in slots.links %}<a href="{% case forloop.index0 %}{% when 0 %}https://kestrelridge.example/book{% when 1 %}#riso-solution{% when 2 %}#riso-process{% when 3 %}#riso-calendar{% when 4 %}#riso-night{% else %}https://kestrelridge.example{% endcase %}">{{ link }}</a>{% endfor %}</nav><p class="note">${s('legal')}</p></div></div>`,`:scope{background:var(--ds-color-paper-deep);border-top:${colophon ? '6px' : '2px'} solid var(--ds-color-blue);}.links{display:flex;flex-wrap:wrap;gap:var(--ds-space-4);}`);
export const LAYOUTS = {
 'hero/haibao': hero(false),
 'hero/kuaiyin': hero(true),
 'problem/duizhao': section(`${phraseHeading}<div class="split"><p class="body" ${enter(1)}>${s('body')}</p><ul class="points">{% for point in slots.points %}<li ${enter('{{ forloop.index0 }}','left')}>{{ point }}</li>{% endfor %}</ul></div>`,`.heading-phrase{display:inline-block;}.points li{border-bottom:2px solid var(--ds-color-blue);padding:var(--ds-space-4) 0;font-size:var(--ds-type-body);font-weight:700;}`),
 'problem/jiulan': section(`<div class="split"><div class="stack">${heading()}<p class="body" ${enter(1)}>${s('body')}</p></div><ul class="old">{% for point in slots.points %}<li ${enter('{{ forloop.index0 }}','left')}>{{ point }}</li>{% endfor %}</ul></div>`,`.old{border:6px solid var(--ds-color-blue);padding:var(--ds-space-6);}.old li{padding:var(--ds-space-4) 0;border-bottom:2px solid var(--ds-color-blue);}`),
 'solution/fense': section(`<div id="riso-solution" class="split">${image()}<div class="stack">${heading()}<p class="lead" ${enter(1)}>${s('body')}</p></div></div>`),
 'solution/zhengban': section(`${heading()}${stripe}${image()}<p class="lead" ${enter(3)}>${s('body')}</p>`,`.lead{margin-top:var(--ds-space-6);max-width:40em;}figure{max-width:860px;}`),
 'features/canshu': section(`${heading('heading',true)}<p class="lead" ${enter(1)}>${s('lead')}</p>${stripe}${rows('itemTitles','itemBodies')}`),
 'features/fenlan': section(`<div class="split"><div class="stack">${heading()}<p class="lead">${s('lead')}</p></div>${rows('itemTitles','itemBodies')}</div>`,`.row{grid-template-columns:var(--ds-space-8) minmax(0,1fr);}.row p{grid-column:2;}`),
 'evidence/yanzheng': section(`${heading()}${stripe}<div class="split">${stats}${quote}</div><div class="partners">${logos}</div>`,`${statCSS}.partners{margin-top:var(--ds-space-8);}`),
 'evidence/yinzheng': section(`<div class="stack">${heading()}${quote}${stats}${logos}</div>`,`${statCSS}blockquote{font-size:var(--ds-type-head);font-weight:700;}.stats{border-top:2px solid var(--ds-color-blue);padding-top:var(--ds-space-6);}@media(max-width:860px){blockquote{font-size:var(--ds-type-sub);}}`),
 'process/jindu': section(`<div id="riso-process">${heading('heading',true)}${rows('steps','stepNotes')}</div>`),
 'process/licheng': section(`<div class="split"><div>${heading()}</div>${rows('steps','stepNotes')}</div>`,`.row{grid-template-columns:var(--ds-space-8) minmax(0,1fr);}.row p{grid-column:2;}.rows{border-left:6px solid var(--ds-color-blue);padding-left:var(--ds-space-5);}`),
 'cta/yuanzhang': section(`<div class="split"><div class="stack">${heading('headline')}<p class="lead" ${enter(1)}>${s('lead')}</p><p class="note" ${enter(2)}>${s('note')}</p></div>${stamp('action')}</div>`,`.stamp{justify-self:center;width:var(--ds-space-11);height:var(--ds-space-11);}`),
 'cta/piaogen': section(`<div class="stack">${heading('headline')}<p class="lead" ${enter(1)}>${s('lead')}</p><p class="note" ${enter(2)}>${s('note')}</p>${stamp('action')}</div>`,`:scope{border-top:6px solid var(--ds-color-blue);}.wrap{border-left:2px dashed var(--ds-color-blue);padding-left:var(--ds-space-6);}`),
 'footer/banji': footer(true),
 'footer/mowei': footer(false)
};

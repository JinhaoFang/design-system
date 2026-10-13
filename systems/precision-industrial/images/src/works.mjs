/*
 * Custom KRO-1600 product datasheet: cover with a distinct optical diagram, one backlit dial, and two appendix figures.
 * Shared copy and image briefs are read from library/content; only the authorized part number, revision and figure labels are added.
 * The dial maps the known 1.6 m aperture onto a clearly illustrative 0-2 m scale, without claiming a product operating range.
 * Custom illustrations are embedded as SVG because build only copies images referenced through structured slots, not arbitrary fragment URLs.
 * Each arc group includes an unpainted full-viewBox rectangle so all six segments enter one scroll batch instead of following their individual bounding boxes.
 * The dial sheet fades in as one ordinary entrance and finishes by 320 ms; cyan segments wait 480 ms and then light in six 40 ms steps.
 * Static and reduced-motion behavior comes from the shared entrance runtime; no custom animation or persistent scrolling script.
 * The cover title block contains only document identifiers and the known inauguration date; the unreadable dome thumbnail is removed.
 * TODO(design): confirm the retained dial scale and the title-block labels.
 */
import { readFileSync } from 'node:fs';
import { optical } from './art/drawings.mjs';
import { VAR } from './lib/palette.mjs';
import { f } from './lib/random.mjs';
import { fragment, enter, nameplate } from './layouts.mjs';

const web = JSON.parse(readFileSync(new URL('../../../../library/content/web.json', import.meta.url), 'utf8'));
const briefs = JSON.parse(readFileSync(new URL('../../../../library/content/images.json', import.meta.url), 'utf8'));
const esc = (s) => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const text = (key) => esc(web[key]);
const image = (id) => readFileSync(new URL(`../${id}.svg`,import.meta.url),'utf8').replace('role="img"',`role="img" data-ds-image="${id}" aria-label="${esc(briefs[id].alt)}"`);

function cover() {
  const drawing = optical(VAR);
  const css = `:scope{min-height:100vh;padding-top:0}.doc-head{display:flex;flex-wrap:wrap;justify-content:space-between;gap:var(--ds-space-2) var(--ds-space-6);padding:var(--ds-space-5) 0;border-bottom:2px solid var(--ds-color-ink)}.cover-main{margin-top:var(--ds-space-7);display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:var(--ds-space-7);align-items:center}.part{font-family:var(--ds-font-num-strong);font-size:var(--ds-type-display);font-weight:700;line-height:1.1;letter-spacing:-.04em}.title{font-size:var(--ds-type-head)}.lead{font-size:var(--ds-type-body)}.cover-main .drawing{border:0;padding:0}.title-block{margin-top:var(--ds-space-7);padding:0;display:grid;grid-template-columns:minmax(0,1fr) var(--ds-space-10) minmax(0,1fr) minmax(0,2fr);border-top:2px solid var(--ds-color-ink);box-shadow:var(--ds-shadow-plate)}.title-block>div{padding:var(--ds-space-4);border-right:1px solid var(--ds-color-rule)}.title-block>div:last-child{border-right:0}.title-block dt{font-size:var(--ds-type-caption);color:var(--ds-color-ink-2)}.title-block dd{margin-top:var(--ds-space-2);color:var(--ds-color-ink)}.optical-key{display:flex;flex-wrap:wrap;gap:var(--ds-space-2) var(--ds-space-4);margin-top:var(--ds-space-3)}@media(max-width:860px){.cover-main{grid-template-columns:minmax(0,1fr);gap:var(--ds-space-6);margin-top:var(--ds-space-6)}.part{font-size:var(--ds-type-title)}.title{font-size:var(--ds-type-sub)}.title-block{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.title-block>div{padding:var(--ds-space-3);border-bottom:1px solid var(--ds-color-rule)}.title-block>div:nth-child(even){border-right:0}.title-block>div:nth-child(n+3){border-bottom:0}.doc-head{font-size:var(--ds-type-caption)}}`;
  const html = `<div class="wrap" id="document-top"><header class="doc-head tag" ${enter(2,'fade')}><span>鹞岭天文台 / PRODUCT DATA SHEET</span><span>PART NO. KRO-1600 / REV.A</span></header>
<div class="cover-main"><div class="stack"><p class="part" ${enter(0)}>KRO-1600</p><h1 class="title" ${enter(0)}>${text('hero.headline')}</h1><p class="lead" ${enter(1,'fade')}>${text('hero.lead')}</p><p ${enter(2,'fade')}>${nameplate(text('hero.cta'),'#booking')}</p></div>
<figure class="drawing" ${enter(1,'fade')}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${drawing.w} ${drawing.h}" role="img" aria-label="卡塞格林结构示意：来光经凹面主镜反射到凸面副镜，再穿过主镜中心孔到后方焦点；主镜口径 1600 毫米，几何未按比例">${drawing.body}</svg><figcaption>FIG.00 / CASSEGRAIN / 示意 · NTS<div class="optical-key"><span>凹面主镜</span><span>凸面副镜</span><span>中心孔 → 后方焦点</span></div></figcaption></figure></div>
<dl class="title-block bevel tag" ${enter(3,'fade')}><div><dt>PART NO. / 零件号</dt><dd>KRO-1600</dd></div><div><dt>REV. / 版次</dt><dd>A</dd></div><div><dt>DATE / 落成日期</dt><dd>2026.11.14</dd></div><div><dt>APPLICATION / 用途</dt><dd>新镜落成与公众观测夜</dd></div></dl></div>`;
  return fragment(css,html);
}

const point = (angle,r) => [360+Math.cos(angle*Math.PI/180)*r,350+Math.sin(angle*Math.PI/180)*r];
const arc = (start,end,r) => {const a=point(start,r), b=point(end,r);return `M${f(a[0])} ${f(a[1])}A${r} ${r} 0 ${end-start>180?1:0} 1 ${f(b[0])} ${f(b[1])}`;};

function dial() {
  let ticks = '';
  for(let i=0;i<=40;i+=1){const angle=-210+i*6;const a=point(angle,i%5===0?278:288),b=point(angle,304);ticks+=`<path d="M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}"/>`;}
  const segments = Array.from({length:6},(_,i)=>`<g data-ds-enter="fade" data-ds-wait="settle" data-ds-step="tick" data-ds-ease="fade" data-ds-order="${i}"><rect width="720" height="680" fill="none"/><path d="${arc(-210+i*32,-210+(i+1)*32-2,260)}" fill="none" stroke="var(--ds-color-backlight)" stroke-width="4"/></g>`).join('');
  const tip=point(-18,276),tail=point(-18,190);
  const css = `:scope{background:var(--ds-color-graphite);color:var(--ds-color-glow);min-height:100vh;display:flex;align-items:center;border-color:var(--ds-color-graphite-line);padding-block:var(--ds-space-8)}:scope::after{display:none}:scope::before{border-color:var(--ds-color-graphite-line)}.dial-sheet{width:100%;display:grid;grid-template-columns:minmax(0,4fr) minmax(0,7fr);gap:var(--ds-space-8);align-items:center}.tag,.body{color:var(--ds-color-glow-2)}.heading{font-size:var(--ds-type-head)}.dial{position:relative;max-width:720px;width:100%}.dial svg{display:block;width:100%;height:auto}.reading{position:absolute;left:0;right:0;top:36%;text-align:center;font-family:var(--ds-font-num-strong);font-size:var(--ds-type-colossal);font-weight:700;line-height:1;color:var(--ds-color-backlight);font-variant-numeric:tabular-nums lining-nums;letter-spacing:-.04em}.unit{display:block;font-family:var(--ds-font-mono);font-weight:400;font-size:var(--ds-type-lead);letter-spacing:.1em;margin-top:var(--ds-space-3);color:var(--ds-color-glow-2)}.zero,.limit{position:absolute;bottom:14%;font-family:var(--ds-font-num);font-size:var(--ds-type-note);color:var(--ds-color-glow-2)}.zero{left:8%}.limit{right:8%}.cal{margin-top:var(--ds-space-4);text-align:center;color:var(--ds-color-glow-2)}@media(max-width:860px){.dial-sheet{grid-template-columns:minmax(0,1fr);gap:var(--ds-space-6)}.reading{font-size:var(--ds-type-display)}.heading{font-size:var(--ds-type-sub)}}`;
  const html = `<div class="wrap dial-sheet" data-ds-enter="fade" data-ds-step="slide" data-ds-ease="fade" data-ds-order="0"><div class="stack"><p class="tag">KRO-1600 / APERTURE</p><h2 class="heading">主镜口径</h2><p class="body">集光面积约为旧镜的 7 倍。累积曝光的极限星等，从 22 等提高到 24 等。</p><p class="tag">2025—2026 / 首光之后一年试观测</p></div>
<div><div class="dial"><svg viewBox="0 0 720 680" role="img" aria-label="口径表盘，读数 1.6 米，刻度从零到 2 米，仅作口径示意"><g fill="none" stroke="var(--ds-color-glow-3)" stroke-width="1">${ticks}<path d="${arc(-210,30,260)}" stroke="var(--ds-color-graphite-line)"/></g><g data-ds-stagger="tick">${segments}</g><g data-ds-enter="fade" data-ds-wait="settle" data-ds-order="5" data-ds-step="snap" data-ds-ease="fade"><rect width="720" height="680" fill="none"/><path d="M${f(tail[0])} ${f(tail[1])}L${f(tip[0])} ${f(tip[1])}" fill="none" stroke="var(--ds-color-backlight)" stroke-width="3"/></g></svg><p class="reading" data-ds-enter="fade" data-ds-wait="settle" data-ds-order="5" data-ds-step="snap" data-ds-ease="fade">1.6<span class="unit">m / 主镜口径</span></p><span class="zero">0</span><span class="limit">2 m</span></div><p class="tag cal">FIG.03 / 口径示意，非量程声明</p></div></div>`;
  return fragment(css,html);
}

function appendices() {
  return fragment('.appendix{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:var(--ds-space-8)}.appendix .heading{font-size:var(--ds-type-sub)}@media(max-width:860px){.appendix{grid-template-columns:minmax(0,1fr);gap:var(--ds-space-7)}}',`<div class="wrap appendix"><div class="stack" ${enter(0,'fade')}><p class="tag">APPENDIX A / LOGISTICS</p><h2 class="heading">主镜走过的路</h2><figure class="drawing">${image('summit-road')}<figcaption>FIG.04 / 38 公里运输路线示意</figcaption></figure><p class="body">鹿溪镇至山顶，沿 38 公里盘山路上山，车程约 1 小时 10 分。海拔 2,860 米。</p></div><div class="stack" ${enter(1,'fade')}><p class="tag">APPENDIX B / OPERATION</p><h2 class="heading">从仪器到眼睛</h2><figure class="drawing">${image('eyepiece-night')}<figcaption>FIG.05 / 目镜与访客站位示意</figcaption></figure><p class="body">访客在目镜前轮流观看，志愿者在旁讲解；山顶只用红光照明。</p></div></div>`);
}

export function works() {
  return {'datasheet-cover':cover(),'aperture-backlight':dial(),'field-appendices':appendices()};
}

export function systemHeader() {
  return `{% comment %}Generated precision-industrial system-page header; edit images/src/works.mjs. Bevelled aluminium nameplate, no cyan outside the work's unique backlit screen.{% endcomment %}\n${fragment(':scope{padding:var(--ds-space-6)}.header{display:flex;justify-content:space-between;flex-wrap:wrap;gap:var(--ds-space-6);align-items:end}.heading{font-size:var(--ds-type-title)}@media(max-width:860px){.heading{font-size:var(--ds-type-head)}}',`<div class="bevel header"><div class="stack"><p class="tag">DESIGN SYSTEM / {{ system.id }}</p><h1 class="heading">{{ system.name }}</h1><p class="body">{{ system.materialAnchor }}</p></div><p class="tag">WEB / REV.A</p></div>`)}`;
}

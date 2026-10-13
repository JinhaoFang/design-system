/*
 * Three generated web fragments: opening two-ink poster, full-bleed observing scene, eight dated moon-phase tickets.
 * Uses shared sample copy and the established SETTING dates. Pink title plate is outlined from the approved display font,
 * decorative and aria-hidden; semantic blue text stays live and readable. Both plates use the same glyph advances/baselines.
 * Moon phases reuse paper-editorial's date-based model: new moon 2026-11-09 07:00 UTC, mean synodic month 29.530589 days,
 * evaluated at 13:00 UTC (21:00 China); approximate northern-hemisphere illumination, not a booking/weather prediction.
 * TODO(design): confirm poster line breaks, full-bleed scene crop and approximate moon-phase presentation.
 */
import { readFileSync } from 'node:fs';
import { baseline, textPath } from '../lib/glyphs.mjs';
import { HEX, dotField, screen } from '../lib/plate.mjs';
import { domeNight, eyepieceNight, summitRoad } from '../art/scenes.mjs';
import { enter, section } from './common.mjs';
const content = JSON.parse(readFileSync(new URL('../../../../../library/content/web.json',import.meta.url),'utf8'));
const esc = (text) => text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const inline = (svg) => svg.replace(/<svg /,'<svg class="scene" ').replace('width="1200" height="800"','');
const titleLine = (text) => {
 const outline = textPath(text,{font:'qingke',size:100,x:0,y:baseline('qingke',100,1.16),fill:HEX.pink});
 return `<span class="title-line"><svg class="pink-title" viewBox="0 0 ${outline.width} 116" width="${outline.width}" height="116" aria-hidden="true" ${enter(3,'left','set','set','roll')}>${outline.svg}</svg><span class="blue-title">${text}</span></span>`;
};
function poster() {
 const text = section(`<header class="mast"><span>鹞岭天文台</span><span class="num">2026 — 2027</span></header><div class="poster-grid"><div><p class="eyebrow" ${enter(0,'fade','snap','ink')}>${content['hero.eyebrow']}</p><h1 class="poster-title" ${enter(0)}>${titleLine('山顶')}${titleLine('开放观测夜')}</h1><p class="lead" ${enter(1)}>${content['hero.lead']}</p><a class="ticket" href="#riso-calendar" ${enter(2)}>查看八个观测夜 →</a></div><figure ${enter(1,'left','roll')}>${inline(domeNight())}<figcaption class="note">${esc('圆顶开缝，银河横过山脊上方')}</figcaption></figure></div><div class="poster-foot num"><span>11.21 起 · 每场 60 人</span><span>蓝 / 荧光粉 · 双墨印制</span></div>`, `
:scope{min-height:100vh;padding-top:var(--ds-space-6);padding-bottom:var(--ds-space-6);}
.mast,.poster-foot{display:flex;justify-content:space-between;gap:var(--ds-space-5);font-size:var(--ds-type-note);border-bottom:6px solid var(--ds-color-blue);padding-bottom:var(--ds-space-4);}
.poster-grid{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:var(--ds-space-8);align-items:center;margin:var(--ds-space-7) 0;}
.eyebrow{margin-bottom:var(--ds-space-5);font-size:var(--ds-type-note);}
.poster-title{font-family:var(--ds-font-display);font-weight:400;font-size:var(--ds-type-display);line-height:1.16;}
.title-line{position:relative;display:block;width:fit-content;white-space:nowrap;}
.pink-title{position:absolute;inset:0;width:100%;height:100%;overflow:visible;translate:var(--ds-space-1) calc(var(--ds-space-1) / -2);}
.blue-title{position:relative;mix-blend-mode:multiply;}
.poster-grid .lead{margin-top:var(--ds-space-6);max-width:30em;}
.ticket{margin-top:var(--ds-space-6);font-size:var(--ds-type-body);}
.scene{display:block;width:100%;height:auto;}
figcaption{margin-top:var(--ds-space-3);}
.poster-foot{border-top:2px solid var(--ds-color-blue);border-bottom:0;padding-top:var(--ds-space-4);padding-bottom:0;}
@media(max-width:860px){:scope{min-height:auto;padding-top:var(--ds-space-5);}.poster-grid{grid-template-columns:1fr;gap:var(--ds-space-6);margin:var(--ds-space-7) 0;}.poster-title{font-size:var(--ds-type-title);}.poster-foot{flex-wrap:wrap;}.mast{font-size:var(--ds-type-note);}}
`);
 return {name:'kaifang-haibao.html',text};
}
function night() {
 return {name:'mujing-manban.html',text:section(`<div id="riso-night" class="night-title"><p class="num">21:00 / 鹞岭</p><h2 class="heading" ${enter(0)}>到目镜前，亲眼看</h2><p class="body" ${enter(1)}>先在接待厅听讲解，再到室外看银河，最后分组到目镜前轮流观看。</p></div><figure ${enter(0,'left','roll')}>${inline(eyepieceNight())}</figure><p class="night-note">山顶用红光照明。每人观看约 5 分钟。</p>`,`:scope{padding:0;background:var(--ds-color-blue);color:var(--ds-color-paper);}.wrap{max-width:none;}.night-title{padding:var(--ds-space-8);display:grid;gap:var(--ds-space-4);}.scene{display:block;width:100%;height:auto;background:var(--ds-color-paper);color:var(--ds-color-blue);}.night-note{padding:var(--ds-space-5) var(--ds-space-8);}@media(max-width:860px){.night-title{padding:var(--ds-space-7) var(--ds-space-5);}.night-note{padding:var(--ds-space-5);}}`)};
}
export const NIGHTS = [[2026,11,21],[2026,11,28],[2026,12,19],[2026,12,26],[2027,1,16],[2027,1,23],[2027,2,20],[2027,2,27]];
export function moonPhase(y,m,d) {
 const age = (((Date.UTC(y,m-1,d,13)-Date.UTC(2026,10,9,7))/86400000)%29.530589+29.530589)%29.530589;
 const p = age/29.530589;
 return {age, illuminated:(1-Math.cos(p*Math.PI*2))/2,waxing:p<.5};
}
function moon(y,m,d,i) {
 const {age,illuminated,waxing}=moonPhase(y,m,d);
 const phase=age/29.530589, r=46, rx=(r*Math.abs(Math.cos(phase*Math.PI*2))).toFixed(3);
 const light = phase<.5 ? `M0 -46A46 46 0 0 1 0 46A${rx} 46 0 0 ${phase<.25?0:1} 0 -46Z` : `M0 -46A46 46 0 0 0 0 46A${rx} 46 0 0 ${phase<.75?0:1} 0 -46Z`;
 const title=`${y} 年 ${m} 月 ${d} 日，${waxing?'盈月':'亏月'}，亮面约 ${Math.round(illuminated*100)}%`;
 return `<svg viewBox="-50 -50 100 100" role="img" aria-label="${title}"><defs>${screen('moon-dark-'+i,HEX.blue,{cell:8,r:3.4,angle:15})}${screen('moon-lit-'+i,HEX.pink,{cell:8,r:2.4,angle:75})}</defs><circle r="46" fill="url(#moon-dark-${i})"/><path d="${light}" fill="${HEX.paper}"/><path d="${light}" fill="url(#moon-lit-${i})"/><circle r="46" fill="none" stroke="${HEX.blue}" stroke-width="2"/></svg>`;
}
function calendar() {
 const cells=NIGHTS.map(([y,m,d],i)=>`<li ${enter(i,'left')}><span class="num date">${y} / ${String(m).padStart(2,'0')} / ${d}</span>${moon(y,m,d,i)}<p>周六 · 60 人</p></li>`).join('');
 return {name:'ba-ye-yueli.html',text:section(`<div id="riso-calendar" class="stack"><h2 class="heading" ${enter(0)}>八个周六，八个观测夜</h2><p>2026 年 11 月至 2027 年 2 月，每月第 3、第 4 个周六晚上。</p><div class="stripe" aria-hidden="true"></div><ol class="calendar" data-ds-stagger="line">${cells}</ol><p class="note">月相按当晚 21:00 的日期估算；粉色疏网点为亮面，蓝色密网点为暗面。月相不代表天气与可见天体。</p></div><figure class="road">${inline(summitRoad())}<figcaption class="note">鹿溪镇沿 38 公里盘山路上山，车程约 1 小时 10 分。</figcaption></figure>`,`.calendar{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:2px solid var(--ds-color-blue);}.calendar li{border-bottom:2px solid var(--ds-color-blue);padding:var(--ds-space-5);display:grid;gap:var(--ds-space-4);}.calendar svg{width:var(--ds-space-9);height:var(--ds-space-9);}.date{font-size:var(--ds-type-lead);}.road{margin-top:var(--ds-space-8);max-width:860px;}.scene{display:block;width:100%;height:auto;}figcaption{margin-top:var(--ds-space-3);}@media(max-width:860px){.calendar{grid-template-columns:repeat(2,minmax(0,1fr));}.calendar li{padding:var(--ds-space-4) var(--ds-space-2);}.date{font-size:var(--ds-type-body);}}`)};
}
export const FRAGMENTS = [poster,night,calendar];

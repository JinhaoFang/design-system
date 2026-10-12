/*
 * works/fragments/ba-ge-zhouliu.html for works/wechat-cover.json (公众号封面 900x383, concept 八个周六).
 * A horizontal scroll. Top and bottom 界栏 (a thick ink line over a hairline) bound the scroll. At the left a cartouche: the kicker 公众观测夜 vertical in kai vermilion and the title 八个周六 as two
 * lines in Song ExtraLight at head size (八个 over 周六, horizontal so it reads in natural order). To the right a rule-colour thread runs through eight moons, one per public observing night (2026-11-21 ... 2027-02-27):
 * each moon is drawn from its real age on that date (art/moon.mjs), with an ordinal in kai (壹 to 捌) above and the date below in tabular lining figures. Below the thread two caption lines state the span and
 * cadence, and a small vermilion seal closes the scroll at the lower right. Sizes, gaps and colours are tokens. baGeZhouliu() -> { name, text }.
 */
import { moonGlyph, moonAge, NIGHTS } from '../art/moon.mjs';
import { VAR } from '../lib/palette.mjs';
import { fragment, paperBase, sealCss, sealHtml } from './common.mjs';

const ORDINALS = ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌'];

export function baGeZhouliu() {
  const nights = NIGHTS.map(([y, m, d], i) => {
    const svg = `<svg width="56" height="56" viewBox="-28 -28 56 56" role="img" aria-label="${m} 月 ${d} 日的月相">${moonGlyph({ age: moonAge(y, m, d), r: 26, P: VAR, id: `mn${i}` })}</svg>`;
    return `<div class="night"><span class="no">${ORDINALS[i]}</span>${svg}<span class="dt">${m}.${d}</span></div>`;
  }).join('');
  const css = `${paperBase()}
.edge{position:absolute;left:48px;right:48px;height:0;border-top:3px solid var(--ds-color-ink)}
.edge::after{content:"";position:absolute;left:0;right:0;border-top:1px solid var(--ds-color-rule)}
.edge.t{top:30px}
.edge.t::after{top:9px}
.edge.b{bottom:30px}
.edge.b::after{bottom:9px}
.kick{position:absolute;left:72px;top:84px;width:30px;writing-mode:vertical-rl;text-orientation:upright;font-family:var(--ds-font-kai);font-size:var(--ds-type-note);line-height:1;letter-spacing:.24em;color:var(--ds-color-zhu);white-space:nowrap}
.cut{position:absolute;left:124px;top:88px;height:178px;width:0;border-left:1px solid var(--ds-color-rule-light)}
.title{position:absolute;left:142px;top:96px;width:164px;font-size:var(--ds-type-head);font-weight:200;line-height:1.15;letter-spacing:.06em;white-space:nowrap}
.title span{display:block}
.thread{position:absolute;left:316px;right:48px;top:160px;height:0;border-top:1px solid var(--ds-color-rule)}
.moons{position:absolute;left:318px;top:96px;width:534px;display:grid;grid-template-columns:repeat(8,1fr)}
.night{display:flex;flex-direction:column;align-items:center;gap:var(--ds-space-2)}
.night svg{display:block}
.no{font-family:var(--ds-font-kai);font-size:var(--ds-type-caption);line-height:1;color:var(--ds-color-ink-3)}
.dt{font-family:var(--ds-font-latin);font-size:var(--ds-type-caption);line-height:1;color:var(--ds-color-ink);font-feature-settings:"lnum" 1,"tnum" 1}
.note{position:absolute;left:318px;top:262px;font-size:var(--ds-type-caption);line-height:1.5;letter-spacing:.1em;color:var(--ds-color-ink-2);font-feature-settings:"lnum" 1}
.note span{display:block}
${sealCss()}
.seal{left:792px;top:262px;width:60px;height:60px;padding:var(--ds-space-1);grid-template-rows:1fr 1fr;font-size:var(--ds-type-caption);transform:rotate(-4deg)}`;
  const html = `<div class="edge t"></div><div class="edge b"></div>
<p class="kick">公众观测夜</p>
<div class="cut"></div>
<h1 class="title"><span>八个</span><span>周六</span></h1>
<div class="thread"></div>
<div class="moons">${nights}</div>
<p class="note"><span>2026 年 11 月至 2027 年 2 月</span><span>每月第三、第四个周六　每场约 3 小时</span></p>
${sealHtml('鹞岭')}`;
  return { name: 'ba-ge-zhouliu.html', text: fragment({ css, html }) };
}

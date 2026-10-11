/*
 * works/fragments/xingtu-tiqian.html for works/xiaohongshu.json (小红书 1080x1440, concept 一页星图题签).
 * A title-page spread in the direction prototype's variant A: the 文武边栏 frames the sheet; the upper left is a plate, a real-coordinate northern star chart dial with the 24-mountain ring and
 * hour numerals, the Andromeda galaxy circled in vermilion (inline SVG from art/starchart.mjs, text outlined); the title 鹞岭天文台 runs vertically at the right in Song ExtraLight (title size, letter-spaced);
 * below the chart the vertical subtitle 公众观测夜 (Song SemiBold, lead) sits against a rule-light hairline and the date in kai vermilion; bottom left a vermilion seal 预约 with the booking address.
 * Zhu appears at the galaxy circle, the date, the seal; no brush underline here (one per sheet at most, and this sheet already has its accents). All sizes, gaps and colours are tokens.
 * xingtuTiqian() -> { name, text }.
 */
import { starChart } from '../art/starchart.mjs';
import { yuwei } from '../art/ornaments.mjs';
import { VAR } from '../lib/palette.mjs';
import { fragment, frameCss, paperBase, sealCss, sealHtml } from './common.mjs';

export function xingtuTiqian() {
  const chart = starChart({ size: 1000, P: VAR, idPrefix: 'xt', seed: 11 });
  const css = `${paperBase()}
${frameCss()}
.chart{position:absolute;left:88px;top:118px;width:790px;height:790px}
.chart svg{display:block;width:100%;height:100%}
.cap{position:absolute;left:112px;top:940px;font-family:var(--ds-font-kai);font-size:var(--ds-type-caption);letter-spacing:.12em;color:var(--ds-color-ink-3)}
.tail{position:absolute;left:934px;top:424px;line-height:0}
.title{position:absolute;left:890px;top:470px;width:120px;writing-mode:vertical-rl;text-orientation:upright;font-weight:200;font-size:var(--ds-type-title);line-height:1;letter-spacing:.12em;white-space:nowrap}
.rule{position:absolute;left:826px;top:952px;height:330px;width:0;border-left:1px solid var(--ds-color-rule-light)}
.sub{position:absolute;left:836px;top:960px;width:44px;writing-mode:vertical-rl;text-orientation:upright;font-weight:600;font-size:var(--ds-type-lead);line-height:1;letter-spacing:.3em;white-space:nowrap}
.date{position:absolute;left:770px;top:972px;width:34px;writing-mode:vertical-rl;text-orientation:upright;font-family:var(--ds-font-kai);font-size:var(--ds-type-note);line-height:1;letter-spacing:.2em;color:var(--ds-color-zhu);white-space:nowrap}
${sealCss()}
.seal{left:104px;top:1190px;width:132px;height:132px;padding:var(--ds-space-2);grid-template-rows:1fr 1fr;font-size:var(--ds-type-sub);transform:rotate(-3deg)}
.book{position:absolute;left:272px;top:1224px;font-size:var(--ds-type-caption);line-height:1.7;color:var(--ds-color-ink-2)}
.book b{display:block;font-weight:600;letter-spacing:.2em;color:var(--ds-color-ink)}
.book i{font-family:var(--ds-font-latin);font-style:normal;letter-spacing:.04em}`;
  const html = `<div class="frame"></div>
<div class="chart">${chart}</div>
<p class="cap">图一　北天星图　朱圈为仙女星系</p>
<div class="tail">${yuwei({ w: 36, fill: VAR.ink })}</div>
<h1 class="title">鹞岭天文台</h1>
<div class="rule"></div>
<p class="sub">公众观测夜</p>
<p class="date">十一月二十一日起</p>
${sealHtml('预约')}
<p class="book"><b>预约入口</b><i>kestrelridge.example/book</i></p>`;
  return { name: 'xingtu-tiqian.html', text: fragment({ css, html }) };
}

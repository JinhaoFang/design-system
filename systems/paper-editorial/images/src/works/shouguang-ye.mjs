/*
 * works/fragments/shouguang-ye.html for works/slides.json (HTML 幻灯片 1920x1080, the 首光 page of the deck concept 观测日志·卷一).
 * The climax page of the deck: one page of the observing log for first light. A ruled log header (2px ink over a rule hairline: 观测日志 鹞岭天文台 / 首光 · 仙女星系 M31 / 2025 年 10 月);
 * on the left the headline 光走了 / 250 万年 in Song ExtraLight at display size, the vermilion brush underline under "250 万年" (the one brush stroke of the page, art/ornaments.mjs, stretched to the word),
 * then a three-row ruled record (目标, 距离, 天顶亮度; tabular lining numerals) and the director's signature in kai; on the right the real-coordinate northern star chart (art/starchart.mjs)
 * as a plate with paper around it and its figure caption centred under it, M31 circled in vermilion. Zhu appears only at the brush stroke and the M31 circle. Facts follow library/content/SETTING.md.
 * Entrance marks (data-ds-enter) stage headline first, then the record rows, then the plate and caption; the brush underline (draw-x, lift + brush, data-ds-wait lift) is drawn only after all of them have settled. All text is at least body size. Sizes, gaps and colours are tokens. shouguangYe() -> { name, text }.
 */
import { starChart } from '../art/starchart.mjs';
import { brushStroke } from '../art/ornaments.mjs';
import { VAR } from '../lib/palette.mjs';
import { fragment, paperBase } from './common.mjs';

const RISE = 'data-ds-enter="rise" data-ds-step="glide" data-ds-ease="paper" data-ds-distance="3"';
const FADE = 'data-ds-enter="fade" data-ds-step="ink" data-ds-ease="ink"';

export function shouguangYe() {
  const chart = starChart({ size: 1000, P: VAR, idPrefix: 'sg', seed: 7 });
  const stroke = brushStroke({ w: 640, h: 36, T: 8, seed: 9, fill: VAR.zhu, fluid: true });
  const css = `${paperBase()}
.log{position:absolute;left:var(--ds-space-7);right:var(--ds-space-7);top:var(--ds-space-6);display:flex;justify-content:space-between;align-items:baseline;padding:var(--ds-space-2) 0;border-top:2px solid var(--ds-color-ink);border-bottom:1px solid var(--ds-color-rule);font-size:var(--ds-type-caption);line-height:1.4;letter-spacing:.14em;color:var(--ds-color-ink-2);font-feature-settings:"lnum" 1,"tnum" 1}
.log b{font-weight:600;color:var(--ds-color-ink);margin-right:var(--ds-space-3)}
.hl{position:absolute;left:var(--ds-space-7);top:208px;font-family:var(--ds-font-body);font-size:var(--ds-type-display);font-weight:200;line-height:1.12;letter-spacing:.01em;white-space:nowrap}
.hl .w{position:relative;display:inline-block}
.hl .w svg{position:absolute;left:-1%;bottom:-10px;width:102%;height:36px}
.rec{position:absolute;left:var(--ds-space-7);top:716px;width:760px;border-top:1px solid var(--ds-color-rule);list-style:none;margin:0;padding:0}
.rec li{display:grid;grid-template-columns:5em 1fr;align-items:baseline;padding:var(--ds-space-1) 0;border-bottom:1px solid var(--ds-color-rule-light);font-size:var(--ds-type-body);line-height:1.5}
.rec em{font-style:normal;letter-spacing:.12em;color:var(--ds-color-ink-3)}
.rec span{font-feature-settings:"lnum" 1,"tnum" 1}
.by{position:absolute;left:var(--ds-space-7);bottom:var(--ds-space-6);font-family:var(--ds-font-kai);font-size:var(--ds-type-body);letter-spacing:.14em;color:var(--ds-color-ink-2)}
.by::before{content:"";display:inline-block;width:56px;margin-right:var(--ds-space-3);vertical-align:middle;border-top:1px solid var(--ds-color-ink-2)}
.plate{position:absolute;right:var(--ds-space-7);top:196px;width:760px;height:760px}
.plate svg{display:block;width:100%;height:100%}
.fig{position:absolute;right:var(--ds-space-7);bottom:var(--ds-space-6);width:760px;text-align:center;font-size:var(--ds-type-body);letter-spacing:.06em;color:var(--ds-color-ink-3)}`;
  const html = `<div class="log" ${FADE} data-ds-order="5"><span><b>观测日志</b>鹞岭天文台</span><span>首光 · 仙女星系 M31</span><span>2025 年 10 月</span></div>
<p class="hl" ${RISE} data-ds-order="1">光走了<br><span class="w">250 万年${stroke.replace('<svg ', '<svg data-ds-enter="draw-x" data-ds-step="lift" data-ds-ease="brush" data-ds-order="2" data-ds-wait="lift" ')}</span></p>
<ul class="rec" data-ds-stagger="line">
<li ${FADE} data-ds-order="2"><em>目标</em><span>仙女星系 M31</span></li>
<li ${FADE} data-ds-order="3"><em>距离</em><span>约 250 万光年</span></li>
<li ${FADE} data-ds-order="4"><em>天顶亮度</em><span>21.7 等 / 平方角秒</span></li>
</ul>
<p class="by" ${FADE} data-ds-order="3">沈砚秋，台长</p>
<div class="plate" ${FADE} data-ds-step="glide" data-ds-order="3">${chart}</div>
<p class="fig" ${FADE} data-ds-order="4">图一　北天星图　朱圈为仙女星系</p>`;
  return { name: 'shouguang-ye.html', text: fragment({ css, html }) };
}

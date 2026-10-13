/*
 * works/fragments/rizhi-shouye.html for works/web.json (展示型网页的首屏, concept 观测日志的一页).
 * The direction prototype's variant B hero without the time column, as the referee chose: a ruled log header (观测日志 in Song SemiBold, then the site, the date of the inauguration and the sky
 * reading, all horizontal with tabular lining figures) over a 2px ink rule; below, the only protagonist, starting a space-9 below the header (the hero is not centred in the viewport; its spare height collects at the bottom as a margin): the headline 新望远镜落成，/ 山顶开放观测夜 in Song ExtraLight at display size, broken
 * after the comma, with the vermilion brush underline (art/ornaments.mjs, fluid width) under exactly 开放观测夜, the half that matters. Under it the lead, the action link (ink rule, a thin
 * vermilion line slides in on hover) and the booking date in ink-3. On the right, bottom-aligned with the text block and about as tall, a supporting plate: the stipple of the Andromeda galaxy
 * (art/andromeda.mjs, the same plate as the square social sheet), so the northern star chart is kept for the full plate further down; its caption 图〇　仙女星系　首光所见 in ink-2. Zhu: only the stroke.
 * Entrance (choreography attributes): the log header fades in, the headline rises (glide + paper, space-3), then, after a lift-step wait (data-ds-wait) so everything else has settled, the brush stroke is drawn left to right (draw-x, lift + brush),
 * then the lead and the action fade in a line apart, the plate last. Under 860px: one column, headline at head size, plate after the text.
 * Sizes, gaps and colours are tokens. rizhiShouye() -> { name, text }.
 */
import { andromedaPlate } from '../art/andromeda.mjs';
import { brushStroke } from '../art/ornaments.mjs';
import { VAR } from '../lib/palette.mjs';
import { fragment, paperBase } from './common.mjs';

export function rizhiShouye() {
  const plate = andromedaPlate({ w: 400, h: 340, P: VAR, seed: 17 });
  const stroke = brushStroke({ w: 400, h: 24, T: 8, seed: 9, fill: VAR.zhu, fluid: true }).replace('<svg ', '<svg data-ds-enter="draw-x" data-ds-wait="lift" data-ds-step="lift" data-ds-ease="brush" data-ds-order="2" ');
  const css = `${paperBase()}
:scope{display:flex;flex-direction:column;height:auto;min-height:100vh;overflow:visible;padding:0 var(--ds-space-8) var(--ds-space-8);font-family:var(--ds-font-body);font-size:var(--ds-type-body);line-height:1.85}
:scope *{box-sizing:border-box}
p,h1,a{margin:0}
.log{display:flex;flex-wrap:wrap;gap:var(--ds-space-2) var(--ds-space-7);width:100%;max-width:1240px;margin:0 auto;padding:var(--ds-space-6) 0 var(--ds-space-3);border-bottom:2px solid var(--ds-color-ink);font-size:var(--ds-type-note);letter-spacing:.08em;color:var(--ds-color-ink-2);font-feature-settings:"lnum" 1,"tnum" 1}
.log b{font-weight:600;letter-spacing:.24em;color:var(--ds-color-ink)}
.main{display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:var(--ds-space-8);align-items:end;width:100%;max-width:1240px;margin:0 auto;padding-top:var(--ds-space-9)}
.title{font-size:var(--ds-type-display);font-weight:200;line-height:1.16;letter-spacing:.02em}
.title>span{display:block}
.hl{position:relative;display:inline-block}
.hl svg{position:absolute;left:-.04em;right:0;bottom:-.12em;width:104%;height:.3em}
.lead{max-width:26em;margin-top:var(--ds-space-7);font-size:var(--ds-type-lead);line-height:1.9;color:var(--ds-color-ink-2);text-align:justify;text-wrap:pretty;font-feature-settings:"onum" 1}
.go{display:flex;flex-wrap:wrap;align-items:baseline;gap:var(--ds-space-2) var(--ds-space-6);margin-top:var(--ds-space-6)}
.act{position:relative;display:inline-block;padding-bottom:var(--ds-space-1);border-bottom:1px solid var(--ds-color-ink);color:var(--ds-color-ink);font-weight:600;letter-spacing:.2em;text-decoration:none}
.act::after{content:"";position:absolute;left:0;right:0;bottom:-4px;height:2px;background:var(--ds-color-zhu);transform:scaleX(0);transform-origin:left center;transition:transform var(--ds-duration-dot) var(--ds-easing-ink)}
.act:hover::after,.act:focus-visible::after{transform:scaleX(1)}
.when{font-size:var(--ds-type-note);letter-spacing:.06em;color:var(--ds-color-ink-2);font-feature-settings:"lnum" 1,"tnum" 1}
.plate{position:relative}
.plate svg{display:block;width:100%;height:auto}
.fig{margin-top:var(--ds-space-3);font-size:var(--ds-type-note);letter-spacing:.24em;color:var(--ds-color-ink-2)}
@media (max-width:860px){
:scope{min-height:auto;padding:0 var(--ds-space-5) var(--ds-space-8)}
.log{gap:var(--ds-space-1) var(--ds-space-4);padding-top:var(--ds-space-5);font-size:var(--ds-type-caption)}
.main{grid-template-columns:minmax(0,1fr);gap:var(--ds-space-7);padding-top:var(--ds-space-7)}
.title{font-size:var(--ds-type-head)}
.lead{margin-top:var(--ds-space-6);font-size:var(--ds-type-body)}
.plate{width:min(100%,260px)}
}`;
  const html = `<p class="log" data-ds-enter="fade" data-ds-step="ink" data-ds-ease="ink" data-ds-order="0"><b>观测日志</b><span>鹞岭天文台　海拔 2,860 米</span><span>2026 年 11 月 14 日　新镜落成</span><span>晴　天顶亮度 21.7 等 / 平方角秒</span></p>
<div class="main">
<div class="text">
<h1 class="title" data-ds-enter="rise" data-ds-step="glide" data-ds-ease="paper" data-ds-distance="3" data-ds-order="1"><span>新望远镜落成，</span><span>山顶<span class="hl">开放观测夜${stroke}</span></span></h1>
<p class="lead" data-ds-enter="fade" data-ds-step="ink" data-ds-ease="ink" data-ds-order="3">鹞岭天文台建在海拔 2,860 米的山顶。口径 1.6 米的新望远镜落成后，每月两个周六的晚上向公众开放，每场 60 人。</p>
<p class="go" data-ds-enter="fade" data-ds-step="ink" data-ds-ease="ink" data-ds-order="4"><a class="act" href="#">预约观测夜</a><span class="when">10 月 20 日开放预约</span></p>
</div>
<figure class="plate" data-ds-enter="fade" data-ds-step="glide" data-ds-ease="ink" data-ds-order="5">${plate}<figcaption class="fig">图〇　仙女星系　首光所见</figcaption></figure>
</div>`;
  return { name: 'rizhi-shouye.html', text: fragment({ css, html }) };
}

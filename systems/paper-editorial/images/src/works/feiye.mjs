/*
 * works/fragments/feiye.html for works/slides.json (HTML 幻灯片 1920x1080, the cover of the deck concept 观测日志·卷一).
 * The 扉页 moment of the log: a 2px ink running head (观测日志 · 卷一 on the left, the date 2026 年 11 月 14 日 in tabular numerals on the right); the title 鹞岭天文台 / 新镜落成 in Song ExtraLight
 * at display size, its last line sitting on a hairline baseline at about 62% of the height, the subtitle under the baseline; on the upper right a plate of the dome at night (art/dome-night.mjs
 * drawn with the token palette and inlined, so it needs no image file) under a paper-deep tissue that peels upward on entry, with its figure caption; a small vermilion seal 鹞岭 at the lower right.
 * Zhu appears at the seal and the drawing's own two marks. Entrance: title rises, the tissue peels, subtitle and caption ink in, the running head, the seal stamps last. Sizes, gaps and colours are tokens.
 * feiye() -> { name, text }.
 */
import { domeNight } from '../art/dome-night.mjs';
import { VAR } from '../lib/palette.mjs';
import { fragment, paperBase, sealCss, sealHtml } from './common.mjs';

const RISE = 'data-ds-enter="rise" data-ds-step="glide" data-ds-ease="paper" data-ds-distance="3"';
const FADE = 'data-ds-enter="fade" data-ds-step="ink" data-ds-ease="ink"';

export function feiye() {
  const plate = domeNight(VAR).replace(/<title>[^<]*<\/title>\n?/, '').replace(' role="img"', ' aria-hidden="true"');
  const css = `${paperBase()}
.run{position:absolute;left:var(--ds-space-7);right:var(--ds-space-7);top:var(--ds-space-6);display:flex;justify-content:space-between;align-items:baseline;padding-bottom:var(--ds-space-2);border-bottom:2px solid var(--ds-color-ink);font-size:var(--ds-type-caption);line-height:1.5;letter-spacing:.16em;color:var(--ds-color-ink-2);font-feature-settings:"lnum" 1,"tnum" 1}
.run b{font-weight:600;color:var(--ds-color-ink)}
.title{position:absolute;left:var(--ds-space-7);bottom:38%;width:5.3em;font-family:var(--ds-font-cjk);font-size:var(--ds-type-display);font-weight:200;line-height:1.14;letter-spacing:.02em}
.base{position:absolute;left:var(--ds-space-7);right:var(--ds-space-7);top:62%;border-top:1px solid var(--ds-color-rule)}
.sub{position:absolute;left:var(--ds-space-7);top:calc(62% + var(--ds-space-5));font-size:var(--ds-type-lead);letter-spacing:.04em;line-height:1.6;color:var(--ds-color-ink-2)}
.plate{position:absolute;right:var(--ds-space-7);top:192px;width:720px;height:405px;overflow:hidden}
.plate svg{display:block;width:100%;height:100%}
.tissue{position:absolute;inset:0;background:var(--ds-color-paper-deep);border-bottom:1px solid var(--ds-color-rule)}
.cap{position:absolute;right:var(--ds-space-7);top:621px;width:720px;font-size:var(--ds-type-body);line-height:1.5;color:var(--ds-color-ink-2);text-align:right}
${sealCss()}
.seal{right:var(--ds-space-8);bottom:var(--ds-space-7);width:96px;height:96px;padding:var(--ds-space-1);font-size:var(--ds-type-lead);grid-template-rows:1fr 1fr;transform:rotate(-3deg)}`;
  const html = `<div class="run" ${FADE} data-ds-order="4"><b>观测日志　卷一</b><span>2026 年 11 月 14 日</span></div>
<h1 class="title" ${RISE} data-ds-order="1">鹞岭天文台新镜落成</h1>
<div class="base" aria-hidden="true"></div>
<p class="sub" ${FADE} data-ds-order="3">1.6 米望远镜首光之后，向公众开放观测夜</p>
<div class="plate" role="img" aria-label="圆顶开缝，银河横过山脊上方">${plate}<div class="tissue" data-ds-enter="peel-up" data-ds-step="lift" data-ds-ease="paper" data-ds-order="2" aria-hidden="true"></div></div>
<p class="cap" ${FADE} data-ds-order="3">图一　圆顶开缝，银河横过山脊上方</p>
${sealHtml('鹞岭').replace('class="seal"', 'class="seal" data-ds-enter="stamp" data-ds-step="turn" data-ds-ease="press" data-ds-order="5"')}`;
  return { name: 'feiye.html', text: fragment({ css, html }) };
}

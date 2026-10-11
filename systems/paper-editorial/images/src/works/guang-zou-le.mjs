/*
 * works/fragments/guang-zou-le.html for works/square.json (方形 1080x1080, concept 光走了二百五十万年).
 * One page of the observing log: a ruled log header (观测日志, 鹞岭天文台, 首光 · 仙女星系, 2025 年 10 月), the sentence from the director in Song ExtraLight at head size, set as three breath-lines,
 * with the vermilion brush underline under "250 万年" (the single brush stroke of the sheet, inline SVG from art/ornaments.mjs, stretched to the word); a stipple plate of the Andromeda galaxy at the lower right
 * with its figure caption, and the signature in kai at the lower left. Text is real DOM text (numerals and Chinese kept apart by spaces); the plate and the stroke are the only SVG.
 * Sizes, gaps and colours are tokens. guangZouLe() -> { name, text }.
 */
import { andromedaPlate } from '../art/andromeda.mjs';
import { brushStroke } from '../art/ornaments.mjs';
import { VAR } from '../lib/palette.mjs';
import { fragment, paperBase } from './common.mjs';

export function guangZouLe() {
  const plate = andromedaPlate({ w: 400, h: 340, P: VAR, seed: 17 });
  const stroke = brushStroke({ w: 400, h: 24, T: 8, seed: 5, fill: VAR.zhu, fluid: true });
  const css = `${paperBase()}
.log{position:absolute;left:72px;right:72px;top:72px;display:flex;justify-content:space-between;align-items:baseline;padding:var(--ds-space-3) 0;border-top:2px solid var(--ds-color-ink);border-bottom:1px solid var(--ds-color-rule);font-size:var(--ds-type-caption);line-height:1.2;letter-spacing:.12em;color:var(--ds-color-ink-2);font-feature-settings:"lnum" 1,"tnum" 1}
.log b{font-weight:600;color:var(--ds-color-ink);margin-right:var(--ds-space-3)}
.quote{position:absolute;left:72px;top:250px;font-family:var(--ds-font-body);font-size:var(--ds-type-head);font-weight:200;line-height:1.5;letter-spacing:.02em;white-space:nowrap}
.quote .hl{position:relative;display:inline-block}
.quote .hl svg{position:absolute;left:0;top:90px;width:100%;height:24px}
.by{position:absolute;left:72px;top:676px;font-family:var(--ds-font-kai);font-size:var(--ds-type-note);letter-spacing:.14em;color:var(--ds-color-ink-2)}
.by::before{content:"";display:inline-block;width:54px;margin-right:var(--ds-space-3);vertical-align:middle;border-top:1px solid var(--ds-color-ink-2)}
.plate{position:absolute;left:640px;top:636px;width:368px;height:313px}
.plate svg{display:block;width:100%;height:100%}
.fig{position:absolute;left:640px;top:964px;font-family:var(--ds-font-kai);font-size:var(--ds-type-caption);letter-spacing:.12em;color:var(--ds-color-ink-3)}`;
  const html = `<div class="log"><span><b>观测日志</b>鹞岭天文台</span><span>首光 · 仙女星系</span><span>2025 年 10 月</span></div>
<p class="quote">进入镜筒的光<br>已经走了 <span class="hl">250 万年${stroke}</span>，<br>比人类的历史还长。</p>
<p class="by">沈砚秋，台长</p>
<div class="plate">${plate}</div>
<p class="fig">图一　仙女星系　点描</p>`;
  return { name: 'guang-zou-le.html', text: fragment({ css, html }) };
}

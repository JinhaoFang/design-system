/*
 * works/fragments/beitian-tuban.html for works/web.json (展示型网页中段的满版高潮, concept 观测日志的一页).
 * The full-bleed plate of the direction prototype's variant A: after three quiet sections the page opens onto one plate. A paper-deep band from edge to edge (the only bleed on the page) holds a
 * dense real-coordinate northern star chart (art/starchart.mjs, idPrefix bt, a different seed from the hero's inset) as large as the viewport allows, with paper around it; under it the figure caption
 * between two fish-tail marks (图一　北天星图　首光那晚所见), and the plate number PL. I in Source Serif small capitals. Zhu: only the M31 circle inside the chart.
 * A tissue sheet (paper-shade, nearly opaque, a rule line at its lower edge) covers the chart and is lifted off upward (peel-up, lift + paper) once the chart has faded in (glide, ink);
 * the chart box clips it, so it leaves through the top edge. The caption comes last.
 * Sizes, gaps and colours are tokens. beitianTuban() -> { name, text }.
 */
import { starChart } from '../art/starchart.mjs';
import { yuwei } from '../art/ornaments.mjs';
import { VAR } from '../lib/palette.mjs';
import { fragment, paperBase } from './common.mjs';

export function beitianTuban() {
  const chart = starChart({ size: 1000, P: VAR, idPrefix: 'bt', seed: 23, dense: true });
  const css = `${paperBase()}
:scope{height:auto;padding:var(--ds-space-9) var(--ds-space-8) var(--ds-space-8);background:var(--ds-color-paper-deep);text-align:center;font-family:var(--ds-font-body)}
:scope *{box-sizing:border-box}
figure,figcaption{margin:0}
.chart{position:relative;overflow:hidden;width:min(100%,78vh,860px);margin:0 auto}
.tissue{position:absolute;inset:0;background:color-mix(in oklch,var(--ds-color-paper-shade) 92%,transparent);border-bottom:1px solid var(--ds-color-rule)}
.chart svg{display:block;width:100%;height:auto}
.cap{display:flex;justify-content:center;align-items:center;gap:var(--ds-space-4);margin-top:var(--ds-space-6);font-size:var(--ds-type-note);letter-spacing:.4em;color:var(--ds-color-ink-2)}
.cap svg{flex:none}
.pl{margin-top:var(--ds-space-2);font-family:var(--ds-font-latin);font-size:var(--ds-type-caption);letter-spacing:.2em;color:var(--ds-color-ink-2);font-feature-settings:"smcp" 1,"c2sc" 1}
@media (max-width:860px){
:scope{padding:var(--ds-space-8) var(--ds-space-4) var(--ds-space-7)}
.cap{gap:var(--ds-space-2);letter-spacing:.16em}
}`;
  const html = `<figure>
<div class="chart" data-ds-enter="fade" data-ds-step="glide" data-ds-ease="ink" data-ds-order="0">${chart}<i class="tissue" aria-hidden="true" data-ds-enter="peel-up" data-ds-step="lift" data-ds-ease="paper" data-ds-order="1"></i></div>
<figcaption data-ds-enter="fade" data-ds-step="ink" data-ds-ease="ink" data-ds-order="2"><p class="cap">${yuwei({ w: 24, fill: VAR.ink })}<span>图一　北天星图　首光那晚所见</span>${yuwei({ w: 24, fill: VAR.ink })}</p><p class="pl">PL. I</p></figcaption>
</figure>`;
  return { name: 'beitian-tuban.html', text: fragment({ css, html }) };
}

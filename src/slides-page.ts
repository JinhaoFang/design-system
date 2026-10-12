/*
 * HTML page assembly for slides: the same :root custom properties and @font-face as the other carriers (page.ts), then a fixed 1920x1080 .ds-stage holding one .ds-slide per narrative unit
 * (data-ds-slide="<1-based number>", wrapping the unit's <section data-ds-unit>), and the inline runtime (slides-runtime.ts) as a classic script so the file works when opened from disk, followed by the entrance choreography script (choreography.ts) when given one.
 * Optional transition config comes from slides.transition.json (slides-transition.ts). During turns two wrappers are displayed with a static token shadow and a token-colored shade; only transform/opacity animate.
 * Target entrance elements are hidden during turns except peel covers and their descendants, which keep covering content until the settled entry hook starts.
 * Screen: only the active slide is displayed at rest; the runtime scales the stage. Print (PDF): @page is 1920x1080 with no margin, the stage scale is dropped and every slide is shown stacked, one per page.
 * Print reveals ordinary entrance content even during a turn; peel covers and their descendants retain choreography.ts terminal hiding rules.
 * If entrance bootstrap is unavailable or fails before slide activation, the first slide remains visible without relying on navigation scripts.
 */
import { fontFaceCss, rootVarsCss } from './page.ts';
import { CHOREOGRAPHY_HEAD } from './choreography.ts';
import type { PageInput } from './page.ts';
import { SLIDES_RUNTIME } from './slides-runtime.ts';
import type { SlidesTransition } from './slides-transition.ts';

export const SLIDE_WIDTH = 1920;
export const SLIDE_HEIGHT = 1080;

export type SlidesPageInput = Pick<PageInput, 'title' | 'cssVars' | 'fonts' | 'unitsHtml'> & { choreography?: string; transition?: SlidesTransition | undefined };

export function buildSlidesPage(input: SlidesPageInput): string {
  const slides = input.unitsHtml
    .map((html, index) => `<div class="ds-slide" data-ds-slide="${index + 1}" aria-hidden="true">${html}${input.transition ? '<div class="ds-slide-shade" aria-hidden="true"></div>' : ''}</div>`)
    .join('\n');
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${input.title}</title>
<style>
${fontFaceCss(input.fonts)}
:root{${rootVarsCss(input.cssVars)}}
html,body{margin:0;padding:0;height:100%;overflow:hidden}
.ds-stage{position:fixed;left:50%;top:50%;width:${SLIDE_WIDTH}px;height:${SLIDE_HEIGHT}px;transform:translate(-50%,-50%);transform-origin:center center;overflow:hidden}
.ds-slide{display:none;position:absolute;left:0;top:0;width:${SLIDE_WIDTH}px;height:${SLIDE_HEIGHT}px;overflow:hidden}
.ds-slide[data-active]{display:block}
html:not([data-ds-choreography]):not([data-render="static"]) .ds-stage:not(:has([data-active])){position:static;transform:none}
html:not([data-ds-choreography]):not([data-render="static"]) .ds-stage:not(:has([data-active])) .ds-slide:first-child{display:block}
.ds-slide>section{width:100%;height:100%}
${input.transition ? `
.ds-slide[data-turning],.ds-slide[data-leaving]{display:block;overflow:visible}
.ds-slide[data-turning]{z-index:2}
.ds-slide[data-leaving]{z-index:1;pointer-events:none}
.ds-slide[data-turning] [data-ds-enter]:not([data-ds-enter^="peel-"],[data-ds-enter^="peel-"] *){visibility:hidden}
.ds-slide[data-turning]::after{content:"";position:absolute;inset:0;pointer-events:none;box-shadow:var(${input.transition.shadow})}
.ds-slide[data-reverse]::after{transform:scaleX(-1)}
.ds-slide-shade{position:absolute;inset:0;pointer-events:none;background:var(${input.transition.shadeColor});opacity:0;z-index:1}
` : ''}
@page{size:${SLIDE_WIDTH}px ${SLIDE_HEIGHT}px;margin:0}
@media print{
html,body{height:auto;overflow:visible;background:none!important}
.ds-stage{position:static;width:auto;height:auto;transform:none!important;overflow:visible}
.ds-slide{display:block!important;position:relative;break-after:page;break-inside:avoid;print-color-adjust:exact;-webkit-print-color-adjust:exact}
.ds-slide:last-child{break-after:auto}
.ds-slide{transform:none!important;opacity:1!important;z-index:auto!important}
.ds-slide::after,.ds-slide-shade{display:none!important}
.ds-slide [data-ds-enter]:not([data-ds-enter^="peel-"],[data-ds-enter^="peel-"] *){visibility:visible!important}
}
</style>
${input.choreography ? CHOREOGRAPHY_HEAD : ''}
</head>
<body data-carrier="slides">
<main class="ds-stage">
${slides}
</main>
<script>${SLIDES_RUNTIME.replace('__DS_SLIDES_TRANSITION__', JSON.stringify(input.transition ?? null))}</script>
${input.choreography ? `<script>${input.choreography}</script>\n` : ''}</body>
</html>
`;
}

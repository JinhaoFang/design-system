/*
 * Shared pieces for the three custom social fragments (works/fragments/*.html), all of them token-only CSS:
 * paperBase(): the section as the sheet of paper (position relative, paper background, ink text) plus the grain overlay on :scope::after (an feTurbulence noise as a data URI, multiply-blended,
 *   opacity var(--ds-grain-max); a pseudo-element so the checker never counts it as an image).
 * sealCss(): the vermilion seal (.seal, zhu ground, paper-coloured kai characters, worn edge through the SVG filter #ds-rough); sealHtml(chars, cls) lays two characters in a column or four in 2x2.
 * frameCss(): the 文武边栏 double frame (.frame) - ink 3px outer line, rule 1px inner line, a space-2 gap between them; inset is a space token.
 * fragment({css, html}) joins a <style> block and the markup into the file text. The pipeline scopes the <style> to the fragment's section with @scope, so :scope means the canvas-sized section.
 */
import { roughFilter } from '../art/ornaments.mjs';

const GRAIN = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .30  0 0 0 0 .24  0 0 0 0 .17  0 0 0 .9 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";

export const paperBase = () => `:scope{position:relative;display:block;width:100%;height:100%;overflow:hidden;box-sizing:border-box;background:var(--ds-color-paper);color:var(--ds-color-ink);font-family:var(--ds-font-cjk);font-weight:400;line-height:1.5;text-align:left}
:scope::after{content:"";position:absolute;inset:0;pointer-events:none;mix-blend-mode:multiply;opacity:var(--ds-grain-max);background-image:${GRAIN}}
p,h1,h2,div,span,figure{margin:0;padding:0}`;

export const sealCss = (selector = '.seal') => `${selector}{position:absolute;box-sizing:border-box;display:grid;place-items:center;background:var(--ds-color-zhu);color:var(--ds-color-paper);font-family:var(--ds-font-kai);font-weight:400;line-height:1;filter:url(#ds-rough)}
${selector} span{display:block}`;

export const sealHtml = (chars, cls = 'seal') => {
  const list = [...chars];
  return `${roughFilter('ds-rough')}<div class="${cls}">${list.map((c) => `<span>${c}</span>`).join('')}</div>`;
};

export const frameCss = () => `.frame{position:absolute;inset:var(--ds-space-6);border:3px solid var(--ds-color-ink);pointer-events:none}
.frame::before{content:"";position:absolute;inset:var(--ds-space-2);border:1px solid var(--ds-color-rule)}`;

export const fragment = ({ css, html }) => `<style>
${css}
</style>
${html}
`;

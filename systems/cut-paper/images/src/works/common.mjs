/*
 * Shared scoped web styling and markup helpers for the cut-paper layouts and the showcase fragments. Every value is a token variable; leaf colours are referenced as var(--ds-color-<name>).
 * CSS is copied into each layout/fragment because the builder scopes each <style> block to its unit.
 * sentence(text, attrs) renders one letter line with its paper veil (SYSTEM.md 识别符号「逐句点亮」): the text is always in the DOM at full ink; a cover of paper-veil (alpha 0.32, the line still reads about 4.7:1)
 *   sits on it and peels to the right with the read step after a settle wait. Static renders and reduced motion finalize or fade the cover (docs/cli.md「另有三种动作」).
 * leaf(spec, order, effect) places one leaf absolutely inside a positioned field: spec { species, color, x, y, w, angle, seed } in percent of the field; rotation lives inside the svg so the entrance owns the element transform.
 * button(text, href) is the only button: an ink pill that lifts by space-1 on hover with the lift shadow fading in on a pseudo element (transform and opacity only).
 */
import { leafSvg } from '../lib/leaves.mjs';

export const PAPER = '#ebe8df';

export const CSS = `
:scope { position:relative; box-sizing:border-box; isolation:isolate; padding:var(--ds-space-10) var(--ds-space-8); background:var(--ds-color-paper); color:var(--ds-color-ink); font-family:var(--ds-font-body); font-size:var(--ds-type-body); line-height:1.9; }
:scope * { box-sizing:border-box; }
h1,h2,h3,p,ul,ol,li,figure,blockquote,dl,dd,dt { margin:0; padding:0; font-weight:400; }
ul,ol { list-style:none; }
p,li,blockquote,figcaption { text-wrap:pretty; }
a { color:inherit; text-underline-offset:.3em; text-decoration-thickness:1px; }
a:focus-visible { outline:2px solid var(--ds-color-ink); outline-offset:var(--ds-space-1); }
.wrap { max-width:1200px; margin:0 auto; }
.t-head { font-size:var(--ds-type-head); line-height:1.45; text-wrap:balance; }
.t-sub { font-size:var(--ds-type-sub); line-height:1.6; text-wrap:balance; }
.lead { font-size:var(--ds-type-lead); line-height:2; max-width:26em; }
.note { font-size:var(--ds-type-note); color:var(--ds-color-ink-2); }
.num { font-family:var(--ds-font-num); font-variant-numeric:tabular-nums lining-nums; }
.stack { display:grid; gap:var(--ds-space-5); align-content:start; }
.letter { display:grid; gap:var(--ds-space-2); max-width:28em; font-size:var(--ds-type-lead); line-height:2.2; }
.s { position:relative; width:fit-content; max-width:100%; overflow:hidden; }
.veil { position:absolute; inset:0; background:var(--ds-color-paper-veil); }
.field { position:relative; }
.lf { position:absolute; display:block; aspect-ratio:120 / 124; }
.lf svg { display:block; width:100%; height:auto; overflow:visible; }
.btn { position:relative; display:inline-flex; align-items:center; min-height:calc(var(--ds-space-6) + var(--ds-space-3)); padding:0 var(--ds-space-6); border-radius:var(--ds-radius-pill); background:var(--ds-color-ink); color:var(--ds-color-paper); text-decoration:none; transition:transform var(--ds-duration-lift) var(--ds-easing-lift); }
.btn::after { content:""; position:absolute; inset:0; border-radius:inherit; box-shadow:var(--ds-shadow-lift); opacity:0; transition:opacity var(--ds-duration-lift) var(--ds-easing-lift); }
.btn:hover, .btn:focus-visible { transform:translateY(calc(var(--ds-space-1) * -1)); }
.btn:hover::after, .btn:focus-visible::after { opacity:1; }
.btn:focus-visible { outline:2px solid var(--ds-color-ink); outline-offset:3px; }
@media (max-width:860px) {
 :scope { padding:var(--ds-space-8) var(--ds-space-5); }
 .t-head { font-size:var(--ds-type-sub); }
 .letter, .lead { font-size:var(--ds-type-body); }
}
@media (prefers-reduced-motion:reduce) { .btn, .btn::after { transition:none; } .btn:hover, .btn:focus-visible { transform:none; } }
`;

export const enter = (order = 0, effect = 'rise', step = 'settle', ease = 'settle', distance = '3', wait = '') =>
  `data-ds-enter="${effect}" data-ds-order="${order}" data-ds-step="${step}" data-ds-ease="${ease}" data-ds-distance="${distance}"${wait ? ` data-ds-wait="${wait}"` : ''}`;

export const sentence = (text, order = 0, tag = 'p', attrs = '') =>
  `<${tag} class="s"${attrs ? ` ${attrs}` : ''}>${text}<span class="veil" aria-hidden="true" data-ds-enter="peel-right" data-ds-order="${order}" data-ds-step="read" data-ds-ease="read" data-ds-wait="settle"></span></${tag}>`;

export const leaf = ({ species, color, x, y, w, angle = 0, seed = 1 }, order = 0, effect = 'fall', distance = '8') =>
  `<span class="lf" style="left:${x}%;top:${y}%;width:${w}%" data-ds-enter="${effect}" data-ds-order="${order}" data-ds-step="drift" data-ds-ease="drift" data-ds-distance="${distance}">${leafSvg(species, `var(--ds-color-${color})`, { seed, angle, paper: 'var(--ds-color-paper)' })}</span>`;

export const button = (text, href) => `<a class="btn" href="${href}">${text}</a>`;

export const section = (body, extra = '') => `<style>${CSS}${extra}</style><div class="wrap">${body}</div>\n`;

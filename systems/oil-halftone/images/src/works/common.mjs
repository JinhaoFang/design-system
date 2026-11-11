/*
 * Shared scoped web styling and markup helpers for the oil-halftone layouts and the showcase fragments.
 * Every value is a token variable (--ds-color-*, --ds-font-*, --ds-type-*, --ds-space-*, --ds-radius-*, --ds-duration-*, --ds-easing-*); no independent palette or motion values.
 * CSS is copied into each layout/fragment because the builder scopes each <style> block to its unit.
 * button(text, href, kind) renders the bloom button (SYSTEM.md 动效语言「晕开」): a celadon disc grows from the centre under the label while the label rolls up and an ink copy rolls in.
 *   Only transform and opacity transition; the rolled-in copy is aria-hidden; reduced motion drops the roll and fades the disc.
 * enter(order, effect, step, ease, distance, wait) writes the choreography attributes (docs/cli.md「入场动效」).
 */
export const CSS = `
:scope { position:relative; box-sizing:border-box; isolation:isolate; padding:var(--ds-space-9) var(--ds-space-8); background:var(--ds-color-paper); color:var(--ds-color-ink); font-family:var(--ds-font-body); font-size:var(--ds-type-body); line-height:1.75; }
:scope * { box-sizing:border-box; }
h1,h2,h3,p,ul,ol,li,figure,blockquote,dl,dd,dt { margin:0; padding:0; }
ul,ol { list-style:none; }
p,blockquote,figcaption,li { text-wrap:pretty; }
a { color:inherit; text-underline-offset:.3em; text-decoration-thickness:1px; }
a:focus-visible { outline:2px solid var(--ds-color-teal); outline-offset:var(--ds-space-1); border-radius:var(--ds-radius-card); }
.wrap { max-width:1240px; margin:0 auto; }
.serif { font-family:var(--ds-font-serif); font-weight:300; letter-spacing:-.03em; line-height:1.2; text-wrap:balance; }
.t-display { font-size:var(--ds-type-display); line-height:1.08; }
.t-title { font-size:var(--ds-type-title); line-height:1.12; }
.t-head { font-size:var(--ds-type-head); }
.t-sub { font-size:var(--ds-type-sub); line-height:1.45; }
.eyebrow { font-size:var(--ds-type-note); color:var(--ds-color-ink-2); letter-spacing:.06em; }
.lead { font-size:var(--ds-type-lead); color:var(--ds-color-ink-2); max-width:30em; line-height:1.7; }
.body { max-width:36em; }
.note { font-size:var(--ds-type-note); color:var(--ds-color-ink-2); }
.num { font-family:var(--ds-font-num); font-variant-numeric:tabular-nums lining-nums; }
.stack { display:grid; gap:var(--ds-space-5); align-content:start; }
.split { display:grid; grid-template-columns:minmax(0,5fr) minmax(0,7fr); gap:var(--ds-space-8); align-items:center; }
.paint { margin:0; }
.bleed-r { width:calc(100% + var(--ds-space-8)); max-width:none; }
.bleed-l { width:calc(100% + var(--ds-space-8)); max-width:none; justify-self:end; }
.paint img { display:block; width:100%; height:auto; mix-blend-mode:multiply; -webkit-mask-image:linear-gradient(to right,transparent,#000 6%,#000 94%,transparent),linear-gradient(to bottom,transparent,#000 6%,#000 94%,transparent); -webkit-mask-composite:source-in; mask-image:linear-gradient(to right,transparent,#000 6%,#000 94%,transparent),linear-gradient(to bottom,transparent,#000 6%,#000 94%,transparent); mask-composite:intersect; }
.rule-top { border-top:1px solid var(--ds-color-rule); padding-top:var(--ds-space-5); }
.actions { display:flex; flex-wrap:wrap; gap:var(--ds-space-3); align-items:center; }
.btn { position:relative; display:inline-flex; align-items:center; justify-content:center; min-height:calc(var(--ds-space-6) + var(--ds-space-3)); padding:0 var(--ds-space-5); border-radius:var(--ds-radius-pill); overflow:hidden; isolation:isolate; text-decoration:none; font-size:var(--ds-type-body); line-height:1; white-space:nowrap; }
.btn-solid { background:var(--ds-color-ink); color:var(--ds-color-paper); }
.btn-line { border:1px solid var(--ds-color-ink); color:var(--ds-color-ink); }
.btn-bloom { position:absolute; left:50%; top:50%; z-index:-1; width:calc(100% + var(--ds-space-3)); aspect-ratio:1; border-radius:var(--ds-radius-pill); background:var(--ds-color-celadon); opacity:0; transform:translate(-50%,-50%) scale(.02); transition:transform var(--ds-duration-bloom) var(--ds-easing-bloom), opacity var(--ds-duration-bloom) var(--ds-easing-bloom); pointer-events:none; }
.btn-roll { display:grid; overflow:hidden; padding:var(--ds-space-1) 0; }
.btn-t { grid-area:1 / 1; transition:transform var(--ds-duration-roll) var(--ds-easing-roll), opacity var(--ds-duration-roll) var(--ds-easing-roll); }
.btn-t2 { color:var(--ds-color-ink); transform:translateY(160%); opacity:0; visibility:hidden; }
.btn:hover .btn-bloom, .btn:focus-visible .btn-bloom { opacity:1; transform:translate(-50%,-50%) scale(1); }
.btn:hover .btn-t1, .btn:focus-visible .btn-t1 { transform:translateY(-160%); }
.btn:hover .btn-t2, .btn:focus-visible .btn-t2 { transform:translateY(0); opacity:1; visibility:visible; }
.btn:focus-visible { outline:2px solid var(--ds-color-teal); outline-offset:3px; border-radius:var(--ds-radius-pill); }
@media (max-width:860px) {
 :scope { padding:var(--ds-space-7) var(--ds-space-5); }
 .bleed-r, .bleed-l { width:calc(100% + var(--ds-space-6)); justify-self:center; }
 .split { grid-template-columns:1fr; gap:var(--ds-space-6); }
 .t-display { font-size:var(--ds-type-title); }
 .t-title { font-size:var(--ds-type-head); }
 .t-head { font-size:var(--ds-type-sub); }
 .lead { font-size:var(--ds-type-body); }
}
@media (prefers-reduced-motion:reduce) {
 .btn-t, .btn-bloom { transition:opacity var(--ds-duration-snap) var(--ds-easing-settle); }
 .btn-bloom { transform:translate(-50%,-50%) scale(1); }
 .btn-t2 { transform:none; opacity:0; }
 .btn:hover .btn-t1, .btn:focus-visible .btn-t1 { transform:none; opacity:0; }
 .btn:hover .btn-t2, .btn:focus-visible .btn-t2 { opacity:1; }
}
`;

export const enter = (order = 0, effect = 'rise', step = 'drift', ease = 'settle', distance = '3', wait = '') =>
  `data-ds-enter="${effect}" data-ds-order="${order}" data-ds-step="${step}" data-ds-ease="${ease}" data-ds-distance="${distance}"${wait ? ` data-ds-wait="${wait}"` : ''}`;

export const button = (text, href, kind = 'solid', attrs = '') =>
  `<a class="btn btn-${kind}" href="${href}"${attrs ? ` ${attrs}` : ''}><span class="btn-bloom" aria-hidden="true"></span><span class="btn-roll"><span class="btn-t btn-t1">${text}</span><span class="btn-t btn-t2" aria-hidden="true">${text}</span></span></a>`;

export const section = (body, extra = '') => `<style>${CSS}${extra}</style><div class="wrap">${body}</div>\n`;

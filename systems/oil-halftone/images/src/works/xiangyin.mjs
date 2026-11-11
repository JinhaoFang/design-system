/*
 * Showcase「乡音库 · 让机器听懂乡音」(works/web.json): the custom fragments and the one code-drawn picture of the work. Work concept「一句话的旅程」: one Cantonese sentence told by
 * 陈伯 in a Guangzhou teahouse travels through 录 → 写 → 校 → 回 and comes back to his own phone. Content outline confirmed by the user on 2026-11-11; institution, people and numbers are fictional.
 * FRAGMENTS: { file name -> HTML } written to works/fragments/. IMAGES(tokens): { id -> svg } — xie-wave, the recorded sentence drawn as a halftone waveform (dots = machine, SYSTEM.md 图像与画风).
 * Cantonese text and Jyutping were checked character by character: 我细个嗰阵，成日喺码头睇船 = ngo5 sai3 go3 go2 zan6, sing4 jat6 hai2 maa5 tau4 tai2 syun4; 听日会唔会落雨 = ting1 jat6 wui5 m4 wui5 lok6 jyu5.
 * The transcript comparison is CSS only (radio inputs + labels), so it works without scripts and the static render shows the first tab.
 */
import { button, enter, section } from './common.mjs';

const SAY = [['我', 'ngo5'], ['细', 'sai3'], ['个', 'go3'], ['嗰', 'go2'], ['阵', 'zan6'], ['，', ''], ['成', 'sing4'], ['日', 'jat6'], ['喺', 'hai2'], ['码', 'maa5'], ['头', 'tau4'], ['睇', 'tai2'], ['船', 'syun4'], ['。', '']];
const ruby = (pairs) => pairs.reduce((out, [c, j]) => (j ? [...out, [c, j]] : [...out.slice(0, -1), [out.at(-1)[0] + c, out.at(-1)[1]]]), []).map(([c, j]) => `<span class="ch"><span class="c">${c}</span><span class="j" aria-hidden="true">${j}</span></span>`).join('');
const img = (id, alt) => `<img src="images/${id}.webp" alt="${alt}">`;
const step = (n, name) => `<p class="step"><span class="num">${n}</span> · ${name}</p>`;
const STEP_CSS = `.step { font-size:var(--ds-type-note); color:var(--ds-color-teal); letter-spacing:.08em; }`;

const kaichang = section(
  `<header class="nav" id="top"><a class="brand serif" href="#top">乡音库</a><nav class="links"><a href="#zheyiju">一句话的旅程</a><a href="#xie">语音库</a><a href="#shengyin">讲述者的权利</a><a href="#canyu">参与</a></nav>${button('成为录音志愿者', '#canyu', 'line')}</header>
<div class="hero"><div class="stack copy"><p class="eyebrow" ${enter(0)}>一个开放的汉语方言语音库</p><h1 class="serif t-display" ${enter(0)}>让机器<br>听懂乡音。</h1><p class="lead" ${enter(1)}>很多老人一辈子只讲方言，手机却只听得懂普通话。乡音库请志愿者去茶楼、码头和村口，把老人讲的话一句句录下来、写下来，交给研究者和语音模型。</p><div class="actions" ${enter(2)}>${button('成为录音志愿者', '#canyu')}${button('跟着一句话走一遍', '#zheyiju', 'line')}</div></div><figure class="paint bleed-r" ${enter(1, 'right', 'linger', 'drift', '7')}>${img('chalou', '老茶楼里，一位老人比划着讲他小时候的事，年轻志愿者举着手机录音')}<figcaption class="note">陈伯在西关的老茶楼里讲他小时候的码头，志愿者小林举着手机录下了这一句。</figcaption></figure></div>`,
  `:scope { padding-top:var(--ds-space-5); }.nav { display:flex; align-items:center; gap:var(--ds-space-6); padding-bottom:var(--ds-space-5); border-bottom:1px solid var(--ds-color-rule); }.brand { font-size:var(--ds-type-sub); text-decoration:none; margin-right:auto; }.links { display:flex; gap:var(--ds-space-5); font-size:var(--ds-type-note); }.links a { text-decoration:none; }.links a:hover { text-decoration:underline; }
.hero { display:grid; grid-template-columns:minmax(0,5fr) minmax(0,7fr); gap:var(--ds-space-7); align-items:center; padding-top:var(--ds-space-8); }.copy { gap:var(--ds-space-5); }.copy h1 { margin:var(--ds-space-2) 0; }.hero figcaption { margin:var(--ds-space-3) var(--ds-space-9) 0 var(--ds-space-7); }
@media(max-width:860px){.links{display:none;}.hero{grid-template-columns:1fr;padding-top:var(--ds-space-6);}.hero figcaption{margin:var(--ds-space-3) var(--ds-space-5) 0;}}`
);

const zheyiju = section(
  `<div class="say-wrap" id="zheyiju"><p class="eyebrow" ${enter(0)}>这一句</p><p class="say serif" lang="yue" ${enter(0, 'rise', 'settle')}>${ruby(SAY)}</p><p class="gloss" ${enter(1)}>普通话：我小时候，常常在码头看船。</p><p class="note" ${enter(2)}>陈伯，八十三岁，广州西关人。2025 年 4 月录于一间老茶楼，长 4.2 秒。</p></div>
<ol class="route" data-ds-stagger="line"><li ${enter(0)}><a href="#lu"><span class="num">一</span>录</a></li><li ${enter(1)}><a href="#xie"><span class="num">二</span>写</a></li><li ${enter(2)}><a href="#jiao"><span class="num">三</span>校</a></li><li ${enter(3)}><a href="#hui"><span class="num">四</span>回</a></li></ol><p class="route-note" ${enter(4)}>它要走四步，才能回到陈伯的手机上。</p>`,
  `.say-wrap { display:grid; justify-items:center; text-align:center; gap:var(--ds-space-5); }.say { font-size:var(--ds-type-title); line-height:1.25; letter-spacing:0; }.say .ch { display:inline-flex; flex-direction:column; align-items:flex-start; }.say .j { font-family:var(--ds-font-num); font-size:var(--ds-type-caption); line-height:1.6; letter-spacing:0; color:var(--ds-color-ink-2); padding-left:var(--ds-space-1); }.gloss { font-size:var(--ds-type-lead); }
.route { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); margin:var(--ds-space-8) auto 0; max-width:880px; border-top:1px solid var(--ds-color-ink); }.route li { border-right:1px solid var(--ds-color-rule); }.route li:last-child { border-right:0; }.route a { display:flex; gap:var(--ds-space-3); align-items:baseline; justify-content:center; padding:var(--ds-space-4) 0; text-decoration:none; font-family:var(--ds-font-serif); font-weight:300; font-size:var(--ds-type-sub); }.route .num { font-family:var(--ds-font-body); font-size:var(--ds-type-note); color:var(--ds-color-teal); }.route-note { text-align:center; color:var(--ds-color-ink-2); margin-top:var(--ds-space-4); }
@media(max-width:860px){.say{font-size:var(--ds-type-head);}.route{grid-template-columns:1fr 1fr;}.route li:nth-child(2){border-right:0;}}`
);

const vignette = (id, cls, place, alt, order, effect) =>
  `<figure class="vig ${cls}" ${enter(order, effect, 'settle', 'drift', '6')}>${img(id, alt)}<figcaption class="note">${place}</figcaption></figure>`;
const lu = section(
  `<div class="field" id="lu" data-ds-stagger="float">${vignette('speaker-boatman', 'v1', '珠江口 · 船工 · 粤语', '戴草帽的老船工坐在船头笑着讲话，身边放着录音笔', 0, 'left')}${vignette('speaker-embroiderer', 'v2', '苏州 · 绣娘 · 苏州话', '银发绣娘坐在绣架前抬头说话，手机靠在绣架上录音', 1, 'right')}<div class="mid stack">${step('一', '录')}<h2 class="serif t-head" ${enter(0)}>去茶楼、码头<br>和村口</h2><p class="body" ${enter(1)}>志愿者带一部手机，坐下来听老人讲。不念稿，也不要标准发音：讲他自己的事，用他自己的话。一次录二十分钟，讲述者先听一遍回放，同意了才上传。</p></div>${vignette('speaker-fisher', 'v3', '泉州 · 渔民 · 闽南语', '老渔民在码头木箱上补网，箱子上放着录音笔', 2, 'left')}${vignette('speaker-singer', 'v4', '梅州 · 山歌手 · 客家话', '老妇人在茶园里拢手唱山歌，志愿者递过话筒', 3, 'right')}</div>`,
  `${STEP_CSS}.field { display:grid; grid-template-columns:minmax(0,3fr) minmax(0,5fr) minmax(0,3fr); grid-template-areas:"v1 mid v2" "v3 mid v4"; gap:var(--ds-space-6) var(--ds-space-7); align-items:center; }.mid { grid-area:mid; text-align:center; justify-items:center; }.mid .body { text-align:left; }.vig img { display:block; width:100%; height:auto; mix-blend-mode:multiply; -webkit-mask-image:radial-gradient(closest-side,#000 82%,transparent); mask-image:radial-gradient(closest-side,#000 82%,transparent); }.vig figcaption { margin-top:var(--ds-space-2); }.v1 { grid-area:v1; }.v2 { grid-area:v2; margin-top:var(--ds-space-8); }.v3 { grid-area:v3; margin-left:var(--ds-space-7); }.v4 { grid-area:v4; margin-right:var(--ds-space-6); }
@media(max-width:860px){.field{grid-template-columns:1fr 1fr;grid-template-areas:"mid mid" "v1 v2" "v3 v4";}.v2,.v3,.v4{margin:0;}}`
);

const WRONG = [['我', 0], ['是', 1], ['个', 0], ['个', 1], ['枕', 1], ['，', 0], ['城', 1], ['日', 0], ['黑', 1], ['马', 0], ['头', 0], ['题', 1], ['选', 1], ['。', 0]];
const xie = section(
  `<div class="board" id="xie"><div class="stack intro">${step('二', '写')}<h2 class="serif t-head" ${enter(0)}>同一句话，三种听法</h2><p class="body" ${enter(1)}>普通话训练出来的模型，把陈伯的话听成了一串同音字。用乡音库训练过的模型，这一句一个字都没错。最后一栏是懂粤语的志愿者写下的意思。</p></div>
<figure class="wave" ${enter(2, 'fade')}><img src="images/xie-wave.svg" alt="这句话的声波，用网点画成"><figcaption class="note">4.2 秒 · 16 kHz · 讲述者：陈伯</figcaption></figure>
<div class="tabs"><input type="radio" name="xie-tab" id="xie-a" checked><input type="radio" name="xie-tab" id="xie-b"><input type="radio" name="xie-tab" id="xie-c"><div class="tablist"><label for="xie-a">通用模型听到的</label><label for="xie-b">乡音库模型听到的</label><label for="xie-c">普通话意思</label></div>
<div class="panes"><div class="pane pane-a"><p class="line serif">${WRONG.map(([c, w]) => (w ? `<mark>${c}</mark>` : c)).join('')}</p><p class="score"><span class="num">58%</span> 字错误率：12 个字错了 7 个，画线的是错字</p></div><div class="pane pane-b"><p class="line serif" lang="yue">我细个嗰阵，成日喺码头睇船。</p><p class="score"><span class="num">0%</span> 字错误率：这一句全对；在乡音库的粤语测试集上是 7.9%</p></div><div class="pane pane-c"><p class="line serif">我小时候，常常在码头看船。</p><p class="score">由懂粤语的志愿者逐句写出，方言学者复核</p></div></div></div>
<p class="note fine">错误率为虚构示例。</p></div>`,
  `${STEP_CSS}.board { background:var(--ds-color-sage); border-radius:var(--ds-radius-panel); padding:var(--ds-space-8); display:grid; grid-template-columns:minmax(0,5fr) minmax(0,7fr); gap:var(--ds-space-6) var(--ds-space-8); }.intro { grid-row:span 2; }.wave img { display:block; width:100%; height:auto; }.wave figcaption { margin-top:var(--ds-space-2); }
.tabs { position:relative; }.tabs input { position:absolute; margin:0; opacity:0; pointer-events:none; }.tablist { display:flex; flex-wrap:wrap; gap:var(--ds-space-2); margin-bottom:var(--ds-space-5); }.tablist label { cursor:pointer; padding:var(--ds-space-2) var(--ds-space-4); border-radius:var(--ds-radius-pill); border:1px solid var(--ds-color-ink); font-size:var(--ds-type-note); }
#xie-a:checked ~ .tablist [for=xie-a], #xie-b:checked ~ .tablist [for=xie-b], #xie-c:checked ~ .tablist [for=xie-c] { background:var(--ds-color-ink); color:var(--ds-color-paper); }
#xie-a:focus-visible ~ .tablist [for=xie-a], #xie-b:focus-visible ~ .tablist [for=xie-b], #xie-c:focus-visible ~ .tablist [for=xie-c] { outline:2px solid var(--ds-color-teal); outline-offset:3px; }
.pane { display:none; background:var(--ds-color-paper); border-radius:var(--ds-radius-card); padding:var(--ds-space-6); }#xie-a:checked ~ .panes .pane-a, #xie-b:checked ~ .panes .pane-b, #xie-c:checked ~ .panes .pane-c { display:block; }
.line { font-size:var(--ds-type-sub); line-height:1.5; letter-spacing:0; }.line mark { background:none; color:inherit; text-decoration:underline; text-decoration-color:var(--ds-color-teal); text-decoration-thickness:2px; text-underline-offset:.18em; }.score { margin-top:var(--ds-space-4); color:var(--ds-color-ink-2); font-size:var(--ds-type-note); }.score .num { font-size:var(--ds-type-lead); color:var(--ds-color-ink); margin-right:var(--ds-space-2); }.fine { grid-column:2; }
@media(max-width:860px){.board{grid-template-columns:1fr;padding:var(--ds-space-6) var(--ds-space-5);}.intro{grid-row:auto;}.fine{grid-column:1;}.line{font-size:var(--ds-type-lead);}}`
);

const GROUPS = [['官话', 286], ['吴语', 92], ['闽语', 88], ['粤语', 74], ['客家话', 61], ['湘语', 39], ['赣语', 34], ['晋语', 22], ['徽语', 10], ['平话和土话', 6]];
const jiao = section(
  `<div class="giant-row" id="jiao"><p class="giant serif num" aria-hidden="true" ${enter(0, 'rise', 'linger', 'drift', '5')}>712</p><div class="stack side">${step('三', '校')}<h2 class="serif t-head" ${enter(1)}>712 个方言点，每一句都有懂这种话的人再听一遍</h2><p class="body" ${enter(2)}>转写交给方言学者复核：字对不对，本字怎么写，粤拼标得准不准。有争议的句子，带回讲述者的村子里再问一次。</p></div></div>
<ul class="groups" data-ds-stagger="line">${GROUPS.map(([g, n], i) => `<li ${enter(i, 'fade', 'settle')}><span class="num">${n}</span>${g}</li>`).join('')}</ul>`,
  `${STEP_CSS}.giant-row { display:grid; grid-template-columns:minmax(0,7fr) minmax(0,5fr); gap:var(--ds-space-7); align-items:end; }.giant { font-size:var(--ds-type-giant); line-height:.78; letter-spacing:-.05em; font-variant-numeric:lining-nums proportional-nums; font-family:var(--ds-font-serif); }.side { padding-bottom:var(--ds-space-5); }
.groups { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:0 var(--ds-space-5); margin-top:var(--ds-space-8); border-top:1px solid var(--ds-color-ink); }.groups li { display:flex; gap:var(--ds-space-3); align-items:baseline; padding:var(--ds-space-3) 0; border-bottom:1px solid var(--ds-color-rule); }.groups .num { font-size:var(--ds-type-lead); min-width:2.4em; }
@media(max-width:860px){.giant-row{grid-template-columns:1fr;}.giant{font-size:var(--ds-type-colossal);}.groups{grid-template-columns:1fr 1fr;}}`
);

const hui = section(
  `<div class="back" id="hui"><figure class="paint bleed-l" ${enter(0, 'left', 'linger', 'drift', '7')}>${img('huilai', '雨天的窗边，老人把手机凑到嘴边问话，露出笑容')}</figure><div class="stack">${step('四', '回')}<p class="eyebrow" ${enter(0)}>一年以后</p><h2 class="serif t-title" lang="yue" ${enter(0)}>听日会唔会落雨？</h2><p class="jp num" ${enter(1)}>ting1 jat6 wui5 m4 wui5 lok6 jyu5</p><p class="lead" ${enter(2)}>陈伯对着手机问明天的天气。这一次，它听懂了。</p><p class="answer" ${enter(3)}>手机答：「听日有雨，出街记得带遮。」</p></div></div>`,
  `${STEP_CSS}.back { display:grid; grid-template-columns:minmax(0,7fr) minmax(0,5fr); gap:var(--ds-space-7); align-items:center; }.jp { color:var(--ds-color-ink-2); font-size:var(--ds-type-note); }.answer { border-left:1px solid var(--ds-color-teal); padding-left:var(--ds-space-4); }
@media(max-width:860px){.back{grid-template-columns:1fr;}}`
);

const DATA = [['9,600', '位讲述者签了授权书'], ['18,400', '小时录音'], ['2,300', '名录音志愿者'], ['7 天', '内处理撤回申请']];
const RIGHTS = ['录之前，先讲清楚录来做什么、给谁用', '讲述者本人签字授权；不识字的，由家人读给他听再按手印', '想收回，发一条消息，七天内从语音库和训练集里删除', '研究者和模型只能用授权过的部分'];
const shengyin = section(
  `<div class="rights" id="shengyin"><div class="stack"><h2 class="serif t-title" ${enter(0)}>声音属于讲述者</h2><ol class="list" data-ds-stagger="line">${RIGHTS.map((r, i) => `<li ${enter(i)}><span class="num">${i + 1}</span>${r}</li>`).join('')}</ol></div><figure class="hands" ${enter(1, 'right', 'settle', 'drift', '6')}>${img('shou', '一只戴玉镯的苍老的手和一只年轻的手，在深青色背景前递着同一部手机')}</figure></div>
<dl class="cards" data-ds-stagger="line">${DATA.map(([n, l], i) => `<div class="card" ${enter(i)}><dt class="num">${n}</dt><dd>${l}</dd></div>`).join('')}</dl><p class="fine">数字为虚构示例。</p>`,
  `:scope { background:var(--ds-color-teal); color:var(--ds-color-paper); }.rights { display:grid; grid-template-columns:minmax(0,6fr) minmax(0,5fr); gap:var(--ds-space-8); align-items:center; }.list { display:grid; gap:0; border-top:1px solid var(--ds-color-teal-deep); }.list li { display:grid; grid-template-columns:var(--ds-space-6) minmax(0,1fr); padding:var(--ds-space-4) 0; border-bottom:1px solid var(--ds-color-teal-deep); }.list .num { color:var(--ds-color-sage); }.hands { margin:0; }.hands img { display:block; width:100%; height:auto; border-radius:var(--ds-radius-panel); }
.cards { display:grid; grid-template-columns:minmax(0,5fr) minmax(0,4fr) minmax(0,4fr) minmax(0,3fr); gap:var(--ds-space-3); margin-top:var(--ds-space-8); }.card { background:var(--ds-color-paper); color:var(--ds-color-ink); border-radius:var(--ds-radius-card); padding:var(--ds-space-5); display:grid; gap:var(--ds-space-2); }.card dt { font-size:var(--ds-type-head); line-height:1; letter-spacing:-.02em; }.card dd { font-size:var(--ds-type-note); color:var(--ds-color-ink-2); }.fine { font-size:var(--ds-type-caption); margin-top:var(--ds-space-3); }
@media(max-width:860px){.rights{grid-template-columns:1fr;}.cards{grid-template-columns:1fr 1fr;}}`
);

const qunxiang = section(
  `<figure class="crowd" ${enter(0, 'fade', 'linger')}>${img('crowd', '一排来自各地的老人并肩站着，穿着各自的日常衣服，有人在笑')}<figcaption class="note">第一年来录音的讲述者，按录音先后排。</figcaption></figure>`,
  `:scope { padding-top:var(--ds-space-6); padding-bottom:0; }.crowd { width:calc(100% + var(--ds-space-9)); margin:0; position:relative; left:calc(var(--ds-space-8) * -1); }.crowd img { display:block; width:100%; height:auto; mix-blend-mode:multiply; }.crowd figcaption { text-align:center; margin-top:var(--ds-space-3); }@media(max-width:860px){.crowd{width:calc(100% + var(--ds-space-6));left:calc(var(--ds-space-5) * -1);}}`
);

export const FRAGMENTS = {
  'kaichang.html': kaichang,
  'zheyiju.html': zheyiju,
  'lu.html': lu,
  'xie.html': xie,
  'jiao.html': jiao,
  'hui.html': hui,
  'shengyin.html': shengyin,
  'qunxiang.html': qunxiang,
};

export function IMAGES(tokens) {
  const ink = tokens.color.ink.$value.hex;
  const teal = tokens.color.teal.$value.hex;
  const W = 1200, H = 220, cols = 150;
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const syllables = [0.06, 0.13, 0.19, 0.25, 0.31, 0.43, 0.5, 0.56, 0.63, 0.69, 0.76, 0.83, 0.9];
  const parts = [];
  for (let i = 0; i < cols; i++) {
    const t = i / (cols - 1);
    const env = Math.max(0.04, ...syllables.map((c) => Math.exp(-((t - c) ** 2) / 0.0007) * (0.55 + 0.45 * rand())));
    const x = 12 + t * (W - 24);
    const rows = Math.round(env * 13);
    for (let k = -rows; k <= rows; k++) {
      const fade = 1 - Math.abs(k) / (rows + 1);
      parts.push(`<circle cx="${x.toFixed(1)}" cy="${(H / 2 + k * 7.5).toFixed(1)}" r="${(0.9 + 2.3 * fade).toFixed(2)}" fill="${ink}"/>`);
    }
  }
  [[4, 96], [12, 124], [1186, 88], [1194, 132], [1176, 110]].forEach(([x, y]) => parts.push(`<rect x="${x}" y="${y}" width="5" height="5" fill="${teal}"/>`));
  return { 'xie-wave': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${parts.join('')}</svg>\n` };
}

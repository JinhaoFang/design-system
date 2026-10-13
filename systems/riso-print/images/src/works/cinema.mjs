/*
 * The four custom fragments of the riso-print showcase「纱厂屋顶 · 秋夜露天电影季」(works/web.json), written to works/fragments/ by build.mjs.
 *   kaichang-haibao.html  opening poster: two-line title whose pink plate is outlined from the display font and lands last (the page's one misregistration), lead, the action stamp, projector picture.
 *   pianmu-qiang.html     the film wall: six generated scene posters, each with its number, title, year, director and its nights; on hover a pink plate slides out from under the poster.
 *   shichang-shiban.html  ten nights, ten editions: the riso stall picture and ten numbered night tickets (the work concept「每一场都是一版套色」); live-music nights carry a pink tag.
 *   wuding-manban.html    the single full-bleed moment: the rooftop audience picture across the page, a blue band of text under it, never text on the picture.
 * Pictures are the separated two-drum WebP files in images/ (see images/src/prompts/README.md) referenced as <img src="images/<id>.webp">; their alt text lives in the fragments, briefs in works/web.json.
 * Copy follows the user-confirmed content (2026-10-13, #63): ten Friday/Saturday nights 2026-11-06 to 2026-12-05 at 19:30; 200 seats; live music on the opening and closing nights (both silent programmes).
 * Pink title plates are aria-hidden; the blue title stays live text on the same glyph advances. Entrance roles follow SYSTEM.md 高光时刻: title 0, lead and picture 1, stamp 2, pink plate 3 waiting for roll.
 */
import { baseline, textPath } from '../lib/glyphs.mjs';
import { HEX } from '../lib/plate.mjs';
import { enter, section } from './common.mjs';

export const FILMS = [
  { id: 'film-moon', title: '月球旅行记', year: 1902, place: '法国', by: '乔治·梅里爱', kind: '默片', nights: ['11.06'], alt: '一枚炮弹形的舱体扎进布满环形山的月亮，下方是舞台布景式的云' },
  { id: 'film-locomotive', title: '将军号', year: 1926, place: '美国', by: '巴斯特·基顿', kind: '默片', nights: ['11.06', '11.21'], alt: '老式蒸汽机车冒着浓烟驶过峡谷上的木栈桥' },
  { id: 'film-lamp', title: '神女', year: 1934, place: '中国', by: '吴永刚', kind: '默片', nights: ['11.20', '12.05'], alt: '雨夜的石库门弄堂，一盏路灯下，穿旗袍的女人牵着孩子走远' },
  { id: 'film-windows', title: '马路天使', year: 1937, place: '中国', by: '袁牧之', kind: '有声', nights: ['11.07', '11.27'], alt: '夜里两栋石库门隔着窄弄相对，一扇窗向另一扇窗抛过一只橘子' },
  { id: 'film-wall', title: '小城之春', year: 1948, place: '中国', by: '费穆', kind: '有声', nights: ['11.13', '11.28'], alt: '春天的小城，一个系丝巾的女人独自走在残破的城墙上' },
  { id: 'film-birds', title: '乌鸦与麻雀', year: 1949, place: '中国', by: '郑君里', kind: '有声', nights: ['11.14', '12.04'], alt: '一栋挤满租客的三层石库门，屋脊上停着乌鸦，窗台和电线上是麻雀' },
];

export const NIGHTS = [
  ['11.06', '周五', '<span class="nw">月球旅行记</span> + <span class="nw">将军号</span>', true],
  ['11.07', '周六', '马路天使', false],
  ['11.13', '周五', '小城之春', false],
  ['11.14', '周六', '乌鸦与麻雀', false],
  ['11.20', '周五', '神女', false],
  ['11.21', '周六', '将军号', false],
  ['11.27', '周五', '马路天使', false],
  ['11.28', '周六', '小城之春', false],
  ['12.04', '周五', '乌鸦与麻雀', false],
  ['12.05', '周六', '神女', true],
];

const titleLine = (text, size) => {
  const outline = textPath(text, { font: 'qingke', size, x: 0, y: baseline('qingke', size, 1.16), fill: HEX.pink });
  const h = Math.round(size * 1.16);
  return `<span class="title-line"><svg class="pink-title" viewBox="0 0 ${outline.width} ${h}" width="${outline.width}" height="${h}" aria-hidden="true" ${enter(3, 'left', 'set', 'set', 'roll')}>${outline.svg}</svg><span class="blue-title">${text}</span></span>`;
};

function opening() {
  return { name: 'kaichang-haibao.html', text: section(`<header class="mast"><span>南岸纱厂 · 屋顶放映</span><span class="num">2026 秋 · 第二季</span></header><div class="poster-grid"><div><p class="eyebrow" ${enter(0, 'fade', 'snap', 'ink')}>老片新映 · 六部片 · 十个晚上</p><h1 class="poster-title" ${enter(0)}>${titleLine('纱厂屋顶', 100)}${titleLine('秋夜电影季', 100)}</h1><p class="lead" ${enter(1)}>旧纺织厂的屋顶上支起一块银幕。11 月 6 日到 <span class="nw">12 月 5 日</span>，每周五、六 19:30，放六部老电影。</p><a class="stamp" href="#riso-tickets" ${enter(2)}>领票<br>→</a></div><figure ${enter(1, 'left', 'roll')}><img src="images/projector-night.webp" width="1200" height="800" alt="纱厂屋顶的女儿墙上架着一台老式放映机，粉色光束射向夜空，左边是砖砌烟囱"><figcaption class="note">放映机架在女儿墙上，光一直打到对岸。</figcaption></figure></div><div class="poster-foot num"><span>11.06 — 12.05 · 周五、周六 19:30 · 200 座</span><span>蓝 / 荧光粉 · 双墨印制</span></div>`, `
:scope{padding-top:var(--ds-space-6);padding-bottom:var(--ds-space-6);}
.mast,.poster-foot{display:flex;justify-content:space-between;gap:var(--ds-space-5);font-size:var(--ds-type-note);}
.mast{border-bottom:6px solid var(--ds-color-blue);padding-bottom:var(--ds-space-4);}
.poster-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:var(--ds-space-8);align-items:center;margin:var(--ds-space-7) 0;}
.eyebrow{margin-bottom:var(--ds-space-5);font-size:var(--ds-type-note);}
.poster-title{font-family:var(--ds-font-display);font-weight:400;font-size:var(--ds-type-display);line-height:1.16;}
.title-line{position:relative;display:block;width:fit-content;white-space:nowrap;}
.pink-title{position:absolute;inset:0;width:100%;height:100%;overflow:visible;translate:var(--ds-space-1) calc(var(--ds-space-1) / -2);}
.blue-title{position:relative;mix-blend-mode:multiply;}
.poster-grid .lead{margin-top:var(--ds-space-6);max-width:24em;}
.nw{white-space:nowrap;}
.stamp{margin-top:var(--ds-space-6);font-size:var(--ds-type-lead);line-height:1.3;}
figure img{display:block;width:100%;height:auto;}
figcaption{margin-top:var(--ds-space-3);}
.poster-foot{border-top:2px solid var(--ds-color-blue);padding-top:var(--ds-space-4);}
@media(max-width:860px){:scope{padding-top:var(--ds-space-5);}.poster-grid{grid-template-columns:1fr;gap:var(--ds-space-6);}.poster-title{font-size:var(--ds-type-title);}.mast,.poster-foot{flex-wrap:wrap;gap:var(--ds-space-2) var(--ds-space-5);}}
`) };
}

function wall() {
  const cards = FILMS.map((f, i) => `<li class="film" ${enter(i, 'fall', 'set', 'press')}><figure class="sheet"><img src="images/${f.id}.webp" width="720" height="1080" loading="lazy" alt="《${f.title}》场景海报：${f.alt}"></figure><div class="film-head"><span class="num film-no">${String(i + 1).padStart(2, '0')}</span><h3>《${f.title}》</h3></div><p class="film-meta num">${f.year} · ${f.place} · ${f.by} · ${f.kind}</p><p class="film-nights num">放映 ${f.nights.join(' / ')}</p></li>`).join('');
  return { name: 'pianmu-qiang.html', text: section(`<div id="riso-films"><h2 class="heading print-heading" ${enter(0)}>六部老片，一部一张海报</h2><p class="lead" ${enter(1)}>全部是已进入公有领域的影片。默片场请来现场乐队配乐，有声片配中文字幕。</p><div class="stripe" aria-hidden="true"></div><ol class="films" data-ds-stagger="line">${cards}</ol></div>`, `
.films{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--ds-space-7) var(--ds-space-6);margin-top:var(--ds-space-6);}
.film{display:grid;gap:var(--ds-space-3);align-content:start;}
.film:nth-child(3n+2){margin-top:var(--ds-space-8);}
.sheet{position:relative;isolation:isolate;}
.sheet::before{content:"";position:absolute;inset:0;background:var(--ds-color-pink);z-index:-1;opacity:0;transform:translate(0,0);transition:transform var(--ds-duration-set) var(--ds-easing-press),opacity var(--ds-duration-press) var(--ds-easing-feed);}
.sheet img{display:block;width:100%;height:auto;aspect-ratio:3/4;object-fit:cover;object-position:center 40%;border:2px solid var(--ds-color-blue);transition:transform var(--ds-duration-set) var(--ds-easing-press);}
.film:hover .sheet::before{opacity:1;transform:translate(var(--ds-space-2),calc(var(--ds-space-2) * -1));}
.film:hover .sheet img{transform:translate(calc(var(--ds-space-1) * -1),var(--ds-space-1));}
.film-head{display:flex;align-items:baseline;gap:var(--ds-space-3);border-top:2px solid var(--ds-color-blue);padding-top:var(--ds-space-3);margin-top:var(--ds-space-2);}
.film-no{font-family:var(--ds-font-num-bold);font-weight:700;font-size:var(--ds-type-head);line-height:1;}
.film h3{font-size:var(--ds-type-lead);font-weight:700;}
.film-meta,.film-nights{font-size:var(--ds-type-note);}
.film-nights{font-weight:700;}
@media(max-width:860px){.films{grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--ds-space-6) var(--ds-space-4);}.film:nth-child(3n+2){margin-top:0;}.film:nth-child(2n){margin-top:var(--ds-space-7);}.film-no{font-size:var(--ds-type-sub);}.film h3{font-size:var(--ds-type-body);}}
@media(prefers-reduced-motion:reduce){.sheet::before,.sheet img{transition:none;}.film:hover .sheet::before{transform:none;opacity:0;}.film:hover .sheet img{transform:none;}}
`) };
}

function editions() {
  const tickets = NIGHTS.map(([date, day, film, live], i) => `<li class="ticket${live ? ' live' : ''}" ${enter(i, 'fall', 'press', 'press')}><span class="ed num">第 ${String(i + 1).padStart(2, '0')} 版</span><span class="date num">${date}</span><span class="day">${day} 19:30</span><span class="what">${film}</span>${live ? '<span class="tag">现场乐队</span>' : ''}</li>`).join('');
  return { name: 'shichang-shiban.html', text: section(`<div id="riso-nights"><div class="top"><div class="stack"><h2 class="heading print-heading" ${enter(0)}>十个晚上，印十版</h2><p class="lead" ${enter(1)}>每晚 19:00，孔版摊在屋顶现场开印当晚这一版海报，印满 200 张为止，凭票领一张带走。</p><p class="note">两场默片之夜有现场乐队：开幕夜 11.06，闭幕夜 12.05。</p></div><figure ${enter(1, 'left', 'roll')}><img src="images/riso-stall.webp" width="800" height="800" loading="lazy" alt="屋顶的折叠桌上放着一台孔版印刷机，刚印好的海报从机器里滑出，旁边码着一摞"><figcaption class="note">二号孔版工作室的机器，每晚换一版。</figcaption></figure></div><ol class="tickets" data-ds-stagger="line">${tickets}</ol></div>`, `
.top{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:var(--ds-space-8);align-items:center;}
.top figure img{display:block;width:100%;height:auto;}
figcaption{margin-top:var(--ds-space-3);}
.tickets{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));margin-top:var(--ds-space-7);border-top:6px solid var(--ds-color-blue);}
.ticket{display:grid;gap:var(--ds-space-1);align-content:start;padding:var(--ds-space-4) var(--ds-space-4) var(--ds-space-5);border-bottom:2px solid var(--ds-color-blue);border-right:2px dashed var(--ds-color-blue);}
.ticket:nth-child(5n){border-right:0;}
.ed{font-size:var(--ds-type-note);}
.date{font-family:var(--ds-font-num-bold);font-weight:700;font-size:var(--ds-type-head);line-height:1.1;}
.day{font-size:var(--ds-type-note);}
.what{font-weight:700;margin-top:var(--ds-space-2);}
.nw{white-space:nowrap;}
.tag{justify-self:start;margin-top:var(--ds-space-2);padding:0 var(--ds-space-2);background:var(--ds-color-pink);color:var(--ds-color-purple);font-size:var(--ds-type-note);font-weight:700;}
@media(max-width:860px){.top{grid-template-columns:1fr;gap:var(--ds-space-6);}.tickets{grid-template-columns:repeat(2,minmax(0,1fr));}.ticket{padding:var(--ds-space-3) var(--ds-space-3) var(--ds-space-4);}.ticket:nth-child(5n){border-right:2px dashed var(--ds-color-blue);}.ticket:nth-child(2n){border-right:0;}.date{font-size:var(--ds-type-sub);}}
`) };
}

function rooftop() {
  return { name: 'wuding-manban.html', text: section(`<figure class="bleed" ${enter(0, 'fade', 'roll', 'feed')}><img src="images/rooftop-audience.webp" width="1600" height="1012" loading="lazy" alt="纱厂屋顶的夜晚，几十位观众裹着毯子坐在银幕前，放映机的粉色光束越过人群，背后是烟囱和水塔"></figure><div class="band"><h2 class="heading" ${enter(0)}>200 个座位，头顶是城市的夜空</h2><p class="body" ${enter(1)}>屋顶没有遮挡，带一件厚外套。毯子和热饮在入口领，散场时把毯子放回门口的木箱。</p></div>`, `
:scope{padding:0;background:var(--ds-color-blue);color:var(--ds-color-paper);}
.wrap{max-width:none;}
.bleed img{display:block;width:100%;height:auto;max-height:88vh;object-fit:cover;object-position:center 60%;background:var(--ds-color-paper);}
.band .heading{word-break:keep-all;}
.band{max-width:1240px;margin:0 auto;padding:var(--ds-space-7) var(--ds-space-8);display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:var(--ds-space-8);align-items:end;}
@media(max-width:860px){.band{grid-template-columns:1fr;gap:var(--ds-space-4);padding:var(--ds-space-6) var(--ds-space-5);}.bleed img{max-height:none;}}
`) };
}

export const CINEMA_FRAGMENTS = [opening, wall, editions, rooftop];

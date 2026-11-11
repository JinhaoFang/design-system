/*
 * Showcase「栖桐植物园百年 · 致每一位种过树的人」(works/web.json): the custom fragments. Work concept「一百年，每一片叶子都不一样」: one set of cut-paper leaves is a bunch in the hero,
 * comes apart beside the letter, hangs as eight labelled leaves next to the sheet they were cut from, falls again, and finally gathers into one tree (the only highlight). Subject chosen by the user on 2026-11-11;
 * garden, people and numbers are fictional. The numbers section and the footer use the system's own layouts (evidence/jianzi, footer/diye) from the work description.
 * FRAGMENTS: { file name -> HTML } written to works/fragments/. Sentences of the letter use sentence() (one line each, paper veil peels right as the line comes into view).
 */
import { bouquet, drift, sheet, tree, trunk } from '../art/arrange.mjs';
import { leafSvg } from '../lib/leaves.mjs';
import { button, enter, leaf, section, sentence } from './common.mjs';

const field = (cls, leaves, label, effect = 'fall', distance = '8') =>
  `<div class="field ${cls}" role="img" aria-label="${label}" data-ds-stagger="leaf">${leaves.map((l, i) => leaf(l, i, effect, distance)).join('')}</div>`;

const LETTER_1 = ['一百年前，栖桐还是城北的一片乱石坡。', '第一批来种树的，是附近中学的十二个学生，和他们的植物课老师。', '后来，来的人越来越多：退休的工人，带着孩子的父母，放了学的少年。', '有人只来过一个春天，有人一来就是四十年。', '有人认得三百种草，有人只会浇水。', '有人一边挖坑一边讲他年轻时的事，有人一整天不说一句话。', '你们没有一个人是一样的。', '就像园子里的叶子：银杏是一把扇子，枫是一只手掌，蕨是一串细细的羽毛。', '也正因为不一样，这里才长成了一座园子，而不是一片林场。'];
const LETTER_2 = ['这一百年里，园子有三次差点没了。', '1956 年的台风，把坡上的树刮倒了一半，是你们一棵一棵扶起来、补种上。', '1998 年的大水淹了温室，你们排成一条长队，把两千盆兰花传上了山坡。', '2020 年园门关了半年，还是有人每天隔着围栏，给苗圃浇水。', '我们没法记住每个人的名字。', '但园子记得：哪一棵树是谁种的，哪一条小路是谁铺的。', '谢谢你们。', '下一个一百年，还请常来走走。'];

const kaichang = section(
  `<header class="top"><span>栖桐植物园</span><span class="num">1926—2026</span></header>
${field('bunch', bouquet(44, 3, 37), '几十片形状、颜色各不相同的剪纸叶子，聚成圆圆的一束', 'fade', '5')}
<div class="title"><h1 class="t-head" ${enter(0, 'rise', 'settle', 'settle', '3', 'drift')}>致每一位种过树的人</h1><p class="note" ${enter(1, 'fade', 'settle', 'settle', '3', 'drift')}>栖桐植物园百年 · 一封信，大约读四分钟</p><a class="down" href="#xin" ${enter(2, 'fade', 'settle', 'settle', '3', 'drift')}><span class="dot" aria-hidden="true"></span>往下读</a></div>`,
  `:scope { padding-top:var(--ds-space-6); padding-bottom:var(--ds-space-9); }.top { display:flex; justify-content:space-between; font-size:var(--ds-type-note); color:var(--ds-color-ink-2); }.bunch { width:min(560px, 86%); aspect-ratio:1; margin:var(--ds-space-6) auto 0; }
@media(max-width:860px){.title h1{font-size:var(--ds-type-head);}}.title { display:grid; justify-items:center; gap:var(--ds-space-3); text-align:center; margin-top:var(--ds-space-6); }.down { display:grid; justify-items:center; gap:var(--ds-space-2); font-size:var(--ds-type-note); text-decoration:none; color:var(--ds-color-ink-2); margin-top:var(--ds-space-5); }.dot { width:var(--ds-space-2); height:var(--ds-space-2); border-radius:var(--ds-radius-pill); background:var(--ds-color-cobalt); }`
);

const xin1 = section(
  `<div class="pair" id="xin"><div class="letter" data-ds-stagger="sentence">${sentence('致每一位种过树的人：', 0, 'p', 'data-greeting')}${LETTER_1.map((t, i) => sentence(t, i + 1)).join('')}</div>${field('loose', drift([[30, 2], [58, 10], [12, 22], [64, 34], [28, 46], [70, 58], [8, 68], [44, 80], [62, 90]], 11, 22), '几片叶子从叶束上散开，一片接一片往下飘')}</div>`,
  `.pair { display:grid; grid-template-columns:minmax(0,8fr) minmax(0,4fr); gap:var(--ds-space-8); align-items:stretch; }.pair .letter { max-width:36em; }.loose { min-height:100%; }[data-greeting] { margin-bottom:var(--ds-space-4); }
@media(max-width:860px){.pair{grid-template-columns:1fr;}.loose{min-height:0;aspect-ratio:2 / 1;}}`
);

const TAGS = [
  ['ginkgo', 'mustard', '银杏', '周素芬 · 1987 年起', '认得出园里每一棵银杏是雌是雄'],
  ['maple', 'vermilion', '枫', '冯师傅 · 1964 年起', '退休前是锅炉工，给温室烧了二十个冬天的火'],
  ['fern', 'sprout', '蕨', '林小禾 · 2019 年起', '十一岁，蕨类区的标牌都是她写的'],
  ['willow', 'pine', '柳', '何建国 · 1978 年起', '下雨天也来，说柳树喝饱了水最好看'],
  ['lotus', 'indigo', '荷', '苏老师 · 2003 年起', '每年夏天在荷塘边，教盲童摸荷叶'],
  ['monstera', 'cobalt', '龟背竹', '马克 · 2011 年起', '从马赛来的交换生，后来留在了这座城市'],
  ['eucalyptus', 'persimmon', '桉', '陈立平 · 1995 年起', '园里的旧水管，几乎都是他修的'],
  ['heart', 'peach', '心叶藤', '赵家三代 · 1952 年起', '祖孙三人，先后种了同一片坡'],
];
const HOLES = TAGS.map(([species], i) => ({ species, seed: i + 1, x: 25 + (i % 2) * 50, y: 18 + Math.floor(i / 2) * 22, w: 30, angle: (i % 2 ? 1 : -1) * (12 + i * 3) }));
const yeqian = section(
  `<div class="wall"><figure class="neg" ${enter(0, 'fade', 'drift')}>${sheet('var(--ds-color-cobalt)', HOLES, { id: 'qitong-holes' })}<figcaption class="note">八片叶子从这张色纸上剪下来，纸上留下了它们的样子。</figcaption></figure>
<div class="stack"><h2 class="t-sub" ${enter(0)}>园里每一片叶子都有名字，这里是其中八片</h2><ul class="tags" data-ds-stagger="leaf">${TAGS.map(([sp, color, name, who, what], i) => `<li class="tag" ${enter(i, 'fall', 'drift', 'drift', '7')}><span class="tag-leaf">${leafSvg(sp, `var(--ds-color-${color})`, { seed: i + 1, angle: (i % 2 ? 1 : -1) * (12 + i * 3), paper: 'var(--ds-color-paper)' })}</span><span class="label"><span class="name">${name}</span><span class="who">${who}</span><span class="what">${what}</span></span></li>`).join('')}</ul></div></div>`,
  `.wall { display:grid; grid-template-columns:minmax(0,4fr) minmax(0,8fr); gap:var(--ds-space-8); align-items:start; }.neg svg { display:block; width:100%; height:auto; }.neg figcaption { margin-top:var(--ds-space-3); }
.tags { display:grid; grid-template-columns:1fr 1fr; gap:var(--ds-space-5) var(--ds-space-7); margin-top:var(--ds-space-5); }.tag { display:grid; grid-template-columns:var(--ds-space-9) minmax(0,1fr); gap:var(--ds-space-4); align-items:center; }.tag:nth-child(even) { margin-top:var(--ds-space-7); }.tag-leaf svg { display:block; width:100%; height:auto; overflow:visible; }
.label { display:grid; gap:var(--ds-space-1); background:var(--ds-color-paper-deep); padding:var(--ds-space-3) var(--ds-space-6) var(--ds-space-3) var(--ds-space-4); clip-path:polygon(0 0,100% 0,calc(100% - var(--ds-space-4)) 50%,100% 100%,0 100%); }.name { font-size:var(--ds-type-lead); }.who { font-size:var(--ds-type-note); color:var(--ds-color-ink-2); }.what { font-size:var(--ds-type-note); }
@media(max-width:860px){.wall{grid-template-columns:1fr;}.neg{max-width:280px;}.tags{grid-template-columns:1fr;}.tag:nth-child(even){margin-top:0;}}`
);

const xin2 = section(
  `<div class="pair">${field('falling', drift([[20, 4], [56, 18], [10, 36], [50, 52], [26, 70], [62, 84]], 23, 24), '叶子继续往下飘落', 'fall', '9')}<div class="letter" data-ds-stagger="sentence">${LETTER_2.map((t, i) => sentence(t, i)).join('')}<div class="sign" ${enter(0, 'fade', 'drift')}><p>栖桐植物园 园长 林青禾</p><p class="note">2026 年 1 月，写于园中</p></div></div></div>`,
  `.pair { display:grid; grid-template-columns:minmax(0,4fr) minmax(0,8fr); gap:var(--ds-space-8); align-items:stretch; }.pair .letter { max-width:36em; }.falling { min-height:100%; }.sign { display:grid; justify-items:end; gap:var(--ds-space-1); margin-top:var(--ds-space-6); font-size:var(--ds-type-body); line-height:1.8; }
@media(max-width:860px){.pair{grid-template-columns:1fr;}.falling{order:2;min-height:0;aspect-ratio:2 / 1;}}`
);

const zhongshu = section(
  `<div class="grove" id="zhongshu"><div class="crown" role="img" aria-label="所有的叶子聚到一起，拼成一棵树">${`<span class="trunk" ${enter(0, 'fade', 'drift')}>${trunk('var(--ds-color-indigo)')}</span>`}<div class="leaves" data-ds-stagger="leaf">${tree(40, 5).map((l, i) => leaf(l, i, 'fall', '9')).join('')}</div></div>
<div class="invite"><p class="note" ${enter(0)}>2026 年 3 月 12 日 · 植树节 · 上午九点</p><h2 class="t-head" ${enter(1)}>来种园子第二个一百年的第一棵树</h2><p class="lead" ${enter(2)}>园门口发树苗和铁锹。种完以后，我们在新树旁挂一张叶签，写上你的名字。</p><div ${enter(3)}>${button('报名来种树', '#zhongshu')}</div><p class="note" ${enter(4)}>名额 300 人，报满为止；栖桐植物园为虚构机构。</p></div></div>`,
  `.crown { position:relative; width:min(620px, 92%); aspect-ratio:5 / 6; margin:0 auto; }.trunk { position:absolute; left:28%; top:40%; width:44%; height:60%; }.trunk svg { display:block; width:100%; height:100%; }.leaves { position:absolute; inset:0; }
.invite { display:grid; justify-items:center; text-align:center; gap:var(--ds-space-4); margin-top:var(--ds-space-7); }.invite .lead { max-width:24em; }`
);

export const FRAGMENTS = {
  'kaichang.html': kaichang,
  'xin-shang.html': xin1,
  'yeqian.html': yeqian,
  'xin-xia.html': xin2,
  'zhongshu.html': zhongshu,
};

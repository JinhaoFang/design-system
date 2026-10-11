/*
 * PROTOTYPE · 纸本编辑方向稿：三个结构不同的变体，按 ?variant=A|B|C 切换（底部浮条或 ← → 键）。
 * 内容取自标准样张设定（鹞岭天文台，library/content/SETTING.md）。图像全部由代码绘制：真实坐标的北天星图、主镜工程图、山体等高线、观测夜月相历。
 * ?static=1 让所有入场直接到终态（截图用），?record=1 隐藏切换条（录屏用）。动效只动 transform 与 opacity，时长取五档阶梯。
 */
const params = new URLSearchParams(location.search);
const VARIANTS = { A: '古籍扉页', B: '观测日志', C: '星图图版' };
const current = VARIANTS[params.get('variant')] ? params.get('variant') : 'A';
if (params.has('static')) document.documentElement.classList.add('static');
if (params.has('record')) document.documentElement.classList.add('record');

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f = (n) => Math.round(n * 100) / 100;

const STARS = {
  polaris: [2.53, 89.26, 2.0, '勾陈一'], yildun: [17.54, 86.59, 4.4], epsUMi: [16.77, 82.04, 4.2], zetaUMi: [15.73, 77.79, 4.3],
  kochab: [14.85, 74.16, 2.1, '北极二'], pherkad: [15.35, 71.83, 3.0], etaUMi: [16.29, 75.76, 5.0],
  dubhe: [11.06, 61.75, 1.8, '天枢'], merak: [11.03, 56.38, 2.4, '天璇'], phecda: [11.9, 53.69, 2.4, '天玑'], megrez: [12.26, 57.03, 3.3, '天权'],
  alioth: [12.9, 55.96, 1.8, '玉衡'], mizar: [13.4, 54.93, 2.2, '开阳'], alkaid: [13.79, 49.31, 1.9, '摇光'],
  caph: [0.15, 59.15, 2.3], schedar: [0.68, 56.54, 2.2, '王良四'], gcas: [0.95, 60.72, 2.2], ruchbah: [1.43, 60.24, 2.7], segin: [1.91, 63.67, 3.4],
  deneb: [20.69, 45.28, 1.25, '天津四'], capella: [5.28, 46.0, 0.1, '五车二'], vega: [18.62, 38.78, 0.0, '织女一'],
  alderamin: [21.31, 62.59, 2.5, '天钩五'], errai: [23.66, 77.63, 3.2], alfirk: [21.48, 70.56, 3.2], zcep: [22.18, 58.2, 3.4],
  eltanin: [17.94, 51.49, 2.2, '天棓四'], rastaban: [17.51, 52.3, 2.8], thuban: [14.07, 64.38, 3.7, '右枢'], edra: [19.21, 67.66, 3.1], aldhibah: [17.15, 65.71, 3.2],
  mirfak: [3.41, 49.86, 1.8, '天船三'], menkalinan: [6.0, 44.95, 1.9],
};
const LINES = {
  dipper: [['dubhe', 'merak'], ['merak', 'phecda'], ['phecda', 'megrez'], ['megrez', 'dubhe'], ['megrez', 'alioth'], ['alioth', 'mizar'], ['mizar', 'alkaid']],
  ink: [['polaris', 'yildun'], ['yildun', 'epsUMi'], ['epsUMi', 'zetaUMi'], ['zetaUMi', 'kochab'], ['kochab', 'pherkad'], ['pherkad', 'etaUMi'], ['etaUMi', 'zetaUMi'],
    ['caph', 'schedar'], ['schedar', 'gcas'], ['gcas', 'ruchbah'], ['ruchbah', 'segin'],
    ['alderamin', 'alfirk'], ['alfirk', 'errai'], ['errai', 'zcep'], ['zcep', 'alderamin'],
    ['eltanin', 'rastaban'], ['rastaban', 'aldhibah'], ['aldhibah', 'edra'], ['edra', 'thuban']],
};
const SHICHEN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

function starChart({ size = 1000, labels = true, ring = true, m31 = true, faint = 820, seed = 11, dense = false } = {}) {
  const c = size / 2, R = size * 0.43, minDec = 35;
  const pos = (ra, dec) => {
    const r = ((90 - dec) / (90 - minDec)) * R, a = (ra / 24) * Math.PI * 2;
    return [c + r * Math.sin(a), c - r * Math.cos(a)];
  };
  const rand = rng(seed);
  let s = `<svg viewBox="0 0 ${size} ${size}" class="chart" role="img" aria-label="北天星图">`;
  s += `<defs><clipPath id="clip${seed}"><circle cx="${c}" cy="${c}" r="${R}"/></clipPath></defs>`;
  if (ring) {
    s += `<circle cx="${c}" cy="${c}" r="${R + size * 0.032}" fill="none" stroke="var(--ink)" stroke-width="${size * 0.0025}"/>`;
    s += `<circle cx="${c}" cy="${c}" r="${R + size * 0.022}" fill="none" stroke="var(--ink)" stroke-width="${size * 0.0008}"/>`;
    for (let m = 0; m < 144; m++) {
      const a = (m / 144) * Math.PI * 2, long = m % 6 === 0, r1 = R + size * 0.004, r2 = R + size * (long ? 0.022 : 0.012);
      s += `<line x1="${f(c + r1 * Math.sin(a))}" y1="${f(c - r1 * Math.cos(a))}" x2="${f(c + r2 * Math.sin(a))}" y2="${f(c - r2 * Math.cos(a))}" stroke="var(--ink)" stroke-width="${size * (long ? 0.0012 : 0.0007)}"/>`;
    }
    SHICHEN.forEach((ch, k) => {
      const a = (k / 12) * Math.PI * 2, r = R + size * 0.058;
      s += `<text x="${f(c + r * Math.sin(a))}" y="${f(c - r * Math.cos(a))}" font-size="${size * 0.026}" text-anchor="middle" dominant-baseline="central" fill="var(--ink-2)" style="font-family:var(--kai)">${ch}</text>`;
    });
  }
  s += `<circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke="var(--ink)" stroke-width="${size * 0.0012}"/>`;
  s += `<g clip-path="url(#clip${seed})">`;
  for (const dec of [80, 70, 60, 50, 40]) {
    const r = ((90 - dec) / (90 - minDec)) * R;
    s += `<circle cx="${c}" cy="${c}" r="${f(r)}" fill="none" stroke="var(--rule)" stroke-width="${size * 0.0008}" stroke-dasharray="${size * 0.002} ${size * 0.006}"/>`;
  }
  for (let h = 0; h < 24; h += 2) {
    const [x1, y1] = pos(h, 80), [x2, y2] = pos(h, minDec);
    s += `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="var(--rule-2)" stroke-width="${size * 0.0008}"/>`;
  }
  for (let k = 0; k < (dense ? faint * 1.4 : faint); k++) {
    const r = R * Math.sqrt(rand()), a = rand() * Math.PI * 2, m = Math.pow(rand(), 3.2);
    s += `<circle cx="${f(c + r * Math.sin(a))}" cy="${f(c - r * Math.cos(a))}" r="${f(size * (0.0007 + m * 0.0026))}" fill="var(--ink)" opacity="${f(0.55 + m * 0.45)}"/>`;
  }
  const P = Object.fromEntries(Object.entries(STARS).map(([k, v]) => [k, pos(v[0], v[1])]));
  const [px, py] = P.polaris, [mx, my] = P.merak, [dx, dy] = P.dubhe;
  s += `<line class="star-line" style="--i:0" x1="${f(mx)}" y1="${f(my)}" x2="${f(px + (px - dx) * 0.04)}" y2="${f(py + (py - dy) * 0.04)}" stroke="var(--zhu)" stroke-width="${size * 0.0011}" stroke-dasharray="${size * 0.004} ${size * 0.005}"/>`;
  LINES.ink.forEach(([a, b], i) => { s += `<line class="star-line" style="--i:${1 + (i % 6)}" x1="${f(P[a][0])}" y1="${f(P[a][1])}" x2="${f(P[b][0])}" y2="${f(P[b][1])}" stroke="var(--ink-2)" stroke-width="${size * 0.0012}"/>`; });
  LINES.dipper.forEach(([a, b], i) => { s += `<line class="star-line" style="--i:${2 + i}" x1="${f(P[a][0])}" y1="${f(P[a][1])}" x2="${f(P[b][0])}" y2="${f(P[b][1])}" stroke="var(--zhu)" stroke-width="${size * 0.0022}"/>`; });
  for (const [k, v] of Object.entries(STARS)) {
    const [x, y] = P[k], r = size * (0.0026 + Math.max(0, 4.6 - v[2]) * 0.0017);
    s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="var(--ink)"/>`;
    if (k === 'polaris') s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 2.4)}" fill="none" stroke="var(--ink)" stroke-width="${size * 0.0009}"/>`;
    if (labels && v[3]) {
      const zhu = LINES.dipper.some((l) => l.includes(k));
      s += `<text x="${f(x + r + size * 0.008)}" y="${f(y - r - size * 0.004)}" font-size="${size * 0.019}" fill="${zhu ? 'var(--zhu)' : 'var(--ink-2)'}" style="font-family:var(--kai)">${v[3]}</text>`;
    }
  }
  if (m31) {
    const [x, y] = pos(0.712, 41.27);
    s += `<g class="star-line" style="--i:10"><ellipse cx="${f(x)}" cy="${f(y)}" rx="${size * 0.024}" ry="${size * 0.008}" transform="rotate(-38 ${f(x)} ${f(y)})" fill="var(--zhu)" opacity=".85"/>`;
    s += `<circle cx="${f(x)}" cy="${f(y)}" r="${size * 0.04}" fill="none" stroke="var(--zhu)" stroke-width="${size * 0.0016}"/>`;
    if (labels) s += `<text x="${f(x - size * 0.05)}" y="${f(y + size * 0.006)}" font-size="${size * 0.022}" text-anchor="end" fill="var(--zhu)" style="font-family:var(--kai)">仙女星系</text>`;
    s += `</g>`;
  }
  s += `</g></svg>`;
  return s;
}

function mirrorDrawing() {
  const W = 1600, H = 900, cx = 520, cy = 430, R = 330;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="art-svg" role="img" aria-label="主镜工程图"><defs><pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="9" stroke="var(--ink)" stroke-width="1"/></pattern>`;
  s += `<marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0 2 L10 5 L0 8" fill="none" stroke="var(--ink)" stroke-width="1.2"/></marker></defs>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="var(--ink)" stroke-width="2.4"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${R - 9}" fill="none" stroke="var(--ink)" stroke-width=".8"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${R * 0.24}" fill="var(--paper-2)" stroke="var(--ink)" stroke-width="1.6"/>`;
  for (const [rr, n] of [[0.48, 6], [0.78, 12]]) {
    s += `<circle cx="${cx}" cy="${cy}" r="${R * rr}" fill="none" stroke="var(--rule)" stroke-width="1" stroke-dasharray="3 6"/>`;
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + 0.26; s += `<circle class="star-line" style="--i:${k % 6}" cx="${f(cx + R * rr * Math.cos(a))}" cy="${f(cy + R * rr * Math.sin(a))}" r="5" fill="none" stroke="var(--zhu)" stroke-width="1.6"/>`; }
  }
  s += `<line x1="${cx - R}" y1="${cy}" x2="${cx + R}" y2="${cy}" stroke="var(--ink)" stroke-width=".8" stroke-dasharray="14 4 2 4"/><line x1="${cx}" y1="${cy - R}" x2="${cx}" y2="${cy + R}" stroke="var(--ink)" stroke-width=".8" stroke-dasharray="14 4 2 4"/>`;
  s += `<line x1="${cx - R}" y1="${cy + R + 54}" x2="${cx + R}" y2="${cy + R + 54}" stroke="var(--ink)" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>`;
  s += `<line x1="${cx - R}" y1="${cy + 10}" x2="${cx - R}" y2="${cy + R + 66}" stroke="var(--ink)" stroke-width=".6"/><line x1="${cx + R}" y1="${cy + 10}" x2="${cx + R}" y2="${cy + R + 66}" stroke="var(--ink)" stroke-width=".6"/>`;
  s += `<text x="${cx}" y="${cy + R + 44}" text-anchor="middle" font-size="26" fill="var(--ink)" style="font-family:var(--latin);font-style:italic">Ø 1600</text>`;
  const sx = 960, sw = 560, sy = 300, th = 72, sag = 22;
  s += `<path d="M${sx} ${sy} Q${sx + sw / 2} ${sy + sag * 2} ${sx + sw} ${sy} L${sx + sw} ${sy + th} L${sx} ${sy + th} Z" fill="url(#hatch)" stroke="var(--ink)" stroke-width="2"/>`;
  s += `<rect x="${sx + sw / 2 - 40}" y="${sy - 4}" width="80" height="${th + 8}" fill="var(--paper)" stroke="none"/>`;
  s += `<line x1="${sx + sw / 2 - 40}" y1="${sy + sag - 2}" x2="${sx + sw / 2 - 40}" y2="${sy + th}" stroke="var(--ink)" stroke-width="2"/><line x1="${sx + sw / 2 + 40}" y1="${sy + sag - 2}" x2="${sx + sw / 2 + 40}" y2="${sy + th}" stroke="var(--ink)" stroke-width="2"/>`;
  s += `<line x1="${sx + sw + 34}" y1="${sy}" x2="${sx + sw + 34}" y2="${sy + th}" stroke="var(--ink)" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>`;
  s += `<text x="${sx + sw + 50}" y="${sy + th / 2 + 8}" font-size="22" fill="var(--ink)" style="font-family:var(--latin);font-style:italic">200</text>`;
  s += `<path d="M${sx + sw / 2} ${sy - 220} L${sx + sw / 2} ${sy - 12}" stroke="var(--zhu)" stroke-width="1" stroke-dasharray="2 5"/>`;
  for (let k = -3; k <= 3; k++) s += `<line class="star-line" style="--i:${k + 3}" x1="${sx + sw / 2 + k * 70}" y1="${sy - 230}" x2="${sx + sw / 2 + k * 70 * 0.06}" y2="${sy - 10 + Math.abs(k) * 1.5}" stroke="var(--zhu)" stroke-width="1.2"/>`;
  s += `<text x="${sx}" y="${sy + th + 60}" font-size="24" fill="var(--ink-2)" style="font-family:var(--song)">剖面　A—A</text>`;
  s += `<text x="${sx}" y="${sy + th + 100}" font-size="22" fill="var(--zhu)" style="font-family:var(--kai)">星光由此落下，汇于焦点</text>`;
  s += `<text x="${cx - R}" y="70" font-size="24" fill="var(--ink-2)" style="font-family:var(--song)">俯视　十八点支撑</text>`;
  s += `</svg>`;
  return s;
}

function contourMap() {
  const W = 1600, H = 900, cx = 760, cy = 470, rand = rng(5);
  const ph = Array.from({ length: 6 }, () => rand() * Math.PI * 2);
  let s = `<svg viewBox="0 0 ${W} ${H}" class="art-svg" role="img" aria-label="鹞岭等高线图">`;
  const levels = 22;
  for (let k = 0; k < levels; k++) {
    const t = k / (levels - 1), base = 40 + t * 520, pts = [];
    for (let i = 0; i <= 180; i++) {
      const a = (i / 180) * Math.PI * 2;
      const w = 1 + 0.2 * Math.sin(2 * a + ph[0] + t * 1.2) + 0.12 * Math.sin(3 * a + ph[1] - t * 0.8) + 0.06 * Math.sin(5 * a + ph[2] + t * 2) + 0.03 * Math.sin(9 * a + ph[3]);
      pts.push(`${f(cx + Math.cos(a) * base * w * 1.35)},${f(cy + Math.sin(a) * base * w * 0.78)}`);
    }
    const major = k % 5 === 0;
    s += `<polygon points="${pts.join(' ')}" fill="none" stroke="var(--ink)" stroke-width="${major ? 1.6 : 0.7}" opacity="${major ? 1 : 0.75}"/>`;
    if (major && k > 0) s += `<text x="${f(cx + base * 1.35 * 0.98)}" y="${f(cy - 6)}" font-size="18" fill="var(--ink-2)" style="font-family:var(--latin);font-style:italic">${2860 - k * 40}</text>`;
  }
  let road = `M${cx + 560 * 1.3} ${cy + 380}`;
  for (let i = 1; i <= 90; i++) { const t = i / 90, a = t * Math.PI * 5.2 + 0.4, r = (1 - t) * 520; road += ` L${f(cx + Math.cos(a) * r * 1.3)} ${f(cy + Math.sin(a) * r * 0.74)}`; }
  s += `<path class="star-line" style="--i:2" d="${road}" fill="none" stroke="var(--zhu)" stroke-width="2" stroke-dasharray="7 6"/>`;
  s += `<path d="M${cx} ${cy - 16} l14 24 h-28 z" fill="var(--ink)"/><text x="${cx + 24}" y="${cy - 2}" font-size="26" fill="var(--ink)" style="font-family:var(--latin)">2860</text>`;
  s += `<text x="${cx + 24}" y="${cy + 30}" font-size="22" fill="var(--zhu)" style="font-family:var(--kai)">圆顶</text>`;
  s += `<text x="${cx + 560 * 1.3 - 140}" y="${cy + 410}" font-size="22" fill="var(--zhu)" style="font-family:var(--kai)">鹿溪镇　盘山路三十八公里</text>`;
  s += `<g transform="translate(1460 120)"><line x1="0" y1="40" x2="0" y2="-40" stroke="var(--ink)" stroke-width="1.4"/><path d="M0 -44 l7 18 h-14z" fill="var(--ink)"/><text y="70" text-anchor="middle" font-size="20" fill="var(--ink)" style="font-family:var(--song)">北</text></g>`;
  s += `</svg>`;
  return s;
}

const NEW_MOON = Date.UTC(2026, 10, 9, 7);
const NIGHTS = [[2026, 11, 21], [2026, 11, 28], [2026, 12, 19], [2026, 12, 26], [2027, 1, 16], [2027, 1, 23], [2027, 2, 20], [2027, 2, 27]];
const moonAge = (y, m, d) => ((((Date.UTC(y, m - 1, d, 13) - NEW_MOON) / 86400000) % 29.530589) + 29.530589) % 29.530589;
function moonGlyph(age, r, lit = 'var(--paper)', dark = 'var(--ink)') {
  const p = age / 29.530589, rx = f(r * Math.abs(Math.cos(p * Math.PI * 2)));
  let d;
  if (p < 0.5) d = `M0 ${-r} A${r} ${r} 0 0 1 0 ${r} A${rx} ${r} 0 0 ${p < 0.25 ? 0 : 1} 0 ${-r}Z`;
  else d = `M0 ${-r} A${r} ${r} 0 0 0 0 ${r} A${rx} ${r} 0 0 ${p < 0.75 ? 0 : 1} 0 ${-r}Z`;
  return `<circle r="${r}" fill="${dark}"/><path d="${d}" fill="${lit}"/><circle r="${r}" fill="none" stroke="var(--ink)" stroke-width="${r * 0.04}"/>`;
}
const CN = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const cnMonth = (m) => ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'][m];
function nightsCalendar() {
  const W = 1600, H = 900;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="art-svg" role="img" aria-label="八场观测夜与当晚月相">`;
  NIGHTS.forEach(([y, m, d], i) => {
    const col = i % 4, row = Math.floor(i / 4), x = 230 + col * 380, yy = 250 + row * 380, r = 92;
    s += `<g class="star-line" style="--i:${i}" transform="translate(${x} ${yy})">${moonGlyph(moonAge(y, m, d), r)}`;
    s += `<text y="${r + 58}" text-anchor="middle" font-size="40" fill="var(--zhu)" style="font-family:var(--latin);font-feature-settings:'lnum'">${m}.${d}</text>`;
    s += `<text y="${r + 96}" text-anchor="middle" font-size="22" fill="var(--ink-2)" style="font-family:var(--song)">${cnMonth(m)}月　周六</text></g>`;
  });
  s += `<line x1="60" y1="${H / 2 + 20}" x2="${W - 60}" y2="${H / 2 + 20}" stroke="var(--rule)" stroke-width="1"/>`;
  s += `<text x="60" y="60" font-size="24" fill="var(--ink-2)" style="font-family:var(--song)">二〇二六年十一月　至　二〇二七年二月</text>`;
  s += `</svg>`;
  return s;
}

const yuwei = (up = false) => `<svg class="yuwei${up ? ' up' : ''}" viewBox="0 0 24 16" aria-hidden="true"><path d="M0 0H24V10L17 5.5L12 11.5L7 5.5L0 10Z"/></svg>`;
const frame = (i = 0) => `<div class="frame" aria-hidden="true"><i class="t draw-x" style="--i:${i}"></i><i class="b draw-x" style="--i:${i + 1}"></i><i class="l draw-y" style="--i:${i}"></i><i class="r draw-y" style="--i:${i + 1}"></i><i class="t2 draw-x" style="--i:${i + 2}"></i><i class="b2 draw-x" style="--i:${i + 3}"></i><i class="l2 draw-y" style="--i:${i + 2}"></i><i class="r2 draw-y" style="--i:${i + 3}"></i></div>`;
const seal = (chars, cls = '', attrs = '') => `<span class="seal ${cls}" ${attrs}>${[...chars].map((c) => `<span>${c}</span>`).join('')}</span>`;
const tissue = (wait = 240) => `<div class="tissue" style="--wait:${wait}ms" aria-hidden="true"></div>`;
const vchars = (txt, wait = 0) => [...txt].map((c, i) => `<span data-in style="--i:${i};--wait:${wait}ms;--rise:18px">${c}</span>`).join('');

function variantA() {
  return `<div class="va">
  <section class="spread hero">
    <div class="page page-l">${frame(0)}
      <div class="plate chart-wrap" style="width:100%">${starChart({ size: 1000, seed: 11 })}${tissue(900)}</div>
      <p class="cap kai" data-in style="--wait:1500ms">北天星图　首光所见</p>
    </div>
    <div class="banxin" aria-hidden="true">${yuwei()}<span class="vert" data-in style="--wait:500ms">鹞岭天文台　卷一　新镜</span>${yuwei(true)}</div>
    <div class="page page-r">${frame(1)}
      <div class="cols">
        <h1 class="title">${vchars('鹞岭天文台', 400)}</h1>
        <div class="sub"><span data-in style="--wait:1000ms">一米六新镜落成</span>${seal('鹞岭天台', '', 'data-in="stamp" style="--wait:1700ms"')}</div>
        <p class="note" data-in style="--wait:1300ms">首光之夜　对准仙女星系</p>
        <p class="paiji" data-in style="--wait:1450ms">丙午年十月　公众观测夜启</p>
      </div>
    </div>
  </section>

  <section class="sec">
    <aside class="margin"><p class="pizhu" data-in>山路三十八公里，<br>主镜是一寸一寸运上来的。</p></aside>
    <div class="prose">
      <p data-in style="--i:1">鹞岭山顶海拔两千八百六十米。山顶常有鹞鹰盘旋，当地人便叫它鹞岭。一九八七年，这里建起一架口径零点六米的望远镜；三十多年里，只接待过科研访客。</p>
      <p data-in style="--i:2">新镜口径一点六米，集光面积是旧镜的七倍，能看见暗两个星等的天体。圆顶直径十米，转一圈九十秒。十一月十四日落成；一周之后，山顶第一次向所有人开放。</p>
    </div>
    <header class="head" data-in="x">${yuwei()}<h2>缘起</h2><small>壹</small></header>
  </section>

  <section class="sec" style="grid-template-columns:1fr 140px">
    <div class="shu">
      <div data-in style="--i:0"><em>口径</em><b>一点六米</b><span class="pizhu">1.6 m</span></div>
      <div data-in style="--i:1"><em>海拔</em><b>二千八百六十米</b><span class="pizhu">2,860 m</span></div>
      <div data-in style="--i:2"><em>集光</em><b>旧镜七倍</b><span class="pizhu">(1.6 ÷ 0.6)²</span></div>
      <div data-in style="--i:3"><em>极限星等</em><b>二十四等</b><span class="pizhu">旧镜二十二</span></div>
      <div data-in style="--i:4"><em>晴夜</em><b>每年二百一十</b><span class="pizhu">银河肉眼可见</span></div>
    </div>
    <header class="head" data-in="x">${yuwei()}<h2>录</h2><small>贰</small></header>
  </section>

  <figure class="bigplate plate">${starChart({ size: 1000, seed: 23, dense: true })}${tissue(200)}
    <figcaption>${yuwei()}<span>图一　北天星图　首光所见仙女星系</span>${yuwei()}</figcaption>
  </figure>

  <section class="sec" style="grid-template-columns:1fr">
    <blockquote class="quote" data-in>首光那晚，我们对准仙女星系。进入镜筒的光已经走了二百五十万年，比人类的历史还长。<span class="pizhu">沈砚秋　台长</span></blockquote>
  </section>

  <section class="sec" style="grid-template-columns:1fr 140px">
    <div class="annals">
      <div data-in style="--i:0"><time>二〇二二年四月</time><span>奠基</span></div>
      <div data-in style="--i:1"><time>二〇二三年九月</time><span>圆顶封顶</span></div>
      <div data-in style="--i:2"><time>二〇二四年十一月</time><span>主镜运抵</span></div>
      <div data-in style="--i:3"><time>二〇二五年十月</time><span>首光</span></div>
      <div data-in style="--i:4"><time>二〇二六年十一月十四日</time><span>落成</span></div>
      <div data-in style="--i:5" class="on"><time>十一月二十一日</time><span>首场观测夜</span></div>
    </div>
    <header class="head" data-in="x">${yuwei()}<h2>纪事</h2><small>叁</small></header>
  </section>

  <section class="cta">
    <p class="vert" data-in>公众观测夜<small>十一月至来年二月　每月第三、第四个周六</small><small>每场六十人　十月二十日起预约</small></p>
    ${seal('预约', 'bigseal', 'data-in="stamp" role="button" tabindex="0" style="--wait:200ms"')}
  </section>
  <p class="colophon" data-in>鹞岭天文台　编　｜　丙午年十月　｜　纸本编辑　方向稿</p>
  ${carriers('A')}
</div>`;
}

function variantB() {
  return `<div class="vb">
  <header class="meta hero-meta"><b>观测日志　№ 0412</b><span class="tnum">2025 年 10 月</span><span>首光　<span class="sc">first light</span></span><span>目标　M31 仙女星系</span><span>晴　天顶亮度 21.7 等 / 平方角秒</span></header>
  <div class="hr draw-x hero-meta"></div>
  <section class="hero">
    <ol class="times">
      <li data-in style="--i:0;--wait:200ms"><time>19:40</time>圆顶开缝</li>
      <li data-in style="--i:1;--wait:200ms"><time>20:15</time>主镜温度平衡</li>
      <li data-in style="--i:2;--wait:200ms"><time>21:02</time>对准 M31</li>
      <li data-in style="--i:3;--wait:200ms"><time>21:06</time>第一幅图像</li>
    </ol>
    <div>
      <h1><span class="line" data-in style="--wait:300ms">光走了</span><span class="line" data-in style="--wait:420ms"><span class="mark">二百五十万年<svg viewBox="0 0 400 20" preserveAspectRatio="none" aria-hidden="true"><path class="draw-x" style="--wait:1300ms" d="M2 13 C 80 6, 160 16, 240 9 S 360 6, 398 11"/></svg></span></span>
        <span class="scribble" data-in="stamp" style="--wait:1700ms">首光那晚，对准的是仙女星系。</span></h1>
      <p class="lead" data-in style="--wait:700ms">鹞岭天文台口径 1.6 米的新望远镜将于 11 月 14 日落成。11 月 21 日起，每月第三、第四个周六，山顶第一次向公众开放。</p>
    </div>
    <div class="inset plate">${starChart({ size: 1000, seed: 7, faint: 520 })}${tissue(800)}<p class="pizhu" data-in style="--wait:1900ms">朱圈处，即仙女星系</p></div>
  </section>
  <div class="hr thin"></div>
  <section class="two">
    <p class="kicker sc" data-in>site · 场址</p>
    <div><h2 data-in>为什么是鹞岭</h2>
      <div class="cols2" data-in style="--i:1"><p>海拔 2,860 米，山脚是鹿溪镇。每年约 210 个晴夜，天顶天空亮度 21.7 等每平方角秒，银河肉眼可见。</p>
      <p>旧望远镜 1987 年建成，口径 0.6 米，手动对星，一次只能看一个目标。山路只通小车，三十多年里只接待过科研访客。</p>
      <p>新镜自动对星，整夜连续观测；镜旁还装了一副给人眼用的目镜。圆顶旁新建的接待厅有 60 个座位。</p></div></div>
    <aside class="side"><p class="pizhu" data-in style="--i:2">沿 38 公里盘山路上山，<br>车程一小时十分。</p></aside>
  </section>
  <section class="giant">
    <p class="kicker sc" data-in>limit · 极限星等</p>
    <b data-in>24</b>
    <div data-in style="--i:1">累积曝光的极限星等，<br>从 22 等提高到 24 等。<span class="pizhu">深两个星等，能看见原来看不见的暗弱星系。</span></div>
  </section>
  <section class="eph">
    <p class="kicker sc" data-in>specs · 星表</p>
    <table data-in style="--i:1"><thead><tr><th>项目</th><th style="text-align:right;padding-right:var(--s5)">数值</th><th>单位</th><th>批注</th></tr></thead><tbody>
      <tr><td>主镜口径</td><td class="num">1.6</td><td class="unit">m</td><td class="pz">旧镜只有 0.6 米</td></tr>
      <tr><td>集光面积</td><td class="num">7</td><td class="unit">×</td><td class="pz">按口径平方计算</td></tr>
      <tr><td>主镜重量</td><td class="num">1.0</td><td class="unit">t</td><td class="pz">厚约 20 厘米</td></tr>
      <tr><td>圆顶直径</td><td class="num">10</td><td class="unit">m</td><td class="pz">转一圈 90 秒</td></tr>
      <tr><td>接待厅</td><td class="num">60</td><td class="unit">座</td><td class="pz"></td></tr>
    </tbody></table>
  </section>
  <figure class="plateb plate"><div class="inner">${starChart({ size: 1000, seed: 23, dense: true })}
    <figcaption data-in style="--wait:1400ms"><b>PL. I　北天</b>首光那晚所见的北天。北斗以朱线连出，指极星引向勾陈一；左下朱圈处，是二百五十万光年外的仙女星系。</figcaption></div>${tissue(200)}</figure>
  <blockquote data-in>「首光那晚，我们对准仙女星系。进入镜筒的光已经走了 250 万年，比人类的历史还长。」<cite>沈砚秋　鹞岭天文台台长</cite></blockquote>
  <section class="log">
    <p class="kicker sc" data-in>log · 纪事</p>
    <ol>
      <li data-in style="--i:0"><time>2022.04</time><span>奠基，圆顶基础动工</span><span class="pizhu"></span></li>
      <li data-in style="--i:1"><time>2023.09</time><span>钢结构圆顶合拢</span><span class="pizhu"></span></li>
      <li data-in style="--i:2"><time>2024.11</time><span>主镜运抵山顶</span><span class="pizhu">走了 38 公里盘山路</span></li>
      <li data-in style="--i:3"><time>2025.10</time><span>首光，拍下仙女星系</span><span class="pizhu">此后试观测一年</span></li>
      <li data-in style="--i:4"><time>2026.11.14</time><span>落成典礼</span><span class="pizhu"></span></li>
      <li data-in style="--i:5" class="on"><time>2026.11.21</time><span>首场公众观测夜</span><span class="pizhu">山顶第一次对所有人开放</span></li>
    </ol>
  </section>
  <section class="ticket-wrap">
    <p class="kicker sc" data-in>visit · 观测夜</p>
    <div class="ticket" data-in>
      <div class="body"><h3>观测夜预约单</h3><dl>
        <dt>场次</dt><dd>2026.11.21 — 2027.02.27　共 8 场</dd>
        <dt>名额</dt><dd>每场 60 人，首批 480 席</dd>
        <dt>费用</dt><dd>免费；鹿溪镇接驳车每人 40 元</dd>
        <dt>提醒</dt><dd>山顶夜里约 0 ℃，请带外套</dd></dl>
        <a href="#" data-in style="--i:2">10 月 20 日起，预约观测夜 →</a></div>
      <div class="stub">${seal('开放', '', 'data-in="stamp" style="--wait:500ms;--rot:-9deg"')}</div>
    </div>
  </section>
  ${carriers('B')}
</div>`;
}

function variantC() {
  const top = (no, cn) => `<div class="top"><span>鹞岭天文台　新镜落成纪念图集</span><span class="no">${yuwei()}图版　${cn}　<span class="sc">pl. ${no}</span></span></div>`;
  const crop = '<div class="crop" aria-hidden="true"><i></i><i></i><i></i><i></i></div>';
  return `<div class="vc">
  <section class="pl hero">${top('i', '壹')}
    <div class="stage plate">${crop}<div class="art">${starChart({ size: 1000, seed: 31, dense: true })}</div>${tissue(500)}</div>
    <div class="cap"><h1 data-in style="--wait:300ms">鹞岭天文台</h1><p data-in style="--wait:500ms">北天星图。首光那晚，新镜对准仙女星系（朱圈处）。北斗以朱线连出，勾陈与王良以墨线相连。</p><p class="pizhu" data-in style="--wait:1800ms">光走了二百五十万年。</p></div>
  </section>
  <section class="pl">${top('ii', '贰')}
    <div class="stage plate">${crop}<div class="art wide">${mirrorDrawing()}</div>${tissue(150)}</div>
    <div class="cap"><h2 data-in>主镜　一点六米</h2><p data-in style="--i:1">口径 1,600 毫米，厚约 200 毫米，重约一吨。集光面积是旧镜的七倍，极限星等由 22 等提高到 24 等。</p><p class="pizhu" data-in style="--i:2">沿三十八公里盘山路运上山顶。</p></div>
  </section>
  <section class="pl">${top('iii', '叁')}
    <div class="stage plate">${crop}<div class="art wide">${contourMap()}</div>${tissue(150)}</div>
    <div class="cap"><h2 data-in>鹞岭　海拔二千八百六十米</h2><p data-in style="--i:1">每年约二百一十个晴夜。天顶天空亮度 21.7 等每平方角秒，银河肉眼可见。</p><p class="pizhu" data-in style="--i:2">山顶夜里约零度。</p></div>
  </section>
  <section class="epi"><p data-in>首光那晚，我们对准仙女星系。进入镜筒的光已经走了二百五十万年，比人类的历史还长。</p><span class="pizhu" data-in style="--i:2">沈砚秋　台长</span></section>
  <section class="pl">${top('iv', '肆')}
    <div class="stage plate">${crop}<div class="art wide">${nightsCalendar()}</div>${tissue(150)}</div>
    <div class="cap"><h2 data-in>观测夜　八个周六</h2><p data-in style="--i:1">二〇二六年十一月至二〇二七年二月，每月第三、第四个周六。每场六十人，首批四百八十席，十月二十日起预约。</p><p class="pizhu" data-in style="--i:2">山顶只用红光照明。</p></div>
  </section>
  <section class="card" data-in>
    <svg class="moonmini" viewBox="-60 -60 120 120" aria-hidden="true">${moonGlyph(moonAge(2026, 11, 21), 54)}</svg>
    <div><h3>预约观测夜</h3><p>十一月二十一日起　每场六十人　观测免费　接驳车四十元</p></div>
    ${seal('预约', '', 'data-in="stamp" style="--wait:400ms"')}
  </section>
  ${carriers('C')}
</div>`;
}

function slidesFor(v) {
  if (v === 'A') return [
    `<div style="position:absolute;inset:60px 72px;display:grid;grid-template-columns:1fr 80px 1fr">
      <div style="position:relative;display:grid;place-items:center">${frame(0).replace(/draw-[xy]/g, '')}<div data-sin style="width:820px">${starChart({ size: 1000, seed: 11 })}</div></div>
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:20px 0;border-left:1px solid var(--ink);border-right:1px solid var(--ink);margin:0 14px">${yuwei()}<span class="vert" style="font-size:22px;letter-spacing:.5em;color:var(--ink-2)">鹞岭天文台　卷一</span>${yuwei(true)}</div>
      <div style="position:relative;display:flex;justify-content:center;padding:70px 40px">${frame(1).replace(/draw-[xy]/g, '')}
        <div class="vert" style="display:flex;flex-direction:column;gap:0">
          <h1 data-sin style="--i:1;font-size:132px;font-weight:250;letter-spacing:.14em;line-height:1.2;padding:0 30px;border-left:1px solid var(--rule-2)">鹞岭天文台</h1>
          <p data-sin style="--i:2;font-size:44px;font-weight:500;letter-spacing:.3em;padding:0 30px;border-left:1px solid var(--rule-2)">一米六新镜落成</p>
          <p data-sin style="--i:3;font-family:var(--kai);color:var(--zhu);font-size:30px;letter-spacing:.2em;padding:140px 30px 0">首光之夜　对准仙女星系</p>
        </div>
        <span class="seal" data-sin="stamp" style="--i:5;position:absolute;left:90px;bottom:110px;width:120px;height:120px;font-size:46px;grid-template-columns:1fr 1fr;padding:12px">${'<span>鹞</span><span>岭</span><span>天</span><span>台</span>'}</span>
      </div></div>`,
    `<div style="position:absolute;inset:0;display:grid;grid-template-columns:1fr 220px;padding:110px 120px">
      <div class="vert" style="display:flex;flex-direction:column;height:820px;margin:0 auto">
        ${[['口径', '一点六米', '1.6 m'], ['海拔', '二千八百六十米', '2,860 m'], ['集光', '旧镜七倍', '(1.6 ÷ 0.6)²'], ['极限星等', '二十四等', '旧镜二十二']].map(([a, b, c], i) => `<div data-sin style="--i:${i};display:flex;gap:36px;padding:0 54px;border-left:${i === 3 ? 0 : 1}px solid var(--rule-2)"><em style="font-style:normal;font-size:30px;color:var(--ink-2);letter-spacing:.3em">${a}</em><b style="font-weight:300;font-size:76px;letter-spacing:.12em">${b}</b><span style="font-family:var(--kai);color:var(--zhu);font-size:26px;margin-top:auto">${c}</span></div>`).join('')}
      </div>
      <div class="vert" style="display:flex;align-items:center;gap:20px;border-right:2px solid var(--ink);padding-right:24px;justify-self:end">${yuwei()}<b style="font-size:72px;font-weight:600;letter-spacing:.3em">录</b><span style="font-family:var(--kai);color:var(--zhu);font-size:30px">贰</span></div></div>`,
  ];
  if (v === 'B') return [
    `<div style="position:absolute;inset:0;padding:70px 110px">
      <div style="display:flex;gap:56px;font-size:24px;color:var(--ink-2);padding-bottom:20px;border-bottom:2px solid var(--ink)"><b style="color:var(--ink)">观测日志　№ 0412</b><span>2025 年 10 月　首光</span><span>目标　M31 仙女星系</span></div>
      <div style="display:grid;grid-template-columns:1fr 600px;gap:90px;margin-top:120px;align-items:center">
        <div><h1 data-sin style="--i:0;font-size:180px;font-weight:300;line-height:1.05">光走了<br><span style="position:relative">二百五十万年<svg viewBox="0 0 400 20" preserveAspectRatio="none" style="position:absolute;left:-2%;bottom:-14px;width:104%;height:34px"><path d="M2 13 C 80 6, 160 16, 240 9 S 360 6, 398 11" fill="none" stroke="var(--zhu)" stroke-width="6" stroke-linecap="round"/></svg></span></h1>
          <p data-sin style="--i:2;margin-top:60px;font-size:36px;color:var(--ink-2);line-height:1.8">1.6 米新镜，11 月 14 日落成</p></div>
        <div data-sin style="--i:1;position:relative">${starChart({ size: 1000, seed: 7, faint: 520 })}<p style="position:absolute;left:-40px;bottom:0;font-family:var(--kai);color:var(--zhu);font-size:30px;transform:rotate(-4deg)">朱圈处，即仙女星系</p></div>
      </div></div>`,
    `<div style="position:absolute;inset:0;padding:110px 130px;display:grid;grid-template-columns:auto 1fr;gap:110px;align-items:end">
      <b data-sin style="--i:0;font-family:var(--latin);font-weight:200;font-size:620px;line-height:.78;letter-spacing:-.03em;font-feature-settings:'lnum'">24</b>
      <div style="padding-bottom:40px">
        <p data-sin style="--i:1;font-size:44px;line-height:1.5">累积曝光的极限星等<br>从 22 等提高到 24 等</p>
        <p data-sin style="--i:2;font-family:var(--kai);color:var(--zhu);font-size:34px;margin-top:30px">深两个星等，能看见原来看不见的暗弱星系。</p>
        <table data-sin style="--i:3;margin-top:70px;border-collapse:collapse;font-size:28px;width:100%">${[['主镜口径', '1.6', 'm'], ['集光面积', '7', '×'], ['圆顶直径', '10', 'm']].map(([a, b, c]) => `<tr><td style="padding:16px 0;border-top:1px solid var(--rule)">${a}</td><td style="text-align:right;font-family:var(--latin);font-size:40px;font-weight:300;border-top:1px solid var(--rule);font-feature-settings:'lnum','tnum'">${b}</td><td style="padding-left:16px;font-family:var(--latin);font-style:italic;color:var(--ink-2);border-top:1px solid var(--rule)">${c}</td></tr>`).join('')}</table>
      </div></div>`,
  ];
  return [
    `<div style="position:absolute;inset:0;padding:60px 90px;display:grid;grid-template-columns:900px 1fr;gap:90px;align-items:center">
      <div data-sin style="--i:0;position:relative">${starChart({ size: 1000, seed: 31, dense: true })}</div>
      <div><p style="font-size:24px;color:var(--ink-2);letter-spacing:.24em;display:flex;align-items:center;gap:14px">${yuwei()}图版　壹　<span class="sc">pl. i</span></p>
        <h1 data-sin style="--i:1;font-size:120px;font-weight:250;letter-spacing:.08em;line-height:1.15;margin-top:40px;border-top:2px solid var(--ink);padding-top:40px">鹞岭天文台</h1>
        <p data-sin style="--i:2;font-size:34px;color:var(--ink-2);line-height:1.8;margin-top:30px">北天星图。首光那晚，新镜对准仙女星系。</p>
        <p data-sin style="--i:3;font-family:var(--kai);color:var(--zhu);font-size:34px;margin-top:24px">光走了二百五十万年。</p></div></div>`,
    `<div style="position:absolute;inset:0;padding:70px 100px;display:grid;grid-template-rows:auto 1fr auto;gap:30px">
      <p style="font-size:24px;color:var(--ink-2);letter-spacing:.24em;display:flex;align-items:center;gap:14px">${yuwei()}图版　贰　<span class="sc">pl. ii</span></p>
      <div data-sin style="--i:0">${mirrorDrawing()}</div>
      <div style="display:flex;justify-content:space-between;align-items:end;border-top:2px solid var(--ink);padding-top:24px"><h2 data-sin style="--i:1;font-size:56px;font-weight:500;letter-spacing:.06em">主镜　一点六米</h2><p data-sin style="--i:2;font-family:var(--kai);color:var(--zhu);font-size:32px">沿三十八公里盘山路运上山顶</p></div></div>`,
  ];
}

function socialFor(v) {
  if (v === 'A') return `<div style="position:absolute;inset:44px">${frame(0).replace(/draw-[xy]/g, '')}
    <div style="position:absolute;left:190px;right:190px;top:40px" data-sin>${starChart({ size: 1000, seed: 11, labels: false })}</div>
    <div class="vert" style="position:absolute;right:80px;bottom:70px;height:620px;display:flex;flex-direction:column">
      <h1 data-sin style="--i:1;font-size:104px;font-weight:250;letter-spacing:.12em;line-height:1.2;padding:0 20px">鹞岭天文台</h1>
      <p data-sin style="--i:2;font-size:38px;font-weight:500;letter-spacing:.28em;padding:0 22px;border-left:1px solid var(--rule-2)">公众观测夜</p>
      <p data-sin style="--i:3;font-family:var(--kai);color:var(--zhu);font-size:30px;letter-spacing:.16em;padding:0 22px;border-left:1px solid var(--rule-2)">十一月二十一日起</p></div>
    <span class="seal" data-sin="stamp" style="--i:5;position:absolute;left:90px;bottom:100px;width:150px;height:150px;font-size:58px;grid-template-columns:1fr 1fr;padding:14px"><span>预</span><span>约</span></span></div>`;
  if (v === 'B') return `<div style="position:absolute;inset:0;padding:80px 84px">
    <div style="display:flex;justify-content:space-between;font-size:26px;color:var(--ink-2);padding-bottom:18px;border-bottom:2px solid var(--ink)"><b style="color:var(--ink)">观测日志 № 0412</b><span>首光　M31</span></div>
    <h1 data-sin style="--i:0;font-size:150px;font-weight:300;line-height:1.08;margin-top:110px">光走了<br>二百五十<br>万年</h1>
    <p data-sin style="--i:1;font-family:var(--kai);color:var(--zhu);font-size:40px;margin-top:40px;transform:rotate(-3deg)">首光那晚，对准的是仙女星系。</p>
    <div data-sin style="--i:2;position:absolute;left:84px;right:84px;bottom:80px;background:#f6f1e6;box-shadow:var(--shadow-paper);display:grid;grid-template-columns:1fr 230px">
      <div style="padding:40px 44px;font-size:30px;line-height:1.7"><b style="font-size:40px;font-weight:500">公众观测夜</b><br>11.21 起，每月第三、第四个周六<br><span style="color:var(--ink-2)">每场 60 人 · 10.20 开放预约</span></div>
      <div style="border-left:2px dashed var(--rule);display:grid;place-items:center"><span class="seal" data-sin="stamp" style="--i:4;--rot:-9deg;width:150px;height:150px;font-size:52px;grid-template-columns:1fr 1fr;padding:14px"><span>开</span><span>放</span></span></div></div></div>`;
  return `<div style="position:absolute;inset:0;padding:70px 80px;display:grid;grid-template-rows:auto 1fr auto">
    <p style="font-size:26px;color:var(--ink-2);letter-spacing:.24em;display:flex;align-items:center;gap:14px">${yuwei()}图版　肆　<span class="sc">pl. iv</span></p>
    <div data-sin style="--i:0;display:grid;grid-template-columns:repeat(2,1fr);gap:46px 30px;align-content:center;padding:30px 20px">${NIGHTS.map(([y, m, d], i) => `<div style="display:flex;align-items:center;gap:28px"><svg viewBox="-60 -60 120 120" style="width:120px">${moonGlyph(moonAge(y, m, d), 54)}</svg><span style="font-family:var(--latin);font-size:52px;color:var(--zhu);font-feature-settings:'lnum'">${m}.${d}</span></div>`).join('')}</div>
    <div style="border-top:2px solid var(--ink);padding-top:28px;display:flex;justify-content:space-between;align-items:end"><div><h1 data-sin style="--i:1;font-size:72px;font-weight:500;letter-spacing:.06em">观测夜　八个周六</h1><p data-sin style="--i:2;font-size:30px;color:var(--ink-2);margin-top:10px">鹞岭天文台　每场六十人</p></div><span class="seal" data-sin="stamp" style="--i:4;width:130px;height:130px;font-size:48px;grid-template-columns:1fr 1fr;padding:13px"><span>预</span><span>约</span></span></div></div>`;
}

function carriers(v) {
  const slides = slidesFor(v);
  return `<section class="carriers" data-in>
    <header><h2>同一套语言，在幻灯片与配图上</h2><span>HTML 幻灯片 16:9　·　小红书 3:4</span></header>
    <div class="row">
      <div><div class="screen s169" data-cycle><div class="canvas">${slides.map((s) => `<div class="turn"><div class="shade"></div>${s}</div>`).join('')}</div></div>
        <div class="legend"><span>幻灯片：翻页如纸张滑入，带摩擦停住，不回弹</span><span>自动翻页</span></div></div>
      <div><div class="screen s34"><div class="canvas"><div class="turn">${socialFor(v)}</div></div></div>
        <div class="legend"><span>配图：1080 × 1440</span></div></div>
    </div></section>`;
}

const defs = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="rough" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="2.4" result="d"/><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="2" seed="9" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.1 1.92" result="holes"/><feComposite in="d" in2="holes" operator="in"/></filter></svg>`;
const app = document.getElementById('app');
app.innerHTML = defs + ({ A: variantA, B: variantB, C: variantC }[current])();

const keys = Object.keys(VARIANTS);
const go = (step) => { const k = keys[(keys.indexOf(current) + step + keys.length) % keys.length]; const p = new URLSearchParams(location.search); p.set('variant', k); location.search = p.toString(); };
const bar = document.createElement('nav');
bar.className = 'proto-switch';
bar.innerHTML = `<button aria-label="上一个">←</button><span>${current}　${VARIANTS[current]}</span><button aria-label="下一个">→</button>`;
bar.children[0].onclick = () => go(-1); bar.children[2].onclick = () => go(1);
document.body.append(bar);
addEventListener('keydown', (e) => { if (e.target.closest('input,textarea,[contenteditable]')) return; if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); });

const fit = (screen) => { const c = screen.querySelector('.canvas'); const w = screen.classList.contains('s169') ? 1920 : 1080; c.style.transform = `scale(${screen.clientWidth / w})`; };
const screens = [...document.querySelectorAll('.screen')];
screens.forEach((s) => { new ResizeObserver(() => fit(s)).observe(s); fit(s); });

function cycle(screen) {
  const turns = [...screen.querySelectorAll('.turn')];
  let k = 0, z = 1;
  turns[0].classList.add('on');
  if (turns.length < 2 || document.documentElement.classList.contains('static')) return;
  setInterval(() => {
    const cur = turns[k], nxt = turns[(k + 1) % turns.length];
    nxt.style.transition = 'none'; nxt.classList.remove('on', 'off'); void nxt.offsetWidth; nxt.style.transition = '';
    nxt.style.zIndex = String(++z);
    cur.classList.remove('on'); cur.classList.add('off'); nxt.classList.add('on');
    k = (k + 1) % turns.length;
  }, 5200);
}

document.fonts.ready.then(() => {
  const hero = document.querySelectorAll('.hero, .hero-meta');
  requestAnimationFrame(() => hero.forEach((h) => h.classList.add('is-in')));
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-in');
    if (e.target.classList.contains('carriers')) { e.target.querySelectorAll('.screen').forEach((s) => s.hasAttribute('data-cycle') ? cycle(s) : s.querySelector('.turn').classList.add('on')); }
    io.unobserve(e.target);
  }), { threshold: 0.16 });
  document.querySelectorAll('[data-in]:not(.hero [data-in]):not(.carriers [data-in]), .plate:not(.hero .plate), .carriers, .sec, .shu, .annals').forEach((el) => io.observe(el));
  if (document.documentElement.classList.contains('static')) document.querySelectorAll('.screen').forEach((s) => s.querySelector('.turn').classList.add('on'));
});

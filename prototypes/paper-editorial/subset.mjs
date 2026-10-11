/*
 * PROTOTYPE · 把下载好的字体按方向稿实际用到的字符做子集，输出到 fonts/。
 * 用法：node prototypes/paper-editorial/subset.mjs <源字体目录>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';
const here = dirname(fileURLToPath(import.meta.url));
const src = process.argv[2];
const text = ['index.html', 'app.js', 'paper.css'].map((f) => readFileSync(join(here, f), 'utf8')).join('');
const chars = [...new Set([...text, ...' ，。、：；！？「」『』（）—…·０１２３４５６７８９0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.,:;!?()[]/+-×÷²³°℃′″'])].join('');
for (const [from, to] of [['NotoSerifSC.ttf', 'song.woff2'], ['LXGWWenKai-Regular.ttf', 'kai.woff2'], ['SourceSerif4.ttf', 'latin.woff2'], ['SourceSerif4-Italic.ttf', 'latin-italic.woff2']]) {
  const out = await subsetFont(readFileSync(join(src, from)), chars, { targetFormat: 'woff2', variationAxes: undefined });
  writeFileSync(join(here, 'fonts', to), out);
  console.log(to, out.length);
}

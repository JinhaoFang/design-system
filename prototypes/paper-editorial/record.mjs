/*
 * PROTOTYPE · 给三个变体截图和录屏，输出到 out/（git 忽略）。
 * 用法：node prototypes/paper-editorial/record.mjs [shots|video] [A,B,C]
 * shots：每个变体一张首屏（入场结束后）和一张整页静态长图；video：每个变体一段 1440×900 的加载 + 慢速滚动录屏。
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', '..', 'out', 'paper-editorial');
mkdirSync(out, { recursive: true });
const mode = process.argv[2] ?? 'shots';
const list = (process.argv[3] ?? 'A,B,C').split(',');
const server = spawn(process.execPath, [join(here, 'serve.mjs')], { env: { ...process.env, PORT: '4199' }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch({ args: ['--no-proxy-server'] });
const base = 'http://localhost:4199/';
try {
  for (const v of list) {
    if (mode === 'shots') {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: Number(process.env.DPR ?? 1) });
      await page.goto(`${base}?variant=${v}&record=1`, { waitUntil: 'domcontentloaded', timeout: 120000 }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(3600);
      await page.screenshot({ path: join(out, `${v}-hero.png`) });
      await page.goto(`${base}?variant=${v}&static=1`, { waitUntil: 'domcontentloaded', timeout: 120000 }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(600);
      await page.screenshot({ path: join(out, `${v}-full.png`), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400);
      await page.screenshot({ path: join(out, `${v}-mobile.png`), fullPage: true });
      await page.close();
    } else {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: out, size: { width: 1440, height: 900 } } });
      const page = await ctx.newPage();
      await page.goto(`${base}?variant=${v}&record=1`, { waitUntil: 'domcontentloaded', timeout: 120000 }); await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(4200);
      const h = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      for (let y = 0; y <= h; y += 6) { await page.evaluate((yy) => scrollTo(0, yy), y); await page.waitForTimeout(16); }
      await page.waitForTimeout(11000);
      const tmp = await page.video().path(); await ctx.close();
      renameSync(tmp, join(out, `${v}-scroll.webm`));
    }
    console.log(v, mode, 'done');
  }
} finally { await browser.close(); server.kill(); }

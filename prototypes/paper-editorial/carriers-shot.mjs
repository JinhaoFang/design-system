import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const server = spawn(process.execPath, ['prototypes/paper-editorial/serve.mjs'], { env: { ...process.env, PORT: '4197' }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const b = await chromium.launch({ args: ['--no-proxy-server'] });
try {
  for (const v of ['A', 'B', 'C']) {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 0.6 });
    await p.goto(`http://localhost:4197/?variant=${v}&static=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
    await p.locator('.carriers').screenshot({ path: `out/paper-editorial/${v}-carriers.png` });
    await p.close();
  }
} finally { await b.close(); server.kill(); }

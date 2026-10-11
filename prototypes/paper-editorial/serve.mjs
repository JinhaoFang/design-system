/*
 * PROTOTYPE · 方向稿的静态服务器（字体不能从 file:// 加载）。用法：pnpm proto:paper，然后打开打印出的地址。
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.webm': 'video/webm' };
const port = Number(process.env.PORT ?? 4173);
createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  try { const file = path || 'index.html'; const body = await readFile(join(root, file)); res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end('not found'); }
}).listen(port, () => console.log(`纸本编辑方向稿：http://localhost:${port}/?variant=A （B、C 同理，← → 切换）`));

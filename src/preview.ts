/*
 * Preview (预览): a local static file server for any output directory (one work, a layout overview, a regression output, a system page), so a judge can operate the pages by hand.
 * startPreview({ dir, port?, host? }) -> { url, close(), dir }. Defaults: host 127.0.0.1, port 4173 (0 picks a free port). Nothing is written to dir.
 * Routes: "/" is the navigation index (a generated page listing every artifact under dir, found by artifact-scan.ts, with system, carrier, canvas, concept, error and warning counts, plus the screenshots,
 * recordings, PDFs and reports next to each one); every other path is a file under dir. A directory path serves its index.html (a path without the trailing slash redirects, so relative links to fonts/ and
 * images/ resolve); an artifact at the root of dir is listed first and opened as /index.html. Byte ranges are supported so recordings seek; MIME types cover the files builds produce (html, css, js, json,
 * png, webp, jpg, svg, woff2, webm, pdf, md). Paths outside dir are refused (404).
 * Groups on the navigation page follow the first path segment of each artifact (for a regression output: the system, then works, overview and system pages as sub-paths).
 * Web pages scroll and slide pages turn with the arrow keys because they are served exactly as built.
 */
import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { scanArtifacts } from './artifact-scan.ts';
import type { ArtifactEntry } from './artifact-scan.ts';
import { escapeHtml } from './layout.ts';
import { BuildError } from './types.ts';

export interface PreviewOptions {
  dir: string;
  port?: number;
  host?: string;
}

export interface PreviewServer {
  url: string;
  dir: string;
  close: () => Promise<void>;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
};

const MEDIA = new Set(['.png', '.webm', '.pdf', '.md']);

function encodePath(rel: string): string {
  return rel.split('/').map(encodeURIComponent).join('/');
}

function hrefOf(entry: ArtifactEntry): string {
  return entry.rel === '' ? '/index.html' : `/${encodePath(entry.rel)}/`;
}

async function mediaOf(entry: ArtifactEntry): Promise<{ name: string; href: string }[]> {
  const names = (await readdir(entry.dir)).filter((name) => MEDIA.has(extname(name).toLowerCase())).sort();
  const prefix = entry.rel === '' ? '' : `/${encodePath(entry.rel)}`;
  return names.map((name) => ({ name, href: `${prefix}/${encodeURIComponent(name)}` }));
}

function groupOf(entry: ArtifactEntry): string {
  return entry.rel === '' ? '' : entry.rel.split('/')[0]!;
}

export async function navigationPage(dir: string): Promise<string> {
  const entries = await scanArtifacts(dir);
  const groups = new Map<string, ArtifactEntry[]>();
  for (const entry of entries) groups.set(groupOf(entry), [...(groups.get(groupOf(entry)) ?? []), entry]);
  const sections: string[] = [];
  for (const [group, items] of groups) {
    const rows: string[] = [];
    for (const entry of items) {
      const counts = entry.errors !== undefined ? `<span class="n${entry.errors > 0 ? ' bad' : ''}">${entry.errors} 个错误 · ${entry.warnings ?? 0} 个警告</span>` : '';
      const meta = [entry.system, entry.carrier, entry.canvas].filter(Boolean).map((part) => escapeHtml(String(part))).join(' / ');
      const media = (await mediaOf(entry)).map((file) => `<a class="m" href="${file.href}">${escapeHtml(file.name)}</a>`).join('');
      rows.push(
        `<li><a class="open" href="${hrefOf(entry)}"><b>${escapeHtml(entry.rel === '' ? '当前目录' : entry.rel.split('/').slice(1).join('/') || entry.rel)}</b>` +
          `${entry.concept ? `<i>${escapeHtml(entry.concept)}</i>` : ''}</a><span class="meta">${meta}</span>${counts}<span class="files">${media}</span></li>`,
      );
    }
    sections.push(`<section><h2>${escapeHtml(group === '' ? '本目录' : group)}</h2><ul>${rows.join('')}</ul></section>`);
  }
  const body = sections.length ? sections.join('\n') : '<p class="empty">这个目录下没有可打开的产物（含 index.html 的子目录）。</p>';
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>预览导航</title>
<style>
:root{color-scheme:light dark;--bg:#f4efe6;--fg:#1d1a16;--mute:#7a7266;--line:#d9d0c0;--bad:#b3261e}
@media (prefers-color-scheme:dark){:root{--bg:#171512;--fg:#efe9dd;--mute:#9b9384;--line:#38332b;--bad:#ff8a80}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 "Noto Serif SC","Source Han Serif SC","Songti SC",Georgia,serif;padding:clamp(24px,6vw,96px) clamp(16px,6vw,96px)}
h1{font-size:clamp(32px,5vw,56px);line-height:1.1;margin:0 0 8px;font-weight:600;letter-spacing:.02em}
.dir{color:var(--mute);margin:0 0 56px;word-break:break-all;font-size:14px}
h2{font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:var(--mute);border-top:1px solid var(--fg);padding-top:12px;margin:48px 0 0;font-weight:500}
ul{list-style:none;margin:0;padding:0}
li{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr) auto;gap:4px 24px;align-items:baseline;padding:14px 0;border-bottom:1px solid var(--line)}
a{color:inherit}
a.open{display:flex;flex-direction:column;text-decoration:none}
a.open b{font-size:20px;font-weight:600}
a.open i{font-style:normal;color:var(--mute);font-size:14px}
a.open:hover b{text-decoration:underline;text-underline-offset:4px}
.meta,.n{font-size:13px;color:var(--mute)}
.n.bad{color:var(--bad)}
.files{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:4px 16px;font-size:13px}
.m{color:var(--mute)}
.empty{color:var(--mute)}
@media (max-width:640px){li{grid-template-columns:1fr}}
</style></head><body>
<h1>预览导航</h1>
<p class="dir">${escapeHtml(dir)}</p>
${body}
</body></html>
`;
}

function send(res: ServerResponse, status: number, type: string, body: string): void {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
}

async function serveFile(req: IncomingMessage, res: ServerResponse, file: string, size: number): Promise<void> {
  const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  const headers = { 'content-type': type, 'accept-ranges': 'bytes', 'cache-control': 'no-store' };
  if (range && (range[1] !== '' || range[2] !== '')) {
    const start = range[1] === '' ? Math.max(0, size - Number(range[2])) : Number(range[1]);
    const end = range[1] === '' || range[2] === '' ? size - 1 : Math.min(Number(range[2]), size - 1);
    if (start > end || start >= size) {
      res.writeHead(416, { 'content-range': `bytes */${size}` });
      res.end();
      return;
    }
    res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 });
    if (req.method === 'HEAD') return void res.end();
    createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, 'content-length': size });
  if (req.method === 'HEAD') return void res.end();
  createReadStream(file).pipe(res);
}

async function handle(root: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'text/plain; charset=utf-8', '只支持 GET');
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'text/plain; charset=utf-8', '路径无法解析');
  }
  if (pathname === '/') return send(res, 200, MIME['.html']!, await navigationPage(root));
  const target = resolve(join(root, normalize(pathname)));
  if (target !== root && !target.startsWith(root + sep)) return send(res, 404, 'text/plain; charset=utf-8', '找不到');
  let info;
  try {
    info = await stat(target);
  } catch {
    return send(res, 404, 'text/plain; charset=utf-8', '找不到');
  }
  if (info.isDirectory()) {
    if (!pathname.endsWith('/')) {
      res.writeHead(301, { location: `${pathname}/` });
      return void res.end();
    }
    const index = join(target, 'index.html');
    try {
      return await serveFile(req, res, index, (await stat(index)).size);
    } catch {
      return send(res, 404, 'text/plain; charset=utf-8', '这个目录没有 index.html');
    }
  }
  await serveFile(req, res, target, info.size);
}

export async function startPreview(options: PreviewOptions): Promise<PreviewServer> {
  const root = resolve(options.dir);
  try {
    if (!(await stat(root)).isDirectory()) throw new Error('not a directory');
  } catch {
    throw new BuildError([`找不到产物目录：${root}`]);
  }
  const host = options.host ?? '127.0.0.1';
  const server: Server = createServer((req, res) => {
    handle(root, req, res).catch(() => {
      if (!res.headersSent) send(res, 500, 'text/plain; charset=utf-8', '服务出错');
      else res.destroy();
    });
  });
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(options.port ?? 4173, host, () => resolveListen());
  }).catch((error: NodeJS.ErrnoException) => {
    throw new BuildError([error.code === 'EADDRINUSE' ? `端口 ${options.port ?? 4173} 已被占用，换一个 --port` : `预览服务启动失败：${error.message}`]);
  });
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/`,
    dir: root,
    close: () => new Promise<void>((done) => {
      server.closeAllConnections();
      server.close(() => done());
    }),
  };
}

/*
 * Preview (预览): a local static file server for any output directory (one work, a layout overview, a regression output, a system page), so a judge can operate the pages by hand.
 * startPreview({ dir, port?, host? }) -> { url, close(), dir }. Defaults: host 127.0.0.1, port 4173 (0 picks a free port). Nothing is written to dir.
 * Routes: "/" is the navigation index; "/_overview/<folder>/" is the generated listing of one system's layout-overview builds (preview-nav.ts); every other path is a file under dir.
 * A directory path serves its index.html (a path without the trailing slash redirects, so relative links to fonts/ and images/ resolve); an artifact at the root of dir is listed first and opened as /index.html.
 * Byte ranges are supported so recordings seek; MIME types cover the files builds produce (html, css, js, json, png, webp, jpg, svg, woff2, webm, pdf, md). Paths outside dir are refused (404).
 * Navigation index: for regression output, a single system folder or a lone layout overview (preview-nav.ts) it is grouped per system (system page, sample thumbnails, one 排法总览 entry);
 * for any other shape it is the flat list of every artifact found by artifact-scan.ts, grouped by first path segment, with system, carrier, canvas, concept, error and warning counts and the screenshots, recordings, PDFs and reports next to each one.
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
import { FLAT_CSS, OVERVIEW_ROUTE, countsText, detectLayout, encodePath, groupedHome, listingBases, overviewListing, pageShell } from './preview-nav.ts';
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

async function flatSections(entries: ArtifactEntry[]): Promise<string> {
  const groups = new Map<string, ArtifactEntry[]>();
  for (const entry of entries) groups.set(groupOf(entry), [...(groups.get(groupOf(entry)) ?? []), entry]);
  const sections: string[] = [];
  for (const [group, items] of groups) {
    const rows: string[] = [];
    for (const entry of items) {
      const meta = [entry.system, entry.carrier, entry.canvas].filter(Boolean).map((part) => escapeHtml(String(part))).join(' / ');
      const media = (await mediaOf(entry)).map((file) => `<a class="m" href="${file.href}">${escapeHtml(file.name)}</a>`).join('');
      rows.push(
        `<li><a class="open" href="${hrefOf(entry)}"><b>${escapeHtml(entry.rel === '' ? '当前目录' : entry.rel.split('/').slice(1).join('/') || entry.rel)}</b>` +
          `${entry.concept ? `<i>${escapeHtml(entry.concept)}</i>` : ''}</a><span class="meta">${meta}</span>${countsText(entry.errors, entry.warnings)}<span class="files">${media}</span></li>`,
      );
    }
    sections.push(`<section><h2>${escapeHtml(group === '' ? '本目录' : group)}</h2><ul class="flat">${rows.join('')}</ul></section>`);
  }
  return sections.join('\n');
}

export async function navigationPage(dir: string): Promise<string> {
  const entries = await scanArtifacts(dir);
  const layout = await detectLayout(dir, entries);
  if (layout.kind !== 'flat') return groupedHome(dir, layout, flatSections);
  const body = entries.length ? await flatSections(entries) : '<p class="empty">这个目录下没有可打开的产物（含 index.html 的子目录）。</p>';
  return pageShell('预览导航', dir, body, FLAT_CSS);
}

async function overviewPage(root: string, pathname: string): Promise<string | undefined> {
  if (pathname !== OVERVIEW_ROUTE.slice(0, -1) && !pathname.startsWith(OVERVIEW_ROUTE)) return undefined;
  const base = pathname.slice(OVERVIEW_ROUTE.length).replace(/\/+$/, '');
  const entries = await scanArtifacts(root);
  const layout = await detectLayout(root, entries);
  if (!listingBases(layout).includes(base)) return undefined;
  return overviewListing(root, entries, base, false);
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
  const listing = await overviewPage(root, pathname);
  if (listing !== undefined) return send(res, 200, MIME['.html']!, listing);
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

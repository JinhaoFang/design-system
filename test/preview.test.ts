/*
 * Behavior tests for the preview command's server (预览), driven through startPreview() on a temp output directory shaped like real build output (a work, a layout overview, fonts).
 * They assert what a browser gets over HTTP: the navigation index at "/" listing every artifact with its media, pages and fonts served with the right types, directory redirects, byte ranges, and refused paths.
 */
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { startPreview } from '../src/preview.ts';
import type { PreviewServer } from '../src/preview.ts';
import { fixtures, tempDir } from './helpers.ts';

let root: string;
let server: PreviewServer;

async function artifact(rel: string, concept: string, errors: number): Promise<void> {
  const dir = join(root, rel);
  await mkdir(join(dir, 'fonts'), { recursive: true });
  await writeFile(join(dir, 'index.html'), `<!doctype html><title>${concept}</title><link rel="stylesheet" href="style.css">`);
  await writeFile(join(dir, 'style.css'), '@font-face{font-family:F;src:url(fonts/f.woff2)}');
  await copyFile(join(fixtures.fontCache, 'NotoSansSC-Regular.subset.woff2'), join(dir, 'fonts', 'f.woff2'));
  await writeFile(join(dir, 'web-desktop.png'), 'png');
  await writeFile(join(dir, 'web-scroll.webm'), '0123456789');
  await writeFile(join(dir, 'report.json'), JSON.stringify({ system: 'mini', work: { carrier: 'web', concept }, summary: { errors, warnings: 1 } }));
}

beforeAll(async () => {
  root = await tempDir('ds-preview-');
  await artifact('works/alpha', '甲作品', 0);
  await artifact('overview/web', '乙总览', 2);
  server = await startPreview({ dir: root, port: 0 });
});

afterAll(async () => {
  await server.close();
});

const get = (path: string, init?: RequestInit) => fetch(new URL(path, server.url), { redirect: 'manual', ...init });

describe('navigation index', () => {
  test('lists every artifact under the directory with its concept, counts and media files', async () => {
    const response = await get('/');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    const html = await response.text();
    expect(html).toContain('href="/works/alpha/"');
    expect(html).toContain('href="/overview/web/"');
    expect(html).toContain('甲作品');
    expect(html).toContain('乙总览');
    expect(html).toContain('2 个错误');
    expect(html).toContain('/works/alpha/web-scroll.webm');
    expect(html).toContain('/works/alpha/web-desktop.png');
    expect(html).not.toContain('f.woff2');
  });

  test('says so when the directory holds no artifact', async () => {
    const empty = await startPreview({ dir: await tempDir('ds-preview-empty-'), port: 0 });
    try {
      expect(await (await fetch(empty.url)).text()).toContain('没有可打开的产物');
    } finally {
      await empty.close();
    }
  });

  test('an artifact at the root of the directory is listed and opened as /index.html', async () => {
    const single = await tempDir('ds-preview-single-');
    await writeFile(join(single, 'index.html'), '<!doctype html><title>单件</title>');
    const view = await startPreview({ dir: single, port: 0 });
    try {
      expect(await (await fetch(view.url)).text()).toContain('href="/index.html"');
      expect(await (await fetch(new URL('/index.html', view.url))).text()).toContain('单件');
    } finally {
      await view.close();
    }
  });
});

describe('serving files', () => {
  test('serves a directory path as its index.html, redirecting to the trailing slash so relative links resolve', async () => {
    const redirect = await get('/works/alpha');
    expect(redirect.status).toBe(301);
    expect(redirect.headers.get('location')).toBe('/works/alpha/');
    const page = await get('/works/alpha/');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('甲作品');
  });

  test('serves fonts, styles and images with their own media types', async () => {
    const font = await get('/works/alpha/fonts/f.woff2');
    expect(font.headers.get('content-type')).toBe('font/woff2');
    expect((await font.arrayBuffer()).byteLength).toBeGreaterThan(1000);
    expect((await get('/works/alpha/style.css')).headers.get('content-type')).toContain('text/css');
    expect((await get('/works/alpha/web-desktop.png')).headers.get('content-type')).toBe('image/png');
    expect((await get('/works/alpha/web-scroll.webm')).headers.get('content-type')).toBe('video/webm');
  });

  test('answers byte ranges so recordings can seek', async () => {
    const response = await get('/works/alpha/web-scroll.webm', { headers: { range: 'bytes=2-5' } });
    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 2-5/10');
    expect(await response.text()).toBe('2345');
    expect((await get('/works/alpha/web-scroll.webm', { headers: { range: 'bytes=-3' } })).headers.get('content-range')).toBe('bytes 7-9/10');
    expect((await get('/works/alpha/web-scroll.webm', { headers: { range: 'bytes=40-50' } })).status).toBe(416);
  });

  test('refuses paths outside the directory and files that do not exist', async () => {
    expect((await get('/missing.html')).status).toBe(404);
    expect((await get('/%2e%2e/%2e%2e/etc/passwd')).status).toBe(404);
    expect((await get('/works/')).status).toBe(404);
  });
});

describe('starting', () => {
  test('fails with a message for a directory that does not exist', async () => {
    await expect(startPreview({ dir: join(root, 'nope'), port: 0 })).rejects.toThrow();
  });
});

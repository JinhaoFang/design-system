/*
 * Behavior tests for the preview command's server (预览), driven through startPreview() on a temp output directory shaped like real build output (a work, a layout overview, fonts).
 * They assert what a browser gets over HTTP: the navigation index at "/" listing every artifact with its media, pages and fonts served with the right types, directory redirects, byte ranges, and refused paths.
 * Regression-shaped output (<id>/system, <id>/works/<name>, <id>/overview), a single system folder and a lone layout overview get a grouped home page (system page, sample thumbnails, one 排法总览 entry)
 * and a generated per-system listing of the overview builds; any other shape keeps the flat listing.
 */
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { startPreview } from '../src/preview.ts';
import type { PreviewServer } from '../src/preview.ts';
import { fixtures, tempDir } from './helpers.ts';

let root: string;
let server: PreviewServer;

async function artifact(rel: string, concept: string, errors: number, base: string = root): Promise<void> {
  const dir = join(base, rel);
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

async function regressTree(base: string, id: string): Promise<void> {
  await artifact(`${id}/system`, `${id}体系页`, 0, base);
  await artifact(`${id}/works/yangzhang`, `${id}样张一`, 0, base);
  await artifact(`${id}/works/haibao`, `${id}样张二`, 1, base);
  await artifact(`${id}/overview/web`, `${id}网页总览`, 2, base);
  await artifact(`${id}/overview/social/square/title-a`, `${id}封面`, 1, base);
  await artifact(`${id}/overview/social/xiaohongshu/quote-b`, `${id}引语`, 0, base);
  await writeFile(join(base, id, 'overview', 'overview.md'), '# overview');
  await writeFile(join(base, id, 'overview', 'web', 'report.md'), '# report');
}

async function withPreview(dir: string, run: (view: PreviewServer) => Promise<void>): Promise<void> {
  const view = await startPreview({ dir, port: 0 });
  try {
    await run(view);
  } finally {
    await view.close();
  }
}

describe('navigation index for regression output', () => {
  let regress: string;

  beforeAll(async () => {
    regress = await tempDir('ds-preview-regress-');
    await regressTree(regress, 'alpha-sys');
    await regressTree(regress, 'beta-sys');
  });

  test('per system: the system page first, the samples, and one 排法总览 entry; the overview builds are not listed', async () => {
    await withPreview(regress, async (view) => {
      const html = await (await fetch(view.url)).text();
      for (const id of ['alpha-sys', 'beta-sys']) {
        expect(html).toContain(`href="/${id}/system/"`);
        expect(html).toContain(`href="/${id}/works/yangzhang/"`);
        expect(html).toContain(`href="/${id}/works/haibao/"`);
        expect(html).toContain(`/${id}/works/haibao/web-desktop.png`);
        expect(html).toContain(`href="/_overview/${id}/overview/"`);
        expect(html).not.toContain(`href="/${id}/overview/web/"`);
        expect(html).not.toContain(`/${id}/overview/social/square/title-a/`);
        expect(html).not.toContain('web-scroll.webm');
        expect(html).not.toContain('report.md');
      }
      expect(html).toContain('排法总览');
      expect(html).toContain('3 个错误');
      expect(html.indexOf('href="/alpha-sys/system/"')).toBeLessThan(html.indexOf('href="/alpha-sys/works/yangzhang/"'));
      expect(html.indexOf('href="/alpha-sys/works/yangzhang/"')).toBeLessThan(html.indexOf('href="/_overview/alpha-sys/overview/"'));
    });
  });

  test('the overview listing groups builds by carrier and canvas, opens each build and reaches the reports', async () => {
    await withPreview(regress, async (view) => {
      const response = await fetch(new URL('/_overview/alpha-sys/overview/', view.url));
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      const html = await response.text();
      expect(html).toContain('href="/alpha-sys/overview/web/"');
      expect(html).toContain('href="/alpha-sys/overview/social/square/title-a/"');
      expect(html).toContain('href="/alpha-sys/overview/social/xiaohongshu/quote-b/"');
      expect(html).toContain('/alpha-sys/overview/web/web-desktop.png');
      expect(html).toContain('/alpha-sys/overview/web/report.md');
      expect(html).toContain('/alpha-sys/overview/overview.md');
      expect(html).toContain('square');
      expect(html).toContain('xiaohongshu');
      expect(html).not.toContain('beta-sys');
      expect(html).toContain('href="/"');
    });
  });

  test('an unknown overview listing is not found', async () => {
    await withPreview(regress, async (view) => {
      expect((await fetch(new URL('/_overview/nope/overview/', view.url))).status).toBe(404);
      expect((await fetch(new URL('/_overview/alpha-sys/works/', view.url))).status).toBe(404);
    });
  });

  test('builds stay reachable at their own paths', async () => {
    await withPreview(regress, async (view) => {
      expect((await fetch(new URL('/alpha-sys/overview/web/', view.url))).status).toBe(200);
      expect((await fetch(new URL('/alpha-sys/system/', view.url))).status).toBe(200);
    });
  });

  test('builds that sit outside the systems are still listed', async () => {
    const mixed = await tempDir('ds-preview-mixed-');
    await regressTree(mixed, 'gamma-sys');
    await artifact('scratch/loose', '散件', 0, mixed);
    await withPreview(mixed, async (view) => {
      const html = await (await fetch(view.url)).text();
      expect(html).toContain('href="/gamma-sys/system/"');
      expect(html).toContain('href="/scratch/loose/"');
    });
  });
});

describe('navigation index for a single system folder or a lone overview', () => {
  test('a single system folder shows that system without a folder prefix', async () => {
    const one = await tempDir('ds-preview-one-');
    await artifact('system', '体系页', 0, one);
    await artifact('works/yangzhang', '样张', 0, one);
    await artifact('overview/web', '网页总览', 2, one);
    await writeFile(join(one, 'overview', 'overview.md'), '# overview');
    await withPreview(one, async (view) => {
      const html = await (await fetch(view.url)).text();
      expect(html).toContain('href="/system/"');
      expect(html).toContain('href="/works/yangzhang/"');
      expect(html).toContain('href="/_overview/overview/"');
      expect(html).not.toContain('href="/overview/web/"');
      const listing = await (await fetch(new URL('/_overview/overview/', view.url))).text();
      expect(listing).toContain('href="/overview/web/"');
    });
  });

  test('a lone layout overview lists its builds grouped, right on the home page', async () => {
    const lone = await tempDir('ds-preview-lone-');
    await artifact('web', '网页总览', 2, lone);
    await artifact('social/square/title-a', '封面', 0, lone);
    await writeFile(join(lone, 'overview.md'), '# overview');
    await withPreview(lone, async (view) => {
      const html = await (await fetch(view.url)).text();
      expect(html).toContain('href="/web/"');
      expect(html).toContain('href="/social/square/title-a/"');
      expect(html).toContain('/web/web-desktop.png');
      expect(html).toContain('/overview.md');
      expect(html).not.toContain('web-scroll.webm');
    });
  });

  test('a folder of plain builds keeps the flat listing with media files', async () => {
    await withPreview(root, async (view) => {
      const html = await (await fetch(view.url)).text();
      expect(html).toContain('/works/alpha/web-scroll.webm');
      expect(html).not.toContain('_overview');
    });
  });
});

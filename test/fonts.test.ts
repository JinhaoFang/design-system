/* Behavior tests for fonts: font-list format validation, the fetch-fonts command, and the font checks (not in list, missing glyph, license vs carrier). Tests reach the pipeline through buildAndCheck, validateSystem and fetchFonts. */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, test } from 'vitest';
import { validateSystem } from '../src/build-and-check.ts';
import { fetchFonts } from '../src/fetch-fonts.ts';
import { fixtures, repoRoot, tempDir } from './helpers.ts';
import { editJson, patchedLibrary } from './system-helpers.ts';

const execFileAsync = promisify(execFile);

const validateWithManifest = (edit: (manifest: any) => void) =>
  patchedLibrary((dir) => editJson(join(dir, 'fonts', 'manifest.json'), edit)).then((libraryDir) =>
    validateSystem({ systemDir: fixtures.system, libraryDir }),
  );

describe('font list format', () => {
  test('the fixture list has every required field and validates', async () => {
    const system = await validateSystem({ systemDir: fixtures.system, libraryDir: fixtures.library });
    expect(system.manifest.fonts[0]).toMatchObject({
      id: 'noto-sans-sc-fixture',
      family: 'Noto Sans SC',
      weight: 400,
      scripts: ['cjk', 'latin'],
      license: { name: 'OFL-1.1', url: expect.stringMatching(/^https:/) },
      permissions: { commercial: true, webEmbed: true, fileEmbed: true },
      carriers: ['web', 'slides', 'social'],
      pptSafe: false,
      source: { url: expect.any(String), sha256: expect.stringMatching(/^[0-9a-f]{64}$/) },
    });
  });

  test('lists every missing or wrong field with the entry id', async () => {
    const attempt = validateWithManifest((m) => {
      const entry = m.fonts[0];
      delete entry.permissions;
      delete entry.pptSafe;
      entry.scripts = ['klingon'];
      entry.carriers = ['web', 'billboard'];
      entry.license.url = 'not a url';
      entry.source.sha256 = 'abc';
      entry.weight = 0;
    });
    await expect(attempt).rejects.toThrow(/noto-sans-sc-fixture[\s\S]*permissions/);
    await expect(attempt).rejects.toThrow(/pptSafe/);
    await expect(attempt).rejects.toThrow(/klingon/);
    await expect(attempt).rejects.toThrow(/billboard/);
    await expect(attempt).rejects.toThrow(/license\.url/);
    await expect(attempt).rejects.toThrow(/sha256/);
    await expect(attempt).rejects.toThrow(/weight/);
  });

  test('rejects duplicate ids', async () => {
    await expect(validateWithManifest((m) => m.fonts.push({ ...m.fonts[0] }))).rejects.toThrow(/重复/);
  });

  test('a carrier that embeds the font in HTML needs web embedding permission', async () => {
    await expect(
      validateWithManifest((m) => {
        m.fonts[0].permissions.webEmbed = false;
      }),
    ).rejects.toThrow(/webEmbed/);
  });
});

const FONT_BYTES = Buffer.from('pretend this is a font file, long enough to hash');
const FONT_SHA = createHash('sha256').update(FONT_BYTES).digest('hex');

async function libraryFor(url: string, sha256 = FONT_SHA): Promise<string> {
  return patchedLibrary((dir) =>
    editJson(join(dir, 'fonts', 'manifest.json'), (m) => {
      m.fonts[0].file = 'Pretend-Regular.woff2';
      m.fonts[0].source = { url, sha256 };
    }),
  );
}

async function serve(handler: (request: IncomingMessage, response: ServerResponse) => void) {
  const requests: string[] = [];
  const tunnels: string[] = [];
  const server: Server = createServer((request, response) => {
    requests.push(request.url ?? '');
    handler(request, response);
  });
  server.on('connect', (request, socket, head) => {
    tunnels.push(request.url ?? '');
    socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (head.length) socket.unshift(head);
    server.emit('connection', socket);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    port,
    requests,
    tunnels,
    close: () => {
      server.closeAllConnections();
      return new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

const sendFont: Parameters<typeof serve>[0] = (_request, response) => {
  response.writeHead(200, { 'content-type': 'font/woff2' });
  response.end(FONT_BYTES);
};

describe('fetch-fonts', () => {
  test('downloads from a local file URL into the cache and reports it', async () => {
    const source = join(await tempDir(), 'source.woff2');
    await writeFile(source, FONT_BYTES);
    const cache = await tempDir('ds-cache-');
    const result = await fetchFonts({ libraryDir: await libraryFor(pathToFileURL(source).href), fontCacheDir: cache });
    expect(result.fetched).toEqual(['noto-sans-sc-fixture']);
    expect(await readFile(join(cache, 'Pretend-Regular.woff2'))).toEqual(FONT_BYTES);
  });

  test('downloads over HTTP and skips a font whose cached file already matches the checksum', async () => {
    const server = await serve(sendFont);
    try {
      const library = await libraryFor(`http://127.0.0.1:${server.port}/pretend.woff2`);
      const cache = await tempDir('ds-cache-');
      expect((await fetchFonts({ libraryDir: library, fontCacheDir: cache })).fetched).toEqual(['noto-sans-sc-fixture']);
      const second = await fetchFonts({ libraryDir: library, fontCacheDir: cache });
      expect(second).toEqual({ fetched: [], cached: ['noto-sans-sc-fixture'] });
      expect(server.requests).toEqual(['/pretend.woff2']);
    } finally {
      await server.close();
    }
  });

  test('a checksum mismatch is an error and leaves nothing in the cache', async () => {
    const server = await serve(sendFont);
    try {
      const library = await libraryFor(`http://127.0.0.1:${server.port}/pretend.woff2`, 'a'.repeat(64));
      const cache = await tempDir('ds-cache-');
      await expect(fetchFonts({ libraryDir: library, fontCacheDir: cache })).rejects.toThrow(/noto-sans-sc-fixture[\s\S]*校验和/);
      expect(await readdir(cache)).toEqual([]);
    } finally {
      await server.close();
    }
  });

  test('a corrupted cached file is replaced by a fresh verified download', async () => {
    const server = await serve(sendFont);
    try {
      const library = await libraryFor(`http://127.0.0.1:${server.port}/pretend.woff2`);
      const cache = await tempDir('ds-cache-');
      await writeFile(join(cache, 'Pretend-Regular.woff2'), 'corrupted');
      expect((await fetchFonts({ libraryDir: library, fontCacheDir: cache })).fetched).toEqual(['noto-sans-sc-fixture']);
      expect(await readFile(join(cache, 'Pretend-Regular.woff2'))).toEqual(FONT_BYTES);
    } finally {
      await server.close();
    }
  });

  test('an HTTP error status is reported with the font id and status', async () => {
    const server = await serve((_request, response) => {
      response.writeHead(404).end();
    });
    try {
      const library = await libraryFor(`http://127.0.0.1:${server.port}/missing.woff2`);
      await expect(fetchFonts({ libraryDir: library, fontCacheDir: await tempDir('ds-cache-') })).rejects.toThrow(
        /noto-sans-sc-fixture[\s\S]*404/,
      );
    } finally {
      await server.close();
    }
  });

  test('honors the HTTP proxy from the environment for non-local hosts', async () => {
    const proxy = await serve(sendFont);
    const names = ['HTTP_PROXY', 'http_proxy', 'NO_PROXY', 'no_proxy'];
    const saved = names.map((name) => [name, process.env[name]] as const);
    try {
      process.env['HTTP_PROXY'] = process.env['http_proxy'] = `http://127.0.0.1:${proxy.port}`;
      process.env['NO_PROXY'] = process.env['no_proxy'] = 'localhost,127.0.0.1,::1';
      const library = await libraryFor('http://fonts.example.test/official/pretend.woff2');
      const cache = await tempDir('ds-cache-');
      expect((await fetchFonts({ libraryDir: library, fontCacheDir: cache })).fetched).toEqual(['noto-sans-sc-fixture']);
      expect(proxy.tunnels).toEqual(['fonts.example.test:80']);
      expect(proxy.requests).toEqual(['/official/pretend.woff2']);
    } finally {
      for (const [name, value] of saved) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
      await proxy.close();
    }
  });

  test('the real library font list exists and fetching it needs no network', async () => {
    const result = await fetchFonts({ libraryDir: join(repoRoot, 'library'), fontCacheDir: await tempDir('ds-cache-') });
    expect(result.fetched).toEqual([]);
  });

  test('the fetch-fonts command fills the cache, and exits 2 with the reason on a checksum mismatch', async () => {
    const source = join(await tempDir(), 'source.woff2');
    await writeFile(source, FONT_BYTES);
    const url = pathToFileURL(source).href;
    const cli = (library: string, cache: string) =>
      execFileAsync(process.execPath, ['src/cli.ts', 'fetch-fonts', '--library', library, '--font-cache', cache], { cwd: repoRoot });
    const cache = await tempDir('ds-cache-');
    await cli(await libraryFor(url), cache);
    expect(await readFile(join(cache, 'Pretend-Regular.woff2'))).toEqual(FONT_BYTES);
    await expect(cli(await libraryFor(url, 'b'.repeat(64)), await tempDir('ds-cache-'))).rejects.toMatchObject({
      code: 2,
      stderr: expect.stringContaining('校验和'),
    });
  });
});

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
import { loadFontManifest } from '../src/fonts.ts';
import type { BuildResult } from '../src/build-and-check.ts';
import { fixtures, repoRoot, run, tempDir } from './helpers.ts';
import { box, customWork } from './custom-work.ts';
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

  test('style is optional, defaults to normal, and only normal or italic are allowed', async () => {
    await expect(validateWithManifest((m) => (m.fonts[0].style = 'italic'))).resolves.toBeDefined();
    await expect(validateWithManifest((m) => (m.fonts[0].style = 'normal'))).resolves.toBeDefined();
    await expect(validateWithManifest((m) => (m.fonts[0].style = 'oblique'))).rejects.toThrow(/noto-sans-sc-fixture[\s\S]*style/);
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

  test('the real library font list validates and covers CJK serif, CJK sans and a Latin pairing, none of them PPT-safe', async () => {
    const manifest = await loadFontManifest(join(repoRoot, 'library'));
    const families = new Set(manifest.fonts.map((font) => font.family));
    expect(families).toContain('Noto Serif SC');
    expect(families).toContain('Noto Sans SC');
    expect(manifest.fonts.some((font) => font.scripts.includes('latin') && !font.scripts.includes('cjk'))).toBe(true);
    for (const font of manifest.fonts) {
      expect(font.pptSafe).toBe(false);
      expect(font.license.url).toMatch(/^https:/);
      expect(font.source.url).not.toMatch(/latest|\/(main|master)\//);
    }
  });

  test('the real library has the light and medium Noto Serif SC weights and Source Serif 4 light and italic faces, italics marked by style', async () => {
    const manifest = await loadFontManifest(join(repoRoot, 'library'));
    const byId = new Map(manifest.fonts.map((font) => [font.id, font]));
    const expected: [string, string, number, string | undefined][] = [
      ['noto-serif-sc-200', 'NotoSerifSC-ExtraLight', 200, undefined],
      ['noto-serif-sc-300', 'NotoSerifSC-Light', 300, undefined],
      ['noto-serif-sc-500', 'NotoSerifSC-Medium', 500, undefined],
      ['noto-serif-sc-600', 'NotoSerifSC-SemiBold', 600, undefined],
      ['source-serif-4-200', 'SourceSerif4-ExtraLight', 200, undefined],
      ['source-serif-4-300', 'SourceSerif4-Light', 300, undefined],
      ['source-serif-4-300-italic', 'SourceSerif4-LightIt', 300, 'italic'],
      ['source-serif-4-400-italic', 'SourceSerif4-It', 400, 'italic'],
    ];
    for (const [id, postScriptName, weight, style] of expected) {
      expect(byId.get(id), id).toMatchObject({ postScriptName, weight, license: { name: 'OFL-1.1' } });
      expect(byId.get(id)!.style, id).toBe(style);
    }
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

const fontFindings = (result: BuildResult) => result.report.findings.filter((finding) => finding.category === 'fonts');

describe('font checks', () => {
  test('a clean work renders only with fonts from the list and has no font findings', async () => {
    const result = await run(fixtures.work('clean'));
    expect(fontFindings(result)).toEqual([]);
  });

  test('a font outside the list is an error located at the text block', async () => {
    const result = await run(fixtures.work('font-outside-list'));
    expect(result.exitCode).toBe(1);
    expect(result.report.findings).toEqual([
      expect.objectContaining({
        ruleId: 'fonts/not-in-manifest',
        category: 'fonts',
        severity: 'error',
        location: expect.objectContaining({ unit: 'title', layout: 'system-font', slot: 'title' }),
        message: expect.stringContaining('不在字体清单里'),
      }),
    ]);
  });

  test('a glyph the list font lacks, shown by a fallback font, is one missing-glyph error naming the character', async () => {
    const result = await run(fixtures.work('font-missing-glyph'));
    expect(result.exitCode).toBe(1);
    expect(result.report.findings).toEqual([
      expect.objectContaining({
        ruleId: 'fonts/missing-glyph',
        category: 'fonts',
        severity: 'error',
        location: expect.objectContaining({ unit: 'title', layout: 'stack', slot: 'title' }),
        message: expect.stringMatching(/龘[\s\S]*Noto Sans SC/),
      }),
    ]);
  });

  test('a glyph that no installed font has (drawn as a box) is also a missing-glyph error', async () => {
    const result = await run(fixtures.work('font-no-glyph-anywhere'));
    expect(result.report.findings).toEqual([
      expect.objectContaining({ ruleId: 'fonts/missing-glyph', location: expect.objectContaining({ slot: 'title' }), message: expect.stringContaining('U+E000') }),
    ]);
  });

  test('a font whose license does not allow the carrier is an error naming the font and the carrier', async () => {
    const library = await patchedLibrary((dir) =>
      editJson(join(dir, 'fonts', 'manifest.json'), (m) => {
        m.fonts[0].carriers = ['web', 'slides'];
      }),
    );
    const result = await run(fixtures.work('clean'), { libraryDir: library });
    expect(result.exitCode).toBe(1);
    expect(result.report.findings).toEqual([
      expect.objectContaining({
        ruleId: 'fonts/license-carrier',
        category: 'fonts',
        severity: 'error',
        location: expect.objectContaining({ unit: 'title' }),
        message: expect.stringMatching(/noto-sans-sc-fixture[\s\S]*social/),
      }),
    ]);
  });

  test('the font checks also run on every slide of the slides carrier', async () => {
    const library = await patchedLibrary((dir) =>
      editJson(join(dir, 'fonts', 'manifest.json'), (m) => {
        m.fonts[0].carriers = ['social'];
      }),
    );
    const result = await run(fixtures.work('slides-clean'), { libraryDir: library });
    const found = fontFindings(result);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((finding) => finding.ruleId === 'fonts/license-carrier' && finding.location.slide !== undefined)).toBe(true);
  });

  test('the font checks also run on the web carrier and a font license problem is reported once, not per viewport', async () => {
    const library = await patchedLibrary((dir) =>
      editJson(join(dir, 'fonts', 'manifest.json'), (m) => {
        m.fonts[0].carriers = ['social'];
      }),
    );
    const result = await run(fixtures.work('web-clean'), { libraryDir: library });
    expect(fontFindings(result)).toEqual([expect.objectContaining({ ruleId: 'fonts/license-carrier', severity: 'error' })]);
    expect(fontFindings(result)[0]!.message).not.toContain('手机宽度');
  });
});

describe('font style (italic faces)', () => {
  const styleLibrary = (style: string) =>
    patchedLibrary((dir) =>
      editJson(join(dir, 'fonts', 'manifest.json'), (m) => {
        m.fonts[0].style = style;
      }),
    );
  const italicText = box('font-style:italic;');
  const upright = box();
  const fontFaces = async (result: BuildResult) => (await readFile(result.artifacts.index, 'utf8')).match(/@font-face\{[^}]*\}/g) ?? [];

  test('the generated @font-face states font-style, normal by default and italic for an italic entry', async () => {
    const plain = await run(await customWork(upright));
    expect(await fontFaces(plain)).toEqual([expect.stringContaining('font-style:normal')]);
    const italic = await run(await customWork(upright), { libraryDir: await styleLibrary('italic') });
    expect(await fontFaces(italic)).toEqual([expect.stringContaining('font-style:italic')]);
  });

  test('italic text drawn only by upright faces is one error naming the font', async () => {
    const result = await run(await customWork(italicText));
    expect(result.exitCode).toBe(1);
    expect(fontFindings(result)).toEqual([
      expect.objectContaining({
        ruleId: 'fonts/style-mismatch',
        severity: 'error',
        location: expect.objectContaining({ unit: 'custom' }),
        message: expect.stringMatching(/斜体[\s\S]*Noto Sans SC/),
      }),
    ]);
  });

  test('italic text resolves to the italic entry and is clean', async () => {
    const result = await run(await customWork(italicText), { libraryDir: await styleLibrary('italic') });
    expect(fontFindings(result)).toEqual([]);
  });

  test('upright text drawn by an italic face is an error', async () => {
    const result = await run(await customWork(upright), { libraryDir: await styleLibrary('italic') });
    expect(fontFindings(result)).toEqual([
      expect.objectContaining({ ruleId: 'fonts/style-mismatch', severity: 'error', message: expect.stringMatching(/正体[\s\S]*Noto Sans SC/) }),
    ]);
  });

  test('an upright paragraph is not blamed for the italic face of an italic child it contains', async () => {
    const nested = box('', '<em style="font-style:italic">二点零</em>');
    const result = await run(await customWork(nested), { libraryDir: await styleLibrary('italic') });
    expect(fontFindings(result)).toEqual([]);
  });
});

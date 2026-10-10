/*
 * The fetch-fonts command (抓取字体): downloads every font in <library>/fonts/manifest.json into the local font cache (git-ignored, default .cache/fonts) and verifies sha256.
 * Input: libraryDir, fontCacheDir (default DEFAULT_FONT_CACHE), optional ids to fetch only some entries. Output: { fetched, cached } lists of font ids.
 * A cached file whose sha256 already matches is kept without any request; a missing or mismatching one is downloaded again. A download is verified before it is moved into the
 * cache, so a mismatch (or any failure) never leaves a bad file behind; all problems are collected into one BuildError naming the font id.
 * Sources: file: URLs are read from disk (used by tests); http(s) goes through undici and honors HTTP_PROXY / HTTPS_PROXY / NO_PROXY from the environment, except loopback hosts, which are always direct.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Agent, EnvHttpProxyAgent, fetch } from 'undici';
import { DEFAULT_FONT_CACHE, loadFontManifest } from './fonts.ts';
import type { FontEntry } from './fonts.ts';
import { BuildError } from './types.ts';

export interface FetchFontsOptions {
  libraryDir: string;
  fontCacheDir?: string;
  ids?: string[];
}

export interface FetchFontsResult {
  fetched: string[];
  cached: string[];
}

const sha256 = (data: Uint8Array): string => createHash('sha256').update(data).digest('hex');
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

async function download(url: URL): Promise<Buffer> {
  if (url.protocol === 'file:') return readFile(fileURLToPath(url));
  const dispatcher = LOOPBACK.has(url.hostname) ? new Agent() : new EnvHttpProxyAgent();
  try {
    const response = await fetch(url, { dispatcher });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } finally {
    await dispatcher.close();
  }
}

async function cachedMatches(path: string, expected: string): Promise<boolean> {
  try {
    return sha256(await readFile(path)) === expected;
  } catch {
    return false;
  }
}

async function fetchOne(entry: FontEntry, cacheDir: string): Promise<'fetched' | 'cached'> {
  const target = join(cacheDir, entry.file);
  if (await cachedMatches(target, entry.source.sha256)) return 'cached';
  let data: Buffer;
  try {
    data = await download(new URL(entry.source.url));
  } catch (error) {
    throw new BuildError([`字体「${entry.id}」下载失败：${entry.source.url}（${(error as Error).message}）`]);
  }
  const actual = sha256(data);
  if (actual !== entry.source.sha256) {
    throw new BuildError([`字体「${entry.id}」校验和不符：清单记录 ${entry.source.sha256}，下载到的文件是 ${actual}（${entry.source.url}）`]);
  }
  const partial = `${target}.part-${process.pid}`;
  try {
    await writeFile(partial, data);
    await rename(partial, target);
  } catch (error) {
    await rm(partial, { force: true });
    throw error;
  }
  return 'fetched';
}

export async function fetchFonts(options: FetchFontsOptions): Promise<FetchFontsResult> {
  const cacheDir = options.fontCacheDir ?? DEFAULT_FONT_CACHE;
  const manifest = await loadFontManifest(options.libraryDir);
  const unknown = (options.ids ?? []).filter((id) => !manifest.fonts.some((font) => font.id === id));
  if (unknown.length) throw new BuildError(unknown.map((id) => `字体清单里没有「${id}」`));
  const wanted = manifest.fonts.filter((font) => !options.ids || options.ids.includes(font.id));
  await mkdir(cacheDir, { recursive: true });
  const result: FetchFontsResult = { fetched: [], cached: [] };
  const issues: string[] = [];
  for (const entry of wanted) {
    try {
      result[await fetchOne(entry, cacheDir)].push(entry.id);
    } catch (error) {
      if (error instanceof BuildError) issues.push(...error.issues);
      else throw error;
    }
  }
  if (issues.length) throw new BuildError(issues);
  return result;
}

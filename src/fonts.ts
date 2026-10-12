/*
 * Font list (字体清单) format, validation and loading. File: <library>/fonts/manifest.json = { fonts: FontEntry[] }. Font files are never committed;
 * they live in the git-ignored local font cache (DEFAULT_FONT_CACHE, option fontCacheDir) under the entry's `file` name and are filled by the fetch-fonts command.
 * Entry fields: id (kebab-case, unique; token files reference it), family (CSS family used in @font-face), postScriptName (the name Chromium reports for the file, from the
 * font's own name table; the checker matches rendered fonts on it), weight (1-1000), style (optional, normal | italic, default normal; an italic face is its own entry with its own file and PostScript name, and its @font-face carries font-style:italic), scripts (cjk | latin: what the font covers), file (cache file name),
 * license { name, url (official license page), file? (license text next to the manifest) }, permissions { commercial, webEmbed, fileEmbed } (booleans, checked against the
 * official license), carriers (carrier ids the license allows), pptSafe (a common system font that survives PPT without embedding), source { url (http, https or file), sha256 of the downloaded file }.
 * Consistency: a carrier that ships the font inside HTML (web, slides) requires permissions.webEmbed.
 * loadFontManifest throws one BuildError listing every problem; an empty list is valid (the real library starts empty).
 */
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { CARRIER_IDS } from './carriers.ts';
import { BuildError } from './types.ts';

export const DEFAULT_FONT_CACHE = resolve('.cache', 'fonts');
export const FONT_SCRIPTS = ['cjk', 'latin'] as const;
export const FONT_STYLES = ['normal', 'italic'] as const;
export const WEB_EMBEDDING_CARRIERS = ['web', 'slides'] as const;

export interface FontEntry {
  id: string;
  family: string;
  postScriptName: string;
  weight: number;
  style?: (typeof FONT_STYLES)[number];
  scripts: (typeof FONT_SCRIPTS)[number][];
  file: string;
  license: { name: string; url: string; file?: string };
  permissions: { commercial: boolean; webEmbed: boolean; fileEmbed: boolean };
  carriers: string[];
  pptSafe: boolean;
  source: { url: string; sha256: string };
}

export const fontStyleOf = (font: FontEntry): (typeof FONT_STYLES)[number] => font.style ?? 'normal';

export interface FontManifest {
  dir: string;
  fonts: FontEntry[];
}

const isString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';
const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function isUrl(value: unknown, protocols: string[]): boolean {
  if (!isString(value)) return false;
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function checkFontEntries(fonts: unknown, source: string): string[] {
  if (!Array.isArray(fonts)) return [`${source} 缺少 fonts 数组`];
  const issues: string[] = [];
  const seen = new Set<string>();
  fonts.forEach((raw, index) => {
    const entry: any = raw;
    const label = isString(entry?.id) ? `「${entry.id}」` : `第 ${index + 1} 项`;
    const at = `${source} 字体${label}`;
    if (!isObject(entry)) {
      issues.push(`${at} 不是对象`);
      return;
    }
    if (!isString(entry.id) || !/^[a-z][a-z0-9-]*$/.test(entry.id)) issues.push(`${at} 的 id 只能用小写字母、数字和连字符，并以字母开头`);
    else if (seen.has(entry.id)) issues.push(`${at} 的 id 重复`);
    else seen.add(entry.id);
    if (!isString(entry.family)) issues.push(`${at} 缺少家族名 family`);
    if (!isString(entry.postScriptName)) issues.push(`${at} 缺少 postScriptName（字体文件自身的 PostScript 名）`);
    if (!Number.isInteger(entry.weight) || (entry.weight as number) < 1 || (entry.weight as number) > 1000) {
      issues.push(`${at} 的字重 weight 需为 1–1000 的整数`);
    }
    if (entry.style !== undefined && !FONT_STYLES.includes(entry.style as never)) {
      issues.push(`${at} 的字形风格 style 需为 ${FONT_STYLES.join(' 或 ')}（当前 ${JSON.stringify(entry.style)}），不写时按 normal`);
    }
    if (!Array.isArray(entry.scripts) || entry.scripts.length === 0 || entry.scripts.some((s: unknown) => !FONT_SCRIPTS.includes(s as never))) {
      issues.push(`${at} 的覆盖文字 scripts 需为非空数组，取值：${FONT_SCRIPTS.join('、')}（当前 ${JSON.stringify(entry.scripts)}）`);
    }
    if (!isString(entry.file) || /[\\/]/.test(entry.file)) issues.push(`${at} 的 file 需为缓存目录内的文件名`);
    const license = entry.license;
    if (!isObject(license)) issues.push(`${at} 缺少 license（name、url）`);
    else {
      if (!isString(license.name)) issues.push(`${at} 缺少 license.name`);
      if (!isUrl(license.url, ['https:', 'http:'])) issues.push(`${at} 的 license.url 需为官方授权页面的网址`);
      if (license.file !== undefined && !isString(license.file)) issues.push(`${at} 的 license.file 需为文件名`);
    }
    const permissions = entry.permissions;
    if (!isObject(permissions)) issues.push(`${at} 缺少 permissions（commercial、webEmbed、fileEmbed）`);
    else {
      for (const key of ['commercial', 'webEmbed', 'fileEmbed']) {
        if (typeof permissions[key] !== 'boolean') issues.push(`${at} 的 permissions.${key} 需为 true 或 false`);
      }
    }
    if (!Array.isArray(entry.carriers) || entry.carriers.some((c: unknown) => !CARRIER_IDS.includes(c as never))) {
      issues.push(`${at} 的可用载体 carriers 需为数组，取值：${CARRIER_IDS.join('、')}（当前 ${JSON.stringify(entry.carriers)}）`);
    } else if (isObject(permissions) && permissions['webEmbed'] === false) {
      const embedding = entry.carriers.filter((c: string) => (WEB_EMBEDDING_CARRIERS as readonly string[]).includes(c));
      if (embedding.length) issues.push(`${at} 的载体 ${embedding.join('、')} 要把字体嵌入网页，但 permissions.webEmbed 为 false`);
    }
    if (typeof entry.pptSafe !== 'boolean') issues.push(`${at} 缺少 pptSafe（是否属于 PPT 安全字体，true 或 false）`);
    const sourceInfo = entry.source;
    if (!isObject(sourceInfo)) issues.push(`${at} 缺少 source（url、sha256）`);
    else {
      if (!isUrl(sourceInfo.url, ['https:', 'http:', 'file:'])) issues.push(`${at} 的 source.url 需为官方下载地址`);
      if (!isString(sourceInfo.sha256) || !/^[0-9a-f]{64}$/.test(sourceInfo.sha256)) {
        issues.push(`${at} 的 source.sha256 需为 64 位小写十六进制`);
      }
    }
  });
  return issues;
}

export async function loadFontManifest(libraryDir: string): Promise<FontManifest> {
  const dir = join(libraryDir, 'fonts');
  const path = join(dir, 'manifest.json');
  let data: { fonts?: unknown };
  try {
    data = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new BuildError([`无法读取字体清单：${path}（${(error as Error).message}）`]);
  }
  const issues = checkFontEntries(data.fonts, `字体清单 ${path}`);
  if (issues.length) throw new BuildError(issues);
  return { dir, fonts: data.fonts as FontEntry[] };
}

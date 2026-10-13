/*
 * Font data for the font rules (what the checker knows about fonts besides what the browser reports): FontCheckData = the font list entries plus, for each font
 * file actually shipped by the page, the set of Unicode code points its cmap covers (read from outDir/fonts with harfbuzzjs; woff and woff2 are converted to sfnt first,
 * because harfbuzzjs returns an empty cmap for woff2 without any error). Chromium alone cannot tell that a glyph is missing when no font at all has it, hence this cmap check.
 * loadFontCheckData(entries, used, fontDir) is called once per build by build-and-check.ts and passed to whichever renderer runs the rules (CheckContext.fonts).
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import fontverter from 'fontverter';
import { Blob, Face } from 'harfbuzzjs';
import type { FontEntry } from '../fonts.ts';
import { BuildError } from '../types.ts';

export interface FontCheckData {
  entries: FontEntry[];
  coverage: Map<string, ReadonlySet<number>>;
}

export async function coverageOf(file: string): Promise<Set<number>> {
  const data = await readFile(file);
  const sfnt = await fontverter.convert(data, 'sfnt');
  const face = new Face(new Blob(sfnt));
  return new Set(face.collectUnicodes());
}

export async function loadFontCheckData(entries: FontEntry[], used: FontEntry[], fontDir: string): Promise<FontCheckData> {
  const coverage = new Map<string, ReadonlySet<number>>();
  for (const font of used) {
    try {
      coverage.set(font.postScriptName, await coverageOf(join(fontDir, font.file)));
    } catch (error) {
      throw new BuildError([`字体加载失败：无法读取字体「${font.id}」的字符覆盖范围：${join(fontDir, font.file)}（${(error as Error).message}）`]);
    }
  }
  return { entries, coverage };
}

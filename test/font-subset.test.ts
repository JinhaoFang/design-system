/* Font subset behavior through buildAndCheck: inspect delivered font size, cmap, names and checker reports, including generated content and both web widths. */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import fontverter from 'fontverter';
import { Blob, Face } from 'harfbuzzjs';
import { describe, expect, test } from 'vitest';
import { box, customWork } from './custom-work.ts';
import { fixtures, patchedWork, run } from './helpers.ts';
import { editJson, patchedLibrary } from './system-helpers.ts';
import type { BuildResult } from '../src/build-and-check.ts';

const FONT_FILE = 'NotoSansSC-Regular.subset.woff2';
const fontFindings = (result: BuildResult) => result.report.findings.filter((finding) => finding.category === 'fonts');
const artifactFont = async (result: BuildResult) => {
  const data = await readFile(join(result.artifacts.outDir, 'fonts', FONT_FILE));
  return { data, face: new Face(new Blob(await fontverter.convert(data, 'sfnt'))) };
};

describe('delivered CJK subsets', () => {
  test('a clean work ships a small subset with every used character and unchanged font identity', async () => {
    const original = await readFile(join(fixtures.fontCache, FONT_FILE));
    const result = await run(fixtures.work('clean'));
    const { data, face } = await artifactFont(result);
    expect(result.exitCode).toBe(0);
    expect(fontFindings(result)).toEqual([]);
    expect(data.length).toBeLessThan(30_000);
    expect(data.length).toBeLessThan(original.length / 4);
    const cmap = new Set(face.collectUnicodes());
    for (const character of '发布二点零更快的搜索，更稳的同步') expect(cmap.has(character.codePointAt(0)!)).toBe(true);
    expect(cmap.has('甲'.codePointAt(0)!)).toBe(false);
    expect(face.getName(6, 'en')).toBe('NotoSansSC-Regular');
    expect(face.getName(13, 'en')).toContain('Open Font License');
    expect(await readFile(join(result.artifacts.outDir, 'fonts', 'noto-sans-sc-fixture.OFL.txt'), 'utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1');
    expect(await readFile(join(fixtures.fontCache, FONT_FILE))).toEqual(original);
  });

  test('a glyph absent from the original remains missing after subsetting', async () => {
    const result = await run(fixtures.work('font-missing-glyph'));
    const { data, face } = await artifactFont(result);
    expect(data.length).toBeLessThan(30_000);
    expect(face.collectUnicodes()).not.toContain('龘'.codePointAt(0));
    expect(result.exitCode).toBe(1);
    expect(fontFindings(result)).toEqual([expect.objectContaining({ ruleId: 'fonts/missing-glyph', severity: 'error', message: expect.stringContaining('龘') })]);
  });

  test('web subsets cover decoded custom text and generated content at desktop and mobile widths', async () => {
    const work = await patchedWork('web-clean', (work) => {
      work.sequence = [{ custom: box('', '&#x53D1;', '<style>.box{counter-reset:count 2}.box::before{content:counter(count,simp-chinese-informal)}.box::after{content:"甲"}@media(max-width:600px){.box::after{content:attr(data-mobile)}}</style><p class="box" data-mobile="乙"></p>'), serves: '覆盖自动生成的用字' }];
    });
    const result = await run(work);
    const { face } = await artifactFont(result);
    const cmap = new Set(face.collectUnicodes());
    for (const character of '发二甲乙') expect(cmap.has(character.codePointAt(0)!)).toBe(true);
    expect(fontFindings(result)).toEqual([]);
  });

  test('a single deck subset covers all pages, including later slides', async () => {
    const work = await patchedWork('slides-clean', (work) => {
      work.sequence = [
        { custom: box('', '甲'), serves: '第一页用字' },
        { custom: box('', '乙'), serves: '后续页用字' },
      ];
    });
    const result = await run(work);
    const { data, face } = await artifactFont(result);
    expect(data.length).toBeLessThan(30_000);
    expect([...face.collectUnicodes()]).toEqual(expect.arrayContaining(['甲'.codePointAt(0), '乙'.codePointAt(0)]));
    expect(fontFindings(result)).toEqual([]);
    expect(result.artifacts.images).toHaveLength(2);
  });

  test('unknown licenses and declared Reserved Font Names retain the original bytes', async () => {
    for (const reserved of [false, true]) {
      const libraryDir = await patchedLibrary(async (dir) => {
        if (reserved) {
          const path = join(dir, 'fonts', 'OFL.txt');
          await writeFile(path, `Copyright Example with Reserved Font Name Fixture\n${await readFile(path, 'utf8')}`);
          await editJson(join(dir, 'fonts', 'manifest.json'), (manifest) => {
            manifest.fonts[0].license.url = 'https://raw.githubusercontent.com/notofonts/noto-cjk/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/LICENSE';
          });
        } else {
          await editJson(join(dir, 'fonts', 'manifest.json'), (manifest) => { manifest.fonts[0].license.name = 'Unknown'; });
        }
      });
      const result = await run(fixtures.work('clean'), { libraryDir });
      expect((await artifactFont(result)).data).toEqual(await readFile(join(fixtures.fontCache, FONT_FILE)));
      expect(fontFindings(result)).toEqual([]);
    }
  });

  test('subsetting keeps italic-face identity and the existing style mismatch check', async () => {
    const work = await customWork(box('font-style:italic;'));
    const plain = await run(work);
    expect((await artifactFont(plain)).data.length).toBeLessThan(30_000);
    expect(fontFindings(plain)).toEqual([expect.objectContaining({ ruleId: 'fonts/style-mismatch' })]);
    const libraryDir = await patchedLibrary((dir) => editJson(join(dir, 'fonts', 'manifest.json'), (manifest) => { manifest.fonts[0].style = 'italic'; }));
    const italic = await run(work, { libraryDir });
    expect((await artifactFont(italic)).face.getName(6, 'en')).toBe('NotoSansSC-Regular');
    expect(fontFindings(italic)).toEqual([]);
  });
});

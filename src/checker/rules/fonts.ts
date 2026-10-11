/*
 * Font rules, all errors, using the platform fonts Chromium reported per text block (ElementSnapshot.fonts) matched to the font list on postScriptName, and cmap coverage of the used list fonts (CheckContext.fonts):
 *   fonts/not-in-manifest   a font that is not in the font list drew glyphs of the block (a system font, or any font the list does not know);
 *   fonts/missing-glyph     a character of the block is not in the cmap of the list fonts used there: it fell back to another font, or no font has it and a box is drawn
 *                           (when a block has missing characters, the fallback font is explained by this finding and not reported again as not-in-manifest);
 *   fonts/license-carrier   a list font used by the page is not licensed for the work's carrier (entry.carriers); reported once per font and snapshot, at its first block.
 * A nested text block repeats its descendants' fonts in the parent (Chromium counts descendant text), so a hit is dropped when a descendant block has the same hit.
 */
import type { FontEntry } from '../../fonts.ts';
import type { CheckContext, Hit, Rule } from '../registry.ts';
import type { ElementSnapshot } from '../snapshot.ts';
import type { PlatformFont } from '../font-usage.ts';

interface Block {
  element: ElementSnapshot;
  text: string;
  listed: FontEntry[];
  foreign: PlatformFont[];
  missing: string[];
}

const IGNORED = /[\p{White_Space}\p{Cc}\p{Cf}]/u;
const codePoint = (char: string): string => `U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`;

function analyze({ snapshot, fonts }: CheckContext): Block[] {
  const blocks: Block[] = [];
  for (const element of snapshot.elements) {
    if (!element.fonts || !element.textChunks) continue;
    const listed: FontEntry[] = [];
    const foreign: PlatformFont[] = [];
    for (const font of element.fonts) {
      const entry = fonts.entries.find((candidate) => candidate.postScriptName === font.postScriptName);
      if (entry) listed.push(entry);
      else foreign.push(font);
    }
    const text = element.textChunks.map((chunk) => chunk.text).join('');
    const covers = listed.map((entry) => fonts.coverage.get(entry.postScriptName));
    const missing: string[] = [];
    if (listed.length && covers.every((cover) => cover !== undefined)) {
      for (const char of new Set(text)) {
        if (!IGNORED.test(char) && !covers.some((cover) => cover!.has(char.codePointAt(0)!))) missing.push(char);
      }
    }
    blocks.push({ element, text, listed, foreign, missing });
  }
  return blocks;
}

function locate(element: ElementSnapshot) {
  const slot = element.slot ?? element.textChunks?.find((chunk) => chunk.slot !== undefined)?.slot;
  return {
    ...(element.unit !== undefined && { unit: element.unit }),
    ...(element.layout !== undefined && { layout: element.layout }),
    ...(slot !== undefined && { slot }),
    selector: element.selector,
  };
}

function withoutRepeatedAncestors(hits: { block: Block; key: string; hit: Hit }[]): Hit[] {
  return hits
    .filter(({ block, key }) =>
      !hits.some((other) => other.key === key && other.block.element.selector.startsWith(`${block.element.selector} > `)),
    )
    .map(({ hit }) => hit);
}

const describeFont = (font: PlatformFont): string => `「${font.familyName}」（PostScript 名 ${font.postScriptName || '未知'}）`;

export const notInManifest: Rule = {
  id: 'fonts/not-in-manifest',
  category: 'fonts',
  severity: 'error',
  description: '实际用来显示字形的字体不在字体清单里',
  check(context) {
    const found: { block: Block; key: string; hit: Hit }[] = [];
    for (const block of analyze(context)) {
      if (!block.foreign.length || (block.listed.length && block.missing.length)) continue;
      const names = block.foreign.map(describeFont).join('、');
      found.push({
        block,
        key: block.foreign.map((font) => font.postScriptName || font.familyName).sort().join('|'),
        hit: { location: locate(block.element), message: `实际用来显示字形的字体不在字体清单里：${names}` },
      });
    }
    return withoutRepeatedAncestors(found);
  },
};

export const missingGlyph: Rule = {
  id: 'fonts/missing-glyph',
  category: 'fonts',
  severity: 'error',
  description: '文字里有字体清单中的字体没有的字：回退到别的字体，或没有任何字体有这个字而显示成方框',
  check(context) {
    const found: { block: Block; key: string; hit: Hit }[] = [];
    for (const block of analyze(context)) {
      if (!block.missing.length) continue;
      const chars = block.missing.map((char) => `「${char}」（${codePoint(char)}）`).join('、');
      const owners = block.listed.map((entry) => `「${entry.family}」`).join('、');
      const outcome = block.foreign.length
        ? `回退到了清单外的字体 ${block.foreign.map(describeFont).join('、')}`
        : '没有任何字体有这个字，会显示成方框';
      found.push({
        block,
        key: [...block.missing].sort().join(''),
        hit: { location: locate(block.element), message: `缺字：${chars} 不在字体 ${owners} 里，${outcome}` },
      });
    }
    return withoutRepeatedAncestors(found);
  },
};

export const licenseCarrier: Rule = {
  id: 'fonts/license-carrier',
  category: 'fonts',
  severity: 'error',
  description: '字体清单里的字体的授权不允许用在当前载体上',
  check(context) {
    const hits: Hit[] = [];
    const reported = new Set<string>();
    for (const block of analyze(context)) {
      for (const entry of block.listed) {
        if (entry.carriers.includes(context.work.carrier) || reported.has(entry.id)) continue;
        reported.add(entry.id);
        hits.push({
          location: locate(block.element),
          message: `字体「${entry.id}」（${entry.family}）的授权不允许用在载体 ${context.work.carrier} 上，清单记录它可用于：${entry.carriers.join('、') || '（无）'}`,
        });
      }
    }
    return hits;
  },
};

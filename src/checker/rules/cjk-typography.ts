/*
 * Chinese typesetting rules (category cjk-typography), reading the text blocks recorded in the snapshot.
 * line-start-forbidden (error; warning for dashes and ellipses, strict-level clreq) and line-end-forbidden (error): judged on the first/last visible character of every rendered line.
 * Kinsoku lists follow clreq 6.1.1 basic level plus ASCII closers/openers for mixed text. orphan-line (warning): last of 2+ lines holds one Han character, trailing punctuation ignored.
 * missing-spacing (error): a Han character directly touches an ASCII letter or digit inside one block, including across inline element boundaries.
 * Detection uses findCjkLatinGaps from src/cjk-spacing.ts, the same definition the build step spaces with.
 */
import { findCjkLatinGaps } from '../../cjk-spacing.ts';
import type { Location } from '../../types.ts';
import type { Hit, Rule } from '../registry.ts';
import type { ElementSnapshot, LineSnapshot } from '../snapshot.ts';

function locate(element: ElementSnapshot, slot?: string): Location {
  const resolved = slot ?? element.slot;
  return {
    ...(element.unit !== undefined && { unit: element.unit }),
    ...(element.layout !== undefined && { layout: element.layout }),
    ...(resolved !== undefined && { slot: resolved }),
    selector: element.selector,
  };
}

const NO_START_ERROR = new Set(
  [
    ...'、，。：；！？．”’」』）】〗〕］｝》〉–～~·/／',
    ...')]},.;:!?',
  ],
);
const NO_START_WARNING = new Set([...'—…⸺']);
const NO_END = new Set([...'“‘「『（【〖〔［｛《〈', ...'([{']);

function lineEdgeHits(
  element: ElementSnapshot,
  line: LineSnapshot,
  edge: 'start' | 'end',
  hits: Hit[],
): void {
  const chars = [...line.text];
  const ch = edge === 'start' ? chars[0]! : chars[chars.length - 1]!;
  const slot = edge === 'start' ? line.startSlot : line.endSlot;
  const location = locate(element, slot);
  if (edge === 'start') {
    if (NO_START_ERROR.has(ch)) hits.push({ location, message: `行首出现了禁止行首的“${ch}”（该行：${line.text}）` });
    else if (NO_START_WARNING.has(ch)) {
      hits.push({ location, severity: 'warning', message: `行首出现了严格避头尾下禁止行首的“${ch}”（该行：${line.text}）` });
    }
  } else if (NO_END.has(ch)) {
    hits.push({ location, message: `行尾出现了禁止行尾的“${ch}”（该行：${line.text}）` });
  }
}

export const lineStartForbidden: Rule = {
  id: 'cjk-typography/line-start-forbidden',
  category: 'cjk-typography',
  severity: 'error',
  description: '行首出现禁止行首的标点（避头）；破折号、省略号等严格级别的只给警告',
  check({ snapshot }) {
    const hits: Hit[] = [];
    for (const element of snapshot.elements) {
      for (const line of element.lines ?? []) lineEdgeHits(element, line, 'start', hits);
    }
    return hits;
  },
};

export const lineEndForbidden: Rule = {
  id: 'cjk-typography/line-end-forbidden',
  category: 'cjk-typography',
  severity: 'error',
  description: '行尾出现禁止行尾的标点（避尾）',
  check({ snapshot }) {
    const hits: Hit[] = [];
    for (const element of snapshot.elements) {
      for (const line of element.lines ?? []) lineEdgeHits(element, line, 'end', hits);
    }
    return hits;
  },
};

export const orphanLine: Rule = {
  id: 'cjk-typography/orphan-line',
  category: 'cjk-typography',
  severity: 'warning',
  description: '段落最后一行只剩一个汉字（孤字），末尾标点不计',
  check({ snapshot }) {
    const hits: Hit[] = [];
    for (const element of snapshot.elements) {
      const lines = element.lines ?? [];
      if (lines.length < 2) continue;
      const last = lines[lines.length - 1]!;
      const letters = [...last.text.replace(/[\p{P}\p{S}\s]/gu, '')];
      if (letters.length === 1 && /\p{Script=Han}/u.test(letters[0]!)) {
        hits.push({ location: locate(element, last.startSlot), message: `段落最后一行只剩一个汉字“${letters[0]}”（该行：${last.text}）` });
      }
    }
    return hits;
  },
};

export const missingSpacing: Rule = {
  id: 'cjk-typography/missing-spacing',
  category: 'cjk-typography',
  severity: 'error',
  description: '中文与西文或数字直接相邻、中间没有间距',
  check({ snapshot }) {
    const hits: Hit[] = [];
    for (const element of snapshot.elements) {
      if (!element.textChunks) continue;
      const text = element.textChunks.map((chunk) => chunk.text).join('');
      for (const offset of findCjkLatinGaps(text)) {
        let start = 0;
        const chunk = element.textChunks.find((candidate) => {
          const found = offset <= start + candidate.text.length;
          if (!found) start += candidate.text.length;
          return found;
        })!;
        const before = [...text.slice(0, offset)].at(-1);
        const after = [...text.slice(offset)][0];
        hits.push({
          location: locate(element, chunk.slot),
          message: `中文与西文或数字之间缺少间距：“${before}${after}”`,
        });
      }
    }
    return hits;
  },
};

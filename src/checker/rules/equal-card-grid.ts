/*
 * Anti-homogeneity rule anti-homogeneity/equal-card-grid (warning): at least 3 sibling elements that look like cards sit in one row, all the same size and with the same inner structure.
 * Reads snapshot geometry only (box, parent, tag). A card candidate is at least MIN_WIDTH x MIN_HEIGHT px and has 2 or more child elements, so plain text columns, link rows, vertical lists
 * and single-line items do not qualify. Siblings are one row when their tops are within ROW_TOLERANCE px; they are equal in size when width and height differ by at most SIZE_TOLERANCE (and 2 px);
 * their structure is the same when the tags of their direct children match in order. One finding per parent element, placed on the parent, reporting the largest equal row in it.
 */
import type { Hit, Rule } from '../registry.ts';
import type { ElementSnapshot, PageSnapshot } from '../snapshot.ts';

const MIN_CARDS = 3;
const MIN_WIDTH = 120;
const MIN_HEIGHT = 80;
const MIN_CHILDREN = 2;
const ROW_TOLERANCE = 4;
const SIZE_TOLERANCE = 0.03;

interface Candidate {
  element: ElementSnapshot;
  signature: string;
}

const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(2, SIZE_TOLERANCE * Math.max(a, b));

function childrenOf(snapshot: PageSnapshot): Map<number, number[]> {
  const children = new Map<number, number[]>();
  snapshot.elements.forEach((element, index) => {
    if (element.parent === undefined) return;
    (children.get(element.parent) ?? children.set(element.parent, []).get(element.parent)!).push(index);
  });
  return children;
}

function largestEqualRow(candidates: Candidate[]): Candidate[] {
  let best: Candidate[] = [];
  const left = [...candidates];
  while (left.length) {
    const seed = left.shift()!;
    const row = [seed, ...left.filter((other) => Math.abs(other.element.box.y - seed.element.box.y) <= ROW_TOLERANCE)];
    const same = row.filter(
      (other) =>
        other.signature === seed.signature &&
        close(other.element.box.width, seed.element.box.width) &&
        close(other.element.box.height, seed.element.box.height),
    );
    if (same.length > best.length) best = same;
    for (const member of same.slice(1)) left.splice(left.indexOf(member), 1);
  }
  return best;
}

export const equalCardGrid: Rule = {
  id: 'anti-homogeneity/equal-card-grid',
  category: 'anti-homogeneity',
  severity: 'warning',
  description: '至少 3 个兄弟元素尺寸相同、结构相似并排成一行，像等大卡片网格',
  check({ snapshot }) {
    const hits: Hit[] = [];
    const children = childrenOf(snapshot);
    for (const [parentIndex, siblings] of children) {
      const candidates: Candidate[] = [];
      for (const index of siblings) {
        const element = snapshot.elements[index]!;
        const inner = (children.get(index) ?? []).map((child) => snapshot.elements[child]!);
        if (element.box.width < MIN_WIDTH || element.box.height < MIN_HEIGHT || inner.length < MIN_CHILDREN) continue;
        candidates.push({ element, signature: `${element.tag}>${inner.map((child) => child.tag).join(',')}` });
      }
      const row = largestEqualRow(candidates);
      if (row.length < MIN_CARDS) continue;
      const parent = snapshot.elements[parentIndex]!;
      const { width, height } = row[0]!.element.box;
      hits.push({
        location: {
          ...(parent.unit !== undefined && { unit: parent.unit }),
          ...(parent.layout !== undefined && { layout: parent.layout }),
          ...(parent.slot !== undefined && { slot: parent.slot }),
          selector: parent.selector,
        },
        message: `${row.length} 个并排的兄弟元素尺寸相同（约 ${Math.round(width)}×${Math.round(height)}）、结构相似，像等大卡片网格；让其中一个更突出，或换一种排法`,
      });
    }
    return hits;
  },
};

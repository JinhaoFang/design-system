/*
 * Anti-homogeneity rule anti-homogeneity/adjacent-same-layout (warning): two neighbouring narrative units of the work use the same layout (same unit and same layout name).
 * Reads the work sequence only. A custom fragment between two units breaks the adjacency; two custom fragments in a row are not compared.
 * The finding is placed on the later item. On slides (context.slide set, one snapshot per slide) only the later slide reports it, so the finding is not repeated per slide;
 * on web it carries "第 N 项" (the 1-based position in the sequence). Social works hold one unit and never trigger it.
 */
import type { Hit, Rule } from '../registry.ts';

export const adjacentSameLayout: Rule = {
  id: 'anti-homogeneity/adjacent-same-layout',
  category: 'anti-homogeneity',
  severity: 'warning',
  description: '相邻两个叙事单元使用了同一种排法',
  check({ work, slide }) {
    const hits: Hit[] = [];
    work.sequence.forEach((item, index) => {
      const previous = work.sequence[index - 1];
      if (item.kind !== 'unit' || previous?.kind !== 'unit') return;
      if (previous.unit !== item.unit || previous.layout !== item.layout) return;
      if (slide !== undefined && slide !== index + 1) return;
      hits.push({
        location: { unit: item.unit, layout: item.layout },
        message: `第 ${index + 1} 项与上一项都是单元「${item.unit}」的排法「${item.layout}」，相邻单元应换一种排法`,
      });
    });
    return hits;
  },
};

/*
 * CJK-Latin/digit spacing (中西文间距), one definition shared by the build step and the checker so they cannot disagree.
 * spaceCjkLatin inserts U+0020 where a Han character directly touches an ASCII letter or digit (either order); punctuation and symbols such as % are left alone,
 * in line with clreq 6.3.3 (no space next to Chinese punctuation). findCjkLatinGaps returns the offsets of the boundaries that still lack the space.
 */
const GAP = /(\p{Script=Han})(?=[A-Za-z0-9])|([A-Za-z0-9])(?=\p{Script=Han})/gu;

export function spaceCjkLatin(text: string): string {
  return text.replace(GAP, (match) => `${match} `);
}

export function findCjkLatinGaps(text: string): number[] {
  return [...text.matchAll(GAP)].map((match) => match.index + match[0].length);
}

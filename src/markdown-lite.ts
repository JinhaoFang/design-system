/*
 * Tiny Markdown renderer for the prose of SYSTEM.md sections (system page): paragraphs, "-" / "*" bullet lists, numbered lists, fenced code, **bold**, *italic*, `code` and [text](url) links.
 * renderMarkdown(lines) -> HTML string; every text run is HTML-escaped and gets CJK-Latin spacing (cjk-spacing.ts), so the page passes the same spacing check as works.
 * Anything else (tables, nested lists, headings inside the lines) is shown as paragraph text; headings are handled by the caller, which walks the section tree.
 */
import { spaceCjkLatin } from './cjk-spacing.ts';
import { escapeHtml } from './layout.ts';

export function inline(text: string): string {
  const spaced = escapeHtml(spaceCjkLatin(text));
  return spaced
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

export function renderMarkdown(lines: string[]): string {
  const out: string[] = [];
  let paragraph: string[] = [];
  let list: { tag: 'ul' | 'ol'; items: string[] } | undefined;
  let code: string[] | undefined;

  const flushParagraph = () => {
    if (paragraph.length) out.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((item) => `<li>${inline(item)}</li>`).join('')}</${list.tag}>`);
    list = undefined;
  };

  for (const line of lines) {
    if (/^\s*(```+|~~~+)/.test(line)) {
      if (code) {
        out.push(`<pre>${escapeHtml(code.join('\n'))}</pre>`);
        code = undefined;
      } else {
        flushParagraph();
        flushList();
        code = [];
      }
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }
    const bullet = /^\s*[-*+]\s+(.*\S)\s*$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*\S)\s*$/.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const tag = bullet ? 'ul' : 'ol';
      if (list && list.tag !== tag) flushList();
      list ??= { tag, items: [] };
      list.items.push((bullet ?? numbered)![1]!);
      continue;
    }
    if (line.trim() === '') {
      flushParagraph();
      flushList();
      continue;
    }
    if (list && /^\s+\S/.test(line)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  if (code) out.push(`<pre>${escapeHtml(code.join('\n'))}</pre>`);
  flushParagraph();
  flushList();
  return out.join('\n');
}

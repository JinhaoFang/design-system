/*
 * Tiny Markdown renderer for the prose of SYSTEM.md sections (system page): paragraphs, "-" / "*" bullet lists, numbered lists with one level of indented bullets nested under an item, GFM tables, fenced code,
 * **bold**, *emphasis* (<em>), `code` and [text](url) links.
 * renderMarkdown(lines) -> HTML string; every text run is HTML-escaped and gets CJK-Latin spacing (cjk-spacing.ts), so the page passes the same spacing check as works.
 * Tables render as <table> (header row in <thead>, a body row per line, cells through inline()); findTables(lines) lists the tables of a line array with their line ranges [start, end) and raw cell text,
 * so a caller can take a table out of the prose and use its rows as data.
 * Anything else (deeper nesting, headings inside the lines) is shown as paragraph text; headings are handled by the caller, which walks the section tree.
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

export interface MdTable {
  start: number;
  end: number;
  header: string[];
  rows: string[][];
}

const SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

function cellsOf(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split(/(?<!\\)\|/).map((cell) => cell.replace(/\\\|/g, '|').trim());
}

export function findTables(lines: string[]): MdTable[] {
  const tables: MdTable[] = [];
  let fenced = false;
  for (let index = 0; index < lines.length; index++) {
    if (/^\s*(```+|~~~+)/.test(lines[index]!)) fenced = !fenced;
    if (fenced || !lines[index]!.includes('|') || index + 1 >= lines.length || !SEPARATOR.test(lines[index + 1]!) || !lines[index + 1]!.includes('-')) continue;
    let end = index + 2;
    while (end < lines.length && lines[end]!.includes('|') && lines[end]!.trim() !== '') end++;
    tables.push({ start: index, end, header: cellsOf(lines[index]!), rows: lines.slice(index + 2, end).map(cellsOf) });
    index = end - 1;
  }
  return tables;
}

export function renderTable(table: Pick<MdTable, 'header' | 'rows'>): string {
  const head = `<thead><tr>${table.header.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead>`;
  const body = table.rows.map((row) => `<tr>${table.header.map((_cell, column) => `<td>${inline(row[column] ?? '')}</td>`).join('')}</tr>`).join('');
  return `<table>${head}<tbody>${body}</tbody></table>`;
}

interface Item {
  text: string;
  children: string[];
}

export function renderMarkdown(lines: string[]): string {
  const out: string[] = [];
  let paragraph: string[] = [];
  let list: { tag: 'ul' | 'ol'; items: Item[] } | undefined;
  let code: string[] | undefined;
  const tables = new Map(findTables(lines).map((table) => [table.start, table]));
  let skipUntil = 0;

  const flushParagraph = () => {
    if (paragraph.length) out.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list) {
      const render = (item: Item) =>
        `<li>${item.children.length ? `<div>${inline(item.text)}</div>` : inline(item.text)}${item.children.length ? `<ul>${item.children.map((child) => `<li>${inline(child)}</li>`).join('')}</ul>` : ''}</li>`;
      out.push(`<${list.tag}>${list.items.map(render).join('')}</${list.tag}>`);
    }
    list = undefined;
  };

  for (const [index, line] of lines.entries()) {
    if (index < skipUntil) continue;
    const table = tables.get(index);
    if (table && !code) {
      flushParagraph();
      flushList();
      out.push(renderTable(table));
      skipUntil = table.end;
      continue;
    }
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
    const bullet = /^(\s*)[-*+]\s+(.*\S)\s*$/.exec(line);
    const numbered = /^(\s*)\d+[.)]\s+(.*\S)\s*$/.exec(line);
    if (bullet && list && list.items.length && bullet[1]!.length >= 2) {
      list.items[list.items.length - 1]!.children.push(bullet[2]!);
      continue;
    }
    if (bullet || numbered) {
      flushParagraph();
      const tag = bullet ? 'ul' : 'ol';
      if (list && list.tag !== tag) flushList();
      list ??= { tag, items: [] };
      list.items.push({ text: (bullet ?? numbered)![2]!, children: [] });
      continue;
    }
    if (line.trim() === '') {
      flushParagraph();
      flushList();
      continue;
    }
    if (list && /^\s+\S/.test(line)) {
      const last = list.items[list.items.length - 1]!;
      if (last.children.length) last.children[last.children.length - 1] += ` ${line.trim()}`;
      else last.text += ` ${line.trim()}`;
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

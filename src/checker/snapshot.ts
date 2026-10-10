/*
 * Page snapshot: one in-page pass that records, for every element in <body>, its location (unit/layout/slot from the data-ds-* marks, plus a selector),
 * whether it directly holds text, and the computed values of SNAPSHOT_STYLE_PROPERTIES. Rules read this plain data in Node; they never touch the page.
 * Text blocks (non-inline elements owning text) also get textChunks (their text nodes in order, each with its slot) and lines (the rendered visual lines,
 * found by measuring every character with Range.getClientRects; a character whose left edge falls behind the previous one starts a new line).
 * To give a new rule more input, add properties here (and fields to ElementSnapshot) instead of querying the browser from the rule.
 */
import type { Page } from 'playwright';

export const SNAPSHOT_STYLE_PROPERTIES = [
  'color',
  'background-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-style',
  'border-right-style',
  'border-bottom-style',
  'border-left-style',
  'box-shadow',
  'text-shadow',
] as const;

export interface TextChunk {
  text: string;
  slot?: string;
}

export interface LineSnapshot {
  text: string;
  startSlot?: string;
  endSlot?: string;
}

export interface ElementSnapshot {
  selector: string;
  tag: string;
  unit?: string;
  layout?: string;
  slot?: string;
  hasOwnText: boolean;
  textChunks?: TextChunk[];
  lines?: LineSnapshot[];
  styles: Record<string, string>;
}

export interface PageSnapshot {
  elements: ElementSnapshot[];
}

export async function collectSnapshot(page: Page): Promise<PageSnapshot> {
  const elements = await page.evaluate((properties) => {
    const skipped = new Set(['STYLE', 'SCRIPT', 'LINK', 'META', 'TITLE']);
    const describe = (el: Element): string => {
      const parts: string[] = [];
      let node: Element | null = el;
      while (node && node !== document.body) {
        const slot = node.getAttribute('data-ds-slot');
        const unit = node.getAttribute('data-ds-unit');
        if (unit) {
          parts.unshift(`${node.tagName.toLowerCase()}[data-ds-unit="${unit}"]`);
          break;
        }
        if (slot) parts.unshift(`${node.tagName.toLowerCase()}[data-ds-slot="${slot}"]`);
        else {
          const siblings = node.parentElement
            ? [...node.parentElement.children].filter((child) => child.tagName === node!.tagName)
            : [];
          const index = siblings.indexOf(node) + 1;
          parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${index})`);
        }
        node = node.parentElement;
      }
      return parts.join(' > ');
    };
    const isInline = (el: Element): boolean => ['inline', 'contents'].includes(getComputedStyle(el).display);
    const blockOf = (node: Node): Element | null => {
      let el = node.parentElement;
      while (el && isInline(el)) el = el.parentElement;
      return el;
    };
    const slotOf = (node: Node): string | undefined =>
      node.parentElement?.closest('[data-ds-slot]')?.getAttribute('data-ds-slot') ?? undefined;
    const ownedTextNodes = (block: Element): Text[] => {
      const nodes: Text[] = [];
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
        if (blockOf(node) === block) nodes.push(node);
      }
      return nodes.some((node) => node.data.trim() !== '') ? nodes : [];
    };
    const collectChunks = (nodes: Text[]): TextChunk[] =>
      nodes.map((node) => {
        const slot = slotOf(node);
        return slot === undefined ? { text: node.data } : { text: node.data, slot };
      });
    const collectLines = (nodes: Text[]): LineSnapshot[] => {
      const chars: { ch: string; node: Text; left: number; width: number }[][] = [];
      let previous: { left: number; width: number } | undefined;
      for (const node of nodes) {
        let offset = 0;
        for (const ch of node.data) {
          const range = document.createRange();
          range.setStart(node, offset);
          range.setEnd(node, offset + ch.length);
          offset += ch.length;
          const rect = [...range.getClientRects()].find((candidate) => candidate.width > 0);
          if (!rect || ch.trim() === '') continue;
          if (!previous || rect.left < previous.left + previous.width - 1) chars.push([]);
          chars[chars.length - 1]!.push({ ch, node, left: rect.left, width: rect.width });
          previous = rect;
        }
      }
      return chars.map((line) => {
        const first = line[0]!;
        const last = line[line.length - 1]!;
        const start = slotOf(first.node);
        const end = slotOf(last.node);
        return {
          text: line.map((c) => c.ch).join(''),
          ...(start !== undefined && { startSlot: start }),
          ...(end !== undefined && { endSlot: end }),
        };
      });
    };
    const result: ElementSnapshot[] = [];
    for (const el of document.body.querySelectorAll('*')) {
      if (skipped.has(el.tagName)) continue;
      const computed = getComputedStyle(el);
      const styles: Record<string, string> = {};
      for (const property of properties) styles[property] = computed.getPropertyValue(property);
      const unit = el.closest('[data-ds-unit]');
      const slot = el.closest('[data-ds-slot]');
      const entry: ElementSnapshot = {
        selector: describe(el),
        tag: el.tagName.toLowerCase(),
        hasOwnText: [...el.childNodes].some((child) => child.nodeType === 3 && (child.textContent ?? '').trim() !== ''),
        styles,
      };
      if (computed.display !== 'none' && !isInline(el)) {
        const nodes = ownedTextNodes(el);
        if (nodes.length) {
          entry.textChunks = collectChunks(nodes);
          entry.lines = collectLines(nodes);
        }
      }
      if (unit) {
        entry.unit = unit.getAttribute("data-ds-unit") ?? "";
        entry.layout = unit.getAttribute("data-ds-layout") ?? "";
      }
      if (slot) entry.slot = slot.getAttribute("data-ds-slot") ?? "";
      result.push(entry);
    }
    return result;
  }, [...SNAPSHOT_STYLE_PROPERTIES]);
  return { elements };
}

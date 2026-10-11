/*
 * Page snapshot: one in-page pass that records, for every element in <body>, its location (unit/layout/slot from the data-ds-* marks, plus a selector),
 * whether it directly holds text, and the computed values of SNAPSHOT_STYLE_PROPERTIES. Rules read this plain data in Node; they never touch the page.
 * Text blocks (non-inline elements owning text) also get textChunks (their text nodes in order, each with its slot) and lines (the rendered visual lines,
 * found by measuring every character with Range.getClientRects; a character that falls behind the previous one along the block's inline axis starts a new line.
 * The inline axis follows the block's writing-mode and direction: left to right in horizontal text, top to bottom in vertical-rl / vertical-lr, reversed for rtl and sideways-lr, so in vertical text every column is one line and its first/last characters are the top/bottom ones).
 * Every element also has rect (viewport coordinates), parent (index of its parent element in elements, when that parent is in the snapshot) and isImage (img/svg/video/canvas/picture or a url() background);
 * text blocks also get textBox (tight bounds of their rendered characters) and textSizes ([font-size px, non-space character count] pairs). PageSnapshot.viewport is the page's inner size,
 * which is the canvas for social and slides and the first viewport for web (snapshots are taken at scroll 0).
 * Elements owning text also get backdrop: the background-color/has-background-image of the element and all its ancestors (nearest first, up to <html>, even beyond the scope), and mediaOverlap (the text line boxes intersect an img/video/canvas/background-image element that is not an ancestor).
 * Margins that compute to auto are recorded as the string "auto" (getComputedStyle would give the used px instead).
 * collectSnapshot(page, scope) limits the pass to the elements inside the first node matching the CSS selector scope (used per slide).
 * Every element also gets box (page-coordinate rectangle, px, scroll included) so rules can reason about siblings and geometry.
 * PageSnapshot.motion (animation records from the motion audit passes, motion-audit.ts) is attached by the carrier renderer, not by collectSnapshot.
 * Text blocks also get fonts: the platform fonts Chromium used to draw their glyphs (font-usage.ts, through the DevTools protocol).
 * To give a new rule more input, add properties here (and fields to ElementSnapshot) instead of querying the browser from the rule.
 */
import type { Page } from 'playwright';
import type { MotionSnapshot } from './motion-audit.ts';
import { PROBE_ATTRIBUTE, collectFontUsage } from './font-usage.ts';
import type { PlatformFont } from './font-usage.ts';

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
  'display',
  'font-size',
  'font-weight',
  'font-style',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'row-gap',
  'column-gap',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
  'background-image',
  'visibility',
] as const;

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface BackdropLayer {
  color: string;
  image: boolean;
}

export interface Backdrop {
  chain: BackdropLayer[];
  mediaOverlap: boolean;
}

export interface TextChunk {
  text: string;
  slot?: string;
}

export interface LineSnapshot {
  text: string;
  startSlot?: string;
  endSlot?: string;
}

export interface BoxSnapshot {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ElementSnapshot {
  selector: string;
  box: BoxSnapshot;
  tag: string;
  unit?: string;
  layout?: string;
  slot?: string;
  hasOwnText: boolean;
  textChunks?: TextChunk[];
  lines?: LineSnapshot[];
  fonts?: PlatformFont[];
  styles: Record<string, string>;
  rect: Rect;
  parent?: number;
  isImage: boolean;
  textBox?: Rect;
  textSizes?: [number, number][];
  backdrop?: Backdrop;
}

export interface PageSnapshot {
  elements: ElementSnapshot[];
  viewport: { width: number; height: number };
  motion?: MotionSnapshot;
}

export async function collectSnapshot(page: Page, scope?: string): Promise<PageSnapshot> {
  const { elements, viewport } = await page.evaluate(({ properties, scope: scopeSelector, probe }) => {
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
    const collectLines = (nodes: Text[], block: Element): LineSnapshot[] => {
      const style = getComputedStyle(block);
      const vertical = style.writingMode.startsWith('vertical') || style.writingMode.startsWith('sideways');
      const reversed = (style.direction === 'rtl') !== (style.writingMode === 'sideways-lr');
      const chars: { ch: string; node: Text }[][] = [];
      let previous: { start: number; size: number } | undefined;
      for (const node of nodes) {
        let offset = 0;
        for (const ch of node.data) {
          const range = document.createRange();
          range.setStart(node, offset);
          range.setEnd(node, offset + ch.length);
          offset += ch.length;
          const rect = [...range.getClientRects()].find((candidate) => candidate.width > 0);
          if (!rect || ch.trim() === '') continue;
          const current = vertical ? { start: rect.top, size: rect.height } : { start: rect.left, size: rect.width };
          const wrapped =
            !previous || (reversed ? current.start + current.size > previous.start + 1 : current.start < previous.start + previous.size - 1);
          if (wrapped) chars.push([]);
          chars[chars.length - 1]!.push({ ch, node });
          previous = current;
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
    const toRect = (r: DOMRect) => ({ left: r.left, top: r.top, width: r.width, height: r.height });
    const indexOf = new Map<Element, number>();
    const IMAGE_TAGS = new Set(['IMG', 'SVG', 'VIDEO', 'CANVAS', 'PICTURE']);
    const mediaElements = [...document.body.querySelectorAll('*')].filter(
      (node) =>
        ['IMG', 'VIDEO', 'CANVAS', 'PICTURE'].includes(node.tagName) || getComputedStyle(node).backgroundImage !== 'none',
    );
    const backdropOf = (el: Element): Backdrop => {
      const chain: BackdropLayer[] = [];
      for (let node: Element | null = el; node; node = node.parentElement) {
        const computed = getComputedStyle(node);
        chain.push({ color: computed.backgroundColor, image: computed.backgroundImage !== 'none' });
      }
      const rects: DOMRect[] = [];
      for (const child of el.childNodes) {
        if (child.nodeType !== 3 || (child.textContent ?? '').trim() === '') continue;
        const range = document.createRange();
        range.selectNodeContents(child);
        rects.push(...[...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0));
      }
      const mediaOverlap = mediaElements.some((media) => {
        if (media === el || media.contains(el)) return false;
        const box = media.getBoundingClientRect();
        return rects.some(
          (rect) =>
            Math.min(rect.right, box.right) - Math.max(rect.left, box.left) > 1 &&
            Math.min(rect.bottom, box.bottom) - Math.max(rect.top, box.top) > 1,
        );
      });
      return { chain, mediaOverlap };
    };
    const marginKeyword = (el: Element, property: string): boolean => {
      const value = el.computedStyleMap().get(property);
      return value instanceof CSSKeywordValue && value.value === 'auto';
    };
    const result: ElementSnapshot[] = [];
    for (const el of (scopeSelector ? document.querySelector(scopeSelector)! : document.body).querySelectorAll('*')) {
      if (skipped.has(el.tagName)) continue;
      const computed = getComputedStyle(el);
      const styles: Record<string, string> = {};
      for (const property of properties) {
        styles[property] = property.startsWith('margin-') && marginKeyword(el, property) ? 'auto' : computed.getPropertyValue(property);
      }
      const unit = el.closest('[data-ds-unit]');
      const slot = el.closest('[data-ds-slot]');
      const rect = el.getBoundingClientRect();
      const entry: ElementSnapshot = {
        selector: describe(el),
        box: { x: rect.left + window.scrollX, y: rect.top + window.scrollY, width: rect.width, height: rect.height },
        tag: el.tagName.toLowerCase(),
        hasOwnText: [...el.childNodes].some((child) => child.nodeType === 3 && (child.textContent ?? '').trim() !== ''),
        styles,
        rect: toRect(el.getBoundingClientRect()),
        isImage: IMAGE_TAGS.has(el.tagName.toUpperCase()) || styles['background-image']!.includes('url('),
      };
      const parentIndex = el.parentElement ? indexOf.get(el.parentElement) : undefined;
      if (parentIndex !== undefined) entry.parent = parentIndex;
      indexOf.set(el, result.length);
      if (entry.hasOwnText && computed.display !== 'none') entry.backdrop = backdropOf(el);
      if (computed.display !== 'none' && !isInline(el)) {
        const nodes = ownedTextNodes(el);
        if (nodes.length) {
          entry.textChunks = collectChunks(nodes);
          entry.lines = collectLines(nodes, el);
          el.setAttribute(probe, String(result.length));
        }
      }
      if (entry.textChunks) {
        const nodes = ownedTextNodes(el);
        const sizes = new Map<number, number>();
        let box: { left: number; top: number; right: number; bottom: number } | undefined;
        for (const node of nodes) {
          const chars = node.data.replace(/\s/g, '').length;
          if (chars === 0) continue;
          const size = parseFloat(getComputedStyle(node.parentElement!).fontSize);
          sizes.set(size, (sizes.get(size) ?? 0) + chars);
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const r of range.getClientRects()) {
            if (r.width === 0 || r.height === 0) continue;
            box = box
              ? { left: Math.min(box.left, r.left), top: Math.min(box.top, r.top), right: Math.max(box.right, r.right), bottom: Math.max(box.bottom, r.bottom) }
              : { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
          }
        }
        if (box) entry.textBox = { left: box.left, top: box.top, width: box.right - box.left, height: box.bottom - box.top };
        entry.textSizes = [...sizes.entries()];
      }
      if (unit) {
        entry.unit = unit.getAttribute("data-ds-unit") ?? "";
        entry.layout = unit.getAttribute("data-ds-layout") ?? "";
      }
      if (slot) entry.slot = slot.getAttribute("data-ds-slot") ?? "";
      result.push(entry);
    }
    return { elements: result, viewport: { width: window.innerWidth, height: window.innerHeight } };
  }, { properties: [...SNAPSHOT_STYLE_PROPERTIES], scope: scope ?? '', probe: PROBE_ATTRIBUTE });
  const usage = await collectFontUsage(page);
  for (const [index, fonts] of usage) elements[index]!.fonts = fonts;
  return { elements, viewport };
}

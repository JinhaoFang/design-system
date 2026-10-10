/*
 * Page snapshot: one in-page pass that records, for every element in <body>, its location (unit/layout/slot from the data-ds-* marks, plus a selector),
 * whether it directly holds text, and the computed values of SNAPSHOT_STYLE_PROPERTIES. Rules read this plain data in Node; they never touch the page.
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

export interface ElementSnapshot {
  selector: string;
  tag: string;
  unit?: string;
  layout?: string;
  slot?: string;
  hasOwnText: boolean;
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

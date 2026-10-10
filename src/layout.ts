/*
 * Layout (排法) rendering with LiquidJS: layouts/<carrier>/<unit>/<layout>.liquid is an HTML fragment with slots ({{ slots.name }}) and an optional <style>.
 * Autoescaped, strict variables; a layout may only reference slots declared by its unit. Each slot value is wrapped in <span data-ds-slot> (image slots: <img data-ds-slot>,
 * list slots: an array of such nodes with data-ds-index), and the whole unit in <section data-ds-unit data-ds-layout>, so the checker can map DOM nodes back to unit/layout/slot.
 * Slot text gets CJK-Latin spacing (cjk-spacing.ts) before escaping. Custom fragments become <section data-ds-unit="custom" data-ds-custom="<n>">. <style> blocks are scoped with @scope to that section.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Liquid } from 'liquidjs';
import { spaceCjkLatin } from './cjk-spacing.ts';
import type { SlotSpec, UnitSpec } from './library.ts';
import { BuildError } from './types.ts';
import type { CustomWorkItem, SlotItem, UnitWorkItem } from './work.ts';

class Markup {
  html: string;
  constructor(html: string) {
    this.html = html;
  }
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const liquid = new Liquid({
  outputEscape: (value: unknown) => (value instanceof Markup ? value.html : escapeHtml(String(value))),
  strictVariables: true,
  strictFilters: true,
  jsTruthy: true,
});

function slotNode(name: string, spec: SlotSpec, value: SlotItem, index?: number): Markup {
  const marks = `data-ds-slot="${name}"${index === undefined ? '' : ` data-ds-index="${index}"`}`;
  if (spec.type === 'image' && typeof value !== 'string') {
    return new Markup(`<img ${marks} src="${escapeHtml(value.src)}" alt="${escapeHtml(value.alt)}">`);
  }
  return new Markup(`<span ${marks}>${escapeHtml(spaceCjkLatin(String(value)))}</span>`);
}

function scopeStyles(html: string, scope: string): string {
  return html.replace(/<style>([\s\S]*?)<\/style>/g, (_match: string, css: string) => `<style>@scope (${scope}) {${css}}</style>`);
}

export function renderCustom(item: CustomWorkItem, index: number): string {
  const body = scopeStyles(item.html, `[data-ds-custom="${index}"]`);
  return `<section data-ds-unit="custom" data-ds-custom="${index}">${body}</section>`;
}

async function availableLayouts(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).filter((name) => name.endsWith('.liquid')).map((name) => name.slice(0, -'.liquid'.length));
  } catch {
    return [];
  }
}

export async function renderUnit(
  systemDir: string,
  carrier: string,
  item: UnitWorkItem,
  unit: UnitSpec,
): Promise<string> {
  const dir = join(systemDir, 'layouts', carrier, item.unit);
  const at = `单元 ${item.unit} 的排法 "${item.layout}"`;
  let source: string;
  try {
    source = await readFile(join(dir, `${item.layout}.liquid`), 'utf8');
  } catch {
    const names = await availableLayouts(dir);
    throw new BuildError([`${at} 不存在，该体系在此单元下有：${names.join('、') || '（无）'}`]);
  }

  let template;
  try {
    template = liquid.parse(source);
  } catch (error) {
    throw new BuildError([`${at} 的模板语法有误：${(error as Error).message}`]);
  }
  const used = await liquid.globalFullVariables(template);
  const issues: string[] = [];
  for (const variable of used) {
    const [root, slot] = variable.split('.');
    if (root !== 'slots' || !slot) issues.push(`${at} 引用了槽位以外的变量 "${variable}"`);
    else if (!(slot in unit.slots)) {
      issues.push(`${at} 引用了不存在的槽位 "${slot}"，该单元的槽位：${Object.keys(unit.slots).join('、')}`);
    }
  }
  if (issues.length) throw new BuildError(issues);

  const slots: Record<string, Markup | Markup[]> = {};
  for (const [name, spec] of Object.entries(unit.slots)) {
    const value = item.content[name];
    slots[name] = spec.maxItems !== undefined
      ? ((value as SlotItem[] | undefined) ?? []).map((entry, index) => slotNode(name, spec, entry, index))
      : slotNode(name, spec, (value as SlotItem | undefined) ?? '');
  }
  const body = scopeStyles(liquid.renderSync(template, { slots }), `[data-ds-unit="${item.unit}"][data-ds-layout="${item.layout}"]`);
  return `<section data-ds-unit="${item.unit}" data-ds-layout="${item.layout}">${body}</section>`;
}

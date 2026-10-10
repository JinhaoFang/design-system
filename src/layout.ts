/*
 * Layout (排法) rendering with LiquidJS: layouts/<carrier>/<unit>/<layout>.liquid is an HTML fragment with slots ({{ slots.name }}) and an optional <style>.
 * Autoescaped, strict variables; a layout may only reference slots declared by its unit. Each slot value is wrapped in <span data-ds-slot>, and the whole
 * unit in <section data-ds-unit data-ds-layout>, so the checker can map DOM nodes back to unit/layout/slot. <style> blocks are scoped with @scope to that section.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Liquid } from 'liquidjs';
import type { UnitSpec } from './library.ts';
import { BuildError } from './types.ts';
import type { WorkItem } from './work.ts';

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
  item: WorkItem,
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

  const slots: Record<string, Markup> = {};
  for (const name of Object.keys(unit.slots)) {
    const text = item.content?.[name] ?? '';
    slots[name] = new Markup(`<span data-ds-slot="${name}">${escapeHtml(String(text))}</span>`);
  }
  const body = liquid
    .renderSync(template, { slots })
    .replace(/<style>([\s\S]*?)<\/style>/g, (_match: string, css: string) => {
      const scope = `[data-ds-unit="${item.unit}"][data-ds-layout="${item.layout}"]`;
      return `<style>@scope (${scope}) {${css}}</style>`;
    });
  return `<section data-ds-unit="${item.unit}" data-ds-layout="${item.layout}">${body}</section>`;
}

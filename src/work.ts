/*
 * Work description (作品描述): loading and validation against the carrier's skeleton, before any rendering.
 * Shape: { system, carrier, canvas? (required for social), concept, sequence: [ {unit, layout, content} | {custom, serves} ] }.
 *   content maps slot name -> string | {src, alt} (image slots) | list of those (slots with maxItems) | {"ref": "<key>"} pointing at the library's shared content (library/content/<carrier>.json).
 *   custom is an HTML fragment (may carry one <style>) for the work concept; serves says which part of the work concept it serves. "system" names the system the work was written for; building with another system (reskinning) is allowed.
 * validateWork returns the work with refs resolved and fails with BuildError listing every problem: unknown unit/slot, missing primary slot, over the character or item limit, wrong value shape, unequal list-group lengths, missing shared key, missing serves.
 * Layout existence and layout-slot checks happen in layout.ts. Social works hold exactly one sequence item.
 */
import { readFile } from 'node:fs/promises';
import { CARRIERS, CARRIER_IDS, isCarrierId } from './carriers.ts';
import type { CarrierId } from './carriers.ts';
import type { SharedValue, Skeleton, SlotSpec } from './library.ts';
import { BuildError } from './types.ts';

export type SlotItem = string | { src: string; alt: string };
export type SlotValue = SlotItem | SlotItem[];

export interface UnitWorkItem {
  kind: 'unit';
  unit: string;
  layout: string;
  content: Record<string, SlotValue>;
}

export interface CustomWorkItem {
  kind: 'custom';
  html: string;
  serves: string;
}

export type WorkItem = UnitWorkItem | CustomWorkItem;

export interface Work {
  system: string;
  carrier: CarrierId;
  canvas?: string;
  concept: string;
  sequence: WorkItem[];
}

export interface RawWork {
  system: string;
  carrier: CarrierId;
  canvas?: string;
  concept: string;
  sequence: any[];
}

export async function loadWork(path: string): Promise<RawWork> {
  let raw: any;
  try {
    raw = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new BuildError([`无法读取作品描述：${path}（${(error as Error).message}）`]);
  }
  const issues: string[] = [];
  if (typeof raw?.system !== 'string' || !raw.system) issues.push('作品描述缺少体系 system');
  if (!isCarrierId(raw?.carrier)) {
    issues.push(`作品描述的载体 "${raw?.carrier}" 不存在，可选：${CARRIER_IDS.join('、')}`);
  } else {
    const spec = CARRIERS[raw.carrier as CarrierId];
    const names = Object.keys(spec.canvases);
    if (raw.canvas === undefined ? spec.canvasRequired : !names.includes(raw.canvas)) {
      issues.push(`作品描述的画幅 "${raw.canvas}" 不存在，${spec.label}可选：${names.join('、')}`);
    }
  }
  if (typeof raw?.concept !== 'string' || !raw.concept) issues.push('作品描述缺少作品概念 concept');
  if (!Array.isArray(raw?.sequence) || raw.sequence.length === 0) issues.push('作品描述的叙事单元序列 sequence 为空');
  else {
    if (raw.carrier === 'social' && raw.sequence.length !== 1) issues.push('社交配图每件作品只能包含一个叙事单元');
    raw.sequence.forEach((item: any, index: number) => {
      const at = `第 ${index + 1} 项`;
      if (item?.custom !== undefined) {
        if (typeof item.custom !== 'string' || item.custom.trim() === '') issues.push(`${at}：定制片段 custom 需要是非空的 HTML 字符串`);
        if (item.unit !== undefined || item.layout !== undefined) issues.push(`${at}：定制片段不能同时写 unit 或 layout`);
        if (typeof item.serves !== 'string' || item.serves.trim() === '') {
          issues.push(`${at}：定制片段必须用 serves 说明它服务于作品概念的哪一处`);
        }
      } else {
        if (typeof item?.unit !== 'string' || !item.unit) issues.push(`${at}：缺少叙事单元 unit（或定制片段 custom）`);
        if (typeof item?.layout !== 'string' || !item.layout) issues.push(`${at}：缺少排法 layout`);
      }
    });
  }
  if (issues.length) throw new BuildError(issues);
  return raw as RawWork;
}

const length = (text: string) => [...text].length;

function checkItem(value: unknown, spec: SlotSpec, where: string, issues: string[]): SlotItem | undefined {
  if (spec.type === 'image') {
    const image = value as { src?: unknown; alt?: unknown } | null;
    if (image === null || typeof image !== 'object' || typeof image.src !== 'string' || !image.src || typeof image.alt !== 'string') {
      issues.push(`${where} 是图片槽位，内容需要是 { "src": 图片路径, "alt": 说明文字 }`);
      return undefined;
    }
    if (length(image.alt) > spec.maxChars) {
      issues.push(`${where} 的说明文字超出字数上限（${length(image.alt)} > ${spec.maxChars}）`);
      return undefined;
    }
    return { src: image.src, alt: image.alt };
  }
  if (typeof value !== 'string') {
    issues.push(`${where} 的内容需要是字符串`);
    return undefined;
  }
  if (length(value) > spec.maxChars) {
    issues.push(`${where} 的内容超出字数上限（${length(value)} > ${spec.maxChars}）`);
    return undefined;
  }
  return value;
}

export function validateWork(raw: RawWork, skeleton: Skeleton, shared?: Record<string, SharedValue>): Work {
  const issues: string[] = [];
  const sequence: WorkItem[] = [];
  raw.sequence.forEach((item: any, index: number) => {
    if (item.custom !== undefined) {
      sequence.push({ kind: 'custom', html: item.custom, serves: item.serves });
      return;
    }
    const at = `第 ${index + 1} 项（单元 ${item.unit}，排法 ${item.layout}）`;
    const unit = skeleton.units[item.unit];
    if (!unit) {
      issues.push(`${at}：叙事单元 "${item.unit}" 不存在，可选：${Object.keys(skeleton.units).join('、')}`);
      return;
    }
    const given: Record<string, unknown> = item.content ?? {};
    const content: Record<string, SlotValue> = {};
    const groups: Record<string, Record<string, number>> = {};
    for (const [slot, rawValue] of Object.entries(given)) {
      const spec = unit.slots[slot];
      if (!spec) {
        issues.push(`${at}：槽位 "${slot}" 不存在，可选：${Object.keys(unit.slots).join('、')}`);
        continue;
      }
      const where = `${at}：槽位 ${slot}`;
      let value: unknown = rawValue;
      if (value !== null && typeof value === 'object' && !Array.isArray(value) && 'ref' in value) {
        const key = String((value as { ref: unknown }).ref);
        if (!shared) {
          issues.push(`${where} 引用了共享内容 "${key}"，但全库没有「${skeleton.carrier}」的共享内容`);
          continue;
        }
        if (!(key in shared)) {
          issues.push(`${where} 引用的共享内容 "${key}" 不存在`);
          continue;
        }
        value = shared[key];
      }
      if (spec.maxItems !== undefined) {
        if (!Array.isArray(value) || value.length === 0) {
          issues.push(`${where} 是列表槽位，内容需要是 1 到 ${spec.maxItems} 项的数组`);
          continue;
        }
        if (value.length > spec.maxItems) {
          issues.push(`${where} 的项数超出上限（${value.length} > ${spec.maxItems}）`);
          continue;
        }
        const items = value.map((entry, i) => checkItem(entry, spec, `${where} 第 ${i + 1} 项`, issues));
        if (items.every((entry): entry is SlotItem => entry !== undefined)) {
          content[slot] = items;
          if (spec.group) (groups[spec.group] ??= {})[slot] = items.length;
        }
      } else {
        if (Array.isArray(value)) {
          issues.push(`${where} 不是列表槽位，内容不能是数组`);
          continue;
        }
        const checked = checkItem(value, spec, where, issues);
        if (checked !== undefined) content[slot] = checked;
      }
    }
    for (const [group, counts] of Object.entries(groups)) {
      if (new Set(Object.values(counts)).size > 1) {
        const detail = Object.entries(counts).map(([slot, count]) => `${slot} ${count} 项`).join('、');
        issues.push(`${at}：同组「${group}」的列表槽位项数需要一致（${detail}）`);
      }
    }
    for (const [slot, spec] of Object.entries(unit.slots)) {
      if (spec.priority === 'primary' && !(slot in given) || given[slot] === '') issues.push(`${at}：缺少主要槽位 "${slot}" 的内容`);
    }
    sequence.push({ kind: 'unit', unit: item.unit, layout: item.layout, content });
  });
  if (issues.length) throw new BuildError(issues);
  return { system: raw.system, carrier: raw.carrier, ...(raw.canvas !== undefined ? { canvas: raw.canvas } : {}), concept: raw.concept, sequence };
}

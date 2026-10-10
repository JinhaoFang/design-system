/*
 * Work description (作品描述): loading and validation against the carrier's skeleton, before any rendering.
 * Fails with BuildError listing every problem: unknown carrier/canvas/unit/slot, missing primary slot, content over the slot's character limit.
 * Layout existence and layout-slot checks happen in layout.ts. Social works currently hold exactly one narrative unit.
 */
import { readFile } from 'node:fs/promises';
import { SOCIAL_CANVASES, SUPPORTED_CARRIERS } from './carriers.ts';
import type { SocialCanvas } from './carriers.ts';
import type { Skeleton } from './library.ts';
import { BuildError } from './types.ts';

export interface WorkItem {
  unit: string;
  layout: string;
  content: Record<string, string>;
}

export interface Work {
  system?: string;
  carrier: 'social';
  canvas: SocialCanvas;
  concept: string;
  sequence: WorkItem[];
}

export async function loadWork(path: string): Promise<Work> {
  let raw: any;
  try {
    raw = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new BuildError([`无法读取作品描述：${path}（${(error as Error).message}）`]);
  }
  const issues: string[] = [];
  if (!SUPPORTED_CARRIERS.includes(raw?.carrier)) {
    issues.push(`作品描述的载体 "${raw?.carrier}" 尚不支持，目前只支持：${SUPPORTED_CARRIERS.join('、')}`);
  }
  if (!(raw?.canvas in SOCIAL_CANVASES)) {
    issues.push(`作品描述的画幅 "${raw?.canvas}" 不存在，可选：${Object.keys(SOCIAL_CANVASES).join('、')}`);
  }
  if (typeof raw?.concept !== 'string' || !raw.concept) issues.push('作品描述缺少作品概念 concept');
  if (!Array.isArray(raw?.sequence) || raw.sequence.length === 0) issues.push('作品描述的叙事单元序列 sequence 为空');
  else if (raw.sequence.length !== 1) issues.push('社交配图目前每件作品只能包含一个叙事单元');
  if (issues.length) throw new BuildError(issues);
  return raw as Work;
}

export function validateWork(work: Work, skeleton: Skeleton): void {
  const issues: string[] = [];
  work.sequence.forEach((item, index) => {
    const at = `第 ${index + 1} 项（单元 ${item.unit}，排法 ${item.layout}）`;
    const unit = skeleton.units[item.unit];
    if (!unit) {
      issues.push(`${at}：叙事单元 "${item.unit}" 不存在，可选：${Object.keys(skeleton.units).join('、')}`);
      return;
    }
    const content = item.content ?? {};
    for (const [slot, text] of Object.entries(content)) {
      const spec = unit.slots[slot];
      if (!spec) {
        issues.push(`${at}：槽位 "${slot}" 不存在，可选：${Object.keys(unit.slots).join('、')}`);
      } else if ([...String(text)].length > spec.maxChars) {
        issues.push(`${at}：槽位 ${slot} 的内容超出字数上限（${[...String(text)].length} > ${spec.maxChars}）`);
      }
    }
    for (const [slot, spec] of Object.entries(unit.slots)) {
      if (spec.priority === 'primary' && !content[slot]) issues.push(`${at}：缺少主要槽位 "${slot}" 的内容`);
    }
  });
  if (issues.length) throw new BuildError(issues);
}

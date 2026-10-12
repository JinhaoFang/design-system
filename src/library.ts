/*
 * Library data shared by all systems, loaded from a library directory: skeleton/<carrier>.json (narrative units and slots), fonts/manifest.json (font list, format in fonts.ts)
 * and content/<carrier>.json (optional shared content, a flat map of key -> string | string[] | {image: <id>} | {image: <id>}[]; works reference it as {"ref": "key"}).
 * content/images.json is the library's list of image briefs: { "<image-id>": { brief, alt } } (brief: one sentence on what the picture shows; alt: the alt text, held to the image slot's maxChars).
 * Image slots carry only an image id; each system supplies the picture under <system>/images/ (resolved at build time by assets.ts).
 * Skeleton file: { carrier, units: { <unit-id>: { label, slots: { <slotName>: { type: text|data|image|action, priority: primary|secondary|tertiary, maxChars, maxItems?, group? } } } } }.
 *   maxChars is in characters per item (for image slots: the alt text); maxItems makes a slot a list; list slots with the same group must get equal item counts in a work.
 * A system may add its own units in <system>/skeleton/<carrier>.json (same shape, no carrier needed); an id that already exists in the shared skeleton is an error.
 * Everything is read at build time; the library directory is a build option so tests can point at a fixture library.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BuildError } from './types.ts';

export const IMAGE_ID = /^[a-z][a-z0-9-]*$/;
export const SLOT_TYPES = ['text', 'data', 'image', 'action'] as const;
export const SLOT_PRIORITIES = ['primary', 'secondary', 'tertiary'] as const;

export interface SlotSpec {
  type: (typeof SLOT_TYPES)[number];
  priority: (typeof SLOT_PRIORITIES)[number];
  maxChars: number;
  maxItems?: number;
  group?: string;
}

export interface UnitSpec {
  label: string;
  slots: Record<string, SlotSpec>;
}

export interface Skeleton {
  carrier: string;
  units: Record<string, UnitSpec>;
}

export { loadFontManifest } from './fonts.ts';
export type { FontEntry, FontManifest } from './fonts.ts';

export interface ImageRef {
  image: string;
}

export interface ImageBrief {
  brief: string;
  alt: string;
}

export type SharedValue = string | string[] | ImageRef | ImageRef[];

async function readJson<T>(path: string, what: string): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch (error) {
    throw new BuildError([`无法读取${what}：${path}（${(error as Error).message}）`]);
  }
}

async function readOptionalJson(path: string, what: string): Promise<unknown | undefined> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new BuildError([`无法解析${what}：${path}（${(error as Error).message}）`]);
  }
}

export function checkUnits(units: unknown, source: string): string[] {
  const issues: string[] = [];
  if (units === null || typeof units !== 'object' || Array.isArray(units)) return [`${source} 缺少 units 对象`];
  for (const [id, unit] of Object.entries<any>(units)) {
    const at = `${source} 单元「${id}」`;
    if (!/^[a-z][a-z0-9-]*$/.test(id)) issues.push(`${at} 的标识只能用小写字母、数字和连字符，并以字母开头`);
    if (typeof unit?.label !== 'string' || unit.label === '') issues.push(`${at} 缺少名称 label`);
    const slots = unit?.slots;
    if (slots === null || typeof slots !== 'object' || Object.keys(slots ?? {}).length === 0) {
      issues.push(`${at} 缺少槽位 slots`);
      continue;
    }
    let primary = 0;
    for (const [name, slot] of Object.entries<any>(slots)) {
      const where = `${at}的槽位「${name}」`;
      if (!/^[a-z][A-Za-z0-9]*$/.test(name)) issues.push(`${where} 的名称只能用字母和数字，并以小写字母开头`);
      if (!SLOT_TYPES.includes(slot?.type)) issues.push(`${where} 的类型 type 需为：${SLOT_TYPES.join('、')}`);
      if (!SLOT_PRIORITIES.includes(slot?.priority)) issues.push(`${where} 的主次 priority 需为：${SLOT_PRIORITIES.join('、')}`);
      else if (slot.priority === 'primary') primary += 1;
      if (!Number.isInteger(slot?.maxChars) || slot.maxChars < 1) issues.push(`${where} 的字数上限 maxChars 需为正整数`);
      if (slot?.maxItems !== undefined && (!Number.isInteger(slot.maxItems) || slot.maxItems < 1)) {
        issues.push(`${where} 的 maxItems 需为正整数`);
      }
      if (slot?.group !== undefined && (typeof slot.group !== 'string' || slot.maxItems === undefined)) {
        issues.push(`${where} 的 group 需为字符串，且只用于有 maxItems 的列表槽位`);
      }
    }
    if (primary === 0) issues.push(`${at} 至少需要一个主要槽位（priority 为 primary）`);
  }
  return issues;
}

export async function loadSkeleton(libraryDir: string, carrier: string): Promise<Skeleton> {
  const path = join(libraryDir, 'skeleton', `${carrier}.json`);
  const skeleton = await readJson<Skeleton>(path, `「${carrier}」结构骨架`);
  const issues = checkUnits(skeleton.units, `结构骨架 ${path}`);
  if (skeleton.carrier !== carrier) issues.push(`结构骨架 ${path} 的 carrier 应为 "${carrier}"，当前为 ${JSON.stringify(skeleton.carrier)}`);
  if (issues.length) throw new BuildError(issues);
  return skeleton;
}

export async function loadSystemUnits(systemDir: string, carrier: string): Promise<Record<string, UnitSpec>> {
  const path = join(systemDir, 'skeleton', `${carrier}.json`);
  const data = (await readOptionalJson(path, `体系专属单元「${carrier}」`)) as { units?: Record<string, UnitSpec> } | undefined;
  if (data === undefined) return {};
  const issues = checkUnits(data.units, `体系专属单元 ${path}`);
  if (issues.length) throw new BuildError(issues);
  return data.units!;
}

export function mergeUnits(shared: Skeleton, own: Record<string, UnitSpec>, carrier: string): Skeleton {
  const clashes = Object.keys(own).filter((id) => id in shared.units);
  if (clashes.length) {
    throw new BuildError(clashes.map((id) => `体系专属单元「${id}」与全库「${carrier}」骨架里的同名单元冲突，请换一个标识`));
  }
  return { carrier: shared.carrier, units: { ...shared.units, ...own } };
}

export async function loadSharedContent(libraryDir: string, carrier: string): Promise<Record<string, SharedValue> | undefined> {
  const data = await readOptionalJson(join(libraryDir, 'content', `${carrier}.json`), `「${carrier}」共享内容`);
  return data as Record<string, SharedValue> | undefined;
}

export async function loadImageBriefs(libraryDir: string): Promise<Record<string, ImageBrief> | undefined> {
  const path = join(libraryDir, 'content', 'images.json');
  const data = await readOptionalJson(path, '图像简报清单');
  if (data === undefined) return undefined;
  const issues: string[] = [];
  if (data === null || typeof data !== 'object' || Array.isArray(data)) throw new BuildError([`图像简报清单 ${path} 需要是以图像标识为键的对象`]);
  for (const [id, entry] of Object.entries<any>(data)) {
    if (!IMAGE_ID.test(id)) issues.push(`图像简报标识「${id}」只能用小写字母、数字和连字符，并以字母开头`);
    if (typeof entry?.brief !== 'string' || entry.brief === '') issues.push(`图像简报「${id}」缺少 brief（这张图讲什么）`);
    if (typeof entry?.alt !== 'string' || entry.alt === '') issues.push(`图像简报「${id}」缺少替代文字 alt`);
  }
  if (issues.length) throw new BuildError(issues);
  return data as Record<string, ImageBrief>;
}

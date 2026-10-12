/*
 * SYSTEM.md validation. Input: path of the file. Output: parsed header (SystemMeta) plus a list of problems; nothing is thrown here, the caller collects all issues.
 * Header (YAML between --- lines): id, name, category, scenarios[], carriers[], tone{5 pairs, integers 1-5}, material-anchor, source, license.
 *   Tone keys: calm-lively (静—动), airy-dense (疏—密), cool-warm (冷—暖), light-heavy (轻—重), formal-playful (庄—谐); 1 = first pole, 5 = second pole.
 * Body (headings outside code fences, exact titles): ## 意图, ## 材质锚点, ## 视觉语言 (### 色彩, 字体, 版面, 形态, 图像与画风, 识别符号), ## 动效语言, ## 结构骨架, ## 范例.
 * Five required contents, each checked where it lives: 材质锚点 (header field + non-empty section), 动效语言 (section + non-empty "### 高光时刻"; ladder and easing are in the token file),
 *   中文字体搭配 (non-empty "#### 中文搭配" under 字体; font.cjk is in the token file), 识别符号 (1-3 top-level "- " items), 无图方案 (non-empty "#### 无图方案" under 图像与画风).
 * Every message says what is missing and where. splitHeader and parseSections (header/body split and the heading tree outside code fences) are exported for readers of the body, such as the system page.
 */
import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { CARRIER_IDS, isCarrierId } from './carriers.ts';
import type { CarrierId } from './carriers.ts';

export const TONE_PAIRS = {
  'calm-lively': '静—动',
  'airy-dense': '疏—密',
  'cool-warm': '冷—暖',
  'light-heavy': '轻—重',
  'formal-playful': '庄—谐',
} as const;

export type ToneKey = keyof typeof TONE_PAIRS;

export interface SystemMeta {
  id: string;
  name: string;
  category: string;
  scenarios: string[];
  carriers: CarrierId[];
  tone: Record<ToneKey, number>;
  materialAnchor: string;
}

export interface SystemDocResult {
  meta?: SystemMeta;
  issues: string[];
}

export interface Section {
  level: number;
  title: string;
  own: string[];
  children: Section[];
}

const FILE = 'SYSTEM.md';
const REQUIRED_SECTIONS = ['意图', '材质锚点', '视觉语言', '动效语言', '结构骨架', '范例'];
const VISUAL_PARTS = ['色彩', '字体', '版面', '形态', '图像与画风', '识别符号'];

export function splitHeader(text: string): { header: string | undefined; body: string } {
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!match) return { header: undefined, body: text };
  return { header: match[1]!, body: text.slice(match[0].length) };
}

export function parseSections(body: string): Section[] {
  const root: Section = { level: 0, title: '', own: [], children: [] };
  const stack: Section[] = [root];
  let fence: string | undefined;
  for (const line of body.split(/\r?\n/)) {
    const fenceMatch = /^\s*(```+|~~~+)/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1]![0]!;
      if (fence === undefined) fence = marker;
      else if (fence === marker) fence = undefined;
      stack[stack.length - 1]!.own.push(line);
      continue;
    }
    const heading = fence === undefined ? /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line) : null;
    if (heading) {
      const section: Section = { level: heading[1]!.length, title: heading[2]!, own: [], children: [] };
      while (stack[stack.length - 1]!.level >= section.level) stack.pop();
      stack[stack.length - 1]!.children.push(section);
      stack.push(section);
    } else {
      stack[stack.length - 1]!.own.push(line);
    }
  }
  return root.children;
}

function flatten(sections: Section[]): Section[] {
  return sections.flatMap((section) => [section, ...flatten(section.children)]);
}

function findChild(sections: Section[], level: number, title: string): Section | undefined {
  return flatten(sections).find((section) => section.level === level && section.title === title);
}

function isFilled(section: Section | undefined): boolean {
  if (!section) return false;
  return section.own.join('').trim() !== '' || section.children.some(isFilled);
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function checkHeader(header: string | undefined, issues: string[]): SystemMeta | undefined {
  if (header === undefined) {
    issues.push(`${FILE} 缺少文件头（文件开头需要用 --- 包起来的检索字段）`);
    return undefined;
  }
  let data: any;
  try {
    data = parseYaml(header);
  } catch (error) {
    issues.push(`${FILE} 文件头无法解析：${(error as Error).message.split('\n')[0]}`);
    return undefined;
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    issues.push(`${FILE} 文件头不是键值对`);
    return undefined;
  }
  const before = issues.length;
  const missing = (label: string, key: string) => issues.push(`${FILE} 文件头缺少「${label}」（${key}）`);

  const id = str(data.id);
  if (!id) missing('标识', 'id');
  else if (!/^[a-z][a-z0-9-]*$/.test(id)) issues.push(`${FILE} 文件头的标识 id "${id}" 只能用小写字母、数字和连字符，并以字母开头`);
  const name = str(data.name);
  if (!name) missing('名称', 'name');
  const category = str(data.category);
  if (!category) missing('类别', 'category');
  const scenarios = Array.isArray(data.scenarios) ? data.scenarios.map((item: unknown) => str(item)).filter((item: string | undefined): item is string => !!item) : [];
  if (scenarios.length === 0) missing('适用场景', 'scenarios');
  if (!str(data.source)) missing('来源', 'source');
  if (!str(data.license)) missing('授权', 'license');

  const carriers: CarrierId[] = [];
  if (!Array.isArray(data.carriers) || data.carriers.length === 0) missing('载体', 'carriers');
  else {
    for (const carrier of data.carriers) {
      if (isCarrierId(carrier)) carriers.push(carrier);
      else issues.push(`${FILE} 文件头的载体 "${carrier}" 不存在，可选：${CARRIER_IDS.join('、')}`);
    }
  }

  const tone = {} as Record<ToneKey, number>;
  if (data.tone === null || typeof data.tone !== 'object') missing('调性位置', 'tone');
  else {
    for (const [key, label] of Object.entries(TONE_PAIRS) as [ToneKey, string][]) {
      const value = data.tone[key];
      if (value === undefined) issues.push(`${FILE} 文件头的调性位置缺少「${label}」（tone.${key}）`);
      else if (!Number.isInteger(value) || value < 1 || value > 5) {
        issues.push(`${FILE} 文件头的调性位置「${label}」（tone.${key}）需为 1–5 的整数，当前为 ${JSON.stringify(value)}`);
      } else tone[key] = value;
    }
  }

  const materialAnchor = str(data['material-anchor']);
  if (!materialAnchor) issues.push(`缺少材质锚点：${FILE} 文件头缺少「材质锚点」（material-anchor）`);

  if (issues.length > before) return undefined;
  return { id: id!, name: name!, category: category!, scenarios, carriers, tone, materialAnchor: materialAnchor! };
}

function checkBody(body: string, issues: string[]): void {
  const sections = parseSections(body);
  const top = (title: string) => sections.flatMap((s) => (s.level === 1 ? s.children : [s])).find((s) => s.level === 2 && s.title === title);

  for (const title of REQUIRED_SECTIONS) {
    const section = top(title);
    if (!section) {
      const prefix = title === '材质锚点' ? '缺少材质锚点：' : title === '动效语言' ? '缺少动效语言：' : '';
      issues.push(`${prefix}${FILE} 缺少正文章节「${title}」`);
    } else if (!isFilled(section)) {
      const prefix = title === '材质锚点' ? '缺少材质锚点：' : title === '动效语言' ? '缺少动效语言：' : '';
      issues.push(`${prefix}${FILE} 正文章节「${title}」为空`);
    }
  }

  const visual = top('视觉语言');
  if (!visual) return;
  for (const part of VISUAL_PARTS) {
    const section = findChild(visual.children, 3, part);
    const prefix = part === '识别符号' ? '缺少识别符号：' : '';
    if (!section) issues.push(`${prefix}${FILE} 正文「视觉语言」缺少小节「${part}」${part === '识别符号' ? '（需要 1–3 个）' : ''}`);
    else if (!isFilled(section) && part !== '识别符号') issues.push(`${FILE} 正文「视觉语言」的小节「${part}」为空`);
  }

  const fonts = findChild(visual.children, 3, '字体');
  if (fonts && !isFilled(findChild(fonts.children, 4, '中文搭配'))) {
    issues.push(`缺少中文字体搭配：${FILE} 正文「视觉语言 / 字体」下缺少非空的「中文搭配」小节`);
  }
  const imagery = findChild(visual.children, 3, '图像与画风');
  if (imagery && !isFilled(findChild(imagery.children, 4, '无图方案'))) {
    issues.push(`缺少无图方案：${FILE} 正文「视觉语言 / 图像与画风」下缺少非空的「无图方案」小节`);
  }
  const marks = findChild(visual.children, 3, '识别符号');
  if (marks) {
    const count = marks.own.filter((line) => /^[-*+]\s+\S/.test(line)).length;
    if (count === 0) issues.push(`缺少识别符号：${FILE} 正文「视觉语言 / 识别符号」下没有以「- 」开头的条目，需要 1–3 个`);
    else if (count > 3) issues.push(`识别符号过多：${FILE} 正文「视觉语言 / 识别符号」下有 ${count} 个，上限 3 个`);
  }

  const motion = top('动效语言');
  if (motion && !isFilled(findChild(motion.children, 3, '高光时刻'))) {
    issues.push(`缺少高光时刻：${FILE} 正文「动效语言」下缺少非空的「高光时刻」小节（至少描述一个）`);
  }
}

export async function validateSystemDoc(path: string): Promise<SystemDocResult> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    return { issues: [`体系缺少 ${FILE}：${path}`] };
  }
  const issues: string[] = [];
  const { header, body } = splitHeader(text);
  const meta = checkHeader(header, issues);
  checkBody(body, issues);
  return meta ? { meta, issues } : { issues };
}

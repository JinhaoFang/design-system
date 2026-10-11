/*
 * Feeling-word lexicon (感觉词词典): one file per word at <library>/lexicon/<id>.json, id equal to the file name (ascii pinyin).
 * validateLexicon(libraryDir) -> { count, issues[] } checks completeness; listLexicon(libraryDir, filter?) flattens entries into one row per interpretation.
 * Entry: { id, word, phrasings[] (what clients actually say), interpretations[] (at least 2, names and materialAnchors distinct within a word) }.
 * Interpretation: name, description (plain language), materialAnchor, tonality (keys 静动 疏密 冷暖 轻重 庄谐, integers 1-5, 1 is the first character's side),
 *   composition (跳跃率 版面率 图版率, each 低 / 中 / 高), recommendation, samples, approval.
 * recommendation: { system: <seed system id> } or { system: "临时方向", borrowLayoutsFrom: <seed system id>, direction: <one sentence> }.
 * samples: { status: "pending" } (待补) or { status: "present", exemplars: [exemplar ids] }; every id must exist under <library>/exemplars/<id>/exemplar.json.
 * approval is per interpretation (the judge confirms them one by one): { status: candidate | approved | rejected }; approved and rejected need date YYYY-MM-DD, candidate has none.
 * Agents only submit candidates. Pending samples are allowed on every status because sample images are filled in later.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { APPROVAL_STATUSES, TONALITY_SCALES, isBlank, isFile, isIsoDate } from './exemplars.ts';

export const SEED_SYSTEMS = ['paper-editorial', 'precision-industrial', 'riso-print'] as const;
export const TEMPORARY_DIRECTION = '临时方向';
export const COMPOSITION_RATIOS = ['跳跃率', '版面率', '图版率'] as const;
export const COMPOSITION_LEVELS = ['低', '中', '高'] as const;
export const MIN_INTERPRETATIONS = 2;

export interface LexiconIssues {
  count: number;
  issues: string[];
}

async function checkInterpretation(
  libraryDir: string,
  index: number,
  item: any,
  problemFor: (field: string, message: string) => void,
): Promise<void> {
  const prefix = `interpretations[${index}]`;
  const problem = (field: string, message: string) => problemFor(`${prefix}.${field}`, message);
  if (item === null || typeof item !== 'object') {
    problemFor(prefix, '必须是对象');
    return;
  }
  for (const field of ['name', 'description', 'materialAnchor']) {
    if (isBlank(item[field])) problem(field, '缺失或为空');
  }

  const tonality = item.tonality;
  if (tonality === undefined || tonality === null || typeof tonality !== 'object') {
    problem('tonality', '缺失');
  } else {
    for (const scale of TONALITY_SCALES) {
      const value = tonality[scale];
      if (!Number.isInteger(value) || value < 1 || value > 5) problem('tonality', `「${scale}」必须是 1–5 的整数`);
    }
    for (const key of Object.keys(tonality)) {
      if (!(TONALITY_SCALES as readonly string[]).includes(key)) problem('tonality', `含未知刻度「${key}」`);
    }
  }

  const composition = item.composition;
  if (composition === undefined || composition === null || typeof composition !== 'object') {
    problem('composition', '缺失');
  } else {
    for (const ratio of COMPOSITION_RATIOS) {
      if (!(COMPOSITION_LEVELS as readonly string[]).includes(composition[ratio])) {
        problem('composition', `「${ratio}」必须是 ${COMPOSITION_LEVELS.join(' / ')}`);
      }
    }
    for (const key of Object.keys(composition)) {
      if (!(COMPOSITION_RATIOS as readonly string[]).includes(key)) problem('composition', `含未知比率「${key}」`);
    }
  }

  const recommendation = item.recommendation;
  if (recommendation === undefined || recommendation === null || typeof recommendation !== 'object') {
    problem('recommendation', '缺失');
  } else if (recommendation.system === TEMPORARY_DIRECTION) {
    if (!(SEED_SYSTEMS as readonly string[]).includes(recommendation.borrowLayoutsFrom)) {
      problem('recommendation.borrowLayoutsFrom', `临时方向必须指明借用排法的种子体系：${SEED_SYSTEMS.join(' / ')}`);
    }
    if (isBlank(recommendation.direction)) problem('recommendation.direction', '临时方向必须用一句话写明方向');
  } else if (!(SEED_SYSTEMS as readonly string[]).includes(recommendation.system)) {
    problem('recommendation.system', `必须是 ${SEED_SYSTEMS.join(' / ')} 或「${TEMPORARY_DIRECTION}」`);
  }

  const samples = item.samples;
  if (samples === undefined || samples === null || typeof samples !== 'object') {
    problem('samples', '缺失');
  } else if (samples.status === 'present') {
    if (!Array.isArray(samples.exemplars) || samples.exemplars.length === 0) {
      problem('samples.exemplars', '样图已就位时必须列出范例标识');
    } else {
      for (const id of samples.exemplars) {
        if (typeof id !== 'string' || !(await isFile(join(libraryDir, 'exemplars', id, 'exemplar.json')))) {
          problem('samples.exemplars', `范例不存在：${JSON.stringify(id)}`);
        }
      }
    }
  } else if (samples.status !== 'pending') {
    problem('samples.status', '必须是 present / pending');
  }

  const approval = item.approval;
  if (approval === undefined || approval === null || typeof approval !== 'object') {
    problem('approval', '缺失');
  } else if (!(approval.status in APPROVAL_STATUSES)) {
    problem('approval.status', `必须是 ${Object.keys(APPROVAL_STATUSES).join(' / ')}`);
  } else if (approval.status === 'candidate') {
    if (approval.date !== undefined) problem('approval.date', '候选不应有批准日期');
  } else if (!isIsoDate(approval.date)) {
    problem('approval.date', '已批准或已拒绝时必须是 YYYY-MM-DD 日期');
  }
}

async function checkEntry(libraryDir: string, fileId: string, record: any): Promise<string[]> {
  const issues: string[] = [];
  const problem = (field: string, message: string) => issues.push(`${fileId}：${field} ${message}`);

  if (record.id !== fileId) problem('id', `必须等于文件名（现为 ${JSON.stringify(record.id)}）`);
  if (isBlank(record.word)) problem('word', '缺失或为空');

  if (!Array.isArray(record.phrasings) || record.phrasings.length === 0 || record.phrasings.some(isBlank)) {
    problem('phrasings', '必须列出至少一种常见说法，且不能为空');
  }

  const interpretations = record.interpretations;
  if (!Array.isArray(interpretations)) {
    problem('interpretations', '缺失');
    return issues;
  }
  if (interpretations.length < MIN_INTERPRETATIONS) {
    problem('interpretations', `每个词至少要有两种解读（现为 ${interpretations.length} 种）`);
  }
  for (const [index, item] of interpretations.entries()) {
    await checkInterpretation(libraryDir, index, item, problem);
  }
  for (const field of ['name', 'materialAnchor']) {
    const seen = new Set<string>();
    for (const [index, item] of interpretations.entries()) {
      const value = typeof item?.[field] === 'string' ? item[field].trim() : '';
      if (value === '') continue;
      if (seen.has(value)) problem(`interpretations[${index}].${field}`, `与同一个词的另一种解读重复：${value}`);
      seen.add(value);
    }
  }
  return issues;
}

async function entryFiles(libraryDir: string): Promise<string[]> {
  const entries = await readdir(join(libraryDir, 'lexicon'), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name.slice(0, -'.json'.length))
    .sort();
}

export async function validateLexicon(libraryDir: string): Promise<LexiconIssues> {
  let ids;
  try {
    ids = await entryFiles(libraryDir);
  } catch {
    return { count: 0, issues: [`找不到词典目录：${join(libraryDir, 'lexicon')}`] };
  }
  const issues: string[] = [];
  for (const id of ids) {
    let record;
    try {
      record = JSON.parse(await readFile(join(libraryDir, 'lexicon', `${id}.json`), 'utf8'));
    } catch (error) {
      issues.push(`${id}：无法读取 ${id}.json（${(error as Error).message}）`);
      continue;
    }
    issues.push(...(await checkEntry(libraryDir, id, record)));
  }
  return { count: ids.length, issues };
}

export type LexiconApprovalStatus = keyof typeof APPROVAL_STATUSES;

export interface LexiconFilter {
  status?: LexiconApprovalStatus | undefined;
  system?: string | undefined;
}

export interface LexiconListing {
  id: string;
  word: string;
  interpretation: string;
  system: string;
  approvalStatus: string;
  samples: string[];
}

export async function listLexicon(libraryDir: string, filter: LexiconFilter = {}): Promise<LexiconListing[]> {
  const listing: LexiconListing[] = [];
  for (const id of await entryFiles(libraryDir)) {
    let record;
    try {
      record = JSON.parse(await readFile(join(libraryDir, 'lexicon', `${id}.json`), 'utf8'));
    } catch {
      continue;
    }
    for (const item of Array.isArray(record.interpretations) ? record.interpretations : []) {
      const system = item?.recommendation?.system ?? '';
      const status = item?.approval?.status ?? '';
      if (filter.status !== undefined && status !== filter.status) continue;
      if (filter.system !== undefined && system !== filter.system) continue;
      listing.push({
        id,
        word: record.word ?? '',
        interpretation: item?.name ?? '',
        system,
        approvalStatus: status,
        samples: item?.samples?.status === 'present' && Array.isArray(item.samples.exemplars) ? item.samples.exemplars : [],
      });
    }
  }
  return listing;
}

/*
 * Exemplar library: one directory per exemplar at <library>/exemplars/<id>/ holding exemplar.json and its media file.
 * validateExemplars(libraryDir) -> { count, issues[] } checks completeness; listExemplars(libraryDir, source?) lists records by source type.
 * Source types: external (外部收集), copy (临摹), original (原创). Approval: candidate (候选), approved (已批准), rejected (已拒绝).
 * Tonality keys 静动 疏密 冷暖 轻重 庄谐 take 1-5; 1 is the first character's side of each pair (静, 疏, 冷, 轻, 庄).
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

export const SOURCE_TYPES = { external: '外部收集', copy: '临摹', original: '原创' } as const;
export const APPROVAL_STATUSES = { candidate: '候选', approved: '已批准', rejected: '已拒绝' } as const;
export const MEDIA_KINDS = ['screenshot', 'recording'] as const;
export const CARRIERS = ['web', 'slides', 'social'] as const;
export const TONALITY_SCALES = ['静动', '疏密', '冷暖', '轻重', '庄谐'] as const;

export interface ExemplarIssues {
  count: number;
  issues: string[];
}

export async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

export function isIsoDate(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
}

export function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim() === '';
}

async function checkRecord(root: string, dirName: string, record: any): Promise<string[]> {
  const issues: string[] = [];
  const problem = (field: string, message: string) => issues.push(`${dirName}：${field} ${message}`);
  const requireText = (field: string, value: unknown) => {
    if (isBlank(value)) problem(field, '缺失或为空');
  };

  if (record.id !== dirName) problem('id', `必须等于目录名（现为 ${JSON.stringify(record.id)}）`);
  requireText('title', record.title);
  requireText('copyright', record.copyright);

  if (!(record.sourceType in SOURCE_TYPES)) {
    problem('sourceType', `必须是 ${Object.keys(SOURCE_TYPES).join(' / ')}`);
  } else if (record.sourceType !== 'original') {
    requireText('sourceUrl', record.sourceUrl);
  }

  if (!CARRIERS.includes(record.carrier)) problem('carrier', `必须是 ${CARRIERS.join(' / ')}`);

  const media = record.media;
  if (media === undefined || media === null || typeof media !== 'object') {
    problem('media', '缺失');
  } else {
    if (!MEDIA_KINDS.includes(media.kind)) problem('media.kind', `必须是 ${MEDIA_KINDS.join(' / ')}`);
    if (media.status === 'present') {
      if (isBlank(media.file)) {
        problem('media.file', '媒体已就位时必须给出文件名');
      } else if (!(await isFile(join(root, dirName, media.file)))) {
        problem('media.file', `文件不存在：${media.file}`);
      }
    } else if (media.status === 'pending') {
      if (record.approval?.status === 'approved') problem('media', '已批准的范例不能是待补状态');
    } else {
      problem('media.status', '必须是 present / pending');
    }
  }

  const annotation = record.annotation ?? {};
  requireText('annotation.highlights', annotation.highlights);
  requireText('annotation.reasons', annotation.reasons);
  requireText('annotation.scenes', annotation.scenes);
  requireText('annotation.materialAnchor', annotation.materialAnchor);

  const tonality = annotation.tonality;
  if (tonality === undefined || typeof tonality !== 'object') {
    problem('annotation.tonality', '缺失');
  } else {
    for (const scale of TONALITY_SCALES) {
      const value = tonality[scale];
      if (!Number.isInteger(value) || value < 1 || value > 5) {
        problem('annotation.tonality', `「${scale}」必须是 1–5 的整数`);
      }
    }
    for (const key of Object.keys(tonality)) {
      if (!(TONALITY_SCALES as readonly string[]).includes(key)) {
        problem('annotation.tonality', `含未知刻度「${key}」`);
      }
    }
  }

  if (record.approval === undefined) {
    problem('approval', '缺失');
  } else if (!(record.approval.status in APPROVAL_STATUSES)) {
    problem('approval.status', `必须是 ${Object.keys(APPROVAL_STATUSES).join(' / ')}`);
  } else if (record.approval.status === 'candidate') {
    if (record.approval.date !== undefined) problem('approval.date', '候选不应有批准日期');
  } else if (!isIsoDate(record.approval.date)) {
    problem('approval.date', '已批准或已拒绝时必须是 YYYY-MM-DD 日期');
  }

  return issues;
}

export async function validateExemplars(libraryDir: string): Promise<ExemplarIssues> {
  const root = join(libraryDir, 'exemplars');
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return { count: 0, issues: [`找不到范例目录：${root}`] };
  }
  const dirs = entries.filter((entry) => entry.isDirectory());
  const issues: string[] = [];
  for (const dir of dirs) {
    let record;
    try {
      record = JSON.parse(await readFile(join(root, dir.name, 'exemplar.json'), 'utf8'));
    } catch (error) {
      issues.push(`${dir.name}：无法读取 exemplar.json（${(error as Error).message}）`);
      continue;
    }
    issues.push(...(await checkRecord(root, dir.name, record)));
  }
  return { count: dirs.length, issues };
}

export type SourceType = keyof typeof SOURCE_TYPES;

export interface ExemplarListing {
  id: string;
  title: string;
  sourceType: string;
  sourceUrl: string | null;
  carrier: string;
  approvalStatus: string;
  mediaFile: string | null;
}

export async function listExemplars(libraryDir: string, source?: SourceType): Promise<ExemplarListing[]> {
  const root = join(libraryDir, 'exemplars');
  const entries = await readdir(root, { withFileTypes: true });
  const dirs = entries.filter((entry) => entry.isDirectory()).sort((a, b) => (a.name < b.name ? -1 : 1));
  const listing: ExemplarListing[] = [];
  for (const dir of dirs) {
    let record;
    try {
      record = JSON.parse(await readFile(join(root, dir.name, 'exemplar.json'), 'utf8'));
    } catch {
      continue;
    }
    if (source !== undefined && record.sourceType !== source) continue;
    const present = record.media?.status === 'present' && typeof record.media.file === 'string';
    const file = present ? join(root, dir.name, record.media.file) : null;
    listing.push({
      id: dir.name,
      title: record.title ?? '',
      sourceType: record.sourceType,
      sourceUrl: record.sourceUrl ?? null,
      carrier: record.carrier,
      approvalStatus: record.approval?.status ?? '',
      mediaFile: file !== null && (await isFile(file)) ? file : null,
    });
  }
  return listing;
}

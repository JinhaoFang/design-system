/*
 * Image resolution: every image id a work references (image slot values {image: <id>}) is looked up in the current system directory as <system>/images/<id>.<ext>
 * with ext one of svg, webp, png, jpg, jpeg, avif, gif. Each found file is copied to <outDir>/images/<id>.<ext> and the returned work carries src "images/<id>.<ext>" on those items
 * (the generated index.html sits in outDir). Ids with no file, or with more than one file of different formats, are validation problems: BuildError lists all of them and nothing is copied.
 */
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { BuildError } from './types.ts';
import type { ImageItem, SlotItem, Work } from './work.ts';

export const IMAGE_DIR = 'images';
export const IMAGE_EXTENSIONS = ['svg', 'webp', 'png', 'jpg', 'jpeg', 'avif', 'gif'] as const;

const isImage = (entry: SlotItem): entry is ImageItem => typeof entry === 'object';

function imageIds(work: Work): string[] {
  const ids = new Set<string>();
  for (const item of work.sequence) {
    if (item.kind !== 'unit') continue;
    for (const value of Object.values(item.content)) {
      for (const entry of Array.isArray(value) ? value : [value]) if (isImage(entry)) ids.add(entry.image);
    }
  }
  return [...ids];
}

const exists = (path: string) => stat(path).then((info) => info.isFile(), () => false);

export async function resolveWorkImages(work: Work, systemDir: string, outDir: string): Promise<Work> {
  const issues: string[] = [];
  const found = new Map<string, { from: string; name: string }>();
  for (const id of imageIds(work)) {
    const names = [];
    for (const ext of IMAGE_EXTENSIONS) if (await exists(join(systemDir, IMAGE_DIR, `${id}.${ext}`))) names.push(`${id}.${ext}`);
    if (names.length === 0) issues.push(`缺少图像「${id}」：体系目录 ${join(systemDir, IMAGE_DIR)} 下没有 ${id}.(${IMAGE_EXTENSIONS.join('|')})`);
    else if (names.length > 1) issues.push(`图像「${id}」在 ${join(systemDir, IMAGE_DIR)} 下有多个文件：${names.join('、')}，只保留一个`);
    else found.set(id, { from: join(systemDir, IMAGE_DIR, names[0]!), name: names[0]! });
  }
  if (issues.length) throw new BuildError(issues);
  if (found.size) await mkdir(join(outDir, IMAGE_DIR), { recursive: true });
  for (const { from, name } of found.values()) await copyFile(from, join(outDir, IMAGE_DIR, name));

  const withSrc = (entry: SlotItem): SlotItem => (isImage(entry) ? { ...entry, src: `${IMAGE_DIR}/${found.get(entry.image)!.name}` } : entry);
  return {
    ...work,
    sequence: work.sequence.map((item) =>
      item.kind !== 'unit'
        ? item
        : {
            ...item,
            content: Object.fromEntries(
              Object.entries(item.content).map(([slot, value]) => [slot, Array.isArray(value) ? value.map(withSrc) : withSrc(value)]),
            ),
          },
    ),
  };
}

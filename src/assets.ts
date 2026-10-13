/*
 * Image resolution: every image id a work references (image slot values {image: <id>}) is looked up in the current system directory as <system>/images/<id>.<ext>
 * with ext one of svg, webp, png, jpg, jpeg, avif, gif. Each found file is copied to <outDir>/images/<id>.<ext> and the returned work carries src "images/<id>.<ext>" on those items
 * (the generated index.html sits in outDir). Ids with no file, or with more than one file of different formats, are validation problems: BuildError lists all of them and nothing is copied.
 * Custom fragments (inline or file-backed) may use <img src="images/<id>.<ext>">; the exact file is copied, even when other formats of that id exist. Each id needs a work/library brief (work wins), while fragment alt stays unchanged.
 * Only literal img src references under images/ are collected; quoted/unquoted attributes and tag/attribute case are supported. Comments and script/style text are ignored; external/data URLs are unchanged.
 * Local references must use the image-id vocabulary and supported extensions without subdirectories, query strings or hashes. Resolved files, including symlinks, must stay inside the current system's images/.
 * Missing briefs, missing files and unsafe paths throw BuildError before copying or rendering (CLI exit status 2).
 */
import { copyFile, mkdir, realpath, stat } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { IMAGE_ID } from './library.ts';
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

function fragmentSources(html: string): string[] {
  const sources: string[] = [];
  const tags = /<!--[\s\S]*?-->|<(script|style|textarea|title)\b[^>]*>[\s\S]*?<\/\1\s*>|<([a-z][a-z0-9:-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
  for (const tag of html.matchAll(tags)) {
    if (tag[2]?.toLowerCase() !== 'img') continue;
    for (const attr of tag[3]!.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      if (attr[1]!.toLowerCase() !== 'src') continue;
      const src = attr[2] ?? attr[3] ?? attr[4] ?? '';
      if (src.startsWith(`${IMAGE_DIR}/`)) sources.push(src);
      break;
    }
  }
  return sources;
}

export async function resolveWorkImages(work: Work, systemDir: string, outDir: string): Promise<Work> {
  const issues: string[] = [];
  const found = new Map<string, string>();
  const files = new Map<string, string>();
  const imageDir = join(systemDir, IMAGE_DIR);
  const root = await realpath(imageDir).catch(() => undefined);
  const collectFile = async (name: string, at: string): Promise<void> => {
    if (files.has(name)) return;
    const from = join(imageDir, name);
    const real = await realpath(from).catch(() => undefined);
    if (!real || !await exists(real)) issues.push(`${at}：缺少图像文件 ${from}`);
    else if (!root || !real.startsWith(root + sep)) issues.push(`${at}：图像文件解析后的位置跑出了体系 images/：${from}`);
    else files.set(name, real);
  };
  for (const id of imageIds(work)) {
    const names = [];
    for (const ext of IMAGE_EXTENSIONS) if (await exists(join(systemDir, IMAGE_DIR, `${id}.${ext}`))) names.push(`${id}.${ext}`);
    if (names.length === 0) issues.push(`缺少图像「${id}」：体系目录 ${join(systemDir, IMAGE_DIR)} 下没有 ${id}.(${IMAGE_EXTENSIONS.join('|')})`);
    else if (names.length > 1) issues.push(`图像「${id}」在 ${join(systemDir, IMAGE_DIR)} 下有多个文件：${names.join('、')}，只保留一个`);
    else {
      found.set(id, names[0]!);
      await collectFile(names[0]!, `图像「${id}」`);
    }
  }
  for (const [index, item] of work.sequence.entries()) {
    if (item.kind !== 'custom') continue;
    for (const src of fragmentSources(item.html)) {
      const at = `第 ${index + 1} 项定制片段的图像「${src}」`;
      const name = src.slice(IMAGE_DIR.length + 1);
      const dot = name.lastIndexOf('.');
      const id = name.slice(0, dot);
      const ext = name.slice(dot + 1);
      if (!IMAGE_ID.test(id) || !IMAGE_EXTENSIONS.some((allowed) => allowed === ext)) {
        issues.push(`${at}：路径需要是 images/<图像标识>.<${IMAGE_EXTENSIONS.join('|')}>`);
        continue;
      }
      if (!Object.hasOwn(work.images ?? {}, id)) issues.push(`${at}：图像标识「${id}」不在作品或全库图像简报清单里`);
      await collectFile(name, at);
    }
  }
  if (issues.length) throw new BuildError(issues);
  if (files.size) await mkdir(join(outDir, IMAGE_DIR), { recursive: true });
  for (const [name, from] of files) await copyFile(from, join(outDir, IMAGE_DIR, name));

  const withSrc = (entry: SlotItem): SlotItem => (isImage(entry) ? { ...entry, src: `${IMAGE_DIR}/${found.get(entry.image)!}` } : entry);
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

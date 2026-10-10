/*
 * Image assets referenced by a work: every image slot value {src, alt} whose src is a relative path is resolved against <library>/content and copied to the same relative path in the output directory,
 * so the generated index.html (which sits in the output directory) shows the image. Absolute URLs (http, https, data, file) and root-absolute paths are left alone.
 * A relative src that leaves the content directory or points at a missing file is a validation problem and throws BuildError listing all of them; nothing is copied in that case.
 */
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { BuildError } from './types.ts';
import type { Work } from './work.ts';

const EXTERNAL = /^([a-z][a-z0-9+.-]*:|\/\/|\/)/i;

function imageSources(work: Work): string[] {
  const sources = new Set<string>();
  for (const item of work.sequence) {
    if (item.kind !== 'unit') continue;
    for (const value of Object.values(item.content)) {
      for (const entry of Array.isArray(value) ? value : [value]) {
        if (typeof entry === 'object' && !EXTERNAL.test(entry.src)) sources.add(entry.src);
      }
    }
  }
  return [...sources];
}

export async function copyWorkImages(work: Work, libraryDir: string, outDir: string): Promise<void> {
  const root = resolve(libraryDir, 'content');
  const issues: string[] = [];
  const copies: { from: string; to: string }[] = [];
  for (const src of imageSources(work)) {
    const from = resolve(root, src);
    const inside = relative(root, from);
    if (inside.startsWith('..') || isAbsolute(inside)) {
      issues.push(`图片路径 "${src}" 超出了共享内容目录 ${root}`);
      continue;
    }
    const found = await stat(from).then((info) => info.isFile(), () => false);
    if (!found) issues.push(`图片文件不存在：${from}（图片路径 "${src}" 相对于共享内容目录）`);
    else copies.push({ from, to: join(outDir, inside) });
  }
  if (issues.length) throw new BuildError(issues);
  for (const { from, to } of copies) {
    await mkdir(dirname(to), { recursive: true });
    await copyFile(from, to);
  }
}

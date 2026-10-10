/*
 * Library data shared by all systems, loaded from a library directory: skeleton/<carrier>.json (narrative units and slots) and fonts/manifest.json (font list).
 * Both are plain JSON read at build time; the library directory is a build option so tests can point at a fixture library.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BuildError } from './types.ts';

export interface SlotSpec {
  type: 'text' | 'data' | 'image' | 'action';
  priority: 'primary' | 'secondary' | 'tertiary';
  maxChars: number;
}

export interface UnitSpec {
  label: string;
  slots: Record<string, SlotSpec>;
}

export interface Skeleton {
  carrier: string;
  units: Record<string, UnitSpec>;
}

export interface FontEntry {
  id: string;
  family: string;
  postScriptName: string;
  weight: number;
  file: string;
  license: { name: string; url: string; file: string };
  source: { url: string; sha256: string };
}

export interface FontManifest {
  dir: string;
  fonts: FontEntry[];
}

async function readJson<T>(path: string, what: string): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch (error) {
    throw new BuildError([`无法读取${what}：${path}（${(error as Error).message}）`]);
  }
}

export function loadSkeleton(libraryDir: string, carrier: string): Promise<Skeleton> {
  return readJson<Skeleton>(join(libraryDir, 'skeleton', `${carrier}.json`), `「${carrier}」结构骨架`);
}

export async function loadFontManifest(libraryDir: string): Promise<FontManifest> {
  const dir = join(libraryDir, 'fonts');
  const data = await readJson<{ fonts: FontEntry[] }>(join(dir, 'manifest.json'), '字体清单');
  return { dir, fonts: data.fonts };
}

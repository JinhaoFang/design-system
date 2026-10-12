/* Helpers for format-validation tests: copy the fixture system or library into a temp dir and edit SYSTEM.md, the token file, skeleton files or add files. */
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fixtures, tempDir } from './helpers.ts';

export async function patchedSystem(patch: (dir: string) => Promise<void>): Promise<string> {
  const dir = join(await tempDir('ds-system-'), 'system');
  await cp(fixtures.system, dir, { recursive: true });
  await patch(dir);
  return dir;
}

export async function patchedLibrary(patch: (dir: string) => Promise<void>): Promise<string> {
  const dir = join(await tempDir('ds-library-'), 'library');
  await cp(fixtures.library, dir, { recursive: true });
  await patch(dir);
  return dir;
}

export async function editText(path: string, edit: (text: string) => string): Promise<void> {
  const before = await readFile(path, 'utf8');
  const after = edit(before);
  if (after === before) throw new Error(`test edit changed nothing in ${path}`);
  await writeFile(path, after);
}

export async function editJson(path: string, edit: (json: any) => void): Promise<void> {
  const json = JSON.parse(await readFile(path, 'utf8'));
  edit(json);
  await writeFile(path, JSON.stringify(json, null, 2));
}

export async function writeFileDeep(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

export const systemMd = (dir: string) => join(dir, 'SYSTEM.md');
export const tokensFile = (dir: string) => join(dir, 'system.tokens.json');

export const NS = 'io.github.jinhaofang.design-system';
export const realSkeleton = join(dirname(fixtures.library), '..', '..', 'library', 'skeleton');

export function realSkeletonLibrary(patch: (dir: string) => Promise<void> = async () => {}): Promise<string> {
  return patchedLibrary(async (dir) => {
    await rm(join(dir, 'skeleton'), { recursive: true });
    await cp(realSkeleton, join(dir, 'skeleton'), { recursive: true });
    await patch(dir);
  });
}

export function allCarriersSystem(patch: (dir: string) => Promise<void> = async () => {}): Promise<string> {
  return patchedSystem(async (dir) => {
    await editText(systemMd(dir), (t) => t.replace('  - social\n', '  - web\n  - slides\n  - social\n'));
    await editJson(tokensFile(dir), (j) => {
      j.carrier.web = { ...j.carrier.social, body: { $type: 'dimension', $value: { value: 18, unit: 'px' } } };
      j.carrier.slides = { ...j.carrier.social, body: { $type: 'dimension', $value: { value: 36, unit: 'px' } } };
      const composition = j.$extensions[NS].constraints.composition;
      composition.web = composition.social;
      composition.slides = composition.social;
    });
    await patch(dir);
  });
}

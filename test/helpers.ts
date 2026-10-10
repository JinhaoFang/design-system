/* Test helpers: fixture locations, temp dirs, a work-description patcher and PNG/JSON readers. Tests reach the product only through buildAndCheck. */
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAndCheck } from '../src/build-and-check.ts';
import type { BuildResult } from '../src/build-and-check.ts';

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = join(here, '..');
export const fixtures = {
  library: join(here, 'fixtures', 'library'),
  fontCache: join(here, 'fixtures', 'font-cache'),
  system: join(here, 'fixtures', 'systems', 'mini'),
  work: (name: string) => join(here, 'fixtures', 'works', `${name}.json`),
};

export async function tempDir(prefix = 'ds-test-'): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export async function patchedWork(name: string, patch: (work: any) => void): Promise<string> {
  const work = JSON.parse(await readFile(fixtures.work(name), 'utf8'));
  patch(work);
  const path = join(await tempDir(), `${name}.json`);
  await writeFile(path, JSON.stringify(work));
  return path;
}

export async function run(
  workPath: string,
  options: { libraryDir?: string; systemDir?: string; fontCacheDir?: string } = {},
): Promise<BuildResult> {
  return buildAndCheck({
    systemDir: options.systemDir ?? fixtures.system,
    workPath,
    outDir: await tempDir(),
    libraryDir: options.libraryDir ?? fixtures.library,
    fontCacheDir: options.fontCacheDir ?? fixtures.fontCache,
  });
}

export async function pngSize(path: string): Promise<{ width: number; height: number }> {
  const buf = await readFile(path);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

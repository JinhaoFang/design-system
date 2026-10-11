/* Helper for overview and regression tests: a temp copy of the fixture library whose skeletons and shared content are the real ones (library/skeleton, library/content). */
import { cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { repoRoot } from './helpers.ts';
import { patchedLibrary } from './system-helpers.ts';

export const realContent = join(repoRoot, 'library', 'content');
export const realSkeleton = join(repoRoot, 'library', 'skeleton');

export function overviewLibrary(): Promise<string> {
  return patchedLibrary(async (dir) => {
    await rm(join(dir, 'skeleton'), { recursive: true });
    await cp(realSkeleton, join(dir, 'skeleton'), { recursive: true });
    await cp(realContent, join(dir, 'content'), { recursive: true });
  });
}

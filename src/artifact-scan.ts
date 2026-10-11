/*
 * Artifact scan: finds the built artifacts (directories that hold an index.html) under a root directory, for the system page's links and the preview navigation.
 * scanArtifacts(root) -> entries sorted by relative path ("" is the root itself when it holds an index.html); a directory that holds an index.html is not searched further,
 * hidden directories, node_modules, fonts, images and exemplars are skipped, depth is limited to 6. Each entry carries what its report.json says (system, carrier, canvas, concept, error and warning counts)
 * when the report exists and is readable; an artifact without a report is still listed.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export interface ArtifactEntry {
  rel: string;
  dir: string;
  system?: string;
  carrier?: string;
  canvas?: string;
  concept?: string;
  errors?: number;
  warnings?: number;
}

const SKIPPED = new Set(['node_modules', 'fonts', 'images', 'exemplars']);
const MAX_DEPTH = 6;

async function readReport(dir: string): Promise<Partial<ArtifactEntry>> {
  try {
    const report = JSON.parse(await readFile(join(dir, 'report.json'), 'utf8'));
    return {
      system: report.system,
      carrier: report.work?.carrier,
      canvas: report.work?.canvas,
      concept: report.work?.concept,
      errors: report.summary?.errors,
      warnings: report.summary?.warnings,
    };
  } catch {
    return {};
  }
}

async function visit(root: string, rel: string, depth: number, found: ArtifactEntry[]): Promise<void> {
  const dir = rel === '' ? root : join(root, rel);
  let names: { name: string; directory: boolean }[];
  try {
    names = (await readdir(dir, { withFileTypes: true })).map((entry) => ({ name: entry.name, directory: entry.isDirectory() }));
  } catch {
    return;
  }
  if (names.some((entry) => entry.name === 'index.html' && !entry.directory)) {
    found.push({ rel, dir, ...(await readReport(dir)) });
    return;
  }
  if (depth >= MAX_DEPTH) return;
  for (const entry of names.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (!entry.directory || entry.name.startsWith('.') || SKIPPED.has(entry.name)) continue;
    await visit(root, rel === '' ? entry.name : `${rel}/${entry.name}`, depth + 1, found);
  }
}

export async function scanArtifacts(root: string): Promise<ArtifactEntry[]> {
  const found: ArtifactEntry[] = [];
  await visit(root, '', 0, found);
  return found.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
}

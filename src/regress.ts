/*
 * Regression (回归): builds and checks everything the seed systems must keep passing. Systems directory convention: <systemsDir>/<id>/ is a system directory (SYSTEM.md, system.tokens.json, layouts/, ...)
 * and <systemsDir>/<id>/works/*.json are its standard-sample work descriptions (one file per work; a social work names its canvas, so three canvases are three files).
 * For every system (sub-directories of systemsDir, hidden ones skipped, in name order) it runs buildAndCheck on each sample and buildOverview (overview.ts) on the system, with the shared library.
 * Output under outDir: <id>/works/<file-stem>/ (build output of each sample), <id>/overview/ (see overview.ts) and <id>/system/ (the system page, system-page.ts, linked to the overview and the samples beside it).
 * A system has problems when a sample, overview or system page build has errors, any build fails validation, SYSTEM.md is missing, or there are no samples. exitCode is 1 when any system has problems, else 0;
 * a missing systems directory throws BuildError (usage failure). Every system is processed even when an earlier one has problems.
 * formatRegression renders the result as the text the command prints.
 */
import { access, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { buildAndCheck } from './build-and-check.ts';
import type { CarrierId } from './carriers.ts';
import { buildOverview } from './overview.ts';
import type { OverviewResult } from './overview.ts';
import { buildSystemPage } from './system-page.ts';
import { BuildError } from './types.ts';

export interface RegressOptions {
  systemsDir: string;
  outDir: string;
  libraryDir: string;
  fontCacheDir?: string;
  canvases?: string[];
  carriers?: CarrierId[];
}

export interface SampleOutcome {
  name: string;
  exitCode: 0 | 1;
  errors: number;
  warnings: number;
  outDir: string;
}

export interface SystemOutcome {
  id: string;
  dir: string;
  samples: SampleOutcome[];
  overview?: OverviewResult;
  systemPage?: { exitCode: 0 | 1; errors: number; warnings: number; outDir: string };
  problems: string[];
}

export interface RegressResult {
  exitCode: 0 | 1;
  outDir: string;
  systems: SystemOutcome[];
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function subdirectories(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
      .sort();
  } catch {
    throw new BuildError([`找不到体系目录：${dir}（每套体系放在 <体系目录>/<体系标识>/ 下）`]);
  }
}

async function samplesOf(dir: string): Promise<string[]> {
  try {
    return (await readdir(join(dir, 'works'))).filter((name) => name.endsWith('.json')).sort();
  } catch {
    return [];
  }
}

async function regressSystem(options: RegressOptions, id: string): Promise<SystemOutcome> {
  const dir = join(options.systemsDir, id);
  const outcome: SystemOutcome = { id, dir, samples: [], problems: [] };
  if (!(await exists(join(dir, 'SYSTEM.md')))) {
    outcome.problems.push('缺少 SYSTEM.md，不是体系目录');
    return outcome;
  }
  const files = await samplesOf(dir);
  if (files.length === 0) outcome.problems.push(`没有标准样张作品描述（放在 ${join(dir, 'works')}/*.json）`);
  for (const file of files) {
    const name = file.slice(0, -'.json'.length);
    const sampleOut = join(options.outDir, id, 'works', name);
    try {
      const result = await buildAndCheck({
        systemDir: dir,
        workPath: join(dir, 'works', file),
        outDir: sampleOut,
        libraryDir: options.libraryDir,
        ...(options.fontCacheDir !== undefined && { fontCacheDir: options.fontCacheDir }),
      });
      const { errors, warnings } = result.report.summary;
      outcome.samples.push({ name, exitCode: result.exitCode, errors, warnings, outDir: sampleOut });
      if (errors > 0) outcome.problems.push(`标准样张「${name}」有 ${errors} 个错误（${result.artifacts.reportMarkdown}）`);
    } catch (error) {
      if (!(error instanceof BuildError)) throw error;
      outcome.problems.push(`标准样张「${name}」构建失败：${error.issues.join('；')}`);
    }
  }
  try {
    outcome.overview = await buildOverview({
      systemDir: dir,
      outDir: join(options.outDir, id, 'overview'),
      libraryDir: options.libraryDir,
      ...(options.fontCacheDir !== undefined && { fontCacheDir: options.fontCacheDir }),
      ...(options.canvases && { canvases: options.canvases }),
      ...(options.carriers && { carriers: options.carriers }),
    });
    for (const build of outcome.overview.builds) {
      if (build.result.report.summary.errors > 0) {
        outcome.problems.push(`排法总览「${build.label}」有 ${build.result.report.summary.errors} 个错误（${build.result.artifacts.reportMarkdown}）`);
      }
    }
    for (const failure of outcome.overview.failures) outcome.problems.push(`排法总览「${failure.label}」构建失败：${failure.issues.join('；')}`);
  } catch (error) {
    if (!(error instanceof BuildError)) throw error;
    outcome.problems.push(`排法总览无法生成：${error.issues.join('；')}`);
  }
  const pageOut = join(options.outDir, id, 'system');
  try {
    const page = await buildSystemPage({
      systemDir: dir,
      outDir: pageOut,
      libraryDir: options.libraryDir,
      ...(options.fontCacheDir !== undefined && { fontCacheDir: options.fontCacheDir }),
      overviewDir: join(options.outDir, id, 'overview'),
      worksDir: join(options.outDir, id, 'works'),
    });
    const { errors, warnings } = page.report.summary;
    outcome.systemPage = { exitCode: page.exitCode, errors, warnings, outDir: pageOut };
    if (errors > 0) outcome.problems.push(`体系总览页有 ${errors} 个错误（${page.artifacts.reportMarkdown}）`);
  } catch (error) {
    if (!(error instanceof BuildError)) throw error;
    outcome.problems.push(`体系总览页无法生成：${error.issues.join('；')}`);
  }
  return outcome;
}

export async function regress(options: RegressOptions): Promise<RegressResult> {
  const ids = await subdirectories(options.systemsDir);
  const systems: SystemOutcome[] = [];
  for (const id of ids) systems.push(await regressSystem(options, id));
  return { exitCode: systems.some((system) => system.problems.length > 0) ? 1 : 0, outDir: options.outDir, systems };
}

export function formatRegression(result: RegressResult): string {
  if (result.systems.length === 0) return '体系目录里没有体系，没有可回归的内容。';
  const lines: string[] = [];
  for (const system of result.systems) {
    const builds = system.overview?.builds.length ?? 0;
    lines.push(`${system.problems.length ? '失败' : '通过'}  ${system.id}（${system.samples.length} 份标准样张，${builds} 个排法总览构建，${system.systemPage ? '含' : '无'}体系总览页）`);
    for (const problem of system.problems) lines.push(`  - ${problem}`);
  }
  const failed = result.systems.filter((system) => system.problems.length > 0).length;
  lines.push('', `${result.systems.length} 套体系，${failed} 套有问题。产物目录：${result.outDir}`);
  return lines.join('\n');
}

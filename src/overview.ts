/*
 * Layout overview (排法总览): for any system, generates works that render every layout of every narrative unit once with the shared sample content, and runs buildAndCheck on each.
 * Input: system directory, output directory, library directory (skeleton + shared content), optional carriers (default: all the system declares), social canvases (default: all three), font cache.
 * Works: web and slides get one work each (all units in skeleton order, every layout of a unit one after the other, so a deck has one slide per layout and a page one section per layout);
 * social gets one work per layout per canvas (one image each). Content: the first instance of the unit in the shared content (keys "<unit>.<slot>" or "<unit>.<instance>.<slot>"), as {"ref": key}.
 * Output under outDir: <carrier>/ (web, slides: work.json plus the build output), social/<canvas>/<unit>-<layout>/ (same), and overview.md listing every build with its error and warning counts.
 * Units the system has no layouts for, or the shared content does not cover, are returned in `uncovered` (not an error). A build that fails validation is returned in `failures` and makes the exit status 1.
 * Result exitCode: 0 = no build has errors and none failed; 1 otherwise.
 */
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildAndCheck, validateSystem } from './build-and-check.ts';
import type { BuildResult } from './build-and-check.ts';
import { CARRIERS, SOCIAL_CANVASES } from './carriers.ts';
import type { CarrierId } from './carriers.ts';
import { loadSharedContent } from './library.ts';
import type { SharedValue, Skeleton } from './library.ts';
import { BuildError } from './types.ts';

export interface OverviewOptions {
  systemDir: string;
  outDir: string;
  libraryDir: string;
  fontCacheDir?: string;
  carriers?: CarrierId[];
  canvases?: string[];
}

export interface OverviewBuild {
  carrier: CarrierId;
  canvas?: string;
  unit?: string;
  layout?: string;
  label: string;
  workPath: string;
  outDir: string;
  result: BuildResult;
}

export interface OverviewFailure {
  label: string;
  issues: string[];
}

export interface OverviewUncovered {
  carrier: CarrierId;
  unit: string;
  reason: string;
}

export interface OverviewResult {
  exitCode: 0 | 1;
  builds: OverviewBuild[];
  failures: OverviewFailure[];
  uncovered: OverviewUncovered[];
  summary: string;
}

interface Plan {
  carrier: CarrierId;
  label: string;
  dir: string;
  canvas?: string;
  unit?: string;
  layout?: string;
  work: unknown;
}

export function firstInstanceRefs(unit: string, slots: string[], content: Record<string, SharedValue>): Record<string, { ref: string }> {
  let chosen: string | undefined;
  const refs: Record<string, { ref: string }> = {};
  for (const key of Object.keys(content)) {
    const parts = key.split('.');
    if (parts[0] !== unit || (parts.length !== 2 && parts.length !== 3)) continue;
    const slot = parts[parts.length - 1]!;
    const instance = parts.length === 3 ? parts[1]! : '';
    if (!slots.includes(slot)) continue;
    chosen ??= instance;
    if (instance === chosen) refs[slot] = { ref: key };
  }
  return refs;
}

export async function layoutsOf(systemDir: string, carrier: string, unit: string): Promise<string[]> {
  try {
    return (await readdir(join(systemDir, 'layouts', carrier, unit)))
      .filter((name) => name.endsWith('.liquid'))
      .map((name) => name.slice(0, -'.liquid'.length))
      .sort();
  } catch {
    return [];
  }
}

async function planCarrier(
  options: OverviewOptions,
  systemId: string,
  carrier: CarrierId,
  skeleton: Skeleton,
  uncovered: OverviewUncovered[],
): Promise<Plan[]> {
  const content = await loadSharedContent(options.libraryDir, carrier);
  if (!content) throw new BuildError([`全库没有「${carrier}」的共享内容，无法生成排法总览：${join(options.libraryDir, 'content', `${carrier}.json`)}`]);
  const entries: { unit: string; layout: string; content: Record<string, { ref: string }> }[] = [];
  for (const [unit, spec] of Object.entries(skeleton.units)) {
    const layouts = await layoutsOf(options.systemDir, carrier, unit);
    if (layouts.length === 0) {
      uncovered.push({ carrier, unit, reason: '体系没有这个单元的排法' });
      continue;
    }
    const refs = firstInstanceRefs(unit, Object.keys(spec.slots), content);
    if (Object.keys(refs).length === 0) {
      uncovered.push({ carrier, unit, reason: '共享内容里没有这个单元的内容' });
      continue;
    }
    for (const layout of layouts) entries.push({ unit, layout, content: refs });
  }
  if (entries.length === 0) return [];
  const concept = `排法总览：${systemId}（${CARRIERS[carrier].label}）`;
  if (carrier !== 'social') {
    return [
      {
        carrier,
        label: `${carrier}（${entries.length} 种排法）`,
        dir: join(options.outDir, carrier),
        work: { system: systemId, carrier, concept, sequence: entries.map((entry) => ({ unit: entry.unit, layout: entry.layout, content: entry.content })) },
      },
    ];
  }
  const canvases = options.canvases ?? Object.keys(SOCIAL_CANVASES);
  const plans: Plan[] = [];
  for (const canvas of canvases) {
    for (const entry of entries) {
      plans.push({
        carrier,
        canvas,
        unit: entry.unit,
        layout: entry.layout,
        label: `social ${canvas} ${entry.unit}/${entry.layout}`,
        dir: join(options.outDir, 'social', canvas, `${entry.unit}-${entry.layout}`),
        work: { system: systemId, carrier, canvas, concept, sequence: [{ unit: entry.unit, layout: entry.layout, content: entry.content }] },
      });
    }
  }
  return plans;
}

function summaryMarkdown(systemId: string, result: Omit<OverviewResult, 'summary' | 'exitCode'>): string {
  const lines = [`# 排法总览：${systemId}`, '', '| 载体 | 构建 | 错误 | 警告 | 报告 |', '| --- | --- | --- | --- | --- |'];
  for (const build of result.builds) {
    const { errors, warnings } = build.result.report.summary;
    lines.push(`| ${build.carrier} | ${build.label} | ${errors} | ${warnings} | ${build.result.artifacts.reportMarkdown} |`);
  }
  lines.push('');
  if (result.failures.length) {
    lines.push('## 构建失败', '');
    for (const failure of result.failures) lines.push(`- ${failure.label}：${failure.issues.join('；')}`);
    lines.push('');
  }
  if (result.uncovered.length) {
    lines.push('## 未覆盖的单元', '');
    for (const entry of result.uncovered) lines.push(`- ${entry.carrier} / ${entry.unit}：${entry.reason}`);
    lines.push('');
  }
  const errors = result.builds.reduce((sum, build) => sum + build.result.report.summary.errors, 0);
  const warnings = result.builds.reduce((sum, build) => sum + build.result.report.summary.warnings, 0);
  lines.push(`合计：${errors} 个错误，${warnings} 个警告，${result.failures.length} 个构建失败。`, '');
  return lines.join('\n');
}

export async function buildOverview(options: OverviewOptions): Promise<OverviewResult> {
  const system = await validateSystem({ systemDir: options.systemDir, libraryDir: options.libraryDir });
  const carriers = options.carriers ?? system.meta.carriers;
  const unsupported = carriers.filter((carrier) => !system.skeletons[carrier]);
  if (unsupported.length) {
    throw new BuildError([`体系「${system.meta.id}」不支持载体 ${unsupported.join('、')}，它支持：${system.meta.carriers.join('、')}`]);
  }
  const uncovered: OverviewUncovered[] = [];
  const plans: Plan[] = [];
  for (const carrier of carriers) plans.push(...(await planCarrier(options, system.meta.id, carrier, system.skeletons[carrier]!, uncovered)));

  const builds: OverviewBuild[] = [];
  const failures: OverviewFailure[] = [];
  for (const plan of plans) {
    await mkdir(plan.dir, { recursive: true });
    const workPath = join(plan.dir, 'work.json');
    await writeFile(workPath, `${JSON.stringify(plan.work, null, 2)}\n`);
    try {
      const result = await buildAndCheck({
        systemDir: options.systemDir,
        workPath,
        outDir: plan.dir,
        libraryDir: options.libraryDir,
        ...(options.fontCacheDir !== undefined && { fontCacheDir: options.fontCacheDir }),
      });
      builds.push({
        carrier: plan.carrier,
        ...(plan.canvas !== undefined && { canvas: plan.canvas }),
        ...(plan.unit !== undefined && { unit: plan.unit }),
        ...(plan.layout !== undefined && { layout: plan.layout }),
        label: plan.label,
        workPath,
        outDir: plan.dir,
        result,
      });
    } catch (error) {
      if (!(error instanceof BuildError)) throw error;
      failures.push({ label: plan.label, issues: error.issues });
    }
  }
  const summary = join(options.outDir, 'overview.md');
  await mkdir(options.outDir, { recursive: true });
  await writeFile(summary, summaryMarkdown(system.meta.id, { builds, failures, uncovered }));
  const failed = failures.length > 0 || builds.some((build) => build.result.exitCode !== 0);
  return { exitCode: failed ? 1 : 0, builds, failures, uncovered, summary };
}

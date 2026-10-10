/*
 * The build-and-check pipeline (the product's one entry point): validate -> tokens to CSS -> render layouts to HTML -> render PNG -> run rules -> write report.
 * Input: system directory, work description file, output directory, library directory (skeleton + font list).
 * Output files in outDir: index.html, fonts/, social-<canvas>.png, report.json, report.md. Returns the Report, artifact paths and the exit status (0 = no errors, 1 = errors found).
 * Validation problems (bad system, work or fonts) throw BuildError before or during rendering and produce no report.
 */
import { access, copyFile, mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { ALL_RULES } from './checker/rules/index.ts';
import { runRules } from './checker/registry.ts';
import { SOCIAL_CANVASES } from './carriers.ts';
import { loadFontManifest, loadSkeleton } from './library.ts';
import { renderUnit } from './layout.ts';
import { buildPage } from './page.ts';
import { renderImage } from './render.ts';
import { exitCodeFor, makeReport, reportToMarkdown } from './report.ts';
import { loadTokens } from './tokens.ts';
import { BuildError } from './types.ts';
import type { Report } from './types.ts';
import { loadWork, validateWork } from './work.ts';

export interface BuildOptions {
  systemDir: string;
  workPath: string;
  outDir: string;
  libraryDir: string;
}

export interface BuildResult {
  exitCode: 0 | 1;
  report: Report;
  artifacts: { outDir: string; index: string; images: string[]; reportJson: string; reportMarkdown: string };
}

async function requireFile(path: string, what: string): Promise<void> {
  try {
    await access(path);
  } catch {
    throw new BuildError([`体系缺少${what}：${path}`]);
  }
}

export async function buildAndCheck(options: BuildOptions): Promise<BuildResult> {
  const { systemDir, workPath, outDir, libraryDir } = options;
  await requireFile(join(systemDir, 'SYSTEM.md'), 'SYSTEM.md');
  await requireFile(join(systemDir, 'system.tokens.json'), '数值文件 system.tokens.json');

  const work = await loadWork(workPath);
  const skeleton = await loadSkeleton(libraryDir, work.carrier);
  validateWork(work, skeleton);
  const tokens = await loadTokens(join(systemDir, 'system.tokens.json'), work.carrier);
  const manifest = await loadFontManifest(libraryDir);
  const usedFonts = tokens.fontIds.map((id) => {
    const font = manifest.fonts.find((entry) => entry.id === id);
    if (!font) throw new BuildError([`数值文件引用的字体 "${id}" 不在字体清单里`]);
    return font;
  });

  const unitsHtml: string[] = [];
  for (const item of work.sequence) {
    unitsHtml.push(await renderUnit(systemDir, work.carrier, item, skeleton.units[item.unit]!));
  }

  const size = SOCIAL_CANVASES[work.canvas];
  await mkdir(join(outDir, 'fonts'), { recursive: true });
  for (const font of usedFonts) {
    try {
      await copyFile(join(manifest.dir, font.file), join(outDir, 'fonts', font.file));
    } catch {
      throw new BuildError([`字体文件不存在：${join(manifest.dir, font.file)}`]);
    }
  }
  const index = join(outDir, 'index.html');
  await writeFile(
    index,
    buildPage({ title: work.concept, cssVars: tokens.cssVars, fonts: usedFonts, ...size, unitsHtml }),
  );

  const png = join(outDir, `social-${work.canvas}.png`);
  const snapshot = await renderImage(index, size, png);

  const findings = runRules(ALL_RULES, { snapshot, work, tokens });
  const report = makeReport(
    { system: basename(systemDir), work: { concept: work.concept, carrier: work.carrier, canvas: work.canvas } },
    findings,
  );
  const reportJson = join(outDir, 'report.json');
  const reportMarkdown = join(outDir, 'report.md');
  await writeFile(reportJson, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(reportMarkdown, reportToMarkdown(report));

  return { exitCode: exitCodeFor(report), report, artifacts: { outDir, index, images: [png], reportJson, reportMarkdown } };
}

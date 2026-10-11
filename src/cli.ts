/*
 * Command line entry: node src/cli.ts build --system <dir> --work <file> --out <dir> [--library <dir>] [--font-cache <dir>]
 *                     node src/cli.ts validate-system --system <dir> [--library <dir>]   (only the system validation stage; nothing is rendered)
 *                     node src/cli.ts fetch-fonts [--library <dir>] [--font-cache <dir>] [--font <id>...]   (download the font list into the local font cache, verify checksums)
 *                     node src/cli.ts overview --system <dir> --out <dir> [--library <dir>] [--font-cache <dir>] [--carrier <id>...] [--canvas <id>...]   (layout overview: every layout of every unit once, built and checked)
 *                     node src/cli.ts regress [--systems <dir>] [--out <dir>] [--library <dir>] [--font-cache <dir>]   (every system under <systems>/<id>/: its works/*.json and its layout overview; exit 1 on any error)
 *                     node src/cli.ts validate-exemplars [--library <dir>]   (exemplar library completeness; see exemplar-command.ts)
 *                     node src/cli.ts list-exemplars [--source external|copy|original] [--paths] [--library <dir>]
 * Exit status: 0 = built / valid / fetched, no errors in the report; 1 = the report has errors; 2 = usage problem or validation failure (reason on stderr, no report).
 * overview and regress exit like build: 0 = no errors, 1 = some build has errors, 2 = usage problem or a validation failure that stops the whole command.
 * --font-cache defaults to .cache/fonts (git-ignored); --systems defaults to systems, --out of regress to out/regress.
 */
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildAndCheck, validateSystem } from './build-and-check.ts';
import { fetchFonts } from './fetch-fonts.ts';
import { CARRIERS, SOCIAL_CANVASES } from './carriers.ts';
import type { CarrierId } from './carriers.ts';
import { DEFAULT_FONT_CACHE } from './fonts.ts';
import { buildOverview } from './overview.ts';
import { formatRegression, regress } from './regress.ts';
import { EXEMPLAR_COMMANDS, exemplarCommand } from './exemplar-command.ts';
import { BuildError } from './types.ts';

const USAGE = [
  'usage: node src/cli.ts build --system <dir> --work <file> --out <dir> [--library <dir>] [--font-cache <dir>]',
  '       node src/cli.ts validate-system --system <dir> [--library <dir>]',
  '       node src/cli.ts fetch-fonts [--library <dir>] [--font-cache <dir>] [--font <id>...]',
  '       node src/cli.ts overview --system <dir> --out <dir> [--library <dir>] [--font-cache <dir>] [--carrier <id>...] [--canvas <id>...]',
  '       node src/cli.ts regress [--systems <dir>] [--out <dir>] [--library <dir>] [--font-cache <dir>]',
  '       node src/cli.ts validate-exemplars [--library <dir>]',
  '       node src/cli.ts list-exemplars [--source external|copy|original] [--paths] [--library <dir>]',
].join('\n');

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  const commands = ['build', 'validate-system', 'fetch-fonts', 'overview', 'regress'];
  if (command !== undefined && EXEMPLAR_COMMANDS.includes(command)) {
    return exemplarCommand(command, rest);
  }
  if (!command || !commands.includes(command)) {
    console.error(USAGE);
    return 2;
  }
  const { values } = parseArgs({
    args: rest,
    options: {
      system: { type: 'string' },
      work: { type: 'string' },
      out: { type: 'string' },
      library: { type: 'string', default: 'library' },
      'font-cache': { type: 'string', default: DEFAULT_FONT_CACHE },
      font: { type: 'string', multiple: true },
      carrier: { type: 'string', multiple: true },
      canvas: { type: 'string', multiple: true },
      systems: { type: 'string', default: 'systems' },
    },
  });
  const needsSystem = command === 'build' || command === 'validate-system' || command === 'overview';
  const needsOut = command === 'build' || command === 'overview';
  if ((needsSystem && !values.system) || (needsOut && !values.out) || (command === 'build' && !values.work)) {
    console.error(USAGE);
    return 2;
  }
  const carriers = values.carrier as CarrierId[] | undefined;
  const unknown = [
    ...(carriers ?? []).filter((id) => !(id in CARRIERS)).map((id) => `未知载体 ${id}`),
    ...(values.canvas ?? []).filter((id) => !(id in SOCIAL_CANVASES)).map((id) => `未知画幅 ${id}`),
  ];
  if (unknown.length) {
    console.error(`${unknown.join('；')}\n${USAGE}`);
    return 2;
  }
  try {
    if (command === 'overview') {
      const result = await buildOverview({
        systemDir: resolve(values.system!),
        outDir: resolve(values.out!),
        libraryDir: resolve(values.library),
        fontCacheDir: resolve(values['font-cache']),
        ...(carriers && { carriers }),
        ...(values.canvas && { canvases: values.canvas }),
      });
      const errors = result.builds.reduce((sum, build) => sum + build.result.report.summary.errors, 0);
      const warnings = result.builds.reduce((sum, build) => sum + build.result.report.summary.warnings, 0);
      console.log(`${result.builds.length} 个构建，${errors} 个错误，${warnings} 个警告，${result.failures.length} 个构建失败，${result.uncovered.length} 个单元未覆盖。`);
      for (const failure of result.failures) console.error(`构建失败 ${failure.label}：${failure.issues.join('；')}`);
      console.log(`汇总：${result.summary}`);
      return result.exitCode;
    }
    if (command === 'regress') {
      const result = await regress({
        systemsDir: resolve(values.systems),
        outDir: resolve(values.out ?? 'out/regress'),
        libraryDir: resolve(values.library),
        fontCacheDir: resolve(values['font-cache']),
      });
      console.log(formatRegression(result));
      return result.exitCode;
    }
    if (command === 'fetch-fonts') {
      const result = await fetchFonts({
        libraryDir: resolve(values.library),
        fontCacheDir: resolve(values['font-cache']),
        ...(values.font && { ids: values.font }),
      });
      console.log(`已下载 ${result.fetched.length} 款，本地缓存已有 ${result.cached.length} 款。缓存目录：${resolve(values['font-cache'])}`);
      return 0;
    }
    if (command === 'validate-system') {
      const system = await validateSystem({ systemDir: resolve(values.system!), libraryDir: resolve(values.library) });
      console.log(`体系「${system.meta.name}」（${system.meta.id}）校验通过。`);
      return 0;
    }
    const result = await buildAndCheck({
      systemDir: resolve(values.system!),
      workPath: resolve(values.work!),
      outDir: resolve(values.out!),
      libraryDir: resolve(values.library),
      fontCacheDir: resolve(values['font-cache']),
    });
    const { errors, warnings } = result.report.summary;
    console.log(`${errors} 个错误，${warnings} 个警告。产物目录：${result.artifacts.outDir}`);
    console.log(`报告：${result.artifacts.reportMarkdown}`);
    return result.exitCode;
  } catch (error) {
    if (error instanceof BuildError) {
      console.error(`构建失败：\n- ${error.issues.join('\n- ')}`);
      return 2;
    }
    throw error;
  }
}

process.exitCode = await main(process.argv.slice(2));

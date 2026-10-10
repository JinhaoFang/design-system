/*
 * Command line entry. Subcommands:
 *   build --system <dir> --work <file> --out <dir> [--library <dir>]
 *     Exit 0 = built, no errors in the report; 1 = the report has errors; 2 = usage problem or validation failure (reason on stderr, no report).
 *   validate-exemplars [--library <dir>]
 *     Exit 0 = every exemplar is complete; 1 = problems listed on stderr; 2 = usage problem.
 *   list-exemplars [--source external|copy|original] [--paths] [--library <dir>]
 *     Prints id, source type, approval status, carrier, source link, media file (tab separated); --paths prints only the media files that exist.
 * Later tickets add validate-system, fetch-fonts and regress here.
 */
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildAndCheck } from './build-and-check.ts';
import { SOURCE_TYPES, listExemplars, validateExemplars } from './exemplars.ts';
import type { SourceType } from './exemplars.ts';
import { BuildError } from './types.ts';

const USAGE = [
  'usage: node src/cli.ts build --system <dir> --work <file> --out <dir> [--library <dir>]',
  '       node src/cli.ts validate-exemplars [--library <dir>]',
  '       node src/cli.ts list-exemplars [--source external|copy|original] [--paths] [--library <dir>]',
].join('\n');

async function exemplarCommand(command: string, rest: string[]): Promise<number> {
  const { values } = parseArgs({
    args: rest,
    options: {
      library: { type: 'string', default: 'library' },
      source: { type: 'string' },
      paths: { type: 'boolean', default: false },
    },
  });
  const libraryDir = resolve(values.library);
  if (command === 'validate-exemplars') {
    const { count, issues } = await validateExemplars(libraryDir);
    if (issues.length > 0) {
      console.error(`范例校验未通过（${issues.length} 个问题）：\n- ${issues.join('\n- ')}`);
      return 1;
    }
    console.log(`${count} 条范例，校验通过。`);
    return 0;
  }
  if (values.source !== undefined && !(values.source in SOURCE_TYPES)) {
    console.error(`未知的来源类型「${values.source}」，可选：${Object.keys(SOURCE_TYPES).join(' / ')}`);
    return 2;
  }
  const entries = await listExemplars(libraryDir, values.source as SourceType | undefined);
  for (const entry of entries) {
    if (values.paths) {
      if (entry.mediaFile !== null) console.log(entry.mediaFile);
    } else {
      const fields = [entry.id, entry.sourceType, entry.approvalStatus, entry.carrier, entry.sourceUrl ?? '', entry.mediaFile ?? ''];
      console.log(fields.join('\t'));
    }
  }
  return 0;
}

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  if (command === 'validate-exemplars' || command === 'list-exemplars') {
    return exemplarCommand(command, rest);
  }
  if (command !== 'build') {
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
    },
  });
  if (!values.system || !values.work || !values.out) {
    console.error(USAGE);
    return 2;
  }
  try {
    const result = await buildAndCheck({
      systemDir: resolve(values.system),
      workPath: resolve(values.work),
      outDir: resolve(values.out),
      libraryDir: resolve(values.library),
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

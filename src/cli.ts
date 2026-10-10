/*
 * Command line entry: node src/cli.ts build --system <dir> --work <file> --out <dir> [--library <dir>]
 * Exit status: 0 = built, no errors in the report; 1 = the report has errors; 2 = usage problem or validation failure (reason on stderr, no report).
 * Only the build subcommand exists so far; later tickets add validate-system, fetch-fonts and regress here.
 */
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildAndCheck } from './build-and-check.ts';
import { BuildError } from './types.ts';

const USAGE = 'usage: node src/cli.ts build --system <dir> --work <file> --out <dir> [--library <dir>]';

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
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

/*
 * Command line entry: node src/cli.ts build --system <dir> --work <file> --out <dir> [--library <dir>]
 *                     node src/cli.ts validate-system --system <dir> [--library <dir>]   (only the system validation stage; nothing is rendered)
 * Exit status: 0 = built / valid, no errors in the report; 1 = the report has errors; 2 = usage problem or validation failure (reason on stderr, no report).
 * Later tickets add fetch-fonts and regress here.
 */
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildAndCheck, validateSystem } from './build-and-check.ts';
import { BuildError } from './types.ts';

const USAGE = [
  'usage: node src/cli.ts build --system <dir> --work <file> --out <dir> [--library <dir>]',
  '       node src/cli.ts validate-system --system <dir> [--library <dir>]',
].join('\n');

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  if (command !== 'build' && command !== 'validate-system') {
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
  if (!values.system || (command === 'build' && (!values.work || !values.out))) {
    console.error(USAGE);
    return 2;
  }
  try {
    if (command === 'validate-system') {
      const system = await validateSystem({ systemDir: resolve(values.system), libraryDir: resolve(values.library) });
      console.log(`体系「${system.meta.name}」（${system.meta.id}）校验通过。`);
      return 0;
    }
    const result = await buildAndCheck({
      systemDir: resolve(values.system),
      workPath: resolve(values.work!),
      outDir: resolve(values.out!),
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

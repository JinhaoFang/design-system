/*
 * Shared CLI contract for repository checks. Commands pass a synopsis and an
 * argv handler returning all violation messages; assign the returned code to
 * process.exitCode. --help prints usage without running the handler. Throw
 * usageError for invalid arguments, or use node:util parseArgs (its argument
 * errors are translated here). Usage/runtime errors use 2, violations use 1,
 * and a clean check uses 0. Diagnostics are Chinese and go to stderr.
 */
class UsageError extends Error {}

export function usageError(message: string): Error {
  return new UsageError(message);
}

export function errorMessage(error: unknown): string {
  const detail = error as NodeJS.ErrnoException | null | undefined;
  if (detail?.code === 'ENOENT') {
    return `文件或程序不存在：${detail.path ?? detail.syscall ?? '未知路径'}`;
  }
  if (detail?.code === 'EACCES' || detail?.code === 'EPERM') {
    return `没有访问权限：${detail.path ?? '请检查文件权限'}`;
  }
  if (detail?.code === 'EISDIR') {
    return `需要文件，不能使用目录：${detail.path ?? '输入路径'}`;
  }
  if (detail?.code?.startsWith('ERR_PARSE_ARGS_')) {
    return '参数无效，请检查选项和参数。';
  }
  if (detail?.code) {
    return `运行失败（${detail.code}）：${detail.path ?? '请检查输入和运行环境'}`;
  }
  if (error instanceof SyntaxError) {
    return '数据格式无效，请检查输入或外部程序返回的数据。';
  }
  const message = error instanceof Error ? error.message : String(error);
  return /\p{Script=Han}/u.test(message) ? message : '运行失败，请检查输入和运行环境。';
}

export async function runCheckCommand(
  usage: string,
  check: (args: string[]) => readonly string[] | Promise<readonly string[]>,
  args: string[] = process.argv.slice(2),
): Promise<number> {
  if (args.length === 1 && args[0] === '--help') {
    console.log(`用法：${usage}`);
    return 0;
  }
  try {
    const issues = await check(args);
    if (issues.length === 0) return 0;
    console.error(`检查未通过：\n- ${issues.join('\n- ')}`);
    return 1;
  } catch (error) {
    console.error(`出错：${errorMessage(error)}`);
    const detail = error as NodeJS.ErrnoException | null | undefined;
    if (error instanceof UsageError || detail?.code?.startsWith('ERR_PARSE_ARGS_')) {
      console.error(`用法：${usage}`);
    }
    return 2;
  }
}

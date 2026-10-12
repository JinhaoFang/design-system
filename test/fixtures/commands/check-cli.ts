/* Minimal command exercising the shared CLI contract through a real process. */
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { runCheckCommand, usageError } from '../../../scripts/cli.ts';

process.exitCode = await runCheckCommand('check-cli --mode clean|violation|runtime [--help]', async (args) => {
  const { values } = parseArgs({ args, options: { mode: { type: 'string' } } });
  if (!values.mode) throw usageError('缺少 --mode 参数。');
  if (values.mode === 'violation') return ['夹具文件:1 第一项违规。', '夹具文件:2 第二项违规。'];
  if (values.mode === 'runtime') await readFile(new URL('./missing-input.json', import.meta.url));
  else if (values.mode !== 'clean') throw usageError(`未知模式：${values.mode}`);
  return [];
});

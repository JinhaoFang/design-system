/*
 * CLI handlers for the feeling-word lexicon: validate-lexicon and list-lexicon (data format and rules live in lexicon.ts).
 * validate-lexicon [--library <dir>]: exit 0 = every entry complete; 1 = problems on stderr.
 * list-lexicon [--status candidate|approved|rejected] [--system <seed system id>|临时方向] [--library <dir>]: one tab-separated line per interpretation (entry id, word, interpretation, recommended system, approval status, sample exemplar ids or 待补); exit 2 on an unknown status or system.
 */
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { APPROVAL_STATUSES } from './exemplars.ts';
import { SEED_SYSTEMS, TEMPORARY_DIRECTION, listLexicon, validateLexicon } from './lexicon.ts';
import type { LexiconApprovalStatus } from './lexicon.ts';

export { LEXICON_COMMANDS } from './cli-commands.ts';

export async function lexiconCommand(command: string, args: string[]): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      library: { type: 'string', default: 'library' },
      status: { type: 'string' },
      system: { type: 'string' },
    },
  });
  const libraryDir = resolve(values.library);
  if (command === 'validate-lexicon') {
    const { count, issues } = await validateLexicon(libraryDir);
    if (issues.length > 0) {
      console.error(`词典校验未通过（${issues.length} 个问题）：\n- ${issues.join('\n- ')}`);
      return 1;
    }
    console.log(`${count} 个词条，校验通过。`);
    return 0;
  }
  if (values.status !== undefined && !(values.status in APPROVAL_STATUSES)) {
    console.error(`未知的确认状态「${values.status}」，可选：${Object.keys(APPROVAL_STATUSES).join(' / ')}`);
    return 2;
  }
  const systems: string[] = [...SEED_SYSTEMS, TEMPORARY_DIRECTION];
  if (values.system !== undefined && !systems.includes(values.system)) {
    console.error(`未知的体系「${values.system}」，可选：${systems.join(' / ')}`);
    return 2;
  }
  const rows = await listLexicon(libraryDir, {
    status: values.status as LexiconApprovalStatus | undefined,
    system: values.system,
  });
  for (const row of rows) {
    const samples = row.samples.length > 0 ? row.samples.join(',') : '待补';
    console.log([row.id, row.word, row.interpretation, row.system, row.approvalStatus, samples].join('\t'));
  }
  return 0;
}

/*
 * CLI handlers for the exemplar library: validate-exemplars and list-exemplars (data format and rules live in exemplars.ts).
 * validate-exemplars [--library <dir>]: exit 0 = every exemplar complete; 1 = problems on stderr; 2 = usage problem.
 * list-exemplars [--source external|copy|original] [--paths] [--library <dir>]: one tab-separated line per exemplar (id, source type, approval status, carrier, source link, media file); --paths prints only media files that exist.
 */
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { SOURCE_TYPES, listExemplars, validateExemplars } from './exemplars.ts';
import type { SourceType } from './exemplars.ts';

export const EXEMPLAR_COMMANDS = ['validate-exemplars', 'list-exemplars'];

export async function exemplarCommand(command: string, args: string[]): Promise<number> {
  const { values } = parseArgs({
    args,
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

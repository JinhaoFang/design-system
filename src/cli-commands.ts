/*
 * Shared ds command registry. The JSON contains only command names grouped by
 * handler; the document checker reads that same data without importing the CLI.
 */
import { readFileSync } from 'node:fs';

const commands: { core: string[]; exemplars: string[]; lexicon: string[] } = JSON.parse(
  readFileSync(new URL('./cli-commands.json', import.meta.url), 'utf8'),
);

export const CORE_COMMANDS = commands.core;
export const EXEMPLAR_COMMANDS = commands.exemplars;
export const LEXICON_COMMANDS = commands.lexicon;

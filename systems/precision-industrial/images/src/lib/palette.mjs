/*
 * Colour tables for the precision-industrial image scripts.
 * HEX: the colours of system.tokens.json (read from the file, so a token change flows through); used by standalone images/<id>.svg, which cannot see page CSS variables.
 * VAR: the same keys as var(--ds-color-*) references, used by the SVG that is inlined into fragments, so fragments only ever name tokens.
 * paletteFor(kind) returns one of the two tables; every drawing function takes a palette so it renders in both contexts.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const tokensFile = fileURLToPath(new URL('../../../system.tokens.json', import.meta.url));
const tokens = JSON.parse(readFileSync(tokensFile, 'utf8'));

export const HEX = Object.fromEntries(Object.entries(tokens.color).filter(([key]) => !key.startsWith('$')).map(([key, value]) => [key, value.$value.hex]));

export const VAR = Object.fromEntries(Object.keys(HEX).map((key) => [key, `var(--ds-color-${key})`]));

export const paletteFor = (kind) => (kind === 'var' ? VAR : HEX);

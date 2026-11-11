/*
 * Entry point: regenerates every code-drawn asset of the cut-paper system. Run from the repository root:
 *   node systems/cut-paper/images/src/build.mjs
 * Writes the five test-content partner marks images/mark-*.svg (art/marks.mjs), the sixteen web layouts layouts/web/<unit>/<id>.liquid (works/layouts.mjs)
 * and the showcase「栖桐植物园百年」custom fragments works/fragments/*.html (works/qitong.mjs); all are build products, overwritten on every run.
 * Leaves are inline svg inside layouts and fragments (lib/leaves.mjs, art/arrange.mjs), so each leaf can enter on its own. The four test-content scenes are generated pictures: see images/src/prompts/README.md.
 * Needs the font cache (pnpm ds fetch-fonts, or .cache/fonts linked in) because mark names are outlined from the real font. Deterministic: two runs give identical bytes.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { marks } from './art/marks.mjs';
import { LAYOUTS } from './works/layouts.mjs';
import { FRAGMENTS } from './works/qitong.mjs';

const at = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const tokens = JSON.parse(readFileSync(at('../../system.tokens.json'), 'utf8'));
const hex = Object.fromEntries(Object.entries(tokens.color).filter(([k]) => !k.startsWith('$')).map(([k, v]) => [k, v.$value.hex]));

export function buildAll() {
  const written = [];
  for (const [id, svg] of Object.entries(marks(hex))) {
    writeFileSync(at(`../${id}.svg`), svg);
    written.push(`images/${id}.svg`);
  }
  for (const [id, text] of Object.entries(LAYOUTS)) {
    mkdirSync(at(`../../layouts/web/${id.split('/')[0]}/`), { recursive: true });
    writeFileSync(at(`../../layouts/web/${id}.liquid`), text);
    written.push(`layouts/web/${id}.liquid`);
  }
  mkdirSync(at('../../works/fragments/'), { recursive: true });
  for (const [name, text] of Object.entries(FRAGMENTS)) {
    writeFileSync(at(`../../works/fragments/${name}`), text);
    written.push(`works/fragments/${name}`);
  }
  return written;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(buildAll().join('\n'));

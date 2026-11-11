/*
 * Entry point: regenerates every code-drawn asset of the oil-halftone system. Run from the repository root:
 *   node systems/oil-halftone/images/src/build.mjs
 * Writes the five test-content partner marks images/mark-*.svg (art/marks.mjs), the sixteen web layouts layouts/web/<unit>/<id>.liquid (works/layouts.mjs)
 * and the showcase「乡音库」custom fragments works/fragments/*.html (works/xiangyin.mjs); all are build products, overwritten on every run.
 * Oil paintings are generated pictures, not made here: see images/src/prompts/README.md and finish.mjs.
 * Needs the font cache (pnpm ds fetch-fonts, or .cache/fonts linked in) because mark names and the transcript waveform labels are outlined from the real fonts. Deterministic: two runs give identical bytes.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { marks } from './art/marks.mjs';
import { LAYOUTS } from './works/layouts.mjs';
import { FRAGMENTS, IMAGES } from './works/xiangyin.mjs';

const at = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const tokens = JSON.parse(readFileSync(at('../../system.tokens.json'), 'utf8'));

export function buildAll() {
  const written = [];
  const images = { ...marks(tokens.color.ink.$value.hex), ...IMAGES(tokens) };
  for (const [id, svg] of Object.entries(images)) {
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

/*
 * Entry point: regenerates every code-drawn asset of the riso-print system. Run from the repository root:
 *   node systems/riso-print/images/src/build.mjs
 * Writes the nine standard-sample images images/<id>.svg (dome-night, summit-road, primary-mirror, eyepiece-night, five partner marks), four aligned two-drum scenes in pink/blue and five single-blue partner marks,
 * the sixteen web layouts layouts/web/<unit>/<id>.liquid, and the custom fragments works/fragments/*.html listed in FRAGMENTS (the fragments embed generated inline SVG, so the files are build products and are overwritten on every run).
 * Needs the font cache (pnpm ds fetch-fonts, or .cache/fonts linked in) because mark names and fragment labels are outlined from the real fonts. Deterministic: two runs give identical bytes.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { domeNight, eyepieceNight, primaryMirror, summitRoad } from './art/scenes.mjs';
import { marks } from './art/marks.mjs';
import { FRAGMENTS } from './works/index.mjs';
import { LAYOUTS } from './works/layouts.mjs';

const imagesDir = fileURLToPath(new URL('../', import.meta.url));
const fragmentsDir = fileURLToPath(new URL('../../works/fragments/', import.meta.url));

export function buildAll() {
  mkdirSync(fragmentsDir, { recursive: true });
  const images = { 'dome-night': domeNight(), 'summit-road': summitRoad(), 'primary-mirror': primaryMirror(), 'eyepiece-night': eyepieceNight(), ...marks() };
  for (const [id, svg] of Object.entries(images)) writeFileSync(`${imagesDir}${id}.svg`, svg);
  const written = Object.keys(images).map((id) => `images/${id}.svg`);
  for (const [id, text] of Object.entries(LAYOUTS)) {
    const target = fileURLToPath(new URL(`../../layouts/web/${id}.liquid`, import.meta.url));
    mkdirSync(fileURLToPath(new URL(`../../layouts/web/${id.split('/')[0]}/`, import.meta.url)), { recursive: true });
    writeFileSync(target, text);
    written.push(`layouts/web/${id}.liquid`);
  }
  for (const make of FRAGMENTS) {
    const { name, text } = make();
    writeFileSync(`${fragmentsDir}${name}`, text);
    written.push(`works/fragments/${name}`);
  }
  return written;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(buildAll().join('\n'));

/*
 * Entry point: regenerates every code-drawn asset of the riso-print system. Run from the repository root:
 *   node systems/riso-print/images/src/build.mjs
 * Writes the code-drawn images images/<id>.svg: for the test content (排法总览) four aligned two-drum scenes (dome-night, summit-road, primary-mirror, eyepiece-night) and five single-blue partner marks; for the
 * showcase「纱厂屋顶 · 秋夜露天电影季」four single-blue partner marks (art/cinema-marks.mjs). Also the sixteen web layouts layouts/web/<unit>/<id>.liquid and the showcase's custom fragments works/fragments/*.html
 * listed in CINEMA_FRAGMENTS (works/cinema.mjs; build products, overwritten on every run). The showcase's generated pictures (*.webp) are not made here: see images/src/prompts/README.md and separate.mjs.
 * Needs the font cache (pnpm ds fetch-fonts, or .cache/fonts linked in) because mark names and fragment labels are outlined from the real fonts. Deterministic: two runs give identical bytes.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { domeNight, eyepieceNight, primaryMirror, summitRoad } from './art/scenes.mjs';
import { marks } from './art/marks.mjs';
import { cinemaMarks } from './art/cinema-marks.mjs';
import { CINEMA_FRAGMENTS } from './works/cinema.mjs';
import { LAYOUTS } from './works/layouts.mjs';

const imagesDir = fileURLToPath(new URL('../', import.meta.url));
const fragmentsDir = fileURLToPath(new URL('../../works/fragments/', import.meta.url));

export function buildAll() {
  mkdirSync(fragmentsDir, { recursive: true });
  const images = { 'dome-night': domeNight(), 'summit-road': summitRoad(), 'primary-mirror': primaryMirror(), 'eyepiece-night': eyepieceNight(), ...marks(), ...cinemaMarks() };
  for (const [id, svg] of Object.entries(images)) writeFileSync(`${imagesDir}${id}.svg`, svg);
  const written = Object.keys(images).map((id) => `images/${id}.svg`);
  for (const [id, text] of Object.entries(LAYOUTS)) {
    const target = fileURLToPath(new URL(`../../layouts/web/${id}.liquid`, import.meta.url));
    mkdirSync(fileURLToPath(new URL(`../../layouts/web/${id.split('/')[0]}/`, import.meta.url)), { recursive: true });
    writeFileSync(target, text);
    written.push(`layouts/web/${id}.liquid`);
  }
  for (const make of CINEMA_FRAGMENTS) {
    const { name, text } = make();
    writeFileSync(`${fragmentsDir}${name}`, text);
    written.push(`works/fragments/${name}`);
  }
  return written;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(buildAll().join('\n'));

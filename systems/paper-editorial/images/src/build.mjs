/*
 * Entry point: regenerates every code-drawn asset of the paper-editorial system. Run from the repository root:
 *   node systems/paper-editorial/images/src/build.mjs
 * Writes the seven code-drawn standard-sample images images/<id>.svg (dome-night, summit-road, five partner marks) and the three custom fragments
 * works/fragments/*.html (xingtu-tiqian, guang-zou-le, ba-ge-zhouliu). The fragments embed generated inline SVG, so the files are build products and are overwritten on every run.
 * primary-mirror and eyepiece-night are not drawn here: code-drawn people looked stiff, so they come from the image model (recipes in prompts/, files images/<id>.webp, see prompts/README.md).
 * Needs the font cache (pnpm ds fetch-fonts, or .cache/fonts linked in) because labels are outlined from the real fonts. Deterministic: two runs give identical bytes.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HEX } from './lib/palette.mjs';
import { domeNight } from './art/dome-night.mjs';
import { summitRoad } from './art/summit-road.mjs';
import { marks } from './art/marks.mjs';
import { xingtuTiqian } from './works/xingtu-tiqian.mjs';
import { guangZouLe } from './works/guang-zou-le.mjs';
import { baGeZhouliu } from './works/ba-ge-zhouliu.mjs';

const imagesDir = fileURLToPath(new URL('../', import.meta.url));
const fragmentsDir = fileURLToPath(new URL('../../works/fragments/', import.meta.url));

export function buildAll() {
  mkdirSync(fragmentsDir, { recursive: true });
  const images = {
    'dome-night': domeNight(HEX),
    'summit-road': summitRoad(HEX),
    ...marks(HEX),
  };
  for (const [id, svg] of Object.entries(images)) writeFileSync(`${imagesDir}${id}.svg`, svg);
  const written = Object.keys(images).map((id) => `images/${id}.svg`);
  for (const make of [xingtuTiqian, guangZouLe, baGeZhouliu]) {
    const { name, text } = make();
    writeFileSync(`${fragmentsDir}${name}`, text);
    written.push(`works/fragments/${name}`);
  }
  return written;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const file of buildAll()) console.log(file);
}

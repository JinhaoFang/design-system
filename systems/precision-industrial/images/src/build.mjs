/*
 * Regenerates precision-industrial's nine shared-brief SVGs, sixteen web layouts, three work fragments and system-page header.
 * Run at repository root: node systems/precision-industrial/images/src/build.mjs
 * Reads only system tokens, shared content and the font cache; writes only inside systems/precision-industrial.
 * No new dependencies. Results are deterministic and committed with this entry point; edit source modules rather than generated files.
 */
import { mkdirSync,writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname,join } from 'node:path';
import { HEX } from './lib/palette.mjs';
import { svgFile } from './lib/draft.mjs';
import { domeNight } from './art/dome.mjs';
import { mirror,road,eyepiece,marks } from './art/drawings.mjs';
import { layouts } from './layouts.mjs';
import { works,systemHeader } from './works.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const write=(name,text)=>{const path=join(root,name);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,text);};
const images={'dome-night':domeNight(HEX),'primary-mirror':mirror(HEX),'summit-road':road(HEX),'eyepiece-night':eyepiece(HEX),...marks(HEX)};
for(const [id,drawing] of Object.entries(images)) write(`images/${id}.svg`,svgFile({...drawing,title:id,P:HEX}));
for(const [id,text] of Object.entries(layouts())) write(`layouts/web/${id}.liquid`,text);
for(const [id,text] of Object.entries(works())) write(`works/fragments/${id}.html`,text);
write('system-page/header.html',systemHeader());
process.stdout.write('精密工业：已生成 9 张图解、16 种网页排法、3 个作品片段和体系页页头。\n');

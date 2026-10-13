/*
 * Engineering illustrations for the shared briefs and a separate optical-path drawing for the custom cover.
 * Data comes from library/content/SETTING.md: mirror diameter 1600 mm, approximate thickness 200 mm, dome 10 m,
 * route 38 km and summit altitude 2860 m. Staff positions, road bends and optical geometry are schematic, never surveyed or manufacturing data.
 * All SVG labels are outlined using the manifest fonts; palette is passed in, standalone HEX and inline CSS variables share the same drawings.
 * The cover uses a paraboloid primary and a convex hyperboloid secondary with common focus.
 * Reflected rays intersect the secondary analytically and reach the rear focus through the primary central hole.
 * Drawing coordinates are illustrative, not telescope focal lengths; only the known aperture is dimensioned.
 * TODO(design): review the schematic top-view people and five candidate partner marks before aesthetic acceptance.
 */
import { centerline, dimH, dimV, hatchDef, label, cross } from '../lib/draft.mjs';

const line = (d, P, width = 2, color = P.ink) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
const text = (s, x, y, P, size = 20) => label(s, { x, y, size, fill: P['ink-2'] });
const person = (x, y, P) => `<circle cx="${x}" cy="${y}" r="18" fill="${P['alu-light']}" stroke="${P.ink}" stroke-width="2"/>${line(`M${x - 32} ${y + 28}Q${x} ${y + 44} ${x + 32} ${y + 28}`, P)}`;

export function mirror(P) {
  let body = `<defs>${hatchDef('mirror-hatch', P, 12)}</defs>`;
  body += `<rect x="80" y="100" width="760" height="650" fill="none" stroke="${P.rule}"/>`;
  body += `<circle cx="460" cy="415" r="240" fill="${P['alu-light']}" stroke="${P.ink}" stroke-width="3"/>`;
  body += centerline(170, 415, 750, 415, P) + centerline(460, 125, 460, 705, P);
  for (const [x,y] of [[130,320],[780,320],[190,650],[740,650]]) body += person(x,y,P);
  body += line('M320 265H420M500 265H600', P, 2, P.rule);
  body += dimH({ x1:220,x2:700,y:810,from:665,text:'Ø 1600 mm',P,size:28 });
  body += `<path d="M920 330Q1160 370 1400 330V390H920Z" fill="url(#mirror-hatch)" stroke="${P.ink}" stroke-width="2"/>`;
  body += dimH({ x1:920,x2:1400,y:240,from:310,text:'1600 mm',P,size:22 });
  body += dimV({ y1:330,y2:390,x:860,from:920,text:'~200 mm',P,size:18,side:'left' });
  body += text('A-A / SCHEMATIC SECTION',920,490,P);
  body += text('CLEAN ROOM / PLAN',80,70,P,24) + text('TOP LIGHT REFLECTION',260,110,P,18);
  body += text('INSPECTION STAFF / SCHEMATIC',80,890,P,20);
  return {w:1440,h:960,body};
}

export function road(P) {
  let body = line('M80 660L240 570L360 605L515 380L690 410L860 180L1000 205L1120 115L1370 180',P,2,P.rule);
  body += line('M100 720C350 720 110 570 400 590S760 660 680 470S480 320 850 350S1120 420 1080 235S1210 235 1220 150',P,4);
  body += line('M1180 150V115A40 40 0 0 1 1260 115V150Z',P);
  body += cross(100,720,16,P) + cross(1220,150,16,P);
  body += text('SUMMIT ACCESS / ROUTE SCHEMATIC',80,70,P,24);
  body += text('38 km / ~70 min',80,835,P,28);
  body += text('SUMMIT / 2860 m',960,95,P,24);
  body += text('LUXI / MIRROR TRANSPORT',80,785,P,20);
  body += text('BENDS NOT SURVEYED / NTS',880,835,P,20);
  return {w:1440,h:900,body};
}

export function eyepiece(P) {
  let body = `<rect x="140" y="180" width="1160" height="620" fill="none" stroke="${P.rule}"/>`;
  body += `<circle cx="670" cy="450" r="230" fill="none" stroke="${P.ink}" stroke-width="2"/>`;
  body += centerline(350,450,990,450,P) + centerline(670,150,670,750,P);
  body += `<rect x="920" y="416" width="100" height="68" fill="${P['alu-deep']}" stroke="${P.ink}" stroke-width="2"/>`;
  body += person(1060,450,P) + person(1130,590,P);
  body += line('M1220 690H1080V495',P,2,P.rule);
  body += text('VISITOR',1070,370,P) + text('VOLUNTEER',1060,670,P);
  body += `<path d="M220 740H252" stroke="${P.signal}" stroke-width="4"/>`;
  body += text('RED LIGHT ONLY',270,745,P);
  body += text('OBSERVATION NIGHT / PLAN',80,80,P,24);
  body += text('EYEPIECE / SCHEMATIC / NTS',80,880,P,20);
  return {w:1440,h:960,body};
}

export function optical(P) {
  const axis = 420;
  const primary = (y) => 960 - y * y / (4 * 480);
  const secondary = (y) => 840 - 200 * Math.sqrt(1 + y * y / 89600);
  const curve = (fn, from, to) => Array.from({length:41}, (_, i) => {
    const y = from + (to - from) * i / 40;
    return `${i === 0 ? 'M' : 'L'}${fn(y)} ${axis + y}`;
  }).join('');
  let body = `<defs>${hatchDef('optic-hatch',P,10)}<marker id="ray-direction" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="${P.signal}"/></marker></defs>`;
  body += `<path d="M140 175H990V195H160V645H990V665H140Z" fill="url(#optic-hatch)" stroke="${P.ink}" stroke-width="2"/>`;
  for (const [from,to] of [[-205,-36],[36,205]]) {
    body += `<path d="${curve(primary,from,to)}L990 ${axis + to}V${axis + from}Z" fill="url(#optic-hatch)" stroke="${P.ink}" stroke-width="2"/>`;
    body += line(curve(primary,from,to),P,4);
  }
  body += `<path d="${curve(secondary,-75,75)}L600 495V345Z" fill="${P['alu-deep']}" stroke="${P.ink}" stroke-width="2"/>`;
  body += line(curve(secondary,-75,75),P,4);
  body += centerline(70,axis,1260,axis,P);
  for (const height of [-160,160]) {
    const x = primary(height);
    let low = 0, high = 1;
    for (let i = 0; i < 60; i += 1) {
      const t = (low + high) / 2;
      const y = height * (1 - t);
      if (x + (480 - x) * t > secondary(y)) low = t;
      else high = t;
    }
    const t = (low + high) / 2;
    const sy = height * (1 - t), sx = secondary(sy);
    const ray = [[80,axis+height],[x,axis+height],[sx,axis+sy],[1200,axis]];
    for (let i = 0; i < ray.length - 1; i += 1) {
      const [ax,ay] = ray[i], [bx,by] = ray[i+1];
      const mx = ax + (bx-ax) * .55, my = ay + (by-ay) * .55;
      body += `<path d="M${ax} ${ay}L${mx} ${my}" fill="none" stroke="${P.signal}" stroke-width="2" marker-end="url(#ray-direction)"/>`;
      body += line(`M${mx} ${my}L${bx} ${by}`,P,2,P.signal);
    }
  }
  body += `<circle cx="1200" cy="420" r="6" fill="${P.ink}"/>`;
  body += dimV({y1:215,y2:625,x:1320,from:990,P});
  body += text('INCOMING LIGHT',70,115,P,28) + text('Ø 1600 mm',1080,150,P,24);
  body += line('M640 340V270H480',P,1,P.rule) + text('SECONDARY / CONVEX',240,240,P,26);
  body += line('M970 630V720H770',P,1,P.rule) + text('PRIMARY / CONCAVE',710,770,P,26);
  body += line('M1200 435V525',P,1,P.rule) + text('FOCUS',1150,570,P,26);
  body += text('CASSEGRAIN / SCHEMATIC',140,820,P,28);
  body += text('GEOMETRY NTS',850,865,P,24);
  return {w:1440,h:900,body};
}

export function marks(P) {
  const names = ['北渚大学天文系','星野光学仪器','鹿溪镇人民政府','晚渡业余天文协会','嘉禾中学天文社'];
  const ids = ['beizhu-univ','xingye-optics','luxi-town','wandu-society','jiahe-school'];
  const icons = [
    line('M30 110L65 25L100 110M43 78H88',P,3),
    `<ellipse cx="65" cy="65" rx="22" ry="44" fill="none" stroke="${P.ink}" stroke-width="3"/>${line('M15 65H115',P,2)}`,
    `<rect x="22" y="22" width="86" height="86" fill="none" stroke="${P.ink}" stroke-width="3"/>${line('M38 88L65 45L92 88',P,3)}`,
    line('M20 85H110L95 105H35ZM65 85V28L98 70H65',P,3),
    line('M20 30L65 16L110 30V85L65 112L20 85ZM40 70H90M65 45V95',P,3),
  ];
  return Object.fromEntries(ids.map((id,index) => [`mark-${id}`,{w:600,h:130,body:icons[index]+label(names[index],{x:145,y:80,size:32,font:'sans700',fill:P.ink,track:0})}]));
}

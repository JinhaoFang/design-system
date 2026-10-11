/*
 * Posture-driven line-drawing silhouettes of people (no facial detail), used by primary-mirror and eyepiece-night.
 * figure({id, x, floor, h, facing, pose, P, line, fill, shade, clothes}) -> {svg, anchors}. x is the standing x, floor the ground y, h the total height in px, facing +1 (looks right) or -1 (left).
 * pose (degrees; limbs measured from straight down, torso from straight up, positive toward the facing direction):
 *   lean (torso), head (head offset from the torso line), armF/armB [upper, lower], legF/legB [thigh, shin], tiptoe (heel lift of both feet), reach {x, y, bend} (solve the front arm to a hand target).
 * Each limb is a tapered hull of two circles (smooth capsule that narrows toward the extremity). A part is drawn as ink fill + ink stroke (the outline) and then paper fill (the body), so overlapping
 * parts keep their contour lines while the joints inside one part merge. shade adds fine diagonal hatching on the side away from the light (upper left), clipped to the silhouette.
 * clothes: 'suit' (cleanroom coverall with hood and boot covers) or 'coat' (long observing coat). Anchors returned: headC, neck, shoulder, hip, hand, handB.
 */
import { f } from '../lib/random.mjs';

const rad = (deg) => (deg * Math.PI) / 180;

export function hull([x1, y1, r1], [x2, y2, r2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const d = Math.hypot(dx, dy);
  const phi = Math.atan2(dy, dx);
  const ratio = d < 1e-6 ? 0 : Math.max(-1, Math.min(1, (r1 - r2) / d));
  const a = Math.acos(ratio);
  const pts = [];
  const cap = (cx, cy, r, from, to, n) => {
    for (let i = 0; i <= n; i += 1) {
      const t = from + ((to - from) * i) / n;
      pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
    }
  };
  cap(x2, y2, r2, phi + a, phi - a, 10);
  cap(x1, y1, r1, phi - a, phi + a - Math.PI * 2, 14);
  return `M${pts.map(([px, py]) => `${f(px)} ${f(py)}`).join('L')}Z`;
}

const circle = (x, y, r) => hull([x, y, r], [x, y, r]);

function solveArm(sx, sy, tx, ty, upper, lower, bend) {
  const dist = Math.min(Math.hypot(tx - sx, ty - sy), (upper + lower) * 0.998);
  const base = Math.atan2(ty - sy, tx - sx);
  const a = Math.acos(Math.max(-1, Math.min(1, (upper * upper + dist * dist - lower * lower) / (2 * upper * dist))));
  const ang = base + bend * a;
  return [sx + Math.cos(ang) * upper, sy + Math.sin(ang) * upper, sx + Math.cos(base) * dist, sy + Math.sin(base) * dist];
}

let counter = 0;

export function figure({ id, x, floor, h, facing = 1, pose, P, line = 1.6, fill, shade = true, clothes = 'suit' }) {
  counter += 1;
  const uid = id ?? `fg${counter}`;
  const fl = fill ?? P.paper;
  const d = facing;
  const L = { torso: 0.31, thigh: 0.235, shin: 0.235, upper: 0.16, lower: 0.145, foot: 0.1 };
  const p = { lean: 0, head: 0, armF: [8, 12], armB: [-6, -2], legF: [4, 2], legB: [-4, -2], tiptoe: 0, ...pose };
  const v = (ang, len) => [Math.sin(rad(ang)) * d * len * h, Math.cos(rad(ang)) * len * h];
  const footLen = L.foot * h;
  const lift = Math.sin(rad(p.tiptoe)) * footLen;

  const chain = (leg) => {
    const [tx, ty] = v(leg[0], L.thigh);
    const [sx, sy] = v(leg[1], L.shin);
    return { knee: [tx, ty], ankle: [tx + sx, ty + sy] };
  };
  const F = chain(p.legF);
  const B = chain(p.legB);
  const hip = [x, floor - lift - Math.max(F.ankle[1], B.ankle[1])];
  const at = (rel) => [hip[0] + rel[0], hip[1] + rel[1]];

  const shoulder = [hip[0] + Math.sin(rad(p.lean)) * d * L.torso * h, hip[1] - Math.cos(rad(p.lean)) * L.torso * h];
  const neckAng = p.lean * 0.7 + p.head * 0.3;
  const neck = [shoulder[0] + Math.sin(rad(neckAng)) * d * 0.045 * h, shoulder[1] - Math.cos(rad(neckAng)) * 0.045 * h];
  const headAng = p.lean * 0.5 + p.head;
  const headC = [neck[0] + Math.sin(rad(headAng)) * d * 0.07 * h, neck[1] - Math.cos(rad(headAng)) * 0.07 * h];

  const rs = (k) => k * h;
  const footEnd = (ankle) => [ankle[0] + Math.cos(rad(p.tiptoe)) * d * footLen, ankle[1] + Math.sin(rad(p.tiptoe)) * footLen];

  const leg = (c) => {
    const knee = at(c.knee);
    const ankle = at(c.ankle);
    const toe = footEnd(ankle);
    return [
      hull([hip[0], hip[1], rs(clothes === 'coat' ? 0.058 : 0.05)], [knee[0], knee[1], rs(0.038)]),
      hull([knee[0], knee[1], rs(0.038)], [ankle[0], ankle[1], rs(0.026)]),
      hull([ankle[0], ankle[1], rs(0.028)], [toe[0], toe[1] + rs(0.006), rs(0.02)]),
    ];
  };

  const shF = [shoulder[0] + d * 0.012 * h, shoulder[1] + 0.012 * h];
  const shB = [shoulder[0] - d * 0.01 * h, shoulder[1] + 0.014 * h];
  let armF;
  if (p.reach) {
    const [ex, ey, hx, hy] = solveArm(shF[0], shF[1], p.reach.x, p.reach.y, L.upper * h, L.lower * h, p.reach.bend ?? -d);
    armF = [[ex, ey], [hx, hy]];
  } else {
    const [ux, uy] = v(p.armF[0], L.upper);
    const [lx, ly] = v(p.armF[1], L.lower);
    armF = [[shF[0] + ux, shF[1] + uy], [shF[0] + ux + lx, shF[1] + uy + ly]];
  }
  const [bux, buy] = v(p.armB[0], L.upper);
  const [blx, bly] = v(p.armB[1], L.lower);
  const armB = [[shB[0] + bux, shB[1] + buy], [shB[0] + bux + blx, shB[1] + buy + bly]];
  const arm = (sh, a) => [
    hull([sh[0], sh[1], rs(0.034)], [a[0][0], a[0][1], rs(0.028)]),
    hull([a[0][0], a[0][1], rs(0.028)], [a[1][0], a[1][1], rs(0.021)]),
    circle(a[1][0], a[1][1], rs(0.022)),
  ];

  const torso = [
    hull([hip[0], hip[1], rs(clothes === "coat" ? 0.074 : 0.064)], [shoulder[0], shoulder[1], rs(0.075)]),
    hull([shoulder[0], shoulder[1], rs(0.03)], [neck[0], neck[1], rs(0.02)]),
  ];
  if (clothes === 'coat') torso.push(hull([hip[0], hip[1] + rs(0.04), rs(0.082)], [hip[0] + d * rs(0.01), hip[1] + rs(0.2), rs(0.092)]));
  const head = [hull([headC[0], headC[1], rs(0.062)], [headC[0] - d * rs(0.014), headC[1] + rs(0.004), rs(0.064)])];

  const parts = [leg(B), arm(shB, armB), torso, leg(F), head, arm(shF, armF)];

  const yTop = floor - h * 1.05;
  const yBot = floor + 8;
  const hatch = [];
  for (let k = -h * 0.5; k < h * 0.5; k += 3.6) hatch.push(`M${f(x + k)} ${f(yBot)}l${f((yBot - yTop) * 0.42)} ${f(-(yBot - yTop))}`);
  let out = shade ? `<defs><path id="${uid}-h" d="${hatch.join('')}" stroke="${P.ink}" stroke-width="0.75" fill="none"/></defs>` : '';
  parts.forEach((part, i) => {
    const dd = part.join('');
    out += `<path d="${dd}" fill="${P.ink}" stroke="${P.ink}" stroke-width="${f(line * 2)}" stroke-linejoin="round"/><path d="${dd}" fill="${fl}"/>`;
    if (shade) {
      out += `<mask id="${uid}-m${i}" maskUnits="userSpaceOnUse" x="${f(x - h)}" y="${f(yTop - 20)}" width="${f(h * 2)}" height="${f(h * 1.3)}"><path d="${dd}" fill="#fff"/><path d="${dd}" fill="#000" transform="translate(${f(-0.026 * h)} ${f(-0.014 * h)})"/></mask><g mask="url(#${uid}-m${i})" opacity="0.7"><use href="#${uid}-h"/></g>`;
    }
  });

  const hr = rs(0.062);
  const fx = headC[0] + d * hr * 0.42;
  out += `<path d="M${f(fx)} ${f(headC[1] - hr * 0.55)}Q${f(fx + d * hr * 0.5)} ${f(headC[1])} ${f(fx)} ${f(headC[1] + hr * 0.55)}" fill="none" stroke="${P.ink}" stroke-width="${f(line * 0.8)}" stroke-linecap="round"/>`;
  out += `<path d="M${f(neck[0] - d * rs(0.05))} ${f(neck[1] - rs(0.004))}Q${f(neck[0])} ${f(neck[1] + rs(0.03))} ${f(neck[0] + d * rs(0.05))} ${f(neck[1] - rs(0.004))}" fill="none" stroke="${P.ink}" stroke-width="${f(line * 0.7)}" opacity="0.8"/>`;
  const waist = [hip[0] + (shoulder[0] - hip[0]) * 0.1, hip[1] + (shoulder[1] - hip[1]) * 0.1];
  out += `<path d="M${f(waist[0] - rs(0.054))} ${f(waist[1])}L${f(waist[0] + rs(0.054))} ${f(waist[1] - rs(0.006))}" stroke="${P.ink}" stroke-width="${f(line * 0.7)}" opacity="0.7"/>`;
  const kneeF = at(F.knee);
  out += `<path d="M${f(kneeF[0] - rs(0.03))} ${f(kneeF[1] + rs(0.01))}q${f(rs(0.03))} ${f(rs(0.014))} ${f(rs(0.06))} 0" fill="none" stroke="${P.ink}" stroke-width="${f(line * 0.6)}" opacity="0.7"/>`;

  return { svg: `<g>${out}</g>`, anchors: { headC, neck, shoulder, hip, hand: armF[1], handB: armB[1] } };
}

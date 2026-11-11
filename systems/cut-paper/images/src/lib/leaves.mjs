/*
 * Hand-cut gouache leaves (SYSTEM.md 材质锚点): every leaf is one flat colour, outlined by a smooth closed curve with a little deterministic wobble (scissors, not a vector pen),
 * and its veins are thin cuts that show the paper underneath (stroke in the paper colour). Coordinates: base of the stalk at (0,0), tip at (0,-100); viewBox -60 -112 120 124.
 * SPECIES: ginkgo, maple, oak, willow, heart, lotus, monstera (fenestrations are holes, fill-rule evenodd), fern (leaflets on a rib), eucalyptus, seaweed (a lobed frond after mid-century cut-outs).
 * leafSvg(species, fill, { seed, paper, angle }) -> standalone <svg> string (aria-hidden, focusable false); angle rotates inside the svg so the element's own CSS transform stays free for entrances.
 * leafPath(species, seed) -> { d, veins } for composing several leaves in one picture. rng(seed) is a small deterministic generator (Park–Miller).
 */
export function rng(seed) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const r1 = (n) => Math.round(n * 10) / 10;

function closed(points) {
  const n = points.length;
  let d = `M${r1(points[0][0])} ${r1(points[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n], p1 = points[i], p2 = points[(i + 1) % n], p3 = points[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return `${d}Z`;
}

const wobble = (points, rand, amount = 1.6) => points.map(([x, y]) => [x + (rand() - 0.5) * amount, y + (rand() - 0.5) * amount]);

function profile(widthAt, steps = 14, stalk = 6) {
  const right = [], left = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = -stalk - t * (100 - stalk);
    const w = widthAt(t);
    right.push([w, y]);
    left.unshift([-w, y]);
  }
  return [[1.6, 0], ...right.slice(0, -1), [0, -100], ...left.slice(1), [-1.6, 0]];
}

const SHAPES = {
  ginkgo(rand) {
    const pts = [[1.5, 0], [2, -30]];
    for (let i = 0; i <= 12; i++) {
      const a = (-160 + (i * 140) / 12) * (Math.PI / 180);
      const notch = i === 6 ? 0.82 : 1;
      pts.push([Math.cos(a) * 46 * notch, -40 + Math.sin(a) * 52 * notch - 8]);
    }
    pts.push([-2, -30], [-1.5, 0]);
    return { outline: [pts.slice(0, 2), pts.slice(2, -2).reverse(), pts.slice(-2)].flat(), veins: ['M0 -30 L0 -84', 'M0 -34 L-26 -86', 'M0 -34 L26 -86'] };
  },
  maple(rand) {
    const pts = [[1.5, 0], [3, -14]];
    const tips = [[46, -50], [34, -82], [0, -102], [-34, -82], [-46, -50]];
    const valleys = [[18, -42], [16, -64], [-16, -64], [-18, -42]];
    pts.push([22, -28], tips[0], valleys[0], tips[1], valleys[1], tips[2], valleys[2], tips[3], valleys[3], tips[4], [-22, -28], [-3, -14], [-1.5, 0]);
    return { outline: pts, veins: ['M0 -14 L0 -88', 'M0 -22 L34 -50', 'M0 -22 L-34 -50', 'M0 -26 L24 -74', 'M0 -26 L-24 -74'] };
  },
  oak(rand) {
    return { outline: profile((t) => (20 + 8 * Math.sin(t * Math.PI * 4.5)) * Math.sin(Math.PI * Math.min(1, t * 1.05)) + 2, 28), veins: ['M0 -8 L0 -92', 'M0 -34 L18 -46', 'M0 -34 L-18 -46', 'M0 -60 L16 -70', 'M0 -60 L-16 -70'] };
  },
  willow(rand) {
    return { outline: profile((t) => 10 * Math.sin(Math.PI * Math.pow(t, 0.8)) + 0.4, 14, 10), veins: ['M0 -12 L0 -90'] };
  },
  heart(rand) {
    const right = [[4, -22], [14, -12], [30, -14], [40, -28], [41, -46], [34, -66], [20, -86], [0, -101]];
    const left = right.slice(0, -1).reverse().map(([x, y]) => [-x, y]);
    return { outline: [[1.4, 0], [1.4, -20], ...right, ...left, [-1.4, -20], [-1.4, 0]], veins: ['M0 -24 L0 -88', 'M0 -36 L24 -56', 'M0 -36 L-24 -56', 'M0 -30 L26 -24', 'M0 -30 L-26 -24'] };
  },
  lotus(rand) {
    const pts = [];
    for (let i = 0; i < 20; i++) {
      const a = -Math.PI / 2 + 0.22 + (i * (2 * Math.PI - 0.44)) / 19;
      pts.push([Math.cos(a) * 46, -52 + Math.sin(a) * 46]);
    }
    return { outline: [[0, -52], ...pts], veins: [0, 1, 2, 3, 4, 5].map((k) => { const a = (k * Math.PI) / 3 + 0.5; return `M0 -52 L${r1(Math.cos(a) * 36)} ${r1(-52 + Math.sin(a) * 36)}`; }) };
  },
  monstera(rand) {
    const base = SHAPES.heart(rand);
    const holes = [[-17, -36, 3.5, 8, -60], [17, -36, 3.5, 8, 60], [-20, -56, 3.5, 8, -50], [20, -56, 3.5, 8, 50], [-12, -76, 3, 6, -40], [12, -76, 3, 6, 40]];
    return { outline: base.outline.map(([x, y]) => [x * 1.15, y]), holes, veins: ['M0 -24 L0 -90'] };
  },
  fern(rand) {
    return { leaflets: Array.from({ length: 9 }, (_, i) => { const y = -18 - i * 9; const w = 22 * (1 - i / 10) + 4; return [[0, y], [w, y - 6], [w * 0.4, y - 9], [0, y - 4], [-w * 0.4, y - 9], [-w, y - 6]]; }), rib: 'M0 0 L0 -104' };
  },
  eucalyptus(rand) {
    return { outline: profile((t) => 24 * Math.sin(Math.PI * Math.pow(t, 0.9)) + 0.6, 16), veins: ['M0 -8 L0 -90'] };
  },
  seaweed(rand) {
    return { outline: profile((t) => (14 + 9 * Math.sin(t * Math.PI * 6)) * (1 - t * 0.55) * Math.min(1, t * 6) + 1.2, 40, 8), veins: [] };
  },
};

export const SPECIES = Object.keys(SHAPES);

export function leafPath(species, seed = 1) {
  const rand = rng(seed * 7919 + species.length * 131);
  const shape = SHAPES[species](rand);
  if (shape.leaflets) {
    return { d: shape.leaflets.map((l) => closed(wobble(l, rand, 1.2))).join(''), veins: [], rib: shape.rib };
  }
  let d = closed(wobble(shape.outline, rand));
  for (const [cx, cy, rx, ry, rot] of shape.holes ?? []) {
    const a = (rot * Math.PI) / 180;
    const pts = Array.from({ length: 8 }, (_, i) => { const t = (i / 8) * 2 * Math.PI; const x = Math.cos(t) * rx, y = Math.sin(t) * ry; return [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)]; });
    d += closed(pts);
  }
  return { d, veins: shape.veins ?? [] };
}

export function leafSvg(species, fill, { seed = 1, paper = '#ebe8df', angle = 0, veins = true } = {}) {
  const { d, veins: v, rib } = leafPath(species, seed);
  const ribPath = rib ? `<path d="${rib}" fill="none" stroke="${fill}" stroke-width="2.6" stroke-linecap="round"/>` : '';
  const cuts = veins && v.length ? `<path d="${v.join(' ')}" fill="none" stroke="${paper}" stroke-width="1.4" stroke-linecap="round"/>` : '';
  return `<svg viewBox="-60 -112 120 124" aria-hidden="true" focusable="false"><g transform="rotate(${r1(angle)} 0 -50)">${ribPath}<path d="${d}" fill="${fill}" fill-rule="evenodd"/>${cuts}</g></svg>`;
}

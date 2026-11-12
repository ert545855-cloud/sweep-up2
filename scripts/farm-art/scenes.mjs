// SwipeFarm sahneleri. Birim: 1 = bir kare. Kamera +x/+z yönünden bakar; +z yüzü ışık alan ön yüzdür.
import { Scene, M, mottle, planks, shingles, stripes, spots, sph, ell, box, cyl, cap, cone, tor, starP, gable, pyr, hash } from './sdf.mjs';

const C = {
  soil: mottle('#8a5a3a', '#6e4429', 9), soilD: M('#5d3a22'),
  white: M('#fff6e6'), cream: mottle('#fbe9c6', '#f1d6a2', 5), peach: mottle('#ffd9a8', '#f7c48a', 5), red: planks('#d8433a', { axis: 'h', w: 0.13 }), redD: M('#a92f2c'),
  wood: planks('#b9793f', { axis: 'h', w: 0.1 }), woodH: planks('#c08548', { axis: 'y', w: 0.085 }), woodD: M('#7b4a26'), roofR: shingles('#c9503f'), roofRx: shingles('#c9503f', { axis: 'x' }), roofB: shingles('#4a8fb5'), roofBr: shingles('#9a6238'), roofT: shingles('#3fa99a', { axis: 'x' }),
  leaf: mottle('#5fb346', '#3f9338', 7, { soft: 0.5 }), leafD: mottle('#3f8f3a', '#2c7333', 7, { soft: 0.5 }), leafL: mottle('#8fd456', '#63b947', 8, { soft: 0.5 }),
  gold: M('#f2c23e', { soft: 0.3 }), goldD: M('#dfa22e'), orange: M('#f28a2e', { spec: 0.25 }), yellow: M('#ffd23f', { spec: 0.2 }), black: M('#2b2320', { spec: 0.5, gloss: 40 }),
  stone: mottle('#bdb8ac', '#948e84', 8), metal: M('#c9d3da', { spec: 0.6, gloss: 40 }), glass: M('#8fd0ee', { spec: 0.9, gloss: 60 }), pink: M('#f6a5a8'), redS: M('#e23b3b', { spec: 0.35, gloss: 30 }),
  water: mottle('#4fb4e8', '#3a9fdc', 4, { spec: 0.9, gloss: 70 }), hay: mottle('#ecd08a', '#cfa856', 16), straw: mottle('#ead9a4', '#d8c286', 10), brown: M('#8b5a33'), teal: M('#3fa99a'), blue: M('#3f7fd0', { spec: 0.3 }), purple: M('#9a6ad8'),
  crust: mottle('#d99548', '#b8742f', 10, { spec: 0.2 }), sack: mottle('#e3c79a', '#cfae7c', 12), milk: M('#fffdf6', { spec: 0.5, gloss: 40 }), cheese: spots('#ffd95a', '#e3a11f', 15, 0.66, { spec: 0.3 }),
  cow: spots('#fffaf0', '#33291f', 3.2, 0.55), pump: M('#f08a24', { spec: 0.35, gloss: 25 }), tomato: M('#e8362e', { spec: 0.6, gloss: 40 }), coin: M('#ffc933', { spec: 0.9, gloss: 50 }), coinD: M('#e0a21c', { spec: 0.6 }),
};
const jit = (i, s = 1) => (hash(i * 3.17, s * 1.3) - 0.5);
const obj = (build, opt) => ({ build, opt, set: 'obj' });
const item = (build, S = 300) => ({ build, opt: { S, ground: false, pad: 0.04 }, set: 'item' });

// ---- tarla ve ekinler ----
const soil = (s = new Scene()) => s.add(C.soil, 0.04, box(0, 0.035, 0, 0.455, 0.06, 0.455, 0.055, { disp: (x, y) => (y > 0.05 ? 0.013 * Math.sin(x * 40) : 0) })).add(C.soilD, 0, box(0, 0.0, 0, 0.475, 0.03, 0.475, 0.03));
const grid = (n, fn, w = 0.3) => { const o = []; for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) { const i = a * n + b; o.push(fn(-w + (2 * w * a) / (n - 1) + jit(i, 1) * 0.05, -w + (2 * w * b) / (n - 1) + jit(i, 2) * 0.05, i)); } return o; };
const leafPair = (x, y, z, i, l = 0.07) => [ell(x + l * 0.7, y, z, l, 0.016, l * 0.45, { rz: 28, ry: i * 47 }), ell(x - l * 0.7, y, z, l, 0.016, l * 0.45, { rz: -28, ry: i * 47 })];
const flower = (cx, cy, cz, r = 0.1) => { // kameraya dönük ayçiçeği başı
  const n = [0.42, 0.5, 0.76]; const u = [0.875, 0, -0.484]; const v = [-0.242, 0.866, -0.437]; const pet = [];
  for (let k = 0; k < 11; k++) { const a = (k / 11) * Math.PI * 2; pet.push(sph(cx + (u[0] * Math.cos(a) + v[0] * Math.sin(a)) * r, cy + (v[1] * Math.sin(a)) * r, cz + (u[2] * Math.cos(a) + v[2] * Math.sin(a)) * r, r * 0.42)); }
  return { pet, mid: sph(cx + n[0] * r * 0.25, cy + n[1] * r * 0.25, cz + n[2] * r * 0.25, r * 0.62) };
};
const pumpkin = (x, y, z, r) => ell(x, y, z, r, r * 0.78, r, { disp: (a, b, c) => 0.012 * r * 8 * Math.cos(Math.atan2(c - z, a - x) * 8) * 0.12 });
const cornStalk = (x, z, i, h, cob) => [cap(x, 0.08, z, x, h, z, 0.018), ...[0.35, 0.6, 0.85].flatMap((t, k) => [ell(x + 0.07, 0.08 + h * t, z, 0.1, 0.014, 0.035, { rz: 35, ry: i * 60 + k * 120 }), ell(x - 0.07, 0.08 + h * t * 0.9, z, 0.1, 0.014, 0.035, { rz: -35, ry: i * 60 + k * 120 })]), cob ? null : sph(x, h + 0.02, z, 0.025)];

const CROPS = {
  sprout: () => soil().add(C.leafL, 0.02, grid(3, (x, z, i) => [cap(x, 0.08, z, x, 0.15, z, 0.012), ...leafPair(x, 0.17, z, i, 0.045)])),
  wheat_2: () => soil().add(C.leafL, 0, grid(4, (x, z, i) => [-1, 0, 1].map((k) => cap(x, 0.08, z, x + k * 0.035 + jit(i, 5) * 0.03, 0.27 + jit(i, 6) * 0.04, z + jit(i + k, 7) * 0.04, 0.011)))),
  wheat_3: () => soil().add(C.gold, 0, grid(4, (x, z, i) => [-1, 0, 1].map((k) => cap(x, 0.08, z, x + k * 0.035 + jit(i, 5) * 0.03, 0.4 + jit(i, 6) * 0.05, z + jit(i + k, 7) * 0.04, 0.01))))
    .add(C.goldD, 0, grid(4, (x, z, i) => [-1, 0, 1].map((k) => ell(x + k * 0.04 + jit(i, 5) * 0.03, 0.45 + jit(i, 6) * 0.05, z + jit(i + k, 7) * 0.04, 0.03, 0.075, 0.03, { rz: -k * 14 })))),
  corn_2: () => soil().add(C.leaf, 0.01, grid(3, (x, z, i) => cornStalk(x, z, i, 0.3, false))),
  corn_3: () => soil().add(C.leaf, 0.01, grid(3, (x, z, i) => cornStalk(x, z, i, 0.56, true)))
    .add(C.yellow, 0, grid(3, (x, z, i) => ell(x + 0.045, 0.4 + jit(i, 3) * 0.05, z + 0.03, 0.04, 0.085, 0.04, { rz: -18 })))
    .add(C.leafL, 0, grid(3, (x, z, i) => ell(x + 0.035, 0.36 + jit(i, 3) * 0.05, z + 0.03, 0.045, 0.06, 0.045, { rz: -18 }))),
  carrot_2: () => soil().add(C.leafL, 0.015, grid(3, (x, z, i) => [0, 1, 2].map((k) => ell(x, 0.15, z, 0.02, 0.08, 0.02, { rz: (k - 1) * 30, ry: i * 50 })))),
  carrot_3: () => soil().add(C.leaf, 0.015, grid(3, (x, z, i) => [0, 1, 2, 3, 4].map((k) => ell(x, 0.2, z, 0.024, 0.12, 0.024, { rz: (k - 2) * 24, ry: i * 50 + k * 70 }))))
    .add(C.orange, 0, grid(3, (x, z) => sph(x, 0.085, z, 0.05))),
  tomato_2: () => soil().add(C.leaf, 0.05, grid(2, (x, z, i) => [sph(x, 0.2, z, 0.12), sph(x + 0.06, 0.28, z - 0.04, 0.09)], 0.2)).add(C.woodD, 0, grid(2, (x, z) => cap(x, 0.06, z, x, 0.42, z, 0.012), 0.2)),
  tomato_3: () => soil().add(C.leaf, 0.05, grid(2, (x, z, i) => [sph(x, 0.22, z, 0.15), sph(x + 0.07, 0.33, z - 0.05, 0.11), sph(x - 0.06, 0.3, z + 0.05, 0.1)], 0.2)).add(C.woodD, 0, grid(2, (x, z) => cap(x, 0.06, z, x, 0.5, z, 0.012), 0.2))
    .add(C.tomato, 0, grid(2, (x, z, i) => [[0.12, 0.2, 0.08], [-0.02, 0.3, 0.14], [0.14, 0.34, -0.02], [0.02, 0.14, 0.15], [-0.12, 0.22, 0.1]].map(([a, b, c], k) => sph(x + a, b + jit(i + k, 4) * 0.03, z + c, 0.048)), 0.2)),
  sunflower_2: () => soil().add(C.leaf, 0.01, grid(2, (x, z, i) => [cap(x, 0.08, z, x, 0.42, z, 0.02), ...leafPair(x, 0.22, z, i, 0.09), ...leafPair(x, 0.34, z, i + 2, 0.07), sph(x, 0.45, z, 0.05)], 0.2)),
  sunflower_3: () => { const s = soil().add(C.leaf, 0.01, grid(2, (x, z, i) => [cap(x, 0.08, z, x, 0.62 + jit(i, 8) * 0.08, z, 0.022), ...leafPair(x, 0.25, z, i, 0.1), ...leafPair(x, 0.42, z, i + 2, 0.085)], 0.2));
    const fl = grid(2, (x, z, i) => flower(x + 0.03, 0.68 + jit(i, 8) * 0.08, z + 0.05, 0.115), 0.2);
    return s.add(C.yellow, 0.02, fl.map((f) => f.pet)).add(C.brown, 0, fl.map((f) => f.mid)); },
  pumpkin_2: () => soil().add(C.leaf, 0.02, grid(3, (x, z, i) => ell(x, 0.11, z, 0.1, 0.02, 0.08, { ry: i * 53, rz: 8 }))).add(C.leafL, 0, [[-0.12, 0.1], [0.15, -0.12]].map(([x, z]) => sph(x, 0.13, z, 0.07))),
  pumpkin_3: () => soil().add(C.leaf, 0.02, grid(3, (x, z, i) => ell(x, 0.11, z, 0.11, 0.02, 0.085, { ry: i * 53, rz: 8 })))
    .add(C.pump, 0, pumpkin(-0.13, 0.2, 0.12, 0.17), pumpkin(0.17, 0.18, -0.1, 0.15), pumpkin(0.14, 0.15, 0.24, 0.1))
    .add(C.leafD, 0, cap(-0.13, 0.32, 0.12, -0.11, 0.39, 0.12, 0.018), cap(0.17, 0.29, -0.1, 0.19, 0.35, -0.1, 0.016), cap(0.14, 0.22, 0.24, 0.15, 0.27, 0.24, 0.012)),
};

// ---- yapı parçaları ----
const win = (s, x, y, z, face = 'z', w = 0.11, h = 0.13) => { const d = 0.012; const f = (a, b, c, hw, hh, t) => (face === 'z' ? box(x + a, y + b, z + c, hw, hh, t, 0.008) : box(x + c, y + b, z + a, t, hh, hw, 0.008));
  s.add(C.white, 0, f(0, 0, 0, w + 0.025, h + 0.025, d)).add(C.glass, 0, f(0, 0, 0.008, w, h, d)).add(C.white, 0, f(0, 0, 0.014, 0.01, h, d), f(0, 0, 0.014, w, 0.01, d)); return s; };
const door = (s, x, z, face = 'z', w = 0.11, h = 0.19, mat = C.woodD) => { const f = (c, hw, hh, t, yy = h) => (face === 'z' ? box(x, yy, z + c, hw, hh, t, 0.01) : box(x + c, yy, z, t, hh, hw, 0.01));
  s.add(C.white, 0, f(0, w + 0.025, h + 0.02, 0.012)).add(mat, 0, f(0.008, w, h, 0.012)).add(C.yellow, 0, face === 'z' ? sph(x + w * 0.6, h, z + 0.025, 0.014) : sph(x + 0.025, h, z - w * 0.6, 0.014)); return s; };
const fence = (s, pts, h = 0.22) => { // köşe noktaları arasında direk + iki ray
  const posts = []; const rails = [];
  for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i]; const [bx, bz] = pts[i + 1]; const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 0.42));
    for (let k = 0; k <= n; k++) { const x = ax + ((bx - ax) * k) / n; const z = az + ((bz - az) * k) / n; posts.push(box(x, h / 2 + 0.02, z, 0.026, h / 2 + 0.03, 0.026, 0.012)); }
    rails.push(cap(ax, h * 0.5, az, bx, h * 0.5, bz, 0.016), cap(ax, h * 0.92, az, bx, h * 0.92, bz, 0.016)); }
  return s.add(C.white, 0, posts).add(C.white, 0, rails); };
const blades = (s, deg) => { // değirmen pervanesi (z'ye bakan düzlemde)
  const hub = [0, 1.12, 0.5]; const parts = []; const frames = [];
  for (let k = 0; k < 4; k++) { const a = ((deg + k * 90) * Math.PI) / 180; const cx = Math.cos(a); const sy = Math.sin(a);
    parts.push(cap(hub[0], hub[1], hub[2] + 0.06, hub[0] + cx * 0.8, hub[1] + sy * 0.8, hub[2] + 0.06, 0.018));
    frames.push(box(hub[0] + cx * 0.52 - sy * 0.075, hub[1] + sy * 0.52 + cx * 0.075, hub[2] + 0.06, 0.26, 0.075, 0.008, 0.006, { rz: deg + k * 90 })); }
  return s.add(C.woodD, 0, parts, sph(hub[0], hub[1], hub[2] + 0.06, 0.06)).add(M('#fff3d6'), 0, frames); };
const millBody = () => { const s = new Scene().add(C.cream, 0, cone(0, 0, 0, 0.52, 0.36, 1.2, 0.03)).add(C.stone, 0, cyl(0, 0.05, 0, 0.56, 0.06, 0.03))
  .add(C.roofR, 0, cone(0, 1.2, 0, 0.46, 0.05, 0.42, 0.03)).add(C.woodD, 0, cyl(0, 1.2, 0, 0.4, 0.03, 0.02), cyl(0, 1.12, 0.4, 0.05, 0.12, 0.01, { rx: 90 }));
  door(s, 0, 0.5, 'z', 0.1, 0.2); win(s, 0.46, 0.62, 0, 'x', 0.07, 0.09); return s; };

const BUILD = {
  house: () => { const s = new Scene().add(C.cream, 0, box(0, 0.48, 0, 1.08, 0.48, 0.66, 0.02)).add(C.stone, 0, box(0, 0.05, 0, 1.12, 0.06, 0.7, 0.02))
    .add(C.roofRx, 0, gable(0, 0.94, 0, 0.8, 0.52, 1.2, 0.02, { ry: 90 })).add(C.cream, 0, gable(0, 0.94, 0, 0.66, 0.43, 1.08, 0, { ry: 90 }))
    .add(M('#b5553f'), 0, box(-0.55, 1.3, -0.2, 0.09, 0.2, 0.09, 0.015)).add(C.stone, 0, box(-0.55, 1.5, -0.2, 0.11, 0.03, 0.11, 0.01))
    .add(C.roofRx, 0, gable(0.42, 0.98, 0.5, 0.26, 0.24, 0.36, 0.015)).add(C.cream, 0, box(0.42, 0.95, 0.52, 0.2, 0.14, 0.3, 0.01))
    .add(C.woodH, 0, box(-0.1, 0.07, 0.86, 0.5, 0.045, 0.2, 0.015)).add(C.white, 0, [-0.55, 0.35].map((x) => box(x, 0.33, 1.0, 0.025, 0.26, 0.025, 0.01)))
    .add(C.roofRx, 0, box(-0.1, 0.62, 0.86, 0.56, 0.03, 0.24, 0.015, { rx: 14 }))
    .add(C.leaf, 0.03, [-0.78, -0.62, 0.72, 0.86].map((x) => sph(x, 0.33, 0.7, 0.07))).add(C.pink, 0, [-0.8, -0.7, -0.6, 0.7, 0.8, 0.9].map((x, i) => sph(x, 0.38 + (i % 2) * 0.02, 0.74, 0.03))).add(C.woodD, 0, box(-0.7, 0.27, 0.69, 0.14, 0.03, 0.04, 0.01), box(0.79, 0.27, 0.69, 0.14, 0.03, 0.04, 0.01));
    door(s, -0.1, 0.66, 'z', 0.12, 0.22, M('#3f8fa9')); win(s, -0.7, 0.5, 0.66); win(s, 0.79, 0.5, 0.66); win(s, 0.42, 0.98, 0.82, 'z', 0.08, 0.09); win(s, 1.08, 0.5, 0.2, 'x'); win(s, 1.08, 0.5, -0.3, 'x'); win(s, 1.08, 1.1, 0, 'x', 0.09, 0.09); return s; },
  barn: () => new Scene().add(C.red, 0, box(0, 0.5, 0, 0.72, 0.5, 0.6, 0.02)).add(C.stone, 0, box(0, 0.04, 0, 0.75, 0.05, 0.63, 0.02))
    .add(C.roofBr, 0, gable(0, 0.97, 0, 0.84, 0.56, 0.68, 0.02)).add(C.red, 0, gable(0, 0.97, 0, 0.72, 0.48, 0.6, 0.0))
    .add(C.white, 0, box(0, 0.4, 0.61, 0.3, 0.4, 0.015), box(-0.72, 0.5, 0.6, 0.03, 0.5, 0.03), box(0.72, 0.5, 0.6, 0.03, 0.5, 0.03), box(0.72, 0.5, -0.6, 0.03, 0.5, 0.03), cyl(0, 1.2, 0.6, 0.11, 0.02, 0.01, { rx: 90 }),
      cap(-0.84, 0.97, 0.68, 0, 1.53, 0.68, 0.028), cap(0.84, 0.97, 0.68, 0, 1.53, 0.68, 0.028))
    .add(C.redD, 0, box(0, 0.38, 0.625, 0.255, 0.36, 0.012), cyl(0, 1.2, 0.615, 0.075, 0.012, 0.005, { rx: 90 }))
    .add(C.white, 0, cap(-0.24, 0.05, 0.64, 0.24, 0.7, 0.64, 0.022), cap(0.24, 0.05, 0.64, -0.24, 0.7, 0.64, 0.022), box(0, 0.38, 0.64, 0.012, 0.36, 0.012))
    .add(C.stone, 0, cyl(-0.62, 0.72, -0.5, 0.3, 0.72, 0.03)).add(C.metal, 0, tor(-0.62, 0.5, -0.5, 0.3, 0.015), tor(-0.62, 1.0, -0.5, 0.3, 0.015))
    .add(C.roofB, 0.02, ell(-0.62, 1.44, -0.5, 0.32, 0.26, 0.32), sph(-0.62, 1.72, -0.5, 0.04))
    .add(C.woodH, 0, box(0.5, 0.11, 0.8, 0.13, 0.1, 0.11, 0.015), box(0.46, 0.3, 0.79, 0.1, 0.085, 0.09, 0.015)).add(C.hay, 0.03, ell(-0.5, 0.1, 0.82, 0.17, 0.11, 0.13)),
  mill: () => millBody(),
  bakery: () => { const s = new Scene().add(C.peach, 0, box(0, 0.42, 0, 0.66, 0.42, 0.6, 0.03)).add(M('#b5553f'), 0, box(0, 0.06, 0, 0.69, 0.07, 0.63, 0.02))
    .add(C.roofT, 0, pyr(0, 0.82, 0, 0.82, 0.5, 0.02)).add(M('#b5553f'), 0, box(-0.36, 1.12, -0.3, 0.1, 0.24, 0.1, 0.015)).add(C.stone, 0, box(-0.36, 1.37, -0.3, 0.12, 0.03, 0.12, 0.01))
    .add(stripes('#f0504a', '#fff6e6', { axis: 'x', w: 0.16 }), 0, box(0.22, 0.58, 0.72, 0.36, 0.02, 0.14, 0.012, { rx: 24 }))
    .add(C.woodH, 0, box(0.22, 0.27, 0.64, 0.3, 0.02, 0.07, 0.01)).add(C.crust, 0.01, [0.04, 0.2, 0.38].map((x) => ell(x, 0.32, 0.66, 0.06, 0.035, 0.04)));
    door(s, -0.38, 0.6, 'z', 0.11, 0.2); win(s, 0.22, 0.42, 0.6, 'z', 0.24, 0.1); win(s, 0.66, 0.46, 0, 'x', 0.16, 0.12); return s; },
  dairy: () => { const s = new Scene().add(C.white, 0, box(0, 0.44, 0, 0.66, 0.44, 0.58, 0.03)).add(C.blue, 0, box(0, 0.1, 0, 0.675, 0.11, 0.595, 0.02))
    .add(C.roofB, 0, gable(0, 0.86, 0, 0.78, 0.44, 0.66, 0.02)).add(C.white, 0, gable(0, 0.86, 0, 0.66, 0.37, 0.58, 0), cap(-0.78, 0.86, 0.66, 0, 1.3, 0.66, 0.025), cap(0.78, 0.86, 0.66, 0, 1.3, 0.66, 0.025))
    .add(C.milk, 0.03, cyl(0.18, 1.3, -0.1, 0.13, 0.2, 0.05), cone(0.18, 1.46, -0.1, 0.13, 0.06, 0.12, 0.02), cyl(0.18, 1.62, -0.1, 0.06, 0.05, 0.02)).add(C.blue, 0, cyl(0.18, 1.69, -0.1, 0.07, 0.025, 0.012), box(0.18, 1.3, 0.035, 0.07, 0.07, 0.006, 0.006))
    .add(C.metal, 0.02, cyl(0.42, 0.17, 0.78, 0.1, 0.16, 0.03), cone(0.42, 0.32, 0.78, 0.1, 0.055, 0.08, 0.015), cyl(0.42, 0.42, 0.78, 0.06, 0.02, 0.01), cyl(0.18, 0.13, 0.84, 0.08, 0.12, 0.03), cone(0.18, 0.24, 0.84, 0.08, 0.045, 0.06, 0.012))
    .add(C.cheese, 0, cyl(0, 1.08, 0.6, 0.12, 0.02, 0.01, { rx: 90 }));
    door(s, -0.3, 0.58, 'z', 0.12, 0.21, M('#3f7fd0')); win(s, 0.3, 0.5, 0.58, 'z', 0.13, 0.12); win(s, 0.66, 0.5, 0, 'x', 0.16, 0.12); return s; },
  coop: () => { const s = new Scene().add(C.straw, 0, cyl(0.1, 0.012, 0.12, 0.7, 0.014, 0.01))
    .add(C.woodD, 0, [[-0.62, -0.62], [-0.18, -0.62], [-0.62, -0.18], [-0.18, -0.18]].map(([x, z]) => box(x, 0.1, z, 0.03, 0.1, 0.03, 0.01)), box(-0.12, 0.1, -0.12, 0.05, 0.012, 0.16, 0.008, { rx: -32, ry: 45 }))
    .add(C.woodH, 0, box(-0.4, 0.42, -0.4, 0.3, 0.23, 0.3, 0.02)).add(C.roofR, 0, gable(-0.4, 0.64, -0.4, 0.38, 0.26, 0.37, 0.02)).add(C.woodH, 0, gable(-0.4, 0.64, -0.4, 0.3, 0.2, 0.3, 0))
    .add(C.black, 0, cyl(-0.4, 0.4, -0.1, 0.09, 0.012, 0.006, { rx: 90 }), box(-0.4, 0.33, -0.1, 0.09, 0.07, 0.012, 0.006)).add(C.white, 0, tor(-0.4, 0.4, -0.095, 0.1, 0.014, { rx: 90 }))
    .add(C.hay, 0.03, ell(0.45, 0.07, -0.5, 0.17, 0.07, 0.14)).add(C.milk, 0, ell(0.42, 0.14, -0.48, 0.035, 0.045, 0.035), ell(0.5, 0.13, -0.52, 0.035, 0.045, 0.035))
    .add(C.woodD, 0.01, box(-0.55, 0.05, 0.5, 0.07, 0.04, 0.16, 0.02)).add(C.gold, 0, box(-0.55, 0.085, 0.5, 0.05, 0.012, 0.14, 0.01));
    return fence(s, [[-0.9, 0.9], [0.9, 0.9], [0.9, -0.9]], 0.2); },
  cowpen: () => { const s = new Scene().add(M('#a9c96a'), 0, cyl(0, 0.008, 0, 0.9, 0.01, 0.008))
    .add(C.woodD, 0, [[-0.8, -0.8], [-0.1, -0.8], [-0.8, -0.1], [-0.1, -0.1]].map(([x, z]) => box(x, 0.32, z, 0.035, 0.32, 0.035, 0.012)))
    .add(C.roofBr, 0, box(-0.45, 0.68, -0.45, 0.46, 0.03, 0.46, 0.015, { rx: 10, rz: -6 })).add(C.hay, 0.04, ell(-0.52, 0.1, -0.52, 0.22, 0.12, 0.2), ell(-0.3, 0.07, -0.62, 0.14, 0.08, 0.12))
    .add(C.woodH, 0, box(0.55, 0.1, -0.6, 0.24, 0.09, 0.1, 0.02)).add(C.water, 0, box(0.55, 0.185, -0.6, 0.2, 0.012, 0.065, 0.008));
    return fence(s, [[-0.92, 0.92], [0.92, 0.92], [0.92, -0.92]], 0.26); },
  board: () => new Scene().add(C.woodD, 0, box(-0.3, 0.3, 0, 0.03, 0.3, 0.03, 0.01), box(0.3, 0.3, 0, 0.03, 0.3, 0.03, 0.01)).add(C.woodH, 0, box(0, 0.4, 0, 0.36, 0.2, 0.025, 0.012))
    .add(C.roofR, 0, gable(0, 0.62, 0, 0.44, 0.12, 0.09, 0.012, { ry: 90 }))
    .add(M('#fff6e6'), 0, box(-0.2, 0.44, 0.03, 0.08, 0.1, 0.006, 0.004, { rz: 4 })).add(M('#ffe27a'), 0, box(0.0, 0.4, 0.03, 0.08, 0.1, 0.006, 0.004, { rz: -5 })).add(M('#9fd8f2'), 0, box(0.2, 0.43, 0.03, 0.08, 0.1, 0.006, 0.004, { rz: 3 }))
    .add(C.redS, 0, sph(-0.2, 0.52, 0.04, 0.016), sph(0, 0.48, 0.04, 0.016), sph(0.2, 0.51, 0.04, 0.016))
    .add(C.woodH, 0, box(0.22, 0.09, 0.26, 0.13, 0.085, 0.11, 0.015)).add(C.tomato, 0.01, [[0.16, 0.24], [0.27, 0.22], [0.2, 0.31], [0.29, 0.3]].map(([x, z]) => sph(x, 0.19, z, 0.045))),
};

const ANIMAL = {
  chicken: () => new Scene().add(C.white, 0.06, ell(0, 0.2, 0, 0.16, 0.135, 0.125), sph(0.1, 0.27, 0, 0.09), sph(0.14, 0.36, 0, 0.078), ell(-0.17, 0.28, 0, 0.07, 0.1, 0.05, { rz: 30 }))
    .add(M('#f1e6d2'), 0.02, ell(-0.02, 0.21, 0.115, 0.1, 0.075, 0.03), ell(-0.02, 0.21, -0.115, 0.1, 0.075, 0.03))
    .add(C.redS, 0.02, sph(0.12, 0.45, 0, 0.03), sph(0.16, 0.455, 0, 0.032), sph(0.195, 0.44, 0, 0.026), ell(0.215, 0.3, 0, 0.022, 0.035, 0.02))
    .add(C.orange, 0, ell(0.235, 0.355, 0, 0.04, 0.022, 0.026), cap(0.02, 0.0, 0.05, 0.02, 0.09, 0.05, 0.012), cap(0.02, 0.0, -0.05, 0.02, 0.09, -0.05, 0.012), ell(0.045, 0.012, 0.05, 0.04, 0.012, 0.03), ell(0.045, 0.012, -0.05, 0.04, 0.012, 0.03))
    .add(C.black, 0, sph(0.185, 0.385, 0.06, 0.014), sph(0.185, 0.385, -0.06, 0.014)),
  cow: () => new Scene().add(C.cow, 0.08, ell(0, 0.36, 0, 0.3, 0.19, 0.17), ell(0.3, 0.47, 0, 0.13, 0.12, 0.11), sph(0.2, 0.4, 0, 0.13))
    .add(C.cow, 0, [[0.18, 0.09], [0.18, -0.09], [-0.2, 0.09], [-0.2, -0.09]].map(([x, z]) => cyl(x, 0.13, z, 0.05, 0.13, 0.03)))
    .add(C.black, 0, [[0.18, 0.09], [0.18, -0.09], [-0.2, 0.09], [-0.2, -0.09]].map(([x, z]) => cyl(x, 0.03, z, 0.055, 0.035, 0.02)), sph(0.37, 0.52, 0.09, 0.018), sph(0.37, 0.52, -0.09, 0.018), cap(-0.3, 0.42, 0, -0.36, 0.2, 0, 0.014), sph(-0.36, 0.18, 0, 0.03))
    .add(C.pink, 0.02, ell(0.42, 0.43, 0, 0.07, 0.075, 0.085), sph(-0.08, 0.19, 0, 0.07))
    .add(M('#fff6e6'), 0, cap(0.3, 0.57, 0.07, 0.31, 0.64, 0.1, 0.016), cap(0.3, 0.57, -0.07, 0.31, 0.64, -0.1, 0.016))
    .add(C.cow, 0, ell(0.27, 0.53, 0.14, 0.03, 0.045, 0.06, { rx: 25 }), ell(0.27, 0.53, -0.14, 0.03, 0.045, 0.06, { rx: -25 }))
    .add(M('#5a3d2b'), 0, sph(0.47, 0.45, 0.035, 0.012), sph(0.47, 0.45, -0.035, 0.012)),
};

const canopy = (y = 0.84) => [sph(0, y, 0, 0.27), sph(0.05, y + 0.22, 0.02, 0.2), ...[0, 1, 2, 3, 4, 5].map((k) => sph(Math.cos(k * 1.047 + 0.4) * 0.24, y - 0.08 + (k % 2) * 0.09, Math.sin(k * 1.047 + 0.4) * 0.24, 0.17 + (k % 3) * 0.02)), sph(-0.14, y + 0.17, 0.12, 0.14), sph(0.16, y + 0.12, -0.1, 0.14)];
const DECOR = {
  tree: () => new Scene().add(C.brown, 0.03, cone(0, 0, 0, 0.1, 0.07, 0.55, 0.02), cap(0, 0.4, 0, 0.14, 0.6, 0.05, 0.035), cap(0, 0.4, 0, -0.13, 0.62, -0.03, 0.035)).add(C.leaf, 0.035, canopy()),
  appletree: () => new Scene().add(C.brown, 0.03, cone(0, 0, 0, 0.1, 0.07, 0.55, 0.02)).add(C.leafL, 0.035, canopy())
    .add(C.redS, 0, [[0.3, 0.86, 0.24], [-0.08, 0.7, 0.4], [0.4, 0.7, 0.02], [-0.32, 0.9, 0.2], [0.1, 1.1, 0.24], [-0.24, 0.66, 0.26], [0.16, 0.66, 0.38]].map(([x, y, z]) => sph(x, y, z, 0.05))),
  pine: () => new Scene().add(C.brown, 0, cone(0, 0, 0, 0.07, 0.05, 0.3, 0.02)).add(C.leafD, 0.03, cone(0, 0.22, 0, 0.36, 0.14, 0.34, 0.04), cone(0, 0.5, 0, 0.29, 0.1, 0.32, 0.04), cone(0, 0.77, 0, 0.21, 0.02, 0.36, 0.035)),
  bush: () => new Scene().add(C.leaf, 0.07, sph(0, 0.16, 0, 0.2), sph(0.17, 0.13, 0.05, 0.15), sph(-0.16, 0.12, 0.03, 0.15), sph(0.02, 0.12, 0.17, 0.14))
    .add(C.pink, 0, [[0.1, 0.3, 0.12], [-0.12, 0.25, 0.14], [0.22, 0.2, 0.14], [0, 0.33, -0.02], [-0.2, 0.2, -0.04], [0.06, 0.2, 0.26]].map(([x, y, z]) => sph(x, y, z, 0.035))),
  flowers: () => { const s = new Scene().add(C.leaf, 0.02, grid(3, (x, z, i) => [cap(x, 0, z, x, 0.14 + jit(i, 2) * 0.05, z, 0.01), ...leafPair(x, 0.05, z, i, 0.05)], 0.26));
    [['#ff7aa8', 0], ['#ffd23f', 1], ['#fff6e6', 2], ['#b58cf0', 3]].forEach(([c, m]) => s.add(M(c), 0.01, grid(3, (x, z, i) => (i % 4 === m ? [sph(x, 0.18 + jit(i, 2) * 0.05, z, 0.04), sph(x + 0.03, 0.17 + jit(i, 2) * 0.05, z + 0.02, 0.03), sph(x - 0.03, 0.17 + jit(i, 2) * 0.05, z + 0.02, 0.03)] : null), 0.26)));
    return s.add(C.yellow, 0, grid(3, (x, z, i) => (i % 4 !== 1 ? sph(x + 0.012, 0.2 + jit(i, 2) * 0.05, z + 0.022, 0.017) : null), 0.26)); },
  fence_x: () => fence(new Scene(), [[-0.5, 0], [0.5, 0]], 0.24),
  fence_z: () => fence(new Scene(), [[0, -0.5], [0, 0.5]], 0.24),
  hay: () => new Scene().add(C.hay, 0, cyl(0, 0.27, 0, 0.27, 0.24, 0.04, { rz: 90, ry: 30, disp: (x, y, z) => 0.006 * Math.sin((x * 0.866 - z * 0.5) * 90) })).add(C.brown, 0, [-0.1, 0.1].map((d) => tor(d * 0.866, 0.27, -d * 0.5, 0.275, 0.012, { rz: 90, ry: 30 }))),
  pond: () => new Scene().add(C.water, 0, cyl(0, 0.012, 0, 0.74, 0.014, 0.012)).add(C.stone, 0.03, Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * 6.283; return ell(Math.cos(a) * 0.78, 0.04, Math.sin(a) * 0.78, 0.11 + jit(i, 3) * 0.04, 0.06, 0.09); }))
    .add(C.leafL, 0, cyl(0.2, 0.03, 0.25, 0.1, 0.006, 0.005), cyl(-0.25, 0.03, -0.1, 0.08, 0.006, 0.005), cyl(0.05, 0.03, -0.35, 0.07, 0.006, 0.005)).add(C.pink, 0, sph(0.2, 0.05, 0.25, 0.035))
    .add(C.leafD, 0, [[-0.5, -0.45], [-0.56, -0.36], [-0.44, -0.52]].map(([x, z], i) => cap(x, 0, z, x + 0.03, 0.4 + i * 0.06, z, 0.012))).add(C.brown, 0, [[-0.5, -0.45], [-0.56, -0.36]].map(([x, z], i) => cap(x + 0.03, 0.36 + i * 0.06, z, x + 0.03, 0.46 + i * 0.06, z, 0.025))),
  scarecrow: () => new Scene().add(C.woodD, 0, cap(0, 0, 0, 0, 0.7, 0, 0.022), cap(-0.3, 0.5, 0, 0.3, 0.5, 0, 0.02))
    .add(stripes('#e2553b', '#f5d76a', { axis: 'y', w: 0.07 }), 0.03, box(0, 0.42, 0, 0.13, 0.14, 0.07, 0.04), cap(-0.26, 0.5, 0, 0.26, 0.5, 0, 0.045))
    .add(C.sack, 0, sph(0, 0.68, 0, 0.1)).add(C.hay, 0.02, cyl(0, 0.76, 0, 0.18, 0.012, 0.01), cone(0, 0.76, 0, 0.1, 0.04, 0.13, 0.02), sph(-0.31, 0.5, 0, 0.04), sph(0.31, 0.5, 0, 0.04))
    .add(C.black, 0, sph(0.03, 0.7, 0.092, 0.014), sph(0.085, 0.7, 0.045, 0.014)),
  well: () => new Scene().add(C.stone, 0, cyl(0, 0.16, 0, 0.3, 0.17, 0.03)).add(M('#2c6fa8', { spec: 0.8 }), 0, cyl(0, 0.325, 0, 0.23, 0.01, 0.005))
    .add(C.woodD, 0, box(-0.27, 0.5, 0, 0.03, 0.3, 0.03, 0.01), box(0.27, 0.5, 0, 0.03, 0.3, 0.03, 0.01), cap(-0.27, 0.62, 0, 0.27, 0.62, 0, 0.02))
    .add(C.roofR, 0, gable(0, 0.78, 0, 0.26, 0.16, 0.38, 0.015, { ry: 90 })).add(C.woodH, 0, cyl(0.02, 0.45, 0, 0.06, 0.06, 0.012)),
  rock: () => new Scene().add(C.stone, 0.06, ell(0, 0.1, 0, 0.22, 0.14, 0.17), ell(0.17, 0.07, 0.08, 0.13, 0.09, 0.11), ell(-0.12, 0.06, 0.13, 0.1, 0.07, 0.09)),
};

// ---- ürün ikonları ----
const sackOf = (band) => () => new Scene().add(C.sack, 0.06, ell(0, 0.2, 0, 0.19, 0.2, 0.15), ell(0, 0.4, 0, 0.11, 0.06, 0.09), ell(0, 0.46, 0, 0.14, 0.035, 0.11)).add(M(band), 0, box(0.05, 0.2, 0.135, 0.09, 0.07, 0.012, 0.01, { ry: 14 })).add(C.woodD, 0, tor(0, 0.41, 0, 0.1, 0.012));
const ITEMS = {
  wheat: () => new Scene().add(C.gold, 0, [-2, -1, 0, 1, 2].map((k) => cap(0, 0, 0, k * 0.07, 0.36, k * 0.02, 0.014))).add(C.goldD, 0, [-2, -1, 0, 1, 2].map((k) => ell(k * 0.085, 0.44, k * 0.024, 0.04, 0.1, 0.04, { rz: -k * 11 }))).add(C.redS, 0, tor(0, 0.14, 0, 0.035, 0.016)),
  corn: () => new Scene().add(C.yellow, 0, ell(0, 0.26, 0, 0.11, 0.24, 0.11, { rz: -16, disp: (x, y, z) => 0.006 * Math.sin(y * 60) * Math.sin(Math.atan2(z, x) * 9) })).add(C.leaf, 0.01, ell(-0.05, 0.14, 0.06, 0.07, 0.19, 0.035, { rz: 14, ry: 30 }), ell(0.1, 0.14, -0.02, 0.07, 0.17, 0.035, { rz: -40, ry: -20 }), ell(0, 0.1, 0.1, 0.06, 0.13, 0.03, { rx: 30 })),
  carrot: () => new Scene().add(C.orange, 0, cone(0, 0, 0, 0.02, 0.1, 0.38, 0.02, { rz: -24 })).add(C.leaf, 0.01, [-1, 0, 1].map((k) => ell(-0.17 + k * 0.05, 0.47, k * 0.03, 0.03, 0.1, 0.03, { rz: 24 + k * 22 }))),
  tomato: () => new Scene().add(C.tomato, 0, ell(0, 0.17, 0, 0.19, 0.17, 0.19)).add(C.leafD, 0, [0, 1, 2, 3, 4].map((k) => ell(Math.cos(k * 1.257) * 0.06, 0.335, Math.sin(k * 1.257) * 0.06, 0.07, 0.012, 0.028, { ry: -k * 72 })), cap(0, 0.33, 0, 0.01, 0.4, 0, 0.014)),
  sunflower: () => { const f = flower(0, 0.24, 0, 0.19); return new Scene().add(C.yellow, 0.03, f.pet).add(C.brown, 0, f.mid); },
  pumpkin: () => new Scene().add(C.pump, 0, pumpkin(0, 0.17, 0, 0.21)).add(C.leafD, 0, cap(0, 0.32, 0, 0.03, 0.41, 0, 0.022)),
  egg: () => new Scene().add(M('#fff1dc', { spec: 0.5, gloss: 30 }), 0, ell(0, 0.17, 0, 0.13, 0.17, 0.13)),
  milk: () => new Scene().add(C.milk, 0.04, cyl(0, 0.17, 0, 0.12, 0.17, 0.04), cone(0, 0.32, 0, 0.12, 0.055, 0.1, 0.015), cyl(0, 0.45, 0, 0.055, 0.04, 0.012)).add(C.blue, 0, cyl(0, 0.5, 0, 0.065, 0.022, 0.01), box(0, 0.17, 0.115, 0.07, 0.07, 0.008, 0.008)),
  feed_c: sackOf('#ffd23f'), feed_w: sackOf('#5fb346'),
  bread: () => new Scene().add(C.crust, 0.04, ell(0, 0.13, 0, 0.26, 0.13, 0.15), box(0, 0.05, 0, 0.2, 0.05, 0.11, 0.05)).add(M('#f7e2b8'), 0, [-0.12, 0, 0.12].map((d) => cap(d - 0.03, 0.118 + 0.13 * Math.sqrt(1 - (d / 0.26) ** 2) * 0.93, -0.06, d + 0.03, 0.118 + 0.13 * Math.sqrt(1 - (d / 0.26) ** 2) * 0.93, 0.07, 0.02))),
  cornbread: () => new Scene().add(mottle('#ffc94a', '#e9a92a', 14), 0, box(0, 0.1, 0, 0.19, 0.1, 0.16, 0.04)).add(mottle('#d99548', '#c07a30', 12), 0, box(0, 0.185, 0, 0.185, 0.025, 0.155, 0.025)),
  cake: () => new Scene().add(C.crust, 0, cyl(0, 0.1, 0, 0.2, 0.1, 0.03)).add(M('#fff6e6'), 0.03, cyl(0, 0.215, 0, 0.205, 0.03, 0.025), ...[0, 1, 2, 3, 4, 5].map((k) => sph(Math.cos(k * 1.047) * 0.19, 0.17, Math.sin(k * 1.047) * 0.19, 0.045))).add(C.orange, 0, cone(0, 0.24, 0, 0.012, 0.04, 0.12, 0.012, { rz: 40 })).add(C.leaf, 0, sph(-0.07, 0.34, 0, 0.025)),
  pizza: () => new Scene().add(C.crust, 0, cyl(0, 0.03, 0, 0.26, 0.03, 0.025)).add(M('#e8452e'), 0, cyl(0, 0.055, 0, 0.215, 0.012, 0.01)).add(C.cheese, 0.03, [[0, 0], [0.1, 0.08], [-0.1, 0.06], [0.04, -0.12], [-0.08, -0.09], [0.13, -0.05]].map(([x, z]) => ell(x, 0.07, z, 0.07, 0.012, 0.06))).add(C.tomato, 0, [[0.06, 0.02], [-0.07, 0.1], [-0.03, -0.1], [0.12, -0.1]].map(([x, z]) => cyl(x, 0.085, z, 0.035, 0.006, 0.004))).add(C.leaf, 0, ell(0, 0.09, 0.04, 0.03, 0.006, 0.018), ell(0.09, 0.09, 0.1, 0.03, 0.006, 0.018, { ry: 50 })),
  cream: () => new Scene().add(C.blue, 0, cone(0, 0, 0, 0.12, 0.2, 0.14, 0.02)).add(C.milk, 0.05, cyl(0, 0.15, 0, 0.17, 0.02, 0.015), sph(0, 0.2, 0, 0.1), sph(0, 0.28, 0, 0.065), sph(0.01, 0.34, 0, 0.035)),
  butter: () => new Scene().add(M('#fff6e6', { spec: 0.5 }), 0, cyl(0, 0.015, 0, 0.26, 0.015, 0.012)).add(M('#ffdc5a', { spec: 0.4, gloss: 30 }), 0, box(0, 0.1, 0, 0.17, 0.07, 0.1, 0.025, { ry: -25 })),
  cheese: () => new Scene().add(C.cheese, 0, cyl(0, 0.11, 0, 0.24, 0.11, 0.03)).add(M('#e9a92a'), 0, tor(0, 0.11, 0, 0.243, 0.012)),
  coin: () => { const R = { rx: 62, ry: 35 }; return new Scene().add(C.coin, 0, cyl(0, 0.22, 0, 0.21, 0.04, 0.025, R)).add(C.coinD, 0, cyl(0, 0.22, 0, 0.165, 0.046, 0.01, R)).add(C.coin, 0, tor(0, 0.22, 0, 0.19, 0.036, R)).add(M('#ffe680', { spec: 0.9, gloss: 50 }), 0, starP(0, 0.22, 0, 0.11, 0.062, R)); },
};
const HERO = { // oyun salonu kapağı ve boş ekranlar için küçük sahne
  hero: () => { const s = BUILD.barn(); const t = DECOR.appletree(); t.groups.forEach((g) => g.prims.forEach((p) => { const d0 = p.d; p.d = (x, y, z) => d0(x - 1.25, y, z + 0.2); p.c = [p.c[0] + 1.25, p.c[1], p.c[2] - 0.2]; })); s.groups.push(...t.groups); return s; },
};

export const SCENES = {
  plot: obj(() => soil()),
  ...Object.fromEntries(Object.entries(CROPS).map(([k, f]) => [k, obj(f)])),
  ...Object.fromEntries(Object.entries(BUILD).map(([k, f]) => [k, obj(f)])),
  ...Object.fromEntries([0, 15, 30, 45, 60, 75].map((d, i) => [`rotor_${i}`, { build: () => blades(new Scene(), d + 10), opt: { ground: false }, set: 'obj' }])),
  ...Object.fromEntries(Object.entries(ANIMAL).map(([k, f]) => [k, obj(f)])),
  ...Object.fromEntries(Object.entries(DECOR).map(([k, f]) => [k, obj(f)])),
  ...Object.fromEntries(Object.entries(ITEMS).map(([k, f]) => [`i_${k}`, item(f)])),
  hero: { build: HERO.hero, opt: { S: 150 }, set: 'hero' },
};

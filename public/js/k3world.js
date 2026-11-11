// Parti Kupası arka planı: arenalar gökyüzünde yüzer, altında rengârenk bir köy ya da şehir uzanır.
// Her şey tek çizimde binlerce kopya (InstancedMesh) olarak kurulur; telefonlarda akıcı kalır.
// Yerleşim tohumlu rastgeledir: aynı odadaki herkes aynı manzarayı görür.

const rng = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export const THEMES = {
  koy: { name: 'Köy', top: 0x2f9bf0, mid: 0x8fd6ff, low: 0xe9f8ff, fog: 0xd6f1fb, ground: 0x86cf63, hemi: 0x9ad17a, sun: 0xfff3d0 },
  sehir: { name: 'Şehir', top: 0x4f74f5, mid: 0xa9a2ff, low: 0xffd0e2, fog: 0xf3cde3, ground: 0xc9c3e6, hemi: 0xb7a6e8, sun: 0xffe9d6 },
  volkan: { name: 'Yanardağ', top: 0x1d0f3a, mid: 0x7a2a5c, low: 0xff9448, fog: 0x6e2c4c, ground: 0x2b1a2c, hemi: 0x8a3a4a, sun: 0xffc48a },
};
// Hangi turda hangi manzara: lav kulesi hep yanardağda; diğerleri oda ve tura göre köy ya da şehir
export function themeFor(mode, seed) { if (mode === 'lav') return 'volkan'; return seed % 2 ? 'sehir' : 'koy'; }
export function seedOf(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

const WALLS = [0xfff4e2, 0xffe1ec, 0xfff7b8, 0xd9f1ff, 0xffdcb8, 0xe6dcff];
const ROOFS = [0xe8483f, 0xff7a3d, 0x23bfb0, 0x8a5bd8, 0xff5d8f, 0x3d8bfd, 0xf2b705];
const LEAVES = [0x3fae5a, 0x57c26b, 0x2f9a52, 0x7bd66f, 0xff9ec4, 0xffb347];
const FIELDS = [0xf6d867, 0xff9ec4, 0xb79cff, 0xb8e986, 0x62c370, 0xffc56e, 0x9be7d8];
const CANDY = [0xff8fab, 0xffc971, 0x8ecae6, 0xa8e6a1, 0xcdb4db, 0xff9b85, 0xfdf3a0, 0x8be0e8, 0xa0c4ff, 0xf7a8d8];
const CARS = [0xff4d6d, 0xffd60a, 0x3a86ff, 0x06d6a0, 0xff9f1c, 0xffffff, 0x9d4edd];

export function makeWorld(T, scene, hemi, sun) {
  const d = new T.Object3D(); const col = new T.Color(); const c2 = new T.Color(); const c3 = new T.Color(); const tmp = new T.Color();
  let g = null; let anim = []; let key = '';
  const lam = (o = {}) => new T.MeshLambertMaterial({ color: 0xffffff, ...o });
  // Gökyüzü kubbesi: ufukta açık, tepede koyu; kamerayı izler
  const domeGeo = new T.SphereGeometry(205, 24, 14); domeGeo.setAttribute('color', new T.BufferAttribute(new Float32Array(domeGeo.attributes.position.count * 3), 3));
  const dome = new T.Mesh(domeGeo, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false })); dome.renderOrder = -10; dome.frustumCulled = false; scene.add(dome);
  const paintSky = (th) => {
    const p = domeGeo.attributes.position; const c = domeGeo.attributes.color; col.setHex(th.top); c2.setHex(th.mid); c3.setHex(th.fog); // ufuk çizgisi sis rengiyle aynı: zemin gökyüzüne karışır
    for (let i = 0; i < p.count; i++) { const h = p.getY(i) / 205; if (h < 0.02) tmp.copy(c3); else if (h < 0.3) tmp.copy(c3).lerp(c2, (h - 0.02) / 0.28); else tmp.copy(c2).lerp(col, Math.min(1, (h - 0.3) / 0.6)); c.setXYZ(i, tmp.r, tmp.g, tmp.b); }
    c.needsUpdate = true;
  };
  const inst = (geo, mat, list) => {
    if (!list.length) return null; const im = new T.InstancedMesh(geo, mat, list.length);
    list.forEach((o, i) => { d.position.set(o.x, o.y, o.z); d.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0); d.scale.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1); d.updateMatrix(); im.setMatrixAt(i, d.matrix); im.setColorAt(i, col.setHex(o.c ?? 0xffffff)); });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; g.add(im); return im;
  };
  const add = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };

  // Ortak süsler: bulutlar ve sıcak hava balonları
  function sky(R, b, th, gy, n = 9) {
    const puffs = []; const clouds = [];
    for (let i = 0; i < n; i++) { const a = R() * Math.PI * 2; const r = 55 + R() * 95; const cx = b.cx + Math.cos(a) * r; const cz = b.cz + Math.sin(a) * r; const cy = 16 + R() * 34; const s = 3.5 + R() * 4; const first = puffs.length;
      for (let k = 0; k < 4; k++) puffs.push({ x: cx + (k - 1.5) * s * 0.95, y: cy + (k % 2 ? s * 0.25 : 0), z: cz + (R() - 0.5) * s, sx: s * (0.9 + R() * 0.5), sy: s * (0.55 + R() * 0.25), sz: s * (0.8 + R() * 0.4), c: th === THEMES.volkan ? 0xffb38a : 0xffffff });
      clouds.push({ first, v: 0.5 + R() * 0.9 }); }
    const im = inst(new T.SphereGeometry(1, 10, 8), lam({ emissive: th === THEMES.volkan ? 0x5a2030 : 0x9fb6c9, emissiveIntensity: 0.55 }), puffs);
    anim.push((now, dt) => { clouds.forEach((cl) => { for (let k = 0; k < 4; k++) { const p = puffs[cl.first + k]; p.x += cl.v * dt; if (p.x > b.cx + 170) p.x -= 340; d.position.set(p.x, p.y, p.z); d.rotation.set(0, 0, 0); d.scale.set(p.sx, p.sy, p.sz); d.updateMatrix(); im.setMatrixAt(cl.first + k, d.matrix); } }); im.instanceMatrix.needsUpdate = true; });
    if (th === THEMES.volkan) return;
    const bg = new T.SphereGeometry(1, 14, 12); const basket = new T.BoxGeometry(0.9, 0.7, 0.9); const neck = new T.CylinderGeometry(0.55, 0.28, 1.1, 8, 1, true);
    for (let i = 0; i < 5; i++) { const a = R() * Math.PI * 2; const r = b.rx + 14 + R() * 60; const grp = new T.Group(); const c = CANDY[(i * 3 + ((R() * 3) | 0)) % CANDY.length]; const s = 2.6 + R() * 1.6;
      const top = new T.Mesh(bg, lam({ color: c })); top.scale.set(s, s * 1.15, s); grp.add(top);
      const band = new T.Mesh(new T.TorusGeometry(s * 0.985, s * 0.13, 6, 20), lam({ color: 0xffffff })); band.rotation.x = Math.PI / 2; grp.add(band);
      const nk = new T.Mesh(neck, lam({ color: c, side: T.DoubleSide })); nk.scale.setScalar(s * 0.9); nk.position.y = -s * 1.35; grp.add(nk);
      const bk = new T.Mesh(basket, lam({ color: 0x9b6b43 })); bk.scale.setScalar(s * 0.55); bk.position.y = -s * 2.2; grp.add(bk);
      const x = b.cx + Math.cos(a) * r; const z = b.cz + Math.sin(a) * r; const y0 = gy + 16 + R() * 22; const ph = R() * 6; grp.position.set(x, y0, z); g.add(grp);
      anim.push((now) => { grp.position.y = y0 + Math.sin(now / 2600 + ph) * 1.6; grp.position.x = x + Math.sin(now / 9000 + ph) * 5; grp.rotation.y = now / 7000 + ph; }); }
  }
  const out = (b, x, z, pad = 0) => ((x - b.cx) / (b.rx + pad)) ** 2 + ((z - b.cz) / (b.rz + pad)) ** 2 > 1;

  // ---- Köy: tarlalar, toprak yollar, renkli çatılı evler, ağaçlar, yel değirmeni, dere ----
  function koy(R, b, th, gy) {
    const s1 = R() * 6; const s2 = R() * 6; const dens = (x, z) => Math.sin(x * 0.045 + s1) * Math.cos(z * 0.04 + s2) + Math.sin((x + z) * 0.021 + s2) * 0.5;
    const X0 = b.cx - b.rx - 118; const X1 = b.cx + b.rx + 118; const Z0 = b.cz - b.rz - 118; const Z1 = b.cz + b.rz + 118;
    const fields = []; const walls = []; const roofs = []; const bits = []; const trunks = []; const crowns = []; const hay = [];
    for (let x = X0; x < X1; x += 22) for (let z = Z0; z < Z1; z += 22) { // tarlalar (arenanın altı dahil)
      const fx = x + 11 + (R() - 0.5) * 3; const fz = z + 11 + (R() - 0.5) * 3; if (dens(fx, fz) > 0.25 && out(b, fx, fz, 4)) continue;
      const c = FIELDS[(R() * FIELDS.length) | 0]; fields.push({ x: fx, y: gy + 0.03 + R() * 0.02, z: fz, rx: -Math.PI / 2, rz: (R() - 0.5) * 0.3, sx: 15 + R() * 6, sy: 15 + R() * 6, c });
      if (c === 0xf6d867 && R() < 0.7 && out(b, fx, fz)) for (let k = 0; k < 3; k++) hay.push({ x: fx + (R() - 0.5) * 12, y: gy + 0.7, z: fz + (R() - 0.5) * 12, rz: Math.PI / 2, ry: R() * 3, sx: 0.75, sy: 1.3, sz: 0.75, c: 0xe9c75a });
    }
    const house = (px, pz, face) => {
        const w = 6 + R() * 3.2; const dp = 6 + R() * 3; const h = 4.4 + R() * 2; const ry = face ?? ((R() * 4) | 0) * (Math.PI / 2) + (R() - 0.5) * 0.4; const rc = ROOFS[(R() * ROOFS.length) | 0];
        walls.push({ x: px, y: gy + h / 2, z: pz, ry, sx: w, sy: h, sz: dp, c: WALLS[(R() * WALLS.length) | 0] });
        roofs.push({ x: px, y: gy + h + 1.8, z: pz, ry: ry + Math.PI / 4, sx: Math.max(w, dp) * 1.1, sy: 3.6, sz: Math.max(w, dp) * 1.1, c: rc });
        const fx = Math.sin(ry); const fz = Math.cos(ry); // ön yüz: kapı ve iki pencere
        bits.push({ x: px + fx * (dp / 2 + 0.03), y: gy + 1.4, z: pz + fz * (dp / 2 + 0.03), ry, sx: 1.4, sy: 2.8, sz: 0.12, c: rc });
        [-1, 1].forEach((s) => bits.push({ x: px + fx * (dp / 2 + 0.03) + fz * s * w * 0.3, y: gy + h * 0.6, z: pz + fz * (dp / 2 + 0.03) - fx * s * w * 0.3, ry, sx: 1.3, sy: 1.3, sz: 0.12, c: 0x7fd3ff }));
        if (R() < 0.5) bits.push({ x: px - fz * w * 0.25, y: gy + h + 3, z: pz + fx * w * 0.25, sx: 0.7, sy: 2.2, sz: 0.7, c: 0xb5654a }); // baca
    };
    const plaza = Math.round((b.rx + b.rz) * 0.55); // meydanı çevreleyen evler: yüzleri arenaya bakar
    for (let k = 0; k < plaza; k++) { if (R() < 0.18) continue; const a = (k / plaza) * Math.PI * 2 + s1; const rr = 17 + (k % 2) * 8 + R() * 3; house(b.cx + Math.cos(a) * (b.rx + rr), b.cz + Math.sin(a) * (b.rz + rr), Math.atan2(-Math.cos(a), -Math.sin(a))); }
    for (let x = X0; x < X1; x += 13) for (let z = Z0; z < Z1; z += 13) { // evler ve ağaçlar
      const px = x + 3 + R() * 7; const pz = z + 3 + R() * 7; if (!out(b, px, pz, 5)) continue; const dn = dens(px, pz);
      if (dn > 0.15 && R() < 0.62) house(px, pz);
      else if (dn > -0.55 ? R() < 0.42 : R() < 0.12) {
        const s = 1.2 + R() * 1.1; trunks.push({ x: px, y: gy + 1.1 * s, z: pz, sx: s, sy: s, sz: s, c: 0x8a5a3c });
        crowns.push({ x: px, y: gy + 3.2 * s, z: pz, ry: R() * 3, sx: 1.7 * s, sy: (1.7 + R() * 0.7) * s, sz: 1.7 * s, c: LEAVES[R() < 0.84 ? (R() * 4) | 0 : 4 + ((R() * 2) | 0)] });
      }
    }
    inst(new T.PlaneGeometry(1, 1), lam(), fields);
    inst(new T.BoxGeometry(1, 1, 1), lam(), walls); inst(new T.ConeGeometry(0.72, 1, 4), lam({ flatShading: true }), roofs); inst(new T.BoxGeometry(1, 1, 1), lam(), bits);
    inst(new T.CylinderGeometry(0.22, 0.32, 2.2, 6), lam(), trunks); inst(new T.IcosahedronGeometry(1, 0), lam({ flatShading: true }), crowns); inst(new T.CylinderGeometry(1, 1, 1, 12), lam(), hay);
    // Arenayı çevreleyen toprak yol ve dışarı uzanan kollar
    const road = lam({ color: 0xead3a4 }); const ring = add(new T.RingGeometry(1, 1.16, 64), road, b.cx, gy + 0.07, b.cz); ring.rotation.x = -Math.PI / 2; ring.scale.set(b.rx + 9, b.rz + 9, 1);
    for (let k = 0; k < 4; k++) { const a = s1 + (k * Math.PI) / 2; const len = 110; const m = add(new T.PlaneGeometry(4, len), road, b.cx + Math.cos(a) * (b.rx + 10 + len / 2), gy + 0.065, b.cz + Math.sin(a) * (b.rz + 10 + len / 2)); m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI / 2 - a; }
    // Kıvrılan dere
    const pts = []; const side = R() < 0.5 ? -1 : 1; const N = 44;
    for (let i = 0; i <= N; i++) { const x = X0 + ((X1 - X0) * i) / N; const z = b.cz + side * (b.rz + 34) + Math.sin(i * 0.42 + s1) * 13; const w = 3.6 + Math.sin(i * 0.9) * 0.8; pts.push(x, gy + 0.09, z - w, x, gy + 0.09, z + w); }
    const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.Float32BufferAttribute(pts, 3)); const idx = []; for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } rg.setIndex(idx); rg.computeVertexNormals();
    add(rg, new T.MeshBasicMaterial({ color: 0x4cc5f4, side: T.DoubleSide }), 0, 0, 0);
    // Yel değirmenleri
    for (let k = 0; k < 2; k++) { const a = s2 + k * 2.6 + 0.8; const r = 26 + R() * 18; const x = b.cx + Math.cos(a) * (b.rx + r); const z = b.cz + Math.sin(a) * (b.rz + r);
      add(new T.CylinderGeometry(1.5, 2.4, 9, 10), lam({ color: 0xfff4e2 }), x, gy + 4.5, z); add(new T.ConeGeometry(2, 2.2, 10), lam({ color: 0xe8483f }), x, gy + 10.1, z);
      const hub = new T.Group(); hub.position.set(x, gy + 8.4, z + 1.7); for (let i = 0; i < 4; i++) { const bl = new T.Mesh(new T.BoxGeometry(1.1, 6.2, 0.12), lam({ color: 0xffffff })); bl.position.set(Math.cos((i * Math.PI) / 2) * 3.3, Math.sin((i * Math.PI) / 2) * 3.3, 0); bl.rotation.z = (i * Math.PI) / 2 + Math.PI / 2; hub.add(bl); } g.add(hub);
      anim.push((now) => { hub.rotation.z = now / (1400 + k * 500); }); }
    // Ufukta tepeler
    const hills = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + R(); const r = 128 + R() * 30; hills.push({ x: b.cx + Math.cos(a) * (b.rx + r), y: gy - 4, z: b.cz + Math.sin(a) * (b.rz + r), sx: 30 + R() * 26, sy: 12 + R() * 16, sz: 30 + R() * 26, c: [0x6cc06a, 0x58b866, 0x86cf63][i % 3] }); }
    inst(new T.SphereGeometry(1, 14, 8), lam(), hills);
  }

  // ---- Şehir: yollar, şeker rengi binalar, parklar, giden arabalar, dönme dolap ----
  function sehir(R, b, th, gy) {
    const G = 28; const X0 = Math.floor((b.cx - b.rx - 120) / G) * G; const X1 = b.cx + b.rx + 120; const Z0 = Math.floor((b.cz - b.rz - 120) / G) * G; const Z1 = b.cz + b.rz + 120;
    const roads = []; const marks = []; const blds = []; const tops = []; const parks = []; const trunks = []; const crowns = [];
    for (let x = X0; x <= X1; x += G) { roads.push({ x, y: gy + 0.04, z: (Z0 + Z1) / 2, sx: 8, sy: 0.08, sz: Z1 - Z0 + G, c: 0x6d6790 }); for (let z = Z0; z < Z1; z += 7) marks.push({ x, y: gy + 0.1, z, sx: 0.22, sy: 0.04, sz: 2.4, c: 0xe4defa }); }
    for (let z = Z0; z <= Z1; z += G) { roads.push({ x: (X0 + X1) / 2, y: gy + 0.05, z, sx: X1 - X0 + G, sy: 0.08, sz: 8, c: 0x6d6790 }); for (let x = X0; x < X1; x += 7) marks.push({ x, y: gy + 0.11, z, sx: 2.4, sy: 0.04, sz: 0.22, c: 0xe4defa }); }
    for (let x = X0; x < X1; x += G) for (let z = Z0; z < Z1; z += G) { // her yapı adası: park ya da 1–4 bina
      const cx = x + G / 2; const cz = z + G / 2; const dist = Math.hypot((cx - b.cx) / (b.rx + 1), (cz - b.cz) / (b.rz + 1)) * Math.max(b.rx, b.rz); const far = dist - Math.max(b.rx, b.rz);
      if (R() < 0.16 || !out(b, cx, cz, 12)) { // park (arenanın altı da yeşil alan)
        parks.push({ x: cx, y: gy + 0.12, z: cz, sx: 18.5, sy: 0.16, sz: 18.5, c: [0x8fdc7a, 0x7fd18a, 0xa5e887][(R() * 3) | 0] });
        for (let k = 0; k < 5; k++) { const px = cx + (R() - 0.5) * 15; const pz = cz + (R() - 0.5) * 15; const s = 0.9 + R() * 0.7; trunks.push({ x: px, y: gy + 1.1 * s, z: pz, sx: s, sy: s, sz: s, c: 0x8a5a3c }); crowns.push({ x: px, y: gy + 3.1 * s, z: pz, ry: R() * 3, sx: 1.6 * s, sy: 1.9 * s, sz: 1.6 * s, c: LEAVES[R() < 0.8 ? (R() * 4) | 0 : 4] }); }
        continue;
      }
      const cap = far < 26 ? 13 : far < 60 ? 24 : 44; const split = R() < 0.55 ? 2 : 1; const sw = 18.5 / split;
      for (let i = 0; i < split; i++) for (let j = 0; j < split; j++) {
        if (split === 2 && R() < 0.12) continue;
        const h = Math.max(4.5, cap * (0.38 + R() * 0.62)); const w = sw - 1.4 - R() * 1.8; const dp = sw - 1.4 - R() * 1.8; const bx = cx - 9.25 + sw * (i + 0.5); const bz = cz - 9.25 + sw * (j + 0.5); const c = CANDY[(R() * CANDY.length) | 0];
        blds.push({ x: bx, y: gy + h / 2, z: bz, sx: w, sy: h, sz: dp, c });
        if (R() < 0.6) tops.push({ x: bx + (R() - 0.5) * w * 0.4, y: gy + h + 0.7, z: bz + (R() - 0.5) * dp * 0.4, sx: w * 0.35, sy: 1.4, sz: dp * 0.35, c: R() < 0.5 ? 0xffffff : 0x8fdc7a });
      }
    }
    // Pencereli cephe dokusu: kopya rengiyle çarpılır
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const x2 = cv.getContext('2d'); x2.fillStyle = '#fff'; x2.fillRect(0, 0, 64, 128);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) { x2.fillStyle = (r * 5 + c * 3) % 7 === 0 ? '#fff6c9' : '#5c6fa8'; x2.globalAlpha = (r * 5 + c * 3) % 7 === 0 ? 0.9 : 0.42; x2.fillRect(5 + c * 15, 5 + r * 15.4, 9, 10); } x2.globalAlpha = 1;
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; const side = lam({ map: tex }); const roof = lam();
    inst(new T.BoxGeometry(1, 1, 1), lam(), roads); inst(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ color: 0xffffff }), marks); inst(new T.BoxGeometry(1, 1, 1), lam(), parks);
    inst(new T.BoxGeometry(1, 1, 1), [side, side, roof, roof, side, side], blds); inst(new T.BoxGeometry(1, 1, 1), lam(), tops);
    inst(new T.CylinderGeometry(0.22, 0.32, 2.2, 6), lam(), trunks); inst(new T.IcosahedronGeometry(1, 0), lam({ flatShading: true }), crowns);
    // Arabalar yollarda gider gelir
    const cars = []; for (let i = 0; i < 16; i++) { const alongX = i % 2 === 0; const line = (alongX ? Z0 : X0) + ((R() * (((alongX ? Z1 - Z0 : X1 - X0) / G) | 0)) | 0) * G; const dir = R() < 0.5 ? -1 : 1; cars.push({ alongX, line: line + dir * 1.9, dir, p: R() * 300, v: 7 + R() * 7, c: CARS[i % CARS.length] }); }
    const body = inst(new T.BoxGeometry(1, 1, 1), lam(), cars.map((c) => ({ x: 0, y: -99, z: 0, c: c.c }))); const cab = inst(new T.BoxGeometry(1, 1, 1), lam(), cars.map(() => ({ x: 0, y: -99, z: 0, c: 0xdff3ff })));
    const lenX = X1 - X0 + G; const lenZ = Z1 - Z0 + G;
    anim.push((now, dt) => { cars.forEach((c, i) => { c.p += c.v * dt; const len = c.alongX ? lenX : lenZ; const t = ((c.p % len) + len) % len; const along = (c.alongX ? X0 : Z0) - G / 2 + (c.dir > 0 ? t : len - t); const x = c.alongX ? along : c.line; const z = c.alongX ? c.line : along;
      d.rotation.set(0, c.alongX ? 0 : Math.PI / 2, 0); d.position.set(x, gy + 0.75, z); d.scale.set(3.6, 1, 1.8); d.updateMatrix(); body.setMatrixAt(i, d.matrix); d.position.y = gy + 1.5; d.scale.set(1.9, 0.8, 1.6); d.updateMatrix(); cab.setMatrixAt(i, d.matrix); }); body.instanceMatrix.needsUpdate = true; cab.instanceMatrix.needsUpdate = true; });
    // Dönme dolap
    const a = R() * Math.PI * 2; const wx = Math.round((b.cx + Math.cos(a) * (b.rx + 46)) / G) * G + G / 2; const wz = Math.round((b.cz + Math.sin(a) * (b.rz + 46)) / G) * G + G / 2; const wr = 11;
    const wheel = new T.Group(); wheel.position.set(wx, gy + wr + 3.5, wz); const rim = new T.Mesh(new T.TorusGeometry(wr, 0.28, 8, 40), lam({ color: 0xff5d8f })); wheel.add(rim);
    for (let i = 0; i < 6; i++) { const sp = new T.Mesh(new T.BoxGeometry(wr * 2, 0.14, 0.14), lam({ color: 0xffffff })); sp.rotation.z = (i * Math.PI) / 6; wheel.add(sp); }
    const cabins = []; for (let i = 0; i < 10; i++) { const cb = new T.Mesh(new T.BoxGeometry(1.7, 1.5, 1.4), lam({ color: CANDY[i % CANDY.length] })); wheel.add(cb); cabins.push(cb); } g.add(wheel);
    [-1, 1].forEach((s) => { const leg = add(new T.BoxGeometry(0.5, wr + 4.5, 0.5), lam({ color: 0xffffff }), wx + s * 3.2, gy + (wr + 4) / 2, wz + 0.9); leg.rotation.z = s * 0.24; });
    anim.push((now) => { const r = now / 5200; wheel.rotation.z = r; cabins.forEach((cb, i) => { const q = (i / 10) * Math.PI * 2; cb.position.set(Math.cos(q) * wr, Math.sin(q) * wr - 0.9, 0); cb.rotation.z = -r; }); });
  }

  // ---- Yanardağ: koyu kayalıklar, kor ışıkları ----
  function volkan(R, b, th, gy) {
    const rocks = []; const tips = [];
    for (let i = 0; i < 70; i++) { const a = R() * Math.PI * 2; const r = 20 + R() * 120; const x = b.cx + Math.cos(a) * (b.rx + r); const z = b.cz + Math.sin(a) * (b.rz + r); const h = 6 + R() * 26; const w = 3 + R() * 7;
      rocks.push({ x, y: gy + h / 2 - 1, z, ry: R() * 3, sx: w, sy: h, sz: w, c: [0x3a2338, 0x4a2a44, 0x2e1b2e][i % 3] }); if (R() < 0.3) tips.push({ x, y: gy + h - 1.2, z, sx: w * 0.16, sy: 1.6, sz: w * 0.16, c: 0xff7a2a }); }
    inst(new T.ConeGeometry(1, 1, 6), lam({ flatShading: true }), rocks); inst(new T.ConeGeometry(1, 1, 6), new T.MeshBasicMaterial({ color: 0xffffff }), tips);
    const lava = add(new T.CircleGeometry(190, 40), new T.MeshBasicMaterial({ color: 0xc8421e }), b.cx, gy + 0.05, b.cz); lava.rotation.x = -Math.PI / 2;
    const pools = []; for (let i = 0; i < 26; i++) { const a = R() * Math.PI * 2; const r = 8 + R() * 120; pools.push({ x: b.cx + Math.cos(a) * r, y: gy + 0.1 + i * 0.002, z: b.cz + Math.sin(a) * r, rx: -Math.PI / 2, sx: 5 + R() * 12, sy: 4 + R() * 9, c: i % 2 ? 0xff8a2a : 0xffc04a }); }
    inst(new T.CircleGeometry(1, 14), new T.MeshBasicMaterial({ color: 0xffffff }), pools);
  }

  return {
    // theme: 'koy' | 'sehir' | 'volkan'; seed: tohum; b: arenanın kapladığı elips { cx, cz, rx, rz }; gy: zeminin yüksekliği
    set(theme, seed, b, gy = -20) {
      const k = `${theme}:${seed}:${b.cx}:${b.cz}:${b.rx}:${b.rz}:${gy}`; if (k === key) return; key = k;
      this.clear(); const th = THEMES[theme] || THEMES.koy; g = new T.Group(); scene.add(g); const R = rng(seed);
      paintSky(th); if (scene.fog) scene.fog.color.setHex(th.fog); hemi?.groundColor.setHex(th.hemi); sun?.color.setHex(th.sun);
      if (theme !== 'volkan') { const gr = add(new T.CircleGeometry(Math.max(b.rx, b.rz) + 190, 48), lam({ color: th.ground }), b.cx, gy, b.cz); gr.rotation.x = -Math.PI / 2; }
      (theme === 'sehir' ? sehir : theme === 'volkan' ? volkan : koy)(R, b, th, gy); sky(R, b, th, gy, theme === 'volkan' ? 6 : 9);
    },
    update(now, dt, cam) { dome.position.copy(cam.position); for (let i = 0; i < anim.length; i++) anim[i](now, dt); },
    clear() { anim = []; if (!g) return; scene.remove(g); g.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => { x.map?.dispose?.(); x.dispose?.(); }); o.dispose?.(); }); g = null; },
    dispose() { this.clear(); key = ''; scene.remove(dome); domeGeo.dispose(); dome.material.dispose(); },
  };
}

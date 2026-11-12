// SwipeFarm grafik üretici: küçük bir 3D (SDF ışın izleme) render motoru.
// Sahneler basit hacimlerden kurulur; yumuşak gölge, ortam ışığı ve zemin gölgesiyle
// izometrik (2:1) açıdan PNG olarak çizilir. Çalışma zamanında yalnızca hazır görseller kullanılır.
import zlib from 'node:zlib';
import fs from 'node:fs';

const rad = (d) => (d * Math.PI) / 180;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const fract = (x) => x - Math.floor(x);
export const hex = (h) => { const n = parseInt(h.slice(1), 16); const f = (v) => (v / 255) ** 2.2; return [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)]; };
export const hash = (x, y = 0, z = 0) => fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453);
export function noise(x, y, z) {
  const ix = Math.floor(x); const iy = Math.floor(y); const iz = Math.floor(z);
  let fx = x - ix; let fy = y - iy; let fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const h = (a, b, c) => hash(ix + a, iy + b, iz + c);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(h(0, 0, 0), h(1, 0, 0), fx), l(h(0, 1, 0), h(1, 1, 0), fx), fy), l(l(h(0, 0, 1), h(1, 0, 1), fx), l(h(0, 1, 1), h(1, 1, 1), fx), fy), fz);
}
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ---- Malzemeler ----
export const M = (h, o = {}) => ({ c: hex(h), spec: o.spec ?? 0.12, gloss: o.gloss ?? 18, tex: o.tex || null, soft: o.soft ?? 0 });
export const mottle = (a, b, s = 6, o = {}) => { const A = hex(a); const B = hex(b); return M(a, { ...o, tex: (x, y, z) => mixc(A, B, clamp(noise(x * s, y * s, z * s) * 1.4 - 0.2)) }); };
// tahta kaplama: eksen boyunca ince koyu çizgiler + tahta başına ton farkı
export const planks = (a, o = {}) => {
  const A = hex(a); const w = o.w ?? 0.11; const ax = o.axis ?? 'y'; const dk = o.dark ?? 0.3;
  return M(a, { ...o, tex: (x, y, z) => { const v = (ax === 'y' ? y : ax === 'x' ? x : ax === 'z' ? z : x + z) / w; const f = fract(v); const t = 0.86 + 0.26 * hash(Math.floor(v), 3.1); const ln = f < 0.1 ? 1 - dk : 1; return [A[0] * t * ln, A[1] * t * ln, A[2] * t * ln]; } });
};
export const shingles = (a, o = {}) => {
  const A = hex(a); const rw = o.w ?? 0.09;
  return M(a, { ...o, tex: (x, y, z) => { const r = Math.floor(y / rw); const u = ((o.axis === 'x' ? x : z) + (r % 2) * rw * 0.75) / (rw * 1.5); const t = 0.8 + 0.34 * hash(r, Math.floor(u)); const e = fract(y / rw) < 0.16 || fract(u) < 0.07 ? 0.74 : 1; return [A[0] * t * e, A[1] * t * e, A[2] * t * e]; } });
};
export const stripes = (a, b, o = {}) => { const A = hex(a); const B = hex(b); const w = o.w ?? 0.1; return M(a, { ...o, tex: (x, y, z) => (fract((o.axis === 'x' ? x : o.axis === 'y' ? y : z) / w) < 0.5 ? A : B) }); };
export const spots = (a, b, s = 3, th = 0.56, o = {}) => { const A = hex(a); const B = hex(b); return M(a, { ...o, tex: (x, y, z) => (noise(x * s + 7, y * s, z * s + 3) > th ? B : A) }); };

// ---- Hacimler ----
function rotM(o) {
  if (!o || !(o.ry || o.rx || o.rz)) return null;
  const [cy, sy, cx, sx, cz, sz] = [Math.cos(rad(o.ry || 0)), Math.sin(rad(o.ry || 0)), Math.cos(rad(o.rx || 0)), Math.sin(rad(o.rx || 0)), Math.cos(rad(o.rz || 0)), Math.sin(rad(o.rz || 0))];
  // F = Ry * Rx * Rz
  return [cy * cz + sy * sx * sz, -cy * sz + sy * sx * cz, sy * cx, cx * sz, cx * cz, -sx, -sy * cz + cy * sx * sz, sy * sz + cy * sx * cz, cy * cx];
}
function mk(f, pos, R, o) {
  const [px, py, pz] = pos; const F = rotM(o); const dsp = o?.disp || null;
  let d = F ? (x, y, z) => { x -= px; y -= py; z -= pz; return f(F[0] * x + F[3] * y + F[6] * z, F[1] * x + F[4] * y + F[7] * z, F[2] * x + F[5] * y + F[8] * z); } : (x, y, z) => f(x - px, y - py, z - pz);
  if (dsp) { const d0 = d; d = (x, y, z) => d0(x, y, z) + dsp(x, y, z); }
  return { d, c: pos, R: R + (dsp ? 0.05 : 0) };
}
export const sph = (x, y, z, r, o) => mk((a, b, c) => Math.sqrt(a * a + b * b + c * c) - r, [x, y, z], r, o);
export const ell = (x, y, z, rx, ry, rz, o) => mk((a, b, c) => {
  const k0 = Math.sqrt((a / rx) ** 2 + (b / ry) ** 2 + (c / rz) ** 2); const k1 = Math.sqrt((a / (rx * rx)) ** 2 + (b / (ry * ry)) ** 2 + (c / (rz * rz)) ** 2);
  return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}, [x, y, z], Math.max(rx, ry, rz), o);
export const box = (x, y, z, hx, hy, hz, r = 0.02, o) => mk((a, b, c) => {
  const qx = Math.abs(a) - hx + r; const qy = Math.abs(b) - hy + r; const qz = Math.abs(c) - hz + r;
  const ox = Math.max(qx, 0); const oy = Math.max(qy, 0); const oz = Math.max(qz, 0);
  return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0) - r;
}, [x, y, z], Math.sqrt(hx * hx + hy * hy + hz * hz), o);
// dikey silindir (merkez y), h: yarı yükseklik
export const cyl = (x, y, z, r, h, rr = 0.02, o) => mk((a, b, c) => {
  const dx = Math.sqrt(a * a + c * c) - r + rr; const dy = Math.abs(b) - h + rr;
  return Math.min(Math.max(dx, dy), 0) + Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2) - rr;
}, [x, y, z], Math.sqrt(r * r + h * h), o);
export const cap = (ax, ay, az, bx, by, bz, r) => {
  const ex = bx - ax; const ey = by - ay; const ez = bz - az; const ee = ex * ex + ey * ey + ez * ez || 1e-9;
  return { d: (x, y, z) => { const px = x - ax; const py = y - ay; const pz = z - az; const h = clamp((px * ex + py * ey + pz * ez) / ee); const qx = px - ex * h; const qy = py - ey * h; const qz = pz - ez * h; return Math.sqrt(qx * qx + qy * qy + qz * qz) - r; },
    c: [(ax + bx) / 2, (ay + by) / 2, (az + bz) / 2], R: Math.sqrt(ee) / 2 + r };
};
// kesik koni (taban y'de, yukarı h kadar), r1 alt, r2 üst yarıçap
export const cone = (x, y, z, r1, r2, h, rr = 0.02, o) => mk((a, b, c) => {
  const hh = h / 2; const qx = Math.sqrt(a * a + c * c); const qy = b;
  const k2x = r2 - r1; const k2y = 2 * hh;
  const cax = qx - Math.min(qx, qy < 0 ? r1 : r2); const cay = Math.abs(qy) - hh;
  const t = clamp(((r2 - qx) * k2x + (hh - qy) * k2y) / (k2x * k2x + k2y * k2y));
  const cbx = qx - r2 + k2x * t; const cby = qy - hh + k2y * t;
  const s = cbx < 0 && cay < 0 ? -1 : 1;
  return s * Math.sqrt(Math.min(cax * cax + cay * cay, cbx * cbx + cby * cby)) - rr;
}, [x, y + h / 2, z], Math.sqrt(Math.max(r1, r2) ** 2 + (h / 2) ** 2) + rr, o && { ...o });
// beş köşeli yıldız prizması: yıldız x-z düzleminde, kalınlık y ekseninde (para kabartması)
export const starP = (x, y, z, r, h, o) => mk((a, b, c) => {
  const kx = 0.809016994; const ky = -0.587785252; let px = Math.abs(a); let py = c;
  let d = Math.max(kx * px + ky * py, 0); px -= 2 * d * kx; py -= 2 * d * ky;
  d = Math.max(-kx * px + ky * py, 0); px += 2 * d * kx; py -= 2 * d * ky;
  px = Math.abs(px); py -= r;
  const bx = -ky * 0.5; const by = kx * 0.5 - 1; const hh = clamp((px * bx + py * by) / (bx * bx + by * by), 0, r);
  const s2 = Math.hypot(px - bx * hh, py - by * hh) * Math.sign(py * bx - px * by);
  return Math.max(s2, Math.abs(b) - h) - 0.006;
}, [x, y, z], r + h, o);
export const tor = (x, y, z, R, r, o) => mk((a, b, c) => { const q = Math.sqrt(a * a + c * c) - R; return Math.sqrt(q * q + b * b) - r; }, [x, y, z], R + r, o);
// beşik çatı: sırt yerel z ekseninde, taban y'de; hw yarı genişlik, h yükseklik, hl yarı uzunluk
export const gable = (x, y, z, hw, h, hl, r = 0.015, o) => { const inv = 1 / Math.sqrt(h * h + hw * hw); return mk((a, b, c) => Math.max((Math.abs(a) * h + b * hw - hw * h) * inv, -b, Math.abs(c) - hl) - r, [x, y, z], Math.sqrt(hw * hw + h * h + hl * hl) + r, o); };
// piramit/konik çatı için: kare tabanlı piramit yaklaşık (iki beşik çatının kesişimi)
export const pyr = (x, y, z, hw, h, r = 0.015, o) => { const inv = 1 / Math.sqrt(h * h + hw * hw); return mk((a, b, c) => Math.max((Math.abs(a) * h + b * hw - hw * h) * inv, (Math.abs(c) * h + b * hw - hw * h) * inv, -b) - r, [x, y, z], Math.sqrt(2 * hw * hw + h * h) + r, o); };

export class Scene {
  constructor() { this.groups = []; }
  // aynı malzemeden hacimler k yumuşaklığıyla birleşir
  add(mat, k, ...prims) { this.groups.push({ mat, k, prims: prims.flat(Infinity).filter(Boolean) }); return this; }
}

// ---- Kamera: 30° yükseklik, 45° dönüş (2:1 izometrik) ----
const E = rad(30);
const CD = [Math.cos(E) * Math.SQRT1_2, Math.sin(E), Math.cos(E) * Math.SQRT1_2];
const RT = [Math.SQRT1_2, 0, -Math.SQRT1_2];
const UP = [-Math.sin(E) * Math.SQRT1_2, Math.cos(E), -Math.sin(E) * Math.SQRT1_2];
const nrm = (v) => { const l = Math.hypot(...v); return v.map((a) => a / l); };
const L1 = nrm([-0.42, 0.95, 0.5]); // ana ışık: sol üst ön
const L2 = nrm([0.8, 0.35, 0.1]); // dolgu ışığı
const HV = nrm([L1[0] + CD[0], L1[1] + CD[1], L1[2] + CD[2]]);

export function render(scene, opt = {}) {
  const S = opt.S ?? 136; const ss = opt.ss ?? 2; const ground = opt.ground ?? true; const padU = opt.pad ?? 0.32;
  const groups = scene.groups; const all = groups.flatMap((g) => g.prims);
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  let hitG = -1;
  const map = (x, y, z) => {
    let best = 1e9; hitG = -1;
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi]; const k = g.k; let d = 1e9;
      for (let i = 0; i < g.prims.length; i++) {
        const p = g.prims[i]; const dx = x - p.c[0]; const dy = y - p.c[1]; const dz = z - p.c[2];
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) - p.R > Math.min(d, best) + k) continue;
        const pd = p.d(x, y, z); d = k > 0 ? smin(d, pd, k) : Math.min(d, pd);
      }
      if (d < best) { best = d; hitG = gi; }
    }
    return best;
  };
  // sınırlar
  let [x0, x1, y0, y1] = [1e9, -1e9, 1e9, -1e9]; let bc = [0, 0, 0];
  for (const p of all) {
    const u = p.c[0] * RT[0] + p.c[2] * RT[2]; const v = p.c[0] * UP[0] + p.c[1] * UP[1] + p.c[2] * UP[2];
    x0 = Math.min(x0, u - p.R); x1 = Math.max(x1, u + p.R); y0 = Math.min(y0, v - p.R); y1 = Math.max(y1, v + p.R);
    bc = bc.map((a, i) => a + p.c[i] / all.length);
  }
  const bR = Math.max(...all.map((p) => Math.hypot(p.c[0] - bc[0], p.c[1] - bc[1], p.c[2] - bc[2]) + p.R)) + 0.05;
  const top = Math.max(...all.map((p) => p.c[1] + p.R * 0.6));
  x0 -= padU; x1 += padU + (ground ? top * 0.62 : 0); y0 -= padU; y1 += padU * 0.6;
  const W = Math.ceil((x1 - x0) * S); const H = Math.ceil((y1 - y0) * S); const ox = -x0 * S; const oy = y1 * S;
  const buf = new Float32Array(W * H * 4);
  const soft = (px, py, pz, L, k, maxt) => {
    let res = 1; let t = 0.03;
    for (let i = 0; i < 44 && t < maxt; i++) { const h = map(px + L[0] * t, py + L[1] * t, pz + L[2] * t); if (h < 0.002) return 0; res = Math.min(res, (k * h) / t); t += clamp(h, 0.025, 0.22); }
    res = clamp(res); return res * res * (3 - 2 * res);
  };
  const aoAt = (px, py, pz, nx, ny, nz, step) => { let o = 0; let sc = 1; for (let i = 1; i <= 5; i++) { const hr = step * i; o += (hr - map(px + nx * hr, py + ny * hr, pz + nz * hr)) * sc; sc *= 0.72; } return clamp(1 - (1.5 * o) / (step * 5) * 1.6); };
  const tone = (c) => { const l0 = c[0] * 0.3 + c[1] * 0.55 + c[2] * 0.15; const o = c.map((v) => { const s = l0 + (v - l0) * 1.22; return 1 - Math.exp(-Math.max(s, 0) * 1.25); }); return o; };
  const inv = 1 / (S * ss);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      let r = 0; let g = 0; let b = 0; let a = 0;
      for (let sj = 0; sj < ss; sj++) for (let si = 0; si < ss; si++) {
        const u = (i * ss + si + 0.5) * inv - ox / S; const v = oy / S - (j * ss + sj + 0.5) * inv;
        const Px = RT[0] * u + UP[0] * v + CD[0] * 30; const Py = UP[1] * v + CD[1] * 30; const Pz = RT[2] * u + UP[2] * v + CD[2] * 30;
        const wx = bc[0] - Px; const wy = bc[1] - Py; const wz = bc[2] - Pz; const pr = -(wx * CD[0] + wy * CD[1] + wz * CD[2]);
        const perp2 = wx * wx + wy * wy + wz * wz - pr * pr;
        const tG = Py / CD[1]; let hit = false; let t = Math.max(pr - bR, 0);
        if (perp2 < bR * bR) {
          const tEnd = Math.min(pr + bR, ground ? tG : 1e9);
          for (let k = 0; k < 110 && t < tEnd; k++) { const d = map(Px - CD[0] * t, Py - CD[1] * t, Pz - CD[2] * t); if (d < 0.0018) { hit = true; break; } t += d * 0.88; }
        }
        if (hit) {
          const x = Px - CD[0] * t; const y = Py - CD[1] * t; const z = Pz - CD[2] * t; const gi = hitG; const m = groups[gi].mat; const e = 0.0025;
          const n1 = map(x + e, y - e, z - e); const n2 = map(x - e, y - e, z + e); const n3 = map(x - e, y + e, z - e); const n4 = map(x + e, y + e, z + e);
          let nx = n1 - n2 - n3 + n4; let ny = -n1 - n2 + n3 + n4; let nz = -n1 + n2 - n3 + n4; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
          const base = m.tex ? m.tex(x, y, z, nx, ny, nz) : m.c;
          const sh = soft(x + nx * 0.01, y + ny * 0.01, z + nz * 0.01, L1, 9, 5);
          const ao = aoAt(x, y, z, nx, ny, nz, 0.045);
          const ndl = nx * L1[0] + ny * L1[1] + nz * L1[2]; const wrap = clamp((ndl + 0.4 + m.soft) / (1.4 + m.soft));
          const dif = (Math.max(ndl, 0) * 0.62 + wrap * 0.38) * (0.25 + 0.75 * sh) * 2.05;
          const hy = ny * 0.5 + 0.5; const fill = Math.max(nx * L2[0] + ny * L2[1] + nz * L2[2], 0) * 0.22;
          const amb = [(0.5 + 0.2 * hy) * ao, (0.47 + 0.3 * hy) * ao, (0.36 + 0.5 * hy) * ao];
          const ndv = Math.max(nx * CD[0] + ny * CD[1] + nz * CD[2], 0); const rim = (1 - ndv) ** 3 * 0.32 * (0.4 + 0.6 * hy);
          const sp = Math.max(nx * HV[0] + ny * HV[1] + nz * HV[2], 0) ** m.gloss * m.spec * sh * 1.6;
          let c = [base[0] * (amb[0] * 0.62 + dif * 1.0 + fill * 0.7) + rim * 0.7 + sp, base[1] * (amb[1] * 0.62 + dif * 0.93 + fill * 0.8) + rim * 0.8 + sp, base[2] * (amb[2] * 0.62 + dif * 0.78 + fill) + rim + sp * 0.9];
          c = tone(c); r += c[0]; g += c[1]; b += c[2]; a += 1;
        } else if (ground && tG > 0) {
          const x = Px - CD[0] * tG; const z = Pz - CD[2] * tG;
          if ((x - bc[0]) ** 2 + (z - bc[2]) ** 2 < (bR * 1.5) ** 2) {
            const sh = soft(x, 0.004, z, L1, 7, 4); const ao = aoAt(x, 0.002, z, 0, 1, 0, 0.07);
            const al = clamp((1 - sh) * 0.3 + (1 - ao) * 0.55, 0, 0.56);
            if (al > 0.004) { r += 0.03 * al; g += 0.05 * al; b += 0.02 * al; a += al; }
          }
        }
      }
      const o = (j * W + i) * 4; const n = ss * ss; buf[o] = r / n; buf[o + 1] = g / n; buf[o + 2] = b / n; buf[o + 3] = a / n;
    }
  }
  // şeffaf kenarları kırp
  let [cx0, cx1, cy0, cy1] = [W, -1, H, -1];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (buf[(j * W + i) * 4 + 3] > 0.012) { if (i < cx0) cx0 = i; if (i > cx1) cx1 = i; if (j < cy0) cy0 = j; if (j > cy1) cy1 = j; }
  if (cx1 < 0) { cx0 = 0; cy0 = 0; cx1 = 0; cy1 = 0; }
  const w = cx1 - cx0 + 1; const h = cy1 - cy0 + 1; const px = Buffer.alloc(w * h * 4);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const s = ((j + cy0) * W + i + cx0) * 4; const d = (j * w + i) * 4; const al = buf[s + 3];
    for (let k = 0; k < 3; k++) px[d + k] = Math.round(255 * clamp(al > 0 ? buf[s + k] / al : 0) ** (1 / 2.2));
    px[d + 3] = Math.round(255 * clamp(al));
  }
  return { w, h, ax: Math.round(ox - cx0), ay: Math.round(oy - cy0), px };
}

const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export function writePng(file, { w, h, px }) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let j = 0; j < h; j++) px.copy(raw, j * (w * 4 + 1) + 1, j * w * 4, (j + 1) * w * 4);
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]));
}

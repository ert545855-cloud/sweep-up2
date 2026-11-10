// Parti Kupası (3D): Dönen Çubuk → Zemin Çöküyor → Engelli Koşu. Karakter: "Lokum" (özgün tasarım).
// Kendi karakterin cihazında hareket eder; engeller sunucu saatine göre hesaplanır, botlar ve elemeler sunucudan gelir.
import { icon } from '../icons.js';
import { api, esc, toast, on, state, sheet, pickPerson } from '../core.js';
import { enterLandscape, toLocal, ask } from '../land.js';
import { leaveTo } from '../nav.js';

const G = 22; const JUMP = 8.5; const SPEED = 7; const PR = 0.45; // sunucuyla aynı fizik sabitleri
export const COLORS = { gul: 0xf48fb1, limon: 0xffe066, fistik: 0xa5d66f, portakal: 0xffb061, nar: 0xe23e6d, nane: 0x5fe0c4, bogurtlen: 0x8a63d2, cikolata: 0x8a5636, altin: 0xf5c542 };
const HAT_EMOJI = { yok: '🚫', parti: '🎉', fes: '🧢', kulaklik: '🎧', tac: '👑' };
const TIPS = { cubuk: 'Çubuğun üstünden zıpla, platformdan düşme!', zemin: 'Bastığın karo çöker. Hep hareket et!', kosu: 'Engelleri aş, bitişe ilk sen ulaş!' };
const TRACK = { w: 4.5, floors: [[5, -41], [-59, -124]], plats: [{ z: -44, amp: 2.2, w: 0.9, ph: 0 }, { z: -50, amp: 2.2, w: 1.1, ph: 2 }, { z: -56, amp: 2.2, w: 0.8, ph: 4 }],
  sweeps: [{ z: -16, w: 1.6 }, { z: -24, w: -1.9 }, { z: -32, w: 2.2 }, { z: -88, w: -2.6 }, { z: -98, w: 2.9 }], hammers: [{ z: -68, w: 1.7, ph: 0 }, { z: -76, w: 1.9, ph: 1.6 }], ice: [-62, -80], cps: [0, -60.5, -82] };
const barW = (b, t) => (t < b.from ? 0 : Math.min(b.wmax, b.w0 + b.acc * (t - b.from)));
function barAngle(b, t) {
  const s = t - b.from; if (s <= 0) return b.phase; const tc = (b.wmax - b.w0) / b.acc;
  return b.phase + b.dir * (s < tc ? b.w0 * s + 0.5 * b.acc * s * s : b.w0 * tc + 0.5 * b.acc * tc * tc + b.wmax * (s - tc));
}

export default async function kupa(view, id) {
  let v;
  try { v = await api(`/kupa/${id}`); if (v.me < 0) v = await api(`/kupa/${id}/join`, { body: {} }); } catch (e) { toast(e.message); leaveTo('#/oyunlar'); return null; }
  const offLand = enterLandscape();
  view.innerHTML = `<div class="k3"><canvas></canvas>
    <header class="k3-top"><button class="ib k3-x" aria-label="Çık">${icon('back')}</button><span class="k3-chip k3-round"></span><span class="grow"></span><span class="k3-chip k3-left" hidden></span></header>
    <div class="k3-banner" hidden></div><div class="k3-feed"></div>
    <div class="k3-joy" hidden><i></i></div><button class="k3-jump" hidden>Zıpla</button>
    <div class="k3-over" hidden></div></div>`;
  const $ = (s) => view.querySelector(s); const wrap = $('.k3'); const canvas = $('canvas');
  let T; let renderer;
  try { T = await import('/vendor/three/three.module.min.js'); renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch { $('.k3-over').hidden = false; $('.k3-over').innerHTML = '<div class="k3-card"><h2>3D oyun açılamadı</h2><p>Bu cihaz ya da tarayıcı 3D grafikleri desteklemiyor. Tarayıcını güncelleyip tekrar dene.</p><button class="btn primary k3-x">Geri dön</button></div>'; wrap.onclick = (e) => { if (e.target.closest('.k3-x')) { api(`/kupa/${id}/leave`, { body: {} }).catch(() => {}); offLand(); leaveTo('#/oyunlar'); } }; return () => offLand(); }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  const scene = new T.Scene(); const cam = new T.PerspectiveCamera(55, 1, 0.1, 220);
  scene.add(new T.HemisphereLight(0xffffff, 0x8a6bb8, 1.15)); const sun = new T.DirectionalLight(0xfff1dd, 1.5); sun.position.set(6, 12, 7); scene.add(sun);
  scene.fog = new T.Fog(0x8a4aa8, 60, 170);
  const lam = (c, o = {}) => new T.MeshLambertMaterial({ color: c, ...o });
  const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new T.Mesh(g, m); o.position.set(x, y, z); return o; };

  // ---- Lokum karakteri: yuvarlak köşeli küp gövde, pudra şekeri tepe, minik el ve ayaklar ----
  const cubeGeo = (() => { const g = new T.SphereGeometry(0.5, 22, 16); const p = g.attributes.position; const n = 5;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i); const y = p.getY(i); const z = p.getZ(i); const l = Math.hypot(x, y, z) || 1; const dx = x / l; const dy = y / l; const dz = z / l; const s = 0.5 / (Math.abs(dx) ** n + Math.abs(dy) ** n + Math.abs(dz) ** n) ** (1 / n); p.setXYZ(i, dx * s, dy * s, dz * s); }
    g.computeVertexNormals(); return g; })();
  const ball = new T.SphereGeometry(1, 12, 10); const dark = lam(0x2a1d3a); const white = lam(0xfffaf2);
  function makeHat(k) {
    const g = new T.Group();
    if (k === 'parti') { g.add(mesh(new T.ConeGeometry(0.2, 0.46, 14), lam(0xff4f9a), 0, 0.23, 0)); const pom = mesh(ball, lam(0xffe066), 0, 0.48, 0); pom.scale.setScalar(0.07); g.add(pom); g.rotation.z = -0.22; g.position.x = 0.12; }
    else if (k === 'fes') { g.add(mesh(new T.CylinderGeometry(0.17, 0.22, 0.28, 16), lam(0xc62828), 0, 0.14, 0)); g.add(mesh(new T.CylinderGeometry(0.015, 0.015, 0.22, 6), dark, 0.14, 0.2, 0)); }
    else if (k === 'tac') { g.add(mesh(new T.CylinderGeometry(0.25, 0.23, 0.12, 10, 1, true), lam(0xf5c542, { side: T.DoubleSide }), 0, 0.06, 0)); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; g.add(mesh(new T.ConeGeometry(0.06, 0.16, 6), lam(0xf5c542), Math.cos(a) * 0.23, 0.2, Math.sin(a) * 0.23)); } }
    else if (k === 'kulaklik') { const band = mesh(new T.TorusGeometry(0.52, 0.035, 8, 20, Math.PI), dark, 0, -0.42, 0); g.add(band); [-1, 1].forEach((s) => { const c = mesh(new T.CylinderGeometry(0.15, 0.15, 0.1, 14), lam(0x19c2b8), s * 0.54, -0.42, 0); c.rotation.z = Math.PI / 2; g.add(c); }); }
    return g;
  }
  function makeLokum(look) {
    const g = new T.Group(); const body = new T.Group(); g.add(body);
    const col = COLORS[look?.color] || COLORS.gul; const mat = lam(col); const deep = lam(new T.Color(col).multiplyScalar(0.55));
    const b = mesh(cubeGeo, mat, 0, 0.56, 0); b.scale.set(1, 0.9, 1); body.add(b);
    const cap = mesh(cubeGeo, white, 0, 0.93, 0); cap.scale.set(1.03, 0.2, 1.03); body.add(cap);
    [-1, 1].forEach((s) => { const e = mesh(ball, dark, s * 0.17, 0.62, 0.48); e.scale.set(0.065, 0.085, 0.04); body.add(e); const h = mesh(ball, white, s * 0.17 + 0.02, 0.65, 0.5); h.scale.setScalar(0.022); body.add(h); });
    const smile = mesh(new T.TorusGeometry(0.07, 0.016, 6, 12, Math.PI), dark, 0, 0.5, 0.5); smile.rotation.z = Math.PI; body.add(smile);
    const hands = [-1, 1].map((s) => { const h = mesh(ball, deep, s * 0.58, 0.5, 0.05); h.scale.setScalar(0.1); body.add(h); return h; });
    const feet = [-1, 1].map((s) => { const f = mesh(ball, deep, s * 0.2, 0.08, 0.06); f.scale.set(0.13, 0.085, 0.19); g.add(f); return f; });
    const hat = makeHat(look?.hat); hat.position.y += 1.02; body.add(hat);
    const sh = mesh(new T.CircleGeometry(0.44, 18), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false })); sh.rotation.x = -Math.PI / 2; g.add(sh);
    return { g, body, feet, hands, sh, ph: Math.random() * 6, sq: 0 };
  }
  function label(text, me) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    x.font = '700 30px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; const w = Math.min(240, x.measureText(text).width + 28);
    x.fillStyle = me ? 'rgba(255,212,94,.95)' : 'rgba(20,14,34,.62)'; x.beginPath(); x.roundRect(128 - w / 2, 10, w, 44, 22); x.fill(); x.fillStyle = me ? '#2b1c00' : '#fff'; x.fillText(text, 128, 33, 230);
    const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthTest: false, transparent: true })); s.scale.set(2.3, 0.575, 1); s.position.y = 1.75; s.renderOrder = 5; return s;
  }
  // Koşma / zıplama canlandırması (kemiksiz: ayak salınımı, gövde esnemesi)
  function animate(c, dt, speed, air, fly) {
    const run = Math.min(1, speed / SPEED); c.ph += dt * (4 + speed * 2.1);
    c.feet.forEach((f, i) => { const s = Math.sin(c.ph + i * Math.PI); f.position.z = 0.06 + s * 0.2 * run; f.position.y = air ? 0.2 : 0.08 + Math.max(0, -s) * 0.12 * run; });
    c.hands.forEach((h, i) => { h.position.z = 0.05 - Math.sin(c.ph + i * Math.PI) * 0.16 * run; h.position.y = air ? 0.72 : 0.5; });
    c.sq += ((air ? 1 : 0) - c.sq) * Math.min(1, dt * 14);
    c.body.scale.set(1 - c.sq * 0.08, 1 + c.sq * 0.12 + Math.sin(c.ph * 2) * 0.02 * run, 1 - c.sq * 0.08); c.body.position.y = Math.abs(Math.sin(c.ph)) * 0.05 * run;
    c.body.rotation.x = fly ? c.body.rotation.x + dt * 9 : run * 0.16;
  }

  // ---- Durum ----
  let off = Date.now() - v.now; const srv = () => Date.now() - off;
  let arena = null; let arenaKey = ''; let dyn = {}; const chars = new Map(); let charKey = ''; let tiles = new Map(); let TL = [];
  const me = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, ry: 0, ground: false, stun: 0, cp: 0, fin: false, gone: false };
  const inp = { x: 0, z: 0, jump: false }; const keys = new Set(); let raf = 0; let last = performance.now(); let sent = 0; let closed = false; let roundSeen = 0; let wardrobe = null;
  const auto = (() => { try { return location.hostname === 'localhost' && localStorage.getItem('k3auto') === '1'; } catch { return false; } })(); // yalnızca yerel deneme
  const alive = () => v.players.filter((p) => p.alive).length;
  const iAmIn = () => v.status === 'playing' && v.players[v.me]?.alive && !me.gone;

  function buildChars() {
    const k = v.players.map((p) => `${p.name}|${p.look?.color}|${p.look?.hat}`).join(',') + v.me; if (k === charKey) return; charKey = k;
    chars.forEach((c) => scene.remove(c.g)); chars.clear();
    v.players.forEach((p, i) => { const c = makeLokum(p.look); c.g.add(label(i === v.me ? 'Sen' : p.name.replace(' (bot)', ''), i === v.me)); c.t = [0, 0, 0, 0]; c.fl = 0; c.seen = 0; scene.add(c.g); chars.set(i, c); });
  }
  function buildArena() {
    const key = v.status === 'playing' ? `${v.round}:${v.mode}` : `idle:${v.status}`; if (key === arenaKey) return; arenaKey = key;
    if (arena) { scene.remove(arena); arena.traverse((o) => { o.geometry?.dispose?.(); }); } arena = new T.Group(); scene.add(arena); dyn = {}; tiles = new Map();
    const cream = lam(0xfff1dc); const nar = lam(0xe23e6d); const teal = lam(0x19c2b8); const plum = lam(0x6b3fa0);
    if (v.status !== 'playing') { arena.add(mesh(new T.CylinderGeometry(1.25, 1.45, 0.5, 40), cream, 0, -0.25, 0)); const ring = mesh(new T.TorusGeometry(1.3, 0.09, 10, 48), nar, 0, 0, 0); ring.rotation.x = Math.PI / 2; arena.add(ring); return; }
    if (v.mode === 'cubuk') {
      const R = v.conf.r; arena.add(mesh(new T.CylinderGeometry(R, R - 0.8, 1.2, 56), cream, 0, -0.6, 0)); const rim = mesh(new T.TorusGeometry(R - 0.1, 0.16, 10, 64), nar); rim.rotation.x = Math.PI / 2; arena.add(rim);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const d = mesh(new T.CircleGeometry(0.5, 16), lam(i % 2 ? 0xffd9a8 : 0xffc2d4), Math.cos(a) * (R - 2), 0.01, Math.sin(a) * (R - 2)); d.rotation.x = -Math.PI / 2; arena.add(d); }
      arena.add(mesh(new T.CylinderGeometry(0.5, 0.6, 1.1, 20), plum, 0, 0.55, 0));
      dyn.bars = v.conf.bars.map((b, i) => { const m = mesh(new T.BoxGeometry(R * 2 - 0.4, 0.5, 0.6), i ? lam(0xffb300) : teal, 0, 0.45, 0); arena.add(m); return m; });
    } else if (v.mode === 'zemin') {
      const { rings, hex } = v.conf; TL = [];
      for (let q = -rings; q <= rings; q++) for (let r = Math.max(-rings, -q - rings); r <= Math.min(rings, -q + rings); r++) TL.push({ q, r, x: hex * Math.sqrt(3) * (q + r / 2), z: hex * 1.5 * r, y: 0, gone: false });
      const im = new T.InstancedMesh(new T.CylinderGeometry(hex * 0.95, hex * 0.86, 0.5, 6), lam(0xffffff), TL.length); const d = new T.Object3D(); const pal = [0xffc2d4, 0xfff1a8, 0xc9eeb0];
      TL.forEach((t, i) => { d.position.set(t.x, -0.25, t.z); d.updateMatrix(); im.setMatrixAt(i, d.matrix); im.setColorAt(i, new T.Color(pal[(((t.q - t.r) % 3) + 3) % 3])); });
      arena.add(im); dyn.im = im; dyn.d = d; Object.entries(v.conf.tiles || {}).forEach(([i, at]) => tiles.set(+i, at));
    } else {
      TRACK.floors.forEach(([a, b]) => arena.add(mesh(new T.BoxGeometry(TRACK.w * 2, 1, a - b), cream, 0, -0.5, (a + b) / 2)));
      for (let z = -4; z > -120; z -= 8) { if (z < -41 && z > -59) continue; const s = mesh(new T.BoxGeometry(TRACK.w * 2, 0.02, 0.5), lam(0xffd9a8), 0, 0.011, z); arena.add(s); }
      arena.add(mesh(new T.BoxGeometry(TRACK.w * 2, 0.03, TRACK.ice[0] - TRACK.ice[1]), lam(0xa8e6ff), 0, 0.02, (TRACK.ice[0] + TRACK.ice[1]) / 2));
      dyn.plats = TRACK.plats.map((p) => { const m = mesh(new T.BoxGeometry(4.6, 0.6, 4.6), lam(0xffb061), 0, -0.3, p.z); arena.add(m); return m; });
      dyn.sweeps = TRACK.sweeps.map((s, i) => { arena.add(mesh(new T.CylinderGeometry(0.4, 0.5, 1, 16), plum, 0, 0.5, s.z)); const m = mesh(new T.BoxGeometry(8.4, 0.5, 0.6), i % 2 ? lam(0xffb300) : teal, 0, 0.45, s.z); arena.add(m); return m; });
      dyn.hams = TRACK.hammers.map((h) => { [-1, 1].forEach((s) => arena.add(mesh(new T.CylinderGeometry(0.15, 0.15, 6, 8), plum, s * 5, 3, h.z))); arena.add(mesh(new T.BoxGeometry(10.4, 0.3, 0.3), plum, 0, 6, h.z)); const piv = new T.Group(); piv.position.set(0, 6, h.z); piv.add(mesh(new T.CylinderGeometry(0.06, 0.06, 5, 6), dark, 0, -2.5, 0)); const bob = mesh(ball, nar, 0, -5.2, 0); bob.scale.setScalar(0.9); piv.add(bob); arena.add(piv); return piv; });
      [-1, 1].forEach((s) => arena.add(mesh(new T.CylinderGeometry(0.2, 0.2, 5, 10), nar, s * 4.6, 2.5, -v.conf.len))); arena.add(mesh(new T.BoxGeometry(9.6, 0.9, 0.3), lam(0xffffff), 0, 5, -v.conf.len));
      for (let i = 0; i < 9; i++) { const c = mesh(new T.BoxGeometry(1, 0.03, 1), i % 2 ? dark : white, -4 + i, 0.03, -v.conf.len); arena.add(c); }
    }
  }
  function placeAll() { // tur başı: herkes başlangıç yerine
    Object.entries(v.spawn || {}).forEach(([i, p]) => { const c = chars.get(+i); if (c) { c.g.position.set(p[0], p[1], p[2]); c.t = [p[0], p[1], p[2], 0]; c.g.visible = true; c.fl = 0; c.body.rotation.x = 0; c.seen = performance.now() + 9e6; } });
    chars.forEach((c, i) => { if (!v.spawn?.[i]) c.g.visible = false; });
    const s = v.spawn?.[v.me]; Object.assign(me, { x: s ? s[0] : 0, y: 0, z: s ? s[2] : 0, vx: 0, vy: 0, vz: 0, stun: 0, cp: 0, fin: false, gone: !s, ry: v.mode === 'kosu' ? Math.PI : 0 });
  }

  // ---- Zemin ve engeller ----
  function ground(t) {
    if (v.mode === 'cubuk') return Math.hypot(me.x, me.z) <= v.conf.r ? { y: 0, vx: 0 } : null;
    if (v.mode === 'zemin') {
      let best = -1; let bd = 9; TL.forEach((tl, i) => { const d = Math.hypot(me.x - tl.x, me.z - tl.z); if (d < bd) { bd = d; best = i; } });
      if (best < 0 || bd > v.conf.hex * 0.93) return null; const at = tiles.get(best); if (at && srv() >= at) return null;
      return { y: 0, vx: 0, tile: best };
    }
    if (Math.abs(me.x) <= TRACK.w && TRACK.floors.some(([a, b]) => me.z <= a && me.z >= b)) return { y: 0, vx: 0, ice: me.z < TRACK.ice[0] && me.z > TRACK.ice[1] };
    for (const p of TRACK.plats) { const px = p.amp * Math.sin(p.w * t + p.ph); if (Math.abs(me.x - px) <= 2.3 && Math.abs(me.z - p.z) <= 2.3) return { y: 0, vx: p.amp * p.w * Math.cos(p.w * t + p.ph) }; }
    return null;
  }
  function knock(vx, vz, up = 6.5) { me.vx = vx; me.vz = vz; me.vy = up; me.stun = 0.7; me.ground = false; navigator.vibrate?.(40); }
  function barHit(cx, cz, ang, len, w) { // alçak dönen çubuk: üstünden zıplanır
    if (me.y > 0.7 || me.stun > 0.25) return; const rx = me.x - cx; const rz = me.z - cz; const r = Math.hypot(rx, rz); if (r > len + PR) return;
    const dx = Math.cos(ang); const dz = Math.sin(ang); if (Math.abs(rx * dz - rz * dx) > 0.3 + PR || Math.abs(rx * dx + rz * dz) > len) return;
    const rr = Math.max(r, 1.2); const ux = rx / (r || 1); const uz = rz / (r || 1); const s = Math.sign(w) || 1; const sp = Math.abs(w) * rr * 1.1 + 2;
    knock(-uz * s * sp + ux * 5, ux * s * sp + uz * 5);
  }
  function obstacles(t) {
    if (v.mode === 'cubuk') v.conf.bars.forEach((b) => { const w = barW(b, t); if (w) barHit(0, 0, barAngle(b, t), v.conf.r, w * b.dir); });
    else if (v.mode === 'kosu') {
      TRACK.sweeps.forEach((s) => { if (Math.abs(me.z - s.z) < 5) barHit(0, s.z, s.w * t, 4.2, s.w); });
      TRACK.hammers.forEach((h) => { if (Math.abs(me.z - h.z) > 2 || me.stun > 0.25) return; const th = Math.sin(h.w * t + h.ph); const bx = 5.2 * Math.sin(th); const by = 6 - 5.2 * Math.cos(th);
        if (Math.hypot(me.x - bx, me.y + 0.5 - by, me.z - h.z) < 0.9 + PR) knock(Math.sign(Math.cos(h.w * t + h.ph)) * 9, -1, 5); });
    }
  }
  function autopilot(t) { // yalnızca yerel deneme için (localStorage k3auto=1)
    inp.x = 0; inp.z = 0; inp.jump = false;
    if (v.mode === 'cubuk') { const r = Math.hypot(me.x, me.z) || 1; const k = (4.5 - r) * 0.5; inp.x = (me.x / r) * k; inp.z = (me.z / r) * k;
      v.conf.bars.forEach((b) => { const w = barW(b, t); if (!w) return; let rel = (Math.atan2(me.z, me.x) - barAngle(b, t)) * b.dir; rel = ((rel % Math.PI) + Math.PI) % Math.PI; if ((rel * r - 0.8) / (w * r) < 0.13) inp.jump = true; }); }
    else if (v.mode === 'zemin') { let best = null; let bd = 99; TL.forEach((tl, i) => { if (tiles.has(i)) return; const d = Math.hypot(me.x - tl.x, me.z - tl.z); if (d > 0.5 && d < bd) { bd = d; best = tl; } }); if (best) { inp.x = (best.x - me.x) / bd; inp.z = (best.z - me.z) / bd; } }
    else { inp.z = -1; inp.x = -me.x * 0.3; if (Math.floor(t * 1.4) % 2 === 0) inp.jump = true; }
  }

  // ---- Oyuncu fiziği ----
  function step(dt, t) {
    if (auto) autopilot(t); else { const kx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0); const kz = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0); if (kx || kz || keys.size) { inp.x = kx; inp.z = kz; } }
    const g0 = ground(t); const k = me.stun > 0 ? 0.8 : g0?.ice ? 1.7 : me.ground ? 12 : 5; const l = Math.hypot(inp.x, inp.z); const nx = l > 1 ? inp.x / l : inp.x; const nz = l > 1 ? inp.z / l : inp.z;
    me.vx += (nx * SPEED - me.vx) * Math.min(1, k * dt); me.vz += (nz * SPEED - me.vz) * Math.min(1, k * dt); me.stun = Math.max(0, me.stun - dt);
    if ((inp.jump || keys.has(' ')) && me.ground && me.stun <= 0) { me.vy = JUMP; me.ground = false; } inp.jump = false;
    const py = me.y; me.vy -= G * dt; me.x += me.vx * dt; me.y += me.vy * dt; me.z += me.vz * dt;
    const g = ground(t);
    if (g && me.vy <= 0 && me.y <= g.y && py >= g.y - 0.55) { me.y = g.y; me.vy = 0; me.ground = true; me.x += g.vx * dt; if (g.tile !== undefined && !tiles.has(g.tile)) { tiles.set(g.tile, srv() + (v.conf.ms || 1100)); state.socket?.emit('k3:tile', g.tile); } } else me.ground = false;
    if (Math.hypot(me.vx, me.vz) > 0.6) me.ry = Math.atan2(me.vx, me.vz);
    obstacles(t);
    if (v.mode === 'kosu') {
      TRACK.cps.forEach((c, i) => { if (me.z <= c && i > me.cp) me.cp = i; });
      if (me.y < -7) Object.assign(me, { x: (Math.random() - 0.5) * 4, y: 2.5, z: TRACK.cps[me.cp] - 0.8, vx: 0, vy: 0, vz: 0, stun: 0 });
      if (!me.fin && me.z <= -v.conf.len) { me.fin = true; state.socket?.emit('k3:s', [me.x, me.y, me.z, me.ry, 0]); state.socket?.emit('k3:fin'); }
    } else if (me.y < -7 && !me.gone) { me.gone = true; state.socket?.emit('k3:out'); banner('Düştün!', 'Bu turda elendin. Kalanları izleyebilirsin.', 2600); }
  }

  // ---- Arayüz ----
  let banT = 0;
  function banner(title, sub, ms) { const b = $('.k3-banner'); b.hidden = false; b.innerHTML = `<b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}`; clearTimeout(banT); if (ms) banT = setTimeout(() => { b.hidden = true; }, ms); }
  function feed(text) { const f = $('.k3-feed'); const el = document.createElement('span'); el.textContent = text; f.append(el); setTimeout(() => el.remove(), 2600); while (f.children.length > 3) f.firstChild.remove(); }
  function hud() {
    const playing = v.status === 'playing'; $('.k3-round').textContent = playing ? `${v.round}. tur · ${v.title}` : 'Parti Kupası';
    const left = $('.k3-left'); left.hidden = !playing; if (playing) left.textContent = v.mode === 'kosu' ? `${alive()} yarışçı · ilk bitiren kazanır` : `Kalan ${alive()} · ${v.keep} kişi tur atlar`;
    const ctl = playing && v.phase !== 'final' && iAmIn(); $('.k3-joy').hidden = !ctl; $('.k3-jump').hidden = !ctl;
    const over = $('.k3-over');
    if (v.status === 'waiting') {
      over.hidden = false; over.className = 'k3-over side';
      over.innerHTML = `<div class="k3-card"><h2>Parti Kupası</h2><p>Üç tur, tek kupa. Boş yerlere bot oturur.</p>
        <div class="k3-pl">${v.players.map((p, i) => `<span class="${i === v.me ? 'me' : ''}"><i style="background:#${(COLORS[p.look?.color] || COLORS.gul).toString(16).padStart(6, '0')}"></i>${esc(i === v.me ? 'Sen' : p.name)}</span>`).join('')}</div>
        <small class="k3-cnt">${v.players.length}/${v.max} oyuncu${v.startAt ? ` · <b class="k3-auto"></b>` : ''}</small>
        <div class="k3-btns">${v.host ? '<button class="btn primary k3-start">Hemen başlat</button>' : '<span class="muted">Odayı açan başlatacak…</span>'}<button class="btn k3-ward">Gardırop</button><button class="btn k3-inv">${icon('userPlus')} Davet et</button></div></div>`;
    } else if (v.status === 'ended') {
      const o = v.result?.order || []; const w = v.players[v.result?.winner]; const mine = v.players[v.me]?.place;
      over.hidden = false; over.className = 'k3-over side';
      over.innerHTML = `<div class="k3-card"><div class="k3-cup">🏆</div><h2>${v.result?.winner === v.me ? 'Kupa senin!' : `Kupayı ${esc((w?.name || '').replace(' (bot)', ''))} kazandı`}</h2>
        <div class="k3-rank">${o.slice(0, 3).map((i, k) => `<span class="${i === v.me ? 'me' : ''}"><b>${k + 1}.</b>${esc(i === v.me ? 'Sen' : v.players[i].name)}</span>`).join('')}</div>
        ${mine && mine > 3 ? `<small class="k3-cnt">Sen ${mine}. oldun</small>` : ''}
        <div class="k3-btns">${v.host ? '<button class="btn primary k3-start">Yeniden oyna</button>' : ''}<button class="btn k3-ward">Gardırop</button><button class="btn k3-x">Çık</button></div></div>`;
    } else over.hidden = true;
  }
  function apply(nv) {
    off = Math.min(off, Date.now() - nv.now); const was = `${v.status}:${v.round}:${v.phase}`; v = nv; buildChars(); buildArena();
    if (v.status === 'playing' && v.phase === 'intro' && roundSeen !== v.round) { roundSeen = v.round; placeAll(); banner(`${v.round}. tur · ${v.title}`, TIPS[v.mode]); }
    if (v.status === 'playing' && v.phase === 'play' && roundSeen !== v.round) { roundSeen = v.round; placeAll(); } // oyuna sonradan bağlanan
    if (v.phase === 'result' && was !== `${v.status}:${v.round}:${v.phase}`) { const ok = v.result?.through?.includes(v.me); banner(ok ? 'Tur atladın! 🎉' : 'Tur bitti', ok ? 'Sıradaki tura hazırlan.' : `${v.result.through.length} kişi tur atladı.`); }
    if (v.status !== 'playing') { $('.k3-banner').hidden = true; if (was.startsWith('playing')) { me.gone = false; } }
    hud();
  }
  async function openWardrobe() {
    let w; try { w = await api('/kupa/wardrobe'); } catch (e) { return toast(e.message); }
    const html = () => `<div class="k3-w"><p class="muted">Jetonun: <b>${w.coins}</b></p><h3>Lezzet</h3><div class="k3-wg">${w.colors.map(([k, n, p]) => `<button data-id="${k}" class="${w.color === k ? 'on' : ''}"><i style="background:#${COLORS[k].toString(16).padStart(6, '0')}"></i><b>${esc(n)}</b><small>${w.color === k ? 'Üzerinde' : !p || w.owned.includes(k) ? 'Giy' : `${p} jeton`}</small></button>`).join('')}</div>
      <h3>Şapka</h3><div class="k3-wg">${w.hats.map(([k, n, p]) => `<button data-id="${k}" class="${w.hat === k ? 'on' : ''}"><i class="em">${k === 'fes' ? '<svg viewBox="0 0 40 40" width="34" height="34"><path d="M11 30 14 12h12l3 18z" fill="#c62828"/><path d="M20 12c5 1 8 4 9 9" fill="none" stroke="#2a1d3a" stroke-width="1.6" stroke-linecap="round"/><circle cx="29.5" cy="22.5" r="2" fill="#2a1d3a"/></svg>' : HAT_EMOJI[k] || '🎩'}</i><b>${esc(n)}</b><small>${w.hat === k ? 'Üzerinde' : !p || w.owned.includes(k) ? 'Giy' : `${p} jeton`}</small></button>`).join('')}</div></div>`;
    sheet('Gardırop', html(), { onMount(sh) { wardrobe = sh; sh.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-id]'); if (!b) return; const k = b.dataset.id; const it = [...w.colors, ...w.hats].find((x) => x[0] === k); const need = it[2] > 0 && !w.owned.includes(k);
      if (need && !(await ask(`${it[1]} · ${it[2]} jeton`, 'Bu kostümü jetonla almak istiyor musun?', 'Satın al'))) return;
      try { w = await api('/kupa/wardrobe', { body: { id: k, buy: need } }); const box = document.querySelector('.k3-w'); if (box) box.outerHTML = html(); if (need) toast('Kostüm alındı 🎉'); v.players[v.me].look = { color: w.color, hat: w.hat }; buildChars(); hud(); } catch (er) { toast(er.message); }
    }); }, onClose() { wardrobe = null; } });
  }

  // ---- Döngü ----
  function frame(nowMs) {
    if (closed) return; raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (nowMs - last) / 1000); last = nowMs; const t = v.playAt ? (srv() - v.playAt) / 1000 : 0; const playing = v.status === 'playing';
    const W = wrap.clientWidth; const H = wrap.clientHeight; if (canvas.width !== Math.floor(W * renderer.getPixelRatio()) || canvas.height !== Math.floor(H * renderer.getPixelRatio())) { renderer.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix(); }
    const si = !playing && v.status === 'ended' && chars.has(v.result?.winner) ? v.result.winner : v.me; // kaidede gösterilecek karakter
    const mc = chars.get(si);
    if (playing && v.phase === 'intro') { const left = Math.ceil((v.playAt - srv()) / 1000); const b = $('.k3-banner'); if (left <= 3 && left > 0 && b.dataset.n !== String(left)) { b.dataset.n = String(left); banner(String(left), TIPS[v.mode]); } }
    if (playing && v.phase === 'play' && $('.k3-banner').dataset.n) { delete $('.k3-banner').dataset.n; banner('Başla!', '', 700); }
    if (playing && v.phase === 'play' && iAmIn()) { step(dt, t); if (nowMs - sent > 100) { sent = nowMs; state.socket?.emit('k3:s', [+me.x.toFixed(2), +me.y.toFixed(2), +me.z.toFixed(2), +me.ry.toFixed(2), me.ground ? 0 : 1]); } }
    if (mc) {
      if (!playing) { mc.g.visible = true; mc.g.position.set(0, 0, 0); mc.g.rotation.y += dt * 0.7; animate(mc, dt, 0, false, false); chars.forEach((c, i) => { if (i !== si) c.g.visible = false; }); }
      else if (v.spawn?.[v.me] && !(me.gone && me.y < -7)) { mc.g.position.set(me.x, me.y, me.z); mc.g.rotation.y = me.ry; mc.sh.visible = me.ground; animate(mc, dt, Math.hypot(me.vx, me.vz), !me.ground, me.stun > 0.3); mc.g.visible = me.y > -9; }
      else mc.g.visible = false;
    }
    if (playing) chars.forEach((c, i) => { if (i === v.me) return; const p = c.g.position; const k = Math.min(1, dt * 13); const sp = Math.hypot(c.t[0] - p.x, c.t[2] - p.z) / Math.max(dt, 0.001) * k;
      p.x += (c.t[0] - p.x) * k; p.y += (c.t[1] - p.y) * k; p.z += (c.t[2] - p.z) * k; let d = c.t[3] - c.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); c.g.rotation.y += d * k;
      animate(c, dt, Math.min(SPEED, sp), c.fl === 1, c.fl === 2); c.sh.visible = p.y < 0.6 && p.y > -0.3; if (!v.players[i].alive && nowMs - c.seen > 900) c.g.visible = false; });
    // Hareketli engeller
    if (playing && dyn.bars) dyn.bars.forEach((m, i) => { const b = v.conf.bars[i]; m.visible = t >= b.from - 3; m.rotation.y = -barAngle(b, Math.max(0, t)); m.position.y = t < b.from ? 0.45 + Math.max(0, b.from - t) * 0.5 : 0.45; });
    if (playing && dyn.sweeps) { const tt = Math.max(0, t); dyn.sweeps.forEach((m, i) => { m.rotation.y = -TRACK.sweeps[i].w * tt; }); dyn.plats.forEach((m, i) => { const p = TRACK.plats[i]; m.position.x = p.amp * Math.sin(p.w * tt + p.ph); }); dyn.hams.forEach((m, i) => { const h = TRACK.hammers[i]; m.rotation.z = Math.sin(h.w * tt + h.ph); }); }
    if (playing && dyn.im && tiles.size) { const n = srv(); let ch = false; tiles.forEach((at, i) => { const tl = TL[i]; if (!tl || tl.gone) return; const left = at - n; const d = dyn.d; let y = -0.25; let s = 1;
      if (left > 0) { y += Math.sin(nowMs / 28 + i) * 0.035; dyn.im.setColorAt(i, new T.Color(0xff8a5c)); } else { const e = -left / 1000; y -= e * e * 14; if (e > 1.1) { s = 0.0001; tl.gone = true; } }
      d.position.set(tl.x, y, tl.z); d.scale.setScalar(s); d.updateMatrix(); dyn.im.setMatrixAt(i, d.matrix); ch = true; }); if (ch) { dyn.im.instanceMatrix.needsUpdate = true; if (dyn.im.instanceColor) dyn.im.instanceColor.needsUpdate = true; } }
    // Kamera
    let tx = 0; let ty = 0; let tz = 0; let oy = 6.6; let oz = 8.2;
    if (!playing) { oy = 1.5; oz = 5.4; ty = 0.9; tx = W > H ? 1.9 : 0; tz = W > H ? 0 : -0.2; }
    else if (iAmIn() || (v.mode === 'kosu' && v.spawn?.[v.me])) { tx = me.x; ty = Math.max(-2, me.y); tz = me.z; if (v.mode === 'kosu') { oy = 5.2; oz = 8.6; tz -= 3; tx *= 0.6; } }
    else { const lead = [...chars.entries()].find(([i, c]) => v.players[i]?.alive && c.g.visible); if (v.mode === 'kosu' && lead) { tz = lead[1].g.position.z - 3; oy = 6; oz = 10; } else { oy = 15; oz = 15; } }
    const ck = Math.min(1, dt * 6); cam.position.x += (tx - cam.position.x) * ck; cam.position.y += (ty + oy - cam.position.y) * ck; cam.position.z += (tz + oz - cam.position.z) * ck; cam.lookAt(cam.position.x, cam.position.y - oy + 0.8, cam.position.z - oz);
    if (v.status === 'waiting' && v.startAt) { const el = $('.k3-auto'); if (el) el.textContent = `${Math.max(0, Math.ceil((v.startAt - srv()) / 1000))} sn sonra başlıyor`; }
    renderer.render(scene, cam);
  }

  // ---- Girdi ----
  const joy = $('.k3-joy'); let jid = null; let jo = null;
  const jmove = (e) => { if (e.pointerId !== jid) return; const p = toLocal(e.clientX, e.clientY); let dx = p.x - jo.x; let dy = p.y - jo.y; const l = Math.hypot(dx, dy); const m = 46; if (l > m) { dx *= m / l; dy *= m / l; } inp.x = dx / m; inp.z = dy / m; joy.firstElementChild.style.transform = `translate(${dx}px, ${dy}px)`; };
  const jend = (e) => { if (e.pointerId !== jid) return; jid = null; inp.x = 0; inp.z = 0; joy.firstElementChild.style.transform = ''; };
  joy.addEventListener('pointerdown', (e) => { jid = e.pointerId; joy.setPointerCapture?.(jid); const r = toLocal(e.clientX, e.clientY); jo = r; jmove(e); });
  joy.addEventListener('pointermove', jmove); joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
  $('.k3-jump').addEventListener('pointerdown', (e) => { e.preventDefault(); inp.jump = true; });
  const kd = (e) => { if (e.target.closest?.('input, textarea')) return; keys.add(e.key.toLowerCase()); if (e.key === ' ') e.preventDefault(); }; const ku = (e) => { keys.delete(e.key.toLowerCase()); if (!keys.size) { inp.x = 0; inp.z = 0; } };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
  wrap.addEventListener('click', async (e) => {
    if (e.target.closest('.k3-x')) { if (v.status === 'playing' && !(await ask('Oyundan çık', 'Çıkarsan bu kupadan elenirsin. Emin misin?', 'Çık', { danger: true }))) return; await api(`/kupa/${id}/leave`, { body: {} }).catch(() => {}); leaveTo('#/oyunlar'); return; }
    if (e.target.closest('.k3-start')) { try { apply(await api(`/kupa/${id}/start`, { body: {} })); } catch (er) { toast(er.message); } return; }
    if (e.target.closest('.k3-ward')) return openWardrobe();
    if (e.target.closest('.k3-inv')) pickPerson('Parti Kupası’na çağır', async (u) => { if (!u) return; try { await api(`/kupa/${id}/invite`, { body: { userId: u.id } }); toast(`${u.username} çağrıldı.`); } catch (er) { toast(er.message); } });
  });
  const join = () => state.socket?.emit('k3:join', { id });
  const offs = [on('k3', (nv) => { if (nv.id === id) apply(nv); }),
    on('k3:snap', ([sn, list]) => { off = Math.min(off, Date.now() - sn); const n = performance.now(); list.forEach(([i, x, y, z, ry, fl]) => { const c = chars.get(i); if (!c || i === v.me) return; c.t = [x, y, z, ry]; c.fl = fl; c.seen = n; c.g.visible = true; }); }),
    on('k3:tile', ([i, at]) => { tiles.set(i, at); }),
    on('k3:ev', (ev) => { const p = v.players[ev.i]; if (!p) return; if (ev.t === 'out') { p.alive = false; p.out = true; const c = chars.get(ev.i); if (c) c.seen = performance.now(); if (ev.i !== v.me) feed(`${p.name.replace(' (bot)', '')} elendi`); hud(); } }),
    on('reconnected', () => { join(); api(`/kupa/${id}`).then(apply).catch(() => {}); })];
  join(); buildChars(); buildArena(); if (v.status === 'playing') { roundSeen = v.round; placeAll(); } hud(); cam.position.set(0, 9, 12); raf = requestAnimationFrame(frame);
  return () => { closed = true; cancelAnimationFrame(raf); offs.forEach((f) => f()); clearTimeout(banT); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); state.socket?.emit('k3:leave', { id }); wardrobe = null; renderer.dispose(); offLand(); };
}

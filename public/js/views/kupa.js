// Parti Kupası (3D): her kupada on moddan üç tur çekilir; oda sahibi tek bir oyunu da seçebilir. Karakter: "Lokum" (özgün tasarım).
// Kendi karakterin cihazında hareket eder; engeller sunucu saatine göre hesaplanır, botlar, top ve elemeler sunucudan gelir.
import { icon } from '../icons.js';
import { api, esc, toast, on, state, sheet, pickPerson } from '../core.js';
import { enterLandscape, toLocal, ask } from '../land.js';
import { leaveTo } from '../nav.js';
import { t as tr } from '../i18n.js';
import { makeWorld, themeFor, seedOf } from '../k3world.js';
import { makePhys } from '../k3phys.js';
import { makeSfx } from '../k3sfx.js'; // tuvale çizilen etiketler (Sen, Ebe) sayfa çevirisinden geçmez: elle çevrilir

const G = 22; const JUMP = 8.5; const SPEED = 7; const PR = 0.45; // sunucuyla aynı fizik sabitleri
export const COLORS = { gul: 0xf48fb1, limon: 0xffe066, fistik: 0xa5d66f, portakal: 0xffb061, nar: 0xe23e6d, nane: 0x5fe0c4, bogurtlen: 0x8a63d2, cikolata: 0x8a5636, altin: 0xf5c542 };
const HAT_EMOJI = { yok: '🚫', parti: '🎉', fes: '🧢', kulaklik: '🎧', tac: '👑' };
const PAL = [[0xff6fa5, 'Pembe'], [0xffd43b, 'Sarı'], [0x69c96b, 'Yeşil'], [0x4aa8ff, 'Mavi'], [0x9b6bdf, 'Mor']]; // Renk Zemini karoları
const TEAM = [[0xff6fa5, 'Pembe'], [0x4aa8ff, 'Mavi']];
const TIPS = { cubuk: 'Çubuğun üstünden zıpla, platformdan düşme!', zemin: 'Bastığın karo çöker. Hep hareket et!', kosu: 'Engelleri aş, bitişe ilk sen ulaş!',
  kuyruk: 'Süre bitince kuyruğu olan tur atlar. Kuyruğun yoksa birine dokunup kap!', sumo: 'Platform daralıyor. “İt” ile rakibini aşağı gönder!', renk: 'Söylenen renge koş, diğer karolar düşer!',
  lav: 'Basamaklardan zirveye tırman, lav yükseliyor!', bomba: 'Bomba sendeyse birine dokunup devret. Patladığında elinde olan elenir!',
  sakla: 'Ebe saymayı bitirince aramaya çıkar. Engellerin arkasına saklan, ışığına yakalanma!' };
// Oyun seçicideki açıklamalar (tek oyun olarak oynandığında kimin kazandığı)
const INFO = { kupa: 'On oyundan karışık üç tur. Her turda elenenler olur, finali kazanan kupayı alır.', cubuk: 'Dönen çubuğun üstünden zıpla. Son kalan kazanır.', zemin: 'Bastığın karo çöker. Son kalan kazanır.',
  kosu: 'Engelli parkuru ilk bitiren kazanır.', kuyruk: 'Süre bitince kuyruğu olanlar kazanır.', sumo: 'Daralan platformda rakibini aşağı it. Son kalan kazanır.', renk: 'Söylenen renge koş, diğer karolar düşer. Son kalan kazanır.',
  lav: 'Lav yükselirken zirveye ilk çıkan kazanır.', futbol: 'İki takım, dev top. Çok gol atan takım kazanır.', bomba: 'Bomba patladığında elinde olan elenir. Son kalan kazanır.', sakla: 'Ebeden saklan. Süre bitene kadar bulunmayanlar kazanır.' };
const TRACK = { w: 4.5, floors: [[5, -41], [-59, -124]], plats: [{ z: -44, amp: 2.2, w: 0.9, ph: 0 }, { z: -50, amp: 2.2, w: 1.1, ph: 2 }, { z: -56, amp: 2.2, w: 0.8, ph: 4 }],
  sweeps: [{ z: -16, w: 1.6 }, { z: -24, w: -1.9 }, { z: -32, w: 2.2 }, { z: -88, w: -2.6 }, { z: -98, w: 2.9 }], hammers: [{ z: -68, w: 1.7, ph: 0 }, { z: -76, w: 1.9, ph: 1.6 }], ice: [-62, -80], cps: [0, -60.5, -82] };
const barW = (b, t) => (t < b.from ? 0 : Math.min(b.wmax, b.w0 + b.acc * (t - b.from)));
function barAngle(b, t) {
  const s = t - b.from; if (s <= 0) return b.phase; const tc = (b.wmax - b.w0) / b.acc;
  return b.phase + b.dir * (s < tc ? b.w0 * s + 0.5 * b.acc * s * s : b.w0 * tc + 0.5 * b.acc * tc * tc + b.wmax * (s - tc));
}
// Sunucuyla birebir aynı hesaplar (server/kupa.js): renk dizilimi, sumo yarıçapı, lav yüksekliği, basamak yerleri
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function renkLayout(c, k, col) { const rn = mulberry(c.seed + k * 977); const a = Array.from({ length: c.n * c.n }, () => Math.floor(rn() * c.cols)); for (let i = 0; a.filter((x) => x === col).length < 6 && i < 40; i++) a[Math.floor(rn() * a.length)] = col; return a; }
const sumoR = (c, t) => Math.max(c.r1, c.r0 - c.rate * Math.max(0, t - c.from));
const lavaY = (c, t) => { const q = Math.max(0, t - c.t0); const tc = (c.vmax - c.v0) / c.acc; return -1.5 + (q < tc ? c.v0 * q + 0.5 * c.acc * q * q : c.v0 * tc + 0.5 * c.acc * tc * tc + c.vmax * (q - tc)); };
const padAt = (c, i) => ({ x: Math.cos(i * c.da) * c.rad, z: Math.sin(i * c.da) * c.rad, y: i * c.step });
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const clock = (s) => { const n = Math.max(0, Math.ceil(s)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };
const FLAT = { y: 0, vx: 0 };

export default async function kupa(view, id) {
  let v;
  try { v = await api(`/kupa/${id}`); if (v.me < 0) v = await api(`/kupa/${id}/join`, { body: {} }); } catch (e) { toast(e.message); leaveTo('#/oyunlar'); return null; }
  const offLand = enterLandscape();
  view.innerHTML = `<div class="k3"><canvas></canvas>
    <header class="k3-top"><button class="ib k3-x" aria-label="Çık">${icon('back')}</button><span class="k3-chip k3-round"></span><span class="grow"></span><span class="k3-chip k3-left" hidden></span><button class="ib k3-snd" aria-label="Ses"></button></header>
    <div class="k3-call" hidden><i></i><b></b><em><s></s></em></div>
    <div class="k3-banner" hidden></div><div class="k3-feed"></div>
    <div class="k3-zone" hidden></div><div class="k3-joy" hidden><i></i></div><button class="k3-jump" hidden>Zıpla</button>
    <div class="k3-over" hidden></div></div>`;
  const $ = (s) => view.querySelector(s); const wrap = $('.k3'); const canvas = $('canvas');
  let T; let renderer;
  try { T = await import('/vendor/three/three.module.min.js'); renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch { $('.k3-over').hidden = false; $('.k3-over').innerHTML = '<div class="k3-card"><h2>3D oyun açılamadı</h2><p>Bu cihaz ya da tarayıcı 3D grafikleri desteklemiyor. Tarayıcını güncelleyip tekrar dene.</p><button class="btn primary k3-x">Geri dön</button></div>'; wrap.onclick = (e) => { if (e.target.closest('.k3-x')) { api(`/kupa/${id}/leave`, { body: {} }).catch(() => {}); offLand(); leaveTo('#/oyunlar'); } }; return () => offLand(); }
  let pr = Math.min(window.devicePixelRatio || 1, 1.75); renderer.setPixelRatio(pr); const openedAt = performance.now(); let fAcc = 0; let fN = 0; let slow = 0;
  const scene = new T.Scene(); const cam = new T.PerspectiveCamera(55, 1, 0.1, 220);
  const hemi = new T.HemisphereLight(0xffffff, 0x8a6bb8, 1.15); scene.add(hemi); const sun = new T.DirectionalLight(0xfff1dd, 1.5); sun.position.set(6, 12, 7); scene.add(sun);
  scene.fog = new T.Fog(0x8a4aa8, 40, 165);
  const world = makeWorld(T, scene, hemi, sun); const roomSeed = seedOf(String(id)); // arka plan: köy, şehir ya da yanardağ
  // Oyun hissi: ses efektleri, fizik motoru (itilebilir nesneler), kamera sarsıntısı
  const sfx = makeSfx(); let phys = null; let propsKey = ''; let shake = 0; let bumpAt = 0; const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const sndBtn = $('.k3-snd'); const paintSnd = () => { sndBtn.innerHTML = icon(sfx.on ? 'volume' : 'mute'); sndBtn.setAttribute('aria-label', sfx.on ? 'Sesi kapat' : 'Sesi aç'); }; paintSnd();
  sndBtn.onclick = () => { sfx.on = !sfx.on; paintSnd(); if (sfx.on) sfx.play('pop'); };
  const wake = () => sfx.unlock(); wrap.addEventListener('pointerdown', wake); window.addEventListener('keydown', wake);
  const feel = (amt, vib, snd, k = 1) => { if (amt && !calm) shake = Math.max(shake, amt); if (vib) buzz(vib); if (snd) sfx.play(snd, k); };
  makePhys(T, scene).then((ph) => { if (closed) { ph.dispose(); return; } phys = ph; ph.onHit = (sp, kind) => { sfx.play(kind === 'ball' ? 'boing' : 'thud', Math.min(1, sp / 9), 90); if (sp > 5) buzz(8); }; }).catch(() => { /* fizik motoru yüklenemezse oyun nesnesiz sürer */ });
  const lam = (c, o = {}) => new T.MeshLambertMaterial({ color: c, ...o });
  const flat = (c, o = {}) => new T.MeshBasicMaterial({ color: c, ...o });
  const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new T.Mesh(g, m); o.position.set(x, y, z); return o; };
  const lay = (o) => { o.rotation.x = -Math.PI / 2; return o; }; // düzlemi yere yatır

  // ---- Lokum karakteri: yuvarlak köşeli küp gövde, pudra şekeri tepe, minik el ve ayaklar ----
  const cubeGeo = (() => { const g = new T.SphereGeometry(0.5, 22, 16); const p = g.attributes.position; const n = 5;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i); const y = p.getY(i); const z = p.getZ(i); const l = Math.hypot(x, y, z) || 1; const dx = x / l; const dy = y / l; const dz = z / l; const s = 0.5 / (Math.abs(dx) ** n + Math.abs(dy) ** n + Math.abs(dz) ** n) ** (1 / n); p.setXYZ(i, dx * s, dy * s, dz * s); }
    g.computeVertexNormals(); return g; })();
  const ball = new T.SphereGeometry(1, 12, 10); const dark = lam(0x2a1d3a); const white = lam(0xfffaf2); const ringGeo = new T.RingGeometry(0.54, 0.74, 24); const tailMat = lam(0xff8a3c);
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
    const col = look?.hex ?? (COLORS[look?.color] || COLORS.gul); const mat = lam(col); const deep = lam(new T.Color(col).multiplyScalar(0.55));
    const b = mesh(cubeGeo, mat, 0, 0.56, 0); b.scale.set(1, 0.9, 1); body.add(b);
    const cap = mesh(cubeGeo, white, 0, 0.93, 0); cap.scale.set(1.03, 0.2, 1.03); body.add(cap);
    [-1, 1].forEach((s) => { const e = mesh(ball, dark, s * 0.17, 0.62, 0.48); e.scale.set(0.065, 0.085, 0.04); body.add(e); const h = mesh(ball, white, s * 0.17 + 0.02, 0.65, 0.5); h.scale.setScalar(0.022); body.add(h); });
    const smile = mesh(new T.TorusGeometry(0.07, 0.016, 6, 12, Math.PI), dark, 0, 0.5, 0.5); smile.rotation.z = Math.PI; body.add(smile);
    const hands = [-1, 1].map((s) => { const h = mesh(ball, deep, s * 0.58, 0.5, 0.05); h.scale.setScalar(0.1); body.add(h); return h; });
    const feet = [-1, 1].map((s) => { const f = mesh(ball, deep, s * 0.2, 0.08, 0.06); f.scale.set(0.13, 0.085, 0.19); g.add(f); return f; });
    const hat = makeHat(look?.hat); hat.position.y += 1.02; body.add(hat);
    const sh = lay(mesh(new T.CircleGeometry(0.44, 18), flat(0x000000, { transparent: true, opacity: 0.22, depthWrite: false }))); g.add(sh);
    // Kuyruk (Kuyruk Kapmaca) ve takım halkası (futbol): gerektiğinde görünür
    const tail = new T.Group(); [[0.2, 0.02, -0.02], [0.26, 0.3, -0.2], [0.28, 0.64, -0.3], [0.21, 0.96, -0.2]].forEach(([r, y, z], k) => { const s = mesh(ball, k === 3 ? white : tailMat, 0, y, z); s.scale.setScalar(r); tail.add(s); }); tail.position.set(0, 0.3, -0.5); tail.visible = false; g.add(tail);
    const ring = lay(mesh(ringGeo, flat(0xffffff, { transparent: true, opacity: 0.92, depthWrite: false, side: T.DoubleSide }), 0, 0.03, 0)); ring.visible = false; g.add(ring);
    return { g, body, feet, hands, sh, tail, ring, ph: Math.random() * 6, sq: 0 };
  }
  function label(text, me, bg) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    x.font = '700 30px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; const w = Math.min(240, x.measureText(text).width + 28);
    x.fillStyle = bg || (me ? 'rgba(255,212,94,.95)' : 'rgba(20,14,34,.62)'); x.beginPath(); x.roundRect(128 - w / 2, 10, w, 44, 22); x.fill(); x.fillStyle = me && !bg ? '#2b1c00' : '#fff'; x.fillText(text, 128, 33, 230);
    const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthTest: false, transparent: true })); s.scale.set(2.3, 0.575, 1); s.position.y = 1.75; s.renderOrder = 5; return s;
  }
  // Koşma / zıplama canlandırması (kemiksiz: ayak salınımı, gövde esnemesi)
  function animate(c, dt, speed, air, fly, dash) {
    const run = Math.min(1, speed / SPEED); c.ph += dt * (4 + speed * 2.1);
    c.feet.forEach((f, i) => { const s = Math.sin(c.ph + i * Math.PI); f.position.z = 0.06 + s * 0.2 * run; f.position.y = air ? 0.2 : 0.08 + Math.max(0, -s) * 0.12 * run; });
    c.hands.forEach((h, i) => { h.position.z = dash ? 0.42 : 0.05 - Math.sin(c.ph + i * Math.PI) * 0.16 * run; h.position.y = air ? 0.72 : 0.5; });
    c.sq += ((air ? 1 : 0) - c.sq) * Math.min(1, dt * 14);
    c.ld = Math.max(0, (c.ld || 0) - dt * 4.5); const ld = c.ld * c.ld; // yere inince basılıp geri yaylanır
    c.body.scale.set(1 - c.sq * 0.08 + ld * 0.2, (1 + c.sq * 0.12 + Math.sin(c.ph * 2) * 0.02 * run) * (1 - ld * 0.26), 1 - c.sq * 0.08 + ld * 0.2); c.body.position.y = Math.abs(Math.sin(c.ph)) * 0.05 * run;
    c.body.rotation.x = fly ? c.body.rotation.x + dt * 9 : dash ? 0.5 : run * 0.16;
  }

  // ---- Durum ----
  let off = Date.now() - v.now; const srv = () => Date.now() - off;
  let arena = null; let arenaKey = ''; let dyn = {}; const chars = new Map(); let charKey = ''; let tiles = new Map(); let TL = [];
  const me = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, ry: 0, ground: false, stun: 0, cp: 0, fin: false, gone: false, dash: 0, dcd: 0, dfl: 0, dvx: 0, dvz: 0, top: false, dead: false, finAt: 0, jbuf: 0, air: 0, jumped: false, hideAt: 0 };
  const inp = { x: 0, z: 0, jump: false }; const keys = new Set(); let raf = 0; let last = performance.now(); let sent = 0; let closed = false; let roundSeen = 0; let wardrobe = null;
  let rk = { lay: new Map(), key: '' }; let lf = [0, -1]; const cl = { x: 0, y: 0.8, z: 0 }; const tops = new Set(); const hits = new Map(); const dashHit = new Set(); let fx = []; let ap = { cur: 0, back: false }; let hudAt = 0; let callKey = ''; let joinAt = 0;
  const tmpC = new T.Color(); const tmpV = new T.Vector3();
  const auto = (() => { try { return location.hostname === 'localhost' && localStorage.getItem('k3auto') === '1'; } catch { return false; } })(); // yalnızca yerel deneme
  try { if (location.hostname === 'localhost') window.__k3 = () => ({ me, v, dyn, cam, chars, phys, sfx }); } catch { /* yalnızca yerel deneme */ }
  const alive = () => v.players.filter((p) => p.alive).length;
  const iAmIn = () => v.status === 'playing' && v.players[v.me]?.alive && !me.gone;
  const nm = (i) => (i === v.me ? 'Sen' : (v.players[i]?.name || '').replace(' (bot)', ''));
  const myTeam = () => v.st?.teams?.[v.me];
  const hasBomb = (i) => !!v.st?.bombs?.some((b) => b[0] === i);
  const lastRound = () => v.round >= (v.rounds || 3); // tek oyunda ya da kupa finalinde: tur atlanmaz, kazanılır
  const tip = () => (v.mode === 'futbol' ? `Takımın ${TEAM[myTeam() || 0][1]}. Dev topu ${TEAM[1 - (myTeam() || 0)][1].toLowerCase()} kaleye sok!` : v.mode === 'kuyruk' && lastRound() ? 'Süre bitince kuyruğu olan kazanır. Kuyruğun yoksa birine dokunup kap!' : TIPS[v.mode]);
  const modeName = (k) => (v.modes || []).find((x) => x[0] === k)?.[1] || k;
  const after = () => (v.players.some((p, i) => i !== v.me && !p.bot && p.alive) ? 'Kalanları izleyebilirsin.' : ''); // izlenecek başka oyuncu varsa
  const buzz = (p) => { try { if (navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.(p); } catch { /* titreşim yok */ } }; // dokunulmadan titreşim istenirse tarayıcı uyarı basar

  function buildChars() {
    const k = v.players.map((p) => `${p.name}|${p.look?.color}|${p.look?.hat}`).join(',') + v.me; if (k === charKey) return; charKey = k;
    chars.forEach((c) => scene.remove(c.g)); chars.clear();
    v.players.forEach((p, i) => { const c = makeLokum(p.look); c.lbl = label(i === v.me ? tr('Sen') : p.name.replace(' (bot)', ''), i === v.me); c.g.add(c.lbl); c.t = [0, 0, 0, 0]; c.v = [0, 0]; c.fl = 0; c.seen = 0; scene.add(c.g); chars.set(i, c); });
  }
  // Arenanın altındaki manzara: her tur köy ile şehir arasında değişir; arenanın kapladığı alan boş bırakılır
  function setWorld() {
    const c = v.conf || {}; const m = v.status === 'playing' ? v.mode : null; const rd = v.round || 0; let b = { cx: 0, cz: 0, rx: 9, rz: 9 }; const rr = (r) => ({ cx: 0, cz: 0, rx: r, rz: r });
    if (m === 'kosu') b = { cx: 0, cz: -c.len / 2, rx: 13, rz: c.len / 2 + 14 };
    else if (m === 'futbol') b = { cx: 0, cz: 0, rx: c.hx + 7, rz: c.hz + 9 };
    else if (m === 'sakla') b = rr(c.h + 8);
    else if (m === 'zemin') b = rr(c.rings * c.hex * 1.75 + c.hex + 5);
    else if (m === 'renk') b = rr(c.n * c.size * 0.71 + 5);
    else if (m === 'lav') b = rr(c.base + 8);
    else if (m) b = rr((c.r || c.r0 || 10) + 5);
    const th = (location.hostname === 'localhost' && localStorage.getItem('k3theme')) || (m ? themeFor(m, roomSeed + rd) : roomSeed % 2 ? 'sehir' : 'koy');
    world.set(th, roomSeed + rd * 7919, b, -20);
  }
  function buildArena() {
    const key = v.status === 'playing' ? `${v.round}:${v.mode}` : `idle:${v.status}`; if (key === arenaKey) return; arenaKey = key;
    if (arena) { scene.remove(arena); arena.traverse((o) => { o.geometry?.dispose?.(); }); } arena = new T.Group(); scene.add(arena); dyn = {}; tiles = new Map(); rk = { lay: new Map(), key: '' };
    setWorld();
    const cream = lam(0xfff1dc); const nar = lam(0xe23e6d); const teal = lam(0x19c2b8); const plum = lam(0x6b3fa0);
    if (v.status !== 'playing') { arena.add(mesh(new T.CylinderGeometry(1.25, 1.45, 0.5, 40), cream, 0, -0.25, 0)); const ring = mesh(new T.TorusGeometry(1.3, 0.09, 10, 48), nar, 0, 0, 0); ring.rotation.x = Math.PI / 2; arena.add(ring); return; }
    if (v.mode === 'cubuk') {
      const R = v.conf.r; arena.add(mesh(new T.CylinderGeometry(R, R - 0.8, 1.2, 56), cream, 0, -0.6, 0)); const rim = mesh(new T.TorusGeometry(R - 0.1, 0.16, 10, 64), nar); rim.rotation.x = Math.PI / 2; arena.add(rim);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const d = mesh(new T.CircleGeometry(0.5, 16), lam(i % 2 ? 0xffd9a8 : 0xffc2d4), Math.cos(a) * (R - 2), 0.01, Math.sin(a) * (R - 2)); d.rotation.x = -Math.PI / 2; arena.add(d); }
      arena.add(mesh(new T.CylinderGeometry(0.5, 0.6, 1.1, 20), plum, 0, 0.55, 0));
      dyn.bars = v.conf.bars.map((b, i) => { const m = mesh(new T.BoxGeometry(R * 2 - 0.4, 0.5, 0.6), i ? lam(0xffb300) : teal, 0, 0.45, 0); arena.add(m); return m; });
    } else if (v.mode === 'zemin') {
      const { rings, hex: hx } = v.conf; TL = [];
      for (let q = -rings; q <= rings; q++) for (let r = Math.max(-rings, -q - rings); r <= Math.min(rings, -q + rings); r++) TL.push({ q, r, x: hx * Math.sqrt(3) * (q + r / 2), z: hx * 1.5 * r, y: 0, gone: false });
      const im = new T.InstancedMesh(new T.CylinderGeometry(hx * 0.95, hx * 0.86, 0.5, 6), lam(0xffffff), TL.length); const d = new T.Object3D(); const pal = [0xffc2d4, 0xfff1a8, 0xc9eeb0];
      TL.forEach((t, i) => { d.position.set(t.x, -0.25, t.z); d.updateMatrix(); im.setMatrixAt(i, d.matrix); im.setColorAt(i, new T.Color(pal[(((t.q - t.r) % 3) + 3) % 3])); });
      arena.add(im); dyn.im = im; dyn.d = d; Object.entries(v.conf.tiles || {}).forEach(([i, at]) => tiles.set(+i, at));
    } else if (v.mode === 'kosu') {
      TRACK.floors.forEach(([a, b]) => arena.add(mesh(new T.BoxGeometry(TRACK.w * 2, 1, a - b), cream, 0, -0.5, (a + b) / 2)));
      for (let z = -4; z > -120; z -= 8) { if (z < -41 && z > -59) continue; const s = mesh(new T.BoxGeometry(TRACK.w * 2, 0.02, 0.5), lam(0xffd9a8), 0, 0.011, z); arena.add(s); }
      arena.add(mesh(new T.BoxGeometry(TRACK.w * 2, 0.03, TRACK.ice[0] - TRACK.ice[1]), lam(0xa8e6ff), 0, 0.02, (TRACK.ice[0] + TRACK.ice[1]) / 2));
      dyn.plats = TRACK.plats.map((p) => { const m = mesh(new T.BoxGeometry(4.6, 0.6, 4.6), lam(0xffb061), 0, -0.3, p.z); arena.add(m); return m; });
      dyn.sweeps = TRACK.sweeps.map((s, i) => { arena.add(mesh(new T.CylinderGeometry(0.4, 0.5, 1, 16), plum, 0, 0.5, s.z)); const m = mesh(new T.BoxGeometry(8.4, 0.5, 0.6), i % 2 ? lam(0xffb300) : teal, 0, 0.45, s.z); arena.add(m); return m; });
      dyn.hams = TRACK.hammers.map((h) => { [-1, 1].forEach((s) => arena.add(mesh(new T.CylinderGeometry(0.15, 0.15, 6, 8), plum, s * 5, 3, h.z))); arena.add(mesh(new T.BoxGeometry(10.4, 0.3, 0.3), plum, 0, 6, h.z)); const piv = new T.Group(); piv.position.set(0, 6, h.z); piv.add(mesh(new T.CylinderGeometry(0.06, 0.06, 5, 6), dark, 0, -2.5, 0)); const bob = mesh(ball, nar, 0, -5.2, 0); bob.scale.setScalar(0.9); piv.add(bob); arena.add(piv); return piv; });
      [-1, 1].forEach((s) => arena.add(mesh(new T.CylinderGeometry(0.2, 0.2, 5, 10), nar, s * 4.6, 2.5, -v.conf.len))); arena.add(mesh(new T.BoxGeometry(9.6, 0.9, 0.3), lam(0xffffff), 0, 5, -v.conf.len));
      for (let i = 0; i < 9; i++) { const c = mesh(new T.BoxGeometry(1, 0.03, 1), i % 2 ? dark : white, -4 + i, 0.03, -v.conf.len); arena.add(c); }
    } else buildExtra(cream, nar, teal, plum);
  }
  // Ek modların sahneleri
  function buildExtra(cream, nar, teal, plum) {
    const c = v.conf; const m = v.mode; const d = new T.Object3D();
    if (m === 'kuyruk' || m === 'bomba') { // çitli yuvarlak alan
      const R = c.r; const bom = m === 'bomba';
      arena.add(mesh(new T.CylinderGeometry(R, R - 0.8, 1.2, 64), bom ? lam(0xe4f4ee) : cream, 0, -0.6, 0));
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; const rr = i % 2 ? R - 2.2 : R - 5.4; arena.add(lay(mesh(new T.CircleGeometry(i % 2 ? 0.55 : 0.4, 16), lam(bom ? (i % 2 ? 0xffd9a8 : 0xbfe9dc) : (i % 2 ? 0xffc2d4 : 0xffe3a8)), Math.cos(a) * rr, 0.01, Math.sin(a) * rr))); }
      const rail = mesh(new T.TorusGeometry(R - 0.15, 0.09, 8, 72), bom ? lam(0xffb300) : nar, 0, 0.78, 0); rail.rotation.x = Math.PI / 2; arena.add(rail);
      const posts = new T.InstancedMesh(new T.CylinderGeometry(0.11, 0.14, 0.84, 8), plum, 28); for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; d.position.set(Math.cos(a) * (R - 0.15), 0.42, Math.sin(a) * (R - 0.15)); d.updateMatrix(); posts.setMatrixAt(i, d.matrix); } arena.add(posts);
      if (bom) dyn.bombs = [0, 1, 2].map(() => { const g = new T.Group(); const mat = lam(0x2a1d3a); const b = mesh(ball, mat); b.scale.setScalar(0.36); g.add(b); g.add(mesh(new T.CylinderGeometry(0.05, 0.05, 0.2, 6), lam(0xc9a36b), 0, 0.42, 0)); const sp = mesh(ball, flat(0xffb300), 0, 0.56, 0); sp.scale.setScalar(0.09); g.add(sp); g.visible = false; arena.add(g); return { g, mat, sp }; });
    } else if (m === 'sumo') { // daralan platform: birim yarıçaplı, her karede ölçeklenir
      const g = new T.Group(); g.add(mesh(new T.CylinderGeometry(1, 0.93, 1.4, 64), lam(0xf4dba8), 0, -0.7, 0));
      g.add(lay(mesh(new T.RingGeometry(0.9, 1, 64), flat(0xe23e6d), 0, 0.012, 0))); arena.add(g); dyn.sumo = g;
      arena.add(lay(mesh(new T.RingGeometry(1.05, 1.2, 40), flat(0xfffaf2), 0, 0.014, 0)));
    } else if (m === 'renk') { // 7×7 renkli karo
      const h = (c.n * c.size) / 2; const im = new T.InstancedMesh(new T.BoxGeometry(c.size * 0.95, 0.5, c.size * 0.95), lam(0xffffff), c.n * c.n);
      for (let i = 0; i < c.n * c.n; i++) { d.position.set(((i % c.n) + 0.5) * c.size - h, -0.25, (Math.floor(i / c.n) + 0.5) * c.size - h); d.updateMatrix(); im.setMatrixAt(i, d.matrix); im.setColorAt(i, tmpC.setHex(0xffffff)); }
      arena.add(im); dyn.rk = im; dyn.d = d;
    } else if (m === 'lav') { // sarmal basamaklı kule, alttan yükselen lav
      const topY = c.n * c.step;
      arena.add(mesh(new T.CylinderGeometry(c.base, c.base - 0.7, 1.4, 48), lam(0x74598a), 0, -0.7, 0));
      arena.add(mesh(new T.CylinderGeometry(c.col, c.col + 0.6, topY + 3.6, 30), lam(0x7a62a3), 0, (topY - 3.8) / 2, 0));
      for (let y = 3; y < topY - 1; y += 4.8) { const band = mesh(new T.TorusGeometry(c.col + 0.6 - ((y + 3.7) / (topY + 3.6)) * 0.6 + 0.02, 0.16, 8, 40), lam(0xffd9a8), 0, y, 0); band.rotation.x = Math.PI / 2; arena.add(band); }
      const pads = new T.InstancedMesh(new T.CylinderGeometry(c.pad, c.pad - 0.3, 0.45, 22), lam(0xffffff), c.n - 1); const pal = [0xfff1dc, 0xffd9a8, 0xffc2d4];
      for (let i = 1; i < c.n; i++) { const p = padAt(c, i); d.position.set(p.x, p.y - 0.225, p.z); d.updateMatrix(); pads.setMatrixAt(i - 1, d.matrix); pads.setColorAt(i - 1, tmpC.setHex(i === 1 ? 0x5fe0c4 : pal[i % 3])); } arena.add(pads);
      const tp = padAt(c, c.n); arena.add(mesh(new T.CylinderGeometry(c.top, c.top - 0.4, 0.6, 30), lam(0xf5c542), tp.x, tp.y - 0.3, tp.z));
      arena.add(mesh(new T.CylinderGeometry(0.07, 0.07, 3.2, 8), lam(0xfffaf2), tp.x * 0.62, tp.y + 1.6, tp.z * 0.62)); arena.add(mesh(new T.BoxGeometry(1.3, 0.75, 0.06), nar, tp.x * 0.62 + 0.68, tp.y + 2.75, tp.z * 0.62));
      dyn.lava = lay(mesh(new T.CircleGeometry(70, 40), flat(0xff5a1f), 0, -1.5, 0)); arena.add(dyn.lava);
      dyn.glow = lay(mesh(new T.RingGeometry(c.col + 0.4, c.base + 6, 48), flat(0xffc04d, { transparent: true, opacity: 0.4, depthWrite: false }), 0, -1.45, 0)); arena.add(dyn.glow);
    } else if (m === 'futbol') { // duvarlı saha, iki kale, dev top
      const { hx, hz, goal, br } = c; const board = lam(0xfff1dc);
      arena.add(mesh(new T.BoxGeometry(hx * 2 + 1.2, 1, hz * 2 + 1.2), lam(0x8fdca4), 0, -0.5, 0));
      for (let i = -2; i <= 2; i++) if (i % 2) arena.add(mesh(new T.BoxGeometry(hx * 2, 0.02, hz * 0.4), lam(0x9fe5b2), 0, 0.006, i * hz * 0.4));
      arena.add(mesh(new T.BoxGeometry(hx * 2, 0.02, 0.14), flat(0xfffaf2), 0, 0.012, 0)); arena.add(lay(mesh(new T.RingGeometry(2.3, 2.44, 44), flat(0xfffaf2), 0, 0.012, 0)));
      [-1, 1].forEach((s) => arena.add(mesh(new T.BoxGeometry(0.4, 0.9, hz * 2 + 0.8), board, s * (hx + 0.2), 0.45, 0)));
      [-1, 1].forEach((s) => { // s < 0: mavi kale (pembe takım buraya atar), s > 0: pembe kale
        const col = TEAM[s < 0 ? 1 : 0][0]; const w = hx - goal; const gm = lam(col);
        [-1, 1].forEach((e) => { arena.add(mesh(new T.BoxGeometry(w, 0.9, 0.4), board, e * (goal + w / 2), 0.45, s * (hz + 0.2))); arena.add(mesh(new T.CylinderGeometry(0.15, 0.15, 2.7, 10), gm, e * goal, 1.35, s * hz)); arena.add(mesh(new T.BoxGeometry(0.1, 2.6, 2.2), lam(col, { transparent: true, opacity: 0.35 }), e * goal, 1.3, s * (hz + 1.1))); });
        arena.add(mesh(new T.BoxGeometry(goal * 2 + 0.3, 0.26, 0.26), gm, 0, 2.7, s * hz)); arena.add(mesh(new T.BoxGeometry(goal * 2, 2.6, 0.1), lam(col, { transparent: true, opacity: 0.35 }), 0, 1.3, s * (hz + 2.2)));
        arena.add(mesh(new T.BoxGeometry(goal * 2, 1, 2.4), lam(col), 0, -0.5, s * (hz + 1.2))); arena.add(mesh(new T.BoxGeometry(goal * 2 + 2.4, 0.02, 3.2), lam(col, { transparent: true, opacity: 0.3 }), 0, 0.01, s * (hz - 1.6)));
      });
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const x = cv.getContext('2d'); x.fillStyle = '#fffaf2'; x.fillRect(0, 0, 256, 128);
      [['#ff6fa5', 30, 34, 20], ['#4aa8ff', 96, 86, 22], ['#ffd43b', 158, 36, 19], ['#9b6bdf', 220, 88, 21], ['#4aa8ff', 226, 22, 12], ['#ff6fa5', 150, 104, 13], ['#ffd43b', 40, 102, 12], ['#9b6bdf', 94, 20, 11]].forEach(([f, cx, cy, r]) => { x.fillStyle = f; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); });
      dyn.ball = mesh(new T.SphereGeometry(br, 28, 20), new T.MeshLambertMaterial({ map: new T.CanvasTexture(cv) }), 0, br, 0); arena.add(dyn.ball);
      dyn.bsh = lay(mesh(new T.CircleGeometry(br * 0.92, 24), flat(0x000000, { transparent: true, opacity: 0.2, depthWrite: false }), 0, 0.02, 0)); arena.add(dyn.bsh);
      dyn.bs = { x: 0, z: 0, vx: 0, vz: 0, sx: 0, sz: 0, svx: 0, svz: 0, own: 0, fr: 0 };
    } else if (m === 'sakla') { // çitle çevrili bahçe: duvarlar, sandıklar, çalılar; ebe ve görüş ışığı
      const H = c.h; arena.add(mesh(new T.BoxGeometry(H * 2 + 1.6, 1, H * 2 + 1.6), lam(0xb9e2a6), 0, -0.5, 0));
      const inst = (geo, mat, list, put) => { const im = new T.InstancedMesh(geo, mat, list.length); list.forEach((it, k) => { d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); put(it, k); d.updateMatrix(); im.setMatrixAt(k, d.matrix); }); arena.add(im); return im; }; // aynı türden parçalar tek çizim
      inst(new T.CircleGeometry(1, 14), lam(0xc9ecb6), [...Array(18).keys()], (i) => { d.position.set(((i * 7.3) % (H * 2 - 3)) - H + 1.5, 0.008, ((i * 11.9) % (H * 2 - 3)) - H + 1.5); d.rotation.x = -Math.PI / 2; d.scale.setScalar(0.9 + (i % 3) * 0.5); });
      arena.add(lay(mesh(new T.RingGeometry(1.7, 1.95, 40), flat(0xfffaf2), 0, 0.012, 0))); // ebenin saydığı yer
      [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([sx, sz]) => arena.add(mesh(new T.BoxGeometry(sx ? 0.5 : H * 2 + 1.4, 1.1, sx ? H * 2 + 1.4 : 0.5), plum, sx * (H + 0.45), 0.55, sz * (H + 0.45))));
      const box = new T.BoxGeometry(1, 1, 1); const of = (k) => c.walls.filter((w) => w[4] === k);
      inst(box, cream, of(0), ([x, z, w, dd]) => { d.position.set(x, 0.85, z); d.scale.set(w, 1.7, dd); }); inst(box, nar, of(0), ([x, z, w, dd]) => { d.position.set(x, 1.75, z); d.scale.set(w + 0.14, 0.2, dd + 0.14); }); // duvar ve kırmızı üst şeridi
      inst(box, lam(0xdba463), of(1), ([x, z, w, dd]) => { d.position.set(x, 0.75, z); d.scale.set(w, 1.5, dd); }); inst(box, lam(0xb9813f), of(1), ([x, z, w, dd]) => { d.position.set(x, 1.5, z); d.scale.set(w + 0.14, 0.2, dd + 0.14); }); // sandık
      inst(cubeGeo, lam(0x58b368), of(2), ([x, z, w, dd]) => { d.position.set(x, 0.8, z); d.scale.set(w + 0.25, 1.75, dd + 0.25); }); // çalı
      dyn.ebes = c.ebes.map(([x, z, ry]) => { // ebe: iri mor lokum; önünde duvarlarda kesilen görüş ışığı
        const ch = makeLokum({ hex: 0x4a2d7a, hat: 'yok' }); ch.g.scale.setScalar(1.4); ch.g.add(label(tr('Ebe'), true, 'rgba(226,62,109,.96)')); ch.g.position.set(x, 0, z); ch.g.rotation.y = ry; arena.add(ch.g);
        const N = 26; const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(new Float32Array((N + 2) * 3), 3)); const ix = []; for (let i = 1; i <= N; i++) ix.push(0, i, i + 1); geo.setIndex(ix);
        const cone = new T.Mesh(geo, flat(0xffe45e, { transparent: true, opacity: 0.4, depthWrite: false, side: T.DoubleSide })); cone.frustumCulled = false; cone.visible = false; arena.add(cone);
        return { ch, cone, N, x, z, ry, t: [x, z, ry], on: 0 };
      });
    }
  }
  function placeAll() { // tur başı: herkes başlangıç yerine
    Object.entries(v.spawn || {}).forEach(([i, p]) => { const c = chars.get(+i); if (c) { c.g.position.set(p[0], p[1], p[2]); c.t = [p[0], p[1], p[2], 0]; c.v = [0, 0]; c.g.visible = !!v.players[+i]?.alive; c.fl = 0; c.body.rotation.x = 0; c.seen = performance.now() + 9e6; } }); // tur ortasında bağlanan, elenmişleri görmez
    chars.forEach((c, i) => { if (!v.spawn?.[i]) c.g.visible = false; });
    const s = v.spawn?.[v.me]; const out = !s || !v.players[v.me]?.alive; const at = !out && v.phase === 'play' && v.at ? v.at : null; // at: sayfa yenilendiyse kaldığım yer
    Object.assign(me, { x: at ? at[0] : s ? s[0] : 0, y: at ? at[1] : 0, z: at ? at[2] : s ? s[2] : 0, vx: 0, vy: 0, vz: 0, stun: 0, cp: 0, fin: false, gone: out, ry: v.mode === 'kosu' || (v.mode === 'futbol' && !myTeam()) ? Math.PI : 0, dash: 0, dcd: 0, dfl: 0, top: false, dead: false, finAt: 0, jbuf: 0, air: 0, jumped: false, hideAt: out ? 1 : 0 });
    wrap.classList.remove('seen'); tops.clear(); hits.clear(); dashHit.clear(); ap = { cur: 0, back: false }; lf = [0, -1]; if (dyn.bs) Object.assign(dyn.bs, { x: 0, z: 0, vx: 0, vz: 0, sx: 0, sz: 0, svx: 0, svz: 0, own: 0, fr: 0 });
  }

  // ---- Zemin ve engeller ----
  const rkPos = (i) => { const c = v.conf; const h = (c.n * c.size) / 2; return [((i % c.n) + 0.5) * c.size - h, (Math.floor(i / c.n) + 0.5) * c.size - h]; };
  function rkState(t) { // Renk Zemini: hangi dizilim görünüyor, hangi aşamadayız (0 bekleme, 1 renk söylendi, 2 diğer karolar düştü)
    const c = v.conf; let L = 0; while (L < c.cyc.length && c.cyc[L][3] <= t) L++;
    const k = Math.min(L, c.cyc.length - 1); const cy = c.cyc[k]; if (!rk.lay.has(k)) rk.lay.set(k, renkLayout(c, k, cy[0]));
    return { k, lay: rk.lay.get(k), col: cy[0], cy, phase: L >= c.cyc.length || t < cy[1] ? 0 : t < cy[2] ? 1 : 2, back: L > 0 ? c.cyc[L - 1][3] : -9 };
  }
  function ground(t, py = me.y) {
    const m = v.mode; const c = v.conf;
    if (m === 'cubuk') return Math.hypot(me.x, me.z) <= c.r ? FLAT : null;
    if (m === 'zemin') {
      let best = -1; let bd = 9; TL.forEach((tl, i) => { const d = Math.hypot(me.x - tl.x, me.z - tl.z); if (d < bd) { bd = d; best = i; } });
      if (best < 0 || bd > c.hex * 0.93) return null; const at = tiles.get(best); if (at && srv() >= at) return null;
      return { y: 0, vx: 0, tile: best };
    }
    if (m === 'kuyruk' || m === 'bomba' || m === 'futbol' || m === 'sakla') return FLAT;
    if (m === 'sumo') return Math.hypot(me.x, me.z) <= sumoR(c, t) ? FLAT : null;
    if (m === 'renk') { const h = (c.n * c.size) / 2; const cx = Math.floor((me.x + h) / c.size); const cz = Math.floor((me.z + h) / c.size); if (cx < 0 || cz < 0 || cx >= c.n || cz >= c.n) return null; const s = rkState(t); return s.phase === 2 && s.lay[cz * c.n + cx] !== s.col ? null : FLAT; }
    if (m === 'lav') { // ayağın altındaki en yüksek basamak (basamaklara alttan zıplanabilir)
      let y = Math.hypot(me.x, me.z) <= c.base ? 0 : -99;
      for (let i = 1; i <= c.n; i++) { const p = padAt(c, i); if (p.y > py + 0.05) break; if (Math.hypot(me.x - p.x, me.z - p.z) <= (i === c.n ? c.top : c.pad)) y = p.y; }
      return y > -50 ? { y, vx: 0 } : null;
    }
    if (Math.abs(me.x) <= TRACK.w && TRACK.floors.some(([a, b]) => me.z <= a && me.z >= b)) return { y: 0, vx: 0, ice: me.z < TRACK.ice[0] && me.z > TRACK.ice[1] };
    for (const p of TRACK.plats) { const px = p.amp * Math.sin(p.w * t + p.ph); if (Math.abs(me.x - px) <= 2.3 && Math.abs(me.z - p.z) <= 2.3) return { y: 0, vx: p.amp * p.w * Math.cos(p.w * t + p.ph) }; }
    return null;
  }
  // Saklambaç: ışının ilk engele uzaklığı (görüş ışığını duvarda kesmek ve "görülüyor muyum" için)
  function rayWalls(ox, oz, dx, dz, max) {
    let best = max;
    for (const [x, z, w, d] of v.conf.walls) {
      let t0 = 0; let t1 = best;
      if (Math.abs(dx) < 1e-9) { if (ox < x - w / 2 || ox > x + w / 2) continue; } else { let a = (x - w / 2 - ox) / dx; let b = (x + w / 2 - ox) / dx; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) continue; }
      if (Math.abs(dz) < 1e-9) { if (oz < z - d / 2 || oz > z + d / 2) continue; } else { let a = (z - d / 2 - oz) / dz; let b = (z + d / 2 - oz) / dz; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) continue; }
      best = t0;
    }
    return best;
  }
  function seenByEbe() { // ebe beni şu an görüyor mu? (asıl karar sunucuda; bu yalnızca uyarı içindir)
    const c = v.conf; return (dyn.ebes || []).some((e) => { if (!e.on) return false; const dx = me.x - e.x; const dz = me.z - e.z; const d = Math.hypot(dx, dz); if (d > c.range) return false;
      if (d > 1.1) { let a = Math.atan2(dx, dz) - e.ry; a = Math.atan2(Math.sin(a), Math.cos(a)); if (Math.abs(a) > c.half) return false; }
      return d < 0.05 || rayWalls(e.x, e.z, dx / d, dz / d, d) >= d - 0.02; });
  }
  function knock(vx, vz, up = 6.5) { me.vx = vx; me.vz = vz; me.vy = up; me.stun = 0.7; me.ground = false; feel(0.3, 40, 'hit'); puff(me.x, me.y + 0.4, me.z, 1.2, 0xffd34d); }
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
  // Sumo: rakiple çarpışma. Botların itilmesini sunucu, benim itilmemi kendi cihazım hesaplar
  function shove(nowMs) {
    chars.forEach((c, i) => {
      if (i === v.me || !v.players[i]?.alive || !c.g.visible) return; const p = c.g.position;
      const dx = me.x - p.x; const dz = me.z - p.z; const d = Math.hypot(dx, dz); if (d > (c.fl === 3 || me.dash > 0 ? 1.2 : 0.95) || d < 0.001 || Math.abs(me.y - p.y) > 0.9) return;
      const nx = dx / d; const nz = dz / d;
      if (me.dash > 0 && !dashHit.has(i)) { dashHit.add(i); state.socket?.emit('k3:hit', i); feel(0.2, 25, 'hit', 0.8); puff((me.x + p.x) / 2, me.y + 0.5, (me.z + p.z) / 2, 1, 0xffd34d); }
      if (d < 0.9) { me.x += nx * (0.9 - d) * 0.5; me.z += nz * (0.9 - d) * 0.5; }
      if (nowMs < (hits.get(i) || 0)) return; hits.set(i, nowMs + 300);
      const apr = Math.max(0, (c.v[0] - me.vx) * nx + (c.v[1] - me.vz) * nz); const J = Math.min(9, apr * 0.8 + (c.fl === 3 ? 4.5 : 1.2)) * (me.dash > 0 ? 0.3 : 1);
      me.vx += nx * J; me.vz += nz * J; me.stun = Math.max(me.stun, c.fl === 3 ? 0.3 : 0.12); if (c.fl === 3) buzz(35);
    });
  }
  // Futbol: topa değince vuruşu hemen göster (asıl top sunucuda; kısa süre kendi tahminime güvenirim)
  function kick(nowMs) {
    const b = dyn.bs; const c = v.conf; if (!b || nowMs < b.fr || me.y > 1.6) return; const dx = b.x - me.x; const dz = b.z - me.z; const d = Math.hypot(dx, dz); const min = c.br + 0.5; if (d >= min || d < 0.001) return;
    const nx = dx / d; const nz = dz / d; const rel = (me.vx - b.vx) * nx + (me.vz - b.vz) * nz;
    if (rel > 0) { b.vx += nx * rel * c.k + me.vx * c.c; b.vz += nz * rel * c.k + me.vz * c.c; const sp = Math.hypot(b.vx, b.vz); if (sp > c.vmax) { b.vx *= c.vmax / sp; b.vz *= c.vmax / sp; } b.own = nowMs + 380; if (rel > 2) { sfx.play('kick', Math.min(1, rel / 8), 160); if (rel > 5) buzz(15); } }
    b.x = me.x + nx * min; b.z = me.z + nz * min;
  }
  function autopilot(t) { // yalnızca yerel deneme için (localStorage k3auto=1); yönler dünya eksenindedir
    inp.x = 0; inp.z = 0; inp.jump = false; const m = v.mode; const c = v.conf;
    const go = (x, z, s = 1) => { const d = Math.hypot(x - me.x, z - me.z) || 1; inp.x = ((x - me.x) / d) * s; inp.z = ((z - me.z) / d) * s; return d; };
    const near = (f) => { let best = null; let bd = 99; chars.forEach((ch, i) => { if (i === v.me || !v.players[i]?.alive || !ch.g.visible || !f(i)) return; const d = Math.hypot(ch.g.position.x - me.x, ch.g.position.z - me.z); if (d < bd) { bd = d; best = ch.g.position; } }); return best && [best, bd]; };
    if (m === 'cubuk') { const r = Math.hypot(me.x, me.z) || 1; const k = (4.5 - r) * 0.5; inp.x = (me.x / r) * k; inp.z = (me.z / r) * k;
      c.bars.forEach((b) => { const w = barW(b, t); if (!w) return; let rel = (Math.atan2(me.z, me.x) - barAngle(b, t)) * b.dir; rel = ((rel % Math.PI) + Math.PI) % Math.PI; if ((rel * r - 0.8) / (w * r) < 0.13) inp.jump = true; }); }
    else if (m === 'zemin') { let best = null; let bd = 99; TL.forEach((tl, i) => { if (tiles.has(i)) return; const d = Math.hypot(me.x - tl.x, me.z - tl.z); if (d > 0.5 && d < bd) { bd = d; best = tl; } }); if (best) { inp.x = (best.x - me.x) / bd; inp.z = (best.z - me.z) / bd; } }
    else if (m === 'kosu') { inp.z = -1; inp.x = -me.x * 0.3; if (Math.floor(t * 1.4) % 2 === 0) inp.jump = true; }
    else if (m === 'kuyruk' || m === 'bomba') {
      const hold = (i) => (m === 'kuyruk' ? !!v.st?.tails?.includes(i) : hasBomb(i)); const chase = m === 'kuyruk' ? !hold(v.me) : hold(v.me);
      const tg = near((i) => (m === 'kuyruk' ? hold(i) === chase : hold(i) !== chase)); if (!tg) return;
      if (chase) go(tg[0].x, tg[0].z); else if (tg[1] < 7) { let dx = me.x - tg[0].x; let dz = me.z - tg[0].z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d; const r = Math.hypot(me.x, me.z) || 1;
        if (r > c.r - 3) { const tx = -me.z / r; const tz = me.x / r; const s = tx * dx + tz * dz >= 0 ? 1 : -1; dx = dx * 0.25 + tx * s - (me.x / r) * 0.6; dz = dz * 0.25 + tz * s - (me.z / r) * 0.6; } const l = Math.hypot(dx, dz) || 1; inp.x = dx / l; inp.z = dz / l; }
    } else if (m === 'sumo') { const tg = near(() => true); const r = Math.hypot(me.x, me.z); if (r > sumoR(c, t) - 2 || !tg) go(0, 0, Math.min(1, r)); else { go(tg[0].x, tg[0].z); if (tg[1] < 2 && Math.hypot(tg[0].x, tg[0].z) > r - 0.3) inp.jump = true; } }
    else if (m === 'renk') { const s = rkState(t); if (!s.phase) return; let bd = 99; let bx = 0; let bz = 0; s.lay.forEach((col, i) => { if (col !== s.col) return; const [x, z] = rkPos(i); const d = Math.hypot(x - me.x, z - me.z); if (d < bd) { bd = d; bx = x; bz = z; } }); if (bd > 0.3) go(bx, bz, Math.min(1, bd)); }
    else if (m === 'lav') { if (me.top) return; if (me.ground) ap.cur = Math.round(me.y / c.step); const nx = padAt(c, Math.min(c.n, ap.cur + 1)); const d = Math.hypot(nx.x - me.x, nx.z - me.z);
      if (me.ground) { if (d < 3.3) ap.back = true; else if (d >= 3.95) ap.back = false; } go(nx.x, nx.z, ap.back && me.ground ? -1 : 1);
      if (me.ground && !ap.back && d <= 4.35 && (me.vx * (nx.x - me.x) + me.vz * (nx.z - me.z)) / d > 4.8) inp.jump = true; }
    else if (m === 'sakla') { let best = null; let bd = -1; [[12.6, 13], [-12.6, 13], [12.6, -13], [-12.6, -13], [0, 12], [0, -12]].forEach(([x, z]) => { const d = Math.min(...dyn.ebes.map((e) => Math.hypot(e.x - x, e.z - z))); if (d > bd) { bd = d; best = [x, z]; } }); const d = Math.hypot(best[0] - me.x, best[1] - me.z); if (d > 0.5) go(best[0], best[1], Math.min(1, d)); }
    else if (m === 'futbol') { const b = dyn.bs; const gz = myTeam() ? c.hz : -c.hz; let gx = -b.x; let gq = gz - b.z; const gl = Math.hypot(gx, gq) || 1; gx /= gl; gq /= gl; const px = b.x - gx * 1.9; const pz = b.z - gq * 1.9;
      if ((me.x - b.x) * gx + (me.z - b.z) * gq < -0.6 && Math.hypot(me.x - px, me.z - pz) < 2.2) go(b.x + gx * 2, b.z + gq * 2); else go(px, pz); }
  }
  // Bakış yönü (yatay): lavda kuleye doğru döner, futbolda hücum edilen kaleye bakar. Kumanda bu yöne göredir.
  function look(px, pz) {
    if (v.status !== 'playing') return [0, -1];
    if (v.mode === 'lav') { const r = Math.hypot(px, pz); if (r > 0.5) lf = [-px / r, -pz / r]; return lf; }
    return v.mode === 'futbol' && myTeam() === 1 ? [0, 1] : [0, -1];
  }

  // ---- Oyuncu fiziği ----
  function step(dt, t, nowMs) {
    const m = v.mode; const c = v.conf; let wx; let wz;
    if (auto) { autopilot(t); wx = inp.x; wz = inp.z; } else {
      const kx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0); const kz = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0); if (kx || kz || keys.size) { inp.x = kx; inp.z = kz; }
      const f = look(me.x, me.z); wx = -f[1] * inp.x - f[0] * inp.z; wz = f[0] * inp.x - f[1] * inp.z; // ekrana göre yön → dünya yönü
    }
    const g0 = ground(t); const k = me.stun > 0 ? 0.8 : g0?.ice ? 1.7 : me.ground ? 12 : 5; const l = Math.hypot(wx, wz); if (l > 1) { wx /= l; wz /= l; }
    const sp = SPEED * (m === 'bomba' && hasBomb(v.me) ? 1.1 : 1); // bombayı taşıyan biraz hızlanır
    me.vx += (wx * sp - me.vx) * Math.min(1, k * dt); me.vz += (wz * sp - me.vz) * Math.min(1, k * dt); me.stun = Math.max(0, me.stun - dt);
    const act = inp.jump || keys.has(' '); inp.jump = false;
    if (m === 'sumo') { // zıplama yerine itiş: baktığın yöne kısa bir atılma
      if (act && me.stun <= 0 && t >= me.dcd) { const ll = Math.hypot(wx, wz); me.dvx = (ll > 0.3 ? wx / ll : Math.sin(me.ry)) * 13; me.dvz = (ll > 0.3 ? wz / ll : Math.cos(me.ry)) * 13; me.dash = 0.22; me.dfl = 0.38; me.dcd = t + 1.3; dashHit.clear(); sfx.play('dash'); puff(me.x, me.y, me.z, 1, 0xffffff); }
      if (me.dash > 0) { me.dash -= dt; me.vx = me.dvx; me.vz = me.dvz; } me.dfl = Math.max(0, me.dfl - dt);
    } else { // zıplama: tuşa biraz erken basılsa da, kenardan az önce çıkılmış olsa da tutar
      if (act) me.jbuf = 0.13; else me.jbuf = Math.max(0, me.jbuf - dt); me.air = me.ground ? 0 : me.air + dt;
      if (me.jbuf > 0 && me.stun <= 0 && (me.ground || (me.air < 0.12 && !me.jumped && me.vy <= 0))) { me.vy = JUMP; me.ground = false; me.jumped = true; me.jbuf = 0; sfx.play('jump', 0.8, 120); }
    }
    const py = me.y; me.vy -= G * dt; me.y += me.vy * dt;
    if (m === 'lav') { // kulenin çevresinde kutupsal hareket: "sağa" basılı tutunca yarıçap sabit kalır, basamak sırası kaçmaz
      const r0 = Math.hypot(me.x, me.z) || 1; const ux = me.x / r0; const uz = me.z / r0; const vr = me.vx * ux + me.vz * uz; const vt = -me.vx * uz + me.vz * ux;
      const pull = me.y < c.n * c.step - 0.5 ? (c.rad - r0) * 1.6 * (1 - Math.min(1, Math.abs(auto ? 1 : inp.z) * 1.6)) : 0; // içe-dışa basılmıyorsa basamak hattına doğru hafifçe çeker
      const th = Math.atan2(me.z, me.x) + (vt * dt) / r0; const r1 = Math.max(0.1, r0 + (vr + pull) * dt); const cx = Math.cos(th); const cz = Math.sin(th);
      me.x = cx * r1; me.z = cz * r1; me.vx = vr * cx - vt * cz; me.vz = vr * cz + vt * cx;
    } else { me.x += me.vx * dt; me.z += me.vz * dt; }
    if (m === 'kuyruk' || m === 'bomba') { const R = c.r - 0.5; const r = Math.hypot(me.x, me.z); if (r > R) { me.x *= R / r; me.z *= R / r; } }
    else if (m === 'futbol') { me.x = Math.max(-c.hx + 0.4, Math.min(c.hx - 0.4, me.x)); me.z = Math.max(-c.hz + 0.4, Math.min(c.hz - 0.4, me.z)); kick(nowMs); }
    else if (m === 'lav') { const r = Math.hypot(me.x, me.z); const lim = c.col + PR; if (r < lim && me.y < c.n * c.step) { if (r < 0.01) me.x = lim; else { me.x *= lim / r; me.z *= lim / r; } } }
    else if (m === 'sumo') shove(nowMs);
    if (m !== 'sumo') bump(nowMs);
    else if (m === 'sakla') { // bahçenin içinde kal, engellerin içinden geçme (daire - kutu çarpışması)
      const L = c.h - 0.5; me.x = Math.max(-L, Math.min(L, me.x)); me.z = Math.max(-L, Math.min(L, me.z));
      for (const [x, z, w, d] of c.walls) {
        const nx = Math.max(x - w / 2, Math.min(x + w / 2, me.x)); const nz = Math.max(z - d / 2, Math.min(z + d / 2, me.z)); const dx = me.x - nx; const dz = me.z - nz; const dist = Math.hypot(dx, dz); if (dist >= PR) continue;
        if (dist > 1e-4) { me.x = nx + (dx / dist) * PR; me.z = nz + (dz / dist) * PR; } else if (w / 2 - Math.abs(me.x - x) < d / 2 - Math.abs(me.z - z)) me.x = x + Math.sign(me.x - x || 1) * (w / 2 + PR); else me.z = z + Math.sign(me.z - z || 1) * (d / 2 + PR);
      }
    }
    if (m === 'lav' && me.top) { const tp = padAt(c, c.n); const dx = me.x - tp.x; const dz = me.z - tp.z; const d = Math.hypot(dx, dz); const lim = c.top - 0.5; if (d > lim) { me.x = tp.x + (dx / d) * lim; me.z = tp.z + (dz / d) * lim; } } // zirveye çıkan aşağı düşmesin
    const g = ground(t, py);
    if (g && me.vy <= 0 && me.y <= g.y && py >= g.y - 0.55) { const vy0 = me.vy; const was = me.ground; me.y = g.y; me.vy = 0; me.ground = true; me.jumped = false; me.x += g.vx * dt; if (!was && vy0 < -5) landed(vy0); if (g.tile !== undefined && !tiles.has(g.tile)) { tiles.set(g.tile, srv() + (c.ms || 1100)); state.socket?.emit('k3:tile', g.tile); sfx.play('crack', 0.7, 140); } } else me.ground = false;
    if (Math.hypot(me.vx, me.vz) > 0.6) me.ry = Math.atan2(me.vx, me.vz);
    obstacles(t);
    if (m === 'kosu') {
      TRACK.cps.forEach((cp, i) => { if (me.z <= cp && i > me.cp) me.cp = i; });
      if (me.y < -7) Object.assign(me, { x: (Math.random() - 0.5) * 4, y: 2.5, z: TRACK.cps[me.cp] - 0.8, vx: 0, vy: 0, vz: 0, stun: 0 });
      if (!me.fin && me.z <= -c.len) { me.fin = true; state.socket?.emit('k3:s', [me.x, me.y, me.z, me.ry, 0]); state.socket?.emit('k3:fin'); }
    } else if (m === 'lav') {
      if (!me.top && me.ground && me.y >= c.n * c.step - 0.1) { me.top = true; me.finAt = 0; banner('Zirvedesin! 🎉', '', 1600); buzz(60); }
      if (me.top && !tops.has(v.me) && nowMs - me.finAt > 900) { me.finAt = nowMs; state.socket?.emit('k3:s', [me.x, me.y, me.z, me.ry, 0]); state.socket?.emit('k3:fin'); } // sunucu onaylayana dek yinele
      if (!me.top && me.y < lavaY(c, t) - 0.15) die('Lav seni yakaladı!', 0, 5, 0);
    } else if (me.y < -7 && !me.gone) { me.gone = true; state.socket?.emit('k3:out'); banner('Düştün!', after(), 2600); }
  }
  function die(title, vx, vy, vz, tell = true) { // elendim: karakter savrulur, kalanları izlerim
    if (me.gone) return; Object.assign(me, { gone: true, dead: true, vx, vy, vz, ground: false, stun: 3 }); if (tell) state.socket?.emit('k3:out');
    banner(title, after(), 2600); feel(0.32, [70, 40, 70], 'out');
  }
  function boom(x, y, z) { const m = mesh(ball, flat(0xffb347, { transparent: true, opacity: 0.85, depthWrite: false }), x, y + 0.8, z); m.scale.setScalar(0.3); scene.add(m); fx.push({ m, t0: performance.now() }); }
  const puffGeo = new T.RingGeometry(0.42, 0.6, 20);
  function puff(x, y, z, size = 1, color = 0xffffff) { const m = lay(mesh(puffGeo, flat(color, { transparent: true, opacity: 0.6, depthWrite: false }), x, y + 0.05, z)); m.scale.setScalar(0.5 * size); scene.add(m); fx.push({ m, t0: performance.now(), d: 380, a: 0.5 * size, b: 1.5 * size, op: 0.55 }); }
  // İniş: düşüş hızına göre toz, ses, hafif sarsıntı, karakter basılır
  function landed(vy) { const k = Math.min(1, -vy / 16); sfx.play('land', 0.35 + k * 0.8, 90); puff(me.x, me.y, me.z, 0.8 + k * 0.7); const mc = chars.get(v.me); if (mc) mc.ld = 0.45 + k * 0.55; if (vy < -9.5) feel(0.04 + k * 0.1, 8); }
  // Diğer oyunculara çarpma (sumo hariç): iç içe geçilmez; hızlı çarpınca hafifçe sekilir
  function bump(nowMs) {
    const soft = v.mode === 'kosu' || v.mode === 'lav';
    chars.forEach((c, i) => {
      if (i === v.me || !c.g.visible || !v.players[i]?.alive || c.fl === 2) return; const p = c.g.position;
      const dx = me.x - p.x; const dz = me.z - p.z; const d = Math.hypot(dx, dz); if (d > 0.84 || d < 0.001 || Math.abs(me.y - p.y) > 0.8) return;
      const nx = dx / d; const nz = dz / d; const push = (0.84 - d) * (soft ? 0.25 : 0.55); me.x += nx * push; me.z += nz * push;
      if (soft || me.stun > 0) return;
      const vn = (me.vx - (c.v?.[0] || 0)) * nx + (me.vz - (c.v?.[1] || 0)) * nz; if (vn > -1.5) return; // eksi: birbirine doğru
      const j = Math.min(5, -vn * 1.35); me.vx += nx * j; me.vz += nz * j;
      if (vn < -4.5 && nowMs - bumpAt > 350) { bumpAt = nowMs; feel(0.1, 12, 'bump', Math.min(1, -vn / 10)); puff((me.x + p.x) / 2, me.y + 0.5, (me.z + p.z) / 2, 0.7, 0xfff1a8); }
    });
  }
  // Fizik nesneleri: turun arenasına göre zemin, hareketli engeller ve itilebilir toplar, sandıklar
  function buildProps() {
    phys.reset(); if (v.status !== 'playing') return; const c = v.conf; const m = v.mode; const rnd = (a, b) => a + Math.random() * (b - a);
    const ring = (n, r0, r1, f) => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rnd(0, 0.6); const r = rnd(r0, r1); f(Math.cos(a) * r, Math.sin(a) * r); } };
    if (m === 'cubuk') { phys.disc(c.r - 0.2); phys.post(0, 0, 0.62, 1.1); c.bars.forEach((b, i) => phys.mover(`bar${i}`, 'box', c.r - 0.2, 0.25, 0.3)); ring(7, 3, c.r - 2, (x, z) => phys.ball(x, rnd(3, 8), z, 0.45, { respawn: 5, spread: c.r - 3 })); }
    else if (m === 'kuyruk' || m === 'bomba') { phys.disc(c.r - 0.2); ring(6, 2.5, c.r - 2.5, (x, z) => phys.ball(x, rnd(2, 6), z, 0.45)); ring(4, 3, c.r - 3, (x, z) => phys.crate(x, 0.6, z, 0.85)); }
    else if (m === 'kosu') {
      TRACK.floors.forEach(([a, b]) => phys.box(0, -0.5, (a + b) / 2, TRACK.w, 0.5, (a - b) / 2));
      TRACK.plats.forEach((q, i) => phys.mover(`pl${i}`, 'box', 2.3, 0.3, 2.3)); TRACK.sweeps.forEach((q, i) => { phys.post(0, q.z, 0.5, 1); phys.mover(`sw${i}`, 'box', 4.2, 0.25, 0.3); }); TRACK.hammers.forEach((q, i) => phys.mover(`hm${i}`, 'ball', 0.9));
      [-8, -108, -116].forEach((z) => { for (let r = 0; r < 2; r++) for (let k = -2; k <= 2; k++) phys.crate(k * 0.95 + (r ? 0.45 : 0), 0.45 + r * 0.9, z, 0.86, { ry: 0, mass: 0.55 }); }); // içinden koşup devrilen sandık duvarları
      [-64, -70, -76].forEach((z) => phys.ball(rnd(-3, 3), 1, z, 0.5));
    } else if (m === 'sakla') { phys.box(0, -0.5, 0, c.h, 0.5, c.h); c.walls.forEach(([x, z, w, d]) => phys.box(x, 1, z, w / 2, 1, d / 2)); ring(6, 4, c.h - 3, (x, z) => phys.ball(x, 3, z, 0.42)); }
  }

  // ---- Arayüz ----
  let banT = 0;
  function banner(title, sub, ms) { const b = $('.k3-banner'); b.hidden = false; b.innerHTML = `<b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}`; clearTimeout(banT); if (ms) banT = setTimeout(() => { b.hidden = true; }, ms); }
  function feed(text) { const f = $('.k3-feed'); const el = document.createElement('span'); el.textContent = text; f.append(el); setTimeout(() => el.remove(), 2600); while (f.children.length > 3) f.firstChild.remove(); }
  function leftText(t) { // sağ üstteki durum yazısı
    const m = v.mode; const st = v.st || {}; const n = alive(); t = Math.max(0, t);
    if (m === 'kosu') return `${n} yarışçı · ilk bitiren kazanır`;
    if (m === 'kuyruk') return `${clock(v.conf.len - t)} · ${st.tails?.includes(v.me) ? 'Kuyruk sende, kaç!' : iAmIn() ? 'Kuyruk kap!' : lastRound() ? 'Kuyruğu olan kazanır' : 'Kuyruğu olan tur atlar'}`;
    if (m === 'futbol') return `${TEAM[0][1]} ${st.score?.[0] ?? 0} – ${st.score?.[1] ?? 0} ${TEAM[1][1]} · ${st.ot ? 'Altın gol' : clock(v.conf.len - t)}${myTeam() != null ? ` · Sen: ${TEAM[myTeam()][1]}` : ''}`;
    if (m === 'lav') return me.top && v.keep > 1 ? `Zirvedesin · ${tops.size}/${v.keep} kişi çıktı` : v.keep > 1 ? `Zirveye ilk ${v.keep} kişi tur atlar` : 'Zirveye ilk çıkan kazanır';
    if (m === 'bomba' && hasBomb(v.me)) return 'Bomba sende! Birine dokun';
    if (m === 'sakla') return t < v.conf.wait ? `Ebe sayıyor: ${Math.ceil(v.conf.wait - t)} · saklan!` : `${clock(v.conf.len - t)} · Kalan ${n}${v.keep > 1 ? ` · ${v.keep} kişi tur atlar` : ''}`;
    return v.keep > 1 ? `Kalan ${n} · ${v.keep} kişi tur atlar` : `Kalan ${n} · son kalan kazanır`;
  }
  let leftStr = ''; const setLeft = (s) => { if (s !== leftStr) { leftStr = s; $('.k3-left').textContent = s; } }; // yalnızca değişince yaz (çeviri katmanı her yazışta yeniden çalışmasın)
  function hud() {
    const playing = v.status === 'playing'; $('.k3-round').textContent = playing ? (v.rounds > 1 ? `${v.round}. tur · ${v.title}` : v.title) : 'Parti Kupası';
    const left = $('.k3-left'); left.hidden = !playing; if (playing) setLeft(leftText(v.playAt ? (srv() - v.playAt) / 1000 : 0)); else leftStr = '';
    const ctl = playing && v.phase !== 'final' && iAmIn(); $('.k3-joy').hidden = !ctl; $('.k3-zone').hidden = !ctl; const jb = $('.k3-jump'); jb.hidden = !ctl; const jl = v.mode === 'sumo' ? 'İt' : 'Zıpla'; if (jb.dataset.l !== jl) { jb.dataset.l = jl; jb.textContent = jl; } if (v.mode !== 'sumo') jb.classList.remove('cd');
    if (!playing || v.mode !== 'renk') { $('.k3-call').hidden = true; callKey = ''; }
    if (!playing || v.mode !== 'sakla') wrap.classList.remove('seen');
    const over = $('.k3-over');
    // Oyun seçici: oda sahibi değiştirir, diğerleri seçileni görür
    const game = `<button class="k3-mode"${v.host ? '' : ' disabled'}><span><small>Oyun</small><b>${v.pick ? esc(modeName(v.pick)) : 'Kupa · karışık üç tur'}</b></span>${v.host ? '<i>Değiştir</i>' : ''}</button>`;
    if (v.status === 'waiting') {
      over.hidden = false; over.className = 'k3-over side';
      over.innerHTML = `<div class="k3-card"><h2>Parti Kupası</h2>${game}<p>${esc(INFO[v.pick || 'kupa'])} Boş yerlere bot oturur.</p>
        <div class="k3-pl">${v.players.map((p, i) => `<span class="${i === v.me ? 'me' : ''}"><i style="background:${hex(COLORS[p.look?.color] || COLORS.gul)}"></i>${esc(i === v.me ? 'Sen' : p.name)}</span>`).join('')}</div>
        <small class="k3-cnt">${v.players.length}/${v.max} oyuncu${v.startAt ? ` · <b class="k3-auto"></b>` : ''}</small>
        <div class="k3-btns">${v.host ? '<button class="btn primary k3-start">Hemen başlat</button>' : '<span class="muted">Odayı açan başlatacak…</span>'}<button class="btn k3-ward">Gardırop</button><button class="btn k3-inv">${icon('userPlus')} Davet et</button></div></div>`;
    } else if (v.status === 'ended') {
      const res = v.result || {}; const o = res.order || []; const wins = res.winners || [res.winner]; const won = wins.includes(v.me); const w = v.players[res.winner]; const mine = v.players[v.me]?.place; const wn = esc((w?.name || '').replace(' (bot)', ''));
      const head = res.single ? (won ? 'Kazandın! 🏆' : wins.length > 1 ? (res.mode === 'futbol' && v.st?.teams ? `${TEAM[v.st.teams[wins[0]] || 0][1]} takım kazandı` : 'Oyun bitti') : `${wn} kazandı`) : won ? 'Kupa senin!' : `Kupayı ${wn} kazandı`;
      over.hidden = false; over.className = 'k3-over side';
      over.innerHTML = `<div class="k3-card"><h2 class="k3-win"><span class="k3-cup">🏆</span>${head}</h2>
        ${wins.length > 1 ? `<small class="k3-cnt">Kazananlar</small><div class="k3-pl">${wins.map((i) => `<span class="${i === v.me ? 'me' : ''}"><i style="background:${hex(COLORS[v.players[i]?.look?.color] || COLORS.gul)}"></i>${esc(nm(i))}</span>`).join('')}</div>`
    : `<div class="k3-rank">${o.slice(0, 3).map((i, k) => `<span class="${i === v.me ? 'me' : ''}"><b>${k + 1}.</b>${esc(nm(i))}</span>`).join('')}</div>${mine && mine > 3 ? `<small class="k3-cnt">Sen ${mine}. oldun</small>` : ''}`}
        ${game}
        <div class="k3-btns">${v.host ? '<button class="btn primary k3-start">Yeniden oyna</button>' : ''}<button class="btn k3-ward">Gardırop</button><button class="btn k3-x">Çık</button>${v.host ? '' : '<span class="muted">Odayı açan yeniden başlatabilir.</span>'}</div></div>`;
    } else over.hidden = true;
  }
  function openModes() { // oda sahibi: kupa ya da tek oyun
    const row = (k, name) => `<button data-mode="${k}" class="${(v.pick || '') === k ? 'on' : ''}"><b>${esc(name)}</b><small>${esc(INFO[k || 'kupa'])}</small></button>`;
    sheet('Oyun seç', `<div class="k3-ml">${row('', 'Kupa · karışık üç tur')}${(v.modes || []).map(([k, name]) => row(k, name)).join('')}</div>`, { onMount(sh, close) { sh.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-mode]'); if (!b) return; try { apply(await api(`/kupa/${id}/opts`, { body: { mode: b.dataset.mode } })); close(); } catch (er) { toast(er.message); }
    }); } });
  }
  function apply(nv) {
    off = Math.min(off, Date.now() - nv.now); const was = `${v.status}:${v.round}:${v.phase}`; v = nv; buildChars(); buildArena();
    if (v.status === 'playing' && v.phase === 'intro' && roundSeen !== v.round) { roundSeen = v.round; placeAll(); banner(v.rounds > 1 ? `${v.round}. tur · ${v.title}` : v.title, tip()); }
    if (v.status === 'playing' && v.phase === 'play' && roundSeen !== v.round) { roundSeen = v.round; placeAll(); } // oyuna sonradan bağlanan
    if (v.phase === 'result' && was !== `${v.status}:${v.round}:${v.phase}`) { const th = v.result?.through || []; const ok = th.includes(v.me); const fin = v.result?.last || th.length <= 1; // son turda tur atlanmaz, kazanılır
      sfx.play(ok ? (fin ? 'win' : 'good') : 'bad');
      banner(ok ? (fin ? 'Kazandın! 🏆' : 'Tur atladın! 🎉') : fin ? 'Oyun bitti' : 'Tur bitti', ok ? (fin ? '' : 'Sıradaki tura hazırlan.') : fin ? (th.length === 1 ? `${nm(th[0])} kazandı` : v.mode === 'futbol' && v.st?.teams ? `${TEAM[v.st.teams[th[0]] || 0][1]} takım kazandı.` : `${th.length} kişi kazandı.`) : `${th.length} kişi tur atladı.`); }
    if (v.status !== 'playing') { $('.k3-banner').hidden = true; $('.k3-feed').innerHTML = ''; roundSeen = 0; if (was.startsWith('playing')) { me.gone = false; me.dead = false; me.hideAt = 0; } } // roundSeen: yeni oyunun ilk turunda herkes yeniden yerleşsin
    hud();
  }
  async function openWardrobe() {
    let w; try { w = await api('/kupa/wardrobe'); } catch (e) { return toast(e.message); }
    const html = () => `<div class="k3-w"><p class="muted">Jetonun: <b>${w.coins}</b></p><h3>Lezzet</h3><div class="k3-wg">${w.colors.map(([k, n, p]) => `<button data-id="${k}" class="${w.color === k ? 'on' : ''}"><i style="background:${hex(COLORS[k])}"></i><b>${esc(n)}</b><small>${w.color === k ? 'Üzerinde' : !p || w.owned.includes(k) ? 'Giy' : `${p} jeton`}</small></button>`).join('')}</div>
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
    const raw = (nowMs - last) / 1000; const dt = Math.min(0.05, raw); last = nowMs;
    if (raw < 0.25 && nowMs - openedAt > 4000) { fAcc += raw; fN++; if (fAcc > 2) { const fps = fN / fAcc; fAcc = 0; fN = 0; // yavaş cihazda keskinlikten kıs, akıcılığı koru
      if (fps < 40 && pr > 1) { if (++slow >= 2) { slow = 0; pr = Math.max(1, pr - 0.25); renderer.setPixelRatio(pr); } } else slow = 0; } } const t = v.playAt ? (srv() - v.playAt) / 1000 : 0; const playing = v.status === 'playing'; const m = playing ? v.mode : null; const c = v.conf; const tt = Math.max(0, t);
    const W = wrap.clientWidth; const H = wrap.clientHeight; if (canvas.width !== Math.floor(W * renderer.getPixelRatio()) || canvas.height !== Math.floor(H * renderer.getPixelRatio())) { renderer.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix(); }
    const si = !playing && v.status === 'ended' && chars.has(v.result?.winner) && !v.result.winners?.includes(v.me) ? v.result.winner : v.me; // kaidede gösterilecek karakter
    if (nowMs - joinAt > 4000) { joinAt = nowMs; join(); } // soket odasına katılım kaçtıysa telafi et
    const mc = chars.get(si);
    if (playing && v.phase === 'intro') { const left = Math.ceil((v.playAt - srv()) / 1000); const b = $('.k3-banner'); if (left <= 3 && left > 0 && b.dataset.n !== String(left)) { b.dataset.n = String(left); banner(String(left), tip()); sfx.play('tick'); } }
    if (playing && v.phase === 'play' && $('.k3-banner').dataset.n) { delete $('.k3-banner').dataset.n; banner('Başla!', '', 700); sfx.play('go'); }
    if (playing && v.phase === 'play' && iAmIn()) { step(dt, t, nowMs); if (nowMs - sent > 100) { sent = nowMs; state.socket?.emit('k3:s', [+me.x.toFixed(2), +me.y.toFixed(2), +me.z.toFixed(2), +me.ry.toFixed(2), me.dfl > 0 ? 3 : me.ground ? 0 : 1]); } }
    else if (playing && me.dead && me.y > -12) { me.vy -= G * dt; me.x += me.vx * dt; me.y += me.vy * dt; me.z += me.vz * dt; } // elenince savrulma
    if (mc) {
      if (!playing) { mc.g.visible = true; mc.g.position.set(0, 0, 0); mc.g.rotation.y += dt * 0.7; animate(mc, dt, 0, false, false); chars.forEach((ch, i) => { if (i !== si) ch.g.visible = false; }); }
      else if (v.spawn?.[v.me] && !(me.gone && (me.y < -7 || (me.hideAt && nowMs > me.hideAt)))) { mc.g.position.set(me.x, me.y, me.z); mc.g.rotation.y = me.ry; mc.sh.visible = me.ground; animate(mc, dt, Math.hypot(me.vx, me.vz), !me.ground, me.stun > 0.3, me.dash > 0); mc.g.visible = me.y > -9; }
      else mc.g.visible = false;
    }
    if (playing) chars.forEach((ch, i) => { if (i === v.me) return; const p = ch.g.position; const k = Math.min(1, dt * 13); const sp = Math.hypot(ch.t[0] - p.x, ch.t[2] - p.z) / Math.max(dt, 0.001) * k;
      p.x += (ch.t[0] - p.x) * k; p.y += (ch.t[1] - p.y) * k; p.z += (ch.t[2] - p.z) * k; let d = ch.t[3] - ch.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); ch.g.rotation.y += d * k;
      if (ch.pfl === 1 && ch.fl !== 1 && ch.fl !== 2) ch.ld = 0.7; ch.pfl = ch.fl; // başkaları da inince basılır
      animate(ch, dt, Math.min(SPEED, sp), ch.fl === 1, ch.fl === 2, ch.fl === 3); ch.sh.visible = ch.fl !== 1 && ch.fl !== 2 && p.y > -0.3; if (!v.players[i].alive && nowMs - ch.seen > 900) ch.g.visible = false; });
    // Kuyruk ve takım halkası; kameraya çok yakın karakterin isim etiketi ekranı kaplamasın
    chars.forEach((ch, i) => { if (ch.g.visible) { const k = Math.max(0.42, Math.min(1, cam.position.distanceTo(ch.g.position) / 7.5)); ch.lbl.scale.set(2.3 * k, 0.575 * k, 1); } ch.tail.visible = m === 'kuyruk' && !!v.st?.tails?.includes(i); if (ch.tail.visible) ch.tail.rotation.z = Math.sin(nowMs / 110 + ch.ph) * 0.22; const tm = m === 'futbol' ? v.st?.teams?.[i] : null; ch.ring.visible = tm != null; if (tm != null) ch.ring.material.color.setHex(TEAM[tm][0]); });
    // Hareketli engeller
    if (playing && dyn.bars) dyn.bars.forEach((o, i) => { const b = c.bars[i]; o.visible = t >= b.from - 3; o.rotation.y = -barAngle(b, tt); o.position.y = t < b.from ? 0.45 + Math.max(0, b.from - t) * 0.5 : 0.45; });
    if (playing && dyn.sweeps) { dyn.sweeps.forEach((o, i) => { o.rotation.y = -TRACK.sweeps[i].w * tt; }); dyn.plats.forEach((o, i) => { const p = TRACK.plats[i]; o.position.x = p.amp * Math.sin(p.w * tt + p.ph); }); dyn.hams.forEach((o, i) => { const h = TRACK.hammers[i]; o.rotation.z = Math.sin(h.w * tt + h.ph); }); }
    if (playing && dyn.im && tiles.size) { const n = srv(); let ch = false; tiles.forEach((at, i) => { const tl = TL[i]; if (!tl || tl.gone) return; const left = at - n; const d = dyn.d; let y = -0.25; let s = 1;
      if (left > 0) { y += Math.sin(nowMs / 28 + i) * 0.035; dyn.im.setColorAt(i, new T.Color(0xff8a5c)); } else { const e = -left / 1000; y -= e * e * 14; if (e > 1.1) { s = 0.0001; tl.gone = true; } }
      d.position.set(tl.x, y, tl.z); d.scale.setScalar(s); d.updateMatrix(); dyn.im.setMatrixAt(i, d.matrix); ch = true; }); if (ch) { dyn.im.instanceMatrix.needsUpdate = true; if (dyn.im.instanceColor) dyn.im.instanceColor.needsUpdate = true; } }
    if (playing && dyn.bombs) dyn.bombs.forEach((o, k) => { const b = v.st?.bombs?.[k]; const ch = b && chars.get(b[0]); o.g.visible = !!ch && ch.g.visible; if (!o.g.visible) return; const left = (b[1] - srv()) / 1000; const on = Math.sin(nowMs / (left < 3 ? 40 : left < 7 ? 85 : 170)) > 0; // patlamaya yakın daha hızlı yanıp söner
      o.g.position.set(ch.g.position.x, ch.g.position.y + 2.4 + Math.sin(nowMs / 160) * 0.05, ch.g.position.z); o.g.scale.setScalar(on ? 1.16 : 1); o.mat.color.setHex(on && left < 7 ? 0xd32f2f : 0x2a1d3a); o.sp.scale.setScalar(on ? 0.13 : 0.08); });
    if (playing && dyn.sumo) { const R = sumoR(c, tt); dyn.sumo.scale.set(R, 1, R); }
    if (playing && dyn.rk) { const s = rkState(tt); const d = dyn.d; const key = String(s.k); if (rk.key !== key) { rk.key = key; s.lay.forEach((col, i) => dyn.rk.setColorAt(i, tmpC.setHex(PAL[col][0]))); dyn.rk.instanceColor.needsUpdate = true; }
      for (let i = 0; i < s.lay.length; i++) { const [x, z] = rkPos(i); const keep = s.lay[i] === s.col; let y = -0.25; let sc = 1;
        if (s.phase === 2 && !keep) { const e = tt - s.cy[2]; y -= e * e * 16; if (e > 0.9) sc = 0.0001; } else if (s.phase === 1 && !keep && s.cy[2] - tt < 1) y += Math.sin(nowMs / 26 + i) * 0.04; else if (tt - s.back < 0.35) y -= (1 - (tt - s.back) / 0.35) * 1.6;
        d.position.set(x, y, z); d.scale.setScalar(sc); d.updateMatrix(); dyn.rk.setMatrixAt(i, d.matrix); } dyn.rk.instanceMatrix.needsUpdate = true;
      const call = $('.k3-call'); const ck = v.phase === 'play' && s.phase ? `${s.k}:${s.phase}` : '';
      if (ck !== callKey) { callKey = ck; call.hidden = !ck; if (ck) { call.querySelector('i').style.background = hex(PAL[s.col][0]); call.querySelector('b').textContent = PAL[s.col][1]; call.classList.toggle('gone', s.phase === 2); } }
      if (ck && s.phase === 1) call.querySelector('s').style.transform = `scaleX(${Math.max(0, (s.cy[2] - tt) / (s.cy[2] - s.cy[1])).toFixed(3)})`; }
    if (playing && dyn.lava) { const y = Math.min(lavaY(c, tt), c.n * c.step - 0.9) + Math.sin(nowMs / 420) * 0.05; dyn.lava.position.y = y; dyn.glow.position.y = y + 0.04; dyn.glow.material.opacity = 0.32 + Math.sin(nowMs / 300) * 0.1; }
    if (playing && dyn.ball) { const b = dyn.bs; const fr = c.fr ** (dt * 20); const lx = c.hx - c.br; b.sx = Math.max(-lx, Math.min(lx, b.sx + b.svx * dt)); b.sz += b.svz * dt; b.svx *= fr; b.svz *= fr;
      if (nowMs < b.own) { b.x += b.vx * dt; b.z += b.vz * dt; b.vx *= fr; b.vz *= fr; if (Math.abs(b.x) > lx) { b.x = Math.sign(b.x) * lx; b.vx *= -c.wall; } if (Math.abs(b.z) > c.hz - c.br && Math.abs(b.x) >= c.goal - 0.2) { b.z = Math.sign(b.z) * (c.hz - c.br); b.vz *= -c.wall; } }
      else { const k = Math.min(1, dt * 12); b.x += (b.sx - b.x) * k; b.z += (b.sz - b.z) * k; b.vx = b.svx; b.vz = b.svz; }
      const o = dyn.ball; const dx = b.x - o.position.x; const dz = b.z - o.position.z; const dist = Math.hypot(dx, dz); if (dist > 1e-4 && dist < 3) o.rotateOnWorldAxis(tmpV.set(dz / dist, 0, -dx / dist), dist / c.br); // yuvarlanma
      o.position.x = b.x; o.position.z = b.z; dyn.bsh.position.x = b.x; dyn.bsh.position.z = b.z; }
    if (playing && dyn.ebes) { // ebeler ve görüş ışıkları
      const k = Math.min(1, dt * 12);
      dyn.ebes.forEach((e) => { e.x += (e.t[0] - e.x) * k; e.z += (e.t[1] - e.z) * k; let d = e.t[2] - e.ry; d = Math.atan2(Math.sin(d), Math.cos(d)); e.ry += d * k;
        const sp = Math.hypot(e.t[0] - e.x, e.t[1] - e.z) * 12; e.ch.g.position.set(e.x, 0, e.z); e.ch.g.rotation.y = e.ry; animate(e.ch, dt, Math.min(SPEED, sp), false, false);
        e.cone.visible = !!e.on && v.phase === 'play'; if (!e.cone.visible) return; const P = e.cone.geometry.attributes.position; P.setXYZ(0, e.x, 0.06, e.z);
        for (let i = 0; i <= e.N; i++) { const a = e.ry - c.half + (2 * c.half * i) / e.N; const sx = Math.sin(a); const sz = Math.cos(a); const d2 = rayWalls(e.x, e.z, sx, sz, c.range); P.setXYZ(i + 1, e.x + sx * d2, 0.06, e.z + sz * d2); }
        P.needsUpdate = true; });
      const seen = v.phase === 'play' && iAmIn() && seenByEbe(); if (seen !== wrap.classList.contains('seen')) { wrap.classList.toggle('seen', seen); if (seen) buzz(30); }
      if (v.phase === 'play' && !dyn.go && t >= c.wait) { dyn.go = true; if (iAmIn() && t < c.wait + 1.5) { banner('Ebe geliyor!', '', 1200); buzz(80); } }
    }
    if (fx.length) fx = fx.filter(({ m: o, t0, d = 450, a = 0.3, b = 3.2, op = 0.85 }) => { const e = (nowMs - t0) / d; if (e >= 1) { scene.remove(o); o.material.dispose(); return false; } o.scale.setScalar(a + e * b); o.material.opacity = op * (1 - e); return true; });
    // Kamera: f bakış yönü
    let tx = 0; let ty = 0; let tz = 0; let oy = 6.6; let oz = 8.2; let f = [0, -1];
    if (!playing) { oy = 1.5; oz = 5.4; ty = 0.9; tx = W > H ? 1.9 : 0; tz = W > H ? 0 : -0.2; }
    else if (iAmIn() || (m === 'kosu' && v.spawn?.[v.me])) { tx = me.x; ty = Math.max(-2, me.y); tz = me.z; f = look(me.x, me.z);
      if (m === 'kosu') { oy = 5.2; oz = 8.6; tz -= 3; tx *= 0.6; } else if (m === 'lav') { oy = 4.6; oz = 9.5; } else if (m === 'sakla') { oy = 13.5; oz = 7.5; } else if (m === 'futbol') { oy = 8.6; oz = 9; tx = me.x * 0.75 + dyn.bs.x * 0.25; tz = me.z * 0.75 + dyn.bs.z * 0.25; } }
    else { const lead = [...chars.entries()].find(([i, ch]) => v.players[i]?.alive && ch.g.visible);
      if (m === 'kosu' && lead) { tz = lead[1].g.position.z - 3; oy = 6; oz = 10; }
      else if (m === 'lav') { let best = null; chars.forEach((ch, i) => { if (i !== v.me && v.players[i]?.alive && ch.g.visible && (!best || ch.g.position.y > best.y)) best = ch.g.position; }); if (best) { tx = best.x; ty = best.y; tz = best.z; f = look(best.x, best.z); oy = 6; oz = 13; } else { ty = Math.max(0, me.y); f = look(me.x, me.z); oy = 7; oz = 14; } }
      else if (m === 'futbol') { f = look(0, 0); tx = dyn.bs.x * 0.5; tz = dyn.bs.z * 0.6; oy = 13; oz = 11; }
      else if (m === 'sakla') { oy = 27; oz = 15; }
      else { oy = c?.r > 11 || c?.r0 > 10 || c?.rings > 6 ? 21 : 15; oz = oy; } }
    const ck = Math.min(1, dt * 6); cam.position.x += (tx - f[0] * oz - cam.position.x) * ck; cam.position.y += (ty + oy - cam.position.y) * ck; cam.position.z += (tz - f[1] * oz - cam.position.z) * ck;
    cl.x += (tx - cl.x) * ck; cl.y += (ty + 0.8 - cl.y) * ck; cl.z += (tz - cl.z) * ck; cam.lookAt(cl.x, cl.y, cl.z);
    if (playing && nowMs - hudAt > 250) { hudAt = nowMs; setLeft(leftText(t)); if (m === 'sumo') $('.k3-jump').classList.toggle('cd', t < me.dcd - 0.05); }
    if (v.status === 'waiting' && v.startAt) { const el = $('.k3-auto'); if (el) el.textContent = `${Math.max(0, Math.ceil((v.startAt - srv()) / 1000))} sn sonra başlıyor`; }
    // Fizik motoru: oyuncular ve hareketli engeller kinematik gövde olarak nesneleri iter
    if (phys && propsKey !== arenaKey) { propsKey = arenaKey; buildProps(); }
    if (phys && playing && phys.count) {
      chars.forEach((ch, i) => { const q = ch.g.position; phys.player(i, q.x, q.y, q.z, dt, ch.g.visible && q.y > -3, i === v.me); });
      if (dyn.ebes) dyn.ebes.forEach((e, k) => phys.player(100 + k, e.x, 0, e.z, dt, true, false));
      if (dyn.bars) dyn.bars.forEach((o, i) => { if (o.visible && o.position.y < 0.6) phys.moveTo(`bar${i}`, 0, o.position.y, 0, dt, o.rotation.y); else phys.park(`bar${i}`); });
      if (dyn.sweeps) { dyn.sweeps.forEach((o, i) => phys.moveTo(`sw${i}`, 0, 0.45, o.position.z, dt, o.rotation.y)); dyn.plats.forEach((o, i) => phys.moveTo(`pl${i}`, o.position.x, -0.3, o.position.z, dt)); dyn.hams.forEach((o, i) => phys.moveTo(`hm${i}`, 5.2 * Math.sin(o.rotation.z), 6 - 5.2 * Math.cos(o.rotation.z), o.position.z, dt)); }
      phys.step(dt, nowMs);
    }
    world.update(nowMs, dt, cam);
    let sx = 0; let sy = 0; if (shake > 0.004) { sx = (Math.random() - 0.5) * shake; sy = (Math.random() - 0.5) * shake * 0.7; shake *= Math.exp(-dt * 9); cam.position.x += sx; cam.position.y += sy; } // sarsıntı yalnızca çizimde
    renderer.render(scene, cam);
    cam.position.x -= sx; cam.position.y -= sy;
  }

  // ---- Girdi ----
  const joy = $('.k3-joy'); const zone = $('.k3-zone'); let jid = null; let jo = null;
  const jmove = (e) => { if (e.pointerId !== jid) return; const p = toLocal(e.clientX, e.clientY); let dx = p.x - jo.x; let dy = p.y - jo.y; const l = Math.hypot(dx, dy); const mx = 46; if (l > mx) { dx *= mx / l; dy *= mx / l; } inp.x = dx / mx; inp.z = dy / mx; joy.firstElementChild.style.transform = `translate(${dx}px, ${dy}px)`; };
  const jend = (e) => { if (e.pointerId !== jid) return; jid = null; inp.x = 0; inp.z = 0; joy.firstElementChild.style.transform = ''; joy.style.left = ''; joy.style.top = ''; joy.style.bottom = ''; };
  zone.addEventListener('pointerdown', (e) => { if (jid !== null) return; jid = e.pointerId; zone.setPointerCapture?.(jid); jo = toLocal(e.clientX, e.clientY); const b = wrap.getBoundingClientRect(); const o = toLocal(b.left, b.top); const o2 = toLocal(b.right, b.bottom); // joystick parmağın altında belirir
    joy.style.left = `${jo.x - Math.min(o.x, o2.x) - 66}px`; joy.style.top = `${jo.y - Math.min(o.y, o2.y) - 66}px`; joy.style.bottom = 'auto'; jmove(e); });
  zone.addEventListener('pointermove', jmove); zone.addEventListener('pointerup', jend); zone.addEventListener('pointercancel', jend); zone.addEventListener('lostpointercapture', jend);
  $('.k3-jump').addEventListener('pointerdown', (e) => { e.preventDefault(); inp.jump = true; });
  const kd = (e) => { if (e.target.closest?.('input, textarea')) return; keys.add(e.key.toLowerCase()); if (e.key === ' ') { e.preventDefault(); if (!e.repeat) inp.jump = true; } }; const ku = (e) => { keys.delete(e.key.toLowerCase()); if (!keys.size) { inp.x = 0; inp.z = 0; } };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
  wrap.addEventListener('click', async (e) => {
    if (e.target.closest('.k3-x')) { if (v.status === 'playing' && !(await ask('Oyundan çık', 'Çıkarsan bu kupadan elenirsin. Emin misin?', 'Çık', { danger: true }))) return; await api(`/kupa/${id}/leave`, { body: {} }).catch(() => {}); leaveTo('#/oyunlar'); return; }
    if (e.target.closest('.k3-start')) { try { apply(await api(`/kupa/${id}/start`, { body: {} })); } catch (er) { toast(er.message); } return; }
    if (e.target.closest('.k3-ward')) return openWardrobe();
    if (e.target.closest('.k3-mode')) { if (v.host) openModes(); return; }
    if (e.target.closest('.k3-inv')) pickPerson('Parti Kupası’na çağır', async (u) => { if (!u) return; try { await api(`/kupa/${id}/invite`, { body: { userId: u.id } }); toast(`${u.username} çağrıldı.`); } catch (er) { toast(er.message); } });
  });
  const join = () => state.socket?.emit('k3:join', { id });
  // Sunucu olayları: eleme, kuyruk / bomba el değiştirmesi, gol, zirve
  const said = new Map(); // aynı eleme için iki satır yazma ("bulundu" + "elendi")
  function onEv(ev) {
    const st = v.st; const p = v.players[ev.i]; const ch = chars.get(ev.i);
    if (ev.t === 'out' && p) { p.alive = false; p.out = true; if (ch) ch.seen = performance.now(); if (ev.i !== v.me) { if (performance.now() - (said.get(ev.i) || 0) > 700) { feed(`${nm(ev.i)} elendi`); sfx.play('pop', 0.6, 200); } } else if (!me.gone) { me.gone = true; banner('Elendin', after(), 2600); } hud(); }
    else if (ev.t === 'tail' && st) { const old = st.tails || []; st.tails = ev.tails; const got = ev.tails.find((i) => !old.includes(i)); const lost = old.find((i) => !ev.tails.includes(i));
      if (got === v.me) { banner('Kuyruk sende!', 'Süre bitene kadar kaçır.', 1500); feel(0, 60, 'good'); } else if (lost === v.me) { banner('Kuyruğun kapıldı!', 'Birine dokunup geri al.', 1500); feel(0.15, [50, 40, 50], 'bad'); } else if (got != null) feed(`${nm(got)} kuyruk kaptı`); }
    else if (ev.t === 'bomb' && st) { const had = hasBomb(v.me); st.bombs = ev.b; if (hasBomb(v.me) && !had) { banner('Bomba sende!', 'Birine dokunup devret.', 1500); feel(0.12, [60, 40, 60], 'warn'); } else if (had && !hasBomb(v.me) && v.players[v.me]?.alive) banner('Kurtuldun!', '', 800); }
    else if (ev.t === 'boom') { const q = ev.i === v.me ? me : ch?.g.position; if (q) { boom(q.x, q.y, q.z); phys?.blast(q.x, q.y, q.z, 10, 8); const far = Math.hypot(q.x - me.x, q.z - me.z); feel(Math.max(0.12, 0.6 - far * 0.05), far < 5 ? 60 : 0, 'boom', Math.max(0.4, 1.2 - far * 0.07)); } if (ev.i === v.me) die('Bomba elinde patladı!', (Math.random() - 0.5) * 6, 9, (Math.random() - 0.5) * 6, false); else if (p) { said.set(ev.i, performance.now()); feed(`${nm(ev.i)} patladı 💥`); } }
    else if (ev.t === 'goal' && st) { st.score = ev.s; if (dyn.bs) Object.assign(dyn.bs, { x: 0, z: 0, vx: 0, vz: 0, sx: 0, sz: 0, svx: 0, svz: 0, own: 0, fr: performance.now() + 2200 });
      const s = v.spawn?.[v.me]; if (s && iAmIn()) Object.assign(me, { x: s[0], z: s[2], vx: 0, vz: 0 }); banner(ev.team === myTeam() ? 'Gol! 🎉' : 'Gol yedik!', `${TEAM[0][1]} ${ev.s[0]} – ${ev.s[1]} ${TEAM[1][1]}`, 1700); feel(0.25, 80, 'whistle'); }
    else if (ev.t === 'ot' && st) { st.ot = 1; banner('Uzatma!', 'İlk gol kazandırır. Gol olmazsa top kimin sahasındaysa o takım kaybeder.', 3200); }
    else if (ev.t === 'top') { tops.add(ev.i); if (ev.i !== v.me) feed(`${nm(ev.i)} zirvede`); else sfx.play('good'); }
    else if (ev.t === 'catch') { const q = ev.i === v.me ? me : ch?.g.position; if (q) boom(q.x, q.y, q.z); if (ev.i === v.me) { die('Ebe seni buldu!', 0, 0, 0, false); me.dead = false; me.hideAt = performance.now() + 900; wrap.classList.remove('seen'); } else if (p) { said.set(ev.i, performance.now()); feed(`${nm(ev.i)} bulundu`); } }
  }
  const offs = [on('k3', (nv) => { if (nv.id === id) apply(nv); }),
    on('k3:snap', ([sn, list, bl, es]) => { off = Math.min(off, Date.now() - sn); const n = performance.now();
      list.forEach(([i, x, y, z, ry, fl]) => { const ch = chars.get(i); if (!ch || i === v.me) return; const d = ch.seen > n ? 0.1 : Math.min(0.3, Math.max(0.05, (n - ch.seen) / 1000)); ch.v = [(x - ch.t[0]) / d, (z - ch.t[2]) / d]; ch.t = [x, y, z, ry]; ch.fl = fl; ch.seen = n; ch.g.visible = true; });
      if (bl && dyn.bs) Object.assign(dyn.bs, { sx: bl[0], sz: bl[1], svx: bl[2], svz: bl[3] });
      if (es && dyn.ebes) es.forEach((e, k) => { const o = dyn.ebes[k]; if (o) { o.t = [e[0], e[1], e[2]]; o.on = e[3]; } }); }),
    on('k3:tile', ([i, at]) => { tiles.set(i, at); }),
    on('k3:ev', onEv),
    on('reconnected', () => { join(); api(`/kupa/${id}`).then(apply).catch((e) => { if (/bulunamadı/i.test(e?.message || '')) { toast('Oyun sona erdi.'); leaveTo('#/oyunlar'); } }); })];
  join(); buildChars(); buildArena(); if (v.status === 'playing') { roundSeen = v.round; placeAll(); } hud(); cam.position.set(0, 9, 12); raf = requestAnimationFrame(frame);
  return () => { closed = true; cancelAnimationFrame(raf); offs.forEach((f) => f()); clearTimeout(banT); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); state.socket?.emit('k3:leave', { id }); wardrobe = null; world.dispose(); phys?.dispose(); sfx.close(); wrap.removeEventListener('pointerdown', wake); window.removeEventListener('keydown', wake); renderer.dispose(); offLand(); };
}

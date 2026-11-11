// Parti Kupası (3D): üç turlu elemeli parti oyunu. Her kupada on moddan üç tur çekilir; oda sahibi tek bir oyunu da seçebilir.
// Oyuncu kendi karakterini cihazında hareket ettirir (konumunu soketle yollar); turlar, engellerin zamanı,
// elenmeler ve botlar sunucudadır. Engeller sunucu saatine göre hesaplandığından herkes aynı şeyi görür.
const { nanoid } = require('nanoid');

const MAXP = 8; const TICK = 100; const INTRO_MS = 5500; const RESULT_MS = 4500; const WAIT_MS = 12000;
// Her kupada üç tur çekilir: kalabalık tur → orta tur → final
// Futbol yalnızca ikinci turda: ilk turdan 8 kişilik kupada 6, 16 kişilik kupada 8 kişi çıkar (3'e 3 ya da 4'e 4).
const POOL = [['cubuk', 'kuyruk', 'renk', 'bomba', 'sakla', 'sakla', 'doner', 'doner'], ['zemin', 'sumo', 'lav', 'renk', 'bomba', 'kuyruk', 'sakla', 'futbol', 'futbol', 'doner', 'bayrak', 'bayrak'], ['kosu', 'sumo', 'lav', 'zemin', 'doner']];
const TITLES = { cubuk: 'Dönen Çubuk', zemin: 'Zemin Çöküyor', kosu: 'Engelli Koşu', kuyruk: 'Kuyruk Kapmaca', sumo: 'Sumo', doner: 'Döner Tabla', bayrak: 'Bayrak Kapmaca', renk: 'Renk Zemini', lav: 'Lav Yükseliyor', futbol: 'Dev Top Futbolu', bomba: 'Bomba Elden Ele', sakla: 'Saklambaç' };
const CAP = { cubuk: 75000, zemin: 60000, kosu: 100000, kuyruk: 45000, sumo: 90000, doner: 80000, bayrak: 120000, renk: 120000, lav: 85000, futbol: 75000, bomba: 150000, sakla: 60000 };
const MODES = Object.entries(TITLES); // [anahtar, ad]: istemcideki oyun seçici için
if (process.env.KUPA_CAPS) { try { Object.assign(CAP, JSON.parse(process.env.KUPA_CAPS)); } catch { /* yerel deneme için tur süresi */ } }
const G = 22; const JUMP = 8.5; // istemciyle aynı fizik sabitleri
const ARENA_R = 9; const TILE_MS = 1700; const RINGS = 6; const HEX = 1.15; const TRACK = 116; // zemin: 127 karo, basılan karo 1,7 sn sonra çöker
// Çubuklar: t = tur başından beri saniye. İlk 1.5 sn bekler, sonra hızlanır.
const BARS = [{ from: 1.5, w0: 0.9, acc: 0.04, wmax: 3.2, dir: 1, phase: 0.39 }, { from: 22, w0: 0.8, acc: 0.035, wmax: 2.6, dir: -1, phase: 1.96 }];
const barW = (b, t) => (t < b.from ? 0 : Math.min(b.wmax, b.w0 + b.acc * (t - b.from)));
function barAngle(b, t) {
  const s = t - b.from; if (s <= 0) return b.phase;
  const tc = (b.wmax - b.w0) / b.acc;
  const a = s < tc ? b.w0 * s + 0.5 * b.acc * s * s : b.w0 * tc + 0.5 * b.acc * tc * tc + b.wmax * (s - tc);
  return b.phase + b.dir * a;
}
// Koşudaki engel bölgeleri (bot takılmaları için) ve dönüş noktaları
const KOSU_OBS = [16, 24, 32, 44, 50, 56, 68, 76, 88, 98]; const KOSU_CP = [0, 60, 82];

// Kuyruk / bomba: çitli yuvarlak alan. Sumo: daralan platform. Renk: 7×7 renkli karo. Lav: sarmal basamaklar. Futbol: duvarlı saha.
// Kalabalık turlarda (10'dan fazla oyuncu) alanlar büyür: ölçüler odada tutulur (r.R, r.sumo, r.fut).
const TAG_R = 10; const SUMO = { r0: 9, r1: 1.4, rate: 0.11, from: 4 };
// Bayrak Kapmaca: iki takım, iki üs. Rakip bayrağı kendi üssüne getiren puan alır; taşıyana dokunan bayrağı düşürür.
const BAY = { hx: 9, hz: 16, base: 12.5, br: 2.4, grab: 1.15, tag: 1.0, win: 3, back: 12000, safe: 900 }; // taşıyana yalnızca rakip kendi yarı sahasında dokunabilir
const TEAMS = new Set(['futbol', 'bayrak']);
// Döner Tabla: hızlanan ve yön değiştiren tabla oyuncuları taşır ve dışarı savurur (istemciyle birebir aynı hesap)
const DON = { r: 9, hub: 1.6, w0: 0.55, acc: 0.045, flip: 9, ramp: 1.2, k: 0.34 };
const donW = (c, t) => { if (t <= 0) return 0; const n = Math.floor(t / c.flip); return (n % 2 ? -1 : 1) * (c.w0 + c.acc * t) * Math.min(1, (t - n * c.flip) / c.ramp); };
const sumoR = (s, t) => Math.max(s.r1, s.r0 - s.rate * Math.max(0, t - s.from));
const RENK = { n: 7, size: 2.4, cols: 5 };
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// İstemciyle birebir aynı: tohum + tur numarasından karo renkleri (hedef renkten en az 6 karo)
function renkLayout(seed, k, col) { const rn = mulberry(seed + k * 977); const a = Array.from({ length: RENK.n * RENK.n }, () => Math.floor(rn() * RENK.cols)); for (let i = 0; a.filter((x) => x === col).length < 6 && i < 40; i++) a[Math.floor(rn() * a.length)] = col; return a; }
const renkTile = (x, z) => { const h = (RENK.n * RENK.size) / 2; const c = Math.floor((x + h) / RENK.size); const w = Math.floor((z + h) / RENK.size); return c < 0 || w < 0 || c >= RENK.n || w >= RENK.n ? -1 : w * RENK.n + c; };
// Basamak aralığı (yay boyunca 5,2 m) koşarak zıplamaya göre: basamağın ortasından kenarına kadar her yerden zıplayan karşıya iner.
// Bir turda 6,5 basamak var: iki basamağın arasına düşen, bir alt turdaki basamağın üstüne iner (lava kadar düşmez).
// da eksi: kamera kuleye bakarken tırmanış sağa doğru
const LAV = { n: 30, rad: 5.4, step: 1.2, da: -(Math.PI * 2) / 6.5, pad: 2.2, top: 2.6, base: 8, col: 3.6, t0: 12, v0: 0.4, acc: 0.008, vmax: 0.7 }; // lav zirveye ~70 sn'de varır
const lavaY = (t) => { const q = Math.max(0, t - LAV.t0); const tc = (LAV.vmax - LAV.v0) / LAV.acc; return -1.5 + (q < tc ? LAV.v0 * q + 0.5 * LAV.acc * q * q : LAV.v0 * tc + 0.5 * LAV.acc * tc * tc + LAV.vmax * (q - tc)); };
const padAt = (i) => ({ x: Math.cos(i * LAV.da) * LAV.rad, z: Math.sin(i * LAV.da) * LAV.rad, y: i * LAV.step });
const FUT = { hx: 7.5, hz: 12, goal: 3.4, br: 1.15, k: 1.1, c: 0.1, vmax: 11, fr: 0.975, wall: 0.5 }; // k, c: vuruş katsayıları (istemci de aynısını kullanır)

// Saklambaç: duvarlı bahçe. Ebe sunucudadır; görüş konisine giren ve arada engel olmayan oyuncuyu bulur.
// range / half: koninin boyu ve yarım açısı, spot: görüşte kalınca bulunma süresi (sn), wait: ebenin sayma süresi
const SAK = { h: 15, len: CAP.sakla / 1000, wait: 6, range: 7.5, half: 0.56, spot: 0.7 };
const SAK_WALLS = (() => { // [x, z, genişlik, derinlik, tür: 0 duvar, 1 sandık, 2 çalı]; bir çeyrek dört yana yansıtılır
  const q = [[4.5, 5.5, 3, 1, 0], [5.5, 4, 1, 2, 0], [11.4, 3.2, 2, 2, 1], [9.5, 10.5, 5, 1, 0], [2.5, 11, 1, 3, 0], [12, 7.2, 2, 1.4, 2]];
  const out = [[0, 9, 4, 1, 2], [0, -9, 4, 1, 2], [9, 0, 1, 3.4, 2], [-9, 0, 1, 3.4, 2]];
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) for (const [x, z, w, d, k] of q) out.push([x * sx, z * sz, w, d, k]);
  return out;
})();
function segHits(ax, az, bx, bz, pad = 0) { // doğru parçası bir engeli kesiyor mu? (pad: engeli şişirme payı)
  const dx = bx - ax; const dz = bz - az;
  for (const [x, z, w, d] of SAK_WALLS) {
    const x0 = x - w / 2 - pad; const x1 = x + w / 2 + pad; const z0 = z - d / 2 - pad; const z1 = z + d / 2 + pad; let t0 = 0; let t1 = 1;
    if (Math.abs(dx) < 1e-9) { if (ax < x0 || ax > x1) continue; } else { let a = (x0 - ax) / dx; let b = (x1 - ax) / dx; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) continue; }
    if (Math.abs(dz) < 1e-9) { if (az < z0 || az > z1) continue; } else { let a = (z0 - az) / dz; let b = (z1 - az) / dz; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) continue; }
    return true;
  }
  return false;
}
const SG = (() => { // yol bulma ızgarası (0,75 m hücre) ve saklanma noktaları (bir engelin hemen dibindeki boş hücreler)
  const cs = 0.75; const n = Math.round((SAK.h * 2) / cs); const blocked = new Uint8Array(n * n); const pad = 0.6;
  const pos = (i) => [-SAK.h + ((i % n) + 0.5) * cs, -SAK.h + (Math.floor(i / n) + 0.5) * cs];
  for (let i = 0; i < n * n; i++) { const [x, z] = pos(i); if (Math.abs(x) > SAK.h - 0.6 || Math.abs(z) > SAK.h - 0.6 || SAK_WALLS.some(([bx, bz, w, d]) => Math.abs(x - bx) < w / 2 + pad && Math.abs(z - bz) < d / 2 + pad)) blocked[i] = 1; }
  const cell = (x, z) => Math.max(0, Math.min(n - 1, Math.floor((z + SAK.h) / cs))) * n + Math.max(0, Math.min(n - 1, Math.floor((x + SAK.h) / cs)));
  const free = []; for (let i = 0; i < n * n; i++) if (!blocked[i]) free.push(i);
  const cover = free.map(pos).filter(([x, z]) => SAK_WALLS.some(([bx, bz, w, d]) => Math.abs(x - bx) < w / 2 + 1.3 && Math.abs(z - bz) < d / 2 + 1.3));
  return { cs, n, blocked, pos, cell, free, cover };
})();
const DIR8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
function nearFree(i) { // engelin içine düşen nokta için en yakın boş hücre
  if (!SG.blocked[i]) return i; const [x, z] = SG.pos(i); let best = i; let bd = 1e9;
  for (const j of SG.free) { const [a, b] = SG.pos(j); const d = (a - x) ** 2 + (b - z) ** 2; if (d < bd) { bd = d; best = j; } }
  return best;
}
function route(ax, az, bx, bz) { // ızgarada en kısa yol; sonra düz gidilebilen ara noktalar atlanır
  const n = SG.n; const s = nearFree(SG.cell(ax, az)); const g = nearFree(SG.cell(bx, bz)); if (s === g) return [[bx, bz]];
  const prev = new Int32Array(n * n).fill(-1); prev[s] = s; const q = [s]; let found = false;
  for (let h = 0; h < q.length && !found; h++) {
    const c = q[h]; const cx = c % n; const cz = (c - cx) / n;
    for (const [dx, dz] of DIR8) {
      const x = cx + dx; const z = cz + dz; if (x < 0 || z < 0 || x >= n || z >= n) continue; const j = z * n + x; if (prev[j] >= 0 || SG.blocked[j]) continue;
      if (dx && dz && (SG.blocked[cz * n + x] || SG.blocked[z * n + cx])) continue; // köşeden kesme
      prev[j] = c; if (j === g) { found = true; break; } q.push(j);
    }
  }
  if (!found) return [[bx, bz]];
  const pts = []; for (let c = g; c !== s; c = prev[c]) pts.push(SG.pos(c)); pts.reverse(); if (!SG.blocked[SG.cell(bx, bz)]) pts[pts.length - 1] = [bx, bz];
  const out = []; let fx = ax; let fz = az; let i = 0;
  while (i < pts.length) { let j = pts.length - 1; while (j > i && segHits(fx, fz, pts[j][0], pts[j][1], 0.55)) j--; out.push(pts[j]); fx = pts[j][0]; fz = pts[j][1]; i = j + 1; }
  return out;
}
const sees = (e, x, z) => { // ebe bu noktayı görüyor mu? (1,1 m içinde yön fark etmez: dokunmuş sayılır)
  const dx = x - e.x; const dz = z - e.z; const d = Math.hypot(dx, dz); if (d > SAK.range) return false;
  if (d > 1.1) { let a = Math.atan2(dx, dz) - e.ry; a = Math.atan2(Math.sin(a), Math.cos(a)); if (Math.abs(a) > SAK.half) return false; }
  return !segHits(e.x, e.z, x, z);
};
function unstick(p) { // engelin içine kayan botu dışarı it, bahçenin içinde tut
  for (const [x, z, w, d] of SAK_WALLS) { const hx = w / 2 + 0.45; const hz = d / 2 + 0.45; const dx = p.x - x; const dz = p.z - z; if (Math.abs(dx) >= hx || Math.abs(dz) >= hz) continue; if (hx - Math.abs(dx) < hz - Math.abs(dz)) p.x = x + Math.sign(dx || 1) * hx; else p.z = z + Math.sign(dz || 1) * hz; }
  const L = SAK.h - 0.5; p.x = Math.max(-L, Math.min(L, p.x)); p.z = Math.max(-L, Math.min(L, p.z));
}

// Altıgen zemin: eksenel koordinatlar → dünya konumu
function hexMap(R) { // R halkalı altıgen zemin: karolar ve komşuları
  const tiles = []; const at = new Map();
  for (let q = -R; q <= R; q++) for (let r = Math.max(-R, -q - R); r <= Math.min(R, -q + R); r++) { at.set(`${q},${r}`, tiles.length); tiles.push({ q, r, x: HEX * Math.sqrt(3) * (q + r / 2), z: HEX * 1.5 * r }); }
  const nb = tiles.map((t) => [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]].map(([dq, dr]) => at.get(`${t.q + dq},${t.r + dr}`)).filter((i) => i !== undefined));
  return { rings: R, tiles, nb };
}
const HM = { small: hexMap(RINGS), big: hexMap(RINGS + 2) }; // kalabalık turda (10'dan fazla oyuncu) zemin büyür: 127 → 217 karo

// Kostümler: lokumun lezzeti (renk) ve şapkası. Fiyat jeton; 0 = ücretsiz.
const LOOKS = {
  colors: [['gul', 'Gül', 0], ['limon', 'Limon', 0], ['fistik', 'Fıstık', 0], ['portakal', 'Portakal', 0], ['nar', 'Nar', 10], ['nane', 'Nane', 10], ['bogurtlen', 'Böğürtlen', 15], ['lavanta', 'Lavanta', 10], ['deniz', 'Deniz', 15], ['cikolata', 'Çikolata', 15], ['gece', 'Gece', 22], ['altin', 'Altın', 38]],
  hats: [['yok', 'Şapkasız', 0], ['parti', 'Parti şapkası', 12], ['cicek', 'Papatya', 15], ['sef', 'Aşçı kepi', 18], ['fes', 'Fes', 20], ['kulaklik', 'Kulaklık', 20], ['kovboy', 'Kovboy şapkası', 25], ['pervane', 'Pervaneli şapka', 28], ['tac', 'Taç', 30], ['hale', 'Hale', 45]],
  trails: [['izsiz', 'İzsiz', 0], ['yildiz', 'Yıldız tozu', 22], ['kalp', 'Kalpler', 22], ['ates', 'Ateş', 35], ['gokkusagi', 'Gökkuşağı', 50]], // koşarken arkada kalan iz
};
const PRICE = new Map([...LOOKS.colors, ...LOOKS.hats, ...LOOKS.trails].map(([id, , p]) => [id, p]));
const BOT_NAMES = ['Tarçın', 'Vişne', 'Sakız', 'Badem', 'Kaymak', 'Safran', 'Susam', 'Fındık', 'Ceviz', 'Damla', 'Helva', 'Pekmez', 'Kestane', 'Zencefil', 'Karanfil', 'Anason', 'Kakule', 'Sumak'];
const rnd = (a, b) => a + Math.random() * (b - a); const pick = (a) => a[Math.floor(Math.random() * a.length)];
const r2 = (n) => Math.round(n * 100) / 100;

module.exports = function kupa(app, ctx) {
  const { store, auth, io, notify, limited, eco, isBlocked } = ctx;
  const rooms = new Map(); const now = () => Date.now();
  const firstName = (u) => String(u.name || u.username || 'Oyuncu').split(' ')[0].slice(0, 14);
  const lookOf = (uid) => { const w = store.get('kupa_looks', uid); return { color: w?.color || 'gul', hat: w?.hat || 'yok', trail: w?.trail || 'izsiz' }; };
  const humans = (r) => r.players.filter((p) => !p.bot);
  const alive = (r) => r.players.filter((p) => p.alive);
  const idx = (r, uid) => r.players.findIndex((p) => p.uid === uid);
  const roomOfUser = (uid) => [...rooms.values()].find((r) => r.status !== 'ended' && r.players.some((p) => p.uid === uid));

  function view(r, uid) {
    const mine = r.players.find((p) => p.uid === uid);
    return {
      id: r.id, status: r.status, host: r.host === uid, pub: r.pub, me: idx(r, uid), max: MAXP, now: now(), startAt: r.startAt || null,
      players: r.players.map((p) => ({ id: p.uid || null, name: p.name, avatar: p.avatar, bot: !!p.bot, look: p.look, alive: p.alive, out: p.out, place: p.place || null, voice: !!p.voice })),
      round: r.round, rounds: r.plan?.length || 3, pick: r.pick || null, modes: MODES, mode: r.mode || null, title: r.mode ? TITLES[r.mode] : null, phase: r.phase || null, playAt: r.playAt || null, keep: r.keep || null,
      conf: confOf(r), st: r.st || null,
      spawn: r.spawn || null, result: r.result || null, at: mine && r.status === 'playing' && r.phase === 'play' && mine.alive ? [r2(mine.x), r2(mine.y), r2(mine.z)] : null,
    };
  }
  const confOf = (r) => {
    const m = r.mode;
    return m === 'cubuk' ? { r: r.R, bars: BARS } : m === 'zemin' ? { rings: r.hm.rings, hex: HEX, ms: r.tileMs || TILE_MS, tiles: Object.fromEntries(r.tiles || []) } : m === 'kosu' ? { len: TRACK }
      : m === 'kuyruk' || m === 'bomba' ? { r: r.R, len: CAP[m] / 1000 } : m === 'sumo' ? r.sumo : m === 'doner' ? DON : m === 'bayrak' ? { ...BAY, len: CAP.bayrak / 1000 } : m === 'renk' ? { ...RENK, seed: r.rk.seed, cyc: r.rk.cyc } : m === 'lav' ? LAV : m === 'futbol' ? { ...r.fut, len: CAP.futbol / 1000 }
      : m === 'sakla' ? { ...SAK, walls: SAK_WALLS, ebes: (r.ebes || []).map((e) => [r2(e.x), r2(e.z), r2(e.ry)]) } : null;
  };
  const push = (r) => r.players.forEach((p) => { if (p.uid) ctx.emitTo(p.uid, 'k3', view(r, p.uid)); });
  const cast = (r, ev, data) => io.to(`k3:${r.id}`).emit(ev, data);
  const lobby = () => io.to('play:lobby').emit('play:lobby', {});
  const clear = (r) => { clearTimeout(r.tm); clearInterval(r.iv); r.tm = null; r.iv = null; };
  // Zamanlayıcıdaki bir hata sunucuyu düşürmesin: oyunu kapat, odayı sağlam bırak
  const safe = (r, fn) => { try { fn(); } catch (e) { console.error('[kupa] hata', r.id, r.mode, e); try { clear(r); if (r.status === 'playing') finish(r, alive(r)[0] || r.players[0]); } catch { rooms.delete(r.id); } } };

  function addHuman(r, u) { r.players.push({ uid: u.id, name: firstName(u), avatar: u.avatar, look: lookOf(u.id), alive: true, out: false, x: 0, y: 0, z: 0, ry: 0, fl: 0 }); }
  function create(u, pub, pick) {
    const r = { id: nanoid(8), host: u.id, pub, pick: TITLES[pick] ? pick : null, status: 'waiting', players: [], round: 0, at: now() };
    addHuman(r, u); rooms.set(r.id, r);
    if (pub) { r.startAt = now() + WAIT_MS; r.tm = setTimeout(() => safe(r, () => start(r)), WAIT_MS); }
    return r;
  }

  // ---- Tur motoru ----
  function start(r) {
    if (r.status === 'playing' || !humans(r).length) return;
    clear(r); r.startAt = null;
    const used = new Set(r.players.map((p) => p.name));
    const hn = humans(r).length; const fill = r.pick === 'futbol' ? Math.max(6, hn + (hn % 2)) : MAXP; // tek oyun futbolda maç 3'e 3 kurulur (insan çoksa hepsi oynar)
    while (r.players.length < fill) {
      const n = BOT_NAMES.find((x) => !used.has(`${x} (bot)`)) || `Bot ${r.players.length}`; used.add(`${n} (bot)`);
      r.players.push({ bot: true, uid: null, name: `${n} (bot)`, avatar: '/img/eg/odul.svg', look: { color: pick(LOOKS.colors)[0], hat: Math.random() < 0.4 ? pick(LOOKS.hats)[0] : 'yok' } });
    }
    r.players.forEach((p) => { Object.assign(p, { alive: true, out: false, place: null, x: 0, y: 0, z: 0, ry: 0, fl: 0 }); if (p.uid) p.look = lookOf(p.uid); });
    r.status = 'playing'; r.round = 0; r.n0 = r.players.length; r.result = null; r.single = !!r.pick; r.plan = r.pick ? [r.pick] : draw(); r.at = now();
    nextRound(r); lobby();
  }
  function nextRound(r) {
    clear(r); r.round++; r.mode = r.plan[r.round - 1];
    const cont = r.players.filter((p) => !p.out); const n = cont.length; const m = r.mode; const last = r.round >= r.plan.length; const big = n > 10;
    r.keep = last ? 1 : r.round === 1 ? Math.max(2, Math.ceil(r.n0 * (!TEAMS.has(r.plan[1]) ? 0.6 : r.n0 > 8 ? 0.5 : 0.75))) : Math.max(2, Math.ceil(r.n0 * 0.35));
    if (TEAMS.has(m)) r.keep = Math.ceil(n / 2); // kazanan takım tur atlar
    if (m === 'kuyruk' && last) r.keep = Math.max(1, Math.round(n * 0.4)); // tek oyunda kuyruğu olanlar kazanır
    r.keep = Math.min(r.keep, Math.max(1, n - 1));
    Object.assign(r, { tiles: new Map(), result: null, finished: [], st: null, ball: null, rk: null, hit: null, ot: 0, deadAt: 0, ebes: null, taken: null, wave: 0,
      R: m === 'cubuk' ? (big ? 11 : ARENA_R) : big ? 13 : TAG_R, sumo: { ...SUMO, r0: big ? 13 : SUMO.r0 }, tileMs: big ? 2100 : TILE_MS, hm: big ? HM.big : HM.small, fut: { ...FUT, hx: n > 6 ? 10 : FUT.hx, hz: n > 6 ? 15.5 : FUT.hz, goal: n > 6 ? 4.4 : FUT.goal } }); // 3'e 3'ten kalabalık maçta saha ve kale büyür
    const TILES = r.hm.tiles; const sr = big ? 4 : 3; const free = TILES.map((_, i) => i).filter((i) => Math.abs(TILES[i].q) <= sr && Math.abs(TILES[i].r) <= sr && Math.abs(TILES[i].q + TILES[i].r) <= sr).sort(() => Math.random() - 0.5);
    const nb = [0, 0]; const ROLES = ['kaleci', 'forvet', 'orta', 'forvet', 'forvet', 'orta', 'forvet', 'forvet'];
    cont.forEach((p, k) => {
      Object.assign(p, { alive: true, fl: 0, y: 0, b: null, prog: 0, cp: 0, tail: false, team: null, imm: 0, cd: 0, ex: 0, ez: 0, spot: 0 });
      const a = (Math.PI * 2 * k) / n; const B = p.bot; const ring = (rad) => { p.x = Math.cos(a) * rad; p.z = Math.sin(a) * rad; };
      if (m === 'cubuk') { ring(r.R * 0.6); if (B) p.b = { a, r: rnd(3, r.R - 2), da: rnd(-0.12, 0.12), jt: -1, cool: [0, 0], hit: null }; }
      else if (m === 'zemin') { const ti = free[k % free.length]; p.x = TILES[ti].x; p.z = TILES[ti].z; if (B) p.b = { ti, mv: null, next: 0 }; }
      else if (m === 'kosu') { p.x = ((k % 6) - 2.5) * 1.45; p.z = 1.2 + Math.floor(k / 6) * 1.45; /* altışarlı sıra: 16 kişi de pistin başlangıç düzlüğüne (z ≤ 5) sığar */ if (B) p.b = { lane: p.x, sp: rnd(5.0, 6.2), stall: 0, seen: -1, ph: rnd(0, 6) }; }
      else if (m === 'bayrak') { // takımlar kendi üslerinin önünde dörderli sıra
        p.team = k % 2; const j = Math.floor(k / 2); p.x = ((j % 4) - 1.5) * 2.4; p.z = (p.team ? -1 : 1) * (BAY.base - 1.6 - Math.floor(j / 4) * 2.2);
        if (B) p.b = { vx: 0, vz: 0, role: j % 2 ? 'savun' : 'hucum', pace: rnd(0.9, 1.04), off: rnd(-3, 3) }; // takımın yarısı savunur
      }
      else if (m === 'futbol') { // takımlar sırayla dağıtılır; dörderli sıralar halinde dizilir, her takımın ilk botu kaleci
        p.team = k % 2; const j = Math.floor(k / 2); const size = p.team ? Math.floor(n / 2) : Math.ceil(n / 2);
        p.x = ((j % 4) - (Math.min(4, size) - 1) / 2) * 2.8; p.z = (p.team ? -1 : 1) * (5.5 + Math.floor(j / 4) * 2.6);
        if (B) p.b = { vx: 0, vz: 0, role: ROLES[nb[p.team]++ % ROLES.length], aim: 0, aimAt: 0, pace: rnd(0.9, 1.1), lane: rnd(-0.75, 0.75) * r.fut.hx };
      }
      else if (m === 'renk') { p.x = ((k % 4) - 1.5) * 2.4; p.z = (Math.floor(k / 4) - (Math.ceil(n / 4) - 1) / 2) * 2.4; if (B) p.b = { vx: 0, vz: 0 }; }
      else if (m === 'lav') { const an = (-0.3 - 0.2 * Math.floor(k / 4)) * LAV.da; const rr = 4.6 + (k % 4) * 0.8; /* ilk basamağın önünde dörderli sıra */ p.x = Math.cos(an) * rr; p.z = Math.sin(an) * rr; if (B) p.b = { step: 0, hop: null, next: rnd(0.5, 1.6), sk: rnd(0.8, 1.4), hx: p.x, hz: p.z }; }
      else if (m === 'sakla') { ring(big ? 4 : 3.2); if (B) p.b = { vx: 0, vz: 0, path: null, home: null, react: rnd(0.25, 1), sp: rnd(5.6, 6.6), alarm: 0 }; } // ebenin çevresinden dağılırlar
      else if (m === 'doner') { ring(4.6 + (k % 2) * 1.6); if (B) p.b = { vx: 0, vz: 0, sk: rnd(0.8, 1), lane: rnd(0, 1.3), nap: 0 }; }
      else { ring(m === 'sumo' ? r.sumo.r0 * (big ? 0.5 : 0.6) : r.R * 0.6); if (B) p.b = { vx: 0, vz: 0 }; }
    });
    if (m === 'kuyruk') { cont.slice().sort(() => Math.random() - 0.5).slice(0, r.keep).forEach((p) => { p.tail = true; }); r.st = { tails: r.players.map((p, i) => (p.tail && !p.out ? i : -1)).filter((i) => i >= 0) }; }
    else if (m === 'bomba') r.st = { bombs: [] };
    else if (m === 'bayrak') r.st = { teams: Object.fromEntries(cont.map((p) => [r.players.indexOf(p), p.team])), score: [0, 0], flags: [flagHome(0), flagHome(1)] };
    else if (m === 'futbol') { r.st = { teams: Object.fromEntries(cont.map((p) => [r.players.indexOf(p), p.team])), score: [0, 0] }; r.ball = { x: 0, z: 0, vx: 0, vz: 0, fr: 0 }; }
    else if (m === 'renk') { const cyc = []; let t = 2.5; for (let k = 0; k < 14; k++) { const th = Math.max(2, 4.2 - 0.22 * k); cyc.push([Math.floor(Math.random() * RENK.cols), r2(t), r2(t + th), r2(t + th + 2)]); t += th + 2.9; } r.rk = { seed: Math.floor(Math.random() * 1e9), cyc, done: -1 }; }
    else if (m === 'sakla') { r.taken = new Set(); const ne = n > 8 ? 2 : 1; r.ebes = Array.from({ length: ne }, (_, i) => ({ x: ne > 1 ? (i ? 0.9 : -0.9) : 0, z: 0, ry: i * Math.PI, mode: 'patrol', path: null, on: 0 })); }
    r.players.filter((p) => p.out).forEach((p) => { p.alive = false; });
    r.spawn = Object.fromEntries(r.players.map((p, i) => [i, [r2(p.x), 0, r2(p.z)]]).filter(([i]) => !r.players[i].out));
    r.phase = 'intro'; r.playAt = now() + INTRO_MS; r.nextBomb = r.playAt + 1500; push(r);
    r.tm = setTimeout(() => safe(r, () => { r.phase = 'play'; push(r); r.iv = setInterval(() => safe(r, () => tick(r)), TICK); }), INTRO_MS);
  }
  function elim(r, p) {
    if (!p.alive || r.phase !== 'play') return;
    p.alive = false; p.out = true; p.place = alive(r).length + 1;
    cast(r, 'k3:ev', { t: 'out', i: r.players.indexOf(p) });
    check(r);
  }
  function check(r) {
    if (r.phase !== 'play') return;
    const al = alive(r);
    // İzleyecek insan kalmadıysa bekletme: kısa bir süre sonra oyun biter (elenen oyuncu ne olduğunu görsün)
    if (!al.some((p) => !p.bot)) { if (!r.deadAt) r.deadAt = now() + 2400; return; }
    if (r.mode !== 'kosu' && al.length <= r.keep) endRound(r);
  }
  function endRound(r) {
    if (r.phase !== 'play') return;
    if (!alive(r).some((p) => !p.bot)) return finish(r, r.single && alive(r).length ? alive(r) : pick(alive(r).length ? alive(r) : r.players));
    clear(r); r.phase = 'result';
    const through = r.players.map((p, i) => (p.alive ? i : -1)).filter((i) => i >= 0); const last = r.round >= r.plan.length;
    r.result = { through, round: r.round, last };
    push(r);
    r.tm = setTimeout(() => safe(r, () => (last || through.length <= 1 ? finish(r, through.map((i) => r.players[i])) : nextRound(r))), RESULT_MS);
  }
  function finish(r, w) { // w: kazanan ya da kazananlar (tek oyunda birden çok kişi kazanabilir)
    clear(r); r.deadAt = 0;
    const win = (Array.isArray(w) ? w : [w]).filter(Boolean); if (!win.length) win.push(alive(r)[0] || r.players[0]);
    const rest = r.players.filter((p) => !win.includes(p) && p.alive).sort((a, b) => (b.prog || 0) - (a.prog || 0));
    win.forEach((p) => { p.place = 1; }); rest.forEach((p, k) => { p.place = win.length + 1 + k; });
    r.status = 'ended'; r.phase = 'final'; r.at = now();
    r.result = { winner: r.players.indexOf(win[0]), winners: win.map((p) => r.players.indexOf(p)), single: !!r.single, mode: r.single ? r.mode : null,
      order: r.players.map((p, i) => [p.place || 99, i]).sort((a, b) => a[0] - b[0]).map(([, i]) => i) };
    humans(r).forEach((p) => ctx.addXp?.(p.uid, 'oyun', win.includes(p) ? 2 : 1));
    // Lig puanı: kupada 1. 10, 2. 6, 3. 4, diğerleri 2; tek oyunda kazanan 4, diğerleri 1
    r.result.pts = {}; humans(r).forEach((p) => { const pts = r.single ? (win.includes(p) ? 4 : 1) : p.place === 1 ? 10 : p.place === 2 ? 6 : p.place === 3 ? 4 : 2; r.result.pts[r.players.indexOf(p)] = addSeason(p.uid, pts, win.includes(p)); });
    push(r); lobby();
  }

  // ---- Botlar ve tur akışı (10 Hz) ----
  function tick(r) {
    if (r.phase !== 'play') return;
    if (r.deadAt && now() >= r.deadAt) return finish(r, pick(alive(r).length ? alive(r) : r.players)); // insan kalmadı
    const t = (now() - r.playAt) / 1000; const dt = TICK / 1000;
    for (const p of r.players) {
      const b = p.b; if (!p.bot || !b) continue;
      if (b.fly) { p.x += b.fly[0] * dt; p.z += b.fly[2] * dt; b.fly[1] -= G * dt; p.y += b.fly[1] * dt; p.fl = 2; if (p.y < -12) p.b = null; continue; }
      if (!p.alive) continue;
      BOT[r.mode](r, p, b, t, dt); if (r.phase !== 'play') return;
    }
    MODE_TICK[r.mode]?.(r, t, dt);
    if (r.phase !== 'play') return;
    if (r.mode !== 'kosu') for (const p of alive(r)) { if (!p.bot && now() - Math.max(p.seen || 0, r.playAt) > 12000) { if (process.env.KUPA_DEBUG) console.log('[kupa] hareketsiz elendi', p.name, r.mode); elim(r, p); if (r.phase !== 'play') return; } }
    if (r.mode === 'zemin') { // çöken karonun üstündeki botlar düşer
      for (const p of alive(r)) { const b = p.b; if (!p.bot || !b || b.fly) continue; const on = b.mv && (now() - b.mv.t0) / b.mv.dur >= 0.5 ? b.mv.to : b.ti; const f = r.tiles.get(on); if (f && f <= now()) { b.fly = [0, -1, 0]; elim(r, p); if (r.phase !== 'play') return; } }
    }
    if (now() - r.playAt > CAP[r.mode]) { timeUp(r); if (r.phase !== 'play') return; }
    cast(r, 'k3:snap', [now(), r.players.map((p, i) => (p.alive || p.b?.fly ? [i, r2(p.x), r2(p.y), r2(p.z), r2(p.ry), p.fl || 0] : null)).filter(Boolean), r.ball ? [r2(r.ball.x), r2(r.ball.z), r2(r.ball.vx), r2(r.ball.vz)] : 0, r.ebes ? r.ebes.map((e) => [r2(e.x), r2(e.z), r2(e.ry), e.on]) : 0]);
  }
  function botCubuk(r, p, b, t, dt) {
    b.a += b.da * dt; if (Math.random() < 0.02) b.da = rnd(-0.15, 0.15);
    p.x = Math.cos(b.a) * b.r; p.z = Math.sin(b.a) * b.r; p.ry = -b.a + Math.PI / 2;
    if (b.jumpAt != null && t >= b.jumpAt && b.jt < 0) { b.jt = 0; b.jumpAt = null; }
    if (b.jt >= 0) { b.jt += dt; p.y = Math.max(0, JUMP * b.jt - 0.5 * G * b.jt * b.jt); if (b.jt > 0.77) { b.jt = -1; p.y = 0; } }
    p.fl = b.jt >= 0 ? 1 : 0;
    if (b.hit && t >= b.hit.at) { // zıplayamadı: çubuk çarptı
      const bar = BARS[b.hit.bi]; const w = barW(bar, t) * bar.dir; b.hit = null;
      if (p.y < 0.7) { const tx = -Math.sin(b.a) * w * b.r; const tz = Math.cos(b.a) * w * b.r; b.fly = [tx * 0.8 + Math.cos(b.a) * 7, 7, tz * 0.8 + Math.sin(b.a) * 7]; elim(r, p); }
      return;
    }
    BARS.forEach((bar, bi) => {
      const w = barW(bar, t); if (!w || t < b.cool[bi] || b.hit) return;
      let rel = (b.a - barAngle(bar, t)) * bar.dir; rel = ((rel % Math.PI) + Math.PI) % Math.PI; // çubuk çap boyunca: π'de bir geçer
      const tth = rel / w;
      if (tth < 0.34) {
        b.cool[bi] = t + tth + 0.3;
        const fail = Math.random() < 0.012 + 0.013 * w;
        if (fail) b.hit = { at: t + tth, bi }; else if (b.jt < 0 && b.jumpAt == null) b.jumpAt = t + Math.max(0, tth - 0.22); // çubuk gelmeden hemen önce zıpla
      }
    });
  }
  function botZemin(r, p, b) {
    const n = now(); const TILES = r.hm.tiles; const NB = r.hm.nb;
    if (b.mv) {
      const k = Math.min(1, (n - b.mv.t0) / b.mv.dur); const A = TILES[b.mv.from]; const B = TILES[b.mv.to];
      p.x = A.x + (B.x - A.x) * k; p.z = A.z + (B.z - A.z) * k; p.y = Math.sin(k * Math.PI) * 0.7; p.fl = 1; p.ry = Math.atan2(B.x - A.x, B.z - A.z);
      if (k >= 1) { b.ti = b.mv.to; b.mv = null; p.y = 0; p.fl = 0; touch(r, b.ti); b.next = n + rnd(900, 1500) * (r.tileMs / TILE_MS); }
      return;
    }
    touch(r, b.ti);
    const f = r.tiles.get(b.ti); if (n < b.next && (!f || f - n > 480)) return;
    if (Math.random() < 0.05) { b.next = n + 260; return; } // ara sıra tereddüt eder
    const fresh = NB[b.ti].filter((i) => !r.tiles.has(i)); const ok = NB[b.ti].filter((i) => { const x = r.tiles.get(i); return x && x - n > 520; });
    const cand = fresh.length ? fresh : ok; if (!cand.length) return;
    const score = (i) => NB[i].filter((j) => !r.tiles.has(j)).length + Math.random() * 1.5;
    b.mv = { from: b.ti, to: cand.sort((x, y) => score(y) - score(x))[0], t0: n, dur: 330 };
  }
  function botKosu(r, p, b, t, dt) {
    if (b.stall > 0) { b.stall -= dt; p.fl = 0; } else {
      p.prog = Math.min(TRACK, (p.prog || 0) + b.sp * dt); p.fl = 0;
      const oi = KOSU_OBS.findIndex((z, i) => i > b.seen && p.prog >= z - 1.5);
      if (oi >= 0) {
        b.seen = oi; const u = Math.random();
        if (u < 0.1) { p.prog = [...KOSU_CP].reverse().find((c) => c <= p.prog) || 0; b.stall = 1.4; b.seen = KOSU_OBS.findIndex((z) => z > p.prog) - 1; } // düştü, dönüş noktasından devam
        else if (u < 0.5) b.stall = rnd(0.3, 1.1);
      }
    }
    p.x = b.lane * 0.8 + Math.sin(t * 0.9 + b.ph) * 1.2; p.z = -p.prog; p.ry = Math.PI; p.y = 0;
    if (p.prog >= TRACK) win(r, p);
  }
  // ---- Ek modlar: ortak yardımcılar ----
  const draw = () => { if (process.env.KUPA_PLAN) return process.env.KUPA_PLAN.split(','); const a = pick(POOL[0]); const b = pick(POOL[1].filter((m) => m !== a)); return [a, b, pick(POOL[2].filter((m) => m !== b))]; };
  const vel = (p) => (p.bot ? [p.b?.vx || 0, p.b?.vz || 0] : [p.ex || 0, p.ez || 0]);
  const others = (r, p) => alive(r).filter((q) => q !== p);
  const nearest = (p, list) => list.reduce((best, q) => { const d = Math.hypot(q.x - p.x, q.z - p.z); return !best || d < best[1] ? [q, d] : best; }, null);
  function steer(p, tx, tz, sp, dt, lim) { // hedefe doğru yürü (lim: çitin yarıçapı)
    const b = p.b; const dx = tx - p.x; const dz = tz - p.z; const d = Math.hypot(dx, dz); const k = Math.min(1, 7 * dt); const s = d > 0.3 ? sp : (sp * d) / 0.3;
    b.vx += ((d ? dx / d : 0) * s - b.vx) * k; b.vz += ((d ? dz / d : 0) * s - b.vz) * k; p.x += b.vx * dt; p.z += b.vz * dt;
    if (lim) { const rr = Math.hypot(p.x, p.z); if (rr > lim) { p.x *= lim / rr; p.z *= lim / rr; } }
    if (Math.hypot(b.vx, b.vz) > 0.6) p.ry = Math.atan2(b.vx, b.vz); p.y = 0; p.fl = 0;
  }
  function fleeFrom(p, th, sp, dt, R) { // kaç; çite yaklaşınca çit boyunca kay
    let dx = p.x - th.x; let dz = p.z - th.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d; const rr = Math.hypot(p.x, p.z) || 1;
    if (rr > R - 3) { const tx = -p.z / rr; const tz = p.x / rr; const s = tx * dx + tz * dz >= 0 ? 1 : -1; dx = dx * 0.25 + tx * s - (p.x / rr) * 0.6; dz = dz * 0.25 + tz * s - (p.z / rr) * 0.6; }
    steer(p, p.x + dx * 4, p.z + dz * 4, sp, dt, R - 0.6);
  }
  function drop(r, list) { // toplu eleme (süre sonu, yanlış renk, kaybeden takım)
    const out = list.filter((p) => p.alive); if (!out.length) return; const place = alive(r).length - out.length + 1;
    out.forEach((p) => { p.alive = false; p.out = true; p.place = place; cast(r, 'k3:ev', { t: 'out', i: r.players.indexOf(p) }); });
  }
  function timeUp(r) {
    if (r.mode === 'kosu') return finish(r, alive(r).sort((a, b) => (b.prog || 0) - (a.prog || 0))[0]);
    if (r.mode === 'kuyruk') drop(r, alive(r).filter((p) => !p.tail)); // kuyruğu olanlar tur atlar
    if (r.mode === 'bayrak') { const [a, b] = r.st.score; if (a === b && !r.ot) { r.ot = now(); r.st.ot = 1; cast(r, 'k3:ev', { t: 'ot' }); push(r); return; } if (a === b && now() - r.ot < 30000) return; return bayEnd(r); }
    if (r.mode === 'futbol') { const [a, b] = r.st.score; if (a === b && !r.ot) { r.ot = now(); r.st.ot = 1; cast(r, 'k3:ev', { t: 'ot' }); return; } if (a === b && now() - r.ot < 30000) return; return futEnd(r); }
    if (!r.single && r.round >= r.plan.length && alive(r).length > 1) { // kupa finalinde tek kazanan: sumoda merkeze en yakın, diğerlerinde kura
      const al = alive(r); const sc = new Map(al.map((p) => [p, r.mode === 'sumo' ? -Math.hypot(p.x, p.z) : Math.random()])); const best = al.slice().sort((a, b) => sc.get(b) - sc.get(a))[0]; drop(r, al.filter((p) => p !== best));
    }
    endRound(r);
  }

  // ---- Kuyruk Kapmaca / Bomba Elden Ele: dokununca el değiştirir ----
  const holders = (r) => (r.mode === 'kuyruk' ? alive(r).filter((p) => p.tail) : r.st.bombs.map((b) => r.players[b[0]]).filter((p) => p?.alive));
  function syncTag(r) {
    if (r.mode === 'kuyruk') { r.st.tails = r.players.map((p, i) => (p.alive && p.tail ? i : -1)).filter((i) => i >= 0); cast(r, 'k3:ev', { t: 'tail', tails: r.st.tails }); }
    else cast(r, 'k3:ev', { t: 'bomb', b: r.st.bombs });
  }
  function tagTick(r) {
    const n = now(); const al = alive(r);
    if (r.mode === 'kuyruk') {
      for (const h of al.filter((p) => p.tail)) { if (n < h.imm) continue; const s = al.find((q) => !q.tail && n > q.cd && Math.hypot(q.x - h.x, q.z - h.z) < 1.25); if (s) { h.tail = false; h.cd = n + 1300; s.tail = true; s.imm = n + 1500; syncTag(r); } }
      return;
    }
    const st = r.st;
    if (!st.bombs.length) { // yeni bomba(lar)
      if (n < r.nextBomb || al.length <= r.keep) return;
      const cut = Math.min(6000, r.wave++ * 1000); // her dalgada fitil kısalır
      st.bombs = al.slice().sort(() => Math.random() - 0.5).slice(0, al.length > 10 ? 3 : al.length > 5 ? 2 : 1).map((p) => [r.players.indexOf(p), Math.round(n + rnd(11000, 17000) - cut), n + 1200]);
      return syncTag(r);
    }
    for (const b of st.bombs.slice()) {
      const h = r.players[b[0]];
      if (!h?.alive) { st.bombs.splice(st.bombs.indexOf(b), 1); syncTag(r); continue; }
      if (n >= b[1]) { // patladı
        st.bombs.splice(st.bombs.indexOf(b), 1); r.nextBomb = n + 2600; cast(r, 'k3:ev', { t: 'boom', i: b[0] });
        if (h.bot && h.b) h.b.fly = [rnd(-3, 3), 9, rnd(-3, 3)]; elim(r, h); if (r.phase !== 'play') return; syncTag(r); continue;
      }
      if (n < b[2]) continue;
      const held = new Set(st.bombs.map((x) => x[0])); const to = al.find((q) => q !== h && !held.has(r.players.indexOf(q)) && !(r.players.indexOf(q) === b[3] && n < b[4]) && Math.hypot(q.x - h.x, q.z - h.z) < 1.25);
      if (to) { b[3] = b[0]; b[4] = n + 2500; b[0] = r.players.indexOf(to); b[2] = n + 1000; syncTag(r); } // verene 2,5 sn geri verilemez
    }
  }
  function botTag(r, p, b, t, dt) {
    const hs = holders(r); const mine = hs.includes(p); const free = others(r, p).filter((q) => !hs.includes(q)); const kuy = r.mode === 'kuyruk';
    const bm = !kuy && mine ? r.st.bombs.find((x) => r.players[x[0]] === p) : null; const can = bm ? free.filter((q) => !(r.players.indexOf(q) === bm[3] && now() < bm[4])) : free;
    if (kuy ? !mine : mine) { const tg = nearest(p, kuy ? hs.filter((q) => q !== p) : can.length ? can : free); if (tg) return steer(p, tg[0].x, tg[0].z, kuy ? 6.1 : 6.6, dt, r.R - 0.6); } // kuyruksuz / bombalı kovalar
    else { const th = nearest(p, kuy ? free : hs); if (th && th[1] < 7) return fleeFrom(p, th[0], 6, dt, r.R); }
    if (!b.w || t > b.w[2]) b.w = [rnd(-0.6, 0.6) * r.R, rnd(-0.6, 0.6) * r.R, t + rnd(1.5, 3)];
    steer(p, b.w[0], b.w[1], 3.5, dt, r.R - 0.6);
  }

  // ---- Sumo: daralan platformda itişme ----
  function botSumo(r, p, b, t, dt) {
    const R = sumoR(r.sumo, t); const rr = Math.hypot(p.x, p.z);
    if (b.push > 0) { b.push -= dt; p.x += b.vx * dt; p.z += b.vz * dt; b.vx *= 1 - 1.2 * dt; b.vz *= 1 - 1.2 * dt; p.fl = 0; }
    else if (b.dash > 0) { b.dash -= dt; p.x += b.vx * dt; p.z += b.vz * dt; p.fl = 3; }
    else {
      const tg = nearest(p, others(r, p));
      if (rr > R - 2.1 || !tg) steer(p, 0, 0, 5.6, dt); // kenardan uzak dur
      else if (t > 2.5 && tg[1] < 2.3 && t > (b.cd || 0) && Math.hypot(tg[0].x, tg[0].z) > rr - 0.5) { const dx = tg[0].x - p.x; const dz = tg[0].z - p.z; b.vx = (dx / tg[1]) * 12; b.vz = (dz / tg[1]) * 12; b.dash = 0.22; b.cd = t + rnd(1.4, 2.6); p.ry = Math.atan2(dx, dz); p.fl = 3; }
      else steer(p, tg[0].x, tg[0].z, 5.3, dt);
    }
    if (Math.hypot(p.x, p.z) > R + 0.35) { b.fly = [b.vx * 0.6, 0, b.vz * 0.6]; elim(r, p); }
  }
  // ---- Bayrak Kapmaca ----
  const flagHome = (t) => ({ h: 1, c: null, x: 0, z: (t ? -1 : 1) * BAY.base, at: 0 });
  const baseZ = (t) => (t ? -1 : 1) * BAY.base;
  const flagPos = (r, f) => (f.c != null ? r.players[f.c] : f);
  function bayTick(r) {
    const F = r.st.flags; const n = now(); const al = alive(r); let ch = false;
    for (const p of al) {
      const i = r.players.indexOf(p); const tm = p.team; if (tm == null) continue; const own = F[tm]; const en = F[1 - tm];
      if (en.c === i) { // taşıyıcı üssüne vardı: puan
        if (Math.hypot(p.x, p.z - baseZ(tm)) < BAY.br) {
          r.st.score[tm] += 1; F[1 - tm] = flagHome(1 - tm); cast(r, 'k3:ev', { t: 'cap', i, team: tm, s: r.st.score.slice() }); push(r);
          if (r.st.score[tm] >= BAY.win || r.ot) return bayEnd(r);
          ch = false;
        }
        continue;
      }
      if (own.c == null && !own.h && Math.hypot(p.x - own.x, p.z - own.z) < BAY.grab) { F[tm] = flagHome(tm); cast(r, 'k3:ev', { t: 'ret', i, team: tm }); ch = true; }
      if (en.c == null && n > (p.fcd || 0) && Math.hypot(p.x - en.x, p.z - en.z) < BAY.grab) { en.c = i; en.h = 0; en.safe = n + BAY.safe; cast(r, 'k3:ev', { t: 'take', i, team: tm }); ch = true; }
    }
    for (const tm of [0, 1]) { // tm takımının taşıdığı bayrak: rakip dokunursa düşer
      const f = F[1 - tm];
      if (f.c == null) { if (!f.h && n - f.at > BAY.back) { F[1 - tm] = flagHome(1 - tm); cast(r, 'k3:ev', { t: 'ret', i: -1, team: 1 - tm }); ch = true; } continue; }
      const ci = f.c; const cp = r.players[ci];
      const inFoeHalf = cp && cp.z * baseZ(1 - tm) > 0; // taşıyıcı hâlâ rakibin yarı sahasında
      const hit = cp?.alive && inFoeHalf && n > (f.safe || 0) ? al.find((q) => q.team === 1 - tm && Math.hypot(q.x - cp.x, q.z - cp.z) < BAY.tag) : null;
      if (!cp?.alive || hit) { f.c = null; f.x = Math.max(-BAY.hx + 1, Math.min(BAY.hx - 1, cp?.x ?? 0)); f.z = Math.max(-BAY.hz + 1, Math.min(BAY.hz - 1, cp?.z ?? 0)); f.at = n; if (cp) cp.fcd = n + 2500; cast(r, 'k3:ev', { t: 'drop', i: ci, by: hit ? r.players.indexOf(hit) : -1 }); ch = true; }
    }
    if (ch) push(r);
  }
  function bayEnd(r) { // fazla puanlı takım kazanır; eşitlikte kendi bayrağı üssünden daha uzakta olan takım kaybeder
    const [a, b] = r.st.score; let lose;
    if (a !== b) lose = a > b ? 1 : 0;
    else { const d = (t) => { const f = r.st.flags[t]; if (f.h) return 0; const q = flagPos(r, f); return Math.hypot(q.x, q.z - baseZ(t)); }; const d0 = d(0); const d1 = d(1); lose = d0 === d1 ? (Math.random() < 0.5 ? 0 : 1) : d0 > d1 ? 0 : 1; }
    drop(r, alive(r).filter((p) => p.team === lose)); endRound(r);
  }
  function botBayrak(r, p, b, t, dt) {
    const i = r.players.indexOf(p); const tm = p.team; const F = r.st.flags; const own = F[tm]; const en = F[1 - tm]; const sp = 5.5 * b.pace; let tx = p.x; let tz = p.z; let s = sp;
    const foes = alive(r).filter((q) => q.team !== tm);
    if (en.c === i) { tx = b.off * 0.4; tz = baseZ(tm); s = sp * 0.88; } // bayrak bende: eve (bayrak ağır, biraz yavaş)
    else if (b.role === 'savun') {
      if (own.c != null) { const c = flagPos(r, own); if (c.z * baseZ(tm) > 0) { tx = c.x; tz = c.z; } else { tx = c.x * 0.5; tz = baseZ(tm) * 0.1; } s = sp; } // yarı sahayı geçtiyse kovalamak boşuna
      else if (!own.h) { tx = own.x; tz = own.z; }
      else { const intr = foes.map((q) => [q, Math.hypot(q.x - own.x, q.z - own.z)]).filter((x) => x[1] < 6).sort((x, y) => x[1] - y[1])[0];
        if (intr && t > (b.wake || 0)) { tx = intr[0].x; tz = intr[0].z; s = sp * 0.92; } else { if (!intr) b.wake = t + rnd(0.4, 0.9); const a = t * 0.7 + b.off; tx = Math.cos(a) * 4.5; tz = own.z - baseZ(tm) * 0.3 + Math.sin(a) * 1.5; s = sp * 0.55; } }
    } else {
      if (en.c == null) { tx = en.x; tz = en.z; }
      else { const c = r.players[en.c]; const thr = foes.map((q) => [q, Math.hypot(q.x - c.x, q.z - c.z)]).sort((x, y) => x[1] - y[1])[0]; // arkadaşım taşıyor: ona yaklaşanı kes
        if (thr && thr[1] < 6) { tx = (thr[0].x + c.x) / 2; tz = (thr[0].z + c.z) / 2; } else { tx = c.x + b.off * 0.5; tz = c.z - baseZ(tm) * 0.12; } }
      if (own.c != null) { const c = flagPos(r, own); if (Math.hypot(c.x - p.x, c.z - p.z) < 5) { tx = c.x; tz = c.z; } }
    }
    steer(p, tx, tz, s, dt);
    p.x = Math.max(-BAY.hx + 0.4, Math.min(BAY.hx - 0.4, p.x)); p.z = Math.max(-BAY.hz + 0.4, Math.min(BAY.hz - 0.4, p.z));
  }
  function botDoner(r, p, b, t, dt) { // tabla botu taşır ve savurur; bot göbeğe doğru koşar, ara sıra dalar
    const w = donW(DON, t); const rr = Math.hypot(p.x, p.z) || 0.01; const a = w * dt; const cs = Math.cos(a); const sn = Math.sin(a);
    const x = p.x * cs - p.z * sn; const z = p.x * sn + p.z * cs; const out = DON.k * w * w * rr * dt; p.x = x + (x / rr) * out; p.z = z + (z / rr) * out; p.fl = 0;
    if (t > (b.nap || 0)) {
      if (Math.random() < dt * 0.1) b.nap = t + rnd(0.3, 0.8);
      const r2 = Math.hypot(p.x, p.z);
      if (r2 > DON.hub + 0.9 + b.lane) steer(p, 0, 0, 5.8 * b.sk, dt); else steer(p, p.x - p.z, p.z + p.x, 2.2, dt); // yerindeyse göbeğin çevresinde dolanır
    }
    const r3 = Math.hypot(p.x, p.z) || 0.01; const min = DON.hub + 0.45;
    if (r3 < min) { p.x *= min / r3; p.z *= min / r3; } else if (r3 > DON.r + 0.35) { b.fly = [(p.x / r3) * 5, 0, (p.z / r3) * 5]; elim(r, p); }
  }
  function sumoTick(r) { // botların itilmesi (insanın itilmesini kendi cihazı hesaplar)
    const al = alive(r); const n = now(); r.hit = r.hit || new Map();
    for (let i = 0; i < al.length; i++) for (let j = i + 1; j < al.length; j++) {
      const A = al[i]; const B = al[j]; if (!A.bot && !B.bot) continue;
      const dx = B.x - A.x; const dz = B.z - A.z; const d = Math.hypot(dx, dz); if (d > 0.95 || d < 0.001) continue;
      const key = `${r.players.indexOf(A)}:${r.players.indexOf(B)}`; if (n < (r.hit.get(key) || 0)) continue; r.hit.set(key, n + 300);
      const nx = dx / d; const nz = dz / d; const [ax, az] = vel(A); const [bx, bz] = vel(B); const ap = Math.max(0, (ax - bx) * nx + (az - bz) * nz);
      const kick = (from, to, s) => { if (!to.bot || !to.b || to.b.fly) return; const J = Math.min(9, ap * 0.8 + (from.bot && from.fl === 3 ? 4.5 : 1.2)) * (to.fl === 3 ? 0.3 : 1); to.b.vx += nx * s * J; to.b.vz += nz * s * J; to.b.push = from.bot && from.fl === 3 ? 0.35 : 0.2; to.b.dash = 0; };
      kick(A, B, 1); kick(B, A, -1);
    }
  }

  // ---- Renk Zemini: söylenen renk dışındaki karolar düşer ----
  function botRenk(r, p, b, t, dt) {
    const rk = r.rk; const k = rk.cyc.findIndex((c) => t >= c[1] && t < c[3] + 0.9); const lim = (RENK.n * RENK.size) / 2 - 0.5;
    if (k >= 0 && b.k !== k && t > rk.cyc[k][1] + (b.lag ?? 0.5)) {
      b.k = k; b.lag = rnd(0.3, 1.1); const lay = renkLayout(rk.seed, k, rk.cyc[k][0]); const h = (RENK.n * RENK.size) / 2; rk.wr = rk.wr || {}; const wrong = alive(r).length - r.keep - (rk.wr[k] || 0) > 0 && Math.random() < 0.05 + 0.02 * k; if (wrong) rk.wr[k] = (rk.wr[k] || 0) + 1; // ara sıra yanlış renge gider (tur atlayacak sayının altına düşürmez)
      const c = lay.map((col, i) => [i, col]).filter(([, col]) => (col === rk.cyc[k][0]) !== wrong).map(([i]) => ({ x: ((i % RENK.n) + 0.5) * RENK.size - h, z: (Math.floor(i / RENK.n) + 0.5) * RENK.size - h }));
      const by = c.map((q) => [q, Math.hypot(q.x - p.x, q.z - p.z)]).sort((x, y) => x[1] - y[1]).slice(0, 3); const tg = by.length ? pick(by.filter((x) => x[1] < by[0][1] + 3.5))[0] : null; // en yakın birkaç karodan biri: herkes aynı karoya yığılmasın
      b.tg = tg ? [tg.x + rnd(-0.7, 0.7), tg.z + rnd(-0.7, 0.7)] : null;
    }
    if (b.tg) steer(p, b.tg[0], b.tg[1], 6, dt); else steer(p, p.x, p.z, 0, dt);
    p.x = Math.max(-lim, Math.min(lim, p.x)); p.z = Math.max(-lim, Math.min(lim, p.z));
  }
  function renkTick(r, t) {
    const rk = r.rk; const k = rk.cyc.findIndex((c, i) => i > rk.done && t >= c[2]);
    if (k >= 0) {
      rk.done = k; const lay = renkLayout(rk.seed, k, rk.cyc[k][0]);
      const bad = alive(r).filter((p) => p.bot && p.b && !p.b.fly && lay[renkTile(p.x, p.z)] !== rk.cyc[k][0]);
      bad.forEach((p) => { p.b.fly = [0, -1, 0]; }); drop(r, bad); check(r); if (r.phase !== 'play') return;
    }
    if (t > rk.cyc[rk.cyc.length - 1][3] + 1) endRound(r);
  }

  // ---- Lav Yükseliyor: sarmal basamaklardan zirveye ----
  function reach(r, p) { // zirveye ilk ulaşanlar tur atlar
    if (r.phase !== 'play' || r.mode !== 'lav' || !p.alive || r.finished.includes(p)) return;
    r.finished.push(p); cast(r, 'k3:ev', { t: 'top', i: r.players.indexOf(p) });
    if (r.finished.length >= r.keep) { drop(r, alive(r).filter((q) => !r.finished.includes(q))); endRound(r); }
  }
  function botLav(r, p, b, t) {
    const at = (i) => (i > 0 ? padAt(i) : { x: b.hx, z: b.hz, y: 0 });
    if (b.hop) {
      const k = Math.min(1, (t - b.hop.t0) / b.hop.dur); const A = at(b.hop.from); const B = at(b.hop.to);
      p.x = A.x + (B.x - A.x) * k; p.z = A.z + (B.z - A.z) * k; p.y = A.y + (B.y - A.y) * k + Math.sin(k * Math.PI) * 0.9; p.fl = 1; p.ry = Math.atan2(B.x - A.x, B.z - A.z);
      if (k >= 1) { b.step = b.hop.to; b.hop = null; p.fl = 0; b.next = t + rnd(0.3, 0.8) * b.sk; if (b.step >= LAV.n) reach(r, p); }
    } else if (b.step < LAV.n && t >= b.next) { const slip = b.step > 3 && Math.random() < 0.05; const to = slip ? Math.max(1, b.step - 2 - Math.floor(Math.random() * 2)) : b.step + 1; /* ara sıra kayıp birkaç basamak düşer */ const A = at(b.step); const B = at(to); b.hop = { from: b.step, to, t0: t, dur: slip ? 0.9 : Math.max(0.6, Math.hypot(B.x - A.x, B.z - A.z) / 7) }; }
    if (r.phase === 'play' && p.alive && !r.finished.includes(p) && p.y < lavaY(t) - 0.1) { b.fly = [0, -2, 0]; elim(r, p); }
  }

  // ---- Dev Top Futbolu: top sunucuda, iki takım ----
  function botFut(r, p, b, t, dt) {
    const F = r.fut; const B = r.ball; const gz = p.team ? F.hz : -F.hz; const own = -gz; let tx; let tz; let sp = 5.6; // gz: hücum edilen kale, own: kendi kalesi
    if (t > b.aimAt) { b.aim = rnd(-F.goal * 0.6, F.goal * 0.6); b.aimAt = t + rnd(1.5, 2.6); } // her seferinde kalenin başka köşesine nişan alır
    const dBall = Math.hypot(B.x - p.x, B.z - p.z); const inOwnHalf = (B.z - 0) * Math.sign(own) > 0;
    if (r.frT !== t) { // her takımda topa en yakın iki oyuncu (insanlar dahil) topa gider; diğerleri yer tutar, herkes topa yığılmaz
      r.frT = t; r.fr = new Map();
      for (const tm of [0, 1]) alive(r).filter((q) => q.team === tm && q.b?.role !== 'kaleci').map((q) => [q, Math.hypot(B.x - q.x, B.z - q.z)]).sort((x, y) => x[1] - y[1]).forEach(([q], k) => r.fr.set(q, k));
    }
    const rank = r.fr.get(p) ?? 0;
    const chase = () => { // topun arkasına geç, sonra kaleye sür
      let gx = b.aim - B.x; let gq = gz - B.z; const gl = Math.hypot(gx, gq) || 1; gx /= gl; gq /= gl; const bx = B.x - gx * 1.9; const bz = B.z - gq * 1.9;
      const stuck = Math.abs(bx) > F.hx - 0.7 || Math.abs(bz) > F.hz - 0.7; // top duvar dibinde: arkasına geçilemez, doğrudan üstüne git
      if (stuck || ((p.x - B.x) * gx + (p.z - B.z) * gq < -0.4 && Math.hypot(p.x - bx, p.z - bz) < 2.4)) { tx = B.x + gx * 2; tz = B.z + gq * 2; } else { tx = bx; tz = bz; }
    };
    if (b.role === 'kaleci' && !r.ot) { sp = 4.2; if (dBall < 3.4 && Math.abs(B.z - own) < 6) chase(); else { tx = Math.max(-F.goal, Math.min(F.goal, B.x * 0.45)); tz = own * 0.86; } } // uzatmada kaleci de oyuna katılır
    else if (rank >= 2 && b.role === 'forvet') { tx = b.lane; tz = Math.max(-F.hz + 2, Math.min(F.hz - 2, B.z + Math.sign(gz) * 4.5)); } // topun önünde, kendi koridorunda pas bekler
    else if (rank >= 2 || (b.role === 'orta' && !inOwnHalf && dBall > 5)) { sp = 5; tx = B.x * 0.6 + (rank >= 2 ? b.lane * 0.4 : 0); tz = B.z + (own - B.z) * 0.45; } // topla kendi kalesi arasında bekler
    else chase();
    steer(p, tx, tz, sp * (b.pace || 1), dt); p.x = Math.max(-F.hx + 0.4, Math.min(F.hx - 0.4, p.x)); p.z = Math.max(-F.hz + 0.4, Math.min(F.hz - 0.4, p.z));
  }
  function futTick(r, t, dt) {
    const F = r.fut; const B = r.ball; if (now() < B.fr) return; const min = F.br + 0.5;
    for (let q = 0; q < 2; q++) {
      const h = dt / 2; let ix = 0; let iz = 0; let cx = 0; let cz = 0; let n = 0; let tm = 0; // aynı anda değen herkesin itişi birlikte hesaplanır (sıraya göre taraf tutmaz)
      for (const p of alive(r)) {
        const dx = B.x - p.x; const dz = B.z - p.z; const d = Math.hypot(dx, dz); if (d >= min || d < 0.001 || p.y > 1.6) continue;
        const [vx, vz] = vel(p); const nx = dx / d; const nz = dz / d; const rel = (vx - B.vx) * nx + (vz - B.vz) * nz;
        if (rel > 0) { ix += nx * rel * F.k + vx * F.c; iz += nz * rel * F.k + vz * F.c; }
        cx += p.x + nx * min; cz += p.z + nz * min; n++; tm |= 1 << p.team;
      }
      if (n) { B.vx += ix; B.vz += iz; B.x = cx / n; B.z = cz / n; }
      if (tm === 3 && now() > (B.loose || 0)) { B.loose = now() + 700; B.vx += rnd(-2.5, 2.5); B.vz += (Math.random() < 0.5 ? -1 : 1) * rnd(5, 8); } // iki takım arasında sıkışan top bir yana fırlar
      const sp = Math.hypot(B.vx, B.vz); if (sp > F.vmax) { B.vx *= F.vmax / sp; B.vz *= F.vmax / sp; }
      B.x += B.vx * h; B.z += B.vz * h; B.vx *= F.fr; B.vz *= F.fr;
      if (Math.abs(B.x) > F.hx - F.br) { B.x = Math.sign(B.x) * (F.hx - F.br); B.vx *= -F.wall; }
      if (Math.abs(B.z) > F.hz - F.br) {
        if (Math.abs(B.x) < F.goal - 0.2) { if (Math.abs(B.z) > F.hz + 0.3) return goal(r, B.z < 0 ? 0 : 1); }
        else { B.z = Math.sign(B.z) * (F.hz - F.br); B.vz *= -F.wall; }
      }
    }
  }
  function goal(r, team) {
    r.st.score[team]++; Object.assign(r.ball, { x: 0, z: 0, vx: 0, vz: 0, fr: now() + 2200 });
    alive(r).forEach((p) => { const sp = r.spawn[r.players.indexOf(p)]; if (p.bot && p.b && sp) { p.x = sp[0]; p.z = sp[2]; p.b.vx = 0; p.b.vz = 0; } }); // santra: herkes yerine
    cast(r, 'k3:ev', { t: 'goal', team, s: r.st.score }); if (r.ot) futEnd(r);
  }
  function futEnd(r) { const [a, b] = r.st.score; const lose = a === b ? (r.ball.z > 0 ? 0 : 1) : a > b ? 1 : 0; /* uzatma da berabere: top kimin yarı sahasındaysa o takım kaybeder */ drop(r, alive(r).filter((p) => p.team === lose)); endRound(r); }
  // ---- Saklambaç: ebe arar, botlar saklanır ----
  function ebeStep(r, e, t, dt) {
    if (t < SAK.wait) { e.ry += dt * 2.2; e.on = 0; return; } // sayıyor: yerinde döner, görmez
    e.on = 1; const sp = 4.2 + Math.min(1.5, (t - SAK.wait) * 0.03); // süre ilerledikçe hızlanır (oyuncular 7 m/sn koşar)
    const near = nearest(e, alive(r).filter((p) => sees(e, p.x, p.z)));
    if (near) { e.tgt = near[0]; e.last = [near[0].x, near[0].z]; if (e.mode !== 'chase') { e.mode = 'chase'; e.path = null; } }
    else if (e.mode === 'chase') { e.mode = 'seek'; e.tgt = null; e.path = route(e.x, e.z, e.last[0], e.last[1]); } // gözden kaçtı: son gördüğü yere gider
    const lookAround = () => { e.mode = 'look'; e.until = t + 1.5; e.base = e.ry; e.path = null; };
    if (e.mode === 'chase') { if (!e.path || t >= (e.rp || 0)) { e.path = route(e.x, e.z, e.tgt.x, e.tgt.z); e.rp = t + 0.35; } }
    else if (e.mode === 'look') { e.ry = e.base + Math.sin((1.5 - (e.until - t)) * 4.2) * 1.25; if (t >= e.until) e.mode = 'patrol'; return; } // çevresine bakınır
    else if (e.mode === 'seek') { if (!e.path || !e.path.length) return lookAround(); }
    else { // devriye: çoğu kez bir saklananın yakınlarına, bazen rastgele bir köşeye
      if (e.path && !e.path.length) return lookAround();
      if (!e.path) { const al = alive(r); const h = al.length && Math.random() < 0.5 ? pick(al) : null; const c = pick(h ? SG.cover.filter(([x, z]) => Math.hypot(x - h.x, z - h.z) < 7).concat([pick(SG.cover)]) : SG.cover); e.path = route(e.x, e.z, c[0], c[1]); }
    }
    const w = e.path && e.path[0]; if (!w) return;
    const dx = w[0] - e.x; const dz = w[1] - e.z; const d = Math.hypot(dx, dz); if (d < 0.35) { e.path.shift(); return; }
    const st = Math.min(d, sp * dt); e.x += (dx / d) * st; e.z += (dz / d) * st;
    let a = Math.atan2(dx, dz) - e.ry; a = Math.atan2(Math.sin(a), Math.cos(a)); e.ry += Math.max(-5 * dt, Math.min(5 * dt, a)); // başını yavaş çevirir
  }
  function saklaTick(r, t, dt) {
    for (const e of r.ebes) ebeStep(r, e, t, dt);
    if (t < SAK.wait) return;
    for (const p of alive(r)) { // görüşte kalan bulunur; gözden kaçınca sayaç yavaşça geri iner
      p.spot = r.ebes.some((e) => sees(e, p.x, p.z)) ? (p.spot || 0) + dt : Math.max(0, (p.spot || 0) - dt * 0.6);
      if (p.spot >= SAK.spot) { cast(r, 'k3:ev', { t: 'catch', i: r.players.indexOf(p) }); if (p.b?.home) r.taken.delete(p.b.home); elim(r, p); if (r.phase !== 'play') return; }
    }
  }
  function botSakla(r, p, b, t, dt) {
    const es = r.ebes; const dng = t >= SAK.wait - 1.5 && es.some((e) => Math.hypot(e.x - p.x, e.z - p.z) < 10.5 && !segHits(e.x, e.z, p.x, p.z)); // ebe beni görebilecek yerde
    if (!dng) b.alarm = 0; else if (!b.alarm) b.alarm = t + b.react; // fark etmesi biraz sürer
    if ((!b.home && t >= (b.cool || 0)) || (dng && t >= b.alarm && t >= (b.cool || 0))) { // yeni yer: ebelerin görmediği, onlara uzak, bana yakın bir köşe
      let best = null; let bs = -1e9;
      for (let k = 0; k < 14; k++) {
        const c = pick(SG.cover); if (r.taken.has(c)) continue;
        const hid = es.every((e) => segHits(e.x, e.z, c[0], c[1])); const de = Math.min(...es.map((e) => Math.hypot(e.x - c[0], e.z - c[1]))); const sc = (hid ? 12 : 0) + Math.min(de, 14) * 0.6 - Math.hypot(p.x - c[0], p.z - c[1]) * 0.35 + Math.random() * 2;
        if (sc > bs) { bs = sc; best = c; }
      }
      if (best) { if (b.home) r.taken.delete(b.home); b.home = best; r.taken.add(best); b.path = route(p.x, p.z, best[0], best[1]); }
      b.cool = t + 1.2;
    }
    const w = b.path && b.path[0];
    if (w && Math.hypot(w[0] - p.x, w[1] - p.z) < 0.4) b.path.shift(); else if (w) steer(p, w[0], w[1], b.sp, dt); else steer(p, p.x, p.z, 0, dt);
    unstick(p);
  }
  function spread(r) { // aynı hedefe koşan botlar üst üste binmesin
    const al = alive(r).filter((p) => !p.b?.fly);
    for (let i = 0; i < al.length; i++) for (let j = i + 1; j < al.length; j++) {
      const A = al[i]; const B = al[j]; if (!A.bot && !B.bot) continue;
      let dx = B.x - A.x; let dz = B.z - A.z; let d = Math.hypot(dx, dz); if (d >= 0.9) continue; if (d < 0.01) { dx = Math.random() - 0.5; dz = Math.random() - 0.5; d = Math.hypot(dx, dz) || 1; }
      const push = (0.9 - d) / d / (A.bot && B.bot ? 2 : 1); if (A.bot) { A.x -= dx * push; A.z -= dz * push; } if (B.bot) { B.x += dx * push; B.z += dz * push; }
    }
  }
  const BOT = { cubuk: botCubuk, zemin: botZemin, kosu: botKosu, kuyruk: botTag, bomba: botTag, sumo: botSumo, doner: botDoner, bayrak: botBayrak, renk: botRenk, lav: botLav, futbol: botFut, sakla: botSakla };
  const MODE_TICK = { kuyruk: (r) => { spread(r); tagTick(r); }, bomba: (r) => { spread(r); tagTick(r); }, sumo: sumoTick, doner: (r) => spread(r), bayrak: (r) => { spread(r); bayTick(r); }, renk: renkTick, futbol: (r, t, dt) => { spread(r); futTick(r, t, dt); }, sakla: saklaTick };

  function touch(r, i) { if (r.tiles.has(i)) return; const at = now() + (r.tileMs || TILE_MS); r.tiles.set(i, at); cast(r, 'k3:tile', [i, at]); }
  function win(r, p) { if (r.phase !== 'play' || r.mode !== 'kosu') return; cast(r, 'k3:ev', { t: 'fin', i: r.players.indexOf(p) }); finish(r, p); }

  function leave(r, uid) {
    const p = r.players.find((x) => x.uid === uid); if (!p) return;
    if (r.status === 'playing') { if (p.alive) elim(r, p); p.out = true; p.alive = false; p.uid = null; p.bot = true; p.name = `${p.name} (ayrıldı)`; }
    else r.players.splice(r.players.indexOf(p), 1);
    if (!humans(r).length) { clear(r); rooms.delete(r.id); } else { if (r.host === uid) r.host = humans(r)[0].uid; push(r); }
    lobby();
  }

  // ---- Lig: haftalık sezon (İstanbul saatiyle pazartesi başlar). Haftanın ilk üçü jeton kazanır. ----
  const DAYMS = 86400000; const TIERS = [['bronz', 'Bronz', 0], ['gumus', 'Gümüş', 30], ['altin', 'Altın', 80], ['elmas', 'Elmas', 160]]; const PRIZE = [75, 50, 25]; const DAYCAP = 80; // 1 jeton = 1 TL
  const weekId = (t = now()) => { const d = new Date(t + 3 * 3600000); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7))).toISOString().slice(0, 10); };
  const weekEnd = (id) => Date.parse(`${id}T00:00:00Z`) - 3 * 3600000 + 7 * DAYMS;
  const tierOf = (pts) => [...TIERS].reverse().find((t) => pts >= t[2]);
  function addSeason(uid, pts, won) { // dönen: bu oyundan yazılan puan (günlük sınır dolduysa 0)
    const w = weekId(); const id = `${w}:${uid}`; const day = new Date(now() + 3 * 3600000).toISOString().slice(0, 10);
    const o = store.get('kupa_season', id) || { id, week: w, uid, pts: 0, wins: 0, games: 0 }; const used = o.day === day ? o.dayPts || 0 : 0; const add = Math.max(0, Math.min(pts, DAYCAP - used));
    store.put('kupa_season', { ...o, pts: o.pts + add, wins: o.wins + (won ? 1 : 0), games: o.games + 1, day, dayPts: used + add, at: now() }); return add;
  }
  const board = (w) => store.filter('kupa_season', (x) => x.week === w && x.pts > 0).sort((a, b) => b.pts - a.pts || a.at - b.at);
  function settle() {
    const w = weekId(); const meta = store.get('kupa_meta', 'season');
    if (!meta) { store.put('kupa_meta', { id: 'season', week: w }); return; }
    if (meta.week === w) return;
    const top = board(meta.week).slice(0, 3);
    top.forEach((x, k) => { eco.addCoins(x.uid, PRIZE[k], 'kupa_season', { week: meta.week, place: k + 1 }); notify(x.uid, { type: 'order', text: `🏆 Parti Kupası liginde haftayı ${k + 1}. bitirdin! ${PRIZE[k]} jeton hesabında.`, url: '/#/oyunlar', tag: 'kupa-lig' }); });
    store.put('kupa_meta', { id: 'season', week: w, last: { week: meta.week, top: top.map((x) => ({ uid: x.uid, pts: x.pts })) } });
  }
  const tSeason = setInterval(() => { try { settle(); } catch (e) { console.error('[kupa] lig', e); } }, 5 * 60000); tSeason.unref?.(); try { settle(); } catch (e) { console.error('[kupa] lig', e); }
  const who = (uid) => { const u = store.get('users', uid); return u ? { id: u.id, username: u.username, avatar: u.avatar } : null; };
  app.get('/api/kupa/season', auth, (req, res) => {
    const w = weekId(); const all = board(w); const mine = store.get('kupa_season', `${w}:${req.user.id}`); const rank = all.findIndex((x) => x.uid === req.user.id);
    const pts = mine?.pts || 0; const tier = tierOf(pts); const next = TIERS[TIERS.indexOf(tier) + 1] || null; const last = store.get('kupa_meta', 'season')?.last;
    res.json({
      week: w, endsAt: weekEnd(w), prize: PRIZE, tiers: TIERS, dayCap: DAYCAP,
      me: { pts, wins: mine?.wins || 0, games: mine?.games || 0, rank: rank < 0 ? null : rank + 1, tier: tier[0], tierName: tier[1], next: next ? { name: next[1], at: next[2] } : null },
      top: all.slice(0, 20).map((x, k) => ({ rank: k + 1, user: who(x.uid), pts: x.pts, wins: x.wins, tier: tierOf(x.pts)[0], me: x.uid === req.user.id })).filter((x) => x.user),
      last: last ? last.top.map((x, k) => ({ rank: k + 1, user: who(x.uid), pts: x.pts })).filter((x) => x.user) : [],
    });
  });

  // ---- Uç noktalar ----
  const getR = (req, res) => { const r = rooms.get(req.params.id); if (!r) { res.status(404).json({ error: 'Oda bulunamadı. Oyun bitmiş olabilir.' }); return null; } return r; };
  app.get('/api/kupa', auth, (req, res) => {
    const cur = roomOfUser(req.user.id);
    res.json({
      current: cur ? cur.id : null, playing: [...rooms.values()].reduce((n, r) => n + (r.status === 'playing' ? humans(r).length : 0), 0),
      open: [...rooms.values()].filter((r) => r.pub && r.status === 'waiting' && r.players.length < MAXP).map((r) => ({ id: r.id, status: r.status, seats: r.players.map((p) => ({ name: p.name, avatar: p.avatar, bot: !!p.bot })) })),
    });
  });
  app.get('/api/kupa/wardrobe', auth, (req, res) => {
    const w = store.get('kupa_looks', req.user.id) || {};
    res.json({ ...LOOKS, owned: w.owned || [], ...lookOf(req.user.id), coins: store.get('users', req.user.id)?.coins || 0 });
  });
  app.post('/api/kupa/wardrobe', auth, (req, res) => {
    const id = String(req.body?.id || ''); if (!PRICE.has(id)) return res.status(404).json({ error: 'Kostüm bulunamadı.' });
    const w = store.get('kupa_looks', req.user.id) || { id: req.user.id, owned: [] };
    const price = PRICE.get(id); const owned = w.owned || [];
    if (price > 0 && !owned.includes(id)) {
      if (!req.body?.buy) return res.status(402).json({ error: 'Bu kostümü önce almalısın.', price });
      if (!eco.spend(req.user.id, price, 'kupa_look', { ref: id })) return res.status(402).json({ error: `Yeterli jetonun yok. Bu kostüm ${price} jeton.` });
      owned.push(id);
    }
    const slot = LOOKS.hats.some(([h]) => h === id) ? 'hat' : LOOKS.trails.some(([h]) => h === id) ? 'trail' : 'color';
    store.put('kupa_looks', { ...w, id: req.user.id, owned, [slot]: id });
    const r = roomOfUser(req.user.id); const p = r?.players.find((x) => x.uid === req.user.id); if (p) { p.look = lookOf(req.user.id); push(r); }
    res.json({ ...LOOKS, owned, ...lookOf(req.user.id), coins: store.get('users', req.user.id)?.coins || 0 });
  });
  app.post('/api/kupa', auth, (req, res) => {
    const u = req.user; const cur = roomOfUser(u.id); const want = req.body?.mode;
    if (cur) { if (want !== undefined && cur.host === u.id && cur.status === 'waiting') { cur.pick = TITLES[want] ? String(want) : null; push(cur); } return res.json({ id: cur.id }); }
    if (limited(`kupa:${u.id}`, 40, 3600000)) return res.status(429).json({ error: 'Biraz yavaş 🙂' });
    if (req.body?.quick) { const r = [...rooms.values()].find((x) => x.pub && x.status === 'waiting' && x.players.length < MAXP); if (r) { addHuman(r, u); push(r); lobby(); return res.json({ id: r.id }); } }
    const r = create(u, !!req.body?.quick, String(req.body?.mode || '')); lobby(); res.json({ id: r.id });
  });
  app.get('/api/kupa/:id', auth, (req, res) => { const r = getR(req, res); if (r) res.json(view(r, req.user.id)); });
  app.post('/api/kupa/:id/join', auth, (req, res) => {
    const r = getR(req, res); if (!r) return;
    if (idx(r, req.user.id) >= 0) return res.json(view(r, req.user.id));
    if (r.status === 'playing') return res.status(409).json({ error: 'Oyun başlamış. Bitince yeni oyuna katılabilirsin.' });
    if ((r.status === 'ended' ? humans(r).length : r.players.length) >= MAXP) return res.status(409).json({ error: 'Oda dolu.' }); // biten odada botlar sayılmaz: sıradaki oyunda yerlerini insanlar alır
    const other = roomOfUser(req.user.id); if (other) leave(other, req.user.id);
    addHuman(r, req.user); push(r); lobby(); res.json(view(r, req.user.id));
  });
  app.post('/api/kupa/:id/start', auth, (req, res) => {
    const r = getR(req, res); if (!r) return;
    if (r.host !== req.user.id) return res.status(403).json({ error: 'Oyunu odayı açan başlatır.' });
    if (r.status === 'playing') return res.status(409).json({ error: 'Oyun zaten sürüyor.' });
    if (r.status === 'ended') { r.players = r.players.filter((p) => p.uid); r.status = 'waiting'; }
    start(r); res.json(view(r, req.user.id));
  });
  app.post('/api/kupa/:id/opts', auth, (req, res) => { // oda sahibi: kupa (karışık üç tur) ya da tek bir oyun
    const r = getR(req, res); if (!r) return;
    if (r.host !== req.user.id) return res.status(403).json({ error: 'Oyunu odayı açan seçer.' });
    if (r.status === 'playing') return res.status(409).json({ error: 'Oyun sürerken değiştirilemez.' });
    const m = String(req.body?.mode || ''); r.pick = TITLES[m] ? m : null; push(r); res.json(view(r, req.user.id));
  });
  app.post('/api/kupa/:id/leave', auth, (req, res) => { const r = rooms.get(req.params.id); if (r) leave(r, req.user.id); res.json({ ok: true }); });
  app.post('/api/kupa/:id/invite', auth, (req, res) => {
    const r = getR(req, res); if (!r) return;
    if (idx(r, req.user.id) < 0) return res.status(403).json({ error: 'Önce odaya katıl.' });
    const to = store.get('users', String(req.body?.userId || ''));
    if (!to || isBlocked(req.user.id, to.id)) return res.status(404).json({ error: 'Kişi bulunamadı.' });
    if (limited(`kinv:${req.user.id}`, 25, 3600000)) return res.status(429).json({ error: 'Biraz yavaş 🙂' });
    notify(to.id, { type: 'game', fromId: req.user.id, text: `${req.user.username} seni Parti Kupası’na çağırıyor 🏆`, url: `/#/oyun/kupa/${r.id}`, tag: `kupa-${r.id}` });
    res.json({ ok: true });
  });

  // ---- Soket: anlık konum ve olaylar ----
  ctx.kupaSocket = (socket) => {
    const uid = socket.data.userId; let room = null; let me = null;
    const bind = (id) => { const r = rooms.get(id); const p = r?.players.find((x) => x.uid === uid); room = p ? r : null; me = p || null; return !!p; };
    socket.on('k3:join', ({ id } = {}) => { if (bind(id)) socket.join(`k3:${id}`); });
    const mute = () => { if (me?.voice) { me.voice = false; if (room) push(room); } };
    socket.on('k3:leave', ({ id } = {}) => { mute(); socket.leave(`k3:${id}`); room = null; me = null; });
    socket.on('disconnect', mute);
    // Sesli sohbet: odadaki insanlar birbirine doğrudan bağlanır (WebRTC); sunucu yalnızca el sıkışmayı taşır
    socket.on('k3:voice', (on) => { if (!room || !me || limited('k3v:' + uid, 20, 10000)) return; me.voice = !!on; push(room); });
    socket.on('k3:rtc', ({ to, data } = {}) => {
      if (!room || !me?.voice || typeof to !== 'string' || !data || limited('k3rtc:' + uid, 400, 10000)) return;
      const p = room.players.find((x) => x.uid === to); if (p?.voice && to !== uid) ctx.emitTo(to, 'k3:rtc', { from: uid, data });
    });
    socket.on('k3:s', (s) => {
      if (!room || !me || !me.alive || !Array.isArray(s)) return;
      const [x, y, z, ry, fl] = s.map(Number); if (![x, y, z, ry].every(Number.isFinite)) return;
      const n = now(); const d = Math.min(0.3, Math.max(0.05, (n - (me.seen || 0)) / 1000)); me.ex = (x - me.x) / d; me.ez = (z - me.z) / d; // top ve itişme için hız tahmini
      me.seen = n; me.x = x; me.y = y; me.z = z; me.ry = ry; me.fl = fl | 0; if (room.mode === 'kosu') me.prog = Math.max(0, Math.min(TRACK, -z));
    });
    socket.on('k3:out', () => { if (room && me && room.phase === 'play' && room.mode !== 'kosu' && room.mode !== 'sakla') { if (process.env.KUPA_DEBUG) console.log('[kupa] düştü', me.name, room.mode, me.x, me.y, me.z); const r = room; safe(r, () => elim(r, me)); } });
    socket.on('k3:hit', (i) => { // sumo: oyuncunun itişi bir bota değdi
      const q = room?.players[i]; const n = now();
      if (!q || !me?.alive || room.phase !== 'play' || room.mode !== 'sumo' || !q.alive || !q.bot || !q.b || q.b.fly || n - (me.hitAt || 0) < 400) return;
      const dx = q.x - me.x; const dz = q.z - me.z; const d = Math.hypot(dx, dz); if (d > 2.8 || d < 0.001) return;
      if (process.env.KUPA_DEBUG) console.log('[kupa] itiş', me.name, '→', q.name, d.toFixed(2));
      me.hitAt = n; q.b.vx += (dx / d) * 7.5; q.b.vz += (dz / d) * 7.5; q.b.push = 0.35; q.b.dash = 0;
    });
    socket.on('k3:tile', (i) => { if (room && me?.alive && room.phase === 'play' && room.mode === 'zemin' && room.hm.tiles[i]) touch(room, i); });
    const fin = () => {
      if (!room || !me?.alive || room.phase !== 'play') return;
      if (room.mode === 'kosu' && now() - room.playAt > 10000 && -me.z > TRACK - 6) win(room, me);
      else if (room.mode === 'lav' && now() - room.playAt > 12000 && me.y > LAV.n * LAV.step - 1.5) reach(room, me);
    };
    socket.on('k3:fin', () => { if (room) safe(room, fin); });
  };

  // Terk edilmiş odaları temizle
  setInterval(() => { for (const r of rooms.values()) if (!humans(r).length || now() - r.at > 3 * 3600000 || (r.status === 'ended' && now() - r.at > 20 * 60000 && !r.touch)) { clear(r); rooms.delete(r.id); } }, 5 * 60000).unref?.();
  console.log('[kupa] Parti Kupası hazır');
};
module.exports.internals = { SAK, SAK_WALLS, SG, segHits, route, sees }; // yerel denemeler için

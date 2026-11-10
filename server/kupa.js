// Parti Kupası (3D): üç turlu elemeli parti oyunu. Her kupada dokuz moddan üç tur çekilir.
// Oyuncu kendi karakterini cihazında hareket ettirir (konumunu soketle yollar); turlar, engellerin zamanı,
// elenmeler ve botlar sunucudadır. Engeller sunucu saatine göre hesaplandığından herkes aynı şeyi görür.
const { nanoid } = require('nanoid');

const MAXP = 8; const TICK = 100; const INTRO_MS = 5500; const RESULT_MS = 4500; const WAIT_MS = 12000;
// Her kupada üç tur çekilir: kalabalık tur → orta tur → final
// Futbol yalnızca ikinci turda: ilk turdan 6 kişi çıkar, 3'e 3 oynanır.
const POOL = [['cubuk', 'kuyruk', 'renk', 'bomba'], ['zemin', 'sumo', 'lav', 'renk', 'bomba', 'kuyruk', 'futbol', 'futbol'], ['kosu', 'sumo', 'lav', 'zemin']];
const TITLES = { cubuk: 'Dönen Çubuk', zemin: 'Zemin Çöküyor', kosu: 'Engelli Koşu', kuyruk: 'Kuyruk Kapmaca', sumo: 'Sumo', renk: 'Renk Zemini', lav: 'Lav Yükseliyor', futbol: 'Dev Top Futbolu', bomba: 'Bomba Elden Ele' };
const CAP = { cubuk: 75000, zemin: 60000, kosu: 100000, kuyruk: 45000, sumo: 90000, renk: 120000, lav: 85000, futbol: 75000, bomba: 110000 };
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
const TAG_R = 10; const SUMO = { r0: 9, r1: 1.4, rate: 0.11, from: 4 };
const sumoR = (t) => Math.max(SUMO.r1, SUMO.r0 - SUMO.rate * Math.max(0, t - SUMO.from));
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

// Altıgen zemin: eksenel koordinatlar → dünya konumu
const TILES = []; const TILE_AT = new Map();
for (let q = -RINGS; q <= RINGS; q++) for (let r = Math.max(-RINGS, -q - RINGS); r <= Math.min(RINGS, -q + RINGS); r++) { TILE_AT.set(`${q},${r}`, TILES.length); TILES.push({ q, r, x: HEX * Math.sqrt(3) * (q + r / 2), z: HEX * 1.5 * r }); }
const NB = TILES.map((t) => [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]].map(([dq, dr]) => TILE_AT.get(`${t.q + dq},${t.r + dr}`)).filter((i) => i !== undefined));

// Kostümler: lokumun lezzeti (renk) ve şapkası. Fiyat jeton; 0 = ücretsiz.
const LOOKS = {
  colors: [['gul', 'Gül', 0], ['limon', 'Limon', 0], ['fistik', 'Fıstık', 0], ['portakal', 'Portakal', 0], ['nar', 'Nar', 40], ['nane', 'Nane', 40], ['bogurtlen', 'Böğürtlen', 60], ['cikolata', 'Çikolata', 60], ['altin', 'Altın', 150]],
  hats: [['yok', 'Şapkasız', 0], ['parti', 'Parti şapkası', 50], ['fes', 'Fes', 80], ['kulaklik', 'Kulaklık', 80], ['tac', 'Taç', 120]],
};
const PRICE = new Map([...LOOKS.colors, ...LOOKS.hats].map(([id, , p]) => [id, p]));
const BOT_NAMES = ['Tarçın', 'Vişne', 'Sakız', 'Badem', 'Kaymak', 'Safran', 'Susam', 'Fındık', 'Ceviz', 'Damla'];
const rnd = (a, b) => a + Math.random() * (b - a); const pick = (a) => a[Math.floor(Math.random() * a.length)];
const r2 = (n) => Math.round(n * 100) / 100;

module.exports = function kupa(app, ctx) {
  const { store, auth, io, notify, limited, eco, isBlocked } = ctx;
  const rooms = new Map(); const now = () => Date.now();
  const firstName = (u) => String(u.name || u.username || 'Oyuncu').split(' ')[0].slice(0, 14);
  const lookOf = (uid) => { const w = store.get('kupa_looks', uid); return { color: w?.color || 'gul', hat: w?.hat || 'yok' }; };
  const humans = (r) => r.players.filter((p) => !p.bot);
  const alive = (r) => r.players.filter((p) => p.alive);
  const idx = (r, uid) => r.players.findIndex((p) => p.uid === uid);
  const roomOfUser = (uid) => [...rooms.values()].find((r) => r.status !== 'ended' && r.players.some((p) => p.uid === uid));

  function view(r, uid) {
    return {
      id: r.id, status: r.status, host: r.host === uid, pub: r.pub, me: idx(r, uid), max: MAXP, now: now(), startAt: r.startAt || null,
      players: r.players.map((p) => ({ name: p.name, avatar: p.avatar, bot: !!p.bot, look: p.look, alive: p.alive, out: p.out, place: p.place || null })),
      round: r.round, mode: r.mode || null, title: r.mode ? TITLES[r.mode] : null, phase: r.phase || null, playAt: r.playAt || null, keep: r.keep || null,
      conf: confOf(r), st: r.st || null,
      spawn: r.spawn || null, result: r.result || null,
    };
  }
  const confOf = (r) => {
    const m = r.mode;
    return m === 'cubuk' ? { r: ARENA_R, bars: BARS } : m === 'zemin' ? { rings: RINGS, hex: HEX, ms: TILE_MS, tiles: Object.fromEntries(r.tiles || []) } : m === 'kosu' ? { len: TRACK }
      : m === 'kuyruk' || m === 'bomba' ? { r: TAG_R, len: CAP[m] / 1000 } : m === 'sumo' ? SUMO : m === 'renk' ? { ...RENK, seed: r.rk.seed, cyc: r.rk.cyc } : m === 'lav' ? LAV : m === 'futbol' ? { ...FUT, len: CAP.futbol / 1000 } : null;
  };
  const push = (r) => r.players.forEach((p) => { if (p.uid) ctx.emitTo(p.uid, 'k3', view(r, p.uid)); });
  const cast = (r, ev, data) => io.to(`k3:${r.id}`).emit(ev, data);
  const lobby = () => io.to('play:lobby').emit('play:lobby', {});
  const clear = (r) => { clearTimeout(r.tm); clearInterval(r.iv); r.tm = null; r.iv = null; };

  function addHuman(r, u) { r.players.push({ uid: u.id, name: firstName(u), avatar: u.avatar, look: lookOf(u.id), alive: true, out: false, x: 0, y: 0, z: 0, ry: 0, fl: 0 }); }
  function create(u, pub) {
    const r = { id: nanoid(8), host: u.id, pub, status: 'waiting', players: [], round: 0, at: now() };
    addHuman(r, u); rooms.set(r.id, r);
    if (pub) { r.startAt = now() + WAIT_MS; r.tm = setTimeout(() => start(r), WAIT_MS); }
    return r;
  }

  // ---- Tur motoru ----
  function start(r) {
    if (r.status === 'playing' || !humans(r).length) return;
    clear(r); r.startAt = null;
    const used = new Set(r.players.map((p) => p.name));
    while (r.players.length < MAXP) {
      const n = BOT_NAMES.find((x) => !used.has(`${x} (bot)`)) || `Bot ${r.players.length}`; used.add(`${n} (bot)`);
      r.players.push({ bot: true, uid: null, name: `${n} (bot)`, avatar: '/img/eg/odul.svg', look: { color: pick(LOOKS.colors)[0], hat: Math.random() < 0.4 ? pick(LOOKS.hats)[0] : 'yok' } });
    }
    r.players.forEach((p) => { Object.assign(p, { alive: true, out: false, place: null, x: 0, y: 0, z: 0, ry: 0, fl: 0 }); if (p.uid) p.look = lookOf(p.uid); });
    r.status = 'playing'; r.round = 0; r.n0 = r.players.length; r.result = null; r.plan = draw();
    nextRound(r); lobby();
  }
  function nextRound(r) {
    clear(r); r.round++; r.mode = r.plan[r.round - 1];
    const cont = r.players.filter((p) => !p.out); const n = cont.length;
    r.keep = r.round === 1 ? Math.max(2, Math.ceil(r.n0 * (r.plan[1] === 'futbol' ? 0.75 : 0.6))) : r.round === 2 ? Math.max(2, Math.ceil(r.n0 * 0.35)) : 1;
    if (r.mode === 'futbol') r.keep = Math.ceil(n / 2); // kazanan takım tur atlar
    r.keep = Math.min(r.keep, Math.max(1, n - 1));
    Object.assign(r, { tiles: new Map(), result: null, finished: [], st: null, ball: null, rk: null, hit: null, ot: 0 });
    const free = TILES.map((_, i) => i).filter((i) => Math.abs(TILES[i].q) <= 3 && Math.abs(TILES[i].r) <= 3).sort(() => Math.random() - 0.5);
    const nb = [0, 0];
    cont.forEach((p, k) => {
      Object.assign(p, { alive: true, fl: 0, y: 0, b: null, prog: 0, cp: 0, tail: false, team: null, imm: 0, cd: 0, ex: 0, ez: 0 });
      const a = (Math.PI * 2 * k) / n; const B = p.bot; const m = r.mode;
      if (m === 'cubuk') { p.x = Math.cos(a) * 5.5; p.z = Math.sin(a) * 5.5; if (B) p.b = { a, r: rnd(3, 7), da: rnd(-0.12, 0.12), jt: -1, cool: [0, 0], hit: null }; }
      else if (m === 'zemin') { const ti = free[k % free.length]; p.x = TILES[ti].x; p.z = TILES[ti].z; if (B) p.b = { ti, mv: null, next: 0 }; }
      else if (m === 'kosu') { p.x = ((k % 4) - 1.5) * 1.7; p.z = 2.5 + Math.floor(k / 4) * 1.6; if (B) p.b = { lane: p.x, sp: rnd(5.0, 6.2), stall: 0, seen: -1, ph: rnd(0, 6) }; }
      else if (m === 'futbol') { p.team = k % 2; const row = Math.floor(k / 2); p.x = (row - (Math.ceil(n / 2) - 1) / 2) * 2.8; p.z = p.team ? -5.5 : 5.5; if (B) p.b = { vx: 0, vz: 0, role: ['kaleci', 'forvet', 'orta', 'forvet'][nb[p.team]++ % 4], aim: 0, aimAt: 0, pace: rnd(0.9, 1.1) }; } // her takımın ilk botu kaleci
      else if (m === 'renk') { p.x = ((k % 4) - 1.5) * 2.4; p.z = (Math.floor(k / 4) - 0.5) * 2.4; if (B) p.b = { vx: 0, vz: 0 }; }
      else if (m === 'lav') { const an = (-0.3 - 0.2 * Math.floor(k / 3)) * LAV.da; const rr = 4.7 + (k % 3) * 1.1; /* ilk basamağın önünde üçerli sıra */ p.x = Math.cos(an) * rr; p.z = Math.sin(an) * rr; if (B) p.b = { step: 0, hop: null, next: rnd(0.5, 1.6), sk: rnd(0.8, 1.4), hx: p.x, hz: p.z }; }
      else { const rad = m === 'sumo' ? 5.5 : 6; p.x = Math.cos(a) * rad; p.z = Math.sin(a) * rad; if (B) p.b = { vx: 0, vz: 0 }; }
    });
    if (r.mode === 'kuyruk') { cont.slice().sort(() => Math.random() - 0.5).slice(0, r.keep).forEach((p) => { p.tail = true; }); r.st = { tails: r.players.map((p, i) => (p.tail && !p.out ? i : -1)).filter((i) => i >= 0) }; }
    else if (r.mode === 'bomba') r.st = { bombs: [] };
    else if (r.mode === 'futbol') { r.st = { teams: Object.fromEntries(cont.map((p) => [r.players.indexOf(p), p.team])), score: [0, 0] }; r.ball = { x: 0, z: 0, vx: 0, vz: 0, fr: 0 }; }
    else if (r.mode === 'renk') { const cyc = []; let t = 2.5; for (let k = 0; k < 14; k++) { const th = Math.max(2, 4.2 - 0.22 * k); cyc.push([Math.floor(Math.random() * RENK.cols), r2(t), r2(t + th), r2(t + th + 2)]); t += th + 2.9; } r.rk = { seed: Math.floor(Math.random() * 1e9), cyc, done: -1 }; }
    r.players.filter((p) => p.out).forEach((p) => { p.alive = false; });
    r.spawn = Object.fromEntries(r.players.map((p, i) => [i, [r2(p.x), 0, r2(p.z)]]).filter(([i]) => !r.players[i].out));
    r.phase = 'intro'; r.playAt = now() + INTRO_MS; r.nextBomb = r.playAt + 1500; push(r);
    r.tm = setTimeout(() => { r.phase = 'play'; push(r); r.iv = setInterval(() => tick(r), TICK); }, INTRO_MS);
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
    // İzleyecek insan kalmadıysa bekletme: kupayı kalan botlardan biri alır
    if (!al.some((p) => !p.bot)) return finish(r, pick(al.length ? al : r.players));
    if (r.mode !== 'kosu' && al.length <= r.keep) endRound(r);
  }
  function endRound(r) {
    if (r.phase !== 'play') return;
    if (!alive(r).some((p) => !p.bot)) return finish(r, pick(alive(r).length ? alive(r) : r.players));
    clear(r); r.phase = 'result';
    const through = r.players.map((p, i) => (p.alive ? i : -1)).filter((i) => i >= 0);
    r.result = { through, round: r.round };
    push(r);
    r.tm = setTimeout(() => (through.length <= 1 || r.round >= 3 ? finish(r, r.players[through[0]]) : nextRound(r)), RESULT_MS);
  }
  function finish(r, winner) {
    clear(r);
    const rest = r.players.filter((p) => p !== winner && p.alive).sort((a, b) => (b.prog || 0) - (a.prog || 0));
    winner.place = 1; rest.forEach((p, k) => { p.place = 2 + k; });
    r.status = 'ended'; r.phase = 'final';
    r.result = { winner: r.players.indexOf(winner), order: r.players.map((p, i) => [p.place || 99, i]).sort((a, b) => a[0] - b[0]).map(([, i]) => i) };
    humans(r).forEach((p) => ctx.addXp?.(p.uid, 'oyun', p === winner ? 2 : 1));
    push(r); lobby();
  }

  // ---- Botlar ve tur akışı (10 Hz) ----
  function tick(r) {
    if (r.phase !== 'play') return;
    const t = (now() - r.playAt) / 1000; const dt = TICK / 1000;
    for (const p of r.players) {
      const b = p.b; if (!p.bot || !b) continue;
      if (b.fly) { p.x += b.fly[0] * dt; p.z += b.fly[2] * dt; b.fly[1] -= G * dt; p.y += b.fly[1] * dt; p.fl = 2; if (p.y < -12) p.b = null; continue; }
      if (!p.alive) continue;
      BOT[r.mode](r, p, b, t, dt); if (r.phase !== 'play') return;
    }
    MODE_TICK[r.mode]?.(r, t, dt);
    if (r.phase !== 'play') return;
    if (r.mode !== 'kosu') for (const p of alive(r)) { if (!p.bot && now() - Math.max(p.seen || 0, r.playAt) > 6000) { if (process.env.KUPA_DEBUG) console.log('[kupa] hareketsiz elendi', p.name, r.mode); elim(r, p); if (r.phase !== 'play') return; } }
    if (r.mode === 'zemin') { // çöken karonun üstündeki botlar düşer
      for (const p of alive(r)) { const b = p.b; if (!p.bot || !b || b.fly) continue; const on = b.mv && (now() - b.mv.t0) / b.mv.dur >= 0.5 ? b.mv.to : b.ti; const f = r.tiles.get(on); if (f && f <= now()) { b.fly = [0, -1, 0]; elim(r, p); if (r.phase !== 'play') return; } }
    }
    if (now() - r.playAt > CAP[r.mode]) { timeUp(r); if (r.phase !== 'play') return; }
    cast(r, 'k3:snap', [now(), r.players.map((p, i) => (p.alive || p.b?.fly ? [i, r2(p.x), r2(p.y), r2(p.z), r2(p.ry), p.fl || 0] : null)).filter(Boolean), r.ball ? [r2(r.ball.x), r2(r.ball.z), r2(r.ball.vx), r2(r.ball.vz)] : 0]);
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
    const n = now();
    if (b.mv) {
      const k = Math.min(1, (n - b.mv.t0) / b.mv.dur); const A = TILES[b.mv.from]; const B = TILES[b.mv.to];
      p.x = A.x + (B.x - A.x) * k; p.z = A.z + (B.z - A.z) * k; p.y = Math.sin(k * Math.PI) * 0.7; p.fl = 1; p.ry = Math.atan2(B.x - A.x, B.z - A.z);
      if (k >= 1) { b.ti = b.mv.to; b.mv = null; p.y = 0; p.fl = 0; touch(r, b.ti); b.next = n + rnd(900, 1500); }
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
    if (r.mode === 'futbol') { const [a, b] = r.st.score; if (a === b && !r.ot) { r.ot = now(); r.st.ot = 1; cast(r, 'k3:ev', { t: 'ot' }); return; } if (a === b && now() - r.ot < 30000) return; return futEnd(r); }
    if (r.round >= 3 && alive(r).length > 1) { // finalde tek kazanan: sumoda merkeze en yakın, diğerlerinde kura
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
      st.bombs = al.slice().sort(() => Math.random() - 0.5).slice(0, al.length > 5 ? 2 : 1).map((p) => [r.players.indexOf(p), Math.round(n + rnd(11000, 17000)), n + 1200]);
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
    if (kuy ? !mine : mine) { const tg = nearest(p, kuy ? hs.filter((q) => q !== p) : can.length ? can : free); if (tg) return steer(p, tg[0].x, tg[0].z, kuy ? 6.1 : 6.6, dt, TAG_R - 0.6); } // kuyruksuz / bombalı kovalar
    else { const th = nearest(p, kuy ? free : hs); if (th && th[1] < 7) return fleeFrom(p, th[0], 6, dt, TAG_R); }
    if (!b.w || t > b.w[2]) b.w = [rnd(-6, 6), rnd(-6, 6), t + rnd(1.5, 3)];
    steer(p, b.w[0], b.w[1], 3.5, dt, TAG_R - 0.6);
  }

  // ---- Sumo: daralan platformda itişme ----
  function botSumo(r, p, b, t, dt) {
    const R = sumoR(t); const rr = Math.hypot(p.x, p.z);
    if (b.push > 0) { b.push -= dt; p.x += b.vx * dt; p.z += b.vz * dt; b.vx *= 1 - 1.2 * dt; b.vz *= 1 - 1.2 * dt; p.fl = 0; }
    else if (b.dash > 0) { b.dash -= dt; p.x += b.vx * dt; p.z += b.vz * dt; p.fl = 3; }
    else {
      const tg = nearest(p, others(r, p));
      if (rr > R - 1.7 || !tg) steer(p, 0, 0, 5.6, dt); // kenardan uzak dur
      else if (tg[1] < 2.3 && t > (b.cd || 0) && Math.hypot(tg[0].x, tg[0].z) > rr - 0.5) { const dx = tg[0].x - p.x; const dz = tg[0].z - p.z; b.vx = (dx / tg[1]) * 12; b.vz = (dz / tg[1]) * 12; b.dash = 0.22; b.cd = t + rnd(1.4, 2.6); p.ry = Math.atan2(dx, dz); p.fl = 3; }
      else steer(p, tg[0].x, tg[0].z, 5.3, dt);
    }
    if (Math.hypot(p.x, p.z) > R + 0.35) { b.fly = [b.vx * 0.6, 0, b.vz * 0.6]; elim(r, p); }
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
    const B = r.ball; const gz = p.team ? FUT.hz : -FUT.hz; const own = -gz; let tx; let tz; let sp = 5.6; // gz: hücum edilen kale, own: kendi kalesi
    if (t > b.aimAt) { b.aim = rnd(-FUT.goal * 0.6, FUT.goal * 0.6); b.aimAt = t + rnd(1.5, 2.6); } // her seferinde kalenin başka köşesine nişan alır
    const dBall = Math.hypot(B.x - p.x, B.z - p.z); const inOwnHalf = (B.z - 0) * Math.sign(own) > 0;
    const chase = () => { // topun arkasına geç, sonra kaleye sür
      let gx = b.aim - B.x; let gq = gz - B.z; const gl = Math.hypot(gx, gq) || 1; gx /= gl; gq /= gl; const bx = B.x - gx * 1.9; const bz = B.z - gq * 1.9;
      const stuck = Math.abs(bx) > FUT.hx - 0.7 || Math.abs(bz) > FUT.hz - 0.7; // top duvar dibinde: arkasına geçilemez, doğrudan üstüne git
      if (stuck || ((p.x - B.x) * gx + (p.z - B.z) * gq < -0.4 && Math.hypot(p.x - bx, p.z - bz) < 2.4)) { tx = B.x + gx * 2; tz = B.z + gq * 2; } else { tx = bx; tz = bz; }
    };
    if (b.role === 'kaleci') { sp = 4.2; if (dBall < 3.4 && Math.abs(B.z - own) < 6) chase(); else { tx = Math.max(-FUT.goal, Math.min(FUT.goal, B.x * 0.45)); tz = own * 0.86; } }
    else if (b.role === 'orta' && !inOwnHalf && dBall > 5) { sp = 5; tx = B.x * 0.6; tz = B.z + (own - B.z) * 0.45; } // top rakip yarıdayken geride bekler
    else chase();
    steer(p, tx, tz, sp * (b.pace || 1), dt); p.x = Math.max(-FUT.hx + 0.4, Math.min(FUT.hx - 0.4, p.x)); p.z = Math.max(-FUT.hz + 0.4, Math.min(FUT.hz - 0.4, p.z));
  }
  function futTick(r, t, dt) {
    const B = r.ball; if (now() < B.fr) return; const min = FUT.br + 0.5;
    for (let q = 0; q < 2; q++) {
      const h = dt / 2; let ix = 0; let iz = 0; let cx = 0; let cz = 0; let n = 0; let tm = 0; // aynı anda değen herkesin itişi birlikte hesaplanır (sıraya göre taraf tutmaz)
      for (const p of alive(r)) {
        const dx = B.x - p.x; const dz = B.z - p.z; const d = Math.hypot(dx, dz); if (d >= min || d < 0.001 || p.y > 1.6) continue;
        const [vx, vz] = vel(p); const nx = dx / d; const nz = dz / d; const rel = (vx - B.vx) * nx + (vz - B.vz) * nz;
        if (rel > 0) { ix += nx * rel * FUT.k + vx * FUT.c; iz += nz * rel * FUT.k + vz * FUT.c; }
        cx += p.x + nx * min; cz += p.z + nz * min; n++; tm |= 1 << p.team;
      }
      if (n) { B.vx += ix; B.vz += iz; B.x = cx / n; B.z = cz / n; }
      if (tm === 3 && now() > (B.loose || 0)) { B.loose = now() + 700; B.vx += rnd(-2.5, 2.5); B.vz += (Math.random() < 0.5 ? -1 : 1) * rnd(5, 8); } // iki takım arasında sıkışan top bir yana fırlar
      const sp = Math.hypot(B.vx, B.vz); if (sp > FUT.vmax) { B.vx *= FUT.vmax / sp; B.vz *= FUT.vmax / sp; }
      B.x += B.vx * h; B.z += B.vz * h; B.vx *= FUT.fr; B.vz *= FUT.fr;
      if (Math.abs(B.x) > FUT.hx - FUT.br) { B.x = Math.sign(B.x) * (FUT.hx - FUT.br); B.vx *= -FUT.wall; }
      if (Math.abs(B.z) > FUT.hz - FUT.br) {
        if (Math.abs(B.x) < FUT.goal - 0.2) { if (Math.abs(B.z) > FUT.hz + 0.3) return goal(r, B.z < 0 ? 0 : 1); }
        else { B.z = Math.sign(B.z) * (FUT.hz - FUT.br); B.vz *= -FUT.wall; }
      }
    }
  }
  function goal(r, team) {
    r.st.score[team]++; Object.assign(r.ball, { x: 0, z: 0, vx: 0, vz: 0, fr: now() + 2200 });
    alive(r).forEach((p) => { const sp = r.spawn[r.players.indexOf(p)]; if (p.bot && p.b && sp) { p.x = sp[0]; p.z = sp[2]; p.b.vx = 0; p.b.vz = 0; } }); // santra: herkes yerine
    cast(r, 'k3:ev', { t: 'goal', team, s: r.st.score }); if (r.ot) futEnd(r);
  }
  function futEnd(r) { const [a, b] = r.st.score; const lose = a === b ? (Math.random() < 0.5 ? 0 : 1) : a > b ? 1 : 0; drop(r, alive(r).filter((p) => p.team === lose)); endRound(r); }
  function spread(r) { // aynı hedefe koşan botlar üst üste binmesin
    const al = alive(r).filter((p) => !p.b?.fly);
    for (let i = 0; i < al.length; i++) for (let j = i + 1; j < al.length; j++) {
      const A = al[i]; const B = al[j]; if (!A.bot && !B.bot) continue;
      let dx = B.x - A.x; let dz = B.z - A.z; let d = Math.hypot(dx, dz); if (d >= 0.9) continue; if (d < 0.01) { dx = Math.random() - 0.5; dz = Math.random() - 0.5; d = Math.hypot(dx, dz) || 1; }
      const push = (0.9 - d) / d / (A.bot && B.bot ? 2 : 1); if (A.bot) { A.x -= dx * push; A.z -= dz * push; } if (B.bot) { B.x += dx * push; B.z += dz * push; }
    }
  }
  const BOT = { cubuk: botCubuk, zemin: botZemin, kosu: botKosu, kuyruk: botTag, bomba: botTag, sumo: botSumo, renk: botRenk, lav: botLav, futbol: botFut };
  const MODE_TICK = { kuyruk: (r) => { spread(r); tagTick(r); }, bomba: (r) => { spread(r); tagTick(r); }, sumo: sumoTick, renk: renkTick, futbol: (r, t, dt) => { spread(r); futTick(r, t, dt); } };

  function touch(r, i) { if (r.tiles.has(i)) return; const at = now() + TILE_MS; r.tiles.set(i, at); cast(r, 'k3:tile', [i, at]); }
  function win(r, p) { if (r.phase !== 'play' || r.mode !== 'kosu') return; cast(r, 'k3:ev', { t: 'fin', i: r.players.indexOf(p) }); finish(r, p); }

  function leave(r, uid) {
    const p = r.players.find((x) => x.uid === uid); if (!p) return;
    if (r.status === 'playing') { if (p.alive) elim(r, p); p.out = true; p.alive = false; p.uid = null; p.bot = true; p.name = `${p.name} (ayrıldı)`; }
    else r.players.splice(r.players.indexOf(p), 1);
    if (!humans(r).length) { clear(r); rooms.delete(r.id); } else { if (r.host === uid) r.host = humans(r)[0].uid; push(r); }
    lobby();
  }

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
    const isHat = LOOKS.hats.some(([h]) => h === id);
    store.put('kupa_looks', { ...w, id: req.user.id, owned, [isHat ? 'hat' : 'color']: id });
    const r = roomOfUser(req.user.id); const p = r?.players.find((x) => x.uid === req.user.id); if (p) { p.look = lookOf(req.user.id); push(r); }
    res.json({ ...LOOKS, owned, ...lookOf(req.user.id), coins: store.get('users', req.user.id)?.coins || 0 });
  });
  app.post('/api/kupa', auth, (req, res) => {
    const u = req.user; const cur = roomOfUser(u.id); if (cur) return res.json({ id: cur.id });
    if (limited(`kupa:${u.id}`, 40, 3600000)) return res.status(429).json({ error: 'Biraz yavaş 🙂' });
    if (req.body?.quick) { const r = [...rooms.values()].find((x) => x.pub && x.status === 'waiting' && x.players.length < MAXP); if (r) { addHuman(r, u); push(r); lobby(); return res.json({ id: r.id }); } }
    const r = create(u, !!req.body?.quick); lobby(); res.json({ id: r.id });
  });
  app.get('/api/kupa/:id', auth, (req, res) => { const r = getR(req, res); if (r) res.json(view(r, req.user.id)); });
  app.post('/api/kupa/:id/join', auth, (req, res) => {
    const r = getR(req, res); if (!r) return;
    if (idx(r, req.user.id) >= 0) return res.json(view(r, req.user.id));
    if (r.status !== 'waiting') return res.status(409).json({ error: 'Oyun başlamış. Bitince yeni oyuna katılabilirsin.' });
    if (r.players.length >= MAXP) return res.status(409).json({ error: 'Oda dolu.' });
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
    socket.on('k3:leave', ({ id } = {}) => { socket.leave(`k3:${id}`); room = null; me = null; });
    socket.on('k3:s', (s) => {
      if (!room || !me || !me.alive || !Array.isArray(s)) return;
      const [x, y, z, ry, fl] = s.map(Number); if (![x, y, z, ry].every(Number.isFinite)) return;
      const n = now(); const d = Math.min(0.3, Math.max(0.05, (n - (me.seen || 0)) / 1000)); me.ex = (x - me.x) / d; me.ez = (z - me.z) / d; // top ve itişme için hız tahmini
      me.seen = n; me.x = x; me.y = y; me.z = z; me.ry = ry; me.fl = fl | 0; if (room.mode === 'kosu') me.prog = Math.max(0, Math.min(TRACK, -z));
    });
    socket.on('k3:out', () => { if (room && me && room.phase === 'play' && room.mode !== 'kosu') { if (process.env.KUPA_DEBUG) console.log('[kupa] düştü', me.name, room.mode, me.x, me.y, me.z); elim(room, me); } });
    socket.on('k3:hit', (i) => { // sumo: oyuncunun itişi bir bota değdi
      const q = room?.players[i]; const n = now();
      if (!q || !me?.alive || room.phase !== 'play' || room.mode !== 'sumo' || !q.alive || !q.bot || !q.b || q.b.fly || n - (me.hitAt || 0) < 400) return;
      const dx = q.x - me.x; const dz = q.z - me.z; const d = Math.hypot(dx, dz); if (d > 2.8 || d < 0.001) return;
      if (process.env.KUPA_DEBUG) console.log('[kupa] itiş', me.name, '→', q.name, d.toFixed(2));
      me.hitAt = n; q.b.vx += (dx / d) * 7.5; q.b.vz += (dz / d) * 7.5; q.b.push = 0.35; q.b.dash = 0;
    });
    socket.on('k3:tile', (i) => { if (room && me?.alive && room.phase === 'play' && room.mode === 'zemin' && TILES[i]) touch(room, i); });
    socket.on('k3:fin', () => {
      if (!room || !me?.alive || room.phase !== 'play') return;
      if (room.mode === 'kosu' && now() - room.playAt > 10000 && -me.z > TRACK - 6) win(room, me);
      else if (room.mode === 'lav' && now() - room.playAt > 12000 && me.y > LAV.n * LAV.step - 1.5) reach(room, me);
    });
  };

  // Terk edilmiş odaları temizle
  setInterval(() => { for (const r of rooms.values()) if (!humans(r).length || now() - r.at > 3 * 3600000 || (r.status === 'ended' && now() - r.at > 20 * 60000 && !r.touch)) { clear(r); rooms.delete(r.id); } }, 5 * 60000).unref?.();
  console.log('[kupa] Parti Kupası hazır');
};

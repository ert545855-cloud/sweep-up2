// Parti Kupası (3D): üç turlu elemeli parti oyunu. Dönen Çubuk → Zemin Çöküyor → Engelli Koşu.
// Oyuncu kendi karakterini cihazında hareket ettirir (konumunu soketle yollar); turlar, engellerin zamanı,
// elenmeler ve botlar sunucudadır. Engeller sunucu saatine göre hesaplandığından herkes aynı şeyi görür.
const { nanoid } = require('nanoid');

const MAXP = 8; const TICK = 100; const INTRO_MS = 5500; const RESULT_MS = 4500; const WAIT_MS = 12000;
const MODES = ['cubuk', 'zemin', 'kosu'];
const TITLES = { cubuk: 'Dönen Çubuk', zemin: 'Zemin Çöküyor', kosu: 'Engelli Koşu' };
const CAP = { cubuk: 75000, zemin: 60000, kosu: 100000 };
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
      conf: r.mode === 'cubuk' ? { r: ARENA_R, bars: BARS } : r.mode === 'zemin' ? { rings: RINGS, hex: HEX, ms: TILE_MS, tiles: Object.fromEntries(r.tiles || []) } : r.mode === 'kosu' ? { len: TRACK } : null,
      spawn: r.spawn || null, result: r.result || null,
    };
  }
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
    r.status = 'playing'; r.round = 0; r.n0 = r.players.length; r.result = null;
    nextRound(r); lobby();
  }
  function nextRound(r) {
    clear(r); r.round++; r.mode = MODES[r.round - 1];
    const cont = r.players.filter((p) => !p.out);
    r.keep = r.round === 1 ? Math.max(2, Math.ceil(r.n0 * 0.6)) : r.round === 2 ? Math.max(2, Math.ceil(r.n0 * 0.35)) : 1;
    r.tiles = new Map(); r.result = null; r.finished = [];
    const free = TILES.map((_, i) => i).filter((i) => Math.abs(TILES[i].q) <= 3 && Math.abs(TILES[i].r) <= 3).sort(() => Math.random() - 0.5);
    cont.forEach((p, k) => {
      p.alive = true; p.fl = 0; p.y = 0; p.b = null; p.prog = 0; p.cp = 0;
      if (r.mode === 'cubuk') { const a = (Math.PI * 2 * k) / cont.length; p.x = Math.cos(a) * 5.5; p.z = Math.sin(a) * 5.5; if (p.bot) p.b = { a, r: rnd(3, 7), da: rnd(-0.12, 0.12), jt: -1, cool: [0, 0], hit: null }; }
      else if (r.mode === 'zemin') { const ti = free[k % free.length]; p.x = TILES[ti].x; p.z = TILES[ti].z; if (p.bot) p.b = { ti, mv: null, next: 0 }; }
      else { p.x = ((k % 4) - 1.5) * 1.7; p.z = 2.5 + Math.floor(k / 4) * 1.6; if (p.bot) p.b = { lane: p.x, sp: rnd(5.0, 6.2), stall: 0, seen: -1, ph: rnd(0, 6) }; }
    });
    r.players.filter((p) => p.out).forEach((p) => { p.alive = false; });
    r.spawn = Object.fromEntries(r.players.map((p, i) => [i, [r2(p.x), 0, r2(p.z)]]).filter(([i]) => !r.players[i].out));
    r.phase = 'intro'; r.playAt = now() + INTRO_MS; push(r);
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
      if (r.mode === 'cubuk') botCubuk(r, p, b, t, dt); else if (r.mode === 'zemin') botZemin(r, p, b); else botKosu(r, p, b, t, dt);
    }
    if (r.phase !== 'play') return;
    if (r.mode !== 'kosu') for (const p of alive(r)) { if (!p.bot && now() - Math.max(p.seen || 0, r.playAt) > 6000) { if (process.env.KUPA_DEBUG) console.log('[kupa] hareketsiz elendi', p.name, r.mode); elim(r, p); if (r.phase !== 'play') return; } }
    if (r.mode === 'zemin') { // çöken karonun üstündeki botlar düşer
      for (const p of alive(r)) { const b = p.b; if (!p.bot || !b || b.fly) continue; const on = b.mv && (now() - b.mv.t0) / b.mv.dur >= 0.5 ? b.mv.to : b.ti; const f = r.tiles.get(on); if (f && f <= now()) { b.fly = [0, -1, 0]; elim(r, p); if (r.phase !== 'play') return; } }
    }
    if (now() - r.playAt > CAP[r.mode]) { // süre doldu
      if (r.mode === 'kosu') return finish(r, alive(r).sort((a, b) => (b.prog || 0) - (a.prog || 0))[0]);
      return endRound(r);
    }
    cast(r, 'k3:snap', [now(), r.players.map((p, i) => (p.alive || p.b?.fly ? [i, r2(p.x), r2(p.y), r2(p.z), r2(p.ry), p.fl || 0] : null)).filter(Boolean)]);
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
      me.seen = now(); me.x = x; me.y = y; me.z = z; me.ry = ry; me.fl = fl ? 1 : 0; if (room.mode === 'kosu') me.prog = Math.max(0, Math.min(TRACK, -z));
    });
    socket.on('k3:out', () => { if (room && me && room.phase === 'play' && room.mode !== 'kosu') { if (process.env.KUPA_DEBUG) console.log('[kupa] düştü', me.name, room.mode, me.x, me.y, me.z); elim(room, me); } });
    socket.on('k3:tile', (i) => { if (room && me?.alive && room.phase === 'play' && room.mode === 'zemin' && TILES[i]) touch(room, i); });
    socket.on('k3:fin', () => { if (room && me?.alive && room.mode === 'kosu' && room.phase === 'play' && now() - room.playAt > 10000 && -me.z > TRACK - 6) win(room, me); });
  };

  // Terk edilmiş odaları temizle
  setInterval(() => { for (const r of rooms.values()) if (!humans(r).length || now() - r.at > 3 * 3600000 || (r.status === 'ended' && now() - r.at > 20 * 60000 && !r.touch)) { clear(r); rooms.delete(r.id); } }, 5 * 60000).unref?.();
  console.log('[kupa] Parti Kupası hazır');
};

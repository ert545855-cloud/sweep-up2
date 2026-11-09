// Oyun altyapısı: masa / oda yönetimi, koltuklar, botlar, sıra zamanlayıcısı, sohbet, davet, lobi.
// Her oyun server/play/<oyun>.js içinde kit.register({...}) ile kurallarını tanımlar.
const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');

const now = () => Date.now();
const BOT_NAMES = ['Ayla', 'Kerem', 'Defne', 'Emir', 'Zeynep', 'Mert', 'Elif', 'Can', 'Selin', 'Arda', 'Naz', 'Deniz', 'Ece', 'Bora', 'Lale', 'Kaan'];

module.exports = function playkit(app, ctx) {
  const { auth, emitTo, io, limited, notify, store } = ctx;
  const SPECIAL = new Set(['falci', 'official']);
  const defs = new Map();
  const tables = new Map();

  const seatOf = (t, uid) => t.seats.findIndex((s) => s && s.uid === uid);
  const humans = (t) => t.seats.filter((s) => s && !s.bot);
  const filled = (t) => t.seats.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
  const firstName = (u) => String(u.name || u.username || '').split(' ')[0] || u.username;
  const botSeat = (t) => {
    const used = new Set(t.seats.filter(Boolean).map((s) => s.name));
    const name = BOT_NAMES.find((n) => !used.has(`${n} (bot)`)) || `Bot ${t.seats.length}`;
    return { bot: true, uid: `bot_${nanoid(6)}`, name: `${name} (bot)`, avatar: `/img/eg/${defs.get(t.game)?.icon || 'oyun'}.svg` };
  };
  const log = (t, text) => { if (!text) return; t.log.push({ text, at: now() }); if (t.log.length > 40) t.log.shift(); };
  const say = (t, m) => { t.chat.push({ id: nanoid(6), at: now(), ...m }); if (t.chat.length > 80) t.chat.shift(); };

  function view(t, uid) {
    const d = defs.get(t.game); const me = seatOf(t, uid);
    let extra = {};
    if (t.g && d.view) { try { extra = d.view(t, me, uid) || {}; } catch (e) { console.error('[play view]', t.game, e); } }
    return {
      id: t.id, game: t.game, status: t.status, host: t.host === uid, private: t.private, me, size: t.size, round: t.round || 0,
      seats: t.seats.map((s, i) => (s ? { name: s.name, avatar: s.avatar, bot: !!s.bot, uid: s.bot ? null : s.uid, score: t.scores[i] || 0, afk: !!s.afk } : null)),
      turn: t.turn ?? null, deadline: t.deadline || null, turnMs: t.turnMs || null, chat: t.chat.slice(-50), log: t.log.slice(-8), result: t.result || null, ...extra,
    };
  }
  function push(t) {
    t.seats.forEach((s) => { if (s && !s.bot) emitTo(s.uid, 'play', view(t, s.uid)); });
    io.to('play:lobby').emit('play:lobby', { game: t.game });
  }
  const after = (t, ms, fn) => { const h = setTimeout(() => { t.timers.delete(h); try { fn(); } catch (e) { console.error('[play timer]', t.game, e); } }, ms); t.timers.add(h); return h; };
  const clearTimers = (t) => { clearTimeout(t.timer); t.timers.forEach(clearTimeout); t.timers.clear(); };

  // Sıralı oyunlar: kimin sırası, bot mu, süre
  function settle(t) {
    clearTimeout(t.timer);
    if (t.status !== 'playing') { push(t); return; }
    const d = defs.get(t.game);
    const seat = d.turn ? d.turn(t) : null;
    t.turn = seat;
    if (seat == null || seat < 0) { t.deadline = t.g?.deadline || null; t.turnMs = t.g?.phaseMs || null; push(t); return; }
    const s = t.seats[seat];
    if (!s) { t.deadline = null; push(t); return; }
    if (s.bot || s.afk) {
      t.deadline = null;
      const ms = d.botDelay ? d.botDelay(t, seat) : 700 + Math.random() * 900;
      t.timer = setTimeout(() => runBot(t, seat, false), s.afk ? Math.min(ms, 600) : ms);
    } else {
      const ms = (typeof d.turnMs === 'function' ? d.turnMs(t, seat) : d.turnMs) || 30000;
      t.deadline = now() + ms; t.turnMs = ms;
      t.timer = setTimeout(() => {
        s.miss = (s.miss || 0) + 1;
        if (s.miss >= 2 && !s.afk) { s.afk = true; log(t, `${s.name} uzun süre oynamadı, yerine bot oynuyor.`); }
        runBot(t, seat, true);
      }, ms);
    }
    push(t);
  }
  function runBot(t, seat, timeout) {
    if (t.status !== 'playing') return;
    const d = defs.get(t.game);
    if ((d.turn ? d.turn(t) : null) !== seat) { settle(t); return; }
    let body = null;
    try { body = timeout && d.timeout ? d.timeout(t, seat) : d.bot(t, seat); } catch (e) { console.error('[play bot]', t.game, e); }
    let err = body ? applyMove(t, seat, body, true) : 'hamle yok';
    if (err) {
      console.error('[play bot hamlesi]', t.game, err, JSON.stringify(body || {}).slice(0, 200));
      const fb = d.fallback ? d.fallback(t, seat) : null;
      err = fb ? applyMove(t, seat, fb, true) : err;
      if (err) settle(t);
    }
  }
  function applyMove(t, seat, body, fromBot) {
    const d = defs.get(t.game);
    let err;
    try { err = d.move(t, seat, body || {}, { bot: !!fromBot }); } catch (e) { console.error('[play move]', t.game, e); err = 'Hamle yapılamadı.'; }
    if (err) return err;
    if (t.g?.over) finish(t); else settle(t);
    return null;
  }
  function finish(t) {
    clearTimers(t);
    const o = t.g.over;
    t.status = 'ended'; t.deadline = null; t.turn = null;
    Object.entries(o.points || {}).forEach(([i, p]) => { t.scores[i] = (t.scores[i] || 0) + p; });
    t.result = { winners: o.winners || [], text: o.text || '', detail: o.detail || null };
    t.seats.forEach((s, i) => { if (s && !s.bot) ctx.addXp?.(s.uid, 'oyun', (o.winners || []).includes(i) ? 2 : 1); });
    log(t, o.text);
    push(t);
  }
  function deal(t) {
    const d = defs.get(t.game);
    clearTimers(t);
    t.round = (t.round || 0) + 1; t.status = 'playing'; t.result = null; t.g = {};
    t.seats.forEach((s) => { if (s) { s.miss = 0; if (!s.bot) s.afk = false; } });
    d.setup(t);
    if (t.g.over) finish(t); else settle(t);
  }
  // Oyunun kendi aşama zamanlayıcıları için (parti oyunları)
  const kit = {
    register(def) { defs.set(def.key, def); },
    push, after, log, say, settle, seatOf, humans, filled, now,
    end(t, over) { t.g.over = over; finish(t); },
    nameOf: (t, i) => t.seats[i]?.name || '',
    ms: (x) => Math.round(x * (+process.env.PLAY_SPEED || 1)), // test için hızlandırma
    shuffle: (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    ctx,
  };

  const canPlay = (u) => u && !SPECIAL.has(u.role);
  const mineOf = (uid, game) => [...tables.values()].find((t) => t.game === game && seatOf(t, uid) >= 0);
  function createTable(game, u, opts = {}) {
    const d = defs.get(game);
    const size = Math.max(d.min, Math.min(d.max, parseInt(opts.size, 10) || d.size || d.max));
    const t = { id: nanoid(8), game, host: u.id, private: !!opts.private, status: 'waiting', size, seats: new Array(size).fill(null), scores: {}, chat: [], log: [], timers: new Set(), at: now(), opts: d.opts ? d.opts(opts) : {} };
    t.seats[0] = { uid: u.id, name: firstName(u), avatar: u.avatar };
    tables.set(t.id, t);
    say(t, { sys: true, text: `${t.seats[0].name} ${d.party ? 'odayı' : 'masayı'} açtı.` });
    return t;
  }
  function sitDown(t, u) {
    const d = defs.get(t.game);
    if (seatOf(t, u.id) >= 0) return null;
    let i = t.seats.findIndex((s) => !s);
    if (i < 0 && t.status === 'playing' && d.bots && !d.party) i = t.seats.findIndex((s) => s?.bot);
    if (i < 0) return d.party ? 'Oda dolu.' : 'Masa dolu.';
    const prev = t.seats[i];
    if (t.status === 'playing' && !prev && d.lateJoin === false) return 'Oyun başladı, bitince katılabilirsin.';
    t.seats[i] = { uid: u.id, name: firstName(u), avatar: u.avatar };
    say(t, { sys: true, text: `${t.seats[i].name} ${prev ? `${prev.name} yerine geçti` : 'katıldı'}.` });
    if (t.status === 'playing' && d.join) d.join(t, i);
    if (t.status === 'waiting' && !d.party && humans(t).length === t.size) deal(t);
    return null;
  }
  function leave(t, uid) {
    const d = defs.get(t.game);
    const i = seatOf(t, uid); if (i < 0) return;
    const name = t.seats[i].name;
    if (t.status === 'playing' && d.bots && !d.party) t.seats[i] = { ...botSeat(t), name: `${name} → bot` };
    else { t.seats[i] = null; if (t.status === 'playing' && d.leave) d.leave(t, i); }
    say(t, { sys: true, text: `${name} ayrıldı.` });
    if (!humans(t).length) { clearTimers(t); tables.delete(t.id); io.to('play:lobby').emit('play:lobby', { game: t.game }); return; }
    if (t.host === uid) t.host = humans(t)[0].uid;
    if (t.status === 'playing') {
      if (d.party && t.g && filled(t).length < (d.minPlay || d.min)) { kit.end(t, { winners: [], text: 'Oyuncu sayısı azaldı, oyun bitti.' }); return; }
      if (!d.party && t.turn === i) settle(t);
    }
    push(t);
  }
  const lobbyOut = (t) => ({ id: t.id, game: t.game, status: t.status, size: t.size, seats: t.seats.map((s) => (s ? { name: s.name, avatar: s.avatar, bot: !!s.bot } : null)), at: t.at });

  // ---------- Uç noktalar ----------
  const getDef = (req, res) => { const d = defs.get(req.params.game); if (!d) { res.status(404).json({ error: 'Oyun bulunamadı.' }); return null; } return d; };
  const getT = (req, res) => { const t = tables.get(req.params.id); if (!t || t.game !== req.params.game) { res.status(404).json({ error: 'Masa bulunamadı. Oyun bitmiş olabilir.' }); return null; } return t; };
  app.get('/api/play', auth, (req, res) => {
    const out = {};
    for (const [k] of defs) out[k] = { players: [...tables.values()].filter((t) => t.game === k).reduce((a, t) => a + humans(t).length, 0), current: mineOf(req.user.id, k)?.id || null };
    res.json(out);
  });
  app.get('/api/play/:game', auth, (req, res) => {
    const d = getDef(req, res); if (!d) return;
    const me = req.user.id;
    const open = [...tables.values()].filter((t) => t.game === d.key && !t.private && seatOf(t, me) < 0 && t.status !== 'ended'
      && (t.seats.some((s) => !s) || (t.status === 'playing' && d.bots && !d.party && t.seats.some((s) => s?.bot)))
      && !(t.status === 'playing' && d.lateJoin === false && !t.seats.some((s) => s?.bot)))
      .sort((a, b) => b.at - a.at).slice(0, 20).map(lobbyOut);
    res.json({ open, current: mineOf(me, d.key)?.id || null });
  });
  app.post('/api/play/:game', auth, (req, res) => {
    const d = getDef(req, res); if (!d) return;
    const u = req.user; if (!canPlay(u)) return res.status(403).json({ error: 'Bu hesap oyun oynayamaz.' });
    if (limited(`play:${u.id}`, 40, 3600000)) return res.status(429).json({ error: 'Biraz yavaş 🙂' });
    const cur = mineOf(u.id, d.key); if (cur) leave(cur, u.id);
    const b = req.body || {};
    if (b.quick) {
      const t0 = [...tables.values()].find((t) => t.game === d.key && !t.private && t.status === 'waiting' && t.seats.some((s) => !s));
      if (t0) { sitDown(t0, u); push(t0); return res.json({ id: t0.id }); }
      const t = createTable(d.key, u, b);
      if (d.bots && d.quick !== 'wait') { for (let i = 1; i < t.size; i++) t.seats[i] = botSeat(t); deal(t); } else push(t);
      return res.json({ id: t.id });
    }
    const t = createTable(d.key, u, { ...b, private: b.private !== false });
    push(t); res.json({ id: t.id });
  });
  app.get('/api/play/:game/:id', auth, (req, res) => { if (!getDef(req, res)) return; const t = getT(req, res); if (t) res.json(view(t, req.user.id)); });
  app.post('/api/play/:game/:id/join', auth, (req, res) => {
    const d = getDef(req, res); if (!d) return; const t = getT(req, res); if (!t) return;
    const u = req.user; if (!canPlay(u)) return res.status(403).json({ error: 'Bu hesap oyun oynayamaz.' });
    const cur = mineOf(u.id, d.key); if (cur && cur !== t) leave(cur, u.id);
    const err = sitDown(t, u); if (err) return res.status(409).json({ error: err });
    push(t); res.json(view(t, u.id));
  });
  app.post('/api/play/:game/:id/size', auth, (req, res) => {
    const d = getDef(req, res); if (!d) return; const t = getT(req, res); if (!t) return;
    if (t.host !== req.user.id || t.status !== 'waiting') return res.status(403).json({ error: 'Sadece masayı açan, oyun başlamadan değiştirebilir.' });
    const size = Math.max(d.min, Math.min(d.max, parseInt(req.body?.size, 10) || t.size));
    const people = t.seats.filter(Boolean);
    if (people.length > size) return res.status(409).json({ error: 'Masada bundan fazla kişi var.' });
    t.size = size; t.seats = [...people, ...new Array(size - people.length).fill(null)];
    push(t); res.json(view(t, req.user.id));
  });
  app.post('/api/play/:game/:id/start', auth, (req, res) => {
    const d = getDef(req, res); if (!d) return; const t = getT(req, res); if (!t) return;
    if (t.host !== req.user.id) return res.status(403).json({ error: 'Oyunu masayı açan başlatır.' });
    if (t.status === 'playing') return res.status(409).json({ error: 'Oyun zaten sürüyor.' });
    const people = t.seats.filter(Boolean).filter((s) => !s.bot);
    if (people.length < (d.minHumans || 1)) return res.status(400).json({ error: `Başlamak için en az ${d.minHumans} kişi gerekli. Arkadaşlarını davet et!` });
    if (d.bots) t.seats = t.seats.map((s) => s || botSeat(t));
    else { t.seats = t.seats.filter((s) => s && !s.bot); while (t.seats.length < t.size) t.seats.push(null); }
    if (t.seats.filter(Boolean).length < d.min) return res.status(400).json({ error: `Başlamak için en az ${d.min} kişi gerekli. Arkadaşlarını davet et!` });
    if (req.body?.bots === false && d.bots) { /* yalnız insanlarla: boş koltuklar kapatılır */ }
    deal(t); res.json(view(t, req.user.id));
  });
  app.post('/api/play/:game/:id/again', auth, (req, res) => {
    const d = getDef(req, res); if (!d) return; const t = getT(req, res); if (!t) return;
    if (seatOf(t, req.user.id) < 0) return res.status(403).json({ error: 'Bu masada değilsin.' });
    if (t.status !== 'ended') return res.status(409).json({ error: 'Oyun daha bitmedi.' });
    if (d.party && t.host !== req.user.id) return res.status(403).json({ error: 'Yeni oyunu odayı açan başlatır.' });
    if (d.party) { t.status = 'waiting'; t.g = null; t.result = null; t.scores = {}; say(t, { sys: true, text: 'Yeni oyun için hazırlanıyoruz.' }); push(t); return res.json(view(t, req.user.id)); }
    if (d.bots) t.seats = t.seats.map((s) => s || botSeat(t));
    deal(t); res.json(view(t, req.user.id));
  });
  app.post('/api/play/:game/:id/leave', auth, (req, res) => { if (!getDef(req, res)) return; const t = getT(req, res); if (!t) return; leave(t, req.user.id); res.json({ ok: true }); });
  app.post('/api/play/:game/:id/move', auth, (req, res) => {
    const d = getDef(req, res); if (!d) return; const t = getT(req, res); if (!t) return;
    const seat = seatOf(t, req.user.id);
    if (seat < 0) return res.status(403).json({ error: 'Bu masada değilsin.' });
    if (t.status !== 'playing') return res.status(409).json({ error: 'Oyun şu an oynanmıyor.' });
    if (limited(`pmv:${req.user.id}`, 240, 60000)) return res.status(429).json({ error: 'Biraz yavaş 🙂' });
    const s = t.seats[seat]; s.miss = 0; if (s.afk) { s.afk = false; log(t, `${s.name} geri döndü.`); }
    if (!d.party && d.turn && d.turn(t) !== seat && !d.anyTime?.(t, seat, req.body || {})) return res.status(409).json({ error: 'Sıra sende değil.' });
    const err = applyMove(t, seat, req.body || {}, false);
    if (err) return res.status(400).json({ error: err });
    res.json(view(t, req.user.id));
  });
  app.post('/api/play/:game/:id/chat', auth, (req, res) => {
    const d = getDef(req, res); if (!d) return; const t = getT(req, res); if (!t) return;
    const seat = seatOf(t, req.user.id); if (seat < 0) return res.status(403).json({ error: 'Bu masada değilsin.' });
    if (limited(`pch:${req.user.id}`, 40, 60000)) return res.status(429).json({ error: 'Biraz yavaş 🙂' });
    const text = ctx.moderation.mask(String(req.body?.text || '').trim().slice(0, 160)); if (!text) return res.json({ ok: true });
    let r = null;
    if (d.chat && t.status === 'playing') { try { r = d.chat(t, seat, text); } catch (e) { console.error('[play chat]', t.game, e); } }
    if (!r?.block) say(t, { uid: req.user.id, seat, name: t.seats[seat].name, text: r?.text || text });
    if (t.g?.over && t.status === 'playing') finish(t); else push(t);
    res.json({ ok: true, ...(r?.reply || {}) });
  });
  app.post('/api/play/:game/:id/invite', auth, (req, res) => {
    const d = getDef(req, res); if (!d) return; const t = getT(req, res); if (!t) return;
    if (seatOf(t, req.user.id) < 0) return res.status(403).json({ error: 'Önce masaya otur.' });
    const to = store.get('users', String(req.body?.userId || ''));
    if (!to || ctx.isBlocked(req.user.id, to.id)) return res.status(404).json({ error: 'Kişi bulunamadı.' });
    if (limited(`pinv:${req.user.id}`, 25, 3600000)) return res.status(429).json({ error: 'Biraz yavaş 🙂' });
    notify(to.id, { type: 'game', fromId: req.user.id, text: `${req.user.username} seni ${d.name} oynamaya çağırıyor ${d.emoji || '🎮'}`, url: `/#/oyun/${d.key}/${t.id}`, tag: `play-${t.id}` });
    res.json({ ok: true });
  });
  setInterval(() => { for (const t of tables.values()) if (!humans(t).length || now() - t.at > 8 * 3600000) { clearTimers(t); tables.delete(t.id); } }, 10 * 60000).unref?.();

  // Oyunları yükle
  const dir = path.join(__dirname, 'play');
  if (fs.existsSync(dir)) fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort().forEach((f) => { try { require(path.join(dir, f))(kit); } catch (e) { console.error('[play] yüklenemedi', f, e); } });
  ctx.playGames = () => [...defs.values()].map((d) => ({ key: d.key, name: d.name }));
  ctx.playKit = kit;
  console.log(`[play] ${defs.size} oyun hazır: ${[...defs.keys()].join(', ')}`);
};

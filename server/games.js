// Oyun salonu: Okey (4 kişilik, boş koltuklar botla dolar) ve Çiz Bil (çiz, tahmin et)
const { nanoid } = require('nanoid');

const now = () => Date.now();
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const BOT_NAMES = ['Ayla', 'Kerem', 'Defne', 'Emir', 'Zeynep', 'Mert', 'Elif', 'Can', 'Selin', 'Arda', 'Naz', 'Deniz'];
const BOT_AV = '/img/eg/okey.svg';

// ================= OKEY KURALLARI =================
// Taş: { id, c: 0-3 (sarı, mavi, siyah, kırmızı), n: 1-13 } ya da sahte okey { id, fake: true }
function newDeck() {
  const t = [];
  for (let c = 0; c < 4; c++) for (let n = 1; n <= 13; n++) for (let k = 0; k < 2; k++) t.push({ id: `${c}-${n}-${k}`, c, n });
  t.push({ id: 'f-0', fake: true }, { id: 'f-1', fake: true });
  return shuffle(t);
}
const isWild = (t, ok) => !t.fake && t.c === ok.c && t.n === ok.n;
const valOf = (t, ok) => (t.fake ? { c: ok.c, n: ok.n } : t);
function countsOf(tiles, ok) {
  const counts = new Array(52).fill(0); let j = 0;
  for (const t of tiles) { if (isWild(t, ok)) { j++; continue; } const v = valOf(t, ok); counts[v.c * 13 + v.n - 1]++; }
  return { counts, j };
}
// Kalan taşlar seri (aynı renk ardışık, 12-13-1 olabilir) ve per (aynı sayı farklı renk) gruplarına bölünebilir mi?
function canGroups(counts, j) {
  const i = counts.findIndex((x) => x > 0);
  if (i < 0) return true; // artan okeyler bir gruba eklenebilir
  const c = Math.floor(i / 13); const n = (i % 13) + 1;
  counts[i]--;
  try {
    // Per: aynı sayı, farklı renkler (3 ya da 4 taş)
    const others = [0, 1, 2, 3].filter((k) => k !== c && counts[k * 13 + n - 1] > 0);
    for (let mask = 0; mask < (1 << others.length); mask++) {
      const sub = others.filter((_, b) => mask & (1 << b));
      for (let jj = 0; jj <= j; jj++) {
        const tot = 1 + sub.length + jj; if (tot < 3 || tot > 4) continue;
        sub.forEach((k) => counts[k * 13 + n - 1]--);
        const ok = canGroups(counts, j - jj);
        sub.forEach((k) => counts[k * 13 + n - 1]++);
        if (ok) return true;
      }
    }
    // Seri: bu taş serinin en küçük gerçek taşı; önüne okey konabilir
    for (let pre = 0; pre <= Math.min(j, n - 1); pre++) if (runUp(counts, j - pre, c, n, 1 + pre)) return true;
    // 1, 12-13-1 gibi serinin sonu olabilir
    if (n === 1 && runDown(counts, j, c, 13, 1)) return true;
    return false;
  } finally { counts[i]++; }
}
function runUp(counts, j, c, cur, len) {
  if (len >= 3 && canGroups(counts, j)) return true;
  const v = cur + 1; if (v > 14) return false;
  const idx = c * 13 + (v === 14 ? 0 : v - 1);
  if (counts[idx] > 0) { counts[idx]--; const ok = v === 14 ? len + 1 >= 3 && canGroups(counts, j) : runUp(counts, j, c, v, len + 1); counts[idx]++; if (ok) return true; }
  if (j > 0) { if (v === 14 ? len + 1 >= 3 && canGroups(counts, j - 1) : runUp(counts, j - 1, c, v, len + 1)) return true; }
  return false;
}
function runDown(counts, j, c, v, len) {
  // 1 zaten alındı; 13, 12, ... aşağı doğru
  if (v < 2) return false;
  const idx = c * 13 + v - 1;
  const step = (jj) => (len + 1 >= 3 && canGroups(counts, jj)) || runDown(counts, jj, c, v - 1, len + 1);
  if (counts[idx] > 0) { counts[idx]--; const ok = step(j); counts[idx]++; if (ok) return true; }
  if (j > 0 && step(j - 1)) return true;
  return false;
}
function canPairs(counts, j) { let singles = 0; for (const x of counts) singles += x % 2; return singles <= j; }
function winsWith(tiles14, ok) { if (tiles14.length !== 14) return false; const { counts, j } = countsOf(tiles14, ok); return canGroups(counts, j) || canPairs(counts.slice(), j); }
// Botlar için taşın elde ne kadar işe yaradığı
function useful(t, hand, ok) {
  if (isWild(t, ok)) return 100;
  const v = valOf(t, ok); let s = 0;
  for (const o of hand) {
    if (o === t) continue; if (isWild(o, ok)) { s += 0.5; continue; }
    const w = valOf(o, ok);
    if (w.c === v.c) { const d = Math.abs(w.n - v.n); const dw = Math.min(d, 13 - d); if (dw === 1) s += 3; else if (dw === 2) s += 1.4; else if (d === 0) s += 1; } else if (w.n === v.n) s += 2.6;
  }
  return s;
}

module.exports = function games(app, ctx) {
  const { store, auth, brief, emitTo, io, limited, notify } = ctx;
  const SPECIAL = new Set(['falci', 'official']);
  const xp = (uid, n = 1) => ctx.addXp?.(uid, 'oyun', n);

  // ================= OKEY MASALARI =================
  const tables = new Map(); // id -> masa
  const seatOf = (t, uid) => t.seats.findIndex((s) => s && s.uid === uid);
  const humans = (t) => t.seats.filter((s) => s && !s.bot);
  const tableOut = (t) => ({ id: t.id, host: t.host, private: t.private, status: t.status, seats: t.seats.map((s) => (s ? { name: s.name, avatar: s.avatar, bot: !!s.bot } : null)), at: t.at });
  function viewFor(t, uid) {
    const me = seatOf(t, uid);
    return {
      id: t.id, status: t.status, host: t.host === uid, private: t.private, hand: me >= 0 && t.hands ? t.hands[me] : [], seat: me, turn: t.turn, phase: t.phase, deadline: t.deadline,
      seats: t.seats.map((s, i) => (s ? { name: s.name, avatar: s.avatar, bot: !!s.bot, uid: s.bot ? null : s.uid, count: t.hands ? t.hands[i].length : 0, discard: t.discards ? t.discards[i].slice(-1)[0] || null : null, dcount: t.discards ? t.discards[i].length : 0, score: t.scores[i] || 0, afk: !!s.afk } : null)),
      pile: t.pile ? t.pile.length : 0, indicator: t.indicator || null, okey: t.okey || null, winner: t.winner ?? null, winHand: t.winHand || null, endReason: t.endReason || null, round: t.round || 0, log: t.log.slice(-6),
    };
  }
  const push = (t) => { t.seats.forEach((s) => { if (s && !s.bot) emitTo(s.uid, 'okey', viewFor(t, s.uid)); }); io.to('okey:lobby').emit('okey:lobby', {}); };
  const log = (t, text) => { t.log.push({ text, at: now() }); if (t.log.length > 30) t.log.shift(); };
  const botSeat = (t) => { const used = new Set(t.seats.filter(Boolean).map((s) => s.name)); const name = BOT_NAMES.find((n) => !used.has(`${n} (bot)`)) || 'Bot'; return { bot: true, uid: `bot_${nanoid(6)}`, name: `${name} (bot)`, avatar: BOT_AV }; };

  function deal(t) {
    const deck = newDeck();
    let ind = deck.findIndex((x) => !x.fake); const indicator = deck.splice(ind, 1)[0];
    t.indicator = indicator; t.okey = { c: indicator.c, n: indicator.n === 13 ? 1 : indicator.n + 1 };
    t.dealer = t.round ? (t.dealer + 1) % 4 : Math.floor(Math.random() * 4);
    t.hands = [0, 1, 2, 3].map((i) => deck.splice(0, i === t.dealer ? 15 : 14));
    t.pile = deck; t.discards = [[], [], [], []];
    t.turn = t.dealer; t.phase = 'discard'; t.status = 'playing'; t.winner = null; t.winHand = null; t.endReason = null; t.round = (t.round || 0) + 1;
    log(t, `${t.round}. el başladı. Gösterge ${['sarı', 'mavi', 'siyah', 'kırmızı'][indicator.c]} ${indicator.n}.`);
    arm(t); push(t);
  }
  function arm(t) {
    clearTimeout(t.timer);
    if (t.status !== 'playing') return;
    const s = t.seats[t.turn];
    if (s.bot || s.afk) { t.deadline = null; t.timer = setTimeout(() => botMove(t), s.afk ? 700 : 900 + Math.random() * 900); return; }
    t.deadline = now() + 35000;
    t.timer = setTimeout(() => { s.miss = (s.miss || 0) + 1; if (s.miss >= 2) { s.afk = true; log(t, `${s.name} uzun süre oynamadı, bot oynuyor.`); } botMove(t); }, 35000);
  }
  function nextTurn(t) { t.turn = (t.turn + 1) % 4; t.phase = 'draw'; arm(t); push(t); }
  function finishHand(t, seat, tile) {
    clearTimeout(t.timer);
    t.status = 'ended'; t.winner = seat; t.deadline = null; t.endReason = 'win';
    const okeyFinish = isWild(tile, t.okey);
    t.scores[seat] = (t.scores[seat] || 0) + (okeyFinish ? 4 : 2);
    t.winHand = t.hands[seat].slice();
    log(t, `${t.seats[seat].name} eli bitirdi${okeyFinish ? ' (okey atarak, çifte puan)' : ''}! 🎉`);
    t.seats.forEach((s, i) => { if (s && !s.bot) { xp(s.uid); if (i === seat) xp(s.uid, 2); } });
    push(t);
  }
  function doDraw(t, seat, from) {
    const prev = (seat + 3) % 4;
    let tile;
    if (from === 'discard') { tile = t.discards[prev].pop(); if (!tile) return 'Alınacak taş yok.'; } else {
      if (!t.pile.length) { clearTimeout(t.timer); t.status = 'ended'; t.endReason = 'pile'; t.winner = null; log(t, 'Ortadaki taşlar bitti, el berabere.'); push(t); return null; }
      tile = t.pile.shift();
    }
    t.hands[seat].push(tile); t.phase = 'discard'; t.lastDrawn = tile.id;
    return null;
  }
  function doDiscard(t, seat, tileId, finish) {
    const h = t.hands[seat]; const k = h.findIndex((x) => x.id === tileId);
    if (k < 0) return 'Bu taş elinde yok.';
    if (finish) {
      const rest = h.filter((_, i) => i !== k);
      if (!winsWith(rest, t.okey)) return 'Elin henüz bitmedi. Taşların 3’lü / 4’lü per ve serilere ya da 7 çifte ayrılmalı.';
      const [tile] = h.splice(k, 1); t.discards[seat].push(tile); finishHand(t, seat, tile); return null;
    }
    const [tile] = h.splice(k, 1); t.discards[seat].push(tile);
    nextTurn(t); return null;
  }
  function botMove(t) {
    if (t.status !== 'playing') return;
    const seat = t.turn; const h = t.hands[seat]; const ok = t.okey;
    if (t.phase === 'draw') {
      const prev = (seat + 3) % 4; const top = t.discards[prev].slice(-1)[0];
      let take = false;
      if (top) {
        const hh = [...h, top];
        if (hh.some((x) => x !== top && winsWith(hh.filter((y) => y !== x), ok))) take = true;
        else if (isWild(top, ok) || useful(top, h, ok) >= 4) take = true;
      }
      const err = doDraw(t, seat, take ? 'discard' : 'pile');
      if (err || t.status !== 'playing') return;
      if (take) log(t, `${t.seats[seat].name} yandaki taşı aldı.`);
    }
    // Bitirebiliyorsa bitir
    for (const x of h.slice()) { if (isWild(x, ok)) continue; if (winsWith(h.filter((y) => y !== x), ok)) return doDiscard(t, seat, x.id, true); }
    for (const x of h.slice()) { if (winsWith(h.filter((y) => y !== x), ok)) return doDiscard(t, seat, x.id, true); }
    // En az işe yarayan taşı at (okeyi asla)
    const cand = h.filter((x) => !isWild(x, ok)).map((x) => ({ x, s: useful(x, h, ok) + Math.random() * 0.3 })).sort((a, b) => a.s - b.s);
    doDiscard(t, seat, (cand[0] || { x: h[0] }).x.id, false);
  }

  const user = (id) => store.get('users', id);
  const canPlay = (u) => u && !SPECIAL.has(u.role);
  function createTable(u, priv) {
    const t = { id: nanoid(8), host: u.id, private: !!priv, status: 'waiting', seats: [{ uid: u.id, name: u.name.split(' ')[0], avatar: u.avatar }, null, null, null], scores: [0, 0, 0, 0], log: [], at: now() };
    tables.set(t.id, t); log(t, `${t.seats[0].name} masayı açtı.`);
    return t;
  }
  function sitDown(t, u) {
    if (seatOf(t, u.id) >= 0) return null;
    // Oyun sürerken bot koltuğuna geçilebilir
    let i = t.seats.findIndex((s) => !s);
    if (i < 0 && t.status !== 'waiting') i = t.seats.findIndex((s) => s.bot);
    if (i < 0) return 'Masa dolu.';
    const prevBot = t.seats[i];
    t.seats[i] = { uid: u.id, name: u.name.split(' ')[0], avatar: u.avatar };
    log(t, `${t.seats[i].name} masaya oturdu${prevBot ? ` (${prevBot.name} yerine)` : ''}.`);
    if (t.status === 'waiting' && humans(t).length === 4) deal(t);
    return null;
  }
  function leave(t, uid) {
    const i = seatOf(t, uid); if (i < 0) return;
    const name = t.seats[i].name;
    if (t.status === 'waiting') t.seats[i] = null; else { t.seats[i] = { ...botSeat(t), name: `${name} → bot` }; }
    log(t, `${name} masadan kalktı.`);
    if (!humans(t).length) { clearTimeout(t.timer); tables.delete(t.id); io.to('okey:lobby').emit('okey:lobby', {}); return; }
    if (t.host === uid) t.host = humans(t)[0].uid;
    if (t.status === 'playing' && t.turn === i) arm(t);
    push(t);
  }
  const mine = (uid) => [...tables.values()].find((t) => seatOf(t, uid) >= 0);

  app.get('/api/games/okey', auth, (req, res) => {
    const me = req.user.id;
    const open = [...tables.values()].filter((t) => !t.private && t.seats.some((s) => !s || (s.bot && t.status !== 'waiting')) && seatOf(t, me) < 0).sort((a, b) => b.at - a.at).slice(0, 20).map(tableOut);
    const cur = mine(me);
    res.json({ open, current: cur ? cur.id : null, playing: [...tables.values()].reduce((a, t) => a + humans(t).length, 0) });
  });
  app.post('/api/games/okey', auth, (req, res) => {
    const u = req.user; if (!canPlay(u)) return res.status(403).json({ error: 'Bu hesap oyun oynayamaz.' });
    if (limited('okeyc:' + u.id, 30, 3600000)) return res.status(429).json({ error: 'Biraz yavaş 🙂' });
    const cur = mine(u.id); if (cur) leave(cur, u.id);
    if (req.body?.quick) {
      // Boş koltuğu olan açık masaya otur; yoksa yeni masa aç ve botlarla hemen başlat
      const t0 = [...tables.values()].find((t) => !t.private && t.status === 'waiting' && t.seats.some((s) => !s));
      if (t0) { sitDown(t0, u); push(t0); return res.json({ id: t0.id }); }
      const t = createTable(u, false);
      for (let i = 1; i < 4; i++) t.seats[i] = botSeat(t);
      deal(t); return res.json({ id: t.id });
    }
    const t = createTable(u, req.body?.private);
    push(t); res.json({ id: t.id });
  });
  const getT = (req, res) => { const t = tables.get(req.params.id); if (!t) { res.status(404).json({ error: 'Masa bulunamadı. Oyun bitmiş olabilir.' }); return null; } return t; };
  app.get('/api/games/okey/:id', auth, (req, res) => { const t = getT(req, res); if (t) res.json(viewFor(t, req.user.id)); });
  app.post('/api/games/okey/:id/join', auth, (req, res) => {
    const t = getT(req, res); if (!t) return; const u = req.user; if (!canPlay(u)) return res.status(403).json({ error: 'Bu hesap oyun oynayamaz.' });
    const cur = mine(u.id); if (cur && cur !== t) leave(cur, u.id);
    const err = sitDown(t, u); if (err) return res.status(409).json({ error: err });
    push(t); res.json(viewFor(t, u.id));
  });
  app.post('/api/games/okey/:id/start', auth, (req, res) => {
    const t = getT(req, res); if (!t) return;
    if (t.host !== req.user.id) return res.status(403).json({ error: 'Oyunu masayı açan başlatır.' });
    if (t.status === 'playing') return res.status(409).json({ error: 'Oyun zaten sürüyor.' });
    t.seats = t.seats.map((s) => s || botSeat(t)); t.seats.forEach((s) => { if (s) { s.afk = false; s.miss = 0; } });
    deal(t); res.json(viewFor(t, req.user.id));
  });
  app.post('/api/games/okey/:id/leave', auth, (req, res) => { const t = getT(req, res); if (!t) return; leave(t, req.user.id); res.json({ ok: true }); });
  app.post('/api/games/okey/:id/invite', auth, (req, res) => {
    const t = getT(req, res); if (!t) return; if (seatOf(t, req.user.id) < 0) return res.status(403).json({ error: 'Önce masaya otur.' });
    const to = user(String(req.body?.userId || '')); if (!to || ctx.isBlocked(req.user.id, to.id)) return res.status(404).json({ error: 'Kişi bulunamadı.' });
    if (limited(`okeyi:${req.user.id}`, 20, 3600000)) return res.status(429).json({ error: 'Biraz yavaş 🙂' });
    notify(to.id, { type: 'game', fromId: req.user.id, text: `${req.user.username} seni okey masasına çağırıyor 🀄`, url: `/#/oyun/okey/${t.id}`, tag: 'okey-' + t.id });
    res.json({ ok: true });
  });
  app.post('/api/games/okey/:id/move', auth, (req, res) => {
    const t = getT(req, res); if (!t) return;
    const seat = seatOf(t, req.user.id);
    if (seat < 0) return res.status(403).json({ error: 'Bu masada oturmuyorsun.' });
    if (t.status !== 'playing') return res.status(409).json({ error: 'Oyun şu an oynanmıyor.' });
    if (t.turn !== seat) return res.status(409).json({ error: 'Sıra sende değil.' });
    const s = t.seats[seat]; s.miss = 0; s.afk = false;
    const b = req.body || {};
    let err = null;
    if (b.type === 'draw') { if (t.phase !== 'draw') err = 'Önce bir taş at.'; else { err = doDraw(t, seat, b.from === 'discard' ? 'discard' : 'pile'); if (!err && t.status === 'playing') { if (b.from === 'discard') log(t, `${s.name} yandaki taşı aldı.`); arm(t); push(t); } } }
    else if (b.type === 'discard' || b.type === 'finish') { if (t.phase !== 'discard') err = 'Önce bir taş çek.'; else err = doDiscard(t, seat, String(b.tile || ''), b.type === 'finish'); }
    else err = 'Geçersiz hamle.';
    if (err) return res.status(400).json({ error: err });
    res.json(viewFor(t, req.user.id));
  });
  app.post('/api/games/okey/:id/again', auth, (req, res) => {
    const t = getT(req, res); if (!t) return;
    if (seatOf(t, req.user.id) < 0) return res.status(403).json({ error: 'Bu masada oturmuyorsun.' });
    if (t.status !== 'ended') return res.status(409).json({ error: 'El daha bitmedi.' });
    deal(t); res.json(viewFor(t, req.user.id));
  });
  // Boş kalan masaları temizle
  setInterval(() => { for (const t of tables.values()) if (!humans(t).length || now() - t.at > 6 * 3600000) { clearTimeout(t.timer); tables.delete(t.id); } }, 10 * 60000).unref?.();

  // ================= ÇİZ BİL =================
  const WORDS = ('elma armut muz çilek karpuz üzüm kiraz ananas limon havuç domates mısır patlıcan mantar ekmek peynir pizza hamburger dondurma pasta kurabiye çikolata kahve çay simit '
    + 'kedi köpek balık kuş tavşan aslan zürafa fil yılan kaplumbağa penguen ayı tilki baykuş arı kelebek örümcek ahtapot yunus balina at inek koyun tavuk ördek kurbağa salyangoz deve '
    + 'güneş ay yıldız bulut yağmur şimşek gökkuşağı kar kardan_adam dağ deniz ada şelale volkan çöl orman ağaç çiçek yaprak kaktüs '
    + 'ev kale köprü kule piramit çadır deniz_feneri okul hastane cami saat kapı pencere merdiven asansör çit '
    + 'araba otobüs tren uçak helikopter gemi denizaltı bisiklet motosiklet roket kaykay balon paraşüt '
    + 'telefon bilgisayar televizyon kamera kulaklık mikrofon gitar piyano davul keman robot ampul pil mıknatıs '
    + 'kalem kitap makas cetvel çanta gözlük şapka ayakkabı çorap eldiven şemsiye anahtar kilit yüzük taç kılıç kalkan ok_ve_yay '
    + 'top kale_direği raket kupa madalya satranç zar yapboz uçurtma salıncak kaydırak '
    + 'astronot uzaylı korsan prenses kral ejderha dinozor deniz_kızı hayalet vampir sihirbaz ninja süper_kahraman palyaço aşçı itfaiyeci doktor '
    + 'kalp gülümseme göz burun kulak el ayak diş saç bıyık sakal').split(' ').map((w) => w.replace(/_/g, ' '));
  const norm = (s) => String(s || '').toLocaleLowerCase('tr-TR').replace(/[^a-zçğıöşü0-9]/g, '');
  const lev = (a, b) => { const m = a.length; const n = b.length; if (Math.abs(m - n) > 2) return 9; const d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; };
  const rooms = new Map();
  const ROUNDS = 2; const DRAW_MS = 80000; const PICK_MS = 12000;
  const roomOut = (r) => ({ id: r.id, host: r.host, private: r.private, status: r.status, players: r.players.map((p) => ({ name: p.name, avatar: p.avatar })), max: 8, at: r.at });
  const mask = (w) => w.split('').map((ch) => (ch === ' ' ? ' ' : '_')).join('');
  function rview(r, uid) {
    const p = r.players.find((x) => x.uid === uid); const drawer = r.players[r.drawer];
    const isDrawer = drawer?.uid === uid;
    return {
      id: r.id, status: r.status, phase: r.phase, host: r.host === uid, private: r.private, me: uid, round: r.round, rounds: ROUNDS, deadline: r.deadline,
      players: r.players.map((x, i) => ({ uid: x.uid, name: x.name, avatar: x.avatar, score: x.score, guessed: r.guessed.has(x.uid), drawer: i === r.drawer && r.status === 'playing' })),
      drawer: drawer ? drawer.uid : null, word: isDrawer || r.phase === 'reveal' || r.guessed.has(uid) ? r.word : null, hint: r.word ? r.hint : null, len: r.word ? r.word.length : 0,
      choices: isDrawer && r.phase === 'pick' ? r.choices : null, chat: r.chat.slice(-40), joined: !!p,
    };
  }
  const rpush = (r) => { r.players.forEach((p) => emitTo(p.uid, 'cizbil', rview(r, p.uid))); io.to('cb:lobby').emit('cb:lobby', {}); };
  const say = (r, m) => { r.chat.push({ id: nanoid(6), at: now(), ...m }); if (r.chat.length > 80) r.chat.shift(); };
  function nextTurnCB(r) {
    clearTimeout(r.timer);
    if (r.status !== 'playing') return;
    r.turnNo = (r.turnNo || 0) + 1;
    const total = r.players.length * ROUNDS;
    if (r.turnNo > total || r.players.length < 2) return endCB(r);
    r.round = Math.ceil(r.turnNo / r.players.length);
    r.drawer = (r.turnNo - 1) % r.players.length;
    r.guessed = new Set(); r.word = null; r.hint = null; r.strokes = [];
    const used = r.used || (r.used = new Set());
    r.choices = shuffle(WORDS.filter((w) => !used.has(w))).slice(0, 3);
    r.phase = 'pick'; r.deadline = now() + PICK_MS;
    io.to(`cb:${r.id}`).emit('cb:clear', {});
    say(r, { sys: true, text: `${r.players[r.drawer].name} kelime seçiyor…` });
    r.timer = setTimeout(() => pickWord(r, r.choices[0]), PICK_MS);
    rpush(r);
  }
  function pickWord(r, w) {
    clearTimeout(r.timer); if (r.phase !== 'pick') return;
    r.word = w; r.used.add(w); r.hint = mask(w); r.phase = 'draw'; r.deadline = now() + DRAW_MS; r.started = now();
    say(r, { sys: true, text: `${r.players[r.drawer].name} çiziyor! Kelime ${w.length} harfli.` });
    // Süre ilerledikçe ipucu harfleri açılır
    const letters = w.split('').map((ch, i) => (ch === ' ' ? -1 : i)).filter((i) => i >= 0);
    shuffle(letters);
    r.hintTimers = [0.5, 0.75].map((f, k) => setTimeout(() => { if (r.phase !== 'draw' || r.word !== w || letters.length < 4) return; const i = letters[k]; r.hint = r.hint.slice(0, i) + w[i] + r.hint.slice(i + 1); rpush(r); }, DRAW_MS * f));
    r.timer = setTimeout(() => reveal(r), DRAW_MS);
    rpush(r);
  }
  function reveal(r) {
    clearTimeout(r.timer); (r.hintTimers || []).forEach(clearTimeout);
    if (r.phase !== 'draw') return;
    r.phase = 'reveal'; r.deadline = now() + 5000;
    say(r, { sys: true, text: `Kelime: ${r.word}` });
    r.timer = setTimeout(() => nextTurnCB(r), 5000);
    rpush(r);
  }
  function endCB(r) {
    clearTimeout(r.timer); (r.hintTimers || []).forEach(clearTimeout);
    r.status = 'ended'; r.phase = 'end'; r.deadline = null;
    const best = r.players.slice().sort((a, b) => b.score - a.score)[0];
    if (best) say(r, { sys: true, text: `Oyun bitti! Kazanan: ${best.name} 🏆` });
    r.players.forEach((p) => xp(p.uid, p === best ? 2 : 1));
    rpush(r);
  }
  const myRoom = (uid) => [...rooms.values()].find((r) => r.players.some((p) => p.uid === uid));
  function leaveRoom(r, uid) {
    const i = r.players.findIndex((p) => p.uid === uid); if (i < 0) return;
    const [p] = r.players.splice(i, 1);
    say(r, { sys: true, text: `${p.name} ayrıldı.` });
    if (!r.players.length) { clearTimeout(r.timer); rooms.delete(r.id); io.to('cb:lobby').emit('cb:lobby', {}); return; }
    if (r.host === uid) r.host = r.players[0].uid;
    if (r.status === 'playing') {
      if (r.players.length < 2) return endCB(r);
      if (i === r.drawer) { r.turnNo -= 0; r.drawer = Math.min(r.drawer, r.players.length - 1); clearTimeout(r.timer); r.phase = 'reveal'; r.timer = setTimeout(() => nextTurnCB(r), 1500); }
      else if (i < r.drawer) r.drawer--;
    }
    rpush(r);
  }
  app.get('/api/games/cizbil', auth, (req, res) => {
    const me = req.user.id;
    const open = [...rooms.values()].filter((r) => !r.private && r.players.length < 8 && !r.players.some((p) => p.uid === me) && r.status !== 'ended').sort((a, b) => b.at - a.at).slice(0, 20).map(roomOut);
    const cur = myRoom(me);
    res.json({ open, current: cur ? cur.id : null });
  });
  app.post('/api/games/cizbil', auth, (req, res) => {
    const u = req.user; if (!canPlay(u)) return res.status(403).json({ error: 'Bu hesap oyun oynayamaz.' });
    const cur = myRoom(u.id); if (cur) leaveRoom(cur, u.id);
    if (req.body?.quick) {
      const r0 = [...rooms.values()].find((r) => !r.private && r.players.length < 8 && r.status !== 'ended');
      if (r0) { r0.players.push({ uid: u.id, name: u.name.split(' ')[0], avatar: u.avatar, score: 0 }); say(r0, { sys: true, text: `${u.name.split(' ')[0]} katıldı.` }); rpush(r0); return res.json({ id: r0.id }); }
    }
    const r = { id: nanoid(8), host: u.id, private: !!req.body?.private, status: 'waiting', phase: 'lobby', players: [{ uid: u.id, name: u.name.split(' ')[0], avatar: u.avatar, score: 0 }], guessed: new Set(), chat: [], strokes: [], at: now() };
    rooms.set(r.id, r); say(r, { sys: true, text: `${r.players[0].name} odayı açtı. En az 2 kişiyle başlayabilirsiniz.` });
    rpush(r); res.json({ id: r.id });
  });
  const getR = (req, res) => { const r = rooms.get(req.params.id); if (!r) { res.status(404).json({ error: 'Oda bulunamadı. Oyun bitmiş olabilir.' }); return null; } return r; };
  app.get('/api/games/cizbil/:id', auth, (req, res) => { const r = getR(req, res); if (r) res.json({ ...rview(r, req.user.id), strokes: r.strokes }); });
  app.post('/api/games/cizbil/:id/join', auth, (req, res) => {
    const r = getR(req, res); if (!r) return; const u = req.user; if (!canPlay(u)) return res.status(403).json({ error: 'Bu hesap oyun oynayamaz.' });
    if (!r.players.some((p) => p.uid === u.id)) {
      if (r.players.length >= 8) return res.status(409).json({ error: 'Oda dolu.' });
      const cur = myRoom(u.id); if (cur) leaveRoom(cur, u.id);
      r.players.push({ uid: u.id, name: u.name.split(' ')[0], avatar: u.avatar, score: 0 }); say(r, { sys: true, text: `${u.name.split(' ')[0]} katıldı.` });
    }
    rpush(r); res.json({ ...rview(r, u.id), strokes: r.strokes });
  });
  app.post('/api/games/cizbil/:id/start', auth, (req, res) => {
    const r = getR(req, res); if (!r) return;
    if (r.host !== req.user.id) return res.status(403).json({ error: 'Oyunu odayı açan başlatır.' });
    if (r.players.length < 2) return res.status(400).json({ error: 'Başlamak için en az 2 kişi gerekli. Arkadaşını davet et!' });
    r.status = 'playing'; r.turnNo = 0; r.used = new Set(); r.players.forEach((p) => { p.score = 0; });
    nextTurnCB(r); res.json(rview(r, req.user.id));
  });
  app.post('/api/games/cizbil/:id/pick', auth, (req, res) => {
    const r = getR(req, res); if (!r) return;
    if (r.players[r.drawer]?.uid !== req.user.id || r.phase !== 'pick') return res.status(409).json({ error: 'Şu an kelime seçemezsin.' });
    const w = r.choices.includes(req.body?.word) ? req.body.word : r.choices[0];
    pickWord(r, w); res.json({ ok: true });
  });
  app.post('/api/games/cizbil/:id/guess', auth, (req, res) => {
    const r = getR(req, res); if (!r) return; const u = req.user;
    const p = r.players.find((x) => x.uid === u.id); if (!p) return res.status(403).json({ error: 'Bu odada değilsin.' });
    const text = ctx.moderation.mask(String(req.body?.text || '').trim().slice(0, 80)); if (!text) return res.json({ ok: true });
    if (limited(`cbg:${u.id}`, 40, 60000)) return res.status(429).json({ error: 'Biraz yavaş 🙂' });
    const drawer = r.players[r.drawer];
    if (r.phase === 'draw' && drawer && drawer.uid !== u.id && !r.guessed.has(u.id)) {
      const g = norm(text); const w = norm(r.word);
      if (g === w) {
        r.guessed.add(u.id);
        const left = Math.max(0, r.deadline - now()) / DRAW_MS;
        const pts = Math.round(40 + 60 * left) + (r.guessed.size === 1 ? 20 : 0);
        p.score += pts; drawer.score += 15;
        say(r, { sys: true, ok: true, text: `${p.name} kelimeyi bildi! +${pts}` });
        if (r.guessed.size >= r.players.length - 1) reveal(r); else rpush(r);
        return res.json({ correct: true, pts });
      }
      if (w.length > 3 && lev(g, w) === 1) { emitTo(u.id, 'cizbil:close', { text }); }
    }
    // Kelimeyi bilen ya da çizen kişi kelimeyi sohbete yazamaz
    if (r.phase === 'draw' && r.word && (r.guessed.has(u.id) || drawer?.uid === u.id) && norm(text).includes(norm(r.word))) return res.json({ ok: true });
    say(r, { uid: u.id, name: p.name, text });
    rpush(r); res.json({ ok: true });
  });
  app.post('/api/games/cizbil/:id/leave', auth, (req, res) => { const r = getR(req, res); if (!r) return; leaveRoom(r, req.user.id); res.json({ ok: true }); });
  app.post('/api/games/cizbil/:id/again', auth, (req, res) => {
    const r = getR(req, res); if (!r) return; if (r.host !== req.user.id) return res.status(403).json({ error: 'Yeni oyunu odayı açan başlatır.' });
    r.status = 'waiting'; r.phase = 'lobby'; r.players.forEach((p) => { p.score = 0; }); say(r, { sys: true, text: 'Yeni oyun için hazırlanıyoruz.' }); rpush(r); res.json({ ok: true });
  });
  app.post('/api/games/cizbil/:id/invite', auth, (req, res) => {
    const r = getR(req, res); if (!r) return; if (!r.players.some((p) => p.uid === req.user.id)) return res.status(403).json({ error: 'Önce odaya katıl.' });
    const to = user(String(req.body?.userId || '')); if (!to || ctx.isBlocked(req.user.id, to.id)) return res.status(404).json({ error: 'Kişi bulunamadı.' });
    if (limited(`cbi:${req.user.id}`, 20, 3600000)) return res.status(429).json({ error: 'Biraz yavaş 🙂' });
    notify(to.id, { type: 'game', fromId: req.user.id, text: `${req.user.username} seni Çiz Bil oyununa çağırıyor 🎨`, url: `/#/oyun/cizbil/${r.id}`, tag: 'cb-' + r.id });
    res.json({ ok: true });
  });
  setInterval(() => { for (const r of rooms.values()) if (!r.players.length || now() - r.at > 4 * 3600000) { clearTimeout(r.timer); rooms.delete(r.id); } }, 10 * 60000).unref?.();

  // Çizim: çizen kişinin çizgileri odadakilere anında iletilir
  ctx.gamesSocket = (socket) => {
    const uid = socket.data.userId;
    socket.on('okey:watch', () => socket.join('okey:lobby'));
    socket.on('okey:unwatch', () => socket.leave('okey:lobby'));
    socket.on('cb:lobby', () => socket.join('cb:lobby'));
    socket.on('cb:join', ({ id } = {}) => { const r = rooms.get(id); if (r && r.players.some((p) => p.uid === uid)) socket.join(`cb:${id}`); });
    socket.on('cb:leave', ({ id } = {}) => socket.leave(`cb:${id}`));
    socket.on('cb:stroke', (st = {}) => {
      const r = rooms.get(st.id); if (!r || r.phase !== 'draw' || r.players[r.drawer]?.uid !== uid) return;
      const pts = (Array.isArray(st.pts) ? st.pts : []).slice(0, 200).map((p) => [Math.max(0, Math.min(1, +p[0] || 0)), Math.max(0, Math.min(1, +p[1] || 0))]);
      if (!pts.length) return;
      const s = { k: String(st.k || '').slice(0, 12), c: /^#[0-9a-f]{6}$/i.test(st.c) ? st.c : '#111111', w: Math.max(1, Math.min(40, +st.w || 4)), pts };
      if (r.strokes.length < 4000) r.strokes.push(s);
      socket.to(`cb:${r.id}`).emit('cb:stroke', s);
    });
    socket.on('cb:clear', ({ id } = {}) => { const r = rooms.get(id); if (!r || r.players[r.drawer]?.uid !== uid) return; r.strokes = []; io.to(`cb:${r.id}`).emit('cb:clear', {}); });
    socket.on('cb:undo', ({ id, k } = {}) => { const r = rooms.get(id); if (!r || r.players[r.drawer]?.uid !== uid) return; r.strokes = r.strokes.filter((s) => s.k !== k); io.to(`cb:${r.id}`).emit('cb:undo', { k }); });
  };
  ctx.okeyRules = { winsWith, newDeck };
};
module.exports.winsWith = winsWith;

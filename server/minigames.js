// Sohbet içi mini oyunlar: XOX, Dört Taş, Taş Kağıt Makas, Amiral Battı.
// Oyun bir mesaj olarak gönderilir; tahta mesaj balonunda canlı oynanır. Durum 'mini_games' koleksiyonunda,
// her oyuncuya kendi görünümü 'mini' olayıyla gider (Amiral Battı'da rakibin gemileri gizli kalır).
const { nanoid } = require('nanoid');

const TYPES = {
  xox: { name: 'XOX', emoji: '❌', text: '❌⭕ XOX oynayalım mı?' },
  dorttas: { name: 'Dört Taş', emoji: '🔴', text: '🔴🟡 Dört Taş oynayalım mı?' },
  tkm: { name: 'Taş Kağıt Makas', emoji: '✊', text: '✊✋✌️ Taş Kağıt Makas! 3 turda 2 alan kazanır.' },
  amiral: { name: 'Amiral Battı', emoji: '🚢', text: '🚢 Amiral Battı oynayalım mı?' },
};
const XOX_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const C4 = { w: 7, h: 6 };
const SEA = 8; const FLEET = [4, 3, 3, 2];
const TKM = ['tas', 'kagit', 'makas'];
const beats = (a, b) => (a === 'tas' && b === 'makas') || (a === 'kagit' && b === 'tas') || (a === 'makas' && b === 'kagit');
const rand = (n) => Math.floor(Math.random() * n);
const DAY = 86400000;

function placeFleet() {
  for (let attempt = 0; attempt < 300; attempt++) {
    const grid = new Array(SEA * SEA).fill(-1); const ships = []; let ok = true;
    for (let si = 0; si < FLEET.length && ok; si++) {
      const len = FLEET[si]; let placed = false;
      for (let k = 0; k < 120 && !placed; k++) {
        const hor = Math.random() < 0.5;
        const r = rand(hor ? SEA : SEA - len + 1); const c = rand(hor ? SEA - len + 1 : SEA);
        const cells = Array.from({ length: len }, (_, i) => (hor ? r * SEA + c + i : (r + i) * SEA + c));
        const free = cells.every((x) => { const xr = Math.floor(x / SEA); const xc = x % SEA; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const nr = xr + dr; const nc = xc + dc; if (nr >= 0 && nr < SEA && nc >= 0 && nc < SEA && grid[nr * SEA + nc] !== -1) return false; } return true; });
        if (free) { cells.forEach((x) => { grid[x] = si; }); ships.push(cells); placed = true; }
      }
      if (!placed) ok = false;
    }
    if (ok) return ships;
  }
  return null;
}

module.exports = function minigames(app, ctx) {
  const { store, auth, emitTo, sendMessage, limited, notify, isBlocked } = ctx;
  const now = () => Date.now();
  const user = (id) => store.get('users', id);

  function fresh(type) {
    if (type === 'xox') return { board: new Array(9).fill(null), line: null };
    if (type === 'dorttas') return { board: new Array(C4.w * C4.h).fill(null), line: null, last: null };
    if (type === 'tkm') return { picks: [null, null], rounds: [] };
    if (type === 'amiral') return { fleets: [placeFleet(), placeFleet()], ready: [false, false], shots: [[], []], last: null };
    return {};
  }
  function newRound(g) {
    g.round = (g.round || 0) + 1; g.s = fresh(g.type); g.winner = null;
    g.status = g.type === 'amiral' ? 'setup' : 'playing';
    g.starter = g.round % 2 === 1 ? 0 : 1; g.turn = g.type === 'tkm' ? null : g.starter;
  }
  const otherOf = (i) => (i === 0 ? 1 : 0);

  function view(g, uid) {
    const me = g.players.indexOf(uid); const op = otherOf(me); const s = g.s;
    const base = {
      id: g.id, type: g.type, chatId: g.chatId, round: g.round, status: g.status, me, turn: g.turn, winner: g.winner, wins: g.wins,
      names: g.players.map((p) => (user(p)?.name || 'Oyuncu').split(' ')[0]), at: g.updatedAt,
    };
    if (g.type === 'xox' || g.type === 'dorttas') return { ...base, board: s.board, line: s.line, last: s.last ?? null };
    if (g.type === 'tkm') {
      const cur = { mine: s.picks[me] ?? null, theirs: s.picks[op] != null };
      return { ...base, cur, rounds: s.rounds.map((r) => ({ mine: r.p[me], theirs: r.p[op], w: r.w === -1 ? -1 : r.w === me ? 'me' : 'them' })) };
    }
    if (g.type === 'amiral') {
      const ended = g.status === 'ended';
      const hitOn = (fleet, c) => fleet.some((sh) => sh.includes(c));
      const sunkOf = (fleet, shots) => fleet.filter((sh) => sh.every((c) => shots.includes(c)));
      const theirFleet = s.fleets[op]; const myFleet = s.fleets[me];
      return {
        ...base, size: SEA, fleet: FLEET, ready: s.ready, mine: myFleet,
        myShots: s.shots[me].map((c) => ({ c, hit: hitOn(theirFleet, c) })), theirShots: s.shots[op].map((c) => ({ c, hit: hitOn(myFleet, c) })),
        sunkTheirs: sunkOf(theirFleet, s.shots[me]), sunkMine: sunkOf(myFleet, s.shots[op]).length, reveal: ended ? theirFleet : null, last: s.last,
      };
    }
    return base;
  }
  const push = (g) => g.players.forEach((u) => emitTo(u, 'mini', view(g, u)));
  const save = (g) => { g.updatedAt = now(); store.put('mini_games', g); };
  function finish(g, w) {
    g.status = 'ended'; g.winner = w; g.turn = null;
    if (w === 0 || w === 1) { g.wins[w] = (g.wins[w] || 0) + 1; ctx.addXp?.(g.players[w], 'oyun', 1); }
  }
  function nudge(g, idx) { // sıra geçince rakibe (çok sık değil) haber ver
    const to = g.players[idx]; const from = g.players[otherOf(idx)];
    if (limited(`mini-n:${g.id}:${to}`, 1, 15 * 60000)) return;
    notify(to, { type: 'message', fromId: from, text: `${TYPES[g.type].emoji} ${TYPES[g.type].name}: sıra sende!`, url: `/#/chat/${g.chatId}`, tag: 'chat-' + g.chatId });
  }

  // ---- Hamleler ----
  function move(g, me, b) {
    const s = g.s; const op = otherOf(me);
    if (g.status === 'ended') return 'Oyun bitti. Tekrar oynamak için “Tekrar” de.';
    if (g.type === 'xox') {
      if (g.turn !== me) return 'Sıra sende değil.';
      const c = parseInt(b.cell, 10); if (!(c >= 0 && c < 9) || s.board[c] != null) return 'Bu kare dolu.';
      s.board[c] = me; s.last = c;
      const line = XOX_LINES.find((l) => l.every((x) => s.board[x] === me));
      if (line) { s.line = line; finish(g, me); } else if (s.board.every((x) => x != null)) finish(g, -1); else { g.turn = op; nudge(g, op); }
      return null;
    }
    if (g.type === 'dorttas') {
      if (g.turn !== me) return 'Sıra sende değil.';
      const col = parseInt(b.col, 10); if (!(col >= 0 && col < C4.w)) return 'Geçersiz sütun.';
      let row = -1; for (let r = C4.h - 1; r >= 0; r--) if (s.board[r * C4.w + col] == null) { row = r; break; }
      if (row < 0) return 'Bu sütun dolu.';
      const at = row * C4.w + col; s.board[at] = me; s.last = at;
      const get = (r, c) => (r >= 0 && r < C4.h && c >= 0 && c < C4.w ? s.board[r * C4.w + c] : undefined);
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        const cells = [at];
        for (let k = 1; get(row + dr * k, col + dc * k) === me; k++) cells.push((row + dr * k) * C4.w + col + dc * k);
        for (let k = 1; get(row - dr * k, col - dc * k) === me; k++) cells.push((row - dr * k) * C4.w + col - dc * k);
        if (cells.length >= 4) { s.line = cells; finish(g, me); return null; }
      }
      if (s.board.every((x) => x != null)) finish(g, -1); else { g.turn = op; nudge(g, op); }
      return null;
    }
    if (g.type === 'tkm') {
      const p = String(b.pick || ''); if (!TKM.includes(p)) return 'Taş, kağıt ya da makas seç.';
      if (s.picks[me]) return 'Bu turda seçimini yaptın.';
      s.picks[me] = p;
      if (s.picks[op]) {
        const [a, c] = s.picks; const w = a === c ? -1 : beats(a, c) ? 0 : 1;
        s.rounds.push({ p: [a, c], w }); s.picks = [null, null];
        const score = [0, 1].map((i) => s.rounds.filter((r) => r.w === i).length);
        if (score[0] >= 2 || score[1] >= 2) finish(g, score[0] >= 2 ? 0 : 1);
        else if (s.rounds.length >= 7) finish(g, score[0] === score[1] ? -1 : score[0] > score[1] ? 0 : 1);
      } else nudge(g, op);
      return null;
    }
    if (g.type === 'amiral') {
      if (b.type === 'shuffle') { if (g.status !== 'setup' || s.ready[me]) return 'Gemilerin yerleşti.'; s.fleets[me] = placeFleet(); return null; }
      if (b.type === 'ready') {
        if (g.status !== 'setup') return null; s.ready[me] = true;
        if (s.ready[op]) { g.status = 'playing'; g.turn = g.starter; nudge(g, g.starter); } else nudge(g, op);
        return null;
      }
      if (g.status !== 'playing') return 'Önce iki taraf da gemilerini yerleştirmeli.';
      if (g.turn !== me) return 'Sıra sende değil.';
      const c = parseInt(b.cell, 10); if (!(c >= 0 && c < SEA * SEA)) return 'Geçersiz kare.';
      if (s.shots[me].includes(c)) return 'Buraya zaten atış yaptın.';
      s.shots[me].push(c);
      const ship = s.fleets[op].find((sh) => sh.includes(c));
      const sunk = ship && ship.every((x) => s.shots[me].includes(x));
      s.last = { by: me, c, hit: !!ship, sunk: !!sunk };
      if (s.fleets[op].every((sh) => sh.every((x) => s.shots[me].includes(x)))) { finish(g, me); return null; }
      if (!ship) { g.turn = op; nudge(g, op); } // isabet eden tekrar atar
      return null;
    }
    return 'Geçersiz hamle.';
  }

  // ---- Uç noktalar ----
  const gameFor = (req, res) => {
    const g = store.get('mini_games', req.params.id);
    if (!g || !g.players.includes(req.user.id)) { res.status(404).json({ error: 'Oyun bulunamadı.' }); return null; }
    return g;
  };
  app.post('/api/chats/:id/mini', auth, (req, res) => {
    const c = store.get('chats', req.params.id);
    if (!c || !c.members.includes(req.user.id)) return res.status(404).json({ error: 'Sohbet bulunamadı.' });
    if (c.isGroup) return res.status(400).json({ error: 'Bu oyunlar birebir sohbetlerde oynanır.' });
    const otherId = c.members.find((m) => m !== req.user.id); const o = user(otherId);
    if (!o || ['falci', 'official'].includes(o.role) || ['falci', 'official'].includes(req.user.role)) return res.status(403).json({ error: 'Bu sohbette oyun oynanamaz.' });
    if (isBlocked(req.user.id, otherId)) return res.status(403).json({ error: 'Bu kişiyle oynayamazsın.' });
    const type = String(req.body?.type || ''); if (!TYPES[type]) return res.status(400).json({ error: 'Oyun bulunamadı.' });
    if (limited(`mini:${req.user.id}`, 30, DAY)) return res.status(429).json({ error: 'Bugün yeterince oyun başlattın 🙂' });
    const g = { id: nanoid(10), type, chatId: c.id, players: [req.user.id, otherId], wins: [0, 0], createdAt: now() };
    newRound(g); save(g);
    const msg = sendMessage(c, req.user.id, { text: TYPES[type].text, game: { kind: 'mini', type, id: g.id } });
    if (!msg) { store.del('mini_games', g.id); return res.status(400).json({ error: 'Gönderilemedi.' }); }
    g.msgId = msg.id; save(g);
    res.json(ctx.msgOut(msg));
  });
  app.get('/api/mini/:id', auth, (req, res) => { const g = gameFor(req, res); if (g) res.json(view(g, req.user.id)); });
  app.post('/api/mini/:id/move', auth, (req, res) => {
    const g = gameFor(req, res); if (!g) return;
    if (limited(`mini-m:${req.user.id}`, 300, 60000)) return res.status(429).json({ error: 'Biraz yavaş 🙂' });
    const err = move(g, g.players.indexOf(req.user.id), req.body || {});
    if (err) return res.status(400).json({ error: err });
    save(g); push(g); res.json(view(g, req.user.id));
  });
  app.post('/api/mini/:id/again', auth, (req, res) => {
    const g = gameFor(req, res); if (!g) return;
    if (g.status !== 'ended') return res.status(409).json({ error: 'Oyun daha bitmedi.' });
    newRound(g); save(g); push(g);
    nudge(g, otherOf(g.players.indexOf(req.user.id)));
    res.json(view(g, req.user.id));
  });

  // Eski oyunları temizle (30 gün hareketsiz)
  setInterval(() => {
    const cut = now() - 30 * DAY;
    store.filter('mini_games', (g) => (g.updatedAt || g.createdAt) < cut).forEach((g) => store.del('mini_games', g.id));
  }, 6 * 3600000).unref?.();

  ctx.miniTypes = TYPES;
};

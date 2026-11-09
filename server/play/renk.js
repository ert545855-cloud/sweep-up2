// Renk Eşle (2–6 kişi): rengi ya da sayıyı/simgeyi eşle; Atla, Yön Değiştir, +2, Renk Seç, +4.
const COLS = ['r', 'y', 'g', 'b'];
const COL_TR = { r: 'kırmızı', y: 'sarı', g: 'yeşil', b: 'mavi' };
const VAL_TR = { skip: 'Atla', rev: 'Yön değiştir', d2: '+2', wild: 'Renk seç', d4: '+4' };
function newDeck() {
  const d = []; let id = 0;
  for (const c of COLS) {
    d.push({ id: `k${id++}`, c, v: '0' });
    for (let n = 1; n <= 9; n++) for (let k = 0; k < 2; k++) d.push({ id: `k${id++}`, c, v: String(n) });
    for (const v of ['skip', 'rev', 'd2']) for (let k = 0; k < 2; k++) d.push({ id: `k${id++}`, c, v });
  }
  for (let k = 0; k < 4; k++) { d.push({ id: `k${id++}`, c: 'w', v: 'wild' }); d.push({ id: `k${id++}`, c: 'w', v: 'd4' }); }
  return d;
}
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pts = (c) => (c.c === 'w' ? 50 : /^\d$/.test(c.v) ? +c.v : 20);
const label = (c) => (c.c === 'w' ? VAL_TR[c.v] : `${COL_TR[c.c]} ${VAL_TR[c.v] || c.v}`);
const playable = (g, c) => c.c === 'w' || c.c === g.color || c.v === g.top.v;
function draw(g, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (!g.deck.length) { const top = g.pile.pop(); g.deck = shuffle(g.pile.map((x) => (x.c === 'w' ? { ...x } : x))); g.pile = [top]; }
    if (!g.deck.length) break;
    out.push(g.deck.pop());
  }
  return out;
}

module.exports = (kit) => kit.register({
  key: 'renk', name: 'Renk Eşle', icon: 'renk', emoji: '🌈', min: 2, max: 6, size: 4, bots: true, turnMs: 25000,
  setup(t) {
    const g = t.g; const n = t.seats.length;
    g.deck = shuffle(newDeck()); g.hands = Array.from({ length: n }, () => g.deck.splice(0, 7));
    let k = g.deck.findIndex((c) => /^\d$/.test(c.v)); const first = g.deck.splice(k, 1)[0];
    g.pile = [first]; g.top = first; g.color = first.c; g.dir = 1; g.cur = Math.floor(Math.random() * n); g.phase = 'play'; g.drawn = null; g.last = null;
  },
  turn: (t) => t.g.cur,
  botDelay: () => 900 + Math.random() * 600,
  view(t, me) {
    const g = t.g;
    const myTurn = me === g.cur;
    return {
      rk: {
        hand: me >= 0 ? g.hands[me] : [], counts: g.hands.map((h) => h.length), top: g.top, color: g.color, dir: g.dir, deck: g.deck.length, phase: g.phase, drawn: myTurn ? g.drawn : null,
        playable: myTurn ? g.hands[me].filter((c) => (g.phase === 'drawn' ? c.id === g.drawn : playable(g, c))).map((c) => c.id) : [], last: g.last,
      },
    };
  },
  move(t, seat, b) {
    const g = t.g; const n = t.seats.length; const h = g.hands[seat];
    const step = (k = 1) => (seat + g.dir * k + n * 3) % n;
    if (b.type === 'draw') {
      if (g.phase === 'drawn') return 'Zaten çektin; kartı oyna ya da geç.';
      const [c] = draw(g, 1); if (!c) { g.cur = step(); return null; }
      h.push(c); g.last = { seat, drew: 1 };
      if (playable(g, c)) { g.phase = 'drawn'; g.drawn = c.id; } else { g.cur = step(); }
      return null;
    }
    if (b.type === 'pass') { if (g.phase !== 'drawn') return 'Önce kart çek.'; g.phase = 'play'; g.drawn = null; g.cur = step(); return null; }
    if (b.type !== 'play') return 'Geçersiz hamle.';
    const k = h.findIndex((c) => c.id === b.card); if (k < 0) return 'Bu kart elinde yok.';
    const c = h[k];
    if (g.phase === 'drawn' && c.id !== g.drawn) return 'Sadece çektiğin kartı oynayabilirsin.';
    if (!playable(g, c)) return 'Bu kart yerdekiyle eşleşmiyor.';
    if (c.c === 'w' && !COLS.includes(b.color)) return 'Bir renk seç.';
    h.splice(k, 1); g.pile.push(c); g.top = c; g.color = c.c === 'w' ? b.color : c.c; g.phase = 'play'; g.drawn = null;
    g.last = { seat, card: c, color: g.color };
    if (!h.length) {
      const sum = g.hands.reduce((a, hh) => a + hh.reduce((x, y) => x + pts(y), 0), 0);
      g.over = { winners: [seat], points: { [seat]: sum }, text: `${kit.nameOf(t, seat)} kartlarını bitirdi! +${sum}` }; return null;
    }
    if (h.length === 1) kit.log(t, `${kit.nameOf(t, seat)}: Tek kart! ☝️`);
    if (c.v === 'rev') { g.dir *= -1; g.cur = n === 2 ? seat : (seat + g.dir + n) % n; return null; }
    if (c.v === 'skip') { g.cur = step(2); return null; }
    if (c.v === 'd2' || c.v === 'd4') {
      const victim = step(1); const got = draw(g, c.v === 'd2' ? 2 : 4); g.hands[victim].push(...got);
      kit.log(t, `${kit.nameOf(t, victim)} ${got.length} kart çekti${c.v === 'd4' ? `, renk ${COL_TR[g.color]}` : ''}.`);
      g.cur = step(2); return null;
    }
    if (c.v === 'wild') kit.log(t, `${kit.nameOf(t, seat)} rengi ${COL_TR[g.color]} yaptı.`);
    g.cur = step(1); return null;
  },
  bot(t, seat) {
    const g = t.g; const h = g.hands[seat]; const n = t.seats.length;
    const nextCount = g.hands[(seat + g.dir + n) % n].length;
    const can = g.phase === 'drawn' ? h.filter((c) => c.id === g.drawn) : h.filter((c) => playable(g, c));
    if (!can.length) return g.phase === 'drawn' ? { type: 'pass' } : { type: 'draw' };
    const counts = {}; h.forEach((c) => { if (c.c !== 'w') counts[c.c] = (counts[c.c] || 0) + 1; });
    const bestColor = COLS.slice().sort((a, b) => (counts[b] || 0) - (counts[a] || 0))[0];
    const score = (c) => {
      let s = 0;
      if (c.c === 'w') s -= 40 - (h.length <= 2 ? 40 : 0) - (nextCount <= 2 && c.v === 'd4' ? 60 : 0);
      if (['skip', 'd2', 'rev'].includes(c.v)) s += nextCount <= 2 ? 30 : 6;
      if (/^\d$/.test(c.v)) s += +c.v * 0.6;
      if (c.c === g.color) s += 3;
      s += (counts[c.c] || 0) * 0.8;
      return s;
    };
    const pick = can.slice().sort((a, b) => score(b) - score(a))[0];
    return { type: 'play', card: pick.id, color: pick.c === 'w' ? bestColor : undefined };
  },
  fallback(t, seat) { const g = t.g; return g.phase === 'drawn' ? { type: 'pass' } : { type: 'draw', seat }; },
});
module.exports.label = label;

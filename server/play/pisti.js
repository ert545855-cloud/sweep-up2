// Pişti (2–4 kişi, herkes kendi için): aynı kartla ya da valeyle yerdekileri al; tek karta aynısını atarsan pişti.
const { deck, shuffle, name } = require('../cards');

const cardPts = (c) => (c.r === 1 || c.r === 11 ? 1 : 0) + (c.s === 'C' && c.r === 2 ? 2 : 0) + (c.s === 'D' && c.r === 10 ? 3 : 0);
const sum = (cs) => cs.reduce((a, c) => a + cardPts(c), 0);

function deal(g, n) { for (let i = 0; i < n; i++) g.hands[i].push(...g.deck.splice(0, 4)); }
function score(g, n) {
  const pts = new Array(n).fill(0);
  for (let i = 0; i < n; i++) pts[i] = sum(g.taken[i]) + g.pisti[i];
  const counts = g.taken.map((x) => x.length); const max = Math.max(...counts);
  if (counts.filter((c) => c === max).length === 1) pts[counts.indexOf(max)] += 3;
  return pts;
}

module.exports = (kit) => kit.register({
  key: 'pisti', name: 'Pişti', icon: 'pisti', emoji: '🃏', min: 2, max: 4, size: 2, bots: true, turnMs: 25000,
  setup(t) {
    const g = t.g; const n = t.seats.length;
    g.deck = shuffle(deck()); g.pile = g.deck.splice(0, 4); g.hidden = 3; // ilk 3 kart kapalı
    g.hands = Array.from({ length: n }, () => []); g.taken = Array.from({ length: n }, () => []); g.pisti = new Array(n).fill(0); g.pistiN = new Array(n).fill(0);
    g.dealer = ((t.round || 1) - 1) % n; g.cur = (g.dealer + 1) % n; g.lastTaker = null; g.seen = {}; g.last = null;
    deal(g, n); g.pile.slice(3).forEach((c) => { g.seen[c.r] = (g.seen[c.r] || 0) + 1; });
  },
  turn: (t) => t.g.cur,
  botDelay: () => 900 + Math.random() * 700,
  view(t, me) {
    const g = t.g; const n = t.seats.length;
    return {
      ps: {
        hand: me >= 0 ? g.hands[me] : [], counts: g.hands.map((h) => h.length), pile: g.pile.length, top: g.pile.length ? g.pile[g.pile.length - 1] : null, under: g.pile.length > 1 && g.pile.length - 1 > g.hidden ? g.pile[g.pile.length - 2] : null,
        deck: g.deck.length, taken: g.taken.map((x) => x.length), pisti: g.pistiN, live: score(g, n), last: g.last, final: t.status === 'ended' ? g.final : null,
      },
    };
  },
  move(t, seat, b) {
    const g = t.g; const n = t.seats.length;
    if (b.type !== 'play') return 'Geçersiz hamle.';
    const k = g.hands[seat].findIndex((c) => c.id === b.card); if (k < 0) return 'Bu kart elinde yok.';
    const [c] = g.hands[seat].splice(k, 1);
    const top = g.pile[g.pile.length - 1];
    g.seen[c.r] = (g.seen[c.r] || 0) + 1;
    const nm = kit.nameOf(t, seat);
    if (top && (c.r === top.r || c.r === 11)) {
      const isPisti = g.pile.length === 1 && c.r === top.r;
      g.pile.push(c);
      g.taken[seat].push(...g.pile);
      if (isPisti) { const p = c.r === 11 ? 20 : 10; g.pisti[seat] += p; g.pistiN[seat]++; kit.log(t, `${nm} PİŞTİ yaptı! +${p}`); }
      g.last = { seat, card: c, took: g.pile.length, pisti: isPisti };
      g.pile = []; g.hidden = 0; g.lastTaker = seat;
    } else { g.pile.push(c); g.last = { seat, card: c, took: 0 }; }
    g.cur = (seat + 1) % n;
    if (g.hands.every((h) => !h.length)) {
      if (g.deck.length >= 4 * n) deal(g, n);
      else {
        if (g.pile.length && g.lastTaker != null) { g.taken[g.lastTaker].push(...g.pile); g.pile = []; }
        const pts = score(g, n); const best = Math.max(...pts);
        const winners = pts.map((p, i) => (p === best ? i : -1)).filter((i) => i >= 0);
        g.final = pts;
        g.over = { winners, points: Object.fromEntries(pts.map((p, i) => [i, p])), text: winners.length > 1 ? `Berabere: ${best} puan` : `${kit.nameOf(t, winners[0])} kazandı · ${best} puan` };
      }
    }
    return null;
  },
  bot(t, seat) {
    const g = t.g; const h = g.hands[seat]; const top = g.pile[g.pile.length - 1];
    const same = top && h.find((c) => c.r === top.r);
    const jack = h.find((c) => c.r === 11);
    const pileVal = g.pile.length + sum(g.pile) * 2;
    if (top && g.pile.length === 1 && same) return { type: 'play', card: same.id };
    if (same && (pileVal >= 2 || same.r !== 11)) return { type: 'play', card: same.id };
    if (jack && top && (pileVal >= 5 || (g.pile.length >= 3))) return { type: 'play', card: jack.id };
    // Rakibe pişti fırsatı vermemek için en çok görülmüş, en değersiz kartı at; valeyi sakla
    const pool = h.filter((c) => c.r !== 11); const cand = pool.length ? pool : h;
    cand.sort((a, b) => (cardPts(a) - cardPts(b)) || ((g.seen[b.r] || 0) - (g.seen[a.r] || 0)));
    return { type: 'play', card: cand[0].id };
  },
});

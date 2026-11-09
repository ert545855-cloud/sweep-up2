// İhaleli Batak (4 kişi, herkes kendi için): ihale, koz seçimi, renge uyma ve yükseltme zorunluluğu.
const { deck, shuffle, SUITS, SUIT_TR, hi, sortHand } = require('../cards');

const MIN_BID = 4;
function legalCards(g, seat) {
  const h = g.hands[seat]; const trick = g.trick; const trump = g.trump;
  if (!trick.length) {
    // Koz açılmadıysa elde koz dışı kart varken koz ile başlanamaz
    if (!g.broken) { const non = h.filter((c) => c.s !== trump); if (non.length) return non; }
    return h.slice();
  }
  const led = trick[0].c.s;
  const best = winnerOf(trick, trump);
  const follow = h.filter((c) => c.s === led);
  if (follow.length) {
    // Renge uy; mümkünse yükselt (koz atılmamışsa)
    if (best.c.s === led) { const higher = follow.filter((c) => hi(c.r) > hi(best.c.r)); if (higher.length) return higher; }
    return follow;
  }
  const trumps = h.filter((c) => c.s === trump);
  if (trumps.length) {
    if (best.c.s === trump) { const over = trumps.filter((c) => hi(c.r) > hi(best.c.r)); if (over.length) return over; }
    return trumps;
  }
  return h.slice();
}
function winnerOf(trick, trump) {
  const led = trick[0].c.s; let best = trick[0];
  for (const x of trick.slice(1)) {
    const bt = best.c.s === trump; const xt = x.c.s === trump;
    if (xt && !bt) best = x; else if (xt === bt && x.c.s === best.c.s && hi(x.c.r) > hi(best.c.r)) best = x; else if (!xt && !bt && x.c.s === led && best.c.s !== led) best = x;
  }
  return best;
}
// Bot: elin kaç el alacağını tahmin et
function estimate(h) {
  let best = { s: 'S', v: -1, est: 0 };
  for (const s of SUITS) {
    let est = 0;
    for (const t of SUITS) {
      const cs = h.filter((c) => c.s === t).map((c) => hi(c.r)); const n = cs.length;
      if (cs.includes(14)) est += 1; if (cs.includes(13)) est += n >= 2 ? 0.75 : 0.3; if (cs.includes(12)) est += n >= 3 ? 0.4 : 0.1;
      if (t === s) est += Math.max(0, n - 3) * 0.85 + (n >= 3 && cs.includes(11) ? 0.3 : 0);
      else if (n <= 1 && h.filter((c) => c.s === s).length >= 4) est += n === 0 ? 0.8 : 0.4; // kesme şansı
    }
    const v = est + h.filter((c) => c.s === s).length * 0.05;
    if (v > best.v) best = { s, v, est };
  }
  return best;
}

module.exports = (kit) => kit.register({
  key: 'batak', name: 'Batak', icon: 'batak', emoji: '♠️', min: 4, max: 4, bots: true,
  turnMs: (t) => (t.g.phase === 'bid' || t.g.phase === 'trump' ? 25000 : 25000),
  setup(t) {
    const g = t.g; const d = shuffle(deck());
    g.hands = [0, 1, 2, 3].map((i) => sortHand(d.slice(i * 13, i * 13 + 13)));
    g.dealer = ((t.round || 1) - 1) % 4; g.phase = 'bid'; g.cur = (g.dealer + 1) % 4; g.bids = [null, null, null, null]; g.bidTurns = 0;
    g.high = 0; g.bidder = null; g.trump = null; g.broken = false; g.trick = []; g.tricks = [0, 0, 0, 0]; g.lastTrick = null; g.played = 0;
  },
  turn: (t) => t.g.cur,
  botDelay: (t) => (t.g.phase === 'play' && t.g.trick.length === 0 && t.g.lastTrick && Date.now() - t.g.lastTrick.at < 1200 ? 1500 : 800 + Math.random() * 700),
  view(t, me) {
    const g = t.g;
    return {
      bt: {
        phase: g.phase, hand: me >= 0 ? g.hands[me] : [], counts: g.hands.map((h) => h.length), bids: g.bids, high: g.high, bidder: g.bidder, trump: g.trump, trick: g.trick, tricks: g.tricks, lastTrick: g.lastTrick,
        legal: me >= 0 && g.phase === 'play' && g.cur === me ? legalCards(g, me).map((c) => c.id) : [], minBid: Math.max(MIN_BID, g.high + 1), forced: g.phase === 'bid' && g.cur === g.dealer && g.high === 0, result: g.handPts || null,
      },
    };
  },
  move(t, seat, b) {
    const g = t.g;
    if (g.phase === 'bid') {
      if (b.type !== 'bid') return 'Önce ihale ver ya da pas geç.';
      const forced = seat === g.dealer && g.high === 0;
      if (b.pass) { if (forced) return 'Herkes pas geçti; ihaleyi sen almak zorundasın (en az 4).'; g.bids[seat] = 'pas'; } else {
        const n = parseInt(b.n, 10);
        if (!Number.isFinite(n) || n < Math.max(MIN_BID, g.high + 1) || n > 13) return `İhale en az ${Math.max(MIN_BID, g.high + 1)} olmalı.`;
        g.bids[seat] = n; g.high = n; g.bidder = seat;
      }
      kit.log(t, `${kit.nameOf(t, seat)}: ${b.pass ? 'pas' : `${g.bids[seat]} ihale`}`);
      g.bidTurns++;
      if (g.bidTurns >= 4) { g.phase = 'trump'; g.cur = g.bidder; } else g.cur = (seat + 1) % 4;
      return null;
    }
    if (g.phase === 'trump') {
      if (b.type !== 'trump' || !SUITS.includes(b.s)) return 'Koz seç.';
      g.trump = b.s; g.phase = 'play'; g.cur = g.bidder; g.hands.forEach((h) => sortHand(h, g.trump));
      kit.log(t, `${kit.nameOf(t, seat)} ${g.high} ile ihaleyi aldı, koz ${SUIT_TR[b.s]}.`);
      return null;
    }
    if (b.type !== 'play') return 'Kart oyna.';
    const legal = legalCards(g, seat);
    const c = legal.find((x) => x.id === b.card);
    if (!c) return g.hands[seat].some((x) => x.id === b.card) ? 'Bu kartı şu an atamazsın (renge uy, mümkünse yükselt ya da koz at).' : 'Bu kart elinde yok.';
    g.hands[seat].splice(g.hands[seat].indexOf(c), 1);
    if (c.s === g.trump) g.broken = true;
    g.trick.push({ seat, c });
    if (g.trick.length < 4) { g.cur = (seat + 1) % 4; return null; }
    const w = winnerOf(g.trick, g.trump).seat;
    g.tricks[w]++; g.lastTrick = { cards: g.trick, winner: w, at: Date.now() }; g.trick = []; g.cur = w; g.played++;
    if (g.played === 13) {
      const pts = [0, 1, 2, 3].map((i) => {
        if (i === g.bidder) return g.tricks[i] >= g.high ? g.tricks[i] * 10 : -g.high * 10;
        return g.tricks[i] * 10;
      });
      g.handPts = pts;
      const made = g.tricks[g.bidder] >= g.high;
      const best = Math.max(...pts); const winners = pts.map((p, i) => (p === best ? i : -1)).filter((i) => i >= 0);
      g.over = { winners, points: Object.fromEntries(pts.map((p, i) => [i, p])), text: `${kit.nameOf(t, g.bidder)} ihaleyi ${made ? `yaptı (${g.tricks[g.bidder]}/${g.high})` : `tutturamadı, battı (${g.tricks[g.bidder]}/${g.high})`}` };
    }
    return null;
  },
  bot(t, seat) {
    const g = t.g; const h = g.hands[seat];
    if (g.phase === 'bid') {
      const forced = seat === g.dealer && g.high === 0;
      const e = estimate(h); const need = Math.max(MIN_BID, g.high + 1);
      if (e.est >= need - 0.2 && need <= 13) return { type: 'bid', n: need };
      return forced ? { type: 'bid', n: MIN_BID } : { type: 'bid', pass: true };
    }
    if (g.phase === 'trump') return { type: 'trump', s: estimate(h).s };
    const legal = legalCards(g, seat);
    const byLow = legal.slice().sort((a, b) => (a.s === g.trump) - (b.s === g.trump) || hi(a.r) - hi(b.r));
    if (!g.trick.length) {
      // As ile başla; ihaleyi alan ve koz açıldıysa kozla çek; yoksa en uzun renkten küçük kart
      const ace = legal.find((c) => c.r === 1 && c.s !== g.trump);
      if (ace) return { type: 'play', card: ace.id };
      if (seat === g.bidder && g.broken) { const tr = legal.filter((c) => c.s === g.trump).sort((a, b) => hi(b.r) - hi(a.r)); if (tr.length >= 2) return { type: 'play', card: tr[0].id }; }
      const len = (s) => h.filter((c) => c.s === s).length;
      const pick = legal.filter((c) => c.s !== g.trump).sort((a, b) => len(b.s) - len(a.s) || hi(a.r) - hi(b.r))[0] || byLow[0];
      return { type: 'play', card: pick.id };
    }
    const best = winnerOf(g.trick, g.trump);
    const beats = (c) => { const tmp = [...g.trick, { seat, c }]; return winnerOf(tmp, g.trump).seat === seat; };
    const winners = legal.filter(beats).sort((a, b) => (a.s === g.trump) - (b.s === g.trump) || hi(a.r) - hi(b.r));
    const last = g.trick.length === 3;
    if (winners.length && (last || hi(winners[0].r) >= 12 || winners[0].s === g.trump || best.c.s !== g.trump)) return { type: 'play', card: winners[0].id };
    return { type: 'play', card: byLow[0].id };
  },
});
module.exports.rules = { legalCards, winnerOf, estimate };

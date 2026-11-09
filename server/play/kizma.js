// Kızma Birader (2–4 kişi): 6 ile çık, rakibi eve gönder, 4 piyonu da önce eve getiren kazanır.
// Piyon konumu: -1 avlu, 0-50 yol (renge göre), 51-55 ev yolu, 56 bitiş.
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const COLORS_BY_N = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };
const absOf = (color, p) => (color * 13 + p) % 52;

function movable(g, seat, d) {
  const out = [];
  g.pawns[seat].forEach((p, k) => {
    if (p === 56) return;
    if (p === -1) { if (d === 6) out.push(k); return; }
    if (p + d <= 56) out.push(k);
  });
  return out;
}
function target(g, seat, k, d) { const p = g.pawns[seat][k]; return p === -1 ? 0 : p + d; }

module.exports = (kit) => kit.register({
  key: 'kizma', name: 'Kızma Birader', icon: 'kizma', emoji: '🎲', min: 2, max: 4, size: 4, bots: true, turnMs: 25000,
  setup(t) {
    const g = t.g; const n = t.seats.length;
    g.colors = COLORS_BY_N[n]; g.pawns = Array.from({ length: n }, () => [-1, -1, -1, -1]);
    g.cur = Math.floor(Math.random() * n); g.phase = 'roll'; g.die = null; g.sixes = 0; g.opts = []; g.last = null;
  },
  turn: (t) => t.g.cur,
  botDelay: (t) => (t.g.phase === 'roll' ? 750 : 650),
  view(t, me) {
    const g = t.g;
    return { kz: { colors: g.colors, pawns: g.pawns, cur: g.cur, phase: g.phase, die: g.die, opts: me === g.cur ? g.opts : [], last: g.last } };
  },
  move(t, seat, b) {
    const g = t.g; const n = t.seats.length;
    const next = () => { g.cur = (g.cur + 1) % n; g.phase = 'roll'; g.sixes = 0; g.opts = []; };
    if (b.type === 'roll') {
      if (g.phase !== 'roll') return 'Zar zaten atıldı.';
      g.die = 1 + Math.floor(Math.random() * 6);
      if (g.die === 6) g.sixes++;
      if (g.sixes >= 3) { kit.log(t, `${kit.nameOf(t, seat)} üç kez 6 attı, sıra geçti.`); g.last = { seat, roll: g.die, none: true }; next(); return null; }
      g.opts = movable(g, seat, g.die);
      if (!g.opts.length) { g.last = { seat, roll: g.die, none: true }; if (g.die === 6) { g.phase = 'roll'; return null; } next(); return null; }
      g.phase = 'move';
      // Tek seçenek varsa otomatik oyna
      if (g.opts.length === 1 || new Set(g.opts.map((k) => g.pawns[seat][k])).size === 1) return this.move(t, seat, { type: 'move', pawn: g.opts[0] });
      return null;
    }
    if (b.type === 'move') {
      if (g.phase !== 'move') return 'Önce zar at.';
      const k = Number(b.pawn); if (!g.opts.includes(k)) return 'Bu piyon oynayamaz.';
      const to = target(g, seat, k, g.die); const from = g.pawns[seat][k];
      g.pawns[seat][k] = to;
      let hit = null;
      if (to <= 50) {
        const a = absOf(g.colors[seat], to);
        if (!SAFE.has(a)) {
          g.pawns.forEach((ps, s) => { if (s === seat) return; ps.forEach((p, j) => { if (p >= 0 && p <= 50 && absOf(g.colors[s], p) === a) { ps[j] = -1; hit = s; } }); });
        }
      }
      g.last = { seat, roll: g.die, pawn: k, from, to, hit };
      if (hit != null) kit.log(t, `${kit.nameOf(t, seat)}, ${kit.nameOf(t, hit)} piyonunu eve gönderdi! 😤`);
      if (g.pawns[seat].every((p) => p === 56)) { g.over = { winners: [seat], points: { [seat]: 1 }, text: `${kit.nameOf(t, seat)} bütün piyonlarını eve getirdi!` }; return null; }
      if (g.die === 6 || hit != null || to === 56) { g.phase = 'roll'; g.opts = []; if (g.die !== 6) g.sixes = 0; return null; }
      next(); return null;
    }
    return 'Geçersiz hamle.';
  },
  bot(t, seat) {
    const g = t.g;
    if (g.phase === 'roll') return { type: 'roll' };
    const d = g.die; let best = g.opts[0]; let bs = -1e9;
    for (const k of g.opts) {
      const p = g.pawns[seat][k]; const to = target(g, seat, k, d); let s = 0;
      if (to <= 50) {
        const a = absOf(g.colors[seat], to);
        if (!SAFE.has(a) && g.pawns.some((ps, o) => o !== seat && ps.some((q) => q >= 0 && q <= 50 && absOf(g.colors[o], q) === a))) s += 100;
        // Tehlike: arkasında 1-6 kare içinde rakip var mı
        const danger = (pos) => !SAFE.has(absOf(g.colors[seat], pos)) && g.pawns.some((ps, o) => o !== seat && ps.some((q) => { if (q < 0 || q > 50) return false; const diff = (absOf(g.colors[seat], pos) - absOf(g.colors[o], q) + 52) % 52; return diff >= 1 && diff <= 6; }));
        if (danger(to)) s -= 30;
        if (p >= 0 && p <= 50 && danger(p)) s += 25;
        if (SAFE.has(a)) s += 10;
      }
      if (p === -1) s += 60;
      if (to === 56) s += 80; else if (to >= 51) s += 45;
      s += to * 0.5 + Math.random();
      if (s > bs) { bs = s; best = k; }
    }
    return { type: 'move', pawn: best };
  },
  fallback(t) { const g = t.g; return g.phase === 'roll' ? { type: 'roll' } : { type: 'move', pawn: g.opts[0] }; },
});

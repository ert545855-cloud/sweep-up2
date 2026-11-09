// Tavla (2 kişi): standart kurallar, mars 2 puan. Taşlar her oyuncunun kendi bakışıyla 0-23 arası "rel" konumda düşünülür;
// 0-5 ev, 24 = kırık (bar), -1 = toplandı. Oyuncu 0 için mutlak = rel, oyuncu 1 için mutlak = 23 - rel.
const abs = (p, r) => (p === 0 ? r : 23 - r);
const relOf = (p, a) => (p === 0 ? a : 23 - a);
const roll = () => 1 + Math.floor(Math.random() * 6);

function initial() {
  const pts = new Array(24).fill(null);
  const put = (p, r, n) => { pts[abs(p, r)] = { p, n }; };
  [0, 1].forEach((p) => { put(p, 23, 2); put(p, 12, 5); put(p, 7, 3); put(p, 5, 5); });
  return { pts, bar: [0, 0], off: [0, 0] };
}
const clone = (b) => ({ pts: b.pts.map((x) => (x ? { ...x } : null)), bar: [...b.bar], off: [...b.off] });
const canLand = (b, p, a) => { const s = b.pts[a]; return !s || s.p === p || s.n <= 1; };
function allHome(b, p) {
  if (b.bar[p]) return false;
  for (let a = 0; a < 24; a++) { const s = b.pts[a]; if (s && s.p === p && relOf(p, a) > 5) return false; }
  return true;
}
function singles(b, p, die) {
  const out = [];
  if (b.bar[p] > 0) { const r = 24 - die; if (canLand(b, p, abs(p, r))) out.push({ from: 24, to: r, die }); return out; }
  const home = allHome(b, p);
  for (let a = 0; a < 24; a++) {
    const s = b.pts[a]; if (!s || s.p !== p) continue;
    const r = relOf(p, a); const t = r - die;
    if (t >= 0) { if (canLand(b, p, abs(p, t))) out.push({ from: r, to: t, die }); } else if (home) {
      if (t === -1) out.push({ from: r, to: -1, die });
      else { let higher = false; for (let q = r + 1; q <= 5; q++) { const x = b.pts[abs(p, q)]; if (x && x.p === p) { higher = true; break; } } if (!higher) out.push({ from: r, to: -1, die }); }
    }
  }
  return out;
}
function apply(b, p, m) {
  if (m.from === 24) b.bar[p]--; else { const a = abs(p, m.from); b.pts[a].n--; if (!b.pts[a].n) b.pts[a] = null; }
  if (m.to === -1) { b.off[p]++; return; }
  const a = abs(p, m.to); const s = b.pts[a];
  if (s && s.p !== p) { b.pts[a] = null; b.bar[1 - p]++; }
  if (b.pts[a]) b.pts[a].n++; else b.pts[a] = { p, n: 1 };
}
const key = (b) => `${b.pts.map((s) => (s ? `${s.p}${s.n}` : '-')).join('')}|${b.bar}|${b.off}`;
// Bütün yasal tam diziler (mümkün olan en çok zarı kullanan); tek zar oynanabiliyorsa büyük zar zorunlu
function sequences(b, p, dice) {
  const res = []; let best = 0; const seen = new Set();
  const rec = (bb, left, seq) => {
    const vals = [...new Set(left)];
    let any = false;
    for (const d of vals) {
      for (const m of singles(bb, p, d)) {
        any = true;
        const nb = clone(bb); apply(nb, p, m);
        const nl = left.slice(); nl.splice(nl.indexOf(d), 1);
        const k = `${key(nb)}#${nl.slice().sort().join('')}#${seq.length + 1}`;
        if (seen.has(k)) continue; seen.add(k);
        rec(nb, nl, [...seq, m]);
      }
    }
    if (!any) { if (seq.length > best) { best = seq.length; res.length = 0; } if (seq.length === best && seq.length) res.push({ seq, board: bb }); }
  };
  rec(b, dice, []);
  if (best === 1 && dice.length === 2 && dice[0] !== dice[1]) {
    const hi = Math.max(...res.map((r) => r.seq[0].die));
    return res.filter((r) => r.seq[0].die === hi);
  }
  return res;
}
function legalNow(g) {
  if (g.phase !== 'move') return [];
  const seqs = sequences(g.b, g.cur, g.left);
  const seen = new Set(); const out = [];
  seqs.forEach(({ seq }) => { const m = seq[0]; const k = `${m.from}>${m.to}>${m.die}`; if (!seen.has(k)) { seen.add(k); out.push(m); } });
  return out;
}
// Bot değerlendirmesi
function pip(b, p) { let s = b.bar[p] * 25; for (let a = 0; a < 24; a++) { const x = b.pts[a]; if (x && x.p === p) s += x.n * (relOf(p, a) + 1); } return s; }
function evaluate(b, p) {
  const o = 1 - p; let s = 0;
  s += (b.off[p] - b.off[o]) * 14 + (b.bar[o] - b.bar[p]) * 16 + (pip(b, o) - pip(b, p)) * 0.3;
  const oppAbs = []; for (let a = 0; a < 24; a++) { const x = b.pts[a]; if (x && x.p === o) oppAbs.push(a); }
  let run = 0;
  for (let r = 0; r < 24; r++) {
    const a = abs(p, r); const x = b.pts[a];
    if (x && x.p === p && x.n >= 2) { s += r <= 5 ? 4.5 : r <= 11 ? 2.5 : 1; run++; s += run >= 2 ? run * 1.2 : 0; } else run = 0;
    if (x && x.p === p && x.n === 1) {
      // Rakibin vurabileceği mesafede mi? (rakip kendi yönünde 1-12 ileri gelebiliyorsa)
      const ro = relOf(o, a);
      const shot = oppAbs.some((q) => { const d = relOf(o, q) - ro; return d >= 1 && d <= 12; }) || (b.bar[o] > 0 && 24 - ro <= 12);
      s -= shot ? (r <= 5 ? 9 : 6) : 1.5;
    }
  }
  return s;
}

module.exports = (kit) => kit.register({
  key: 'tavla', name: 'Tavla', icon: 'tavla', emoji: '🎲', min: 2, max: 2, bots: true, turnMs: 40000,
  setup(t) {
    const g = t.g; g.b = initial(); g.cur = Math.floor(Math.random() * 2); g.phase = 'roll'; g.dice = null; g.left = []; g.stack = [];
    kit.log(t, `${kit.nameOf(t, g.cur)} başlıyor.`);
  },
  turn: (t) => t.g.cur,
  botDelay: (t) => (t.g.phase === 'roll' ? 700 : 650 + Math.random() * 350),
  view(t, me) {
    const g = t.g; const mine = me === g.cur;
    return {
      tv: { pts: g.b.pts.map((s) => (s ? [s.p, s.n] : 0)), bar: g.b.bar, off: g.b.off, dice: g.dice, left: g.left, phase: g.phase, cur: g.cur, legal: mine && t.status === 'playing' ? legalNow(g) : [], canUndo: mine && g.stack.length > 0, last: g.lastMoves || [], lastBy: g.lastBy ?? null },
    };
  },
  move(t, seat, body) {
    const g = t.g;
    if (body.type === 'roll') {
      if (g.phase !== 'roll') return 'Zar zaten atıldı.';
      const a = roll(); const b2 = roll(); g.dice = [a, b2]; g.left = a === b2 ? [a, a, a, a] : [a, b2]; g.phase = 'move'; g.stack = []; g.lastMoves = []; g.lastBy = seat; g.plan = null;
      if (!legalNow(g).length) { kit.log(t, `${kit.nameOf(t, seat)} ${a}-${b2} attı, oynayacak hamlesi yok.`); return pass(t); }
      return null;
    }
    if (body.type === 'undo') {
      if (!g.stack.length) return 'Geri alınacak hamle yok.';
      const prev = g.stack.pop(); g.b = prev.b; g.left = prev.left; g.lastMoves.pop(); return null;
    }
    if (body.type === 'move') {
      if (g.phase !== 'move') return 'Önce zar at.';
      const from = Number(body.from); const to = Number(body.to);
      const m = legalNow(g).find((x) => x.from === from && x.to === to && (body.die == null || x.die === Number(body.die)));
      if (!m) return 'Bu hamle yapılamaz.';
      g.stack.push({ b: clone(g.b), left: g.left.slice() });
      const hit = m.to >= 0 && g.b.pts[abs(seat, m.to)] && g.b.pts[abs(seat, m.to)].p !== seat;
      apply(g.b, seat, m); g.left.splice(g.left.indexOf(m.die), 1); g.lastMoves.push({ ...m, hit: !!hit });
      if (g.b.off[seat] === 15) {
        const o = 1 - seat; const mars = g.b.off[o] === 0;
        g.over = { winners: [seat], points: { [seat]: mars ? 2 : 1 }, text: `${kit.nameOf(t, seat)} kazandı${mars ? ' — mars! (2 puan)' : ''}` };
        return null;
      }
      if (!g.left.length || !legalNow(g).length) return pass(t);
      return null;
    }
    return 'Geçersiz hamle.';
  },
  bot(t, seat) {
    const g = t.g;
    if (g.phase === 'roll') return { type: 'roll' };
    if (!g.plan || !g.plan.length) {
      const seqs = sequences(g.b, seat, g.left);
      let best = null; let bs = -Infinity;
      for (const s of seqs) { const v = evaluate(s.board, seat) + Math.random() * 0.4; if (v > bs) { bs = v; best = s.seq; } }
      g.plan = best ? best.slice() : [];
    }
    const m = g.plan.shift();
    return m ? { type: 'move', from: m.from, to: m.to, die: m.die } : null;
  },
  fallback(t) { const g = t.g; if (g.phase === 'roll') return { type: 'roll' }; const m = legalNow(g)[0]; g.plan = null; return m ? { type: 'move', ...m } : null; },
});
function pass(t) {
  const g = t.g; g.cur = 1 - g.cur; g.phase = 'roll'; g.stack = []; g.plan = null;
  return null;
}
module.exports.rules = { initial, sequences, singles, apply, evaluate, abs, relOf };

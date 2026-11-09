// 101 Okey (4 kişi): 21 taş (dağıtan 22), en az 101 sayılık perle ya da 5 çiftle el aç, masadaki perlere işle,
// elini ilk bitiren kazanır. Puanlar ceza puanıdır (az olan iyi).
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function newDeck() {
  const t = [];
  for (let c = 0; c < 4; c++) for (let n = 1; n <= 13; n++) for (let k = 0; k < 2; k++) t.push({ id: `${c}-${n}-${k}`, c, n });
  t.push({ id: 'f-0', fake: true }, { id: 'f-1', fake: true });
  return shuffle(t);
}
const isWild = (t, ok) => !t.fake && t.c === ok.c && t.n === ok.n;
const valOf = (t, ok) => (t.fake ? { c: ok.c, n: ok.n } : { c: t.c, n: t.n });

// Grup geçerli mi? Per (aynı sayı, farklı renk 3-4) ya da seri (aynı renk ardışık 3+; 13-1 yok). Okey her taşın yerine geçer.
function validGroup(tiles, ok) {
  if (tiles.length < 3) return null;
  const J = tiles.filter((t) => isWild(t, ok)); const N = tiles.filter((t) => !isWild(t, ok));
  const vs = N.map((t) => ({ t, ...valOf(t, ok) }));
  // Per
  if (tiles.length <= 4 && vs.every((x) => x.n === (vs[0]?.n ?? 0))) {
    const cols = new Set(vs.map((x) => x.c));
    if (cols.size === vs.length) {
      const n = vs.length ? vs[0].n : 13;
      return { kind: 'set', value: n * tiles.length, order: [...vs.sort((a, b) => a.c - b.c).map((x) => x.t), ...J], n };
    }
  }
  // Seri
  if (vs.length && vs.every((x) => x.c === vs[0].c)) {
    const nums = vs.map((x) => x.n).sort((a, b) => a - b);
    if (new Set(nums).size !== nums.length) return null;
    const lo = nums[0]; const hi = nums[nums.length - 1];
    const gaps = hi - lo + 1 - nums.length; if (gaps > J.length) return null;
    let extra = J.length - gaps; let start = lo; let end = hi;
    while (extra > 0 && end < 13) { end++; extra--; } while (extra > 0 && start > 1) { start--; extra--; }
    if (extra > 0) return null;
    const order = []; const js = J.slice(); let value = 0;
    for (let n = start; n <= end; n++) { const x = vs.find((y) => y.n === n); order.push(x ? x.t : js.shift()); value += n; }
    return { kind: 'run', value, order, c: vs[0].c, start, end };
  }
  if (!vs.length && tiles.length <= 4) return { kind: 'set', value: 0, order: tiles.slice() };
  return null;
}
const validPair = (tiles, ok) => tiles.length === 2 && (tiles.some((t) => isWild(t, ok)) || (() => { const a = valOf(tiles[0], ok); const b = valOf(tiles[1], ok); return a.c === b.c && a.n === b.n; })());
const tilePts = (t, ok) => (isWild(t, ok) ? 101 : valOf(t, ok).n);

// Elden en değerli per kombinasyonu (botlar ve ipucu için)
function bestGroups(hand, ok, opts = {}) {
  const J = hand.filter((t) => isWild(t, ok)); const N = hand.filter((t) => !isWild(t, ok));
  const pool = {}; N.forEach((t) => { const v = valOf(t, ok); const k = `${v.c}-${v.n}`; (pool[k] = pool[k] || []).push(t); });
  const cnt = (c, n) => (pool[`${c}-${n}`] || []).length;
  const cands = [];
  for (let n = 1; n <= 13; n++) {
    const cols = [0, 1, 2, 3].filter((c) => cnt(c, n));
    for (let m = 1; m < 16; m++) {
      const sub = cols.filter((_, i) => m & (1 << i)); if (!sub.length || sub.length !== [...m.toString(2)].filter((x) => x === '1').length) continue;
      for (let j = 0; j <= Math.min(J.length, 4 - sub.length); j++) { const size = sub.length + j; if (size >= 3 && size <= 4) cands.push({ need: sub.map((c) => [c, n]), j, value: n * size }); }
    }
  }
  for (let c = 0; c < 4; c++) for (let s = 1; s <= 11; s++) for (let e = s + 2; e <= 13; e++) {
    const need = []; let miss = 0; for (let n = s; n <= e; n++) { if (cnt(c, n)) need.push([c, n]); else miss++; }
    if (miss <= J.length && need.length >= 1) { let v = 0; for (let n = s; n <= e; n++) v += n; cands.push({ need, j: miss, value: v }); }
  }
  cands.sort((a, b) => b.value - a.value);
  const counts = {}; Object.keys(pool).forEach((k) => { counts[k] = pool[k].length; });
  let best = { value: 0, pick: [] }; let nodes = 0;
  const totalLeft = () => Object.entries(counts).reduce((a, [k, x]) => a + x * +k.split('-')[1], 0);
  const rec = (i, jl, val, pick) => {
    if (++nodes > (opts.cap || 25000)) return;
    if (val > best.value) best = { value: val, pick: pick.slice() };
    if (val + totalLeft() + jl * 13 <= best.value) return;
    for (let k = i; k < cands.length; k++) {
      const cd = cands[k]; if (cd.j > jl) continue;
      if (!cd.need.every(([c, n]) => counts[`${c}-${n}`] > 0)) continue;
      cd.need.forEach(([c, n]) => { counts[`${c}-${n}`]--; }); pick.push(cd);
      rec(k + 1, jl - cd.j, val + cd.value, pick);
      pick.pop(); cd.need.forEach(([c, n]) => { counts[`${c}-${n}`]++; });
      if (nodes > (opts.cap || 25000)) return;
    }
  };
  rec(0, J.length, 0, []);
  // Sayıları gerçek taşlara çevir
  const avail = {}; Object.keys(pool).forEach((k) => { avail[k] = pool[k].slice(); }); const js = J.slice();
  const groups = best.pick.map((cd) => [...cd.need.map(([c, n]) => avail[`${c}-${n}`].shift()), ...js.splice(0, cd.j)]);
  return { value: best.value, groups };
}
function pairsIn(hand, ok) {
  const J = hand.filter((t) => isWild(t, ok)); const N = hand.filter((t) => !isWild(t, ok));
  const by = {}; N.forEach((t) => { const v = valOf(t, ok); const k = `${v.c}-${v.n}`; (by[k] = by[k] || []).push(t); });
  const pairs = []; const singles = [];
  Object.values(by).forEach((a) => { while (a.length >= 2) pairs.push(a.splice(0, 2)); if (a.length) singles.push(...a); });
  const js = J.slice(); singles.sort((a, b) => valOf(b, ok).n - valOf(a, ok).n);
  while (js.length && singles.length) pairs.push([singles.shift(), js.shift()]);
  if (js.length >= 2) pairs.push(js.splice(0, 2));
  return pairs;
}
function useful(t, hand, ok) {
  if (isWild(t, ok)) return 100;
  const v = valOf(t, ok); let s = 0;
  for (const o of hand) {
    if (o === t) continue; if (isWild(o, ok)) { s += 0.5; continue; }
    const w = valOf(o, ok);
    if (w.c === v.c) { const d = Math.abs(w.n - v.n); if (d === 1) s += 3; else if (d === 2) s += 1.4; else if (d === 0) s += 1; } else if (w.n === v.n) s += 2.6;
  }
  return s + v.n * 0.02;
}

module.exports = (kit) => kit.register({
  key: 'okey101', name: '101 Okey', icon: 'okey101', emoji: '🀄', min: 4, max: 4, bots: true, turnMs: 45000,
  setup(t) {
    const g = t.g; const deck = newDeck();
    const ind = deck.findIndex((x) => !x.fake); g.indicator = deck.splice(ind, 1)[0];
    g.okey = { c: g.indicator.c, n: g.indicator.n === 13 ? 1 : g.indicator.n + 1 };
    g.dealer = ((t.round || 1) - 1) % 4;
    g.hands = [0, 1, 2, 3].map((i) => deck.splice(0, i === g.dealer ? 22 : 21));
    g.pile = deck; g.discards = [[], [], [], []]; g.melds = []; g.opened = [null, null, null, null]; g.openVal = [0, 0, 0, 0];
    g.cur = g.dealer; g.phase = 'act'; g.took = null; g.acted = false; g.mid = 0;
    kit.log(t, `Gösterge ${['sarı', 'mavi', 'siyah', 'kırmızı'][g.indicator.c]} ${g.indicator.n}, okey ${['sarı', 'mavi', 'siyah', 'kırmızı'][g.okey.c]} ${g.okey.n}.`);
  },
  turn: (t) => t.g.cur,
  botDelay: () => 900 + Math.random() * 600,
  view(t, me) {
    const g = t.g; const mine = me === g.cur;
    return {
      ok: {
        hand: me >= 0 ? g.hands[me] : [], counts: g.hands.map((h) => h.length), melds: g.melds.map((m) => ({ id: m.id, owner: m.owner, kind: m.kind, tiles: m.tiles })),
        opened: g.opened, openVal: g.openVal, discards: g.discards.map((d) => d[d.length - 1] || null), dcount: g.discards.map((d) => d.length), pile: g.pile.length,
        indicator: g.indicator, okey: g.okey, cur: g.cur, phase: g.phase, took: mine ? g.took : null, final: g.final || null,
      },
    };
  },
  move(t, seat, b) {
    const g = t.g; const h = g.hands[seat]; const ok = g.okey;
    const take = (ids) => { const out = []; for (const id of ids) { const k = h.findIndex((x) => x.id === id); if (k < 0) return null; out.push(h[k]); } if (new Set(ids).size !== ids.length) return null; return out; };
    const removeFromHand = (tiles) => tiles.forEach((x) => h.splice(h.indexOf(x), 1));
    if (b.type === 'draw') {
      if (g.phase !== 'draw') return 'Önce taş at.';
      if (b.from === 'discard') {
        if (g.untook === seat) return 'Geri koyduğun taşı bu el tekrar alamazsın.';
        const prev = (seat + 3) % 4; const tile = g.discards[prev].pop(); if (!tile) return 'Alınacak taş yok.';
        h.push(tile); g.took = tile.id; g.tookFrom = prev; g.mustOpen = !g.opened[seat]; kit.log(t, `${kit.nameOf(t, seat)} yandaki taşı aldı.`);
      } else {
        if (!g.pile.length) return endHand(t, null, 'Ortadaki taşlar bitti.');
        h.push(g.pile.shift()); g.took = null; g.mustOpen = false;
      }
      g.phase = 'act'; g.acted = false; return null;
    }
    if (g.phase !== 'act') return 'Önce taş çek.';
    if (b.type === 'untake') {
      if (!g.took || g.acted) return 'Taşı artık geri koyamazsın.';
      const k = h.findIndex((x) => x.id === g.took); const [tile] = h.splice(k, 1); g.discards[g.tookFrom].push(tile); g.took = null; g.mustOpen = false; g.phase = 'draw'; g.untook = seat; return null;
    }
    if (b.type === 'open') {
      const groups = (Array.isArray(b.groups) ? b.groups : []).map((ids) => take(Array.isArray(ids) ? ids.map(String) : []));
      if (!groups.length || groups.some((x) => !x)) return 'Seçtiğin taşlar elinde yok.';
      const all = groups.flat(); if (new Set(all.map((x) => x.id)).size !== all.length) return 'Bir taşı iki gruba koyamazsın.';
      if (all.length >= h.length) return 'Atmak için elinde en az bir taş kalmalı.';
      const pairs = b.pairs || g.opened[seat] === 'pairs';
      if (pairs) {
        if (g.opened[seat] === 'groups') return 'Perle açtın, çift açamazsın.';
        if (!groups.every((x) => validPair(x, ok))) return 'Her grup aynı iki taştan (ya da okeyle) oluşmalı.';
        if (!g.opened[seat] && groups.length < 5) return 'Çiftle açmak için en az 5 çift gerekli.';
        groups.forEach((x) => g.melds.push({ id: `m${++g.mid}`, owner: seat, kind: 'pair', tiles: x }));
        removeFromHand(all); if (!g.opened[seat]) { g.opened[seat] = 'pairs'; g.openVal[seat] = groups.length; kit.log(t, `${kit.nameOf(t, seat)} ${groups.length} çiftle açtı.`); }
      } else {
        const vs = groups.map((x) => validGroup(x, ok));
        if (vs.some((x) => !x)) return 'Gruplardan biri geçerli değil (aynı renk sıralı ya da aynı sayı farklı renk, en az 3 taş).';
        const sum = vs.reduce((a, x) => a + x.value, 0);
        if (!g.opened[seat] && sum < 101) return `Açmak için en az 101 gerekli, şu an ${sum}.`;
        vs.forEach((x) => g.melds.push({ id: `m${++g.mid}`, owner: seat, kind: x.kind, tiles: x.order }));
        removeFromHand(all); if (!g.opened[seat]) { g.opened[seat] = 'groups'; g.openVal[seat] = sum; kit.log(t, `${kit.nameOf(t, seat)} ${sum} ile elini açtı.`); }
      }
      g.acted = true;
      return null;
    }
    if (b.type === 'add') {
      if (!g.opened[seat]) return 'İşlemek için önce elini açmalısın.';
      const [tile] = take([String(b.tile)]) || []; if (!tile) return 'Bu taş elinde yok.';
      if (h.length <= 1) return 'Atmak için elinde en az bir taş kalmalı.';
      const m = g.melds.find((x) => x.id === b.meld); if (!m) return 'Per bulunamadı.';
      if (m.kind === 'pair') return 'Çiftlere taş işlenmez.';
      const v = validGroup([...m.tiles, tile], ok); if (!v) return 'Bu taş bu pere uymuyor.';
      m.tiles = v.order; m.kind = v.kind; removeFromHand([tile]); g.acted = true;
      return null;
    }
    if (b.type === 'discard') {
      const [tile] = take([String(b.tile)]) || []; if (!tile) return 'Bu taş elinde yok.';
      if (g.mustOpen && !g.opened[seat]) return 'Yandan taş aldıysan bu el açmalısın. Açamıyorsan taşı geri koy.';
      if (g.took && tile.id === g.took) return 'Yandan aldığın taşı aynı el geri atamazsın.';
      removeFromHand([tile]); g.discards[seat].push(tile); g.took = null; g.mustOpen = false;
      if (!h.length) return endHand(t, seat, `${kit.nameOf(t, seat)} elini bitirdi!`);
      g.cur = (seat + 1) % 4; g.phase = 'draw'; g.untook = null; return null;
    }
    return 'Geçersiz hamle.';
  },
  bot(t, seat) {
    const g = t.g; const h = g.hands[seat]; const ok = g.okey;
    if (g.phase === 'draw') {
      const prev = (seat + 3) % 4; const top = g.untook === seat ? null : g.discards[prev][g.discards[prev].length - 1];
      if (top && !isWild(top, ok)) {
        if (g.opened[seat] === 'groups') { if (g.melds.some((m) => m.kind !== 'pair' && validGroup([...m.tiles, top], ok))) return { type: 'draw', from: 'discard' }; }
        else if (!g.opened[seat]) { const bg = bestGroups([...h, top], ok, { cap: 8000 }); if (bg.value >= 101 && bg.groups.some((x) => x.includes(top))) return { type: 'draw', from: 'discard' }; }
      } else if (top && isWild(top, ok)) return { type: 'draw', from: 'discard' };
      return { type: 'draw', from: 'pile' };
    }
    // Açma
    if (!g.opened[seat]) {
      const bg = bestGroups(h, ok);
      if (bg.value >= 101) {
        let groups = bg.groups; const used = groups.flat().length;
        if (used >= h.length) groups = groups.slice(0, -1);
        if (groups.reduce((a, x) => a + validGroup(x, ok).value, 0) >= 101) return { type: 'open', groups: groups.map((x) => x.map((y) => y.id)) };
      }
      const pr = pairsIn(h, ok);
      if (pr.length >= 5 && bg.value < 80 && !g.took) { const use = pr.slice(0, Math.min(pr.length, h.length - 1 >> 1)); if (use.length >= 5) return { type: 'open', pairs: true, groups: use.map((x) => x.map((y) => y.id)) }; }
    } else if (g.opened[seat] === 'groups') {
      const bg = bestGroups(h, ok, { cap: 6000 });
      if (bg.groups.length && bg.groups.flat().length < h.length) return { type: 'open', groups: [bg.groups[0].map((y) => y.id)] };
      for (const tile of h) { if (h.length <= 1) break; const m = g.melds.find((x) => x.kind !== 'pair' && validGroup([...x.tiles, tile], ok)); if (m) return { type: 'add', tile: tile.id, meld: m.id }; }
    } else if (g.opened[seat] === 'pairs') {
      const pr = pairsIn(h, ok); if (pr.length && pr.flat().length < h.length) return { type: 'open', pairs: true, groups: [pr[0].map((y) => y.id)] };
    }
    if (g.mustOpen && !g.opened[seat]) return { type: 'untake' };
    const cand = h.filter((x) => !isWild(x, ok) && x.id !== g.took).map((x) => ({ x, s: useful(x, h, ok) + Math.random() * 0.2 })).sort((a, b) => a.s - b.s);
    return { type: 'discard', tile: (cand[0] || { x: h[0] }).x.id };
  },
  fallback(t, seat) {
    const g = t.g; const h = g.hands[seat];
    if (g.phase === 'draw') return { type: 'draw', from: 'pile' };
    if (g.mustOpen && !g.opened[seat] && !g.acted) return { type: 'untake' };
    const x = h.find((y) => y.id !== g.took) || h[0]; return { type: 'discard', tile: x.id };
  },
});
function endHand(t, winner, text) {
  const g = t.g; const ok = g.okey;
  const pen = [0, 1, 2, 3].map((i) => {
    if (i === winner) return -101;
    if (!g.opened[i]) return 202;
    const s = g.hands[i].reduce((a, x) => a + tilePts(x, ok), 0);
    return g.opened[i] === 'pairs' ? s * 2 : s;
  });
  g.final = pen;
  const best = Math.min(...pen); const winners = pen.map((p, i) => (p === best ? i : -1)).filter((i) => i >= 0);
  g.over = { winners, points: Object.fromEntries(pen.map((p, i) => [i, -p])), text: winner != null ? text : `${text} El bitti.` };
  return null;
}
module.exports.rules = { validGroup, bestGroups, pairsIn, newDeck };

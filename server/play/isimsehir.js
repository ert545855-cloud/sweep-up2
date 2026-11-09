// İsim Şehir (2–8 kişi): harf gelir, kategorileri doldur. Aynı cevap 5, tek cevap 10, kategoride tek cevap veren 20 puan.
const LETTERS = 'ABCÇDEFGHIİKLMNOÖPRSŞTUÜVYZ'.split('').filter((l) => !['Ğ'].includes(l));
const HARD = new Set(['Ğ', 'J', 'Q', 'W', 'X']);
const CATS = [['isim', 'İsim'], ['sehir', 'Şehir'], ['hayvan', 'Hayvan'], ['bitki', 'Bitki'], ['esya', 'Eşya'], ['ulke', 'Ülke']];
const ROUNDS = 5; const WRITE_MS = 80000; const LAST_MS = 8000; const REVIEW_MS = 35000;
const norm = (s) => String(s || '').toLocaleLowerCase('tr-TR').replace(/[^a-zçğıöşü0-9]/g, '');
const fold = (s) => norm(s).replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c');

module.exports = (kit) => {
  const active = (t) => kit.filled(t);
  const phase = (t, name, ms, next) => {
    const g = t.g; clearTimeout(g.ph); ms = kit.ms(ms); g.phase = name; g.deadline = Date.now() + ms; g.phaseMs = ms;
    g.ph = kit.after(t, ms, () => { if (t.status === 'playing' && t.g === g) next(); });
    kit.settle(t);
  };
  function startRound(t) {
    const g = t.g; g.round++;
    if (g.round > ROUNDS || active(t).length < 2) return finish(t);
    const pool = LETTERS.filter((l) => !g.usedL.has(l) && !HARD.has(l)); g.letter = pool[Math.floor(Math.random() * pool.length)]; g.usedL.add(g.letter);
    g.ans = {}; g.done = new Set(); g.veto = {}; g.ready = new Set(); g.roundPts = null;
    kit.say(t, { sys: true, text: `${g.round}. tur · Harf: ${g.letter}` });
    phase(t, 'write', WRITE_MS, () => startReview(t));
  }
  const valid = (t, s, cat) => {
    const g = t.g; const a = norm(g.ans[s]?.[cat]); if (a.length < 2) return false;
    if (!a.startsWith(g.letter.toLocaleLowerCase('tr-TR'))) return false;
    const v = Object.keys(g.veto[`${s}:${cat}`] || {}).length; const others = active(t).length - 1;
    return !(others > 0 && v >= Math.max(1, Math.ceil(others / 2)));
  };
  function startReview(t) { const g = t.g; kit.say(t, { sys: true, text: 'Süre doldu! Cevapları kontrol edin, geçersiz olanları işaretleyin.' }); phase(t, 'review', REVIEW_MS, () => score(t)); }
  function score(t) {
    const g = t.g; const seats = active(t); const pts = {};
    seats.forEach((s) => { pts[s] = 0; });
    CATS.forEach(([cat]) => {
      const vals = seats.filter((s) => valid(t, s, cat)).map((s) => [s, fold(g.ans[s][cat])]);
      vals.forEach(([s, a]) => { const same = vals.filter(([, b]) => b === a).length; pts[s] += vals.length === 1 ? 20 : same > 1 ? 5 : 10; });
    });
    g.roundPts = pts; Object.entries(pts).forEach(([s, p]) => { g.score[s] = (g.score[s] || 0) + p; });
    phase(t, 'result', 7000, () => startRound(t));
  }
  function finish(t) {
    const g = t.g; const sc = g.score; const best = Math.max(0, ...Object.values(sc));
    const winners = Object.keys(sc).filter((k) => sc[k] === best && best > 0).map(Number);
    kit.end(t, { winners, points: sc, text: winners.length ? `Kazanan: ${winners.map((w) => kit.nameOf(t, w)).join(', ')} · ${best} puan` : 'Oyun bitti' });
  }
  kit.register({
    key: 'isimsehir', name: 'İsim Şehir', icon: 'isimsehir', emoji: '📝', min: 2, max: 8, size: 8, bots: false, party: true, minHumans: 2, minPlay: 2,
    setup(t) { const g = t.g; g.round = 0; g.usedL = new Set(); g.score = {}; startRound(t); },
    turn: () => null,
    view(t, me) {
      const g = t.g; const showAll = g.phase === 'review' || g.phase === 'result';
      return {
        is: {
          phase: g.phase, round: g.round, rounds: ROUNDS, letter: g.letter, cats: CATS, mine: g.ans[me] || {}, done: [...g.done], ready: [...g.ready],
          all: showAll ? active(t).map((s) => ({ seat: s, a: g.ans[s] || {}, ok: Object.fromEntries(CATS.map(([c]) => [c, valid(t, s, c)])), veto: Object.fromEntries(CATS.map(([c]) => [c, Object.keys(g.veto[`${s}:${c}`] || {}).map(Number)])) })) : null,
          roundPts: g.roundPts, score: g.score,
        },
      };
    },
    move(t, seat, b) {
      const g = t.g;
      if (b.type === 'answers') {
        if (g.phase !== 'write') return 'Yazma süresi bitti.';
        const a = {}; CATS.forEach(([c]) => { a[c] = kit.ctx.moderation.mask(String(b.a?.[c] || '').trim().slice(0, 30)); }); g.ans[seat] = a;
        if (b.done && !g.done.has(seat)) {
          g.done.add(seat);
          if (g.done.size >= active(t).length) { clearTimeout(g.ph); startReview(t); return null; }
          if (g.done.size === 1 && g.deadline - Date.now() > LAST_MS) { kit.say(t, { sys: true, text: `${kit.nameOf(t, seat)} bitirdi! ${LAST_MS / 1000} saniye kaldı ⏱` }); phase(t, 'write', LAST_MS, () => startReview(t)); }
        }
        return null;
      }
      if (b.type === 'veto') {
        if (g.phase !== 'review') return 'Şu an kontrol zamanı değil.';
        const s = Number(b.seat); const c = String(b.cat); if (s === seat || !CATS.some(([k]) => k === c)) return 'Geçersiz.';
        const k = `${s}:${c}`; g.veto[k] = g.veto[k] || {}; if (g.veto[k][seat]) delete g.veto[k][seat]; else g.veto[k][seat] = 1;
        return null;
      }
      if (b.type === 'ready') {
        if (g.phase !== 'review') return null; g.ready.add(seat);
        if (g.ready.size >= active(t).length) { clearTimeout(g.ph); score(t); }
        return null;
      }
      return 'Geçersiz hamle.';
    },
    leave(t) { const g = t.g; if (!g) return; if (g.phase === 'write' && g.done.size >= active(t).length) { clearTimeout(g.ph); startReview(t); } },
  });
};

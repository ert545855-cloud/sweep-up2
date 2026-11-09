// Çoktan seçmeli yarışma altyapısı (Bilgi Yarışması, Şarkıyı Tahmin Et).
// Herkes aynı anda cevaplar; doğru ve hızlı cevap daha çok puan getirir. Boş koltuklara bot oturabilir.
module.exports = function quiz(kit, spec) {
  const COUNT = spec.count || 10;
  const PRE = spec.preMs || 2500; const Q = spec.qMs || 15000; const A = spec.aMs || 4500;
  const phase = (t, name, ms, next) => {
    const g = t.g; clearTimeout(g.ph); ms = kit.ms(ms); g.phase = name; g.deadline = Date.now() + ms; g.phaseMs = ms;
    g.ph = kit.after(t, ms, () => { if (t.status === 'playing' && t.g === g) next(); });
    kit.settle(t);
  };
  const seats = (t) => kit.filled(t);
  const catOf = (t) => (spec.cats.some(([k]) => k === t.opts?.cat) ? t.opts.cat : spec.cats[0][0]);
  const catName = (k) => spec.cats.find(([c]) => c === k)?.[1] || '';

  function begin(t, qs) {
    const g = t.g; g.qs = qs.slice(0, COUNT); g.qi = -1;
    seats(t).forEach((i) => { g.score[i] = g.score[i] || 0; });
    next(t);
  }
  function next(t) {
    const g = t.g; g.qi++;
    if (g.qi >= g.qs.length) return finish(t);
    g.ans = {}; g.hide = {};
    phase(t, 'pre', PRE, () => ask(t));
  }
  function ask(t) {
    const g = t.g; const qi = g.qi; const q = g.qs[qi];
    phase(t, 'q', Q, () => reveal(t));
    seats(t).filter((i) => t.seats[i].bot).forEach((s) => {
      const ms = kit.ms(spec.botMin + Math.random() * (spec.botMax - spec.botMin));
      kit.after(t, ms, () => {
        if (t.g !== g || g.qi !== qi || g.phase !== 'q' || !t.seats[s]?.bot || g.ans[s]) return;
        const wrong = [0, 1, 2, 3].filter((i) => i !== q.correct);
        answer(t, s, Math.random() < spec.botAcc ? q.correct : wrong[Math.floor(Math.random() * wrong.length)]);
        kit.settle(t);
      });
    });
  }
  function answer(t, s, c) {
    const g = t.g; const q = g.qs[g.qi];
    if (g.ans[s]) return 'Zaten cevapladın.';
    const ok = c === q.correct; const left = Math.max(0, g.deadline - Date.now());
    g.ans[s] = { c, ok, pts: ok ? 50 + Math.round((50 * left) / g.phaseMs) : 0 };
    // Herkes cevapladıysa beklemeden aç
    if (seats(t).every((i) => g.ans[i])) { clearTimeout(g.ph); g.ph = kit.after(t, kit.ms(700), () => { if (t.g === g && g.phase === 'q') reveal(t); }); }
    return null;
  }
  function reveal(t) {
    const g = t.g; const q = g.qs[g.qi];
    Object.entries(g.ans).forEach(([s, a]) => { if (t.seats[s]) g.score[s] = (g.score[s] || 0) + a.pts; });
    if (spec.revealSay) kit.say(t, { sys: true, text: spec.revealSay(q) });
    phase(t, 'a', A, () => next(t));
  }
  function finish(t) {
    const g = t.g; const sc = {}; seats(t).forEach((i) => { sc[i] = g.score[i] || 0; });
    const best = Math.max(0, ...Object.values(sc));
    const winners = Object.keys(sc).filter((k) => sc[k] === best && best > 0).map(Number);
    kit.end(t, { winners, points: sc, text: winners.length ? `Kazanan: ${winners.map((w) => kit.nameOf(t, w)).join(', ')} · ${best} puan` : 'Oyun bitti' });
  }

  kit.register({
    key: spec.key, name: spec.name, icon: spec.key, emoji: spec.emoji, min: 2, max: 8, size: spec.size || 4, bots: true, quick: true,
    opts: (o) => ({ cat: spec.cats.some(([k]) => k === o?.cat) ? o.cat : spec.cats[0][0] }),
    setup(t) {
      const g = t.g; g.phase = 'loading'; g.score = {}; g.joker = {}; g.cat = catOf(t); g.deadline = null;
      t.used = t.used || new Set();
      let r;
      try { r = spec.load(t, g.cat, t.used); } catch (e) { console.error(`[${spec.key}] yükleme`, e); r = []; }
      const go = (qs) => {
        if (t.g !== g || t.status !== 'playing') return;
        if (!qs || qs.length < Math.min(5, COUNT)) { kit.end(t, { winners: [], text: spec.failText || 'Sorular hazırlanamadı, biraz sonra tekrar dene.' }); return; }
        qs.forEach((q) => t.used.add(q.id)); if (t.used.size > 400) t.used.clear();
        begin(t, qs);
      };
      if (r && typeof r.then === 'function') r.then(go, (e) => { console.error(`[${spec.key}] yükleme`, e.message); go([]); });
      else go(r);
    },
    turn: () => null,
    anyTime: () => true,
    view(t, me) {
      const g = t.g; const q = g.qs?.[g.qi]; const shown = !!q && (g.phase === 'q' || g.phase === 'a'); const rev = !!q && g.phase === 'a';
      const nextQ = g.qs?.[g.qi + 1];
      return {
        qz: {
          phase: g.phase, qi: g.qi ?? -1, n: g.qs?.length || COUNT, cat: g.cat, catName: catName(g.cat),
          q: q && shown ? { text: q.text || null, opts: q.opts } : null,
          media: q && g.phase !== 'loading' ? q.media || null : null, nextMedia: rev ? nextQ?.media || null : null,
          mine: g.ans?.[me]?.c ?? null, answered: Object.keys(g.ans || {}).map(Number),
          correct: rev ? q.correct : null, picks: rev ? Object.fromEntries(Object.entries(g.ans).map(([s, a]) => [s, a.c])) : null,
          gained: rev ? Object.fromEntries(Object.entries(g.ans).map(([s, a]) => [s, a.pts])) : null,
          info: rev ? q.info || null : null, score: g.score, joker: spec.joker ? !g.joker[me] : false, hide: g.hide?.[me] || null,
        },
      };
    },
    move(t, seat, b) {
      const g = t.g;
      if (b.type === 'answer') {
        if (g.phase !== 'q') return 'Şu an cevap verilemez.';
        const c = Number(b.c); if (!Number.isInteger(c) || c < 0 || c > 3) return 'Geçersiz cevap.';
        return answer(t, seat, c);
      }
      if (b.type === 'joker' && spec.joker) {
        if (g.phase !== 'q' || g.ans[seat]) return 'Joker şu an kullanılamaz.';
        if (g.joker[seat]) return 'Jokerini bu oyunda kullandın.';
        const q = g.qs[g.qi]; const wrong = kit.shuffle([0, 1, 2, 3].filter((i) => i !== q.correct));
        g.joker[seat] = true; g.hide[seat] = wrong.slice(0, 2); return null;
      }
      return 'Geçersiz hamle.';
    },
    join(t, i) { if (t.g?.score) t.g.score[i] = 0; },
  });
};

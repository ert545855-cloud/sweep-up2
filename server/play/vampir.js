// Vampir Köylü (3+ kişi, 6'ya kadar bot eklenebilir): gece vampirler avlanır, doktor korur, gözcü sorgular; gündüz köy oylar.
const { nanoid } = require('nanoid');

const ROLE = {
  vampir: { name: 'Vampir', emoji: '🧛', team: 'vampir' },
  doktor: { name: 'Doktor', emoji: '🩺', team: 'koy' },
  gozcu: { name: 'Gözcü', emoji: '🔮', team: 'koy' },
  koylu: { name: 'Köylü', emoji: '🧑‍🌾', team: 'koy' },
};
const MS = { roles: 10000, night: 30000, dawn: 7000, day: 75000, vote: 30000, verdict: 7000 };
const BOT_NAMES = ['Ayla', 'Kerem', 'Defne', 'Emir', 'Zeynep', 'Mert', 'Elif', 'Can', 'Selin', 'Arda', 'Naz', 'Deniz'];
const BOT_LINES = ['Ben köylüyüm, emin olun 😅', 'Dün gece hiçbir şey duymadım, uyuyordum 😴', '{X} biraz fazla sessiz, şüpheleniyorum 🤨', 'Acele etmeyelim, düşünelim.', '{X}, dün gece neredeydin? 🧐', 'Bence {X} bir şeyler saklıyor.', '{X} bence temiz, başkasına bakalım.'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

module.exports = (kit) => {
  const fast = (t) => (t.g?.alive && ![...t.g.alive].some((s) => t.seats[s] && !t.seats[s].bot) ? 0.3 : 1);
  const phase = (t, name, ms, next) => {
    const g = t.g; clearTimeout(g.ph); ms = kit.ms(ms * fast(t)); g.phase = name; g.deadline = Date.now() + ms; g.phaseMs = ms;
    g.ph = kit.after(t, ms, () => { if (t.status === 'playing' && t.g === g) next(); });
    kit.settle(t);
  };
  const alive = (t) => [...t.g.alive].filter((s) => t.seats[s]);
  const roleOf = (t, s) => t.g.role[s];
  const isBot = (t, s) => !!t.seats[s]?.bot;
  const nm = (t, s) => kit.nameOf(t, s);
  const later = (t, ms, fn) => { const g = t.g; const ph = g.phase; const day = g.day; kit.after(t, kit.ms(ms * fast(t)), () => { if (t.status === 'playing' && t.g === g && g.phase === ph && g.day === day) fn(); }); };

  function kill(t, s, how) {
    const g = t.g; if (!g.alive.has(s)) return;
    g.alive.delete(s); g.dead.push({ seat: s, role: g.role[s], how, day: g.day });
  }
  function checkWin(t) {
    const g = t.g; const al = alive(t); const v = al.filter((s) => roleOf(t, s) === 'vampir').length;
    let team = null;
    if (v === 0) team = 'koy'; else if (v >= al.length - v) team = 'vampir';
    if (!team) return false;
    g.winner = team; clearTimeout(g.ph);
    const winners = Object.keys(g.role).map(Number).filter((s) => t.seats[s] && ROLE[g.role[s]].team === team);
    const points = {}; winners.forEach((s) => { points[s] = 10; });
    kit.say(t, { sys: true, ok: true, text: team === 'koy' ? 'Bütün vampirler yakalandı. Köylüler kazandı! 🌞' : 'Vampirler köyü ele geçirdi! 🧛' });
    kit.end(t, { winners, points, text: team === 'koy' ? 'Köylüler kazandı! 🌞' : 'Vampirler kazandı! 🧛' });
    return true;
  }

  // ---- Gece ----
  function startNight(t) {
    const g = t.g; g.day++; g.night = { vamp: {}, doc: null, seer: null };
    kit.say(t, { sys: true, text: `🌙 ${g.day}. gece. Köy uyuyor…` });
    phase(t, 'night', MS.night, () => resolveNight(t));
    alive(t).filter((s) => isBot(t, s) && roleOf(t, s) !== 'koylu').forEach((s) => later(t, 3000 + Math.random() * 9000, () => { botNight(t, s); kit.settle(t); }));
  }
  const nightActors = (t) => alive(t).filter((s) => roleOf(t, s) !== 'koylu');
  const nightDone = (t) => { const n = t.g.night; return nightActors(t).every((s) => (roleOf(t, s) === 'vampir' ? n.vamp[s] != null : roleOf(t, s) === 'doktor' ? n.doc != null : n.seer != null)); };
  function nightAct(t, s, target) {
    const g = t.g; const r = roleOf(t, s); const n = g.night;
    if (!g.alive.has(target) || !t.seats[target]) return 'Bu kişi oyunda değil.';
    if (r === 'vampir') { if (roleOf(t, target) === 'vampir') return 'Vampir arkadaşını seçemezsin.'; n.vamp[s] = target; }
    else if (r === 'doktor') { if (target === g.lastProtect) return 'Aynı kişiyi iki gece üst üste koruyamazsın.'; n.doc = target; }
    else if (r === 'gozcu') { if (target === s) return 'Kendini sorgulayamazsın.'; if (n.seer != null) return 'Bu gece birini sorguladın.'; n.seer = target; }
    else return 'Köylüler gece uyur 😴';
    if (nightDone(t)) { clearTimeout(g.ph); later(t, 900, () => resolveNight(t)); }
    return null;
  }
  function botNight(t, s) {
    const g = t.g; const r = roleOf(t, s); const al = alive(t);
    if (r === 'vampir') {
      const prev = Object.values(g.night.vamp); const prey = al.filter((x) => roleOf(t, x) !== 'vampir');
      const known = g.seerClaim != null && g.alive.has(g.seerClaim) ? g.seerClaim : null; // kendini açık eden gözcü önce gider
      nightAct(t, s, prev.length ? prev[0] : known ?? pick(prey));
    } else if (r === 'doktor') nightAct(t, s, pick(al.filter((x) => x !== g.lastProtect)));
    else if (r === 'gozcu') { const checked = new Set(g.seerLog.map((x) => x.seat)); const cand = al.filter((x) => x !== s && !checked.has(x)); if (cand.length) nightAct(t, s, pick(cand)); }
  }
  function resolveNight(t) {
    const g = t.g; const n = g.night; const al = alive(t);
    const cnt = {}; Object.entries(n.vamp).forEach(([v, x]) => { if (g.alive.has(+v) && g.alive.has(x)) cnt[x] = (cnt[x] || 0) + 1; });
    const max = Math.max(0, ...Object.values(cnt)); const top = Object.keys(cnt).filter((k) => cnt[k] === max).map(Number);
    const target = top.length ? pick(top) : pick(al.filter((x) => roleOf(t, x) !== 'vampir'));
    const saved = target != null && n.doc === target;
    if (n.seer != null) { const sr = al.find((x) => roleOf(t, x) === 'gozcu'); if (sr != null) g.seerLog.push({ seat: n.seer, vamp: roleOf(t, n.seer) === 'vampir', day: g.day }); }
    g.lastProtect = n.doc;
    if (target != null && !saved) kill(t, target, 'night');
    g.lastNight = { killed: saved ? null : target, saved };
    kit.say(t, { sys: true, text: target == null ? 'Gece sakin geçti.' : saved ? '☀️ Gece bir saldırı oldu ama doktor kurtardı! Kimse ölmedi.' : `☀️ ${nm(t, target)} gece vampirlerin kurbanı oldu. Rolü: ${ROLE[g.role[target]].name} ${ROLE[g.role[target]].emoji}` });
    if (checkWin(t)) return;
    phase(t, 'dawn', MS.dawn, () => startDay(t));
  }

  // ---- Gündüz ----
  function startDay(t) {
    const g = t.g; g.skip = new Set();
    phase(t, 'day', MS.day, () => startVote(t));
    // Botlar biraz konuşur
    const bots = alive(t).filter((s) => isBot(t, s));
    kit.shuffle(bots).slice(0, 2).forEach((s, k) => later(t, 4000 + k * 7000 + Math.random() * 5000, () => {
      const others = alive(t).filter((x) => x !== s && !(roleOf(t, s) === 'vampir' && roleOf(t, x) === 'vampir'));
      if (!others.length) return;
      const found = roleOf(t, s) === 'gozcu' && g.seerLog.find((x) => x.vamp && g.alive.has(x.seat));
      const text = found ? `Ben gözcüyüm! ${nm(t, found.seat).replace(' (bot)', '')} vampir, ona oy verin! 🔮` : pick(BOT_LINES).replace('{X}', nm(t, pick(others)).replace(' (bot)', ''));
      if (found) g.seerClaim = s;
      kit.say(t, { uid: t.seats[s].uid, seat: s, name: t.seats[s].name, text }); kit.push(t);
    }));
    later(t, 20000, () => { bots.forEach((s) => g.skip.add(s)); maybeSkip(t); });
  }
  function maybeSkip(t) { const g = t.g; if (g.phase === 'day' && g.skip.size >= Math.ceil(alive(t).length * 0.6)) { clearTimeout(g.ph); startVote(t); return true; } return false; }
  function startVote(t) {
    const g = t.g; g.votes = {};
    kit.say(t, { sys: true, text: '🗳️ Oylama başladı: kim vampir?' });
    phase(t, 'vote', MS.vote, () => tally(t));
    alive(t).filter((s) => isBot(t, s)).forEach((s) => later(t, 3000 + Math.random() * 14000, () => { botVote(t, s); kit.settle(t); }));
  }
  function botVote(t, s) {
    const g = t.g; const al = alive(t).filter((x) => x !== s); const me = roleOf(t, s);
    const ok = me === 'vampir' ? al.filter((x) => roleOf(t, x) !== 'vampir') : al;
    if (!ok.length) return castVote(t, s, -1);
    const known = me !== 'vampir' && g.seerClaim != null && g.seerClaim !== s ? g.seerLog.find((x) => x.vamp && g.alive.has(x.seat))?.seat : null;
    const mine = me === 'gozcu' ? g.seerLog.find((x) => x.vamp && g.alive.has(x.seat))?.seat : null;
    const target = mine ?? known;
    if (target != null && ok.includes(target)) return castVote(t, s, target);
    const cnt = {}; Object.values(g.votes).forEach((x) => { if (x >= 0 && ok.includes(x)) cnt[x] = (cnt[x] || 0) + 1; });
    const lead = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    castVote(t, s, lead != null && Math.random() < 0.55 ? +lead : pick(ok));
  }
  function castVote(t, s, target) {
    const g = t.g; g.votes[s] = target;
    if (alive(t).every((x) => g.votes[x] !== undefined)) { clearTimeout(g.ph); later(t, 900, () => tally(t)); }
    return null;
  }
  function tally(t) {
    const g = t.g; const cnt = {};
    Object.entries(g.votes).forEach(([v, x]) => { if (x >= 0 && g.alive.has(+v) && g.alive.has(x)) cnt[x] = (cnt[x] || 0) + 1; });
    const max = Math.max(0, ...Object.values(cnt)); const top = Object.keys(cnt).filter((k) => cnt[k] === max).map(Number);
    const out = max > 0 && top.length === 1 ? top[0] : null;
    g.verdict = { out, role: out != null ? g.role[out] : null, count: cnt };
    if (out != null) { kill(t, out, 'vote'); kit.say(t, { sys: true, text: `⚖️ Köy ${nm(t, out)} adlı kişiyi seçti. Rolü: ${ROLE[g.role[out]].name} ${ROLE[g.role[out]].emoji}` }); }
    else kit.say(t, { sys: true, text: '⚖️ Oylar eşit çıktı ya da kimse oy vermedi. Bugün kimse gitmedi.' });
    if (checkWin(t)) return;
    phase(t, 'verdict', MS.verdict, () => startNight(t));
  }

  function rolesFor(n) {
    const v = n >= 12 ? 3 : n >= 8 ? 2 : 1;
    const list = [...Array(v).fill('vampir'), 'doktor', ...(n >= 5 ? ['gozcu'] : [])];
    while (list.length < n) list.push('koylu');
    return kit.shuffle(list);
  }

  kit.register({
    key: 'vampir', name: 'Vampir Köylü', icon: 'vampir', emoji: '🧛', min: 1, max: 12, size: 8, bots: false, party: true, minHumans: 1, minPlay: 3, lateJoin: false,
    opts: (o) => ({ bots: o?.bots === 'off' || o?.bots === false ? 'off' : 'on' }),
    canStart(t) {
      const h = t.seats.filter((s) => s && !s.bot).length;
      // Botlar açıkken tek kişi de başlatabilir (eksik yerler 6'ya kadar botla dolar)
      if (t.opts?.bots === 'off' && h < 5) return 'Botsuz oyun için en az 5 kişi gerekli. Botları açabilir ya da arkadaşlarını çağırabilirsin.';
      return null;
    },
    setup(t) {
      const g = t.g;
      if (t.opts?.bots !== 'off') {
        if (t.size < 6) { t.size = 6; while (t.seats.length < 6) t.seats.push(null); }
        const used = new Set(t.seats.filter(Boolean).map((s) => s.name));
        for (let i = 0; i < t.seats.length && kit.filled(t).length < 6; i++) {
          if (t.seats[i]) continue;
          const n = BOT_NAMES.find((x) => !used.has(`${x} (bot)`)) || `Bot ${i}`; used.add(`${n} (bot)`);
          t.seats[i] = { bot: true, uid: `bot_${nanoid(6)}`, name: `${n} (bot)`, avatar: '/img/eg/vampir.svg' };
        }
      }
      const seats = kit.filled(t); const roles = rolesFor(seats.length);
      g.role = {}; seats.forEach((s, i) => { g.role[s] = roles[i]; });
      g.alive = new Set(seats); g.dead = []; g.day = 0; g.seerLog = []; g.lastProtect = null; g.lastNight = null; g.votes = {}; g.verdict = null; g.seerClaim = null;
      g.counts = {}; roles.forEach((r) => { g.counts[r] = (g.counts[r] || 0) + 1; });
      kit.say(t, { sys: true, text: `Roller dağıtıldı: ${Object.entries(g.counts).map(([r, n]) => `${n} ${ROLE[r].name}`).join(', ')}` });
      phase(t, 'roles', MS.roles, () => startNight(t));
    },
    turn: () => null,
    view(t, me) {
      const g = t.g; const my = g.role[me]; const ended = t.status === 'ended' || !!g.winner;
      const known = {};
      if (my) known[me] = my;
      if (my === 'vampir') Object.keys(g.role).forEach((s) => { if (g.role[s] === 'vampir') known[s] = 'vampir'; });
      g.dead.forEach((d) => { known[d.seat] = d.role; });
      if (ended) Object.assign(known, g.role);
      const n = g.night || {};
      return {
        vp: {
          phase: g.phase, day: g.day, role: my || null, alive: alive(t), dead: g.dead, known, counts: g.counts, winner: g.winner || null,
          myNight: my === 'vampir' ? n.vamp?.[me] ?? null : my === 'doktor' ? n.doc ?? null : my === 'gozcu' ? n.seer ?? null : null,
          vampVotes: my === 'vampir' && g.phase === 'night' ? n.vamp || {} : null,
          lastProtect: my === 'doktor' ? g.lastProtect ?? null : null,
          seerLog: my === 'gozcu' ? g.seerLog : null,
          lastNight: g.phase === 'dawn' || g.phase === 'day' ? g.lastNight : null,
          votes: g.phase === 'vote' || g.phase === 'verdict' ? g.votes : null, myVote: g.votes?.[me] ?? null,
          verdict: g.phase === 'verdict' ? g.verdict : null, skipN: g.skip?.size || 0, skipMine: !!g.skip?.has(me),
        },
      };
    },
    move(t, seat, b) {
      const g = t.g;
      if (!g.alive.has(seat)) return 'Oyundan çıktın, sadece izleyebilirsin 👻';
      if (b.type === 'night') { if (g.phase !== 'night') return 'Şu an gece değil.'; return nightAct(t, seat, Number(b.seat)); }
      if (b.type === 'vote') {
        if (g.phase !== 'vote') return 'Oylama şu an açık değil.';
        const x = Number(b.seat); if (x !== -1 && (x === seat || !g.alive.has(x))) return 'Geçersiz oy.';
        return castVote(t, seat, x);
      }
      if (b.type === 'skip') { if (g.phase !== 'day') return null; g.skip.add(seat); maybeSkip(t); return null; }
      return 'Geçersiz hamle.';
    },
    chat(t, seat) {
      const g = t.g;
      if (g.alive && !g.alive.has(seat) && !g.winner) return { block: true, reply: { warn: 'Ölüler konuşamaz 👻 Oyunu izlemeye devam et.' } };
      if (g.phase === 'night') return { block: true, reply: { warn: 'Gece herkes uyuyor 🌙 Sabahı bekle.' } };
      return null;
    },
    leave(t, seat) {
      const g = t.g; if (!g?.alive?.has(seat)) return;
      kill(t, seat, 'left'); kit.say(t, { sys: true, text: `Rolü ${ROLE[g.role[seat]].name} ${ROLE[g.role[seat]].emoji} idi.` });
      if (checkWin(t)) return;
      if (g.phase === 'night' && nightDone(t)) { clearTimeout(g.ph); later(t, 600, () => resolveNight(t)); }
      if (g.phase === 'vote' && alive(t).every((x) => g.votes[x] !== undefined)) { clearTimeout(g.ph); later(t, 600, () => tally(t)); }
    },
  });
};

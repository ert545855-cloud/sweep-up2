// Kim Casus? (3–10 kişi): herkes aynı kelimeyi bilir, casus bilmez. İpucu ver, konuş, oyla; casus yakalanırsa kelimeyi tahmin etmeye çalışır.
const WORDS = {
  Mekan: ['Hastane', 'Okul', 'Plaj', 'Havalimanı', 'Sinema', 'Restoran', 'Kütüphane', 'Stadyum', 'Kuaför', 'Süpermarket', 'Otel', 'Müze', 'Hayvanat bahçesi', 'Lunapark', 'Spor salonu', 'Düğün salonu', 'Kamp alanı', 'Kafe', 'Banka', 'Eczane', 'Pazar yeri', 'Hamam', 'Konser', 'Kayak merkezi', 'Uzay istasyonu', 'Denizaltı', 'Sirk', 'Tiyatro', 'Otogar', 'Metro', 'Vapur', 'Çay bahçesi', 'Berber', 'Karakol', 'Tren', 'Uçak', 'Gece kulübü', 'Kreş', 'Diş hekimi', 'Fırın'],
  Yemek: ['Lahmacun', 'Mantı', 'Döner', 'Baklava', 'Menemen', 'İskender', 'Sushi', 'Pizza', 'Künefe', 'Kokoreç', 'Midye dolma', 'Simit', 'Karnıyarık', 'Hamburger', 'Kumpir', 'Sütlaç', 'Çiğ köfte', 'Pide', 'Mercimek çorbası', 'Dondurma'],
  Meslek: ['Doktor', 'Öğretmen', 'Aşçı', 'Pilot', 'Polis', 'İtfaiyeci', 'Avukat', 'Berber', 'Garson', 'Yazılımcı', 'Fotoğrafçı', 'Astronot', 'Çiftçi', 'Dişçi', 'Kaptan', 'Hemşire', 'Futbolcu', 'Şarkıcı', 'Sihirbaz', 'Kasap'],
  Hayvan: ['Kedi', 'Köpek', 'Aslan', 'Zürafa', 'Penguen', 'Yunus', 'Kartal', 'Kaplumbağa', 'Fil', 'Maymun', 'Ahtapot', 'Tavşan', 'Baykuş', 'Timsah', 'Kanguru', 'Arı', 'Panda', 'Papağan', 'Köpekbalığı', 'At'],
  Eşya: ['Şemsiye', 'Telefon', 'Gözlük', 'Saat', 'Anahtar', 'Ayna', 'Yastık', 'Bavul', 'Kulaklık', 'Mum', 'Makas', 'Termos', 'Cüzdan', 'Kumanda', 'Sırt çantası', 'Bisiklet', 'Gitar', 'Fotoğraf makinesi', 'Çaydanlık', 'Halı'],
};
const CATS = Object.keys(WORDS);
const ROUNDS = 3;
const fold = (s) => String(s || '').replace(/İ/g, 'i').replace(/I/g, 'ı').toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^a-z0-9]/g, '');
const MS = { roles: 9000, clue: 25000, talk: 60000, vote: 25000, guess: 20000, reveal: 7000 };

module.exports = (kit) => {
  const active = (t) => kit.filled(t);
  const phase = (t, name, ms, next) => {
    const g = t.g; clearTimeout(g.ph); ms = kit.ms(ms); g.phase = name; g.deadline = Date.now() + ms; g.phaseMs = ms;
    g.ph = kit.after(t, ms, () => { if (t.status === 'playing' && t.g === g) next(); });
    kit.settle(t);
  };
  function startRound(t) {
    const g = t.g; g.round++;
    if (g.round > ROUNDS || active(t).length < 3) return finish(t);
    const cat = CATS[Math.floor(Math.random() * CATS.length)];
    const pool = WORDS[cat].filter((w) => !g.used.has(w)); const word = pool[Math.floor(Math.random() * pool.length)] || WORDS[cat][0];
    g.used.add(word); g.cat = cat; g.word = word;
    const seats = active(t); g.spy = seats[Math.floor(Math.random() * seats.length)];
    g.order = kit.shuffle(seats.slice()); g.clueIdx = 0; g.clues = []; g.votes = {}; g.accused = null; g.guessOpts = null; g.guess = null; g.roundWin = null;
    kit.say(t, { sys: true, text: `${g.round}. tur başladı · Kategori: ${cat}` });
    phase(t, 'roles', MS.roles, () => nextClue(t));
  }
  function nextClue(t) {
    const g = t.g;
    while (g.clueIdx < g.order.length && !t.seats[g.order[g.clueIdx]]) g.clueIdx++;
    if (g.clueIdx >= g.order.length) { kit.say(t, { sys: true, text: 'İpuçları bitti. Şimdi konuşun: kim casus?' }); return phase(t, 'talk', MS.talk, () => startVote(t)); }
    g.clueSeat = g.order[g.clueIdx];
    phase(t, 'clue', MS.clue, () => { g.clues.push({ seat: g.clueSeat, text: '…' }); g.clueIdx++; nextClue(t); });
  }
  function startVote(t) { t.g.votes = {}; phase(t, 'vote', MS.vote, () => tally(t)); }
  function tally(t) {
    const g = t.g; const cnt = {};
    Object.values(g.votes).forEach((s) => { cnt[s] = (cnt[s] || 0) + 1; });
    const max = Math.max(0, ...Object.values(cnt)); const top = Object.keys(cnt).filter((k) => cnt[k] === max).map(Number);
    g.voteCount = cnt;
    if (!max || top.length > 1) { kit.say(t, { sys: true, text: 'Oylar eşit çıktı, kimse suçlanmadı. Casus kazandı! 🕵️' }); return endRound(t, 'spy'); }
    g.accused = top[0];
    if (g.accused !== g.spy) { kit.say(t, { sys: true, text: `${kit.nameOf(t, g.accused)} suçlandı ama casus değildi! Casus ${kit.nameOf(t, g.spy)} kazandı. 🕵️` }); return endRound(t, 'spy'); }
    const others = WORDS[g.cat].filter((w) => w !== g.word); kit.shuffle(others);
    g.guessOpts = kit.shuffle([g.word, ...others.slice(0, 7)]);
    kit.say(t, { sys: true, text: `Casus yakalandı: ${kit.nameOf(t, g.spy)}! Son şansı: kelimeyi tahmin etmek.` });
    phase(t, 'guess', MS.guess, () => endRound(t, 'village'));
  }
  function endRound(t, who) {
    const g = t.g; g.roundWin = who;
    const seats = active(t);
    if (who === 'spy') g.score[g.spy] = (g.score[g.spy] || 0) + 3;
    else seats.forEach((s) => { if (s !== g.spy) g.score[s] = (g.score[s] || 0) + 1 + (g.votes[s] === g.spy ? 1 : 0); });
    kit.say(t, { sys: true, text: `Kelime: ${g.word}` });
    phase(t, 'reveal', MS.reveal, () => startRound(t));
  }
  function finish(t) {
    const g = t.g; const sc = g.score; const best = Math.max(0, ...Object.values(sc));
    const winners = Object.keys(sc).filter((k) => sc[k] === best && best > 0).map(Number);
    kit.end(t, { winners, points: sc, text: winners.length ? `Kazanan: ${winners.map((w) => kit.nameOf(t, w)).join(', ')}` : 'Oyun bitti' });
  }
  kit.register({
    key: 'casus', name: 'Kim Casus?', icon: 'casus', emoji: '🕵️', min: 3, max: 10, size: 10, bots: false, party: true, minHumans: 3, minPlay: 3,
    setup(t) { const g = t.g; g.round = 0; g.used = new Set(); g.score = {}; startRound(t); },
    turn: () => null,
    view(t, me) {
      const g = t.g; const isSpy = me === g.spy; const reveal = g.phase === 'reveal';
      return {
        cs: {
          phase: g.phase, round: g.round, rounds: ROUNDS, cat: g.cat, word: isSpy && !reveal ? null : g.word, spy: reveal || g.phase === 'guess' ? g.spy : isSpy ? me : null, isSpy,
          clueSeat: g.phase === 'clue' ? g.clueSeat : null, clues: g.clues, voted: g.votes[me] ?? null, votedN: Object.keys(g.votes).length, voters: active(t).length,
          accused: g.accused, guessOpts: g.phase === 'guess' ? g.guessOpts : null, guess: g.guess, roundWin: g.roundWin, score: g.score, voteCount: reveal ? g.voteCount || {} : null,
        },
      };
    },
    move(t, seat, b) {
      const g = t.g;
      if (b.type === 'clue') {
        if (g.phase !== 'clue' || g.clueSeat !== seat) return 'Şu an ipucu sırası sende değil.';
        const text = kit.ctx.moderation.mask(String(b.text || '').trim().slice(0, 40)); if (!text) return 'Bir ipucu yaz.';
        if (seat !== g.spy && fold(text).includes(fold(g.word))) return 'Kelimenin kendisini yazamazsın 😄';
        g.clues.push({ seat, text }); g.clueIdx++; nextClue(t); return null;
      }
      if (b.type === 'vote') {
        if (g.phase !== 'vote') return 'Oylama şu an açık değil.';
        const s = Number(b.seat); if (s === seat || !t.seats[s]) return 'Geçersiz oy.';
        g.votes[seat] = s;
        if (Object.keys(g.votes).length >= active(t).length) { clearTimeout(g.ph); tally(t); }
        return null;
      }
      if (b.type === 'guess') {
        if (g.phase !== 'guess' || seat !== g.spy) return 'Tahmin hakkın yok.';
        g.guess = String(b.word || '');
        const ok = g.guess === g.word;
        kit.say(t, { sys: true, ok, text: ok ? `Casus kelimeyi bildi: ${g.word}! Casus kazandı. 🕵️` : `Casus “${g.guess}” dedi, yanlış! Köylüler kazandı. 🎉` });
        clearTimeout(g.ph); endRound(t, ok ? 'spy' : 'village'); return null;
      }
      if (b.type === 'skip' && g.phase === 'talk') { g.skip = g.skip || new Set(); g.skip.add(seat); if (g.skip.size >= Math.ceil(active(t).length * 0.6)) { g.skip = null; clearTimeout(g.ph); startVote(t); } return null; }
      return 'Geçersiz hamle.';
    },
    chat(t, seat, text) {
      const g = t.g;
      if (seat !== g.spy && g.word && g.phase !== 'reveal' && fold(text).includes(fold(g.word))) return { block: true, reply: { warn: 'Kelimeyi açık açık yazamazsın 😄' } };
      return null;
    },
    leave(t, seat) {
      const g = t.g; if (!g) return;
      if (seat === g.spy && g.phase !== 'reveal') { kit.say(t, { sys: true, text: 'Casus oyundan ayrıldı! Tur yeniden başlıyor.' }); clearTimeout(g.ph); g.round--; startRound(t); return; }
      if (g.phase === 'clue' && g.clueSeat === seat) { clearTimeout(g.ph); g.clueIdx++; nextClue(t); }
    },
  });
};

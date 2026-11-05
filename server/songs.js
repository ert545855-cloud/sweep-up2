// Şarkı yarışması: 3 ayda bir (her çeyrek) sezon. Başvuru → oylama → sonuç.
// En çok oy alan şarkı SwipeUp tarafından Spotify'da yayınlanır.
const { nanoid } = require('nanoid');

const DAY = 86400000;
const GENRES = ['Pop', 'Rap / Hip-hop', 'Rock', 'Arabesk', 'Türk halk müziği', 'Türk sanat müziği', 'Elektronik', 'R&B / Soul', 'Akustik', 'Alternatif', 'Caz', 'Diğer'];
const LANGS = ['Türkçe', 'İngilizce', 'Kürtçe', 'Arapça', 'Enstrümantal', 'Diğer'];
const SEASONS = ['Kış', 'Bahar', 'Yaz', 'Sonbahar'];
const DEFAULTS = { auto: true, announce: true, votesPerUser: 3, maxPerUser: 2, maxMB: 15, showVotes: false, minAccountDays: 1 };
const RELEASE = { none: 'Bekliyor', preparing: 'Yayına hazırlanıyor', live: 'Spotify’da yayında' };
const SPOTIFY_RE = /^https:\/\/open\.spotify\.com\/(intl-[a-z]{2}\/)?(track|album)\/[A-Za-z0-9]+(\?[\w=&%-]*)?$/;

module.exports = function songs(app, ctx) {
  const { store, auth, brief, notify, limited, isMedia, pushAdmins } = ctx;
  const now = () => Date.now();
  const cfg = () => ({ ...DEFAULTS, ...(store.get('settings', 'songs') || {}) });
  const clean = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  const cleanML = (s, n) => String(s ?? '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);
  const TR = 3 * 3600000;

  // ---- Çeyrek / sezon hesapları (Türkiye saati) ----
  const qOf = (t = now()) => { const d = new Date(t + TR); return { y: d.getUTCFullYear(), q: Math.floor(d.getUTCMonth() / 3) }; };
  const monthStart = (y, m) => Date.UTC(y, m, 1) - TR; // TR 00:00
  const seasonId = ({ y, q }) => `${y}-Q${q + 1}`;
  const seasonTitle = ({ y, q }) => `${y} ${SEASONS[q]} Şarkı Yarışması`;
  const seasonDates = ({ y, q }) => ({ submitStart: monthStart(y, q * 3), submitEnd: monthStart(y, q * 3 + 2), voteEnd: monthStart(y, q * 3 + 3) });

  const phase = (c) => {
    if (!c || c.status === 'cancelled') return 'cancelled';
    const t = now();
    if (t < c.submitStart) return 'soon';
    if (t < c.submitEnd) return 'submit';
    if (t < c.voteEnd) return 'vote';
    return 'ended';
  };
  const PHASE = { soon: 'Yakında', submit: 'Başvurular açık', vote: 'Oylama sürüyor', ended: 'Sonuçlandı', cancelled: 'İptal edildi' };

  const contests = () => store.all('song_contests').sort((a, b) => a.submitStart - b.submitStart);
  // Kullanıcıya gösterilecek yarışma: süren/yaklaşan ilk yarışma; yoksa son biten
  const current = () => {
    const list = contests().filter((c) => c.status !== 'cancelled');
    return list.find((c) => ['soon', 'submit', 'vote'].includes(phase(c)) && c.submitStart - now() < 30 * DAY) || list.filter((c) => phase(c) === 'ended').pop() || null;
  };
  const songsOf = (cid, f = () => true) => store.filter('songs', (s) => s.contestId === cid && f(s));
  const votesOf = (sid) => store.filter('song_votes', (v) => v.songId === sid);
  const votesBy = (cid, uid) => store.filter('song_votes', (v) => v.contestId === cid && v.uid === uid);

  // Sıralama: oy sayısı; eşitlikte son oyu daha önce alan öne geçer
  const ranking = (cid) => songsOf(cid, (s) => s.status === 'approved').map((s) => {
    const vs = votesOf(s.id).sort((a, b) => a.at - b.at);
    return { s, n: vs.length, last: vs.length ? vs[vs.length - 1].at : Infinity };
  }).sort((a, b) => b.n - a.n || a.last - b.last || a.s.createdAt - b.s.createdAt);

  // Kullanıcıya göre sabit karışık sıra (oylamada ilk yüklenen avantajlı olmasın)
  const hash = (str) => { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

  const contestOut = (c, extra = {}) => c && ({
    id: c.id, season: c.season, title: c.title, desc: c.desc || '', prize: c.prize || '', submitStart: c.submitStart, submitEnd: c.submitEnd, voteEnd: c.voteEnd,
    phase: phase(c), phaseLabel: PHASE[phase(c)], winnerId: c.winnerId || null,
    release: { status: c.release?.status || 'none', label: RELEASE[c.release?.status || 'none'], spotifyUrl: c.release?.status === 'live' ? c.release.spotifyUrl || null : null },
    ...extra,
  });
  const songOut = (s, viewerId, c, opts = {}) => {
    const ph = phase(c); const st = cfg();
    const mine = s.uid === viewerId;
    const showVotes = opts.admin || ph === 'ended' || st.showVotes;
    return {
      id: s.id, contestId: s.contestId, title: s.title, artist: s.artist, feat: s.feat || '', genre: s.genre, language: s.language,
      composer: s.composer || '', lyricist: s.lyricist || '', producer: s.producer || '', explicit: !!s.explicit, about: s.about || '',
      cover: s.cover || null, audio: s.audio, duration: s.duration || 0, plays: s.plays || 0, createdAt: s.createdAt,
      user: brief(store.get('users', s.uid)), mine,
      votes: showVotes ? votesOf(s.id).length : null,
      voted: !!store.get('song_votes', `${s.contestId}_${viewerId}_${s.id}`),
      winner: c?.winnerId === s.id,
      ...(mine || opts.admin ? { status: s.status, reason: s.reason || '' } : {}),
      ...(opts.full ? { lyrics: s.lyrics || '' } : {}),
    };
  };

  // ---- Otomatik sezon + aşama bildirimleri ----
  const activeUsers = () => store.filter('users', (u) => !['falci', 'official'].includes(u.role) && u.status !== 'banned' && (u.lastSeen || 0) > now() - 30 * DAY);
  const participants = (c) => [...new Set(songsOf(c.id, (s) => s.status === 'approved').map((s) => s.uid))];
  function decideWinner(c, by = null) {
    const top = ranking(c.id)[0];
    if (!top || !top.n) { store.update('song_contests', c.id, { winnerId: null, decidedAt: now(), noWinner: true }); return null; }
    store.update('song_contests', c.id, { winnerId: top.s.id, decidedAt: now(), decidedBy: by, release: { status: 'preparing', spotifyUrl: null, at: now() } });
    return top.s;
  }
  function announceWinner(c, s) {
    if (!s) return;
    notify(s.uid, { type: 'announce', title: 'Şarkı yarışmasını kazandın!', text: `Tebrikler! “${s.title}” ${c.title}nı kazandı. Şarkını Spotify’da yayınlamak için seninle iletişime geçeceğiz.`, url: '/#/sarki', tag: `song-win-${c.id}` });
    const voters = new Set(store.filter('song_votes', (v) => v.contestId === c.id).map((v) => v.uid));
    participants(c).forEach((u) => voters.add(u)); voters.delete(s.uid);
    voters.forEach((uid) => notify(uid, { type: 'announce', title: 'Şarkı yarışması sonuçlandı', text: `Kazanan: “${s.title}” · ${s.artist}. Spotify’da yayınlanacak!`, url: '/#/sarki', tag: `song-end-${c.id}` }));
    pushAdmins?.({ title: 'Şarkı yarışması sonuçlandı', body: `${c.title}: “${s.title}” · ${s.artist} (${votesOf(s.id).length} oy). Spotify yayınını başlat.`, url: '/admin/#/songs', tag: `song-end-${c.id}` });
  }
  function tick() {
    const st = cfg();
    if (st.auto) {
      const q = qOf(); const id = seasonId(q);
      if (!store.find('song_contests', (c) => c.season === id)) {
        store.put('song_contests', { id: nanoid(10), season: id, title: seasonTitle(q), desc: 'Kendi şarkını yükle, topluluk oylasın. En çok oyu alan şarkıyı SwipeUp olarak Spotify’da yayınlıyoruz!', prize: 'Kazanan şarkı SwipeUp tarafından Spotify’da yayınlanır.', ...seasonDates(q), status: 'active', createdAt: now(), auto: true, flags: {} });
      }
    }
    for (const c of contests()) {
      if (c.status === 'cancelled') continue;
      const ph = phase(c); const fl = c.flags || {};
      const set = (k) => store.update('song_contests', c.id, { flags: { ...(store.get('song_contests', c.id).flags || {}), [k]: now() } });
      if (ph === 'submit' && !fl.open) {
        set('open');
        if (st.announce && now() - c.submitStart < 7 * DAY) activeUsers().forEach((u) => notify(u.id, { type: 'announce', title: 'Şarkı yarışması başladı', text: `${c.title} için başvurular açıldı! Şarkını yükle, kazanırsan Spotify’da yayınlayalım.`, url: '/#/sarki', tag: `song-open-${c.id}` }));
      }
      if (ph === 'vote' && !fl.vote) {
        set('vote');
        if (st.announce && now() - c.submitEnd < 3 * DAY) activeUsers().forEach((u) => notify(u.id, { type: 'announce', title: 'Şarkı yarışmasında oylama başladı', text: `${c.title}: şarkıları dinle, favorilerine oy ver!`, url: '/#/sarki', tag: `song-vote-${c.id}` }));
      }
      if (ph === 'ended' && !fl.ended) {
        set('ended');
        const cur = store.get('song_contests', c.id);
        const w = cur.winnerId ? store.get('songs', cur.winnerId) : decideWinner(cur);
        if (now() - c.voteEnd < 3 * DAY) announceWinner(store.get('song_contests', c.id), w);
      }
    }
  }
  setTimeout(tick, 5000).unref?.();
  setInterval(tick, 5 * 60000).unref();

  // ---- Kullanıcı ----
  app.get('/api/songs', auth, (req, res) => {
    const c = current(); const st = cfg(); const uid = req.user.id;
    const winners = contests().filter((x) => x.winnerId && phase(x) === 'ended').reverse().slice(0, 12).map((x) => {
      const s = store.get('songs', x.winnerId);
      return s ? { contest: contestOut(x), song: songOut(s, uid, x) } : null;
    }).filter(Boolean);
    if (!c) return res.json({ contest: null, winners, genres: GENRES, langs: LANGS, rules: { votesPerUser: st.votesPerUser, maxPerUser: st.maxPerUser, maxMB: st.maxMB } });
    const ph = phase(c);
    let list = songsOf(c.id, (s) => s.status === 'approved');
    if (ph === 'ended') { const r = ranking(c.id).map((x) => x.s.id); list.sort((a, b) => r.indexOf(a.id) - r.indexOf(b.id)); } else list.sort((a, b) => hash(uid + a.id) - hash(uid + b.id));
    const mine = songsOf(c.id, (s) => s.uid === uid && s.status !== 'withdrawn').sort((a, b) => b.createdAt - a.createdAt);
    res.json({
      contest: contestOut(c, { entries: list.length }), genres: GENRES, langs: LANGS,
      rules: { votesPerUser: st.votesPerUser, maxPerUser: st.maxPerUser, maxMB: st.maxMB, showVotes: st.showVotes || ph === 'ended' },
      songs: list.map((s, i) => ({ ...songOut(s, uid, c), rank: ph === 'ended' ? i + 1 : null })),
      mine: mine.map((s) => songOut(s, uid, c)), myVotes: votesBy(c.id, uid).map((v) => v.songId),
      winners,
    });
  });
  // Ana sayfa kartı için hafif özet
  app.get('/api/songs/summary', auth, (req, res) => {
    const c = current(); if (!c) return res.json({ contest: null });
    const ph = phase(c); const uid = req.user.id;
    res.json({ contest: contestOut(c, { entries: songsOf(c.id, (s) => s.status === 'approved').length }), votesLeft: ph === 'vote' ? Math.max(0, cfg().votesPerUser - votesBy(c.id, uid).length) : null, mine: songsOf(c.id, (s) => s.uid === uid && ['pending', 'approved'].includes(s.status)).length });
  });
  app.get('/api/songs/:id', auth, (req, res) => {
    const s = store.get('songs', req.params.id);
    if (!s || (s.status !== 'approved' && s.uid !== req.user.id)) return res.status(404).json({ error: 'Şarkı bulunamadı.' });
    const c = store.get('song_contests', s.contestId);
    res.json({ ...songOut(s, req.user.id, c, { full: true }), contest: contestOut(c) });
  });

  const readSong = (b, base = {}) => {
    const out = {
      title: clean(b.title, 80), artist: clean(b.artist, 60), feat: clean(b.feat, 80), genre: GENRES.includes(b.genre) ? b.genre : 'Diğer',
      language: LANGS.includes(b.language) ? b.language : 'Türkçe', composer: clean(b.composer, 120), lyricist: clean(b.lyricist, 120), producer: clean(b.producer, 120),
      explicit: !!b.explicit, about: cleanML(b.about, 500), lyrics: cleanML(b.lyrics, 6000),
    };
    if (out.language === 'Enstrümantal') out.lyricist = out.lyricist || '-';
    return { ...base, ...out };
  };
  app.post('/api/songs', auth, (req, res) => {
    const b = req.body || {}; const st = cfg(); const u = req.user;
    if (['falci', 'official'].includes(u.role)) return res.status(400).json({ error: 'Bu hesap yarışmaya katılamaz.' });
    const c = current();
    if (!c || phase(c) !== 'submit') return res.status(400).json({ error: 'Şu an başvuru kabul edilmiyor.' });
    const mineN = songsOf(c.id, (s) => s.uid === u.id && ['pending', 'approved'].includes(s.status)).length;
    if (mineN >= st.maxPerUser) return res.status(400).json({ error: `Bu sezonda en fazla ${st.maxPerUser} şarkı gönderebilirsin.` });
    if (limited('song:' + u.id, 6, DAY)) return res.status(429).json({ error: 'Bugün çok fazla deneme yaptın. Yarın tekrar dene.' });
    const s = readSong(b);
    if (s.title.length < 1) return res.status(400).json({ error: 'Şarkı adını yaz.' });
    if (s.artist.length < 2) return res.status(400).json({ error: 'Sanatçı adını yaz (Spotify’da bu adla görünecek).' });
    if (s.composer.length < 2) return res.status(400).json({ error: 'Besteciyi yaz.' });
    if (s.lyricist.length < 1) return res.status(400).json({ error: 'Söz yazarını yaz (enstrümantalse “-”).' });
    const legalName = clean(b.legalName, 80);
    if (legalName.split(' ').filter(Boolean).length < 2) return res.status(400).json({ error: 'Gerçek adını ve soyadını yaz (yayın sözleşmesi için gerekli, herkese gösterilmez).' });
    if (clean(b.contact, 120).length < 5) return res.status(400).json({ error: 'Sana ulaşabileceğimiz e-posta ya da telefonu yaz (kazanırsan yayın için gerekli, herkese gösterilmez).' });
    if (!b.rightsOk) return res.status(400).json({ error: 'Şarkının sana ait olduğunu ve yayın iznini onaylaman gerekiyor.' });
    if (!isMedia(b.audio)) return res.status(400).json({ error: 'Şarkı dosyasını yükle.' });
    const meta = store.get('media_meta', b.audio.split('/').pop());
    if (!meta || meta.userId !== u.id || !/^audio\//.test(meta.mime)) return res.status(400).json({ error: 'Şarkı dosyası bir ses dosyası olmalı (MP3, M4A, WAV).' });
    if (meta.size > st.maxMB * 1024 * 1024) return res.status(400).json({ error: `Şarkı dosyası en fazla ${st.maxMB} MB olabilir.` });
    const duration = Math.round(+b.duration || 0);
    if (duration && duration < 30) return res.status(400).json({ error: 'Şarkı en az 30 saniye olmalı.' });
    if (duration > 10 * 60) return res.status(400).json({ error: 'Şarkı en fazla 10 dakika olabilir.' });
    const cover = isMedia(b.cover) ? b.cover : null;
    const doc = store.put('songs', {
      id: nanoid(12), contestId: c.id, uid: u.id, ...s, legalName, contact: clean(b.contact, 120), rightsOk: true, rightsAt: now(),
      audio: b.audio, audioMime: meta.mime, audioSize: meta.size, duration, cover, status: 'pending', plays: 0, createdAt: now(),
    });
    pushAdmins?.({ title: 'Yeni şarkı başvurusu', body: `“${doc.title}” · ${doc.artist} (@${u.username})`, url: '/admin/#/songs', tag: 'song-new' });
    res.json(songOut(doc, u.id, c));
  });
  app.delete('/api/songs/:id', auth, (req, res) => {
    const s = store.get('songs', req.params.id);
    if (!s || s.uid !== req.user.id) return res.status(404).json({ error: 'Şarkı bulunamadı.' });
    const c = store.get('song_contests', s.contestId);
    if (s.status === 'approved' && phase(c) !== 'submit') return res.status(400).json({ error: 'Oylama başladıktan sonra şarkı geri çekilemez.' });
    store.update('songs', s.id, { status: 'withdrawn', withdrawnAt: now() });
    store.filter('song_votes', (v) => v.songId === s.id).forEach((v) => store.del('song_votes', v.id));
    res.json({ ok: true });
  });
  app.post('/api/songs/:id/vote', auth, (req, res) => {
    const s = store.get('songs', req.params.id); const u = req.user; const st = cfg();
    if (!s || s.status !== 'approved') return res.status(404).json({ error: 'Şarkı bulunamadı.' });
    const c = store.get('song_contests', s.contestId);
    if (phase(c) !== 'vote') return res.status(400).json({ error: phase(c) === 'ended' ? 'Oylama bitti.' : 'Oylama henüz başlamadı.' });
    if (s.uid === u.id) return res.status(400).json({ error: 'Kendi şarkına oy veremezsin.' });
    if (['falci', 'official'].includes(u.role)) return res.status(400).json({ error: 'Bu hesap oy veremez.' });
    if (now() - (u.createdAt || 0) < st.minAccountDays * DAY) return res.status(403).json({ error: `Yeni hesaplar üyelikten ${st.minAccountDays} gün sonra oy verebilir.` });
    const id = `${c.id}_${u.id}_${s.id}`;
    if (store.get('song_votes', id)) return res.json({ ok: true, voted: true, left: st.votesPerUser - votesBy(c.id, u.id).length });
    const used = votesBy(c.id, u.id).length;
    if (used >= st.votesPerUser) return res.status(400).json({ error: `${st.votesPerUser} oy hakkının hepsini kullandın. Başka şarkıya vermek için bir oyunu geri al.` });
    if (limited('svote:' + u.id, 30, 3600000)) return res.status(429).json({ error: 'Biraz yavaş, tekrar dene.' });
    store.put('song_votes', { id, contestId: c.id, uid: u.id, songId: s.id, at: now() });
    ctx.track?.('song_vote');
    res.json({ ok: true, voted: true, left: st.votesPerUser - used - 1, votes: st.showVotes ? votesOf(s.id).length : null });
  });
  app.delete('/api/songs/:id/vote', auth, (req, res) => {
    const s = store.get('songs', req.params.id); const st = cfg();
    if (!s) return res.status(404).json({ error: 'Şarkı bulunamadı.' });
    const c = store.get('song_contests', s.contestId);
    if (phase(c) !== 'vote') return res.status(400).json({ error: 'Oylama açık değil.' });
    store.del('song_votes', `${c.id}_${req.user.id}_${s.id}`);
    res.json({ ok: true, voted: false, left: st.votesPerUser - votesBy(c.id, req.user.id).length, votes: st.showVotes ? votesOf(s.id).length : null });
  });
  const played = new Set();
  setInterval(() => played.clear(), 6 * 3600000).unref();
  app.post('/api/songs/:id/play', auth, (req, res) => {
    const s = store.get('songs', req.params.id);
    if (s && s.status === 'approved') { const k = `${req.user.id}|${s.id}`; if (!played.has(k)) { played.add(k); store.update('songs', s.id, { plays: (s.plays || 0) + 1 }); } }
    res.json({ ok: true });
  });

  // ---- Yönetim ----
  const A = ctx.admin;
  if (!A?.adminAuth) return;
  const adminContest = (c) => {
    const all = songsOf(c.id);
    return contestOut(c, {
      status: c.status, auto: !!c.auto, createdAt: c.createdAt, release: { status: c.release?.status || 'none', label: RELEASE[c.release?.status || 'none'], spotifyUrl: c.release?.spotifyUrl || '', note: c.release?.note || '', at: c.release?.at || null },
      counts: { total: all.filter((s) => s.status !== 'withdrawn').length, pending: all.filter((s) => s.status === 'pending').length, approved: all.filter((s) => s.status === 'approved').length, rejected: all.filter((s) => s.status === 'rejected').length, votes: store.filter('song_votes', (v) => v.contestId === c.id).length, voters: new Set(store.filter('song_votes', (v) => v.contestId === c.id).map((v) => v.uid)).size },
    });
  };
  const adminSong = (s, c) => ({ ...songOut(s, null, c, { admin: true, full: true }), legalName: s.legalName || '', contact: s.contact || '', audioMime: s.audioMime, audioSize: s.audioSize, rightsAt: s.rightsAt, reviewedAt: s.reviewedAt || null, reviewedBy: s.reviewedBy || null, username: store.get('users', s.uid)?.username || '' });

  app.get('/api/admin/songs', A.adminAuth, (req, res) => {
    res.json({ settings: cfg(), genres: GENRES, langs: LANGS, release: RELEASE, contests: contests().reverse().map(adminContest), next: (() => { const q = qOf(); const n = q.q === 3 ? { y: q.y + 1, q: 0 } : { y: q.y, q: q.q + 1 }; return { season: seasonId(n), title: seasonTitle(n), ...seasonDates(n) }; })() });
  });
  app.put('/api/admin/songs/settings', A.adminAuth, A.owner, (req, res) => {
    const b = req.body || {}; const c = cfg();
    const n = (v, lo, hi, d) => { const x = parseInt(v, 10); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
    const s = { id: 'songs', auto: b.auto !== undefined ? !!b.auto : c.auto, announce: b.announce !== undefined ? !!b.announce : c.announce, showVotes: b.showVotes !== undefined ? !!b.showVotes : c.showVotes, votesPerUser: n(b.votesPerUser, 1, 20, c.votesPerUser), maxPerUser: n(b.maxPerUser, 1, 10, c.maxPerUser), maxMB: n(b.maxMB, 5, 38, c.maxMB), minAccountDays: n(b.minAccountDays, 0, 60, c.minAccountDays) };
    store.put('settings', s);
    A.audit(req.admin, 'şarkı yarışması ayarlarını güncelledi', null, `oy ${s.votesPerUser} · şarkı ${s.maxPerUser} · ${s.maxMB} MB · otomatik ${s.auto ? 'açık' : 'kapalı'}`);
    if (s.auto) tick();
    res.json(cfg());
  });
  const readDates = (b, cur = {}) => {
    const t = (v, d) => { const x = typeof v === 'number' ? v : Date.parse(v); return Number.isFinite(x) ? x : d; };
    const d = { submitStart: t(b.submitStart, cur.submitStart), submitEnd: t(b.submitEnd, cur.submitEnd), voteEnd: t(b.voteEnd, cur.voteEnd) };
    if (!d.submitStart || !d.submitEnd || !d.voteEnd) return { error: 'Tarihleri gir.' };
    if (!(d.submitStart < d.submitEnd && d.submitEnd < d.voteEnd)) return { error: 'Tarih sırası: başvuru başlangıcı < başvuru bitişi < oylama bitişi olmalı.' };
    return d;
  };
  app.post('/api/admin/songs/contests', A.adminAuth, A.owner, (req, res) => {
    const b = req.body || {}; const d = readDates(b); if (d.error) return res.status(400).json(d);
    const title = clean(b.title, 80); if (title.length < 3) return res.status(400).json({ error: 'Yarışma adını yaz.' });
    const season = clean(b.season, 20) || `ozel-${nanoid(5)}`;
    if (store.find('song_contests', (c) => c.season === season && c.status !== 'cancelled')) return res.status(400).json({ error: 'Bu sezon için zaten bir yarışma var.' });
    const c = store.put('song_contests', { id: nanoid(10), season, title, desc: cleanML(b.desc, 600), prize: clean(b.prize, 160), ...d, status: 'active', createdAt: now(), createdBy: req.admin.username, flags: {} });
    A.audit(req.admin, 'şarkı yarışması oluşturdu', null, title);
    res.json(adminContest(c));
  });
  app.put('/api/admin/songs/contests/:id', A.adminAuth, A.owner, (req, res) => {
    const c = store.get('song_contests', req.params.id); if (!c) return res.status(404).json({ error: 'Yarışma bulunamadı.' });
    const b = req.body || {}; const d = readDates(b, c); if (d.error) return res.status(400).json(d);
    const patch = { ...d, title: b.title !== undefined ? clean(b.title, 80) || c.title : c.title, desc: b.desc !== undefined ? cleanML(b.desc, 600) : c.desc, prize: b.prize !== undefined ? clean(b.prize, 160) : c.prize };
    if (b.status === 'cancelled' || b.status === 'active') patch.status = b.status;
    // tarih ileri alınırsa ilgili aşama bildirimleri yeniden gidebilsin; sonuç geri açılırsa kazanan sıfırlanır
    const fl = { ...(c.flags || {}) };
    if (patch.voteEnd > now() && c.voteEnd <= now()) { delete fl.ended; patch.winnerId = null; patch.release = { status: 'none' }; }
    if (patch.submitEnd > now()) delete fl.vote;
    patch.flags = fl;
    store.update('song_contests', c.id, patch);
    A.audit(req.admin, 'şarkı yarışmasını düzenledi', null, `${patch.title}${patch.status === 'cancelled' ? ' (iptal)' : ''}`);
    res.json(adminContest(store.get('song_contests', c.id)));
  });
  app.delete('/api/admin/songs/contests/:id', A.adminAuth, A.owner, (req, res) => {
    const c = store.get('song_contests', req.params.id); if (!c) return res.status(404).json({ error: 'Yarışma bulunamadı.' });
    if (songsOf(c.id, (s) => s.status !== 'withdrawn').length) return res.status(400).json({ error: 'Şarkı gönderilmiş yarışma silinemez; iptal edebilirsin.' });
    store.del('song_contests', c.id);
    A.audit(req.admin, 'şarkı yarışmasını sildi', null, c.title);
    res.json({ ok: true });
  });
  app.get('/api/admin/songs/contests/:id', A.adminAuth, (req, res) => {
    const c = store.get('song_contests', req.params.id); if (!c) return res.status(404).json({ error: 'Yarışma bulunamadı.' });
    const rank = ranking(c.id).map((x) => x.s.id);
    const list = songsOf(c.id, (s) => s.status !== 'withdrawn').map((s) => ({ ...adminSong(s, c), rank: s.status === 'approved' ? rank.indexOf(s.id) + 1 : null }))
      .sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || (a.rank || 999) - (b.rank || 999) || b.createdAt - a.createdAt);
    res.json({ contest: adminContest(c), songs: list });
  });
  app.post('/api/admin/songs/contests/:id/winner', A.adminAuth, A.owner, (req, res) => {
    const c = store.get('song_contests', req.params.id); if (!c) return res.status(404).json({ error: 'Yarışma bulunamadı.' });
    if (req.body?.auto) { const w = decideWinner(c, req.admin.username); A.audit(req.admin, 'şarkı yarışması kazananını oylara göre belirledi', null, w ? `${w.title} · ${w.artist}` : 'oy yok'); return res.json(adminContest(store.get('song_contests', c.id))); }
    const s = store.get('songs', req.body?.songId);
    if (!s || s.contestId !== c.id || s.status !== 'approved') return res.status(400).json({ error: 'Onaylı bir şarkı seç.' });
    store.update('song_contests', c.id, { winnerId: s.id, decidedAt: now(), decidedBy: req.admin.username, release: { status: 'preparing', spotifyUrl: null, at: now() } });
    if (req.body?.notify) announceWinner(store.get('song_contests', c.id), s);
    A.audit(req.admin, 'şarkı yarışması kazananını seçti', null, `${s.title} · ${s.artist}`);
    res.json(adminContest(store.get('song_contests', c.id)));
  });
  app.put('/api/admin/songs/contests/:id/release', A.adminAuth, A.owner, (req, res) => {
    const c = store.get('song_contests', req.params.id); if (!c) return res.status(404).json({ error: 'Yarışma bulunamadı.' });
    if (!c.winnerId) return res.status(400).json({ error: 'Önce kazanan belli olmalı.' });
    const b = req.body || {}; const status = RELEASE[b.status] ? b.status : 'preparing';
    const url = clean(b.spotifyUrl, 300);
    if (status === 'live' && !SPOTIFY_RE.test(url)) return res.status(400).json({ error: 'Geçerli bir Spotify şarkı/albüm linki gir (https://open.spotify.com/track/…).' });
    const was = c.release?.status;
    store.update('song_contests', c.id, { release: { status, spotifyUrl: url || null, note: clean(b.note, 300), at: now() } });
    const s = store.get('songs', c.winnerId);
    if (status === 'live' && was !== 'live' && s) {
      notify(s.uid, { type: 'announce', title: 'Şarkın Spotify’da yayında!', text: `“${s.title}” artık Spotify’da. Tebrikler, paylaşmayı unutma!`, url: '/#/sarki', tag: `song-live-${c.id}` });
      if (b.announceAll) activeUsers().filter((u) => u.id !== s.uid).forEach((u) => notify(u.id, { type: 'announce', title: 'Yarışma şarkısı Spotify’da!', text: `${c.title} kazananı “${s.title}” · ${s.artist} Spotify’da yayında. Hemen dinle!`, url: '/#/sarki', tag: `song-live-${c.id}` }));
    }
    A.audit(req.admin, 'şarkı yarışması yayın durumunu güncelledi', null, `${RELEASE[status]}${url ? ' · ' + url : ''}`);
    res.json(adminContest(store.get('song_contests', c.id)));
  });
  app.post('/api/admin/songs/:id/review', A.adminAuth, (req, res) => {
    const s = store.get('songs', req.params.id); if (!s) return res.status(404).json({ error: 'Şarkı bulunamadı.' });
    const status = req.body?.status === 'approved' ? 'approved' : 'rejected';
    const reason = clean(req.body?.reason, 300);
    if (status === 'rejected' && reason.length < 3) return res.status(400).json({ error: 'Reddetme sebebini yaz (kullanıcıya gösterilir).' });
    store.update('songs', s.id, { status, reason: status === 'rejected' ? reason : '', reviewedAt: now(), reviewedBy: req.admin.username });
    if (status === 'rejected') store.filter('song_votes', (v) => v.songId === s.id).forEach((v) => store.del('song_votes', v.id));
    const c = store.get('song_contests', s.contestId);
    notify(s.uid, status === 'approved'
      ? { type: 'announce', title: 'Şarkın yarışmaya kabul edildi', text: `“${s.title}” ${c?.title || 'şarkı yarışması'}nda! Oylama başlayınca arkadaşlarını oy vermeye çağır.`, url: '/#/sarki', tag: `song-rev-${s.id}` }
      : { type: 'announce', title: 'Şarkın yarışmaya alınamadı', text: `“${s.title}”: ${reason}`, url: '/#/sarki', tag: `song-rev-${s.id}` });
    A.audit(req.admin, status === 'approved' ? 'şarkıyı onayladı' : 'şarkıyı reddetti', s.uid, `${s.title} · ${s.artist}${reason ? ' — ' + reason : ''}`);
    res.json(adminSong(store.get('songs', s.id), c));
  });
  app.put('/api/admin/songs/:id', A.adminAuth, (req, res) => {
    const s = store.get('songs', req.params.id); if (!s) return res.status(404).json({ error: 'Şarkı bulunamadı.' });
    const b = req.body || {};
    const patch = readSong({ ...s, ...b });
    if (b.legalName !== undefined) patch.legalName = clean(b.legalName, 80);
    if (b.contact !== undefined) patch.contact = clean(b.contact, 120);
    store.update('songs', s.id, patch);
    A.audit(req.admin, 'şarkı bilgilerini düzenledi', s.uid, `${patch.title} · ${patch.artist}`);
    res.json(adminSong(store.get('songs', s.id), store.get('song_contests', s.contestId)));
  });
  app.delete('/api/admin/songs/:id', A.adminAuth, (req, res) => {
    const s = store.get('songs', req.params.id); if (!s) return res.status(404).json({ error: 'Şarkı bulunamadı.' });
    store.filter('song_votes', (v) => v.songId === s.id).forEach((v) => store.del('song_votes', v.id));
    store.del('songs', s.id);
    A.audit(req.admin, 'yarışma şarkısını sildi', s.uid, `${s.title} · ${s.artist}`);
    res.json({ ok: true });
  });
  // Yönetimden şarkı ekleme (ör. SwipeUp ekibinin seçtiği şarkılar): önce dosyalar yüklenir
  const multer = require('multer');
  const imagefix = require('./imagefix');
  const up = multer({ storage: multer.memoryStorage(), limits: { fileSize: 40 * 1024 * 1024 } });
  app.post('/api/admin/songs/upload', A.adminAuth, up.single('file'), async (req, res) => {
    try {
      const f = req.file; if (!f) return res.status(400).json({ error: 'Dosya gelmedi.' });
      const { mime, buffer } = await imagefix.normalize(f.mimetype, f.buffer);
      if (!/^(image|audio)\//.test(mime)) return res.status(400).json({ error: 'Sadece ses dosyası (MP3, M4A, WAV) ya da kapak görseli yüklenebilir.' });
      const id = nanoid(16);
      const where = await store.saveMedia(id, mime, buffer);
      store.put('media_meta', { id, userId: 'admin:' + req.admin.username, mime, size: buffer.length, where, at: now() });
      res.json({ url: `/media/${id}`, type: mime.split('/')[0], mime, size: buffer.length });
    } catch (e) { res.status(400).json({ error: 'Dosya yüklenemedi: ' + e.message }); }
  });
  app.post('/api/admin/songs/contests/:id/songs', A.adminAuth, (req, res) => {
    const c = store.get('song_contests', req.params.id); if (!c) return res.status(404).json({ error: 'Yarışma bulunamadı.' });
    const b = req.body || {}; const s = readSong(b);
    if (!s.title) return res.status(400).json({ error: 'Şarkı adını yaz.' });
    if (s.artist.length < 2) return res.status(400).json({ error: 'Sanatçı adını yaz.' });
    if (!isMedia(b.audio)) return res.status(400).json({ error: 'Şarkı dosyasını yükle.' });
    const meta = store.get('media_meta', b.audio.split('/').pop());
    if (!meta || !/^audio\//.test(meta.mime)) return res.status(400).json({ error: 'Şarkı dosyası bir ses dosyası olmalı.' });
    let owner = null;
    const un = clean(b.username, 40).replace(/^@/, '').toLowerCase();
    if (un) { owner = store.find('users', (u) => u.username === un); if (!owner) return res.status(400).json({ error: `@${un} adlı kullanıcı bulunamadı.` }); }
    owner = owner || store.find('users', (u) => u.role === 'official');
    if (!owner) return res.status(400).json({ error: 'Şarkının bağlanacağı kullanıcı adını yaz.' });
    const duration = Math.max(0, Math.min(1200, Math.round(+b.duration || 0)));
    const doc = store.put('songs', {
      id: nanoid(12), contestId: c.id, uid: owner.id, ...s, legalName: clean(b.legalName, 80), contact: clean(b.contact, 120), rightsOk: true, rightsAt: now(),
      audio: b.audio, audioMime: meta.mime, audioSize: meta.size, duration, cover: isMedia(b.cover) ? b.cover : null,
      status: 'approved', plays: 0, createdAt: now(), reviewedAt: now(), reviewedBy: req.admin.username, addedBy: req.admin.username,
    });
    if (owner.role !== 'official') notify(owner.id, { type: 'announce', title: 'Şarkın yarışmaya eklendi', text: `“${doc.title}” ${c.title}na SwipeUp ekibi tarafından eklendi.`, url: '/#/sarki', tag: `song-rev-${doc.id}` });
    A.audit(req.admin, 'yarışmaya şarkı ekledi', owner.id, `${doc.title} · ${doc.artist}`);
    res.json(adminSong(doc, c));
  });
  app.get('/api/admin/songs/:id/voters', A.adminAuth, (req, res) => {
    res.json(votesOf(req.params.id).sort((a, b) => b.at - a.at).map((v) => { const u = store.get('users', v.uid); return { at: v.at, user: brief(u), createdAt: u?.createdAt || null, flagged: !!store.find('flags', (f) => f.userId === v.uid && f.status === 'open') }; }));
  });
};
module.exports.GENRES = GENRES;

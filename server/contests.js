// Genel yarışmalar: "en çok gönderi paylaşan", "en çok beğeni alan", "en çok yorum alan"...
// Puanlar yarışma tarihleri arasındaki gerçek verilerden hesaplanır; bitince ödüller (jeton, SwipeUp+, etiket) kendiliğinden verilir.
const { nanoid } = require('nanoid');

const METRICS = {
  posts: { label: 'En çok gönderi paylaşan', unit: 'gönderi', em: '📸' },
  reels: { label: 'En çok Vitrin videosu paylaşan', unit: 'video', em: '🎬' },
  likes: { label: 'En çok beğeni alan', unit: 'beğeni', em: '❤️' },
  comments: { label: 'En çok yorum alan', unit: 'yorum', em: '💬' },
  reposts: { label: 'Gönderileri en çok yeniden paylaşılan', unit: 'paylaşım', em: '🔁' },
  stories: { label: 'En çok hikaye paylaşan', unit: 'hikaye', em: '✨' },
  checkins: { label: 'En çok mekan etiketleyen', unit: 'mekan', em: '📍' },
  invites: { label: 'En çok arkadaş davet eden', unit: 'davet', em: '🎁' },
};

module.exports = function contests(app, ctx) {
  const { store, auth, brief, notify, eco, emitTo } = ctx;
  const now = () => Date.now();
  const SPECIAL = new Set(['falci', 'official']);
  const phase = (c) => (c.status === 'cancelled' ? 'cancelled' : now() < c.start ? 'soon' : now() < c.end ? 'live' : 'ended');
  const PH = { soon: 'Yakında', live: 'Devam ediyor', ended: 'Sona erdi', cancelled: 'İptal' };
  const tagList = () => store.get('settings', 'tags')?.list || [];

  // Beğeni kaydı (beğeni dizisinde zaman yok; ilk beğeni zamanını tutar, beğeni geri alınınca silinir)
  ctx.likeLog = (likerId, p) => { const id = `${likerId}_${p.id}`; if (!store.get('like_log', id)) store.put('like_log', { id, likerId, postId: p.id, ownerId: p.userId, at: now() }); };
  ctx.likeUnlog = (likerId, p) => store.del('like_log', `${likerId}_${p.id}`);
  ctx.contestEvent = () => {}; // puanlar veriden hesaplanır

  // ---- Puan hesabı ----
  const cache = new Map();
  function scores(c) {
    const key = `${c.id}|${c.metric}|${c.start}|${c.end}`;
    const hit = cache.get(key); if (hit && hit.at > now() - 30000 && phase(c) !== 'ended') return hit.list;
    if (phase(c) === 'ended' && c.final) return c.final;
    const from = c.start; const to = Math.min(c.end, now());
    const inR = (t) => t >= from && t < to;
    const m = new Map(); const add = (uid, n = 1) => m.set(uid, (m.get(uid) || 0) + n);
    if (c.metric === 'posts') store.filter('posts', (p) => ['image', 'text'].includes(p.type) && inR(p.createdAt)).forEach((p) => add(p.userId));
    if (c.metric === 'reels') store.filter('posts', (p) => p.type === 'reel' && inR(p.createdAt)).forEach((p) => add(p.userId));
    if (c.metric === 'stories') store.filter('stories', (s) => inR(s.at)).forEach((s) => add(s.userId));
    if (c.metric === 'likes') store.filter('like_log', (l) => inR(l.at) && l.likerId !== l.ownerId).forEach((l) => add(l.ownerId));
    if (c.metric === 'reposts') store.filter('reposts', (r) => inR(r.at) && r.ownerId && r.ownerId !== r.userId).forEach((r) => add(r.ownerId));
    if (c.metric === 'checkins') {
      // Aynı mekan aynı gün bir kez sayılır
      const seen = new Set();
      store.filter('checkins', (x) => inR(x.at)).forEach((x) => { const k = `${x.userId}|${x.venueId}|${new Date(x.at).toISOString().slice(0, 10)}`; if (!seen.has(k)) { seen.add(k); add(x.userId); } });
    }
    if (c.metric === 'comments') {
      // Başkalarından gelen yorumlar; aynı kişinin aynı gönderiye en fazla 3 yorumu sayılır
      store.all('posts').forEach((p) => {
        const per = new Map();
        (p.comments || []).forEach((cm) => {
          if (cm.userId === p.userId || !inR(cm.at)) return;
          const n = (per.get(cm.userId) || 0) + 1; per.set(cm.userId, n);
          if (n <= 3) add(p.userId);
        });
      });
    }
    if (c.metric === 'invites') store.filter('users', (u) => u.invitedBy && inR(u.createdAt || 0)).forEach((u) => add(u.invitedBy));
    const list = [...m.entries()].map(([uid, n]) => ({ uid, n, u: store.get('users', uid) }))
      .filter(({ u }) => u && !SPECIAL.has(u.role) && u.status !== 'banned' && (!c.verifiedOnly || u.verified))
      .sort((a, b) => b.n - a.n || (a.u.createdAt || 0) - (b.u.createdAt || 0))
      .map(({ uid, n }, i) => ({ uid, n, rank: i + 1 }));
    cache.set(key, { at: now(), list });
    if (cache.size > 100) cache.delete(cache.keys().next().value);
    return list;
  }
  const prizeOut = (p) => p && { coins: p.coins || 0, plusDays: p.plusDays || 0, tag: p.tagId ? tagList().find((t) => t.id === p.tagId) || null : null };
  const prizeText = (p) => [p.coins ? `${p.coins} jeton` : '', p.plusDays ? `${p.plusDays} gün SwipeUp+` : '', p.tag ? `${p.tag.em} ${p.tag.name} etiketi` : ''].filter(Boolean).join(' + ');
  function out(c, viewerId, { full = false } = {}) {
    const sc = scores(c); const ph = phase(c); const M = METRICS[c.metric] || {};
    const mine = viewerId ? sc.find((x) => x.uid === viewerId) : null;
    return {
      id: c.id, title: c.title, desc: c.desc, metric: c.metric, metricLabel: M.label, unit: M.unit, em: c.em || M.em, start: c.start, end: c.end, phase: ph, phaseLabel: PH[ph],
      winners: c.winners, prizes: (c.prizes || []).map(prizeOut), verifiedOnly: !!c.verifiedOnly, participants: sc.length, awarded: !!c.awardedAt,
      me: mine ? { rank: mine.rank, n: mine.n } : null,
      top: sc.slice(0, full ? 50 : 3).map((x) => ({ ...x, user: brief(store.get('users', x.uid)) })),
    };
  }
  const visible = () => store.filter('contests', (c) => c.status !== 'cancelled' && c.status !== 'draft').sort((a, b) => (phase(a) === 'live' ? 0 : phase(a) === 'soon' ? 1 : 2) - (phase(b) === 'live' ? 0 : phase(b) === 'soon' ? 1 : 2) || b.start - a.start);

  app.get('/api/contests', auth, (req, res) => res.json({ items: visible().slice(0, 30).map((c) => out(c, req.user.id)) }));
  app.get('/api/contests/:id', auth, (req, res) => {
    const c = store.get('contests', req.params.id);
    if (!c || c.status === 'cancelled' || c.status === 'draft') return res.status(404).json({ error: 'Yarışma bulunamadı.' });
    res.json(out(c, req.user.id, { full: true }));
  });

  // ---- Bitince ödül ver ----
  function award(c, { by } = {}) {
    if (c.awardedAt) return c;
    const sc = scores({ ...c, final: null });
    const winners = sc.filter((x) => x.n > 0).slice(0, c.winners || 1);
    const given = [];
    winners.forEach((w, i) => {
      const p = (c.prizes || [])[i] || {};
      const u = store.get('users', w.uid); if (!u) return;
      if (p.coins) eco.addCoins(u.id, p.coins, 'contest', { ref: c.id });
      if (p.plusDays) eco.grantPlus(u.id, p.plusDays);
      if (p.tagId && tagList().some((t) => t.id === p.tagId)) store.update('users', u.id, { tags: [...new Set([...(store.get('users', u.id).tags || []), p.tagId])].slice(0, 5) });
      const pt = prizeText(prizeOut(p));
      notify(u.id, { type: 'announce', title: `🏆 ${c.title}`, text: `Tebrikler! ${w.rank}. oldun${pt ? `; ödülün hesabına tanımlandı: ${pt}` : ''}.`, url: `/#/yarismalar/${c.id}`, tag: `contest-${c.id}` });
      emitTo(u.id, 'wallet', {});
      given.push({ uid: u.id, rank: w.rank, n: w.n, prize: pt });
    });
    // Diğer katılımcılara sonuç bildirimi
    const win = new Set(winners.map((w) => w.uid));
    sc.filter((x) => !win.has(x.uid) && x.n > 0).slice(0, 500).forEach((x) => notify(x.uid, { type: 'announce', title: c.title, text: `Yarışma bitti! ${x.rank}. oldun. Sonuçları gör.`, url: `/#/yarismalar/${c.id}`, tag: `contest-${c.id}` }));
    store.update('contests', c.id, { awardedAt: now(), awardedBy: by || 'otomatik', given, final: sc.slice(0, 200) });
    return store.get('contests', c.id);
  }
  // Başlayınca duyuru, bitince ödül
  setInterval(() => {
    store.filter('contests', (c) => c.status === 'active').forEach((c) => {
      const ph = phase(c);
      if (ph === 'live' && !c.announcedAt && c.announce) {
        store.update('contests', c.id, { announcedAt: now() });
        store.filter('users', (u) => !SPECIAL.has(u.role) && u.status !== 'banned' && (u.lastSeen || 0) > now() - 30 * 86400000)
          .forEach((u) => notify(u.id, { type: 'announce', title: 'Yeni yarışma başladı', text: `${c.title}: ${METRICS[c.metric]?.label}. Ödüller seni bekliyor!`, url: `/#/yarismalar/${c.id}`, tag: `contest-${c.id}` }));
      }
      if (ph === 'ended' && !c.awardedAt && c.autoAward !== false) award(c);
    });
  }, 60000).unref();

  // ---- Yönetim ----
  const A = ctx.admin;
  if (!A?.adminAuth) return;
  const clean = (b, cur = {}) => {
    const num = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.round(+v))) : d);
    const winners = num(b.winners ?? cur.winners, 1, 10, 3);
    const prizes = (Array.isArray(b.prizes) ? b.prizes : cur.prizes || []).slice(0, winners).map((p) => ({ coins: num(p?.coins, 0, 100000, 0), plusDays: num(p?.plusDays, 0, 365, 0), tagId: tagList().some((t) => t.id === p?.tagId) ? p.tagId : null }));
    return {
      title: String(b.title ?? cur.title ?? '').trim().slice(0, 80), desc: String(b.desc ?? cur.desc ?? '').trim().slice(0, 800),
      metric: METRICS[b.metric] ? b.metric : cur.metric || 'posts', em: String(b.em ?? cur.em ?? '').slice(0, 4),
      start: num(b.start ?? cur.start, 0, 9e15, now()), end: num(b.end ?? cur.end, 0, 9e15, now() + 7 * 86400000),
      winners, prizes, verifiedOnly: !!(b.verifiedOnly ?? cur.verifiedOnly), announce: b.announce === undefined ? cur.announce ?? true : !!b.announce,
    };
  };
  const adminOut = (c) => ({ ...out(c, null, { full: true }), status: c.status, announce: !!c.announce, rawPrizes: c.prizes || [], awardedAt: c.awardedAt || null, awardedBy: c.awardedBy || null, given: (c.given || []).map((g) => ({ ...g, user: brief(store.get('users', g.uid)) })) });
  app.get('/api/admin/contests', A.adminAuth, (req, res) => {
    res.json({ metrics: Object.entries(METRICS).map(([id, m]) => ({ id, ...m })), tags: tagList(), items: store.all('contests').sort((a, b) => b.start - a.start).map(adminOut) });
  });
  app.post('/api/admin/contests', A.adminAuth, A.owner, (req, res) => {
    const d = clean(req.body || {});
    if (d.title.length < 3) return res.status(400).json({ error: 'Yarışmaya bir ad ver.' });
    if (d.end <= d.start) return res.status(400).json({ error: 'Bitiş, başlangıçtan sonra olmalı.' });
    const c = store.put('contests', { id: nanoid(10), ...d, status: 'active', createdAt: now(), createdBy: req.admin.username });
    A.audit(req.admin, 'yarışma oluşturdu', null, `${c.title} · ${METRICS[c.metric].label}`);
    res.json(adminOut(c));
  });
  app.put('/api/admin/contests/:id', A.adminAuth, A.owner, (req, res) => {
    const c = store.get('contests', req.params.id); if (!c) return res.status(404).json({ error: 'Yarışma bulunamadı.' });
    const d = clean(req.body || {}, c);
    if (d.end <= d.start) return res.status(400).json({ error: 'Bitiş, başlangıçtan sonra olmalı.' });
    if (c.awardedAt && (d.metric !== c.metric)) return res.status(400).json({ error: 'Ödülleri verilmiş yarışmanın ölçütü değiştirilemez.' });
    const status = ['active', 'cancelled'].includes(req.body?.status) ? req.body.status : c.status;
    store.update('contests', c.id, { ...d, status, final: c.awardedAt ? c.final : null });
    cache.clear();
    A.audit(req.admin, 'yarışmayı güncelledi', null, d.title);
    res.json(adminOut(store.get('contests', c.id)));
  });
  app.post('/api/admin/contests/:id/award', A.adminAuth, A.owner, (req, res) => {
    const c = store.get('contests', req.params.id); if (!c) return res.status(404).json({ error: 'Yarışma bulunamadı.' });
    if (c.awardedAt) return res.status(409).json({ error: 'Ödüller zaten verildi.' });
    if (phase(c) !== 'ended' && !req.body?.now) return res.status(400).json({ error: 'Yarışma henüz bitmedi.' });
    if (phase(c) !== 'ended') store.update('contests', c.id, { end: now() });
    const r = award(store.get('contests', c.id), { by: req.admin.username });
    A.audit(req.admin, 'yarışma ödüllerini verdi', null, `${c.title} · ${(r.given || []).length} kazanan`);
    res.json(adminOut(r));
  });
  app.delete('/api/admin/contests/:id', A.adminAuth, A.owner, (req, res) => {
    const c = store.get('contests', req.params.id); if (!c) return res.status(404).json({ error: 'Yarışma bulunamadı.' });
    if (c.awardedAt) return res.status(400).json({ error: 'Ödülleri verilmiş yarışma silinemez; iptal edebilirsin.' });
    store.del('contests', c.id);
    A.audit(req.admin, 'yarışmayı sildi', null, c.title);
    res.json({ ok: true });
  });
};
module.exports.METRICS = METRICS;

// Instagram tarzı özellikler: öne çıkan hikayeler, hikaye arşivi, yakın arkadaşlar, notlar,
// gönderi anketi, planlı gönderi ve gönderi istatistikleri
const { nanoid } = require('nanoid');

const DAY = 86400000;
const now = () => Date.now();
const trDay = (t = now()) => new Date(t + 3 * 3600000).toISOString().slice(0, 10);

module.exports = function insta(app, ctx) {
  const { store, auth, brief, isBlocked, canSee, notify, limited, moderation, sendMessage, chatBetween, io } = ctx;
  const followOk = (a, b) => { const f = store.get('follows', `${a}_${b}`); return !!f && f.status !== 'pending'; };
  const SPECIAL = new Set(['falci', 'official']);

  // ================= Öne çıkan hikayeler =================
  // Öne çıkana eklenen hikaye kopyalanır; hikaye 30 gün sonra arşivden silinse de öne çıkanda kalır
  const snap = (s) => {
    const it = ctx.storyItem(s, s.userId);
    return { ...it, seen: true, myReaction: null, viewerCount: undefined, reshareOf: it.reshareOf ? { id: it.reshareOf.id, username: it.reshareOf.username } : null, src: s.id };
  };
  // Kapak: kendi yüklediği fotoğraf ya da öne çıkandaki bir hikaye (fotoğraf, video, yazı, fal kartı)
  const coverItem = (h) => h.items.find((i) => i.id === h.coverId) || h.items.find((i) => i.mediaType === 'image' && i.media && i.media === h.cover) || h.items.find((i) => i.mediaType === 'image' && i.media) || h.items[0];
  const coverOut = (h) => {
    const pos = Number.isFinite(h.coverPos) ? h.coverPos : 50;
    if (h.coverMedia) return { t: 'image', media: h.coverMedia, pos };
    const it = coverItem(h); if (!it) return { t: 'text', bg: 'g2', text: '' };
    if (it.mediaType === 'card' && it.card) return { t: 'card', fal: it.card.type || 'kahve', id: it.id };
    if ((it.mediaType === 'image' || it.mediaType === 'video') && it.media) return { t: it.mediaType, media: it.media, filter: it.filter || null, pos, id: it.id };
    const txt = (it.stickers || []).find((x) => x.type === 'text')?.text || (it.stickers || []).find((x) => x.type === 'emoji')?.emoji || '';
    return { t: 'text', bg: it.bg || 'g2', text: String(txt).slice(0, 60), id: it.id };
  };
  const hlOut = (h) => ({ id: h.id, title: h.title, cover: coverOut(h), count: h.items.length, at: h.at, custom: !!h.coverMedia });
  ctx.highlightsOf = (uid) => store.filter('highlights', (h) => h.userId === uid && h.items.length).sort((a, b) => (a.order ?? a.at) - (b.order ?? b.at)).map(hlOut);
  const cleanTitle = (t) => moderation.mask(String(t || '').trim().slice(0, 24)) || 'Öne çıkan';

  // Kendi hikaye arşivin (son 30 gün)
  app.get('/api/me/archive', auth, (req, res) => {
    const me = req.user.id;
    const inHl = new Map();
    store.filter('highlights', (h) => h.userId === me).forEach((h) => h.items.forEach((i) => { if (!inHl.has(i.src)) inHl.set(i.src, []); inHl.get(i.src).push(h.id); }));
    res.json(store.filter('stories', (s) => s.userId === me).sort((a, b) => b.at - a.at).slice(0, 200).map((s) => ({ ...ctx.storyItem(s, me), highlights: inHl.get(s.id) || [] })));
  });

  app.get('/api/users/:id/highlights', auth, (req, res) => {
    const u = store.get('users', req.params.id);
    if (!u || isBlocked(req.user.id, u.id) || !canSee(req.user.id, u)) return res.json([]);
    res.json(ctx.highlightsOf(u.id));
  });

  app.get('/api/highlights/:id', auth, (req, res) => {
    const h = store.get('highlights', req.params.id);
    const u = h && store.get('users', h.userId);
    if (!h || !u || isBlocked(req.user.id, u.id) || !canSee(req.user.id, u)) return res.status(404).json({ error: 'Öne çıkan bulunamadı.' });
    res.json({ ...hlOut(h), user: brief(u), items: h.items });
  });

  // Yeni öne çıkan ya da var olana hikaye ekle
  app.post('/api/highlights', auth, (req, res) => {
    const me = req.user.id;
    const ids = (Array.isArray(req.body?.storyIds) ? req.body.storyIds : []).map(String).slice(0, 100);
    const stories = ids.map((id) => store.get('stories', id)).filter((s) => s && s.userId === me);
    if (!stories.length) return res.status(400).json({ error: 'En az bir hikaye seç.' });
    let h = req.body?.id ? store.get('highlights', String(req.body.id)) : null;
    if (h && h.userId !== me) return res.status(404).json({ error: 'Öne çıkan bulunamadı.' });
    if (!h) {
      if (store.filter('highlights', (x) => x.userId === me).length >= 40) return res.status(400).json({ error: 'En fazla 40 öne çıkanın olabilir.' });
      h = { id: nanoid(10), userId: me, title: cleanTitle(req.body?.title), items: [], at: now() };
    }
    const have = new Set(h.items.map((i) => i.src));
    stories.sort((a, b) => a.at - b.at).forEach((s) => { if (!have.has(s.id)) h.items.push(snap(s)); });
    h.items = h.items.slice(-100);
    store.put('highlights', h);
    res.json(hlOut(h));
  });

  app.patch('/api/highlights/:id', auth, (req, res) => {
    const h = store.get('highlights', req.params.id);
    if (!h || h.userId !== req.user.id) return res.status(404).json({ error: 'Öne çıkan bulunamadı.' });
    const b = req.body || {};
    if (b.title != null) h.title = cleanTitle(b.title);
    if (Array.isArray(b.remove)) { const rm = new Set(b.remove.map(String)); h.items = h.items.filter((i) => !rm.has(i.id)); }
    if (b.cover != null) { const it = h.items.find((i) => i.id === String(b.cover)); if (it) { h.coverId = it.id; h.coverMedia = null; } }
    if (b.coverMedia === null) h.coverMedia = null; else if (b.coverMedia && ctx.isMedia(b.coverMedia)) h.coverMedia = String(b.coverMedia);
    if (b.coverPos != null) h.coverPos = Math.max(0, Math.min(100, Math.round(+b.coverPos || 0)));
    if (h.coverId && !h.items.some((i) => i.id === h.coverId)) h.coverId = null;
    if (!h.items.length) { store.del('highlights', h.id); return res.json({ deleted: true }); }
    store.put('highlights', h);
    res.json(hlOut(h));
  });

  app.delete('/api/highlights/:id', auth, (req, res) => {
    const h = store.get('highlights', req.params.id);
    if (!h || h.userId !== req.user.id) return res.status(404).json({ error: 'Öne çıkan bulunamadı.' });
    store.del('highlights', h.id);
    res.json({ ok: true });
  });

  // ================= Yakın arkadaşlar =================
  app.get('/api/close-friends', auth, (req, res) => {
    const me = req.user;
    const list = (me.closeFriends || []).map((id) => store.get('users', id)).filter((u) => u && !isBlocked(me.id, u.id)).map(brief);
    // Öneriler: takip ettiklerin ve seni takip edenler
    const ids = new Set(list.map((u) => u.id));
    const sug = [];
    store.filter('follows', (f) => (f.from === me.id || f.to === me.id) && f.status !== 'pending').forEach((f) => {
      const id = f.from === me.id ? f.to : f.from;
      if (ids.has(id) || id === me.id) return; ids.add(id);
      const u = store.get('users', id); if (u && !SPECIAL.has(u.role) && !isBlocked(me.id, id)) sug.push(brief(u));
    });
    res.json({ list, suggestions: sug.slice(0, 120) });
  });

  app.post('/api/close-friends/:id', auth, (req, res) => {
    const me = req.user;
    const u = store.get('users', req.params.id);
    if (!u || u.id === me.id || SPECIAL.has(u.role) || isBlocked(me.id, u.id)) return res.status(400).json({ error: 'Bu kişi eklenemez.' });
    const set = new Set(me.closeFriends || []);
    const on = req.body?.on ?? !set.has(u.id);
    if (on) { if (set.size >= 500) return res.status(400).json({ error: 'Yakın arkadaş listen dolu.' }); set.add(u.id); } else set.delete(u.id);
    store.update('users', me.id, { closeFriends: [...set] });
    io.emit('stories:update', { userId: me.id });
    res.json({ on: set.has(u.id), count: set.size });
  });

  // ================= Notlar (mesajlar ekranında 24 saatlik kısa not) =================
  const noteAlive = (n) => n && now() - n.at < DAY;
  const noteOut = (n, me) => ({ userId: n.userId, text: n.text, at: n.at, user: brief(store.get('users', n.userId)), liked: (n.likes || []).includes(me), likeCount: n.userId === me ? (n.likes || []).length : undefined, audience: n.audience || 'all' });
  const noteVisible = (n, me) => {
    if (n.userId === me) return true;
    const o = store.get('users', n.userId);
    if (!o || isBlocked(me, o.id)) return false;
    if (n.audience === 'close') return (o.closeFriends || []).includes(me);
    // Takip ettiğin ve seni takip eden kişilerin notları görünür
    return followOk(me, o.id) && followOk(o.id, me);
  };
  app.get('/api/notes', auth, (req, res) => {
    const me = req.user.id;
    const list = store.filter('notes', (n) => noteAlive(n) && noteVisible(n, me)).sort((a, b) => (b.userId === me) - (a.userId === me) || b.at - a.at).slice(0, 60);
    res.json(list.map((n) => noteOut(n, me)));
  });
  app.post('/api/notes', auth, (req, res) => {
    const text = moderation.mask(String(req.body?.text || '').replace(/\s+/g, ' ').trim().slice(0, 60));
    if (!text) return res.status(400).json({ error: 'Notuna bir şey yaz.' });
    if (limited('note:' + req.user.id, 20, 3600000)) return res.status(429).json({ error: 'Biraz yavaş 🙂' });
    const n = store.put('notes', { id: req.user.id, userId: req.user.id, text, at: now(), likes: [], audience: req.body?.audience === 'close' ? 'close' : 'all' });
    io.emit('notes:update', { userId: req.user.id });
    res.json(noteOut(n, req.user.id));
  });
  app.delete('/api/notes', auth, (req, res) => {
    store.del('notes', req.user.id);
    io.emit('notes:update', { userId: req.user.id });
    res.json({ ok: true });
  });
  app.post('/api/notes/:userId/like', auth, (req, res) => {
    const n = store.get('notes', req.params.userId);
    if (!noteAlive(n) || !noteVisible(n, req.user.id) || n.userId === req.user.id) return res.status(404).json({ error: 'Not bulunamadı.' });
    const set = new Set(n.likes || []);
    const on = !set.has(req.user.id);
    if (on) set.add(req.user.id); else set.delete(req.user.id);
    store.update('notes', n.id, { likes: [...set] });
    if (on) notify(n.userId, { type: 'like', fromId: req.user.id, text: `${req.user.username} notunu beğendi.`, url: '/#/chats', tag: 'nl-' + n.userId });
    res.json({ liked: on });
  });
  app.post('/api/notes/:userId/reply', auth, (req, res) => {
    const n = store.get('notes', req.params.userId);
    const text = String(req.body?.text || '').trim().slice(0, 1000);
    if (!noteAlive(n) || !noteVisible(n, req.user.id) || n.userId === req.user.id || !text) return res.status(400).json({ error: 'Yanıt gönderilemedi.' });
    const owner = store.get('users', n.userId);
    if (!owner || SPECIAL.has(owner.role)) return res.status(403).json({ error: 'Bu nota yanıt verilemez.' });
    const chat = chatBetween(req.user.id, owner.id);
    const msg = sendMessage(chat, req.user.id, { text, quote: { kind: 'note', q: '📝 Nota yanıt', a: n.text } });
    if (!msg) return res.status(403).json({ error: 'Bu kişiye mesaj gönderemezsin.' });
    res.json({ ok: true, chatId: chat.id });
  });

  // ================= Gönderi anketi =================
  app.post('/api/posts/:id/vote', auth, (req, res) => {
    const p = store.get('posts', req.params.id);
    if (!p?.poll || isBlocked(req.user.id, p.userId) || !canSee(req.user.id, store.get('users', p.userId))) return res.status(404).json({ error: 'Anket bulunamadı.' });
    const i = Number(req.body?.option);
    if (!Number.isInteger(i) || i < 0 || i >= p.poll.options.length) return res.status(400).json({ error: 'Geçersiz seçenek.' });
    const votes = { ...(p.poll.votes || {}) };
    const first = votes[req.user.id] == null;
    votes[req.user.id] = i;
    store.update('posts', p.id, { poll: { ...p.poll, votes } });
    const v = Object.values(votes);
    const out = { q: p.poll.q, options: p.poll.options, counts: p.poll.options.map((_, k) => v.filter((x) => x === k).length), total: v.length, mine: i };
    io.emit('post:poll', { id: p.id, counts: out.counts, total: out.total });
    if (first && p.userId !== req.user.id && [1, 10, 50, 100, 500].includes(v.length)) notify(p.userId, { type: 'like', fromId: req.user.id, ref: p.id, text: `Anketine ${v.length} kişi oy verdi.`, url: `/#/p/${p.id}`, tag: 'pv-' + p.id });
    res.json(out);
  });

  // ================= Planlı gönderiler =================
  app.get('/api/me/scheduled', auth, (req, res) => {
    res.json(store.filter('post_queue', (q) => q.userId === req.user.id).sort((a, b) => a.publishAt - b.publishAt).map((q) => ({
      id: q.id, publishAt: q.publishAt, type: q.body.type, caption: String(q.body.caption || '').slice(0, 300), bg: q.body.bg || 'g1',
      media: q.body.type === 'text' ? null : ((f) => (f?.type === 'video' ? f.poster || null : f?.media || null))((q.body.items || [])[0]), video: (q.body.items || [])[0]?.type === 'video', count: (q.body.items || []).length, poll: q.body.poll?.options?.length ? { q: q.body.poll.q } : null,
    })));
  });
  const publishQueued = (q) => {
    store.del('post_queue', q.id);
    const u = store.get('users', q.userId);
    if (!u || u.status === 'banned') return null;
    const p = ctx.createPost(u, q.body);
    if (p?.error) { notify(u.id, { type: 'system', text: `Planlı gönderin paylaşılamadı: ${p.error}`, url: '/#/planli' }); return null; }
    notify(u.id, { type: 'post', fromId: u.id, ref: p.id, text: 'Planladığın gönderi şimdi paylaşıldı ✨', url: `/#/p/${p.id}` });
    return p;
  };
  app.post('/api/me/scheduled/:id/now', auth, (req, res) => {
    const q = store.get('post_queue', req.params.id);
    if (!q || q.userId !== req.user.id) return res.status(404).json({ error: 'Planlı gönderi bulunamadı.' });
    const p = publishQueued(q);
    if (!p) return res.status(400).json({ error: 'Gönderi paylaşılamadı.' });
    res.json({ id: p.id });
  });
  app.patch('/api/me/scheduled/:id', auth, (req, res) => {
    const q = store.get('post_queue', req.params.id);
    if (!q || q.userId !== req.user.id) return res.status(404).json({ error: 'Planlı gönderi bulunamadı.' });
    const at = +new Date(req.body?.publishAt);
    if (!Number.isFinite(at) || at < now() + 4 * 60000 || at > now() + 60 * DAY) return res.status(400).json({ error: 'Saat en az 5 dakika sonrası, en fazla 60 gün sonrası olmalı.' });
    store.update('post_queue', q.id, { publishAt: at });
    res.json({ ok: true, publishAt: at });
  });
  app.delete('/api/me/scheduled/:id', auth, (req, res) => {
    const q = store.get('post_queue', req.params.id);
    if (!q || q.userId !== req.user.id) return res.status(404).json({ error: 'Planlı gönderi bulunamadı.' });
    store.del('post_queue', q.id);
    res.json({ ok: true });
  });
  setInterval(() => {
    store.filter('post_queue', (q) => q.publishAt <= now()).slice(0, 20).forEach((q) => { try { publishQueued(q); } catch (e) { console.error('[planlı]', e.message); } });
  }, 30000).unref?.();

  // ================= Gönderi istatistikleri =================
  const statsOf = (p) => store.get('post_stats', p.id) || { id: p.id, userId: p.userId, imp: 0, reach: [], nonf: 0, src: {}, days: {}, saves: [], visits: 0 };
  const SRC = new Set(['feed', 'profile', 'explore', 'tag', 'post', 'reels', 'other']);
  // Görülen gönderiler (akış / profil / keşfet): gösterim ve erişim sayılır
  app.post('/api/insights/seen', auth, (req, res) => {
    const me = req.user.id;
    if (limited('seen:' + me, 120, 600000)) return res.json({ ok: false });
    const src = SRC.has(req.body?.src) ? req.body.src : 'other';
    const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(String))].slice(0, 40);
    const day = trDay();
    ids.forEach((id) => {
      const p = store.get('posts', id);
      if (!p || p.userId === me) return;
      const st = statsOf(p);
      st.imp++; st.src[src] = (st.src[src] || 0) + 1; st.days[day] = (st.days[day] || 0) + 1;
      if (!st.reach.includes(me) && st.reach.length < 20000) { st.reach.push(me); if (!followOk(me, p.userId)) st.nonf++; }
      const keys = Object.keys(st.days).sort(); if (keys.length > 30) keys.slice(0, keys.length - 30).forEach((k) => delete st.days[k]);
      store.put('post_stats', st);
    });
    res.json({ ok: true });
  });
  app.post('/api/posts/:id/save', auth, (req, res) => {
    const p = store.get('posts', req.params.id);
    if (!p) return res.status(404).json({ error: 'Gönderi bulunamadı.' });
    const st = statsOf(p); const set = new Set(st.saves);
    if (req.body?.on === false) set.delete(req.user.id); else if (p.userId !== req.user.id) set.add(req.user.id);
    st.saves = [...set].slice(0, 20000); store.put('post_stats', st);
    res.json({ ok: true });
  });
  app.post('/api/insights/visit', auth, (req, res) => {
    const p = store.get('posts', String(req.body?.id || ''));
    if (p && p.userId !== req.user.id && !limited(`pv:${req.user.id}:${p.id}`, 3, 3600000)) { const st = statsOf(p); st.visits++; store.put('post_stats', st); }
    res.json({ ok: true });
  });
  app.get('/api/insights/post/:id', auth, (req, res) => {
    const p = store.get('posts', req.params.id);
    if (!p || p.userId !== req.user.id) return res.status(404).json({ error: 'Gönderi bulunamadı.' });
    const st = statsOf(p);
    const reach = st.reach.length;
    const likes = p.likes.length; const comments = p.comments.length; const reposts = (p.reposts || []).length; const saves = st.saves.length;
    const inter = likes + comments + reposts + saves;
    const days = [];
    for (let i = 6; i >= 0; i--) { const d = trDay(now() - i * DAY); days.push({ day: d, n: st.days[d] || 0 }); }
    const followerLikes = p.likes.filter((u) => followOk(u, p.userId)).length;
    res.json({
      id: p.id, createdAt: p.createdAt, imp: st.imp, reach, nonFollowerPct: reach ? Math.round((st.nonf / reach) * 100) : 0,
      likes, comments, reposts, saves, visits: st.visits, interactions: inter, rate: reach ? Math.round((inter / reach) * 1000) / 10 : 0,
      src: st.src, days, followerLikes, poll: p.poll ? { total: Object.keys(p.poll.votes || {}).length } : null,
    });
  });
  ctx.postStatsDrop = (id) => store.del('post_stats', id);
};

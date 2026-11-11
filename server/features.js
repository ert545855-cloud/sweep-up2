// SwipeUp ek özellikleri: mağaza ve siparişler, boost/geri al, doğrulama, takip istekleri,
// hikaye çıkartmaları, etiketler, kaybolan mesajlar, hesap silme ve veri indirme.
const bcrypt = require('bcryptjs');
const { nanoid, customAlphabet } = require('nanoid');

const DAY = 86400000;
const orderCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);
const POSES = [
  { id: 'zafer', em: '✌️', text: 'İki parmağınla zafer işareti yap' },
  { id: 'basparmak', em: '👍', text: 'Başparmağını yukarı kaldır' },
  { id: 'avuc', em: '🖐️', text: 'Avucunu kameraya göster' },
  { id: 'cene', em: '🤔', text: 'İşaret parmağını çenene koy' },
  { id: 'kulak', em: '👂', text: 'Bir elinle kulağını tut' },
];
const TTLS = [0, 3600000, DAY, 7 * DAY];

module.exports = function features(app, ctx) {
  const {
    store, io, auth, wrap, eco, notify, emitTo, brief, pub, postOut, chatOut, sendMessage, canSee, priv,
    isBlocked, limited, isMedia, cardOut, purgeUser, moderation,
  } = ctx;
  const now = () => Date.now();

  // ---------- Mağaza ----------
  const orderOut = (o) => ({ ...o, product: eco.product(o.productId) || { title: o.title } });
  app.get('/api/store', auth, (req, res) => {
    const s = eco.get();
    const u = req.user;
    const q = eco.quota(u);
    res.json({
      coins: u.coins || 0, earnings: u.earnings || 0, plus: eco.isPlus(u), plusUntil: u.plusUntil || null,
      boostUntil: (u.boostUntil || 0) > now() ? u.boostUntil : null,
      freeBoost: eco.isPlus(u) && (!u.lastFreeBoost || now() - u.lastFreeBoost > 7 * DAY),
      quota: { likesLeft: q.likesLeft, supersLeft: q.supersLeft },
      coinPacks: s.coinPacks, plusPlans: s.plusPlans, gifts: s.gifts, falPrices: s.falPrices,
      boostCoins: s.boostCoins, boostMinutes: s.boostMinutes, freeLikes: s.freeLikes, freeSupers: s.freeSupers, plusSupers: s.plusSupers,
      coinTL: s.coinTL, payEnabled: !!s.bank.iban,
      orders: store.filter('orders', (o) => o.userId === u.id).sort((a, b) => b.at - a.at).slice(0, 10).map(orderOut),
    });
  });
  app.get('/api/gifts', auth, (req, res) => res.json({ gifts: eco.get().gifts, coins: req.user.coins || 0 }));

  app.post('/api/orders', auth, (req, res) => {
    const p = eco.product(String(req.body?.productId || ''));
    if (!p) return res.status(400).json({ error: 'Ürün bulunamadı.' });
    const s = eco.get();
    if (!s.bank.iban) return res.status(503).json({ error: 'Ödeme şu an kapalı. Lütfen daha sonra tekrar dene.' });
    if (store.filter('orders', (o) => o.userId === req.user.id && ['pending', 'paid'].includes(o.status)).length >= 3) {
      return res.status(429).json({ error: 'Onay bekleyen siparişlerin var. Önce onlar sonuçlansın.' });
    }
    let code; do { code = 'SU-' + orderCode(); } while (store.find('orders', (o) => o.code === code));
    const o = store.put('orders', {
      id: nanoid(10), code, userId: req.user.id, productId: p.id, kind: p.kind, title: p.title, amount: p.price, ...(p.kind === 'coins' ? { coins: p.coins } : {}),
      status: 'pending', at: now(),
    });
    res.json({ ...orderOut(o), bank: s.bank });
  });
  app.get('/api/orders/:id', auth, (req, res) => {
    const o = store.get('orders', req.params.id);
    if (!o || o.userId !== req.user.id) return res.status(404).json({ error: 'Sipariş bulunamadı.' });
    res.json({ ...orderOut(o), bank: eco.get().bank });
  });
  app.post('/api/orders/:id/paid', auth, (req, res) => {
    const o = store.get('orders', req.params.id);
    if (!o || o.userId !== req.user.id || o.status !== 'pending') return res.status(404).json({ error: 'Sipariş bulunamadı.' });
    const sender = String(req.body?.sender || '').trim().slice(0, 60);
    if (sender.length < 3) return res.status(400).json({ error: 'Gönderen ad soyadını yaz.' });
    res.json(orderOut(store.update('orders', o.id, { status: 'paid', sender, paidAt: now() })));
  });
  app.delete('/api/orders/:id', auth, (req, res) => {
    const o = store.get('orders', req.params.id);
    if (!o || o.userId !== req.user.id || o.status !== 'pending') return res.status(400).json({ error: 'Bu sipariş iptal edilemez.' });
    res.json(orderOut(store.update('orders', o.id, { status: 'cancelled', closedAt: now() })));
  });

  // Kazanç (yayın hediyeleri, fal) ödeme talebi
  app.get('/api/wallet', auth, (req, res) => {
    const s = eco.get();
    res.json({
      coins: req.user.coins || 0, earnings: req.user.earnings || 0, earningsTL: +((req.user.earnings || 0) * s.coinTL).toFixed(2), coinTL: s.coinTL, perCoinTL: +(s.creatorShare * s.coinTL).toFixed(2), paidCoins: Math.min(req.user.paid || 0, req.user.coins || 0),
      tx: store.filter('coin_tx', (t) => t.userId === req.user.id).sort((a, b) => b.at - a.at).slice(0, 50),
      earned: store.filter('earn_tx', (t) => t.userId === req.user.id).sort((a, b) => b.at - a.at).slice(0, 50)
        .map((t) => ({ ...t, from: t.fromId ? brief(store.get('users', t.fromId)) : null })),
      payouts: store.filter('payouts', (p) => p.userId === req.user.id).sort((a, b) => b.at - a.at).slice(0, 10),
    });
  });
  app.post('/api/payouts', auth, (req, res) => {
    const s = eco.get();
    const coins = req.user.earnings || 0;
    const iban = String(req.body?.iban || '').replace(/\s+/g, '').toUpperCase();
    const name = String(req.body?.name || '').trim().slice(0, 60);
    if (coins * s.coinTL < 100) return res.status(400).json({ error: 'Ödeme talebi için en az 100 ₺ kazancın olmalı.' });
    if (!/^TR\d{24}$/.test(iban)) return res.status(400).json({ error: 'IBAN geçersiz (TR ile başlayan 26 karakter).' });
    if (name.length < 3) return res.status(400).json({ error: 'Hesap sahibinin adını yaz.' });
    if (store.find('payouts', (p) => p.userId === req.user.id && p.status === 'pending')) return res.status(409).json({ error: 'Bekleyen bir ödeme talebin var.' });
    store.update('users', req.user.id, { earnings: 0 });
    const p = store.put('payouts', { id: nanoid(10), userId: req.user.id, coins, amount: +(coins * s.coinTL).toFixed(2), iban, name, status: 'pending', at: now() });
    res.json(p);
  });

  // ---------- Boost ve geri al ----------
  app.post('/api/boost', auth, (req, res) => {
    const s = eco.get();
    const u = req.user;
    if ((u.boostUntil || 0) > now()) return res.status(400).json({ error: 'Boost zaten açık.' });
    const free = eco.isPlus(u) && (!u.lastFreeBoost || now() - u.lastFreeBoost > 7 * DAY);
    if (!free && !eco.spend(u.id, s.boostCoins, 'boost')) return res.status(402).json({ error: `Boost ${s.boostCoins} jeton. Jetonun yetmiyor.`, needCoins: true });
    const until = now() + s.boostMinutes * 60000;
    store.update('users', u.id, { boostUntil: until, ...(free ? { lastFreeBoost: now() } : {}) });
    res.json({ boostUntil: until, coins: store.get('users', u.id).coins || 0, free });
  });
  app.post('/api/swipe/undo', auth, (req, res) => {
    const me = req.user;
    if (!eco.isPlus(me)) return res.status(402).json({ error: 'Geri alma SwipeUp+ üyelerine özel.', plus: true });
    const t = me.lastSwipe && store.get('users', me.lastSwipe);
    const sw = t && store.get('swipes', `${me.id}_${t.id}`);
    if (!sw) return res.status(400).json({ error: 'Geri alınacak kaydırma yok.' });
    if (store.get('matches', [me.id, t.id].sort().join('_'))) return res.status(400).json({ error: 'Eşleştiğin biri geri alınamaz.' });
    store.del('swipes', sw.id);
    const q = eco.quota(me);
    const d = { ...q.d, likes: Math.max(0, q.d.likes - (sw.dir === 'right' ? 1 : 0)), supers: Math.max(0, q.d.supers - (sw.dir === 'super' ? 1 : 0)) };
    store.update('users', me.id, { lastSwipe: null, daily: d });
    const likedMe = store.get('swipes', `${t.id}_${me.id}`);
    res.json({ card: cardOut(me, t, !!likedMe && likedMe.dir !== 'left') });
  });

  // ---------- Profil doğrulama (mavi tik) ----------
  app.get('/api/verify', auth, (req, res) => {
    const v = store.filter('verifications', (x) => x.userId === req.user.id).sort((a, b) => b.at - a.at)[0];
    let pose = req.user.verifyPose && POSES.find((p) => p.id === req.user.verifyPose);
    if (!pose) {
      pose = POSES[Math.floor(Math.random() * POSES.length)];
      store.update('users', req.user.id, { verifyPose: pose.id });
    }
    res.json({ verified: !!req.user.verified, pose, last: v ? { status: v.status, at: v.at, note: v.note || '' } : null });
  });
  app.post('/api/verify', auth, (req, res) => {
    if (req.user.verified) return res.status(400).json({ error: 'Profilin zaten doğrulanmış.' });
    if (!isMedia(req.body?.selfie)) return res.status(400).json({ error: 'Önce selfie çek.' });
    if (store.find('verifications', (x) => x.userId === req.user.id && x.status === 'pending')) return res.status(409).json({ error: 'Doğrulaman zaten inceleniyor.' });
    if (limited('verify:' + req.user.id, 4, DAY)) return res.status(429).json({ error: 'Bugün çok fazla deneme yaptın.' });
    const v = store.put('verifications', { id: nanoid(10), userId: req.user.id, selfie: req.body.selfie, pose: req.user.verifyPose || 'zafer', status: 'pending', at: now() });
    ctx.markPrivate?.(v.selfie, req.user.id); // selfie yalnız yönetimde, imzalı bağlantıyla görünür
    Promise.resolve(ctx.onVerify?.(v)).catch(() => {}); // yapay zeka ön kontrolü (engage.js)
    res.json({ ok: true, status: v.status });
  });

  // ---------- Takip istekleri (gizli hesap) ----------
  app.get('/api/follow-requests', auth, (req, res) => {
    res.json(store.filter('follows', (f) => f.to === req.user.id && f.status === 'pending').sort((a, b) => b.at - a.at)
      .map((f) => ({ at: f.at, user: brief(store.get('users', f.from)) })).filter((x) => x.user));
  });
  app.post('/api/follow-requests/:uid', auth, (req, res) => {
    const f = store.get('follows', `${req.params.uid}_${req.user.id}`);
    if (!f || f.status !== 'pending') return res.status(404).json({ error: 'İstek bulunamadı.' });
    if (req.body?.accept) {
      store.update('follows', f.id, { status: null, at: now() });
      notify(f.from, { type: 'follow_ok', fromId: req.user.id, text: `${req.user.username} takip isteğini kabul etti.`, url: `/#/u/${req.user.username}` });
    } else store.del('follows', f.id);
    res.json({ ok: true });
  });

  // ---------- Hikaye çıkartmaları ----------
  const storyFor = (req, res) => {
    const s = store.get('stories', req.params.id);
    const owner = s && store.get('users', s.userId);
    if (!s || !owner || isBlocked(req.user.id, owner.id) || !canSee(req.user.id, owner)) { res.status(404).json({ error: 'Hikaye bulunamadı.' }); return null; }
    return s;
  };
  app.post('/api/stories/:id/vote', auth, (req, res) => {
    const s = storyFor(req, res); if (!s) return;
    const st = (s.stickers || []).find((x) => x.id === req.body?.sticker && x.type === 'poll');
    const option = parseInt(req.body?.option, 10);
    if (!st || !(option >= 0 && option < st.options.length)) return res.status(400).json({ error: 'Geçersiz oy.' });
    if (s.userId === req.user.id) return res.status(400).json({ error: 'Kendi anketine oy veremezsin.' });
    s.votes = s.votes || {};
    if (!s.votes[req.user.id]) s.votes[req.user.id] = { sticker: st.id, option, at: now() };
    store.update('stories', s.id, {});
    const votes = Object.values(s.votes).filter((v) => v.sticker === st.id);
    res.json({ counts: st.options.map((_, i) => votes.filter((v) => v.option === i).length), total: votes.length, mine: s.votes[req.user.id].option });
  });
  app.post('/api/stories/:id/answer', auth, (req, res) => {
    const s = storyFor(req, res); if (!s) return;
    const st = (s.stickers || []).find((x) => x.id === req.body?.sticker && x.type === 'question');
    const text = moderation.mask(String(req.body?.text || '').trim().slice(0, 300));
    if (!st || !text) return res.status(400).json({ error: 'Cevap boş olamaz.' });
    if (limited('sq:' + req.user.id, 20, 3600000)) return res.status(429).json({ error: 'Biraz yavaş 🙂' });
    s.answers = [...(s.answers || []), { id: nanoid(8), sticker: st.id, userId: req.user.id, text, at: now() }].slice(-300);
    store.update('stories', s.id, {});
    notify(s.userId, { type: 'story_answer', fromId: req.user.id, text: `${req.user.username} sorunu yanıtladı: ${text.slice(0, 80)}`, url: '/#/stories/me' });
    res.json({ ok: true });
  });

  // ---------- Etiketler ----------
  app.get('/api/tags', auth, (req, res) => {
    const q = String(req.query.q || '').replace(/^#/, '').toLocaleLowerCase('tr-TR').trim();
    const counts = new Map();
    store.all('posts').forEach((p) => (p.tags || []).forEach((t) => { if (!q || t.startsWith(q)) counts.set(t, (counts.get(t) || 0) + 1); }));
    res.json([...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([tag, count]) => ({ tag, count })));
  });
  app.get('/api/tags/:tag', auth, (req, res) => {
    const tag = String(req.params.tag || '').toLocaleLowerCase('tr-TR');
    const posts = store.filter('posts', (p) => (p.tags || []).includes(tag) && !isBlocked(req.user.id, p.userId) && canSee(req.user.id, store.get('users', p.userId)))
      .sort((a, b) => b.createdAt - a.createdAt);
    res.json({ tag, count: posts.length, posts: posts.slice(0, 90).map((p) => postOut(p, req.user.id)) });
  });

  // ---------- Kaybolan mesajlar ----------
  app.patch('/api/chats/:id/ttl', auth, (req, res) => {
    const c = store.get('chats', req.params.id);
    if (!c || !c.members.includes(req.user.id)) return res.status(404).json({ error: 'Sohbet bulunamadı.' });
    const ttl = parseInt(req.body?.ttl, 10) || 0;
    if (!TTLS.includes(ttl)) return res.status(400).json({ error: 'Geçersiz süre.' });
    if (c.isGroup && !(c.admins || []).includes(req.user.id)) return res.status(403).json({ error: 'Bunu sadece grup yöneticileri değiştirebilir.' });
    store.update('chats', c.id, { ttl });
    const label = { 0: 'kapattı', 3600000: '1 saat olarak ayarladı', [DAY]: '24 saat olarak ayarladı', [7 * DAY]: '7 gün olarak ayarladı' }[ttl];
    sendMessage(c, req.user.id, { text: `⏱️ ${req.user.name} kaybolan mesajları ${label}`, system: true });
    c.members.forEach((m) => emitTo(m, 'chat:update', { chatId: c.id }));
    res.json(chatOut(c, req.user.id));
  });
  setInterval(() => {
    const t = now();
    store.filter('messages', (m) => m.expiresAt && m.expiresAt < t).forEach((m) => {
      store.del('messages', m.id);
      store.get('chats', m.chatId)?.members.forEach((x) => emitTo(x, 'message:hidden', { id: m.id, chatId: m.chatId }));
    });
  }, 60000).unref();

  // ---------- Hesap silme ve veri indirme ----------
  app.delete('/api/me', auth, wrap(async (req, res) => {
    if (['falci', 'official'].includes(req.user.role)) return res.status(400).json({ error: 'Bu hesap silinemez.' });
    // Google / Apple ile açılmış şifresiz hesapta kullanıcı adını yazarak onaylanır
    if (req.user.noPass ? String(req.body?.confirm || '').trim().toLowerCase().replace(/^@/, '') !== req.user.username : !(await bcrypt.compare(String(req.body?.password || ''), req.user.passHash))) return res.status(400).json({ error: req.user.noPass ? 'Onay için kullanıcı adını doğru yaz.' : 'Şifre hatalı.' });
    store.put('deleted_accounts', { id: req.user.id, username: req.user.username, reason: String(req.body?.reason || '').slice(0, 300), at: now() });
    purgeUser(req.user.id);
    res.json({ ok: true });
  }));
  app.get('/api/me/export', auth, (req, res) => {
    if (limited('export:' + req.user.id, 5, DAY)) return res.status(429).json({ error: 'Bugün çok fazla indirme yaptın.' });
    const id = req.user.id;
    const name = (uid) => store.get('users', uid)?.username || '(silinmiş)';
    const myChats = new Set(store.filter('chats', (c) => c.members.includes(id)).map((c) => c.id));
    const data = {
      exportedAt: new Date().toISOString(),
      note: 'SwipeUp hesabına ait kişisel verilerin (KVKK md. 11 kapsamında).',
      profile: pub(req.user, id),
      consentLog: store.filter('consent_log', (x) => x.userId === id).map(({ ip, ...x }) => x), // verdiğin / geri aldığın açık rızalar
      posts: store.filter('posts', (p) => p.userId === id).map((p) => ({ id: p.id, type: p.type, caption: p.caption, items: p.items || [{ media: p.media }], likes: p.likes.length, createdAt: new Date(p.createdAt).toISOString() })),
      comments: store.all('posts').flatMap((p) => p.comments.filter((c) => c.userId === id).map((c) => ({ post: p.id, text: c.text, at: new Date(c.at).toISOString() }))),
      stories: store.filter('stories', (s) => s.userId === id).map((s) => ({ media: s.media, at: new Date(s.at).toISOString() })),
      following: store.filter('follows', (f) => f.from === id).map((f) => name(f.to)),
      followers: store.filter('follows', (f) => f.to === id).map((f) => name(f.from)),
      likesGiven: store.filter('swipes', (s) => s.from === id && s.dir !== 'left').map((s) => ({ user: name(s.to), type: s.dir, at: new Date(s.at).toISOString() })),
      matches: store.filter('matches', (m) => m.users.includes(id)).map((m) => ({ user: name(m.users.find((x) => x !== id)), at: new Date(m.at).toISOString() })),
      messages: store.filter('messages', (m) => myChats.has(m.chatId) && m.from === id && !m.system).map((m) => ({ chat: m.chatId, text: m.text, media: m.media, at: new Date(m.at).toISOString() })),
      blocked: store.filter('blocks', (b) => b.from === id).map((b) => name(b.to)),
      reportsSent: store.filter('reports', (r) => r.from === id).map((r) => ({ user: name(r.to), reason: r.reason, at: new Date(r.at).toISOString() })),
      orders: store.filter('orders', (o) => o.userId === id),
      coinHistory: store.filter('coin_tx', (t) => t.userId === id),
      notifications: store.filter('notifications', (n) => n.userId === id).map((n) => ({ text: n.text, at: new Date(n.at).toISOString() })),
    };
    res.setHeader('Content-Disposition', `attachment; filename="swipeup-${req.user.username}-veriler.json"`);
    res.type('application/json').send(JSON.stringify(data, null, 2));
  });
};

module.exports.POSES = POSES;

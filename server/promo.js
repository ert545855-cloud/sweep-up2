// Öne çıkarma (reklam): kullanıcı jetonla gönderisini / vitrin videosunu öne çıkarır.
// Bütçe ne kadar yüksekse gösterim hakkı o kadar çok ve akışta görünme sıklığı o kadar yüksek olur.
const { nanoid } = require('nanoid');

const DAY = 86400000;
const DEFAULTS = { enabled: true, impPerCoin: 20, minCoins: 20, maxCoins: 5000, perViewerDay: 3 };

module.exports = function promo(app, ctx) {
  const { store, auth, brief, eco, notify, emitTo, canSee, isBlocked, postOut, priv } = ctx;
  const now = () => Date.now();
  const cfg = () => ({ ...DEFAULTS, ...(store.get('settings', 'promo') || {}) });
  const trDay = (t = now()) => new Date(t + 3 * 3600000).toISOString().slice(0, 10);
  const seenMap = new Map(); // `${promoId}:${uid}:${day}` -> adet
  const dirty = new Set();
  setInterval(() => { for (const id of dirty) { const p = store.get('promos', id); if (p) store.update('promos', id, { shown: p.shown, reach: p.reach, hits: p.hits }); } dirty.clear(); }, 20000).unref();

  const ageOf = (u) => u.age || null;
  const matches = (p, u) => {
    const t = p.target || {};
    if (t.gender && t.gender !== 'all' && u.gender && u.gender !== t.gender) return false;
    if (t.city && !(u.city || '').toLocaleLowerCase('tr-TR').includes(t.city.toLocaleLowerCase('tr-TR'))) return false;
    const a = ageOf(u);
    if (a && ((t.ageMin && a < t.ageMin) || (t.ageMax && a > t.ageMax))) return false;
    return true;
  };
  const live = (p) => p.status === 'active' && now() < p.end && p.shown < p.impressions;

  // İzleyiciye uygun öne çıkan gönderileri seç (bütçesi yüksek olan daha sık çıkar)
  ctx.promoFor = (viewer, type, n = 3, exclude = new Set()) => {
    if (!cfg().enabled) return [];
    const day = trDay(); const cap = cfg().perViewerDay;
    let pool = store.filter('promos', (p) => live(p) && p.type === type && p.userId !== viewer.id && !exclude.has(p.postId)).filter((p) => {
      const post = store.get('posts', p.postId); const owner = store.get('users', p.userId);
      if (!post || !owner || isBlocked(viewer.id, owner.id) || !canSee(viewer.id, owner)) return false;
      if ((seenMap.get(`${p.id}:${viewer.id}:${day}`) || 0) >= cap) return false;
      return matches(p, viewer);
    });
    const out = [];
    while (pool.length && out.length < n) {
      // ağırlık: günlük bütçe (jeton/gün) × kalan gösterim oranı
      const w = pool.map((p) => (p.coins / Math.max(1, p.days)) * (0.3 + 0.7 * (1 - p.shown / p.impressions)));
      let r = Math.random() * w.reduce((a, b) => a + b, 0); let i = 0;
      while (i < w.length - 1 && (r -= w[i]) > 0) i++;
      out.push(pool[i]); pool = pool.filter((_, k) => k !== i);
    }
    return out.map((p) => {
      const k = `${p.id}:${viewer.id}:${day}`;
      const first = !seenMap.has(k);
      seenMap.set(k, (seenMap.get(k) || 0) + 1);
      p.shown += 1; if (first) p.reach = (p.reach || 0) + 1; dirty.add(p.id);
      return { ...postOut(store.get('posts', p.postId), viewer.id), sponsored: { id: p.id } };
    });
  };
  // eski görülme kayıtlarını temizle
  setInterval(() => { const d = trDay(); for (const k of seenMap.keys()) if (!k.endsWith(d)) seenMap.delete(k); }, 3600000).unref();

  const refundOf = (p) => Math.max(0, Math.floor((p.impressions - p.shown) / cfg().impPerCoin));
  function finish(p, status, { reason = '', refund = true } = {}) {
    if (!['active', 'paused'].includes(p.status)) return p;
    const back = refund ? Math.min(p.coins, refundOf(p)) : 0;
    if (back > 0) eco.addCoins(p.userId, back, 'promo_refund', { ref: p.id });
    store.update('promos', p.id, { status, endedAt: now(), refunded: back, reason, shown: p.shown, reach: p.reach, hits: p.hits });
    dirty.delete(p.id);
    const post = store.get('posts', p.postId);
    const msg = status === 'done' ? `🚀 Öne çıkarma bitti: ${p.shown.toLocaleString('tr-TR')} gösterim, ${(p.reach || 0).toLocaleString('tr-TR')} kişiye ulaştı.${back ? ` Kullanılmayan ${back} jeton iade edildi.` : ''}`
      : status === 'stopped_admin' ? `Öne çıkarman yönetim tarafından durduruldu${reason ? `: ${reason}` : ''}.${back ? ` ${back} jeton iade edildi.` : ''}` : `Öne çıkarmayı durdurdun.${back ? ` ${back} jeton iade edildi.` : ''}`;
    notify(p.userId, { type: 'order', text: msg, url: '/#/reklam', ref: post?.id });
    emitTo(p.userId, 'wallet', {});
    return store.get('promos', p.id);
  }
  setInterval(() => {
    store.filter('promos', (p) => p.status === 'active' && (now() >= p.end || p.shown >= p.impressions)).forEach((p) => finish(p, 'done'));
  }, 60000).unref();

  const out = (p) => {
    const post = store.get('posts', p.postId);
    return {
      ...p, post: post ? { id: post.id, type: post.type, image: post.items?.[0]?.poster || (post.items?.[0]?.type === 'video' ? null : post.items?.[0]?.media) || post.poster || null, caption: (post.caption || '').slice(0, 80) } : null,
      user: brief(store.get('users', p.userId)), likesGained: post ? Math.max(0, post.likes.length - (p.likesAtStart || 0)) : 0,
      remaining: Math.max(0, p.impressions - p.shown),
    };
  };

  // ---- Kullanıcı ----
  app.get('/api/promos/config', auth, (req, res) => { const c = cfg(); res.json({ ...c, coins: req.user.coins || 0, private: !!priv(req.user).private }); });
  app.get('/api/promos', auth, (req, res) => res.json(store.filter('promos', (p) => p.userId === req.user.id).sort((a, b) => b.at - a.at).slice(0, 50).map(out)));
  app.post('/api/promos', auth, (req, res) => {
    const c = cfg();
    if (!c.enabled) return res.status(503).json({ error: 'Öne çıkarma şu an kapalı.' });
    const b = req.body || {};
    const post = store.get('posts', String(b.postId || ''));
    if (!post || post.userId !== req.user.id) return res.status(404).json({ error: 'Gönderi bulunamadı.' });
    if (priv(req.user).private) return res.status(400).json({ error: 'Gizli hesabın gönderileri öne çıkarılamaz. Önce hesabını herkese açık yap.' });
    if (store.find('promos', (p) => p.postId === post.id && ['active', 'paused'].includes(p.status))) return res.status(409).json({ error: 'Bu gönderi zaten öne çıkarılıyor.' });
    const coins = Math.round(+b.coins);
    if (!(coins >= c.minCoins && coins <= c.maxCoins)) return res.status(400).json({ error: `Bütçe ${c.minCoins}–${c.maxCoins} jeton arası olmalı.` });
    const days = [1, 3, 7].includes(+b.days) ? +b.days : 1;
    const t = b.target || {};
    const target = {
      gender: ['k', 'e'].includes(t.gender) ? t.gender : 'all', city: String(t.city || '').trim().slice(0, 40),
      ageMin: Math.max(18, Math.min(99, parseInt(t.ageMin, 10) || 18)), ageMax: Math.max(18, Math.min(99, parseInt(t.ageMax, 10) || 99)),
    };
    if (target.ageMin > target.ageMax) [target.ageMin, target.ageMax] = [target.ageMax, target.ageMin];
    if (!eco.spend(req.user.id, coins, 'promo', { ref: post.id })) return res.status(402).json({ error: `Bunun için ${coins} jeton gerekiyor.`, need: coins });
    const p = store.put('promos', {
      id: nanoid(10), userId: req.user.id, postId: post.id, type: post.type, coins, days, impressions: coins * c.impPerCoin, shown: 0, reach: 0, hits: 0,
      target, status: 'active', at: now(), start: now(), end: now() + days * DAY, likesAtStart: post.likes.length,
    });
    emitTo(req.user.id, 'wallet', {});
    res.json(out(p));
  });
  app.post('/api/promos/:id/stop', auth, (req, res) => {
    const p = store.get('promos', req.params.id);
    if (!p || p.userId !== req.user.id) return res.status(404).json({ error: 'Bulunamadı.' });
    res.json(out(finish(p, 'stopped')));
  });
  // Öne çıkan içerikte etkileşim (beğeni, yorum, profil, paylaşım)
  const hitSeen = new Set();
  app.post('/api/promos/:id/hit', auth, (req, res) => {
    const p = store.get('promos', req.params.id);
    const k = `${req.params.id}:${req.user.id}`;
    if (p && p.userId !== req.user.id && !hitSeen.has(k)) { hitSeen.add(k); p.hits = (p.hits || 0) + 1; dirty.add(p.id); }
    res.json({ ok: true });
  });

  // ---- Yönetim ----
  const A = ctx.admin;
  if (!A?.adminAuth) return;
  app.get('/api/admin/promos', A.adminAuth, (req, res) => {
    const st = String(req.query.status || 'active');
    const all = store.all('promos');
    const list = all.filter((p) => st === 'all' || (st === 'active' ? p.status === 'active' : p.status !== 'active')).sort((a, b) => b.at - a.at).slice(0, 300);
    const spent = all.reduce((a, p) => a + p.coins - (p.refunded || 0), 0);
    res.json({ cfg: cfg(), items: list.map(out), totals: { active: all.filter((p) => p.status === 'active').length, count: all.length, spent, coinTL: eco.get().coinTL, shown: all.reduce((a, p) => a + (p.shown || 0), 0) } });
  });
  app.put('/api/admin/promos/settings', A.adminAuth, A.owner, (req, res) => {
    const b = req.body || {}; const c = cfg();
    const n = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.round(+v))) : d);
    const s = { id: 'promo', enabled: b.enabled !== undefined ? !!b.enabled : c.enabled, impPerCoin: n(b.impPerCoin, 1, 1000, c.impPerCoin), minCoins: n(b.minCoins, 1, 10000, c.minCoins), maxCoins: n(b.maxCoins, 10, 100000, c.maxCoins), perViewerDay: n(b.perViewerDay, 1, 20, c.perViewerDay) };
    store.put('settings', s);
    A.audit(req.admin, 'öne çıkarma ayarlarını değiştirdi', null, JSON.stringify(s));
    res.json(s);
  });
  app.post('/api/admin/promos/:id/stop', A.adminAuth, (req, res) => {
    const p = store.get('promos', req.params.id);
    if (!p) return res.status(404).json({ error: 'Bulunamadı.' });
    const r = finish(p, 'stopped_admin', { reason: String(req.body?.reason || '').slice(0, 200) });
    A.audit(req.admin, 'öne çıkarmayı durdurdu', p.userId, req.body?.reason || '');
    res.json(out(r));
  });
};

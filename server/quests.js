// Günlük görevler: her gün yenilenir, tamamlanan görevin jetonu alınır, hepsi bitince bonus.
const DEFAULT_QUESTS = [
  { id: 'giris', em: '👋', title: 'Uygulamaya uğra', goal: 1, coins: 1 },
  { id: 'begeni', em: '🔥', title: 'Kaydırmada 3 kişiyi beğen', goal: 3, coins: 3 },
  { id: 'mesaj', em: '💬', title: 'Bir sohbete mesaj yaz', goal: 1, coins: 2 },
  { id: 'yorum', em: '✍️', title: 'Bir gönderiye yorum yap', goal: 1, coins: 2 },
  { id: 'vitrin', em: '🎬', title: 'Vitrin’de 5 video izle', goal: 5, coins: 2 },
  { id: 'paylas', em: '📸', title: 'Hikaye ya da gönderi paylaş', goal: 1, coins: 5 },
];
const DEFAULTS = { enabled: true, bonus: 5, list: DEFAULT_QUESTS };

module.exports = function quests(app, ctx) {
  const { store, auth, eco, emitTo } = ctx;
  const now = () => Date.now();
  const cfgAll = () => { const s = store.get('settings', 'quests') || {}; return { ...DEFAULTS, ...s, list: s.list || DEFAULT_QUESTS }; };
  const cfg = () => { const c = cfgAll(); return { ...c, list: c.list.filter((q) => q.goal > 0) }; };
  const day = (t = now()) => new Date(t + 3 * 3600000).toISOString().slice(0, 10);
  const docOf = (uid) => { const id = `${uid}_${day()}`; return store.get('quests', id) || { id, uid, day: day(), c: {}, claimed: [], seen: {} }; };
  const loggedIn = new Set(); let loggedDay = day();

  // İlerleme kaydet
  ctx.quest = (uid, key, n = 1, uniq = null) => {
    const c = cfg(); if (!c.enabled || !uid) return;
    const q = c.list.find((x) => x.id === key); if (!q) return;
    const u = store.get('users', uid); if (!u || ['falci', 'official'].includes(u.role)) return;
    const d = docOf(uid);
    if (uniq) { d.seen = d.seen || {}; const k = `${key}:${uniq}`; if (d.seen[k]) return; d.seen[k] = 1; }
    const before = d.c[key] || 0;
    if (before >= q.goal) { if (uniq) store.put('quests', d); return; }
    d.c[key] = Math.min(q.goal, before + n);
    store.put('quests', d);
    if (d.c[key] >= q.goal) emitTo(uid, 'quests', { done: key, title: q.title, coins: q.coins });
  };
  // Günlük giriş
  ctx.questLogin = (uid) => {
    if (loggedDay !== day()) { loggedIn.clear(); loggedDay = day(); }
    if (loggedIn.has(uid)) return;
    loggedIn.add(uid); ctx.quest(uid, 'giris');
  };
  const view = (uid) => {
    const c = cfg(); const d = docOf(uid);
    const items = c.list.map((q) => ({ ...q, progress: d.c[q.id] || 0, done: (d.c[q.id] || 0) >= q.goal, claimed: d.claimed.includes(q.id) }));
    const allDone = items.every((q) => q.done);
    const nextReset = (() => { const t = new Date(now() + 3 * 3600000); t.setUTCHours(24, 0, 0, 0); return t.getTime() - 3 * 3600000; })();
    return { enabled: c.enabled, items, bonus: c.bonus, bonusReady: allDone && !d.claimed.includes('_bonus'), bonusClaimed: d.claimed.includes('_bonus'), claimable: items.filter((q) => q.done && !q.claimed).length + (allDone && !d.claimed.includes('_bonus') ? 1 : 0), doneCount: items.filter((q) => q.done).length, total: items.length, resetAt: nextReset };
  };
  app.get('/api/quests', auth, (req, res) => { ctx.questLogin(req.user.id); res.json(view(req.user.id)); });
  app.post('/api/quests/:id/claim', auth, (req, res) => {
    const c = cfg(); if (!c.enabled) return res.status(503).json({ error: 'Görevler şu an kapalı.' });
    const d = docOf(req.user.id); const id = req.params.id;
    if (id === 'bonus') {
      const v = view(req.user.id);
      if (!v.bonusReady) return res.status(400).json({ error: 'Önce bütün görevleri tamamla.' });
      d.claimed.push('_bonus'); store.put('quests', d);
      eco.addCoins(req.user.id, c.bonus, 'quest_bonus');
    } else {
      const q = c.list.find((x) => x.id === id);
      if (!q) return res.status(404).json({ error: 'Görev bulunamadı.' });
      if ((d.c[id] || 0) < q.goal) return res.status(400).json({ error: 'Görev henüz tamamlanmadı.' });
      if (d.claimed.includes(id)) return res.status(409).json({ error: 'Ödülü zaten aldın.' });
      d.claimed.push(id); store.put('quests', d);
      eco.addCoins(req.user.id, q.coins, 'quest', { ref: id });
    }
    emitTo(req.user.id, 'wallet', {});
    res.json({ ...view(req.user.id), coins: store.get('users', req.user.id).coins || 0 });
  });
  // Vitrin'de video izleme (istemciden)
  app.post('/api/quests/ping', auth, (req, res) => {
    if (req.body?.key === 'vitrin' && req.body?.id) ctx.quest(req.user.id, 'vitrin', 1, String(req.body.id).slice(0, 20));
    res.json({ ok: true });
  });
  // eski kayıtları temizle (14 gün)
  setInterval(() => { const lim = day(now() - 14 * 86400000); store.filter('quests', (d) => d.day < lim).forEach((d) => store.del('quests', d.id)); }, 6 * 3600000).unref();

  // ---- Yönetim ----
  const A = ctx.admin;
  if (!A?.adminAuth) return;
  app.get('/api/admin/quests', A.adminAuth, (req, res) => {
    const today = store.filter('quests', (d) => d.day === day());
    const c = cfgAll();
    const paid = store.filter('coin_tx', (x) => (x.reason === 'quest' || x.reason === 'quest_bonus') && x.at > now() - 7 * 86400000).reduce((a, x) => a + (x.delta || 0), 0);
    res.json({ ...c, stats: { usersToday: today.length, allDoneToday: today.filter((d) => c.list.every((q) => (d.c[q.id] || 0) >= q.goal)).length, coins7d: paid, byQuest: Object.fromEntries(c.list.map((q) => [q.id, today.filter((d) => (d.c[q.id] || 0) >= q.goal).length])) } });
  });
  app.put('/api/admin/quests', A.adminAuth, A.owner, (req, res) => {
    const b = req.body || {}; const c = cfg();
    const list = (Array.isArray(b.list) ? b.list : cfgAll().list).map((q) => {
      const base = DEFAULT_QUESTS.find((x) => x.id === q.id); if (!base) return null;
      return { ...base, goal: Math.max(0, Math.min(100, parseInt(q.goal, 10) || 0)), coins: Math.max(0, Math.min(1000, parseInt(q.coins, 10) || 0)), title: base.title.replace(/\d+/, String(Math.max(1, parseInt(q.goal, 10) || base.goal))) };
    }).filter(Boolean);
    const s = { id: 'quests', enabled: b.enabled !== undefined ? !!b.enabled : c.enabled, bonus: Math.max(0, Math.min(1000, parseInt(b.bonus, 10) || 0)), list };
    store.put('settings', s);
    A.audit(req.admin, 'günlük görevleri güncelledi', null, list.map((q) => `${q.id}:${q.goal}/${q.coins}`).join(', '));
    res.json(s);
  });
};
module.exports.DEFAULT_QUESTS = DEFAULT_QUESTS;

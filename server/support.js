// Müşteri hizmetleri: kullanıcı talep açar, yönetim panelinden cevaplanır; yöneticilere anlık bildirim gider.
const { nanoid } = require('nanoid');

const CATS = { hesap: 'Hesap ve giriş', odeme: 'Ödeme ve jeton', sikayet: 'Şikayet ve güvenlik', hata: 'Hata bildirimi', oneri: 'Öneri', diger: 'Diğer' };
const STATUS = { open: 'Cevap bekliyor', answered: 'Cevaplandı', closed: 'Kapandı' };

module.exports = function support(app, ctx) {
  const { store, auth, brief, notify, emitTo, limited, isMedia, pushAdmins } = ctx;
  const now = () => Date.now();
  const clean = (s, n) => String(s || '').trim().slice(0, n);
  const summary = (t) => ({
    id: t.id, no: t.no, category: t.category, categoryLabel: CATS[t.category] || 'Diğer', subject: t.subject, status: t.status, statusLabel: STATUS[t.status],
    at: t.at, lastAt: t.lastAt, last: (t.msgs[t.msgs.length - 1] || {}).text?.slice(0, 120) || '', lastFrom: (t.msgs[t.msgs.length - 1] || {}).from, userUnread: t.userUnread || 0, adminUnread: !!t.adminUnread, count: t.msgs.length,
  });
  const nextNo = () => { const m = store.get('settings', 'support_seq') || { id: 'support_seq', n: 1000 }; m.n += 1; store.put('settings', m); return m.n; };
  const alertAdmins = (t, text) => {
    const u = store.get('users', t.userId);
    pushAdmins?.({ title: `🎧 Destek #${t.no} · ${u?.name || 'Kullanıcı'}`, body: `${CATS[t.category] || ''}: ${text.slice(0, 140)}`, url: `/admin/#/support/${t.id}`, tag: `support-${t.id}` });
  };

  // ---- Kullanıcı ----
  app.get('/api/support', auth, (req, res) => {
    res.json({ cats: CATS, items: store.filter('support', (t) => t.userId === req.user.id).sort((a, b) => b.lastAt - a.lastAt).map(summary) });
  });
  app.post('/api/support', auth, (req, res) => {
    const b = req.body || {};
    const category = CATS[b.category] ? b.category : 'diger';
    const subject = clean(b.subject, 80); const text = clean(b.text, 2000);
    const image = isMedia(b.image) ? b.image : null;
    if (subject.length < 3) return res.status(400).json({ error: 'Konuyu yaz.' });
    if (text.length < 10) return res.status(400).json({ error: 'Sorununu biraz daha ayrıntılı anlat (en az 10 karakter).' });
    if (limited('sup:' + req.user.id, 5, 86400000)) return res.status(429).json({ error: 'Bugün çok fazla talep açtın. Açık talebine yazabilirsin.' });
    const t = store.put('support', {
      id: nanoid(12), no: nextNo(), userId: req.user.id, category, subject, status: 'open',
      msgs: [{ id: nanoid(8), from: 'user', text, image, at: now() }], at: now(), lastAt: now(), adminUnread: true, userUnread: 0,
      device: clean(req.headers['user-agent'], 200),
    });
    alertAdmins(t, `${subject} — ${text}`);
    res.json(summary(t));
  });
  const mine = (req, res) => {
    const t = store.get('support', req.params.id);
    if (!t || t.userId !== req.user.id) { res.status(404).json({ error: 'Talep bulunamadı.' }); return null; }
    return t;
  };
  app.get('/api/support/:id', auth, (req, res) => {
    const t = mine(req, res); if (!t) return;
    if (t.userUnread) store.update('support', t.id, { userUnread: 0 });
    res.json({ ...summary(t), msgs: t.msgs.map((m) => ({ ...m, admin: m.from === 'admin' ? 'SwipeUp Destek' : undefined, by: undefined })) });
  });
  app.post('/api/support/:id/reply', auth, (req, res) => {
    const t = mine(req, res); if (!t) return;
    const text = clean(req.body?.text, 2000); const image = isMedia(req.body?.image) ? req.body.image : null;
    if (!text && !image) return res.status(400).json({ error: 'Mesaj boş.' });
    if (limited('supr:' + req.user.id, 30, 3600000)) return res.status(429).json({ error: 'Biraz yavaş 🙂' });
    t.msgs.push({ id: nanoid(8), from: 'user', text, image, at: now() });
    store.update('support', t.id, { msgs: t.msgs, status: 'open', lastAt: now(), adminUnread: true });
    alertAdmins(t, text || '📷 Fotoğraf');
    res.json({ ok: true });
  });
  app.post('/api/support/:id/close', auth, (req, res) => {
    const t = mine(req, res); if (!t) return;
    store.update('support', t.id, { status: 'closed', closedAt: now() });
    res.json({ ok: true });
  });
  app.get('/api/support-unread', auth, (req, res) => res.json({ n: store.filter('support', (t) => t.userId === req.user.id && t.userUnread).length }));

  // ---- Yönetim ----
  const A = ctx.admin;
  if (!A?.adminAuth) return;
  app.get('/api/admin/support', A.adminAuth, (req, res) => {
    const st = String(req.query.status || 'open');
    const q = String(req.query.q || '').toLowerCase().trim();
    const list = store.filter('support', (t) => (st === 'all' || t.status === st)).sort((a, b) => (b.adminUnread - a.adminUnread) || (b.lastAt - a.lastAt));
    const out = list.map((t) => ({ ...summary(t), user: brief(store.get('users', t.userId)) }))
      .filter((t) => !q || String(t.no).includes(q) || t.subject.toLowerCase().includes(q) || t.user?.username?.includes(q));
    const all = store.all('support');
    res.json({ cats: CATS, items: out.slice(0, 300), counts: { open: all.filter((t) => t.status === 'open').length, answered: all.filter((t) => t.status === 'answered').length, closed: all.filter((t) => t.status === 'closed').length, all: all.length } });
  });
  app.get('/api/admin/support/:id', A.adminAuth, (req, res) => {
    const t = store.get('support', req.params.id);
    if (!t) return res.status(404).json({ error: 'Talep bulunamadı.' });
    if (t.adminUnread) store.update('support', t.id, { adminUnread: false });
    const u = store.get('users', t.userId);
    res.json({ ...summary(t), msgs: t.msgs, device: t.device, user: u ? { ...brief(u), email: u.email || null, createdAt: u.createdAt, coins: u.coins || 0, plus: (u.plusUntil || 0) > now(), city: u.city || '' } : null, others: store.filter('support', (x) => x.userId === t.userId && x.id !== t.id).length });
  });
  app.post('/api/admin/support/:id/reply', A.adminAuth, (req, res) => {
    const t = store.get('support', req.params.id);
    if (!t) return res.status(404).json({ error: 'Talep bulunamadı.' });
    const text = clean(req.body?.text, 3000);
    if (text.length < 2) return res.status(400).json({ error: 'Cevap yaz.' });
    t.msgs.push({ id: nanoid(8), from: 'admin', by: req.admin.username, text, at: now() });
    const status = req.body?.close ? 'closed' : 'answered';
    store.update('support', t.id, { msgs: t.msgs, status, lastAt: now(), adminUnread: false, userUnread: (t.userUnread || 0) + 1, answeredBy: req.admin.username });
    notify(t.userId, { type: 'support', text: `🎧 Destek ekibi talebini cevapladı (#${t.no}): ${text.slice(0, 90)}`, title: 'SwipeUp Destek', url: `/#/destek/${t.id}`, tag: `support-${t.id}` });
    emitTo(t.userId, 'support', { id: t.id });
    A.audit(req.admin, 'destek talebini cevapladı', t.userId, `#${t.no} ${t.subject}`);
    res.json({ ok: true, status });
  });
  app.post('/api/admin/support/:id/status', A.adminAuth, (req, res) => {
    const t = store.get('support', req.params.id);
    if (!t) return res.status(404).json({ error: 'Talep bulunamadı.' });
    const status = STATUS[req.body?.status] ? req.body.status : 'open';
    store.update('support', t.id, { status, adminUnread: false });
    res.json({ ok: true, status });
  });
};
module.exports.CATS = CATS;

// SwipeUp yönetim paneli API'si.
// Yönetici verisi uygulama verisinden ayrıdır: adm_* koleksiyonlarında (adm_admins, adm_ledger,
// adm_audit, adm_announcements, adm_notes) tutulur. Uygulama verisini okur ve uygulamaya etki eder.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { nanoid } = require('nanoid');

const DAY = 86400000;
const CATS = {
  gelir: ['Reklam', 'Abonelik', 'Uygulama içi satış', 'Sponsorluk', 'Bağış', 'Diğer'],
  gider: ['Sunucu', 'Alan adı', 'Reklam ve pazarlama', 'Maaş', 'Yazılım', 'Vergi', 'Diğer'],
};

module.exports = function mountAdmin(app, ctx) {
  const { store, io, emitTo, notify, brief, isOnline, online, removeChat, limited, ipOf, secret } = ctx;
  const SECRET = () => secret() + ':admin';
  const now = () => Date.now();

  // ---------- Yardımcılar ----------
  const audit = (admin, action, target, detail) => store.put('adm_audit', {
    id: nanoid(12), adminId: admin.id, admin: admin.username, action, target: target || null, detail: detail || '', at: now(),
  });
  const adminOut = (a) => ({ id: a.id, username: a.username, name: a.name, role: a.role, createdAt: a.createdAt, lastLogin: a.lastLogin || null });
  const userRow = (u) => ({
    ...brief(u), email: u.email || null, age: u.age, city: u.city, status: statusOf(u), banReason: u.banReason || null, bannedUntil: u.bannedUntil || null,
    posts: store.filter('posts', (p) => p.userId === u.id).length,
    reports: store.filter('reports', (r) => r.to === u.id).length,
    matches: store.filter('matches', (m) => m.users.includes(u.id)).length,
  });
  function statusOf(u) {
    if (u.status === 'banned') return 'banned';
    if (u.status === 'suspended' && u.bannedUntil > now()) return 'suspended';
    return 'active';
  }
  const kickSockets = (userId, payload) => {
    online.get(userId)?.forEach((s) => { s.emit('account:banned', payload); s.disconnect(true); });
  };
  const contentOf = (ref) => {
    if (!ref) return null;
    const p = store.get('posts', ref);
    if (p) return { kind: 'post', id: p.id, type: p.type, media: p.media, poster: p.poster, caption: p.caption };
    const m = store.get('messages', ref);
    if (m) return { kind: 'message', id: m.id, text: m.deleted ? '(silindi)' : m.text, media: m.deleted ? null : m.media, mediaType: m.mediaType };
    const s = store.get('stories', ref);
    if (s) return { kind: 'story', id: s.id, media: s.media, mediaType: s.mediaType };
    return { kind: 'gone', id: ref };
  };
  const deleteContent = (ref) => {
    const c = contentOf(ref);
    if (!c) return null;
    if (c.kind === 'post') store.del('posts', ref);
    if (c.kind === 'story') { store.del('stories', ref); io.emit('stories:update', {}); }
    if (c.kind === 'message') {
      const m = store.get('messages', ref);
      Object.assign(m, { deleted: true, text: '', media: null, reactions: {} });
      store.update('messages', m.id, {});
      store.get('chats', m.chatId)?.members.forEach((x) => emitTo(x, 'message:update', m));
    }
    return c.kind;
  };

  function adminAuth(req, res, next) {
    try {
      const { aid } = jwt.verify((req.headers.authorization || '').slice(7), SECRET());
      const a = store.get('adm_admins', aid);
      if (!a || a.disabled) throw new Error('x');
      req.admin = a;
      next();
    } catch { res.status(401).json({ error: 'Oturum süresi doldu, tekrar giriş yap.' }); }
  }
  const owner = (req, res, next) => (req.admin.role === 'owner' ? next() : res.status(403).json({ error: 'Bu işlem sadece sahip yöneticiye açık.' }));

  // ---------- İlk yönetici ----------
  ctx.ensureAdmin = async () => {
    const pass = process.env.ADMIN_PASSWORD;
    if (store.all('adm_admins').length) {
      const own = store.find('adm_admins', (a) => a.username === 'admin');
      if (own && pass && !own.passChanged && !(await bcrypt.compare(pass, own.passHash))) store.update('adm_admins', own.id, { passHash: await bcrypt.hash(pass, 10) });
      return;
    }
    const initial = pass || crypto.randomBytes(9).toString('base64url');
    store.put('adm_admins', { id: nanoid(10), username: 'admin', name: 'Yönetici', role: 'owner', passHash: await bcrypt.hash(initial, 10), createdAt: now() });
    console.log(`[admin] Yönetici hesabı oluşturuldu (kullanıcı adı: admin)${pass ? '' : `, geçici şifre: ${initial}`}`);
  };

  // ---------- Giriş ----------
  app.post('/api/admin/login', async (req, res) => {
    const username = String(req.body?.username || '').toLowerCase().trim();
    if (limited('alogin:' + ipOf(req), 10, 900000)) return res.status(429).json({ error: 'Çok fazla deneme. 15 dakika sonra tekrar dene.' });
    const a = store.find('adm_admins', (x) => x.username === username && !x.disabled);
    if (!a || !(await bcrypt.compare(String(req.body?.password || ''), a.passHash))) return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
    store.update('adm_admins', a.id, { lastLogin: now() });
    audit(a, 'giriş', null, ipOf(req));
    res.json({ token: jwt.sign({ aid: a.id }, SECRET(), { expiresIn: '12h' }), admin: adminOut(a) });
  });
  app.get('/api/admin/me', adminAuth, (req, res) => res.json(adminOut(req.admin)));
  app.post('/api/admin/me/password', adminAuth, async (req, res) => {
    const { current, password } = req.body || {};
    if (!(await bcrypt.compare(String(current || ''), req.admin.passHash))) return res.status(400).json({ error: 'Mevcut şifre hatalı.' });
    if (String(password || '').length < 8) return res.status(400).json({ error: 'Yeni şifre en az 8 karakter olmalı.' });
    store.update('adm_admins', req.admin.id, { passHash: await bcrypt.hash(password, 10), passChanged: true });
    audit(req.admin, 'şifre değiştirdi');
    res.json({ ok: true });
  });

  // ---------- Genel bakış ----------
  app.get('/api/admin/overview', adminAuth, (req, res) => {
    const t = now();
    const users = store.all('users');
    const msgs = store.filter('messages', (m) => !m.system);
    const days = 14;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const series = (arr, field = 'at') => Array.from({ length: days }, (_, i) => {
      const d0 = start.getTime() - (days - 1 - i) * DAY;
      return { day: new Date(d0).toISOString().slice(0, 10), n: arr.filter((x) => x[field] >= d0 && x[field] < d0 + DAY).length };
    });
    const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
    const ledger = store.filter('adm_ledger', (l) => new Date(l.date).getTime() >= month.getTime());
    const sum = (type) => ledger.filter((l) => l.type === type).reduce((a, l) => a + l.amount, 0);
    const falMsgs = store.filter('messages', (m) => m.fal);
    res.json({
      users: users.length,
      newToday: users.filter((u) => u.createdAt >= start.getTime()).length,
      new7: users.filter((u) => u.createdAt >= t - 7 * DAY).length,
      online: users.filter((u) => isOnline(u.id)).length,
      active24: users.filter((u) => (u.lastSeen || 0) >= t - DAY || isOnline(u.id)).length,
      banned: users.filter((u) => statusOf(u) !== 'active').length,
      messagesToday: msgs.filter((m) => m.at >= start.getTime()).length,
      matches: store.all('matches').length,
      posts: store.all('posts').length,
      stories: store.filter('stories', (s) => t - s.at < DAY).length,
      falPending: falMsgs.filter((m) => m.fal.status === 'pending').length,
      falTotal: falMsgs.length,
      reportsOpen: store.filter('reports', (r) => r.status === 'open').length,
      appealsOpen: store.filter('appeals', (a) => a.status === 'open').length,
      income: sum('gelir'), expense: sum('gider'),
      store: store.kind, mediaMB: +((store.mediaBytes || 0) / 1048576).toFixed(1),
      series: { users: series(users, 'createdAt'), messages: series(msgs), matches: series(store.all('matches')) },
    });
  });

  // ---------- Kullanıcılar ----------
  app.get('/api/admin/users', adminAuth, (req, res) => {
    const q = String(req.query.q || '').toLowerCase().trim();
    const st = String(req.query.status || 'all');
    let list = store.all('users');
    if (q) list = list.filter((u) => u.username.includes(q) || u.name.toLowerCase().includes(q) || (u.email || '').includes(q));
    if (st !== 'all') list = list.filter((u) => statusOf(u) === st);
    list.sort((a, b) => b.createdAt - a.createdAt);
    res.json({ total: list.length, items: list.slice(0, 300).map(userRow) });
  });
  app.get('/api/admin/users/:id', adminAuth, (req, res) => {
    const u = store.get('users', req.params.id);
    if (!u) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    res.json({
      ...userRow(u), bio: u.bio, gender: u.gender, interests: u.interests, photos: u.photos, zodiac: u.zodiac || null,
      followers: store.filter('follows', (f) => f.to === u.id).length,
      following: store.filter('follows', (f) => f.from === u.id).length,
      messagesSent: store.filter('messages', (m) => m.from === u.id && !m.system).length,
      reportsAbout: store.filter('reports', (r) => r.to === u.id).sort((a, b) => b.at - a.at).slice(0, 20).map((r) => ({ ...r, fromUser: brief(store.get('users', r.from)) })),
      reportsBy: store.filter('reports', (r) => r.from === u.id).length,
      appeals: store.filter('appeals', (a) => a.userId === u.id).sort((a, b) => b.at - a.at),
      recentPosts: store.filter('posts', (p) => p.userId === u.id).sort((a, b) => b.createdAt - a.createdAt).slice(0, 9).map((p) => ({ id: p.id, type: p.type, media: p.media, poster: p.poster, caption: p.caption })),
      history: store.filter('adm_audit', (x) => x.target === u.id).sort((a, b) => b.at - a.at).slice(0, 20),
    });
  });

  function banUser(admin, u, { days, reason }) {
    const until = days ? now() + days * DAY : null;
    store.update('users', u.id, { status: days ? 'suspended' : 'banned', bannedUntil: until, banReason: String(reason || '').slice(0, 300), bannedAt: now() });
    kickSockets(u.id, { reason, until });
    [...(ctx.lives.get(u.id) ? [u.id] : [])].forEach((id) => ctx.endLive(id));
    audit(admin, days ? `askıya aldı (${days} gün)` : 'kalıcı yasakladı', u.id, reason);
  }
  app.post('/api/admin/users/:id/ban', adminAuth, (req, res) => {
    const u = store.get('users', req.params.id);
    if (!u) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    const days = req.body?.days ? Math.max(1, Math.min(365, parseInt(req.body.days, 10))) : null;
    banUser(req.admin, u, { days, reason: req.body?.reason });
    res.json(userRow(store.get('users', u.id)));
  });
  app.post('/api/admin/users/:id/unban', adminAuth, (req, res) => {
    const u = store.get('users', req.params.id);
    if (!u) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    store.update('users', u.id, { status: 'active', bannedUntil: null, banReason: null });
    audit(req.admin, 'yasağı kaldırdı', u.id, req.body?.note);
    res.json(userRow(u));
  });
  app.post('/api/admin/users/:id/warn', adminAuth, (req, res) => {
    const u = store.get('users', req.params.id);
    const text = String(req.body?.text || '').trim().slice(0, 300);
    if (!u || !text) return res.status(400).json({ error: 'Uyarı metni boş olamaz.' });
    notify(u.id, { type: 'warning', text: `⚠️ SwipeUp ekibinden uyarı: ${text}`, title: 'SwipeUp', url: '/#/notifications' });
    audit(req.admin, 'uyarı gönderdi', u.id, text);
    res.json({ ok: true });
  });
  app.post('/api/admin/users/:id/role', adminAuth, (req, res) => {
    const u = store.get('users', req.params.id);
    const role = ['falci', null, ''].includes(req.body?.role) ? (req.body.role || null) : undefined;
    if (!u || role === undefined) return res.status(400).json({ error: 'Geçersiz rol.' });
    store.update('users', u.id, { role });
    audit(req.admin, role ? `rol verdi: ${role}` : 'rolü kaldırdı', u.id);
    res.json(userRow(u));
  });
  app.post('/api/admin/users/:id/password', adminAuth, async (req, res) => {
    const u = store.get('users', req.params.id);
    if (!u) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    const temp = crypto.randomBytes(6).toString('base64url');
    store.update('users', u.id, { passHash: await bcrypt.hash(temp, 10), ...(u.role === 'falci' ? { passChangedByUser: true } : {}) });
    audit(req.admin, 'şifre sıfırladı', u.id);
    res.json({ password: temp });
  });
  app.delete('/api/admin/users/:id', adminAuth, owner, (req, res) => {
    const u = store.get('users', req.params.id);
    if (!u) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    if (u.role === 'falci') return res.status(400).json({ error: 'Falcı Teyze hesabı silinemez.' });
    kickSockets(u.id, { reason: 'Hesap silindi' });
    const id = u.id;
    store.filter('posts', (p) => p.userId === id).forEach((p) => store.del('posts', p.id));
    store.filter('stories', (s) => s.userId === id).forEach((s) => store.del('stories', s.id));
    ['follows', 'swipes', 'blocks'].forEach((c) => store.filter(c, (x) => x.from === id || x.to === id).forEach((x) => store.del(c, x.id)));
    store.filter('matches', (m) => m.users.includes(id)).forEach((m) => store.del('matches', m.id));
    store.filter('chats', (c) => !c.isGroup && c.members.includes(id)).forEach((c) => removeChat(c.id));
    store.filter('chats', (c) => c.isGroup && c.members.includes(id)).forEach((c) => store.update('chats', c.id, { members: c.members.filter((m) => m !== id) }));
    store.filter('notifications', (n) => n.userId === id || n.fromId === id).forEach((n) => store.del('notifications', n.id));
    store.filter('pushSubs', (s) => s.userId === id).forEach((s) => store.del('pushSubs', s.id));
    store.del('users', id);
    audit(req.admin, 'hesabı sildi', id, `@${u.username}`);
    res.json({ ok: true });
  });

  // ---------- Şikayetler ----------
  app.get('/api/admin/reports', adminAuth, (req, res) => {
    const st = String(req.query.status || 'open');
    const list = store.filter('reports', (r) => st === 'all' || r.status === st).sort((a, b) => b.at - a.at).slice(0, 300);
    res.json(list.map((r) => ({
      ...r, fromUser: brief(store.get('users', r.from)), toUser: store.get('users', r.to) ? userRow(store.get('users', r.to)) : null,
      content: contentOf(r.ref), sameTarget: store.filter('reports', (x) => x.to === r.to).length,
    })));
  });
  app.post('/api/admin/reports/:id', adminAuth, (req, res) => {
    const r = store.get('reports', req.params.id);
    if (!r) return res.status(404).json({ error: 'Şikayet bulunamadı.' });
    const action = String(req.body?.action || 'dismiss');
    const note = String(req.body?.note || '').slice(0, 500);
    const target = store.get('users', r.to);
    let did = 'yoksaydı';
    if (action === 'delete' && r.ref) { deleteContent(r.ref); did = 'içeriği sildi'; }
    if (action === 'warn' && target) {
      notify(target.id, { type: 'warning', text: `⚠️ Hakkında gelen bir şikayet incelendi. ${note || 'Lütfen topluluk kurallarına uy.'}`, title: 'SwipeUp', url: '/#/notifications' });
      did = 'uyardı';
    }
    if ((action === 'suspend' || action === 'ban') && target) {
      banUser(req.admin, target, { days: action === 'suspend' ? Math.max(1, parseInt(req.body?.days, 10) || 7) : null, reason: note || `Şikayet: ${r.reason}` });
      did = action === 'suspend' ? 'askıya aldı' : 'yasakladı';
    }
    store.update('reports', r.id, { status: action === 'dismiss' ? 'dismissed' : 'resolved', resolution: did, note, resolvedBy: req.admin.username, resolvedAt: now() });
    if (r.from && action !== 'dismiss') notify(r.from, { type: 'report', text: 'Gönderdiğin şikayet incelendi ve gerekli işlem yapıldı. Teşekkürler.', title: 'SwipeUp', url: '/#/notifications' });
    audit(req.admin, `şikayet: ${did}`, r.to, note);
    res.json({ ok: true });
  });

  // ---------- İtirazlar ----------
  app.get('/api/admin/appeals', adminAuth, (req, res) => {
    const st = String(req.query.status || 'open');
    res.json(store.filter('appeals', (a) => st === 'all' || a.status === st).sort((a, b) => b.at - a.at).slice(0, 300)
      .map((a) => ({ ...a, user: store.get('users', a.userId) ? userRow(store.get('users', a.userId)) : null })));
  });
  app.post('/api/admin/appeals/:id', adminAuth, (req, res) => {
    const a = store.get('appeals', req.params.id);
    if (!a || a.status !== 'open') return res.status(404).json({ error: 'İtiraz bulunamadı.' });
    const accept = !!req.body?.accept;
    const note = String(req.body?.note || '').slice(0, 500);
    store.update('appeals', a.id, { status: accept ? 'accepted' : 'rejected', note, decidedBy: req.admin.username, decidedAt: now() });
    if (accept) store.update('users', a.userId, { status: 'active', bannedUntil: null, banReason: null });
    audit(req.admin, accept ? 'itirazı kabul etti' : 'itirazı reddetti', a.userId, note);
    res.json({ ok: true });
  });

  // ---------- Gelir / gider (yönetici verisi) ----------
  app.get('/api/admin/ledger', adminAuth, (req, res) => {
    const from = req.query.from ? new Date(req.query.from).getTime() : 0;
    const to = req.query.to ? new Date(req.query.to).getTime() + DAY : Infinity;
    const list = store.filter('adm_ledger', (l) => { const t = new Date(l.date).getTime(); return t >= from && t < to; })
      .sort((a, b) => (b.date.localeCompare(a.date)) || (b.createdAt - a.createdAt));
    const byMonth = {};
    store.all('adm_ledger').forEach((l) => {
      const k = l.date.slice(0, 7);
      byMonth[k] = byMonth[k] || { gelir: 0, gider: 0 };
      byMonth[k][l.type] += l.amount;
    });
    res.json({ items: list, categories: CATS, byMonth });
  });
  const cleanEntry = (b) => {
    const type = b.type === 'gider' ? 'gider' : 'gelir';
    const amount = Math.round(Math.abs(parseFloat(String(b.amount).replace(',', '.'))) * 100) / 100;
    if (!amount) throw new Error('Tutar gir.');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : new Date().toISOString().slice(0, 10);
    return { type, amount, date, category: String(b.category || 'Diğer').slice(0, 40), note: String(b.note || '').slice(0, 300), currency: 'TRY' };
  };
  app.post('/api/admin/ledger', adminAuth, (req, res) => {
    try {
      const e = store.put('adm_ledger', { id: nanoid(10), ...cleanEntry(req.body || {}), by: req.admin.username, createdAt: now() });
      audit(req.admin, `${e.type} ekledi`, null, `${e.amount} ₺ · ${e.category}`);
      res.json(e);
    } catch (er) { res.status(400).json({ error: er.message }); }
  });
  app.put('/api/admin/ledger/:id', adminAuth, (req, res) => {
    const e = store.get('adm_ledger', req.params.id);
    if (!e) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
    try { store.update('adm_ledger', e.id, { ...cleanEntry(req.body || {}), editedBy: req.admin.username, editedAt: now() }); audit(req.admin, 'gelir/gider düzenledi', null, e.id); res.json(e); } catch (er) { res.status(400).json({ error: er.message }); }
  });
  app.delete('/api/admin/ledger/:id', adminAuth, (req, res) => {
    const e = store.get('adm_ledger', req.params.id);
    if (!e) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
    store.del('adm_ledger', e.id);
    audit(req.admin, 'gelir/gider sildi', null, `${e.type} ${e.amount} ₺ · ${e.category}`);
    res.json({ ok: true });
  });

  // ---------- İçerik ----------
  app.get('/api/admin/content', adminAuth, (req, res) => {
    const kind = String(req.query.kind || 'posts');
    if (kind === 'stories') {
      return res.json(store.filter('stories', (s) => now() - s.at < DAY).sort((a, b) => b.at - a.at).slice(0, 120)
        .map((s) => ({ id: s.id, kind: 'story', media: s.media, mediaType: s.mediaType, at: s.at, user: brief(store.get('users', s.userId)), views: s.viewers.length })));
    }
    res.json(store.all('posts').sort((a, b) => b.createdAt - a.createdAt).slice(0, 150)
      .map((p) => ({ id: p.id, kind: 'post', type: p.type, media: p.media, poster: p.poster, caption: p.caption, at: p.createdAt, likes: p.likes.length, comments: p.comments.length, user: brief(store.get('users', p.userId)) })));
  });
  app.delete('/api/admin/content/:id', adminAuth, (req, res) => {
    const kind = deleteContent(req.params.id);
    if (!kind || kind === 'gone') return res.status(404).json({ error: 'İçerik bulunamadı.' });
    audit(req.admin, `içerik sildi (${kind})`, null, req.params.id);
    res.json({ ok: true });
  });

  // ---------- Fal ----------
  app.get('/api/admin/fal', adminAuth, (req, res) => {
    const list = store.filter('messages', (m) => m.fal).sort((a, b) => b.at - a.at);
    const answered = list.filter((m) => m.fal.status === 'answered' && m.fal.answeredAt);
    const avgMin = answered.length ? Math.round(answered.reduce((a, m) => a + (m.fal.answeredAt - m.at), 0) / answered.length / 60000) : null;
    const byType = list.reduce((a, m) => ((a[m.fal.type] = (a[m.fal.type] || 0) + 1), a), {});
    res.json({
      total: list.length, pending: list.length - answered.length, avgMin, byType,
      items: list.slice(0, 100).map((m) => ({ ...m.fal, user: brief(store.get('users', m.from)), at: m.at })),
    });
  });

  // ---------- Duyurular ----------
  app.get('/api/admin/announcements', adminAuth, (req, res) => res.json(store.all('adm_announcements').sort((a, b) => b.at - a.at)));
  app.post('/api/admin/announcements', adminAuth, (req, res) => {
    const text = String(req.body?.text || '').trim().slice(0, 300);
    if (!text) return res.status(400).json({ error: 'Duyuru metni boş olamaz.' });
    const users = store.filter('users', (u) => statusOf(u) === 'active');
    users.forEach((u) => notify(u.id, { type: 'announce', text: `📣 ${text}`, title: 'SwipeUp', url: '/#/notifications', tag: 'announce' }));
    const a = store.put('adm_announcements', { id: nanoid(10), text, by: req.admin.username, at: now(), reach: users.length });
    audit(req.admin, 'duyuru gönderdi', null, text);
    res.json(a);
  });

  // ---------- Notlar ----------
  app.get('/api/admin/notes', adminAuth, (req, res) => res.json(store.all('adm_notes').sort((a, b) => (b.pinned - a.pinned) || (b.at - a.at))));
  app.post('/api/admin/notes', adminAuth, (req, res) => {
    const text = String(req.body?.text || '').trim().slice(0, 2000);
    if (!text) return res.status(400).json({ error: 'Not boş olamaz.' });
    res.json(store.put('adm_notes', { id: nanoid(10), text, by: req.admin.username, at: now(), pinned: false }));
  });
  app.patch('/api/admin/notes/:id', adminAuth, (req, res) => {
    const n = store.get('adm_notes', req.params.id);
    if (!n) return res.status(404).json({ error: 'Not bulunamadı.' });
    res.json(store.update('adm_notes', n.id, { pinned: !!req.body?.pinned }));
  });
  app.delete('/api/admin/notes/:id', adminAuth, (req, res) => { store.del('adm_notes', req.params.id); res.json({ ok: true }); });

  // ---------- Kayıtlar ve yöneticiler ----------
  app.get('/api/admin/audit', adminAuth, (req, res) => {
    res.json(store.all('adm_audit').sort((a, b) => b.at - a.at).slice(0, 300)
      .map((x) => ({ ...x, targetUser: x.target ? brief(store.get('users', x.target)) : null })));
  });
  app.get('/api/admin/admins', adminAuth, (req, res) => res.json(store.all('adm_admins').map(adminOut)));
  app.post('/api/admin/admins', adminAuth, owner, async (req, res) => {
    const username = String(req.body?.username || '').toLowerCase().trim();
    const password = String(req.body?.password || '');
    if (!/^[a-z0-9._]{3,24}$/.test(username)) return res.status(400).json({ error: 'Kullanıcı adı geçersiz.' });
    if (password.length < 8) return res.status(400).json({ error: 'Şifre en az 8 karakter olmalı.' });
    if (store.find('adm_admins', (a) => a.username === username)) return res.status(409).json({ error: 'Bu kullanıcı adı alınmış.' });
    const a = store.put('adm_admins', { id: nanoid(10), username, name: String(req.body?.name || username).slice(0, 40), role: 'admin', passHash: await bcrypt.hash(password, 10), createdAt: now() });
    audit(req.admin, 'yönetici ekledi', null, username);
    res.json(adminOut(a));
  });
  app.delete('/api/admin/admins/:id', adminAuth, owner, (req, res) => {
    const a = store.get('adm_admins', req.params.id);
    if (!a || a.role === 'owner') return res.status(400).json({ error: 'Sahip yönetici silinemez.' });
    store.del('adm_admins', a.id);
    audit(req.admin, 'yönetici sildi', null, a.username);
    res.json({ ok: true });
  });

  return { statusOf, ensureAdmin: ctx.ensureAdmin };
};

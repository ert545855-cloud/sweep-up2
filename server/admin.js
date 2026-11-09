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
  gider: ['Sunucu', 'Alan adı', 'Reklam ve pazarlama', 'Maaş', 'Yayıncı / falcı ödemesi', 'Yazılım', 'Vergi', 'Diğer'],
};

module.exports = function mountAdmin(app, ctx) {
  const { store, io, emitTo, notify, brief, isOnline, online, removeChat, limited, ipOf, secret, eco } = ctx;
  const SECRET = () => secret() + ':admin';
  const now = () => Date.now();

  // ---------- Yardımcılar ----------
  const audit = (admin, action, target, detail) => store.put('adm_audit', {
    id: nanoid(12), adminId: admin.id, admin: admin.username, action, target: target || null, detail: detail || '', at: now(),
  });
  const PERM = require('./perms');
  const adminOut = (a) => ({ id: a.id, username: a.username, name: a.name, role: a.role === 'owner' ? 'owner' : 'moderator', perms: PERM.permsOf(a), disabled: !!a.disabled, createdAt: a.createdAt, lastLogin: a.lastLogin || null });
  const userRow = (u) => ({
    ...brief(u), tags: u.tags || [], email: u.email || null, age: u.age, city: u.city, status: statusOf(u), coins: u.coins || 0, earnings: u.earnings || 0, plusUntil: u.plusUntil || null, birthdate: u.birthdate || null, banReason: u.banReason || null, bannedUntil: u.bannedUntil || null,
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
  const contentOf = (ref, r) => {
    if (!ref) return null;
    if (r?.refKind === 'comment') {
      const p = store.get('posts', r.postId);
      const c = p?.comments.find((x) => x.id === ref);
      return c ? { kind: 'comment', id: c.id, postId: p.id, text: c.text } : { kind: 'gone', id: ref, text: r.snapshot?.text };
    }
    const p = store.get('posts', ref);
    if (p) return { kind: 'post', id: p.id, type: p.type, media: p.media, poster: p.poster, caption: p.caption };
    const m = store.get('messages', ref);
    if (m) return { kind: 'message', id: m.id, text: m.deleted ? '(silindi)' : m.text, media: m.deleted ? null : m.media, mediaType: m.mediaType };
    const s = store.get('stories', ref);
    if (s) return { kind: 'story', id: s.id, media: s.media, mediaType: s.mediaType };
    const g = store.get('pub_msgs', ref);
    if (g) return { kind: 'genel', id: g.id, text: g.deleted ? '(silindi)' : g.text, media: g.deleted ? null : g.media, mediaType: g.mediaType };
    return { kind: 'gone', id: ref, text: r?.snapshot?.text };
  };
  const deleteContent = (ref, r) => {
    const c = contentOf(ref, r);
    if (!c) return null;
    if (c.kind === 'comment') {
      const p = store.get('posts', c.postId);
      store.update('posts', p.id, { comments: p.comments.filter((x) => x.id !== ref) });
    }
    if (c.kind === 'post') store.del('posts', ref);
    if (c.kind === 'story') { store.del('stories', ref); io.emit('stories:update', {}); }
    if (c.kind === 'genel') {
      const g = store.get('pub_msgs', ref);
      Object.assign(g, { deleted: true, text: '', media: null, reactions: {} });
      store.update('pub_msgs', g.id, {});
      io.to('genel').emit('genel:update', { ...g, user: brief(store.get('users', g.userId)) });
    }
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
    } catch { return res.status(401).json({ error: 'Oturum süresi doldu, tekrar giriş yap.' }); }
    // Yetki kontrolü
    const need = PERM.needPerm(req.method, req.originalUrl);
    req.adminPerms = PERM.permsOf(req.admin);
    req.permNeed = need;
    if (need && !req.adminPerms.includes(need)) return res.status(403).json({ error: need === 'owner' ? 'Bu işlem sadece sahip yöneticiye açık.' : 'Bu bölüm için yetkin yok. Sahip yöneticiden yetki iste.', perm: need });
    next();
  }
  // Önceden sahibe özel işlemler: sahip ya da o bölümün yetkisi verilmiş moderatör
  const owner = (req, res, next) => (req.admin.role === 'owner' || (req.permNeed && req.permNeed !== 'owner' && req.adminPerms?.includes(req.permNeed)) ? next() : res.status(403).json({ error: 'Bu işlem sadece sahip yöneticiye açık.' }));

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
    // Günler Türkiye saatine göre (UTC+3) — sunucu hangi saat diliminde çalışırsa çalışsın
    const TRO = 3 * 3600000;
    const start = (() => { const d = new Date(t + TRO); d.setUTCHours(0, 0, 0, 0); return d.getTime() - TRO; })();
    const series = (arr, field = 'at') => Array.from({ length: days }, (_, i) => {
      const d0 = start - (days - 1 - i) * DAY;
      return { day: new Date(d0 + TRO).toISOString().slice(0, 10), n: arr.filter((x) => x[field] >= d0 && x[field] < d0 + DAY).length };
    });
    const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
    const ledger = store.filter('adm_ledger', (l) => new Date(l.date).getTime() >= month.getTime());
    const sum = (type) => ledger.filter((l) => l.type === type).reduce((a, l) => a + l.amount, 0);
    const falMsgs = store.filter('messages', (m) => m.fal);
    res.json({
      users: users.length,
      newToday: users.filter((u) => u.createdAt >= start).length,
      new7: users.filter((u) => u.createdAt >= t - 7 * DAY).length,
      online: users.filter((u) => isOnline(u.id)).length,
      active24: users.filter((u) => (u.lastSeen || 0) >= t - DAY || isOnline(u.id)).length,
      banned: users.filter((u) => statusOf(u) !== 'active').length,
      messagesToday: msgs.filter((m) => m.at >= start).length,
      matches: store.all('matches').length,
      posts: store.all('posts').length,
      stories: store.filter('stories', (s) => t - s.at < DAY).length,
      falPending: falMsgs.filter((m) => m.fal.status === 'pending').length,
      falTotal: falMsgs.length,
      reportsOpen: store.filter('reports', (r) => r.status === 'open').length,
      appealsOpen: store.filter('appeals', (a) => a.status === 'open').length,
      ordersOpen: store.filter('orders', (o) => o.status === 'paid' || o.status === 'pending').length,
      ordersPaid: store.filter('orders', (o) => o.status === 'paid').length,
      verifyOpen: store.filter('verifications', (v) => v.status === 'pending').length,
      flagsOpen: store.filter('flags', (f) => f.status === 'open').length,
      payoutsOpen: store.filter('payouts', (p) => p.status === 'pending').length,
      maintenance: store.get('settings', 'maintenance')?.on ? 1 : 0,
      supportOpen: store.filter('support', (s) => s.status === 'open').length,
      songsPending: store.filter('songs', (s) => s.status === 'pending').length,
      marketOpen: store.filter('mk_orders', (o) => ['odeme_kontrol', 'sorunlu', 'iade_bekliyor'].includes(o.status)).length,
      plusUsers: users.filter((u) => (u.plusUntil || 0) > t).length,
      verifiedUsers: users.filter((u) => u.verified).length,
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
    store.update('users', u.id, { passHash: await bcrypt.hash(temp, 10), ...(['falci', 'official'].includes(u.role) ? { passChangedByUser: true } : {}) });
    audit(req.admin, 'şifre sıfırladı', u.id);
    res.json({ password: temp });
  });
  app.delete('/api/admin/users/:id', adminAuth, owner, (req, res) => {
    const u = store.get('users', req.params.id);
    if (!u) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    if (u.role === 'falci') return res.status(400).json({ error: 'Falcı Teyze hesabı silinemez.' });
    if (u.role === 'official') return res.status(400).json({ error: 'SwipeUp yönetim hesabı silinemez.' });
    kickSockets(u.id, { reason: 'Hesap silindi' });
    const id = u.id;
    ctx.purgeUser(id);
    audit(req.admin, 'hesabı sildi', id, `@${u.username}`);
    res.json({ ok: true });
  });

  // ---------- Şikayetler ----------
  app.get('/api/admin/reports', adminAuth, (req, res) => {
    const st = String(req.query.status || 'open');
    const list = store.filter('reports', (r) => st === 'all' || r.status === st).sort((a, b) => b.at - a.at).slice(0, 300);
    res.json(list.map((r) => ({
      ...r, fromUser: brief(store.get('users', r.from)), toUser: store.get('users', r.to) ? userRow(store.get('users', r.to)) : null,
      content: contentOf(r.ref, r), snapshot: r.snapshot || null, refKind: r.refKind || null, sameTarget: store.filter('reports', (x) => x.to === r.to).length,
    })));
  });
  app.post('/api/admin/reports/:id', adminAuth, (req, res) => {
    const r = store.get('reports', req.params.id);
    if (!r) return res.status(404).json({ error: 'Şikayet bulunamadı.' });
    const action = String(req.body?.action || 'dismiss');
    const note = String(req.body?.note || '').slice(0, 500);
    const target = store.get('users', r.to);
    let did = 'yoksaydı';
    if (action === 'delete' && r.ref) { deleteContent(r.ref, r); did = 'içeriği sildi'; }
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
    return { type, amount, date, category: String(b.category || 'Diğer').slice(0, 40), note: String(b.note || '').slice(0, 300), currency: 'TRY', ...(b.accountId !== undefined ? { accountId: b.accountId ? String(b.accountId).slice(0, 20) : null } : {}) };
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
    const f = store.find('users', (u) => u.role === 'falci');
    const falTx = store.filter('coin_tx', (x) => x.reason === 'fal');
    const s = eco.get();
    res.json({
      total: list.length, pending: list.length - answered.length, avgMin, byType,
      prices: s.falPrices, share: s.falciShare, coinTL: s.coinTL,
      falci: f ? {
        ...brief(f), balance: f.earnings || 0, total: f.earnedTotal || 0,
        balanceTL: +((f.earnings || 0) * s.coinTL).toFixed(2), totalTL: +((f.earnedTotal || 0) * s.coinTL).toFixed(2),
      } : null,
      paidCount: falTx.length, coinsSpent: falTx.reduce((a, x) => a - x.delta, 0),
      items: list.slice(0, 100).map((m) => ({ ...m.fal, user: brief(store.get('users', m.from)), at: m.at })),
    });
  });

  // ---------- Duyurular ----------
  app.get('/api/admin/announcements', adminAuth, (req, res) => res.json(store.all('adm_announcements').sort((a, b) => b.at - a.at)));
  // Hedef kitleye göre kullanıcılar
  const AUDIENCES = { all: 'Herkes', online: 'Şu an çevrimiçi olanlar', plus: 'SwipeUp+ üyeleri', free: 'Ücretsiz üyeler', verified: 'Mavi tikliler', new7: 'Son 7 günde katılanlar', inactive: '7 gündür girmeyenler', city: 'Şehre göre', user: 'Tek kullanıcı', custom: 'Özel kitle' };
  // Özel kitle: filtreler birlikte uygulanır (ör. İstanbul + 18–25 yaş + 7 gündür girmeyenler)
  const ageOfU = (u) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(u.birthdate || '')); if (!m) return Number.isFinite(u.age) ? u.age : null; const t = new Date(); let a = t.getFullYear() - +m[1]; if (t.getMonth() + 1 < +m[2] || (t.getMonth() + 1 === +m[2] && t.getDate() < +m[3])) a--; return a; };
  const ZOD = require('./engage').ZODIAC; const zodOf = (u) => (u.zodiac && ZOD[u.zodiac] ? u.zodiac : require('./engage').zodiacFromDate(u.birthdate));
  const GENDER = { k: 'Kadın', e: 'Erkek', d: 'Diğer' };
  function customFilter(list, f = {}) {
    const t = now(); const lbl = [];
    const n = (v) => { const x = parseInt(v, 10); return Number.isFinite(x) && x >= 0 ? x : null; };
    const cities = String(f.city || '').split(',').map((c) => c.toLocaleLowerCase('tr-TR').trim()).filter(Boolean);
    if (cities.length) { list = list.filter((u) => cities.some((c) => (u.city || '').toLocaleLowerCase('tr-TR').includes(c))); lbl.push(cities.map((c) => c[0].toLocaleUpperCase('tr-TR') + c.slice(1)).join('/')); }
    const amin = n(f.ageMin); const amax = n(f.ageMax);
    if (amin != null || amax != null) { list = list.filter((u) => { const a = ageOfU(u); return a != null && (amin == null || a >= amin) && (amax == null || a <= amax); }); lbl.push(`${amin ?? 18}–${amax ?? '99'} yaş`); }
    if (GENDER[f.gender]) { list = list.filter((u) => u.gender === f.gender); lbl.push(GENDER[f.gender]); }
    const ina = n(f.inactiveDays); if (ina) { list = list.filter((u) => !isOnline(u.id) && (u.lastSeen || u.createdAt || 0) < t - ina * DAY); lbl.push(`${ina} gündür girmeyen`); }
    const act = n(f.activeDays); if (act) { list = list.filter((u) => isOnline(u.id) || (u.lastSeen || 0) >= t - act * DAY); lbl.push(`son ${act} günde aktif`); }
    const nw = n(f.newDays); if (nw) { list = list.filter((u) => u.createdAt >= t - nw * DAY); lbl.push(`son ${nw} günde katılan`); }
    if (f.plan === 'plus') { list = list.filter((u) => (u.plusUntil || 0) > t); lbl.push('SwipeUp+'); }
    if (f.plan === 'free') { list = list.filter((u) => !((u.plusUntil || 0) > t)); lbl.push('ücretsiz'); }
    if (f.verified === 'yes') { list = list.filter((u) => u.verified); lbl.push('mavi tikli'); }
    if (f.verified === 'no') { list = list.filter((u) => !u.verified); lbl.push('tiksiz'); }
    const it = String(f.interest || '').toLocaleLowerCase('tr-TR').trim(); if (it) { list = list.filter((u) => (u.interests || []).some((x) => String(x).toLocaleLowerCase('tr-TR').includes(it))); lbl.push(`ilgi: ${f.interest}`); }
    if (ZOD[f.zodiac]) { list = list.filter((u) => zodOf(u) === f.zodiac); lbl.push(ZOD[f.zodiac][0]); }
    if (f.push === 'yes') { list = list.filter((u) => store.find('pushSubs', (x) => x.userId === u.id)); lbl.push('push açık'); }
    if (n(f.minCoins)) { list = list.filter((u) => (u.coins || 0) >= n(f.minCoins)); lbl.push(`${n(f.minCoins)}+ jeton`); }
    return { list, label: lbl.join(' · ') || 'filtre yok' };
  }
  function audienceOf(b) {
    const t = now();
    let list = store.filter('users', (u) => statusOf(u) === 'active');
    const aud = AUDIENCES[b.audience] ? b.audience : 'all';
    if (aud === 'online') list = list.filter((u) => isOnline(u.id));
    if (aud === 'plus') list = list.filter((u) => (u.plusUntil || 0) > t);
    if (aud === 'free') list = list.filter((u) => !((u.plusUntil || 0) > t));
    if (aud === 'verified') list = list.filter((u) => u.verified);
    if (aud === 'new7') list = list.filter((u) => u.createdAt >= t - 7 * DAY);
    if (aud === 'inactive') list = list.filter((u) => !isOnline(u.id) && (u.lastSeen || 0) < t - 7 * DAY);
    if (aud === 'city') { const c = String(b.city || '').toLocaleLowerCase('tr-TR').trim(); list = c ? list.filter((u) => (u.city || '').toLocaleLowerCase('tr-TR').includes(c)) : []; }
    if (aud === 'user') { const un = String(b.username || '').replace(/^@/, '').toLowerCase().trim(); list = list.filter((u) => u.username === un); }
    let label = '';
    if (aud === 'custom') { const r = customFilter(list.filter((u) => !['falci', 'official'].includes(u.role)), b.filters || {}); list = r.list; label = r.label; }
    return { aud, list, label };
  }
  const LINKS = ['/#/', '/#/notifications', '/#/store', '/#/genel', '/#/fal', '/#/vitrin', '/#/dalga', '/#/swipe', '/#/create', '/#/verify', '/#/live', '/#/secki', '/#/soru', '/#/kulupler', '/#/seriler', '/#/karaoke', '/#/gorevler'];
  app.post('/api/admin/announcements/preview', adminAuth, (req, res) => {
    const { list } = audienceOf(req.body || {});
    res.json({ count: list.length, push: list.filter((u) => store.find('pushSubs', (x) => x.userId === u.id)).length, online: list.filter((u) => isOnline(u.id)).length, sample: list.slice(0, 5).map((u) => u.username) });
  });
  app.post('/api/admin/announcements', adminAuth, (req, res) => {
    const b = req.body || {};
    const text = String(b.text || '').trim().slice(0, 300);
    const title = String(b.title || '').trim().slice(0, 60) || 'SwipeUp';
    if (!text) return res.status(400).json({ error: 'Bildirim metni boş olamaz.' });
    const url = LINKS.includes(b.url) ? b.url : '/#/notifications';
    const popup = !!b.popup;
    const { aud, list, label } = audienceOf(b);
    if (!list.length) return res.status(400).json({ error: 'Bu hedef kitlede kimse yok.' });
    if (list.length > 1 && limited('ann:' + req.admin.id, 10, DAY)) return res.status(429).json({ error: 'Bugün çok fazla toplu bildirim gönderildi.' });
    const id = nanoid(10);
    const pushCount = list.filter((u) => store.find('pushSubs', (x) => x.userId === u.id)).length;
    list.forEach((u) => {
      notify(u.id, { type: 'announce', text: `📣 ${text}`, title, url, tag: 'announce-' + id });
      if (popup) emitTo(u.id, 'announce:popup', { id, title, text, url });
    });
    if (popup) store.put('settings', { id: 'popup', annId: id, title, text, url, at: now(), users: aud === 'all' ? null : list.map((u) => u.id), until: now() + 7 * DAY });
    const a = store.put('adm_announcements', {
      id, title, text, url, popup, audience: aud, audienceLabel: AUDIENCES[aud] + (aud === 'city' ? `: ${b.city}` : aud === 'user' ? `: @${b.username}` : aud === 'custom' ? `: ${label}` : ''), filters: aud === 'custom' ? b.filters || {} : undefined,
      by: req.admin.username, at: now(), reach: list.length, pushReach: pushCount, online: list.filter((u) => isOnline(u.id)).length,
    });
    audit(req.admin, 'bildirim gönderdi', aud === 'user' ? list[0].id : null, `${a.audienceLabel} · ${text}`);
    res.json(a);
  });
  app.delete('/api/admin/announcements/popup', adminAuth, (req, res) => { store.del('settings', 'popup'); audit(req.admin, 'açılış duyurusunu kaldırdı'); res.json({ ok: true }); });

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
  app.get('/api/admin/admins', adminAuth, (req, res) => res.json({ items: store.all('adm_admins').map(adminOut), perms: PERM.PERMS, modDefault: PERM.MOD_DEFAULT }));
  app.put('/api/admin/admins/:id', adminAuth, owner, (req, res) => {
    const a = store.get('adm_admins', req.params.id);
    if (!a) return res.status(404).json({ error: 'Yönetici bulunamadı.' });
    const b = req.body || {};
    const patch = {};
    if (b.name !== undefined) patch.name = String(b.name || a.username).slice(0, 40);
    if (b.role !== undefined) {
      const role = b.role === 'owner' ? 'owner' : 'moderator';
      if (a.role === 'owner' && role !== 'owner' && store.filter('adm_admins', (x) => x.role === 'owner' && !x.disabled).length <= 1) return res.status(400).json({ error: 'En az bir sahip yönetici kalmalı.' });
      patch.role = role;
    }
    if (Array.isArray(b.perms)) patch.perms = b.perms.filter((p) => PERM.ALL.includes(p));
    if (b.disabled !== undefined) {
      if (a.id === req.admin.id) return res.status(400).json({ error: 'Kendi hesabını kapatamazsın.' });
      patch.disabled = !!b.disabled;
    }
    store.update('adm_admins', a.id, patch);
    audit(req.admin, 'yönetici yetkilerini değiştirdi', null, `${a.username}: ${patch.role || a.role} · ${(patch.perms || PERM.permsOf(a)).length} yetki${patch.disabled ? ' · kapatıldı' : ''}`);
    res.json(adminOut(store.get('adm_admins', a.id)));
  });
  app.post('/api/admin/admins/:id/password', adminAuth, owner, async (req, res) => {
    const a = store.get('adm_admins', req.params.id);
    if (!a) return res.status(404).json({ error: 'Yönetici bulunamadı.' });
    const password = String(req.body?.password || '');
    if (password.length < 8) return res.status(400).json({ error: 'Şifre en az 8 karakter olmalı.' });
    store.update('adm_admins', a.id, { passHash: await bcrypt.hash(password, 10), passChanged: true });
    audit(req.admin, 'yönetici şifresini sıfırladı', null, a.username);
    res.json({ ok: true });
  });
  app.post('/api/admin/admins', adminAuth, owner, async (req, res) => {
    const username = String(req.body?.username || '').toLowerCase().trim();
    const password = String(req.body?.password || '');
    if (!/^[a-z0-9._]{3,24}$/.test(username)) return res.status(400).json({ error: 'Kullanıcı adı geçersiz.' });
    if (password.length < 8) return res.status(400).json({ error: 'Şifre en az 8 karakter olmalı.' });
    if (store.find('adm_admins', (a) => a.username === username)) return res.status(409).json({ error: 'Bu kullanıcı adı alınmış.' });
    const role = req.body?.role === 'owner' ? 'owner' : 'moderator';
    const perms = Array.isArray(req.body?.perms) ? req.body.perms.filter((p) => PERM.ALL.includes(p)) : PERM.MOD_DEFAULT;
    const a = store.put('adm_admins', { id: nanoid(10), username, name: String(req.body?.name || username).slice(0, 40), role, perms, passHash: await bcrypt.hash(password, 10), createdAt: now() });
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


  // ================= Ekonomi: ayarlar, siparişler, ödemeler =================
  app.get('/api/admin/economy', adminAuth, (req, res) => res.json(eco.get()));
  app.put('/api/admin/economy', adminAuth, owner, (req, res) => {
    const b = req.body || {};
    const n = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, +v)) : d);
    const cur = eco.get();
    const patch = {};
    if (b.bank) {
      const iban = String(b.bank.iban || '').replace(/\s+/g, '').toUpperCase();
      if (iban && !/^TR\d{24}$/.test(iban)) return res.status(400).json({ error: 'IBAN geçersiz (TR ile başlayan 26 karakter).' });
      patch.bank = { iban, name: String(b.bank.name || '').slice(0, 80), bankName: String(b.bank.bankName || '').slice(0, 60), note: String(b.bank.note || '').slice(0, 200) };
    }
    if (Array.isArray(b.coinPacks)) patch.coinPacks = b.coinPacks.slice(0, 6).map((p, i) => ({ id: String(p.id || `c${i}`).slice(0, 12), coins: n(p.coins, 1, 100000, 100) | 0, price: n(p.price, 0.01, 100000, 10), tag: String(p.tag || '').slice(0, 20) || undefined }));
    if (Array.isArray(b.plusPlans)) patch.plusPlans = b.plusPlans.slice(0, 4).map((p, i) => ({ id: String(p.id || `p${i}`).slice(0, 12), days: n(p.days, 1, 3650, 30) | 0, price: n(p.price, 0.01, 100000, 10), tag: String(p.tag || '').slice(0, 20) || undefined }));
    if (Array.isArray(b.gifts)) patch.gifts = b.gifts.slice(0, 12).map((g, i) => ({ id: String(g.id || `g${i}`).slice(0, 12), em: String(g.em || '🎁').slice(0, 4), name: String(g.name || 'Hediye').slice(0, 20), coins: n(g.coins, 1, 100000, 10) | 0 }));
    if (b.falPrices) patch.falPrices = Object.fromEntries(['kahve', 'tarot', 'burc', 'uyum', 'ruya'].map((k) => [k, n(b.falPrices[k], 0, 10000, cur.falPrices[k]) | 0]));
    ['boostCoins', 'boostMinutes', 'freeLikes', 'freeSupers', 'plusSupers', 'superMsgCoins', 'inviteCoins', 'falSubCoins'].forEach((k) => { if (b[k] !== undefined) patch[k] = n(b[k], 0, 100000, cur[k]) | 0; });
    ['creatorShare', 'falciShare'].forEach((k) => { if (b[k] !== undefined) patch[k] = n(b[k], 0, 1, cur[k]); });
    if (b.coinTL !== undefined) patch.coinTL = n(b.coinTL, 0, 100, cur.coinTL);
    eco.save(patch);
    audit(req.admin, 'ekonomi ayarlarını güncelledi', null, Object.keys(patch).join(', '));
    res.json(eco.get());
  });

  const orderRow = (o) => ({ ...o, user: store.get('users', o.userId) ? userRow(store.get('users', o.userId)) : null });
  app.get('/api/admin/orders', adminAuth, (req, res) => {
    const st = String(req.query.status || 'open');
    const list = store.filter('orders', (o) => st === 'all' || (st === 'open' ? ['pending', 'paid'].includes(o.status) : o.status === st))
      .sort((a, b) => (b.status === 'paid') - (a.status === 'paid') || b.at - a.at).slice(0, 300);
    const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
    const approved = store.filter('orders', (o) => o.status === 'approved' && o.closedAt >= month.getTime());
    res.json({ items: list.map(orderRow), monthTotal: approved.reduce((a, o) => a + o.amount, 0), monthCount: approved.length });
  });
  app.post('/api/admin/orders/:id', adminAuth, (req, res) => {
    const o = store.get('orders', req.params.id);
    if (!o || !['pending', 'paid'].includes(o.status)) return res.status(404).json({ error: 'Sipariş bulunamadı ya da sonuçlanmış.' });
    const approve = !!req.body?.approve;
    const note = String(req.body?.note || '').slice(0, 300);
    const p = eco.product(o.productId);
    if (approve) {
      if (o.kind === 'coins') eco.addCoins(o.userId, p ? p.coins : parseInt(o.title, 10) || 0, 'purchase', { ref: o.id });
      if (o.kind === 'plus') eco.grantPlus(o.userId, p ? p.days : 30);
      const day = new Date(); const ymd = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      store.put('adm_ledger', {
        id: nanoid(10), type: 'gelir', amount: o.amount, date: ymd, category: o.kind === 'plus' ? 'Abonelik' : 'Uygulama içi satış',
        note: `${o.code} · ${o.title} · @${store.get('users', o.userId)?.username || '?'}${o.sender ? ` · gönderen: ${o.sender}` : ''}`,
        currency: 'TRY', by: req.admin.username, auto: true, orderId: o.id, createdAt: now(),
      });
      notify(o.userId, { type: 'order', text: o.kind === 'plus' ? `✨ Ödemen onaylandı! SwipeUp+ üyeliğin aktif.` : `🪙 Ödemen onaylandı! ${o.title} hesabına eklendi.`, title: 'SwipeUp', url: '/#/store' });
    } else {
      notify(o.userId, { type: 'order', text: `Siparişin (${o.code}) onaylanmadı.${note ? ' ' + note : ' Ödeme bulunamadı.'}`, title: 'SwipeUp', url: '/#/store' });
    }
    store.update('orders', o.id, { status: approve ? 'approved' : 'rejected', note, closedAt: now(), by: req.admin.username });
    emitTo(o.userId, 'wallet', {});
    audit(req.admin, approve ? 'siparişi onayladı' : 'siparişi reddetti', o.userId, `${o.code} · ${o.amount} ₺`);
    res.json({ ok: true });
  });

  app.post('/api/admin/users/:id/grant', adminAuth, (req, res) => {
    const u = store.get('users', req.params.id);
    if (!u) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    const coins = parseInt(req.body?.coins, 10) || 0;
    const days = parseInt(req.body?.plusDays, 10) || 0;
    const note = String(req.body?.note || '').slice(0, 200);
    if (!coins && !days) return res.status(400).json({ error: 'Jeton ya da gün gir.' });
    const pay = req.body?.kind !== 'gift'; // varsayılan: ödeme karşılığı tanımlama
    const amount = Math.max(0, Math.round((+req.body?.amount || 0) * 100) / 100);
    if (coins) eco.addCoins(u.id, coins, pay && coins > 0 ? 'purchase' : 'admin', { note, by: req.admin.username });
    if (days > 0) eco.grantPlus(u.id, days);
    if (days < 0) store.update('users', u.id, { plusUntil: null });
    const parts = [coins && `${coins > 0 ? '+' : ''}${coins} jeton`, days > 0 && `${days} gün SwipeUp+`].filter(Boolean).join(', ');
    if (coins > 0 || days > 0) {
      const text = pay
        ? `✅ Ödemen alındı: ${[coins > 0 && `${coins} jeton`, days > 0 && `${days} günlük SwipeUp+ üyeliği`].filter(Boolean).join(' ve ')} hesabına tanımlandı.${note ? ' ' + note : ''}`
        : `🎁 SwipeUp ekibinden hediye: ${parts}${note ? ' · ' + note : ''}`;
      notify(u.id, { type: 'order', text, title: 'SwipeUp', url: '/#/store' });
    }
    if (pay && amount > 0) {
      const d = new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
      store.put('adm_ledger', { id: nanoid(10), type: 'gelir', amount, date: d, category: days > 0 ? 'Abonelik' : 'Uygulama içi satış', note: `Elle tanımlama · ${parts} · @${u.username}${note ? ` · ${note}` : ''}`, currency: 'TRY', by: req.admin.username, auto: true, createdAt: now() });
    }
    emitTo(u.id, 'wallet', {});
    audit(req.admin, 'jeton/üyelik verdi', u.id, `${parts || 'üyelik kaldırıldı'} ${note}`);
    res.json(userRow(store.get('users', u.id)));
  });

  app.get('/api/admin/payouts', adminAuth, (req, res) => {
    const s = eco.get();
    const earners = store.filter('users', (u) => (u.earnedTotal || 0) > 0).sort((a, b) => (b.earnedTotal || 0) - (a.earnedTotal || 0)).slice(0, 50)
      .map((u) => ({ ...brief(u), balance: u.earnings || 0, total: u.earnedTotal || 0, balanceTL: +((u.earnings || 0) * s.coinTL).toFixed(2) }));
    res.json({
      coinTL: s.coinTL, earners,
      items: store.all('payouts').sort((a, b) => (b.status === 'pending') - (a.status === 'pending') || b.at - a.at).slice(0, 200)
        .map((p) => ({ ...p, user: brief(store.get('users', p.userId)) })),
    });
  });
  app.post('/api/admin/payouts/:id', adminAuth, (req, res) => {
    const p = store.get('payouts', req.params.id);
    if (!p || p.status !== 'pending') return res.status(404).json({ error: 'Talep bulunamadı.' });
    const paid = !!req.body?.paid;
    const note = String(req.body?.note || '').slice(0, 300);
    const u = store.get('users', p.userId);
    if (p.kind === 'store') {
      // Store satıcı ödemesi: emanetteki para satıcıya aktarılır (gelir/gider değildir)
      if (paid) notify(p.userId, { type: 'market', text: `💸 ${p.amount} ₺ Store satış ödemen hesabına gönderildi.`, title: 'SwipeUp Store', url: '/#/market/balance' });
      else {
        if (u) store.update('users', u.id, { mkBalance: Math.round(((u.mkBalance || 0) + p.amount) * 100) / 100 });
        notify(p.userId, { type: 'market', text: `Store ödeme talebin reddedildi, tutar bakiyene geri eklendi.${note ? ' ' + note : ''}`, title: 'SwipeUp Store', url: '/#/market/balance' });
      }
    } else if (paid) {
      const day = new Date(); const ymd = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      store.put('adm_ledger', { id: nanoid(10), type: 'gider', amount: p.amount, date: ymd, category: 'Yayıncı / falcı ödemesi', note: `@${u?.username || '?'} · ${p.coins} jeton · ${p.iban}`, currency: 'TRY', by: req.admin.username, auto: true, createdAt: now() });
      notify(p.userId, { type: 'order', text: `💸 ${p.amount} ₺ kazanç ödemen hesabına gönderildi.`, title: 'SwipeUp', url: '/#/wallet' });
    } else {
      if (u) store.update('users', u.id, { earnings: (u.earnings || 0) + p.coins });
      notify(p.userId, { type: 'order', text: `Ödeme talebin reddedildi, kazancın bakiyene geri eklendi.${note ? ' ' + note : ''}`, title: 'SwipeUp', url: '/#/wallet' });
    }
    store.update('payouts', p.id, { status: paid ? 'paid' : 'rejected', note, closedAt: now(), by: req.admin.username });
    audit(req.admin, paid ? 'kazanç ödemesi yaptı' : 'ödeme talebini reddetti', p.userId, `${p.amount} ₺`);
    res.json({ ok: true });
  });
  // Falcı Teyze gibi platform hesaplarının kazancını elden ödeyip sıfırlama
  app.post('/api/admin/users/:id/settle', adminAuth, owner, (req, res) => {
    const u = store.get('users', req.params.id);
    if (!u || !(u.earnings > 0)) return res.status(400).json({ error: 'Ödenecek kazanç yok.' });
    const s = eco.get();
    const amount = +(u.earnings * s.coinTL).toFixed(2);
    const day = new Date(); const ymd = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    if (req.body?.ledger !== false) store.put('adm_ledger', { id: nanoid(10), type: 'gider', amount, date: ymd, category: 'Yayıncı / falcı ödemesi', note: `@${u.username} · ${u.earnings} jeton`, currency: 'TRY', by: req.admin.username, auto: true, createdAt: now() });
    store.update('users', u.id, { earnings: 0 });
    audit(req.admin, 'kazancı ödendi olarak işaretledi', u.id, `${amount} ₺`);
    res.json({ ok: true, amount });
  });

  app.get('/api/admin/legal', adminAuth, (req, res) => res.json(store.get('settings', 'legal') || {}));
  app.put('/api/admin/legal', adminAuth, owner, (req, res) => {
    const b = req.body || {};
    const email = String(b.email || '').trim().slice(0, 120);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'E-posta geçersiz.' });
    const doc = store.put('settings', { id: 'legal', company: String(b.company || '').trim().slice(0, 120), email, address: String(b.address || '').trim().slice(0, 240) });
    audit(req.admin, 'yasal iletişim bilgilerini güncelledi');
    res.json(doc);
  });

  // ================= Etkinlik teması =================
  const appEvent = require('./event');
  app.get('/api/admin/event', adminAuth, (req, res) => {
    const { list, builtIn } = appEvent.list(store);
    res.json({ list, builtIn, kinds: Object.entries(appEvent.EVENTS).map(([id, v]) => ({ id, name: v.name })), active: appEvent.current(store), now: now() });
  });
  app.put('/api/admin/event', adminAuth, owner, (req, res) => {
    const raw = Array.isArray(req.body?.list) ? req.body.list : [];
    if (raw.some((e) => !appEvent.EVENTS[e.kind])) return res.status(400).json({ error: 'Etkinlik bulunamadı.' });
    if (raw.some((e) => !(+e.end > +e.start))) return res.status(400).json({ error: 'Her etkinlikte bitiş, başlangıçtan sonra olmalı.' });
    const list = appEvent.clean(raw);
    for (let i = 1; i < list.length; i++) if (list[i].start < list[i - 1].end) return res.status(400).json({ error: `${appEvent.EVENTS[list[i].kind].name} ile ${appEvent.EVENTS[list[i - 1].kind].name} tarihleri çakışıyor.` });
    store.put('settings', { id: 'event', list });
    const ev = appEvent.current(store);
    io.emit('event', { event: ev, now: now() });
    audit(req.admin, 'etkinlik takvimini güncelledi', null, list.map((e) => `${appEvent.EVENTS[e.kind].name}: ${new Date(e.start).toISOString().slice(0, 10)} → ${new Date(e.end).toISOString().slice(0, 10)}`).join(', ') || 'boş');
    res.json({ ok: true, list, active: ev });
  });

  // ================= Bakım modu =================
  const trFmt = (t, o) => new Date(t).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', ...o });
  const whenTxt = (t) => trFmt(t, { day: 'numeric', month: 'long', weekday: 'long', hour: '2-digit', minute: '2-digit' });
  const hmTxt = (t) => trFmt(t, { hour: '2-digit', minute: '2-digit' });
  const sameDay = (a, b) => trFmt(a, { dateStyle: 'short' }) === trFmt(b, { dateStyle: 'short' });
  const rangeTxt = (st, en) => (en ? (sameDay(st, en) ? `${whenTxt(st)}–${hmTxt(en)}` : `${whenTxt(st)} – ${whenTxt(en)}`) : whenTxt(st));
  // Tüm aktif kullanıcılara bildirim (uygulama içi + telefon bildirimi)
  const notifyEveryone = (text, tag) => {
    const list = store.filter('users', (u) => statusOf(u) === 'active');
    list.forEach((u) => notify(u.id, { type: 'announce', title: 'SwipeUp', text, url: '/#/notifications', tag }));
    return list.length;
  };
  const planDoc = () => store.get('settings', 'maint_plan');
  const planOut = (p) => (p && !p.started ? { start: p.start, end: p.end || null, message: p.message || '' } : null);
  // Bakımı aç / kapat (elle ya da plana göre)
  function setMaintenance(on, { message = '', until = null, by = 'sistem', notifyUsers = false, planId = null } = {}) {
    const prev = store.get('settings', 'maintenance');
    const doc = store.put('settings', { id: 'maintenance', on, message: String(message || '').trim().slice(0, 300), until: on ? until : null, at: now(), by, planId: on ? planId : null });
    if (on) {
      io.emit('maintenance', { on: true, message: doc.message, until: doc.until });
      setTimeout(() => { for (const [, sk] of io.of('/').sockets) sk.disconnect(true); }, 800);
      if (notifyUsers) notifyEveryone(`🛠️ SwipeUp bakıma alındı${doc.until ? `, ${hmTxt(doc.until)} civarı geri döneceğiz` : ''}.${doc.message ? ` ${doc.message}` : ''}`, 'maint');
    } else if (prev?.on && notifyUsers) {
      notifyEveryone('✅ Bakım bitti, SwipeUp yeniden açık. Kaldığın yerden devam edebilirsin!', 'maint');
    }
    return doc;
  }

  app.get('/api/admin/maintenance', adminAuth, (req, res) => res.json({ ...(store.get('settings', 'maintenance') || { on: false }), plan: planDoc() || null, users: store.filter('users', (u) => statusOf(u) === 'active').length }));
  app.put('/api/admin/maintenance', adminAuth, owner, (req, res) => {
    const b = req.body || {};
    const on = !!b.on;
    const until = +b.until > now() ? +b.until : null;
    const cur = store.get('settings', 'maintenance');
    const changing = on !== !!cur?.on;
    const doc = setMaintenance(on, { message: b.message, until, by: req.admin.username, notifyUsers: changing && !!b.notify });
    // Planlı bakım elle bitirildiyse planı da kapat
    if (!on && planDoc()?.started) store.del('settings', 'maint_plan');
    audit(req.admin, on ? 'bakım modunu açtı' : 'bakım modunu kapattı', null, doc.message || '');
    res.json(doc);
  });
  // İleri tarihli bakım planı
  app.put('/api/admin/maintenance/plan', adminAuth, owner, (req, res) => {
    const b = req.body || {};
    const start = +b.start; const end = b.end ? +b.end : null;
    if (!(start > now() + 60000)) return res.status(400).json({ error: 'Başlangıç zamanı en az 1 dakika sonrası olmalı.' });
    if (start > now() + 90 * DAY) return res.status(400).json({ error: 'En fazla 90 gün sonrasına planlanabilir.' });
    if (end && end <= start) return res.status(400).json({ error: 'Bitiş, başlangıçtan sonra olmalı.' });
    const remind = [0, 15, 30, 60, 120, 1440].includes(+b.remind) ? +b.remind : 30;
    const prev = planDoc();
    const p = store.put('settings', {
      id: 'maint_plan', pid: nanoid(8), start, end, message: String(b.message || '').trim().slice(0, 300),
      remind, notifyStart: b.notifyStart !== false, notifyEnd: b.notifyEnd !== false, autoEnd: !!end && b.autoEnd !== false,
      announced: null, reminded: false, started: false, by: req.admin.username, at: now(),
    });
    let reach = 0;
    if (b.announce) {
      const changed = prev && !prev.started && prev.announced;
      reach = notifyEveryone(`🛠️ ${changed ? 'Bakım zamanı değişti: ' : 'Planlı bakım: '}${end ? `${rangeTxt(start, end)} arasında SwipeUp kullanılamayacak.` : `${whenTxt(start)} itibarıyla SwipeUp bir süre bakımda olacak.`}${p.message ? ` ${p.message}` : ''}`, 'maint-plan');
      store.update('settings', 'maint_plan', { announced: now(), reach });
    }
    io.emit('maintenance:plan', planOut(planDoc()));
    audit(req.admin, 'bakım planladı', null, `${rangeTxt(start, end)}${b.announce ? ` · ${reach} kişiye duyuruldu` : ''}`);
    res.json(planDoc());
  });
  app.delete('/api/admin/maintenance/plan', adminAuth, owner, (req, res) => {
    const p = planDoc();
    if (!p) return res.json({ ok: true });
    store.del('settings', 'maint_plan');
    if (p.announced && !p.started && req.query.notify !== '0') notifyEveryone(`✅ ${rangeTxt(p.start, p.end)} için planlanan bakım iptal edildi. SwipeUp açık kalacak.`, 'maint-plan');
    io.emit('maintenance:plan', null);
    audit(req.admin, 'bakım planını iptal etti', null, rangeTxt(p.start, p.end));
    res.json({ ok: true });
  });
  // Zamanlayıcı: hatırlatma, otomatik başlatma ve bitirme
  setInterval(() => {
    const p = planDoc(); const t = now();
    if (!p) return;
    if (!p.started) {
      if (p.remind && !p.reminded && t >= p.start - p.remind * 60000 && t < p.start) {
        store.update('settings', 'maint_plan', { reminded: true });
        const mins = Math.max(1, Math.round((p.start - t) / 60000));
        notifyEveryone(`⏰ Hatırlatma: ${mins >= 60 ? `${Math.round(mins / 60)} saat` : `${mins} dakika`} sonra (${hmTxt(p.start)}) SwipeUp bakıma giriyor${p.end ? `, ${hmTxt(p.end)} civarı döneceğiz` : ''}.`, 'maint-plan');
      }
      if (t >= p.start) {
        store.update('settings', 'maint_plan', { started: t });
        if (!store.get('settings', 'maintenance')?.on) setMaintenance(true, { message: p.message, until: p.end, by: `plan (${p.by})`, notifyUsers: p.notifyStart, planId: p.pid });
        audit({ username: 'sistem', id: null }, 'planlı bakımı başlattı', null, rangeTxt(p.start, p.end));
        io.emit('maintenance:plan', null);
      }
      return;
    }
    const m = store.get('settings', 'maintenance');
    if (p.autoEnd && p.end && t >= p.end) {
      if (m?.on && m.planId === p.pid) setMaintenance(false, { by: 'plan', notifyUsers: p.notifyEnd });
      store.del('settings', 'maint_plan');
      audit({ username: 'sistem', id: null }, 'planlı bakımı bitirdi', null, rangeTxt(p.start, p.end));
    } else if (!m?.on) store.del('settings', 'maint_plan'); // elle bitirildi
  }, 15000).unref();

  // ================= Profil doğrulama =================
  app.get('/api/admin/verifications', adminAuth, (req, res) => {
    const st = String(req.query.status || 'pending');
    res.json(store.filter('verifications', (v) => st === 'all' || v.status === st).sort((a, b) => b.at - a.at).slice(0, 200).map((v) => {
      const u = store.get('users', v.userId);
      return { ...v, poseInfo: require('./features').POSES.find((p) => p.id === v.pose) || { text: v.pose }, user: u ? { ...userRow(u), photos: u.photos || [], avatar: u.avatar } : null };
    }));
  });
  app.post('/api/admin/verifications/:id', adminAuth, (req, res) => {
    const v = store.get('verifications', req.params.id);
    if (!v || v.status !== 'pending') return res.status(404).json({ error: 'Başvuru bulunamadı.' });
    const approve = !!req.body?.approve;
    const note = String(req.body?.note || '').slice(0, 200);
    store.update('verifications', v.id, { status: approve ? 'approved' : 'rejected', note, by: req.admin.username, closedAt: now() });
    if (approve) store.update('users', v.userId, { verified: true, verifiedAt: now() });
    else store.update('users', v.userId, { verifyPose: null });
    notify(v.userId, { type: 'verify', text: approve ? '✅ Profilin doğrulandı! Artık adının yanında mavi tik var.' : `Doğrulama onaylanmadı.${note ? ' ' + note : ''} Yeni bir poz ile tekrar deneyebilirsin.`, title: 'SwipeUp', url: '/#/verify' });
    audit(req.admin, approve ? 'profili doğruladı' : 'doğrulamayı reddetti', v.userId, note);
    res.json({ ok: true });
  });
  app.post('/api/admin/users/:id/unverify', adminAuth, (req, res) => {
    const u = store.get('users', req.params.id);
    if (!u) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    store.update('users', u.id, { verified: false });
    audit(req.admin, 'mavi tiki kaldırdı', u.id);
    res.json(userRow(u));
  });

  // ================= Otomatik moderasyon işaretleri =================
  app.get('/api/admin/flags', adminAuth, (req, res) => {
    const st = String(req.query.status || 'open');
    res.json(store.filter('flags', (f) => st === 'all' || f.status === st).sort((a, b) => (b.level === 'high') - (a.level === 'high') || b.at - a.at).slice(0, 300).map((f) => {
      const m = store.get('messages', f.ref) || store.get('pub_msgs', f.ref);
      const col = store.get('messages', f.ref) ? 'messages' : 'pub_msgs';
      const ctxMsgs = m ? store.filter(col, (x) => (col === 'pub_msgs' || x.chatId === m.chatId) && Math.abs(x.at - m.at) < 30 * 60000 && !x.system).sort((a, b) => a.at - b.at)
        .filter((x, i, arr) => Math.abs(arr.findIndex((y) => y.id === m.id) - i) <= 3)
        .map((x) => ({ id: x.id, text: x.deleted ? '(silindi)' : x.location ? `📍 Konum${x.location.label ? ': ' + x.location.label : ''}` : x.text || (x.mediaType === 'audio' ? '🎤 Sesli mesaj' : x.media ? '📷 Medya' : ''), from: store.get('users', x.from || x.userId)?.username, at: x.at, flagged: x.id === m.id })) : [];
      const chat = store.get('chats', f.chatId);
      return {
        ...f, user: store.get('users', f.userId) ? userRow(store.get('users', f.userId)) : null,
        to: f.chatId === 'genel' ? [{ username: 'genel-sohbet' }] : chat ? chat.members.filter((x) => x !== f.userId).map((x) => brief(store.get('users', x))).filter(Boolean).slice(0, 3) : [],
        context: ctxMsgs, userFlags: store.filter('flags', (x) => x.userId === f.userId).length,
      };
    }));
  });
  app.post('/api/admin/flags/:id', adminAuth, (req, res) => {
    const f = store.get('flags', req.params.id);
    if (!f) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
    const action = String(req.body?.action || 'dismiss');
    const note = String(req.body?.note || '').slice(0, 300);
    const u = store.get('users', f.userId);
    let did = 'yoksaydı';
    if (action === 'delete') { deleteContent(f.ref); did = 'mesajı sildi'; }
    if (action === 'warn' && u) {
      notify(u.id, { type: 'warning', text: `⚠️ SwipeUp ekibinden uyarı: ${note || 'Mesajlarında hakaret/tehdit tespit edildi. Lütfen topluluk kurallarına uy.'}`, title: 'SwipeUp', url: '/#/notifications' });
      did = 'uyardı';
    }
    if ((action === 'suspend' || action === 'ban') && u) {
      deleteContent(f.ref);
      banUser(req.admin, u, { days: action === 'suspend' ? Math.max(1, parseInt(req.body?.days, 10) || 7) : null, reason: note || `Otomatik moderasyon: ${f.reason}` });
      did = action === 'suspend' ? 'askıya aldı' : 'yasakladı';
    }
    store.update('flags', f.id, { status: action === 'dismiss' ? 'dismissed' : 'resolved', resolution: did, by: req.admin.username, closedAt: now() });
    audit(req.admin, `moderasyon: ${did}`, f.userId, note || f.reason);
    res.json({ ok: true });
  });


  // ================= Medya (görseller, videolar, sesler) =================
  const mid = (u) => (typeof u === 'string' && /^\/media\/[\w-]+$/.test(u) ? u.slice(7) : null);
  // Uygulamadaki tüm medya kullanımlarını topla
  function mediaRefs() {
    const refs = [];
    const add = (url, kind, refId, userId, at, extra = {}) => { const id = mid(url); if (id) refs.push({ id, url, kind, refId, userId, at, ...extra }); };
    store.all('posts').forEach((p) => {
      const items = p.items || [{ media: p.media, poster: p.poster }];
      items.forEach((it, i) => { add(it.media, p.type === 'reel' ? 'reel' : 'post', p.id, p.userId, p.createdAt, { idx: i, caption: p.caption }); if (it.poster) add(it.poster, 'poster', p.id, p.userId, p.createdAt, { idx: i }); });
      if (p.edit?.audio) add(p.edit.audio, 'music', p.id, p.userId, p.createdAt);
    });
    store.all('stories').forEach((x) => { add(x.media, 'story', x.id, x.userId, x.at); (x.stickers || []).forEach((st) => st.type === 'music' && add(st.src, 'music', x.id, x.userId, x.at, { story: true })); });
    store.all('messages').forEach((m) => {
      if (!m.deleted) add(m.media, 'dm', m.id, m.from, m.at, { mediaType: m.mediaType });
      (m.fal?.images || []).forEach((u) => add(u, 'fal', m.id, m.from, m.at));
    });
    store.all('pub_msgs').forEach((m) => { if (!m.deleted) add(m.media, 'genel', m.id, m.userId, m.at); });
    store.all('users').forEach((u) => { add(u.avatar, 'avatar', u.id, u.id, u.createdAt); (u.photos || []).forEach((ph) => add(ph, 'photo', u.id, u.id, u.createdAt)); });
    store.all('verifications').forEach((v) => add(v.selfie, 'selfie', v.id, v.userId, v.at));
    return refs;
  }
  const KIND_LABEL = { post: 'Gönderi', reel: 'Vitrin', poster: 'Vitrin kapağı', story: 'Hikaye', dm: 'Özel mesaj', genel: 'Genel sohbet', fal: 'Fal fotoğrafı', avatar: 'Profil fotoğrafı', photo: 'Profil fotoğrafı', selfie: 'Doğrulama selfiesi', music: 'Müzik', orphan: 'Sahipsiz' };

  app.get('/api/admin/media', adminAuth, (req, res) => {
    const kind = String(req.query.kind || 'all');
    const refs = mediaRefs();
    const used = new Set(refs.map((r) => r.id));
    const orphans = store.filter('media_meta', (m) => !used.has(m.id)).map((m) => ({ id: m.id, url: `/media/${m.id}`, kind: 'orphan', refId: null, userId: m.userId, at: m.at }));
    let list = [...refs.filter((r) => r.kind !== 'poster'), ...orphans];
    const groups = { post: ['post'], reel: ['reel'], story: ['story'], chat: ['dm', 'fal'], genel: ['genel'], profile: ['avatar', 'photo', 'selfie'], music: ['music'], orphan: ['orphan'] };
    const counts = Object.fromEntries(Object.entries(groups).map(([k, ks]) => [k, list.filter((r) => ks.includes(r.kind)).length]));
    if (kind !== 'all' && groups[kind]) list = list.filter((r) => groups[kind].includes(r.kind));
    const q = String(req.query.q || '').toLowerCase().trim();
    if (q) list = list.filter((r) => store.get('users', r.userId)?.username.includes(q));
    list.sort((a, b) => (b.at || 0) - (a.at || 0));
    const total = list.length;
    const metaBytes = store.all('media_meta').reduce((a, m) => a + (m.size || 0), 0);
    res.json({
      total, counts, storeMB: +((store.mediaBytes || 0) / 1048576).toFixed(1), trackedMB: +(metaBytes / 1048576).toFixed(1), kind: store.kind,
      items: list.slice(0, 240).map((r) => {
        const m = store.get('media_meta', r.id);
        return { ...r, label: KIND_LABEL[r.kind], mime: m?.mime || r.mediaType || null, size: m?.size || null, where: m?.where || null, user: brief(store.get('users', r.userId)) };
      }),
    });
  });

  // Seçilen medyaları kaldır: içeriği uygulamadan çıkar, dosyayı sil
  app.post('/api/admin/media/delete', adminAuth, async (req, res) => {
    const items = (Array.isArray(req.body?.items) ? req.body.items : []).slice(0, 200);
    const reason = String(req.body?.reason || '').slice(0, 200);
    const tell = !!req.body?.notify;
    if (!items.length) return res.status(400).json({ error: 'Kaldırılacak medya seç.' });
    const notified = new Set(); const fileIds = new Set(); let removed = 0;
    for (const it of items) {
      const id = mid(it.url); if (!id) continue;
      fileIds.add(id);
      let owner = null;
      if (it.kind === 'post' || it.kind === 'reel') {
        const p = store.get('posts', it.refId);
        if (p) {
          owner = p.userId;
          const list = (p.items || [{ media: p.media, poster: p.poster }]).filter((x) => x.media !== it.url);
          if (!list.length || p.type === 'reel') { (p.items || []).forEach((x) => { const pid = mid(x.poster); if (pid) fileIds.add(pid); }); store.del('posts', p.id); }
          else store.update('posts', p.id, { items: list, media: list[0].media, poster: list[0].poster || null });
        }
      } else if (it.kind === 'story') {
        const x = store.get('stories', it.refId);
        if (x) { owner = x.userId; store.del('stories', x.id); io.emit('stories:update', {}); }
      } else if (it.kind === 'dm' || it.kind === 'fal') {
        const m = store.get('messages', it.refId);
        if (m) {
          owner = m.from;
          if (it.kind === 'fal' && m.fal) m.fal.images = (m.fal.images || []).filter((u) => u !== it.url);
          else Object.assign(m, { deleted: true, text: '', media: null, reactions: {} });
          store.update('messages', m.id, {});
          store.get('chats', m.chatId)?.members.forEach((x) => emitTo(x, 'message:update', m));
        }
      } else if (it.kind === 'genel') {
        const m = store.get('pub_msgs', it.refId);
        if (m) { owner = m.userId; Object.assign(m, { deleted: true, text: '', media: null, reactions: {} }); store.update('pub_msgs', m.id, {}); io.to('genel').emit('genel:update', { ...m, user: brief(store.get('users', m.userId)) }); }
      } else if (it.kind === 'avatar' || it.kind === 'photo') {
        const u = store.get('users', it.refId);
        if (u) {
          owner = u.id;
          const patch = { photos: (u.photos || []).filter((x) => x !== it.url) };
          if (u.avatar === it.url) patch.avatar = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(u.username)}&backgroundColor=ffe3dc`;
          store.update('users', u.id, patch);
        }
      } else if (it.kind === 'selfie') {
        const v = store.get('verifications', it.refId); if (v) store.update('verifications', v.id, { selfie: null });
      } else if (it.kind === 'music') {
        const p = store.get('posts', it.refId);
        if (p?.edit) { owner = p.userId; store.update('posts', p.id, { edit: { ...p.edit, audio: null, muteOriginal: false } }); }
        const x = store.get('stories', it.refId);
        if (x) { owner = x.userId; store.update('stories', x.id, { stickers: (x.stickers || []).filter((st) => st.src !== it.url) }); }
      }
      removed++;
      if (tell && owner && !notified.has(owner) && !['selfie', 'orphan'].includes(it.kind)) {
        notified.add(owner);
        notify(owner, { type: 'warning', title: 'SwipeUp', url: '/#/notifications', text: `⚠️ Paylaştığın bir içerik topluluk kurallarına aykırı olduğu için kaldırıldı.${reason ? ' ' + reason : ''}` });
      }
    }
    // Başka yerde kullanılmayan dosyaları sil
    const still = new Set(mediaRefs().map((r) => r.id));
    let freed = 0;
    for (const id of fileIds) {
      if (still.has(id)) continue;
      freed += await store.deleteMedia(id).catch(() => 0);
      ctx.dropMediaCache?.(id);
      store.del('media_meta', id);
    }
    audit(req.admin, `medya kaldırdı (${removed})`, null, reason);
    res.json({ ok: true, removed, freedMB: +(freed / 1048576).toFixed(2), notified: notified.size });
  });


  // ================= Veritabanı (Supabase / PostgreSQL) =================
  app.get('/api/admin/database', adminAuth, async (req, res) => {
    const cols = [...store.cols.entries()].map(([name, m]) => ({ name, count: m.size })).filter((c) => c.count).sort((a, b) => b.count - a.count);
    const out = {
      kind: store.kind, host: store.pgHost || null, schema: store.schema || null,
      collections: cols, docs: cols.reduce((a, c) => a + c.count, 0),
      mediaCount: store.mediaCount ?? store.all('media_meta').length, mediaMB: +((store.mediaBytes || 0) / 1048576).toFixed(1),
      pending: store.pending?.size || 0, lastWrite: store.lastWrite || null, lastError: store.lastError || null,
      migration: store.get('meta', 'migration'),
      limitMB: store.kind === 'postgres' && /supabase/.test(store.pgHost || '') ? 500 : store.kind === 'redis' ? 25 : null,
    };
    out.storage = store.sb ? { bucket: store.sb.bucket, limitMB: 1024, move: store.get('meta', 'storage_move') } : null;
    out.storageError = store.storageError || null;
    if (store.pg && store.sb) {
      try {
        const q = await store.pg.query("select count(*)::int as n, coalesce(sum((metadata->>'size')::bigint),0)::bigint as b from storage.objects where bucket_id = $1", [store.sb.bucket]);
        out.storage.count = q.rows[0].n; out.storage.mb = +(q.rows[0].b / 1048576).toFixed(1);
      } catch (e) { out.storage.err = e.message; }
    }
    if (store.pg) {
      try {
        const t = Date.now();
        const r = await store.pg.query('select pg_database_size(current_database())::bigint as b, version() as v');
        out.pingMs = Date.now() - t;
        out.dbMB = +(r.rows[0].b / 1048576).toFixed(1);
        out.version = String(r.rows[0].v).split(' on ')[0];
        const t2 = await store.pg.query(`select pg_total_relation_size('${store.T('docs')}')::bigint as d, pg_total_relation_size('${store.T('media')}')::bigint as m`);
        out.docsMB = +(t2.rows[0].d / 1048576).toFixed(1); out.mediaTableMB = +(t2.rows[0].m / 1048576).toFixed(1);
        out.connected = true;
      } catch (e) { out.connected = false; out.error = e.message; }
    } else out.connected = true;
    res.json(out);
  });
  app.get('/api/admin/database/backup', adminAuth, owner, (req, res) => {
    const data = { exportedAt: new Date().toISOString(), kind: store.kind, collections: {} };
    for (const [name, m] of store.cols) if (m.size) data.collections[name] = [...m.values()];
    audit(req.admin, 'veritabanı yedeği indirdi');
    res.setHeader('Content-Disposition', `attachment; filename="swipeup-yedek-${new Date().toISOString().slice(0, 10)}.json"`);
    res.type('application/json').send(JSON.stringify(data));
  });

  return { statusOf, ensureAdmin: ctx.ensureAdmin, adminAuth, owner, audit };
};

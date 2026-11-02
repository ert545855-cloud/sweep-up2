// SwipeUp — Express + Socket.IO sunucusu
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const webpush = require('web-push');
const { nanoid, customAlphabet } = require('nanoid');
const { Server } = require('socket.io');
const store = require('./server/store');
const mail = require('./server/mail');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true }, maxHttpBufferSize: 1e6, pingInterval: 20000, pingTimeout: 25000 });

let JWT_SECRET = process.env.JWT_SECRET;
let VAPID = null;
const DAY = 86400000;
const recoveryCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 12);

// ================= Yardımcılar =================
const now = () => Date.now();
const online = new Map(); // userId -> Set<socket>
const lives = new Map(); // userId -> { userId, socketId, title, startedAt, viewers:Set }
const calls = new Map(); // callId -> { id, chatId, from, to, video, state, at, timer, answeredAt }

const isOnline = (id) => (online.get(id)?.size || 0) > 0;
const emitTo = (userId, ev, data) => online.get(userId)?.forEach((s) => s.emit(ev, data));
const isBlocked = (a, b) => !!(a && b && (store.get('blocks', `${a}_${b}`) || store.get('blocks', `${b}_${a}`)));

function pub(u, viewerId) {
  if (!u) return null;
  const { passHash, recoveryHash, email, lat, lng, ...rest } = u;
  return {
    ...rest,
    online: isOnline(u.id),
    live: lives.has(u.id),
    ...(viewerId === u.id ? { email: email || '', hasLocation: lat != null } : {}),
    ...(viewerId && viewerId !== u.id ? { isFollowing: !!store.get('follows', `${viewerId}_${u.id}`), distanceKm: distance(store.get('users', viewerId), u) } : {}),
  };
}
const brief = (u) => u && ({
  id: u.id, username: u.username, name: u.name, avatar: u.avatar,
  online: isOnline(u.id), live: lives.has(u.id), lastSeen: u.lastSeen, createdAt: u.createdAt,
});

function distance(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371; const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r; const dLng = (b.lng - a.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return Math.max(1, Math.round(2 * R * Math.asin(Math.sqrt(x))));
}

function postOut(p, viewerId) {
  return {
    ...p,
    user: brief(store.get('users', p.userId)),
    likeCount: p.likes.length,
    liked: p.likes.includes(viewerId),
    commentCount: p.comments.filter((c) => !isBlocked(viewerId, c.userId)).length,
    comments: undefined,
    likes: undefined,
  };
}

function sign(u) { return jwt.sign({ id: u.id }, JWT_SECRET, { expiresIn: '90d' }); }

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  try {
    const { id } = jwt.verify(token, JWT_SECRET);
    const u = store.get('users', id);
    if (!u) throw new Error('no user');
    req.user = u;
    next();
  } catch {
    res.status(401).json({ error: 'Oturum süresi doldu, tekrar giriş yap.' });
  }
}
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Basit hız sınırı (bellekte)
const hits = new Map();
function limited(key, max, windowMs) {
  const t = now();
  const h = (hits.get(key) || []).filter((x) => t - x < windowMs);
  h.push(t); hits.set(key, h);
  return h.length > max;
}
setInterval(() => { const t = now(); for (const [k, v] of hits) if (!v.some((x) => t - x < 3600000)) hits.delete(k); }, 600000).unref();
const ipOf = (req) => (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();

// ================= Bildirimler =================
async function notify(userId, n) {
  if (!userId || userId === n.fromId || isBlocked(userId, n.fromId)) return;
  const from = n.fromId ? store.get('users', n.fromId) : null;
  if (!['message', 'call'].includes(n.type)) {
    const doc = store.put('notifications', {
      id: nanoid(12), userId, type: n.type, fromId: n.fromId || null,
      ref: n.ref || null, text: n.text, at: now(), read: false,
    });
    emitTo(userId, 'notification', { ...doc, from: n.type === 'liked' ? null : brief(from) });
  }
  const visible = [...(online.get(userId) || [])].some((s) => s.data.visible);
  if (visible || !VAPID) return;
  const payload = JSON.stringify({
    title: n.title || (from && n.type !== 'liked' ? from.name : 'SwipeUp'),
    body: n.text,
    icon: n.type !== 'liked' && from?.avatar && !from.avatar.includes('svg') ? from.avatar : '/icons/icon-192.png',
    url: n.url || '/#/notifications',
    tag: n.tag || n.type,
    call: n.type === 'call',
  });
  const subs = store.filter('pushSubs', (s) => s.userId === userId);
  await Promise.all(subs.map((s) => webpush.sendNotification(s.sub, payload, { TTL: n.type === 'call' ? 30 : 3600, urgency: n.type === 'call' || n.type === 'message' ? 'high' : 'normal' })
    .catch((e) => { if (e.statusCode === 404 || e.statusCode === 410) store.del('pushSubs', s.id); })));
}

// ================= Sohbet =================
function chatBetween(a, b) {
  const id = [a, b].sort().join('_');
  return store.get('chats', id) || store.put('chats', { id, members: [a, b].sort(), createdAt: now(), lastAt: now() });
}

const groupAvatar = (name) => `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(name)}&backgroundColor=ff8a3d,ff3d6e,1fbf6a,2b9bff`;

function chatOut(c, me) {
  const msgs = store.filter('messages', (m) => m.chatId === c.id);
  msgs.sort((x, y) => x.at - y.at);
  const visible = msgs.filter((m) => !(m.hiddenFor || []).includes(me));
  const last = visible[visible.length - 1] || null;
  const unread = visible.filter((m) => m.from !== me && !m.system && !m.readBy.includes(me)).length;
  if (c.isGroup) {
    return {
      id: c.id, isGroup: true, name: c.name, admins: c.admins,
      other: { id: c.id, name: c.name, avatar: c.avatar, isGroup: true, username: '' },
      members: c.members.map((m) => brief(store.get('users', m))).filter(Boolean),
      last: last && { ...last, fromName: store.get('users', last.from)?.name?.split(' ')[0] },
      unread, lastAt: c.lastAt,
    };
  }
  const otherId = c.members.find((m) => m !== me) || me;
  return { id: c.id, other: brief(store.get('users', otherId)), last, unread, lastAt: c.lastAt, blocked: isBlocked(me, otherId) };
}

function msgOut(m) {
  if (!m) return m;
  if (m.deleted) return { ...m, text: '', media: null };
  return m;
}

function sendMessage(chat, fromId, { text, media, mediaType, replyTo, duration, system, story }) {
  text = String(text || '').slice(0, 4000).trim();
  if (!text && !media) return null;
  if (!chat.isGroup) {
    const other = chat.members.find((m) => m !== fromId);
    if (isBlocked(fromId, other)) return null;
  }
  let reply = null;
  if (replyTo) {
    const r = store.get('messages', replyTo);
    if (r && r.chatId === chat.id && !r.deleted) {
      reply = { id: r.id, from: r.from, fromName: store.get('users', r.from)?.name, text: (r.text || '').slice(0, 120), mediaType: r.mediaType || null };
    }
  }
  const msg = store.put('messages', {
    id: nanoid(14), chatId: chat.id, from: fromId, text,
    media: media || null, mediaType: ['image', 'video', 'audio'].includes(mediaType) ? mediaType : (media ? 'image' : null),
    duration: duration ? Math.min(600, Math.round(duration)) : null,
    reply, story: story || null, system: !!system, reactions: {},
    at: now(), readBy: [fromId], deliveredTo: [fromId],
  });
  store.update('chats', chat.id, { lastAt: msg.at });
  for (const m of chat.members) if (m !== fromId && isOnline(m)) msg.deliveredTo.push(m);
  store.update('messages', msg.id, {});
  chat.members.forEach((m) => emitTo(m, 'message', msg));
  if (system) return msg;
  const sender = store.get('users', fromId);
  const preview = text || { video: '🎥 Video', audio: '🎤 Sesli mesaj' }[msg.mediaType] || '📷 Fotoğraf';
  chat.members.filter((m) => m !== fromId).forEach((m) => {
    notify(m, {
      type: 'message', fromId, tag: 'chat-' + chat.id,
      title: chat.isGroup ? `${chat.name}` : sender.name,
      text: chat.isGroup ? `${sender.name.split(' ')[0]}: ${preview}` : preview,
      url: `/#/chat/${chat.id}`,
    });
  });
  return msg;
}

function removeChat(chatId) {
  const c = store.get('chats', chatId);
  if (!c) return;
  store.filter('messages', (m) => m.chatId === chatId).forEach((m) => store.del('messages', m.id));
  store.del('chats', chatId);
  c.members.forEach((m) => emitTo(m, 'chat:removed', { chatId }));
}

// ================= Express =================
app.set('trust proxy', 1);
// Eski adresten gelenleri tek adrese yönlendir
if (process.env.CANONICAL_URL) {
  const canon = new URL(process.env.CANONICAL_URL);
  app.use((req, res, next) => {
    if (req.path === '/healthz' || req.hostname === canon.hostname) return next();
    res.redirect(301, canon.origin + req.originalUrl);
  });
}
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));

app.get('/healthz', (req, res) => res.json({ ok: true, store: store.kind, users: store.all('users').length, online: online.size, mediaMB: +((store.mediaBytes || 0) / 1048576).toFixed(1) }));

// TURN: metered.ca Open Relay (statik kimlik, ücretsiz) — env ile değiştirilebilir
function iceServers(userId) {
  const ice = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (process.env.TURN_URL) {
    ice.push({ urls: process.env.TURN_URL.split(','), username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
    return ice;
  }
  const host = process.env.TURN_STATIC_HOST || 'staticauth.openrelay.metered.ca';
  const secret = process.env.TURN_STATIC_SECRET || 'openrelayprojectsecret';
  if (process.env.TURN_DISABLE === '1') return ice;
  const username = `${Math.floor(now() / 1000) + DAY / 1000}:${userId || 'guest'}`;
  const credential = crypto.createHmac('sha1', secret).update(username).digest('base64');
  ice.push({
    urls: [`turn:${host}:80`, `turn:${host}:80?transport=tcp`, `turn:${host}:443`, `turns:${host}:443?transport=tcp`],
    username, credential,
  });
  return ice;
}

app.get('/api/config', (req, res) => {
  let uid = null;
  try { uid = jwt.verify((req.headers.authorization || '').slice(7), JWT_SECRET).id; } catch {}
  res.json({ vapidPublicKey: VAPID?.publicKey || null, iceServers: iceServers(uid), emailReset: mail.enabled() });
});

// ---------- Kimlik ----------
app.post('/api/auth/register', wrap(async (req, res) => {
  if (limited('reg:' + ipOf(req), 8, 3600000)) return res.status(429).json({ error: 'Çok fazla kayıt denemesi. Bir saat sonra tekrar dene.' });
  let { username, name, password, email } = req.body || {};
  username = String(username || '').toLowerCase().trim();
  name = String(name || '').trim().slice(0, 40);
  email = String(email || '').toLowerCase().trim();
  if (!/^[a-z0-9._]{3,24}$/.test(username)) return res.status(400).json({ error: 'Kullanıcı adı 3–24 karakter olmalı; harf, rakam, nokta ve alt çizgi kullanılabilir.' });
  if (String(password || '').length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı.' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'E-posta adresi geçersiz.' });
  if (store.find('users', (u) => u.username === username)) return res.status(409).json({ error: 'Bu kullanıcı adı alınmış.' });
  if (email && store.find('users', (u) => u.email === email)) return res.status(409).json({ error: 'Bu e-posta ile kayıtlı bir hesap var.' });
  const code = recoveryCode();
  const u = store.put('users', {
    id: nanoid(10), username, name: name || username, email: email || null,
    bio: '', age: null, gender: null, lookingFor: 'all', city: '', interests: [],
    prefs: { ageMin: 18, ageMax: 99, maxKm: null },
    avatar: `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(username)}&backgroundColor=ffe3dc`,
    photos: [], passHash: await bcrypt.hash(password, 10), recoveryHash: await bcrypt.hash(code, 8),
    isBot: false, createdAt: now(), lastSeen: now(),
  });
  // Diğer gerçek üyelere yeni üyeyi duyur (uygulama açıksa listeleri yenilenir)
  io.emit('people:new', brief(u));
  res.json({ token: sign(u), user: pub(u, u.id), recoveryCode: code.match(/.{4}/g).join('-') });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const login = String(req.body?.username || '').toLowerCase().trim();
  if (limited('login:' + ipOf(req), 30, 900000) || limited('login-u:' + login, 8, 900000)) {
    return res.status(429).json({ error: 'Çok fazla hatalı deneme. 15 dakika sonra tekrar dene ya da şifreni sıfırla.' });
  }
  const u = store.find('users', (x) => x.username === login || (x.email && x.email === login));
  if (!u || !(await bcrypt.compare(String(req.body?.password || ''), u.passHash))) {
    return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
  }
  hits.delete('login-u:' + login);
  res.json({ token: sign(u), user: pub(u, u.id) });
}));

app.post('/api/auth/forgot', wrap(async (req, res) => {
  if (limited('forgot:' + ipOf(req), 6, 3600000)) return res.status(429).json({ error: 'Çok fazla istek. Bir saat sonra tekrar dene.' });
  const login = String(req.body?.login || '').toLowerCase().trim();
  const u = store.find('users', (x) => x.username === login || x.email === login);
  if (u?.email && mail.enabled()) {
    const code = String(crypto.randomInt(100000, 999999));
    store.put('resets', { id: u.id, codeHash: await bcrypt.hash(code, 8), exp: now() + 15 * 60000, tries: 0 });
    await mail.send(u.email, 'SwipeUp şifre sıfırlama kodun', `Merhaba ${u.name},\n\nŞifre sıfırlama kodun: ${code}\n\nKod 15 dakika geçerli. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.\n\nSwipeUp`)
      .catch((e) => console.error('[mail]', e.message));
  }
  res.json({ ok: true, emailReset: mail.enabled() });
}));

app.post('/api/auth/reset', wrap(async (req, res) => {
  const login = String(req.body?.login || '').toLowerCase().trim();
  const code = String(req.body?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const password = String(req.body?.password || '');
  if (limited('reset:' + ipOf(req), 10, 3600000) || limited('reset-u:' + login, 6, 3600000)) return res.status(429).json({ error: 'Çok fazla deneme. Bir saat sonra tekrar dene.' });
  if (password.length < 6) return res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalı.' });
  const u = store.find('users', (x) => x.username === login || x.email === login);
  const fail = () => res.status(400).json({ error: 'Kod hatalı ya da süresi dolmuş.' });
  if (!u || !code) return fail();
  let ok = false; let viaRecovery = false;
  const r = store.get('resets', u.id);
  if (/^\d{6}$/.test(code) && r && r.exp > now() && r.tries < 5) {
    ok = await bcrypt.compare(code, r.codeHash);
    if (!ok) store.update('resets', u.id, { tries: r.tries + 1 });
  } else if (code.length === 12 && u.recoveryHash) {
    ok = await bcrypt.compare(code, u.recoveryHash); viaRecovery = ok;
  }
  if (!ok) return fail();
  const patch = { passHash: await bcrypt.hash(password, 10) };
  let newCode = null;
  if (viaRecovery) { newCode = recoveryCode(); patch.recoveryHash = await bcrypt.hash(newCode, 8); }
  store.update('users', u.id, patch);
  store.del('resets', u.id);
  res.json({ token: sign(u), user: pub(u, u.id), recoveryCode: newCode && newCode.match(/.{4}/g).join('-') });
}));

app.post('/api/me/recovery', auth, wrap(async (req, res) => {
  const code = recoveryCode();
  store.update('users', req.user.id, { recoveryHash: await bcrypt.hash(code, 8) });
  res.json({ recoveryCode: code.match(/.{4}/g).join('-') });
}));

app.post('/api/me/password', auth, wrap(async (req, res) => {
  const { current, password } = req.body || {};
  if (!(await bcrypt.compare(String(current || ''), req.user.passHash))) return res.status(400).json({ error: 'Mevcut şifre hatalı.' });
  if (String(password || '').length < 6) return res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalı.' });
  store.update('users', req.user.id, { passHash: await bcrypt.hash(password, 10) });
  res.json({ ok: true });
}));

app.get('/api/me', auth, (req, res) => res.json(pub(req.user, req.user.id)));

app.patch('/api/me', auth, (req, res) => {
  const b = req.body || {};
  const patch = {};
  if (b.name !== undefined) patch.name = String(b.name).trim().slice(0, 40) || req.user.username;
  if (b.bio !== undefined) patch.bio = String(b.bio).slice(0, 150);
  if (b.avatar !== undefined) patch.avatar = String(b.avatar).slice(0, 500);
  if (b.city !== undefined) patch.city = String(b.city).slice(0, 40);
  if (b.age !== undefined) patch.age = b.age ? Math.max(18, Math.min(99, parseInt(b.age, 10) || 18)) : null;
  if (b.gender !== undefined) patch.gender = ['k', 'e', 'd'].includes(b.gender) ? b.gender : null;
  if (b.lookingFor !== undefined) patch.lookingFor = ['k', 'e', 'all'].includes(b.lookingFor) ? b.lookingFor : 'all';
  if (Array.isArray(b.interests)) patch.interests = b.interests.map((s) => String(s).slice(0, 24)).slice(0, 8);
  if (Array.isArray(b.photos)) patch.photos = b.photos.map(String).slice(0, 6);
  if (b.prefs) {
    const ageMin = Math.max(18, Math.min(99, parseInt(b.prefs.ageMin, 10) || 18));
    const ageMax = Math.max(ageMin, Math.min(99, parseInt(b.prefs.ageMax, 10) || 99));
    const maxKm = b.prefs.maxKm ? Math.max(1, Math.min(500, parseInt(b.prefs.maxKm, 10))) : null;
    patch.prefs = { ageMin, ageMax, maxKm };
  }
  if (b.location === null) { patch.lat = null; patch.lng = null; }
  if (b.location && Number.isFinite(+b.location.lat) && Number.isFinite(+b.location.lng)) {
    // ~1 km hassasiyete yuvarla (gizlilik)
    patch.lat = Math.round(+b.location.lat * 100) / 100;
    patch.lng = Math.round(+b.location.lng * 100) / 100;
  }
  if (b.email !== undefined) {
    const email = String(b.email || '').toLowerCase().trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'E-posta adresi geçersiz.' });
    if (email && store.find('users', (u) => u.email === email && u.id !== req.user.id)) return res.status(409).json({ error: 'Bu e-posta başka bir hesapta kayıtlı.' });
    patch.email = email || null;
  }
  if (b.username !== undefined) {
    const un = String(b.username).toLowerCase().trim();
    if (!/^[a-z0-9._]{3,24}$/.test(un)) return res.status(400).json({ error: 'Kullanıcı adı geçersiz.' });
    if (store.find('users', (u) => u.username === un && u.id !== req.user.id)) return res.status(409).json({ error: 'Bu kullanıcı adı alınmış.' });
    patch.username = un;
  }
  res.json(pub(store.update('users', req.user.id, patch), req.user.id));
});

// ---------- Web push ----------
app.post('/api/push/subscribe', auth, (req, res) => {
  const sub = req.body?.subscription;
  if (!sub?.endpoint) return res.status(400).json({ error: 'Geçersiz abonelik' });
  const id = crypto.createHash('sha1').update(sub.endpoint).digest('hex');
  store.put('pushSubs', { id, userId: req.user.id, sub, at: now() });
  res.json({ ok: true });
});
app.post('/api/push/unsubscribe', auth, (req, res) => {
  const ep = req.body?.endpoint;
  if (ep) store.del('pushSubs', crypto.createHash('sha1').update(ep).digest('hex'));
  res.json({ ok: true });
});
app.post('/api/push/test', auth, wrap(async (req, res) => {
  const subs = store.filter('pushSubs', (s) => s.userId === req.user.id);
  if (!subs.length) return res.status(400).json({ error: 'Bu cihazda bildirim aboneliği yok.' });
  await Promise.all(subs.map((s) => webpush.sendNotification(s.sub, JSON.stringify({
    title: 'SwipeUp', body: 'Bildirimler çalışıyor 🎉', url: '/#/notifications', tag: 'test',
  })).catch(() => {})));
  res.json({ ok: true, count: subs.length });
}));

// ---------- Medya ----------
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 40 * 1024 * 1024 } });
app.post('/api/upload', auth, upload.single('file'), wrap(async (req, res) => {
  const f = req.file;
  if (!f || !/^(image|video|audio)\//.test(f.mimetype)) return res.status(400).json({ error: 'Sadece fotoğraf, video veya ses yüklenebilir.' });
  if (limited('up:' + req.user.id, 60, 3600000)) return res.status(429).json({ error: 'Çok fazla yükleme. Biraz sonra tekrar dene.' });
  const id = nanoid(16);
  await store.saveMedia(id, f.mimetype.split(';')[0], f.buffer);
  res.json({ url: `/media/${id}`, type: f.mimetype.split('/')[0] });
}));

const mediaCache = new Map(); let cacheBytes = 0;
const CACHE_MAX = 120 * 1024 * 1024;
async function getMedia(id) {
  if (mediaCache.has(id)) { const m = mediaCache.get(id); mediaCache.delete(id); mediaCache.set(id, m); return m; }
  const m = await store.loadMedia(id);
  if (!m) return null;
  const buf = Buffer.from(m.data);
  const item = { mime: m.mime, data: buf };
  mediaCache.set(id, item); cacheBytes += buf.length;
  while (cacheBytes > CACHE_MAX && mediaCache.size > 1) {
    const [k, v] = mediaCache.entries().next().value; mediaCache.delete(k); cacheBytes -= v.data.length;
  }
  return item;
}
app.get('/media/:id', wrap(async (req, res) => {
  const m = await getMedia(req.params.id);
  if (!m) return res.status(404).end();
  const total = m.data.length;
  res.setHeader('Content-Type', m.mime);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  const range = req.headers.range;
  if (range) {
    const [s, e] = range.replace(/bytes=/, '').split('-');
    const start = parseInt(s, 10) || 0;
    const end = e ? Math.min(parseInt(e, 10), total - 1) : total - 1;
    if (start >= total) { res.status(416).setHeader('Content-Range', `bytes */${total}`); return res.end(); }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
    res.setHeader('Content-Length', end - start + 1);
    return res.end(m.data.subarray(start, end + 1));
  }
  res.setHeader('Content-Length', total);
  res.end(m.data);
}));

// ---------- Kişiler ----------
// Gerçek üyeler önce, çevrimiçi olanlar en önde
function rankPeople(list) {
  return list.sort((a, b) => (isOnline(b.id) - isOnline(a.id)) || ((b.lastSeen || 0) - (a.lastSeen || 0)));
}
app.get('/api/people', auth, (req, res) => {
  const me = req.user.id;
  const list = rankPeople(store.filter('users', (u) => u.id !== me && !isBlocked(me, u.id)));
  res.json(list.slice(0, 60).map(brief));
});

// ---------- Gönderiler ----------
app.get('/api/feed', auth, (req, res) => {
  const me = req.user.id;
  const following = new Set(store.filter('follows', (f) => f.from === me).map((f) => f.to));
  following.add(me);
  // Herkesin gönderileri; takip ettiklerin biraz öne çıkar
  const posts = store.filter('posts', (p) => p.type === 'image' && !isBlocked(me, p.userId));
  posts.sort((a, b) => (b.createdAt + (following.has(b.userId) ? 6 * 3600000 : 0)) - (a.createdAt + (following.has(a.userId) ? 6 * 3600000 : 0)));
  res.json(posts.slice(0, 80).map((p) => postOut(p, me)));
});

app.get('/api/reels', auth, (req, res) => {
  const posts = store.filter('posts', (p) => p.type === 'reel' && !isBlocked(req.user.id, p.userId));
  posts.sort((a, b) => b.createdAt - a.createdAt);
  res.json(posts.slice(0, 60).map((p) => postOut(p, req.user.id)));
});

app.get('/api/explore', auth, (req, res) => {
  const posts = store.filter('posts', (p) => !isBlocked(req.user.id, p.userId));
  posts.sort((a, b) => (b.likes.length + b.createdAt / 3.6e6) - (a.likes.length + a.createdAt / 3.6e6));
  res.json(posts.slice(0, 60).map((p) => postOut(p, req.user.id)));
});

app.post('/api/posts', auth, (req, res) => {
  const { type, media, caption, poster } = req.body || {};
  if (!['image', 'reel'].includes(type) || !media) return res.status(400).json({ error: 'Önce bir fotoğraf veya video seç.' });
  const p = store.put('posts', {
    id: nanoid(10), userId: req.user.id, type, media: String(media), poster: poster || null,
    caption: String(caption || '').slice(0, 2200), likes: [], comments: [], createdAt: now(),
  });
  store.filter('follows', (f) => f.to === req.user.id).forEach((f) => notify(f.from, {
    type: 'post', fromId: req.user.id, ref: p.id,
    text: `${req.user.username} yeni bir ${type === 'reel' ? 'reels' : 'gönderi'} paylaştı.`,
    url: type === 'reel' ? `/#/reels/${p.id}` : `/#/p/${p.id}`,
  }));
  res.json(postOut(p, req.user.id));
});

app.get('/api/posts/:id', auth, (req, res) => {
  const p = store.get('posts', req.params.id);
  if (!p || isBlocked(req.user.id, p.userId)) return res.status(404).json({ error: 'Gönderi bulunamadı.' });
  res.json(postOut(p, req.user.id));
});

app.delete('/api/posts/:id', auth, (req, res) => {
  const p = store.get('posts', req.params.id);
  if (!p || p.userId !== req.user.id) return res.status(404).json({ error: 'Gönderi bulunamadı.' });
  store.del('posts', p.id);
  res.json({ ok: true });
});

app.post('/api/posts/:id/like', auth, (req, res) => {
  const p = store.get('posts', req.params.id);
  if (!p) return res.status(404).json({ error: 'Gönderi bulunamadı.' });
  const me = req.user.id;
  const want = req.body?.like ?? !p.likes.includes(me);
  if (want && !p.likes.includes(me)) {
    p.likes.push(me);
    notify(p.userId, { type: 'like', fromId: me, ref: p.id, text: `${req.user.username} ${p.type === 'reel' ? 'reels videonu' : 'gönderini'} beğendi.`, url: `/#/p/${p.id}` });
  }
  if (!want) p.likes = p.likes.filter((x) => x !== me);
  store.update('posts', p.id, {});
  io.emit('post:likes', { id: p.id, likeCount: p.likes.length });
  res.json({ liked: want, likeCount: p.likes.length });
});

app.get('/api/posts/:id/comments', auth, (req, res) => {
  const p = store.get('posts', req.params.id);
  if (!p) return res.status(404).json({ error: 'Gönderi bulunamadı.' });
  res.json(p.comments.filter((c) => !isBlocked(req.user.id, c.userId)).map((c) => ({ ...c, user: brief(store.get('users', c.userId)) })));
});

app.post('/api/posts/:id/comments', auth, (req, res) => {
  const p = store.get('posts', req.params.id);
  const text = String(req.body?.text || '').trim().slice(0, 500);
  if (!p || !text) return res.status(400).json({ error: 'Yorum boş olamaz.' });
  if (isBlocked(req.user.id, p.userId)) return res.status(403).json({ error: 'Bu gönderiye yorum yapamazsın.' });
  if (limited('cm:' + req.user.id, 30, 600000)) return res.status(429).json({ error: 'Çok hızlı yorum yapıyorsun, biraz bekle.' });
  const c = { id: nanoid(10), userId: req.user.id, text, at: now() };
  p.comments.push(c);
  store.update('posts', p.id, {});
  notify(p.userId, { type: 'comment', fromId: req.user.id, ref: p.id, text: `${req.user.username} yorum yaptı: ${text.slice(0, 80)}`, url: `/#/p/${p.id}` });
  res.json({ ...c, user: brief(req.user) });
});

// ---------- Hikayeler (24 saat) ----------
const storyAlive = (s) => now() - s.at < DAY;
app.get('/api/stories', auth, (req, res) => {
  const me = req.user.id;
  const following = new Set(store.filter('follows', (f) => f.from === me).map((f) => f.to));
  const byUser = new Map();
  store.filter('stories', (s) => storyAlive(s) && !isBlocked(me, s.userId))
    .sort((a, b) => a.at - b.at)
    .forEach((s) => {
      if (!byUser.has(s.userId)) byUser.set(s.userId, []);
      byUser.get(s.userId).push({ id: s.id, media: s.media, mediaType: s.mediaType, at: s.at, seen: s.viewers.includes(me), viewerCount: s.userId === me ? s.viewers.length : undefined });
    });
  const out = [...byUser.entries()].map(([uid, items]) => ({ user: brief(store.get('users', uid)), items, allSeen: items.every((i) => i.seen) }));
  out.sort((a, b) => (b.user.id === me) - (a.user.id === me) || a.allSeen - b.allSeen || (b.items.at(-1).at - a.items.at(-1).at));
  res.json(out);
});
app.post('/api/stories', auth, (req, res) => {
  const { media, mediaType } = req.body || {};
  if (!media) return res.status(400).json({ error: 'Önce bir fotoğraf veya video seç.' });
  const s = store.put('stories', { id: nanoid(12), userId: req.user.id, media: String(media), mediaType: mediaType === 'video' ? 'video' : 'image', at: now(), viewers: [] });
  io.emit('stories:update', { userId: req.user.id });
  res.json(s);
});
app.post('/api/stories/:id/view', auth, (req, res) => {
  const s = store.get('stories', req.params.id);
  if (!s) return res.status(404).json({ error: 'Hikaye bulunamadı.' });
  if (s.userId !== req.user.id && !s.viewers.includes(req.user.id)) { s.viewers.push(req.user.id); store.update('stories', s.id, {}); }
  res.json({ ok: true });
});
app.get('/api/stories/:id/viewers', auth, (req, res) => {
  const s = store.get('stories', req.params.id);
  if (!s || s.userId !== req.user.id) return res.status(404).json({ error: 'Hikaye bulunamadı.' });
  res.json(s.viewers.map((id) => brief(store.get('users', id))).filter(Boolean));
});
app.delete('/api/stories/:id', auth, (req, res) => {
  const s = store.get('stories', req.params.id);
  if (!s || s.userId !== req.user.id) return res.status(404).json({ error: 'Hikaye bulunamadı.' });
  store.del('stories', s.id);
  io.emit('stories:update', { userId: req.user.id });
  res.json({ ok: true });
});
app.post('/api/stories/:id/reply', auth, (req, res) => {
  const s = store.get('stories', req.params.id);
  const text = String(req.body?.text || '').trim();
  if (!s || !text || s.userId === req.user.id) return res.status(400).json({ error: 'Yanıt gönderilemedi.' });
  const chat = chatBetween(req.user.id, s.userId);
  const msg = sendMessage(chat, req.user.id, { text, story: { id: s.id, media: s.mediaType === 'image' ? s.media : null } });
  if (!msg) return res.status(403).json({ error: 'Bu kişiye mesaj gönderemezsin.' });
  res.json({ ok: true, chatId: chat.id });
});
setInterval(() => store.filter('stories', (s) => now() - s.at > DAY * 2).forEach((s) => store.del('stories', s.id)), 3600000).unref();

// ---------- Kullanıcılar ----------
app.get('/api/users/search', auth, (req, res) => {
  const q = String(req.query.q || '').toLowerCase().trim();
  if (!q) return res.json([]);
  const list = rankPeople(store.filter('users', (u) => !isBlocked(req.user.id, u.id) && (u.username.includes(q) || u.name.toLowerCase().includes(q))));
  res.json(list.slice(0, 30).map(brief));
});

app.get('/api/blocks', auth, (req, res) => {
  res.json(store.filter('blocks', (b) => b.from === req.user.id).map((b) => brief(store.get('users', b.to))).filter(Boolean));
});

app.get('/api/users/:username', auth, (req, res) => {
  const u = store.find('users', (x) => x.username === req.params.username || x.id === req.params.username);
  if (!u) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  const blockedByMe = !!store.get('blocks', `${req.user.id}_${u.id}`);
  if (isBlocked(req.user.id, u.id) && !blockedByMe) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  const posts = blockedByMe ? [] : store.filter('posts', (p) => p.userId === u.id).sort((a, b) => b.createdAt - a.createdAt);
  const mid = [req.user.id, u.id].sort().join('_');
  res.json({
    ...pub(u, req.user.id),
    followers: store.filter('follows', (f) => f.to === u.id).length,
    following: store.filter('follows', (f) => f.from === u.id).length,
    followsYou: !!store.get('follows', `${u.id}_${req.user.id}`),
    matched: !!store.get('matches', mid),
    blockedByMe,
    hasStory: store.filter('stories', (s) => s.userId === u.id && storyAlive(s)).length > 0,
    posts: posts.map((p) => postOut(p, req.user.id)),
  });
});

app.get('/api/users/:id/:list', auth, (req, res, next) => {
  if (!['followers', 'following'].includes(req.params.list)) return next();
  const key = req.params.list === 'followers' ? ['to', 'from'] : ['from', 'to'];
  const ids = store.filter('follows', (f) => f[key[0]] === req.params.id).map((f) => f[key[1]]);
  res.json(ids.filter((id) => !isBlocked(req.user.id, id)).map((id) => brief(store.get('users', id))).filter(Boolean));
});

app.post('/api/users/:id/follow', auth, (req, res) => {
  const t = store.get('users', req.params.id);
  if (!t || t.id === req.user.id || isBlocked(req.user.id, t.id)) return res.status(400).json({ error: 'Geçersiz kullanıcı.' });
  const id = `${req.user.id}_${t.id}`;
  if (store.get('follows', id)) {
    store.del('follows', id);
    return res.json({ following: false });
  }
  store.put('follows', { id, from: req.user.id, to: t.id, at: now() });
  notify(t.id, { type: 'follow', fromId: req.user.id, text: `${req.user.username} seni takip etmeye başladı.`, url: `/#/u/${req.user.username}` });
  res.json({ following: true });
});

function unmatch(a, b) {
  const mid = [a, b].sort().join('_');
  store.del('matches', mid);
  const s = store.get('swipes', `${a}_${b}`);
  if (s) store.update('swipes', s.id, { dir: 'left' });
  else store.put('swipes', { id: `${a}_${b}`, from: a, to: b, dir: 'left', at: now() });
  removeChat(mid);
}

app.post('/api/users/:id/block', auth, (req, res) => {
  const t = store.get('users', req.params.id);
  if (!t || t.id === req.user.id) return res.status(400).json({ error: 'Geçersiz kullanıcı.' });
  const me = req.user.id;
  store.put('blocks', { id: `${me}_${t.id}`, from: me, to: t.id, at: now() });
  store.del('follows', `${me}_${t.id}`); store.del('follows', `${t.id}_${me}`);
  unmatch(me, t.id);
  emitTo(t.id, 'blocked', { by: me });
  res.json({ ok: true });
});
app.delete('/api/users/:id/block', auth, (req, res) => {
  store.del('blocks', `${req.user.id}_${req.params.id}`);
  res.json({ ok: true });
});
app.post('/api/users/:id/report', auth, (req, res) => {
  const t = store.get('users', req.params.id);
  if (!t) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  if (limited('rep:' + req.user.id, 10, DAY)) return res.status(429).json({ error: 'Bugün çok fazla şikayet gönderdin.' });
  store.put('reports', {
    id: nanoid(12), from: req.user.id, to: t.id, reason: String(req.body?.reason || 'diğer').slice(0, 40),
    details: String(req.body?.details || '').slice(0, 1000), ref: req.body?.ref || null, at: now(), status: 'open',
  });
  console.log(`[report] ${req.user.username} -> ${t.username}: ${req.body?.reason}`);
  res.json({ ok: true });
});
app.post('/api/users/:id/unmatch', auth, (req, res) => {
  unmatch(req.user.id, req.params.id);
  res.json({ ok: true });
});

// ---------- Kaydırma ----------
app.get('/api/swipe/deck', auth, (req, res) => {
  const me = req.user;
  const prefs = me.prefs || { ageMin: 18, ageMax: 99, maxKm: null };
  const swiped = new Set(store.filter('swipes', (s) => s.from === me.id).map((s) => s.to));
  let deck = store.filter('users', (u) => u.id !== me.id && !swiped.has(u.id) && !isBlocked(me.id, u.id));
  if (me.lookingFor && me.lookingFor !== 'all') deck = deck.filter((u) => u.gender === me.lookingFor || !u.gender);
  deck = deck.filter((u) => !u.age || (u.age >= prefs.ageMin && u.age <= prefs.ageMax));
  if (prefs.maxKm && me.lat != null) deck = deck.filter((u) => { const d = distance(me, u); return d == null || d <= prefs.maxKm; });
  const likedMe = new Set(store.filter('swipes', (s) => s.to === me.id && s.dir !== 'left').map((s) => s.from));
  rankPeople(deck);
  res.json(deck.slice(0, 40).map((u) => {
    const posts = store.filter('posts', (p) => p.userId === u.id && p.type === 'image').slice(0, 3).map((p) => p.media);
    const photos = [...(u.photos || []), ...posts].filter(Boolean);
    return {
      ...brief(u), age: u.age, city: u.city, bio: u.bio, interests: u.interests || [],
      distanceKm: distance(me, u), likedYou: likedMe.has(u.id),
      photos: photos.length ? photos : [u.avatar],
    };
  }));
});

app.get('/api/likes', auth, (req, res) => {
  const me = req.user.id;
  const mySwipes = new Set(store.filter('swipes', (s) => s.from === me).map((s) => s.to));
  const list = store.filter('swipes', (s) => s.to === me && s.dir !== 'left' && !mySwipes.has(s.from) && !isBlocked(me, s.from))
    .sort((a, b) => b.at - a.at)
    .map((s) => { const u = store.get('users', s.from); return u && { ...brief(u), age: u.age, city: u.city, super: s.dir === 'super', at: s.at, photo: (u.photos || [])[0] || u.avatar }; })
    .filter(Boolean);
  res.json(list);
});

app.post('/api/swipe', auth, (req, res) => {
  const { to, dir } = req.body || {};
  const t = store.get('users', to);
  if (!t || t.id === req.user.id || !['left', 'right', 'super'].includes(dir) || isBlocked(req.user.id, to)) return res.status(400).json({ error: 'Geçersiz istek.' });
  const me = req.user;
  store.put('swipes', { id: `${me.id}_${t.id}`, from: me.id, to: t.id, dir, at: now() });
  if (dir === 'left') return res.json({ match: false });

  const back = () => store.get('swipes', `${t.id}_${me.id}`);
  if (!back() || back().dir === 'left') {
    notify(t.id, dir === 'super'
      ? { type: 'super', fromId: me.id, text: `${me.username} sana süper beğeni gönderdi ⭐️`, url: '/#/likes' }
      : { type: 'liked', fromId: me.id, text: 'Biri seni beğendi 💜 Kim olduğunu görmek için dokun.', url: '/#/likes' });
    emitTo(t.id, 'likes:new', {});
  }
  if (back() && back().dir !== 'left') {
    const mid = [me.id, t.id].sort().join('_');
    if (!store.get('matches', mid)) {
      store.put('matches', { id: mid, users: [me.id, t.id], at: now() });
      const chat = chatBetween(me.id, t.id);
      notify(t.id, { type: 'match', fromId: me.id, text: `${me.name} ile eşleştin! 💘`, url: `/#/chat/${chat.id}` });
      emitTo(t.id, 'match', { user: brief(me), chatId: chat.id });
      return res.json({ match: true, user: brief(t), chatId: chat.id });
    }
  }
  res.json({ match: false });
});

app.post('/api/swipe/reset', auth, (req, res) => {
  store.filter('swipes', (s) => s.from === req.user.id && s.dir === 'left').forEach((s) => store.del('swipes', s.id));
  res.json({ ok: true });
});

app.get('/api/matches', auth, (req, res) => {
  const ms = store.filter('matches', (m) => m.users.includes(req.user.id)).sort((a, b) => b.at - a.at);
  res.json(ms.map((m) => {
    const other = m.users.find((x) => x !== req.user.id);
    return { id: m.id, at: m.at, chatId: [req.user.id, other].sort().join('_'), user: brief(store.get('users', other)) };
  }).filter((m) => m.user && !isBlocked(req.user.id, m.user.id)));
});

// ---------- Sohbetler ----------
app.get('/api/chats', auth, (req, res) => {
  const me = req.user.id;
  const list = store.filter('chats', (c) => c.members.includes(me))
    .map((c) => chatOut(c, me))
    .filter((c) => (c.isGroup || c.last || store.get('matches', c.id)) && !c.blocked)
    .sort((a, b) => (b.last?.at || b.lastAt) - (a.last?.at || a.lastAt));
  res.json(list);
});

app.post('/api/chats', auth, (req, res) => {
  const t = store.get('users', req.body?.userId);
  if (!t) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  if (isBlocked(req.user.id, t.id)) return res.status(403).json({ error: 'Bu kişiyle mesajlaşamazsın.' });
  res.json(chatOut(chatBetween(req.user.id, t.id), req.user.id));
});

app.get('/api/chats/:id', auth, (req, res) => {
  const c = store.get('chats', req.params.id);
  if (!c || !c.members.includes(req.user.id)) return res.status(404).json({ error: 'Sohbet bulunamadı.' });
  const msgs = store.filter('messages', (m) => m.chatId === c.id && !(m.hiddenFor || []).includes(req.user.id)).sort((a, b) => a.at - b.at);
  res.json({ ...chatOut(c, req.user.id), messages: msgs.slice(-400).map(msgOut) });
});

app.post('/api/chats/:id/messages', auth, (req, res) => {
  const c = store.get('chats', req.params.id);
  if (!c || !c.members.includes(req.user.id)) return res.status(404).json({ error: 'Sohbet bulunamadı.' });
  const msg = sendMessage(c, req.user.id, req.body || {});
  if (!msg) return res.status(400).json({ error: 'Mesaj gönderilemedi.' });
  res.json(msg);
});

app.delete('/api/chats/:id', auth, (req, res) => {
  // Sohbeti sadece kendinden temizle
  const c = store.get('chats', req.params.id);
  if (!c || !c.members.includes(req.user.id)) return res.status(404).json({ error: 'Sohbet bulunamadı.' });
  store.filter('messages', (m) => m.chatId === c.id).forEach((m) => {
    m.hiddenFor = [...new Set([...(m.hiddenFor || []), req.user.id])]; store.update('messages', m.id, {});
  });
  res.json({ ok: true });
});

// ---------- Gruplar ----------
function systemMsg(chat, text) { return sendMessage(chat, chat.members[0], { text, system: true }); }
app.post('/api/groups', auth, (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 50);
  const ids = [...new Set((req.body?.memberIds || []).map(String))].filter((id) => id !== req.user.id && store.get('users', id) && !isBlocked(req.user.id, id));
  if (!name) return res.status(400).json({ error: 'Gruba bir ad ver.' });
  if (!ids.length) return res.status(400).json({ error: 'En az bir kişi seç.' });
  const chat = store.put('chats', {
    id: 'g_' + nanoid(12), isGroup: true, name, avatar: groupAvatar(name),
    members: [req.user.id, ...ids].slice(0, 100), admins: [req.user.id], createdAt: now(), lastAt: now(),
  });
  systemMsg(chat, `${req.user.name} grubu oluşturdu`);
  ids.forEach((id) => notify(id, { type: 'group', fromId: req.user.id, text: `${req.user.name} seni "${name}" grubuna ekledi.`, url: `/#/chat/${chat.id}` }));
  res.json(chatOut(chat, req.user.id));
});
app.patch('/api/groups/:id', auth, (req, res) => {
  const c = store.get('chats', req.params.id);
  if (!c?.isGroup || !c.members.includes(req.user.id)) return res.status(404).json({ error: 'Grup bulunamadı.' });
  const patch = {};
  if (req.body?.name) { patch.name = String(req.body.name).trim().slice(0, 50); }
  if (req.body?.avatar) patch.avatar = String(req.body.avatar).slice(0, 500);
  store.update('chats', c.id, patch);
  if (patch.name) systemMsg(c, `${req.user.name} grup adını "${patch.name}" yaptı`);
  c.members.forEach((m) => emitTo(m, 'chat:update', { chatId: c.id }));
  res.json(chatOut(c, req.user.id));
});
app.post('/api/groups/:id/members', auth, (req, res) => {
  const c = store.get('chats', req.params.id);
  if (!c?.isGroup || !c.members.includes(req.user.id)) return res.status(404).json({ error: 'Grup bulunamadı.' });
  const add = (req.body?.userIds || []).map(String).filter((id) => !c.members.includes(id) && store.get('users', id) && !isBlocked(req.user.id, id));
  if (!add.length) return res.status(400).json({ error: 'Eklenecek kişi seç.' });
  c.members.push(...add); store.update('chats', c.id, {});
  systemMsg(c, `${req.user.name}, ${add.map((id) => store.get('users', id).name.split(' ')[0]).join(', ')} kişisini ekledi`);
  add.forEach((id) => notify(id, { type: 'group', fromId: req.user.id, text: `${req.user.name} seni "${c.name}" grubuna ekledi.`, url: `/#/chat/${c.id}` }));
  c.members.forEach((m) => emitTo(m, 'chat:update', { chatId: c.id }));
  res.json(chatOut(c, req.user.id));
});
app.delete('/api/groups/:id/members/:uid', auth, (req, res) => {
  const c = store.get('chats', req.params.id);
  const uid = req.params.uid;
  if (!c?.isGroup || !c.members.includes(req.user.id)) return res.status(404).json({ error: 'Grup bulunamadı.' });
  if (uid !== req.user.id && !c.admins.includes(req.user.id)) return res.status(403).json({ error: 'Sadece yöneticiler üye çıkarabilir.' });
  const u = store.get('users', uid);
  systemMsg(c, uid === req.user.id ? `${req.user.name} gruptan ayrıldı` : `${req.user.name}, ${u?.name || 'bir üyeyi'} gruptan çıkardı`);
  c.members = c.members.filter((m) => m !== uid);
  c.admins = c.admins.filter((m) => m !== uid);
  if (!c.admins.length && c.members.length) c.admins.push(c.members[0]);
  store.update('chats', c.id, {});
  emitTo(uid, 'chat:removed', { chatId: c.id });
  c.members.forEach((m) => emitTo(m, 'chat:update', { chatId: c.id }));
  res.json({ ok: true });
});

// ---------- Bildirim listesi ----------
app.get('/api/notifications', auth, (req, res) => {
  const list = store.filter('notifications', (n) => n.userId === req.user.id && !isBlocked(req.user.id, n.fromId)).sort((a, b) => b.at - a.at).slice(0, 100);
  res.json(list.map((n) => ({ ...n, from: n.type === 'liked' ? null : brief(store.get('users', n.fromId)) })));
});
app.post('/api/notifications/read', auth, (req, res) => {
  store.filter('notifications', (n) => n.userId === req.user.id && !n.read).forEach((n) => store.update('notifications', n.id, { read: true }));
  res.json({ ok: true });
});
app.get('/api/badges', auth, (req, res) => {
  const me = req.user.id;
  const notifs = store.filter('notifications', (n) => n.userId === me && !n.read).length;
  const chats = new Set(store.filter('chats', (c) => c.members.includes(me)).map((c) => c.id));
  const msgs = store.filter('messages', (m) => chats.has(m.chatId) && m.from !== me && !m.system && !m.readBy.includes(me) && !(m.hiddenFor || []).includes(me));
  const mySwipes = new Set(store.filter('swipes', (s) => s.from === me).map((s) => s.to));
  const likes = store.filter('swipes', (s) => s.to === me && s.dir !== 'left' && !mySwipes.has(s.from)).length;
  res.json({ notifications: notifs, messages: new Set(msgs.map((m) => m.chatId)).size, likes });
});

// ---------- Canlı ----------
const liveOut = (l) => ({ userId: l.userId, title: l.title, startedAt: l.startedAt, viewers: l.viewers.size, user: brief(store.get('users', l.userId)) });
app.get('/api/lives', auth, (req, res) => res.json([...lives.values()].map(liveOut)));

// ---------- Statik ----------
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, p) {
    if (p.endsWith('sw.js') || p.endsWith('.html') || p.endsWith('.js') || p.endsWith('.css')) res.setHeader('Cache-Control', 'no-cache');
  },
}));
app.get(/^\/(?!api|media|socket\.io).*/, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Dosya en fazla 40 MB olabilir.' });
  res.status(500).json({ error: 'Sunucu hatası, tekrar dene.' });
});

// ================= Socket.IO =================
io.use((socket, next) => {
  try {
    const { id } = jwt.verify(socket.handshake.auth?.token, JWT_SECRET);
    const u = store.get('users', id);
    if (!u) return next(new Error('unauthorized'));
    socket.data.userId = u.id;
    socket.data.visible = true;
    next();
  } catch { next(new Error('unauthorized')); }
});

function broadcastPresence(userId) {
  const u = store.get('users', userId);
  io.emit('presence', { userId, online: isOnline(userId), lastSeen: u?.lastSeen });
}

function endLive(userId) {
  const l = lives.get(userId);
  if (!l) return;
  lives.delete(userId);
  io.to(`live:${userId}`).emit('live:ended', { userId });
  io.emit('lives', [...lives.values()].map(liveOut));
}

function finishCall(call, reason) {
  if (!call || call.state === 'ended') return;
  clearTimeout(call.timer);
  const was = call.state;
  call.state = 'ended';
  calls.delete(call.id);
  [call.from, call.to].forEach((u) => emitTo(u, 'call:ended', { callId: call.id, reason }));
  const chat = store.get('chats', call.chatId);
  if (!chat) return;
  const kind = call.video ? 'Görüntülü arama' : 'Sesli arama';
  if (was === 'active') {
    const secs = Math.round((now() - call.answeredAt) / 1000);
    sendMessage(chat, call.from, { text: `📞 ${kind} · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, system: true });
  } else {
    sendMessage(chat, call.from, { text: `📵 Cevapsız ${kind.toLowerCase()}`, system: true });
    if (reason === 'timeout') notify(call.to, { type: 'missed', fromId: call.from, text: `${store.get('users', call.from)?.name} seni aradı`, url: `/#/chat/${chat.id}` });
  }
}

io.on('connection', (socket) => {
  const uid = socket.data.userId;
  if (!online.has(uid)) online.set(uid, new Set());
  const wasOnline = isOnline(uid);
  online.get(uid).add(socket);
  if (!wasOnline) broadcastPresence(uid);
  store.update('users', uid, { lastSeen: now() });

  const myChats = new Set(store.filter('chats', (c) => c.members.includes(uid)).map((c) => c.id));
  store.filter('messages', (m) => myChats.has(m.chatId) && !m.deliveredTo.includes(uid)).forEach((m) => {
    m.deliveredTo.push(uid); store.update('messages', m.id, {});
    emitTo(m.from, 'delivered', { id: m.id, chatId: m.chatId, userId: uid });
  });

  socket.emit('lives', [...lives.values()].map(liveOut));
  socket.emit('presence:all', [...online.keys()].filter(isOnline));
  // Çalan bir arama varsa (uygulama bildirimden açıldıysa) tekrar göster
  for (const c of calls.values()) {
    if (c.to === uid && c.state === 'ringing') socket.emit('call:incoming', { callId: c.id, chatId: c.chatId, video: c.video, from: brief(store.get('users', c.from)) });
  }

  socket.on('visibility', (v) => { socket.data.visible = !!v; });

  socket.on('message:send', (data, ack) => {
    const c = store.get('chats', data?.chatId);
    if (!c || !c.members.includes(uid)) return ack?.({ error: 'Sohbet bulunamadı.' });
    if (limited('msg:' + uid, 60, 60000)) return ack?.({ error: 'Çok hızlı mesaj gönderiyorsun.' });
    const msg = sendMessage(c, uid, { ...data, system: false });
    ack?.(msg ? { ok: true, msg } : { error: 'Mesaj gönderilemedi.' });
  });

  socket.on('message:react', ({ id, emoji }) => {
    const m = store.get('messages', id);
    const c = m && store.get('chats', m.chatId);
    if (!c || !c.members.includes(uid) || m.deleted) return;
    m.reactions = m.reactions || {};
    if (!emoji || m.reactions[uid] === emoji) delete m.reactions[uid]; else m.reactions[uid] = String(emoji).slice(0, 8);
    store.update('messages', m.id, {});
    c.members.forEach((x) => emitTo(x, 'message:update', msgOut(m)));
    if (m.reactions[uid] && m.from !== uid) {
      notify(m.from, { type: 'message', fromId: uid, tag: 'chat-' + c.id, title: store.get('users', uid).name, text: `${m.reactions[uid]} mesajına tepki verdi`, url: `/#/chat/${c.id}` });
    }
  });

  socket.on('message:delete', ({ id, forAll }) => {
    const m = store.get('messages', id);
    const c = m && store.get('chats', m.chatId);
    if (!c || !c.members.includes(uid)) return;
    if (forAll && m.from === uid) {
      m.deleted = true; m.text = ''; m.media = null; m.reactions = {};
      store.update('messages', m.id, {});
      c.members.forEach((x) => emitTo(x, 'message:update', msgOut(m)));
    } else {
      m.hiddenFor = [...new Set([...(m.hiddenFor || []), uid])];
      store.update('messages', m.id, {});
      emitTo(uid, 'message:hidden', { id: m.id, chatId: c.id });
    }
  });

  socket.on('typing', ({ chatId, typing, kind }) => {
    const c = store.get('chats', chatId);
    if (!c || !c.members.includes(uid)) return;
    c.members.filter((m) => m !== uid).forEach((m) => emitTo(m, 'typing', { chatId, userId: uid, typing: !!typing, kind: kind === 'audio' ? 'audio' : 'text' }));
  });

  socket.on('read', ({ chatId }) => {
    const c = store.get('chats', chatId);
    if (!c || !c.members.includes(uid)) return;
    store.filter('messages', (m) => m.chatId === chatId && !m.readBy.includes(uid)).forEach((m) => {
      m.readBy.push(uid); store.update('messages', m.id, {});
    });
    c.members.forEach((m) => emitTo(m, 'read', { chatId, userId: uid, at: now() }));
  });

  // ---- Sesli / görüntülü arama ----
  socket.on('call:start', ({ chatId, video }, ack) => {
    const c = store.get('chats', chatId);
    if (!c || c.isGroup || !c.members.includes(uid)) return ack?.({ error: 'Arama başlatılamadı.' });
    const to = c.members.find((m) => m !== uid);
    if (isBlocked(uid, to)) return ack?.({ error: 'Bu kişiyi arayamazsın.' });
    if ([...calls.values()].some((x) => [x.from, x.to].includes(to))) return ack?.({ error: 'Kişi şu an başka bir görüşmede.' });
    const call = { id: nanoid(10), chatId, from: uid, to, video: !!video, state: 'ringing', at: now(), callerSocket: socket.id };
    calls.set(call.id, call);
    const peer = store.get('users', to);
    emitTo(to, 'call:incoming', { callId: call.id, chatId, video: call.video, from: brief(store.get('users', uid)) });
    notify(to, { type: 'call', fromId: uid, tag: 'call-' + call.id, title: store.get('users', uid).name, text: video ? '📹 Görüntülü arama geliyor' : '📞 Sesli arama geliyor', url: `/#/chat/${chatId}` });
    call.timer = setTimeout(() => finishCall(call, 'timeout'), 35000);
    ack?.({ ok: true, callId: call.id, peer: brief(peer) });
  });

  socket.on('call:accept', ({ callId }) => {
    const call = calls.get(callId);
    if (!call || call.to !== uid || call.state !== 'ringing') return;
    clearTimeout(call.timer);
    call.state = 'active'; call.answeredAt = now(); call.calleeSocket = socket.id;
    io.to(call.callerSocket).emit('call:accepted', { callId, peerSocket: socket.id });
    online.get(uid)?.forEach((s) => { if (s.id !== socket.id) s.emit('call:taken', { callId }); });
  });
  socket.on('call:reject', ({ callId }) => { const c = calls.get(callId); if (c && [c.from, c.to].includes(uid)) finishCall(c, 'rejected'); });
  socket.on('call:end', ({ callId }) => { const c = calls.get(callId); if (c && [c.from, c.to].includes(uid)) finishCall(c, 'ended'); });
  socket.on('call:signal', ({ to, data }) => { if (typeof to === 'string') io.to(to).emit('call:signal', { from: socket.id, data }); });

  // ---- Canlı yayın ----
  socket.on('live:start', ({ title } = {}, ack) => {
    endLive(uid);
    lives.set(uid, { userId: uid, socketId: socket.id, title: String(title || '').slice(0, 80), startedAt: now(), viewers: new Set() });
    socket.join(`live:${uid}`);
    io.emit('lives', [...lives.values()].map(liveOut));
    const me = store.get('users', uid);
    const notified = new Set();
    store.filter('follows', (f) => f.to === uid).forEach((f) => notified.add(f.from));
    store.filter('matches', (m) => m.users.includes(uid)).forEach((m) => m.users.forEach((x) => x !== uid && notified.add(x)));
    notified.forEach((id) => notify(id, {
      type: 'live', fromId: uid, tag: 'live-' + uid,
      text: `${me.username} canlı yayında 🔴 ${title || ''}`.trim(), url: `/#/live/${uid}`,
    }));
    ack?.({ ok: true });
  });
  socket.on('live:stop', () => endLive(uid));
  socket.on('live:join', ({ hostId }, ack) => {
    const l = lives.get(hostId);
    if (!l || isBlocked(uid, hostId)) return ack?.({ error: 'Yayın sona erdi.' });
    l.viewers.add(socket.id);
    socket.join(`live:${hostId}`);
    socket.data.watching = hostId;
    io.to(l.socketId).emit('live:viewer', { viewerId: socket.id, user: brief(store.get('users', uid)) });
    io.to(`live:${hostId}`).emit('live:count', { hostId, viewers: l.viewers.size });
    io.to(`live:${hostId}`).emit('live:comment', { hostId, system: true, user: brief(store.get('users', uid)), text: 'katıldı 👋', at: now() });
    ack?.({ ok: true, live: liveOut(l) });
  });
  const leave = () => {
    const hostId = socket.data.watching;
    const l = hostId && lives.get(hostId);
    if (!l) return;
    l.viewers.delete(socket.id);
    socket.leave(`live:${hostId}`);
    socket.data.watching = null;
    io.to(l.socketId).emit('live:viewer-left', { viewerId: socket.id });
    io.to(`live:${hostId}`).emit('live:count', { hostId, viewers: l.viewers.size });
  };
  socket.on('live:leave', leave);
  socket.on('live:signal', ({ to, data }) => { if (typeof to === 'string') io.to(to).emit('live:signal', { from: socket.id, data }); });
  socket.on('live:comment', ({ hostId, text }) => {
    text = String(text || '').trim().slice(0, 200);
    if (!text || !lives.has(hostId) || limited('lc:' + uid, 20, 30000)) return;
    io.to(`live:${hostId}`).emit('live:comment', { hostId, user: brief(store.get('users', uid)), text, at: now() });
  });
  socket.on('live:heart', ({ hostId }) => { if (lives.has(hostId) && !limited('lh:' + uid, 30, 10000)) io.to(`live:${hostId}`).emit('live:heart', { hostId }); });

  socket.on('disconnect', () => {
    leave();
    const l = lives.get(uid);
    if (l && l.socketId === socket.id) endLive(uid);
    for (const c of calls.values()) {
      if (c.callerSocket === socket.id || c.calleeSocket === socket.id) finishCall(c, 'ended');
    }
    online.get(uid)?.delete(socket);
    if (!isOnline(uid)) {
      online.delete(uid);
      store.update('users', uid, { lastSeen: now() });
      broadcastPresence(uid);
    }
  });
});

// Eski sürümden kalan örnek hesapları ve izlerini tamamen sil
function purgeDemo() {
  const bots = new Set(store.filter('users', (u) => u.isBot).map((u) => u.id));
  if (!bots.size) return;
  const has = (id) => bots.has(id);
  store.filter('posts', (p) => has(p.userId)).forEach((p) => store.del('posts', p.id));
  store.filter('posts', () => true).forEach((p) => {
    const likes = p.likes.filter((x) => !has(x)); const comments = p.comments.filter((c) => !has(c.userId));
    if (likes.length !== p.likes.length || comments.length !== p.comments.length) store.update('posts', p.id, { likes, comments });
  });
  store.filter('stories', (x) => has(x.userId)).forEach((x) => store.del('stories', x.id));
  ['follows', 'swipes', 'blocks'].forEach((c) => store.filter(c, (x) => has(x.from) || has(x.to)).forEach((x) => store.del(c, x.id)));
  store.filter('matches', (m) => m.users.some(has)).forEach((m) => store.del('matches', m.id));
  store.filter('chats', (c) => !c.isGroup && c.members.some(has)).forEach((c) => removeChat(c.id));
  store.filter('chats', (c) => c.isGroup && c.members.some(has)).forEach((c) => store.update('chats', c.id, { members: c.members.filter((m) => !has(m)) }));
  store.filter('notifications', (n) => has(n.fromId) || has(n.userId)).forEach((n) => store.del('notifications', n.id));
  bots.forEach((id) => store.del('users', id));
  store.del('meta', 'seed');
  console.log(`[purge] ${bots.size} örnek hesap silindi`);
}

// ================= Başlat =================
(async () => {
  await store.init();
  const meta = store.get('meta', 'secrets') || store.put('meta', {
    id: 'secrets',
    jwt: crypto.randomBytes(32).toString('hex'),
    vapid: webpush.generateVAPIDKeys(),
  });
  JWT_SECRET = JWT_SECRET || meta.jwt;
  VAPID = process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
    ? { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY }
    : meta.vapid;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@swipeup.app', VAPID.publicKey, VAPID.privateKey);
  purgeDemo();
  server.listen(PORT, () => console.log(`SwipeUp http://localhost:${PORT}`));

  // Render ücretsiz planda uykuya geçmemek için kendine ping at
  const selfUrl = process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL;
  if (selfUrl && process.env.KEEP_ALIVE !== '0' && !process.env.CANONICAL_URL) {
    setInterval(() => fetch(selfUrl + '/healthz').catch(() => {}), 10 * 60000).unref();
    console.log('[keepalive] açık:', selfUrl);
  }
})();

const shutdown = async () => { await store.close().catch(() => {}); process.exit(0); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

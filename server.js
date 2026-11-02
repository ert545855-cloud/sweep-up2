// Sweep Up — Express + Socket.IO sunucusu
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
const { nanoid } = require('nanoid');
const { Server } = require('socket.io');
const store = require('./server/store');
const { seed } = require('./server/seed');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true }, maxHttpBufferSize: 1e6 });

let JWT_SECRET = process.env.JWT_SECRET;
let VAPID = null;

// ---------- Yardımcılar ----------
const now = () => Date.now();
const online = new Map(); // userId -> Set<socket>
const lives = new Map(); // userId -> { userId, socketId, title, startedAt, viewers:Set }

function pub(u, viewerId) {
  if (!u) return null;
  const { passHash, ...rest } = u;
  return {
    ...rest,
    online: isOnline(u.id),
    live: lives.has(u.id),
    ...(viewerId ? { isFollowing: !!store.get('follows', `${viewerId}_${u.id}`) } : {}),
  };
}
const brief = (u) => u && ({
  id: u.id, username: u.username, name: u.name, avatar: u.avatar,
  online: isOnline(u.id), live: lives.has(u.id), lastSeen: u.lastSeen,
});
const isOnline = (id) => (online.get(id)?.size || 0) > 0;
const emitTo = (userId, ev, data) => online.get(userId)?.forEach((s) => s.emit(ev, data));

function postOut(p, viewerId) {
  return {
    ...p,
    user: brief(store.get('users', p.userId)),
    likeCount: p.likes.length,
    liked: p.likes.includes(viewerId),
    commentCount: p.comments.length,
    comments: undefined,
    likes: undefined,
    saved: undefined,
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

// ---------- Bildirimler ----------
async function notify(userId, n) {
  if (!userId || userId === n.fromId) return;
  const from = n.fromId ? store.get('users', n.fromId) : null;
  let doc = null;
  if (n.type !== 'message') {
    doc = store.put('notifications', {
      id: nanoid(12), userId, type: n.type, fromId: n.fromId || null,
      ref: n.ref || null, text: n.text, at: now(), read: false,
    });
    emitTo(userId, 'notification', { ...doc, from: brief(from) });
  }
  // Uygulama açık ve görünürse push gönderme; uygulama içi bildirim yeterli.
  const visible = [...(online.get(userId) || [])].some((s) => s.data.visible);
  if (visible || !VAPID) return;
  const payload = JSON.stringify({
    title: n.title || (from ? from.name : 'Sweep Up'),
    body: n.text,
    icon: from?.avatar && !from.avatar.endsWith('svg') ? from.avatar : '/icons/icon-192.png',
    url: n.url || '/#/notifications',
    tag: n.tag || n.type,
  });
  const subs = store.filter('pushSubs', (s) => s.userId === userId);
  await Promise.all(subs.map((s) => webpush.sendNotification(s.sub, payload, { TTL: 3600 })
    .catch((e) => { if (e.statusCode === 404 || e.statusCode === 410) store.del('pushSubs', s.id); })));
}

// ---------- Sohbet ----------
function chatBetween(a, b) {
  const id = [a, b].sort().join('_');
  return store.get('chats', id) || store.put('chats', { id, members: [a, b].sort(), createdAt: now(), lastAt: now() });
}

function chatOut(c, me) {
  const otherId = c.members.find((m) => m !== me) || me;
  const msgs = store.filter('messages', (m) => m.chatId === c.id);
  msgs.sort((x, y) => x.at - y.at);
  const last = msgs[msgs.length - 1] || null;
  const unread = msgs.filter((m) => m.from !== me && !m.readBy.includes(me)).length;
  return { id: c.id, other: brief(store.get('users', otherId)), last, unread, lastAt: c.lastAt };
}

function sendMessage(chat, fromId, { text, media, mediaType }) {
  text = String(text || '').slice(0, 4000).trim();
  if (!text && !media) return null;
  const msg = store.put('messages', {
    id: nanoid(14), chatId: chat.id, from: fromId, text,
    media: media || null, mediaType: mediaType || null,
    at: now(), readBy: [fromId], deliveredTo: [fromId],
  });
  store.update('chats', chat.id, { lastAt: msg.at });
  for (const m of chat.members) {
    if (m !== fromId && isOnline(m)) msg.deliveredTo.push(m);
  }
  store.update('messages', msg.id, {});
  chat.members.forEach((m) => emitTo(m, 'message', msg));
  const sender = store.get('users', fromId);
  chat.members.filter((m) => m !== fromId).forEach((m) => {
    notify(m, {
      type: 'message', fromId, tag: 'chat-' + chat.id,
      title: sender.name, text: text || (mediaType === 'video' ? '🎥 Video' : '📷 Fotoğraf'),
      url: `/#/chat/${chat.id}`,
    });
    const bot = store.get('users', m);
    if (bot?.isBot) botReply(chat, bot, text);
  });
  return msg;
}

const BOT_LINES = [
  'Haha, aynen öyle 😄', 'Sen ne yapıyorsun bu aralar?', 'Bu hafta sonu planın var mı?',
  'Profilindeki fotoğraflar çok iyi bu arada', 'Kahve mi çay mı? ☕️🍵', 'Ciddi misin 😂',
  'En son hangi diziyi bitirdin?', 'Bunu sevdim 🙌',
];
function botReply(chat, bot, text) {
  setTimeout(() => {
    chat.members.forEach((m) => emitTo(m, 'typing', { chatId: chat.id, userId: bot.id, typing: true }));
    setTimeout(() => {
      chat.members.forEach((m) => emitTo(m, 'typing', { chatId: chat.id, userId: bot.id, typing: false }));
      // botun mesajları okuması
      const unread = store.filter('messages', (x) => x.chatId === chat.id && !x.readBy.includes(bot.id));
      unread.forEach((x) => { x.readBy.push(bot.id); store.update('messages', x.id, {}); });
      chat.members.forEach((m) => emitTo(m, 'read', { chatId: chat.id, userId: bot.id, at: now() }));
      const reply = /merhaba|selam|hey|slm/i.test(text)
        ? `Selam! 👋 Ben ${bot.name.split(' ')[0]}. Nasılsın?`
        : BOT_LINES[Math.floor(Math.random() * BOT_LINES.length)];
      sendMessage(chat, bot.id, { text: reply });
    }, 1400 + Math.random() * 1200);
  }, 800);
}

// ---------- Express ----------
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.get('/api/config', (req, res) => {
  const ice = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (process.env.TURN_URL) {
    ice.push({ urls: process.env.TURN_URL.split(','), username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
  }
  res.json({ vapidPublicKey: VAPID?.publicKey || null, iceServers: ice });
});

// Kimlik doğrulama
app.post('/api/auth/register', wrap(async (req, res) => {
  let { username, name, password } = req.body || {};
  username = String(username || '').toLowerCase().trim();
  name = String(name || '').trim().slice(0, 40);
  if (!/^[a-z0-9._]{3,24}$/.test(username)) return res.status(400).json({ error: 'Kullanıcı adı 3–24 karakter olmalı; harf, rakam, nokta ve alt çizgi kullanılabilir.' });
  if (String(password || '').length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı.' });
  if (store.find('users', (u) => u.username === username)) return res.status(409).json({ error: 'Bu kullanıcı adı alınmış.' });
  const u = store.put('users', {
    id: nanoid(10), username, name: name || username,
    bio: '', age: null, gender: null, lookingFor: 'all', city: '', interests: [],
    avatar: `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(username)}&backgroundColor=efefef`,
    photos: [], passHash: await bcrypt.hash(password, 10), isBot: false,
    createdAt: now(), lastSeen: now(),
  });
  // Yeni kullanıcı örnek hesapların birkaçını takip etsin ki akış boş kalmasın
  store.filter('users', (x) => x.isBot).slice(0, 5).forEach((b) => {
    store.put('follows', { id: `${u.id}_${b.id}`, from: u.id, to: b.id, at: now() });
  });
  res.json({ token: sign(u), user: pub(u) });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const username = String(req.body?.username || '').toLowerCase().trim();
  const u = store.find('users', (x) => x.username === username && !x.isBot);
  if (!u || !(await bcrypt.compare(String(req.body?.password || ''), u.passHash))) {
    return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
  }
  res.json({ token: sign(u), user: pub(u) });
}));

app.get('/api/me', auth, (req, res) => res.json(pub(req.user)));

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
  if (b.username !== undefined) {
    const un = String(b.username).toLowerCase().trim();
    if (!/^[a-z0-9._]{3,24}$/.test(un)) return res.status(400).json({ error: 'Kullanıcı adı geçersiz.' });
    if (store.find('users', (u) => u.username === un && u.id !== req.user.id)) return res.status(409).json({ error: 'Bu kullanıcı adı alınmış.' });
    patch.username = un;
  }
  res.json(pub(store.update('users', req.user.id, patch)));
});

// Web push
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
    title: 'Sweep Up', body: 'Bildirimler çalışıyor 🎉', url: '/#/notifications', tag: 'test',
  })).catch(() => {})));
  res.json({ ok: true, count: subs.length });
}));

// Medya yükleme
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 40 * 1024 * 1024 } });
app.post('/api/upload', auth, upload.single('file'), wrap(async (req, res) => {
  const f = req.file;
  if (!f || !/^(image|video)\//.test(f.mimetype)) return res.status(400).json({ error: 'Sadece fotoğraf veya video yüklenebilir.' });
  const id = nanoid(16);
  await store.saveMedia(id, f.mimetype, f.buffer);
  res.json({ url: `/media/${id}`, type: f.mimetype.startsWith('video') ? 'video' : 'image' });
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

// Gönderiler
app.get('/api/feed', auth, (req, res) => {
  const me = req.user.id;
  const following = new Set(store.filter('follows', (f) => f.from === me).map((f) => f.to));
  following.add(me);
  let posts = store.filter('posts', (p) => p.type === 'image' && following.has(p.userId));
  if (posts.length < 6) posts = store.filter('posts', (p) => p.type === 'image');
  posts.sort((a, b) => b.createdAt - a.createdAt);
  res.json(posts.slice(0, 60).map((p) => postOut(p, me)));
});

app.get('/api/reels', auth, (req, res) => {
  const posts = store.filter('posts', (p) => p.type === 'reel');
  posts.sort((a, b) => b.createdAt - a.createdAt);
  res.json(posts.slice(0, 50).map((p) => postOut(p, req.user.id)));
});

app.get('/api/explore', auth, (req, res) => {
  const posts = store.all('posts');
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
  if (!p) return res.status(404).json({ error: 'Gönderi bulunamadı.' });
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
  res.json(p.comments.map((c) => ({ ...c, user: brief(store.get('users', c.userId)) })));
});

app.post('/api/posts/:id/comments', auth, (req, res) => {
  const p = store.get('posts', req.params.id);
  const text = String(req.body?.text || '').trim().slice(0, 500);
  if (!p || !text) return res.status(400).json({ error: 'Yorum boş olamaz.' });
  const c = { id: nanoid(10), userId: req.user.id, text, at: now() };
  p.comments.push(c);
  store.update('posts', p.id, {});
  notify(p.userId, { type: 'comment', fromId: req.user.id, ref: p.id, text: `${req.user.username} yorum yaptı: ${text.slice(0, 80)}`, url: `/#/p/${p.id}` });
  res.json({ ...c, user: brief(req.user) });
});

// Kullanıcılar
app.get('/api/users/search', auth, (req, res) => {
  const q = String(req.query.q || '').toLowerCase().trim();
  if (!q) return res.json([]);
  const list = store.filter('users', (u) => u.username.includes(q) || u.name.toLowerCase().includes(q));
  res.json(list.slice(0, 30).map(brief));
});

app.get('/api/users/:username', auth, (req, res) => {
  const u = store.find('users', (x) => x.username === req.params.username || x.id === req.params.username);
  if (!u) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  const posts = store.filter('posts', (p) => p.userId === u.id).sort((a, b) => b.createdAt - a.createdAt);
  res.json({
    ...pub(u, req.user.id),
    followers: store.filter('follows', (f) => f.to === u.id).length,
    following: store.filter('follows', (f) => f.from === u.id).length,
    followsYou: !!store.get('follows', `${u.id}_${req.user.id}`),
    posts: posts.map((p) => postOut(p, req.user.id)),
  });
});

app.get('/api/users/:id/:list', auth, (req, res, next) => {
  if (!['followers', 'following'].includes(req.params.list)) return next();
  const key = req.params.list === 'followers' ? ['to', 'from'] : ['from', 'to'];
  const ids = store.filter('follows', (f) => f[key[0]] === req.params.id).map((f) => f[key[1]]);
  res.json(ids.map((id) => brief(store.get('users', id))).filter(Boolean));
});

app.post('/api/users/:id/follow', auth, (req, res) => {
  const t = store.get('users', req.params.id);
  if (!t || t.id === req.user.id) return res.status(400).json({ error: 'Geçersiz kullanıcı.' });
  const id = `${req.user.id}_${t.id}`;
  if (store.get('follows', id)) {
    store.del('follows', id);
    return res.json({ following: false });
  }
  store.put('follows', { id, from: req.user.id, to: t.id, at: now() });
  notify(t.id, { type: 'follow', fromId: req.user.id, text: `${req.user.username} seni takip etmeye başladı.`, url: `/#/u/${req.user.username}` });
  res.json({ following: true });
});

// Kaydırma (eşleşme)
app.get('/api/swipe/deck', auth, (req, res) => {
  const me = req.user;
  const swiped = new Set(store.filter('swipes', (s) => s.from === me.id).map((s) => s.to));
  let deck = store.filter('users', (u) => u.id !== me.id && !swiped.has(u.id));
  if (me.lookingFor && me.lookingFor !== 'all') {
    const pref = deck.filter((u) => u.gender === me.lookingFor || !u.gender);
    if (pref.length) deck = pref;
  }
  deck.sort((a, b) => (isOnline(b.id) - isOnline(a.id)) || (b.lastSeen - a.lastSeen));
  res.json(deck.slice(0, 30).map((u) => {
    const posts = store.filter('posts', (p) => p.userId === u.id && p.type === 'image').slice(0, 3).map((p) => p.media);
    const photos = [...(u.photos || []), ...posts].filter(Boolean);
    return { ...brief(u), age: u.age, city: u.city, bio: u.bio, interests: u.interests || [], photos: photos.length ? photos : [u.avatar] };
  }));
});

app.post('/api/swipe', auth, (req, res) => {
  const { to, dir } = req.body || {};
  const t = store.get('users', to);
  if (!t || t.id === req.user.id || !['left', 'right', 'super'].includes(dir)) return res.status(400).json({ error: 'Geçersiz istek.' });
  const me = req.user;
  store.put('swipes', { id: `${me.id}_${t.id}`, from: me.id, to: t.id, dir, at: now() });
  if (dir === 'left') return res.json({ match: false });

  if (dir === 'super') notify(t.id, { type: 'super', fromId: me.id, text: `${me.username} sana süper beğeni gönderdi ⭐️`, url: '/#/swipe' });
  // Örnek hesaplar çoğu zaman geri beğenir
  if (t.isBot && !store.get('swipes', `${t.id}_${me.id}`) && Math.random() < (dir === 'super' ? 0.95 : 0.7)) {
    store.put('swipes', { id: `${t.id}_${me.id}`, from: t.id, to: me.id, dir: 'right', at: now() });
  }
  const back = store.get('swipes', `${t.id}_${me.id}`);
  if (back && back.dir !== 'left') {
    const mid = [me.id, t.id].sort().join('_');
    if (!store.get('matches', mid)) {
      store.put('matches', { id: mid, users: [me.id, t.id], at: now() });
      const chat = chatBetween(me.id, t.id);
      notify(t.id, { type: 'match', fromId: me.id, text: `${me.name} ile eşleştin! 💘`, url: `/#/chat/${chat.id}` });
      emitTo(t.id, 'match', { user: brief(me), chatId: chat.id });
      if (t.isBot) setTimeout(() => sendMessage(chat, t.id, { text: `Selam ${me.name.split(' ')[0]}! Eşleştiğimize sevindim 😊` }), 2500);
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
  }));
});

// Sohbetler
app.get('/api/chats', auth, (req, res) => {
  const list = store.filter('chats', (c) => c.members.includes(req.user.id))
    .map((c) => chatOut(c, req.user.id))
    .filter((c) => c.last || store.get('matches', c.id))
    .sort((a, b) => (b.last?.at || b.lastAt) - (a.last?.at || a.lastAt));
  res.json(list);
});

app.post('/api/chats', auth, (req, res) => {
  const t = store.get('users', req.body?.userId);
  if (!t) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  res.json(chatOut(chatBetween(req.user.id, t.id), req.user.id));
});

app.get('/api/chats/:id', auth, (req, res) => {
  const c = store.get('chats', req.params.id);
  if (!c || !c.members.includes(req.user.id)) return res.status(404).json({ error: 'Sohbet bulunamadı.' });
  const msgs = store.filter('messages', (m) => m.chatId === c.id).sort((a, b) => a.at - b.at);
  res.json({ ...chatOut(c, req.user.id), messages: msgs.slice(-300) });
});

app.post('/api/chats/:id/messages', auth, (req, res) => {
  const c = store.get('chats', req.params.id);
  if (!c || !c.members.includes(req.user.id)) return res.status(404).json({ error: 'Sohbet bulunamadı.' });
  const msg = sendMessage(c, req.user.id, req.body || {});
  if (!msg) return res.status(400).json({ error: 'Mesaj boş olamaz.' });
  res.json(msg);
});

// Bildirim listesi
app.get('/api/notifications', auth, (req, res) => {
  const list = store.filter('notifications', (n) => n.userId === req.user.id).sort((a, b) => b.at - a.at).slice(0, 100);
  res.json(list.map((n) => ({ ...n, from: brief(store.get('users', n.fromId)) })));
});
app.post('/api/notifications/read', auth, (req, res) => {
  store.filter('notifications', (n) => n.userId === req.user.id && !n.read).forEach((n) => store.update('notifications', n.id, { read: true }));
  res.json({ ok: true });
});
app.get('/api/badges', auth, (req, res) => {
  const me = req.user.id;
  const notifs = store.filter('notifications', (n) => n.userId === me && !n.read).length;
  const chats = store.filter('chats', (c) => c.members.includes(me)).map((c) => c.id);
  const set = new Set(chats);
  const msgs = store.filter('messages', (m) => set.has(m.chatId) && m.from !== me && !m.readBy.includes(me));
  res.json({ notifications: notifs, messages: new Set(msgs.map((m) => m.chatId)).size });
});

// Canlı yayınlar
const liveOut = (l) => ({ userId: l.userId, title: l.title, startedAt: l.startedAt, viewers: l.viewers.size, user: brief(store.get('users', l.userId)) });
app.get('/api/lives', auth, (req, res) => res.json([...lives.values()].map(liveOut)));

// Statik dosyalar
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, p) {
    if (p.endsWith('sw.js') || p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  },
}));
app.get(/^\/(?!api|media|socket\.io).*/, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Dosya en fazla 40 MB olabilir.' });
  res.status(500).json({ error: 'Sunucu hatası, tekrar dene.' });
});

// ---------- Socket.IO ----------
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

io.on('connection', (socket) => {
  const uid = socket.data.userId;
  if (!online.has(uid)) online.set(uid, new Set());
  const wasOnline = isOnline(uid);
  online.get(uid).add(socket);
  socket.join(`user:${uid}`);
  if (!wasOnline) broadcastPresence(uid);

  // Çevrim dışıyken gelen mesajları "iletildi" olarak işaretle
  const myChats = new Set(store.filter('chats', (c) => c.members.includes(uid)).map((c) => c.id));
  store.filter('messages', (m) => myChats.has(m.chatId) && !m.deliveredTo.includes(uid)).forEach((m) => {
    m.deliveredTo.push(uid); store.update('messages', m.id, {});
    emitTo(m.from, 'delivered', { id: m.id, chatId: m.chatId, userId: uid });
  });

  socket.emit('lives', [...lives.values()].map(liveOut));

  socket.on('visibility', (v) => { socket.data.visible = !!v; });

  socket.on('message:send', (data, ack) => {
    const c = store.get('chats', data?.chatId);
    if (!c || !c.members.includes(uid)) return ack?.({ error: 'Sohbet bulunamadı.' });
    const msg = sendMessage(c, uid, data);
    ack?.(msg ? { ok: true, msg } : { error: 'Mesaj boş.' });
  });

  socket.on('typing', ({ chatId, typing }) => {
    const c = store.get('chats', chatId);
    if (!c || !c.members.includes(uid)) return;
    c.members.filter((m) => m !== uid).forEach((m) => emitTo(m, 'typing', { chatId, userId: uid, typing: !!typing }));
  });

  socket.on('read', ({ chatId }) => {
    const c = store.get('chats', chatId);
    if (!c || !c.members.includes(uid)) return;
    store.filter('messages', (m) => m.chatId === chatId && !m.readBy.includes(uid)).forEach((m) => {
      m.readBy.push(uid); store.update('messages', m.id, {});
    });
    c.members.forEach((m) => emitTo(m, 'read', { chatId, userId: uid, at: now() }));
  });

  // --- Canlı yayın (WebRTC sinyal aktarımı) ---
  socket.on('live:start', ({ title } = {}, ack) => {
    endLive(uid);
    lives.set(uid, { userId: uid, socketId: socket.id, title: String(title || '').slice(0, 80), startedAt: now(), viewers: new Set() });
    socket.join(`live:${uid}`);
    io.emit('lives', [...lives.values()].map(liveOut));
    const me = store.get('users', uid);
    store.filter('follows', (f) => f.to === uid).forEach((f) => notify(f.from, {
      type: 'live', fromId: uid, tag: 'live-' + uid,
      text: `${me.username} canlı yayında 🔴 ${title || ''}`.trim(), url: `/#/live/${uid}`,
    }));
    ack?.({ ok: true });
  });

  socket.on('live:stop', () => endLive(uid));

  socket.on('live:join', ({ hostId }, ack) => {
    const l = lives.get(hostId);
    if (!l) return ack?.({ error: 'Yayın sona erdi.' });
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

  socket.on('live:signal', ({ to, data }) => {
    if (typeof to !== 'string') return;
    io.to(to).emit('live:signal', { from: socket.id, data });
  });

  socket.on('live:comment', ({ hostId, text }) => {
    text = String(text || '').trim().slice(0, 200);
    if (!text || !lives.has(hostId)) return;
    io.to(`live:${hostId}`).emit('live:comment', { hostId, user: brief(store.get('users', uid)), text, at: now() });
  });

  socket.on('live:heart', ({ hostId }) => {
    if (lives.has(hostId)) io.to(`live:${hostId}`).emit('live:heart', { hostId });
  });

  socket.on('disconnect', () => {
    leave();
    const l = lives.get(uid);
    if (l && l.socketId === socket.id) endLive(uid);
    online.get(uid)?.delete(socket);
    if (!isOnline(uid)) {
      store.update('users', uid, { lastSeen: now() });
      broadcastPresence(uid);
    }
  });
});

// ---------- Başlat ----------
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
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@sweepup.app', VAPID.publicKey, VAPID.privateKey);
  await seed(store);
  server.listen(PORT, () => console.log(`Sweep Up http://localhost:${PORT}`));
})();

const shutdown = async () => { await store.close().catch(() => {}); process.exit(0); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

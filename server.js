// SwipeUp — Express + Socket.IO sunucusu
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const multer = require('multer');
const imagefix = require('./server/imagefix');
const socialMod = require('./server/social');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const webpush = require('web-push');
const { nanoid, customAlphabet } = require('nanoid');
const { Server } = require('socket.io');
const store = require('./server/store');
const mail = require('./server/mail');
const moderation = require('./server/moderation');
const eco = require('./server/economy')(store);
const music = require('./server/music');

const PORT = process.env.PORT || 3000;

// Sürüm: public klasörünün içerik özeti. Dosyalar değişince (yeni yayın) değişir,
// sunucu yeniden başlasa da aynı kalır. İstemci farkı görünce güncelleme ekranını açar.
const fs = require('fs');
const APP_VERSION = (() => {
  const h = crypto.createHash('sha1');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach((e) => {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f); else { h.update(f.slice(__dirname.length)); h.update(fs.readFileSync(f)); }
  });
  try { walk(path.join(__dirname, 'public')); } catch {}
  return h.digest('hex').slice(0, 12);
})();
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
const followOk = (a, b) => { const f = store.get('follows', `${a}_${b}`); return !!f && f.status !== 'pending'; };
const isPlus = (u) => !!u && (u.plusUntil || 0) > Date.now();
const priv = (u) => (u && u.privacy) || {};
// Özel hesaplar: Falcı Teyze ve SwipeUp yönetim hesabı (kaydırmada/önerilerde çıkmaz)
const SPECIAL = new Set(['falci', 'official']);
// Gizli hesabın içeriğini kim görebilir
const canSee = (viewerId, owner) => !!owner && (owner.id === viewerId || !priv(owner).private || followOk(viewerId, owner.id));
const hasRead = (m, uid) => m.readBy.includes(uid) || (m.seenBy || []).includes(uid);
const isBlocked = (a, b) => !!(a && b && (store.get('blocks', `${a}_${b}`) || store.get('blocks', `${b}_${a}`)));
const trLower = (t) => String(t || '').toLocaleLowerCase('tr-TR');
const extractTags = (t) => [...new Set([...String(t || '').matchAll(/#([\p{L}\p{N}_]{2,40})/gu)].map((m) => trLower(m[1])))].slice(0, 30);
const extractMentions = (t) => [...new Set([...String(t || '').matchAll(/@([a-z0-9._]{3,24})/gi)].map((m) => m[1].toLowerCase()))].slice(0, 20);
function ageOf(bd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(bd || ''));
  if (!m) return null;
  const b = new Date(+m[1], +m[2] - 1, +m[3]);
  if (Number.isNaN(b.getTime()) || b.getMonth() !== +m[2] - 1) return null;
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a >= 0 && a < 120 ? a : null;
}
// Bahsedilen kullanıcılara bildirim
function notifyMentions(text, from, url, what) {
  extractMentions(text).forEach((un) => {
    const t = store.find('users', (u) => u.username === un);
    if (t && t.id !== from.id) notify(t.id, { type: 'mention', fromId: from.id, text: `${from.username} seni ${what} bahsetti: ${String(text).slice(0, 80)}`, url });
  });
}

// Yönetimin verdiği özel etiketler (ör. "Yarışma 1.si")
const tagsOf = (u) => { const ids = u?.tags || []; if (!ids.length) return []; const list = store.get('settings', 'tags')?.list || []; return ids.map((id) => list.find((t) => t.id === id)).filter(Boolean).map(({ id, em, name, color }) => ({ id, em, name, color })); };
const shownAge = (u) => (priv(u).hideAge ? null : u.age ?? null);
function pub(u, viewerId) {
  if (!u) return null;
  const { passHash, recoveryHash, email, lat, lng, birthdate, coins, earnings, daily, inviteIp, invitedBy, inviteRewarded, refCode, falSub, frames, mkBalance, earnedTotal, regIp, regDevice, falPacks, ...rest } = u;
  const self = viewerId === u.id;
  const hidden = !self && priv(u).hideLastSeen;
  const fdoc = viewerId && !self ? store.get('follows', `${viewerId}_${u.id}`) : null;
  return {
    ...rest,
    privacy: self ? priv(u) : { private: !!priv(u).private },
    online: hidden ? false : isOnline(u.id),
    lastSeen: hidden ? null : u.lastSeen,
    live: lives.has(u.id),
    plus: isPlus(u), verified: !!u.verified,
    age: self ? u.age ?? null : shownAge(u), ageHidden: !!priv(u).hideAge, tags: tagsOf(u),
    prompts: (u.prompts || []).map((p) => ({ ...p, q: socialMod.PROMPTS.find((x) => x[0] === p.id)?.[1] || '' })),
    badges: (u.badges || []).filter((b) => self || !b.hidden).map(({ no, ...b }) => b),
    ...(self ? { email: email || '', hasLocation: lat != null, birthdate: birthdate || null, coins: coins || 0, earnings: earnings || 0, needsBirthdate: !birthdate, refCode: refCode || null, falSub: falSub || null, frames: frames || [] } : {}),
    ...(viewerId && !self ? { isFollowing: !!fdoc && fdoc.status !== 'pending', requested: fdoc?.status === 'pending', distanceKm: distance(store.get('users', viewerId), u) } : {}),
  };
}
const brief = (u) => u && ({
  id: u.id, username: u.username, name: u.name, avatar: u.avatar,
  online: priv(u).hideLastSeen ? false : isOnline(u.id), live: lives.has(u.id), lastSeen: priv(u).hideLastSeen ? null : u.lastSeen,
  createdAt: u.createdAt, role: u.role || null, verified: !!u.verified, plus: isPlus(u), frame: u.frame || null, private: !!priv(u).private,
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
    items: p.type === 'text' ? [] : (p.items || [{ media: p.media, type: p.type === 'reel' ? 'video' : 'image', poster: p.poster || null }]),
    user: brief(store.get('users', p.userId)),
    repostCount: (p.reposts || []).length,
    reposted: (p.reposts || []).includes(viewerId),
    likeCount: p.likes.length,
    liked: p.likes.includes(viewerId),
    commentCount: p.comments.filter((c) => !isBlocked(viewerId, c.userId)).length,
    comments: undefined,
    likes: undefined,
    reposts: undefined,
  };
}

function sign(u) { return jwt.sign({ id: u.id }, JWT_SECRET, { expiresIn: '90d' }); }

// Yasak / askı durumu (yönetim panelinden verilir)
function banInfo(u) {
  if (!u) return null;
  if (u.status === 'banned') return { banned: true, kind: 'banned', reason: u.banReason || '', until: null };
  if (u.status === 'suspended' && u.bannedUntil > Date.now()) return { banned: true, kind: 'suspended', reason: u.banReason || '', until: u.bannedUntil };
  return null;
}
const isActive = (u) => !banInfo(u);
const BAN_OK = new Set(['/api/me', '/api/appeals', '/api/appeals/mine']);

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  let u;
  try {
    const { id } = jwt.verify(token, JWT_SECRET);
    u = store.get('users', id);
    if (!u) throw new Error('no user');
  } catch {
    return res.status(401).json({ error: 'Oturum süresi doldu, tekrar giriş yap.' });
  }
  req.user = u;
  featureCtx?.onActive?.(u.id);
  const ban = banInfo(u);
  if (ban && !BAN_OK.has(req.originalUrl.split('?')[0])) {
    return res.status(423).json({ error: ban.kind === 'banned' ? 'Hesabın kalıcı olarak kapatıldı.' : 'Hesabın geçici olarak askıya alındı.', ...ban });
  }
  next();
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
      ref: n.ref || null, text: n.text, url: n.url || null, at: now(), read: false,
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
  const msgs = store.filter('messages', (m) => m.chatId === c.id && !(m.expiresAt && m.expiresAt < now()));
  msgs.sort((x, y) => x.at - y.at);
  const visible = msgs.filter((m) => !(m.hiddenFor || []).includes(me));
  const last = visible[visible.length - 1] || null;
  const unread = visible.filter((m) => m.from !== me && !m.system && !hasRead(m, me)).length;
  if (c.isGroup) {
    return {
      id: c.id, isGroup: true, name: c.name, admins: c.admins,
      other: { id: c.id, name: c.name, avatar: c.avatar, isGroup: true, username: '' },
      members: c.members.map((m) => brief(store.get('users', m))).filter(Boolean),
      last: last && { ...last, fromName: store.get('users', last.from)?.name?.split(' ')[0] },
      unread, lastAt: c.lastAt, ttl: c.ttl || 0,
    };
  }
  const otherId = c.members.find((m) => m !== me) || me;
  return { id: c.id, other: brief(store.get('users', otherId)), last, unread, lastAt: c.lastAt, blocked: isBlocked(me, otherId), ttl: c.ttl || 0, streak: featureCtx.streakOf?.(c.id) || null };
}

let gameOut = (g) => g; // social modülü yüklenince gizli oyun bilgisini saklayan sürümle değişir
function msgOut(m) {
  if (!m) return m;
  if (m.deleted) return { ...m, text: '', media: null, game: null, plan: null, quote: null };
  let o = m;
  // Tek seferlik fotoğraf: dosya adresi listede görünmez, sadece açma isteğiyle bir kez verilir
  if (m.viewOnce) o = { ...o, media: null, viewOnceState: m.mediaGone || (m.openedBy || []).length ? 'opened' : 'new' };
  if (m.game) o = { ...o, game: gameOut(m.game) };
  if (m.compat && featureCtx.compatOut) o = { ...o, compat: featureCtx.compatOut(m.compat) };
  return o;
}

// Falcı Teyze kuralı: ona sadece fal isteğiyle yazılır; o da sadece fal isteyenlere yazar
function falLock(chat, fromId) {
  if (!chat || chat.isGroup) return null;
  const me = store.get('users', fromId);
  const other = store.get('users', chat.members.find((m) => m !== fromId));
  if (other?.role === 'official' && me?.role !== 'official') return 'SwipeUp yönetim hesabına mesaj gönderilemez. Destek için Ayarlar → Yardım ve destek.';
  if (me?.role === 'official') return null;
  if (other?.role === 'falci' && me?.role !== 'falci') return 'Falcı Teyze’ye sadece fal isteğiyle yazabilirsin.';
  if (me?.role === 'falci' && other?.role !== 'falci' && !store.find('messages', (m) => m.chatId === chat.id && m.fal)) return 'Sadece fal isteyenlere yazabilirsin.';
  return null;
}
function sendMessage(chat, fromId, { text, media, mediaType, replyTo, duration, system, story, fal, location, quote, game, plan, superMsg, viewOnce, share, compat, gift }) {
  text = String(text || '').slice(0, 4000).trim();
  // Medya sadece kendi yüklemelerimizden; GIF ise GIPHY/Tenor bağlantısı olabilir
  if (mediaType === 'gif') { if (!GIF_HOSTS.test(String(media || ''))) media = null; } else if (media && !isMedia(media)) media = null;
  let loc = null;
  if (location && Number.isFinite(+location.lat) && Number.isFinite(+location.lng)) {
    loc = { lat: Math.round(+location.lat * 1e5) / 1e5, lng: Math.round(+location.lng * 1e5) / 1e5, label: String(location.label || '').slice(0, 80) };
  }
  if (!text && !media && !fal && !loc && !game && !plan && !share && !compat && !gift) return null;
  if (!system && !fal && falLock(chat, fromId)) return null;
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
    media: media || null, mediaType: media ? (['image', 'video', 'audio', 'gif'].includes(mediaType) ? mediaType : 'image') : null,
    duration: duration ? Math.min(600, Math.round(duration)) : null,
    reply, story: story || null, fal: fal || null, location: loc, system: !!system, reactions: {},
    quote: quote || null, game: game || null, plan: plan || null, superMsg: !!superMsg, share: share || null, compat: compat || null, gift: gift || null,
    viewOnce: !!(viewOnce && media && (mediaType === 'image' || !mediaType)), openedBy: [],
    at: now(), readBy: [fromId], deliveredTo: [fromId],
    expiresAt: chat.ttl && !system ? now() + chat.ttl : null,
  });
  store.update('chats', chat.id, { lastAt: msg.at });
  for (const m of chat.members) if (m !== fromId && isOnline(m)) msg.deliveredTo.push(m);
  store.update('messages', msg.id, {});
  chat.members.forEach((m) => emitTo(m, 'message', msgOut(msg)));
  if (system) return msg;
  const sender = store.get('users', fromId);
  // Otomatik moderasyon: hakaret / tehdit içeren mesajlar yönetime düşer
  const fl = text && moderation.flag(text);
  if (fl) {
    store.put('flags', { id: nanoid(12), kind: 'message', userId: fromId, chatId: chat.id, ref: msg.id, text: text.slice(0, 500), level: fl.level, reason: fl.reason, status: 'open', at: now() });
  }
  if (!fal) { featureCtx.quest?.(fromId, 'mesaj'); featureCtx.onMessage?.(msg, chat, sender); }
  if (sender?.role === 'falci' && !fal) {
    store.filter('messages', (m) => m.chatId === chat.id && m.fal && m.fal.status === 'pending').forEach((m) => {
      m.fal.status = 'answered'; m.fal.answeredAt = now(); store.update('messages', m.id, {});
      chat.members.forEach((x) => emitTo(x, 'message:update', msgOut(m)));
    });
  }
  const preview = fal ? `🔮 Yeni ${FAL_TYPES[fal.type]} isteği` : loc ? '📍 Konum' : share && !text ? `📤 ${share.label} paylaştı` : msg.viewOnce ? '📷 Tek seferlik fotoğraf' : text || { video: '🎥 Video', audio: '🎤 Sesli mesaj', gif: 'GIF gönderdi' }[msg.mediaType] || '📷 Fotoğraf';
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

// ---------- Bakım modu: uygulama kapalı, yönetim paneli çalışır ----------
const maintenance = () => { const m = store.get('settings', 'maintenance'); return m?.on ? { on: true, message: m.message || '', until: m.until || null, at: m.at || null } : null; };
const MAINT_OK = /^\/api\/(admin(\/|$)|version$|config$|maintenance$|event$)/;
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/') || MAINT_OK.test(req.path)) return next();
  const m = maintenance();
  if (!m) return next();
  res.status(503).json({ error: 'SwipeUp şu an bakımda. Kısa süre sonra geri döneceğiz.', maintenance: m });
});
app.get('/api/maintenance', (req, res) => res.json({ maintenance: maintenance() }));

const adminApi = require('./server/admin')(app, {
  store, io, emitTo, notify, brief, isOnline, online, lives, removeChat, limited, ipOf,
  secret: () => JWT_SECRET, endLive: (id) => endLive(id), eco, purgeUser: (id) => purgeUser(id), dropMediaCache: (id) => dropMediaCache(id),
});
app.get('/admin', (req, res, next) => (req.originalUrl.split('?')[0].endsWith('/') ? next() : res.redirect('/admin/')));

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

// Açılışta gösterilen duyuru penceresi (yönetim panelinden)
app.get('/api/announcement', auth, (req, res) => {
  const p = store.get('settings', 'popup');
  if (!p || p.until < now() || (p.users && !p.users.includes(req.user.id)) || p.at < (req.user.createdAt || 0) - 60000) return res.json(null);
  res.json({ id: p.annId, title: p.title, text: p.text, url: p.url, at: p.at });
});
app.get('/api/version', (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.json({ version: APP_VERSION }); });
const appEvent = require('./server/event');
app.get('/api/event', (req, res) => res.json({ event: appEvent.current(store), now: Date.now() }));
app.get('/api/config', (req, res) => {
  let uid = null;
  try { uid = jwt.verify((req.headers.authorization || '').slice(7), JWT_SECRET).id; } catch {}
  const { id, ...legal } = store.get('settings', 'legal') || {};
  res.json({ vapidPublicKey: VAPID?.publicKey || null, iceServers: iceServers(uid), emailReset: mail.enabled(), legal, version: APP_VERSION, event: appEvent.current(store), now: Date.now(), maintenance: maintenance(), maintPlan: (() => { const p = store.get('settings', 'maint_plan'); return p && !p.started ? { start: p.start, end: p.end || null, message: p.message || '' } : null; })(), features: { market: !!store.get('settings', 'market')?.enabled }, superMsgCoins: eco.get().superMsgCoins, falAi: featureCtx.falAiMode?.() || 'off' });
});

// ---------- Kimlik ----------
app.post('/api/auth/register', wrap(async (req, res) => {
  if (limited('reg:' + ipOf(req), 8, 3600000)) return res.status(429).json({ error: 'Çok fazla kayıt denemesi. Bir saat sonra tekrar dene.' });
  let { username, name, password, email, birthdate, accept } = req.body || {};
  username = String(username || '').toLowerCase().trim();
  name = String(name || '').trim().slice(0, 40);
  email = String(email || '').toLowerCase().trim();
  if (!/^[a-z0-9._]{3,24}$/.test(username)) return res.status(400).json({ error: 'Kullanıcı adı 3–24 karakter olmalı; harf, rakam, nokta ve alt çizgi kullanılabilir.' });
  if (String(password || '').length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı.' });
  const age = ageOf(birthdate);
  if (age == null) return res.status(400).json({ error: 'Doğum tarihini gir.' });
  if (age < 18) return res.status(403).json({ error: 'SwipeUp’ı kullanmak için 18 yaşından büyük olmalısın.' });
  if (!accept) return res.status(400).json({ error: 'Devam etmek için Kullanım Koşulları’nı ve Gizlilik Politikası’nı kabul etmelisin.' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'E-posta adresi geçersiz.' });
  if (store.find('users', (u) => u.username === username)) return res.status(409).json({ error: 'Bu kullanıcı adı alınmış.' });
  if (email && store.find('users', (u) => u.email === email)) return res.status(409).json({ error: 'Bu e-posta ile kayıtlı bir hesap var.' });
  const code = recoveryCode();
  const u = store.put('users', {
    id: nanoid(10), username, name: name || username, email: email || null,
    bio: '', age, birthdate, consentAt: now(), gender: null, lookingFor: 'all', city: '', interests: [],
    prefs: { ageMin: 18, ageMax: 99, maxKm: null },
    avatar: `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(username)}&backgroundColor=ffe3dc`,
    photos: [], passHash: await bcrypt.hash(password, 10), recoveryHash: await bcrypt.hash(code, 8),
    isBot: false, createdAt: now(), lastSeen: now(),
  });
  // Diğer gerçek üyelere yeni üyeyi duyur (uygulama açıksa listeleri yenilenir)
  io.emit('people:new', brief(u));
  featureCtx.attachInvite?.(u, req.body?.ref, ipOf(req));
  featureCtx.onRegister?.(u, req);
  res.json({ token: sign(u), user: pub(store.get('users', u.id), u.id), recoveryCode: code.match(/.{4}/g).join('-') });
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
  store.update('users', req.user.id, { passHash: await bcrypt.hash(password, 10), ...(['falci', 'official'].includes(req.user.role) ? { passChangedByUser: true } : {}) });
  res.json({ ok: true });
}));

app.get('/api/me', auth, (req, res) => res.json({ ...pub(req.user, req.user.id), ban: banInfo(req.user) }));

// İtiraz (yasaklı ya da askıdaki kullanıcı)
app.post('/api/appeals', auth, (req, res) => {
  const ban = banInfo(req.user);
  if (!ban) return res.status(400).json({ error: 'Hesabın zaten aktif.' });
  const text = String(req.body?.text || '').trim().slice(0, 1500);
  if (text.length < 10) return res.status(400).json({ error: 'İtirazını biraz daha ayrıntılı yaz (en az 10 karakter).' });
  if (store.find('appeals', (a) => a.userId === req.user.id && a.status === 'open')) return res.status(409).json({ error: 'Zaten incelenmeyi bekleyen bir itirazın var.' });
  if (limited('appeal:' + req.user.id, 3, DAY)) return res.status(429).json({ error: 'Bugün çok fazla itiraz gönderdin.' });
  const a = store.put('appeals', { id: nanoid(10), userId: req.user.id, text, ban, status: 'open', at: now() });
  res.json(a);
});
app.get('/api/appeals/mine', auth, (req, res) => {
  const since = banInfo(req.user) ? (req.user.bannedAt || 0) : 0;
  res.json(store.filter('appeals', (a) => a.userId === req.user.id && a.at >= since).sort((a, b) => b.at - a.at).slice(0, 10));
});

app.patch('/api/me', auth, (req, res) => {
  const b = req.body || {};
  const patch = {};
  if (b.name !== undefined) patch.name = String(b.name).trim().slice(0, 40) || req.user.username;
  if (b.bio !== undefined) patch.bio = moderation.mask(String(b.bio).slice(0, 150));
  if (b.avatar !== undefined) patch.avatar = String(b.avatar).slice(0, 500);
  if (b.city !== undefined) patch.city = String(b.city).slice(0, 40);
  if (b.age !== undefined && !req.user.birthdate) patch.age = b.age ? Math.max(18, Math.min(99, parseInt(b.age, 10) || 18)) : null;
  if (b.birthdate !== undefined && !req.user.birthdate) {
    const a = ageOf(b.birthdate);
    if (a == null) return res.status(400).json({ error: 'Doğum tarihi geçersiz.' });
    if (a < 18) {
      store.update('users', req.user.id, { status: 'banned', banReason: '18 yaşından küçükler SwipeUp’ı kullanamaz.', bannedAt: now() });
      return res.status(403).json({ error: 'SwipeUp’ı kullanmak için 18 yaşından büyük olmalısın.' });
    }
    patch.birthdate = b.birthdate; patch.age = a;
  }
  if (b.privacy && typeof b.privacy === 'object') {
    const cur = priv(req.user);
    const np = { ...cur };
    ['private', 'hideLastSeen', 'hideRead', 'hideFromDeck', 'hideVisits', 'hideAge', 'hideCheckin'].forEach((k) => { if (b.privacy[k] !== undefined) np[k] = !!b.privacy[k]; });
    patch.privacy = np;
    // Gizli hesap kapatılınca bekleyen istekleri kabul et
    if (cur.private && !np.private) store.filter('follows', (f) => f.to === req.user.id && f.status === 'pending').forEach((f) => store.update('follows', f.id, { status: null }));
  }
  if (b.gender !== undefined) patch.gender = ['k', 'e', 'd'].includes(b.gender) ? b.gender : null;
  if (b.lookingFor !== undefined) patch.lookingFor = ['k', 'e', 'all'].includes(b.lookingFor) ? b.lookingFor : 'all';
  if (Array.isArray(b.interests)) patch.interests = b.interests.map((s) => String(s).slice(0, 24)).slice(0, 8);
  if (Array.isArray(b.photos)) patch.photos = b.photos.map(String).slice(0, 6);
  if (b.skin !== undefined) patch.skin = ['gunbatimi', 'pembe', 'gece', 'altin'].includes(b.skin) ? b.skin : 'gunbatimi';
  if (b.logo !== undefined) {
    const LOGOS = ['klasik', 'altin', 'neon', 'gece', 'pastel', 'gokkusagi'];
    if (b.logo && b.logo !== 'klasik' && !isPlus(req.user)) return res.status(402).json({ error: 'Logo seçmek SwipeUp+ ayrıcalığıdır.', plus: true });
    patch.logo = LOGOS.includes(b.logo) ? b.logo : 'klasik';
  }
  if (b.zodiac !== undefined) patch.zodiac = ['koc', 'boga', 'ikizler', 'yengec', 'aslan', 'basak', 'terazi', 'akrep', 'yay', 'oglak', 'kova', 'balik'].includes(b.zodiac) ? b.zodiac : null;
  if (b.prefs) {
    const ageMin = Math.max(18, Math.min(99, parseInt(b.prefs.ageMin, 10) || 18));
    const ageMax = Math.max(ageMin, Math.min(99, parseInt(b.prefs.ageMax, 10) || 99));
    const maxKm = b.prefs.maxKm ? Math.max(1, Math.min(500, parseInt(b.prefs.maxKm, 10))) : null;
    patch.prefs = { ageMin, ageMax, maxKm, verifiedOnly: !!b.prefs.verifiedOnly };
  }
  featureCtx.readProfileExtras?.(b, patch);
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
  const saved = store.update('users', req.user.id, patch);
  if (patch.photos || patch.avatar) featureCtx.checkInviteReward?.(saved);
  const out = pub(store.get('users', req.user.id), req.user.id);
  if (patch.privacy) broadcastPresence(req.user.id);
  res.json(out);
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
  if (!f) return res.status(400).json({ error: 'Dosya gelmedi. Tekrar dene.' });
  if (limited('up:' + req.user.id, 60, 3600000)) return res.status(429).json({ error: 'Çok fazla yükleme. Biraz sonra tekrar dene.' });
  // Türü boş gelen dosyaları baytlarından tanı; HEIC fotoğrafları JPEG'e çevir
  let fixed;
  try { fixed = await imagefix.normalize(f.mimetype, f.buffer); } catch (e) {
    console.error('[upload] dönüştürülemedi:', f.mimetype, e.message);
    return res.status(415).json({ error: 'Bu fotoğraf biçimi açılamadı. Fotoğrafı JPEG olarak kaydedip tekrar dene (iPhone: Ayarlar → Kamera → Biçimler → En Uyumlu).' });
  }
  const { mime, buffer } = fixed;
  if (!/^(image|video|audio)\//.test(mime)) return res.status(400).json({ error: 'Sadece fotoğraf, video veya ses yüklenebilir.' });
  const id = nanoid(16);
  const where = await store.saveMedia(id, mime, buffer);
  store.put('media_meta', { id, userId: req.user.id, mime, size: buffer.length, where, at: now() });
  res.json({ url: `/media/${id}`, type: mime.split('/')[0], mime });
}));

const mediaCache = new Map(); let cacheBytes = 0;
function dropMediaCache(id) { const m = mediaCache.get(id); if (m) { cacheBytes -= m.data.length; mediaCache.delete(id); } }
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
  if (req.query.new) {
    const lim = now() - 7 * DAY;
    return res.json(store.filter('users', (u) => u.id !== me && !SPECIAL.has(u.role) && isActive(u) && !isBlocked(me, u.id) && (u.createdAt || 0) > lim).sort((a, b) => b.createdAt - a.createdAt).slice(0, 30).map(brief));
  }
  const list = rankPeople(store.filter('users', (u) => u.id !== me && !SPECIAL.has(u.role) && isActive(u) && !isBlocked(me, u.id)));
  res.json(list.slice(0, 60).map(brief));
});

// ---------- Gönderiler ----------
app.get('/api/feed', auth, (req, res) => {
  const me = req.user.id;
  const following = new Set(store.filter('follows', (f) => f.from === me && f.status !== 'pending').map((f) => f.to));
  following.add(me);
  // Falcı Teyze ve SwipeUp resmi hesabının paylaşımları herkesin akışına düşer
  store.filter('users', (u) => SPECIAL.has(u.role)).forEach((u) => following.add(u.id));
  const ok = (p) => p && !isBlocked(me, p.userId) && canSee(me, store.get('users', p.userId));
  const posts = store.filter('posts', (p) => ['image', 'text'].includes(p.type) && following.has(p.userId) && ok(p))
    .map((p) => ({ p, t: p.createdAt }));
  const have = new Set(posts.map((x) => x.p.id));
  // Takip ettiklerinin yeniden paylaştıkları (son 14 gün)
  const lim = now() - 14 * DAY;
  store.filter('reposts', (r) => r.at > lim && r.userId !== me && following.has(r.userId)).sort((a, b) => b.at - a.at).forEach((r) => {
    if (have.has(r.postId)) return;
    const p = store.get('posts', r.postId); if (!ok(p) || p.userId === me) return;
    have.add(p.id); posts.push({ p, t: r.at, by: r.userId });
  });
  posts.sort((a, b) => b.t - a.t);
  const out = posts.slice(0, 80).map(({ p, t, by }) => ({ ...postOut(p, me), ...(by ? { repostedBy: brief(store.get('users', by)), repostAt: t } : {}) }));
  res.json(withPromos(out, req.user, 'image', [1, 7, 13]));
});
// Öne çıkan (sponsorlu) içerikleri listeye yerleştir
function withPromos(list, viewer, type, slots) {
  const ads = featureCtx.promoFor?.(viewer, type, slots.length) || [];
  if (!ads.length) return list;
  const ids = new Set(ads.map((a) => a.id));
  const out = list.filter((p) => !ids.has(p.id));
  ads.forEach((a, i) => out.splice(Math.min(slots[i], out.length), 0, a));
  return out;
}

app.get('/api/reels', auth, (req, res) => {
  const fol = req.query.tab === 'following' ? new Set(store.filter('follows', (f) => f.from === req.user.id && f.status !== 'pending').map((f) => f.to)) : null;
  const posts = store.filter('posts', (p) => p.type === 'reel' && (!fol || fol.has(p.userId)) && !isBlocked(req.user.id, p.userId) && canSee(req.user.id, store.get('users', p.userId)));
  posts.sort((a, b) => b.createdAt - a.createdAt);
  res.json(withPromos(posts.slice(0, 60).map((p) => postOut(p, req.user.id)), req.user, 'reel', [2, 8, 14]));
});

app.get('/api/explore', auth, (req, res) => {
  const posts = store.filter('posts', (p) => !isBlocked(req.user.id, p.userId) && canSee(req.user.id, store.get('users', p.userId)));
  posts.sort((a, b) => (b.likes.length + b.createdAt / 3.6e6) - (a.likes.length + a.createdAt / 3.6e6));
  res.json(posts.slice(0, 60).map((p) => postOut(p, req.user.id)));
});

app.post('/api/posts', auth, (req, res) => {
  const b = req.body || {};
  const type = b.type;
  const raw = Array.isArray(b.items) && b.items.length ? b.items : (b.media ? [{ media: b.media, type: type === 'reel' ? 'video' : 'image', poster: b.poster }] : []);
  const items = raw.filter((i) => i && isMedia(i.media)).slice(0, type === 'reel' ? 1 : 10).map((i) => ({
    media: String(i.media), type: i.type === 'video' ? 'video' : 'image', poster: isMedia(i.poster) ? i.poster : null, filter: FILTERS.includes(i.filter) ? i.filter : null,
  }));
  const TEXT_BG = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8'];
  if (type === 'text') {
    const text = moderation.mask(String(b.caption || '').trim().slice(0, 2200));
    if (text.length < 1) return res.status(400).json({ error: 'Bir şey yaz.' });
    const p = store.put('posts', { id: nanoid(10), userId: req.user.id, type: 'text', media: null, poster: null, items: [], bg: TEXT_BG.includes(b.bg) ? b.bg : 'g1', caption: text, tags: extractTags(text), likes: [], comments: [], reposts: [], createdAt: now() });
    featureCtx.quest?.(req.user.id, 'paylas'); featureCtx.track?.('post'); featureCtx.contestEvent?.('post', req.user.id);
    notifyMentions(text, req.user, `/#/p/${p.id}`, 'bir gönderide');
    store.filter('follows', (f) => f.to === req.user.id && f.status !== 'pending').forEach((f) => notify(f.from, { type: 'post', fromId: req.user.id, ref: p.id, text: `${req.user.username} yeni bir gönderi paylaştı.`, url: `/#/p/${p.id}` }));
    return res.json(postOut(p, req.user.id));
  }
  if (!['image', 'reel'].includes(type) || !items.length) return res.status(400).json({ error: 'Önce bir fotoğraf veya video seç.' });
  let edit = null;
  if (type === 'reel' && b.edit && typeof b.edit === 'object') {
    const e = b.edit;
    const num = (v, lo, hi) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, +v)) : null);
    edit = {
      start: num(e.start, 0, 3600) || 0, end: num(e.end, 0, 3600), speed: [0.5, 0.75, 1, 1.5, 2].includes(+e.speed) ? +e.speed : 1,
      filter: FILTERS.includes(e.filter) ? e.filter : null, audio: isMedia(e.audio) || music.isPreview(e.audio) ? e.audio : null,
      audioTitle: String(e.audioTitle || '').slice(0, 80), audioArtist: String(e.audioArtist || '').slice(0, 80),
      audioCover: music.clean({ src: 'https://p.scdn.co/x', cover: e.audioCover })?.cover || null,
      spotifyUrl: music.clean({ src: 'https://p.scdn.co/x', spotifyUrl: e.spotifyUrl })?.spotifyUrl || null,
      muteOriginal: !!e.muteOriginal && (isMedia(e.audio) || music.isPreview(e.audio)),
    };
    if (edit.end != null && edit.end <= edit.start + 0.5) edit.end = null;
    edit.stickers = (Array.isArray(e.stickers) ? e.stickers : []).slice(0, 6).map(cleanOverlay).filter(Boolean);
  }
  const caption = moderation.mask(String(b.caption || '').slice(0, 2200));
  const p = store.put('posts', {
    id: nanoid(10), userId: req.user.id, type, media: items[0].media, poster: items[0].poster || null, items, edit,
    caption, tags: extractTags(caption), likes: [], comments: [], reposts: [], createdAt: now(),
  });
  featureCtx.quest?.(req.user.id, 'paylas'); featureCtx.track?.(type === 'reel' ? 'reel' : 'post'); featureCtx.contestEvent?.(type === 'reel' ? 'reel' : 'post', req.user.id);
  notifyMentions(caption, req.user, type === 'reel' ? `/#/vitrin/${p.id}` : `/#/p/${p.id}`, type === 'reel' ? 'bir vitrin videosunda' : 'bir gönderide');
  store.filter('follows', (f) => f.to === req.user.id && f.status !== 'pending').forEach((f) => notify(f.from, {
    type: 'post', fromId: req.user.id, ref: p.id,
    text: type === 'reel' ? `${req.user.username} vitrinine yeni bir video ekledi.` : `${req.user.username} yeni bir gönderi paylaştı.`,
    url: type === 'reel' ? `/#/vitrin/${p.id}` : `/#/p/${p.id}`,
  }));
  res.json(postOut(p, req.user.id));
});

app.get('/api/posts/:id', auth, (req, res) => {
  const p = store.get('posts', req.params.id);
  if (!p || isBlocked(req.user.id, p.userId) || !canSee(req.user.id, store.get('users', p.userId))) return res.status(404).json({ error: 'Gönderi bulunamadı.' });
  res.json(postOut(p, req.user.id));
});

app.delete('/api/posts/:id', auth, (req, res) => {
  const p = store.get('posts', req.params.id);
  if (!p || p.userId !== req.user.id) return res.status(404).json({ error: 'Gönderi bulunamadı.' });
  store.del('posts', p.id);
  store.filter('reposts', (r) => r.postId === p.id).forEach((r) => store.del('reposts', r.id));
  res.json({ ok: true });
});

// Yeniden paylaş (Instagram'daki gibi): takipçilerinin akışına "X yeniden paylaştı" olarak düşer, profilinde ayrı sekmede görünür
app.post('/api/posts/:id/repost', auth, (req, res) => {
  const p = store.get('posts', req.params.id);
  const o = p && store.get('users', p.userId);
  if (!p || !o || isBlocked(req.user.id, o.id) || !canSee(req.user.id, o)) return res.status(404).json({ error: 'Gönderi bulunamadı.' });
  if (o.id === req.user.id) return res.status(400).json({ error: 'Kendi gönderini yeniden paylaşamazsın.' });
  if (priv(o).private) return res.status(403).json({ error: 'Gizli hesapların gönderileri yeniden paylaşılamaz.' });
  const id = `${req.user.id}_${p.id}`;
  const list = p.reposts || [];
  const want = req.body?.on ?? !list.includes(req.user.id);
  if (want && !list.includes(req.user.id)) {
    p.reposts = [...list, req.user.id];
    store.put('reposts', { id, userId: req.user.id, postId: p.id, ownerId: o.id, at: now() });
    notify(o.id, { type: 'repost', fromId: req.user.id, ref: p.id, text: `${req.user.username} ${p.type === 'reel' ? 'vitrin videonu' : 'gönderini'} yeniden paylaştı.`, url: p.type === 'reel' ? `/#/vitrin/${p.id}` : `/#/p/${p.id}` });
    featureCtx.contestEvent?.('repost', o.id);
  } else if (!want) {
    p.reposts = list.filter((x) => x !== req.user.id);
    store.del('reposts', id);
  }
  store.update('posts', p.id, { reposts: p.reposts });
  res.json({ reposted: (p.reposts || []).includes(req.user.id), repostCount: (p.reposts || []).length });
});

// Çoklu gönderiden tek bir fotoğrafı kaldır (gönderi sahibi)
app.delete('/api/posts/:id/items/:idx', auth, (req, res) => {
  const p = store.get('posts', req.params.id);
  if (!p || p.userId !== req.user.id) return res.status(404).json({ error: 'Gönderi bulunamadı.' });
  const items = p.items || [{ media: p.media, type: p.type === 'reel' ? 'video' : 'image', poster: p.poster }];
  const i = parseInt(req.params.idx, 10);
  if (!(i >= 0 && i < items.length)) return res.status(400).json({ error: 'Geçersiz fotoğraf.' });
  if (items.length < 2) return res.status(400).json({ error: 'Tek fotoğraflı gönderiyi silmek için gönderiyi sil.' });
  const [gone] = items.splice(i, 1);
  store.update('posts', p.id, { items, media: items[0].media, poster: items[0].poster || null });
  const mid = String(gone.media).split('/').pop();
  store.deleteMedia(mid).then(() => { dropMediaCache(mid); store.del('media_meta', mid); }).catch(() => {});
  res.json(postOut(store.get('posts', p.id), req.user.id));
});

app.post('/api/posts/:id/like', auth, (req, res) => {
  const p = store.get('posts', req.params.id);
  if (!p) return res.status(404).json({ error: 'Gönderi bulunamadı.' });
  const me = req.user.id;
  const want = req.body?.like ?? !p.likes.includes(me);
  if (want && !p.likes.includes(me)) {
    p.likes.push(me);
    if (p.userId !== me) featureCtx.likeLog?.(me, p);
    notify(p.userId, { type: 'like', fromId: me, ref: p.id, text: `${req.user.username} ${p.type === 'reel' ? 'vitrin videonu' : 'gönderini'} beğendi.`, url: `/#/p/${p.id}` });
  }
  if (!want) { p.likes = p.likes.filter((x) => x !== me); featureCtx.likeUnlog?.(me, p); }
  store.update('posts', p.id, {});
  io.emit('post:likes', { id: p.id, likeCount: p.likes.length });
  res.json({ liked: want, likeCount: p.likes.length });
});

app.get('/api/posts/:id/comments', auth, (req, res) => {
  const p = store.get('posts', req.params.id);
  if (!p) return res.status(404).json({ error: 'Gönderi bulunamadı.' });
  res.json(p.comments.filter((c) => !isBlocked(req.user.id, c.userId)).map((c) => ({ ...c, user: brief(store.get('users', c.userId)), replyToUser: c.replyToUserId ? store.get('users', c.replyToUserId)?.username || null : null })));
});

app.post('/api/posts/:id/comments', auth, (req, res) => {
  const p = store.get('posts', req.params.id);
  const text = moderation.mask(String(req.body?.text || '').trim().slice(0, 500));
  const gif = GIF_HOSTS.test(String(req.body?.gif || '')) ? String(req.body.gif).slice(0, 300) : null;
  if (!p || (!text && !gif)) return res.status(400).json({ error: 'Yorum boş olamaz.' });
  if (!canSee(req.user.id, store.get('users', p.userId))) return res.status(403).json({ error: 'Bu gönderiye yorum yapamazsın.' });
  if (isBlocked(req.user.id, p.userId)) return res.status(403).json({ error: 'Bu gönderiye yorum yapamazsın.' });
  if (limited('cm:' + req.user.id, 30, 600000)) return res.status(429).json({ error: 'Çok hızlı yorum yapıyorsun, biraz bekle.' });
  // Bir yoruma cevap: cevaplar ana yorumun altında toplanır
  const target = req.body?.replyTo ? p.comments.find((x) => x.id === req.body.replyTo) : null;
  const parent = target ? (target.parentId ? p.comments.find((x) => x.id === target.parentId) || target : target) : null;
  const c = { id: nanoid(10), userId: req.user.id, text, gif, at: now(), parentId: parent?.id || null, replyToUserId: target ? target.userId : null };
  p.comments.push(c);
  store.update('posts', p.id, {});
  const said = text ? text.slice(0, 80) : 'GIF';
  if (target && target.userId !== req.user.id) notify(target.userId, { type: 'comment', fromId: req.user.id, ref: p.id, text: `${req.user.username} yorumuna cevap verdi: ${said}`, url: `/#/p/${p.id}` });
  if (p.userId !== req.user.id && p.userId !== target?.userId) notify(p.userId, { type: 'comment', fromId: req.user.id, ref: p.id, text: `${req.user.username} yorum yaptı: ${said}`, url: `/#/p/${p.id}` });
  if (p.userId !== req.user.id) featureCtx.contestEvent?.('comment', p.userId);
  notifyMentions(text, req.user, `/#/p/${p.id}`, 'bir yorumda');
  featureCtx.quest?.(req.user.id, 'yorum'); featureCtx.track?.('comment');
  res.json({ ...c, user: brief(req.user), replyToUser: target ? store.get('users', target.userId)?.username || null : null });
});
// Yoruma özel yanıt: yorumu yazan kişiye, yorumu alıntılayarak mesaj gönder (gönderi sahibi)
app.post('/api/posts/:id/comments/:cid/private', auth, (req, res) => {
  const p = store.get('posts', req.params.id);
  const c = p && p.comments.find((x) => x.id === req.params.cid);
  const text = moderation.mask(String(req.body?.text || '').trim().slice(0, 1000));
  if (!c) return res.status(404).json({ error: 'Yorum bulunamadı.' });
  if (p.userId !== req.user.id) return res.status(403).json({ error: 'Özel yanıtı sadece gönderi sahibi gönderebilir.' });
  if (c.userId === req.user.id) return res.status(400).json({ error: 'Kendi yorumuna özel yanıt gönderemezsin.' });
  const t = store.get('users', c.userId);
  if (!t || SPECIAL.has(t.role) || isBlocked(req.user.id, t.id)) return res.status(403).json({ error: 'Bu kişiye yazamazsın.' });
  if (!text) return res.status(400).json({ error: 'Bir şey yaz.' });
  if (limited('pvr:' + req.user.id, 40, DAY)) return res.status(429).json({ error: 'Bugün çok fazla özel yanıt gönderdin.' });
  const chat = chatBetween(req.user.id, t.id);
  const msg = sendMessage(chat, req.user.id, { text, quote: { kind: 'comment', q: 'Gönderindeki yorumuna özel yanıt', a: (c.text || 'GIF').slice(0, 200), postId: p.id } });
  if (!msg) return res.status(400).json({ error: 'Gönderilemedi.' });
  res.json({ ok: true, chatId: chat.id });
});

// ---------- Hikayeler (24 saat) ----------
const storyAlive = (s) => now() - s.at < DAY;
const FILTERS = ['canli', 'siyahbeyaz', 'noir', 'sicak', 'soguk', 'altin', 'vintage', 'retro', 'soluk', 'pastel', 'pembe', 'dram', 'sinema', 'gece', 'neon', 'cadi', 'hayalet', 'kar', 'isilti', 'ask', 'ruya'];
// Vitrin videosu ve hikaye üstü hareketli çıkartmalar (emoji / GIF / yazı)
const GIF_HOSTS = /^https:\/\/(media\d*\.giphy\.com|i\.giphy\.com|media\.tenor\.com|c\.tenor\.com)\//;
function cleanOverlay(st) {
  if (!st || typeof st !== 'object') return null;
  const pos = { x: Math.max(4, Math.min(96, Number.isFinite(+st.x) ? +st.x : 50)), y: Math.max(4, Math.min(96, Number.isFinite(+st.y) ? +st.y : 50)), s: Math.max(0.4, Math.min(3, +st.s || 1)), r: Math.max(-180, Math.min(180, Math.round(+st.r || 0))) };
  if (st.type === 'emoji') { const em = [...String(st.em || '')].slice(0, 2).join(''); return em ? { id: nanoid(6), type: 'emoji', em, ...pos } : null; }
  if (st.type === 'gif') { const src = String(st.src || ''); return isMedia(src) || GIF_HOSTS.test(src) ? { id: nanoid(6), type: 'gif', src, ...pos } : null; }
  if (st.type === 'text') { const text = moderation.mask(String(st.text || '').trim().slice(0, 120)); return text ? { id: nanoid(6), type: 'text', text, color: /^#[0-9a-f]{6}$/i.test(st.color) ? st.color : '#ffffff', bgc: !!st.bgc, ...pos } : null; }
  return null;
}
function cleanSticker(st) {
  if (!st || typeof st !== 'object') return null;
  if (st.type === 'emoji' || st.type === 'gif') return cleanOverlay(st);
  const y = Math.max(5, Math.min(90, +st.y || 60));
  const x = Math.max(8, Math.min(92, Number.isFinite(+st.x) ? +st.x : 50));
  const base = { id: nanoid(6), type: st.type, y, x };
  if (st.type === 'poll') {
    const options = (Array.isArray(st.options) ? st.options : []).map((o) => moderation.mask(String(o || '').trim().slice(0, 30))).filter(Boolean).slice(0, 4);
    if (options.length < 2) return null;
    return { ...base, q: moderation.mask(String(st.q || '').trim().slice(0, 80)), options };
  }
  if (st.type === 'question') return { ...base, q: moderation.mask(String(st.q || 'Bana bir soru sor').trim().slice(0, 80)) };
  if (st.type === 'music') {
    if (isMedia(st.src)) return { ...base, src: st.src, title: String(st.title || 'Müzik').slice(0, 60), artist: String(st.artist || '').slice(0, 60), start: Math.max(0, +st.start || 0) };
    const m = music.clean(st);
    return m ? { ...base, ...m, start: 0 } : null;
  }
  if (st.type === 'text') {
    const text = moderation.mask(String(st.text || '').trim().slice(0, 120));
    return text ? { ...base, text, color: /^#[0-9a-f]{6}$/i.test(st.color) ? st.color : '#ffffff', size: ['s', 'm', 'l'].includes(st.size) ? st.size : 'm', bgc: !!st.bgc } : null;
  }
  if (st.type === 'mention') {
    const u = store.find('users', (x) => x.username === String(st.username || '').toLowerCase());
    return u ? { ...base, username: u.username, userId: u.id } : null;
  }
  return null;
}
function stickersOut(s, me) {
  return (s.stickers || []).map((st) => {
    if (st.type !== 'poll') return st;
    const votes = Object.entries(s.votes || {}).filter(([, v]) => v.sticker === st.id);
    const counts = st.options.map((_, i) => votes.filter(([, v]) => v.option === i).length);
    return { ...st, counts, total: votes.length, mine: (s.votes || {})[me]?.sticker === st.id ? s.votes[me].option : null };
  });
}
app.get('/api/stories', auth, (req, res) => {
  const me = req.user.id;
  const following = new Set(store.filter('follows', (f) => f.from === me).map((f) => f.to));
  const byUser = new Map();
  store.filter('stories', (s) => storyAlive(s) && !isBlocked(me, s.userId) && canSee(me, store.get('users', s.userId)))
    .sort((a, b) => a.at - b.at)
    .forEach((s) => {
      if (!byUser.has(s.userId)) byUser.set(s.userId, []);
      byUser.get(s.userId).push({
        id: s.id, media: s.media, mediaType: s.mediaType, bg: s.bg || null, filter: s.filter || null, at: s.at, reshareOf: s.reshareOf ? brief(store.get('users', s.reshareOf)) : null, seen: s.viewers.includes(me), myReaction: (s.reactions || {})[me]?.emoji || null, viewerCount: s.userId === me ? s.viewers.length : undefined,
        stickers: stickersOut(s, me),
      });
    });
  const out = [...byUser.entries()].map(([uid, items]) => ({ user: brief(store.get('users', uid)), items, allSeen: items.every((i) => i.seen) }));
  out.sort((a, b) => (b.user.id === me) - (a.user.id === me) || a.allSeen - b.allSeen || (b.items.at(-1).at - a.items.at(-1).at));
  res.json(out);
});
app.post('/api/stories', auth, (req, res) => {
  const { media, mediaType } = req.body || {};
  const STORY_BG = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8'];
  const bg = STORY_BG.includes(req.body?.bg) ? req.body.bg : null;
  if (!media && !bg) return res.status(400).json({ error: 'Önce bir fotoğraf veya video seç ya da yazı yaz.' });
  if (media && !isMedia(media)) return res.status(400).json({ error: 'Dosya bulunamadı.' });
  const stickers = (Array.isArray(req.body.stickers) ? req.body.stickers : []).slice(0, 12).map(cleanSticker).filter(Boolean);
  if (!media && !stickers.some((x) => ['text', 'emoji', 'gif', 'poll', 'question', 'mention'].includes(x.type))) return res.status(400).json({ error: 'Yazı hikayesine bir şey yaz.' });
  const filter = FILTERS.includes(req.body.filter) ? req.body.filter : null;
  // Türü yüklenen dosyanın kaydından al (telefon yanlış/boş tür gönderse bile doğru gösterilsin)
  const meta = store.get('media_meta', String(media).replace(/^\/media\//, ''));
  const kind = !media ? 'text' : meta?.mime ? (meta.mime.startsWith('video/') ? 'video' : 'image') : (mediaType === 'video' ? 'video' : 'image');
  const reshareOf = req.body?.reshareOf ? store.get('users', String(req.body.reshareOf)) : null;
  const s = store.put('stories', { id: nanoid(12), userId: req.user.id, media: media ? String(media) : null, mediaType: kind, bg, filter, at: now(), viewers: [], stickers, votes: {}, answers: [], reshareOf: reshareOf ? reshareOf.id : null });
  io.emit('stories:update', { userId: req.user.id });
  // Hikayede etiketlenen kişilere bildirim
  stickers.filter((x) => x.type === 'mention' && x.userId !== req.user.id).forEach((x) => {
    if (isBlocked(req.user.id, x.userId)) return;
    notify(x.userId, { type: 'mention', fromId: req.user.id, ref: s.id, text: `${req.user.username} seni hikayesinde etiketledi.`, url: `/#/stories/${req.user.id}` });
  });
  featureCtx.quest?.(req.user.id, 'paylas'); featureCtx.track?.('story');
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
  const viewers = s.viewers.map((id) => {
    const u = brief(store.get('users', id));
    if (!u) return null;
    const v = (s.votes || {})[id];
    const st = v && (s.stickers || []).find((x) => x.id === v.sticker);
    return { ...u, vote: st ? st.options[v.option] : null, reaction: (s.reactions || {})[id]?.emoji || null };
  }).filter(Boolean);
  if (req.query.full) return res.json({ viewers, answers: (s.answers || []).map((a) => ({ ...a, user: brief(store.get('users', a.userId)) })).filter((a) => a.user), stickers: stickersOut(s, req.user.id) });
  res.json(viewers);
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
  const owner = store.get('users', s.userId);
  if (owner?.role === 'official') return res.status(403).json({ error: 'Yönetim hesabına yanıt gönderilemez.' });
  if (owner?.role === 'falci' || req.user.role === 'falci') return res.status(403).json({ error: 'Falcı Teyze’ye sadece fal isteğiyle yazabilirsin.' });
  const chat = chatBetween(req.user.id, s.userId);
  const msg = sendMessage(chat, req.user.id, { text, story: { id: s.id, media: s.mediaType === 'image' ? s.media : null } });
  if (!msg) return res.status(403).json({ error: 'Bu kişiye mesaj gönderemezsin.' });
  res.json({ ok: true, chatId: chat.id });
});
const STORY_EMOJI = ['😂', '😮', '😍', '😢', '👏', '🔥', '🎉', '💯', '❤️'];
app.post('/api/stories/:id/react', auth, (req, res) => {
  const s = store.get('stories', req.params.id);
  const emoji = STORY_EMOJI.includes(req.body?.emoji) ? req.body.emoji : null;
  if (!s || !emoji || s.userId === req.user.id) return res.status(400).json({ error: 'Tepki gönderilemedi.' });
  const owner = store.get('users', s.userId);
  if (!owner || isBlocked(req.user.id, owner.id)) return res.status(403).json({ error: 'Tepki gönderilemedi.' });
  if (limited('sr:' + req.user.id, 40, 600000)) return res.status(429).json({ error: 'Biraz yavaş 🙂' });
  s.reactions = s.reactions || {};
  const first = !s.reactions[req.user.id];
  s.reactions[req.user.id] = { emoji, at: now() };
  store.update('stories', s.id, {});
  // Falcı Teyze'ye mesaj gitmez; sadece tepki kaydedilir ve bildirim gider
  let chatId = null;
  if (!SPECIAL.has(owner.role) && req.user.role !== 'falci') {
    const chat = chatBetween(req.user.id, s.userId);
    const msg = sendMessage(chat, req.user.id, { text: emoji, story: { id: s.id, media: s.mediaType === 'image' ? s.media : null, reaction: true } });
    chatId = msg ? chat.id : null;
  } else if (first) {
    notify(owner.id, { type: 'story_answer', fromId: req.user.id, text: `${req.user.username} hikayene ${emoji} tepki verdi.`, url: '/#/stories/me', tag: 'sr-' + s.id });
  }
  res.json({ ok: true, chatId });
});
setInterval(() => store.filter('stories', (s) => now() - s.at > DAY * 2).forEach((s) => store.del('stories', s.id)), 3600000).unref();

// ---------- Kullanıcılar ----------
app.get('/api/users/search', auth, (req, res) => {
  const q = String(req.query.q || '').toLowerCase().trim().replace(/^@/, '');
  if (!q) {
    // Etiketleme önerisi: takip ettiklerin ve son sohbet ettiklerin
    const me = req.user.id; const seen = new Map();
    store.filter('chats', (c) => !c.isGroup && c.members.includes(me)).sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0)).slice(0, 20)
      .forEach((c) => { const o = c.members.find((m) => m !== me); if (o) seen.set(o, (seen.get(o) || 0) + 3); });
    store.filter('follows', (f) => f.from === me && f.status !== 'pending').forEach((f) => seen.set(f.to, (seen.get(f.to) || 0) + 2));
    store.filter('follows', (f) => f.to === me && f.status !== 'pending').forEach((f) => seen.set(f.from, (seen.get(f.from) || 0) + 1));
    let list = [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => store.get('users', id)).filter((u) => u && isActive(u) && !SPECIAL.has(u.role) && !isBlocked(me, u.id));
    if (list.length < 8) list = [...list, ...rankPeople(store.filter('users', (u) => u.id !== me && isActive(u) && !SPECIAL.has(u.role) && !isBlocked(me, u.id) && !seen.has(u.id))).slice(0, 8 - list.length)];
    return res.json(list.slice(0, 12).map(brief));
  }
  // Yönetim hesabı sadece kullanıcı adıyla aranınca çıkar
  const list = rankPeople(store.filter('users', (u) => isActive(u) && !isBlocked(req.user.id, u.id) && (u.role === 'official' ? u.username.includes(q) : (u.username.includes(q) || u.name.toLowerCase().includes(q)))));
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
  const locked = !canSee(req.user.id, u);
  const posts = blockedByMe || locked ? [] : store.filter('posts', (p) => p.userId === u.id).sort((a, b) => b.createdAt - a.createdAt);
  const mid = [req.user.id, u.id].sort().join('_');
  res.json({
    ...pub(u, req.user.id),
    followers: store.filter('follows', (f) => f.to === u.id && f.status !== 'pending').length,
    following: store.filter('follows', (f) => f.from === u.id && f.status !== 'pending').length,
    followsYou: followOk(u.id, req.user.id),
    locked,
    postCount: store.filter('posts', (p) => p.userId === u.id).length,
    matched: !!store.get('matches', mid),
    checkin: blockedByMe ? null : featureCtx.checkinOf?.(u, req.user.id) || null,
    blockedByMe,
    hasStory: !locked && store.filter('stories', (s) => s.userId === u.id && storyAlive(s)).length > 0,
    posts: posts.map((p) => postOut(p, req.user.id)),
    reposts: blockedByMe || locked ? [] : store.filter('reposts', (r) => r.userId === u.id).sort((a, b) => b.at - a.at).map((r) => store.get('posts', r.postId))
      .filter((p) => p && !isBlocked(req.user.id, p.userId) && canSee(req.user.id, store.get('users', p.userId))).slice(0, 60).map((p) => postOut(p, req.user.id)),
    tagged: blockedByMe || locked ? [] : store.filter('posts', (p) => p.userId !== u.id && new RegExp(`(^|[^a-z0-9._])@${u.username.replace(/\./g, '\\.')}(?![a-z0-9._])`, 'i').test(p.caption || ''))
      .filter((p) => !isBlocked(req.user.id, p.userId) && canSee(req.user.id, store.get('users', p.userId))).sort((a, b) => b.createdAt - a.createdAt).slice(0, 60).map((p) => postOut(p, req.user.id)),
  });
});

app.get('/api/users/:id/:list', auth, (req, res, next) => {
  if (!['followers', 'following'].includes(req.params.list)) return next();
  const key = req.params.list === 'followers' ? ['to', 'from'] : ['from', 'to'];
  const owner = store.get('users', req.params.id);
  if (owner && !canSee(req.user.id, owner)) return res.json([]);
  const ids = store.filter('follows', (f) => f[key[0]] === req.params.id && f.status !== 'pending').map((f) => f[key[1]]);
  res.json(ids.filter((id) => !isBlocked(req.user.id, id)).map((id) => brief(store.get('users', id))).filter(Boolean));
});

app.post('/api/users/:id/follow', auth, (req, res) => {
  const t = store.get('users', req.params.id);
  if (!t || t.id === req.user.id || isBlocked(req.user.id, t.id)) return res.status(400).json({ error: 'Geçersiz kullanıcı.' });
  const id = `${req.user.id}_${t.id}`;
  if (store.get('follows', id)) {
    store.del('follows', id);
    return res.json({ following: false, requested: false });
  }
  if (priv(t).private) {
    store.put('follows', { id, from: req.user.id, to: t.id, at: now(), status: 'pending' });
    notify(t.id, { type: 'follow_request', fromId: req.user.id, text: `${req.user.username} seni takip etmek istiyor.`, url: '/#/requests' });
    return res.json({ following: false, requested: true });
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
// Tek bir mesajı / yorumu bildir (içeriğin o anki kopyası saklanır)
app.post('/api/report/message', auth, (req, res) => {
  const { kind, id, postId } = req.body || {};
  const me = req.user.id;
  let target = null; let snap = null;
  if (kind === 'dm') {
    const m = store.get('messages', id);
    const c = m && store.get('chats', m.chatId);
    if (!m || !c || !c.members.includes(me)) return res.status(404).json({ error: 'Mesaj bulunamadı.' });
    target = m.from;
    snap = { text: m.text || '', media: m.media || null, mediaType: m.mediaType || null, location: m.location || null, at: m.at, chat: c.isGroup ? c.name : null };
  } else if (kind === 'genel') {
    const m = store.get('pub_msgs', id);
    if (!m) return res.status(404).json({ error: 'Mesaj bulunamadı.' });
    target = m.userId;
    snap = { text: m.text || '', media: m.media || null, mediaType: m.mediaType || null, at: m.at, chat: 'Genel sohbet' };
  } else if (kind === 'comment') {
    const p = store.get('posts', postId);
    const c = p && p.comments.find((x) => x.id === id);
    if (!c) return res.status(404).json({ error: 'Yorum bulunamadı.' });
    target = c.userId;
    snap = { text: c.text, at: c.at, postId: p.id };
  } else return res.status(400).json({ error: 'Geçersiz istek.' });
  if (target === me) return res.status(400).json({ error: 'Kendi mesajını bildiremezsin.' });
  if (limited('rep:' + me, 20, DAY)) return res.status(429).json({ error: 'Bugün çok fazla bildirim gönderdin.' });
  if (store.find('reports', (r) => r.from === me && r.ref === id && r.status === 'open')) return res.status(409).json({ error: 'Bu mesajı zaten bildirdin.' });
  store.put('reports', {
    id: nanoid(12), from: me, to: target, reason: String(req.body?.reason || 'diger').slice(0, 40),
    details: String(req.body?.details || '').slice(0, 1000), ref: id, refKind: kind, postId: kind === 'comment' ? postId : null,
    snapshot: snap, at: now(), status: 'open',
  });
  if (req.body?.block && target) {
    store.put('blocks', { id: `${me}_${target}`, from: me, to: target, at: now() });
    store.del('follows', `${me}_${target}`); store.del('follows', `${target}_${me}`);
    unmatch(me, target);
    emitTo(target, 'blocked', { by: me });
  }
  res.json({ ok: true });
});

// Yorumu sil (yorum sahibi ya da gönderi sahibi)
app.delete('/api/posts/:id/comments/:cid', auth, (req, res) => {
  const p = store.get('posts', req.params.id);
  const c = p && p.comments.find((x) => x.id === req.params.cid);
  if (!c || (c.userId !== req.user.id && p.userId !== req.user.id)) return res.status(404).json({ error: 'Yorum bulunamadı.' });
  p.comments = p.comments.filter((x) => x.id !== c.id && x.parentId !== c.id);
  store.update('posts', p.id, {});
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
  let deck = store.filter('users', (u) => u.id !== me.id && !SPECIAL.has(u.role) && isActive(u) && !priv(u).hideFromDeck && !swiped.has(u.id) && !isBlocked(me.id, u.id));
  if (me.lookingFor && me.lookingFor !== 'all') deck = deck.filter((u) => u.gender === me.lookingFor || !u.gender);
  deck = deck.filter((u) => !u.age || (u.age >= prefs.ageMin && u.age <= prefs.ageMax));
  if (prefs.maxKm && me.lat != null) deck = deck.filter((u) => { const d = distance(me, u); return d == null || d <= prefs.maxKm; });
  if (prefs.verifiedOnly) deck = deck.filter((u) => u.verified);
  const likedMe = new Set(store.filter('swipes', (s) => s.to === me.id && s.dir !== 'left').map((s) => s.from));
  rankPeople(deck);
  const t = now();
  deck.sort((a, b) => ((b.boostUntil || 0) > t) - ((a.boostUntil || 0) > t));
  res.json(deck.slice(0, 40).map((u) => cardOut(me, u, likedMe.has(u.id))));
});
function cardOut(me, u, likedYou) {
  const posts = store.filter('posts', (p) => p.userId === u.id && p.type === 'image' && canSee(me.id, u)).slice(0, 3).map((p) => p.media);
  const photos = [...(u.photos || []), ...posts].filter(Boolean);
  return {
    ...brief(u), age: shownAge(u), city: u.city, bio: u.bio, interests: u.interests || [], tags: tagsOf(u),
    distanceKm: distance(me, u), likedYou: eco.isPlus(me) ? likedYou : false,
    boosted: (u.boostUntil || 0) > now(),
    photos: photos.length ? photos : [u.avatar],
    voice: u.voice || null, badges: (u.badges || []).filter((b) => !b.hidden).map(({ no, ...b }) => b), prompts: (u.prompts || []).map((p) => ({ ...p, q: socialMod.PROMPTS.find((x) => x[0] === p.id)?.[1] || '' })),
  };
}

app.get('/api/likes', auth, (req, res) => {
  const me = req.user.id;
  const mySwipes = new Set(store.filter('swipes', (s) => s.from === me).map((s) => s.to));
  const list = store.filter('swipes', (s) => s.to === me && s.dir !== 'left' && !mySwipes.has(s.from) && !isBlocked(me, s.from))
    .sort((a, b) => b.at - a.at)
    .map((s) => { const u = store.get('users', s.from); return u && isActive(u) && { ...brief(u), age: shownAge(u), city: u.city, super: s.dir === 'super', at: s.at, photo: (u.photos || [])[0] || u.avatar }; })
    .filter(Boolean);
  if (eco.isPlus(req.user)) return res.json({ plus: true, count: list.length, items: list });
  // Ücretsiz üyeler: süper beğeniler açık, diğerleri bulanık ve kimliksiz
  res.json({
    plus: false, count: list.length,
    items: list.map((x) => (x.super ? x : { locked: true, super: false, at: x.at, photo: x.photo })),
  });
});

app.post('/api/swipe', auth, (req, res) => {
  const { to, dir } = req.body || {};
  const t = store.get('users', to);
  if (!t || t.id === req.user.id || !['left', 'right', 'super'].includes(dir) || isBlocked(req.user.id, to)) return res.status(400).json({ error: 'Geçersiz istek.' });
  const me = req.user;
  if (dir !== 'left') {
    const q = eco.quota(me);
    if (dir === 'super' && q.supersLeft <= 0) return res.status(402).json({ error: q.plus ? 'Bugünkü süper beğeni hakkın bitti.' : 'Bugünkü süper beğeni hakkın bitti. SwipeUp+ ile her gün 5 süper beğeni.', limit: 'super' });
    if (dir === 'right' && q.likesLeft === 0) return res.status(402).json({ error: 'Bugünkü beğeni hakkın bitti. SwipeUp+ ile sınırsız beğen.', limit: 'likes' });
    const d = { ...q.d, likes: q.d.likes + (dir === 'right' ? 1 : 0), supers: q.d.supers + (dir === 'super' ? 1 : 0) };
    store.update('users', me.id, { daily: d });
  }
  store.put('swipes', { id: `${me.id}_${t.id}`, from: me.id, to: t.id, dir, at: now() });
  if (dir !== 'left') featureCtx.quest?.(me.id, 'begeni', 1, t.id);
  featureCtx.onSwipe?.(me.id, dir);
  store.update('users', me.id, { lastSwipe: t.id });
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
  const t = now();
  const msgs = store.filter('messages', (m) => m.chatId === c.id && !(m.hiddenFor || []).includes(req.user.id) && !(m.expiresAt && m.expiresAt < t)).sort((a, b) => a.at - b.at);
  const noReceipts = priv(req.user).hideRead;
  res.json({ ...chatOut(c, req.user.id), falLock: falLock(c, req.user.id), falHolds: req.user.role === 'falci' ? (featureCtx.falHolds?.(c.id) || []) : undefined, falDue: req.user.role === 'falci' ? (featureCtx.falHoldUntil?.(c) || null) : undefined, messages: msgs.slice(-400).map((m) => (noReceipts ? { ...msgOut(m), readBy: [m.from] } : msgOut(m))) });
});

app.post('/api/chats/:id/messages', auth, (req, res) => {
  const c = store.get('chats', req.params.id);
  if (!c || !c.members.includes(req.user.id)) return res.status(404).json({ error: 'Sohbet bulunamadı.' });
  const lock = falLock(c, req.user.id); if (lock) return res.status(403).json({ error: lock, falLock: true });
  // Falcı Teyze bekleyen fala süresi dolmadan cevap verirse cevap zamanı gelince iletilir
  if (req.user.role === 'falci' && !req.body?.now && featureCtx.falHoldUntil?.(c)) return res.json({ held: true, hold: featureCtx.falHold(c, req.user.id, req.body || {}) });
  const msg = sendMessage(c, req.user.id, { ...(req.body || {}), system: false, fal: null, story: null, quote: null, game: null, plan: null, superMsg: false, share: null });
  if (!msg) return res.status(400).json({ error: 'Mesaj gönderilemedi.' });
  res.json(msgOut(msg));
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
  if (req.user.role === 'falci') return res.status(403).json({ error: 'Falcı Teyze grup kuramaz.' });
  const ids = [...new Set((req.body?.memberIds || []).map(String))].filter((id) => id !== req.user.id && store.get('users', id) && !SPECIAL.has(store.get('users', id).role) && !isBlocked(req.user.id, id));
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
  const add = (req.body?.userIds || []).map(String).filter((id) => !c.members.includes(id) && store.get('users', id) && !SPECIAL.has(store.get('users', id).role) && !isBlocked(req.user.id, id));
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

// ---------- Fal (Falcı Teyze'ye istek) ----------
const FAL_TYPES = { kahve: 'kahve falı', tarot: 'tarot falı', burc: 'burç yorumu', uyum: 'aşk uyumu' };
const falci = () => store.find('users', (u) => u.role === 'falci');
const official = () => store.find('users', (u) => u.role === 'official');
const isMedia = (u) => typeof u === 'string' && /^\/media\/[\w-]+$/.test(u);

app.get('/api/fal/falci', auth, (req, res) => {
  const f = falci();
  res.json(f ? { ...brief(f), bio: f.bio, isFollowing: !!store.get('follows', `${req.user.id}_${f.id}`), followers: store.filter('follows', (x) => x.to === f.id).length } : null);
});

app.post('/api/fal', auth, (req, res) => {
  const f = falci();
  if (!f) return res.status(503).json({ error: 'Falcı Teyze şu an hizmet vermiyor.' });
  if (req.user.id === f.id) return res.status(400).json({ error: 'Kendine fal isteği gönderemezsin.' });
  if (isBlocked(req.user.id, f.id)) return res.status(403).json({ error: 'Fal isteği gönderilemedi.' });
  const b = req.body || {};
  if (!FAL_TYPES[b.type]) return res.status(400).json({ error: 'Fal türünü seç.' });
  const fp = featureCtx.falPriceFor ? featureCtx.falPriceFor(req.user, b.type, Math.max(0, parseInt(eco.get().falPrices[b.type], 10) || 0)) : { price: Math.max(0, parseInt(eco.get().falPrices[b.type], 10) || 0) };
  const price = fp.price;
  if (price && (req.user.coins || 0) < price) return res.status(402).json({ error: `Bu fal ${price} jeton. Jetonun yetmiyor.`, need: price, coins: req.user.coins || 0 });
  if (limited('fal:' + req.user.id, 10, 10 * 60000)) return res.status(429).json({ error: 'Çok hızlı fal isteği gönderiyorsun kuzum, biraz bekle.' });
  const images = (Array.isArray(b.images) ? b.images : []).filter(isMedia).slice(0, 3);
  if (b.type === 'kahve' && !images.length) return res.status(400).json({ error: 'Kahve falı için en az bir fincan fotoğrafı ekle.' });
  const zodiacs = ['koc', 'boga', 'ikizler', 'yengec', 'aslan', 'basak', 'terazi', 'akrep', 'yay', 'oglak', 'kova', 'balik'];
  const cards = (Array.isArray(b.cards) ? b.cards : []).slice(0, 3).map((c) => ({ name: String(c.name || '').slice(0, 30), em: String(c.em || '').slice(0, 4), rev: !!c.rev, pos: String(c.pos || '').slice(0, 12) }));
  if (b.type === 'tarot' && cards.length !== 3) return res.status(400).json({ error: 'Üç kart seç.' });
  let partner = null;
  if (b.type === 'uyum') {
    const p = store.get('users', b.partnerId);
    if (!p) return res.status(400).json({ error: 'Uyumuna bakılacak kişiyi seç.' });
    partner = { id: p.id, name: p.name, username: p.username, avatar: p.avatar, zodiac: p.zodiac || null };
  }
  const zodiac = zodiacs.includes(b.zodiac) ? b.zodiac : (req.user.zodiac || null);
  const payload = {
    id: nanoid(8), type: b.type, note: String(b.note || '').trim().slice(0, 1000), images, cards, partner, zodiac,
    name: req.user.name, status: 'pending', at: now(), price, dueAt: featureCtx.falDueAt?.(b.type) || null,
  };
  const chat = chatBetween(req.user.id, f.id);
  const msg = sendMessage(chat, req.user.id, { text: payload.note, fal: payload });
  if (!msg) return res.status(400).json({ error: 'Fal isteği gönderilemedi.' });
  featureCtx.useFalSub?.(req.user, fp.use);
  featureCtx.onFalRequest?.(msg);
  if (price) {
    eco.spend(req.user.id, price, 'fal', { ref: msg.id });
    eco.earn(f.id, Math.round(price * eco.get().falciShare), 'fal', { ref: msg.id, fromId: req.user.id });
  }
  res.json({ ok: true, chatId: chat.id, messageId: msg.id, coins: store.get('users', req.user.id).coins || 0 });
});

app.get('/api/fal/mine', auth, (req, res) => {
  const f = falci();
  if (!f) return res.json([]);
  const chatId = [req.user.id, f.id].sort().join('_');
  res.json(store.filter('messages', (m) => m.chatId === chatId && m.fal && m.from === req.user.id)
    .sort((a, b) => b.at - a.at).slice(0, 30).map((m) => ({ ...m.fal, chatId, messageId: m.id })));
});

app.get('/api/fal/queue', auth, (req, res) => {
  if (req.user.role !== 'falci') return res.status(403).json({ error: 'Bu sayfa sadece Falcı Teyze içindir.' });
  const list = store.filter('messages', (m) => m.fal && store.get('chats', m.chatId)?.members.includes(req.user.id))
    .sort((a, b) => (a.fal.status === 'pending') === (b.fal.status === 'pending') ? b.at - a.at : (a.fal.status === 'pending' ? -1 : 1))
    .slice(0, 200)
    .map((m) => ({ ...m.fal, chatId: m.chatId, messageId: m.id, user: brief(store.get('users', m.from)), ai: featureCtx.falDraft?.(m.id) || null, holds: m.fal.status === 'pending' ? (featureCtx.falHolds?.(m.chatId) || []) : [] }));
  res.json(list);
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
  const msgs = store.filter('messages', (m) => chats.has(m.chatId) && m.from !== me && !m.system && !hasRead(m, me) && !(m.hiddenFor || []).includes(me) && !(m.expiresAt && m.expiresAt < now()));
  const mySwipes = new Set(store.filter('swipes', (s) => s.from === me).map((s) => s.to));
  const likes = store.filter('swipes', (s) => s.to === me && s.dir !== 'left' && !mySwipes.has(s.from)).length;
  const fal = req.user.role === 'falci' ? store.filter('messages', (m) => m.fal?.status === 'pending' && chats.has(m.chatId)).length : 0;
  const requests = store.filter('follows', (f) => f.to === me && f.status === 'pending').length;
  res.json({ notifications: notifs, messages: new Set(msgs.map((m) => m.chatId)).size, likes, fal, requests, coins: req.user.coins || 0, plus: eco.isPlus(req.user) });
});

// ---------- Canlı ----------
const liveOut = (l) => ({ userId: l.userId, title: l.title, startedAt: l.startedAt, viewers: l.viewers.size, filter: l.filter || null, user: brief(store.get('users', l.userId)) });
app.get('/api/lives', auth, (req, res) => res.json([...lives.values()].map(liveOut)));

// ---------- Müzik (Spotify + önizleme) ----------
app.get('/api/music/search', auth, wrap(async (req, res) => {
  if (limited('ms:' + req.user.id, 40, 60000)) return res.status(429).json({ error: 'Biraz yavaş 🙂' });
  res.json({ items: await music.search(req.query.q), spotify: music.enabled() });
}));
// GIF arama (GIPHY_API_KEY ya da TENOR_API_KEY varsa); yoksa kullanıcı cihazından GIF yükler
const gifCache = new Map();
// GIF ve hareketli çıkartma araması (GIPHY; yoksa Tenor). Sonuçlar 1 saat önbellekte tutulur.
async function gifSearch({ q = '', type = 'gifs', offset = 0 } = {}) {
  const giphy = process.env.GIPHY_API_KEY; const tenor = process.env.TENOR_API_KEY;
  if (!giphy && !tenor) return { enabled: false, items: [] };
  const kind = type === 'stickers' && giphy ? 'stickers' : 'gifs';
  const key = `${giphy ? 'g' : 't'}|${kind}|${q.toLowerCase()}|${offset}`;
  const c = gifCache.get(key); if (c && c.at > now() - 3600000) return { enabled: true, provider: giphy ? 'giphy' : 'tenor', items: c.items, next: c.next };
  let items = []; let next = null;
  try {
    if (giphy) {
      const base = `https://api.giphy.com/v1/${kind}/${q ? 'search' : 'trending'}?api_key=${giphy}&limit=24&offset=${offset}&rating=pg-13&bundle=messaging_non_clips`;
      const r = await fetch(q ? `${base}&q=${encodeURIComponent(q)}&lang=tr` : base, { signal: AbortSignal.timeout(8000) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) console.error('[gif] giphy', r.status, j?.meta?.msg || j?.message || '');
      items = (j.data || []).map((g) => { const im = g.images?.fixed_width || g.images?.downsized || g.images?.original; return { id: g.id, src: im?.url, w: +im?.width || 200, h: +im?.height || 200, title: String(g.title || '').slice(0, 80) }; }).filter((g) => g.src);
      const pg = j.pagination; if (pg && pg.offset + pg.count < Math.min(pg.total_count || 0, 480)) next = pg.offset + pg.count;
    } else {
      const u = `https://tenor.googleapis.com/v2/${q ? 'search' : 'featured'}?key=${tenor}${q ? `&q=${encodeURIComponent(q)}` : ''}&limit=24${offset ? `&pos=${offset}` : ''}&contentfilter=medium&media_filter=tinygif,gif&locale=tr_TR`;
      const j = await (await fetch(u, { signal: AbortSignal.timeout(8000) })).json();
      items = (j.results || []).map((g) => ({ id: g.id, src: g.media_formats?.tinygif?.url || g.media_formats?.gif?.url, w: g.media_formats?.tinygif?.dims?.[0] || 200, h: g.media_formats?.tinygif?.dims?.[1] || 200, title: String(g.content_description || '').slice(0, 80) })).filter((g) => g.src);
      next = j.next ? +j.next || null : null;
    }
  } catch (e) { console.error('[gif]', e.message); }
  items = items.map((g) => ({ ...g, src: g.src.replace(/\?.*$/, '') })).filter((g) => GIF_HOSTS.test(g.src));
  if (items.length) { gifCache.set(key, { at: now(), items, next }); if (gifCache.size > 400) gifCache.delete(gifCache.keys().next().value); }
  return { enabled: true, provider: giphy ? 'giphy' : 'tenor', items, next };
}
app.get('/api/gifs', auth, wrap(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60);
  const offset = Math.max(0, Math.min(480, parseInt(req.query.offset, 10) || 0));
  res.json(await gifSearch({ q, type: req.query.type === 'stickers' ? 'stickers' : 'gifs', offset }));
}));
app.get('/api/music/featured', auth, wrap(async (req, res) => res.json({ items: await music.getFeatured(), spotify: music.enabled() })));

// ---------- Uygulama içinde paylaş (Instagram'daki gibi kişilere gönder) ----------
function shareRef(viewer, ref) {
  const k = ref?.kind; const id = String(ref?.id || '');
  if (k === 'post') {
    const p = store.get('posts', id); const o = p && store.get('users', p.userId);
    if (!p || !o || isBlocked(viewer.id, o.id) || !canSee(viewer.id, o)) return null;
    const it = (p.items || [])[0] || {};
    return { kind: 'post', id: p.id, label: p.type === 'reel' ? 'Vitrin videosu' : 'Gönderi', title: `@${o.username}`, sub: String(p.caption || '').slice(0, 90), image: it.poster || (it.type === 'video' ? null : it.media) || o.avatar, video: p.type === 'reel' || it.type === 'video', url: p.type === 'reel' ? `/#/vitrin/${p.id}` : `/#/p/${p.id}`, private: !!priv(o).private, ownerId: o.id };
  }
  if (k === 'profile') {
    const u = store.get('users', id) || store.find('users', (x) => x.username === id);
    if (!u || isBlocked(viewer.id, u.id)) return null;
    return { kind: 'profile', id: u.id, label: 'Profil', title: u.name, sub: `@${u.username}${u.city ? ` · ${u.city}` : ''}`, image: u.avatar, url: `/#/u/${u.username}`, verified: !!u.verified };
  }
  if (k === 'live') {
    const u = store.get('users', id);
    if (!u || isBlocked(viewer.id, u.id)) return null;
    return { kind: 'live', id: u.id, label: 'Canlı yayın', title: `${u.name} canlı yayında`, sub: `@${u.username}`, image: u.avatar, url: `/#/live/${u.id}` };
  }
  if (k === 'market') {
    const it = store.get('mk_items', id);
    if (!it || !store.get('settings', 'market')?.enabled) return null;
    return { kind: 'market', id: it.id, label: 'Store ilanı', title: it.title, sub: `${Number(it.price || 0).toLocaleString('tr-TR')} ₺ · SwipeUp Store`, image: (it.photos || [])[0] || null, url: `/#/market/i/${it.id}` };
  }
  return null;
}
app.get('/api/share/targets', auth, (req, res) => {
  const me = req.user.id; const q = String(req.query.q || '').toLocaleLowerCase('tr-TR').trim().replace(/^@/, '');
  const out = []; const seen = new Set();
  const addUser = (u, sub) => { if (!u || seen.has(u.id) || u.id === me || !isActive(u) || isBlocked(me, u.id) || SPECIAL.has(u.role)) return; seen.add(u.id); out.push({ kind: 'user', id: u.id, name: u.name, username: u.username, avatar: u.avatar, verified: !!u.verified, sub: sub || `@${u.username}` }); };
  const match = (s) => !q || String(s || '').toLocaleLowerCase('tr-TR').includes(q);
  store.filter('chats', (c) => c.members.includes(me)).sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0)).slice(0, 40).forEach((c) => {
    if (c.isGroup) { if (match(c.name) && !seen.has(c.id)) { seen.add(c.id); out.push({ kind: 'chat', id: c.id, name: c.name, avatar: c.avatar, sub: `${c.members.length} üye · grup`, group: true }); } return; }
    const u = store.get('users', c.members.find((m) => m !== me));
    if (u && (match(u.name) || match(u.username))) addUser(u);
  });
  store.filter('follows', (f) => f.from === me && f.status !== 'pending').forEach((f) => { const u = store.get('users', f.to); if (u && (match(u.name) || match(u.username))) addUser(u); });
  if (q) rankPeople(store.filter('users', (u) => match(u.name) || match(u.username))).slice(0, 30).forEach((u) => addUser(u));
  res.json(out.slice(0, 60));
});
app.post('/api/share', auth, (req, res) => {
  const b = req.body || {};
  const sh = shareRef(req.user, b.ref);
  if (!sh) return res.status(404).json({ error: 'Paylaşılacak içerik bulunamadı.' });
  const targets = (Array.isArray(b.targets) ? b.targets : []).slice(0, 20);
  if (!targets.length) return res.status(400).json({ error: 'En az bir kişi seç.' });
  if (limited('share:' + req.user.id, 80, 3600000)) return res.status(429).json({ error: 'Çok fazla paylaşım yaptın, biraz bekle.' });
  const text = moderation.mask(String(b.text || '').trim().slice(0, 500));
  const { ownerId, private: priv_, ...payload } = sh;
  // gizli hesabın gönderisi: önizlemede içerik gösterme (alıcı takipçi değilse açamaz)
  if (priv_) { const o = store.get('users', ownerId); payload.image = o?.avatar || null; payload.video = false; payload.sub = 'Gizli hesap · görmek için takip etmelisin'; }
  let sent = 0; const chats = [];
  for (const t of targets) {
    let chat = null;
    if (t.kind === 'chat') { const c = store.get('chats', String(t.id)); if (c?.members.includes(req.user.id)) chat = c; }
    else { const u = store.get('users', String(t.id)); if (u && u.id !== req.user.id && isActive(u) && !isBlocked(req.user.id, u.id)) chat = chatBetween(req.user.id, u.id); }
    if (!chat || falLock(chat, req.user.id)) continue;
    const m = sendMessage(chat, req.user.id, { text, share: payload });
    if (m) { sent++; chats.push(chat.id); }
  }
  if (!sent) return res.status(400).json({ error: 'Gönderilemedi.' });
  res.json({ ok: true, sent, chatId: chats.length === 1 ? chats[0] : null });
});

// ---------- Yönetici telefon/masaüstü bildirimleri ----------
async function pushAdmins(p) {
  if (!VAPID) return;
  const subs = store.all('adm_push');
  await Promise.all(subs.map((s) => webpush.sendNotification(s.sub, JSON.stringify({ icon: '/icons/icon-192.png', ...p }), { TTL: 86400, urgency: 'high' })
    .catch((e) => { if (e.statusCode === 404 || e.statusCode === 410) store.del('adm_push', s.id); })));
}
app.post('/api/admin/push', adminApi.adminAuth, (req, res) => {
  const sub = req.body?.sub;
  if (!sub?.endpoint || !sub?.keys) return res.status(400).json({ error: 'Abonelik geçersiz.' });
  store.put('adm_push', { id: crypto.createHash('sha1').update(sub.endpoint).digest('hex'), adminId: req.admin.id, admin: req.admin.username, sub, ua: String(req.headers['user-agent'] || '').slice(0, 160), at: now() });
  res.json({ ok: true, count: store.filter('adm_push', (s) => s.adminId === req.admin.id).length });
});
app.delete('/api/admin/push', adminApi.adminAuth, (req, res) => {
  const ep = req.body?.endpoint; if (ep) store.del('adm_push', crypto.createHash('sha1').update(ep).digest('hex'));
  res.json({ ok: true });
});
app.post('/api/admin/push/test', adminApi.adminAuth, wrap(async (req, res) => {
  const subs = store.filter('adm_push', (s) => s.adminId === req.admin.id);
  if (!subs.length) return res.status(400).json({ error: 'Bu cihazda bildirim açık değil.' });
  await Promise.all(subs.map((s) => webpush.sendNotification(s.sub, JSON.stringify({ title: 'SwipeUp yönetim', body: 'Bildirimler çalışıyor 🎉', url: '/admin/#/support', tag: 'adm-test', icon: '/icons/icon-192.png' })).catch(() => {})));
  res.json({ ok: true, count: subs.length });
}));

// ---------- Ek özellikler (mağaza, doğrulama, gizlilik, çıkartmalar, etiketler…) ----------
const featureCtx = {
  store, io, auth, wrap, eco, notify, emitTo, brief, pub, postOut, chatOut, sendMessage, canSee, priv,
  isBlocked, limited, isMedia, isGif: (u) => GIF_HOSTS.test(String(u || '')), cardOut, purgeUser, moderation, chatBetween, admin: adminApi,
  online, appEvent, falci, msgOut, falLock, shownAge, tagsOf, dropMediaCache: (id) => dropMediaCache(id), getMedia: (id) => getMedia(id), pushAdmins,
};
require('./server/features')(app, featureCtx);
require('./server/genel')(app, featureCtx);
require('./server/market')(app, featureCtx);
require('./server/social')(app, featureCtx);
require('./server/falai')(app, featureCtx);
require('./server/support')(app, featureCtx);
require('./server/promo')(app, featureCtx);
require('./server/tags')(app, featureCtx);
require('./server/wheel')(app, featureCtx);
require('./server/erp')(app, featureCtx);
require('./server/quests')(app, featureCtx);
require('./server/growth')(app, featureCtx);
require('./server/songs')(app, featureCtx);
require('./server/venues')(app, featureCtx);
require('./server/contests')(app, featureCtx);
require('./server/engage')(app, featureCtx); // seriler, kulüpler, günün sorusu, seçki, karaoke… (en son yüklenir)
gameOut = featureCtx.gameOut;

// ---------- Statik ----------
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, p) {
    if (p.endsWith('sw.js') || p.endsWith('.html') || p.endsWith('.js') || p.endsWith('.css')) res.setHeader('Cache-Control', 'no-cache');
  },
}));
app.get(/^\/(?!api|media|admin|socket\.io).*/, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Dosya en fazla 40 MB olabilir.' });
  res.status(500).json({ error: 'Sunucu hatası, tekrar dene.' });
});

// ================= Socket.IO =================
io.use((socket, next) => {
  if (maintenance()) return next(new Error('maintenance'));
  try {
    const { id } = jwt.verify(socket.handshake.auth?.token, JWT_SECRET);
    const u = store.get('users', id);
    if (!u) return next(new Error('unauthorized'));
    if (banInfo(u)) return next(new Error('banned'));
    socket.data.userId = u.id;
    socket.data.visible = true;
    next();
  } catch { next(new Error('unauthorized')); }
});

function broadcastPresence(userId) {
  const u = store.get('users', userId);
  if (priv(u).hideLastSeen) return io.emit('presence', { userId, online: false, lastSeen: null });
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

  socket.emit('app:version', { version: APP_VERSION });
  socket.emit('lives', [...lives.values()].map(liveOut));
  socket.emit('presence:all', [...online.keys()].filter((id) => isOnline(id) && !priv(store.get('users', id)).hideLastSeen));
  // Çalan bir arama varsa (uygulama bildirimden açıldıysa) tekrar göster
  for (const c of calls.values()) {
    if (c.to === uid && c.state === 'ringing') socket.emit('call:incoming', { callId: c.id, chatId: c.chatId, video: c.video, from: brief(store.get('users', c.from)) });
  }

  socket.on('visibility', (v) => { socket.data.visible = !!v; });
  featureCtx.genelSocket(socket);
  featureCtx.speedSocket(socket);

  socket.on('message:send', (data, ack) => {
    const c = store.get('chats', data?.chatId);
    if (!c || !c.members.includes(uid)) return ack?.({ error: 'Sohbet bulunamadı.' });
    if (limited('msg:' + uid, 60, 60000)) return ack?.({ error: 'Çok hızlı mesaj gönderiyorsun.' });
    const lock = falLock(c, uid); if (lock) return ack?.({ error: lock, falLock: true });
    if (store.get('users', uid)?.role === 'falci' && !data?.now && featureCtx.falHoldUntil?.(c)) return ack?.({ ok: true, held: true, hold: featureCtx.falHold(c, uid, data || {}) });
    const msg = sendMessage(c, uid, { ...data, system: false, fal: null, story: null, quote: null, game: null, plan: null, superMsg: false, share: null });
    ack?.(msg ? { ok: true, msg: msgOut(msg) } : { error: 'Mesaj gönderilemedi.' });
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
    const me = store.get('users', uid);
    if (priv(me).hideRead) {
      // Okundu bilgisi kapalı: okundu sayılır ama karşı tarafa mavi tik gitmez
      store.filter('messages', (m) => m.chatId === chatId && !hasRead(m, uid)).forEach((m) => {
        m.seenBy = [...(m.seenBy || []), uid]; store.update('messages', m.id, {});
      });
      return emitTo(uid, 'read', { chatId, userId: uid, at: now() });
    }
    store.filter('messages', (m) => m.chatId === chatId && !m.readBy.includes(uid)).forEach((m) => {
      m.readBy.push(uid); store.update('messages', m.id, {});
    });
    c.members.forEach((m) => { if (m === uid || !priv(store.get('users', m)).hideRead) emitTo(m, 'read', { chatId, userId: uid, at: now() }); });
  });

  // ---- Sesli / görüntülü arama ----
  socket.on('call:start', ({ chatId, video }, ack) => {
    const c = store.get('chats', chatId);
    if (!c || c.isGroup || !c.members.includes(uid)) return ack?.({ error: 'Arama başlatılamadı.' });
    const to = c.members.find((m) => m !== uid);
    if (isBlocked(uid, to)) return ack?.({ error: 'Bu kişiyi arayamazsın.' });
    if (SPECIAL.has(store.get('users', to)?.role) || SPECIAL.has(store.get('users', uid)?.role)) return ack?.({ error: 'Bu hesapla arama yapılamaz.' });
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
    featureCtx.track?.('live');
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
    io.to(`live:${hostId}`).emit('live:comment', { hostId, user: brief(store.get('users', uid)), text: moderation.mask(text), at: now() });
  });
  socket.on('live:filter', ({ filter } = {}) => {
    const l = lives.get(uid);
    if (!l) return;
    l.filter = FILTERS.includes(filter) ? filter : null;
    io.to(`live:${uid}`).emit('live:filter', { hostId: uid, filter: l.filter });
  });
  socket.on('live:gift', ({ hostId, giftId }, ack) => {
    const l = lives.get(hostId);
    const gift = eco.get().gifts.find((g) => g.id === giftId);
    if (!l || !gift || hostId === uid) return ack?.({ error: 'Hediye gönderilemedi.' });
    if (limited('gift:' + uid, 20, 10000)) return ack?.({ error: 'Biraz yavaş 🙂' });
    if (!eco.spend(uid, gift.coins, 'gift', { to: hostId, gift: gift.id })) return ack?.({ error: 'Jetonun yetmiyor.', needCoins: true });
    eco.earn(hostId, Math.round(gift.coins * eco.get().creatorShare), 'gift', { fromId: uid, gift: gift.id });
    l.gifts = (l.gifts || 0) + gift.coins;
    const user = brief(store.get('users', uid));
    io.to(`live:${hostId}`).emit('live:gift', { hostId, gift, user, total: l.gifts, at: now() });
    ack?.({ ok: true, coins: store.get('users', uid).coins || 0 });
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

// Bir hesabı ve izlerini tamamen sil (hesap silme / yönetici silmesi)
function purgeUser(id) {
  online.get(id)?.forEach((s) => { s.emit('account:deleted', {}); s.disconnect(true); });
  endLive(id);
  store.filter('posts', (p) => p.userId === id).forEach((p) => store.del('posts', p.id));
  store.filter('posts', (p) => p.likes.includes(id) || p.comments.some((c) => c.userId === id))
    .forEach((p) => store.update('posts', p.id, { likes: p.likes.filter((x) => x !== id), comments: p.comments.filter((c) => c.userId !== id) }));
  store.filter('stories', (s) => s.userId === id).forEach((s) => store.del('stories', s.id));
  ['follows', 'swipes', 'blocks'].forEach((c) => store.filter(c, (x) => x.from === id || x.to === id).forEach((x) => store.del(c, x.id)));
  store.filter('matches', (m) => m.users.includes(id)).forEach((m) => store.del('matches', m.id));
  store.filter('chats', (c) => !c.isGroup && c.members.includes(id)).forEach((c) => removeChat(c.id));
  store.filter('chats', (c) => c.isGroup && c.members.includes(id)).forEach((c) => store.update('chats', c.id, { members: c.members.filter((m) => m !== id), admins: (c.admins || []).filter((m) => m !== id) }));
  store.filter('messages', (m) => m.from === id).forEach((m) => store.del('messages', m.id));
  store.filter('pub_msgs', (m) => m.userId === id).forEach((m) => store.del('pub_msgs', m.id));
  store.filter('notifications', (n) => n.userId === id || n.fromId === id).forEach((n) => store.del('notifications', n.id));
  store.filter('pushSubs', (s) => s.userId === id).forEach((s) => store.del('pushSubs', s.id));
  store.filter('verifications', (v) => v.userId === id).forEach((v) => store.del('verifications', v.id));
  store.del('resets', id);
  store.del('users', id);
  io.emit('people:gone', { id });
}

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

// Falcı Teyze hesabı: fal istekleri bu hesaba düşer, cevaplar bu hesaptan verilir
async function ensureFalci() {
  let f = falci();
  const pass = process.env.FALCI_PASSWORD;
  if (!f) {
    if (store.find('users', (u) => u.username === 'falciteyze')) return;
    const initial = pass || crypto.randomBytes(9).toString('base64url');
    f = store.put('users', {
      id: nanoid(10), username: 'falciteyze', name: 'Falcı Teyze', email: null, role: 'falci',
      bio: 'Kahve falı, tarot, burç ve aşk uyumu ☕️🔮 Fal isteğini Fal sayfasından gönder, cevabım mesaj kutuna gelsin.',
      age: null, gender: null, lookingFor: 'all', city: '', interests: ['Kahve falı', 'Tarot', 'Burçlar'],
      prefs: { ageMin: 18, ageMax: 99, maxKm: null },
      avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Falci%20Teyze&backgroundColor=f0c25a',
      photos: [], passHash: await bcrypt.hash(initial, 10), isBot: false, createdAt: now(), lastSeen: now(),
    });
    console.log(`[falci] Falcı Teyze hesabı oluşturuldu (kullanıcı adı: falciteyze)${pass ? '' : `, geçici şifre: ${initial}`}`);
  } else if (pass && !(await bcrypt.compare(pass, f.passHash)) && !f.passChangedByUser) {
    store.update('users', f.id, { passHash: await bcrypt.hash(pass, 10) });
  }
}

// SwipeUp yönetim (resmi) hesabı: takip edilebilir, paylaşımları herkese görünür; mesaj alınmaz, önerilerde çıkmaz
async function ensureOfficial() {
  const cur = official();
  if (cur) { const pass = process.env.OFFICIAL_PASSWORD; if (pass && !cur.passChangedByUser && !(await bcrypt.compare(pass, cur.passHash))) store.update('users', cur.id, { passHash: await bcrypt.hash(pass, 10) }); return; }
  if (store.find('users', (u) => u.username === 'swipeup')) { store.update('users', store.find('users', (u) => u.username === 'swipeup').id, { role: 'official' }); return; }
  const initial = process.env.OFFICIAL_PASSWORD || crypto.randomBytes(9).toString('base64url');
  store.put('users', {
    id: nanoid(10), username: 'swipeup', name: 'SwipeUp', email: null, role: 'official', verified: true,
    bio: 'SwipeUp’ın resmi hesabı 💜 Duyurular, etkinlikler ve yenilikler burada. Destek için: Ayarlar → Yardım ve destek.',
    age: null, gender: null, lookingFor: 'all', city: '', interests: [], prefs: { ageMin: 18, ageMax: 99, maxKm: null },
    avatar: '/icons/icon-192.png', photos: [], passHash: await bcrypt.hash(initial, 10), isBot: false, createdAt: now(), lastSeen: now(),
    privacy: { hideFromDeck: true },
  });
  console.log(`[official] SwipeUp yönetim hesabı oluşturuldu (kullanıcı adı: swipeup)${process.env.OFFICIAL_PASSWORD ? '' : `, geçici şifre: ${initial}`}`);
}

// ================= Başlat =================
(async () => {
  await store.init();
  await store.initStorage();
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
  await ensureFalci();
  await ensureOfficial();
  await adminApi.ensureAdmin?.();
  music.selfTest().catch(() => {});
  server.listen(PORT, () => {
    console.log(`SwipeUp hazır · port ${PORT} · sürüm ${APP_VERSION}`);
    // GIF anahtarı tanımlıysa bir kez dene, sonucu kayda yaz
    if (process.env.GIPHY_API_KEY || process.env.TENOR_API_KEY) gifSearch({}).then((r) => console.log(`[gif] ${r.provider} ${r.items.length ? `hazır (${r.items.length} sonuç)` : 'sonuç dönmedi, anahtarı kontrol et'}`)).catch(() => {});
  });

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

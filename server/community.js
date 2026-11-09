// Topluluk: seviye sistemi, haftanın en beğenilenleri, profil QR kodu, etkinlikler
const { nanoid } = require('nanoid');
const QRCode = require('qrcode');

const DAY = 86400000;
const now = () => Date.now();
const trDay = (t = now()) => new Date(t + 3 * 3600000).toISOString().slice(0, 10);
const trNow = (t = now()) => new Date(t + 3 * 3600000);
const weekOf = (t = now()) => { const d = trNow(t); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day); return d.toISOString().slice(0, 10); };

// ---------- Seviyeler ----------
const need = (n) => (n <= 1 ? 0 : Math.round(30 * (n - 1) ** 1.7));
const levelOfXp = (xp) => { let n = 1; while (n < 99 && need(n + 1) <= xp) n++; return n; };
const TITLES = [[40, '💎', 'SwipeUp Efsanesi'], [30, '👑', 'Efsane'], [20, '🌟', 'Süperstar'], [15, '⭐', 'Yıldız'], [10, '🔥', 'Popüler'], [5, '✨', 'Sosyal'], [1, '🌱', 'Yeni gelen']];
const titleOf = (n) => TITLES.find((t) => n >= t[0]);
// Etkinlik başına XP ve günlük üst sınır
const XP = {
  giris: [10, 10, 'Günlük giriş'], paylas: [15, 60, 'Gönderi ya da hikaye paylaşmak'], yorum: [4, 40, 'Yorum yapmak'], mesaj: [1, 20, 'Mesajlaşmak'],
  begeni: [1, 15, 'Kaydırmada beğenmek'], vitrin: [1, 10, 'Vitrin izlemek'], seri: [5, 25, 'Sohbet serisini sürdürmek'], liked: [2, 60, 'Gönderilerinin beğenilmesi'],
  oyun: [5, 30, 'Oyun oynamak'], event: [10, 20, 'Etkinlik oluşturmak'], going: [5, 15, 'Etkinliğe katılmak'], enler: [50, 150, 'Haftanın en beğenilenlerine girmek'],
};
const EVENT_CATS = { kahve: '☕ Kahve', yuruyus: '🥾 Yürüyüş', spor: '⚽ Spor', muzik: '🎶 Müzik', oyun: '🎲 Oyun', sanat: '🎨 Sanat', yemek: '🍕 Yemek', parti: '🎉 Parti', sohbet: '💬 Sohbet', diger: '📍 Diğer' };

module.exports = function community(app, ctx) {
  const { store, auth, brief, isBlocked, canSee, notify, emitTo, eco, limited, moderation, isMedia, postOut, io } = ctx;
  const SPECIAL = new Set(['falci', 'official']);

  // ================= Seviye sistemi =================
  const today = new Map(); let todayKey = trDay();
  const addXp = (uid, reason, n = 1) => {
    const rule = XP[reason]; if (!rule || !uid) return;
    const u = store.get('users', uid); if (!u || SPECIAL.has(u.role)) return;
    if (todayKey !== trDay()) { today.clear(); todayKey = trDay(); }
    const k = `${uid}:${reason}`; const got = today.get(k) || 0;
    const add = Math.min(rule[0] * n, rule[1] - got); if (add <= 0) return;
    today.set(k, got + add);
    const before = levelOfXp(u.xp || 0); const xp = (u.xp || 0) + add; const after = levelOfXp(xp);
    store.update('users', uid, { xp, level: after });
    if (after > before) {
      const [, em, title] = titleOf(after); const coins = Math.min(100, after * 3);
      eco.addCoins(uid, coins, 'level');
      notify(uid, { type: 'level', text: `Tebrikler! ${after}. seviyeye ulaştın ${em} ${title} · +${coins} jeton`, url: '/#/seviye', tag: 'level' });
      emitTo(uid, 'level', { level: after, title, em, coins });
    }
  };
  ctx.addXp = addXp;
  ctx.levelOf = (u) => { if (!u || SPECIAL.has(u.role)) return null; const n = levelOfXp(u.xp || 0); const [, em, title] = titleOf(n); return { n, em, title }; };
  // Görev ilerlemesi ve beğeni kaydı üzerinden XP
  const origQuest = ctx.quest;
  if (origQuest) ctx.quest = (uid, key, n = 1, uniq = null) => { origQuest(uid, key, n, uniq); addXp(uid, key, 1); };
  const origLike = ctx.likeLog;
  ctx.likeLog = (likerId, p) => { origLike?.(likerId, p); if (p?.userId && p.userId !== likerId) addXp(p.userId, 'liked'); };

  // İlk açılışta eski hesaplara geçmiş etkinliklerinden başlangıç puanı
  setTimeout(() => {
    const users = store.filter('users', (u) => u.xp == null && !SPECIAL.has(u.role));
    if (!users.length) return;
    const posts = store.filter('posts', () => true);
    users.forEach((u) => {
      const mine = posts.filter((p) => p.userId === u.id);
      const likes = mine.reduce((a, p) => a + p.likes.length, 0);
      const comments = posts.reduce((a, p) => a + p.comments.filter((c) => c.userId === u.id).length, 0);
      const days = Math.min(60, Math.floor((now() - (u.createdAt || now())) / DAY));
      const xp = Math.min(40, mine.length) * 15 + Math.min(400, likes) * 2 + Math.min(100, comments) * 4 + days * 3;
      store.update('users', u.id, { xp, level: levelOfXp(xp) });
    });
    console.log(`[seviye] ${users.length} hesaba başlangıç puanı verildi`);
  }, 5000).unref?.();

  app.get('/api/level', auth, (req, res) => {
    const u = req.user; const xp = u.xp || 0; const n = levelOfXp(xp); const [, em, title] = titleOf(n);
    const cur = need(n); const nxt = need(n + 1);
    const ladder = TITLES.slice().reverse().map(([at, e, t]) => ({ at, em: e, title: t, reached: n >= at }));
    const todayGot = Object.fromEntries(Object.keys(XP).map((k) => [k, todayKey === trDay() ? (today.get(`${u.id}:${k}`) || 0) : 0]));
    res.json({
      xp, level: n, em, title, cur, next: nxt, progress: nxt > cur ? Math.round(((xp - cur) / (nxt - cur)) * 100) : 100, toNext: Math.max(0, nxt - xp),
      ladder, ways: Object.entries(XP).map(([k, [v, cap, name]]) => ({ k, xp: v, cap, name, today: todayGot[k] })), reward: Math.min(100, (n + 1) * 3),
    });
  });
  // Haftalık XP sıralaması yerine toplam seviye sıralaması (takip ettiklerin arasında)
  app.get('/api/level/top', auth, (req, res) => {
    const me = req.user.id;
    const ids = new Set(store.filter('follows', (f) => f.from === me && f.status !== 'pending').map((f) => f.to)); ids.add(me);
    const list = [...ids].map((id) => store.get('users', id)).filter((u) => u && !SPECIAL.has(u.role) && !isBlocked(me, u.id))
      .sort((a, b) => (b.xp || 0) - (a.xp || 0)).slice(0, 30).map((u) => ({ ...brief(u), xp: u.xp || 0, lvl: ctx.levelOf(u) }));
    res.json(list);
  });

  // ================= Haftanın en beğenilenleri =================
  const score = (p) => p.likes.length + p.comments.length * 0.5 + (p.reposts || []).length * 2;
  const ranking = (from, to, viewerId) => store.filter('posts', (p) => p.createdAt >= from && p.createdAt < to && !p.sponsored)
    .filter((p) => { const o = store.get('users', p.userId); return o && !SPECIAL.has(o.role) && !(o.privacy || {}).private && (!viewerId || (!isBlocked(viewerId, o.id) && canSee(viewerId, o))); })
    .filter((p) => score(p) > 0).sort((a, b) => score(b) - score(a) || b.createdAt - a.createdAt);
  const weekStart = (t = now()) => new Date(`${weekOf(t)}T00:00:00+03:00`).getTime();
  app.get('/api/weekly-best', auth, (req, res) => {
    const me = req.user.id; const from = weekStart(); const to = from + 7 * DAY;
    const items = ranking(from, to, me).slice(0, 15).map((p, i) => ({ ...postOut(p, me), rank: i + 1 }));
    const prev = store.get('weekly_best', weekOf(from - DAY));
    const last = prev ? prev.items.map((x) => { const p = store.get('posts', x.id); const o = p && store.get('users', p.userId); return p && o && !isBlocked(me, o.id) && canSee(me, o) ? { ...postOut(p, me), rank: x.rank, coins: x.coins } : null; }).filter(Boolean) : [];
    res.json({ from, to, items, last, lastWeek: prev?.id || null });
  });
  // Pazartesi 10:00 (TR): geçen haftanın ilk 3'ü ödüllendirilir
  const PRIZE = [50, 30, 20];
  setInterval(() => {
    const d = trNow(); if (d.getUTCDay() !== 1 || d.getUTCHours() < 10) return;
    const from = weekStart() - 7 * DAY; const id = weekOf(from);
    if (store.get('weekly_best', id)) return;
    const top = ranking(from, from + 7 * DAY, null).slice(0, 3);
    store.put('weekly_best', { id, items: top.map((p, i) => ({ id: p.id, userId: p.userId, rank: i + 1, coins: PRIZE[i], score: score(p) })), at: now() });
    const seen = new Set();
    top.forEach((p, i) => {
      if (seen.has(p.userId)) return; seen.add(p.userId);
      eco.addCoins(p.userId, PRIZE[i], 'weekly_best'); addXp(p.userId, 'enler');
      notify(p.userId, { type: 'level', ref: p.id, text: `🏆 Gönderin geçen haftanın en beğenilenleri arasında ${i + 1}. oldu! +${PRIZE[i]} jeton`, url: '/#/haftanin-enleri' });
    });
  }, 10 * 60000).unref?.();

  // ================= Profil QR kodu =================
  const qrCache = new Map();
  app.get('/qr/:username.svg', async (req, res) => {
    const u = store.find('users', (x) => x.username === String(req.params.username).toLowerCase());
    if (!u) return res.status(404).end();
    const color = /^[0-9a-f]{6}$/i.test(req.query.c || '') ? `#${req.query.c}` : '#1a1027';
    const key = `${u.username}:${color}`;
    let svg = qrCache.get(key);
    if (!svg) {
      const host = `${String(req.get('x-forwarded-proto') || req.protocol).split(',')[0]}://${req.get('host')}`;
      svg = await QRCode.toString(`${host}/#/u/${u.username}`, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: color, light: '#0000' } });
      if (qrCache.size > 500) qrCache.clear();
      qrCache.set(key, svg);
    }
    res.set('content-type', 'image/svg+xml').set('cache-control', 'public, max-age=86400').send(svg);
  });

  // ================= Etkinlikler =================
  const evAlive = (e) => e && e.status !== 'cancelled';
  const evVisible = (e, me) => {
    if (!e) return false; if (e.userId === me) return true;
    const o = store.get('users', e.userId); if (!o || isBlocked(me, o.id)) return false;
    if (e.audience === 'followers') { const f = store.get('follows', `${me}_${o.id}`); return !!f && f.status !== 'pending'; }
    return true;
  };
  const evOut = (e, me, full = false) => {
    const going = e.going || []; const interested = e.interested || [];
    return {
      id: e.id, title: e.title, desc: full ? e.desc : String(e.desc || '').slice(0, 140), cat: e.cat, catName: EVENT_CATS[e.cat] || EVENT_CATS.diger, startAt: e.startAt, place: e.place, city: e.city, cover: e.cover || null,
      capacity: e.capacity || 0, audience: e.audience || 'all', status: e.status || 'active', user: brief(store.get('users', e.userId)), goingCount: going.length, interestedCount: interested.length,
      my: going.includes(me) ? 'going' : interested.includes(me) ? 'interested' : null, mine: e.userId === me, chatId: going.includes(me) || e.userId === me ? e.chatId || null : null,
      faces: going.slice(0, 5).map((id) => store.get('users', id)).filter(Boolean).map((u) => ({ id: u.id, avatar: u.avatar })),
      ...(full ? { going: going.map((id) => store.get('users', id)).filter((u) => u && !isBlocked(me, u.id)).slice(0, 60).map(brief) } : {}),
    };
  };
  app.get('/api/events', auth, (req, res) => {
    const me = req.user.id; const tab = String(req.query.tab || 'upcoming'); const lim = now() - 3 * 3600000;
    let list = store.filter('events', (e) => evAlive(e) && evVisible(e, me));
    if (tab === 'mine') list = list.filter((e) => e.userId === me);
    else if (tab === 'going') list = list.filter((e) => (e.going || []).includes(me) || (e.interested || []).includes(me));
    else list = list.filter((e) => e.startAt > lim);
    const city = String(req.query.city || '').toLocaleLowerCase('tr-TR').trim();
    if (city) list = list.filter((e) => String(e.city || '').toLocaleLowerCase('tr-TR').includes(city));
    list.sort((a, b) => (tab === 'mine' ? b.startAt - a.startAt : a.startAt - b.startAt));
    res.json(list.slice(0, 80).map((e) => evOut(e, me)));
  });
  app.get('/api/events/:id', auth, (req, res) => {
    const e = store.get('events', req.params.id);
    if (!e || !evVisible(e, req.user.id)) return res.status(404).json({ error: 'Etkinlik bulunamadı.' });
    res.json(evOut(e, req.user.id, true));
  });
  const clean = (b, old = {}) => {
    const title = moderation.mask(String(b.title ?? old.title ?? '').trim().slice(0, 80));
    const desc = moderation.mask(String(b.desc ?? old.desc ?? '').trim().slice(0, 1200));
    const place = moderation.mask(String(b.place ?? old.place ?? '').trim().slice(0, 120));
    const city = String(b.city ?? old.city ?? '').trim().slice(0, 40);
    const startAt = b.startAt != null ? +new Date(b.startAt) : old.startAt;
    const cat = EVENT_CATS[b.cat] ? b.cat : old.cat || 'diger';
    const capacity = Math.max(0, Math.min(500, parseInt(b.capacity ?? old.capacity ?? 0, 10) || 0));
    const cover = b.cover === null ? null : isMedia(b.cover) ? String(b.cover) : old.cover || null;
    const audience = b.audience === 'followers' ? 'followers' : b.audience === 'all' ? 'all' : old.audience || 'all';
    if (title.length < 3) return { error: 'Etkinliğe en az 3 harfli bir ad ver.' };
    if (place.length < 2) return { error: 'Etkinliğin yerini yaz.' };
    if (!Number.isFinite(startAt) || startAt < now() + 10 * 60000) return { error: 'Başlangıç saati en az 10 dakika sonrası olmalı.' };
    if (startAt > now() + 120 * DAY) return { error: 'En fazla 4 ay sonrasına etkinlik oluşturabilirsin.' };
    return { title, desc, place, city, startAt, cat, capacity, cover, audience };
  };
  app.post('/api/events', auth, (req, res) => {
    const me = req.user;
    if (SPECIAL.has(me.role)) return res.status(403).json({ error: 'Bu hesap etkinlik oluşturamaz.' });
    if (limited('ev:' + me.id, 5, DAY)) return res.status(429).json({ error: 'Bugün yeterince etkinlik oluşturdun 🙂' });
    const v = clean(req.body || {}); if (v.error) return res.status(400).json(v);
    let chatId = null;
    if (req.body?.chat !== false) {
      const chat = store.put('chats', { id: 'g_' + nanoid(12), isGroup: true, name: `📅 ${v.title}`.slice(0, 50), avatar: v.cover || ctx.groupAvatar?.(v.title) || me.avatar, members: [me.id], admins: [me.id], createdAt: now(), lastAt: now(), eventId: null });
      chatId = chat.id;
    }
    const e = store.put('events', { id: nanoid(10), userId: me.id, ...v, going: [me.id], interested: [], chatId, status: 'active', at: now(), reminded: false });
    if (chatId) { store.update('chats', chatId, { eventId: e.id }); ctx.systemMsg?.(store.get('chats', chatId), `${me.name} “${v.title}” etkinliğinin sohbetini açtı. Katılanlar buraya eklenir.`); }
    addXp(me.id, 'event');
    // Takipçilere haber ver (en fazla 200)
    store.filter('follows', (f) => f.to === me.id && f.status !== 'pending').slice(0, 200).forEach((f) => notify(f.from, { type: 'event', fromId: me.id, ref: e.id, text: `${me.username} bir etkinlik oluşturdu: ${v.title}`, url: `/#/etkinlik/${e.id}` }));
    res.json(evOut(e, me.id, true));
  });
  app.patch('/api/events/:id', auth, (req, res) => {
    const e = store.get('events', req.params.id);
    if (!e || e.userId !== req.user.id) return res.status(404).json({ error: 'Etkinlik bulunamadı.' });
    if (req.body?.cancel) {
      store.update('events', e.id, { status: 'cancelled' });
      (e.going || []).filter((id) => id !== e.userId).forEach((id) => notify(id, { type: 'event', fromId: e.userId, ref: e.id, text: `“${e.title}” etkinliği iptal edildi.`, url: `/#/etkinlik/${e.id}` }));
      if (e.chatId) ctx.systemMsg?.(store.get('chats', e.chatId), 'Etkinlik iptal edildi.');
      return res.json(evOut(store.get('events', e.id), req.user.id, true));
    }
    const v = clean(req.body || {}, e); if (v.error) return res.status(400).json(v);
    const moved = v.startAt !== e.startAt;
    store.update('events', e.id, { ...v, ...(moved ? { reminded: false } : {}) });
    if (moved) (e.going || []).filter((id) => id !== e.userId).forEach((id) => notify(id, { type: 'event', fromId: e.userId, ref: e.id, text: `“${v.title}” etkinliğinin saati değişti.`, url: `/#/etkinlik/${e.id}` }));
    res.json(evOut(store.get('events', e.id), req.user.id, true));
  });
  app.post('/api/events/:id/rsvp', auth, (req, res) => {
    const me = req.user; const e = store.get('events', req.params.id);
    if (!evAlive(e) || !evVisible(e, me.id)) return res.status(404).json({ error: 'Etkinlik bulunamadı.' });
    if (e.userId === me.id) return res.status(400).json({ error: 'Kendi etkinliğine zaten katılıyorsun.' });
    if (e.startAt < now() - 3 * 3600000) return res.status(400).json({ error: 'Bu etkinlik sona erdi.' });
    const st = ['going', 'interested'].includes(req.body?.status) ? req.body.status : 'none';
    let going = (e.going || []).filter((x) => x !== me.id); let interested = (e.interested || []).filter((x) => x !== me.id);
    const was = (e.going || []).includes(me.id);
    if (st === 'going') { if (e.capacity && going.length >= e.capacity) return res.status(409).json({ error: 'Etkinlik dolu.' }); going = [...going, me.id]; }
    if (st === 'interested') interested = [...interested, me.id];
    store.update('events', e.id, { going, interested });
    const chat = e.chatId && store.get('chats', e.chatId);
    if (chat) {
      if (st === 'going' && !chat.members.includes(me.id)) { store.update('chats', chat.id, { members: [...chat.members, me.id].slice(0, 300) }); ctx.systemMsg?.(store.get('chats', chat.id), `${me.name} katıldı 🎉`); io.emit('chat:update', { chatId: chat.id }); }
      if (st !== 'going' && was && chat.members.includes(me.id) && chat.members[0] !== me.id) { store.update('chats', chat.id, { members: chat.members.filter((x) => x !== me.id) }); ctx.systemMsg?.(store.get('chats', chat.id), `${me.name} etkinlikten ayrıldı`); }
    }
    if (st === 'going' && !was) { addXp(me.id, 'going'); notify(e.userId, { type: 'event', fromId: me.id, ref: e.id, text: `${me.username} “${e.title}” etkinliğine katılıyor 🎉`, url: `/#/etkinlik/${e.id}`, tag: 'ev-' + e.id }); }
    res.json(evOut(store.get('events', e.id), me.id, true));
  });
  // Başlamadan ~2 saat önce katılanlara hatırlatma
  setInterval(() => {
    const t = now();
    store.filter('events', (e) => evAlive(e) && !e.reminded && e.startAt > t && e.startAt - t < 2 * 3600000).forEach((e) => {
      store.update('events', e.id, { reminded: true });
      const hh = new Date(e.startAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
      (e.going || []).forEach((id) => notify(id, { type: 'event', ref: e.id, text: `⏰ “${e.title}” bugün ${hh}’de başlıyor · ${e.place}`, url: `/#/etkinlik/${e.id}`, tag: 'evr-' + e.id }));
    });
    // 30 günden eski etkinlikler silinir
    store.filter('events', (e) => e.startAt < t - 30 * DAY).forEach((e) => store.del('events', e.id));
  }, 5 * 60000).unref?.();
  ctx.eventCats = EVENT_CATS;
};
module.exports.EVENT_CATS = EVENT_CATS;

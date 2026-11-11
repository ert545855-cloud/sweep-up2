// Büyüme panosu (günlük aktiflik, elde tutma, özellik kullanımı) ve spam / sahte hesap tespiti
const { nanoid } = require('nanoid');

const DAY = 86400000;
module.exports = function growth(app, ctx) {
  const { store, isBlocked } = ctx;
  const now = () => Date.now();
  const trDay = (t = now()) => new Date(t + 3 * 3600000).toISOString().slice(0, 10);
  const dayStart = (d) => Date.parse(`${d}T00:00:00+03:00`);

  // ---------- Günlük aktiflik ve olay sayaçları ----------
  const act = new Map(); // gün -> { users:Set, ev:{} }
  const dirty = new Set();
  const load = (d) => {
    if (act.has(d)) return act.get(d);
    const doc = store.get('activity', d);
    const a = { users: new Set(doc?.users || []), ev: { ...(doc?.ev || {}) } };
    act.set(d, a); return a;
  };
  ctx.onActive = (uid) => {
    const d = trDay(); const a = load(d);
    if (!a.users.has(uid)) { a.users.add(uid); dirty.add(d); }
    ctx.questLogin?.(uid);
  };
  ctx.track = (ev, n = 1) => { const d = trDay(); const a = load(d); a.ev[ev] = (a.ev[ev] || 0) + n; dirty.add(d); };
  const flush = () => { for (const d of dirty) { const a = act.get(d); if (a) store.put('activity', { id: d, day: d, users: [...a.users], ev: a.ev }); } dirty.clear(); for (const d of act.keys()) if (d < trDay(now() - 2 * DAY)) act.delete(d); };
  setInterval(flush, 60000).unref();
  process.once?.('SIGTERM', flush);

  // ---------- Spam tespiti ----------
  const flagOnce = new Set();
  const flag = (key, doc, { update = false } = {}) => {
    const open = store.find('flags', (f) => f.key === key && f.status === 'open');
    if (open) { if (update) store.update('flags', open.id, { ...doc, at: now() }); return; }
    if (flagOnce.has(key) && !update) return; flagOnce.add(key);
    store.put('flags', { id: nanoid(12), key, status: 'open', at: now(), ...doc });
  };
  setInterval(() => flagOnce.clear(), 6 * 3600000).unref();
  const norm = (t) => String(t || '').toLocaleLowerCase('tr-TR').replace(/https?:\/\/\S+/g, 'URL').replace(/[\d\s.,!?:;'"’()\-_*]+/g, '').slice(0, 300);
  const recent = new Map(); // uid|hash -> { chats:Set, first, last }
  const LINKY = /(https?:\/\/|www\.|\.com\b|\.net\b|t\.me\/|wa\.me\/|instagram|onlyfans|telegram|whatsapp|\b0?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b)/i;
  ctx.onMessage = (msg, chat, sender) => {
    if (!msg || msg.system || !sender || sender.role === 'falci' || !msg.text || msg.text.length < 8) return;
    const h = norm(msg.text); if (h.length < 6) return;
    const k = `${sender.id}|${h}`;
    const r = recent.get(k) || { chats: new Set(), first: now(), msgId: msg.id };
    r.chats.add(chat.id); r.last = now(); recent.set(k, r);
    if (r.chats.size >= 5 && now() - r.first < 3600000) {
      flag(`spam:${k}`, { kind: 'spam', userId: sender.id, chatId: chat.id, ref: msg.id, text: msg.text.slice(0, 500), level: 'high', reason: `Spam: aynı mesajı 1 saatte ${r.chats.size} farklı sohbete gönderdi` });
    }
    // Yeni hesap eşleşmediği kişilere link / telefon / sosyal medya hesabı yayıyor
    if (LINKY.test(msg.text) && now() - (sender.createdAt || 0) < 3 * DAY && !chat.isGroup) {
      const other = chat.members.find((m) => m !== sender.id);
      if (!store.get('matches', [sender.id, other].sort().join('_'))) {
        const lk = `link|${sender.id}`;
        const lr = recent.get(lk) || { chats: new Set(), first: now() };
        lr.chats.add(chat.id); recent.set(lk, lr);
        if (lr.chats.size >= 3 && now() - lr.first < 6 * 3600000) flag(`link:${sender.id}`, { kind: 'spam', userId: sender.id, chatId: chat.id, ref: msg.id, text: msg.text.slice(0, 500), level: 'high', reason: `Şüpheli: yeni hesap ${lr.chats.size} kişiye link/telefon/hesap gönderdi` });
      }
    }
  };
  setInterval(() => { const lim = now() - 6 * 3600000; for (const [k, v] of recent) if ((v.last || v.first) < lim) recent.delete(k); }, 600000).unref();

  // Bot gibi kaydırma
  const swipes = new Map();
  ctx.onSwipe = (uid, dir) => {
    if (dir === 'left') return;
    const t = now(); const arr = (swipes.get(uid) || []).filter((x) => t - x < 10 * 60000); arr.push(t); swipes.set(uid, arr);
    if (arr.length >= 150) flag(`swipe:${uid}:${trDay()}`, { kind: 'spam', userId: uid, chatId: null, ref: null, text: `10 dakikada ${arr.length} beğeni`, level: 'normal', reason: 'Bot gibi kaydırma (çok hızlı ve çok sayıda beğeni)' });
  };

  // Çoklu hesap: aynı cihaz / aynı ağ
  ctx.onRegister = (u, req) => {
    const ip = ctx.ipOf ? ctx.ipOf(req) : (req.ip || '');
    const dev = String(req.headers['x-device'] || '').replace(/[^a-f0-9]/gi, '').slice(0, 40) || null;
    store.update('users', u.id, { regIp: ip || null, regDevice: dev });
    if (dev) {
      const same = store.filter('users', (x) => x.regDevice === dev && x.createdAt > now() - 30 * DAY);
      if (same.length >= 3) flag(`dev:${dev}`, { kind: 'multi', userId: u.id, chatId: null, ref: null, text: `Aynı cihazdan açılan hesaplar: ${same.map((x) => '@' + x.username).join(', ')}`, level: same.length >= 5 ? 'high' : 'normal', reason: `Çoklu hesap: aynı cihazdan 30 günde ${same.length} hesap` }, { update: true });
    }
    if (ip) {
      const same = store.filter('users', (x) => x.regIp === ip && x.createdAt > now() - DAY);
      if (same.length >= 4) flag(`ip:${ip}:${trDay()}`, { kind: 'multi', userId: u.id, chatId: null, ref: null, text: `Aynı ağdan 24 saatte açılan hesaplar: ${same.map((x) => '@' + x.username).join(', ')}`, level: same.length >= 8 ? 'high' : 'normal', reason: `Çoklu hesap: aynı ağdan 24 saatte ${same.length} hesap` }, { update: true });
    }
  };

  // ---------- Yönetim: büyüme panosu ----------
  const A = ctx.admin;
  if (!A?.adminAuth) return;
  app.get('/api/admin/growth', A.adminAuth, (req, res) => {
    flush();
    const N = Math.max(7, Math.min(90, parseInt(req.query.days, 10) || 30));
    const today = trDay();
    const days = Array.from({ length: N }, (_, i) => trDay(now() - (N - 1 - i) * DAY));
    const actDoc = (d) => store.get('activity', d);
    const activeSet = (d) => new Set(actDoc(d)?.users || []);
    const users = store.all('users').filter((u) => !['falci', 'official'].includes(u.role));
    const unionOf = (from, to) => { const s = new Set(); for (let t = from; t <= to; t += DAY) (actDoc(trDay(t))?.users || []).forEach((x) => s.add(x)); return s; };
    const dau = days.map((d) => ({ day: d, n: actDoc(d)?.users?.length || 0 }));
    const newU = days.map((d) => ({ day: d, n: users.filter((u) => trDay(u.createdAt) === d).length }));
    const tracking = store.all('activity').map((a) => a.day).sort()[0] || today;
    // Elde tutma: kayıt günü kohortları
    const ret = (k) => {
      let base = 0; let back = 0;
      days.forEach((d) => {
        const target = trDay(dayStart(d) + k * DAY + 3600000);
        if (target > today || d < tracking) return;
        const cohort = users.filter((u) => trDay(u.createdAt) === d); if (!cohort.length) return;
        const act_ = activeSet(target);
        base += cohort.length; back += cohort.filter((u) => act_.has(u.id)).length;
      });
      return base ? Math.round((back / base) * 1000) / 10 : null;
    };
    const t = now();
    const wau = unionOf(t - 6 * DAY, t).size; const mau = unionOf(t - 29 * DAY, t).size;
    // Özellik kullanımı (gün gün)
    const by = (list, key = 'at') => { const m = {}; list.forEach((x) => { const d = trDay(x[key]); m[d] = (m[d] || 0) + 1; }); return m; };
    const msgs = store.all('messages').filter((m) => !m.system);
    const feats = [
      ['Mesaj', by(msgs.filter((m) => !m.fal && !m.share))],
      ['Kaydırma (beğeni)', by(store.all('swipes').filter((s) => s.dir !== 'left'))],
      ['Eşleşme', by(store.all('matches'))],
      ['Gönderi', by(store.all('posts').filter((p) => p.type === 'image'), 'createdAt')],
      ['Vitrin videosu', by(store.all('posts').filter((p) => p.type === 'reel'), 'createdAt')],
      ['Yorum', by(store.all('posts').flatMap((p) => p.comments || []))],
      ['Genel sohbet / odalar', by(store.all('pub_msgs'))],
      ['Fal isteği', by(msgs.filter((m) => m.fal))],
      ['İçerik paylaşımı (DM)', by(msgs.filter((m) => m.share))],
      ['Destek talebi', by(store.all('support'))],
      ['Öne çıkarma', by(store.all('promos'))],
      ['Jeton/Plus satın alma', by(store.all('orders').filter((o) => o.status === 'approved' && o.closedAt), 'closedAt')],
    ];
    const evDays = Object.fromEntries(days.map((d) => [d, actDoc(d)?.ev || {}]));
    [['Hikaye', 'story'], ['Canlı yayın', 'live'], ['Hızlı tanışma turu', 'speed']].forEach(([l, k]) => feats.push([l, Object.fromEntries(days.map((d) => [d, evDays[d][k] || 0]))]));
    const sum = (m, from) => Object.entries(m).filter(([d]) => d >= from).reduce((a, [, n]) => a + n, 0);
    const d7 = trDay(t - 6 * DAY); const d14 = trDay(t - 13 * DAY); const d30 = days[0];
    const features = feats.map(([name, m]) => ({ name, today: m[today] || 0, d7: sum(m, d7), prev7: sum(m, d14) - sum(m, d7), d30: sum(m, d30), series: days.map((d) => ({ day: d, n: m[d] || 0 })) }));
    // Kullanıcı başına ortalama (son 7 gün aktifler)
    res.json({
      days: N, tracking, totals: { users: users.length, dau: dau[dau.length - 1].n, wau, mau, stickiness: mau ? Math.round((dau[dau.length - 1].n / mau) * 1000) / 10 : null, new7: users.filter((u) => u.createdAt > t - 7 * DAY).length, d1: ret(1), d7: ret(7), d30: ret(30) },
      dau, newUsers: newU, features,
      flags: { spamOpen: store.filter('flags', (f) => f.status === 'open' && f.kind === 'spam').length, multiOpen: store.filter('flags', (f) => f.status === 'open' && f.kind === 'multi').length },
    });
  });
};

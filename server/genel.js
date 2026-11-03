// Genel sohbet: tüm üyelerin aynı odada konuştuğu herkese açık sohbet.
const { nanoid } = require('nanoid');

const KEEP = 1500; // oda başına en fazla tutulan mesaj

// Etkinlik odaları: genel sohbetin konulu ve saatli hâli. Saatler Türkiye saatiyle; days: 0=Pazar.
const DEFAULT_ROOMS = [
  { id: 'muzik', em: '🎵', name: 'Müzik', desc: 'Bu akşam ne dinliyorsun?', days: [0, 1, 2, 3, 4, 5, 6], from: '20:00', to: '24:00' },
  { id: 'futbol', em: '⚽', name: 'Futbol', desc: 'Maç akşamları birlikte izle, yorumla', days: [0, 2, 3, 5, 6], from: '18:00', to: '24:00' },
  { id: 'dizi', em: '🎬', name: 'Film & Dizi', desc: 'Spoiler vermeden konuş 🙂', days: [0, 1, 2, 3, 4, 5, 6], from: '21:00', to: '01:00' },
  { id: 'oyun', em: '🎮', name: 'Oyun', desc: 'Takım arkadaşı bul', days: [0, 1, 2, 3, 4, 5, 6], from: '18:00', to: '02:00' },
  { id: 'istanbul', em: '🌉', name: 'İstanbul’dakiler', desc: 'Şehirdeki etkinlikler ve buluşmalar', always: true },
  { id: 'izmir', em: '🌊', name: 'İzmir’dekiler', desc: 'Kordon’dan selam', always: true },
  { id: 'ankara', em: '🏛️', name: 'Ankara’dakiler', desc: 'Başkentten herkes burada', always: true },
  { id: 'gece', em: '🌙', name: 'Gece kuşları', desc: 'Uyuyamayanlar odası', days: [0, 1, 2, 3, 4, 5, 6], from: '00:00', to: '05:00' },
];

module.exports = function genel(app, ctx) {
  const { store, io, auth, brief, limited, moderation, notify, isMedia } = ctx;
  const now = () => Date.now();
  const rooms = () => (store.get('settings', 'rooms')?.list || DEFAULT_ROOMS);
  ctx.rooms = rooms; ctx.DEFAULT_ROOMS = DEFAULT_ROOMS;
  const mins = (hm) => { const [h, m] = String(hm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  // TR saatine göre açık mı; kapalıysa bir sonraki açılış
  function roomState(r, t = now()) {
    if (!r) return { open: false };
    if (r.always || r.id === 'genel') return { open: true };
    const d = new Date(t + 3 * 3600000);
    const day = d.getUTCDay(); const cur = d.getUTCHours() * 60 + d.getUTCMinutes();
    const f = mins(r.from); let to = mins(r.to); if (to === 0) to = 1440;
    const inWin = (dd, m) => (to > f ? (r.days || []).includes(dd) && m >= f && m < to : ((r.days || []).includes(dd) && m >= f) || ((r.days || []).includes((dd + 6) % 7) && m < to));
    if (inWin(day, cur)) {
      const endIn = to > f ? to - cur : (cur >= f ? 1440 - cur + to : to - cur);
      return { open: true, closesAt: t + endIn * 60000 };
    }
    for (let k = 0; k < 8 * 1440; k += 15) {
      const m = cur + k; const dd = (day + Math.floor(m / 1440)) % 7; const mm = m % 1440;
      if (inWin(dd, mm)) return { open: false, opensAt: t + k * 60000 };
    }
    return { open: false };
  }
  ctx.roomState = roomState;
  const roomOf = (id) => (id && id !== 'genel' ? rooms().find((r) => r.id === id) : { id: 'genel', name: 'Genel sohbet', em: '💬', always: true });
  const ioRoom = (id) => (id && id !== 'genel' ? `genel:${id}` : 'genel');
  const roomOfMsg = (m) => m.room || 'genel';
  const out = (m) => ({ ...m, room: roomOfMsg(m), user: brief(store.get('users', m.userId)) });
  const uniqueOnline = (rid) => {
    const ids = new Set();
    (io.sockets.adapter.rooms.get(ioRoom(rid)) || new Set()).forEach((sid) => { const s = io.sockets.sockets.get(sid); if (s) ids.add(s.data.userId); });
    return ids.size;
  };
  const broadcastCount = (rid) => io.to(ioRoom(rid)).emit('genel:online', { room: rid || 'genel', count: uniqueOnline(rid) });

  app.get('/api/rooms', auth, (req, res) => {
    res.json(rooms().map((r) => ({ ...r, ...roomState(r), online: uniqueOnline(r.id), last: store.filter('pub_msgs', (m) => m.room === r.id).length })));
  });
  app.get('/api/genel', auth, (req, res) => {
    const rid = String(req.query.room || 'genel');
    const r = roomOf(rid);
    if (!r) return res.status(404).json({ error: 'Oda bulunamadı.' });
    const before = +req.query.before || Infinity;
    const list = store.filter('pub_msgs', (m) => roomOfMsg(m) === rid && m.at < before).sort((a, b) => a.at - b.at);
    const blocked = new Set(store.filter('blocks', (b) => b.from === req.user.id || b.to === req.user.id).map((b) => (b.from === req.user.id ? b.to : b.from)));
    res.json({ room: { ...r, ...roomState(r) }, items: list.slice(-120).filter((m) => !blocked.has(m.userId)).map(out), online: uniqueOnline(rid), more: list.length > 120 });
  });

  if (ctx.admin?.adminAuth) {
    const { adminAuth, owner, audit } = ctx.admin;
    app.get('/api/admin/rooms', adminAuth, (req, res) => res.json({ list: rooms().map((r) => ({ ...r, ...roomState(r) })) }));
    app.put('/api/admin/rooms', adminAuth, owner, (req, res) => {
      const hm = (v, d) => (/^([01]?\d|2[0-4]):[0-5]\d$/.test(String(v || '')) ? String(v).padStart(5, '0') : d);
      const list = (Array.isArray(req.body?.list) ? req.body.list : []).slice(0, 30).map((r, i) => ({
        id: String(r.id || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || `oda${i + 1}`,
        em: String(r.em || '💬').slice(0, 4), name: String(r.name || '').trim().slice(0, 30), desc: String(r.desc || '').trim().slice(0, 80),
        always: !!r.always, days: (Array.isArray(r.days) ? r.days : []).map(Number).filter((d) => d >= 0 && d <= 6), from: hm(r.from, '20:00'), to: hm(r.to, '23:00'),
      })).filter((r) => r.name);
      if (new Set(list.map((r) => r.id)).size !== list.length) return res.status(400).json({ error: 'Oda kimlikleri benzersiz olmalı.' });
      store.put('settings', { id: 'rooms', list });
      audit(req.admin, 'etkinlik odalarını güncelledi', null, list.map((r) => r.name).join(', '));
      res.json({ list });
    });
  }

  ctx.genelSocket = (socket) => {
    const uid = socket.data.userId;
    const joined = new Set();
    socket.on('genel:join', (d) => { const rid = d?.room || 'genel'; if (!roomOf(rid)) return; socket.join(ioRoom(rid)); joined.add(rid); broadcastCount(rid); });
    socket.on('genel:leave', (d) => { const rid = d?.room || 'genel'; socket.leave(ioRoom(rid)); joined.delete(rid); broadcastCount(rid); });
    socket.on('disconnect', () => setTimeout(() => joined.forEach((rid) => broadcastCount(rid)), 100));
    socket.on('genel:typing', (d) => {
      if (limited('gt:' + uid, 10, 10000)) return;
      const rid = d?.room || 'genel';
      socket.to(ioRoom(rid)).emit('genel:typing', { room: rid, user: brief(store.get('users', uid)) });
    });
    socket.on('genel:send', (data, ack) => {
      const u = store.get('users', uid);
      if (!u) return ack?.({ error: 'Oturum yok.' });
      const rid = data?.room || 'genel';
      const rm = roomOf(rid);
      if (!rm) return ack?.({ error: 'Oda bulunamadı.' });
      if (!roomState(rm).open) return ack?.({ error: 'Bu oda şu an kapalı.' });
      if (limited('gs:' + uid, 8, 15000)) return ack?.({ error: 'Çok hızlı yazıyorsun, biraz bekle.' });
      const raw = String(data?.text || '').trim().slice(0, 1000);
      const media = isMedia(data?.media) ? data.media : null;
      if (!raw && !media) return ack?.({ error: 'Mesaj boş.' });
      const text = moderation.mask(raw);
      const rep = data?.replyTo && store.get('pub_msgs', data.replyTo);
      const m = store.put('pub_msgs', {
        id: nanoid(12), userId: uid, room: rid === 'genel' ? undefined : rid, text, media, mediaType: media ? 'image' : null,
        reply: rep ? { id: rep.id, userId: rep.userId, name: store.get('users', rep.userId)?.name || '', text: (rep.text || (rep.media ? '📷 Fotoğraf' : '')).slice(0, 120) } : null,
        reactions: {}, at: now(),
      });
      const fl = raw && moderation.flag(raw);
      if (fl) store.put('flags', { id: nanoid(12), kind: 'genel', userId: uid, chatId: 'genel', ref: m.id, text: raw.slice(0, 500), level: fl.level, reason: fl.reason, status: 'open', at: now() });
      io.to(ioRoom(rid)).emit('genel:msg', out(m));
      // @bahsetme
      [...new Set([...raw.matchAll(/@([a-z0-9._]{3,24})/gi)].map((x) => x[1].toLowerCase()))].slice(0, 5).forEach((un) => {
        const t = store.find('users', (x) => x.username === un);
        if (t && t.id !== uid) notify(t.id, { type: 'mention', fromId: uid, text: `${u.username} ${rm.name} odasında senden bahsetti: ${text.slice(0, 80)}`, url: rid === 'genel' ? '/#/genel' : `/#/genel/${rid}` });
      });
      if (rep && rep.userId !== uid) notify(rep.userId, { type: 'mention', fromId: uid, text: `${u.username} ${rm.name} odasında sana yanıt verdi: ${text.slice(0, 80)}`, url: rid === 'genel' ? '/#/genel' : `/#/genel/${rid}` });
      // eski mesajları temizle
      const all = store.filter('pub_msgs', (x) => roomOfMsg(x) === rid);
      if (all.length > KEEP + 100) all.sort((a, b) => a.at - b.at).slice(0, all.length - KEEP).forEach((x) => store.del('pub_msgs', x.id));
      ack?.({ ok: true, msg: out(m) });
    });
    socket.on('genel:react', ({ id, emoji }) => {
      const m = store.get('pub_msgs', id);
      if (!m || m.deleted || limited('gr:' + uid, 30, 10000)) return;
      m.reactions = m.reactions || {};
      if (!emoji || m.reactions[uid] === emoji) delete m.reactions[uid]; else m.reactions[uid] = String(emoji).slice(0, 8);
      store.update('pub_msgs', m.id, {});
      io.to(ioRoom(roomOfMsg(m))).emit('genel:update', out(m));
    });
    socket.on('genel:delete', ({ id }) => {
      const m = store.get('pub_msgs', id);
      if (!m || m.userId !== uid) return;
      Object.assign(m, { deleted: true, text: '', media: null, reactions: {} });
      store.update('pub_msgs', m.id, {});
      io.to(ioRoom(roomOfMsg(m))).emit('genel:update', out(m));
    });
  };
};

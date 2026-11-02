// Genel sohbet: tüm üyelerin aynı odada konuştuğu herkese açık sohbet.
const { nanoid } = require('nanoid');

const KEEP = 1500; // en fazla tutulan mesaj

module.exports = function genel(app, ctx) {
  const { store, io, auth, brief, limited, moderation, notify, isMedia } = ctx;
  const now = () => Date.now();
  const out = (m) => ({ ...m, user: brief(store.get('users', m.userId)) });
  const onlineCount = () => io.sockets.adapter.rooms.get('genel')?.size || 0;
  const uniqueOnline = () => {
    const ids = new Set();
    (io.sockets.adapter.rooms.get('genel') || new Set()).forEach((sid) => { const s = io.sockets.sockets.get(sid); if (s) ids.add(s.data.userId); });
    return ids.size;
  };
  const broadcastCount = () => io.to('genel').emit('genel:online', { count: uniqueOnline() });

  app.get('/api/genel', auth, (req, res) => {
    const before = +req.query.before || Infinity;
    const list = store.filter('pub_msgs', (m) => m.at < before).sort((a, b) => a.at - b.at);
    const blocked = new Set(store.filter('blocks', (b) => b.from === req.user.id || b.to === req.user.id).map((b) => (b.from === req.user.id ? b.to : b.from)));
    res.json({ items: list.slice(-120).filter((m) => !blocked.has(m.userId)).map(out), online: uniqueOnline(), more: list.length > 120 });
  });

  ctx.genelSocket = (socket) => {
    const uid = socket.data.userId;
    socket.on('genel:join', () => { socket.join('genel'); broadcastCount(); });
    socket.on('genel:leave', () => { socket.leave('genel'); broadcastCount(); });
    socket.on('disconnect', () => setTimeout(broadcastCount, 100));
    socket.on('genel:typing', () => {
      if (limited('gt:' + uid, 10, 10000)) return;
      socket.to('genel').emit('genel:typing', { user: brief(store.get('users', uid)) });
    });
    socket.on('genel:send', (data, ack) => {
      const u = store.get('users', uid);
      if (!u) return ack?.({ error: 'Oturum yok.' });
      if (limited('gs:' + uid, 8, 15000)) return ack?.({ error: 'Çok hızlı yazıyorsun, biraz bekle.' });
      const raw = String(data?.text || '').trim().slice(0, 1000);
      const media = isMedia(data?.media) ? data.media : null;
      if (!raw && !media) return ack?.({ error: 'Mesaj boş.' });
      const text = moderation.mask(raw);
      const rep = data?.replyTo && store.get('pub_msgs', data.replyTo);
      const m = store.put('pub_msgs', {
        id: nanoid(12), userId: uid, text, media, mediaType: media ? 'image' : null,
        reply: rep ? { id: rep.id, userId: rep.userId, name: store.get('users', rep.userId)?.name || '', text: (rep.text || (rep.media ? '📷 Fotoğraf' : '')).slice(0, 120) } : null,
        reactions: {}, at: now(),
      });
      const fl = raw && moderation.flag(raw);
      if (fl) store.put('flags', { id: nanoid(12), kind: 'genel', userId: uid, chatId: 'genel', ref: m.id, text: raw.slice(0, 500), level: fl.level, reason: fl.reason, status: 'open', at: now() });
      io.to('genel').emit('genel:msg', out(m));
      // @bahsetme
      [...new Set([...raw.matchAll(/@([a-z0-9._]{3,24})/gi)].map((x) => x[1].toLowerCase()))].slice(0, 5).forEach((un) => {
        const t = store.find('users', (x) => x.username === un);
        if (t && t.id !== uid) notify(t.id, { type: 'mention', fromId: uid, text: `${u.username} genel sohbette senden bahsetti: ${text.slice(0, 80)}`, url: '/#/genel' });
      });
      if (rep && rep.userId !== uid) notify(rep.userId, { type: 'mention', fromId: uid, text: `${u.username} genel sohbette sana yanıt verdi: ${text.slice(0, 80)}`, url: '/#/genel' });
      // eski mesajları temizle
      const all = store.all('pub_msgs');
      if (all.length > KEEP + 100) all.sort((a, b) => a.at - b.at).slice(0, all.length - KEEP).forEach((x) => store.del('pub_msgs', x.id));
      ack?.({ ok: true, msg: out(m) });
    });
    socket.on('genel:react', ({ id, emoji }) => {
      const m = store.get('pub_msgs', id);
      if (!m || m.deleted || limited('gr:' + uid, 30, 10000)) return;
      m.reactions = m.reactions || {};
      if (!emoji || m.reactions[uid] === emoji) delete m.reactions[uid]; else m.reactions[uid] = String(emoji).slice(0, 8);
      store.update('pub_msgs', m.id, {});
      io.to('genel').emit('genel:update', out(m));
    });
    socket.on('genel:delete', ({ id }) => {
      const m = store.get('pub_msgs', id);
      if (!m || m.userId !== uid) return;
      Object.assign(m, { deleted: true, text: '', media: null, reactions: {} });
      store.update('pub_msgs', m.id, {});
      io.to('genel').emit('genel:update', out(m));
    });
  };
};

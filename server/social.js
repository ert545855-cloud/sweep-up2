// Tanışma ve profil özellikleri: sesli tanıtım, profil soruları, çerçeve ve rozetler, profil ziyaretçileri,
// süper mesaj, buz kırıcı oyunlar, tek seferlik fotoğraf, buluşma güvenliği, davet ödülü,
// Falcı Teyze aboneliği ve canlı hızlı tanışma.
const { nanoid, customAlphabet } = require('nanoid');

const DAY = 86400000;
const refCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

const PROMPTS = [
  ['pazar', 'Pazar sabahım…'], ['guldur', 'Beni güldüren şey…'], ['ilkbulusma', 'Mükemmel ilk buluşma…'], ['yemek', 'Ömür boyu tek yemek yesem…'],
  ['seyahat', 'Bir sonraki seyahatim…'], ['suphe', 'Kimsenin bilmediği yeteneğim…'], ['sarki', 'Bu aralar dilimden düşmeyen şarkı…'], ['bayrak', 'Benim için kırmızı çizgi…'],
  ['tartisma', 'Saatlerce tartışabileceğim konu…'], ['cocukluk', 'Çocukken olmak istediğim şey…'], ['hafta', 'Hafta sonu beni bulabileceğin yer…'], ['itiraf', 'Küçük bir itiraf…'],
  ['ask', 'Aşk dilim…'], ['kahve', 'Kahvem nasıl olsun…'], ['dizi', 'Tekrar tekrar izlediğim dizi…'], ['hedef', 'Bu yılki hedefim…'],
  ['eslesme', 'Eşleşirsek ilk konuşacağımız şey…'], ['iyi', 'İyi olduğum şey…'], ['kotu', 'Hiç iyi olmadığım şey…'], ['tatli', 'Gönlümü kazanmanın yolu…'],
];
const PROMPT = Object.fromEntries(PROMPTS);

const FRAMES = [
  { id: 'gokkusagi', name: 'Gökkuşağı', coins: 100 },
  { id: 'neon', name: 'Neon', coins: 120 },
  { id: 'alev', name: 'Alev', coins: 120 },
  { id: 'okyanus', name: 'Okyanus', coins: 120 },
  { id: 'altin', name: 'Altın', coins: 180 },
  { id: 'galaksi', name: 'Galaksi', coins: 200 },
  { id: 'elmas', name: 'Elmas', coins: 300 },
  { id: 'cadi', name: 'Cadılar Bayramı', coins: 90, event: 'halloween' },
  { id: 'yilbasi', name: 'Yılbaşı', coins: 90, event: 'yilbasi' },
  { id: 'sevgililer', name: 'Sevgililer', coins: 90, event: 'sevgililer' },
];
const EVENT_BADGE = { halloween: { em: '🎃', name: 'Cadılar Bayramı' }, yilbasi: { em: '🎄', name: 'Yılbaşı' }, sevgililer: { em: '💘', name: 'Sevgililer Günü' } };
const BADGE_LIMIT = 500;

const BUMU = [
  ['Kahve', 'Çay'], ['Deniz', 'Dağ'], ['Kedi', 'Köpek'], ['Sabahçı', 'Gece kuşu'], ['Film', 'Dizi'], ['Tatlı', 'Tuzlu'], ['Kitap', 'Podcast'],
  ['Ev partisi', 'Konser'], ['Kamp', 'Otel'], ['Pizza', 'Hamburger'], ['Yaz', 'Kış'], ['Mesaj', 'Arama'], ['Plan', 'Spontane'], ['Rakı', 'Şarap'],
  ['İstanbul', 'İzmir'], ['Yürüyüş', 'Bisiklet'], ['Pop', 'Rock'], ['Yemek yapmak', 'Dışarıda yemek'], ['Erken buluşma', 'Geç buluşma'], ['Sahil', 'Orman'],
];

module.exports = function social(app, ctx) {
  const { store, io, auth, eco, notify, emitTo, brief, isBlocked, limited, isMedia, moderation, chatBetween, sendMessage, online, appEvent, falci, canSee } = ctx;
  const now = () => Date.now();
  const user = (id) => store.get('users', id);

  // ================= Profil soruları ve sesli tanıtım (PATCH /me içinden çağrılır) =================
  ctx.readProfileExtras = (b, patch) => {
    if (b.prompts !== undefined) {
      patch.prompts = (Array.isArray(b.prompts) ? b.prompts : []).filter((p) => PROMPT[p?.id]).slice(0, 3)
        .map((p) => ({ id: p.id, a: moderation.mask(String(p.a || '').trim().slice(0, 150)) })).filter((p) => p.a.length >= 2);
    }
    if (b.voice !== undefined) {
      patch.voice = b.voice && isMedia(b.voice.url) ? { url: b.voice.url, dur: Math.max(1, Math.min(15, Math.round(+b.voice.dur || 0))) } : null;
    }
  };
  app.get('/api/prompts', auth, (req, res) => res.json(PROMPTS.map(([id, q]) => ({ id, q }))));

  // Profil sorusuna yanıt → sohbet mesajı (alıntıyla)
  app.post('/api/users/:id/prompt-reply', auth, (req, res) => {
    const t = user(req.params.id);
    const text = moderation.mask(String(req.body?.text || '').trim().slice(0, 500));
    const p = t?.prompts?.find((x) => x.id === req.body?.promptId);
    if (!t || !p || t.id === req.user.id) return res.status(404).json({ error: 'Soru bulunamadı.' });
    if (t.role === 'official') return res.status(403).json({ error: 'Yönetim hesabına mesaj gönderilemez.' });
    if (t.role === 'falci' || req.user.role === 'falci') return res.status(403).json({ error: 'Falcı Teyze’ye sadece fal isteğiyle yazabilirsin.' });
    if (!text) return res.status(400).json({ error: 'Bir şey yaz.' });
    if (isBlocked(req.user.id, t.id)) return res.status(403).json({ error: 'Bu kişiye yazamazsın.' });
    if (limited('pr:' + req.user.id, 30, DAY)) return res.status(429).json({ error: 'Bugün çok fazla yanıt gönderdin.' });
    const chat = chatBetween(req.user.id, t.id);
    const msg = sendMessage(chat, req.user.id, { text, quote: { kind: 'prompt', q: PROMPT[p.id], a: p.a } });
    if (!msg) return res.status(400).json({ error: 'Gönderilemedi.' });
    res.json({ ok: true, chatId: chat.id });
  });

  // ================= Profil ziyaretçileri (SwipeUp+) =================
  app.post('/api/users/:id/view', auth, (req, res) => {
    const t = user(req.params.id);
    if (!t || t.id === req.user.id || req.user.role === 'falci' || req.user.privacy?.hideVisits) return res.json({ ok: true });
    const day = new Date().toISOString().slice(0, 10);
    const id = `${req.user.id}_${t.id}_${day}`;
    if (!store.get('pviews', id)) {
      store.put('pviews', { id, from: req.user.id, to: t.id, at: now() });
      if (eco.isPlus(t)) emitTo(t.id, 'viewers', {});
    } else store.update('pviews', id, { at: now() });
    res.json({ ok: true });
  });
  app.get('/api/me/viewers', auth, (req, res) => {
    const since = now() - 7 * DAY;
    const seen = new Map();
    store.filter('pviews', (v) => v.to === req.user.id && v.at >= since).sort((a, b) => b.at - a.at).forEach((v) => { if (!seen.has(v.from)) seen.set(v.from, v.at); });
    const list = [...seen.entries()].map(([id, at]) => ({ u: user(id), at })).filter((x) => x.u && !isBlocked(req.user.id, x.u.id));
    const seenAt = req.user.viewersSeenAt || 0;
    const fresh = list.filter((x) => x.at > seenAt).length;
    // Sayfa açılınca "yeni ziyaretçi" sayısı sıfırlanır
    if (req.query.seen) store.update('users', req.user.id, { viewersSeenAt: now() });
    if (eco.isPlus(req.user)) return res.json({ plus: true, count: list.length, fresh, items: list.map(({ u, at }) => ({ ...brief(u), age: ctx.shownAge(u), city: u.city, at, photo: (u.photos || [])[0] || u.avatar })) });
    res.json({ plus: false, count: list.length, fresh, items: list.slice(0, 12).map(({ u, at }) => ({ photo: (u.photos || [])[0] || u.avatar, at })) });
  });
  // eski ziyaret kayıtlarını temizle
  setInterval(() => store.filter('pviews', (v) => v.at < now() - 30 * DAY).forEach((v) => store.del('pviews', v.id)), 6 * 3600000).unref();

  // ================= Çerçeveler ve rozetler =================
  const liveEvent = () => { const e = appEvent.current(store); return e && e.start <= now() && now() < e.end ? e : null; };
  const eventBadge = () => {
    const e = liveEvent(); if (!e || !EVENT_BADGE[e.id]) return null;
    const year = new Date(e.end - 1).getUTCFullYear();
    const id = `${e.id}-${year}`;
    const sold = store.filter('users', (u) => (u.badges || []).some((b) => b.id === id)).length;
    return { id, em: EVENT_BADGE[e.id].em, name: `${EVENT_BADGE[e.id].name} ${year}`, coins: 50, limit: BADGE_LIMIT, left: Math.max(0, BADGE_LIMIT - sold), until: e.end };
  };
  app.get('/api/cosmetics', auth, (req, res) => {
    const e = liveEvent();
    const owned = new Set(req.user.frames || []);
    res.json({
      coins: req.user.coins || 0, frame: req.user.frame || null, badges: req.user.badges || [],
      frames: FRAMES.filter((f) => !f.event || owned.has(f.id) || (e && e.id === f.event)).map((f) => ({ ...f, owned: owned.has(f.id), limited: !!f.event })),
      eventBadge: eventBadge(),
    });
  });
  app.post('/api/cosmetics/frame', auth, (req, res) => {
    const id = req.body?.id || null;
    if (!id) { store.update('users', req.user.id, { frame: null }); return res.json({ frame: null }); }
    const f = FRAMES.find((x) => x.id === id);
    if (!f) return res.status(404).json({ error: 'Çerçeve bulunamadı.' });
    const owned = new Set(req.user.frames || []);
    if (!owned.has(f.id)) {
      const e = liveEvent();
      if (f.event && (!e || e.id !== f.event)) return res.status(410).json({ error: 'Bu çerçeve sadece etkinlik döneminde alınabiliyor.' });
      if (!eco.spend(req.user.id, f.coins, 'frame', { ref: f.id })) return res.status(402).json({ error: `Bu çerçeve ${f.coins} jeton.`, need: f.coins });
      owned.add(f.id);
    }
    store.update('users', req.user.id, { frames: [...owned], frame: f.id });
    emitTo(req.user.id, 'wallet', {});
    res.json({ frame: f.id, coins: user(req.user.id).coins || 0 });
  });
  app.post('/api/cosmetics/badge', auth, (req, res) => {
    const b = eventBadge();
    if (!b || b.id !== req.body?.id) return res.status(410).json({ error: 'Bu rozet artık alınamıyor.' });
    if ((req.user.badges || []).some((x) => x.id === b.id)) return res.status(409).json({ error: 'Bu rozet zaten sende.' });
    if (b.left <= 0) return res.status(410).json({ error: 'Rozetler tükendi.' });
    if (!eco.spend(req.user.id, b.coins, 'badge', { ref: b.id })) return res.status(402).json({ error: `Bu rozet ${b.coins} jeton.`, need: b.coins });
    const badges = [...(req.user.badges || []), { id: b.id, em: b.em, name: b.name, no: BADGE_LIMIT - b.left + 1, at: now() }];
    store.update('users', req.user.id, { badges });
    emitTo(req.user.id, 'wallet', {});
    res.json({ badges, coins: user(req.user.id).coins || 0 });
  });

  // Rozeti profilde göster / gizle (etkinlik bitse de istediği zaman)
  app.post('/api/cosmetics/badge/:id/toggle', auth, (req, res) => {
    const badges = (req.user.badges || []).map((b) => (b.id === req.params.id ? { ...b, hidden: req.body?.show === undefined ? !b.hidden : !req.body.show } : b));
    if (!badges.some((b) => b.id === req.params.id)) return res.status(404).json({ error: 'Rozet bulunamadı.' });
    store.update('users', req.user.id, { badges });
    res.json({ badges });
  });

  // ================= Süper mesaj =================
  app.post('/api/users/:id/super-message', auth, (req, res) => {
    const t = user(req.params.id);
    const text = moderation.mask(String(req.body?.text || '').trim().slice(0, 500));
    const cost = eco.get().superMsgCoins;
    if (!t || t.id === req.user.id || ['falci', 'official'].includes(t.role) || ['falci', 'official'].includes(req.user.role)) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    if (isBlocked(req.user.id, t.id)) return res.status(403).json({ error: 'Bu kişiye yazamazsın.' });
    if (text.length < 2) return res.status(400).json({ error: 'Mesajını yaz.' });
    if (limited('sm:' + req.user.id, 10, DAY)) return res.status(429).json({ error: 'Bugün çok fazla süper mesaj gönderdin.' });
    if (!eco.spend(req.user.id, cost, 'super_msg', { ref: t.id })) return res.status(402).json({ error: `Süper mesaj ${cost} jeton.`, need: cost });
    // süper beğeni olarak da sayılır
    const sid = `${req.user.id}_${t.id}`;
    if (!store.get('swipes', sid)) store.put('swipes', { id: sid, from: req.user.id, to: t.id, dir: 'super', at: now() });
    emitTo(t.id, 'likes:new', {});
    const chat = chatBetween(req.user.id, t.id);
    const msg = sendMessage(chat, req.user.id, { text, superMsg: true });
    notify(t.id, { type: 'super_msg', fromId: req.user.id, text: `💌 ${req.user.name} sana süper mesaj gönderdi: ${text.slice(0, 80)}`, url: `/#/chat/${chat.id}` });
    emitTo(req.user.id, 'wallet', {});
    res.json({ ok: true, chatId: chat.id, messageId: msg?.id, coins: user(req.user.id).coins || 0 });
  });

  // ================= Buz kırıcı oyunlar =================
  const chatOf = (req, res) => {
    const c = store.get('chats', req.params.id);
    if (!c || !c.members.includes(req.user.id)) { res.status(404).json({ error: 'Sohbet bulunamadı.' }); return null; }
    if (c.isGroup) { res.status(400).json({ error: 'Oyunlar birebir sohbetlerde oynanır.' }); return null; }
    if (c.members.some((m) => ['falci', 'official'].includes(user(m)?.role))) { res.status(403).json({ error: 'Falcı Teyze ile sadece fal üzerinden yazışılır.' }); return null; }
    return c;
  };
  app.post('/api/chats/:id/game', auth, (req, res) => {
    const c = chatOf(req, res); if (!c) return;
    const kind = req.body?.kind;
    let game;
    if (kind === 'ikidogru') {
      const items = (Array.isArray(req.body.items) ? req.body.items : []).map((s) => moderation.mask(String(s || '').trim().slice(0, 120)));
      const lie = parseInt(req.body.lie, 10);
      if (items.length !== 3 || items.some((s) => s.length < 2)) return res.status(400).json({ error: 'Üç cümle yaz.' });
      if (![0, 1, 2].includes(lie)) return res.status(400).json({ error: 'Hangisinin yalan olduğunu seç.' });
      game = { kind, items, lie, guesses: {} };
    } else if (kind === 'bumu') {
      const pool = BUMU.slice().sort(() => Math.random() - 0.5).slice(0, 5);
      game = { kind, qs: pool, answers: {} };
    } else return res.status(400).json({ error: 'Oyun bulunamadı.' });
    if (limited('game:' + req.user.id, 20, DAY)) return res.status(429).json({ error: 'Bugün yeterince oynadın 🙂' });
    const msg = sendMessage(c, req.user.id, { text: kind === 'ikidogru' ? '🎲 İki doğru bir yalan' : '🤔 Bu mu şu mu?', game });
    res.json(msg ? ctx.msgOut(msg) : { error: 'Gönderilemedi.' });
  });
  app.post('/api/messages/:id/game', auth, (req, res) => {
    const m = store.get('messages', req.params.id);
    const c = m && store.get('chats', m.chatId);
    if (!m?.game || !c?.members.includes(req.user.id)) return res.status(404).json({ error: 'Oyun bulunamadı.' });
    const g = m.game;
    if (g.kind === 'ikidogru') {
      if (m.from === req.user.id) return res.status(400).json({ error: 'Kendi oyununu tahmin edemezsin.' });
      if (g.guesses[req.user.id] != null) return res.status(409).json({ error: 'Zaten tahmin ettin.' });
      const guess = parseInt(req.body?.guess, 10);
      if (![0, 1, 2].includes(guess)) return res.status(400).json({ error: 'Bir cümle seç.' });
      g.guesses[req.user.id] = guess;
    } else if (g.kind === 'bumu') {
      const ans = (Array.isArray(req.body?.answers) ? req.body.answers : []).map((x) => (x === 1 ? 1 : 0));
      if (ans.length !== g.qs.length) return res.status(400).json({ error: 'Tüm soruları cevapla.' });
      if (g.answers[req.user.id]) return res.status(409).json({ error: 'Zaten cevapladın.' });
      g.answers[req.user.id] = ans;
    }
    store.update('messages', m.id, { game: g });
    c.members.forEach((u) => emitTo(u, 'message:update', ctx.msgOut(m)));
    const other = c.members.find((u) => u !== req.user.id);
    notify(other, { type: 'message', fromId: req.user.id, text: g.kind === 'ikidogru' ? '🎲 Tahminini yaptı! Sonuca bak.' : '🤔 Bu mu şu mu cevaplarını verdi.', url: `/#/chat/${c.id}`, tag: 'chat-' + c.id });
    res.json(ctx.msgOut(m));
  });
  // Oyunun gizli kısımlarını sakla (iki doğru bir yalan: tahmin edilene kadar yalan gizli; bu mu şu mu: ikisi de cevaplayana kadar cevaplar gizli)
  ctx.gameOut = (g) => {
    if (!g) return g;
    if (g.kind === 'ikidogru') return Object.keys(g.guesses || {}).length ? g : { ...g, lie: null };
    if (g.kind === 'bumu') {
      const n = Object.keys(g.answers || {}).length;
      if (n >= 2) return g;
      return { ...g, answers: Object.fromEntries(Object.keys(g.answers || {}).map((k) => [k, 'done'])) };
    }
    return g;
  };

  // ================= Tek seferlik fotoğraf =================
  app.post('/api/messages/:id/open', auth, async (req, res) => {
    const m = store.get('messages', req.params.id);
    const c = m && store.get('chats', m.chatId);
    if (!m?.viewOnce || !c?.members.includes(req.user.id)) return res.status(404).json({ error: 'Fotoğraf bulunamadı.' });
    if (m.from === req.user.id) return res.status(400).json({ error: 'Tek seferlik fotoğrafını tekrar açamazsın.' });
    if ((m.openedBy || []).includes(req.user.id) || !m.media) return res.status(410).json({ error: 'Bu fotoğraf zaten açıldı.' });
    m.openedBy = [...(m.openedBy || []), req.user.id];
    const media = m.media;
    // Birebir sohbette açılınca dosyayı sunucudan sil
    const everyone = c.members.filter((u) => u !== m.from).every((u) => m.openedBy.includes(u));
    if (everyone) { m.media = null; m.mediaGone = true; }
    store.update('messages', m.id, { openedBy: m.openedBy, media: m.media, mediaGone: !!m.mediaGone });
    c.members.forEach((u) => emitTo(u, 'message:update', ctx.msgOut(m)));
    if (everyone) setTimeout(() => { const id = media.split('/').pop(); Promise.resolve().then(() => store.deleteMedia(id)).then(() => store.del('media_meta', id)).catch(() => {}); ctx.dropMediaCache?.(id); }, 30000);
    // dosya 30 sn daha erişilebilir: alıcı bir kez yükleyebilsin
    res.json({ media });
  });

  // ================= Buluşma planı ve güvenlik =================
  app.post('/api/chats/:id/plan', auth, (req, res) => {
    const c = chatOf(req, res); if (!c) return;
    const when = +req.body?.when;
    const place = moderation.mask(String(req.body?.place || '').trim().slice(0, 120));
    if (!(when > now() - 3600000 && when < now() + 60 * DAY)) return res.status(400).json({ error: 'Buluşma tarihini ve saatini seç.' });
    if (place.length < 2) return res.status(400).json({ error: 'Buluşma yerini yaz.' });
    const plan = { when, place, note: String(req.body?.note || '').trim().slice(0, 200), by: req.user.id, ok: {} };
    const msg = sendMessage(c, req.user.id, { text: `📅 Buluşma: ${place}`, plan });
    res.json(msg ? ctx.msgOut(msg) : { error: 'Gönderilemedi.' });
  });
  // Arkadaşa paylaşılacak güvenlik bağlantısı
  app.post('/api/messages/:id/safety', auth, (req, res) => {
    const m = store.get('messages', req.params.id);
    const c = m && store.get('chats', m.chatId);
    if (!m?.plan || !c?.members.includes(req.user.id)) return res.status(404).json({ error: 'Plan bulunamadı.' });
    let s = store.find('safety', (x) => x.msgId === m.id && x.userId === req.user.id);
    if (!s) {
      const otherId = c.members.find((u) => u !== req.user.id);
      const o = user(otherId);
      s = store.put('safety', {
        id: nanoid(16), msgId: m.id, chatId: c.id, userId: req.user.id, when: m.plan.when, place: m.plan.place,
        me: { name: req.user.name.split(' ')[0] }, with: o ? { name: o.name, username: o.username, avatar: o.avatar, verified: !!o.verified } : null,
        status: 'planned', at: now(),
      });
    }
    res.json({ token: s.id, url: `/guvende/${s.id}` });
  });
  app.post('/api/safety/:token/ok', auth, (req, res) => {
    const s = store.get('safety', req.params.token);
    if (!s || s.userId !== req.user.id) return res.status(404).json({ error: 'Bulunamadı.' });
    store.update('safety', s.id, { status: 'ok', okAt: now() });
    const m = store.get('messages', s.msgId);
    if (m?.plan) { m.plan.ok = { ...(m.plan.ok || {}), [req.user.id]: now() }; store.update('messages', m.id, { plan: m.plan }); const c = store.get('chats', m.chatId); c?.members.forEach((u) => emitTo(u, 'message:update', ctx.msgOut(m))); }
    res.json({ ok: true });
  });
  app.get('/api/safety/pending', auth, (req, res) => {
    res.json(store.filter('safety', (s) => s.userId === req.user.id && s.status === 'planned' && s.when < now() + 30 * 60000 && s.when > now() - 2 * DAY));
  });
  // Herkese açık durum sayfası (arkadaşın görür; giriş gerekmez)
  app.get('/guvende/:token', (req, res) => {
    const s = store.get('safety', req.params.token);
    const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const fmt = (t) => new Date(t).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    let body;
    if (!s) body = '<h1>Bağlantı geçersiz</h1><p>Bu güvenlik bağlantısı bulunamadı ya da süresi doldu.</p>';
    else {
      const late = s.status === 'planned' && now() > s.when + 3 * 3600000;
      const st = s.status === 'ok' ? `<div class="st ok">✓ ${esc(s.me.name)} iyi olduğunu bildirdi<small>${fmt(s.okAt)}</small></div>`
        : late ? `<div class="st bad">⚠️ ${esc(s.me.name)} buluşmadan sonra henüz haber vermedi<small>Ona ulaşmayı dene.</small></div>`
          : now() > s.when ? `<div class="st wait">⏳ Buluşma devam ediyor olabilir<small>${esc(s.me.name)} işi bitince “İyiyim” diyecek.</small></div>`
            : '<div class="st wait">📅 Buluşma planlandı</div>';
      body = `<p class="k">${esc(s.me.name)} seninle buluşma bilgilerini paylaştı</p>
        ${s.with ? `<div class="who"><img src="${esc(s.with.avatar)}" alt=""><div><b>${esc(s.with.name)}${s.with.verified ? ' ☑︎' : ''}</b><span>@${esc(s.with.username)} · SwipeUp</span></div></div>` : ''}
        <div class="row"><span>Ne zaman</span><b>${fmt(s.when)}</b></div><div class="row"><span>Nerede</span><b>${esc(s.place)}</b></div>${st}
        <p class="f">Bu sayfa durum değişince kendiliğinden yenilenir. Acil bir durumda 112’yi ara.</p>`;
    }
    res.type('html').send(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="60">
      <meta name="robots" content="noindex"><title>SwipeUp · Buluşma güvenliği</title><style>
      body{margin:0;font:16px/1.45 -apple-system,Segoe UI,Roboto,sans-serif;background:#f6f3f8;color:#1f1726;display:grid;place-items:center;min-height:100vh;padding:20px;box-sizing:border-box}
      main{background:#fff;max-width:420px;width:100%;border-radius:24px;padding:24px;box-shadow:0 20px 50px -30px rgba(80,20,90,.45)}
      .lg{display:flex;align-items:center;gap:8px;font-weight:800;font-size:20px;margin-bottom:14px}.lg img{width:32px;height:32px;border-radius:9px}
      .k{color:#7a6c85;margin:0 0 14px}.who{display:flex;gap:12px;align-items:center;padding:12px;border-radius:16px;background:#f6f3f8;margin-bottom:12px}
      .who img{width:52px;height:52px;border-radius:16px;object-fit:cover}.who b{display:block}.who span{color:#7a6c85;font-size:14px}
      .row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #eee}.row span{color:#7a6c85}.row b{text-align:right}
      .st{margin-top:16px;padding:14px;border-radius:16px;font-weight:700}.st small{display:block;font-weight:500;color:inherit;opacity:.8;margin-top:2px}
      .ok{background:#e3f7ec;color:#0c7a43}.bad{background:#fde8ea;color:#b4232f}.wait{background:#fff4dc;color:#8a5a00}.f{color:#7a6c85;font-size:13px;margin:16px 0 0}
      </style></head><body><main><div class="lg"><img src="/icons/icon-192.png" alt="">SwipeUp</div>${body}</main></body></html>`);
  });
  // Buluşmadan 2 saat sonra "iyi misin?" hatırlatması
  setInterval(() => {
    const t = now();
    store.filter('safety', (s) => s.status === 'planned' && !s.reminded && t > s.when + 2 * 3600000 && t < s.when + DAY).forEach((s) => {
      store.update('safety', s.id, { reminded: true });
      notify(s.userId, { type: 'safety', text: '💛 Buluşman nasıl geçti? Arkadaşına iyi olduğunu bildirmek için dokun.', url: '/#/chats', tag: 'safety-' + s.id });
    });
  }, 5 * 60000).unref();

  // ================= Davet et, kazan =================
  const ensureRef = (u) => {
    if (u.refCode) return u.refCode;
    let c; do { c = refCode(); } while (store.find('users', (x) => x.refCode === c));
    store.update('users', u.id, { refCode: c });
    return c;
  };
  app.get('/api/invite', auth, (req, res) => {
    const code = ensureRef(req.user);
    const invited = store.filter('users', (u) => u.invitedBy === req.user.id).sort((a, b) => b.createdAt - a.createdAt);
    res.json({
      code, coins: eco.get().inviteCoins, rewarded: invited.filter((u) => u.inviteRewarded).length,
      items: invited.slice(0, 50).map((u) => ({ ...brief(u), rewarded: !!u.inviteRewarded })),
    });
  });
  // Kayıtta davet kodunu bağla
  ctx.attachInvite = (u, code, ip) => {
    const c = String(code || '').toUpperCase().trim();
    if (!/^[A-Z0-9]{6}$/.test(c)) return;
    const inviter = store.find('users', (x) => x.refCode === c);
    if (!inviter || inviter.id === u.id) return;
    const month = store.filter('users', (x) => x.invitedBy === inviter.id && x.createdAt > now() - 30 * DAY).length;
    if (month >= 30) return;
    store.update('users', u.id, { invitedBy: inviter.id, inviteIp: ip || null });
  };
  // Davet edilen ilk fotoğrafını ekleyince iki tarafa ödül
  ctx.checkInviteReward = (u) => {
    if (!u?.invitedBy || u.inviteRewarded || !(u.photos || []).length) return;
    const inviter = user(u.invitedBy);
    if (!inviter) return;
    // aynı ağdan açılan ikinci hesap ödül kazandırmaz
    if (u.inviteIp && store.find('users', (x) => x.id !== u.id && x.invitedBy === inviter.id && x.inviteRewarded && x.inviteIp === u.inviteIp)) return;
    const coins = eco.get().inviteCoins;
    store.update('users', u.id, { inviteRewarded: now() });
    eco.addCoins(u.id, coins, 'invite', { ref: inviter.id });
    eco.addCoins(inviter.id, coins, 'invite', { ref: u.id });
    notify(inviter.id, { type: 'order', fromId: u.id, text: `🎁 ${u.name} davetinle katıldı! İkinize de ${coins} jeton.`, url: '/#/davet' });
    notify(u.id, { type: 'order', text: `🎁 Davetle katıldığın için ${coins} jeton hediye!`, url: '/#/store' });
    emitTo(inviter.id, 'wallet', {}); emitTo(u.id, 'wallet', {});
  };

  // ================= Falcı Teyze aboneliği =================
  const week = (t = now()) => { const d = new Date(t + 3 * 3600000); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
  ctx.falSubActive = (u) => !!u?.falSub && u.falSub.until > now();
  app.get('/api/fal/sub', auth, (req, res) => {
    const s = eco.get();
    res.json({ coins: s.falSubCoins, days: 30, sub: req.user.falSub || null, active: ctx.falSubActive(req.user), burcUsed: req.user.falSub?.burcWeek === week(), zodiac: req.user.zodiac || null });
  });
  app.post('/api/fal/sub', auth, (req, res) => {
    const s = eco.get();
    const f = falci();
    if (!f) return res.status(503).json({ error: 'Falcı Teyze şu an hizmet vermiyor.' });
    if (!eco.spend(req.user.id, s.falSubCoins, 'fal_sub')) return res.status(402).json({ error: `Abonelik ${s.falSubCoins} jeton.`, need: s.falSubCoins });
    eco.earn(f.id, Math.round(s.falSubCoins * s.falciShare), 'fal_sub', { fromId: req.user.id });
    const cur = req.user.falSub || {};
    const base = Math.max(now(), cur.until || 0);
    const sub = { until: base + 30 * DAY, kahveLeft: (ctx.falSubActive(req.user) ? cur.kahveLeft || 0 : 0) + 1, since: cur.since && cur.until > now() ? cur.since : now(), burcWeek: cur.burcWeek || null };
    store.update('users', req.user.id, { falSub: sub });
    emitTo(req.user.id, 'wallet', {});
    res.json({ sub, coins: user(req.user.id).coins || 0 });
  });
  // Fal isteği fiyatı: abonelikte haftalık burç ve aylık kahve falı ücretsiz
  ctx.falPriceFor = (u, type, price) => {
    if (!ctx.falSubActive(u)) return { price };
    if (type === 'burc' && u.falSub.burcWeek !== week()) return { price: 0, use: { burcWeek: week() } };
    if (type === 'kahve' && (u.falSub.kahveLeft || 0) > 0) return { price: 0, use: { kahveLeft: u.falSub.kahveLeft - 1 } };
    return { price };
  };
  ctx.useFalSub = (u, use) => { if (use) store.update('users', u.id, { falSub: { ...u.falSub, ...use } }); };
  // Pazartesi sabahı haftalık burç yorumu isteği otomatik oluşur
  setInterval(() => {
    const d = new Date(now() + 3 * 3600000);
    if (d.getUTCDay() !== 1 || d.getUTCHours() < 9) return;
    const f = falci(); if (!f) return;
    store.filter('users', (u) => ctx.falSubActive(u) && u.falSub.burcWeek !== week() && u.falSub.autoWeek !== week()).forEach((u) => {
      store.update('users', u.id, { falSub: { ...u.falSub, autoWeek: week() } });
      if (!u.zodiac) { notify(u.id, { type: 'order', text: '🔮 Haftalık burç yorumun için profiline burcunu ekle, sonra Fal’dan iste.', url: '/#/fal' }); return; }
      const chat = chatBetween(u.id, f.id);
      const msg = sendMessage(chat, u.id, { text: 'Haftalık abonelik burç yorumu', fal: { id: nanoid(8), type: 'burc', note: 'Haftalık abonelik burç yorumu', images: [], cards: [], partner: null, zodiac: u.zodiac, name: u.name, status: 'pending', at: now(), price: 0, sub: true } });
      if (msg) { store.update('users', u.id, { falSub: { ...user(u.id).falSub, burcWeek: week() } }); ctx.onFalRequest?.(msg); }
    });
  }, 15 * 60000).unref();

  // ================= Canlı hızlı tanışma =================
  const ROUND = 180000; const VOTE = 25000;
  const queue = new Map(); // uid -> { uid, socketId, at }
  const rounds = new Map(); // id -> { id, a, b, sa, sb, end, votes }
  const inRound = new Map(); // uid -> roundId
  const met = new Map(); // `${a}_${b}` -> at
  const want = (u, t) => !u.lookingFor || u.lookingFor === 'all' || !t.gender || t.gender === u.lookingFor;
  const compatible = (a, b) => {
    if (a.id === b.id || isBlocked(a.id, b.id)) return false;
    if (!want(a, b) || !want(b, a)) return false;
    const key = [a.id, b.id].sort().join('_');
    if (met.has(key) && now() - met.get(key) < DAY) return false;
    if (store.get('matches', key)) return false;
    return true;
  };
  const speedCount = () => queue.size + inRound.size;
  const broadcastSpeed = () => io.to('speed').emit('speed:count', { waiting: queue.size, live: inRound.size });
  const peerCard = (u) => ({ ...brief(u), age: ctx.shownAge(u), city: u.city, bio: u.bio, interests: u.interests || [], prompt: u.prompts?.[0] ? { q: PROMPT[u.prompts[0].id], a: u.prompts[0].a } : null });
  function tryPair() {
    const list = [...queue.values()].sort((x, y) => x.at - y.at);
    for (let i = 0; i < list.length; i++) {
      const A = user(list[i].uid); if (!A) { queue.delete(list[i].uid); continue; }
      for (let j = i + 1; j < list.length; j++) {
        const B = user(list[j].uid); if (!B || !compatible(A, B)) continue;
        const qa = list[i]; const qb = list[j];
        queue.delete(qa.uid); queue.delete(qb.uid);
        const r = { id: nanoid(10), a: qa.uid, b: qb.uid, sa: qa.socketId, sb: qb.socketId, start: now(), end: now() + ROUND, votes: {} };
        rounds.set(r.id, r); inRound.set(r.a, r.id); inRound.set(r.b, r.id); ctx.track?.('speed');
        met.set([r.a, r.b].sort().join('_'), now());
        io.to(r.sa).emit('speed:paired', { roundId: r.id, peer: peerCard(B), peerSocket: r.sb, offerer: true, end: r.end, now: now() });
        io.to(r.sb).emit('speed:paired', { roundId: r.id, peer: peerCard(A), peerSocket: r.sa, offerer: false, end: r.end, now: now() });
        r.timer = setTimeout(() => startVote(r), ROUND);
        broadcastSpeed();
        return tryPair();
      }
    }
  }
  function startVote(r) {
    if (!rounds.has(r.id)) return;
    r.voting = true;
    [r.sa, r.sb].forEach((s) => io.to(s).emit('speed:vote', { roundId: r.id, until: now() + VOTE }));
    r.timer = setTimeout(() => finish(r), VOTE);
  }
  function finish(r, reason) {
    if (!rounds.has(r.id)) return;
    clearTimeout(r.timer);
    rounds.delete(r.id); inRound.delete(r.a); inRound.delete(r.b);
    const both = r.votes[r.a] === 'devam' && r.votes[r.b] === 'devam';
    let chatId = null;
    if (both) {
      const mid = [r.a, r.b].sort().join('_');
      [[r.a, r.b], [r.b, r.a]].forEach(([x, y]) => { const sid = `${x}_${y}`; if (!store.get('swipes', sid)) store.put('swipes', { id: sid, from: x, to: y, dir: 'right', at: now(), via: 'speed' }); });
      if (!store.get('matches', mid)) store.put('matches', { id: mid, users: [r.a, r.b], at: now(), via: 'speed' });
      chatId = chatBetween(r.a, r.b).id;
      sendMessage(store.get('chats', chatId), r.a, { text: '⚡ Hızlı tanışmada eşleştiniz! Sohbete buradan devam edin.', system: true });
    }
    [[r.sa, r.b], [r.sb, r.a]].forEach(([s, other]) => io.to(s).emit('speed:result', { roundId: r.id, match: both, chatId, reason: reason || null, peer: both ? brief(user(other)) : null }));
    broadcastSpeed();
  }
  ctx.speedSocket = (socket) => {
    const uid = socket.data.userId;
    socket.on('speed:watch', () => { socket.join('speed'); socket.emit('speed:count', { waiting: queue.size, live: inRound.size }); });
    socket.on('speed:join', (_, ack) => {
      const u = user(uid);
      if (!u || ['falci', 'official'].includes(u.role)) return ack?.({ error: 'Katılamazsın.' });
      if (inRound.has(uid)) return ack?.({ error: 'Zaten bir turdasın.' });
      queue.set(uid, { uid, socketId: socket.id, at: now() });
      ack?.({ ok: true, waiting: queue.size });
      broadcastSpeed(); tryPair();
    });
    socket.on('speed:cancel', () => { queue.delete(uid); broadcastSpeed(); });
    socket.on('speed:signal', ({ to, data }) => {
      const rid = inRound.get(uid); const r = rid && rounds.get(rid);
      if (r && (to === r.sa || to === r.sb)) io.to(to).emit('speed:signal', { from: socket.id, data });
    });
    socket.on('speed:vote', ({ roundId, vote }) => {
      const r = rounds.get(roundId);
      if (!r || ![r.a, r.b].includes(uid)) return;
      r.votes[uid] = vote === 'devam' ? 'devam' : 'gec';
      if (r.votes[r.a] && r.votes[r.b]) finish(r);
      else if (r.voting === undefined && r.votes[uid] === 'gec') finish(r, 'skipped'); // tur içinde geçti
    });
    socket.on('speed:leave', () => {
      queue.delete(uid);
      const r = rounds.get(inRound.get(uid));
      if (r) { r.votes[uid] = 'gec'; finish(r, 'left'); }
      socket.leave('speed'); broadcastSpeed();
    });
    socket.on('disconnect', () => {
      if (queue.get(uid)?.socketId === socket.id) queue.delete(uid);
      const r = rounds.get(inRound.get(uid));
      if (r && (r.sa === socket.id || r.sb === socket.id)) { r.votes[uid] = 'gec'; finish(r, 'left'); }
      broadcastSpeed();
    });
  };
  app.get('/api/speed', auth, (req, res) => res.json({ waiting: queue.size, live: inRound.size, roundSec: ROUND / 1000 }));
  setInterval(() => { const t = now(); for (const [k, v] of met) if (t - v > DAY) met.delete(k); }, 3600000).unref();

  return { PROMPTS, FRAMES };
};
module.exports.PROMPTS = PROMPTS;
module.exports.FRAMES = FRAMES;

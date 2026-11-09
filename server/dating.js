// Tanışma araçları: sohbet başlatıcılar, buluşma fikirleri, ikinci şans
const DAY = 86400000;
const now = () => Date.now();
const trNow = (t = now()) => new Date(t + 3 * 3600000);
const weekOf = (t = now()) => { const d = trNow(t); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day); return d.toISOString().slice(0, 10); };
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const seeded = (arr, seed) => arr.map((x, i) => [hash(`${seed}:${i}`), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
const norm = (s) => String(s || '').toLocaleLowerCase('tr-TR').trim();

// İlgi alanına göre buluşma fikirleri
const IDEAS = [
  { re: /kahve|cafe|kafe|espresso/, em: '☕', t: 'Kahve turu', d: 'İki farklı kahveciye uğrayın, en iyisini birlikte oylayın.', k: 'cafe' },
  { re: /müzik|konser|şarkı|gitar|piyano|caz|rock/, em: '🎶', t: 'Canlı müzik gecesi', d: 'Küçük bir mekanda akustik bir performans dinleyin.', k: 'fun' },
  { re: /film|sinema|dizi/, em: '🎬', t: 'Sinema ve tatlı', d: 'Film çıkışı bir tatlıcıda filme puan verin.', k: 'fun' },
  { re: /kitap|okuma|edebiyat|şiir/, em: '📚', t: 'Sahaf ve kitap kafe', d: 'Birbirinize sürpriz bir kitap seçin, kahve eşliğinde anlatın.', k: 'cafe' },
  { re: /doğa|kamp|yürüyüş|trekking|hiking|dağ/, em: '🌲', t: 'Gün batımı yürüyüşü', d: 'Yakındaki bir parkta ya da sahilde gün batımını izleyin.', k: 'park' },
  { re: /spor|koşu|fitness|yoga|bisiklet|pilates|tenis|basketbol|futbol/, em: '🚴', t: 'Sabah aktivitesi', d: 'Birlikte koşu, bisiklet ya da yoga; ardından kahvaltı.', k: 'park' },
  { re: /yemek|gurme|mutfak|pizza|burger|tatlı|sushi|kahvaltı/, em: '🍜', t: 'Lezzet turu', d: 'Üç farklı yerden birer şey tadın, favorinizi seçin.', k: 'restaurant' },
  { re: /sanat|müze|resim|tasarım|sergi|tiyatro/, em: '🖼️', t: 'Sergi ya da tiyatro', d: 'Bir sergide birbirinize en sevdiğiniz eseri anlatın.', k: 'fun' },
  { re: /fotoğraf|kamera/, em: '📷', t: 'Fotoğraf yürüyüşü', d: 'Şehirde yürüyüp birbirinizin fotoğrafını çekin.', k: 'park' },
  { re: /oyun|game|kutu|playstation|satranç/, em: '🎲', t: 'Kutu oyunu kafe', d: 'Rekabetçi bir oyunla buzları kırın.', k: 'cafe' },
  { re: /dans|salsa|tango|bachata/, em: '💃', t: 'Deneme dans dersi', d: 'Bir başlangıç dersine birlikte katılın.', k: 'fun' },
  { re: /deniz|plaj|yüzme|tekne|sahil/, em: '🌊', t: 'Sahilde piknik', d: 'Hafif atıştırmalıklar, güzel bir manzara ve uzun sohbet.', k: 'park' },
  { re: /hayvan|kedi|köpek/, em: '🐾', t: 'Kedi kafe ya da barınak', d: 'Patili dostlarla vakit geçirmek buzları hemen eritir.', k: 'cafe' },
  { re: /seyahat|gezi|travel/, em: '🗺️', t: 'Şehirde turist olun', d: 'Hiç gitmediğiniz bir semti birlikte keşfedin.', k: null },
  { re: /burç|astroloji|tarot|fal/, em: '🔮', t: 'Kahve falı buluşması', d: 'Türk kahvesi için, fincanınızı Falcı Teyze’ye gönderin.', k: 'cafe' },
];
const GENERIC = [
  { em: '☕', t: 'Kısa bir kahve', d: 'İlk buluşma için 45 dakikalık rahat bir kahve molası.', k: 'cafe' },
  { em: '🌅', t: 'Gün batımı yürüyüşü', d: 'Yürürken konuşmak ilk buluşmanın gerginliğini alır.', k: 'park' },
  { em: '🍦', t: 'Dondurma ve sahil', d: 'Hafif, eğlenceli ve kısa tutması kolay.', k: 'cafe' },
  { em: '🎲', t: 'Kutu oyunu kafe', d: 'Oyun oynarken sohbet kendiliğinden akar.', k: 'cafe' },
  { em: '🎨', t: 'Atölye denemesi', d: 'Seramik, resim ya da kokteyl atölyesi.', k: 'fun' },
  { em: '🥐', t: 'Pazar kahvaltısı', d: 'Gündüz buluşması: rahat ve güvenli.', k: 'restaurant' },
];

// Burç elementleri (eğlence amaçlı uyum ipucu)
const ELEM = { koc: 'ateş', aslan: 'ateş', yay: 'ateş', boga: 'toprak', basak: 'toprak', oglak: 'toprak', ikizler: 'hava', terazi: 'hava', kova: 'hava', yengec: 'su', akrep: 'su', balik: 'su' };
const ZN = { koc: 'Koç', boga: 'Boğa', ikizler: 'İkizler', yengec: 'Yengeç', aslan: 'Aslan', basak: 'Başak', terazi: 'Terazi', akrep: 'Akrep', yay: 'Yay', oglak: 'Oğlak', kova: 'Kova', balik: 'Balık' };
const zodiacPct = (a, b) => { const ea = ELEM[a]; const eb = ELEM[b]; if (!ea || !eb) return null; if (ea === eb) return 88; const good = { ateş: 'hava', hava: 'ateş', toprak: 'su', su: 'toprak' }; return good[ea] === eb ? 92 : 64 + (hash(a + b) % 14); };

const FUN_QS = [
  'Tatlı mı tuzlu mu? Bu cevap çok şey anlatır 😄', 'Hayalindeki pazar günü nasıl geçer?', 'Son izlediğin ve herkese önerdiğin dizi ne?',
  'Bir süper gücün olsa ne seçerdin?', 'Kahve mi çay mı, yoksa ikisi birden mi?', 'Şehirde en sevdiğin gizli köşe neresi?',
  'Bu ara tekrar tekrar dinlediğin şarkı ne?', 'Hiç unutmadığın bir seyahat anın var mı?', 'Sabah insanı mısın gece kuşu mu?',
  'En iyi yaptığın yemek ne? Belki bir gün tadarım 🙂', 'Bir gün başka biri olabilsen kim olurdun?', 'Kendini üç emojiyle anlat!',
  'Son zamanlarda seni en çok güldüren şey ne oldu?', 'Bu hafta sonu için planın var mı?',
];

module.exports = function dating(app, ctx) {
  const { store, auth, isBlocked, notify, limited } = ctx;
  const SPECIAL = new Set(['falci', 'official']);
  const chatFor = (req) => {
    const c = store.get('chats', req.params.id);
    if (!c || c.isGroup || !c.members.includes(req.user.id)) return null;
    const other = store.get('users', c.members.find((m) => m !== req.user.id));
    if (!other || SPECIAL.has(other.role) || SPECIAL.has(req.user.role) || isBlocked(req.user.id, other.id)) return null;
    return { c, other };
  };
  const zOf = (u) => u.zodiac || ctx.zodiacOf?.(u) || null;
  const shared = (a, b) => { const B = new Map((b.interests || []).map((x) => [norm(x), x])); return (a.interests || []).filter((x) => B.has(norm(x))); };
  const firstName = (u) => String(u.name || u.username || '').split(' ')[0];

  // ================= Sohbet başlatıcılar =================
  app.get('/api/chats/:id/starters', auth, (req, res) => {
    const x = chatFor(req); if (!x) return res.json({ items: [] });
    const me = req.user; const o = x.other; const out = [];
    const sh = shared(me, o);
    if (sh.length) out.push({ em: '🤝', text: `İkimiz de ${sh[0].toLocaleLowerCase('tr-TR')} seviyoruz! Senin için en güzel ${sh[0].toLocaleLowerCase('tr-TR')} anısı hangisi?`, tag: 'Ortak ilgi' });
    const pr = (o.prompts || []).filter((p) => p.a);
    if (pr.length) {
      const p = pr[hash(x.c.id) % pr.length];
      const q = require('./social').PROMPTS.find((z) => z[0] === p.id)?.[1] || '';
      out.push({ em: '💬', text: `“${String(p.a).slice(0, 60)}” yazmışsın${q ? ` (${q.toLocaleLowerCase('tr-TR')})` : ''}, bunun arkasındaki hikayeyi merak ettim!`, tag: 'Profilinden' });
    }
    const only = (o.interests || []).filter((t) => !sh.includes(t));
    if (only.length) out.push({ em: '✨', text: `Profilinde ${only[0].toLocaleLowerCase('tr-TR')} gördüm, bana bir önerin var mı? Ben de denemek isterim.`, tag: 'İlgi alanı' });
    if (o.nowPlaying?.title && o.nowPlaying.until > now()) out.push({ em: '🎧', text: `“${o.nowPlaying.title}” dinliyormuşsun, güzel seçim! Başka ne önerirsin?`, tag: 'Şu an dinliyor' });
    const za = zOf(me); const zb = o.zodiac || null; const pct = zodiacPct(za, zb);
    if (pct) out.push({ em: '🔮', text: `Falcı Teyze’ye göre ${ZN[za]} ile ${ZN[zb]} uyumu %${pct} çıkıyormuş 😄 Sen burçlara inanır mısın?`, tag: 'Burç uyumu' });
    if (o.city && norm(o.city) === norm(me.city)) out.push({ em: '📍', text: `Sen de ${o.city}’dasın! Şehirde en sevdiğin semt hangisi?`, tag: 'Aynı şehir' });
    const day = trNow().toISOString().slice(0, 10);
    seeded(FUN_QS, `${x.c.id}:${day}`).slice(0, Math.max(2, 6 - out.length)).forEach((t) => out.push({ em: '💡', text: t, tag: 'Eğlenceli soru' }));
    res.json({ name: firstName(o), items: out.slice(0, 6) });
  });

  // ================= Buluşma fikirleri =================
  app.get('/api/chats/:id/ideas', auth, (req, res) => {
    const x = chatFor(req); if (!x) return res.status(404).json({ error: 'Sohbet bulunamadı.' });
    const me = req.user; const o = x.other;
    const all = [...new Set([...(me.interests || []), ...(o.interests || [])].map(norm))];
    const sh = shared(me, o).map(norm);
    const picked = []; const seen = new Set();
    // Önce ortak ilgi alanları, sonra ikinizden birinin ilgisi
    [...sh, ...all].forEach((t) => IDEAS.forEach((i) => {
      if (seen.has(i.t) || !i.re.test(t)) return; seen.add(i.t);
      picked.push({ em: i.em, title: i.t, desc: i.d, kind: i.k, why: sh.includes(t) ? `Ortak ilginiz: ${t}` : (me.interests || []).map(norm).includes(t) ? `Senin ilgi alanın: ${t}` : `${firstName(o)} · ${t}` });
    }));
    seeded(GENERIC, x.c.id).forEach((g) => { if (picked.length < 6 && !seen.has(g.t)) { seen.add(g.t); picked.push({ em: g.em, title: g.t, desc: g.d, kind: g.k, why: 'İlk buluşma için ideal' }); } });
    // İkinizin ortasındaki, SwipeUp’ta check-in yapılan popüler mekanlar (konum açık değil, sadece mekan adı)
    let spots = []; let km = null;
    if (me.lat != null && o.lat != null) {
      const R = Math.PI / 180;
      const dist = (a, b) => { const h = Math.sin(((b.lat - a.lat) * R) / 2) ** 2 + Math.cos(a.lat * R) * Math.cos(b.lat * R) * Math.sin(((b.lng - a.lng) * R) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
      km = Math.round(dist(me, o));
      const mid = { lat: (me.lat + o.lat) / 2, lng: (me.lng + o.lng) / 2 };
      const lim = now() - 60 * DAY; const cnt = new Map();
      store.filter('checkins', (c) => (c.at || 0) > lim).forEach((c) => cnt.set(c.venueId, (cnt.get(c.venueId) || 0) + 1));
      spots = store.filter('venues', (v) => dist(mid, v) < Math.max(3, km / 2 + 1))
        .map((v) => ({ name: v.name, area: v.area || '', cat: v.cat, n: cnt.get(v.id) || 0, d: dist(mid, v) }))
        .sort((a, b) => b.n - a.n || a.d - b.d).slice(0, 6).map(({ d, ...v }) => v);
    }
    res.json({ name: firstName(o), shared: shared(me, o), ideas: picked.slice(0, 8), spots, km });
  });

  // ================= İkinci şans (haftalık) =================
  const scId = (uid, w = weekOf()) => `${uid}_${w}`;
  const candidates = (me) => {
    const lim = now() - 2 * DAY;
    const matched = new Set(store.filter('matches', (m) => m.users.includes(me.id)).flatMap((m) => m.users));
    return store.filter('swipes', (s) => s.from === me.id && s.dir === 'left' && s.at < lim).map((s) => {
      const u = store.get('users', s.to);
      if (!u || SPECIAL.has(u.role) || u.status === 'banned' || u.status === 'suspended' || matched.has(u.id) || isBlocked(me.id, u.id)) return null;
      const back = store.get('swipes', `${u.id}_${me.id}`);
      const likedMe = !!back && back.dir !== 'left';
      const sh = shared(me, u);
      const score = (likedMe ? 3 : 0) + sh.length + ((u.lastSeen || 0) > now() - 7 * DAY ? 1 : 0) + (u.photos?.length ? 0.5 : 0) + (hash(u.id + weekOf()) % 100) / 1000;
      return { u, score, why: likedMe ? 'Eşleşme şansınız yüksek ✨' : sh.length ? `Ortak ilgi: ${sh.slice(0, 2).join(', ')}` : 'Bir kez daha bak' };
    }).filter(Boolean).sort((a, b) => b.score - a.score);
  };
  const batchFor = (me) => {
    let b = store.get('second_chance', scId(me.id));
    if (!b) {
      const size = ctx.eco?.isPlus?.(me) ? 10 : 5;
      const items = candidates(me).slice(0, size).map((x) => ({ id: x.u.id, why: x.why }));
      b = { id: scId(me.id), userId: me.id, week: weekOf(), items, done: {}, at: now() };
      // Boş liste saklanmaz; hafta içinde aday çıkarsa liste o zaman oluşur
      if (items.length) store.put('second_chance', b);
    }
    return b;
  };
  app.get('/api/second-chance', auth, (req, res) => {
    const b = batchFor(req.user);
    const items = b.items.filter((i) => !b.done[i.id]).map((i) => { const u = store.get('users', i.id); return u && !isBlocked(req.user.id, u.id) ? { ...ctx.cardOut(req.user, u, false), why: i.why } : null; }).filter(Boolean);
    const next = new Date(`${weekOf(now() + 7 * DAY)}T09:00:00+03:00`).getTime();
    res.json({ items, total: b.items.length, used: Object.keys(b.done).length, next });
  });
  app.post('/api/second-chance/:userId', auth, (req, res) => {
    const b = batchFor(req.user);
    if (!b.items.some((i) => i.id === req.params.userId)) return res.status(404).json({ error: 'Bu kişi bu haftanın ikinci şans listesinde yok.' });
    const action = req.body?.action === 'like' ? 'like' : 'skip';
    b.done[req.params.userId] = action;
    store.put('second_chance', b);
    // Beğeni normal kaydırma uç noktasıyla gönderilir (eşleşme ve günlük hak kontrolü orada); burada sadece işaretlenir
    res.json({ ok: true, action });
  });
  app.get('/api/second-chance/count', auth, (req, res) => {
    const b = store.get('second_chance', scId(req.user.id));
    if (b) return res.json({ n: b.items.filter((i) => !b.done[i.id]).length });
    res.json({ n: Math.min(ctx.eco?.isPlus?.(req.user) ? 10 : 5, candidates(req.user).length) });
  });
  // Her pazar 19:00'da (TR) son 2 haftada aktif olanlara bildirim
  setInterval(() => {
    const d = trNow();
    if (d.getUTCDay() !== 0 || d.getUTCHours() !== 19) return;
    const key = `sc_notify_${weekOf()}`;
    if (store.get('meta', key)) return;
    store.put('meta', { id: key, at: now() });
    const lim = now() - 14 * DAY;
    store.filter('users', (u) => !SPECIAL.has(u.role) && (u.lastSeen || 0) > lim && u.status !== 'banned').forEach((u) => {
      if (limited('scn:' + u.id, 1, DAY)) return;
      const n = candidates(u).length; if (!n) return;
      notify(u.id, { type: 'system', text: `İkinci şans 💫 Geçtiğin ${Math.min(n, 5)} kişiye bu hafta bir kez daha bakabilirsin.`, url: '/#/ikinci-sans', tag: 'second-chance' });
    });
  }, 10 * 60000).unref?.();
  ctx.secondChanceCount = (u) => { const b = store.get('second_chance', scId(u.id)); return b ? b.items.filter((i) => !b.done[i.id]).length : null; };
};

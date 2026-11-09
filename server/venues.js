// Mekan etiketleme (Swarm tarzı check-in): kullanıcı bulunduğu mekana "buradayım" der.
// Aynı mekanda "tanışmaya açığım" diyen iki kişi otomatik eşleşir. Kesin konum kimseye gösterilmez.
const { nanoid } = require('nanoid');

const HOURS = 3; // check-in süresi
const CATS = {
  cafe: 'Kafe', bar: 'Bar', pub: 'Pub', restaurant: 'Restoran', fast_food: 'Fast food', nightclub: 'Gece kulübü', cinema: 'Sinema', theatre: 'Tiyatro',
  ice_cream: 'Dondurmacı', biergarten: 'Bira bahçesi', university: 'Üniversite', college: 'Okul', library: 'Kütüphane', gym: 'Spor salonu', fitness_centre: 'Spor salonu',
  park: 'Park', mall: 'AVM', beach_resort: 'Plaj', stadium: 'Stadyum', concert_hall: 'Konser salonu', arts_centre: 'Sanat merkezi', museum: 'Müze', hotel: 'Otel', other: 'Mekan',
};
const EM = { cafe: '☕', bar: '🍸', pub: '🍺', restaurant: '🍽️', fast_food: '🍔', nightclub: '🪩', cinema: '🎬', theatre: '🎭', ice_cream: '🍦', biergarten: '🍻', university: '🎓', college: '🎓', library: '📚', gym: '🏋️', fitness_centre: '🏋️', park: '🌳', mall: '🛍️', beach_resort: '🏖️', stadium: '🏟️', concert_hall: '🎤', arts_centre: '🎨', museum: '🏛️', hotel: '🏨', other: '📍' };

module.exports = function venues(app, ctx) {
  const { store, auth, wrap, brief, notify, emitTo, isBlocked, limited, chatBetween, sendMessage, shownAge, moderation } = ctx;
  const now = () => Date.now();
  const SPECIAL = new Set(['falci', 'official']);
  const dist = (a, b) => {
    const R = 6371000; const r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r; const dLng = (b.lng - a.lng) * r;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(x)));
  };
  const alive = (c) => c && !c.out && c.until > now();
  const activeOf = (uid) => store.find('checkins', (c) => c.userId === uid && alive(c));
  const venueOut = (v) => v && { id: v.id, name: v.name, cat: v.cat, catLabel: CATS[v.cat] || 'Mekan', em: EM[v.cat] || '📍', area: v.area || '' };
  const hereCount = (vid) => store.filter('checkins', (c) => c.venueId === vid && alive(c)).length;

  // ---- Yakındaki mekanlar (OpenStreetMap) ----
  const osmCache = new Map();
  async function nearbyOsm(lat, lng) {
    const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    const c = osmCache.get(key); if (c && c.at > now() - 6 * 3600000) return c.items;
    const am = 'cafe|bar|pub|restaurant|fast_food|nightclub|cinema|theatre|ice_cream|biergarten|university|college|library|arts_centre';
    const q = `[out:json][timeout:12];(node(around:900,${lat},${lng})[amenity~"^(${am})$"][name];way(around:900,${lat},${lng})[amenity~"^(${am})$"][name];node(around:900,${lat},${lng})[leisure~"^(park|fitness_centre|stadium|beach_resort)$"][name];way(around:900,${lat},${lng})[leisure~"^(park|fitness_centre|stadium)$"][name];way(around:900,${lat},${lng})[shop=mall][name];node(around:900,${lat},${lng})[tourism~"^(museum|hotel)$"][name];);out center 80;`;
    let items = [];
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
      const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'SwipeUp/1.0' }, signal: ctl.signal });
      clearTimeout(t);
      const j = await r.json();
      items = (j.elements || []).map((e) => {
        const tg = e.tags || {}; const la = e.lat ?? e.center?.lat; const lo = e.lon ?? e.center?.lon;
        const cat = tg.amenity || tg.leisure || (tg.shop === 'mall' ? 'mall' : tg.tourism) || 'other';
        return la == null ? null : { id: `osm_${e.type[0]}${e.id}`, name: String(tg.name).slice(0, 80), cat: CATS[cat] ? cat : 'other', lat: la, lng: lo, area: tg['addr:street'] || tg['addr:suburb'] || tg['addr:district'] || '' };
      }).filter(Boolean);
    } catch (e) { console.error('[mekan] OSM:', e.message); }
    osmCache.set(key, { at: now(), items });
    if (osmCache.size > 500) osmCache.delete(osmCache.keys().next().value);
    return items;
  }
  const numOk = (v, lo, hi) => Number.isFinite(+v) && +v >= lo && +v <= hi;

  app.get('/api/venues/nearby', auth, wrap(async (req, res) => {
    const { lat, lng } = req.query;
    if (!numOk(lat, -90, 90) || !numOk(lng, -180, 180)) return res.status(400).json({ error: 'Konum alınamadı.' });
    const me = { lat: +lat, lng: +lng };
    const q = String(req.query.q || '').trim().toLocaleLowerCase('tr-TR').slice(0, 40);
    const map = new Map();
    // SwipeUp'ta daha önce etiketlenen mekanlar (1,5 km)
    store.filter('venues', (v) => dist(me, v) < 1500).forEach((v) => map.set(v.id, v));
    (await nearbyOsm(me.lat, me.lng)).forEach((v) => { if (!map.has(v.id)) map.set(v.id, v); });
    let list = [...map.values()].map((v) => ({ ...venueOut(v), lat: v.lat, lng: v.lng, m: dist(me, v), here: hereCount(v.id) }));
    if (q) list = list.filter((v) => v.name.toLocaleLowerCase('tr-TR').includes(q));
    list.sort((a, b) => (b.here > 0) - (a.here > 0) || a.m - b.m);
    res.json({ items: list.slice(0, 50), current: currentOut(req.user.id) });
  }));

  function currentOut(uid) {
    const c = activeOf(uid); if (!c) return null;
    const v = store.get('venues', c.venueId);
    return { id: c.id, at: c.at, until: c.until, open: !!c.open, note: c.note || '', venue: venueOut(v), here: hereCount(c.venueId) };
  }
  app.get('/api/checkins/me', auth, (req, res) => res.json({ current: currentOut(req.user.id) }));

  // Aynı mekandakiler
  function peopleAt(c, viewer) {
    return store.filter('checkins', (x) => x.venueId === c.venueId && alive(x) && x.userId !== viewer.id)
      .map((x) => ({ x, u: store.get('users', x.userId) }))
      .filter(({ u }) => u && !SPECIAL.has(u.role) && u.status !== 'banned' && !isBlocked(viewer.id, u.id))
      .sort((a, b) => (b.x.open - a.x.open) || (b.x.at - a.x.at))
      .map(({ x, u }) => ({ ...brief(u), age: shownAge(u), open: !!x.open, note: x.note || '', at: x.at, matched: !!store.get('matches', [viewer.id, u.id].sort().join('_')) }));
  }
  app.get('/api/checkins/here', auth, (req, res) => {
    const c = activeOf(req.user.id);
    if (!c) return res.json({ current: null, people: [] });
    res.json({ current: currentOut(req.user.id), people: peopleAt(c, req.user) });
  });

  function autoMatch(c, me) {
    if (!c.open) return [];
    const out = [];
    store.filter('checkins', (x) => x.venueId === c.venueId && alive(x) && x.open && x.userId !== me.id).forEach((x) => {
      const o = store.get('users', x.userId);
      if (!o || SPECIAL.has(o.role) || isBlocked(me.id, o.id)) return;
      // Cinsiyet tercihi uyuşmuyorsa eşleştirme
      const okFor = (a, b) => !a.lookingFor || a.lookingFor === 'all' || !b.gender || a.lookingFor === b.gender;
      if (!okFor(me, o) || !okFor(o, me)) return;
      const mid = [me.id, o.id].sort().join('_');
      if (store.get('matches', mid)) return;
      store.put('matches', { id: mid, users: [me.id, o.id], at: now(), via: 'venue', venueId: c.venueId });
      const chat = chatBetween(me.id, o.id);
      const v = store.get('venues', c.venueId);
      sendMessage(chat, me.id, { text: `📍 ${v?.name || 'Aynı mekan'}’dasınız ve ikiniz de tanışmaya açıksınız, eşleştiniz! Bir selam ver 👋`, system: true });
      notify(o.id, { type: 'match', fromId: me.id, text: `📍 ${v?.name || 'Bulunduğun mekan'}’da ${me.name} ile eşleştin!`, url: `/#/chat/${chat.id}` });
      notify(me.id, { type: 'match', fromId: o.id, text: `📍 ${v?.name || 'Bulunduğun mekan'}’da ${o.name} ile eşleştin!`, url: `/#/chat/${chat.id}` });
      emitTo(o.id, 'match', { user: brief(me), chatId: chat.id, via: 'venue' });
      out.push({ user: brief(o), chatId: chat.id });
    });
    return out;
  }

  app.post('/api/checkins', auth, (req, res) => {
    const b = req.body || {}; const me = req.user;
    if (SPECIAL.has(me.role)) return res.status(403).json({ error: 'Bu hesap mekan etiketleyemez.' });
    if (limited('ci:' + me.id, 12, 3600000)) return res.status(429).json({ error: 'Çok sık mekan değiştiriyorsun, biraz bekle.' });
    const v0 = b.venue || {};
    if (!numOk(b.lat, -90, 90) || !numOk(b.lng, -180, 180)) return res.status(400).json({ error: 'Konumun alınamadı. Konum iznini aç.' });
    const pos = { lat: +b.lat, lng: +b.lng };
    let v;
    if (v0.id && store.get('venues', String(v0.id))) v = store.get('venues', String(v0.id));
    else if (/^osm_[nwr]\d+$/.test(String(v0.id || '')) && numOk(v0.lat, -90, 90) && numOk(v0.lng, -180, 180)) {
      v = store.put('venues', { id: String(v0.id), name: String(v0.name || 'Mekan').trim().slice(0, 80), cat: CATS[v0.cat] ? v0.cat : 'other', lat: +v0.lat, lng: +v0.lng, area: String(v0.area || '').slice(0, 60), src: 'osm', at: now() });
    } else {
      const name = moderation.mask(String(v0.name || '').trim().slice(0, 60));
      if (name.length < 2) return res.status(400).json({ error: 'Mekanın adını yaz.' });
      // Aynı isimde yakın bir mekan varsa onu kullan
      v = store.find('venues', (x) => x.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR') && dist(pos, x) < 300)
        || store.put('venues', { id: 'v_' + nanoid(10), name, cat: CATS[v0.cat] ? v0.cat : 'other', lat: pos.lat, lng: pos.lng, area: '', src: 'user', by: me.id, at: now() });
    }
    // Mekandan çok uzaktaysa (sahte check-in) kabul etme
    if (dist(pos, v) > 1500) return res.status(400).json({ error: 'Bu mekana çok uzaksın. Yalnızca bulunduğun yeri etiketleyebilirsin.' });
    store.filter('checkins', (c) => c.userId === me.id && alive(c)).forEach((c) => store.update('checkins', c.id, { out: now() }));
    const c = store.put('checkins', { id: nanoid(12), userId: me.id, venueId: v.id, at: now(), until: now() + HOURS * 3600000, open: !!b.open, note: moderation.mask(String(b.note || '').trim().slice(0, 80)), out: null });
    ctx.contestEvent?.('checkin', me.id);
    const matches = autoMatch(c, me);
    // Mekandaki diğer kişilere haber ver (ekran açıksa listeler yenilenir)
    store.filter('checkins', (x) => x.venueId === v.id && alive(x) && x.userId !== me.id).forEach((x) => emitTo(x.userId, 'venue', { venueId: v.id }));
    res.json({ current: currentOut(me.id), people: peopleAt(c, me), matches });
  });
  app.patch('/api/checkins/me', auth, (req, res) => {
    const c = activeOf(req.user.id); if (!c) return res.status(404).json({ error: 'Aktif mekan etiketin yok.' });
    const patch = {};
    if (req.body?.open !== undefined) patch.open = !!req.body.open;
    if (req.body?.note !== undefined) patch.note = moderation.mask(String(req.body.note || '').trim().slice(0, 80));
    store.update('checkins', c.id, patch);
    const matches = patch.open ? autoMatch(store.get('checkins', c.id), req.user) : [];
    res.json({ current: currentOut(req.user.id), people: peopleAt(c, req.user), matches });
  });
  app.delete('/api/checkins/me', auth, (req, res) => {
    const c = activeOf(req.user.id);
    if (c) { store.update('checkins', c.id, { out: now() }); store.filter('checkins', (x) => x.venueId === c.venueId && alive(x)).forEach((x) => emitTo(x.userId, 'venue', { venueId: c.venueId })); }
    res.json({ ok: true });
  });
  // Profilde "şu an burada" (takipçilere / eşleşmelere)
  ctx.checkinOf = (u, viewerId) => {
    const c = activeOf(u.id); if (!c) return null;
    if (viewerId !== u.id) {
      if ((u.privacy || {}).hideCheckin) return null;
      const mutual = [`${viewerId}_${u.id}`, `${u.id}_${viewerId}`].every((id) => { const f = store.get('follows', id); return f && f.status !== 'pending'; });
      if (!mutual && !store.get('matches', [viewerId, u.id].sort().join('_'))) return null;
    }
    const v = store.get('venues', c.venueId);
    return v ? { name: v.name, em: EM[v.cat] || '📍', at: c.at } : null;
  };
  // Takip ettiklerinin şu anki mekanları (ana sayfa şeridi)
  app.get('/api/checkins/friends', auth, (req, res) => {
    // Güvenlik: sadece karşılıklı takipleştiğin kişilerin mekanı görünür
    const fol = new Set(store.filter('follows', (f) => f.from === req.user.id && f.status !== 'pending').map((f) => f.to)
      .filter((id) => { const back = store.get('follows', `${id}_${req.user.id}`); return back && back.status !== 'pending'; }));
    const out = store.filter('checkins', (c) => fol.has(c.userId) && alive(c)).sort((a, b) => b.at - a.at).slice(0, 20).map((c) => {
      const u = store.get('users', c.userId); const v = store.get('venues', c.venueId);
      return u && v && !isBlocked(req.user.id, u.id) && !(u.privacy || {}).hideCheckin ? { user: brief(u), venue: venueOut(v), at: c.at } : null;
    }).filter(Boolean);
    res.json(out);
  });
  // Eski kayıtları temizle (7 gün)
  setInterval(() => store.filter('checkins', (c) => c.at < now() - 7 * 86400000).forEach((c) => store.del('checkins', c.id)), 6 * 3600000).unref();
};

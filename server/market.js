// SwipeUp Store: ikinci el al-sat. Komisyon yok.
// Kargolu siparişlerde alıcının ödemesi SwipeUp hesabında emanette bekler (havale/EFT, yönetici onaylar),
// satıcı paketin içini ve dışını fotoğraflayıp takip kodunu girer, alıcı teslim aldığını onaylayınca
// (ya da süre dolunca) tutar satıcının Store bakiyesine geçer ve satıcı ödeme talep eder.
// Elden teslimde ödeme yüz yüze yapılır; teslim anında iki taraf da fotoğraf çekmek zorundadır.
const { nanoid, customAlphabet } = require('nanoid');

const DAY = 86400000;
const code6 = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

const CATEGORIES = [
  { id: 'elektronik', name: 'Elektronik', em: '📱' },
  { id: 'giyim', name: 'Giyim', em: '👕' },
  { id: 'ayakkabi', name: 'Ayakkabı & Çanta', em: '👟' },
  { id: 'aksesuar', name: 'Saat & Aksesuar', em: '⌚' },
  { id: 'kozmetik', name: 'Kozmetik & Bakım', em: '💄' },
  { id: 'ev', name: 'Ev & Yaşam', em: '🛋️' },
  { id: 'kitap', name: 'Kitap & Hobi', em: '📚' },
  { id: 'oyun', name: 'Oyun & Konsol', em: '🎮' },
  { id: 'spor', name: 'Spor & Outdoor', em: '⚽' },
  { id: 'muzik', name: 'Müzik Aletleri', em: '🎸' },
  { id: 'bebek', name: 'Bebek & Çocuk', em: '🧸' },
  { id: 'evcil', name: 'Evcil Hayvan Ürünleri', em: '🐾' },
  { id: 'koleksiyon', name: 'Koleksiyon & Antika', em: '🏺' },
  { id: 'diger', name: 'Diğer', em: '📦' },
];
const CONDITIONS = [
  { id: 'sifir', name: 'Sıfır, etiketli' },
  { id: 'az', name: 'Az kullanılmış' },
  { id: 'iyi', name: 'İyi durumda' },
  { id: 'yipranmis', name: 'Yıpranmış' },
];
const CARRIERS = [
  { id: 'yurtici', name: 'Yurtiçi Kargo', url: 'https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=' },
  { id: 'aras', name: 'Aras Kargo', url: 'https://www.araskargo.com.tr/trs_gonderi_sorgula.aspx?q=' },
  { id: 'mng', name: 'MNG Kargo', url: 'https://www.mngkargo.com.tr/gonderi-takip/?q=' },
  { id: 'ptt', name: 'PTT Kargo', url: 'https://gonderitakip.ptt.gov.tr/Track/Verify?q=' },
  { id: 'surat', name: 'Sürat Kargo', url: 'https://suratkargo.com.tr/KargoTakip/?kargotakipno=' },
  { id: 'hepsijet', name: 'HepsiJet', url: 'https://www.hepsijet.com/gonderi-takibi/' },
  { id: 'trendyol', name: 'Trendyol Express', url: 'https://www.trendyolexpress.com/gonderi-takip?trackingNumber=' },
  { id: 'kolaygelsin', name: 'Kolay Gelsin', url: 'https://www.kolaygelsin.com/gonderi-takip?code=' },
  { id: 'ups', name: 'UPS', url: 'https://www.ups.com/track?tracknum=' },
  { id: 'dhl', name: 'DHL', url: 'https://www.dhl.com/tr-tr/home/tracking.html?tracking-id=' },
  { id: 'diger', name: 'Diğer', url: '' },
];
const PROBLEMS = { gelmedi: 'Ürün elime ulaşmadı', hasarli: 'Ürün hasarlı geldi', farkli: 'Gelen ürün ilandakinden farklı', eksik: 'Eksik parça var', diger: 'Diğer' };

// Sipariş durumları
const ST = {
  odeme_bekliyor: 'Ödeme bekleniyor',
  odeme_kontrol: 'Ödeme kontrol ediliyor',
  odendi: 'Ödeme güvencede · kargo bekleniyor',
  kargoda: 'Kargoda',
  bulusma: 'Elden teslim · buluşma',
  teslim_onay: 'Teslim onayı bekleniyor',
  sorunlu: 'Sorun bildirildi',
  iade_bekliyor: 'İade hazırlanıyor',
  iade_edildi: 'İade edildi',
  tamamlandi: 'Tamamlandı',
  iptal: 'İptal edildi',
};
const OPEN = ['odeme_bekliyor', 'odeme_kontrol', 'odendi', 'kargoda', 'bulusma', 'teslim_onay', 'sorunlu', 'iade_bekliyor'];

module.exports = function market(app, ctx) {
  const { store, io, auth, wrap, eco, notify, emitTo, brief, isBlocked, limited, isMedia, moderation, chatBetween, sendMessage } = ctx;
  const now = () => Date.now();
  const settings = () => ({ shipDays: 3, autoDays: 7, minPayout: 10, ...(store.get('settings', 'market') || {}) });
  const catOf = (id) => CATEGORIES.find((c) => c.id === id);
  const tl = (n) => Math.round(+n * 100) / 100;
  const media = (arr, max) => (Array.isArray(arr) ? arr : []).map(String).filter(isMedia).slice(0, max);

  const sellerInfo = (uid) => {
    const u = store.get('users', uid);
    if (!u) return null;
    const r = u.mkRating || { sum: 0, n: 0 };
    return { ...brief(u), city: u.city || '', rating: r.n ? +(r.sum / r.n).toFixed(1) : null, ratings: r.n, sold: u.mkSold || 0, since: u.createdAt || null };
  };
  const itemOut = (it, viewer) => ({
    id: it.id, title: it.title, desc: it.desc, price: it.price, category: it.category, condition: it.condition, photos: it.photos,
    city: it.city, ship: it.ship, hand: it.hand, shipPayer: it.shipPayer, shipFee: it.shipFee || 0, status: it.status, at: it.at, views: it.views || 0,
    fav: viewer ? (it.favs || []).includes(viewer) : false, favCount: (it.favs || []).length, mine: viewer === it.sellerId,
    seller: sellerInfo(it.sellerId),
  });
  const cardOut = (it, viewer) => ({
    id: it.id, title: it.title, price: it.price, photo: it.photos[0], city: it.city, condition: it.condition, status: it.status,
    ship: it.ship, hand: it.hand, fav: viewer ? (it.favs || []).includes(viewer) : false, at: it.at,
  });
  const role = (o, uid) => (o.buyerId === uid ? 'buyer' : o.sellerId === uid ? 'seller' : null);
  const orderOut = (o, uid) => {
    const r = role(o, uid);
    const s = settings();
    return {
      ...o,
      role: r, statusText: ST[o.status],
      buyer: brief(store.get('users', o.buyerId)), seller: sellerInfo(o.sellerId),
      carrierName: CARRIERS.find((c) => c.id === o.carrier)?.name || o.carrierOther || null,
      trackUrl: (() => { const c = CARRIERS.find((x) => x.id === o.carrier); return c?.url && o.tracking ? c.url + encodeURIComponent(o.tracking) : null; })(),
      bank: o.method === 'kargo' && r === 'buyer' && ['odeme_bekliyor', 'odeme_kontrol'].includes(o.status) ? eco.get().bank : undefined,
      buyerIban: r === 'buyer' ? o.buyerIban : undefined,
      shipBy: o.paidAt ? o.paidAt + s.shipDays * DAY : null,
      autoAt: o.shippedAt ? o.shippedAt + s.autoDays * DAY : null,
    };
  };
  const log = (o, text, by) => { o.log = [...(o.log || []), { at: now(), text, by: by || null }].slice(-40); };
  const save = (o, patch, text, by) => {
    Object.assign(o, patch);
    if (text) log(o, text, by);
    const out = store.update('mk_orders', o.id, { ...patch, log: o.log });
    [o.buyerId, o.sellerId].forEach((u) => emitTo(u, 'market', { orderId: o.id }));
    return out;
  };
  const tell = (uid, text, o) => notify(uid, { type: 'market', text, title: 'SwipeUp Store', url: `/#/market/o/${o.id}`, tag: 'mk' + o.id });
  const chatNote = (o, text) => {
    try { const c = chatBetween(o.buyerId, o.sellerId); sendMessage(c, o.sellerId, { text, system: true }); } catch {}
  };
  const credit = (o) => {
    const u = store.get('users', o.sellerId);
    if (!u) return;
    store.update('users', u.id, { mkBalance: tl((u.mkBalance || 0) + o.amount), mkSold: (u.mkSold || 0) + 1 });
    emitTo(u.id, 'wallet', {});
  };
  const setItem = (id, status) => { if (store.get('mk_items', id)) store.update('mk_items', id, { status, updatedAt: now() }); };
  // Sipariş tamamlandı: kargoda emanet satıcıya geçer
  const complete = (o, text, by) => {
    if (o.method === 'kargo') credit(o); else store.update('users', o.sellerId, { mkSold: (store.get('users', o.sellerId)?.mkSold || 0) + 1 });
    setItem(o.itemId, 'sold');
    save(o, { status: 'tamamlandi', doneAt: now() }, text, by);
    tell(o.sellerId, o.method === 'kargo' ? `💸 "${o.title}" satışı tamamlandı. ${o.amount} ₺ Store bakiyene eklendi.` : `✅ "${o.title}" satışı tamamlandı.`, o);
    tell(o.buyerId, `✅ "${o.title}" siparişin tamamlandı. Satıcıyı değerlendirmeyi unutma.`, o);
    chatNote(o, `✅ "${o.title}" siparişi tamamlandı.`);
  };

  // ---------- Vitrin ----------
  app.get('/api/market/meta', auth, (req, res) => {
    const u = req.user; const s = settings();
    res.json({
      categories: CATEGORIES.map((c) => ({ ...c, count: store.filter('mk_items', (i) => i.status === 'active' && i.category === c.id).length })),
      conditions: CONDITIONS, carriers: CARRIERS.map(({ id, name }) => ({ id, name })), problems: PROBLEMS,
      balance: u.mkBalance || 0, minPayout: s.minPayout, shipDays: s.shipDays, autoDays: s.autoDays, payEnabled: !!eco.get().bank.iban,
      open: store.filter('mk_orders', (o) => OPEN.includes(o.status) && (o.buyerId === u.id || o.sellerId === u.id)).length,
      action: store.filter('mk_orders', (o) => needsMe(o, u.id)).length,
    });
  });
  // Bu siparişte sıra bende mi?
  function needsMe(o, uid) {
    const r = role(o, uid);
    if (!r) return false;
    if (r === 'buyer') return ['odeme_bekliyor', 'kargoda', 'teslim_onay'].includes(o.status) || (o.status === 'tamamlandi' && !o.rating && o.doneAt > now() - 14 * DAY);
    return o.status === 'odendi' || (o.status === 'bulusma' && !o.sellerPhoto);
  }

  app.get('/api/market/items', auth, (req, res) => {
    const q = String(req.query.q || '').toLocaleLowerCase('tr-TR').trim();
    const cat = String(req.query.cat || '');
    const cond = String(req.query.cond || '');
    const min = parseFloat(req.query.min) || 0; const max = parseFloat(req.query.max) || Infinity;
    const city = String(req.query.city || '').toLocaleLowerCase('tr-TR').trim();
    const ship = req.query.ship === '1'; const hand = req.query.hand === '1';
    const seller = String(req.query.seller || '');
    const sort = String(req.query.sort || 'new');
    const page = Math.max(0, parseInt(req.query.page, 10) || 0);
    let list = store.filter('mk_items', (i) => {
      if (seller) { if (i.sellerId !== seller || !['active', 'reserved', 'sold'].includes(i.status)) return false; if (i.status === 'sold' && seller !== req.user.id && i.updatedAt < now() - 30 * DAY) return false; } else if (i.status !== 'active') return false;
      if (isBlocked(req.user.id, i.sellerId)) return false;
      if (cat && i.category !== cat) return false;
      if (cond && i.condition !== cond) return false;
      if (i.price < min || i.price > max) return false;
      if (ship && !i.ship) return false;
      if (hand && !i.hand) return false;
      if (city && !(i.city || '').toLocaleLowerCase('tr-TR').includes(city)) return false;
      if (q && !`${i.title} ${i.desc}`.toLocaleLowerCase('tr-TR').includes(q)) return false;
      return true;
    });
    const by = { new: (a, b) => b.at - a.at, cheap: (a, b) => a.price - b.price, pricey: (a, b) => b.price - a.price, popular: (a, b) => ((b.favs || []).length * 5 + (b.views || 0)) - ((a.favs || []).length * 5 + (a.views || 0)) };
    list.sort(by[sort] || by.new);
    const total = list.length;
    list = list.slice(page * 30, page * 30 + 30);
    res.json({ total, items: list.map((i) => cardOut(i, req.user.id)) });
  });

  app.get('/api/market/items/:id', auth, (req, res) => {
    const it = store.get('mk_items', req.params.id);
    if (!it || it.status === 'removed' || (it.status === 'draft' && it.sellerId !== req.user.id)) return res.status(404).json({ error: 'İlan bulunamadı ya da kaldırıldı.' });
    if (isBlocked(req.user.id, it.sellerId)) return res.status(404).json({ error: 'İlan bulunamadı.' });
    if (it.sellerId !== req.user.id && !limited(`mkv:${req.user.id}:${it.id}`, 1, 3600000)) store.update('mk_items', it.id, { views: (it.views || 0) + 1 });
    const myOrder = store.find('mk_orders', (o) => o.itemId === it.id && o.buyerId === req.user.id && OPEN.includes(o.status));
    const more = store.filter('mk_items', (i) => i.sellerId === it.sellerId && i.id !== it.id && i.status === 'active').slice(0, 6).map((i) => cardOut(i, req.user.id));
    const reviews = store.filter('mk_orders', (o) => o.sellerId === it.sellerId && o.rating).sort((a, b) => b.ratedAt - a.ratedAt).slice(0, 5)
      .map((o) => ({ rating: o.rating, review: o.review || '', at: o.ratedAt, title: o.title, buyer: brief(store.get('users', o.buyerId)) }));
    res.json({ ...itemOut(store.get('mk_items', it.id), req.user.id), myOrder: myOrder ? myOrder.id : null, more, reviews });
  });

  const readItem = (b, old) => {
    const title = moderation.mask(String(b.title || '').trim()).slice(0, 80);
    const desc = moderation.mask(String(b.desc || '').trim()).slice(0, 1500);
    const price = tl(b.price);
    const photos = media(b.photos, 8);
    const ship = !!b.ship; const hand = !!b.hand;
    const shipPayer = b.shipPayer === 'satici' ? 'satici' : 'alici';
    const shipFee = shipPayer === 'alici' && ship ? Math.max(0, Math.min(1000, tl(b.shipFee) || 0)) : 0;
    if (title.length < 3) throw new Error('Başlık en az 3 karakter olmalı.');
    if (!(price >= 1 && price <= 1000000)) throw new Error('Fiyat 1 ₺ ile 1.000.000 ₺ arasında olmalı.');
    if (!catOf(b.category)) throw new Error('Kategori seç.');
    if (!CONDITIONS.find((c) => c.id === b.condition)) throw new Error('Ürünün durumunu seç.');
    if (!photos.length) throw new Error('En az bir fotoğraf ekle.');
    if (!ship && !hand) throw new Error('Kargo ya da elden teslimden en az birini seç.');
    return { title, desc, price, category: b.category, condition: b.condition, photos, city: String(b.city || old?.city || '').trim().slice(0, 40), ship, hand, shipPayer, shipFee };
  };
  app.post('/api/market/items', auth, (req, res) => {
    if (limited('mkn:' + req.user.id, 20, DAY)) return res.status(429).json({ error: 'Bugün çok fazla ilan verdin. Yarın tekrar dene.' });
    if (store.filter('mk_items', (i) => i.sellerId === req.user.id && i.status === 'active').length >= 50) return res.status(400).json({ error: 'Aynı anda en fazla 50 aktif ilanın olabilir.' });
    let data; try { data = readItem(req.body || {}); } catch (e) { return res.status(400).json({ error: e.message }); }
    if (!data.city) data.city = req.user.city || '';
    const it = store.put('mk_items', { id: nanoid(10), sellerId: req.user.id, ...data, status: 'active', views: 0, favs: [], at: now(), updatedAt: now() });
    res.json(itemOut(it, req.user.id));
  });
  app.put('/api/market/items/:id', auth, (req, res) => {
    const it = store.get('mk_items', req.params.id);
    if (!it || it.sellerId !== req.user.id || ['removed', 'sold'].includes(it.status)) return res.status(404).json({ error: 'İlan bulunamadı.' });
    if (it.status === 'reserved') return res.status(409).json({ error: 'Bu ilan için açık bir sipariş var; sipariş sonuçlanana kadar düzenlenemez.' });
    let data; try { data = readItem(req.body || {}, it); } catch (e) { return res.status(400).json({ error: e.message }); }
    res.json(itemOut(store.update('mk_items', it.id, { ...data, updatedAt: now() }), req.user.id));
  });
  app.delete('/api/market/items/:id', auth, (req, res) => {
    const it = store.get('mk_items', req.params.id);
    if (!it || it.sellerId !== req.user.id) return res.status(404).json({ error: 'İlan bulunamadı.' });
    if (it.status === 'reserved') return res.status(409).json({ error: 'Bu ilan için açık bir sipariş var; önce siparişi sonuçlandır.' });
    store.update('mk_items', it.id, { status: 'removed', removedAt: now() });
    res.json({ ok: true });
  });
  app.post('/api/market/items/:id/fav', auth, (req, res) => {
    const it = store.get('mk_items', req.params.id);
    if (!it || it.status === 'removed') return res.status(404).json({ error: 'İlan bulunamadı.' });
    const favs = new Set(it.favs || []);
    if (favs.has(req.user.id)) favs.delete(req.user.id); else favs.add(req.user.id);
    store.update('mk_items', it.id, { favs: [...favs] });
    res.json({ fav: favs.has(req.user.id), favCount: favs.size });
  });
  app.get('/api/market/favs', auth, (req, res) => {
    res.json(store.filter('mk_items', (i) => (i.favs || []).includes(req.user.id) && i.status !== 'removed').sort((a, b) => b.at - a.at).map((i) => cardOut(i, req.user.id)));
  });
  app.get('/api/market/mine', auth, (req, res) => {
    res.json(store.filter('mk_items', (i) => i.sellerId === req.user.id && i.status !== 'removed').sort((a, b) => b.at - a.at)
      .map((i) => ({ ...cardOut(i, req.user.id), views: i.views || 0, favCount: (i.favs || []).length })));
  });
  app.post('/api/market/items/:id/report', auth, (req, res) => {
    const it = store.get('mk_items', req.params.id);
    if (!it) return res.status(404).json({ error: 'İlan bulunamadı.' });
    if (limited('mkr:' + req.user.id, 10, DAY)) return res.status(429).json({ error: 'Çok fazla bildirim gönderdin.' });
    store.put('reports', { id: nanoid(10), from: req.user.id, to: it.sellerId, reason: String(req.body?.reason || 'İlan uygunsuz').slice(0, 300), refKind: 'listing', ref: it.id, snapshot: { title: it.title, photo: it.photos[0], price: it.price }, at: now(), status: 'open' });
    res.json({ ok: true });
  });

  // ---------- Sipariş ----------
  app.post('/api/market/items/:id/buy', auth, (req, res) => {
    const it = store.get('mk_items', req.params.id);
    if (!it || it.status !== 'active') return res.status(409).json({ error: 'Bu ürün artık satışta değil.' });
    if (it.sellerId === req.user.id) return res.status(400).json({ error: 'Kendi ilanını satın alamazsın.' });
    if (isBlocked(req.user.id, it.sellerId)) return res.status(403).json({ error: 'Bu satıcıyla alışveriş yapamazsın.' });
    const method = req.body?.method === 'elden' ? 'elden' : 'kargo';
    if (method === 'kargo' && !it.ship) return res.status(400).json({ error: 'Bu ürün kargoyla gönderilmiyor.' });
    if (method === 'elden' && !it.hand) return res.status(400).json({ error: 'Bu ürün elden teslim edilmiyor.' });
    if (method === 'kargo' && !eco.get().bank.iban) return res.status(503).json({ error: 'Güvenli ödeme şu an kapalı. Elden teslimi seçebilir ya da daha sonra deneyebilirsin.' });
    if (store.filter('mk_orders', (o) => o.buyerId === req.user.id && o.status === 'odeme_bekliyor').length >= 3) return res.status(429).json({ error: 'Ödemesi bekleyen siparişlerin var. Önce onları tamamla ya da iptal et.' });
    const address = method === 'kargo' ? {
      name: String(req.body?.address?.name || '').trim().slice(0, 60),
      phone: String(req.body?.address?.phone || '').replace(/[^\d+ ]/g, '').slice(0, 20),
      text: String(req.body?.address?.text || '').trim().slice(0, 300),
    } : null;
    if (address && (address.name.length < 3 || address.phone.replace(/\D/g, '').length < 10 || address.text.length < 10)) return res.status(400).json({ error: 'Teslimat için ad soyad, telefon ve açık adresi eksiksiz yaz.' });
    let code; do { code = 'ST-' + code6(); } while (store.find('mk_orders', (o) => o.code === code));
    const fee = method === 'kargo' && it.shipPayer === 'alici' ? it.shipFee || 0 : 0;
    const o = {
      id: nanoid(10), code, itemId: it.id, buyerId: req.user.id, sellerId: it.sellerId, method,
      title: it.title, photo: it.photos[0], price: it.price, shipFee: fee, amount: tl(it.price + fee), shipPayer: it.shipPayer,
      address, status: method === 'kargo' ? 'odeme_bekliyor' : 'bulusma', at: now(), log: [],
    };
    log(o, method === 'kargo' ? 'Sipariş oluşturuldu, ödeme bekleniyor.' : 'Elden teslim siparişi oluşturuldu.', 'buyer');
    store.put('mk_orders', o);
    setItem(it.id, 'reserved');
    tell(it.sellerId, method === 'kargo' ? `🛍️ "${it.title}" için kargolu sipariş geldi. Alıcının ödemesi onaylanınca kargolayabilirsin.` : `🛍️ "${it.title}" için elden teslim siparişi geldi. Buluşmayı mesajlaşarak ayarlayın.`, o);
    chatNote(o, method === 'kargo' ? `🛍️ "${it.title}" için kargolu sipariş verildi (${o.amount} ₺). Ödeme SwipeUp güvencesinde tutulacak.` : `🛍️ "${it.title}" için elden teslim siparişi verildi (${o.amount} ₺). Buluşma yeri ve saatini buradan ayarlayabilirsiniz.`);
    res.json(orderOut(o, req.user.id));
  });

  app.get('/api/market/orders', auth, (req, res) => {
    const side = req.query.side === 'sell' ? 'sellerId' : 'buyerId';
    res.json(store.filter('mk_orders', (o) => o[side] === req.user.id).sort((a, b) => b.at - a.at).slice(0, 100)
      .map((o) => ({ ...orderOut(o, req.user.id), action: needsMe(o, req.user.id) })));
  });
  const mine = (req, res) => {
    const o = store.get('mk_orders', req.params.id);
    if (!o || !role(o, req.user.id)) { res.status(404).json({ error: 'Sipariş bulunamadı.' }); return null; }
    return o;
  };
  app.get('/api/market/orders/:id', auth, (req, res) => {
    const o = mine(req, res); if (!o) return;
    res.json(orderOut(o, req.user.id));
  });

  // Alıcı: havaleyi yaptım
  app.post('/api/market/orders/:id/paid', auth, (req, res) => {
    const o = mine(req, res); if (!o) return;
    if (o.buyerId !== req.user.id || o.status !== 'odeme_bekliyor') return res.status(409).json({ error: 'Bu adım şu an yapılamaz.' });
    const sender = String(req.body?.sender || '').trim().slice(0, 60);
    const iban = String(req.body?.iban || '').replace(/\s+/g, '').toUpperCase();
    if (sender.length < 3) return res.status(400).json({ error: 'Gönderen ad soyadını yaz.' });
    if (!/^TR\d{24}$/.test(iban)) return res.status(400).json({ error: 'İade gerekirse kullanılacak IBAN geçersiz (TR ile başlayan 26 karakter).' });
    res.json(orderOut(save(o, { status: 'odeme_kontrol', sender, buyerIban: iban, paidClaimAt: now() }, `Alıcı ödemeyi yaptığını bildirdi (${sender}).`, 'buyer'), req.user.id));
  });

  // Satıcı: kargoya verdim (takip kodu + paketin içi ve dışı fotoğrafları)
  app.post('/api/market/orders/:id/ship', auth, (req, res) => {
    const o = mine(req, res); if (!o) return;
    if (o.sellerId !== req.user.id || o.status !== 'odendi') return res.status(409).json({ error: 'Ödeme onaylanmadan kargolama yapılamaz.' });
    const carrier = CARRIERS.find((c) => c.id === req.body?.carrier);
    const tracking = String(req.body?.tracking || '').replace(/\s+/g, '').slice(0, 40);
    const inside = media(req.body?.inside, 4); const outside = media(req.body?.outside, 4);
    if (!carrier) return res.status(400).json({ error: 'Kargo firmasını seç.' });
    if (tracking.length < 5) return res.status(400).json({ error: 'Kargo takip kodunu yaz.' });
    if (!inside.length) return res.status(400).json({ error: 'Paketin içinin fotoğrafını çek (ürün kutuda görünecek şekilde).' });
    if (!outside.length) return res.status(400).json({ error: 'Kapalı paketin dışının fotoğrafını çek (kargo etiketi görünecek şekilde).' });
    save(o, { status: 'kargoda', carrier: carrier.id, carrierOther: carrier.id === 'diger' ? String(req.body?.carrierOther || '').slice(0, 40) : null, tracking, packInside: inside, packOutside: outside, shippedAt: now() }, `Satıcı kargoya verdi · ${carrier.name} ${tracking}`, 'seller');
    tell(o.buyerId, `📦 "${o.title}" kargoya verildi. Takip kodu: ${tracking}`, o);
    chatNote(o, `📦 "${o.title}" kargoya verildi · ${carrier.name} · ${tracking}`);
    res.json(orderOut(o, req.user.id));
  });

  // Elden teslim: iki taraf da teslim anında fotoğraf çeker
  app.post('/api/market/orders/:id/handover', auth, (req, res) => {
    const o = mine(req, res); if (!o) return;
    const r = role(o, req.user.id);
    const photos = media(req.body?.photos, 4);
    if (o.method !== 'elden' || !['bulusma', 'teslim_onay'].includes(o.status)) return res.status(409).json({ error: 'Bu adım şu an yapılamaz.' });
    if (!photos.length) return res.status(400).json({ error: 'Teslim anında ürünün fotoğrafını çekmek zorunlu.' });
    if (r === 'seller') {
      if (o.sellerPhoto) return res.status(409).json({ error: 'Teslim fotoğrafını zaten yükledin.' });
      save(o, { status: 'teslim_onay', sellerPhoto: photos, handedAt: now() }, 'Satıcı ürünü teslim ettiğini fotoğrafla bildirdi.', 'seller');
      tell(o.buyerId, `🤝 Satıcı "${o.title}" ürününü teslim ettiğini bildirdi. Ürünün fotoğrafını çekip teslim aldığını onayla.`, o);
      return res.json(orderOut(o, req.user.id));
    }
    // alıcı: teslim aldım (fotoğrafla)
    if (o.status !== 'teslim_onay') return res.status(409).json({ error: 'Önce satıcının teslim ettiğini bildirmesi gerekiyor.' });
    o.buyerPhoto = photos;
    store.update('mk_orders', o.id, { buyerPhoto: photos });
    complete(o, 'Alıcı ürünü fotoğrafla teslim aldı.', 'buyer');
    res.json(orderOut(o, req.user.id));
  });

  // Alıcı: kargoyu teslim aldım → emanet satıcıya geçer
  app.post('/api/market/orders/:id/received', auth, (req, res) => {
    const o = mine(req, res); if (!o) return;
    if (o.buyerId !== req.user.id || o.status !== 'kargoda') return res.status(409).json({ error: 'Bu adım şu an yapılamaz.' });
    complete(o, 'Alıcı ürünü teslim aldığını onayladı; ödeme satıcıya aktarıldı.', 'buyer');
    res.json(orderOut(o, req.user.id));
  });

  // Alıcı: sorun var
  app.post('/api/market/orders/:id/problem', auth, (req, res) => {
    const o = mine(req, res); if (!o) return;
    if (o.buyerId !== req.user.id || !['kargoda', 'teslim_onay'].includes(o.status)) return res.status(409).json({ error: 'Bu sipariş için şu an sorun bildirilemez.' });
    const kind = PROBLEMS[req.body?.kind] ? req.body.kind : 'diger';
    const text = String(req.body?.text || '').trim().slice(0, 1000);
    const photos = media(req.body?.photos, 6);
    if (text.length < 10) return res.status(400).json({ error: 'Sorunu birkaç cümleyle anlat.' });
    save(o, { status: 'sorunlu', problem: { kind, text, photos, at: now(), prev: o.status } }, `Alıcı sorun bildirdi: ${PROBLEMS[kind]}`, 'buyer');
    tell(o.sellerId, `⚠️ "${o.title}" siparişi için alıcı sorun bildirdi. SwipeUp ekibi inceleyecek.`, o);
    res.json(orderOut(o, req.user.id));
  });

  // İptal
  app.post('/api/market/orders/:id/cancel', auth, (req, res) => {
    const o = mine(req, res); if (!o) return;
    const r = role(o, req.user.id);
    const reason = String(req.body?.reason || '').trim().slice(0, 300);
    const s = settings();
    if (['odeme_bekliyor', 'bulusma'].includes(o.status)) {
      save(o, { status: 'iptal', closedAt: now(), cancelReason: reason }, `${r === 'buyer' ? 'Alıcı' : 'Satıcı'} siparişi iptal etti.${reason ? ' ' + reason : ''}`, r);
      setItem(o.itemId, 'active');
      tell(r === 'buyer' ? o.sellerId : o.buyerId, `"${o.title}" siparişi ${r === 'buyer' ? 'alıcı' : 'satıcı'} tarafından iptal edildi.`, o);
      return res.json(orderOut(o, req.user.id));
    }
    // Ödenmiş ama kargolanmamış: satıcı her zaman, alıcı süre dolunca iptal edebilir → iade
    if (o.status === 'odendi' && (r === 'seller' || now() > o.paidAt + s.shipDays * DAY)) {
      save(o, { status: 'iade_bekliyor', cancelReason: reason || (r === 'seller' ? 'Satıcı gönderemedi' : 'Satıcı süresinde kargolamadı') }, `${r === 'buyer' ? 'Alıcı' : 'Satıcı'} siparişi iptal etti; ödeme alıcıya iade edilecek.`, r);
      setItem(o.itemId, 'active');
      tell(r === 'buyer' ? o.sellerId : o.buyerId, `"${o.title}" siparişi iptal edildi. Ödeme alıcıya iade edilecek.`, o);
      return res.json(orderOut(o, req.user.id));
    }
    res.status(409).json({ error: o.status === 'odendi' ? `Satıcının kargolaması için süre (${s.shipDays} gün) dolmadan iptal edemezsin.` : 'Bu aşamada sipariş iptal edilemez. Sorun varsa "Sorun var" ile bildir.' });
  });

  // Değerlendirme
  app.post('/api/market/orders/:id/rate', auth, (req, res) => {
    const o = mine(req, res); if (!o) return;
    if (o.buyerId !== req.user.id || o.status !== 'tamamlandi' || o.rating) return res.status(409).json({ error: 'Bu sipariş değerlendirilemez.' });
    const rating = Math.max(1, Math.min(5, parseInt(req.body?.rating, 10) || 0));
    const review = moderation.mask(String(req.body?.review || '').trim().slice(0, 400));
    store.update('mk_orders', o.id, { rating, review, ratedAt: now() });
    const s = store.get('users', o.sellerId);
    if (s) { const r = s.mkRating || { sum: 0, n: 0 }; store.update('users', s.id, { mkRating: { sum: r.sum + rating, n: r.n + 1 } }); }
    tell(o.sellerId, `⭐ "${o.title}" için ${rating} yıldız aldın.`, o);
    res.json(orderOut(store.get('mk_orders', o.id), req.user.id));
  });

  // ---------- Satıcı bakiyesi ----------
  app.post('/api/market/payout', auth, (req, res) => {
    const s = settings();
    const amount = tl(req.user.mkBalance || 0);
    const iban = String(req.body?.iban || '').replace(/\s+/g, '').toUpperCase();
    const name = String(req.body?.name || '').trim().slice(0, 60);
    if (amount < s.minPayout) return res.status(400).json({ error: `Ödeme talebi için en az ${s.minPayout} ₺ bakiyen olmalı.` });
    if (!/^TR\d{24}$/.test(iban)) return res.status(400).json({ error: 'IBAN geçersiz (TR ile başlayan 26 karakter).' });
    if (name.length < 3) return res.status(400).json({ error: 'Hesap sahibinin adını yaz.' });
    if (store.find('payouts', (p) => p.userId === req.user.id && p.status === 'pending' && p.kind === 'store')) return res.status(409).json({ error: 'Bekleyen bir Store ödeme talebin var.' });
    store.update('users', req.user.id, { mkBalance: 0 });
    res.json(store.put('payouts', { id: nanoid(10), kind: 'store', userId: req.user.id, coins: 0, amount, iban, name, status: 'pending', at: now() }));
  });
  app.get('/api/market/balance', auth, (req, res) => {
    res.json({
      balance: req.user.mkBalance || 0, minPayout: settings().minPayout,
      pending: tl(store.filter('mk_orders', (o) => o.sellerId === req.user.id && o.method === 'kargo' && ['odendi', 'kargoda', 'sorunlu'].includes(o.status)).reduce((a, o) => a + o.amount, 0)),
      payouts: store.filter('payouts', (p) => p.userId === req.user.id && p.kind === 'store').sort((a, b) => b.at - a.at).slice(0, 10),
    });
  });

  // ---------- Otomatik teslim onayı ----------
  setInterval(() => {
    const s = settings(); const t = now();
    store.filter('mk_orders', (o) => o.status === 'kargoda' && o.shippedAt + s.autoDays * DAY < t).forEach((o) => complete(o, `Alıcı ${s.autoDays} gün içinde sorun bildirmediği için teslim otomatik onaylandı.`, 'system'));
    // ödenmemiş siparişler 3 gün sonra düşer
    store.filter('mk_orders', (o) => o.status === 'odeme_bekliyor' && o.at + 3 * DAY < t).forEach((o) => {
      save(o, { status: 'iptal', closedAt: t, cancelReason: 'Ödeme 3 gün içinde yapılmadı' }, 'Ödeme yapılmadığı için sipariş otomatik iptal edildi.', 'system');
      setItem(o.itemId, 'active');
    });
  }, 15 * 60000).unref();

  // ================= Yönetim =================
  const adminCtx = {
    CATEGORIES, ST, OPEN, settings, orderOut, sellerInfo, cardOut,
    adminAction(o, action, note, admin) {
      const by = `@${admin.username}`;
      if (action === 'confirm_payment' && o.status === 'odeme_kontrol') {
        save(o, { status: 'odendi', paidAt: now(), confirmedBy: admin.username }, `Ödeme SwipeUp hesabına ulaştı ve emanete alındı (${by}).`, 'admin');
        tell(o.sellerId, `💰 "${o.title}" için ödeme SwipeUp güvencesinde. ${settings().shipDays} gün içinde paketin içini ve dışını fotoğraflayıp kargoya ver.`, o);
        tell(o.buyerId, `✅ Ödemen onaylandı. "${o.title}" ürününün kargolanması bekleniyor.`, o);
        chatNote(o, `💰 Ödeme onaylandı, SwipeUp güvencesinde bekliyor. Satıcı kargolayabilir.`);
        return true;
      }
      if (action === 'reject_payment' && o.status === 'odeme_kontrol') {
        save(o, { status: 'odeme_bekliyor', paymentNote: note || 'Ödeme hesabımıza ulaşmadı.' }, `Ödeme bulunamadı (${by}).${note ? ' ' + note : ''}`, 'admin');
        tell(o.buyerId, `"${o.title}" için ödemen bulunamadı.${note ? ' ' + note : ''} Açıklamaya ${o.code} yazdığından emin ol.`, o);
        return true;
      }
      if (action === 'release' && ['sorunlu', 'kargoda', 'teslim_onay'].includes(o.status)) {
        complete(o, `SwipeUp ekibi siparişi satıcı lehine sonuçlandırdı (${by}).${note ? ' ' + note : ''}`, 'admin');
        return true;
      }
      if (action === 'refund' && ['sorunlu', 'odendi', 'kargoda', 'odeme_kontrol'].includes(o.status)) {
        if (o.method === 'elden') {
          save(o, { status: 'iptal', closedAt: now(), cancelReason: note || 'Ekip kararıyla iptal' }, `SwipeUp ekibi siparişi iptal etti (${by}).${note ? ' ' + note : ''}`, 'admin');
        } else {
          save(o, { status: 'iade_bekliyor', refundNote: note }, `SwipeUp ekibi alıcıya iade kararı verdi (${by}).${note ? ' ' + note : ''}`, 'admin');
        }
        setItem(o.itemId, 'active');
        tell(o.buyerId, o.method === 'elden' ? `"${o.title}" siparişi iptal edildi.` : `"${o.title}" siparişin için iade kararı verildi. Ödemen ${o.buyerIban ? 'bildirdiğin IBAN’a' : 'hesabına'} gönderilecek.`, o);
        tell(o.sellerId, `"${o.title}" siparişi ${o.method === 'elden' ? 'iptal edildi' : 'alıcıya iade edildi'}.${note ? ' ' + note : ''}`, o);
        return true;
      }
      if (action === 'refunded' && o.status === 'iade_bekliyor') {
        save(o, { status: 'iade_edildi', closedAt: now(), refundedBy: admin.username }, `${o.amount} ₺ alıcıya iade edildi (${by}).`, 'admin');
        tell(o.buyerId, `💸 "${o.title}" için ${o.amount} ₺ iaden hesabına gönderildi.`, o);
        return true;
      }
      return false;
    },
  };
  if (ctx.admin?.adminAuth) {
    const { adminAuth, owner, audit } = ctx.admin;
    const fullOrder = (o) => ({
      ...orderOut(o, null), buyer: brief(store.get('users', o.buyerId)), seller: sellerInfo(o.sellerId),
      buyerIban: o.buyerIban || null, sender: o.sender || null, address: o.address || null,
    });
    const TABS = {
      action: (o) => ['odeme_kontrol', 'sorunlu', 'iade_bekliyor'].includes(o.status),
      emanet: (o) => ['odendi', 'kargoda'].includes(o.status),
      elden: (o) => o.method === 'elden' && OPEN.includes(o.status),
      bekleyen: (o) => o.status === 'odeme_bekliyor',
      biten: (o) => ['tamamlandi', 'iade_edildi', 'iptal'].includes(o.status),
      tumu: () => true,
    };
    app.get('/api/admin/market', adminAuth, (req, res) => {
      const tab = TABS[req.query.tab] ? req.query.tab : 'action';
      const q = String(req.query.q || '').toLowerCase().trim();
      const all = store.all('mk_orders');
      const held = all.filter((o) => o.method === 'kargo' && ['odendi', 'kargoda', 'sorunlu', 'iade_bekliyor'].includes(o.status));
      const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
      const done = all.filter((o) => o.status === 'tamamlandi' && o.doneAt >= month.getTime());
      const list = all.filter(TABS[tab]).filter((o) => !q || `${o.code} ${o.title} ${store.get('users', o.buyerId)?.username || ''} ${store.get('users', o.sellerId)?.username || ''} ${o.tracking || ''}`.toLowerCase().includes(q))
        .sort((a, b) => b.at - a.at).slice(0, 200);
      res.json({
        stats: {
          active: store.filter('mk_items', (i) => i.status === 'active').length,
          heldTL: tl(held.reduce((x, o) => x + o.amount, 0)), heldCount: held.length,
          monthTL: tl(done.reduce((x, o) => x + o.amount, 0)), monthCount: done.length,
          balancesTL: tl(store.all('users').reduce((x, u) => x + (u.mkBalance || 0), 0)),
          payoutsPending: store.filter('payouts', (p) => p.kind === 'store' && p.status === 'pending').length,
          counts: Object.fromEntries(Object.keys(TABS).map((k) => [k, all.filter(TABS[k]).length])),
        },
        settings: settings(), orders: list.map(fullOrder),
      });
    });
    app.post('/api/admin/market/orders/:id', adminAuth, (req, res) => {
      const o = store.get('mk_orders', req.params.id);
      if (!o) return res.status(404).json({ error: 'Sipariş bulunamadı.' });
      const note = String(req.body?.note || '').trim().slice(0, 300);
      if (!adminCtx.adminAction(o, String(req.body?.action || ''), note, req.admin)) return res.status(409).json({ error: 'Bu işlem siparişin şu anki durumunda yapılamaz.' });
      audit(req.admin, `Store siparişi: ${req.body.action}`, o.buyerId, `${o.code} · ${o.amount} ₺${note ? ' · ' + note : ''}`);
      res.json(fullOrder(store.get('mk_orders', o.id)));
    });
    app.get('/api/admin/market/items', adminAuth, (req, res) => {
      const q = String(req.query.q || '').toLocaleLowerCase('tr-TR').trim();
      const st = String(req.query.status || 'active');
      res.json(store.filter('mk_items', (i) => (st === 'all' || i.status === st) && (!q || `${i.title} ${i.desc} ${store.get('users', i.sellerId)?.username || ''}`.toLocaleLowerCase('tr-TR').includes(q)))
        .sort((a, b) => b.at - a.at).slice(0, 200)
        .map((i) => ({ ...cardOut(i, null), desc: i.desc, category: i.category, views: i.views || 0, favCount: (i.favs || []).length, seller: sellerInfo(i.sellerId), reports: store.filter('reports', (r) => r.refKind === 'listing' && r.ref === i.id && r.status === 'open').length })));
    });
    app.post('/api/admin/market/items/:id/remove', adminAuth, (req, res) => {
      const it = store.get('mk_items', req.params.id);
      if (!it || it.status === 'removed') return res.status(404).json({ error: 'İlan bulunamadı.' });
      if (it.status === 'reserved') return res.status(409).json({ error: 'Bu ilanın açık siparişi var; önce siparişi sonuçlandır.' });
      const reason = String(req.body?.reason || '').trim().slice(0, 300);
      store.update('mk_items', it.id, { status: 'removed', removedAt: now(), removedBy: req.admin.username, removeReason: reason });
      store.filter('reports', (r) => r.refKind === 'listing' && r.ref === it.id && r.status === 'open').forEach((r) => store.update('reports', r.id, { status: 'resolved', resolvedAt: now() }));
      notify(it.sellerId, { type: 'market', text: `"${it.title}" ilanın topluluk kurallarına uymadığı için kaldırıldı.${reason ? ' ' + reason : ''}`, title: 'SwipeUp Store', url: '/#/market/mine' });
      audit(req.admin, 'Store ilanını kaldırdı', it.sellerId, `${it.title}${reason ? ' · ' + reason : ''}`);
      res.json({ ok: true });
    });
    app.put('/api/admin/market/settings', adminAuth, owner, (req, res) => {
      const b = req.body || {};
      const n = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, +v)) : d);
      const cur = settings();
      const next = { id: 'market', shipDays: n(b.shipDays, 1, 14, cur.shipDays) | 0, autoDays: n(b.autoDays, 2, 30, cur.autoDays) | 0, minPayout: n(b.minPayout, 1, 10000, cur.minPayout) };
      store.put('settings', next);
      audit(req.admin, 'Store ayarlarını güncelledi', null, `kargo ${next.shipDays} gün, otomatik onay ${next.autoDays} gün, en az ödeme ${next.minPayout} ₺`);
      res.json(settings());
    });
  }
  return adminCtx;
};
module.exports.CATEGORIES = CATEGORIES;

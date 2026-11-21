// Uygulama içi satın alma: Google Play (Android uygulaması, Digital Goods API) ve App Store (iOS uygulaması).
// Telefon yalnızca satın alma kimliğini gönderir; sunucu ürünü doğrudan Google / Apple'a sorar, ancak onaylanırsa
// jeton ya da SwipeUp+ tanımlanır. Aynı satın alma iki kez tanımlanamaz. İade edilen Google satın almaları geri alınır.
// Ürün kimlikleri mağaza panellerinde aynen açılmalı: swipeup.<ürün> (ör. swipeup.j100, swipeup.p30). Hepsi tek seferlik
// (tüketilebilir) ürün; SwipeUp+ otomatik yenilenmez.
// Anahtarlar Yönetim → Siparişler → Mağaza içi satın alma bölümünden girilir (meta/secrets.iap), depoya yazılmaz.
const crypto = require('crypto');
const { nanoid } = require('nanoid');

const PFX = 'swipeup.';
const DAY = 86400000;

module.exports = function iap(app, ctx) {
  const { store, auth, eco, notify, emitTo, limited, admin: A } = ctx;
  const now = () => Date.now();
  const GB = process.env.IAP_GOOGLE_BASE || 'https://androidpublisher.googleapis.com';
  const AB = process.env.IAP_APPLE_BASE || 'https://api.storekit.itunes.apple.com';
  const ABS = process.env.IAP_APPLE_SANDBOX || 'https://api.storekit-sandbox.itunes.apple.com';
  const sec = () => store.get('meta', 'secrets')?.iap || {};
  const pkg = () => sec().google?.pkg || process.env.ANDROID_PACKAGE || 'app.swipeup.twa';
  const bundle = () => sec().apple?.bundleId || process.env.IOS_BUNDLE || 'app.swipeup.ios';
  const b64u = (x) => Buffer.from(x).toString('base64url');
  const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });

  // Satılan ürünler: mağazadaki jeton paketleri ve SwipeUp+ süreleri
  const catalog = () => { const s = eco.get(); return [...s.coinPacks.map((p) => ({ sku: PFX + p.id, id: p.id, kind: 'coins', title: `${p.coins} jeton` })), ...s.plusPlans.map((p) => ({ sku: PFX + p.id, id: p.id, kind: 'plus', title: `SwipeUp+ ${p.days} gün` }))]; };
  const bySku = (sku) => catalog().find((c) => c.sku === sku) || null;

  // ---- Google Play Developer API (hizmet hesabı ile) ----
  let gTok = null;
  async function googleToken(sa = sec().google?.sa) {
    if (!sa) throw fail('Google Play hizmet hesabı tanımlı değil.', 503);
    if (gTok && gTok.email === sa.client_email && gTok.exp > now() + 60000) return gTok.t;
    const iat = Math.floor(now() / 1000); const aud = sa.token_uri || 'https://oauth2.googleapis.com/token';
    const unsigned = `${b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64u(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud, iat, exp: iat + 3600 }))}`;
    const sig = crypto.sign('RSA-SHA256', Buffer.from(unsigned), sa.private_key).toString('base64url');
    const r = await fetch(process.env.IAP_GOOGLE_TOKEN || aud, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw fail(`Google girişi başarısız: ${j.error_description || j.error || r.status}`, 502);
    gTok = { t: j.access_token, exp: now() + (j.expires_in || 3600) * 1000, email: sa.client_email }; return gTok.t;
  }
  async function gApi(p, method = 'GET') {
    const t = await googleToken();
    const r = await fetch(`${GB}/androidpublisher/v3/applications/${encodeURIComponent(pkg())}${p}`, { method, headers: { Authorization: `Bearer ${t}`, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) }, body: method === 'POST' ? '{}' : undefined });
    const txt = await r.text(); let j = {}; try { j = txt ? JSON.parse(txt) : {}; } catch { /* boş yanıt */ }
    if (!r.ok) throw fail(r.status === 404 || r.status === 410 ? 'Satın alma Google Play’de bulunamadı.' : `Google Play: ${j.error?.message || r.status}`, r.status === 404 || r.status === 410 ? 400 : 502);
    return j;
  }

  // ---- App Store Server API (uygulama içi satın alma anahtarı ile) ----
  function appleJwt(a = sec().apple) {
    if (!a?.keyId || !a?.issuerId || !a?.key) throw fail('App Store anahtarı tanımlı değil.', 503);
    const iat = Math.floor(now() / 1000);
    const unsigned = `${b64u(JSON.stringify({ alg: 'ES256', kid: a.keyId, typ: 'JWT' }))}.${b64u(JSON.stringify({ iss: a.issuerId, iat, exp: iat + 1800, aud: 'appstoreconnect-v1', bid: a.bundleId || bundle() }))}`;
    return `${unsigned}.${crypto.sign('sha256', Buffer.from(unsigned), { key: a.key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
  }
  async function appleTx(id) { // önce gerçek ortam, bulunamazsa deneme (sandbox) ortamı: Apple incelemesi deneme ortamında satın alır
    for (const base of [AB, ABS]) {
      const r = await fetch(`${base}/inApps/v1/transactions/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${appleJwt()}` } });
      if (r.status === 404) continue;
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw fail(`App Store: ${j.errorMessage || r.status}`, r.status === 401 ? 503 : 502);
      const payload = JSON.parse(Buffer.from(String(j.signedTransactionInfo || '').split('.')[1] || '', 'base64url').toString() || '{}'); // doğrudan Apple'dan (TLS) geldi
      return { ...payload, sandbox: base === ABS };
    }
    throw fail('Satın alma App Store’da bulunamadı.');
  }

  // ---- Tanımlama: aynı satın alma bir kez ----
  const locks = new Map();
  const once = (key, fn) => { if (locks.has(key)) return locks.get(key); const p = Promise.resolve().then(fn).finally(() => locks.delete(key)); locks.set(key, p); return p; };
  const keyOf = (channel, ref) => `${channel}:${crypto.createHash('sha256').update(String(ref)).digest('hex').slice(0, 40)}`;
  function grant(uid, item, channel, ref, extra = {}) {
    const id = keyOf(channel, ref); const ex = store.get('iap', id);
    if (ex) { if (ex.userId !== uid) throw fail('Bu satın alma başka bir hesaba tanımlı.', 409); return { dup: true, order: store.get('orders', ex.orderId) }; }
    const p = eco.product(item.id); if (!p) throw fail('Ürün artık satılmıyor.', 410);
    const by = channel === 'google' ? 'Google Play' : 'App Store';
    const qty = Math.max(1, Math.min(10, parseInt(extra.qty, 10) || 1)); // adetli satın alma (mağaza adedi doğrular)
    const amount = Math.round(p.price * qty * 100) / 100;
    const title = qty > 1 ? `${item.title} × ${qty}` : item.title;
    const o = store.put('orders', { id: nanoid(10), code: `${channel === 'google' ? 'GP' : 'AS'}-${nanoid(8).toUpperCase().replace(/[^A-Z0-9]/g, 'X')}`, userId: uid, productId: item.id, kind: item.kind, title, amount, ...(qty > 1 ? { qty } : {}), ...(item.kind === 'coins' ? { coins: p.coins * qty } : { days: p.days * qty }),
      status: 'approved', channel, test: !!extra.test, at: now(), approvedAt: now(), closedAt: now(), by });
    if (item.kind === 'coins') eco.addCoins(uid, p.coins * qty, 'purchase', { ref: o.id, channel }); else eco.grantPlus(uid, p.days * qty);
    if (!extra.test) {
      const d = new Date(now() + 3 * 3600000).toISOString().slice(0, 10);
      store.put('adm_ledger', { id: nanoid(10), type: 'gelir', amount, date: d, category: item.kind === 'plus' ? 'Abonelik' : 'Uygulama içi satış', note: `${o.code} · ${title} · ${by} · @${store.get('users', uid)?.username || '?'}`, currency: 'TRY', by, auto: true, orderId: o.id, createdAt: now() });
    }
    store.put('iap', { id, userId: uid, sku: item.sku, kind: item.kind, orderId: o.id, channel, test: !!extra.test, status: 'granted', at: now(), ...(extra.token ? { token: extra.token } : {}), ...(extra.storeOrder ? { storeOrder: extra.storeOrder } : {}), ...(extra.tx ? { tx: extra.tx } : {}) });
    notify(uid, { type: 'order', text: item.kind === 'plus' ? '✨ Satın alman tamamlandı! SwipeUp+ üyeliğin aktif.' : `🪙 Satın alman tamamlandı! ${title} hesabına eklendi.`, title: 'SwipeUp', url: '/#/store' });
    emitTo(uid, 'wallet', {});
    return { dup: false, order: o };
  }
  const out = (uid, r) => { const u = store.get('users', uid); return { ok: true, dup: r.dup, coins: u?.coins || 0, plusUntil: u?.plusUntil || null, title: r.order?.title || '', orderId: r.order?.id || null, qty: r.order?.qty || 1 }; };

  // ---- Telefon uç noktaları ----
  app.get('/api/iap/catalog', auth, (req, res) => res.json({ items: catalog(), google: !!sec().google?.sa, apple: !!sec().apple?.key }));
  app.post('/api/iap/google', auth, ctx.wrap(async (req, res) => {
    if (limited(`iapg:${req.user.id}`, 30, 600000)) return res.status(429).json({ error: 'Biraz yavaş.' });
    const sku = String(req.body?.sku || ''); const token = String(req.body?.token || '').slice(0, 600);
    const item = bySku(sku); if (!item || token.length < 10) return res.status(400).json({ error: 'Satın alma bilgisi eksik.' });
    try {
      const r = await once(keyOf('google', token), async () => {
        const ex = store.get('iap', keyOf('google', token)); if (ex) return grant(req.user.id, item, 'google', token);
        const j = await gApi(`/purchases/products/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(token)}`);
        if (j.purchaseState !== 0) throw fail(j.purchaseState === 2 ? 'Ödeme henüz tamamlanmadı. Tamamlanınca jetonların eklenecek.' : 'Bu satın alma iptal edilmiş.');
        if (j.consumptionState === 1) throw fail('Bu satın alma daha önce kullanılmış.', 409);
        const g = grant(req.user.id, item, 'google', token, { test: j.purchaseType === 0, token, storeOrder: j.orderId, qty: j.quantity || 1 });
        gApi(`/purchases/products/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(token)}:consume`, 'POST').catch((e) => console.error('[iap] tüketme', e.message)); // yeniden satın alınabilsin
        return g;
      });
      res.json(out(req.user.id, r));
    } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  }));
  app.post('/api/iap/apple', auth, ctx.wrap(async (req, res) => {
    if (limited(`iapa:${req.user.id}`, 30, 600000)) return res.status(429).json({ error: 'Biraz yavaş.' });
    const tid = String(req.body?.transactionId || '').replace(/[^\d]/g, '').slice(0, 40);
    if (tid.length < 5) return res.status(400).json({ error: 'Satın alma bilgisi eksik.' });
    try {
      const r = await once(keyOf('apple', tid), async () => {
        const ex = store.get('iap', keyOf('apple', tid)); if (ex) return grant(req.user.id, bySku(ex.sku) || { id: '', sku: ex.sku }, 'apple', tid);
        const t = await appleTx(tid);
        if (t.bundleId !== bundle()) throw fail('Bu satın alma SwipeUp’a ait değil.');
        if (t.revocationDate) throw fail('Bu satın alma iade edilmiş.');
        const item = bySku(t.productId); if (!item) throw fail('Ürün bulunamadı.');
        return grant(req.user.id, item, 'apple', tid, { test: !!t.sandbox, storeOrder: t.originalTransactionId, qty: t.quantity || 1, tx: tid });
      });
      res.json(out(req.user.id, r));
    } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  }));

  // ---- Mağaza iadesi (Google Play ve App Store): jeton ya da üyelik geri alınır ----
  // Harcanmış jetonlar borç olarak yazılır (eco.chargeBack); harcanan jetonlar başkasına kazanç olarak gittiyse
  // Yönetim → Siparişler → İade incelemeleri'ne kayıt düşer (kazanç ödemesinden önce kontrol edilsin).
  function refund(doc, by) {
    if (!doc || doc.status === 'refunded') return null;
    const o = store.get('orders', doc.orderId); const u = store.get('users', doc.userId);
    store.update('iap', doc.id, { status: 'refunded', refundedAt: now() });
    if (!u) return null;
    let cb = { taken: 0, debt: 0 }; let days = 0;
    if (doc.kind === 'coins' && o?.coins) cb = eco.chargeBack(u.id, o.coins, { ref: o.id, channel: doc.channel });
    if (doc.kind === 'plus') { const p = eco.product(o?.productId); days = o?.days || (p?.days || 0) * (o?.qty || 1); if (days) store.update('users', u.id, { plusUntil: Math.max(now(), (u.plusUntil || 0) - days * DAY) }); }
    if (o) store.update('orders', o.id, { status: 'refunded', note: `${by} iadesi`, refundedAt: now(), ...(doc.kind === 'coins' ? { refundTaken: cb.taken, refundDebt: cb.debt } : {}) });
    if (o && !o.test) {
      const d = new Date(now() + 3 * 3600000).toISOString().slice(0, 10);
      store.put('adm_ledger', { id: nanoid(10), type: 'gider', amount: o.amount, date: d, category: 'Satış iadesi', note: `${o.code} · ${o.title} · ${by} iadesi · @${u.username}`, currency: 'TRY', by, auto: true, orderId: o.id, createdAt: now() });
    }
    // Harcanmış jeton başka birine kazanç olarak gittiyse inceleme kaydı
    if (cb.debt > 0) {
      const map = new Map();
      store.filter('earn_tx', (t) => t.fromId === u.id && t.at >= (o?.at || 0)).forEach((t) => map.set(t.userId, Math.round(((map.get(t.userId) || 0) + t.coins) * 100) / 100));
      const recipients = [...map].map(([userId, amount]) => ({ userId, amount })).sort((a, b) => b.amount - a.amount).slice(0, 30);
      store.put('refund_reviews', { id: nanoid(10), userId: u.id, orderId: o?.id || null, channel: doc.channel, title: o?.title || '', coins: o?.coins || 0, taken: cb.taken, debt: cb.debt, recipients, status: recipients.length ? 'open' : 'info', at: now() });
    }
    const left = cb.debt > 0 ? ` Harcadığın ${cb.debt} jeton borç olarak yazıldı; borç kapanana kadar jeton harcayamazsın, yeni jetonların önce bu borcu kapatır.` : '';
    notify(u.id, { type: 'order', text: `${o?.title || 'Satın alman'} ${by} üzerinden iade edildi; hesabından düşüldü.${left}`, title: 'SwipeUp', url: '/#/store' });
    emitTo(u.id, 'wallet', {});
    return cb;
  }
  ctx.iapRefund = refund;
  async function voided() {
    if (!sec().google?.sa) return;
    const s = store.get('meta', 'iap_void') || { id: 'iap_void', since: now() - 25 * DAY };
    const j = await gApi(`/purchases/voidedpurchases?startTime=${s.since}&maxResults=1000`);
    for (const v of j.voidedPurchases || []) refund(store.get('iap', keyOf('google', v.purchaseToken)), 'Google Play');
    store.put('meta', { ...s, since: now() - DAY, at: now() });
  }
  // App Store: iade bildirimi (App Store Server Notifications V2) — içerik güvenilmez, satın alma Apple'a yeniden sorulur
  const jwsBody = (x) => { try { return JSON.parse(Buffer.from(String(x || '').split('.')[1] || '', 'base64url').toString() || '{}'); } catch { return {}; } };
  async function appleCheck(tid) {
    const doc = store.get('iap', keyOf('apple', tid)); if (!doc || doc.status === 'refunded') return false;
    const t = await appleTx(tid); if (!t.revocationDate) return false;
    refund(doc, 'App Store'); return true;
  }
  app.post('/api/iap/apple/notify', ctx.wrap(async (req, res) => {
    if (limited(`apn:${ctx.ipOf ? ctx.ipOf(req) : req.ip}`, 120, 600000)) return res.status(429).json({ error: 'Biraz yavaş.' });
    const n = jwsBody(req.body?.signedPayload);
    if (['REFUND', 'REVOKE'].includes(n.notificationType)) {
      const tid = String(jwsBody(n.data?.signedTransactionInfo).transactionId || '').replace(/[^\d]/g, '').slice(0, 40);
      if (tid && sec().apple?.key) await appleCheck(tid).catch((e) => console.error('[iap] apple iade', e.message));
    }
    res.json({ ok: true }); // Apple 200 bekler; tanınmayan bildirimler de onaylanır
  }));
  // Bildirim ayarlanmamışsa: son 90 günün App Store satın almaları 12 saatte bir Apple'a sorulur
  async function appleSweep() {
    if (!sec().apple?.key) return;
    const list = store.filter('iap', (x) => x.channel === 'apple' && x.status === 'granted' && now() - x.at < 90 * DAY).sort((a, b) => (a.checkedAt || 0) - (b.checkedAt || 0)).slice(0, 300);
    for (const x of list) {
      const o = store.get('orders', x.orderId); const tid = o?.storeTx || x.tx; if (!tid) continue;
      try { await appleCheck(tid); store.update('iap', x.id, { checkedAt: now() }); } catch (e) { console.error('[iap] apple kontrol', e.message); break; } // eslint-disable-line no-await-in-loop
    }
  }
  const ta = setInterval(() => appleSweep().catch((e) => console.error('[iap] apple iade kontrolü', e.message)), 12 * 3600000); ta.unref?.();
  const tv = setInterval(() => voided().catch((e) => console.error('[iap] iade kontrolü', e.message)), 6 * 3600000); tv.unref?.();

  // ---- Yönetim: iade incelemeleri (Siparişler yetkisi) ----
  const rvOut = (r) => { const u = store.get('users', r.userId);
    return { ...r, user: u ? { id: u.id, username: u.username, name: u.name, coins: u.coins || 0, debt: u.coinDebt || 0 } : null,
      recipients: (r.recipients || []).map((x) => { const v = store.get('users', x.userId); return { ...x, username: v?.username || '?', earnings: v?.earnings || 0, payoutPending: !!store.find('payouts', (p) => p.userId === x.userId && p.status === 'pending') }; }) }; };
  app.get('/api/admin/refundreviews', A.adminAuth, (req, res) => {
    const st = String(req.query.status || 'open');
    const list = store.filter('refund_reviews', (r) => st === 'all' || r.status === st).sort((a, b) => b.at - a.at).slice(0, 100);
    res.json({ items: list.map(rvOut), open: store.filter('refund_reviews', (r) => r.status === 'open').length });
  });
  app.post('/api/admin/refundreviews/:id', A.adminAuth, (req, res) => {
    const r = store.get('refund_reviews', req.params.id); if (!r) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
    const act = String(req.body?.action || '');
    if (act === 'deduct') { // alıcının bekleyen kazancından düş (ödenmiş kısım geri alınamaz)
      const x = (r.recipients || []).find((y) => y.userId === String(req.body?.userId || '')); if (!x) return res.status(400).json({ error: 'Alıcı bulunamadı.' });
      if (x.deducted != null) return res.status(409).json({ error: 'Bu alıcıdan zaten düşüldü.' });
      const v = store.get('users', x.userId); const want = Math.max(0, Math.min(+req.body?.amount || x.amount, x.amount));
      const cut = Math.round(Math.min(v?.earnings || 0, want) * 100) / 100;
      if (v && cut > 0) { store.update('users', v.id, { earnings: Math.round(((v.earnings || 0) - cut) * 100) / 100 }); store.put('earn_tx', { id: nanoid(12), userId: v.id, coins: -cut, reason: 'refund_clawback', fromId: r.userId, at: now(), ref: r.id }); notify(v.id, { type: 'order', text: `Kazancından ${(cut * eco.get().coinTL).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺ düşüldü: sana gönderilen hediyelerin bir kısmı, gönderen kişinin mağaza iadesiyle geri alındı.`, title: 'SwipeUp', url: '/#/wallet' }); }
      x.deducted = cut; x.deductedAt = now();
      store.update('refund_reviews', r.id, { recipients: r.recipients });
      A.audit?.(req.admin, 'iade incelemesi: kazançtan düştü', x.userId, `${cut} · ${r.title}`);
      return res.json(rvOut(store.get('refund_reviews', r.id)));
    }
    if (act === 'close') {
      store.update('refund_reviews', r.id, { status: 'closed', closedAt: now(), note: String(req.body?.note || '').slice(0, 300), by: req.admin.username });
      A.audit?.(req.admin, 'iade incelemesini kapattı', r.userId, r.title);
      return res.json(rvOut(store.get('refund_reviews', r.id)));
    }
    if (act === 'forgive') { // jeton borcunu sil
      const u = store.get('users', r.userId); if (u) store.update('users', u.id, { coinDebt: 0 });
      A.audit?.(req.admin, 'jeton borcunu sildi', r.userId, `${u?.coinDebt || 0}`);
      return res.json(rvOut(store.get('refund_reviews', r.id)));
    }
    res.status(400).json({ error: 'Geçersiz işlem.' });
  });

  // ---- Yönetim (yalnız sahip) ----
  const gate = [A.adminAuth, A.owner];
  const audit = (req, text, det) => A.audit?.(req.admin, text, null, det);
  const status = () => { const g = sec().google; const a = sec().apple; const list = store.filter('iap', () => true).sort((x, y) => y.at - x.at);
    return { skus: catalog(), google: { on: !!g?.sa, pkg: pkg(), email: g?.sa?.client_email || null, at: g?.at || null }, apple: { on: !!a?.key, bundleId: bundle(), keyId: a?.keyId || null, issuerId: a?.issuerId || null, at: a?.at || null },
      count: list.length, recent: list.slice(0, 15).map((x) => ({ at: x.at, channel: x.channel, sku: x.sku, test: x.test, status: x.status, user: store.get('users', x.userId)?.username || '?' })) }; };
  app.get('/api/admin/iap', ...gate, (req, res) => res.json(status()));
  app.post('/api/admin/iap/google', ...gate, ctx.wrap(async (req, res) => {
    let sa; try { sa = JSON.parse(String(req.body?.json || '')); } catch { return res.status(400).json({ error: 'Hizmet hesabı dosyasının (JSON) içeriğini olduğu gibi yapıştır.' }); }
    if (sa.type !== 'service_account' || !sa.client_email || !sa.private_key) return res.status(400).json({ error: 'Bu bir Google hizmet hesabı anahtarı değil (type: service_account olmalı).' });
    const p = String(req.body?.pkg || pkg()).trim(); if (!/^[a-z][\w]*(\.[a-z][\w]*)+$/i.test(p)) return res.status(400).json({ error: 'Paket adı geçersiz (ör. app.swipeup.twa).' });
    try { gTok = null; await googleToken({ client_email: sa.client_email, private_key: sa.private_key, token_uri: sa.token_uri }); } catch (e) { return res.status(400).json({ error: e.message }); }
    store.update('meta', 'secrets', { iap: { ...sec(), google: { sa: { client_email: sa.client_email, private_key: sa.private_key, token_uri: sa.token_uri }, pkg: p, at: now() } } });
    audit(req, 'Google Play satın alma anahtarını kaydetti', sa.client_email); res.json(status());
  }));
  app.post('/api/admin/iap/apple', ...gate, (req, res) => {
    const b = req.body || {}; const a = { keyId: String(b.keyId || '').trim(), issuerId: String(b.issuerId || '').trim(), key: String(b.key || '').trim(), bundleId: String(b.bundleId || bundle()).trim() };
    if (!/^[A-Z0-9]{10}$/.test(a.keyId)) return res.status(400).json({ error: 'Anahtar kimliği (Key ID) 10 karakter olmalı.' });
    if (!/^[0-9a-f-]{36}$/i.test(a.issuerId)) return res.status(400).json({ error: 'Issuer ID geçersiz.' });
    try { crypto.createPrivateKey(a.key); appleJwt(a); } catch { return res.status(400).json({ error: '.p8 anahtar dosyasının içeriğini (BEGIN PRIVATE KEY satırlarıyla) yapıştır.' }); }
    store.update('meta', 'secrets', { iap: { ...sec(), apple: { ...a, at: now() } } });
    audit(req, 'App Store satın alma anahtarını kaydetti', a.keyId); res.json(status());
  });
  app.delete('/api/admin/iap/:kind', ...gate, (req, res) => {
    const k = req.params.kind === 'apple' ? 'apple' : 'google'; store.update('meta', 'secrets', { iap: { ...sec(), [k]: null } }); if (k === 'google') gTok = null;
    audit(req, `${k === 'google' ? 'Google Play' : 'App Store'} satın alma anahtarını kaldırdı`); res.json(status());
  });
  ctx.iap = { catalog, enabled: () => ({ google: !!sec().google?.sa, apple: !!sec().apple?.key }), google: { token: () => googleToken(), pkg, on: () => !!sec().google?.sa } }; // google: Play ürün eşitlemesi (server/playsync.js) aynı hizmet hesabını kullanır
};

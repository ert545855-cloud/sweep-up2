// App Store Connect eşitlemesi: jeton paketleri ve SwipeUp+ süreleri App Store'da uygulama içi ürün (Consumable) olarak
// açılır, Türkçe adı/açıklaması yazılır ve fiyatı yönetim panelindeki fiyattan (isteğe bağlı fark yüzdesiyle) ayarlanır.
// Panelde fiyat değişince (ya da kampanya başlayıp bitince) App Store fiyatı kendiliğinden güncellenir.
// Anahtar: App Store Connect → Kullanıcılar ve Erişim → Entegrasyonlar → Ekip Anahtarları (rol: Uygulama Yöneticisi ya da Yönetici).
// Bu, satın alma doğrulamasındaki "Uygulama İçi Satın Alma" anahtarından ayrıdır. Anahtar meta/secrets.asc'ta durur, depoya yazılmaz.
const crypto = require('crypto');
const express = require('express');

const BASE = process.env.ASC_BASE || 'https://api.appstoreconnect.apple.com';
const PFX = 'swipeup.';
const TERR = 'TUR'; // fiyatların temel ülkesi: diğer ülkeler Apple'ın kur eşitlemesiyle hesaplanır
const LOCALE = 'tr';

module.exports = function ascsync(app, ctx) {
  const { store, eco, admin: A } = ctx;
  const now = () => Date.now();
  const sec = () => store.get('meta', 'secrets')?.asc || null;
  const setSec = (v) => { if (!store.get('meta', 'secrets')) store.put('meta', { id: 'secrets' }); store.update('meta', 'secrets', { asc: v }); };
  const st = () => ({ markup: 0, auto: true, synced: {}, ...(store.get('meta', 'ascsync') || {}), id: 'ascsync' });
  const saveSt = (p) => store.put('meta', { ...st(), ...p, id: 'ascsync' });
  const bundle = () => store.get('meta', 'secrets')?.iap?.apple?.bundleId || process.env.IOS_BUNDLE || 'app.swipeup.ios';
  const b64u = (x) => Buffer.from(x).toString('base64url');
  const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });

  function jwt(a = sec()) {
    if (!a?.keyId || !a?.issuerId || !a?.key) throw fail('App Store Connect anahtarı tanımlı değil.', 503);
    const iat = Math.floor(now() / 1000);
    const unsigned = `${b64u(JSON.stringify({ alg: 'ES256', kid: a.keyId, typ: 'JWT' }))}.${b64u(JSON.stringify({ iss: a.issuerId, iat, exp: iat + 1100, aud: 'appstoreconnect-v1' }))}`;
    return `${unsigned}.${crypto.sign('sha256', Buffer.from(unsigned), { key: a.key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
  }
  async function call(path, { method = 'GET', body, key } = {}) {
    const url = /^https?:\/\//.test(path) ? path : BASE + path;
    if (!url.startsWith(BASE)) throw fail('Beklenmeyen adres.');
    const r = await fetch(url, { method, headers: { Authorization: `Bearer ${jwt(key)}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const txt = await r.text(); let j = {}; try { j = txt ? JSON.parse(txt) : {}; } catch { /* boş yanıt */ }
    if (!r.ok) {
      const e = j.errors?.[0];
      const msg = r.status === 401 ? 'anahtar reddedildi (Key ID, Issuer ID ve .p8 içeriğini kontrol et)' : r.status === 403 ? 'anahtarın yetkisi yetmiyor (rolü Uygulama Yöneticisi ya da Yönetici olmalı)' : (e?.detail || e?.title || `hata ${r.status}`);
      throw fail(`App Store Connect: ${msg}`, r.status >= 500 ? 502 : 400);
    }
    return j;
  }
  async function all(path) { // sayfalı listeler
    const out = []; let next = path;
    for (let i = 0; next && i < 30; i++) { const j = await call(next); out.push(...(j.data || [])); next = j.links?.next || null; } // eslint-disable-line no-await-in-loop
    return out;
  }
  async function appId(key) {
    const a = key || sec();
    if (a?.appId && !key) return a.appId;
    const j = await call(`/v1/apps?filter[bundleId]=${encodeURIComponent(bundle())}&limit=1`, { key: a });
    const id = j.data?.[0]?.id;
    if (!id) throw fail(`App Store Connect'te ${bundle()} paket kimlikli uygulama bulunamadı.`);
    return id;
  }

  // Satılan ürünler ve App Store metinleri (ad en çok 30, açıklama en çok 45 karakter)
  function items() {
    const s = eco.get(); const m = 1 + (+st().markup || 0) / 100;
    const r2 = (x) => Math.round(x * 100) / 100;
    return [
      ...s.coinPacks.map((p) => ({ sku: PFX + p.id, id: p.id, kind: 'coins', ref: `${p.coins} jeton`, name: `${p.coins} Jeton`.slice(0, 30), desc: `SwipeUp içinde harcanacak ${p.coins} jeton`.slice(0, 45), note: `Satın alınca ${p.coins} jeton hesaba hemen eklenir (Mağaza → Jeton).`, price: eco.product(p.id)?.price ?? p.price })),
      ...s.plusPlans.map((p) => ({ sku: PFX + p.id, id: p.id, kind: 'plus', ref: `SwipeUp+ ${p.days} gün`, name: `SwipeUp+ ${p.days} Gün`.slice(0, 30), desc: `${p.days} gün SwipeUp+, otomatik yenilenmez`.slice(0, 45), note: `Satın alınca ${p.days} gün SwipeUp+ üyeliği hesaba eklenir; otomatik yenilenmez.`, price: eco.product(p.id)?.price ?? p.price })),
    ].map((x) => ({ ...x, target: r2(x.price * m) }));
  }
  // Apple yalnız hazır fiyat basamaklarını kabul eder: hedefe en yakın basamak (eşitlikte düşük olan)
  const nearest = (points, target) => points.reduce((best, p) => { const v = +p.attributes.customerPrice; if (!(v > 0)) return best; const d = Math.abs(v - target); return !best || d < best.d - 1e-9 ? { d, p, v } : best; }, null);

  // Yeni ürünün satılacağı ülkeler: uygulamanın satıldığı ülkeler (okunamazsa Çin hariç hepsi)
  async function territories(aid) {
    try { const t = await all(`/v1/apps/${aid}/availableTerritories?limit=200`); if (t.length) return t.map((x) => x.id); } catch { /* aşağıdaki yedek */ }
    try { const av = await call(`/v1/apps/${aid}/appAvailabilityV2`); const t = await all(`/v2/appAvailabilities/${av.data.id}/territoryAvailabilities?limit=200&include=territory`); const ok = t.filter((x) => x.attributes?.available !== false).map((x) => x.relationships?.territory?.data?.id).filter(Boolean); if (ok.length) return ok; } catch { /* aşağıdaki yedek */ }
    return (await all('/v1/territories?limit=200')).map((x) => x.id).filter((id) => id !== 'CHN');
  }

  async function uploadShot(iapId, shot) {
    const buf = Buffer.from(shot.b64, 'base64');
    const c = await call('/v1/inAppPurchaseAppStoreReviewScreenshots', { method: 'POST', body: { data: { type: 'inAppPurchaseAppStoreReviewScreenshots', attributes: { fileName: shot.name, fileSize: buf.length }, relationships: { inAppPurchaseV2: { data: { type: 'inAppPurchases', id: iapId } } } } } });
    for (const op of c.data.attributes.uploadOperations || []) {
      const r = await fetch(op.url, { method: op.method || 'PUT', headers: Object.fromEntries((op.requestHeaders || []).map((h) => [h.name, h.value])), body: buf.subarray(op.offset || 0, (op.offset || 0) + (op.length || buf.length)) }); // eslint-disable-line no-await-in-loop
      if (!r.ok) throw fail(`Ekran görüntüsü yüklenemedi (${r.status}).`, 502);
    }
    await call(`/v1/inAppPurchaseAppStoreReviewScreenshots/${c.data.id}`, { method: 'PATCH', body: { data: { type: 'inAppPurchaseAppStoreReviewScreenshots', id: c.data.id, attributes: { uploaded: true, sourceFileChecksum: crypto.createHash('md5').update(buf).digest('hex') } } } });
  }

  // Ürün "Eksik bilgi"de kalıyorsa neyin eksik olduğunu Apple'dan oku
  async function missing(iapId) {
    const m = [];
    const chk = async (label, fn) => { try { const r = await fn(); if (r) m.push(r === true ? label : `${label}: ${r}`); } catch (e) { m.push(`${label} okunamadı (${e.message.replace(/^App Store Connect: /, '')})`); } };
    await chk('Türkçe ad/açıklama', async () => !(await all(`/v2/inAppPurchases/${iapId}/inAppPurchaseLocalizations?limit=50`)).length);
    await chk('fiyat', async () => { const j = await call(`/v2/inAppPurchases/${iapId}/iapPriceSchedule`); return !j.data; });
    await chk('ülkeler', async () => { const j = await call(`/v2/inAppPurchases/${iapId}/inAppPurchaseAvailability`); return !j.data; });
    await chk('inceleme görseli', async () => {
      const j = await call(`/v2/inAppPurchases/${iapId}/appStoreReviewScreenshot`);
      if (!j.data) return 'yüklenmemiş';
      const d = j.data.attributes?.assetDeliveryState;
      if (d?.state === 'FAILED') return `Apple reddetti (${(d.errors || []).map((x) => x.description || x.code).join(', ') || 'geçersiz görsel'})`;
      if (d && d.state !== 'COMPLETE') return `Apple işliyor (${d.state})`;
      return false;
    });
    return m;
  }

  // ---- Eşitleme ----
  let running = null; let again = false;
  async function syncOnce(force) {
    const aid = await appId(); const S = st(); const synced = { ...S.synced }; const log = [];
    const list = await all(`/v1/apps/${aid}/inAppPurchasesV2?limit=200`);
    const byPid = new Map(list.map((x) => [x.attributes.productId, x]));
    const shots = { coins: store.get('meta', 'ascshot'), plus: store.get('meta', 'ascshot_plus') || store.get('meta', 'ascshot') }; // SwipeUp+ görseli yoksa jetonunki kullanılır
    let terr = null;
    for (const it of items()) {
      const rec = { ...(synced[it.sku] || {}) }; const done = [];
      try {
        let iap = byPid.get(it.sku);
        if (!iap) {
          iap = (await call('/v2/inAppPurchases', { method: 'POST', body: { data: { type: 'inAppPurchases', attributes: { name: it.ref, productId: it.sku, inAppPurchaseType: 'CONSUMABLE', reviewNote: it.note, familySharable: false }, relationships: { app: { data: { type: 'apps', id: aid } } } } } })).data;
          done.push('oluşturuldu'); rec.iap = iap.id; delete rec.target; delete rec.text; delete rec.shot;
          try {
            terr = terr || await territories(aid);
            await call('/v1/inAppPurchaseAvailabilities', { method: 'POST', body: { data: { type: 'inAppPurchaseAvailabilities', attributes: { availableInNewTerritories: true }, relationships: { inAppPurchase: { data: { type: 'inAppPurchases', id: iap.id } }, availableTerritories: { data: terr.map((id) => ({ type: 'territories', id })) } } } } });
          } catch (e) { done.push(`ülkeler ayarlanamadı: ${e.message}`); }
        }
        rec.iap = iap.id; rec.state = iap.attributes?.state || rec.state || null;
        // Türkçe ad ve açıklama
        const text = `${it.name}|${it.desc}`;
        if (force || rec.text !== text) {
          const locs = await all(`/v2/inAppPurchases/${iap.id}/inAppPurchaseLocalizations?limit=50`);
          const tr = locs.find((l) => String(l.attributes.locale || '').toLowerCase().startsWith(LOCALE));
          if (!tr) { await call('/v1/inAppPurchaseLocalizations', { method: 'POST', body: { data: { type: 'inAppPurchaseLocalizations', attributes: { locale: LOCALE, name: it.name, description: it.desc }, relationships: { inAppPurchaseV2: { data: { type: 'inAppPurchases', id: iap.id } } } } } }); done.push('Türkçe metin yazıldı'); }
          else if (tr.attributes.name !== it.name || tr.attributes.description !== it.desc) { await call(`/v1/inAppPurchaseLocalizations/${tr.id}`, { method: 'PATCH', body: { data: { type: 'inAppPurchaseLocalizations', id: tr.id, attributes: { name: it.name, description: it.desc } } } }); done.push('Türkçe metin güncellendi'); }
          rec.text = text;
        }
        // Fiyat
        if (force || rec.target !== it.target || !rec.pp) {
          const points = await all(`/v2/inAppPurchases/${iap.id}/pricePoints?filter[territory]=${TERR}&limit=200`);
          const n = nearest(points, it.target);
          if (!n) throw fail('Türkiye için fiyat basamağı bulunamadı.');
          if (force || n.p.id !== rec.pp) {
            await call('/v1/inAppPurchasePriceSchedules', { method: 'POST', body: { data: { type: 'inAppPurchasePriceSchedules', relationships: { inAppPurchase: { data: { type: 'inAppPurchases', id: iap.id } }, baseTerritory: { data: { type: 'territories', id: TERR } }, manualPrices: { data: [{ type: 'inAppPurchasePrices', id: '${p0}' }] } } }, included: [{ type: 'inAppPurchasePrices', id: '${p0}', attributes: { startDate: null }, relationships: { inAppPurchasePricePoint: { data: { type: 'inAppPurchasePricePoints', id: n.p.id } } } }] } });
            done.push(`fiyat ₺${n.v.toFixed(2).replace('.', ',')}`);
          }
          Object.assign(rec, { target: it.target, pp: n.p.id, apple: n.v });
        }
        // İnceleme ekran görüntüsü (panelden bir kez yüklenir, her ürüne eklenir)
        const shot = shots[it.kind];
        if (shot?.b64 && rec.shot !== shot.hash) {
          let has = false;
          try { const cur = (await call(`/v2/inAppPurchases/${iap.id}/appStoreReviewScreenshot`)).data; if (cur) await call(`/v1/inAppPurchaseAppStoreReviewScreenshots/${cur.id}`, { method: 'DELETE' }); } catch { /* yoksa doğrudan yüklenir */ } // görsel değişti: eskisi (ya da reddedileni) silinir
          if (!has) { await uploadShot(iap.id, shot); done.push('inceleme görseli yüklendi'); }
          rec.shot = shot.hash;
        }
        rec.miss = await missing(iap.id);
        rec.err = null;
      } catch (e) { rec.err = e.message; done.push(`HATA: ${e.message}`); }
      synced[it.sku] = rec; saveSt({ synced });
      log.push({ sku: it.sku, text: done.length ? done.join(' · ') : 'değişiklik yok', err: !!rec.err });
    }
    // Güncel durumlar (Hazır / Eksik bilgi / Onaylandı ...)
    try { const fresh = await all(`/v1/apps/${aid}/inAppPurchasesV2?limit=200`); for (const x of fresh) if (synced[x.attributes.productId]) synced[x.attributes.productId].state = x.attributes.state; } catch { /* durum okunamazsa eskisi kalır */ }
    saveSt({ synced, last: { at: now(), ok: !log.some((l) => l.err), log } });
  }
  function sync(force = false) {
    if (running) { again = true; return running; }
    running = syncOnce(force).catch((e) => { saveSt({ last: { at: now(), ok: false, log: [{ sku: '', text: e.message, err: true }] } }); console.error('[asc] eşitleme', e.message); })
      .finally(() => { running = null; if (again) { again = false; sync(); } });
    return running;
  }
  // Panelde fiyat değişince birkaç saniye sonra eşitle; kampanya başlangıç/bitişi için 3 saatte bir kontrol
  let tmr = null;
  const soon = () => { if (!sec() || !st().auto) return; clearTimeout(tmr); tmr = setTimeout(() => sync(), 5000); tmr.unref?.(); };
  eco.onSave?.(soon);
  const tick = setInterval(() => { if (sec() && st().auto && items().some((it) => st().synced[it.sku]?.target !== it.target)) sync(); }, 3 * 3600000); tick.unref?.();

  // ---- Yönetim (yalnız sahip) ----
  const gate = [A.adminAuth, A.owner];
  const audit = (req, text, det) => A.audit?.(req.admin, text, null, det);
  const STATE = { MISSING_METADATA: 'Eksik bilgi', READY_TO_SUBMIT: 'Gönderime hazır', WAITING_FOR_REVIEW: 'İncelemede', IN_REVIEW: 'İncelemede', APPROVED: 'Onaylandı', DEVELOPER_ACTION_NEEDED: 'Düzeltme gerekli', REJECTED: 'Reddedildi', PENDING_BINARY_APPROVAL: 'Uygulamayla incelenecek', DEVELOPER_REMOVED_FROM_SALE: 'Satıştan kaldırıldı', REMOVED_FROM_SALE: 'Satıştan kaldırıldı' };
  const status = () => {
    const a = sec(); const S = st(); const sh = (x) => (x ? { name: x.name, at: x.at, size: x.w ? `${x.w}×${x.h}` : null } : null);
    return { on: !!a?.key, keyId: a?.keyId || null, issuerId: a?.issuerId || null, appId: a?.appId || null, bundleId: bundle(), at: a?.at || null, markup: +S.markup || 0, auto: S.auto !== false, running: !!running,
      shot: sh(store.get('meta', 'ascshot')), shotPlus: sh(store.get('meta', 'ascshot_plus')), last: S.last || null,
      items: items().map((it) => { const r = S.synced[it.sku] || {}; return { sku: it.sku, title: it.ref, price: it.price, target: it.target, apple: r.apple ?? null, state: r.state ? (STATE[r.state] || r.state) : null, stateKey: r.state || null, err: r.err || null, miss: r.state === 'MISSING_METADATA' ? (r.miss || []) : [], pending: r.target !== it.target }; }) };
  };
  app.get('/api/admin/asc', ...gate, (req, res) => res.json(status()));
  app.post('/api/admin/asc/key', ...gate, ctx.wrap(async (req, res) => {
    const b = req.body || {}; const a = { keyId: String(b.keyId || '').trim(), issuerId: String(b.issuerId || '').trim(), key: String(b.key || '').trim() };
    if (!/^[A-Z0-9]{10}$/.test(a.keyId)) return res.status(400).json({ error: 'Anahtar kimliği (Key ID) 10 karakter olmalı.' });
    if (!/^[0-9a-f-]{36}$/i.test(a.issuerId)) return res.status(400).json({ error: 'Issuer ID geçersiz.' });
    try { crypto.createPrivateKey(a.key); jwt(a); } catch { return res.status(400).json({ error: '.p8 anahtar dosyasının içeriğini (BEGIN PRIVATE KEY satırlarıyla) yapıştır.' }); }
    a.appId = await appId(a); // anahtar burada denenir
    setSec({ ...a, at: now() }); audit(req, 'App Store Connect anahtarını kaydetti', a.keyId);
    res.json(status());
  }));
  app.delete('/api/admin/asc/key', ...gate, (req, res) => { setSec(null); audit(req, 'App Store Connect anahtarını kaldırdı'); res.json(status()); });
  app.post('/api/admin/asc/settings', ...gate, (req, res) => {
    const b = req.body || {}; const p = {};
    if (b.markup !== undefined) { const m = +b.markup; if (!(m >= 0 && m <= 100)) return res.status(400).json({ error: 'Fark yüzdesi 0 ile 100 arasında olmalı.' }); p.markup = Math.round(m * 10) / 10; }
    if (b.auto !== undefined) p.auto = !!b.auto;
    saveSt(p); audit(req, 'App Store fiyat ayarını değiştirdi', JSON.stringify(p)); if (p.markup !== undefined) soon();
    res.json(status());
  });
  // İnceleme görseli: telefon ekran görüntüsü olduğu gibi (küçültmeden) gelir; Apple yalnız cihaz ekran boyutlarını kabul eder
  const dims = (buf) => {
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), t: 'png' };
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      for (let i = 2; i + 9 < buf.length;) {
        if (buf[i] !== 0xff) { i++; continue; }
        const m = buf[i + 1]; const len = buf.readUInt16BE(i + 2);
        if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5), t: 'jpg' };
        i += 2 + len;
      }
    }
    return null;
  };
  const SIZES = ['1320x2868', '1290x2796', '1260x2736', '1206x2622', '1179x2556', '1284x2778', '1242x2688', '1170x2532', '1125x2436', '1080x2340', '1242x2208', '750x1334', '640x1136', '2064x2752', '2048x2732', '1668x2388', '1640x2360', '1668x2224', '1536x2048'];
  app.post('/api/admin/asc/shot', ...gate, express.raw({ type: ['image/png', 'image/jpeg'], limit: '10mb' }), (req, res) => {
    const buf = Buffer.isBuffer(req.body) ? req.body : null;
    const d = buf && dims(buf);
    if (!d) return res.status(400).json({ error: 'PNG ya da JPG bir ekran görüntüsü seç.' });
    const okSize = SIZES.some((x) => { const [w, h] = x.split('x').map(Number); return (d.w === w && d.h === h) || (d.w === h && d.h === w); });
    if (!okSize) return res.status(400).json({ error: `Bu görsel ${d.w}×${d.h}; Apple telefonun kendi ekran görüntüsünü ister (ör. 1179×2556). Düzenlenmemiş, kırpılmamış bir ekran görüntüsü seç.` });
    store.put('meta', { id: req.query?.kind === 'plus' ? 'ascshot_plus' : 'ascshot', b64: buf.toString('base64'), name: `inceleme.${d.t}`, hash: crypto.createHash('sha1').update(buf).digest('hex'), w: d.w, h: d.h, at: now() });
    audit(req, 'App Store inceleme görselini yükledi', `${req.query?.kind === 'plus' ? 'SwipeUp+' : 'jeton'} ${d.w}x${d.h}`); soon(); res.json(status());
  });
  app.post('/api/admin/asc/sync', ...gate, (req, res) => {
    if (!sec()) return res.status(400).json({ error: 'Önce App Store Connect anahtarını kaydet.' });
    sync(!!req.body?.force); audit(req, 'App Store ürünlerini eşitledi'); res.json(status());
  });
  ctx.asc = { sync, status };
};

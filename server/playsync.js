// Google Play eşitlemesi: jeton paketleri ve SwipeUp+ süreleri Play Console'da tek seferlik ürün (one-time product) olarak
// açılır, Türkçe adı/açıklaması yazılır ve fiyatı yönetim panelindeki fiyattan (isteğe bağlı fark yüzdesiyle) ayarlanır;
// diğer ülkelerin fiyatı Google'ın kur çevirisiyle hesaplanır. Panelde fiyat değişince Play fiyatı kendiliğinden güncellenir.
// Anahtar: Ayarlar → Mağaza içi satın alma → Google Play (hizmet hesabı; satın alma doğrulamasıyla aynı). Hizmet hesabına
// Play Console'da "Mağaza varlığını yönetme" (ürünler) izni de verilmeli.
const BASE = process.env.IAP_GOOGLE_BASE || 'https://androidpublisher.googleapis.com';
const PFX = 'swipeup.';
const OPT = 'satin-al';
const REGIONS = (process.env.PLAY_REGIONS_VERSION || '2022/02,2025/03').split(',');

module.exports = function playsync(app, ctx) {
  const { store, eco, admin: A } = ctx;
  const now = () => Date.now();
  const G = () => ctx.iap?.google;
  const st = () => ({ markup: 0, auto: true, synced: {}, ...(store.get('meta', 'playsync') || {}), id: 'playsync' });
  const saveSt = (p) => store.put('meta', { ...st(), ...p, id: 'playsync' });
  const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });

  async function call(path, { method = 'GET', body } = {}) {
    const t = await G().token();
    const r = await fetch(`${BASE}/androidpublisher/v3/applications/${encodeURIComponent(G().pkg())}${path}`, { method, headers: { Authorization: `Bearer ${t}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const txt = await r.text(); let j = {}; try { j = txt ? JSON.parse(txt) : {}; } catch { /* boş yanıt */ }
    if (!r.ok) {
      const m = j.error?.message || `hata ${r.status}`;
      const msg = r.status === 401 ? 'hizmet hesabı reddedildi' : r.status === 403 ? `hizmet hesabının yetkisi yok (Play Console → Kullanıcılar ve izinler → bu hesaba "Mağaza varlığını yönetme" ve "Finansal verileri görüntüleme" ver): ${m}` : m;
      throw Object.assign(fail(`Google Play: ${msg}`, r.status >= 500 ? 502 : 400), { code: r.status, raw: m });
    }
    return j;
  }
  const money = (cur, v) => { const units = Math.floor(v); return { currencyCode: cur, units: String(units), nanos: Math.round((v - units) * 1e9) }; };
  const val = (m) => (m ? (+m.units || 0) + (m.nanos || 0) / 1e9 : null);

  function items() {
    const s = eco.get(); const m = 1 + (+st().markup || 0) / 100;
    const r2 = (x) => Math.round(x * 100) / 100;
    return [
      ...s.coinPacks.map((p) => ({ sku: PFX + p.id, ref: `${p.coins} jeton`, title: `${p.coins} Jeton`, desc: `SwipeUp içinde harcanacak ${p.coins} jeton. Satın alınca hesabına hemen eklenir.`, price: eco.product(p.id)?.price ?? p.price })),
      ...s.plusPlans.map((p) => ({ sku: PFX + p.id, ref: `SwipeUp+ ${p.days} gün`, title: `SwipeUp+ ${p.days} Gün`, desc: `${p.days} gün SwipeUp+ üyeliği: sınırsız beğeni, seni kimlerin beğendiğini görme ve daha fazlası. Otomatik yenilenmez.`, price: eco.product(p.id)?.price ?? p.price })),
    ].map((x) => ({ ...x, target: r2(x.price * m) }));
  }

  // Tek ürün: fiyatı Türkiye için birebir, diğer ülkeler için Google'ın çevirisi
  async function upsert(it, rec, force) {
    const done = [];
    let cur = null;
    try { cur = await call(`/onetimeproducts/${encodeURIComponent(it.sku)}`); } catch (e) { if (e.code !== 404) throw e; }
    const existed = !!cur;
    const opt = cur?.purchaseOptions?.find((o) => o.buyOption?.legacyCompatible) || cur?.purchaseOptions?.[0] || null;
    const optId = opt?.purchaseOptionId || OPT;
    const text = `${it.title}|${it.desc}`;
    const needPrice = force || !cur || rec.target !== it.target || !opt;
    const needText = force || !cur || rec.text !== text;
    if (needPrice || needText) {
      let regional = opt?.regionalPricingAndAvailabilityConfigs || []; let fresh = opt?.newRegionsConfig;
      if (needPrice) {
        const c = await call('/pricing:convertRegionPrices', { method: 'POST', body: { price: money('TRY', it.target) } });
        regional = Object.values(c.convertedRegionPrices || {}).map((x) => ({ regionCode: x.regionCode, price: x.regionCode === 'TR' ? money('TRY', it.target) : x.price, availability: 'AVAILABLE' }));
        if (!regional.some((x) => x.regionCode === 'TR')) regional.push({ regionCode: 'TR', price: money('TRY', it.target), availability: 'AVAILABLE' });
        const o = c.convertedOtherRegionsPrice; fresh = o?.usdPrice && o?.eurPrice ? { usdPrice: o.usdPrice, eurPrice: o.eurPrice, availability: 'AVAILABLE' } : undefined;
      }
      const body = { packageName: G().pkg(), productId: it.sku, listings: [{ languageCode: 'tr-TR', title: it.title.slice(0, 55), description: it.desc.slice(0, 200) }],
        purchaseOptions: [{ purchaseOptionId: optId, buyOption: { legacyCompatible: true, multiQuantityEnabled: true }, regionalPricingAndAvailabilityConfigs: regional, ...(fresh ? { newRegionsConfig: fresh } : {}) }] };
      let lastErr = null; let ok = false;
      for (const v of [st().regions, ...REGIONS].filter((x, i, a) => x && a.indexOf(x) === i)) { // bölge sürümü Google'da değişebilir: kabul edileni hatırlanır
        try { cur = await call(`/onetimeproducts/${encodeURIComponent(it.sku)}?updateMask=listings,purchaseOptions&allowMissing=true&regionsVersion.version=${encodeURIComponent(v)}`, { method: 'PATCH', body }); if (st().regions !== v) saveSt({ regions: v }); ok = true; break; } // eslint-disable-line no-await-in-loop
        catch (e) { lastErr = e; if (!/region/i.test(e.raw || '')) throw e; }
      }
      if (!ok) throw lastErr;
      if (!existed) done.push('oluşturuldu');
      if (needText) { rec.text = text; done.push('Türkçe metin yazıldı'); }
      if (needPrice) { rec.target = it.target; rec.play = it.target; done.push(`fiyat ₺${it.target.toFixed(2).replace('.', ',')}`); }
    }
    const o2 = cur?.purchaseOptions?.find((x) => x.purchaseOptionId === optId);
    if (o2 && o2.state !== 'ACTIVE') {
      await call(`/oneTimeProducts/${encodeURIComponent(it.sku)}/purchaseOptions:batchUpdateStates`, { method: 'POST', body: { requests: [{ activatePurchaseOptionRequest: { packageName: G().pkg(), productId: it.sku, purchaseOptionId: optId } }] } });
      done.push('satışa açıldı'); rec.state = 'ACTIVE';
    } else if (o2) rec.state = o2.state;
    return done.filter(Boolean);
  }

  let running = null; let again = false;
  async function syncOnce(force) {
    if (!G()?.on()) throw fail('Önce Google Play hizmet hesabını kaydet (Ayarlar → Mağaza içi satın alma).');
    const synced = { ...st().synced }; const log = [];
    for (const it of items()) {
      const rec = { ...(synced[it.sku] || {}) }; let done = [];
      try { done = await upsert(it, rec, force); rec.err = null; } catch (e) { rec.err = e.message; done = [`HATA: ${e.message}`]; } // eslint-disable-line no-await-in-loop
      synced[it.sku] = rec; saveSt({ synced });
      log.push({ sku: it.sku, text: done.length ? done.join(' · ') : 'değişiklik yok', err: !!rec.err });
      if (rec.err && /yetki|reddedildi|bulunamadı|not found/i.test(rec.err) && log.length === 1) break; // hesap sorunu: diğer ürünleri denemeye gerek yok
    }
    saveSt({ last: { at: now(), ok: !log.some((l) => l.err), log } });
  }
  function sync(force = false) {
    if (running) { again = true; return running; }
    running = syncOnce(force).catch((e) => { saveSt({ last: { at: now(), ok: false, log: [{ sku: '', text: e.message, err: true }] } }); console.error('[play] eşitleme', e.message); })
      .finally(() => { running = null; if (again) { again = false; sync(); } });
    return running;
  }
  let tmr = null;
  const soon = () => { if (!G()?.on() || !st().auto) return; clearTimeout(tmr); tmr = setTimeout(() => sync(), 6000); tmr.unref?.(); };
  eco.onSave?.(soon);
  const tick = setInterval(() => { if (G()?.on() && st().auto && items().some((it) => st().synced[it.sku]?.target !== it.target)) sync(); }, 3 * 3600000); tick.unref?.();

  // ---- Yönetim (yalnız sahip) ----
  const gate = [A.adminAuth, A.owner];
  const audit = (req, text, det) => A.audit?.(req.admin, text, null, det);
  const STATE = { ACTIVE: 'Satışta', DRAFT: 'Taslak', INACTIVE: 'Kapalı', INACTIVE_PUBLISHED: 'Kapalı' };
  const status = () => {
    const S = st();
    return { on: !!G()?.on(), pkg: G()?.pkg?.() || null, markup: +S.markup || 0, auto: S.auto !== false, running: !!running, last: S.last || null,
      items: items().map((it) => { const r = S.synced[it.sku] || {}; return { sku: it.sku, title: it.ref, price: it.price, target: it.target, play: r.play ?? null, state: r.state ? (STATE[r.state] || r.state) : null, stateKey: r.state || null, err: r.err || null, pending: r.target !== it.target }; }) };
  };
  app.get('/api/admin/play', ...gate, (req, res) => res.json(status()));
  app.post('/api/admin/play/settings', ...gate, (req, res) => {
    const b = req.body || {}; const p = {};
    if (b.markup !== undefined) { const m = +b.markup; if (!(m >= 0 && m <= 100)) return res.status(400).json({ error: 'Fark yüzdesi 0 ile 100 arasında olmalı.' }); p.markup = Math.round(m * 10) / 10; }
    if (b.auto !== undefined) p.auto = !!b.auto;
    saveSt(p); audit(req, 'Google Play fiyat ayarını değiştirdi', JSON.stringify(p)); if (p.markup !== undefined) soon();
    res.json(status());
  });
  app.post('/api/admin/play/sync', ...gate, (req, res) => {
    if (!G()?.on()) return res.status(400).json({ error: 'Önce Google Play hizmet hesabını kaydet (yukarıdaki “Mağaza içi satın alma” bölümü).' });
    sync(!!req.body?.force); audit(req, 'Google Play ürünlerini eşitledi'); res.json(status());
  });
  ctx.play = { sync, status };
};

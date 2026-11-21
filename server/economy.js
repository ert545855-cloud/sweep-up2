// Jeton, SwipeUp+ ve mağaza ayarları. Ayarlar 'settings' koleksiyonunda ('economy') durur,
// yönetim panelinden değiştirilir.
const DAY = 86400000;

const DEFAULTS = {
  bank: { iban: '', name: '', bankName: '', note: 'Açıklama kısmına sipariş kodunu yazmayı unutma.' },
  // 1 jeton = 1 TL
  coinPacks: [
    { id: 'j50', coins: 50, price: 50 },
    { id: 'j100', coins: 100, price: 100 },
    { id: 'j250', coins: 250, price: 250 },
    { id: 'j500', coins: 500, price: 500 },
    { id: 'j1000', coins: 1000, price: 1000 },
  ],
  plusPlans: [
    { id: 'p30', days: 30, price: 99.99 },
    { id: 'p90', days: 90, price: 249.99, tag: '%16 avantajlı' },
    { id: 'p365', days: 365, price: 599.99, tag: '%50 avantajlı' },
  ],
  superPacks: [ // jetonla süper beğeni (günlük hakka ek, süresi dolmaz)
    { id: 's5', n: 5, coins: 40 },
    { id: 's15', n: 15, coins: 100, tag: 'Avantajlı' },
  ],
  gifts: [
    { id: 'gul', em: '🌹', name: 'Gül', coins: 1 },
    { id: 'kalp', em: '💜', name: 'Kalp', coins: 3 },
    { id: 'kahve', em: '☕️', name: 'Kahve', coins: 6 },
    { id: 'yildiz', em: '🌟', name: 'Yıldız', coins: 12 },
    { id: 'tac', em: '👑', name: 'Taç', coins: 40 },
    { id: 'yuzuk', em: '💍', name: 'Yüzük', coins: 60 },
    { id: 'roket', em: '🚀', name: 'Roket', coins: 75 },
    { id: 'elmas', em: '💎', name: 'Elmas', coins: 125 },
  ],
  falPrices: { kahve: 10, tarot: 8, burc: 5, uyum: 8, ruya: 6 },
  boostCoins: 20,
  boostMinutes: 30,
  freeLikes: 50,
  freeSupers: 1,
  plusSupers: 5,
  creatorShare: 0.6, // hediye edilen her (satın alınmış) 1 jetondan yayıncıya kalan pay: 0,60 ₺
  falciShare: 0.7, // ücretli faldan Falcı Teyze'ye kalan pay
  coinTL: 1, // 1 kazanç biriminin ödeme karşılığı (₺); kazanç artık doğrudan TL olarak tutulur
  superMsgCoins: 8, // eşleşmeden süper mesaj
  inviteCoins: 12, // davet eden ve edilene
  falSubCoins: 60, // Falcı Teyze aylık aboneliği
  plusTrialDays: 3, // yeni üyelere SwipeUp+ denemesi (gün, 0 = kapalı)
};

module.exports = function economy(store) {
  // Kayıtlı plan listesinde yıllık plan yoksa bir kez ekle (yönetim sonradan silerse yeniden eklenmez)
  setTimeout(() => {
    const s = store.get('settings', 'economy');
    if (s && Array.isArray(s.plusPlans) && !s.yearPlanAdded && !s.plusPlans.some((p) => p.days >= 365)) store.put('settings', { ...s, plusPlans: [...s.plusPlans, { id: 'p365', days: 365, price: 599.99, tag: '%50 avantajlı' }], yearPlanAdded: true });
  }, 3000);
  // Reklam yönetmeliği: "indirim" yalnızca son 30 gündeki en düşük fiyata göre gerçek bir fiyat düşüşü için kullanılabilir.
  // Uzun plan etiketleri bu yüzden aylık plana göre gerçek fiyattan hesaplanan "avantajlı" oranıyla gösterilir (aşağı yuvarlanır, abartılmaz).
  const honestPlans = (plans) => {
    const base = plans.find((p) => +p.days === 30) || [...plans].sort((a, b) => a.days - b.days)[0];
    if (!base) return plans;
    return plans.map((p) => {
      if (!/indirim|avantaj/i.test(p.tag || '') || p === base) return p;
      const save = Math.floor(Math.round((1 - (p.price / p.days) / (base.price / base.days)) * 10000) / 100);
      return { ...p, tag: save > 0 ? `%${save} avantajlı` : '' };
    });
  };
  // İndirimli satış (Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği): kampanyada "eski fiyat" olarak yalnızca indirimden
  // önceki son 30 günde uygulanan EN DÜŞÜK fiyat gösterilebilir. Bunun için her ürünün günlük fiyatı saklanır (price_history).
  const ymd = (t = Date.now()) => new Date(t + 3 * 3600000).toISOString().slice(0, 10); // Türkiye saati
  const saleOn = (p, t = Date.now()) => p.salePrice > 0 && p.salePrice < p.price && p.saleUntil && ymd(t) <= p.saleUntil && (!p.saleFrom || ymd(t) >= p.saleFrom);
  const lowestBefore = (id, fromDay) => {
    const h = store.get('price_history', id)?.days || {};
    const start = ymd(new Date(fromDay + 'T12:00:00+03:00').getTime() - 30 * DAY);
    const vals = Object.entries(h).filter(([d]) => d >= start && d < fromDay).map(([, v]) => v);
    return vals.length ? Math.min(...vals) : null;
  };
  const withSale = (p) => {
    if (!saleOn(p)) return { ...p, now: p.price, was: undefined, off: undefined };
    const was = lowestBefore(p.id, p.saleFrom || ymd());
    const off = was && was > p.salePrice ? Math.floor(Math.round((1 - p.salePrice / was) * 10000) / 100) : 0; // aşağı yuvarlanır, abartılmaz
    return { ...p, now: p.salePrice, was: off > 0 ? was : undefined, off: off > 0 ? off : undefined };
  };
  const get = () => {
    const s = store.get('settings', 'economy') || {};
    const out = { ...DEFAULTS, ...s, bank: { ...DEFAULTS.bank, ...(s.bank || {}) }, falPrices: { ...DEFAULTS.falPrices, ...(s.falPrices || {}) } };
    return { ...out, plusPlans: honestPlans(out.plusPlans || []).map(withSale), coinPacks: (out.coinPacks || []).map((p) => withSale(p.tag === 'Popüler' ? { ...p, tag: undefined } : p)) }; // kanıtlanamayan "popüler" iddiası gösterilmez
  };
  // Günlük fiyat kaydı: o gün uygulanan en düşük fiyat (61 gün tutulur)
  function snapshot() {
    const s = get(); const d = ymd();
    for (const p of [...s.coinPacks, ...s.plusPlans]) {
      const h = store.get('price_history', p.id) || { id: p.id, days: {} };
      const cur = h.days[d];
      if (cur === undefined || p.now < cur) {
        const days = { ...h.days, [d]: p.now };
        const cut = ymd(Date.now() - 61 * DAY);
        for (const k of Object.keys(days)) if (k < cut) delete days[k];
        store.put('price_history', { id: p.id, days });
      }
    }
  }
  setTimeout(snapshot, 4000); setInterval(snapshot, 3600000).unref?.();
  const priceHistory = (id) => store.get('price_history', id)?.days || {};
  const saveHooks = []; const onSave = (fn) => saveHooks.push(fn); // ör. App Store fiyat eşitlemesi
  const save = (patch) => { const r = store.put('settings', { ...(store.get('settings', 'economy') || {}), ...patch, id: 'economy' }); snapshot(); saveHooks.forEach((fn) => { try { fn(patch); } catch (e) { console.error('[economy] kayıt kancası', e.message); } }); return r; };
  const isPlus = (u) => !!u && (u.plusUntil || 0) > Date.now();
  const today = () => new Date().toISOString().slice(0, 10);

  // Jeton hareketi (her harekette kayıt düşer)
  // Bakiyenin satın alınmış kısmı (paid) ayrıca tutulur: kazanca (TL'ye) yalnızca satın alınmış jeton dönüşür,
  // böylece bedava ödül jetonları sahte hesaplarla paraya çevrilemez.
  function addCoins(userId, delta, reason, extra = {}) {
    let u = store.get('users', userId);
    if (!u) return null;
    // Jeton borcu (mağaza iadesinde harcanmış jetonlar): yeni gelen jeton önce borcu kapatır
    if (delta > 0 && (u.coinDebt || 0) > 0 && reason !== 'debt_pay') {
      const pay = Math.min(delta, u.coinDebt);
      u = store.update('users', userId, { coinDebt: u.coinDebt - pay });
      store.put('coin_tx', { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, userId, delta: 0, debtPaid: pay, reason: 'debt_pay', at: Date.now(), ...(extra.ref ? { ref: extra.ref } : {}) });
      delta -= pay;
      if (delta <= 0) return u.coins || 0;
    }
    const coins = Math.max(0, (u.coins || 0) + delta);
    let paid = Math.min(u.paid || 0, coins);
    if (delta > 0 && reason === 'purchase') paid = Math.min(coins, (u.paid || 0) + delta);
    else if (delta > 0 && extra.paidBack > 0) paid = Math.min(coins, (u.paid || 0) + Math.min(delta, extra.paidBack)); // iade: satın alınmış kısım geri gelir
    store.update('users', userId, { coins, paid });
    store.put('coin_tx', { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, userId, delta, reason, at: Date.now(), ...extra });
    return coins;
  }
  // Dönen: false (yetmedi) ya da { paid: harcanan satın alınmış jeton }.
  // paidFirst: hediyelerde önce satın alınmış jeton harcanır (yayıncı kazansın); diğer harcamalarda önce bedava jeton.
  function spend(userId, amount, reason, extra = {}, opts = {}) {
    const u = store.get('users', userId);
    if (!u || (u.coins || 0) < amount) return false;
    if ((u.coinDebt || 0) > 0 && amount > 0) return false; // iade borcu kapanana kadar jeton harcanamaz
    const paid0 = Math.min(u.paid || 0, u.coins || 0); const bonus0 = (u.coins || 0) - paid0;
    const usePaid = opts.paidFirst ? Math.min(amount, paid0) : Math.max(0, amount - bonus0);
    addCoins(userId, -amount, reason, { ...extra, paid: usePaid });
    store.update('users', userId, { paid: paid0 - usePaid });
    return { paid: usePaid };
  }
  // Mağaza iadesi: bakiyeden alınabilen kadarı alınır, harcanmış kısım borç olarak yazılır. Dönen: { taken, debt }
  function chargeBack(userId, coins, extra = {}) {
    const u = store.get('users', userId); if (!u || !(coins > 0)) return { taken: 0, debt: 0 };
    const taken = Math.min(u.coins || 0, coins); const debt = coins - taken;
    if (taken > 0) addCoins(userId, -taken, 'refund', extra);
    if (debt > 0) {
      store.update('users', userId, { coinDebt: (store.get('users', userId).coinDebt || 0) + debt });
      store.put('coin_tx', { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, userId, delta: 0, debtAdded: debt, reason: 'refund_debt', at: Date.now(), ...extra });
    }
    return { taken, debt };
  }
  // Kazanç TL olarak (kuruş hassasiyetinde) tutulur
  function earn(userId, coins, reason, extra = {}) {
    const u = store.get('users', userId); coins = Math.round((+coins || 0) * 100) / 100;
    if (!u || coins <= 0) return;
    store.update('users', userId, { earnings: Math.round(((u.earnings || 0) + coins) * 100) / 100, earnedTotal: Math.round(((u.earnedTotal || 0) + coins) * 100) / 100 });
    store.put('earn_tx', { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, userId, coins, reason, at: Date.now(), ...extra });
  }
  function grantPlus(userId, days) {
    const u = store.get('users', userId);
    if (!u) return null;
    const base = Math.max(Date.now(), u.plusUntil || 0);
    return store.update('users', userId, { plusUntil: base + days * DAY });
  }
  // Günlük beğeni / süper beğeni sayacı
  function quota(u) {
    const s = get();
    const d = u.daily && u.daily.d === today() ? u.daily : { d: today(), likes: 0, supers: 0 };
    const plus = isPlus(u);
    return {
      d, plus,
      likesLeft: plus ? null : Math.max(0, s.freeLikes - d.likes),
      supersDaily: Math.max(0, (plus ? s.plusSupers : s.freeSupers) - d.supers),
      superBank: u.superBank || 0, // satın alınan süper beğeniler
      supersLeft: Math.max(0, (plus ? s.plusSupers : s.freeSupers) - d.supers) + (u.superBank || 0),
    };
  }
  function product(id) {
    const s = get();
    const c = s.coinPacks.find((p) => p.id === id);
    if (c) return { kind: 'coins', id, title: `${c.coins} jeton`, coins: c.coins, price: c.now, ...(c.was ? { was: c.was, off: c.off, saleUntil: c.saleUntil } : {}) };
    const p = s.plusPlans.find((x) => x.id === id);
    if (p) return { kind: 'plus', id, title: `SwipeUp+ ${p.days} gün`, days: p.days, price: p.now, ...(p.was ? { was: p.was, off: p.off, saleUntil: p.saleUntil } : {}) };
    return null;
  }
  return { DEFAULTS, get, save, onSave, isPlus, addCoins, spend, chargeBack, earn, grantPlus, quota, product, today, priceHistory, lowestBefore, ymd };
};

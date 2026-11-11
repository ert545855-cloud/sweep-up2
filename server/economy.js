// Jeton, SwipeUp+ ve mağaza ayarları. Ayarlar 'settings' koleksiyonunda ('economy') durur,
// yönetim panelinden değiştirilir.
const DAY = 86400000;

const DEFAULTS = {
  bank: { iban: '', name: '', bankName: '', note: 'Açıklama kısmına sipariş kodunu yazmayı unutma.' },
  // 1 jeton = 1 TL
  coinPacks: [
    { id: 'j50', coins: 50, price: 50 },
    { id: 'j100', coins: 100, price: 100 },
    { id: 'j250', coins: 250, price: 250, tag: 'Popüler' },
    { id: 'j500', coins: 500, price: 500 },
    { id: 'j1000', coins: 1000, price: 1000 },
  ],
  plusPlans: [
    { id: 'p30', days: 30, price: 99.99 },
    { id: 'p90', days: 90, price: 249.99, tag: '%17 indirim' },
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
};

module.exports = function economy(store) {
  const get = () => {
    const s = store.get('settings', 'economy') || {};
    return { ...DEFAULTS, ...s, bank: { ...DEFAULTS.bank, ...(s.bank || {}) }, falPrices: { ...DEFAULTS.falPrices, ...(s.falPrices || {}) } };
  };
  const save = (patch) => store.put('settings', { ...(store.get('settings', 'economy') || {}), ...patch, id: 'economy' });
  const isPlus = (u) => !!u && (u.plusUntil || 0) > Date.now();
  const today = () => new Date().toISOString().slice(0, 10);

  // Jeton hareketi (her harekette kayıt düşer)
  // Bakiyenin satın alınmış kısmı (paid) ayrıca tutulur: kazanca (TL'ye) yalnızca satın alınmış jeton dönüşür,
  // böylece bedava ödül jetonları sahte hesaplarla paraya çevrilemez.
  function addCoins(userId, delta, reason, extra = {}) {
    const u = store.get('users', userId);
    if (!u) return null;
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
    const paid0 = Math.min(u.paid || 0, u.coins || 0); const bonus0 = (u.coins || 0) - paid0;
    const usePaid = opts.paidFirst ? Math.min(amount, paid0) : Math.max(0, amount - bonus0);
    addCoins(userId, -amount, reason, { ...extra, paid: usePaid });
    store.update('users', userId, { paid: paid0 - usePaid });
    return { paid: usePaid };
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
      supersLeft: Math.max(0, (plus ? s.plusSupers : s.freeSupers) - d.supers),
    };
  }
  function product(id) {
    const s = get();
    const c = s.coinPacks.find((p) => p.id === id);
    if (c) return { kind: 'coins', id, title: `${c.coins} jeton`, coins: c.coins, price: c.price };
    const p = s.plusPlans.find((x) => x.id === id);
    if (p) return { kind: 'plus', id, title: `SwipeUp+ ${p.days} gün`, days: p.days, price: p.price };
    return null;
  }
  return { DEFAULTS, get, save, isPlus, addCoins, spend, earn, grantPlus, quota, product, today };
};

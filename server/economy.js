// Jeton, SwipeUp+ ve mağaza ayarları. Ayarlar 'settings' koleksiyonunda ('economy') durur,
// yönetim panelinden değiştirilir.
const DAY = 86400000;

const DEFAULTS = {
  bank: { iban: '', name: '', bankName: '', note: 'Açıklama kısmına sipariş kodunu yazmayı unutma.' },
  coinPacks: [
    { id: 'c100', coins: 100, price: 29.99 },
    { id: 'c550', coins: 550, price: 129.99, tag: 'Popüler' },
    { id: 'c1300', coins: 1300, price: 249.99, tag: 'En avantajlı' },
  ],
  plusPlans: [
    { id: 'p30', days: 30, price: 99.99 },
    { id: 'p90', days: 90, price: 249.99, tag: '%17 indirim' },
  ],
  gifts: [
    { id: 'gul', em: '🌹', name: 'Gül', coins: 5 },
    { id: 'kalp', em: '💜', name: 'Kalp', coins: 10 },
    { id: 'kahve', em: '☕️', name: 'Kahve', coins: 25 },
    { id: 'yildiz', em: '🌟', name: 'Yıldız', coins: 50 },
    { id: 'tac', em: '👑', name: 'Taç', coins: 150 },
    { id: 'roket', em: '🚀', name: 'Roket', coins: 300 },
    { id: 'elmas', em: '💎', name: 'Elmas', coins: 500 },
  ],
  falPrices: { kahve: 40, tarot: 30, burc: 20, uyum: 30 },
  boostCoins: 80,
  boostMinutes: 30,
  freeLikes: 50,
  freeSupers: 1,
  plusSupers: 5,
  creatorShare: 0.6, // canlı yayın hediyelerinden yayıncıya kalan pay
  falciShare: 0.7, // ücretli faldan Falcı Teyze'ye kalan pay
  coinTL: 0.2, // kazanılan 1 jetonun ödeme karşılığı (₺)
  superMsgCoins: 30, // eşleşmeden süper mesaj
  inviteCoins: 50, // davet eden ve edilene
  falSubCoins: 250, // Falcı Teyze aylık aboneliği
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
  function addCoins(userId, delta, reason, extra = {}) {
    const u = store.get('users', userId);
    if (!u) return null;
    const coins = Math.max(0, (u.coins || 0) + delta);
    store.update('users', userId, { coins });
    store.put('coin_tx', { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, userId, delta, reason, at: Date.now(), ...extra });
    return coins;
  }
  function spend(userId, amount, reason, extra) {
    const u = store.get('users', userId);
    if (!u || (u.coins || 0) < amount) return false;
    addCoins(userId, -amount, reason, extra);
    return true;
  }
  function earn(userId, coins, reason, extra = {}) {
    const u = store.get('users', userId);
    if (!u || coins <= 0) return;
    store.update('users', userId, { earnings: (u.earnings || 0) + coins, earnedTotal: (u.earnedTotal || 0) + coins });
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

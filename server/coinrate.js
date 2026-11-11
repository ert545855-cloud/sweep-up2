// 1 jeton = 1 TL geçişi (bir kez çalışır).
// Eski jeton yaklaşık 0,25 TL ediyordu. TL karşılıkları değişmesin diye bakiyeler, yönetimden ayarlanmış fiyatlar ve
// ödüller 4'e bölünür; yayıncı ve falcı kazançları doğrudan TL'ye çevrilir; bekleyen siparişler eski değeriyle yüklenir.
// Dönen: bildirim gönderilecek kullanıcılar [{ uid, from, to, tl }]
const OLD_GIFTS = JSON.stringify([5, 10, 25, 50, 150, 250, 300, 500]);
const OLD_FAL = JSON.stringify({ kahve: 40, tarot: 30, burc: 20, uyum: 30, ruya: 25 });

module.exports = function coinrate(store) {
  const META = 'coin_rate_v1'; if (store.get('meta', META)) return [];
  const q = (n) => (+n > 0 ? Math.max(1, Math.round(+n / 4)) : 0);
  const r2 = (n) => Math.round(n * 100) / 100;
  const scaleObj = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, q(v)]));
  const ecoS = store.get('settings', 'economy') || {}; const oldTL = typeof ecoS.coinTL === 'number' && ecoS.coinTL > 0 ? ecoS.coinTL : 0.2;

  // Kullanıcılar: bakiye 4'e bölünür (yukarı yuvarlanır, kimse zarar görmez); satın alınmış kısım ayrıca işaretlenir
  const bought = new Map(); store.filter('coin_tx', (t) => t.reason === 'purchase' && t.delta > 0).forEach((t) => bought.set(t.userId, (bought.get(t.userId) || 0) + t.delta));
  const out = [];
  store.all('users').forEach((u) => {
    const was = u.coins || 0; const wasEarn = u.earnings || 0; // store.update nesneyi yerinde değiştirir: eski değerler önce alınır
    const patch = {}; const coins = was > 0 ? Math.ceil(was / 4) : 0;
    if (was > 0) patch.coins = coins;
    patch.paid = Math.min(coins, Math.ceil((bought.get(u.id) || 0) / 4));
    if (wasEarn > 0) patch.earnings = r2(wasEarn * oldTL);
    if (u.earnedTotal > 0) patch.earnedTotal = r2(u.earnedTotal * oldTL);
    store.update('users', u.id, patch);
    if ((was > 0 && coins !== was) || wasEarn > 0) out.push({ uid: u.id, from: was, to: coins, tl: patch.earnings || 0 });
  });
  store.all('earn_tx').forEach((t) => { if (!t.tl) store.put('earn_tx', { ...t, coins: r2((t.coins || 0) * oldTL), tl: true }); });
  // Süren öne çıkarmalar: aynı gösterim hakkı kalır, iade yeni jetonla hesaplanır (gösterim/jeton 4 katına çıkıyor)
  store.filter('promos', (p) => ['active', 'paused'].includes(p.status) && !p.tl).forEach((p) => store.put('promos', { ...p, coins: Math.ceil((p.coins || 0) / 4), tl: true }));
  // Bekleyen kazanç ödeme talepleri: reddedilirse geri eklenecek tutar artık TL
  store.filter('payouts', (p) => p.kind !== 'store' && !p.tl).forEach((p) => store.put('payouts', { ...p, coins: typeof p.amount === 'number' ? p.amount : r2((p.coins || 0) * oldTL), tl: true }));
  // Bekleyen jeton siparişleri eski fiyattan ödendi: eski jeton sayısının bugünkü karşılığı yüklenecek
  store.filter('orders', (o) => o.kind === 'coins' && ['pending', 'paid'].includes(o.status) && o.coins == null)
    .forEach((o) => store.put('orders', { ...o, coins: Math.ceil((parseInt(o.title, 10) || 0) / 4), rate: 'eski' }));

  // Ekonomi ayarları
  const E = { ...ecoS }; delete E.coinPacks; // yeni 1 TL'lik paketler
  if (Array.isArray(E.gifts)) { if (JSON.stringify(E.gifts.map((g) => g.coins)) === OLD_GIFTS) delete E.gifts; else E.gifts = E.gifts.map((g) => ({ ...g, coins: q(g.coins) })); }
  if (E.falPrices) { if (JSON.stringify(E.falPrices) === OLD_FAL) delete E.falPrices; else E.falPrices = scaleObj(E.falPrices); }
  ['boostCoins', 'superMsgCoins', 'inviteCoins', 'falSubCoins'].forEach((k) => { if (typeof E[k] === 'number') E[k] = q(E[k]); });
  E.coinTL = 1; E.creatorShare = 0.6;
  store.put('settings', { ...E, id: 'economy' });
  // Seriler, seri koruyucu, fal paketleri
  const g = store.get('settings', 'engage');
  if (g) {
    const G = { ...g };
    if (G.streak?.milestones) G.streak = { ...G.streak, milestones: scaleObj(G.streak.milestones) };
    if (G.login) G.login = { ...G.login, ...(G.login.milestones ? { milestones: scaleObj(G.login.milestones) } : {}), ...(G.login.freezeCoins != null ? { freezeCoins: q(G.login.freezeCoins) } : {}) };
    if (Array.isArray(G.packs)) G.packs = G.packs.map((p) => ({ ...p, coins: q(p.coins) }));
    store.put('settings', G);
  }
  // Öne çıkarma: aynı TL'ye aynı gösterim
  const pr = store.get('settings', 'promo');
  if (pr) store.put('settings', { ...pr, ...(pr.impPerCoin ? { impPerCoin: pr.impPerCoin * 4 } : {}), ...(pr.minCoins ? { minCoins: q(pr.minCoins) } : {}), ...(pr.maxCoins ? { maxCoins: q(pr.maxCoins) } : {}) });
  // Çark, görevler
  const w = store.get('settings', 'wheel');
  if (w?.slices) store.put('settings', { ...w, slices: w.slices.map((x) => (x.type === 'coins' ? { ...x, amount: q(x.amount), label: /^\d+ jeton$/.test(x.label || '') ? `${q(x.amount)} jeton` : x.label } : x)) });
  const qs = store.get('settings', 'quests');
  if (qs) store.put('settings', { ...qs, ...(Array.isArray(qs.list) ? { list: qs.list.map((x) => ({ ...x, coins: q(x.coins) })) } : {}), ...(typeof qs.bonus === 'number' ? { bonus: q(qs.bonus) } : {}) });
  // Henüz ödülü verilmemiş yarışmaların jeton ödülleri
  store.filter('contests', (c) => !c.awardedAt && Array.isArray(c.prizes)).forEach((c) => store.put('contests', { ...c, prizes: c.prizes.map((p) => ({ ...p, coins: q(p.coins) })) }));

  store.put('meta', { id: META, at: Date.now(), users: out.length, oldTL });
  console.log(`[jeton] 1 jeton = 1 TL geçişi yapıldı · ${out.length} kullanıcının bakiyesi çevrildi`);
  return out;
};

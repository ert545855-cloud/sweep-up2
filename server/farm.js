// SwipeFarm: herkesin kendi çiftliğini kurduğu çiftlik oyunu.
// Tarla ek/biç, hayvan besle, değirmen-fırın-mandırada üret, siparişleri teslim et, seviye atla, komşuna yardım et.
// Bütün süreler sunucuda zaman damgasıyla tutulur; oyun kapalıyken de ekinler büyür.
// Oyun jeton ya da parayla oynanmaz: "altın" yalnızca çiftliğin içinde geçer.
const { nanoid } = require('nanoid');

const N = 18; // çiftlik alanı (kare sayısı)
const MIN = 60 * 1000;
const CROPS = {
  wheat: { name: 'Buğday', lvl: 1, t: 1 * MIN, seed: 0, xp: 1 },
  corn: { name: 'Mısır', lvl: 2, t: 4 * MIN, seed: 1, xp: 2 },
  carrot: { name: 'Havuç', lvl: 3, t: 10 * MIN, seed: 2, xp: 3 },
  tomato: { name: 'Domates', lvl: 5, t: 20 * MIN, seed: 3, xp: 4 },
  sunflower: { name: 'Ayçiçeği', lvl: 7, t: 90 * MIN, seed: 6, xp: 8 },
  pumpkin: { name: 'Kabak', lvl: 9, t: 180 * MIN, seed: 8, xp: 11 },
  strawberry: { name: 'Çilek', lvl: 4, t: 15 * MIN, seed: 2, xp: 3 },
  sugarcane: { name: 'Şeker kamışı', lvl: 8, t: 30 * MIN, seed: 4, xp: 5 },
  cotton: { name: 'Pamuk', lvl: 10, t: 120 * MIN, seed: 7, xp: 9 },
};
const ITEMS = {
  wheat: ['Buğday', 2], corn: ['Mısır', 4], carrot: ['Havuç', 6], tomato: ['Domates', 9], sunflower: ['Ayçiçeği', 20], pumpkin: ['Kabak', 28],
  egg: ['Yumurta', 12], milk: ['Süt', 26], feed_c: ['Tavuk yemi', 3], feed_w: ['İnek yemi', 5],
  bread: ['Ekmek', 18], cornbread: ['Mısır ekmeği', 55], cake: ['Havuçlu kek', 80], pizza: ['Pizza', 125],
  cream: ['Krema', 40], butter: ['Tereyağı', 70], cheese: ['Peynir', 105],
  strawberry: ['Çilek', 8], sugarcane: ['Şeker kamışı', 12], cotton: ['Pamuk', 24], apple: ['Elma', 9], honey: ['Bal', 34], wool: ['Yün', 46], gmilk: ['Keçi sütü', 36],
  feed_s: ['Küçükbaş yemi', 6], sugar: ['Şeker', 32], jam: ['Çilek reçeli', 80], marmalade: ['Elma marmelatı', 85], icecream: ['Dondurma', 120], honeyice: ['Ballı dondurma', 150],
  fish: ['Balık', 18], grillfish: ['Izgara balık', 60], fishsand: ['Balık ekmek', 85], wood: ['Odun', 14], stone: ['Taş', 20],
};
// yapılar: w/h kapladığı kare, cost altın, lvl açıldığı seviye, kind: fixed (taşınır, satılmaz) | build | pen | plot | prod (kendiliğinden ürün verir) | decor
// special: yalnızca kazanılır (koleksiyon), gem: jetonla alınır, max: en fazla kaç tane
const TYPES = {
  house: { name: 'Çiftlik evi', w: 3, h: 2, kind: 'fixed' },
  barn: { name: 'Ambar', w: 2, h: 2, kind: 'fixed' },
  board: { name: 'Sipariş panosu', w: 1, h: 1, kind: 'fixed' },
  plot: { name: 'Tarla', w: 1, h: 1, kind: 'plot', lvl: 1, cost: 10 },
  mill: { name: 'Yem değirmeni', w: 2, h: 2, kind: 'build', lvl: 2, cost: 15, slots: 2 },
  coop: { name: 'Kümes', w: 2, h: 2, kind: 'pen', lvl: 2, cost: 30 },
  bakery: { name: 'Fırın', w: 2, h: 2, kind: 'build', lvl: 3, cost: 60, slots: 2 },
  cowpen: { name: 'İnek ağılı', w: 2, h: 2, kind: 'pen', lvl: 5, cost: 180 },
  dairy: { name: 'Mandıra', w: 2, h: 2, kind: 'build', lvl: 6, cost: 220, slots: 2 },
  sheeppen: { name: 'Koyun ağılı', w: 2, h: 2, kind: 'pen', lvl: 8, cost: 320 },
  sugarmill: { name: 'Şeker atölyesi', w: 2, h: 2, kind: 'build', lvl: 8, cost: 300, slots: 2 },
  jamshop: { name: 'Reçel atölyesi', w: 2, h: 2, kind: 'build', lvl: 9, cost: 380, slots: 2 },
  goatpen: { name: 'Keçi ağılı', w: 2, h: 2, kind: 'pen', lvl: 10, cost: 450 },
  icecream: { name: 'Dondurmacı', w: 2, h: 2, kind: 'build', lvl: 11, cost: 520, slots: 2 },
  flowers: { name: 'Çiçek tarhı', w: 1, h: 1, kind: 'decor', lvl: 1, cost: 12 },
  bush: { name: 'Çiçekli çalı', w: 1, h: 1, kind: 'decor', lvl: 1, cost: 15 },
  fence_x: { name: 'Çit (yatay)', w: 1, h: 1, kind: 'decor', lvl: 1, cost: 5 },
  fence_z: { name: 'Çit (dikey)', w: 1, h: 1, kind: 'decor', lvl: 1, cost: 5 },
  rock: { name: 'Kaya', w: 1, h: 1, kind: 'decor', lvl: 1, cost: 10 },
  tree: { name: 'Ağaç', w: 1, h: 1, kind: 'decor', lvl: 2, cost: 25 },
  pine: { name: 'Çam', w: 1, h: 1, kind: 'decor', lvl: 2, cost: 25 },
  hay: { name: 'Saman balyası', w: 1, h: 1, kind: 'decor', lvl: 3, cost: 20 },
  appletree: { name: 'Elma ağacı', w: 1, h: 1, kind: 'prod', lvl: 4, cost: 40, max: 6 },
  beehive: { name: 'Arı kovanı', w: 1, h: 1, kind: 'prod', lvl: 7, cost: 200, max: 3 },
  scarecrow: { name: 'Korkuluk', w: 1, h: 1, kind: 'decor', lvl: 4, cost: 60 },
  well: { name: 'Kuyu', w: 1, h: 1, kind: 'decor', lvl: 5, cost: 120 },
  pond: { name: 'Gölet', w: 2, h: 2, kind: 'decor', lvl: 6, cost: 150, max: 2 },
  grill: { name: 'Balık lokantası', w: 2, h: 2, kind: 'build', lvl: 6, cost: 280, slots: 2 },
  woodlot: { name: 'Odunluk', w: 1, h: 1, kind: 'prod', lvl: 5, cost: 180, max: 2 },
  quarry: { name: 'Taş ocağı', w: 1, h: 1, kind: 'prod', lvl: 7, cost: 260, max: 2 },
  lovetree: { name: 'Aşk ağacı', w: 1, h: 1, kind: 'decor', lvl: 1, special: 'Çift bahçesi ödülü' },
  cornstack: { name: 'Mısır demeti', w: 1, h: 1, kind: 'decor', lvl: 1, special: 'Hasat şenliği ödülü' }, haycart: { name: 'Balkabağı arabası', w: 1, h: 1, kind: 'decor', lvl: 1, special: 'Hasat şenliği ödülü' },
  snowman: { name: 'Kardan adam', w: 1, h: 1, kind: 'decor', lvl: 1, special: 'Yılbaşı şenliği ödülü' }, xmastree: { name: 'Yılbaşı ağacı', w: 1, h: 1, kind: 'decor', lvl: 1, special: 'Yılbaşı şenliği ödülü' },
  tulips: { name: 'Lale tarhı', w: 1, h: 1, kind: 'decor', lvl: 1, special: 'Bahar şenliği ödülü' }, maypole: { name: 'Bahar direği', w: 1, h: 1, kind: 'decor', lvl: 1, special: 'Bahar şenliği ödülü' },
  parasol: { name: 'Plaj şemsiyesi', w: 1, h: 1, kind: 'decor', lvl: 1, special: 'Yaz şenliği ödülü' }, melon: { name: 'Karpuz sergisi', w: 1, h: 1, kind: 'decor', lvl: 1, special: 'Yaz şenliği ödülü' },
  bench: { name: 'Bank', w: 1, h: 1, kind: 'decor', lvl: 3, cost: 35 },
  lantern: { name: 'Fener', w: 1, h: 1, kind: 'decor', lvl: 1, gem: 15 },
  arch: { name: 'Çiçekli kemer', w: 1, h: 1, kind: 'decor', lvl: 1, gem: 30 },
  gnome: { name: 'Bahçe cücesi', w: 1, h: 1, kind: 'decor', lvl: 1, special: '7 günlük giriş ödülü' },
  fountain: { name: 'Çeşme', w: 1, h: 1, kind: 'decor', lvl: 1, special: 'Ortak sipariş ödülü' },
  trophy: { name: 'Altın kupa', w: 1, h: 1, kind: 'decor', lvl: 1, special: 'Haftanın ilk üç çiftçisine' },
};
const RECIPES = {
  mill: { feed_c: { in: { wheat: 2, corn: 1 }, out: 3, t: 3 * MIN, xp: 2, lvl: 2 }, feed_w: { in: { corn: 2, carrot: 1 }, out: 3, t: 7 * MIN, xp: 3, lvl: 5 }, feed_s: { in: { wheat: 3, carrot: 2 }, out: 3, t: 10 * MIN, xp: 4, lvl: 8 } },
  bakery: { bread: { in: { wheat: 3 }, out: 1, t: 5 * MIN, xp: 4, lvl: 3 }, cornbread: { in: { corn: 2, egg: 2 }, out: 1, t: 20 * MIN, xp: 10, lvl: 4 },
    cake: { in: { carrot: 2, egg: 2, wheat: 1 }, out: 1, t: 40 * MIN, xp: 16, lvl: 6 }, pizza: { in: { wheat: 2, tomato: 2, cheese: 1 }, out: 1, t: 60 * MIN, xp: 26, lvl: 8 } },
  dairy: { cream: { in: { milk: 1 }, out: 1, t: 15 * MIN, xp: 7, lvl: 6 }, butter: { in: { milk: 2 }, out: 1, t: 25 * MIN, xp: 11, lvl: 7 }, cheese: { in: { milk: 3 }, out: 1, t: 50 * MIN, xp: 17, lvl: 8 } },
  sugarmill: { sugar: { in: { sugarcane: 2 }, out: 1, t: 20 * MIN, xp: 8, lvl: 8 } },
  jamshop: { jam: { in: { strawberry: 3, sugar: 1 }, out: 1, t: 35 * MIN, xp: 15, lvl: 9 }, marmalade: { in: { apple: 3, sugar: 1 }, out: 1, t: 40 * MIN, xp: 16, lvl: 9 } },
  grill: { grillfish: { in: { fish: 2 }, out: 1, t: 15 * MIN, xp: 7, lvl: 6 }, fishsand: { in: { fish: 1, bread: 1 }, out: 1, t: 25 * MIN, xp: 12, lvl: 6 } },
  icecream: { icecream: { in: { milk: 1, sugar: 1, strawberry: 2 }, out: 1, t: 45 * MIN, xp: 22, lvl: 11 }, honeyice: { in: { gmilk: 1, sugar: 1, honey: 1 }, out: 1, t: 60 * MIN, xp: 28, lvl: 12 } },
};
const PENS = {
  coop: { animal: 'chicken', aname: 'Tavuk', feed: 'feed_c', out: 'egg', t: 10 * MIN, xp: 3, prices: [15, 60, 140, 260] },
  cowpen: { animal: 'cow', aname: 'İnek', feed: 'feed_w', out: 'milk', t: 30 * MIN, xp: 5, prices: [80, 350, 800] },
  sheeppen: { animal: 'sheep', aname: 'Koyun', feed: 'feed_s', out: 'wool', t: 90 * MIN, xp: 9, prices: [200, 600, 1200] },
  goatpen: { animal: 'goat', aname: 'Keçi', feed: 'feed_s', out: 'gmilk', t: 60 * MIN, xp: 8, prices: [260, 750, 1500] },
};
// kendiliğinden ürün verenler: dokununca toplanır, süre yeniden başlar
const PROD = { appletree: { out: 'apple', n: 2, t: 30 * MIN, xp: 2 }, beehive: { out: 'honey', n: 1, t: 45 * MIN, xp: 4 }, pond: { out: 'fish', n: 1, t: 20 * MIN, xp: 3 },
  woodlot: { out: 'wood', n: 2, t: 40 * MIN, xp: 3, raw: 1 }, quarry: { out: 'stone', n: 1, t: 45 * MIN, xp: 4, raw: 1 } };
// bina yükseltme: odun ve taşla üretim hızlanır
const UPG = [{ wood: 6, stone: 4, coins: 300, k: 0.8 }, { wood: 14, stone: 10, coins: 900, k: 0.65 }];
// günlük görev türleri
const QUESTS = { harvest: 'Ekin hasat et', order: 'Sipariş teslim et', craft: 'Atölyelerden ürün al', collect: 'Hayvan ürünü topla', help: 'Komşunun ekinini sula', pick: 'Ağaçtan, kovandan ya da göletten ürün topla' };
const ACH = {
  harv1: { name: 'Bereketli eller', desc: '100 hasat yap', s: 'harv', n: 100, coins: 150 }, harv2: { name: 'Hasat ustası', desc: '1000 hasat yap', s: 'harv', n: 1000, coins: 800 },
  ord: { name: 'Güvenilir satıcı', desc: '25 sipariş teslim et', s: 'orders', n: 25, coins: 200 }, craft: { name: 'Usta üretici', desc: 'Atölyelerden 50 ürün al', s: 'craft', n: 50, coins: 250 },
  help: { name: 'İyi komşu', desc: 'Komşularının 20 ekinini sula', s: 'help', n: 20, coins: 150 }, gift: { name: 'Eli açık', desc: '5 hediye gönder', s: 'gift', n: 5, coins: 120 },
  fish: { name: 'Balıkçı', desc: '20 balık tut', s: 'fish', n: 20, coins: 200 }, boat: { name: 'Kaptanın dostu', desc: '5 tekne uğurla', s: 'boat', n: 5, coins: 300 },
  lvl: { name: 'Tecrübeli çiftçi', desc: '10. seviyeye ulaş', s: 'lvl', n: 10, coins: 300 }, coop: { name: 'Omuz omuza', desc: 'Bir ortak siparişi tamamla', s: 'coop', n: 1, coins: 150 },
  quest: { name: 'Görev insanı', desc: '10 gün günlük görevleri bitir', s: 'quest', n: 10, coins: 250 }, pet: { name: 'Can dostu', desc: 'Evcil hayvanını 10 kez besle', s: 'pet', n: 10, coins: 150 },
};
const PETS = { cat: { name: 'Kedi', cost: 400, lvl: 3, food: ['milk', 'fish'] }, dog: { name: 'Köpek', cost: 400, lvl: 3, food: ['bread', 'egg'] } }; const PET_T = 120 * MIN;
const FITS = { a: { name: 'Hasır şapka', cost: 0 }, b: { name: 'Mavi tulum', cost: 300 }, c: { name: 'Bahar bahçıvanı', cost: 500 }, d: { name: 'Kovboy', gem: 25 } };
// mevsimlik şenlikler (ay-gün, TSİ). Şenlik puanı: sipariş +1, günlük görev sandığı +2, tekne +3.
const EVENTS = [{ id: 'hasat', name: 'Hasat şenliği', from: '10-20', to: '11-20', decor: ['cornstack', 'haycart'] }, { id: 'yilbasi', name: 'Yılbaşı şenliği', from: '12-15', to: '01-05', decor: ['snowman', 'xmastree'] },
  { id: 'bahar', name: 'Bahar şenliği', from: '04-15', to: '05-10', decor: ['tulips', 'maypole'] }, { id: 'yaz', name: 'Yaz şenliği', from: '07-01', to: '07-31', decor: ['parasol', 'melon'] }];
const EV_STEPS = [{ pts: 5, coins: 150 }, { pts: 12, decor: 0 }, { pts: 25, decor: 1 }];
const WHEEL = [{ coins: 20 }, { item: ['feed_c', 2] }, { coins: 50 }, { xp: 15 }, { coins: 100 }, { item: ['egg', 3] }, { coins: 250 }, { item: ['bread', 2] }]; const WHEEL_W = [24, 16, 18, 14, 10, 10, 2, 6]; const SPIN_GEM = 10;
const PAIR_STEPS = [{ g: 5, coins: 100 }, { g: 15, coins: 250 }, { g: 30, coins: 500, decor: 'lovetree' }]; const BOAT_LVL = 4; const CLUB_PRIZE = 250;
const EXP = [{ n: 22, lvl: 6, cost: 1500 }, { n: 26, lvl: 10, cost: 5000 }]; // arazi genişletme
const DAILY7 = [{ coins: 30 }, { item: ['feed_c', 3] }, { coins: 60 }, { item: ['egg', 3] }, { coins: 120 }, { item: ['bread', 3] }, { coins: 200, decor: 'gnome' }];
const RUSH_MIN = 15; const RUSH_MAX = 20; // jetonla hızlandırma: kalan her 15 dakika 1 jeton, en çok 20
const STALL_SLOTS = 4; const COOP_DAYS = 3; const COOP_COINS = 400; const WEEK_PRIZE = [500, 300, 150];
const XPN = [15, 30, 50, 80, 120, 170, 230, 300, 380, 470, 570, 680, 800, 930];
const need = (l) => XPN[l - 1] ?? 930 + (l - 14) * 150;
const maxPlots = (l) => Math.min(6 + (l - 1) * 2, 30);
const barnCap = (bl) => 80 + 40 * (bl || 0);
const barnUpCost = (bl) => 100 * ((bl || 0) + 1);
const orderSlots = (l) => (l < 6 ? 3 : l < 10 ? 4 : 5);
const HELPS = 5; const SKIP_WAIT = 3 * MIN;
const WHO = ['Ayşe Teyze', 'Bakkal Rıza', 'Pastacı Selin', 'Muhtar Kemal', 'Kahveci Deniz', 'Aşçı Zeynep', 'Manav Orhan', 'Öğretmen Elif', 'Fırıncı Cem', 'Komşu Nermin'];
const CFG = { N, CROPS, ITEMS, TYPES, RECIPES, PENS, PROD, XPN, HELPS, DAILY7, RUSH_MIN, RUSH_MAX, STALL_SLOTS, WEEK_PRIZE, COOP_COINS, UPG, QUESTS, PETS, PET_T, FITS, WHEEL, SPIN_GEM, EV_STEPS, PAIR_STEPS, CLUB_PRIZE, BOAT_LVL };

module.exports = function farm(app, ctx) {
  const { store, auth, brief, notify, isBlocked, eco } = ctx;
  const now = () => Date.now();
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const day = (off = 0) => new Date(now() + 3 * 3600000 + off * 86400000).toISOString().slice(0, 10); // TSİ
  const week = () => { const d = new Date(now() + 3 * 3600000); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }; // haftanın pazartesisi
  const size = (f) => f.n || N;
  const jeton = (uid) => store.get('users', uid)?.coins || 0;
  const pay = (user, n, ref) => { if (!eco?.spend(user.id, n, 'farm', { ref })) throw E(`Jetonun yetmiyor (${n} jeton gerekli).`); };
  const rushCost = (ms) => Math.min(RUSH_MAX, Math.max(1, Math.ceil(ms / (RUSH_MIN * MIN))));
  const E = (msg, code = 400) => Object.assign(new Error(msg), { status: code });

  const invCount = (f) => Object.values(f.inv).reduce((a, b) => a + b, 0);
  const has = (f, items) => Object.entries(items).every(([k, n]) => (f.inv[k] || 0) >= n);
  const take = (f, items) => { Object.entries(items).forEach(([k, n]) => { f.inv[k] -= n; if (f.inv[k] <= 0) delete f.inv[k]; }); };
  const give = (f, k, n) => { f.inv[k] = (f.inv[k] || 0) + n; };
  const room = (f) => barnCap(f.bl) - invCount(f);
  const count = (f, t) => f.objs.filter((o) => o.t === t).length;
  const free = (f, t, x, y, skip) => {
    const T = TYPES[t]; const S = size(f); if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x + T.w > S || y + T.h > S) return false;
    return !f.objs.some((o) => o.id !== skip && x < o.x + TYPES[o.t].w && o.x < x + T.w && y < o.y + TYPES[o.t].h && o.y < y + T.h);
  };
  const oid = (f) => `o${(f.seq = (f.seq || 0) + 1)}`;

  function mkOrder(f) {
    const pool = [];
    Object.entries(CROPS).forEach(([k, c]) => { if (c.lvl <= f.lvl) pool.push([k, 3, 4 + Math.min(f.lvl, 5)]); });
    Object.entries(PENS).forEach(([p, P]) => { if ((f.pens[p] || []).length) pool.push([P.out, 1, 2 + (f.pens[p].length > 1 ? 2 : 0)]); });
    Object.entries(PROD).forEach(([t, P]) => { if (count(f, t) && !P.raw) pool.push([P.out, 2, 4]); });
    Object.entries(RECIPES).forEach(([b, rs]) => { if (count(f, b)) Object.entries(rs).forEach(([k, r]) => { if (r.lvl <= f.lvl && !k.startsWith('feed')) pool.push([k, 1, k === 'bread' ? 3 : 2]); }); });
    const lines = Math.min(pool.length, 1 + (Math.random() < 0.55 ? 1 : 0) + (f.lvl >= 4 && Math.random() < 0.3 ? 1 : 0));
    const needs = {}; let V = 0;
    for (let i = 0; i < lines; i++) { const [k, a, b] = pool.splice(rnd(0, pool.length - 1), 1)[0]; needs[k] = rnd(a, b); V += needs[k] * ITEMS[k][1]; }
    const m = 0.75 + Math.random() * 0.5;
    return { id: nanoid(6), who: WHO[rnd(0, WHO.length - 1)], need: needs, coins: Math.max(4, Math.round(V * 1.6 * m)), xp: Math.max(2, Math.round(V * 0.35 * (2 - m))) };
  }
  // sipariş yuvalarını doldur (bekleme süresi dolanların yerine yenisi gelir)
  function touch(f) {
    let ch = false;
    f.orders = f.orders.map((o) => (o.wait && o.wait <= now() ? (ch = true, mkOrder(f)) : o));
    while (f.orders.length < orderSlots(f.lvl)) { f.orders.push(mkOrder(f)); ch = true; }
    return ch;
  }
  function create(uid) {
    const f = { id: uid, lvl: 1, xp: 0, coins: 60, inv: { wheat: 2 }, bl: 0, objs: [], pens: {}, q: {}, orders: [], seq: 0, helpDay: '', helpN: 0, helpedBy: {}, harv: 0, createdAt: now() };
    const put = (t, x, y, extra) => f.objs.push({ id: oid(f), t, x, y, ...extra });
    put('house', 7, 2); put('barn', 11, 2); put('board', 6, 5);
    // ilk altı tarla: dördü hasada hazır buğday (ilk saniyede biçme keyfi), ikisi boş
    [[6, 8], [7, 8], [8, 8], [6, 9], [7, 9], [8, 9]].forEach(([x, y], i) => put('plot', x, y, i < 4 ? { crop: 'wheat', at: now() - CROPS.wheat.t } : {}));
    [['appletree', 4, 3], ['tree', 14, 6], ['pine', 3, 9], ['bush', 10, 5], ['flowers', 5, 6], ['rock', 13, 10]].forEach(([t, x, y]) => put(t, x, y));
    touch(f);
    return store.put('farms', f);
  }
  const load = (uid) => { const f = store.get('farms', uid) || create(uid); if (touch(f)) store.put('farms', f); return f; };
  const save = (f) => store.put('farms', f);
  function gain(f, xp, fx) {
    if (!xp) return; f.xp += xp; fx.push({ t: 'xp', n: xp });
    if (f.wk !== week()) { f.wk = week(); f.ws = 0; } f.ws = (f.ws || 0) + xp; // haftalık sıralama puanı
    while (f.xp >= need(f.lvl)) {
      f.xp -= need(f.lvl); f.lvl += 1; const c = f.lvl * 20; f.coins += c;
      const unlock = [...Object.entries(CROPS).filter(([, v]) => v.lvl === f.lvl).map(([k, v]) => ({ k: `${k}_3`, name: v.name })), ...Object.entries(TYPES).filter(([k, v]) => v.lvl === f.lvl && k !== 'plot' && !v.special && !v.gem).map(([k, v]) => ({ k, name: v.name }))];
      fx.push({ t: 'lvl', lvl: f.lvl, coins: c, unlock }); ctx.addXp?.(f.id, 'oyun', 1);
    }
  }
  // ortak sipariş: iki komşu birlikte büyük bir siparişi doldurur
  function coopOf(f) { if (!f.coop) return null; const c = store.get('farm_coops', f.coop); if (!c || c.done || c.end < now()) { delete f.coop; return null; } return c; }
  const coopOut = (f) => { const c = coopOf(f); if (!c) return null; const o = store.get('users', c.a === f.id ? c.b : c.a); return { with: o ? brief(o) : null, need: c.need, got: c.got, mine: c.by[f.id] || 0, theirs: (o && c.by[o.id]) || 0, end: c.end }; };
  const dailyOut = (f) => { const d = f.dly || { day: '', n: -1 }; const can = d.day !== day(); return { can, next: can ? (d.day === day(-1) ? (d.n + 1) % 7 : Math.max(0, d.n - 1)) : (d.n + 1) % 7 }; };
  // --- ikinci paket yardımcıları ---
  const stat = (f, k, n = 1) => { f.st = f.st || {}; f.st[k] = (f.st[k] || 0) + n; };
  const statOf = (f, k) => (k === 'harv' ? f.harv || 0 : k === 'orders' ? f.done || 0 : k === 'lvl' ? f.lvl : (f.st || {})[k] || 0);
  const achOut = (f) => Object.entries(ACH).map(([k, a]) => ({ k, name: a.name, desc: a.desc, n: a.n, got: Math.min(a.n, statOf(f, a.s)), coins: a.coins, claimed: !!(f.ach || {})[k] }));
  const hasAny = (f, kind) => f.objs.some((o) => TYPES[o.t].kind === kind);
  function questOf(f) { // günde 3 görev; gün değişince yenilenir
    if (f.dq?.day === day()) return f.dq;
    const L = f.lvl; const opt = [['craft', 3 + Math.floor(L / 3), hasAny(f, 'build')], ['collect', 3 + Math.floor(L / 4), hasAny(f, 'pen')], ['help', 3, L >= 2], ['pick', 3, f.objs.some((o) => PROD[o.t])]].filter((x) => x[2]);
    const list = [{ k: 'harvest', n: Math.min(40, 8 + L * 2), got: 0 }, { k: 'order', n: 2 + Math.floor(L / 5), got: 0 }];
    if (opt.length) { const [k, n] = opt[rnd(0, opt.length - 1)]; list.push({ k, n, got: 0 }); }
    f.dq = { day: day(), list, coins: 30 + L * 8, xp: 8 + L * 2 }; return f.dq;
  }
  const bump = (f, k, n = 1) => { const q = questOf(f).list.find((x) => x.k === k); if (q) q.got = Math.min(q.n, q.got + n); };
  const md = () => day().slice(5); const inRange = (e) => (e.from <= e.to ? md() >= e.from && md() <= e.to : md() >= e.from || md() <= e.to);
  const evNow = () => EVENTS.find(inRange) || null;
  function evOf(f) { const e = evNow(); if (!e) return null; const y = +day().slice(0, 4) - (e.from > e.to && md() <= e.to ? 1 : 0); const key = `${e.id}-${y}`; if (f.ev?.key !== key) f.ev = { key, pts: 0, got: [] }; return e; }
  const evAdd = (f, n) => { if (evOf(f)) f.ev.pts += n; };
  const evOut = (f) => { const e = evOf(f); if (!e) return null; const y = +day().slice(0, 4) + (e.from > e.to && md() >= e.from ? 1 : 0);
    return { id: e.id, name: e.name, ends: Date.parse(`${y}-${e.to}T23:59:59+03:00`), pts: f.ev.pts, steps: EV_STEPS.map((x, i) => ({ pts: x.pts, coins: x.coins || 0, decor: x.decor != null ? e.decor[x.decor] : null, got: !!f.ev.got[i] })) }; };
  function boatOf(f) { // günlük tekne: 4 kasa
    if (f.lvl < BOAT_LVL) return null; if (f.boat?.day === day()) return f.boat;
    const pool = Object.entries(CROPS).filter(([, c]) => c.lvl <= f.lvl).map(([k]) => [k, 4, 8]); Object.entries(PENS).forEach(([p, P]) => { if ((f.pens[p] || []).length) pool.push([P.out, 2, 3]); });
    const crates = []; let V = 0; for (let i = 0; i < 4; i++) { const [k, a, b] = pool[rnd(0, pool.length - 1)]; const n = rnd(a, b); crates.push({ k, n, done: 0 }); V += n * ITEMS[k][1]; }
    f.boat = { day: day(), crates, coins: Math.round(V * 1.5) + 40, xp: 20 + f.lvl * 3, sent: 0 }; return f.boat;
  }
  const boatOut = (f) => { const b = boatOf(f); return b ? { crates: b.crates.map((c) => ({ k: c.k, n: c.n, done: c.done, by: c.by ? store.get('users', c.by)?.username || null : null })), coins: b.coins, xp: b.xp, sent: b.sent } : null; };
  const petOut = (f) => (f.pet ? { t: f.pet.t, fed: f.pet.fed || 0 } : null);
  const bookOut = (f, n = 30) => (f.book || []).slice(0, n).map((x) => { const u = store.get('users', x.from); return u ? { id: x.id, user: brief(u), text: x.text, at: x.at } : null; }).filter(Boolean);
  const upK = (f, b) => { const l = (f.bu || {})[b] || 0; return l ? UPG[l - 1].k : 1; };
  const matched = (a, b) => !!store.get('matches', [a, b].sort().join('_'));
  const pairOut = (a, b) => { if (!matched(a, b)) return null; const p = store.get('farm_pairs', [a, b].sort().join('_')) || { g: 0, w: {} }; return { g: p.g, max: PAIR_STEPS[PAIR_STEPS.length - 1].g, me: p.w[a] === day(), them: p.w[b] === day() }; };

  const out = (f) => ({ quests: (() => { const q = questOf(f); return { list: q.list, coins: q.coins, xp: q.xp, claimed: !!q.claimed }; })(), ach: achOut(f), boat: boatOut(f), pet: petOut(f), fit: f.fit || 'a', fits: { a: 1, ...(f.fits || {}) }, bu: f.bu || {},
    event: evOut(f), wheel: { n: f.spin?.day === day() ? f.spin.n : 0 }, likes: f.likes || 0, book: bookOut(f), lvl: f.lvl, xp: f.xp, need: need(f.lvl), coins: f.coins, inv: f.inv, cap: barnCap(f.bl), capUp: barnUpCost(f.bl), objs: f.objs, pens: f.pens, q: f.q, orders: f.orders,
    maxPlots: maxPlots(f.lvl), notif: !f.noNotif, helpsLeft: f.helpDay === day() ? Math.max(0, HELPS - f.helpN) : HELPS, now: now(),
    n: size(f), exp: EXP.find((e) => e.n > size(f)) || null, stock: f.stock || {}, stall: f.stall || [], daily: dailyOut(f), coop: coopOut(f), week: f.wk === week() ? f.ws || 0 : 0, jeton: jeton(f.id) });

  function clubRows(f) { // kulüp çiftliği: üyelerin o haftaki deneyimi ortak hedefe sayılır
    const w = week(); return store.filter('club_members', (m) => m.uid === f.id).map((m) => { const mem = store.filter('club_members', (x) => x.clubId === m.clubId).map((x) => store.get('farms', x.uid)).filter(Boolean);
      const act = mem.filter((x) => x.wk === w && x.ws > 0); const sum = act.reduce((a, x) => a + x.ws, 0);
      return { id: m.clubId, name: ctx.clubRoom?.(`k_${m.clubId}`)?.name || 'Kulüp', farmers: mem.length, sum, target: 150 * Math.min(20, Math.max(2, mem.length)), mine: f.wk === w ? f.ws || 0 : 0, claimed: f.clubW?.wk === w && !!f.clubW.ids[m.clubId] }; });
  }
  const ACT = {
    plant(f, b, fx) {
      const c = CROPS[b.crop]; if (!c || c.lvl > f.lvl) throw E('Bu ekin henüz açılmadı.');
      let n = 0;
      for (const id of [].concat(b.ids || []).slice(0, 40)) {
        const o = f.objs.find((x) => x.id === id && x.t === 'plot'); if (!o || o.crop) continue;
        if (f.coins < c.seed) { if (!n) throw E('Tohum için altının yetmiyor.'); break; }
        f.coins -= c.seed; o.crop = b.crop; o.at = now(); delete o.h; n++;
      }
      if (!n) throw E('Ekilecek boş tarla yok.');
    },
    harvest(f, b, fx) {
      let n = 0; let full = false;
      for (const id of [].concat(b.ids || []).slice(0, 40)) {
        const o = f.objs.find((x) => x.id === id && x.t === 'plot'); const c = o && CROPS[o.crop]; if (!c || now() - o.at < c.t) continue;
        if (room(f) < 2) { full = true; break; }
        give(f, o.crop, 2); fx.push({ t: 'item', k: o.crop, n: 2, at: o.id }); gain(f, c.xp, fx); delete o.crop; delete o.at; delete o.h; f.harv += 1; n++;
      }
      if (!n) throw E(full ? 'Ambar dolu. Bir şeyler sat ya da ambarı büyüt.' : 'Hasada hazır ekin yok.');
      bump(f, 'harvest', n);
    },
    buy(f, b, fx, user) {
      const T = TYPES[b.t]; if (!T || T.kind === 'fixed') throw E('Bu satın alınamaz.');
      const stock = (f.stock || {})[b.t] > 0; // koleksiyondan yerleştirme ücretsiz
      if (T.special && !stock) throw E(`${T.name} satın alınamaz: ${T.special}.`);
      if (!stock && T.lvl > f.lvl) throw E(`${T.name} ${T.lvl}. seviyede açılır.`);
      if (T.kind === 'plot' && count(f, 'plot') >= maxPlots(f.lvl)) throw E('Bu seviyede daha fazla tarla açamazsın. Seviye atlayınca yeni tarlalar gelir.');
      if ((T.kind === 'build' || T.kind === 'pen') && count(f, b.t)) throw E(`Zaten bir ${T.name.toLowerCase()} var.`);
      if (T.max && count(f, b.t) >= T.max) throw E(`En fazla ${T.max} ${T.name.toLocaleLowerCase('tr-TR')} kurabilirsin.`);
      if (f.objs.length >= 220) throw E('Çiftlikte yer kalmadı.');
      if (!free(f, b.t, b.x, b.y)) throw E('Buraya sığmıyor. Boş bir yer seç.');
      if (stock) { f.stock[b.t] -= 1; if (!f.stock[b.t]) delete f.stock[b.t]; } else if (T.gem) pay(user, T.gem, b.t); else { if (f.coins < T.cost) throw E('Altının yetmiyor.'); f.coins -= T.cost; }
      const o = { id: oid(f), t: b.t, x: b.x, y: b.y }; if (PROD[b.t]) o.at = now(); f.objs.push(o);
      if (T.kind === 'pen') f.pens[b.t] = []; if (T.kind === 'build') f.q[b.t] = [];
      return { placed: o.id };
    },
    move(f, b) {
      const o = f.objs.find((x) => x.id === b.id); if (!o) throw E('Bulunamadı.');
      if (!free(f, o.t, b.x, b.y, o.id)) throw E('Buraya sığmıyor.');
      o.x = b.x; o.y = b.y;
    },
    remove(f, b) {
      const o = f.objs.find((x) => x.id === b.id); const T = o && TYPES[o.t]; if (!o) throw E('Bulunamadı.');
      if (T.kind !== 'decor' && T.kind !== 'plot' && T.kind !== 'prod') throw E('Bu yapı kaldırılamaz, ama taşıyabilirsin.');
      if (o.crop) throw E('Önce ekini biç.');
      if (T.kind === 'plot' && count(f, 'plot') <= 4) throw E('En az dört tarlan olmalı.');
      f.objs = f.objs.filter((x) => x !== o);
      if (T.special || T.gem) { f.stock = f.stock || {}; f.stock[o.t] = (f.stock[o.t] || 0) + 1; } else f.coins += Math.floor(T.cost / 2); // koleksiyon parçası depoya döner
    },
    animal(f, b) {
      const P = PENS[b.pen]; const list = f.pens[b.pen]; if (!P || !list) throw E('Önce barınağı kur.');
      const price = P.prices[list.length]; if (price == null) throw E('Barınak dolu.');
      if (f.coins < price) throw E('Altının yetmiyor.');
      f.coins -= price; list.push({ at: 0 });
    },
    feed(f, b) {
      const P = PENS[b.pen]; const list = f.pens[b.pen]; if (!P || !list) throw E('Barınak yok.');
      let n = 0; for (const a of list) { if (a.at) continue; if (!(f.inv[P.feed] > 0)) break; take(f, { [P.feed]: 1 }); a.at = now(); n++; }
      if (!n) throw E(list.some((a) => !a.at) ? `${ITEMS[P.feed][0]} kalmadı. Değirmende üret.` : 'Hepsi tok.');
    },
    collect(f, b, fx) {
      const P = PENS[b.pen]; const list = f.pens[b.pen]; const o = f.objs.find((x) => x.t === b.pen); if (!P || !list) throw E('Barınak yok.');
      let n = 0; let full = false;
      for (const a of list) { if (!a.at || now() - a.at < P.t) continue; if (room(f) < 1) { full = true; break; } a.at = 0; give(f, P.out, 1); gain(f, P.xp, fx); n++; }
      if (!n) throw E(full ? 'Ambar dolu.' : 'Toplanacak ürün yok.');
      fx.push({ t: 'item', k: P.out, n, at: o?.id }); bump(f, 'collect', n);
    },
    craft(f, b) {
      const r = RECIPES[b.b]?.[b.r]; const q = f.q[b.b]; if (!r || !q) throw E('Önce bu binayı kur.');
      if (r.lvl > f.lvl) throw E(`Bu tarif ${r.lvl}. seviyede açılır.`);
      if (q.length >= TYPES[b.b].slots) throw E('Sıra dolu. Biten ürünü al.');
      if (!has(f, r.in)) throw E('Malzeme eksik.');
      take(f, r.in); const start = Math.max(now(), q.length ? q[q.length - 1].end : 0); q.push({ r: b.r, end: start + Math.round(r.t * upK(f, b.b)) });
    },
    take(f, b, fx) {
      const q = f.q[b.b]; const o = f.objs.find((x) => x.t === b.b); if (!q) throw E('Bina yok.');
      let n = 0; let full = false;
      while (q.length && q[0].end <= now()) { const r = RECIPES[b.b][q[0].r]; if (room(f) < r.out) { full = true; break; } give(f, q[0].r, r.out); fx.push({ t: 'item', k: q[0].r, n: r.out, at: o?.id }); gain(f, r.xp, fx); q.shift(); n++; }
      if (!n) throw E(full ? 'Ambar dolu.' : 'Henüz hazır değil.');
      bump(f, 'craft', n); stat(f, 'craft', n);
    },
    order(f, b, fx) {
      const i = f.orders.findIndex((o) => o.id === b.id && !o.wait); if (i < 0) throw E('Sipariş bulunamadı.');
      const o = f.orders[i]; if (!has(f, o.need)) throw E('Bu sipariş için ürünlerin eksik.');
      take(f, o.need); f.coins += o.coins; fx.push({ t: 'coins', n: o.coins }); gain(f, o.xp, fx); f.orders[i] = mkOrder(f); f.done = (f.done || 0) + 1; bump(f, 'order'); evAdd(f, 1);
    },
    skip(f, b) { const i = f.orders.findIndex((o) => o.id === b.id && !o.wait); if (i < 0) throw E('Sipariş bulunamadı.'); f.orders[i] = { id: nanoid(6), wait: now() + SKIP_WAIT }; },
    sell(f, b, fx) {
      const n = Math.floor(+b.n); if (!ITEMS[b.item] || !(n > 0) || (f.inv[b.item] || 0) < n) throw E('Satılacak ürün yok.');
      take(f, { [b.item]: n }); const c = n * ITEMS[b.item][1]; f.coins += c; fx.push({ t: 'coins', n: c });
    },
    pick(f, b, fx) { // elma ağacı, arı kovanı
      const o = f.objs.find((x) => x.id === b.id); const P = o && PROD[o.t]; if (!P) throw E('Bulunamadı.');
      if (o.at && now() - o.at < P.t) throw E('Henüz hazır değil.');
      if (room(f) < P.n) throw E('Ambar dolu.');
      o.at = now(); give(f, P.out, P.n); fx.push({ t: 'item', k: P.out, n: P.n, at: o.id }); gain(f, P.xp, fx); bump(f, 'pick'); if (P.out === 'fish') stat(f, 'fish');
    },
    rush(f, b, fx, user) { // jetonla hızlandır: tek tarla ya da bir binanın sırası
      if (b.id) {
        const o = f.objs.find((x) => x.id === b.id && x.t === 'plot'); const c = o && CROPS[o.crop]; const left = c ? c.t - (now() - o.at) : 0;
        if (left <= 0) throw E('Hızlandırılacak bir şey yok.'); pay(user, rushCost(left), 'rush'); o.at = now() - c.t;
      } else {
        const q = f.q[b.b]; const left = q && q.length ? q[0].end - now() : 0;
        if (left <= 0) throw E('Hızlandırılacak bir şey yok.'); pay(user, rushCost(left), 'rush'); q.forEach((x) => { x.end -= left; });
      }
    },
    expand(f) {
      const e = EXP.find((x) => x.n > size(f)); if (!e) throw E('Arazin en büyük hâlinde.');
      if (f.lvl < e.lvl) throw E(`Araziyi genişletmek için ${e.lvl}. seviye gerekli.`);
      if (f.coins < e.cost) throw E('Altının yetmiyor.');
      f.coins -= e.cost; f.n = e.n;
    },
    daily(f, b, fx) {
      const d = dailyOut(f); if (!d.can) throw E('Bugünkü ödülünü aldın. Yarın yine gel.');
      const R = DAILY7[d.next]; f.dly = { day: day(), n: d.next };
      if (R.coins) { f.coins += R.coins; fx.push({ t: 'coins', n: R.coins }); }
      if (R.item) { give(f, R.item[0], R.item[1]); fx.push({ t: 'item', k: R.item[0], n: R.item[1] }); }
      if (R.decor) { f.stock = f.stock || {}; f.stock[R.decor] = (f.stock[R.decor] || 0) + 1; fx.push({ t: 'decor', k: R.decor }); }
    },
    stallPut(f, b) { // yol kenarı tezgâhı: ürünü kendi fiyatınla satışa koy (taban fiyatın en çok 2 katı)
      const n = Math.floor(+b.n); const price = Math.floor(+b.price); const I = ITEMS[b.item]; f.stall = f.stall || [];
      if (!I || !(n >= 1 && n <= 10) || (f.inv[b.item] || 0) < n) throw E('Tezgâha koyacak ürünün yok.');
      if (f.stall.length >= STALL_SLOTS) throw E('Tezgâh dolu.');
      if (!(price >= 1 && price <= n * I[1] * 2)) throw E(`Fiyat 1 ile ${n * I[1] * 2} altın arasında olmalı.`);
      take(f, { [b.item]: n }); f.stall.push({ id: nanoid(6), k: b.item, n, price });
    },
    stallCancel(f, b) { const i = (f.stall || []).findIndex((x) => x.id === b.id); if (i < 0) throw E('Bulunamadı.'); const [x] = f.stall.splice(i, 1); give(f, x.k, x.n); },
    coopStart(f, b, fx, user) {
      if (coopOf(f)) throw E('Zaten bir ortak siparişin var.');
      const p = b.uid !== f.id && !isBlocked(f.id, b.uid) && store.get('farms', b.uid); if (!p) throw E('Bu kişinin çiftliği yok.');
      if (coopOf(p)) throw E('Bu komşunun zaten bir ortak siparişi var.');
      const lvl = Math.min(f.lvl, p.lvl); const pool = Object.entries(CROPS).filter(([, c]) => c.lvl <= lvl).map(([k]) => [k, Math.min(40, 12 + lvl * 2)]);
      if (lvl >= 2) pool.push(['egg', 8]); if (lvl >= 3) pool.push(['bread', 6]);
      const needs = {}; for (let i = 0; i < 3 && pool.length; i++) { const [k, n] = pool.splice(rnd(0, pool.length - 1), 1)[0]; needs[k] = n; }
      const c = store.put('farm_coops', { id: nanoid(8), a: f.id, b: p.id, need: needs, got: {}, by: {}, end: now() + COOP_DAYS * 1440 * MIN, at: now() });
      f.coop = c.id; p.coop = c.id; save(p);
      notify(p.id, { type: 'farm', fromId: f.id, text: `${user.username} seni SwipeFarm'da ortak siparişe davet etti. Birlikte doldurun, ikiniz de ödül kazanın.`, url: '/#/farm' });
    },
    coopGive(f, b, fx) {
      const c = coopOf(f); if (!c) throw E('Ortak siparişin yok.');
      const n = Math.min(Math.floor(+b.n) || 0, (c.need[b.item] || 0) - (c.got[b.item] || 0), f.inv[b.item] || 0); if (!(n > 0)) throw E('Bu ürünü veremezsin.');
      take(f, { [b.item]: n }); c.got[b.item] = (c.got[b.item] || 0) + n; c.by[f.id] = (c.by[f.id] || 0) + n; gain(f, Math.ceil(n / 2), fx);
      if (Object.entries(c.need).every(([k, v]) => (c.got[k] || 0) >= v)) { // tamamlandı: ikisine de ödül
        c.done = now(); const pid = c.a === f.id ? c.b : c.a; const p = store.get('farms', pid);
        [f, p].filter(Boolean).forEach((x) => { x.coins += COOP_COINS; x.stock = x.stock || {}; x.stock.fountain = (x.stock.fountain || 0) + 1; delete x.coop; stat(x, 'coop'); });
        fx.push({ t: 'coins', n: COOP_COINS }, { t: 'decor', k: 'fountain' }); gain(f, 60, fx);
        if (p) { gain(p, 60, []); save(p); notify(pid, { type: 'farm', fromId: f.id, text: 'Ortak siparişiniz tamamlandı! Ödülün çiftliğinde: altın ve koleksiyonluk bir çeşme.', url: '/#/farm' }); }
      }
      store.put('farm_coops', c);
    },
    questClaim(f, b, fx) {
      const q = questOf(f); if (q.claimed) throw E('Bugünkü sandığı açtın. Yarın yeni görevler gelir.'); if (q.list.some((x) => x.got < x.n)) throw E('Önce bütün görevleri bitir.');
      q.claimed = 1; f.coins += q.coins; fx.push({ t: 'coins', n: q.coins }); gain(f, q.xp, fx); stat(f, 'quest'); evAdd(f, 2);
    },
    achClaim(f, b, fx) {
      const a = ACH[b.k]; if (!a) throw E('Başarım bulunamadı.'); f.ach = f.ach || {}; if (f.ach[b.k]) throw E('Bu ödülü aldın.'); if (statOf(f, a.s) < a.n) throw E('Bu başarım henüz tamamlanmadı.');
      f.ach[b.k] = now(); f.coins += a.coins; fx.push({ t: 'coins', n: a.coins });
    },
    boatFill(f, b) { const bt = boatOf(f); const c = bt && !bt.sent && bt.crates[+b.i]; if (!c || c.done) throw E('Bu kasa dolu.'); if (!has(f, { [c.k]: c.n })) throw E('Bu kasa için ürünün eksik.'); take(f, { [c.k]: c.n }); c.done = 1; },
    boatSend(f, b, fx) { const bt = boatOf(f); if (!bt || bt.sent) throw E('Tekne bugün yola çıktı. Yarın yenisi gelir.'); if (bt.crates.some((c) => !c.done)) throw E('Önce bütün kasaları doldur.');
      bt.sent = 1; f.coins += bt.coins; fx.push({ t: 'coins', n: bt.coins }); gain(f, bt.xp, fx); stat(f, 'boat'); evAdd(f, 3); },
    upgrade(f, b) { // odun ve taşla bina yükseltme: üretim hızlanır
      const T = TYPES[b.b]; if (!T || T.kind !== 'build' || !count(f, b.b)) throw E('Önce bu binayı kur.'); f.bu = f.bu || {}; const l = f.bu[b.b] || 0; const U = UPG[l]; if (!U) throw E('Bu bina en üst seviyede.');
      if (!has(f, { wood: U.wood, stone: U.stone })) throw E(`Yükseltme için ${U.wood} odun ve ${U.stone} taş gerekli.`); if (f.coins < U.coins) throw E('Altının yetmiyor.');
      take(f, { wood: U.wood, stone: U.stone }); f.coins -= U.coins; f.bu[b.b] = l + 1;
    },
    petBuy(f, b) { const P = PETS[b.t]; if (!P) throw E('Bulunamadı.'); if (f.lvl < P.lvl) throw E(`Evcil hayvan ${P.lvl}. seviyede açılır.`); if (f.pet?.t === b.t) throw E('Zaten seninle.');
      f.pets = f.pets || {}; if (!f.pets[b.t]) { if (f.coins < P.cost) throw E('Altının yetmiyor.'); f.coins -= P.cost; f.pets[b.t] = 1; } f.pet = { t: b.t, fed: 0 }; },
    petFeed(f, b) { const P = f.pet && PETS[f.pet.t]; if (!P) throw E('Evcil hayvanın yok.'); if (f.pet.fed) throw E('Karnı tok, etrafı kolaçan ediyor.'); if (!P.food.includes(b.item) || !(f.inv[b.item] > 0)) throw E('Bunu yemez.');
      take(f, { [b.item]: 1 }); f.pet.fed = now(); stat(f, 'pet'); },
    petTake(f, b, fx) { if (!f.pet?.fed || now() - f.pet.fed < PET_T) throw E('Henüz bir şey bulamadı.'); f.pet.fed = 0;
      if (Math.random() < 0.6 || room(f) < 3) { const c = rnd(20, 60); f.coins += c; fx.push({ t: 'coins', n: c }); } else { const ks = Object.entries(CROPS).filter(([, c]) => c.lvl <= f.lvl).map(([k]) => k); const k = ks[rnd(0, ks.length - 1)]; give(f, k, 3); fx.push({ t: 'item', k, n: 3 }); }
      gain(f, 3, fx); },
    fit(f, b, fx, user) { const F = FITS[b.k]; if (!F) throw E('Kıyafet bulunamadı.'); f.fits = f.fits || {};
      if (b.k !== 'a' && !f.fits[b.k]) { if (F.gem) pay(user, F.gem, `fit_${b.k}`); else { if (f.coins < F.cost) throw E('Altının yetmiyor.'); f.coins -= F.cost; } f.fits[b.k] = 1; } f.fit = b.k; },
    evClaim(f, b, fx) { const e = evOf(f); const i = +b.i; const S = e && EV_STEPS[i]; if (!S) throw E('Şu an şenlik yok.'); if (f.ev.got[i]) throw E('Bu ödülü aldın.'); if (f.ev.pts < S.pts) throw E('Şenlik puanın yetmiyor.');
      f.ev.got[i] = 1; if (S.coins) { f.coins += S.coins; fx.push({ t: 'coins', n: S.coins }); } if (S.decor != null) { const k = e.decor[S.decor]; f.stock = f.stock || {}; f.stock[k] = (f.stock[k] || 0) + 1; fx.push({ t: 'decor', k }); } },
    spin(f, b, fx, user) { // şans çarkı: günde bir ücretsiz, ikincisi jetonla
      if (f.spin?.day !== day()) f.spin = { day: day(), n: 0 }; if (f.spin.n >= 2) throw E('Bugünkü çevirme hakların bitti. Yarın yine gel.'); if (f.spin.n === 1) pay(user, SPIN_GEM, 'spin');
      f.spin.n += 1; let r = Math.random() * WHEEL_W.reduce((a, c) => a + c, 0); let i = 0; while (i < WHEEL.length - 1 && (r -= WHEEL_W[i]) >= 0) i++;
      const P = WHEEL[i]; if (P.coins) { f.coins += P.coins; fx.push({ t: 'coins', n: P.coins, late: 1 }); } if (P.item) { give(f, P.item[0], P.item[1]); fx.push({ t: 'item', k: P.item[0], n: P.item[1], late: 1 }); } if (P.xp) gain(f, P.xp, fx);
      return { spin: i };
    },
    bookDel(f, b) { f.book = (f.book || []).filter((x) => x.id !== b.id); },
    clubClaim(f, b, fx) { const c = clubRows(f).find((x) => x.id === b.club); if (!c) throw E('Bu kulübün üyesi değilsin.'); if (c.claimed) throw E('Bu haftanın kulüp ödülünü aldın.'); if (c.sum < c.target) throw E('Kulüp hedefi henüz dolmadı.'); if (c.mine < 30) throw E('Ödül için bu hafta en az 30 deneyim kazanmalısın.');
      if (f.clubW?.wk !== week()) f.clubW = { wk: week(), ids: {} }; f.clubW.ids[c.id] = 1; f.coins += CLUB_PRIZE; fx.push({ t: 'coins', n: CLUB_PRIZE }); gain(f, 30, fx); },
    notif(f, b) { if (b.on) delete f.noNotif; else f.noNotif = 1; }, // "tarlan hazır" bildirimi aç/kapat
    barn(f) { const c = barnUpCost(f.bl); if (f.coins < c) throw E('Altının yetmiyor.'); f.coins -= c; f.bl = (f.bl || 0) + 1; },
  };

  app.get('/api/farm', auth, (req, res) => { const f = load(req.user.id); f.seen = now(); save(f); res.json({ cfg: CFG, farm: out(f) }); });
  app.post('/api/farm/act', auth, (req, res) => {
    const f = load(req.user.id); const fn = ACT[req.body?.a]; const fx = [];
    if (!fn) return res.status(400).json({ error: 'Bilinmeyen işlem.' });
    try { const extra = fn(f, req.body, fx, req.user) || {}; touch(f); f.seen = now(); save(f); res.json({ farm: out(f), fx, ...extra }); } catch (e) { if (!e.status) throw e; res.status(e.status).json({ error: e.message, farm: out(f) }); }
  });
  // komşular: takip ettiklerinin çiftlikleri + en iyi çiftçiler
  app.get('/api/farm/neighbors', auth, (req, res) => {
    const me = req.user.id; const row = (f) => { const u = store.get('users', f.id); return u && !isBlocked(me, u.id) ? { user: brief(u), lvl: f.lvl, harv: f.harv || 0 } : null; };
    const fol = store.filter('follows', (x) => x.from === me && x.status !== 'pending').map((x) => store.get('farms', x.to)).filter(Boolean).sort((a, b) => b.lvl - a.lvl || b.xp - a.xp).slice(0, 40).map(row).filter(Boolean);
    const top = store.all('farms').sort((a, b) => b.lvl - a.lvl || b.xp - a.xp).slice(0, 10).map(row).filter(Boolean);
    res.json({ following: fol, top });
  });
  // başkasının çiftliğini gez
  const visitOut = (f, me) => { const mine = me.helpDay === day() ? me.helpN : 0; return { lvl: f.lvl, objs: f.objs, pens: f.pens, q: Object.fromEntries(Object.entries(f.q).map(([k, v]) => [k, v.map((x) => ({ end: x.end }))])), helpsLeft: Math.max(0, HELPS - mine), now: now(),
    n: size(f), stall: f.stall || [], myCoins: me.coins, myInv: me.inv, gifted: me.giftDay === day(), canCoop: !coopOf(f) && !coopOf(me),
    fit: f.fit || 'a', pet: petOut(f), bu: f.bu || {}, boat: boatOut(f), likes: f.likes || 0, liked: (f.likeBy || {})[me.id] === day(), book: bookOut(f, 6), wrote: (f.book || []).some((x) => x.from === me.id && x.day === day()), pair: pairOut(me.id, f.id) }; };
  // profil ve sohbetteki "Çiftliğini gez" düğmesi için: bu kişinin çiftliği var mı?
  app.get('/api/farm/has/:uid', auth, (req, res) => {
    const f = req.params.uid !== req.user.id && !isBlocked(req.user.id, req.params.uid) && store.get('farms', req.params.uid);
    res.json({ lvl: f ? f.lvl : 0, badges: f ? Object.keys(f.ach || {}).length : 0 });
  });
  app.get('/api/farm/of/:uid', auth, (req, res) => {
    const u = store.get('users', req.params.uid) || store.find('users', (x) => x.username === req.params.uid);
    const f = u && u.id !== req.user.id && !isBlocked(req.user.id, u.id) && store.get('farms', u.id);
    if (!f) return res.status(404).json({ error: 'Bu kişinin henüz bir çiftliği yok.' });
    res.json({ cfg: CFG, user: brief(u), farm: visitOut(f, load(req.user.id)) });
  });
  // yardım: büyüyen bir ekini sula, kalan süresi %30 kısalır. Günde 5 yardım; yardım eden de ödül alır.
  app.post('/api/farm/of/:uid/help', auth, (req, res) => {
    const f = req.params.uid !== req.user.id && !isBlocked(req.user.id, req.params.uid) && store.get('farms', req.params.uid);
    if (!f) return res.status(404).json({ error: 'Çiftlik bulunamadı.' });
    const me = load(req.user.id); if (me.helpDay !== day()) { me.helpDay = day(); me.helpN = 0; }
    if (me.helpN >= HELPS) return res.status(400).json({ error: 'Bugünlük yardım hakkın bitti. Yarın yine gel.' });
    const o = f.objs.find((x) => x.id === req.body?.id && x.t === 'plot'); const c = o && CROPS[o.crop];
    if (!c || now() - o.at >= c.t) return res.status(400).json({ error: 'Burada sulanacak ekin yok.' });
    if (o.h) return res.status(400).json({ error: 'Bu ekin zaten sulanmış.' });
    o.at -= Math.round((c.t - (now() - o.at)) * 0.3); o.h = 1;
    f.helpedBy = f.helpedBy || {}; const first = f.helpedBy[me.id] !== day(); f.helpedBy = { ...Object.fromEntries(Object.entries(f.helpedBy).filter(([, d]) => d === day())), [me.id]: day() };
    bump(me, 'help'); stat(me, 'help'); save(f); me.helpN += 1; me.coins += 3; const fx = [{ t: 'coins', n: 3 }]; gain(me, 2, fx); save(me);
    if (first) notify(f.id, { type: 'farm', fromId: me.id, text: `${req.user.username} çiftliğine uğradı ve ekinlerini suladı.`, url: '/#/farm' });
    res.json({ farm: visitOut(f, me), fx });
  });
  // hediye: günde bir kez, ambarından bir üründen en çok 3 tane. Zaten yazışıyorlarsa sohbete de düşer.
  app.post('/api/farm/of/:uid/gift', auth, (req, res) => {
    const uid = req.params.uid; const f = uid !== req.user.id && !isBlocked(req.user.id, uid) && store.get('farms', uid);
    if (!f) return res.status(404).json({ error: 'Çiftlik bulunamadı.' });
    const me = load(req.user.id); const k = req.body?.item; const I = ITEMS[k]; const n = Math.min(3, Math.floor(+req.body?.n) || 1, me.inv[k] || 0);
    if (me.giftDay === day()) return res.status(400).json({ error: 'Bugün hediyeni gönderdin. Yarın yine gönderebilirsin.' });
    if (!I || !(n > 0)) return res.status(400).json({ error: 'Gönderecek ürünün yok.' });
    take(me, { [k]: n }); give(f, k, n); me.giftDay = day(); stat(me, 'gift'); const fx = []; gain(me, 3, fx); save(me); save(f);
    const what = `${n} ${I[0].toLocaleLowerCase('tr-TR')}`; const chat = store.get('chats', [me.id, f.id].sort().join('_')); let sent = null;
    if (chat) { try { sent = ctx.sendMessage?.(chat, me.id, { text: `SwipeFarm'dan sana ${what} gönderdim. Ambarına bak!` }); } catch { sent = null; } }
    if (!sent) notify(f.id, { type: 'farm', fromId: me.id, text: `${req.user.username} sana SwipeFarm'dan ${what} gönderdi.`, url: '/#/farm' });
    res.json({ farm: visitOut(f, me), fx, sent: { k, n } });
  });
  // komşunun tezgâhından alışveriş
  app.post('/api/farm/of/:uid/stall', auth, (req, res) => {
    const uid = req.params.uid; const f = uid !== req.user.id && !isBlocked(req.user.id, uid) && store.get('farms', uid);
    const i = f ? (f.stall || []).findIndex((x) => x.id === req.body?.id) : -1;
    if (i < 0) return res.status(404).json({ error: 'Bu ürün satılmış.' });
    const me = load(req.user.id); const x = f.stall[i];
    if (me.coins < x.price) return res.status(400).json({ error: 'Altının yetmiyor.' });
    if (room(me) < x.n) return res.status(400).json({ error: 'Ambarında yer yok.' });
    f.stall.splice(i, 1); me.coins -= x.price; give(me, x.k, x.n); f.coins += x.price; save(me); save(f);
    notify(f.id, { type: 'farm', fromId: me.id, text: `${req.user.username} tezgâhından ${x.n} ${ITEMS[x.k][0].toLocaleLowerCase('tr-TR')} aldı: +${x.price} altın.`, url: '/#/farm' });
    res.json({ farm: visitOut(f, me), fx: [{ t: 'item', k: x.k, n: x.n }] });
  });
  const other = (req) => { const uid = req.params.uid; return uid !== req.user.id && !isBlocked(req.user.id, uid) && store.get('farms', uid); };
  // komşunun teknesine kasa doldur: ürün senden, karşılığı altın ve deneyim
  app.post('/api/farm/of/:uid/boat', auth, (req, res) => {
    const f = other(req); const bt = f && boatOf(f); const c = bt && !bt.sent && bt.crates[+req.body?.i];
    if (!c || c.done) return res.status(400).json({ error: 'Bu kasa dolmuş.' });
    const me = load(req.user.id); if (!has(me, { [c.k]: c.n })) return res.status(400).json({ error: 'Bu kasa için ürünün eksik.' });
    take(me, { [c.k]: c.n }); c.done = 1; c.by = me.id; const pay2 = c.n * ITEMS[c.k][1]; me.coins += pay2; const fx = [{ t: 'coins', n: pay2 }]; gain(me, 4, fx); save(me); save(f);
    notify(f.id, { type: 'farm', fromId: me.id, text: `${req.user.username} teknendeki bir kasayı doldurdu.`, url: '/#/farm' });
    res.json({ farm: visitOut(f, me), fx });
  });
  // ziyaretçi defteri: günde bir not ve bir beğeni
  app.post('/api/farm/of/:uid/book', auth, (req, res) => {
    const f = other(req); if (!f) return res.status(404).json({ error: 'Çiftlik bulunamadı.' });
    let text = String(req.body?.text || '').replace(/\s+/g, ' ').trim().slice(0, 80); if (text.length < 2) return res.status(400).json({ error: 'Bir şeyler yaz.' });
    text = ctx.moderation?.mask ? ctx.moderation.mask(text) : text; f.book = f.book || [];
    if (f.book.some((x) => x.from === req.user.id && x.day === day())) return res.status(400).json({ error: 'Bugün bu deftere yazdın. Yarın yine yazabilirsin.' });
    f.book.unshift({ id: nanoid(6), from: req.user.id, text, at: now(), day: day() }); f.book = f.book.slice(0, 30); save(f);
    notify(f.id, { type: 'farm', fromId: req.user.id, text: `${req.user.username} ziyaretçi defterine yazdı: ${text}`, url: '/#/farm' });
    res.json({ farm: visitOut(f, load(req.user.id)), fx: [] });
  });
  app.post('/api/farm/of/:uid/like', auth, (req, res) => {
    const f = other(req); if (!f) return res.status(404).json({ error: 'Çiftlik bulunamadı.' });
    if ((f.likeBy || {})[req.user.id] === day()) return res.status(400).json({ error: 'Bu çiftliği bugün beğendin.' });
    f.likeBy = { ...Object.fromEntries(Object.entries(f.likeBy || {}).filter(([, d]) => d === day())), [req.user.id]: day() }; f.likes = (f.likes || 0) + 1; save(f);
    res.json({ farm: visitOut(f, load(req.user.id)), fx: [] });
  });
  // çift bahçesi: eşleştiğin kişiyle her gün birlikte sulanan ağaç
  app.post('/api/farm/of/:uid/pair', auth, (req, res) => {
    const f = other(req); const a = req.user.id; if (!f || !matched(a, f.id)) return res.status(400).json({ error: 'Çift bahçesi yalnızca eşleştiğin kişilerle açılır.' });
    const id = [a, f.id].sort().join('_'); const p = store.get('farm_pairs', id) || { id, g: 0, w: {} }; if (p.w[a] === day()) return res.status(400).json({ error: 'Bugün suladın. Yarın yine gel.' });
    const me = load(a); const max = PAIR_STEPS[PAIR_STEPS.length - 1].g; const g0 = p.g; p.w[a] = day(); p.g = Math.min(max, p.g + (p.w[f.id] === day() ? 2 : 1)); const fx = [];
    PAIR_STEPS.filter((s) => g0 < s.g && p.g >= s.g).forEach((s) => { [me, f].forEach((x) => { x.coins += s.coins; if (s.decor) { x.stock = x.stock || {}; x.stock[s.decor] = (x.stock[s.decor] || 0) + 1; } });
      fx.push({ t: 'coins', n: s.coins }); if (s.decor) fx.push({ t: 'decor', k: s.decor });
      notify(f.id, { type: 'farm', fromId: a, text: `Çift bahçeniz büyüdü! Ödülün çiftliğinde: ${s.coins} altın${s.decor ? ' ve koleksiyonluk aşk ağacı' : ''}.`, url: `/#/farm/${a}` }); });
    if (g0 >= max) { me.coins += 10; fx.push({ t: 'coins', n: 10 }); } gain(me, 3, fx); store.put('farm_pairs', p); save(me); save(f);
    res.json({ farm: visitOut(f, me), fx });
  });
  app.get('/api/farm/pairs', auth, (req, res) => {
    const me = req.user.id; const list = store.filter('matches', (m) => (m.users || []).includes(me)).map((m) => m.users.find((u) => u !== me)).filter((u) => u && !isBlocked(me, u))
      .map((u) => { const f = store.get('farms', u); const usr = store.get('users', u); return f && usr ? { user: brief(usr), lvl: f.lvl, pair: pairOut(me, u) } : null; }).filter(Boolean).slice(0, 30);
    res.json({ list });
  });
  app.get('/api/farm/club', auth, (req, res) => res.json({ clubs: clubRows(load(req.user.id)), prize: CLUB_PRIZE }));
  // haftalık sıralama: o hafta kazanılan deneyim. Pazartesi sıfırlanır; ilk üçe altın ve altın kupa.
  app.get('/api/farm/rank', auth, (req, res) => {
    const me = req.user.id; const w = week(); const all = store.all('farms').filter((f) => f.wk === w && f.ws > 0).sort((a, b) => b.ws - a.ws);
    const rows = (list) => list.map((f, i) => { const u = store.get('users', f.id); return u && !isBlocked(me, u.id) ? { user: brief(u), score: f.ws, lvl: f.lvl, rank: i + 1 } : null; }).filter(Boolean);
    const fol = new Set(store.filter('follows', (x) => x.from === me && x.status !== 'pending').map((x) => x.to)); fol.add(me);
    const city = req.user.city || '';
    res.json({ ends: Date.parse(`${w}T00:00:00+03:00`) + 7 * 1440 * MIN, prize: WEEK_PRIZE, cityName: city,
      friends: rows(all.filter((f) => fol.has(f.id)).slice(0, 30)), city: city ? rows(all.filter((f) => (store.get('users', f.id)?.city || '') === city).slice(0, 20)) : [], all: rows(all.slice(0, 20)) });
  });
  function weekly() { // hafta değişince geçen haftanın ilk üçünü ödüllendir
    const w = week(); const m = store.get('farm_meta', 'week');
    if (!m) { store.put('farm_meta', { id: 'week', wk: w }); return 0; }
    if (m.wk === w) return 0;
    const top = store.all('farms').filter((f) => f.wk === m.wk && f.ws > 0).sort((a, b) => b.ws - a.ws).slice(0, 3);
    top.forEach((f, i) => { f.coins += WEEK_PRIZE[i]; f.stock = f.stock || {}; f.stock.trophy = (f.stock.trophy || 0) + 1; save(f);
      notify(f.id, { type: 'farm', title: 'SwipeFarm', text: `Geçen haftanın ${i + 1}. çiftçisi oldun! Ödülün: ${WEEK_PRIZE[i]} altın ve koleksiyonluk altın kupa.`, url: '/#/farm' }); });
    store.put('farm_meta', { id: 'week', wk: w }); return top.length;
  }
  module.exports._weekly = weekly;

  // "Tarlan hazır" bildirimi: ekili bütün tarlalar olgunlaştıysa ve oyuncu en az 10 dakikadır çiftliğe bakmadıysa
  // bir kez haber verilir. Aynı hasat için tekrar gönderilmez; günde en çok 2 bildirim.
  const AWAY = 10 * MIN; const STALE = 12 * 60 * MIN; const DAILY = 2;
  function scan() {
    const t = now(); let sent = 0;
    for (const f of store.all('farms')) {
      if (f.noNotif) continue;
      let last = 0; let ready = 0; let growing = false;
      for (const o of f.objs) { const c = o.t === 'plot' && CROPS[o.crop]; if (!c) continue; const end = o.at + c.t; if (end > t) { growing = true; break; } ready++; if (end > last) last = end; }
      if (growing || !ready || last <= (f.nT || 0) || (f.seen || 0) >= last || t - (f.seen || 0) < AWAY || t - last > STALE) continue;
      if (f.nDay === day() && (f.nN || 0) >= DAILY) continue;
      f.nN = f.nDay === day() ? (f.nN || 0) + 1 : 1; f.nDay = day(); f.nT = last; save(f); sent++;
      notify(f.id, { type: 'farm', title: 'SwipeFarm', text: `Tarlan hazır! ${ready} tarlada ekin hasat bekliyor.`, url: '/#/farm', tag: 'farm-ready' });
    }
    return sent;
  }
  setInterval(() => { try { weekly(); scan(); } catch (e) { console.error('farm scan', e.message); } }, MIN).unref?.();
  module.exports._scan = scan;
};
module.exports.CFG = CFG;
module.exports.need = need;

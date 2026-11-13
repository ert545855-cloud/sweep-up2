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
  // nadir ekinler: tohumu altınla alınmaz, tohum paketiyle ekilir (ödüllerden ve komşularla takastan gelir)
  blueberry: { name: 'Yaban mersini', lvl: 5, t: 45 * MIN, seed: 0, xp: 6, rare: 1 },
  lavender: { name: 'Lavanta', lvl: 5, t: 60 * MIN, seed: 0, xp: 7, rare: 1 },
  watermelon: { name: 'Karpuz', lvl: 5, t: 120 * MIN, seed: 0, xp: 10, rare: 1 },
};
const RARE = ['blueberry', 'lavender', 'watermelon'];
const ITEMS = {
  wheat: ['Buğday', 2], corn: ['Mısır', 4], carrot: ['Havuç', 6], tomato: ['Domates', 9], sunflower: ['Ayçiçeği', 20], pumpkin: ['Kabak', 28],
  egg: ['Yumurta', 12], milk: ['Süt', 26], feed_c: ['Tavuk yemi', 3], feed_w: ['İnek yemi', 5],
  bread: ['Ekmek', 18], cornbread: ['Mısır ekmeği', 55], cake: ['Havuçlu kek', 80], pizza: ['Pizza', 125],
  cream: ['Krema', 40], butter: ['Tereyağı', 70], cheese: ['Peynir', 105],
  strawberry: ['Çilek', 8], sugarcane: ['Şeker kamışı', 12], cotton: ['Pamuk', 24], apple: ['Elma', 9], honey: ['Bal', 34], wool: ['Yün', 46], gmilk: ['Keçi sütü', 36],
  feed_s: ['Küçükbaş yemi', 6], sugar: ['Şeker', 32], jam: ['Çilek reçeli', 80], marmalade: ['Elma marmelatı', 85], icecream: ['Dondurma', 120], honeyice: ['Ballı dondurma', 150],
  fish: ['Balık', 18], grillfish: ['Izgara balık', 60], fishsand: ['Balık ekmek', 85], wood: ['Odun', 14], stone: ['Taş', 20],
  blueberry: ['Yaban mersini', 34], lavender: ['Lavanta', 30], watermelon: ['Karpuz', 42], fert: ['Gübre', 8],
  s_blueberry: ['Yaban mersini tohumu', 15], s_lavender: ['Lavanta tohumu', 15], s_watermelon: ['Karpuz tohumu', 15],
};
// altın yıldızlı ürünler: gübrelenen ya da sulanan ekinden çıkar, daha pahalıya satılır
Object.entries(CROPS).forEach(([k, c]) => { ITEMS[`g_${k}`] = [`Altın ${c.name.toLocaleLowerCase('tr-TR')}`, Math.round(ITEMS[k][1] * 2.5)]; });
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
  compost: { name: 'Kompost', w: 1, h: 1, kind: 'build', lvl: 3, cost: 70, slots: 2 },
  silo: { name: 'Silo', w: 1, h: 1, kind: 'store', lvl: 4, cost: 240 },
  cellar: { name: 'Kiler', w: 1, h: 1, kind: 'store', lvl: 6, cost: 320 },
  swing: { name: 'Salıncak', w: 1, h: 1, kind: 'decor', lvl: 1, special: 'Arkadaş daveti ödülü' },
  rosette: { name: 'Yarışma kurdelesi', w: 1, h: 1, kind: 'decor', lvl: 1, special: 'Çiftlik yarışması ödülü' },
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
  compost: { fert: { in: { wheat: 2, corn: 1 }, out: 2, t: 6 * MIN, xp: 2, lvl: 3 } },
};
// depolar: ekinler siloya, işlenmiş ürünler kilere, gerisi ambara. Silo ya da kiler kurulmadıysa her şey ambarda durur.
// Tohum paketleri yer kaplamaz.
const KILER = new Set(Object.values(RECIPES).flatMap((r) => Object.keys(r)).filter((k) => !k.startsWith('feed') && k !== 'fert'));
const CAT = Object.fromEntries(Object.keys(ITEMS).map((k) => [k, k.startsWith('s_') ? null : CROPS[k] || k.startsWith('g_') ? 'silo' : KILER.has(k) ? 'cellar' : 'barn']));
const STORE = { silo: { name: 'Silo', cap: (l) => 60 + 30 * l, up: (l) => 120 * (l + 1) }, cellar: { name: 'Kiler', cap: (l) => 40 + 20 * l, up: (l) => 150 * (l + 1) } };
// hava durumu: herkes için aynı, 3 saatte bir değişir. Yağmurda ekilen ekin hızlı büyür ve sulanmış sayılır;
// sıcakta ekilen ekin susar, sulanmazsa yavaş büyür.
const WX = { sun: { name: 'Güneşli', k: 1 }, cloud: { name: 'Bulutlu', k: 1 }, rain: { name: 'Yağmurlu', k: 0.75 }, hot: { name: 'Sıcak', k: 1.4 } };
const WX_SLOT = 180 * MIN; const GOLD_W = 0.3; // sulanan ekinden altın ürün çıkma ihtimali (gübre: kesin)
// kasaba ziyaretçileri: çiftliğe uğrayıp bir ürün ister, çabuk verilirse bahşişi büyük olur
const VIS_LVL = 3; const VIS_STAY = 60 * MIN; const VIS_FAST = 15 * MIN;
const LOOK = { 'Ayşe Teyze': 'npc_a', 'Bakkal Rıza': 'npc_b', 'Pastacı Selin': 'npc_c', 'Muhtar Kemal': 'npc_b', 'Kahveci Deniz': 'npc_d', 'Aşçı Zeynep': 'npc_c', 'Manav Orhan': 'npc_d', 'Öğretmen Elif': 'npc_a', 'Fırıncı Cem': 'npc_d', 'Komşu Nermin': 'npc_a' };
const TUT_N = 6; const TUT_RW = { coins: 60, fert: 3 }; // ilk giriş rehberi
const INV_LVL = 5; const INV_RW = 300; // arkadaş daveti: davet edilen 5. seviyeye gelince ikisine de
const PLUS_STALL = 2; // SwipeUp+ üyelerine ek tezgâh yeri
const THEMES = ['En güzel bahçe', 'En çiçekli çiftlik', 'En düzenli tarlalar', 'Hayvan dostu çiftlik', 'Bereketli hasat', 'En şirin köşe'];
const CONTEST_PRIZE = [400, 250, 150]; const CONTEST_VOTES = 3; const CONTEST_LVL = 3;
const EMOTES = ['👋', '❤️', '😄', '👍', '🌻', 'Merhaba!', 'Çok güzel çiftlik!', 'Teşekkürler!', 'Görüşürüz!'];
const TRADE_MAX = 5; const TRADE_DAYS = 3;
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
const QUESTS = { harvest: 'Ekin hasat et', order: 'Sipariş teslim et', craft: 'Atölyelerden ürün al', collect: 'Hayvan ürünü topla', help: 'Komşunun ekinini sula', pick: 'Ağaçtan, kovandan ya da göletten ürün topla', visit: 'Kasaba ziyaretçisine ürün ver', water: 'Kendi ekinlerini sula' };
const ACH = {
  harv1: { name: 'Bereketli eller', desc: '100 hasat yap', s: 'harv', n: 100, coins: 150 }, harv2: { name: 'Hasat ustası', desc: '1000 hasat yap', s: 'harv', n: 1000, coins: 800 },
  ord: { name: 'Güvenilir satıcı', desc: '25 sipariş teslim et', s: 'orders', n: 25, coins: 200 }, craft: { name: 'Usta üretici', desc: 'Atölyelerden 50 ürün al', s: 'craft', n: 50, coins: 250 },
  help: { name: 'İyi komşu', desc: 'Komşularının 20 ekinini sula', s: 'help', n: 20, coins: 150 }, gift: { name: 'Eli açık', desc: '5 hediye gönder', s: 'gift', n: 5, coins: 120 },
  fish: { name: 'Balıkçı', desc: '20 balık tut', s: 'fish', n: 20, coins: 200 }, boat: { name: 'Kaptanın dostu', desc: '5 tekne uğurla', s: 'boat', n: 5, coins: 300 },
  lvl: { name: 'Tecrübeli çiftçi', desc: '10. seviyeye ulaş', s: 'lvl', n: 10, coins: 300 }, coop: { name: 'Omuz omuza', desc: 'Bir ortak siparişi tamamla', s: 'coop', n: 1, coins: 150 },
  quest: { name: 'Görev insanı', desc: '10 gün günlük görevleri bitir', s: 'quest', n: 10, coins: 250 }, pet: { name: 'Can dostu', desc: 'Evcil hayvanını 10 kez besle', s: 'pet', n: 10, coins: 150 },
  gold: { name: 'Altın eller', desc: '25 kez altın yıldızlı ürün hasat et', s: 'gold', n: 25, coins: 250 }, vis: { name: 'Kasabanın gözdesi', desc: '30 kasaba ziyaretçisini memnun et', s: 'vis', n: 30, coins: 250 },
  trade: { name: 'Tohum tüccarı', desc: '5 tohum takası yap', s: 'trade', n: 5, coins: 200 },
};
const PETS = { cat: { name: 'Kedi', cost: 400, lvl: 3, food: ['milk', 'fish'] }, dog: { name: 'Köpek', cost: 400, lvl: 3, food: ['bread', 'egg'] } }; const PET_T = 120 * MIN;
const FITS = { a: { name: 'Hasır şapka', cost: 0 }, b: { name: 'Mavi tulum', cost: 300 }, c: { name: 'Bahar bahçıvanı', cost: 500 }, d: { name: 'Kovboy', gem: 25 }, e: { name: 'Altın yelekli', plus: 1 } };
// mevsimlik şenlikler (ay-gün, TSİ). Şenlik puanı: sipariş +1, günlük görev sandığı +2, tekne +3.
const EVENTS = [{ id: 'hasat', name: 'Hasat şenliği', from: '10-20', to: '11-20', decor: ['cornstack', 'haycart'] }, { id: 'yilbasi', name: 'Yılbaşı şenliği', from: '12-15', to: '01-05', decor: ['snowman', 'xmastree'] },
  { id: 'bahar', name: 'Bahar şenliği', from: '04-15', to: '05-10', decor: ['tulips', 'maypole'] }, { id: 'yaz', name: 'Yaz şenliği', from: '07-01', to: '07-31', decor: ['parasol', 'melon'] }];
const EV_STEPS = [{ pts: 5, coins: 150 }, { pts: 12, decor: 0 }, { pts: 25, decor: 1 }];
const WHEEL = [{ coins: 20 }, { item: ['feed_c', 2] }, { coins: 50 }, { xp: 15 }, { coins: 100 }, { seed: 1 }, { coins: 250 }, { item: ['bread', 2] }]; const WHEEL_W = [24, 16, 18, 14, 10, 10, 2, 6]; const SPIN_GEM = 10; // seed: oyuncunun yöresinin nadir tohumu
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
const CFG = { N, CROPS, ITEMS, TYPES, RECIPES, PENS, PROD, XPN, HELPS, DAILY7, RUSH_MIN, RUSH_MAX, STALL_SLOTS, WEEK_PRIZE, COOP_COINS, UPG, QUESTS, PETS, PET_T, FITS, WHEEL, SPIN_GEM, EV_STEPS, PAIR_STEPS, CLUB_PRIZE, BOAT_LVL,
  RARE, CAT, WX: Object.fromEntries(Object.entries(WX).map(([k, v]) => [k, v.name])), VIS_LVL, VIS_FAST, TUT_N, TUT_RW, INV_LVL, INV_RW, PLUS_STALL, CONTEST_PRIZE, CONTEST_VOTES, CONTEST_LVL, EMOTES, TRADE_MAX, GOLD_W };

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

  const has = (f, items) => Object.entries(items).every(([k, n]) => (f.inv[k] || 0) >= n);
  const take = (f, items) => { Object.entries(items).forEach(([k, n]) => { f.inv[k] -= n; if (f.inv[k] <= 0) delete f.inv[k]; }); };
  const give = (f, k, n) => { f.inv[k] = (f.inv[k] || 0) + n; };
  const count = (f, t) => f.objs.filter((o) => o.t === t).length;
  // depolar
  const LV = { barn: 'bl', silo: 'sl', cellar: 'cl' };
  const storeOf = (f, k) => { const c = CAT[k]; if (!c) return null; return c !== 'barn' && !count(f, c) ? 'barn' : c; };
  const capOf = (f, s) => (s === 'barn' ? barnCap(f.bl) : STORE[s].cap(f[LV[s]] || 0));
  const upOf = (f, s) => (s === 'barn' ? barnUpCost(f.bl) : STORE[s].up(f[LV[s]] || 0));
  const usedOf = (f, s) => Object.entries(f.inv).reduce((a, [k, n]) => a + (storeOf(f, k) === s ? n : 0), 0);
  const room = (f, k) => { const s = storeOf(f, k); return s ? capOf(f, s) - usedOf(f, s) : 1e9; };
  const storesOut = (f) => Object.fromEntries(['barn', 'silo', 'cellar'].map((s) => [s, s === 'barn' || count(f, s) ? { used: usedOf(f, s), cap: capOf(f, s), up: upOf(f, s) } : null]));
  // ekin süresi: hava ve sulama çarpanıyla
  const cropT = (o) => Math.round(CROPS[o.crop].t * (o.k || 1));
  const ready = (o) => !!o.crop && now() - o.at >= cropT(o);
  const frac = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
  function wxAt(t) {
    const i = Math.floor((t + 3 * 3600000) / WX_SLOT); const m = new Date(t + 3 * 3600000).getUTCMonth();
    const w = m === 11 || m < 2 ? [5, 4, 4, 0] : m < 5 ? [5, 3, 4, 1] : m < 8 ? [6, 1, 2, 4] : [4, 4, 4, 1]; // güneş, bulut, yağmur, sıcak
    let r = frac(i) * w.reduce((a, b) => a + b, 0); let j = 0; while (j < 3 && (r -= w[j]) >= 0) j++;
    return { k: ['sun', 'cloud', 'rain', 'hot'][j], until: (i + 1) * WX_SLOT - 3 * 3600000 };
  }
  const wxOut = () => { const a = wxAt(now()); return { k: a.k, until: a.until, next: wxAt(a.until + 1000).k }; };
  const homeSeed = (uid) => RARE[[...String(uid)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % RARE.length]; // yöre tohumu: herkese bir tür
  const isPlusU = (uid) => { const u = store.get('users', uid); return !!(eco?.isPlus ? eco.isPlus(u) : u && (u.plusUntil || 0) > now()); };
  const free = (f, t, x, y, skip) => {
    const T = TYPES[t]; const S = size(f); if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x + T.w > S || y + T.h > S) return false;
    return !f.objs.some((o) => o.id !== skip && x < o.x + TYPES[o.t].w && o.x < x + T.w && y < o.y + TYPES[o.t].h && o.y < y + T.h);
  };
  const oid = (f) => `o${(f.seq = (f.seq || 0) + 1)}`;

  function mkOrder(f) {
    const pool = [];
    Object.entries(CROPS).forEach(([k, c]) => { if (c.lvl <= f.lvl && !c.rare) pool.push([k, 3, 4 + Math.min(f.lvl, 5)]); });
    Object.entries(PENS).forEach(([p, P]) => { if ((f.pens[p] || []).length) pool.push([P.out, 1, 2 + (f.pens[p].length > 1 ? 2 : 0)]); });
    Object.entries(PROD).forEach(([t, P]) => { if (count(f, t) && !P.raw) pool.push([P.out, 2, 4]); });
    Object.entries(RECIPES).forEach(([b, rs]) => { if (count(f, b)) Object.entries(rs).forEach(([k, r]) => { if (r.lvl <= f.lvl && !k.startsWith('feed') && k !== 'fert') pool.push([k, 1, k === 'bread' ? 3 : 2]); }); });
    const lines = Math.min(pool.length, 1 + (Math.random() < 0.55 ? 1 : 0) + (f.lvl >= 4 && Math.random() < 0.3 ? 1 : 0));
    const needs = {}; let V = 0;
    for (let i = 0; i < lines; i++) { const [k, a, b] = pool.splice(rnd(0, pool.length - 1), 1)[0]; needs[k] = rnd(a, b); V += needs[k] * ITEMS[k][1]; }
    const m = 0.75 + Math.random() * 0.5;
    return { id: nanoid(6), who: WHO[rnd(0, WHO.length - 1)], need: needs, coins: Math.max(4, Math.round(V * 1.6 * m)), xp: Math.max(2, Math.round(V * 0.35 * (2 - m))) };
  }
  // sipariş yuvalarını doldur (bekleme süresi dolanların yerine yenisi gelir)
  // kasaba ziyaretçisi: elindeki ürünlerden birini ister
  function mkVis(f) {
    const pool = [];
    Object.entries(CROPS).forEach(([k, c]) => { if (c.lvl <= f.lvl && !c.rare) pool.push([k, 3, 6, 5]); });
    Object.entries(PENS).forEach(([p, P]) => { if ((f.pens[p] || []).length) pool.push([P.out, 1, 3, 3]); });
    Object.entries(PROD).forEach(([t, P]) => { if (count(f, t) && !P.raw) pool.push([P.out, 2, 3, 2]); });
    Object.entries(RECIPES).forEach(([b, rs]) => { if (count(f, b)) Object.entries(rs).forEach(([k, r]) => { if (r.lvl <= f.lvl && !k.startsWith('feed') && k !== 'fert') pool.push([k, 1, 2, 2]); }); });
    RARE.forEach((k) => { if (f.lvl >= CROPS[k].lvl && ((f.st || {})[`h_${k}`] || f.inv[k])) pool.push([k, 1, 3, 2]); });
    if (count(f, 'compost')) Object.entries(CROPS).forEach(([k, c]) => { if (c.lvl <= f.lvl && !c.rare && Math.random() < 0.35) pool.push([`g_${k}`, 1, 3, 2]); });
    let tot = pool.reduce((a, p) => a + p[3], 0) * Math.random(); let it = pool[0]; for (const p of pool) { if ((tot -= p[3]) <= 0) { it = p; break; } }
    const [k, a, b] = it; const n = rnd(a, b); const who = WHO[rnd(0, WHO.length - 1)]; const V = n * ITEMS[k][1];
    return { id: nanoid(6), who, look: LOOK[who] || 'npc_a', k, n, coins: Math.max(6, Math.round(V * 1.35) + 4), xp: Math.max(2, Math.round(V * 0.22)), at: now(), until: now() + VIS_STAY, sx: rnd(0, 99) };
  }
  // sipariş yuvalarını doldur (bekleme süresi dolanların yerine yenisi gelir); ziyaretçiler, yağmur, nadir tohum
  function touch(f) {
    let ch = false;
    f.orders = f.orders.map((o) => (o.wait && o.wait <= now() ? (ch = true, mkOrder(f)) : o));
    while (f.orders.length < orderSlots(f.lvl)) { f.orders.push(mkOrder(f)); ch = true; }
    if (f.lvl >= VIS_LVL) {
      const n0 = (f.vis || []).length; f.vis = (f.vis || []).filter((v) => v.until > now()); if (f.vis.length !== n0) ch = true;
      if (!f.visAt) { f.visAt = now() + rnd(1, 3) * MIN; ch = true; }
      const max = f.lvl >= 8 ? 3 : 2;
      if (f.visAt <= now()) { if (f.vis.length < max) f.vis.push(mkVis(f)); f.visAt = now() + rnd(f.vis.length < max ? 12 : 8, 30) * MIN; ch = true; }
    }
    if (wxAt(now()).k === 'rain') { // yağmur, büyüyen ekinleri sular
      for (const o of f.objs) { if (o.t !== 'plot' || !o.crop || o.w || ready(o)) continue; o.w = 1; if (o.dry) { delete o.dry; o.k = 1; } ch = true; }
    }
    if (f.lvl >= CROPS.lavender.lvl && !f.seeded) { f.seeded = 1; give(f, `s_${homeSeed(f.id)}`, 3); ch = true; }
    if (f.lvl >= INV_LVL && !f.invRw && store.get('users', f.id)?.invitedBy) { inviteReward(f, []); ch = true; }
    return ch;
  }
  function create(uid) {
    const f = { id: uid, lvl: 1, xp: 0, coins: 60, inv: { wheat: 2 }, bl: 0, objs: [], pens: {}, q: {}, orders: [], seq: 0, helpDay: '', helpN: 0, helpedBy: {}, harv: 0, createdAt: now(), tut: 0 };
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
      if (f.lvl >= CROPS.lavender.lvl && !f.seeded) { f.seeded = 1; const s = `s_${homeSeed(f.id)}`; give(f, s, 3); fx.push({ t: 'item', k: s, n: 3, late: 1 }); }
      if (f.lvl >= INV_LVL && !f.invRw) inviteReward(f, fx);
    }
  }
  // arkadaş daveti: SwipeUp'a davetle gelen kişi çiftlikte 5. seviyeye ulaşınca ikisine de altın ve salıncak
  function inviteReward(f, fx) {
    const u = store.get('users', f.id); const by = u?.invitedBy && store.get('users', u.invitedBy); if (!by) return;
    f.invRw = now(); const p = store.get('farms', by.id) || create(by.id);
    [f, p].forEach((x) => { x.coins += INV_RW; x.stock = x.stock || {}; x.stock.swing = (x.stock.swing || 0) + 1; });
    fx.push({ t: 'coins', n: INV_RW, late: 1 }, { t: 'decor', k: 'swing' }); p.invN = (p.invN || 0) + 1; save(p);
    notify(by.id, { type: 'farm', fromId: f.id, title: 'SwipeFarm', text: `Davet ettiğin ${u.username} çiftlikte ${INV_LVL}. seviyeye ulaştı! İkinize de ${INV_RW} altın ve koleksiyonluk salıncak verildi.`, url: '/#/farm' });
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
    const L = f.lvl; const opt = [['craft', 3 + Math.floor(L / 3), hasAny(f, 'build')], ['collect', 3 + Math.floor(L / 4), hasAny(f, 'pen')], ['help', 3, L >= 2], ['pick', 3, f.objs.some((o) => PROD[o.t])],
      ['visit', 2 + Math.floor(L / 6), L >= VIS_LVL], ['water', 6 + L, L >= 2]].filter((x) => x[2]);
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
    const pool = Object.entries(CROPS).filter(([, c]) => c.lvl <= f.lvl && !c.rare).map(([k]) => [k, 4, 8]); Object.entries(PENS).forEach(([p, P]) => { if ((f.pens[p] || []).length) pool.push([P.out, 2, 3]); });
    const crates = []; let V = 0; for (let i = 0; i < 4; i++) { const [k, a, b] = pool[rnd(0, pool.length - 1)]; const n = rnd(a, b); crates.push({ k, n, done: 0 }); V += n * ITEMS[k][1]; }
    f.boat = { day: day(), crates, coins: Math.round(V * 1.5) + 40, xp: 20 + f.lvl * 3, sent: 0 }; return f.boat;
  }
  const boatOut = (f) => { const b = boatOf(f); return b ? { crates: b.crates.map((c) => ({ k: c.k, n: c.n, done: c.done, by: c.by ? store.get('users', c.by)?.username || null : null })), coins: b.coins, xp: b.xp, sent: b.sent } : null; };
  const petOut = (f) => (f.pet ? { t: f.pet.t, fed: f.pet.fed || 0 } : null);
  const bookOut = (f, n = 30) => (f.book || []).slice(0, n).map((x) => { const u = store.get('users', x.from); return u ? { id: x.id, user: brief(u), text: x.text, at: x.at } : null; }).filter(Boolean);
  const upK = (f, b) => { const l = (f.bu || {})[b] || 0; return l ? UPG[l - 1].k : 1; };
  const matched = (a, b) => !!store.get('matches', [a, b].sort().join('_'));
  const pairOut = (a, b) => { if (!matched(a, b)) return null; const p = store.get('farm_pairs', [a, b].sort().join('_')) || { g: 0, w: {} }; return { g: p.g, max: PAIR_STEPS[PAIR_STEPS.length - 1].g, me: p.w[a] === day(), them: p.w[b] === day() }; };

  const fitOf = (f, plus) => (f.fit === 'e' && !plus ? 'a' : f.fit || 'a');
  const spinFree = (plus) => (plus ? 2 : 1);
  const visOut = (f) => (f.vis || []).filter((v) => v.until > now()).map(({ id, who, look, k, n, coins, at, until, sx }) => ({ id, who, look, k, n, coins, at, until, sx }));
  const out = (f) => { const plus = isPlusU(f.id); return { quests: (() => { const q = questOf(f); return { list: q.list, coins: q.coins, xp: q.xp, claimed: !!q.claimed }; })(), ach: achOut(f), boat: boatOut(f), pet: petOut(f), fit: fitOf(f, plus), fits: { a: 1, ...(f.fits || {}), ...(plus ? { e: 1 } : {}) }, bu: f.bu || {},
    event: evOut(f), wheel: { n: f.spin?.day === day() ? f.spin.n : 0, free: spinFree(plus) }, likes: f.likes || 0, book: bookOut(f), lvl: f.lvl, xp: f.xp, need: need(f.lvl), coins: f.coins, inv: f.inv, cap: barnCap(f.bl), capUp: barnUpCost(f.bl), objs: f.objs, pens: f.pens, q: f.q, orders: f.orders,
    maxPlots: maxPlots(f.lvl), notif: !f.noNotif, helpsLeft: f.helpDay === day() ? Math.max(0, HELPS - f.helpN) : HELPS, now: now(),
    n: size(f), exp: EXP.find((e) => e.n > size(f)) || null, stock: f.stock || {}, stall: f.stall || [], daily: dailyOut(f), coop: coopOut(f), week: f.wk === week() ? f.ws || 0 : 0, jeton: jeton(f.id),
    stores: storesOut(f), wx: wxOut(), vis: visOut(f), plus, stallSlots: STALL_SLOTS + (plus ? PLUS_STALL : 0), tut: f.tut == null ? TUT_N : f.tut, home: homeSeed(f.id), invRw: !!f.invRw }; };

  function clubRows(f) { // kulüp çiftliği: üyelerin o haftaki deneyimi ortak hedefe sayılır
    const w = week(); return store.filter('club_members', (m) => m.uid === f.id).map((m) => { const mem = store.filter('club_members', (x) => x.clubId === m.clubId).map((x) => store.get('farms', x.uid)).filter(Boolean);
      const act = mem.filter((x) => x.wk === w && x.ws > 0); const sum = act.reduce((a, x) => a + x.ws, 0);
      return { id: m.clubId, name: ctx.clubRoom?.(`k_${m.clubId}`)?.name || 'Kulüp', farmers: mem.length, sum, target: 150 * Math.min(20, Math.max(2, mem.length)), mine: f.wk === w ? f.ws || 0 : 0, claimed: f.clubW?.wk === w && !!f.clubW.ids[m.clubId] }; });
  }
  // hasat: 2 ürün. Gübreli ekin altın yıldızlı çıkar, sulanan ekin şansla altın çıkar; nadir ekin tohumunu da geri verebilir.
  function reap(f, o, fx) {
    const c = CROPS[o.crop]; const gold = !!o.f || (!!o.w && Math.random() < GOLD_W); const k = gold ? `g_${o.crop}` : o.crop;
    give(f, k, 2); fx.push({ t: 'item', k, n: 2, at: o.id }); gain(f, c.xp, fx); if (gold) stat(f, 'gold');
    if (c.rare) { stat(f, `h_${o.crop}`); if (Math.random() < 0.35) { give(f, `s_${o.crop}`, 1); fx.push({ t: 'item', k: `s_${o.crop}`, n: 1, at: o.id }); } }
    ['crop', 'at', 'h', 'k', 'w', 'f', 'dry'].forEach((x) => delete o[x]); f.harv += 1;
  }
  const ACT = {
    collectAll(f, b, fx) { // "Hepsini topla": olgun ekinler, ağaçlar, hayvanlar ve atölyeler tek dokunuşta
      const raw = []; let full = false; const cnt = { harvest: 0, pick: 0, collect: 0, craft: 0 };
      for (const o of f.objs) {
        if (o.t === 'plot' && CROPS[o.crop] && ready(o)) { if (room(f, o.crop) < 2) { full = true; continue; } reap(f, o, raw); cnt.harvest++; continue; }
        const P = PROD[o.t]; if (!P || (o.at && now() - o.at < P.t)) continue;
        if (room(f, P.out) < P.n) { full = true; continue; }
        o.at = now(); give(f, P.out, P.n); raw.push({ t: 'item', k: P.out, n: P.n, at: o.id }); gain(f, P.xp, raw); cnt.pick++; if (P.out === 'fish') stat(f, 'fish');
      }
      Object.entries(PENS).forEach(([p, P]) => { const o = f.objs.find((x) => x.t === p);
        for (const a of f.pens[p] || []) { if (!a.at || now() - a.at < P.t) continue; if (room(f, P.out) < 1) { full = true; break; } a.at = 0; give(f, P.out, 1); raw.push({ t: 'item', k: P.out, n: 1, at: o?.id }); gain(f, P.xp, raw); cnt.collect++; } });
      Object.entries(f.q).forEach(([bk, q]) => { const o = f.objs.find((x) => x.t === bk);
        while (q.length && q[0].end <= now()) { const r = RECIPES[bk][q[0].r]; if (room(f, q[0].r) < r.out) { full = true; break; } give(f, q[0].r, r.out); raw.push({ t: 'item', k: q[0].r, n: r.out, at: o?.id }); gain(f, r.xp, raw); q.shift(); cnt.craft++; } });
      if (!Object.values(cnt).some(Boolean)) throw E(full ? 'Depoların dolu. Bir şeyler sat ya da depolarını büyüt.' : 'Şu an toplanacak bir şey yok.');
      const items = new Map(); let xp = 0; // aynı ürünleri birleştir, deneyimi tek seferde göster
      raw.forEach((x) => { if (x.t === 'item') { const m = items.get(x.k); if (m) m.n += x.n; else items.set(x.k, { ...x }); } else if (x.t === 'xp') xp += x.n; else fx.push(x); });
      fx.push(...items.values()); if (xp) fx.push({ t: 'xp', n: xp });
      bump(f, 'harvest', cnt.harvest); bump(f, 'pick', cnt.pick); bump(f, 'collect', cnt.collect); bump(f, 'craft', cnt.craft); stat(f, 'craft', cnt.craft);
      return { collected: cnt, full };
    },
    plantAll(f, b, fx) { const ids = f.objs.filter((o) => o.t === 'plot' && !o.crop).map((o) => o.id); if (!ids.length) throw E('Boş tarla yok.'); return ACT.plant(f, { crop: b.crop, ids }, fx); },
    serve(f, b, fx) { // kasaba ziyaretçisine istediğini ver: ücret + bahşiş (çabuk verilirse büyük), bazen nadir tohum
      const i = (f.vis || []).findIndex((v) => v.id === b.id && v.until > now()); if (i < 0) throw E('Bu ziyaretçi ayrılmış.');
      const v = f.vis[i]; if (!has(f, { [v.k]: v.n })) throw E(`${ITEMS[v.k][0]} yetmiyor.`);
      take(f, { [v.k]: v.n }); const fast = now() - v.at <= VIS_FAST; const tip = Math.round(v.coins * (fast ? 0.35 : 0.12));
      f.coins += v.coins + tip; fx.push({ t: 'coins', n: v.coins + tip }); gain(f, v.xp, fx); f.vis.splice(i, 1);
      let seed = null; if (Math.random() < (fast ? 0.25 : 0.1)) { seed = Math.random() < 0.7 ? homeSeed(f.id) : RARE[rnd(0, RARE.length - 1)]; give(f, `s_${seed}`, 1); fx.push({ t: 'item', k: `s_${seed}`, n: 1, late: 1 }); }
      stat(f, 'vis'); bump(f, 'visit'); evAdd(f, 1);
      return { served: { who: v.who, coins: v.coins, tip, fast, seed } };
    },
    shoo(f, b) { const n0 = (f.vis || []).length; f.vis = (f.vis || []).filter((v) => v.id !== b.id); if (f.vis.length === n0) throw E('Bu ziyaretçi ayrılmış.'); },
    storeUp(f, b) { // ambar, silo ve kiler büyütme
      const s = b.s; if (s !== 'barn' && !STORE[s]) throw E('Depo bulunamadı.'); if (s !== 'barn' && !count(f, s)) throw E(`Önce ${STORE[s].name.toLocaleLowerCase('tr-TR')} kur.`);
      const c = upOf(f, s); if (f.coins < c) throw E('Altının yetmiyor.'); f.coins -= c; f[LV[s]] = (f[LV[s]] || 0) + 1;
    },
    tut(f, b, fx) { // ilk giriş rehberi: adım adım ilerler, bitince küçük bir ödül
      const cur = f.tut == null ? TUT_N : f.tut;
      if (b.skip) { f.tut = TUT_N; return {}; } if (b.restart) { f.tut = 0; return {}; }
      const s = Math.floor(+b.step); if (s !== cur + 1 || cur >= TUT_N) return {};
      f.tut = s;
      if (s >= TUT_N && !f.tutRw) { f.tutRw = now(); f.coins += TUT_RW.coins; give(f, 'fert', TUT_RW.fert); fx.push({ t: 'coins', n: TUT_RW.coins }, { t: 'item', k: 'fert', n: TUT_RW.fert }); return { tutDone: 1 }; }
      return {};
    },
    plant(f, b, fx) {
      const c = CROPS[b.crop]; if (!c || c.lvl > f.lvl) throw E('Bu ekin henüz açılmadı.');
      const sk = `s_${b.crop}`; const w = wxAt(now()).k; let n = 0;
      for (const id of [].concat(b.ids || []).slice(0, 40)) {
        const o = f.objs.find((x) => x.id === id && x.t === 'plot'); if (!o || o.crop) continue;
        if (c.rare) { if (!(f.inv[sk] > 0)) { if (!n) throw E(`${ITEMS[sk][0]} kalmadı. Komşularınla takas edebilirsin.`); break; } take(f, { [sk]: 1 }); } else if (f.coins < c.seed) { if (!n) throw E('Tohum için altının yetmiyor.'); break; } else f.coins -= c.seed;
        o.crop = b.crop; o.at = now(); ['h', 'k', 'w', 'f', 'dry'].forEach((x) => delete o[x]);
        if (w === 'rain') { o.k = WX.rain.k; o.w = 1; } else if (w === 'hot') { o.k = WX.hot.k; o.dry = 1; }
        n++;
      }
      if (!n) throw E('Ekilecek boş tarla yok.');
      return { planted: n };
    },
    harvest(f, b, fx) {
      let n = 0; let full = false;
      for (const id of [].concat(b.ids || []).slice(0, 40)) {
        const o = f.objs.find((x) => x.id === id && x.t === 'plot'); if (!o || !CROPS[o.crop] || !ready(o)) continue;
        if (room(f, o.crop) < 2) { full = true; break; }
        reap(f, o, fx); n++;
      }
      if (!n) throw E(full ? 'Silo ya da ambar dolu. Bir şeyler sat ya da depoyu büyüt.' : 'Hasada hazır ekin yok.');
      bump(f, 'harvest', n);
    },
    water(f, b) { // sulanan ekin: sıcakta yavaşlamaz, altın ürün verebilir
      let n = 0; const ids = b.all ? f.objs.map((o) => o.id) : [].concat(b.ids || []).slice(0, 40);
      for (const id of ids) { const o = f.objs.find((x) => x.id === id && x.t === 'plot'); if (!o || !o.crop || o.w || ready(o)) continue; o.w = 1; if (o.dry) { delete o.dry; o.k = 1; } n++; }
      if (!n) throw E('Sulanacak ekin yok.');
      bump(f, 'water', n); stat(f, 'water', n); return { watered: n };
    },
    fert(f, b) { // gübre: ekin altın yıldızlı çıkar
      let n = 0;
      for (const id of [].concat(b.ids || []).slice(0, 40)) { const o = f.objs.find((x) => x.id === id && x.t === 'plot'); if (!o || !o.crop || o.f || ready(o)) continue;
        if (!(f.inv.fert > 0)) { if (!n) throw E('Gübren kalmadı. Kompostta üret.'); break; } take(f, { fert: 1 }); o.f = 1; n++; }
      if (!n) throw E('Gübrelenecek ekin yok. Gübre büyüyen ekine verilir.');
      return { fertilized: n };
    },
    buy(f, b, fx, user) {
      const T = TYPES[b.t]; if (!T || T.kind === 'fixed') throw E('Bu satın alınamaz.');
      const stock = (f.stock || {})[b.t] > 0; // koleksiyondan yerleştirme ücretsiz
      if (T.special && !stock) throw E(`${T.name} satın alınamaz: ${T.special}.`);
      if (!stock && T.lvl > f.lvl) throw E(`${T.name} ${T.lvl}. seviyede açılır.`);
      if (T.kind === 'plot' && count(f, 'plot') >= maxPlots(f.lvl)) throw E('Bu seviyede daha fazla tarla açamazsın. Seviye atlayınca yeni tarlalar gelir.');
      if ((T.kind === 'build' || T.kind === 'pen' || T.kind === 'store') && count(f, b.t)) throw E(`Zaten bir ${T.name.toLocaleLowerCase('tr-TR')} var.`);
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
      for (const a of list) { if (!a.at || now() - a.at < P.t) continue; if (room(f, P.out) < 1) { full = true; break; } a.at = 0; give(f, P.out, 1); gain(f, P.xp, fx); n++; }
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
      while (q.length && q[0].end <= now()) { const r = RECIPES[b.b][q[0].r]; if (room(f, q[0].r) < r.out) { full = true; break; } give(f, q[0].r, r.out); fx.push({ t: 'item', k: q[0].r, n: r.out, at: o?.id }); gain(f, r.xp, fx); q.shift(); n++; }
      if (!n) throw E(full ? `${storeOf(f, q[0].r) === 'cellar' ? 'Kiler' : 'Ambar'} dolu.` : 'Henüz hazır değil.');
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
      if (room(f, P.out) < P.n) throw E('Ambar dolu.');
      o.at = now(); give(f, P.out, P.n); fx.push({ t: 'item', k: P.out, n: P.n, at: o.id }); gain(f, P.xp, fx); bump(f, 'pick'); if (P.out === 'fish') stat(f, 'fish');
    },
    rush(f, b, fx, user) { // jetonla hızlandır: tek tarla ya da bir binanın sırası
      if (b.id) {
        const o = f.objs.find((x) => x.id === b.id && x.t === 'plot'); const c = o && CROPS[o.crop]; const left = c ? cropT(o) - (now() - o.at) : 0;
        if (left <= 0) throw E('Hızlandırılacak bir şey yok.'); pay(user, rushCost(left), 'rush'); o.at = now() - cropT(o);
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
      if (f.stall.length >= STALL_SLOTS + (isPlusU(f.id) ? PLUS_STALL : 0)) throw E('Tezgâh dolu.');
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
      if (Math.random() < 0.6 || room(f, 'wheat') < 3) { const c = rnd(20, 60); f.coins += c; fx.push({ t: 'coins', n: c }); } else { const ks = Object.entries(CROPS).filter(([, c]) => c.lvl <= f.lvl && !c.rare).map(([k]) => k); const k = ks[rnd(0, ks.length - 1)]; give(f, k, 3); fx.push({ t: 'item', k, n: 3 }); }
      gain(f, 3, fx); },
    fit(f, b, fx, user) { const F = FITS[b.k]; if (!F) throw E('Kıyafet bulunamadı.'); f.fits = f.fits || {};
      if (F.plus) { if (!isPlusU(f.id)) throw E('Bu kıyafet SwipeUp+ üyelerine özel.', 402); f.fit = b.k; return; }
      if (b.k !== 'a' && !f.fits[b.k]) { if (F.gem) pay(user, F.gem, `fit_${b.k}`); else { if (f.coins < F.cost) throw E('Altının yetmiyor.'); f.coins -= F.cost; } f.fits[b.k] = 1; } f.fit = b.k; },
    evClaim(f, b, fx) { const e = evOf(f); const i = +b.i; const S = e && EV_STEPS[i]; if (!S) throw E('Şu an şenlik yok.'); if (f.ev.got[i]) throw E('Bu ödülü aldın.'); if (f.ev.pts < S.pts) throw E('Şenlik puanın yetmiyor.');
      f.ev.got[i] = 1; if (S.coins) { f.coins += S.coins; fx.push({ t: 'coins', n: S.coins }); } if (S.decor != null) { const k = e.decor[S.decor]; f.stock = f.stock || {}; f.stock[k] = (f.stock[k] || 0) + 1; fx.push({ t: 'decor', k }); } },
    spin(f, b, fx, user) { // şans çarkı: günde bir ücretsiz, ikincisi jetonla
      const free = spinFree(isPlusU(f.id)); // SwipeUp+ üyelerine günde bir ücretsiz çevirme daha
      if (f.spin?.day !== day()) f.spin = { day: day(), n: 0 }; if (f.spin.n >= free + 1) throw E('Bugünkü çevirme hakların bitti. Yarın yine gel.'); if (f.spin.n >= free) pay(user, SPIN_GEM, 'spin');
      f.spin.n += 1; let r = Math.random() * WHEEL_W.reduce((a, c) => a + c, 0); let i = 0; while (i < WHEEL.length - 1 && (r -= WHEEL_W[i]) >= 0) i++;
      const P = WHEEL[i]; if (P.coins) { f.coins += P.coins; fx.push({ t: 'coins', n: P.coins, late: 1 }); } if (P.item) { give(f, P.item[0], P.item[1]); fx.push({ t: 'item', k: P.item[0], n: P.item[1], late: 1 }); } if (P.xp) gain(f, P.xp, fx);
      if (P.seed) { const s = `s_${homeSeed(f.id)}`; give(f, s, P.seed); fx.push({ t: 'item', k: s, n: P.seed, late: 1 }); }
      return { spin: i };
    },
    bookDel(f, b) { f.book = (f.book || []).filter((x) => x.id !== b.id); },
    clubClaim(f, b, fx) { const c = clubRows(f).find((x) => x.id === b.club); if (!c) throw E('Bu kulübün üyesi değilsin.'); if (c.claimed) throw E('Bu haftanın kulüp ödülünü aldın.'); if (c.sum < c.target) throw E('Kulüp hedefi henüz dolmadı.'); if (c.mine < 30) throw E('Ödül için bu hafta en az 30 deneyim kazanmalısın.');
      if (f.clubW?.wk !== week()) f.clubW = { wk: week(), ids: {} }; f.clubW.ids[c.id] = 1; f.coins += CLUB_PRIZE; fx.push({ t: 'coins', n: CLUB_PRIZE }); gain(f, 30, fx); },
    notif(f, b) { if (b.on) delete f.noNotif; else f.noNotif = 1; }, // "tarlan hazır" bildirimi aç/kapat
    barn(f) { ACT.storeUp(f, { s: 'barn' }); },
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
    fit: fitOf(f, isPlusU(f.id)), myFit: fitOf(me, isPlusU(me.id)), pet: petOut(f), bu: f.bu || {}, boat: boatOut(f), likes: f.likes || 0, liked: (f.likeBy || {})[me.id] === day(), book: bookOut(f, 6), wrote: (f.book || []).some((x) => x.from === me.id && x.day === day()), pair: pairOut(me.id, f.id),
    wx: wxOut(), vis: visOut(f), myLvl: me.lvl, home: homeSeed(me.id) }; };
  // profil ve sohbetteki "Çiftliğini gez" düğmesi için: bu kişinin çiftliği var mı?
  app.get('/api/farm/has/:uid', auth, (req, res) => {
    const f = req.params.uid !== req.user.id && !isBlocked(req.user.id, req.params.uid) && store.get('farms', req.params.uid);
    res.json({ lvl: f ? f.lvl : 0, badges: f ? Object.keys(f.ach || {}).length : 0 });
  });
  app.get('/api/farm/of/:uid', auth, (req, res) => {
    const u = store.get('users', req.params.uid) || store.find('users', (x) => x.username === req.params.uid);
    const f = u && u.id !== req.user.id && !isBlocked(req.user.id, u.id) && store.get('farms', u.id);
    if (!f) return res.status(404).json({ error: 'Bu kişinin henüz bir çiftliği yok.' });
    const me = load(req.user.id); let welcome = null;
    // "Çiftliğime gel" daveti: davet edilenin ilk ziyaretinde ikisine de hediye
    if (f.invd?.[me.id] && !(f.firstV || {})[me.id]) {
      f.firstV = { ...(f.firstV || {}), [me.id]: now() }; const seed = `s_${homeSeed(f.id)}`;
      give(me, seed, 2); me.coins += 40; f.coins += 40; welcome = { coins: 40, seed, n: 2 }; save(me); save(f);
      notify(f.id, { type: 'farm', fromId: me.id, title: 'SwipeFarm', text: `${req.user.username} davetine uydu ve çiftliğine ilk kez geldi! İkinize de hoş geldin hediyesi verildi: 40 altın.`, url: '/#/farm' });
    }
    res.json({ cfg: CFG, user: brief(u), farm: visitOut(f, me), welcome });
  });
  // profildeki çiftlik vitrini ve yarışma için: çiftliğin o anki hâli (yalnızca görünüş)
  const stageOf = (o) => { if (o.t !== 'plot' || !CROPS[o.crop]) return undefined; const p = (now() - o.at) / cropT(o); return p >= 1 ? `${o.crop}_3` : p >= 0.4 ? `${o.crop}_2` : 'sprout'; };
  const snap = (f) => ({ n: size(f), lvl: f.lvl, fit: fitOf(f, isPlusU(f.id)), pet: f.pet?.t || null, o: f.objs.map((o) => [o.t, o.x, o.y, stageOf(o) || 0, TYPES[o.t].w, TYPES[o.t].h]),
    a: Object.fromEntries(Object.entries(f.pens || {}).filter(([k]) => PENS[k]).map(([k, v]) => [k, [PENS[k].animal, v.length]])) });
  app.get('/api/farm/peek/:uid', auth, (req, res) => {
    const uid = req.params.uid; const f = (uid === req.user.id || !isBlocked(req.user.id, uid)) && store.get('farms', uid);
    if (!f) return res.json({ farm: null });
    res.json({ farm: snap(f), likes: f.likes || 0, badges: Object.keys(f.ach || {}).length });
  });
  // yardım: büyüyen bir ekini sula, kalan süresi %30 kısalır. Günde 5 yardım; yardım eden de ödül alır.
  app.post('/api/farm/of/:uid/help', auth, (req, res) => {
    const f = req.params.uid !== req.user.id && !isBlocked(req.user.id, req.params.uid) && store.get('farms', req.params.uid);
    if (!f) return res.status(404).json({ error: 'Çiftlik bulunamadı.' });
    const me = load(req.user.id); if (me.helpDay !== day()) { me.helpDay = day(); me.helpN = 0; }
    if (me.helpN >= HELPS) return res.status(400).json({ error: 'Bugünlük yardım hakkın bitti. Yarın yine gel.' });
    const o = f.objs.find((x) => x.id === req.body?.id && x.t === 'plot'); const c = o && CROPS[o.crop];
    if (!c || ready(o)) return res.status(400).json({ error: 'Burada sulanacak ekin yok.' });
    if (o.h) return res.status(400).json({ error: 'Bu ekin zaten sulanmış.' });
    if (o.dry) { delete o.dry; o.k = 1; } o.w = 1; // komşu suyu da sayılır: sıcakta yavaşlamaz
    if (!ready(o)) o.at -= Math.round((cropT(o) - (now() - o.at)) * 0.3); o.h = 1;
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
    if (room(me, x.k) < x.n) return res.status(400).json({ error: 'Deponda yer yok.' });
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
  // ---------- eşleşme buz kırıcısı: sohbetten "Çiftliğime gel" daveti ----------
  app.post('/api/farm/invite/:uid', auth, (req, res) => {
    const me = req.user; const o = store.get('users', req.params.uid);
    if (!o || o.id === me.id || isBlocked(me.id, o.id)) return res.status(404).json({ error: 'Kişi bulunamadı.' });
    const f = load(me.id); f.invd = f.invd || {};
    if (f.invd[o.id] && now() - f.invd[o.id] < 20 * 3600000) return res.status(400).json({ error: 'Bugün davet gönderdin. Yarın yeniden gönderebilirsin.' });
    if (ctx.limited?.(`farminv:${me.id}`, 30, 3600000)) return res.status(429).json({ error: 'Çok fazla davet gönderdin, biraz bekle.' });
    // yalnızca zaten yazıştığın ya da eşleştiğin kişiye (mesaj izinlerini aşmamak için)
    const chat = store.get('chats', [me.id, o.id].sort().join('_')) || (matched(me.id, o.id) ? ctx.chatBetween?.(me.id, o.id) : null);
    if (!chat) return res.status(400).json({ error: 'Çiftlik davetini yazıştığın ya da eşleştiğin kişilere gönderebilirsin.' });
    const first = !(f.firstV || {})[o.id];
    const m = ctx.sendMessage?.(chat, me.id, { text: '', share: { kind: 'farm', id: me.id, label: 'SwipeFarm daveti', title: 'Çiftliğime gel!', sub: first ? 'İlk ziyaretinde ikimize de hoş geldin hediyesi var' : `Seviye ${f.lvl} çiftliğimi gez`, image: '/img/farm/hero.webp', url: `/#/farm/${me.id}` } });
    if (!m) return res.status(400).json({ error: 'Davet gönderilemedi.' });
    f.invd[o.id] = now(); save(f); res.json({ ok: true, chatId: chat.id });
  });
  // ---------- arkadaş daveti: davet ettiklerinin çiftlikteki durumu ----------
  app.get('/api/farm/invites', auth, (req, res) => {
    const me = req.user.id; const row = (u) => { const f = store.get('farms', u.id); return { user: brief(u), lvl: f?.lvl || 0, done: !!f?.invRw }; };
    const by = req.user.invitedBy && store.get('users', req.user.invitedBy);
    res.json({ list: store.filter('users', (u) => u.invitedBy === me && !isBlocked(me, u.id)).slice(0, 50).map(row), by: by && !isBlocked(me, by.id) ? row(by) : null, mine: !!load(me).invRw, lvl: INV_LVL, coins: INV_RW });
  });
  // ---------- tohum takası: nadir tohumlar teklifle değiş tokuş edilir, teklif edilen tohum emanette bekler ----------
  const tradeOut = (t, me) => { const o = store.get('users', t.from === me ? t.to : t.from); return o ? { id: t.id, mine: t.from === me, user: brief(o), give: t.give, want: t.want, st: t.st, at: t.at, end: t.end } : null; };
  const tradeSweep = (t) => { if (t.st === 'open' && t.end < now()) { const f = store.get('farms', t.from); if (f) { give(f, t.give.k, t.give.n); save(f); } t.st = 'expired'; store.put('farm_trades', t); } return t; };
  const seedOk = (k) => typeof k === 'string' && k.startsWith('s_') && RARE.includes(k.slice(2));
  app.get('/api/farm/trades', auth, (req, res) => {
    const me = req.user.id; const all = store.filter('farm_trades', (t) => t.from === me || t.to === me).map(tradeSweep).filter((t) => t.st === 'open' || now() - (t.doneAt || t.at) < 3 * 86400000);
    res.json({ list: all.sort((a, b) => b.at - a.at).slice(0, 40).map((t) => tradeOut(t, me)).filter(Boolean), home: homeSeed(me) });
  });
  app.post('/api/farm/trades', auth, (req, res) => {
    const me = load(req.user.id); const b = req.body || {}; const to = store.get('farms', String(b.to || ''));
    const gk = b.give; const wk = b.want; const gn = Math.floor(+b.gn); const wn = Math.floor(+b.wn);
    if (!to || to.id === me.id || isBlocked(me.id, to.id)) return res.status(404).json({ error: 'Bu kişinin çiftliği yok.' });
    if (!seedOk(gk) || !seedOk(wk) || gk === wk) return res.status(400).json({ error: 'Farklı iki nadir tohum seç.' });
    if (!(gn >= 1 && gn <= 5 && wn >= 1 && wn <= 5)) return res.status(400).json({ error: 'Her taraf 1 ile 5 tohum arasında olmalı.' });
    if ((me.inv[gk] || 0) < gn) return res.status(400).json({ error: `${ITEMS[gk][0]} yetmiyor.` });
    if (store.filter('farm_trades', (t) => t.from === me.id && t.st === 'open').map(tradeSweep).filter((t) => t.st === 'open').length >= TRADE_MAX) return res.status(400).json({ error: `Aynı anda en çok ${TRADE_MAX} açık teklifin olabilir.` });
    if (ctx.limited?.(`farmtrade:${me.id}`, 20, 3600000)) return res.status(429).json({ error: 'Çok fazla teklif gönderdin, biraz bekle.' });
    take(me, { [gk]: gn }); save(me);
    const t = store.put('farm_trades', { id: nanoid(8), from: me.id, to: to.id, give: { k: gk, n: gn }, want: { k: wk, n: wn }, st: 'open', at: now(), end: now() + TRADE_DAYS * 86400000 });
    notify(to.id, { type: 'farm', fromId: me.id, title: 'SwipeFarm', text: `${req.user.username} sana tohum takası teklif etti: ${gn} ${ITEMS[gk][0].toLocaleLowerCase('tr-TR')} karşılığında ${wn} ${ITEMS[wk][0].toLocaleLowerCase('tr-TR')}.`, url: '/#/farm' });
    res.json({ trade: tradeOut(t, me.id), farm: out(me) });
  });
  app.post('/api/farm/trades/:id/:op', auth, (req, res) => {
    const t = store.get('farm_trades', req.params.id); const me = req.user.id; const op = req.params.op;
    if (!t || (t.from !== me && t.to !== me)) return res.status(404).json({ error: 'Teklif bulunamadı.' });
    tradeSweep(t); if (t.st !== 'open') return res.status(400).json({ error: 'Bu teklif artık geçerli değil.' });
    const from = store.get('farms', t.from); const to = load(t.to); const fx = [];
    if (op === 'accept' && me === t.to) {
      if (isBlocked(t.from, t.to) || !from) return res.status(400).json({ error: 'Bu teklif artık geçerli değil.' });
      if ((to.inv[t.want.k] || 0) < t.want.n) return res.status(400).json({ error: `${ITEMS[t.want.k][0]} yetmiyor.` });
      take(to, { [t.want.k]: t.want.n }); give(to, t.give.k, t.give.n); give(from, t.want.k, t.want.n); fx.push({ t: 'item', k: t.give.k, n: t.give.n });
      stat(to, 'trade'); stat(from, 'trade'); t.st = 'done'; save(from);
      notify(t.from, { type: 'farm', fromId: me, title: 'SwipeFarm', text: `${req.user.username} tohum takasını kabul etti: ${t.want.n} ${ITEMS[t.want.k][0].toLocaleLowerCase('tr-TR')} ambarında.`, url: '/#/farm' });
    } else if ((op === 'decline' && me === t.to) || (op === 'cancel' && me === t.from)) {
      if (from) { give(from, t.give.k, t.give.n); save(from); } t.st = op === 'cancel' ? 'cancelled' : 'declined';
      if (op === 'decline') notify(t.from, { type: 'farm', fromId: me, title: 'SwipeFarm', text: `${req.user.username} tohum takası teklifini geri çevirdi. Tohumların ambarına döndü.`, url: '/#/farm' });
    } else return res.status(400).json({ error: 'Geçersiz işlem.' });
    t.doneAt = now(); store.put('farm_trades', t); save(to);
    res.json({ trade: tradeOut(t, me), farm: out(load(me)), fx });
  });
  // ---------- haftalık çiftlik yarışması: temaya göre katıl, oyla, ilk üç ödül alır ----------
  const themeOf = (w) => THEMES[Math.floor(Date.parse(`${w}T00:00:00Z`) / (7 * 86400000)) % THEMES.length];
  const entryOut = (e, me) => { const u = store.get('users', e.uid); return u && !isBlocked(me, u.id) ? { id: e.id, user: brief(u), votes: e.votes || 0, voted: !!(e.by || {})[me], mine: e.uid === me, snap: e.snap } : null; };
  app.get('/api/farm/contest', auth, (req, res) => {
    const me = req.user.id; const w = week(); const f = load(me); const all = store.filter('farm_contest', (e) => e.wk === w);
    const list = all.sort((a, b) => (b.votes || 0) - (a.votes || 0) || a.at - b.at).map((e) => entryOut(e, me)).filter(Boolean);
    const mine = list.find((e) => e.mine) || null; const last = store.get('farm_meta', 'contest_last');
    res.json({ theme: themeOf(w), ends: Date.parse(`${w}T00:00:00+03:00`) + 7 * 86400000, prize: CONTEST_PRIZE, lvl: CONTEST_LVL, myLvl: f.lvl,
      votesLeft: Math.max(0, CONTEST_VOTES - (f.cv?.wk === w ? f.cv.n : 0)), mine, list: list.filter((e) => !e.mine).slice(0, 30), count: list.length,
      last: last ? { theme: last.theme, top: (last.top || []).map((x) => { const u = store.get('users', x.uid); return u && !isBlocked(me, u.id) ? { user: brief(u), votes: x.votes, rank: x.rank } : null; }).filter(Boolean) } : null });
  });
  app.post('/api/farm/contest/enter', auth, (req, res) => {
    const me = req.user.id; const f = load(me); const w = week();
    if (f.lvl < CONTEST_LVL) return res.status(400).json({ error: `Yarışmaya ${CONTEST_LVL}. seviyeden sonra katılabilirsin.` });
    const id = `${w}_${me}`; const e = store.get('farm_contest', id);
    store.put('farm_contest', { ...(e || { id, wk: w, uid: me, votes: 0, by: {}, at: now() }), snap: snap(f), upd: now() });
    res.json({ ok: true, updated: !!e });
  });
  app.post('/api/farm/contest/vote', auth, (req, res) => {
    const me = req.user.id; const w = week(); const e = store.get('farm_contest', String(req.body?.id || ''));
    if (!e || e.wk !== w || isBlocked(me, e.uid)) return res.status(404).json({ error: 'Katılımcı bulunamadı.' });
    if (e.uid === me) return res.status(400).json({ error: 'Kendi çiftliğine oy veremezsin.' });
    if ((e.by || {})[me]) return res.status(400).json({ error: 'Bu çiftliğe oy verdin.' });
    const f = load(me); if (f.cv?.wk !== w) f.cv = { wk: w, n: 0 }; if (f.cv.n >= CONTEST_VOTES) return res.status(400).json({ error: `Bu hafta ${CONTEST_VOTES} oyunu da kullandın.` });
    f.cv.n += 1; e.by = { ...(e.by || {}), [me]: 1 }; e.votes = (e.votes || 0) + 1; store.put('farm_contest', e); save(f);
    res.json({ ok: true, votes: e.votes, votesLeft: CONTEST_VOTES - f.cv.n });
  });
  function contestAward(w) { // geçen haftanın yarışmasını sonuçlandır
    const top = store.filter('farm_contest', (e) => e.wk === w && (e.votes || 0) > 0).sort((a, b) => b.votes - a.votes || a.at - b.at).slice(0, 3);
    top.forEach((e, i) => { const f = store.get('farms', e.uid); if (!f) return; f.coins += CONTEST_PRIZE[i]; f.stock = f.stock || {}; f.stock.rosette = (f.stock.rosette || 0) + 1; save(f);
      notify(f.id, { type: 'farm', title: 'SwipeFarm', text: `Çiftlik yarışmasında ${i + 1}. oldun ("${themeOf(w)}")! Ödülün: ${CONTEST_PRIZE[i]} altın ve koleksiyonluk yarışma kurdelesi.`, url: '/#/farm' }); });
    store.put('farm_meta', { id: 'contest_last', wk: w, theme: themeOf(w), top: top.map((e, i) => ({ uid: e.uid, votes: e.votes, rank: i + 1 })) });
    store.filter('farm_contest', (e) => e.wk < w && e.wk !== w).forEach((e) => { if (Date.parse(`${e.wk}T00:00:00Z`) < Date.parse(`${w}T00:00:00Z`) - 21 * 86400000) store.del('farm_contest', e.id); }); // eski haftaları temizle
  }
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
    try { contestAward(m.wk); } catch (e) { console.error('farm contest', e.message); }
    store.put('farm_meta', { id: 'week', wk: w }); return top.length;
  }
  module.exports._weekly = weekly;

  // ---------- canlı ziyaret: aynı çiftlikteki çiftçiler birbirini görür, el sallar, hazır ifadeler gönderir ----------
  const live = new Map(); // çiftlik sahibi -> Map(socket.id -> ziyaretçi)
  const roomOf = (owner) => `farm:${owner}`; const clampN = (v) => Math.round(Math.min(30, Math.max(0, +v || 0)) * 100) / 100;
  if (ctx.io) ctx.io.on('connection', (socket) => {
    const uid = socket.data.userId; let cur = null; let lastPos = 0; let lastEmo = 0;
    const leave = () => { if (!cur) return; const m = live.get(cur); m?.delete(socket.id); if (m && !m.size) live.delete(cur); socket.to(roomOf(cur)).emit('farm:gone', { id: socket.id }); socket.leave(roomOf(cur)); cur = null; };
    socket.on('farm:join', (p) => {
      const owner = String(p?.owner || ''); const u = store.get('users', uid); const f = store.get('farms', owner);
      if (!u || !f || (owner !== uid && isBlocked(uid, owner))) return;
      leave(); cur = owner; socket.join(roomOf(owner));
      const mf = store.get('farms', uid); const m = live.get(owner) || new Map();
      const peer = { id: socket.id, uid, user: brief(u), fit: mf ? fitOf(mf, isPlusU(uid)) : 'a', owner: uid === owner, x: clampN(p.x), y: clampN(p.y) };
      socket.emit('farm:peers', [...m.values()].filter((x) => x.uid !== uid && !isBlocked(uid, x.uid)));
      m.set(socket.id, peer); live.set(owner, m);
      for (const [sid, x] of m) if (sid !== socket.id && x.uid !== uid && !isBlocked(uid, x.uid)) ctx.io.to(sid).emit('farm:peer', peer);
    });
    socket.on('farm:pos', (p) => { if (!cur || Date.now() - lastPos < 200) return; lastPos = Date.now(); const pr = live.get(cur)?.get(socket.id); if (!pr) return; pr.x = clampN(p?.x); pr.y = clampN(p?.y); socket.to(roomOf(cur)).volatile.emit('farm:pos', { id: socket.id, x: pr.x, y: pr.y }); });
    socket.on('farm:emote', (p) => { const i = Math.floor(+p?.e); if (!cur || !(i >= 0 && i < EMOTES.length) || Date.now() - lastEmo < 1500) return; lastEmo = Date.now(); socket.to(roomOf(cur)).emit('farm:emote', { id: socket.id, e: i }); });
    socket.on('farm:leave', leave); socket.on('disconnect', leave);
  });
  module.exports._live = live;

  // "Tarlan hazır" bildirimi: ekili bütün tarlalar olgunlaştıysa ve oyuncu en az 10 dakikadır çiftliğe bakmadıysa
  // bir kez haber verilir. Aynı hasat için tekrar gönderilmez; günde en çok 2 bildirim.
  const AWAY = 10 * MIN; const STALE = 12 * 60 * MIN; const DAILY = 2;
  function scan() {
    const t = now(); let sent = 0;
    for (const f of store.all('farms')) {
      if (f.noNotif) continue;
      let last = 0; let ready = 0; let growing = false;
      for (const o of f.objs) { const c = o.t === 'plot' && CROPS[o.crop]; if (!c) continue; const end = o.at + cropT(o); if (end > t) { growing = true; break; } ready++; if (end > last) last = end; }
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

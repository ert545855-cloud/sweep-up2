// Fal içerikleri (eğlence amaçlı). Okumalar tohumlu rastgelelikle aynı gün/aynı fincan için tutarlı üretilir.

export function seeded(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  const rnd = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return {
    rnd,
    int: (n) => Math.floor(rnd() * n),
    pick: (arr) => arr[Math.floor(rnd() * arr.length)],
    some: (arr, k) => { const c = [...arr]; const out = []; while (out.length < k && c.length) out.push(c.splice(Math.floor(rnd() * c.length), 1)[0]); return out; },
  };
}

export const today = () => new Date().toISOString().slice(0, 10);

// ---------- Kahve falı ----------
export const SYMBOLS = [
  ['🐦', 'Kuş', 'Yakında sevindirici bir haber alacaksın; beklediğin mesaj yolda.'],
  ['🛤️', 'Yol', 'Önünde açık bir yol var. Kısa bir yolculuk ya da yeni bir başlangıç görünüyor.'],
  ['❤️', 'Kalp', 'Kalbin hareketleniyor. Biri seni düşündüğünden çok daha fazla düşünüyor.'],
  ['🐟', 'Balık', 'Kısmetin açık; beklemediğin bir yerden para ya da hediye geliyor.'],
  ['🐎', 'At', 'Muradına ereceksin. Uzun zamandır istediğin bir şey gerçekleşmek üzere.'],
  ['🧿', 'Göz', 'Üzerinde nazar var; sevincini herkesle paylaşma, biraz sakin ol.'],
  ['🐍', 'Yılan', 'Çevrende sana tatlı görünen ama içi başka biri var. Sırlarını kendine sakla.'],
  ['🌳', 'Ağaç', 'Aile tarafında huzur ve bereket var. Kökün sağlam, sağlığın yerinde.'],
  ['🪜', 'Merdiven', 'Adım adım yükseliyorsun. Okulda ya da işte bir basamak atlayacaksın.'],
  ['💍', 'Yüzük', 'Bir bağlılık, söz ya da ciddi bir ilişki konusu gündeme gelecek.'],
  ['🗝️', 'Anahtar', 'Kafana takılan bir sorunun çözümü elinde. Kapalı bir kapı açılıyor.'],
  ['⛰️', 'Dağ', 'Önünde bir engel var ama aşamayacağın kadar yüksek değil. Sabır.'],
  ['🌙', 'Hilal', 'Tuttuğun dilek kabul olmuş görünüyor; ayın sonuna doğru netleşecek.'],
  ['⭐', 'Yıldız', 'Şans yıldızın parlıyor. Bu ay cesur ol, risk almaktan korkma.'],
  ['🦋', 'Kelebek', 'Hayatında güzel bir değişim başlıyor; eskiyi bırakmaya hazırsın.'],
  ['🐕', 'Köpek', 'Yanında sadık bir dost var. Zor anında ilk o koşacak.'],
  ['🐈', 'Kedi', 'Seni kıskanan, nazlı biri var. Ona fazla yüz verme.'],
  ['🏠', 'Ev', 'Yuva konusu açılıyor: taşınma, ev düzeni ya da aileyle güzel bir toplanma.'],
  ['🌸', 'Çiçek', 'Mutluluk kapında. Küçük bir sürpriz yüzünü güldürecek.'],
  ['👑', 'Taç', 'Emeklerin karşılığını alacaksın; biri seni takdir edecek.'],
  ['⛵', 'Gemi', 'Uzaktan, belki yurt dışından bir haber ya da tanıdık çıkacak.'],
  ['👼', 'Melek', 'Koruyucu bir enerji seninle. Kötü bir şeyden son anda kurtulacaksın.'],
  ['🚪', 'Kapı', 'Yeni bir fırsat kapısı aralanıyor; cesaretle içeri gir.'],
  ['🌊', 'Dalga', 'Duyguların biraz karışık; bir konuşma her şeyi sakinleştirecek.'],
];
const LETTERS = 'ABCDEFGHİKLMNOPRSŞTUVYZ';

const GENEL = [
  'Fincanın ferah, ağzı açık. Son zamanlarda içini daraltan konu yavaş yavaş hafifliyor.',
  'Fincanın dibinde biraz yorgunluk var; çok düşünmüşsün. Ama kenarlar aydınlık, sonu güzel.',
  'Telveler bir yol gibi kenara doğru açılıyor. Hayatında hareketli günler başlıyor.',
  'Fincanın sağ tarafı kalabalık; çevrende seni seven, iyiliğini isteyen çok insan var.',
  'Ortada koyu bir leke var ama etrafı temiz. Küçük bir sıkıntı geliyor, hemen de geçiyor.',
  'Fincanın tamamı açık renkli; içinden geçen kötü bir dönemi geride bırakmışsın.',
  'Telveler birbirine karışmış, kararsız kalmışsın. Kalbinin sesini dinlersen yanılmazsın.',
  'Fincanın kulpuna yakın bir işaret var: bu evden ya da senin elinden güzel bir haber çıkacak.',
];
const ASK = [
  'Aşk tarafında biri sana adım atmak istiyor ama çekiniyor. Küçük bir işaret ver, gerisi gelir.',
  'Kalbin bir yerde takılı kalmış. Geçmişi kapattığında çok daha güzeli kapına gelecek.',
  'İlişkinde ya da flörtünde ısınan bir dönem var; birlikte bir plan yapacaksınız.',
  'Baş harfi fincanda görünen biri seni merak ediyor. Bu hafta karşılaşabilirsiniz.',
  'Yalnızlık değil, seçicilik dönemindesin. Doğru kişi gelene kadar kendine iyi bak.',
  'Bir kıskançlık havası var ama gereksiz. Açık konuşursan aranız eskisinden iyi olur.',
  'Eski bir tanıdık yeniden ortaya çıkabilir; bu sefer niyeti daha ciddi.',
  'Yeni tanışacağın biri hayatına renk katacak. Sosyal ortamlardan kaçma.',
];
const PARA = [
  'İş ya da okul tarafında emeklerinin karşılığını alıyorsun; bir teklif ya da müjde var.',
  'Para tarafında küçük bir sıkışıklık görünüyor ama ay sonuna doğru rahatlıyorsun.',
  'Bir projede ya da sınavda şansın yaver gidiyor. Son ana bırakma, erken başla.',
  'Beklemediğin bir kazanç kapısı var: bir hediye, bir prim ya da geri ödeme.',
  'Biri seninle bir iş fikrini paylaşacak; dinle ama hemen söz verme.',
  'Harcamalarına dikkat edersen biriktirdiğin parayla istediğin şeyi alacaksın.',
  'Çalışkanlığın fark ediliyor; bir üst seni öne çıkaracak.',
  'Yeni bir beceri öğrenmek için çok uygun bir dönem; sonradan kapı açacak.',
];
const RUH = [
  'Uykuna ve suyuna dikkat et; biraz dinlenince enerjin geri gelecek.',
  'İçindeki kaygı gereksiz; olaylar düşündüğünden çok daha güzel sonuçlanacak.',
  'Kendine zaman ayırdığın bir gün seni yeniler. Kısa bir yürüyüş iyi gelir.',
  'Ruhun ferah, etrafına neşe saçıyorsun. Bu enerjiyi koru.',
  'Biraz kırgınlığın var; affetmek en çok sana iyi gelecek.',
  'Sevdiğin bir müzik ya da kitap moralini yükseltecek.',
];
const VAKIT = ['üç güne kadar', 'üç haftaya kadar', 'üç aya kadar'];
const VAKIT_OLAY = [
  'bir müjde alacaksın', 'bir davet gelecek', 'bir karar netleşecek', 'yeni biriyle tanışacaksın',
  'beklediğin bir cevap gelecek', 'bir alışveriş seni sevindirecek', 'bir yolculuk gündeme gelecek', 'eski bir dostla barışacaksın',
];
const DILEK = [
  ['Dileğin kabul', 'Tabağın temiz ve aydınlık. Tuttuğun dilek olacak görünüyor. 🌙'],
  ['Biraz sabır', 'Tabakta küçük bir bekleme işareti var. Dileğin olacak ama acele etme.'],
  ['Yakında', 'Tabağın kenarı açık; dileğin düşündüğünden de çabuk gerçekleşecek.'],
  ['Kalbinden geçen', 'Dileğin bir kişiyle ilgiliyse, o kişi de seni düşünüyor.'],
];

export function coffeeReading(seedStr) {
  const r = seeded(seedStr);
  const syms = r.some(SYMBOLS, 3 + r.int(2));
  const letter = LETTERS[r.int(LETTERS.length)];
  return {
    syms,
    letter,
    genel: r.pick(GENEL),
    ask: r.pick(ASK).replace('Baş harfi fincanda görünen', `Adı ${letter} harfiyle başlayan`),
    para: r.pick(PARA),
    ruh: r.pick(RUH),
    vakit: `${r.pick(VAKIT)} ${r.pick(VAKIT_OLAY)}.`,
    dilek: r.pick(DILEK),
  };
}

// ---------- Tarot (Büyük Arkana) ----------
export const TAROT = [
  ['0', 'Deli', '🃏', 'Yeni bir başlangıç, cesaret ve özgürlük. Bilinmeyene adım atmaktan korkma.', 'Düşünmeden atılmak; acele kararlar seni yorabilir.'],
  ['I', 'Büyücü', '🪄', 'İstediğini gerçekleştirecek her şeye sahipsin. Yeteneklerini kullan.', 'Enerjini dağıtıyorsun; tek bir hedefe odaklan.'],
  ['II', 'Azize', '🌙', 'Sezgilerin çok güçlü. İçinden gelen sese güven.', 'Bir şeyi görmezden geliyorsun; gizli kalan açığa çıkacak.'],
  ['III', 'İmparatoriçe', '🌸', 'Bereket, sevgi ve güzellik. Emeklerin çiçek açıyor.', 'Kendini ihmal ediyorsun; biraz da kendine bak.'],
  ['IV', 'İmparator', '🏛️', 'Düzen, güç ve kararlılık. Kontrol sende.', 'Fazla katı davranmak ilişkilerini zorlayabilir.'],
  ['V', 'Aziz', '📜', 'Bir akıl hocası ya da gelenek sana yol gösterecek.', 'Kalıpların dışına çıkma zamanı.'],
  ['VI', 'Aşıklar', '💞', 'Güçlü bir bağ ve önemli bir seçim. Kalbinle karar ver.', 'Kararsızlık ya da uyumsuzluk; ne istediğini netleştir.'],
  ['VII', 'Savaş Arabası', '🏇', 'Zafer ve ilerleme. Azminle her engeli aşarsın.', 'Yön kaybı; dizginleri yeniden eline al.'],
  ['VIII', 'Güç', '🦁', 'İçsel güç ve sabır. Yumuşaklığın en büyük gücün.', 'Özgüvenin sarsılmış; kendine inan.'],
  ['IX', 'Ermiş', '🏮', 'İçe dönüş ve bilgelik. Biraz yalnız kalmak sana iyi gelir.', 'Kendini fazla kapatma; insanlara açıl.'],
  ['X', 'Kader Çarkı', '🎡', 'Şans dönüyor, talihin açılıyor. Değişime hazır ol.', 'Kontrol edemediğin şeylere takılma; dönem geçecek.'],
  ['XI', 'Adalet', '⚖️', 'Hak ettiğini alacaksın. Dürüstlük kazanacak.', 'Bir haksızlık hissi; sakin kal, gerçek ortaya çıkar.'],
  ['XII', 'Asılan Adam', '🙃', 'Bakış açını değiştir; beklemek de bir hamledir.', 'Gereksiz fedakârlık yapıyorsun.'],
  ['XIII', 'Dönüşüm', '🦋', 'Bir dönem kapanıyor, yenisi başlıyor. Bırakmaktan korkma.', 'Değişime direniyorsun; akışa izin ver.'],
  ['XIV', 'Denge', '🏺', 'Uyum, sabır ve orta yol. Her şey yerli yerine oturuyor.', 'Aşırılıklar seni yoruyor; dengeyi bul.'],
  ['XV', 'Şeytan', '⛓️', 'Tutku ve bağımlılıklar. Seni neyin bağladığını fark et.', 'Zincirlerinden kurtuluyorsun.'],
  ['XVI', 'Kule', '🗼', 'Ani bir değişim; yıkılan şey zaten sağlam değildi.', 'Kaçınılmaz bir değişimi erteliyorsun.'],
  ['XVII', 'Yıldız', '⭐', 'Umut ve iyileşme. Dileğin kabul oluyor.', 'İnancını kaybetme; ışık yakında.'],
  ['XVIII', 'Ay', '🌕', 'Belirsizlik ve rüyalar. Her şey göründüğü gibi değil.', 'Kafa karışıklığı dağılıyor, gerçek netleşiyor.'],
  ['XIX', 'Güneş', '☀️', 'Mutluluk, başarı ve neşe. En parlak dönemin.', 'Küçük bir gecikme; neşen geri gelecek.'],
  ['XX', 'Mahkeme', '📯', 'Uyanış ve ikinci şans. Geçmiş bir konu yeniden açılıyor.', 'Kendini fazla yargılıyorsun.'],
  ['XXI', 'Dünya', '🌍', 'Tamamlanma ve başarı. Bir döngü mutlu sonla bitiyor.', 'Son adımı atmayı bekleyen bir iş var.'],
];
export const TAROT_POS = ['Geçmiş', 'Şimdi', 'Gelecek'];

// ---------- Burçlar ----------
export const ZODIAC = [
  ['koc', 'Koç', '♈', '21 Mart – 19 Nisan', 'ateş'], ['boga', 'Boğa', '♉', '20 Nisan – 20 Mayıs', 'toprak'],
  ['ikizler', 'İkizler', '♊', '21 Mayıs – 20 Haziran', 'hava'], ['yengec', 'Yengeç', '♋', '21 Haziran – 22 Temmuz', 'su'],
  ['aslan', 'Aslan', '♌', '23 Temmuz – 22 Ağustos', 'ateş'], ['basak', 'Başak', '♍', '23 Ağustos – 22 Eylül', 'toprak'],
  ['terazi', 'Terazi', '♎', '23 Eylül – 22 Ekim', 'hava'], ['akrep', 'Akrep', '♏', '23 Ekim – 21 Kasım', 'su'],
  ['yay', 'Yay', '♐', '22 Kasım – 21 Aralık', 'ateş'], ['oglak', 'Oğlak', '♑', '22 Aralık – 19 Ocak', 'toprak'],
  ['kova', 'Kova', '♒', '20 Ocak – 18 Şubat', 'hava'], ['balik', 'Balık', '♓', '19 Şubat – 20 Mart', 'su'],
];
const B_GENEL = [
  'Bugün enerjin yüksek; ertelediğin işleri bitirmek için harika bir gün.',
  'Gün sakin başlıyor ama öğleden sonra hareketleniyor. Telefonunu yakında tut.',
  'Sezgilerin bugün çok güçlü. İlk hissettiğin şey doğru çıkacak.',
  'Küçük bir aksilik olabilir ama mizah anlayışın günü kurtaracak.',
  'Bugün sosyal tarafın ön planda; yeni insanlarla tanışmaya açık ol.',
  'Kendine ayırdığın küçük bir an bütün günün havasını değiştirecek.',
  'Biri senden fikir isteyecek; söylediklerin onun için çok değerli.',
  'Planların biraz değişebilir ama sonuç beklediğinden güzel.',
  'Bugün cesaret günü. Söylemek istediğin şeyi söyle.',
  'Düzen kurmak için ideal bir gün; odanı, telefonunu, aklını toparla.',
  'Eğlenceli bir sürpriz seni bekliyor; akşamı boş bırakma.',
  'İçindeki huzursuzluğu hareketle at; biraz yürü, biraz dans et.',
];
const B_ASK = [
  'Aşkta mesajlaşmalar ısınıyor; ilk adımı sen atarsan karşılık bulacaksın.',
  'Bugün flört enerjin çok yüksek. Bir göz teması her şeyi başlatabilir.',
  'İlişkinde küçük bir romantik jest büyük fark yaratacak.',
  'Geçmişten biri aklına düşebilir; geriye değil ileriye bak.',
  'Kalbin sakin; bugün biraz kendinle ilgilen, aşk peşinden gelir.',
  'Ortak bir ilgi alanı yeni bir bağın başlangıcı olabilir.',
  'Kıskançlığa kapılma; açık iletişim bugün çok değerli.',
  'Biri seni sessizce izliyor; profilindeki fotoğraflara bir bak.',
  'Eşleşmelerinden biriyle uzun bir sohbet seni şaşırtacak.',
  'Bugün aşkta şanslısın; kaydırmayı ihmal etme.',
];
const B_IS = [
  'İş ya da derste odaklanman kolay; zor bir konuyu bugün hallet.',
  'Para konusunda temkinli ol; büyük harcamaları ertele.',
  'Bir ekip çalışmasında parlıyorsun; fikrin kabul görecek.',
  'Beklediğin bir cevap gecikebilir ama olumlu.',
  'Yeni bir şey öğrenmek için çok uygun bir gün.',
  'Küçük bir kazanç ya da indirim yüzünü güldürecek.',
  'Yorgunluk hissedebilirsin; molalar verimini artıracak.',
  'Bir fırsat kapını çalıyor; detaylara dikkat et.',
  'Bugün attığın küçük adım ileride büyük fark yaratacak.',
  'Bir hatayı düzeltmek için ideal zaman; kimse seni yargılamaz.',
];
const RENK = ['kırmızı', 'turuncu', 'sarı', 'yeşil', 'turkuaz', 'mavi', 'lacivert', 'mor', 'pembe', 'beyaz', 'altın', 'gümüş'];

export function horoscope(sign, day = today()) {
  const r = seeded(`${sign}|${day}`);
  const z = ZODIAC.find((x) => x[0] === sign);
  const uyum = ZODIAC.filter((x) => x[4] === z[4] && x[0] !== sign);
  return {
    z, genel: r.pick(B_GENEL), ask: r.pick(B_ASK), is: r.pick(B_IS),
    sayi: 1 + r.int(99), renk: r.pick(RENK), uyum: r.pick(uyum.length ? uyum : ZODIAC),
    puan: { ask: 2 + r.int(4), is: 2 + r.int(4), enerji: 2 + r.int(4) },
  };
}

// ---------- Aşk uyumu ----------
const EL_UYUM = { 'ateş-ateş': 12, 'ateş-hava': 15, 'hava-hava': 10, 'su-su': 12, 'su-toprak': 15, 'toprak-toprak': 10, 'ateş-su': -8, 'hava-toprak': -6, 'ateş-toprak': -4, 'hava-su': -4 };
const UYUM_TXT = [
  [85, 'Ruh eşi seviyesi', 'Aranızda nadir görülen bir uyum var. Birbirinizi bakışınızdan anlıyorsunuz; bu bağa iyi bakın.'],
  [70, 'Çok uyumlu', 'Enerjileriniz birbirini tamamlıyor. Küçük farklar ilişkiyi heyecanlı tutar.'],
  [55, 'Güzel bir başlangıç', 'Ortak noktalarınız var; birbirinizi tanıdıkça uyumunuz artacak.'],
  [40, 'Zıt kutuplar', 'Farklısınız ama zıtlar birbirini çeker. Sabır ve açık iletişim şart.'],
  [0, 'Sürprizlere açık', 'Yıldızlar pek ikna olmamış ama kalp yıldızları dinlemez. Bir kahve içmeden karar vermeyin.'],
];
export function compat(a, b) {
  const r = seeded([a.id, b.id].sort().join('|'));
  let score = 45 + r.int(46);
  const za = ZODIAC.find((x) => x[0] === a.zodiac); const zb = ZODIAC.find((x) => x[0] === b.zodiac);
  if (za && zb) score += EL_UYUM[`${za[4]}-${zb[4]}`] ?? EL_UYUM[`${zb[4]}-${za[4]}`] ?? 0;
  score = Math.max(18, Math.min(99, score));
  const [, title, text] = UYUM_TXT.find(([min]) => score >= min);
  return { score, title, text, za, zb, ask: Math.min(100, score + r.int(12) - 4), dostluk: 40 + r.int(60), iletisim: 35 + r.int(65) };
}

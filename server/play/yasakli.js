// Yasaklı Kelime (2–8 kişi): sırası gelen kelimeyi yasaklı kelimeleri kullanmadan anlatır, diğerleri sohbette tahmin eder.
const CARDS = [
  ['Deniz', ['su', 'mavi', 'dalga', 'yüzmek', 'tuzlu']], ['Futbol', ['top', 'gol', 'maç', 'kale', 'takım']], ['Kahve', ['içecek', 'fincan', 'türk', 'kafein', 'sabah']],
  ['Telefon', ['aramak', 'mesaj', 'ekran', 'şarj', 'akıllı']], ['Doktor', ['hastane', 'hasta', 'ilaç', 'muayene', 'tedavi']], ['Kar', ['beyaz', 'kış', 'soğuk', 'yağmak', 'kardan']],
  ['Uçak', ['uçmak', 'havalimanı', 'pilot', 'bilet', 'gökyüzü']], ['Pizza', ['italyan', 'hamur', 'peynir', 'dilim', 'fırın']], ['Kitap', ['okumak', 'sayfa', 'yazar', 'roman', 'kütüphane']],
  ['Düğün', ['gelin', 'damat', 'evlenmek', 'nikah', 'dans']], ['Güneş', ['sıcak', 'ışık', 'gündüz', 'yaz', 'sarı']], ['Kedi', ['miyav', 'hayvan', 'tüy', 'fare', 'evcil']],
  ['Sinema', ['film', 'perde', 'bilet', 'patlamış', 'koltuk']], ['Doğum günü', ['pasta', 'mum', 'hediye', 'yaş', 'kutlama']], ['Bisiklet', ['pedal', 'tekerlek', 'sürmek', 'iki', 'zincir']],
  ['Ayna', ['yansıma', 'bakmak', 'cam', 'yüz', 'görüntü']], ['Çay', ['demlik', 'bardak', 'içmek', 'şeker', 'rize']], ['Öğretmen', ['okul', 'ders', 'öğrenci', 'sınıf', 'sınav']],
  ['Yağmur', ['su', 'bulut', 'şemsiye', 'ıslak', 'damla']], ['Dondurma', ['soğuk', 'külah', 'yaz', 'tatlı', 'çikolata']], ['Tatil', ['izin', 'deniz', 'otel', 'gezmek', 'yaz']],
  ['Bilgisayar', ['klavye', 'ekran', 'fare', 'internet', 'program']], ['Ev', ['oda', 'yaşamak', 'kapı', 'çatı', 'aile']], ['Araba', ['sürmek', 'tekerlek', 'benzin', 'yol', 'direksiyon']],
  ['Müzik', ['şarkı', 'dinlemek', 'nota', 'enstrüman', 'ses']], ['Gitar', ['tel', 'çalmak', 'akor', 'müzik', 'enstrüman']], ['Ay', ['gece', 'dolunay', 'gökyüzü', 'yıldız', 'dünya']],
  ['Saat', ['zaman', 'dakika', 'kol', 'akrep', 'yelkovan']], ['Ekmek', ['fırın', 'un', 'kahvaltı', 'dilim', 'buğday']], ['Hastane', ['doktor', 'hemşire', 'hasta', 'ameliyat', 'acil']],
  ['Polis', ['suç', 'karakol', 'hırsız', 'üniforma', 'düdük']], ['Bayram', ['şeker', 'el', 'öpmek', 'tatil', 'kurban']], ['Şemsiye', ['yağmur', 'açmak', 'ıslanmak', 'güneş', 'tutmak']],
  ['Ateş', ['yanmak', 'sıcak', 'alev', 'duman', 'odun']], ['Balık', ['deniz', 'yüzmek', 'pul', 'olta', 'su']], ['Ağaç', ['yaprak', 'dal', 'orman', 'kök', 'gövde']],
  ['Yıldız', ['gece', 'gökyüzü', 'parlamak', 'uzay', 'kayan']], ['Maymun', ['muz', 'hayvan', 'ağaç', 'kuyruk', 'goril']], ['Tiyatro', ['sahne', 'oyuncu', 'perde', 'oyun', 'seyirci']],
  ['Kuaför', ['saç', 'kesmek', 'makas', 'boya', 'fön']], ['Pasaport', ['yurt', 'dışı', 'vize', 'seyahat', 'kimlik']], ['Plaj', ['kum', 'deniz', 'güneş', 'şezlong', 'havlu']],
  ['Kahvaltı', ['sabah', 'peynir', 'zeytin', 'yumurta', 'çay']], ['Mutfak', ['yemek', 'tencere', 'ocak', 'pişirmek', 'buzdolabı']], ['Fotoğraf', ['çekmek', 'kamera', 'poz', 'selfie', 'resim']],
  ['Uyku', ['yatak', 'gece', 'rüya', 'yorgun', 'uyumak']], ['Rüya', ['uyku', 'gece', 'görmek', 'kabus', 'tabir']], ['Ayakkabı', ['ayak', 'giymek', 'bağcık', 'numara', 'topuk']],
  ['Pazar', ['hafta', 'tatil', 'gün', 'sebze', 'satıcı']], ['Okul', ['öğrenci', 'öğretmen', 'ders', 'sınıf', 'teneffüs']], ['Kalp', ['sevgi', 'organ', 'atmak', 'aşk', 'kan']],
  ['Aşk', ['sevgi', 'kalp', 'sevgili', 'romantik', 'âşık']], ['Hediye', ['paket', 'vermek', 'sürpriz', 'doğum', 'kutu']], ['Dans', ['müzik', 'hareket', 'pist', 'salsa', 'oynamak']],
  ['Kamp', ['çadır', 'ateş', 'doğa', 'uyku', 'tulumu']], ['Sihirbaz', ['şapka', 'tavşan', 'numara', 'büyü', 'değnek']], ['Robot', ['makine', 'metal', 'yapay', 'zeka', 'insan']],
  ['Uzay', ['astronot', 'gezegen', 'roket', 'yıldız', 'boşluk']], ['Kale', ['sur', 'kral', 'eski', 'taş', 'savunma']], ['Penguen', ['kutup', 'buz', 'siyah', 'beyaz', 'kuş']],
  ['Simit', ['susam', 'çay', 'halka', 'sokak', 'kahvaltı']], ['Lunapark', ['dönme', 'eğlence', 'oyuncak', 'çarpışan', 'bilet']], ['Market', ['alışveriş', 'kasa', 'sepet', 'reyon', 'ürün']],
  ['Selfie', ['fotoğraf', 'telefon', 'kendi', 'poz', 'çekmek']], ['Diş', ['ağız', 'fırça', 'macun', 'dişçi', 'beyaz']], ['Kış', ['soğuk', 'kar', 'mevsim', 'aralık', 'mont']],
  ['Bal', ['arı', 'tatlı', 'kovan', 'petek', 'sarı']], ['Ninni', ['bebek', 'uyumak', 'şarkı', 'anne', 'beşik']], ['Trafik', ['araba', 'yol', 'sıkışık', 'ışık', 'korna']],
];
// Türkçe harfleri sadeleştir (büyük I / İ, ş/s gibi farklar tahmini bozmasın)
const fold = (s) => String(s || '').replace(/İ/g, 'i').replace(/I/g, 'ı').toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/â/g, 'a');
const norm = (s) => fold(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const TURN_MS = 60000; const BETWEEN_MS = 5000; const MAX_PASS = 3;

module.exports = (kit) => {
  const active = (t) => kit.filled(t);
  const phase = (t, name, ms, next) => {
    const g = t.g; clearTimeout(g.ph); ms = kit.ms(ms); g.phase = name; g.deadline = Date.now() + ms; g.phaseMs = ms;
    g.ph = kit.after(t, ms, () => { if (t.status === 'playing' && t.g === g) next(); });
    kit.settle(t);
  };
  const drawCard = (g) => { if (!g.deck.length) g.deck = kit.shuffle(CARDS.slice()); g.card = g.deck.pop(); };
  function nextTurn(t) {
    const g = t.g; g.turnNo++;
    const seats = active(t);
    if (g.turnNo > g.cycles * g.order.length || seats.length < 2) return finish(t);
    let s = g.order[(g.turnNo - 1) % g.order.length];
    let guard = 0; while (!t.seats[s] && guard++ < 20) { g.turnNo++; s = g.order[(g.turnNo - 1) % g.order.length]; }
    if (g.turnNo > g.cycles * g.order.length) return finish(t);
    g.teller = s; g.passes = 0; g.got = 0;
    phase(t, 'between', BETWEEN_MS, () => { drawCard(g); kit.say(t, { sys: true, text: `${kit.nameOf(t, s)} anlatıyor!` }); phase(t, 'tell', TURN_MS, () => { kit.say(t, { sys: true, text: `Süre doldu. Son kelime: ${g.card[0]}` }); nextTurn(t); }); });
  }
  function finish(t) {
    const g = t.g; const sc = g.score; const best = Math.max(0, ...Object.values(sc));
    const winners = Object.keys(sc).filter((k) => sc[k] === best && best > 0).map(Number);
    kit.end(t, { winners, points: sc, text: winners.length ? `Kazanan: ${winners.map((w) => kit.nameOf(t, w)).join(', ')} · ${best} puan` : 'Oyun bitti' });
  }
  const add = (g, s, n) => { g.score[s] = (g.score[s] || 0) + n; };
  kit.register({
    key: 'yasakli', name: 'Yasaklı Kelime', icon: 'yasakli', emoji: '🚫', min: 2, max: 8, size: 8, bots: false, party: true, minHumans: 2, minPlay: 2,
    setup(t) { const g = t.g; g.deck = kit.shuffle(CARDS.slice()); g.order = kit.shuffle(active(t).slice()); g.cycles = g.order.length <= 3 ? 2 : 1; g.turnNo = 0; g.score = {}; nextTurn(t); },
    turn: () => null,
    view(t, me) {
      const g = t.g; const teller = g.teller === me && g.phase === 'tell';
      return { yk: { phase: g.phase, teller: g.teller, card: teller ? g.card : null, passes: g.passes, maxPass: MAX_PASS, got: g.got, turnNo: g.turnNo, turns: g.cycles * g.order.length, score: g.score } };
    },
    move(t, seat, b) {
      const g = t.g;
      if (b.type === 'pass') {
        if (g.phase !== 'tell' || g.teller !== seat) return 'Şu an anlatan sen değilsin.';
        if (g.passes >= MAX_PASS) return 'Pas hakkın bitti.';
        g.passes++; kit.say(t, { sys: true, text: `Pas! Kelime “${g.card[0]}” idi.` }); drawCard(g); return null;
      }
      return 'Geçersiz hamle.';
    },
    chat(t, seat, text) {
      const g = t.g; if (g.phase !== 'tell') return null;
      const n = norm(text); const word = norm(g.card[0]);
      if (seat === g.teller) {
        const bad = [g.card[0], ...g.card[1]].map(norm).find((w) => w && (` ${n} `.includes(` ${w} `) || n.replace(/ /g, '').includes(w.replace(/ /g, '')) && w.length >= 4));
        if (bad) {
          add(g, seat, -1); kit.say(t, { sys: true, text: `🚫 Yasaklı kelime kullanıldı (“${bad}”)! −1 puan. Kelime: ${g.card[0]}` }); drawCard(g);
          return { block: true, reply: { warn: `“${bad}” yasaklı! Yeni kelimeye geçildi.` } };
        }
        return null;
      }
      if (n.replace(/ /g, '') === word.replace(/ /g, '')) {
        add(g, seat, 2); add(g, g.teller, 1); g.got++;
        kit.say(t, { sys: true, ok: true, text: `${kit.nameOf(t, seat)} bildi: ${g.card[0]}! (+2, anlatana +1)` }); drawCard(g);
        return { block: true, reply: { correct: true } };
      }
      return null;
    },
    leave(t, seat) { const g = t.g; if (g && g.teller === seat && (g.phase === 'tell' || g.phase === 'between')) { clearTimeout(g.ph); nextTurn(t); } },
  });
};

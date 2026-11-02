// İlk açılışta uygulamanın boş görünmemesi için örnek hesaplar ve içerik.
// Örnek hesaplar "isBot: true" ile işaretlidir; sağa kaydırılınca çoğu zaman
// geri beğenir ve kısa bir mesaj atar, böylece eşleşme ve sohbet hemen denenebilir.
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');

const CITY = {
  'İstanbul': [41.01, 28.98], Ankara: [39.93, 32.86], 'İzmir': [38.42, 27.14], Antalya: [36.9, 30.7],
  Bursa: [40.19, 29.06], 'Eskişehir': [39.78, 30.52], Trabzon: [41.0, 39.72],
};
const avatar = (seed, bg) => `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${bg}`;
const photo = (seed, w = 1080, h = 1350) => `https://picsum.photos/seed/${seed}/${w}/${h}`;
const V = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/';

const PEOPLE = [
  ['elif.yildiz', 'Elif Yıldız', 24, 'k', 'İstanbul', 'Kahve, analog fotoğraf ve uzun yürüyüşler ☕️📷', ['Fotoğraf', 'Kahve', 'Yürüyüş'], 'ffd5dc'],
  ['mert.kaya', 'Mert Kaya', 27, 'e', 'Ankara', 'Hafta içi yazılım, hafta sonu dağ bisikleti 🚵', ['Bisiklet', 'Kodlama', 'Kamp'], 'c0aede'],
  ['zeynep.ar', 'Zeynep Arslan', 23, 'k', 'İzmir', 'Kordon’da gün batımı kovalıyorum 🌅', ['Deniz', 'Müzik', 'Yoga'], 'ffdfbf'],
  ['can.demir', 'Can Demir', 29, 'e', 'İstanbul', 'Şef yardımcısı. En iyi menemen tartışmasına hazırım 🍳', ['Yemek', 'Futbol', 'Seyahat'], 'b6e3f4'],
  ['selin.oz', 'Selin Öztürk', 26, 'k', 'Antalya', 'Dalış eğitmeni 🐠 Su altı benim ofisim', ['Dalış', 'Seyahat', 'Doğa'], 'd1f4d9'],
  ['burak.sahin', 'Burak Şahin', 25, 'e', 'Bursa', 'Gitar, plak ve gece sürüşleri 🎸', ['Müzik', 'Plak', 'Araba'], 'ffe8a3'],
  ['deniz.ak', 'Deniz Akın', 28, 'k', 'Eskişehir', 'Kitap kurdu, kedi annesi 📚🐈', ['Kitap', 'Kediler', 'Sinema'], 'f4c7ff'],
  ['emre.cel', 'Emre Çelik', 30, 'e', 'İstanbul', 'Fotoğrafçı. Sokakta hikaye arıyorum', ['Fotoğraf', 'Sokak', 'Kahve'], 'c7f0ff'],
  ['ayse.kurt', 'Ayşe Kurt', 22, 'k', 'Trabzon', 'Yayla, çay ve kemençe 🌿', ['Doğa', 'Dans', 'Çay'], 'e2ffd6'],
  ['kaan.yil', 'Kaan Yılmaz', 26, 'e', 'İzmir', 'Sörf yoksa kaykay var 🛹', ['Sörf', 'Kaykay', 'Deniz'], 'ffd6c2'],
];

const REELS = [
  ['ForBiggerBlazes.mp4', 'Hafta sonu planı: hiçbir plan yapmamak 🔥'],
  ['ForBiggerEscapes.mp4', 'Şehirden kaçış rotası kaydedin 🗺️'],
  ['ForBiggerFun.mp4', 'Bu sesi açın 😂'],
  ['ForBiggerJoyrides.mp4', 'Gece sürüşü modu açık 🌙'],
  ['ForBiggerMeltdowns.mp4', 'Pazartesi sabahı ben:'],
  ['SubaruOutbackOnStreetAndDirt.mp4', 'Toprak yol sevenler burada mı?'],
];

const CAPTIONS = [
  'Bugünün renkleri 🎨', 'Bir yürüyüş, bin kare', 'Kaydet, sonra teşekkür edersin',
  'Burayı tahmin eden var mı?', 'Sabah ışığı başka', 'Mod: sakin', 'Yeni favori köşem',
];

async function seed(store) {
  if (store.get('meta', 'seed')) return;
  const hash = await bcrypt.hash(nanoid(), 8);
  const now = Date.now();
  const users = PEOPLE.map(([username, name, age, gender, city, bio, interests, bg], i) => ({
    id: nanoid(10),
    username, name, age, gender, city, bio, interests,
    lookingFor: gender === 'k' ? 'e' : 'k',
    avatar: avatar(name, bg),
    photos: [photo(username + '-1'), photo(username + '-2'), photo(username + '-3')],
    passHash: hash,
    isBot: true,
    createdAt: now - (i + 1) * 86400000 * 3,
    lastSeen: now - Math.floor(Math.random() * 3600000),
  }));
  users.forEach((u) => store.put('users', u));

  // Örnek hesaplar birbirini takip etsin
  users.forEach((u, i) => {
    for (let k = 1; k <= 4; k++) {
      const t = users[(i + k * 3) % users.length];
      if (t.id !== u.id) store.put('follows', { id: `${u.id}_${t.id}`, from: u.id, to: t.id, at: now });
    }
  });

  let n = 0;
  users.forEach((u, i) => {
    for (let k = 0; k < 2; k++) {
      store.put('posts', {
        id: nanoid(10), userId: u.id, type: 'image',
        media: photo(`${u.username}-p${k}`, 1080, 1080),
        caption: CAPTIONS[(i + k) % CAPTIONS.length],
        likes: users.filter((_, j) => (j + k + i) % 3 === 0).map((x) => x.id),
        comments: [],
        createdAt: now - (n++) * 3600000 * 5,
      });
    }
  });
  REELS.forEach(([file, caption], i) => {
    store.put('posts', {
      id: nanoid(10), userId: users[i % users.length].id, type: 'reel',
      media: V + file, poster: photo(`reel-${i}`, 720, 1280), caption,
      likes: users.filter((_, j) => (j + i) % 2 === 0).map((x) => x.id),
      comments: [],
      createdAt: now - i * 3600000 * 7,
    });
  });
  users.slice(0, 5).forEach((u, i) => store.put('stories', {
    id: nanoid(12), userId: u.id, media: photo(`${u.username}-story`, 720, 1280), mediaType: 'image', at: now - i * 3600000, viewers: [],
  }));
  store.put('meta', { id: 'seed', at: now });
  console.log('[seed] örnek içerik eklendi');
}

module.exports = { seed, CITY };

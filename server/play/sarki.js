// Şarkıyı Tahmin Et: şarkının 30 sn'lik önizlemesi çalar, 4 seçenekten doğrusunu ilk sen bul.
// Şarkılar müzik modülüyle (iTunes önizlemeleri) sanatçı listelerinden toplanır; havuz 12 saat saklanır.
const music = require('../music');
const quiz = require('../quizcore');

const CATS = [['karisik', 'Karışık'], ['pop', 'Türkçe pop'], ['rap', 'Türkçe rap'], ['rock', 'Türkçe rock'], ['nostalji', '90’lar ve 2000’ler'], ['yabanci', 'Yabancı hitler']];
const ARTISTS = {
  pop: ['Tarkan', 'Sezen Aksu', 'Hadise', 'Gülşen', 'Simge', 'Edis', 'Murat Boz', 'Mabel Matiz', 'Kenan Doğulu', 'Hande Yener', 'Demet Akalın', 'Aleyna Tilki', 'Zeynep Bastık', 'Sıla', 'Buray', 'Semicenk', 'Bengü', 'Melike Şahin'],
  rap: ['Ezhel', 'Ceza', 'Sagopa Kajmer', 'Ben Fero', 'Motive', 'Uzi', 'Lvbel C5', 'Şanışer', 'Norm Ender', 'Contra', 'Murda', 'Blok3', 'Cakal', 'Batuflex'],
  rock: ['Duman', 'maNga', 'Mor ve Ötesi', 'Teoman', 'Athena', 'Şebnem Ferah', 'Cem Karaca', 'Barış Manço', 'Pinhani', 'Gripin', 'Model', 'Yüksek Sadakat', 'Hayko Cepkin', 'Kurban'],
  nostalji: ['Mustafa Sandal', 'Yonca Evcimik', 'Kayahan', 'Nilüfer', 'Levent Yüksel', 'Hakan Peker', 'Serdar Ortaç', 'Bendeniz', 'Mirkelam', 'Burak Kut', 'Rafet El Roman', 'Yaşar', 'Ajda Pekkan', 'Sertab Erener', 'Kayahan', 'Nazan Öncel'],
  yabanci: ['Dua Lipa', 'The Weeknd', 'Ed Sheeran', 'Adele', 'Coldplay', 'Billie Eilish', 'Taylor Swift', 'Bruno Mars', 'Imagine Dragons', 'Rihanna', 'Shakira', 'Eminem', 'Harry Styles', 'Sia', 'Michael Jackson', 'Queen'],
};
const POOL_MS = 12 * 3600000;
const fold = (s) => String(s || '').replace(/İ/g, 'i').replace(/I/g, 'ı').toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^a-z0-9]/g, '');
const cleanTitle = (s) => String(s || '').replace(/\s*[([][^)\]]*[)\]]/g, '').replace(/\s+-\s+.*$/, '').replace(/\s+/g, ' ').trim().slice(0, 60);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = (kit) => {
  const { store } = kit.ctx;
  const pools = new Map(); // kategori -> { at, items } | { loading }

  function fake(cat) { // Ağ yoksa (yerel test) sahte havuz
    return Array.from({ length: 24 }, (_, i) => ({ id: `f${cat}${i}`, title: `Deneme Şarkı ${i + 1}`, artist: `Sanatçı ${(i % 8) + 1}`, cover: null, preview: `https://audio-ssl.itunes.apple.com/test/${cat}${i}.m4a` }));
  }
  async function build(cat) {
    if (process.env.PLAY_FAKE_SONGS) return fake(cat);
    const artists = kit.shuffle([...new Set(ARTISTS[cat])]).slice(0, 10);
    const out = []; const seen = new Set();
    for (const a of artists) { // iTunes'a nazik ol: sırayla, kısa aralıkla
      const list = await music.itunesSearch(a, 25).catch(() => []);
      list.filter((x) => x.preview && fold(x.artist).includes(fold(a))).slice(0, 7).forEach((x) => {
        const title = cleanTitle(x.title); const k = fold(title);
        if (!title || seen.has(k)) return; seen.add(k);
        out.push({ id: x.id, title, artist: String(x.artist || '').slice(0, 48), cover: x.cover || null, preview: x.preview });
      });
      await sleep(250);
    }
    return out;
  }
  // Havuz: bellekte / veritabanında varsa hemen döner (eskiyse arkada yenilenir). Aynı anda tek yükleme (iTunes sınırı).
  let chain = Promise.resolve();
  const queued = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };
  const fromStore = (cat) => { const sv = store.get('settings', `sarki_${cat}`); return sv?.items?.length >= 20 ? { at: sv.at || 0, items: sv.items } : null; };
  function refresh(cat) {
    const hit = pools.get(cat); if (hit?.loading) return hit.loading;
    const loading = queued(() => build(cat)).then((items) => {
      const prev = pools.get(cat);
      if (items.length >= 20) {
        pools.set(cat, { at: Date.now(), items });
        if (!process.env.PLAY_FAKE_SONGS) store.put('settings', { id: `sarki_${cat}`, at: Date.now(), items });
        console.log(`[sarki] ${cat} havuzu: ${items.length} şarkı`);
        return items;
      }
      console.error(`[sarki] ${cat} havuzu yetersiz: ${items.length}`);
      const old = prev?.items || fromStore(cat)?.items || [];
      if (old.length) pools.set(cat, { at: Date.now() - POOL_MS + 30 * 60000, items: old }); else pools.delete(cat); // 30 dk sonra yeniden dene
      return old;
    }).catch((e) => { console.error('[sarki] havuz', e.message); const old = fromStore(cat)?.items || []; if (old.length) pools.set(cat, { at: Date.now(), items: old }); else pools.delete(cat); return old; });
    pools.set(cat, { ...(hit || {}), loading });
    return loading;
  }
  async function pool(cat) {
    let hit = pools.get(cat);
    if (!hit?.items) { const sv = fromStore(cat); if (sv) { hit = { ...sv }; pools.set(cat, hit); } }
    if (hit?.items) { if (Date.now() - hit.at > POOL_MS && !hit.loading) refresh(cat); return hit.items; }
    return hit?.loading || refresh(cat);
  }
  const ready = () => Object.keys(ARTISTS).filter((c) => pools.get(c)?.items?.length || fromStore(c));
  // Açılışta kategorileri sırayla ısıt (ilk oyuncu beklemesin, iTunes'u zorlamadan)
  if (!process.env.PLAY_FAKE_SONGS) Object.keys(ARTISTS).forEach((c, i) => setTimeout(() => pool(c).catch(() => {}), 20000 + i * 75000).unref?.());

  quiz(kit, {
    key: 'sarki', name: 'Şarkıyı Tahmin Et', emoji: '🎵', cats: CATS, count: 10, qMs: 20000, preMs: 3000, aMs: 5000,
    botMin: 4000, botMax: 15000, botAcc: 0.45,
    failText: 'Şarkılar şu an yüklenemedi, biraz sonra tekrar dene.',
    revealSay: (q) => `🎵 ${q.info.title} · ${q.info.artist}`,
    async load(t, cat, used) {
      // Karışık: hazır olan kategorilerden (yoksa pop) karıştır
      const have = ready(); const cats = cat === 'karisik' ? (have.length ? kit.shuffle(have).slice(0, 3) : ['pop']) : [cat];
      const items = (await Promise.all(cats.map((c) => pool(c)))).flat();
      if (items.length < 14) return [];
      let fresh = items.filter((x) => !used.has(x.id));
      if (fresh.length < 10) { items.forEach((x) => used.delete(x.id)); fresh = items; }
      return kit.shuffle(fresh.slice()).slice(0, 10).map((s) => {
        const others = kit.shuffle(items.filter((x) => fold(x.title) !== fold(s.title)));
        const picks = []; for (const x of others) { if (picks.length >= 3) break; if (!picks.some((p) => fold(p.title) === fold(x.title))) picks.push(x); }
        const opts = kit.shuffle([s, ...picks]);
        return { id: s.id, media: s.preview, opts: opts.map((x) => ({ t: x.title, a: x.artist })), correct: opts.indexOf(s), info: { title: s.title, artist: s.artist, cover: s.cover } };
      });
    },
  });
};

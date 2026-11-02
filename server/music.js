// Müzik arama: Spotify Web API (client credentials) ile şarkı bulunur; 30 sn'lik önizleme sesi
// Spotify vermiyorsa (yeni uygulamalarda preview_url boş gelir) iTunes Search API'den eşlenir.
// Spotify anahtarı yoksa ya da hata verirse arama tamamen iTunes ile çalışır.
const ID = process.env.SPOTIFY_CLIENT_ID;
const SECRET = process.env.SPOTIFY_CLIENT_SECRET;

let token = null; let tokenExp = 0; let spotifyDown = 0;
const cache = new Map();
const PREVIEW_RE = /^https:\/\/(audio-ssl\.itunes\.apple\.com|[\w-]+\.itunes\.apple\.com|p\.scdn\.co)\/[^\s"'<>]+$/;
const COVER_RE = /^https:\/\/(i\.scdn\.co|is\d-ssl\.mzstatic\.com|[\w-]+\.mzstatic\.com)\/[^\s"'<>]+$/;
const SPOTIFY_RE = /^https:\/\/open\.spotify\.com\/track\/[A-Za-z0-9]+$/;

const norm = (s) => String(s || '').toLocaleLowerCase('tr-TR')
  .replace(/\(.*?\)|\[.*?\]|- .*remaster.*$|feat\..*$|ft\..*$/g, '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i')
  .replace(/[^a-z0-9]+/g, ' ').trim();

async function fetchJson(url, opts = {}, ms = 6000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal });
    if (!r.ok) { const e = new Error(`${r.status} ${url.split('?')[0]}`); e.status = r.status; e.body = await r.text().catch(() => ''); throw e; }
    return await r.json();
  } finally { clearTimeout(t); }
}

async function spotifyToken() {
  if (!ID || !SECRET) return null;
  if (token && Date.now() < tokenExp - 60000) return token;
  const j = await fetchJson('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + Buffer.from(`${ID}:${SECRET}`).toString('base64') },
    body: 'grant_type=client_credentials',
  });
  token = j.access_token; tokenExp = Date.now() + j.expires_in * 1000;
  return token;
}

async function spotifySearch(q) {
  if (!ID || !SECRET || Date.now() < spotifyDown) return null;
  try {
    const t = await spotifyToken();
    const j = await fetchJson(`https://api.spotify.com/v1/search?type=track&limit=10&market=TR&q=${encodeURIComponent(q)}`, { headers: { Authorization: 'Bearer ' + t } });
    return (j.tracks?.items || []).map((x) => ({
      id: 'sp_' + x.id,
      title: x.name,
      artist: (x.artists || []).map((a) => a.name).join(', '),
      cover: (x.album?.images || []).find((i) => i.width <= 320)?.url || x.album?.images?.[0]?.url || null,
      spotifyUrl: x.external_urls?.spotify || `https://open.spotify.com/track/${x.id}`,
      preview: x.preview_url || null,
      durationMs: x.duration_ms,
      source: 'spotify',
    }));
  } catch (e) {
    console.error('[music] Spotify hatası:', e.message, (e.body || '').slice(0, 200));
    if (e.status === 401) token = null;
    if (e.status === 403 || e.status === 429) spotifyDown = Date.now() + 10 * 60000; // bir süre iTunes'a geç
    return null;
  }
}

async function itunesSearch(q, limit = 25) {
  try {
    const j = await fetchJson(`https://itunes.apple.com/search?media=music&entity=song&country=TR&limit=${limit}&term=${encodeURIComponent(q)}`);
    return (j.results || []).filter((x) => x.previewUrl).map((x) => ({
      id: 'it_' + x.trackId,
      title: x.trackName,
      artist: x.artistName,
      cover: (x.artworkUrl100 || '').replace('100x100bb', '300x300bb') || null,
      spotifyUrl: null,
      preview: x.previewUrl,
      durationMs: x.trackTimeMillis,
      source: 'itunes',
    }));
  } catch (e) {
    console.error('[music] iTunes hatası:', e.message);
    return [];
  }
}

const same = (a, b) => {
  const ta = norm(a.title); const tb = norm(b.title);
  if (!ta || !tb || !(ta === tb || ta.startsWith(tb) || tb.startsWith(ta))) return false;
  const aa = norm(a.artist).split(' '); const ab = new Set(norm(b.artist).split(' '));
  return aa.some((w) => w.length > 1 && ab.has(w));
};

async function search(q) {
  q = String(q || '').trim().slice(0, 80);
  if (!q) return [];
  const key = q.toLocaleLowerCase('tr-TR');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 30 * 60000) return hit.items;
  const [sp, it] = await Promise.all([spotifySearch(q), itunesSearch(q)]);
  let items;
  if (sp && sp.length) {
    // Spotify sonuçları; önizleme sesi iTunes'tan eşlenir
    items = sp.map((s) => {
      if (s.preview) return s;
      const m = it.find((x) => same(s, x));
      return { ...s, preview: m?.preview || null, previewSource: m ? 'itunes' : null };
    });
    // eşleşmeyenler için ek iTunes sorgusu (en fazla 4)
    const missing = items.filter((x) => !x.preview).slice(0, 4);
    await Promise.all(missing.map(async (s) => {
      const r = await itunesSearch(`${s.artist.split(',')[0]} ${s.title}`, 8);
      const m = r.find((x) => same(s, x));
      if (m) { s.preview = m.preview; s.previewSource = 'itunes'; }
    }));
  } else items = it.slice(0, 15);
  cache.set(key, { at: Date.now(), items });
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  return items;
}

const FEATURED_Q = ['Türkçe pop 2026', 'Tarkan', 'Sezen Aksu', 'Mabel Matiz', 'Semicenk', 'Ezhel'];
let featured = null; let featuredAt = 0;
async function getFeatured() {
  if (featured && Date.now() - featuredAt < 6 * 3600000) return featured;
  const lists = await Promise.all(FEATURED_Q.map((q) => search(q).catch(() => [])));
  const seen = new Set(); const out = [];
  for (let i = 0; i < 10; i++) {
    for (const l of lists) {
      const x = l[i];
      if (x && x.preview && !seen.has(norm(x.title + x.artist))) { seen.add(norm(x.title + x.artist)); out.push(x); }
    }
  }
  featured = out.slice(0, 30); featuredAt = Date.now();
  return featured;
}

// İstemciden gelen müzik bilgisini temizle (sadece izinli adresler)
function clean(m) {
  if (!m || typeof m !== 'object') return null;
  const src = PREVIEW_RE.test(m.src || m.preview || '') ? (m.src || m.preview) : null;
  if (!src) return null;
  return {
    src,
    title: String(m.title || 'Müzik').slice(0, 80),
    artist: String(m.artist || '').slice(0, 80),
    cover: COVER_RE.test(m.cover || '') ? m.cover : null,
    spotifyUrl: SPOTIFY_RE.test(m.spotifyUrl || '') ? m.spotifyUrl : null,
  };
}

async function selfTest() {
  if (!ID || !SECRET) { console.log('[music] Spotify anahtarı yok; müzik araması iTunes ile çalışacak.'); return; }
  try {
    await spotifyToken();
    const r = await search('Tarkan Şımarık');
    console.log(`[music] Spotify bağlı. Deneme araması: ${r.length} sonuç, ${r.filter((x) => x.preview).length} önizlemeli (${r[0] ? `${r[0].artist} - ${r[0].title}` : '-'})`);
  } catch (e) { console.error('[music] Spotify bağlantısı kurulamadı:', e.message, (e.body || '').slice(0, 200)); }
}

module.exports = { search, getFeatured, clean, selfTest, isPreview: (u) => PREVIEW_RE.test(u || ''), enabled: () => !!(ID && SECRET) };

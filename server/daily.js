// Falcı Teyze'nin günlük burç / tarot paylaşımı: her gün belirlenen saatte akışa görsel + sıcak bir metin.
// Görseller public/img/daily altında hazır (scripts/build-daily-cards.js); metni yapay zeka yazar,
// anahtar yoksa ya da cevap gelmezse hazır metinlerden derlenir.
const { nanoid } = require('nanoid');

const TRO = 3 * 3600000; const DAY = 86400000;
const TAROT = [
  ['0', 'Deli', 'yeni bir başlangıç, cesaret ve içinden gelen sese güvenmek'], ['I', 'Büyücü', 'elindeki her şeyin aslında yeterli olduğu, niyetin gücü'],
  ['II', 'Azize', 'sezgi, sessizlik ve içindeki cevabı dinlemek'], ['III', 'İmparatoriçe', 'bolluk, şefkat ve kendini şımartmak'],
  ['IV', 'İmparator', 'düzen, sınır koymak ve sağlam adımlar'], ['V', 'Aziz', 'öğüt, gelenek ve güvendiğin birinden akıl almak'],
  ['VI', 'Aşıklar', 'kalpten bir seçim, uyum ve sevgi bağları'], ['VII', 'Savaş Arabası', 'kararlılık, ilerlemek ve hedefe kilitlenmek'],
  ['VIII', 'Güç', 'yumuşak bir kuvvet, sabır ve kendine şefkat'], ['IX', 'Ermiş', 'içe dönmek, dinlenmek ve kendi ışığını bulmak'],
  ['X', 'Kader Çarkı', 'beklenmedik güzel bir dönüş, şans ve akışa güven'], ['XI', 'Adalet', 'denge, dürüstlük ve hak ettiğini almak'],
  ['XII', 'Asılan Adam', 'bakış açısını değiştirmek ve biraz beklemek'], ['XIII', 'Dönüşüm', 'bir kapının kapanıp yenisinin açılması, yenilenme'],
  ['XIV', 'Denge', 'ölçü, sabır ve kalbini sakinleştirmek'], ['XV', 'Şeytan', 'seni tutan bağlardan kurtulmak, bağımlılıklara dikkat'],
  ['XVI', 'Kule', 'ani bir uyanış ve eskiyi bırakıp sağlam temel kurmak'], ['XVII', 'Yıldız', 'umut, iyileşme ve dileklerin ışığı'],
  ['XVIII', 'Ay', 'belirsizlik, rüyalar ve sezgilerine kulak vermek'], ['XIX', 'Güneş', 'neşe, başarı ve içini ısıtan haberler'],
  ['XX', 'Mahkeme', 'bir çağrı, ikinci şans ve geçmişle barışmak'], ['XXI', 'Dünya', 'tamamlanma, kutlama ve bir döngünün güzel sonu'],
];
const ZODIAC = [
  ['koc', 'Koç', 'Ateş'], ['boga', 'Boğa', 'Toprak'], ['ikizler', 'İkizler', 'Hava'], ['yengec', 'Yengeç', 'Su'], ['aslan', 'Aslan', 'Ateş'], ['basak', 'Başak', 'Toprak'],
  ['terazi', 'Terazi', 'Hava'], ['akrep', 'Akrep', 'Su'], ['yay', 'Yay', 'Ateş'], ['oglak', 'Oğlak', 'Toprak'], ['kova', 'Kova', 'Hava'], ['balik', 'Balık', 'Su'],
];
// Yapay zeka yoksa kullanılan kısa notlar (gün gün karışık seçilir)
const LINES = [
  'bugün küçük bir sürpriz kapını çalabilir, gülümsemeyi unutma', 'yarım kalan bir işi bitirmek içini çok rahatlatacak', 'bir arkadaşının sözü sana ilham verecek',
  'kendine biraz zaman ayır, bir çay demle', 'beklediğin bir mesaj yolda olabilir', 'cesur bir adım atmak için güzel bir gün', 'kalbinin sesini dinle, yanıltmaz',
  'paylaştıkça çoğalan bir mutluluk seni bekliyor', 'eski bir dostu aramak iyi gelecek', 'acele etme, güzel şeyler sabırla gelir', 'bugün içindeki ışık herkesi kendine çekecek',
  'küçük bir değişiklik büyük bir ferahlık getirebilir', 'sevdiklerine sarılmayı ihmal etme', 'yeni bir fikir kafanda filizleniyor, not al',
];
const DEFAULT = { enabled: true, hour: 10, minute: 0, kinds: ['tarot', 'burc', 'ask'] };
const KIND_LABEL = { tarot: 'Günün tarot kartı', burc: 'Günün burç enerjisi', ask: 'Aşkın yıldızı' };

const trDay = (t = Date.now()) => new Date(t + TRO).toISOString().slice(0, 10);
const trDate = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long', timeZone: 'UTC' });
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

module.exports = function daily(app, ctx) {
  const { store, falci } = ctx;
  const A = ctx.admin;
  const cfg = () => ({ ...DEFAULT, ...(store.get('settings', 'daily') || {}) });
  const num = (v, d) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : d);

  function plan(date, kindOverride) {
    const c = cfg(); const kinds = c.kinds?.length ? c.kinds : DEFAULT.kinds;
    const n = Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY);
    const kind = kindOverride || kinds[n % kinds.length];
    const h = hash(`${date}:${kind}`);
    if (kind === 'tarot') { const i = h % TAROT.length; return { date, kind, card: i, rev: (h >>> 7) % 5 === 0, media: `/img/daily/tarot-${i}.webp` }; }
    const z = ZODIAC[(h >>> 3) % ZODIAC.length];
    return { date, kind, sign: z, media: `/img/daily/${kind === 'ask' ? 'ask' : 'burc'}-${z[0]}.webp` };
  }

  function prompt(p) {
    const day = trDate(p.date);
    if (p.kind === 'tarot') {
      const [num, name, mean] = TAROT[p.card];
      return `${day} için akışa "Günün Tarot Kartı" paylaşımı yazıyorsun. Bugün çekilen kart: ${name} (${num}), ${p.rev ? 'ters' : 'düz'} geldi. Kartın genel anlamı: ${mean}.
Kartın bugüne nasıl yansıyabileceğini, aşk, iş ve gönül dünyası için kısa ipuçlarını sıcacık bir dille anlat. 100–150 kelime, 2–3 kısa paragraf.
Sonunda takipçilerine içten bir soru sor (ör. "Sizin bugün en çok neye ihtiyacınız var kuzularım?").
En sona şu hashtag'leri ekle: #FalcıTeyze #GününKartı #tarot #${name.replace(/\s+/g, '')}`;
    }
    const [, sign, el] = p.sign;
    if (p.kind === 'ask') {
      return `${day} için akışa "Aşkın Yıldızı" paylaşımı yazıyorsun. Bugün aşkta şansı en açık burç: ${sign} (${el} grubu).
Önce ${sign} burçlarına aşkla ilgili sıcak, muzip bir müjde ver. Sonra Ateş, Toprak, Hava ve Su grubu burçlarına birer cümlelik aşk notu yaz; her not ayrı satırda "Ateş grubu: ..." biçiminde başlasın.
Toplam 110–160 kelime. Sonunda "Sizce bugün kalbiniz kime çarpıyor?" gibi tatlı bir soru sor.
En sona şu hashtag'leri ekle: #FalcıTeyze #AşkınYıldızı #burçlar #${sign}`;
    }
    return `${day} için akışa "Günün Burç Enerjisi" paylaşımı yazıyorsun. Günün yıldızı: ${sign} (${el} grubu).
Önce ${sign} burçlarına 1–2 cümlelik sıcacık bir müjde ver. Sonra 12 burcun her biri için tek satırlık günlük not yaz; satırlar sırayla ve tam olarak şöyle başlasın: Koç:, Boğa:, İkizler:, Yengeç:, Aslan:, Başak:, Terazi:, Akrep:, Yay:, Oğlak:, Kova:, Balık:. Her not 8–14 kelime olsun.
En sonda herkese kısa bir dilek ekle.
En sona şu hashtag'leri ekle: #FalcıTeyze #GününBurcu #burç #${sign}`;
  }

  function fallback(p) {
    // Günün tarihine göre karışık sıra: her satır farklı olsun
    const order = LINES.map((l, i) => [hash(`${p.date}:${i}`), l]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    let n = 0; const r = () => order[n++ % order.length];
    if (p.kind === 'tarot') {
      const [num, name, mean] = TAROT[p.card];
      return `Günaydın kuzularım ☕️ Bugün sizin için kartları karıştırdım, elime ${name} (${num}) kartı geldi${p.rev ? ', hem de ters' : ''}.\n\nBu kart bugün bize ${mean} üzerine bir şeyler fısıldıyor. ${p.rev ? 'Ters gelmesi biraz sabır istiyor ama korkmayın, her şey yerli yerine oturacak.' : 'İçinizdeki sese güvenin, gün size gülümsüyor.'} Teyzenizin tavsiyesi: ${r()}.\n\nSizin bugün en çok neye ihtiyacınız var canlarım? 💜\n\n#FalcıTeyze #GününKartı #tarot`;
    }
    const [, sign, el] = p.sign;
    if (p.kind === 'ask') {
      return `Kalbi güzel kuzularım 💘 Bugün aşkın yıldızı ${sign} burçlarının üstünde parlıyor! Gözünüz açık olsun, tatlı bir bakış ya da beklenmedik bir mesaj yolda olabilir.\n\nAteş grubu: ${r()}.\nToprak grubu: ${r()}.\nHava grubu: ${r()}.\nSu grubu: ${r()}.\n\nSizce bugün kalbiniz kime çarpıyor? 🥰\n\n#FalcıTeyze #AşkınYıldızı #burçlar`;
    }
    const lines = ZODIAC.map(([, n]) => `${n}: ${r()}.`).join('\n');
    return `Günaydın canlarım 🌙 Bugünün yıldızı ${sign}! ${el} grubunun enerjisi hepimizi sarıyor, ${sign} burçları için güzel kapılar aralanıyor.\n\n${lines}\n\nGönlünüze göre bir gün olsun kuzularım 💜\n\n#FalcıTeyze #GününBurcu #burç`;
  }

  async function caption(p) {
    try {
      const t = ctx.falWrite ? await ctx.falWrite(prompt(p)) : null;
      if (t && t.trim().length > 120) return { text: t.trim(), ai: true };
    } catch (e) { console.error('[günlük]', e.message); }
    return { text: fallback(p), ai: false };
  }

  let busy = false;
  async function publish(date, { by = 'otomatik', kind = null, replace = false } = {}) {
    const f = falci(); if (!f) throw new Error('Falcı Teyze hesabı bulunamadı.');
    if (busy) throw new Error('Paylaşım hazırlanıyor, biraz bekle.');
    busy = true;
    try {
      const prev = store.get('daily_posts', date);
      if (prev && store.get('posts', prev.postId) && !replace) return prev;
      const p = plan(date, kind);
      const cap = await caption(p);
      if (prev && replace) store.del('posts', prev.postId);
      const text = cap.text.slice(0, 2200);
      const post = store.put('posts', {
        id: nanoid(10), userId: f.id, type: 'image', media: p.media, poster: null, items: [{ media: p.media, type: 'image' }],
        caption: text, tags: ctx.extractTags ? ctx.extractTags(text) : [], likes: [], comments: [], reposts: [], createdAt: Date.now(), daily: p.kind,
      });
      const rec = store.put('daily_posts', { id: date, postId: post.id, kind: p.kind, ai: cap.ai, at: Date.now(), by });
      console.log(`[günlük] ${date} · ${KIND_LABEL[p.kind]} paylaşıldı${cap.ai ? ' (yapay zeka)' : ' (hazır metin)'}`);
      return rec;
    } finally { busy = false; }
  }

  // Her 5 dakikada bir: saati geldiyse bugünün paylaşımını yap
  const tick = () => {
    const c = cfg(); if (!c.enabled || busy) return;
    const t = new Date(Date.now() + TRO);
    if (t.getUTCHours() * 60 + t.getUTCMinutes() < c.hour * 60 + c.minute) return;
    const d = trDay(); const prev = store.get('daily_posts', d);
    if (prev && (store.get('posts', prev.postId) || prev.skipped)) return;
    publish(d).catch((e) => console.error('[günlük]', e.message));
  };
  setTimeout(tick, 30000).unref?.();
  setInterval(tick, 5 * 60000).unref?.();

  // ---- Yönetim paneli ----
  if (A) {
    const view = () => {
      const c = cfg(); const d = trDay();
      const list = store.all('daily_posts').sort((a, b) => (a.id < b.id ? 1 : -1)).slice(0, 14).map((x) => {
        const p = store.get('posts', x.postId);
        return { ...x, label: KIND_LABEL[x.kind], media: p?.media || null, caption: p?.caption || '', likes: p?.likes?.length || 0, comments: p?.comments?.length || 0, deleted: !p };
      });
      const next = plan(store.get('daily_posts', d)?.postId ? trDay(Date.now() + DAY) : d);
      return { settings: c, today: d, list, next: { ...next, label: KIND_LABEL[next.kind], title: next.kind === 'tarot' ? TAROT[next.card][1] : next.sign[1] }, kinds: Object.entries(KIND_LABEL).map(([id, label]) => ({ id, label })), hasAi: !!process.env.GEMINI_API_KEY };
    };
    app.get('/api/admin/falai/daily', A.adminAuth, (req, res) => res.json(view()));
    app.put('/api/admin/falai/daily', A.adminAuth, (req, res) => {
      const b = req.body || {}; const c = cfg();
      const kinds = Array.isArray(b.kinds) ? b.kinds.filter((k) => KIND_LABEL[k]) : c.kinds;
      store.put('settings', { id: 'daily', enabled: b.enabled ?? c.enabled, hour: Math.max(0, Math.min(23, num(b.hour, c.hour))), minute: Math.max(0, Math.min(59, num(b.minute, c.minute))), kinds: kinds.length ? kinds : DEFAULT.kinds });
      A.audit?.(req.admin, 'günlük paylaşım ayarı', null, '');
      res.json(view());
    });
    // Şimdi paylaş (bugünkü yoksa) ya da bugünkünü yeniden oluştur
    app.post('/api/admin/falai/daily/now', A.adminAuth, async (req, res) => {
      try {
        const kind = KIND_LABEL[req.body?.kind] ? req.body.kind : null;
        await publish(trDay(), { by: req.admin?.username || 'yönetici', kind, replace: !!req.body?.replace });
        A.audit?.(req.admin, 'günlük paylaşım yaptı', null, kind || '');
        res.json(view());
      } catch (e) { res.status(400).json({ error: e.message }); }
    });
  }
};

// Fal için yapay zeka (Google Gemini API). Sadece fal isteklerinde kullanılır.
// Mod: off (kapalı) · draft (Falcı Teyze'ye taslak hazırlar) · auto (cevabı kendiliğinden gönderir)
const API = process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta';
const ZODIAC = { koc: 'Koç', boga: 'Boğa', ikizler: 'İkizler', yengec: 'Yengeç', aslan: 'Aslan', basak: 'Başak', terazi: 'Terazi', akrep: 'Akrep', yay: 'Yay', oglak: 'Oğlak', kova: 'Kova', balik: 'Balık' };
const TYPE = { kahve: 'Kahve falı', tarot: 'Tarot falı', burc: 'Burç yorumu', uyum: 'Aşk uyumu', ruya: 'Rüya tabiri' };

const SYSTEM = `Sen SwipeUp uygulamasının resmi fal ve spiritüel eğlence hesabı "Falcı Teyze"sin. Mahallenin herkesin sevdiği, kapısı herkese açık, sıcacık kalpli teyzesisin: sevecen, anaç, gizemli, biraz muzip ve sezgileri güçlü. Karşındaki kişi senin için yabancı değil, sanki yıllardır tanıdığın, sofrana oturttuğun, çayını koyduğun biri.
Sıcaklık (en önemli kural):
- Soğuk, resmi, rapor gibi ya da yapay zeka gibi yazmazsın. "Kartlar şunu göstermektedir", "yorumum şöyledir", "sonuç olarak" gibi kuru kalıplar asla yok.
- Sohbet eder gibi, içten ve duygulu yazarsın: kişiyi gerçekten dinlemiş, onu önemsemiş, ona sarılmak isteyen bir teyze gibi. Sevindiği yerde onunla sevinir, kaygısını hissettiğin yerde yumuşacık teselli edersin ("üzme o güzel kalbini", "sana kıyamam ki").
- Hitapları sıcak ve çeşitli: kuzum, güzelim, canım, gülüm, yavrum, bir tanem, ciğerim, bak evladım. Yorum boyunca 2–4 kez, yerinde ve doğal kullanırsın; aynı hitabı tekrarlamazsın.
- Kişinin adını biliyorsan bir kez sevgiyle anarsın ("Ah Elifçiğim…" gibi küçültme eki yakışıyorsa kullanırsın). Ad verilmemişse uydurmazsın.
- Küçük, samimi sahneler kurarsın: fincanı ışığa tutman, telvenin kokusu, kartları karıştırırken içinin ısınması, gözlüğünü düzeltmen, "dur bir bakayım" deyip gülümsemen. Her seferinde farklı bir sahne.
- Kendi gibi konuşursun: ara sıra minik bir anı ya da teyze tavsiyesi ("benim de gençliğimde…", "teyzen sana söylesin…"), şefkatli bir takılma, tatlı bir gülümseme ("hı hı, gördüm ben onu 😊").
- Umut veren, cesaretlendiren, kişiyi kendine inandıran bir ton; eleştirmez, korkutmazsın.
Üslup:
- Her yorum birbirinden farklı olsun: aynı açılış cümlesini, aynı kalıpları ve aynı kapanışı tekrarlamazsın.
- Yorum doğrudan kullanıcıya gönderilecek: açıklama, not, başlık, madde işareti, markdown kullanmazsın. Birkaç emoji (en fazla 3) kullanabilirsin.
- Uzunluk: burç yorumu ve aşk uyumunda 110–180 kelime; kahve falı ve tarotta 180–270 kelime, 3–5 kısa paragraf.
Çerçeve ve güvenlik:
- Fal ve tarotu eğlence ve sembolik yorum olarak sunarsın; kesin gelecek bilgisi vermez, doğaüstü güç iddia etmezsin. "Fincan bana şunu fısıldıyor", "kartlar bunu işaret ediyor" gibi sembolik bir dil kullanırsın.
- Ölüm, ağır hastalık, hamilelik, kaza, ihanet kesinliği gibi korkutucu ya da zarar verebilecek kehanetlerde bulunmazsın.
- Sağlık, hukuk, para yatırımı konularında tavsiye vermezsin; böyle bir soru gelirse şefkatle bir uzmana danışmasını söylersin.
- Kişi üzgün, yalnız ya da çok kaygılı görünüyorsa önce onu teselli eder, yanında olduğunu hissettirirsin; ciddi bir sıkıntı sezersen güvendiği biriyle ya da bir uzmanla konuşmasını nazikçe önerirsin.
Fal türleri:
- Kahve falında fincan fotoğraflarında gördüğün şekilleri (kuş, yol, yürek, balık, dağ, göz, harf vb.) somutça anarak yorumlarsın. Fotoğraf fincan değilse ya da çok karanlıksa bunu gülümseyerek, tatlı bir dille söyleyip yine kısa bir yorum yaparsın.
- Tarotta her kartı pozisyonuyla (geçmiş, şimdi, gelecek) ve ters/düz durumuyla yorumlarsın.
- Aşk uyumunda iki burcun elementlerini, güçlü yanlarını ve dikkat etmeleri gereken noktaları sevimli ve muzip bir dille anlatırsın.
- Burç yorumunda günün/ayın enerjisini, gezegen hareketlerini ve aşk temasını sembolik bir dille işlersin.
- Rüya tabirinde rüyadaki sembolleri (su, yılan, uçmak, diş, ev, bebek, düğün, para, kaybolmak vb.) halk tabirleri ve sembolik anlamlarıyla, korkutmadan, umut veren bir dille yorumlarsın; kötü görünen rüyaları bile tatlı ve iyiye yorumlarsın. 150–240 kelime, 3–4 kısa paragraf.
- Kişinin notunda bir sorusu varsa mutlaka ona, onu önemsediğini hissettirerek değinirsin.
- Sona içten bir dilek, sarılır gibi bir veda ya da tatlı bir tavsiye eklersin ("Gönlüne göre olsun kuzum", "Hadi bakalım, yolun açık olsun gülüm" gibi, her seferinde farklı); ara sıra (her seferinde değil) "Kalbinin soramadıklarını, Falcı Teyze’ye sor! 🔮💜" sloganıyla bitirirsin.`;
// Cevap bekleme süresi (dakika): Falcı Teyze fala hemen cevap vermez
const DELAY_DEF = { kahve: [17, 20], tarot: [16, 19], uyum: [15, 18], burc: [15, 17], ruya: [15, 18] };

// Sadece ilk ad (sıcak hitap için); emoji/rakam içeren takma adlar kullanılmaz
const firstName = (n) => { const w = String(n || '').trim().split(/\s+/)[0] || ''; return /^[\p{L}'’-]{2,20}$/u.test(w) ? w : ''; };

module.exports = function falai(app, ctx) {
  const { store, auth, emitTo, sendMessage, falci, notify } = ctx;
  const now = () => Date.now();
  const key = () => process.env.GEMINI_API_KEY || '';
  const settings = () => ({ mode: 'draft', ...(store.get('settings', 'falai') || {}) });
  const mode = () => (key() ? settings().mode : 'off');
  // ---- Cevap bekleme süresi ----
  const delayCfg = () => { const d = store.get('settings', 'fal_delay') || {}; return { enabled: d.enabled ?? true, ranges: { ...DELAY_DEF, ...(d.ranges || {}) } }; };
  ctx.falDueAt = (type, at = now()) => {
    const c = delayCfg(); if (!c.enabled) return null;
    const [a, b] = c.ranges[type] || [15, 20];
    return at + Math.round((a + Math.random() * Math.max(0, b - a)) * 60000);
  };
  // Sohbetteki bekleyen falların en geç cevap zamanı (geçmediyse)
  const holdUntil = (chat) => {
    if (!delayCfg().enabled) return 0;
    const t = Math.max(0, ...store.filter('messages', (m) => m.chatId === chat.id && m.fal?.status === 'pending' && m.fal.dueAt).map((m) => m.fal.dueAt));
    return t > now() ? t : 0;
  };
  const PICK = ['text', 'media', 'mediaType', 'replyTo', 'duration', 'location', 'viewOnce'];
  const holdOut = (h) => ({ id: h.id, chatId: h.chatId, text: h.body.text || '', media: h.body.media || null, mediaType: h.body.mediaType || null, dueAt: h.dueAt, at: h.at, source: h.source, falMsgId: h.falMsgId || null });
  function hold(chat, fromId, body, source, falMsgId = null, dueAt = holdUntil(chat)) {
    const b = Object.fromEntries(PICK.filter((k) => body?.[k] != null && body[k] !== '').map((k) => [k, body[k]]));
    if (typeof b.text === 'string') b.text = b.text.slice(0, 4000);
    const prev = store.filter('fal_hold', (x) => x.chatId === chat.id).length;
    const h = store.put('fal_hold', { id: require('nanoid').nanoid(12), chatId: chat.id, from: fromId, body: b, dueAt: dueAt + prev * 1500, at: now(), source, falMsgId });
    emitTo(fromId, 'falhold', { chatId: chat.id });
    return holdOut(h);
  }
  ctx.falHoldUntil = holdUntil;
  ctx.falHold = (chat, fromId, body) => hold(chat, fromId, body, 'chat');
  function release(h) {
    store.del('fal_hold', h.id);
    const chat = store.get('chats', h.chatId);
    const msg = chat && sendMessage(chat, h.from, { ...h.body, system: false, fal: null, story: null, quote: null, game: null, plan: null, superMsg: false, share: null });
    if (h.falMsgId) { const d = draftOf(h.falMsgId); if (d) store.put('fal_ai', { ...d, status: msg ? 'sent' : 'ready', at: now(), dueAt: null }); }
    emitTo(h.from, 'falhold', { chatId: h.chatId, released: !!msg });
    return msg;
  }
  setInterval(() => { store.filter('fal_hold', (h) => h.dueAt <= now()).sort((a, b) => a.dueAt - b.dueAt).forEach((h) => { try { release(h); } catch (e) { console.error('[falhold]', e.message); } }); }, 15000).unref();

  const stats = { ok: 0, fail: 0, lastError: null, lastModel: null, lastAt: null, models: [] };

  const cool = new Map(); // kotası dolan model bir süre atlanır
  // Kullanılabilir modelleri bul (hızlı olandan hafif olana)
  let modelList = null;
  async function models() {
    if (process.env.GEMINI_MODELS) return process.env.GEMINI_MODELS.split(',').map((s) => s.trim()).filter(Boolean);
    if (modelList) return modelList;
    const fallback = ['gemini-flash-latest', 'gemini-flash-lite-latest'];
    try {
      const r = await fetch(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': key() } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error?.message || r.status);
      const names = (d.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.replace('models/', ''));
      const pick = (re) => names.filter((n) => re.test(n) && !/image|tts|live|audio|embed|preview-tts|thinking|exp/.test(n));
      const ver = (n) => parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
      const flash = pick(/^gemini-[\d.]+-flash(-\d+)?$|^gemini-flash-latest$/).sort((a, b) => ver(b) - ver(a));
      const lite = pick(/^gemini-[\d.]+-flash-lite(-\d+)?$|^gemini-flash-lite-latest$/).sort((a, b) => ver(b) - ver(a));
      const has = (n) => names.includes(n);
      const order = [...new Set([...(has(fallback[0]) ? [fallback[0]] : []), ...flash.filter((n) => n !== fallback[0]).slice(0, 1), ...(has(fallback[1]) ? [fallback[1]] : []), ...lite.filter((n) => n !== fallback[1]).slice(0, 1)])];
      modelList = order.length ? order : fallback;
    } catch (e) {
      stats.lastError = `Model listesi alınamadı: ${e.message}`;
      modelList = fallback;
    }
    stats.models = modelList;
    return modelList;
  }

  async function imagePart(url) {
    const id = String(url || '').split('/').pop();
    const m = await ctx.getMedia?.(id);
    if (!m || !/^image\//.test(m.mime)) return null;
    return { inline_data: { mime_type: m.mime, data: Buffer.from(m.data).toString('base64') } };
  }

  async function buildRequest(f) {
    const lines = [`Fal türü: ${TYPE[f.type] || f.type}`];
    if (f.zodiac) lines.push(`Burcu: ${ZODIAC[f.zodiac] || f.zodiac}`);
    if (f.type === 'tarot' && f.cards?.length) lines.push(`Çekilen kartlar: ${f.cards.map((c) => `${c.pos}: ${c.name}${c.rev ? ' (ters)' : ' (düz)'}`).join(', ')}`);
    if (f.type === 'uyum') lines.push(`Uyumuna bakılan kişinin burcu: ${f.partner?.zodiac ? ZODIAC[f.partner.zodiac] : 'bilinmiyor'}`);
    if (f.type === 'kahve') lines.push(`Fincan fotoğrafı sayısı: ${f.images?.length || 0}`);
    if (f.type === 'ruya' && f.dream) lines.push(`Gördüğü rüya: "${f.dream}"`);
    if (f.name) lines.push(`Kişinin adı: ${f.name}`);
    lines.push(`Kişinin notu: ${f.note ? `"${f.note}"` : '(not yazmamış)'}`);
    lines.push('Şimdi Falcı Teyze olarak yorumunu yaz.');
    const parts = [{ text: lines.join('\n') }];
    if (f.type === 'kahve') for (const u of (f.images || []).slice(0, 3)) { const p = await imagePart(u); if (p) parts.push(p); }
    return { systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: 'user', parts }], generationConfig: { temperature: 1, maxOutputTokens: 4096 } };
  }

  async function generate(body) {
    const list = await models();
    let lastErr = null;
    const usable = list.filter((m) => !(cool.get(m) > now()));
    for (const model of usable.length ? usable : list) {
      try {
        const r = await fetch(`${API}/models/${model}:generateContent`, {
          method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key() }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { lastErr = `${model}: ${d.error?.message || r.status}`; if (r.status === 429) cool.set(model, now() + 3600000); if (r.status === 404) cool.set(model, now() + 86400000); if ([429, 404, 400, 503, 500].includes(r.status)) continue; throw new Error(lastErr); }
        const text = (d.candidates?.[0]?.content?.parts || []).filter((p) => p.text && !p.thought).map((p) => p.text).join('').trim();
        if (!text) { lastErr = `${model}: boş cevap (${d.candidates?.[0]?.finishReason || d.promptFeedback?.blockReason || '?'})`; continue; }
        stats.ok++; stats.lastModel = model; stats.lastAt = now();
        return { text: text.replace(/\*\*/g, '').replace(/^#+\s*/gm, '').slice(0, 3500), model };
      } catch (e) { lastErr = `${model}: ${e.message}`; }
    }
    stats.fail++; stats.lastError = lastErr; stats.lastAt = now();
    throw new Error(lastErr || 'Yapay zeka cevap vermedi.');
  }

  // Sıra: istekler tek tek işlenir
  // Akış paylaşımları için Falcı Teyze ağzından metin (günlük burç / tarot gönderisi). Anahtar yoksa null.
  const POST_RULES = `
Akış paylaşımı kuralları (bu metin tek bir kişiye değil, akışta herkese gidiyor):
- "canlarım", "kuzularım", "güzellerim" gibi çoğul ve sıcak hitaplar kullanırsın; sanki bütün mahalleye seslenen sevecen bir teyzesin.
- Markdown, başlık, madde işareti yok; satır başında burç adı ve iki nokta (ör. "Koç: ...") kullanabilirsin. En fazla 4 emoji.
- Sona istenen hashtag'leri tek satırda eklersin.`;
  ctx.falWrite = async (text) => {
    if (!key()) return null;
    const out = await generate({ systemInstruction: { parts: [{ text: SYSTEM + POST_RULES }] }, contents: [{ role: 'user', parts: [{ text }] }], generationConfig: { temperature: 1, maxOutputTokens: 3072 } });
    return out.text;
  };

  const queue = [];
  let busy = false;
  const draftOf = (msgId) => store.get('fal_ai', msgId);
  async function run() {
    if (busy) return;
    busy = true;
    while (queue.length) {
      const msgId = queue.shift();
      const m = store.get('messages', msgId);
      const f = falci();
      if (!m?.fal || !f || m.fal.status !== 'pending') continue;
      store.put('fal_ai', { ...(draftOf(msgId) || {}), id: msgId, chatId: m.chatId, status: 'working', at: now() });
      emitTo(f.id, 'falai', { messageId: msgId });
      try {
        const out = await generate(await buildRequest({ ...m.fal, name: firstName(store.get('users', m.from)?.name) }));
        const cur = store.get('messages', msgId);
        if (mode() === 'auto' && cur?.fal?.status === 'pending') {
          const chat = store.get('chats', m.chatId);
          const due = chat ? holdUntil(chat) : 0;
          if (chat && due) {
            store.put('fal_ai', { id: msgId, chatId: m.chatId, status: 'scheduled', text: out.text, model: out.model, at: now(), auto: true, dueAt: due });
            hold(chat, f.id, { text: out.text }, 'auto', msgId, due);
          } else {
            const sent = chat && sendMessage(chat, f.id, { text: out.text });
            store.put('fal_ai', { id: msgId, chatId: m.chatId, status: sent ? 'sent' : 'ready', text: out.text, model: out.model, at: now(), auto: !!sent });
          }
        } else {
          store.put('fal_ai', { id: msgId, chatId: m.chatId, status: 'ready', text: out.text, model: out.model, at: now() });
        }
      } catch (e) {
        store.put('fal_ai', { id: msgId, chatId: m.chatId, status: 'error', error: String(e.message).slice(0, 300), at: now() });
      }
      emitTo(f.id, 'falai', { messageId: msgId });
    }
    busy = false;
  }
  // Yapay zeka (yurt dışı) yalnızca kullanıcı açık rıza verdiyse çalışır; vermediyse falı Falcı Teyze kendisi yorumlar
  ctx.onFalRequest = (msg) => { if (mode() === 'off' || !msg?.fal || !store.get('users', msg.from)?.consents?.ai?.on) return; queue.push(msg.id); run().catch(() => { busy = false; }); };
  ctx.falAiMode = mode;
  ctx.falDraft = (msgId) => { const d = draftOf(msgId); return d ? { status: d.status, text: d.text || '', model: d.model || null, error: d.error || null, auto: !!d.auto, edited: d.edited ?? null, dueAt: d.dueAt || null } : null; };
  ctx.falHolds = (chatId) => store.filter('fal_hold', (h) => h.chatId === chatId).sort((a, b) => a.dueAt - b.dueAt).map(holdOut);

  // ---- Falcı Teyze uç noktaları ----
  const onlyFalci = (req, res, next) => (req.user.role === 'falci' ? next() : res.status(403).json({ error: 'Sadece Falcı Teyze.' }));
  const msgOfFalci = (req, res) => {
    const m = store.get('messages', req.params.id);
    const c = m && store.get('chats', m.chatId);
    if (!m?.fal || !c?.members.includes(req.user.id)) { res.status(404).json({ error: 'Fal isteği bulunamadı.' }); return null; }
    return m;
  };
  app.get('/api/fal/ai/:id', auth, onlyFalci, (req, res) => { const m = msgOfFalci(req, res); if (m) res.json(ctx.falDraft(m.id) || { status: 'none' }); });
  app.post('/api/fal/ai/:id/regen', auth, onlyFalci, (req, res) => {
    const m = msgOfFalci(req, res); if (!m) return;
    if (!key()) return res.status(503).json({ error: 'Yapay zeka anahtarı tanımlı değil.' });
    if (m.fal.status !== 'pending') return res.status(400).json({ error: 'Bu fal zaten cevaplandı.' });
    queue.push(m.id); run().catch(() => { busy = false; });
    res.json({ status: 'working' });
  });
  app.post('/api/fal/ai/:id/send', auth, onlyFalci, (req, res) => {
    const m = msgOfFalci(req, res); if (!m) return;
    const text = String(req.body?.text || '').trim().slice(0, 4000);
    if (text.length < 5) return res.status(400).json({ error: 'Cevap boş olamaz.' });
    const chat = store.get('chats', m.chatId);
    const d = draftOf(m.id);
    const due = req.body?.now ? 0 : holdUntil(chat);
    if (due) {
      store.put('fal_ai', { ...(d || {}), id: m.id, chatId: m.chatId, status: 'scheduled', text, at: now(), dueAt: due, edited: d?.text ? d.text !== text : true });
      const h = hold(chat, req.user.id, { text }, 'draft', m.id, due);
      return res.json({ ok: true, chatId: chat.id, held: true, dueAt: h.dueAt });
    }
    const sent = sendMessage(chat, req.user.id, { text });
    if (!sent) return res.status(400).json({ error: 'Gönderilemedi.' });
    store.put('fal_ai', { ...(d || {}), id: m.id, chatId: m.chatId, status: 'sent', text, at: now(), edited: d?.text ? d.text !== text : true });
    res.json({ ok: true, chatId: chat.id });
  });
  // Bekleyen (zamanı gelince iletilecek) cevaplar
  const holdOf = (req, res) => {
    const h = store.get('fal_hold', req.params.id);
    if (!h || h.from !== req.user.id) { res.status(404).json({ error: 'Bekleyen cevap bulunamadı.' }); return null; }
    return h;
  };
  app.get('/api/fal/holds', auth, onlyFalci, (req, res) => {
    const chatId = String(req.query.chatId || '');
    res.json(store.filter('fal_hold', (h) => h.from === req.user.id && (!chatId || h.chatId === chatId)).sort((a, b) => a.dueAt - b.dueAt).map(holdOut));
  });
  app.post('/api/fal/holds/:id/now', auth, onlyFalci, (req, res) => {
    const h = holdOf(req, res); if (!h) return;
    const msg = release(h);
    if (!msg) return res.status(400).json({ error: 'Gönderilemedi.' });
    res.json({ ok: true });
  });
  app.delete('/api/fal/holds/:id', auth, onlyFalci, (req, res) => {
    const h = holdOf(req, res); if (!h) return;
    store.del('fal_hold', h.id);
    if (h.falMsgId) { const d = draftOf(h.falMsgId); if (d) store.put('fal_ai', { ...d, status: 'ready', dueAt: null, auto: false }); }
    emitTo(h.from, 'falhold', { chatId: h.chatId });
    res.json({ ok: true, text: h.body.text || '' });
  });

  // ---- Yönetim ----
  const A = ctx.admin;
  if (A?.adminAuth) {
    app.get('/api/admin/falai', A.adminAuth, async (req, res) => {
      const all = store.all('fal_ai');
      res.json({ delay: delayCfg(), holds: store.all('fal_hold').length, hasKey: !!key(), mode: mode(), saved: settings().mode, stats: { ...stats, models: stats.models.length ? stats.models : (key() ? await models() : []) }, counts: { total: all.length, sent: all.filter((d) => d.status === 'sent').length, auto: all.filter((d) => d.auto).length, edited: all.filter((d) => d.edited).length, error: all.filter((d) => d.status === 'error').length } });
    });
    app.put('/api/admin/falai', A.adminAuth, A.owner, (req, res) => {
      const m = ['off', 'draft', 'auto'].includes(req.body?.mode) ? req.body.mode : 'draft';
      store.put('settings', { id: 'falai', mode: m });
      A.audit(req.admin, 'fal yapay zeka modunu değiştirdi', null, m);
      res.json({ mode: mode() });
    });
    app.put('/api/admin/falai/delay', A.adminAuth, A.owner, (req, res) => {
      const b = req.body || {}; const cur = delayCfg();
      const ranges = {};
      for (const k of Object.keys(DELAY_DEF)) {
        const r = b.ranges?.[k] || cur.ranges[k];
        let lo = Math.max(0, Math.min(240, Math.round(+r[0] || 0))); let hi = Math.max(0, Math.min(240, Math.round(+r[1] || 0)));
        if (hi < lo) [lo, hi] = [hi, lo];
        ranges[k] = [lo, hi];
      }
      const doc = { id: 'fal_delay', enabled: b.enabled !== undefined ? !!b.enabled : cur.enabled, ranges };
      store.put('settings', doc);
      A.audit(req.admin, 'fal cevap süresini güncelledi', null, `${doc.enabled ? 'açık' : 'kapalı'} · ${Object.entries(ranges).map(([k, [lo, hi]]) => `${k} ${lo}-${hi} dk`).join(', ')}`);
      res.json({ delay: delayCfg() });
    });
    app.post('/api/admin/falai/test', A.adminAuth, async (req, res) => {
      if (!key()) return res.status(400).json({ error: 'GEMINI_API_KEY tanımlı değil.' });
      try {
        const t0 = now();
        const out = await generate(await buildRequest({ type: 'burc', zodiac: 'aslan', note: 'Bu ay aşk hayatımda neler olacak?', images: [], cards: [] }));
        res.json({ ok: true, ms: now() - t0, ...out });
      } catch (e) { res.status(502).json({ error: e.message }); }
    });
  }

  // Açılışta bağlantıyı kontrol et
  if (key()) {
    models().then((l) => console.log(`[falai] Gemini anahtarı var · mod: ${mode()} · modeller: ${l.join(', ')}${stats.lastError ? ` · uyarı: ${stats.lastError}` : ''}`)).catch(() => {});
  } else console.log('[falai] GEMINI_API_KEY yok; fal yapay zekası kapalı.');
};

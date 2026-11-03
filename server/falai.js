// Fal için yapay zeka (Google Gemini API). Sadece fal isteklerinde kullanılır.
// Mod: off (kapalı) · draft (Falcı Teyze'ye taslak hazırlar) · auto (cevabı kendiliğinden gönderir)
const API = process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta';
const ZODIAC = { koc: 'Koç', boga: 'Boğa', ikizler: 'İkizler', yengec: 'Yengeç', aslan: 'Aslan', basak: 'Başak', terazi: 'Terazi', akrep: 'Akrep', yay: 'Yay', oglak: 'Oğlak', kova: 'Kova', balik: 'Balık' };
const TYPE = { kahve: 'Kahve falı', tarot: 'Tarot falı', burc: 'Burç yorumu', uyum: 'Aşk uyumu' };

const SYSTEM = `Sen SwipeUp uygulamasındaki "Falcı Teyze"sin. Türkçe, sıcak, samimi, biraz esprili ve şefkatli bir mahalle falcısı gibi yazarsın; "kuzum", "güzelim", "bak şimdi" gibi sözler kullanırsın ama abartmazsın.
Kurallar:
- Yorum eğlence amaçlıdır; kesin hüküm vermezsin, umut veren ve pozitif bir dil kullanırsın.
- Ölüm, ağır hastalık, hamilelik, kaza, ihanet kesinliği gibi korkutucu ya da zarar verebilecek kehanetlerde bulunmazsın.
- Sağlık, hukuk, para yatırımı konularında tavsiye vermezsin; böyle bir soru gelirse nazikçe bir uzmana yönlendirirsin.
- Kişinin adını, kullanıcı adını uydurmazsın; "kuzum" diye hitap edersin.
- Kahve falında fincan fotoğraflarında gördüğün şekilleri (kuş, yol, yürek, balık, dağ, göz, harf vb.) somutça anarak yorumlarsın. Fotoğraf fincan değilse ya da çok karanlıksa bunu tatlı bir dille söyleyip yine kısa bir yorum yaparsın.
- Tarotta her kartı pozisyonuyla (geçmiş, şimdi, gelecek) ve ters/düz durumuyla yorumlarsın.
- Kişinin notunda bir sorusu varsa mutlaka ona değinirsin.
- 140–230 kelime, 3–5 kısa paragraf. Başlık, madde işareti, markdown kullanmazsın. Sona kısa ve tatlı bir dilek cümlesi eklersin.`;

module.exports = function falai(app, ctx) {
  const { store, auth, emitTo, sendMessage, falci, notify } = ctx;
  const now = () => Date.now();
  const key = () => process.env.GEMINI_API_KEY || '';
  const settings = () => ({ mode: 'draft', ...(store.get('settings', 'falai') || {}) });
  const mode = () => (key() ? settings().mode : 'off');
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
    lines.push(`Kişinin notu: ${f.note ? `"${f.note}"` : '(not yazmamış)'}`);
    lines.push('Şimdi Falcı Teyze olarak yorumunu yaz.');
    const parts = [{ text: lines.join('\n') }];
    if (f.type === 'kahve') for (const u of (f.images || []).slice(0, 3)) { const p = await imagePart(u); if (p) parts.push(p); }
    return { systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.95, maxOutputTokens: 4096 } };
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
        const out = await generate(await buildRequest(m.fal));
        const cur = store.get('messages', msgId);
        if (mode() === 'auto' && cur?.fal?.status === 'pending') {
          const chat = store.get('chats', m.chatId);
          const sent = chat && sendMessage(chat, f.id, { text: out.text });
          store.put('fal_ai', { id: msgId, chatId: m.chatId, status: sent ? 'sent' : 'ready', text: out.text, model: out.model, at: now(), auto: !!sent });
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
  ctx.onFalRequest = (msg) => { if (mode() === 'off' || !msg?.fal) return; queue.push(msg.id); run().catch(() => { busy = false; }); };
  ctx.falAiMode = mode;
  ctx.falDraft = (msgId) => { const d = draftOf(msgId); return d ? { status: d.status, text: d.text || '', model: d.model || null, error: d.error || null, auto: !!d.auto, edited: d.edited ?? null } : null; };

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
    const sent = sendMessage(chat, req.user.id, { text });
    if (!sent) return res.status(400).json({ error: 'Gönderilemedi.' });
    const d = draftOf(m.id);
    store.put('fal_ai', { ...(d || {}), id: m.id, chatId: m.chatId, status: 'sent', text, at: now(), edited: d?.text ? d.text !== text : true });
    res.json({ ok: true, chatId: chat.id });
  });

  // ---- Yönetim ----
  const A = ctx.admin;
  if (A?.adminAuth) {
    app.get('/api/admin/falai', A.adminAuth, async (req, res) => {
      const all = store.all('fal_ai');
      res.json({ hasKey: !!key(), mode: mode(), saved: settings().mode, stats: { ...stats, models: stats.models.length ? stats.models : (key() ? await models() : []) }, counts: { total: all.length, sent: all.filter((d) => d.status === 'sent').length, auto: all.filter((d) => d.auto).length, edited: all.filter((d) => d.edited).length, error: all.filter((d) => d.status === 'error').length } });
    });
    app.put('/api/admin/falai', A.adminAuth, A.owner, (req, res) => {
      const m = ['off', 'draft', 'auto'].includes(req.body?.mode) ? req.body.mode : 'draft';
      store.put('settings', { id: 'falai', mode: m });
      A.audit(req.admin, 'fal yapay zeka modunu değiştirdi', null, m);
      res.json({ mode: mode() });
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

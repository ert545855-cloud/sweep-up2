// Genel amaçlı Gemini yardımcısı (denetim, selfie kontrolü, burç kartı, uyum testi yorumu).
// Fal modülündeki (falai.js) ayrıntılı sıra/taslak sisteminden bağımsızdır; kısa ve zaman sınırlı çağrılar yapar.
const API = process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta';

module.exports = function makeAi(ctx) {
  const key = () => process.env.GEMINI_API_KEY || '';
  const cool = new Map(); // kotası dolan model bir süre atlanır
  const stats = { ok: 0, fail: 0, lastError: null, lastAt: null };
  const models = () => (process.env.GEMINI_MODELS ? process.env.GEMINI_MODELS.split(',').map((s) => s.trim()).filter(Boolean) : ['gemini-flash-latest', 'gemini-flash-lite-latest']);

  // Medya kimliğinden (ör. /media/abc.jpg) Gemini'ye gidecek görsel parçası
  async function imagePart(url) {
    const id = String(url || '').split('?')[0].split('/').pop();
    if (!id) return null;
    let m = null;
    try { m = await ctx.getMedia?.(id); } catch { m = null; }
    if (!m || !/^image\//.test(m.mime || '')) return null;
    return { inline_data: { mime_type: m.mime, data: Buffer.from(m.data).toString('base64') } };
  }

  async function call(parts, { system, json = false, timeout = 15000, temperature = 0.7, maxTokens = 1024 } = {}) {
    if (!key()) throw new Error('GEMINI_API_KEY tanımlı değil.');
    const body = {
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature, maxOutputTokens: maxTokens, ...(json ? { responseMimeType: 'application/json' } : {}) },
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    };
    let lastErr = null;
    const list = models();
    const usable = list.filter((m) => !(cool.get(m) > Date.now()));
    for (const model of usable.length ? usable : list) {
      try {
        const r = await fetch(`${API}/models/${model}:generateContent`, {
          method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key() }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeout),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          lastErr = `${model}: ${d.error?.message || r.status}`;
          if (r.status === 429) cool.set(model, Date.now() + 3600000);
          if (r.status === 404) cool.set(model, Date.now() + 86400000);
          continue;
        }
        const text = (d.candidates?.[0]?.content?.parts || []).filter((p) => p.text && !p.thought).map((p) => p.text).join('').trim();
        if (!text) { lastErr = `${model}: boş cevap (${d.candidates?.[0]?.finishReason || d.promptFeedback?.blockReason || '?'})`; if (d.promptFeedback?.blockReason) return json ? { blocked: true, reason: d.promptFeedback.blockReason } : ''; continue; }
        stats.ok++; stats.lastAt = Date.now();
        if (!json) return text.replace(/\*\*/g, '').replace(/^#+\s*/gm, '');
        const m = text.match(/\{[\s\S]*\}/);
        return JSON.parse(m ? m[0] : text);
      } catch (e) { lastErr = `${model}: ${e.message}`; }
    }
    stats.fail++; stats.lastError = lastErr; stats.lastAt = Date.now();
    throw new Error(lastErr || 'Yapay zeka cevap vermedi.');
  }

  return {
    enabled: () => !!key(),
    stats,
    imagePart,
    text: (prompt, opts) => call([{ text: prompt }], opts),
    json: (prompt, opts) => call([{ text: prompt }], { ...opts, json: true }),
    // Metin + görseller
    vision: async (prompt, urls, opts) => {
      const parts = [{ text: prompt }];
      for (const u of urls || []) { const p = await imagePart(u); if (p) parts.push(p); }
      if (parts.length === 1) throw new Error('Görsel okunamadı.');
      return call(parts, { ...opts, json: true });
    },
  };
};

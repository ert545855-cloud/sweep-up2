// Fotoğraf denetimi: yüklenen her fotoğraf Sightengine'in çıplaklık modelinden (nudity-2.1) geçer.
// Açık cinsel içerik hiç kaydedilmez; sınırda kalanlar kaydedilir ama yönetim panelinde incelemeye düşer.
// SIGHTENGINE_USER ve SIGHTENGINE_SECRET tanımlı değilse denetim kapalıdır, yükleme eskisi gibi çalışır.
// Servise ulaşılamazsa yükleme engellenmez (kullanıcı mağdur olmasın); olay günlüğe yazılır.
const { nanoid } = require('nanoid');

const enabled = () => !!(process.env.SIGHTENGINE_USER && process.env.SIGHTENGINE_SECRET);
const BLOCK = { sexual_activity: 0.5, sexual_display: 0.5, erotica: 0.75 };
const REVIEW = { erotica: 0.4, very_suggestive: 0.85 };
const LABEL = { sexual_activity: 'cinsel eylem', sexual_display: 'çıplaklık', erotica: 'erotik içerik', very_suggestive: 'çok müstehcen' };
let stats = { checked: 0, blocked: 0, review: 0, failed: 0, lastError: null, lastAt: 0 };

// Dönen: { verdict: 'ok' | 'review' | 'block' | 'skip', label, score, scores }
async function check(buffer, mime) {
  if (!enabled() || !/^image\/(jpeg|png|webp|gif)$/.test(mime) || buffer.length > 12 * 1024 * 1024) return { verdict: 'skip' };
  try {
    const fd = new FormData();
    fd.append('media', new Blob([buffer], { type: mime }), `foto.${mime.split('/')[1]}`);
    fd.append('models', 'nudity-2.1'); fd.append('api_user', process.env.SIGHTENGINE_USER); fd.append('api_secret', process.env.SIGHTENGINE_SECRET);
    const r = await fetch(process.env.SIGHTENGINE_URL || 'https://api.sightengine.com/1.0/check.json', { method: 'POST', body: fd, signal: AbortSignal.timeout(9000) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || j.status !== 'success' || !j.nudity) throw new Error(j?.error?.message || `HTTP ${r.status}`);
    const n = j.nudity; const scores = Object.fromEntries(['sexual_activity', 'sexual_display', 'erotica', 'very_suggestive', 'suggestive', 'none'].map((k) => [k, +(+n[k] || 0).toFixed(3)]));
    stats.checked += 1; stats.lastAt = Date.now();
    const hit = (lim) => Object.keys(lim).filter((k) => scores[k] >= lim[k]).sort((a, b) => scores[b] - scores[a])[0];
    const b = hit(BLOCK); if (b) { stats.blocked += 1; return { verdict: 'block', label: LABEL[b], score: scores[b], scores }; }
    const v = hit(REVIEW); if (v) { stats.review += 1; return { verdict: 'review', label: LABEL[v], score: scores[v], scores }; }
    return { verdict: 'ok', scores };
  } catch (e) {
    stats.failed += 1; stats.lastError = String(e.message || e).slice(0, 160); console.error('[fotoğraf denetimi] servis hatası:', stats.lastError);
    return { verdict: 'skip', error: true };
  }
}

module.exports = function photomod(app, ctx) {
  console.log(enabled() ? '[fotoğraf denetimi] Sightengine açık' : '[fotoğraf denetimi] kapalı (SIGHTENGINE_USER / SIGHTENGINE_SECRET yok)');
  const { store, notify } = ctx; const A = ctx.admin; const now = () => Date.now();
  const brief = (id) => { const u = store.get('users', id); return u ? { id: u.id, username: u.username, avatar: u.avatar } : null; };
  // Yükleme sırasında çağrılır
  ctx.photoFlag = (userId, res, mediaId) => store.put('photo_flags', { id: nanoid(12), userId, mediaId: mediaId || null, verdict: res.verdict, label: res.label, score: res.score, scores: res.scores, status: res.verdict === 'review' ? 'open' : 'blocked', at: now() });
  app.get('/api/admin/photomod', A.adminAuth, (req, res) => {
    const all = store.all('photo_flags').sort((a, b) => b.at - a.at);
    const row = (f) => ({ ...f, user: brief(f.userId), url: f.mediaId && store.get('media_meta', f.mediaId) ? `/media/${f.mediaId}` : null, userBlocked: all.filter((x) => x.userId === f.userId && x.verdict === 'block').length });
    res.json({ enabled: enabled(), stats, limits: { block: BLOCK, review: REVIEW }, open: all.filter((f) => f.status === 'open').slice(0, 100).map(row), recent: all.filter((f) => f.status !== 'open').slice(0, 60).map(row) });
  });
  app.post('/api/admin/photomod/:id', A.adminAuth, (req, res) => {
    const f = store.get('photo_flags', req.params.id); if (!f) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
    const act = req.body?.action;
    if (act === 'approve') store.put('photo_flags', { ...f, status: 'approved', by: req.admin.username, doneAt: now() });
    else if (act === 'remove') {
      if (f.mediaId) store.deleteMedia(f.mediaId).then(() => { ctx.dropMediaCache(f.mediaId); store.del('media_meta', f.mediaId); }).catch(() => {});
      store.put('photo_flags', { ...f, status: 'removed', by: req.admin.username, doneAt: now() });
      notify(f.userId, { type: 'order', text: 'Yüklediğin bir fotoğraf topluluk kurallarına uymadığı için kaldırıldı.', url: '/#/profile', tag: 'foto-denetim' });
    } else return res.status(400).json({ error: 'Geçersiz işlem.' });
    A.audit(req.admin, act === 'approve' ? 'fotoğrafı onayladı' : 'fotoğrafı kaldırdı', f.userId, f.label || '');
    res.json({ ok: true });
  });
};
module.exports.check = check; module.exports.enabled = enabled;

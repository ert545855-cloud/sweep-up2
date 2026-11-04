// Özel profil etiketleri: yönetim oluşturur ve kullanıcılara verir (ör. "🏆 Yarışma 1.si")
const { nanoid } = require('nanoid');

const COLORS = ['gold', 'pink', 'purple', 'blue', 'green', 'orange', 'red', 'gray'];
module.exports = function tags(app, ctx) {
  const { store, brief, notify } = ctx;
  const A = ctx.admin;
  if (!A?.adminAuth) return;
  const list = () => store.get('settings', 'tags')?.list || [];
  const holders = (id) => store.filter('users', (u) => (u.tags || []).includes(id));
  app.get('/api/admin/tags', A.adminAuth, (req, res) => {
    res.json({ colors: COLORS, list: list().map((t) => ({ ...t, users: holders(t.id).slice(0, 50).map(brief), count: holders(t.id).length })) });
  });
  app.put('/api/admin/tags', A.adminAuth, (req, res) => {
    const old = list();
    const next = (Array.isArray(req.body?.list) ? req.body.list : []).slice(0, 60).map((t) => ({
      id: /^[\w-]{4,20}$/.test(t.id || '') && old.some((o) => o.id === t.id) ? t.id : nanoid(8),
      em: String(t.em || '🏷️').slice(0, 4), name: String(t.name || '').trim().slice(0, 30), color: COLORS.includes(t.color) ? t.color : 'purple',
    })).filter((t) => t.name);
    // silinen etiketleri kullanıcılardan kaldır
    const gone = old.filter((o) => !next.some((n) => n.id === o.id)).map((o) => o.id);
    if (gone.length) store.filter('users', (u) => (u.tags || []).some((x) => gone.includes(x))).forEach((u) => store.update('users', u.id, { tags: u.tags.filter((x) => !gone.includes(x)) }));
    store.put('settings', { id: 'tags', list: next });
    A.audit(req.admin, 'özel etiketleri güncelledi', null, next.map((t) => `${t.em} ${t.name}`).join(', '));
    res.json({ list: next });
  });
  app.post('/api/admin/users/:id/tags', A.adminAuth, (req, res) => {
    const u = store.get('users', req.params.id);
    if (!u) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    const valid = new Set(list().map((t) => t.id));
    const next = [...new Set((Array.isArray(req.body?.tags) ? req.body.tags : []).filter((x) => valid.has(x)))].slice(0, 5);
    const added = next.filter((x) => !(u.tags || []).includes(x));
    store.update('users', u.id, { tags: next });
    added.forEach((id) => { const t = list().find((x) => x.id === id); if (t) notify(u.id, { type: 'order', title: 'SwipeUp', text: `${t.em} Tebrikler! Profiline “${t.name}” etiketi eklendi.`, url: `/#/u/${u.username}` }); });
    A.audit(req.admin, 'kullanıcıya etiket verdi', u.id, next.map((id) => list().find((t) => t.id === id)?.name).join(', ') || 'etiketler kaldırıldı');
    res.json({ tags: next });
  });
};

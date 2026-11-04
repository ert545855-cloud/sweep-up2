// Haftalık hediye çarkı: her cuma 00:00'dan (TR) sonraki cumaya kadar kişi başı bir çevirme.
// Hediye çıkma ihtimali varsayılan %15; gerisi esprili "pas".
const { nanoid } = require('nanoid');

const DEFAULT_SLICES = [
  { id: 'c10', em: '🪙', label: '10 jeton', type: 'coins', amount: 10, chance: 7 },
  { id: 'c25', em: '🪙', label: '25 jeton', type: 'coins', amount: 25, chance: 3 },
  { id: 'boost', em: '⚡', label: '30 dk Boost', type: 'boost', amount: 30, chance: 2 },
  { id: 'plus3', em: '👑', label: '3 gün SwipeUp+', type: 'plus', amount: 3, chance: 1.5 },
  { id: 'c100', em: '💰', label: '100 jeton', type: 'coins', amount: 100, chance: 1 },
  { id: 'plus7', em: '💎', label: '7 gün SwipeUp+', type: 'plus', amount: 7, chance: 0.5 },
];
const PAS = [
  'Pas! Çark bugün nazlı 😂', 'Pas geçtin! Teyze “sabır acıdır, meyvesi tatlıdır” diyor 🔮', 'Bir dahaki cumaya inşallah 🙃',
  'Bu hafta şans senden yana değil ama aşk belki 💘', 'Pas! Çarkın da canı sıkılabiliyor 😴', 'Neredeyse! Az kalsın 💸 (kalmadı)',
  'Pas! Hediye kargoya verilemedi, kargocu kaydırmaya daldı 📦', 'Çark dedi ki: “Haftaya gel, konuşuruz” ☕',
];
const DEFAULTS = { enabled: true, announce: true, slices: DEFAULT_SLICES };

module.exports = function wheel(app, ctx) {
  const { store, auth, eco, notify, emitTo } = ctx;
  const now = () => Date.now();
  const cfg = () => ({ ...DEFAULTS, ...(store.get('settings', 'wheel') || {}) });
  // Haftanın başlangıcı: son cuma 00:00 (TR)
  const weekStart = (t = now()) => { const d = new Date(t + 3 * 3600000); d.setUTCHours(0, 0, 0, 0); const back = (d.getUTCDay() - 5 + 7) % 7; return d.getTime() - back * 86400000 - 3 * 3600000; };
  const weekId = (t = now()) => new Date(weekStart(t) + 3 * 3600000).toISOString().slice(0, 10);
  const spinOf = (uid) => store.get('wheel_spins', `${uid}_${weekId()}`);
  const winChance = (c) => Math.min(100, c.slices.reduce((a, s) => a + (+s.chance || 0), 0));
  // Çarkta görünen dilimler: hediyeler + aralara "PAS"
  const visual = (c) => {
    const out = [];
    const short = (s) => (s.type === 'coins' ? `${s.amount} jeton` : s.type === 'plus' ? `${s.amount} gün +` : s.type === 'boost' ? `${s.amount} dk` : s.label).slice(0, 10);
    c.slices.forEach((s) => { out.push({ id: s.id, em: s.em, label: s.label, short: short(s), win: true }); out.push({ id: 'pas', em: '😂', label: 'PAS', short: 'PAS', win: false }); });
    return out;
  };
  const view = (u) => {
    const c = cfg(); const s = spinOf(u.id);
    return { enabled: c.enabled, slices: visual(c), winChance: winChance(c), canSpin: c.enabled && !s && !['falci', 'official'].includes(u.role), last: s || null, nextAt: weekStart() + 7 * 86400000 };
  };
  app.get('/api/wheel', auth, (req, res) => res.json(view(req.user)));
  app.post('/api/wheel/spin', auth, (req, res) => {
    const c = cfg();
    if (!c.enabled) return res.status(503).json({ error: 'Çark şu an kapalı.' });
    if (['falci', 'official'].includes(req.user.role)) return res.status(400).json({ error: 'Bu hesap çark çeviremez.' });
    if (spinOf(req.user.id)) return res.status(409).json({ error: 'Bu haftaki hakkını kullandın. Cuma yenilenir!' });
    let r = Math.random() * 100; let prize = null;
    for (const s of c.slices) { r -= +s.chance || 0; if (r < 0) { prize = s; break; } }
    const vis = visual(c);
    const idxs = vis.map((v, i) => [v, i]).filter(([v]) => (prize ? v.id === prize.id : !v.win)).map(([, i]) => i);
    const index = idxs[Math.floor(Math.random() * idxs.length)];
    let text;
    if (prize) {
      if (prize.type === 'coins') eco.addCoins(req.user.id, prize.amount, 'wheel', { ref: prize.id });
      if (prize.type === 'plus') eco.grantPlus(req.user.id, prize.amount);
      if (prize.type === 'boost') { const u = store.get('users', req.user.id); store.update('users', u.id, { boostUntil: Math.max(now(), u.boostUntil || 0) + prize.amount * 60000 }); }
      text = `🎉 Tebrikler! ${prize.em} ${prize.label} kazandın!`;
      emitTo(req.user.id, 'wallet', {});
    } else text = PAS[Math.floor(Math.random() * PAS.length)];
    const spin = store.put('wheel_spins', { id: `${req.user.id}_${weekId()}`, uid: req.user.id, week: weekId(), at: now(), prizeId: prize?.id || null, prize: prize ? { em: prize.em, label: prize.label, type: prize.type, amount: prize.amount } : null, text });
    res.json({ index, prize: spin.prize, text, ...view(store.get('users', req.user.id)) });
  });
  // Cuma öğlen: "çark yenilendi" bildirimi
  let lastAnn = store.get('settings', 'wheel_ann')?.week || null;
  setInterval(() => {
    const c = cfg(); if (!c.enabled || !c.announce) return;
    const d = new Date(now() + 3 * 3600000);
    if (d.getUTCDay() !== 5 || d.getUTCHours() < 12 || lastAnn === weekId()) return;
    lastAnn = weekId(); store.put('settings', { id: 'wheel_ann', week: lastAnn });
    store.filter('users', (u) => !['falci', 'official'].includes(u.role) && u.status !== 'banned' && (u.lastSeen || 0) > now() - 30 * 86400000)
      .forEach((u) => notify(u.id, { type: 'announce', title: 'SwipeUp', text: '🎡 Hediye çarkı yenilendi! Bu haftaki şansını dene.', url: '/#/cark', tag: 'wheel' }));
  }, 10 * 60000).unref();
  // 8 haftadan eski kayıtları temizle
  setInterval(() => { const lim = weekId(now() - 56 * 86400000); store.filter('wheel_spins', (s) => s.week < lim).forEach((s) => store.del('wheel_spins', s.id)); }, 12 * 3600000).unref();

  // ---- Yönetim ----
  const A = ctx.admin;
  if (!A?.adminAuth) return;
  app.get('/api/admin/wheel', A.adminAuth, (req, res) => {
    const c = cfg(); const w = store.filter('wheel_spins', (s) => s.week === weekId());
    const by = {}; w.forEach((s) => { if (s.prizeId) by[s.prizeId] = (by[s.prizeId] || 0) + 1; });
    res.json({ ...c, winChance: winChance(c), week: weekId(), stats: { spins: w.length, wins: w.filter((s) => s.prizeId).length, by, coins: w.filter((s) => s.prize?.type === 'coins').reduce((a, s) => a + s.prize.amount, 0) }, recent: w.filter((s) => s.prizeId).sort((a, b) => b.at - a.at).slice(0, 30).map((s) => ({ ...s, user: ctx.brief(store.get('users', s.uid)) })) });
  });
  app.put('/api/admin/wheel', A.adminAuth, A.owner, (req, res) => {
    const b = req.body || {}; const c = cfg();
    const slices = (Array.isArray(b.slices) ? b.slices : c.slices).slice(0, 10).map((s) => ({
      id: /^[\w-]{2,20}$/.test(s.id || '') ? s.id : nanoid(6), em: String(s.em || '🎁').slice(0, 4), label: String(s.label || '').trim().slice(0, 24),
      type: ['coins', 'plus', 'boost'].includes(s.type) ? s.type : 'coins', amount: Math.max(1, Math.min(10000, parseInt(s.amount, 10) || 1)), chance: Math.max(0, Math.min(100, Math.round((+s.chance || 0) * 10) / 10)),
    })).filter((s) => s.label);
    if (slices.reduce((a, s) => a + s.chance, 0) > 100) return res.status(400).json({ error: 'Hediye ihtimallerinin toplamı %100’ü geçemez.' });
    const s = { id: 'wheel', enabled: b.enabled !== undefined ? !!b.enabled : c.enabled, announce: b.announce !== undefined ? !!b.announce : c.announce, slices };
    store.put('settings', s);
    A.audit(req.admin, 'hediye çarkını güncelledi', null, `${slices.length} hediye · toplam %${slices.reduce((a, x) => a + x.chance, 0)}`);
    res.json(s);
  });
};

// Etkileşim paketi: sohbet ve giriş serileri, günün sorusu, kulüpler, "şu an dinlediğim", günlük seçki,
// uyum testi, buluşma hatırlatmaları, sohbette sanal hediye, Falcı Teyze paketleri, günün burç kartı,
// yapay zekalı "Emin misin?" denetimi, selfie doğrulamada yapay zeka ön kontrolü ve karaoke odası.
// Ayarlar 'settings' koleksiyonunda 'engage' kaydında durur, yönetim panelinden (Etkileşim) değiştirilir.
const { nanoid } = require('nanoid');
const music = require('./music');

const DAY = 86400000;
const TR = 3 * 3600000;
const trDay = (t = Date.now()) => new Date(t + TR).toISOString().slice(0, 10);
const trHour = (t = Date.now()) => new Date(t + TR).getUTCHours();
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
const dayDiff = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY);
const weekStart = (t = Date.now()) => { const d = new Date(t + TR); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.getTime() - TR; };
const trLower = (s) => String(s || '').toLocaleLowerCase('tr-TR');
const clip = (s, n) => String(s || '').trim().slice(0, n);

// ---------- Burçlar ----------
const ZODIAC = { koc: ['Koç', '♈'], boga: ['Boğa', '♉'], ikizler: ['İkizler', '♊'], yengec: ['Yengeç', '♋'], aslan: ['Aslan', '♌'], basak: ['Başak', '♍'], terazi: ['Terazi', '♎'], akrep: ['Akrep', '♏'], yay: ['Yay', '♐'], oglak: ['Oğlak', '♑'], kova: ['Kova', '♒'], balik: ['Balık', '♓'] };
const ELEMENT = { koc: 'ates', aslan: 'ates', yay: 'ates', boga: 'toprak', basak: 'toprak', oglak: 'toprak', ikizler: 'hava', terazi: 'hava', kova: 'hava', yengec: 'su', akrep: 'su', balik: 'su' };
const GOOD_PAIR = new Set(['ates_hava', 'hava_ates', 'toprak_su', 'su_toprak']);
function zodiacFromDate(bd) {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(String(bd || '')); if (!m) return null;
  const v = +m[1] * 100 + +m[2];
  const T = [[120, 'oglak'], [219, 'kova'], [321, 'balik'], [420, 'koc'], [521, 'boga'], [621, 'ikizler'], [723, 'yengec'], [823, 'aslan'], [923, 'basak'], [1023, 'terazi'], [1122, 'akrep'], [1222, 'yay'], [1232, 'oglak']];
  for (const [lim, z] of T) if (v < lim) return z;
  return 'oglak';
}
const zodiacOf = (u) => (u?.zodiac && ZODIAC[u.zodiac] ? u.zodiac : zodiacFromDate(u?.birthdate));
function ageOf(u) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(u?.birthdate || ''));
  if (!m) return Number.isFinite(u?.age) ? u.age : null;
  const t = new Date(); let a = t.getFullYear() - +m[1];
  if (t.getMonth() + 1 < +m[2] || (t.getMonth() + 1 === +m[2] && t.getDate() < +m[3])) a--;
  return a;
}
function km(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const r = Math.PI / 180; const dLat = (b.lat - a.lat) * r; const dLng = (b.lng - a.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return Math.max(1, Math.round(12742 * Math.asin(Math.sqrt(x))));
}

// ---------- Günün sorusu ----------
const QUESTIONS = [
  'İlk buluşmada nereye gidilir?', 'Hayatında dinlediğin en iyi konser hangisiydi?', 'Bir gün görünmez olsan ne yapardın?', 'Sabahları seni ne mutlu eder?',
  'Asla vazgeçemeyeceğin bir yemek?', 'En son ne zaman kahkahalarla güldün, neye?', 'Bir süper gücün olsa hangisi olurdu?', 'İstanbul’da en sevdiğin semt hangisi?',
  'Tekrar tekrar izlediğin dizi ya da film?', 'Bir ilişkide en önemli şey nedir?', 'Çocukken ne olmak isterdin?', 'Mükemmel bir pazar günü nasıl geçer?',
  'Hayatının şarkısı hangisi?', 'Gitmek istediğin ama henüz gidemediğin ülke?', 'Telefonunda en çok kullandığın uygulama (SwipeUp hariç 😄)?', 'Seni en çok ne sinirlendirir?',
  'Kahve mi çay mı? Neden?', 'Bugüne kadar aldığın en iyi tavsiye?', 'Bir haftalık tatil: deniz mi dağ mı?', 'En utanç verici anını anlat (cesursan 😅)',
  'Hangi burç en çok seni anlar?', 'Bir ünlüyle yemek yeme şansın olsa kim?', 'Bu yıl öğrendiğin en güzel şey?', 'İlk mesajı kim atmalı?',
  'Hayalindeki ev nerede ve nasıl?', 'Sende bağımlılık yapan bir şarkı söyle', 'Romantik bulduğun en küçük jest?', 'En sevdiğin mevsim ve nedeni?',
  'Bir günlüğüne başka biri olsan kim olurdun?', 'Hiç unutmadığın bir rüya?', 'Arkadaşların seni üç kelimeyle nasıl anlatır?', 'Hayatında yaptığın en çılgın şey?',
  'Yalnız kaldığında ne yaparsın?', 'Bir filmde yaşayabilseydin hangisi?', 'İlk aşkını hatırlıyor musun? Ne öğrendin?', 'Kışın vazgeçilmezin ne?',
  'En iyi tatlı hangisi? Kavga çıkabilir 🍰', 'Bir hobiye hemen başlasan hangisi olurdu?', 'Gece 3’te seni arayabilecek kaç kişi var?', 'Bugün kendine bir iltifat et 💜',
];

// ---------- Kulüpler ----------
const DEFAULT_CLUBS = [
  { id: 'muzik', em: '🎵', name: 'Müzik', desc: 'Yeni keşifler, konserler, çalma listeleri' },
  { id: 'oyun', em: '🎮', name: 'Oyun', desc: 'Takım arkadaşı bul, oyun öner' },
  { id: 'burc', em: '✨', name: 'Burçlar', desc: 'Yıldızlar, retrolar ve burç sohbetleri' },
  { id: 'futbol', em: '⚽', name: 'Futbol', desc: 'Maç günü yorumları ve taraftar sohbeti' },
  { id: 'dizi', em: '🎬', name: 'Dizi & Film', desc: 'Ne izlesem? Spoilersız öneriler' },
  { id: 'kitap', em: '📚', name: 'Kitap', desc: 'Okuduklarımız ve okuyacaklarımız' },
  { id: 'seyahat', em: '✈️', name: 'Seyahat', desc: 'Rotalar, ipuçları, yol arkadaşları' },
  { id: 'spor', em: '🏃', name: 'Spor & Sağlık', desc: 'Koşu, salon, yoga ve motivasyon' },
  { id: 'yemek', em: '🍳', name: 'Yemek', desc: 'Tarifler, mekanlar, gurme sohbetler' },
  { id: 'teknoloji', em: '💻', name: 'Teknoloji', desc: 'Telefonlar, uygulamalar, yapay zeka' },
];

// ---------- Uyum testi ----------
const COMPAT_QS = [
  { q: 'İdeal cumartesi akşamı?', o: ['Evde film ve battaniye', 'Arkadaşlarla dışarıda', 'Konser ya da etkinlik', 'Doğada kamp ateşi'] },
  { q: 'Tartışma çıkınca?', o: ['Hemen konuşurum', 'Biraz sakinleşip konuşurum', 'Espriyle yumuşatırım', 'Kendiliğinden geçmesini beklerim'], scale: true },
  { q: 'Tatil tarzın?', o: ['Deniz, kum, güneş', 'Şehir turu ve müzeler', 'Dağ ve doğa', 'Plansız yol macerası'] },
  { q: 'Sevgini nasıl gösterirsin?', o: ['Güzel sözlerle', 'Sarılarak, dokunarak', 'Birlikte zaman geçirerek', 'Küçük sürprizlerle'] },
  { q: 'Para konusunda?', o: ['Birikimciyim', 'Dengeliyim', 'Anı yaşarım', 'Hiç düşünmem'], scale: true },
  { q: 'Sabah mı gece mi?', o: ['Tam erkenci', 'Biraz erkenci', 'Biraz gece kuşu', 'Tam gece kuşu'], scale: true },
  { q: 'Sosyal pilin?', o: ['Kalabalık beni şarj eder', 'Küçük grupları severim', 'Bire bir en iyisi', 'Yalnız kalmalıyım'], scale: true },
  { q: 'Mesajlaşma tarzın?', o: ['Gün boyu yazışırım', 'Gün içinde birkaç kez', 'Akşam uzun sohbet', 'Yüz yüze konuşmayı severim'], scale: true },
  { q: 'Gelecek planları?', o: ['Her şeyi planlarım', 'Ana hatları belli', 'Akışına bırakırım', 'Plan nedir? 😄'], scale: true },
  { q: 'İlk buluşma?', o: ['Kahve', 'Akşam yemeği', 'Aktivite (bowling, yürüyüş)', 'Sürpriz bir yer'] },
];

// ---------- Falcı Teyze paketleri ----------
const DEFAULT_PACKS = [
  { id: 'ask_ay', em: '💞', name: 'Aylık aşk falı paketi', desc: '30 gün içinde 4 aşk uyumu falı', type: 'uyum', credits: 4, days: 30, coins: 90, enabled: true },
  { id: 'tarot_ay', em: '🔮', name: 'Aylık tarot paketi', desc: '30 gün içinde 4 tarot falı', type: 'tarot', credits: 4, days: 30, coins: 90, enabled: true },
  { id: 'kahve_3', em: '☕️', name: 'Kahve falı üçlüsü', desc: '60 gün içinde 3 kahve falı', type: 'kahve', credits: 3, days: 60, coins: 100, enabled: true },
  { id: 'yillik', em: '🌟', name: 'Yıllık burç raporu', desc: 'Önümüzdeki 12 ayın aşk, iş ve para yorumu', type: 'yillik', credits: 1, days: 0, coins: 150, enabled: true },
];

const DEFAULTS = {
  streak: { enabled: true, milestones: { 3: 5, 7: 15, 14: 25, 30: 60, 50: 100, 100: 250 }, warnHour: 20 },
  login: { enabled: true, milestones: { 3: 3, 7: 10, 14: 20, 30: 50 }, freezeCoins: 20, maxFreezes: 2, warnHour: 20 },
  picks: { enabled: false, count: 5, notifyHour: 9 }, // kullanıcı isteğiyle kapatıldı ("Bugün 5 kişi")
  ai: { textCheck: false, imageCheck: true, verifyCheck: true, verifyAuto: false },
  karaoke: { enabled: true, turnMinutes: 5 },
  dq: {}, // { 'YYYY-MM-DD': 'soru' } — panelden belirli güne özel soru
  packs: DEFAULT_PACKS,
  clubs: DEFAULT_CLUBS,
};

module.exports = function engage(app, ctx) {
  const { store, io, auth, eco, notify, emitTo, brief, sendMessage, chatBetween, isBlocked, limited, isMedia, moderation } = ctx;
  const ai = require('./ai')(ctx);
  ctx.ai = ai;
  const now = () => Date.now();
  const cfg = () => {
    const s = store.get('settings', 'engage') || {};
    const m = (k) => ({ ...DEFAULTS[k], ...(s[k] || {}) });
    return { streak: m('streak'), login: m('login'), picks: m('picks'), ai: m('ai'), karaoke: m('karaoke'), dq: { ...(s.dq || {}) }, packs: s.packs || DEFAULT_PACKS, clubs: s.clubs || DEFAULT_CLUBS };
  };
  const user = (id) => store.get('users', id);
  const SPECIAL = new Set(['falci', 'official']);
  const active = (u) => u && u.status !== 'banned' && !(u.status === 'suspended' && (u.bannedUntil || 0) > now());
  const regular = (u) => active(u) && !SPECIAL.has(u.role);
  const first = (u) => String(u?.name || u?.username || '').split(' ')[0];
  const reward = (n, ms) => Number(ms?.[n] || 0);

  // Diğer modüllerin kancalarını zincirle (growth.js önce yüklenir)
  const chain = (name, fn) => { const prev = ctx[name]; ctx[name] = (...a) => { try { prev?.(...a); } catch (e) { console.error(`[${name}]`, e.message); } return fn(...a); }; };

  // ===================================================================
  // 1) SOHBET SERİSİ: iki kişi aynı gün birbirine yazınca seri bir gün uzar
  // ===================================================================
  const streakDoc = (chatId) => store.get('streaks', chatId);
  function streakOf(chatId) {
    const s = streakDoc(chatId); if (!s || !s.count) return null;
    const d = trDay(); const y = addDays(d, -1);
    if (s.last !== d && s.last !== y) return null; // bozulmuş
    const doneToday = s.last === d;
    return { count: s.count, best: s.best || s.count, done: doneToday, risk: !doneToday && trHour() >= cfg().streak.warnHour, wrote: Object.keys(s.w || {}).filter((k) => s.w[k] === d) };
  }
  ctx.streakOf = streakOf;

  function bumpChatStreak(msg, chat, sender) {
    const c = cfg().streak; if (!c.enabled || !chat || chat.isGroup || msg.system || msg.fal) return;
    if (chat.members.length !== 2 || chat.members.some((m) => SPECIAL.has(user(m)?.role))) return;
    const d = trDay();
    const s = streakDoc(chat.id) || { id: chat.id, members: [...chat.members], w: {}, count: 0, last: null, best: 0 };
    s.w = s.w || {};
    if (s.w[sender.id] === d && s.last === d) return; // bugün zaten sayıldı
    s.w[sender.id] = d;
    const both = chat.members.every((m) => s.w[m] === d);
    let bumped = false;
    if (both && s.last !== d) {
      s.count = s.last === addDays(d, -1) ? (s.count || 0) + 1 : 1;
      s.last = d; s.best = Math.max(s.best || 0, s.count); bumped = true;
    }
    store.put('streaks', s);
    if (!bumped) return;
    chat.members.forEach((m) => emitTo(m, 'streak', { chatId: chat.id, count: s.count }));
    if (s.count >= 2) chat.members.forEach((m) => ctx.quest?.(m, 'seri'));
    const coins = reward(s.count, c.milestones);
    if (coins) {
      chat.members.forEach((m) => eco.addCoins(m, coins, 'streak', { ref: chat.id, days: s.count }));
      chat.members.forEach((m) => emitTo(m, 'wallet', {}));
      sendMessage(chat, sender.id, { text: `${s.count} günlük seri! İkinize de ${coins} jeton hediye. Seriyi bozmayın.`, system: true });
    }
  }

  // ===================================================================
  // 2) GÜNLÜK GİRİŞ SERİSİ
  // ===================================================================
  const loginSeen = new Map(); // uid -> gün (her istekte depoya yazmamak için)
  function loginOf(u) {
    const l = u?.loginStreak; if (!l) return { count: 0, best: 0, freezes: 0, last: null, alive: false };
    const d = trDay(); const alive = l.last === d || (l.last && dayDiff(l.last, d) - 1 <= (l.freezes || 0));
    return { count: alive ? l.count : 0, best: l.best || l.count || 0, freezes: l.freezes || 0, last: l.last, today: l.last === d, alive: !!alive };
  }
  function touchLogin(uid) {
    const d = trDay();
    if (loginSeen.get(uid) === d) return;
    loginSeen.set(uid, d);
    const c = cfg().login; if (!c.enabled) return;
    const u = user(uid); if (!regular(u)) return;
    const l = { count: 0, best: 0, freezes: 0, last: null, ...(u.loginStreak || {}) };
    if (l.last === d) return;
    const gap = l.last ? dayDiff(l.last, d) : 99;
    let used = 0;
    if (gap === 1) l.count += 1;
    else if (gap > 1 && gap - 1 <= (l.freezes || 0)) { used = gap - 1; l.freezes -= used; l.count += 1; }
    else l.count = 1;
    l.last = d; l.best = Math.max(l.best || 0, l.count);
    store.update('users', uid, { loginStreak: l });
    let coins = reward(l.count, c.milestones);
    if (!coins && l.count > 30 && l.count % 30 === 0) coins = reward(30, c.milestones);
    if (coins) {
      eco.addCoins(uid, coins, 'login_streak', { days: l.count });
      notify(uid, { type: 'order', text: `${l.count} gündür SwipeUp’tasın! ${coins} jeton hediye.`, url: '/#/seriler', tag: 'login-streak' });
      emitTo(uid, 'wallet', {});
    }
    emitTo(uid, 'streak:login', { count: l.count, coins, freezeUsed: used });
  }
  chain('onActive', (uid) => touchLogin(uid));

  app.get('/api/streaks', auth, (req, res) => {
    const me = req.user.id;
    const chats = store.filter('streaks', (s) => s.members?.includes(me)).map((s) => {
      const st = streakOf(s.id); if (!st) return null;
      const o = user(s.members.find((m) => m !== me));
      if (!o || isBlocked(me, o.id)) return null;
      return { chatId: s.id, other: brief(o), ...st, iWrote: st.wrote.includes(me) };
    }).filter(Boolean).sort((a, b) => b.count - a.count);
    const c = cfg();
    res.json({ login: loginOf(req.user), chats, milestones: c.streak.milestones, loginMilestones: c.login.milestones, freezeCoins: c.login.freezeCoins, maxFreezes: c.login.maxFreezes, coins: req.user.coins || 0 });
  });
  app.post('/api/streaks/freeze', auth, (req, res) => {
    const c = cfg().login; const u = req.user;
    const l = { count: 0, best: 0, freezes: 0, last: null, ...(u.loginStreak || {}) };
    if ((l.freezes || 0) >= c.maxFreezes) return res.status(400).json({ error: `En fazla ${c.maxFreezes} seri koruyucu tutabilirsin.` });
    if (!eco.spend(u.id, c.freezeCoins, 'streak_freeze')) return res.status(402).json({ error: `Seri koruyucu ${c.freezeCoins} jeton.`, need: c.freezeCoins });
    l.freezes = (l.freezes || 0) + 1;
    store.update('users', u.id, { loginStreak: l });
    emitTo(u.id, 'wallet', {});
    res.json({ login: loginOf(user(u.id)), coins: user(u.id).coins || 0 });
  });

  // Akşam uyarıları: "serin bu gece bitiyor"
  function streakWarnings() {
    const c = cfg(); const d = trDay(); const y = addDays(d, -1); const h = trHour();
    if (c.streak.enabled && h >= c.streak.warnHour) {
      store.filter('streaks', (s) => s.count >= 3 && s.last === y && s.warned !== d).forEach((s) => {
        s.warned = d; store.put('streaks', s);
        s.members.forEach((m) => {
          const o = user(s.members.find((x) => x !== m)); if (!o || isBlocked(m, o.id)) return;
          const wrote = s.w?.[m] === d;
          notify(m, { type: 'streak', text: wrote ? `${first(o)} bugün henüz yazmadı. ${s.count} günlük seriniz bu gece bitiyor, ona hatırlat!` : `${first(o)} ile ${s.count} günlük serin bu gece bitiyor! Bir mesaj at.`, url: `/#/chat/${s.id}`, tag: 'streak-' + s.id });
        });
      });
    }
    if (c.login.enabled && h >= c.login.warnHour) {
      store.filter('users', (u) => regular(u) && u.loginStreak?.count >= 3 && u.loginStreak.last === y && u.loginStreak.warned !== d && !(u.loginStreak.freezes > 0)).forEach((u) => {
        store.update('users', u.id, { loginStreak: { ...u.loginStreak, warned: d } });
        notify(u.id, { type: 'streak', text: `${u.loginStreak.count} günlük giriş serin bu gece bitiyor! Uğra, seriyi koru.`, url: '/#/seriler', tag: 'login-streak' });
      });
    }
  }

  // ===================================================================
  // 3) GÜNÜN SORUSU
  // ===================================================================
  const dqOf = (d = trDay()) => cfg().dq[d] || QUESTIONS[Math.abs(Math.floor(Date.parse(d + 'T00:00:00Z') / DAY)) % QUESTIONS.length];
  const dqOut = (a, me) => ({ id: a.id, day: a.day, text: a.text, at: a.at, user: brief(user(a.userId)), likeCount: a.likes.length, liked: a.likes.includes(me), mine: a.userId === me, replies: (a.replies || []).filter((r) => !isBlocked(me, r.userId)).slice(-30).map((r) => ({ ...r, user: brief(user(r.userId)) })) });
  app.get('/api/dq', auth, (req, res) => {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(req.query.day || '') && req.query.day <= trDay() ? req.query.day : trDay();
    const me = req.user.id;
    const all = store.filter('dq', (a) => a.day === d && user(a.userId) && !isBlocked(me, a.userId));
    const sort = req.query.sort === 'new' ? (a, b) => b.at - a.at : (a, b) => (b.likes.length - a.likes.length) || (b.at - a.at);
    const mine = all.find((a) => a.userId === me);
    res.json({ day: d, today: d === trDay(), q: dqOf(d), mine: mine ? dqOut(mine, me) : null, total: all.length, items: all.sort(sort).slice(0, 80).map((a) => dqOut(a, me)) });
  });
  app.post('/api/dq', auth, (req, res) => {
    const raw = clip(req.body?.text, 400);
    if (raw.length < 2) return res.status(400).json({ error: 'Cevabını yaz.' });
    if (limited('dq:' + req.user.id, 10, 3600000)) return res.status(429).json({ error: 'Biraz yavaş 🙂' });
    const d = trDay(); const id = `${d}_${req.user.id}`;
    const prev = store.get('dq', id);
    const a = store.put('dq', { id, day: d, userId: req.user.id, text: moderation.mask(raw), likes: prev?.likes || [], replies: prev?.replies || [], at: prev?.at || now(), editedAt: prev ? now() : null });
    const fl = moderation.flag(raw);
    if (fl) store.put('flags', { id: nanoid(12), kind: 'genel', userId: req.user.id, chatId: 'dq', ref: a.id, text: raw, level: fl.level, reason: `Günün sorusu · ${fl.reason}`, status: 'open', at: now() });
    if (!prev) ctx.quest?.(req.user.id, 'yorum');
    res.json(dqOut(a, req.user.id));
  });
  app.post('/api/dq/:id/like', auth, (req, res) => {
    const a = store.get('dq', req.params.id); if (!a) return res.status(404).json({ error: 'Cevap bulunamadı.' });
    const me = req.user.id; const had = a.likes.includes(me);
    a.likes = had ? a.likes.filter((x) => x !== me) : [...a.likes, me];
    store.put('dq', a);
    if (!had && a.userId !== me && [1, 5, 10, 25, 50, 100].includes(a.likes.length)) notify(a.userId, { type: 'like', fromId: me, text: `Günün sorusuna verdiğin cevap ${a.likes.length} beğeni aldı!`, url: '/#/soru', tag: 'dq-' + a.id });
    res.json(dqOut(a, me));
  });
  app.post('/api/dq/:id/reply', auth, (req, res) => {
    const a = store.get('dq', req.params.id); if (!a) return res.status(404).json({ error: 'Cevap bulunamadı.' });
    if (isBlocked(req.user.id, a.userId)) return res.status(403).json({ error: 'Bu kişiyle etkileşemezsin.' });
    const raw = clip(req.body?.text, 300); if (!raw) return res.status(400).json({ error: 'Yanıtını yaz.' });
    if (limited('dqr:' + req.user.id, 20, 3600000)) return res.status(429).json({ error: 'Biraz yavaş 🙂' });
    a.replies = [...(a.replies || []), { id: nanoid(8), userId: req.user.id, text: moderation.mask(raw), at: now() }].slice(-200);
    store.put('dq', a);
    if (a.userId !== req.user.id) notify(a.userId, { type: 'comment', fromId: req.user.id, text: `${req.user.username} günün sorusundaki cevabına yanıt verdi: ${raw.slice(0, 80)}`, url: '/#/soru' });
    res.json(dqOut(a, req.user.id));
  });
  app.delete('/api/dq/:id', auth, (req, res) => {
    const a = store.get('dq', req.params.id);
    if (!a || a.userId !== req.user.id) return res.status(404).json({ error: 'Cevap bulunamadı.' });
    store.del('dq', a.id); res.json({ ok: true });
  });
  setInterval(() => { const lim = addDays(trDay(), -30); store.filter('dq', (a) => a.day < lim).forEach((a) => store.del('dq', a.id)); }, 12 * 3600000).unref();

  // ===================================================================
  // 4) KULÜPLER: ilgi alanı grupları, kendi akışı ve sohbet odası (genel sohbet altyapısı)
  // ===================================================================
  const clubs = () => cfg().clubs;
  const clubOf = (id) => clubs().find((c) => c.id === id);
  const isMember = (cid, uid) => !!store.get('club_members', `${cid}_${uid}`);
  const memberCount = (cid) => store.filter('club_members', (m) => m.clubId === cid).length;
  // Genel sohbet modülü kulüp odalarını bununla tanır: oda kimliği "k_<kulüp>"
  ctx.clubRoom = (rid) => { const m = /^k_([a-z0-9]+)$/.exec(String(rid || '')); const c = m && clubOf(m[1]); return c ? { id: rid, em: c.em, name: c.name, desc: c.desc, always: true, club: c.id } : null; };
  ctx.clubCanSend = (cid, uid) => isMember(cid, uid);
  const clubOut = (c, me) => ({ ...c, members: memberCount(c.id), joined: isMember(c.id, me), room: `k_${c.id}`, posts: store.filter('club_posts', (p) => p.clubId === c.id).length });
  const cpostOut = (p, me) => ({ id: p.id, clubId: p.clubId, text: p.text, media: p.media || null, at: p.at, user: brief(user(p.userId)), likeCount: p.likes.length, liked: p.likes.includes(me), mine: p.userId === me });
  app.get('/api/clubs', auth, (req, res) => res.json(clubs().map((c) => clubOut(c, req.user.id)).sort((a, b) => (b.joined - a.joined) || (b.members - a.members))));
  app.get('/api/clubs/:id', auth, (req, res) => {
    const c = clubOf(req.params.id); if (!c) return res.status(404).json({ error: 'Kulüp bulunamadı.' });
    const me = req.user.id;
    const before = +req.query.before || Infinity;
    const posts = store.filter('club_posts', (p) => p.clubId === c.id && p.at < before && !isBlocked(me, p.userId) && user(p.userId)).sort((a, b) => b.at - a.at);
    const mem = store.filter('club_members', (m) => m.clubId === c.id).sort((a, b) => b.at - a.at).slice(0, 12).map((m) => brief(user(m.uid))).filter(Boolean);
    res.json({ club: clubOut(c, me), posts: posts.slice(0, 30).map((p) => cpostOut(p, me)), more: posts.length > 30, sample: mem });
  });
  app.post('/api/clubs/:id/join', auth, (req, res) => {
    const c = clubOf(req.params.id); if (!c) return res.status(404).json({ error: 'Kulüp bulunamadı.' });
    if (store.filter('club_members', (m) => m.uid === req.user.id).length >= 15 && !isMember(c.id, req.user.id)) return res.status(400).json({ error: 'En fazla 15 kulübe katılabilirsin.' });
    store.put('club_members', { id: `${c.id}_${req.user.id}`, clubId: c.id, uid: req.user.id, at: now() });
    res.json(clubOut(c, req.user.id));
  });
  app.delete('/api/clubs/:id/join', auth, (req, res) => {
    const c = clubOf(req.params.id); if (!c) return res.status(404).json({ error: 'Kulüp bulunamadı.' });
    store.del('club_members', `${c.id}_${req.user.id}`);
    res.json(clubOut(c, req.user.id));
  });
  app.post('/api/clubs/:id/posts', auth, (req, res) => {
    const c = clubOf(req.params.id); if (!c) return res.status(404).json({ error: 'Kulüp bulunamadı.' });
    if (!isMember(c.id, req.user.id)) return res.status(403).json({ error: 'Paylaşmak için önce kulübe katıl.' });
    const raw = clip(req.body?.text, 1000); const media = isMedia(req.body?.media) ? req.body.media : null;
    if (!raw && !media) return res.status(400).json({ error: 'Bir şeyler yaz ya da fotoğraf ekle.' });
    if (limited('cp:' + req.user.id, 10, 3600000)) return res.status(429).json({ error: 'Biraz yavaş 🙂' });
    const p = store.put('club_posts', { id: nanoid(12), clubId: c.id, userId: req.user.id, text: moderation.mask(raw), media, likes: [], at: now() });
    const fl = raw && moderation.flag(raw);
    if (fl) store.put('flags', { id: nanoid(12), kind: 'genel', userId: req.user.id, chatId: 'club:' + c.id, ref: p.id, text: raw, level: fl.level, reason: `Kulüp · ${fl.reason}`, status: 'open', at: now() });
    ctx.quest?.(req.user.id, 'paylas');
    res.json(cpostOut(p, req.user.id));
  });
  app.post('/api/club-posts/:id/like', auth, (req, res) => {
    const p = store.get('club_posts', req.params.id); if (!p) return res.status(404).json({ error: 'Gönderi bulunamadı.' });
    const me = req.user.id; const had = p.likes.includes(me);
    p.likes = had ? p.likes.filter((x) => x !== me) : [...p.likes, me];
    store.put('club_posts', p);
    if (!had && p.userId !== me) notify(p.userId, { type: 'like', fromId: me, text: `${req.user.username} ${clubOf(p.clubId)?.name || ''} kulübündeki paylaşımını beğendi`, url: `/#/kulup/${p.clubId}`, tag: 'cp-' + p.id });
    res.json(cpostOut(p, me));
  });
  app.delete('/api/club-posts/:id', auth, (req, res) => {
    const p = store.get('club_posts', req.params.id);
    if (!p || p.userId !== req.user.id) return res.status(404).json({ error: 'Gönderi bulunamadı.' });
    store.del('club_posts', p.id); res.json({ ok: true });
  });

  // ===================================================================
  // 5) ŞU AN DİNLEDİĞİM
  // ===================================================================
  const NP_TTL = 12 * 3600000;
  const npKey = (t) => trLower(`${t.title}|${t.artist}`);
  const npLive = (u) => u?.nowPlaying && u.nowPlaying.until > now() ? u.nowPlaying : null;
  app.put('/api/me/now-playing', auth, (req, res) => {
    const t = music.clean(req.body?.track || req.body);
    if (!t) return res.status(400).json({ error: 'Şarkı seçilemedi. Aramadan bir şarkı seç.' });
    const np = { ...t, key: npKey(t), at: now(), until: now() + NP_TTL };
    store.update('users', req.user.id, { nowPlaying: np });
    res.json({ nowPlaying: np, same: store.filter('users', (u) => u.id !== req.user.id && npLive(u)?.key === np.key).length });
  });
  app.delete('/api/me/now-playing', auth, (req, res) => { store.update('users', req.user.id, { nowPlaying: null }); res.json({ ok: true }); });
  app.get('/api/now-playing/:uid', auth, (req, res) => {
    const u = user(req.params.uid); const np = npLive(u);
    if (!np) return res.json({ nowPlaying: null, same: [], artist: [] });
    const me = req.user.id;
    const ok = (x) => x.id !== u.id && regular(x) && !isBlocked(me, x.id) && !(x.privacy || {}).private;
    const all = store.filter('users', (x) => ok(x) && npLive(x));
    const same = all.filter((x) => npLive(x).key === np.key);
    const artist = np.artist ? all.filter((x) => npLive(x).key !== np.key && trLower(npLive(x).artist) === trLower(np.artist)) : [];
    res.json({ nowPlaying: np, same: same.slice(0, 30).map(brief), artist: artist.slice(0, 20).map((x) => ({ ...brief(x), track: npLive(x).title })) });
  });

  // ===================================================================
  // 6) GÜNLÜK SEÇKİ: her sabah ilgi alanı, burç ve konuma göre 5 kişi
  // ===================================================================
  function pickReasons(me, u) {
    const r = []; let score = 0;
    const mi = new Set((me.interests || []).map(trLower));
    const common = (u.interests || []).filter((x) => mi.has(trLower(x)));
    if (common.length) { score += common.length * 3; r.push(common.length === 1 ? `Sen de ${common[0]} seviyorsun` : `${common.length} ortak ilgi alanı`); }
    const za = zodiacOf(me); const zb = zodiacOf(u);
    if (za && zb) {
      const ea = ELEMENT[za]; const eb = ELEMENT[zb];
      if (ea === eb) { score += 3; r.push(`Burçlarınız aynı elementten ${ZODIAC[za][1]}${ZODIAC[zb][1]}`); }
      else if (GOOD_PAIR.has(`${ea}_${eb}`)) { score += 2; r.push(`Burçlarınız uyumlu ${ZODIAC[za][1]}${ZODIAC[zb][1]}`); }
    }
    const d = km(me, u);
    if (d != null) { if (d <= 10) { score += 3; r.push(`${d} km uzakta`); } else if (d <= 50) { score += 2; r.push(`${d} km uzakta`); } else if (d <= 200) score += 1; }
    else if (me.city && u.city && trLower(me.city) === trLower(u.city)) { score += 2; r.push(`O da ${u.city}’da`); }
    if ((u.lastSeen || 0) > now() - 3 * DAY) score += 1;
    if (u.verified) { score += 1; r.push('Doğrulanmış profil'); }
    if ((u.photos || []).length >= 2) score += 1;
    return { score, reasons: r.slice(0, 3) };
  }
  function computePicks(me) {
    const c = cfg().picks;
    const swiped = new Set(store.filter('swipes', (s) => s.from === me.id).map((s) => s.to));
    const prefs = me.prefs || {};
    const myAge = ageOf(me);
    const cands = store.filter('users', (u) => {
      if (u.id === me.id || !regular(u) || swiped.has(u.id) || isBlocked(me.id, u.id)) return false;
      if (u.needsBirthdate || !u.birthdate) return false;
      if (me.lookingFor && me.lookingFor !== 'all' && u.gender && u.gender !== me.lookingFor) return false;
      if (u.lookingFor && u.lookingFor !== 'all' && me.gender && me.gender !== u.lookingFor) return false;
      const a = ageOf(u);
      if (a != null && (a < (prefs.ageMin || 18) || a > (prefs.ageMax || 99))) return false;
      if (myAge != null && a != null && Math.abs(a - myAge) > 15) return false;
      if (prefs.maxKm) { const d = km(me, u); if (d != null && d > prefs.maxKm) return false; }
      return (u.lastSeen || u.createdAt || 0) > now() - 30 * DAY;
    });
    return cands.map((u) => ({ u, ...pickReasons(me, u), j: Math.random() })).sort((a, b) => (b.score + b.j * 2) - (a.score + a.j * 2)).slice(0, c.count);
  }
  const pickOut = (me, u) => ({ ...brief(u), age: ctx.shownAge ? ctx.shownAge(u) : ageOf(u), city: u.city || '', bio: u.bio || '', interests: (u.interests || []).slice(0, 6), photo: (u.photos || [])[0] || u.avatar, zodiac: zodiacOf(u) ? ZODIAC[zodiacOf(u)] : null, distanceKm: km(me, u), reasons: pickReasons(me, u).reasons, nowPlaying: npLive(u) ? { title: u.nowPlaying.title, artist: u.nowPlaying.artist } : null });
  app.get('/api/picks', auth, (req, res) => {
    const me = req.user; const c = cfg().picks;
    if (!c.enabled) return res.json({ enabled: false, items: [] });
    const id = `${me.id}_${trDay()}`;
    let doc = store.get('picks', id);
    if (!doc) doc = store.put('picks', { id, uid: me.id, day: trDay(), ids: computePicks(me).map((x) => x.u.id), at: now() });
    const swipes = new Map(store.filter('swipes', (s) => s.from === me.id && doc.ids.includes(s.to)).map((s) => [s.to, s.dir]));
    const items = doc.ids.map((uid) => user(uid)).filter((u) => regular(u) && !isBlocked(me.id, u.id)).map((u) => ({ ...pickOut(me, u), swiped: swipes.get(u.id) || null }));
    const next = (() => { const t = new Date(now() + TR); t.setUTCHours(24, 0, 0, 0); return t.getTime() - TR; })();
    res.json({ enabled: true, day: doc.day, items, nextAt: next });
  });
  setInterval(() => { const lim = addDays(trDay(), -3); store.filter('picks', (p) => p.day < lim).forEach((p) => store.del('picks', p.id)); }, 12 * 3600000).unref();
  function morningPicks() {
    const c = cfg().picks; if (!c.enabled || trHour() < c.notifyHour || trHour() > 12) return;
    const d = trDay(); const run = store.get('settings', 'picks_run');
    if (run?.day === d) return;
    store.put('settings', { id: 'picks_run', day: d, at: now() });
    store.filter('users', (u) => regular(u) && u.birthdate && (u.lastSeen || 0) > now() - 14 * DAY).forEach((u) => {
      notify(u.id, { type: 'picks', text: `Günaydın ${first(u)}! Bugün senin için ${c.count} kişi seçtik.`, url: '/#/secki', tag: 'picks' });
    });
  }

  // ===================================================================
  // 7) UYUM TESTİ: 10 soru, sonucu Falcı Teyze yorumlar
  // ===================================================================
  const otherOf = (chat, me) => chat.members.find((m) => m !== me);
  ctx.compatOut = (c) => (c.status === 'done' ? c : { ...c, answers: Object.fromEntries(Object.keys(c.answers || {}).map((k) => [k, true])) });
  function scoreCompat(a, b) {
    let s = 0;
    const per = COMPAT_QS.map((q, i) => { const x = a[i]; const y = b[i]; const p = x === y ? 10 : q.scale && Math.abs(x - y) === 1 ? 5 : 0; s += p; return p; });
    return { pct: Math.round((s / (COMPAT_QS.length * 10)) * 100), per };
  }
  const FALLBACK = [
    [80, 'Evladım, kahvenin telvesinde iki kalp yan yana duruyor. Bu kadar uyum her gün görülmez; birbirinizin cümlelerini tamamlayacak gibisiniz. Ama dikkat, fazla benzerlik bazen sıkılganlık getirir, birbirinizi şaşırtmayı unutmayın. 💞'],
    [60, 'Yıldızlar size göz kırpıyor kuzum. Çoğu konuda aynı yere bakıyorsunuz, farklarınız da tuz biber olur. Küçük bir sabırla güzel bir hikaye çıkar buradan. ✨'],
    [40, 'Fincanda bir yol ayrımı görüyorum ama korkma, yollar birleşebilir. Farklısınız, bu da öğrenecek çok şeyiniz var demek. Konuşun, anlaşın, gerisini kader halleder. 🔮'],
    [0, 'Ay balım, ikiniz iki ayrı dünyadansınız! Ama bilirsin, zıt kutuplar birbirini çeker. Merak edin, sorun, dinleyin; belki de en güzel sürpriz sizi bekliyor. 🌙'],
  ];
  async function compatComment(chat, c, pct) {
    const [a, b] = Object.keys(c.answers).map(user);
    const lines = COMPAT_QS.map((q, i) => `${q.q} → ${first(a)}: "${q.o[c.answers[a.id][i]]}", ${first(b)}: "${q.o[c.answers[b.id][i]]}"`);
    const za = zodiacOf(a); const zb = zodiacOf(b);
    try {
      if (!ai.enabled()) throw new Error('kapalı');
      const t = await ai.text(`${first(a)}${za ? ` (${ZODIAC[za][0]})` : ''} ile ${first(b)}${zb ? ` (${ZODIAC[zb][0]})` : ''} bir uyum testi çözdü. Uyum: %${pct}.\n${lines.join('\n')}\n\nFalcı Teyze olarak bu ikiliye 4-5 cümlelik, sıcak, esprili ve umut veren bir yorum yaz. İsimleriyle hitap et, cevaplarından 1-2 somut örnek ver. Kehanet gibi kesin konuşma, eğlence amaçlı olduğunu hissettir. Emoji en fazla 2 tane.`, { system: 'Sen SwipeUp uygulamasının sevimli, şefkatli ve esprili Falcı Teyze’sisin. Türkçe yazarsın, "evladım, kuzum" gibi samimi hitaplar kullanırsın. Asla sağlık, hukuk ya da para tavsiyesi vermezsin.', timeout: 25000, temperature: 0.95, maxTokens: 700 });
      if (t && t.length > 40) return t.slice(0, 1200);
    } catch {}
    return FALLBACK.find(([lim]) => pct >= lim)[1];
  }
  app.get('/api/compat/questions', auth, (req, res) => res.json(COMPAT_QS));
  app.post('/api/chats/:id/compat', auth, (req, res) => {
    const chat = store.get('chats', req.params.id);
    if (!chat || chat.isGroup || !chat.members.includes(req.user.id)) return res.status(404).json({ error: 'Sohbet bulunamadı.' });
    const o = user(otherOf(chat, req.user.id));
    if (!o || SPECIAL.has(o.role) || isBlocked(req.user.id, o.id)) return res.status(400).json({ error: 'Bu sohbette uyum testi başlatılamaz.' });
    const open = store.find('messages', (m) => m.chatId === chat.id && m.compat && m.compat.status === 'open' && !m.deleted);
    if (open) return res.status(409).json({ error: 'Bu sohbette zaten açık bir uyum testi var.', messageId: open.id });
    if (limited('compat:' + chat.id, 3, DAY)) return res.status(429).json({ error: 'Bugün yeterince test çözdünüz 🙂 Yarın tekrar deneyin.' });
    const msg = sendMessage(chat, req.user.id, { text: 'Uyum testi', compat: { id: nanoid(8), status: 'open', answers: {}, at: now() } });
    if (!msg) return res.status(400).json({ error: 'Gönderilemedi.' });
    res.json(ctx.msgOut(msg));
  });
  app.post('/api/messages/:id/compat', auth, (req, res) => {
    const m = store.get('messages', req.params.id);
    const chat = m && store.get('chats', m.chatId);
    if (!m?.compat || !chat?.members.includes(req.user.id)) return res.status(404).json({ error: 'Test bulunamadı.' });
    if (m.compat.status !== 'open') return res.status(409).json({ error: 'Bu test tamamlandı.' });
    const ans = Array.isArray(req.body?.answers) ? req.body.answers.map((x) => parseInt(x, 10)) : [];
    if (ans.length !== COMPAT_QS.length || ans.some((x, i) => !(x >= 0 && x < COMPAT_QS[i].o.length))) return res.status(400).json({ error: 'Bütün soruları cevapla.' });
    m.compat.answers = { ...(m.compat.answers || {}), [req.user.id]: ans };
    const done = chat.members.every((x) => m.compat.answers[x]);
    if (done) {
      const [a, b] = chat.members;
      const sc = scoreCompat(m.compat.answers[a], m.compat.answers[b]);
      Object.assign(m.compat, { status: 'scoring', pct: sc.pct, per: sc.per });
    }
    store.update('messages', m.id, {});
    chat.members.forEach((x) => emitTo(x, 'message:update', ctx.msgOut(m)));
    if (!done) {
      const o = otherOf(chat, req.user.id);
      notify(o, { type: 'message', fromId: req.user.id, text: `${first(req.user)} uyum testini çözdü, sıra sende!`, url: `/#/chat/${chat.id}`, tag: 'chat-' + chat.id });
    } else {
      compatComment(chat, m.compat, m.compat.pct).then((txt) => {
        const cur = store.get('messages', m.id); if (!cur?.compat) return;
        Object.assign(cur.compat, { status: 'done', comment: txt, doneAt: now() });
        store.update('messages', cur.id, {});
        chat.members.forEach((x) => emitTo(x, 'message:update', ctx.msgOut(cur)));
        chat.members.forEach((x) => notify(x, { type: 'message', text: `Uyum testinizin sonucu geldi: %${cur.compat.pct}! Falcı Teyze yorumladı.`, url: `/#/chat/${chat.id}`, tag: 'chat-' + chat.id }));
      });
    }
    res.json(ctx.msgOut(m));
  });

  // ===================================================================
  // 8) BULUŞMA HATIRLATMALARI (planlayıcı social.js'de)
  // ===================================================================
  function planReminders() {
    const t = now();
    store.filter('messages', (m) => m.plan && !m.deleted && m.plan.when > t && m.plan.when - t <= DAY && !(m.plan.rem2)).forEach((m) => {
      const chat = store.get('chats', m.chatId); if (!chat) return;
      const left = m.plan.when - t;
      const hhmm = new Date(m.plan.when + TR).toISOString().slice(11, 16);
      let text = null;
      if (left <= 2.5 * 3600000) { m.plan.rem2 = true; m.plan.rem24 = true; text = `⏰ Buluşmana ${Math.max(1, Math.round(left / 3600000))} saatten az kaldı: ${m.plan.place} · ${hhmm}`; }
      else if (!m.plan.rem24 && t - m.at > 6 * 3600000) { m.plan.rem24 = true; text = `📅 Yarın buluşman var: ${m.plan.place} · ${hhmm}. Hazır mısın? 💛`; }
      if (!text) return;
      store.update('messages', m.id, {});
      chat.members.forEach((x) => { const o = user(chat.members.find((y) => y !== x)); notify(x, { type: 'safety', text: o ? `${text} (${first(o)} ile)` : text, url: `/#/chat/${chat.id}`, tag: 'plan-' + m.id }); });
    });
  }

  // ===================================================================
  // 9) SOHBETTE SANAL HEDİYE
  // ===================================================================
  app.post('/api/chats/:id/gift', auth, (req, res) => {
    const chat = store.get('chats', req.params.id);
    if (!chat || chat.isGroup || !chat.members.includes(req.user.id)) return res.status(404).json({ error: 'Sohbet bulunamadı.' });
    const to = user(otherOf(chat, req.user.id));
    if (!to || SPECIAL.has(to.role) || isBlocked(req.user.id, to.id)) return res.status(400).json({ error: 'Bu kişiye hediye gönderilemez.' });
    const s = eco.get();
    const gift = s.gifts.find((g) => g.id === req.body?.giftId);
    if (!gift) return res.status(400).json({ error: 'Hediye bulunamadı.' });
    if (limited('cgift:' + req.user.id, 30, 3600000)) return res.status(429).json({ error: 'Biraz yavaş 🙂' });
    if (!eco.spend(req.user.id, gift.coins, 'gift', { to: to.id, gift: gift.id, chat: chat.id })) return res.status(402).json({ error: 'Jetonun yetmiyor.', needCoins: true });
    eco.earn(to.id, Math.round(gift.coins * s.creatorShare), 'gift', { fromId: req.user.id, gift: gift.id, chat: chat.id });
    const msg = sendMessage(chat, req.user.id, { text: `${gift.em} ${gift.name} gönderdi`, gift: { id: gift.id, em: gift.em, name: gift.name, coins: gift.coins } });
    emitTo(req.user.id, 'wallet', {}); emitTo(to.id, 'wallet', {});
    res.json({ message: msg && ctx.msgOut(msg), coins: user(req.user.id).coins || 0 });
  });

  // ===================================================================
  // 10) FALCI TEYZE PAKETLERİ
  // ===================================================================
  const packs = () => cfg().packs.filter((p) => p.enabled !== false);
  const packsOf = (u) => Object.fromEntries(Object.entries(u.falPacks || {}).filter(([, v]) => v.left > 0 && v.until > now()));
  app.get('/api/fal/packs', auth, (req, res) => res.json({ packs: packs(), mine: packsOf(req.user), coins: req.user.coins || 0, zodiac: zodiacOf(req.user) }));
  app.post('/api/fal/packs/:id/buy', auth, (req, res) => {
    const p = packs().find((x) => x.id === req.params.id); if (!p) return res.status(404).json({ error: 'Paket bulunamadı.' });
    const f = ctx.falci?.(); if (!f) return res.status(503).json({ error: 'Falcı Teyze şu an hizmet vermiyor.' });
    const u = req.user;
    const z = zodiacOf(u);
    if (p.type === 'yillik' && !z) return res.status(400).json({ error: 'Yıllık rapor için önce profiline doğum tarihini ya da burcunu ekle.' });
    if (!eco.spend(u.id, p.coins, 'fal_pack', { ref: p.id })) return res.status(402).json({ error: `Bu paket ${p.coins} jeton.`, need: p.coins });
    eco.earn(f.id, Math.round(p.coins * eco.get().falciShare), 'fal_pack', { fromId: u.id, ref: p.id });
    let chatId = null;
    if (p.type === 'yillik') {
      const chat = chatBetween(u.id, f.id); chatId = chat.id;
      const y = new Date().getFullYear();
      const note = `Yıllık burç raporu (${y}–${y + 1}): Önümüzdeki 12 ayı ay ay yorumla; aşk, iş ve para başlıklarını ayrı ayrı anlat, şanslı dönemleri belirt.`;
      const msg = sendMessage(chat, u.id, { text: 'Yıllık burç raporu', fal: { id: nanoid(8), type: 'burc', note, images: [], cards: [], partner: null, zodiac: z, name: u.name, status: 'pending', at: now(), price: 0, pack: p.id, dueAt: ctx.falDueAt?.('burc') || null } });
      if (msg) ctx.onFalRequest?.(msg);
    } else {
      const cur = (u.falPacks || {})[p.type];
      const alive = cur && cur.until > now() ? cur.left : 0;
      store.update('users', u.id, { falPacks: { ...(u.falPacks || {}), [p.type]: { left: alive + p.credits, until: Math.max(now(), cur?.until || 0) + p.days * DAY, pack: p.id } } });
    }
    emitTo(u.id, 'wallet', {});
    res.json({ ok: true, chatId, mine: packsOf(user(u.id)), coins: user(u.id).coins || 0 });
  });
  // Fal ücreti: paket kredisi varsa ücretsiz (abonelikten sonra bakılır)
  const prevPrice = ctx.falPriceFor;
  ctx.falPriceFor = (u, type, price) => {
    const r = prevPrice ? prevPrice(u, type, price) : { price };
    if (!r.price) return r;
    const p = packsOf(u)[type];
    return p ? { price: 0, use: { __pack: type } } : r;
  };
  const prevUse = ctx.useFalSub;
  ctx.useFalSub = (u, use) => {
    if (use?.__pack) { const fresh = user(u.id); const p = fresh.falPacks?.[use.__pack]; if (p) store.update('users', u.id, { falPacks: { ...fresh.falPacks, [use.__pack]: { ...p, left: Math.max(0, p.left - 1) } } }); return; }
    prevUse?.(u, use);
  };

  // ===================================================================
  // 11) GÜNÜN BURÇ KARTI (paylaşılabilir)
  // ===================================================================
  const BURC_TPL = {
    a: ['Bugün içindeki ses her zamankinden yüksek, ona kulak ver.', 'Gökyüzü sana cesaret veriyor; ertelediğin o adımı at.', 'Ay’ın konumu duygularını yumuşatıyor, affetmek için güzel bir gün.', 'Beklemediğin bir mesaj gününü güzelleştirebilir.', 'Enerjin yüksek; çevrendekiler bunu hissedecek.', 'Küçük bir sürpriz kapında, gözlerini açık tut.'],
    b: ['Aşkta: samimiyetin en büyük çekiciliğin olacak.', 'Aşkta: ilk adımı sen atarsan şaşırtıcı bir karşılık alabilirsin.', 'Aşkta: geçmişten gelen biri aklını karıştırabilir, acele etme.', 'Aşkta: bugün flörtöz enerjin dorukta 😉', 'Aşkta: dinlemek, konuşmaktan daha çok yakınlaştıracak.', 'Aşkta: küçük bir jest büyük bir kapı açar.'],
    c: ['Şans rengin mor, şanslı saatin akşamüstü.', 'Şanslı sayın 7; bir kahve molası iyi gelecek.', 'Şans rengin altın sarısı; kendine bir iyilik yap.', 'Şanslı saatin öğle; sorularının cevabı o saatlerde netleşir.', 'Şans rengin pembe; bugün güldüğün kadar kazançlısın.', 'Şanslı sayın 3; arkadaşlarınla buluşmak bereket getirir.'],
  };
  const burcInflight = new Map();
  async function burcToday(z) {
    const d = trDay(); const id = `${d}_${z}`;
    const doc = store.get('burc_daily', id); if (doc) return doc;
    if (burcInflight.has(id)) return burcInflight.get(id);
    const p = (async () => {
      let text = null; let src = 'tpl';
      if (ai.enabled()) {
        try {
          text = await ai.text(`${ZODIAC[z][0]} burcu için ${d} tarihli günlük burç yorumu yaz. 3 kısa cümle: genel enerji, aşk, şanslı renk ya da saat. Toplam 45 kelimeyi geçme. Başlık ve madde işareti kullanma.`, { system: 'Sen SwipeUp’ın sıcak ve esprili Falcı Teyze’sisin. Türkçe yazarsın. Eğlence amaçlı, olumlu ve umut verici konuşursun; sağlık ya da para tavsiyesi vermezsin.', timeout: 12000, temperature: 1, maxTokens: 300 });
          if (text) { text = text.replace(/\s+/g, ' ').trim().slice(0, 400); src = 'ai'; }
        } catch { text = null; }
      }
      if (!text) {
        let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        text = [BURC_TPL.a[h % 6], BURC_TPL.b[(h >> 3) % 6], BURC_TPL.c[(h >> 6) % 6]].join(' ');
      }
      const out = store.put('burc_daily', { id, day: d, z, text, src, at: now() });
      burcInflight.delete(id);
      return out;
    })();
    burcInflight.set(id, p);
    return p;
  }
  ctx.burcToday = burcToday; ctx.zodiacOf = zodiacOf; ctx.ZODIAC_NAMES = ZODIAC;
  app.get('/api/burc/today', auth, ctx.wrap(async (req, res) => {
    const z = ZODIAC[req.query.z] ? req.query.z : zodiacOf(req.user);
    if (!z) return res.json({ zodiac: null });
    const d = await burcToday(z);
    res.json({ zodiac: z, name: ZODIAC[z][0], sym: ZODIAC[z][1], day: d.day, text: d.text, refCode: req.user.refCode || null });
  }));
  setInterval(() => { const lim = addDays(trDay(), -7); store.filter('burc_daily', (x) => x.day < lim).forEach((x) => store.del('burc_daily', x.id)); }, 12 * 3600000).unref();

  // ===================================================================
  // 12) YAPAY ZEKA DENETİMİ: göndermeden önce "Emin misin?"
  // ===================================================================
  const warnedMedia = new Map(); // medya adresi -> { uid, reason, at }
  const textCache = new Map();
  app.post('/api/mod/check', auth, ctx.wrap(async (req, res) => {
    const c = cfg().ai;
    const text = clip(req.body?.text, 2000);
    const media = isMedia(req.body?.media) ? req.body.media : null;
    if (text) {
      const w = moderation.warn(text);
      if (w) return res.json({ warn: true, kind: 'text', reason: w.reason });
      if (c.textCheck && ai.enabled() && text.length >= 6 && !limited('modt:' + req.user.id, 40, 3600000)) {
        const k = text.toLocaleLowerCase('tr-TR');
        let r = textCache.get(k);
        if (!r) {
          try {
            r = await ai.json(`Aşağıdaki mesaj bir arkadaşlık uygulamasında birine gönderilmek üzere. Hakaret, aşağılama, cinsel taciz, tehdit ya da nefret söylemi içeriyor mu? Şaka/argo ama zararsızsa "ok" de.\nMesaj: """${text}"""\nSadece JSON döndür: {"ok": true|false, "reason": "kısa Türkçe sebep"}`, { timeout: 2500, temperature: 0, maxTokens: 120 });
          } catch { r = { ok: true }; }
          if (textCache.size > 2000) textCache.clear();
          textCache.set(k, r);
        }
        if (r && r.ok === false) return res.json({ warn: true, kind: 'text', reason: clip(r.reason, 80) || 'Kırıcı olabilir' });
      }
    }
    if (media && c.imageCheck && ai.enabled() && !limited('modi:' + req.user.id, 30, 3600000)) {
      try {
        const r = await ai.vision('Bu fotoğraf bir arkadaşlık uygulamasında özel mesajla gönderilmek üzere. Çıplaklık, açık cinsel içerik, şiddet/kan ya da nefret sembolü var mı? Mayo/bikini, öpücük ve normal selfie sorun değildir.\nSadece JSON döndür: {"ok": true|false, "reason": "kısa Türkçe sebep"}', [media], { timeout: 8000, temperature: 0, maxTokens: 120 });
        if (r?.blocked || r?.ok === false) {
          warnedMedia.set(media, { uid: req.user.id, reason: clip(r.reason, 80) || 'Uygunsuz içerik', at: now() });
          return res.json({ warn: true, kind: 'image', reason: clip(r.reason, 80) || 'Uygunsuz içerik olabilir' });
        }
      } catch {}
    }
    res.json({ warn: false });
  }));
  setInterval(() => { const lim = now() - 3600000; for (const [k, v] of warnedMedia) if (v.at < lim) warnedMedia.delete(k); }, 600000).unref();

  // Mesaj gönderildiğinde: seri + uyarıya rağmen gönderilen fotoğrafı yönetime bildir
  chain('onMessage', (msg, chat, sender) => {
    try { bumpChatStreak(msg, chat, sender); } catch (e) { console.error('[streak]', e.message); }
    const w = msg.media && warnedMedia.get(msg.media);
    if (w && w.uid === sender.id) {
      warnedMedia.delete(msg.media);
      store.put('flags', { id: nanoid(12), kind: 'message', userId: sender.id, chatId: chat.id, ref: msg.id, text: `📷 Fotoğraf · Yapay zeka uyarısına rağmen gönderildi: ${w.reason}`, media: msg.media, level: 'medium', reason: 'Yapay zeka: uygunsuz fotoğraf', status: 'open', at: now() });
    }
  });

  // ===================================================================
  // 13) SELFIE DOĞRULAMA: yapay zeka ön kontrolü (isteğe bağlı otomatik onay)
  // ===================================================================
  ctx.onVerify = async (v) => {
    const c = cfg().ai; if (!c.verifyCheck || !ai.enabled()) return;
    const u = user(v.userId); if (!u) return;
    const pose = (require('./features').POSES || []).find((p) => p.id === v.pose);
    const refs = [...(u.photos || []), u.avatar].filter((x) => x && isMedia(x)).slice(0, 2);
    try {
      const r = await ai.vision(`İlk görsel kullanıcının şimdi çektiği doğrulama selfiesi. ${refs.length ? `Sonraki ${refs.length} görsel profil fotoğrafları.` : 'Profil fotoğrafı yok.'}\nİstenen poz: "${pose?.text || v.pose}".\nKontrol et: 1) Selfiedeki kişi istenen pozu veriyor mu? 2) Gerçek ve canlı bir fotoğraf mı (ekran, basılı fotoğraf ya da ünlü resmi değil)? 3) Profil fotoğraflarındaki kişiyle aynı kişi gibi mi görünüyor?\nSadece JSON döndür: {"pose": true|false, "live": true|false, "same": true|false|null, "confidence": 0-1 arası sayı, "note": "kısa Türkçe not"}`, [v.selfie, ...refs], { timeout: 30000, temperature: 0, maxTokens: 200 });
      const res = { pose: !!r.pose, live: !!r.live, same: r.same === null ? null : !!r.same, confidence: Math.max(0, Math.min(1, +r.confidence || 0)), note: clip(r.note, 160), at: now() };
      const cur = store.get('verifications', v.id); if (!cur) return;
      store.update('verifications', v.id, { ai: res });
      if (c.verifyAuto && cur.status === 'pending' && res.pose && res.live && res.same && res.confidence >= 0.85) {
        store.update('verifications', v.id, { status: 'approved', note: '', by: 'yapay zeka', closedAt: now() });
        store.update('users', v.userId, { verified: true, verifiedAt: now() });
        notify(v.userId, { type: 'verify', text: '✅ Profilin doğrulandı! Artık adının yanında mavi tik var.', title: 'SwipeUp', url: '/#/verify' });
      }
    } catch (e) { store.update('verifications', v.id, { ai: { error: e.message.slice(0, 120), at: now() } }); }
  };

  // ===================================================================
  // 14) KARAOKE ODASI: sıra, canlı yayın ve dinleyici puanı
  // ===================================================================
  const K = { queue: [], cur: null };
  const kOut = (me) => {
    const c = cfg().karaoke;
    const cur = K.cur && (() => {
      const vals = Object.values(K.cur.scores); const u = user(K.cur.uid);
      return { user: brief(u), song: K.cur.song, startedAt: K.cur.startedAt, endsAt: K.cur.endsAt, live: !!brief(u)?.live, votes: vals.length, avg: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null, myScore: K.cur.scores[me] || null };
    })();
    const ws = weekStart();
    const turns = store.filter('karaoke_turns', (t) => t.at >= ws && t.votes >= 3);
    const best = new Map(); turns.forEach((t) => { if (!best.has(t.uid) || best.get(t.uid).avg < t.avg) best.set(t.uid, t); });
    const board = [...best.values()].sort((a, b) => (b.avg - a.avg) || (b.votes - a.votes)).slice(0, 10).map((t, i) => ({ rank: i + 1, user: brief(user(t.uid)), song: t.song, avg: t.avg, votes: t.votes })).filter((x) => x.user);
    return { enabled: c.enabled, turnMinutes: c.turnMinutes, cur, queue: K.queue.map((q, i) => ({ pos: i + 1, user: brief(user(q.uid)), song: q.song, mine: q.uid === me })).filter((q) => q.user), myPos: K.queue.findIndex((q) => q.uid === me) + 1 || null, myTurn: K.cur?.uid === me, board, weekStart: ws };
  };
  const kPing = () => io.emit('karaoke', {});
  function kFinish(reason) {
    const c = K.cur; K.cur = null;
    if (c) {
      const vals = Object.values(c.scores);
      if (vals.length) {
        const avg = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
        store.put('karaoke_turns', { id: nanoid(10), uid: c.uid, song: c.song, avg, votes: vals.length, at: now() });
        notify(c.uid, { type: 'order', text: `🎤 Karaoke bitti! ${vals.length} kişi puan verdi, ortalaman ${avg} ⭐`, url: '/#/karaoke', tag: 'karaoke' });
        if (avg >= 4.5 && vals.length >= 5) notify(c.uid, { type: 'order', text: `🏆 ${avg} puanla ön elemeyi geçtin! Şarkını SwipeUp şarkı yarışmasına yükle.`, url: '/#/sarki/yukle', tag: 'karaoke-final' });
      } else if (reason === 'noshow') notify(c.uid, { type: 'order', text: '🎤 Karaoke sıran geldi ama yayına başlamadın, sıradaki kişiye geçtik.', url: '/#/karaoke', tag: 'karaoke' });
    }
    kNext();
  }
  function kNext() {
    if (K.cur || !K.queue.length) { kPing(); return; }
    const q = K.queue.shift();
    const u = user(q.uid);
    if (!active(u)) return kNext();
    const mins = cfg().karaoke.turnMinutes;
    K.cur = { uid: q.uid, song: q.song, startedAt: now(), endsAt: now() + mins * 60000, scores: {}, seenLive: false };
    notify(q.uid, { type: 'order', text: `🎤 Sıra sende! "${q.song}" için 90 saniye içinde yayına başla.`, url: '/#/karaoke', tag: 'karaoke' });
    emitTo(q.uid, 'karaoke:turn', { song: q.song });
    kPing();
  }
  setInterval(() => {
    if (!K.cur) return;
    const live = !!brief(user(K.cur.uid))?.live;
    if (live) K.cur.seenLive = true;
    if (!K.cur.seenLive && now() - K.cur.startedAt > 90000) return kFinish('noshow');
    if (now() > K.cur.endsAt || (K.cur.seenLive && !live && now() - K.cur.startedAt > 30000)) kFinish('done');
  }, 5000).unref();
  app.get('/api/karaoke', auth, (req, res) => res.json(kOut(req.user.id)));
  app.post('/api/karaoke/queue', auth, (req, res) => {
    if (!cfg().karaoke.enabled) return res.status(503).json({ error: 'Karaoke şu an kapalı.' });
    const song = clip(req.body?.song, 80); if (song.length < 2) return res.status(400).json({ error: 'Hangi şarkıyı söyleyeceğini yaz.' });
    if (K.cur?.uid === req.user.id || K.queue.some((q) => q.uid === req.user.id)) return res.status(409).json({ error: 'Zaten sıradasın.' });
    if (K.queue.length >= 30) return res.status(400).json({ error: 'Sıra dolu, biraz sonra tekrar dene.' });
    K.queue.push({ uid: req.user.id, song: moderation.mask(song), at: now() });
    kNext();
    res.json(kOut(req.user.id));
  });
  app.delete('/api/karaoke/queue', auth, (req, res) => { K.queue = K.queue.filter((q) => q.uid !== req.user.id); kPing(); res.json(kOut(req.user.id)); });
  app.post('/api/karaoke/score', auth, (req, res) => {
    const n = parseInt(req.body?.score, 10);
    if (!K.cur) return res.status(400).json({ error: 'Şu an sahnede kimse yok.' });
    if (K.cur.uid === req.user.id) return res.status(400).json({ error: 'Kendine puan veremezsin 😄' });
    if (!(n >= 1 && n <= 5)) return res.status(400).json({ error: 'Puan 1 ile 5 arasında olmalı.' });
    K.cur.scores[req.user.id] = n;
    kPing();
    res.json(kOut(req.user.id));
  });
  app.post('/api/karaoke/done', auth, (req, res) => {
    if (K.cur?.uid !== req.user.id) return res.status(400).json({ error: 'Sahnede değilsin.' });
    kFinish('done'); res.json(kOut(req.user.id));
  });

  // ---------- Zamanlayıcı ----------
  setInterval(() => {
    try { streakWarnings(); } catch (e) { console.error('[engage] warn', e.message); }
    try { morningPicks(); } catch (e) { console.error('[engage] picks', e.message); }
    try { planReminders(); } catch (e) { console.error('[engage] plan', e.message); }
  }, 5 * 60000).unref();

  // ===================================================================
  // YÖNETİM
  // ===================================================================
  const A = ctx.admin;
  if (!A?.adminAuth) return;
  app.get('/api/admin/engage', A.adminAuth, (req, res) => {
    const d = trDay(); const y = addDays(d, -1);
    const st = store.all('streaks').filter((s) => s.last === d || s.last === y);
    const users = store.filter('users', (u) => regular(u));
    const login = users.map((u) => loginOf(u)).filter((l) => l.alive);
    const c = cfg();
    res.json({
      settings: c,
      ai: { enabled: ai.enabled(), ...ai.stats },
      stats: {
        chatStreaks: st.length, longestChat: Math.max(0, ...st.map((s) => s.count)), chat7: st.filter((s) => s.count >= 7).length,
        loginActive: login.length, login7: login.filter((l) => l.count >= 7).length, longestLogin: Math.max(0, ...login.map((l) => l.count)),
        dqToday: store.filter('dq', (a) => a.day === d).length, dqQuestion: dqOf(d),
        clubs: c.clubs.map((k) => ({ id: k.id, em: k.em, name: k.name, members: memberCount(k.id), posts: store.filter('club_posts', (p) => p.clubId === k.id).length })),
        picksToday: store.filter('picks', (p) => p.day === d).length,
        karaokeWeek: store.filter('karaoke_turns', (t) => t.at >= weekStart()).length, karaokeQueue: K.queue.length, karaokeLive: K.cur ? brief(user(K.cur.uid))?.username : null,
        nowPlaying: users.filter((u) => npLive(u)).length,
        packsSold30: store.filter('coin_tx', (x) => x.reason === 'fal_pack' && x.at > now() - 30 * DAY).length,
        gifts30: store.filter('coin_tx', (x) => x.reason === 'gift' && x.chat && x.at > now() - 30 * DAY).length,
        aiWarnFlags: store.filter('flags', (f) => /Yapay zeka/.test(f.reason || '') && f.at > now() - 7 * DAY).length,
      },
    });
  });
  const num = (v, min, max, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : d; };
  const parseMs = (v, d) => {
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [num(k, 1, 3650, 0), num(x, 0, 10000, 0)]).filter(([k, x]) => k && x));
    if (typeof v === 'string') return Object.fromEntries(v.split(/[,\n]/).map((p) => p.split(':').map((x) => x.trim())).map(([k, x]) => [num(k, 1, 3650, 0), num(x, 0, 10000, 0)]).filter(([k, x]) => k && x));
    return d;
  };
  app.put('/api/admin/engage', A.adminAuth, A.owner, (req, res) => {
    const b = req.body || {}; const c = cfg();
    const s = {
      ...(store.get('settings', 'engage') || {}), id: 'engage',
      streak: { enabled: b.streak?.enabled ?? c.streak.enabled, milestones: parseMs(b.streak?.milestones, c.streak.milestones), warnHour: num(b.streak?.warnHour, 0, 23, c.streak.warnHour) },
      login: { enabled: b.login?.enabled ?? c.login.enabled, milestones: parseMs(b.login?.milestones, c.login.milestones), freezeCoins: num(b.login?.freezeCoins, 0, 10000, c.login.freezeCoins), maxFreezes: num(b.login?.maxFreezes, 0, 10, c.login.maxFreezes), warnHour: num(b.login?.warnHour, 0, 23, c.login.warnHour) },
      picks: { enabled: b.picks?.enabled ?? c.picks.enabled, count: num(b.picks?.count, 1, 20, c.picks.count), notifyHour: num(b.picks?.notifyHour, 5, 12, c.picks.notifyHour) },
      ai: { textCheck: b.ai?.textCheck ?? c.ai.textCheck, imageCheck: b.ai?.imageCheck ?? c.ai.imageCheck, verifyCheck: b.ai?.verifyCheck ?? c.ai.verifyCheck, verifyAuto: b.ai?.verifyAuto ?? c.ai.verifyAuto },
      karaoke: { enabled: b.karaoke?.enabled ?? c.karaoke.enabled, turnMinutes: num(b.karaoke?.turnMinutes, 2, 15, c.karaoke.turnMinutes) },
      packs: Array.isArray(b.packs) ? c.packs.map((p) => { const n = b.packs.find((x) => x.id === p.id); return n ? { ...p, coins: num(n.coins, 0, 100000, p.coins), enabled: n.enabled !== false } : p; }) : c.packs,
      dq: c.dq,
      clubs: Array.isArray(b.clubs) ? b.clubs.slice(0, 40).map((k) => ({ id: String(k.id || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20), em: clip(k.em, 4) || '⭐', name: clip(k.name, 30), desc: clip(k.desc, 80) })).filter((k) => k.id && k.name) : c.clubs,
    };
    store.put('settings', s);
    A.audit(req.admin, 'etkileşim ayarlarını güncelledi');
    res.json(cfg());
  });
  app.put('/api/admin/engage/dq', A.adminAuth, A.owner, (req, res) => {
    const day = String(req.body?.day || ''); const q = clip(req.body?.q, 160);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return res.status(400).json({ error: 'Tarih seç.' });
    const s = { ...(store.get('settings', 'engage') || {}), id: 'engage' };
    const dq = { ...(s.dq || {}) };
    if (q) dq[day] = q; else delete dq[day];
    Object.keys(dq).filter((k) => k < addDays(trDay(), -30)).forEach((k) => delete dq[k]);
    s.dq = dq; store.put('settings', s);
    A.audit(req.admin, q ? 'günün sorusunu belirledi' : 'günün sorusunu sildi', null, `${day}: ${q}`);
    res.json({ dq, today: dqOf() });
  });
};
module.exports.ZODIAC = ZODIAC;
module.exports.zodiacFromDate = zodiacFromDate;

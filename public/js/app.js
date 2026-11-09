import { icon } from './icons.js';
import {
  state, api, on, emit, connectSocket, refreshBadges, toast, esc, el, applySkin, currentSkin, notifHref, applyLogo, refreshStoryMap,
} from './core.js';
import { initCalls } from './calls.js';
import { checkVersion, recover, afterBoot } from './update.js';
import { maybeShowInstall } from './install.js';
import { initEvent } from './event.js';
import { checkSafety } from './extras.js';
import { initI18n } from './i18n.js';

const routes = [
  [/^\/?$/, 'feed', { tab: 'home' }],
  [/^\/search$/, 'search', { tab: 'home' }],
  [/^\/(?:vitrin|dalga|reels)(?:\/([\w-]+))?$/, 'reels', { tab: 'reels', dark: true }],
  [/^\/swipe$/, 'swipe', { tab: 'swipe' }],
  [/^\/likes$/, 'likes', { tab: 'swipe' }],
  [/^\/chats$/, 'chats', { tab: 'chats' }],
  [/^\/genel(?:\/(\w+))?$/, 'genel', { tabs: false }],
  [/^\/odalar$/, 'rooms', { tab: 'home' }],
  [/^\/hizli$/, 'speed', { tabs: false, dark: true }],
  [/^\/gorunum$/, 'look', { tabs: false }],
  [/^\/ziyaretciler$/, 'viewers', { tabs: false }],
  [/^\/davet$/, 'invite', { tabs: false }],
  [/^\/reklam(?:\/([\w-]+))?$/, 'promote', { tabs: false }],
  [/^\/gorevler$/, 'quests', { tabs: false }],
  [/^\/cark$/, 'wheel', { tabs: false }],
  [/^\/mekan$/, 'venue', { tabs: false }],
  [/^\/yarismalar(?:\/([\w-]+))?$/, 'contests', { tabs: false }],
  [/^\/sarki(?:\/(yukle))?$/, 'songs', { tabs: false }],
  [/^\/destek(?:\/([\w-]+))?$/, 'support', { tabs: false }],
  [/^\/chat\/([\w-]+)$/, 'chat', { tabs: false }],
  [/^\/chat\/([\w-]+)\/info$/, 'chatinfo', { tabs: false }],
  [/^\/group\/new$/, 'groupnew', { tabs: false }],
  [/^\/live$/, 'live', { tabs: false }],
  [/^\/live\/([\w-]+)$/, 'live', { tabs: false }],
  [/^\/stories\/([\w-]+)$/, 'stories', { tabs: false }],
  [/^\/notifications$/, 'notifications', { tab: 'home' }],
  [/^\/me$/, 'profile', { tab: 'me' }],
  [/^\/u\/([\w.]+)$/, 'profile', { tab: 'me' }],
  [/^\/edit$/, 'edit', { tabs: false }],
  [/^\/settings$/, 'settings', { tabs: false }],
  [/^\/fal(?:\/(\w+))?$/, 'fal', { tab: 'home' }],
  [/^\/create(?:\/(\w+))?$/, 'create', { tabs: false }],
  [/^\/p\/([\w-]+)$/, 'post', { tab: 'home' }],
  [/^\/(login|register|forgot)$/, 'auth', { tabs: false, public: true }],
  [/^\/legal\/(\w+)$/, 'legal', { tabs: false, any: true }],
  [/^\/install$/, 'install', { tabs: false, any: true }],
  [/^\/store$/, 'store', { tabs: false }],
  [/^\/wallet$/, 'wallet', { tabs: false }],
  [/^\/verify$/, 'verify', { tabs: false }],
  [/^\/requests$/, 'requests', { tabs: false }],
  [/^\/tag\/([^/]+)$/, 'tag', { tab: 'home' }],
  // Etkileşim: seriler, günün sorusu, kulüpler, günlük seçki, karaoke, burç kartı
  [/^\/seriler$/, 'streaks', { tabs: false }],
  [/^\/soru$/, 'dq', { tab: 'home' }],
  [/^\/kulupler$/, 'clubs', { tab: 'home' }],
  [/^\/kulup\/([a-z0-9]+)$/, 'clubs', { tab: 'home' }],
  [/^\/secki$/, 'picks', { tab: 'swipe' }],
  [/^\/karaoke$/, 'karaoke', { tabs: false }],
  [/^\/burc$/, 'burc', { tab: 'home' }],
  [/^\/market\/(i|o|new|edit)(?:\/([\w-]+))?$/, 'market', { tabs: false }],
  [/^\/market(?:\/(\w+))?(?:\/([\w-]+))?$/, 'market', { tab: 'home' }],
];

const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
let cleanup = null;
let navToken = 0;

function renderTabbar(active) {
  const b = state.badges;
  const tabs = [
    ['home', '#/', icon(active === 'home' ? 'homeFill' : 'home'), 'Ana sayfa', ''],
    ['reels', '#/vitrin', icon('reels'), 'Vitrin', ''],
    ['swipe', '#/swipe', `<span class="center">${icon('flame')}${b.likes ? `<span class="num-badge">${b.likes > 99 ? '99+' : b.likes}</span>` : ''}</span>`, 'Kaydır ve eşleş', 'mid'],
    ['chats', '#/chats', `<span style="position:relative;display:grid">${icon('send')}${b.messages ? `<span class="num-badge">${b.messages}</span>` : ''}</span>`, 'Mesajlar', ''],
    ['me', '#/me', `<img class="me-av" src="${esc(state.me?.avatar)}" alt="">${b.notifications ? '<i class="dot-badge"></i>' : ''}`, 'Profil', ''],
  ];
  tabbar.innerHTML = tabs.map(([k, href, ic, label, cls]) => `<a href="${href}" class="${k === active ? 'on' : ''} ${cls}" aria-label="${label}">${ic}</a>`).join('');
}
on('badges', () => renderTabbar(tabbar.dataset.active));

function showBan(ban) {
  state.ban = ban;
  document.body.classList.add('no-tabs');
  document.body.classList.remove('dark-ui');
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  const until = ban.until ? new Date(ban.until).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : null;
  view.innerHTML = `<section class="auth ban">
    <div class="empty" style="padding:0"><div class="big">${icon('block')}</div></div>
    <h2 style="text-align:center;margin:16px 0 6px;font-size:24px">${ban.kind === 'banned' ? 'Hesabın kapatıldı' : 'Hesabın askıya alındı'}</h2>
    <p class="tagline" style="margin-bottom:12px">${until ? `${esc(until)} tarihine kadar uygulamayı kullanamazsın.` : 'Topluluk kurallarını ihlal ettiği için bu hesap kapatıldı.'}</p>
    ${ban.reason ? `<div class="fal-card" style="margin-bottom:14px"><h3>Gerekçe</h3><p>${esc(ban.reason)}</p></div>` : ''}
    <form class="ap" style="display:grid;gap:10px"><b>Bir hata olduğunu düşünüyorsan itiraz et</b>
      <textarea class="field" name="t" rows="4" maxlength="1500" placeholder="Ne olduğunu ve neden tekrar açılması gerektiğini anlat"></textarea>
      <button class="btn primary block">İtirazı gönder</button></form>
    <div class="apl" style="margin-top:14px"></div>
    <button class="btn outline block lo" style="margin-top:10px">Çıkış yap</button></section>`;
  const paintAppeals = async () => {
    const list = await api('/appeals/mine').catch(() => []);
    const lbl = { open: 'İnceleniyor', accepted: 'Kabul edildi', rejected: 'Reddedildi' };
    view.querySelector('.apl').innerHTML = list.map((a) => `<div class="fal-card" style="margin-bottom:8px"><h3>İtirazın <span class="chip ${a.status === 'accepted' ? 'fal-ok' : 'fal-wait-chip'}">${lbl[a.status]}</span></h3><p>${esc(a.text)}</p>${a.note ? `<p class="muted" style="margin-top:6px">Yanıt: ${esc(a.note)}</p>` : ''}</div>`).join('');
    if (list.some((a) => a.status === 'open')) view.querySelector('.ap').hidden = true;
    if (list.some((a) => a.status === 'accepted')) { const m = await api('/me').catch(() => null); if (m && !m.ban) location.reload(); }
  };
  paintAppeals();
  view.querySelector('.ap').onsubmit = async (e) => {
    e.preventDefault();
    try { await api('/appeals', { body: { text: e.target.t.value } }); toast('İtirazın alındı. İncelenince burada göreceksin.'); paintAppeals(); } catch (er) { toast(er.message); }
  };
  view.querySelector('.lo').onclick = () => import('./core.js').then((c) => c.logout());
}
on('banned', (b) => { if (!state.ban) showBan(b); });

// Doğum tarihi olmayan eski hesaplar: 18 yaş onayı
function showBirthGate() {
  document.body.classList.add('no-tabs');
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  const max = new Date(); max.setFullYear(max.getFullYear() - 18);
  view.innerHTML = `<section class="auth">
    <div class="empty" style="padding:0"><div class="big">${icon('shield')}</div></div>
    <h2 style="text-align:center;margin:16px 0 6px;font-size:24px">Doğum tarihin</h2>
    <p class="tagline" style="margin-bottom:16px">SwipeUp 18 yaş ve üzeri içindir. Devam etmek için doğum tarihini gir. Profilinde sadece yaşın görünür.</p>
    <form style="display:grid;gap:12px"><input class="field" type="date" name="d" required min="1920-01-01" max="${max.toISOString().slice(0, 10)}">
      <label class="consent"><input type="checkbox" name="a"><span><a class="link" href="#/legal/kosullar">Kullanım Koşulları</a>’nı ve <a class="link" href="#/legal/gizlilik">Gizlilik Politikası</a>’nı kabul ediyorum.</span></label>
      <button class="btn primary block">Devam et</button><div class="err" role="alert"></div></form></section>`;
  const f = view.querySelector('form');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const err = f.querySelector('.err'); err.textContent = '';
    if (!f.d.value) { err.textContent = 'Doğum tarihini gir.'; return; }
    if (!f.a.checked) { err.textContent = 'Devam etmek için koşulları kabul etmelisin.'; return; }
    try {
      Object.assign(state.me, await api('/me', { method: 'PATCH', body: { birthdate: f.d.value } }));
      router();
    } catch (er) {
      const m = await api('/me').catch(() => null);
      if (m?.ban) { state.ban = m.ban; return showBan(m.ban); }
      err.textContent = er.message;
    }
  };
}

async function router() {
  if (state.me) refreshStoryMap();
  if (state.ban) return showBan(state.ban);
  const path = location.hash.replace(/^#/, '') || '/';
  let match = null;
  for (const [re, name, opts] of routes) {
    const m = path.match(re);
    if (m) { match = { name, opts, params: m.slice(1) }; break; }
  }
  if (!match) { location.hash = '#/'; return; }
  if (!state.token && !match.opts.public && !match.opts.any) { location.hash = '#/login'; return; }
  if (state.me?.needsBirthdate && state.me.role !== 'falci' && !match.opts.any) return showBirthGate();
  if (match.name === 'market' && !state.config?.features?.market) { location.hash = '#/'; return; }
  if (state.token && match.opts.public) { location.hash = '#/'; return; }

  const my = ++navToken;
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  document.body.classList.toggle('no-tabs', match.opts.tabs === false);
  document.body.classList.toggle('dark-ui', !!match.opts.dark);
  tabbar.dataset.active = match.opts.tab || '';
  if (state.me) renderTabbar(match.opts.tab);
  view.innerHTML = '';
  window.scrollTo(0, 0);
  try {
    const mod = await import(`./views/${match.name}.js`);
    if (my !== navToken) return;
    const c = await mod.default(view, ...match.params);
    if (my !== navToken) { c?.(); return; }
    cleanup = c || null;
  } catch (e) {
    console.error(e);
    if (recover(e)) return;
    view.innerHTML = `<div class="empty"><div class="big">${icon('close')}</div><h2>Bu sayfa açılamadı</h2>${esc(e.message)}<p style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn primary rl">Yenile</button><a class="btn" href="#/">Ana sayfaya dön</a></p></div>`;
    view.querySelector('.rl').onclick = () => import('./update.js').then((u) => u.applyUpdate()).catch(() => location.reload());
  }
}

// ---- Global gerçek zamanlı olaylar ----
function wireRealtime() {
  connectSocket();
  initCalls();
  setTimeout(checkSafety, 2500);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkSafety(); });
  on('notification', (n) => {
    state.badges.notifications++; emit('badges', state.badges);
    if (location.hash === '#/notifications') return;
    const href = notifHref(n);
    if (n.type === 'order' || n.type === 'verify') api('/me').then((m) => Object.assign(state.me, m)).catch(() => {});
    toast(n.text, { ms: ['announce', 'warning', 'order', 'verify'].includes(n.type) ? 8000 : 3500, title: n.type === 'liked' ? 'Yeni beğeni' : n.from?.name || 'SwipeUp', img: n.type === 'liked' ? null : n.from?.avatar, href });
  });
  on('likes:new', () => refreshBadges());
  // Günlük giriş serisi: günün ilk girişinde küçük bir kutlama
  on('streak:login', (d) => {
    if (!d?.count) return;
    if (state.me) state.me.loginStreak = { ...(state.me.loginStreak || {}), count: d.count };
    if (d.count < 2 && !d.coins) return;
    toast(d.coins ? `${d.count} günlük giriş serisi! +${d.coins} jeton` : `${d.count}. gün! Serin devam ediyor${d.freezeUsed ? ' (seri koruyucu kullanıldı)' : ''}`, { title: 'Seri', img: '/img/eg/seri.svg', href: '#/seriler', ms: 4200 });
  });
  on('karaoke:turn', (d) => { if (location.hash !== '#/karaoke') toast(`Karaoke sırası sende! "${d?.song || ''}"`, { title: 'Karaoke', img: '/img/eg/karaoke.svg', href: '#/karaoke', ms: 9000 }); });
  on('quests', (d) => { if (d?.done && location.hash !== '#/gorevler') toast(`✅ Görev tamamlandı: ${d.title}. Ödülünü al!`, { href: '#/gorevler', ms: 4500 }); });
  on('message', (m) => {
    if (m.from === state.me.id || m.system) return;
    const inChat = location.hash === `#/chat/${m.chatId}` && document.visibilityState === 'visible';
    if (!inChat) {
      refreshBadges();
      if (location.hash === '#/chats') return;
      api(`/users/${m.from}`).then((u) => toast(m.fal ? '🔮 Yeni fal isteği' : m.location ? '📍 Konum' : m.text || ({ audio: '🎤 Sesli mesaj', video: '🎥 Video' }[m.mediaType] || '📷 Fotoğraf'), { title: u.name, img: u.avatar, href: `#/chat/${m.chatId}` })).catch(() => {});
    }
  });
  on('match', ({ user, chatId }) => showMatch(user, chatId));
  on('blocked', () => { refreshBadges(); });
  on('reconnected', refreshBadges);
  on('app:version', ({ version }) => checkVersion(version));
  on('announce:popup', showAnnouncement);
  setTimeout(() => api('/announcement').then((a) => a && showAnnouncement(a)).catch(() => {}), 1200);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshBadges(); });
}

// ---- Bakım modu ----
let maintTimer = null;
function showMaintenance(m) {
  if (!m) return;
  let ov = document.querySelector('.maint');
  const until = m.until ? new Date(m.until).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : null;
  const html = `<div class="in"><div class="gear">${icon('settings')}</div><img class="lg" src="/icons/mark.png" alt="">
    <h1>Bakımdayız</h1><p>${esc(m.message || 'SwipeUp’ı daha iyi hâle getirmek için kısa bir bakım yapıyoruz. Birazdan geri döneceğiz.')}</p>
    ${until ? `<div class="eta">Tahmini dönüş: <b>${esc(until)}</b></div>` : ''}
    <small>Bu sayfayı kapatmana gerek yok; bakım bitince uygulama kendiliğinden açılır.</small></div>`;
  if (!ov) { ov = el(`<div class="maint" role="alert">${html}</div>`); document.body.append(ov); } else ov.innerHTML = html;
  document.body.classList.add('in-maint');
  state.socket?.disconnect();
  clearInterval(maintTimer);
  maintTimer = setInterval(async () => {
    try { const r = await fetch('/api/maintenance', { cache: 'no-store' }).then((x) => x.json()); if (!r.maintenance) { clearInterval(maintTimer); location.reload(); } else showMaintenance(r.maintenance); } catch {}
  }, 20000);
}
on('maintenance', showMaintenance);
// Özellik aç/kapat (ör. Store) yönetimden anında uygulanır
on('features', (f) => {
  if (!state.config) return;
  state.config.features = { ...(state.config.features || {}), ...f };
  if (/^#\/(market|$)|^#?$/.test(location.hash) || location.hash === '#/settings') router();
});

// Yönetimden gelen açılış duyurusu (her duyuru bir kez gösterilir)
function showAnnouncement(a) {
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem('su_ann_seen') || '[]'); } catch {}
  if (!a?.id || seen.includes(a.id) || document.querySelector('.ann-modal')) return;
  const m = el(`<div class="ann-modal" role="dialog" aria-label="Duyuru"><div class="inner">
      <img src="/icons/mark.png" alt=""><h2>${esc(a.title || 'SwipeUp')}</h2><p>${esc(a.text)}</p>
      <div class="acts">${a.url && a.url !== '/#/notifications' ? '<button class="btn primary go">Göz at</button><button class="btn ok-b">Kapat</button>' : '<button class="btn primary ok-b">Tamam</button>'}</div></div></div>`);
  const close = () => { m.remove(); try { localStorage.setItem('su_ann_seen', JSON.stringify([...seen, a.id].slice(-30))); } catch {} };
  m.querySelector('.ok-b').onclick = close;
  m.querySelector('.go')?.addEventListener('click', () => { close(); location.hash = a.url.replace(/^\//, ''); });
  m.onclick = (e) => { if (e.target === m) close(); };
  document.body.append(m);
}

export function showMatch(user, chatId) {
  const m = el(`<div class="match-modal" role="dialog" aria-label="Eşleşme">
    <div class="inner">
      <div class="title">Eşleştiniz!</div>
      <p>Sen ve ${esc(user.name)} birbirinizi beğendiniz.</p>
      <div class="pair"><img src="${esc(state.me.avatar)}" alt=""><img src="${esc(user.avatar)}" alt=""></div>
      <a class="btn primary block" href="#/chat/${esc(chatId)}" style="background:#fff;color:#f2435a">Mesaj gönder</a>
      <button class="btn block" style="background:transparent;color:#fff">Kaydırmaya devam et</button>
    </div></div>`);
  m.querySelector('button').onclick = () => m.remove();
  m.querySelector('a').onclick = () => m.remove();
  document.body.append(m);
  if (navigator.vibrate) navigator.vibrate([30, 60, 30]);
}

// ---- Başlangıç ----
// Silinmiş medya: kırık görsel yerine yumuşak bir boşluk göster
document.addEventListener('error', (e) => {
  const t = e.target;
  if (t.tagName === 'IMG' && !t.dataset.fallback) {
    t.dataset.fallback = '1';
    t.src = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#e6e6ea"/></svg>');
  }
}, true);

async function boot() {
  await initI18n().catch(() => {});
  try { const t = localStorage.getItem('su_theme'); if (t && t !== 'system') document.documentElement.dataset.theme = t; } catch {}
  try { applySkin(localStorage.getItem('su_skin') || 'gunbatimi', { save: false }); } catch {}
  try { const lg = localStorage.getItem('su_logo'); if (lg) document.documentElement.dataset.logo = lg; } catch {}
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  navigator.serviceWorker?.addEventListener('message', (e) => {
    if (e.data?.type === 'navigate' && e.data.url) location.href = e.data.url;
  });
  if (state.token) {
    try {
      const [cfg, me] = await Promise.all([api('/config'), api('/me')]);
      state.config = cfg; state.me = me;
      if (me.ban) state.ban = me.ban;
      if (me.skin && me.skin !== currentSkin()) applySkin(me.skin);
      applyLogo(me.plus ? me.logo : 'klasik');
      if (!state.ban) { wireRealtime(); refreshBadges(); }
    } catch { state.token = null; }
  }
  if (!state.config) state.config = await fetch('/api/config').then((r) => r.json()).catch(() => ({}));
  if (state.config?.maintenance) { showMaintenance(state.config.maintenance); return; }
  afterBoot(state.config?.version);
  initEvent(state.config);
  // İlk ziyarette telefona yükleme kılavuzu (iPhone: Safari → Ana Ekrana Ekle)
  setTimeout(maybeShowInstall, state.token ? 4000 : 1500);
  // Beklenmeyen modül hataları (eski sürüm kalıntısı) → güncelleme ekranı
  window.addEventListener('unhandledrejection', (e) => { recover(e.reason); });
  window.addEventListener('hashchange', router);
  router();
}
boot();

export { router };

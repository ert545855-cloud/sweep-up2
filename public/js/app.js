import './errlog.js'; // en önce: açılışta oluşan hatalar da yakalansın
import { remember, accountSheet, switchFromUrl } from './accounts.js';
import { icon } from './icons.js';
import { initNav } from './nav.js';
import {
  state, api, on, emit, connectSocket, refreshBadges, toast, esc, el, logo, applySkin, currentSkin, setGameLook, notifHref, applyLogo, refreshStoryMap, syncPush, sheet, enablePush, pushSupported, pushEnabled, pushPermission, nativePush,
} from './core.js';
import { initCalls } from './calls.js';
import { checkVersion, recover, afterBoot } from './update.js';
import { maybeShowInstall } from './install.js';
import { initEvent } from './event.js';
import { checkSafety } from './extras.js';
import { initI18n } from './i18n.js';
import { takeGoogleReturn } from './oauth.js';

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
  [/^\/cifte$/, 'cifte', { tabs: false }],
  [/^\/settings$/, 'settings', { tabs: false }],
  [/^\/veri-taleplerim$/, 'veri', { tabs: false }],
  [/^\/guvenlik(?:\/(giris|paylas)\/([\w-]+))?$/, 'guvenlik', { tabs: false }],
  [/^\/fal(?:\/(\w+))?$/, 'fal', { tab: 'home' }],
  [/^\/create(?:\/(\w+))?$/, 'create', { tabs: false }],
  [/^\/p\/([\w-]+)$/, 'post', { tab: 'home' }],
  [/^\/(login|register|forgot)$/, 'auth', { tabs: false, public: true }],
  [/^\/legal\/(\w+)$/, 'legal', { tabs: false, any: true }],
  [/^\/install$/, 'install', { tabs: false, any: true }],
  [/^\/store$/, 'store', { tabs: false }],
  [/^\/cart$/, 'cart', { tabs: false }],
  [/^\/wallet$/, 'wallet', { tabs: false }],
  [/^\/verify$/, 'verify', { tabs: false }],
  [/^\/requests$/, 'requests', { tabs: false }],
  [/^\/tag\/([^/]+)$/, 'tag', { tab: 'home' }],
  // Etkileşim: seriler, günün sorusu, kulüpler, günlük seçki, karaoke, burç kartı
  [/^\/seriler$/, 'streaks', { tabs: false }],
  [/^\/(yakin|planli|arsiv)$/, 'insta', { tabs: false }],
  [/^\/ikinci-sans$/, 'sans', { tab: 'swipe' }],
  [/^\/etkinlikler$/, 'events', { tab: 'home' }],
  [/^\/etkinlik\/([\w-]+)(?:\/(duzenle))?$/, 'events', { tabs: false }],
  [/^\/seviye$/, 'level', { tabs: false }],
  [/^\/haftanin-enleri$/, 'best', { tab: 'home' }],
  [/^\/oyunlar$/, 'games', { tab: 'home' }],
  [/^\/city$/, 'city', { tabs: false, game: true }],
  [/^\/farm(?:\/([\w.-]+))?$/, 'farm', { tabs: false, game: true }],
  [/^\/oyun\/okey\/([\w-]+)$/, 'okey', { tabs: false, dark: true, game: true }],
  [/^\/oyun\/cizbil\/([\w-]+)$/, 'cizbil', { tabs: false, game: true }],
  [/^\/oyun\/kupa\/([\w-]+)$/, 'kupa', { tabs: false, dark: true, game: true }],
  [/^\/oyun\/([a-z0-9]+)\/([\w-]+)$/, 'play', { tabs: false, game: true }],
  [/^\/soru$/, 'dq', { tab: 'home' }],
  [/^\/kulupler$/, 'clubs', { tab: 'home' }],
  [/^\/kulup\/([a-z0-9]+)$/, 'clubs', { tab: 'home' }],
  [/^\/secki$/, 'picks', { tab: 'swipe' }],
  [/^\/karaoke$/, 'karaoke', { tabs: false }],
  [/^\/karaoke\/sahne$/, 'sahne', { tabs: false }],
  [/^\/burc(?:\?.*)?$/, 'burc', { tab: 'home' }],
  [/^\/market\/(i|o|new|edit)(?:\/([\w-]+))?$/, 'market', { tabs: false }],
  [/^\/market(?:\/(\w+))?(?:\/([\w-]+))?$/, 'market', { tab: 'home' }],
];

let view = document.getElementById('view');
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
  // Bilgisayarda (geniş ekran) bu menü soldaki kenar çubuğuna dönüşür: logo, yazılı sekmeler, bildirim ve ayarlar da görünür.
  // Telefonda .dx öğeleri ve yazılar gizli kalır; alttaki 5'li menü aynen durur.
  const dx = [
    ['notif', '#/notifications', `<span style="position:relative;display:grid">${icon('bell')}${b.notifications ? '<i class="dot-badge"></i>' : ''}</span>`, 'Bildirimler'],
    ['store', '#/store', `<span style="position:relative;display:grid">${icon('cart')}${b.cart ? `<span class="num-badge">${b.cart}</span>` : ''}</span>`, 'Mağaza'],
    ['settings', '#/settings', icon('settings'), 'Ayarlar'],
  ];
  const path = location.hash.replace(/^#/, '') || '/';
  tabbar.innerHTML = `<a href="#/" class="tb-brand dx wordmark" aria-label="SwipeUp ana sayfa">${logo()}</a>`
    + tabs.map(([k, href, ic, label, cls]) => `<a href="${href}" class="${k === active ? 'on' : ''} ${cls}" aria-label="${label}">${ic}<span class="tl">${label}</span></a>`).join('')
    + dx.map(([, href, ic, label]) => `<a href="${href}" class="dx${path === href.slice(1) ? ' on-dx' : ''}" aria-label="${label}">${ic}<span class="tl">${label}</span></a>`).join('');
}
// Profil sekmesine uzun basınca hesap seçici açılır
{
  let lp = null; let fired = false;
  const isMe = (e) => e.target.closest?.('a[href="#/me"]');
  tabbar.addEventListener('pointerdown', (e) => { if (!isMe(e) || !state.me) return; fired = false; clearTimeout(lp); lp = setTimeout(() => { fired = true; navigator.vibrate?.(12); accountSheet(); }, 480); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => tabbar.addEventListener(ev, () => clearTimeout(lp)));
  tabbar.addEventListener('click', (e) => { if (fired && isMe(e)) { e.preventDefault(); fired = false; } }, true);
  tabbar.addEventListener('contextmenu', (e) => { if (isMe(e)) e.preventDefault(); });
}
// Aşağı çekip yenileme: listelerin olduğu sayfalarda, sayfa en baştayken aşağı çekilince sayfa yeniden yüklenir
let curRoute = null;
const PTR_PAGES = new Set(['feed', 'chats', 'notifications', 'profile', 'likes', 'post', 'tag', 'events', 'best', 'rooms', 'store', 'wallet', 'requests', 'quests', 'viewers', 'contests', 'streaks', 'insta', 'sans', 'level', 'fal']);
import('./ptr.js').then((m) => m.initPtr({ enabled: () => !!state.me && PTR_PAGES.has(curRoute), refresh: () => router() })).catch(() => {});
// Açık olan sekmeye tekrar dokununca: sayfa aşağıdaysa en başa kayar, zaten en baştaysa sayfa yenilenir (akış tazelenir)
tabbar.addEventListener('click', (e) => {
  const a = e.target.closest?.('a[href^="#/"]');
  if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
  const cur = location.hash.replace(/^#/, '') || '/'; const to = a.getAttribute('href').slice(1);
  if (to !== cur) return;
  e.preventDefault();
  // Sayfanın kendi kaydırma kutuları (ör. Vitrin, mesaj listesi) da en başa alınır
  const boxes = [...view.querySelectorAll('*')].filter((el) => el.scrollTop > 0 && /(auto|scroll)/.test(getComputedStyle(el).overflowY));
  const down = window.scrollY > 40 || boxes.some((el) => el.scrollTop > 40);
  if (down) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    boxes.forEach((el) => el.scrollTo({ top: 0, behavior: 'smooth' }));
  } else {
    navigator.vibrate?.(8);
    router();
  }
});
on('badges', () => renderTabbar(tabbar.dataset.active));
// Uygulama simgesindeki kırmızı sayı: okununca azalsın (iPhone uygulamasında NativePush, ana ekran uygulamasında setAppBadge)
on('badges', (b) => {
  const n = Math.min(999, (b?.notifications || 0) + (b?.messages || 0));
  try { const np = window.Capacitor?.Plugins?.NativePush; if (np?.setBadge) { np.setBadge({ count: n }).catch(() => {}); return; } } catch { /* eski uygulama sürümü */ }
  try { if (navigator.setAppBadge) (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {}); } catch { /* desteklenmiyor */ }
});

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
      <label class="consent"><input type="checkbox" name="a"><span><a class="link" href="#/legal/kosullar">Kullanım Koşulları</a>’nı okudum ve kabul ediyorum.</span></label>
      <p class="muted consent-info">Kişisel verilerinin nasıl işlendiğini <a class="link" href="#/legal/kvkk">KVKK Aydınlatma Metni</a>’nde ve <a class="link" href="#/legal/gizlilik">Gizlilik Politikası</a>’nda bulabilirsin.</p>
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
  // Hesap ekleme: giriş yapmışken giriş/kayıt ekranı açılabilir; başka sayfaya dönülünce işaret kalkar
  let adding = false; try { adding = !!sessionStorage.getItem('su_add'); if (adding && match.name !== 'auth') { sessionStorage.removeItem('su_add'); adding = false; } } catch { /* yok */ }
  if (state.token && match.opts.public && !(adding && match.name === 'auth')) { location.hash = '#/'; return; }

  const my = ++navToken;
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  document.body.classList.toggle('no-tabs', match.opts.tabs === false);
  document.body.classList.toggle('dark-ui', !!match.opts.dark);
  setGameLook(!!match.opts.game); // oyunlarda uygulama teması kapalı
  tabbar.dataset.active = match.opts.tab || '';
  curRoute = match.name;
  if (state.me) renderTabbar(match.opts.tab);
  // Her sayfada temiz bir kap: önceki sayfanın view üzerine eklediği dinleyiciler taşınmasın
  { const fresh = view.cloneNode(false); view.replaceWith(fresh); view = fresh; }
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
    toast(n.text, { ms: ['announce', 'warning', 'order', 'verify', 'game'].includes(n.type) ? 8000 : 3500, title: n.type === 'liked' ? 'Yeni beğeni' : n.from?.name || 'SwipeUp', img: n.type === 'liked' ? null : n.from?.avatar, href });
  });
  on('likes:new', () => refreshBadges());
  // Panelden yapılan değişiklikler: ayarlar ve hesap sayfa yenilemeden tazelenir
  const LIVE_VIEWS = /^#\/(store|plus|fal|gorevler|cark|settings|wallet|market|seviye|odalar|rooms|etkinlik|jeton)/;
  const rerender = () => { if (LIVE_VIEWS.test(location.hash) && !document.querySelector('.sheet, dialog[open]') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) router(); };
  let cfgT = null;
  on('config:changed', () => {
    clearTimeout(cfgT);
    cfgT = setTimeout(async () => {
      const cfg = await api('/config').catch(() => null); if (!cfg) return;
      const prevEvent = JSON.stringify(state.config?.event || null);
      state.config = Object.assign(state.config || {}, cfg);
      if (JSON.stringify(cfg.event || null) !== prevEvent) emit('event', { event: cfg.event, now: cfg.now });
      emit('config', cfg); rerender();
    }, 300 + Math.random() * 2500); // herkes aynı anda istemesin
  });
  on('me:changed', async () => {
    const m = await api('/me').catch(() => null); if (!m || !state.me) return;
    if (m.ban) { location.reload(); return; }
    Object.assign(state.me, m); emit('me', m); emit('wallet', {}); refreshBadges(); rerender();
  });

  // Günlük giriş serisi: günün ilk girişinde küçük bir kutlama
  on('streak:login', (d) => {
    if (!d?.count) return;
    if (state.me) state.me.loginStreak = { ...(state.me.loginStreak || {}), count: d.count };
    if (d.count < 2 && !d.coins) return;
    toast(d.coins ? `${d.count} günlük giriş serisi! +${d.coins} jeton` : `${d.count}. gün! Serin devam ediyor${d.freezeUsed ? ' (seri koruyucu kullanıldı)' : ''}`, { title: 'Seri', img: '/img/eg/seri.svg', href: '#/seriler', ms: 4200 });
  });
  on('karaoke:turn', (d) => { if (!location.hash.startsWith('#/karaoke')) toast(`Karaoke sırası sende! "${d?.song || ''}"`, { title: 'Karaoke', img: '/img/eg/karaoke.svg', href: '#/karaoke/sahne', ms: 9000 }); });
  on('level', (d) => { if (d?.level) toast(`${d.em} Seviye atladın! Artık ${d.level}. seviyedesin · ${d.title} · +${d.coins} jeton`, { href: '#/seviye', ms: 5000 }); });
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
  const m = el(`<div class="ann-modal" role="dialog" aria-label="Duyuru"><div class="inner"><button type="button" class="sh-x" aria-label="Kapat">${icon('close')}</button>
      <img src="/icons/mark.png" alt=""><h2>${esc(a.title || 'SwipeUp')}</h2><p>${esc(a.text)}</p>
      <div class="acts">${a.url && a.url !== '/#/notifications' ? '<button class="btn primary go">Göz at</button><button class="btn ok-b">Kapat</button>' : '<button class="btn primary ok-b">Tamam</button>'}</div></div></div>`);
  const close = () => { m.remove(); try { localStorage.setItem('su_ann_seen', JSON.stringify([...seen, a.id].slice(-30))); } catch {} };
  m.querySelector('.ok-b').onclick = close; m.querySelector('.sh-x').onclick = close;
  m.querySelector('.go')?.addEventListener('click', () => { close(); location.hash = a.url.replace(/^\//, ''); });
  m.onclick = (e) => { if (e.target === m) close(); };
  document.body.append(m);
}

export function showMatch(user, chatId) {
  const m = el(`<div class="match-modal" role="dialog" aria-label="Eşleşme"><button type="button" class="sh-x mm-x" aria-label="Kapat">${icon('close')}</button>
    <div class="inner">
      <div class="title">Eşleştiniz!</div>
      <p>Sen ve ${esc(user.name)} birbirinizi beğendiniz.</p>
      <div class="pair"><img src="${esc(state.me.avatar)}" alt=""><img src="${esc(user.avatar)}" alt=""></div>
      <a class="btn primary block" href="#/chat/${esc(chatId)}" style="background:#fff;color:#f2435a">Mesaj gönder</a>
      <button class="btn block" style="background:transparent;color:#fff">Kaydırmaya devam et</button>
    </div></div>`);
  m.querySelectorAll('button').forEach((b) => { b.onclick = () => m.remove(); });
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

// Klavye açılınca yazma alanı klavyenin altında kalmasın.
// Android'de sayfa klavye kadar küçülür (viewport: interactive-widget=resizes-content). iOS'ta küçülmez: görünür alan
// ölçülür, sohbet --vvh ile kısalır, sabit pencereler (alt sayfalar, hikâye, canlı yayın, oyunlar) yazılan alan
// klavyenin üstüne çıkana kadar yukarı kaldırılır, sıradan sayfalarda alan ekrana kaydırılır.
function keyboardFit() {
  const vv = window.visualViewport; const root = document.documentElement; let lifted = null; let timer = 0; let base = window.innerHeight; let bw = window.innerWidth;
  const editable = (el) => !!el?.matches?.('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=button]):not([type=submit]):not([type=color]), textarea, [contenteditable=""], [contenteditable="true"]');
  const unlift = () => { if (lifted) { lifted.el.style.translate = ''; lifted = null; } };
  const inSheet = (el) => !!el?.closest?.('.sheet');
  function fit() {
    if (window.innerWidth !== bw) { bw = window.innerWidth; base = window.innerHeight; } base = Math.max(base, window.innerHeight);
    const h = vv ? vv.height : window.innerHeight; const top = vv ? vv.offsetTop : 0; const el = document.activeElement; const typing = editable(el);
    const kb = Math.max(0, window.innerHeight - h - top); const over = typing && kb > 100; // klavye sayfanın üstüne bindi (iOS)
    root.style.setProperty('--vvh', `${Math.round(h)}px`); root.style.setProperty('--vvt', `${Math.max(0, Math.round(top))}px`); root.style.setProperty('--kb', `${over ? Math.round(kb) : 0}px`);
    root.classList.toggle('kb-open', over || (typing && base - window.innerHeight > 150));
    if (!over) { unlift(); if (typing && root.classList.contains('kb-open')) { const r = el.getBoundingClientRect(); if (r.bottom > h - 8) el.scrollIntoView({ block: 'center' }); } return; }
    let fx = el; while (fx && fx !== document.body && getComputedStyle(fx).position !== 'fixed') fx = fx.parentElement;
    // Sohbet ekranı klavye açıkken görünür alana sabitlenir (CSS: html.kb-open .chat); ayrıca kaldırılmaz
    if (lifted && !lifted.el.isConnected) lifted = null; // kapanan pencere
    // Alt sayfa (yorumlar vb.): CSS ile klavyenin hemen üstüne oturur (html.kb-open .sheet { bottom: var(--kb) });
    // ölçüp kaydırmaya gerek yok, açılış animasyonu sırasında yanlış ölçülmez. Yazılan alan sayfanın içinde görünür tutulur.
    if (inSheet(el)) { unlift(); requestAnimationFrame(() => { try { el.scrollIntoView({ block: 'nearest' }); } catch { /* eski tarayıcı */ } }); return; }
    if (fx && fx !== document.body && !fx.classList.contains('chat')) {
      if (lifted && lifted.el !== fx) unlift();
      const cur = lifted ? lifted.by : 0; const by = Math.max(0, Math.round(el.getBoundingClientRect().bottom + 14 - (top + h) + cur));
      if (by !== cur) { fx.style.translate = by ? `0 ${-by}px` : ''; lifted = by ? { el: fx, by } : null; }
    } else { unlift(); if (el.closest('.chat')) window.scrollTo(0, 0); else { const r = el.getBoundingClientRect(); if (r.bottom > top + h - 10 || r.top < top + 50) el.scrollIntoView({ block: 'center' }); } }
  }
  const later = () => { clearTimeout(timer); fit(); timer = setTimeout(fit, 330); };
  vv?.addEventListener('resize', later); vv?.addEventListener('scroll', later); window.addEventListener('resize', later);
  document.addEventListener('focusin', later); document.addEventListener('focusout', () => setTimeout(fit, 80));
  fit();
}

// Bildirim izni (telefonun izni): bu cihazda bu hesap için bir kez sorulur; "Şimdi değil" denirse bir daha sorulmaz
async function askPush() {
  try {
    if (!state.me || !pushSupported() || (await pushPermission()) !== 'default') return;
    if (await pushEnabled()) return;
    const key = `su_push_ask:${state.me.id}`; if (localStorage.getItem(key)) return; // bir kez sorulur
    if (document.querySelector('.sheet, .terms-up, .cons-up') || !state.me.consentsDone) { setTimeout(askPush, 15000); return; }
    localStorage.setItem(key, String(Date.now()));
    const close = sheet('Bildirimleri aç', `<div style="padding:0 18px 20px;display:grid;gap:12px">
      <p style="margin:0">Mesaj, arama, eşleşme ve falın geldiğinde anında haberin olsun. Bir sonraki ekranda <b>İzin ver</b>’e dokun.</p>
      <button class="btn primary block yes">Bildirimleri aç</button><button class="btn block outline no">Şimdi değil</button></div>`, {
      onMount(sh, c) {
        sh.querySelector('.no').onclick = c;
        sh.querySelector('.yes').onclick = async () => { c(); try { await enablePush(); toast('Bildirimler açıldı.'); } catch (e) { toast(e.message); } };
      },
    });
    void close;
  } catch { /* sessiz */ }
}

// İsteğe bağlı izinler (açık rıza): hesap başına BİR KEZ, tek ekranda, her biri ayrı kutu; kutular boş gelir.
// Kayıtta seçilmişse hiç çıkmaz. Sonradan yeni izin verilmez; verilen izin Ayarlar › İzinlerim'den geri alınabilir (KVKK).
const CONS_ITEMS = [
  ['marketing', 'Kampanya ve yenilik bildirimleri almak'],
  ['marketingEmail', 'Kampanya ve yenilik e-postaları almak (İYS’ye kaydedilir)'],
  ['location', 'Yakınımdaki kişileri görmek için yaklaşık konumumun işlenmesi'],
  ['ai', 'Fal fotoğraf ve notlarımın yorum taslağı hazırlanması için yurt dışındaki hizmet sağlayıcıya aktarılması'],
  ['orientation', 'Kaydırmada hangi cinsiyeti görmek istediğime dair tercihimin işlenmesi (özel nitelikli veri)'],
];
function consentOnce() {
  if (!state.me || state.me.consentsDone || state.ban || state.me.role === 'falci') return;
  if (document.querySelector('.terms-up, .cons-up') || state.me.needsBirthdate) { setTimeout(consentOnce, 3000); return; }
  let saved = false;
  sheet('İzinlerin', `<form class="cons-up" style="padding:0 18px 20px;display:grid;gap:12px">
    <p style="margin:0">Aşağıdakiler <b>isteğe bağlıdır</b>; işaretlemesen de SwipeUp’ı kullanırsın. Bu ekran <b>yalnız bir kez</b> gösterilir. Ayrıntılar <a class="link" href="#/legal/riza">açık rıza metni</a>nde, kişisel verilerin <a class="link" href="#/legal/kvkk">KVKK aydınlatma metni</a>nde.</p>
    ${CONS_ITEMS.map(([k, t]) => `<label class="consent"><input type="checkbox" name="${k}" ${state.me.consents?.[k]?.on ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}
    <p class="muted" style="margin:0;font-size:12.5px">Verdiğin izinleri sonra Ayarlar › İzinlerim’den geri alabilirsin; yeni izin sonradan eklenmez.</p>
    <button class="btn primary block">Kaydet ve devam et</button></form>`, {
    onMount(sh, close) {
      const f = sh.querySelector('form');
      f.onsubmit = async (e) => {
        e.preventDefault();
        const consents = Object.fromEntries(CONS_ITEMS.map(([k]) => [k, f[k].checked]));
        try { const u = await api('/me/consents/once', { body: { consents } }); Object.assign(state.me, u); saved = true; close(); toast('İzinlerin kaydedildi.'); }
        catch (er) { if (/daha önce/.test(er.message)) { state.me.consentsDone = true; saved = true; close(); } else toast(er.message); }
      };
    },
    onClose() { if (!saved && state.me && !state.me.consentsDone) setTimeout(consentOnce, 400); }, // seçim yapmadan kapanmaz
  });
}

// Güncellenen Kullanım Koşulları: okuyup onaylamadan kapatılamaz; istemeyen hesabını silebilir
function termsPrompt() {
  if (document.querySelector('.terms-up')) return;
  const close = sheet('Kullanım Koşulları güncellendi', `<div class="terms-up" style="padding:0 18px 20px;display:grid;gap:12px">
    <p style="margin:0">Kullanım Koşulları’nı ve gizlilik belgelerimizi güncelledik: satın almalarda ön bilgilendirme ve sözleşme, cayma ve iade koşulları, kampanya e-postaları için ayrı izin, hak ihlali bildirimi ve KVKK başvuru takibi eklendi. Devam etmek için güncel koşulları okuyup onaylaman gerekiyor.</p>
    <div style="display:flex;flex-wrap:wrap;gap:8px"><a class="chip" href="#/legal/kosullar">Kullanım koşulları</a><a class="chip" href="#/legal/kvkk">KVKK aydınlatma metni</a><a class="chip" href="#/legal/gizlilik">Gizlilik politikası</a><a class="chip" href="#/legal/iade">Cayma ve iade</a></div>
    <label class="consent"><input type="checkbox" name="ok"><span>Güncel Kullanım Koşulları’nı okudum ve kabul ediyorum; 18 yaşından büyük olduğumu beyan ederim.</span></label>
    <button class="btn primary block go">Onayla ve devam et</button></div>`, {
    onMount(sh) {
      sh.querySelectorAll('a.chip').forEach((a) => { a.onclick = (e) => { e.preventDefault(); import('./views/legal.js').then((m) => m.legalSheet(a.getAttribute('href').split('/').pop())); }; });
      sh.querySelector('.go').onclick = async () => {
        if (!sh.querySelector('[name=ok]').checked) { toast('Devam etmek için güncel koşulları onayla.'); return; }
        try { const r = await api('/me/terms', { body: { accept: true } }); state.me.termsV = r.termsV; close(); toast('Teşekkürler!'); } catch (er) { toast(er.message); }
      };
    },
    onClose() { if (state.me && state.me.termsV !== state.config?.legalVer?.kosullar) setTimeout(termsPrompt, 400); }, // onaylamadan kapatılırsa yeniden açılır
  });
}

async function boot() {
  try { if (document.referrer.startsWith('android-app://')) sessionStorage.setItem('su_twa', '1'); } catch { /* depolama kapalı */ } // Android uygulamasının içindeyiz (widget gibi yerel özellikler)
  // Yazı tipi açılışı bekletmesin (index.html'de media=print ile iner, burada devreye girer)
  try { const gf = document.getElementById('gfont'); if (gf) gf.media = 'all'; } catch { /* yok */ }
  // Açılacak sayfanın modülünü oturum/ayar istekleriyle aynı anda indirmeye başla
  try {
    const p = (location.hash || '#/').slice(1).split('?')[0] || '/';
    const r = localStorage.getItem('su_token') ? routes.find(([re]) => re.test(p)) : routes.find(([, n]) => n === 'auth');
    if (r) import(`./views/${r[1]}.js`).catch(() => {});
  } catch { /* yok */ }
  try { keyboardFit(); } catch { /* eski tarayıcı: varsayılan davranış */ }
  await initI18n().catch(() => {});
  try { const t = localStorage.getItem('su_theme'); if (t && t !== 'system') document.documentElement.dataset.theme = t; } catch {}
  try { applySkin(localStorage.getItem('su_skin') || 'gunbatimi', { save: false }); } catch {}
  try { const lg = localStorage.getItem('su_logo'); if (lg) document.documentElement.dataset.logo = lg; } catch {}
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  // Bildirime dokunuldu: ilgili sayfa açılır; bildirim cihazdaki başka bir hesabınsa o hesapla yeniden açılır
  const openPushUrl = (url, uid) => {
    const u = new URL(url || '/', location.origin); const as = uid || u.searchParams.get('as');
    if (!as || as === state.me?.id) { u.searchParams.delete('as'); if (u.pathname === location.pathname && !u.search) { location.hash = u.hash || '#/'; return; } }
    else u.searchParams.set('as', as);
    location.href = u.href;
  };
  navigator.serviceWorker?.addEventListener('message', (e) => { if (e.data?.type === 'navigate' && e.data.url) openPushUrl(e.data.url); });
  // Uygulama kapalıyken dokunulduysa olay açılışta gelir: hesap bilgisi yüklenince işlenir (gereksiz yeniden açılış olmasın)
  let tapLater = null;
  try { nativePush()?.addListener('tap', (d) => { if (state.me) openPushUrl(d?.url, d?.uid); else tapLater = d; }); } catch { /* eski uygulama sürümü */ }
  switchFromUrl(); // bildirimden gelindiyse o bildirimin hesabına geç
  if (state.token) {
    try {
      const [cfg, me] = await Promise.all([api('/config'), api('/me')]);
      state.config = cfg; state.me = me; remember(state.token, me);
      if (tapLater) { const d = tapLater; tapLater = null; setTimeout(() => openPushUrl(d.url, d.uid), 0); }
      if (me.ban) state.ban = me.ban;
      if (me.skin && me.skin !== currentSkin()) applySkin(me.skin);
      applyLogo(me.plus ? me.logo : 'klasik');
      if (!state.ban) { wireRealtime(); refreshBadges(); setTimeout(syncPush, 2500); setTimeout(askPush, 9000); }
    } catch { state.token = null; }
  }
  if (!state.config) state.config = await fetch('/api/config').then((r) => r.json()).catch(() => ({}));
  if (state.config?.maintenance) { showMaintenance(state.config.maintenance); return; }
  // Yönlendirmeli Google / Apple girişinden dönüş (?g=kod, ?a=kod)
  const gr = await takeGoogleReturn();
  if (gr?.purpose === 'link' && state.token && state.me) {
    location.hash = '#/settings';
    if (gr.error) setTimeout(() => toast(gr.error), 600);
    else api('/me/logins', { body: { provider: gr.provider || 'google', credential: gr.credential } }).then(async () => { Object.assign(state.me, await api('/me')); toast(`${gr.provider === 'apple' ? 'Apple' : 'Google'} hesabın bağlandı.`); }).catch((er) => toast(er.message));
  } else if (gr) { state.googleReturn = gr; if (!/^#\/(login|register)/.test(location.hash)) location.hash = '#/login'; }
  window.__suVer = state.config?.version || '';
  afterBoot(state.config?.version);
  initEvent(state.config);
  // İlk ziyarette telefona yükleme kılavuzu (iPhone: Safari → Ana Ekrana Ekle)
  setTimeout(maybeShowInstall, state.token ? 4000 : 1500);
  // Kullanım Koşulları güncellendiyse yeniden onay (sürüm ve tarih kayda geçer)
  if (state.me && !state.ban && state.config?.legalVer?.kosullar && state.me.termsV !== state.config.legalVer.kosullar) setTimeout(termsPrompt, 1800);
  if (state.me && !state.ban && !state.me.consentsDone) setTimeout(consentOnce, 2600);
  if (state.me?.lookingForPending && !state.ban) setTimeout(() => import('./consent.js').then((m) => m.orientationPending()), 3500);
  // Yeni üyeye SwipeUp+ denemesi: ilk açılışta bir kez tanıt
  if (state.me?.plusTrial && state.me.plusTrial.until > Date.now() && !state.me.plusTrial.bought) setTimeout(() => import('./trialsheet.js').then((m) => m.default(state.me.plusTrial)).catch(() => {}), 2500);
  // Beklenmeyen modül hataları (eski sürüm kalıntısı) → güncelleme ekranı
  window.addEventListener('unhandledrejection', (e) => { recover(e.reason); });
  // Geri düğmeleri (data-back="#/yedek"): sayfa içi betik kullanılmaz, tıklama burada yakalanır
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-back]'); if (!b) return;
    e.preventDefault();
    if (history.length > 1) history.back(); else location.hash = b.dataset.back || '#/';
  });
  initNav(); // router'dan önce: geçmiş sırası güncel olsun
  window.addEventListener('hashchange', router);
  router();
}
boot();

export { router };

import { icon } from './icons.js';
import {
  state, api, on, emit, connectSocket, refreshBadges, toast, esc, el, applySkin, currentSkin,
} from './core.js';
import { initCalls } from './calls.js';

const routes = [
  [/^\/?$/, 'feed', { tab: 'home' }],
  [/^\/search$/, 'search', { tab: 'home' }],
  [/^\/reels(?:\/([\w-]+))?$/, 'reels', { tab: 'reels', dark: true }],
  [/^\/swipe$/, 'swipe', { tab: 'swipe' }],
  [/^\/likes$/, 'likes', { tab: 'swipe' }],
  [/^\/chats$/, 'chats', { tab: 'chats' }],
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
  [/^\/fal(?:\/(\w+))?$/, 'fal', { tab: 'home' }],
  [/^\/create(?:\/(\w+))?$/, 'create', { tabs: false }],
  [/^\/p\/([\w-]+)$/, 'post', { tab: 'home' }],
  [/^\/(login|register|forgot)$/, 'auth', { tabs: false, public: true }],
];

const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
let cleanup = null;
let navToken = 0;

function renderTabbar(active) {
  const b = state.badges;
  const tabs = [
    ['home', '#/', icon(active === 'home' ? 'homeFill' : 'home'), 'Ana sayfa', ''],
    ['reels', '#/reels', icon('reels'), 'Reels', ''],
    ['swipe', '#/swipe', `<span class="center">${icon('flame')}${b.likes ? `<span class="num-badge">${b.likes > 99 ? '99+' : b.likes}</span>` : ''}</span>`, 'Kaydır ve eşleş', 'mid'],
    ['chats', '#/chats', `<span style="position:relative;display:grid">${icon('send')}${b.messages ? `<span class="num-badge">${b.messages}</span>` : ''}</span>`, 'Mesajlar', ''],
    ['me', '#/me', `<img class="me-av" src="${esc(state.me?.avatar)}" alt="">${b.notifications ? '<i class="dot-badge"></i>' : ''}`, 'Profil', ''],
  ];
  tabbar.innerHTML = tabs.map(([k, href, ic, label, cls]) => `<a href="${href}" class="${k === active ? 'on' : ''} ${cls}" aria-label="${label}">${ic}</a>`).join('');
}
on('badges', () => renderTabbar(tabbar.dataset.active));

async function router() {
  const path = location.hash.replace(/^#/, '') || '/';
  let match = null;
  for (const [re, name, opts] of routes) {
    const m = path.match(re);
    if (m) { match = { name, opts, params: m.slice(1) }; break; }
  }
  if (!match) { location.hash = '#/'; return; }
  if (!state.token && !match.opts.public) { location.hash = '#/login'; return; }
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
    view.innerHTML = `<div class="empty"><div class="big">${icon('close')}</div><h2>Bu sayfa açılamadı</h2>${esc(e.message)}<p><a class="btn primary" href="#/">Ana sayfaya dön</a></p></div>`;
  }
}

// ---- Global gerçek zamanlı olaylar ----
function wireRealtime() {
  connectSocket();
  initCalls();
  on('notification', (n) => {
    state.badges.notifications++; emit('badges', state.badges);
    if (location.hash === '#/notifications') return;
    const href = {
      match: '#/chats', live: `#/live/${n.fromId}`, follow: `#/u/${n.from?.username}`, super: '#/likes', liked: '#/likes', group: '#/chats', missed: '#/chats',
    }[n.type] || `#/p/${n.ref}`;
    toast(n.text, { title: n.type === 'liked' ? 'Yeni beğeni' : n.from?.name, img: n.type === 'liked' ? null : n.from?.avatar, href });
  });
  on('likes:new', () => refreshBadges());
  on('message', (m) => {
    if (m.from === state.me.id || m.system) return;
    const inChat = location.hash === `#/chat/${m.chatId}` && document.visibilityState === 'visible';
    if (!inChat) {
      refreshBadges();
      if (location.hash === '#/chats') return;
      api(`/users/${m.from}`).then((u) => toast(m.text || ({ audio: '🎤 Sesli mesaj', video: '🎥 Video' }[m.mediaType] || '📷 Fotoğraf'), { title: u.name, img: u.avatar, href: `#/chat/${m.chatId}` })).catch(() => {});
    }
  });
  on('match', ({ user, chatId }) => showMatch(user, chatId));
  on('blocked', () => { refreshBadges(); });
  on('reconnected', refreshBadges);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshBadges(); });
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
  try { const t = localStorage.getItem('su_theme'); if (t && t !== 'system') document.documentElement.dataset.theme = t; } catch {}
  try { applySkin(localStorage.getItem('su_skin') || 'gunbatimi', { save: false }); } catch {}
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  navigator.serviceWorker?.addEventListener('message', (e) => {
    if (e.data?.type === 'navigate' && e.data.url) location.href = e.data.url;
  });
  if (state.token) {
    try {
      const [cfg, me] = await Promise.all([api('/config'), api('/me')]);
      state.config = cfg; state.me = me;
      if (me.skin && me.skin !== currentSkin()) applySkin(me.skin);
      wireRealtime();
      refreshBadges();
    } catch { state.token = null; }
  }
  if (!state.config) state.config = await fetch('/api/config').then((r) => r.json()).catch(() => ({}));
  window.addEventListener('hashchange', router);
  router();
}
boot();

export { router };

import { icon } from './icons.js';
import {
  state, api, on, emit, connectSocket, refreshBadges, toast, esc, el, avatar,
} from './core.js';

const routes = [
  [/^\/?$/, 'feed', { tab: 'home' }],
  [/^\/search$/, 'search', { tab: 'home' }],
  [/^\/reels(?:\/([\w-]+))?$/, 'reels', { tab: 'reels', dark: true }],
  [/^\/swipe$/, 'swipe', { tab: 'swipe' }],
  [/^\/chats$/, 'chats', { tab: 'chats' }],
  [/^\/chat\/([\w-]+)$/, 'chat', { tabs: false }],
  [/^\/live$/, 'live', { tabs: false }],
  [/^\/live\/([\w-]+)$/, 'live', { tabs: false }],
  [/^\/notifications$/, 'notifications', { tab: 'home' }],
  [/^\/me$/, 'profile', { tab: 'me' }],
  [/^\/u\/([\w.]+)$/, 'profile', { tab: 'me' }],
  [/^\/edit$/, 'edit', { tabs: false }],
  [/^\/create(?:\/(\w+))?$/, 'create', { tabs: false }],
  [/^\/p\/([\w-]+)$/, 'post', { tab: 'home' }],
  [/^\/(login|register)$/, 'auth', { tabs: false, public: true }],
];

const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
let cleanup = null;
let navToken = 0;

function renderTabbar(active) {
  const b = state.badges;
  const tabs = [
    ['home', '#/', icon(active === 'home' ? 'homeFill' : 'home'), 'Ana sayfa'],
    ['reels', '#/reels', icon('reels'), 'Reels'],
    ['swipe', '#/swipe', icon('flame'), 'Keşfet ve eşleş'],
    ['chats', '#/chats', `<span style="position:relative;display:grid">${icon('send')}${b.messages ? `<span class="num-badge">${b.messages}</span>` : ''}</span>`, 'Mesajlar'],
    ['me', '#/me', `<img class="me-av" src="${esc(state.me?.avatar)}" alt="">${b.notifications ? '<i class="dot-badge"></i>' : ''}`, 'Profil'],
  ];
  tabbar.innerHTML = tabs.map(([k, href, ic, label]) => `<a href="${href}" class="${k === active ? 'on' : ''}" aria-label="${label}"><span class="pill">${ic}</span></a>`).join('');
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
  view.scrollTop = 0; window.scrollTo(0, 0);
  try {
    const mod = await import(`./views/${match.name}.js`);
    if (my !== navToken) return;
    const c = await mod.default(view, ...match.params);
    if (my !== navToken) { c?.(); return; }
    cleanup = c || null;
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="empty"><h2>Bu sayfa açılamadı</h2>${esc(e.message)}<p><a class="link" href="#/">Ana sayfaya dön</a></p></div>`;
  }
}

// ---- Global gerçek zamanlı olaylar ----
function wireRealtime() {
  connectSocket();
  on('notification', (n) => {
    state.badges.notifications++; emit('badges', state.badges);
    if (location.hash !== '#/notifications') {
      const href = n.type === 'match' ? '#/chats' : n.type === 'live' ? `#/live/${n.fromId}` : n.type === 'follow' ? `#/u/${n.from?.username}` : `#/p/${n.ref}`;
      toast(n.text, { title: n.from?.name, img: n.from?.avatar, href });
    }
  });
  on('message', (m) => {
    if (m.from === state.me.id) return;
    const inChat = location.hash === `#/chat/${m.chatId}` && document.visibilityState === 'visible';
    if (!inChat) {
      refreshBadges();
      api(`/users/${m.from}`).then((u) => toast(m.text || '📷 Fotoğraf', { title: u.name, img: u.avatar, href: `#/chat/${m.chatId}` })).catch(() => {});
    }
  });
  on('match', ({ user, chatId }) => showMatch(user, chatId));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshBadges(); });
}

export function showMatch(user, chatId) {
  const m = el(`<div class="match-modal" role="dialog" aria-label="Eşleşme">
    <div class="inner">
      <div class="title">Eşleştiniz!</div>
      <p>Sen ve ${esc(user.name)} birbirinizi beğendiniz.</p>
      <div class="pair"><img src="${esc(state.me.avatar)}" alt=""><img src="${esc(user.avatar)}" alt=""></div>
      <a class="btn primary block" href="#/chat/${esc(chatId)}">Mesaj gönder</a>
      <button class="btn block" style="background:transparent;color:#fff">Kaydırmaya devam et</button>
    </div></div>`);
  m.querySelector('button').onclick = () => m.remove();
  m.querySelector('a').onclick = () => m.remove();
  document.body.append(m);
  if (navigator.vibrate) navigator.vibrate([30, 60, 30]);
}

// ---- Başlangıç ----
async function boot() {
  try { const t = localStorage.getItem('su_theme'); if (t && t !== 'system') document.documentElement.dataset.theme = t; } catch {}
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  navigator.serviceWorker?.addEventListener('message', (e) => {
    if (e.data?.type === 'navigate' && e.data.url) location.href = e.data.url;
  });
  state.config = await fetch('/api/config').then((r) => r.json()).catch(() => ({}));
  if (state.token) {
    try {
      state.me = await api('/me');
      wireRealtime();
      refreshBadges();
    } catch { state.token = null; }
  }
  window.addEventListener('hashchange', router);
  router();
}
boot();

export { router };

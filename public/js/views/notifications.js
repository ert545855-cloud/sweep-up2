import { icon } from '../icons.js';
import {
  state, api, esc, ago, avatar, on, refreshBadges, toast, emit,
} from '../core.js';
import { notifSettings } from './profile.js';

const href = (n) => ({
  match: '#/chats', live: `#/live/${n.fromId}`, follow: `#/u/${n.from?.username}`, super: '#/likes', liked: '#/likes', group: '#/chats', missed: '#/chats',
}[n.type] || `#/p/${n.ref}`);

export default async function notifications(view) {
  view.innerHTML = `<header class="topbar bordered">
      <button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/')" aria-label="Geri">${icon('back')}</button>
      <div class="center">Bildirimler</div>
      <button class="ib st" aria-label="Bildirim ayarları">${icon('bell')}</button>
    </header><div class="nl"><div class="spinner"></div></div>`;
  view.querySelector('.st').onclick = notifSettings;

  const list = await api('/notifications');
  const nl = view.querySelector('.nl');
  const following = new Set((await api(`/users/${state.me.id}/following`)).map((u) => u.id));

  const row = (n) => `<a class="notif ${n.read ? '' : 'unread'}" href="${esc(href(n))}">
      ${n.from ? avatar(n.from, 44, { ring: true }) : `<span class="ic">${icon('heart', '', 'fill="currentColor"')}</span>`}
      <div class="t">${esc(n.text)} <span class="muted">${ago(n.at)}</span></div>
      ${n.type === 'follow' && n.from && !following.has(n.from.id) ? `<button class="btn primary fb" data-id="${esc(n.from.id)}">Takip et</button>` : ''}
      ${n.type === 'match' ? `<span style="color:var(--hot)">${icon('heart', '', 'fill="currentColor"')}</span>` : ''}
      ${n.type === 'live' ? `<span style="color:var(--hot)">${icon('live')}</span>` : ''}
      ${n.type === 'missed' ? `<span style="color:var(--hot)">${icon('phone')}</span>` : ''}
    </a>`;
  const paint = () => {
    if (!list.length) {
      nl.innerHTML = `<div class="empty"><div class="big">${icon('bell')}</div><h2>Henüz bildirim yok</h2>Biri seni beğendiğinde, takip ettiğinde ya da eşleştiğinde burada görürsün.</div>`;
      return;
    }
    const day = Date.now() - 86400000;
    const fresh = list.filter((n) => n.at > day);
    const old = list.filter((n) => n.at <= day);
    nl.innerHTML = (fresh.length ? `<div class="section-t">Bugün</div>${fresh.map(row).join('')}` : '')
      + (old.length ? `<div class="section-t">Önceki</div>${old.map(row).join('')}` : '');
  };
  paint();

  nl.onclick = async (e) => {
    const b = e.target.closest('.fb'); if (!b) return;
    e.preventDefault();
    try { await api(`/users/${b.dataset.id}/follow`, { body: {} }); following.add(b.dataset.id); b.remove(); } catch (er) { toast(er.message); }
  };

  await api('/notifications/read', { body: {} });
  state.badges.notifications = 0; emit('badges', state.badges);
  const off = on('notification', (n) => { list.unshift({ ...n, read: true }); paint(); api('/notifications/read', { body: {} }); });
  return () => { off(); refreshBadges(); };
}

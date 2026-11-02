import { icon } from '../icons.js';
import {
  state, api, esc, num, avatar, sheet, toast, logout, openChatWith, saved, enablePush, disablePush, pushEnabled, pushSupported, pushHint,
} from '../core.js';
import { gridTile } from '../components.js';

export function themeMenu() {
  const cur = localStorage.getItem('su_theme') || 'system';
  sheet('Görünüm', `<div class="menu">${[['system', 'Sistem ayarı'], ['light', 'Açık'], ['dark', 'Koyu']].map(([k, l]) => `<button data-t="${k}">${icon(k === 'dark' ? 'eye' : 'sun')}${l}${cur === k ? ` <span style="margin-left:auto">${icon('check')}</span>` : ''}</button>`).join('')}</div>`, {
    onMount(sh, close) {
      sh.querySelector('.menu').onclick = (e) => {
        const t = e.target.closest('[data-t]')?.dataset.t; if (!t) return;
        try { localStorage.setItem('su_theme', t); } catch {}
        if (t === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
        close();
      };
    },
  });
}

export async function notifSettings() {
  const enabled = await pushEnabled().catch(() => false);
  const hint = pushHint();
  sheet('Bildirimler', `<div style="padding:16px;display:grid;gap:12px">
    <p class="muted" style="margin:0">Mesaj, eşleşme, beğeni, yorum, takip ve canlı yayın bildirimleri bu cihaza gönderilir. Uygulama açıkken bildirimler ekranın üstünde görünür.</p>
    ${hint ? `<p style="margin:0">${esc(hint)}</p>` : `<button class="btn ${enabled ? '' : 'primary'} block tg">${enabled ? 'Bu cihazda bildirimleri kapat' : 'Bu cihazda bildirimleri aç'}</button>
    ${enabled ? '<button class="btn block test">Test bildirimi gönder</button>' : ''}`}
  </div>`, {
    onMount(sh, close) {
      sh.querySelector('.tg')?.addEventListener('click', async () => {
        try { if (enabled) { await disablePush(); toast('Bildirimler kapatıldı.'); } else { await enablePush(); toast('Bildirimler açıldı.'); } close(); } catch (e) { toast(e.message); }
      });
      sh.querySelector('.test')?.addEventListener('click', async () => {
        try { await api('/push/test', { body: {} }); toast('Test bildirimi gönderildi. Uygulamayı arka plana alırsan da gelir.'); } catch (e) { toast(e.message); }
      });
    },
  });
}

function peopleSheet(title, userId, which) {
  sheet(title, '<div class="pl"><div class="spinner"></div></div>', {
    async onMount(sh) {
      const us = await api(`/users/${userId}/${which}`);
      sh.querySelector('.pl').innerHTML = us.length ? us.map((u) => `<a class="list-item" href="#/u/${esc(u.username)}">${avatar(u, 44)}<div><div class="b">${esc(u.username)}</div><div class="sub">${esc(u.name)}</div></div></a>`).join('')
        : '<div class="empty">Henüz kimse yok.</div>';
    },
  });
}

export default async function profile(view, username) {
  const self = !username || username === state.me.username;
  view.innerHTML = '<div class="spinner" style="margin-top:40vh"></div>';
  const u = await api(`/users/${self ? state.me.id : encodeURIComponent(username)}`);
  if (self) Object.assign(state.me, u);
  const posts = u.posts.filter((p) => p.type === 'image');
  const reels = u.posts.filter((p) => p.type === 'reel');
  const tabs = self ? ['grid', 'reels', 'saved'] : ['grid', 'reels'];

  view.innerHTML = `<header class="topbar">
      ${self ? `<a class="ib" href="#/create" aria-label="Oluştur">${icon('plus')}</a>` : `<button class="ib" onclick="history.back()" aria-label="Geri">${icon('back')}</button>`}
      <h1 style="justify-content:${self ? 'center' : 'flex-start'}">${self ? icon('lock', '', 'style="width:18px;height:18px"') : ''}<span>${esc(u.username)}</span>${self ? icon('chevDown', '', 'style="width:18px;height:18px"') : ''}</h1>
      ${self ? `<a class="ib" href="#/notifications" aria-label="Bildirimler">${icon('heart')}${state.badges.notifications ? '<i class="dot-badge" style="top:6px;right:6px"></i>' : ''}</a>` : ''}
      <button class="ib menu-btn" aria-label="Menü">${icon(self ? 'menu' : 'more')}</button>
    </header>
    <section class="profile-top">
      <a class="av-wrap" href="${u.live ? `#/live/${esc(u.id)}` : self ? '#/create' : '#'}" data-presence="${esc(u.id)}">
        ${u.live ? `<div class="ring"><img class="av" src="${esc(u.avatar)}" alt="" style="width:80px;height:80px"></div><span class="live-tag" style="top:76px">CANLI</span>` : `<img class="av" src="${esc(u.avatar)}" alt="">`}
        ${self ? `<span class="plus">${icon('plus')}</span>` : (u.online ? '<i class="online" style="width:18px;height:18px;right:4px;bottom:4px"></i>' : '')}
      </a>
      <div class="info">
        <div class="fullname">${esc(u.name)}</div>
        <div class="stats">
          <div><b>${num(u.posts.length)}</b><span>gönderi</span></div>
          <button class="fl"><b>${num(u.followers)}</b><span>takipçi</span></button>
          <button class="fg"><b>${num(u.following)}</b><span>takip</span></button>
        </div>
      </div>
    </section>
    <div class="profile-bio">${u.bio ? `<div class="bio-t">${esc(u.bio)}</div>` : (self ? '<a class="muted" href="#/edit">Biyografi ekle</a>' : '')}
      ${(u.age || u.city) ? `<div class="meta">${[u.age, u.city].filter(Boolean).map(esc).join(' · ')}</div>` : ''}
      ${u.interests?.length ? `<div class="chips">${u.interests.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>` : ''}
      ${!self && u.followsYou ? '<div class="meta">Seni takip ediyor</div>' : ''}
    </div>
    <div class="profile-btns">
      ${self
    ? `<a class="btn" href="#/edit">Profili düzenle</a><button class="btn share">Profili paylaş</button><a class="btn sq" href="#/search" aria-label="Kişi bul">${icon('userPlus', '', 'style="width:18px;height:18px"')}</a>`
    : `<button class="btn ${u.isFollowing ? '' : 'primary'} follow">${u.isFollowing ? 'Takiptesin' : (u.followsYou ? 'Sen de takip et' : 'Takip et')}</button><button class="btn msg">Mesaj gönder</button>`}
    </div>
    <div class="tabs" style="grid-template-columns:repeat(${tabs.length},1fr)">
      ${tabs.map((t, i) => `<button data-t="${t}" class="${i ? '' : 'on'}" aria-label="${{ grid: 'Gönderiler', reels: 'Reels', saved: 'Kaydedilenler' }[t]}">${icon({ grid: 'grid', reels: 'reels', saved: 'bookmark' }[t])}</button>`).join('')}
    </div>
    <div class="tab-body"></div>`;

  const body = view.querySelector('.tab-body');
  const showTab = async (t) => {
    view.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
    let items = t === 'grid' ? posts : reels;
    if (t === 'saved') {
      body.innerHTML = '<div class="spinner"></div>';
      items = (await Promise.all(saved.all().slice(0, 30).map((id) => api(`/posts/${id}`).catch(() => null)))).filter(Boolean);
    }
    if (!items.length) {
      const msg = {
        grid: self ? ['Fotoğraf paylaş', 'Paylaştığın fotoğraflar profilinde görünür.', '#/create', 'İlk fotoğrafını paylaş'] : ['Henüz gönderi yok', '', '', ''],
        reels: self ? ['Reels paylaş', 'Kısa videoların burada görünür.', '#/create/reel', 'Reels oluştur'] : ['Henüz reels yok', '', '', ''],
        saved: ['Kaydedilenler', 'Kaydettiğin gönderiler sadece sana görünür.', '', ''],
      }[t];
      body.innerHTML = `<div class="empty"><div class="big">${icon(t === 'grid' ? 'camera' : t === 'reels' ? 'reels' : 'bookmark')}</div><h2>${msg[0]}</h2>${msg[1]}${msg[2] ? `<p><a class="link" href="${msg[2]}">${msg[3]}</a></p>` : ''}</div>`;
      return;
    }
    body.innerHTML = `<div class="grid">${items.map(gridTile).join('')}</div>`;
  };
  view.querySelector('.tabs').onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) showTab(b.dataset.t); };
  showTab('grid');

  view.querySelector('.fl').onclick = () => peopleSheet('Takipçiler', u.id, 'followers');
  view.querySelector('.fg').onclick = () => peopleSheet('Takip edilenler', u.id, 'following');

  const share = async () => {
    const url = `${location.origin}/#/u/${u.username}`;
    if (navigator.share) navigator.share({ title: `${u.name} (@${u.username})`, url }).catch(() => {});
    else { await navigator.clipboard?.writeText(url); toast('Profil bağlantısı kopyalandı.'); }
  };
  view.querySelector('.share')?.addEventListener('click', share);

  const fb = view.querySelector('.follow');
  if (fb) fb.onclick = async () => {
    try {
      const r = await api(`/users/${u.id}/follow`, { body: {} });
      fb.textContent = r.following ? 'Takiptesin' : 'Takip et';
      fb.classList.toggle('primary', !r.following);
      const c = view.querySelector('.fl b'); c.textContent = num((u.followers += r.following ? 1 : -1));
    } catch (e) { toast(e.message); }
  };
  view.querySelector('.msg')?.addEventListener('click', () => openChatWith(u.id).catch((e) => toast(e.message)));

  view.querySelector('.menu-btn').onclick = () => {
    const items = self
      ? [['edit', 'edit', 'Profili düzenle'], ['bell', 'notif', 'Bildirimler'], ['sun', 'theme', 'Görünüm'], ['share', 'share', 'Profili paylaş'], ['logout', 'logout', 'Çıkış yap']]
      : [['share', 'share', 'Profili paylaş'], ['send', 'msg', 'Mesaj gönder']];
    sheet(null, `<div class="menu">${items.map(([ic, a, l]) => `<button data-a="${a}" class="${a === 'logout' ? 'danger' : ''}">${icon(ic)}${l}</button>`).join('')}</div>`, {
      onMount(sh, close) {
        sh.querySelector('.menu').onclick = (e) => {
          const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
          close();
          if (a === 'edit') location.hash = '#/edit';
          if (a === 'notif') notifSettings();
          if (a === 'theme') themeMenu();
          if (a === 'share') share();
          if (a === 'msg') openChatWith(u.id);
          if (a === 'logout' && confirm('Çıkış yapılsın mı?')) logout();
        };
      },
    });
  };
  return null;
}
export { pushSupported };

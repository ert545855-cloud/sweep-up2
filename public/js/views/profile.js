import { icon } from '../icons.js';
import {
  state, api, esc, num, avatar, sheet, toast, openChatWith, saved, enablePush, disablePush, pushEnabled, pushHint,
  blockUser, reportUser, unmatchUser, lastSeen, isOn, SKINS, applySkin, currentSkin,
} from '../core.js';
import { gridTile } from '../components.js';

export function themeMenu() {
  const mode = localStorage.getItem('su_theme') || 'system';
  const cur = currentSkin();
  sheet('Tema', `<div class="skin-grid">${SKINS.map((k) => `<button class="skin-opt ${cur === k.id ? 'on' : ''}" data-s="${k.id}">
      <span class="pv" style="background:${k.pv}"><i style="background:${k.a}"></i><i style="background:${k.a}"></i></span>
      <b>${esc(k.name)}</b><span>${esc(k.note)}</span></button>`).join('')}</div>
    <div class="mode" ${cur === 'gunbatimi' ? '' : 'hidden'}><div class="group-t" style="padding-left:16px">Gün batımı modu</div>
    <div class="menu">${[['system', 'Sistem ayarı', 'settings'], ['light', 'Açık', 'sun'], ['dark', 'Koyu', 'eye']].map(([k, l, ic]) => `<button data-t="${k}">${icon(ic)}<span class="grow">${l}</span>${mode === k ? icon('check') : ''}</button>`).join('')}</div></div>`, {
    onMount(sh, close) {
      sh.querySelector('.skin-grid').onclick = (e) => {
        const b = e.target.closest('[data-s]'); if (!b) return;
        const id = applySkin(b.dataset.s);
        sh.querySelectorAll('.skin-opt').forEach((x) => x.classList.toggle('on', x === b));
        sh.querySelector('.mode').hidden = id !== 'gunbatimi';
        api('/me', { method: 'PATCH', body: { skin: id } }).then((u) => { state.me.skin = u.skin; }).catch(() => {});
      };
      sh.querySelector('.mode .menu').onclick = (e) => {
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
  sheet('Bildirimler', `<div style="padding:0 16px 16px;display:grid;gap:12px">
    <p class="muted" style="margin:0">Mesaj, arama, eşleşme, beğeni, yorum, takip ve canlı yayın bildirimleri bu cihaza gönderilir. Uygulama açıkken bildirimler ekranın üstünde görünür.</p>
    ${hint ? `<p style="margin:0">${esc(hint)}</p>` : `<button class="btn ${enabled ? '' : 'primary'} block tg">${enabled ? 'Bu cihazda bildirimleri kapat' : 'Bu cihazda bildirimleri aç'}</button>
    ${enabled ? '<button class="btn outline block test">Test bildirimi gönder</button>' : ''}`}
  </div>`, {
    onMount(sh, close) {
      sh.querySelector('.tg')?.addEventListener('click', async () => {
        try { if (enabled) { await disablePush(); toast('Bildirimler kapatıldı.'); } else { await enablePush(); toast('Bildirimler açıldı.'); } close(); } catch (e) { toast(e.message); }
      });
      sh.querySelector('.test')?.addEventListener('click', async () => {
        try { await api('/push/test', { body: {} }); toast('Test bildirimi gönderildi.'); } catch (e) { toast(e.message); }
      });
    },
  });
}

function peopleSheet(title, userId, which) {
  sheet(title, '<div class="pl"><div class="spinner"></div></div>', {
    async onMount(sh) {
      const us = await api(`/users/${userId}/${which}`);
      sh.querySelector('.pl').innerHTML = us.length ? us.map((u) => `<a class="list-item" href="#/u/${esc(u.username)}">${avatar(u, 44)}<div><div class="b">${esc(u.name)}</div><div class="sub">@${esc(u.username)}</div></div></a>`).join('')
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
  const avHref = u.live ? `#/live/${u.id}` : u.hasStory ? `#/stories/${u.id}` : self ? '#/create/story' : null;
  const meta = [u.age, u.city, !self && u.distanceKm ? `${u.distanceKm} km` : null].filter(Boolean);

  view.innerHTML = `<header class="topbar">
      ${self ? `<a class="ib soft" href="#/create" aria-label="Oluştur">${icon('plus')}</a>` : `<button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/')" aria-label="Geri">${icon('back')}</button>`}
      <div class="center">${self ? 'Profilin' : ''}</div>
      ${self ? `<a class="ib soft" href="#/settings" aria-label="Ayarlar">${icon('settings')}</a>` : `<button class="ib soft menu-btn" aria-label="Seçenekler">${icon('more')}</button>`}
    </header>
    <section class="profile-hero">
      <${avHref ? `a href="${esc(avHref)}"` : 'div'} class="av-wrap">
        ${u.live || u.hasStory ? `<div class="ring ${u.live ? 'live' : ''}"><img class="av" src="${esc(u.avatar)}" alt=""></div>` : `<img class="av" src="${esc(u.avatar)}" alt="">`}
        ${u.live ? '<span class="live-tag">CANLI</span>' : self && !u.hasStory ? `<span class="plus">${icon('plus')}</span>` : (!self && isOn(u) ? '<i class="online"></i>' : '')}
      </${avHref ? 'a' : 'div'}>
      <h2>${esc(u.name)}</h2>
      ${u.role === 'falci' ? '<span class="chip uv" style="margin-top:8px">🔮 Falcı</span>' : ''}
      <div class="handle">@${esc(u.username)}${!self ? ` · ${esc(lastSeen(u))}` : ''}</div>
      ${u.bio ? `<p class="bio">${esc(u.bio)}</p>` : (self ? '<a class="link" href="#/edit" style="margin-top:6px">Biyografi ekle</a>' : '')}
      ${meta.length || u.interests?.length || (!self && (u.followsYou || u.matched)) ? `<div class="chips">
        ${meta.map((m) => `<span class="chip">${esc(m)}</span>`).join('')}
        ${(u.interests || []).map((t) => `<span class="chip uv">${esc(t)}</span>`).join('')}
        ${!self && u.matched ? '<span class="chip uv">💜 Eşleştiniz</span>' : !self && u.followsYou ? '<span class="chip">Seni takip ediyor</span>' : ''}
      </div>` : ''}
    </section>
    <div class="stats">
      <div><b>${num(u.posts.length)}</b><span>gönderi</span></div>
      <button class="fl"><b>${num(u.followers)}</b><span>takipçi</span></button>
      <button class="fg"><b>${num(u.following)}</b><span>takip</span></button>
    </div>
    <div class="profile-btns">
      ${self
    ? `<a class="btn" href="#/edit">Profili düzenle</a><button class="btn share">Paylaş</button>`
    : u.blockedByMe
      ? '<button class="btn primary unb">Engeli kaldır</button>'
      : u.role === 'falci'
        ? `<a class="btn primary" href="#/fal">🔮 Fal baktır</a><button class="btn msg">${icon('send')} Mesaj</button>`
        : `<button class="btn ${u.isFollowing ? '' : 'primary'} follow">${u.isFollowing ? 'Takiptesin' : (u.followsYou ? 'Sen de takip et' : 'Takip et')}</button><button class="btn msg">${icon('send')} Mesaj</button>`}
    </div>
    <div class="tabs">
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
      body.innerHTML = `<div class="empty" style="padding-top:28px"><div class="big">${icon(t === 'grid' ? 'camera' : t === 'reels' ? 'reels' : 'bookmark')}</div><h2>${msg[0]}</h2>${msg[1]}${msg[2] ? `<p><a class="btn primary" href="${msg[2]}">${msg[3]}</a></p>` : ''}</div>`;
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
  view.querySelector('.unb')?.addEventListener('click', async () => {
    await api(`/users/${u.id}/block`, { method: 'DELETE' }); toast('Engel kaldırıldı.'); profile(view, username);
  });

  const fb = view.querySelector('.follow');
  if (fb) fb.onclick = async () => {
    try {
      const r = await api(`/users/${u.id}/follow`, { body: {} });
      fb.textContent = r.following ? 'Takiptesin' : 'Takip et';
      fb.classList.toggle('primary', !r.following);
      view.querySelector('.fl b').textContent = num((u.followers += r.following ? 1 : -1));
    } catch (e) { toast(e.message); }
  };
  view.querySelector('.msg')?.addEventListener('click', () => openChatWith(u.id).catch((e) => toast(e.message)));

  view.querySelector('.menu-btn')?.addEventListener('click', () => {
    const items = [['share', 'share', 'Profili paylaş']];
    if (u.matched) items.push(['x', 'unmatch', 'Eşleşmeyi kaldır']);
    if (!u.blockedByMe) items.push(['block', 'block', 'Engelle'], ['flag', 'report', 'Şikayet et']);
    sheet(null, `<div class="menu">${items.map(([ic, a, l]) => `<button data-a="${a}" class="${['block', 'report', 'unmatch'].includes(a) ? 'danger' : ''}">${icon(ic)}${l}</button>`).join('')}</div>`, {
      onMount(sh, close) {
        sh.querySelector('.menu').onclick = async (e) => {
          const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
          close();
          if (a === 'share') share();
          if (a === 'unmatch' && await unmatchUser(u)) profile(view, username);
          if (a === 'block' && await blockUser(u)) profile(view, username);
          if (a === 'report') reportUser(u);
        };
      },
    });
  });
  return null;
}

import { icon } from '../icons.js';
import {
  state, api, esc, on, isOn, toast, enablePush, pushSupported, pushEnabled, pushHint,
} from '../core.js';
import { postCard, wirePost, autoplay } from '../components.js';

export default async function feed(view) {
  view.innerHTML = `
    <header class="topbar">
      <div class="wordmark">SwipeUp</div>
      <a class="ib" href="#/search" aria-label="Ara">${icon('search')}</a>
      <a class="ib" href="#/create" aria-label="Oluştur">${icon('plusSq')}</a>
      <a class="ib" href="#/notifications" aria-label="Bildirimler">${icon('heart')}<i class="dot-badge nb" style="top:6px;right:6px;${state.badges.notifications ? '' : 'display:none'}"></i></a>
    </header>
    <div class="stories" aria-label="Canlı yayınlar ve çevrimiçi kişiler"></div>
    <div class="push-slot"></div>
    <div class="posts"><div class="spinner"></div></div>`;

  const offs = [];
  const storiesEl = view.querySelector('.stories');
  let people = [];

  const paintStories = () => {
    const lives = state.lives.filter((l) => l.userId !== state.me.id);
    const myLive = state.lives.find((l) => l.userId === state.me.id);
    const liveIds = new Set(lives.map((l) => l.userId));
    const onlinePeople = people.filter((u) => !liveIds.has(u.id) && isOn(u));
    const rest = people.filter((u) => !liveIds.has(u.id) && !isOn(u)).slice(0, 12);
    storiesEl.innerHTML = `
      <a class="story" href="#/live">
        <div class="plain"><img class="av" src="${esc(state.me.avatar)}" alt=""></div>
        <span class="add">${icon('plus')}</span>
        <span class="name">${myLive ? 'Yayındasın' : 'Canlı yayın'}</span></a>
      ${lives.map((l) => `<a class="story" href="#/live/${esc(l.userId)}">
        <div class="ring"><img class="av" src="${esc(l.user.avatar)}" alt=""></div>
        <span class="live-tag">CANLI</span><span class="name">${esc(l.user.username)}</span></a>`).join('')}
      ${[...onlinePeople, ...rest].map((u) => `<a class="story" href="#/u/${esc(u.username)}">
        <div class="ring seen"><img class="av" src="${esc(u.avatar)}" alt=""></div>
        ${isOn(u) ? '<i class="online"></i>' : ''}<span class="name">${esc(u.username)}</span></a>`).join('')}`;
  };

  offs.push(on('lives', paintStories));
  offs.push(on('presence', paintStories));
  offs.push(on('badges', (b) => { view.querySelector('.nb').style.display = b.notifications ? '' : 'none'; }));

  // Bildirim izni kartı
  (async () => {
    if (localStorage.getItem('su_push_dismiss')) return;
    if (pushSupported() && (await pushEnabled())) return;
    if (pushSupported() && Notification.permission === 'denied') return;
    const slot = view.querySelector('.push-slot');
    const hint = pushHint();
    slot.innerHTML = `<div class="push-card">${icon('bell')}<div class="grow"><b>Bildirimleri aç</b>
      <p>${esc(hint || 'Mesaj, eşleşme ve canlı yayınlardan anında haberin olsun.')}</p></div>
      ${hint ? '' : '<button class="btn primary on-push">Aç</button>'}<button class="ib x" aria-label="Kapat" style="width:28px">${icon('close')}</button></div>`;
    slot.querySelector('.x').onclick = () => { localStorage.setItem('su_push_dismiss', '1'); slot.innerHTML = ''; };
    const b = slot.querySelector('.on-push');
    if (b) b.onclick = async () => {
      try { await enablePush(); slot.innerHTML = ''; toast('Bildirimler açıldı.'); } catch (e) { toast(e.message); }
    };
  })();

  const [posts, me] = await Promise.all([api('/feed'), api(`/users/${state.me.id}/following`)]);
  people = me;
  paintStories();
  const list = view.querySelector('.posts');
  if (!posts.length) {
    list.innerHTML = `<div class="empty"><div class="big">${icon('camera')}</div><h2>Akışın boş</h2>Birkaç kişiyi takip et ya da ilk gönderini paylaş.<p><a class="btn primary" href="#/create">Gönderi paylaş</a></p></div>`;
  } else {
    list.innerHTML = posts.map(postCard).join('');
    posts.forEach((p) => wirePost(list.querySelector(`[data-post="${p.id}"]`), p));
    offs.push(autoplay(list));
    list.insertAdjacentHTML('beforeend', `<div class="empty" style="padding:32px">${icon('check')}<div>Hepsini gördün</div><a class="link" href="#/swipe">Yeni insanlarla tanış</a></div>`);
  }
  return () => offs.forEach((f) => f());
}

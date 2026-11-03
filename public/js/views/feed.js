import { icon } from '../icons.js';
import {
  state, api, esc, on, isOn, toast, enablePush, pushSupported, pushEnabled, pushHint, logo, openChatWith, nm,
} from '../core.js';
import { postCard, wirePost, autoplay } from '../components.js';
import { paintEventBanner } from '../event.js';

export default async function feed(view) {
  view.innerHTML = `
    <header class="topbar">
      <div class="wordmark">${logo()}</div>
      <a class="ib" href="#/fal" aria-label="Fal" style="font-size:22px">🔮</a>
      <a class="ib" href="#/search" aria-label="Ara">${icon('search')}</a>
      <a class="ib" href="#/create" aria-label="Oluştur">${icon('plusSq')}</a>
      <a class="ib" href="#/notifications" aria-label="Bildirimler">${icon('bell')}<i class="dot-badge nb" style="top:8px;right:8px;${state.badges.notifications ? '' : 'display:none'}"></i></a>
    </header>
    <div class="stories" aria-label="Hikayeler ve canlı yayınlar"></div>
    <div class="maint-slot"></div>
    <div class="event-slot"></div>
    <a class="fal-hero" href="#/fal" style="margin-top:0"><span class="zs">☕️</span><div class="grow"><b>${state.me.role === 'falci' ? `Fal kuyruğu${state.badges.fal ? ` · ${state.badges.fal} bekliyor` : ''}` : 'Falcı Teyze’ye fal baktır'}</b><p>${state.me.role === 'falci' ? 'Gelen fal isteklerini gör ve cevapla.' : 'Kahve falı, tarot, burç ve aşk uyumu. Cevabı mesaj kutuna gelir.'}</p></div>${icon('chevDown', '', 'style="transform:rotate(-90deg)"')}</a>
    <div class="social-row"><a class="genel-row feedg" href="#/genel"><span class="genel-ic">${icon('users')}</span><span class="grow"><b>Genel sohbet</b><small>Herkes burada</small></span></a>
      <a class="genel-row feedg rooms-e" href="#/odalar"><span class="genel-ic">🎵</span><span class="grow"><b>Odalar</b><small>Müzik, dizi, şehir…</small></span></a>
      <a class="genel-row feedg speed-e" href="#/hizli"><span class="genel-ic">⚡</span><span class="grow"><b>Hızlı tanış</b><small>3 dk görüntülü</small></span></a></div>
    ${state.config?.features?.market ? `<a class="mk-entry" href="#/market"><span class="mk-ei">${icon('bag')}</span><span class="grow"><b>SwipeUp Store</b><small>İkinci el al, sat · komisyon yok · güvenli ödeme</small></span><span class="go-chip">Göz at</span></a>` : ''}
    <div class="push-slot"></div>
    <div class="people"></div>
    <div class="posts"><div class="spinner"></div></div>`;

  const offs = [];
  const storiesEl = view.querySelector('.stories');
  const peopleEl = view.querySelector('.people');
  let stories = [];
  let people = [];

  const paintStories = () => {
    const lives = state.lives.filter((l) => l.userId !== state.me.id);
    const mine = stories.find((g) => g.user.id === state.me.id);
    const others = stories.filter((g) => g.user.id !== state.me.id);
    const liveIds = new Set(lives.map((l) => l.userId));
    storiesEl.innerHTML = `
      <a class="story" href="${mine ? `#/stories/${state.me.id}` : '#/create/story'}">
        <div class="${mine ? 'ring' : 'plain'}"><img src="${esc(state.me.avatar)}" alt=""></div>
        ${mine ? '' : `<span class="add">${icon('plus')}</span>`}
        <span class="name">Hikayen</span></a>
      <a class="story" href="#/live">
        <div class="plain"><span style="width:64px;height:64px;border-radius:30%;background:var(--surface);display:grid;place-items:center;color:var(--hot)">${icon('live')}</span></div>
        <span class="name">Canlı yayın</span></a>
      ${lives.map((l) => `<a class="story" href="#/live/${esc(l.userId)}">
        <div class="ring live"><img src="${esc(l.user.avatar)}" alt=""></div>
        <span class="live-tag">CANLI</span><span class="name">${esc(l.user.username)}</span></a>`).join('')}
      ${others.filter((g) => !liveIds.has(g.user.id)).map((g) => `<a class="story" href="#/stories/${esc(g.user.id)}">
        <div class="ring ${g.allSeen ? 'seen' : ''}"><img src="${esc(g.user.avatar)}" alt=""></div>
        ${isOn(g.user) ? '<i class="online"></i>' : ''}<span class="name">${esc(g.user.username)}</span></a>`).join('')}`;
  };

  const paintPeople = () => {
    const list = people.slice(0, 20);
    if (!list.length) {
      peopleEl.innerHTML = `<div class="push-card" style="background:var(--surface)">${icon('userPlus')}<div class="grow"><b>Arkadaşlarını davet et</b><p>Henüz başka üye yok. Bağlantıyı paylaş, kaydolan herkes burada görünür.</p></div><button class="btn primary sm inv">Paylaş</button></div>`;
      peopleEl.querySelector('.inv').onclick = async () => {
        const url = location.origin;
        if (navigator.share) navigator.share({ title: 'SwipeUp', text: 'SwipeUp’ta buluşalım!', url }).catch(() => {});
        else { await navigator.clipboard?.writeText(url); toast('Bağlantı kopyalandı.'); }
      };
      return;
    }
    const onlineCount = list.filter(isOn).length;
    peopleEl.innerHTML = `<div class="section-t"><span>${onlineCount ? `Şu an çevrimiçi · ${onlineCount}` : 'Yeni üyeler'}</span><a href="#/search">Tümü</a></div>
      <div class="people-row">${list.map((u) => `<div class="person-card">
        ${Date.now() - (u.createdAt || 0) < 3 * 86400000 ? '<span class="new">YENİ</span>' : ''}
        <a href="#/u/${esc(u.username)}" class="av-wrap" data-presence="${esc(u.id)}"><img class="av av-56" src="${esc(u.avatar)}" alt="">${isOn(u) ? '<i class="online"></i>' : ''}</a>
        <a href="#/u/${esc(u.username)}" class="n ellipsis">${nm(u)}</a>
        <span class="s ellipsis">${isOn(u) ? 'çevrimiçi' : '@' + esc(u.username)}</span>
        <button class="btn primary sm msg" data-id="${esc(u.id)}">Mesaj</button></div>`).join('')}</div>`;
  };
  peopleEl.addEventListener('click', (e) => {
    const b = e.target.closest('.msg'); if (b) openChatWith(b.dataset.id).catch((er) => toast(er.message));
  });

  const loadStories = async () => { stories = await api('/stories').catch(() => []); paintStories(); };
  const loadPeople = async () => { people = await api('/people').catch(() => []); paintPeople(); };

  offs.push(on('lives', paintStories));
  offs.push(on('presence', () => { paintStories(); paintPeople(); }));
  offs.push(on('stories:update', loadStories));
  offs.push(on('people:new', loadPeople));
  offs.push(on('reconnected', () => { loadStories(); loadPeople(); }));
  offs.push(on('badges', (b) => { view.querySelector('.nb').style.display = b.notifications ? '' : 'none'; }));
  offs.push(paintEventBanner(view.querySelector('.event-slot')));
  // Planlı bakım duyurusu
  const maintSlot = view.querySelector('.maint-slot');
  const paintMaint = () => {
    const p = state.config?.maintPlan;
    let hidden = false; try { hidden = p && localStorage.getItem('su_maint_hide') === String(p.start); } catch {}
    if (!p || hidden || p.start < Date.now()) { maintSlot.innerHTML = ''; return; }
    const o = { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' };
    const st = new Date(p.start); const en = p.end ? new Date(p.end) : null;
    const when = `${st.toLocaleString('tr-TR', o)}${en ? ` – ${en.toDateString() === st.toDateString() ? en.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : en.toLocaleString('tr-TR', o)}` : ''}`;
    maintSlot.innerHTML = `<div class="maint-plan"><span class="mp-ic">🛠️</span><div class="grow"><b>Planlı bakım</b><small>${esc(when)} ${p.end ? 'arasında SwipeUp kullanılamayacak.' : 'itibarıyla SwipeUp bir süre bakımda olacak.'}${p.message ? ` ${esc(p.message)}` : ''}</small></div><button class="ib mp-x" aria-label="Gizle">${icon('close')}</button></div>`;
    maintSlot.querySelector('.mp-x').onclick = () => { try { localStorage.setItem('su_maint_hide', String(p.start)); } catch {} maintSlot.innerHTML = ''; };
  };
  paintMaint();
  offs.push(on('maintenance:plan', (p) => { if (state.config) state.config.maintPlan = p; paintMaint(); }));

  // Bildirim izni kartı
  (async () => {
    if (localStorage.getItem('su_push_dismiss')) return;
    if (pushSupported() && (await pushEnabled())) return;
    if (pushSupported() && Notification.permission === 'denied') return;
    const slot = view.querySelector('.push-slot');
    const hint = pushHint();
    slot.innerHTML = `<div class="push-card">${icon('bell')}<div class="grow"><b>Bildirimleri aç</b>
      <p>${esc(hint || 'Mesaj, arama, eşleşme ve canlı yayınlardan anında haberin olsun.')}</p></div>
      ${hint ? '' : '<button class="btn primary sm on-push">Aç</button>'}<button class="x" aria-label="Kapat" style="width:28px;display:grid;place-items:center">${icon('close')}</button></div>`;
    slot.querySelector('.x').onclick = () => { localStorage.setItem('su_push_dismiss', '1'); slot.innerHTML = ''; };
    const b = slot.querySelector('.on-push');
    if (b) b.onclick = async () => {
      try { await enablePush(); slot.innerHTML = ''; toast('Bildirimler açıldı.'); } catch (e) { toast(e.message); }
    };
  })();

  const [posts] = await Promise.all([api('/feed'), loadStories(), loadPeople()]);
  const list = view.querySelector('.posts');
  if (!posts.length) {
    list.innerHTML = `<div class="empty"><div class="big">${icon('camera')}</div><h2>Akışın boş</h2>Birkaç kişiyi takip et ya da ilk gönderini paylaş.<p><a class="btn primary" href="#/create">Gönderi paylaş</a></p></div>`;
  } else {
    list.innerHTML = `<div class="section-t"><span>Akış</span></div>${posts.map(postCard).join('')}`;
    posts.forEach((p) => wirePost(list.querySelector(`[data-post="${p.id}"]`), p));
    offs.push(autoplay(list));
    list.insertAdjacentHTML('beforeend', `<div class="empty" style="padding:24px">Hepsini gördün. <a class="link" href="#/swipe">Yeni insanlarla tanış</a></div>`);
  }
  return () => offs.forEach((f) => f());
}

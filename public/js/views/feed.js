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
    <a class="wh-card-f" href="#/cark" hidden><img class="wf-ic" src="/img/wheel/gift.svg" alt=""><span class="grow"><b>Hediye çarkı hazır!</b><small>Bu haftaki çevirme hakkını kullan</small></span><span class="go-chip">Çevir</span></a>
    <a class="qs-card" href="#/gorevler" hidden></a>
    <a class="sg-feed" href="#/sarki" hidden></a>
    <a class="sg-feed ct-feed" href="#/yarismalar" hidden></a>
    <div class="event-slot"></div>
    <a class="fal-hero" href="#/fal" style="margin-top:0"><span class="zs">☕️</span><div class="grow"><b>${state.me.role === 'falci' ? `Fal kuyruğu${state.badges.fal ? ` · ${state.badges.fal} bekliyor` : ''}` : 'Falcı Teyze’ye fal baktır'}</b><p>${state.me.role === 'falci' ? 'Gelen fal isteklerini gör ve cevapla.' : 'Kahve falı, tarot, burç ve aşk uyumu. Cevabı mesaj kutuna gelir.'}</p></div>${icon('chevDown', '', 'style="transform:rotate(-90deg)"')}</a>
    <div class="social-row"><a class="genel-row feedg" href="#/genel"><span class="genel-ic">${icon('users')}</span><span class="grow"><b>Genel sohbet</b><small>Herkes burada</small></span></a>
      <a class="genel-row feedg rooms-e" href="#/odalar"><span class="genel-ic">🎵</span><span class="grow"><b>Odalar</b><small>Müzik, dizi, şehir…</small></span></a>
      <a class="genel-row feedg speed-e" href="#/hizli"><span class="genel-ic">⚡</span><span class="grow"><b>Hızlı tanış</b><small>3 dk görüntülü</small></span></a>
      <a class="genel-row feedg vn-e" href="#/mekan"><span class="genel-ic">📍</span><span class="grow"><b>Mekandayım</b><small>Aynı yerdekilerle eşleş</small></span></a></div>
    <div class="vn-friends"></div>
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

  let fresh = [];
  const pcard = (u, isNew) => `<div class="person-card">
        ${isNew ? '<span class="new">YENİ</span>' : ''}
        <a href="#/u/${esc(u.username)}" class="av-wrap" data-presence="${esc(u.id)}"><img class="av av-56" src="${esc(u.avatar)}" alt="">${isOn(u) ? '<i class="online"></i>' : ''}</a>
        <a href="#/u/${esc(u.username)}" class="n ellipsis">${nm(u)}</a>
        <span class="s ellipsis">${isOn(u) ? 'çevrimiçi' : '@' + esc(u.username)}</span>
        <button class="btn primary sm msg" data-id="${esc(u.id)}">Mesaj</button></div>`;
  const paintPeople = () => {
    const online = people.filter(isOn).slice(0, 20);
    if (!people.length && !fresh.length) {
      peopleEl.innerHTML = `<div class="push-card" style="background:var(--surface)">${icon('userPlus')}<div class="grow"><b>Arkadaşlarını davet et</b><p>Henüz başka üye yok. Bağlantıyı paylaş, kaydolan herkes burada görünür.</p></div><button class="btn primary sm inv">Paylaş</button></div>`;
      peopleEl.querySelector('.inv').onclick = async () => {
        const url = location.origin;
        if (navigator.share) navigator.share({ title: 'SwipeUp', text: 'SwipeUp’ta buluşalım!', url }).catch(() => {});
        else { await navigator.clipboard?.writeText(url); toast('Bağlantı kopyalandı.'); }
      };
      return;
    }
    // Çevrimiçi olanlar ve son 7 günde katılanlar (7 gün dolunca "Yeni üyeler"den çıkar)
    peopleEl.innerHTML = `${online.length ? `<div class="section-t"><span>Şu an çevrimiçi · ${online.length}</span><a href="#/search">Tümü</a></div><div class="people-row">${online.map((u) => pcard(u, false)).join('')}</div>` : ''}
      ${fresh.length ? `<div class="section-t"><span>Yeni üyeler</span><a href="#/search">Tümü</a></div><div class="people-row">${fresh.map((u) => pcard(u, true)).join('')}</div>` : ''}`;
  };
  peopleEl.addEventListener('click', (e) => {
    const b = e.target.closest('.msg'); if (b) openChatWith(b.dataset.id).catch((er) => toast(er.message));
  });

  const loadStories = async () => { stories = await api('/stories').catch(() => []); paintStories(); };
  const loadPeople = async () => { [people, fresh] = await Promise.all([api('/people').catch(() => []), api('/people?new=1').catch(() => [])]); paintPeople(); };

  offs.push(on('lives', paintStories));
  offs.push(on('presence', () => { paintStories(); paintPeople(); }));
  offs.push(on('stories:update', loadStories));
  offs.push(on('people:new', loadPeople));
  offs.push(on('reconnected', () => { loadStories(); loadPeople(); }));
  offs.push(on('badges', (b) => { view.querySelector('.nb').style.display = b.notifications ? '' : 'none'; }));
  offs.push(paintEventBanner(view.querySelector('.event-slot')));
  // Günlük görevler kartı
  const qsCard = view.querySelector('.qs-card');
  const paintQs = async () => {
    const q = await api('/quests').catch(() => null);
    if (!q?.enabled || state.me.role === 'falci' || (q.bonusClaimed && !q.claimable)) { qsCard.hidden = true; return; }
    qsCard.hidden = false;
    qsCard.innerHTML = `<span class="qc-ic">🎯</span><span class="grow"><b>Günlük görevler · ${q.doneCount}/${q.total}</b><small>${q.claimable ? `${q.claimable} ödül seni bekliyor!` : `Görevleri tamamla, ${q.items.reduce((a, x) => a + x.coins, 0) + q.bonus} jetona kadar kazan`}</small></span>
      <span class="qc-bar"><i style="width:${Math.round((q.doneCount / q.total) * 100)}%"></i></span>${q.claimable ? '<span class="go-chip">Al</span>' : ''}`;
  };
  paintQs();
  // Devam eden yarışma kartı
  api('/contests').then((r) => {
    const c = (r.items || []).find((x) => x.phase === 'live'); const a = view.querySelector('.ct-feed'); if (!c || !a) return;
    a.href = `#/yarismalar/${c.id}`;
    a.innerHTML = `<span class="sgf-ic" style="font-size:30px;display:grid;place-items:center">${esc(c.em)}</span><span class="grow"><b>${esc(c.title)}</b><small>${esc(c.metricLabel)}${c.me ? ` · ${c.me.rank}. sıradasın` : ''}</small></span><span class="go-chip">${c.me ? 'Sıralama' : 'Katıl'}</span>`;
    a.hidden = false;
  }).catch(() => {});
  // Arkadaşların şu an nerede (karşılıklı takip)
  api('/checkins/friends').then((list) => {
    const el2 = view.querySelector('.vn-friends'); if (!el2 || !list.length) return;
    el2.innerHTML = `<div class="section-t"><span>📍 Arkadaşların şu an</span><a href="#/mekan">Mekandayım</a></div><div class="vnf-row">${list.map((x) => `<a class="vnf" href="#/u/${esc(x.user.username)}"><img class="av av-40" src="${esc(x.user.avatar)}" alt=""><span class="grow"><b class="ellipsis">${esc(x.user.name)}</b><small class="ellipsis">${x.venue.em} ${esc(x.venue.name)}</small></span></a>`).join('')}</div>`;
  }).catch(() => {});
  api('/wheel').then((w) => { view.querySelector('.wh-card-f').hidden = !w.canSpin; }).catch(() => {});
  api('/songs/summary').then((r) => {
    const c = r.contest; const a = view.querySelector('.sg-feed'); if (!c || !a) return;
    const t = c.phase === 'submit' ? ['Şarkı yarışması başladı', r.mine ? 'Şarkın yarışmada · arkadaşlarına haber ver' : 'Şarkını yükle, kazanırsan Spotify’da yayınlayalım', 'Katıl']
      : c.phase === 'vote' ? ['Şarkı yarışmasında oylama', r.votesLeft ? `${r.votesLeft} oy hakkın var · ${c.entries} şarkı yarışıyor` : `${c.entries} şarkı yarışıyor`, 'Dinle']
        : c.phase === 'ended' && Date.now() - c.voteEnd < 14 * 86400000 ? ['Şarkı yarışması sonuçlandı', 'Kazanan şarkıyı dinle', 'Gör'] : null;
    if (!t) return;
    a.innerHTML = `<img class="sgf-ic" src="/img/songs/trophy.svg" alt=""><span class="grow"><b>${t[0]}</b><small>${t[1]}</small></span><span class="go-chip">${t[2]}</span>`;
    a.hidden = false;
  }).catch(() => {});
  offs.push(on('quests', paintQs));
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
    list.innerHTML = `<div class="empty"><div class="big">${icon('camera')}</div><h2>Akışın boş</h2>Akışında takip ettiğin kişilerin paylaşımları görünür. Birkaç kişiyi takip et ya da ilk gönderini paylaş.<p><a class="btn primary" href="#/search">Kişileri keşfet</a></p></div>`;
  } else {
    list.innerHTML = `<div class="section-t"><span>Akış</span></div>${posts.map(postCard).join('')}`;
    posts.forEach((p) => wirePost(list.querySelector(`[data-post="${p.id}"]`), p));
    offs.push(autoplay(list));
    list.insertAdjacentHTML('beforeend', `<div class="empty" style="padding:24px">Takip ettiklerinin paylaşımlarının hepsini gördün. <a class="link" href="#/search">Yeni kişiler keşfet</a></div>`);
  }
  return () => offs.forEach((f) => f());
}

import { icon } from '../icons.js';
import {
  state, api, esc, num, avatar, sheet, toast, openChatWith, saved, enablePush, disablePush, pushEnabled, pushHint, blockUser, reportUser, unmatchUser, lastSeen, isOn, SKINS, applySkin, currentSkin, nm, richText,
} from '../core.js';
import { gridTile } from '../components.js';
import { voiceChip, promptCards, promptReply, superMessage, profileCard } from '../extras.js';
import { shareSheet } from '../core.js';
import { eventOn, eventInfo, eventEmoji, eventLive, setEventEnabled, eventIcon } from '../event.js';
import { pickMusic } from '../music.js';
import { egi } from '../eg-icons.js';
import { hlRowHtml, wireHlRow } from '../insta.js';

// "Şu an dinlediğim": aynı şarkıyı ve aynı sanatçıyı dinleyenler
function npSheet(uid) {
  sheet('Aynı şarkıyı dinleyenler', '<div class="np-l"><div class="spinner"></div></div>', {
    async onMount(sh) {
      const box = sh.querySelector('.np-l');
      try {
        const r = await api(`/now-playing/${uid}`);
        if (!r.nowPlaying) { box.innerHTML = '<div class="empty">Şu an bir şarkı paylaşılmıyor.</div>'; return; }
        const t = r.nowPlaying;
        const row = (x, sub) => `<a class="list-item" href="#/u/${esc(x.username)}">${avatar(x, 44)}<div class="grow"><div class="b">${nm(x)}</div><div class="sub">${esc(sub)}</div></div></a>`;
        box.innerHTML = `<div class="np-card big">${t.cover ? `<img src="${esc(t.cover)}" alt="">` : egi('dinle', 42)}<div class="grow"><b>${esc(t.title)}</b><small>${esc(t.artist)}</small></div>${t.spotifyUrl ? `<a class="btn sm" href="${esc(t.spotifyUrl)}" target="_blank" rel="noopener">Spotify</a>` : ''}</div>
          <div class="section-t"><span>${r.same.length ? `Bu şarkıyı dinleyen ${r.same.length} kişi` : 'Şu an bu şarkıyı başka dinleyen yok'}</span></div>
          ${r.same.map((x) => row(x, `@${x.username}`)).join('')}
          ${r.artist.length ? `<div class="section-t"><span>${esc(t.artist)} dinleyenler</span></div>${r.artist.map((x) => row(x, `🎵 ${x.track}`)).join('')}` : ''}`;
      } catch (er) { box.innerHTML = `<div class="empty">${esc(er.message)}</div>`; }
    },
  });
}
async function setNowPlaying(view, rerender) {
  const t = await pickMusic({ allowFile: false });
  if (!t?.src) return;
  try {
    const r = await api('/me/now-playing', { method: 'PUT', body: { track: t } });
    state.me.nowPlaying = r.nowPlaying;
    toast(r.same ? `Şu an ${r.same} kişi daha bu şarkıyı dinliyor!` : 'Profilinde 12 saat görünecek.');
    rerender();
  } catch (er) { toast(er.message); }
}

export function themeMenu() {
  const mode = localStorage.getItem('su_theme') || 'system';
  const cur = currentSkin();
  const evOpt = eventLive() ? `<button class="skin-opt ev ${eventOn() ? 'on' : ''}" data-ev="1"><span class="pv ev-pv">${eventIcon() || eventEmoji()}</span><b>${esc(eventInfo().name)}</b><span>Etkinlik teması · sınırlı süre</span></button>` : '';
  const evOnNow = eventOn();
  sheet('Tema', `${eventLive() ? `<p class="ev-note">${eventEmoji()} Başka bir tema seçersen <b>${esc(eventInfo().name)}</b> teması kapanır ve seçtiğin tema hemen uygulanır.</p>` : ''}<div class="skin-grid">${evOpt}${SKINS.map((k) => `<button class="skin-opt ${cur === k.id && !evOnNow ? 'on' : ''}" data-s="${k.id}">
      <span class="pv" style="background:${k.pv}"><i style="background:${k.a}"></i><i style="background:${k.a}"></i></span>
      <b>${esc(k.name)}</b><span>${esc(k.note)}</span></button>`).join('')}</div>
    <div class="mode" ${cur === 'gunbatimi' ? '' : 'hidden'}><div class="group-t" style="padding-left:16px">Gün batımı modu</div>
    <div class="menu">${[['system', 'Sistem ayarı', 'settings'], ['light', 'Açık', 'sun'], ['dark', 'Koyu', 'eye']].map(([k, l, ic]) => `<button data-t="${k}">${icon(ic)}<span class="grow">${l}</span>${mode === k ? icon('check') : ''}</button>`).join('')}</div></div>`, {
    onMount(sh, close) {
      sh.querySelector('.skin-grid').onclick = (e) => {
        const evb = e.target.closest('[data-ev]');
        if (evb) { setEventEnabled(true); sh.querySelectorAll('.skin-opt').forEach((x) => x.classList.toggle('on', x === evb)); sh.querySelector('.mode').hidden = true; return; }
        const b = e.target.closest('[data-s]'); if (!b) return;
        // Etkinlik teması açıksa kapat ki seçilen tema tamamen uygulansın (sadece logo değil)
        if (eventOn()) setEventEnabled(false);
        const id = applySkin(b.dataset.s);
        sh.querySelectorAll('.skin-opt').forEach((x) => x.classList.toggle('on', x === b));
        sh.querySelector('.mode').hidden = id !== 'gunbatimi';
        api('/me', { method: 'PATCH', body: { skin: id } }).then((u) => { state.me.skin = u.skin; }).catch(() => {});
      };
      sh.querySelector('.mode .menu').onclick = (e) => {
        const t = e.target.closest('[data-t]')?.dataset.t; if (!t) return;
        if (eventOn()) setEventEnabled(false);
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
    <label class="switch-row" style="display:flex;align-items:center;font-size:14.5px"><span class="grow">Falcı Teyze’den sabah burç mesajı<small class="muted" style="display:block;font-size:12.5px">Her sabah burcuna özel kısa bir yorum</small></span><input type="checkbox" class="bp" ${state.me.privacy?.noBurcPush ? '' : 'checked'}></label>
  </div>`, {
    onMount(sh, close) {
      sh.querySelector('.tg')?.addEventListener('click', async () => {
        try { if (enabled) { await disablePush(); toast('Bildirimler kapatıldı.'); } else { await enablePush(); toast('Bildirimler açıldı.'); } close(); } catch (e) { toast(e.message); }
      });
      sh.querySelector('.bp').onchange = async (e) => {
        try { const u = await api('/me', { method: 'PATCH', body: { privacy: { noBurcPush: !e.target.checked } } }); Object.assign(state.me, u); toast(e.target.checked ? 'Sabah burç mesajı açık ☀️' : 'Sabah burç mesajı kapatıldı.'); } catch (er) { toast(er.message); }
      };
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
      sh.querySelector('.pl').innerHTML = us.length ? us.map((u) => `<a class="list-item" href="#/u/${esc(u.username)}">${avatar(u, 44)}<div><div class="b">${nm(u)}</div><div class="sub">@${esc(u.username)}</div></div></a>`).join('')
        : '<div class="empty">Henüz kimse yok ya da hesap gizli.</div>';
    },
  });
}

// Profil QR kodu: tara, kaydet, paylaş (Instagram'daki gibi)
function qrSheet(u) {
  const src = `/qr/${encodeURIComponent(u.username)}.svg?c=1a1027`;
  const canScan = 'BarcodeDetector' in window && navigator.mediaDevices?.getUserMedia;
  sheet(null, `<div class="qr-wrap"><div class="qr-card"><img class="qr-av" src="${esc(u.avatar)}" alt=""><img class="qr-img" src="${src}" alt="QR kod"><b>@${esc(u.username)}</b><small>SwipeUp’ta beni bul</small></div>
    <div class="qr-act"><button class="btn sv">${icon('download')} Kaydet</button><button class="btn sh">${icon('share')} Paylaş</button>${canScan ? `<button class="btn sc">${icon('scan')} QR tara</button>` : ''}</div>
    <p class="muted qr-note">Arkadaşın telefon kamerasıyla bu kodu okutunca profilin açılır.</p></div>`, {
    onMount(sh, close) {
      const toPng = async () => {
        const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const g = c.getContext('2d');
        const grad = g.createLinearGradient(0, 0, 1080, 1350); grad.addColorStop(0, '#ff8a3d'); grad.addColorStop(0.55, '#ff3d6e'); grad.addColorStop(1, '#a24bff');
        g.fillStyle = grad; g.fillRect(0, 0, 1080, 1350);
        g.fillStyle = '#fff'; g.beginPath(); g.roundRect(140, 200, 800, 920, 64); g.fill();
        const load = (s) => new Promise((ok, no) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = no; i.src = s; });
        const q = await load(src); g.drawImage(q, 240, 330, 600, 600);
        g.fillStyle = '#1a1027'; g.font = '800 58px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(`@${u.username}`, 540, 1010);
        g.fillStyle = '#6c6c75'; g.font = '500 36px system-ui, sans-serif'; g.fillText('SwipeUp’ta beni bul', 540, 1066);
        return new Promise((ok) => c.toBlob(ok, 'image/png'));
      };
      sh.querySelector('.sv').onclick = async () => {
        try { const b = await toPng(); const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(b), download: `swipeup-${u.username}-qr.png` }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); } catch { toast('Kaydedilemedi.'); }
      };
      sh.querySelector('.sh').onclick = async () => {
        const url = `${location.origin}/#/u/${u.username}`;
        try { const b = await toPng(); const f = new File([b], 'swipeup-qr.png', { type: 'image/png' }); if (navigator.canShare?.({ files: [f] })) return await navigator.share({ files: [f], title: 'SwipeUp', text: url }); } catch (e) { if (e?.name === 'AbortError') return; }
        try { await navigator.clipboard.writeText(url); toast('Profil bağlantısı kopyalandı.'); } catch { toast(url); }
      };
      sh.querySelector('.sc')?.addEventListener('click', () => { close(); scanQr(); });
    },
  });
}
async function scanQr() {
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); } catch { return toast('Kamera izni verilmedi.'); }
  const det = new window.BarcodeDetector({ formats: ['qr_code'] });
  let done = false; let raf = 0;
  const closeS = sheet('QR tara', '<div class="qr-scan"><video playsinline muted autoplay></video><i class="qr-frame"></i><p class="muted">Bir SwipeUp QR kodunu çerçeveye getir</p></div>', {
    onClose() { done = true; cancelAnimationFrame(raf); stream.getTracks().forEach((t) => t.stop()); },
  });
  const v = document.querySelector('.qr-scan video'); v.srcObject = stream;
  const tick = async () => {
    if (done) return;
    try {
      const r = await det.detect(v);
      const hit = r.map((x) => x.rawValue).find((x) => /#\/u\/[\w.]+/.test(x));
      if (hit) { done = true; closeS(); location.hash = hit.slice(hit.indexOf('#')); return; }
    } catch {}
    raf = requestAnimationFrame(tick);
  };
  v.onplaying = tick;
}

export default async function profile(view, username) {
  const self = !username || username === state.me.username;
  view.innerHTML = '<div class="spinner" style="margin-top:40vh"></div>';
  const u = await api(`/users/${self ? state.me.id : encodeURIComponent(username)}`);
  if (self) Object.assign(state.me, u);
  const posts = u.posts.filter((p) => p.type === 'image' || p.type === 'text');
  const reels = u.posts.filter((p) => p.type === 'reel');
  const reposts = u.reposts || [];
  const tagged = u.tagged || [];
  const tabs = self ? ['grid', 'reels', 'reposts', 'tagged', 'saved'] : ['grid', 'reels', 'reposts', 'tagged'];
  const TAB = { grid: ['grid', 'Gönderiler'], reels: ['reels', 'Vitrin'], reposts: ['repost', 'Yeniden paylaşılanlar'], tagged: ['tagged', 'Etiketlendiği gönderiler'], saved: ['bookmark', 'Kaydedilenler'] };
  const avHref = u.live ? `#/live/${u.id}` : u.hasStory ? `#/stories/${u.id}` : self ? '#/create/story' : null;
  const meta = [self && u.ageHidden && u.age ? `${u.age} · gizli` : u.age, u.city, !self && u.distanceKm ? `${u.distanceKm} km` : null].filter(Boolean);

  view.innerHTML = `<header class="topbar">
      ${self ? `<a class="ib soft" href="#/create" aria-label="Oluştur">${icon('plus')}</a>` : `<button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/')" aria-label="Geri">${icon('back')}</button>`}
      <div class="center ig-un">${u.privacy?.private ? `${icon('lock', '', 'style="width:15px;height:15px;vertical-align:-2px"')} ` : ''}${esc(u.username)}</div>
      ${self ? `<a class="ib soft" href="#/settings" aria-label="Ayarlar">${icon('menu')}</a>` : `<button class="ib soft menu-btn" aria-label="Seçenekler">${icon('more')}</button>`}
    </header>
    <section class="ig-hero">
      <div class="ig-top">
        <${avHref ? `a href="${esc(avHref)}"` : 'div'} class="av-wrap ${u.frame ? `fr fr-${esc(u.frame)}` : ''}">
          ${u.live || u.hasStory ? `<div class="ring ${u.live ? 'live' : ''}"><img class="av" src="${esc(u.avatar)}" alt=""></div>` : `<img class="av" src="${esc(u.avatar)}" alt="">`}
          ${u.live ? '<span class="live-tag">CANLI</span>' : self && !u.hasStory ? `<span class="plus">${icon('plus')}</span>` : (!self && isOn(u) ? '<i class="online"></i>' : '')}
        </${avHref ? 'a' : 'div'}>
        <div class="ig-stats">
          <div><b>${num(u.postCount ?? u.posts.length)}</b><span>gönderi</span></div>
          <button class="fl"><b>${num(u.followers)}</b><span>takipçi</span></button>
          <button class="fg"><b>${num(u.following)}</b><span>takip</span></button>
        </div>
      </div>
      <div class="ig-info">
        <h2>${nm(u)}${u.plus ? `<span class="plus-chip">${icon('crown')}+</span>` : ''}${u.level ? `<${self ? 'a href="#/seviye"' : 'span'} class="lvl-chip" title="${esc(u.level.title)}">${u.level.em} Sv. ${u.level.n}</${self ? 'a' : 'span'}>` : ''}</h2>
        ${u.role === 'falci' || u.role === 'official' || (u.tags || []).length || (u.badges || []).length ? `<div class="utags">
          ${u.role === 'falci' ? '<span class="chip uv">🔮 Falcı</span>' : ''}${u.role === 'official' ? '<span class="chip official">🛡️ SwipeUp resmi hesabı</span>' : ''}
          ${(u.tags || []).map((t) => `<span class="utag t-${esc(t.color)}">${t.em} ${esc(t.name)}</span>`).join('')}
          ${(u.badges || []).filter((b) => self || !b.hidden).map((b) => `<span class="badge ${b.hidden ? 'off' : ''}" title="${esc(b.name)}">${b.em} ${esc(b.name)}</span>`).join('')}</div>` : ''}
        ${!self && lastSeen(u) ? `<div class="handle">${esc(lastSeen(u))}</div>` : ''}
        ${u.checkin ? `<a class="ci-chip" href="${self ? '#/mekan' : '#/u/' + esc(u.username)}"><span>${u.checkin.em}</span><span>Şu an</span> <b>${esc(u.checkin.name)}</b></a>` : ''}
        ${u.bio ? `<p class="bio">${richText(u.bio)}</p>` : (self ? '<a class="link" href="#/edit">Biyografi ekle</a>' : '')}
        ${u.voice ? `<div style="margin-top:8px">${voiceChip(u.voice)}</div>` : ''}
        ${u.nowPlaying && u.nowPlaying.until > Date.now() ? `<button class="np-card np-open"><span class="np-eq"><i></i><i></i><i></i></span>${u.nowPlaying.cover ? `<img src="${esc(u.nowPlaying.cover)}" alt="">` : ''}<span class="grow"><small>Şu an dinliyor</small><b class="ellipsis">${esc(u.nowPlaying.title)}</b><small class="ellipsis">${esc(u.nowPlaying.artist)}</small></span>${self ? '<span class="np-x" role="button" aria-label="Kaldır">✕</span>' : '<span class="go-chip">Kimler dinliyor?</span>'}</button>`
    : self && !['falci', 'official'].includes(u.role) ? `<button class="np-add">${egi('dinle', 22)} Şu an ne dinliyorsun? Ekle</button>` : ''}
        ${meta.length || u.interests?.length || (!self && (u.followsYou || u.matched)) ? `<div class="chips">
          ${meta.map((m) => `<span class="chip">${esc(m)}</span>`).join('')}
          ${(u.interests || []).map((t) => `<span class="chip uv">${esc(t)}</span>`).join('')}
          ${!self && u.matched ? '<span class="chip uv">💜 Eşleştiniz</span>' : !self && u.followsYou ? '<span class="chip">Seni takip ediyor</span>' : ''}
        </div>` : ''}
      </div>
    </section>
    <div class="profile-btns">
      ${self
    ? `<a class="btn" href="#/edit">Profili düzenle</a><button class="btn share">Profili paylaş</button>${u.verified ? '' : `<a class="btn sq" href="#/verify" aria-label="Profilini doğrula">${icon('shield', '', 'style="width:18px;height:18px"')}</a>`}`
    : u.blockedByMe
      ? '<button class="btn primary unb">Engeli kaldır</button>'
      : u.role === 'falci'
        ? `<button class="btn ${u.isFollowing ? '' : 'primary'} follow">${u.isFollowing ? 'Takiptesin' : 'Takip et'}</button><a class="btn" href="#/fal">🔮 Fal baktır</a>`
        : `<button class="btn ${u.isFollowing || u.requested ? '' : 'primary'} follow">${u.isFollowing ? 'Takiptesin' : u.requested ? 'İstek gönderildi' : (u.followsYou ? 'Sen de takip et' : 'Takip et')}</button>${u.role === 'official' ? '<a class="btn fal-go" href="#/destek">🎧 Destek</a>' : state.me.role === 'falci' ? '' : `<button class="btn msg">Mesaj</button>`}${u.matched || ['falci', 'official'].includes(u.role) || ['falci', 'official'].includes(state.me.role) ? '' : '<button class="btn sq smsg" aria-label="Süper mesaj" title="Süper mesaj">💌</button>'}`}
    </div>
    ${u.locked || u.blockedByMe ? '' : hlRowHtml(u.highlights, self)}
    ${(u.prompts || []).length ? `<div class="pqs">${promptCards(u, { reply: !self && !u.blockedByMe })}</div>` : self ? '<a class="pq-cta" href="#/edit">💬 Profil sorularını cevapla, sohbetler kendiliğinden başlasın</a>' : ''}
    ${self ? `<div class="me-links">
      <a href="#/ziyaretciler">${icon('eye')}<span>Ziyaretçiler</span><b class="vc" hidden></b></a>
      <a href="#/gorunum">${icon('crown')}<span>Çerçeve</span></a>
      <a href="#/davet">${icon('gift')}<span>Davet et</span></a>
      <a href="#/seriler">${egi('seri', 24)}<span>Seriler</span><b>${u.loginStreak?.count || ''}</b></a></div>` : ''}
    <div class="tabs ig-tabs">
      ${tabs.map((t, i) => `<button data-t="${t}" class="${i ? '' : 'on'}" aria-label="${TAB[t][1]}" title="${TAB[t][1]}">${icon(TAB[t][0])}</button>`).join('')}
    </div>
    <div class="tab-body"></div>`;

  const body = view.querySelector('.tab-body');
  const showTab = async (t) => {
    if (u.locked && t !== 'saved') {
      body.innerHTML = `<div class="empty" style="padding-top:28px"><div class="big">${icon('lock')}</div><h2>Bu hesap gizli</h2>Gönderilerini ve hikayelerini görmek için takip et.</div>`;
      return;
    }
    view.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
    let items = { grid: posts, reels, reposts, tagged }[t] || [];
    if (t === 'saved') {
      body.innerHTML = '<div class="spinner"></div>';
      items = (await Promise.all(saved.all().slice(0, 30).map((id) => api(`/posts/${id}`).catch(() => null)))).filter(Boolean);
    }
    if (!items.length) {
      const msg = {
        grid: self ? ['Fotoğraf paylaş', 'Paylaştığın fotoğraflar profilinde görünür.', '#/create', 'İlk fotoğrafını paylaş'] : ['Henüz gönderi yok', '', '', ''],
        reels: self ? ['Vitrinine video ekle', 'Kısa dikey videoların burada görünür.', '#/create/reel', 'Video ekle'] : ['Vitrinde henüz video yok', '', '', ''],
        saved: ['Kaydedilenler', 'Kaydettiğin gönderiler sadece sana görünür.', '', ''],
        reposts: self ? ['Yeniden paylaşılanlar', 'Beğendiğin gönderileri ve vitrin videolarını yeniden paylaş; burada görünür.', '', ''] : ['Henüz yeniden paylaşım yok', '', '', ''],
        tagged: self ? ['Senin fotoğrafların', 'Birisi seni bir gönderide etiketlediğinde burada görünür.', '', ''] : ['Etiketlendiği gönderi yok', '', '', ''],
      }[t];
      body.innerHTML = `<div class="empty" style="padding-top:28px"><div class="big ig-ring">${icon({ grid: 'camera', reels: 'reels', saved: 'bookmark', reposts: 'repost', tagged: 'tagged' }[t])}</div><h2>${msg[0]}</h2>${msg[1]}${msg[2] ? `<p><a class="btn primary" href="${msg[2]}">${msg[3]}</a></p>` : ''}</div>`;
      return;
    }
    body.innerHTML = `<div class="grid ig-grid">${items.map(gridTile).join('')}</div>`;
  };
  view.querySelector('.tabs').onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) showTab(b.dataset.t); };
  showTab('grid');

  wireHlRow(view, { self, reload: () => profile(view, username) });
  view.querySelector('.fl').onclick = () => peopleSheet('Takipçiler', u.id, 'followers');
  view.querySelector('.np-add')?.addEventListener('click', () => setNowPlaying(view, () => profile(view, username)));
  view.querySelector('.np-open')?.addEventListener('click', async (e) => {
    if (e.target.closest('.np-x')) { await api('/me/now-playing', { method: 'DELETE' }).catch(() => {}); profile(view, username); return; }
    npSheet(u.id);
  });
  view.querySelector('.fg').onclick = () => peopleSheet('Takip edilenler', u.id, 'following');

  const share = () => shareSheet({
    ref: { kind: 'profile', id: u.id }, url: `${location.origin}/#/u/${u.username}`, title: `${u.name} (@${u.username})`,
    text: self ? 'SwipeUp’ta beni bul 💘' : `${u.name} SwipeUp’ta`,
    extra: [['qr', 'QR kod', 'c-qr', () => qrSheet(u)], ['image', 'Profil kartı', 'c-card', () => { toast('Kart hazırlanıyor…', { ms: 1500 }); profileCard(u).catch((er) => toast(er.message)); }]],
  });
  view.querySelector('.share')?.addEventListener('click', share);
  view.querySelector('.smsg')?.addEventListener('click', () => superMessage(u));
  view.querySelector('.pqs')?.addEventListener('click', (e) => { const b = e.target.closest('.pq-r'); if (b) promptReply(u, b.closest('[data-pid]').dataset.pid); });
  if (!self) api(`/users/${u.id}/view`, { body: {} }).catch(() => {});
  if (self) api('/me/viewers').then((r) => { const b = view.querySelector('.me-links .vc'); if (b && r.fresh) { b.textContent = r.fresh; b.hidden = false; } }).catch(() => {});
  view.querySelector('.unb')?.addEventListener('click', async () => {
    await api(`/users/${u.id}/block`, { method: 'DELETE' }); toast('Engel kaldırıldı.'); profile(view, username);
  });

  const fb = view.querySelector('.follow');
  if (fb) fb.onclick = async () => {
    try {
      const was = u.isFollowing;
      const r = await api(`/users/${u.id}/follow`, { body: {} });
      u.isFollowing = r.following; u.requested = !!r.requested;
      fb.textContent = r.following ? 'Takiptesin' : r.requested ? 'İstek gönderildi' : 'Takip et';
      fb.classList.toggle('primary', !r.following && !r.requested);
      if (r.requested) toast('Takip isteği gönderildi.');
      if (was !== r.following) view.querySelector('.fl b').textContent = num((u.followers += r.following ? 1 : -1));
      if (u.locked && r.following) profile(view, username);
    } catch (e) { toast(e.message); }
  };
  view.querySelector('.msg')?.addEventListener('click', () => openChatWith(u.id).catch((e) => toast(e.message)));

  view.querySelector('.menu-btn')?.addEventListener('click', () => {
    const items = [['share', 'share', 'Profili paylaş']];
    if (!u.matched && !u.blockedByMe && !['falci', 'official'].includes(u.role)) items.push(['send', 'smsg', 'Süper mesaj gönder']);
    if (u.matched) items.push(['x', 'unmatch', 'Eşleşmeyi kaldır']);
    if (!u.blockedByMe) items.push(['block', 'block', 'Engelle'], ['flag', 'report', 'Şikayet et']);
    sheet(null, `<div class="menu">${items.map(([ic, a, l]) => `<button data-a="${a}" class="${['block', 'report', 'unmatch'].includes(a) ? 'danger' : ''}">${icon(ic)}${l}</button>`).join('')}</div>`, {
      onMount(sh, close) {
        sh.querySelector('.menu').onclick = async (e) => {
          const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
          close();
          if (a === 'share') share();
          if (a === 'smsg') superMessage(u);
          if (a === 'unmatch' && await unmatchUser(u)) profile(view, username);
          if (a === 'block' && await blockUser(u)) profile(view, username);
          if (a === 'report') reportUser(u);
        };
      },
    });
  });
  return null;
}

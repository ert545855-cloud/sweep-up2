import { icon } from './icons.js';
import { postPollHtml, wirePostPoll, postInsights } from './insta.js';
import {
  esc, ago, num, avatar, reportUser, toggleLike, heartBurst, onDoubleTap, openComments, sharePost, saved, sheet, api, toast, state, isVideo,
  nm, richText, filterCss,
} from './core.js';

const itemsOf = (p) => p.items || [{ media: p.media, type: p.type === 'reel' || isVideo(p.media) ? 'video' : 'image', poster: p.poster }];
function oneMedia(it, p, edit) {
  const f = filterCss(edit?.filter || it.filter);
  const st = f !== 'none' ? ` style="filter:${f}"` : '';
  return it.type === 'video'
    ? `<video src="${esc(it.media)}" ${it.poster ? `poster="${esc(it.poster)}"` : ''} muted loop playsinline preload="metadata"${st}></video>`
    : `<img src="${esc(it.media)}" alt="${esc(p.caption || 'Gönderi')}" loading="lazy"${st}>`;
}
// Gönderideki videolar (Instagram gibi): sessiz başlar, köşedeki düğme ya da tek dokunuş sesi açar; tercih vitrinle ortak
const sndBtn = (items) => (items.some((it) => it.type === 'video') ? `<button type="button" class="pm-snd" aria-label="Sesi aç/kapat">${icon(state.muted ? 'mute' : 'volume')}</button>` : '');
export function mediaHtml(p) {
  const items = itemsOf(p);
  if (items.length === 1) return oneMedia(items[0], p, p.edit) + (p.type === 'reel' ? '' : sndBtn(items));
  return `<div class="car"><div class="car-track">${items.map((it) => `<div class="car-cell${it.type === 'video' ? ' is-v' : ''}">${oneMedia(it, p)}</div>`).join('')}</div>
    <span class="car-n">1/${items.length}</span><div class="car-dots">${items.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div></div>${sndBtn(items)}`;
}
// Ses tercihini sayfadaki bütün gönderi videolarına uygula
export function setFeedSound(muted) {
  state.muted = muted;
  document.querySelectorAll('.post-media video').forEach((v) => { v.muted = muted; });
  document.querySelectorAll('.pm-snd').forEach((b) => { b.innerHTML = icon(muted ? 'mute' : 'volume'); });
}
// Gönderi kutusunu ilk medyanın oranına göre ayarla (kırpmadan sığdır; 4:5 ile 1.91:1 arası)
export function fitMedia(box) {
  const first = box.querySelector('img, video');
  if (!first) return;
  const set = (w, h) => {
    if (!w || !h) return;
    const r = Math.max(0.8, Math.min(1.91, w / h));
    box.style.aspectRatio = String(r);
  };
  if (first.tagName === 'IMG') {
    if (first.complete && first.naturalWidth) set(first.naturalWidth, first.naturalHeight);
    else first.addEventListener('load', () => set(first.naturalWidth, first.naturalHeight), { once: true });
  } else first.addEventListener('loadedmetadata', () => set(first.videoWidth, first.videoHeight), { once: true });
}
export function wireCarousel(root) {
  const tr = root.querySelector('.car-track');
  if (!tr) return;
  const dots = [...root.querySelectorAll('.car-dots i')];
  const n = root.querySelector('.car-n');
  tr.addEventListener('scroll', () => {
    const i = Math.round(tr.scrollLeft / tr.clientWidth);
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
    if (n) n.textContent = `${i + 1}/${dots.length}`;
  }, { passive: true });
}

// Vitrin videosu düzenlemesi (kırpma, hız, filtre, müzik) oynatma sırasında uygulanır
export function applyEdit(v, edit) {
  if (!v || !edit) return () => {};
  const start = edit.start || 0;
  const end = edit.end || null;
  v.playbackRate = edit.speed || 1;
  v.defaultPlaybackRate = edit.speed || 1;
  const f = filterCss(edit.filter);
  if (f !== 'none') v.style.filter = f;
  let au = null;
  const force = !!(edit.audio && edit.muteOriginal);
  let wantSound = !v.muted; let fixing = false;
  if (edit.audio) { au = new Audio(edit.audio); au.loop = true; au.preload = 'auto'; au.muted = !wantSound; }
  const onVol = () => {
    if (fixing) { fixing = false; return; }
    wantSound = !v.muted;
    if (au) au.muted = !wantSound;
    if (force && !v.muted) { fixing = true; v.muted = true; }
  };
  const onMeta = () => { if (start && v.currentTime < start) v.currentTime = start; };
  const onTime = () => {
    if ((end && v.currentTime >= end) || v.currentTime < start - 0.3) { v.currentTime = start; if (au) au.currentTime = 0; }
  };
  const onPlay = () => { v.playbackRate = edit.speed || 1; if (au) { au.muted = !wantSound; au.play().catch(() => {}); } };
  const onPause = () => au?.pause();
  v.addEventListener('loadedmetadata', onMeta); v.addEventListener('timeupdate', onTime);
  v.addEventListener('play', onPlay); v.addEventListener('pause', onPause); v.addEventListener('volumechange', onVol);
  if (force && !v.muted) { fixing = true; v.muted = true; }
  if (v.readyState >= 1) onMeta();
  return () => { au?.pause(); if (au) au.src = ''; };
}

// Yazı gönderisi arka planları
export const TEXT_BGS = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8'];
const tsize = (t) => (t.length < 60 ? 'xl' : t.length < 140 ? 'l' : t.length < 320 ? 'm' : 's');
export const textCard = (p) => `<div class="tpost tbg-${esc(p.bg || 'g1')}"><div class="tp-t ${tsize(p.caption || '')}">${richText(p.caption || '')}</div></div>`;
// Vitrin videosu / hikaye üstündeki çıkartmalar (emoji, GIF, yazı)
export function overlayHtml(list = []) {
  if (!list?.length) return '';
  return `<div class="ovl">${list.map((st) => {
    const tr = `left:${st.x}%;top:${st.y}%;transform:translate(-50%,-50%) rotate(${st.r || 0}deg) scale(${st.s || 1})`;
    if (st.type === 'emoji') return `<span class="ov em" style="${tr}">${esc(st.em)}</span>`;
    if (st.type === 'gif') return `<img class="ov gif" style="${tr}" src="${esc(st.src)}" alt="" loading="lazy">`;
    if (st.type === 'text') return `<span class="ov tx ${st.bgc ? 'bgc' : ''}" style="${tr};color:${esc(st.color || '#fff')}">${esc(st.text)}</span>`;
    return '';
  }).join('')}</div>`;
}
// Uzun yazılar: birkaç satır görünür, "devamı" ile açılır
// Instagram gibi: ilk iki satır / ~110 karakter görünür, devamı aynı satırda "… devamı" ile açılır
const CAP_MAX = 110;
function capCut(text) {
  let cut = text.split('\n').slice(0, 2).join('\n');
  if (cut.length > CAP_MAX) { cut = cut.slice(0, CAP_MAX); const sp = cut.lastIndexOf(' '); if (sp > CAP_MAX * 0.6) cut = cut.slice(0, sp); }
  if (cut.length >= text.trimEnd().length) return null;
  return cut.replace(/[\s.,;:!?…-]+$/u, '');
}
export function capHtml(p, withUser = true, { full = false } = {}) {
  if (!p.caption) return '';
  const cut = full ? null : capCut(p.caption);
  const user = withUser ? `<a class="cu" href="#/u/${esc(p.user.username)}">${esc(p.user.username)}</a> ` : '';
  return `<div class="cap-w"><div class="cap">${user}<span class="cap-s">${richText(cut ?? p.caption)}</span>${cut != null ? `<span class="cap-dots">… </span><button type="button" class="cap-more">devamı</button><template>${richText(p.caption)}</template>` : ''}</div></div>`;
}
export function wireCaption(root) {
  root.querySelectorAll('.cap-w').forEach((w) => {
    const b = w.querySelector('.cap-more'); if (!b) return;
    const open = () => { const t = w.querySelector('template'); w.querySelector('.cap-s').innerHTML = t.innerHTML; t.remove(); w.querySelector('.cap-dots')?.remove(); b.remove(); };
    b.onclick = (e) => { e.stopPropagation(); open(); };
    w.querySelector('.cap').addEventListener('click', (e) => { if (e.target.closest('a') || !w.querySelector('.cap-more')) return; open(); });
  });
}

export function postCard(p, { full = false } = {}) {
  const text = p.type === 'text';
  const canRepost = p.user.id !== state.me.id && !p.user.private;
  return `<article class="post pt-${esc(p.type)}" data-post="${esc(p.id)}">
    ${p.repostedBy ? `<a class="rp-by" href="#/u/${esc(p.repostedBy.username)}">${icon('repost')}<span><b>${esc(p.repostedBy.username)}</b> yeniden paylaştı</span></a>` : ''}
    <header class="post-h">
      <a href="#/u/${esc(p.user.username)}" class="row grow" style="gap:10px">${avatar(p.user, 32, { ring: true })}
        <span class="grow" style="line-height:1.25"><span class="u ellipsis" style="display:block">${nm(p.user, 'username')}</span>${p.sponsored ? '<span class="muted" style="font-size:12.5px"><span class="spons">Sponsorlu</span></span>' : ''}</span></a>
      <button class="more" aria-label="Diğer seçenekler">${icon('more')}</button>
    </header>
    <div class="post-media ${text ? 'is-text' : ''}">${text ? textCard(p) : mediaHtml(p)}${p.type === 'reel' ? overlayHtml(p.edit?.stickers) : ''}</div>
    ${p.poll ? postPollHtml(p) : ''}
    <div class="post-actions">
      <button class="like ${p.liked ? 'liked' : ''}" aria-label="Beğen">${icon('heart')}<span class="cnt">${p.likeCount ? num(p.likeCount) : ''}</span></button>
      <button class="cm" aria-label="Yorum yap">${icon('comment')}<span>${p.commentCount ? num(p.commentCount) : ''}</span></button>
      ${canRepost ? `<button class="rp ${p.reposted ? 'on' : ''}" aria-label="Yeniden paylaş">${icon('repost')}<span class="cnt">${p.repostCount ? num(p.repostCount) : ''}</span></button>` : ''}
      <button class="sh" aria-label="Paylaş">${icon('send')}</button>
      <span class="sp"></span>
      <button class="sv" aria-label="Kaydet">${icon('bookmark', '', saved.has(p.id) ? 'fill="currentColor"' : '')}</button>
    </div>
    <div class="post-body">
      ${text ? '' : capHtml(p, true, { full })}
      ${p.commentCount ? `<button class="muted cm2" style="text-align:left">${p.commentCount} yorumun tümünü gör</button>` : ''}
      <span class="when">${ago(p.repostAt || p.createdAt)}</span>
    </div>
  </article>`;
}
// Yeniden paylaş / geri al
export async function toggleRepost(p, btn) {
  try {
    const r = await api(`/posts/${p.id}/repost`, { body: { on: !p.reposted } });
    p.reposted = r.reposted; p.repostCount = r.repostCount;
    if (btn) { btn.classList.toggle('on', r.reposted); const c = btn.querySelector('.cnt'); if (c) c.textContent = r.repostCount ? num(r.repostCount) : ''; }
    toast(r.reposted ? 'Yeniden paylaşıldı; takipçilerinin akışında görünecek.' : 'Yeniden paylaşım geri alındı.');
  } catch (e) { toast(e.message); }
}

export const promoHit = (p) => { if (p?.sponsored) api(`/promos/${p.sponsored.id}/hit`, { body: {} }).catch(() => {}); };
export function wirePost(root, p, onRemove) {
  const likeBtn = root.querySelector('.like');
  likeBtn.onclick = () => { promoHit(p); toggleLike(p, likeBtn); };
  if (p.sponsored) root.querySelector('.post-h a')?.addEventListener('click', () => promoHit(p));
  const mediaBox = root.querySelector('.post-media');
  wireCarousel(mediaBox);
  if (p.type !== 'text') fitMedia(mediaBox);
  if (p.edit) applyEdit(mediaBox.querySelector('video'), p.edit);
  // Görünen karedeki video (kaydırmalı gönderide o anki hücre)
  const curVideo = () => {
    const tr = mediaBox.querySelector('.car-track');
    if (!tr) return mediaBox.querySelector('video');
    return tr.children[Math.round(tr.scrollLeft / Math.max(1, tr.clientWidth))]?.querySelector('video') || null;
  };
  const toggleSound = () => {
    const v = curVideo(); if (!v && !mediaBox.querySelector('.pm-snd')) return;
    setFeedSound(!state.muted);
    if (v && !state.muted && v.paused) v.play().catch(() => {});
    const b = mediaBox.querySelector('.pm-snd'); if (b) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
  };
  mediaBox.querySelector('.pm-snd')?.addEventListener('click', (e) => { e.stopPropagation(); toggleSound(); });
  onDoubleTap(mediaBox, () => { heartBurst(mediaBox); toggleLike(p, likeBtn, true); }, () => {
    if (p.type === 'reel') { const v = mediaBox.querySelector('video'); if (v) v.muted = !v.muted; return; }
    if (curVideo()) toggleSound();
  });
  // Kaydırınca görünmeyen karedeki video durur, görünen oynar
  const tr = mediaBox.querySelector('.car-track');
  if (tr && tr.querySelector('video')) {
    let t = 0;
    tr.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(() => {
      const cv = curVideo();
      tr.querySelectorAll('video').forEach((v) => { if (v !== cv) v.pause(); });
      if (cv && mediaBox.getBoundingClientRect().top < innerHeight) { cv.muted = state.muted; cv.play().catch(() => { cv.muted = true; cv.play().catch(() => {}); }); }
      const b = mediaBox.querySelector('.pm-snd'); if (b) b.hidden = !cv;
    }, 120); }, { passive: true });
    const b = mediaBox.querySelector('.pm-snd'); if (b) b.hidden = !curVideo();
  }
  root.querySelectorAll('.cm, .cm2').forEach((b) => { b.onclick = () => { promoHit(p); openComments(p); }; });
  const rp = root.querySelector('.rp'); if (rp) rp.onclick = () => toggleRepost(p, rp);
  wireCaption(root);
  wirePostPoll(root, p);
  root.querySelector('.post-h a')?.addEventListener('click', () => { if (p.user.id !== state.me.id && !p.sponsored) api('/insights/visit', { body: { id: p.id } }).catch(() => {}); });
  root.querySelector('.sh').onclick = () => { promoHit(p); sharePost(p); };
  const sv = root.querySelector('.sv');
  sv.onclick = () => {
    const on = saved.toggle(p.id);
    if (p.user.id !== state.me.id) api(`/posts/${p.id}/save`, { body: { on } }).catch(() => {});
    sv.innerHTML = icon('bookmark', '', on ? 'fill="currentColor"' : '');
    toast(on ? 'Kaydedilenlere eklendi.' : 'Kaydedilenlerden çıkarıldı.');
  };
  root.querySelector('.more').onclick = () => {
    const mine = p.user.id === state.me.id;
    sheet(null, `<div class="menu">
      <button data-a="share">${icon('share')}Paylaş</button>
      <button data-a="link">${icon('link')}Bağlantıyı kopyala</button>
      <button data-a="profile">${icon('person')}Profile git</button>
      ${mine && !p.sponsored ? `<button data-a="stats">${icon('poll')}<span class="grow">İstatistikleri gör<div class="sub muted" style="font-size:12.5px">Erişim, gösterim, beğeni, kaydetme</div></span></button>` : ''}
      ${mine ? `<button data-a="promo">🚀<span class="grow">Öne çıkar<div class="sub muted" style="font-size:12.5px">Jetonla daha çok kişiye göster</div></span></button>` : ''}
      ${mine && (p.items || []).length > 1 ? `<button data-a="rmitem" class="danger">${icon('image')}Bu fotoğrafı kaldır</button>` : ''}
      ${mine ? `<button data-a="del" class="danger">${icon('trash')}Sil</button>` : `<button data-a="report" class="danger">${icon('flag')}Şikayet et</button>`}
    </div>`, {
      onMount(sh, close) {
        sh.querySelector('.menu').onclick = async (e) => {
          const a = e.target.closest('button')?.dataset.a; if (!a) return;
          close();
          if (a === 'share') sharePost(p);
          if (a === 'link') { await navigator.clipboard?.writeText(`${location.origin}/#/p/${p.id}`); toast('Bağlantı kopyalandı.'); }
          if (a === 'profile') location.hash = `#/u/${p.user.username}`;
          if (a === 'promo') location.hash = `#/reklam/${p.id}`;
          if (a === 'stats') postInsights(p);
          if (a === 'report') reportUser(p.user, { ref: p.id });
          if (a === 'rmitem') {
            const tr = mediaBox.querySelector('.car-track');
            const idx = tr ? Math.round(tr.scrollLeft / tr.clientWidth) : 0;
            if (!confirm(`${idx + 1}. ${p.items?.[idx]?.type === 'video' ? 'video' : 'fotoğraf'} gönderiden kaldırılsın mı?`)) return;
            try {
              const np = await api(`/posts/${p.id}/items/${idx}`, { method: 'DELETE' });
              p.items = np.items; p.media = np.media;
              mediaBox.innerHTML = mediaHtml(p); wireCarousel(mediaBox); fitMedia(mediaBox);
              toast('Gönderiden kaldırıldı.');
            } catch (er) { toast(er.message); }
          }
          if (a === 'del') {
            if (!confirm('Bu gönderi silinsin mi?')) return;
            try { await api(`/posts/${p.id}`, { method: 'DELETE' }); root.remove(); onRemove?.(); toast('Gönderi silindi.'); } catch (er) { toast(er.message); }
          }
        };
      },
    });
  };
}

// Görünür videoları oynat
export function autoplay(root) {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    const v = e.target;
    if (e.isIntersecting && e.intersectionRatio > 0.6) {
      if (!v.closest('.pt-reel')) v.muted = state.muted; // sessiz/sesli tercihi (vitrin videosunun kendi düzeni var)
      v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
    } else v.pause();
  }), { threshold: [0, 0.6, 1] });
  root.querySelectorAll('video').forEach((v) => io.observe(v));
  return () => io.disconnect();
}

export function gridTile(p) {
  if (p.type === 'text') return `<a href="#/p/${esc(p.id)}" class="gt-text tbg-${esc(p.bg || 'g1')}"><span>${esc((p.caption || '').slice(0, 90))}</span></a>`;
  const first = (p.items || [])[0];
  const vid = p.type === 'reel' || first?.type === 'video' || (!first && isVideo(p.media));
  const multi = (p.items || []).length > 1;
  const poster = first?.poster || p.poster;
  const href = p.type === 'reel' ? `#/vitrin/${p.id}` : `#/p/${p.id}`;
  return `<a href="${href}">${vid
    ? `${poster ? `<img src="${esc(poster)}" alt="" loading="lazy">` : `<video src="${esc(first?.media || p.media)}#t=0.5" muted playsinline preload="metadata"></video>`}
       <span class="badge">${icon(multi ? 'copy' : 'reels')}</span>${p.type === 'reel' ? `<span class="views">${icon('heart')}${num(p.likeCount)}</span>` : ''}`
    : `<img src="${esc(first?.media || p.media)}" alt="" loading="lazy">${multi ? `<span class="badge">${icon('copy')}</span>` : ''}`}</a>`;
}

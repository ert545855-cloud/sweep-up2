import { icon } from './icons.js';
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
export function mediaHtml(p) {
  const items = itemsOf(p);
  if (items.length === 1) return oneMedia(items[0], p, p.edit);
  return `<div class="car"><div class="car-track">${items.map((it) => `<div class="car-cell">${oneMedia(it, p)}</div>`).join('')}</div>
    <span class="car-n">1/${items.length}</span><div class="car-dots">${items.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div></div>`;
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

// Dalga düzenlemesi (kırpma, hız, filtre, müzik) oynatma sırasında uygulanır
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

export function postCard(p) {
  return `<article class="post" data-post="${esc(p.id)}">
    <header class="post-h">
      <a href="#/u/${esc(p.user.username)}" class="row grow" style="gap:10px">${avatar(p.user, 40, { ring: true })}
        <span class="grow" style="line-height:1.25"><span class="u ellipsis" style="display:block">${nm(p.user)}</span><span class="muted" style="font-size:13px">@${esc(p.user.username)} · ${ago(p.createdAt)}</span></span></a>
      <button class="more" aria-label="Diğer seçenekler">${icon('more')}</button>
    </header>
    <div class="post-media">${mediaHtml(p)}</div>
    <div class="post-actions">
      <button class="like ${p.liked ? 'liked' : ''}" aria-label="Beğen">${icon('heart')}<span class="cnt">${p.likeCount ? num(p.likeCount) : ''}</span></button>
      <button class="cm" aria-label="Yorum yap">${icon('comment')}<span>${p.commentCount ? num(p.commentCount) : ''}</span></button>
      <button class="sh" aria-label="Paylaş">${icon('send')}</button>
      <span class="sp"></span>
      <button class="sv" aria-label="Kaydet">${icon('bookmark', '', saved.has(p.id) ? 'fill="currentColor"' : '')}</button>
    </div>
    <div class="post-body">
      ${p.caption ? `<div>${richText(p.caption)}</div>` : ''}
      ${p.commentCount ? `<button class="muted cm2" style="text-align:left">${p.commentCount} yorumu gör</button>` : ''}
    </div>
  </article>`;
}

export function wirePost(root, p, onRemove) {
  const likeBtn = root.querySelector('.like');
  likeBtn.onclick = () => toggleLike(p, likeBtn);
  const mediaBox = root.querySelector('.post-media');
  wireCarousel(mediaBox);
  fitMedia(mediaBox);
  if (p.edit) applyEdit(mediaBox.querySelector('video'), p.edit);
  onDoubleTap(mediaBox, () => { heartBurst(mediaBox); toggleLike(p, likeBtn, true); }, () => {
    const v = mediaBox.querySelector('video');
    if (v) { v.muted = !v.muted; }
  });
  root.querySelectorAll('.cm, .cm2').forEach((b) => { b.onclick = () => openComments(p); });
  root.querySelector('.sh').onclick = () => sharePost(p);
  const sv = root.querySelector('.sv');
  sv.onclick = () => {
    const on = saved.toggle(p.id);
    sv.innerHTML = icon('bookmark', '', on ? 'fill="currentColor"' : '');
    toast(on ? 'Kaydedilenlere eklendi.' : 'Kaydedilenlerden çıkarıldı.');
  };
  root.querySelector('.more').onclick = () => {
    const mine = p.user.id === state.me.id;
    sheet(null, `<div class="menu">
      <button data-a="share">${icon('share')}Paylaş</button>
      <button data-a="link">${icon('link')}Bağlantıyı kopyala</button>
      <button data-a="profile">${icon('person')}Profile git</button>
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
          if (a === 'report') reportUser(p.user, { ref: p.id });
          if (a === 'rmitem') {
            const tr = mediaBox.querySelector('.car-track');
            const idx = tr ? Math.round(tr.scrollLeft / tr.clientWidth) : 0;
            if (!confirm(`${idx + 1}. fotoğraf gönderiden kaldırılsın mı?`)) return;
            try {
              const np = await api(`/posts/${p.id}/items/${idx}`, { method: 'DELETE' });
              p.items = np.items; p.media = np.media;
              mediaBox.innerHTML = mediaHtml(p); wireCarousel(mediaBox); fitMedia(mediaBox);
              toast('Fotoğraf kaldırıldı.');
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
    if (e.isIntersecting && e.intersectionRatio > 0.6) v.play().catch(() => {}); else v.pause();
  }), { threshold: [0, 0.6, 1] });
  root.querySelectorAll('video').forEach((v) => io.observe(v));
  return () => io.disconnect();
}

export function gridTile(p) {
  const vid = p.type === 'reel' || isVideo(p.media);
  const href = p.type === 'reel' ? `#/dalga/${p.id}` : `#/p/${p.id}`;
  return `<a href="${href}">${vid
    ? `${p.poster ? `<img src="${esc(p.poster)}" alt="" loading="lazy">` : `<video src="${esc(p.media)}#t=0.5" muted playsinline preload="metadata"></video>`}
       <span class="badge">${icon('reels')}</span><span class="views">${icon('heart')}${num(p.likeCount)}</span>`
    : `<img src="${esc(p.media)}" alt="" loading="lazy">${(p.items || []).length > 1 ? `<span class="badge">${icon('copy')}</span>` : ''}`}</a>`;
}

import { icon } from './icons.js';
import {
  esc, ago, num, avatar, toggleLike, heartBurst, onDoubleTap, openComments, sharePost, saved, sheet, api, toast, state, isVideo,
} from './core.js';

export function postCard(p) {
  const vid = p.type === 'reel' || isVideo(p.media);
  return `<article class="post" data-post="${esc(p.id)}">
    <header class="post-h">
      <a href="#/u/${esc(p.user.username)}" class="row grow" style="gap:10px">${avatar(p.user, 32, { ring: true })}
        <span class="grow ellipsis"><span class="u">${esc(p.user.username)}</span> <span class="muted">• ${ago(p.createdAt)}</span></span></a>
      <button class="more" aria-label="Diğer seçenekler">${icon('more')}</button>
    </header>
    <div class="post-media">${vid
    ? `<video src="${esc(p.media)}" ${p.poster ? `poster="${esc(p.poster)}"` : ''} muted loop playsinline preload="metadata"></video>`
    : `<img src="${esc(p.media)}" alt="${esc(p.caption || 'Gönderi')}" loading="lazy">`}</div>
    <div class="post-actions">
      <button class="like ${p.liked ? 'liked' : ''}" aria-label="Beğen">${icon('heart')}</button>
      <button class="cm" aria-label="Yorum yap">${icon('comment')}</button>
      <button class="sh" aria-label="Paylaş">${icon('send')}</button>
      <span class="sp"></span>
      <button class="sv" aria-label="Kaydet">${icon('bookmark', '', saved.has(p.id) ? 'fill="currentColor"' : '')}</button>
    </div>
    <div class="post-body">
      <span class="b like-count">${num(p.likeCount)} beğenme</span>
      ${p.caption ? `<div><a class="b" href="#/u/${esc(p.user.username)}">${esc(p.user.username)}</a> ${esc(p.caption)}</div>` : ''}
      ${p.commentCount ? `<button class="muted cm2" style="text-align:left">${p.commentCount} yorumun tümünü gör</button>` : '<button class="muted cm2" style="text-align:left">Yorum ekle...</button>'}
    </div>
  </article>`;
}

export function wirePost(root, p, onRemove) {
  const likeBtn = root.querySelector('.like');
  likeBtn.onclick = () => toggleLike(p, likeBtn);
  const mediaBox = root.querySelector('.post-media');
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
      ${mine ? `<button data-a="del" class="danger">${icon('trash')}Sil</button>` : ''}
    </div>`, {
      onMount(sh, close) {
        sh.querySelector('.menu').onclick = async (e) => {
          const a = e.target.closest('button')?.dataset.a; if (!a) return;
          close();
          if (a === 'share') sharePost(p);
          if (a === 'link') { await navigator.clipboard?.writeText(`${location.origin}/#/p/${p.id}`); toast('Bağlantı kopyalandı.'); }
          if (a === 'profile') location.hash = `#/u/${p.user.username}`;
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
  const href = p.type === 'reel' ? `#/reels/${p.id}` : `#/p/${p.id}`;
  return `<a href="${href}">${vid
    ? `${p.poster ? `<img src="${esc(p.poster)}" alt="" loading="lazy">` : `<video src="${esc(p.media)}#t=0.5" muted playsinline preload="metadata"></video>`}
       <span class="badge">${icon('reels')}</span><span class="views">${icon('heart')}${num(p.likeCount)}</span>`
    : `<img src="${esc(p.media)}" alt="" loading="lazy">`}</a>`;
}

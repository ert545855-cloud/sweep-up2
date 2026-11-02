import { icon } from './icons.js';
import {
  esc, ago, num, avatar, reportUser, toggleLike, heartBurst, onDoubleTap, openComments, sharePost, saved, sheet, api, toast, state, isVideo,
} from './core.js';

export function postCard(p) {
  const vid = p.type === 'reel' || isVideo(p.media);
  return `<article class="post" data-post="${esc(p.id)}">
    <header class="post-h">
      <a href="#/u/${esc(p.user.username)}" class="row grow" style="gap:10px">${avatar(p.user, 40, { ring: true })}
        <span class="grow" style="line-height:1.25"><span class="u ellipsis" style="display:block">${esc(p.user.name)}</span><span class="muted" style="font-size:13px">@${esc(p.user.username)} · ${ago(p.createdAt)}</span></span></a>
      <button class="more" aria-label="Diğer seçenekler">${icon('more')}</button>
    </header>
    <div class="post-media">${vid
    ? `<video src="${esc(p.media)}" ${p.poster ? `poster="${esc(p.poster)}"` : ''} muted loop playsinline preload="metadata"></video>`
    : `<img src="${esc(p.media)}" alt="${esc(p.caption || 'Gönderi')}" loading="lazy">`}</div>
    <div class="post-actions">
      <button class="like ${p.liked ? 'liked' : ''}" aria-label="Beğen">${icon('heart')}<span class="cnt">${p.likeCount ? num(p.likeCount) : ''}</span></button>
      <button class="cm" aria-label="Yorum yap">${icon('comment')}<span>${p.commentCount ? num(p.commentCount) : ''}</span></button>
      <button class="sh" aria-label="Paylaş">${icon('send')}</button>
      <span class="sp"></span>
      <button class="sv" aria-label="Kaydet">${icon('bookmark', '', saved.has(p.id) ? 'fill="currentColor"' : '')}</button>
    </div>
    <div class="post-body">
      ${p.caption ? `<div>${esc(p.caption)}</div>` : ''}
      ${p.commentCount ? `<button class="muted cm2" style="text-align:left">${p.commentCount} yorumu gör</button>` : ''}
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
    : `<img src="${esc(p.media)}" alt="" loading="lazy">`}</a>`;
}

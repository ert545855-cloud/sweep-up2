import { icon } from '../icons.js';
import {
  state, api, esc, num, toggleLike, heartBurst, onDoubleTap, openComments, sharePost, saved, toast, on, paintLike,
} from '../core.js';

export default async function reels(view, focusId) {
  view.innerHTML = `<div class="reels-top">
      <a href="#/create/reel" aria-label="Dalga oluştur">${icon('plus')}</a>
      <div class="tabsw"><span class="on" data-t="all">Senin için</span><span data-t="fol">Takip ettiklerin</span></div>
      <button class="snd" aria-label="Sesi aç/kapat">${icon(state.muted ? 'mute' : 'volume')}</button>
    </div>
    <div class="reels"><div class="spinner" style="margin-top:45vh"></div></div>`;
  const box = view.querySelector('.reels');
  const [all, following] = await Promise.all([api('/reels'), api(`/users/${state.me.id}/following`)]);
  const fol = new Set(following.map((u) => u.id));
  let list = all;
  if (focusId) {
    const i = list.findIndex((r) => r.id === focusId);
    if (i > 0) list = [list[i], ...list.slice(0, i), ...list.slice(i + 1)];
    if (i < 0) { try { const r = await api(`/posts/${focusId}`); list = [r, ...list]; } catch {} }
  }

  const sndBtn = view.querySelector('.snd');
  const setMuted = (m) => {
    state.muted = m;
    sndBtn.innerHTML = icon(m ? 'mute' : 'volume');
    box.querySelectorAll('video').forEach((v) => { v.muted = m; });
  };
  sndBtn.onclick = () => setMuted(!state.muted);

  let io;
  const paint = (items) => {
    io?.disconnect();
    if (!items.length) {
      box.innerHTML = `<div class="empty" style="color:#aaa;padding-top:40vh">Henüz dalga yok. <a class="link" href="#/create/reel">İlk dalgayı sen paylaş</a></div>`;
      return;
    }
    box.innerHTML = items.map((r) => `<section class="reel" data-id="${esc(r.id)}" data-post>
      <video src="${esc(r.media)}" ${r.poster ? `poster="${esc(r.poster)}"` : ''} loop playsinline preload="metadata" ${state.muted ? 'muted' : ''}></video>
      <div class="shade"></div>
      <div class="mute-ind">${icon(state.muted ? 'mute' : 'volume')}</div>
      <div class="rail">
        <button class="like ${r.liked ? 'liked' : ''}" aria-label="Beğen">${icon('heart')}<span class="cnt">${r.likeCount ? num(r.likeCount) : ''}</span></button>
        <button class="cm" aria-label="Yorumlar">${icon('comment')}<span>${r.commentCount ? num(r.commentCount) : ''}</span></button>
        <button class="sh" aria-label="Paylaş">${icon('send')}</button>
        <button class="sv" aria-label="Kaydet">${icon('bookmark', '', saved.has(r.id) ? 'fill="currentColor"' : '')}</button>
        <a href="#/u/${esc(r.user.username)}" aria-label="Profil"><img class="mini" src="${esc(r.user.avatar)}" alt=""></a>
      </div>
      <div class="meta">
        <div class="row"><a href="#/u/${esc(r.user.username)}" class="row" style="gap:10px"><img class="av av-32" src="${esc(r.user.avatar)}" alt=""><span class="u">${esc(r.user.username)}</span></a>
          ${r.user.id !== state.me.id && !fol.has(r.user.id) ? `<button class="btn ghost follow" data-uid="${esc(r.user.id)}">Takip et</button>` : ''}</div>
        ${r.caption ? `<div class="cap">${esc(r.caption)}</div>` : ''}
      </div>
      <div class="progress"><i></i></div>
    </section>`).join('');

    items.forEach((r) => {
      const sec = box.querySelector(`[data-id="${CSS.escape(r.id)}"]`);
      const v = sec.querySelector('video');
      const likeBtn = sec.querySelector('.like');
      const ind = sec.querySelector('.mute-ind');
      likeBtn.onclick = () => toggleLike(r, likeBtn);
      onDoubleTap(v, () => { heartBurst(sec); toggleLike(r, likeBtn, true); }, () => {
        setMuted(!state.muted);
        ind.innerHTML = icon(state.muted ? 'mute' : 'volume');
        ind.classList.add('show'); setTimeout(() => ind.classList.remove('show'), 700);
      });
      sec.querySelector('.cm').onclick = () => openComments(r);
      sec.querySelector('.sh').onclick = () => sharePost(r);
      const sv = sec.querySelector('.sv');
      sv.onclick = () => { const s = saved.toggle(r.id); sv.innerHTML = icon('bookmark', '', s ? 'fill="currentColor"' : ''); };
      sec.querySelector('.cap')?.addEventListener('click', (e) => e.currentTarget.classList.toggle('open'));
      const bar = sec.querySelector('.progress i');
      v.addEventListener('timeupdate', () => { if (v.duration) bar.style.width = `${(v.currentTime / v.duration) * 100}%`; });
      v.addEventListener('error', () => { sec.querySelector('.shade').insertAdjacentHTML('afterend', '<div class="empty" style="position:absolute;inset:0;padding-top:45%;color:#bbb">Video yüklenemedi.</div>'); });
    });

    box.querySelectorAll('.follow').forEach((b) => {
      b.onclick = async () => {
        try {
          const r = await api(`/users/${b.dataset.uid}/follow`, { body: {} });
          if (r.following) fol.add(b.dataset.uid);
          box.querySelectorAll(`.follow[data-uid="${CSS.escape(b.dataset.uid)}"]`).forEach((x) => x.remove());
          toast('Takip ediyorsun.');
        } catch (e) { toast(e.message); }
      };
    });

    io = new IntersectionObserver((entries) => entries.forEach((e) => {
      const v = e.target.querySelector('video');
      if (e.isIntersecting && e.intersectionRatio > 0.7) {
        v.muted = state.muted;
        v.play().catch(() => { v.muted = true; state.muted = true; sndBtn.innerHTML = icon('mute'); v.play().catch(() => {}); });
      } else { v.pause(); }
    }), { root: box, threshold: [0, 0.7, 1] });
    box.querySelectorAll('.reel').forEach((s) => io.observe(s));
  };

  paint(list);
  view.querySelector('.tabsw').onclick = (e) => {
    const t = e.target.closest('span'); if (!t) return;
    view.querySelectorAll('.tabsw span').forEach((s) => s.classList.toggle('on', s === t));
    box.scrollTop = 0;
    paint(t.dataset.t === 'fol' ? all.filter((r) => fol.has(r.user.id)) : all);
  };

  const off = on('post:likes', ({ id, likeCount }) => {
    const r = all.find((x) => x.id === id); if (!r) return;
    r.likeCount = likeCount;
    paintLike(box.querySelector(`[data-id="${CSS.escape(id)}"] .like`), r);
  });
  return () => { io?.disconnect(); off(); box.querySelectorAll('video').forEach((v) => { v.pause(); v.removeAttribute('src'); v.load(); }); };
}

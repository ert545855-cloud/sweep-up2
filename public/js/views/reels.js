import { icon } from '../icons.js';
import {
  state, api, esc, num, toggleLike, heartBurst, onDoubleTap, openComments, sharePost, saved, toast, on, paintLike, richText, nm,
} from '../core.js';
import { applyEdit, promoHit } from '../components.js';

export default async function reels(view, focusId) {
  view.innerHTML = `<div class="reels-top">
      <a href="#/create/reel" aria-label="Vitrine video ekle">${icon('plus')}</a>
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
  let edits = [];
  const paint = (items) => {
    io?.disconnect();
    edits.forEach((f) => f()); edits = [];
    if (!items.length) {
      box.innerHTML = `<div class="empty" style="color:#aaa;padding-top:40vh">Vitrinde henüz video yok. <a class="link" href="#/create/reel">İlk videoyu sen ekle</a></div>`;
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
        <div class="row"><a href="#/u/${esc(r.user.username)}" class="row" style="gap:10px"><img class="av av-32" src="${esc(r.user.avatar)}" alt=""><span class="u">${nm(r.user, 'username')}</span></a>
          ${r.sponsored ? '<span class="spons dark">Sponsorlu</span>' : ''}
          ${r.user.id !== state.me.id && !fol.has(r.user.id) ? `<button class="btn ghost follow" data-uid="${esc(r.user.id)}">Takip et</button>` : ''}
          ${r.user.id === state.me.id ? `<a class="btn ghost" href="#/reklam/${esc(r.id)}">🚀 Öne çıkar</a>` : ''}</div>
        ${r.caption ? `<div class="cap">${richText(r.caption)}</div>` : ''}
        <${r.edit?.spotifyUrl ? `a href="${esc(r.edit.spotifyUrl)}" target="_blank" rel="noopener"` : 'div'} class="snd-line">${r.edit?.audioCover ? `<img src="${esc(r.edit.audioCover)}" alt="">` : icon('music')}<span>${esc(r.edit?.audioTitle ? `${r.edit.audioTitle}${r.edit.audioArtist ? ` · ${r.edit.audioArtist}` : ''}` : (r.edit?.audio ? 'Müzik' : `Orijinal ses · ${r.user.username}`))}</span>${r.edit?.speed && r.edit.speed !== 1 ? `<span class="chip-s">${r.edit.speed}x</span>` : ''}${r.edit?.spotifyUrl ? '<span class="chip-s">Spotify</span>' : ''}</${r.edit?.spotifyUrl ? 'a' : 'div'}>
      </div>
      <div class="progress"><i></i></div>
    </section>`).join('');

    items.forEach((r) => {
      const sec = box.querySelector(`[data-id="${CSS.escape(r.id)}"]`);
      const v = sec.querySelector('video');
      const likeBtn = sec.querySelector('.like');
      const ind = sec.querySelector('.mute-ind');
      likeBtn.onclick = () => { promoHit(r); toggleLike(r, likeBtn); };
      onDoubleTap(v, () => { heartBurst(sec); toggleLike(r, likeBtn, true); }, () => {
        setMuted(!state.muted);
        ind.innerHTML = icon(state.muted ? 'mute' : 'volume');
        ind.classList.add('show'); setTimeout(() => ind.classList.remove('show'), 700);
      });
      sec.querySelector('.cm').onclick = () => { promoHit(r); openComments(r); };
      sec.querySelector('.sh').onclick = () => { promoHit(r); sharePost(r); };
      if (r.sponsored) sec.querySelectorAll('.meta a, .rail a').forEach((a) => a.addEventListener('click', () => promoHit(r)));
      const sv = sec.querySelector('.sv');
      sv.onclick = () => { const s = saved.toggle(r.id); sv.innerHTML = icon('bookmark', '', s ? 'fill="currentColor"' : ''); };
      sec.querySelector('.cap')?.addEventListener('click', (e) => e.currentTarget.classList.toggle('open'));
      const bar = sec.querySelector('.progress i');
      edits.push(applyEdit(v, r.edit));
      v.addEventListener('loadedmetadata', () => { if (v.videoWidth > v.videoHeight * 1.05) v.classList.add('land'); }, { once: true });
      let pinged = false;
      v.addEventListener('timeupdate', () => { if (!pinged && v.currentTime - (r.edit?.start || 0) > 3) { pinged = true; api('/quests/ping', { body: { key: 'vitrin', id: r.id } }).catch(() => {}); } });
      const t0 = r.edit?.start || 0;
      v.addEventListener('timeupdate', () => { const t1 = r.edit?.end || v.duration; if (t1) bar.style.width = `${Math.min(100, ((v.currentTime - t0) / (t1 - t0)) * 100)}%`; });
      sec.querySelector('.cap')?.querySelectorAll('a').forEach((a) => a.addEventListener('click', (e) => e.stopPropagation()));
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
  return () => { io?.disconnect(); off(); edits.forEach((f) => f()); box.querySelectorAll('video').forEach((v) => { v.pause(); v.removeAttribute('src'); v.load(); }); };
}

import { icon } from '../icons.js';
import {
  state, api, esc, ago, toast, sheet, avatar, emit,
} from '../core.js';

export default async function stories(view, userId) {
  view.innerHTML = '<div class="story-v"><div class="spinner" style="margin-top:45vh"></div></div>';
  const groups = await api('/stories');
  let gi = groups.findIndex((g) => g.user.id === userId);
  if (gi < 0) { view.innerHTML = `<div class="empty"><div class="big">${icon('camera')}</div><h2>Hikaye bulunamadı</h2>Hikayeler 24 saat sonra kaybolur.<p><a class="btn primary" href="#/">Ana sayfa</a></p></div>`; return null; }
  let ii = Math.max(0, groups[gi].items.findIndex((x) => !x.seen));
  let raf = 0; let t0 = 0; let dur = 5000; let paused = false; let pausedAt = 0; let closed = false;

  const close = () => { closed = true; cancelAnimationFrame(raf); history.length > 1 ? history.back() : (location.hash = '#/'); };

  function show() {
    cancelAnimationFrame(raf);
    const g = groups[gi]; const it = g.items[ii];
    const mine = g.user.id === state.me.id;
    view.innerHTML = `<div class="story-v">
      <div class="media">${it.mediaType === 'video' ? `<video src="${esc(it.media)}" playsinline autoplay></video>` : `<img src="${esc(it.media)}" alt="">`}</div>
      <div class="bars">${g.items.map((_, i) => `<i><b style="width:${i < ii ? 100 : 0}%"></b></i>`).join('')}</div>
      <div class="head">
        <a href="#/u/${esc(g.user.username)}" class="row" style="gap:10px;flex:1;min-width:0"><img class="av av-32" src="${esc(g.user.avatar)}" alt=""><b class="ellipsis">${esc(g.user.username)}</b><span style="opacity:.8">${ago(it.at)}</span></a>
        ${mine ? `<button class="del" aria-label="Sil">${icon('trash')}</button>` : `<button class="more" aria-label="Diğer">${icon('more')}</button>`}
        <button class="x" aria-label="Kapat">${icon('close')}</button>
      </div>
      <div class="tapl"></div><div class="tapr"></div>
      <div class="foot">${mine
    ? `<button class="vw">${icon('eye')} ${it.viewerCount || 0} görüntüleme</button>`
    : `<form class="rp" style="display:flex;gap:10px;flex:1"><input placeholder="${esc(g.user.name.split(' ')[0])} kişisine yanıt ver..." maxlength="500"><button aria-label="Gönder">${icon('send')}</button></form>`}</div>
    </div>`;
    if (!mine && !it.seen) { it.seen = true; api(`/stories/${it.id}/view`, { body: {} }).catch(() => {}); }
    const v = view.querySelector('video');
    dur = 5000;
    if (v) v.onloadedmetadata = () => { dur = Math.min(30000, (v.duration || 5) * 1000); };
    t0 = performance.now(); paused = false;
    const bar = view.querySelectorAll('.bars b')[ii];
    const tick = (t) => {
      if (closed) return;
      if (!paused) {
        const p = Math.min(1, (t - t0) / dur);
        bar.style.width = `${p * 100}%`;
        if (p >= 1) return next();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const pause = (on_) => {
      if (on_ && !paused) { paused = true; pausedAt = performance.now(); v?.pause(); }
      if (!on_ && paused) { paused = false; t0 += performance.now() - pausedAt; v?.play().catch(() => {}); }
    };
    let downAt = 0;
    ['tapl', 'tapr'].forEach((c) => {
      const z = view.querySelector('.' + c);
      z.addEventListener('pointerdown', () => { downAt = Date.now(); pause(true); });
      z.addEventListener('pointerup', () => { pause(false); if (Date.now() - downAt < 250) (c === 'tapl' ? prev : next)(); });
      z.addEventListener('pointerleave', () => pause(false));
    });
    view.querySelector('.x').onclick = close;
    view.querySelector('.del')?.addEventListener('click', async () => {
      pause(true);
      if (!confirm('Bu hikaye silinsin mi?')) return pause(false);
      await api(`/stories/${it.id}`, { method: 'DELETE' });
      g.items.splice(ii, 1);
      emit('stories:update', {});
      if (!g.items.length) return close();
      ii = Math.min(ii, g.items.length - 1); show();
    });
    view.querySelector('.vw')?.addEventListener('click', () => {
      pause(true);
      const closeSheet = sheet('Görüntüleyenler', '<div class="vl"><div class="spinner"></div></div>', {
        async onMount(sh) {
          const us = await api(`/stories/${it.id}/viewers`);
          sh.querySelector('.vl').innerHTML = us.length ? us.map((u) => `<a class="list-item" href="#/u/${esc(u.username)}">${avatar(u, 44)}<div><div class="b">${esc(u.name)}</div><div class="sub">@${esc(u.username)}</div></div></a>`).join('') : '<div class="empty">Henüz kimse görmedi.</div>';
        },
      });
      document.querySelector('.sheet-bg')?.addEventListener('click', () => pause(false));
      return closeSheet;
    });
    view.querySelector('.more')?.addEventListener('click', () => {
      pause(true);
      import('../core.js').then(({ reportUser }) => reportUser(g.user, { ref: it.id }));
    });
    const rp = view.querySelector('.rp');
    if (rp) {
      const inp = rp.querySelector('input');
      inp.addEventListener('focus', () => pause(true));
      inp.addEventListener('blur', () => { if (!inp.value) pause(false); });
      rp.onsubmit = async (e) => {
        e.preventDefault();
        const text = inp.value.trim(); if (!text) return;
        try { await api(`/stories/${it.id}/reply`, { body: { text } }); inp.value = ''; inp.blur(); toast('Yanıtın mesaj olarak gönderildi.'); pause(false); } catch (er) { toast(er.message); }
      };
    }
  }
  function next() {
    if (ii < groups[gi].items.length - 1) { ii++; return show(); }
    if (gi < groups.length - 1) { gi++; ii = Math.max(0, groups[gi].items.findIndex((x) => !x.seen)); return show(); }
    close();
  }
  function prev() {
    if (ii > 0) { ii--; return show(); }
    if (gi > 0) { gi--; ii = 0; return show(); }
    show();
  }
  const key = (e) => { if (e.target.matches('input')) return; if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') prev(); if (e.key === 'Escape') close(); };
  window.addEventListener('keydown', key);
  show();
  return () => { closed = true; cancelAnimationFrame(raf); window.removeEventListener('keydown', key); emit('stories:update', {}); };
}

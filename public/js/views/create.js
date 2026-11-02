import { icon } from '../icons.js';
import {
  api, toast, pickFile, compressImage, uploadFile, esc,
} from '../core.js';

// Videodan kapak karesi üret
function posterFrom(file) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.src = URL.createObjectURL(file);
    const done = (b) => { URL.revokeObjectURL(v.src); resolve(b); };
    v.onloadeddata = () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 2); };
    v.onseeked = () => {
      const s = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
      const c = document.createElement('canvas');
      c.width = v.videoWidth * s; c.height = v.videoHeight * s;
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      c.toBlob((b) => done(b ? new File([b], 'poster.jpg', { type: 'image/jpeg' }) : null), 'image/jpeg', 0.8);
    };
    v.onerror = () => done(null);
    setTimeout(() => done(null), 6000);
  });
}

export default function create(view, kind) {
  let mode = kind === 'reel' ? 'reel' : 'image';
  let file = null;

  view.innerHTML = `<header class="topbar bordered">
      <button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/')" aria-label="Kapat">${icon('close')}</button>
      <div class="center">Yeni ${mode === 'reel' ? 'reels' : 'gönderi'}</div>
      <button class="link go" style="padding:0 6px" disabled>Paylaş</button>
    </header>
    <div class="create">
      <div class="seg" role="tablist">
        <button data-m="image" class="${mode === 'image' ? 'on' : ''}">Gönderi</button>
        <button data-m="reel" class="${mode === 'reel' ? 'on' : ''}">Reels</button>
        <button data-m="live">Canlı</button>
      </div>
      <button class="picker"></button>
      <textarea class="field cap" placeholder="Açıklama yaz..." maxlength="2200" rows="3"></textarea>
      <div class="bar" hidden><i></i></div>
      <button class="btn primary block go2" disabled>Paylaş</button>
    </div>`;

  const picker = view.querySelector('.picker');
  const title = view.querySelector('.center');
  const goBtns = view.querySelectorAll('.go, .go2');
  const paintPicker = () => {
    picker.className = `picker ${mode === 'reel' ? 'reel' : ''}`;
    title.textContent = `Yeni ${mode === 'reel' ? 'reels' : 'gönderi'}`;
    if (file) {
      const url = URL.createObjectURL(file);
      picker.innerHTML = file.type.startsWith('video') ? `<video src="${url}" autoplay muted loop playsinline></video>` : `<img src="${url}" alt="Önizleme">`;
    } else {
      picker.innerHTML = `<div>${icon(mode === 'reel' ? 'video' : 'image', '', 'style="width:56px;height:56px;margin:0 auto 10px"')}
        <div class="b" style="color:var(--text)">${mode === 'reel' ? 'Video seç' : 'Fotoğraf seç'}</div>
        <div>${mode === 'reel' ? 'Dikey video önerilir, en fazla 40 MB' : 'Galeriden seç ya da fotoğraf çek'}</div></div>`;
    }
    goBtns.forEach((b) => { b.disabled = !file; });
  };
  paintPicker();

  view.querySelector('.seg').onclick = (e) => {
    const m = e.target.closest('[data-m]')?.dataset.m; if (!m) return;
    if (m === 'live') { location.hash = '#/live'; return; }
    if (m !== mode) { mode = m; file = null; }
    view.querySelectorAll('.seg button').forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
    paintPicker();
  };
  picker.onclick = async () => {
    const f = await pickFile(mode === 'reel' ? 'video/*' : 'image/*');
    if (!f) return;
    if (f.size > 40 * 1024 * 1024) return toast('Dosya en fazla 40 MB olabilir.');
    file = f; paintPicker();
  };

  const bar = view.querySelector('.bar');
  const share = async () => {
    if (!file) return;
    goBtns.forEach((b) => { b.disabled = true; });
    bar.hidden = false;
    const fill = bar.querySelector('i');
    try {
      let poster = null;
      if (mode === 'reel') {
        const pf = await posterFrom(file);
        if (pf) poster = (await uploadFile(pf)).url;
      }
      const up = await uploadFile(mode === 'image' ? await compressImage(file) : file, (p) => { fill.style.width = `${Math.round(p * 100)}%`; });
      const p = await api('/posts', { body: { type: mode, media: up.url, poster, caption: view.querySelector('.cap').value } });
      toast(mode === 'reel' ? 'Reels paylaşıldı.' : 'Gönderi paylaşıldı.');
      location.hash = mode === 'reel' ? `#/reels/${p.id}` : '#/me';
    } catch (e) {
      toast(e.message); bar.hidden = true; goBtns.forEach((b) => { b.disabled = false; });
    }
  };
  goBtns.forEach((b) => { b.onclick = share; });
  return null;
}
export { esc };

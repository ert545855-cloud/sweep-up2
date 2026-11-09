// Müzik seçici: Spotify kataloğunda ara, 30 sn önizlemeyi dinle, seç.
import { icon } from './icons.js';
import { api, esc, sheet, toast, pickFile } from './core.js';

const row = (t, i) => `<div class="mt" data-i="${i}">
  ${t.cover ? `<img src="${esc(t.cover)}" alt="" loading="lazy">` : `<span class="nocover">${icon('music')}</span>`}
  <div class="grow"><b class="ellipsis">${esc(t.title)}</b><small class="ellipsis">${esc(t.artist)}</small></div>
  ${t.preview ? `<button class="pl" aria-label="Dinle">${icon('play')}</button><button class="btn sm primary use">Seç</button>`
    : `${t.spotifyUrl ? `<a class="sp" href="${esc(t.spotifyUrl)}" target="_blank" rel="noopener">Spotify</a>` : ''}<span class="muted np">Önizleme yok</span>`}
</div>`;

export function pickMusic({ allowFile = true } = {}) {
  return new Promise((resolve) => {
    let done = false;
    let audio = null; let playingSrc = null;
    const stop = () => { if (audio) { audio.pause(); audio.src = ''; audio = null; playingSrc = null; } document.querySelectorAll('.mt .pl').forEach((b) => { b.innerHTML = icon('play'); }); };
    const finish = (v) => { if (done) return; done = true; stop(); resolve(v); };
    const close = sheet('Müzik ekle', `<div class="mpick">
      <label class="sw msearch">${icon('search')}<input class="field" placeholder="Şarkı ya da sanatçı ara" autocomplete="off"></label>
      <div class="mlist"><div class="spinner"></div></div>
      ${allowFile ? `<button class="btn outline block own">${icon('music')} Telefonumdan ses dosyası seç</button>` : ''}
      <p class="mnote">Şarkılar Spotify kataloğundan; 30 saniyelik önizleme çalınır.</p></div>`, {
      onMount(sh) {
        const list = sh.querySelector('.mlist');
        const inp = sh.querySelector('input');
        let items = [];
        const show = (arr, title) => {
          items = arr;
          list.innerHTML = arr.length ? `${title ? `<div class="mh">${esc(title)}</div>` : ''}${arr.map(row).join('')}` : '<div class="empty" style="padding:24px">Sonuç bulunamadı.</div>';
        };
        api('/music/featured').then((r) => { if (!inp.value) show(r.items, 'Popüler'); }).catch(() => { list.innerHTML = '<div class="empty" style="padding:24px">Müzikler yüklenemedi.</div>'; });
        let t;
        inp.oninput = () => {
          clearTimeout(t);
          const q = inp.value.trim();
          if (!q) return;
          t = setTimeout(async () => {
            list.innerHTML = '<div class="spinner"></div>';
            try { const r = await api(`/music/search?q=${encodeURIComponent(q)}`); if (inp.value.trim() === q) show(r.items); } catch (e) { list.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
          }, 350);
        };
        list.onclick = (e) => {
          const r = e.target.closest('.mt'); if (!r) return;
          const it = items[+r.dataset.i];
          if (e.target.closest('.pl')) {
            const b = e.target.closest('.pl');
            const same = playingSrc === it.preview;
            stop();
            if (same) return;
            audio = new Audio(it.preview); playingSrc = it.preview;
            audio.play().then(() => { b.innerHTML = icon('pause'); }).catch(() => toast('Önizleme çalınamadı.'));
            audio.onended = stop;
            return;
          }
          if (e.target.closest('.use')) { finish({ src: it.preview, title: it.title, artist: it.artist, cover: it.cover, spotifyUrl: it.spotifyUrl }); close(); }
        };
        sh.querySelector('.own')?.addEventListener('click', async () => {
          const f = await pickFile('audio/*'); if (!f) return;
          if (f.size > 15 * 1024 * 1024) return toast('Ses dosyası en fazla 15 MB olabilir.');
          finish({ file: f, title: f.name.replace(/\.[^.]+$/, '').slice(0, 60), artist: '' }); close();
        });
        setTimeout(() => inp.focus(), 80);
        const obs = new MutationObserver(() => { if (!sh.isConnected) { obs.disconnect(); finish(null); } });
        obs.observe(document.getElementById('sheet-root'), { childList: true });
      },
    });
  });
}

// Müzik kartı (hikaye / vitrin)
export const musicChip = (m) => `${m.cover ? `<img src="${esc(m.cover)}" alt="">` : `<span class="mu-art">${icon('music')}</span>`}<span><b>${esc(m.title || 'Müzik')}</b>${m.artist ? `<small>${esc(m.artist)}</small>` : ''}</span><i class="eq" aria-hidden="true"><b></b><b></b><b></b></i>`;
// Hikaye başlığında (kullanıcı adının altında) kayan şarkı satırı — Instagram gibi
export const musicLine = (m) => `<span class="mu-line">${icon('music')}<span class="mq"><span>${esc(m.title || 'Müzik')}${m.artist ? ` · ${esc(m.artist)}` : ''}</span></span></span>`;

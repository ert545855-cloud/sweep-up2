import { icon } from '../icons.js';
import {
  api, toast, compressImage, uploadFile, esc, state, sheet, FILTERS, filterCss, fmtDur, prepareMedia, uploadPrepared, isVideoFile, isHeicFile, fileType, scaleStickerLayer, mentionAutocomplete, pickPerson,
  stkPos, dragSticker, pickEmoji, pickGif, richText,
} from '../core.js';
import { TEXT_BGS } from '../components.js';
import { pickMusic, musicChip } from '../music.js';

const musicUrl = (m) => (m.file ? (m._url ||= URL.createObjectURL(m.file)) : m.src);
// Önizlemede yatay kaydırarak filtre değiştir (Instagram gibi)
function swipeFilters(el, get, set) {
  let x0 = null; let y0 = 0;
  el.addEventListener('pointerdown', (e) => { if (e.target.closest('.stk, button')) return; x0 = e.clientX; y0 = e.clientY; });
  el.addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0; const dy = e.clientY - y0; x0 = null;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
    const i = FILTERS.findIndex((f) => f[0] === (get() || ''));
    const n = FILTERS[(i + (dx < 0 ? 1 : -1) + FILTERS.length) % FILTERS.length];
    set(n[0]);
    const tag = document.createElement('div'); tag.className = 'fname'; tag.textContent = n[1];
    el.append(tag); setTimeout(() => tag.remove(), 900);
  });
}

// Videodan kapak karesi üret
function posterFrom(file, at = 0.5) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.src = URL.createObjectURL(file);
    const done = (b) => { URL.revokeObjectURL(v.src); resolve(b); };
    v.onloadeddata = () => { v.currentTime = Math.min(Math.max(at, 0.1), (v.duration || 1) - 0.1); };
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

function pickFiles(accept, multiple) {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept; inp.multiple = !!multiple;
    // iPhone'da sayfaya eklenmemiş dosya seçici bazen seçimi bildirmiyor
    inp.style.cssText = 'position:fixed;left:-9999px;opacity:0;width:1px;height:1px';
    document.body.append(inp);
    inp.onchange = () => { resolve([...inp.files]); inp.remove(); };
    inp.addEventListener('cancel', () => { resolve([]); inp.remove(); });
    inp.click();
  });
}

const STICKER_COLORS = ['#ffffff', '#111111', '#ff3d6e', '#ffb020', '#22c55e', '#3b82f6', '#a855f7'];
const SPEEDS = [0.5, 0.75, 1, 1.5, 2];

export default function create(view, kind) {
  let mode = ['reel', 'story', 'text'].includes(kind) ? kind : 'image';
  let unscale = null;
  const TITLES = { image: 'Yeni gönderi', text: 'Yazı paylaş', reel: 'Vitrin videosu', story: 'Yeni hikaye' };
  let postText = ''; let postBg = 'g1'; let storyBg = null;
  let items = []; // gönderi: [{file,url,filter}]
  let cur = 0;
  let file = null; // vitrin / hikaye
  let fileUrl = null;
  let edit = { start: 0, end: null, speed: 1, filter: '', music: null, muteOriginal: false, stickers: [] };
  let storyFilter = '';
  let stickers = [];
  let audioEl = null;

  view.innerHTML = `<header class="topbar bordered">
      <button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/')" aria-label="Kapat">${icon('close')}</button>
      <div class="center">${TITLES[mode]}</div>
      <button class="link go" style="padding:0 6px" disabled>Paylaş</button>
    </header>
    <div class="create">
      <div class="seg" role="tablist">
        <button data-m="image" class="${mode === 'image' ? 'on' : ''}">Gönderi</button>
        <button data-m="text" class="${mode === 'text' ? 'on' : ''}">Yazı</button>
        <button data-m="story" class="${mode === 'story' ? 'on' : ''}">Hikaye</button>
        <button data-m="reel" class="${mode === 'reel' ? 'on' : ''}">Vitrin</button>
        <button data-m="live">Canlı</button>
      </div>
      <div class="picker"></div>
      <div class="tools"></div>
      <div class="capw"><textarea class="field cap" placeholder="Açıklama yaz... #etiket ekle, @ yazınca kişi önerilir" maxlength="2200" rows="3"></textarea>
        <button type="button" class="tagp">${icon('at')} Kişi etiketle</button></div>
      <div class="bar" hidden><i></i></div>
      <button class="btn primary block go2" disabled>Paylaş</button>
    </div>`;

  const capEl = view.querySelector('.cap');
  mentionAutocomplete(capEl);
  view.querySelector('.tagp').onclick = () => pickPerson('Kişi etiketle', (u) => {
    if (!u) return;
    const v = capEl.value; const pos = capEl.selectionStart ?? v.length;
    const pre = v.slice(0, pos); const ins = `${pre && !/\s$/.test(pre) ? ' ' : ''}@${u.username} `;
    capEl.value = pre + ins + v.slice(pos); const c = pos + ins.length; capEl.focus(); capEl.setSelectionRange(c, c);
  });
  const picker = view.querySelector('.picker');
  const tools = view.querySelector('.tools');
  const title = view.querySelector('.center');
  const goBtns = view.querySelectorAll('.go, .go2');
  const ready = () => (mode === 'image' ? items.length > 0 : mode === 'text' ? postText.trim().length > 0 : mode === 'story' ? !!file || !!storyBg : !!file);
  const bgChips = (cur) => `<div class="bg-chips">${TEXT_BGS.map((b) => `<button type="button" data-bg="${b}" class="tbg-${b} ${cur === b ? 'on' : ''}" aria-label="Arka plan"></button>`).join('')}</div>`;
  const stopAudio = () => { if (audioEl) { audioEl.pause(); audioEl = null; } };

  const filterStrip = (active, sample) => `<div class="fstrip">${FILTERS.map(([id, name, css]) => `<button data-f="${id}" class="${(active || '') === id ? 'on' : ''}">
      <span style="background-image:url('${sample}');filter:${css}"></span>${name}</button>`).join('')}</div>`;

  // ---------- Önizleme ----------
  function paint() {
    picker.className = `picker ${mode !== 'image' ? 'reel' : ''}`;
    title.textContent = TITLES[mode];
    view.querySelector('.capw').hidden = mode === 'story' || mode === 'text';
    goBtns.forEach((b) => { b.disabled = !ready(); });
    tools.innerHTML = '';
    if (mode === 'text') return paintText();
    if (mode === 'story' && !file && !storyBg) {
      stopAudio();
      picker.innerHTML = `<div class="pick-two"><button class="pick-empty pk-file"><span class="pk-ic">${icon('image')}</span><b>Fotoğraf ya da video</b><small>Galeriden seç · 24 saat sonra kaybolur</small></button>
        <button class="pick-empty pk-text tbg-g2"><span class="pk-ic">${icon('text')}</span><b>Yazı hikayesi</b><small>Renkli arka plana yaz</small></button></div>`;
      picker.querySelector('.pk-file').onclick = choose;
      picker.querySelector('.pk-text').onclick = () => { storyBg = 'g2'; paint(); addSticker('text'); };
      return;
    }
    if (!ready()) {
      stopAudio();
      picker.innerHTML = `<button class="pick-empty">${icon(mode === 'reel' ? 'video' : 'image', '', 'style="width:56px;height:56px;margin:0 auto 10px"')}
        <div class="b" style="color:var(--text)">${{ reel: 'Video seç', story: 'Fotoğraf ya da video seç', image: 'Fotoğraf seç' }[mode]}</div>
        <div>${{ reel: 'Dikey video önerilir, en fazla 40 MB', story: '24 saat sonra kendiliğinden kaybolur', image: 'En fazla 10 fotoğraf seçebilirsin' }[mode]}</div></button>`;
      picker.querySelector('.pick-empty').onclick = choose;
      return;
    }
    if (mode === 'image') return paintImages();
    if (mode === 'reel') return paintReel();
    return paintStory();
  }

  // ---------- Yazı gönderisi ----------
  function paintText() {
    const sz = (t) => (t.length < 60 ? 'xl' : t.length < 140 ? 'l' : t.length < 320 ? 'm' : 's');
    picker.className = 'picker txt';
    picker.innerHTML = `<div class="tpost tbg-${postBg}"><textarea class="tp-in ${sz(postText)}" maxlength="2200" placeholder="Ne düşünüyorsun? #etiket ya da @kişi ekleyebilirsin">${esc(postText)}</textarea></div>`;
    tools.innerHTML = `<div class="tl">Arka plan</div>${bgChips(postBg)}<p class="muted" style="font-size:12.5px;margin:8px 2px 0">Uzun yazılar akışta birkaç satır görünür, gerisi “devamı” ile açılır.</p>`;
    const ta = picker.querySelector('textarea');
    mentionAutocomplete(ta);
    ta.oninput = () => { postText = ta.value; ta.className = `tp-in ${sz(postText)}`; goBtns.forEach((b) => { b.disabled = !ready(); }); };
    setTimeout(() => ta.focus(), 60);
    tools.querySelector('.bg-chips').onclick = (e) => { const b = e.target.closest('[data-bg]'); if (!b) return; postBg = b.dataset.bg; picker.querySelector('.tpost').className = `tpost tbg-${postBg}`; tools.querySelectorAll('.bg-chips button').forEach((x) => x.classList.toggle('on', x === b)); };
  }

  function paintImages() {
    const it = items[cur];
    picker.innerHTML = `<img src="${it.url}" alt="Önizleme" class="fit" style="filter:${filterCss(it.filter)}">${items.length > 1 ? `<span class="car-n">${cur + 1}/${items.length}</span>` : ''}`;
    tools.innerHTML = `<div class="thumbs">${items.map((x, i) => `<button class="th ${i === cur ? 'on' : ''}" data-i="${i}"><img src="${x.url}" style="filter:${filterCss(x.filter)}" alt=""><i data-rm="${i}" aria-label="Kaldır">${icon('close')}</i></button>`).join('')}
      ${items.length < 10 ? `<button class="th add" aria-label="Fotoğraf ekle">${icon('plus')}</button>` : ''}</div>
      <div class="tl">Filtre</div>${filterStrip(it.filter, it.url)}`;
    tools.querySelector('.thumbs').onclick = (e) => {
      const rm = e.target.closest('[data-rm]');
      if (rm) { items.splice(+rm.dataset.rm, 1); cur = Math.min(cur, items.length - 1); return paint(); }
      if (e.target.closest('.add')) return choose();
      const th = e.target.closest('[data-i]'); if (th) { cur = +th.dataset.i; paint(); }
    };
    tools.querySelector('.fstrip').onclick = (e) => {
      const b = e.target.closest('[data-f]'); if (!b) return;
      items[cur].filter = b.dataset.f; paint();
    };
  }

  function paintReel() {
    picker.innerHTML = `<video src="${fileUrl}" autoplay muted loop playsinline style="filter:${filterCss(edit.filter)}"></video>`;
    const v = picker.querySelector('video');
    picker.insertAdjacentHTML('beforeend', '<div class="ovl ovl-edit"></div>');
    const ovl = picker.querySelector('.ovl-edit');
    const paintOvl = () => {
      ovl.innerHTML = edit.stickers.map((st, i) => (st.type === 'emoji' ? `<span class="ov em" data-i="${i}" style="${stkPos(st)}">${esc(st.em)}</span>`
        : st.type === 'gif' ? `<img class="ov gif" data-i="${i}" style="${stkPos(st)}" src="${esc(st.src)}" alt="">`
          : `<span class="ov tx ${st.bgc ? 'bgc' : ''}" data-i="${i}" style="${stkPos(st)};color:${esc(st.color)}">${esc(st.text)}</span>`)).join('');
      ovl.querySelectorAll('.ov').forEach((elx) => {
        const st = edit.stickers[+elx.dataset.i];
        dragSticker(elx, picker, st, { onTap: () => stickerMenu(st, () => { edit.stickers = edit.stickers.filter((x) => x !== st); }, paintOvl) });
      });
    };
    tools.innerHTML = `<div class="etabs"><button data-t="trim" class="on">${icon('scissors')}Kırp</button><button data-t="speed">${icon('gauge')}Hız</button><button data-t="filter">${icon('wand')}Filtre</button><button data-t="music">${icon('music')}Müzik</button><button data-t="stk">${icon('sticker')}Çıkartma</button></div><div class="epane"></div>`;
    const pane = tools.querySelector('.epane');
    const sync = () => {
      v.playbackRate = edit.speed;
      v.style.filter = filterCss(edit.filter);
      if (edit.music && !audioEl) { audioEl = new Audio(musicUrl(edit.music)); audioEl.loop = true; audioEl.play().catch(() => {}); }
      if (!edit.music) stopAudio();
      v.muted = true;
    };
    v.addEventListener('loadedmetadata', () => { if (edit.start) v.currentTime = edit.start; showTab(tab); });
    v.addEventListener('timeupdate', () => {
      const end = edit.end || v.duration;
      if (v.currentTime >= end || v.currentTime < edit.start - 0.3) { v.currentTime = edit.start; if (audioEl) audioEl.currentTime = 0; }
    });
    let tab = 'trim';
    const showTab = (t) => {
      tab = t;
      tools.querySelectorAll('.etabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
      const dur = v.duration || 0;
      if (t === 'trim') {
        const end = edit.end || dur;
        pane.innerHTML = dur ? `<div class="trim"><div class="row"><span>Başlangıç <b class="ts">${fmtDur(edit.start)}</b></span><span class="sp"></span><span>Bitiş <b class="te">${fmtDur(end)}</b></span></div>
          <input type="range" class="rs" min="0" max="${dur}" step="0.1" value="${edit.start}" aria-label="Başlangıç">
          <input type="range" class="re" min="0" max="${dur}" step="0.1" value="${end}" aria-label="Bitiş">
          <div class="muted" style="font-size:13px">Süre: <b class="tl2">${fmtDur(end - edit.start)}</b></div></div>` : '<div class="muted">Video yükleniyor…</div>';
        const rs = pane.querySelector('.rs'); const re = pane.querySelector('.re');
        if (!rs) return;
        const upd = () => {
          let s = +rs.value; let e = +re.value;
          if (e - s < 1) { if (document.activeElement === rs) s = Math.max(0, e - 1); else e = Math.min(dur, s + 1); rs.value = s; re.value = e; }
          edit.start = s; edit.end = e >= dur - 0.05 ? null : e;
          pane.querySelector('.ts').textContent = fmtDur(s); pane.querySelector('.te').textContent = fmtDur(e); pane.querySelector('.tl2').textContent = fmtDur(e - s);
          v.currentTime = document.activeElement === re ? Math.max(s, e - 1) : s;
        };
        rs.oninput = upd; re.oninput = upd;
      }
      if (t === 'speed') {
        pane.innerHTML = `<div class="chips">${SPEEDS.map((x) => `<button class="chip ${edit.speed === x ? 'on' : ''}" data-s="${x}">${x}x</button>`).join('')}</div>`;
        pane.onclick = (e) => { const b = e.target.closest('[data-s]'); if (!b) return; edit.speed = +b.dataset.s; sync(); showTab('speed'); };
      }
      if (t === 'filter') {
        pane.innerHTML = filterStrip(edit.filter, '');
        pane.querySelectorAll('.fstrip span').forEach((sp) => { sp.style.backgroundImage = 'linear-gradient(135deg,#ff8a3d,#7c3aed 60%,#22c55e)'; });
        pane.onclick = (e) => { const b = e.target.closest('[data-f]'); if (!b) return; edit.filter = b.dataset.f; sync(); showTab('filter'); };
      }
      if (t === 'stk') {
        pane.innerHTML = `<div class="stk-tools three"><button data-k="gif">${icon('gif')}GIF</button><button data-k="emoji">${icon('smile')}Emoji</button><button data-k="text">${icon('text')}Yazı</button></div>
          <p class="muted" style="font-size:12.5px;margin:6px 2px 0">Çıkartmayı videonun üstünde sürükleyerek taşı; büyütmek, küçültmek ya da kaldırmak için dokun. En fazla 6 çıkartma.</p>`;
        pane.onclick = async (e) => {
          const k = e.target.closest('[data-k]')?.dataset.k; if (!k) return;
          if (edit.stickers.length >= 6) return toast('En fazla 6 çıkartma ekleyebilirsin.');
          if (k === 'gif') { const src = await pickGif({ tab: 'stickers', title: 'GIF ve çıkartma' }); if (src) edit.stickers.push({ type: 'gif', src, x: 50, y: 40, s: 1 }); }
          if (k === 'emoji') { const em = await pickEmoji(); if (em) edit.stickers.push({ type: 'emoji', em, x: 50, y: 45, s: 1 }); }
          if (k === 'text') { const tx = await textForm(); if (tx) edit.stickers.push({ type: 'text', ...tx, x: 50, y: 30, s: 1 }); }
          paintOvl();
        };
      }
      if (t === 'music') {
        pane.innerHTML = edit.music ? `<div class="mcard">${musicChip(edit.music)}<button class="ib ch" aria-label="Değiştir">${icon('music')}</button><button class="ib rm" aria-label="Müziği kaldır">${icon('trash')}</button></div>
          <label class="switch-row"><input type="checkbox" class="mo" ${edit.muteOriginal ? 'checked' : ''}> Videonun kendi sesini kapat</label>`
          : `<button class="btn primary block addm">${icon('music')} Müzik ekle</button><p class="muted" style="font-size:13px;margin:8px 2px 0">Spotify kataloğundan şarkı ara ya da kendi ses dosyanı ekle.</p>`;
        pane.onclick = null;
        const choose = async () => {
          const m = await pickMusic();
          if (!m) return;
          edit.music = m; edit.muteOriginal = true;
          stopAudio(); sync(); showTab('music');
        };
        pane.querySelector('.addm')?.addEventListener('click', choose);
        pane.querySelector('.ch')?.addEventListener('click', choose);
        pane.querySelector('.rm')?.addEventListener('click', () => { edit.music = null; edit.muteOriginal = false; sync(); showTab('music'); });
        pane.querySelector('.mo')?.addEventListener('change', (e) => { edit.muteOriginal = e.target.checked; });
      }
    };
    tools.querySelector('.etabs').onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) showTab(b.dataset.t); };
    sync(); showTab('trim'); paintOvl();
    picker.insertAdjacentHTML('beforeend', `<button class="swap" aria-label="Başka video seç">${icon('video')}</button>`);
    picker.querySelector('.swap').onclick = choose;
  }

  // ---------- Çıkartmalar (hikaye + vitrin) ----------
  // Yazı çıkartması formu
  function textForm(init = {}) {
    return new Promise((resolve) => {
      let done = false;
      sheet('Yazı ekle', `<form class="form"><textarea class="field" name="a" maxlength="120" rows="2" placeholder="Bir şey yaz">${esc(init.text || '')}</textarea>
        <div class="colors">${STICKER_COLORS.map((c, i) => `<label><input type="radio" name="c" value="${c}" ${(init.color ? init.color === c : !i) ? 'checked' : ''}><i style="background:${c}"></i></label>`).join('')}</div>
        <label class="switch-row"><input type="checkbox" name="b" ${init.bgc ? 'checked' : ''}> Arka planlı yazı</label>
        <button class="btn primary block">Ekle</button></form>`, {
        onMount(sh, close) {
          const f = sh.querySelector('form'); setTimeout(() => f.a.focus(), 50);
          f.onsubmit = (e) => { e.preventDefault(); const a = f.a.value.trim(); if (!a) return; done = true; close(); resolve({ text: a, color: f.c.value, bgc: f.b.checked }); };
        },
        onClose() { if (!done) resolve(null); },
      });
    });
  }
  // Dokununca: büyüt / küçült / döndür / kaldır
  function stickerMenu(st, remove, repaint) {
    const movable = ['emoji', 'gif', 'text', 'mention'].includes(st.type);
    sheet(null, `<div class="menu">${movable ? `<button data-a="up">${icon('plus')}Büyüt</button><button data-a="down">${icon('chevDown')}Küçült</button><button data-a="rot">${icon('undo')}Döndür</button>` : ''}
      ${st.type === 'text' ? `<button data-a="edit">${icon('edit')}Yazıyı düzenle</button>` : ''}<button data-a="rm" class="danger">${icon('trash')}Kaldır</button></div>`, {
      onMount(sh, close) {
        sh.querySelector('.menu').onclick = async (e) => {
          const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
          close();
          if (a === 'up') st.s = Math.min(3, Math.round(((st.s || 1) + 0.25) * 100) / 100);
          if (a === 'down') st.s = Math.max(0.4, Math.round(((st.s || 1) - 0.2) * 100) / 100);
          if (a === 'rot') st.r = ((st.r || 0) + 15) > 45 ? -45 : (st.r || 0) + 15;
          if (a === 'edit') { const tx = await textForm(st); if (tx) Object.assign(st, tx); }
          if (a === 'rm') { remove(); if (st.type === 'music') stopAudio(); }
          repaint();
        };
      },
    });
  }
  function stickerHtml(s, i) {
    const style = stkPos(s);
    if (s.type === 'text') return `<div class="stk txt sz-${s.size || 'm'} ${s.bgc ? 'bgc' : ''}" data-i="${i}" style="${style};color:${s.color}">${esc(s.text)}</div>`;
    if (s.type === 'emoji') return `<div class="stk em" data-i="${i}" style="${style}">${esc(s.em)}</div>`;
    if (s.type === 'gif') return `<img class="stk gif" data-i="${i}" style="${style}" src="${esc(s.src)}" alt="">`;
    if (s.type === 'poll') return `<div class="stk poll" data-i="${i}" style="${style}"><b>${esc(s.q || 'Anket')}</b>${s.options.map((o) => `<span>${esc(o)}</span>`).join('')}</div>`;
    if (s.type === 'question') return `<div class="stk q" data-i="${i}" style="${style}"><b>${esc(s.q)}</b><span>Bir şey yaz…</span></div>`;
    if (s.type === 'music') return `<div class="stk mu" data-i="${i}" style="${style}">${musicChip(s)}</div>`;
    if (s.type === 'mention') return `<div class="stk men" data-i="${i}" style="${style}">@${esc(s.username)}</div>`;
    return '';
  }
  function paintStory() {
    const vid = file && isVideoFile(file);
    const fst = `style="filter:${filterCss(storyFilter)}"`;
    picker.innerHTML = `${!file ? `<div class="tstory tbg-${storyBg}"></div>` : vid ? `<video src="${fileUrl}" autoplay muted loop playsinline class="fit" ${fst}></video>` : `<img src="${fileUrl}" class="blurbg" alt=""><img src="${fileUrl}" alt="Önizleme" class="fit" ${fst}>`}
      <div class="stk-layer">${stickers.map(stickerHtml).join('')}</div>
      <button class="swap" aria-label="Başka dosya seç">${icon('image')}</button>`;
    picker.querySelector('.swap').onclick = choose;
    unscale?.(); unscale = scaleStickerLayer(picker.querySelector('.stk-layer'));
    tools.innerHTML = `<div class="stk-tools">
      <button data-k="text">${icon('text')}Yazı</button><button data-k="emoji">${icon('smile')}Emoji</button><button data-k="gif">${icon('gif')}GIF</button>
      <button data-k="mention">${icon('at')}Kişi etiketle</button><button data-k="poll">${icon('poll')}Anket</button>
      <button data-k="question">${icon('question')}Soru</button><button data-k="music">${icon('music')}Müzik</button></div>
      <p class="muted" style="font-size:12.5px;margin:6px 2px 0">Çıkartmaları sürükleyerek istediğin yere taşı; büyütmek, döndürmek ya da kaldırmak için dokun.${file ? ' Efekt için fotoğrafı sağa-sola kaydır.' : ''}</p>
      ${file ? `<div class="tl">Efektler</div>${filterStrip(storyFilter, vid ? '' : fileUrl)}` : `<div class="tl">Arka plan</div>${bgChips(storyBg)}`}`;
    if (vid) tools.querySelectorAll('.fstrip span').forEach((sp) => { sp.style.backgroundImage = 'linear-gradient(135deg,#ff8a3d,#7c3aed 60%,#22c55e)'; });
    tools.querySelector('.fstrip')?.addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (!b) return; storyFilter = b.dataset.f; paint(); });
    tools.querySelector('.bg-chips')?.addEventListener('click', (e) => { const b = e.target.closest('[data-bg]'); if (!b) return; storyBg = b.dataset.bg; paint(); });
    tools.querySelector('.stk-tools').onclick = (e) => { const b = e.target.closest('[data-k]'); if (b) addSticker(b.dataset.k); };
    const layer = picker.querySelector('.stk-layer');
    picker.querySelectorAll('.stk').forEach((elx) => {
      const st = stickers[+elx.dataset.i];
      dragSticker(elx, layer, st, { onTap: () => stickerMenu(st, () => { stickers = stickers.filter((x) => x !== st); }, paint) });
    });
    const mu = stickers.find((s) => s.type === 'music');
    if (mu && !audioEl) { audioEl = new Audio(musicUrl(mu)); audioEl.loop = true; audioEl.play().catch(() => {}); }
  }
  async function addSticker(k) {
    if (stickers.length >= 10) return toast('En fazla 10 çıkartma ekleyebilirsin.');
    if (['poll', 'question', 'music'].includes(k) && stickers.some((s) => s.type === k)) return toast('Bu çıkartmadan bir tane ekleyebilirsin.');
    if (k === 'mention') {
      pickPerson('Kişi etiketle', (u) => { if (!u) return; stickers.push({ type: 'mention', username: u.username, x: 50, y: 22 }); paint(); });
      return;
    }
    if (k === 'emoji') { const em = await pickEmoji(); if (em) { stickers.push({ type: 'emoji', em, x: 50, y: 40, s: 1 }); paint(); } return; }
    if (k === 'gif') { const src = await pickGif({ tab: 'stickers', title: 'GIF ve çıkartma' }); if (src) { stickers.push({ type: 'gif', src, x: 50, y: 45, s: 1 }); paint(); } return; }
    if (k === 'text') { const tx = await textForm(); if (tx) { stickers.push({ type: 'text', ...tx, x: 50, y: 30, s: 1 }); paint(); } return; }
    if (k === 'music') {
      pickMusic().then((m) => {
        if (!m) return;
        stickers.push({ type: 'music', ...m, x: 50, y: 78 });
        stopAudio(); paint();
      });
      return;
    }
    const forms = {
      poll: `<input class="field" name="a" maxlength="80" placeholder="Soru (ör. Hangisi daha güzel?)">
        <input class="field" name="o1" maxlength="30" placeholder="1. seçenek" value="Evet"><input class="field" name="o2" maxlength="30" placeholder="2. seçenek" value="Hayır">
        <input class="field" name="o3" maxlength="30" placeholder="3. seçenek (isteğe bağlı)">`,
      question: '<input class="field" name="a" maxlength="80" value="Bana bir soru sor">',
    };
    const titles = { poll: 'Anket ekle', question: 'Soru kutusu' };
    sheet(titles[k], `<form class="form">${forms[k]}<button class="btn primary block">Ekle</button></form>`, {
      onMount(sh, close) {
        const f = sh.querySelector('form');
        setTimeout(() => f.a?.focus(), 50);
        f.onsubmit = (e) => {
          e.preventDefault();
          const a = f.a.value.trim();
          if (k === 'poll') {
            const options = [f.o1.value, f.o2.value, f.o3.value].map((x) => x.trim()).filter(Boolean);
            if (options.length < 2) return toast('En az iki seçenek yaz.');
            stickers.push({ type: 'poll', q: a, options, x: 50, y: 55 });
          }
          if (k === 'question') stickers.push({ type: 'question', q: a || 'Bana bir soru sor', x: 50, y: 45 });
          close(); paint();
        };
      },
    });
  }

  // ---------- Dosya seçimi ----------
  async function choose() {
    const accept = { reel: 'video/*', story: 'image/*,video/*', image: 'image/*' }[mode];
    const fs = await pickFiles(accept, mode === 'image');
    if (!fs.length) return;
    if (fs.some((f) => f.size > 40 * 1024 * 1024)) return toast('Dosya en fazla 40 MB olabilir. Daha kısa bir video seç.', { ms: 4500 });
    // Fotoğrafları hemen JPEG'e çevir: HEIC gibi her tarayıcının açamadığı biçimler önizlemede de görünsün
    const prep = async (f) => {
      try {
        const r = await prepareMedia(f);
        if (mode === 'image' && isVideoFile(r)) { toast('Gönderiye fotoğraf ekleyebilirsin; video için Vitrin’i seç.'); return null; }
        return r;
      } catch (e) { toast(e.message || 'Dosya açılamadı.'); return null; }
    };
    const slow = fs.some((f) => isHeicFile(f) || !fileType(f));
    if (slow) toast('Fotoğraf hazırlanıyor…', { ms: 1800 });
    picker.classList.add('busy');
    const ready2 = [];
    try { for (const f of (mode === 'image' ? fs : fs.slice(0, 1))) { const r = await prep(f); if (r) ready2.push(r); } } finally { picker.classList.remove('busy'); }
    if (!ready2.length) return;
    if (mode === 'image') {
      const room = 10 - items.length;
      if (ready2.length > room) toast('En fazla 10 fotoğraf ekleyebilirsin.');
      items.push(...ready2.slice(0, room).map((f) => ({ file: f, url: URL.createObjectURL(f), filter: '' })));
      cur = items.length - 1;
    } else {
      if (mode === 'reel' && !isVideoFile(ready2[0])) return toast('Vitrin için bir video seç.');
      file = ready2[0]; fileUrl = URL.createObjectURL(file);
      edit = { start: 0, end: null, speed: 1, filter: '', music: edit.music, muteOriginal: edit.muteOriginal, stickers: edit.stickers || [] };
      storyFilter = '';
    }
    paint();
  }

  view.querySelector('.seg').onclick = (e) => {
    const m = e.target.closest('[data-m]')?.dataset.m; if (!m) return;
    if (m === 'live') { location.hash = '#/live'; return; }
    if (m !== mode) { mode = m; file = null; items = []; stickers = []; stopAudio(); storyFilter = ''; storyBg = null; edit = { start: 0, end: null, speed: 1, filter: '', music: null, muteOriginal: false, stickers: [] }; }
    view.querySelectorAll('.seg button').forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
    paint();
  };
  swipeFilters(picker, () => (mode === 'image' ? items[cur]?.filter : mode === 'story' ? storyFilter : edit.filter), (f) => {
    if (!ready() || mode === 'text' || (mode === 'story' && !file)) return;
    if (mode === 'image') items[cur].filter = f; else if (mode === 'story') storyFilter = f; else edit.filter = f;
    if (mode === 'reel') { const v = picker.querySelector('video'); if (v) v.style.filter = filterCss(f); tools.querySelector('.etabs [data-t=filter]')?.click(); } else paint();
  });
  paint();

  // ---------- Paylaş ----------
  const bar = view.querySelector('.bar');
  const share = async () => {
    if (!ready()) return;
    goBtns.forEach((b) => { b.disabled = true; });
    bar.hidden = false;
    const fill = bar.querySelector('i');
    const prog = (base, span) => (p) => { fill.style.width = `${Math.round((base + p * span) * 100)}%`; };
    try {
      if (mode === 'text') {
        const p = await api('/posts', { body: { type: 'text', caption: postText, bg: postBg } });
        toast('Paylaşıldı.');
        location.hash = `#/p/${p.id}`;
        return;
      }
      if (mode === 'image') {
        const out = [];
        for (let i = 0; i < items.length; i++) {
          const up = await uploadPrepared(await compressImage(items[i].file), prog(i / items.length, 1 / items.length));
          out.push({ media: up.url, type: 'image', filter: items[i].filter || null });
        }
        const p = await api('/posts', { body: { type: 'image', items: out, caption: view.querySelector('.cap').value } });
        toast('Gönderi paylaşıldı.');
        location.hash = `#/p/${p.id}`;
        return;
      }
      const isImg = !file || !isVideoFile(file);
      if (mode === 'story') {
        const up = file ? await uploadPrepared(isImg ? await compressImage(file) : file, prog(0, 0.8)) : null;
        const st = [];
        for (const s of stickers) {
          if (s.type === 'music') {
            const src = s.file ? (await uploadFile(s.file, prog(0.8, 0.2))).url : s.src;
            st.push({ type: 'music', src, title: s.title, artist: s.artist, cover: s.cover, spotifyUrl: s.spotifyUrl, x: s.x, y: s.y });
          } else st.push(s);
        }
        await api('/stories', { body: { media: up?.url || null, mediaType: isImg ? 'image' : 'video', bg: file ? null : storyBg, stickers: st, filter: storyFilter || null } });
        stopAudio();
        toast('Hikayen paylaşıldı.');
        location.hash = `#/stories/${state.me.id}`;
        return;
      }
      const pf = await posterFrom(file, edit.start + 0.3);
      const poster = pf ? (await uploadFile(pf)).url : null;
      const m = edit.music;
      const up = await uploadPrepared(file, prog(0, m?.file ? 0.8 : 1));
      let audio = null;
      if (m) audio = m.file ? (await uploadFile(m.file, prog(0.8, 0.2))).url : m.src;
      const p = await api('/posts', {
        body: {
          type: 'reel', items: [{ media: up.url, type: 'video', poster }], caption: view.querySelector('.cap').value,
          edit: {
            start: edit.start, end: edit.end, speed: edit.speed, filter: edit.filter || null, audio,
            audioTitle: m?.title || '', audioArtist: m?.artist || '', audioCover: m?.cover || null, spotifyUrl: m?.spotifyUrl || null, muteOriginal: edit.muteOriginal, stickers: edit.stickers,
          },
        },
      });
      stopAudio();
      toast('Vitrinde paylaşıldı.');
      location.hash = `#/vitrin/${p.id}`;
    } catch (e) {
      toast(e.message); bar.hidden = true; goBtns.forEach((b) => { b.disabled = false; });
    }
  };
  goBtns.forEach((b) => { b.onclick = share; });
  return () => { stopAudio(); unscale?.(); };
}

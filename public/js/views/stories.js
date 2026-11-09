import { icon } from '../icons.js';
import {
  state, api, esc, ago, toast, sheet, avatar, emit, nm, filterCss, scaleStickerLayer, stkPos,
} from '../core.js';
import { musicChip, musicLine } from '../music.js';

function pollHtml(st, mine) {
  const showRes = mine || st.mine != null;
  const total = st.total || 0;
  return `<div class="stk poll act" data-sid="${esc(st.id)}" style="${stkPos(st)}">${st.q ? `<b>${esc(st.q)}</b>` : ''}
    ${st.options.map((o, i) => {
    const pct = total ? Math.round(((st.counts?.[i] || 0) / total) * 100) : 0;
    return `<button data-o="${i}" class="${st.mine === i ? 'me' : ''} ${showRes ? 'res' : ''}" ${showRes ? 'disabled' : ''}>${showRes ? `<i style="width:${pct}%"></i>` : ''}<span>${esc(o)}</span>${showRes ? `<em>%${pct}</em>` : ''}</button>`;
  }).join('')}${mine ? `<small>${total} oy</small>` : ''}</div>`;
}
function stickersHtml(it, mine) {
  return (it.stickers || []).map((st) => {
    const pos = stkPos(st);
    if (st.type === 'poll') return pollHtml(st, mine);
    if (st.type === 'question') return `<button class="stk q act" data-sid="${esc(st.id)}" style="${pos}"><b>${esc(st.q)}</b><span>${mine ? 'Yanıtları görmek için görüntüleyenlere bak' : 'Yanıtla…'}</span></button>`;
    if (st.type === 'music') {
      if (st.style === 'hide') return '';
      const cls = `stk mu ${st.style === 'mini' ? 'mini' : ''}`;
      return st.spotifyUrl ? `<a class="${cls} act" href="${esc(st.spotifyUrl)}" target="_blank" rel="noopener" style="${pos}">${musicChip(st)}<em>Spotify</em></a>` : `<div class="${cls}" style="${pos}">${musicChip(st)}</div>`;
    }
    if (st.type === 'text') return `<div class="stk txt sz-${esc(st.size || 'm')} ${st.bgc ? 'bgc' : ''}" style="${pos};color:${esc(st.color)}">${esc(st.text)}</div>`;
    if (st.type === 'emoji') return `<div class="stk em" style="${pos}">${esc(st.em)}</div>`;
    if (st.type === 'gif') return `<img class="stk gif" style="${pos}" src="${esc(st.src)}" alt="">`;
    if (st.type === 'mention') return `<a class="stk men act" href="#/u/${esc(st.username)}" style="${pos}">@${esc(st.username)}</a>`;
    return '';
  }).join('');
}

const muOf = (it) => (it.stickers || []).find((x) => x.type === 'music');
// Ses tercihi tüm hikayelerde geçerli (Instagram gibi bir kez kapatınca kapalı kalır)
let soundOff = false;

export default async function stories(view, userId) {
  view.innerHTML = '<div class="story-v"><div class="spinner" style="margin-top:45vh"></div></div>';
  if (userId === 'me') userId = state.me.id;
  const groups = await api('/stories');
  let gi = groups.findIndex((g) => g.user.id === userId);
  if (gi < 0) { view.innerHTML = `<div class="empty"><div class="big">${icon('camera')}</div><h2>Hikaye bulunamadı</h2>Hikayeler 24 saat sonra kaybolur.<p><a class="btn primary" href="#/">Ana sayfa</a></p></div>`; return null; }
  let ii = Math.max(0, groups[gi].items.findIndex((x) => !x.seen));
  let raf = 0; let t0 = 0; let dur = 5000; let paused = false; let pausedAt = 0; let closed = false;
  let music = null;
  let unscale = null;
  const stopMusic = () => { if (music) { music.pause(); music.src = ''; music = null; } };

  const close = () => { closed = true; cancelAnimationFrame(raf); stopMusic(); history.length > 1 ? history.back() : (location.hash = '#/'); };

  function show() {
    cancelAnimationFrame(raf);
    stopMusic();
    const g = groups[gi]; const it = g.items[ii];
    const mine = g.user.id === state.me.id;
    view.innerHTML = `<div class="story-v">
      <div class="media">${it.mediaType === 'text' || !it.media ? `<div class="tstory tbg-${esc(it.bg || 'g2')}"></div>` : it.mediaType === 'video' ? `<video src="${esc(it.media)}" playsinline autoplay style="filter:${filterCss(it.filter)}"></video>` : `<img class="blurbg" src="${esc(it.media)}" alt=""><img class="fit" src="${esc(it.media)}" alt="" style="filter:${filterCss(it.filter)}">`}</div>
      <div class="bars">${g.items.map((_, i) => `<i><b style="width:${i < ii ? 100 : 0}%"></b></i>`).join('')}</div>
      <div class="head">
        <a href="#/u/${esc(g.user.username)}" class="row hd-u"><img class="av av-32" src="${esc(g.user.avatar)}" alt=""><span class="hd-t"><span class="hd-1"><b class="ellipsis">${nm(g.user, 'username')}</b><span class="hd-ago">${ago(it.at)}</span>${it.reshareOf ? `<span class="rs-of">${icon('repost')} @${esc(it.reshareOf.username)}</span>` : ''}</span>${muOf(it) ? musicLine(muOf(it)) : ''}</span></a>
        ${muOf(it) || it.mediaType === 'video' ? `<button class="snd-t" aria-label="Sesi aç/kapat">${icon(soundOff ? 'mute' : 'volume')}</button>` : ''}
        ${mine ? `<button class="del" aria-label="Sil">${icon('trash')}</button>` : `<button class="more" aria-label="Diğer">${icon('more')}</button>`}
        <button class="x" aria-label="Kapat">${icon('close')}</button>
      </div>
      <div class="tapl"></div><div class="tapr"></div>
      <div class="stk-layer">${stickersHtml(it, mine)}</div>
      <div class="foot">${mine
    ? `<button class="vw">${icon('eye')} ${it.viewerCount || 0} görüntüleme</button>`
    : g.user.role === 'official' ? '<a class="rp-fal" href="#/destek">🛡️ SwipeUp resmi hesabı · yanıt kapalı</a>'
    : g.user.role === 'falci' || state.me.role === 'falci' ? `<a class="rp-fal" href="#/fal">🔮 ${state.me.role === 'falci' ? 'Hikayelere yanıt kapalı' : 'Falcı Teyze’ye fal baktır'}</a>`
    : `${(it.stickers || []).some((x) => x.type === 'mention' && x.username === state.me.username) ? `<button class="rs-add">${icon('plus')} Hikayene ekle</button>` : ''}<div class="sr-bar" hidden>${['😂', '😮', '😍', '😢', '👏', '🔥', '🎉', '💯'].map((e) => `<button type="button" data-e="${e}">${e}</button>`).join('')}</div><form class="rp" style="display:flex;gap:10px;flex:1"><input placeholder="${esc(g.user.name.split(' ')[0])} kişisine yanıt ver..." maxlength="500"><button type="button" class="sr-heart ${it.myReaction === '❤️' ? 'on' : ''}" aria-label="Beğen">${icon('heart', '', it.myReaction === '❤️' ? 'fill="currentColor"' : '')}</button><button aria-label="Gönder">${icon('send')}</button></form>`}</div>
    </div>`;
    if (!mine && !it.seen) { it.seen = true; api(`/stories/${it.id}/view`, { body: {} }).catch(() => {}); }
    const v = view.querySelector('video');
    const mu = (it.stickers || []).find((x) => x.type === 'music');
    dur = mu ? 15000 : 5000;
    const sndBtn = view.querySelector('.snd-t');
    const paintSnd = () => { if (sndBtn) sndBtn.innerHTML = icon(soundOff ? 'mute' : 'volume'); };
    if (mu) {
      music = new Audio(mu.src); music.currentTime = mu.start || 0; music.muted = soundOff;
      // Tarayıcı sesli oynatmayı engellerse sessize al, ses düğmesiyle açılır
      music.play().catch(() => { soundOff = true; paintSnd(); if (music) { music.muted = true; music.play().catch(() => {}); } });
      if (v) v.muted = true;
    }
    sndBtn?.addEventListener('click', (e) => {
      e.stopPropagation(); soundOff = !soundOff; paintSnd();
      if (music) { music.muted = soundOff; if (!soundOff) music.play().catch(() => {}); } else if (v) { v.muted = soundOff; if (!soundOff) v.play().catch(() => {}); view.querySelector('.snd')?.remove(); }
    });
    unscale?.(); unscale = scaleStickerLayer(view.querySelector('.stk-layer'));
    // Video yüklenip oynamaya başlayana kadar süre işlemesin; iPhone sesli otomatik oynatmayı
    // engellerse sessiz oynat ve "Sesi aç" düğmesi göster
    let waiting = !!v;
    if (v && !mu) v.muted = soundOff;
    if (v) {
      view.querySelector('.story-v').classList.add('loading');
      v.onloadedmetadata = () => { dur = Math.min(30000, (v.duration || 5) * 1000); };
      const go = () => { if (!waiting) return; waiting = false; t0 = performance.now(); view.querySelector('.story-v')?.classList.remove('loading'); };
      v.addEventListener('playing', go, { once: true });
      v.addEventListener('error', () => { go(); toast('Bu video bu cihazda oynatılamıyor.'); }, { once: true });
      setTimeout(go, 12000);
      v.play().catch(() => {
        v.muted = true; if (!mu) { soundOff = true; paintSnd(); }
        v.play().catch(() => {});
        if (!mu) {
          const b = document.createElement('button'); b.className = 'snd'; b.textContent = '🔇 Sesi aç';
          b.onclick = (e) => { e.stopPropagation(); v.muted = false; v.play().catch(() => {}); b.remove(); };
          view.querySelector('.story-v').append(b);
        }
      });
    }
    t0 = performance.now(); paused = false;
    const bar = view.querySelectorAll('.bars b')[ii];
    const tick = (t) => {
      if (closed) return;
      if (!paused && !waiting) {
        const p = Math.min(1, (t - t0) / dur);
        bar.style.width = `${p * 100}%`;
        if (p >= 1) return next();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const pause = (on_) => {
      if (on_ && !paused) { paused = true; pausedAt = performance.now(); v?.pause(); music?.pause(); }
      if (!on_ && paused) { paused = false; t0 += performance.now() - pausedAt; v?.play().catch(() => {}); music?.play().catch(() => {}); }
    };
    // Tek dokunuş: sol üçte bir geri, sağ taraf ileri. Basılı tutunca durur (Instagram gibi).
    // Yavaş dokunuşlar da sayılsın diye eşik 450 ms; parmak kayarsa dokunuş sayılmaz.
    let downAt = 0; let dx = 0; let dy = 0; let downOn = null;
    ['tapl', 'tapr'].forEach((c) => {
      const z = view.querySelector('.' + c);
      z.addEventListener('pointerdown', (e) => { downAt = Date.now(); dx = e.clientX; dy = e.clientY; downOn = c; try { z.setPointerCapture(e.pointerId); } catch {} pause(true); });
      z.addEventListener('pointerup', (e) => {
        if (downOn !== c) return; downOn = null; pause(false);
        if (Date.now() - downAt < 450 && Math.hypot(e.clientX - dx, e.clientY - dy) < 14) (c === 'tapl' ? prev : next)();
      });
      z.addEventListener('pointercancel', () => { downOn = null; pause(false); });
      z.addEventListener('contextmenu', (e) => e.preventDefault());
    });
    view.querySelector('.x').onclick = close;
    view.querySelectorAll('.stk.poll button[data-o]').forEach((b) => {
      b.onclick = async (e) => {
        e.stopPropagation();
        if (mine) return;
        const box = b.closest('.stk');
        const st = it.stickers.find((x) => x.id === box.dataset.sid);
        try {
          const r = await api(`/stories/${it.id}/vote`, { body: { sticker: st.id, option: +b.dataset.o } });
          Object.assign(st, r);
          box.outerHTML = pollHtml(st, false);
          if (navigator.vibrate) navigator.vibrate(12);
        } catch (er) { toast(er.message); }
      };
    });
    view.querySelector('.stk.q')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (mine) return view.querySelector('.vw')?.click();
      pause(true);
      const st = it.stickers.find((x) => x.id === e.currentTarget.dataset.sid);
      sheet(st.q, '<form class="form"><textarea class="field" name="a" rows="3" maxlength="300" placeholder="Yanıtını yaz"></textarea><button class="btn primary block">Gönder</button></form>', {
        onMount(sh, closeS) {
          const f = sh.querySelector('form');
          setTimeout(() => f.a.focus(), 60);
          f.onsubmit = async (ev) => {
            ev.preventDefault();
            try { await api(`/stories/${it.id}/answer`, { body: { sticker: st.id, text: f.a.value } }); closeS(); toast('Yanıtın gönderildi.'); pause(false); } catch (er) { toast(er.message); }
          };
          document.querySelector('.sheet-bg')?.addEventListener('click', () => pause(false));
        },
      });
    });
    view.querySelector('.rs-add')?.addEventListener('click', async (e) => {
      e.stopPropagation(); pause(true);
      if (!confirm(`@${g.user.username} kişisinin seni etiketlediği bu hikaye senin hikayende de paylaşılsın mı?`)) return pause(false);
      try {
        await api('/stories', { body: { media: it.media, mediaType: it.mediaType, bg: it.bg, filter: it.filter, reshareOf: g.user.id, stickers: (it.stickers || []).filter((x) => ['text', 'emoji', 'gif', 'mention', 'music'].includes(x.type)) } });
        toast('Hikayende paylaşıldı.'); emit('stories:update', {});
      } catch (er) { toast(er.message); }
      pause(false);
    });
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
          const d = await api(`/stories/${it.id}/viewers?full=1`);
          const us = d.viewers;
          const polls = d.stickers.filter((x) => x.type === 'poll');
          sh.querySelector('.vl').innerHTML = `${polls.map((p) => `<div class="sv-poll"><b>${esc(p.q || 'Anket')}</b>${p.options.map((o, i) => `<div class="row"><span class="grow">${esc(o)}</span><b>${p.counts[i]}</b></div>`).join('')}</div>`).join('')}
            ${d.answers.length ? `<div class="sh-sec">Soru yanıtları</div>${d.answers.slice().reverse().map((a) => `<div class="list-item">${avatar(a.user, 40, { dot: false })}<div class="grow"><div class="b">${nm(a.user, 'username')}</div><div>${esc(a.text)}</div></div><span class="muted" style="font-size:12px">${ago(a.at)}</span></div>`).join('')}` : ''}
            ${d.answers.length || polls.length ? '<div class="sh-sec">Görüntüleyenler</div>' : ''}
            ${us.length ? us.map((u) => `<a class="list-item" href="#/u/${esc(u.username)}">${avatar(u, 44)}<div class="grow"><div class="b">${nm(u)}</div><div class="sub">@${esc(u.username)}</div></div>${u.vote ? `<span class="chip">${esc(u.vote)}</span>` : ''}${u.reaction ? `<span class="sr-em">${u.reaction}</span>` : ''}</a>`).join('') : '<div class="empty">Henüz kimse görmedi.</div>'}`;
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
      const bar = view.querySelector('.sr-bar');
      const react = async (emoji, btn) => {
        try {
          await api(`/stories/${it.id}/react`, { body: { emoji } }); it.myReaction = emoji;
          const fly = document.createElement('div'); fly.className = 'sr-fly'; fly.textContent = emoji; (view.querySelector('.story-v') || view).append(fly); setTimeout(() => fly.remove(), 1300);
          navigator.vibrate?.(12);
          if (btn?.classList.contains('sr-heart')) { btn.classList.add('on'); btn.innerHTML = icon('heart', '', 'fill="currentColor"'); }
        } catch (er) { toast(er.message); }
      };
      inp.addEventListener('focus', () => { pause(true); bar.hidden = false; });
      inp.addEventListener('blur', () => { setTimeout(() => { bar.hidden = true; }, 150); if (!inp.value) pause(false); });
      bar.addEventListener('pointerdown', (e) => { const b = e.target.closest('[data-e]'); if (!b) return; e.preventDefault(); inp.blur(); react(b.dataset.e); });
      rp.querySelector('.sr-heart').onclick = (e) => react('❤️', e.currentTarget);
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
  return () => { closed = true; cancelAnimationFrame(raf); stopMusic(); unscale?.(); window.removeEventListener('keydown', key); emit('stories:update', {}); };
}

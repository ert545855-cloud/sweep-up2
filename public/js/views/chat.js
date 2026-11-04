import { icon } from '../icons.js';
import {
  state, api, esc, on, clock, dayLabel, lastSeen, avatar, toast, pickFile, compressImage, uploadFile, refreshBadges, el, sheet, audioRecorder, fmtDur, reportUser, reportMessage, nm,
} from '../core.js';
import { restoreDraft } from '../update.js';
import { startCall } from '../calls.js';
import { FAL_TYPES, zodiacOf } from '../fal-data.js';

const EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];
const planDate = (t) => new Date(t).toLocaleString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const localInput = (t) => { const d = new Date(t - new Date().getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };

// OpenStreetMap karolarıyla küçük harita önizlemesi
function mapHtml(lat, lng) {
  const z = 15; const n = 2 ** z;
  const x = ((lng + 180) / 360) * n;
  const r = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  const tx = Math.floor(x); const ty = Math.floor(y);
  const ox = 120 - ((x - tx) * 256 + 256); const oy = 75 - ((y - ty) * 256 + 256);
  let tiles = '';
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) tiles += `<img src="https://tile.openstreetmap.org/${z}/${tx + i}/${ty + j}.png" style="left:${(i + 1) * 256}px;top:${(j + 1) * 256}px" alt="" loading="lazy">`;
  return `<span class="map"><span class="tiles" style="transform:translate(${ox}px,${oy}px)">${tiles}</span><span class="pin">${icon('mapPin')}</span><small class="osm">© OpenStreetMap</small></span>`;
}
const TTL_OPTS = [[0, 'Kapalı'], [3600000, '1 saat'], [86400000, '24 saat'], [604800000, '7 gün']];
const ttlLabel = (t) => (TTL_OPTS.find((x) => x[0] === t) || [0, ''])[1];

function waveBars(id, n = 28) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return Array.from({ length: n }, (_, i) => { h = (h * 1103515245 + 12345) >>> 0; return 25 + (h % 75) * (0.6 + 0.4 * Math.sin(i / 3)); });
}

export default async function chat(view, chatId) {
  view.innerHTML = '<div class="chat"><div class="spinner" style="margin-top:40vh"></div></div>';
  let data;
  try { data = await api(`/chats/${chatId}`); } catch (e) {
    view.innerHTML = `<div class="empty"><div class="big">${icon('send')}</div><h2>Sohbet bulunamadı</h2>${esc(e.message)}<p><a class="btn primary" href="#/chats">Mesajlara dön</a></p></div>`;
    return null;
  }
  const isGroup = !!data.isGroup;
  const other = data.other;
  const members = new Map((data.members || []).map((m) => [m.id, m]));
  const msgs = data.messages;
  const s = state.socket;
  let replyTo = null;
  let blocked = !!data.blocked;
  let ttl = data.ttl || 0;
  let falLock = data.falLock || null;
  const falChat = !isGroup && (other?.role === 'falci' || state.me.role === 'falci');

  view.innerHTML = `<div class="chat">
    <header class="topbar bordered">
      <a class="ib" href="#/chats" aria-label="Geri">${icon('back')}</a>
      <a class="who" href="#/chat/${esc(chatId)}/info">${avatar(other, 40, { ring: true, dot: !isGroup })}
        <div class="grow"><div class="n ellipsis">${nm(other)}</div><div class="s ellipsis"></div></div></a>
      <button class="ib ttl-ind" aria-label="Kaybolan mesajlar" ${ttl ? '' : 'hidden'}>${icon('timer')}</button>
      ${isGroup || falChat ? '' : `<button class="ib vc" aria-label="Sesli ara">${icon('phone')}</button><button class="ib vv" aria-label="Görüntülü ara">${icon('video')}</button>`}
    </header>
    <div class="msgs" role="log" aria-live="polite"></div>
    <div class="composer"></div></div>`;

  const box = view.querySelector('.msgs');
  const st = view.querySelector('.s');
  const comp = view.querySelector('.composer');
  const typingNow = new Map();

  view.querySelector('.vc')?.addEventListener('click', () => startCall(chatId, other, false));
  view.querySelector('.vv')?.addEventListener('click', () => startCall(chatId, other, true));

  const paintStatus = () => {
    const tp = [...typingNow.entries()];
    if (tp.length) {
      const [uid, kind] = tp[0];
      const who = isGroup ? `${(members.get(uid)?.name || '').split(' ')[0]} ` : '';
      st.textContent = `${who}${kind === 'audio' ? 'ses kaydediyor...' : 'yazıyor...'}`;
      st.classList.add('on');
      return;
    }
    if (isGroup) {
      const on_ = [...members.values()].filter((m) => m.id !== state.me.id && state.presence.get(m.id)?.online).length;
      st.textContent = `${members.size} üye${on_ ? ` · ${on_} çevrimiçi` : ''}`;
      st.classList.remove('on');
      return;
    }
    st.textContent = lastSeen(other);
    st.classList.toggle('on', st.textContent === 'çevrimiçi');
  };
  paintStatus();

  const othersOf = () => (isGroup ? [...members.keys()].filter((id) => id !== state.me.id) : [other.id]);
  const tick = (m) => {
    if (m.from !== state.me.id || m.system || m.deleted) return '';
    const os = othersOf();
    if (os.length && os.every((id) => m.readBy.includes(id))) return `<span class="read">${icon('dcheck')}</span>`;
    if (os.length && os.every((id) => m.deliveredTo.includes(id))) return icon('dcheck');
    return icon('check');
  };
  const reactsHtml = (m) => {
    const r = Object.values(m.reactions || {});
    if (!r.length) return '';
    const counts = r.reduce((a, e) => ((a[e] = (a[e] || 0) + 1), a), {});
    return `<div class="reacts">${Object.keys(counts).join('')}${r.length > 1 ? `<small>${r.length}</small>` : ''}</div>`;
  };
  const audioHtml = (m) => `<div class="audio-b" data-src="${esc(m.media)}"><button class="pp" aria-label="Oynat">${icon('play')}</button>
      <div class="wave">${waveBars(m.id).map((h) => `<i style="height:${h}%"></i>`).join('')}</div><span class="dur">${fmtDur(m.duration || 0)}</span></div>`;

  const bubbleInner = (m) => {
    const meta = `<span class="meta">${m.expiresAt ? icon('timer', 'ttl-i') : ''}${clock(m.at)}<span class="tk">${tick(m)}</span></span>`;
    if (m.deleted) return `<div class="msg deleted">${icon('block', '', 'style="width:14px;height:14px;vertical-align:-2px"')} Bu mesaj silindi${meta}</div>`;
    const reply = m.reply ? `<span class="reply"><b>${esc(m.reply.from === state.me.id ? 'Sen' : (m.reply.fromName || ''))}</b>${esc(m.reply.text || { audio: '🎤 Sesli mesaj', video: '🎥 Video', image: '📷 Fotoğraf' }[m.reply.mediaType] || '')}</span>` : '';
    const story = m.story ? `<span class="story-ref">${m.story.media ? `<img src="${esc(m.story.media)}" alt="">` : ''}<span>${m.story.reaction ? (m.from === state.me.id ? 'Hikayesine tepki verdin' : 'Hikayene tepki verdi') : 'Hikayeye yanıt'}</span></span>` : '';
    if (m.fal) {
      const f = m.fal; const t = FAL_TYPES[f.type] || { em: '🔮', name: 'Fal' };
      const z = zodiacOf(f.zodiac);
      return `<div class="msg fal-msg"><div class="fm-h"><span>${t.em}</span><b>${t.name} isteği</b>${f.status === 'answered' ? '<span class="chip fal-ok">Cevaplandı</span>' : '<span class="chip fal-wait-chip">Bekliyor</span>'}</div>
        ${f.images?.length ? `<div class="fq-imgs">${f.images.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Fincan fotoğrafı" loading="lazy"></a>`).join('')}</div>` : ''}
        ${f.cards?.length ? `<div class="fq-cards">${f.cards.map((c) => `<span class="chip"><small>${esc(c.pos)}</small> ${c.em} ${esc(c.name)}${c.rev ? ' (ters)' : ''}</span>`).join('')}</div>` : ''}
        ${z ? `<div class="fq-line">${z[2]} ${z[1]}${f.partner ? '' : ''}</div>` : ''}
        ${f.partner ? `<div class="fq-line">💞 ${esc(f.name)} & ${esc(f.partner.name)}${zodiacOf(f.partner.zodiac) ? ` (${zodiacOf(f.partner.zodiac)[2]} ${zodiacOf(f.partner.zodiac)[1]})` : ''}</div>` : ''}
        ${f.note ? `<p class="fq-note">${esc(f.note)}</p>` : ''}${meta}</div>`;
    }
    if (m.share) {
      const s = m.share;
      return `<a class="msg share-msg" href="${esc(s.url.replace(/^\//, ''))}">
          ${s.image ? `<span class="shm-img ${s.kind}">${s.kind === 'profile' || s.kind === 'live' ? `<img class="shm-av" src="${esc(s.image)}" alt="">` : `<img src="${esc(s.image)}" alt="" loading="lazy">`}${s.video ? `<i class="shm-play">${icon('play')}</i>` : ''}${s.kind === 'live' ? '<i class="shm-live">CANLI</i>' : ''}</span>` : ''}
          <span class="shm-b"><small>${esc(s.label)}</small><b>${esc(s.title)}${s.verified ? ' ✓' : ''}</b>${s.sub ? `<span>${esc(s.sub)}</span>` : ''}</span></a>
        ${m.text ? `<div class="msg">${reply}${esc(m.text)}${meta}</div>` : `<span class="shm-meta">${meta}</span>`}`;
    }
    if (m.game) return `<div class="msg game-msg">${gameHtml(m)}${meta}</div>`;
    if (m.plan) return `<div class="msg plan-msg">${planHtml(m)}${meta}</div>`;
    if (m.viewOnce) {
      const mine = m.from === state.me.id;
      const opened = m.viewOnceState === 'opened' || (m.openedBy || []).includes(state.me.id);
      return `<div class="msg vo-msg ${opened ? 'used' : ''}">${mine || opened
        ? `<span class="vo-ic">${icon('eye')}</span><span><b>Tek seferlik fotoğraf</b><small>${opened ? 'Açıldı' : 'Henüz açılmadı'}</small></span>`
        : `<button class="vo-open"><span class="vo-ic">1</span><span><b>Fotoğrafı aç</b><small>Sadece bir kez görebilirsin</small></span></button>`}${meta}</div>`;
    }
    if (m.location) {
      const l = m.location;
      return `<div class="msg loc"><a href="https://maps.google.com/?q=${l.lat},${l.lng}" target="_blank" rel="noopener">${mapHtml(l.lat, l.lng)}
        <span class="loc-t">${icon('mapPin')}<span><b>${esc(l.label || 'Konum')}</b><small>Haritada aç</small></span></span></a>${meta}</div>`;
    }
    if (m.mediaType === 'audio') return `<div class="msg">${reply}${audioHtml(m)}${meta}</div>`;
    if (m.media) {
      return `<div class="msg media">${m.mediaType === 'video'
        ? `<video src="${esc(m.media)}" controls playsinline preload="metadata"></video>`
        : `<a href="${esc(m.media)}" target="_blank" rel="noopener"><img src="${esc(m.media)}" alt="Fotoğraf" loading="lazy"></a>`}${m.text ? '' : meta}</div>
        ${m.text ? `<div class="msg">${reply}${esc(m.text)}${meta}</div>` : ''}`;
    }
    const quote = m.quote?.kind === 'prompt' ? `<span class="pq-quote"><small>${esc(m.quote.q)}</small>${esc(m.quote.a)}</span>` : '';
    if (m.superMsg) return `<div class="msg super-msg"><span class="sm-tag">💌 Süper mesaj</span>${esc(m.text)}${meta}</div>`;
    return `<div class="msg">${story}${quote}${reply}${esc(m.text)}${meta}</div>`;
  };
  const otherName = () => (other?.name || '').split(' ')[0];
  function gameHtml(m) {
    const g = m.game; const me = state.me.id; const mine = m.from === me;
    if (g.kind === 'ikidogru') {
      const guessed = Object.entries(g.guesses || {})[0];
      const head = `<div class="gm-h">🎲 <b>İki doğru bir yalan</b></div>`;
      if (!guessed) {
        if (mine) return `${head}<ol class="gm-items">${g.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ol><p class="gm-s">${esc(otherName())} yalanı bulmaya çalışıyor…</p>`;
        return `${head}<p class="gm-s">Sence hangisi yalan?</p><div class="gm-opts">${g.items.map((t, i) => `<button class="gm-guess" data-i="${i}">${esc(t)}</button>`).join('')}</div>`;
      }
      const [, gi] = guessed; const right = gi === g.lie;
      return `${head}<ol class="gm-items">${g.items.map((t, i) => `<li class="${i === g.lie ? 'lie' : ''} ${i === gi ? 'picked' : ''}">${esc(t)}${i === g.lie ? '<em>yalan</em>' : ''}</li>`).join('')}</ol>
        <p class="gm-r ${right ? 'ok' : 'no'}">${right ? (mine ? `${esc(otherName())} yalanı buldu 🎯` : 'Bildin! 🎯') : (mine ? `${esc(otherName())} kandırıldı 😏` : 'Kandırıldın 😄')}</p>`;
    }
    if (g.kind === 'bumu') {
      const head = `<div class="gm-h">🤔 <b>Bu mu şu mu?</b></div>`;
      const ans = g.answers || {}; const mineA = ans[me]; const ids = Object.keys(ans);
      if (ids.length >= 2) {
        const oid = ids.find((x) => x !== me);
        const a = ans[me]; const b = ans[oid];
        const same = g.qs.filter((_, i) => a[i] === b[i]).length;
        return `${head}<div class="bm-res">${g.qs.map((q, i) => `<div class="bm-row ${a[i] === b[i] ? 'same' : ''}"><span>${esc(q[a[i]])}</span><i>${a[i] === b[i] ? '💞' : '↔'}</i><span>${esc(q[b[i]])}</span></div>`).join('')}</div>
          <p class="gm-r ok">${g.qs.length} soruda ${same} uyum${same >= 4 ? ' 🔥' : same >= 3 ? ' ✨' : ''}</p><small class="bm-leg"><span>Sen</span><span>${esc(otherName())}</span></small>`;
      }
      if (mineA) return `${head}<p class="gm-s">Cevapların gönderildi. ${esc(otherName())} cevaplayınca uyumunuz görünecek.</p>`;
      return `${head}<p class="gm-s">${g.qs.length} hızlı soru: ${g.qs.slice(0, 2).map((q) => `${esc(q[0])} mu ${esc(q[1])} mu`).join(', ')}…</p><button class="btn primary sm bm-play">Cevapla</button>`;
    }
    return '';
  }
  function planHtml(m) {
    const p = m.plan; const me = state.me.id;
    const past = p.when < Date.now(); const ok = p.ok?.[me];
    return `<div class="pl-h">📅 <b>Buluşma planı</b></div>
      <div class="pl-row"><span>Ne zaman</span><b>${esc(planDate(p.when))}</b></div>
      <div class="pl-row"><span>Nerede</span><b>${esc(p.place)}</b></div>
      ${p.note ? `<p class="pl-note">${esc(p.note)}</p>` : ''}
      <div class="pl-btns"><button class="btn sm pl-share">${icon('shield')} Arkadaşınla paylaş</button>
      ${ok ? '<span class="pill ok">💛 İyi olduğunu bildirdin</span>' : past ? '<button class="btn sm primary pl-ok">İyiyim</button>' : ''}</div>`;
  }
  const bubble = (m, prev) => {
    const day = !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString();
    const dayHtml = day ? `<div class="day">${dayLabel(m.at)}</div>` : '';
    if (m.system) return `${dayHtml}<div class="sys" data-id="${esc(m.id)}">${esc(m.text)}</div>`;
    const mine = m.from === state.me.id;
    const gap = prev && (prev.from !== m.from || prev.system || m.at - prev.at > 300000);
    const sender = isGroup && !mine && gap !== false && (!prev || prev.from !== m.from) ? `<span class="sender">${esc(members.get(m.from)?.name || '')}</span>` : '';
    return `${dayHtml}<div class="mwrap ${mine ? 'me' : 'them'} ${gap ? 'gap' : ''}" data-id="${esc(m.id)}">${sender}${bubbleInner(m)}${reactsHtml(m)}</div>`;
  };
  const paintAll = () => {
    box.innerHTML = msgs.length
      ? msgs.map((m, i) => bubble(m, msgs[i - 1])).join('')
      : `<div class="empty">${avatar(other, 72, { dot: false })}<h2>${esc(other.name)}</h2>${isGroup ? `${members.size} üye` : `@${esc(other.username)}`}<p>Bir merhaba ile başla 👋</p></div>`;
    box.scrollTop = box.scrollHeight;
  };
  const repaintOne = (m) => {
    const w = box.querySelector(`[data-id="${CSS.escape(m.id)}"]`);
    if (!w) return;
    const i = msgs.findIndex((x) => x.id === m.id);
    const tmp = el(`<div>${bubble(m, msgs[i - 1])}</div>`);
    w.replaceWith(tmp.querySelector(`[data-id="${CSS.escape(m.id)}"]`));
  };
  paintAll();

  // ---- Sesli mesaj oynatma ----
  let playing = null;
  box.addEventListener('click', (e) => {
    const pp = e.target.closest('.audio-b .pp'); if (!pp) return;
    const wrap = pp.closest('.audio-b');
    if (playing?.wrap === wrap) { playing.a.paused ? playing.a.play() : playing.a.pause(); return; }
    if (playing) { playing.a.pause(); playing.stop(); }
    const a = new Audio(wrap.dataset.src);
    const bars = wrap.querySelectorAll('.wave i'); const dur = wrap.querySelector('.dur');
    const stop = () => { pp.innerHTML = icon('play'); bars.forEach((b) => b.classList.remove('on')); };
    a.onplay = () => { pp.innerHTML = icon('pause'); };
    a.onpause = () => { pp.innerHTML = icon('play'); };
    a.ontimeupdate = () => {
      const d = a.duration && Number.isFinite(a.duration) ? a.duration : 0;
      if (d) { const k = Math.floor((a.currentTime / d) * bars.length); bars.forEach((b, i) => b.classList.toggle('on', i <= k)); }
      dur.textContent = fmtDur(a.currentTime);
    };
    a.onended = () => { stop(); playing = null; };
    a.play().catch(() => toast('Ses oynatılamadı.'));
    playing = { a, wrap, stop };
  });


  // ---- Oyun, plan ve tek seferlik fotoğraf ----
  const upd = (m) => { const i = msgs.findIndex((x) => x.id === m.id); if (i >= 0) { msgs[i] = m; repaintOne(m); } };
  box.addEventListener('click', async (e) => {
    const m = findMsg(e.target); if (!m) return;
    try {
      const gb = e.target.closest('.gm-guess');
      if (gb) { upd(await api(`/messages/${m.id}/game`, { body: { guess: +gb.dataset.i } })); return; }
      if (e.target.closest('.bm-play')) { bumuSheet(m); return; }
      if (e.target.closest('.vo-open')) { openViewOnce(m); return; }
      if (e.target.closest('.pl-share')) {
        const r = await api(`/messages/${m.id}/safety`, { body: {} });
        const url = `${location.origin}${r.url}`;
        const text = `Buluşma bilgilerim: ${planDate(m.plan.when)}, ${m.plan.place}. ${other.name} (@${other.username}) ile görüşüyorum. Durumumu buradan takip edebilirsin: ${url}`;
        if (navigator.share) await navigator.share({ title: 'SwipeUp buluşma güvenliği', text }).catch(() => {});
        else { await navigator.clipboard?.writeText(text); toast('Bağlantı kopyalandı. Bir arkadaşına gönder.'); }
        return;
      }
      if (e.target.closest('.pl-ok')) {
        const r = await api(`/messages/${m.id}/safety`, { body: {} });
        await api(`/safety/${r.token}/ok`, { body: {} });
        toast('Paylaştığın kişi iyi olduğunu görecek 💛');
      }
    } catch (er) { toast(er.message); }
  });
  function bumuSheet(m) {
    const g = m.game; const pick = g.qs.map(() => null);
    sheet('Bu mu şu mu?', `<div class="bm-form">${g.qs.map((q, i) => `<div class="bm-q" data-i="${i}"><button data-v="0">${esc(q[0])}</button><span>ya da</span><button data-v="1">${esc(q[1])}</button></div>`).join('')}
      <button class="btn primary block bm-send" disabled>Gönder</button></div>`, {
      onMount(sh, close) {
        const f = sh.querySelector('.bm-form');
        f.onclick = async (e) => {
          const b = e.target.closest('.bm-q button');
          if (b) {
            const row = b.closest('.bm-q'); pick[+row.dataset.i] = +b.dataset.v;
            row.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
            f.querySelector('.bm-send').disabled = pick.includes(null);
            return;
          }
          if (e.target.closest('.bm-send')) {
            try { upd(await api(`/messages/${m.id}/game`, { body: { answers: pick } })); close(); } catch (er) { toast(er.message); }
          }
        };
      },
    });
  }
  async function openViewOnce(m) {
    let r;
    try { r = await api(`/messages/${m.id}/open`, { body: {} }); } catch (er) { toast(er.message); return; }
    const ov = el(`<div class="vo-view" role="dialog" aria-label="Tek seferlik fotoğraf"><img src="${esc(r.media)}" alt="" draggable="false"><div class="vo-bar"><span>${icon('eye')} Kapatınca bir daha açılamaz</span><button class="ib vo-x" aria-label="Kapat">${icon('close')}</button></div></div>`);
    ov.addEventListener('contextmenu', (e) => e.preventDefault());
    const close = () => { ov.remove(); document.removeEventListener('visibilitychange', hide); };
    const hide = () => { if (document.visibilityState !== 'visible') close(); };
    document.addEventListener('visibilitychange', hide);
    ov.querySelector('.vo-x').onclick = close;
    document.body.append(ov);
    m.openedBy = [...(m.openedBy || []), state.me.id]; upd({ ...m, viewOnceState: 'opened' });
  }

  try {
    if (!localStorage.getItem('su_hint_msgmenu')) {
      localStorage.setItem('su_hint_msgmenu', '1');
      setTimeout(() => toast('İpucu: Bir mesaja basılı tutarak yanıtlayabilir, tepki verebilir ya da mesajı bildirebilirsin.', { ms: 6000 }), 900);
    }
  } catch {}
  // ---- Mesaj menüsü: uzun bas / sağ tık / çift dokun / sağa kaydır ----
  const findMsg = (node) => { const w = node.closest?.('.mwrap'); return w && msgs.find((m) => m.id === w.dataset.id); };
  const react = (m, emoji) => s?.emit('message:react', { id: m.id, emoji });
  function openMenu(m, wrap) {
    if (m.deleted || document.querySelector('#sheet-root .sheet')) return; // uzun basma + contextmenu aynı anda gelmesin
    document.querySelector('.emoji-pop')?.remove();
    const r = wrap.getBoundingClientRect();
    const pop = el(`<div class="emoji-pop">${EMOJIS.map((e) => `<button class="${m.reactions?.[state.me.id] === e ? 'on' : ''}">${e}</button>`).join('')}</div>`);
    document.body.append(pop);
    const pw = pop.offsetWidth;
    pop.style.top = `${Math.max(70, r.top - 56)}px`;
    pop.style.left = `${Math.min(window.innerWidth - pw - 8, Math.max(8, wrap.classList.contains('me') ? r.right - pw : r.left))}px`;
    pop.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; react(m, b.textContent); closeAll(); };
    const mine = m.from === state.me.id;
    const closeSheet = sheet(null, `<div class="menu">
      <button data-a="reply">${icon('reply')}Yanıtla</button>
      ${m.text ? `<button data-a="copy">${icon('copy')}Kopyala</button>` : ''}
      ${mine ? `<button data-a="delall" class="danger">${icon('trash')}Herkesten sil</button>` : ''}
      <button data-a="delme" class="danger">${icon('trash')}Benden sil</button>
      ${!mine ? `<button data-a="report" class="danger">${icon('flag')}Mesajı bildir</button>` : ''}
    </div>`, {
      onMount(sh, close) {
        sh.querySelector('.menu').onclick = async (e) => {
          const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
          closeAll();
          if (a === 'reply') setReply(m);
          if (a === 'copy') { await navigator.clipboard?.writeText(m.text); toast('Kopyalandı.'); }
          if (a === 'delall') s?.emit('message:delete', { id: m.id, forAll: true });
          if (a === 'delme') s?.emit('message:delete', { id: m.id, forAll: false });
          if (a === 'report') reportMessage({ kind: 'dm', id: m.id, user: members.get(m.from) || other, text: m.text || (m.location ? '📍 Konum' : ''), media: m.media });
        };
        close.__pop = pop;
      },
    });
    function closeAll() { pop.remove(); closeSheet(); }
    document.querySelector('.sheet-bg')?.addEventListener('click', () => pop.remove(), { once: true });
  }
  let lp = null; let sx = 0; let sy = 0; let swipeEl = null; let dx = 0;
  box.addEventListener('pointerdown', (e) => {
    const m = findMsg(e.target); if (!m || e.target.closest('a, video, .pp, button')) return;
    sx = e.clientX; sy = e.clientY; dx = 0; swipeEl = e.target.closest('.mwrap');
    lp = setTimeout(() => { lp = null; navigator.vibrate?.(15); openMenu(m, swipeEl); swipeEl = null; }, 450);
  });
  box.addEventListener('pointermove', (e) => {
    if (!swipeEl) return;
    const mx = e.clientX - sx; const my = e.clientY - sy;
    if (Math.abs(my) > 12 || Math.abs(mx) > 10) { clearTimeout(lp); lp = null; }
    if (Math.abs(my) > 24) { swipeEl.style.transform = ''; swipeEl = null; return; }
    if (mx > 0) { dx = Math.min(80, mx); swipeEl.style.transform = `translateX(${dx}px)`; }
  });
  const endSwipe = () => {
    clearTimeout(lp); lp = null;
    if (swipeEl) {
      const m = findMsg(swipeEl);
      swipeEl.style.transition = 'transform .2s'; swipeEl.style.transform = '';
      const w = swipeEl; setTimeout(() => { w.style.transition = ''; }, 220);
      if (dx > 60 && m && !m.deleted) { navigator.vibrate?.(10); setReply(m); }
      swipeEl = null;
    }
  };
  box.addEventListener('pointerup', endSwipe);
  box.addEventListener('pointercancel', endSwipe);
  box.addEventListener('contextmenu', (e) => { const m = findMsg(e.target); if (m) { e.preventDefault(); openMenu(m, e.target.closest('.mwrap')); } });
  box.addEventListener('dblclick', (e) => { const m = findMsg(e.target); if (m && !m.deleted) { react(m, '❤️'); window.getSelection()?.removeAllRanges(); } });

  // ---- Okundu ----
  const markRead = () => { if (document.visibilityState === 'visible') s?.emit('read', { chatId }); };
  markRead();
  setTimeout(refreshBadges, 400);

  const showTyping = () => {
    paintStatus();
    box.querySelector('.typing-b')?.remove();
    if (typingNow.size) { box.insertAdjacentHTML('beforeend', '<div class="typing-b" aria-label="yazıyor"><i></i><i></i><i></i></div>'); if (nearBottom()) box.scrollTop = box.scrollHeight; }
  };
  const nearBottom = () => box.scrollHeight - box.scrollTop - box.clientHeight < 160;

  const offs = [
    on('message', (m) => {
      if (m.chatId !== chatId || msgs.some((x) => x.id === m.id)) return;
      if (m.fal && falLock && state.me.role === 'falci') { falLock = null; paintComposer(); }
      const stick = nearBottom() || m.from === state.me.id;
      if (!msgs.length) box.innerHTML = '';
      box.querySelector('.typing-b')?.remove();
      msgs.push(m);
      box.insertAdjacentHTML('beforeend', bubble(m, msgs[msgs.length - 2]));
      if (m.from !== state.me.id) { typingNow.delete(m.from); paintStatus(); markRead(); }
      if (typingNow.size) showTyping();
      if (stick) box.scrollTop = box.scrollHeight;
    }),
    on('message:update', (m) => {
      if (m.chatId !== chatId) return;
      const i = msgs.findIndex((x) => x.id === m.id); if (i < 0) return;
      msgs[i] = m; repaintOne(m);
    }),
    on('message:hidden', ({ id, chatId: c }) => {
      if (c !== chatId) return;
      const i = msgs.findIndex((x) => x.id === id); if (i >= 0) msgs.splice(i, 1);
      box.querySelector(`[data-id="${CSS.escape(id)}"]`)?.remove();
    }),
    on('typing', ({ chatId: c, userId, typing, kind }) => {
      if (c !== chatId || userId === state.me.id) return;
      typing ? typingNow.set(userId, kind || 'text') : typingNow.delete(userId);
      showTyping();
    }),
    on('read', ({ chatId: c, userId }) => {
      if (c !== chatId || userId === state.me.id) return;
      msgs.forEach((m) => { if (!m.readBy.includes(userId)) m.readBy.push(userId); });
      box.querySelectorAll('.mwrap.me').forEach((w) => { const m = msgs.find((x) => x.id === w.dataset.id); const t = w.querySelector('.tk'); if (m && t) t.innerHTML = tick(m); });
    }),
    on('delivered', ({ id, userId }) => {
      const m = msgs.find((x) => x.id === id); if (!m) return;
      if (!m.deliveredTo.includes(userId)) m.deliveredTo.push(userId);
      const t = box.querySelector(`[data-id="${CSS.escape(id)}"] .tk`); if (t) t.innerHTML = tick(m);
    }),
    on('presence', paintStatus),
    on('chat:removed', ({ chatId: c }) => { if (c === chatId) { toast('Bu sohbet artık yok.'); location.hash = '#/chats'; } }),
    on('chat:update', async ({ chatId: c }) => {
      if (c !== chatId) return;
      const d = await api(`/chats/${chatId}`).catch(() => null); if (!d) return;
      members.clear(); (d.members || []).forEach((m) => members.set(m.id, m));
      view.querySelector('.who .n').innerHTML = nm(d.other); paintStatus();
      ttl = d.ttl || 0; view.querySelector('.ttl-ind').hidden = !ttl;
    }),
    on('blocked', ({ by }) => { if (!isGroup && by === other.id) { blocked = true; paintComposer(); } }),
    on('user:blocked', (id) => { if (!isGroup && id === other.id) location.hash = '#/chats'; }),
    on('reconnected', async () => {
      const d = await api(`/chats/${chatId}`).catch(() => null);
      if (d) { msgs.splice(0, msgs.length, ...d.messages); paintAll(); markRead(); }
    }),
  ];
  const vis = () => { if (document.visibilityState === 'visible') markRead(); };
  document.addEventListener('visibilitychange', vis);

  // ---- Yazma alanı ----
  let typingTimer = null; let typingSent = false;
  const stopTyping = () => { if (typingSent) { s?.emit('typing', { chatId, typing: false }); typingSent = false; } };
  const send = (payload) => new Promise((resolve) => {
    const body = { ...payload, replyTo: replyTo?.id };
    setReply(null);
    if (s?.connected) s.emit('message:send', { chatId, ...body }, (r) => { if (r?.error) toast(r.error); resolve(); });
    else api(`/chats/${chatId}/messages`, { body }).then((m) => { if (!msgs.some((x) => x.id === m.id)) { msgs.push(m); paintAll(); } resolve(); }).catch((e) => { toast(e.message); resolve(); });
  });

  function setReply(m) {
    replyTo = m;
    const r = comp.querySelector('.replying');
    if (!r) return;
    if (!m) { r.hidden = true; return; }
    r.hidden = false;
    r.querySelector('.who-r').textContent = m.from === state.me.id ? 'Kendine yanıt' : `${(members.get(m.from)?.name || other.name).split(' ')[0]} kişisine yanıt`;
    r.querySelector('.txt').textContent = m.text || { audio: '🎤 Sesli mesaj', video: '🎥 Video' }[m.mediaType] || '📷 Fotoğraf';
    comp.querySelector('textarea')?.focus();
  }

  function paintComposer() {
    if (falLock && !blocked) {
      const toFalci = other?.role === 'falci';
      comp.innerHTML = `<div class="fal-lock"><span>🔮</span><div class="grow"><b>${toFalci ? 'Falcı Teyze’ye sadece fal isteğiyle yazılır' : 'Bu kişi henüz fal istemedi'}</b><small>${toFalci ? 'Fal isteğini gönder, cevabı buraya gelsin. Sonraki sorularını da yeni bir fal isteğiyle sorabilirsin.' : 'Sadece fal isteyenlere yazabilirsin.'}</small></div>${toFalci ? '<a class="btn primary sm" href="#/fal">Fal baktır</a>' : ''}</div>`;
      return;
    }
    if (blocked) {
      comp.innerHTML = `<div class="blocked-bar">Bu kişiyle artık mesajlaşamazsın.</div>`;
      view.querySelector('.vc')?.remove(); view.querySelector('.vv')?.remove();
      return;
    }
    comp.innerHTML = `<div class="replying" hidden><span class="bar"></span><div class="grow"><b class="who-r"></b><div class="txt ellipsis muted"></div></div><button type="button" class="x" aria-label="Yanıtı iptal et">${icon('close')}</button></div>
      <form class="row1">
        <div class="box">
          <button type="button" class="icon-btn pic" aria-label="Fotoğraf veya video gönder">${icon('image')}</button>
          <textarea rows="1" placeholder="Mesaj yaz..." aria-label="Mesaj yaz" maxlength="4000"></textarea>
          <button type="button" class="icon-btn more-b" aria-label="Diğer">${icon('plusSq')}</button>
        </div>
        <button class="go" aria-label="Basılı tutarak sesli mesaj kaydet">${icon('mic')}</button>
      </form>`;
    const ta = comp.querySelector('textarea');
    const go = comp.querySelector('.go');
    restoreDraft(ta);
    const boxEl = comp.querySelector('.box');
    comp.querySelector('.replying .x').onclick = () => setReply(null);
    const hasText = () => !!ta.value.trim();
    const paintGo = () => { go.innerHTML = icon(hasText() ? 'send' : 'mic'); go.setAttribute('aria-label', hasText() ? 'Gönder' : 'Basılı tutarak sesli mesaj kaydet'); };
    ta.addEventListener('input', () => {
      ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px';
      paintGo();
      if (hasText() && !typingSent) { s?.emit('typing', { chatId, typing: true }); typingSent = true; }
      clearTimeout(typingTimer); typingTimer = setTimeout(stopTyping, 2500);
      if (!hasText()) stopTyping();
    });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(pointer: coarse)').matches) { e.preventDefault(); comp.querySelector('form').requestSubmit(); }
    });
    comp.querySelector('form').onsubmit = async (e) => {
      e.preventDefault();
      const text = ta.value.trim(); if (!text) return;
      ta.value = ''; ta.style.height = 'auto'; paintGo();
      stopTyping();
      await send({ text });
      ta.focus();
    };
    const sendMedia = async (accept, capture) => {
      const f = await pickFile(accept, capture); if (!f) return;
      toast('Gönderiliyor...', { ms: 1500 });
      try {
        const file = f.type.startsWith('image/') ? await compressImage(f) : f;
        const up = await uploadFile(file);
        await send({ media: up.url, mediaType: up.type });
      } catch (er) { toast(er.message); }
    };
    comp.querySelector('.pic').onclick = () => sendMedia('image/*,video/*');
    comp.querySelector('.more-b').onclick = () => sheet(null, `<div class="menu">
      <button data-a="cam">${icon('camera')}Fotoğraf çek</button>
      <button data-a="once">${icon('eye')}<span class="grow">Tek seferlik fotoğraf<div class="sub muted" style="font-size:12.5px">Bir kez açılır, sonra silinir</div></span></button>
      ${isGroup || falChat ? '' : `<button data-a="game">🎲<span class="grow">Oyun başlat<div class="sub muted" style="font-size:12.5px">İki doğru bir yalan, Bu mu şu mu</div></span></button>
      <button data-a="plan">📅<span class="grow">Buluşma planla<div class="sub muted" style="font-size:12.5px">Tarih, yer ve arkadaşınla güvenlik paylaşımı</div></span></button>`}
      <button data-a="loc">${icon('mapPin')}Konum gönder</button>
      <button data-a="ttl">${icon('timer')}<span class="grow">Kaybolan mesajlar</span><span class="muted">${ttlLabel(ttl)}</span></button></div>`, {
      onMount(sh, close) {
        sh.querySelector('.menu').onclick = (e) => {
          const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
          close();
          if (a === 'cam') sendMedia('image/*', 'environment');
          if (a === 'loc') shareLocation();
          if (a === 'ttl') ttlSheet();
          if (a === 'once') sendOnce();
          if (a === 'game') gameSheet();
          if (a === 'plan') planSheet();
        };
      },
    });

    // Basılı tut → sesli mesaj
    const rec = audioRecorder();
    let recording = false; let held = false; let startX = 0; let cancelled = false; let tmr = null; let bar = null;
    go.addEventListener('pointerdown', async (e) => {
      if (hasText()) return;
      e.preventDefault();
      if (!rec.supported) { toast('Bu tarayıcı ses kaydını desteklemiyor.'); return; }
      held = true; cancelled = false; startX = e.clientX;
      go.setPointerCapture?.(e.pointerId);
      try { await rec.start(); } catch { held = false; toast('Mikrofon izni gerekiyor.'); return; }
      if (!held) { await rec.stop(true); toast('Kaydetmek için basılı tut.'); return; }
      recording = true; go.classList.add('rec');
      navigator.vibrate?.(20);
      s?.emit('typing', { chatId, typing: true, kind: 'audio' });
      boxEl.hidden = true;
      bar = el(`<div class="rec-bar"><i class="dot"></i><span class="tm">0:00</span><span class="hint">‹ iptal için sola kaydır</span></div>`);
      boxEl.after(bar);
      tmr = setInterval(() => { bar.querySelector('.tm').textContent = fmtDur(rec.elapsed()); if (rec.elapsed() > 300) finish(); }, 250);
    });
    go.addEventListener('pointermove', (e) => {
      if (!recording) return;
      if (e.clientX - startX < -90) { cancelled = true; bar.querySelector('.hint').textContent = 'Bırakınca iptal olur'; bar.style.opacity = .6; }
      else if (cancelled) { cancelled = false; bar.querySelector('.hint').textContent = '‹ iptal için sola kaydır'; bar.style.opacity = 1; }
    });
    async function finish() {
      held = false;
      if (!recording) return;
      recording = false; clearInterval(tmr);
      go.classList.remove('rec'); bar?.remove(); boxEl.hidden = false;
      s?.emit('typing', { chatId, typing: false });
      const out = await rec.stop(cancelled);
      if (!out) { if (!cancelled) toast('Kayıt çok kısa. Basılı tutup konuş.'); return; }
      try {
        const up = await uploadFile(out.file);
        await send({ media: up.url, mediaType: 'audio', duration: out.duration });
      } catch (er) { toast(er.message); }
    }
    go.addEventListener('pointerup', finish);
    go.addEventListener('pointercancel', () => { cancelled = true; finish(); });
    go.addEventListener('click', (e) => { if (!hasText()) e.preventDefault(); });
  }
  paintComposer();

  async function sendOnce() {
    const f = await pickFile('image/*'); if (!f) return;
    toast('Gönderiliyor...', { ms: 1500 });
    try { const up = await uploadFile(await compressImage(f)); await send({ media: up.url, mediaType: 'image', viewOnce: true }); } catch (er) { toast(er.message); }
  }
  const addMsg = (m) => { if (m?.id && !msgs.some((x) => x.id === m.id)) { msgs.push(m); if (msgs.length === 1) paintAll(); else { box.insertAdjacentHTML('beforeend', bubble(m, msgs[msgs.length - 2])); box.scrollTop = box.scrollHeight; } } };
  function gameSheet() {
    sheet('Buz kırıcı oyunlar', `<div class="menu"><button data-g="ikidogru">🎲<span class="grow">İki doğru bir yalan<div class="sub muted" style="font-size:12.5px">Kendin hakkında 3 şey yaz, biri yalan olsun</div></span></button>
      <button data-g="bumu">🤔<span class="grow">Bu mu şu mu?<div class="sub muted" style="font-size:12.5px">5 hızlı soru, ne kadar uyumlusunuz</div></span></button></div>`, {
      onMount(sh, close) {
        sh.querySelector('.menu').onclick = async (e) => {
          const g = e.target.closest('[data-g]')?.dataset.g; if (!g) return;
          close();
          if (g === 'bumu') { try { addMsg(await api(`/chats/${chatId}/game`, { body: { kind: 'bumu' } })); } catch (er) { toast(er.message); } return; }
          sheet('İki doğru bir yalan', `<form class="form id-f">${[0, 1, 2].map((i) => `<label class="id-row"><input type="radio" name="lie" value="${i}" aria-label="${i + 1}. cümle yalan"><input class="field" name="t${i}" maxlength="120" placeholder="${['Hiç uçağa binmedim', 'Üç dil konuşuyorum', 'Bir kez ünlü biriyle tanıştım'][i]}"></label>`).join('')}
            <p class="muted" style="margin:0;font-size:12.5px">Yalan olanın yanındaki daireyi işaretle. Karşındaki tahmin edene kadar gizli kalır.</p>
            <button class="btn primary block">Gönder</button></form>`, {
            onMount(sh2, close2) {
              const f = sh2.querySelector('form');
              f.onsubmit = async (ev) => {
                ev.preventDefault();
                const lie = f.querySelector('[name=lie]:checked');
                if (!lie) return toast('Hangisinin yalan olduğunu işaretle.');
                try { addMsg(await api(`/chats/${chatId}/game`, { body: { kind: 'ikidogru', items: [f.t0.value, f.t1.value, f.t2.value], lie: +lie.value } })); close2(); } catch (er) { toast(er.message); }
              };
            },
          });
        };
      },
    });
  }
  function planSheet() {
    const def = new Date(); def.setDate(def.getDate() + 1); def.setHours(19, 0, 0, 0);
    sheet('Buluşma planla', `<form class="form pl-f">
      <label>Ne zaman<input class="field" type="datetime-local" name="w" value="${localInput(def.getTime())}" min="${localInput(Date.now())}"></label>
      <label>Nerede<input class="field" name="p" maxlength="120" placeholder="Ör. Moda sahili, Kadıköy"></label>
      <label>Not (isteğe bağlı)<input class="field" name="n" maxlength="200" placeholder="Kahve içeriz ☕"></label>
      <p class="muted" style="margin:0;font-size:12.5px">💛 İlk buluşmayı kalabalık bir yerde yap. Planı bir arkadaşınla paylaşabilir, sonra “İyiyim” diyerek haber verebilirsin.</p>
      <button class="btn primary block">Planı gönder</button></form>`, {
      onMount(sh, close) {
        const f = sh.querySelector('form');
        f.onsubmit = async (e) => {
          e.preventDefault();
          const when = new Date(f.w.value).getTime();
          try { addMsg(await api(`/chats/${chatId}/plan`, { body: { when, place: f.p.value, note: f.n.value } })); close(); } catch (er) { toast(er.message); }
        };
      },
    });
  }

  function shareLocation() {
    if (!navigator.geolocation) return toast('Bu cihaz konum paylaşmayı desteklemiyor.');
    toast('Konum alınıyor…', { ms: 1500 });
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      sheet('Konum gönder', `<div style="padding:0 16px 16px;display:grid;gap:12px"><div class="msg loc" style="max-width:none">${mapHtml(lat, lng)}</div>
        <input class="field lb" maxlength="80" placeholder="Etiket (ör. Kadıköy iskelesi)"><button class="btn primary block">Gönder</button></div>`, {
        onMount(sh, close) {
          sh.querySelector('.btn').onclick = async () => { close(); await send({ location: { lat, lng, label: sh.querySelector('.lb').value } }); };
        },
      });
    }, () => toast('Konum izni verilmedi.'), { enableHighAccuracy: true, timeout: 12000 });
  }
  function ttlSheet() {
    sheet('Kaybolan mesajlar', `<p class="muted" style="margin:0 16px 10px">Açıkken yeni mesajlar seçtiğin süre sonunda herkes için silinir.${isGroup ? ' Grupta bunu yöneticiler değiştirebilir.' : ''}</p>
      <div class="menu">${TTL_OPTS.map(([v, l]) => `<button data-v="${v}">${icon('timer')}<span class="grow">${l}</span>${v === ttl ? icon('check') : ''}</button>`).join('')}</div>`, {
      onMount(sh, close) {
        sh.querySelector('.menu').onclick = async (e) => {
          const b = e.target.closest('[data-v]'); if (!b) return;
          close();
          try { const c = await api(`/chats/${chatId}/ttl`, { method: 'PATCH', body: { ttl: +b.dataset.v } }); ttl = c.ttl; view.querySelector('.ttl-ind').hidden = !ttl; } catch (er) { toast(er.message); }
        };
      },
    });
  }
  view.querySelector('.ttl-ind').onclick = ttlSheet;

  return () => { stopTyping(); offs.forEach((f) => f()); document.removeEventListener('visibilitychange', vis); document.querySelector('.emoji-pop')?.remove(); playing?.a.pause(); refreshBadges(); };
}

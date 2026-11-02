import { icon } from '../icons.js';
import {
  state, api, esc, on, clock, dayLabel, lastSeen, avatar, toast, pickFile, compressImage, uploadFile, refreshBadges,
} from '../core.js';

export default async function chat(view, chatId) {
  view.innerHTML = '<div class="chat"><div class="spinner" style="margin-top:40vh"></div></div>';
  const data = await api(`/chats/${chatId}`);
  const other = data.other;
  const msgs = data.messages;
  const s = state.socket;

  view.innerHTML = `<div class="chat">
    <header class="topbar bordered">
      <a class="ib" href="#/chats" aria-label="Geri">${icon('back')}</a>
      <a class="who" href="#/u/${esc(other.username)}">${avatar(other, 32, { ring: true })}
        <div class="grow"><div class="n ellipsis">${esc(other.name)}</div><div class="s"></div></div></a>
      ${other.live ? `<a class="ib" href="#/live/${esc(other.id)}" aria-label="Canlı yayını izle" style="color:var(--red)">${icon('live')}</a>` : ''}
    </header>
    <div class="msgs" role="log" aria-live="polite"></div>
    <form class="composer">
      <div class="box">
        <button type="button" class="cam" aria-label="Fotoğraf gönder">${icon('camera')}</button>
        <textarea rows="1" placeholder="Mesaj..." aria-label="Mesaj yaz" maxlength="4000"></textarea>
        <button type="button" class="icon-btn pic" aria-label="Galeriden seç">${icon('image')}</button>
        <button class="send" hidden>Gönder</button>
      </div>
    </form></div>`;

  const box = view.querySelector('.msgs');
  const st = view.querySelector('.s');
  const ta = view.querySelector('textarea');
  const sendBtn = view.querySelector('.send');
  const picBtn = view.querySelector('.pic');
  let otherTyping = false;

  const paintStatus = () => {
    st.textContent = otherTyping ? 'yazıyor...' : lastSeen(other);
    st.classList.toggle('on', otherTyping || st.textContent === 'çevrimiçi');
  };
  paintStatus();

  const tick = (m) => {
    if (m.from !== state.me.id) return '';
    if (m.readBy.includes(other.id)) return `<span class="read">${icon('dcheck')}</span>`;
    if (m.deliveredTo.includes(other.id)) return icon('dcheck');
    return icon('check');
  };
  const bubble = (m, prev) => {
    const mine = m.from === state.me.id;
    const day = !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString();
    const gap = prev && (prev.from !== m.from || m.at - prev.at > 300000);
    const meta = `<span class="meta">${clock(m.at)}<span class="tk">${tick(m)}</span></span>`;
    const body = m.media
      ? `<div class="msg media ${mine ? 'me' : 'them'} ${gap ? 'gap' : ''}" data-id="${esc(m.id)}">${m.mediaType === 'video'
        ? `<video src="${esc(m.media)}" controls playsinline preload="metadata"></video>`
        : `<a href="${esc(m.media)}" target="_blank" rel="noopener"><img src="${esc(m.media)}" alt="Fotoğraf"></a>`}${meta}</div>
        ${m.text ? `<div class="msg ${mine ? 'me' : 'them'}" data-id="${esc(m.id)}-t">${esc(m.text)}</div>` : ''}`
      : `<div class="msg ${mine ? 'me' : 'them'} ${gap ? 'gap' : ''}" data-id="${esc(m.id)}">${esc(m.text)}${meta}</div>`;
    return `${day ? `<div class="day">${dayLabel(m.at)}</div>` : ''}${body}`;
  };
  const paintAll = () => {
    box.innerHTML = msgs.length
      ? msgs.map((m, i) => bubble(m, msgs[i - 1])).join('')
      : `<div class="empty">${avatar(other, 56, { dot: false })}<h2>${esc(other.name)}</h2>${esc(other.username)} · Sweep Up<p>Bir merhaba ile başla 👋</p></div>`;
    box.scrollTop = box.scrollHeight;
  };
  paintAll();

  const markRead = () => { if (document.visibilityState === 'visible') s?.emit('read', { chatId }); };
  markRead();
  setTimeout(refreshBadges, 400);

  const showTyping = (on_) => {
    otherTyping = on_; paintStatus();
    box.querySelector('.typing-b')?.remove();
    if (on_) { box.insertAdjacentHTML('beforeend', '<div class="typing-b" aria-label="yazıyor"><i></i><i></i><i></i></div>'); box.scrollTop = box.scrollHeight; }
  };

  const nearBottom = () => box.scrollHeight - box.scrollTop - box.clientHeight < 140;
  const offs = [
    on('message', (m) => {
      if (m.chatId !== chatId || msgs.some((x) => x.id === m.id)) return;
      const stick = nearBottom() || m.from === state.me.id;
      if (!msgs.length) box.innerHTML = '';
      box.querySelector('.typing-b')?.remove();
      msgs.push(m);
      box.insertAdjacentHTML('beforeend', bubble(m, msgs[msgs.length - 2]));
      if (m.from !== state.me.id) { otherTyping = false; paintStatus(); markRead(); }
      if (stick) box.scrollTop = box.scrollHeight;
    }),
    on('typing', ({ chatId: c, userId, typing }) => { if (c === chatId && userId === other.id) showTyping(typing); }),
    on('read', ({ chatId: c, userId }) => {
      if (c !== chatId || userId !== other.id) return;
      msgs.forEach((m) => { if (m.from === state.me.id && !m.readBy.includes(other.id)) m.readBy.push(other.id); });
      box.querySelectorAll('.msg.me .tk').forEach((t) => { t.innerHTML = `<span class="read">${icon('dcheck')}</span>`; });
    }),
    on('delivered', ({ id, userId }) => {
      const m = msgs.find((x) => x.id === id); if (!m || userId !== other.id) return;
      if (!m.deliveredTo.includes(userId)) m.deliveredTo.push(userId);
      const t = box.querySelector(`[data-id="${CSS.escape(id)}"] .tk`); if (t) t.innerHTML = tick(m);
    }),
    on('presence', ({ userId }) => {
      if (userId !== other.id) return;
      paintStatus();
      // karşı taraf çevrimiçi olunca iletildi işaretleri sunucudan gelir
    }),
  ];
  const vis = () => { if (document.visibilityState === 'visible') markRead(); };
  document.addEventListener('visibilitychange', vis);

  // Yazma göstergesi
  let typingTimer = null; let typingSent = false;
  const stopTyping = () => { if (typingSent) { s?.emit('typing', { chatId, typing: false }); typingSent = false; } };
  ta.addEventListener('input', () => {
    ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px';
    const has = !!ta.value.trim();
    sendBtn.hidden = !has; picBtn.hidden = has;
    if (has && !typingSent) { s?.emit('typing', { chatId, typing: true }); typingSent = true; }
    clearTimeout(typingTimer); typingTimer = setTimeout(stopTyping, 2500);
    if (!has) stopTyping();
  });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(pointer: coarse)').matches) { e.preventDefault(); view.querySelector('form').requestSubmit(); }
  });

  const send = (payload) => new Promise((resolve) => {
    if (s?.connected) s.emit('message:send', { chatId, ...payload }, (r) => { if (r?.error) toast(r.error); resolve(); });
    else api(`/chats/${chatId}/messages`, { body: payload }).then((m) => { if (!msgs.some((x) => x.id === m.id)) { msgs.push(m); paintAll(); } resolve(); }).catch((e) => { toast(e.message); resolve(); });
  });

  view.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const text = ta.value.trim(); if (!text) return;
    ta.value = ''; ta.style.height = 'auto'; sendBtn.hidden = true; picBtn.hidden = false;
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
  view.querySelector('.cam').onclick = () => sendMedia('image/*', 'environment');
  picBtn.onclick = () => sendMedia('image/*,video/*');

  return () => { stopTyping(); offs.forEach((f) => f()); document.removeEventListener('visibilitychange', vis); refreshBadges(); };
}

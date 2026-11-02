import { icon } from '../icons.js';
import {
  state, api, esc, on, clock, dayLabel, avatar, toast, pickFile, compressImage, uploadFile, el, sheet, reportUser, reportMessage, nm, richText,
} from '../core.js';
import { restoreDraft } from '../update.js';

const EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];
export const GENEL_SEEN = 'su_genel_seen';

export default async function genel(view) {
  view.innerHTML = `<div class="chat genel">
    <header class="topbar bordered">
      <a class="ib" href="#/chats" aria-label="Geri">${icon('back')}</a>
      <div class="who"><span class="genel-ic">${icon('users')}</span><div class="grow"><div class="n">Genel sohbet</div><div class="s on"><span class="oc">…</span> çevrimiçi</div></div></div>
      <button class="ib rules" aria-label="Kurallar">${icon('shield')}</button>
    </header>
    <div class="msgs" role="log" aria-live="polite"><div class="spinner" style="margin-top:30vh"></div></div>
    <div class="composer"><div class="replying" hidden><span class="bar"></span><div class="grow"><b class="who-r"></b><div class="txt ellipsis muted"></div></div><button type="button" class="x" aria-label="Yanıtı iptal et">${icon('close')}</button></div>
      <form class="row1"><div class="box">
        <button type="button" class="icon-btn pic" aria-label="Fotoğraf gönder">${icon('image')}</button>
        <textarea rows="1" placeholder="Herkese yaz..." aria-label="Mesaj yaz" maxlength="1000"></textarea>
      </div><button class="go" aria-label="Gönder">${icon('send')}</button></form></div>
  </div>`;
  const box = view.querySelector('.msgs');
  const s = state.socket;
  let msgs = [];
  let replyTo = null;
  let more = false; let loadingOld = false;

  const bubble = (m, prev) => {
    const day = !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString();
    const dayHtml = day ? `<div class="day">${dayLabel(m.at)}</div>` : '';
    const mine = m.userId === state.me.id;
    const grouped = prev && !day && prev.userId === m.userId && m.at - prev.at < 180000;
    const reacts = Object.values(m.reactions || {});
    const counts = reacts.reduce((a, e) => ((a[e] = (a[e] || 0) + 1), a), {});
    const body = m.deleted ? `<i class="muted">${icon('block', '', 'style="width:14px;height:14px;vertical-align:-2px"')} Bu mesaj silindi</i>`
      : [m.reply ? `<span class="reply"><b>${esc(m.reply.userId === state.me.id ? 'Sen' : m.reply.name)}</b>${esc(m.reply.text)}</span>` : '',
        m.media ? `<a href="${esc(m.media)}" target="_blank" rel="noopener" class="gimg"><img src="${esc(m.media)}" alt="Fotoğraf" loading="lazy"></a>` : '',
        m.text ? richText(m.text) : ''].join('');
    return `${dayHtml}<div class="gm ${mine ? 'me' : 'them'} ${grouped ? 'grp' : ''}" data-id="${esc(m.id)}">
      ${mine ? '' : `<a class="ga" href="#/u/${esc(m.user?.username)}">${grouped ? '' : avatar(m.user, 32, { dot: false })}</a>`}
      <div class="gb">${mine || grouped ? '' : `<a class="gn" href="#/u/${esc(m.user?.username)}">${nm(m.user)}</a>`}
        <div class="msg">${body}<span class="meta">${clock(m.at)}</span></div>
        ${reacts.length ? `<div class="reacts">${Object.keys(counts).join('')}${reacts.length > 1 ? `<small>${reacts.length}</small>` : ''}</div>` : ''}</div></div>`;
  };
  const paint = (keep) => {
    const h = box.scrollHeight; const top = box.scrollTop;
    box.innerHTML = (more ? '<button class="older link">Önceki mesajlar</button>' : '')
      + (msgs.length ? msgs.map((m, i) => bubble(m, msgs[i - 1])).join('') : `<div class="empty"><div class="big">${icon('users')}</div><h2>Genel sohbete hoş geldin</h2>Buradaki mesajları tüm üyeler görür. İlk merhabayı sen yaz 👋</div>`);
    if (keep) box.scrollTop = box.scrollHeight - h + top; else box.scrollTop = box.scrollHeight;
  };
  const near = () => box.scrollHeight - box.scrollTop - box.clientHeight < 160;
  const markSeen = () => { try { localStorage.setItem(GENEL_SEEN, String(Date.now())); } catch {} };

  const d = await api('/genel');
  msgs = d.items; more = d.more;
  view.querySelector('.oc').textContent = d.online || 1;
  paint(); markSeen();
  s?.emit('genel:join');

  box.addEventListener('click', async (e) => {
    if (!e.target.closest('.older') || loadingOld) return;
    loadingOld = true;
    const r = await api(`/genel?before=${msgs[0]?.at || Date.now()}`).catch(() => null);
    loadingOld = false;
    if (!r) return;
    msgs = [...r.items, ...msgs]; more = r.more; paint(true);
  });


  try {
    if (!localStorage.getItem('su_hint_msgmenu')) {
      localStorage.setItem('su_hint_msgmenu', '1');
      setTimeout(() => toast('İpucu: Bir mesaja basılı tutarak yanıtlayabilir, tepki verebilir ya da mesajı bildirebilirsin.', { ms: 6000 }), 900);
    }
  } catch {}
  // ---- Menü ----
  const find = (node) => { const w = node.closest?.('.gm'); return w && msgs.find((m) => m.id === w.dataset.id); };
  function openMenu(m, wrap) {
    if (m.deleted || document.querySelector('#sheet-root .sheet')) return; // uzun basma + contextmenu aynı anda gelmesin
    document.querySelector('.emoji-pop')?.remove();
    const r = wrap.querySelector('.msg').getBoundingClientRect();
    const pop = el(`<div class="emoji-pop">${EMOJIS.map((x) => `<button class="${m.reactions?.[state.me.id] === x ? 'on' : ''}">${x}</button>`).join('')}</div>`);
    document.body.append(pop);
    pop.style.top = `${Math.max(70, r.top - 56)}px`;
    pop.style.left = `${Math.min(window.innerWidth - pop.offsetWidth - 8, Math.max(8, r.left))}px`;
    pop.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; s?.emit('genel:react', { id: m.id, emoji: b.textContent }); closeAll(); };
    const mine = m.userId === state.me.id;
    const closeSheet = sheet(null, `<div class="menu">
      <button data-a="reply">${icon('reply')}Yanıtla</button>
      ${m.text ? `<button data-a="copy">${icon('copy')}Kopyala</button>` : ''}
      ${mine ? '' : `<button data-a="profile">${icon('person')}Profiline git</button><button data-a="dm">${icon('send')}Özelden yaz</button>`}
      ${mine ? `<button data-a="del" class="danger">${icon('trash')}Sil</button>` : `<button data-a="report" class="danger">${icon('flag')}Mesajı bildir</button>`}</div>`, {
      onMount(sh) {
        sh.querySelector('.menu').onclick = async (e) => {
          const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
          closeAll();
          if (a === 'reply') setReply(m);
          if (a === 'copy') { await navigator.clipboard?.writeText(m.text); toast('Kopyalandı.'); }
          if (a === 'del') s?.emit('genel:delete', { id: m.id });
          if (a === 'profile') location.hash = `#/u/${m.user.username}`;
          if (a === 'dm') import('../core.js').then((c) => c.openChatWith(m.userId)).catch((er) => toast(er.message));
          if (a === 'report') reportMessage({ kind: 'genel', id: m.id, user: m.user, text: m.text, media: m.media });
        };
      },
    });
    function closeAll() { pop.remove(); closeSheet(); }
    document.querySelector('.sheet-bg')?.addEventListener('click', () => pop.remove(), { once: true });
  }
  let lp = null;
  box.addEventListener('pointerdown', (e) => {
    const m = find(e.target); if (!m || e.target.closest('a')) return;
    const w = e.target.closest('.gm');
    lp = setTimeout(() => { lp = null; navigator.vibrate?.(15); openMenu(m, w); }, 450);
  });
  ['pointerup', 'pointercancel', 'pointermove'].forEach((ev) => box.addEventListener(ev, (e) => { if (ev !== 'pointermove' || Math.abs(e.movementY) > 3) { clearTimeout(lp); lp = null; } }));
  box.addEventListener('contextmenu', (e) => { const m = find(e.target); if (m) { e.preventDefault(); openMenu(m, e.target.closest('.gm')); } });
  box.addEventListener('dblclick', (e) => { const m = find(e.target); if (m && !m.deleted) s?.emit('genel:react', { id: m.id, emoji: '❤️' }); });

  // ---- Yazma ----
  const comp = view.querySelector('.composer');
  const ta = comp.querySelector('textarea');
  restoreDraft(ta);
  function setReply(m) {
    replyTo = m;
    const r = comp.querySelector('.replying');
    r.hidden = !m;
    if (!m) return;
    r.querySelector('.who-r').textContent = m.userId === state.me.id ? 'Kendine yanıt' : `${(m.user?.name || '').split(' ')[0]} kişisine yanıt`;
    r.querySelector('.txt').textContent = m.text || '📷 Fotoğraf';
    ta.focus();
  }
  comp.querySelector('.replying .x').onclick = () => setReply(null);
  const send = (payload) => new Promise((resolve) => {
    s.emit('genel:send', { ...payload, replyTo: replyTo?.id }, (r) => { if (r?.error) toast(r.error); resolve(r); });
    setReply(null);
  });
  let lastType = 0;
  ta.addEventListener('input', () => {
    ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px';
    if (Date.now() - lastType > 3000 && ta.value.trim()) { lastType = Date.now(); s?.emit('genel:typing'); }
  });
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(pointer: coarse)').matches) { e.preventDefault(); comp.querySelector('form').requestSubmit(); } });
  comp.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const text = ta.value.trim(); if (!text) return;
    ta.value = ''; ta.style.height = 'auto';
    await send({ text });
    ta.focus();
  };
  comp.querySelector('.pic').onclick = async () => {
    const f = await pickFile('image/*'); if (!f) return;
    try { const up = await uploadFile(await compressImage(f)); await send({ media: up.url }); } catch (er) { toast(er.message); }
  };
  view.querySelector('.rules').onclick = () => sheet('Genel sohbet kuralları', `<div style="padding:0 18px 20px;display:grid;gap:8px;font-size:15px">
    <p style="margin:0">Burada yazdıklarını tüm üyeler görür.</p>
    <p style="margin:0">• Saygılı ol; hakaret, taciz ve tehdit yok. Küfürler otomatik yıldızlanır, tehditler ekibe iletilir.</p>
    <p style="margin:0">• Telefon, adres gibi kişisel bilgilerini paylaşma.</p>
    <p style="margin:0">• Reklam ve spam yok. Rahatsız eden mesaja uzun basıp şikayet edebilirsin.</p>
    <a class="link" href="#/legal/kurallar">Topluluk kuralları</a></div>`);

  let typT = null;
  const offs = [
    on('genel:msg', (m) => {
      if (msgs.some((x) => x.id === m.id)) return;
      if (store().blocked.has(m.userId)) return;
      const stick = near() || m.userId === state.me.id;
      if (!msgs.length) box.innerHTML = '';
      msgs.push(m);
      box.querySelector('.gtyping')?.remove();
      box.insertAdjacentHTML('beforeend', bubble(m, msgs[msgs.length - 2]));
      if (stick) box.scrollTop = box.scrollHeight;
      markSeen();
    }),
    on('genel:update', (m) => {
      const i = msgs.findIndex((x) => x.id === m.id); if (i < 0) return;
      msgs[i] = m;
      const w = box.querySelector(`[data-id="${CSS.escape(m.id)}"]`);
      if (w) { const t = el(`<div>${bubble(m, msgs[i - 1])}</div>`); w.replaceWith(t.querySelector('.gm')); }
    }),
    on('genel:online', ({ count }) => { view.querySelector('.oc').textContent = count; }),
    on('genel:typing', ({ user }) => {
      if (!user || user.id === state.me.id) return;
      let t = box.querySelector('.gtyping');
      if (!t) { box.insertAdjacentHTML('beforeend', '<div class="gtyping muted"></div>'); t = box.querySelector('.gtyping'); }
      t.textContent = `${user.name.split(' ')[0]} yazıyor…`;
      if (near()) box.scrollTop = box.scrollHeight;
      clearTimeout(typT); typT = setTimeout(() => box.querySelector('.gtyping')?.remove(), 3500);
    }),
    on('reconnected', () => { s?.emit('genel:join'); api('/genel').then((r) => { msgs = r.items; more = r.more; paint(); }).catch(() => {}); }),
  ];
  const blockedSet = { blocked: new Set() };
  const store = () => blockedSet;
  api('/blocks').then((us) => { us.forEach((u) => blockedSet.blocked.add(u.id)); }).catch(() => {});

  return () => { s?.emit('genel:leave'); offs.forEach((f) => f()); clearTimeout(typT); document.querySelector('.emoji-pop')?.remove(); markSeen(); };
}

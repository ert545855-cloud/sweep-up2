import { icon } from '../icons.js';
import {
  state, api, esc, ago, on, avatar, openChatWith, sheet, refreshBadges,
} from '../core.js';

export default async function chats(view) {
  view.innerHTML = `<header class="topbar">
      <h1>${icon('lock', '', 'style="width:16px;height:16px"')}<span>${esc(state.me.username)}</span></h1>
      <button class="ib new" aria-label="Yeni mesaj">${icon('edit')}</button>
    </header>
    <div class="search-bar" style="position:static;padding-top:4px"><label class="sw">${icon('search')}<input class="field q" placeholder="Ara" aria-label="Sohbetlerde ara"></label></div>
    <div class="mrow"></div>
    <div class="section-t"><span>Mesajlar</span></div>
    <div class="clist"><div class="spinner"></div></div>`;

  const [list, matches] = await Promise.all([api('/chats'), api('/matches')]);
  const typing = new Map();
  const listEl = view.querySelector('.clist');
  let filter = '';

  const withMsgs = new Set(list.filter((c) => c.last).map((c) => c.id));
  const fresh = matches.filter((m) => !withMsgs.has(m.chatId));
  const mrow = view.querySelector('.mrow');
  if (fresh.length) {
    mrow.innerHTML = `<div class="section-t"><span>Yeni eşleşmeler</span><span class="muted" style="font-weight:400">${fresh.length}</span></div>
      <div class="matches-row">${fresh.map((m) => `<a class="m" href="#/chat/${esc(m.chatId)}"><div class="ring"><img class="av" src="${esc(m.user.avatar)}" alt=""></div><span class="ellipsis" style="width:68px;text-align:center">${esc(m.user.name.split(' ')[0])}</span></a>`).join('')}</div>`;
  }

  const lastText = (c) => {
    if (typing.get(c.id)) return '<span class="typing">yazıyor...</span>';
    if (!c.last) return 'Eşleştiniz! İlk mesajı sen gönder 👋';
    const mine = c.last.from === state.me.id;
    const body = c.last.text || (c.last.mediaType === 'video' ? '🎥 Video' : '📷 Fotoğraf');
    return `${mine ? 'Sen: ' : ''}${esc(body)} · ${ago(c.last.at)}`;
  };
  const paint = () => {
    const items = list.filter((c) => !filter || c.other.name.toLowerCase().includes(filter) || c.other.username.includes(filter));
    items.sort((a, b) => (b.last?.at || b.lastAt) - (a.last?.at || a.lastAt));
    listEl.innerHTML = items.length ? items.map((c) => `<a class="list-item chat-item" href="#/chat/${esc(c.id)}">
        ${avatar(c.other, 56, { ring: true })}
        <div class="grow"><div class="ellipsis ${c.unread ? 'b' : ''}">${esc(c.other.name)}</div>
        <div class="last ${c.unread ? 'unread' : ''}"><span class="ellipsis">${lastText(c)}</span></div></div>
        ${c.unread ? '<i class="unread-dot"></i>' : ''}</a>`).join('')
      : `<div class="empty"><div class="big">${icon('send')}</div><h2>Mesajların</h2>Kaydırıp eşleştiğinde ya da birine yazdığında sohbetlerin burada görünür.<p><a class="btn primary" href="#/swipe">Keşfetmeye başla</a></p></div>`;
  };
  paint();

  view.querySelector('.q').oninput = (e) => { filter = e.target.value.toLowerCase().trim(); paint(); };
  view.querySelector('.new').onclick = () => {
    sheet('Yeni mesaj', `<div class="search-bar" style="position:static"><label class="sw">${icon('search')}<input class="field" placeholder="Kişi ara" autofocus></label></div><div class="res"></div>`, {
      onMount(sh) {
        const res = sh.querySelector('.res');
        let t;
        sh.querySelector('input').oninput = (e) => {
          clearTimeout(t);
          t = setTimeout(async () => {
            const us = await api(`/users/search?q=${encodeURIComponent(e.target.value)}`);
            res.innerHTML = us.filter((u) => u.id !== state.me.id).map((u) => `<button class="list-item" data-id="${esc(u.id)}">${avatar(u, 44)}<div><div class="b">${esc(u.name)}</div><div class="sub">${esc(u.username)}</div></div></button>`).join('');
          }, 200);
        };
        res.onclick = (e) => { const b = e.target.closest('[data-id]'); if (b) openChatWith(b.dataset.id); };
      },
    });
  };

  const offs = [
    on('message', (m) => {
      const c = list.find((x) => x.id === m.chatId);
      if (!c) { api('/chats').then((l) => { list.splice(0, list.length, ...l); paint(); }); return; }
      c.last = m; typing.delete(c.id);
      if (m.from !== state.me.id) c.unread++;
      paint();
    }),
    on('typing', ({ chatId, typing: t }) => { t ? typing.set(chatId, 1) : typing.delete(chatId); paint(); }),
    on('presence', paint),
  ];
  refreshBadges();
  return () => offs.forEach((f) => f());
}

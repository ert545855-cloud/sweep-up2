import { icon } from '../icons.js';
import {
  state, api, esc, ago, on, avatar, openChatWith, sheet, refreshBadges, nm,
} from '../core.js';
import { streakChip } from '../engage.js';
import { egi } from '../eg-icons.js';
import { notesRowHtml, noteSheet } from '../insta.js';

const preview = (m) => (m.location ? '📍 Konum' : m.fal ? '🔮 Fal isteği' : m.share && !m.text ? `📤 ${m.share.label}` : m.viewOnce ? '📷 Tek seferlik fotoğraf' : m.game ? '🎲 Oyun' : m.plan ? '📅 Buluşma planı' : '') || m.text || ({ audio: '🎤 Sesli mesaj', video: '🎥 Video', gif: 'GIF' }[m.mediaType] || '📷 Fotoğraf');

export default async function chats(view) {
  view.innerHTML = `<header class="topbar">
      <h1><span>Mesajlar</span></h1>
      <a class="ib soft" href="#/group/new" aria-label="Yeni grup">${icon('users')}</a>
      <button class="ib soft new" aria-label="Yeni mesaj">${icon('edit')}</button>
    </header>
    <div class="search-bar" style="position:static;padding-top:2px"><label class="sw">${icon('search')}<input class="field q" placeholder="Sohbetlerde ara" aria-label="Sohbetlerde ara"></label></div>
    <div class="notes-wrap"></div>
    <a class="genel-row" href="#/genel"><span class="genel-ic">${icon('users')}</span><span class="grow"><b>Genel sohbet</b><small>Tüm üyelerin konuştuğu oda</small></span><span class="go-chip">Katıl</span></a>
    <a class="stk-entry" href="#/seriler" hidden></a>
    <div class="mrow"></div>
    <div class="clist"><div class="spinner"></div></div>`;

  let list = []; let matches = [];
  const typing = new Map();
  const listEl = view.querySelector('.clist');
  const mrow = view.querySelector('.mrow');
  let filter = '';

  const paintMatches = () => {
    const withMsgs = new Set(list.filter((c) => c.last).map((c) => c.id));
    const fresh = matches.filter((m) => !withMsgs.has(m.chatId));
    const likes = state.badges.likes;
    if (!fresh.length && !likes) { mrow.innerHTML = ''; return; }
    mrow.innerHTML = `<div class="section-t"><span>Yeni eşleşmeler</span></div>
      <div class="matches-row">
        ${likes ? `<a class="m" href="#/likes"><span class="likes-tile">${likes > 99 ? '99+' : likes}</span><span>Beğenenler</span></a>` : ''}
        ${fresh.map((m) => `<a class="m" href="#/chat/${esc(m.chatId)}"><div class="av-wrap" data-presence="${esc(m.user.id)}"><img class="av" src="${esc(m.user.avatar)}" alt="">${m.user.online ? '<i class="online"></i>' : ''}</div><span class="ellipsis" style="width:66px;text-align:center">${esc(m.user.name.split(' ')[0])}</span></a>`).join('')}
      </div>`;
  };

  const lastText = (c) => {
    const t = typing.get(c.id);
    if (t) return `<span class="typing">${t === 'audio' ? 'ses kaydediyor...' : 'yazıyor...'}</span>`;
    if (!c.last) return 'Eşleştiniz! İlk mesajı sen gönder 👋';
    if (c.last.system) return esc(c.last.text);
    if (c.last.deleted) return '<i>Bu mesaj silindi</i>';
    if (c.last.fal) return `${c.last.from === state.me.id ? 'Sen: ' : ''}🔮 Fal isteği · ${c.last.fal.status === 'answered' ? 'cevaplandı' : 'bekliyor'}`;
    const mine = c.last.from === state.me.id;
    const who = mine ? 'Sen: ' : c.isGroup ? `${esc(c.last.fromName || '')}: ` : '';
    return `${who}${esc(preview(c.last))}`;
  };
  const paint = () => {
    const items = list.filter((c) => !filter || c.other.name.toLowerCase().includes(filter) || (c.other.username || '').includes(filter));
    items.sort((a, b) => (b.last?.at || b.lastAt) - (a.last?.at || a.lastAt));
    listEl.innerHTML = items.length ? `<div class="section-t"><span>Sohbetler</span></div>${items.map((c) => `<a class="list-item chat-item" href="#/chat/${esc(c.id)}">
        ${avatar(c.other, 56, { ring: true, dot: !c.isGroup })}
        <div class="grow"><div class="row" style="gap:6px"><span class="ellipsis grow ${c.unread ? 'b' : ''}" style="font-weight:${c.unread ? 700 : 600}">${nm(c.other)}</span>${streakChip(c.streak)}<span class="muted" style="font-size:12px">${c.last ? ago(c.last.at) : ''}</span></div>
        <div class="last ${c.unread ? 'unread' : ''}"><span class="ellipsis grow">${lastText(c)}</span>${c.unread ? `<span class="unread-n">${c.unread}</span>` : ''}</div></div></a>`).join('')}`
      : `<div class="empty"><div class="big">${icon('send')}</div><h2>Henüz sohbet yok</h2>Kaydırıp eşleştiğinde ya da birine yazdığında sohbetlerin burada görünür.<p><a class="btn primary" href="#/swipe">Keşfetmeye başla</a></p></div>`;
  };
  const load = async () => {
    [list, matches] = await Promise.all([api('/chats'), api('/matches')]);
    paintMatches(); paint(); paintStk();
  };
  // Seri özeti: kaç sohbet serin var, kaçı bu gece bitiyor
  const stkEl = view.querySelector('.stk-entry');
  const paintStk = () => {
    const s = list.filter((c) => c.streak?.count);
    const risk = s.filter((c) => !c.streak.done).length;
    stkEl.hidden = !s.length;
    if (s.length) stkEl.innerHTML = `${egi('seri', 40)}<span class="grow"><b>${s.length} sohbet serin var</b><small>${risk ? `${risk} tanesi bugün bekliyor, bozulmasın!` : 'Bugün hepsini korudun 💪'}</small></span><span class="go-chip">Seriler</span>`;
  };
  // Notlar: 24 saatlik kısa not, karşılıklı takipleştiklerine görünür
  const notesEl = view.querySelector('.notes-wrap');
  let notes = [];
  const loadNotes = async () => {
    if (['falci', 'official'].includes(state.me.role)) return;
    notes = await api('/notes').catch(() => []);
    notesEl.innerHTML = notesRowHtml(notes);
  };
  notesEl.onclick = (e) => { const b = e.target.closest('.note'); if (b) noteSheet(notes, b.dataset.u, loadNotes); };
  await Promise.all([load(), loadNotes()]);

  view.querySelector('.q').oninput = (e) => { filter = e.target.value.toLowerCase().trim(); paint(); };
  view.querySelector('.new').onclick = () => {
    sheet('Yeni mesaj', `<div class="search-bar" style="position:static"><label class="sw">${icon('search')}<input class="field" placeholder="Kişi ara"></label></div><div class="res"></div>`, {
      async onMount(sh) {
        const res = sh.querySelector('.res');
        const show = (us) => { res.innerHTML = us.filter((u) => u.id !== state.me.id).map((u) => `<button class="list-item" data-id="${esc(u.id)}">${avatar(u, 44)}<div><div class="b">${nm(u)}</div><div class="sub">@${esc(u.username)}${u.online ? ' · çevrimiçi' : ''}</div></div></button>`).join(''); };
        show(await api('/people'));
        let t;
        sh.querySelector('input').oninput = (e) => {
          clearTimeout(t);
          t = setTimeout(async () => show(e.target.value.trim() ? await api(`/users/search?q=${encodeURIComponent(e.target.value)}`) : await api('/people')), 200);
        };
        res.onclick = (e) => { const b = e.target.closest('[data-id]'); if (b) openChatWith(b.dataset.id); };
      },
    });
  };

  const offs = [
    on('message', (m) => {
      const c = list.find((x) => x.id === m.chatId);
      if (!c) { load(); return; }
      c.last = m; typing.delete(c.id);
      if (m.from !== state.me.id && !m.system) c.unread++;
      paintMatches(); paint();
    }),
    on('typing', ({ chatId, typing: t, kind }) => { t ? typing.set(chatId, kind || 'text') : typing.delete(chatId); paint(); }),
    on('presence', paint),
    on('chat:removed', load),
    on('chat:update', load),
    on('streak', ({ chatId, count }) => { const c = list.find((x) => x.id === chatId); if (c) { c.streak = { ...(c.streak || {}), count, done: true }; paint(); paintStk(); } }),
    on('badges', paintMatches),
    on('reconnected', load),
    on('notes:update', loadNotes),
  ];
  refreshBadges();
  return () => offs.forEach((f) => f());
}

// Karaoke odası: sırayla şarkı söylenir (canlı yayınla), dinleyenler 1–5 yıldız verir.
// Haftanın en iyileri ön elemeyi geçer ve şarkı yarışmasına davet edilir.
import { icon } from '../icons.js';
import { api, esc, toast, on, avatar, nm } from '../core.js';

const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const stars = (n, mine) => [1, 2, 3, 4, 5].map((i) => `<button class="kr-st ${mine && i <= mine ? 'on' : ''}" data-s="${i}" aria-label="${i} yıldız">★</button>`).join('');

export default async function karaoke(view) {
  view.innerHTML = `<header class="topbar"><button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/')" aria-label="Geri">${icon('back')}</button><div class="center">🎤 Karaoke odası</div><a class="ib soft" href="#/sarki" aria-label="Şarkı yarışması">🏆</a></header>
    <div class="kr"><div class="spinner"></div></div>`;
  const box = view.querySelector('.kr');
  let d; let timer = null;
  const paint = () => {
    if (!d.enabled) { box.innerHTML = '<div class="empty"><div class="big">🎤</div><h2>Karaoke şu an kapalı</h2>Yakında tekrar açılacak.</div>'; return; }
    const c = d.cur;
    const stage = c ? `<section class="kr-stage ${c.live ? 'on' : ''}">
        <div class="kr-lights"><i></i><i></i><i></i></div>
        <a href="#/u/${esc(c.user.username)}">${avatar(c.user, 84, { ring: true, dot: false })}</a>
        <b class="kr-who">${nm(c.user)}</b><span class="kr-song">🎵 ${esc(c.song)}</span>
        <span class="kr-t">${c.live ? '🔴 CANLI · ' : '⏳ Yayına başlaması bekleniyor · '}<em class="kr-left">${mmss(c.endsAt - Date.now())}</em></span>
        ${d.myTurn
    ? `<div class="kr-me"><a class="btn primary" href="#/live">${icon('live')} ${c.live ? 'Yayına dön' : 'Yayına başla'}</a><button class="btn kr-done">Bitirdim</button></div><small class="muted">Sahnedesin! Yayını açıp şarkını söyle, dinleyenler puan versin.</small>`
    : `${c.live ? `<a class="btn primary" href="#/live/${esc(c.user.id)}">${icon('play')} Dinle ve izle</a>` : ''}
          <div class="kr-rate"><small>${c.myScore ? 'Puanın' : 'Puan ver'}</small><div class="kr-stars">${stars(5, c.myScore)}</div></div>`}
        <span class="kr-avg">${c.votes ? `⭐ ${c.avg} · ${c.votes} oy` : 'Henüz oy yok'}</span></section>`
      : `<section class="kr-stage empty-s"><div class="kr-lights"><i></i><i></i><i></i></div><span class="kr-mic">🎤</span><b>Sahne boş!</b><small>Sıraya ilk sen gir, mikrofon senin olsun.</small></section>`;
    const join = d.myPos ? `<div class="kr-pos"><span>Sıradasın: <b>${d.myPos}.</b></span><button class="btn sm kr-leave">Sıradan çık</button></div>`
      : d.myTurn ? '' : `<form class="kr-join"><input class="field" name="s" maxlength="80" placeholder="Hangi şarkıyı söyleyeceksin?" required><button class="btn primary">Sıraya gir</button></form>`;
    box.innerHTML = `${stage}${join}
      <p class="muted kr-help">Her sahne ${d.turnMinutes} dakika. Sıran gelince 90 saniye içinde canlı yayını açmalısın. 5+ kişiden 4.5 üstü puan alanlar şarkı yarışmasının ön elemesini geçer 🏆</p>
      <div class="section-t"><span>Sıra${d.queue.length ? ` · ${d.queue.length}` : ''}</span></div>
      ${d.queue.length ? d.queue.map((q) => `<div class="list-item kr-q ${q.mine ? 'mine' : ''}"><span class="kr-n">${q.pos}</span>${avatar(q.user, 40, { dot: false })}<div class="grow"><div class="b">${nm(q.user)}</div><div class="sub">🎵 ${esc(q.song)}</div></div></div>`).join('') : '<p class="muted" style="margin:4px 16px 12px;font-size:13.5px">Sırada kimse yok.</p>'}
      <div class="section-t"><span>🏆 Bu haftanın en iyileri</span></div>
      ${d.board.length ? d.board.map((b) => `<a class="list-item kr-b" href="#/u/${esc(b.user.username)}"><span class="kr-n ${b.rank <= 3 ? `r${b.rank}` : ''}">${b.rank <= 3 ? ['🥇', '🥈', '🥉'][b.rank - 1] : b.rank}</span>${avatar(b.user, 40, { dot: false })}<div class="grow"><div class="b">${nm(b.user)}</div><div class="sub">🎵 ${esc(b.song)}</div></div><b class="kr-sc">⭐ ${b.avg}</b></a>`).join('') : '<p class="muted" style="margin:4px 16px 30px;font-size:13.5px">Bu hafta henüz en az 3 oy alan bir performans yok.</p>'}`;
  };
  const load = async () => { d = await api('/karaoke'); paint(); };
  box.addEventListener('submit', async (e) => {
    e.preventDefault();
    const song = e.target.s.value.trim(); if (!song) return;
    try { d = await api('/karaoke/queue', { body: { song } }); paint(); toast(d.myTurn ? '🎤 Sıra sende! Yayını başlat.' : `Sıraya girdin: ${d.myPos}.`); } catch (er) { toast(er.message); }
  });
  box.addEventListener('click', async (e) => {
    try {
      const st = e.target.closest('.kr-st');
      if (st) { d = await api('/karaoke/score', { body: { score: +st.dataset.s } }); paint(); toast(`⭐ ${st.dataset.s} puan verdin`); return; }
      if (e.target.closest('.kr-leave')) { d = await api('/karaoke/queue', { method: 'DELETE' }); paint(); return; }
      if (e.target.closest('.kr-done') && confirm('Sahneyi bırakıp sıradakine geçilsin mi?')) { d = await api('/karaoke/done', { body: {} }); paint(); toast('Teşekkürler! Puanların birazdan bildirim olarak gelecek 🎤'); }
    } catch (er) { toast(er.message); }
  });
  await load();
  timer = setInterval(() => { const el = box.querySelector('.kr-left'); if (el && d?.cur) el.textContent = mmss(d.cur.endsAt - Date.now()); }, 1000);
  let pend = null;
  const offs = [
    on('karaoke', () => { clearTimeout(pend); pend = setTimeout(() => load().catch(() => {}), 300); }),
    on('karaoke:turn', () => { navigator.vibrate?.([40, 60, 40]); load().catch(() => {}); }),
    on('reconnected', () => load().catch(() => {})),
  ];
  return () => { clearInterval(timer); clearTimeout(pend); offs.forEach((f) => f()); };
}

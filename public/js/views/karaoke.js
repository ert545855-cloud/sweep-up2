// Karaoke odası: sırayla şarkı söylenir (sesli ya da görüntülü sahne), dinleyenler 1–5 yıldız verir.
// Haftanın en iyileri ön elemeyi geçer ve şarkı yarışmasına davet edilir.
import { icon } from '../icons.js';
import { api, esc, toast, on, avatar, nm } from '../core.js';
import { egi } from '../eg-icons.js';

const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const stars = (n, mine) => [1, 2, 3, 4, 5].map((i) => `<button class="kr-st ${mine && i <= mine ? 'on' : ''}" data-s="${i}" aria-label="${i} yıldız">★</button>`).join('');

export default async function karaoke(view) {
  view.innerHTML = `<header class="topbar"><button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/')" aria-label="Geri">${icon('back')}</button><div class="center">Karaoke odası</div><a class="ib soft" href="#/sarki" aria-label="Şarkı yarışması">${egi('odul', 30)}</a></header>
    <div class="kr"><div class="spinner"></div></div>`;
  const box = view.querySelector('.kr');
  let d; let timer = null;
  const paint = () => {
    if (!d.enabled) { box.innerHTML = `<div class="empty"><div class="big">${egi('karaoke', 72)}</div><h2>Karaoke şu an kapalı</h2>Yakında tekrar açılacak.</div>`; return; }
    const c = d.cur;
    const stage = c ? `<section class="kr-stage ${c.live ? 'on' : ''}">
        <div class="kr-lights"><i></i><i></i><i></i></div>
        <a href="#/u/${esc(c.user.username)}">${avatar(c.user, 84, { ring: true, dot: false })}</a>
        <b class="kr-who">${nm(c.user)}</b><span class="kr-song">${esc(c.song)}</span>
        <span class="kr-t">${c.live ? '<i class="kr-dot"></i>CANLI · ' : 'Yayına başlaması bekleniyor · '}<em class="kr-left">${mmss(c.endsAt - Date.now())}</em></span>
        ${d.myTurn
    ? `<div class="kr-me"><a class="btn primary" href="#/karaoke/sahne">${icon('mic')} ${c.live ? 'Sahneye dön' : 'Sahneye çık'}</a><button class="btn kr-done">${c.live ? 'Bitirdim' : 'Vazgeç'}</button></div><small class="muted">Sahne senin! Kamera açmak zorunda değilsin: müzik çalar, sözler altta akar, sen söylersin.</small>`
    : `${c.live ? `<a class="btn primary" href="#/live/${esc(c.user.id)}">${icon('play')} Dinle ve izle</a>` : ''}
          <div class="kr-rate"><small>${c.myScore ? 'Puanın' : 'Puan ver'}</small><div class="kr-stars">${stars(5, c.myScore)}</div></div>`}
        <span class="kr-avg">${c.votes ? `${c.avg} / 5 · ${c.votes} oy` : 'Henüz oy yok'}</span></section>`
      : `<section class="kr-stage empty-s"><div class="kr-lights"><i></i><i></i><i></i></div>${egi('karaoke', 80, 'kr-mic')}<b>Sahne boş!</b><small>Sıraya ilk sen gir, mikrofon senin olsun.</small></section>`;
    const join = d.myPos ? `<div class="kr-pos"><span>Sıradasın: <b>${d.myPos}.</b></span><button class="btn sm kr-leave">Sıradan çık</button></div>`
      : d.myTurn ? '' : `<form class="kr-join"><input class="field" name="s" maxlength="80" placeholder="${d.catalog ? 'Şarkı ara ya da adını yaz' : 'Hangi şarkıyı söyleyeceksin?'}" required autocomplete="off"><button class="btn primary">Sıraya gir</button></form>${d.catalog ? '<p class="kr-cat-t">Müziği ve sözleri hazır şarkılar</p><div class="kr-cat"></div>' : ''}<div class="kr-web"></div>`;
    const old = box.querySelector('.kr-join input'); const typed = old?.value || ''; const focused = !!old && document.activeElement === old; // yeniden çizimde yazılan kaybolmasın
    box.innerHTML = `${stage}${join}
      <p class="muted kr-help">Her sahne ${d.turnMinutes} dakika. Sıran gelince 90 saniye içinde sahneye çıkmalısın. Kamera zorunlu değil. 5+ kişiden 4.5 üstü puan alanlar şarkı yarışmasının ön elemesini geçer.</p>
      <div class="section-t"><span>Sıra${d.queue.length ? ` · ${d.queue.length}` : ''}</span></div>
      ${d.queue.length ? d.queue.map((q) => `<div class="list-item kr-q ${q.mine ? 'mine' : ''}"><span class="kr-n">${q.pos}</span>${avatar(q.user, 40, { dot: false })}<div class="grow"><div class="b">${nm(q.user)}</div><div class="sub">${esc(q.song)}</div></div></div>`).join('') : '<p class="muted" style="margin:4px 16px 12px;font-size:13.5px">Sırada kimse yok.</p>'}
      <div class="section-t"><span class="sec-ic">${egi('odul', 24)}Bu haftanın en iyileri</span></div>
      ${d.board.length ? d.board.map((b) => `<a class="list-item kr-b" href="#/u/${esc(b.user.username)}"><span class="kr-n ${b.rank <= 3 ? `r${b.rank}` : ''}">${b.rank}</span>${avatar(b.user, 40, { dot: false })}<div class="grow"><div class="b">${nm(b.user)}</div><div class="sub">${esc(b.song)}</div></div><b class="kr-sc">${icon('star')}${b.avg}</b></a>`).join('') : '<p class="muted" style="margin:4px 16px 30px;font-size:13.5px">Bu hafta henüz en az 3 oy alan bir performans yok.</p>'}`;
    const inp = box.querySelector('.kr-join input'); if (inp) { inp.value = typed; if (focused) { inp.focus(); inp.setSelectionRange(typed.length, typed.length); } }
    cat(); drawFound();
  };
  // Müziği ve sözleri hazır şarkılar: yazdıkça süzülür, dokununca o şarkıyla sıraya girilir
  let songs = null;
  function cat() {
    const el = box.querySelector('.kr-cat'); if (!el || !songs) return;
    const q = (box.querySelector('.kr-join input')?.value || '').toLocaleLowerCase('tr-TR').trim();
    const list = songs.filter((s) => !q || `${s.title} ${s.artist}`.toLocaleLowerCase('tr-TR').includes(q)).slice(0, 40);
    el.innerHTML = list.map((s) => `<button type="button" class="kr-pick" data-id="${esc(s.id)}"><span class="kr-nt">${icon('music')}</span><span class="grow"><b>${esc(s.title)}</b><small>${esc(s.artist)}</small></span>${s.hasAudio ? '<em>Müzik</em>' : ''}${s.hasLyrics ? '<em>Sözler</em>' : ''}</button>`).join('');
    const t = box.querySelector('.kr-cat-t'); if (t) t.hidden = !list.length;
  }
  // Müzik araması (Spotify bağlıysa oradan): doğru şarkı adı ve sanatçıyla sıraya girilir; sözler buna göre bulunur
  let seekT = null; let seekN = 0; let found = { q: '', items: [], spotify: false };
  function drawFound() {
    const el = box.querySelector('.kr-web'); if (!el) return;
    el.innerHTML = found.items.length ? `<p class="kr-cat-t">${found.spotify ? 'Spotify’da bulunanlar' : 'Bulunan şarkılar'}</p>${found.items.slice(0, 8).map((m, i) => `<button type="button" class="kr-pick kr-sp" data-i="${i}">${m.cover ? `<img src="${esc(m.cover)}" alt="" loading="lazy">` : `<span class="kr-nt">${icon('music')}</span>`}<span class="grow"><b>${esc(m.title)}</b><small>${esc(m.artist)}</small></span></button>`).join('')}<p class="muted kr-web-n">Bu şarkılarda müziği sahnede telefonundan seçersin; sözler otomatik aranır.</p>` : '';
  }
  function seek() {
    const q = (box.querySelector('.kr-join input')?.value || '').trim(); clearTimeout(seekT);
    if (q.length < 2) { found = { q: '', items: [], spotify: false }; drawFound(); return; }
    if (q === found.q) return drawFound();
    seekT = setTimeout(async () => { const n = ++seekN; try { const r = await api(`/music/search?q=${encodeURIComponent(q)}`); if (n === seekN) { found = { q, items: r.items || [], spotify: !!r.spotify }; drawFound(); } } catch { /* arama yoksa elle yazılır */ } }, 380);
  }
  box.addEventListener('input', (e) => { if (e.target.closest('.kr-join')) { cat(); seek(); } });
  const load = async () => { d = await api('/karaoke'); if (d.catalog && !songs) songs = await api('/karaoke/songs').catch(() => []); paint(); };
  box.addEventListener('submit', async (e) => {
    e.preventDefault();
    const song = e.target.s.value.trim(); if (!song) return;
    try { d = await api('/karaoke/queue', { body: { song } }); paint(); toast(d.myTurn ? 'Sıra sende! Sahneye çık.' : `Sıraya girdin: ${d.myPos}.`); } catch (er) { toast(er.message); }
  });
  box.addEventListener('click', async (e) => {
    try {
      const sp = e.target.closest('.kr-sp');
      if (sp) { const m = found.items[+sp.dataset.i]; if (!m) return; d = await api('/karaoke/queue', { body: { song: `${m.title} – ${m.artist}`.slice(0, 80) } }); found = { q: '', items: [], spotify: false }; paint(); toast(d.myTurn ? 'Sıra sende! Sahneye çık.' : `Sıraya girdin: ${d.myPos}.`); return; }
      const pk = e.target.closest('.kr-pick');
      if (pk) { d = await api('/karaoke/queue', { body: { songId: pk.dataset.id } }); paint(); toast(d.myTurn ? 'Sıra sende! Sahneye çık.' : `Sıraya girdin: ${d.myPos}.`); return; }
      const st = e.target.closest('.kr-st');
      if (st) { d = await api('/karaoke/score', { body: { score: +st.dataset.s } }); paint(); toast(`${st.dataset.s} puan verdin`); return; }
      if (e.target.closest('.kr-leave')) { d = await api('/karaoke/queue', { method: 'DELETE' }); paint(); return; }
      if (e.target.closest('.kr-done') && confirm('Sahneyi bırakıp sıradakine geçilsin mi?')) { d = await api('/karaoke/done', { body: {} }); paint(); toast('Teşekkürler! Puanların birazdan bildirim olarak gelecek.'); }
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

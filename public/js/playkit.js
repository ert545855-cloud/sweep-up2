// Oyun masası kabuğu: başlık, bekleme ekranı, sonuç ekranı, süre çubuğu, masa sohbeti, davet, kurallar.
// Her oyun kendi tahtasını render(ctx) ile çizer.
import { icon } from './icons.js';
import { api, esc, toast, on, sheet, pickPerson, state } from './core.js';

export const GAME_INFO = {};
export function seatChip(v, i, { cls = '', extra = '' } = {}) {
  const s = v.seats[i];
  if (!s) return `<div class="pk-seat empty ${cls}"><span class="pk-av">${icon('plus')}</span><b>Boş</b></div>`;
  const turn = v.status === 'playing' && v.turn === i;
  const won = v.status === 'ended' && v.result?.winners?.includes(i);
  return `<div class="pk-seat ${turn ? 'turn' : ''} ${won ? 'won' : ''} ${i === v.me ? 'me' : ''} ${cls}" data-seat="${i}"><span class="pk-av"><img src="${esc(s.avatar)}" alt="">${turn ? '<i class="pk-ring"></i>' : ''}${s.afk ? '<em class="pk-afk">bot</em>' : ''}</span><b class="ellipsis">${esc(i === v.me ? 'Sen' : s.name)}</b>${extra}${s.score ? `<small class="pk-sc">${s.score}</small>` : ''}</div>`;
}

export async function playTable(view, game, id, opt) {
  const { title, render, rules, theme = '', chat = 'drawer', minSize, maxSize, sizeLabel, waitingHtml, endHtml, after } = opt;
  view.innerHTML = `<div class="pk-wrap ${theme}"><div class="spinner" style="margin:40vh auto"></div></div>`;
  let v;
  try { v = await api(`/play/${game}/${id}`); } catch (e) { view.innerHTML = `<div class="empty"><div class="big">🎮</div><h2>Masa bulunamadı</h2>${esc(e.message)}<p><a class="btn primary" href="#/oyunlar">Oyunlara dön</a></p></div>`; return null; }
  if (v.me < 0) { try { v = await api(`/play/${game}/${id}/join`, { body: {} }); } catch (e) { toast(e.message); location.hash = '#/oyunlar'; return null; } }
  view.innerHTML = `<div class="pk-wrap ${theme}">
    <header class="pk-h"><button class="ib pk-x" aria-label="Çık">${icon('back')}</button><b class="pk-title"></b><span class="grow"></span>
      ${chat === 'drawer' ? `<button class="ib pk-chat-b" aria-label="Sohbet">${icon('comment')}<i class="pk-dot" hidden></i></button>` : ''}
      <button class="ib pk-inv" aria-label="Arkadaş çağır">${icon('userPlus')}</button>${rules ? `<button class="ib pk-help" aria-label="Kurallar">${icon('question')}</button>` : ''}</header>
    <div class="pk-timer" hidden><i></i></div>
    <div class="pk-board"></div>
    ${chat === 'inline' ? '<div class="pk-chat inline ' + (opt.chatTall ? 'tall' : '') + '"><div class="pk-msgs"></div><form class="pk-f"><input class="field" maxlength="160" placeholder="Mesaj yaz…" autocomplete="off" enterkeyhint="send"><button class="btn primary sm">' + icon('send') + '</button></form></div>' : ''}
    <div class="pk-over" hidden></div>
  </div>`;
  const wrap = view.querySelector('.pk-wrap'); const board = view.querySelector('.pk-board'); const over = view.querySelector('.pk-over');
  let raf = 0; let chatOpen = false; let seenChat = v.chat.length; let busy = false;
  const ctx = {
    get v() { return v; }, board, wrap,
    async move(body) {
      if (busy) return null; busy = true;
      try { v = await api(`/play/${game}/${id}/move`, { body }); paint(); return v; } catch (e) { toast(e.message); return null; } finally { busy = false; }
    },
    async chat(text) { try { const r = await api(`/play/${game}/${id}/chat`, { body: { text } }); if (r?.warn) toast(r.warn); if (r?.correct) { toast('Bildin! 🎉'); navigator.vibrate?.([20, 40, 20]); } return r; } catch (e) { toast(e.message); return null; } },
    paint: () => paint(),
  };
  const timer = () => {
    cancelAnimationFrame(raf);
    const el = view.querySelector('.pk-timer'); const bar = el.querySelector('i');
    el.hidden = !(v.deadline && v.status === 'playing');
    if (el.hidden) return;
    const total = v.turnMs || 30000;
    const step = () => { const left = Math.max(0, v.deadline - Date.now()); bar.style.width = `${Math.min(100, (left / total) * 100)}%`; bar.classList.toggle('low', left < 8000); if (left > 0) raf = requestAnimationFrame(step); };
    step();
  };
  const msgsHtml = () => v.chat.map((m) => (m.sys ? `<div class="pk-m sys ${m.ok ? 'ok' : ''}">${esc(m.text)}</div>` : `<div class="pk-m ${m.uid === state.me.id ? 'me' : ''}"><b>${esc(m.name)}</b> ${esc(m.text)}</div>`)).join('');
  const paintChat = () => {
    const box = view.querySelector('.pk-chat.inline .pk-msgs');
    if (box) { const atB = box.scrollHeight - box.scrollTop - box.clientHeight < 40; box.innerHTML = msgsHtml(); if (atB) box.scrollTop = box.scrollHeight; }
    const d = view.querySelector('.pk-dot'); if (d) d.hidden = chatOpen || v.chat.filter((m) => !m.sys).length <= seenChat;
    const open = document.querySelector('.pk-chat-sheet .pk-msgs'); if (open) { open.innerHTML = msgsHtml(); open.scrollTop = open.scrollHeight; }
  };
  function paint() {
    view.querySelector('.pk-title').textContent = `${title}${v.round > 1 || (v.round && v.status !== 'waiting') ? ` · ${v.round}. ${opt.roundWord || 'el'}` : ''}`;
    wrap.classList.toggle('waiting', v.status === 'waiting');
    if (v.status !== 'waiting') {
      // Yazılan metin ve odak yeniden çizimde kaybolmasın
      const keep = [...board.querySelectorAll('input, textarea')].map((el) => ({ k: el.name || el.className, v: el.value, f: el === document.activeElement, s: el.selectionStart }));
      try { render(ctx); } catch (e) { console.error(e); board.innerHTML = `<div class="empty">Tahta çizilemedi: ${esc(e.message)}</div>`; }
      keep.forEach((x) => {
        const el = [...board.querySelectorAll('input, textarea')].find((e) => (e.name || e.className) === x.k); if (!el) return;
        if (x.v && !el.value && !el.disabled) el.value = x.v;
        if (x.f && document.activeElement !== el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(x.s, x.s); } catch {} }
      });
    } else board.innerHTML = '';
    // Bekleme ekranı
    if (v.status === 'waiting') {
      const people = v.seats.filter(Boolean).length;
      over.hidden = false;
      over.innerHTML = `<div class="pk-card"><div class="big">${opt.emoji || '🎮'}</div><h2>${esc(title)}</h2>
        <div class="pk-wseats">${v.seats.map((s, i) => seatChip(v, i)).join('')}</div>
        ${v.host && minSize && maxSize && minSize !== maxSize ? (maxSize - minSize > 3
    ? `<div class="pk-sizes"><small>Oyuncu sayısı</small><div class="seg pk-size many">${Array.from({ length: maxSize - minSize + 1 }, (_, k) => minSize + k).map((n) => `<button data-n="${n}" class="${n === v.size ? 'on' : ''}">${n}</button>`).join('')}</div></div>`
    : `<div class="seg pk-size">${Array.from({ length: maxSize - minSize + 1 }, (_, k) => minSize + k).map((n) => `<button data-n="${n}" class="${n === v.size ? 'on' : ''}">${n} ${sizeLabel || 'kişi'}</button>`).join('')}</div>`) : ''}
        ${waitingHtml ? waitingHtml(v) : ''}
        <p class="muted pk-note">${opt.bots === false ? `En az ${opt.minHumans || 2} kişi gerekli. Arkadaşlarını davet et.` : 'Arkadaşlarını davet et ya da boş yerlere bot oturtarak hemen başla.'}</p>
        <div class="pk-acts">${v.host ? `<button class="btn primary pk-start" ${opt.bots === false && people < (opt.minHumans || 2) ? 'disabled' : ''}>${opt.bots === false ? 'Oyunu başlat' : people < v.size ? 'Botlarla başlat' : 'Başlat'}</button>` : '<span class="muted">Masayı açan kişi başlatacak.</span>'}
        <button class="btn pk-inv2">${icon('userPlus')} Davet et</button></div></div>`;
    } else if (v.status === 'ended') {
      over.hidden = false;
      const win = v.result?.winners || []; const iWon = win.includes(v.me);
      const ranked = v.seats.map((s, i) => ({ s, i })).filter((x) => x.s).sort((a, b) => (b.s.score || 0) - (a.s.score || 0));
      over.innerHTML = `<div class="pk-card"><div class="big">${iWon ? '🏆' : win.length ? (opt.emoji || '🎮') : '🤝'}</div><h2>${esc(v.result?.text || 'Oyun bitti')}</h2>
        ${endHtml ? endHtml(v) : ''}
        <div class="pk-score">${ranked.map(({ s, i }) => `<span class="${win.includes(i) ? 'w' : ''}"><img src="${esc(s.avatar)}" alt="">${esc(i === v.me ? 'Sen' : s.name)}<b>${s.score || 0}</b></span>`).join('')}</div>
        <div class="pk-acts">${opt.party && !v.host ? '<span class="muted">Odayı açan yeni oyunu başlatabilir.</span>' : `<button class="btn primary pk-again">${opt.againLabel || 'Yeni el'}</button>`}<button class="btn pk-x">Çık</button></div></div>`;
    } else { over.hidden = true; over.innerHTML = ''; }
    timer(); paintChat();
    after?.(ctx);
  }
  const openChat = () => {
    chatOpen = true; seenChat = v.chat.filter((m) => !m.sys).length; paintChat();
    sheet('Masa sohbeti', `<div class="pk-chat-sheet"><div class="pk-msgs">${msgsHtml()}</div><form class="pk-f"><input class="field" maxlength="160" placeholder="Mesaj yaz…" autocomplete="off" enterkeyhint="send"><button class="btn primary sm">${icon('send')}</button></form></div>`, {
      onClose: () => { chatOpen = false; seenChat = v.chat.filter((m) => !m.sys).length; paintChat(); },
      onMount(sh) { const box = sh.querySelector('.pk-msgs'); box.scrollTop = box.scrollHeight; sh.querySelector('.pk-f').onsubmit = (e) => { e.preventDefault(); const i = e.currentTarget.querySelector('input'); const t = i.value.trim(); if (!t) return; i.value = ''; ctx.chat(t); }; },
    });
  };
  const invite = () => {
    const url = `${location.origin}/#/oyun/${game}/${id}`;
    sheet('Arkadaşını çağır', `<div class="menu"><button data-a="p">${icon('userPlus')}SwipeUp’tan birini çağır</button><button data-a="l">${icon('link')}Bağlantıyı kopyala</button>${navigator.share ? `<button data-a="s">${icon('share')}Paylaş</button>` : ''}</div>`, {
      onMount(sh, close) {
        sh.querySelector('.menu').onclick = async (e) => {
          const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; close();
          if (a === 'p') pickPerson(`${title} oynamaya çağır`, async (u) => { if (!u) return; try { await api(`/play/${game}/${id}/invite`, { body: { userId: u.id } }); toast(`${u.username} çağrıldı.`); } catch (er) { toast(er.message); } });
          if (a === 'l') { try { await navigator.clipboard.writeText(url); toast('Bağlantı kopyalandı.'); } catch { toast(url); } }
          if (a === 's') navigator.share({ title: `SwipeUp ${title}`, text: `${title} oynayalım mı? ${opt.emoji || '🎮'}`, url }).catch(() => {});
        };
      },
    });
  };
  wrap.addEventListener('click', async (e) => {
    if (e.target.closest('.pk-x')) {
      if (v.status === 'playing' && !confirm(opt.party ? 'Oyundan çıkmak istiyor musun?' : 'Masadan kalkarsan yerine bot oynar. Emin misin?')) return;
      await api(`/play/${game}/${id}/leave`, { body: {} }).catch(() => {}); location.hash = '#/oyunlar'; return;
    }
    if (e.target.closest('.pk-inv, .pk-inv2')) return invite();
    if (e.target.closest('.pk-help')) return sheet(`${title} nasıl oynanır?`, `<div class="pk-rules">${rules}</div>`);
    if (e.target.closest('.pk-chat-b')) return openChat();
    const sz = e.target.closest('.pk-size [data-n]');
    if (sz) { try { v = await api(`/play/${game}/${id}/size`, { body: { size: +sz.dataset.n } }); paint(); } catch (er) { toast(er.message); } return; }
    const op = e.target.closest('.pk-opt [data-k]');
    if (op) { try { v = await api(`/play/${game}/${id}/opts`, { body: { [op.dataset.k]: op.dataset.v } }); paint(); } catch (er) { toast(er.message); } return; }
    if (e.target.closest('.pk-start')) { try { v = await api(`/play/${game}/${id}/start`, { body: {} }); paint(); } catch (er) { toast(er.message); } return; }
    if (e.target.closest('.pk-again')) { try { v = await api(`/play/${game}/${id}/again`, { body: {} }); paint(); } catch (er) { toast(er.message); } }
  });
  view.querySelector('.pk-chat.inline .pk-f')?.addEventListener('submit', (e) => { e.preventDefault(); const i = e.currentTarget.querySelector('input'); const t = i.value.trim(); if (!t) return; i.value = ''; ctx.chat(t); });
  const offs = [on('play', (x) => {
    if (x.id !== id) return;
    const myTurnBefore = v.status === 'playing' && v.turn === v.me;
    v = x; paint();
    if (v.status === 'playing' && v.turn === v.me && !myTurnBefore) navigator.vibrate?.(15);
  })];
  paint();
  return () => { offs.forEach((f) => f()); cancelAnimationFrame(raf); opt.cleanup?.(); };
}

// Kart görünümü (Pişti, Batak, Renk Eşle için ortak)
export const SUITS = { S: ['♠', 'blk'], H: ['♥', 'red'], D: ['♦', 'red'], C: ['♣', 'blk'] };
export function cardHtml(c, { cls = '', attrs = '' } = {}) {
  if (!c) return `<span class="pc back ${cls}" ${attrs}></span>`;
  const [sym, col] = SUITS[c.s] || ['?', 'blk'];
  const r = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[c.r] || c.r;
  return `<span class="pc ${col} ${cls}" data-id="${esc(c.id)}" ${attrs}><b>${r}</b><i>${sym}</i><em>${sym}</em></span>`;
}

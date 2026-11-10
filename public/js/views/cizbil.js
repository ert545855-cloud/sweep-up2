// Çiz Bil: sırayla biri çizer, diğerleri tahmin eder
import { icon } from '../icons.js';
import { leaveTo } from '../nav.js';
import { api, esc, toast, state, on, sheet, pickPerson } from '../core.js';

const COLORS = ['#111111', '#ffffff', '#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#92400e', '#9ca3af'];
const SIZES = [3, 7, 14, 26];

export default async function cizbil(view, id) {
  view.innerHTML = '<div class="cb-wrap"><div class="spinner" style="margin-top:40vh"></div></div>';
  let v;
  try { v = await api(`/games/cizbil/${id}`); } catch (e) { view.innerHTML = `<div class="empty"><div class="big">🎨</div><h2>Oda bulunamadı</h2>${esc(e.message)}<p><a class="btn primary" href="#/oyunlar">Oyunlara dön</a></p></div>`; return null; }
  if (!v.joined) { try { v = await api(`/games/cizbil/${id}/join`, { body: {} }); } catch (e) { toast(e.message); leaveTo('#/oyunlar'); return null; } }
  let strokes = v.strokes || []; let color = '#111111'; let size = 7; let eraser = false; let tick = 0;
  const s = state.socket; s?.emit('cb:join', { id });
  const isDrawer = () => v.status === 'playing' && v.drawer === v.me && v.phase === 'draw';

  view.innerHTML = `<div class="cb-wrap">
    <header class="ok-h"><button class="ib cb-x" aria-label="Odadan çık">${icon('back')}</button><b class="cb-title">Çiz Bil</b><span class="grow"></span><span class="cb-time"></span>
      <button class="ib cb-inv" aria-label="Arkadaş çağır">${icon('userPlus')}</button></header>
    <div class="cb-word"></div>
    <div class="cb-board"><canvas width="900" height="900"></canvas><div class="cb-over"></div></div>
    <div class="cb-tools" hidden>${COLORS.map((c) => `<button class="cb-c" data-c="${c}" style="background:${c}" aria-label="Renk"></button>`).join('')}
      <span class="cb-sep"></span>${SIZES.map((z) => `<button class="cb-z" data-z="${z}" aria-label="Kalınlık"><i style="width:${Math.min(22, z)}px;height:${Math.min(22, z)}px"></i></button>`).join('')}
      <button class="cb-e" aria-label="Silgi">🧽</button><button class="cb-u" aria-label="Geri al">${icon('undo')}</button><button class="cb-cl" aria-label="Temizle">${icon('trash')}</button></div>
    <div class="cb-players"></div>
    <div class="cb-chat"></div>
    <form class="cb-f"><input class="field" maxlength="80" placeholder="Tahminini yaz…" autocomplete="off" enterkeyhint="send"><button class="btn primary sm">${icon('send')}</button></form>
  </div>`;
  const cv = view.querySelector('canvas'); const g = cv.getContext('2d');
  g.lineCap = 'round'; g.lineJoin = 'round';
  const W = cv.width; const H = cv.height;
  const drawStroke = (st) => {
    if (!st.pts.length) return;
    g.strokeStyle = st.c; g.fillStyle = st.c; g.lineWidth = st.w * (W / 300);
    if (st.pts.length === 1) { g.beginPath(); g.arc(st.pts[0][0] * W, st.pts[0][1] * H, (st.w * (W / 300)) / 2, 0, Math.PI * 2); g.fill(); return; }
    g.beginPath(); g.moveTo(st.pts[0][0] * W, st.pts[0][1] * H);
    for (let i = 1; i < st.pts.length; i++) g.lineTo(st.pts[i][0] * W, st.pts[i][1] * H);
    g.stroke();
  };
  const redraw = () => { g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); strokes.forEach(drawStroke); };
  redraw();

  // Çizim (sadece çizen)
  let cur = null; let sendBuf = []; let flushT = 0; let strokeNo = 0;
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]; };
  const flush = () => { flushT = 0; if (!cur || !sendBuf.length) return; s?.emit('cb:stroke', { id, k: cur.k, c: cur.c, w: cur.w, pts: sendBuf }); sendBuf = [cur.pts[cur.pts.length - 1]]; };
  cv.addEventListener('pointerdown', (e) => {
    if (!isDrawer()) return; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch {}
    cur = { k: `${v.me.slice(0, 4)}${++strokeNo}`, c: eraser ? '#ffffff' : color, w: eraser ? Math.max(14, size * 2) : size, pts: [pos(e)] };
    sendBuf = [cur.pts[0]]; strokes.push(cur); drawStroke(cur);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!cur) return; const p = pos(e); const last = cur.pts[cur.pts.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.003) return;
    g.strokeStyle = cur.c; g.lineWidth = cur.w * (W / 300); g.beginPath(); g.moveTo(last[0] * W, last[1] * H); g.lineTo(p[0] * W, p[1] * H); g.stroke();
    cur.pts.push(p); sendBuf.push(p); if (!flushT) flushT = setTimeout(flush, 50);
  });
  const up = () => { if (!cur) return; clearTimeout(flushT); flush(); if (cur.pts.length === 1) s?.emit('cb:stroke', { id, k: cur.k, c: cur.c, w: cur.w, pts: cur.pts }); cur = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  // Başkasının çizimi
  const onStroke = (st) => {
    const ex = strokes.find((x) => x.k === st.k);
    if (ex) { const prev = ex.pts[ex.pts.length - 1]; ex.pts.push(...st.pts); drawStroke({ ...st, pts: [prev, ...st.pts] }); } else { const n = { ...st, pts: [...st.pts] }; strokes.push(n); drawStroke(n); }
  };
  const onClear = () => { strokes = []; redraw(); };
  const onUndo = ({ k }) => { strokes = strokes.filter((x) => x.k !== k); redraw(); };
  s?.on('cb:stroke', onStroke); s?.on('cb:clear', onClear); s?.on('cb:undo', onUndo);

  const tools = view.querySelector('.cb-tools');
  const paintTools = () => {
    tools.querySelectorAll('.cb-c').forEach((b) => b.classList.toggle('on', !eraser && b.dataset.c === color));
    tools.querySelectorAll('.cb-z').forEach((b) => b.classList.toggle('on', +b.dataset.z === size));
    tools.querySelector('.cb-e').classList.toggle('on', eraser);
  };
  tools.onclick = (e) => {
    const c = e.target.closest('.cb-c'); if (c) { color = c.dataset.c; eraser = false; }
    const z = e.target.closest('.cb-z'); if (z) size = +z.dataset.z;
    if (e.target.closest('.cb-e')) eraser = !eraser;
    if (e.target.closest('.cb-u')) { const mine = strokes.filter((x) => x.k.startsWith(v.me.slice(0, 4))); const last = mine[mine.length - 1]; if (last) { strokes = strokes.filter((x) => x !== last); redraw(); s?.emit('cb:undo', { id, k: last.k }); } }
    if (e.target.closest('.cb-cl')) { strokes = []; redraw(); s?.emit('cb:clear', { id }); }
    paintTools();
  };
  paintTools();

  const over = view.querySelector('.cb-over');
  function paint() {
    const drawer = v.players.find((p) => p.uid === v.drawer);
    view.querySelector('.cb-title').textContent = v.status === 'playing' ? `Çiz Bil · Tur ${v.round}/${v.rounds}` : 'Çiz Bil';
    const w = view.querySelector('.cb-word');
    if (v.status !== 'playing') w.innerHTML = v.status === 'ended' ? '<b>Oyun bitti</b>' : `<b>${v.players.length}/8 oyuncu</b><small>En az 2 kişiyle başlayabilirsiniz</small>`;
    else if (v.phase === 'pick') w.innerHTML = drawer?.uid === v.me ? '<b>Çizeceğin kelimeyi seç</b>' : `<b>${esc(drawer?.name || '')} kelime seçiyor…</b>`;
    else if (v.word) w.innerHTML = `<b class="cb-w">${esc(v.word)}</b><small>${drawer?.uid === v.me ? 'Bunu çiz! Harf ya da sayı yazma 😉' : v.phase === 'reveal' ? 'Kelime buydu' : 'Bildin! Diğerlerini bekle'}</small>`;
    else w.innerHTML = `<b class="cb-hint">${esc(v.hint || '').split('').map((ch) => (ch === ' ' ? '<i class="sp"></i>' : `<i>${ch === '_' ? '' : esc(ch)}</i>`)).join('')}</b><small>${v.len} harf · ${esc(drawer?.name || '')} çiziyor</small>`;
    tools.hidden = !isDrawer();
    view.querySelector('.cb-board').classList.toggle('mine', isDrawer());
    // Katman: lobi, kelime seçimi, sonuç
    if (v.status === 'waiting') over.innerHTML = `<div class="cb-ov"><div class="big">🎨</div><b>Arkadaşlarını çağır</b><small>Herkes sırayla çizer, diğerleri yazarak tahmin eder.</small>${v.host ? `<button class="btn primary cb-start" ${v.players.length < 2 ? 'disabled' : ''}>${v.players.length < 2 ? 'En az 2 kişi gerekli' : 'Oyunu başlat'}</button>` : '<small>Odayı açan kişi başlatacak.</small>'}<button class="btn cb-inv2">${icon('userPlus')} Davet et</button></div>`;
    else if (v.phase === 'pick' && v.choices) over.innerHTML = `<div class="cb-ov"><b>Bir kelime seç</b><div class="cb-ch">${v.choices.map((c) => `<button class="btn cb-pick" data-w="${esc(c)}">${esc(c)}</button>`).join('')}</div></div>`;
    else if (v.status === 'ended') {
      const rank = v.players.slice().sort((a, b) => b.score - a.score);
      over.innerHTML = `<div class="cb-ov"><div class="big">🏆</div><b>${esc(rank[0]?.name || '')} kazandı!</b><ol class="cb-rank">${rank.map((p) => `<li><img src="${esc(p.avatar)}" alt=""><span class="grow">${esc(p.name)}</span><b>${p.score}</b></li>`).join('')}</ol>${v.host ? '<button class="btn primary cb-again">Yeniden oyna</button>' : ''}<a class="btn" href="#/oyunlar">Oyunlara dön</a></div>`;
    } else over.innerHTML = '';
    view.querySelector('.cb-players').innerHTML = v.players.map((p) => `<span class="cb-p ${p.drawer ? 'dr' : ''} ${p.guessed ? 'ok' : ''}"><img src="${esc(p.avatar)}" alt=""><b class="ellipsis">${esc(p.name)}</b><small>${p.score}</small>${p.drawer ? '<i>✏️</i>' : p.guessed ? '<i>✓</i>' : ''}</span>`).join('');
    const chat = view.querySelector('.cb-chat'); const atBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 40;
    chat.innerHTML = v.chat.map((m) => (m.sys ? `<div class="cb-m sys ${m.ok ? 'ok' : ''}">${esc(m.text)}</div>` : `<div class="cb-m"><b>${esc(m.name)}</b> ${esc(m.text)}</div>`)).join('');
    if (atBottom) chat.scrollTop = chat.scrollHeight;
    const inp = view.querySelector('.cb-f input');
    inp.placeholder = isDrawer() ? 'Çizerken sohbet edebilirsin…' : v.phase === 'draw' && !v.players.find((p) => p.uid === v.me)?.guessed ? 'Tahminini yaz…' : 'Mesaj yaz…';
    runTimer();
  }
  const runTimer = () => {
    cancelAnimationFrame(tick);
    const el = view.querySelector('.cb-time'); if (!v.deadline || v.status !== 'playing') { el.textContent = ''; return; }
    const step = () => { const left = Math.max(0, Math.ceil((v.deadline - Date.now()) / 1000)); el.textContent = `⏱ ${left}`; el.classList.toggle('low', left <= 10); if (left > 0) tick = requestAnimationFrame(step); };
    step();
  };
  view.querySelector('.cb-f').onsubmit = async (e) => {
    e.preventDefault(); const inp = e.currentTarget.querySelector('input'); const text = inp.value.trim(); if (!text) return; inp.value = '';
    try { const r = await api(`/games/cizbil/${id}/guess`, { body: { text } }); if (r.correct) { toast(`Bildin! +${r.pts} puan 🎉`); navigator.vibrate?.([20, 40, 20]); } } catch (er) { toast(er.message); }
  };
  view.addEventListener('click', async (e) => {
    if (e.target.closest('.cb-start')) { try { v = await api(`/games/cizbil/${id}/start`, { body: {} }); paint(); } catch (er) { toast(er.message); } }
    const pk = e.target.closest('.cb-pick'); if (pk) api(`/games/cizbil/${id}/pick`, { body: { word: pk.dataset.w } }).catch((er) => toast(er.message));
    if (e.target.closest('.cb-again')) api(`/games/cizbil/${id}/again`, { body: {} }).catch((er) => toast(er.message));
    if (e.target.closest('.cb-inv, .cb-inv2')) invite();
    if (e.target.closest('.cb-x')) { await api(`/games/cizbil/${id}/leave`, { body: {} }).catch(() => {}); leaveTo('#/oyunlar'); }
  });
  const invite = () => {
    const url = `${location.origin}/#/oyun/cizbil/${id}`;
    sheet('Arkadaşını çağır', `<div class="menu"><button data-a="p">${icon('userPlus')}SwipeUp’tan birini çağır</button><button data-a="l">${icon('link')}Oda bağlantısını kopyala</button>${navigator.share ? `<button data-a="s">${icon('share')}Paylaş</button>` : ''}</div>`, {
      onMount(sh, close) {
        sh.querySelector('.menu').onclick = async (e) => {
          const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; close();
          if (a === 'p') pickPerson('Çiz Bil’e çağır', async (u) => { if (!u) return; try { await api(`/games/cizbil/${id}/invite`, { body: { userId: u.id } }); toast(`${u.username} çağrıldı.`); } catch (er) { toast(er.message); } });
          if (a === 'l') { try { await navigator.clipboard.writeText(url); toast('Bağlantı kopyalandı.'); } catch { toast(url); } }
          if (a === 's') navigator.share({ title: 'SwipeUp Çiz Bil', text: 'Çiz Bil odama gel 🎨', url }).catch(() => {});
        };
      },
    });
  };
  const offs = [
    on('cizbil', (x) => { if (x.id !== id) return; const wasPhase = v.phase; v = x; if (v.phase === 'pick' && wasPhase !== 'pick') onClear(); paint(); }),
    on('cizbil:close', ({ text }) => toast(`“${text}” çok yakın! 🔥`)),
  ];
  paint();
  return () => { offs.forEach((f) => f()); cancelAnimationFrame(tick); s?.off('cb:stroke', onStroke); s?.off('cb:clear', onClear); s?.off('cb:undo', onUndo); s?.emit('cb:leave', { id }); };
}

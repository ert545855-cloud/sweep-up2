// Okey masası: ıstaka (sürükle-bırak / dokun-taşı), ortadan ya da soldan taş çekme, taş atma, eli bitirme
import { icon } from '../icons.js';
import { api, esc, toast, on, sheet, pickPerson } from '../core.js';

const SLOTS = 24;
const tileHtml = (t, ok, cls = '') => {
  if (!t) return '';
  if (t.fake) return `<span class="tile fake ${cls}" data-id="${esc(t.id)}"><b>★</b></span>`;
  const wild = ok && t.c === ok.c && t.n === ok.n;
  return `<span class="tile c${t.c} ${wild ? 'wild' : ''} ${cls}" data-id="${esc(t.id)}"><b>${t.n}</b><i></i></span>`;
};

export default async function okey(view, id) {
  view.innerHTML = '<div class="ok-wrap"><div class="spinner" style="margin-top:40vh"></div></div>';
  let v;
  try { v = await api(`/games/okey/${id}`); } catch (e) { view.innerHTML = `<div class="empty"><div class="big">🀄</div><h2>Masa bulunamadı</h2>${esc(e.message)}<p><a class="btn primary" href="#/oyunlar">Oyunlara dön</a></p></div>`; return null; }
  if (v.seat < 0) { try { v = await api(`/games/okey/${id}/join`, { body: {} }); } catch (e) { toast(e.message); location.hash = '#/oyunlar'; return null; } }
  const key = `su_okey_${id}`;
  let order = []; let selected = null; let tick = 0; let lastRound = 0;
  const loadOrder = () => { try { const o = JSON.parse(sessionStorage.getItem(key) || 'null'); if (o?.round === v.round) order = o.slots; } catch {} };
  const saveOrder = () => { try { sessionStorage.setItem(key, JSON.stringify({ round: v.round, slots: order })); } catch {} };
  // Eldeki taşları ıstakaya yerleştir: yerindekiler kalır, yeni gelen boş yere
  const syncRack = () => {
    if (v.round !== lastRound) { lastRound = v.round; order = []; loadOrder(); }
    const ids = new Set(v.hand.map((t) => t.id));
    order = Array.from({ length: SLOTS }, (_, i) => (order[i] && ids.has(order[i]) ? order[i] : null));
    const placed = new Set(order.filter(Boolean));
    v.hand.filter((t) => !placed.has(t.id)).forEach((t) => {
      let last = -1; order.forEach((x, i) => { if (x) last = i; });
      let i = order.findIndex((x, k) => !x && k > last); if (i < 0) i = order.findIndex((x) => !x);
      order[i] = t.id;
    });
    if (selected && !ids.has(selected)) selected = null;
    saveOrder();
  };
  const tileById = (tid) => v.hand.find((t) => t.id === tid);
  const sortRack = (mode) => {
    const ok = v.okey; const wild = (t) => !t.fake && t.c === ok.c && t.n === ok.n;
    const val = (t) => (t.fake ? { c: ok.c, n: ok.n } : t);
    const jokers = v.hand.filter(wild); const rest = v.hand.filter((t) => !wild(t));
    const out = [];
    if (mode === 'run') {
      rest.sort((a, b) => val(a).c - val(b).c || val(a).n - val(b).n);
      rest.forEach((t, i) => { const p = rest[i - 1]; if (p && (val(p).c !== val(t).c || val(t).n - val(p).n > 1)) out.push(null); out.push(t.id); });
    } else {
      rest.sort((a, b) => val(a).n - val(b).n || val(a).c - val(b).c);
      rest.forEach((t, i) => { const p = rest[i - 1]; if (p && (val(p).n !== val(t).n || val(p).c !== val(t).c)) out.push(null); out.push(t.id); });
    }
    jokers.forEach((t) => { out.push(null); out.push(t.id); });
    let arr = out; while (arr.filter(Boolean).length + arr.filter((x) => !x).length > SLOTS) { const k = arr.indexOf(null); if (k < 0) break; arr.splice(k, 1); }
    // Satır sonuna denk gelen grubu bölmemeye çalış: sığmıyorsa boşlukları azalt
    order = Array.from({ length: SLOTS }, (_, i) => arr[i] || null); selected = null; saveOrder(); paint();
  };

  const rel = (k) => (v.seat + k) % 4; // 1: sağ (benden sonra), 2: karşı, 3: sol (benden önce)
  const seatHtml = (i, pos) => {
    const s = v.seats[i]; if (!s) return `<div class="ok-seat ${pos} empty"><span class="ok-av empty">${icon('plus')}</span><small>Boş</small></div>`;
    const turn = v.status === 'playing' && v.turn === i;
    return `<div class="ok-seat ${pos} ${turn ? 'turn' : ''} ${v.winner === i ? 'won' : ''}"><span class="ok-av"><img src="${esc(s.avatar)}" alt="">${turn ? '<i class="ok-ring"></i>' : ''}</span><b class="ellipsis">${esc(s.name)}</b><small>${v.status === 'playing' ? `${s.count} taş` : ''}${s.score ? ` · ${s.score} puan` : ''}</small></div>`;
  };
  const discardHtml = (i, pos, can) => {
    const s = v.seats[i]; const t = s?.discard;
    return `<button class="ok-dc ${pos} ${can ? 'can' : ''}" data-dc="${i}" ${can ? '' : 'tabindex="-1"'}>${t ? tileHtml(t, v.okey) : '<span class="tile ghost"></span>'}${s?.dcount > 1 ? `<small>${s.dcount}</small>` : ''}</button>`;
  };

  function paint() {
    if (v.seat >= 0 && v.hand) syncRack();
    const myTurn = v.status === 'playing' && v.turn === v.seat;
    const canDraw = myTurn && v.phase === 'draw'; const canDiscard = myTurn && v.phase === 'discard';
    const status = v.status === 'waiting' ? 'Oyuncular bekleniyor…' : v.status === 'ended' ? (v.winner != null ? `${esc(v.seats[v.winner].name)} eli bitirdi!` : 'El berabere bitti.')
      : myTurn ? (canDraw ? 'Sıra sende: ortadan ya da soldaki taşı çek' : 'Bir taş at ya da elini bitir') : `${esc(v.seats[v.turn]?.name || '')} oynuyor…`;
    view.innerHTML = `<div class="ok-wrap">
      <header class="ok-h"><button class="ib ok-x" aria-label="Masadan kalk">${icon('back')}</button><b>Okey${v.round ? ` · ${v.round}. el` : ''}</b><span class="grow"></span>
        <button class="ib ok-inv" aria-label="Arkadaş çağır">${icon('userPlus')}</button><button class="ib ok-help" aria-label="Kurallar">${icon('question')}</button></header>
      <div class="ok-felt">
        ${seatHtml(rel(2), 'top')}${seatHtml(rel(3), 'left')}${seatHtml(rel(1), 'right')}
        ${v.status !== 'waiting' ? `${discardHtml(rel(2), 'tl', false)}${discardHtml(rel(1), 'tr', false)}${discardHtml(rel(3), 'bl', canDraw && !!v.seats[rel(3)]?.discard)}${discardHtml(v.seat, 'br', false)}` : ''}
        <div class="ok-center">${v.status === 'waiting' ? `<div class="ok-wait"><b>${v.seats.filter(Boolean).length}/4 oyuncu</b><small>Arkadaşlarını çağır ya da boş koltuklara bot oturtarak başla.</small>${v.host ? '<button class="btn primary ok-start">Botlarla başlat</button>' : '<small>Masayı açan kişi başlatacak.</small>'}</div>`
          : `<button class="ok-pile ${canDraw ? 'can' : ''}"><span class="tile back"></span><small>${v.pile}</small></button><div class="ok-ind">${tileHtml(v.indicator, null)}<small>Gösterge</small></div>
             <div class="ok-okey"><small>Okey</small>${v.okey ? `<span class="tile c${v.okey.c} mini"><b>${v.okey.n}</b></span>` : ''}</div>`}</div>
        ${v.deadline && v.status === 'playing' ? '<div class="ok-timer"><i></i></div>' : ''}
      </div>
      <div class="ok-status ${myTurn ? 'me' : ''}">${status}</div>
      <div class="ok-rack ${canDiscard ? 'discard' : ''}">${order.map((tid, i) => `<span class="slot" data-s="${i}">${tid ? tileHtml(tileById(tid), v.okey, tid === selected ? 'sel' : '') : ''}</span>`).join('')}</div>
      <div class="ok-btns"><button class="btn sm srt-run">Seri diz</button><button class="btn sm srt-pair">Çift diz</button><span class="grow"></span>
        <button class="btn sm ok-throw" ${canDiscard && selected ? '' : 'disabled'}>At</button><button class="btn sm primary ok-fin" ${canDiscard && selected ? '' : 'disabled'}>Bitir</button></div>
      ${v.status === 'ended' ? `<div class="ok-end"><div class="ok-end-c"><div class="big">${v.winner != null ? (v.winner === v.seat ? '🏆' : '🀄') : '🤝'}</div><h2>${v.winner != null ? (v.winner === v.seat ? 'Tebrikler, eli bitirdin!' : `${esc(v.seats[v.winner].name)} kazandı`) : 'Berabere'}</h2>
        ${v.winHand ? `<div class="ok-wh">${v.winHand.map((t) => tileHtml(t, v.okey)).join('')}</div>` : ''}
        <div class="ok-sc">${v.seats.map((s) => (s ? `<span><img src="${esc(s.avatar)}" alt="">${esc(s.name)} <b>${s.score}</b></span>` : '')).join('')}</div>
        <div class="ok-eb"><button class="btn primary ok-again">Yeni el</button><button class="btn ok-x">Masadan kalk</button></div></div></div>` : ''}
    </div>`;
    runTimer();
  }
  const runTimer = () => {
    cancelAnimationFrame(tick);
    const bar = view.querySelector('.ok-timer i'); if (!bar || !v.deadline) return;
    const total = 35000;
    const step = () => { const left = Math.max(0, v.deadline - Date.now()); bar.style.width = `${(left / total) * 100}%`; bar.classList.toggle('low', left < 8000); if (left > 0) tick = requestAnimationFrame(step); };
    step();
  };
  const move = async (body) => {
    try { v = await api(`/games/okey/${id}/move`, { body }); if (body.type !== 'draw') selected = null; paint(); } catch (e) { toast(e.message); }
  };

  // ---- Istaka: dokun-seç / sürükle-bırak ----
  let drag = null; let lastTap = {};
  const slotAt = (x, y) => document.elementsFromPoint(x, y).find((el) => el.matches?.('.slot, .ok-dc.br, .ok-fin'));
  const placeAt = (tid, si) => {
    const from = order.indexOf(tid); if (from < 0 || si === from) return;
    const other = order[si]; order[si] = tid; order[from] = other || null; saveOrder();
  };
  view.addEventListener('pointerdown', (e) => {
    const t = e.target.closest('.ok-rack .tile'); if (!t) return;
    drag = { id: t.dataset.id, x: e.clientX, y: e.clientY, el: t, ghost: null, moved: false };
    try { t.setPointerCapture(e.pointerId); } catch {}
  });
  view.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
    if (!drag.moved) { drag.moved = true; drag.ghost = drag.el.cloneNode(true); drag.ghost.classList.add('drag'); document.body.append(drag.ghost); drag.el.classList.add('lift'); }
    drag.ghost.style.left = `${e.clientX - 17}px`; drag.ghost.style.top = `${e.clientY - 30}px`;
  });
  const endDrag = (e) => {
    if (!drag) return; const d = drag; drag = null;
    d.ghost?.remove(); d.el.classList.remove('lift');
    if (!d.moved) {
      // Dokunuş: seç; seçiliyken başka taşa dokun = yer değiştir; aynı taşa hızlı ikinci dokunuş = at
      const nowT = Date.now();
      if (selected === d.id) {
        const canThrow = v.status === 'playing' && v.turn === v.seat && v.phase === 'discard';
        if (canThrow && lastTap.id === d.id && nowT - lastTap.t < 450) { lastTap = {}; return move({ type: 'discard', tile: d.id }); }
        selected = null;
      } else if (selected) { placeAt(selected, order.indexOf(d.id)); selected = null; } else { selected = d.id; lastTap = { id: d.id, t: nowT }; }
      paint(); return;
    }
    const target = slotAt(e.clientX, e.clientY);
    if (!target) return paint();
    if (target.matches('.ok-dc.br')) { if (v.status === 'playing' && v.turn === v.seat && v.phase === 'discard') return move({ type: 'discard', tile: d.id }); return paint(); }
    if (target.matches('.ok-fin')) { selected = d.id; return paint(); }
    placeAt(d.id, +target.dataset.s); selected = null; paint();
  };
  view.addEventListener('pointerup', endDrag);
  view.addEventListener('pointercancel', () => { if (drag) { drag.ghost?.remove(); drag = null; paint(); } });
  view.addEventListener('click', async (e) => {
    const sl = e.target.closest('.ok-rack .slot');
    if (sl && !sl.querySelector('.tile') && selected) { placeAt(selected, +sl.dataset.s); selected = null; return paint(); }
    if (e.target.closest('.ok-pile.can')) return move({ type: 'draw', from: 'pile' });
    if (e.target.closest('.ok-dc.bl.can')) return move({ type: 'draw', from: 'discard' });
    if (e.target.closest('.ok-throw') && selected) return move({ type: 'discard', tile: selected });
    if (e.target.closest('.ok-fin') && selected) { if (confirm('Seçili taşı atarak eli bitirmek istiyor musun?')) move({ type: 'finish', tile: selected }); return; }
    if (e.target.closest('.srt-run')) return sortRack('run');
    if (e.target.closest('.srt-pair')) return sortRack('pair');
    if (e.target.closest('.ok-start')) { try { v = await api(`/games/okey/${id}/start`, { body: {} }); paint(); } catch (er) { toast(er.message); } return; }
    if (e.target.closest('.ok-again')) { try { v = await api(`/games/okey/${id}/again`, { body: {} }); paint(); } catch (er) { toast(er.message); } return; }
    if (e.target.closest('.ok-x')) {
      if (v.status === 'playing' && !confirm('Masadan kalkarsan yerine bot oynar. Emin misin?')) return;
      await api(`/games/okey/${id}/leave`, { body: {} }).catch(() => {}); location.hash = '#/oyunlar'; return;
    }
    if (e.target.closest('.ok-inv')) return invite();
    if (e.target.closest('.ok-help')) return rules();
  });
  const invite = () => {
    const url = `${location.origin}/#/oyun/okey/${id}`;
    sheet('Arkadaşını çağır', `<div class="menu"><button data-a="p">${icon('userPlus')}SwipeUp’tan birini çağır</button><button data-a="l">${icon('link')}Masa bağlantısını kopyala</button>${navigator.share ? `<button data-a="s">${icon('share')}Paylaş</button>` : ''}</div>`, {
      onMount(sh, close) {
        sh.querySelector('.menu').onclick = async (e) => {
          const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; close();
          if (a === 'p') pickPerson('Okey masasına çağır', async (u) => { if (!u) return; try { await api(`/games/okey/${id}/invite`, { body: { userId: u.id } }); toast(`${u.username} çağrıldı.`); } catch (er) { toast(er.message); } });
          if (a === 'l') { try { await navigator.clipboard.writeText(url); toast('Bağlantı kopyalandı.'); } catch { toast(url); } }
          if (a === 's') navigator.share({ title: 'SwipeUp Okey', text: 'Okey masama gel 🀄', url }).catch(() => {});
        };
      },
    });
  };
  const rules = () => sheet('Okey nasıl oynanır?', `<div class="ok-rules">
    <p><b>Amaç:</b> 14 taşını 3’lü ya da 4’lü gruplara ayırıp 15. taşı atarak eli bitirmek.</p>
    <p><b>Seri:</b> Aynı renkte ardışık sayılar (ör. kırmızı 4-5-6). 12-13-1 olur, 13-1-2 olmaz.</p>
    <p><b>Per:</b> Aynı sayının farklı renkleri (ör. sarı 7, mavi 7, siyah 7).</p>
    <p><b>Çift:</b> Ya da 7 çift (aynı renk aynı sayı) ile de bitirebilirsin.</p>
    <p><b>Okey:</b> Göstergenin aynı renkte bir fazlası okeydir ve her taşın yerine geçer. ★ sahte okey, okeyin yerine geçen normal taştır.</p>
    <p><b>Sıra:</b> Ortadan ya da soldaki oyuncunun attığı taşı çek, sonra sağına bir taş at. Taşı ıstakada sürükleyerek dizebilir, sağ alttaki kutuya bırakarak atabilirsin. Çift dokunuş da atar.</p>
    <p><b>Puan:</b> Eli bitiren 2, okey atarak bitiren 4 puan alır. Her hamle için 35 saniyen var.</p></div>`);

  const offs = [on('okey', (x) => { if (x.id !== id) return; const prevTurn = v.turn; v = x; if (!drag) paint(); if (v.status === 'playing' && v.turn === v.seat && prevTurn !== v.seat) navigator.vibrate?.(15); })];
  paint();
  return () => { offs.forEach((f) => f()); cancelAnimationFrame(tick); drag?.ghost?.remove(); };
}

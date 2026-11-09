// Renk Eşle masası
import { playTable, seatChip } from '../playkit.js';
import { esc, sheet } from '../core.js';

const COL_NAME = { r: 'Kırmızı', y: 'Sarı', g: 'Yeşil', b: 'Mavi' };
const SYM = { skip: '⊘', rev: '⇄', d2: '+2', wild: '◑', d4: '+4' };
export const rkCard = (c, { cls = '', attrs = '' } = {}) => (c
  ? `<span class="rk ${c.c} ${cls}" data-id="${esc(c.id)}" ${attrs}><b>${SYM[c.v] || c.v}</b><i>${SYM[c.v] || c.v}</i><em>${SYM[c.v] || c.v}</em></span>`
  : `<span class="rk back ${cls}" ${attrs}><b></b></span>`);

export default function renk(view, id) {
  const pickColor = () => new Promise((ok) => {
    let done = false;
    sheet('Rengi seç', `<div class="rk-pick">${Object.entries(COL_NAME).map(([k, n]) => `<button class="rk-cp ${k}" data-c="${k}">${n}</button>`).join('')}</div>`, {
      onClose: () => { if (!done) ok(null); },
      onMount(sh, close) { sh.querySelector('.rk-pick').onclick = (e) => { const b = e.target.closest('[data-c]'); if (!b) return; done = true; close(); ok(b.dataset.c); }; },
    });
  });
  return playTable(view, 'renk', id, {
    title: 'Renk Eşle', emoji: '🌈', theme: 'pk-night', minSize: 2, maxSize: 6,
    rules: `<p><b>Amaç:</b> Elindeki bütün kartları ilk bitiren kazanır.</p>
      <p><b>Oynama:</b> Yerdeki kartla aynı renkte ya da aynı sayı/simgede bir kart at. Atamıyorsan desteden bir kart çek; çektiğin kart uyuyorsa hemen atabilirsin.</p>
      <p><b>Özel kartlar:</b> ⊘ Atla: sıradaki oyuncu atlanır. ⇄ Yön değiştir. +2: sıradaki 2 kart çeker ve atlanır. ◑ Renk seç: rengi sen belirlersin. +4: sıradaki 4 kart çeker, rengi sen seçersin.</p>
      <p><b>Puan:</b> Bitiren, rakiplerin elinde kalan kartların puanını alır (sayılar kendi değeri, özel kartlar 20, renk kartları 50).</p>`,
    render(ctx) {
      const v = ctx.v; const rk = v.rk; if (!rk) return;
      const me = v.me; const n = v.seats.length;
      const myTurn = v.status === 'playing' && v.turn === me;
      const can = new Set(rk.playable || []);
      const order = []; for (let k = 1; k < n; k++) order.push((me + k) % n);
      const last = rk.last;
      ctx.board.innerHTML = `<div class="rk-t">
        <div class="rk-ops">${order.map((i) => `<div class="rk-op ${v.turn === i ? 'turn' : ''}">${seatChip(v, i, { extra: `<small>${rk.counts[i]} kart${rk.counts[i] === 1 ? ' · <b class="rk-one">Tek kart!</b>' : ''}</small>` })}</div>`).join('')}</div>
        <div class="rk-dir">${rk.dir === 1 ? 'Sıra yönü →' : '← Sıra yönü'}</div>
        <div class="rk-mid">
          <button class="rk-deck ${myTurn && rk.phase === 'play' ? 'can' : ''}">${rkCard(null)}<small>${rk.deck}</small></button>
          <div class="rk-top ring-${rk.color}">${rkCard(rk.top, { cls: 'big' })}<span class="rk-col ${rk.color}">${COL_NAME[rk.color]}</span></div>
        </div>
        <div class="rk-last">${last ? `${esc(last.seat === me ? 'Sen' : v.seats[last.seat]?.name || '')} ${last.drew ? 'kart çekti' : 'kart attı'}` : ''}</div>
        <div class="rk-me">${seatChip(v, me, { extra: `<small>${rk.hand.length} kart</small>` })}<span class="rk-st">${v.status !== 'playing' ? '' : myTurn ? (rk.phase === 'drawn' ? 'Çektiğin kartı at ya da geç' : can.size ? 'Parlayan bir kart at' : 'Uyan kartın yok, desteden çek') : `${esc(v.seats[v.turn]?.name || '')} oynuyor…`}</span>
          ${myTurn && rk.phase === 'drawn' ? '<button class="btn sm rk-pass">Geç</button>' : ''}</div>
        <div class="rk-hand ${myTurn ? 'on' : ''}">${rk.hand.map((c) => rkCard(c, { cls: myTurn && !can.has(c.id) ? 'dim' : can.has(c.id) ? 'ok' : '', attrs: `data-play="${esc(c.id)}"` })).join('')}</div></div>`;
    },
    after(ctx) {
      if (ctx.board.dataset.w) return; ctx.board.dataset.w = '1';
      ctx.board.addEventListener('click', async (e) => {
        const v = ctx.v; if (v.status !== 'playing' || v.turn !== v.me) return; const rk = v.rk;
        if (e.target.closest('.rk-deck.can')) return ctx.move({ type: 'draw' });
        if (e.target.closest('.rk-pass')) return ctx.move({ type: 'pass' });
        const c = e.target.closest('[data-play]'); if (!c || c.classList.contains('dim')) return;
        const card = rk.hand.find((x) => x.id === c.dataset.play); if (!card) return;
        let color;
        if (card.c === 'w') { color = await pickColor(); if (!color) return; }
        c.classList.add('going'); ctx.move({ type: 'play', card: card.id, color });
      });
    },
  });
}

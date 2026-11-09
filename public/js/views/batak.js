// İhaleli Batak masası
import { playTable, seatChip, cardHtml } from '../playkit.js';
import { esc } from '../core.js';

const POS = ['bottom', 'right', 'top', 'left'];
const SUIT = { S: ['♠', 'Maça'], H: ['♥', 'Kupa'], D: ['♦', 'Karo'], C: ['♣', 'Sinek'] };

export default function batak(view, id) {
  let shownLast = ''; let lastUntil = 0; let tm = 0;
  return playTable(view, 'batak', id, {
    title: 'Batak', emoji: '♠️', theme: 'pk-felt', land: true,
    rules: `<p><b>İhale:</b> Herkes sırayla kaç el alacağını söyler (en az 4) ya da pas geçer. En yüksek ihaleyi veren kozu seçer ve ilk kartı atar. Herkes pas geçerse dağıtan 4 ile almak zorundadır.</p>
      <p><b>Oynama:</b> Yerdeki renge uymak zorundasın; uyabiliyorsan mümkünse daha büyük kart atmalısın. O renk yoksa koz atmalısın (yerde koz varsa daha büyüğünü). Koz yoksa istediğini atarsın.</p>
      <p><b>Koz:</b> Koz açılmadan (biri koz atmadan) elinde başka kart varken kozla başlayamazsın.</p>
      <p><b>Puan:</b> Herkes aldığı her el için 10 puan alır. İhaleyi alan ihalesini tutturamazsa ihale × 10 puan kaybeder (batar).</p>`,
    render(ctx) {
      const v = ctx.v; const bt = v.bt; if (!bt) return;
      const me = v.me; const myTurn = v.status === 'playing' && v.turn === me;
      const rel = (i) => (i - me + 4) % 4;
      // Tamamlanan eli kısa bir süre göster
      const lk = bt.lastTrick ? bt.lastTrick.cards.map((x) => x.c.id).join('') : '';
      if (lk && lk !== shownLast && !bt.trick.length) { shownLast = lk; lastUntil = Date.now() + 1400; clearTimeout(tm); tm = setTimeout(() => ctx.paint(), 1450); }
      const showLast = !bt.trick.length && bt.lastTrick && Date.now() < lastUntil;
      const trickCards = showLast ? bt.lastTrick.cards : bt.trick;
      const winner = showLast ? bt.lastTrick.winner : null;
      const info = (i) => `<small>${bt.bids[i] == null ? '' : bt.bids[i] === 'pas' ? 'pas · ' : `ihale ${bt.bids[i]} · `}${bt.tricks[i]} el</small>`;
      const legal = new Set(bt.legal || []);
      let panel = '';
      if (myTurn && bt.phase === 'bid') {
        const nums = []; for (let k = bt.minBid; k <= Math.min(13, bt.minBid + 6); k++) nums.push(k);
        panel = `<div class="bt-panel"><b>İhalen?</b><div class="bt-bids">${nums.map((k) => `<button class="btn sm" data-bid="${k}">${k}</button>`).join('')}</div>${bt.forced ? '<small>Herkes pas geçti, en az 4 ile almak zorundasın.</small>' : '<button class="btn sm bt-pass" data-pass="1">Pas</button>'}</div>`;
      } else if (myTurn && bt.phase === 'trump') {
        panel = `<div class="bt-panel"><b>Kozu seç</b><div class="bt-bids">${Object.entries(SUIT).map(([s, [sym, nm]]) => `<button class="btn bt-suit ${s === 'H' || s === 'D' ? 'red' : ''}" data-trump="${s}">${sym} ${nm}</button>`).join('')}</div></div>`;
      }
      const status = v.status !== 'playing' ? '' : bt.phase === 'bid' ? (myTurn ? 'İhale sırası sende' : `${esc(v.seats[v.turn]?.name || '')} ihale düşünüyor…`)
        : bt.phase === 'trump' ? (myTurn ? 'Kozu seç' : `${esc(v.seats[v.turn]?.name || '')} koz seçiyor…`) : myTurn ? 'Sıra sende: parlayan kartlardan birini at' : `${esc(v.seats[v.turn]?.name || '')} oynuyor…`;
      ctx.board.innerHTML = `<div class="ct ct-n4 bt">
        ${[1, 2, 3].map((k) => { const i = (me + k) % 4; return `<div class="ct-op ${POS[k]}">${seatChip(v, i, { extra: info(i) })}${bt.bidder === i ? '<span class="bt-crown">👑</span>' : ''}</div>`; }).join('')}
        <div class="ct-mid bt-mid">
          <div class="bt-info">${bt.trump ? `<span class="bt-tr ${bt.trump === 'H' || bt.trump === 'D' ? 'red' : ''}">Koz ${SUIT[bt.trump][0]}</span>` : ''}${bt.bidder != null && bt.phase !== 'bid' ? `<span>${esc(bt.bidder === me ? 'Sen' : v.seats[bt.bidder]?.name || '')}: ${bt.high}</span>` : bt.high ? `<span>En yüksek: ${bt.high}</span>` : ''}</div>
          <div class="bt-trick">${trickCards.map((x) => `<div class="bt-c ${POS[rel(x.seat)]} ${winner === x.seat ? 'win' : ''}">${cardHtml(x.c)}</div>`).join('')}</div>
        </div>
        ${panel}
        <div class="ct-me">${seatChip(v, me, { extra: info(me) })}${bt.bidder === me ? '<span class="bt-crown">👑</span>' : ''}<div class="ct-st">${status}</div></div>
        <div class="ct-hand bt-hand ${myTurn && bt.phase === 'play' ? 'on' : ''}">${bt.hand.map((c) => cardHtml(c, { cls: `${bt.phase === 'play' && myTurn && !legal.has(c.id) ? 'dim' : ''} ${bt.trump && c.s === bt.trump ? 'trump' : ''}`, attrs: `data-play="${esc(c.id)}"` })).join('')}</div></div>`;
    },
    endHtml: (v) => (v.bt?.result ? `<p class="muted">${v.seats.map((s, i) => (s ? `${esc(i === v.me ? 'Sen' : s.name)}: ${v.bt.tricks[i]} el, ${v.bt.result[i] > 0 ? '+' : ''}${v.bt.result[i]}` : '')).filter(Boolean).join(' · ')}</p>` : ''),
    after(ctx) {
      if (ctx.board.dataset.w) return; ctx.board.dataset.w = '1';
      ctx.board.addEventListener('click', (e) => {
        const v = ctx.v; if (v.status !== 'playing' || v.turn !== v.me) return;
        const bid = e.target.closest('[data-bid]'); if (bid) return ctx.move({ type: 'bid', n: +bid.dataset.bid });
        if (e.target.closest('[data-pass]')) return ctx.move({ type: 'bid', pass: true });
        const tr = e.target.closest('[data-trump]'); if (tr) return ctx.move({ type: 'trump', s: tr.dataset.trump });
        const c = e.target.closest('[data-play]');
        if (c && v.bt.phase === 'play') { if (c.classList.contains('dim')) return; c.classList.add('going'); ctx.move({ type: 'play', card: c.dataset.play }); }
      });
    },
    cleanup() { clearTimeout(tm); },
  });
}

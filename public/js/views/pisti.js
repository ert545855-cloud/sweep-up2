// Pişti masası
import { playTable, seatChip, cardHtml } from '../playkit.js';
import { esc } from '../core.js';

const posOf = (n, rel) => (n === 2 ? 'top' : n === 3 ? ['', 'right', 'left'][rel] : ['', 'right', 'top', 'left'][rel]);
const NAMES = { 1: 'As', 11: 'Vale', 12: 'Kız', 13: 'Papaz' };
const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };

export default function pisti(view, id) {
  let flashKey = '';
  return playTable(view, 'pisti', id, {
    title: 'Pişti', emoji: '🃏', theme: 'pk-felt', land: true, minSize: 2, maxSize: 4,
    rules: `<p><b>Amaç:</b> Yerdeki kartları toplayıp en çok puanı almak.</p>
      <p><b>Alma:</b> Yerdeki en üst kartla aynı kartı atarsan ya da <b>vale</b> atarsan yerdeki bütün kartları alırsın.</p>
      <p><b>Pişti:</b> Yerde tek kart varken aynısını atarsan pişti olur: <b>10 puan</b>. Valeye vale ile pişti <b>20 puan</b>.</p>
      <p><b>Puanlar:</b> Her as ve vale 1, sinek 2’li 2, karo 10’lu 3 puan. En çok kartı alan +3 puan. Son kalan kartlar en son alan oyuncuya gider.</p>`,
    render(ctx) {
      const v = ctx.v; const ps = v.ps; if (!ps) return;
      const n = v.seats.length; const me = v.me;
      const myTurn = v.status === 'playing' && v.turn === me;
      const others = []; for (let k = 1; k < n; k++) others.push((me + k) % n);
      const last = ps.last;
      const lastTxt = last ? `${esc(last.seat === me ? 'Sen' : v.seats[last.seat]?.name || '')} ${SUIT[last.card.s]}${NAMES[last.card.r] || last.card.r} ${last.pisti ? 'ile PİŞTİ yaptı! 🎉' : last.took ? `ile ${last.took} kart aldı` : 'attı'}` : 'Oyun başladı';
      const key = last ? `${last.seat}-${last.card.id}-${ps.deck}-${ps.counts.join('')}` : '';
      const flash = last?.pisti && key !== flashKey; if (flash) flashKey = key;
      ctx.board.innerHTML = `<div class="ct ct-n${n}">
        ${others.map((i) => `<div class="ct-op ${posOf(n, (i - me + n) % n)}">${seatChip(v, i, { extra: `<small>${ps.taken[i]} kart · ${ps.pisti[i] ? `${ps.pisti[i]} pişti · ` : ''}${ps.live[i]} puan</small>` })}<div class="ct-back">${'<span class="pc back mini"></span>'.repeat(Math.min(4, ps.counts[i]))}</div></div>`).join('')}
        <div class="ct-mid">
          <div class="ps-deck">${ps.deck ? `<span class="pc back"></span><small>${ps.deck}</small>` : ''}</div>
          <div class="ps-pile ${flash ? 'flash' : ''}">${ps.top ? `${ps.under ? cardHtml(ps.under, { cls: 'under' }) : ps.pile > 1 ? '<span class="pc back under"></span>' : ''}${cardHtml(ps.top)}<small class="ps-n">${ps.pile}</small>` : '<span class="ps-empty">Yer boş</span>'}</div>
          ${flash ? '<div class="ps-boom">PİŞTİ!</div>' : ''}
        </div>
        <div class="ct-last">${lastTxt}</div>
        <div class="ct-me">${seatChip(v, me, { extra: `<small>${ps.taken[me]} kart · ${ps.pisti[me] ? `${ps.pisti[me]} pişti · ` : ''}${ps.live[me]} puan</small>` })}
          <div class="ct-st">${v.status === 'playing' ? (myTurn ? 'Sıra sende: bir kart at' : `${esc(v.seats[v.turn]?.name || '')} düşünüyor…`) : ''}</div></div>
        <div class="ct-hand ${myTurn ? 'on' : ''}">${ps.hand.map((c) => cardHtml(c, { cls: 'big', attrs: `data-play="${esc(c.id)}"` })).join('')}</div></div>`;
    },
    endHtml: (v) => (v.ps?.final ? `<p class="muted">${v.seats.map((s, i) => (s ? `${esc(i === v.me ? 'Sen' : s.name)}: ${v.ps.final[i]} puan (${v.ps.taken[i]} kart${v.ps.pisti[i] ? `, ${v.ps.pisti[i]} pişti` : ''})` : '')).filter(Boolean).join(' · ')}</p>` : ''),
    after(ctx) {
      if (ctx.board.dataset.w) return; ctx.board.dataset.w = '1';
      ctx.board.addEventListener('click', (e) => {
        const c = e.target.closest('[data-play]'); const v = ctx.v;
        if (!c || v.status !== 'playing' || v.turn !== v.me) return;
        c.classList.add('going'); ctx.move({ type: 'play', card: c.dataset.play });
      });
    },
  });
}

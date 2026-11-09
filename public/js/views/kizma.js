// Kızma Birader tahtası (15×15 klasik düzen). Tahta, kendi rengin sol altta olacak şekilde döner.
import { playTable, seatChip } from '../playkit.js';
import { esc } from '../core.js';

const COL = ['#e53935', '#43a047', '#fbc02d', '#1e88e5'];
const COL_NAME = ['Kırmızı', 'Yeşil', 'Sarı', 'Mavi'];
// 52 karelik yol (kırmızının başlangıcından)
const PATH = [];
[[1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0], [7, 0], [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
  [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6], [14, 7], [14, 8], [13, 8], [12, 8], [11, 8], [10, 8], [9, 8], [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
  [7, 14], [6, 14], [6, 13], [6, 12], [6, 11], [6, 10], [6, 9], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8], [0, 7], [0, 6]].forEach((p) => PATH.push(p));
const HOME = [[[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]], [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]], [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]], [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]]];
const YARD = [[[1.5, 1.5], [3.5, 1.5], [1.5, 3.5], [3.5, 3.5]], [[10.5, 1.5], [12.5, 1.5], [10.5, 3.5], [12.5, 3.5]], [[10.5, 10.5], [12.5, 10.5], [10.5, 12.5], [12.5, 12.5]], [[1.5, 10.5], [3.5, 10.5], [1.5, 12.5], [3.5, 12.5]]];
const FIN = [[6.35, 7], [7, 6.35], [7.65, 7], [7, 7.65]];
const SAFE = [0, 8, 13, 21, 26, 34, 39, 47];
const ROT = [-90, 180, 90, 0]; // kendi rengini sol alta getir
const cellOf = (color, p, k) => {
  if (p === -1) return [YARD[color][k][0] + 0.5, YARD[color][k][1] + 0.5];
  if (p === 56) return [FIN[color][0] + 0.5, FIN[color][1] + 0.5];
  if (p >= 51) { const [x, y] = HOME[color][p - 51]; return [x + 0.5, y + 0.5]; }
  const [x, y] = PATH[(color * 13 + p) % 52]; return [x + 0.5, y + 0.5];
};
const DOTS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };

function boardSvg() {
  let s = '<rect x="0" y="0" width="15" height="15" rx=".4" fill="#fffaf0"/>';
  [[0, 0], [9, 0], [9, 9], [0, 9]].forEach(([x, y], c) => { s += `<rect x="${x}" y="${y}" width="6" height="6" rx=".35" fill="${COL[c]}"/><rect x="${x + 0.7}" y="${y + 0.7}" width="4.6" height="4.6" rx=".5" fill="#fff"/>`; });
  PATH.forEach(([x, y], i) => {
    const start = [0, 13, 26, 39].indexOf(i);
    s += `<rect x="${x + 0.03}" y="${y + 0.03}" width=".94" height=".94" fill="${start >= 0 ? COL[start] : '#fff'}" stroke="#c9bfae" stroke-width=".04"/>`;
    if (SAFE.includes(i) && start < 0) s += `<text x="${x + 0.5}" y="${y + 0.72}" font-size=".62" text-anchor="middle" fill="#b6a88f">★</text>`;
  });
  HOME.forEach((cells, c) => cells.forEach(([x, y]) => { s += `<rect x="${x + 0.03}" y="${y + 0.03}" width=".94" height=".94" fill="${COL[c]}" stroke="#fff" stroke-width=".04"/>`; }));
  s += `<polygon points="6,6 9,6 7.5,7.5" fill="${COL[1]}"/><polygon points="9,6 9,9 7.5,7.5" fill="${COL[2]}"/><polygon points="9,9 6,9 7.5,7.5" fill="${COL[3]}"/><polygon points="6,9 6,6 7.5,7.5" fill="${COL[0]}"/>`;
  YARD.forEach((ps, c) => ps.forEach(([x, y]) => { s += `<circle cx="${x + 0.5}" cy="${y + 0.5}" r=".62" fill="${COL[c]}" fill-opacity=".18" stroke="${COL[c]}" stroke-width=".06"/>`; }));
  return s;
}
const BOARD = boardSvg();

export default function kizma(view, id) {
  let rolling = 0;
  return playTable(view, 'kizma', id, {
    title: 'Kızma Birader', emoji: '🎲', theme: 'pk-night', minSize: 2, maxSize: 4,
    rules: `<p><b>Amaç:</b> 4 piyonunu da yolun sonundaki eve ilk getiren kazanır.</p>
      <p><b>Çıkış:</b> Piyonun avludan çıkması için 6 atmalısın. 6 atınca bir kez daha zar atarsın (üst üste üç 6’da sıra geçer).</p>
      <p><b>Kırma:</b> Rakip piyonun olduğu kareye gelirsen onu avlusuna geri gönderirsin ve bir zar daha atarsın. Yıldızlı ve renkli başlangıç kareleri güvenlidir.</p>
      <p><b>Ev:</b> Eve girmek için zar tam gelmeli. Piyon eve girince bir zar daha atarsın.</p>`,
    render(ctx) {
      const v = ctx.v; const kz = v.kz; if (!kz) return;
      const me = v.me; const myColor = kz.colors[me] ?? 3; const rot = ROT[myColor];
      const myTurn = v.status === 'playing' && v.turn === me;
      let pawns = '';
      const stack = {};
      kz.pawns.forEach((ps, s) => ps.forEach((p, k) => { const key = cellOf(kz.colors[s], p, k).join(','); (stack[key] = stack[key] || []).push([s, k]); }));
      kz.pawns.forEach((ps, s) => ps.forEach((p, k) => {
        const c = kz.colors[s]; const [x, y] = cellOf(c, p, k); const key = `${x},${y}`; const grp = stack[key]; const idx = grp.findIndex(([a, b]) => a === s && b === k);
        const off = grp.length > 1 ? (idx - (grp.length - 1) / 2) * 0.28 : 0;
        const can = myTurn && kz.phase === 'move' && s === me && kz.opts.includes(k);
        pawns += `<g class="kz-pw ${can ? 'can' : ''}" data-pawn="${can ? k : ''}" transform="translate(${x + off} ${y + off * 0.4})"><g transform="rotate(${-rot})"><ellipse cx="0" cy=".26" rx=".3" ry=".1" fill="rgba(0,0,0,.25)"/><path d="M-.26 .24 L-.15 -.08 A.22 .22 0 1 1 .15 -.08 L.26 .24 Z" fill="${COL[c]}" stroke="#fff" stroke-width=".06"/><circle cx="0" cy="-.2" r=".13" fill="rgba(255,255,255,.55)"/></g>${can ? '<circle r=".52" fill="none" stroke="#fff" stroke-width=".07" class="kz-ring"/>' : ''}</g>`;
      }));
      const last = kz.last;
      const dieVal = kz.die;
      const die = dieVal ? `<div class="kz-die ${rolling ? 'roll' : ''}" style="--c:${COL[kz.colors[kz.cur]]}">${(DOTS[dieVal] || []).map(([dx, dy]) => `<i style="left:${50 + dx * 26}%;top:${50 + dy * 26}%"></i>`).join('')}</div>` : '<div class="kz-die empty"></div>';
      const others = v.seats.map((s, i) => i).filter((i) => i !== me);
      const status = v.status !== 'playing' ? '' : myTurn ? (kz.phase === 'roll' ? 'Sıra sende, zar at' : 'Oynatacağın piyona dokun') : `${esc(v.seats[v.turn]?.name || '')} oynuyor…`;
      const lastTxt = last ? `${esc(last.seat === me ? 'Sen' : v.seats[last.seat]?.name || '')} ${last.roll} attı${last.none ? ', hamle yok' : last.hit != null ? ' ve bir piyonu eve gönderdi!' : last.to === 56 ? ', piyon eve girdi!' : ''}` : '';
      ctx.board.innerHTML = `<div class="kz">
        <div class="kz-ops">${others.map((i) => `<div class="kz-op" style="--c:${COL[kz.colors[i]]}">${seatChip(v, i, { extra: `<small>${kz.pawns[i].filter((p) => p === 56).length}/4 evde</small>` })}</div>`).join('')}</div>
        <div class="kz-board"><svg viewBox="0 0 15 15"><g transform="rotate(${rot} 7.5 7.5)">${BOARD}${pawns}</g></svg></div>
        <div class="kz-last">${lastTxt}</div>
        <div class="kz-me" style="--c:${COL[myColor]}">${seatChip(v, me, { extra: `<small>${COL_NAME[myColor]} · ${kz.pawns[me].filter((p) => p === 56).length}/4 evde</small>` })}
          <div class="kz-dw">${die}${myTurn && kz.phase === 'roll' ? '<button class="btn primary kz-roll">Zar at</button>' : `<span class="kz-st">${status}</span>`}</div></div></div>`;
    },
    after(ctx) {
      if (ctx.board.dataset.w) return; ctx.board.dataset.w = '1';
      ctx.board.addEventListener('click', async (e) => {
        const v = ctx.v; if (v.status !== 'playing' || v.turn !== v.me) return;
        if (e.target.closest('.kz-roll')) { rolling = 1; ctx.paint(); setTimeout(() => { rolling = 0; }, 450); await ctx.move({ type: 'roll' }); return; }
        const pw = e.target.closest('[data-pawn]'); if (pw && pw.dataset.pawn !== '') ctx.move({ type: 'move', pawn: +pw.dataset.pawn });
      });
    },
  });
}

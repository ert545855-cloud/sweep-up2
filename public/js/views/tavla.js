// Tavla tahtası: dokun-seç, dokun-oyna; zar atma, geri alma
import { playTable, seatChip } from '../playkit.js';

const U = 29; const X0 = 7; const Y0 = 8; const PL = 148; const H = 352; const R = 13.2;
const relOf = (p, a) => (p === 0 ? a : 23 - a);
const colX = (c) => X0 + (c < 6 ? c : c + 1) * U;
const place = (r) => (r <= 11 ? { col: 11 - r, top: false } : { col: r - 12, top: true });
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
const die = (x, y, n, s, dim) => `<g class="tv-die ${dim ? 'used' : ''}"><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * 0.2}"/>${PIPS[n].map(([dx, dy]) => `<circle cx="${x + s / 2 + dx * s * 0.26}" cy="${y + s / 2 + dy * s * 0.26}" r="${s * 0.09}"/>`).join('')}</g>`;

export default function tavla(view, id) {
  let sel = null;
  return playTable(view, 'tavla', id, {
    title: 'Tavla', emoji: '🎲', theme: 'pk-wood', land: true, roundWord: 'oyun', againLabel: 'Yeni oyun',
    rules: `<p><b>Amaç:</b> 15 taşının hepsini önce kendi evine (sağ alt çeyrek) getirip sonra toplamak.</p>
      <p><b>Hamle:</b> Zar at, sonra taşına dokun ve parlayan yere dokun. Her zar ayrı bir hamledir; çift atarsan 4 kez oynarsın.</p>
      <p><b>Kırma:</b> Rakibin tek taşının olduğu yere gelirsen onu kırarsın; kırılan taş ortadan yeniden girmek zorundadır. Kırık taşın varken başka taş oynatamazsın.</p>
      <p><b>Kapı:</b> 2 ya da daha fazla rakip taşı olan yere giremezsin.</p>
      <p><b>Toplama:</b> Bütün taşların evdeyken atılan zarla taş toplarsın. Rakip hiç taş toplamadan bitirirsen <b>mars</b> olur, 2 puan alırsın.</p>
      <p>Oynayabileceğin bütün zarları oynamak zorundasın. Hamleni turun sonuna kadar “Geri al” ile değiştirebilirsin.</p>`,
    render(ctx) {
      const v = ctx.v; const tv = v.tv; if (!tv) return;
      const me = v.me < 0 ? 0 : v.me; const op = 1 - me;
      const myTurn = v.status === 'playing' && v.turn === v.me;
      const legal = tv.legal || [];
      if (!myTurn || tv.phase !== 'move') sel = null;
      if (myTurn && tv.phase === 'move' && tv.bar[me] > 0 && legal.some((m) => m.from === 24)) sel = 24;
      if (sel != null && !legal.some((m) => m.from === sel)) sel = null;
      const dests = sel != null ? legal.filter((m) => m.from === sel) : [];
      const sources = new Set(legal.map((m) => m.from));
      // Noktalar ve taşlar
      let svg = `<rect class="tv-frame" x="0" y="0" width="420" height="${H + 8}" rx="12"/><rect class="tv-in" x="${X0}" y="${Y0}" width="${6 * U}" height="${H - 8}" rx="4"/><rect class="tv-in" x="${X0 + 7 * U}" y="${Y0}" width="${6 * U}" height="${H - 8}" rx="4"/>
        <rect class="tv-bar" x="${X0 + 6 * U}" y="${Y0}" width="${U}" height="${H - 8}"/><rect class="tv-tray" x="${X0 + 13 * U + 2}" y="${Y0}" width="${U - 4}" height="${H - 8}" rx="4"/>`;
      const yTop = Y0; const yBot = H;
      for (let r = 0; r < 24; r++) {
        const { col, top } = place(r); const x = colX(col);
        const dark = (col + (top ? 1 : 0)) % 2 === 0;
        svg += `<path class="tv-pt ${dark ? 'd' : 'l'}" d="${top ? `M${x + 1} ${yTop} L${x + U - 1} ${yTop} L${x + U / 2} ${yTop + PL} Z` : `M${x + 1} ${yBot} L${x + U - 1} ${yBot} L${x + U / 2} ${yBot - PL} Z`}"/>`;
      }
      const lastSet = new Set((tv.last || []).filter((m) => m.to >= 0).map((m) => relOf(me, tv.lastBy === 0 ? m.to : 23 - m.to)));
      for (let a = 0; a < 24; a++) {
        const s = tv.pts[a]; const r = relOf(me, a); const { col, top } = place(r); const cx = colX(col) + U / 2;
        if (lastSet.has(r)) svg += `<circle class="tv-last" cx="${cx}" cy="${top ? yTop + 5 : yBot - 5}" r="3"/>`;
        if (!s) continue;
        const [p, n] = s; const show = Math.min(n, 5);
        for (let k = 0; k < show; k++) {
          const cy = top ? yTop + R + 1 + k * (2 * R) : yBot - R - 1 - k * (2 * R);
          svg += `<circle class="tv-ck ${p === me ? 'me' : 'op'} ${sel === r && p === me && k === show - 1 ? 'sel' : ''}" cx="${cx}" cy="${cy}" r="${R - 0.6}"/>`;
          if (k === show - 1 && n > 5) svg += `<text class="tv-n ${p === me ? 'me' : 'op'}" x="${cx}" y="${cy + 4.5}">${n}</text>`;
        }
      }
      // Kırık taşlar (ortada)
      const bx = X0 + 6 * U + U / 2;
      for (let k = 0; k < Math.min(tv.bar[me], 4); k++) svg += `<circle class="tv-ck me ${sel === 24 ? 'sel' : ''}" cx="${bx}" cy="${H / 2 + 30 + k * 2 * R}" r="${R - 0.6}"/>`;
      if (tv.bar[me] > 4) svg += `<text class="tv-n me" x="${bx}" y="${H / 2 + 30 + 3 * 2 * R + 4.5}">${tv.bar[me]}</text>`;
      for (let k = 0; k < Math.min(tv.bar[op], 4); k++) svg += `<circle class="tv-ck op" cx="${bx}" cy="${H / 2 - 30 - k * 2 * R}" r="${R - 0.6}"/>`;
      if (tv.bar[op] > 4) svg += `<text class="tv-n op" x="${bx}" y="${H / 2 - 30 - 3 * 2 * R + 4.5}">${tv.bar[op]}</text>`;
      // Toplanan taşlar
      const tx = X0 + 13 * U + 4; const tw = U - 8;
      for (let k = 0; k < tv.off[me]; k++) svg += `<rect class="tv-off me" x="${tx}" y="${yBot - 6 - k * 6.4}" width="${tw}" height="5" rx="1.5"/>`;
      for (let k = 0; k < tv.off[op]; k++) svg += `<rect class="tv-off op" x="${tx}" y="${yTop + 1 + k * 6.4}" width="${tw}" height="5" rx="1.5"/>`;
      // Seçim ve gidilebilecek yerler
      if (sel != null && sel !== 24) { const { col, top } = place(sel); svg += `<rect class="tv-selc" x="${colX(col)}" y="${top ? yTop : yBot - PL}" width="${U}" height="${PL}" rx="4"/>`; }
      dests.forEach((m) => {
        if (m.to === -1) { svg += `<rect class="tv-dst" x="${tx - 2}" y="${H / 2 + 6}" width="${tw + 4}" height="${H / 2 - 8}" rx="4"/>`; return; }
        const { col, top } = place(m.to); const a = me === 0 ? m.to : 23 - m.to; const s = tv.pts[a]; const k = s && s[0] === me ? Math.min(s[1], 4) : 0;
        const cy = top ? yTop + R + 1 + k * 2 * R : yBot - R - 1 - k * 2 * R;
        svg += `<circle class="tv-dst" cx="${colX(col) + U / 2}" cy="${cy}" r="${R - 1}"/>`;
      });
      // Zarlar
      if (tv.dice) {
        const used = tv.dice[0] === tv.dice[1] ? 4 - tv.left.length : tv.dice.length - tv.left.length;
        const list = tv.dice[0] === tv.dice[1] ? [tv.dice[0], tv.dice[0], tv.dice[0], tv.dice[0]] : tv.dice;
        const usedFlags = list.map(() => false);
        if (tv.dice[0] !== tv.dice[1]) list.forEach((d, i) => { usedFlags[i] = !tv.left.includes(d) || (i === 1 && tv.dice[0] === tv.dice[1]); });
        else for (let i = 0; i < used; i++) usedFlags[i] = true;
        const sz = list.length === 4 ? 20 : 26; const gap = 6; const totalW = list.length * sz + (list.length - 1) * gap;
        const cx0 = (tv.cur === me ? X0 + 10 * U : X0 + 3 * U) - totalW / 2;
        list.forEach((d, i) => { svg += die(cx0 + i * (sz + gap), H / 2 - sz / 2 + 4, d, sz, usedFlags[i]); });
      }
      // Tıklama alanları
      for (let r = 0; r < 24; r++) { const { col, top } = place(r); svg += `<rect class="tv-hit" data-r="${r}" x="${colX(col)}" y="${top ? yTop : yBot - PL - 8}" width="${U}" height="${PL + 8}"/>`; }
      svg += `<rect class="tv-hit" data-r="24" x="${X0 + 6 * U}" y="${H / 2}" width="${U}" height="${H / 2}"/><rect class="tv-hit" data-r="-1" x="${tx - 3}" y="${H / 2}" width="${tw + 6}" height="${H / 2}"/>`;

      const pipOf = (p) => { let s = tv.bar[p] * 25; tv.pts.forEach((x, a) => { if (x && x[0] === p) s += x[1] * (relOf(p, a) + 1); }); return s; };
      const status = v.status !== 'playing' ? '' : myTurn ? (tv.phase === 'roll' ? 'Sıra sende, zar at' : sel != null ? 'Parlayan yere dokun' : sources.size ? 'Oynatacağın taşa dokun' : '') : `${v.seats[v.turn]?.name || ''} oynuyor…`;
      ctx.board.innerHTML = `<div class="tv">
        <div class="tv-p">${seatChip(v, op, { extra: `<small>${tv.off[op]}/15 · ${pipOf(op)} pip</small>` })}</div>
        <div class="tv-board"><svg viewBox="0 0 420 ${H + 8}" class="tv-svg">${svg}</svg>
          ${myTurn && tv.phase === 'roll' ? '<button class="btn primary tv-roll">🎲 Zar at</button>' : ''}</div>
        <div class="tv-p">${seatChip(v, me, { extra: `<small>${tv.off[me]}/15 · ${pipOf(me)} pip</small>` })}<span class="grow"></span>
          ${tv.canUndo ? '<button class="btn sm tv-undo">Geri al</button>' : ''}</div>
        <div class="tv-st">${status}</div></div>`;
    },
    after(ctx) {
      const b = ctx.board;
      if (b.dataset.w) return; b.dataset.w = '1';
      b.addEventListener('click', async (e) => {
        const v = ctx.v; const tv = v.tv; if (!tv || v.status !== 'playing' || v.turn !== v.me) return;
        if (e.target.closest('.tv-roll')) { await ctx.move({ type: 'roll' }); return; }
        if (e.target.closest('.tv-undo')) { sel = null; await ctx.move({ type: 'undo' }); return; }
        const hit = e.target.closest('[data-r]'); if (!hit || tv.phase !== 'move') return;
        const r = +hit.dataset.r; const legal = tv.legal || [];
        if (sel != null) {
          const m = legal.find((x) => x.from === sel && x.to === r);
          if (m) { const from = sel; sel = null; await ctx.move({ type: 'move', from, to: m.to, die: m.die }); return; }
        }
        if (legal.some((x) => x.from === r)) {
          // Tek gidilecek yer ve tek seçenek varsa doğrudan oynama yok; önce seç
          sel = sel === r ? null : r;
        } else sel = null;
        ctx.paint();
      });
    },
  });
}

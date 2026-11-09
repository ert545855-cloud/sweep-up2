// 101 Okey masası: ıstaka (çoklu seçim), el açma hazırlığı, masadaki perlere işleme
import { playTable } from '../playkit.js';
import { esc, toast } from '../core.js';
import { toLocal } from '../land.js';

const SLOTS = 26;
const tileHtml = (t, ok, cls = '') => {
  if (!t) return '';
  if (t.fake) return `<span class="tile fake ${cls}" data-id="${esc(t.id)}"><b>★</b></span>`;
  const wild = ok && t.c === ok.c && t.n === ok.n;
  return `<span class="tile c${t.c} ${wild ? 'wild' : ''} ${cls}" data-id="${esc(t.id)}"><b>${t.n}</b><i></i></span>`;
};
// Sunucudaki kuralın aynısı (canlı toplam için)
const isWild = (t, ok) => !t.fake && t.c === ok.c && t.n === ok.n;
const valOf = (t, ok) => (t.fake ? { c: ok.c, n: ok.n } : t);
function groupValue(tiles, ok) {
  if (tiles.length < 3) return null;
  const J = tiles.filter((t) => isWild(t, ok)).length; const vs = tiles.filter((t) => !isWild(t, ok)).map((t) => valOf(t, ok));
  if (tiles.length <= 4 && vs.every((x) => x.n === vs[0]?.n) && new Set(vs.map((x) => x.c)).size === vs.length) return (vs[0]?.n || 0) * tiles.length;
  if (vs.length && vs.every((x) => x.c === vs[0].c)) {
    const nums = vs.map((x) => x.n).sort((a, b) => a - b); if (new Set(nums).size !== nums.length) return null;
    const lo = nums[0]; let hi = nums[nums.length - 1]; const gaps = hi - lo + 1 - nums.length; if (gaps > J) return null;
    let extra = J - gaps; let start = lo; while (extra > 0 && hi < 13) { hi++; extra--; } while (extra > 0 && start > 1) { start--; extra--; } if (extra > 0) return null;
    let v = 0; for (let n = start; n <= hi; n++) v += n; return v;
  }
  return null;
}
const pairOk = (tiles, ok) => tiles.length === 2 && (tiles.some((t) => isWild(t, ok)) || (valOf(tiles[0], ok).c === valOf(tiles[1], ok).c && valOf(tiles[0], ok).n === valOf(tiles[1], ok).n));

export default function okey101(view, id) {
  let order = []; let round = 0; let sel = new Set(); let staged = []; let mode = 'groups';
  const key = `su_o101_${id}`;
  const save = () => { try { sessionStorage.setItem(key, JSON.stringify({ round, order })); } catch {} };
  const load = () => { try { const o = JSON.parse(sessionStorage.getItem(key) || 'null'); if (o?.round === round) order = o.order; } catch {} };
  let dragging = null;

  return playTable(view, 'okey101', id, {
    title: '101 Okey', emoji: '🀄', theme: 'pk-felt', land: true,
    rules: `<p><b>Amaç:</b> Elindeki taşları perlere dizip masaya açmak ve son taşını atarak eli ilk bitirmek.</p>
      <p><b>Per:</b> Aynı renk sıralı en az 3 taş (ör. kırmızı 4-5-6) ya da aynı sayının farklı renkleri (3 ya da 4 taş). 13’ten sonra 1 gelmez.</p>
      <p><b>El açma:</b> İlk açışta masaya koyduğun perlerin sayıları toplamı en az <b>101</b> olmalı. Ya da en az <b>5 çiftle</b> açabilirsin (çiftle açan sonra sadece çift açabilir).</p>
      <p><b>İşleme:</b> Elini açtıktan sonra masadaki herhangi bir pere uyan taşını ekleyebilirsin: taşı seç, sonra pere dokun.</p>
      <p><b>Yandan alma:</b> Soldaki oyuncunun attığı taşı alabilirsin; henüz açmadıysan aynı el açmak zorundasın, açamıyorsan “Geri koy”.</p>
      <p><b>Okey:</b> Göstergenin aynı renkte bir fazlası okeydir, her taşın yerine geçer. ★ sahte okey, okeyin yerine geçen normal taştır.</p>
      <p><b>Ceza:</b> Biten oyuncu −101 alır. Açanlar elinde kalan taşların toplamı kadar (çift açan iki katı), hiç açmayan 202 ceza alır. Az ceza alan önde.</p>`,
    render(ctx) {
      const v = ctx.v; const o = v.ok; if (!o) return;
      if (v.round !== round) { round = v.round; order = []; sel = new Set(); staged = []; load(); }
      const me = v.me; const myTurn = v.status === 'playing' && v.turn === me;
      const ids = new Set(o.hand.map((t) => t.id));
      staged = staged.map((g) => g.filter((x) => ids.has(x))).filter((g) => g.length);
      const stagedIds = new Set(staged.flat());
      sel = new Set([...sel].filter((x) => ids.has(x) && !stagedIds.has(x)));
      order = Array.from({ length: SLOTS }, (_, i) => (order[i] && ids.has(order[i]) && !stagedIds.has(order[i]) ? order[i] : null));
      const placed = new Set(order.filter(Boolean));
      o.hand.filter((t) => !placed.has(t.id) && !stagedIds.has(t.id)).forEach((t) => { let last = -1; order.forEach((x, i) => { if (x) last = i; }); let i = order.findIndex((x, k) => !x && k > last); if (i < 0) i = order.findIndex((x) => !x); if (i >= 0) order[i] = t.id; });
      save();
      const byId = (x) => o.hand.find((t) => t.id === x);
      const opened = o.opened[me];
      const rel = (k) => (me + k) % 4;
      const seat = (i, pos) => { const s = v.seats[i]; const turn = v.status === 'playing' && v.turn === i; return `<div class="ok-seat ${pos} ${turn ? 'turn' : ''}"><span class="ok-av"><img src="${esc(s?.avatar || '')}" alt="">${turn ? '<i class="ok-ring"></i>' : ''}</span><b class="ellipsis">${esc(s?.name || '')}</b><small>${o.counts[i]} taş${o.opened[i] ? ` · ${o.opened[i] === 'pairs' ? `${o.openVal[i]} çift` : `açtı ${o.openVal[i]}`}` : ''}</small></div>`; };
      const dc = (i, pos, can) => `<button class="ok-dc ${pos} ${can ? 'can' : ''}">${o.discards[i] ? tileHtml(o.discards[i], o.okey) : '<span class="tile ghost"></span>'}${o.dcount[i] > 1 ? `<small>${o.dcount[i]}</small>` : ''}</button>`;
      const canDraw = myTurn && o.phase === 'draw'; const canAct = myTurn && o.phase === 'act';
      const selTiles = [...sel].map(byId).filter(Boolean);
      const stagedVals = staged.map((g) => { const ts = g.map(byId); return mode === 'pairs' ? (pairOk(ts, o.okey) ? 1 : null) : groupValue(ts, o.okey); });
      const total = stagedVals.reduce((a, x) => a + (x || 0), 0);
      const stagedOk = staged.length && stagedVals.every((x) => x != null) && (mode === 'pairs' ? staged.length >= 5 : total >= 101);
      const ownerName = (i) => (i === me ? 'Sen' : v.seats[i]?.name || '');
      const melds = o.melds.map((m) => `<button class="o1-m ${canAct && opened === 'groups' && sel.size === 1 && m.kind !== 'pair' ? 'can' : ''}" data-meld="${esc(m.id)}"><small>${esc(ownerName(m.owner))}</small><span>${m.tiles.map((t) => tileHtml(t, o.okey, 'mini2')).join('')}</span></button>`).join('');
      let actions = '';
      if (canAct) {
        if (sel.size >= 2) actions += `<button class="btn sm primary o1-grp">${opened ? (opened === 'pairs' ? 'Çift aç' : 'Per aç') : 'Gruba ekle'} (${sel.size})</button>`;
        if (sel.size === 1) actions += '<button class="btn sm o1-throw">At</button>';
        if (o.took && !opened) actions += '<button class="btn sm o1-untake">Geri koy</button>';
      }
      const status = v.status !== 'playing' ? '' : canDraw ? 'Ortadan çek ya da soldaki taşı al' : canAct ? (sel.size === 1 && opened === 'groups' ? 'Atmak için “At”, işlemek için masadaki bir pere dokun' : opened ? 'Taş seç: per aç, işle ya da at' : 'Taşları seçip grupla, 101’i geçince elini aç; ya da bir taş at') : `${esc(v.seats[v.turn]?.name || '')} oynuyor…`;
      ctx.board.innerHTML = `<div class="o1">
        <div class="o1-felt">${seat(rel(2), 'top')}${seat(rel(3), 'left')}${seat(rel(1), 'right')}
          ${dc(rel(2), 'tl', false)}${dc(rel(1), 'tr', false)}${dc(rel(3), 'bl', canDraw && !!o.discards[rel(3)])}${dc(me, 'br', false)}
          <div class="ok-center"><button class="ok-pile ${canDraw ? 'can' : ''}"><span class="tile back"></span><small>${o.pile}</small></button><div class="ok-ind">${tileHtml(o.indicator, null)}<small>Gösterge</small></div><div class="ok-okey"><small>Okey</small><span class="tile c${o.okey.c} mini"><b>${o.okey.n}</b></span></div></div></div>
        <div class="o1-melds">${melds || '<span class="o1-empty">Henüz kimse açmadı</span>'}</div>
        ${staged.length ? `<div class="o1-stage"><div class="seg o1-mode"><button data-m="groups" class="${mode === 'groups' ? 'on' : ''}">Perle aç</button><button data-m="pairs" class="${mode === 'pairs' ? 'on' : ''}">Çiftle aç</button></div>
          <div class="o1-sg">${staged.map((g, k) => `<button class="o1-g ${stagedVals[k] == null ? 'bad' : ''}" data-g="${k}">${g.map((x) => tileHtml(byId(x), o.okey, 'mini2')).join('')}<small>${stagedVals[k] == null ? 'geçersiz' : mode === 'pairs' ? 'çift' : stagedVals[k]}</small></button>`).join('')}</div>
          <div class="o1-sa"><b>${mode === 'pairs' ? `${staged.length}/5 çift` : `Toplam ${total}/101`}</b><button class="btn sm o1-clear">Geri al</button><button class="btn sm primary o1-open" ${stagedOk && canAct ? '' : 'disabled'}>Elini aç</button></div></div>` : ''}
        <div class="ok-status ${myTurn ? 'me' : ''}">${status}</div>
        <div class="o1-rack">${order.map((tid, i) => `<span class="slot" data-s="${i}">${tid ? tileHtml(byId(tid), o.okey, sel.has(tid) ? 'sel' : '') : ''}</span>`).join('')}</div>
        <div class="ok-btns"><button class="btn sm srt-run">Seri diz</button><button class="btn sm srt-pair">Çift diz</button><span class="grow"></span>${actions}</div></div>`;
    },
    endHtml: (v) => (v.ok?.final ? `<p class="muted">Ceza: ${v.seats.map((s, i) => `${esc(i === v.me ? 'Sen' : s.name)} ${v.ok.final[i]}`).join(' · ')}</p>` : ''),
    after(ctx) {
      if (ctx.board.dataset.w) return; ctx.board.dataset.w = '1';
      const b = ctx.board;
      const sortRack = (how) => {
        const v = ctx.v; const o = v.ok; const ok = o.okey; const stagedIds = new Set(staged.flat());
        const hand = o.hand.filter((t) => !stagedIds.has(t.id)); const J = hand.filter((t) => isWild(t, ok)); const rest = hand.filter((t) => !isWild(t, ok));
        const vv = (t) => valOf(t, ok); const out = [];
        if (how === 'run') { rest.sort((a, c) => vv(a).c - vv(c).c || vv(a).n - vv(c).n); rest.forEach((t, i) => { const p = rest[i - 1]; if (p && (vv(p).c !== vv(t).c || vv(t).n - vv(p).n > 1)) out.push(null); out.push(t.id); }); } else { rest.sort((a, c) => vv(a).n - vv(c).n || vv(a).c - vv(c).c); rest.forEach((t, i) => { const p = rest[i - 1]; if (p && (vv(p).n !== vv(t).n || vv(p).c !== vv(t).c)) out.push(null); out.push(t.id); }); }
        J.forEach((t) => { out.push(null); out.push(t.id); });
        while (out.length > SLOTS) { const k = out.indexOf(null); if (k < 0) break; out.splice(k, 1); }
        order = Array.from({ length: SLOTS }, (_, i) => out[i] || null); save(); ctx.paint();
      };
      b.addEventListener('pointerdown', (e) => { const t = e.target.closest('.o1-rack .tile'); if (!t) return; dragging = { id: t.dataset.id, x: e.clientX, y: e.clientY, el: t, moved: false }; try { t.setPointerCapture(e.pointerId); } catch {} });
      b.addEventListener('pointermove', (e) => {
        if (!dragging) return; if (!dragging.moved && Math.hypot(e.clientX - dragging.x, e.clientY - dragging.y) < 8) return;
        if (!dragging.moved) { dragging.moved = true; dragging.ghost = dragging.el.cloneNode(true); dragging.ghost.classList.add('drag'); document.body.append(dragging.ghost); dragging.el.classList.add('lift'); }
        const pt = toLocal(e.clientX, e.clientY); dragging.ghost.style.left = `${pt.x - 16}px`; dragging.ghost.style.top = `${pt.y - 26}px`;
      });
      b.addEventListener('pointerup', (e) => {
        if (!dragging) return; const d = dragging; dragging = null; d.ghost?.remove(); d.el.classList.remove('lift');
        if (!d.moved) { sel.has(d.id) ? sel.delete(d.id) : sel.add(d.id); ctx.paint(); return; }
        const tgt = document.elementsFromPoint(e.clientX, e.clientY).find((x) => x.matches?.('.slot, .ok-dc.br, .o1-m'));
        if (tgt?.matches('.slot')) { const from = order.indexOf(d.id); const si = +tgt.dataset.s; if (from >= 0 && si !== from) { const other = order[si]; order[si] = d.id; order[from] = other || null; save(); } ctx.paint(); return; }
        if (tgt?.matches('.ok-dc.br')) { sel.clear(); ctx.move({ type: 'discard', tile: d.id }); return; }
        if (tgt?.matches('.o1-m')) { ctx.move({ type: 'add', tile: d.id, meld: tgt.dataset.meld }).then(() => { sel.delete(d.id); }); return; }
        ctx.paint();
      });
      b.addEventListener('pointercancel', () => { if (dragging) { dragging.ghost?.remove(); dragging = null; ctx.paint(); } });
      b.addEventListener('click', async (e) => {
        const v = ctx.v; const o = v.ok; if (!o) return; const my = v.status === 'playing' && v.turn === v.me;
        if (e.target.closest('.srt-run')) return sortRack('run');
        if (e.target.closest('.srt-pair')) return sortRack('pair');
        const mBtn = e.target.closest('.o1-mode [data-m]'); if (mBtn) { mode = mBtn.dataset.m; ctx.paint(); return; }
        const sl = e.target.closest('.o1-rack .slot');
        if (sl && !sl.querySelector('.tile') && sel.size === 1) { const [idd] = sel; const from = order.indexOf(idd); order[+sl.dataset.s] = idd; if (from >= 0) order[from] = null; sel.clear(); save(); ctx.paint(); return; }
        if (!my) return;
        if (e.target.closest('.ok-pile.can')) return ctx.move({ type: 'draw', from: 'pile' });
        if (e.target.closest('.ok-dc.bl.can')) return ctx.move({ type: 'draw', from: 'discard' });
        if (e.target.closest('.o1-untake')) return ctx.move({ type: 'untake' });
        if (e.target.closest('.o1-throw')) { const [x] = sel; sel.clear(); return ctx.move({ type: 'discard', tile: x }); }
        if (e.target.closest('.o1-grp')) {
          const ids = [...sel];
          if (o.opened[v.me]) { sel.clear(); const r = await ctx.move({ type: 'open', pairs: o.opened[v.me] === 'pairs', groups: [ids] }); if (!r) ctx.paint(); return; }
          staged.push(ids); sel.clear(); if (ids.length === 2) mode = 'pairs'; ctx.paint(); return;
        }
        const g = e.target.closest('.o1-g'); if (g) { staged.splice(+g.dataset.g, 1); ctx.paint(); return; }
        if (e.target.closest('.o1-clear')) { staged = []; ctx.paint(); return; }
        if (e.target.closest('.o1-open')) { const r = await ctx.move({ type: 'open', pairs: mode === 'pairs', groups: staged }); if (r) { staged = []; ctx.paint(); } return; }
        const m = e.target.closest('.o1-m');
        if (m && sel.size === 1) { const [x] = sel; const r = await ctx.move({ type: 'add', tile: x, meld: m.dataset.meld }); if (r) { sel.clear(); ctx.paint(); } return; }
        if (m && sel.size !== 1 && o.opened[v.me]) toast('İşlemek için önce tek bir taş seç.');
      });
    },
  });
}

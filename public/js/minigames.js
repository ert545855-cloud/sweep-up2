// Sohbet içi mini oyunlar (XOX, Dört Taş, Taş Kağıt Makas, Amiral Battı): mesaj balonunda canlı tahta
import { api, esc, toast, on } from './core.js';
import { egi } from './eg-icons.js';

export const MINI = { xox: 'XOX', dorttas: 'Dört Taş', tkm: 'Taş Kağıt Makas', amiral: 'Amiral Battı' };
const ICON = { xox: 'xox', dorttas: 'dorttas', tkm: 'tkm', amiral: 'amiral' };
const E = { tas: '✊', kagit: '✋', makas: '✌️' }; const L = { tas: 'Taş', kagit: 'Kağıt', makas: 'Makas' };
const cache = new Map();

const paint = (id) => { const v = cache.get(id); if (!v) return; document.querySelectorAll(`.mg[data-mini="${CSS.escape(id)}"]`).forEach((el) => { el.innerHTML = body(v); el.classList.toggle('mine', v.status !== 'ended' && v.turn === v.me); }); };
on('mini', (v) => { if (!v?.id) return; cache.set(v.id, v); paint(v.id); });

function status(v) {
  const op = v.me === 0 ? 1 : 0; const name = esc(v.names[op] || 'Rakibin');
  if (v.status === 'ended') {
    const t = v.winner === v.me ? '<b class="ok">Kazandın! 🎉</b>' : v.winner === -1 ? '<b>Berabere 🤝</b>' : `<b class="no">${name} kazandı</b>`;
    return `<div class="mg-st end">${t}<button class="btn sm primary" data-mv="again">Tekrar oyna</button></div>`;
  }
  if (v.type === 'amiral' && v.status === 'setup') return `<div class="mg-st">${v.ready[v.me] ? `${name} gemilerini diziyor…` : '<b>Gemilerini yerleştir</b>'}</div>`;
  if (v.type === 'tkm') {
    const sc = [v.rounds.filter((r) => r.w === 'me').length, v.rounds.filter((r) => r.w === 'them').length];
    return `<div class="mg-st">Tur skoru <b>${sc[0]}–${sc[1]}</b>${v.cur.mine ? ` · ${v.cur.theirs ? '' : `${name} bekleniyor…`}` : v.cur.theirs ? ` · ${name} seçti ✓` : ''}</div>`;
  }
  const mark = v.type === 'xox' ? (v.me === 0 ? '<i class="mg-x">✕</i>' : '<i class="mg-o">◯</i>') : v.type === 'dorttas' ? `<i class="mg-dot ${v.me === 0 ? 'r' : 'y'}"></i>` : '';
  return `<div class="mg-st">${v.turn === v.me ? `<b class="go">Sıra sende</b>` : `${name} düşünüyor…`}${mark ? `<span class="mg-me">Sen ${mark}</span>` : ''}</div>`;
}

function board(v) {
  const my = v.status === 'playing' && v.turn === v.me;
  if (v.type === 'xox') return `<div class="mg-xox">${v.board.map((x, i) => `<button data-mv="cell" data-v="${i}" class="${v.line?.includes(i) ? 'w' : ''} ${v.last === i ? 'last' : ''}" ${my && x == null ? '' : 'disabled'}>${x == null ? '' : x === 0 ? '<i class="mg-x">✕</i>' : '<i class="mg-o">◯</i>'}</button>`).join('')}</div>`;
  if (v.type === 'dorttas') return `<div class="mg-c4 ${my ? 'can' : ''}">${v.board.map((x, i) => `<i data-mv="col" data-v="${i % 7}" class="${x === 0 ? 'r' : x === 1 ? 'y' : ''} ${v.line?.includes(i) ? 'w' : ''} ${v.last === i ? 'last' : ''}"></i>`).join('')}</div>`;
  if (v.type === 'tkm') {
    const hist = v.rounds.length ? `<div class="mg-tr">${v.rounds.map((r) => `<span class="${r.w === 'me' ? 'ok' : r.w === 'them' ? 'no' : ''}">${E[r.mine]}<small>${r.w === 'me' ? '>' : r.w === 'them' ? '<' : '='}</small>${E[r.theirs]}</span>`).join('')}</div>` : '';
    const pick = v.status === 'playing' && !v.cur.mine ? `<div class="mg-tkm">${Object.keys(E).map((p) => `<button data-mv="pick" data-v="${p}">${E[p]}<small>${L[p]}</small></button>`).join('')}</div>` : v.cur.mine && v.status === 'playing' ? `<div class="mg-tkm-me">${E[v.cur.mine]}<small>Seçimin</small></div>` : '';
    return hist + pick;
  }
  if (v.type === 'amiral') {
    const N = v.size; const cells = (fn) => Array.from({ length: N * N }, (_, i) => fn(i)).join('');
    const shipAt = (fleet, i) => fleet?.some((s) => s.includes(i));
    if (v.status === 'setup') {
      return `<div class="mg-sea big">${cells((i) => `<i class="${shipAt(v.mine, i) ? 'ship' : ''}"></i>`)}</div>
        ${v.ready[v.me] ? '' : '<div class="mg-row"><button class="btn sm" data-mv="shuffle">🔀 Karıştır</button><button class="btn sm primary" data-mv="ready">Hazırım</button></div>'}`;
    }
    const shot = new Map(v.myShots.map((x) => [x.c, x.hit])); const sunk = new Set(v.sunkTheirs.flat());
    const target = cells((i) => {
      const h = shot.get(i); const cls = sunk.has(i) ? 'sunk' : h === true ? 'hit' : h === false ? 'miss' : v.reveal && shipAt(v.reveal, i) ? 'ship rv' : '';
      const last = v.last && v.last.by === v.me && v.last.c === i ? 'last' : '';
      return `<i data-mv="cell" data-v="${i}" class="${cls} ${last}"></i>`;
    });
    const theirs = new Map(v.theirShots.map((x) => [x.c, x.hit]));
    const mine = cells((i) => { const h = theirs.get(i); return `<i class="${shipAt(v.mine, i) ? 'ship' : ''} ${h === true ? 'hit' : h === false ? 'miss' : ''} ${v.last && v.last.by !== v.me && v.last.c === i ? 'last' : ''}"></i>`; });
    const op = esc(v.names[v.me === 0 ? 1 : 0]);
    const ln = v.last && v.status === 'playing' ? (v.last.by === v.me ? (v.last.sunk ? 'Batırdın! 💥 Tekrar at' : v.last.hit ? 'Vurdun! 🎯 Tekrar at' : 'Iska 🌊') : (v.last.sunk ? `${op} bir gemini batırdı 💥` : v.last.hit ? `${op} gemini vurdu 🎯` : `${op} ıskaladı 🌊`)) : '';
    return `<div class="mg-sea big ${my ? 'can' : ''}">${target}</div>
      <div class="mg-am"><div class="mg-sea sm">${mine}</div><div class="mg-am-i"><small>Senin filon</small><b>Batırdığın ${v.sunkTheirs.length}/${v.fleet.length}</b><b>Kaybettiğin ${v.sunkMine}/${v.fleet.length}</b>${ln ? `<span>${ln}</span>` : ''}</div></div>`;
  }
  return '';
}
function body(v) {
  const op = v.me === 0 ? 1 : 0;
  return `<div class="mg-h">${egi(ICON[v.type], 24)}<b>${MINI[v.type]}</b>${v.round > 1 || v.wins[0] || v.wins[1] ? `<span class="mg-sc" title="Toplam">${v.wins[v.me]}–${v.wins[op]}</span>` : ''}</div>${board(v)}${status(v)}`;
}

export function miniHtml(m) {
  const g = m.game; const v = cache.get(g.id);
  return `<div class="mg mgt-${esc(g.type)} ${v && v.status !== 'ended' && v.turn === v.me ? 'mine' : ''}" data-mini="${esc(g.id)}">${v ? body(v) : `<div class="mg-h">${egi(ICON[g.type] || 'oyun', 24)}<b>${MINI[g.type] || 'Oyun'}</b></div><div class="mg-load">Yükleniyor…</div>`}</div>`;
}
export function hydrateMini(root) {
  root.querySelectorAll('.mg[data-mini]:not([data-h])').forEach((el) => {
    el.dataset.h = '1'; const id = el.dataset.mini;
    if (cache.has(id)) { el.innerHTML = body(cache.get(id)); return; }
    api(`/mini/${id}`).then((v) => { cache.set(id, v); paint(id); }).catch(() => { el.querySelector('.mg-load')?.replaceChildren('Oyun bulunamadı.'); });
  });
}
export async function miniClick(e) {
  const el = e.target.closest('.mg[data-mini]'); if (!el) return false;
  const b = e.target.closest('[data-mv]'); if (!b || b.disabled || el.classList.contains('busy')) return true;
  const id = el.dataset.mini; const v = cache.get(id); if (!v) return true;
  const k = b.dataset.mv;
  if ((k === 'col' || k === 'cell') && !(v.status === 'playing' && v.turn === v.me)) { if (v.status === 'playing') toast('Sıra sende değil.'); return true; }
  if (k === 'cell' && v.type === 'amiral' && v.myShots.some((x) => x.c === +b.dataset.v)) return true;
  const body = k === 'col' ? { col: +b.dataset.v } : k === 'cell' ? { cell: +b.dataset.v } : k === 'pick' ? { pick: b.dataset.v } : { type: k };
  el.classList.add('busy');
  try {
    const r = await api(k === 'again' ? `/mini/${id}/again` : `/mini/${id}/move`, { body: k === 'again' ? {} : body });
    cache.set(id, r); paint(id); navigator.vibrate?.(10);
  } catch (er) { toast(er.message); } finally { el.classList.remove('busy'); }
  return true;
}

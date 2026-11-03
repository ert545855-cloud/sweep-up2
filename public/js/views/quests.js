// Günlük görevler
import { icon } from '../icons.js';
import { api, esc, toast, state, on, emit } from '../core.js';

export default async function quests(view) {
  view.innerHTML = `<header class="topbar"><button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/')" aria-label="Geri">${icon('back')}</button><div class="center">Günlük görevler</div><a class="ib soft" href="#/store" aria-label="Jeton">${icon('coin')}</a></header><div class="qs"><div class="spinner"></div></div>`;
  const box = view.querySelector('.qs');
  let q; let tmr;
  const left = () => { const ms = Math.max(0, q.resetAt - Date.now()); const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000); return `${h} sa ${m} dk`; };
  const paint = () => {
    if (!q.enabled) { box.innerHTML = '<div class="empty">Görevler şu an kapalı.</div>'; return; }
    const pct = Math.round((q.doneCount / q.total) * 100);
    box.innerHTML = `<section class="qs-hero"><div class="qs-ring" style="--p:${pct}"><b>${q.doneCount}/${q.total}</b></div><div class="grow"><b>Bugünün görevleri</b><small>Tamamla, jetonunu al. Hepsini bitirince <b>+${q.bonus}</b> bonus! Yenilenmesine <span class="ql">${left()}</span></small></div></section>
      ${q.items.map((x) => `<div class="qs-it ${x.done ? 'done' : ''} ${x.claimed ? 'claimed' : ''}">
        <span class="qs-em">${x.em}</span>
        <div class="grow"><b>${esc(x.title)}</b><div class="qs-bar"><i style="width:${Math.min(100, (x.progress / x.goal) * 100)}%"></i></div><small>${x.progress}/${x.goal}</small></div>
        ${x.claimed ? `<span class="qs-ok">${icon('check')}</span>` : x.done ? `<button class="btn primary sm qs-c" data-id="${esc(x.id)}">${icon('coin')} +${x.coins}</button>` : `<span class="qs-r">${icon('coin')} ${x.coins}</span>`}
      </div>`).join('')}
      <div class="qs-it bonus ${q.bonusClaimed ? 'claimed' : ''}"><span class="qs-em">🎁</span><div class="grow"><b>Hepsini tamamla bonusu</b><small>${q.bonusClaimed ? 'Bugünkü bonusu aldın' : q.bonusReady ? 'Hazır!' : `${q.total - q.doneCount} görev kaldı`}</small></div>
        ${q.bonusClaimed ? `<span class="qs-ok">${icon('check')}</span>` : q.bonusReady ? `<button class="btn primary sm qs-c" data-id="bonus">${icon('coin')} +${q.bonus}</button>` : `<span class="qs-r">${icon('coin')} ${q.bonus}</span>`}</div>
      <p class="muted" style="font-size:12.5px;margin:6px 2px 30px">Görevler her gece 00:00’da (Türkiye saati) yenilenir. Kazandığın jetonlarla süper beğeni, boost, fal ve öne çıkarma alabilirsin.</p>`;
  };
  const load = async () => { q = await api('/quests'); paint(); };
  box.onclick = async (e) => {
    const b = e.target.closest('.qs-c'); if (!b) return;
    b.disabled = true;
    try { const r = await api(`/quests/${b.dataset.id}/claim`, { body: {} }); state.me.coins = r.coins; emit('me', state.me); emit('quests:changed', r); q = r; paint(); toast('🪙 Jetonların eklendi!'); } catch (er) { toast(er.message); b.disabled = false; }
  };
  await load();
  tmr = setInterval(() => { const el = box.querySelector('.ql'); if (el) el.textContent = left(); }, 30000);
  const off = on('quests', () => load().catch(() => {}));
  return () => { clearInterval(tmr); off(); };
}

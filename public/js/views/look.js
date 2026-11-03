import { icon } from '../icons.js';
import { api, esc, toast, state, needCoins, emit } from '../core.js';

const back = `<button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/me')" aria-label="Geri">${icon('back')}</button>`;

export default async function look(view) {
  view.innerHTML = `<header class="topbar">${back}<div class="center">Çerçeve ve rozet</div><a class="ib soft" href="#/store" aria-label="Jeton al">${icon('coin')}</a></header><div class="look"><div class="spinner"></div></div>`;
  const box = view.querySelector('.look');
  let c;
  const preview = (id) => `<div class="av-wrap fr fr-${esc(id)}"><img class="av av-64" src="${esc(state.me.avatar)}" alt=""></div>`;
  const render = () => {
    const ev = c.eventBadge;
    const owned = new Set((c.badges || []).map((b) => b.id));
    box.innerHTML = `
      <section class="look-hero">${c.frame ? preview(c.frame) : `<div class="av-wrap"><img class="av av-96" src="${esc(state.me.avatar)}" alt=""></div>`}
        <div><b>${esc(state.me.name)}</b><small>${icon('coin')} ${c.coins.toLocaleString('tr-TR')} jeton</small></div></section>
      ${ev ? `<section class="badge-offer"><span class="be">${ev.em}</span><div class="grow"><b>${esc(ev.name)} rozeti</b><small>Sınırlı sayıda: ${ev.limit} rozetten ${ev.left} tane kaldı. Profilinde ve kartında numarasıyla görünür.</small></div>
        ${owned.has(ev.id) ? '<span class="pill ok">Sende</span>' : `<button class="btn primary sm bb" ${ev.left ? '' : 'disabled'}>${icon('coin')} ${ev.coins}</button>`}</section>` : ''}
      <h3 class="shop-h">Profil çerçeveleri</h3>
      <p class="muted" style="font-size:13px;margin:-4px 2px 10px">Çerçeve fotoğrafının etrafında her yerde görünür: profilinde, hikayelerde, sohbetlerde.</p>
      <div class="frames">${c.frames.map((f) => `<button class="frame-it ${c.frame === f.id ? 'on' : ''}" data-id="${esc(f.id)}">${preview(f.id)}<b>${esc(f.name)}</b>
        <small>${c.frame === f.id ? 'Kullanılıyor' : f.owned ? 'Sende' : `${icon('coin')} ${f.coins}`}</small>${f.limited ? '<i class="lim">Sınırlı</i>' : ''}</button>`).join('')}</div>
      ${c.frame ? '<button class="btn block nofr" style="margin-top:14px">Çerçeveyi kaldır</button>' : ''}
      ${(c.badges || []).length ? `<h3 class="shop-h">Rozetlerin</h3><div class="badges">${c.badges.map((b) => `<span class="badge">${b.em} ${esc(b.name)}<small>#${b.no}</small></span>`).join('')}</div>` : ''}
      <div style="height:30px"></div>`;
  };
  const load = async () => { c = await api('/cosmetics'); render(); };
  const sync = (r) => { if (r.coins != null) state.me.coins = r.coins; emit('me', state.me); };
  box.onclick = async (e) => {
    const fb = e.target.closest('.frame-it');
    try {
      if (fb) {
        const f = c.frames.find((x) => x.id === fb.dataset.id);
        if (c.frame === f.id) return;
        if (!f.owned && !confirm(`${f.name} çerçevesi ${f.coins} jeton. Alınsın mı?`)) return;
        const r = await api('/cosmetics/frame', { body: { id: f.id } });
        state.me.frame = r.frame; sync(r); toast(f.owned ? 'Çerçeve değişti.' : 'Çerçeve senin! 🎉'); load();
      } else if (e.target.closest('.nofr')) {
        await api('/cosmetics/frame', { body: { id: null } }); state.me.frame = null; load();
      } else if (e.target.closest('.bb')) {
        const r = await api('/cosmetics/badge', { body: { id: c.eventBadge.id } });
        sync(r); toast('Rozet profiline eklendi.'); load();
      }
    } catch (er) { if (er.status === 402) needCoins(er.message); else toast(er.message); }
  };
  await load();
}

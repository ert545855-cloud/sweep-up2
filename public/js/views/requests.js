import { icon } from '../icons.js';
import {
  api, esc, toast, avatar, nm, ago, refreshBadges,
} from '../core.js';

export default async function requests(view) {
  view.innerHTML = `<header class="topbar"><button class="ib" data-back="#/notifications" aria-label="Geri">${icon('back')}</button><div class="center">Takip istekleri</div><span class="ib"></span></header>
    <div class="rq"><div class="spinner"></div></div>`;
  const box = view.querySelector('.rq');
  const load = async () => {
    const list = await api('/follow-requests');
    box.innerHTML = list.length ? list.map((r) => `<div class="list-item" data-id="${esc(r.user.id)}">${avatar(r.user, 48)}
      <a class="grow" href="#/u/${esc(r.user.username)}"><div class="b">${nm(r.user, 'username')}</div><div class="sub">${esc(r.user.name)} · ${ago(r.at)}</div></a>
      <button class="btn sm primary ok">Onayla</button><button class="btn sm no">Sil</button></div>`).join('')
      : `<div class="empty"><div class="big">${icon('userPlus')}</div><h2>İstek yok</h2>Gizli hesabını takip etmek isteyenler burada görünür.</div>`;
  };
  await load();
  box.onclick = async (e) => {
    const b = e.target.closest('.ok, .no'); if (!b) return;
    const row = b.closest('[data-id]');
    try {
      await api(`/follow-requests/${row.dataset.id}`, { body: { accept: b.classList.contains('ok') } });
      row.remove();
      toast(b.classList.contains('ok') ? 'Onaylandı.' : 'İstek silindi.');
      if (!box.querySelector('[data-id]')) load();
      refreshBadges();
    } catch (er) { toast(er.message); }
  };
  return null;
}

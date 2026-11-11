import { icon } from '../icons.js';
import { api, esc, num } from '../core.js';
import { gridTile } from '../components.js';

export default async function tag(view, t) {
  const name = decodeURIComponent(t || '');
  view.innerHTML = `<header class="topbar"><button class="ib" data-back="#/search" aria-label="Geri">${icon('back')}</button><div class="center">#${esc(name)}</div><span class="ib"></span></header>
    <div class="tag-head"><span class="hash">#</span><div><h2>#${esc(name)}</h2><span class="muted cnt"></span></div></div><div class="tb"><div class="spinner"></div></div>`;
  const r = await api(`/tags/${encodeURIComponent(name)}`);
  view.querySelector('.cnt').textContent = `${num(r.count)} gönderi`;
  view.querySelector('.tb').innerHTML = r.posts.length ? `<div class="grid">${r.posts.map(gridTile).join('')}</div>`
    : `<div class="empty"><h2>Henüz gönderi yok</h2>Bu etiketle ilk paylaşımı sen yap. <p><a class="btn primary" href="#/create">Paylaş</a></p></div>`;
  return null;
}

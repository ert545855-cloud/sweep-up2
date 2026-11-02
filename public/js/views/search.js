import { icon } from '../icons.js';
import { api, esc, avatar } from '../core.js';
import { gridTile } from '../components.js';

export default async function search(view) {
  view.innerHTML = `<div class="search-bar">
      <button onclick="history.length > 1 ? history.back() : (location.hash = '#/')" aria-label="Geri">${icon('back')}</button>
      <label class="sw">${icon('search')}<input class="field q" placeholder="Ara" autocomplete="off" autocapitalize="none" aria-label="Kişi ara"></label>
    </div>
    <div class="results" hidden></div>
    <div class="explore"><div class="spinner"></div></div>`;
  const q = view.querySelector('.q');
  const res = view.querySelector('.results');
  const ex = view.querySelector('.explore');

  let t;
  q.oninput = () => {
    clearTimeout(t);
    const v = q.value.trim();
    res.hidden = !v; ex.hidden = !!v;
    if (!v) return;
    t = setTimeout(async () => {
      const us = await api(`/users/search?q=${encodeURIComponent(v)}`);
      res.innerHTML = us.length ? us.map((u) => `<a class="list-item" href="#/u/${esc(u.username)}">${avatar(u, 44, { ring: true })}
        <div class="grow"><div class="b">${esc(u.username)}</div><div class="sub">${esc(u.name)}${u.live ? ' · canlı yayında' : ''}</div></div></a>`).join('')
        : `<div class="empty">“${esc(v)}” için sonuç yok.</div>`;
    }, 180);
  };

  const [posts, people] = await Promise.all([api('/explore'), api('/people')]);
  ex.innerHTML = `${people.length ? `<div class="section-t"><span>Kişiler</span></div>${people.slice(0, 8).map((u) => `<a class="list-item" href="#/u/${esc(u.username)}">${avatar(u, 44, { ring: true })}
      <div class="grow"><div class="b">${esc(u.name)}</div><div class="sub">@${esc(u.username)}${u.online ? ' · çevrimiçi' : ''}</div></div></a>`).join('')}` : ''}
    <div class="section-t"><span>Keşfet</span></div><div class="grid explore">${posts.map(gridTile).join('')}</div>`;
  return null;
}

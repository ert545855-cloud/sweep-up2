import { icon } from '../icons.js';
import {
  api, esc, avatar, nm,
} from '../core.js';
import { gridTile } from '../components.js';

export default async function search(view) {
  view.innerHTML = `<div class="search-bar">
      <button onclick="history.length > 1 ? history.back() : (location.hash = '#/')" aria-label="Geri">${icon('back')}</button>
      <label class="sw">${icon('search')}<input class="field q" placeholder="Kişi ya da #etiket ara" autocomplete="off" autocapitalize="none" aria-label="Kişi ara"></label>
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
      if (v.startsWith('#')) {
        const tags = await api(`/tags?q=${encodeURIComponent(v.slice(1))}`);
        res.innerHTML = tags.length ? tags.map((x) => `<a class="list-item" href="#/tag/${encodeURIComponent(x.tag)}"><span class="hash-ic">#</span><div class="grow"><div class="b">#${esc(x.tag)}</div><div class="sub">${x.count} gönderi</div></div></a>`).join('')
          : `<div class="empty">“${esc(v)}” etiketiyle gönderi yok.</div>`;
        return;
      }
      const [us, tags] = await Promise.all([api(`/users/search?q=${encodeURIComponent(v)}`), api(`/tags?q=${encodeURIComponent(v)}`).catch(() => [])]);
      const tagHtml = tags.slice(0, 3).map((x) => `<a class="list-item" href="#/tag/${encodeURIComponent(x.tag)}"><span class="hash-ic">#</span><div class="grow"><div class="b">#${esc(x.tag)}</div><div class="sub">${x.count} gönderi</div></div></a>`).join('');
      res.innerHTML = tagHtml + (us.length ? us.map((u) => `<a class="list-item" href="#/u/${esc(u.username)}">${avatar(u, 44, { ring: true })}
        <div class="grow"><div class="b">${nm(u, 'username')}</div><div class="sub">${esc(u.name)}${u.live ? ' · canlı yayında' : ''}</div></div></a>`).join('')
        : (tagHtml ? '' : `<div class="empty">“${esc(v)}” için sonuç yok.</div>`));
    }, 180);
  };

  const [posts, people, tags] = await Promise.all([api('/explore'), api('/people'), api('/tags').catch(() => [])]);
  ex.innerHTML = `${tags.length ? `<div class="section-t"><span>Popüler etiketler</span></div><div class="chips tag-chips">${tags.slice(0, 12).map((x) => `<a class="chip" href="#/tag/${encodeURIComponent(x.tag)}">#${esc(x.tag)}</a>`).join('')}</div>` : ''}${people.length ? `<div class="section-t"><span>Kişiler</span></div>${people.slice(0, 8).map((u) => `<a class="list-item" href="#/u/${esc(u.username)}">${avatar(u, 44, { ring: true })}
      <div class="grow"><div class="b">${nm(u)}</div><div class="sub">@${esc(u.username)}${u.online ? ' · çevrimiçi' : ''}</div></div></a>`).join('')}` : ''}
    <div class="section-t"><span>Keşfet</span></div><div class="grid explore">${posts.map(gridTile).join('')}</div>`;
  return null;
}

import { icon } from '../icons.js';
import { api } from '../core.js';
import { postCard, wirePost, autoplay } from '../components.js';

export default async function post(view, id) {
  view.innerHTML = `<header class="topbar bordered">
      <button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/')" aria-label="Geri">${icon('back')}</button>
      <div class="center">Gönderi</div><span class="ib"></span>
    </header><div class="pb"><div class="spinner"></div></div>`;
  const p = await api(`/posts/${id}`);
  if (p.type === 'reel') { location.replace(`#/dalga/${p.id}`); return null; }
  const pb = view.querySelector('.pb');
  pb.innerHTML = postCard(p);
  wirePost(pb.firstElementChild, p, () => { location.hash = '#/me'; });
  return autoplay(pb);
}

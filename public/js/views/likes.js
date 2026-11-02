import { icon } from '../icons.js';
import { api, esc, toast, refreshBadges, on, plusSheet, tick } from '../core.js';
import { showMatch } from '../app.js';

export default async function likes(view) {
  view.innerHTML = `<header class="topbar">
      <button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/swipe')" aria-label="Geri">${icon('back')}</button>
      <div class="center">Seni beğenenler</div><span class="ib"></span>
    </header><div class="lb"><div class="spinner"></div></div>`;
  const box = view.querySelector('.lb');
  let list = [];
  let plus = false;
  const paint = () => {
    const locked = list.filter((u) => u.locked).length;
    box.innerHTML = list.length
      ? `${locked ? `<button class="plus-banner">${icon('crown')}<span><b>${locked} kişi seni beğendi</b>Kim olduklarını görmek için SwipeUp+’a geç.</span></button>` : '<p class="muted" style="margin:4px 16px 14px">Sağa kaydırırsan anında eşleşirsiniz.</p>'}
      <div class="likes-grid">${list.map((u) => (u.locked ? `<button class="like-card locked"><img src="${esc(u.photo)}" alt=""><div class="g"></div><span class="lk">${icon('lock')}</span></button>` : `<div class="like-card" data-id="${esc(u.id)}">
          <img src="${esc(u.photo)}" alt=""><div class="g"></div>
          ${u.super ? '<span class="sup">SÜPER BEĞENİ</span>' : ''}
          <a class="t ellipsis" href="#/u/${esc(u.username)}">${esc(u.name.split(' ')[0])}${u.age ? `, ${u.age}` : ''}${tick(u)}</a>
          <div class="acts"><button class="no" aria-label="Geç">${icon('x')}</button><button class="yes" aria-label="Beğen">${icon('heart', '', 'fill="currentColor"')}</button></div>
        </div>`)).join('')}</div>`
      : `<div class="empty"><div class="big">${icon('heart')}</div><h2>Henüz beğeni yok</h2>Profiline birkaç fotoğraf ekle ve kaydırmaya devam et; seni beğenenler burada görünür.<p><a class="btn primary" href="#/swipe">Kaydırmaya başla</a></p></div>`;
  };
  const load = async () => { const r = await api('/likes'); list = r.items; plus = r.plus; paint(); };
  await load();
  box.onclick = async (e) => {
    if (e.target.closest('.locked, .plus-banner')) return plusSheet('Seni beğenenleri tek tek gör, hemen eşleş.');
    const b = e.target.closest('.no, .yes'); if (!b) return;
    const card = b.closest('.like-card'); const id = card.dataset.id;
    const u = list.find((x) => x.id === id);
    list = list.filter((x) => x.id !== id);
    card.style.transition = 'transform .3s, opacity .3s';
    card.style.transform = `translateX(${b.classList.contains('yes') ? 60 : -60}px) rotate(${b.classList.contains('yes') ? 8 : -8}deg)`;
    card.style.opacity = 0;
    try {
      const r = await api('/swipe', { body: { to: id, dir: b.classList.contains('yes') ? 'right' : 'left' } });
      if (r.match) showMatch(r.user || u, r.chatId);
    } catch (er) { toast(er.message); }
    setTimeout(paint, 300);
    refreshBadges();
  };
  const off = on('likes:new', load);
  refreshBadges();
  return off;
}

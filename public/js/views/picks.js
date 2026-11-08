// Günlük seçki: her sabah ilgi alanı, burç ve konuma göre "Bugün senin için 5 kişi"
import { icon } from '../icons.js';
import { api, esc, toast, state, nm, plusSheet } from '../core.js';
import { showMatch } from '../app.js';
import { egi } from '../eg-icons.js';

const left = (t) => {
  const ms = Math.max(0, t - Date.now());
  const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000);
  return h ? `${h} sa ${m} dk` : `${m} dk`;
};

export default async function picks(view) {
  view.innerHTML = `<header class="topbar"><button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/swipe')" aria-label="Geri">${icon('back')}</button><div class="center">Günlük seçki</div><a class="ib soft" href="#/swipe" aria-label="Kaydır">${icon('flame')}</a></header>
    <div class="pk"><div class="spinner"></div></div>`;
  const box = view.querySelector('.pk');
  let d;
  try { d = await api('/picks'); } catch (e) { box.innerHTML = `<div class="empty"><h2>Seçki açılamadı</h2>${esc(e.message)}</div>`; return null; }
  if (!d.enabled) { box.innerHTML = `<div class="empty"><div class="big">${egi('secki', 72)}</div><h2>Günlük seçki şu an kapalı</h2><p><a class="btn primary" href="#/swipe">Kaydırmaya git</a></p></div>`; return null; }

  const card = (u) => `<article class="pk-c ${u.swiped ? `done ${u.swiped}` : ''}" data-id="${esc(u.id)}">
      <a class="pk-ph" href="#/u/${esc(u.username)}"><img src="${esc(u.photo || u.avatar)}" alt="" loading="lazy">
        <span class="pk-n"><b>${nm(u)}${u.age ? `, ${u.age}` : ''}</b><small>${[u.city, u.distanceKm ? `${u.distanceKm} km` : null, u.zodiac ? `${u.zodiac[1]} ${u.zodiac[0]}` : null].filter(Boolean).map(esc).join(' · ')}</small></span></a>
      ${u.reasons.length ? `<div class="pk-why">${u.reasons.map((r) => `<span>${esc(r)}</span>`).join('')}</div>` : ''}
      ${u.bio ? `<p class="pk-bio">${esc(u.bio)}</p>` : ''}
      ${u.interests.length ? `<div class="pk-int">${u.interests.map((t) => `<span class="chip uv">${esc(t)}</span>`).join('')}</div>` : ''}
      ${u.nowPlaying ? `<div class="pk-np">${egi('dinle', 18)} ${esc(u.nowPlaying.title)} · ${esc(u.nowPlaying.artist)}</div>` : ''}
      <div class="pk-acts">${u.swiped
    ? `<span class="pill ${u.swiped === 'left' ? '' : 'ok'}">${u.swiped === 'left' ? 'Geçtin' : u.swiped === 'super' ? 'Süper beğendin' : 'Beğendin'}</span>`
    : `<button class="pk-b no" data-dir="left" aria-label="Geç">${icon('close')}</button><button class="pk-b super" data-dir="super" aria-label="Süper beğen">${icon('star')}</button><button class="pk-b yes" data-dir="right" aria-label="Beğen">${icon('heart')}</button>`}</div>
    </article>`;
  const paint = () => {
    const rest = d.items.filter((u) => !u.swiped).length;
    box.innerHTML = `<section class="pk-hero">${egi('secki', 52)}<div class="grow"><b>Günaydın ${esc((state.me.name || '').split(' ')[0])}!</b><small>${d.items.length ? `Bugün senin için ${d.items.length} kişi seçtik. İlgi alanın, burcun ve konumuna göre.` : 'Bugün için uygun kimseyi bulamadık.'}</small></div></section>
      ${d.items.length ? d.items.map(card).join('') : `<div class="empty" style="padding:24px"><div class="big">${egi('kulup', 64)}</div>Profiline ilgi alanı ve konum eklersen seçkin daha isabetli olur.<p><a class="btn primary" href="#/edit">Profili düzenle</a></p></div>`}
      <p class="pk-next">${rest ? `${rest} kişi seni bekliyor · ` : 'Bugünün seçkisini bitirdin. '}Yeni seçki <b>${left(d.nextAt)}</b> sonra</p>`;
  };
  paint();
  box.addEventListener('click', async (e) => {
    const b = e.target.closest('.pk-b'); if (!b) return;
    const c = b.closest('[data-id]'); const u = d.items.find((x) => x.id === c.dataset.id);
    const dir = b.dataset.dir;
    c.querySelectorAll('.pk-b').forEach((x) => { x.disabled = true; });
    try {
      const r = await api('/swipe', { body: { to: u.id, dir } });
      u.swiped = dir; navigator.vibrate?.(12);
      c.outerHTML = card(u);
      if (r.match) showMatch(r.user, r.chatId);
      if (!d.items.some((x) => !x.swiped)) paint();
    } catch (er) {
      c.querySelectorAll('.pk-b').forEach((x) => { x.disabled = false; });
      if (er.status === 402 && !state.badges.plus) plusSheet(er.message); else toast(er.message);
    }
  });
  return null;
}

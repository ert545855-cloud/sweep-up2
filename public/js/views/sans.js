// İkinci şans: her hafta, geçtiğin kişilerden birkaçına bir kez daha bakma fırsatı
import { icon } from '../icons.js';
import { api, esc, toast, tick } from '../core.js';
import { showMatch } from '../app.js';

export default async function sans(view) {
  view.innerHTML = `<header class="topbar bordered"><button class="ib" data-back="#/swipe" aria-label="Geri">${icon('back')}</button><div class="center">İkinci şans</div><span class="ib"></span></header>
    <div class="sc-page"><div class="spinner"></div></div>`;
  const box = view.querySelector('.sc-page');
  let d;
  try { d = await api('/second-chance'); } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return null; }
  const nextTxt = new Date(d.next).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
  const paint = () => {
    if (!d.items.length) {
      box.innerHTML = `<div class="empty"><div class="big">💫</div><h2>${d.total ? 'Bu haftanın ikinci şanslarını gördün' : 'Bu hafta ikinci şans yok'}</h2>${d.total ? 'Kararlarını verdin, harika!' : 'Kaydırırken geçtiğin kişiler birkaç gün sonra burada tekrar karşına çıkabilir.'} Yeni liste ${esc(nextTxt)} hazır olur.<p><a class="btn primary" href="#/swipe">Keşfetmeye dön</a></p></div>`;
      return;
    }
    box.innerHTML = `<div class="sc-hero"><span>💫</span><p>Geçtiğin kişilerden bu hafta senin için seçtiklerimiz. Bir kez daha bak; beğenirsen ve o da seni beğendiyse eşleşirsiniz.</p></div>
      ${d.items.map((u) => `<article class="sc-card" data-id="${esc(u.id)}">
        <a class="sc-ph" href="#/u/${esc(u.username)}"><img src="${esc(u.photos[0] || u.avatar)}" alt="" loading="lazy"><span class="sc-why">${esc(u.why)}</span></a>
        <div class="sc-b"><h3>${esc(u.name.split(' ')[0])}${u.age ? ` <small>${u.age}</small>` : ''}${tick(u)}</h3>
          ${u.city || u.distanceKm ? `<div class="muted sc-w">${[u.city, u.distanceKm ? `${u.distanceKm} km` : ''].filter(Boolean).map(esc).join(' · ')}</div>` : ''}
          ${u.bio ? `<p class="sc-bio">${esc(u.bio)}</p>` : ''}
          ${u.prompts?.[0] ? `<div class="card-pq"><small>${esc(u.prompts[0].q)}</small>${esc(u.prompts[0].a)}</div>` : ''}
          ${u.interests?.length ? `<div class="chips">${u.interests.slice(0, 5).map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>` : ''}
          <div class="sc-act"><button class="btn sc-no" aria-label="Geç">${icon('x')} Geç</button><button class="btn primary sc-yes" aria-label="Beğen">${icon('heart')} Beğen</button></div></div></article>`).join('')}
      <p class="muted sc-foot">Bu hafta ${d.total} kişi · yeni liste ${esc(nextTxt)}</p>`;
  };
  box.onclick = async (e) => {
    const b = e.target.closest('.sc-no, .sc-yes'); if (!b) return;
    const card = b.closest('.sc-card'); const id = card.dataset.id; const u = d.items.find((x) => x.id === id);
    const like = b.classList.contains('sc-yes');
    card.querySelectorAll('button').forEach((x) => { x.disabled = true; });
    try {
      const r = like ? await api('/swipe', { body: { to: id, dir: 'right' } }) : null;
      await api(`/second-chance/${id}`, { body: { action: like ? 'like' : 'skip' } });
      if (r?.match) showMatch(r.user, r.chatId); else if (like) toast(`${u.name.split(' ')[0]} kişisine beğenin gönderildi 💜`);
      card.classList.add(like ? 'gone-r' : 'gone-l');
      setTimeout(() => { d.items = d.items.filter((x) => x.id !== id); paint(); }, 320);
    } catch (er) { toast(er.message); card.querySelectorAll('button').forEach((x) => { x.disabled = false; }); }
  };
  paint();
  return null;
}

import { icon } from '../icons.js';
import { api, esc, ago, avatar, nm, plusSheet } from '../core.js';

export default async function viewers(view) {
  view.innerHTML = `<header class="topbar"><button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/me')" aria-label="Geri">${icon('back')}</button><div class="center">Profilini kimler gördü</div><span class="ib"></span></header><div class="viewers"><div class="spinner"></div></div>`;
  const box = view.querySelector('.viewers');
  const r = await api('/me/viewers?seen=1');
  if (!r.count) {
    box.innerHTML = `<div class="empty"><div class="big">${icon('eye')}</div><h2>Bu hafta henüz ziyaret yok</h2>Profiline soru ve sesli tanıtım eklemek daha çok kişinin uğramasını sağlar.<p><a class="btn primary" href="#/edit">Profili düzenle</a></p></div>`;
    return;
  }
  if (r.plus) {
    box.innerHTML = `<p class="vw-h"><b>${r.count}</b> kişi son 7 günde profiline baktı.</p>
      ${r.items.map((u) => `<a class="list-item" href="#/u/${esc(u.username)}">${avatar(u, 48, { dot: false })}<div class="grow"><div class="b">${nm(u)}${u.age ? `, ${u.age}` : ''}</div><div class="sub">${[u.city, ago(u.at, true)].filter(Boolean).map(esc).join(' · ')}</div></div></a>`).join('')}`;
    return;
  }
  box.innerHTML = `<p class="vw-h"><b>${r.count}</b> kişi son 7 günde profiline baktı.</p>
    <div class="vw-grid">${r.items.map((u) => `<div class="vw-t"><img src="${esc(u.photo)}" alt=""><small>${ago(u.at, true)}</small></div>`).join('')}</div>
    <div class="vw-cta"><b>Kim olduklarını gör</b><p class="muted">SwipeUp+ ile profilini ziyaret eden herkesi görürsün, onlara hemen beğeni gönderebilirsin.</p><button class="btn primary block up">${icon('crown')} SwipeUp+ al</button></div>`;
  box.querySelector('.up').onclick = () => plusSheet('Ziyaretçilerini görmek için SwipeUp+ gerekli.');
}

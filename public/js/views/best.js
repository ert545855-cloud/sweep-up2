// Haftanın en beğenilenleri: bu haftanın canlı sıralaması ve geçen haftanın kazananları
import { icon } from '../icons.js';
import { api, esc, num, avatar } from '../core.js';
import { gridTile } from '../components.js';
import { egi } from '../eg-icons.js';

const MEDAL = ['🥇', '🥈', '🥉'];
export default async function best(view) {
  view.innerHTML = `<header class="topbar bordered"><button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/')" aria-label="Geri">${icon('back')}</button><div class="center">Haftanın en beğenilenleri</div><span class="ib"></span></header><div class="wb-page"><div class="spinner"></div></div>`;
  const box = view.querySelector('.wb-page');
  let d;
  try { d = await api('/weekly-best'); } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return null; }
  const range = (a, b) => `${new Date(a).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} – ${new Date(b - 1).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}`;
  const left = d.to - Date.now(); const dd = Math.floor(left / 86400000); const hh = Math.floor((left % 86400000) / 3600000);
  const podium = (list) => `<div class="wb-pod">${list.slice(0, 3).map((p) => `<a class="wb-p r${p.rank}" href="#/${p.type === 'reel' ? 'vitrin' : 'p'}/${esc(p.id)}">
      <span class="wb-ph">${p.type === 'text' ? `<span class="tbg-${esc(p.bg || 'g1')} wb-tx">${esc((p.caption || '').slice(0, 60))}</span>` : `<img src="${esc(p.poster || p.media)}" alt="" loading="lazy">`}<i>${MEDAL[p.rank - 1]}</i></span>
      <span class="wb-u">${avatar(p.user, 24, { dot: false })}<b class="ellipsis">${esc(p.user.username)}</b></span><small>${icon('heart')} ${num(p.likeCount)}${p.coins ? ` · +${p.coins} jeton` : ''}</small></a>`).join('')}</div>`;
  box.innerHTML = `<section class="wb-hero">${egi('enler', 56)}<div><h2>Bu haftanın yıldızları</h2><p class="muted">${range(d.from, d.to)} · sıralama canlı, ${dd ? `${dd} gün ` : ''}${hh} saat sonra kapanıyor. İlk 3 gönderi ${(d.prize || [12, 8, 5]).join(', ').replace(/, (\d+)$/, ' ve $1')} jeton kazanır.</p></div></section>
    ${d.items.length ? `${podium(d.items)}${d.items.length > 3 ? `<div class="section-t"><span>Sıralamanın devamı</span></div><div class="grid ig-grid wb-grid">${d.items.slice(3).map((p) => `<div class="wb-cell"><span class="wb-rk">${p.rank}</span>${gridTile(p)}</div>`).join('')}</div>` : ''}`
    : '<div class="empty" style="padding:24px">Bu hafta henüz beğeni alan gönderi yok. İlk sen paylaş!<p><a class="btn primary" href="#/create">Paylaş</a></p></div>'}
    ${d.last.length ? `<div class="section-t"><span>Geçen haftanın kazananları</span></div>${podium(d.last)}` : ''}
    <p class="muted wb-note">Gizli hesapların gönderileri sıralamaya girmez. Puan: beğeni + yorum + yeniden paylaşım.</p>`;
  return null;
}

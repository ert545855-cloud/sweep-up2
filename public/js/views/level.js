// Seviye sistemi: puan, seviye unvanları, puan kazanma yolları, takip ettiklerin arasında sıralama
import { icon } from '../icons.js';
import { api, esc, num, avatar, nm, state } from '../core.js';
import { egi } from '../eg-icons.js';

export default async function level(view) {
  view.innerHTML = `<header class="topbar bordered"><button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/me')" aria-label="Geri">${icon('back')}</button><div class="center">Seviyen</div><span class="ib"></span></header><div class="lv-page"><div class="spinner"></div></div>`;
  const box = view.querySelector('.lv-page');
  let d; let top = [];
  try { [d, top] = await Promise.all([api('/level'), api('/level/top').catch(() => [])]); } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return null; }
  const R = 54; const C = 2 * Math.PI * R;
  box.innerHTML = `<section class="lv-hero">
      <div class="lv-ring"><svg viewBox="0 0 128 128"><circle cx="64" cy="64" r="${R}" class="tr"/><circle cx="64" cy="64" r="${R}" class="pr" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - d.progress / 100)}"/></svg>
        <div class="lv-n"><small>Seviye</small><b>${d.level}</b></div></div>
      <h2>${d.em} ${esc(d.title)}</h2>
      <p class="muted">${num(d.xp)} puan · ${d.toNext ? `sonraki seviyeye <b>${num(d.toNext)}</b> puan kaldı` : 'en üst seviyedesin'}</p>
      <div class="lv-bar"><i style="width:${d.progress}%"></i></div>
      <p class="lv-rw">${egi('odul', 22)} Sonraki seviyede <b>+${d.reward} jeton</b> hediye</p>
    </section>
    <div class="section-t"><span>Puan kazanma yolları</span><small class="muted">bugün</small></div>
    <div class="lv-ways">${d.ways.map((w) => `<div class="lv-w"><span class="grow">${esc(w.name)}</span><span class="lv-xp">+${w.xp}</span><span class="lv-cap ${w.today >= w.cap ? 'full' : ''}"><i style="width:${Math.min(100, Math.round((w.today / w.cap) * 100))}%"></i></span><small>${w.today}/${w.cap}</small></div>`).join('')}</div>
    <div class="section-t"><span>Unvanlar</span></div>
    <div class="lv-ladder">${d.ladder.map((t) => `<div class="lv-t ${t.reached ? 'on' : ''}"><span class="em">${t.em}</span><b>${esc(t.title)}</b><small>Seviye ${t.at}+</small>${t.reached ? icon('check') : icon('lock')}</div>`).join('')}</div>
    ${top.length > 1 ? `<div class="section-t"><span>Takip ettiklerin arasında</span></div>
      <div class="lv-top">${top.map((u, i) => `<a class="list-item ${u.id === state.me.id ? 'me' : ''}" href="#/u/${esc(u.username)}"><span class="lv-rank">${i + 1}</span>${avatar(u, 40, { dot: false })}<div class="grow"><div class="b">${nm(u)}</div><div class="sub">${u.lvl ? `${u.lvl.em} ${esc(u.lvl.title)}` : ''}</div></div><span class="lv-chip">Sv. ${u.lvl?.n || 1}</span></a>`).join('')}</div>` : ''}
    <p class="muted lv-note">Puanlar günlük sınırlarla verilir; sahte etkileşimle kazanılan puanlar silinebilir.</p>`;
  return null;
}

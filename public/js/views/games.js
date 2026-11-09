// Oyun salonu: Okey ve Çiz Bil masaları
import { icon } from '../icons.js';
import { api, esc, toast, state, on } from '../core.js';
import { egi } from '../eg-icons.js';

const GAMES = [
  { k: 'okey', name: 'Okey', sub: '4 kişilik klasik okey. Boş koltuklara bot oturur, arkadaşlarını çağır.', who: '4 kişi', time: '10–15 dk' },
  { k: 'cizbil', name: 'Çiz Bil', sub: 'Biri çizer, diğerleri tahmin eder. En hızlı bilen en çok puanı alır.', who: '2–8 kişi', time: '8–12 dk' },
];

export default async function games(view) {
  view.innerHTML = `<header class="topbar bordered"><button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/')" aria-label="Geri">${icon('back')}</button><div class="center">Oyunlar</div><span class="ib"></span></header>
    <div class="gm-page">${GAMES.map((g) => `<section class="gm-card gm-${g.k}" data-k="${g.k}">
      <div class="gm-top">${egi(g.k, 64)}<div class="grow"><h2>${g.name}</h2><p>${g.sub}</p><small>${icon('users')} ${g.who} · ${icon('timer')} ${g.time}</small></div></div>
      <div class="gm-cur" hidden></div>
      <div class="gm-btns"><button class="btn primary quick">Hemen oyna</button><button class="btn friends">Arkadaşlarla</button></div>
      <div class="gm-open"></div></section>`).join('')}
      <p class="muted gm-note">Oyunlar eğlence içindir; jeton ya da para ile oynanmaz. Oynadıkça seviye puanı kazanırsın.</p></div>`;
  const load = async (k) => {
    const sec = view.querySelector(`.gm-card[data-k="${k}"]`);
    let d; try { d = await api(`/games/${k}`); } catch { return; }
    const cur = sec.querySelector('.gm-cur');
    cur.hidden = !d.current; if (d.current) cur.innerHTML = `<a class="btn block gm-back" href="#/oyun/${k}/${esc(d.current)}">${icon('play')} Masana dön</a>`;
    sec.querySelector('.gm-open').innerHTML = d.open.length ? `<div class="gm-oh">Açık ${k === 'okey' ? 'masalar' : 'odalar'}</div>${d.open.map((t) => {
      const seats = k === 'okey' ? t.seats : [...t.players, ...new Array(Math.max(0, 8 - t.players.length)).fill(null)].slice(0, 8);
      const n = seats.filter((s) => s && !s.bot).length;
      return `<button class="gm-t" data-id="${esc(t.id)}"><span class="gm-av">${seats.filter(Boolean).slice(0, 4).map((s) => `<img src="${esc(s.avatar)}" alt="">`).join('')}</span><span class="grow"><b>${esc((seats.find((s) => s && !s.bot) || {}).name || 'Masa')}${k === 'okey' ? '’in masası' : '’in odası'}</b><small>${n} oyuncu${t.status === 'playing' ? ' · oyun sürüyor, bot yerine geç' : ' · bekliyor'}</small></span><span class="go-chip">Otur</span></button>`;
    }).join('')}` : '';
  };
  const go = async (k, body) => {
    try { const r = await api(`/games/${k}`, { body }); location.hash = `#/oyun/${k}/${r.id}`; } catch (e) { toast(e.message); }
  };
  view.querySelector('.gm-page').onclick = async (e) => {
    const sec = e.target.closest('.gm-card'); if (!sec) return; const k = sec.dataset.k;
    if (e.target.closest('.quick')) return go(k, { quick: true });
    if (e.target.closest('.friends')) return go(k, { private: true });
    const t = e.target.closest('.gm-t');
    if (t) { try { await api(`/games/${k}/${t.dataset.id}/join`, { body: {} }); location.hash = `#/oyun/${k}/${t.dataset.id}`; } catch (er) { toast(er.message); load(k); } }
  };
  await Promise.all(GAMES.map((g) => load(g.k)));
  state.socket?.emit('okey:watch'); state.socket?.emit('cb:lobby');
  const offs = [on('okey:lobby', () => load('okey')), on('cb:lobby', () => load('cizbil'))];
  return () => { offs.forEach((f) => f()); state.socket?.emit('okey:unwatch'); };
}

// Oyun salonu: masa oyunları, parti oyunları ve sohbette oynanan mini oyunlar
import { icon } from '../icons.js';
import { api, esc, toast, state, on, sheet } from '../core.js';
import { egi } from '../eg-icons.js';

const GAMES = [
  { k: 'okey', cat: 'masa', legacy: true, name: 'Okey', sub: '4 kişilik klasik okey. Boş koltuklara bot oturur.', who: '4 kişi', time: '10–15 dk' },
  { k: 'okey101', cat: 'masa', name: '101 Okey', sub: 'El aç, işle, 101’i geç. Cezalı klasik 101.', who: '4 kişi', time: '15–25 dk' },
  { k: 'tavla', cat: 'masa', name: 'Tavla', sub: 'Zar at, kapıları kapat, taşlarını topla. Mars 2 puan!', who: '2 kişi', time: '8–15 dk' },
  { k: 'batak', cat: 'masa', name: 'Batak', sub: 'İhaleli batak: ihaleyi al, kozu sen seç, eli kaldır.', who: '4 kişi', time: '10–15 dk' },
  { k: 'pisti', cat: 'masa', name: 'Pişti', sub: 'Yerdeki kartı aynı kartla al, tek kartta pişti yap!', who: '2 ya da 4 kişi', time: '5–10 dk' },
  { k: 'renk', cat: 'masa', name: 'Renk Eşle', sub: 'Rengi ya da sayıyı eşle, +2 ve +4’lerle rakibini zorla.', who: '2–6 kişi', time: '5–10 dk' },
  { k: 'kizma', cat: 'masa', name: 'Kızma Birader', sub: 'Zar at, 6 ile çık, rakibi eve gönder, kızma!', who: '2–4 kişi', time: '10–15 dk' },
  { k: 'cizbil', cat: 'parti', legacy: true, name: 'Çiz Bil', sub: 'Biri çizer, diğerleri tahmin eder.', who: '2–8 kişi', time: '8–12 dk' },
  { k: 'casus', cat: 'parti', name: 'Kim Casus?', sub: 'Herkes kelimeyi biliyor, biri hariç. Casusu bul!', who: '3–10 kişi', time: '8–12 dk' },
  { k: 'isimsehir', cat: 'parti', name: 'İsim Şehir', sub: 'Harf gelir, kategorileri en hızlı sen doldur.', who: '2–8 kişi', time: '8–12 dk' },
  { k: 'yasakli', cat: 'parti', name: 'Yasaklı Kelime', sub: 'Kelimeyi yasaklı kelimeleri kullanmadan anlat.', who: '2–8 kişi', time: '8–12 dk' },
  { k: 'sarki', cat: 'parti', name: 'Şarkıyı Tahmin Et', sub: 'Şarkının başı çalar, adını ilk sen bil.', who: '1–8 kişi', time: '5 dk' },
  { k: 'bilgi', cat: 'parti', name: 'Bilgi Yarışması', sub: 'Genel kültür soruları, hızlı olan kazanır.', who: '1–8 kişi', time: '5 dk' },
  { k: 'vampir', cat: 'parti', name: 'Vampir Köylü', sub: 'Gece vampirler avlanır, gündüz köy oylar.', who: '5–12 kişi', time: '15–20 dk' },
];
const MINI = [['xox', 'XOX'], ['dorttas', 'Dört Taş'], ['tkm', 'Taş Kağıt Makas'], ['amiral', 'Amiral Battı']];
const CATS = [['masa', 'Masa oyunları'], ['parti', 'Parti oyunları']];
const base = (g) => (g.legacy ? `/games/${g.k}` : `/play/${g.k}`);

export default async function games(view) {
  view.innerHTML = `<header class="topbar bordered"><button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/')" aria-label="Geri">${icon('back')}</button><div class="center">Oyunlar</div><span class="ib"></span></header>
    <div class="gm-page"><div class="gm-cur-list"></div><div class="gm-cats"><div class="spinner"></div></div>
    <section class="gm-mini"><div class="gm-ch">Sohbette oyna</div><p class="muted">Eşleştiğin ya da mesajlaştığın biriyle sohbetteki <b>+</b> menüsünden oyna.</p>
      <div class="gm-mrow">${MINI.map(([k, n]) => `<span class="gm-mi">${egi(k, 44)}<small>${n}</small></span>`).join('')}</div><a class="btn block" href="#/chats">${icon('comment')} Sohbetlere git</a></section>
    <p class="muted gm-note">Oyunlar eğlence içindir; jeton ya da para ile oynanmaz. Oynadıkça seviye puanı kazanırsın.</p></div>`;
  let info = {};
  const load = async () => {
    try { info = await api('/play'); } catch { info = {}; }
    const legacy = await Promise.all(GAMES.filter((g) => g.legacy).map((g) => api(base(g)).then((r) => [g.k, r]).catch(() => [g.k, null])));
    legacy.forEach(([k, r]) => { if (r) info[k] = { current: r.current, players: r.playing || 0 }; });
    const ready = GAMES.filter((g) => g.legacy || info[g.k]);
    view.querySelector('.gm-cats').innerHTML = CATS.map(([c, title]) => {
      const list = ready.filter((g) => g.cat === c); if (!list.length) return '';
      return `<div class="gm-ch">${title}</div><div class="gm-grid">${list.map((g) => `<button class="gm-tile" data-k="${g.k}">${egi(g.k, 52)}<b>${esc(g.name)}</b><small>${esc(g.who)}</small>${info[g.k]?.current ? '<i class="gm-mine">Masan açık</i>' : info[g.k]?.players ? `<i class="gm-live">${info[g.k].players} oynuyor</i>` : ''}</button>`).join('')}</div>`;
    }).join('');
    const cur = ready.filter((g) => info[g.k]?.current);
    view.querySelector('.gm-cur-list').innerHTML = cur.map((g) => `<a class="gm-back" href="#/oyun/${g.k}/${esc(info[g.k].current)}">${egi(g.k, 30)}<span class="grow"><b>${esc(g.name)}</b><small>Masana dön</small></span>${icon('play')}</a>`).join('');
  };
  const detail = (g) => sheet(null, `<div class="gm-d">${egi(g.k, 72)}<h2>${esc(g.name)}</h2><p>${esc(g.sub)}</p><small class="muted">${icon('users')} ${esc(g.who)} · ${icon('timer')} ${esc(g.time)}</small>
      ${info[g.k]?.current ? `<a class="btn block" href="#/oyun/${g.k}/${esc(info[g.k].current)}">${icon('play')} Masana dön</a>` : ''}
      <div class="gm-btns"><button class="btn primary quick">Hemen oyna</button><button class="btn friends">Arkadaşlarla</button></div>
      <div class="gm-open"><div class="spinner"></div></div></div>`, {
    async onMount(sh, close) {
      const go = async (body) => { try { const r = await api(base(g), { body }); close(); location.hash = `#/oyun/${g.k}/${r.id}`; } catch (e) { toast(e.message); } };
      sh.querySelector('.quick').onclick = () => go({ quick: true });
      sh.querySelector('.friends').onclick = () => go({ private: true });
      const box = sh.querySelector('.gm-open');
      let d; try { d = await api(base(g)); } catch { box.innerHTML = ''; return; }
      box.innerHTML = d.open.length ? `<div class="gm-oh">Açık masalar</div>${d.open.map((t) => {
        const seats = t.seats || [...(t.players || [])]; const people = seats.filter((s) => s && !s.bot);
        return `<button class="gm-t" data-id="${esc(t.id)}"><span class="gm-av">${seats.filter(Boolean).slice(0, 4).map((s) => `<img src="${esc(s.avatar)}" alt="">`).join('')}</span><span class="grow"><b>${esc(people[0]?.name || 'Masa')}</b><small>${people.length} oyuncu${t.status === 'playing' ? ' · oyun sürüyor, bot yerine geç' : ' · bekliyor'}</small></span><span class="go-chip">Otur</span></button>`;
      }).join('')}` : '';
      box.onclick = async (e) => {
        const t = e.target.closest('.gm-t'); if (!t) return;
        try { await api(`${base(g)}/${t.dataset.id}/join`, { body: {} }); close(); location.hash = `#/oyun/${g.k}/${t.dataset.id}`; } catch (er) { toast(er.message); }
      };
    },
  });
  view.querySelector('.gm-cats').onclick = (e) => { const b = e.target.closest('.gm-tile'); if (b) detail(GAMES.find((g) => g.k === b.dataset.k)); };
  await load();
  state.socket?.emit('okey:watch'); state.socket?.emit('cb:lobby'); state.socket?.emit('play:watch');
  let t = 0; const later = () => { clearTimeout(t); t = setTimeout(load, 800); };
  const offs = [on('okey:lobby', later), on('cb:lobby', later), on('play:lobby', later)];
  return () => { offs.forEach((f) => f()); clearTimeout(t); state.socket?.emit('okey:unwatch'); state.socket?.emit('play:unwatch'); };
}

// Öne çıkar (reklam ver) ve öne çıkarmalarım
import { icon } from '../icons.js';
import { api, esc, toast, state, needCoins, ago, emit } from '../core.js';

const ST = { active: ['ok', 'Yayında'], done: ['', 'Bitti'], stopped: ['', 'Durduruldu'], stopped_admin: ['bad', 'Yönetim durdurdu'] };
const fmt = (n) => Number(n || 0).toLocaleString('tr-TR');

export default async function promote(view, postId) {
  if (postId) return create(view, postId);
  view.innerHTML = `<header class="topbar"><a class="ib" href="#/me" aria-label="Geri">${icon('back')}</a><div class="center">Öne çıkarmalarım</div><span class="ib"></span></header><div class="pro"><div class="spinner"></div></div>`;
  const box = view.querySelector('.pro');
  const load = async () => {
    const list = await api('/promos');
    box.innerHTML = `<section class="pro-hero"><span>🚀</span><div><b>Gönderilerini öne çıkar</b><small>Jeton ayırdığın gönderi ya da vitrin videon ana akışta ve Vitrin’de “Sponsorlu” olarak daha çok kişiye gösterilir. Bütçe arttıkça gösterim artar.</small></div></section>
      <p class="muted" style="font-size:13px;margin:0 2px">Öne çıkarmak için profilindeki bir gönderinin ⋯ menüsünden ya da Vitrin’deki kendi videondan <b>Öne çıkar</b>’a dokun.</p>
      ${list.length ? list.map((p) => `<div class="pro-it" data-id="${esc(p.id)}">
        <a class="pro-th" href="#/${p.type === 'reel' ? 'vitrin' : 'p'}/${esc(p.postId)}">${p.post?.image ? `<img src="${esc(p.post.image)}" alt="">` : `<span>${icon('reels')}</span>`}</a>
        <div class="grow"><div class="row" style="justify-content:space-between;gap:8px"><b>${p.type === 'reel' ? 'Vitrin videosu' : 'Gönderi'}</b><span class="pill ${ST[p.status]?.[0] || ''}">${ST[p.status]?.[1] || p.status}</span></div>
          <div class="pro-bar"><i style="width:${Math.min(100, (p.shown / p.impressions) * 100)}%"></i></div>
          <div class="pro-st"><span><b>${fmt(p.shown)}</b> / ${fmt(p.impressions)} gösterim</span><span><b>${fmt(p.reach)}</b> kişi</span><span><b>${fmt(p.hits)}</b> etkileşim</span><span><b>+${fmt(p.likesGained)}</b> beğeni</span></div>
          <small class="muted">${fmt(p.coins)} jeton · ${p.days} gün · ${p.status === 'active' ? `bitiş ${new Date(p.end).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : `${ago(p.endedAt || p.end, true)}${p.refunded ? ` · ${p.refunded} jeton iade` : ''}`}${p.reason ? ` · ${esc(p.reason)}` : ''}</small>
          ${p.status === 'active' ? '<button class="link pro-stop">Durdur (kalan jeton iade edilir)</button>' : ''}</div></div>`).join('') : '<div class="empty" style="padding:24px">Henüz öne çıkardığın bir şey yok.</div>'}
      <div style="height:30px"></div>`;
  };
  box.onclick = async (e) => {
    const b = e.target.closest('.pro-stop'); if (!b) return;
    if (!confirm('Öne çıkarma durdurulsun mu? Kullanılmayan jetonlar iade edilir.')) return;
    try { await api(`/promos/${b.closest('[data-id]').dataset.id}/stop`, { body: {} }); toast('Durduruldu.'); load(); } catch (er) { toast(er.message); }
  };
  await load();
  return null;
}

async function create(view, postId) {
  view.innerHTML = `<header class="topbar"><button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/reklam')" aria-label="Geri">${icon('back')}</button><div class="center">Öne çıkar</div><span class="ib"></span></header><div class="pro"><div class="spinner"></div></div>`;
  const box = view.querySelector('.pro');
  let post; let c;
  try { [post, c] = await Promise.all([api(`/posts/${postId}`), api('/promos/config')]); } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return null; }
  if (!c.enabled) { box.innerHTML = '<div class="empty">Öne çıkarma şu an kapalı.</div>'; return null; }
  if (c.private) { box.innerHTML = `<div class="empty"><div class="big">${icon('lock')}</div><h2>Hesabın gizli</h2>Gizli hesapların gönderileri öne çıkarılamaz. Ayarlar’dan hesabını herkese açık yapabilirsin.<p><a class="btn primary" href="#/settings">Ayarlar</a></p></div>`; return null; }
  const img = post.items?.[0]?.poster || (post.items?.[0]?.type === 'video' ? null : post.items?.[0]?.media) || post.poster;
  const steps = [c.minCoins, 50, 100, 200, 500, 1000, 2000, c.maxCoins].filter((v, i, a) => v >= c.minCoins && v <= c.maxCoins && a.indexOf(v) === i).sort((a, b) => a - b);
  let coins = steps[Math.min(2, steps.length - 1)]; let days = 1;
  const target = { gender: 'all', city: '', ageMin: 18, ageMax: 99 };
  box.innerHTML = `<div class="pro-prev">${img ? `<img src="${esc(img)}" alt="">` : `<span>${icon('reels')}</span>`}<div><b>${post.type === 'reel' ? 'Vitrin videon' : 'Gönderin'}</b><small>${esc((post.caption || '').slice(0, 90)) || 'Açıklama yok'}</small><em>Sponsorlu olarak gösterilir</em></div></div>
    <h3 class="shop-h">Bütçe</h3>
    <div class="pro-coins"><b class="pc">${coins}</b> jeton</div>
    <input type="range" class="pro-r" min="0" max="${steps.length - 1}" step="1" value="${steps.indexOf(coins)}">
    <div class="pro-est"></div>
    <h3 class="shop-h">Süre</h3>
    <div class="seg pro-days">${[1, 3, 7].map((d) => `<button data-d="${d}" class="${d === days ? 'on' : ''}">${d} gün</button>`).join('')}</div>
    <h3 class="shop-h">Kime gösterilsin</h3>
    <div class="seg pro-g">${[['all', 'Herkes'], ['k', 'Kadınlar'], ['e', 'Erkekler']].map(([k, l]) => `<button data-g="${k}" class="${k === 'all' ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="form" style="padding:10px 0 0;gap:10px">
      <input class="field pro-city" maxlength="40" placeholder="Şehir (boş bırakırsan tüm Türkiye)">
      <div class="row" style="gap:8px"><input class="field pro-a1" type="number" min="18" max="99" value="18" aria-label="En küçük yaş"><span class="muted">–</span><input class="field pro-a2" type="number" min="18" max="99" value="99" aria-label="En büyük yaş"><span class="muted" style="white-space:nowrap">yaş</span></div>
    </div>
    <div class="pro-sum"></div>
    <button class="btn primary block pro-go">🚀 Öne çıkar</button>
    <p class="muted" style="font-size:12px;margin:8px 2px 30px">Jeton başta ayrılır. Süre dolduğunda ya da durdurduğunda kullanılmayan gösterimlerin jetonu iade edilir. Öne çıkan içerik “Sponsorlu” etiketiyle gösterilir; topluluk kurallarına aykırı içerikler yönetim tarafından durdurulabilir.</p>`;
  const paint = () => {
    const imp = coins * c.impPerCoin;
    box.querySelector('.pc').textContent = fmt(coins);
    box.querySelector('.pro-est').innerHTML = `≈ <b>${fmt(imp)}</b> gösterim · günde ≈ ${fmt(Math.round(imp / days))}`;
    box.querySelector('.pro-sum').innerHTML = `<div><span>Bakiye</span><b>${fmt(c.coins)} jeton</b></div><div><span>Harcanacak</span><b>${fmt(coins)} jeton</b></div>${c.coins < coins ? '<p class="warn">Jetonun yetmiyor; öne çıkar’a basınca jeton alabilirsin.</p>' : ''}`;
  };
  box.querySelector('.pro-r').oninput = (e) => { coins = steps[+e.target.value]; paint(); };
  box.querySelector('.pro-days').onclick = (e) => { const b = e.target.closest('[data-d]'); if (!b) return; days = +b.dataset.d; box.querySelectorAll('.pro-days button').forEach((x) => x.classList.toggle('on', x === b)); paint(); };
  box.querySelector('.pro-g').onclick = (e) => { const b = e.target.closest('[data-g]'); if (!b) return; target.gender = b.dataset.g; box.querySelectorAll('.pro-g button').forEach((x) => x.classList.toggle('on', x === b)); };
  box.querySelector('.pro-go').onclick = async (e) => {
    target.city = box.querySelector('.pro-city').value; target.ageMin = +box.querySelector('.pro-a1').value; target.ageMax = +box.querySelector('.pro-a2').value;
    e.target.disabled = true;
    try {
      await api('/promos', { body: { postId, coins, days, target } });
      state.me.coins = (state.me.coins || 0) - coins; emit('me', state.me);
      toast('🚀 Öne çıkarma başladı!'); location.hash = '#/reklam';
    } catch (er) { if (er.status === 402) needCoins(er.message); else toast(er.message); e.target.disabled = false; }
  };
  paint();
  return null;
}

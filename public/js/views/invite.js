import { icon } from '../icons.js';
import { api, esc, toast, avatar, nm } from '../core.js';

export default async function invite(view) {
  view.innerHTML = `<header class="topbar"><button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/me')" aria-label="Geri">${icon('back')}</button><div class="center">Davet et, kazan</div><span class="ib"></span></header><div class="invite"><div class="spinner"></div></div>`;
  const box = view.querySelector('.invite');
  const r = await api('/invite');
  const link = `${location.origin}/?ref=${r.code}#/register`;
  box.innerHTML = `<section class="inv-hero"><div class="inv-gift">${icon('gift')}</div><h2>Arkadaşını getir, ikiniz de ${r.coins} jeton kazanın</h2>
      <p class="muted">Arkadaşın bağlantınla kayıt olup profiline fotoğraf eklediğinde jetonlar ikinize de yüklenir.</p>
      <div class="inv-code"><small>Davet kodun</small><b>${esc(r.code)}</b></div>
      <div class="inv-btns"><button class="btn primary sh">${icon('share')} Paylaş</button><button class="btn cp">${icon('link')} Bağlantıyı kopyala</button></div></section>
    <h3 class="shop-h">Davet ettiklerin <span class="muted">${r.items.length ? `· ${r.rewarded} ödül` : ''}</span></h3>
    ${r.items.length ? r.items.map((u) => `<a class="list-item" href="#/u/${esc(u.username)}">${avatar(u, 40, { dot: false })}<div class="grow"><div class="b">${nm(u)}</div><div class="sub">${u.rewarded ? `+${r.coins} jeton kazandın` : 'Fotoğraf eklemesi bekleniyor'}</div></div>${u.rewarded ? '<span class="pill ok">Kazanıldı</span>' : '<span class="pill">Bekliyor</span>'}</a>`).join('') : '<div class="empty" style="padding:16px">Henüz kimseyi davet etmedin.</div>'}
    <p class="muted" style="font-size:12px;margin:18px 4px">Aynı ağdan açılan birden fazla hesap ve ayda 30’dan fazla davet ödül kazandırmaz.</p>`;
  const text = `SwipeUp’ta tanışalım! Bu bağlantıyla kayıt olursan ikimiz de ${r.coins} jeton kazanıyoruz: ${link}`;
  box.querySelector('.cp').onclick = async () => { try { await navigator.clipboard.writeText(link); toast('Bağlantı kopyalandı.'); } catch { prompt('Bağlantı', link); } };
  box.querySelector('.sh').onclick = () => (navigator.share ? navigator.share({ title: 'SwipeUp', text }).catch(() => {}) : box.querySelector('.cp').click());
}

import { icon } from '../icons.js';
import {
  api, esc, toast, sheet, ago, avatar, nm, on,
} from '../core.js';

const TL = (n) => `${Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
const REASON = { purchase: 'Jeton satın alma', gift: 'Canlı yayın hediyesi', fal: 'Fal', boost: 'Boost', admin: 'SwipeUp hediyesi', promo: 'Öne çıkarma', promo_refund: 'Öne çıkarma iadesi', quest: 'Günlük görev', quest_bonus: 'Görev bonusu', invite: 'Davet ödülü', super_msg: 'Süper mesaj', frame: 'Profil çerçevesi', badge: 'Etkinlik rozeti', fal_sub: 'Fal aboneliği', wheel: 'Hediye çarkı', streak: 'Sohbet serisi ödülü', login_streak: 'Giriş serisi ödülü', streak_freeze: 'Seri koruyucu', level: 'Seviye ödülü', weekly_best: 'Haftanın enleri', contest: 'Yarışma ödülü', fal_pack: 'Fal paketi', kupa_look: 'Kostüm', kupa_season: 'Parti Kupası ligi' };
const why = (t) => (t.reason === 'gift' && t.chat ? 'Sohbet hediyesi' : REASON[t.reason] || t.reason);
const PST = { pending: 'Bekliyor', paid: 'Ödendi', rejected: 'Reddedildi' };

export default async function wallet(view) {
  view.innerHTML = `<header class="topbar"><button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/me')" aria-label="Geri">${icon('back')}</button><div class="center">Kazançlarım</div><a class="ib soft" href="#/store" aria-label="Mağaza">${icon('coin')}</a></header>
    <div class="shop"><div class="spinner"></div></div>`;
  const box = view.querySelector('.shop');
  const load = async () => {
    const w = await api('/wallet');
    box.innerHTML = `
      <section class="wallet-card">
        <div><small>Jeton bakiyen</small><b>${icon('coin')} ${w.coins.toLocaleString('tr-TR')}</b><span><a class="link" href="#/store">Jeton al</a></span></div>
        <div class="on"><small>Kazancın</small><b>${icon('gift')} ${TL(w.earningsTL)}</b><span>Ödeme talep edilebilir: ${TL(100)} ve üstü</span></div>
      </section>
      <p class="muted" style="font-size:13.5px;margin:2px 2px 12px">1 jeton = 1 ₺. Canlı yayında ve sohbette sana hediye edilen her 1 jeton için kazancına ${TL(w.perCoinTL)} eklenir. Bu yalnızca satın alınmış jetonlar için geçerli; görev, çark ve davet gibi ödüllerden gelen bedava jetonlarla gönderilen hediyeler kazanca eklenmez. Kazancın ${TL(100)} olunca ödeme talep edebilirsin.</p>
      <button class="btn primary block po" ${w.earningsTL >= 100 ? '' : 'disabled'}>Ödeme talep et</button>
      ${w.payouts.length ? `<h3 class="shop-h">Ödeme taleplerim</h3><div class="orders">${w.payouts.map((p) => `<div class="order"><span class="grow"><b>${TL(p.amount)}</b><small>${esc(p.iban.slice(0, 6))}… · ${ago(p.at, true)}</small></span><span class="st ${p.status === 'paid' ? 'ok' : p.status === 'pending' ? 'wait' : 'bad'}">${PST[p.status]}</span></div>`).join('')}</div>` : ''}
      <h3 class="shop-h">Gelen hediyeler</h3>
      ${w.earned.length ? `<div>${w.earned.map((t) => `<div class="list-item">${t.from ? avatar(t.from, 36, { dot: false }) : `<span class="ic-c">${icon('gift')}</span>`}<div class="grow"><div class="b">${t.from ? nm(t.from, 'username') : esc(why(t))}</div><div class="sub">${esc(why(t))} · ${ago(t.at, true)}</div></div><b class="plus-amt">${t.coins > 0 ? `+${TL(t.coins * w.coinTL)}` : 'Bedava jeton'}</b></div>`).join('')}</div>` : '<div class="empty" style="padding:16px">Henüz hediye almadın. Canlı yayın aç, takipçilerin seni desteklesin.</div>'}
      <h3 class="shop-h">Jeton hareketleri</h3>
      ${w.tx.length ? `<div>${w.tx.map((t) => `<div class="list-item"><span class="ic-c">${icon(t.delta > 0 ? 'coin' : 'gift')}</span><div class="grow"><div class="b">${esc(why(t))}</div><div class="sub">${ago(t.at, true)}</div></div><b class="${t.delta > 0 ? 'plus-amt' : 'minus-amt'}">${t.delta > 0 ? '+' : ''}${t.delta}</b></div>`).join('')}</div>` : '<div class="empty" style="padding:16px">Henüz hareket yok.</div>'}
      <div style="height:30px"></div>`;
    box.querySelector('.po').onclick = () => sheet('Ödeme talebi', `<form class="form"><p style="margin:0">${TL(w.earningsTL)} tutarındaki kazancın IBAN’ına gönderilecek. Talep sonrası bakiyen sıfırlanır; reddedilirse geri eklenir.</p>
      <input class="field" name="n" maxlength="60" placeholder="Hesap sahibinin adı soyadı" autocomplete="name">
      <input class="field" name="i" maxlength="34" placeholder="TR00 0000 0000 0000 0000 0000 00" inputmode="text" autocapitalize="characters">
      <button class="btn primary block">Talep gönder</button></form>`, {
      onMount(sh, close) {
        const f = sh.querySelector('form');
        f.onsubmit = async (e) => {
          e.preventDefault();
          try { await api('/payouts', { body: { name: f.n.value, iban: f.i.value } }); close(); toast('Talebin alındı. Ödeme yapılınca bildirim alacaksın.'); load(); } catch (er) { toast(er.message); }
        };
      },
    });
  };
  await load();
  return on('wallet', load);
}

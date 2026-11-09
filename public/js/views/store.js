import { icon } from '../icons.js';
import {
  api, esc, toast, sheet, state, on, refreshBadges,
} from '../core.js';

const TL = (n) => `${Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
const date = (t) => new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
const STATUS = {
  pending: ['Ödeme bekleniyor', 'wait'], paid: ['Onay bekleniyor', 'wait'], approved: ['Tamamlandı', 'ok'], rejected: ['Onaylanmadı', 'bad'], cancelled: ['İptal edildi', 'bad'],
};
const groupIban = (s) => String(s || '').replace(/(.{4})/g, '$1 ').trim();

export function paySheet(order, onDone) {
  const b = order.bank || {};
  const close = sheet('Havale / EFT ile öde', `<div class="pay">
    <div class="pay-sum"><span>${esc(order.title)}</span><b>${TL(order.amount)}</b></div>
    <ol class="pay-steps">
      <li>Aşağıdaki hesaba <b>${TL(order.amount)}</b> gönder.</li>
      <li>Açıklama kısmına <b>sipariş kodunu</b> yaz.</li>
      <li>“Ödemeyi yaptım”a dokun. Ödeme hesabımıza ulaşınca onaylanır ve hesabına tanımlanır.</li>
    </ol>
    <div class="pay-row"><small>Sipariş kodu</small><b class="mono">${esc(order.code)}</b><button class="ib cp" data-v="${esc(order.code)}" aria-label="Kopyala">${icon('copy')}</button></div>
    <div class="pay-row"><small>IBAN</small><b class="mono">${esc(groupIban(b.iban))}</b><button class="ib cp" data-v="${esc(b.iban)}" aria-label="Kopyala">${icon('copy')}</button></div>
    <div class="pay-row"><small>Alıcı</small><b>${esc(b.name || '-')}</b>${b.name ? `<button class="ib cp" data-v="${esc(b.name)}" aria-label="Kopyala">${icon('copy')}</button>` : ''}</div>
    ${b.bankName ? `<div class="pay-row"><small>Banka</small><b>${esc(b.bankName)}</b></div>` : ''}
    ${b.note ? `<p class="muted" style="font-size:13px;margin:4px 2px">${esc(b.note)}</p>` : ''}
    ${order.status === 'pending' ? `<form class="form" style="padding:6px 0 0"><input class="field" name="s" maxlength="60" placeholder="Gönderen ad soyad (hesap sahibi)" autocomplete="name">
      <button class="btn primary block">Ödemeyi yaptım</button>
      <button type="button" class="btn block cancel" style="background:transparent">Siparişi iptal et</button></form>`
    : `<div class="note-box">${order.status === 'paid' ? 'Bildirimin alındı. Ödemen kontrol edilince jetonların/üyeliğin hesabına eklenecek ve bildirim alacaksın.' : esc(STATUS[order.status]?.[0] || '')}</div>`}
  </div>`, {
    onMount(sh) {
      sh.querySelectorAll('.cp').forEach((bt) => { bt.onclick = async () => { await navigator.clipboard?.writeText(bt.dataset.v); toast('Kopyalandı.'); }; });
      const f = sh.querySelector('form');
      if (!f) return;
      f.onsubmit = async (e) => {
        e.preventDefault();
        try { await api(`/orders/${order.id}/paid`, { body: { sender: f.s.value } }); close(); toast('Teşekkürler! Ödemen kontrol edilince bildirim alacaksın.', { ms: 5000 }); onDone?.(); } catch (er) { toast(er.message); }
      };
      f.querySelector('.cancel').onclick = async () => {
        if (!confirm('Sipariş iptal edilsin mi?')) return;
        try { await api(`/orders/${order.id}`, { method: 'DELETE' }); close(); toast('Sipariş iptal edildi.'); onDone?.(); } catch (er) { toast(er.message); }
      };
    },
  });
}

export default async function store(view) {
  view.innerHTML = `<header class="topbar"><button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/me')" aria-label="Geri">${icon('back')}</button><div class="center">Mağaza</div><a class="ib soft" href="#/wallet" aria-label="Kazançlarım">${icon('gift')}</a></header>
    <div class="shop"><div class="spinner"></div></div>`;
  const box = view.querySelector('.shop');
  const load = async () => {
    const s = await api('/store');
    state.me.coins = s.coins; state.me.plus = s.plus;
    box.innerHTML = `
      <section class="wallet-card">
        <div><small>Jeton bakiyen</small><b>${icon('coin')} ${s.coins.toLocaleString('tr-TR')}</b></div>
        <div class="${s.plus ? 'on' : ''}"><small>Üyelik</small><b>${s.plus ? `${icon('crown')} SwipeUp+` : 'Ücretsiz'}</b>${s.plus ? `<span>${date(s.plusUntil)} tarihine kadar</span>` : `<span>Bugün ${s.quota.likesLeft ?? '∞'} beğeni · ${s.quota.supersLeft} süper hakkın kaldı</span>`}</div>
      </section>
      ${s.payEnabled ? '' : '<div class="note-box">Ödeme sistemi çok yakında açılıyor. O zamana kadar ücretsiz özellikleri kullanmaya devam edebilirsin.</div>'}
      <h3 class="shop-h">${icon('crown')} SwipeUp+</h3>
      <ul class="perks compact">
        <li>${icon('heart')}<span>Sınırsız beğeni <small>(ücretsiz: günde ${s.freeLikes})</small></span></li>
        <li>${icon('eye')}<span>Seni beğenenleri gör</span></li>
        <li>${icon('undo')}<span>Son kaydırmanı geri al</span></li>
        <li>${icon('star')}<span>Günde ${s.plusSupers} süper beğeni <small>(ücretsiz: ${s.freeSupers})</small></span></li>
        <li>${icon('bolt')}<span>Haftada 1 ücretsiz boost</span></li>
      </ul>
      <div class="plans">${s.plusPlans.map((p) => `<button class="plan" data-p="${esc(p.id)}" ${s.payEnabled ? '' : 'disabled'}>
        ${p.tag ? `<span class="tag">${esc(p.tag)}</span>` : ''}<b>${p.days >= 30 && p.days % 30 === 0 ? `${p.days / 30} ay` : `${p.days} gün`}</b><span class="price">${TL(p.price)}</span><small>${TL(p.price / Math.max(1, p.days / 30))} / ay</small></button>`).join('')}</div>
      <h3 class="shop-h">${icon('coin')} Jeton</h3>
      <p class="muted" style="margin:-4px 2px 10px;font-size:14px">Canlı yayınlarda hediye gönder, Falcı Teyze’ye fal baktır, boost ile öne çık.</p>
      <div class="packs" style="--cols:${s.coinPacks.length === 4 || s.coinPacks.length < 3 ? 2 : 3}">${s.coinPacks.map((p) => `<button class="pack" data-p="${esc(p.id)}" ${s.payEnabled ? '' : 'disabled'}>${p.tag ? `<span class="tag">${esc(p.tag)}</span>` : ''}
        <span class="coins">${icon('coin')}${p.coins.toLocaleString('tr-TR')}</span><span class="price">${TL(p.price)}</span></button>`).join('')}</div>
      <div class="uses">
        <div>${icon('gift')}<span><b>Hediyeler</b>${s.gifts.slice(0, 4).map((g) => `${g.em} ${g.coins}`).join(' · ')}…</span></div>
        <div>${icon('star')}<span><b>Fal</b>Kahve ${s.falPrices.kahve} · Tarot ${s.falPrices.tarot} · Burç ${s.falPrices.burc} · Uyum ${s.falPrices.uyum} jeton</span></div>
        <div>${icon('bolt')}<span><b>Boost</b>${s.boostCoins} jeton · ${s.boostMinutes} dakika en üstte</span></div>
      </div>
      ${s.orders.length ? `<h3 class="shop-h">Siparişlerim</h3><div class="orders">${s.orders.map((o) => `<button class="order" data-o="${esc(o.id)}">
        <span class="grow"><b>${esc(o.title)}</b><small>${esc(o.code)} · ${date(o.at)}</small></span><span class="amt">${TL(o.amount)}</span><span class="st ${STATUS[o.status][1]}">${STATUS[o.status][0]}</span></button>`).join('')}</div>` : ''}
      <p class="muted" style="font-size:12.5px;margin:18px 2px 30px">Ödemeler havale/EFT ile alınır. Jetonlar nakde çevrilemez. Ayrıntılar için <a class="link" href="#/legal/kosullar">Kullanım koşulları</a>.</p>`;
    box.querySelectorAll('[data-p]').forEach((b) => {
      b.onclick = async () => {
        try { const o = await api('/orders', { body: { productId: b.dataset.p } }); paySheet(o, load); load(); } catch (er) { toast(er.message); }
      };
    });
    box.querySelectorAll('[data-o]').forEach((b) => {
      b.onclick = async () => { try { paySheet(await api(`/orders/${b.dataset.o}`), load); } catch (er) { toast(er.message); } };
    });
  };
  await load();
  const off = on('wallet', () => { load(); refreshBadges(); });
  return off;
}

// SwipeUp Store: ikinci el al-sat. Komisyon yok; kargolu siparişlerde ödeme SwipeUp güvencesinde bekler.
import { icon } from '../icons.js';
import {
  state, api, esc, on, toast, sheet, ago, nm, pickFile, prepareImage, uploadPrepared, openChatWith, el,
} from '../core.js';

let META = null;
const getMeta = async (force) => { if (!META || force) META = await api('/market/meta'); return META; };
const price = (n) => `${Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺`;
const catOf = (id) => META?.categories.find((c) => c.id === id);
const condOf = (id) => META?.conditions.find((c) => c.id === id)?.name || '';
const stars = (r) => (r == null ? '' : `<span class="mk-stars" aria-label="${r} yıldız">${'★'.repeat(Math.round(r))}${'☆'.repeat(5 - Math.round(r))}</span>`);
const back = (fallback = '#/market') => `<button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '${fallback}')" aria-label="Geri">${icon('back')}</button>`;
const STATUS_TONE = {
  odeme_bekliyor: 'warn', odeme_kontrol: 'warn', odendi: 'info', kargoda: 'info', bulusma: 'info', teslim_onay: 'warn',
  sorunlu: 'bad', iade_bekliyor: 'bad', iade_edildi: 'mute', tamamlandi: 'ok', iptal: 'mute',
};

// Fotoğraf çek / seç ve yükle
async function takePhoto(capture, onPicked) {
  const f = await pickFile('image/*', capture ? 'environment' : undefined);
  if (!f) return null;
  onPicked?.();
  const p = await prepareImage(f);
  return (await uploadPrepared(p)).url;
}

function card(it) {
  return `<a class="mk-card" href="#/market/i/${esc(it.id)}">
    <div class="ph"><img src="${esc(it.photo)}" alt="" loading="lazy">${it.status === 'reserved' ? '<span class="tag">Rezerve</span>' : it.status === 'sold' ? '<span class="tag sold">Satıldı</span>' : ''}
      ${it.fav ? `<span class="fv">${icon('heart')}</span>` : ''}</div>
    <div class="tx"><b>${price(it.price)}</b><span class="ellipsis">${esc(it.title)}</span>
      <small class="ellipsis">${[it.city, condOf(it.condition)].filter(Boolean).map(esc).join(' · ')}</small>
      <span class="dl">${it.ship ? `<i title="Kargo">${icon('truck')}</i>` : ''}${it.hand ? `<i title="Elden teslim">${icon('hand')}</i>` : ''}</span></div></a>`;
}

export default async function market(view, sub, id) {
  view.innerHTML = '<div class="spinner"></div>';
  try { await getMeta(); } catch (e) { view.innerHTML = `<div class="empty"><h2>Store açılamadı</h2>${esc(e.message)}</div>`; return null; }
  const pages = { c: home, i: item, new: editor, edit: editor, o: order, orders, mine, favs, balance, u: home };
  if (sub && !pages[sub]) { location.hash = '#/market'; return null; }
  return (pages[sub] || home)(view, sub, id);
}

// ================= Vitrin =================
function home(view, sub, id) {
  const f = { q: '', cat: sub === 'c' ? id : '', sort: 'new', min: '', max: '', cond: '', city: '', ship: false, hand: false, seller: sub === 'u' ? id : '' };
  let page = 0;
  let hideInfo = false; try { hideInfo = localStorage.getItem('su_mk_info') === '1'; } catch {}
  view.innerHTML = `<header class="topbar mk-top">${back('#/')}
      <div class="mk-brand">${icon('bag')}<b>SwipeUp <span>Store</span></b></div>
      <a class="ib" href="#/market/favs" aria-label="Favoriler">${icon('heart')}</a>
      <a class="ib" href="#/market/orders" aria-label="Siparişlerim">${icon('box')}${META.action ? `<span class="num-badge">${META.action}</span>` : ''}</a></header>
    <div class="mk-search"><div class="sw">${icon('search')}<input class="field" type="search" placeholder="Ne arıyorsun?" enterkeyhint="search"></div>
      <button class="ib soft mk-filter" aria-label="Filtrele">${icon('sliders')}</button></div>
    ${f.seller ? '<div class="mk-seller-h"></div>' : ''}
    ${hideInfo || f.seller ? '' : `<div class="mk-trust"><span class="sh">${icon('shield')}</span><div class="grow"><b>Güvenli al, komisyonsuz sat</b>
      <span>Kargolu alışverişte ödemen ürün eline ulaşıp onaylayana kadar SwipeUp’ta bekler. Satıştan komisyon alınmaz.</span></div><button class="x" aria-label="Kapat">✕</button></div>`}
    <div class="mk-cats"><button data-c="" class="${f.cat ? '' : 'on'}"><span>✨</span>Tümü</button>${META.categories.map((c) => `<button data-c="${c.id}" class="${f.cat === c.id ? 'on' : ''}"><span>${c.em}</span>${esc(c.name)}</button>`).join('')}</div>
    <div class="mk-bar"><span class="cnt muted"></span><div class="mk-sort">${[['new', 'En yeni'], ['cheap', 'En ucuz'], ['pricey', 'En pahalı'], ['popular', 'Popüler']].map(([k, l]) => `<button data-s="${k}" class="${k === 'new' ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="mk-grid"></div><div class="mk-more"></div>
    <div class="mk-quick">
      <a class="mk-q" href="#/market/mine">${icon('tagPrice')}<span>İlanlarım</span></a>
      <a class="mk-q" href="#/market/balance">${icon('wallet')}<span>${price(META.balance)}</span></a>
    </div>
    <a class="mk-sell" href="#/market/new">${icon('plus')}<span>Sat</span></a>`;
  const grid = view.querySelector('.mk-grid');
  const more = view.querySelector('.mk-more');
  const qs = () => new URLSearchParams(Object.entries({ q: f.q, cat: f.cat, sort: f.sort, min: f.min, max: f.max, cond: f.cond, city: f.city, ship: f.ship ? 1 : '', hand: f.hand ? 1 : '', seller: f.seller, page }).filter(([, v]) => v !== '' && v !== false)).toString();
  let tok = 0;
  const load = async (append) => {
    const my = ++tok;
    if (!append) { page = 0; grid.innerHTML = '<div class="spinner" style="grid-column:1/-1"></div>'; }
    try {
      const r = await api('/market/items?' + qs());
      if (my !== tok) return;
      if (!append) grid.innerHTML = '';
      grid.insertAdjacentHTML('beforeend', r.items.map(card).join(''));
      view.querySelector('.cnt').textContent = `${r.total} ilan`;
      if (!r.total) {
        grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="big">${icon('bag')}</div><h2>${f.q || f.cat || f.cond ? 'Sonuç yok' : 'Henüz ilan yok'}</h2>${f.q || f.cat ? 'Filtreleri değiştirip tekrar dene.' : 'Kullanmadığın eşyaları sat, ilk ilanı sen ver.'}
          <p><a class="btn primary" href="#/market/new">${icon('plus')} İlan ver</a></p></div>`;
      }
      more.innerHTML = (page + 1) * 30 < r.total ? '<button class="btn outline block">Daha fazla göster</button>' : '';
      more.querySelector('button')?.addEventListener('click', () => { page++; load(true); });
    } catch (e) { grid.innerHTML = `<div class="empty" style="grid-column:1/-1">${esc(e.message)}</div>`; }
  };
  if (f.seller) {
    api(`/users/${encodeURIComponent(f.seller)}`).then((u) => {
      view.querySelector('.mk-seller-h').innerHTML = `<img class="av av-44" src="${esc(u.avatar)}" alt=""><div class="grow"><b>${nm(u)}</b><span class="muted">kullanıcısının ilanları</span></div><a class="btn sm" href="#/u/${esc(u.username)}">Profil</a>`;
    }).catch(() => {});
  }
  let dt = null;
  const input = view.querySelector('.mk-search input');
  input.addEventListener('input', () => { clearTimeout(dt); dt = setTimeout(() => { f.q = input.value.trim(); load(); }, 300); });
  view.querySelector('.mk-trust .x')?.addEventListener('click', (e) => { e.currentTarget.closest('.mk-trust').remove(); try { localStorage.setItem('su_mk_info', '1'); } catch {} });
  view.querySelector('.mk-cats').onclick = (e) => {
    const b = e.target.closest('[data-c]'); if (!b) return;
    f.cat = b.dataset.c;
    view.querySelectorAll('.mk-cats button').forEach((x) => x.classList.toggle('on', x === b));
    b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    load();
  };
  view.querySelector('.mk-sort').onclick = (e) => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    f.sort = b.dataset.s; view.querySelectorAll('.mk-sort button').forEach((x) => x.classList.toggle('on', x === b)); load();
  };
  view.querySelector('.mk-filter').onclick = () => sheet('Filtrele', `<form class="form mk-ff">
      <div class="two"><label>En az fiyat<input class="field" name="min" type="number" inputmode="decimal" placeholder="₺" value="${esc(f.min)}"></label>
        <label>En çok fiyat<input class="field" name="max" type="number" inputmode="decimal" placeholder="₺" value="${esc(f.max)}"></label></div>
      <label>Durum<select class="field" name="cond"><option value="">Hepsi</option>${META.conditions.map((c) => `<option value="${c.id}" ${f.cond === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label>Şehir<input class="field" name="city" placeholder="ör. İstanbul" value="${esc(f.city)}"></label>
      <label class="mk-tg"><span>${icon('truck')} Kargo ile gönderilenler</span><input type="checkbox" class="sw" name="ship" ${f.ship ? 'checked' : ''}></label>
      <label class="mk-tg"><span>${icon('hand')} Elden teslim edilenler</span><input type="checkbox" class="sw" name="hand" ${f.hand ? 'checked' : ''}></label>
      <div class="two"><button type="button" class="btn outline clr">Temizle</button><button class="btn primary">Uygula</button></div></form>`, {
    onMount(sh, close) {
      const fm = sh.querySelector('form');
      fm.onsubmit = (e) => { e.preventDefault(); Object.assign(f, { min: fm.min.value, max: fm.max.value, cond: fm.cond.value, city: fm.city.value.trim(), ship: fm.ship.checked, hand: fm.hand.checked }); close(); load(); paintFilterDot(); };
      fm.querySelector('.clr').onclick = () => { Object.assign(f, { min: '', max: '', cond: '', city: '', ship: false, hand: false }); close(); load(); paintFilterDot(); };
    },
  });
  const paintFilterDot = () => view.querySelector('.mk-filter').classList.toggle('dot', !!(f.min || f.max || f.cond || f.city || f.ship || f.hand));
  if (f.cat) setTimeout(() => view.querySelector('.mk-cats .on')?.scrollIntoView({ inline: 'center', block: 'nearest' }), 50);
  load();
  return null;
}

// ================= İlan detayı =================
async function item(view, sub, id) {
  let it;
  try { it = await api(`/market/items/${encodeURIComponent(id)}`); } catch (e) {
    view.innerHTML = `<header class="topbar">${back()}<div class="center">İlan</div><span class="ib"></span></header><div class="empty"><div class="big">${icon('bag')}</div><h2>İlan bulunamadı</h2>${esc(e.message)}</div>`; return null;
  }
  const c = catOf(it.category);
  const s = it.seller || {};
  const shipLine = it.ship ? (it.shipPayer === 'satici' ? 'Kargo ücreti satıcıya ait' : it.shipFee ? `Kargo ücreti alıcıya ait · ${price(it.shipFee)}` : 'Kargo ücreti alıcıya ait (kapıda)') : null;
  view.innerHTML = `<div class="mk-item">
    <header class="mk-itop">${back()}<span class="grow"></span>
      <button class="ib share" aria-label="Paylaş">${icon('share')}</button><button class="ib more" aria-label="Diğer">${icon('more')}</button></header>
    <div class="mk-gal">${it.photos.map((p) => `<img src="${esc(p)}" alt="">`).join('')}</div>
    ${it.photos.length > 1 ? `<div class="mk-dots">${it.photos.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>` : ''}
    <div class="mk-ibody">
      <div class="mk-price">${price(it.price)}${it.status !== 'active' ? `<span class="chip ${it.status === 'sold' ? '' : 'uv'}">${it.status === 'sold' ? 'Satıldı' : 'Rezerve'}</span>` : ''}</div>
      <h1 class="mk-title">${esc(it.title)}</h1>
      <div class="mk-chips"><span class="chip">${esc(condOf(it.condition))}</span>${c ? `<a class="chip" href="#/market/c/${c.id}">${c.em} ${esc(c.name)}</a>` : ''}${it.city ? `<span class="chip">${icon('mapPin')} ${esc(it.city)}</span>` : ''}</div>
      <div class="mk-meta muted">${ago(it.at, true)} · ${it.views} görüntülenme · ${it.favCount} favori</div>
      <div class="mk-dlv">
        ${it.ship ? `<div>${icon('truck')}<span><b>Kargo ile gönderim</b>${esc(shipLine)}</span></div>` : ''}
        ${it.hand ? `<div>${icon('hand')}<span><b>Elden teslim</b>${it.city ? esc(it.city) + ' · ' : ''}Buluşup teslim alırsın, teslimde fotoğraf çekilir</span></div>` : ''}
      </div>
      ${it.ship ? `<div class="mk-safe">${icon('shield')}<span><b>SwipeUp güvencesi</b>Kargolu alışverişte ödemen SwipeUp’ta emanette bekler. Ürünü teslim alıp onaylayınca satıcıya geçer. Sorun olursa ekibimiz devreye girer.</span></div>` : ''}
      ${it.desc ? `<div class="mk-desc"><h3>Açıklama</h3><p>${esc(it.desc)}</p></div>` : ''}
      <div class="mk-sel">
        <a href="#/u/${esc(s.username)}"><img class="av av-48" src="${esc(s.avatar)}" alt=""></a>
        <div class="grow"><b>${nm(s)}</b><span class="muted">${s.rating != null ? `${stars(s.rating)} ${s.rating} (${s.ratings})` : 'Henüz değerlendirme yok'} · ${s.sold || 0} satış</span></div>
        ${it.mine ? '' : `<button class="btn sm mmsg">${icon('send')} Mesaj</button>`}
      </div>
      ${it.reviews.length ? `<div class="mk-revs"><h3>Satıcı değerlendirmeleri</h3>${it.reviews.map((r) => `<div class="rv"><img class="av av-32" src="${esc(r.buyer?.avatar)}" alt=""><div class="grow"><b>${nm(r.buyer, 'username')}</b> ${stars(r.rating)}<p>${esc(r.review || '')}</p><small class="muted">${esc(r.title)} · ${ago(r.at, true)}</small></div></div>`).join('')}</div>` : ''}
      ${it.more.length ? `<div class="mk-moreh"><h3>Satıcının diğer ilanları</h3><a href="#/market/u/${esc(s.id)}" class="link">Tümü</a></div><div class="mk-row">${it.more.map(card).join('')}</div>` : ''}
    </div>
    <div class="mk-buybar">${buyBar(it)}</div></div>`;
  // galeri noktaları
  const gal = view.querySelector('.mk-gal');
  gal.addEventListener('scroll', () => { const i = Math.round(gal.scrollLeft / gal.clientWidth); view.querySelectorAll('.mk-dots i').forEach((d, k) => d.classList.toggle('on', k === i)); }, { passive: true });
  gal.onclick = (e) => { if (e.target.tagName === 'IMG') lightbox(it.photos, [...gal.children].indexOf(e.target)); };
  view.querySelector('.mmsg')?.addEventListener('click', () => openChatWith(s.id).catch((er) => toast(er.message)));
  view.querySelector('.share').onclick = async () => {
    const url = `${location.origin}/#/market/i/${it.id}`;
    try { if (navigator.share) await navigator.share({ title: it.title, text: `${it.title} · ${price(it.price)} · SwipeUp Store`, url }); else { await navigator.clipboard.writeText(url); toast('Bağlantı kopyalandı.'); } } catch {}
  };
  view.querySelector('.more').onclick = () => sheet(null, `<div class="menu">${it.mine
    ? `<a href="#/market/edit/${esc(it.id)}">${icon('edit')}<span class="grow">İlanı düzenle</span></a><button class="del danger">${icon('trash')}<span class="grow">İlanı kaldır</span></button>`
    : `<button class="rep">${icon('flag')}<span class="grow">İlanı bildir</span></button>`}</div>`, {
    onMount(sh, close) {
      sh.querySelector('.del')?.addEventListener('click', async () => {
        if (!confirm('İlan kaldırılsın mı?')) return;
        try { await api(`/market/items/${it.id}`, { method: 'DELETE' }); close(); toast('İlan kaldırıldı.'); location.hash = '#/market/mine'; } catch (er) { toast(er.message); }
      });
      sh.querySelector('.rep')?.addEventListener('click', () => {
        close();
        sheet('İlanı bildir', `<form class="form">${['Sahte ya da yanıltıcı ilan', 'Yasaklı ürün', 'Dolandırıcılık şüphesi', 'Uygunsuz fotoğraf ya da metin', 'Diğer'].map((r, i) => `<label class="mk-radio"><input type="radio" name="r" value="${esc(r)}" ${i ? '' : 'checked'}><span>${esc(r)}</span></label>`).join('')}
          <button class="btn primary block">Bildir</button></form>`, {
          onMount(s2, c2) { s2.querySelector('form').onsubmit = async (e) => { e.preventDefault(); try { await api(`/market/items/${it.id}/report`, { body: { reason: e.target.r.value } }); c2(); toast('Bildirimin alındı. Teşekkürler.'); } catch (er) { toast(er.message); } }; },
        });
      });
    },
  });
  wireBuyBar(view, it);
  return null;
}
function buyBar(it) {
  if (it.mine) return `<a class="btn outline" href="#/market/edit/${esc(it.id)}">${icon('edit')} Düzenle</a><a class="btn primary grow" href="#/market/orders/sell">Satışlarım</a>`;
  if (it.myOrder) return `<div class="grow"><b>${price(it.price)}</b><small class="muted">Siparişin var</small></div><a class="btn primary" href="#/market/o/${esc(it.myOrder)}">Siparişe git</a>`;
  if (it.status !== 'active') return `<div class="grow"><b>${price(it.price)}</b></div><button class="btn" disabled>${it.status === 'sold' ? 'Satıldı' : 'Rezerve edildi'}</button>`;
  return `<button class="ib fav ${it.fav ? 'on' : ''}" aria-label="Favori">${icon('heart')}</button><div class="grow"><b>${price(it.price)}</b><small class="muted">${it.ship ? 'Güvenli ödeme' : 'Elden teslim'}</small></div><button class="btn primary buy">Satın al</button>`;
}
function wireBuyBar(view, it) {
  view.querySelector('.mk-buybar .fav')?.addEventListener('click', async (e) => {
    const b = e.currentTarget;
    try { const r = await api(`/market/items/${it.id}/fav`, { body: {} }); b.classList.toggle('on', r.fav); toast(r.fav ? 'Favorilere eklendi.' : 'Favorilerden çıkarıldı.'); } catch (er) { toast(er.message); }
  });
  view.querySelector('.mk-buybar .buy')?.addEventListener('click', () => buySheet(it));
}
function lightbox(photos, start) {
  const ov = el(`<div class="mk-lb" role="dialog"><div class="mk-lbg">${photos.map((p) => `<img src="${esc(p)}" alt="">`).join('')}</div><button class="ib x" aria-label="Kapat">${icon('close')}</button></div>`);
  document.body.append(ov);
  const g = ov.querySelector('.mk-lbg'); g.scrollLeft = start * g.clientWidth;
  ov.querySelector('.x').onclick = () => ov.remove();
  const off = () => { ov.remove(); window.removeEventListener('hashchange', off); };
  window.addEventListener('hashchange', off);
}

function buySheet(it) {
  let addr = {}; try { addr = JSON.parse(localStorage.getItem('su_mk_addr') || '{}'); } catch {}
  const fee = it.shipPayer === 'alici' ? it.shipFee || 0 : 0;
  const def = it.ship ? 'kargo' : 'elden';
  sheet('Satın al', `<form class="form mk-buy">
    <div class="mk-prod"><img src="${esc(it.photos[0])}" alt=""><div class="grow"><b class="ellipsis">${esc(it.title)}</b><span class="muted">${esc(it.seller?.username || '')}</span></div><b>${price(it.price)}</b></div>
    <div class="mk-methods">
      ${it.ship ? `<label class="mk-m"><input type="radio" name="m" value="kargo" ${def === 'kargo' ? 'checked' : ''}><span>${icon('truck')}<b>Kargo ile</b><small>Güvenli ödeme · ödemen ürün eline ulaşana kadar SwipeUp’ta bekler</small></span></label>` : ''}
      ${it.hand ? `<label class="mk-m"><input type="radio" name="m" value="elden" ${def === 'elden' ? 'checked' : ''}><span>${icon('hand')}<b>Elden teslim</b><small>Buluşup ödemeyi yüz yüze yaparsınız · teslimde iki taraf da fotoğraf çeker</small></span></label>` : ''}
    </div>
    <div class="mk-addr">
      <label>Ad soyad<input class="field" name="name" autocomplete="name" value="${esc(addr.name || state.me.name || '')}"></label>
      <label>Telefon<input class="field" name="phone" type="tel" autocomplete="tel" placeholder="05xx xxx xx xx" value="${esc(addr.phone || '')}"></label>
      <label>Teslimat adresi<textarea class="field" name="text" rows="3" autocomplete="street-address" placeholder="Mahalle, sokak, no, daire, ilçe / il">${esc(addr.text || '')}</textarea></label>
      <p class="muted mk-note">Adresin ve telefonun yalnızca satıcıyla, kargo için paylaşılır.</p>
    </div>
    <div class="mk-sum"></div>
    <button class="btn primary block">Siparişi oluştur</button></form>`, {
    onMount(sh, close) {
      const fm = sh.querySelector('form');
      const paint = () => {
        const m = fm.querySelector('[name=m]:checked')?.value || def;
        sh.querySelector('.mk-addr').hidden = m !== 'kargo';
        sh.querySelector('.mk-sum').innerHTML = m === 'kargo'
          ? `<div><span>Ürün</span><span>${price(it.price)}</span></div><div><span>Kargo</span><span>${fee ? price(fee) : it.shipPayer === 'satici' ? 'Satıcı öder' : 'Kapıda ödenir'}</span></div><div><span>Komisyon</span><span>0 ₺</span></div><div class="t"><span>Toplam</span><span>${price(it.price + fee)}</span></div>
             <p class="muted mk-note">Sonraki adımda tutarı havale/EFT ile SwipeUp hesabına gönderirsin. Ürünü teslim alıp onaylayınca ödeme satıcıya geçer.</p>`
          : `<div class="t"><span>Elden ödenecek</span><span>${price(it.price)}</span></div><p class="muted mk-note">SwipeUp bu tutarı tutmaz. Buluşma yerini mesajlaşarak ayarlayın; kalabalık ve güvenli bir yer seçin.</p>`;
      };
      fm.addEventListener('change', paint); paint();
      fm.onsubmit = async (e) => {
        e.preventDefault();
        const m = fm.querySelector('[name=m]:checked')?.value || def;
        const address = { name: fm.name.value.trim(), phone: fm.phone.value.trim(), text: fm.text.value.trim() };
        const btn = fm.querySelector('.btn.primary'); btn.disabled = true;
        try {
          if (m === 'kargo') try { localStorage.setItem('su_mk_addr', JSON.stringify(address)); } catch {}
          const o = await api(`/market/items/${it.id}/buy`, { body: { method: m, address: m === 'kargo' ? address : null } });
          close(); META = null; location.hash = `#/market/o/${o.id}`;
        } catch (er) { toast(er.message); btn.disabled = false; }
      };
    },
  });
}

// ================= İlan ver / düzenle =================
async function editor(view, sub, id) {
  let it = { photos: [], title: '', desc: '', price: '', category: '', condition: 'iyi', city: state.me.city || '', ship: true, hand: true, shipPayer: 'alici', shipFee: '' };
  if (sub === 'edit') {
    try { it = await api(`/market/items/${encodeURIComponent(id)}`); } catch (e) { view.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return null; }
    if (!it.mine) { location.hash = `#/market/i/${id}`; return null; }
  }
  const photos = [...it.photos];
  view.innerHTML = `<header class="topbar">${back()}<div class="center">${sub === 'edit' ? 'İlanı düzenle' : 'Ürün sat'}</div><span class="ib"></span></header>
    <form class="form mk-ed">
      <div><div class="mk-lbl">Fotoğraflar <small class="muted">en fazla 8 · ilki kapak olur</small></div><div class="mk-ph"></div></div>
      <label>Başlık<input class="field" name="title" maxlength="80" placeholder="ör. iPhone 13 128 GB, kutulu" value="${esc(it.title)}" required></label>
      <div><div class="mk-lbl">Kategori</div><div class="mk-catpick">${META.categories.map((c) => `<button type="button" data-c="${c.id}" class="${it.category === c.id ? 'on' : ''}"><span>${c.em}</span>${esc(c.name)}</button>`).join('')}</div></div>
      <div><div class="mk-lbl">Durumu</div><div class="seg mk-cond">${META.conditions.map((c) => `<button type="button" data-k="${c.id}" class="${it.condition === c.id ? 'on' : ''}">${esc(c.name.split(',')[0])}</button>`).join('')}</div></div>
      <div class="two"><label>Fiyat (₺)<input class="field" name="price" type="number" inputmode="decimal" min="1" step="any" placeholder="0" value="${esc(it.price)}" required></label>
        <label>Şehir<input class="field" name="city" maxlength="40" placeholder="ör. İzmir" value="${esc(it.city || '')}"></label></div>
      <label>Açıklama<textarea class="field" name="desc" rows="5" maxlength="1500" placeholder="Ürünün durumu, ne kadar kullanıldığı, kutusu ve faturası var mı, kusurları…">${esc(it.desc || '')}</textarea></label>
      <div class="mk-lbl">Teslimat</div>
      <div class="group mk-dg">
        <label class="it">${icon('truck')}<span class="grow">Kargo ile gönderirim<div class="sub">Ödeme SwipeUp güvencesinde bekler</div></span><input type="checkbox" class="sw" name="ship" ${it.ship ? 'checked' : ''}></label>
        <div class="mk-shipopt it">
          <div class="seg mk-payer"><button type="button" data-p="alici" class="${it.shipPayer !== 'satici' ? 'on' : ''}">Kargoyu alıcı öder</button><button type="button" data-p="satici" class="${it.shipPayer === 'satici' ? 'on' : ''}">Ben öderim</button></div>
          <label class="mk-fee">Alıcıdan alınacak kargo ücreti (₺)<input class="field" name="shipFee" type="number" inputmode="decimal" min="0" step="any" placeholder="ör. 90 · boş bırakırsan kapıda ödenir" value="${esc(it.shipFee || '')}"></label>
        </div>
        <label class="it">${icon('hand')}<span class="grow">Elden teslim ederim<div class="sub">Buluşup teslim edersiniz, ödeme yüz yüze</div></span><input type="checkbox" class="sw" name="hand" ${it.hand ? 'checked' : ''}></label>
      </div>
      <div class="mk-rules muted">${icon('shield')}<span>Satıştan komisyon alınmaz. Kargolu satışlarda paketin içini ve dışını fotoğraflayıp takip kodunu girmen, elden teslimde teslim anını fotoğraflaman zorunludur. Sahte ya da yasaklı ürün ilanları kaldırılır.</span></div>
      <button class="btn primary block">${sub === 'edit' ? 'Kaydet' : 'İlanı yayınla'}</button>
    </form>`;
  const fm = view.querySelector('form');
  const box = view.querySelector('.mk-ph');
  const paintPh = () => {
    box.innerHTML = photos.map((p, i) => `<div class="t"><img src="${esc(p)}" alt="">${i ? `<button type="button" class="cv" data-i="${i}" aria-label="Kapak yap">Kapak yap</button>` : '<span class="cvl">Kapak</span>'}<button type="button" class="rm" data-i="${i}" aria-label="Kaldır">✕</button></div>`).join('')
      + (photos.length < 8 ? `<button type="button" class="t add cam">${icon('camera')}<span>Çek</span></button><button type="button" class="t add gal">${icon('image')}<span>Galeri</span></button>` : '');
  };
  paintPh();
  const add = async (capture) => {
    const tile = el('<div class="t busy"><div class="spinner" style="margin:auto"></div></div>');
    try {
      const url = await takePhoto(capture, () => box.insertBefore(tile, box.querySelector('.add')));
      tile.remove();
      if (url) { photos.push(url); paintPh(); }
    } catch (e) { tile.remove(); toast(e.message); paintPh(); }
  };
  box.onclick = (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.classList.contains('cam')) return add(true);
    if (t.classList.contains('gal')) return add(false);
    const i = +t.dataset.i;
    if (t.classList.contains('rm')) { photos.splice(i, 1); paintPh(); }
    if (t.classList.contains('cv')) { photos.unshift(photos.splice(i, 1)[0]); paintPh(); }
  };
  let cat = it.category; let cond = it.condition; let payer = it.shipPayer || 'alici';
  view.querySelector('.mk-catpick').onclick = (e) => { const b = e.target.closest('[data-c]'); if (!b) return; cat = b.dataset.c; view.querySelectorAll('.mk-catpick button').forEach((x) => x.classList.toggle('on', x === b)); };
  view.querySelector('.mk-cond').onclick = (e) => { const b = e.target.closest('[data-k]'); if (!b) return; cond = b.dataset.k; view.querySelectorAll('.mk-cond button').forEach((x) => x.classList.toggle('on', x === b)); };
  const syncShip = () => { view.querySelector('.mk-shipopt').hidden = !fm.ship.checked; view.querySelector('.mk-fee').hidden = payer !== 'alici'; };
  view.querySelector('.mk-payer').onclick = (e) => { const b = e.target.closest('[data-p]'); if (!b) return; payer = b.dataset.p; view.querySelectorAll('.mk-payer button').forEach((x) => x.classList.toggle('on', x === b)); syncShip(); };
  fm.ship.onchange = syncShip; syncShip();
  fm.onsubmit = async (e) => {
    e.preventDefault();
    if (!photos.length) return toast('En az bir fotoğraf ekle.');
    if (!cat) return toast('Kategori seç.');
    const body = { photos, title: fm.title.value, desc: fm.desc.value, price: fm.price.value, category: cat, condition: cond, city: fm.city.value, ship: fm.ship.checked, hand: fm.hand.checked, shipPayer: payer, shipFee: fm.shipFee.value };
    const btn = fm.querySelector('.btn.primary'); btn.disabled = true;
    try {
      const r = sub === 'edit' ? await api(`/market/items/${id}`, { method: 'PUT', body }) : await api('/market/items', { body });
      toast(sub === 'edit' ? 'İlan güncellendi.' : 'İlanın yayında! 🎉');
      location.hash = `#/market/i/${r.id}`;
    } catch (er) { toast(er.message); btn.disabled = false; }
  };
  return null;
}

// ================= Siparişler =================
function orderRow(o) {
  const other = o.role === 'buyer' ? o.seller : o.buyer;
  return `<a class="mk-orow" href="#/market/o/${esc(o.id)}"><img src="${esc(o.photo)}" alt="">
    <div class="grow"><b class="ellipsis">${esc(o.title)}</b><span class="muted ellipsis">${o.method === 'kargo' ? '📦 Kargo' : '🤝 Elden'} · ${o.role === 'buyer' ? 'Satıcı' : 'Alıcı'}: ${esc(other?.username || '?')} · ${ago(o.at)}</span>
      <span class="mk-st ${STATUS_TONE[o.status]}">${esc(o.statusText)}</span></div>
    <div class="r"><b>${price(o.amount)}</b>${o.action ? '<span class="mk-turn">Sıra sende</span>' : ''}</div></a>`;
}
async function orders(view) {
  let side = location.hash.endsWith('/sell') ? 'sell' : 'buy';
  view.innerHTML = `<header class="topbar">${back()}<div class="center">Siparişlerim</div><span class="ib"></span></header>
    <div class="seg mk-side" style="margin:0 14px 12px"><button data-s="buy">Aldıklarım</button><button data-s="sell">Sattıklarım</button></div><div class="mk-olist"></div>`;
  const list = view.querySelector('.mk-olist');
  const load = async () => {
    view.querySelectorAll('.mk-side button').forEach((b) => b.classList.toggle('on', b.dataset.s === side));
    list.innerHTML = '<div class="spinner"></div>';
    const r = await api(`/market/orders?side=${side}`).catch((e) => { list.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return null; });
    if (!r) return;
    list.innerHTML = r.length ? r.map(orderRow).join('') : `<div class="empty"><div class="big">${icon('box')}</div><h2>${side === 'buy' ? 'Henüz bir şey almadın' : 'Henüz satışın yok'}</h2><p><a class="btn primary" href="${side === 'buy' ? '#/market' : '#/market/new'}">${side === 'buy' ? 'Store’a göz at' : 'İlan ver'}</a></p></div>`;
  };
  view.querySelector('.mk-side').onclick = (e) => { const b = e.target.closest('[data-s]'); if (b) { side = b.dataset.s; load(); } };
  load();
  return on('market', load);
}

const KARGO_STEPS = [['Sipariş', ['odeme_bekliyor']], ['Ödeme', ['odeme_kontrol']], ['Güvencede', ['odendi']], ['Kargoda', ['kargoda', 'sorunlu']], ['Teslim', ['tamamlandi']]];
const ELDEN_STEPS = [['Sipariş', []], ['Buluşma', ['bulusma']], ['Teslim', ['teslim_onay', 'sorunlu']], ['Tamam', ['tamamlandi']]];
function steps(o) {
  const S = o.method === 'kargo' ? KARGO_STEPS : ELDEN_STEPS;
  let cur = S.findIndex(([, st]) => st.includes(o.status));
  if (cur < 0) cur = ['iptal', 'iade_bekliyor', 'iade_edildi'].includes(o.status) ? -1 : 0;
  return `<div class="mk-steps ${cur < 0 ? 'off' : ''}">${S.map(([l], i) => `<div class="${i < cur || o.status === 'tamamlandi' ? 'done' : i === cur ? 'cur' : ''}"><i>${i < cur || o.status === 'tamamlandi' ? '✓' : i + 1}</i><span>${l}</span></div>`).join('')}</div>`;
}
const photosHtml = (title, arr) => (arr?.length ? `<div class="mk-ev"><span>${esc(title)}</span><div>${arr.map((p) => `<img src="${esc(p)}" alt="" data-zoom>`).join('')}</div></div>` : '');
const fmtDate = (t) => new Date(t).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

async function order(view, sub, id) {
  const paint = async () => {
    let o;
    try { o = await api(`/market/orders/${encodeURIComponent(id)}`); } catch (e) { view.innerHTML = `<header class="topbar">${back('#/market/orders')}<div class="center">Sipariş</div><span class="ib"></span></header><div class="empty"><h2>Sipariş bulunamadı</h2>${esc(e.message)}</div>`; return; }
    const buyer = o.role === 'buyer';
    const other = buyer ? o.seller : o.buyer;
    view.innerHTML = `<header class="topbar">${back('#/market/orders')}<div class="center">Sipariş <span class="mono">${esc(o.code)}</span></div><span class="ib"></span></header>
      <div class="mk-ord">
        <a class="mk-prod" href="#/market/i/${esc(o.itemId)}"><img src="${esc(o.photo)}" alt=""><div class="grow"><b class="ellipsis">${esc(o.title)}</b><span class="muted">${o.method === 'kargo' ? '📦 Kargo ile' : '🤝 Elden teslim'}</span></div><b>${price(o.amount)}</b></a>
        <div class="mk-other"><img class="av av-32" src="${esc(other?.avatar)}" alt=""><span class="grow">${buyer ? 'Satıcı' : 'Alıcı'}: <b>${nm(other, 'username')}</b></span><button class="btn sm mchat">${icon('send')} Mesaj</button></div>
        ${steps(o)}
        <div class="mk-status"><span class="mk-st ${STATUS_TONE[o.status]}">${esc(o.statusText)}</span></div>
        <div class="mk-act">${actionHtml(o)}</div>
        ${o.method === 'kargo' && (o.tracking || o.address) ? `<div class="mk-box">
          ${o.tracking ? `<div class="mk-trk">${icon('truck')}<div class="grow"><b>${esc(o.carrierName || 'Kargo')}</b><span class="mono">${esc(o.tracking)}</span></div><button class="btn sm cp" data-t="${esc(o.tracking)}">${icon('copy')}</button>${o.trackUrl ? `<a class="btn sm primary" href="${esc(o.trackUrl)}" target="_blank" rel="noopener">Takip et</a>` : ''}</div>` : ''}
          ${o.address ? `<div class="mk-adr">${icon('mapPin')}<div><b>${esc(o.address.name)}</b><span>${esc(o.address.phone)}</span><span>${esc(o.address.text)}</span></div></div>` : ''}
        </div>` : ''}
        ${photosHtml('Paketin içi', o.packInside)}${photosHtml('Paketin dışı', o.packOutside)}
        ${photosHtml('Satıcının teslim fotoğrafı', o.sellerPhoto)}${photosHtml('Alıcının teslim fotoğrafı', o.buyerPhoto)}
        ${o.problem ? `<div class="mk-box mk-prob"><b>⚠️ Bildirilen sorun: ${esc(META.problems[o.problem.kind] || '')}</b><p>${esc(o.problem.text)}</p>${photosHtml('Fotoğraflar', o.problem.photos)}</div>` : ''}
        ${o.rating ? `<div class="mk-box"><b>Değerlendirme</b> ${stars(o.rating)}<p>${esc(o.review || '')}</p></div>` : ''}
        <div class="mk-log"><h3>Sipariş geçmişi</h3>${(o.log || []).slice().reverse().map((l) => `<div><i></i><span>${esc(l.text)}<small>${fmtDate(l.at)}</small></span></div>`).join('')}</div>
      </div>`;
    view.querySelector('.mchat').onclick = () => openChatWith(other.id).catch((e) => toast(e.message));
    view.querySelector('.cp')?.addEventListener('click', (e) => navigator.clipboard?.writeText(e.currentTarget.dataset.t).then(() => toast('Takip kodu kopyalandı.')).catch(() => {}));
    view.querySelectorAll('[data-zoom]').forEach((im) => { im.onclick = () => lightbox([...im.parentElement.querySelectorAll('img')].map((x) => x.src), [...im.parentElement.children].indexOf(im)); });
    wireActions(view, o, paint);
  };
  await paint();
  return on('market', (d) => { if (d?.orderId === id) paint(); });
}

function actionHtml(o) {
  const buyer = o.role === 'buyer';
  const left = (t) => { const ms = t - Date.now(); if (ms <= 0) return 'süre doldu'; const d = Math.floor(ms / 86400000); const h = Math.floor((ms % 86400000) / 3600000); return d ? `${d} gün ${h} saat` : `${h} saat`; };
  switch (o.status) {
    case 'odeme_bekliyor':
      return buyer ? `<div class="mk-pay"><h3>Ödemeyi yap</h3><p class="muted">Aşağıdaki hesaba <b>${price(o.amount)}</b> gönder. Açıklamaya mutlaka <b class="mono">${esc(o.code)}</b> yaz. Ödemen ürün eline ulaşıp onaylayana kadar SwipeUp’ta emanette bekler.</p>
          ${o.paymentNote ? `<p class="mk-warn">⚠️ ${esc(o.paymentNote)}</p>` : ''}
          ${o.bank?.iban ? `<div class="mk-bank"><div><span>Alıcı</span><b>${esc(o.bank.name)}</b></div><div><span>Banka</span><b>${esc(o.bank.bankName || '')}</b></div><div><span>IBAN</span><b class="mono">${esc(o.bank.iban)}</b><button type="button" class="btn sm cpb" data-t="${esc(o.bank.iban.replace(/\s/g, ''))}">${icon('copy')}</button></div><div><span>Açıklama</span><b class="mono">${esc(o.code)}</b><button type="button" class="btn sm cpb" data-t="${esc(o.code)}">${icon('copy')}</button></div><div><span>Tutar</span><b>${price(o.amount)}</b></div></div>` : '<p class="mk-warn">Ödeme şu an kapalı.</p>'}
          <form class="form mk-paid" style="padding:0"><label>Gönderen ad soyad<input class="field" name="sender" value="${esc(o.address?.name || '')}"></label>
            <label>İade gerekirse kullanılacak IBAN<input class="field mono" name="iban" placeholder="TR00 0000 0000 0000 0000 0000 00" autocomplete="off"></label>
            <button class="btn primary block">Ödemeyi yaptım</button></form>
          <button class="btn outline block cancel" style="margin-top:8px">Siparişi iptal et</button></div>`
        : `<div class="mk-info">${icon('timer')}<span><b>Alıcının ödemesi bekleniyor</b>Ödeme SwipeUp hesabına ulaşıp onaylanınca sana haber vereceğiz. <u>Ödeme onaylanmadan ürünü gönderme.</u></span></div><button class="btn outline block cancel">Siparişi iptal et</button>`;
    case 'odeme_kontrol':
      return `<div class="mk-info">${icon('shield')}<span><b>Ödeme kontrol ediliyor</b>${buyer ? 'Ödemen hesabımıza ulaşınca onaylanacak; genellikle birkaç saat sürer.' : 'Alıcı ödemeyi yaptığını bildirdi. Onaylanınca kargolayabilirsin; şimdi gönderme.'}</span></div>`;
    case 'odendi':
      return buyer
        ? `<div class="mk-info ok">${icon('shield')}<span><b>Ödemen güvencede</b>Satıcının ${left(o.shipBy)} içinde kargolaması gerekiyor. Ürün eline ulaşıp onaylayana kadar ödeme satıcıya geçmez.</span></div>${Date.now() > o.shipBy ? '<button class="btn outline block cancel">Siparişi iptal et, ödememi iade et</button>' : ''}`
        : `<div class="mk-ship"><h3>Kargola</h3><p class="muted">Ödeme SwipeUp güvencesinde. ${left(o.shipBy)} içinde kargoya ver. Ürünü paketlerken <b>paketin içini</b>, kapattıktan sonra <b>kargo etiketiyle birlikte dışını</b> fotoğrafla.</p>
          <form class="form" style="padding:0">
            <div class="mk-shots"><div data-k="inside"><b>Paketin içi</b><small>Ürün kutuda görünsün</small><div class="ims"></div><button type="button" class="btn sm">${icon('camera')} Fotoğraf çek</button></div>
              <div data-k="outside"><b>Paketin dışı</b><small>Etiket okunsun</small><div class="ims"></div><button type="button" class="btn sm">${icon('camera')} Fotoğraf çek</button></div></div>
            <label>Kargo firması<select class="field" name="carrier"><option value="">Seç</option>${META.carriers.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
            <label class="oth" hidden>Firma adı<input class="field" name="carrierOther"></label>
            <label>Takip kodu<input class="field mono" name="tracking" autocomplete="off" placeholder="Kargo fişindeki gönderi kodu"></label>
            <button class="btn primary block">${icon('truck')} Kargoya verdim</button></form>
          <button class="btn outline block cancel" style="margin-top:8px">Gönderemiyorum, iptal et</button></div>
          <div class="mk-addrh">Gönderim adresi aşağıda.</div>`;
    case 'kargoda':
      return buyer
        ? `<div class="mk-info">${icon('box')}<span><b>Ürün yolda</b>Paketi teslim alıp kontrol et. Her şey yolundaysa onayla; ödeme satıcıya geçsin. ${left(o.autoAt)} içinde onay ya da sorun bildirmezsen teslim otomatik onaylanır.</span></div>
          <button class="btn primary block recv">${icon('check')} Ürünü teslim aldım, sorun yok</button><button class="btn outline block prob" style="margin-top:8px">Sorun var</button>`
        : `<div class="mk-info">${icon('truck')}<span><b>Kargoda</b>Alıcı teslim aldığını onaylayınca ya da ${left(o.autoAt)} içinde sorun bildirmezse <b>${price(o.amount)}</b> Store bakiyene geçer.</span></div>`;
    case 'bulusma':
      return buyer
        ? `<div class="mk-info">${icon('hand')}<span><b>Buluşmayı ayarlayın</b>Mesajlaşarak yer ve saat belirleyin; kalabalık ve güvenli bir yer seçin. Ödemeyi ürünü kontrol ettikten sonra elden yap. Satıcı teslim ettiğini fotoğrafla bildirince sen de teslim aldığını fotoğrafla onaylarsın.</span></div><button class="btn outline block cancel">Siparişi iptal et</button>`
        : `<div class="mk-info">${icon('hand')}<span><b>Buluşmayı ayarlayın</b>Teslim anında ürünün fotoğrafını çekmen zorunlu. Ödemeyi elden alırsın; SwipeUp bu tutarı tutmaz.</span></div>
          <button class="btn primary block hand">${icon('camera')} Teslim ettim · fotoğraf çek</button><button class="btn outline block cancel" style="margin-top:8px">Siparişi iptal et</button>`;
    case 'teslim_onay':
      return buyer
        ? `<div class="mk-info">${icon('hand')}<span><b>Teslim aldın mı?</b>Satıcı ürünü teslim ettiğini bildirdi. Elindeki ürünün fotoğrafını çekip onayla.</span></div>
          <button class="btn primary block hand">${icon('camera')} Teslim aldım · fotoğraf çek</button><button class="btn outline block prob" style="margin-top:8px">Sorun var</button>`
        : `<div class="mk-info">${icon('timer')}<span><b>Alıcının onayı bekleniyor</b>Alıcı teslim aldığını fotoğrafla onaylayınca satış tamamlanır.</span></div>`;
    case 'sorunlu':
      return `<div class="mk-info bad">${icon('flag')}<span><b>Sorun inceleniyor</b>SwipeUp ekibi iki tarafı da dinleyip karar verecek${o.method === 'kargo' ? '; bu sırada ödeme emanette kalır' : ''}. Gerekirse mesajla ulaşacağız.</span></div>`;
    case 'iade_bekliyor':
      return `<div class="mk-info bad">${icon('undo')}<span><b>İade hazırlanıyor</b>${buyer ? `${price(o.amount)} bildirdiğin IBAN’a gönderilecek.` : 'Ödeme alıcıya iade ediliyor.'}</span></div>`;
    case 'iade_edildi':
      return `<div class="mk-info">${icon('check')}<span><b>İade edildi</b>${price(o.amount)} alıcıya geri gönderildi.</span></div>`;
    case 'tamamlandi':
      if (buyer && !o.rating) {
        return `<div class="mk-info ok">${icon('check')}<span><b>Alışveriş tamamlandı</b>Satıcıyı değerlendirerek diğer alıcılara yardımcı ol.</span></div>
          <form class="mk-rate"><div class="stars">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-n="${n}">★</button>`).join('')}</div>
          <textarea class="field" name="review" rows="2" maxlength="400" placeholder="Ürün ve satıcı hakkında birkaç söz (isteğe bağlı)"></textarea><button class="btn primary block">Değerlendir</button></form>`;
      }
      return `<div class="mk-info ok">${icon('check')}<span><b>Tamamlandı</b>${!buyer && o.method === 'kargo' ? `${price(o.amount)} Store bakiyene eklendi. <a class="link" href="#/market/balance">Bakiyem</a>` : 'İyi alışverişler!'}</span></div>`;
    case 'iptal':
      return `<div class="mk-info">${icon('close')}<span><b>İptal edildi</b>${esc(o.cancelReason || '')}</span></div>`;
    default: return '';
  }
}

function wireActions(view, o, refresh) {
  const act = view.querySelector('.mk-act');
  const run = async (path, body, okMsg) => {
    try { await api(`/market/orders/${o.id}/${path}`, { body: body || {} }); if (okMsg) toast(okMsg); META = null; refresh(); } catch (e) { toast(e.message); }
  };
  act.querySelectorAll('.cpb').forEach((b) => { b.onclick = () => navigator.clipboard?.writeText(b.dataset.t).then(() => toast('Kopyalandı.')).catch(() => {}); });
  act.querySelector('.mk-paid')?.addEventListener('submit', (e) => { e.preventDefault(); run('paid', { sender: e.target.sender.value, iban: e.target.iban.value }, 'Teşekkürler! Ödemen kontrol edilecek.'); });
  act.querySelector('.cancel')?.addEventListener('click', () => {
    const r = prompt('İptal nedeni (isteğe bağlı):', '');
    if (r === null) return;
    run('cancel', { reason: r }, 'Sipariş iptal edildi.');
  });
  act.querySelector('.recv')?.addEventListener('click', () => { if (confirm('Ürünü teslim aldın ve sorun yok mu? Onaylayınca ödeme satıcıya geçer.')) run('received', {}, 'Teşekkürler! Ödeme satıcıya aktarıldı.'); });
  // Kargola: paket fotoğrafları
  const shots = { inside: [], outside: [] };
  act.querySelectorAll('.mk-shots [data-k]').forEach((box) => {
    box.querySelector('button').onclick = async () => {
      try {
        const url = await takePhoto(true, () => box.classList.add('busy'));
        if (url) { shots[box.dataset.k].push(url); box.querySelector('.ims').insertAdjacentHTML('beforeend', `<img src="${esc(url)}" alt="">`); box.classList.add('has'); }
      } catch (e) { toast(e.message); } finally { box.classList.remove('busy'); }
    };
  });
  const shipForm = act.querySelector('.mk-ship form');
  if (shipForm) {
    shipForm.carrier.onchange = () => { act.querySelector('.oth').hidden = shipForm.carrier.value !== 'diger'; };
    shipForm.onsubmit = (e) => {
      e.preventDefault();
      run('ship', { carrier: shipForm.carrier.value, carrierOther: shipForm.carrierOther.value, tracking: shipForm.tracking.value, inside: shots.inside, outside: shots.outside }, 'Kargo bilgisi alıcıya iletildi.');
    };
  }
  // Elden teslim: fotoğraf zorunlu
  act.querySelector('.hand')?.addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try {
      const url = await takePhoto(true);
      if (!url) { b.disabled = false; return; }
      await run('handover', { photos: [url] }, o.role === 'buyer' ? 'Teslim onaylandı. İyi kullanımlar!' : 'Teslim bildirildi, alıcının onayı bekleniyor.');
    } catch (er) { toast(er.message); b.disabled = false; }
  });
  act.querySelector('.prob')?.addEventListener('click', () => {
    const ph = [];
    sheet('Sorun bildir', `<form class="form">${Object.entries(META.problems).map(([k, l], i) => `<label class="mk-radio"><input type="radio" name="k" value="${k}" ${i ? '' : 'checked'}><span>${esc(l)}</span></label>`).join('')}
      <label>Ne oldu?<textarea class="field" name="t" rows="4" maxlength="1000" placeholder="Sorunu anlat. Paketin ve ürünün fotoğrafını eklemen incelemeyi hızlandırır."></textarea></label>
      <div class="mk-pp"><div class="ims"></div><button type="button" class="btn sm">${icon('camera')} Fotoğraf ekle</button></div>
      <button class="btn primary block">Gönder</button></form>`, {
      onMount(sh, close) {
        sh.querySelector('.mk-pp button').onclick = async () => { try { const u = await takePhoto(false); if (u) { ph.push(u); sh.querySelector('.mk-pp .ims').insertAdjacentHTML('beforeend', `<img src="${esc(u)}" alt="">`); } } catch (er) { toast(er.message); } };
        sh.querySelector('form').onsubmit = (e) => { e.preventDefault(); close(); run('problem', { kind: e.target.k.value, text: e.target.t.value, photos: ph }, 'Sorun bildirildi. Ekibimiz inceleyecek; bu sırada ödeme emanette kalır.'); };
      },
    });
  });
  const rate = act.querySelector('.mk-rate');
  if (rate) {
    let n = 0;
    rate.querySelector('.stars').onclick = (e) => { const b = e.target.closest('[data-n]'); if (!b) return; n = +b.dataset.n; rate.querySelectorAll('.stars button').forEach((x) => x.classList.toggle('on', +x.dataset.n <= n)); };
    rate.onsubmit = (e) => { e.preventDefault(); if (!n) return toast('Yıldız seç.'); run('rate', { rating: n, review: rate.review.value }, 'Teşekkürler!'); };
  }
}

// ================= İlanlarım / Favoriler =================
async function mine(view) {
  view.innerHTML = `<header class="topbar">${back()}<div class="center">İlanlarım</div><a class="ib" href="#/market/new" aria-label="İlan ver">${icon('plus')}</a></header><div class="mk-grid"><div class="spinner" style="grid-column:1/-1"></div></div>`;
  const list = await api('/market/mine').catch(() => []);
  view.querySelector('.mk-grid').innerHTML = list.length ? list.map((it) => card(it).replace('</div></a>', `<span class="mst muted">${icon('eye')} ${it.views} · ${icon('heart')} ${it.favCount}</span></div></a>`)).join('')
    : `<div class="empty" style="grid-column:1/-1"><div class="big">${icon('tagPrice')}</div><h2>Henüz ilanın yok</h2>Kullanmadığın eşyaları sat, komisyon ödemeden kazan.<p><a class="btn primary" href="#/market/new">${icon('plus')} İlan ver</a></p></div>`;
  return null;
}
async function favs(view) {
  view.innerHTML = `<header class="topbar">${back()}<div class="center">Favorilerim</div><span class="ib"></span></header><div class="mk-grid"><div class="spinner" style="grid-column:1/-1"></div></div>`;
  const list = await api('/market/favs').catch(() => []);
  view.querySelector('.mk-grid').innerHTML = list.length ? list.map(card).join('') : `<div class="empty" style="grid-column:1/-1"><div class="big">${icon('heart')}</div><h2>Favorin yok</h2>Beğendiğin ilanlarda kalbe dokun, burada saklansın.</div>`;
  return null;
}

// ================= Bakiye =================
async function balance(view) {
  const paint = async () => {
    const b = await api('/market/balance');
    view.innerHTML = `<header class="topbar">${back()}<div class="center">Store bakiyem</div><span class="ib"></span></header>
      <div class="mk-bal"><span>Çekilebilir bakiye</span><b>${price(b.balance)}</b><small>${b.pending ? `${price(b.pending)} emanette, alıcı onayı bekliyor` : 'Komisyon yok · satışının tamamı senin'}</small></div>
      <form class="form mk-po"><h3 style="margin:0">Ödeme talep et</h3>
        <label>IBAN<input class="field mono" name="iban" placeholder="TR00 0000 0000 0000 0000 0000 00" autocomplete="off"></label>
        <label>Hesap sahibi<input class="field" name="name" value="${esc(state.me.name || '')}"></label>
        <button class="btn primary block" ${b.balance < b.minPayout ? 'disabled' : ''}>${price(b.balance)} çek</button>
        <p class="muted mk-note">En az ${price(b.minPayout)}. Ödemeler genellikle 1–2 iş günü içinde hesabına gönderilir.</p></form>
      ${b.payouts.length ? `<div class="group-t">Ödeme taleplerim</div><div class="group">${b.payouts.map((p) => `<div class="it"><span class="grow">${price(p.amount)}<div class="sub">${fmtDate(p.at)} · ${esc(p.iban.slice(0, 4))}…${esc(p.iban.slice(-4))}</div></span><span class="mk-st ${p.status === 'paid' ? 'ok' : p.status === 'pending' ? 'warn' : 'bad'}">${p.status === 'paid' ? 'Gönderildi' : p.status === 'pending' ? 'Bekliyor' : 'Reddedildi'}</span></div>`).join('')}</div>` : ''}`;
    view.querySelector('.mk-po').onsubmit = async (e) => {
      e.preventDefault();
      try { await api('/market/payout', { body: { iban: e.target.iban.value, name: e.target.name.value } }); toast('Ödeme talebin alındı.'); META = null; paint(); } catch (er) { toast(er.message); }
    };
  };
  await paint().catch((e) => { view.innerHTML = `<div class="empty">${esc(e.message)}</div>`; });
  return on('wallet', () => paint().catch(() => {}));
}

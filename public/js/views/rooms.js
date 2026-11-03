// Etkinlik odaları: konuya göre, belli saatlerde açılan sohbet odaları
import { icon } from '../icons.js';
import { api, esc, on } from '../core.js';

const hm = (t) => new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
function when(r) {
  if (r.always) return 'Her zaman açık';
  if (r.open) return r.closesAt ? `Açık · kapanış ${hm(r.closesAt)}` : 'Açık';
  if (!r.opensAt) return 'Kapalı';
  const d = new Date(r.opensAt); const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  const day = d.toDateString() === today.toDateString() ? 'Bugün' : d.toDateString() === tomorrow.toDateString() ? 'Yarın' : d.toLocaleDateString('tr-TR', { weekday: 'long' });
  return `Açılış: ${day} ${hm(r.opensAt)}`;
}

export default async function rooms(view) {
  view.innerHTML = `<header class="topbar"><a class="ib" href="#/" aria-label="Geri">${icon('back')}</a><div class="center">Etkinlik odaları</div><span class="ib"></span></header>
    <div class="rooms"><div class="spinner"></div></div>`;
  const box = view.querySelector('.rooms');
  const load = async () => {
    const list = await api('/rooms');
    const open = list.filter((r) => r.open); const closed = list.filter((r) => !r.open);
    const card = (r) => `<a class="room ${r.open ? 'open' : 'closed'}" href="#/genel/${esc(r.id)}">
        <span class="rm-ic">${esc(r.em)}</span>
        <span class="grow"><b>${esc(r.name)}</b><small>${esc(r.desc || '')}</small><em>${r.open ? '<i class="live-dot"></i>' : '🔒 '}${esc(when(r))}</em></span>
        ${r.open ? `<span class="rm-on">${r.online ? `${r.online} kişi` : 'Katıl'}</span>` : ''}</a>`;
    box.innerHTML = `
      <a class="speed-cta" href="#/hizli"><span class="sc-ic">⚡</span><span class="grow"><b>Canlı hızlı tanışma</b><small>3 dakikalık görüntülü turlar. İkiniz de “devam” derseniz eşleşirsiniz.</small></span><span class="go-chip">Başla</span></a>
      <a class="room open" href="#/genel"><span class="rm-ic">💬</span><span class="grow"><b>Genel sohbet</b><small>Tüm üyelerin konuştuğu oda</small><em><i class="live-dot"></i>Her zaman açık</em></span></a>
      ${open.length ? `<h3 class="shop-h">Şimdi açık</h3>${open.map(card).join('')}` : ''}
      ${closed.length ? `<h3 class="shop-h">Yakında açılacak</h3>${closed.sort((a, b) => (a.opensAt || 9e15) - (b.opensAt || 9e15)).map(card).join('')}` : ''}
      <p class="muted" style="font-size:12.5px;margin:16px 4px 30px">Odalar Türkiye saatine göre açılıp kapanır. Kapalı bir odadaki eski mesajları okuyabilirsin.</p>`;
  };
  await load();
  const t = setInterval(() => load().catch(() => {}), 60000);
  const off = on('reconnected', () => load().catch(() => {}));
  return () => { clearInterval(t); off(); };
}

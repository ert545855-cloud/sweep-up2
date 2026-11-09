// Etkinlikler: gerçek hayatta buluşmalar (kahve, yürüyüş, maç, oyun gecesi…), katılım, etkinlik sohbeti
import { icon } from '../icons.js';
import {
  api, esc, toast, avatar, nm, state, pickFile, compressImage, uploadFile, richText, shareSheet,
} from '../core.js';
import { egi } from '../eg-icons.js';

const CATS = { kahve: '☕ Kahve', yuruyus: '🥾 Yürüyüş', spor: '⚽ Spor', muzik: '🎶 Müzik', oyun: '🎲 Oyun', sanat: '🎨 Sanat', yemek: '🍕 Yemek', parti: '🎉 Parti', sohbet: '💬 Sohbet', diger: '📍 Diğer' };
const head = (t, right = '<span class="ib"></span>') => `<header class="topbar bordered"><button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/etkinlikler')" aria-label="Geri">${icon('back')}</button><div class="center">${t}</div>${right}</header>`;
const when = (t) => new Date(t).toLocaleString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const dayBox = (t) => { const d = new Date(t); return `<span class="ev-day"><b>${d.getDate()}</b><small>${d.toLocaleDateString('tr-TR', { month: 'short' })}</small></span>`; };
const pad = (n) => String(n).padStart(2, '0');
const localIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

function card(e) {
  const past = e.startAt < Date.now();
  return `<a class="ev-card ${e.status === 'cancelled' ? 'off' : ''}" href="#/etkinlik/${esc(e.id)}">
    <span class="ev-cv ${e.cover ? '' : `cat-${esc(e.cat)}`}">${e.cover ? `<img src="${esc(e.cover)}" alt="" loading="lazy">` : `<em>${esc(e.catName.split(' ')[0])}</em>`}${dayBox(e.startAt)}</span>
    <span class="ev-b"><small class="ev-c">${esc(e.catName)}${e.status === 'cancelled' ? ' · İptal edildi' : past ? ' · Başladı' : ''}</small><b>${esc(e.title)}</b>
      <span class="ev-m">${icon('timer')} ${when(e.startAt)}</span><span class="ev-m">${icon('mapPin')} ${esc(e.place)}${e.city ? `, ${esc(e.city)}` : ''}</span>
      <span class="ev-f"><span class="ev-faces">${e.faces.map((f) => `<img src="${esc(f.avatar)}" alt="">`).join('')}</span><small>${e.goingCount} katılıyor${e.capacity ? ` / ${e.capacity}` : ''}</small>${e.my === 'going' ? '<span class="chip ok">Katılıyorsun</span>' : e.my === 'interested' ? '<span class="chip">İlgileniyorsun</span>' : ''}</span></span></a>`;
}

async function list(view) {
  view.innerHTML = `${head('Etkinlikler', `<a class="ib soft" href="#/etkinlik/yeni" aria-label="Etkinlik oluştur">${icon('plus')}</a>`)}
    <div class="ev-page"><section class="ev-hero">${egi('etkinlik', 52)}<div class="grow"><b>Gerçek hayatta buluş</b><small>Kahve, yürüyüş, maç, oyun gecesi… Bir etkinlik oluştur ya da birine katıl.</small></div></section>
    <div class="seg ev-tabs"><button data-t="upcoming" class="on">Yaklaşan</button><button data-t="going">Katıldıklarım</button><button data-t="mine">Benimkiler</button></div>
    <div class="ev-city"><label class="sw">${icon('mapPin')}<input class="field cq" placeholder="Şehre göre filtrele" value="${esc(state.me.city || '')}"></label></div>
    <div class="ev-list"><div class="spinner"></div></div>
    <a class="btn primary block ev-new" href="#/etkinlik/yeni">${icon('plus')} Etkinlik oluştur</a></div>`;
  const box = view.querySelector('.ev-list'); let tab = 'upcoming'; let t = 0;
  const load = async () => {
    const city = tab === 'upcoming' ? view.querySelector('.cq').value.trim() : '';
    box.innerHTML = '<div class="spinner"></div>';
    let l = [];
    try { l = await api(`/events?tab=${tab}${city ? `&city=${encodeURIComponent(city)}` : ''}`); } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    box.innerHTML = l.length ? l.map(card).join('') : `<div class="empty"><div class="big">📅</div><h2>${{ upcoming: city ? `${esc(city)} için yaklaşan etkinlik yok` : 'Yaklaşan etkinlik yok', going: 'Henüz bir etkinliğe katılmadın', mine: 'Henüz etkinlik oluşturmadın' }[tab]}</h2>${tab === 'upcoming' && city ? '<p><button class="btn all">Tüm şehirleri göster</button></p>' : '<p>İlk etkinliği sen oluştur, takipçilerine haber gitsin.</p>'}</div>`;
    box.querySelector('.all')?.addEventListener('click', () => { view.querySelector('.cq').value = ''; load(); });
  };
  view.querySelector('.ev-tabs').onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b) return; tab = b.dataset.t; view.querySelectorAll('.ev-tabs button').forEach((x) => x.classList.toggle('on', x === b)); view.querySelector('.ev-city').hidden = tab !== 'upcoming'; load(); };
  view.querySelector('.cq').oninput = () => { clearTimeout(t); t = setTimeout(load, 350); };
  await load();
  return null;
}

function form(view, ev = null) {
  const def = new Date(Date.now() + 2 * 86400000); def.setHours(19, 0, 0, 0);
  let cover = ev?.cover || null; let cat = ev?.cat || 'kahve';
  view.innerHTML = `${head(ev ? 'Etkinliği düzenle' : 'Yeni etkinlik')}<form class="form ev-form">
    <button type="button" class="ev-cover">${cover ? `<img src="${esc(cover)}" alt="">` : `${icon('image')}<span>Kapak fotoğrafı ekle (isteğe bağlı)</span>`}</button>
    <label>Etkinliğin adı<input class="field" name="title" maxlength="80" required placeholder="Ör. Pazar sabahı Moda yürüyüşü" value="${esc(ev?.title || '')}"></label>
    <div class="ev-cats">${Object.entries(CATS).map(([k, v]) => `<button type="button" data-c="${k}" class="chip ${k === cat ? 'on' : ''}">${v}</button>`).join('')}</div>
    <label>Ne zaman<input class="field" type="datetime-local" name="when" required min="${localIso(new Date(Date.now() + 15 * 60000))}" value="${localIso(ev ? new Date(ev.startAt) : def)}"></label>
    <label>Nerede<input class="field" name="place" maxlength="120" required placeholder="Ör. Moda sahili, iskele önü" value="${esc(ev?.place || '')}"></label>
    <label>Şehir<input class="field" name="city" maxlength="40" placeholder="Ör. İstanbul" value="${esc(ev?.city ?? state.me.city ?? '')}"></label>
    <label>Açıklama<textarea class="field" name="desc" rows="4" maxlength="1200" placeholder="Ne yapacağız, ne getirmeli, kimler gelebilir?">${esc(ev?.desc || '')}</textarea></label>
    <label>Kişi sınırı<input class="field" type="number" name="cap" min="0" max="500" placeholder="Sınırsız için boş bırak" value="${ev?.capacity || ''}"></label>
    <div class="seg ev-aud"><button type="button" data-a="all" class="${ev?.audience !== 'followers' ? 'on' : ''}">Herkese açık</button><button type="button" data-a="followers" class="${ev?.audience === 'followers' ? 'on' : ''}">Sadece takipçilerim</button></div>
    ${ev ? '' : '<label class="switch-row"><span class="grow">Etkinlik sohbeti aç<small class="muted" style="display:block;font-size:12.5px">Katılanlar otomatik olarak grup sohbetine eklenir</small></span><input type="checkbox" name="chat" checked></label>'}
    <p class="muted" style="font-size:12.5px;margin:0">💛 Buluşmaları kalabalık, herkese açık yerlerde yap. Uygunsuz etkinlikleri bildirebilirsin.</p>
    <button class="btn primary block">${ev ? 'Kaydet' : 'Etkinliği oluştur'}</button></form>`;
  const f = view.querySelector('form'); let aud = ev?.audience || 'all';
  view.querySelector('.ev-cats').onclick = (e) => { const b = e.target.closest('[data-c]'); if (!b) return; cat = b.dataset.c; view.querySelectorAll('.ev-cats .chip').forEach((x) => x.classList.toggle('on', x === b)); };
  view.querySelector('.ev-aud').onclick = (e) => { const b = e.target.closest('[data-a]'); if (!b) return; aud = b.dataset.a; view.querySelectorAll('.ev-aud button').forEach((x) => x.classList.toggle('on', x === b)); };
  const cv = view.querySelector('.ev-cover');
  cv.onclick = async () => {
    const file = await pickFile('image/*'); if (!file) return;
    cv.innerHTML = '<div class="spinner"></div>';
    try { const up = await uploadFile(await compressImage(file, 1280)); cover = up.url; cv.innerHTML = `<img src="${esc(cover)}" alt="">`; } catch (er) { toast(er.message); cv.innerHTML = `${icon('image')}<span>Kapak fotoğrafı ekle</span>`; }
  };
  f.onsubmit = async (e) => {
    e.preventDefault(); const b = f.querySelector('.btn.primary'); b.disabled = true;
    const body = { title: f.title.value, cat, startAt: new Date(f.when.value).toISOString(), place: f.place.value, city: f.city.value, desc: f.desc.value, capacity: +f.cap.value || 0, cover, audience: aud, ...(ev ? {} : { chat: f.chat.checked }) };
    try {
      const r = await api(ev ? `/events/${ev.id}` : '/events', ev ? { method: 'PATCH', body } : { body });
      toast(ev ? 'Etkinlik güncellendi.' : 'Etkinlik oluşturuldu 🎉'); location.replace(`#/etkinlik/${r.id}`);
    } catch (er) { toast(er.message); b.disabled = false; }
  };
  return null;
}

async function detail(view, id) {
  view.innerHTML = `${head('Etkinlik')}<div class="ev-page"><div class="spinner"></div></div>`;
  const box = view.querySelector('.ev-page');
  let e;
  try { e = await api(`/events/${id}`); } catch (er) { box.innerHTML = `<div class="empty"><div class="big">📅</div><h2>Etkinlik bulunamadı</h2>${esc(er.message)}<p><a class="btn primary" href="#/etkinlikler">Etkinliklere dön</a></p></div>`; return null; }
  const paint = () => {
    const full = e.capacity && e.goingCount >= e.capacity && e.my !== 'going';
    const over = e.startAt < Date.now() - 3 * 3600000; const off = e.status === 'cancelled';
    box.innerHTML = `<div class="ev-top ${e.cover ? '' : `cat-${esc(e.cat)}`}">${e.cover ? `<img src="${esc(e.cover)}" alt="">` : `<em>${esc(e.catName.split(' ')[0])}</em>`}</div>
      <section class="ev-d">
        <small class="ev-c">${esc(e.catName)}${off ? ' · <b class="danger">İptal edildi</b>' : over ? ' · Sona erdi' : ''}${e.audience === 'followers' ? ' · Takipçilere özel' : ''}</small>
        <h1>${esc(e.title)}</h1>
        <div class="ev-rows"><div>${icon('timer')}<span><b>${new Date(e.startAt).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</b><small>${new Date(e.startAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</small></span></div>
          <div>${icon('mapPin')}<span><b>${esc(e.place)}</b><small>${esc(e.city || '')}</small></span><a class="btn sm" target="_blank" rel="noopener" href="https://www.google.com/maps/search/${encodeURIComponent(`${e.place} ${e.city || ''}`)}">Harita</a></div>
          <a href="#/u/${esc(e.user.username)}">${avatar(e.user, 32, { dot: false })}<span><b>${nm(e.user)}</b><small>Düzenleyen</small></span></a></div>
        ${e.desc ? `<p class="ev-desc">${richText(e.desc)}</p>` : ''}
        ${off || over ? '' : `<div class="ev-act">${e.mine ? `<a class="btn" href="#/etkinlik/${esc(e.id)}/duzenle">${icon('edit')} Düzenle</a>` : `<button class="btn ${e.my === 'going' ? '' : 'primary'} rs-go" ${full ? 'disabled' : ''}>${e.my === 'going' ? '✓ Katılıyorsun' : full ? 'Etkinlik dolu' : '🎉 Katılıyorum'}</button><button class="btn rs-int ${e.my === 'interested' ? 'on' : ''}">${e.my === 'interested' ? '★ İlgileniyorsun' : '☆ İlgileniyorum'}</button>`}<button class="btn sq ev-sh" aria-label="Paylaş">${icon('share')}</button></div>`}
        ${e.chatId ? `<a class="ev-chat" href="#/chat/${esc(e.chatId)}">${icon('comment')}<span class="grow"><b>Etkinlik sohbeti</b><small>Katılanlarla konuş, planı netleştir</small></span>${icon('back', '', 'style="transform:rotate(180deg)"')}</a>` : ''}
        <div class="section-t"><span>Katılanlar · ${e.goingCount}${e.capacity ? ` / ${e.capacity}` : ''}</span>${e.interestedCount ? `<small class="muted">${e.interestedCount} ilgileniyor</small>` : ''}</div>
        <div class="ev-going">${e.going.map((u) => `<a href="#/u/${esc(u.username)}">${avatar(u, 52, { dot: false })}<small class="ellipsis">${esc(u.name.split(' ')[0])}</small></a>`).join('')}</div>
        ${e.mine && !off && !over ? '<button class="btn block ev-cancel">Etkinliği iptal et</button>' : ''}
        ${!e.mine ? '<button class="link ev-rep">Etkinliği bildir</button>' : ''}
      </section>`;
  };
  paint();
  const rsvp = async (status) => { try { e = await api(`/events/${e.id}/rsvp`, { body: { status } }); paint(); if (status === 'going') toast(e.chatId ? 'Katılıyorsun 🎉 Etkinlik sohbetine eklendin.' : 'Katılıyorsun 🎉 Başlamadan önce hatırlatacağız.'); } catch (er) { toast(er.message); } };
  box.onclick = async (ev) => {
    if (ev.target.closest('.rs-go')) return rsvp(e.my === 'going' ? 'none' : 'going');
    if (ev.target.closest('.rs-int')) return rsvp(e.my === 'interested' ? 'none' : 'interested');
    if (ev.target.closest('.ev-sh')) return shareSheet({ ref: { kind: 'event', id: e.id }, url: `${location.origin}/#/etkinlik/${e.id}`, title: e.title, text: `${e.title} · ${when(e.startAt)} · ${e.place}` });
    if (ev.target.closest('.ev-cancel')) {
      if (!confirm('Etkinlik iptal edilsin mi? Katılanlara bildirim gider.')) return;
      try { e = await api(`/events/${e.id}`, { method: 'PATCH', body: { cancel: true } }); paint(); toast('Etkinlik iptal edildi.'); } catch (er) { toast(er.message); }
    }
    if (ev.target.closest('.ev-rep')) import('../core.js').then(({ reportUser }) => reportUser(e.user, { ref: e.id }));
  };
  return null;
}

export default async function events(view, a, b) {
  if (a === 'yeni') return form(view);
  if (a && b === 'duzenle') { const e = await api(`/events/${a}`).catch(() => null); return e?.mine ? form(view, e) : detail(view, a); }
  if (a) return detail(view, a);
  return list(view);
}

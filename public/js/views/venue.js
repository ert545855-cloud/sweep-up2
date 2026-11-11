// Mekandayım: Swarm tarzı check-in, aynı mekandakiler ve otomatik eşleşme
import { icon } from '../icons.js';
import { api, esc, toast, sheet, avatar, nm, openChatWith, on, ago } from '../core.js';

const back = `<button class="ib" data-back="#/" aria-label="Geri">${icon('back')}</button>`;
const CAT_OPTS = [['cafe', '☕ Kafe'], ['restaurant', '🍽️ Restoran'], ['bar', '🍸 Bar'], ['nightclub', '🪩 Gece kulübü'], ['park', '🌳 Park'], ['mall', '🛍️ AVM'], ['university', '🎓 Okul / üniversite'], ['gym', '🏋️ Spor salonu'], ['cinema', '🎬 Sinema'], ['beach_resort', '🏖️ Plaj'], ['other', '📍 Diğer']];
const fmtM = (m) => (m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1)} km`);
const leftTxt = (t) => { const ms = Math.max(0, t - Date.now()); const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000); return h ? `${h} sa ${m} dk` : `${m} dk`; };

function getPos() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Bu cihaz konum vermiyor.'));
    navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), (e) => reject(new Error(e.code === 1 ? 'Konum izni verilmedi. Tarayıcı ayarlarından SwipeUp’a konum izni ver.' : 'Konumun alınamadı, tekrar dene.')), { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  });
}

export default async function venue(view) {
  view.innerHTML = `<header class="topbar">${back}<div class="center">Mekandayım</div><span class="ib"></span></header><div class="vn"><div class="spinner"></div></div>`;
  const box = view.querySelector('.vn');
  let pos = null; let near = []; let q = '';
  let state_ = await api('/checkins/here').catch(() => ({ current: null, people: [] }));

  const matchedToast = (ms) => { (ms || []).forEach((m) => toast(`${m.user.name} ile aynı mekandasınız, eşleştiniz! Sohbete gitmek için dokun.`, { title: '📍 Yeni eşleşme', img: m.user.avatar, href: `#/chat/${m.chatId}`, ms: 6000 })); };

  function paintHere() {
    const c = state_.current; const ps = state_.people || [];
    box.innerHTML = `<section class="vn-cur"><span class="vn-em">${c.venue.em}</span><div class="grow"><small>Şu an buradasın</small><b>${esc(c.venue.name)}</b><span class="muted">${esc(c.venue.catLabel)}${c.venue.area ? ` · ${esc(c.venue.area)}` : ''} · ${leftTxt(c.until)} sonra biter</span></div></section>
      <label class="vn-open"><span class="grow"><b>Tanışmaya açığım</b><small>Bu mekanda “tanışmaya açık” olan biriyle otomatik eşleşirsin.</small></span><input type="checkbox" class="sw op" ${c.open ? 'checked' : ''}></label>
      <div class="vn-note"><input class="field nt" maxlength="80" placeholder="Not ekle (ör. cam kenarındayım ☕)" value="${esc(c.note)}"><button class="btn sm sv">Kaydet</button></div>
      <div class="section-t"><span>Burada olanlar · ${ps.length}</span></div>
      ${ps.length ? `<div class="vn-ppl">${ps.map((u) => `<div class="vn-p"><a href="#/u/${esc(u.username)}">${avatar(u, 48)}</a><div class="grow"><a class="b" href="#/u/${esc(u.username)}">${nm(u)}${u.age ? `, ${u.age}` : ''}</a>
          <small>${u.open ? '<span class="chip uv sm">Tanışmaya açık</span>' : ''}${u.note ? ` ${esc(u.note)}` : ` ${ago(u.at)} geldi`}</small></div>
          <button class="btn ${u.matched ? 'primary' : ''} sm msg" data-id="${esc(u.id)}">${u.matched ? 'Sohbet' : 'Selam ver'}</button></div>`).join('')}</div>`
        : '<div class="empty" style="padding:18px 10px">Şu an burada etiketlenmiş başka kimse yok. Biri gelince listede görünür.</div>'}
      <div class="vn-acts"><button class="btn block other">${icon('mapPin')} Başka mekan seç</button><button class="btn block danger out">Mekandan çık</button></div>
      <p class="muted vn-priv">${icon('lock')} Kesin konumun kimseye gösterilmez. Mekanın sadece bu listede, karşılıklı takipleştiğin kişilerde ve eşleşmelerinde görünür. ${''}Ayarlar → Gizlilik’ten kapatabilirsin.</p>`;
    box.querySelector('.op').onchange = async (e) => {
      try { const r = await api('/checkins/me', { method: 'PATCH', body: { open: e.target.checked } }); state_ = r; matchedToast(r.matches); paintHere(); } catch (er) { toast(er.message); e.target.checked = !e.target.checked; }
    };
    box.querySelector('.sv').onclick = async () => { try { state_ = await api('/checkins/me', { method: 'PATCH', body: { note: box.querySelector('.nt').value } }); toast('Not kaydedildi.'); } catch (er) { toast(er.message); } };
    box.querySelectorAll('.msg').forEach((b) => { b.onclick = () => openChatWith(b.dataset.id).catch((er) => toast(er.message)); });
    box.querySelector('.out').onclick = async () => { await api('/checkins/me', { method: 'DELETE' }).catch(() => {}); state_ = { current: null, people: [] }; paintPick(); };
    box.querySelector('.other').onclick = () => paintPick(true);
  }

  async function paintPick(force) {
    box.innerHTML = `<section class="vn-hero"><span class="vn-big">📍</span><h2>Neredesin?</h2><p class="muted">Bulunduğun mekanı etiketle; aynı mekanda tanışmaya açık biri varsa otomatik eşleşin. Etiketin ${'3 saat'} sonra kendiliğinden kalkar.</p></section>
      <div class="vn-q"><input class="field" placeholder="Mekan ara…" maxlength="40" value="${esc(q)}"></div>
      <div class="vn-list"><div class="spinner"></div></div>
      <button class="btn block outline custom" style="margin-top:10px">${icon('plus')} Listede yok mu? Mekanın adını yaz</button>`;
    const list = box.querySelector('.vn-list');
    box.querySelector('.custom').onclick = () => customVenue();
    let t; box.querySelector('.vn-q input').oninput = (e) => { q = e.target.value; clearTimeout(t); t = setTimeout(loadNear, 300); };
    try { if (!pos || force) pos = await getPos(); } catch (e) { list.innerHTML = `<div class="empty" style="padding:16px">${esc(e.message)}<p><button class="btn primary retry">Tekrar dene</button></p></div>`; list.querySelector('.retry').onclick = () => paintPick(true); return; }
    await loadNear();
  }
  async function loadNear() {
    const list = box.querySelector('.vn-list'); if (!list || !pos) return;
    try {
      const r = await api(`/venues/nearby?lat=${pos.lat}&lng=${pos.lng}&q=${encodeURIComponent(q)}`);
      near = r.items;
      list.innerHTML = near.length ? near.map((v) => `<button class="vn-it" data-id="${esc(v.id)}"><span class="vn-em sm">${v.em}</span><span class="grow"><b>${esc(v.name)}</b><small>${esc(v.catLabel)} · ${fmtM(v.m)}${v.area ? ` · ${esc(v.area)}` : ''}</small></span>${v.here ? `<span class="vn-here">${v.here} kişi</span>` : ''}</button>`).join('')
        : `<div class="empty" style="padding:16px">${q ? 'Bu isimde yakın bir mekan bulunamadı.' : 'Yakında kayıtlı mekan bulunamadı.'} Aşağıdan mekanın adını yazabilirsin.</div>`;
      list.onclick = (e) => { const b = e.target.closest('[data-id]'); if (b) confirmCheckin(near.find((v) => v.id === b.dataset.id)); };
    } catch (e) { list.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }
  function confirmCheckin(v) {
    sheet(`${v.em} ${v.name}`, `<form class="form" style="padding:0 16px 16px">
      <input class="field" name="n" maxlength="80" placeholder="Not ekle (isteğe bağlı)">
      <label class="switch-row"><input type="checkbox" name="o" checked> Tanışmaya açığım <small class="muted">· burada açık olan biriyle otomatik eşleş</small></label>
      <button class="btn primary block">${icon('checkin')} Buradayım</button></form>`, {
      onMount(sh, close) {
        const f = sh.querySelector('form');
        f.onsubmit = async (e) => { e.preventDefault(); close(); await doCheckin({ venue: v, note: f.n.value, open: f.o.checked }); };
      },
    });
  }
  function customVenue() {
    sheet('Mekanı ekle', `<form class="form" style="padding:0 16px 16px">
      <input class="field" name="name" maxlength="60" placeholder="Mekanın adı" required>
      <select class="field" name="cat">${CAT_OPTS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
      <input class="field" name="n" maxlength="80" placeholder="Not ekle (isteğe bağlı)">
      <label class="switch-row"><input type="checkbox" name="o" checked> Tanışmaya açığım</label>
      <button class="btn primary block">${icon('checkin')} Buradayım</button></form>`, {
      onMount(sh, close) {
        const f = sh.querySelector('form'); setTimeout(() => f.name.focus(), 60);
        f.onsubmit = async (e) => { e.preventDefault(); close(); await doCheckin({ venue: { name: f.name.value, cat: f.cat.value }, note: f.n.value, open: f.o.checked }); };
      },
    });
  }
  async function doCheckin({ venue: v, note, open }) {
    try {
      if (!pos) pos = await getPos();
      const r = await api('/checkins', { body: { venue: { id: v.id, name: v.name, cat: v.cat, lat: v.lat, lng: v.lng, area: v.area }, lat: pos.lat, lng: pos.lng, note, open } });
      state_ = r; paintHere(); matchedToast(r.matches);
      if (!r.matches?.length) toast(`${r.current.venue.name} etiketlendi.`);
    } catch (e) { toast(e.message); }
  }

  if (state_.current) paintHere(); else paintPick();
  const off = on('venue', async () => { if (!state_.current) return; state_ = await api('/checkins/here').catch(() => state_); if (state_.current) paintHere(); });
  return off;
}

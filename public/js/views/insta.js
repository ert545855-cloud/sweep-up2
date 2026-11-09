// Yakın arkadaşlar, planlı gönderiler ve hikaye arşivi sayfaları
import { icon } from '../icons.js';
import {
  api, esc, toast, avatar, nm, state, sheet,
} from '../core.js';
import { storyThumb, newHighlight } from '../insta.js';

const head = (t, right = '<span class="ib"></span>') => `<header class="topbar bordered"><button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/settings')" aria-label="Geri">${icon('back')}</button><div class="center">${t}</div>${right}</header>`;
const fmtWhen = (t) => new Date(t).toLocaleString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long', hour: '2-digit', minute: '2-digit' });

// ================= Yakın arkadaşlar =================
async function closeFriends(view) {
  view.innerHTML = `${head('Yakın arkadaşlar')}<div class="cf-page"><div class="spinner"></div></div>`;
  const box = view.querySelector('.cf-page');
  let d;
  try { d = await api('/close-friends'); } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return null; }
  const on = new Set(d.list.map((u) => u.id));
  const all = [...d.list, ...d.suggestions];
  let q = '';
  const paint = () => {
    const f = (u) => !q || u.username.includes(q) || (u.name || '').toLowerCase().includes(q);
    const mine = all.filter((u) => on.has(u.id) && f(u)); const rest = all.filter((u) => !on.has(u.id) && f(u));
    const row = (u) => `<button class="list-item cf-it" data-id="${esc(u.id)}">${avatar(u, 44, { dot: false })}<div class="grow"><div class="b">${nm(u)}</div><div class="sub">@${esc(u.username)}</div></div><span class="cf-ck ${on.has(u.id) ? 'on' : ''}">${icon('check')}</span></button>`;
    box.querySelector('.cf-l').innerHTML = `${mine.length ? `<div class="section-t"><span>Listen · ${on.size}</span></div>${mine.map(row).join('')}` : ''}
      ${rest.length ? `<div class="section-t"><span>Öneriler</span></div>${rest.map(row).join('')}` : ''}
      ${!all.length ? `<div class="empty">Takip ettiğin ya da seni takip eden kişiler burada listelenir.<p><a class="btn primary" href="#/search">Kişileri keşfet</a></p></div>` : ''}`;
  };
  box.innerHTML = `<div class="cf-hero"><span class="cf-star">${icon('star')}</span><p>Yakın arkadaş listendekiler, sadece onlarla paylaştığın hikayeleri ve notları görür. Listeni kimse göremez, eklediğin kişilere bildirim gitmez.</p></div>
    <div class="search-bar" style="position:static"><label class="sw">${icon('search')}<input class="field cfq" placeholder="Ara"></label></div><div class="cf-l"></div>`;
  box.querySelector('.cfq').oninput = (e) => { q = e.target.value.toLowerCase().trim(); paint(); };
  box.querySelector('.cf-l').onclick = async (e) => {
    const b = e.target.closest('.cf-it'); if (!b) return;
    const id = b.dataset.id; const want = !on.has(id);
    want ? on.add(id) : on.delete(id); b.querySelector('.cf-ck').classList.toggle('on', want);
    try { await api(`/close-friends/${id}`, { body: { on: want } }); state.me.closeFriendsCount = on.size; } catch (er) { toast(er.message); want ? on.delete(id) : on.add(id); paint(); }
  };
  paint();
  return null;
}

// ================= Planlı gönderiler =================
async function scheduled(view) {
  view.innerHTML = `${head('Planlı gönderiler', `<a class="ib soft" href="#/create" aria-label="Yeni gönderi">${icon('plus')}</a>`)}<div class="sch-page"><div class="spinner"></div></div>`;
  const box = view.querySelector('.sch-page');
  const load = async () => {
    let list;
    try { list = await api('/me/scheduled'); } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    if (!list.length) { box.innerHTML = `<div class="empty"><div class="big">${icon('timer')}</div><h2>Planlı gönderin yok</h2>Gönderi ya da yazı paylaşırken “İleri bir saate planla”yı seç; gönderin o saatte kendiliğinden paylaşılır.<p><a class="btn primary" href="#/create">Gönderi hazırla</a></p></div>`; return; }
    box.innerHTML = `<p class="muted sch-note">Gönderilerin seçtiğin saatte kendiliğinden paylaşılır ve sana bildirim gelir.</p>${list.map((q) => `<article class="sch-it" data-id="${esc(q.id)}">
      ${q.media ? `<img src="${esc(q.media)}" alt="">` : `<span class="sch-tx tbg-${esc(q.bg)}">${esc(q.caption.slice(0, 40))}</span>`}
      <div class="grow"><b>${fmtWhen(q.publishAt)}</b><p class="ellipsis2">${esc(q.caption || (q.count > 1 ? `${q.count} fotoğraf` : 'Fotoğraf'))}</p>${q.poll ? `<span class="chip">${icon('poll')} Anketli</span>` : ''}</div>
      <button class="ib soft sch-m" aria-label="Seçenekler">${icon('more')}</button></article>`).join('')}`;
  };
  box.onclick = (e) => {
    const b = e.target.closest('.sch-m'); if (!b) return;
    const id = b.closest('.sch-it').dataset.id;
    sheet(null, `<div class="menu"><button data-a="now">${icon('send')}Şimdi paylaş</button><button data-a="time">${icon('timer')}Saatini değiştir</button><button data-a="del" class="danger">${icon('trash')}Planı iptal et</button></div>`, {
      onMount(sh, close) {
        sh.querySelector('.menu').onclick = async (ev) => {
          const a = ev.target.closest('[data-a]')?.dataset.a; if (!a) return; close();
          try {
            if (a === 'now') { const r = await api(`/me/scheduled/${id}/now`, { body: {} }); toast('Gönderin paylaşıldı.'); location.hash = `#/p/${r.id}`; return; }
            if (a === 'del') { if (!confirm('Bu planlı gönderi iptal edilsin mi?')) return; await api(`/me/scheduled/${id}`, { method: 'DELETE' }); toast('Plan iptal edildi.'); load(); }
            if (a === 'time') timeSheet(id, load);
          } catch (er) { toast(er.message); }
        };
      },
    });
  };
  await load();
  return null;
}
function timeSheet(id, done) {
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  sheet('Yeni saat', `<form class="form"><input type="datetime-local" class="field" name="t" min="${iso(new Date(Date.now() + 6 * 60000))}" required><button class="btn primary block">Kaydet</button></form>`, {
    onMount(sh, close) {
      const f = sh.querySelector('form');
      f.onsubmit = async (e) => { e.preventDefault(); try { await api(`/me/scheduled/${id}`, { method: 'PATCH', body: { publishAt: new Date(f.t.value).toISOString() } }); close(); toast('Saat güncellendi.'); done(); } catch (er) { toast(er.message); } };
    },
  });
}

// ================= Hikaye arşivi =================
async function archive(view) {
  view.innerHTML = `${head('Hikaye arşivi', `<button class="ib soft hl-n" aria-label="Yeni öne çıkan">${icon('plus')}</button>`)}<div class="arch-page"><div class="spinner"></div></div>`;
  const box = view.querySelector('.arch-page');
  const load = async () => {
    let list;
    try { list = await api('/me/archive'); } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    if (!list.length) { box.innerHTML = `<div class="empty"><div class="big">${icon('camera')}</div><h2>Arşivin boş</h2>Paylaştığın hikayeler 24 saat sonra herkesten gizlenir ama 30 gün boyunca burada kalır. Buradan profilinde öne çıkarabilirsin.<p><a class="btn primary" href="#/create/story">Hikaye paylaş</a></p></div>`; return; }
    box.innerHTML = `<p class="muted sch-note">Hikayelerin 30 gün arşivde kalır, sadece sen görürsün. Dokunup profilinde öne çıkarabilirsin.</p>
      <div class="arch-grid big">${list.map((s) => `<button type="button" class="ag" data-id="${esc(s.id)}">${storyThumb(s)}<span class="ag-d">${new Date(s.at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>${s.highlights.length ? `<i class="ag-h">${icon('heart', '', 'fill="currentColor"')}</i>` : ''}${s.audience === 'close' ? `<i class="ag-cf">${icon('star')}</i>` : ''}</button>`).join('')}</div>`;
  };
  box.onclick = (e) => {
    const b = e.target.closest('.ag'); if (!b) return;
    import('../insta.js').then((x) => x.addStoryToHighlight(b.dataset.id, { onClose: load }));
  };
  view.querySelector('.hl-n').onclick = () => newHighlight(load);
  await load();
  return null;
}

export default function insta(view, sub) {
  if (sub === 'yakin') return closeFriends(view);
  if (sub === 'planli') return scheduled(view);
  return archive(view);
}

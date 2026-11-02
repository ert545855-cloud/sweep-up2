import { icon } from '../icons.js';
import {
  state, api, esc, avatar, toast, sheet,
} from '../core.js';

// Kişi seçici (çoklu)
export function pickPeople(title, exclude, onDone) {
  const picked = new Set();
  sheet(title, `<div class="search-bar" style="position:static"><label class="sw">${icon('search')}<input class="field" placeholder="Kişi ara"></label></div><div class="res"></div>`, {
    footer: '<div style="padding:10px 16px"><button class="btn primary block ok" disabled>Ekle</button></div>',
    async onMount(sh, close) {
      const res = sh.querySelector('.res'); const ok = sh.querySelector('.ok');
      const show = (us) => {
        res.innerHTML = us.filter((u) => u.id !== state.me.id && !exclude.has(u.id)).map((u) => `<button class="list-item" data-id="${esc(u.id)}">${avatar(u, 44)}<div class="grow"><div class="b">${esc(u.name)}</div><div class="sub">@${esc(u.username)}</div></div><span class="check ${picked.has(u.id) ? 'on' : ''}">${icon('check')}</span></button>`).join('') || '<div class="empty">Kimse bulunamadı.</div>';
      };
      show(await api('/people'));
      let t;
      sh.querySelector('input').oninput = (e) => { clearTimeout(t); t = setTimeout(async () => show(e.target.value.trim() ? await api(`/users/search?q=${encodeURIComponent(e.target.value)}`) : await api('/people')), 200); };
      res.onclick = (e) => {
        const b = e.target.closest('[data-id]'); if (!b) return;
        const id = b.dataset.id;
        picked.has(id) ? picked.delete(id) : picked.add(id);
        b.querySelector('.check').classList.toggle('on', picked.has(id));
        ok.disabled = !picked.size; ok.textContent = picked.size ? `${picked.size} kişiyi ekle` : 'Ekle';
      };
      ok.onclick = () => { close(); onDone([...picked]); };
    },
  });
}

export default async function groupnew(view) {
  const picked = new Map();
  view.innerHTML = `<header class="topbar bordered"><button class="ib" onclick="history.back()" aria-label="Geri">${icon('back')}</button><div class="center">Yeni grup</div><button class="link mk" style="padding:0 6px" disabled>Oluştur</button></header>
    <div class="form"><label>Grup adı<input class="field nm" maxlength="50" placeholder="Ör. Cumartesi kahvaltısı"></label></div>
    <div class="section-t"><span>Kişiler</span><span class="muted cnt" style="font-family:var(--font);font-size:14px;font-weight:500"></span></div>
    <div class="search-bar" style="position:static;padding-top:0"><label class="sw">${icon('search')}<input class="field q" placeholder="Kişi ara"></label></div>
    <div class="res"><div class="spinner"></div></div>`;
  const res = view.querySelector('.res'); const mk = view.querySelector('.mk'); const nm = view.querySelector('.nm');
  const sync = () => { mk.disabled = !picked.size || !nm.value.trim(); view.querySelector('.cnt').textContent = picked.size ? `${picked.size} seçili` : ''; };
  const show = (us) => {
    res.innerHTML = us.filter((u) => u.id !== state.me.id).map((u) => `<button class="list-item" data-id="${esc(u.id)}">${avatar(u, 44)}<div class="grow"><div class="b">${esc(u.name)}</div><div class="sub">@${esc(u.username)}</div></div><span class="check ${picked.has(u.id) ? 'on' : ''}">${icon('check')}</span></button>`).join('');
    us.forEach((u) => { if (picked.has(u.id)) picked.set(u.id, u); });
  };
  show(await api('/people'));
  let t;
  view.querySelector('.q').oninput = (e) => { clearTimeout(t); t = setTimeout(async () => show(e.target.value.trim() ? await api(`/users/search?q=${encodeURIComponent(e.target.value)}`) : await api('/people')), 200); };
  nm.oninput = sync;
  res.onclick = (e) => {
    const b = e.target.closest('[data-id]'); if (!b) return;
    const id = b.dataset.id;
    picked.has(id) ? picked.delete(id) : picked.set(id, true);
    b.querySelector('.check').classList.toggle('on', picked.has(id));
    sync();
  };
  mk.onclick = async () => {
    try {
      const c = await api('/groups', { body: { name: nm.value, memberIds: [...picked.keys()] } });
      location.replace(`#/chat/${c.id}`);
    } catch (er) { toast(er.message); }
  };
  return null;
}

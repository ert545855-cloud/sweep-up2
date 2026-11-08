// Kulüpler: ilgi alanlarına göre gruplar. Her kulübün kendi akışı ve sohbet odası var.
import { icon } from '../icons.js';
import { api, esc, toast, avatar, nm, ago, pickFile, compressImage, uploadFile } from '../core.js';
import { modCheck } from '../engage.js';

const back = (to) => `<button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '${to}')" aria-label="Geri">${icon('back')}</button>`;

async function list(view) {
  view.innerHTML = `<header class="topbar">${back('#/')}<div class="center">Kulüpler</div><span class="ib"></span></header>
    <p class="muted" style="margin:4px 16px 12px;font-size:13.5px">İlgi alanına göre kulüplere katıl, paylaşımları gör ve kulüp sohbetinde yeni insanlarla tanış.</p>
    <div class="clb-grid"><div class="spinner"></div></div>`;
  const grid = view.querySelector('.clb-grid');
  let items = [];
  const paint = () => {
    grid.innerHTML = items.map((c) => `<a class="clb-card ${c.joined ? 'on' : ''}" href="#/kulup/${esc(c.id)}">
      <span class="em">${esc(c.em)}</span><b>${esc(c.name)}</b><small>${esc(c.desc)}</small>
      <span class="clb-m">${icon('users')} ${c.members} üye</span>
      <button class="btn sm ${c.joined ? '' : 'primary'} clb-j" data-id="${esc(c.id)}">${c.joined ? 'Üyesin ✓' : 'Katıl'}</button></a>`).join('');
  };
  items = await api('/clubs'); paint();
  grid.addEventListener('click', async (e) => {
    const b = e.target.closest('.clb-j'); if (!b) return;
    e.preventDefault();
    const c = items.find((x) => x.id === b.dataset.id);
    try { const r = await api(`/clubs/${c.id}/join`, { method: c.joined ? 'DELETE' : 'POST', body: {} }); Object.assign(c, r); paint(); if (r.joined) toast(`${c.em} ${c.name} kulübüne katıldın!`); } catch (er) { toast(er.message); }
  });
  return null;
}

async function detail(view, id) {
  view.innerHTML = '<div class="spinner" style="margin-top:40vh"></div>';
  let d;
  try { d = await api(`/clubs/${id}`); } catch (e) { view.innerHTML = `<div class="empty"><h2>Kulüp bulunamadı</h2><p><a class="btn primary" href="#/kulupler">Kulüpler</a></p></div>`; return null; }
  let media = null;
  const post = (p) => `<article class="clb-p" data-id="${esc(p.id)}"><div class="dq-ah"><a href="#/u/${esc(p.user?.username)}">${avatar(p.user, 36, { dot: false })}</a><div class="grow"><a class="b" href="#/u/${esc(p.user?.username)}">${nm(p.user)}</a><small class="muted"> · ${ago(p.at)}</small></div>${p.mine ? `<button class="ib sm cp-del" aria-label="Sil">${icon('trash')}</button>` : ''}</div>
      ${p.text ? `<p class="dq-t">${esc(p.text)}</p>` : ''}${p.media ? `<img class="clb-img" src="${esc(p.media)}" alt="" loading="lazy">` : ''}
      <div class="dq-acts"><button class="cp-like ${p.liked ? 'on' : ''}">${icon('heart')} <span>${p.likeCount || ''}</span></button></div></article>`;
  const paint = () => {
    const c = d.club;
    view.innerHTML = `<header class="topbar">${back('#/kulupler')}<div class="center">${esc(c.em)} ${esc(c.name)}</div><span class="ib"></span></header>
      <section class="clb-hero"><span class="em">${esc(c.em)}</span><div class="grow"><b>${esc(c.name)}</b><small>${esc(c.desc)}</small>
        <div class="clb-av">${d.sample.slice(0, 6).map((u) => `<img src="${esc(u.avatar)}" alt="">`).join('')}<span>${c.members} üye</span></div></div></section>
      <div class="clb-btns"><button class="btn ${c.joined ? '' : 'primary'} join">${c.joined ? 'Üyesin ✓' : 'Kulübe katıl'}</button><a class="btn ${c.joined ? 'primary' : ''}" href="#/genel/${esc(c.room)}">${icon('comment')} Kulüp sohbeti</a></div>
      ${c.joined ? `<form class="clb-f"><textarea class="field" rows="2" maxlength="1000" placeholder="${esc(c.name)} kulübüyle bir şey paylaş..."></textarea>
        <div class="clb-fx"><button type="button" class="ib pic" aria-label="Fotoğraf ekle">${icon('image')}</button><span class="grow pv"></span><button class="btn primary sm">Paylaş</button></div></form>` : ''}
      <div class="clb-list">${d.posts.length ? d.posts.map(post).join('') : `<div class="empty" style="padding:24px">Henüz paylaşım yok. ${c.joined ? 'İlk paylaşımı sen yap!' : 'Katıl ve ilk paylaşımı sen yap!'}</div>`}</div>
      ${d.more ? '<button class="btn block more" style="margin:12px 16px 30px;width:calc(100% - 32px)">Daha fazla</button>' : ''}`;
  };
  paint();
  const reload = async () => { d = await api(`/clubs/${id}`); paint(); };
  view.addEventListener('click', async (e) => {
    try {
      if (e.target.closest('.join')) { const r = await api(`/clubs/${id}/join`, { method: d.club.joined ? 'DELETE' : 'POST', body: {} }); d.club = r; paint(); return; }
      if (e.target.closest('.pic')) {
        const f = await pickFile('image/*'); if (!f) return;
        toast('Yükleniyor...', { ms: 1200 });
        media = (await uploadFile(await compressImage(f))).url;
        view.querySelector('.pv').innerHTML = `<img src="${esc(media)}" alt="" style="height:40px;border-radius:8px">`;
        return;
      }
      if (e.target.closest('.more')) {
        const r = await api(`/clubs/${id}?before=${d.posts[d.posts.length - 1].at}`);
        d.posts.push(...r.posts); d.more = r.more; paint(); return;
      }
      const art = e.target.closest('[data-id]'); if (!art) return;
      const pid = art.dataset.id;
      if (e.target.closest('.cp-like')) { const p = await api(`/club-posts/${pid}/like`, { body: {} }); const i = d.posts.findIndex((x) => x.id === pid); d.posts[i] = p; art.outerHTML = post(p); }
      if (e.target.closest('.cp-del') && confirm('Paylaşım silinsin mi?')) { await api(`/club-posts/${pid}`, { method: 'DELETE' }); d.posts = d.posts.filter((x) => x.id !== pid); art.remove(); }
    } catch (er) { toast(er.message); }
  });
  view.addEventListener('submit', async (e) => {
    if (!e.target.classList.contains('clb-f')) return;
    e.preventDefault();
    const text = e.target.querySelector('textarea').value.trim();
    if (!text && !media) return;
    if (!(await modCheck({ text, media }))) return;
    try { await api(`/clubs/${id}/posts`, { body: { text, media } }); media = null; toast('Paylaşıldı!'); await reload(); } catch (er) { toast(er.message); }
  });
  return null;
}

export default function clubs(view, id) { return id ? detail(view, id) : list(view); }

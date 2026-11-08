// Günün sorusu: herkese aynı soru, cevaplar beğenilir ve tartışılır
import { icon } from '../icons.js';
import { api, esc, toast, state, avatar, nm, ago } from '../core.js';

export default async function dq(view) {
  view.innerHTML = `<header class="topbar"><button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/')" aria-label="Geri">${icon('back')}</button><div class="center">Günün sorusu</div><span class="ib"></span></header><div class="dq"><div class="spinner"></div></div>`;
  const box = view.querySelector('.dq');
  let d; let sort = 'top'; let day = null; let editing = false;
  const open = new Set();
  const replyHtml = (a) => `<div class="dq-reps">${a.replies.map((r) => `<div class="dq-rep">${avatar(r.user, 26, { dot: false })}<div><b>${esc(r.user?.username || '')}</b> ${esc(r.text)} <small class="muted">${ago(r.at)}</small></div></div>`).join('')}
    <form class="dq-rf"><input class="field" maxlength="300" placeholder="Yanıt yaz..." aria-label="Yanıt yaz"><button class="ib" aria-label="Gönder">${icon('send')}</button></form></div>`;
  const card = (a) => `<article class="dq-a" data-id="${esc(a.id)}">
      <div class="dq-ah"><a href="#/u/${esc(a.user?.username)}">${avatar(a.user, 36, { dot: false })}</a><div class="grow"><a class="b" href="#/u/${esc(a.user?.username)}">${nm(a.user)}</a><small class="muted"> · ${ago(a.at)}</small></div>
        ${a.mine ? `<button class="ib sm dq-del" aria-label="Sil">${icon('trash')}</button>` : ''}</div>
      <p class="dq-t">${esc(a.text)}</p>
      <div class="dq-acts"><button class="dq-like ${a.liked ? 'on' : ''}">${icon(a.liked ? 'heart' : 'heart')} <span>${a.likeCount || ''}</span></button>
        <button class="dq-tog">${icon('comment')} <span>${a.replies.length || ''}</span> ${a.replies.length ? 'yanıt' : 'Yanıtla'}</button></div>
      ${open.has(a.id) ? replyHtml(a) : ''}</article>`;
  const paint = () => {
    const mine = d.mine;
    box.innerHTML = `<section class="dq-q"><small>${d.today ? 'Bugünün sorusu' : new Date(d.day).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}</small><h2>${esc(d.q)}</h2><span>${d.total} kişi cevapladı</span></section>
      ${d.today ? (mine && !editing ? `<div class="dq-mine"><small>Senin cevabın</small><p>${esc(mine.text)}</p><button class="btn sm dq-edit">${icon('edit')} Düzenle</button></div>`
    : `<form class="dq-f"><textarea class="field" maxlength="400" rows="3" placeholder="Cevabını yaz, herkes görsün...">${esc(mine?.text || '')}</textarea><button class="btn primary block">${mine ? 'Güncelle' : 'Cevapla'}</button></form>`) : ''}
      <div class="seg dq-seg"><button data-s="top" class="${sort === 'top' ? 'on' : ''}">En beğenilen</button><button data-s="new" class="${sort === 'new' ? 'on' : ''}">En yeni</button></div>
      <div class="dq-list">${d.items.length ? d.items.map(card).join('') : '<div class="empty" style="padding:24px">İlk cevabı sen yaz! ✍️</div>'}</div>
      <div class="dq-nav">${d.today ? '<button class="btn sm dq-prev">← Dünün sorusu</button>' : '<button class="btn sm dq-today">Bugünün sorusuna dön</button>'}</div>`;
  };
  const load = async () => { d = await api(`/dq?sort=${sort}${day ? `&day=${day}` : ''}`); paint(); };
  const swap = (a) => { const i = d.items.findIndex((x) => x.id === a.id); if (i >= 0) d.items[i] = a; if (a.mine) d.mine = a; const n = box.querySelector(`[data-id="${CSS.escape(a.id)}"]`); if (n) n.outerHTML = card(a); };
  box.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.classList.contains('dq-f')) {
      const text = f.querySelector('textarea').value.trim(); if (!text) return;
      f.querySelector('button').disabled = true;
      try { await api('/dq', { body: { text } }); editing = false; toast('Cevabın paylaşıldı 💬'); await load(); } catch (er) { toast(er.message); f.querySelector('button').disabled = false; }
    }
    if (f.classList.contains('dq-rf')) {
      const id = f.closest('[data-id]').dataset.id; const inp = f.querySelector('input'); const text = inp.value.trim(); if (!text) return;
      inp.value = '';
      try { swap(await api(`/dq/${id}/reply`, { body: { text } })); box.querySelector(`[data-id="${CSS.escape(id)}"] .dq-rf input`)?.focus(); } catch (er) { toast(er.message); }
    }
  });
  box.addEventListener('click', async (e) => {
    const s = e.target.closest('[data-s]'); if (s) { sort = s.dataset.s; load(); return; }
    if (e.target.closest('.dq-edit')) { editing = true; paint(); box.querySelector('.dq-f textarea')?.focus(); return; }
    if (e.target.closest('.dq-prev')) { const y = new Date(Date.now() + 3 * 3600000 - 86400000).toISOString().slice(0, 10); day = y; load(); return; }
    if (e.target.closest('.dq-today')) { day = null; load(); return; }
    const art = e.target.closest('[data-id]'); if (!art) return;
    const id = art.dataset.id;
    try {
      if (e.target.closest('.dq-like')) swap(await api(`/dq/${id}/like`, { body: {} }));
      if (e.target.closest('.dq-tog')) { open.has(id) ? open.delete(id) : open.add(id); swap(d.items.find((x) => x.id === id)); }
      if (e.target.closest('.dq-del') && confirm('Cevabın silinsin mi?')) { await api(`/dq/${id}`, { method: 'DELETE' }); load(); }
    } catch (er) { toast(er.message); }
  });
  await load();
  return null;
}

// Instagram tarzı yardımcılar: öne çıkanlar, gönderi anketi, gönderi istatistikleri, görülme takibi, notlar
import { icon } from './icons.js';
import {
  api, esc, toast, sheet, state, num, ago, avatar, nm, on,
} from './core.js';

// ---------- Hikaye küçük resmi (arşiv / öne çıkan kapakları) ----------
export function storyThumb(it, cls = '') {
  if (it.mediaType === 'image' && it.media) return `<span class="sthumb ${cls}"><img src="${esc(it.media)}" alt="" loading="lazy"></span>`;
  if (it.mediaType === 'video' && it.media) return `<span class="sthumb ${cls}"><video src="${esc(it.media)}#t=0.4" muted playsinline preload="metadata"></video></span>`;
  if (it.mediaType === 'card' && it.card) return `<span class="sthumb ${cls} st-card">🔮</span>`;
  const t = (it.stickers || []).find((x) => x.type === 'text')?.text || '';
  return `<span class="sthumb ${cls} tbg-${esc(it.bg || 'g2')}"><em>${esc(t.slice(0, 40))}</em></span>`;
}
const hlCover = (h) => (h.cover ? `<img src="${esc(h.cover)}" alt="" loading="lazy">` : `<span class="hl-ph tbg-${esc(h.bg || 'g2')}">${h.kind === 'card' ? '🔮' : icon('star')}</span>`);

// ---------- Profildeki öne çıkanlar satırı ----------
export function hlRowHtml(list, self) {
  if (!list?.length && !self) return '';
  return `<div class="hl-row" role="list">${self ? `<button class="hl hl-new" role="listitem"><span class="hl-c">${icon('plus')}</span><span class="hl-n">Yeni</span></button>` : ''}
    ${(list || []).map((h) => `<a class="hl" role="listitem" href="#/stories/hl-${esc(h.id)}" data-id="${esc(h.id)}"><span class="hl-c">${hlCover(h)}</span><span class="hl-n ellipsis">${esc(h.title)}</span></a>`).join('')}</div>`;
}
export function wireHlRow(root, { self, reload }) {
  const row = root.querySelector('.hl-row'); if (!row) return;
  row.querySelector('.hl-new')?.addEventListener('click', () => newHighlight(reload));
  if (!self) return;
  // Basılı tut: düzenle / sil
  let t = 0; let fired = false;
  row.addEventListener('pointerdown', (e) => {
    const a = e.target.closest('a.hl'); if (!a) return; fired = false;
    t = setTimeout(() => { fired = true; navigator.vibrate?.(10); hlMenu(a.dataset.id, a.querySelector('.hl-n').textContent, reload); }, 520);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => row.addEventListener(ev, () => clearTimeout(t)));
  row.addEventListener('click', (e) => { if (fired && e.target.closest('a.hl')) { e.preventDefault(); fired = false; } });
  row.addEventListener('contextmenu', (e) => { if (e.target.closest('a.hl')) e.preventDefault(); });
}
export function hlMenu(id, title, reload) {
  sheet(title, `<div class="menu"><button data-a="add">${icon('plus')}Hikaye ekle</button><button data-a="ren">${icon('edit')}Adını değiştir</button><button data-a="del" class="danger">${icon('trash')}Öne çıkanı sil</button></div>`, {
    onMount(sh, close) {
      sh.querySelector('.menu').onclick = async (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; close();
        try {
          if (a === 'add') return pickStories({ title: 'Hikaye ekle', go: 'Ekle', hlId: id, done: reload });
          if (a === 'ren') {
            const t = prompt('Öne çıkanın adı', title); if (t == null) return;
            await api(`/highlights/${id}`, { method: 'PATCH', body: { title: t } }); toast('Ad değiştirildi.'); reload?.();
          }
          if (a === 'del' && confirm(`“${title}” öne çıkanı silinsin mi? Hikayeler arşivinde kalır.`)) { await api(`/highlights/${id}`, { method: 'DELETE' }); toast('Öne çıkan silindi.'); reload?.(); }
        } catch (er) { toast(er.message); }
      };
    },
  });
}
export const newHighlight = (reload) => pickStories({ title: 'Yeni öne çıkan', go: 'İleri', named: true, done: reload });

// Arşivden hikaye seç (yeni öne çıkan ya da var olana ekle)
export function pickStories({ title, go, hlId = null, named = false, done }) {
  sheet(title, '<div class="pk-arch"><div class="spinner"></div></div>', {
    async onMount(sh, close) {
      const box = sh.querySelector('.pk-arch');
      let list = [];
      try { list = await api('/me/archive'); } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
      if (hlId) list = list.filter((s) => !s.highlights.includes(hlId));
      if (!list.length) { box.innerHTML = `<div class="empty"><div class="big">${icon('camera')}</div><h2>Arşivin boş</h2>Paylaştığın hikayeler 30 gün boyunca burada durur ve öne çıkanlara eklenebilir.<p><a class="btn primary" href="#/create/story">Hikaye paylaş</a></p></div>`; return; }
      const sel = new Set();
      box.innerHTML = `${named ? '<input class="field hl-t" maxlength="24" placeholder="Öne çıkanın adı (ör. Tatil)">' : ''}
        <div class="arch-grid">${list.map((s) => `<button type="button" class="ag" data-id="${esc(s.id)}">${storyThumb(s)}<span class="ag-d">${new Date(s.at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span><i class="ag-c">${icon('check')}</i></button>`).join('')}</div>
        <div class="pk-go"><button class="btn primary block go" disabled>${esc(go)}</button></div>`;
      const gob = box.querySelector('.go');
      box.querySelector('.arch-grid').onclick = (e) => {
        const b = e.target.closest('.ag'); if (!b) return;
        const id = b.dataset.id; sel.has(id) ? sel.delete(id) : sel.add(id);
        b.classList.toggle('on', sel.has(id)); gob.disabled = !sel.size;
        gob.textContent = sel.size ? `${go} · ${sel.size}` : go;
      };
      gob.onclick = async () => {
        gob.disabled = true;
        try {
          const t = box.querySelector('.hl-t')?.value.trim();
          await api('/highlights', { body: { id: hlId || undefined, title: t || 'Öne çıkan', storyIds: [...sel] } });
          close(); toast(hlId ? 'Öne çıkana eklendi.' : 'Öne çıkan oluşturuldu ✨'); done?.();
        } catch (er) { toast(er.message); gob.disabled = false; }
      };
    },
  });
}

// Hikaye izlerken "Öne çıkar": var olan öne çıkana ya da yenisine ekle
export function addStoryToHighlight(storyId, { onClose } = {}) {
  sheet('Öne çıkar', '<div class="hl-pick"><div class="spinner"></div></div>', {
    onClose,
    async onMount(sh, close) {
      const box = sh.querySelector('.hl-pick');
      const list = await api(`/users/${state.me.id}/highlights`).catch(() => []);
      box.innerHTML = `<div class="hl-row in-sheet"><button class="hl hl-new"><span class="hl-c">${icon('plus')}</span><span class="hl-n">Yeni</span></button>
        ${list.map((h) => `<button class="hl" data-id="${esc(h.id)}"><span class="hl-c">${hlCover(h)}</span><span class="hl-n ellipsis">${esc(h.title)}</span></button>`).join('')}</div>
        <form class="hl-nf" hidden><input class="field" maxlength="24" placeholder="Öne çıkanın adı"><button class="btn primary">Ekle</button></form>`;
      const add = async (body) => {
        try { await api('/highlights', { body: { ...body, storyIds: [storyId] } }); close(); toast('Profilinde öne çıkarıldı ✨'); } catch (er) { toast(er.message); }
      };
      box.querySelector('.hl-new').onclick = () => { const f = box.querySelector('.hl-nf'); f.hidden = false; f.querySelector('input').focus(); };
      box.querySelector('.hl-nf').onsubmit = (e) => { e.preventDefault(); add({ title: e.currentTarget.querySelector('input').value || 'Öne çıkan' }); };
      box.querySelectorAll('.hl[data-id]').forEach((b) => { b.onclick = () => add({ id: b.dataset.id }); });
    },
  });
}

// ---------- Gönderi anketi ----------
export function postPollHtml(p) {
  const x = p.poll; if (!x) return '';
  const done = x.mine != null || p.user?.id === state.me.id;
  return `<div class="ppoll ${done ? 'done' : ''}" data-poll="${esc(p.id)}">${x.q ? `<b class="pp-q">${esc(x.q)}</b>` : ''}
    ${x.options.map((o, i) => {
    const pct = x.total ? Math.round(((x.counts[i] || 0) / x.total) * 100) : 0;
    return `<button type="button" data-o="${i}" class="pp-o ${x.mine === i ? 'me' : ''}" ${done ? 'aria-disabled="true"' : ''}><i style="width:${done ? pct : 0}%"></i><span>${esc(o)}</span>${done ? `<em>%${pct}</em>` : ''}</button>`;
  }).join('')}<small class="pp-n">${num(x.total)} oy${x.mine != null ? ' · oyunu değiştirmek için başka seçeneğe dokun' : ''}</small></div>`;
}
export function wirePostPoll(root, p) {
  const box = root.querySelector('.ppoll'); if (!box) return;
  box.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-o]'); if (!b || p.user?.id === state.me.id) return;
    e.stopPropagation();
    try {
      const r = await api(`/posts/${p.id}/vote`, { body: { option: +b.dataset.o } });
      p.poll = r; box.outerHTML = postPollHtml(p); wirePostPoll(root, p); navigator.vibrate?.(10);
    } catch (er) { toast(er.message); }
  });
}
on('post:poll', ({ id, counts, total }) => {
  document.querySelectorAll(`.ppoll.done[data-poll="${CSS.escape(id)}"]`).forEach((box) => {
    box.querySelectorAll('[data-o]').forEach((b, i) => {
      const pct = total ? Math.round(((counts[i] || 0) / total) * 100) : 0;
      const bar = b.querySelector('i'); if (bar) bar.style.width = `${pct}%`; const em = b.querySelector('em'); if (em) em.textContent = `%${pct}`;
    });
    const n = box.querySelector('.pp-n'); if (n) n.firstChild.textContent = `${num(total)} oy`;
  });
});

// ---------- Görülme takibi (gösterim / erişim) ----------
export function trackSeen(root, src) {
  if (!('IntersectionObserver' in window)) return () => {};
  const seen = new Set(); const timers = new Map(); let queue = [];
  let flushT = 0;
  const flush = () => { flushT = 0; if (!queue.length) return; const ids = queue.splice(0, 40); api('/insights/seen', { body: { ids, src } }).catch(() => {}); };
  const io = new IntersectionObserver((ents) => ents.forEach((e) => {
    const id = e.target.dataset.post; if (!id || seen.has(id)) return;
    if (e.isIntersecting && e.intersectionRatio >= 0.5) {
      if (!timers.has(id)) timers.set(id, setTimeout(() => { seen.add(id); timers.delete(id); queue.push(id); if (!flushT) flushT = setTimeout(flush, 2500); }, 900));
    } else { clearTimeout(timers.get(id)); timers.delete(id); }
  }), { threshold: [0, 0.5, 1] });
  const scan = () => root.querySelectorAll('.post[data-post]').forEach((el) => { if (!el.dataset.sw) { el.dataset.sw = '1'; io.observe(el); } });
  scan();
  const mo = new MutationObserver(scan); mo.observe(root, { childList: true, subtree: true });
  return () => { io.disconnect(); mo.disconnect(); timers.forEach(clearTimeout); flush(); };
}

// ---------- Gönderi istatistikleri ----------
const SRC_NAME = { feed: 'Ana sayfa', profile: 'Profil', explore: 'Keşfet', tag: 'Etiketler', post: 'Profil ve bağlantılar', reels: 'Vitrin', other: 'Diğer' };
export function postInsights(p) {
  sheet('Gönderi istatistikleri', '<div class="ins"><div class="spinner"></div></div>', {
    async onMount(sh) {
      const box = sh.querySelector('.ins');
      let d;
      try { d = await api(`/insights/post/${p.id}`); } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
      const max = Math.max(1, ...d.days.map((x) => x.n));
      const src = Object.entries(d.src || {}).sort((a, b) => b[1] - a[1]);
      const srcTot = src.reduce((a, [, n]) => a + n, 0) || 1;
      const dn = (s) => new Date(`${s}T12:00:00`).toLocaleDateString('tr-TR', { weekday: 'short' });
      box.innerHTML = `<div class="ins-top"><div><b>${num(d.reach)}</b><span>Erişilen hesap</span></div><div><b>${num(d.imp)}</b><span>Gösterim</span></div><div><b>${num(d.interactions)}</b><span>Etkileşim</span></div></div>
        <div class="ins-grid">
          <div>${icon('heart')}<b>${num(d.likes)}</b><span>Beğeni</span></div>
          <div>${icon('comment')}<b>${num(d.comments)}</b><span>Yorum</span></div>
          <div>${icon('repost')}<b>${num(d.reposts)}</b><span>Yeniden paylaşım</span></div>
          <div>${icon('bookmark')}<b>${num(d.saves)}</b><span>Kaydetme</span></div>
          <div>${icon('person')}<b>${num(d.visits)}</b><span>Profil ziyareti</span></div>
          ${d.poll ? `<div>${icon('poll')}<b>${num(d.poll.total)}</b><span>Anket oyu</span></div>` : `<div>${icon('bolt')}<b>%${d.rate}</b><span>Etkileşim oranı</span></div>`}
        </div>
        <div class="ins-sec"><b>Son 7 gün gösterim</b><div class="ins-bars">${d.days.map((x) => `<div class="ib-c"><i style="height:${Math.round((x.n / max) * 100)}%" title="${x.n}"></i><small>${dn(x.day)}</small></div>`).join('')}</div></div>
        <div class="ins-sec"><b>Erişim</b><div class="ins-split"><span style="width:${100 - d.nonFollowerPct}%"></span></div>
          <div class="row ins-leg"><span><i class="f"></i>Takipçiler %${100 - d.nonFollowerPct}</span><span><i></i>Takipçi olmayanlar %${d.nonFollowerPct}</span></div></div>
        ${src.length ? `<div class="ins-sec"><b>Gösterimlerin geldiği yer</b>${src.map(([k, n]) => `<div class="ins-src"><span class="grow">${SRC_NAME[k] || k}</span><span class="bar"><i style="width:${Math.round((n / srcTot) * 100)}%"></i></span><em>${num(n)}</em></div>`).join('')}</div>` : ''}
        <p class="muted ins-note">${ago(d.createdAt)} paylaşıldı. Gösterim, gönderinin ekranda en az yarısıyla görüldüğü sayıdır; erişim onu gören farklı hesap sayısıdır.</p>`;
    },
  });
}

// ---------- Notlar (mesajlar ekranı) ----------
export function notesRowHtml(list) {
  const mine = list.find((n) => n.userId === state.me.id);
  const others = list.filter((n) => n.userId !== state.me.id);
  return `<div class="notes-row">
    <button class="note me" data-u="${esc(state.me.id)}"><span class="nb ${mine ? '' : 'empty'}">${mine ? esc(mine.text) : 'Not bırak…'}</span>${avatar(state.me, 64, { dot: false })}<span class="nn">${mine ? 'Notun' : 'Notun'}</span></button>
    ${others.map((n) => `<button class="note ${n.audience === 'close' ? 'close' : ''}" data-u="${esc(n.userId)}"><span class="nb">${esc(n.text)}</span>${avatar(n.user, 64, { dot: false })}<span class="nn ellipsis">${esc(n.user.name.split(' ')[0])}</span></button>`).join('')}</div>`;
}
export function noteSheet(list, uid, reload) {
  const n = list.find((x) => x.userId === uid);
  if (uid === state.me.id) {
    const close = sheet(n ? 'Notun' : 'Yeni not', `<form class="note-f"><div class="nf-av">${avatar(state.me, 72, { dot: false })}<span class="nb big"><textarea maxlength="60" rows="2" placeholder="Aklından ne geçiyor?">${esc(n?.text || '')}</textarea></span></div>
      <small class="muted nf-c">${(n?.text || '').length} / 60 · 24 saat görünür${n ? ` · ${num(n.likeCount || 0)} beğeni` : ''}</small>
      <div class="seg nf-aud"><button type="button" data-a="all" class="${n?.audience !== 'close' ? 'on' : ''}">Karşılıklı takipleştiklerin</button><button type="button" data-a="close" class="${n?.audience === 'close' ? 'on' : ''}">${icon('star')} Yakın arkadaşlar</button></div>
      <button class="btn primary block">Paylaş</button>${n ? '<button type="button" class="btn block nf-del">Notu sil</button>' : ''}</form>`, {
      onMount(sh, closeS) {
        const f = sh.querySelector('form'); const ta = f.querySelector('textarea'); let aud = n?.audience || 'all';
        setTimeout(() => ta.focus(), 60);
        ta.oninput = () => { f.querySelector('.nf-c').firstChild.textContent = `${ta.value.length} / 60 · 24 saat görünür`; };
        f.querySelector('.nf-aud').onclick = (e) => { const b = e.target.closest('[data-a]'); if (!b) return; aud = b.dataset.a; f.querySelectorAll('.nf-aud button').forEach((x) => x.classList.toggle('on', x === b)); };
        f.onsubmit = async (e) => { e.preventDefault(); try { await api('/notes', { body: { text: ta.value, audience: aud } }); closeS(); toast('Notun paylaşıldı.'); reload(); } catch (er) { toast(er.message); } };
        f.querySelector('.nf-del')?.addEventListener('click', async () => { await api('/notes', { method: 'DELETE' }).catch(() => {}); closeS(); toast('Not silindi.'); reload(); });
      },
    });
    return close;
  }
  if (!n) return null;
  return sheet(null, `<div class="note-v">${avatar(n.user, 72, { dot: false })}<b>${nm(n.user)}</b><small class="muted">${ago(n.at)}${n.audience === 'close' ? ' · yakın arkadaşlar' : ''}</small><p class="nv-t">${esc(n.text)}</p>
    <form class="note-r"><button type="button" class="nl ${n.liked ? 'on' : ''}" aria-label="Beğen">${icon('heart', '', n.liked ? 'fill="currentColor"' : '')}</button><input class="field" maxlength="500" placeholder="${esc(n.user.name.split(' ')[0])} kişisine yanıt ver…"><button class="btn primary sm">Gönder</button></form></div>`, {
    onMount(sh, closeS) {
      const f = sh.querySelector('.note-r');
      f.querySelector('.nl').onclick = async (e) => {
        const b = e.currentTarget;
        try { const r = await api(`/notes/${uid}/like`, { body: {} }); n.liked = r.liked; b.classList.toggle('on', r.liked); b.innerHTML = icon('heart', '', r.liked ? 'fill="currentColor"' : ''); navigator.vibrate?.(10); } catch (er) { toast(er.message); }
      };
      f.onsubmit = async (e) => {
        e.preventDefault(); const t = f.querySelector('input').value.trim(); if (!t) return;
        try { const r = await api(`/notes/${uid}/reply`, { body: { text: t } }); closeS(); toast('Yanıtın mesaj olarak gönderildi.'); location.hash = `#/chat/${r.chatId}`; } catch (er) { toast(er.message); }
      };
    },
  });
}

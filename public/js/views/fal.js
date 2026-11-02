import { icon } from '../icons.js';
import {
  state, api, esc, toast, sheet, avatar, pickFile, compressImage, uploadFile, el,
} from '../core.js';
import {
  coffeeReading, TAROT, TAROT_POS, ZODIAC, horoscope, compat, today, seeded,
} from '../fal-data.js';

const back = (to = '#/fal') => `<header class="topbar"><a class="ib" href="${to}" aria-label="Geri">${icon('back')}</a><div class="center fal-title"></div><span class="ib"></span></header>`;
const note = '<p class="fal-note">Fallar eğlence amaçlıdır.</p>';

// ---- Geçmiş ----
const hist = {
  all() { try { return JSON.parse(localStorage.getItem('su_fal') || '[]'); } catch { return []; } },
  add(item) { const a = [{ ...item, at: Date.now() }, ...this.all()].slice(0, 20); try { localStorage.setItem('su_fal', JSON.stringify(a)); } catch {} },
};

// ---- Sohbete gönder ----
async function sendToChat(text, media) {
  const chats = await api('/chats').catch(() => []);
  sheet('Kime gönderilsin?', chats.length
    ? `<div class="cl">${chats.map((c) => `<button class="list-item" data-id="${esc(c.id)}">${avatar(c.other, 44, { dot: !c.isGroup })}<div class="grow"><div class="b">${esc(c.other.name)}</div><div class="sub">${c.isGroup ? 'Grup' : '@' + esc(c.other.username)}</div></div>${icon('send')}</button>`).join('')}</div>`
    : '<div class="empty">Henüz sohbetin yok. Önce biriyle eşleş ya da mesajlaş.</div>', {
    onMount(sh, close) {
      sh.querySelector('.cl')?.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-id]'); if (!b) return;
        close();
        try {
          for (const m of media || []) await new Promise((r) => state.socket.emit('message:send', { chatId: b.dataset.id, media: m, mediaType: 'image' }, r));
          await new Promise((r) => state.socket.emit('message:send', { chatId: b.dataset.id, text }, r));
          toast('Gönderildi.', { href: `#/chat/${b.dataset.id}` });
        } catch (er) { toast(er.message); }
      });
    },
  });
}

// ================= Ana ekran =================
function hub(view) {
  const me = state.me;
  const h = me.zodiac ? horoscope(me.zodiac) : null;
  const past = hist.all();
  view.innerHTML = `<header class="topbar"><a class="ib" href="#/" aria-label="Geri">${icon('back')}</a><h1 style="justify-content:center"><span>Fal</span></h1><span class="ib"></span></header>
    <a class="fal-hero" href="#/fal/burc">
      ${h ? `<span class="zs">${h.z[2]}</span><div class="grow"><b>${h.z[1]} · bugün</b><p>${esc(h.genel)}</p></div>`
    : `<span class="zs">✨</span><div class="grow"><b>Günlük burç yorumun</b><p>Burcunu seç, her gün sana özel yorum gelsin.</p></div>`}
    </a>
    <div class="fal-grid">
      <a class="fal-tile" href="#/fal/kahve"><span class="em">☕️</span><b>Kahve falı</b><span>Fincanının fotoğrafını çek, telveleri okuyalım.</span></a>
      <a class="fal-tile" href="#/fal/tarot"><span class="em">🔮</span><b>Tarot</b><span>Üç kart seç: geçmiş, şimdi, gelecek.</span></a>
      <a class="fal-tile" href="#/fal/uyum"><span class="em">💞</span><b>Aşk uyumu</b><span>Eşleşmenle aranızdaki uyuma bak.</span></a>
      <a class="fal-tile" href="#/fal/burc"><span class="em">♈</span><b>Burcun</b><span>Aşk, iş, şans sayısı ve rengi.</span></a>
    </div>
    ${past.length ? `<div class="section-t"><span>Son falların</span></div>${past.slice(0, 6).map((p) => `<div class="list-item"><span class="fal-mini">${p.em}</span><div class="grow"><div class="b">${esc(p.title)}</div><div class="sub ellipsis">${esc(p.text)}</div></div></div>`).join('')}` : ''}
    ${note}`;
  return null;
}

// ================= Kahve falı =================
function kahve(view) {
  const files = [];
  const step1 = () => {
    view.innerHTML = `${back()}<div class="fal-pad">
      <div class="fal-head"><span class="em">☕️</span><h2>Kahve falı</h2><p class="muted">Kahveni iç, fincanı tabağa kapat ve soğumasını bekle. Sonra fincanın içinden iki, tabaktan bir fotoğraf çek.</p></div>
      <div class="cup-slots">${['Fincan 1', 'Fincan 2', 'Tabak'].map((l, i) => `<button class="cup-slot" data-i="${i}">${files[i] ? `<img src="${URL.createObjectURL(files[i])}" alt="">` : `${icon('camera')}<span>${l}</span>`}</button>`).join('')}</div>
      <button class="btn primary block go" ${files.length ? '' : 'disabled'}>Falıma bak</button>
      <button class="btn outline block fr" ${files.length ? '' : 'disabled'}>${icon('users')} Bir arkadaşa baktır</button>
      ${note}</div>`;
    view.querySelector('.fal-title').textContent = 'Kahve falı';
    view.querySelector('.cup-slots').onclick = async (e) => {
      const b = e.target.closest('.cup-slot'); if (!b) return;
      const f = await pickFile('image/*', 'environment'); if (!f) return;
      files[+b.dataset.i] = f; step1();
    };
    view.querySelector('.go').onclick = reading;
    view.querySelector('.fr').onclick = async () => {
      toast('Fotoğraflar hazırlanıyor...', { ms: 1500 });
      try {
        const urls = [];
        for (const f of files.filter(Boolean)) urls.push((await uploadFile(await compressImage(f, 1080, 0.8))).url);
        sendToChat('Falıma bakar mısın? ☕️🔮', urls);
      } catch (er) { toast(er.message); }
    };
  };
  const reading = () => {
    view.innerHTML = `${back()}<div class="fal-wait"><div class="cup">☕️<i></i><i></i><i></i></div><h2>Telveler okunuyor…</h2><p class="muted">Fincanın soğusun, semboller beliriyor.</p></div>`;
    view.querySelector('.fal-title').textContent = 'Kahve falı';
    const seed = `${state.me.id}|${today()}|${files.filter(Boolean).map((f) => `${f.size}:${f.lastModified}`).join(',')}`;
    const r = coffeeReading(seed);
    setTimeout(() => {
      if (!view.isConnected) return;
      view.innerHTML = `${back()}<div class="fal-pad">
        <div class="fal-head"><span class="em">☕️</span><h2>Fincanında neler var?</h2></div>
        <div class="sym-row">${r.syms.map(([e, n]) => `<div class="sym"><span>${e}</span><b>${n}</b></div>`).join('')}<div class="sym"><span>${esc(r.letter)}</span><b>Harf</b></div></div>
        <div class="fal-card"><h3>Genel</h3><p>${esc(r.genel)}</p></div>
        ${r.syms.map(([e, n, m]) => `<div class="fal-card"><h3>${e} ${n}</h3><p>${esc(m)}</p></div>`).join('')}
        <div class="fal-card"><h3>💗 Aşk</h3><p>${esc(r.ask)}</p></div>
        <div class="fal-card"><h3>💼 İş ve para</h3><p>${esc(r.para)}</p></div>
        <div class="fal-card"><h3>🌿 Ruh hali</h3><p>${esc(r.ruh)}</p></div>
        <div class="fal-card"><h3>⏳ Üç vakte kadar</h3><p>${esc(r.vakit.charAt(0).toUpperCase() + r.vakit.slice(1))}</p></div>
        <div class="fal-card hl"><h3>🍽️ Tabak: ${esc(r.dilek[0])}</h3><p>${esc(r.dilek[1])}</p></div>
        <button class="btn primary block sh">${icon('send')} Sohbete gönder</button>
        <a class="btn outline block" href="#/fal">Başka fal</a>${note}</div>`;
      view.querySelector('.fal-title').textContent = 'Kahve falı';
      const text = `☕️ Kahve falım\n${r.syms.map(([e, n]) => `${e} ${n}`).join(' · ')}\n\n${r.genel}\n💗 ${r.ask}\n🍽️ ${r.dilek[1]}`;
      hist.add({ em: '☕️', title: 'Kahve falı', text: r.genel });
      view.querySelector('.sh').onclick = () => sendToChat(text);
    }, 3600);
  };
  step1();
  return null;
}

// ================= Tarot =================
function tarot(view) {
  const r = seeded(`${state.me.id}|${Date.now()}`);
  const deck = r.some(TAROT, 9).map((c) => ({ c, rev: r.rnd() < 0.3 }));
  const picked = [];
  view.innerHTML = `${back()}<div class="fal-pad">
    <div class="fal-head"><span class="em">🔮</span><h2>Üç kart seç</h2><p class="muted">Aklındaki soruya odaklan ve içinden gelen kartlara dokun.</p></div>
    <div class="tarot-row">${TAROT_POS.map((p, i) => `<div class="slot" data-i="${i}"><div class="tcard"><div class="face back"></div><div class="face front"></div></div><span>${p}</span></div>`).join('')}</div>
    <div class="tarot-deck">${deck.map((_, i) => `<button class="dcard" data-i="${i}" aria-label="Kart seç" style="--r:${(i - 4) * 6}deg;--y:${Math.abs(i - 4) * 5}px"></button>`).join('')}</div>
    <div class="tarot-out"></div>${note}</div>`;
  view.querySelector('.fal-title').textContent = 'Tarot';
  view.querySelector('.tarot-deck').onclick = (e) => {
    const b = e.target.closest('.dcard'); if (!b || picked.length >= 3 || b.disabled) return;
    b.disabled = true; b.classList.add('gone');
    const d = deck[+b.dataset.i]; picked.push(d);
    const slot = view.querySelectorAll('.slot')[picked.length - 1];
    slot.querySelector('.front').innerHTML = `<span class="ico">${d.c[2]}</span><b>${esc(d.c[1])}</b><small>${d.c[0]}${d.rev ? ' · ters' : ''}</small>`;
    if (d.rev) slot.querySelector('.front').classList.add('rev');
    requestAnimationFrame(() => slot.querySelector('.tcard').classList.add('flip'));
    navigator.vibrate?.(10);
    if (picked.length === 3) {
      setTimeout(() => {
        const out = view.querySelector('.tarot-out');
        view.querySelector('.tarot-deck').hidden = true;
        out.innerHTML = picked.map((d, i) => `<div class="fal-card"><h3>${TAROT_POS[i]} · ${d.c[2]} ${esc(d.c[1])}${d.rev ? ' (ters)' : ''}</h3><p>${esc(d.rev ? d.c[4] : d.c[3])}</p></div>`).join('')
          + `<button class="btn primary block sh">${icon('send')} Sohbete gönder</button><button class="btn outline block again">Yeniden çek</button>`;
        const text = `🔮 Tarot falım\n${picked.map((d, i) => `${TAROT_POS[i]}: ${d.c[2]} ${d.c[1]}${d.rev ? ' (ters)' : ''} — ${d.rev ? d.c[4] : d.c[3]}`).join('\n')}`;
        hist.add({ em: '🔮', title: 'Tarot', text: picked.map((d) => d.c[1]).join(' · ') });
        out.querySelector('.sh').onclick = () => sendToChat(text);
        out.querySelector('.again').onclick = () => tarot(view);
        out.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 900);
    }
  };
  return null;
}

// ================= Burç =================
function burc(view, dayOffset = 0) {
  const me = state.me;
  const pickSign = () => {
    view.innerHTML = `${back()}<div class="fal-pad"><div class="fal-head"><span class="em">✨</span><h2>Burcun hangisi?</h2><p class="muted">Bir kez seç, profilinde saklanır.</p></div>
      <div class="z-grid">${ZODIAC.map(([id, n, s, d]) => `<button class="z-opt ${me.zodiac === id ? 'on' : ''}" data-z="${id}"><span>${s}</span><b>${n}</b><small>${d}</small></button>`).join('')}</div>${note}</div>`;
    view.querySelector('.fal-title').textContent = 'Burcun';
    view.querySelector('.z-grid').onclick = async (e) => {
      const b = e.target.closest('[data-z]'); if (!b) return;
      try { Object.assign(state.me, await api('/me', { method: 'PATCH', body: { zodiac: b.dataset.z } })); burc(view); } catch (er) { toast(er.message); }
    };
  };
  if (!me.zodiac) { pickSign(); return null; }
  const d = new Date(); d.setDate(d.getDate() + dayOffset);
  const h = horoscope(me.zodiac, d.toISOString().slice(0, 10));
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
  view.innerHTML = `${back()}<div class="fal-pad">
    <div class="fal-head"><span class="em z">${h.z[2]}</span><h2>${h.z[1]}</h2><p class="muted">${h.z[3]} · ${h.z[4]} grubu</p></div>
    <div class="seg"><button class="${dayOffset ? '' : 'on'}" data-o="0">Bugün</button><button class="${dayOffset ? 'on' : ''}" data-o="1">Yarın</button></div>
    <div class="fal-card"><h3>Genel</h3><p>${esc(h.genel)}</p></div>
    <div class="fal-card"><h3>💗 Aşk <span class="stars">${stars(h.puan.ask)}</span></h3><p>${esc(h.ask)}</p></div>
    <div class="fal-card"><h3>💼 İş ve para <span class="stars">${stars(h.puan.is)}</span></h3><p>${esc(h.is)}</p></div>
    <div class="fal-stats"><div><b>${h.sayi}</b><span>Şans sayısı</span></div><div><b>${esc(h.renk)}</b><span>Şans rengi</span></div><div><b>${h.uyum[2]} ${esc(h.uyum[1])}</b><span>Uyumlu burç</span></div></div>
    <button class="btn primary block sh">${icon('send')} Sohbete gönder</button>
    <button class="btn outline block ch">Burcumu değiştir</button>${note}</div>`;
  view.querySelector('.fal-title').textContent = 'Günlük burç';
  view.querySelector('.seg').onclick = (e) => { const b = e.target.closest('[data-o]'); if (b) burc(view, +b.dataset.o); };
  view.querySelector('.ch').onclick = pickSign;
  view.querySelector('.sh').onclick = () => sendToChat(`${h.z[2]} ${h.z[1]} · ${dayOffset ? 'yarın' : 'bugün'}\n${h.genel}\n💗 ${h.ask}\nŞans sayısı: ${h.sayi} · Renk: ${h.renk}`);
  return null;
}

// ================= Aşk uyumu =================
async function uyum(view) {
  view.innerHTML = `${back()}<div class="fal-pad"><div class="fal-head"><span class="em">💞</span><h2>Kiminle uyumunu merak ediyorsun?</h2></div><div class="pl"><div class="spinner"></div></div>${note}</div>`;
  view.querySelector('.fal-title').textContent = 'Aşk uyumu';
  const [matches, people] = await Promise.all([api('/matches').catch(() => []), api('/people').catch(() => [])]);
  const seen = new Set(); const list = [];
  matches.forEach((m) => { if (!seen.has(m.user.id)) { seen.add(m.user.id); list.push({ ...m.user, matched: true }); } });
  people.forEach((u) => { if (!seen.has(u.id)) { seen.add(u.id); list.push(u); } });
  const pl = view.querySelector('.pl');
  pl.innerHTML = list.length ? list.map((u) => `<button class="list-item" data-id="${esc(u.id)}">${avatar(u, 44)}<div class="grow"><div class="b">${esc(u.name)}</div><div class="sub">${u.matched ? '💞 Eşleşmen' : '@' + esc(u.username)}</div></div>${icon('heart')}</button>`).join('')
    : '<div class="empty">Henüz kimse yok. Önce birkaç kişiyle tanış.</div>';
  pl.onclick = async (e) => {
    const b = e.target.closest('[data-id]'); if (!b) return;
    const other = await api(`/users/${b.dataset.id}`);
    const c = compat(state.me, other);
    view.innerHTML = `${back('#/fal/uyum')}<div class="fal-pad">
      <div class="uyum-pair"><img class="av" src="${esc(state.me.avatar)}" alt=""><span>💞</span><img class="av" src="${esc(other.avatar)}" alt=""></div>
      <div class="uyum-ring" style="--p:0"><b>%0</b></div>
      <div class="fal-head" style="margin-top:6px"><h2>${esc(c.title)}</h2><p class="muted">${esc(state.me.name.split(' ')[0])} & ${esc(other.name.split(' ')[0])}${c.za && c.zb ? ` · ${c.za[2]} ${c.za[1]} + ${c.zb[2]} ${c.zb[1]}` : ''}</p></div>
      <div class="fal-card"><p>${esc(c.text)}</p></div>
      <div class="bars">${[['Aşk', c.ask], ['Dostluk', c.dostluk], ['İletişim', c.iletisim]].map(([l, v]) => `<div><span>${l}</span><i><b style="width:${v}%"></b></i><em>%${v}</em></div>`).join('')}</div>
      ${!c.za || !c.zb ? `<p class="muted" style="font-size:13px">${!state.me.zodiac ? 'Burcunu seçersen sonuç daha isabetli olur. ' : ''}${!other.zodiac ? `${esc(other.name.split(' ')[0])} burcunu seçmemiş.` : ''}</p>` : ''}
      <button class="btn primary block sh">${icon('send')} ${esc(other.name.split(' ')[0])} kişisine gönder</button>${note}</div>`;
    view.querySelector('.fal-title').textContent = 'Aşk uyumu';
    const ring = view.querySelector('.uyum-ring'); const lbl = ring.querySelector('b');
    let p = 0; const t = setInterval(() => { p = Math.min(c.score, p + 2); ring.style.setProperty('--p', p); lbl.textContent = `%${p}`; if (p >= c.score) clearInterval(t); }, 18);
    hist.add({ em: '💞', title: `Aşk uyumu · ${other.name}`, text: `%${c.score} · ${c.title}` });
    view.querySelector('.sh').onclick = async () => {
      try {
        const chat = await api('/chats', { body: { userId: other.id } });
        await new Promise((r) => state.socket.emit('message:send', { chatId: chat.id, text: `💞 Aşk uyumumuz %${c.score} çıktı: ${c.title}!\n${c.text}` }, r));
        toast('Gönderildi.', { href: `#/chat/${chat.id}` });
      } catch (er) { toast(er.message); }
    };
  };
  return null;
}

export default function fal(view, sub) {
  if (sub === 'kahve') return kahve(view);
  if (sub === 'tarot') return tarot(view);
  if (sub === 'burc') return burc(view);
  if (sub === 'uyum') return uyum(view);
  return hub(view);
}
export { el };

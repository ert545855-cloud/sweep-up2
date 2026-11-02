import { icon } from '../icons.js';
import { api, esc, toast, isOn, state, sheet, on, tick, plusSheet, needCoins } from '../core.js';
import { showMatch } from '../app.js';

export default async function swipe(view) {
  view.innerHTML = `<header class="topbar">
      <h1><span>Keşfet</span></h1>
      <button class="ib soft bst" aria-label="Boost">${icon('bolt')}</button>
      <a class="ib soft lk" href="#/likes" aria-label="Seni beğenenler">${icon('heart')}<span class="num-badge lkn" ${state.badges.likes ? '' : 'hidden'}>${state.badges.likes}</span></a>
      <button class="ib soft flt" aria-label="Filtreler">${icon('sliders')}</button>
    </header>
    <div class="swipe-wrap">
      <div class="deck" aria-live="polite"><div class="spinner" style="margin-top:30vh"></div></div>
      <div class="swipe-btns">
        <button class="sm undo" aria-label="Geri al" style="color:#f5b400">${icon('undo')}</button>
        <button class="nope" aria-label="Geç">${icon('x')}</button>
        <button class="like" aria-label="Beğen">${icon('heart')}</button>
        <button class="sm super" aria-label="Süper beğeni">${icon('star')}</button>
      </div>
    </div>`;

  const deckEl = view.querySelector('.deck');
  let deck = await api('/swipe/deck');
  let history = [];
  let busy = false;

  const cardHtml = (u) => `<div class="card" data-id="${esc(u.id)}">
      ${u.photos.map((p, i) => `<img class="ph" src="${esc(p)}" alt="" style="${i ? 'display:none' : ''}" ${i ? 'loading="lazy"' : ''} draggable="false">`).join('')}
      ${u.photos.length > 1 ? `<div class="segs">${u.photos.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>` : ''}
      <div class="grad"></div>
      <div class="tagrow">${u.boosted ? `<span class="boosted">${icon('bolt')}Öne çıkan</span>` : ''}${u.likedYou ? '<span class="liked-you">Seni beğendi</span>' : ''}${isOn(u) ? '<span>Çevrimiçi</span>' : ''}</div>
      <div class="stamp like">BEĞEN</div><div class="stamp nope">GEÇ</div><div class="stamp super">SÜPER</div>
      <div class="info">
        <h2>${esc(u.name.split(' ')[0])} ${u.age ? `<small>${u.age}</small>` : ''}${tick(u)}</h2>
        <div class="where">${u.city || u.distanceKm ? `${icon('pin', '', 'style="width:16px;height:16px"')}${[u.city, u.distanceKm ? `${u.distanceKm} km uzakta` : ''].filter(Boolean).map(esc).join(' · ')}` : ''}</div>
        ${u.bio ? `<p>${esc(u.bio)}</p>` : ''}
        ${u.interests?.length ? `<div class="chips">${u.interests.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>` : ''}
      </div>
    </div>`;

  const render = () => {
    if (!deck.length) {
      deckEl.innerHTML = `<div class="empty"><div class="big">${icon('flame')}</div><h2>Şimdilik bu kadar</h2>Yakında yeni kişiler gelecek. Geçtiklerini tekrar görmek istersen desteyi yenile.
        <p style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn primary reset">Desteyi yenile</button><button class="btn wf">Filtreleri genişlet</button></p></div>`;
      deckEl.querySelector('.wf').onclick = () => openFilters(async () => { deck = await api('/swipe/deck'); render(); });
      deckEl.querySelector('.reset').onclick = async () => {
        await api('/swipe/reset', { body: {} });
        deck = await api('/swipe/deck'); history = []; render();
      };
      return;
    }
    deckEl.innerHTML = deck.slice(0, 2).reverse().map(cardHtml).join('');
    const cards = deckEl.querySelectorAll('.card');
    if (cards.length > 1) cards[0].classList.add('back');
    attach(deckEl.lastElementChild, deck[0]);
  };

  function attach(card, u) {
    let idx = 0;
    const imgs = card.querySelectorAll('.ph');
    const segs = card.querySelectorAll('.segs i');
    const showPhoto = (n) => {
      idx = Math.max(0, Math.min(imgs.length - 1, n));
      imgs.forEach((im, i) => { im.style.display = i === idx ? '' : 'none'; });
      segs.forEach((s, i) => s.classList.toggle('on', i === idx));
    };
    const stamps = { like: card.querySelector('.stamp.like'), nope: card.querySelector('.stamp.nope'), super: card.querySelector('.stamp.super') };
    let sx = 0; let sy = 0; let dx = 0; let dy = 0; let dragging = false; let moved = false;

    card.addEventListener('pointerdown', (e) => {
      if (busy) return;
      dragging = true; moved = false; sx = e.clientX; sy = e.clientY; dx = dy = 0;
      card.setPointerCapture(e.pointerId);
      card.style.transition = 'none';
    });
    card.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      dx = e.clientX - sx; dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 18}deg)`;
      stamps.like.style.opacity = Math.max(0, Math.min(1, dx / 90));
      stamps.nope.style.opacity = Math.max(0, Math.min(1, -dx / 90));
      stamps.super.style.opacity = Math.max(0, Math.min(1, -dy / 110 - Math.abs(dx) / 200));
      const back = deckEl.querySelector('.card.back');
      if (back) { const k = Math.min(1, Math.abs(dx) / 160); back.style.transform = `scale(${0.94 + 0.06 * k}) translateY(${14 - 14 * k}px)`; }
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      if (!moved) {
        // dokunma: sol/sağ yarı fotoğraf değiştirir
        const r = card.getBoundingClientRect();
        showPhoto(idx + (e.clientX - r.left > r.width / 2 ? 1 : -1));
        card.style.transform = '';
        return;
      }
      if (dx > 110) return fling('right');
      if (dx < -110) return fling('left');
      if (dy < -130) return fling('super');
      card.style.transition = 'transform .35s cubic-bezier(.2,.9,.3,1.3)';
      card.style.transform = '';
      Object.values(stamps).forEach((s) => { s.style.opacity = 0; });
      const back = deckEl.querySelector('.card.back'); if (back) back.style.transform = '';
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
    card._fling = fling;

    async function fling(dir) {
      if (busy) return;
      busy = true;
      stamps[dir === 'right' ? 'like' : dir === 'left' ? 'nope' : 'super'].style.opacity = 1;
      const w = window.innerWidth;
      card.style.transition = 'transform .4s ease-out';
      card.style.transform = dir === 'super'
        ? 'translate(0, -120vh) rotate(-4deg)'
        : `translate(${dir === 'right' ? w * 1.4 : -w * 1.4}px, ${dy}px) rotate(${dir === 'right' ? 30 : -30}deg)`;
      if (navigator.vibrate) navigator.vibrate(12);
      history.push(u);
      deck.shift();
      setTimeout(() => { busy = false; render(); }, 280);
      try {
        const r = await api('/swipe', { body: { to: u.id, dir } });
        if (r.match) showMatch(r.user, r.chatId);
      } catch (er) {
        if (/hakkın bitti/.test(er.message)) {
          // Sınır doldu: kartı geri koy
          history.pop(); deck.unshift(u);
          setTimeout(render, 300);
          if (state.badges.plus) toast(er.message); else plusSheet(er.message);
        } else toast(er.message);
      }
      if (deck.length < 3) {
        const more = await api('/swipe/deck').catch(() => []);
        const have = new Set([...deck.map((x) => x.id), ...history.map((x) => x.id)]);
        more.filter((x) => !have.has(x.id)).forEach((x) => deck.push(x));
        if (deck.length && !deckEl.querySelector('.card')) render();
      }
    }
  }

  const reload = async () => { deck = await api('/swipe/deck'); history = []; render(); };
  view.querySelector('.flt').onclick = () => openFilters(reload);
  const offB = on('badges', (b) => { const n = view.querySelector('.lkn'); n.hidden = !b.likes; n.textContent = b.likes; });
  const top = () => deckEl.lastElementChild?._fling;
  view.querySelector('.nope').onclick = () => top()?.('left');
  view.querySelector('.like').onclick = () => top()?.('right');
  view.querySelector('.super').onclick = () => top()?.('super');
  view.querySelector('.undo').onclick = async () => {
    try {
      const r = await api('/swipe/undo', { body: {} });
      history.pop();
      deck = deck.filter((x) => x.id !== r.card.id);
      deck.unshift(r.card); render();
    } catch (er) {
      if (/SwipeUp\+/.test(er.message)) plusSheet('Yanlışlıkla mı geçtin? SwipeUp+ ile son kaydırmanı geri al.'); else toast(er.message);
    }
  };
  view.querySelector('.bst').onclick = () => openBoost();
  const key = (e) => {
    if (e.target.matches('input, textarea')) return;
    if (e.key === 'ArrowLeft') top()?.('left');
    if (e.key === 'ArrowRight') top()?.('right');
    if (e.key === 'ArrowUp') top()?.('super');
  };
  window.addEventListener('keydown', key);
  render();
  return () => { window.removeEventListener('keydown', key); offB(); };
}

export function openFilters(onSave) {
  const me = state.me;
  const p = me.prefs || { ageMin: 18, ageMax: 99, maxKm: null };
  sheet('Kaydırma tercihleri', `<form class="form" style="padding-top:4px">
    <label>Göster<select class="field" name="lf">
      <option value="all">Herkes</option><option value="k" ${me.lookingFor === 'k' ? 'selected' : ''}>Kadınlar</option><option value="e" ${me.lookingFor === 'e' ? 'selected' : ''}>Erkekler</option></select></label>
    <div class="range-row"><div class="vals"><span>Yaş aralığı</span><span class="av">${p.ageMin} – ${p.ageMax}</span></div>
      <input type="range" name="a1" min="18" max="99" value="${p.ageMin}" aria-label="En düşük yaş">
      <input type="range" name="a2" min="18" max="99" value="${p.ageMax}" aria-label="En yüksek yaş"></div>
    <div class="range-row"><div class="vals"><span>En fazla uzaklık</span><span class="dv">${p.maxKm ? p.maxKm + ' km' : 'Sınırsız'}</span></div>
      <input type="range" name="km" min="5" max="505" step="5" value="${p.maxKm || 505}" aria-label="Uzaklık">
      <div class="loc muted" style="font-size:13px">${me.hasLocation ? 'Konumun kayıtlı (yaklaşık 1 km hassasiyetle).' : 'Uzaklığa göre görmek için konumunu paylaş.'} <button type="button" class="link gl">${me.hasLocation ? 'Konumu güncelle' : 'Konumumu kullan'}</button></div></div>
    <button class="btn primary block">Kaydet</button></form>`, {
    onMount(sh, close) {
      const f = sh.querySelector('form');
      let location;
      const sync = () => {
        let a = +f.a1.value; let b = +f.a2.value; if (a > b) [a, b] = [b, a];
        sh.querySelector('.av').textContent = `${a} – ${b}`;
        sh.querySelector('.dv').textContent = +f.km.value > 500 ? 'Sınırsız' : `${f.km.value} km`;
      };
      f.oninput = sync;
      sh.querySelector('.gl').onclick = () => {
        if (!navigator.geolocation) return toast('Bu cihaz konum paylaşmayı desteklemiyor.');
        navigator.geolocation.getCurrentPosition((pos) => {
          location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          sh.querySelector('.loc').firstChild.textContent = 'Konum alındı, kaydetmeyi unutma. ';
        }, () => toast('Konum izni verilmedi.'), { enableHighAccuracy: false, timeout: 10000 });
      };
      f.onsubmit = async (e) => {
        e.preventDefault();
        let a = +f.a1.value; let b = +f.a2.value; if (a > b) [a, b] = [b, a];
        try {
          const u = await api('/me', { method: 'PATCH', body: { lookingFor: f.lf.value, prefs: { ageMin: a, ageMax: b, maxKm: +f.km.value > 500 ? null : +f.km.value }, ...(location ? { location } : {}) } });
          Object.assign(state.me, u); close(); onSave?.();
        } catch (er) { toast(er.message); }
      };
    },
  });
}

async function openBoost() {
  const st = await api('/store').catch(() => null);
  if (!st) return;
  const left = st.boostUntil ? Math.max(1, Math.round((st.boostUntil - Date.now()) / 60000)) : 0;
  sheet(null, `<div class="plus-sheet"><div class="plus-badge boost">${icon('bolt')}</div><h2>Boost</h2>
    ${left ? `<p>Profilin şu an öne çıkıyor. <b>${left} dakika</b> kaldı.</p>` : `<p class="muted">${st.boostMinutes} dakika boyunca bölgendeki herkesin destesinde en üstte görün.</p>
    <button class="btn primary block go">${st.freeBoost ? 'Ücretsiz boost kullan (SwipeUp+)' : `${st.boostCoins} jeton ile boost`}</button>
    <p class="muted" style="font-size:13px;margin-top:10px">Bakiyen: ${st.coins} jeton · <a class="link" href="#/store">Jeton al</a></p>`}</div>`, {
    onMount(sh, close) {
      sh.querySelector('.go')?.addEventListener('click', async () => {
        try {
          await api('/boost', { body: {} });
          close(); toast(`Boost açıldı! ${st.boostMinutes} dakika öne çıkacaksın ⚡`);
        } catch (er) { if (/jeton/i.test(er.message)) { close(); needCoins(er.message); } else toast(er.message); }
      });
    },
  });
}

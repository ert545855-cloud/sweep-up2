import { icon } from '../icons.js';
import { api, esc, toast, isOn } from '../core.js';
import { showMatch } from '../app.js';

export default async function swipe(view) {
  view.innerHTML = `<header class="topbar">
      <h1><span>Keşfet</span></h1>
      <a class="ib" href="#/edit" aria-label="Tercihler">${icon('menu')}</a>
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
      <div class="stamp like">BEĞEN</div><div class="stamp nope">GEÇ</div><div class="stamp super">SÜPER</div>
      <div class="info">
        <h2>${esc(u.name.split(' ')[0])} ${u.age ? `<small>${u.age}</small>` : ''}</h2>
        <div class="where">${isOn(u) ? '<i class="on-dot"></i>Şu an çevrimiçi' : ''}${u.city ? `${isOn(u) ? ' · ' : ''}${icon('pin', '', 'style="width:16px;height:16px"')}${esc(u.city)}` : ''}</div>
        ${u.bio ? `<p>${esc(u.bio)}</p>` : ''}
        ${u.interests?.length ? `<div class="chips">${u.interests.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>` : ''}
      </div>
    </div>`;

  const render = () => {
    if (!deck.length) {
      deckEl.innerHTML = `<div class="empty"><div class="big">${icon('flame')}</div><h2>Şimdilik bu kadar</h2>Yakında yeni kişiler gelecek. Geçtiklerini tekrar görmek istersen desteyi yenile.
        <p><button class="btn primary reset">Desteyi yenile</button></p></div>`;
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
      } catch (er) { toast(er.message); }
      if (deck.length < 3) {
        const more = await api('/swipe/deck').catch(() => []);
        const have = new Set([...deck.map((x) => x.id), ...history.map((x) => x.id)]);
        more.filter((x) => !have.has(x.id)).forEach((x) => deck.push(x));
        if (deck.length && !deckEl.querySelector('.card')) render();
      }
    }
  }

  const top = () => deckEl.lastElementChild?._fling;
  view.querySelector('.nope').onclick = () => top()?.('left');
  view.querySelector('.like').onclick = () => top()?.('right');
  view.querySelector('.super').onclick = () => top()?.('super');
  view.querySelector('.undo').onclick = () => {
    const u = history.pop();
    if (!u) return toast('Geri alınacak kart yok.');
    deck.unshift(u); render();
    toast('Son kart geri getirildi. Beğendiysen eşleşme korunur.');
  };
  const key = (e) => {
    if (e.target.matches('input, textarea')) return;
    if (e.key === 'ArrowLeft') top()?.('left');
    if (e.key === 'ArrowRight') top()?.('right');
    if (e.key === 'ArrowUp') top()?.('super');
  };
  window.addEventListener('keydown', key);
  render();
  return () => window.removeEventListener('keydown', key);
}

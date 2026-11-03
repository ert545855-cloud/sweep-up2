// Süreli etkinlik temaları: Cadılar Bayramı, Yılbaşı, Sevgililer Günü.
// Sunucu açık (ya da sıradaki) etkinliği verir; tema başlangıçta açılır, bitişte kendiliğinden kalkar,
// kullanıcının seçtiği tema geri gelir ve sıradaki etkinlik beklenir. Kullanıcı Ayarlar'dan kapatabilir.
import { state, on, applySkin, currentSkin, esc } from './core.js';

const root = document.documentElement;
let ev = null;          // { id, name, start, end }
let skew = 0;           // sunucu saati − cihaz saati
let timer = null;
let layer = null;
let refetching = false;
const listeners = new Set();

const now = () => Date.now() + skew;
const key = (e) => `su_event_off:${e.id}:${e.start}`;
const isOff = (e) => { try { return localStorage.getItem(key(e)) === '1'; } catch { return false; } };
export const eventInfo = () => ev;
export const eventLive = () => !!ev && now() >= ev.start && now() < ev.end;
export const eventOn = () => !!root.dataset.event;
export const onEventChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

// ---------- Çizimler ----------
const BAT = '<svg viewBox="0 0 64 24" aria-hidden="true"><path d="M32 10c2-4 4-5 5-5 0 2 0 3 1 4 6-6 16-8 26-4-5 2-7 6-7 11-3-3-7-3-10 0-1-3-4-4-7-3-2 3-5 6-8 8-3-2-6-5-8-8-3-1-6 0-7 3-3-3-7-3-10 0 0-5-2-9-7-11 10-4 20-2 26 4 1-1 1-2 1-4 1 0 3 1 5 5z"/></svg>';
const SPIDER = `<svg viewBox="0 0 40 36" aria-hidden="true"><g stroke="#140b1c" stroke-width="2" stroke-linecap="round" fill="none">
  <path d="M15 16 6 9 1 13M15 19 4 17 0 22M16 22 7 27 4 34M17 24 12 31 11 36"/><path d="M25 16 34 9 39 13M25 19 36 17 40 22M24 22 33 27 36 34M23 24 28 31 29 36"/></g>
  <ellipse cx="20" cy="22" rx="7" ry="8" fill="#140b1c"/><circle cx="20" cy="12" r="5" fill="#140b1c"/>
  <circle cx="18" cy="11.5" r="1.3" fill="#ff8a2a"/><circle cx="22" cy="11.5" r="1.3" fill="#ff8a2a"/></svg>`;
const GHOST = `<svg viewBox="0 0 60 72" aria-hidden="true"><path d="M30 2C14 2 4 14 4 30v38l8-6 9 6 9-6 9 6 9-6 8 6V30C56 14 46 2 30 2z" fill="#f4eefc"/>
  <ellipse cx="21" cy="29" rx="4.5" ry="6" fill="#1b1026"/><ellipse cx="39" cy="29" rx="4.5" ry="6" fill="#1b1026"/><ellipse cx="30" cy="44" rx="5" ry="6.5" fill="#1b1026"/>
  <ellipse cx="14" cy="38" rx="4" ry="2.5" fill="#ffb4c8" opacity=".55"/><ellipse cx="46" cy="38" rx="4" ry="2.5" fill="#ffb4c8" opacity=".55"/></svg>`;
export const PUMPKIN = `<svg class="pumpkin" viewBox="0 0 64 60" aria-hidden="true">
  <path d="M31 12c0-5 2-9 7-11l2 3c-4 2-5 5-5 8z" fill="#3f7a2a"/>
  <ellipse cx="20" cy="35" rx="15" ry="21" fill="#e8620c"/><ellipse cx="44" cy="35" rx="15" ry="21" fill="#e8620c"/>
  <ellipse cx="32" cy="35" rx="15" ry="23" fill="#ff7a1a"/>
  <g class="face" fill="#ffd36b"><path d="M17 28l8-6 3 9zM47 28l-8-6-3 9z"/><path d="M15 39c6 7 28 7 34 0l-3 7-4-3-4 4-4-4-4 4-4-4-4 3z"/></g></svg>`;
const ORNAMENT = `<svg class="ornament" viewBox="0 0 64 76" aria-hidden="true"><defs>
  <radialGradient id="orn-g" cx="38%" cy="35%" r="70%"><stop offset="0" stop-color="#ff7b86"/><stop offset=".55" stop-color="#e3263a"/><stop offset="1" stop-color="#8f0f22"/></radialGradient></defs>
  <path d="M32 2v10" stroke="#d9b45a" stroke-width="2"/><path d="M27 6a5 5 0 0 1 10 0" fill="none" stroke="#d9b45a" stroke-width="2"/>
  <rect x="24" y="11" width="16" height="9" rx="2" fill="#f2c55c"/><rect x="24" y="14" width="16" height="2" fill="#c9952e"/>
  <circle cx="32" cy="46" r="27" fill="url(#orn-g)"/>
  <path d="M6 42q26 10 52 0" fill="none" stroke="#ffd36b" stroke-width="3" opacity=".9"/><path d="M8 54q24 9 48 0" fill="none" stroke="#ffd36b" stroke-width="2" opacity=".7"/>
  <g fill="#fff3c4"><circle cx="18" cy="47" r="1.8"/><circle cx="32" cy="50" r="1.8"/><circle cx="46" cy="47" r="1.8"/></g>
  <ellipse cx="22" cy="33" rx="7" ry="4" fill="#fff" opacity=".45" transform="rotate(-30 22 33)"/></svg>`;
const HEART_PATH = 'M12 21s-8-5.2-8-11.1A4.6 4.6 0 0 1 8.6 5.2c1.5 0 2.7.7 3.4 1.9.7-1.2 1.9-1.9 3.4-1.9A4.6 4.6 0 0 1 20 9.9C20 15.8 12 21 12 21z';
const HEART = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${HEART_PATH}" fill="currentColor"/></svg>`;
const BIG_HEART = `<svg class="bigheart" viewBox="0 0 24 24" aria-hidden="true"><defs>
  <linearGradient id="bh-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8fb1"/><stop offset=".55" stop-color="#ff3d6e"/><stop offset="1" stop-color="#c2185b"/></linearGradient></defs>
  <path d="${HEART_PATH}" fill="url(#bh-g)"/><ellipse cx="8.3" cy="8.6" rx="2.2" ry="1.3" fill="#fff" opacity=".5" transform="rotate(-35 8.3 8.6)"/></svg>`;
const PETAL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c5 4 7 10 0 20C5 12 7 6 12 2z" fill="currentColor"/><path d="M12 4v15" stroke="rgba(0,0,0,.12)" stroke-width=".8"/></svg>';
const ARROW = `<svg viewBox="0 0 120 24" aria-hidden="true"><path d="M8 12h96" stroke="#c2185b" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M2 6l10 6-10 6M8 6l10 6-10 6" fill="none" stroke="#ff8fb1" stroke-width="2"/>
  <path d="M104 12c0-4 3-7 6-7s5 2 5 5c0 4-6 8-11 9 1-2 0-5 0-7z" fill="#ff3d6e" transform="rotate(90 110 12)"/></svg>`;
const FLAKE = '<svg viewBox="0 0 24 24" aria-hidden="true"><g stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9 4l3 2.5L15 4M9 20l3-2.5 3 2.5M3.5 10.5L6.5 9.6 6 6.6M17.5 17.4l.5-3 3 .9M3.5 13.5l3 .9-.5 3M17.5 6.6l.5 3 3-.9"/></g></svg>';
const SLEIGH = '<img src="/img/yilbasi-kizak.webp" alt="" width="195" height="88" decoding="async">';

function web() {
  const spokes = [0, 16, 32, 48, 64, 80, 90].map((a) => (a * Math.PI) / 180);
  const pt = (r, a) => [100 - Math.cos(a) * r, Math.sin(a) * r];
  let d = spokes.map((a) => { const [x, y] = pt(140, a); return `M100 0L${x.toFixed(1)} ${y.toFixed(1)}`; }).join('');
  [22, 42, 64, 88].forEach((r) => {
    for (let i = 0; i < spokes.length - 1; i++) {
      const [x1, y1] = pt(r, spokes[i]); const [x2, y2] = pt(r, spokes[i + 1]);
      const [cx, cy] = pt(r * 0.86, (spokes[i] + spokes[i + 1]) / 2);
      d += `M${x1.toFixed(1)} ${y1.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    }
  });
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width=".7"/></svg>`;
}

const rnd = (a, b) => a + Math.random() * (b - a);
const many = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('');

// Yılbaşı ışıkları: üç sarkık kablo boyunca yanıp sönen ampuller
function garland() {
  const swags = 3; const per = 7; const sag = 16;
  let wire = '';
  let bulbs = '';
  const colors = ['#ff4d5e', '#ffd36b', '#34d399', '#60a5fa', '#f472b6'];
  for (let s = 0; s < swags; s++) {
    const x0 = (s / swags) * 100; const x1 = ((s + 1) / swags) * 100;
    wire += `M${x0} 2Q${(x0 + x1) / 2} ${2 + sag * 2} ${x1} 2`;
    for (let i = 1; i < per; i++) {
      const t = i / per;
      const x = x0 + (x1 - x0) * t;
      const y = 2 + sag * 4 * t * (1 - t);
      const c = colors[(s * per + i) % colors.length];
      bulbs += `<i style="left:${x.toFixed(2)}%;top:${y.toFixed(1)}px;--c:${c};animation-delay:${((s * per + i) % 5) * 0.32}s"></i>`;
    }
  }
  return `<div class="fx-garland"><svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path d="${wire}" fill="none" stroke="#1b2a1f" stroke-width="1.2" vector-effect="non-scaling-stroke"/></svg>${bulbs}</div>`;
}

const KINDS = {
  halloween: {
    color: '#0e0a14', emoji: '🎃', art: PUMPKIN, icon: PUMPKIN,
    title: (e) => `${e.name} haftası`,
    text: 'Uygulama ürkütücü kılığa girdi. Hikayende yeni <b>Cadı</b> ve <b>Hayalet</b> efektlerini dene.',
    layer: () => `<div class="fx-web">${web()}</div>
      <div class="fx-spider">${SPIDER}</div>
      <div class="fx-bats"><span class="bat b1">${BAT}</span><span class="bat b2">${BAT}</span><span class="bat b3">${BAT}</span></div>
      <div class="fx-embers">${many(14, () => { const s = rnd(2, 5).toFixed(1); return `<i style="left:${rnd(0, 100).toFixed(1)}%;width:${s}px;height:${s}px;animation-duration:${rnd(9, 18).toFixed(1)}s;animation-delay:-${rnd(0, 18).toFixed(1)}s;--dx:${rnd(-30, 30).toFixed(0)}px"></i>`; })}</div>
      <div class="fx-ghost"><span>${GHOST}</span></div>
      <div class="fx-fog"><i></i><i></i></div>`,
    burst: ['🦇', '🦇', '🎃', '👻'],
  },
  yilbasi: {
    color: '#08101f', emoji: '🎄', art: ORNAMENT, icon: ORNAMENT,
    title: () => (now() >= newYear() ? 'Mutlu yıllar! 🎆' : 'Yılbaşı geliyor'),
    text: 'Kar yağıyor, ışıklar yandı. Hikayende yeni <b>Kar</b> ve <b>Işıltı</b> efektlerini dene.',
    sub: () => {
      const ms = newYear() - now();
      if (ms <= 0) return `${new Date(newYear()).getFullYear()} sana güzellikler getirsin`;
      const d = Math.floor(ms / 86400000); const h = Math.floor((ms % 86400000) / 3600000); const m = Math.floor((ms % 3600000) / 60000);
      return d >= 1 ? `Yeni yıla ${d} gün ${h} saat` : `Yeni yıla ${h} saat ${m} dakika`;
    },
    layer: () => `${garland()}
      <div class="fx-snow">${many(38, (i) => {
        const big = i % 7 === 0; const s = big ? rnd(10, 16) : rnd(2.5, 6);
        return `<i class="${big ? 'fl' : ''}" style="left:${rnd(0, 100).toFixed(1)}%;width:${s.toFixed(1)}px;height:${s.toFixed(1)}px;animation-duration:${rnd(9, 20).toFixed(1)}s;animation-delay:-${rnd(0, 20).toFixed(1)}s;--dx:${rnd(-40, 40).toFixed(0)}px;opacity:${rnd(0.5, 0.95).toFixed(2)}">${big ? FLAKE : ''}</i>`;
      })}</div>
      <div class="fx-sleigh">${SLEIGH}</div>
      <div class="fx-stars">${many(10, () => `<i style="left:${rnd(4, 96).toFixed(1)}%;top:${rnd(70, 260).toFixed(0)}px;animation-delay:-${rnd(0, 4).toFixed(1)}s"></i>`)}</div>`,
    burst: ['✨', '❄️', '⭐', '🎁', '✨'],
  },
  sevgililer: {
    color: '#fff3f6', emoji: '💘', art: BIG_HEART, icon: BIG_HEART,
    title: () => (isValentine() ? 'Sevgililer Günün kutlu olsun' : 'Sevgililer Günü haftası'),
    text: 'Aşk havada uçuşuyor. Hikayende yeni <b>Aşk</b> ve <b>Rüya</b> efektlerini dene.',
    sub: () => {
      if (isValentine()) return 'Bugün 14 Şubat 💌 Eşleşmelerine bir mesaj at';
      const ms = valentine() - now();
      if (ms <= 0) return `${fmtDay(ev.end - 1)} gününe kadar`;
      const d = Math.ceil(ms / 86400000);
      return `14 Şubat’a ${d} gün`;
    },
    layer: () => `<div class="fx-hearts">${many(16, () => {
        const s = rnd(10, 24); const c = ['#ff3d6e', '#ff8fb1', '#e8215a', '#ffc2d4', '#ff5c8a'][Math.floor(rnd(0, 5))];
        return `<i style="left:${rnd(0, 100).toFixed(1)}%;width:${s.toFixed(0)}px;height:${s.toFixed(0)}px;color:${c};animation-duration:${rnd(10, 19).toFixed(1)}s;animation-delay:-${rnd(0, 19).toFixed(1)}s;--dx:${rnd(-40, 40).toFixed(0)}px">${HEART}</i>`;
      })}</div>
      <div class="fx-petals">${many(10, () => {
        const s = rnd(10, 16); const c = ['#e8215a', '#ff5c8a', '#c2185b'][Math.floor(rnd(0, 3))];
        return `<i style="left:${rnd(0, 100).toFixed(1)}%;width:${s.toFixed(0)}px;height:${s.toFixed(0)}px;color:${c};animation-duration:${rnd(11, 20).toFixed(1)}s;animation-delay:-${rnd(0, 20).toFixed(1)}s;--dx:${rnd(-60, 60).toFixed(0)}px;--r:${rnd(240, 720).toFixed(0)}deg">${PETAL}</i>`;
      })}</div>
      <div class="fx-arrow">${ARROW}</div>`,
    burst: ['💖', '💘', '💕', '🌹', '💗'],
  },
};
const meta = () => (ev && KINDS[ev.id]) || null;
export const eventEmoji = () => meta()?.emoji || '✨';
export const eventIcon = () => meta()?.icon || '';

// Yeni yıl anı: etkinlik başladıktan sonraki ilk 1 Ocak 00:00 (Türkiye saati)
function newYear() {
  const y = new Date(ev.start).getUTCFullYear();
  const a = Date.parse(`${y}-01-01T00:00:00+03:00`);
  return a >= ev.start - 86400000 ? a : Date.parse(`${y + 1}-01-01T00:00:00+03:00`);
}
function valentine() {
  const y = new Date(ev.start).getUTCFullYear();
  return Date.parse(`${y}-02-14T00:00:00+03:00`);
}
const isValentine = () => { const v = valentine(); return now() >= v && now() < v + 86400000; };

export function setEvent(e, serverNow) {
  ev = e || null;
  if (serverNow) skew = serverNow - Date.now();
  apply();
}

export function setEventEnabled(enabled) {
  if (!ev) return;
  try { if (enabled) localStorage.removeItem(key(ev)); else localStorage.setItem(key(ev), '1'); } catch {}
  apply();
}
export const eventEnabled = () => !!ev && !isOff(ev);

function refetch() {
  if (refetching) return;
  refetching = true;
  fetch('/api/event', { cache: 'no-store' }).then((r) => r.json()).then((d) => { refetching = false; if (d.event?.start !== ev?.start || d.event?.id !== ev?.id) setEvent(d.event, d.now); })
    .catch(() => { refetching = false; });
}

function apply() {
  clearTimeout(timer);
  const want = eventLive() && !isOff(ev) ? ev.id : null;
  const had = root.dataset.event || null;
  if (want) {
    if (had !== want) { layer?.remove(); layer = null; }
    root.dataset.event = want;
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', KINDS[want]?.color || '#0e0a14'));
    mountLayer();
  } else {
    delete root.dataset.event;
    layer?.remove(); layer = null;
    if (had) applySkin(currentSkin(), { save: false }); // seçili temanın renklerini geri getir
  }
  if (ev && now() >= ev.end) refetch(); // bitti: sıradaki etkinliği sor
  // Bir sonraki değişim anı (setTimeout en fazla ~24 gün bekleyebilir)
  if (ev) {
    const moments = [ev.start, ev.end];
    if (ev.id === 'yilbasi') moments.push(newYear());
    const t = moments.filter((x) => x > now()).sort((a, b) => a - b)[0];
    const ms = t - now();
    if (ms > 0 && ms < 2 ** 31 - 1) timer = setTimeout(apply, ms + 500);
  }
  if (want === 'yilbasi') maybeFireworks();
  if (had !== (want || null)) listeners.forEach((fn) => { try { fn(want); } catch {} });
}

function mountLayer() {
  if (layer || !meta()) return;
  layer = document.createElement('div');
  layer.id = 'fx-layer';
  layer.dataset.kind = ev.id;
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = meta().layer();
  document.body.append(layer);
  syncRoute();
}

// Tam ekran ve video ekranlarında süsleme gösterme
function syncRoute() {
  const h = location.hash;
  document.body.classList.toggle('fx-hide', /^#\/(live|stories|create|dalga|reels)/.test(h));
}
window.addEventListener('hashchange', syncRoute);

// ---------- Eşleşme ekranında temaya göre patlama ----------
function burst(host) {
  const m = meta(); if (!m || !eventOn() || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const wrap = document.createElement('div'); wrap.className = 'ev-burst'; wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = many(22, (i) => {
    const a = rnd(0, Math.PI * 2); const d = rnd(120, 260);
    return `<i style="--x:${(Math.cos(a) * d).toFixed(0)}px;--y:${(Math.sin(a) * d - 60).toFixed(0)}px;--r:${rnd(-60, 60).toFixed(0)}deg;font-size:${rnd(18, 34).toFixed(0)}px;animation-delay:${rnd(0, 0.35).toFixed(2)}s">${m.burst[i % m.burst.length]}</i>`;
  });
  host.append(wrap);
  setTimeout(() => wrap.remove(), 2600);
}
new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.classList?.contains('match-modal')) burst(n); })))
  .observe(document.body, { childList: true });

// ---------- Yeni yıl havai fişekleri ----------
function maybeFireworks() {
  const ny = newYear();
  const t = now();
  if (t < ny || t > ny + 86400000) return;
  const k = `su_ny_fx:${ny}`;
  try { if (localStorage.getItem(k)) return; localStorage.setItem(k, '1'); } catch {}
  setTimeout(() => fireworks(new Date(ny + 3 * 3600000).getUTCFullYear()), 600);
}
export function fireworks(year) {
  if (document.querySelector('.ny-fx')) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ov = document.createElement('div'); ov.className = 'ny-fx';
  ov.innerHTML = `<canvas></canvas><div class="ny-txt"><small>Yeni yılın kutlu olsun</small><b>${esc(String(year))}</b><span>SwipeUp ailesinden sevgilerle 🎆</span><button class="btn sm">Kapat</button></div>`;
  document.body.append(ov);
  const cv = ov.querySelector('canvas'); const cx = cv.getContext('2d');
  const fit = () => { cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; cx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); };
  fit(); addEventListener('resize', fit);
  const parts = []; const cols = ['#ffd36b', '#ff4d5e', '#60a5fa', '#34d399', '#f472b6', '#ffffff'];
  const boom = () => {
    const x = rnd(0.15, 0.85) * innerWidth; const y = rnd(0.12, 0.5) * innerHeight; const c = cols[Math.floor(rnd(0, cols.length))];
    for (let i = 0; i < 70; i++) { const a = rnd(0, Math.PI * 2); const v = rnd(1.2, 4.6); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(55, 90), c }); }
  };
  let raf = 0; let n = 0; const t0 = performance.now();
  const loop = (t) => {
    cx.fillStyle = 'rgba(5,8,20,.22)'; cx.fillRect(0, 0, innerWidth, innerHeight);
    if (!reduce && t - t0 < 9000 && n++ % 22 === 0) boom();
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.045; p.vx *= 0.985; p.life--;
      cx.globalAlpha = Math.max(0, p.life / 90); cx.fillStyle = p.c; cx.beginPath(); cx.arc(p.x, p.y, 2.1, 0, 7); cx.fill();
      if (p.life <= 0) parts.splice(i, 1);
    }
    cx.globalAlpha = 1;
    if (t - t0 < 11000) raf = requestAnimationFrame(loop); else close();
  };
  const close = () => { cancelAnimationFrame(raf); removeEventListener('resize', fit); ov.classList.add('out'); setTimeout(() => ov.remove(), 400); };
  ov.querySelector('button').onclick = close;
  if (!reduce) boom();
  raf = requestAnimationFrame(loop);
  if (navigator.vibrate) navigator.vibrate([30, 60, 30, 60, 80]);
}

// ---------- Akıştaki etkinlik kartı ----------
const fmtDay = (t) => new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
function left() {
  const ms = ev.end - now();
  const d = Math.floor(ms / 86400000);
  if (d >= 1) return `${d} gün kaldı`;
  return `son ${Math.max(1, Math.floor(ms / 3600000))} saat`;
}
export function paintEventBanner(slot) {
  if (!slot) return;
  const paint = () => {
    let hidden = false;
    try { hidden = !!ev && localStorage.getItem(`su_event_card:${ev.id}:${ev.start}`) === '1'; } catch {}
    const m = meta();
    if (!eventOn() || hidden || !m) { slot.innerHTML = ''; return; }
    slot.innerHTML = `<div class="ev-card" data-kind="${ev.id}">
      <div class="ev-art">${m.art}</div>
      <div class="ev-txt"><b>${esc(m.title(ev))}</b><span>${m.text}</span>
        <small>${esc(m.sub ? m.sub() : `${fmtDay(ev.end - 1)} gününe kadar · ${left()}`)}</small></div>
      <a class="btn sm primary" href="#/create/story">Dene</a>
      <button class="ev-x" aria-label="Kapat">✕</button></div>`;
    slot.querySelector('.ev-x').onclick = () => {
      try { localStorage.setItem(`su_event_card:${ev.id}:${ev.start}`, '1'); } catch {}
      slot.innerHTML = '';
    };
  };
  paint();
  const off = onEventChange(paint);
  const iv = setInterval(() => { if (!slot.isConnected) return; const s = slot.querySelector('.ev-txt small'); const m = meta(); if (s && m) s.textContent = m.sub ? m.sub() : `${fmtDay(ev.end - 1)} gününe kadar · ${left()}`; }, 30000);
  return () => { off(); clearInterval(iv); };
}

// ---------- Başlangıç ----------
export function initEvent(cfg) {
  setEvent(cfg?.event, cfg?.now);
  on('event', (d) => { if (state.config) state.config.event = d.event; setEvent(d.event, d.now); });
  // Telefon uykudan dönünce zamanlayıcı gecikebilir; görünür olunca yeniden bak
  let fetched = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    apply();
    if (Date.now() - fetched > 10 * 60000) { fetched = Date.now(); refetch(); }
  });
}

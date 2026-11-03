// Süreli etkinlik teması (Cadılar Bayramı haftası).
// Sunucu etkinliği ve bitiş zamanını verir; tema başlangıçta açılır, bitişte kendiliğinden kalkar
// ve kullanıcının seçtiği tema geri gelir. Kullanıcı Ayarlar'dan kapatabilir.
import { state, on, applySkin, currentSkin, esc } from './core.js';

const root = document.documentElement;
let ev = null;          // { id, name, start, end }
let skew = 0;           // sunucu saati − cihaz saati
let timer = null;
let layer = null;
const listeners = new Set();

const now = () => Date.now() + skew;
const key = (e) => `su_event_off:${e.id}:${e.start}`;
const isOff = (e) => { try { return localStorage.getItem(key(e)) === '1'; } catch { return false; } };
export const eventInfo = () => ev;
export const eventLive = () => !!ev && now() >= ev.start && now() < ev.end;
export const eventOn = () => !!root.dataset.event;
export const onEventChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

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

function apply() {
  clearTimeout(timer);
  const want = eventLive() && !isOff(ev) ? ev.id : null;
  const had = root.dataset.event || null;
  if (want) {
    root.dataset.event = want;
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', '#0e0a14'));
    mountLayer();
  } else {
    delete root.dataset.event;
    layer?.remove(); layer = null;
    if (had) applySkin(currentSkin(), { save: false }); // seçili temanın renklerini geri getir
  }
  // Bir sonraki değişim anı: başlangıç ya da bitiş (setTimeout en fazla ~24 gün bekleyebilir)
  if (ev) {
    const t = now() < ev.start ? ev.start : ev.end;
    const ms = t - now();
    if (ms > 0 && ms < 2 ** 31 - 1) timer = setTimeout(apply, ms + 500);
  }
  if (had !== (want || null)) listeners.forEach((fn) => { try { fn(want); } catch {} });
}

// ---------- Süslemeler ----------
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

function web() {
  // Sağ üst köşeden yayılan örümcek ağı
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

function mountLayer() {
  if (layer) return;
  layer = document.createElement('div');
  layer.id = 'fx-layer';
  layer.setAttribute('aria-hidden', 'true');
  const embers = Array.from({ length: 14 }, () => {
    const s = (2 + Math.random() * 3).toFixed(1);
    return `<i style="left:${(Math.random() * 100).toFixed(1)}%;width:${s}px;height:${s}px;animation-duration:${(9 + Math.random() * 9).toFixed(1)}s;animation-delay:-${(Math.random() * 18).toFixed(1)}s;--dx:${(Math.random() * 60 - 30).toFixed(0)}px"></i>`;
  }).join('');
  layer.innerHTML = `<div class="fx-web">${web()}</div>
    <div class="fx-spider">${SPIDER}</div>
    <div class="fx-bats"><span class="bat b1">${BAT}</span><span class="bat b2">${BAT}</span><span class="bat b3">${BAT}</span></div>
    <div class="fx-embers">${embers}</div>
    <div class="fx-ghost"><span>${GHOST}</span></div>
    <div class="fx-fog"><i></i><i></i></div>`;
  document.body.append(layer);
  syncRoute();
}

// Tam ekran ve video ekranlarında süsleme gösterme
function syncRoute() {
  const h = location.hash;
  document.body.classList.toggle('fx-hide', /^#\/(live|stories|create|dalga|reels)/.test(h));
}
window.addEventListener('hashchange', syncRoute);

// ---------- Akıştaki duyuru kartı ----------
const fmtDay = (t) => new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
function left() {
  const ms = ev.end - now();
  const d = Math.floor(ms / 86400000);
  if (d >= 1) return `${d} gün kaldı`;
  const h = Math.max(1, Math.floor(ms / 3600000));
  return `son ${h} saat`;
}
export function paintEventBanner(slot) {
  if (!slot) return;
  const paint = () => {
    let hidden = false;
    try { hidden = !!ev && localStorage.getItem(`su_event_card:${ev.id}:${ev.start}`) === '1'; } catch {}
    if (!eventOn() || hidden) { slot.innerHTML = ''; return; }
    slot.innerHTML = `<div class="ev-card">
      <div class="ev-art">${PUMPKIN}</div>
      <div class="ev-txt"><b>${esc(ev.name)} haftası</b><span>Uygulama ürkütücü kılığa girdi. Hikayende yeni <b>Cadı</b> ve <b>Hayalet</b> efektlerini dene.</span>
        <small>${esc(fmtDay(ev.end - 1))} gününe kadar · ${left()}</small></div>
      <a class="btn sm primary" href="#/create/story">Dene</a>
      <button class="ev-x" aria-label="Kapat">✕</button></div>`;
    slot.querySelector('.ev-x').onclick = () => {
      try { localStorage.setItem(`su_event_card:${ev.id}:${ev.start}`, '1'); } catch {}
      slot.innerHTML = '';
    };
  };
  paint();
  return onEventChange(paint);
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
    if (Date.now() - fetched > 10 * 60000) {
      fetched = Date.now();
      fetch('/api/event', { cache: 'no-store' }).then((r) => r.json()).then((d) => setEvent(d.event, d.now)).catch(() => {});
    }
  });
}

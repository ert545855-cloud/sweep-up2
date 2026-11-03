// Ortak durum, API, socket, yardımcılar
import { icon } from './icons.js';

export const state = {
  token: localStorage.getItem('su_token'),
  me: null,
  config: null,
  socket: null,
  lives: [],
  badges: { notifications: 0, messages: 0 },
  presence: new Map(),
  muted: true,
};

// ---- Olay yolu ----
const bus = new EventTarget();
export const on = (ev, fn) => { const h = (e) => fn(e.detail); bus.addEventListener(ev, h); return () => bus.removeEventListener(ev, h); };
export const emit = (ev, detail) => bus.dispatchEvent(new CustomEvent(ev, { detail }));

// ---- API ----
export async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: {
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && state.token) { logout(); throw new Error(data.error); }
  if (res.status === 423) { emit('banned', data); throw new Error(data.error); }
  if (res.status === 503 && data.maintenance) { emit('maintenance', data.maintenance); throw new Error(data.error); }
  if (!res.ok) { const er = new Error(data.error || 'Bir şeyler ters gitti.'); er.status = res.status; er.data = data; throw er; }
  return data;
}

export function uploadFile(file, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('file', file);
    const x = new XMLHttpRequest();
    x.open('POST', '/api/upload');
    x.setRequestHeader('Authorization', 'Bearer ' + state.token);
    x.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    x.onload = () => {
      let d = {}; try { d = JSON.parse(x.responseText); } catch {}
      x.status < 300 ? resolve(d) : reject(new Error(d.error || 'Yükleme başarısız.'));
    };
    x.onerror = () => reject(new Error('Bağlantı hatası, tekrar dene.'));
    x.send(fd);
  });
}

// Dosya türü: bazı telefonlar türü boş gönderir, uzantıdan tahmin et
const EXT_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', avif: 'image/avif', mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', '3gp': 'video/3gpp', m4a: 'audio/mp4', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav' };
export const fileType = (f) => f?.type || EXT_TYPES[String(f?.name || '').split('.').pop().toLowerCase()] || '';
export const isVideoFile = (f) => fileType(f).startsWith('video/');
export const isImageFile = (f) => fileType(f).startsWith('image/');
export const isHeicFile = (f) => /hei[cf]/i.test(fileType(f)) || /\.hei[cf]$/i.test(f?.name || '');

// Fotoğrafı tarayıcıda aç: önce createImageBitmap, olmazsa <img> (Safari HEIC'i böyle açabilir)
async function decodeImage(file) {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (bmp && bmp.width) return { src: bmp, w: bmp.width, h: bmp.height, done: () => bmp.close?.() };
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth) throw new Error('boş');
    return { src: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
  } catch { URL.revokeObjectURL(url); return null; }
}

// Fotoğrafı yüklemeden önce küçült ve JPEG'e çevir (en uzun kenar 1440px).
// Tarayıcı açamazsa (ör. Android'de HEIC) dosyayı olduğu gibi döndürür; sunucu çevirir.
export async function compressImage(file, max = 1440, quality = 0.85) {
  if (file?.prepped) return file;
  const t = fileType(file);
  if (t && (!t.startsWith('image/') || t === 'image/gif')) return file; // tür bilinmiyorsa yine de açmayı dene
  const d = await decodeImage(file);
  if (!d) return file;
  try {
    const s = Math.min(1, max / Math.max(d.w, d.h));
    const c = document.createElement('canvas');
    c.width = Math.round(d.w * s); c.height = Math.round(d.h * s);
    c.getContext('2d').drawImage(d.src, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', quality));
    if (!blob) return file;
    const out = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
    out.prepped = true;
    return out;
  } finally { d.done(); }
}

// Seçilen fotoğrafı önizleme ve paylaşım için hazırla. Tarayıcının açamadığı HEIC'i
// sunucuya gönderip JPEG hâlini geri alır (yüklenen adres preUrl'de saklanır, tekrar yüklenmez).
export async function prepareImage(file) {
  if (!isImageFile(file) && !isHeicFile(file)) return file;
  const c = await compressImage(file);
  if (c !== file || !isHeicFile(file)) return c;
  const up = await uploadFile(file);
  const blob = await fetch(up.url).then((r) => (r.ok ? r.blob() : Promise.reject(new Error('Fotoğraf hazırlanamadı.'))));
  const out = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
  out.prepped = true; out.preUrl = up.url;
  return out;
}
// Hikaye çıkartmaları 390 px genişliğe göre tasarlanır; önizlemede ve her ekran boyunda
// aynı oranda görünmesi için katman bulunduğu kutuya ölçeklenir.
export const STORY_W = 390;
export function scaleStickerLayer(layer) {
  const box = layer?.parentElement; if (!box) return () => {};
  const fit = () => {
    const w = box.clientWidth; const h = box.clientHeight; if (!w || !h) return;
    const k = w / STORY_W;
    Object.assign(layer.style, { inset: 'auto', left: '0', top: '0', width: `${STORY_W}px`, height: `${h / k}px`, transform: `scale(${k})`, transformOrigin: '0 0' });
  };
  fit();
  const ro = new ResizeObserver(fit); ro.observe(box);
  return () => ro.disconnect();
}

// Seçilen herhangi bir dosyayı hazırla. Türü bilinmiyorsa önce fotoğraf olarak açmayı dener,
// olmazsa sunucu dosyanın baytlarından ne olduğunu anlar.
export async function prepareMedia(file) {
  if (isVideoFile(file)) return file;
  if (isImageFile(file) || isHeicFile(file)) return prepareImage(file);
  const c = await compressImage(file);
  if (c !== file) return c;
  const up = await uploadFile(file);
  if (String(up.mime || '').startsWith('image/')) {
    const blob = await fetch(up.url).then((r) => r.blob());
    const out = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
    out.prepped = true; out.preUrl = up.url;
    return out;
  }
  if (String(up.mime || '').startsWith('video/')) {
    const out = new File([file], file.name || 'video.mp4', { type: up.mime });
    out.preUrl = up.url;
    return out;
  }
  throw new Error('Bu dosya türü desteklenmiyor. Fotoğraf ya da video seç.');
}

// Hazırlanmışsa tekrar yükleme
export const uploadPrepared = (file, onProgress) => (file?.preUrl ? Promise.resolve({ url: file.preUrl }) : uploadFile(file, onProgress));

export function pickFile(accept, capture) {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept;
    if (capture) inp.setAttribute('capture', capture);
    // iPhone'da sayfaya eklenmemiş dosya seçici bazen seçimi bildirmiyor
    inp.style.cssText = 'position:fixed;left:-9999px;opacity:0;width:1px;height:1px';
    document.body.append(inp);
    inp.onchange = () => { resolve(inp.files[0] || null); inp.remove(); };
    inp.addEventListener('cancel', () => { resolve(null); inp.remove(); });
    inp.click();
  });
}

// ---- Oturum ----
export function setSession(token, user) {
  state.token = token; state.me = user;
  localStorage.setItem('su_token', token);
}
export function logout() {
  localStorage.removeItem('su_token');
  state.token = null; state.me = null;
  state.socket?.disconnect(); state.socket = null;
  location.hash = '#/login';
  location.reload();
}

// ---- Socket ----
export function connectSocket() {
  if (state.socket) return state.socket;
  const s = io({ auth: { token: state.token }, transports: ['websocket', 'polling'] });
  state.socket = s;
  s.on('connect_error', (e) => {
    if (e.message === 'unauthorized') logout();
    if (e.message === 'maintenance') { s.disconnect(); fetch('/api/maintenance').then((r) => r.json()).then((d) => d.maintenance && emit('maintenance', d.maintenance)).catch(() => {}); }
    if (e.message === 'banned') { s.disconnect(); api('/me').then((m) => m.ban && emit('banned', m.ban)).catch(() => {}); }
  });
  s.on('account:deleted', () => logout());
  s.on('account:banned', () => { api('/me').then((m) => m.ban && emit('banned', m.ban)).catch(() => {}); });
  s.on('connect', () => s.emit('visibility', document.visibilityState === 'visible'));
  document.addEventListener('visibilitychange', () => s.emit('visibility', document.visibilityState === 'visible'));
  ['message', 'typing', 'read', 'delivered', 'notification', 'match', 'post:likes',
    'message:update', 'message:hidden', 'chat:removed', 'chat:update', 'blocked', 'stories:update', 'people:new', 'likes:new',
    'call:incoming', 'call:accepted', 'call:ended', 'call:taken', 'call:signal',
    'live:viewer', 'live:viewer-left', 'live:signal', 'live:comment', 'live:heart', 'live:count', 'live:ended', 'live:gift', 'live:filter', 'wallet', 'people:gone', 'genel:msg', 'genel:update', 'genel:online', 'genel:typing', 'app:version', 'announce:popup', 'event', 'maintenance', 'maintenance:plan', 'falai', 'support', 'market', 'features', 'speed:count', 'speed:paired', 'speed:vote', 'speed:result', 'speed:signal', 'speed:left']
    .forEach((ev) => s.on(ev, (d) => emit(ev, d)));
  s.on('presence', (d) => { state.presence.set(d.userId, d); emit('presence', d); });
  s.on('presence:all', (ids) => { ids.forEach((id) => state.presence.set(id, { userId: id, online: true })); emit('presence', {}); });
  s.on('connect', () => emit('reconnected'));
  s.on('lives', (l) => { state.lives = l; emit('lives', l); });
  return s;
}

export const isOn = (u) => (state.presence.has(u.id) ? state.presence.get(u.id).online : !!u.online);

// ---- Biçimlendirme ----
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function ago(t, long = false) {
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  const units = long
    ? [[604800, ' hafta önce'], [86400, ' gün önce'], [3600, ' saat önce'], [60, ' dakika önce']]
    : [[604800, 'h'], [86400, 'g'], [3600, 'sa'], [60, 'dk']];
  for (const [n, u] of units) if (s >= n) return Math.floor(s / n) + (long ? u : ' ' + u);
  return long ? 'az önce' : 'şimdi';
}
export const clock = (t) => new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
export function dayLabel(t) {
  const d = new Date(t); const n = new Date();
  const y = new Date(); y.setDate(n.getDate() - 1);
  if (d.toDateString() === n.toDateString()) return 'Bugün';
  if (d.toDateString() === y.toDateString()) return 'Dün';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', ...(d.getFullYear() !== n.getFullYear() ? { year: 'numeric' } : {}) });
}
export function lastSeen(u) {
  if (isOn(u)) return 'çevrimiçi';
  const t = state.presence.get(u.id)?.lastSeen || u.lastSeen;
  if (!t) return '';
  const d = new Date(t);
  const today = new Date().toDateString() === d.toDateString();
  return `son görülme ${today ? 'bugün' : dayLabel(t).toLowerCase()} ${clock(t)}`;
}
export const num = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + ' Mn' : n >= 1e4 ? (n / 1e3).toFixed(1).replace('.0', '') + ' B' : n.toLocaleString('tr-TR'));
export const media = (src) => (src && src.startsWith('/media/') ? src : src);
export const isVideo = (src) => /\.(mp4|webm|mov)(\?|$)/i.test(src || '');

// Bildirime dokununca gidilecek yer
export function notifHref(n) {
  if (n.url && n.url.startsWith('/#/')) return n.url.slice(1);
  return ({
    match: '#/chats', live: `#/live/${n.fromId}`, follow: `#/u/${n.from?.username}`, follow_ok: `#/u/${n.from?.username}`, follow_request: '#/requests',
    super: '#/likes', liked: '#/likes', super_msg: '#/chats', safety: '#/chats', support: '#/destek', group: '#/chats', missed: '#/chats', order: '#/store', market: '#/market', verify: '#/verify', story_answer: '#/stories/me',
    announce: '#/notifications', warning: '#/notifications', report: '#/notifications',
  }[n.type]) || (n.ref ? `#/p/${n.ref}` : '#/notifications');
}

// #etiket ve @bahsetme bağlantılı metin
export function richText(text) {
  return esc(text)
    .replace(/(^|[\s(])#([\p{L}\p{N}_]{2,40})/gu, (m, a, t) => `${a}<a class="tag" href="#/tag/${encodeURIComponent(t.toLocaleLowerCase('tr-TR'))}">#${t}</a>`)
    .replace(/(^|[\s(])@([a-z0-9._]{3,24})/gi, (m, a, u) => `${a}<a class="tag" href="#/u/${u.toLowerCase()}">@${u}</a>`);
}
// Ad + mavi tik + SwipeUp+ rozeti
export const tick = (u) => (u?.verified ? `<span class="vtick" title="Doğrulanmış profil">${icon('verified')}</span>` : '');
export const nm = (u, field = 'name') => `${esc(u?.[field] || u?.username || '')}${tick(u)}`;
// Fotoğraf / video filtreleri (yalnız görüntüde uygulanır)
export const FILTERS = [
  ['', 'Normal', 'none'],
  ['canli', 'Canlı', 'saturate(1.65) contrast(1.1) brightness(1.03)'],
  ['siyahbeyaz', 'Siyah Beyaz', 'grayscale(1) contrast(1.08)'],
  ['noir', 'Noir', 'grayscale(1) contrast(1.45) brightness(.92)'],
  ['sicak', 'Sıcak', 'sepia(.28) saturate(1.35) hue-rotate(-10deg) brightness(1.05)'],
  ['soguk', 'Soğuk', 'saturate(1.1) hue-rotate(14deg) brightness(1.04) contrast(1.06)'],
  ['altin', 'Altın saat', 'sepia(.4) saturate(1.5) brightness(1.08) contrast(1.05) hue-rotate(-6deg)'],
  ['vintage', 'Vintage', 'sepia(.5) contrast(.9) brightness(1.08) saturate(.85)'],
  ['retro', 'Retro', 'sepia(.25) saturate(1.4) contrast(1.15) hue-rotate(-18deg)'],
  ['soluk', 'Soluk', 'contrast(.82) brightness(1.12) saturate(.75)'],
  ['pastel', 'Pastel', 'saturate(.7) brightness(1.15) contrast(.9)'],
  ['pembe', 'Pembe', 'sepia(.15) saturate(1.4) hue-rotate(-28deg) brightness(1.06)'],
  ['dram', 'Dram', 'contrast(1.4) saturate(1.2) brightness(.9)'],
  ['sinema', 'Sinema', 'contrast(1.2) saturate(.85) sepia(.18) hue-rotate(160deg) brightness(.95)'],
  ['gece', 'Gece', 'hue-rotate(200deg) saturate(.85) brightness(.85) contrast(1.2)'],
  ['neon', 'Neon', 'saturate(2.2) contrast(1.2) hue-rotate(-12deg)'],
  ['cadi', 'Cadı', 'sepia(.6) saturate(2.1) hue-rotate(-22deg) contrast(1.3) brightness(.82)'],
  ['hayalet', 'Hayalet', 'grayscale(.7) contrast(.9) brightness(1.18) sepia(.2) hue-rotate(170deg) saturate(1.6)'],
  ['kar', 'Kar', 'brightness(1.14) contrast(1.06) saturate(.75) sepia(.08) hue-rotate(175deg) saturate(1.3)'],
  ['isilti', 'Işıltı', 'sepia(.3) saturate(1.55) brightness(1.1) contrast(1.08) hue-rotate(-6deg)'],
  ['ask', 'Aşk', 'sepia(.22) saturate(1.5) hue-rotate(-32deg) brightness(1.08) contrast(.96)'],
  ['ruya', 'Rüya', 'brightness(1.16) contrast(.84) saturate(1.25) sepia(.12) hue-rotate(-18deg) blur(.3px)'],
];
export const filterCss = (id) => (FILTERS.find((f) => f[0] === id) || FILTERS[0])[2];

// SwipeUp+ tanıtımı / jeton yetersiz
export function plusSheet(reason) {
  sheet(null, `<div class="plus-sheet">
    <div class="plus-badge">${icon('crown')}</div>
    <h2>SwipeUp<span>+</span></h2>
    ${reason ? `<p class="muted">${esc(reason)}</p>` : ''}
    <ul class="perks">
      <li>${icon('heart')}<span><b>Sınırsız beğeni</b>Günlük sınır yok</span></li>
      <li>${icon('eye')}<span><b>Seni beğenenleri gör</b>Kim olduğunu hemen öğren</span></li>
      <li>${icon('undo')}<span><b>Geri al</b>Yanlışlıkla geçtiğin kişiye dön</span></li>
      <li>${icon('star')}<span><b>Her gün 5 süper beğeni</b>Öne çık</span></li>
      <li>${icon('bolt')}<span><b>Haftada 1 ücretsiz boost</b>30 dakika en üstte</span></li>
    </ul>
    <a class="btn primary block" href="#/store">Planları gör</a></div>`);
}
export function needCoins(msg) {
  toast(msg || 'Jetonun yetmiyor.', { title: 'Jeton gerekli', href: '#/store', ms: 5000 });
}

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// ---- Toast / uygulama içi bildirim ----
export function toast(text, { title, img, href, ms = 3500 } = {}) {
  const root = document.getElementById('toasts');
  const t = el(`<div class="toast" role="status">
    ${img ? `<img class="av av-32" src="${esc(img)}" alt="">` : ''}
    <div class="t">${title ? `<b>${esc(title)}</b>` : ''}${esc(text)}</div></div>`);
  if (href) t.onclick = () => { location.hash = href; close(); };
  root.prepend(t);
  const close = () => { t.classList.add('out'); setTimeout(() => t.remove(), 250); };
  setTimeout(close, ms);
  if (navigator.vibrate && title) navigator.vibrate(18);
}

// ---- Alt sayfa (sheet) ----
export function sheet(title, bodyHtml, { onMount, footer } = {}) {
  const root = document.getElementById('sheet-root');
  const bg = el('<div class="sheet-bg"></div>');
  const sh = el(`<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>
    ${title ? `<div class="sh-t">${esc(title)}</div>` : ''}<div class="sh-b">${bodyHtml}</div>${footer || ''}</div>`);
  const close = () => { bg.remove(); sh.remove(); window.removeEventListener('hashchange', close); };
  bg.onclick = close;
  window.addEventListener('hashchange', close);
  // aşağı sürükleyerek kapat
  let y0 = null;
  sh.querySelector('.grab').addEventListener('pointerdown', (e) => { y0 = e.clientY; });
  sh.addEventListener('pointerup', (e) => { if (y0 !== null && e.clientY - y0 > 60) close(); y0 = null; });
  root.append(bg, sh);
  onMount?.(sh, close);
  return close;
}

// ---- Avatar ----
export function avatar(u, size = 44, { ring = false, dot = true } = {}) {
  const img = `<img class="av av-${size}" src="${esc(u?.avatar)}" alt="" loading="lazy">`;
  const inner = ring && u?.live ? `<div class="ring live">${img}</div>` : img;
  return `<div class="av-wrap${u?.frame ? ` fr fr-${esc(u.frame)}` : ''}" data-presence="${esc(u?.id)}">${inner}${dot && u && isOn(u) ? '<i class="online"></i>' : ''}</div>`;
}

// Çevrimiçi noktalarını canlı güncelle
on('presence', ({ userId, online }) => {
  document.querySelectorAll(`[data-presence="${CSS.escape(userId)}"]`).forEach((w) => {
    const dot = w.querySelector('.online');
    if (online && !dot && w.dataset.nodot === undefined) w.insertAdjacentHTML('beforeend', '<i class="online"></i>');
    if (!online && dot) dot.remove();
  });
});

// ---- Web push ----
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
export function pushHint() {
  if (pushSupported()) return null;
  if (isIOS() && !isStandalone()) return 'iPhone’da bildirim almak için önce uygulamayı ana ekrana ekle (Ayarlar → Telefona yükle), sonra ana ekrandaki simgeden aç.';
  return 'Bu tarayıcı anlık bildirimleri desteklemiyor.';
}
function b64ToU8(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
export async function enablePush() {
  if (!pushSupported()) throw new Error(pushHint());
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Bildirim izni verilmedi. Tarayıcı ayarlarından açabilirsin.');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(state.config.vapidPublicKey) });
  await api('/push/subscribe', { body: { subscription: sub.toJSON() } });
  return true;
}
export async function disablePush() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) { await api('/push/unsubscribe', { body: { endpoint: sub.endpoint } }); await sub.unsubscribe(); }
}
export async function pushEnabled() {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.ready;
  return !!(await reg.pushManager.getSubscription());
}

// ---- Rozetler ----
export async function refreshBadges() {
  try { state.badges = await api('/badges'); emit('badges', state.badges); } catch {}
}

// ---- Temalar ----
export const SKINS = [
  { id: 'gunbatimi', name: 'Gün batımı', note: 'Sade, açık ya da koyu', pv: 'linear-gradient(170deg,#fff,#f5f5f7)', a: 'linear-gradient(120deg,#ff8a3d,#ff3d6e)', meta: ['#ffffff', '#0b0b0e'] },
  { id: 'pembe', name: 'Pembe rüya', note: 'Pastel, buzlu cam', pv: 'linear-gradient(170deg,#ffe3f1,#efe6ff)', a: 'linear-gradient(120deg,#ff8a5c,#ff3d8b,#a24bff)', meta: ['#ffeef7'] },
  { id: 'gece', name: 'Gece moru', note: 'Koyu, neon parıltı', pv: 'radial-gradient(80% 60% at 0 0,#3b1d73,#0d0a1a)', a: 'linear-gradient(120deg,#7c3aed,#ec4899)', meta: ['#0d0a1a'] },
  { id: 'altin', name: 'Altın', note: 'Siyah ve altın', pv: 'radial-gradient(80% 60% at 100% 0,#3b2c10,#0b0906)', a: 'linear-gradient(120deg,#ffe7a3,#f0c25a,#c58b22)', meta: ['#0b0906'] },
];
export function applySkin(id, { save = true } = {}) {
  const sk = SKINS.find((x) => x.id === id) || SKINS[0];
  const root = document.documentElement;
  if (sk.id === 'gunbatimi') delete root.dataset.skin; else root.dataset.skin = sk.id;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m, i) => {
    m.setAttribute('content', sk.id === 'gunbatimi' ? sk.meta[i] || sk.meta[0] : sk.meta[0]);
  });
  if (save) { try { localStorage.setItem('su_skin', sk.id); } catch {} }
  return sk.id;
}
export const currentSkin = () => document.documentElement.dataset.skin || 'gunbatimi';

// ---- Logo ----
export const logo = () => '<img class="mark" src="/icons/mark.png" alt="">swipeup';

// ---- Engelle / şikayet ----
const REASONS = [['spam', 'Spam ya da sahte hesap'], ['taciz', 'Taciz veya zorbalık'], ['uygunsuz', 'Uygunsuz fotoğraf ya da içerik'], ['dolandirici', 'Dolandırıcılık'], ['yas', '18 yaşından küçük olabilir'], ['diger', 'Diğer']];
export function reportUser(u, { ref } = {}) {
  sheet(`${u.name || u.username} kişisini şikayet et`, `<p class="muted" style="margin:0 16px 12px">Şikayetin gizli tutulur; ${esc(u.name || u.username)} kimin bildirdiğini görmez.</p>
    <form class="rf"><div class="radio-list">${REASONS.map(([k, l], i) => `<label><input type="radio" name="r" value="${k}" ${i ? '' : 'checked'}>${l}</label>`).join('')}</div>
    <div style="padding:0 16px 8px"><textarea class="field" name="d" placeholder="Eklemek istediğin bir şey var mı? (isteğe bağlı)" maxlength="1000"></textarea></div>
    <label class="list-item" style="gap:10px"><input type="checkbox" name="b" checked style="accent-color:var(--uv);width:18px;height:18px">Bu kişiyi engelle</label>
    <div style="padding:8px 16px 16px"><button class="btn hot block">Şikayet et</button></div></form>`, {
    onMount(sh, close) {
      const f = sh.querySelector('form');
      f.onsubmit = async (e) => {
        e.preventDefault();
        try {
          await api(`/users/${u.id}/report`, { body: { reason: f.r.value, details: f.d.value, ref } });
          if (f.b.checked) await api(`/users/${u.id}/block`, { body: {} });
          close();
          toast(f.b.checked ? 'Şikayetin alındı ve kişi engellendi.' : 'Şikayetin alındı, teşekkürler.');
          if (f.b.checked) emit('user:blocked', u.id);
        } catch (er) { toast(er.message); }
      };
    },
  });
}
// Tek bir mesajı / yorumu bildir
const MSG_REASONS = [['taciz', 'Hakaret, taciz veya zorbalık'], ['tehdit', 'Tehdit ya da şiddet'], ['uygunsuz', 'Müstehcen / uygunsuz içerik'], ['spam', 'Spam ya da reklam'], ['dolandirici', 'Dolandırıcılık, para isteme'], ['nefret', 'Nefret söylemi'], ['diger', 'Diğer']];
export function reportMessage({ kind, id, postId, user, text, media }) {
  const who = user?.name || user?.username || 'Bu kişi';
  sheet('Mesajı bildir', `<form class="rf">
    <div class="rq-quote">${user ? `<b>${esc(who)}</b>` : ''}${media ? `<span class="muted">📷 Medya</span>` : ''}${text ? `<span>${esc(String(text).slice(0, 300))}</span>` : ''}</div>
    <p class="muted" style="margin:0 16px 10px;font-size:13.5px">Bildirimin gizli tutulur; ${esc(who)} kimin bildirdiğini görmez. Ekibimiz mesajı inceler.</p>
    <div class="radio-list">${MSG_REASONS.map(([k, l], i) => `<label><input type="radio" name="r" value="${k}" ${i ? '' : 'checked'}>${l}</label>`).join('')}</div>
    <div style="padding:0 16px 8px"><textarea class="field" name="d" placeholder="Eklemek istediğin bir şey var mı? (isteğe bağlı)" maxlength="1000"></textarea></div>
    ${user && user.id !== state.me?.id ? `<label class="list-item" style="gap:10px"><input type="checkbox" name="b" style="accent-color:var(--uv);width:18px;height:18px">${esc(who)} kişisini engelle</label>` : ''}
    <div style="padding:8px 16px 16px"><button class="btn hot block">Bildir</button></div></form>`, {
    onMount(sh, close) {
      const f = sh.querySelector('form');
      f.onsubmit = async (e) => {
        e.preventDefault();
        const block = !!f.b?.checked;
        try {
          await api('/report/message', { body: { kind, id, postId, reason: f.r.value, details: f.d.value, block } });
          close();
          toast(block ? 'Mesaj bildirildi ve kişi engellendi.' : 'Mesaj bildirildi, teşekkürler.');
          if (block && user) emit('user:blocked', user.id);
        } catch (er) { toast(er.message); }
      };
    },
  });
}

export async function blockUser(u) {
  if (!confirm(`${u.name || u.username} engellensin mi? Seni göremez, sana mesaj atamaz; eşleşmeniz ve sohbetiniz silinir.`)) return false;
  try { await api(`/users/${u.id}/block`, { body: {} }); toast('Engellendi.'); emit('user:blocked', u.id); return true; } catch (e) { toast(e.message); return false; }
}
export async function unmatchUser(u) {
  if (!confirm(`${u.name || u.username} ile eşleşme kaldırılsın mı? Sohbetiniz de silinir.`)) return false;
  try { await api(`/users/${u.id}/unmatch`, { body: {} }); toast('Eşleşme kaldırıldı.'); return true; } catch (e) { toast(e.message); return false; }
}

// ---- Ses kaydı ----
export function audioRecorder() {
  let rec = null; let chunks = []; let stream = null; let started = 0;
  const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'].find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || '';
  return {
    supported: !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder),
    async start() {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      chunks = [];
      rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.start(250); started = Date.now();
    },
    elapsed: () => (started ? (Date.now() - started) / 1000 : 0),
    stop(cancel) {
      return new Promise((resolve) => {
        if (!rec) return resolve(null);
        const dur = (Date.now() - started) / 1000;
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const mime = (rec.mimeType || type || 'audio/webm').split(';')[0];
          const blob = new Blob(chunks, { type: mime });
          rec = null; started = 0;
          resolve(cancel || dur < 0.8 ? null : { file: new File([blob], `ses.${mime.includes('mp4') ? 'm4a' : mime.split('/')[1]}`, { type: mime }), duration: dur });
        };
        rec.stop();
      });
    },
  };
}
export const fmtDur = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---- Beğeni ----
export async function toggleLike(post, btn, force) {
  const want = force ?? !post.liked;
  if (force && post.liked) return;
  post.liked = want; post.likeCount += want ? 1 : -1;
  paintLike(btn, post);
  try {
    const r = await api(`/posts/${post.id}/like`, { body: { like: want } });
    post.likeCount = r.likeCount; paintLike(btn, post);
  } catch (e) { toast(e.message); }
}
export function paintLike(btn, post) {
  if (!btn) return;
  btn.classList.toggle('liked', post.liked);
  const c = btn.querySelector('.cnt');
  if (c) c.textContent = post.likeCount ? num(post.likeCount) : '';
}
export function heartBurst(container) {
  const h = el(`<div class="big-heart">${icon('heart')}</div>`);
  container.append(h);
  setTimeout(() => h.remove(), 950);
}

// Çift dokunma algılayıcı
export function onDoubleTap(target, onDouble, onSingle) {
  let last = 0; let timer;
  target.addEventListener('click', (e) => {
    const t = Date.now();
    if (t - last < 280) { clearTimeout(timer); last = 0; onDouble(e); } else {
      last = t; timer = setTimeout(() => onSingle?.(e), 290);
    }
  });
}

// ---- Yorumlar ----
export function openComments(post) {
  const close = sheet('Yorumlar', '<div class="cl"><div class="spinner"></div></div>', {
    footer: `<form class="comment-input">${avatar(state.me, 32, { dot: false })}<input name="t" placeholder="${esc(post.user.username)} için yorum ekle..." autocomplete="off" maxlength="500"><button class="link">Paylaş</button></form>`,
    async onMount(sh) {
      mentionAutocomplete(sh.querySelector('.comment-input input'));
      const list = sh.querySelector('.cl');
      const row = (c) => `<div class="comment" data-cid="${esc(c.id)}">${avatar(c.user, 32, { dot: false })}<div class="t"><span class="b">${nm(c.user, 'username')}</span><span class="muted">${ago(c.at)}</span><div>${richText(c.text)}</div></div><button class="cmore" aria-label="Yorum seçenekleri">${icon('more')}</button></div>`;
      let cs = [];
      list.addEventListener('click', (e) => {
        const b = e.target.closest('.cmore'); if (!b) return;
        const el_ = b.closest('[data-cid]'); const c = cs.find((x) => x.id === el_.dataset.cid); if (!c) return;
        const mine = c.user?.id === state.me.id; const owner = post.user?.id === state.me.id;
        sheet(null, `<div class="menu">
          ${mine || owner ? `<button data-a="del" class="danger">${icon('trash')}Yorumu sil</button>` : ''}
          ${mine ? '' : `<button data-a="rep" class="danger">${icon('flag')}Yorumu bildir</button>`}
          <button data-a="copy">${icon('copy')}Kopyala</button></div>`, {
          onMount(s2, close2) {
            s2.querySelector('.menu').onclick = async (ev) => {
              const a = ev.target.closest('[data-a]')?.dataset.a; if (!a) return;
              close2();
              if (a === 'copy') { await navigator.clipboard?.writeText(c.text); toast('Kopyalandı.'); }
              if (a === 'rep') reportMessage({ kind: 'comment', id: c.id, postId: post.id, user: c.user, text: c.text });
              if (a === 'del') {
                try { await api(`/posts/${post.id}/comments/${c.id}`, { method: 'DELETE' }); el_.remove(); post.commentCount = Math.max(0, post.commentCount - 1); toast('Yorum silindi.'); } catch (er) { toast(er.message); }
              }
            };
          },
        });
      });
      try {
        cs = await api(`/posts/${post.id}/comments`);
        list.innerHTML = cs.length ? cs.map(row).join('') : '<div class="empty"><h2>Henüz yorum yok</h2>Sohbeti başlat.</div>';
      } catch (e) { list.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
      const f = sh.querySelector('form');
      f.onsubmit = async (e) => {
        e.preventDefault();
        const text = f.t.value.trim(); if (!text) return;
        f.t.value = '';
        try {
          const c = await api(`/posts/${post.id}/comments`, { body: { text } });
          cs.push(c);
          if (list.querySelector('.empty')) list.innerHTML = '';
          list.insertAdjacentHTML('beforeend', row(c));
          post.commentCount++;
          list.lastElementChild.scrollIntoView({ behavior: 'smooth' });
        } catch (er) { toast(er.message); }
      };
    },
  });
  return close;
}

export function sharePost(post) {
  const reel = post.type === 'reel';
  return shareSheet({ ref: { kind: 'post', id: post.id }, url: `${location.origin}/#/${reel ? 'vitrin' : 'p'}/${post.id}`, title: 'SwipeUp', text: post.caption ? `${post.caption.slice(0, 100)}` : `@${post.user?.username || ''} SwipeUp’ta ${reel ? 'bir vitrin videosu' : 'bir gönderi'} paylaştı` });
}

// ---- Paylaş: önce uygulamadaki kişilere, sonra diğer uygulamalara ----
const SH_ICONS = {
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>',
  wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.2-.2-.5-.3z"/></svg>',
  tg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.4 4.2 2.9 11.3c-1.3.5-1.2 1.2-.2 1.5l4.7 1.5 1.8 5.6c.2.6.4.8.8.8.4 0 .6-.2.9-.5l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.9-1.3-1.5zM9.6 14.1l8.5-7.7c.4-.3-.1-.5-.6-.2l-10.4 6.6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.8 3h3.1l-6.8 7.7 8 10.3h-6.2l-4.9-6.3L5.4 21H2.3l7.2-8.2L1.8 3h6.4l4.4 5.8zm-1.1 16.2h1.7L7.4 4.7H5.6z"/></svg>',
  fb: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 8.5V6.8c0-.8.2-1.3 1.4-1.3H17V2.2a21 21 0 0 0-2.5-.2C12 2 10.3 3.5 10.3 6.3v2.2H7.6v3.7h2.7V22H14v-9.8h2.7l.4-3.7z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
};
export function shareSheet({ ref, url, title = 'SwipeUp', text = '', extra = [] }) {
  const enc = encodeURIComponent; const msgTxt = text ? `${text} ${url}` : url;
  const ext = [
    ['copy', 'Bağlantıyı kopyala', 'c-copy'],
    ['wa', 'WhatsApp', 'c-wa', `https://wa.me/?text=${enc(msgTxt)}`],
    ['tg', 'Telegram', 'c-tg', `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`],
    ['x', 'X', 'c-x', `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(text)}`],
    ['fb', 'Facebook', 'c-fb', `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`],
    ['mail', 'E-posta', 'c-mail', `mailto:?subject=${enc(title)}&body=${enc(msgTxt)}`],
    ...(navigator.share ? [['more', 'Diğer', 'c-more']] : []),
  ];
  const close = sheet(null, `<div class="shs">
      <div class="shs-s">${icon('search')}<input class="field" placeholder="Ara" autocapitalize="off" autocomplete="off"></div>
      <div class="shs-g"><div class="spinner"></div></div>
      <div class="shs-send" hidden><input class="field shs-m" maxlength="500" placeholder="Bir mesaj yaz..."><button class="btn primary block shs-go">Gönder</button></div>
      <div class="shs-ext">${[...extra.map(([k, l, c]) => [k, l, c]), ...ext].map(([k, l, c, href]) => (href ? `<a class="shx ${c}" href="${esc(href)}" target="_blank" rel="noopener" data-k="${k}"><span>${SH_ICONS[k] || ''}</span><small>${l}</small></a>` : `<button class="shx ${c || ''}" data-k="${k}"><span>${SH_ICONS[k] || icon(k)}</span><small>${l}</small></button>`)).join('')}</div>
    </div>`, {
    onMount(sh, closeFn) {
      const grid = sh.querySelector('.shs-g'); const inp = sh.querySelector('.shs-s input'); const send = sh.querySelector('.shs-send');
      const picked = new Map(); let list = []; let n = 0; let tmr = null;
      const paint = () => {
        grid.innerHTML = list.length ? list.map((t, i) => `<button class="sht ${picked.has(t.kind + t.id) ? 'on' : ''}" data-i="${i}"><span class="sht-av"><img src="${esc(t.avatar)}" alt=""><i class="sht-ck">${icon('check')}</i></span><b>${esc(t.name)}</b><small>${esc(t.group ? 'Grup' : t.username || '')}</small></button>`).join('')
          : `<div class="empty" style="padding:24px;grid-column:1/-1">${inp.value ? 'Kimse bulunamadı.' : 'Henüz sohbetin ya da takip ettiğin kimse yok. Ara ve gönder.'}</div>`;
        send.hidden = !picked.size;
        sh.querySelector('.shs-go').textContent = picked.size > 1 ? `Ayrı ayrı gönder (${picked.size})` : 'Gönder';
        sh.querySelector('.shs-ext').hidden = !!picked.size;
      };
      const load = async () => { const my = ++n; const r = await api(`/share/targets?q=${enc(inp.value.trim())}`).catch(() => []); if (my !== n) return; list = [...[...picked.values()].filter((p) => !r.some((x) => x.kind === p.kind && x.id === p.id)), ...r]; paint(); };
      inp.oninput = () => { clearTimeout(tmr); tmr = setTimeout(load, 180); };
      grid.onclick = (e) => {
        const b = e.target.closest('[data-i]'); if (!b) return;
        const t = list[+b.dataset.i]; const k = t.kind + t.id;
        picked.has(k) ? picked.delete(k) : picked.set(k, t);
        navigator.vibrate?.(8); paint();
      };
      sh.querySelector('.shs-go').onclick = async (e) => {
        e.target.disabled = true;
        try {
          const r = await api('/share', { body: { ref, targets: [...picked.values()].map((t) => ({ kind: t.kind, id: t.id })), text: sh.querySelector('.shs-m').value } });
          closeFn(); toast(r.sent > 1 ? `${r.sent} kişiye gönderildi.` : 'Gönderildi.', r.chatId ? { href: `#/chat/${r.chatId}` } : undefined);
        } catch (er) { toast(er.message); e.target.disabled = false; }
      };
      sh.querySelector('.shs-ext').onclick = async (e) => {
        const b = e.target.closest('[data-k]'); if (!b) return;
        const k = b.dataset.k;
        const ex = extra.find((x) => x[0] === k);
        if (ex) { e.preventDefault(); closeFn(); ex[3]?.(); return; }
        if (k === 'copy') { e.preventDefault(); try { await navigator.clipboard.writeText(url); toast('Bağlantı kopyalandı.'); } catch { prompt('Bağlantı', url); } closeFn(); return; }
        if (k === 'more') { e.preventDefault(); closeFn(); navigator.share({ title, text, url }).catch(() => {}); return; }
        setTimeout(closeFn, 200);
      };
      load();
    },
  });
  return close;
}

// Kaydedilenler (cihazda)
export const saved = {
  all: () => { try { return JSON.parse(localStorage.getItem('su_saved') || '[]'); } catch { return []; } },
  has(id) { return this.all().includes(id); },
  toggle(id) {
    const s = this.all(); const i = s.indexOf(id);
    i >= 0 ? s.splice(i, 1) : s.unshift(id);
    try { localStorage.setItem('su_saved', JSON.stringify(s)); } catch {}
    return i < 0;
  },
};

export async function openChatWith(userId) {
  const c = await api('/chats', { body: { userId } });
  location.hash = `#/chat/${c.id}`;
}


// ---- @ etiketleme: kişi önerisi ve kişi arama ----
const searchPeople = (q) => api(`/users/search?q=${encodeURIComponent(q || '')}`).catch(() => []);
export function mentionAutocomplete(input) {
  if (!input || input.dataset.mention) return () => {};
  input.dataset.mention = '1';
  const pop = document.createElement('div'); pop.className = 'mention-pop'; pop.hidden = true;
  document.body.append(pop);
  let items = []; let sel = 0; let token = null; let tmr = null; let reqNo = 0;
  const hide = () => { pop.hidden = true; token = null; };
  const place = () => {
    const r = input.getBoundingClientRect();
    const h = Math.min(pop.scrollHeight, 260);
    const below = window.innerHeight - r.bottom; const up = below < h + 12 && r.top > h + 12;
    pop.style.left = `${Math.max(8, r.left)}px`; pop.style.width = `${Math.min(r.width, window.innerWidth - 16)}px`;
    pop.style.top = up ? `${r.top - h - 6}px` : `${r.bottom + 6}px`;
  };
  const paint = () => {
    if (!items.length) { pop.innerHTML = `<div class="mp-empty">${token ? 'Kimse bulunamadı' : 'Bir isim yaz'}</div>`; } else {
      pop.innerHTML = `${token === '' ? '<div class="mp-h">Önerilen kişiler</div>' : ''}${items.map((u, i) => `<button type="button" class="mp-it ${i === sel ? 'on' : ''}" data-i="${i}"><img src="${esc(u.avatar)}" alt=""><span><b>${esc(u.name)}${u.verified ? ' ✓' : ''}</b><small>@${esc(u.username)}</small></span></button>`).join('')}`;
    }
    pop.hidden = false; place();
  };
  const find = () => {
    const v = input.value; const pos = input.selectionStart ?? v.length;
    const m = v.slice(0, pos).match(/(^|\s)@([\p{L}0-9._]{0,24})$/u);
    return m ? { q: m[2], start: pos - m[2].length - 1, end: pos } : null;
  };
  const check = () => {
    const t = find();
    if (!t) { hide(); return; }
    token = t.q;
    clearTimeout(tmr);
    tmr = setTimeout(async () => {
      const n = ++reqNo; const list = await searchPeople(t.q);
      if (n !== reqNo || token === null) return;
      items = list.slice(0, 7); sel = 0; paint();
    }, t.q ? 160 : 0);
  };
  const pick = (u) => {
    const t = find(); if (!t || !u) return;
    const v = input.value; const ins = `@${u.username} `;
    input.value = v.slice(0, t.start) + ins + v.slice(t.end);
    const c = t.start + ins.length; input.setSelectionRange(c, c);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    hide(); input.focus();
  };
  pop.addEventListener('pointerdown', (e) => { e.preventDefault(); const b = e.target.closest('.mp-it'); if (b) pick(items[+b.dataset.i]); });
  input.addEventListener('input', check);
  input.addEventListener('click', check);
  input.addEventListener('keydown', (e) => {
    if (pop.hidden || !items.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length; paint(); }
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); pick(items[sel]); }
    if (e.key === 'Escape') hide();
  }, true);
  input.addEventListener('blur', () => setTimeout(hide, 150));
  const onScroll = () => { if (!pop.hidden) place(); };
  window.addEventListener('resize', onScroll); window.visualViewport?.addEventListener('resize', onScroll);
  const obs = new MutationObserver(() => { if (!input.isConnected) { cleanup(); } });
  obs.observe(document.body, { childList: true, subtree: true });
  function cleanup() { pop.remove(); obs.disconnect(); window.removeEventListener('resize', onScroll); window.visualViewport?.removeEventListener('resize', onScroll); }
  return cleanup;
}
// Kişi seç (arama + öneri)
export function pickPerson(title, onPick) {
  sheet(title || 'Kişi etiketle', `<div class="pp-box"><div class="pp-s">${icon('search')}<input class="field" placeholder="İsim ya da kullanıcı adı ara" autocapitalize="off" autocomplete="off"></div><div class="pp-l"><div class="spinner"></div></div></div>`, {
    onMount(sh, close) {
      const inp = sh.querySelector('input'); const box = sh.querySelector('.pp-l');
      let n = 0; let tmr = null; let list = [];
      const load = async () => {
        const my = ++n; const q = inp.value.trim().replace(/^@/, '');
        list = await searchPeople(q); if (my !== n) return;
        box.innerHTML = (q ? '' : '<div class="mp-h">Önerilen kişiler</div>') + (list.length ? list.map((u, i) => `<button class="list-item" data-i="${i}">${avatar(u, 40, { dot: false })}<div class="grow"><div class="b">${nm(u)}</div><div class="sub">@${esc(u.username)}</div></div></button>`).join('') : '<div class="empty" style="padding:20px">Kimse bulunamadı.</div>');
      };
      inp.oninput = () => { clearTimeout(tmr); tmr = setTimeout(load, 180); };
      box.onclick = (e) => { const b = e.target.closest('[data-i]'); if (!b) return; close(); onPick(list[+b.dataset.i]); };
      load(); setTimeout(() => inp.focus(), 80);
    },
  });
}

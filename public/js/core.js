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
  if (!res.ok) throw new Error(data.error || 'Bir şeyler ters gitti.');
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

// Fotoğrafı yüklemeden önce küçült (en uzun kenar 1440px)
export async function compressImage(file, max = 1440, quality = 0.85) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', quality));
  return blob ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : file;
}

export function pickFile(accept, capture) {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept;
    if (capture) inp.setAttribute('capture', capture);
    inp.onchange = () => resolve(inp.files[0] || null);
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
    if (e.message === 'banned') { s.disconnect(); api('/me').then((m) => m.ban && emit('banned', m.ban)).catch(() => {}); }
  });
  s.on('account:banned', () => { api('/me').then((m) => m.ban && emit('banned', m.ban)).catch(() => {}); });
  s.on('connect', () => s.emit('visibility', document.visibilityState === 'visible'));
  document.addEventListener('visibilitychange', () => s.emit('visibility', document.visibilityState === 'visible'));
  ['message', 'typing', 'read', 'delivered', 'notification', 'match', 'post:likes',
    'message:update', 'message:hidden', 'chat:removed', 'chat:update', 'blocked', 'stories:update', 'people:new', 'likes:new',
    'call:incoming', 'call:accepted', 'call:ended', 'call:taken', 'call:signal',
    'live:viewer', 'live:viewer-left', 'live:signal', 'live:comment', 'live:heart', 'live:count', 'live:ended']
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
  return `<div class="av-wrap" data-presence="${esc(u?.id)}">${inner}${dot && u && isOn(u) ? '<i class="online"></i>' : ''}</div>`;
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
  if (isIOS() && !isStandalone()) return 'iPhone’da bildirim almak için Paylaş → Ana Ekrana Ekle ile uygulamayı yükle, sonra buradan aç.';
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
export const logo = () => `<span class="mark">${icon('arrowUp')}</span>swipeup`;

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
      const list = sh.querySelector('.cl');
      const row = (c) => `<div class="comment">${avatar(c.user, 32, { dot: false })}<div class="t"><span class="b">${esc(c.user?.username)}</span><span class="muted">${ago(c.at)}</span><div>${esc(c.text)}</div></div></div>`;
      try {
        const cs = await api(`/posts/${post.id}/comments`);
        list.innerHTML = cs.length ? cs.map(row).join('') : '<div class="empty"><h2>Henüz yorum yok</h2>Sohbeti başlat.</div>';
      } catch (e) { list.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
      const f = sh.querySelector('form');
      f.onsubmit = async (e) => {
        e.preventDefault();
        const text = f.t.value.trim(); if (!text) return;
        f.t.value = '';
        try {
          const c = await api(`/posts/${post.id}/comments`, { body: { text } });
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

export async function sharePost(post) {
  const url = `${location.origin}/#/${post.type === 'reel' ? 'reels' : 'p'}/${post.id}`;
  if (navigator.share) {
    try { await navigator.share({ title: 'SwipeUp', text: post.caption || '', url }); return; } catch { return; }
  }
  await navigator.clipboard?.writeText(url);
  toast('Bağlantı kopyalandı.');
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

// Yeni sürüm algılama ve güncelleme ekranı.
// Yayın sonrası eski sayfada kalan modüller yeni dosyalarla uyuşmaz ve bazı ekranlar açılmaz;
// bunu önlemek için sürüm değişince uygulama kendini yeniler ve kaldığı yerden devam eder.
import { toast } from './core.js';

let current = null;
let pending = null;
let screenOn = false;
let bannerEl = null;
const DRAFT = 'su_draft:';

// Arama, canlı yayın, kayıt ya da paylaşım hazırlığı sırasında araya girme
const busy = () => !!document.querySelector('.call')
  || /^#\/live/.test(location.hash)
  || !!document.querySelector('.composer .go.rec, .rec-bar')
  || (/^#\/create/.test(location.hash) && !!document.querySelector('.picker > img, .picker > video'));

export function checkVersion(v) {
  if (!v) return;
  if (!current) { current = v; return; }
  if (v === current || v === pending) return;
  pending = v;
  if (busy()) showBanner(); else showScreen();
}

export async function fetchVersion() {
  try {
    const r = await fetch('/api/version', { cache: 'no-store' });
    if (r.ok) checkVersion((await r.json()).version);
  } catch {}
}

function saveDrafts() {
  try {
    document.querySelectorAll('.composer textarea, .comment-input input').forEach((t) => {
      if (t.value.trim()) sessionStorage.setItem(DRAFT + location.hash, t.value);
    });
  } catch {}
}

// Güncelleme sonrası yarım kalan mesajı geri koy
export function restoreDraft(textarea) {
  try {
    const k = DRAFT + location.hash;
    const v = sessionStorage.getItem(k);
    if (v && textarea && !textarea.value) { textarea.value = v; textarea.dispatchEvent(new Event('input')); }
    sessionStorage.removeItem(k);
  } catch {}
}

export async function applyUpdate() {
  saveDrafts();
  try { sessionStorage.setItem('su_updated', String(Date.now())); } catch {}
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update().catch(() => {});
    const keys = await caches?.keys();
    await Promise.all((keys || []).map((k) => caches.delete(k)));
  } catch {}
  location.reload();
}

function showScreen(text) {
  if (screenOn) return;
  screenOn = true;
  bannerEl?.remove(); bannerEl = null;
  const ov = document.createElement('div');
  ov.className = 'update-screen';
  ov.setAttribute('role', 'alertdialog');
  ov.innerHTML = `<div class="us-in">
    <img class="us-logo" src="/icons/mark.png" alt="">
    <h2>${text || 'Yeni sürüm hazır'}</h2>
    <p>SwipeUp güncelleniyor. Birkaç saniye içinde kaldığın yerden devam edeceksin.</p>
    <div class="us-bar"><i></i></div>
    <button class="btn primary us-go">Şimdi güncelle</button></div>`;
  document.body.append(ov);
  ov.querySelector('.us-go').onclick = applyUpdate;
  setTimeout(applyUpdate, 2200);
}

function showBanner() {
  if (bannerEl || screenOn) return;
  bannerEl = document.createElement('div');
  bannerEl.className = 'update-banner';
  bannerEl.innerHTML = '<span>✨ Yeni sürüm hazır</span><button class="us-later">Sonra</button><button class="us-now">Güncelle</button>';
  document.body.append(bannerEl);
  bannerEl.querySelector('.us-now').onclick = () => showScreen();
  bannerEl.querySelector('.us-later').onclick = () => { bannerEl.classList.add('min'); };
  // Meşgul ekrandan çıkınca kendiliğinden güncelle
  const tryLater = () => { if (pending && !busy()) { window.removeEventListener('hashchange', tryLater); setTimeout(() => { if (!busy()) showScreen(); }, 400); } };
  window.addEventListener('hashchange', tryLater);
}

// Eski modül / dosya uyuşmazlığından kaynaklanan hata mı?
// Chrome, Safari (iPhone) ve Firefox'un eski-modül hata mesajları
const STALE = /dynamically imported module|Importing a module script failed|error loading dynamically|does not provide an export named|doesn't provide an export named|Importing binding name .* is not found|ambiguous indirect export|Unexpected token '<'/i;
export function recover(err) {
  const msg = String(err?.message || err || '');
  if (!STALE.test(msg) || navigator.onLine === false) return false;
  let last = 0;
  try { last = +sessionStorage.getItem('su_updated') || 0; } catch {}
  if (Date.now() - last < 20000) return false; // az önce yenilendiyse döngüye girme
  showScreen('Uygulama güncellendi');
  return true;
}

export function afterBoot(version) {
  current = current || version || null;
  try {
    const t = +sessionStorage.getItem('su_updated') || 0;
    if (t && Date.now() - t < 60000) { sessionStorage.removeItem('su_updated'); setTimeout(() => toast('SwipeUp güncellendi ✨', { ms: 2500 }), 600); }
  } catch {}
  setInterval(() => { if (document.visibilityState === 'visible') fetchVersion(); }, 3 * 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') fetchVersion(); });
  navigator.serviceWorker?.addEventListener('controllerchange', () => fetchVersion());
}

// "Telefona yükle" kılavuzu: iPhone'da Safari → Paylaş → Ana Ekrana Ekle,
// Android/masaüstünde tarayıcının yükleme penceresi.
import { icon } from './icons.js';
import { esc, toast } from './core.js';

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isAndroid = () => /android/i.test(navigator.userAgent);
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
// Uygulama içi tarayıcılar (Instagram, Facebook, TikTok vb.) ana ekrana ekleyemez
const inApp = () => /FBAN|FBAV|Instagram|Line\/|TikTok|musical_ly|Snapchat|Twitter|LinkedInApp|GSA\//i.test(navigator.userAgent);
const iosSafari = () => isIOS() && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent) && !inApp();

let deferred = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; document.documentElement.classList.add('can-install'); });
window.addEventListener('appinstalled', () => { deferred = null; toast('SwipeUp yüklendi 🎉'); });
export const canPrompt = () => !!deferred;

const shareIcon = '<svg viewBox="0 0 24 24" class="i ios-share" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/></svg>';
const addIcon = '<svg viewBox="0 0 24 24" class="i" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/></svg>';

export function guideHtml() {
  const url = location.origin;
  if (isStandalone()) {
    return `<div class="ins-done">${icon('check')}<b>SwipeUp bu cihazda yüklü</b><span>Ana ekrandaki S simgesinden açıyorsun. Bildirimleri Ayarlar → Bildirimler’den açabilirsin.</span></div>`;
  }
  if (isIOS() && !iosSafari()) {
    return `<div class="ins-warn">${icon('flag')}<span><b>Önce Safari’de aç</b>Bu tarayıcıdan ana ekrana eklenemiyor. Bağlantıyı kopyala, Safari’ye yapıştır ve oradan devam et.</span></div>
      <div class="ins-link"><span>${esc(url.replace(/^https?:\/\//, ''))}</span><button class="btn sm primary ins-copy" data-url="${esc(url)}">${icon('copy')} Kopyala</button></div>
      ${iosSteps()}`;
  }
  if (isIOS()) return iosSteps();
  if (deferred) {
    return `<div class="ins-one"><img src="/icons/icon-192.png" alt=""><div><b>SwipeUp</b><span>Tek dokunuşla telefonuna yükle; uygulama gibi tam ekran açılır, bildirim alırsın.</span></div></div>
      <button class="btn primary block ins-go">${icon('download')} Uygulamayı yükle</button>`;
  }
  if (isAndroid()) {
    return `<ol class="ins-steps">
      <li><span class="n">1</span><span>Chrome’da sağ üstteki <b>⋮</b> menüsüne dokun.</span></li>
      <li><span class="n">2</span><span><b>Uygulamayı yükle</b> ya da <b>Ana ekrana ekle</b>’yi seç.</span></li>
      <li><span class="n">3</span><span>Ana ekranındaki <b>SwipeUp</b> simgesinden aç.</span></li></ol>`;
  }
  return `<ol class="ins-steps">
    <li><span class="n">1</span><span>Telefonunda <b>${esc(url.replace(/^https?:\/\//, ''))}</b> adresini aç.</span></li>
    <li><span class="n">2</span><span>iPhone’da Safari → Paylaş → <b>Ana Ekrana Ekle</b>; Android’de Chrome → ⋮ → <b>Uygulamayı yükle</b>.</span></li>
    <li><span class="n">3</span><span>Bilgisayarda adres çubuğundaki ${addIcon} yükle simgesini kullanabilirsin.</span></li></ol>`;
}

function iosSteps() {
  return `<ol class="ins-steps">
    <li><span class="n">1</span><span>Alttaki <b>Paylaş</b> düğmesine dokun <span class="key">${shareIcon}</span></span></li>
    <li><span class="n">2</span><span>Listeyi kaydır, <b>Ana Ekrana Ekle</b>’yi seç <span class="key">${addIcon}</span></span></li>
    <li><span class="n">3</span><span>Sağ üstte <b>Ekle</b>’ye dokun.</span></li>
    <li><span class="n">4</span><span>Ana ekranındaki <b>SwipeUp</b> simgesinden aç. Bildirimler ancak böyle açıldığında çalışır.</span></li></ol>
    <div class="ins-phone"><div class="bar"><span>${esc(location.host)}</span></div><div class="dock"><i></i><i></i><span class="hl">${shareIcon}</span><i></i><i></i></div><div class="arrow">${icon('arrowUp')}</div></div>`;
}

export function wireGuide(root, onDone) {
  root.querySelector('.ins-copy')?.addEventListener('click', async (e) => {
    try { await navigator.clipboard.writeText(e.currentTarget.dataset.url); toast('Bağlantı kopyalandı. Safari’ye yapıştır.'); } catch { toast(e.currentTarget.dataset.url); }
  });
  root.querySelector('.ins-go')?.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    const r = await deferred.userChoice.catch(() => null);
    deferred = null;
    if (r?.outcome === 'accepted') onDone?.();
  });
}

// İlk ziyarette (ve 7 günde bir) alttan kılavuz göster
export function maybeShowInstall() {
  if (isStandalone() || location.hash.startsWith('#/install')) return;
  if (!isIOS() && !deferred) return; // Android'de tarayıcı yükleme penceresi hazır olunca gösterilir
  let last = 0;
  try { last = +localStorage.getItem('su_install_seen') || 0; } catch {}
  if (Date.now() - last < 7 * 86400000) return;
  if (document.querySelector('.ins-sheet, .sheet, .ann-modal, .update-screen, .match-modal')) return;
  try { localStorage.setItem('su_install_seen', String(Date.now())); } catch {}
  const bg = document.createElement('div'); bg.className = 'sheet-bg';
  const sh = document.createElement('div'); sh.className = 'sheet ins-sheet'; sh.setAttribute('role', 'dialog');
  sh.innerHTML = `<div class="grab"></div><div class="ins-head"><img src="/icons/icon-192.png" alt=""><div><b>SwipeUp’ı ${isIOS() ? 'iPhone’a' : 'telefonuna'} yükle</b><span>Ücretsiz · uygulama gibi tam ekran · bildirimler</span></div></div>
    <div class="ins-body">${guideHtml()}</div><div class="ins-foot"><button class="btn block ins-later">Şimdi değil</button></div>`;
  const close = () => { bg.remove(); sh.remove(); };
  bg.onclick = close; sh.querySelector('.ins-later').onclick = close;
  document.getElementById('sheet-root').append(bg, sh);
  wireGuide(sh, close);
}

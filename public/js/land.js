// Masa oyunları yatay ekranda oynanır.
// Telefon dikey tutuluyorsa sayfa 90° döndürülerek yatay gösterilir (iPhone'da yön kilidi yok);
// Android'de ilk dokunuşta tam ekran + yatay yön kilidi denenir, olursa döndürmeye gerek kalmaz.
import { ask as baseAsk } from './engage.js';

const html = document.documentElement;
const portrait = matchMedia('(orientation: portrait) and (pointer: coarse)');
let users = 0; let tap = null;
const apply = () => html.classList.toggle('force-land', users > 0 && portrait.matches);

async function tryLock() {
  if (!users || !portrait.matches || !screen.orientation?.lock || !html.requestFullscreen) return;
  try {
    if (!document.fullscreenElement) await html.requestFullscreen({ navigationUI: 'hide' });
    await screen.orientation.lock('landscape');
  } catch { /* desteklenmiyorsa döndürülmüş görünüm devam eder */ }
}
function unlock() {
  try { screen.orientation?.unlock?.(); } catch {}
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}

export function enterLandscape() {
  users++;
  if (users === 1) {
    html.classList.add('land-game');
    portrait.addEventListener?.('change', apply);
    tap = () => { tryLock(); };
    document.addEventListener('pointerdown', tap, { capture: true, once: true });
  }
  apply();
  let done = false;
  return () => {
    if (done) return; done = true; users = Math.max(0, users - 1);
    if (users) return;
    html.classList.remove('land-game', 'force-land');
    portrait.removeEventListener?.('change', apply);
    if (tap) document.removeEventListener('pointerdown', tap, { capture: true });
    tap = null; unlock();
  };
}

// Dokunma koordinatını (ekran) sayfa koordinatına çevir: döndürülmüş görünümde sürüklenen taş parmağın altında kalsın
export function toLocal(x, y) {
  if (!html.classList.contains('force-land')) return { x, y };
  return { x: y, y: window.innerWidth - x };
}

// confirm() yerine: döndürülmüş ekranda da düzgün görünen uygulama içi onay
export const ask = (title, text, okLabel = 'Evet', { danger = false } = {}) => baseAsk(title, text, { ok: okLabel, danger });

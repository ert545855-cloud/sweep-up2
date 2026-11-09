// Figma'da tasarlanan etkileşim ikonları (public/img/eg/*.svg, scripts/build-eg-icons.mjs ile üretilir).
// Emoji yerine her yerde bu rozetler kullanılır; yönetimden eklenen yeni kulüp/hediye için emoji yedek kalır.
import { esc } from './core.js';

const HAS = new Set(['seri', 'soru', 'secki', 'kulup', 'karaoke', 'burc', 'koruyucu', 'odul', 'hediye', 'uyum', 'gorev', 'dinle', 'genel', 'odalar', 'hizli', 'mekan', 'fal-ruya', 'etkinlik', 'enler', 'seviye', 'okey', 'cizbil', 'tavla', 'pisti', 'batak', 'kizma', 'renk', 'okey101', 'casus', 'isimsehir', 'yasakli', 'sarki', 'bilgi', 'vampir', 'xox', 'dorttas', 'tkm', 'amiral',
  'club-muzik', 'club-oyun', 'club-burc', 'club-futbol', 'club-dizi', 'club-kitap', 'club-seyahat', 'club-spor', 'club-yemek', 'club-teknoloji',
  'gift-gul', 'gift-kalp', 'gift-kahve', 'gift-yildiz', 'gift-tac', 'gift-yuzuk', 'gift-roket', 'gift-elmas',
  'fal-kahve', 'fal-tarot', 'fal-burc', 'fal-uyum', 'pack-ask_ay', 'pack-tarot_ay', 'pack-kahve_3', 'pack-yillik',
  'z-koc', 'z-boga', 'z-ikizler', 'z-yengec', 'z-aslan', 'z-basak', 'z-terazi', 'z-akrep', 'z-yay', 'z-oglak', 'z-kova', 'z-balik']);

export const egSrc = (k) => `/img/eg/${k}.svg`;
export const hasEg = (k) => HAS.has(k);
export const egi = (k, size = 24, cls = '') => `<img class="egi ${cls}" src="${egSrc(k)}" width="${size}" height="${size}" alt="" decoding="async">`;
const fallback = (em, size, cls) => `<span class="egi egi-em ${cls}" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.62)}px">${esc(em || '★')}</span>`;
const pick = (k, em, size, cls) => (HAS.has(k) ? egi(k, size, cls) : fallback(em, size, cls));

export const clubIcon = (c, size = 40, cls = '') => pick(`club-${c?.id}`, c?.em, size, cls);
export const giftIcon = (g, size = 40, cls = '') => pick(`gift-${g?.id}`, g?.em, size, cls);
export const packIcon = (p, size = 40, cls = '') => pick(`pack-${p?.id}`, p?.em, size, cls);
export const falIcon = (type, size = 40, cls = '') => pick(`fal-${type}`, '', size, cls);
export const zodiacIcon = (z, size = 40, cls = '') => pick(`z-${z}`, '', size, cls);

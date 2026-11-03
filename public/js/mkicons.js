// SwipeUp Store kategori ikonları: her kategori kendi renk geçişli karosunda, beyaz ve iki tonlu çizim.
// Karo rengi CSS'te (.mk-ci[data-c]) tanımlı; çizimdeki koyu ayrıntılar currentColor ile karonun koyu tonunu alır.
const W = '#fff';
const S = (d) => `<svg viewBox="0 0 48 48" aria-hidden="true">${d}</svg>`;
const G = {
  tumu: S(`<rect x="8" y="8" width="14" height="14" rx="4" fill="${W}"/><rect x="26" y="8" width="14" height="14" rx="4" fill="${W}" opacity=".6"/>
    <rect x="8" y="26" width="14" height="14" rx="4" fill="${W}" opacity=".6"/><path d="M33 25.5c.7 3.3 2.2 4.8 5.5 5.5-3.3.7-4.8 2.2-5.5 5.5-.7-3.3-2.2-4.8-5.5-5.5 3.3-.7 4.8-2.2 5.5-5.5z" fill="${W}"/>`),
  elektronik: S(`<rect x="14" y="5" width="20" height="38" rx="5.5" fill="${W}"/><rect x="16.8" y="10.5" width="14.4" height="25" rx="2.5" fill="currentColor"/>
    <rect x="21" y="7.3" width="6" height="1.6" rx=".8" fill="currentColor" opacity=".5"/><circle cx="24" cy="39.4" r="1.5" fill="currentColor" opacity=".45"/>
    <rect x="19.3" y="14" width="9.4" height="7" rx="1.6" fill="${W}" opacity=".9"/><rect x="19.3" y="23.5" width="9.4" height="2" rx="1" fill="${W}" opacity=".55"/><rect x="19.3" y="27.5" width="6" height="2" rx="1" fill="${W}" opacity=".55"/>`),
  giyim: S(`<path d="M17.5 7.5 8 12.6l3.6 8.4 4.4-2.1V41h16V18.9l4.4 2.1L40 12.6 30.5 7.5c-1 3.2-3.6 5.3-6.5 5.3s-5.5-2.1-6.5-5.3z" fill="${W}"/>
    <path d="M17.5 7.5c1 3.2 3.6 5.3 6.5 5.3s5.5-2.1 6.5-5.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".55"/>
    <rect x="25.5" y="21" width="5" height="5.5" rx="1.2" fill="currentColor" opacity=".35"/>`),
  ayakkabi: S(`<path d="M6.5 31.5c0-6 .8-13 2.8-15.5h7.4l3.4 5.2c3.2 3 9 4.6 15.4 5.6 4.8.8 7.8 2.7 7.8 6.2v.5z" fill="${W}"/>
    <path d="M5.5 33.5h38v2.8a3.2 3.2 0 0 1-3.2 3.2H8.7a3.2 3.2 0 0 1-3.2-3.2z" fill="${W}" opacity=".7"/>
    <path d="m17 20.5 3-2M19.5 23.5l3.2-2M22.5 26l3-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M10 28c6 1 14 1 20-2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity=".5"/>`),
  aksesuar: S(`<rect x="18" y="3.5" width="12" height="41" rx="3.5" fill="${W}" opacity=".55"/><circle cx="24" cy="24" r="12" fill="${W}"/><circle cx="24" cy="24" r="8.6" fill="currentColor"/>
    <rect x="35" y="21.8" width="3.4" height="4.4" rx="1.2" fill="${W}"/><path d="M24 18.5V24l3.6 2.6" fill="none" stroke="${W}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="24" cy="24" r="1.3" fill="${W}"/>`),
  kozmetik: S(`<rect x="15.5" y="6.5" width="10" height="6" rx="2" fill="${W}"/><rect x="17.8" y="12" width="5.4" height="5" fill="${W}" opacity=".7"/>
    <rect x="10.5" y="16.5" width="20" height="25" rx="5" fill="${W}"/><rect x="14.5" y="24" width="12" height="9" rx="2" fill="currentColor" opacity=".85"/>
    <rect x="32" y="27" width="7.5" height="14.5" rx="1.8" fill="${W}" opacity=".7"/><path d="M32.6 27V18.2l6.3-4.6V27z" fill="${W}"/>`),
  ev: S(`<rect x="10" y="14" width="28" height="12" rx="3.5" fill="${W}" opacity=".65"/><rect x="5.5" y="21" width="37" height="13" rx="4.5" fill="${W}"/>
    <path d="M24 23.5v8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".45"/><rect x="5.5" y="21" width="6" height="13" rx="3" fill="currentColor" opacity=".18"/><rect x="36.5" y="21" width="6" height="13" rx="3" fill="currentColor" opacity=".18"/>
    <rect x="9" y="34" width="3.4" height="5" rx="1.2" fill="${W}" opacity=".85"/><rect x="35.6" y="34" width="3.4" height="5" rx="1.2" fill="${W}" opacity=".85"/>`),
  kitap: S(`<path d="M24 12.5c-4.4-3.2-10.6-4.2-17.5-3.2v27c6.9-1 13.1 0 17.5 3.2z" fill="${W}"/><path d="M24 12.5c4.4-3.2 10.6-4.2 17.5-3.2v27c-6.9-1-13.1 0-17.5 3.2z" fill="${W}" opacity=".78"/>
    <path d="M24 12.5v27" stroke="currentColor" stroke-width="2" opacity=".5"/>
    <path d="M10.5 16.5c3.4-.4 6.6 0 9.5 1.4M10.5 21.5c3.4-.4 6.6 0 9.5 1.4M10.5 26.5c3.4-.4 6.6 0 9.5 1.4M28 17.9c2.9-1.4 6.1-1.8 9.5-1.4M28 22.9c2.9-1.4 6.1-1.8 9.5-1.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".35"/>`),
  oyun: S(`<path d="M14.5 14.5h19c6.2 0 10.2 6 11.3 14.2.8 6-2 9.3-5.2 9.3-3 0-5.2-3-7-6.2H15.4c-1.8 3.2-4 6.2-7 6.2-3.2 0-6-3.3-5.2-9.3C4.3 20.5 8.3 14.5 14.5 14.5z" fill="${W}"/>
    <path d="M15 20.5v8M11 24.5h8" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>
    <circle cx="32.5" cy="21.8" r="2.3" fill="currentColor"/><circle cx="37" cy="26.2" r="2.3" fill="currentColor" opacity=".6"/><circle cx="28" cy="26.2" r="2.3" fill="currentColor" opacity=".6"/>`),
  spor: S(`<circle cx="24" cy="24" r="17" fill="${W}"/><path d="M24.0 16.8L30.8 21.8L28.2 29.8L19.8 29.8L17.2 21.8z" fill="currentColor"/>
    <path d="M24.0 16.8L24.0 7.0M30.8 21.8L40.2 18.7M28.2 29.8L34.0 37.8M19.8 29.8L14.0 37.8M17.2 21.8L7.8 18.7" stroke="currentColor" stroke-width="1.8" opacity=".55"/><path d="M30.4 8.2L29.7 12.8L32.9 15.1L37.0 13.1A17 17 0 0 0 30.4 8.2z" fill="currentColor" opacity=".8"/><path d="M41.0 25.2L36.4 26.0L35.2 29.7L38.4 33.0A17 17 0 0 0 41.0 25.2z" fill="currentColor" opacity=".8"/><path d="M28.1 40.5L26.0 36.4L22.0 36.4L19.9 40.5A17 17 0 0 0 28.1 40.5z" fill="currentColor" opacity=".8"/><path d="M9.6 33.0L12.8 29.7L11.6 26.0L7.0 25.2A17 17 0 0 0 9.6 33.0z" fill="currentColor" opacity=".8"/><path d="M11.0 13.1L15.1 15.1L18.3 12.8L17.6 8.2A17 17 0 0 0 11.0 13.1z" fill="currentColor" opacity=".8"/>`),
  muzik: S(`<path d="M27.5 18.5 38 8l2.8 2.8L30.3 21.3z" fill="${W}" opacity=".85"/><rect x="37" y="4.5" width="7" height="7" rx="1.8" transform="rotate(45 40.5 8)" fill="${W}"/>
    <circle cx="25.5" cy="22.5" r="7.5" fill="${W}"/><circle cx="17" cy="31" r="10.5" fill="${W}"/>
    <circle cx="21" cy="27" r="3.2" fill="currentColor"/><rect x="11.5" y="33.2" width="7" height="2.6" rx="1.3" transform="rotate(-45 15 34.5)" fill="currentColor" opacity=".7"/>
    <path d="M13.5 36.5 39.5 10.5" stroke="currentColor" stroke-width=".9" opacity=".45"/>`),
  bebek: S(`<circle cx="14.5" cy="13" r="5.5" fill="${W}"/><circle cx="33.5" cy="13" r="5.5" fill="${W}"/><circle cx="14.5" cy="13" r="2.6" fill="currentColor" opacity=".35"/><circle cx="33.5" cy="13" r="2.6" fill="currentColor" opacity=".35"/>
    <ellipse cx="24" cy="40.5" rx="10.5" ry="5.5" fill="${W}" opacity=".7"/><circle cx="24" cy="23" r="12" fill="${W}"/>
    <ellipse cx="24" cy="27.5" rx="5.6" ry="4.2" fill="currentColor" opacity=".18"/><circle cx="19.6" cy="21" r="1.7" fill="currentColor"/><circle cx="28.4" cy="21" r="1.7" fill="currentColor"/>
    <path d="M22.3 25.6h3.4L24 27.4z" fill="currentColor"/>`),
  evcil: S(`<path d="M24 25c-6 0-11 5-11 9.6 0 3.6 2.8 5.4 6 5.4 2 0 3.4-1 5-1s3 1 5 1c3.2 0 6-1.8 6-5.4C35 30 30 25 24 25z" fill="${W}"/>
    <ellipse cx="12.2" cy="21" rx="3.8" ry="4.8" transform="rotate(-18 12.2 21)" fill="${W}"/><ellipse cx="19.2" cy="13.5" rx="3.8" ry="4.9" fill="${W}"/>
    <ellipse cx="28.8" cy="13.5" rx="3.8" ry="4.9" fill="${W}"/><ellipse cx="35.8" cy="21" rx="3.8" ry="4.8" transform="rotate(18 35.8 21)" fill="${W}"/>
    <path d="M24 37.2s-4.2-2.6-4.2-5.4a2.2 2.2 0 0 1 4.2-.9 2.2 2.2 0 0 1 4.2.9c0 2.8-4.2 5.4-4.2 5.4z" fill="currentColor" opacity=".55"/>`),
  koleksiyon: S(`<path d="M15.5 17c-4 1.5-5.5 4-4.6 6.8.7 2 2.7 3 4.6 2.6M32.5 17c4 1.5 5.5 4 4.6 6.8-.7 2-2.7 3-4.6 2.6" fill="none" stroke="${W}" stroke-width="2.6" stroke-linecap="round" opacity=".8"/>
    <path d="M18 6.5h12v3c0 2-2 2.8-2 4.6 0 2 7.5 5 7.5 13.4 0 7.4-4.6 13-11.5 13s-11.5-5.6-11.5-13c0-8.4 7.5-11.4 7.5-13.4 0-1.8-2-2.6-2-4.6z" fill="${W}"/>
    <path d="M13.5 25.5h21M13 30.5h22" stroke="currentColor" stroke-width="2" opacity=".55"/><path d="m17 28 2.4-2.5 2.4 2.5 2.2-2.5 2.4 2.5 2.4-2.5 2.2 2.5" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".45"/>`),
  diger: S(`<path d="M24 6.5 40.5 14 24 21.5 7.5 14z" fill="${W}"/><path d="M7.5 14 24 21.5v20L7.5 34z" fill="${W}" opacity=".82"/><path d="M40.5 14 24 21.5v20L40.5 34z" fill="${W}" opacity=".6"/>
    <path d="m15.8 10.2 16.5 7.5v6.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" opacity=".55"/>`),
};

// Kategori karosu: <span class="mk-ci" data-c="..."><svg/></span>
export const catIcon = (id, cls = '') => `<span class="mk-ci ${cls}" data-c="${id || 'tumu'}">${G[id] || G.diger}</span>`;
export const CAT_IDS = Object.keys(G);

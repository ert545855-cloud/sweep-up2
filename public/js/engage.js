// Etkileşim özellikleri için ortak parçalar: seri rozeti, "Emin misin?" denetimi,
// Instagram hikayesine uygun paylaşım kartı (fal, burç, uyum testi).
import { icon } from './icons.js';
import { api, esc, toast, state, sheet } from './core.js';

// 🔥 12 — sohbet listesi ve sohbet başlığı için
export const streakChip = (s, long = false) => (s?.count
  ? `<span class="streak-chip ${s.done ? '' : 'risk'}" title="${s.count} günlük seri${s.done ? '' : ' · bugün henüz ikiniz de yazmadınız'}">🔥 ${s.count}${long ? ' gün' : ''}${!s.done && s.risk ? ' ⏳' : ''}</span>`
  : '');

// Evet / hayır alt sayfası (Promise döner; dışarı dokunmak = hayır)
export function ask(title, text, { ok = 'Evet', cancel = 'Vazgeç', danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const fin = (v) => { if (!done) { done = true; resolve(v); } };
    sheet(title, `<div class="ask-b"><p>${esc(text)}</p><div class="ask-acts"><button class="btn ${danger ? 'danger' : 'primary'} block ask-ok">${esc(ok)}</button><button class="btn block ask-no">${esc(cancel)}</button></div></div>`, {
      onMount(sh, close) {
        sh.querySelector('.ask-ok').onclick = () => { fin(true); close(); };
        sh.querySelector('.ask-no').onclick = () => { fin(false); close(); };
        const root = document.getElementById('sheet-root');
        const mo = new MutationObserver(() => { if (!sh.isConnected) { mo.disconnect(); fin(false); } });
        mo.observe(root, { childList: true });
      },
    });
  });
}

// Göndermeden önce yapay zeka / kelime denetimi. true: gönder, false: vazgeç
export async function modCheck({ text, media }) {
  if (!text && !media) return true;
  let r = null;
  try { r = await Promise.race([api('/mod/check', { body: { text, media } }), new Promise((res) => setTimeout(() => res(null), media ? 9000 : 3500))]); } catch { r = null; }
  if (!r?.warn) return true;
  return ask('Emin misin? 🤔', r.kind === 'image'
    ? `Bu fotoğraf topluluk kurallarına uymayabilir (${r.reason}). Gönderirsen yönetim ekibi inceleyebilir.`
    : `Bu mesaj karşındakini kırabilir (${r.reason}). SwipeUp’ta herkesin kendini iyi hissetmesini istiyoruz.`, { ok: 'Yine de gönder', cancel: 'Düzenle', danger: true });
}

// ================= Paylaşım kartı (1080×1920) =================
const W = 1080; const H = 1920;
const THEMES = {
  fal: ['#ff7a59', '#ff3d8b', '#7c3aed', '#1c0b3a'],
  burc: ['#5b21b6', '#7c3aed', '#c026d3', '#170a33'],
  compat: ['#ff8a5c', '#ff3d8b', '#a24bff', '#260c3d'],
};
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function wrap(g, text, maxW) {
  const out = [];
  String(text || '').split(/\n+/).forEach((para) => {
    let line = '';
    para.split(/\s+/).filter(Boolean).forEach((w) => {
      const t = line ? `${line} ${w}` : w;
      if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    });
    if (line) out.push(line);
    out.push('');
  });
  while (out.length && !out[out.length - 1]) out.pop();
  return out;
}
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const loadImg = (src) => new Promise((res) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

export function inviteUrl() {
  const code = state.me?.refCode;
  return code ? `${location.origin}/?ref=${encodeURIComponent(code)}#/register` : location.origin;
}

export async function drawCard({ kind = 'fal', em = '🔮', title, subtitle = '', text, big = null, cta = 'Sen de fal baktır' }) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const [a, b, d, e] = THEMES[kind] || THEMES.fal;
  const bg = g.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0, a); bg.addColorStop(0.35, b); bg.addColorStop(0.7, d); bg.addColorStop(1, e);
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // yıldızlar
  let seed = [...(title + text)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 70; i++) { g.globalAlpha = 0.15 + rnd() * 0.5; g.fillStyle = '#fff'; g.beginPath(); g.arc(rnd() * W, rnd() * H, 1 + rnd() * 3.2, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  // yumuşak ışık
  const glow = g.createRadialGradient(W / 2, 520, 40, W / 2, 520, 520);
  glow.addColorStop(0, 'rgba(255,255,255,.28)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, 1100);
  // logo
  const logo = await loadImg('/icons/mark.png');
  g.textBaseline = 'middle';
  g.font = `800 52px ${FONT}`;
  const wm = 'swipeup'; const ww = g.measureText(wm).width; const lx = (W - (ww + 82)) / 2;
  if (logo) g.drawImage(logo, lx, 120, 64, 64);
  g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText(wm, lx + 82, 153);
  // simge
  g.textAlign = 'center';
  g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.arc(W / 2, 400, 150, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 4; g.stroke();
  if (big) { g.fillStyle = '#fff'; g.font = `900 120px ${FONT}`; g.fillText(big, W / 2, 405); } else { g.font = `150px ${FONT}`; g.fillText(em, W / 2, 410); }
  // başlık
  g.fillStyle = '#fff'; g.font = `800 66px ${FONT}`; g.fillText(title, W / 2, 640);
  if (subtitle) { g.font = `600 40px ${FONT}`; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText(subtitle, W / 2, 715); }
  // metin kutusu
  const bx = 80; const by = 790; const bw = W - 160; const bh = 760;
  rr(g, bx, by, bw, bh, 56); g.fillStyle = 'rgba(255,255,255,.13)'; g.fill();
  g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  let size = 50; let lines = []; let lh = 0;
  for (; size >= 30; size -= 2) {
    g.font = `500 ${size}px ${FONT}`; lh = size * 1.38;
    lines = wrap(g, text, bw - 110);
    if (lines.length * lh <= bh - 110) break;
  }
  const maxLines = Math.floor((bh - 110) / lh);
  if (lines.length > maxLines) { lines = lines.slice(0, maxLines); let l = lines[maxLines - 1]; while (g.measureText(`${l}…`).width > bw - 110 && l.length) l = l.slice(0, -1); lines[maxLines - 1] = `${l.trimEnd()}…`; }
  const ty = by + 55 + (bh - 110 - lines.length * lh) / 2 + size;
  lines.forEach((l, i) => g.fillText(l, bx + 55, ty + i * lh));
  // alt çağrı
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 46px ${FONT}`; g.fillStyle = '#fff'; g.fillText(`${cta} 👇`, W / 2, 1650);
  const host = location.host.replace(/^www\./, '');
  const link = state.me?.refCode ? `${host}/?ref=${state.me.refCode}` : host;
  g.font = `800 44px ${FONT}`; const pw = Math.min(W - 160, g.measureText(link).width + 120);
  rr(g, (W - pw) / 2, 1715, pw, 104, 52); g.fillStyle = '#fff'; g.fill();
  g.fillStyle = d; g.fillText(link, W / 2, 1768);
  g.font = `500 28px ${FONT}`; g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText('Eğlence amaçlıdır ✨', W / 2, 1870);
  return new Promise((res) => c.toBlob((blob) => res(blob), 'image/png'));
}

// Kartı oluştur, önizlet, paylaş / indir
export async function shareCard(opts, { file = 'swipeup-kart.png' } = {}) {
  toast('Kart hazırlanıyor…', { ms: 1200 });
  let blob;
  try { blob = await drawCard(opts); } catch (e) { toast('Kart oluşturulamadı.'); return; }
  if (!blob) { toast('Kart oluşturulamadı.'); return; }
  const f = new File([blob], file, { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  const link = inviteUrl();
  const canFiles = !!navigator.canShare?.({ files: [f] });
  sheet('Hikayende paylaş', `<div class="sc-pv"><img src="${url}" alt="Paylaşım kartı"></div>
    <p class="muted sc-tip">Instagram’da hikaye olarak paylaş. Kartın altındaki bağlantı seni getiren davet kodunu içerir; arkadaşın katılırsa ikiniz de jeton kazanırsınız.</p>
    <div class="sc-acts">
      ${canFiles ? `<button class="btn primary block sc-share">${icon('send')} Paylaş (Instagram, WhatsApp…)</button>` : ''}
      <a class="btn ${canFiles ? '' : 'primary'} block sc-dl" href="${url}" download="${esc(file)}">${icon('download')} Görseli indir</a>
      <button class="btn block sc-copy">${icon('copy')} Bağlantıyı kopyala</button>
    </div>`, {
    onMount(sh, close) {
      sh.querySelector('.sc-share')?.addEventListener('click', async () => {
        try { await navigator.share({ files: [f], title: 'SwipeUp', text: `${opts.cta || 'Sen de fal baktır'}: ${link}` }); close(); } catch (er) { if (er?.name !== 'AbortError') toast('Paylaşılamadı, görseli indirip paylaşabilirsin.'); }
      });
      sh.querySelector('.sc-copy').onclick = async () => { try { await navigator.clipboard.writeText(link); toast('Bağlantı kopyalandı. Hikayende bağlantı çıkartmasına yapıştır.'); } catch { prompt('Bağlantı', link); } };
      sh.querySelector('.sc-dl').addEventListener('click', () => setTimeout(() => toast('İndirildi. Instagram’da hikaye olarak paylaşabilirsin.'), 300));
    },
  });
}

// Fal metninden kart
export function shareFal(text, { type = 'fal', zodiac = null } = {}) {
  const T = { kahve: ['☕️', 'Kahve falım'], tarot: ['🔮', 'Tarot falım'], burc: ['✨', 'Burç yorumum'], uyum: ['💞', 'Aşk uyumum'], fal: ['🔮', 'Falcı Teyze’nin yorumu'] };
  const [em, title] = T[type] || T.fal;
  const day = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  return shareCard({ kind: 'fal', em, title, subtitle: `${zodiac ? `${zodiac} · ` : ''}Falcı Teyze · ${day}`, text, cta: 'Sen de fal baktır' }, { file: 'swipeup-fal.png' });
}

// Sohbet listesinde gizli değilse rozet gösterilir; serileri sayfası için bağlantı
export const streakLink = (n) => `<a class="streak-chip" href="#/seriler">🔥 ${n}</a>`;

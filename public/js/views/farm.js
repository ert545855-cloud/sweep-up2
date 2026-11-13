// SwipeFarm: izometrik çiftlik oyunu. Görseller hazır 3D çizimlerdir (public/img/farm, scripts/farm-art ile üretilir);
// sahne tek bir tuvale çizilir, bütün kurallar ve süreler sunucudadır (server/farm.js).
import { icon } from '../icons.js';
import { api, esc, state } from '../core.js';

const HW = 136 * Math.SQRT1_2; const HH = HW / 2; // bir karenin yarı genişliği / yüksekliği (görsel pikseli)
const STAR = '<svg class="sf-st" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.4 5.9 20.8l1.4-6.8L2.2 9.3l6.9-.8z" fill="#ffd23f" stroke="#c98a12" stroke-width="1.6" stroke-linejoin="round"/></svg>';
const SPOTS = { coop: [[0.1, 0.55], [0.6, 0.2], [0.55, 0.7], [-0.25, 0.75]], cowpen: [[0.35, 0.45], [-0.4, 0.6], [0.6, -0.2]], sheeppen: [[0.35, 0.45], [-0.4, 0.6], [0.6, -0.2]], goatpen: [[0.3, 0.5], [-0.4, 0.55], [0.6, -0.15]] };
const fmtD = (ms) => { const h = Math.floor(Math.max(0, ms) / 3600000); return h >= 24 ? `${Math.floor(h / 24)} gün ${h % 24} sa` : fmt(ms); };
const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); if (s < 60) return `${s} sn`; const m = Math.floor(s / 60); if (m < 60) return `${m} dk${s % 60 && m < 10 ? ` ${s % 60} sn` : ''}`; const h = Math.floor(m / 60); return `${h} sa${m % 60 ? ` ${m % 60} dk` : ''}`; };
const rnd = (i, s) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };

// ---- sesler: dosya yok, kısa tonlar tarayıcıda üretilir ----
let AC = null; let muted = false; try { muted = localStorage.getItem('sf_mute') === '1'; } catch { /* yok say */ }
function tone(f0, f1, dur, type = 'sine', vol = 0.16, delay = 0) {
  if (muted) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume();
    const t = AC.currentTime + delay; const o = AC.createOscillator(); const gn = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + 0.012); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn).connect(AC.destination); o.start(t); o.stop(t + dur + 0.03);
  } catch { /* ses açılamadıysa sessiz devam */ }
}
const SFX = {
  pop: (n = 1) => { const k = Math.min(n, 10); tone(480 + k * 45, 760 + k * 60, 0.09, 'triangle', 0.18); },
  plant: () => tone(230, 140, 0.11, 'sine', 0.22), tap: () => tone(420, 310, 0.05, 'sine', 0.1), take: () => tone(620, 990, 0.13, 'triangle', 0.16),
  coin: () => { tone(1320, 1320, 0.07, 'square', 0.05); tone(1760, 1760, 0.17, 'square', 0.05, 0.07); },
  water: () => tone(950, 380, 0.16, 'sine', 0.15), err: () => tone(190, 140, 0.15, 'sawtooth', 0.05),
  level: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.24, 'triangle', 0.16, i * 0.11)),
};

let ART = null; let A = null;
const AV = '?v=3'; // görsel paketi sürümü: atlas ile resimler tarayıcı önbelleğinde birbirinden kopmasın
function loadArt(onp) {
  if (ART) return ART;
  let n = 0; const step = () => onp?.(++n / 4);
  const img = (name) => new Promise((res, rej) => { const i = new Image(); i.onload = () => { step(); res(i); }; i.onerror = () => rej(new Error('Oyun görselleri yüklenemedi. Bağlantını kontrol et.')); i.src = `/img/farm/${name}.webp${AV}`; });
  ART = Promise.all([fetch(`/img/farm/atlas.json${AV}`).then((r) => r.json()).then((j) => { step(); return j; }), img('obj'), img('item'), img('grass')])
    .then(([atlas, obj, item, grass]) => ({ atlas, obj, item, grass })).catch((e) => { ART = null; throw e; });
  return ART;
}
function useCss() { if (document.getElementById('sf-css')) return; const l = document.createElement('link'); l.id = 'sf-css'; l.rel = 'stylesheet'; l.href = `/css/farm.css${AV}`; document.head.append(l); }
// atlastaki bir görseli DOM'da göster
const spr = (k, size = 40) => { const a = A.atlas[k]; if (!a) return ''; const im = A[a[0]]; const s = size / Math.max(a[3], a[4]); const r = (v) => Math.round(v * 10) / 10;
  return `<i class="sf-sp" style="width:${r(a[3] * s)}px;height:${r(a[4] * s)}px;background:url(/img/farm/${a[0]}.webp${AV}) ${r(-a[1] * s)}px ${r(-a[2] * s)}px/${r(im.width * s)}px ${r(im.height * s)}px"></i>`; };

export default async function farm(view, who) {
  useCss();
  view.innerHTML = `<div class="sf"><div class="sf-load"><img src="/img/farm/hero.webp" alt=""><h1>SwipeFarm</h1><div class="sf-lb"><i></i></div><p>Çiftlik hazırlanıyor…</p></div></div>`;
  const root = view.querySelector('.sf');
  // yatay oyun: telefon dik tutuluyorsa sahne 90° döndürülür; telefon yan çevrilince (ekran yataysa) döndürme kalkar
  const coarse = window.matchMedia('(pointer: coarse)').matches; let rot = false;
  const fit = () => { const vw = window.innerWidth; const vh = window.innerHeight; rot = coarse && vh > vw; root.classList.toggle('rot', rot); root.style.cssText = rot ? `width:${vh}px;height:${vw}px;left:${vw}px` : ''; };
  fit(); window.addEventListener('resize', fit);
  try { window.screen.orientation?.lock?.('landscape')?.catch?.(() => {}); } catch { /* kilitlenemiyorsa döndürme yeter */ }
  const unfit = () => { window.removeEventListener('resize', fit); try { window.screen.orientation?.unlock?.(); } catch { /* yok say */ } };
  let toastT = 0; // oyun döndürülmüş olabildiği için bildirim de sahnenin içinde gösterilir
  const toast = (m) => { const t = root.querySelector('.sf-toast'); if (!t) return; t.textContent = m; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2800); };
  let data;
  try {
    [A, data] = await Promise.all([loadArt((p) => { const b = root.querySelector('.sf-lb i'); if (b) b.style.width = `${Math.round(p * 100)}%`; }), api(who ? `/farm/of/${encodeURIComponent(who)}` : '/farm')]);
  } catch (e) {
    root.innerHTML = `<div class="sf-load"><img src="/img/farm/hero.webp" alt=""><h1>SwipeFarm</h1><p>${esc(e.message)}</p><a class="sf-btn" href="#/${who ? 'farm' : 'oyunlar'}">Geri dön</a></div>`;
    return unfit;
  }
  if (!root.isConnected) { unfit(); return null; }
  const cfg = data.cfg; let N = data.farm.n || cfg.N; const visit = who ? data.user : null;
  let F = data.farm; let skew = (F.now || Date.now()) - Date.now();
  const tnow = () => Date.now() + skew;
  const inv = () => (visit ? F.myInv : F.inv) || {};
  const rushCost = (ms) => Math.min(cfg.RUSH_MAX, Math.max(1, Math.ceil(ms / (cfg.RUSH_MIN * 60000))));
  const invN = () => Object.values(inv()).reduce((a, b) => a + b, 0);
  const hasAll = (items) => Object.entries(items).every(([k, n]) => (inv()[k] || 0) >= n);
  const cropReady = (o, now) => !!o.crop && now - o.at >= cfg.CROPS[o.crop].t;

  root.innerHTML = `<canvas class="sf-cv"></canvas>
    <div class="sf-top"><button class="sf-rb" data-a="back" aria-label="Geri">${icon('back')}</button>
      ${visit ? `<div class="sf-who"><img src="${esc(visit.avatar)}" alt=""><span><b>${esc(visit.name || visit.username)}</b><small>Seviye ${F.lvl} çiftlik</small></span></div><span class="sf-grow"></span><div class="sf-pill"><i class="sf-dropi"></i><b class="sf-helps"></b></div><div class="sf-pill sf-coin">${spr('i_coin', 24)}<b></b></div><button class="sf-rb sf-sndb" data-a="snd" aria-label="Ses">${icon(muted ? 'mute' : 'volume')}</button>`
    : `<div class="sf-lv"><span class="sf-star">${STAR}<b class="sf-lvn"></b></span><div class="sf-xp"><i></i><small></small></div></div><span class="sf-grow"></span>
      <button class="sf-pill sf-jet" data-a="jet">${spr('i_jeton', 24)}<b></b></button><div class="sf-pill sf-coin">${spr('i_coin', 24)}<b></b></div><button class="sf-pill sf-barnp" data-a="barn">${spr('barn', 28)}<b></b></button><button class="sf-rb" data-a="set" aria-label="Ayarlar">${icon('settings')}</button>`}</div>
    ${visit ? `<div class="sf-side">
      <button data-a="vgift">${spr('i_gift', 32)}<small>Hediye</small></button>
      <button data-a="vstall">${spr('i_stall', 34)}<small>Tezgâh</small><em class="sf-badge" data-b="vstall" hidden></em></button>
      <button data-a="vcoop" class="sf-vcoop">${spr('i_crate', 32)}<small>Ortak</small></button></div>`
    : `<div class="sf-side sf-sideL">
      <button data-a="daily">${spr('i_gift', 32)}<small>Ödül</small><em class="sf-badge" data-b="daily" hidden>!</em></button>
      <button data-a="rank">${spr('trophy', 34)}<small>Sıralama</small></button>
      <button data-a="coop">${spr('i_crate', 32)}<small>Ortak</small><em class="sf-badge" data-b="coop" hidden>!</em></button>
      <button data-a="stall">${spr('i_stall', 34)}<small>Tezgâh</small></button></div>
    <div class="sf-side">
      <button data-a="orders">${spr('board', 34)}<small>Sipariş</small><em class="sf-badge" data-b="orders" hidden></em></button>
      <button data-a="shop">${spr('bakery', 36)}<small>Market</small></button>
      <button data-a="nb">${spr('house', 36)}<small>Komşular</small></button>
      <button data-a="edit">${icon('edit')}<small>Düzenle</small></button></div>`}
    <div class="sf-bot"></div><div class="sf-layer"></div><div class="sf-over"></div><div class="sf-toast" role="status"></div>`;
  const cv = root.querySelector('.sf-cv'); const g = cv.getContext('2d');
  const bot = root.querySelector('.sf-bot'); const layer = root.querySelector('.sf-layer'); const over = root.querySelector('.sf-over');

  // ---------- kamera ----------
  let W = 0; let H = 0; let dpr = 1; let T = 0;
  const cam = { x: (8 - 7.5) * HW, y: (8 + 7.5) * HH, z: 0.3 };
  const toScr = (gx, gy) => [W / 2 + ((gx - gy) * HW - cam.x) * cam.z, H / 2 + ((gx + gy) * HH - cam.y) * cam.z];
  const toGrid = (sx, sy) => { const wx = (sx - W / 2) / cam.z + cam.x; const wy = (sy - H / 2) / cam.z + cam.y; return [(wx / HW + wy / HH) / 2, (wy / HH - wx / HW) / 2]; };
  const clampCam = () => {
    cam.z = Math.min(0.8, Math.max(Math.max(0.15, W / (N * 2 * HW * 1.25)), cam.z));
    let gx = (cam.x / HW + cam.y / HH) / 2; let gy = (cam.y / HH - cam.x / HW) / 2;
    gx = Math.min(N + 1, Math.max(-1, gx)); gy = Math.min(N + 1, Math.max(-1, gy));
    cam.x = (gx - gy) * HW; cam.y = (gx + gy) * HH;
  };
  let first = true;
  const resize = () => {
    W = root.clientWidth; H = root.clientHeight; dpr = Math.min(2, window.devicePixelRatio || 1); root.classList.toggle('land', W > H);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    if (first && W) { // ilk açılış: tarlalar ve binalar ortada, yan düğmelere yer bırak
      first = false; cam.z = Math.min(0.5, Math.max(0.26, Math.min(W / (6.8 * 2 * HW), H / (10.5 * 2 * HH))));
      const core = F.objs.filter((o) => cfg.TYPES[o.t].kind !== 'decor'); let gx = 0; let gy = 0;
      core.forEach((o) => { gx += o.x + cfg.TYPES[o.t].w / 2; gy += o.y + cfg.TYPES[o.t].h / 2; }); gx /= core.length || 1; gy /= core.length || 1;
      cam.x = (gx - gy) * HW; cam.y = (gx + gy) * HH - 14 / cam.z;
    }
    clampCam();
  };
  const ro = new ResizeObserver(resize); ro.observe(root); resize();

  // ---------- sahne ----------
  let ring = []; // çiftliğin çevresi: çit ve ağaçlar (süs). Arazi büyüyünce yeniden kurulur.
  function buildRing() { ring = []; let i = 0;
    for (let x = -7; x < N + 7; x++) for (let y = -7; y < N + 7; y++) { i++;
      if (x >= -1 && x <= N && y >= -1 && y <= N) continue;
      const r = rnd(i, 1); if (r > 0.36) continue;
      ring.push({ k: r < 0.13 ? 'tree' : r < 0.21 ? 'pine' : r < 0.27 ? 'bush' : r < 0.32 ? 'flowers' : 'rock', gx: x + 0.5, gy: y + 0.5 }); }
    for (let a = 0; a < N; a++) { ring.push({ k: 'fence_x', gx: a + 0.5, gy: -0.5 }, { k: 'fence_z', gx: -0.5, gy: a + 0.5 });
      if (a < 7 || a > 9) ring.push({ k: 'fence_x', gx: a + 0.5, gy: N + 0.5 }); ring.push({ k: 'fence_z', gx: N + 0.5, gy: a + 0.5 }); } }
  buildRing();
  // çiftçi: boş yerlerde kendi kendine dolaşır
  const home = F.objs.find((o) => o.t === 'house');
  const man = { x: home ? home.x + 1.5 : 8, y: home ? home.y + 2.6 : 8, tx: 0, ty: 0, wait: 900, go: false };
  const blocked = (gx, gy) => gx < 0.25 || gy < 0.25 || gx > N - 0.25 || gy > N - 0.25 || F.objs.some((o) => { const Ty = cfg.TYPES[o.t]; return gx > o.x - 0.22 && gx < o.x + Ty.w + 0.22 && gy > o.y - 0.22 && gy < o.y + Ty.h + 0.22; });
  const clear = (ax, ay, bx, by) => { const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 3); for (let i = 1; i <= n; i++) if (blocked(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n)) return false; return true; };
  function stepMan(dt) {
    if (man.go) { const dx = man.tx - man.x; const dy = man.ty - man.y; const d = Math.hypot(dx, dy); const st = dt * 0.0011;
      if (d <= st) { man.x = man.tx; man.y = man.ty; man.go = false; man.wait = 900 + Math.random() * 2600; } else { man.x += (dx / d) * st; man.y += (dy / d) * st; } return; }
    man.wait -= dt; if (man.wait > 0) return; const stuck = blocked(man.x, man.y);
    for (let i = 0; i < 10; i++) { const a = Math.random() * 6.283; const r = 1.5 + Math.random() * 5; const tx = man.x + Math.cos(a) * r; const ty = man.y + Math.sin(a) * r; if (!blocked(tx, ty) && (stuck || clear(man.x, man.y, tx, ty))) { man.tx = tx; man.ty = ty; man.go = true; return; } }
    man.wait = 1200;
  }
  // gün döngüsü ve mevsim: cihazın saatine ve aya göre. Ayarlardan kapatılabilir.
  let ambOn = true; try { ambOn = localStorage.getItem('sf_amb') !== '0'; } catch { /* yok say */ }
  let amb = { night: 0, warm: 0, season: '' }; let lights = [];
  const ramp = (h, a, b) => Math.min(1, Math.max(0, (h - a) / (b - a)));
  function calcAmb() {
    if (!ambOn) { amb = { night: 0, warm: 0, season: '' }; return; }
    const d = new Date(); const h = d.getHours() + d.getMinutes() / 60; const m = d.getMonth();
    amb = { night: h >= 12 ? ramp(h, 19, 21.5) : 1 - ramp(h, 5, 7), warm: h >= 12 ? ramp(h, 16.5, 19) * (1 - ramp(h, 19.5, 21.5)) : ramp(h, 5, 6.5) * (1 - ramp(h, 6.5, 8.5)), season: m === 11 || m < 2 ? 'winter' : m < 5 ? 'spring' : m < 8 ? '' : 'autumn' };
  }
  calcAmb();
  let mode = null; // null | {k:'plant',crop} | {k:'place',t,id,x,y} | {k:'edit'}
  const pops = new Map(); const pendH = new Set(); const pendP = new Map(); let fxs = []; let info = null; let bubbles = [];
  const pat = g.createPattern(A.grass, 'repeat');
  const free = (t, x, y, skip) => { const Ty = cfg.TYPES[t]; if (x < 0 || y < 0 || x + Ty.w > N || y + Ty.h > N) return false;
    return !F.objs.some((o) => o.id !== skip && x < o.x + cfg.TYPES[o.t].w && o.x < x + Ty.w && y < o.y + cfg.TYPES[o.t].h && o.y < y + Ty.h); };

  function sp(k, sx, sy, kx = 1, ky = kx, alpha = 1) {
    const a = A.atlas[k]; if (!a) return; const z = cam.z;
    if (alpha !== 1) g.globalAlpha = alpha;
    g.drawImage(A[a[0]], a[1], a[2], a[3], a[4], sx - a[5] * z * kx, sy - a[6] * z * ky, a[3] * z * kx, a[4] * z * ky);
    if (alpha !== 1) g.globalAlpha = 1;
  }
  function ico(k, x, y, s, alpha = 1) { const a = A.atlas[k]; if (!a) return; const f = s / Math.max(a[3], a[4]); g.globalAlpha = alpha; g.drawImage(A[a[0]], a[1], a[2], a[3], a[4], x - (a[3] * f) / 2, y - (a[4] * f) / 2, a[3] * f, a[4] * f); g.globalAlpha = 1; }
  function drop(x, y, r) { g.save(); g.fillStyle = '#3aa8ee'; g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y - r * 1.5); g.bezierCurveTo(x + r * 1.3, y, x + r, y + r, x, y + r); g.bezierCurveTo(x - r, y + r, x - r * 1.3, y, x, y - r * 1.5); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(x - r * 0.3, y + r * 0.2, r * 0.22, 0, 7); g.fill(); g.restore(); }
  function star(x, y, r) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.46 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fillStyle = '#ffd23f'; g.strokeStyle = '#b97a0c'; g.lineWidth = 1.5; g.lineJoin = 'round'; g.stroke(); g.fill(); }
  function label(txt, x, y, size = 13, fill = '#fff') { g.font = `800 ${size}px "Bricolage Grotesque", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.strokeStyle = 'rgba(58,34,12,.9)'; g.lineWidth = size * 0.3; g.strokeText(txt, x, y); g.fillStyle = fill; g.fillText(txt, x, y); }
  function bubble(sx, sy, k, o = {}) {
    const s = 32 * Math.min(1.3, Math.max(0.85, cam.z / 0.3)); const y = sy - s * 0.95 + (o.still ? 0 : Math.sin(T / 260 + sx * 0.05) * 3); const r = s * 0.62;
    g.save(); g.shadowColor = 'rgba(40,25,10,.35)'; g.shadowBlur = 8; g.shadowOffsetY = 3; g.fillStyle = o.bg || '#fffdf3';
    g.beginPath(); g.arc(sx, y, r, 0, 7); g.fill(); g.beginPath(); g.moveTo(sx - s * 0.2, y + s * 0.5); g.lineTo(sx, y + s * 0.9); g.lineTo(sx + s * 0.2, y + s * 0.5); g.fill(); g.restore();
    if (o.p != null) { g.lineWidth = 3.5; g.lineCap = 'round'; g.strokeStyle = '#eadfc6'; g.beginPath(); g.arc(sx, y, r - 2.5, 0, 7); g.stroke(); g.strokeStyle = '#62b63f'; g.beginPath(); g.arc(sx, y, r - 2.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, Math.max(0.02, o.p))); g.stroke(); }
    if (k === 'drop') drop(sx, y, s * 0.26); else if (o.text) label(o.text, sx, y + 1, s * 0.5, '#fff'); else ico(k, sx, y, s * 0.8, o.dim ? 0.5 : 1);
  }
  function diamond(x0, y0, x1, y1) { g.beginPath(); [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].forEach(([a, b], i) => { const [sx, sy] = toScr(a, b); if (i) g.lineTo(sx, sy); else g.moveTo(sx, sy); }); g.closePath(); }

  function drawObj(o, now) {
    if (mode?.k === 'place' && mode.id === o.id) return;
    const Ty = cfg.TYPES[o.t]; const cx = o.x + Ty.w / 2; const cy = o.y + Ty.h / 2; const [sx, sy] = toScr(cx, cy); const z = cam.z;
    if (sx < -260 || sx > W + 260 || sy < -140 || sy > H + 420 * z + 60) return;
    let k = 1; const pop = pops.get(o.id);
    if (pop != null) { const p = (T - pop) / 340; if (p >= 1) pops.delete(o.id); else k = 1 + 0.17 * Math.sin(p * Math.PI) * (1 - p * 0.4); }
    if (Ty.kind === 'plot') {
      const crop = pendH.has(o.id) ? null : pendP.get(o.id) || o.crop; let key = 'plot'; let ready = false;
      if (crop) { const p = pendP.has(o.id) ? 0 : (now - o.at) / cfg.CROPS[crop].t; ready = p >= 1; key = ready ? `${crop}_3` : p >= 0.4 ? `${crop}_2` : 'sprout'; }
      sp(key, sx, sy, k, k * (ready ? 1 + Math.sin(T / 420 + o.x * 1.7 + o.y) * 0.03 : 1));
      if (crop && !ready && o.h) drop(sx + 62 * z, sy - 34 * z, 4 + 4 * z);
      if (visit && crop && !ready && !o.h && F.helpsLeft > 0) bubbles.push([sx, sy - 46 * z, 'drop', {}]);
      if (info && info.id === o.id && crop && !ready) bubbles.push([sx, sy - 60 * z, null, { info: `${cfg.CROPS[crop].name} · ${fmt(cfg.CROPS[crop].t - (now - o.at))}` }]);
      return;
    }
    sp(o.t, sx, sy, k);
    const a = A.atlas[o.t]; const top = sy - a[6] * z * 0.94;
    if (amb.night > 0.01) { if (o.t === 'lantern') lights.push([sx, sy - 92 * z, 170 * z]); else if (o.t === 'house' || Ty.kind === 'build') lights.push([sx + 10 * z, sy - 46 * z, 150 * z]); }
    const PR = cfg.PROD[o.t]; // elma ağacı, arı kovanı: süresi dolunca ürün balonu
    if (PR) { const left = PR.t - (now - (o.at || 0)); if (left <= 0) { if (!visit) bubbles.push([sx, top, `i_${PR.out}`, {}]); } else if (info && info.id === o.id) bubbles.push([sx, top + 12, null, { info: `${cfg.ITEMS[PR.out][0]} · ${fmt(left)}` }]); }
    if (o.t === 'mill') sp(`rotor_${(F.q?.mill || []).some((q) => q.end > now) ? Math.floor(T / 90) % 6 : 0}`, sx, sy, k);
    if (Ty.kind === 'pen') {
      const P = cfg.PENS[o.t]; const list = F.pens?.[o.t] || []; let ready = 0; let hungry = 0;
      list.forEach((an, i) => { const [dx, dy] = SPOTS[o.t][i] || [0, 0]; const [ax, ay] = toScr(cx + dx + Math.sin(T / 2300 + i * 2.1 + o.x) * 0.13, cy + dy + Math.cos(T / 2900 + i * 1.3) * 0.11); const fed = an.at && now - an.at < P.t;
        if (!an.at) hungry++; else if (!fed) ready++;
        sp(P.animal, ax, ay - (fed ? Math.abs(Math.sin(T / 300 + i * 2)) * 10 * z : 0)); });
      if (ready) bubbles.push([sx, top, `i_${P.out}`, {}]); else if (hungry && !visit) bubbles.push([sx, top, `i_${P.feed}`, { dim: !(inv()[P.feed] > 0) }]);
    }
    if (Ty.kind === 'build' && !visit) { const q = F.q?.[o.t] || []; if (q.length) { const r = cfg.RECIPES[o.t][q[0].r]; const left = q[0].end - now; bubbles.push([sx, top, `i_${q[0].r}`, left <= 0 ? {} : { dim: true, p: 1 - left / r.t, still: true }]); } }
    if (o.t === 'board' && !visit) { const n = F.orders.filter((x) => !x.wait && hasAll(x.need)).length; if (n) bubbles.push([sx, top, null, { text: String(n), bg: '#62b63f' }]); }
  }

  let raf = 0; let last = 0;
  function frame(ts) {
    raf = requestAnimationFrame(frame); if (ts - last < 30 || !W) return; stepMan(Math.min(120, ts - last)); last = ts; T = ts; const now = tnow(); const z = cam.z;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingQuality = 'high';
    const [ox, oy] = toScr(0, 0); const c = (6 / 512) * z;
    pat.setTransform(new DOMMatrix([HW * c, HH * c, -HW * c, HH * c, ox, oy])); g.fillStyle = pat; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(16,64,30,.2)'; g.beginPath(); g.rect(0, 0, W, H); { const P = [[-1, -1], [-1, N + 1], [N + 1, N + 1], [N + 1, -1]]; P.forEach(([a, b], i) => { const [sx, sy] = toScr(a, b); if (i) g.lineTo(sx, sy); else g.moveTo(sx, sy); }); g.closePath(); } g.fill('evenodd');
    if (amb.season === 'winter') { g.fillStyle = 'rgba(238,246,255,.34)'; g.fillRect(0, 0, W, H); } else if (amb.season === 'autumn') { g.fillStyle = 'rgba(204,132,36,.14)'; g.fillRect(0, 0, W, H); }
    diamond(0, 0, N, N); g.fillStyle = 'rgba(255,248,190,.07)'; g.fill();
    if (mode?.k === 'place' || mode?.k === 'edit') { g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 1; g.beginPath(); for (let i = 0; i <= N; i++) { let [a, b] = toScr(i, 0); g.moveTo(a, b); [a, b] = toScr(i, N); g.lineTo(a, b); [a, b] = toScr(0, i); g.moveTo(a, b); [a, b] = toScr(N, i); g.lineTo(a, b); } g.stroke(); }
    bubbles = []; lights = [];
    const list = [[man.x + man.y, 'man', null]];
    for (const r of ring) list.push([r.gx + r.gy, r, null]);
    for (const o of F.objs) { const Ty = cfg.TYPES[o.t]; list.push([o.x + o.y + (Ty.w + Ty.h) / 2, null, o]); }
    list.sort((p, q) => p[0] - q[0]);
    for (const [, r, o] of list) { if (o) drawObj(o, now); else if (r === 'man') { const [sx, sy] = toScr(man.x, man.y); sp('farmer', sx, sy - (man.go ? Math.abs(Math.sin(T / 110)) * 5 * z : 0)); } else { const [sx, sy] = toScr(r.gx, r.gy); if (sx > -200 && sx < W + 200 && sy > -80 && sy < H + 200) sp(r.k, sx, sy); } }
    if (mode?.k === 'place') { // yerleştirilen şey: yeşil/kırmızı zemin + yarı saydam görsel
      const Ty = cfg.TYPES[mode.t]; const ok = free(mode.t, mode.x, mode.y, mode.id); mode.ok = ok;
      diamond(mode.x, mode.y, mode.x + Ty.w, mode.y + Ty.h); g.fillStyle = ok ? 'rgba(98,200,70,.55)' : 'rgba(230,60,50,.55)'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
      const [sx, sy] = toScr(mode.x + Ty.w / 2, mode.y + Ty.h / 2); sp(mode.t, sx, sy - 6 * z, 1, 1, 0.9);
    }
    if (amb.warm > 0.01) { g.fillStyle = `rgba(255,128,48,${0.13 * amb.warm})`; g.fillRect(0, 0, W, H); }
    if (amb.night > 0.01) { g.fillStyle = `rgba(14,24,70,${0.46 * amb.night})`; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'lighter';
      for (const [lx, ly, lr] of lights) { const gr = g.createRadialGradient(lx, ly, 0, lx, ly, lr); gr.addColorStop(0, `rgba(255,190,90,${0.5 * amb.night})`); gr.addColorStop(1, 'rgba(255,190,90,0)'); g.fillStyle = gr; g.fillRect(lx - lr, ly - lr, lr * 2, lr * 2); }
      g.globalCompositeOperation = 'source-over'; }
    if (amb.season) { const win = amb.season === 'winter'; const n = win ? 46 : 16; // kar, yaprak ya da çiçek yaprağı
      for (let i = 0; i < n; i++) { const v = 0.5 + rnd(i, 3); const x = (((rnd(i, 1) * W + T * 0.012 * v + Math.sin(T / 900 + i) * 14) % W) + W) % W; const y = (rnd(i, 2) * H + T * (win ? 0.035 : 0.05) * v) % H;
        if (win) { g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(x, y, 1.4 + rnd(i, 4) * 1.8, 0, 7); g.fill(); } else { g.save(); g.translate(x, y); g.rotate(T / 500 + i); g.fillStyle = amb.season === 'spring' ? 'rgba(255,170,200,.9)' : ['#e8892b', '#d4572a', '#e9b23a'][i % 3]; g.beginPath(); g.ellipse(0, 0, 5, 2.6, 0, 0, 7); g.fill(); g.restore(); } } }
    for (const [sx, sy, k, o] of bubbles) {
      if (o.info) { g.font = '800 12px "Bricolage Grotesque", system-ui, sans-serif'; const w = g.measureText(o.info).width + 18; g.fillStyle = 'rgba(58,34,12,.88)'; g.beginPath(); g.arc(sx - w / 2 + 12, sy - 12, 12, Math.PI / 2, Math.PI * 1.5); g.arc(sx + w / 2 - 12, sy - 12, 12, -Math.PI / 2, Math.PI / 2); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(o.info, sx, sy - 11.5); } else bubble(sx, sy, k, o);
    }
    if (info && T > info.until) info = null;
    fxs = fxs.filter((f) => T - f.t0 < 1200);
    for (const f of fxs) { const p = (T - f.t0) / 1200; if (p < 0) continue; const [sx, sy0] = toScr(f.gx, f.gy); const e = 1 - (1 - p) ** 3; const sy = sy0 - 34 * z - 20 - 52 * e; g.globalAlpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
      const sc = p < 0.15 ? 0.6 + (p / 0.15) * 0.5 : 1.1 - Math.min(0.1, (p - 0.15) * 0.5); const fs = 17 * sc; label(`+${f.n}`, sx - 12, sy, fs, f.k === 'xp' ? '#ffe98a' : '#fff');
      const a0 = g.globalAlpha; if (f.k === 'xp') star(sx + 14, sy - 1, 9 * sc); else { ico(f.k, sx + 16, sy - 1, 24 * sc, a0); g.globalAlpha = a0; } g.globalAlpha = 1; }
  }
  raf = requestAnimationFrame(frame);

  // ---------- sunucu ----------
  let chain = Promise.resolve(); let lastPos = [8, 8];
  const centerOf = (id) => { const o = F.objs.find((x) => x.id === id); if (!o) return null; const Ty = cfg.TYPES[o.t]; return [o.x + Ty.w / 2, o.y + Ty.h / 2]; };
  function apply(r) {
    if (r.farm) { F = r.farm; if (F.now) skew = F.now - Date.now(); if ((F.n || cfg.N) !== N) { N = F.n || cfg.N; buildRing(); clampCam(); } }
    let i = 0;
    for (const f of r.fx || []) {
      if (f.t === 'item') { const c = centerOf(f.at); if (c) lastPos = c; fxs.push({ gx: lastPos[0], gy: lastPos[1], k: `i_${f.k}`, n: f.n, t0: T + i++ * 90 }); }
      if (f.t === 'xp') fxs.push({ gx: lastPos[0] + 0.35, gy: lastPos[1] - 0.35, k: 'xp', n: f.n, t0: T + 160 + i++ * 90 });
      if (f.t === 'coins') { const b = F.objs.find((x) => x.t === 'board'); const c = visit || !b ? lastPos : [b.x + 0.5, b.y + 0.5]; fxs.push({ gx: c[0], gy: c[1], k: 'i_coin', n: f.n, t0: T + i++ * 90 }); SFX.coin(); root.querySelector('.sf-coin')?.classList.add('bump'); setTimeout(() => root.querySelector('.sf-coin')?.classList.remove('bump'), 500); }
      if (f.t === 'lvl') { levelUp(f); SFX.level(); }
      if (f.t === 'decor') { gotDecor(f.k); SFX.level(); }
    }
    hud(); panel?.paint(); paintBot();
  }
  const act = (a, body = {}) => (chain = chain.then(async () => {
    try {
      const r = await api('/farm/act', { body: { a, ...body } }); apply(r);
      if (a === 'take' || a === 'collect' || a === 'pick') SFX.take(); else if (a === 'buy' || a === 'move' || a === 'feed' || a === 'craft' || a === 'animal') SFX.plant();
      return r;
    } catch (e) { if (e.data?.farm) apply({ farm: e.data.farm }); SFX.err(); toast(e.message); return null; }
  }));
  const vcall = (path, body, after) => (chain = chain.then(() => api(`/farm/of/${visit.id}/${path}`, { body }).then((r) => { apply(r); after?.(r); }).catch((e) => { SFX.err(); toast(e.message); })));
  const reload = async () => { if (visit) return; try { const r = await api('/farm'); apply({ farm: r.farm }); } catch { /* sonraki denemede */ } };

  // ---------- üst bilgi ----------
  const badge = (k, v) => { const b = root.querySelector(`[data-b="${k}"]`); if (!b) return; b.hidden = !v; if (typeof v === 'number') b.textContent = v; };
  function hud() {
    if (visit) { root.querySelector('.sf-helps').textContent = `${F.helpsLeft}/${cfg.HELPS}`; root.querySelector('.sf-coin b').textContent = (F.myCoins || 0).toLocaleString('tr-TR'); badge('vstall', (F.stall || []).length); root.querySelector('.sf-vcoop').hidden = !F.canCoop; return; }
    root.querySelector('.sf-lvn').textContent = F.lvl; root.querySelector('.sf-xp i').style.width = `${Math.min(100, (F.xp / F.need) * 100)}%`; root.querySelector('.sf-xp small').textContent = `${F.xp}/${F.need}`;
    root.querySelector('.sf-coin b').textContent = F.coins.toLocaleString('tr-TR'); root.querySelector('.sf-jet b').textContent = (F.jeton || 0).toLocaleString('tr-TR');
    const n = invN(); const bp = root.querySelector('.sf-barnp'); bp.querySelector('b').textContent = `${n}/${F.cap}`; bp.classList.toggle('full', n >= F.cap - 1);
    badge('orders', F.orders.filter((x) => !x.wait && hasAll(x.need)).length); badge('daily', !!F.daily?.can);
    badge('coop', !!F.coop && Object.entries(F.coop.need).some(([k, v]) => (F.coop.got[k] || 0) < v && inv()[k] > 0));
  }
  function hintText() {
    if (visit) return F.helpsLeft > 0 ? 'Büyüyen ekinlere dokunup sula. Sen de altın ve deneyim kazanırsın.' : 'Bugünlük yardım hakkın bitti. Yarın yine uğra.';
    if (F.lvl > 3) return ''; const now = tnow(); const plots = F.objs.filter((o) => o.t === 'plot');
    if (plots.some((o) => cropReady(o, now))) return 'Olgun ekinlerin üzerinde parmağını kaydır, hasat et.';
    if (plots.some((o) => !o.crop)) return 'Boş tarlaya dokun, ekin seç ve kaydırarak ek.';
    if (F.orders.some((o) => !o.wait && hasAll(o.need))) return 'Hazır siparişin var. Sipariş panosuna dokun.';
    return '';
  }
  let botKey = '';
  function paintBot() {
    let html = ''; let key = '';
    if (mode?.k === 'plant') {
      key = `p${mode.crop}${F.lvl}${F.coins}`;
      html = `<div class="sf-seeds"><div class="sf-sh"><span>Ekin seç, sonra boş tarlaların üzerinde parmağını kaydır</span><button class="sf-x" data-a="mode0" aria-label="Kapat">${icon('close')}</button></div><div class="sf-sl">${Object.entries(cfg.CROPS).map(([k, c]) => {
        const lock = c.lvl > F.lvl; return `<button class="sf-seed ${mode.crop === k ? 'on' : ''} ${lock ? 'lock' : ''}" data-a="seed" data-k="${k}" ${lock ? 'disabled' : ''}>${spr(`i_${k}`, 40)}<b>${esc(c.name)}</b><small>${lock ? `Seviye ${c.lvl}` : `${fmt(c.t)}${c.seed ? ` · ${c.seed} altın` : ''}`}</small></button>`; }).join('')}</div></div>`;
    } else if (mode?.k === 'place') {
      const Ty = cfg.TYPES[mode.t]; const canRm = mode.id && (Ty.kind === 'decor' || Ty.kind === 'plot' || Ty.kind === 'prod'); key = `l${mode.t}${mode.id || ''}`;
      html = `<div class="sf-place"><button class="sf-btn ghost" data-a="placeNo">Vazgeç</button><span class="sf-pl">${esc(Ty.name)}${mode.id ? '' : mode.stock ? '<small>Koleksiyondan</small>' : Ty.gem ? `<small>${spr('i_jeton', 14)} ${Ty.gem} jeton</small>` : `<small>${spr('i_coin', 14)} ${Ty.cost}</small>`}<em>Sürükleyerek yerini seç</em></span>${canRm ? `<button class="sf-btn red" data-a="placeRm">Kaldır</button>` : ''}<button class="sf-btn" data-a="placeOk">${mode.id ? 'Taşı' : 'Yerleştir'}</button></div>`;
    } else if (mode?.k === 'edit') { key = 'e'; html = `<div class="sf-place"><span class="sf-pl">Düzenleme modu<em>Taşımak ya da kaldırmak için bir şeye dokun</em></span><button class="sf-btn" data-a="mode0">Bitti</button></div>`;
    } else {
      const o = !visit && info ? F.objs.find((x) => x.id === info.id && x.t === 'plot' && x.crop) : null; const left = o ? cfg.CROPS[o.crop].t - (tnow() - o.at) : 0;
      if (o && left > 0) { key = `r${o.id}${fmt(left)}`; html = `<div class="sf-place"><span class="sf-pl">${esc(cfg.CROPS[o.crop].name)}<em>${fmt(left)} sonra olgunlaşır</em></span><button class="sf-btn sm violet" data-a="rush" data-id="${o.id}">Hızlandır · ${spr('i_jeton', 16)} ${rushCost(left)}</button></div>`; }
      else { const h = hintText(); key = `h${h}`; html = h ? `<div class="sf-hint">${esc(h)}</div>` : ''; }
    }
    if (key !== botKey) { botKey = key; bot.innerHTML = html; }
  }

  // ---------- paneller ----------
  let panel = null; let ps = {};
  const closePanel = () => { panel = null; layer.innerHTML = ''; };
  function openPanel(title, body, live) {
    layer.innerHTML = `<div class="sf-dim" data-a="close"></div><section class="sf-panel"><header class="sf-ph"><b>${esc(title)}</b><button class="sf-x" data-a="close" aria-label="Kapat">${icon('close')}</button></header><div class="sf-pb"></div></section>`;
    const el = layer.querySelector('.sf-pb'); panel = { live, paint() { const st = el.scrollTop; el.innerHTML = body(); el.scrollTop = st; } }; panel.paint();
  }
  const needs = (items) => Object.entries(items).map(([k, n]) => { const h = inv()[k] || 0; return `<span class="sf-need ${h >= n ? 'ok' : 'no'}">${spr(`i_${k}`, 26)}<b>${Math.min(h, 99)}/${n}</b></span>`; }).join('');
  const ordersBody = () => `<div class="sf-ords">${F.orders.map((o) => (o.wait ? `<div class="sf-ord wait"><span>Yeni sipariş yolda</span><b>${fmt(o.wait - tnow())}</b></div>`
    : `<div class="sf-ord"><div class="sf-ow">${esc(o.who)}</div><div class="sf-on">${needs(o.need)}</div><div class="sf-or"><span>${spr('i_coin', 20)}<b>${o.coins}</b></span><span>${STAR}<b>${o.xp}</b></span></div>
      <div class="sf-oa"><button class="sf-btn sm ghost" data-a="skip" data-id="${o.id}">Geç</button><button class="sf-btn sm" data-a="deliver" data-id="${o.id}" ${hasAll(o.need) ? '' : 'disabled'}>Teslim et</button></div></div>`)).join('')}</div>
    <p class="sf-note">Siparişi teslim edince altın ve deneyim kazanırsın. Geçtiğin siparişin yerine 3 dakikada yenisi gelir.</p>`;
  const barnBody = () => {
    const used = invN(); const items = Object.entries(inv()); const sel = ps.sel && inv()[ps.sel] ? ps.sel : null; if (sel) ps.n = Math.min(Math.max(1, ps.n || 1), inv()[sel]);
    return `<div class="sf-cap"><div class="sf-capb"><i style="width:${Math.min(100, (used / F.cap) * 100)}%"></i><b>${used}/${F.cap}</b></div><button class="sf-btn sm gold" data-a="barnUp">Büyüt · ${spr('i_coin', 14)} ${F.capUp}</button></div>
      ${items.length ? `<div class="sf-inv">${items.map(([k, n]) => `<button class="sf-it ${sel === k ? 'on' : ''}" data-a="sel" data-k="${k}">${spr(`i_${k}`, 44)}<b>${n}</b><small>${esc(cfg.ITEMS[k][0])}</small></button>`).join('')}</div>` : '<p class="sf-empty">Ambarın boş. Ekin biç, ürün topla.</p>'}
      ${sel ? `<div class="sf-sell"><span class="sf-pl">${esc(cfg.ITEMS[sel][0])}<small>tanesi ${cfg.ITEMS[sel][1]} altın</small></span><div class="sf-stp"><button data-a="sellN" data-d="-1" aria-label="Azalt">−</button><b>${ps.n}</b><button data-a="sellN" data-d="1" aria-label="Artır">+</button><button data-a="sellN" data-d="999">Hepsi</button></div><button class="sf-btn gold" data-a="sellDo">Sat · ${spr('i_coin', 16)} ${ps.n * cfg.ITEMS[sel][1]}</button></div>`
    : items.length ? '<p class="sf-note">Satmak için bir ürüne dokun. Siparişler pazardan daha çok kazandırır.</p>' : ''}`;
  };
  const shopBody = () => {
    const cnt = (t) => F.objs.filter((o) => o.t === t).length; const st = F.stock || {};
    const tile = ([t, Ty]) => { const have = st[t] || 0; const lock = Ty.lvl > F.lvl; const own = (Ty.kind === 'build' || Ty.kind === 'pen') && cnt(t) > 0; const lim = t === 'plot' ? F.maxPlots : Ty.max; const full = lim != null && cnt(t) >= lim; const dis = !have && (lock || own || full || !!Ty.special);
      return `<button class="sf-shop ${dis ? 'dis' : ''}" data-a="shop" data-t="${t}" ${dis ? 'disabled' : ''}><span class="sf-shi">${spr(t, 58)}</span><b>${esc(Ty.name)}</b>${have ? `<small class="ok">Yerleştir · ${have}</small>` : Ty.special ? `<small class="lk">${esc(Ty.special)}</small>` : lock ? `<small class="lk">Seviye ${Ty.lvl}</small>` : own ? '<small class="lk">Kuruldu</small>' : full ? `<small class="lk">${cnt(t)}/${lim}</small>` : Ty.gem ? `<small class="jt">${spr('i_jeton', 15)} ${Ty.gem}</small>` : `<small>${spr('i_coin', 14)} ${Ty.cost}</small>`}</button>`; };
    const E = Object.entries(cfg.TYPES).filter(([, v]) => v.kind !== 'fixed'); const ex = F.exp; const sec = (title, f) => `<h3 class="sf-h">${title}</h3><div class="sf-shopg">${E.filter(([, v]) => f(v)).map(tile).join('')}</div>`;
    return `${ex ? `<div class="sf-exp">${spr('fence_x', 44)}<span class="sf-pl">Araziyi genişlet<small>${ex.n}×${ex.n} kare${ex.lvl > F.lvl ? ` · Seviye ${ex.lvl} gerekli` : ''}</small></span><button class="sf-btn sm gold" data-a="expand" ${ex.lvl > F.lvl || F.coins < ex.cost ? 'disabled' : ''}>${spr('i_coin', 14)} ${ex.cost}</button></div>` : ''}
      ${sec('Tarla ve üretim', (v) => v.kind !== 'decor')}${sec('Süsler', (v) => v.kind === 'decor' && !v.gem && !v.special)}${sec('Jetonla alınan özel süsler', (v) => !!v.gem)}${sec('Koleksiyon', (v) => !!v.special)}
      <p class="sf-note">Koleksiyon parçaları satın alınmaz, etkinliklerle kazanılır. Jetonlu süsler yalnızca görünüş içindir; oyunda öne geçirmez.</p>`;
  };
  const buildBody = (b) => () => {
    const q = F.q[b] || []; const Ty = cfg.TYPES[b]; const now = tnow();
    const slots = Array.from({ length: Ty.slots }, (_, i) => { const it = q[i]; if (!it) return '<div class="sf-slot"><small>Boş</small></div>'; const left = it.end - now; return `<div class="sf-slot ${left <= 0 ? 'rdy' : 'run'}">${spr(`i_${it.r}`, 38)}<small>${left > 0 ? fmt(left) : 'Hazır'}</small></div>`; }).join('');
    const rdy = q.length && q[0].end <= now;
    return `<div class="sf-q">${slots}${q.length && !rdy ? `<button class="sf-btn sm violet" data-a="rushB" data-b="${b}">Hızlandır · ${spr('i_jeton', 16)} ${rushCost(q[0].end - now)}</button>` : `<button class="sf-btn gold" data-a="takeB" data-b="${b}" ${rdy ? '' : 'disabled'}>Ürünü al</button>`}</div>
      <div class="sf-recs">${Object.entries(cfg.RECIPES[b]).map(([k, r]) => { const lock = r.lvl > F.lvl; const ok = !lock && hasAll(r.in) && q.length < Ty.slots;
        return `<div class="sf-rec ${lock ? 'lock' : ''}">${spr(`i_${k}`, 46)}<div class="sf-ri"><b>${esc(cfg.ITEMS[k][0])}${r.out > 1 ? ` ×${r.out}` : ''}</b><small>${fmt(r.t)} · ${STAR} ${r.xp}</small><div class="sf-on">${needs(r.in)}</div></div>${lock ? `<small class="lk">Seviye ${r.lvl}</small>` : `<button class="sf-btn sm" data-a="craft" data-b="${b}" data-r="${k}" ${ok ? '' : 'disabled'}>Üret</button>`}</div>`; }).join('')}</div>`;
  };
  const penBody = (p) => () => {
    const P = cfg.PENS[p]; const list = F.pens[p] || []; const now = tnow(); const feedN = inv()[P.feed] || 0; const hungry = list.filter((a) => !a.at).length; const ready = list.filter((a) => a.at && now - a.at >= P.t).length; const price = P.prices[list.length];
    return `<div class="sf-ans">${list.map((a) => { const st = !a.at ? ['hun', 'Aç'] : now - a.at >= P.t ? ['rdy', 'Hazır'] : ['', fmt(P.t - (now - a.at))]; return `<div class="sf-an ${st[0]}">${spr(P.animal, 52)}<small>${st[1]}</small></div>`; }).join('')}
      ${price != null ? `<button class="sf-an add" data-a="animal" data-p="${p}"><span class="plus">+</span><small>${spr('i_coin', 14)} ${price}</small></button>` : ''}</div>
      <div class="sf-row"><button class="sf-btn" data-a="feed" data-p="${p}" ${hungry && feedN ? '' : 'disabled'}>${spr(`i_${P.feed}`, 22)} Besle (${feedN})</button><button class="sf-btn gold" data-a="collect" data-p="${p}" ${ready ? '' : 'disabled'}>${spr(`i_${P.out}`, 22)} Topla${ready ? ` (${ready})` : ''}</button></div>
      <p class="sf-note">${list.length ? '' : `İlk ${P.aname.toLocaleLowerCase('tr-TR')} için artıya dokun. `}${esc(cfg.ITEMS[P.feed][0])} değirmende üretilir; beslenen hayvan ${fmt(P.t)} sonra ${cfg.ITEMS[P.out][0].toLocaleLowerCase('tr-TR')} verir.</p>`;
  };
  const nbBody = () => {
    if (!ps.nb) return '<div class="spinner"></div>';
    const row = (r) => { const me = r.user.id === state.me?.id; return `<${me ? 'div' : `a href="#/farm/${esc(r.user.id)}"`} class="sf-nb"><img src="${esc(r.user.avatar)}" alt=""><span class="sf-grow"><b>${esc(r.user.name || r.user.username)}</b><small>Seviye ${r.lvl} · ${r.harv} hasat</small></span>${me ? '<small class="lk">Sen</small>' : '<span class="sf-btn sm">Gez</span>'}</${me ? 'div' : 'a'}>`; };
    return `<h3 class="sf-h">Takip ettiklerin</h3>${ps.nb.following.length ? ps.nb.following.map(row).join('') : '<p class="sf-empty">Takip ettiklerinden henüz çiftlik kuran yok. Onları oyuna davet et.</p>'}
      <h3 class="sf-h">En iyi çiftçiler</h3>${ps.nb.top.map((r, i) => row(r).replace('<img', `<i class="sf-rank">${i + 1}</i><img`)).join('')}
      <p class="sf-note">Komşunun çiftliğinde büyüyen ekinleri sulayabilirsin: ekin daha çabuk olgunlaşır, sen de altın ve deneyim kazanırsın. Günde ${cfg.HELPS} yardım hakkın var.</p>`;
  };
  const grid = (k0) => Object.entries(inv()).map(([k, n]) => `<button class="sf-it ${k0 === k ? 'on' : ''}" data-a="sel" data-k="${k}">${spr(`i_${k}`, 40)}<b>${n}</b><small>${esc(cfg.ITEMS[k][0])}</small></button>`).join('');
  const rew = (R, sz = 34) => `${R.coins ? `<span>${spr('i_coin', sz)}<b>${R.coins}</b></span>` : ''}${R.item ? `<span>${spr(`i_${R.item[0]}`, sz)}<b>×${R.item[1]}</b></span>` : ''}${R.decor ? `<span>${spr(R.decor, sz + 4)}</span>` : ''}`;
  const dailyBody = () => { const d = F.daily;
    return `<div class="sf-days">${cfg.DAILY7.map((R, i) => { const done = d.can ? i < d.next : d.next === 0 || i < d.next; return `<div class="sf-day ${done ? 'done' : ''} ${d.can && i === d.next ? 'now' : ''}"><small>${i + 1}. gün</small><div>${rew(R)}</div></div>`; }).join('')}</div>
      <div class="sf-row"><button class="sf-btn gold" data-a="dailyGet" ${d.can ? '' : 'disabled'}>${d.can ? 'Bugünün ödülünü al' : 'Bugünkü ödül alındı, yarın yine gel'}</button></div>
      <p class="sf-note">Her gün gir, ödülün büyüsün. 7. gün koleksiyonluk bahçe cücesi senin. Bir gün kaçırırsan seri biraz geriler.</p>`; };
  const rankBody = () => { const R = ps.rank; if (!R) return '<div class="spinner"></div>'; const tab = ps.tab || 'friends'; const rows = R[tab] || [];
    const row = (r) => { const me = r.user.id === state.me?.id; return `<${me ? 'div' : `a href="#/farm/${esc(r.user.id)}"`} class="sf-nb ${me ? 'me' : ''}"><i class="sf-rank r${r.rank}">${r.rank}</i><img src="${esc(r.user.avatar)}" alt=""><span class="sf-grow"><b>${esc(r.user.name || r.user.username)}</b><small>Seviye ${r.lvl}</small></span><span class="sf-sc">${STAR}<b>${r.score}</b></span></${me ? 'div' : 'a'}>`; };
    return `<div class="sf-rk"><span>Bitmesine <b>${fmtD(R.ends - tnow())}</b></span><span>Bu haftaki deneyimin ${STAR} <b>${F.week || 0}</b></span></div>
      <div class="sf-prz">${R.prize.map((pz, i) => `<span><i class="sf-rank r${i + 1}">${i + 1}</i>${spr('i_coin', 16)}<b>${pz}</b>${spr('trophy', 24)}</span>`).join('')}</div>
      <div class="sf-tabs">${[['friends', 'Arkadaşlar'], ['city', R.cityName || 'Şehrim'], ['all', 'Herkes']].map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-a="rtab" data-k="${k}">${esc(n)}</button>`).join('')}</div>
      ${rows.length ? rows.map(row).join('') : `<p class="sf-empty">${tab === 'city' && !R.cityName ? 'Profiline şehrini eklersen şehrindeki çiftçilerle yarışırsın.' : 'Bu hafta burada henüz kimse deneyim kazanmadı. İlk sen ol.'}</p>`}
      <p class="sf-note">Sıralama o hafta kazanılan deneyime göredir ve pazartesi sıfırlanır. Ödüller "Herkes" sıralamasının ilk üçüne verilir: altın ve koleksiyonluk kupa.</p>`; };
  const coopBody = () => { const c = F.coop;
    if (c) { const w = c.with;
      return `<div class="sf-nb">${w ? `<img src="${esc(w.avatar)}" alt="">` : ''}<span class="sf-grow"><b>${w ? esc(w.name || w.username) : 'Ortak sipariş'}</b><small>${w ? 'ile ortak sipariş · ' : ''}${fmtD(c.end - tnow())} kaldı</small></span><span class="sf-sc">${spr('i_coin', 18)}<b>${cfg.COOP_COINS}</b>${spr('fountain', 32)}</span></div>
        <div class="sf-recs">${Object.entries(c.need).map(([k, n]) => { const got = c.got[k] || 0; const can = Math.min(n - got, inv()[k] || 0); return `<div class="sf-rec">${spr(`i_${k}`, 42)}<div class="sf-ri"><b>${esc(cfg.ITEMS[k][0])}</b><div class="sf-capb sm"><i style="width:${Math.min(100, (got / n) * 100)}%"></i><b>${got}/${n}</b></div></div>${got >= n ? '<small class="ok">Tamam</small>' : `<button class="sf-btn sm" data-a="coopGive" data-k="${k}" data-n="${can}" ${can > 0 ? '' : 'disabled'}>Ver${can > 0 ? ` · ${can}` : ''}</button>`}</div>`; }).join('')}</div>
        <p class="sf-note">Sen ${c.mine}, ortağın ${c.theirs} ürün verdi. Sipariş dolunca ikiniz de ${cfg.COOP_COINS} altın ve koleksiyonluk çeşme kazanırsınız.</p>`; }
    const list = ps.nb ? ps.nb.following.filter((r) => r.user.id !== state.me?.id) : null;
    return `<p class="sf-note top">Bir komşunla büyük bir siparişi birlikte doldurun. 3 gününüz var; tamamlanınca ikiniz de ${cfg.COOP_COINS} altın ve koleksiyonluk çeşme kazanırsınız.</p>
      ${!list ? '<div class="spinner"></div>' : list.length ? list.map((r) => `<div class="sf-nb"><img src="${esc(r.user.avatar)}" alt=""><span class="sf-grow"><b>${esc(r.user.name || r.user.username)}</b><small>Seviye ${r.lvl}</small></span><button class="sf-btn sm" data-a="coopStart" data-u="${esc(r.user.id)}">Davet et</button></div>`).join('') : '<p class="sf-empty">Ortak sipariş için takip ettiğin birinin çiftliği olmalı. Arkadaşlarını oyuna çağır.</p>'}`; };
  const stallBody = () => { const st = F.stall || []; const sel = ps.sel && inv()[ps.sel] ? ps.sel : null; const base = sel ? cfg.ITEMS[sel][1] : 0;
    if (sel) { ps.n = Math.min(Math.max(1, ps.n || 1), 10, inv()[sel]); ps.price = Math.min(ps.n * base * 2, Math.max(1, ps.price || ps.n * base)); }
    return `<div class="sf-q">${Array.from({ length: cfg.STALL_SLOTS }, (_, i) => { const x = st[i]; return x ? `<button class="sf-slot run" data-a="stallCancel" data-id="${x.id}">${spr(`i_${x.k}`, 32)}<small>×${x.n} · ${x.price}</small></button>` : '<div class="sf-slot"><small>Boş</small></div>'; }).join('')}</div>
      ${st.length >= cfg.STALL_SLOTS ? '' : Object.keys(inv()).length ? `<h3 class="sf-h">Satışa koyacağın ürünü seç</h3><div class="sf-inv">${grid(sel)}</div>
        ${sel ? `<div class="sf-sell two"><span class="sf-pl">${esc(cfg.ITEMS[sel][0])}<small>pazarda tanesi ${base} altın</small></span><div class="sf-stp"><button data-a="stN" data-d="-1" aria-label="Azalt">−</button><b>${ps.n}</b><button data-a="stN" data-d="1" aria-label="Artır">+</button></div>
          <span class="sf-pl">Fiyatın<small>en çok ${ps.n * base * 2} altın</small></span><div class="sf-stp"><button data-a="stP" data-d="-1" aria-label="Azalt">−</button><b>${ps.price}</b><button data-a="stP" data-d="1" aria-label="Artır">+</button></div>
          <button class="sf-btn gold" data-a="stallPut">Tezgâha koy · ${spr('i_coin', 16)} ${ps.price}</button></div>` : ''}` : '<p class="sf-empty">Ambarın boş. Önce ürün topla.</p>'}
      <p class="sf-note">Tezgâhındaki ürünleri çiftliğini gezen komşuların satın alır, altını sana gelir. Geri almak için tezgâhtaki ürüne dokun.</p>`; };
  const vstallBody = () => { const st = F.stall || [];
    return st.length ? `<div class="sf-recs">${st.map((x) => `<div class="sf-rec">${spr(`i_${x.k}`, 44)}<div class="sf-ri"><b>${esc(cfg.ITEMS[x.k][0])} ×${x.n}</b><small>pazar değeri ${x.n * cfg.ITEMS[x.k][1]} altın</small></div><button class="sf-btn sm gold" data-a="vbuy" data-id="${x.id}" ${F.myCoins >= x.price ? '' : 'disabled'}>${spr('i_coin', 14)} ${x.price}</button></div>`).join('')}</div><p class="sf-note">Aldığın ürün ambarına gider.</p>` : '<p class="sf-empty">Tezgâh şu an boş.</p>'; };
  const giftBody = () => { if (F.gifted) return '<p class="sf-empty">Bugünkü hediyeni gönderdin. Yarın yine gönderebilirsin.</p>';
    const sel = ps.sel && inv()[ps.sel] ? ps.sel : null; if (sel) ps.n = Math.min(Math.max(1, ps.n || 1), 3, inv()[sel]);
    return `${Object.keys(inv()).length ? `<div class="sf-inv">${grid(sel)}</div>` : '<p class="sf-empty">Ambarında gönderecek ürün yok.</p>'}
      ${sel ? `<div class="sf-sell"><span class="sf-pl">${esc(cfg.ITEMS[sel][0])}<small>en çok 3 tane</small></span><div class="sf-stp"><button data-a="gN" data-d="-1" aria-label="Azalt">−</button><b>${ps.n}</b><button data-a="gN" data-d="1" aria-label="Artır">+</button></div><button class="sf-btn" data-a="giftSend">Hediyeyi gönder</button></div>` : ''}
      <p class="sf-note">Günde bir hediye gönderebilirsin. Yazışıyorsanız hediyen sohbetinize de düşer.</p>`; };
  const setBody = () => `<div class="sf-set">
      <button class="sf-tg ${muted ? '' : 'on'}" data-a="snd"><span><b>Oyun sesleri</b><small>Hasat, altın ve seviye sesleri</small></span><i></i></button>
      <button class="sf-tg ${F.notif ? 'on' : ''}" data-a="notif"><span><b>Tarla hazır bildirimi</b><small>Ekinlerin olgunlaşınca haber verir, günde en çok 2 kez</small></span><i></i></button>
      <button class="sf-tg ${ambOn ? 'on' : ''}" data-a="amb"><span><b>Gün ve mevsim</b><small>Gece karanlığı, gün batımı, kar ve yaprak görüntüleri</small></span><i></i></button></div>
    <p class="sf-note">Bildirimin telefonuna gelmesi için SwipeUp bildirimlerine izin vermiş olman gerekir.</p>`;
  const overQ = []; const showOver = (html) => { if (over.innerHTML) overQ.push(html); else over.innerHTML = html; };
  function gotDecor(k) { const Ty = cfg.TYPES[k]; showOver(`<div class="sf-lvl"><div class="sf-lvc dec"><span class="sf-decs">${spr(k, 92)}</span><h2>${esc(Ty.name)}</h2><p class="sf-lvr">Koleksiyonuna eklendi</p><p class="sf-note">Market'teki Koleksiyon bölümünden çiftliğine yerleştirebilirsin.</p><button class="sf-btn" data-a="lvlok">Harika!</button></div></div>`); }
  function levelUp(f) {
    showOver(`<div class="sf-lvl"><div class="sf-lvc"><span class="sf-bigstar">${STAR}<b>${f.lvl}</b></span><h2>Seviye ${f.lvl}!</h2><p class="sf-lvr">${spr('i_coin', 22)} +${f.coins} altın</p>
      ${(f.unlock || []).length ? `<div class="sf-unl"><small>Yeni açılanlar</small><div>${f.unlock.map((u) => `<span>${spr(u.k, 54)}<em>${esc(u.name)}</em></span>`).join('')}</div></div>` : ''}<button class="sf-btn" data-a="lvlok">Harika!</button></div></div>`);
  }

  // ---------- yerleştirme ----------
  function startPlace(t, id) {
    const Ty = cfg.TYPES[t]; let x; let y;
    if (id) { const o = F.objs.find((v) => v.id === id); x = o.x; y = o.y; } else {
      const [cx, cy] = toGrid(W / 2, H / 2); let best = null;
      for (let a = 0; a <= N - Ty.w; a++) for (let b = 0; b <= N - Ty.h; b++) { if (!free(t, a, b)) continue; const d = (a + Ty.w / 2 - cx) ** 2 + (b + Ty.h / 2 - cy) ** 2; if (!best || d < best[0]) best = [d, a, b]; }
      if (!best) { toast('Çiftlikte boş yer kalmadı.'); return; } [, x, y] = best;
    }
    mode = { k: 'place', t, id: id || null, x, y, stock: !id && F.stock?.[t] > 0, back: mode?.k === 'edit' ? 'edit' : null }; closePanel(); paintBot();
  }
  const UI = {
    back() { if (visit) location.hash = '#/farm'; else if (history.length > 1) history.back(); else location.hash = '#/oyunlar'; },
    close: closePanel,
    orders() { ps = {}; openPanel('Siparişler', ordersBody, true); },
    barn() { ps = {}; openPanel('Ambar', barnBody); },
    shop() { ps = {}; openPanel('Market', shopBody); },
    nb() { ps = {}; openPanel('Komşular', nbBody); api('/farm/neighbors').then((r) => { ps.nb = r; panel?.paint(); }).catch((e) => toast(e.message)); },
    edit() { mode = mode?.k === 'edit' ? null : { k: 'edit' }; paintBot(); },
    set() { ps = {}; openPanel('Ayarlar', setBody); },
    snd() { muted = !muted; try { localStorage.setItem('sf_mute', muted ? '1' : '0'); } catch { /* yok say */ } if (!muted) SFX.pop(3); const b = root.querySelector('.sf-sndb'); if (b) b.innerHTML = icon(muted ? 'mute' : 'volume'); panel?.paint(); },
    notif() { act('notif', { on: !F.notif }); },
    mode0() { mode = null; paintBot(); },
    seed(d) { mode = { k: 'plant', crop: d.k }; paintBot(); },
    deliver(d) { act('order', { id: d.id }); }, skip(d) { act('skip', { id: d.id }); },
    sel(d) { ps.sel = ps.sel === d.k ? null : d.k; ps.n = 1; ps.price = 0; panel.paint(); },
    sellN(d) { ps.n = Math.max(1, Math.min(inv()[ps.sel] || 1, +d.d > 100 ? 9999 : (ps.n || 1) + +d.d)); panel.paint(); },
    sellDo() { act('sell', { item: ps.sel, n: ps.n }); },
    barnUp() { act('barn'); },
    shop_(t) { startPlace(t); },
    craft(d) { act('craft', { b: d.b, r: d.r }); }, takeB(d) { act('take', { b: d.b }); },
    feed(d) { act('feed', { pen: d.p }); }, collect(d) { act('collect', { pen: d.p }); }, animal(d) { act('animal', { pen: d.p }); },
    lvlok() { over.innerHTML = overQ.shift() || ''; },
    jet() { toast('Jeton, SwipeUp cüzdanındaki jetonundur. Hızlandırmada ve özel süslerde kullanılır.'); },
    daily() { ps = {}; openPanel('Günlük ödül', dailyBody); }, dailyGet() { act('daily'); },
    rank() { ps = {}; openPanel('Haftalık sıralama', rankBody, true); api('/farm/rank').then((r) => { ps.rank = r; panel?.paint(); }).catch((e) => toast(e.message)); },
    rtab(d) { ps.tab = d.k; panel.paint(); },
    coop() { ps = {}; openPanel('Ortak sipariş', coopBody, true); if (!F.coop) api('/farm/neighbors').then((r) => { ps.nb = r; panel?.paint(); }).catch((e) => toast(e.message)); },
    coopStart(d) { act('coopStart', { uid: d.u }).then((r) => { if (r) toast('Davet gönderildi, ortak sipariş başladı.'); }); },
    coopGive(d) { act('coopGive', { item: d.k, n: +d.n }); },
    stall() { ps = {}; openPanel('Tezgâh', stallBody); },
    stN(d) { ps.n = Math.max(1, Math.min(10, inv()[ps.sel] || 1, (ps.n || 1) + +d.d)); ps.price = ps.n * cfg.ITEMS[ps.sel][1]; panel.paint(); },
    stP(d) { const base = ps.n * cfg.ITEMS[ps.sel][1]; ps.price = Math.max(1, Math.min(base * 2, ps.price + +d.d * Math.max(1, Math.round(base * 0.1)))); panel.paint(); },
    stallPut() { act('stallPut', { item: ps.sel, n: ps.n, price: ps.price }).then((r) => { if (r) { ps.sel = null; panel?.paint(); } }); },
    stallCancel(d) { act('stallCancel', { id: d.id }); },
    expand() { act('expand').then((r) => { if (r) { closePanel(); cam.z = 0; clampCam(); toast(`Arazin büyüdü: ${N}×${N} kare.`); SFX.level(); } }); },
    rush(d) { info = null; act('rush', { id: d.id }).then((r) => { if (r) SFX.coin(); }); }, rushB(d) { act('rush', { b: d.b }).then((r) => { if (r) SFX.coin(); }); },
    amb() { ambOn = !ambOn; try { localStorage.setItem('sf_amb', ambOn ? '1' : '0'); } catch { /* yok say */ } calcAmb(); panel?.paint(); },
    vgift() { ps = {}; openPanel('Hediye gönder', giftBody); },
    gN(d) { ps.n = Math.max(1, Math.min(3, inv()[ps.sel] || 1, (ps.n || 1) + +d.d)); panel.paint(); },
    giftSend() { vcall('gift', { item: ps.sel, n: ps.n }, (r) => { closePanel(); SFX.take(); toast(`Hediyen yola çıktı: ${r.sent.n} ${cfg.ITEMS[r.sent.k][0].toLocaleLowerCase('tr-TR')}.`); }); },
    vstall() { ps = {}; openPanel('Tezgâh', vstallBody); },
    vbuy(d) { vcall('stall', { id: d.id }, () => SFX.coin()); },
    vcoop() { chain = chain.then(() => api('/farm/act', { body: { a: 'coopStart', uid: visit.id } }).then(() => { F.canCoop = false; hud(); SFX.take(); toast('Ortak sipariş başladı. Kendi çiftliğindeki Ortak düğmesinden takip et.'); }).catch((e) => { SFX.err(); toast(e.message); })); },
    placeNo() { mode = mode.back ? { k: 'edit' } : null; paintBot(); },
    async placeOk() {
      const m = mode; if (!m.ok) { toast('Buraya sığmıyor. Yeşil olan bir yer seç.'); return; }
      if (m.id) { mode = m.back ? { k: 'edit' } : null; paintBot(); act('move', { id: m.id, x: m.x, y: m.y }); return; }
      const r = await act('buy', { t: m.t, x: m.x, y: m.y }); if (!r) return;
      if (r.placed) pops.set(r.placed, T);
      const Ty = cfg.TYPES[m.t]; const cnt = F.objs.filter((o) => o.t === m.t).length;
      const more = !m.stock && Ty.cost != null && F.coins >= Ty.cost && ((Ty.kind === 'decor' && !Ty.max) || (Ty.kind === 'plot' && cnt < F.maxPlots) || (Ty.kind === 'prod' && cnt < Ty.max));
      if (more && mode === m) { // aynısından bir tane daha: yanındaki ilk boş yere
        const near = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].map(([a, b]) => [m.x + a * Ty.w, m.y + b * Ty.h]).find(([a, b]) => free(m.t, a, b));
        if (near) { mode = { ...m, x: near[0], y: near[1] }; return; }
      }
      if (mode === m) { mode = null; paintBot(); }
    },
    placeRm() { const m = mode; mode = m.back ? { k: 'edit' } : null; paintBot(); act('remove', { id: m.id }); },
  };
  // döndürülmüş ekranda liste kaydırma: parmak hareketi sahnenin eksenine çevrilir
  let sc = null; let noClick = 0; let glide = 0;
  root.addEventListener('pointerdown', (e) => { cancelAnimationFrame(glide); if (!rot) return; const el = e.target.closest('.sf-pb, .sf-sl'); if (el) sc = { el, x: e.clientX, y: e.clientY, moved: 0, vx: 0, vy: 0 }; }, true);
  root.addEventListener('pointermove', (e) => { if (!sc) return; const dx = e.clientX - sc.x; const dy = e.clientY - sc.y; sc.x = e.clientX; sc.y = e.clientY; sc.moved += Math.abs(dx) + Math.abs(dy); sc.vx = dx; sc.vy = dy; sc.el.scrollTop += dx; sc.el.scrollLeft -= dy; }, true);
  const scEnd = () => { if (!sc) return; const m = sc; sc = null; if (m.moved < 10) return; noClick = performance.now();
    const run = () => { m.vx *= 0.93; m.vy *= 0.93; if (Math.abs(m.vx) + Math.abs(m.vy) < 0.4 || !m.el.isConnected) return; m.el.scrollTop += m.vx; m.el.scrollLeft -= m.vy; glide = requestAnimationFrame(run); }; glide = requestAnimationFrame(run); };
  root.addEventListener('pointerup', scEnd, true); root.addEventListener('pointercancel', scEnd, true);
  root.addEventListener('click', (e) => {
    if (performance.now() - noClick < 350) return;
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const d = b.dataset;
    if (d.a === 'shop' && d.t) return UI.shop_(d.t);
    UI[d.a]?.(d, b);
  });

  // ---------- dokunma ----------
  function pick(sx, sy) {
    const [gx, gy] = toGrid(sx, sy); const tx = Math.floor(gx); const ty = Math.floor(gy);
    const hit = F.objs.find((o) => { const Ty = cfg.TYPES[o.t]; return tx >= o.x && tx < o.x + Ty.w && ty >= o.y && ty < o.y + Ty.h; });
    if (hit) return hit;
    let best = null; // yüksek yapıların çatısına dokunma
    for (const o of F.objs) { const Ty = cfg.TYPES[o.t]; if (Ty.w * Ty.h < 2 && o.t !== 'board') continue; const a = A.atlas[o.t]; const [ox, oy] = toScr(o.x + Ty.w / 2, o.y + Ty.h / 2);
      const x0 = ox - a[5] * cam.z * 0.8; const y0 = oy - a[6] * cam.z; if (sx > x0 && sx < x0 + a[3] * cam.z * 0.62 && sy > y0 && sy < oy && (!best || o.x + o.y > best.x + best.y)) best = o; }
    return best;
  }
  function tap(o) {
    const now = tnow();
    if (mode?.k === 'place') return;
    if (mode?.k === 'edit') { if (o) { pops.set(o.id, T); startPlace(o.t, o.id); } return; }
    if (!o) { if (mode?.k === 'plant') { mode = null; paintBot(); } return; }
    pops.set(o.id, T); SFX.tap(); const Ty = cfg.TYPES[o.t];
    if (visit) {
      if (o.t === 'plot' && o.crop && !cropReady(o, now)) {
        if (o.h) { toast('Bu ekin zaten sulanmış.'); return; }
        chain = chain.then(() => api(`/farm/of/${visit.id}/help`, { body: { id: o.id } }).then((r) => { lastPos = centerOf(o.id) || lastPos; SFX.water(); apply(r); }).catch((e) => toast(e.message)));
      }
      return;
    }
    if (cfg.PROD[o.t]) { if (now - (o.at || 0) >= cfg.PROD[o.t].t) act('pick', { id: o.id }); else info = { id: o.id, until: T + 2600 }; return; }
    if (Ty.kind === 'plot') { if (!o.crop) { if (mode?.k !== 'plant') { const c = localStorage.getItem('sf_crop'); mode = { k: 'plant', crop: cfg.CROPS[c]?.lvl <= F.lvl ? c : 'wheat' }; paintBot(); } } else if (!cropReady(o, now)) { info = { id: o.id, until: T + 7000 }; paintBot(); } return; }
    if (Ty.kind === 'build') { const q = F.q[o.t] || []; if (q.length && q[0].end <= now) act('take', { b: o.t }); else { ps = {}; openPanel(Ty.name, buildBody(o.t), true); } return; }
    if (Ty.kind === 'pen') { const P = cfg.PENS[o.t]; if ((F.pens[o.t] || []).some((a) => a.at && now - a.at >= P.t)) act('collect', { pen: o.t }); else { ps = {}; openPanel(Ty.name, penBody(o.t), true); } return; }
    if (o.t === 'barn') UI.barn(); else if (o.t === 'board') UI.orders(); else if (o.t === 'house') UI.nb();
  }
  const ptr = new Map(); let drag = null;
  const pos = (e) => { if (rot) return [e.clientY, window.innerWidth - e.clientX]; const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const swipeOn = (o) => { // kaydırırken üzerinden geçilen tarlayı işleme kat
    if (!o || o.t !== 'plot' || drag.ids.has(o.id)) return;
    if (drag.k === 'harvest' && cropReady(o, tnow())) { drag.ids.add(o.id); pendH.add(o.id); pops.set(o.id, T); SFX.pop(drag.ids.size); }
    if (drag.k === 'plant' && !o.crop && !pendP.has(o.id)) { const c = cfg.CROPS[mode.crop]; if (F.coins < c.seed * (drag.ids.size + 1)) return; drag.ids.add(o.id); pendP.set(o.id, mode.crop); pops.set(o.id, T); SFX.plant(); }
  };
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture?.(e.pointerId); const [sx, sy] = pos(e); ptr.set(e.pointerId, [sx, sy]);
    if (ptr.size === 2) { const [a, b] = [...ptr.values()]; if (drag?.ids) { drag.ids.forEach((id) => { pendH.delete(id); pendP.delete(id); }); } drag = { k: 'pinch', d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: cam.z }; return; }
    const o = pick(sx, sy); drag = { k: 'pan', sx, sy, moved: false, o };
    if (mode?.k === 'place') { const [gx, gy] = toGrid(sx, sy); const Ty = cfg.TYPES[mode.t]; if (gx >= mode.x - 0.8 && gx <= mode.x + Ty.w + 0.8 && gy >= mode.y - 0.8 && gy <= mode.y + Ty.h + 0.8) drag = { k: 'ghost', moved: true }; return; }
    if (visit || mode?.k === 'edit' || !o || o.t !== 'plot') return;
    if (cropReady(o, tnow())) { drag = { k: 'harvest', ids: new Set() }; swipeOn(o); } else if (!o.crop && mode?.k === 'plant') { drag = { k: 'plant', ids: new Set() }; swipeOn(o); }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!ptr.has(e.pointerId) || !drag) return; const [px, py] = ptr.get(e.pointerId); const [sx, sy] = pos(e); ptr.set(e.pointerId, [sx, sy]);
    if (drag.k === 'pinch') { if (ptr.size < 2) return; const [a, b] = [...ptr.values()]; cam.z = drag.z * (Math.hypot(a[0] - b[0], a[1] - b[1]) / drag.d); clampCam(); return; }
    if (drag.k === 'pan') { if (!drag.moved && Math.hypot(sx - drag.sx, sy - drag.sy) < 7) return; drag.moved = true; cam.x -= (sx - px) / cam.z; cam.y -= (sy - py) / cam.z; clampCam(); return; }
    if (drag.k === 'ghost') { const [gx, gy] = toGrid(sx, sy); const Ty = cfg.TYPES[mode.t]; mode.x = Math.min(N - Ty.w, Math.max(0, Math.round(gx - Ty.w / 2))); mode.y = Math.min(N - Ty.h, Math.max(0, Math.round(gy - Ty.h / 2))); return; }
    swipeOn(pick(sx, sy));
  });
  const up = (e) => {
    if (!ptr.has(e.pointerId)) return; const [sx, sy] = ptr.get(e.pointerId); ptr.delete(e.pointerId); const d = drag; if (!d) return;
    if (d.k === 'pinch') { if (ptr.size === 0) drag = null; return; } drag = null;
    if (d.k === 'pan' && !d.moved) { if (mode?.k === 'place') { const [gx, gy] = toGrid(sx, sy); const Ty = cfg.TYPES[mode.t]; mode.x = Math.min(N - Ty.w, Math.max(0, Math.round(gx - Ty.w / 2))); mode.y = Math.min(N - Ty.h, Math.max(0, Math.round(gy - Ty.h / 2))); } else tap(d.o); return; }
    if ((d.k === 'harvest' || d.k === 'plant') && d.ids.size) {
      const ids = [...d.ids]; if (d.k === 'plant') localStorage.setItem('sf_crop', mode.crop);
      act(d.k, d.k === 'plant' ? { ids, crop: mode.crop } : { ids }).then(() => ids.forEach((id) => { pendH.delete(id); pendP.delete(id); }));
    }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); cam.z *= e.deltaY < 0 ? 1.1 : 0.9; clampCam(); }, { passive: false });

  // ---------- zaman ----------
  hud(); paintBot();
  const tick = setInterval(() => {
    if (panel?.live) panel.paint();
    paintBot(); if (!visit) hud(); calcAmb();
    if (!visit && F.orders.some((o) => o.wait && o.wait <= tnow())) reload();
  }, 1000);
  const vis = () => { if (document.visibilityState === 'visible') reload(); };
  document.addEventListener('visibilitychange', vis);
  return () => { cancelAnimationFrame(raf); cancelAnimationFrame(glide); clearInterval(tick); clearTimeout(toastT); ro.disconnect(); document.removeEventListener('visibilitychange', vis); unfit(); };
}

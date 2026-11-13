// SwipeFarm: izometrik çiftlik oyunu. Görseller hazır 3D çizimlerdir (public/img/farm, scripts/farm-art ile üretilir);
// sahne tek bir tuvale çizilir, bütün kurallar ve süreler sunucudadır (server/farm.js).
import { icon } from '../icons.js';
import { api, esc, state, uploadFile } from '../core.js';
import { AV, loadArt, lazyMini } from '../farmart.js';

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

// ---- arka plan müziği: dosya yok, sakin bir pentatonik ezgi tarayıcıda üretilir ----
let music = true; try { music = localStorage.getItem('sf_music') !== '0'; } catch { /* yok say */ }
const MUS = { on: false, t: 0, timer: 0, bus: null, step: 0, note: 4 };
const SCALE = [196, 220, 247, 294, 330, 392, 440, 494, 587, 659]; // Sol pentatonik
const CHORDS = [[98, 147, 196], [110, 165, 220], [82, 123, 165], [98, 147, 247]];
function musicTick() {
  if (!MUS.on || !AC) return;
  const t0 = Math.max(AC.currentTime + 0.05, MUS.t); const bar = 4.8; const ch = CHORDS[MUS.step % CHORDS.length];
  ch.forEach((f) => { const o = AC.createOscillator(); const gn = AC.createGain(); o.type = 'sine'; o.frequency.value = f; gn.gain.setValueAtTime(0.0001, t0); gn.gain.linearRampToValueAtTime(0.05, t0 + 1.2); gn.gain.linearRampToValueAtTime(0.0001, t0 + bar + 0.6); o.connect(gn).connect(MUS.bus); o.start(t0); o.stop(t0 + bar + 0.7); });
  for (let i = 0; i < 8; i++) { if (Math.random() < 0.38) continue; MUS.note = Math.min(SCALE.length - 1, Math.max(0, MUS.note + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)])); const t = t0 + i * (bar / 8) + Math.random() * 0.03;
    const o = AC.createOscillator(); const gn = AC.createGain(); o.type = 'triangle'; o.frequency.value = SCALE[MUS.note]; gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.06, t + 0.02); gn.gain.exponentialRampToValueAtTime(0.0001, t + 1.1); o.connect(gn).connect(MUS.bus); o.start(t); o.stop(t + 1.2); }
  MUS.step += 1; MUS.t = t0 + bar; MUS.timer = setTimeout(musicTick, Math.max(200, (MUS.t - AC.currentTime - 0.6) * 1000));
}
function musicStart() {
  if (!music || MUS.on) return;
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch { return; }
  MUS.bus = AC.createGain(); MUS.bus.gain.value = 0.9; const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; MUS.bus.connect(lp).connect(AC.destination);
  MUS.on = true; MUS.t = 0; musicTick();
}
function musicStop() { if (!MUS.on) return; MUS.on = false; clearTimeout(MUS.timer); try { const b = MUS.bus; b.gain.setTargetAtTime(0.0001, AC.currentTime, 0.4); setTimeout(() => b.disconnect(), 1500); } catch { /* yok say */ } }

let A = null;
function useCss() { if (document.getElementById('sf-css')) return; const l = document.createElement('link'); l.id = 'sf-css'; l.rel = 'stylesheet'; l.href = `/css/farm.css${AV}`; document.head.append(l); }
// atlastaki bir görseli DOM'da göster. "i_g_" ile başlayanlar altın yıldızlı ürünlerdir: aynı görsel, üstünde yıldız.
const HAS = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const spr = (k0, size = 40) => { const gold = String(k0).startsWith('i_g_'); const k = gold ? `i_${k0.slice(4)}` : k0; if (!HAS(A.atlas, k)) return ''; const a = A.atlas[k]; const im = A[a[0]]; const s = size / Math.max(a[3], a[4]); const r = (v) => Math.round(v * 10) / 10;
  return `<i class="sf-sp${gold ? ' gold' : ''}" style="width:${r(a[3] * s)}px;height:${r(a[4] * s)}px;background:url(/img/farm/${a[0]}.webp${AV}) ${r(-a[1] * s)}px ${r(-a[2] * s)}px/${r(im.width * s)}px ${r(im.height * s)}px"></i>`; };
const WXI = { // hava durumu simgeleri
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="#ffc933" stroke="#e09a12" stroke-width="1.4"/><g stroke="#ffb520" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></g></svg>',
  cloud: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="16" cy="9" r="3.6" fill="#ffc933"/><path d="M6.5 19a4 4 0 0 1-.4-8 5.5 5.5 0 0 1 10.6 1.5A3.3 3.3 0 0 1 17 19z" fill="#fff" stroke="#9fb3c2" stroke-width="1.4"/></svg>',
  rain: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 14.5a4 4 0 0 1-.4-8 5.5 5.5 0 0 1 10.6 1.5 3.3 3.3 0 0 1 .3 6.5z" fill="#e8eef4" stroke="#8aa0b4" stroke-width="1.4"/><g stroke="#3aa8ee" stroke-width="2" stroke-linecap="round"><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/></g></svg>',
  hot: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6" fill="#ff8a2a" stroke="#e0541a" stroke-width="1.4"/><g stroke="#ff6a1a" stroke-width="2" stroke-linecap="round"><path d="M12 1.8v2.4M12 19.8v2.4M1.8 12h2.4M19.8 12h2.4M4.8 4.8l1.7 1.7M17.5 17.5l1.7 1.7M4.8 19.2l1.7-1.7M17.5 6.5l1.7-1.7"/></g></svg>',
};
const WXT = { sun: 'Güneşli bir gün. Ekinler normal hızında büyür.', cloud: 'Hava bulutlu. Ekinler normal hızında büyür.', rain: 'Yağmur yağıyor: şimdi ekilen ekinler %25 daha hızlı büyür, büyüyen ekinler kendiliğinden sulanır.', hot: 'Hava çok sıcak: şimdi ekilen ekinler susar. Sulamazsan %40 yavaş büyürler.' };

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
  const hasAll = (items) => Object.entries(items).every(([k, n]) => (inv()[k] || 0) >= n);
  const cropT = (o) => cfg.CROPS[o.crop].t * (o.k || 1);
  const cropReady = (o, now) => !!o.crop && now - o.at >= cropT(o);
  const ik = (k) => `i_${k}`; // ürün görseli (altın ürünler "i_g_..." olarak yıldızlı gösterilir)
  const iname = (k) => cfg.ITEMS[k]?.[0] || k;

  root.innerHTML = `<canvas class="sf-cv"></canvas>
    <div class="sf-top"><button class="sf-rb" data-a="back" aria-label="Geri">${icon('back')}</button>
      ${visit ? `<div class="sf-who"><img src="${esc(visit.avatar)}" alt=""><span><b>${esc(visit.name || visit.username)}</b><small>Seviye ${F.lvl} çiftlik</small></span></div><span class="sf-grow"></span><div class="sf-peers"></div><button class="sf-pill sf-wx" data-a="wx"></button><div class="sf-pill"><i class="sf-dropi"></i><b class="sf-helps"></b></div><div class="sf-pill sf-coin">${spr('i_coin', 24)}<b></b></div><button class="sf-rb sf-sndb" data-a="snd" aria-label="Ses">${icon(muted ? 'mute' : 'volume')}</button>`
    : `<div class="sf-lv"><span class="sf-star">${STAR}<b class="sf-lvn"></b></span><div class="sf-xp"><i></i><small></small></div></div><span class="sf-grow"></span><div class="sf-peers"></div>
      <button class="sf-pill sf-wx" data-a="wx"></button><button class="sf-pill sf-jet" data-a="jet">${spr('i_jeton', 24)}<b></b></button><div class="sf-pill sf-coin">${spr('i_coin', 24)}<b></b></div><button class="sf-pill sf-barnp" data-a="barn">${spr('barn', 28)}<b></b></button><button class="sf-rb" data-a="set" aria-label="Ayarlar">${icon('settings')}</button>`}</div>
    <button class="sf-rb sf-emob" data-a="emo" aria-label="İfade gönder">${icon('smile')}</button><div class="sf-emos" hidden>${cfg.EMOTES.map((e, i) => `<button data-a="emote" data-i="${i}">${esc(e)}</button>`).join('')}</div>
    <div class="sf-tut" hidden></div>
    ${visit ? `<div class="sf-side sf-sideL">
      <button data-a="vbook">${spr('i_book', 34)}<small>Defter</small></button>
      <button data-a="vpair" class="sf-vpair">${spr('i_heart', 30)}<small>Çift</small><em class="sf-badge" data-b="vpair" hidden>!</em></button>
      <button data-a="vboat" class="sf-vboat">${spr('i_boat', 34)}<small>Tekne</small><em class="sf-badge" data-b="vboat" hidden></em></button></div>
    <div class="sf-side">
      <button data-a="vgift">${spr('i_gift', 32)}<small>Hediye</small></button>
      <button data-a="vstall">${spr('i_stall', 34)}<small>Tezgâh</small><em class="sf-badge" data-b="vstall" hidden></em></button>
      <button data-a="vcoop" class="sf-vcoop">${spr('i_crate', 32)}<small>Ortak</small></button></div>`
    : `<div class="sf-side sf-sideL">
      <button data-a="hubG">${spr('i_chest', 32)}<small>Görevler</small><em class="sf-badge" data-b="hubG" hidden>!</em></button>
      <button data-a="boat" class="sf-boatb">${spr('i_boat', 34)}<small>Tekne</small><em class="sf-badge" data-b="boat" hidden>!</em></button>
      <button data-a="hubS">${spr('trophy', 34)}<small>Sosyal</small><em class="sf-badge" data-b="hubS" hidden>!</em></button>
      <button data-a="stall">${spr('i_stall', 34)}<small>Tezgâh</small></button></div>
    <div class="sf-side">
      <button data-a="orders">${spr('board', 34)}<small>Sipariş</small><em class="sf-badge" data-b="orders" hidden></em></button>
      <button data-a="shop">${spr('bakery', 36)}<small>Market</small></button>
      <button data-a="nb">${spr('house', 36)}<small>Komşular</small></button>
      <button data-a="edit">${icon('edit')}<small>Düzenle</small></button></div>`}
    <div class="sf-bot"></div><div class="sf-layer"></div><div class="sf-over"></div><div class="sf-toast" role="status"></div>`;
  // sahne tek ve opak bir tuvale çizilir; çim, zemin ve arkadaki çit/ağaçlar ayrı (görünmeyen) bir tuvalde tutulur ve her karede tek seferde kopyalanır
  const cv = root.querySelector('.sf-cv'); const g = cv.getContext('2d', { alpha: false }); const cvb = document.createElement('canvas'); const gb = cvb.getContext('2d', { alpha: false });
  // hafif grafik: yavaş cihazlarda çözünürlük ve süs efektleri kısılır (Ayarlar'dan da açılıp kapanır)
  let lowQ = false; try { lowQ = localStorage.getItem('sf_lowq') === '1'; } catch { /* yok say */ }
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
  let first = true; let bgKey = ''; let curFont = '';
  const resize = () => {
    W = root.clientWidth; H = root.clientHeight; dpr = Math.min(lowQ ? 1 : 1.5, window.devicePixelRatio || 1); // sahne en çok 1,5 kat çözünürlükte çizilir: keskinlik korunur, piksel yükü yarıya iner root.classList.toggle('land', W > H);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cvb.width = cv.width; cvb.height = cv.height; bgKey = ''; curFont = ''; // boyut değişince tuvalin yazı tipi sıfırlanır
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
  let objVer = 0; // çiftlik verisi her yenilendiğinde artar
  function buildRing() { ring = []; let i = 0; objVer++; bgKey = '';
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
  // Yürüyüş: zıplama yok. Kalkışta hızlanır, varırken yavaşlar; adım kareleri gidilen yola göre döner, gidiş yönüne bakar.
  let fdt = 33; // son karenin süresi (ms)
  function stepW(man, dt, v) {
    if (man.go) { const dx = man.tx - man.x; const dy = man.ty - man.y; const d = Math.hypot(dx, dy);
      man.sp = (man.sp || 0) + (v * Math.min(1, d / 0.55 + 0.12) - (man.sp || 0)) * Math.min(1, dt / 240); const st = dt * man.sp;
      if (d <= Math.max(st, 0.015)) { man.x = man.tx; man.y = man.ty; man.go = false; man.sp = 0; man.wait = 900 + Math.random() * 2600; } else { man.x += (dx / d) * st; man.y += (dy / d) * st; } return; }
    man.wait -= dt; if (man.wait > 0) return; const stuck = blocked(man.x, man.y);
    for (let i = 0; i < 10; i++) { const a = Math.random() * 6.283; const r = 1.5 + Math.random() * 5; const tx = man.x + Math.cos(a) * r; const ty = man.y + Math.sin(a) * r; if (!blocked(tx, ty) && (stuck || clear(man.x, man.y, tx, ty))) { man.tx = tx; man.ty = ty; man.go = true; return; } }
    man.wait = 1200;
  }
  function gait(w, x, y) { // konum değişiminden hız, bakış yönü ve adım sayacı
    if (w.gx == null) { w.gx = x; w.gy = y; w.gd = 0; w.gf = false; w.gv = 0; }
    const dx = x - w.gx; const dy = y - w.gy; w.gx = x; w.gy = y; const d = Math.hypot(dx, dy);
    w.gv += (d / Math.max(16, fdt) - w.gv) * 0.35;
    if (d > 0.0004 && d < 2) { w.gd += d; const sv = dx - dy; if (Math.abs(sv) > d * 0.3) w.gf = sv < 0; }
    return w;
  }
  function walker(base, w, x, y, sx, sy, step = 0.2) { // durunca sabit poz, yürürken adım kareleri
    gait(w, x, y); let k = base;
    if (w.gv > 0.00008) { const ph = Math.floor(w.gd / step) % 4; const f = ph === 0 ? `${base}_1` : ph === 2 ? `${base}_2` : base; if (HAS(A.atlas, f)) k = f; }
    sp(k, sx, sy, 1, 1, 1, w.gf);
  }
  const herd = new Map(); // ağıldaki hayvanlar: yerlerinin çevresinde ağır ağır gezinir, arada durur
  function graze(key, bx, by, dt) {
    let h = herd.get(key); if (!h) { h = { x: bx, y: by, tx: bx, ty: by, wait: Math.random() * 4000, go: false, sp: 0 }; herd.set(key, h); }
    if (h.go) { const dx = h.tx - h.x; const dy = h.ty - h.y; const d = Math.hypot(dx, dy); h.sp += (0.00034 * Math.min(1, d / 0.12 + 0.2) - h.sp) * Math.min(1, dt / 300); const st = dt * h.sp;
      if (d <= Math.max(st, 0.008)) { h.go = false; h.sp = 0; h.wait = 1500 + Math.random() * 5000; } else { h.x += (dx / d) * st; h.y += (dy / d) * st; } }
    else { h.wait -= dt; if (h.wait <= 0) { const a = Math.random() * 6.283; const r = 0.08 + Math.random() * 0.2; h.tx = bx + Math.cos(a) * r; h.ty = by + Math.sin(a) * r * 0.8; h.go = true; } }
    return h;
  }
  const petW = { x: man.x + 1, y: man.y + 0.6, tx: 0, ty: 0, wait: 400, go: false };
  const starPath = (x, y, r) => { g.beginPath(); for (let i = 0; i < 10; i++) { const an = -Math.PI / 2 + (i * Math.PI) / 5; const q = i % 2 ? r * 0.45 : r; g[i ? 'lineTo' : 'moveTo'](x + Math.cos(an) * q, y + Math.sin(an) * q); } g.closePath(); };
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
  let mode = null; // null | {k:'plant',crop} | {k:'tool',tool:'water'|'fert'} | {k:'place',t,id,x,y} | {k:'edit'}
  const pops = new Map(); const pendH = new Set(); const pendP = new Map(); const pendW = new Set(); const pendF = new Set(); let fxs = []; let info = null; let bubbles = [];
  const tutOn = () => !visit && F.tut != null && F.tut < cfg.TUT_N;
  // kasaba ziyaretçileri: kapıdan girer, sipariş panosunun önünde bekler
  const gate = [N / 2, N + 0.6];
  const visSpot = (v, i) => { const b = F.objs.find((x) => x.t === 'board') || F.objs.find((x) => x.t === 'house'); const bx = b ? b.x + 0.5 : N / 2; const by = b ? b.y + 1.6 : N / 2;
    const c = [[0.2, 0.3], [1.1, 0.1], [-0.6, 0.7], [0.6, 1.1]][(i + (v.sx || 0)) % 4]; let x = bx + c[0]; let y = by + c[1];
    for (let k = 0; k < 6 && blocked(x, y); k++) { x += 0.5; y += 0.35; } return [Math.min(N - 0.4, Math.max(0.4, x)), Math.min(N - 0.4, Math.max(0.4, y))]; };
  let npcHit = []; // ekrandaki ziyaretçiler (dokunma için)
  // canlı ziyaret: aynı çiftlikteki diğer çiftçiler
  const peers = new Map(); let meW = null; let myEmo = null; // meW: ziyaretteyken kendi çiftçin, myEmo: kendi çiftliğindeyken gönderdiğin ifade
  if (visit) { meW = { id: 'me', x: gate[0], y: N - 0.4, tx: man.x + 0.9, ty: man.y + 0.4, walk: true, fit: F.myFit || 'a', user: state.me || {} }; if (blocked(meW.tx, meW.ty)) { meW.tx = gate[0]; meW.ty = N - 1.6; } }
  const pat = gb.createPattern(A.grass, 'repeat');
  // önceden çizilmiş ışık ve gölge lekeleri (her karede degrade üretmemek için)
  const blob = (rgb) => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return c; };
  const GLOW = blob('255,190,90'); const SHADE = blob('30,45,60'); const SUNB = blob('255,230,140');
  const font = (f) => { if (f !== curFont) { g.font = f; curFont = f; } };
  const free = (t, x, y, skip) => { const Ty = cfg.TYPES[t]; if (x < 0 || y < 0 || x + Ty.w > N || y + Ty.h > N) return false;
    return !F.objs.some((o) => o.id !== skip && x < o.x + cfg.TYPES[o.t].w && o.x < x + Ty.w && y < o.y + cfg.TYPES[o.t].h && o.y < y + Ty.h); };

  function sp(k, sx, sy, kx = 1, ky = kx, alpha = 1, flip = false) {
    if (!HAS(A.atlas, k)) return; const a = A.atlas[k]; const z = cam.z;
    if (alpha !== 1) g.globalAlpha = alpha;
    if (flip) { g.save(); g.translate(sx, sy); g.scale(-1, 1); g.drawImage(A[a[0]], a[1], a[2], a[3], a[4], -a[5] * z * kx, -a[6] * z * ky, a[3] * z * kx, a[4] * z * ky); g.restore(); }
    else g.drawImage(A[a[0]], a[1], a[2], a[3], a[4], sx - a[5] * z * kx, sy - a[6] * z * ky, a[3] * z * kx, a[4] * z * ky);
    if (alpha !== 1) g.globalAlpha = 1;
  }
  function ico(k0, x, y, s, alpha = 1) { const gold = k0.startsWith('i_g_'); const k = gold ? `i_${k0.slice(4)}` : k0; if (!HAS(A.atlas, k)) return; const a = A.atlas[k]; const f = s / Math.max(a[3], a[4]); g.globalAlpha = alpha; g.drawImage(A[a[0]], a[1], a[2], a[3], a[4], x - (a[3] * f) / 2, y - (a[4] * f) / 2, a[3] * f, a[4] * f); g.globalAlpha = 1;
    if (gold) { g.globalAlpha = alpha; star(x + s * 0.34, y - s * 0.32, s * 0.24); g.globalAlpha = 1; } }
  // canlı ziyaret: çiftçinin üstünde ifade balonu
  function emoteAt(p, sx, sy) { if (!p.emo || T - p.emoT > 3200) return; const txt = cfg.EMOTES[p.emo - 1]; if (!txt) return; const k = Math.min(1, (T - p.emoT) / 160); const fade = T - p.emoT > 2700 ? 1 - (T - p.emoT - 2700) / 500 : 1;
    g.save(); g.globalAlpha = Math.max(0, fade); const big = [...txt].length <= 2; font(big ? '26px system-ui, sans-serif' : '800 13px "Bricolage Grotesque", system-ui, sans-serif'); const w = Math.max(38, g.measureText(txt).width + 22); const h = big ? 38 : 30; const y = sy - h / 2 - (1 - k) * 8;
    const rr = (dy) => { if (g.roundRect) g.roundRect(sx - w / 2, y - h / 2 + dy, w, h, h / 2); else g.rect(sx - w / 2, y - h / 2 + dy, w, h); };
    g.fillStyle = 'rgba(40,25,10,.2)'; g.beginPath(); rr(3); g.fill(); g.fillStyle = '#fffdf3'; g.beginPath(); rr(0); g.fill(); g.beginPath(); g.moveTo(sx - 6, y + h / 2 - 1); g.lineTo(sx, y + h / 2 + 7); g.lineTo(sx + 6, y + h / 2 - 1); g.fill();
    g.fillStyle = '#3a220c'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, sx, y + 1); g.restore(); }
  function walkTo(w, dt, v) { if (!w.walk) return; const dx = w.tx - w.x; const dy = w.ty - w.y; const d = Math.hypot(dx, dy); w.sp = (w.sp || 0) + (v * Math.min(1, d / 0.55 + 0.12) - (w.sp || 0)) * Math.min(1, dt / 240); const st = dt * w.sp; if (d <= Math.max(st, 0.015)) { w.x = w.tx; w.y = w.ty; w.walk = false; w.sp = 0; } else { w.x += (dx / d) * st; w.y += (dy / d) * st; } }
  function drop(x, y, r) { g.save(); g.fillStyle = '#3aa8ee'; g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y - r * 1.5); g.bezierCurveTo(x + r * 1.3, y, x + r, y + r, x, y + r); g.bezierCurveTo(x - r, y + r, x - r * 1.3, y, x, y - r * 1.5); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(x - r * 0.3, y + r * 0.2, r * 0.22, 0, 7); g.fill(); g.restore(); }
  function star(x, y, r) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.46 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fillStyle = '#ffd23f'; g.strokeStyle = '#b97a0c'; g.lineWidth = 1.5; g.lineJoin = 'round'; g.stroke(); g.fill(); }
  function label(txt, x, y, size = 13, fill = '#fff') { font(`800 ${Math.round(size * 2) / 2}px "Bricolage Grotesque", system-ui, sans-serif`); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.strokeStyle = 'rgba(58,34,12,.9)'; g.lineWidth = size * 0.3; g.strokeText(txt, x, y); g.fillStyle = fill; g.fillText(txt, x, y); }
  function bubble(sx, sy, k, o = {}) {
    const s = 32 * Math.min(1.3, Math.max(0.85, cam.z / 0.3)); const y = sy - s * 0.95 + (o.still ? 0 : Math.sin(T / 260 + sx * 0.05) * 3); const r = s * 0.62;
    const tail = (dy) => { g.moveTo(sx - s * 0.2, y + s * 0.5 + dy); g.lineTo(sx, y + s * 0.9 + dy); g.lineTo(sx + s * 0.2, y + s * 0.5 + dy); };
    g.fillStyle = 'rgba(40,25,10,.2)'; g.beginPath(); g.arc(sx, y + 3, r + 1, 0, 7); tail(3); g.fill();
    g.fillStyle = o.bg || '#fffdf3'; g.beginPath(); g.arc(sx, y, r, 0, 7); tail(0); g.fill();
    if (o.p != null) { g.lineWidth = 3.5; g.lineCap = 'round'; g.strokeStyle = '#eadfc6'; g.beginPath(); g.arc(sx, y, r - 2.5, 0, 7); g.stroke(); g.strokeStyle = '#62b63f'; g.beginPath(); g.arc(sx, y, r - 2.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, Math.max(0.02, o.p))); g.stroke(); }
    if (k === 'drop') drop(sx, y, s * 0.26); else if (o.text) label(o.text, sx, y + 1, s * 0.5, '#fff'); else ico(k, sx, y, s * 0.8, o.dim ? 0.5 : 1);
    if (o.cnt > 1) label(`×${o.cnt}`, sx + r * 0.75, y + r * 0.62, s * 0.36, '#fff');
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
      if (crop) { const p = pendP.has(o.id) ? 0 : (now - o.at) / (pendP.has(o.id) ? 1 : cropT(o)); ready = p >= 1; key = ready ? `${crop}_3` : p >= 0.4 ? `${crop}_2` : 'sprout'; }
      if (tutOn() && ((F.tut === 0 && ready) || (F.tut === 1 && !crop))) { const pu = 0.5 + 0.5 * Math.sin(T / 260); diamond(o.x + 0.06, o.y + 0.06, o.x + 0.94, o.y + 0.94); g.strokeStyle = `rgba(255,236,120,${0.5 + pu * 0.5})`; g.lineWidth = 3 + pu * 2; g.stroke(); }
      sp(key, sx, sy, k, k * (ready ? 1 + Math.sin(T / 420 + o.x * 1.7 + o.y) * 0.03 : 1));
      const grow = crop && !ready && !pendP.has(o.id);
      if (grow && (o.h || o.w || pendW.has(o.id)) && !o.dry) drop(sx + 62 * z, sy - 34 * z, 4 + 4 * z);
      if (grow && (o.f || pendF.has(o.id))) { const tw = 0.6 + 0.4 * Math.sin(T / 300 + o.x); g.globalAlpha = tw; star(sx - 58 * z, sy - 30 * z, 5 + 5 * z); g.globalAlpha = 1; }
      if (ready && o.f) { const tw = 0.6 + 0.4 * Math.sin(T / 240 + o.y); g.globalAlpha = tw; star(sx + 40 * z, sy - 70 * z, 6 + 6 * z); g.globalAlpha = 1; }
      if (visit && grow && !o.h && F.helpsLeft > 0) bubbles.push([sx, sy - 46 * z, 'drop', { bg: o.dry ? '#ffe2c8' : undefined }]);
      else if (!visit && grow && o.dry && !pendW.has(o.id)) bubbles.push([sx, sy - 46 * z, 'drop', { bg: '#ffe2c8' }]);
      if (info && info.id === o.id && grow) bubbles.push([sx, sy - 60 * z, null, { info: `${cfg.CROPS[crop].name} · ${fmt(cropT(o) - (now - o.at))}${o.dry ? ' · susuz' : ''}` }]);
      return;
    }
    sp(o.t, sx, sy, k);
    const a = A.atlas[o.t]; if (!a) return; const top = sy - a[6] * z * 0.94;
    if (amb.night > 0.01) { if (o.t === 'lantern') lights.push([sx, sy - 92 * z, 170 * z]); else if (o.t === 'house' || Ty.kind === 'build') lights.push([sx + 10 * z, sy - 46 * z, 150 * z]); }
    const ul = Ty.kind === 'build' ? F.bu?.[o.t] || 0 : 0; // yükseltilmiş bina: önünde yıldızlar
    for (let i = 0; i < ul; i++) { starPath(sx + (i - (ul - 1) / 2) * 30 * z, sy + ((Ty.w + Ty.h) / 2) * HH * z - 10 * z, 13 * z); g.fillStyle = '#ffc933'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#7a4a12'; g.stroke(); }
    const PR = cfg.PROD[o.t]; // elma ağacı, arı kovanı: süresi dolunca ürün balonu
    if (PR) { const left = PR.t - (now - (o.at || 0)); if (left <= 0) { if (!visit) bubbles.push([sx, top, `i_${PR.out}`, {}]); } else if (info && info.id === o.id) bubbles.push([sx, top + 12, null, { info: `${cfg.ITEMS[PR.out][0]} · ${fmt(left)}` }]); }
    if (o.t === 'mill') sp(`rotor_${(F.q?.mill || []).some((q) => q.end > now) ? Math.floor(T / 90) % 6 : 0}`, sx, sy, k);
    if (Ty.kind === 'pen') {
      const P = cfg.PENS[o.t]; const list = F.pens?.[o.t] || []; let ready = 0; let hungry = 0;
      list.forEach((an, i) => { const [dx, dy] = SPOTS[o.t][i] || [0, 0]; const h = graze(`${o.id}:${i}`, cx + dx, cy + dy, fdt); const [ax, ay] = toScr(h.x, h.y); const fed = an.at && now - an.at < P.t;
        if (!an.at) hungry++; else if (!fed) ready++;
        walker(P.animal, h, h.x, h.y, ax, ay, 0.07); });
      if (ready) bubbles.push([sx, top, `i_${P.out}`, {}]); else if (hungry && !visit) bubbles.push([sx, top, `i_${P.feed}`, { dim: !(inv()[P.feed] > 0) }]);
    }
    if (Ty.kind === 'build' && !visit) { const q = F.q?.[o.t] || []; if (q.length) { const r = cfg.RECIPES[o.t][q[0].r]; const left = q[0].end - now; bubbles.push([sx, top, `i_${q[0].r}`, left <= 0 ? {} : { dim: true, p: 1 - left / r.t, still: true }]); } }
    if (o.t === 'board' && !visit) { const n = F.orders.filter((x) => !x.wait && hasAll(x.need)).length; if (n) bubbles.push([sx, top, null, { text: String(n), bg: '#62b63f' }]); }
  }

  let raf = 0; let last = 0;
  // ---------- arka plan: çim, çiftlik zemini ve arkadaki çit/ağaçlar. Kamera oynamadıkça yeniden çizilmez ----------
  function drawBg() {
    const grid = mode?.k === 'place' || mode?.k === 'edit';
    const k = `${cam.x.toFixed(1)}|${cam.y.toFixed(1)}|${cam.z.toFixed(4)}|${W}|${H}|${dpr}|${N}|${amb.season}|${grid}|${lowQ}`; if (k === bgKey) return; bgKey = k;
    const x = gb; const z = cam.z; x.setTransform(dpr, 0, 0, dpr, 0, 0); x.imageSmoothingQuality = lowQ ? 'medium' : 'high';
    const [ox, oy] = toScr(0, 0); const c = (6 / 512) * z;
    pat.setTransform(new DOMMatrix([HW * c, HH * c, -HW * c, HH * c, ox, oy])); x.fillStyle = pat; x.fillRect(0, 0, W, H);
    const path = (pts) => { x.beginPath(); pts.forEach(([a, b], i) => { const [sx, sy] = toScr(a, b); if (i) x.lineTo(sx, sy); else x.moveTo(sx, sy); }); x.closePath(); };
    x.fillStyle = 'rgba(16,64,30,.2)'; x.beginPath(); x.rect(0, 0, W, H); { const P = [[-1, -1], [-1, N + 1], [N + 1, N + 1], [N + 1, -1]]; P.forEach(([a, b], i) => { const [sx, sy] = toScr(a, b); if (i) x.lineTo(sx, sy); else x.moveTo(sx, sy); }); x.closePath(); } x.fill('evenodd');
    if (amb.season === 'winter') { x.fillStyle = 'rgba(238,246,255,.34)'; x.fillRect(0, 0, W, H); } else if (amb.season === 'autumn') { x.fillStyle = 'rgba(204,132,36,.14)'; x.fillRect(0, 0, W, H); }
    path([[0, 0], [N, 0], [N, N], [0, N]]); x.fillStyle = 'rgba(255,248,190,.07)'; x.fill();
    if (grid) { x.strokeStyle = 'rgba(255,255,255,.2)'; x.lineWidth = 1; x.beginPath(); for (let i = 0; i <= N; i++) { let [a, b] = toScr(i, 0); x.moveTo(a, b); [a, b] = toScr(i, N); x.lineTo(a, b); [a, b] = toScr(0, i); x.moveTo(a, b); [a, b] = toScr(N, i); x.lineTo(a, b); } x.stroke(); }
    for (const r of ring) { if (r.gx > 0 && r.gy > 0) continue; const [sx, sy] = toScr(r.gx, r.gy); if (sx < -200 || sx > W + 200 || sy < -80 || sy > H + 260) continue; const a = A.atlas[r.k]; if (a) x.drawImage(A[a[0]], a[1], a[2], a[3], a[4], sx - a[5] * z, sy - a[6] * z, a[3] * z, a[4] * z); }
  }
  // ---------- sabit çizim listesi: yapılar ve öndeki çit/ağaçlar derinliğe göre bir kez sıralanır ----------
  let statList = []; let statVer = -1; const spotCache = new Map();
  function buildStatic() {
    statList = []; for (const r of ring) if (r.gx > 0 && r.gy > 0) statList.push([r.gx + r.gy, r]);
    for (const o of F.objs) { const Ty = cfg.TYPES[o.t]; if (Ty) statList.push([o.x + o.y + (Ty.w + Ty.h) / 2, o]); }
    statList.sort((a, b) => a[0] - b[0]); statVer = objVer; spotCache.clear();
  }
  const spotOf = (v, i) => { let s = spotCache.get(v.id); if (!s) { s = visSpot(v, i); spotCache.set(v.id, s); } return s; };
  // renk katmanlarını (gün batımı, gece, hava) tek bir dolguda birleştir: tam ekran boyama sayısı azalır
  function tint() {
    let R = 0; let G = 0; let B = 0; let Al = 0;
    const add = (r, gg, b, a) => { if (a <= 0.004) return; R = r * a + R * (1 - a); G = gg * a + G * (1 - a); B = b * a + B * (1 - a); Al = a + Al * (1 - a); };
    add(255, 128, 48, 0.13 * amb.warm); add(14, 24, 70, 0.46 * amb.night);
    const wx = F.wx?.k; if (wx === 'rain') add(40, 70, 110, 0.16); else if (wx === 'cloud') add(70, 85, 100, 0.1); else if (wx === 'hot') add(255, 150, 40, 0.08 + (0.5 + 0.5 * Math.sin(T / 1400)) * 0.05);
    if (Al > 0.004) { g.fillStyle = `rgba(${Math.round(R / Al)},${Math.round(G / Al)},${Math.round(B / Al)},${Al.toFixed(3)})`; g.fillRect(0, 0, W, H); }
  }
  function drawDyn(e, now, op) {
    const z = cam.z; const kind = e[1];
    if (kind === 0) { const [sx, sy] = toScr(man.x, man.y); walker(F.fit && F.fit !== 'a' ? `farmer_${F.fit}` : 'farmer', man, man.x, man.y, sx, sy); man.sx = sx; man.sy = sy;
      if (visit && op) { label(op.user.name || op.user.username, sx, sy - 128 * z - 8, 12); emoteAt(op, sx, sy - 128 * z - 28); } else if (!visit && myEmo) emoteAt(myEmo, sx, sy - 128 * z - 14); return; }
    if (kind === 1) { const [sx, sy] = toScr(petW.x, petW.y); walker(F.pet.t, petW, petW.x, petW.y, sx, sy, 0.13); petW.sx = sx; petW.sy = sy - 30 * z;
      if (!visit && cfg.PETS[F.pet.t] && (!F.pet.fed || now - F.pet.fed >= cfg.PET_T)) bubbles.push([sx, sy - 62 * z, F.pet.fed ? 'i_gift' : `i_${cfg.PETS[F.pet.t].food[0]}`, {}]); return; }
    if (kind === 2) { const r = e[2]; const v = r.v; const [sx, sy] = toScr(r.x, r.y); walker(v.look, v.gw || (v.gw = {}), r.x, r.y, sx, sy); npcHit.push([sx, sy - 50 * z, v]);
      if (!r.walking) { const enough = (inv()[v.k] || 0) >= v.n; bubbles.push([sx, sy - 118 * z, ik(v.k), { dim: !visit && !enough, cnt: v.n }]); } return; }
    const p = e[2]; const x = p === meW ? p.x : p.dx; const y = p === meW ? p.y : p.dy; const [sx, sy] = toScr(x, y);
    if (sx < -100 || sx > W + 100 || sy < -60 || sy > H + 200) return;
    walker(p.fit && p.fit !== 'a' ? `farmer_${p.fit}` : 'farmer', p.gw || (p.gw = {}), x, y, sx, sy);
    label(p === meW ? 'Sen' : (p.user.name || p.user.username), sx, sy - 128 * z - 8, 12, p === meW ? '#ffe98a' : '#fff'); emoteAt(p, sx, sy - 128 * z - 28);
  }
  // akıcılık ölçümü: kareler uzun süre geç gelirse hafif grafiğe geçilir
  let slowEma = 33; let slowN = 0; let shownAt = 0;
  function setLowQ(on, auto) { lowQ = on; try { localStorage.setItem('sf_lowq', on ? '1' : '0'); } catch { /* yok say */ } resize(); bgKey = ''; if (auto) toast('Oyun daha akıcı olsun diye hafif grafiğe geçildi. Ayarlar\'dan değiştirebilirsin.'); panel?.paint(); }
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    const gap = panel && !mode ? 110 : lowQ ? 40 : 30; if (ts - last < gap || !W) return; // pencere açıkken sahne yavaş yenilenir
    const dt = Math.min(120, ts - last); fdt = dt;
    if (!panel && !lowQ && dt < 500) { if (!shownAt) shownAt = ts; if (ts - shownAt > 4000) { slowEma = slowEma * 0.95 + (ts - last) * 0.05; if (slowEma > 52) { if (++slowN > 90) setLowQ(true, true); } else slowN = Math.max(0, slowN - 2); } }
    let op = null; if (visit) for (const p of peers.values()) if (p.owner) { op = p; break; }
    if (op) { man.x += (op.x - man.x) * Math.min(1, dt / 400); man.y += (op.y - man.y) * Math.min(1, dt / 400); man.go = Math.hypot(op.x - man.x, op.y - man.y) > 0.05; } else stepW(man, dt, 0.0011);
    if (F.pet) stepW(petW, dt, 0.0017); if (meW) walkTo(meW, dt, 0.0016);
    for (const p of peers.values()) { if (p.owner && visit) continue; const d = Math.hypot(p.x - p.dx, p.y - p.dy); p.go = d > 0.05; const s = Math.min(1, dt / 350); p.dx += (p.x - p.dx) * s; p.dy += (p.y - p.dy) * s; }
    last = ts; T = ts; const now = tnow(); const z = cam.z;
    drawBg();
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(cvb, 0, 0); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingQuality = lowQ ? 'medium' : 'high';
    if (statVer !== objVer) buildStatic();
    bubbles = []; lights = []; npcHit = [];
    const dyn = [[man.x + man.y, 0]]; if (F.pet) dyn.push([petW.x + petW.y, 1]);
    (F.vis || []).forEach((v, i) => { if (v.until <= now) return; const [x, y] = spotOf(v, i); const p = Math.min(1, Math.max(0, (now - v.at) / 5000)); const e = 1 - (1 - p) ** 2;
      const vx = gate[0] + (x - gate[0]) * e; const vy = gate[1] + (y - gate[1]) * e; dyn.push([vx + vy, 2, { v, x: vx, y: vy, walking: p < 1 }]); });
    for (const p of peers.values()) { if (p.owner && visit) continue; dyn.push([p.dx + p.dy, 3, p]); }
    if (meW) dyn.push([meW.x + meW.y, 3, meW]);
    dyn.sort((a, b) => a[0] - b[0]);
    let j = 0; const L = statList;
    for (let i = 0; i < L.length; i++) {
      const [d, e] = L[i]; while (j < dyn.length && dyn[j][0] <= d) drawDyn(dyn[j++], now, op);
      if (e.id) drawObj(e, now); else { const [sx, sy] = toScr(e.gx, e.gy); if (sx > -200 && sx < W + 200 && sy > -80 && sy < H + 260) sp(e.k, sx, sy); }
    }
    while (j < dyn.length) drawDyn(dyn[j++], now, op);
    if (mode?.k === 'place') { // yerleştirilen şey: yeşil/kırmızı zemin + yarı saydam görsel
      const Ty = cfg.TYPES[mode.t]; const ok = free(mode.t, mode.x, mode.y, mode.id); mode.ok = ok;
      diamond(mode.x, mode.y, mode.x + Ty.w, mode.y + Ty.h); g.fillStyle = ok ? 'rgba(98,200,70,.55)' : 'rgba(230,60,50,.55)'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
      const [sx, sy] = toScr(mode.x + Ty.w / 2, mode.y + Ty.h / 2); sp(mode.t, sx, sy - 6 * z, 1, 1, 0.9);
    }
    tint();
    if (amb.night > 0.01 && lights.length && !lowQ) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5 * amb.night; for (const [lx, ly, lr] of lights) g.drawImage(GLOW, lx - lr, ly - lr, lr * 2, lr * 2); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    if (amb.season && !lowQ) { const win = amb.season === 'winter'; const n = win ? 46 : 16; // kar, yaprak ya da çiçek yaprağı
      if (win) { g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); for (let i = 0; i < n; i++) { const v = 0.5 + rnd(i, 3); const x = (((rnd(i, 1) * W + T * 0.012 * v + Math.sin(T / 900 + i) * 14) % W) + W) % W; const y = (rnd(i, 2) * H + T * 0.035 * v) % H; const r = 1.4 + rnd(i, 4) * 1.8; g.moveTo(x + r, y); g.arc(x, y, r, 0, 7); } g.fill(); }
      else { for (let i = 0; i < n; i++) { const v = 0.5 + rnd(i, 3); const x = (((rnd(i, 1) * W + T * 0.012 * v + Math.sin(T / 900 + i) * 14) % W) + W) % W; const y = (rnd(i, 2) * H + T * 0.05 * v) % H; const a = T / 500 + i;
        g.setTransform(dpr * Math.cos(a), dpr * Math.sin(a), -dpr * Math.sin(a), dpr * Math.cos(a), dpr * x, dpr * y); g.fillStyle = amb.season === 'spring' ? 'rgba(255,170,200,.9)' : ['#e8892b', '#d4572a', '#e9b23a'][i % 3]; g.beginPath(); g.ellipse(0, 0, 5, 2.6, 0, 0, 7); g.fill(); }
        g.setTransform(dpr, 0, 0, dpr, 0, 0); } }
    const wx = F.wx?.k; // hava durumu: yağmur çizgileri, bulut gölgesi, sıcak hava
    if (wx === 'rain') { g.strokeStyle = 'rgba(210,230,255,.55)'; g.lineWidth = 1.3; g.beginPath(); const n = lowQ ? 40 : 90;
      for (let i = 0; i < n; i++) { const v = 0.7 + rnd(i, 7) * 0.6; const x = ((rnd(i, 5) * W - T * 0.12 * v) % W + W) % W; const y = (rnd(i, 6) * H + T * 0.9 * v) % (H + 40) - 20; g.moveTo(x, y); g.lineTo(x - 4, y + 14); } g.stroke(); }
    else if (wx === 'cloud' && !lowQ) { g.globalAlpha = 0.16; for (let i = 0; i < 3; i++) { const x = ((rnd(i, 9) * W + T * 0.012) % (W + 600)) - 300; const y = rnd(i, 8) * H; g.drawImage(SHADE, x - 260, y - 260, 520, 520); } g.globalAlpha = 1; }
    else if (wx === 'hot' && !lowQ) { g.globalAlpha = 0.35; g.drawImage(SUNB, W * 0.9 - H * 0.9, -40 - H * 0.9, H * 1.8, H * 1.8); g.globalAlpha = 1; }
    for (const [sx, sy, k, o] of bubbles) {
      if (o.info) { font('800 12px "Bricolage Grotesque", system-ui, sans-serif'); const w = g.measureText(o.info).width + 18; g.fillStyle = 'rgba(58,34,12,.88)'; g.beginPath(); g.arc(sx - w / 2 + 12, sy - 12, 12, Math.PI / 2, Math.PI * 1.5); g.arc(sx + w / 2 - 12, sy - 12, 12, -Math.PI / 2, Math.PI / 2); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(o.info, sx, sy - 11.5); } else bubble(sx, sy, k, o);
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
    if (r.farm) { F = r.farm; objVer++; if (F.now) skew = F.now - Date.now(); if ((F.n || cfg.N) !== N) { N = F.n || cfg.N; buildRing(); clampCam(); } }
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
      if (a === 'take' || a === 'collect' || a === 'pick' || a === 'collectAll') SFX.take(); else if (a === 'buy' || a === 'move' || a === 'feed' || a === 'craft' || a === 'animal' || a === 'plantAll' || a === 'fert') SFX.plant(); else if (a === 'water') SFX.water();
      if (a === 'harvest' || a === 'collectAll') tutEv('harvest'); if (a === 'plant' || a === 'plantAll') tutEv('plant');
      if (r.served) toast(`${r.served.who} ${r.served.fast ? 'çok memnun kaldı' : 'memnun kaldı'}: ${r.served.coins} altın + ${r.served.tip} bahşiş${r.served.seed ? `, üstelik ${iname(`s_${r.served.seed}`).toLocaleLowerCase('tr-TR')} hediye etti` : ''}.`);
      if (r.collected?.full) toast('Bazı ürünler depoya sığmadı. Depolarını büyütebilirsin.');
      return r;
    } catch (e) { if (e.data?.farm) apply({ farm: e.data.farm }); SFX.err(); toast(e.message); return null; }
  }));
  const vcall = (path, body, after) => (chain = chain.then(() => api(`/farm/of/${visit.id}/${path}`, { body }).then((r) => { apply(r); after?.(r); }).catch((e) => { SFX.err(); toast(e.message); })));
  const reload = async () => { try { const r = await api(visit ? `/farm/of/${encodeURIComponent(visit.id)}` : '/farm'); apply({ farm: r.farm }); } catch { /* sonraki denemede */ } };
  // ---------- canlı ziyaret ----------
  const sock = state.socket; const owner = visit ? visit.id : state.me?.id;
  const addPeer = (p) => { const old = peers.get(p.id); peers.set(p.id, { ...p, dx: old?.dx ?? p.x, dy: old?.dy ?? p.y }); };
  const LV = {
    'farm:peers': (list) => { peers.clear(); (list || []).forEach(addPeer); const o = (list || []).find((p) => p.owner); if (visit && o) toast(`${o.user.name || o.user.username} şu an çiftliğinde. El sallayabilirsin.`); paintPeers(); },
    'farm:peer': (p) => { const was = peers.has(p.id); addPeer(p); paintPeers(); if (was) return; SFX.pop(2);
      toast(visit ? (p.owner ? `${p.user.name || p.user.username} çiftliğine geldi.` : `${p.user.name || p.user.username} de bu çiftliği geziyor.`) : `${p.user.name || p.user.username} çiftliğine geldi. El salla!`); },
    'farm:pos': ({ id, x, y }) => { const p = peers.get(id); if (p) { p.x = x; p.y = y; } },
    'farm:emote': ({ id, e }) => { const p = peers.get(id); if (!p) return; p.emo = e + 1; p.emoT = T; SFX.pop(3); },
    'farm:gone': ({ id }) => { peers.delete(id); paintPeers(); },
  };
  const joinLive = () => { const w = meW || man; sock?.emit('farm:join', { owner, x: w.x, y: w.y }); };
  if (sock && owner) { Object.entries(LV).forEach(([ev, fn]) => sock.on(ev, fn)); sock.on('connect', joinLive); joinLive(); }
  let lastSent = '';
  const posT = setInterval(() => { const w = meW || man; const k = `${w.x.toFixed(2)},${w.y.toFixed(2)}`; if (sock?.connected && k !== lastSent) { lastSent = k; sock.emit('farm:pos', { x: w.x, y: w.y }); } }, 450);
  const unLive = () => { clearInterval(posT); if (!sock) return; Object.entries(LV).forEach(([ev, fn]) => sock.off(ev, fn)); sock.off('connect', joinLive); sock.emit('farm:leave'); };

  // ---------- üst bilgi ----------
  const badge = (k, v) => { const b = root.querySelector(`[data-b="${k}"]`); if (!b) return; b.hidden = !v; if (typeof v === 'number') b.textContent = v; };
  let wxKey = '';
  function hud() {
    const w = F.wx; if (w) { const k = `${w.k}${fmt(w.until - tnow())}`; if (k !== wxKey) { wxKey = k; const el = root.querySelector('.sf-wx'); el.innerHTML = `${WXI[w.k]}<b>${esc(cfg.WX[w.k])}</b>`; el.className = `sf-pill sf-wx ${w.k}`; el.title = `${cfg.WX[w.k]} · ${fmt(w.until - tnow())} sonra ${cfg.WX[w.next].toLocaleLowerCase('tr-TR')}`; } }
    paintPeers();
    if (visit) { root.querySelector('.sf-helps').textContent = `${F.helpsLeft}/${cfg.HELPS}`; root.querySelector('.sf-coin b').textContent = (F.myCoins || 0).toLocaleString('tr-TR'); badge('vstall', (F.stall || []).length); root.querySelector('.sf-vcoop').hidden = !F.canCoop;
      root.querySelector('.sf-vpair').hidden = !F.pair; badge('vpair', !!F.pair && !F.pair.me); root.querySelector('.sf-vboat').hidden = !F.boat || !!F.boat.sent; badge('vboat', F.boat ? F.boat.crates.filter((c) => !c.done).length : 0); return; }
    root.querySelector('.sf-lvn').textContent = F.lvl; root.querySelector('.sf-xp i').style.width = `${Math.min(100, (F.xp / F.need) * 100)}%`; root.querySelector('.sf-xp small').textContent = `${F.xp}/${F.need}`;
    root.querySelector('.sf-coin b').textContent = F.coins.toLocaleString('tr-TR'); root.querySelector('.sf-jet b').textContent = (F.jeton || 0).toLocaleString('tr-TR');
    const B = F.stores?.barn || { used: 0, cap: F.cap }; const full = Object.values(F.stores || {}).some((s) => s && s.used >= s.cap - 1);
    const bp = root.querySelector('.sf-barnp'); bp.querySelector('b').textContent = `${B.used}/${B.cap}`; bp.classList.toggle('full', full);
    badge('orders', F.orders.filter((x) => !x.wait && hasAll(x.need)).length + (F.vis || []).filter((v) => v.until > tnow() && hasAll({ [v.k]: v.n })).length);
    const qd = F.quests.list.every((x) => x.got >= x.n) && !F.quests.claimed; const ev = F.event && F.event.steps.some((x) => !x.got && F.event.pts >= x.pts);
    badge('hubG', qd || !!F.daily?.can || F.wheel.n === 0 || F.ach.some((x) => x.got >= x.n && !x.claimed) || !!ev);
    badge('hubS', !!F.coop && Object.entries(F.coop.need).some(([k, v]) => (F.coop.got[k] || 0) < v && inv()[k] > 0));
    root.querySelector('.sf-boatb').hidden = !F.boat; badge('boat', !!F.boat && !F.boat.sent && F.boat.crates.every((c) => c.done));
  }
  let peersKey = '';
  function paintPeers() { // üst çubukta şu an çiftlikte olanlar
    const list = [...peers.values()].filter((p) => !p.owner || visit); const eb = root.querySelector('.sf-emob'); if (eb) eb.hidden = !visit && !list.length;
    const k = list.map((p) => p.id).join(); if (k === peersKey) return; peersKey = k;
    const el = root.querySelector('.sf-peers'); if (!el) return;
    el.innerHTML = list.length ? `${list.slice(0, 4).map((p) => `<img src="${esc(p.user.avatar)}" alt="" title="${esc(p.user.name || p.user.username)}${p.owner ? ' · çiftliğin sahibi' : ''}" class="${p.owner ? 'own' : ''}">`).join('')}${list.length > 4 ? `<b>+${list.length - 4}</b>` : ''}<small>burada</small>` : '';
  }
  // bekleyen işler: "Hepsini topla" düğmesi için
  function readyCount(now) {
    let n = 0;
    for (const o of F.objs) { if (o.t === 'plot' && cropReady(o, now)) n++; else if (cfg.PROD[o.t] && now - (o.at || 0) >= cfg.PROD[o.t].t) n++; }
    Object.entries(cfg.PENS).forEach(([p, P]) => { (F.pens[p] || []).forEach((a) => { if (a.at && now - a.at >= P.t) n++; }); });
    Object.values(F.q || {}).forEach((q) => { q.forEach((x) => { if (x.end <= now) n++; }); });
    return n;
  }
  function hintText() {
    if (visit) return F.helpsLeft > 0 ? 'Büyüyen ekinlere dokunup sula. Boş bir yere dokunursan çiftçin oraya yürür.' : 'Bugünlük yardım hakkın bitti. Boş bir yere dokunursan çiftçin oraya yürür.';
    if (F.lvl > 3 || tutOn()) return ''; const now = tnow(); const plots = F.objs.filter((o) => o.t === 'plot');
    if (plots.some((o) => cropReady(o, now))) return 'Olgun ekinlerin üzerinde parmağını kaydır, hasat et.';
    if (plots.some((o) => !o.crop)) return 'Boş tarlaya dokun, ekin seç ve kaydırarak ek.';
    if (F.orders.some((o) => !o.wait && hasAll(o.need))) return 'Hazır siparişin var. Sipariş panosuna dokun.';
    return '';
  }
  let botKey = '';
  function paintBot() {
    let html = ''; let key = '';
    if (mode?.k === 'plant' || mode?.k === 'tool') {
      const fert = inv().fert || 0; const tool = mode.k === 'tool' ? mode.tool : null;
      key = `p${mode.crop}${tool}${F.lvl}${F.coins}${fert}${cfg.RARE.map((k) => inv()[`s_${k}`] || 0).join()}${F.wx?.k}`;
      const wxk = F.wx?.k; const wxn = wxk === 'rain' ? ' · yağmur: %25 hızlı' : wxk === 'hot' ? ' · sıcak: sulamayı unutma' : '';
      html = `<div class="sf-seeds"><div class="sf-sh"><span>${tool === 'water' ? 'Büyüyen ekinlerin üzerinde parmağını kaydır, sula' : tool === 'fert' ? 'Büyüyen ekinlere gübre ver: altın yıldızlı çıkarlar' : `Ekin seç, sonra boş tarlaların üzerinde parmağını kaydır${wxn}`}</span><button class="sf-x" data-a="mode0" aria-label="Kapat">${icon('close')}</button></div><div class="sf-sl">
        <button class="sf-seed tool ${tool === 'water' ? 'on' : ''}" data-a="tool" data-k="water">${spr('i_can', 40)}<b>Sula</b><small>Altın ürün şansı</small></button>
        <button class="sf-seed tool ${tool === 'fert' ? 'on' : ''} ${fert ? '' : 'lock'}" data-a="tool" data-k="fert">${spr('i_fert', 40)}<b>Gübre</b><small>${fert ? `${fert} torba` : 'Kompostta üret'}</small></button>
        ${Object.entries(cfg.CROPS).map(([k, c]) => {
        const lock = c.lvl > F.lvl; const sn = c.rare ? inv()[`s_${k}`] || 0 : 0; const dis = lock || (c.rare && !sn);
        return `<button class="sf-seed ${mode.crop === k && !tool ? 'on' : ''} ${dis ? 'lock' : ''} ${c.rare ? 'rare' : ''}" data-a="seed" data-k="${k}" ${dis ? 'disabled' : ''}>${spr(`i_${k}`, 40)}<b>${esc(c.name)}</b><small>${lock ? `Seviye ${c.lvl}` : c.rare ? (sn ? `${fmt(c.t)} · ${sn} tohum` : 'Tohum yok · takas et') : `${fmt(c.t)}${c.seed ? ` · ${c.seed} altın` : ''}`}</small></button>`; }).join('')}</div></div>`;
    } else if (mode?.k === 'place') {
      const Ty = cfg.TYPES[mode.t]; const canRm = mode.id && (Ty.kind === 'decor' || Ty.kind === 'plot' || Ty.kind === 'prod'); key = `l${mode.t}${mode.id || ''}`;
      html = `<div class="sf-place"><button class="sf-btn ghost" data-a="placeNo">Vazgeç</button><span class="sf-pl">${esc(Ty.name)}${mode.id ? '' : mode.stock ? '<small>Koleksiyondan</small>' : Ty.gem ? `<small>${spr('i_jeton', 14)} ${Ty.gem} jeton</small>` : `<small>${spr('i_coin', 14)} ${Ty.cost}</small>`}<em>Sürükleyerek yerini seç</em></span>${canRm ? `<button class="sf-btn red" data-a="placeRm">Kaldır</button>` : ''}<button class="sf-btn" data-a="placeOk">${mode.id ? 'Taşı' : 'Yerleştir'}</button></div>`;
    } else if (mode?.k === 'edit') { key = 'e'; html = `<div class="sf-place"><span class="sf-pl">Düzenleme modu<em>Taşımak ya da kaldırmak için bir şeye dokun</em></span><button class="sf-btn" data-a="mode0">Bitti</button></div>`;
    } else {
      const o = !visit && info ? F.objs.find((x) => x.id === info.id && x.t === 'plot' && x.crop) : null; const left = o ? cropT(o) - (tnow() - o.at) : 0;
      if (o && left > 0) { const fert = inv().fert || 0; key = `r${o.id}${fmt(left)}${o.w}${o.f}${fert}`;
        html = `<div class="sf-place"><span class="sf-pl">${esc(cfg.CROPS[o.crop].name)}<em>${fmt(left)} sonra olgunlaşır${o.dry ? ' · susuz, sula' : o.f ? ' · gübreli: altın çıkacak' : o.w ? ' · sulandı' : ''}</em></span>
          ${o.w ? '' : `<button class="sf-btn sm" data-a="water1" data-id="${o.id}">${spr('i_can', 18)} Sula</button>`}${o.f || !fert ? '' : `<button class="sf-btn sm gold" data-a="fert1" data-id="${o.id}">${spr('i_fert', 18)} Gübrele</button>`}
          <button class="sf-btn sm violet" data-a="rush" data-id="${o.id}">Hızlandır · ${spr('i_jeton', 16)} ${rushCost(left)}</button></div>`; }
      else {
        const h = hintText(); const now = tnow(); const rc = visit || tutOn() ? 0 : readyCount(now); const empty = visit ? 0 : F.objs.filter((x) => x.t === 'plot' && !x.crop).length;
        const dry = visit ? 0 : F.objs.filter((x) => x.t === 'plot' && x.dry && !cropReady(x, now)).length;
        let crop = 'wheat'; try { const c = localStorage.getItem('sf_crop'); if (cfg.CROPS[c] && cfg.CROPS[c].lvl <= F.lvl && !cfg.CROPS[c].rare) crop = c; } catch { /* yok say */ }
        const bulk = !visit && !tutOn() && (rc || dry || (empty && F.lvl >= 2)) ? `<div class="sf-bulk">${rc ? `<button class="sf-btn sm gold" data-a="collectAll">Hepsini topla · ${rc}</button>` : ''}${dry ? `<button class="sf-btn sm" data-a="waterAll">${spr('i_can', 18)} Hepsini sula · ${dry}</button>` : ''}${empty && F.lvl >= 2 ? `<button class="sf-btn sm" data-a="plantAll" data-k="${crop}">${spr(`i_${crop}`, 18)} Hepsine ek · ${empty}</button>` : ''}</div>` : '';
        key = `h${h}${rc}${dry}${empty}${crop}`; html = `${bulk}${h ? `<div class="sf-hint">${esc(h)}</div>` : ''}`;
      }
    }
    if (key !== botKey) { botKey = key; bot.innerHTML = html; }
  }

  // ---------- paneller ----------
  let panel = null; let ps = {};
  const closePanel = () => { panel = null; layer.innerHTML = ''; paintTut(); };
  function openPanel(title, body, live) {
    layer.innerHTML = `<div class="sf-dim" data-a="close"></div><section class="sf-panel"><header class="sf-ph"><b>${esc(title)}</b><button class="sf-x" data-a="close" aria-label="Kapat">${icon('close')}</button></header><div class="sf-pb"></div></section>`;
    const el = layer.querySelector('.sf-pb'); tutKey = 'x'; root.querySelector('.sf-tut').hidden = true; root.querySelectorAll('.sf-tut-hl').forEach((x) => x.classList.remove('sf-tut-hl')); let prev = '';
    panel = { live, paint() { minis.clear(); const html = body(); if (html === prev) return; prev = html; const st = el.scrollTop; el.innerHTML = html; el.scrollTop = st; el.querySelectorAll('canvas[data-mini]').forEach((c) => { const s = minis.get(c.dataset.mini); if (s) lazyMini(c, s, { anim: false }); }); } }; panel.paint();
  }
  const needs = (items) => Object.entries(items).map(([k, n]) => { const h = inv()[k] || 0; return `<span class="sf-need ${h >= n ? 'ok' : 'no'}">${spr(`i_${k}`, 26)}<b>${Math.min(h, 99)}/${n}</b></span>`; }).join('');
  const visRow = (v) => { const now = tnow(); const fast = now - v.at <= cfg.VIS_FAST; const ok = hasAll({ [v.k]: v.n });
    return `<div class="sf-vis"><span class="sf-vav">${spr(v.look, 50)}</span><div class="sf-ri"><b>${esc(v.who)}</b><small>${v.n} ${esc(iname(v.k).toLocaleLowerCase('tr-TR'))} istiyor · ${fmt(v.until - now)} sonra gider</small>
      <div class="sf-on">${needs({ [v.k]: v.n })}<span class="sf-pay">${spr('i_coin', 18)}<b>${v.coins}</b>${fast ? `<em class="tip">+ bahşiş · ${fmt(v.at + cfg.VIS_FAST - now)}</em>` : '<em>+ küçük bahşiş</em>'}</span></div></div>
      <div class="sf-va"><button class="sf-btn sm" data-a="serve" data-id="${v.id}" ${ok ? '' : 'disabled'}>Ver</button><button class="sf-btn sm ghost" data-a="shoo" data-id="${v.id}">Uğurla</button></div></div>`; };
  const visList = () => (F.vis || []).filter((v) => v.until > tnow());
  const ordersBody = () => `${visList().length ? `<h3 class="sf-h">Kasaba ziyaretçileri</h3><div class="sf-recs">${visList().map(visRow).join('')}</div><p class="sf-note">Ziyaretçiye istediğini ${Math.round(cfg.VIS_FAST / 60000)} dakika içinde verirsen çok memnun kalır, büyük bahşiş bırakır; bazen nadir tohum da hediye eder.</p><h3 class="sf-h">Sipariş panosu</h3>` : ''}
    <div class="sf-ords">${F.orders.map((o) => (o.wait ? `<div class="sf-ord wait"><span>Yeni sipariş yolda</span><b>${fmt(o.wait - tnow())}</b></div>`
    : `<div class="sf-ord"><div class="sf-ow">${esc(o.who)}</div><div class="sf-on">${needs(o.need)}</div><div class="sf-or"><span>${spr('i_coin', 20)}<b>${o.coins}</b></span><span>${STAR}<b>${o.xp}</b></span></div>
      <div class="sf-oa"><button class="sf-btn sm ghost" data-a="skip" data-id="${o.id}">Geç</button><button class="sf-btn sm" data-a="deliver" data-id="${o.id}" ${hasAll(o.need) ? '' : 'disabled'}>Teslim et</button></div></div>`)).join('')}</div>
    <p class="sf-note">Siparişi teslim edince altın ve deneyim kazanırsın. Geçtiğin siparişin yerine 3 dakikada yenisi gelir.</p>`;
  // depolar: ambar, silo (ekinler) ve kiler (işlenmiş ürünler). Silo ya da kiler yoksa o ürünler ambarda durur.
  const SNAME = { barn: 'Ambar', silo: 'Silo', cellar: 'Kiler', seed: 'Tohumlar' };
  const storeOf = (k) => { const c = cfg.CAT[k]; if (c === null) return 'seed'; return c !== 'barn' && !F.stores?.[c] ? 'barn' : c || 'barn'; };
  const barnBody = () => {
    const S = F.stores || { barn: { used: 0, cap: F.cap, up: F.capUp } }; const tabs = ['barn', 'silo', 'cellar', 'seed'].filter((s) => s === 'barn' || (s === 'seed' ? Object.keys(inv()).some((k) => k.startsWith('s_')) : true));
    const cur = tabs.includes(ps.st) ? ps.st : 'barn'; const items = Object.entries(inv()).filter(([k]) => storeOf(k) === cur).sort((a, b) => (cfg.CAT[a[0]] === 'silo') - (cfg.CAT[b[0]] === 'silo') || a[0].localeCompare(b[0]));
    const sel = ps.sel && inv()[ps.sel] && storeOf(ps.sel) === cur ? ps.sel : null; if (sel) ps.n = Math.min(Math.max(1, ps.n || 1), inv()[sel]);
    const st = S[cur]; const lv = cur === 'silo' ? cfg.TYPES.silo : cur === 'cellar' ? cfg.TYPES.cellar : null;
    const head = cur === 'seed' ? `<p class="sf-note top">Nadir tohumlar yer kaplamaz. Senin yörenin tohumu ${esc(iname(`s_${F.home}`))}; diğerlerini komşularınla takas edebilirsin.</p>`
      : st ? `<div class="sf-cap"><div class="sf-capb"><i style="width:${Math.min(100, (st.used / st.cap) * 100)}%"></i><b>${st.used}/${st.cap}</b></div><button class="sf-btn sm gold" data-a="storeUp" data-s="${cur}" ${F.coins >= st.up ? '' : 'disabled'}>Büyüt · ${spr('i_coin', 14)} ${st.up}</button></div>`
        : `<div class="sf-exp">${spr(cur, 46)}<span class="sf-pl">${SNAME[cur]} henüz yok<small>${cur === 'silo' ? 'Ekinlerin siloda ayrı durur, ambarda yer açılır.' : 'İşlenmiş ürünlerin kilerde ayrı durur, ambarda yer açılır.'}${lv.lvl > F.lvl ? ` Seviye ${lv.lvl} gerekli.` : ''}</small></span><button class="sf-btn sm" data-a="placeT" data-t="${cur}" ${lv.lvl > F.lvl || F.coins < lv.cost ? 'disabled' : ''}>Kur · ${spr('i_coin', 14)} ${lv.cost}</button></div>`;
    const where = cur === 'barn' ? (S.silo ? (S.cellar ? '' : ' İşlenmiş ürünler kiler kurulana kadar burada.') : ' Silo kurulana kadar ekinler de burada.') : '';
    return `<div class="sf-tabs top">${tabs.map((s) => `<button class="${cur === s ? 'on' : ''}" data-a="stab" data-k="${s}">${SNAME[s]}${S[s] ? ` · ${S[s].used}/${S[s].cap}` : ''}</button>`).join('')}</div>${head}
      ${items.length ? `<div class="sf-inv">${items.map(([k, n]) => `<button class="sf-it ${sel === k ? 'on' : ''}" data-a="sel" data-k="${k}">${spr(ik(k), 44)}<b>${n}</b><small>${esc(iname(k))}</small></button>`).join('')}</div>` : `<p class="sf-empty">${cur === 'barn' ? 'Ambarın boş. Ekin biç, ürün topla.' : st || cur === 'seed' ? 'Burası şimdilik boş.' : ''}</p>`}
      ${sel ? `<div class="sf-sell"><span class="sf-pl">${esc(iname(sel))}<small>tanesi ${cfg.ITEMS[sel][1]} altın</small></span><div class="sf-stp"><button data-a="sellN" data-d="-1" aria-label="Azalt">−</button><b>${ps.n}</b><button data-a="sellN" data-d="1" aria-label="Artır">+</button><button data-a="sellN" data-d="999">Hepsi</button></div><button class="sf-btn gold" data-a="sellDo">Sat · ${spr('i_coin', 16)} ${ps.n * cfg.ITEMS[sel][1]}</button></div>`
    : items.length ? `<p class="sf-note">Satmak için bir ürüne dokun. Siparişler ve kasaba ziyaretçileri pazardan daha çok kazandırır. Altın yıldızlı ürünler daha pahalıdır.${where}</p>` : ''}`;
  };
  const shopBody = () => {
    const cnt = (t) => F.objs.filter((o) => o.t === t).length; const st = F.stock || {};
    const tile = ([t, Ty]) => { const have = st[t] || 0; const lock = Ty.lvl > F.lvl; const own = (Ty.kind === 'build' || Ty.kind === 'pen' || Ty.kind === 'store') && cnt(t) > 0; const lim = t === 'plot' ? F.maxPlots : Ty.max; const full = lim != null && cnt(t) >= lim; const dis = !have && (lock || own || full || !!Ty.special);
      return `<button class="sf-shop ${dis ? 'dis' : ''}" data-a="shop" data-t="${t}" ${dis ? 'disabled' : ''}><span class="sf-shi">${spr(t, 58)}</span><b>${esc(Ty.name)}</b>${have ? `<small class="ok">Yerleştir · ${have}</small>` : Ty.special ? `<small class="lk">${esc(Ty.special)}</small>` : lock ? `<small class="lk">Seviye ${Ty.lvl}</small>` : own ? '<small class="lk">Kuruldu</small>' : full ? `<small class="lk">${cnt(t)}/${lim}</small>` : Ty.gem ? `<small class="jt">${spr('i_jeton', 15)} ${Ty.gem}</small>` : `<small>${spr('i_coin', 14)} ${Ty.cost}</small>`}</button>`; };
    const E = Object.entries(cfg.TYPES).filter(([, v]) => v.kind !== 'fixed'); const ex = F.exp; const sec = (title, f) => `<h3 class="sf-h">${title}</h3><div class="sf-shopg">${E.filter(([, v]) => f(v)).map(tile).join('')}</div>`;
    return `${ex ? `<div class="sf-exp">${spr('fence_x', 44)}<span class="sf-pl">Araziyi genişlet<small>${ex.n}×${ex.n} kare${ex.lvl > F.lvl ? ` · Seviye ${ex.lvl} gerekli` : ''}</small></span><button class="sf-btn sm gold" data-a="expand" ${ex.lvl > F.lvl || F.coins < ex.cost ? 'disabled' : ''}>${spr('i_coin', 14)} ${ex.cost}</button></div>` : ''}
      ${sec('Tarla ve üretim', (v) => v.kind !== 'decor')}${sec('Süsler', (v) => v.kind === 'decor' && !v.gem && !v.special)}${sec('Jetonla alınan özel süsler', (v) => !!v.gem)}
      <h3 class="sf-h">Evcil hayvan</h3><div class="sf-shopg">${Object.entries(cfg.PETS).map(([k, P]) => { const on = F.pet?.t === k; const lock = P.lvl > F.lvl; return `<button class="sf-shop ${lock ? 'dis' : ''}" data-a="petBuy" data-t="${k}" ${lock || on ? 'disabled' : ''}><span class="sf-shi">${spr(k, 54)}</span><b>${esc(P.name)}</b>${on ? '<small class="ok">Seninle</small>' : lock ? `<small class="lk">Seviye ${P.lvl}</small>` : `<small>${spr('i_coin', 14)} ${P.cost}</small>`}</button>`; }).join('')}</div>
      <h3 class="sf-h">Çiftçi kıyafeti</h3><div class="sf-shopg">${Object.entries(cfg.FITS).map(([k, X]) => { const on = (F.fit || 'a') === k; const own = F.fits[k]; const plusLock = X.plus && !F.plus; return `<button class="sf-shop ${X.plus ? 'plus' : ''}" data-a="${plusLock ? 'plusInfo' : 'fit'}" data-k="${k}" ${on ? 'disabled' : ''}><span class="sf-shi">${spr(k === 'a' ? 'farmer' : `farmer_${k}`, 56)}</span><b>${esc(X.name)}</b>${on ? '<small class="ok">Üzerinde</small>' : X.plus ? `<small class="pl">${plusLock ? 'SwipeUp+ özel' : 'SwipeUp+ · Giy'}</small>` : own ? '<small class="ok">Giy</small>' : X.gem ? `<small class="jt">${spr('i_jeton', 15)} ${X.gem}</small>` : `<small>${spr('i_coin', 14)} ${X.cost}</small>`}</button>`; }).join('')}</div>
      ${sec('Koleksiyon', (v) => !!v.special)}
      <p class="sf-note">Koleksiyon parçaları satın alınmaz, etkinliklerle kazanılır. Jetonlu süsler yalnızca görünüş içindir; oyunda öne geçirmez.</p>`;
  };
  const buildBody = (b) => () => {
    const q = F.q[b] || []; const Ty = cfg.TYPES[b]; const now = tnow();
    const slots = Array.from({ length: Ty.slots }, (_, i) => { const it = q[i]; if (!it) return '<div class="sf-slot"><small>Boş</small></div>'; const left = it.end - now; return `<div class="sf-slot ${left <= 0 ? 'rdy' : 'run'}">${spr(`i_${it.r}`, 38)}<small>${left > 0 ? fmt(left) : 'Hazır'}</small></div>`; }).join('');
    const rdy = q.length && q[0].end <= now; const ul = F.bu?.[b] || 0; const U = cfg.UPG[ul]; const K = ul ? cfg.UPG[ul - 1].k : 1;
    const up = `<div class="sf-exp up"><span class="sf-pl">${ul ? `Yükseltme ${ul}/${cfg.UPG.length}` : 'Yükseltilmemiş'}<small>${ul ? `Üretim %${Math.round((1 - K) * 100)} daha hızlı` : 'Odun ve taşla üretimi hızlandır'}</small></span>${U ? `<span class="sf-on"><span class="${(inv().wood || 0) >= U.wood ? 'ok' : ''}">${spr('i_wood', 18)} ${inv().wood || 0}/${U.wood}</span><span class="${(inv().stone || 0) >= U.stone ? 'ok' : ''}">${spr('i_stone', 18)} ${inv().stone || 0}/${U.stone}</span></span><button class="sf-btn sm gold" data-a="upB" data-b="${b}" ${(inv().wood || 0) >= U.wood && (inv().stone || 0) >= U.stone && F.coins >= U.coins ? '' : 'disabled'}>${spr('i_coin', 14)} ${U.coins}</button>` : '<small class="ok">En üst seviye</small>'}</div>`;
    return `<div class="sf-q">${slots}${q.length && !rdy ? `<button class="sf-btn sm violet" data-a="rushB" data-b="${b}">Hızlandır · ${spr('i_jeton', 16)} ${rushCost(q[0].end - now)}</button>` : `<button class="sf-btn gold" data-a="takeB" data-b="${b}" ${rdy ? '' : 'disabled'}>Ürünü al</button>`}</div>
      <div class="sf-recs">${Object.entries(cfg.RECIPES[b]).map(([k, r]) => { const lock = r.lvl > F.lvl; const ok = !lock && hasAll(r.in) && q.length < Ty.slots;
        return `<div class="sf-rec ${lock ? 'lock' : ''}">${spr(`i_${k}`, 46)}<div class="sf-ri"><b>${esc(cfg.ITEMS[k][0])}${r.out > 1 ? ` ×${r.out}` : ''}</b><small>${fmt(Math.round(r.t * K))} · ${STAR} ${r.xp}</small><div class="sf-on">${needs(r.in)}</div></div>${lock ? `<small class="lk">Seviye ${r.lvl}</small>` : `<button class="sf-btn sm" data-a="craft" data-b="${b}" data-r="${k}" ${ok ? '' : 'disabled'}>Üret</button>`}</div>`; }).join('')}</div>${up}`;
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
    return `<div class="sf-q">${Array.from({ length: F.stallSlots || cfg.STALL_SLOTS }, (_, i) => { const x = st[i]; return x ? `<button class="sf-slot run" data-a="stallCancel" data-id="${x.id}">${spr(`i_${x.k}`, 32)}<small>×${x.n} · ${x.price}</small></button>` : '<div class="sf-slot"><small>Boş</small></div>'; }).join('')}</div>
      ${st.length >= (F.stallSlots || cfg.STALL_SLOTS) ? '' : Object.keys(inv()).length ? `<h3 class="sf-h">Satışa koyacağın ürünü seç</h3><div class="sf-inv">${grid(sel)}</div>
        ${sel ? `<div class="sf-sell two"><span class="sf-pl">${esc(cfg.ITEMS[sel][0])}<small>pazarda tanesi ${base} altın</small></span><div class="sf-stp"><button data-a="stN" data-d="-1" aria-label="Azalt">−</button><b>${ps.n}</b><button data-a="stN" data-d="1" aria-label="Artır">+</button></div>
          <span class="sf-pl">Fiyatın<small>en çok ${ps.n * base * 2} altın</small></span><div class="sf-stp"><button data-a="stP" data-d="-1" aria-label="Azalt">−</button><b>${ps.price}</b><button data-a="stP" data-d="1" aria-label="Artır">+</button></div>
          <button class="sf-btn gold" data-a="stallPut">Tezgâha koy · ${spr('i_coin', 16)} ${ps.price}</button></div>` : ''}` : '<p class="sf-empty">Ambarın boş. Önce ürün topla.</p>'}
      <p class="sf-note">Tezgâhındaki ürünleri çiftliğini gezen komşuların satın alır, altını sana gelir. Geri almak için tezgâhtaki ürüne dokun.${F.plus ? ' SwipeUp+ üyesi olduğun için tezgâhında 2 ek yer var.' : ' SwipeUp+ üyelerinin tezgâhında 2 ek yer olur.'}</p>`; };
  const vstallBody = () => { const st = F.stall || [];
    return st.length ? `<div class="sf-recs">${st.map((x) => `<div class="sf-rec">${spr(`i_${x.k}`, 44)}<div class="sf-ri"><b>${esc(cfg.ITEMS[x.k][0])} ×${x.n}</b><small>pazar değeri ${x.n * cfg.ITEMS[x.k][1]} altın</small></div><button class="sf-btn sm gold" data-a="vbuy" data-id="${x.id}" ${F.myCoins >= x.price ? '' : 'disabled'}>${spr('i_coin', 14)} ${x.price}</button></div>`).join('')}</div><p class="sf-note">Aldığın ürün ambarına gider.</p>` : '<p class="sf-empty">Tezgâh şu an boş.</p>'; };
  const giftBody = () => { if (F.gifted) return '<p class="sf-empty">Bugünkü hediyeni gönderdin. Yarın yine gönderebilirsin.</p>';
    const sel = ps.sel && inv()[ps.sel] ? ps.sel : null; if (sel) ps.n = Math.min(Math.max(1, ps.n || 1), 3, inv()[sel]);
    return `${Object.keys(inv()).length ? `<div class="sf-inv">${grid(sel)}</div>` : '<p class="sf-empty">Ambarında gönderecek ürün yok.</p>'}
      ${sel ? `<div class="sf-sell"><span class="sf-pl">${esc(cfg.ITEMS[sel][0])}<small>en çok 3 tane</small></span><div class="sf-stp"><button data-a="gN" data-d="-1" aria-label="Azalt">−</button><b>${ps.n}</b><button data-a="gN" data-d="1" aria-label="Artır">+</button></div><button class="sf-btn" data-a="giftSend">Hediyeyi gönder</button></div>` : ''}
      <p class="sf-note">Günde bir hediye gönderebilirsin. Yazışıyorsanız hediyen sohbetinize de düşer.</p>`; };
  const bar = (got, n) => `<div class="sf-capb sm"><i style="width:${Math.min(100, (got / n) * 100)}%"></i><b>${got}/${n}</b></div>`;
  const prize = (P, sz = 22) => `${P.coins ? `${spr('i_coin', sz)}<b>${P.coins}</b>` : ''}${P.item ? `${spr(`i_${P.item[0]}`, sz)}<b>×${P.item[1]}</b>` : ''}${P.xp ? `${STAR}<b>${P.xp}</b>` : ''}${P.seed ? `${spr(`i_s_${F.home || 'lavender'}`, sz)}<b>×${P.seed}</b>` : ''}`;
  const questsBody = () => { const Q = F.quests; const all = Q.list.every((x) => x.got >= x.n);
    return `<div class="sf-recs">${Q.list.map((x) => `<div class="sf-rec ${x.got >= x.n ? 'fin' : ''}"><div class="sf-ri"><b>${esc(cfg.QUESTS[x.k])}</b>${bar(x.got, x.n)}</div>${x.got >= x.n ? '<small class="ok">Tamam</small>' : ''}</div>`).join('')}
      <div class="sf-rec chest">${spr('i_chest', 46)}<div class="sf-ri"><b>Görev sandığı</b><small class="sf-on"><span>${spr('i_coin', 16)} ${Q.coins}</span><span>${STAR} ${Q.xp}</span></small></div><button class="sf-btn sm gold" data-a="questClaim" ${all && !Q.claimed ? '' : 'disabled'}>${Q.claimed ? 'Açıldı' : 'Sandığı aç'}</button></div></div>
      <p class="sf-note">Görevler her gün yenilenir. Üçünü de bitirince sandık açılır.</p>`; };
  const achBody = () => `<div class="sf-recs">${[...F.ach].sort((x, y) => (y.got >= y.n && !y.claimed) - (x.got >= x.n && !x.claimed) || x.claimed - y.claimed).map((x) => { const done = x.got >= x.n; return `<div class="sf-rec ${done ? '' : 'lock'} ${x.claimed ? 'fin' : ''}">${spr('i_medal', 40)}<div class="sf-ri"><b>${esc(x.name)}</b><small>${esc(x.desc)}</small>${x.claimed ? '' : bar(x.got, x.n)}</div>${x.claimed ? '<small class="ok">Rozet alındı</small>' : `<button class="sf-btn sm gold" data-a="achClaim" data-k="${x.k}" ${done ? '' : 'disabled'}>${spr('i_coin', 14)} ${x.coins}</button>`}</div>`; }).join('')}</div>
    <p class="sf-note">Aldığın rozetlerin sayısı SwipeUp profilinde çiftlik düğmende görünür.</p>`;
  const wheelBody = () => { const n = F.wheel.n; const W8 = cfg.WHEEL; const fr = F.wheel.free || 1;
    return `<div class="sf-wh"><div class="sf-wheel"><i style="transform:rotate(${ps.deg || 0}deg)">${W8.map((P, i) => `<span style="transform:rotate(${i * 45 + 22.5}deg) translateY(-66px)">${prize(P, 24)}</span>`).join('')}</i><em></em></div>
      <div class="sf-whr"><b>Şans çarkı</b><small>${fr > 1 ? `SwipeUp+ üyesi olarak her gün ${fr} çevirme ücretsiz.` : 'Her gün bir çevirme ücretsiz. SwipeUp+ üyelerine bir çevirme daha ücretsiz.'} Sonraki çevirme ${cfg.SPIN_GEM} jeton.</small>
      <button class="sf-btn ${n === fr ? 'violet' : 'gold'}" data-a="spin" ${n > fr || ps.spinning ? 'disabled' : ''}>${n < fr ? (n ? 'Ücretsiz çevir (SwipeUp+)' : 'Ücretsiz çevir') : n === fr ? `Tekrar çevir · ${spr('i_jeton', 16)} ${cfg.SPIN_GEM}` : 'Yarın yine gel'}</button></div></div>`; };
  const eventBody = () => { const E = F.event; if (!E) return '<p class="sf-empty">Şu an şenlik yok.</p>';
    return `<div class="sf-rk"><span><b>${esc(E.name)}</b> · bitmesine ${fmtD(E.ends - tnow())}</span><span>Şenlik puanın <b>${E.pts}</b></span></div>
      <div class="sf-recs">${E.steps.map((x, i) => `<div class="sf-rec ${x.got ? 'fin' : ''}">${x.decor ? spr(x.decor, 46) : spr('i_coin', 40)}<div class="sf-ri"><b>${x.decor ? esc(cfg.TYPES[x.decor].name) : `${x.coins} altın`}</b>${x.got ? '' : bar(Math.min(E.pts, x.pts), x.pts)}</div>${x.got ? '<small class="ok">Alındı</small>' : `<button class="sf-btn sm gold" data-a="evClaim" data-i="${i}" ${E.pts >= x.pts ? '' : 'disabled'}>Al</button>`}</div>`).join('')}</div>
      <p class="sf-note">Şenlik puanı: her sipariş 1, günlük görev sandığı 2, tekne 3 puan. Şenlik süsleri yalnızca bu dönemde kazanılır.</p>`; };
  const crateRow = (c, i, a, mine) => { const have = inv()[c.k] || 0; return `<div class="sf-rec ${c.done ? 'fin' : ''}">${spr(`i_${c.k}`, 42)}<div class="sf-ri"><b>${esc(cfg.ITEMS[c.k][0])} ×${c.n}</b><small>${c.done ? (c.by ? `${esc(c.by)} doldurdu` : 'Dolu') : `Ambarında ${have}`}</small></div>${c.done ? '<small class="ok">Tamam</small>' : `<button class="sf-btn sm" data-a="${a}" data-i="${i}" ${have >= c.n ? '' : 'disabled'}>Doldur${mine ? '' : ` · ${spr('i_coin', 14)} ${c.n * cfg.ITEMS[c.k][1]}`}</button>`}</div>`; };
  const boatBody = () => { const B = F.boat; if (!B) return `<p class="sf-empty">Tekne ${cfg.BOAT_LVL}. seviyede gelir.</p>`;
    return `<div class="sf-exp">${spr('i_boat', 46)}<span class="sf-pl">Günün teknesi<small class="sf-on"><span>${spr('i_coin', 16)} ${B.coins}</span><span>${STAR} ${B.xp}</span></small></span><button class="sf-btn sm gold" data-a="boatSend" ${!B.sent && B.crates.every((c) => c.done) ? '' : 'disabled'}>${B.sent ? 'Yola çıktı' : 'Uğurla'}</button></div>
      ${B.sent ? '<p class="sf-empty">Tekne yola çıktı. Yarın yeni tekne gelir.</p>' : `<div class="sf-recs">${B.crates.map((c, i) => crateRow(c, i, 'boatFill', true)).join('')}</div>`}
      <p class="sf-note">Kasaları sen doldurabilirsin, çiftliğini gezen komşuların da doldurabilir. Dört kasa dolunca tekneyi uğurla.</p>`; };
  const vboatBody = () => { const B = F.boat; return B && !B.sent ? `<div class="sf-recs">${B.crates.map((c, i) => crateRow(c, i, 'vboatFill', false)).join('')}</div><p class="sf-note">Doldurduğun kasanın ürün bedeli sana altın olarak ödenir.</p>` : '<p class="sf-empty">Tekne yola çıkmış.</p>'; };
  const clubBody = () => { const C = ps.club; if (!C) return '<div class="spinner"></div>';
    return C.clubs.length ? `<div class="sf-recs">${C.clubs.map((c) => `<div class="sf-rec ${c.claimed ? 'fin' : ''}"><div class="sf-ri"><b>${esc(c.name)}</b><small>${c.farmers} çiftçi · senin katkın ${c.mine}</small>${bar(Math.min(c.sum, c.target), c.target)}</div>${c.claimed ? '<small class="ok">Alındı</small>' : `<button class="sf-btn sm gold" data-a="clubClaim" data-c="${esc(c.id)}" ${c.sum >= c.target && c.mine >= 30 ? '' : 'disabled'}>${spr('i_coin', 14)} ${C.prize}</button>`}</div>`).join('')}</div>
      <p class="sf-note">Kulüp üyelerinin o hafta kazandığı deneyim ortak hedefe sayılır. Hedef dolunca en az 30 deneyim kazanmış her üye ödülünü alır. Pazartesi sıfırlanır.</p>` : '<p class="sf-empty">Henüz bir kulübe üye değilsin. SwipeUp\'ta bir kulübe katıl, kulüp çiftliği burada açılsın.</p>'; };
  const pairsBody = () => { const L = ps.pairs; if (!L) return '<div class="spinner"></div>';
    return L.length ? `${L.map((r) => `<a class="sf-nb" href="#/farm/${esc(r.user.id)}"><img src="${esc(r.user.avatar)}" alt=""><span class="sf-grow"><b>${esc(r.user.name || r.user.username)}</b>${bar(r.pair.g, r.pair.max)}</span>${r.pair.me ? '<small class="ok">Bugün suladın</small>' : '<span class="sf-btn sm">Sula</span>'}</a>`).join('')}<p class="sf-note">Eşleştiğin kişiyle ortak ağacınızı her gün sulayın. Aynı gün ikiniz de sularsanız iki kat büyür; 5, 15 ve 30. adımda ikinize de ödül var.</p>` : '<p class="sf-empty">Çift bahçesi, eşleştiğin ve çiftliği olan kişilerle açılır.</p>'; };
  // küçük çiftlik görüntüleri (yarışma): panel her çizildiğinde yeniden bağlanır
  const minis = new Map(); const mini = (key, snap, cls = '') => { minis.set(key, snap); return `<canvas class="sf-mini ${cls}" data-mini="${esc(key)}" aria-hidden="true"></canvas>`; };
  const ago2 = (t) => { const m = Math.round((tnow() - t) / 60000); return m < 60 ? `${Math.max(1, m)} dk önce` : m < 1440 ? `${Math.round(m / 60)} sa önce` : `${Math.round(m / 1440)} gün önce`; };
  const contestBody = () => { const C = ps.contest; if (!C) return '<div class="spinner"></div>';
    const who = (u) => `<img src="${esc(u.avatar)}" alt=""><b>${esc(u.name || u.username)}</b>`;
    return `<div class="sf-ct"><span class="sf-ctl">Bu haftanın teması</span><b class="sf-ctt">${esc(C.theme)}</b><span>Bitmesine <b>${fmtD(C.ends - tnow())}</b> · ${C.count} çiftlik katıldı</span></div>
      <div class="sf-prz">${C.prize.map((pz, i) => `<span><i class="sf-rank r${i + 1}">${i + 1}</i>${spr('i_coin', 16)}<b>${pz}</b>${spr('rosette', 26)}</span>`).join('')}</div>
      ${C.mine ? `<div class="sf-ce mine">${mini('mine', C.mine.snap)}<div class="sf-cei"><b>Senin çiftliğin</b><small>${C.mine.votes} oy</small><button class="sf-btn sm" data-a="cEnter" ${ps.busy ? 'disabled' : ''}>Görüntüyü güncelle</button></div></div>`
        : C.myLvl >= C.lvl ? `<div class="sf-exp">${spr('rosette', 46)}<span class="sf-pl">Çiftliğinle katıl<small>Çiftliğinin şu anki hâli yarışmaya girer. Hafta boyunca güncelleyebilirsin.</small></span><button class="sf-btn sm gold" data-a="cEnter" ${ps.busy ? 'disabled' : ''}>Katıl</button></div>`
          : `<p class="sf-note top">Yarışmaya ${C.lvl}. seviyeden sonra katılabilirsin. Şimdiden oy verebilirsin.</p>`}
      <h3 class="sf-h">Oy ver · ${C.votesLeft} oyun kaldı</h3>
      ${C.list.length ? `<div class="sf-ceg">${C.list.map((e) => `<div class="sf-ce">${mini(e.id, e.snap)}<div class="sf-cei"><a class="sf-cu" href="#/farm/${esc(e.user.id)}">${who(e.user)}</a><small>${e.votes} oy</small><button class="sf-btn sm ${e.voted ? 'ghost' : 'gold'}" data-a="cVote" data-id="${esc(e.id)}" ${e.voted || !C.votesLeft ? 'disabled' : ''}>${e.voted ? 'Oy verdin' : 'Oy ver'}</button></div></div>`).join('')}</div>` : '<p class="sf-empty">Bu hafta henüz başka katılan yok. İlk sen katıl, arkadaşlarını çağır.</p>'}
      ${C.last?.top?.length ? `<h3 class="sf-h">Geçen hafta · ${esc(C.last.theme)}</h3>${C.last.top.map((x) => `<a class="sf-nb" href="#/farm/${esc(x.user.id)}"><i class="sf-rank r${x.rank}">${x.rank}</i><img src="${esc(x.user.avatar)}" alt=""><span class="sf-grow"><b>${esc(x.user.name || x.user.username)}</b><small>${x.votes} oy</small></span>${spr('rosette', 30)}</a>`).join('')}` : ''}
      <p class="sf-note">Her hafta yeni bir tema var. Herkesin haftada ${cfg.CONTEST_VOTES} oyu olur, kendi çiftliğine oy veremezsin. Pazartesi en çok oy alan üç çiftlik altın ve koleksiyonluk yarışma kurdelesi kazanır.</p>`; };
  const SEEDS = cfg.RARE.map((k) => `s_${k}`);
  const tradeBody = () => { const TR = ps.trades; if (!TR) return '<div class="spinner"></div>'; const t = ps.tr || (ps.tr = { gn: 1, wn: 1 });
    const open = TR.list.filter((x) => x.st === 'open'); const inc = open.filter((x) => !x.mine); const outg = open.filter((x) => x.mine); const old = TR.list.filter((x) => x.st !== 'open').slice(0, 6);
    const pair = (x) => `<span class="sf-tp">${spr(ik(x.give.k), 26)}<b>×${x.give.n}</b><em>⇄</em>${spr(ik(x.want.k), 26)}<b>×${x.want.n}</b></span>`;
    const ST = { done: 'Takas yapıldı', declined: 'Geri çevrildi', cancelled: 'Geri çekildi', expired: 'Süresi doldu' };
    const nbs = ps.nb ? ps.nb.following.filter((r) => r.user.id !== state.me?.id) : null; const lvl5 = (F.lvl || 0) >= cfg.CROPS.lavender.lvl;
    return `<div class="sf-seedrow">${SEEDS.map((k) => `<span class="sf-sd ${k === `s_${F.home}` ? 'home' : ''}">${spr(ik(k), 40)}<b>${inv()[k] || 0}</b><small>${esc(cfg.CROPS[k.slice(2)].name)}${k === `s_${F.home}` ? ' · yören' : ''}</small></span>`).join('')}</div>
      ${inc.length ? `<h3 class="sf-h">Sana gelen teklifler</h3>${inc.map((x) => `<div class="sf-nb sf-tr"><img src="${esc(x.user.avatar)}" alt=""><span class="sf-grow"><b>${esc(x.user.name || x.user.username)}</b>${pair(x)}<small>Sen ${x.want.n} ${esc(iname(x.want.k).toLocaleLowerCase('tr-TR'))} verirsin, ${x.give.n} ${esc(iname(x.give.k).toLocaleLowerCase('tr-TR'))} alırsın</small></span><span class="sf-va"><button class="sf-btn sm gold" data-a="trAcc" data-id="${x.id}" ${(inv()[x.want.k] || 0) >= x.want.n ? '' : 'disabled'}>Kabul et</button><button class="sf-btn sm ghost" data-a="trDec" data-id="${x.id}">Geri çevir</button></span></div>`).join('')}` : ''}
      ${outg.length ? `<h3 class="sf-h">Gönderdiğin teklifler</h3>${outg.map((x) => `<div class="sf-nb sf-tr"><img src="${esc(x.user.avatar)}" alt=""><span class="sf-grow"><b>${esc(x.user.name || x.user.username)}</b>${pair(x)}<small>${fmtD(x.end - tnow())} içinde cevap bekleniyor</small></span><button class="sf-btn sm ghost" data-a="trCan" data-id="${x.id}">Geri çek</button></div>`).join('')}` : ''}
      <h3 class="sf-h">Yeni takas teklifi</h3>
      ${!lvl5 ? `<p class="sf-empty">Nadir tohumlar ${cfg.CROPS.lavender.lvl}. seviyede açılır.</p>` : !nbs ? '<div class="spinner"></div>' : !nbs.length ? '<p class="sf-empty">Takas için takip ettiğin birinin çiftliği olmalı.</p>' : `
        <div class="sf-trf"><small>Kiminle?</small><div class="sf-chips">${nbs.slice(0, 20).map((r) => `<button class="${t.to === r.user.id ? 'on' : ''}" data-a="trTo" data-u="${esc(r.user.id)}"><img src="${esc(r.user.avatar)}" alt="">${esc(r.user.name || r.user.username)}</button>`).join('')}</div>
        <small>Vereceğin</small><div class="sf-chips">${SEEDS.map((k) => `<button class="${t.give === k ? 'on' : ''}" data-a="trG" data-k="${k}" ${(inv()[k] || 0) ? '' : 'disabled'}>${spr(ik(k), 22)}${esc(cfg.CROPS[k.slice(2)].name)} · ${inv()[k] || 0}</button>`).join('')}</div>
        <small>İstediğin</small><div class="sf-chips">${SEEDS.map((k) => `<button class="${t.want === k ? 'on' : ''}" data-a="trW" data-k="${k}" ${t.give === k ? 'disabled' : ''}>${spr(ik(k), 22)}${esc(cfg.CROPS[k.slice(2)].name)}</button>`).join('')}</div>
        <div class="sf-sell two"><span class="sf-pl">Vereceğin<small>en çok 5</small></span><div class="sf-stp"><button data-a="trN" data-k="gn" data-d="-1" aria-label="Azalt">−</button><b>${t.gn}</b><button data-a="trN" data-k="gn" data-d="1" aria-label="Artır">+</button></div>
          <span class="sf-pl">İstediğin<small>en çok 5</small></span><div class="sf-stp"><button data-a="trN" data-k="wn" data-d="-1" aria-label="Azalt">−</button><b>${t.wn}</b><button data-a="trN" data-k="wn" data-d="1" aria-label="Artır">+</button></div>
          <button class="sf-btn gold" data-a="trSend" ${t.to && t.give && t.want && (inv()[t.give] || 0) >= t.gn && !ps.busy ? '' : 'disabled'}>Teklifi gönder</button></div></div>`}
      ${old.length ? `<h3 class="sf-h">Son takaslar</h3>${old.map((x) => `<div class="sf-nb sf-tr dim"><img src="${esc(x.user.avatar)}" alt=""><span class="sf-grow"><b>${esc(x.user.name || x.user.username)}</b>${pair(x)}</span><small class="lk">${ST[x.st] || ''}</small></div>`).join('')}` : ''}
      <p class="sf-note">Herkesin yöresinde bir nadir tohum yetişir: senin yören ${esc(cfg.CROPS[F.home]?.name || '')}. Diğer nadir tohumları komşularınla takas ederek bulursun. Teklif ettiğin tohumlar cevap gelene kadar emanette bekler; ${3} gün içinde cevap gelmezse ambarına döner.</p>`; };
  const inviteBody = () => { const I = ps.inv; if (!I) return '<div class="spinner"></div>';
    return `<div class="sf-exp">${spr('swing', 52)}<span class="sf-pl">Arkadaşını davet et<small>Davetinle SwipeUp'a katılan arkadaşın çiftliğinde ${I.lvl}. seviyeye ulaşınca ikinize de ${I.coins} altın ve koleksiyonluk salıncak.</small></span><button class="sf-btn sm gold" data-a="invShare">Davet et</button></div>
      ${I.by ? `<h3 class="sf-h">Seni davet eden</h3><div class="sf-nb"><img src="${esc(I.by.user.avatar)}" alt=""><span class="sf-grow"><b>${esc(I.by.user.name || I.by.user.username)}</b><small>${I.mine ? 'Ödülünüzü aldınız' : `Sen ${I.lvl}. seviyeye ulaşınca ikinize de ödül`}</small></span>${I.mine ? '<small class="ok">Alındı</small>' : ''}</div>` : ''}
      <h3 class="sf-h">Davet ettiklerin</h3>
      ${I.list.length ? I.list.map((r) => `<a class="sf-nb" href="#/farm/${esc(r.user.id)}"><img src="${esc(r.user.avatar)}" alt=""><span class="sf-grow"><b>${esc(r.user.name || r.user.username)}</b>${r.done ? '<small>Ödülünüzü aldınız</small>' : r.lvl ? bar(Math.min(r.lvl, I.lvl), I.lvl) : '<small>Henüz çiftlik kurmadı</small>'}</span>${r.done ? '<small class="ok">Alındı</small>' : `<small class="lk">Seviye ${r.lvl}</small>`}</a>`).join('') : '<p class="sf-empty">Henüz davetinle gelen kimse yok.</p>'}`; };
  const vpairBody = () => { const P = F.pair; const nx = cfg.PAIR_STEPS.find((x) => x.g > P.g);
    return `<div class="sf-pair"><span class="sf-decs" style="transform:scale(${(0.55 + 0.45 * (P.g / P.max)).toFixed(2)})">${spr('lovetree', 96)}</span><div class="sf-ri"><b>Çift bahçesi</b>${bar(P.g, P.max)}<small>${P.me ? 'Bugün suladın.' : 'Bugün henüz sulamadın.'} ${P.them ? 'O da suladı.' : 'O henüz sulamadı.'}</small>
      ${nx ? `<small class="sf-on"><span>${nx.g}. adım: ${spr('i_coin', 16)} ${nx.coins}</span>${nx.decor ? `<span>${spr(nx.decor, 22)} ${esc(cfg.TYPES[nx.decor].name)}</span>` : ''}</small>` : '<small class="ok">Ağacınız tam büyüdü</small>'}
      <button class="sf-btn" data-a="pairWater" ${P.me ? 'disabled' : ''}>${P.me ? 'Yarın yine sula' : 'Ağacı sula'}</button></div></div>
      <p class="sf-note">Aynı gün ikiniz de sularsanız ağaç iki kat büyür. Ödüller ikinize birden verilir.</p>`; };
  const noteRow = (x, del) => `<div class="sf-nb sf-nt"><img src="${esc(x.user.avatar)}" alt=""><span class="sf-grow"><b>${esc(x.user.name || x.user.username)}</b><small>${esc(x.text)}</small></span>${del ? `<button class="sf-x sm" data-a="bookDel" data-id="${x.id}" aria-label="Sil">${icon('close')}</button>` : ''}</div>`;
  const bookBody = () => `<div class="sf-rk"><span>${spr('i_heart', 18)} <b>${F.likes}</b> beğeni</span><span><b>${F.book.length}</b> not</span></div>${F.book.length ? F.book.map((x) => noteRow(x, true)).join('') : '<p class="sf-empty">Defterin boş. Çiftliğini gezen komşuların buraya not bırakabilir.</p>'}`;
  const vbookBody = () => `<div class="sf-nb">${spr('i_heart', 30)}<span class="sf-grow"><b>${F.likes} beğeni</b></span><button class="sf-btn sm" data-a="vlike" ${F.liked ? 'disabled' : ''}>${F.liked ? 'Beğendin' : 'Beğen'}</button></div>
    ${F.wrote ? '<p class="sf-note top">Bugün bu deftere yazdın.</p>' : '<div class="sf-write"><input class="sf-in" maxlength="80" placeholder="Bir not bırak (en çok 80 harf)" enterkeyhint="send"><button class="sf-btn sm" data-a="vnote">Yaz</button></div>'}
    ${F.book.map((x) => noteRow(x, false)).join('')}`;
  const petBody = () => { const P = cfg.PETS[F.pet.t]; const fed = F.pet.fed; const left = fed ? cfg.PET_T - (tnow() - fed) : 0;
    return `<div class="sf-pair"><span class="sf-decs">${spr(F.pet.t, 84)}</span><div class="sf-ri"><b>${esc(P.name)}</b>${!fed ? `<small>Karnı aç. Besle, çiftlikte dolaşıp sana küçük bir hediye bulsun.</small><div class="sf-row">${P.food.map((k) => `<button class="sf-btn sm" data-a="petFeed" data-k="${k}" ${inv()[k] > 0 ? '' : 'disabled'}>${spr(`i_${k}`, 18)} ${esc(cfg.ITEMS[k][0])} · ${inv()[k] || 0}</button>`).join('')}</div>` : left > 0 ? `<small>Karnı tok, etrafı kolaçan ediyor. ${fmt(left)} sonra bir şey bulur.</small>` : `<small>Bir şey buldu!</small><button class="sf-btn gold" data-a="petTake">${spr('i_gift', 18)} Hediyeyi al</button>`}</div></div>`; };
  const TABS = { G: () => [['quests', 'Görevler', questsBody], ['daily', 'Giriş ödülü', dailyBody], ['wheel', 'Çark', wheelBody], ['ach', 'Başarımlar', achBody], F.event ? ['event', F.event.name, eventBody] : null].filter(Boolean),
    S: () => [['rank', 'Sıralama', rankBody], ['contest', 'Yarışma', contestBody], ['trade', 'Takas', tradeBody], ['coop', 'Ortak', coopBody], ['club', 'Kulüp', clubBody], ['pairs', 'Çift bahçesi', pairsBody], ['invite', 'Davet', inviteBody], ['book', 'Defter', bookBody]] };
  const hubBody = (grp) => () => { const tabs = TABS[grp](); const cur = tabs.find((t) => t[0] === ps.T) || tabs[0]; return `<div class="sf-tabs top">${tabs.map(([k, n]) => `<button class="${cur[0] === k ? 'on' : ''}" data-a="ptab" data-k="${k}">${esc(n)}</button>`).join('')}</div>${cur[2]()}`; };
  const loadTab = (k) => { const get = (url, key, pickFn) => { if (!ps[key]) api(url).then((r) => { ps[key] = pickFn(r); panel?.paint(); }).catch((e) => toast(e.message)); };
    if (k === 'rank') get('/farm/rank', 'rank', (r) => r); if ((k === 'coop' && !F.coop) || k === 'trade') get('/farm/neighbors', 'nb', (r) => r); if (k === 'club') get('/farm/club', 'club', (r) => r); if (k === 'pairs') get('/farm/pairs', 'pairs', (r) => r.list);
    if (k === 'contest') get('/farm/contest', 'contest', (r) => r); if (k === 'trade') get('/farm/trades', 'trades', (r) => r); if (k === 'invite') get('/farm/invites', 'inv', (r) => r); };
  const STILL = new Set(['contest', 'trade', 'invite']); // her saniye yeniden çizilmeyen sekmeler
  const openHub = (grp, title, T) => { ps = { T }; openPanel(title, hubBody(grp), () => !STILL.has(ps.T)); loadTab(T); };
  async function shareFarm() { // çiftliğin görüntüsü: sahnenin o anki hâli + küçük imza
    const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const x = c.getContext('2d'); x.drawImage(cv, 0, 0);
    const u = Math.round(c.height / 16); x.font = `800 ${u}px system-ui, sans-serif`; x.textBaseline = 'bottom'; x.lineWidth = u / 6; x.strokeStyle = 'rgba(58,34,12,.75)'; x.fillStyle = '#fff'; const tx = `SwipeFarm · Seviye ${F.lvl}`; x.strokeText(tx, u * 0.7, c.height - u * 0.6); x.fillText(tx, u * 0.7, c.height - u * 0.6);
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.9)); if (!blob) throw new Error('Görüntü hazırlanamadı.'); return new File([blob], 'swipefarm.jpg', { type: 'image/jpeg' });
  }
  const shareBody = () => `<div class="sf-share"><img src="${ps.url}" alt="Çiftliğinin görüntüsü"><div class="sf-whr"><b>Çiftliğini paylaş</b><small>Görüntü, çiftliğinin şu an ekranda duran hâlidir. Önce istediğin yere kaydırıp yakınlaştırabilirsin.</small>
    <button class="sf-btn" data-a="shStory" ${ps.busy ? 'disabled' : ''}>Hikâyene ekle</button><button class="sf-btn ghost" data-a="shSave" ${ps.busy ? 'disabled' : ''}>Kaydet ya da gönder</button></div></div>`;
  const setBody = () => `<div class="sf-set">
      <button class="sf-tg nav" data-a="share"><span><b>Çiftliğini paylaş</b><small>Görüntüsünü hikâyene ekle ya da kaydet</small></span>${icon('share')}</button>
      <button class="sf-tg ${muted ? '' : 'on'}" data-a="snd"><span><b>Oyun sesleri</b><small>Hasat, altın ve seviye sesleri</small></span><i></i></button>
      <button class="sf-tg ${F.notif ? 'on' : ''}" data-a="notif"><span><b>Tarla hazır bildirimi</b><small>Ekinlerin olgunlaşınca haber verir, günde en çok 2 kez</small></span><i></i></button>
      <button class="sf-tg ${lowQ ? 'on' : ''}" data-a="lowq"><span><b>Hafif grafik</b><small>Yavaş telefonlarda oyunu akıcılaştırır: çözünürlük ve süs efektleri azalır</small></span><i></i></button>
      <button class="sf-tg ${music ? 'on' : ''}" data-a="music"><span><b>Arka plan müziği</b><small>Sakin bir çiftlik ezgisi</small></span><i></i></button>
      <button class="sf-tg ${ambOn ? 'on' : ''}" data-a="amb"><span><b>Gün ve mevsim</b><small>Gece karanlığı, gün batımı, kar ve yaprak görüntüleri</small></span><i></i></button>
      <button class="sf-tg nav" data-a="tutRestart"><span><b>Oyun rehberi</b><small>Adım adım anlatımı yeniden göster</small></span>${icon('question')}</button></div>
    <p class="sf-note">Bildirimin telefonuna gelmesi için SwipeUp bildirimlerine izin vermiş olman gerekir.</p>`;
  const overQ = []; const showOver = (html) => { if (over.innerHTML) overQ.push(html); else over.innerHTML = html; };
  // ---------- ilk giriş rehberi ----------
  const TUT = [
    { t: 'Olgun buğdayların üzerinde parmağını kaydır, hasat et.', ev: 'harvest' },
    { t: 'Boş bir tarlaya dokun, buğdayı seç ve boş tarlaların üzerinde kaydırarak ek.', ev: 'plant' },
    { t: 'Siparişlerine bak: Sipariş düğmesine dokun.', ev: 'orders', sel: '[data-a="orders"]' },
    { t: 'Ürünlerin depoda durur. Ambar göstergesine dokun.', ev: 'barn', sel: '.sf-barnp' },
    { t: "Market'ten yeni tarla, bina ve hayvan alırsın. Market'e dokun.", ev: 'shop', sel: '[data-a="shop"]' },
    { t: 'Günlük görevler, şans çarkı ve ödüller burada. Görevler düğmesine dokun.', ev: 'hubG', sel: '[data-a="hubG"]' },
  ];
  let tutKey = '';
  function paintTut() {
    const el = root.querySelector('.sf-tut'); const on = tutOn() && !panel && !over.innerHTML && mode?.k !== 'place' && mode?.k !== 'edit'; const k = on ? `${F.tut}${mode?.k || ''}` : ''; if (k === tutKey) return; tutKey = k;
    root.querySelectorAll('.sf-tut-hl').forEach((x) => x.classList.remove('sf-tut-hl'));
    if (!on) { el.hidden = true; return; } const s = TUT[F.tut]; el.hidden = false; el.classList.toggle('low', !mode);
    el.innerHTML = `<span class="sf-tutn">${F.tut + 1}/${cfg.TUT_N}</span><p>${esc(s.t)}</p><button class="sf-x sm" data-a="tutSkip" aria-label="Rehberi kapat">${icon('close')}</button>`;
    if (s.sel) root.querySelector(s.sel)?.classList.add('sf-tut-hl');
  }
  function tutEv(ev) {
    if (!tutOn() || TUT[F.tut]?.ev !== ev) return; const next = F.tut + 1; F.tut = next; paintTut();
    act('tut', { step: next }).then((r) => { if (r?.tutDone) showOver(`<div class="sf-lvl"><div class="sf-lvc dec"><span class="sf-decs">${spr('i_basket', 92)}</span><h2>Rehber tamamlandı!</h2><p class="sf-lvr">${spr('i_coin', 22)} +${cfg.TUT_RW.coins} altın · ${spr('i_fert', 22)} +${cfg.TUT_RW.fert} gübre</p><p class="sf-note">Gübreyi büyüyen ekine ver, altın yıldızlı ürün çıksın. İyi hasatlar!</p><button class="sf-btn" data-a="lvlok">Başlayalım</button></div></div>`); });
  }
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
  const trOp = (id, op, msg) => api(`/farm/trades/${id}/${op}`, { body: {} }).then((r) => { apply({ farm: r.farm, fx: r.fx }); ps.trades = null; loadTab('trade'); toast(msg); }).catch((e) => toast(e.message));
  const UI = {
    back() { if (visit) location.hash = '#/farm'; else if (history.length > 1) history.back(); else location.hash = '#/oyunlar'; },
    close: closePanel,
    orders() { ps = {}; openPanel('Siparişler ve ziyaretçiler', ordersBody, true); tutEv('orders'); },
    barn(d) { ps = { st: d?.st }; openPanel('Depolar', barnBody); tutEv('barn'); },
    shop() { ps = {}; openPanel('Market', shopBody); tutEv('shop'); },
    stab(d) { ps.st = d.k; ps.sel = null; panel.paint(); }, storeUp(d) { act('storeUp', { s: d.s }); }, placeT(d) { startPlace(d.t); },
    wx() { const w = F.wx; if (w) toast(`${WXT[w.k]} ${fmt(w.until - tnow())} sonra hava ${cfg.WX[w.next].toLocaleLowerCase('tr-TR')} olacak.`); },
    tool(d) { if (d.k === 'fert' && !(inv().fert > 0)) { toast(F.objs.some((o) => o.t === 'compost') ? 'Gübren kalmadı. Kompostta üret.' : `Gübre için Market'ten kompost kur (seviye ${cfg.TYPES.compost.lvl}).`); return; } mode = { k: 'tool', tool: d.k, crop: mode?.crop }; paintBot(); },
    water1(d) { pendW.add(d.id); act('water', { ids: [d.id] }).then(() => pendW.delete(d.id)); }, fert1(d) { pendF.add(d.id); act('fert', { ids: [d.id] }).then(() => pendF.delete(d.id)); },
    collectAll() { act('collectAll'); }, waterAll() { act('water', { all: 1 }); },
    plantAll(d) { act('plantAll', { crop: d.k }).then((r) => { if (r?.planted) toast(`${r.planted} tarlaya ${cfg.CROPS[d.k].name.toLocaleLowerCase('tr-TR')} ekildi.`); }); },
    serve(d) { act('serve', { id: d.id }); }, shoo(d) { act('shoo', { id: d.id }); },
    plusInfo() { toast('Altın yelekli kıyafet SwipeUp+ üyelerine özel. SwipeUp+ üyeliğini Mağaza\'dan alabilirsin.'); },
    lowq() { slowN = 0; slowEma = 33; setLowQ(!lowQ, false); },
    music() { music = !music; try { localStorage.setItem('sf_music', music ? '1' : '0'); } catch { /* yok say */ } if (music) musicStart(); else musicStop(); panel?.paint(); },
    tutSkip() { F.tut = cfg.TUT_N; paintTut(); act('tut', { skip: 1 }); },
    tutRestart() { closePanel(); act('tut', { restart: 1 }).then(() => { tutKey = ''; paintTut(); }); },
    emo() { const el = root.querySelector('.sf-emos'); el.hidden = !el.hidden; },
    emote(d) { const i = +d.i; root.querySelector('.sf-emos').hidden = true; sock?.emit('farm:emote', { e: i }); if (meW) { meW.emo = i + 1; meW.emoT = T; } else myEmo = { emo: i + 1, emoT: T }; SFX.pop(2); },
    cEnter() { ps.busy = true; panel.paint(); api('/farm/contest/enter', { body: {} }).then((r) => { toast(r.updated ? 'Yarışmadaki görüntün güncellendi.' : 'Çiftliğin yarışmaya katıldı. Bol şans!'); ps.contest = null; ps.busy = false; loadTab('contest'); }).catch((e) => { ps.busy = false; panel?.paint(); toast(e.message); }); },
    cVote(d) { api('/farm/contest/vote', { body: { id: d.id } }).then((r) => { const e = ps.contest?.list.find((x) => x.id === d.id); if (e) { e.voted = true; e.votes = r.votes; } if (ps.contest) ps.contest.votesLeft = r.votesLeft; SFX.pop(3); panel?.paint(); }).catch((e) => toast(e.message)); },
    trTo(d) { ps.tr.to = d.u; panel.paint(); }, trG(d) { ps.tr.give = d.k; if (ps.tr.want === d.k) ps.tr.want = null; panel.paint(); }, trW(d) { ps.tr.want = d.k; panel.paint(); },
    trN(d) { ps.tr[d.k] = Math.max(1, Math.min(5, (ps.tr[d.k] || 1) + +d.d)); panel.paint(); },
    trSend() { const t = ps.tr; ps.busy = true; panel.paint(); api('/farm/trades', { body: { to: t.to, give: t.give, gn: t.gn, want: t.want, wn: t.wn } }).then((r) => { apply({ farm: r.farm }); ps.tr = { gn: 1, wn: 1 }; ps.trades = null; ps.busy = false; loadTab('trade'); toast('Takas teklifin gönderildi.'); }).catch((e) => { ps.busy = false; panel?.paint(); toast(e.message); }); },
    trAcc(d) { trOp(d.id, 'accept', 'Takas tamam! Tohumlar ambarında.'); }, trDec(d) { trOp(d.id, 'decline', 'Teklifi geri çevirdin.'); }, trCan(d) { trOp(d.id, 'cancel', 'Teklifini geri çektin, tohumların ambarına döndü.'); },
    invShare() { api('/invite').then(async (r) => { const link = `${location.origin}/?ref=${encodeURIComponent(r.code)}#/register`; const text = `SwipeUp'ta SwipeFarm oynayalım! Bu bağlantıyla katılırsan çiftliğin ${cfg.INV_LVL}. seviyeye gelince ikimize de ödül var.`;
      if (navigator.share) { navigator.share({ title: 'SwipeFarm', text, url: link }).catch(() => {}); return; } try { await navigator.clipboard.writeText(`${text} ${link}`); toast('Davet bağlantın kopyalandı.'); } catch { location.hash = '#/davet'; } }).catch((e) => toast(e.message)); },
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
    lvlok() { over.innerHTML = overQ.shift() || ''; paintTut(); },
    hubG() { openHub('G', 'Görevler ve ödüller', 'quests'); tutEv('hubG'); }, hubS() { openHub('S', 'Sosyal', 'rank'); },
    ptab(d) { ps.T = d.k; loadTab(d.k); panel.paint(); },
    questClaim() { act('questClaim'); }, achClaim(d) { act('achClaim', { k: d.k }); }, evClaim(d) { act('evClaim', { i: +d.i }); },
    spin() { if (ps.spinning) return; ps.spinning = true; panel.paint();
      chain = chain.then(() => api('/farm/act', { body: { a: 'spin' } }).then((r) => { ps.deg = (Math.floor((ps.deg || 0) / 360) + 6) * 360 - (r.spin + 0.5) * 45; const el = root.querySelector('.sf-wheel i'); if (el) el.style.transform = `rotate(${ps.deg}deg)`; SFX.tap();
        return new Promise((res) => setTimeout(() => { ps.spinning = false; apply(r); SFX.level(); res(); }, 3400)); }).catch((e) => { ps.spinning = false; SFX.err(); toast(e.message); panel?.paint(); })); },
    boat() { ps = {}; openPanel('Tekne', boatBody); }, boatFill(d) { act('boatFill', { i: +d.i }); }, boatSend() { act('boatSend'); },
    upB(d) { act('upgrade', { b: d.b }).then((r) => { if (r) { SFX.level(); toast('Bina yükseltildi, üretim hızlandı.'); } }); },
    petBuy(d) { act('petBuy', { t: d.t }).then((r) => { if (r) { closePanel(); petW.x = man.x + 0.8; petW.y = man.y + 0.5; toast(`${cfg.PETS[d.t].name} artık seninle. Üzerine dokunup besleyebilirsin.`); } }); },
    petFeed(d) { act('petFeed', { item: d.k }); }, petTake() { act('petTake'); },
    fit(d) { act('fit', { k: d.k }); },
    clubClaim(d) { act('clubClaim', { club: d.c }).then((r) => { if (r) { ps.club = null; loadTab('club'); } }); },
    bookDel(d) { act('bookDel', { id: d.id }); },
    share() { shareFarm().then((file) => { ps = { file, url: URL.createObjectURL(file) }; openPanel('Paylaş', shareBody); }).catch((e) => toast(e.message)); },
    shStory() { ps.busy = true; panel.paint(); uploadFile(ps.file).then((m) => api('/stories', { body: { media: m.url, mediaType: 'image' } })).then(() => { closePanel(); toast('Çiftliğin hikâyene eklendi.'); }).catch((e) => { ps.busy = false; panel?.paint(); toast(e.message); }); },
    shSave() { const f = ps.file; if (navigator.canShare?.({ files: [f] })) navigator.share({ files: [f], title: 'SwipeFarm' }).catch(() => {}); else { const a = document.createElement('a'); a.href = ps.url; a.download = 'swipefarm.jpg'; a.click(); } },
    vbook() { ps = {}; openPanel('Ziyaretçi defteri', vbookBody); }, vlike() { vcall('like', {}, () => SFX.pop(2)); },
    vnote() { const t = root.querySelector('.sf-in')?.value.trim(); if (!t) return; vcall('book', { text: t }, () => { SFX.take(); toast('Notun deftere yazıldı.'); }); },
    vpair() { ps = {}; openPanel('Çift bahçesi', vpairBody); }, pairWater() { vcall('pair', {}, () => SFX.water()); },
    vboat() { ps = {}; openPanel('Tekne', vboatBody); }, vboatFill(d) { vcall('boat', { i: +d.i }, () => SFX.coin()); },
    jet() { toast('Jeton, SwipeUp cüzdanındaki jetonundur. Hızlandırmada ve özel süslerde kullanılır.'); },
    daily() { openHub('G', 'Görevler ve ödüller', 'daily'); }, dailyGet() { act('daily'); },
    rank() { openHub('S', 'Sosyal', 'rank'); },
    rtab(d) { ps.tab = d.k; panel.paint(); },
    coop() { openHub('S', 'Sosyal', 'coop'); },
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
    const hit = F.objs.find((o) => { const Ty = cfg.TYPES[o.t]; return Ty && tx >= o.x && tx < o.x + Ty.w && ty >= o.y && ty < o.y + Ty.h; });
    if (hit) return hit;
    let best = null; // yüksek yapıların çatısına dokunma
    for (const o of F.objs) { const Ty = cfg.TYPES[o.t]; if (!Ty || (Ty.w * Ty.h < 2 && o.t !== 'board')) continue; const a = A.atlas[o.t]; if (!a) continue; const [ox, oy] = toScr(o.x + Ty.w / 2, o.y + Ty.h / 2);
      const x0 = ox - a[5] * cam.z * 0.8; const y0 = oy - a[6] * cam.z; if (sx > x0 && sx < x0 + a[3] * cam.z * 0.62 && sy > y0 && sy < oy && (!best || o.x + o.y > best.x + best.y)) best = o; }
    return best;
  }
  function tap(o) {
    const now = tnow();
    if (mode?.k === 'place') return;
    if (mode?.k === 'edit') { if (o) { pops.set(o.id, T); startPlace(o.t, o.id); } return; }
    if (!o) { if (mode?.k === 'plant' || mode?.k === 'tool') { mode = null; paintBot(); } return; }
    pops.set(o.id, T); SFX.tap(); const Ty = cfg.TYPES[o.t];
    if (!visit && mode?.k === 'tool' && o.t === 'plot') { if (o.crop && !cropReady(o, now)) UI[mode.tool === 'water' ? 'water1' : 'fert1']({ id: o.id }); return; }
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
    if (Ty.kind === 'store') { UI.barn({ st: o.t }); return; }
    if (o.t === 'barn') UI.barn(); else if (o.t === 'board') UI.orders(); else if (o.t === 'house') UI.nb();
  }
  const ptr = new Map(); let drag = null;
  const pos = (e) => { if (rot) return [e.clientY, window.innerWidth - e.clientX]; const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const swipeOn = (o) => { // kaydırırken üzerinden geçilen tarlayı işleme kat
    if (!o || o.t !== 'plot' || drag.ids.has(o.id)) return;
    if (drag.k === 'harvest' && cropReady(o, tnow())) { drag.ids.add(o.id); pendH.add(o.id); pops.set(o.id, T); SFX.pop(drag.ids.size); }
    if (drag.k === 'plant' && !o.crop && !pendP.has(o.id)) { const c = cfg.CROPS[mode.crop]; if (c.rare ? (inv()[`s_${mode.crop}`] || 0) <= drag.ids.size : F.coins < c.seed * (drag.ids.size + 1)) return; drag.ids.add(o.id); pendP.set(o.id, mode.crop); pops.set(o.id, T); SFX.plant(); }
    const grow = o.crop && !cropReady(o, tnow());
    if (drag.k === 'water' && grow && !o.w && !pendW.has(o.id)) { drag.ids.add(o.id); pendW.add(o.id); pops.set(o.id, T); SFX.water(); }
    if (drag.k === 'fert' && grow && !o.f && !pendF.has(o.id) && (inv().fert || 0) > drag.ids.size) { drag.ids.add(o.id); pendF.add(o.id); pops.set(o.id, T); SFX.plant(); }
  };
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture?.(e.pointerId); const [sx, sy] = pos(e); ptr.set(e.pointerId, [sx, sy]);
    if (ptr.size === 2) { const [a, b] = [...ptr.values()]; if (drag?.ids) { drag.ids.forEach((id) => { pendH.delete(id); pendP.delete(id); }); } drag = { k: 'pinch', d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: cam.z }; return; }
    const o = pick(sx, sy); drag = { k: 'pan', sx, sy, moved: false, o };
    if (mode?.k === 'place') { const [gx, gy] = toGrid(sx, sy); const Ty = cfg.TYPES[mode.t]; if (gx >= mode.x - 0.8 && gx <= mode.x + Ty.w + 0.8 && gy >= mode.y - 0.8 && gy <= mode.y + Ty.h + 0.8) drag = { k: 'ghost', moved: true }; return; }
    if (visit || mode?.k === 'edit' || !o || o.t !== 'plot') return;
    if (mode?.k === 'tool') { if (o.crop && !cropReady(o, tnow())) { drag = { k: mode.tool, ids: new Set() }; swipeOn(o); } return; }
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
    if (d.k === 'pan' && !d.moved) {
      if (mode?.k === 'place') { const [gx, gy] = toGrid(sx, sy); const Ty = cfg.TYPES[mode.t]; mode.x = Math.min(N - Ty.w, Math.max(0, Math.round(gx - Ty.w / 2))); mode.y = Math.min(N - Ty.h, Math.max(0, Math.round(gy - Ty.h / 2))); return; }
      const zk = Math.max(1, cam.z / 0.3); const nh = !mode && npcHit.find(([x, y]) => Math.hypot(sx - x, sy - y) < 30 * zk);
      if (nh) { const v = nh[2]; SFX.tap(); if (visit) toast(`${v.who} ${v.n} ${iname(v.k).toLocaleLowerCase('tr-TR')} almaya gelmiş.`); else { ps = {}; openPanel(v.who, () => { const x = visList().find((y) => y.id === v.id); return x ? `<div class="sf-recs">${visRow(x)}</div><p class="sf-note">Çabuk verirsen büyük bahşiş bırakır. Ziyaretçiler sipariş panosundan da görünür.</p>` : '<p class="sf-empty">Ziyaretçi ayrıldı.</p>'; }, true); } return; }
      if (!visit && F.pet && Math.hypot(sx - petW.sx, sy - petW.sy) < 30) { SFX.tap(); ps = {}; openPanel(cfg.PETS[F.pet.t].name, petBody, true); return; }
      if (visit && meW && !(d.o?.t === 'plot' && d.o.crop)) { const [gx, gy] = toGrid(sx, sy); if (!blocked(gx, gy) && gx > 0 && gy > 0 && gx < N && gy < N + 0.5) { meW.tx = gx; meW.ty = gy; meW.walk = true; } if (!d.o) return; }
      tap(d.o); return; }
    if ((d.k === 'harvest' || d.k === 'plant' || d.k === 'water' || d.k === 'fert') && d.ids.size) {
      const ids = [...d.ids]; if (d.k === 'plant') { try { localStorage.setItem('sf_crop', mode.crop); } catch { /* yok say */ } }
      act(d.k, d.k === 'plant' ? { ids, crop: mode.crop } : { ids }).then(() => ids.forEach((id) => { pendH.delete(id); pendP.delete(id); pendW.delete(id); pendF.delete(id); }));
    }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); cam.z *= e.deltaY < 0 ? 1.1 : 0.9; clampCam(); }, { passive: false });

  // ---------- zaman ----------
  hud(); paintBot();
  const tick = setInterval(() => {
    const lv = typeof panel?.live === 'function' ? panel.live() : panel?.live; if (lv && !ps.spinning) panel.paint();
    paintBot(); hud(); paintTut(); calcAmb();
    if (F.wx && F.wx.until <= tnow()) { F.wx = null; reload(); } // hava değişti
    if (!visit && (F.vis || []).some((v) => v.until <= tnow())) F.vis = F.vis.filter((v) => v.until > tnow());
    if (!visit && F.orders.some((o) => o.wait && o.wait <= tnow())) reload();
  }, 1000);
  const vis = () => { if (document.visibilityState === 'visible') reload(); };
  document.addEventListener('visibilitychange', vis);
  // müzik ilk dokunuşta başlar (tarayıcılar sesi ancak bir dokunuştan sonra açar)
  const startMus = () => { musicStart(); root.removeEventListener('pointerdown', startMus); }; root.addEventListener('pointerdown', startMus);
  if (data.welcome) { const w = data.welcome; showOver(`<div class="sf-lvl"><div class="sf-lvc dec"><span class="sf-decs">${spr('i_basket', 92)}</span><h2>Hoş geldin hediyesi</h2><p class="sf-lvr">${spr('i_coin', 22)} +${w.coins} altın · ${spr(ik(w.seed), 22)} +${w.n} ${esc(iname(w.seed).toLocaleLowerCase('tr-TR'))}</p><p class="sf-note">${esc(visit.name || visit.username)} seni çiftliğine davet etti, ilk ziyaretine ikinize de hediye verildi.</p><button class="sf-btn" data-a="lvlok">Teşekkürler!</button></div></div>`); }
  paintTut();
  return () => { cancelAnimationFrame(raf); cancelAnimationFrame(glide); clearInterval(tick); clearTimeout(toastT); ro.disconnect(); document.removeEventListener('visibilitychange', vis); unLive(); musicStop(); root.removeEventListener('pointerdown', startMus); unfit(); };
}

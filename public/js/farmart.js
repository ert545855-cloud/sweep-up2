// SwipeFarm görselleri: atlas yükleme ve küçük çiftlik görüntüsü (profil vitrini, haftalık yarışma).
export const AV = '?v=4'; // görsel paketi sürümü: atlas ile resimler tarayıcı önbelleğinde birbirinden kopmasın
let ART = null;
export function loadArt(onp) {
  if (ART) return ART;
  let n = 0; const step = () => onp?.(++n / 4);
  const img = (name) => new Promise((res, rej) => { const i = new Image(); i.onload = () => { step(); res(i); }; i.onerror = () => rej(new Error('Oyun görselleri yüklenemedi. Bağlantını kontrol et.')); i.src = `/img/farm/${name}.webp${AV}`; });
  ART = Promise.all([fetch(`/img/farm/atlas.json${AV}`).then((r) => r.json()).then((j) => { step(); return j; }), img('obj'), img('item'), img('grass')])
    .then(([atlas, obj, item, grass]) => { const A = { atlas, obj, item, grass };
      // yürüyüş kareleri ayrı atlasta; yüklenemezse oyun sabit pozlarla çalışmaya devam eder
      return Promise.all([fetch(`/img/farm/walk.json${AV}`).then((r) => r.json()), new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = `/img/farm/walk.webp${AV}`; })])
        .then(([wj, wi]) => { A.walk = wi; for (const k of Object.keys(wj)) if (!Object.prototype.hasOwnProperty.call(atlas, k)) atlas[k] = wj[k]; return A; }).catch(() => A); })
    .catch((e) => { ART = null; throw e; });
  return ART;
}

const HW = 136 * Math.SQRT1_2; const HH = HW / 2;
const SPOTS = { coop: [[0.1, 0.55], [0.6, 0.2], [0.55, 0.7], [-0.25, 0.75]], cowpen: [[0.35, 0.45], [-0.4, 0.6], [0.6, -0.2]], sheeppen: [[0.35, 0.45], [-0.4, 0.6], [0.6, -0.2]], goatpen: [[0.3, 0.5], [-0.4, 0.55], [0.6, -0.15]] };

// snap: { n, o: [[tür, x, y, ekin görseli|0, w, h]], fit, pet, a: { ağıl: [hayvan, sayı] } }
// Çiftliğin dolu kısmına odaklanır. Sabit kısım (çim ve yapılar) bir kez ayrı bir tuvale çizilir;
// anim açıksa her karede yalnızca çiftçi ve hayvanlar üstüne eklenir. Döndürdüğü fonksiyon animasyonu durdurur.
const has = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
export function drawMini(cv, snap, A, { anim = true } = {}) {
  const g = cv.getContext('2d'); const objs = (snap.o || []).filter((o) => Array.isArray(o) && typeof o[0] === 'string');
  const core = objs.filter((o) => !/^(tree|pine|bush|flowers|rock|fence_x|fence_z)$/.test(o[0]));
  let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
  for (const [, x, y, , w = 1, h = 1] of (core.length ? core : objs)) { for (const [gx, gy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) { const sx = (gx - gy) * HW; const sy = (gx + gy) * HH; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy - 150); y1 = Math.max(y1, sy); } }
  if (!Number.isFinite(x0)) { x0 = -HW * 4; x1 = HW * 4; y0 = 0; y1 = HH * 8; }
  const house = objs.find((o) => o[0] === 'house');
  const man = { x: house ? house[1] + 1.5 : 8, y: house ? house[2] + 2.6 : 8 };
  const bg = document.createElement('canvas'); const b = bg.getContext('2d');
  let raf = 0; let last = 0; let W = 0; let H = 0; let dpr = 1; let z = 0.3; let S = null;
  const sp = (x, k, sx, sy) => { if (!has(A.atlas, k)) return; const a = A.atlas[k]; x.drawImage(A[a[0]], a[1], a[2], a[3], a[4], sx - a[5] * z, sy - a[6] * z, a[3] * z, a[4] * z); };
  const actors = (T) => { // çiftçi, evcil hayvan ve ağıldaki hayvanlar
    const out = []; const mx = man.x + (anim ? Math.sin(T / 2600) * 1.2 : 0); const my = man.y + (anim ? Math.cos(T / 3100) * 0.5 : 0);
    out.push([mx + my, snap.fit && snap.fit !== 'a' ? `farmer_${snap.fit}` : 'farmer', mx, my, 0]);
    if (snap.pet) out.push([mx + my + 1.3, snap.pet, mx + 0.8, my + 0.5, 0]);
    for (const [t, x, y, , w = 1, h = 1] of objs) { const an = snap.a?.[t]; if (!Array.isArray(an) || !SPOTS[t]) continue; for (let i = 0; i < Math.min(4, an[1]); i++) { const [dx, dy] = SPOTS[t][i] || [0, 0]; out.push([0, an[0], x + w / 2 + dx + (anim ? Math.sin(T / 2300 + i * 2.1) * 0.12 : 0), y + h / 2 + dy, 0]); } }
    return out;
  };
  const layout = () => {
    const w = cv.clientWidth; const h = cv.clientHeight; if (!w || !h) return false;
    if (w === W && h === H) return true; W = w; H = h; dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = bg.width = Math.round(W * dpr); cv.height = bg.height = Math.round(H * dpr);
    z = Math.min(0.7, Math.max(0.08, Math.min(W / (x1 - x0 + HW * 1.2), H / (y1 - y0 + HH * 1.6)))); const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2;
    S = (gx, gy) => [W / 2 + ((gx - gy) * HW - cx) * z, H / 2 + ((gx + gy) * HH - cy) * z];
    b.setTransform(dpr, 0, 0, dpr, 0, 0); b.imageSmoothingQuality = 'high';
    const [ox, oy] = S(0, 0); const c = (6 / 512) * z; const pat = b.createPattern(A.grass, 'repeat');
    pat.setTransform(new DOMMatrix([HW * c, HH * c, -HW * c, HH * c, ox, oy])); b.fillStyle = pat; b.fillRect(0, 0, W, H);
    const list = objs.map((o) => [o[1] + o[2] + ((o[4] || 1) + (o[5] || 1)) / 2, o]).sort((p, q) => p[0] - q[0]);
    for (const [, o] of list) { const [t, x, y, st, ow = 1, oh = 1] = o; const [sx, sy] = S(x + ow / 2, y + oh / 2); sp(b, t === 'plot' ? st || 'plot' : t, sx, sy); }
    return true;
  };
  const draw = (T) => {
    if (!layout()) return; g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(bg, 0, 0); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingQuality = 'high';
    for (const [, k, x, y, up] of actors(T)) { const [sx, sy] = S(x, y); sp(g, k, sx, sy - up); }
  };
  const loop = (ts) => { raf = requestAnimationFrame(loop); if (!cv.isConnected) { cancelAnimationFrame(raf); return; } if (ts - last < 100) return; last = ts; draw(ts); };
  if (anim) raf = requestAnimationFrame(loop); else requestAnimationFrame(() => draw(0));
  return () => cancelAnimationFrame(raf);
}

// Görünür olunca çiz, görünmezken durdur (liste içindeki çok sayıda küçük görüntü için)
export function lazyMini(cv, snap, opt) {
  let stop = null;
  const io = new IntersectionObserver((es) => {
    if (!cv.isConnected) { io.disconnect(); stop?.(); return; }
    const vis = es.some((e) => e.isIntersecting);
    if (vis && !stop) loadArt().then((A) => { if (cv.isConnected && !stop) stop = drawMini(cv, snap, A, opt); }).catch(() => {});
    else if (!vis && stop) { stop(); stop = null; }
  });
  io.observe(cv);
  return () => { io.disconnect(); stop?.(); };
}

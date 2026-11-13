// SwipeFarm görselleri: atlas yükleme ve küçük çiftlik görüntüsü (profil vitrini, haftalık yarışma).
export const AV = '?v=4'; // görsel paketi sürümü: atlas ile resimler tarayıcı önbelleğinde birbirinden kopmasın
let ART = null;
export function loadArt(onp) {
  if (ART) return ART;
  let n = 0; const step = () => onp?.(++n / 4);
  const img = (name) => new Promise((res, rej) => { const i = new Image(); i.onload = () => { step(); res(i); }; i.onerror = () => rej(new Error('Oyun görselleri yüklenemedi. Bağlantını kontrol et.')); i.src = `/img/farm/${name}.webp${AV}`; });
  ART = Promise.all([fetch(`/img/farm/atlas.json${AV}`).then((r) => r.json()).then((j) => { step(); return j; }), img('obj'), img('item'), img('grass')])
    .then(([atlas, obj, item, grass]) => ({ atlas, obj, item, grass })).catch((e) => { ART = null; throw e; });
  return ART;
}

const HW = 136 * Math.SQRT1_2; const HH = HW / 2;
const SPOTS = { coop: [[0.1, 0.55], [0.6, 0.2], [0.55, 0.7], [-0.25, 0.75]], cowpen: [[0.35, 0.45], [-0.4, 0.6], [0.6, -0.2]], sheeppen: [[0.35, 0.45], [-0.4, 0.6], [0.6, -0.2]], goatpen: [[0.3, 0.5], [-0.4, 0.55], [0.6, -0.15]] };

// snap: { n, o: [[tür, x, y, ekin görseli|0, w, h]], fit, pet, a: { ağıl: [hayvan, sayı] } }
// Çiftliğin dolu kısmına odaklanır; anim açıksa çiftçi ve hayvanlar hafifçe kıpırdar. Döndürdüğü fonksiyon animasyonu durdurur.
export function drawMini(cv, snap, A, { anim = true } = {}) {
  const g = cv.getContext('2d'); const objs = snap.o || [];
  const core = objs.filter((o) => !/^(tree|pine|bush|flowers|rock|fence_x|fence_z)$/.test(o[0]));
  const box = (core.length ? core : objs);
  let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
  for (const [, x, y, , w = 1, h = 1] of box) { for (const [gx, gy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) { const sx = (gx - gy) * HW; const sy = (gx + gy) * HH; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy - 150); y1 = Math.max(y1, sy); } }
  if (!Number.isFinite(x0)) { x0 = -HW * 4; x1 = HW * 4; y0 = 0; y1 = HH * 8; }
  const house = objs.find((o) => o[0] === 'house');
  const man = { x: house ? house[1] + 1.5 : 8, y: house ? house[2] + 2.6 : 8 };
  let raf = 0; let last = 0; let W = 0; let H = 0; let dpr = 1;
  const draw = (T) => {
    const w = cv.clientWidth; const h = cv.clientHeight; if (!w || !h) return;
    if (w !== W || h !== H) { W = w; H = h; dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const z = Math.min(0.7, Math.max(0.08, Math.min(W / (x1 - x0 + HW * 1.2), H / (y1 - y0 + HH * 1.6))));
    const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2;
    const S = (gx, gy) => [W / 2 + ((gx - gy) * HW - cx) * z, H / 2 + ((gx + gy) * HH - cy) * z];
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingQuality = 'high';
    const [ox, oy] = S(0, 0); const c = (6 / 512) * z; const pat = g.createPattern(A.grass, 'repeat');
    pat.setTransform(new DOMMatrix([HW * c, HH * c, -HW * c, HH * c, ox, oy])); g.fillStyle = pat; g.fillRect(0, 0, W, H);
    const sp = (k, sx, sy, alpha = 1) => { const a = A.atlas[k]; if (!a) return; g.globalAlpha = alpha; g.drawImage(A[a[0]], a[1], a[2], a[3], a[4], sx - a[5] * z, sy - a[6] * z, a[3] * z, a[4] * z); g.globalAlpha = 1; };
    const list = objs.map((o) => [o[1] + o[2] + ((o[4] || 1) + (o[5] || 1)) / 2, o]);
    const mx = man.x + (anim ? Math.sin(T / 2600) * 1.2 : 0); const my = man.y + (anim ? Math.cos(T / 3100) * 0.5 : 0);
    list.push([mx + my, 'man']); list.sort((a, b) => a[0] - b[0]);
    for (const [, o] of list) {
      if (o === 'man') { const [sx, sy] = S(mx, my); sp(snap.fit && snap.fit !== 'a' ? `farmer_${snap.fit}` : 'farmer', sx, sy - (anim ? Math.abs(Math.sin(T / 120)) * 3 * z : 0)); if (snap.pet) { const [px, py] = S(mx + 0.8, my + 0.5); sp(snap.pet, px, py); } continue; }
      const [t, x, y, st, w = 1, h = 1] = o; const [sx, sy] = S(x + w / 2, y + h / 2);
      sp(t === 'plot' ? st || 'plot' : t, sx, sy);
      const an = snap.a?.[t]; if (an) for (let i = 0; i < an[1]; i++) { const [dx, dy] = SPOTS[t]?.[i] || [0, 0]; const [ax, ay] = S(x + w / 2 + dx + (anim ? Math.sin(T / 2300 + i * 2.1) * 0.12 : 0), y + h / 2 + dy); sp(an[0], ax, ay); }
    }
  };
  const loop = (ts) => { raf = requestAnimationFrame(loop); if (!cv.isConnected) { cancelAnimationFrame(raf); return; } if (ts - last < 80) return; last = ts; draw(ts); };
  if (anim) raf = requestAnimationFrame(loop); else draw(0);
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

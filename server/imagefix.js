// Yüklenen dosyanın gerçek türünü baytlarından anla ve iPhone/Samsung HEIC (HEIF)
// fotoğraflarını her cihazda açılan JPEG'e çevir. Tarayıcıların çoğu HEIC gösteremez.
const jpeg = require('jpeg-js');

const MAX_SIDE = 1920;

// Tarayıcı türü boş ya da "application/octet-stream" gönderdiğinde dosya imzasına bak
function sniff(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.slice(0, 4).toString('latin1') === 'GIF8') return 'image/gif';
  if (buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (buf.slice(4, 8).toString('latin1') === 'ftyp') {
    const brand = buf.slice(8, 12).toString('latin1');
    if (/^(heic|heix|heim|heis|mif1|msf1)$/.test(brand)) return 'image/heic';
    if (/^(avif|avis)$/.test(brand)) return 'image/avif';
    if (brand === 'qt  ') return 'video/quicktime';
    if (/^(M4A |M4B )$/.test(brand)) return 'audio/mp4';
    return 'video/mp4';
  }
  if (buf.slice(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return 'video/webm';
  if (buf.slice(0, 4).toString('latin1') === 'OggS') return 'audio/ogg';
  if (buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WAVE') return 'audio/wav';
  if (buf.slice(0, 4).toString('latin1') === 'fLaC') return 'audio/flac';
  if (buf.slice(0, 3).toString('latin1') === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  return null;
}

const isHeic = (mime) => /^image\/hei[cf](-sequence)?$/i.test(mime || '');

// RGBA görüntüyü kutu ortalamasıyla küçült
function downscale({ width, height, data }, max) {
  const s = Math.min(1, max / Math.max(width, height));
  if (s >= 1) return { width, height, data };
  const w = Math.max(1, Math.round(width * s)); const h = Math.max(1, Math.round(height * s));
  const out = Buffer.alloc(w * h * 4);
  const fx = width / w; const fy = height / h;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * fy); const y1 = Math.min(height, Math.floor((y + 1) * fy)) || y0 + 1;
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * fx); const x1 = Math.min(width, Math.floor((x + 1) * fx)) || x0 + 1;
      let r = 0; let g = 0; let b = 0; let n = 0;
      for (let yy = y0; yy < y1; yy++) {
        let i = (yy * width + x0) * 4;
        for (let xx = x0; xx < x1; xx++, i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
      }
      const o = (y * w + x) * 4;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
    }
  }
  return { width: w, height: h, data: out };
}

async function heicToJpegSync(buf) {
  const decode = require('heic-decode');
  const img = await decode({ buffer: buf });
  const small = downscale({ width: img.width, height: img.height, data: Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength) }, MAX_SIDE);
  const out = jpeg.encode(small, 85).data;
  return new Uint8Array(out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength));
}

// Aynı anda tek dönüşüm; her biri kısa ömürlü bir iş parçacığında
let queue = Promise.resolve();
function heicToJpeg(buf) {
  const run = () => new Promise((resolve, reject) => {
    const { Worker } = require('worker_threads');
    const w = new Worker(require('path').join(__dirname, 'heic-worker.js'), { workerData: buf });
    const timer = setTimeout(() => { w.terminate(); reject(new Error('Dönüştürme zaman aşımı')); }, 45000);
    w.once('message', (m) => { clearTimeout(timer); w.terminate(); m.ok ? resolve(Buffer.from(m.data)) : reject(new Error(m.error)); });
    w.once('error', (e) => { clearTimeout(timer); reject(e); });
  });
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}

// { mime, buffer } → türü düzeltilmiş ve gerekiyorsa JPEG'e çevrilmiş hâli
async function normalize(mime, buffer) {
  let m = String(mime || '').split(';')[0].toLowerCase();
  const sniffed = sniff(buffer);
  if (!m || m === 'application/octet-stream' || (sniffed === 'image/heic' && m.startsWith('image/'))) m = sniffed || m;
  if (isHeic(m) || (sniffed === 'image/heic' && !m.startsWith('video/'))) {
    const t = Date.now();
    const out = await heicToJpeg(buffer);
    console.log(`[upload] HEIC → JPEG ${(buffer.length / 1048576).toFixed(1)} MB → ${(out.length / 1048576).toFixed(1)} MB (${Date.now() - t} ms)`);
    return { mime: 'image/jpeg', buffer: out, converted: true };
  }
  return { mime: m, buffer };
}

// Güvenlik: yalnızca baytlarından tanınan fotoğraf / video / ses kabul edilir. Tarayıcının söylediği türe güvenilmez
// (ör. "image/svg+xml" ya da HTML içeren bir dosya kendi alan adımızdan açılıp betik çalıştıramasın).
const SAFE = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
  'video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/ogg',
  'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/mpeg', 'audio/ogg', 'audio/opus', 'audio/wav', 'audio/webm', 'audio/flac']);
// Aynı kap biçimini paylaşan türler: tarayıcının söylediği daha doğruysa o kullanılır (ör. sesli mesaj audio/webm)
const FAMILY = {
  'video/mp4': ['video/mp4', 'video/quicktime', 'video/3gpp', 'audio/mp4', 'audio/x-m4a', 'audio/aac'],
  'video/quicktime': ['video/quicktime', 'video/mp4'],
  'audio/mp4': ['audio/mp4', 'audio/x-m4a', 'audio/aac', 'video/mp4'],
  'video/webm': ['video/webm', 'audio/webm'],
  'audio/ogg': ['audio/ogg', 'audio/opus', 'video/ogg'],
  'audio/mpeg': ['audio/mpeg', 'audio/aac'],
};
function safeType(claimed, buf) {
  const sniffed = sniff(buf);
  if (!sniffed) return null;
  const c = String(claimed || '').split(';')[0].trim().toLowerCase();
  const t = FAMILY[sniffed]?.includes(c) ? c : sniffed;
  return SAFE.has(t) ? t : null;
}
// Sunarken: betik çalıştıramayan türler (SVG / HTML / XML hariç)
const isSafeType = (m) => /^(image\/(jpeg|png|gif|webp|avif|heic|heif|bmp)|video\/[\w.+-]+|audio\/[\w.+-]+)$/.test(String(m || '').split(';')[0].trim().toLowerCase());

module.exports = { sniff, normalize, isHeic, heicToJpegSync, safeType, isSafeType };

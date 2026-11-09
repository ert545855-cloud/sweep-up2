// Falcı Teyze'nin günlük paylaşım görsellerini üretir (22 tarot kartı + 12 burç + 12 aşk burcu).
// Çıktı: public/img/daily/*.webp (1080x1350). Bir kez çalıştırılır, görseller depoya eklenir.
// Gerekenler: playwright (Chromium), python3 + Pillow (webp dönüşümü), Cormorant Garamond yazı tipi:
//   FONT_DIR=/yol/fontsource-cormorant-garamond/files node scripts/build-daily-cards.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'img', 'daily');
const FONT_DIR = process.env.FONT_DIR;
fs.mkdirSync(OUT, { recursive: true });

const TAROT = [
  ['0', 'Deli'], ['I', 'Büyücü'], ['II', 'Azize'], ['III', 'İmparatoriçe'], ['IV', 'İmparator'], ['V', 'Aziz'], ['VI', 'Aşıklar'],
  ['VII', 'Savaş Arabası'], ['VIII', 'Güç'], ['IX', 'Ermiş'], ['X', 'Kader Çarkı'], ['XI', 'Adalet'], ['XII', 'Asılan Adam'], ['XIII', 'Dönüşüm'],
  ['XIV', 'Denge'], ['XV', 'Şeytan'], ['XVI', 'Kule'], ['XVII', 'Yıldız'], ['XVIII', 'Ay'], ['XIX', 'Güneş'], ['XX', 'Mahkeme'], ['XXI', 'Dünya'],
];
const ZODIAC = [
  ['koc', 'Koç', '21 Mart – 19 Nisan', 'Ateş'], ['boga', 'Boğa', '20 Nisan – 20 Mayıs', 'Toprak'], ['ikizler', 'İkizler', '21 Mayıs – 20 Haziran', 'Hava'],
  ['yengec', 'Yengeç', '21 Haziran – 22 Temmuz', 'Su'], ['aslan', 'Aslan', '23 Temmuz – 22 Ağustos', 'Ateş'], ['basak', 'Başak', '23 Ağustos – 22 Eylül', 'Toprak'],
  ['terazi', 'Terazi', '23 Eylül – 22 Ekim', 'Hava'], ['akrep', 'Akrep', '23 Ekim – 21 Kasım', 'Su'], ['yay', 'Yay', '22 Kasım – 21 Aralık', 'Ateş'],
  ['oglak', 'Oğlak', '22 Aralık – 19 Ocak', 'Toprak'], ['kova', 'Kova', '20 Ocak – 18 Şubat', 'Hava'], ['balik', 'Balık', '19 Şubat – 20 Mart', 'Su'],
];

// 22 büyük arkana için sade altın çizim (200x200)
const ray = (cx, cy, r1, r2, n, off = 0) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2 + off; return `M${(cx + Math.cos(a) * r1).toFixed(1)} ${(cy + Math.sin(a) * r1).toFixed(1)}L${(cx + Math.cos(a) * r2).toFixed(1)} ${(cy + Math.sin(a) * r2).toFixed(1)}`; }).join('');
const star = (cx, cy, R, r, n = 5, rot = -Math.PI / 2) => `M${Array.from({ length: n * 2 }, (_, i) => { const a = rot + (i * Math.PI) / n; const rr = i % 2 ? r : R; return `${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`; }).join('L')}Z`;
const SYM = [
  `<circle cx="150" cy="48" r="16"/><path d="${ray(150, 48, 24, 34, 8)}"/><path d="M40 168L120 78"/><circle cx="128" cy="70" r="16"/><path d="M20 176H120l18 18M138 176h42"/>`,
  `<path d="M70 44c-14-16-40-6-40 10s26 26 40 10c14-16 30-26 46-10s-2 30-16 30-30-14-30-14"/><path d="M100 112V184"/><path d="${star(100, 100, 14, 6)}"/><path d="M90 184h20"/>`,
  `<path d="M48 40v140M152 40v140M40 40h16M144 40h16M40 180h16M144 180h16"/><path d="M118 82a30 30 0 1 1-12-36 24 24 0 1 0 12 36z"/><path d="${star(100, 148, 13, 5, 4, 0)}"/>`,
  `<path d="M60 70l14-26 26 20 26-20 14 26z"/><circle cx="100" cy="128" r="16"/><path d="M100 112c0-22 26-22 26 0 22 0 22 26 0 26 0 22-26 22-26 0-22 0-22-26 0-26 0-22 26-22 26 0"/><path d="M100 160v26"/>`,
  `<path d="M48 108l20-44 32 30 32-30 20 44z"/><path d="M48 108h104v20H48z"/><path d="M60 150h80M70 150v34M130 150v34M60 184h80"/>`,
  `<path d="M100 28v156M74 62h52M82 96h36M64 130h72"/><circle cx="100" cy="28" r="6"/>`,
  `<path d="M78 76c-16-24-52-8-36 22 8 16 36 34 36 34s28-18 36-34c16-30-20-46-36-22z"/><path d="M124 104c-16-24-52-8-36 22 8 16 36 34 36 34s28-18 36-34c16-30-20-46-36-22z"/><path d="${star(100, 32, 10, 4)}"/>`,
  `<circle cx="100" cy="128" r="46"/><circle cx="100" cy="128" r="8"/><path d="${ray(100, 128, 12, 42, 8)}"/><path d="M40 70h120M56 70l10-24h68l10 24"/><path d="${star(100, 34, 10, 4)}"/>`,
  `<path d="M70 50c-14-14-36-4-36 10s22 24 36 10c14-14 28-24 42-10s-2 26-14 26-28-14-28-14"/><circle cx="100" cy="134" r="28"/><path d="${ray(100, 134, 32, 50, 14)}"/><path d="M90 130h1M110 130h1M94 146q6 6 12 0"/>`,
  `<path d="M100 26v22"/><path d="M78 56h44l-6 14H84z"/><path d="M84 70h32v66H84z"/><path d="${star(100, 103, 13, 5, 4, 0)}"/><path d="M78 136h44l-8 14H86z"/><path d="M146 40v148"/>`,
  `<circle cx="100" cy="106" r="70"/><circle cx="100" cy="106" r="50"/><circle cx="100" cy="106" r="10"/><path d="${ray(100, 106, 10, 70, 8, Math.PI / 8)}"/>`,
  `<path d="M100 30v150M56 60h88M70 180h60"/><path d="M56 60l-22 50h44zM144 60l-22 50h44z"/><path d="M34 110a22 12 0 0 0 44 0M122 110a22 12 0 0 0 44 0"/><circle cx="100" cy="30" r="7"/>`,
  `<path d="M36 34h128M60 34v20M140 34v20"/><path d="M100 34v52"/><path d="M76 86h48l-24 52z"/><circle cx="100" cy="158" r="18"/><path d="${ray(100, 158, 24, 34, 10)}"/>`,
  `<path d="M100 60v96"/><path d="M100 76c-22-40-70-30-60 4 6 20 40 24 60 8M100 76c22-40 70-30 60 4-6 20-40 24-60 8"/><path d="M100 104c-18 4-50 18-42 40 8 18 36 6 42-20M100 104c18 4 50 18 42 40-8 18-36 6-42-20"/><path d="M100 60l-10-22M100 60l10-22"/>`,
  `<path d="M46 52h40l-6 36a14 14 0 0 1-28 0z"/><path d="M114 120h40l-6 36a14 14 0 0 1-28 0z"/><path d="M80 70c40 0 50 20 52 46" stroke-dasharray="2 10"/><path d="${star(100, 180, 9, 4)}"/>`,
  `<rect x="44" y="40" width="40" height="56" rx="20"/><rect x="80" y="82" width="40" height="56" rx="20"/><rect x="116" y="124" width="40" height="56" rx="20"/>`,
  `<path d="M62 186V82h76v104"/><path d="M62 82V62h14v12h14V62h20v12h14V62h14v20"/><path d="M92 186v-30a8 8 0 0 1 16 0v30M86 110h10v14H86zM104 110h10v14h-10z"/><path d="M150 20l-24 40h18l-16 34"/>`,
  `<path d="${star(100, 92, 56, 22, 8)}"/><path d="${star(42, 160, 12, 5, 4)}"/><path d="${star(160, 166, 10, 4, 4)}"/><path d="${star(150, 32, 8, 3, 4)}"/>`,
  `<path d="M128 40a62 62 0 1 0 0 120 50 50 0 1 1 0-120z"/><path d="M30 184q15-10 30 0t30 0 30 0 30 0 30 0"/><path d="${star(150, 70, 8, 3, 4)}"/>`,
  `<circle cx="100" cy="100" r="40"/><path d="${ray(100, 100, 52, 80, 12)}"/><path d="${ray(100, 100, 52, 66, 12, Math.PI / 12)}"/><path d="M84 92h1M116 92h1M86 112q14 12 28 0"/>`,
  `<path d="M44 132l84-60v84z"/><path d="M128 72c10 0 18 18 18 42s-8 42-18 42"/><path d="M44 132l-16 10"/><path d="M158 82q12 32 0 64M170 70q20 44 0 88"/><path d="M60 178h80"/>`,
  `<ellipse cx="100" cy="106" rx="52" ry="76"/><circle cx="100" cy="106" r="30"/><path d="M70 106h60M100 76v60"/><path d="M78 92q22 8 44 0M78 120q22-8 44 0"/><path d="M48 70l-12-6M152 70l12-6M48 142l-12 6M152 142l12 6"/>`,
];

const css = `
${FONT_DIR ? ['500', '600', '700'].map((w) => `@font-face{font-family:Cormorant;font-weight:${w};src:url(file://${FONT_DIR}/cormorant-garamond-latin-ext-${w}-normal.woff2) format('woff2');unicode-range:U+0100-024F,U+1E00-1EFF}
@font-face{font-family:Cormorant;font-weight:${w};src:url(file://${FONT_DIR}/cormorant-garamond-latin-${w}-normal.woff2) format('woff2')}`).join('\n') : ''}
*{box-sizing:border-box;margin:0}
body{width:1080px;height:1350px;overflow:hidden;font-family:Inter,sans-serif;color:#fff}
.bg{position:absolute;inset:0;background:radial-gradient(60% 40% at 15% 8%,rgba(255,138,61,.35),transparent 70%),radial-gradient(55% 45% at 92% 92%,rgba(236,72,153,.38),transparent 70%),radial-gradient(90% 70% at 50% 40%,#3b145f 0%,#1e0b33 55%,#0c0516 100%)}
.bg.love{background:radial-gradient(60% 40% at 15% 8%,rgba(255,120,140,.42),transparent 70%),radial-gradient(55% 45% at 92% 92%,rgba(255,61,110,.45),transparent 70%),radial-gradient(90% 70% at 50% 40%,#5a1236 0%,#2a0a20 55%,#12040d 100%)}
.stars{position:absolute;inset:0}
.top{position:absolute;top:74px;left:0;right:0;text-align:center;letter-spacing:.42em;font-size:24px;font-weight:700;color:#f6d38b;text-transform:uppercase}
.top i{display:block;width:120px;height:2px;margin:18px auto 0;background:linear-gradient(90deg,transparent,#f6d38b,transparent)}
.foot{position:absolute;bottom:62px;left:0;right:0;text-align:center}
.foot b{font-size:30px;font-weight:800;letter-spacing:-.01em}
.foot small{display:block;margin-top:8px;font-size:22px;color:rgba(255,255,255,.7);font-family:Cormorant,serif;font-style:italic;font-weight:600;font-size:28px}
.card{position:absolute;left:50%;top:170px;width:600px;height:900px;transform:translateX(-50%);border-radius:34px;padding:16px;
  background:linear-gradient(160deg,#f9e2a6,#c8963e 40%,#f6d38b 60%,#a8741f);box-shadow:0 40px 90px -30px rgba(0,0,0,.8),0 0 120px -20px rgba(246,211,139,.35)}
.in{position:relative;height:100%;border-radius:22px;overflow:hidden;background:radial-gradient(80% 60% at 50% 35%,#5b1f86,#2a0d45 70%,#170726);border:2px solid rgba(246,211,139,.55)}
.in::before{content:"";position:absolute;inset:16px;border:2px solid rgba(246,211,139,.4);border-radius:14px}
.num{position:absolute;top:52px;left:0;right:0;text-align:center;font-family:Cormorant,serif;font-size:64px;font-weight:700;color:#f6d38b;letter-spacing:.08em}
.sym{position:absolute;left:50%;top:200px;width:430px;height:430px;transform:translateX(-50%);filter:drop-shadow(0 0 22px rgba(246,211,139,.55))}
.sym svg{width:100%;height:100%;fill:none;stroke:#f6d38b;stroke-width:5;stroke-linecap:round;stroke-linejoin:round}
.name{position:absolute;bottom:70px;left:20px;right:20px;text-align:center;font-family:Cormorant,serif;font-weight:700;font-size:78px;line-height:1;color:#fff4d6}
.halo{position:absolute;left:50%;top:330px;width:560px;height:560px;transform:translate(-50%,0);border-radius:50%;background:radial-gradient(closest-side,rgba(255,255,255,.18),transparent);}
.zic{position:absolute;left:50%;top:380px;width:400px;height:400px;transform:translateX(-50%);filter:drop-shadow(0 30px 60px rgba(0,0,0,.5))}
.zic svg{width:100%;height:100%;display:block}
.ring{position:absolute;left:50%;top:330px;width:500px;height:500px;transform:translateX(-50%);border-radius:50%;border:2px solid rgba(246,211,139,.45)}
.ring::after{content:"";position:absolute;inset:-22px;border-radius:50%;border:1px dashed rgba(246,211,139,.3)}
.zname{position:absolute;top:880px;left:0;right:0;text-align:center;font-family:Cormorant,serif;font-weight:700;font-size:120px;line-height:1;color:#fff4d6}
.zdate{position:absolute;top:1018px;left:0;right:0;text-align:center;font-size:30px;color:rgba(255,255,255,.78)}
.chip{position:absolute;top:1078px;left:50%;transform:translateX(-50%);padding:10px 26px;border-radius:999px;border:2px solid rgba(246,211,139,.6);color:#f6d38b;font-weight:700;font-size:24px;letter-spacing:.2em;text-transform:uppercase}
.heart{position:absolute;left:50%;top:300px;width:170px;transform:translateX(150px);opacity:.9}
`;
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const stars = () => `<svg class="stars" viewBox="0 0 1080 1350">${Array.from({ length: 140 }, () => `<circle cx="${(rnd() * 1080).toFixed(0)}" cy="${(rnd() * 1350).toFixed(0)}" r="${(rnd() * 2.2 + 0.4).toFixed(1)}" fill="#fff" opacity="${(rnd() * 0.6 + 0.15).toFixed(2)}"/>`).join('')}${Array.from({ length: 10 }, () => { const x = rnd() * 1080; const y = rnd() * 1350; return `<path d="M${x} ${y - 9}L${x + 2} ${y - 2}L${x + 9} ${y}L${x + 2} ${y + 2}L${x} ${y + 9}L${x - 2} ${y + 2}L${x - 9} ${y}L${x - 2} ${y - 2}Z" fill="#f6d38b" opacity=".7"/>`; }).join('')}</svg>`;
const foot = '<div class="foot"><b>Falcı Teyze · SwipeUp</b><small>Kalbinin soramadıklarını, Falcı Teyze’ye sor</small></div>';
const page = (body, love) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="bg ${love ? 'love' : ''}"></div>${stars()}${body}${foot}</body></html>`;
const zsvg = (id) => fs.readFileSync(path.join(ROOT, 'public', 'img', 'eg', `z-${id}.svg`), 'utf8');
const HEART = '<svg class="heart" viewBox="0 0 100 90"><path d="M50 86S6 58 6 30C6 14 18 4 31 4c9 0 15 5 19 12 4-7 10-12 19-12 13 0 25 10 25 26 0 28-44 56-44 56z" fill="#ff3d6e" stroke="#fff" stroke-width="3"/></svg>';

(async () => {
  const br = await chromium.launch();
  const p = await br.newPage({ viewport: { width: 1080, height: 1350 } });
  const jobs = [];
  TAROT.forEach(([num, name], i) => jobs.push([`tarot-${i}`, page(`<div class="top">Günün Tarot Kartı<i></i></div><div class="card"><div class="in"><div class="num">${num}</div><div class="sym"><svg viewBox="0 0 200 200">${SYM[i]}</svg></div><div class="name">${name}</div></div></div>`)]));
  ZODIAC.forEach(([id, name, dates, el]) => {
    jobs.push([`burc-${id}`, page(`<div class="top">Günün Burcu<i></i></div><div class="halo"></div><div class="ring"></div><div class="zic">${zsvg(id)}</div><div class="zname">${name}</div><div class="zdate">${dates}</div><div class="chip">${el} grubu</div>`)]);
    jobs.push([`ask-${id}`, page(`<div class="top">Aşkın Yıldızı<i></i></div><div class="halo"></div><div class="ring"></div><div class="zic">${zsvg(id)}</div>${HEART}<div class="zname">${name}</div><div class="zdate">Bugün aşkta şans bu burçtan yana</div><div class="chip">${el} grubu</div>`, true)]);
  });
  for (const [name, html] of jobs.filter(([n]) => !process.env.ONLY || process.env.ONLY.split(',').includes(n))) {
    const tmp = path.join(OUT, `${name}.html`); fs.writeFileSync(tmp, html);
    await p.goto(`file://${tmp}`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(80);
    const png = path.join(OUT, `${name}.png`); await p.screenshot({ path: png }); fs.unlinkSync(tmp);
    execFileSync('python3', ['-c', `from PIL import Image;Image.open(${JSON.stringify(png)}).convert('RGB').save(${JSON.stringify(png.replace(/\.png$/, '.webp'))},'WEBP',quality=84,method=6)`]);
    fs.unlinkSync(png);
  }
  await br.close();
  console.log(`${jobs.length} görsel üretildi → ${OUT}`);
})();

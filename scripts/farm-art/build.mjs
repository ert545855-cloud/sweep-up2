// Kullanım: node scripts/farm-art/build.mjs [çıktı klasörü] [ad filtresi] [parça i/n]
// PNG + meta üretir; scripts/farm-art/pack.py bunları atlas (WebP) olarak public/img/farm altına paketler.
import fs from 'node:fs';
import path from 'node:path';
import { render, writePng } from './sdf.mjs';
import { SCENES } from './scenes.mjs';

const out = process.argv[2] || '/tmp/farmart'; const filter = process.argv[3] && process.argv[3] !== '-' ? new RegExp(process.argv[3]) : null;
const [pi, pn] = (process.argv[4] || '0/1').split('/').map(Number);
fs.mkdirSync(out, { recursive: true });
const names = Object.keys(SCENES).filter((n) => !filter || filter.test(n)).filter((_, i) => i % pn === pi);
for (const n of names) {
  const t0 = Date.now(); const sc = SCENES[n];
  const r = render(sc.build(), sc.opt || {});
  writePng(path.join(out, `${n}.png`), r);
  fs.writeFileSync(path.join(out, `${n}.json`), JSON.stringify({ w: r.w, h: r.h, ax: r.ax, ay: r.ay, set: sc.set || 'obj' }));
  console.log(n, `${r.w}x${r.h}`, `${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

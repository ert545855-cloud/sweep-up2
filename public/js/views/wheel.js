// Haftalık hediye çarkı (ödül görselleri Canva'da tasarlandı: /img/wheel)
import { icon } from '../icons.js';
import { api, esc, toast, state, emit } from '../core.js';

const WIN = [['#ff6aa2', '#e0336f'], ['#ffb547', '#f07b12'], ['#9a6bff', '#5b21b6'], ['#3fd9bd', '#109a82'], ['#6aa5ff', '#2f5fe0'], ['#ff7a7a', '#d93a3a'], ['#ffd84a', '#d99a00'], ['#c86bff', '#8a1fd1']];
const PAS = ['#3a2160', '#24113f'];

function wheelSvg(slices) {
  const n = slices.length; const R = 150; const a = (2 * Math.PI) / n;
  const pt = (ang, r) => [R + r * Math.sin(ang), R - r * Math.cos(ang)];
  const imgR = R * 0.58; const size = Math.max(30, Math.min(58, ((2 * Math.PI * imgR) / n) * 0.8));
  let wi = 0;
  const defs = []; const parts = [];
  slices.forEach((s, i) => {
    const [c1, c2] = s.win ? WIN[wi++ % WIN.length] : PAS;
    defs.push(`<radialGradient id="whg${i}" cx="150" cy="150" r="150" gradientUnits="userSpaceOnUse"><stop offset=".15" stop-color="${c2}"/><stop offset="1" stop-color="${c1}"/></radialGradient>`);
    const [x1, y1] = pt(i * a, R); const [x2, y2] = pt((i + 1) * a, R);
    const mid = (i + 0.5) * a; const rot = (mid * 180) / Math.PI;
    const [ix, iy] = pt(mid, imgR); const [tx, ty] = pt(mid, R * 0.87);
    parts.push(`<path d="M${R},${R} L${x1},${y1} A${R},${R} 0 0 1 ${x2},${y2} Z" fill="url(#whg${i})"/>
      <g transform="rotate(${rot} ${ix} ${iy})"><image href="${esc(s.img)}" x="${ix - size / 2}" y="${iy - size / 2}" width="${size}" height="${size}" ${s.win ? '' : 'opacity=".9"'}/></g>
      <text x="${tx}" y="${ty}" class="wh-tx ${s.win ? '' : 'pas'}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${rot} ${tx} ${ty})">${esc(s.short || s.label)}</text>`);
  });
  const lines = slices.map((_, i) => { const [x, y] = pt(i * a, R); return `<line x1="${R}" y1="${R}" x2="${x}" y2="${y}"/>`; }).join('');
  return `<svg viewBox="0 0 300 300" class="wh-svg"><defs>${defs.join('')}</defs>${parts.join('')}<g class="wh-sep">${lines}</g><circle cx="150" cy="150" r="149" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="2"/></svg>`;
}

function rimSvg() {
  const N = 20; const b = Array.from({ length: N }, (_, i) => {
    const t = (i / N) * 2 * Math.PI; const x = 50 + 46.6 * Math.sin(t); const y = 50 - 46.6 * Math.cos(t);
    return `<circle cx="${x}" cy="${y}" r="1.55" class="bulb ${i % 2 ? 'b2' : 'b1'}"/>`;
  }).join('');
  return `<svg viewBox="0 0 100 100" class="wh-rim">${b}</svg>`;
}

const PIN = `<svg class="wh-pin" viewBox="0 0 40 52"><defs><linearGradient id="whp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6c2"/><stop offset=".5" stop-color="#ffc926"/><stop offset="1" stop-color="#c97a00"/></linearGradient></defs><path d="M20 50 L4 18 A17 17 0 1 1 36 18 Z" fill="url(#whp)" stroke="#8a4f00" stroke-width="2.5" stroke-linejoin="round"/><circle cx="20" cy="17" r="6" fill="#ff4f8b" stroke="#8a4f00" stroke-width="2"/><circle cx="18" cy="15" r="2" fill="#fff" opacity=".8"/></svg>`;

export default async function wheel(view) {
  view.innerHTML = `<header class="topbar"><button class="ib" data-back="#/" aria-label="Geri">${icon('back')}</button><div class="center">Hediye çarkı</div><span class="ib"></span></header><div class="wh"><div class="spinner"></div></div>`;
  const box = view.querySelector('.wh');
  let w = await api('/wheel');
  let rot = 0;
  const left = () => { const ms = Math.max(0, w.nextAt - Date.now()); const d = Math.floor(ms / 86400000); const h = Math.floor((ms % 86400000) / 3600000); return d ? `${d} gün ${h} saat` : `${h} saat ${Math.floor((ms % 3600000) / 60000)} dk`; };
  const prizes = () => { const seen = new Set(); return w.slices.filter((s) => s.win && !seen.has(s.id) && seen.add(s.id)); };
  const paint = () => {
    if (!w.enabled) { box.innerHTML = '<div class="empty">Çark şu an kapalı.</div>'; return; }
    const last = w.last;
    box.innerHTML = `<p class="wh-sub">Her hafta bir kez çevir, çark her <b>cuma</b> yenilenir.</p>
      <div class="wh-stage"><div class="wh-wrap">${rimSvg()}<div class="wh-disc"><div class="wh-rot" style="transform:rotate(${rot}deg)">${wheelSvg(w.slices)}</div></div><div class="wh-hub"><img src="/img/wheel/gift.svg" alt=""></div>${PIN}</div><div class="wh-base"></div></div>
      ${w.canSpin ? '<button class="btn primary block wh-go">Çevir!</button>' : `<div class="wh-last">${last ? `<div class="row" style="gap:10px;justify-content:center"><img class="wh-li" src="${esc(last.prize?.img || '/img/wheel/pas.svg')}" alt=""><b>${esc(last.text)}</b></div>` : ''}<small>Sıradaki çevirme hakkın: <b>${left()}</b> sonra (cuma)</small></div>`}
      <div class="wh-list"><h3 class="shop-h">Hediyeler</h3><div class="wh-prz">${prizes().map((s) => `<div class="wh-pz"><img src="${esc(s.img)}" alt=""><span>${esc(s.label)}</span></div>`).join('')}</div></div>`;
    box.querySelector('.wh-go')?.addEventListener('click', spin);
  };
  async function spin(e) {
    e.target.disabled = true;
    let r;
    try { r = await api('/wheel/spin', { body: {} }); } catch (er) { toast(er.message); e.target.disabled = false; return; }
    const n = w.slices.length; const per = 360 / n;
    const target = 360 - (r.index + 0.5) * per + (Math.random() - 0.5) * per * 0.6;
    rot = rot - (rot % 360) + 360 * 6 + target;
    const el = box.querySelector('.wh-rot');
    box.querySelector('.wh-wrap').classList.add('spinning');
    el.style.transition = 'transform 5s cubic-bezier(.12,.75,.12,1)';
    el.style.transform = `rotate(${rot}deg)`;
    navigator.vibrate?.(20);
    setTimeout(() => {
      w = r;
      const win = !!r.prize;
      const ov = document.createElement('div'); ov.className = `wh-res ${win ? 'win' : ''}`;
      ov.innerHTML = `<div class="wh-card"><div class="wh-big">${win ? '<i class="wh-rays"></i>' : ''}<img src="${esc(win ? r.prize.img : '/img/wheel/pas.svg')}" alt=""></div><h2>${win ? 'Kazandın!' : 'PAS!'}</h2>${win ? `<div class="wh-prize">${esc(r.prize.label)}</div>` : ''}<p>${esc(r.text)}</p><button class="btn primary block">Tamam</button></div>`;
      ov.querySelector('button').onclick = () => { ov.remove(); paint(); };
      document.body.append(ov);
      if (win) { navigator.vibrate?.([30, 60, 30]); api('/me').then((m) => { Object.assign(state.me, m); emit('me', state.me); }).catch(() => {}); }
    }, 5200);
  }
  paint();
  return () => document.querySelector('.wh-res')?.remove();
}

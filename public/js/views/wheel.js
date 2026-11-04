// Haftalık hediye çarkı
import { icon } from '../icons.js';
import { api, esc, toast, state, emit } from '../core.js';

const COLORS = ['#ff4f8b', '#2b1747', '#ff9f43', '#3b1f63', '#7c3aed', '#2b1747', '#22c3a6', '#3b1f63', '#f5b700', '#2b1747', '#4f8bff', '#3b1f63', '#ff6b6b', '#2b1747'];

function wheelSvg(slices) {
  const n = slices.length; const R = 150; const a = (2 * Math.PI) / n;
  const pt = (ang, r) => [R + r * Math.sin(ang), R - r * Math.cos(ang)];
  return `<svg viewBox="0 0 300 300" class="wh-svg">${slices.map((s, i) => {
    const [x1, y1] = pt(i * a, R); const [x2, y2] = pt((i + 1) * a, R);
    const mid = (i + 0.5) * a; const [tx, ty] = pt(mid, R * 0.66); const [ex, ey] = pt(mid, R * 0.86);
    const rot = (mid * 180) / Math.PI;
    return `<path d="M${R},${R} L${x1},${y1} A${R},${R} 0 0 1 ${x2},${y2} Z" fill="${s.win ? COLORS[i % COLORS.length] : (i % 4 === 1 ? '#2b1747' : '#3b1f63')}" stroke="rgba(255,255,255,.25)" stroke-width="1"/>
      <text x="${ex}" y="${ey}" font-size="20" text-anchor="middle" dominant-baseline="middle" transform="rotate(${rot} ${ex} ${ey})">${esc(s.em)}</text>
      <text x="${tx}" y="${ty}" font-size="${s.win ? 11 : 12}" font-weight="800" fill="#fff" text-anchor="middle" dominant-baseline="middle" transform="rotate(${rot} ${tx} ${ty})">${esc(s.short || s.label)}</text>`;
  }).join('')}<circle cx="150" cy="150" r="26" fill="#fff"/><text x="150" y="152" font-size="22" text-anchor="middle" dominant-baseline="middle">🎁</text></svg>`;
}

export default async function wheel(view) {
  view.innerHTML = `<header class="topbar"><button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/')" aria-label="Geri">${icon('back')}</button><div class="center">Hediye çarkı</div><span class="ib"></span></header><div class="wh"><div class="spinner"></div></div>`;
  const box = view.querySelector('.wh');
  let w = await api('/wheel');
  let rot = 0;
  const left = () => { const ms = Math.max(0, w.nextAt - Date.now()); const d = Math.floor(ms / 86400000); const h = Math.floor((ms % 86400000) / 3600000); return d ? `${d} gün ${h} saat` : `${h} saat ${Math.floor((ms % 3600000) / 60000)} dk`; };
  const paint = () => {
    if (!w.enabled) { box.innerHTML = '<div class="empty">Çark şu an kapalı.</div>'; return; }
    box.innerHTML = `<p class="wh-sub">Her hafta bir kez çevir! Hediye çıkma ihtimali <b>%${w.winChance}</b>. Çark her <b>cuma</b> yenilenir.</p>
      <div class="wh-wrap"><i class="wh-pin"></i><div class="wh-rot" style="transform:rotate(${rot}deg)">${wheelSvg(w.slices)}</div></div>
      ${w.canSpin ? '<button class="btn primary block wh-go">🎡 Çevir!</button>' : `<div class="wh-last">${w.last ? `<b>${esc(w.last.text)}</b>` : ''}<small>Sıradaki çevirme hakkın: <b>${left()}</b> sonra (cuma)</small></div>`}
      <div class="wh-list"><h3 class="shop-h">Hediyeler</h3>${w.slices.filter((s) => s.win).map((s) => `<span class="chip">${s.em} ${esc(s.label)}</span>`).join('')}</div>`;
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
    el.style.transition = 'transform 5s cubic-bezier(.12,.75,.12,1)';
    el.style.transform = `rotate(${rot}deg)`;
    navigator.vibrate?.(20);
    setTimeout(() => {
      w = r;
      const win = !!r.prize;
      const ov = document.createElement('div'); ov.className = `wh-res ${win ? 'win' : ''}`;
      ov.innerHTML = `<div class="wh-card"><div class="wh-big">${win ? r.prize.em : '😂'}</div><h2>${win ? 'Kazandın!' : 'PAS!'}</h2><p>${esc(r.text)}</p><button class="btn primary block">Tamam</button></div>`;
      ov.querySelector('button').onclick = () => { ov.remove(); paint(); };
      document.body.append(ov);
      if (win) { navigator.vibrate?.([30, 60, 30]); api('/me').then((m) => { Object.assign(state.me, m); emit('me', state.me); }).catch(() => {}); }
    }, 5200);
  }
  paint();
  return () => document.querySelector('.wh-res')?.remove();
}

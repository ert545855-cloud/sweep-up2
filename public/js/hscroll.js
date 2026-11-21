// Bilgisayarda (fare) yana kayan şeritler: telefonda parmakla kaydırılan her şerit (hikâyeler, yeni üyeler, çoklu
// fotoğraflı gönderiler, mağaza kategorileri, emoji/çıkartma sıraları…) fareyle de gezilebilsin.
// - Şeridin üstüne gelince iki yanda ‹ › düğmeleri çıkar (başta/sonda gizlenir); tıklayınca bir ekran kayar.
// - Fareyle tutup sürükleyerek de kaydırılır; sürükleme sonrası tıklama (bağlantıya gitme) yapılmaz.
// Telefonda ve dokunmatik ekranda hiçbir şey eklenmez. Kendi okları olan şeritler (ana sayfa kartları) ve oyunlar hariç.
import { icon } from './icons.js';

const SKIP = '.pr-track, [data-no-hnav], .k3, .ok-wrap, .pk-wrap, .rk-hand, .sf, .chat .msgs';

export function initHScroll() {
  if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return;
  const can = (el) => {
    if (!(el instanceof HTMLElement)) return false;
    const ox = getComputedStyle(el).overflowX;
    return (ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 4;
  };
  const find = (t) => {
    if (document.documentElement.dataset.game != null) return null; // oyunlar kendi kontrolünü kullanır
    for (let el = t; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      if (el.matches?.(SKIP)) return null;
      if (can(el)) return el;
    }
    return null;
  };

  // ---- Ok düğmeleri (tek çift; üstüne gelinen şeride taşınır) ----
  const mk = (cls, lbl) => { const b = document.createElement('button'); b.type = 'button'; b.className = `hnav ${cls}`; b.setAttribute('aria-label', lbl); b.innerHTML = icon('back'); b.hidden = true; document.body.append(b); return b; };
  const prev = mk('prev', 'Sola kaydır'); const next = mk('next', 'Sağa kaydır');
  let cur = null; let hideT = 0; let raf = 0;
  const place = () => {
    raf = 0;
    if (!cur || !cur.isConnected || !can(cur)) { prev.hidden = true; next.hidden = true; return; }
    const r = cur.getBoundingClientRect();
    if (r.height < 36 || r.bottom < 0 || r.top > window.innerHeight) { prev.hidden = true; next.hidden = true; return; }
    const y = `${Math.round(r.top + r.height / 2)}px`;
    prev.style.top = y; next.style.top = y;
    prev.style.left = `${Math.round(r.left + 6)}px`; next.style.left = `${Math.round(r.right - 6 - 34)}px`;
    prev.hidden = cur.scrollLeft < 4;
    next.hidden = cur.scrollLeft + cur.clientWidth > cur.scrollWidth - 4;
  };
  const sched = () => { if (!raf) raf = requestAnimationFrame(place); };
  const show = (el) => {
    clearTimeout(hideT);
    if (cur !== el) { cur?.removeEventListener('scroll', sched); cur = el; el.addEventListener('scroll', sched, { passive: true }); }
    sched();
  };
  const hide = () => { clearTimeout(hideT); hideT = setTimeout(() => { cur?.removeEventListener('scroll', sched); cur = null; prev.hidden = true; next.hidden = true; }, 220); };
  document.addEventListener('mouseover', (e) => {
    if (e.target === prev || e.target === next || prev.contains(e.target) || next.contains(e.target)) { clearTimeout(hideT); return; }
    const el = find(e.target);
    if (el) show(el); else if (cur) hide();
  }, { passive: true });
  document.addEventListener('scroll', () => { if (cur) sched(); }, { passive: true, capture: true });
  window.addEventListener('resize', () => { if (cur) sched(); });
  window.addEventListener('hashchange', () => { cur = null; prev.hidden = true; next.hidden = true; });
  const go = (dir) => { if (!cur) return; cur.scrollBy({ left: dir * Math.max(120, cur.clientWidth * 0.8), behavior: 'smooth' }); };
  prev.onclick = (e) => { e.preventDefault(); e.stopPropagation(); go(-1); };
  next.onclick = (e) => { e.preventDefault(); e.stopPropagation(); go(1); };

  // ---- Fareyle sürükleyerek kaydırma ----
  let drag = null; let swallow = false;
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable], .hnav')) return;
    const el = find(e.target); if (!el) return;
    drag = { el, x: e.clientX, left: el.scrollLeft, moved: false, snap: el.style.scrollSnapType };
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 6) return;
    if (!drag.moved) { drag.moved = true; drag.el.style.scrollSnapType = 'none'; drag.el.style.scrollBehavior = 'auto'; document.documentElement.classList.add('hdrag'); }
    drag.el.scrollLeft = drag.left - dx;
  });
  const end = () => {
    if (!drag) return;
    if (drag.moved) {
      swallow = true; setTimeout(() => { swallow = false; }, 0);
      const { el, snap } = drag; el.style.scrollBehavior = ''; requestAnimationFrame(() => { el.style.scrollSnapType = snap; }); // bırakınca en yakın karta oturur
      document.documentElement.classList.remove('hdrag');
    }
    drag = null;
  };
  document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
  document.addEventListener('click', (e) => { if (swallow) { e.preventDefault(); e.stopPropagation(); swallow = false; } }, true); // sürükleme bitince bağlantı açılmasın
  document.addEventListener('dragstart', (e) => { if (find(e.target)) e.preventDefault(); }); // görsel "hayalet" sürüklenmesin
}

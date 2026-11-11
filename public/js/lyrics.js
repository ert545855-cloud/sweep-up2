// Karaoke sözleri: LRC (zaman damgalı) ya da düz metni ayrıştırır ve ekranda gösterir.
import { esc } from './core.js';

const STAMP = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

// Dönen: { synced, lines: [{ t: saniye | null, s: metin }] }
export function parseLyrics(text) {
  const timed = []; const plain = [];
  String(text || '').split(/\r?\n/).forEach((raw) => {
    const marks = [...raw.matchAll(STAMP)];
    const s = raw.replace(/\[[^\]]*\]/g, '').replace(/<\d{1,3}:\d{2}(?:\.\d{1,3})?>/g, '').replace(/\s+/g, ' ').trim(); // [Nakarat], [ar:…] gibi etiketler söz değildir
    if (marks.length) marks.forEach((m) => timed.push({ t: +m[1] * 60 + +m[2] + (m[3] ? +`0.${m[3]}` : 0), s }));
    else if (s) plain.push({ t: null, s });
  });
  if (timed.length >= 2) return { synced: true, lines: timed.sort((a, b) => a.t - b.t) };
  return { synced: false, lines: plain.length ? plain : timed.filter((l) => l.s).map((l) => ({ t: null, s: l.s })) };
}
export const isSynced = (text) => parseLyrics(text).synced;

// box içine sözleri çizer. Zamanlı sözlerde üç satır (önceki, şimdiki, sıradaki); düz metinde kayan liste.
export function lyricView(box) {
  let L = null; let timed = false; let idx = -9; let touched = 0; let pv; let cu; let nx;
  box.classList.add('ly');
  const hold = () => { touched = performance.now(); };
  box.addEventListener('pointerdown', hold); box.addEventListener('wheel', hold, { passive: true }); box.addEventListener('touchmove', hold, { passive: true });
  return {
    get has() { return !!L?.lines.length; },
    get synced() { return timed; },
    // timed: müzik çalıyorsa zaman damgalarına göre ilerle; müzik yoksa sözler elle kaydırılır
    set(text, { timed: want = true } = {}) {
      L = text ? parseLyrics(text) : null; idx = -9; timed = !!(L?.synced && want);
      box.hidden = !L || !L.lines.length; box.classList.toggle('plain', !timed); box.scrollTop = 0;
      if (box.hidden) { box.innerHTML = ''; return; }
      if (timed) { box.innerHTML = '<p class="pv"></p><p class="cu"><span></span></p><p class="nx"></p>'; pv = box.querySelector('.pv'); cu = box.querySelector('.cu span'); nx = box.querySelector('.nx'); }
      else box.innerHTML = L.lines.filter((l) => l.s).map((l) => `<p>${esc(l.s)}</p>`).join('');
    },
    // pos: şarkıdaki saniye, dur: şarkı süresi (biliniyorsa), playing: müzik çalıyor mu
    at(pos, dur, playing) {
      if (!L || !L.lines.length) return;
      if (!timed) { // düz metin: şarkı ilerledikçe ağır ağır kayar, dokunulunca bir süre bekler
        if (playing && dur > 20 && performance.now() - touched > 4000) { const p = Math.max(0, Math.min(1, (pos / dur - 0.07) / 0.86)); box.scrollTop = p * Math.max(0, box.scrollHeight - box.clientHeight); }
        return;
      }
      const ls = L.lines; let i = -1; while (i + 1 < ls.length && ls[i + 1].t <= pos + 0.12) i++;
      if (i !== idx) {
        idx = i;
        pv.textContent = i > 0 ? ls[i - 1].s || '♪' : '';
        nx.textContent = ls[i + 1] ? ls[i + 1].s || '♪' : '';
        if (i >= 0) cu.textContent = ls[i].s || '♪ ♪ ♪';
        cu.parentNode.classList.remove('in'); void cu.parentNode.offsetWidth; cu.parentNode.classList.add('in');
      }
      if (i < 0) { const left = ls[0].t - pos; cu.textContent = left > 1.2 ? `♪ ${Math.ceil(left)}` : '♪'; cu.style.setProperty('--p', '0%'); return; }
      const a = ls[i].t; const b = ls[i + 1] ? ls[i + 1].t : a + 5;
      cu.style.setProperty('--p', `${(Math.max(0, Math.min(1, (pos - a) / Math.max(0.4, Math.min(12, b - a)))) * 100).toFixed(1)}%`);
    },
  };
}

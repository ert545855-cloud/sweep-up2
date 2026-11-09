// Çoktan seçmeli yarışma tahtası (Bilgi Yarışması, Şarkıyı Tahmin Et)
import { playTable } from './playkit.js';
import { esc, toast } from './core.js';

const L = 'ABCD';
// Mobilde sesin kilidini açmak için kısa sessiz ses
const SILENT = (() => {
  const n = 800; const b = new Uint8Array(44 + n); const dv = new DataView(b.buffer);
  const w = (o, s) => [...s].forEach((c, i) => { b[o + i] = c.charCodeAt(0); });
  w(0, 'RIFF'); dv.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true); w(36, 'data'); dv.setUint32(40, n, true); b.fill(128, 44);
  let s = ''; b.forEach((x) => { s += String.fromCharCode(x); }); return `data:audio/wav;base64,${btoa(s)}`;
})();
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

export function quizTable(view, id, o) {
  const music = !!o.music;
  let key = ''; let audio = null; let cur = ''; let startedQi = -1; let needTap = false; let unlocked = false; let warm = null; let lastGain = '';
  if (music) { audio = new Audio(); audio.preload = 'auto'; audio.muted = store.get('su_quiz_mute') === '1'; }
  const play = () => { if (!audio || !cur) return; audio.play().then(() => { needTap = false; view.querySelector('.qz-tap')?.remove(); view.querySelector('.qz-disc')?.classList.add('spin'); }).catch(() => { needTap = true; showTap(); }); };
  const showTap = () => { const d = view.querySelector('.qz-disc-w'); if (d && !d.querySelector('.qz-tap')) d.insertAdjacentHTML('beforeend', '<button class="qz-tap">🔊 Dinlemek için dokun</button>'); };
  const syncAudio = (z, status) => {
    if (!audio) return;
    if (status !== 'playing' || z.phase === 'loading') { audio.pause(); startedQi = -1; return; }
    if (z.qi === 0 && z.phase === 'pre') startedQi = -1;
    if (z.media && cur !== z.media && (z.phase === 'pre' || z.phase === 'q')) { cur = z.media; audio.src = cur; audio.load(); }
    if (z.phase === 'q' && startedQi !== z.qi && cur) { startedQi = z.qi; try { audio.currentTime = 0; } catch {} play(); }
    if (z.phase === 'a' && z.nextMedia && warm?.src !== z.nextMedia) { warm = new Audio(); warm.preload = 'auto'; warm.src = z.nextMedia; }
  };
  const optsHtml = (v, z) => {
    const rev = z.phase === 'a'; const hide = z.hide || [];
    return (z.q?.opts || []).map((op, i) => {
      const picked = rev ? Object.entries(z.picks || {}).filter(([, c]) => c === i).map(([s]) => v.seats[s]).filter(Boolean) : [];
      const cls = rev ? (i === z.correct ? 'ok' : i === z.mine ? 'no' : 'dim') : z.mine != null ? (i === z.mine ? 'sel' : 'dim') : hide.includes(i) ? 'gone' : '';
      return `<button class="qz-o ${cls}" data-i="${i}" ${rev || z.mine != null || hide.includes(i) || z.phase !== 'q' ? 'disabled' : ''}><em>${L[i]}</em><span class="grow"><b>${esc(op.t)}</b>${op.a ? `<small>${esc(op.a)}</small>` : ''}</span>${picked.length ? `<i class="qz-who">${picked.slice(0, 4).map((s) => `<img src="${esc(s.avatar)}" alt="">`).join('')}</i>` : ''}</button>`;
    }).join('');
  };
  const scoreHtml = (v, z) => v.seats.map((s, i) => (s ? `<span class="${i === v.me ? 'me' : ''}">${esc(i === v.me ? 'Sen' : s.name.replace(' (bot)', ''))} <b>${z.score?.[i] || 0}</b>${z.phase === 'a' && z.gained?.[i] ? `<em>+${z.gained[i]}</em>` : ''}</span>` : '')).join('');
  const footHtml = (v, z) => {
    if (z.phase === 'a') { const g = z.gained?.[v.me]; return g ? `<span class="qz-res ok">Doğru! +${g} puan</span>` : `<span class="qz-res no">${z.mine == null ? 'Süre doldu' : 'Yanlış cevap'}</span>`; }
    const n = v.seats.filter(Boolean).length;
    return `${o.joker && z.joker && z.mine == null ? '<button class="btn sm qz-joker">50:50 joker</button>' : ''}<span class="muted">${z.mine != null ? 'Cevabın alındı ✓ · ' : ''}${z.answered.length}/${n} cevapladı</span>`;
  };

  return playTable(view, o.game, id, {
    title: o.title, emoji: o.emoji, theme: o.theme, chat: 'drawer', bots: true, minSize: 2, maxSize: 8, sizeLabel: 'kişi', roundWord: 'oyun', againLabel: 'Yeniden oyna',
    rules: o.rules,
    waitingHtml: (v) => (o.cats ? `<div class="qz-cats ${v.host ? '' : 'ro'}"><small>Kategori</small><div class="pk-opt">${o.cats.map(([k, n]) => `<button class="${v.opts?.cat === k ? 'on' : ''}" data-k="cat" data-v="${k}" ${v.host ? '' : 'disabled'}>${esc(n)}</button>`).join('')}</div></div>` : ''),
    endHtml: () => '',
    render(ctx) {
      const v = ctx.v; const z = v.qz; if (!z) return;
      syncAudio(z, v.status);
      const k = `${z.phase}:${z.qi}`;
      if (k === key && ctx.board.querySelector('.qz')) { // aynı aşama: sadece değişen yerler
        ctx.board.querySelector('.qz-opts').innerHTML = optsHtml(v, z);
        ctx.board.querySelector('.qz-foot').innerHTML = footHtml(v, z);
        ctx.board.querySelector('.cs-sc').innerHTML = scoreHtml(v, z);
        return;
      }
      key = k;
      const top = `<div class="qz-top"><span class="chip">${o.unit} ${Math.min(z.n, Math.max(1, z.qi + 1))}/${z.n}</span><span class="chip">${esc(z.catName || '')}</span>${music ? `<button class="ib qz-mute" aria-label="Ses">${audio.muted ? '🔇' : '🔊'}</button>` : ''}</div>`;
      let mid = '';
      if (z.phase === 'loading') mid = `<div class="qz-pre"><div class="spinner"></div><small>${music ? 'Şarkılar hazırlanıyor…' : 'Sorular hazırlanıyor…'}</small></div>`;
      else if (z.phase === 'pre') mid = `<div class="qz-pre"><span>${o.unit}</span><b>${z.qi + 1}</b><small>Hazır ol!</small></div>`;
      else if (music) {
        const info = z.info;
        mid = `<div class="qz-disc-w"><div class="qz-disc ${z.phase === 'q' && audio && !audio.paused ? 'spin' : ''} ${info ? 'rev' : ''}">${info?.cover ? `<img src="${esc(info.cover)}" alt="">` : '<i></i>'}</div>
          ${info ? `<div class="qz-song"><b>${esc(info.title)}</b><small>${esc(info.artist)}</small></div>` : '<div class="qz-eq"><i></i><i></i><i></i><i></i><i></i></div><p class="qz-ask">Bu şarkı hangisi?</p>'}</div>`;
      } else mid = `<div class="qz-card"><p>${esc(z.q?.text || '')}</p></div>`;
      const body = z.phase === 'q' || z.phase === 'a' ? `<div class="qz-opts">${optsHtml(v, z)}</div><div class="qz-foot">${footHtml(v, z)}</div>` : '<div class="qz-opts"></div><div class="qz-foot"></div>';
      ctx.board.innerHTML = `<div class="qz ${z.phase}">${top}${mid}${body}<div class="cs-sc">${scoreHtml(v, z)}</div></div>`;
      if (music && needTap && z.phase === 'q') showTap();
      if (z.phase === 'a') { const g = z.gained?.[v.me]; const tag = `${z.qi}`; if (g && lastGain !== tag) { lastGain = tag; navigator.vibrate?.([15, 30, 15]); } }
    },
    after(ctx) {
      if (ctx.board.dataset.w) return; ctx.board.dataset.w = '1';
      // İlk dokunuşta sesin kilidini aç (mobil tarayıcılar)
      ctx.wrap.addEventListener('pointerdown', () => {
        if (!audio || unlocked) return; unlocked = true;
        if (cur) { if (ctx.v.qz?.phase === 'q' && audio.paused) play(); return; }
        audio.src = SILENT; audio.play().then(() => audio.pause()).catch(() => {});
      }, { capture: true });
      ctx.board.addEventListener('click', (e) => {
        const b = e.target.closest('.qz-o'); if (b && !b.disabled) { b.classList.add('sel'); ctx.move({ type: 'answer', c: +b.dataset.i }); return; }
        if (e.target.closest('.qz-joker')) return ctx.move({ type: 'joker' });
        if (e.target.closest('.qz-tap')) return play();
        const m = e.target.closest('.qz-mute');
        if (m && audio) { audio.muted = !audio.muted; store.set('su_quiz_mute', audio.muted ? '1' : '0'); m.textContent = audio.muted ? '🔇' : '🔊'; if (!audio.muted && audio.paused && ctx.v.qz?.phase === 'q') play(); }
      });
      if (audio) audio.addEventListener('error', () => { if (ctx.v.qz?.phase === 'q') toast('Şarkı çalınamadı, seçeneklerden tahmin et.'); });
    },
    cleanup() { if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); } warm = null; },
  });
}

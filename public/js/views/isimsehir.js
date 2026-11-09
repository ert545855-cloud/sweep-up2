// İsim Şehir
import { playTable } from '../playkit.js';
import { esc } from '../core.js';

export default function isimsehir(view, id) {
  let tmr = 0; let local = {}; let lastRound = 0;
  return playTable(view, 'isimsehir', id, {
    title: 'İsim Şehir', emoji: '📝', theme: '', chat: 'drawer', bots: false, minHumans: 2, party: true, roundWord: 'oyun', againLabel: 'Yeniden oyna',
    rules: `<p><b>Oynanış:</b> Her turda bir harf gelir. İsim, şehir, hayvan, bitki, eşya ve ülke kategorilerine o harfle başlayan birer cevap yaz.</p>
      <p><b>Bitti:</b> İlk bitiren “Bitti!” derse diğerlerine 8 saniye kalır.</p>
      <p><b>Kontrol:</b> Cevaplar sözlükle denetlenir. Sözlükte olan cevap ✓ alır; harfi tutmayan ya da boş cevap geçersizdir. Sözlükte olmayan cevap (ör. az bilinen bir yer) ancak diğer oyuncuların yarısı onaylarsa geçerli olur.</p>
      <p><b>Puan:</b> Kategoride tek cevap veren 20, kimseyle aynı olmayan cevap 10, aynı cevap 5 puan. 5 tur sonunda en çok puan kazanır.</p>`,
    render(ctx) {
      const v = ctx.v; const s = v.is; if (!s) return;
      const me = v.me; const nm = (i) => (i === me ? 'Sen' : v.seats[i]?.name || '?');
      if (s.round !== lastRound) { lastRound = s.round; local = {}; }
      const done = s.done.includes(me);
      // Yazma sırasında formu yeniden çizme (klavye kapanmasın); sadece durumları güncelle
      const keyNow = `${s.phase}:${s.round}:${done}`;
      if (s.phase === 'write' && ctx.board.dataset.k === keyNow && ctx.board.querySelector('.is-f')) {
        ctx.board.querySelector('.is-dn').textContent = s.done.length ? `Bitirenler: ${s.done.map((i) => nm(i)).join(', ')}` : '';
        ctx.board.querySelector('.cs-sc').innerHTML = v.seats.map((x, i) => (x ? `<span>${esc(nm(i))} <b>${s.score[i] || 0}</b></span>` : '')).join('');
        return;
      }
      ctx.board.dataset.k = keyNow;
      let body = '';
      if (s.phase === 'write') {
        body = `<form class="is-f">${s.cats.map(([k, n]) => `<label><span>${n}</span><input class="field" name="${k}" maxlength="30" autocomplete="off" autocapitalize="words" value="${esc(local[k] ?? s.mine[k] ?? '')}" placeholder="${esc(s.letter)}…" ${done ? 'disabled' : ''}></label>`).join('')}
          <button class="btn primary block is-done" ${done ? 'disabled' : ''}>${done ? 'Bitirdin, diğerleri bekleniyor…' : 'Bitti!'}</button></form>
          <p class="muted is-dn">${s.done.length ? `Bitirenler: ${s.done.map((i) => esc(nm(i))).join(', ')}` : ''}</p>`;
      } else if (s.phase === 'review' || s.phase === 'result') {
        body = `<div class="is-rev">${s.cats.map(([k, n]) => `<div class="is-c"><b>${n}</b>${s.all.map((p) => {
          const a = p.a[k] || ''; const ok = p.ok[k]; const st = p.st[k]; const ap = p.appr[k] || []; const mine = ap.includes(me);
          let tail = `<em>${ok ? '✓' : '✗'}</em>`;
          if (st === 'ask' && s.phase === 'review') tail = p.seat === me ? `<small class="is-wait">Onay bekliyor ${ap.length}/${s.need}</small>` : `<button class="is-vt ${mine ? 'on' : ''}" data-seat="${p.seat}" data-cat="${k}">${mine ? '✓ Onayladın' : 'Onayla'} ${ap.length}/${s.need}</button>`;
          return `<div class="is-a ${st === 'ask' && s.phase === 'review' ? 'ask' : ok ? 'ok' : 'no'}"><span class="is-who">${esc(nm(p.seat))}</span><span class="grow">${a ? esc(a) : '<i>boş</i>'}${st === 'ask' ? '<small class="is-q">sözlükte yok</small>' : ''}</span>${tail}</div>`;
        }).join('')}</div>`).join('')}</div>
          ${s.phase === 'review' ? `<button class="btn primary block is-ready" ${s.ready.includes(me) ? 'disabled' : ''}>${s.ready.includes(me) ? 'Hazırsın, diğerleri bekleniyor…' : 'Kontrol ettim'}</button>` : `<div class="is-pts">${Object.entries(s.roundPts || {}).map(([i, p]) => `<span>${esc(nm(+i))} <b>+${p}</b></span>`).join('')}</div>`}`;
      }
      ctx.board.innerHTML = `<div class="is">
        <div class="is-top"><div class="is-letter">${esc(s.letter || '')}</div><div><b>Tur ${s.round}/${s.rounds}</b><small>${s.phase === 'write' ? 'Bu harfle başlayan cevaplar yaz' : s.phase === 'review' ? 'Cevapları kontrol et' : 'Tur sonucu'}</small></div></div>
        ${body}
        <div class="cs-sc">${v.seats.map((x, i) => (x ? `<span>${esc(nm(i))} <b>${s.score[i] || 0}</b></span>` : '')).join('')}</div></div>`;
    },
    after(ctx) {
      if (ctx.board.dataset.w) return; ctx.board.dataset.w = '1';
      const send = (done) => { const f = ctx.board.querySelector('.is-f'); if (!f) return; const a = {}; [...f.querySelectorAll('input')].forEach((i) => { a[i.name] = i.value; }); ctx.move({ type: 'answers', a, done }); };
      ctx.board.addEventListener('input', (e) => { if (!e.target.matches('.is-f input')) return; local[e.target.name] = e.target.value; clearTimeout(tmr); tmr = setTimeout(() => send(false), 700); });
      ctx.board.addEventListener('submit', (e) => { if (!e.target.matches('.is-f')) return; e.preventDefault(); clearTimeout(tmr); send(true); });
      ctx.board.addEventListener('click', (e) => {
        const vt = e.target.closest('.is-vt'); if (vt) return ctx.move({ type: 'approve', seat: +vt.dataset.seat, cat: vt.dataset.cat });
        if (e.target.closest('.is-ready')) return ctx.move({ type: 'ready' });
      });
    },
    // Yazarken ekran yenilenmesin: sadece aşama değişince çiz
    cleanup() { clearTimeout(tmr); },
  });
}

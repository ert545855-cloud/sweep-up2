// Kim Casus?
import { playTable } from '../playkit.js';
import { esc } from '../core.js';

export default function casus(view, id) {
  return playTable(view, 'casus', id, {
    title: 'Kim Casus?', emoji: '🕵️', theme: 'pk-night', chat: 'inline', bots: false, minHumans: 3, party: true, roundWord: 'oyun', againLabel: 'Yeniden oyna',
    rules: `<p><b>Kurulum:</b> Her turda herkese aynı gizli kelime verilir, sadece bir kişiye verilmez: o kişi <b>casustur</b>. Kategoriyi herkes bilir.</p>
      <p><b>İpuçları:</b> Sırayla herkes kelimeyle ilgili kısa bir ipucu yazar. Çok açık verirsen casus kelimeyi anlar; çok kapalı verirsen senden şüphelenilir.</p>
      <p><b>Konuşma ve oylama:</b> Sohbette tartışın, sonra casus olduğunu düşündüğünüz kişiye oy verin.</p>
      <p><b>Sonuç:</b> Casus yakalanmazsa casus 3 puan alır. Yakalanırsa kelimeyi tahmin etme şansı olur: bilirse yine kazanır; bilemezse herkes 1 puan, casusu doğru oylayanlar +1 puan alır. 3 tur sonunda en çok puan kazanır.</p>`,
    render(ctx) {
      const v = ctx.v; const c = v.cs; if (!c) return;
      const me = v.me; const nm = (i) => (i === me ? 'Sen' : v.seats[i]?.name || '?');
      const players = v.seats.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
      let panel = '';
      if (c.phase === 'roles') panel = '<p class="cs-hint">Kartına bak, kimseye söyleme! 🤫</p>';
      else if (c.phase === 'clue') panel = c.clueSeat === me ? `<form class="cs-clue"><input class="field" maxlength="40" placeholder="${c.isSpy ? 'Casus olduğunu belli etmeden bir ipucu yaz…' : 'Kelimeyle ilgili kısa bir ipucu…'}" autocomplete="off"><button class="btn primary">Gönder</button></form>` : `<p class="cs-hint">${esc(nm(c.clueSeat))} ipucu yazıyor…</p>`;
      else if (c.phase === 'talk') panel = '<p class="cs-hint">Konuşun! Sizce kim casus? 🤔</p><button class="btn sm cs-skip">Oylamaya geçelim</button>';
      else if (c.phase === 'vote') panel = `<p class="cs-hint">Casus kim? (${c.votedN}/${c.voters} oy)</p><div class="cs-votes">${players.filter((i) => i !== me).map((i) => `<button class="cs-v ${c.voted === i ? 'on' : ''}" data-vote="${i}"><img src="${esc(v.seats[i].avatar)}" alt=""><span>${esc(nm(i))}</span></button>`).join('')}</div>`;
      else if (c.phase === 'guess') panel = c.isSpy ? `<p class="cs-hint">Yakalandın! Kelime neydi?</p><div class="cs-guess">${(c.guessOpts || []).map((w) => `<button class="btn sm" data-guess="${esc(w)}">${esc(w)}</button>`).join('')}</div>` : `<p class="cs-hint">Casus ${esc(nm(c.accused))} kelimeyi tahmin ediyor…</p>`;
      else if (c.phase === 'reveal') panel = `<div class="cs-rev"><b>${c.roundWin === 'spy' ? '🕵️ Casus kazandı' : '🎉 Köylüler kazandı'}</b><span>Casus: ${esc(nm(c.spy))} · Kelime: ${esc(c.word || '')}</span></div>`;
      ctx.board.innerHTML = `<div class="cs">
        <div class="cs-top"><span class="chip">Tur ${c.round}/${c.rounds}</span><span class="chip">Kategori: ${esc(c.cat || '')}</span></div>
        <div class="cs-card ${c.isSpy ? 'spy' : ''}">${c.isSpy && c.phase !== 'reveal' ? '<div class="big">🕵️</div><b>Casussun!</b><small>Kelimeyi bilmiyorsun. Diğerlerinin ipuçlarından anlamaya çalış, belli etme.</small>' : `<small>Gizli kelime</small><b>${esc(c.word || '')}</b><small>Casus bu kelimeyi bilmiyor.</small>`}</div>
        <div class="cs-clues">${c.clues.map((x) => `<div class="cs-cl"><img src="${esc(v.seats[x.seat]?.avatar || '')}" alt=""><b>${esc(nm(x.seat))}</b><span>${esc(x.text)}</span></div>`).join('') || '<p class="muted cs-empty">İpuçları burada görünecek.</p>'}</div>
        <div class="cs-panel">${panel}</div>
        <div class="cs-sc">${players.map((i) => `<span>${esc(nm(i))} <b>${c.score[i] || 0}</b></span>`).join('')}</div></div>`;
      const f = ctx.board.querySelector('.cs-clue'); if (f) setTimeout(() => f.querySelector('input')?.focus(), 50);
    },
    after(ctx) {
      if (ctx.board.dataset.w) return; ctx.board.dataset.w = '1';
      ctx.board.addEventListener('submit', (e) => { if (!e.target.matches('.cs-clue')) return; e.preventDefault(); const t = e.target.querySelector('input').value.trim(); if (t) ctx.move({ type: 'clue', text: t }); });
      ctx.board.addEventListener('click', (e) => {
        const vb = e.target.closest('[data-vote]'); if (vb) return ctx.move({ type: 'vote', seat: +vb.dataset.vote });
        const gb = e.target.closest('[data-guess]'); if (gb) return ctx.move({ type: 'guess', word: gb.dataset.guess });
        if (e.target.closest('.cs-skip')) return ctx.move({ type: 'skip' });
      });
    },
  });
}

// Yasaklı Kelime
import { playTable } from '../playkit.js';
import { esc } from '../core.js';

export default function yasakli(view, id) {
  return playTable(view, 'yasakli', id, {
    title: 'Yasaklı Kelime', emoji: '🚫', theme: 'pk-night', chat: 'inline', chatTall: true, bots: false, minHumans: 2, party: true, roundWord: 'oyun', againLabel: 'Yeniden oyna',
    rules: `<p><b>Anlatan:</b> Sırası gelen oyuncuya bir kelime ve 5 yasaklı kelime gösterilir. Kelimeyi sohbete yazarak anlatır ama kelimenin kendisini ve yasaklı kelimeleri kullanamaz. Kullanırsa −1 puan alır ve kart değişir.</p>
      <p><b>Tahmin:</b> Diğerleri tahminlerini sohbete yazar. Bilen 2, anlatan 1 puan alır ve yeni kelimeye geçilir.</p>
      <p><b>Süre:</b> Her anlatıcının 60 saniyesi ve 3 pas hakkı var. Herkes sırayla anlatır.</p>`,
    render(ctx) {
      const v = ctx.v; const y = v.yk; if (!y) return;
      const me = v.me; const nm = (i) => (i === me ? 'Sen' : v.seats[i]?.name || '?');
      const teller = y.teller === me;
      let main = '';
      if (y.phase === 'between') main = `<div class="yk-next"><img src="${esc(v.seats[y.teller]?.avatar || '')}" alt=""><b>Sıradaki anlatıcı: ${esc(nm(y.teller))}</b><small>${teller ? 'Hazırlan! Kelimeyi sohbete yazarak anlatacaksın.' : 'Tahminlerini sohbete yaz.'}</small></div>`;
      else if (teller && y.card) main = `<div class="yk-card"><small>Anlat</small><b>${esc(y.card[0])}</b><div class="yk-ban">${y.card[1].map((w) => `<span>${esc(w)}</span>`).join('')}</div>
          <div class="yk-act"><span>${y.got} bilindi</span><button class="btn sm yk-pass" ${y.passes >= y.maxPass ? 'disabled' : ''}>Pas (${y.maxPass - y.passes})</button></div></div>`;
      else main = `<div class="yk-next"><img src="${esc(v.seats[y.teller]?.avatar || '')}" alt=""><b>${esc(nm(y.teller))} anlatıyor</b><small>Tahminini aşağıya yaz · bu turda ${y.got} kelime bilindi</small></div>`;
      ctx.board.innerHTML = `<div class="yk"><div class="cs-top"><span class="chip">Sıra ${Math.min(y.turnNo, y.turns)}/${y.turns}</span></div>${main}
        <div class="cs-sc">${v.seats.map((x, i) => (x ? `<span>${esc(nm(i))} <b>${y.score[i] || 0}</b></span>` : '')).join('')}</div></div>`;
      const inp = view.querySelector('.pk-chat .pk-f input');
      if (inp) inp.placeholder = teller && y.phase === 'tell' ? 'Kelimeyi anlat (yasaklıları kullanma!)…' : y.phase === 'tell' ? 'Tahminini yaz…' : 'Mesaj yaz…';
    },
    after(ctx) {
      if (ctx.board.dataset.w) return; ctx.board.dataset.w = '1';
      ctx.board.addEventListener('click', (e) => { if (e.target.closest('.yk-pass')) ctx.move({ type: 'pass' }); });
    },
  });
}

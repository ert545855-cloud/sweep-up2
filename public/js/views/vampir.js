// Vampir Köylü
import { playTable } from '../playkit.js';
import { esc, sheet } from '../core.js';

const ROLE = {
  vampir: { name: 'Vampir', emoji: '🧛', you: 'Vampirsin!', desc: 'Her gece diğer vampirlerle birlikte bir köylüyü avlarsın. Gündüz kendini köylü gibi göster, şüpheyi başkasına çevir.' },
  doktor: { name: 'Doktor', emoji: '🩺', you: 'Doktorsun!', desc: 'Her gece birini korursun; vampirler onu seçerse kurtulur. Aynı kişiyi iki gece üst üste koruyamazsın.' },
  gozcu: { name: 'Gözcü', emoji: '🔮', you: 'Gözcüsün!', desc: 'Her gece birini sorgular, vampir olup olmadığını öğrenirsin. Bildiğini ne zaman açıklayacağını iyi seç.' },
  koylu: { name: 'Köylü', emoji: '🧑‍🌾', you: 'Köylüsün!', desc: 'Özel bir gücün yok ama oyun senin. Gündüz konuş, ipuçlarını yakala ve vampirleri oylayarak köyden at.' },
};
const LABEL = { roles: 'Roller', night: (d) => `🌙 ${d}. gece`, dawn: () => '☀️ Sabah', day: (d) => `☀️ ${d}. gün`, vote: () => '🗳️ Oylama', verdict: () => '⚖️ Karar' };

export default function vampir(view, id) {
  return playTable(view, 'vampir', id, {
    title: 'Vampir Köylü', emoji: '🧛', theme: 'pk-night', chat: 'inline', bots: false, minHumans: 3, party: true, minSize: 6, maxSize: 12, roundWord: 'oyun', againLabel: 'Yeniden oyna',
    rules: `<p><b>Roller:</b> 🧛 Vampirler gece birini avlar. 🩺 Doktor her gece birini korur. 🔮 Gözcü her gece birinin vampir olup olmadığını öğrenir. 🧑‍🌾 Köylülerin özel gücü yoktur.</p>
      <p><b>Gece:</b> Herkes uyur, sohbet kapanır. Güçlü roller kararını verir.</p>
      <p><b>Gündüz:</b> Gecenin sonucu açıklanır. Konuşun, sonra oylayın: en çok oyu alan köyden gider ve rolü açıklanır. Eşitlikte kimse gitmez.</p>
      <p><b>Kazanmak:</b> Bütün vampirler giderse köylüler, vampirler köylülerle eşit sayıya ulaşırsa vampirler kazanır.</p>
      <p><b>Botlar:</b> 6 kişiden azsanız boş yerlere bot eklenir. Botsuz oyun için en az 5 kişi gerekir.</p>`,
    waitingHtml: (v) => `<div class="qz-cats ${v.host ? '' : 'ro'}"><small>Botlar</small><div class="pk-opt"><button class="${v.opts?.bots !== 'off' ? 'on' : ''}" data-k="bots" data-v="on" ${v.host ? '' : 'disabled'}>6 kişiye botla tamamla</button><button class="${v.opts?.bots === 'off' ? 'on' : ''}" data-k="bots" data-v="off" ${v.host ? '' : 'disabled'}>Sadece insanlar</button></div></div>`,
    endHtml: (v) => (v.vp ? `<div class="vp-end">${v.seats.map((s, i) => (s && v.vp.known[i] ? `<span class="${v.vp.alive.includes(i) ? '' : 'dead'}"><img src="${esc(s.avatar)}" alt=""><b>${esc(i === v.me ? 'Sen' : s.name)}</b><em>${ROLE[v.vp.known[i]].emoji} ${ROLE[v.vp.known[i]].name}</em></span>` : '')).join('')}</div>` : ''),
    render(ctx) {
      const v = ctx.v; const p = v.vp; if (!p) return;
      const me = v.me; const nm = (i) => (i === me ? 'Sen' : v.seats[i]?.name || '?'); const R = ROLE[p.role] || ROLE.koylu;
      const amAlive = p.alive.includes(me);
      const top = `<div class="vp-top"><span class="chip">${p.phase === 'roles' ? 'Roller' : LABEL[p.phase]?.(p.day) || ''}</span><button class="chip vp-me r-${p.role}">${R.emoji} ${R.name}${amAlive ? '' : ' · 👻'}</button></div>`;
      if (p.phase === 'roles') {
        const mates = p.role === 'vampir' ? Object.entries(p.known).filter(([s, r]) => r === 'vampir' && +s !== me).map(([s]) => nm(+s)) : [];
        ctx.board.innerHTML = `<div class="vp night">${top}<div class="vp-card r-${p.role}"><div class="big">${R.emoji}</div><b>${R.you}</b><p>${R.desc}</p>${mates.length ? `<small>Diğer vampir${mates.length > 1 ? 'ler' : ''}: <b>${mates.map(esc).join(', ')}</b></small>` : ''}</div>
          <p class="vp-counts">${Object.entries(p.counts).map(([r, n]) => `${ROLE[r].emoji} ${n} ${ROLE[r].name}`).join(' · ')}</p></div>`;
        return;
      }
      // Kim seçilebilir?
      const night = p.phase === 'night'; const vote = p.phase === 'vote';
      const canPick = (i) => {
        if (!amAlive || !p.alive.includes(i)) return false;
        if (vote) return i !== me && p.myVote == null;
        if (!night) return false;
        if (p.role === 'vampir') return p.known[i] !== 'vampir';
        if (p.role === 'doktor') return i !== p.lastProtect;
        if (p.role === 'gozcu') return i !== me && p.myNight == null;
        return false;
      };
      const voteCnt = {}; Object.values(p.votes || {}).forEach((x) => { if (x >= 0) voteCnt[x] = (voteCnt[x] || 0) + 1; });
      const fangs = {}; Object.entries(p.vampVotes || {}).forEach(([vs, x]) => { (fangs[x] = fangs[x] || []).push(+vs); });
      const tiles = v.seats.map((s, i) => {
        if (!s) return '';
        const dead = !p.alive.includes(i); const r = p.known[i]; const sel = (night && p.myNight === i) || (vote && p.myVote === i);
        const checked = p.seerLog?.filter((x) => x.seat === i).pop();
        return `<button class="vp-p ${dead ? 'dead' : ''} ${sel ? 'sel' : ''} ${canPick(i) ? 'can' : ''} ${i === me ? 'me' : ''}" data-seat="${i}" ${canPick(i) ? '' : 'disabled'}>
          <span class="vp-av"><img src="${esc(s.avatar)}" alt="">${dead ? '<i class="vp-x">💀</i>' : ''}${vote && voteCnt[i] ? `<i class="vp-n">${voteCnt[i]}</i>` : ''}${fangs[i] ? `<i class="vp-f">🩸${fangs[i].length > 1 ? fangs[i].length : ''}</i>` : ''}</span>
          <b class="ellipsis">${esc(nm(i))}</b>${r && (dead || i !== me) ? `<small class="r-${r}">${ROLE[r].emoji} ${ROLE[r].name}</small>` : checked ? `<small class="${checked.vamp ? 'r-vampir' : 'ok'}">${checked.vamp ? '🧛 Vampir!' : '✓ Temiz'}</small>` : p.phase === 'night' && p.role === 'doktor' && i === p.lastProtect ? '<small>Dün korudun</small>' : ''}</button>`;
      }).join('');
      let panel = '';
      if (!amAlive) panel = '<p class="vp-say">Öldün 👻 Oyunu izlemeye devam et.</p>';
      else if (night) {
        if (p.role === 'vampir') panel = `<p class="vp-say">${p.myNight == null ? 'Bu gece kimi avlayacaksınız? Birine dokun.' : `Seçimin: <b>${esc(nm(p.myNight))}</b>. Fikrini değiştirebilirsin.`}</p>`;
        else if (p.role === 'doktor') panel = `<p class="vp-say">${p.myNight == null ? 'Bu gece kimi koruyacaksın?' : `<b>${esc(nm(p.myNight))}</b> bu gece korunuyor 🩺`}</p>`;
        else if (p.role === 'gozcu') panel = `<p class="vp-say">${p.myNight == null ? 'Kimi sorgulamak istiyorsun?' : `<b>${esc(nm(p.myNight))}</b> sorgulandı. Sonucu sabah öğreneceksin 🔮`}</p>`;
        else panel = '<p class="vp-say">Uyuyorsun… 😴 Vampirler avlanıyor.</p>';
      } else if (p.phase === 'dawn' || p.phase === 'day') {
        const ln = p.lastNight; const last = p.role === 'gozcu' && p.seerLog?.length ? p.seerLog[p.seerLog.length - 1] : null;
        panel = `${p.phase === 'dawn' && ln ? `<p class="vp-say big">${ln.saved ? 'Doktor bu gece birini kurtardı! Kimse ölmedi 🩺' : ln.killed != null ? `<b>${esc(nm(ln.killed))}</b> gece vampirlerin kurbanı oldu.` : 'Gece sakin geçti.'}</p>` : ''}
          ${last && last.day === p.day ? `<p class="vp-seer ${last.vamp ? 'bad' : ''}">🔮 ${esc(nm(last.seat))} ${last.vamp ? 'bir vampir!' : 'vampir değil.'}</p>` : ''}
          ${p.phase === 'day' ? `<p class="vp-say">Konuşun! Kim vampir olabilir? Sohbete yaz.</p><button class="btn sm vp-skip" ${p.skipMine ? 'disabled' : ''}>${p.skipMine ? `Oylama bekleniyor (${p.skipN}/${Math.ceil(p.alive.length * 0.6)})` : 'Oylamaya geçelim'}</button>` : ''}`;
      } else if (vote) panel = `<p class="vp-say">${p.myVote == null ? 'Vampir olduğunu düşündüğün kişiye dokun.' : p.myVote === -1 ? 'Pas geçtin.' : `Oyun: <b>${esc(nm(p.myVote))}</b>`}</p>${p.myVote == null ? '<button class="btn sm vp-pass">Pas geç</button>' : ''}`;
      else if (p.phase === 'verdict') { const vd = p.verdict; panel = `<p class="vp-say big">${vd?.out != null ? `<b>${esc(nm(vd.out))}</b> köyden gitti. Rolü: ${ROLE[vd.role].emoji} ${ROLE[vd.role].name}` : 'Bugün kimse gitmedi.'}</p>`; }
      const seer = p.role === 'gozcu' && p.seerLog?.length ? `<div class="vp-log">${p.seerLog.map((x) => `<span class="${x.vamp ? 'bad' : ''}">${esc(nm(x.seat))} ${x.vamp ? '🧛' : '✓'}</span>`).join('')}</div>` : '';
      ctx.board.innerHTML = `<div class="vp ${night ? 'night' : 'day'}">${top}<div class="vp-grid">${tiles}</div><div class="vp-panel">${panel}${seer}</div></div>`;
      const inp = view.querySelector('.pk-chat .pk-f input');
      const over = v.status === 'ended';
      if (inp) { inp.disabled = !over && (night || !amAlive); inp.placeholder = over ? 'Mesaj yaz…' : !amAlive ? 'Ölüler konuşamaz 👻' : night ? 'Gece herkes uyuyor 🌙' : 'Mesaj yaz…'; }
    },
    after(ctx) {
      if (ctx.board.dataset.w) return; ctx.board.dataset.w = '1';
      ctx.board.addEventListener('click', (e) => {
        const p = ctx.v.vp; if (!p) return;
        const t = e.target.closest('.vp-p.can'); if (t) return ctx.move({ type: p.phase === 'vote' ? 'vote' : 'night', seat: +t.dataset.seat });
        if (e.target.closest('.vp-pass')) return ctx.move({ type: 'vote', seat: -1 });
        if (e.target.closest('.vp-skip')) return ctx.move({ type: 'skip' });
        if (e.target.closest('.vp-me')) { const R = ROLE[p.role] || ROLE.koylu; sheet(`${R.emoji} ${R.name}`, `<div class="pk-rules"><p>${R.desc}</p></div>`); }
      });
    },
  });
}

// Yarışmalar: en çok gönderi / beğeni / yorum... Sıralama ve ödüller
import { icon } from '../icons.js';
import { api, esc, avatar, nm, on } from '../core.js';

const back = (to) => `<a class="ib" href="${to}" aria-label="Geri">${icon('back')}</a>`;
const left = (t) => { const ms = Math.max(0, t - Date.now()); const d = Math.floor(ms / 86400000); const h = Math.floor((ms % 86400000) / 3600000); return d ? `${d} gün ${h} saat` : `${h} saat ${Math.floor((ms % 3600000) / 60000)} dk`; };
const dt = (t) => new Date(t).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const prizeTxt = (p) => (p ? [p.coins ? `${p.coins} jeton` : '', p.plusDays ? `${p.plusDays} gün SwipeUp+` : '', p.tag ? `${p.tag.em} ${p.tag.name}` : ''].filter(Boolean).join(' · ') : '');
const when = (c) => (c.phase === 'soon' ? `${left(c.start)} sonra başlıyor` : c.phase === 'live' ? `Bitmesine ${left(c.end)}` : `${dt(c.end)} tarihinde bitti`);
const medal = (r) => `<span class="ct-rk r${r}">${r}</span>`;

function card(c) {
  return `<a class="ct-card ph-${c.phase}" href="#/yarismalar/${esc(c.id)}"><span class="ct-em">${esc(c.em)}</span><div class="grow"><span class="ct-ph">${esc(c.phaseLabel)}</span><b>${esc(c.title)}</b><small>${esc(c.metricLabel)} · ${when(c)}</small>
    ${c.prizes?.[0] && prizeTxt(c.prizes[0]) ? `<small class="ct-pz">${icon('trophy')} 1.lik ödülü: ${esc(prizeTxt(c.prizes[0]))}</small>` : ''}</div>
    ${c.me ? `<span class="ct-me"><b>${c.me.rank}.</b><small>sıradasın</small></span>` : ''}</a>`;
}

export default async function contestsView(view, id) {
  if (id) return detail(view, id);
  view.innerHTML = `<header class="topbar">${back('#/')}<div class="center">Yarışmalar</div><span class="ib"></span></header><div class="ct"><div class="spinner"></div></div>`;
  const box = view.querySelector('.ct');
  const r = await api('/contests');
  const live = r.items.filter((c) => c.phase !== 'ended'); const past = r.items.filter((c) => c.phase === 'ended');
  box.innerHTML = `<section class="ct-hero"><img src="/img/songs/trophy.svg" alt=""><div><h2>Yarış, kazan</h2><p>En çok paylaşan, en çok beğeni ya da yorum alan kazanır. Ödüller (jeton, SwipeUp+, özel etiket) yarışma bitince hesabına kendiliğinden tanımlanır.</p></div></section>
    <a class="ct-card song" href="#/sarki"><span class="ct-em">🎤</span><div class="grow"><b>Şarkı yarışması</b><small>3 ayda bir · kazanan şarkı Spotify’da yayınlanır</small></div>${icon('chevDown', '', 'style="transform:rotate(-90deg);width:18px"')}</a>
    ${live.length ? `<h3 class="shop-h">Devam eden ve yaklaşan</h3><div class="ct-list">${live.map(card).join('')}</div>` : '<div class="empty" style="padding:20px">Şu an devam eden yarışma yok. Yeni yarışma başlayınca bildirim alacaksın.</div>'}
    ${past.length ? `<h3 class="shop-h">Biten yarışmalar</h3><div class="ct-list">${past.map(card).join('')}</div>` : ''}`;
  return null;
}

async function detail(view, id) {
  view.innerHTML = `<header class="topbar">${back('#/yarismalar')}<div class="center">Yarışma</div><span class="ib"></span></header><div class="ct"><div class="spinner"></div></div>`;
  const box = view.querySelector('.ct');
  const load = async () => {
    const c = await api(`/contests/${id}`);
    const top3 = c.top.slice(0, 3);
    box.innerHTML = `<section class="ct-head ph-${c.phase}"><span class="ct-em big">${esc(c.em)}</span><span class="ct-ph">${esc(c.phaseLabel)}</span><h2>${esc(c.title)}</h2><p>${esc(c.metricLabel)}</p><div class="ct-when">${icon('timer')} ${when(c)}</div></section>
      ${c.desc ? `<p class="ct-desc">${esc(c.desc)}</p>` : ''}
      ${c.me ? `<div class="ct-mine"><span>Senin sıran</span><b>${c.me.rank}.</b><span class="muted">${c.me.n} ${esc(c.unit)}</span></div>` : c.phase !== 'ended' ? `<div class="ct-mine none"><span>Henüz puanın yok.</span><span class="muted">${esc(c.metricLabel)} yarışmasında ${esc(c.unit)} topladıkça listeye girersin.</span></div>` : ''}
      ${c.prizes.length ? `<h3 class="shop-h">Ödüller</h3><div class="ct-prizes">${c.prizes.map((p, i) => `<div class="ct-pr">${medal(i + 1)}<span class="grow">${esc(prizeTxt(p) || 'Ödül yok')}</span></div>`).join('')}</div>` : ''}
      ${top3.length ? `<div class="ct-podium">${[1, 0, 2].map((i) => top3[i] ? `<a class="pd p${i + 1}" href="#/u/${esc(top3[i].user.username)}">${avatar(top3[i].user, 56, { dot: false })}<b class="ellipsis">${esc(top3[i].user.username)}</b><small>${top3[i].n} ${esc(c.unit)}</small><span class="bar">${i + 1}</span></a>` : '<span></span>').join('')}</div>` : ''}
      <h3 class="shop-h">Sıralama <small class="muted">${c.participants} kişi</small></h3>
      ${c.top.length ? `<div class="ct-rows">${c.top.map((x) => `<a class="ct-row ${x.rank <= c.winners ? 'win' : ''}" href="#/u/${esc(x.user.username)}">${medal(x.rank)}${avatar(x.user, 40, { dot: false })}<span class="grow"><b>${nm(x.user)}</b><small>@${esc(x.user.username)}</small></span><b class="n">${x.n}</b></a>`).join('')}</div>` : '<div class="empty" style="padding:18px">Henüz kimse puan almadı.</div>'}
      <p class="muted ct-rules">${c.verifiedOnly ? 'Bu yarışmaya sadece doğrulanmış hesaplar katılır. ' : ''}Puanlar ${dt(c.start)} – ${dt(c.end)} arasındaki etkinliklerden hesaplanır ve birkaç dakikada bir güncellenir. Hileli etkileşimler (sahte hesaplar, aynı kişiden toplu yorum) sayılmaz.</p>`;
  };
  try { await load(); } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  const t = setInterval(() => load().catch(() => {}), 60000);
  const off = on('wallet', () => load().catch(() => {}));
  return () => { clearInterval(t); off(); };
}

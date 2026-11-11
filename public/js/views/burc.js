// Günün burç kartı: Falcı Teyze'nin günlük yorumu, Instagram hikayesinde paylaşılabilir kart
import { icon } from '../icons.js';
import { api, esc, toast } from '../core.js';
import { ZODIAC } from '../fal-data.js';
import { shareCard } from '../engage.js';
import { egi, zodiacIcon } from '../eg-icons.js';

export default async function burc(view) {
  view.innerHTML = `<header class="topbar"><button class="ib" data-back="#/fal" aria-label="Geri">${icon('back')}</button><div class="center">Burç yorumun</div><a class="ib soft" href="#/fal" aria-label="Fal">${egi('fal-burc', 30)}</a></header>
    <div class="bc"><div class="spinner"></div></div>`;
  const box = view.querySelector('.bc');
  let d; let z = null; let tab = /[?&]h=1/.test(location.hash) ? 'week' : 'day'; let w = null;
  const day = () => new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
  const pickHtml = () => `<div class="bc-pick">${ZODIAC.map(([id, n]) => `<button data-z="${id}" class="${d?.zodiac === id ? 'on' : ''}">${zodiacIcon(id, 40)}<small>${n}</small></button>`).join('')}</div>`;
  const paint = () => {
    if (!d.zodiac) {
      box.innerHTML = `<section class="bc-card none">${egi('burc', 96, 'bc-sym')}<b>Burcunu seç</b><small>Profiline doğum tarihini eklersen burcun kendiliğinden seçilir.</small></section>${pickHtml()}`;
      return;
    }
    const tabs = `<div class="seg bc-tabs"><button data-tab="day" class="${tab === 'day' ? 'on' : ''}">Bugün</button><button data-tab="week" class="${tab === 'week' ? 'on' : ''}">Bu hafta</button></div>`;
    if (tab === 'week') {
      box.innerHTML = `${tabs}<section class="bc-card bc-week"><small class="bc-day">${w ? `${esc(w.from)} haftası` : ''}</small>${zodiacIcon(d.zodiac, 88, 'bc-sym')}<b>${esc(d.name)} · Haftalık yorum</b>
        ${w ? `<div class="bc-wtext">${esc(w.text)}</div>` : '<div class="spinner"></div>'}<span class="bc-by">— Falcı Teyze</span></section>
        <div class="bc-acts"><a class="btn block" href="#/fal/burc">Falcı Teyze’ye kişisel yorum sor</a></div>
        <div class="section-t"><span>Başka bir burca bak</span></div>${pickHtml()}<p class="fal-note">Eğlence amaçlıdır.</p>`;
      if (!w || w.zodiac !== d.zodiac) api(`/burc/week?z=${d.zodiac}`).then((x) => { w = x; if (tab === 'week') paint(); }).catch((er) => toast(er.message));
      return;
    }
    box.innerHTML = `${tabs}<section class="bc-card"><small class="bc-day">${esc(day())}</small>${zodiacIcon(d.zodiac, 104, 'bc-sym')}<b>${esc(d.name)}</b>
        <p>${esc(d.text)}</p><span class="bc-by">— Falcı Teyze</span></section>
      <div class="bc-acts"><button class="btn primary block bc-share">${icon('send')} Hikayende paylaş</button>
        <a class="btn block" href="#/fal/burc">Falcı Teyze’ye kişisel yorum sor</a></div>
      <p class="muted bc-tip">Kartın altında davet bağlantın olur. Arkadaşın bu bağlantıyla katılırsa ikiniz de jeton kazanırsınız.</p>
      <div class="section-t"><span>Başka bir burca bak</span></div>${pickHtml()}
      <a class="bc-pack" href="#/fal/paket">${egi('pack-yillik', 44)}<span class="grow"><b>Yıllık burç raporu</b><small>Önümüzdeki 12 ayın aşk, iş ve para yorumu</small></span><span class="go-chip">Paketler</span></a>
      <p class="fal-note">Eğlence amaçlıdır.</p>`;
  };
  const load = async () => { d = await api(`/burc/today${z ? `?z=${z}` : ''}`); paint(); };
  box.addEventListener('click', async (e) => {
    const tb = e.target.closest('[data-tab]');
    if (tb) { tab = tb.dataset.tab; paint(); return; }
    const b = e.target.closest('[data-z]');
    if (b) { z = b.dataset.z; box.querySelector('.bc-card')?.classList.add('ld'); try { await load(); window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (er) { toast(er.message); } return; }
    if (e.target.closest('.bc-share')) shareCard({ kind: 'burc', icon: `z-${d.zodiac}`, title: `${d.name} · Günün yorumu`, subtitle: `Falcı Teyze · ${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}`, text: d.text, cta: 'Sen de burcuna bak' }, { file: 'swipeup-burc.png' });
  });
  try { await load(); } catch (e) { box.innerHTML = `<div class="empty"><h2>Burç kartı açılamadı</h2>${esc(e.message)}</div>`; }
  return null;
}

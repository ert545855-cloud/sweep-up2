// Falını hikayende paylaş: Falcı Teyze'nin yorumundan bir bölüm şık bir hikaye kartı olur.
import { icon } from './icons.js';
import { api, esc, toast, sheet, state, emit } from './core.js';
import { FAL_TYPES, zodiacOf } from './fal-data.js';
import { falIcon } from './eg-icons.js';

// Sunucudaki kesme kuralının aynısı (önizleme için)
export const excerpt = (t, n = 340) => {
  t = String(t || '').trim(); if (t.length <= n) return t;
  const cut = t.slice(0, n); const i = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return (i > n * 0.55 ? cut.slice(0, i + 1) : `${cut.replace(/\s+\S*$/, '')}…`).trim();
};

// Hikayedeki fal kartı (izleyicide ve önizlemede aynı görünür)
export function falCardHtml(c) {
  const t = FAL_TYPES[c.type] || { name: 'Fal' };
  const z = zodiacOf(c.zodiac);
  const chips = c.type === 'tarot' && c.cards?.length ? `<div class="fc-chips">${c.cards.map((k) => `<span>${esc(k.name)}${k.rev ? ' · ters' : ''}</span>`).join('')}</div>`
    : z ? `<div class="fc-chips"><span>${esc(z[2])} ${esc(z[1])}</span></div>` : '';
  return `<div class="fcard t-${esc(c.type)}"><div class="fc-stars"></div>
    <div class="fc-top"><span class="fc-k">Falcı Teyze</span><b>${esc(t.name)}</b></div>
    <div class="fc-ic">${falIcon(c.type, 92)}</div>${chips}
    <blockquote class="fc-q">${esc(c.text)}</blockquote>
    <div class="fc-brand">SwipeUp · Kalbinin soramadıklarını, Falcı Teyze’ye sor</div></div>`;
}

export async function falStorySheet(messageId) {
  let f = null;
  try { f = (await api('/fal/history')).find((x) => x.messageId === messageId); } catch (e) { return toast(e.message); }
  if (!f?.answer) return toast('Falının cevabı henüz gelmedi kuzum.');
  const card = { kind: 'fal', type: f.type, text: excerpt(f.answer.text), zodiac: f.zodiac, cards: f.cards };
  sheet('Hikayende paylaş', `<div class="fs-prev"><div class="fs-frame">${falCardHtml(card)}</div></div>
    <p class="muted fs-note">Falcı Teyze’nin yorumundan bir bölüm hikayende paylaşılır. Görenler “Sen de fal baktır”a dokunup kendi falına baktırabilir.</p>
    <div class="fs-go"><button class="btn primary block go">${icon('plus')} Hikayende paylaş</button></div>`, {
    onMount(sh, close) {
      sh.querySelector('.go').onclick = async (e) => {
        const b = e.currentTarget; b.disabled = true; b.textContent = 'Paylaşılıyor…';
        try {
          await api('/stories', { body: { card: { kind: 'fal', messageId } } });
          emit('stories:update', {}); close(); toast('Falın hikayende paylaşıldı 🔮');
          location.hash = `#/stories/${state.me.id}`;
        } catch (er) { toast(er.message); b.disabled = false; b.innerHTML = `${icon('plus')} Hikayende paylaş`; }
      };
    },
  });
}

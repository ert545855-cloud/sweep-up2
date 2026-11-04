import { icon } from '../icons.js';
import {
  state, api, esc, toast, avatar, pickFile, compressImage, uploadFile, ago, on, el, needCoins,
} from '../core.js';
import {
  FAL_TYPES, TAROT, TAROT_POS, ZODIAC, zodiacOf, seeded,
} from '../fal-data.js';

const head = (title, to = '#/fal') => `<header class="topbar"><a class="ib" href="${to}" aria-label="Geri">${icon('back')}</a><div class="center">${esc(title)}</div><span class="ib"></span></header>`;
const note = '<p class="fal-note">Fallar eğlence amaçlıdır.</p>';
const aiNote = () => (state.config?.falAi && state.config.falAi !== 'off' ? '<p class="fal-note">Yorumlar yapay zeka desteğiyle hazırlanır, eğlence amaçlıdır.</p>' : note);
const statusChip = (s) => (s === 'answered' ? '<span class="chip fal-ok">Cevaplandı</span>' : '<span class="chip fal-wait-chip">Bekliyor</span>');

let shop = null;
const loadShop = async () => { shop = await api('/store').catch(() => shop); return shop; };

async function send(body, btn) {
  const s = shop || await loadShop();
  const price = s?.falPrices?.[body.type] || 0;
  if (price && s.coins < price) { needCoins(`Bu fal ${price} jeton, bakiyen ${s.coins}. Jeton alıp tekrar dene.`); return; }
  if (price && !confirm(`${FAL_TYPES[body.type].name} ${price} jeton. Bakiyenden düşülsün ve gönderilsin mi?`)) return;
  btn.disabled = true;
  const old = btn.innerHTML; btn.innerHTML = 'Gönderiliyor...';
  try {
    const r = await api('/fal', { body });
    if (shop) shop.coins = r.coins;
    toast('Falın Falcı Teyze’ye gönderildi. Cevabı Mesajlar’a gelecek. 🔮', { ms: 4500 });
    location.hash = `#/chat/${r.chatId}`;
  } catch (e) {
    if (/jeton/i.test(e.message)) needCoins(e.message); else toast(e.message);
    btn.disabled = false; btn.innerHTML = old;
  }
}

const noteField = (ph) => `<label class="form" style="padding:0;gap:6px"><span class="b" style="font-size:13.5px">Falcı Teyze’ye notun</span>
  <textarea class="field nt" maxlength="1000" rows="3" placeholder="${esc(ph)}"></textarea></label>`;

// ================= Ana ekran =================
async function hub(view) {
  const me = state.me;
  if (me.role === 'falci') return queue(view);
  view.innerHTML = `<header class="topbar"><a class="ib" href="#/" aria-label="Geri">${icon('back')}</a><h1 style="justify-content:center"><span>Fal</span></h1><span class="ib"></span></header>
    <div class="fal-hero teyze"><span class="fz"></span><div class="grow"><b>Falcı Teyze</b><p>Fincanına, kartlarına ve yıldızlarına bakar. Cevabı Mesajlar’a düşer.</p></div></div>
    <div class="fal-grid">
      ${Object.entries(FAL_TYPES).map(([k, t]) => `<a class="fal-tile" href="#/fal/${k}"><span class="em">${t.em}</span><b>${t.name}</b><span>${{
    kahve: 'Fincanının fotoğraflarını gönder.', tarot: 'Üç kart çek, Falcı Teyze yorumlasın.', burc: 'Burcunu ve sorunu yaz.', uyum: 'Biriyle aranızdaki uyuma baksın.',
  }[k]}</span><em class="price" data-k="${k}"></em></a>`).join('')}
    </div>
    <div class="fal-sub-box"></div>
    <a class="fal-bal" href="#/store">${icon('coin')}<span>Bakiye: <b class="cb">…</b> jeton</span><span class="link">Jeton al</span></a>
    <div class="mine"></div>${aiNote()}`;
  const [f, mine] = await Promise.all([api('/fal/falci').catch(() => null), api('/fal/mine').catch(() => []), loadShop()]);
  if (shop) {
    view.querySelector('.cb').textContent = shop.coins;
    view.querySelectorAll('.price').forEach((p) => { const v = shop.falPrices[p.dataset.k]; p.textContent = v ? `${v} jeton` : 'Ücretsiz'; });
  } else view.querySelector('.fal-bal').hidden = true;
  const subBox = view.querySelector('.fal-sub-box');
  const drawSub = async () => {
    const s = await api('/fal/sub').catch(() => null);
    if (!s) { subBox.innerHTML = ''; return; }
    const until = s.sub?.until ? new Date(s.sub.until).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) : '';
    subBox.innerHTML = `<section class="fal-sub ${s.active ? 'on' : ''}"><div class="fs-top"><span class="fs-em">🔮</span><div class="grow"><b>Falcı Teyze aboneliği</b><small>${s.active ? `${esc(until)} tarihine kadar aktif` : `${s.days} gün · ${s.coins} jeton`}</small></div>
        ${s.active ? '<span class="pill ok">Aktif</span>' : `<button class="btn primary sm fs-buy">${icon('coin')} ${s.coins}</button>`}</div>
      <ul><li><b>Her pazartesi</b> burç yorumun kendiliğinden gelir${s.active ? (s.burcUsed ? ' <em>· bu hafta alındı</em>' : ' <em>· bu hafta hazır</em>') : ''}</li>
        <li><b>Ayda bir kahve falı</b> ücretsiz${s.active ? ` <em>· ${s.sub.kahveLeft || 0} hakkın var</em>` : ''}</li>
        ${!s.zodiac ? '<li class="warn">Burç yorumu için <a class="link" href="#/fal/burc">burcunu seç</a></li>' : ''}</ul>
      ${s.active ? `<button class="link fs-buy" style="font-size:13px">30 gün uzat (${s.coins} jeton)</button>` : ''}</section>`;
    subBox.querySelectorAll('.fs-buy').forEach((b) => { b.onclick = async () => {
      if (!confirm(`Falcı Teyze aboneliği ${s.coins} jeton. Onaylıyor musun?`)) return;
      try { const r = await api('/fal/sub', { body: {} }); if (shop) { shop.coins = r.coins; view.querySelector('.cb').textContent = r.coins; } toast('Aboneliğin başladı 🔮'); drawSub(); } catch (er) { if (er.status === 402) needCoins(er.message); else toast(er.message); }
    }; });
  };
  drawSub();
  const hero = view.querySelector('.fal-hero');
  if (f) {
    hero.querySelector('.fz').outerHTML = `<a href="#/u/${esc(f.username)}"><img class="av av-56" src="${esc(f.avatar)}" alt="Falcı Teyze profili"></a>`;
    hero.querySelector('b').outerHTML = `<a href="#/u/${esc(f.username)}"><b>Falcı Teyze</b></a> <span class="fcnt" style="opacity:.85;font-size:13px">· ${f.followers} takipçi</span>`;
    const fb = el(`<button class="btn sm" style="background:rgba(255,255,255,.22);color:inherit">${f.isFollowing ? 'Takiptesin' : 'Takip et'}</button>`);
    fb.onclick = async () => {
      try {
        const r = await api(`/users/${f.id}/follow`, { body: {} });
        if (r.following !== f.isFollowing) f.followers += r.following ? 1 : -1;
        f.isFollowing = r.following; fb.textContent = r.following ? 'Takiptesin' : 'Takip et';
        hero.querySelector('.fcnt').textContent = `· ${f.followers} takipçi`;
        toast(r.following ? 'Falcı Teyze’yi takip ediyorsun. Paylaşımları akışına düşecek.' : 'Takibi bıraktın.');
      } catch (er) { toast(er.message); }
    };
    hero.append(fb);
  } else hero.querySelector('.fz').outerHTML = '<span class="zs">🔮</span>';
  if (f && mine.length) {
    hero.insertAdjacentHTML('beforeend', `<a class="btn sm" href="#/chat/${esc(mine[0].chatId)}" style="background:rgba(255,255,255,.22);color:inherit">Mesajlar</a>`);
  }
  view.querySelector('.mine').innerHTML = mine.length ? `<div class="section-t"><span>Fal isteklerin</span></div>${mine.map((m) => `<a class="list-item" href="#/chat/${esc(m.chatId)}">
      <span class="fal-mini">${FAL_TYPES[m.type].em}</span><div class="grow"><div class="b">${FAL_TYPES[m.type].name}</div><div class="sub">${ago(m.at, true)}</div></div>${statusChip(m.status)}</a>`).join('')}` : '';
  return null;
}

// ================= Falcı Teyze paneli =================
async function queue(view) {
  view.innerHTML = `<header class="topbar"><a class="ib" href="#/" aria-label="Geri">${icon('back')}</a><h1 style="justify-content:center"><span>Fal kuyruğu</span></h1><span class="ib"></span></header>
    <div class="seg" style="margin:0 14px 12px"><button class="on" data-f="pending">Bekleyenler</button><button data-f="answered">Cevaplananlar</button><button data-f="all">Tümü</button></div>
    <div class="ql"><div class="spinner"></div></div>`;
  let list = []; let filter = 'pending';
  const ql = view.querySelector('.ql');
  const paint = () => {
    const items = list.filter((x) => filter === 'all' || x.status === filter);
    const pend = list.filter((x) => x.status === 'pending').length;
    view.querySelector('[data-f="pending"]').textContent = pend ? `Bekleyenler · ${pend}` : 'Bekleyenler';
    ql.innerHTML = items.length ? items.map((x) => `<div class="fal-q" data-mid="${esc(x.messageId)}">
        <a class="row" href="#/chat/${esc(x.chatId)}">${avatar(x.user, 44)}<div class="grow"><div class="b">${esc(x.user?.name || x.name)}</div><div class="sub muted">${FAL_TYPES[x.type].em} ${FAL_TYPES[x.type].name} · ${ago(x.at, true)}</div></div>${statusChip(x.status)}</a>
        ${x.images?.length ? `<div class="fq-imgs">${x.images.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="" loading="lazy"></a>`).join('')}</div>` : ''}
        ${x.cards?.length ? `<div class="fq-cards">${x.cards.map((c) => `<span class="chip"><small>${esc(c.pos || '')}</small> ${c.em} ${esc(c.name)}${c.rev ? ' (ters)' : ''}</span>`).join('')}</div>` : ''}
        ${x.note ? `<p class="fq-note">${esc(x.note)}</p>` : ''}
        ${x.status === 'pending' ? (x.holds?.length ? holdBox(x) : `${x.dueAt && x.dueAt > Date.now() ? `<div class="fq-due">⏳ Cevap en erken <b>${hhmm(x.dueAt)}</b>’de iletilir</div>` : ''}${aiBox(x)}`) : x.ai?.status === 'sent' ? `<div class="ai-done">${x.ai.auto ? '✨ Yapay zeka cevabı otomatik gönderildi' : x.ai.edited === false ? '✨ Taslak olduğu gibi gönderildi' : ''}</div>` : ''}
      </div>`).join('')
      : `<div class="empty"><div class="big">${icon('check')}</div><h2>${filter === 'pending' ? 'Bekleyen fal yok' : 'Henüz yok'}</h2>${filter === 'pending' ? 'Yeni istek gelince bildirim alırsın.' : ''}</div>`;
  };
  const hhmm = (t) => new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const holdBox = (x) => x.holds.map((h) => `<div class="ai-box hold" data-hold="${esc(h.id)}"><div class="ai-h">⏳ Cevap hazır <small>${hhmm(h.dueAt)}’de iletilecek${h.source === 'auto' ? ' · yapay zeka' : ''}</small></div>${h.text ? `<p class="fq-note" style="margin:0">${esc(h.text.slice(0, 220))}${h.text.length > 220 ? '…' : ''}</p>` : ''}<div class="ai-btns"><button class="btn sm hb-x">Geri al</button><button class="btn primary sm hb-now">${icon('send')} Şimdi gönder</button></div></div>`).join('');
  const aiOn = () => state.config?.falAi && state.config.falAi !== 'off';
  function aiBox(x) {
    const a = x.ai;
    if (!a || a.status === 'none') return aiOn() ? '<div class="ai-box"><button class="btn sm ai-regen">✨ Yapay zeka taslağı hazırla</button></div>' : '';
    if (a.status === 'scheduled' || a.status === 'sent') return '';
    if (a.status === 'working') return '<div class="ai-box wait"><span class="spinner sm"></span> ✨ Taslak hazırlanıyor…</div>';
    if (a.status === 'error') return `<div class="ai-box err"><b>Taslak hazırlanamadı</b><small>${esc(a.error || '')}</small><button class="btn sm ai-regen">Tekrar dene</button></div>`;
    if (a.status === 'ready') {
      return `<div class="ai-box"><div class="ai-h">✨ Yapay zeka taslağı <small>okuyup düzenleyebilirsin</small></div>
        <textarea class="field ai-t" rows="8">${esc(a.text)}</textarea>
        <div class="ai-btns"><button class="btn sm ai-regen">Yeniden yaz</button><button class="btn primary sm ai-send">${icon('send')} Gönder</button></div></div>`;
    }
    return '';
  }
  ql.addEventListener('click', async (e) => {
    const card = e.target.closest('[data-mid]'); if (!card) return;
    const mid = card.dataset.mid;
    try {
      const hb = e.target.closest('[data-hold]');
      if (hb && e.target.closest('.hb-now')) { e.target.closest('button').disabled = true; await api(`/fal/holds/${hb.dataset.hold}/now`, { body: {} }); toast('Fal cevabı gönderildi 🔮'); load(); return; }
      if (hb && e.target.closest('.hb-x')) { await api(`/fal/holds/${hb.dataset.hold}`, { method: 'DELETE' }); toast('Geri alındı; taslağı düzenleyebilirsin.'); load(); return; }
      if (e.target.closest('.ai-regen')) { e.preventDefault(); await api(`/fal/ai/${mid}/regen`, { body: {} }); const it = list.find((x) => x.messageId === mid); if (it) { it.ai = { status: 'working' }; paint(); } }
      if (e.target.closest('.ai-send')) {
        e.preventDefault();
        const btn = e.target.closest('.ai-send'); btn.disabled = true;
        const r = await api(`/fal/ai/${mid}/send`, { body: { text: card.querySelector('.ai-t').value } });
        toast(r.held ? `⏳ Cevap ${hhmm(r.dueAt)}’de iletilecek 🔮` : 'Fal cevabı gönderildi 🔮'); load();
      }
    } catch (er) { toast(er.message); e.target.closest('button') && (e.target.closest('button').disabled = false); }
  });
  const load = async () => {
    // düzenlenmekte olan taslakları koru
    const typing = [...ql.querySelectorAll('.ai-t')].filter((t) => t === document.activeElement).map((t) => t.closest('[data-mid]').dataset.mid);
    const fresh = await api('/fal/queue');
    if (typing.length) fresh.forEach((x) => { if (typing.includes(x.messageId)) x.ai = list.find((y) => y.messageId === x.messageId)?.ai || x.ai; });
    list = fresh; paint();
  };
  await load();
  view.querySelector('.seg').onclick = (e) => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    filter = b.dataset.f; view.querySelectorAll('.seg button').forEach((x) => x.classList.toggle('on', x === b)); paint();
  };
  const offs = [on('message', (m) => { if (m.fal) load(); }), on('message:update', (m) => { if (m.fal) load(); }), on('falai', () => load()), on('falhold', () => load())];
  return () => offs.forEach((f) => f());
}

// ================= Kahve falı =================
function kahve(view) {
  const files = [];
  const paint = () => {
    view.innerHTML = `${head('Kahve falı')}<div class="fal-pad">
      <div class="fal-head"><span class="em">☕️</span><h2>Fincanını gönder</h2><p class="muted">Kahveni iç, fincanı tabağa kapat ve soğumasını bekle. Fincanın içinden iki, tabaktan bir fotoğraf çek.</p></div>
      <div class="cup-slots">${['Fincan 1', 'Fincan 2', 'Tabak'].map((l, i) => `<button class="cup-slot" data-i="${i}">${files[i] ? `<img src="${URL.createObjectURL(files[i])}" alt="">` : `${icon('camera')}<span>${l}</span>`}</button>`).join('')}</div>
      ${noteField('Niyetin, merak ettiğin konu... (isteğe bağlı)')}
      <div class="bar" hidden><i></i></div>
      <button class="btn primary block go" ${files.filter(Boolean).length ? '' : 'disabled'}>${icon('send')} Falcı Teyze’ye gönder</button>${note}</div>`;
    view.querySelector('.cup-slots').onclick = async (e) => {
      const b = e.target.closest('.cup-slot'); if (!b) return;
      const f = await pickFile('image/*', 'environment'); if (!f) return;
      const nt = view.querySelector('.nt').value;
      files[+b.dataset.i] = f; paint(); view.querySelector('.nt').value = nt;
    };
    view.querySelector('.go').onclick = async (e) => {
      const btn = e.currentTarget; btn.disabled = true;
      const bar = view.querySelector('.bar'); bar.hidden = false;
      try {
        const list = files.filter(Boolean); const images = [];
        for (let i = 0; i < list.length; i++) {
          images.push((await uploadFile(await compressImage(list[i], 1080, 0.82), (p) => { bar.firstElementChild.style.width = `${((i + p) / list.length) * 100}%`; })).url);
        }
        await send({ type: 'kahve', images, note: view.querySelector('.nt').value }, btn);
      } catch (er) { toast(er.message); btn.disabled = false; bar.hidden = true; }
    };
  };
  paint();
  return null;
}

// ================= Tarot =================
function tarot(view) {
  const r = seeded(`${state.me.id}|${Date.now()}`);
  const deck = r.some(TAROT, 9).map((c) => ({ c, rev: r.rnd() < 0.3 }));
  const picked = [];
  view.innerHTML = `${head('Tarot falı')}<div class="fal-pad">
    <div class="fal-head"><span class="em">🔮</span><h2>Üç kart çek</h2><p class="muted">Aklındaki soruya odaklan ve içinden gelen kartlara dokun. Kartlarını Falcı Teyze yorumlayacak.</p></div>
    <div class="tarot-row">${TAROT_POS.map((p, i) => `<div class="slot" data-i="${i}"><div class="tcard"><div class="face back"></div><div class="face front"></div></div><span>${p}</span></div>`).join('')}</div>
    <div class="tarot-deck">${deck.map((_, i) => `<button class="dcard" data-i="${i}" aria-label="Kart çek" style="--r:${(i - 4) * 6}deg;--y:${Math.abs(i - 4) * 5}px"></button>`).join('')}</div>
    <div class="tarot-out" hidden>${noteField('Sorun ya da niyetin (isteğe bağlı)')}<button class="btn primary block go" style="margin-top:12px">${icon('send')} Falcı Teyze’ye gönder</button></div>${note}</div>`;
  view.querySelector('.tarot-deck').onclick = (e) => {
    const b = e.target.closest('.dcard'); if (!b || picked.length >= 3 || b.disabled) return;
    b.disabled = true; b.classList.add('gone');
    const d = deck[+b.dataset.i]; picked.push(d);
    const slot = view.querySelectorAll('.slot')[picked.length - 1];
    const front = slot.querySelector('.front');
    front.innerHTML = `<span class="ico">${d.c[2]}</span><b>${esc(d.c[1])}</b><small>${d.c[0]}${d.rev ? ' · ters' : ''}</small>`;
    if (d.rev) front.classList.add('rev');
    requestAnimationFrame(() => slot.querySelector('.tcard').classList.add('flip'));
    navigator.vibrate?.(10);
    if (picked.length === 3) {
      setTimeout(() => { view.querySelector('.tarot-deck').hidden = true; view.querySelector('.tarot-out').hidden = false; }, 800);
    }
  };
  view.querySelector('.go').onclick = (e) => send({
    type: 'tarot', note: view.querySelector('.nt').value,
    cards: picked.map((d, i) => ({ name: d.c[1], em: d.c[2], rev: d.rev, pos: TAROT_POS[i] })),
  }, e.currentTarget);
  return null;
}

// ================= Burç =================
function burc(view) {
  let sel = state.me.zodiac || null;
  view.innerHTML = `${head('Burç yorumu')}<div class="fal-pad">
    <div class="fal-head"><span class="em">✨</span><h2>Burcun hangisi?</h2><p class="muted">Seçtiğin burç profilinde saklanır.</p></div>
    <div class="z-grid">${ZODIAC.map(([id, n, s, d]) => `<button class="z-opt ${sel === id ? 'on' : ''}" data-z="${id}"><span>${s}</span><b>${n}</b><small>${d}</small></button>`).join('')}</div>
    ${noteField('Ne merak ediyorsun? Aşk, iş, okul...')}
    <button class="btn primary block go" ${sel ? '' : 'disabled'}>${icon('send')} Falcı Teyze’ye gönder</button>${note}</div>`;
  view.querySelector('.z-grid').onclick = (e) => {
    const b = e.target.closest('[data-z]'); if (!b) return;
    sel = b.dataset.z;
    view.querySelectorAll('.z-opt').forEach((x) => x.classList.toggle('on', x === b));
    view.querySelector('.go').disabled = false;
    api('/me', { method: 'PATCH', body: { zodiac: sel } }).then((u) => Object.assign(state.me, u)).catch(() => {});
  };
  view.querySelector('.go').onclick = (e) => send({ type: 'burc', zodiac: sel, note: view.querySelector('.nt').value }, e.currentTarget);
  return null;
}

// ================= Aşk uyumu =================
async function uyum(view) {
  let partner = null;
  view.innerHTML = `${head('Aşk uyumu')}<div class="fal-pad"><div class="fal-head"><span class="em">💞</span><h2>Kiminle uyumuna baksın?</h2></div>
    <div class="pl"><div class="spinner"></div></div>
    ${noteField('Aranızda neler oluyor? (isteğe bağlı)')}
    <button class="btn primary block go" disabled>${icon('send')} Falcı Teyze’ye gönder</button>${note}</div>`;
  const [matches, people] = await Promise.all([api('/matches').catch(() => []), api('/people').catch(() => [])]);
  const seen = new Set(); const list = [];
  matches.forEach((m) => { if (!seen.has(m.user.id)) { seen.add(m.user.id); list.push({ ...m.user, matched: true }); } });
  people.forEach((u) => { if (!seen.has(u.id)) { seen.add(u.id); list.push(u); } });
  const pl = view.querySelector('.pl');
  pl.innerHTML = list.length ? list.slice(0, 30).map((u) => `<button class="list-item" data-id="${esc(u.id)}" style="border-radius:14px">${avatar(u, 44)}<div class="grow"><div class="b">${esc(u.name)}</div><div class="sub">${u.matched ? '💞 Eşleşmen' : '@' + esc(u.username)}</div></div><span class="check">${icon('check')}</span></button>`).join('')
    : '<div class="empty">Henüz kimse yok. Önce birkaç kişiyle tanış.</div>';
  pl.onclick = (e) => {
    const b = e.target.closest('[data-id]'); if (!b) return;
    partner = b.dataset.id;
    pl.querySelectorAll('.check').forEach((c) => c.classList.toggle('on', c.closest('[data-id]') === b));
    view.querySelector('.go').disabled = false;
  };
  view.querySelector('.go').onclick = (e) => send({ type: 'uyum', partnerId: partner, note: view.querySelector('.nt').value }, e.currentTarget);
  return null;
}

export default function fal(view, sub) {
  if (state.me.role === 'falci') return queue(view);
  if (sub === 'kahve') return kahve(view);
  if (sub === 'tarot') return tarot(view);
  if (sub === 'burc') return burc(view);
  if (sub === 'uyum') return uyum(view);
  return hub(view);
}
export { zodiacOf };

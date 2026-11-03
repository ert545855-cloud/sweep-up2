// Yardım ve destek: talep aç, destek ekibiyle yazış
import { icon } from '../icons.js';
import { api, esc, toast, ago, clock, on, pickFile, compressImage, uploadFile } from '../core.js';

const back = (to) => `<a class="ib" href="${to}" aria-label="Geri">${icon('back')}</a>`;
const ST = { open: ['wait', 'Cevap bekliyor'], answered: ['ok', 'Cevaplandı'], closed: ['', 'Kapandı'] };
const FAQ = [
  ['Jeton aldım ama hesabıma yüklenmedi', 'Havale/EFT ödemeleri ekibimiz tarafından kontrol edilip genellikle birkaç saat içinde yüklenir. Açıklamaya sipariş kodunu yazdığından emin ol.'],
  ['Hesabım askıya alındı', 'Bildirimlerdeki uyarıdan itiraz edebilirsin. İtirazın incelenip sonuç sana bildirilir.'],
  ['Şifremi unuttum', 'Giriş ekranındaki “Şifremi unuttum” ile kurtarma kodunla ya da e-postanla yeni şifre belirleyebilirsin.'],
  ['Birini nasıl şikayet ederim?', 'Profilindeki ⋯ menüsünden ya da mesaja uzun basarak “Bildir”i seç. Şikayetler gizlidir.'],
];

export default async function support(view, id) {
  if (id === 'yeni') return newTicket(view);
  if (id) return thread(view, id);
  view.innerHTML = `<header class="topbar">${back('#/settings')}<div class="center">Yardım ve destek</div><span class="ib"></span></header><div class="sup"><div class="spinner"></div></div>`;
  const box = view.querySelector('.sup');
  const load = async () => {
    const r = await api('/support');
    box.innerHTML = `<section class="sup-hero"><span class="sh-ic">🎧</span><div class="grow"><b>Sana nasıl yardımcı olabiliriz?</b><small>Destek ekibimiz talebini panelden okuyup buradan cevaplar. Cevap gelince bildirim alırsın.</small></div></section>
      <a class="btn primary block" href="#/destek/yeni">${icon('edit')} Yeni destek talebi</a>
      ${r.items.length ? `<h3 class="shop-h">Taleplerin</h3>${r.items.map((t) => `<a class="sup-it ${t.userUnread ? 'unread' : ''}" href="#/destek/${esc(t.id)}">
        <div class="grow"><div class="b">${esc(t.subject)} <small class="muted">#${t.no}</small></div><div class="sub muted">${esc(t.categoryLabel)} · ${ago(t.lastAt, true)}</div>
        <div class="sub ellipsis">${t.lastFrom === 'admin' ? '<b>Destek:</b> ' : ''}${esc(t.last)}</div></div>
        <span class="pill ${ST[t.status][0]}">${t.userUnread ? 'Yeni cevap' : ST[t.status][1]}</span></a>`).join('')}` : ''}
      <h3 class="shop-h">Sık sorulanlar</h3>
      <div class="faq">${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
      <div style="height:30px"></div>`;
  };
  await load();
  const off = on('support', () => load().catch(() => {}));
  return off;
}

function newTicket(view) {
  view.innerHTML = `<header class="topbar">${back('#/destek')}<div class="center">Yeni talep</div><span class="ib"></span></header>
    <form class="form sup-f"><div class="spinner"></div></form>`;
  const f = view.querySelector('form');
  let image = null;
  api('/support').then((r) => {
    f.innerHTML = `<label>Konu türü<select class="field" name="c">${Object.entries(r.cats).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></label>
      <label>Konu<input class="field" name="s" maxlength="80" placeholder="ör. Jeton yüklenmedi"></label>
      <label>Açıklama<textarea class="field" name="t" rows="6" maxlength="2000" placeholder="Ne oldu? Ne zaman oldu? Varsa sipariş kodunu yaz."></textarea></label>
      <div class="sup-img"><button type="button" class="btn sm att">${icon('image')} Ekran görüntüsü ekle</button><span class="prev"></span></div>
      <p class="muted" style="margin:0;font-size:12.5px">Şifreni ya da kart bilgilerini asla yazma; ekibimiz bunları sormaz.</p>
      <button class="btn primary block">Gönder</button>`;
    f.querySelector('.att').onclick = async () => {
      const file = await pickFile('image/*'); if (!file) return;
      const p = f.querySelector('.prev'); p.innerHTML = '<span class="spinner sm"></span>';
      try { image = (await uploadFile(await compressImage(file))).url; p.innerHTML = `<img src="${esc(image)}" alt=""><button type="button" class="link rmimg">Kaldır</button>`; p.querySelector('.rmimg').onclick = () => { image = null; p.innerHTML = ''; }; } catch (e) { p.innerHTML = ''; toast(e.message); }
    };
  });
  f.onsubmit = async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button:not([type])'); btn.disabled = true;
    try { const t = await api('/support', { body: { category: f.c.value, subject: f.s.value, text: f.t.value, image } }); toast('Talebin alındı. Cevap gelince bildirim alacaksın.'); location.hash = `#/destek/${t.id}`; } catch (er) { toast(er.message); btn.disabled = false; }
  };
}

async function thread(view, id) {
  view.innerHTML = `<div class="chat sup-chat"><header class="topbar bordered">${back('#/destek')}<div class="who"><span class="genel-ic">🎧</span><div class="grow"><div class="n ellipsis">Destek</div><div class="s ellipsis"></div></div></div><button class="ib more" aria-label="Seçenekler">${icon('more')}</button></header>
    <div class="msgs"><div class="spinner" style="margin-top:30vh"></div></div><div class="composer"></div></div>`;
  const box = view.querySelector('.msgs'); const comp = view.querySelector('.composer');
  let t;
  const paint = () => {
    view.querySelector('.n').textContent = t.subject;
    view.querySelector('.s').textContent = `#${t.no} · ${t.categoryLabel} · ${ST[t.status][1]}`;
    box.innerHTML = t.msgs.map((m) => `<div class="mwrap ${m.from === 'user' ? 'me' : 'them'} gap">${m.from === 'admin' ? '<span class="sender">SwipeUp Destek</span>' : ''}<div class="msg">${m.image ? `<a href="${esc(m.image)}" target="_blank" rel="noopener"><img class="sup-im" src="${esc(m.image)}" alt=""></a>` : ''}${esc(m.text)}<span class="meta">${clock(m.at)}</span></div></div>`).join('')
      + (t.status === 'open' ? '<div class="sys">Talebin ekibimize iletildi. Cevap gelince bildirim alacaksın.</div>' : t.status === 'closed' ? '<div class="sys">Bu talep kapatıldı. Yazarsan yeniden açılır.</div>' : '');
    box.scrollTop = box.scrollHeight;
  };
  const load = async () => { t = await api(`/support/${id}`); paint(); };
  try { await load(); } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return null; }
  comp.innerHTML = `<form class="row1"><div class="box"><textarea rows="1" placeholder="Mesaj yaz..." maxlength="2000"></textarea></div><button class="go" aria-label="Gönder">${icon('send')}</button></form>`;
  const ta = comp.querySelector('textarea');
  ta.oninput = () => { ta.style.height = 'auto'; ta.style.height = `${Math.min(120, ta.scrollHeight)}px`; };
  comp.querySelector('form').onsubmit = async (e) => {
    e.preventDefault(); const text = ta.value.trim(); if (!text) return;
    ta.value = ''; ta.style.height = 'auto';
    try { await api(`/support/${id}/reply`, { body: { text } }); await load(); } catch (er) { toast(er.message); ta.value = text; }
  };
  view.querySelector('.more').onclick = async () => {
    if (t.status === 'closed' || !confirm('Sorunun çözüldü mü? Talep kapatılsın mı?')) return;
    try { await api(`/support/${id}/close`, { body: {} }); toast('Talep kapatıldı. Teşekkürler!'); load(); } catch (er) { toast(er.message); }
  };
  const off = on('support', (d) => { if (d.id === id) load().catch(() => {}); });
  return off;
}

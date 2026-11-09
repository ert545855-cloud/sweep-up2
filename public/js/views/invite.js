import { icon } from '../icons.js';
import { api, esc, toast, avatar, nm, sheet } from '../core.js';

// Bağlantıyı panoya kopyala; tarayıcı izin vermezse seçilebilir kutuda göster
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  try {
    const ta = Object.assign(document.createElement('textarea'), { value: text, readOnly: true });
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.append(ta); ta.select(); ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy'); ta.remove(); if (ok) return true;
  } catch {}
  return false;
}
function linkSheet(link) {
  sheet('Davet bağlantın', `<div class="inv-ls"><p class="muted">Bağlantıyı basılı tutup kopyala, sonra arkadaşına gönder.</p><input class="field" readonly value="${esc(link)}"></div>`, {
    onMount(sh) { const i = sh.querySelector('input'); setTimeout(() => { i.focus(); i.select(); }, 60); },
  });
}

export default async function invite(view) {
  view.innerHTML = `<header class="topbar"><button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/me')" aria-label="Geri">${icon('back')}</button><div class="center">Davet et, kazan</div><span class="ib"></span></header><div class="invite"><div class="spinner"></div></div>`;
  const box = view.querySelector('.invite');
  const load = async () => {
    let r;
    try { r = await api('/invite'); } catch (e) { box.innerHTML = `<div class="empty"><h2>Davet sayfası açılamadı</h2>${esc(e.message)}<p><button class="btn primary rl">Tekrar dene</button></p></div>`; box.querySelector('.rl').onclick = load; return; }
    const link = `${location.origin}/?ref=${encodeURIComponent(r.code)}#/register`;
    const text = `SwipeUp’ta tanışalım! Bu bağlantıyla kayıt olup profil fotoğrafını eklersen ikimiz de ${r.coins} jeton kazanıyoruz. Davet kodum: ${r.code}`;
    const by = r.invitedBy;
    box.innerHTML = `<section class="inv-hero"><div class="inv-gift">${icon('gift')}</div><h2>Arkadaşını getir, ikiniz de ${r.coins} jeton kazanın</h2>
      <p class="muted">Arkadaşın bağlantınla ya da davet kodunla kayıt olup profil fotoğrafını eklediğinde jetonlar ikinize de yüklenir.</p>
      <button type="button" class="inv-code" aria-label="Davet kodunu kopyala"><small>Davet kodun · kopyalamak için dokun</small><b>${esc(r.code)}</b></button>
      <div class="inv-btns"><button class="btn primary sh">${icon('share')} Paylaş</button><button class="btn cp">${icon('link')} Bağlantıyı kopyala</button></div></section>
      ${by ? `<div class="inv-by">${avatar(by, 40, { dot: false })}<div class="grow"><b>${nm(by)} seni davet etti</b><small>${by.rewarded ? `İkinize de ${r.coins} jeton yüklendi.` : by.needsPhoto ? `Profil fotoğrafını ekle, ikinize de ${r.coins} jeton yüklensin.` : 'Ödülün işleniyor.'}</small></div>${!by.rewarded && by.needsPhoto ? '<a class="btn sm primary" href="#/edit">Fotoğraf ekle</a>' : ''}</div>` : ''}
      ${r.canRedeem ? `<form class="inv-redeem"><div class="grow"><b>Davet kodun var mı?</b><small>Seni davet eden arkadaşının kodunu gir, ikiniz de ${r.coins} jeton kazanın.</small></div>
        <div class="row"><input class="field" name="c" placeholder="ör. ${esc(r.code.replace(/./g, 'X'))}" maxlength="6" autocapitalize="characters" autocomplete="off" spellcheck="false"><button class="btn primary">Kullan</button></div></form>` : ''}
      <h3 class="shop-h">Davet ettiklerin <span class="muted">${r.items.length ? `· ${r.rewarded} ödül` : ''}</span></h3>
      ${r.items.length ? r.items.map((u) => `<a class="list-item" href="#/u/${esc(u.username)}">${avatar(u, 40, { dot: false })}<div class="grow"><div class="b">${nm(u)}</div><div class="sub">${u.rewarded ? `+${r.coins} jeton kazandın` : 'Profil fotoğrafı eklemesi bekleniyor'}</div></div>${u.rewarded ? '<span class="pill ok">Kazanıldı</span>' : '<span class="pill">Bekliyor</span>'}</a>`).join('') : '<div class="empty" style="padding:16px">Henüz kimseyi davet etmedin.</div>'}
      <p class="muted" style="font-size:12px;margin:18px 4px">Aynı ağdan açılan birden fazla hesap ve ayda 30’dan fazla davet ödül kazandırmaz. Davet kodu kayıttan sonraki 7 gün içinde girilebilir.</p>`;
    const copyLink = async () => { if (await copyText(link)) toast('Bağlantı kopyalandı.'); else linkSheet(link); };
    box.querySelector('.cp').onclick = copyLink;
    box.querySelector('.inv-code').onclick = async () => { if (await copyText(r.code)) toast('Davet kodu kopyalandı.'); else linkSheet(link); };
    box.querySelector('.sh').onclick = async () => {
      if (navigator.share) {
        try { await navigator.share({ title: 'SwipeUp', text, url: link }); } catch (e) { if (e?.name !== 'AbortError') copyLink(); }
      } else copyLink();
    };
    const rf = box.querySelector('.inv-redeem');
    if (rf) {
      rf.c.addEventListener('input', () => { rf.c.value = rf.c.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
      rf.onsubmit = async (e) => {
        e.preventDefault(); const b = rf.querySelector('button'); b.disabled = true;
        try {
          const x = await api('/invite/redeem', { body: { code: rf.c.value } });
          toast(x.rewarded ? `Davet kodu kullanıldı, ${x.coins} jeton hesabına yüklendi!` : `Davet kodu kaydedildi. Profil fotoğrafını ekleyince ikinize de ${x.coins} jeton yüklenecek.`, { ms: 5000 });
          load();
        } catch (er) { toast(er.message); b.disabled = false; }
      };
    }
  };
  await load();
}

import { icon } from '../icons.js';
import {
  state, api, esc, toast, sheet, logout, avatar, refreshBadges,
} from '../core.js';

const PRIV = [
  ['private', 'lock', 'Gizli hesap', 'Gönderilerini ve hikayelerini sadece onayladığın takipçiler görür'],
  ['hideLastSeen', 'eye', 'Son görülmeyi gizle', 'Çevrimiçi durumun ve son görülmen kimseye görünmez'],
  ['hideRead', 'dcheck', 'Okundu bilgisini kapat', 'Mavi tik gönderilmez; sen de başkalarınınkini göremezsin'],
  ['hideFromDeck', 'flame', 'Kaydırmada beni gösterme', 'Keşfet destesinde yeni kişilere çıkmazsın'],
];
import { notifSettings, themeMenu } from './profile.js';
import { openFilters } from './swipe.js';
import { eventInfo, eventLive, eventEnabled, setEventEnabled, PUMPKIN } from '../event.js';

export default function settings(view) {
  const me = state.me;
  view.innerHTML = `<header class="topbar"><button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/me')" aria-label="Geri">${icon('back')}</button><div class="center">Ayarlar</div><span class="ib"></span></header>
    <div class="group-t">Profil</div>
    <div class="group">
      <a class="it" href="#/fal">${icon('star')}<span class="grow">${me.role === 'falci' ? 'Fal kuyruğu' : 'Fal'}<div class="sub">${me.role === 'falci' ? 'Gelen fal isteklerini cevapla' : 'Falcı Teyze’ye kahve falı, tarot, burç, aşk uyumu'}</div></span></a>
      <a class="it" href="#/edit">${icon('edit')}<span class="grow">Profili düzenle<div class="sub">Fotoğraflar, biyografi, ilgi alanları</div></span></a>
      <button class="it pref">${icon('sliders')}<span class="grow">Kaydırma tercihleri<div class="sub">Yaş aralığı, uzaklık, kimleri görmek istediğin</div></span></button>
    </div>
    <div class="group-t">Üyelik</div>
    <div class="group">
      <a class="it" href="#/store">${icon('crown')}<span class="grow">SwipeUp+ ve jeton<div class="sub">${me.plus ? 'SwipeUp+ üyesisin' : 'Sınırsız beğeni, seni beğenenler, geri al'} · ${me.coins || 0} jeton</div></span></a>
      <a class="it" href="#/wallet">${icon('gift')}<span class="grow">Kazançlarım<div class="sub">Canlı yayın hediyeleri ve ödeme talebi</div></span></a>
      <a class="it" href="#/verify">${icon('shield')}<span class="grow">Profil doğrulama<div class="sub">${me.verified ? 'Profilin doğrulandı ✓' : 'Selfie ile mavi tik al'}</div></span></a>
    </div>
    <div class="group-t">Gizlilik</div>
    <div class="group">
      ${PRIV.map(([k, ic, t, sub]) => `<label class="it">${icon(ic)}<span class="grow">${t}<div class="sub">${sub}</div></span><input type="checkbox" class="sw" data-k="${k}" ${me.privacy?.[k] ? 'checked' : ''}></label>`).join('')}
      <a class="it" href="#/requests">${icon('userPlus')}<span class="grow">Takip istekleri</span>${state.badges.requests ? `<span class="num-badge static">${state.badges.requests}</span>` : ''}</a>
      <button class="it bl">${icon('block')}<span class="grow">Engellenenler</span></button>
    </div>
    <div class="group-t">Hesap</div>
    <div class="group">
      <button class="it em">${icon('mail')}<span class="grow">E-posta<div class="sub">${esc(me.email || 'Eklenmedi — şifre sıfırlama için ekle')}</div></span></button>
      <button class="it pw">${icon('lock')}<span class="grow">Şifreyi değiştir</span></button>
      <button class="it rc">${icon('key')}<span class="grow">Yeni kurtarma kodu oluştur<div class="sub">Eski kod geçersiz olur</div></span></button>
    </div>
    <div class="group-t">Uygulama</div>
    <div class="group">
      <a class="it" href="#/install">${icon('download')}<span class="grow">Telefona yükle<div class="sub">iPhone’da Ana Ekrana Ekle, Android’de Uygulamayı yükle</div></span></a>
      <button class="it nt">${icon('bell')}<span class="grow">Bildirimler</span></button>
      <button class="it th">${icon('sun')}<span class="grow">Tema<div class="sub">Gün batımı, Pembe rüya, Gece moru, Altın</div></span></button>
      ${eventLive() ? `<label class="it ev-it"><span class="ev-ic">${PUMPKIN}</span><span class="grow">${esc(eventInfo().name)} teması<div class="sub">${esc(new Date(eventInfo().end - 1).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }))} gününe kadar. Sonra seçtiğin tema kendiliğinden geri gelir.</div></span><input type="checkbox" class="sw sw-ev" ${eventEnabled() ? 'checked' : ''}></label>` : ''}
    </div>
    <div class="group-t">Yasal ve verilerim</div>
    <div class="group">
      <a class="it" href="#/legal/gizlilik">${icon('doc')}<span class="grow">Gizlilik politikası</span></a>
      <a class="it" href="#/legal/kosullar">${icon('doc')}<span class="grow">Kullanım koşulları</span></a>
      <a class="it" href="#/legal/kvkk">${icon('doc')}<span class="grow">KVKK aydınlatma metni</span></a>
      <a class="it" href="#/legal/kurallar">${icon('users')}<span class="grow">Topluluk kuralları</span></a>
      <button class="it dl">${icon('download')}<span class="grow">Verilerimi indir<div class="sub">Profil, gönderi, mesaj ve diğer verilerin (JSON)</div></span></button>
    </div>
    <div class="group"><button class="it danger lo">${icon('logout')}Çıkış yap</button>${me.role === 'falci' ? '' : `<button class="it danger del">${icon('trash')}Hesabımı sil</button>`}</div>
    <p class="muted" style="text-align:center;font-size:12px;padding-bottom:20px">SwipeUp · @${esc(me.username)}</p>`;

  view.querySelector('.sw-ev')?.addEventListener('change', (e) => {
    setEventEnabled(e.target.checked);
    toast(e.target.checked ? `${eventInfo().name} teması açıldı 🎃` : 'Etkinlik teması kapatıldı. Seçtiğin tema geri geldi.');
  });
  view.querySelectorAll('.sw[data-k]').forEach((c) => {
    c.onchange = async () => {
      try {
        const u = await api('/me', { method: 'PATCH', body: { privacy: { [c.dataset.k]: c.checked } } });
        state.me.privacy = u.privacy;
        toast(c.checked ? 'Açıldı.' : 'Kapatıldı.');
      } catch (e) { c.checked = !c.checked; toast(e.message); }
    };
  });
  view.querySelector('.dl').onclick = async () => {
    try {
      const r = await fetch('/api/me/export', { headers: { Authorization: 'Bearer ' + state.token } });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'İndirilemedi.');
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `swipeup-${me.username}-veriler.json`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('Verilerin indirildi.');
    } catch (e) { toast(e.message); }
  };
  view.querySelector('.del')?.addEventListener('click', () => sheet('Hesabını sil', `<form class="form"><p style="margin:0">Hesabın, gönderilerin, hikayelerin, eşleşmelerin ve mesajların <b>kalıcı olarak</b> silinir. Bu işlem geri alınamaz.</p>
      <p class="muted" style="margin:0;font-size:13px">İstersen önce “Verilerimi indir” ile bir kopyasını al. Kalan jetonların ve SwipeUp+ üyeliğin de silinir.</p>
      <textarea class="field" name="r" rows="2" maxlength="300" placeholder="Neden ayrılıyorsun? (isteğe bağlı)"></textarea>
      <input class="field" name="p" type="password" placeholder="Onaylamak için şifren" autocomplete="current-password">
      <button class="btn hot block">Hesabımı kalıcı olarak sil</button></form>`, {
    onMount(sh, close) {
      const f = sh.querySelector('form');
      f.onsubmit = async (e) => {
        e.preventDefault();
        if (!confirm('Son kez soruyoruz: hesabın kalıcı olarak silinsin mi?')) return;
        try { await api('/me', { method: 'DELETE', body: { password: f.p.value, reason: f.r.value } }); close(); toast('Hesabın silindi. Hoşça kal 👋'); setTimeout(logout, 1200); } catch (er) { toast(er.message); }
      };
    },
  }));
  refreshBadges();
  view.querySelector('.pref').onclick = () => openFilters(() => toast('Tercihler kaydedildi.'));
  view.querySelector('.nt').onclick = notifSettings;
  view.querySelector('.th').onclick = themeMenu;
  view.querySelector('.lo').onclick = () => { if (confirm('Çıkış yapılsın mı?')) logout(); };
  view.querySelector('.em').onclick = () => sheet('E-posta', `<form class="form"><p class="muted" style="margin:0">Şifreni unutursan sıfırlama kodu bu adrese gönderilir. Başkalarına gösterilmez.</p>
      <input class="field" name="e" type="email" value="${esc(me.email || '')}" placeholder="ornek@mail.com"><button class="btn primary block">Kaydet</button></form>`, {
    onMount(sh, close) {
      const f = sh.querySelector('form');
      f.onsubmit = async (e) => { e.preventDefault(); try { Object.assign(state.me, await api('/me', { method: 'PATCH', body: { email: f.e.value } })); close(); toast('E-posta kaydedildi.'); settings(view); } catch (er) { toast(er.message); } };
    },
  });
  view.querySelector('.pw').onclick = () => sheet('Şifreyi değiştir', `<form class="form"><input class="field" name="c" type="password" placeholder="Mevcut şifre" autocomplete="current-password">
      <input class="field" name="n" type="password" placeholder="Yeni şifre (en az 6 karakter)" autocomplete="new-password"><button class="btn primary block">Değiştir</button></form>`, {
    onMount(sh, close) {
      const f = sh.querySelector('form');
      f.onsubmit = async (e) => { e.preventDefault(); try { await api('/me/password', { body: { current: f.c.value, password: f.n.value } }); close(); toast('Şifren değişti.'); } catch (er) { toast(er.message); } };
    },
  });
  view.querySelector('.rc').onclick = async () => {
    if (!confirm('Yeni kurtarma kodu oluşturulsun mu? Eski kod çalışmayacak.')) return;
    const r = await api('/me/recovery', { body: {} });
    sheet('Kurtarma kodun', `<div style="padding:0 16px 16px;display:grid;gap:12px"><p class="muted" style="margin:0">Şifreni unutursan bu kodla girebilirsin. Güvenli bir yere not et.</p><div class="code-box">${esc(r.recoveryCode)}</div><button class="btn outline block cp">${icon('copy')} Kopyala</button></div>`, {
      onMount(sh) { sh.querySelector('.cp').onclick = async () => { await navigator.clipboard?.writeText(r.recoveryCode); toast('Kopyalandı.'); }; },
    });
  };
  view.querySelector('.bl').onclick = () => sheet('Engellenenler', '<div class="bll"><div class="spinner"></div></div>', {
    async onMount(sh) {
      const box = sh.querySelector('.bll');
      const paint = async () => {
        const us = await api('/blocks');
        box.innerHTML = us.length ? us.map((u) => `<div class="list-item">${avatar(u, 44, { dot: false })}<div class="grow"><div class="b">${esc(u.name)}</div><div class="sub">@${esc(u.username)}</div></div><button class="btn sm outline ub" data-id="${esc(u.id)}">Engeli kaldır</button></div>`).join('') : '<div class="empty">Engellediğin kimse yok.</div>';
      };
      await paint();
      box.onclick = async (e) => { const b = e.target.closest('.ub'); if (!b) return; await api(`/users/${b.dataset.id}/block`, { method: 'DELETE' }); toast('Engel kaldırıldı.'); paint(); };
    },
  });
  return null;
}

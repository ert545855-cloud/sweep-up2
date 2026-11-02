import { icon } from '../icons.js';
import {
  state, api, esc, toast, sheet, logout, avatar,
} from '../core.js';
import { notifSettings, themeMenu } from './profile.js';
import { openFilters } from './swipe.js';

export default function settings(view) {
  const me = state.me;
  view.innerHTML = `<header class="topbar"><button class="ib" onclick="history.length > 1 ? history.back() : (location.hash = '#/me')" aria-label="Geri">${icon('back')}</button><div class="center">Ayarlar</div><span class="ib"></span></header>
    <div class="group-t">Profil</div>
    <div class="group">
      <a class="it" href="#/edit">${icon('edit')}<span class="grow">Profili düzenle<div class="sub">Fotoğraflar, biyografi, ilgi alanları</div></span></a>
      <button class="it pref">${icon('sliders')}<span class="grow">Kaydırma tercihleri<div class="sub">Yaş aralığı, uzaklık, kimleri görmek istediğin</div></span></button>
    </div>
    <div class="group-t">Hesap</div>
    <div class="group">
      <button class="it em">${icon('mail')}<span class="grow">E-posta<div class="sub">${esc(me.email || 'Eklenmedi — şifre sıfırlama için ekle')}</div></span></button>
      <button class="it pw">${icon('lock')}<span class="grow">Şifreyi değiştir</span></button>
      <button class="it rc">${icon('key')}<span class="grow">Yeni kurtarma kodu oluştur<div class="sub">Eski kod geçersiz olur</div></span></button>
    </div>
    <div class="group-t">Uygulama</div>
    <div class="group">
      <button class="it nt">${icon('bell')}<span class="grow">Bildirimler</span></button>
      <button class="it th">${icon('sun')}<span class="grow">Görünüm</span></button>
      <button class="it bl">${icon('block')}<span class="grow">Engellenenler</span></button>
    </div>
    <div class="group"><button class="it danger lo">${icon('logout')}Çıkış yap</button></div>
    <p class="muted" style="text-align:center;font-size:12px;padding-bottom:20px">SwipeUp · @${esc(me.username)}</p>`;

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

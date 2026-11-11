// Bu cihazda kayıtlı hesaplar: giriş yapılan her hesap burada tutulur, aralarında şifresiz tek dokunuşla geçilir.
// Oturum anahtarları zaten bu cihazda duruyordu (su_token); burada yalnızca birden fazlası saklanıyor.
import { icon } from './icons.js';
import { esc, sheet, state, toast } from './core.js';

const KEY = 'su_accounts'; export const MAX_ACCOUNTS = 5;

export function accounts() { try { const a = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(a) ? a.filter((x) => x?.id && x.token) : []; } catch { return []; } }
function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_ACCOUNTS))); } catch { /* gizli sekme */ } }

// Giriş yapılan ya da açılışta doğrulanan hesabı kaydet (bilgileri tazele, sırası değişmez)
export function remember(token, u) {
  if (!token || !u?.id) return;
  const list = accounts(); const i = list.findIndex((x) => x.id === u.id);
  const row = { id: u.id, username: u.username, name: u.name || u.username, avatar: u.avatar || '', token };
  if (i >= 0) list[i] = row; else { if (list.length >= MAX_ACCOUNTS) list.pop(); list.push(row); }
  save(list);
}
export function forget(id) { save(accounts().filter((x) => x.id !== id)); }

// Başka bir hesaba geç: anahtar değişir, uygulama o hesapla yeniden açılır
export function switchTo(id, hash = '#/me') {
  const a = accounts().find((x) => x.id === id); if (!a) return false;
  try { localStorage.setItem('su_token', a.token); sessionStorage.removeItem('su_add'); } catch { return false; }
  if (location.search) history.replaceState(null, '', '/' + hash); else location.hash = hash;
  location.reload(); return true;
}

// Yeni hesap ekle: mevcut hesap kayıtlı kalır, giriş ekranı "hesap ekle" olarak açılır
export function addAccount() {
  if (accounts().length >= MAX_ACCOUNTS) { toast(`En çok ${MAX_ACCOUNTS} hesap kaydedebilirsin. Önce birini kaldır.`); return; }
  try { sessionStorage.setItem('su_add', state.me?.id || '1'); } catch { /* yok */ }
  location.hash = '#/login';
}

// Hesap seçici: profil başlığı, profil sekmesine uzun basma ve ayarlardan açılır
export function accountSheet() {
  const me = state.me?.id; const list = accounts();
  sheet('Hesaplar', `<div class="acc-list">${list.map((a) => `<button class="acc${a.id === me ? ' on' : ''}" data-id="${esc(a.id)}"${a.id === me ? ' aria-current="true"' : ''}>
      <img src="${esc(a.avatar)}" alt=""><span class="grow"><b>${esc(a.name)}</b><small>@${esc(a.username)}</small></span>${a.id === me ? icon('check') : ''}</button>`).join('')}
      ${list.length < MAX_ACCOUNTS ? `<button class="acc add"><span class="acc-plus">${icon('plus')}</span><span class="grow"><b>Hesap ekle</b><small>Var olan bir hesaba giriş yap ya da yeni hesap aç</small></span></button>` : ''}</div>
    ${list.length > 1 ? `<p class="muted acc-note">Bildirimler kayıtlı tüm hesaplar için gelir. Bir hesabı bu cihazdan kaldırmak için o hesaptayken Ayarlar → Çıkış yap.</p>` : ''}`, {
    onMount(sh, close) {
      sh.querySelector('.acc-list').onclick = (e) => {
        const b = e.target.closest('.acc'); if (!b) return;
        if (b.classList.contains('add')) { close(); addAccount(); return; }
        if (b.dataset.id === me) { close(); return; }
        switchTo(b.dataset.id);
      };
    },
  });
}

// Bildirime dokunulunca o hesaba geçmek için: adresteki ?as= değeri
export function switchFromUrl() {
  try {
    const p = new URLSearchParams(location.search); const as = p.get('as'); if (!as) return false;
    p.delete('as'); const rest = p.toString(); history.replaceState(null, '', `/${rest ? `?${rest}` : ''}${location.hash}`);
    const a = accounts().find((x) => x.id === as);
    if (!a || a.token === localStorage.getItem('su_token')) return false;
    localStorage.setItem('su_token', a.token); state.token = a.token; return true;
  } catch { return false; }
}

import { api, setSession, esc, logo, state, toast } from '../core.js';
import { icon } from '../icons.js';
import { legalSheet } from './legal.js';
import { pendingRef } from '../extras.js';

// En geç bugünden 18 yıl önce doğmuş olmalı
export const maxBirth = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return d.toISOString().slice(0, 10); };

function codeScreen(view, code, next) {
  view.innerHTML = `<section class="auth">
    <div class="wordmark">${logo()}</div>
    <h2 style="text-align:center;margin:16px 0 6px;font-size:24px">Kurtarma kodun</h2>
    <p class="tagline" style="margin-bottom:18px">Şifreni unutursan hesabına bu kodla dönebilirsin. Ekran görüntüsü al ya da bir yere not et; bir daha gösterilmeyecek.</p>
    <div class="code-box">${esc(code)}</div>
    <div style="display:grid;gap:10px;margin-top:18px">
      <button class="btn outline block cp">${icon('copy')} Kodu kopyala</button>
      <button class="btn primary block go">Kaydettim, devam et</button>
    </div></section>`;
  view.querySelector('.cp').onclick = async () => { await navigator.clipboard?.writeText(code); toast('Kod kopyalandı.'); };
  view.querySelector('.go').onclick = next;
}

function forgot(view) {
  const emailOn = state.config?.emailReset;
  view.innerHTML = `<section class="auth">
    <div class="wordmark">${logo()}</div>
    <h2 style="text-align:center;margin:16px 0 6px;font-size:24px">Şifreni sıfırla</h2>
    <p class="tagline">${emailOn ? 'Kullanıcı adını ya da e-postanı yaz. Hesabına bağlı e-postaya 6 haneli bir kod göndereceğiz. Kurtarma kodunu da kullanabilirsin.' : 'Kayıt olurken aldığın 12 karakterlik kurtarma kodunu gir.'}</p>
    <form novalidate>
      <label class="ic-field">${icon('person')}<input class="field" name="login" placeholder="Kullanıcı adı veya e-posta" autocapitalize="none" spellcheck="false" required></label>
      ${emailOn ? '<button type="button" class="btn outline block send">E-postama kod gönder</button>' : ''}
      <label class="ic-field">${icon('key')}<input class="field" name="code" placeholder="${emailOn ? 'E-postadaki kod ya da kurtarma kodu' : 'Kurtarma kodu (ör. ABCD-EFGH-JKLM)'}" autocapitalize="characters" autocomplete="one-time-code"></label>
      <label class="ic-field">${icon('lock')}<input class="field" name="password" type="password" placeholder="Yeni şifre" autocomplete="new-password"></label>
      <button class="btn primary block">Şifreyi değiştir</button>
      <div class="err" role="alert"></div>
    </form>
    <div class="switch"><a class="link" href="#/login">Girişe dön</a></div></section>`;
  const f = view.querySelector('form'); const err = view.querySelector('.err');
  view.querySelector('.send')?.addEventListener('click', async () => {
    err.textContent = '';
    if (!f.login.value.trim()) { err.textContent = 'Önce kullanıcı adını ya da e-postanı yaz.'; return; }
    try { await api('/auth/forgot', { body: { login: f.login.value } }); toast('Hesabında e-posta kayıtlıysa kod gönderildi. Gereksiz klasörünü de kontrol et.', { ms: 5000 }); f.code.focus(); } catch (e) { err.textContent = e.message; }
  });
  f.onsubmit = async (e) => {
    e.preventDefault(); err.textContent = '';
    try {
      const r = await api('/auth/reset', { body: { login: f.login.value, code: f.code.value, password: f.password.value } });
      setSession(r.token, r.user);
      const done = () => { location.hash = '#/'; location.reload(); };
      if (r.recoveryCode) codeScreen(view, r.recoveryCode, done); else { toast('Şifren değişti.'); done(); }
    } catch (er) { err.textContent = er.message; }
  };
}

export default function auth(view, mode) {
  if (mode === 'forgot') return forgot(view);
  const reg = mode === 'register';
  view.innerHTML = `<section class="auth">
    <div class="wordmark">${logo()}</div>
    <p class="tagline">${reg ? 'Kaydır, eşleş, vitrine göz at, canlı yayında buluş.' : 'Kaydırmaya kaldığın yerden devam et.'}</p>
    <form novalidate>
      ${reg ? `<label class="ic-field">${icon('person')}<input class="field" name="name" placeholder="Adın" autocomplete="name" maxlength="40"></label>` : ''}
      <label class="ic-field">${icon('person')}<input class="field" name="username" placeholder="${reg ? 'Kullanıcı adı' : 'Kullanıcı adı veya e-posta'}" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
      ${reg ? `<label class="ic-field">${icon('mail')}<input class="field" name="email" type="email" placeholder="E-posta (şifre sıfırlama için, isteğe bağlı)" autocomplete="email"></label>` : ''}
      <label class="ic-field">${icon('lock')}<input class="field" name="password" type="password" placeholder="Şifre" autocomplete="${reg ? 'new-password' : 'current-password'}" required></label>
      ${reg ? `<label class="bd-field"><span>Doğum tarihin</span><input class="field" name="birthdate" type="date" max="${maxBirth()}" min="1920-01-01" required></label>
      <p class="muted" style="font-size:12.5px;margin:-4px 4px 0">SwipeUp 18 yaş ve üzeri içindir. Doğum tarihin profilinde gösterilmez, sadece yaşın görünür.</p>
      <label class="consent"><input type="checkbox" name="accept"><span><a class="link" data-doc="kosullar">Kullanım Koşulları</a>’nı ve <a class="link" data-doc="gizlilik">Gizlilik Politikası</a>’nı okudum, kabul ediyorum. <a class="link" data-doc="kvkk">KVKK aydınlatma metni</a>ni okudum.</span></label>` : ''}
      <button class="btn primary block" style="margin-top:6px">${reg ? 'Hesap oluştur' : 'Giriş yap'}</button>
      <div class="err" role="alert"></div>
    </form>
    ${reg ? '' : '<div class="forgot"><a class="muted" href="#/forgot">Şifreni mi unuttun?</a></div>'}
    ${reg ? '' : `<a class="ins-cta" href="#/install"><img src="/icons/icon-192.png" alt=""><span><b>Uygulamayı telefona yükle</b><small>iPhone ve Android · ücretsiz</small></span>${icon('download')}</a>`}
    ${reg ? '' : `<div class="legal-links"><a href="#/legal/gizlilik">Gizlilik</a> · <a href="#/legal/kosullar">Koşullar</a> · <a href="#/legal/kvkk">KVKK</a></div>`}
    <div class="switch">${reg ? 'Hesabın var mı? <a class="link" href="#/login">Giriş yap</a>' : 'Yeni misin? <a class="link" href="#/register">Hesap oluştur</a>'}</div>
  </section>`;
  const f = view.querySelector('form');
  const err = view.querySelector('.err');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button');
    btn.disabled = true; err.textContent = '';
    try {
      if (reg && !f.birthdate.value) throw new Error('Doğum tarihini gir.');
      if (reg && !f.accept.checked) throw new Error('Devam etmek için koşulları kabul etmelisin.');
      const body = { username: f.username.value, password: f.password.value, ...(reg ? { name: f.name.value, email: f.email.value, birthdate: f.birthdate.value, accept: f.accept.checked, ref: pendingRef() } : {}) };
      const r = await api(reg ? '/auth/register' : '/auth/login', { body });
      setSession(r.token, r.user);
      if (reg) { try { localStorage.removeItem('su_ref'); } catch {} }
      const go = () => { if (location.search) history.replaceState(null, '', '/' + (reg ? '#/edit' : '#/')); location.hash = reg ? '#/edit' : '#/'; location.reload(); };
      if (r.recoveryCode) codeScreen(view, r.recoveryCode, go); else go();
    } catch (er) {
      err.textContent = er.message;
      btn.disabled = false;
    }
  };
  f.querySelectorAll('[data-doc]').forEach((a) => { a.onclick = (e) => { e.preventDefault(); legalSheet(a.dataset.doc); }; });
  f.username.addEventListener('input', () => { if (reg) f.username.value = f.username.value.toLowerCase().replace(/\s/g, ''); });
  return null;
}

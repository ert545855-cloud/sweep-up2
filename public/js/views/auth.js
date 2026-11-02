import { api, setSession, esc, logo, state, toast } from '../core.js';
import { icon } from '../icons.js';

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
    <p class="tagline">${reg ? 'Kaydır, eşleş, dalgaları izle, canlı yayında buluş.' : 'Kaydırmaya kaldığın yerden devam et.'}</p>
    <form novalidate>
      ${reg ? `<label class="ic-field">${icon('person')}<input class="field" name="name" placeholder="Adın" autocomplete="name" maxlength="40"></label>` : ''}
      <label class="ic-field">${icon('person')}<input class="field" name="username" placeholder="${reg ? 'Kullanıcı adı' : 'Kullanıcı adı veya e-posta'}" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
      ${reg ? `<label class="ic-field">${icon('mail')}<input class="field" name="email" type="email" placeholder="E-posta (şifre sıfırlama için, isteğe bağlı)" autocomplete="email"></label>` : ''}
      <label class="ic-field">${icon('lock')}<input class="field" name="password" type="password" placeholder="Şifre" autocomplete="${reg ? 'new-password' : 'current-password'}" required></label>
      <button class="btn primary block" style="margin-top:6px">${reg ? 'Hesap oluştur' : 'Giriş yap'}</button>
      <div class="err" role="alert"></div>
    </form>
    ${reg ? '' : '<div class="forgot"><a class="muted" href="#/forgot">Şifreni mi unuttun?</a></div>'}
    <div class="switch">${reg ? 'Hesabın var mı? <a class="link" href="#/login">Giriş yap</a>' : 'Yeni misin? <a class="link" href="#/register">Hesap oluştur</a>'}</div>
  </section>`;
  const f = view.querySelector('form');
  const err = view.querySelector('.err');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button');
    btn.disabled = true; err.textContent = '';
    try {
      const body = { username: f.username.value, password: f.password.value, ...(reg ? { name: f.name.value, email: f.email.value } : {}) };
      const r = await api(reg ? '/auth/register' : '/auth/login', { body });
      setSession(r.token, r.user);
      const go = () => { location.hash = reg ? '#/edit' : '#/'; location.reload(); };
      if (r.recoveryCode) codeScreen(view, r.recoveryCode, go); else go();
    } catch (er) {
      err.textContent = er.message;
      btn.disabled = false;
    }
  };
  f.username.addEventListener('input', () => { if (reg) f.username.value = f.username.value.toLowerCase().replace(/\s/g, ''); });
  return null;
}

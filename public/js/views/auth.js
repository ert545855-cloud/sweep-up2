import { api, setSession, esc } from '../core.js';
import { icon } from '../icons.js';

export default function auth(view, mode) {
  const reg = mode === 'register';
  view.innerHTML = `<section class="auth">
    <div class="wordmark">SwipeUp</div>
    <p class="tagline">${reg ? 'Kaydır, eşleş, reels izle ve canlı yayında buluş.' : 'Tekrar hoş geldin.'}</p>
    <form novalidate>
      ${reg ? '<input class="field" name="name" placeholder="Ad Soyad" autocomplete="name" maxlength="40">' : ''}
      <input class="field" name="username" placeholder="Kullanıcı adı" autocomplete="username" autocapitalize="none" spellcheck="false" required>
      <input class="field" name="password" type="password" placeholder="Şifre" autocomplete="${reg ? 'new-password' : 'current-password'}" required>
      <button class="btn primary block" style="margin-top:8px">${reg ? 'Kaydol' : 'Giriş yap'}</button>
      <div class="err" role="alert"></div>
    </form>
    <div class="switch">${reg ? 'Hesabın var mı? <a class="link" href="#/login">Giriş yap</a>' : 'Hesabın yok mu? <a class="link" href="#/register">Kaydol</a>'}</div>
    <div class="promo">
      <div>${icon('flame')}Kaydır ve eşleş</div>
      <div>${icon('reels')}Reels izle</div>
      <div>${icon('live')}Canlı yayın aç</div>
      <div>${icon('send')}Anında mesajlaş</div>
    </div>
  </section>`;
  const f = view.querySelector('form');
  const err = view.querySelector('.err');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button');
    btn.disabled = true; err.textContent = '';
    try {
      const body = { username: f.username.value, password: f.password.value, ...(reg ? { name: f.name.value } : {}) };
      const r = await api(reg ? '/auth/register' : '/auth/login', { body });
      setSession(r.token, r.user);
      location.hash = reg ? '#/edit' : '#/';
      location.reload();
    } catch (er) {
      err.textContent = er.message;
      btn.disabled = false;
    }
  };
  f.username.addEventListener('input', () => { f.username.value = f.username.value.toLowerCase().replace(/\s/g, ''); });
  return null;
}
export { esc };

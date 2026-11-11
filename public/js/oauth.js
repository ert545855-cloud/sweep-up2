// Google / Apple ile giriş düğmeleri. Sağlayıcının kendi betiği yalnızca gerektiğinde yüklenir (güvenlik kuralında izinli adresler).
import { state } from './core.js';

const loaded = {};
function loadScript(src) {
  loaded[src] ||= new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = src; s.async = true;
    s.onload = ok; s.onerror = () => { delete loaded[src]; no(new Error('Giriş penceresi yüklenemedi. İnternet bağlantını kontrol et.')); };
    document.head.append(s);
  });
  return loaded[src];
}
export const oauthCfg = () => state.config?.oauth || {};

// Google'ın kendi düğmesini kutuya çizer; seçim yapılınca kimlik belgesi (credential) döner
export async function googleButton(box, onCred, text = 'continue_with') {
  const id = oauthCfg().google; if (!id || !box) return false;
  await loadScript('https://accounts.google.com/gsi/client');
  const g = window.google?.accounts?.id; if (!g) throw new Error('Google ile giriş şu an açılamadı.');
  g.initialize({ client_id: id, callback: (r) => r?.credential && onCred(r.credential), ux_mode: 'popup', auto_select: false, itp_support: true, cancel_on_tap_outside: true });
  const dark = document.documentElement.dataset.theme === 'dark' || matchMedia('(prefers-color-scheme: dark)').matches;
  g.renderButton(box, { theme: dark ? 'filled_black' : 'outline', size: 'large', text, shape: 'pill', locale: 'tr', logo_alignment: 'center', width: Math.min(400, Math.max(240, box.clientWidth || 320)) });
  return true;
}

export async function appleCredential() {
  const a = oauthCfg().apple; if (!a) throw new Error('Apple ile giriş açık değil.');
  await loadScript('https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/tr_TR/appleid.auth.js');
  window.AppleID.auth.init({ clientId: a.clientId, scope: 'name email', redirectURI: a.redirectURI, usePopup: true });
  const r = await window.AppleID.auth.signIn();
  return r?.authorization?.id_token || null;
}

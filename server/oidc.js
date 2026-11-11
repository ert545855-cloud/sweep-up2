// Google ve Apple ile giriş: tarayıcının aldığı kimlik belgesini (ID token) sağlayıcının açık anahtarlarıyla doğrular.
// GOOGLE_CLIENT_ID: Google Cloud → API'ler ve Hizmetler → Kimlik bilgileri → OAuth istemci kimliği (Web uygulaması)
// APPLE_CLIENT_ID: Apple Developer → Identifiers → Services ID (ör. com.swipeup.web), APPLE_REDIRECT_URI: aynı Services ID'de tanımlı dönüş adresi
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
const P = {
  google: { jwks: () => process.env.GOOGLE_JWKS_URL || 'https://www.googleapis.com/oauth2/v3/certs', iss: ['accounts.google.com', 'https://accounts.google.com'], aud: () => list(process.env.GOOGLE_CLIENT_ID) },
  apple: { jwks: () => process.env.APPLE_JWKS_URL || 'https://appleid.apple.com/auth/keys', iss: ['https://appleid.apple.com'], aud: () => list(process.env.APPLE_CLIENT_ID) },
};

const cache = {}; // sağlayıcı → { keys: Map(kid → KeyObject), at }
async function keys(name, force = false) {
  const c = cache[name];
  if (c && !force && Date.now() - c.at < 6 * 3600000) return c.keys;
  if (c && force && Date.now() - c.at < 60000) return c.keys; // anahtar yoksa dakikada en çok bir kez yeniden çek
  const r = await fetch(P[name].jwks(), { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`${name} anahtarları alınamadı (${r.status})`);
  const j = await r.json();
  const m = new Map();
  for (const k of j.keys || []) { try { if (k.kid && k.kty === 'RSA') m.set(k.kid, crypto.createPublicKey({ key: k, format: 'jwk' })); } catch { /* geçersiz anahtar */ } }
  cache[name] = { keys: m, at: Date.now() };
  return m;
}

const enabled = (name) => P[name].aud().length > 0;
// Uygulamaya ve panele gönderilen ayar (gizli bilgi içermez)
function publicConfig() {
  return {
    google: enabled('google') ? P.google.aud()[0] : null,
    apple: enabled('apple') && process.env.APPLE_REDIRECT_URI ? { clientId: P.apple.aud()[0], redirectURI: process.env.APPLE_REDIRECT_URI } : null,
  };
}

// Dönen: { provider, sub, email (doğrulanmışsa), name }
async function verify(name, token) {
  if (!P[name]) throw new Error('Bilinmeyen giriş yöntemi.');
  if (!enabled(name)) throw new Error(`${name === 'google' ? 'Google' : 'Apple'} ile giriş henüz açılmadı.`);
  const dec = jwt.decode(String(token || ''), { complete: true });
  const kid = dec?.header?.kid;
  if (!kid || dec.header.alg !== 'RS256') throw new Error('Giriş bilgisi geçersiz.');
  let key = (await keys(name)).get(kid);
  if (!key) key = (await keys(name, true)).get(kid);
  if (!key) throw new Error('Giriş bilgisi doğrulanamadı.');
  let p;
  try { p = jwt.verify(token, key, { algorithms: ['RS256'], audience: P[name].aud(), issuer: P[name].iss, clockTolerance: 60 }); } catch { throw new Error('Giriş bilgisi geçersiz ya da süresi dolmuş. Tekrar dene.'); }
  if (!p.sub) throw new Error('Giriş bilgisi geçersiz.');
  const verified = p.email_verified === true || p.email_verified === 'true';
  return { provider: name, sub: String(p.sub), email: p.email && verified ? String(p.email).toLowerCase() : null, name: p.name ? String(p.name).slice(0, 40) : null };
}

module.exports = { verify, enabled, publicConfig };

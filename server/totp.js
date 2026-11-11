// Doğrulama uygulaması kodu (TOTP, RFC 6238): Google Authenticator, Microsoft Authenticator, 1Password vb. ile çalışır.
// Ek paket gerekmez; 30 saniyelik 6 haneli kod, saat kaymasına karşı ±1 adım tolerans.
const crypto = require('crypto');

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(buf) {
  let bits = 0; let val = 0; let out = '';
  for (const b of buf) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
function unbase32(s) {
  const clean = String(s || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0; let val = 0; const out = [];
  for (const c of clean) { val = (val << 5) | B32.indexOf(c); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
const newSecret = () => base32(crypto.randomBytes(20));

function hotp(secret, counter) {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', unbase32(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1e6).padStart(6, '0');
}
const stepOf = (t = Date.now()) => Math.floor(t / 30000);
const codeAt = (secret, t = Date.now()) => hotp(secret, stepOf(t));

// Geçerliyse kodun adımını döner (aynı kodun ikinci kez kullanılmaması için saklanır), değilse null
function verify(secret, code, lastStep = -1, t = Date.now()) {
  const c = String(code || '').replace(/\D/g, '');
  if (c.length !== 6 || !secret) return null;
  const now = stepOf(t);
  for (const s of [now, now - 1, now + 1]) {
    if (s <= lastStep) continue;
    const want = Buffer.from(hotp(secret, s)); const got = Buffer.from(c);
    if (crypto.timingSafeEqual(want, got)) return s;
  }
  return null;
}

const uri = (secret, account, issuer = 'SwipeUp Yönetim') => `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

// Kurtarma kodları: telefon kaybolursa doğrulama kodu yerine birer kez kullanılır (yalnız özetleri saklanır)
const RC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function recoveryCodes(n = 8) {
  // 12 karakter (32'lik alfabe, ~60 bit), XXXX-XXXX-XXXX biçiminde
  return Array.from({ length: n }, () => { const b = crypto.randomBytes(12); let s = ''; for (const x of b) s += RC[x % RC.length]; return s.match(/.{4}/g).join('-'); });
}
const normRc = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const hashRc = (salt, c) => crypto.createHash('sha256').update(`${salt}|${normRc(c)}`).digest('hex');

module.exports = { newSecret, verify, uri, codeAt, recoveryCodes, hashRc, normRc, base32, unbase32 };

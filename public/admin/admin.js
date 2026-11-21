// SwipeUp Yönetim paneli
import { icon } from '/js/icons.js';
import { chart, daySeries } from './chart.js';

// Panel gizli bir adreste açılır (ör. /y-xxxx/); istekler aynı adresin altındaki /api'ye gider
export const BASE = location.pathname.split('/').slice(0, 2).join('/');
// Oturum yalnızca sunucunun koyduğu HttpOnly çerezde; bu sayfa giriş yapılmadan hiç verilmez (anahtar kodda tutulmaz)
const S = { token: true, me: null, counts: {} };
try { localStorage.removeItem('su_admin'); } catch {}
const PANEL_H = { 'X-Panel': '1' };
const can = (p) => S.me?.role === 'owner' || (S.me?.perms || []).includes(p);
const SEC_PERM = { growth: 'growth', users: 'users', support: 'support', reports: 'reports', appeals: 'appeals', flags: 'flags', verify: 'verify', orders: 'orders', payouts: 'payouts', market: 'market', ledger: 'erp', erp: 'erp', promos: 'promos', cartpromos: 'settings', quests: 'quests', songs: 'songs', contests: 'contests', fal: 'fal', content: 'content', media: 'content', announce: 'announce', notes: 'notes', audit: 'audit', errors: 'audit', database: 'database', maintenance: 'maintenance', settings: 'settings', tags: 'tags', engage: 'engage', karaoke: 'engage', photomod: 'reports', hukuk: 'hukuk', aktivite: 'users', sunucu: 'owner' };
const canSec = (k) => !SEC_PERM[k] || can(SEC_PERM[k]);
const root = document.getElementById('root');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tl = (n) => `${Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
const dt = (t) => (t ? new Date(t).toLocaleString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const d = (t) => (t ? new Date(t).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const ymd = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
const today = () => ymd(new Date());
const el = (h) => { const t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstElementChild; };

function toast(t) {
  const x = el(`<div class="toast">${esc(t)}</div>`);
  document.getElementById('toasts').append(x);
  setTimeout(() => x.remove(), 3500);
}
async function api(path, opts = {}) {
  const r = await fetch(BASE + '/api' + path, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: { ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...PANEL_H },
    credentials: 'same-origin',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && S.token) { S.token = null; panelLogout(); throw new Error(data.error); }
  if (!r.ok) throw new Error(data.error || 'İşlem başarısız.');
  return data;
}

const STATUS = { active: ['ok', 'Aktif'], suspended: ['warn', 'Askıda'], banned: ['bad', 'Yasaklı'] };
const statusChip = (s) => `<span class="chip ${STATUS[s]?.[0] || ''}">${STATUS[s]?.[1] || s}</span>`;
const vt = (u) => (u?.verified ? `<span class="vt" title="Doğrulanmış">${icon('verified')}</span>` : '') + (u?.plus ? '<span class="chip gold">+</span>' : '');
const userCell = (u) => (u ? `<div class="row"><img class="av" src="${esc(u.avatar)}" alt="" loading="lazy"><div class="grow"><div class="ell"><b>${esc(u.name)}</b>${vt(u)}${u.role === 'falci' ? ' <span class="chip info">Falcı</span>' : ''}${u.coinDebt ? ` <span class="chip bad" title="Mağaza iadesi: harcanmış jeton borcu">${u.coinDebt} jeton borç</span>` : u.refunds ? ' <span class="chip warn" title="Satın alma iadesi var">İade</span>' : ''}</div><div class="muted ell">@${esc(u.username)}</div></div></div>` : '<span class="muted">Silinmiş hesap</span>');
const REASON = { tehdit: 'Tehdit / şiddet', nefret: 'Nefret söylemi', spam: 'Spam / sahte hesap', taciz: 'Taciz veya zorbalık', uygunsuz: 'Uygunsuz içerik', dolandirici: 'Dolandırıcılık', yas: '18 yaş altı olabilir', diger: 'Diğer' };
const FAL = { kahve: '☕️ Kahve falı', tarot: '🔮 Tarot', burc: '✨ Burç', uyum: '💞 Aşk uyumu', ruya: '🌙 Rüya tabiri' };

const SECTIONS = [
  ['overview', 'Genel bakış', 'home'],
  ['growth', 'Büyüme', 'gauge'],
  ['users', 'Kullanıcılar', 'users'],
  ['aktivite', 'Hareketler', 'eye'],
  ['support', 'Destek', 'question', 'supportOpen'],
  ['tags', 'Etiketler', 'star'],
  ['reports', 'Şikayetler', 'flag', 'reportsOpen'],
  ['photomod', 'Fotoğraf denetimi', 'image', 'photosOpen'],
  ['appeals', 'İtirazlar', 'reply', 'appealsOpen'],
  ['hukuk', 'Hukuk ve uyum', 'shield', 'legalOpen'],
  ['flags', 'Moderasyon', 'shield', 'flagsOpen'],
  ['verify', 'Doğrulama', 'verified', 'verifyOpen'],
  ['orders', 'Siparişler', 'coin', 'ordersPaid'],
  ['payouts', 'Kazançlar', 'gift', 'payoutsOpen'],
  ['market', 'Store', 'bag', 'marketOpen'],
  ['erp', 'Şirket (ERP)', 'wallet'],
  ['promos', 'Reklamlar', 'bolt'],
  ['cartpromos', 'Sepet indirimleri', 'gift'],
  ['quests', 'Görevler ve çark', 'check'],
  ['engage', 'Etkileşim', 'flame'],
  ['fal', 'Fal', 'star', 'falPending'],
  ['songs', 'Şarkı yarışması', 'music', 'songsPending'],
  ['karaoke', 'Karaoke şarkıları', 'mic'],
  ['contests', 'Yarışmalar', 'trophy'],
  ['content', 'İçerik', 'grid'],
  ['media', 'Medya', 'image'],
  ['announce', 'Bildirim gönder', 'bell'],
  ['notes', 'Notlar', 'edit'],
  ['errors', 'Hatalar', 'bolt', 'errorsOpen'],
  ['audit', 'İşlem kaydı', 'eye'],
  ['sunucu', 'Sunucu ve alan adı', 'globe'],
  ['database', 'Veritabanı', 'grid'],
  ['maintenance', 'Bakım modu', 'timer'],
  ['settings', 'Ayarlar', 'settings'],
  ['admins', 'Yöneticiler', 'key'],
];

// ================= Giriş =================
// 1) şifre ya da Google / Apple  2) doğrulama uygulamasındaki 6 haneli kod. İlk girişte doğrulama uygulaması kurulur.
let CFG = null;
const getCfg = async () => (CFG ||= await fetch('/api/config').then((r) => r.json()).catch(() => ({})));
const loaded = {};
function loadScript(src) {
  loaded[src] ||= new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = src; sc.async = true; sc.onload = ok; sc.onerror = () => { delete loaded[src]; no(new Error('Giriş penceresi yüklenemedi. İnternet bağlantını kontrol et.')); }; document.head.append(sc); });
  return loaded[src];
}
// Google düğmesi (Google'ın kendi düğmesi, açılır pencereyle)
export async function googleButton(box, onCred, text = 'signin_with') {
  const id = (await getCfg()).oauth?.google; if (!id || !box) return false;
  await loadScript('https://accounts.google.com/gsi/client');
  window.google.accounts.id.initialize({ client_id: id, callback: (r) => onCred(r.credential), ux_mode: 'popup', auto_select: false, itp_support: true });
  window.google.accounts.id.renderButton(box, { theme: 'outline', size: 'large', text, shape: 'pill', locale: 'tr', width: Math.min(320, box.clientWidth || 300) });
  return true;
}
export async function appleCredential() {
  const a = (await getCfg()).oauth?.apple; if (!a) throw new Error('Apple ile giriş açık değil.');
  await loadScript('https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/tr_TR/appleid.auth.js');
  window.AppleID.auth.init({ clientId: a.clientId, scope: 'name email', redirectURI: a.redirectURI, usePopup: true });
  const r = await window.AppleID.auth.signIn();
  return r?.authorization?.id_token;
}
const brandHtml = '<div class="brand"><img class="mark" src="/icons/mark.png" alt="">swipeup <small>yönetim</small></div>';
function finishLogin(r) {
  S.token = true; S.me = r.admin;
  if (r.recovery) return showRecovery(r.recovery, () => render());
  if (r.recoveryLeft != null && r.recoveryLeft <= 2) toast(`Kurtarma kodlarından ${r.recoveryLeft} tane kaldı. Yöneticiler → Hesabım'dan yenile.`);
  render();
}
function afterFirst(r) {
  if (r.token) return finishLogin(r);
  if (r.need === 'totp') return twoFactor(r);
  if (r.need === 'setup') return setup2fa(r);
}
async function login(msg = '') {
  const cfg = await getCfg();
  root.innerHTML = `<div class="login"><form class="lg-f" autocomplete="on">${brandHtml}
    <p>Yönetici hesabınla giriş yap.</p>
    <input class="field" name="u" placeholder="Kullanıcı adı" autocomplete="username" autocapitalize="none" required>
    <input class="field" name="p" type="password" placeholder="Şifre" autocomplete="current-password" required>
    <button class="btn primary" style="height:42px">Devam</button><div class="err">${esc(msg)}</div>
    ${cfg.oauth?.google || cfg.oauth?.apple ? '<div class="lg-or"><span>ya da</span></div>' : ''}
    ${cfg.oauth?.google ? '<div class="lg-g"></div>' : ''}${cfg.oauth?.apple ? `<button type="button" class="btn lg-a">${''} Apple ile giriş yap</button>` : ''}
    <button type="button" class="link lg-fp">Şifremi unuttum</button>
    <p class="lg-note">Girişten sonra telefonundaki doğrulama uygulamasının kodu istenir.</p></form></div>`;
  const f = root.querySelector('form'); const err = f.querySelector('.err');
  f.onsubmit = async (e) => {
    e.preventDefault(); err.textContent = '';
    try { afterFirst(await api('/login', { body: { username: f.u.value, password: f.p.value } })); } catch (er) { err.textContent = er.message; }
  };
  const oauth = async (provider, credential) => { err.textContent = ''; try { afterFirst(await api('/login/oauth', { body: { provider, credential } })); } catch (er) { err.textContent = er.message; } };
  googleButton(f.querySelector('.lg-g'), (c) => oauth('google', c)).catch((er) => { err.textContent = er.message; });
  f.querySelector('.lg-a')?.addEventListener('click', async () => { try { const c = await appleCredential(); if (c) oauth('apple', c); } catch (er) { if (er?.error !== 'popup_closed_by_user') err.textContent = er.message || 'Apple ile giriş tamamlanmadı.'; } });
  f.querySelector('.lg-fp').onclick = forgot;
}
function twoFactor(r) {
  root.innerHTML = `<div class="login"><form class="lg-f">${brandHtml}
    <p><b>${esc(r.name || '')}</b>, doğrulama uygulamandaki 6 haneli kodu yaz.</p>
    <input class="field lg-code" name="c" inputmode="numeric" autocomplete="one-time-code" maxlength="14" placeholder="123 456" required>
    <button class="btn primary" style="height:42px">Giriş yap</button><div class="err"></div>
    <button type="button" class="link lg-rc">Telefonum yanımda değil, kurtarma kodu kullan</button>
    <button type="button" class="link lg-back">Geri</button></form></div>`;
  const f = root.querySelector('form'); const err = f.querySelector('.err');
  f.c.focus();
  f.querySelector('.lg-rc').onclick = () => { f.c.placeholder = 'XXXX-XXXX-XXXX'; f.c.removeAttribute('inputmode'); f.c.value = ''; f.c.focus(); f.querySelector('p').textContent = 'Kurtarma kodlarından birini yaz. Her kod bir kez kullanılır.'; };
  f.querySelector('.lg-back').onclick = () => login();
  f.onsubmit = async (e) => {
    e.preventDefault(); err.textContent = '';
    try { finishLogin(await api('/login/2fa', { body: { ticket: r.ticket, code: f.c.value } })); } catch (er) { err.textContent = er.message; if (/Baştan/.test(er.message)) setTimeout(() => login(er.message), 1200); }
  };
}
function setup2fa(r) {
  root.innerHTML = `<div class="login"><form class="lg-f lg-setup">${brandHtml}
    <h3>İki adımlı doğrulamayı kur</h3>
    <ol class="lg-steps"><li>Telefonuna <b>Google Authenticator</b> ya da <b>Microsoft Authenticator</b> uygulamasını kur.</li>
    <li>Uygulamada <b>+</b> → <b>QR kodu tara</b> ile aşağıdaki kodu okut.</li><li>Uygulamanın gösterdiği 6 haneli kodu yaz.</li></ol>
    <div class="lg-qr">${r.qr}</div>
    <details class="lg-man"><summary>QR okutamıyorum</summary><p>Uygulamada “Kurulum anahtarı gir”i seç ve şunu yaz:</p><code class="lg-key">${esc(r.secret)}</code></details>
    <input class="field lg-code" name="c" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="123 456" required>
    <button class="btn primary" style="height:42px">Doğrula ve aç</button><div class="err"></div>
    <button type="button" class="link lg-back">Vazgeç</button></form></div>`;
  const f = root.querySelector('form'); const err = f.querySelector('.err');
  f.querySelector('.lg-back').onclick = () => login();
  f.onsubmit = async (e) => {
    e.preventDefault(); err.textContent = '';
    try { finishLogin(await api('/login/setup', { body: { ticket: r.ticket, code: f.c.value } })); } catch (er) { err.textContent = er.message; if (/Baştan/.test(er.message)) setTimeout(() => login(er.message), 1200); }
  };
}
function showRecovery(codes, done) {
  root.innerHTML = `<div class="login"><div class="lg-f lg-rcs">${brandHtml}
    <h3>Kurtarma kodların</h3>
    <p>Telefonunu kaybedersen ya da şifreni unutursan bu kodlarla girersin. Her kod bir kez çalışır. <b>Şimdi güvenli bir yere kaydet</b>; bir daha gösterilmez.</p>
    <div class="lg-codes">${codes.map((c) => `<code>${esc(c)}</code>`).join('')}</div>
    <div class="row" style="gap:8px;justify-content:center"><button type="button" class="btn sm cp">Kopyala</button><button type="button" class="btn sm dl">İndir (.txt)</button></div>
    <label class="lg-ok"><input type="checkbox" class="ok"> Kodları kaydettim</label>
    <button type="button" class="btn primary go" style="height:42px" disabled>Panele geç</button></div></div>`;
  const txt = `SwipeUp yönetim paneli kurtarma kodları (${new Date().toLocaleString('tr-TR')})\n\n${codes.join('\n')}\n`;
  root.querySelector('.cp').onclick = async () => { try { await navigator.clipboard.writeText(txt); toast('Kopyalandı.'); } catch { toast('Kopyalanamadı; kodları elle yaz.'); } };
  root.querySelector('.dl').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' })); a.download = 'swipeup-kurtarma-kodlari.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  root.querySelector('.ok').onchange = (e) => { root.querySelector('.go').disabled = !e.target.checked; };
  root.querySelector('.go').onclick = done;
}
function forgot() {
  root.innerHTML = `<div class="login"><form class="lg-f">${brandHtml}
    <h3>Şifremi unuttum</h3>
    <p>Yeni şifre için doğrulama uygulamandaki kod <b>ve</b> kurtarma kodlarından biri gerekir.</p>
    <input class="field" name="u" placeholder="Kullanıcı adı" autocomplete="username" autocapitalize="none" required>
    <input class="field" name="c" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="Uygulamadaki 6 haneli kod" required>
    <input class="field" name="r" placeholder="Kurtarma kodu (XXXX-XXXX-XXXX)" autocapitalize="characters" required>
    <input class="field" name="p" type="password" autocomplete="new-password" placeholder="Yeni şifre (en az 10 karakter)" required>
    <input class="field" name="p2" type="password" autocomplete="new-password" placeholder="Yeni şifre (tekrar)" required>
    <button class="btn primary" style="height:42px">Şifreyi yenile</button><div class="err"></div>
    <p class="lg-note">Telefonunu da kaybettiysen sahip yöneticiden doğrulamayı sıfırlamasını iste.</p>
    <button type="button" class="link lg-back">Girişe dön</button></form></div>`;
  const f = root.querySelector('form'); const err = f.querySelector('.err');
  f.querySelector('.lg-back').onclick = () => login();
  f.onsubmit = async (e) => {
    e.preventDefault(); err.textContent = '';
    if (f.p.value !== f.p2.value) { err.textContent = 'Yeni şifreler aynı değil.'; return; }
    try { const r = await api('/forgot', { body: { username: f.u.value, code: f.c.value, recovery: f.r.value, password: f.p.value } }); login(`Şifren yenilendi. Yeni şifrenle giriş yap.${r.recoveryLeft <= 2 ? ` (Kurtarma kodlarından ${r.recoveryLeft} tane kaldı.)` : ''}`); } catch (er) { err.textContent = er.message; }
  };
}

// ================= Kabuk =================
// Çıkış / oturum düştü: panel çerezini sil ve giriş sayfasına dön (panel dosyaları çerezsiz verilmez)
function panelLogout() {
  fetch(BASE + '/api/logout', { method: 'POST', credentials: 'same-origin', headers: PANEL_H }).catch(() => {}).finally(() => location.replace(BASE + '/'));
}
{ const left = sessionStorage.getItem('adm_rc_left'); if (left) { sessionStorage.removeItem('adm_rc_left'); setTimeout(() => toast(`Kurtarma kodlarından ${left} tane kaldı. Yöneticiler → Hesabım'dan yenile.`), 800); } }
async function render() {
  if (!S.token) return login();
  if (!S.me) { try { S.me = await api('/me'); } catch { return; } }
  const cur = (location.hash.slice(2) || 'overview').split(/[/?]/)[0];
  const nav = (cls) => SECTIONS.filter(([k]) => canSec(k)).map(([k, l, ic, cnt]) => `<a class="nav ${cur === k ? 'on' : ''}" href="#/${k}">${icon(ic)}<span>${l}</span>${cnt && S.counts[cnt] ? `<span class="n">${S.counts[cnt]}</span>` : ''}</a>`).join('');
  root.innerHTML = `<div class="shell">
    <aside class="side"><div class="brand"><img class="mark" src="/icons/mark.png" alt="">swipeup <small>yönetim</small></div>${nav()}
      <div class="who"><b>${esc(S.me.name)}</b><span class="muted">@${esc(S.me.username)} · ${S.me.role === 'owner' ? 'Sahip' : 'Moderatör'}</span>
      <div class="row"><a class="btn sm" href="/" target="_blank" rel="noopener">Uygulamayı aç</a><button class="btn sm lo">Çıkış</button></div></div></aside>
    <div><nav class="topnav">${nav()}</nav><div class="mbn"></div><main class="main"></main></div></div>`;
  root.querySelector('.lo').onclick = () => { S.token = null; S.me = null; panelLogout(); };
  const main = root.querySelector('.main');
  main.innerHTML = '<div class="spin"></div>';
  if (!S.counts.users) refreshCounts(); else paintMaintBanner();
  if (!canSec(cur)) { main.innerHTML = `${head('Yetki yok')}<div class="empty">Bu bölüm için yetkin yok. Sahip yöneticiden yetki isteyebilirsin.</div>`; return; }
  try { await (VIEWS[cur] || VIEWS.overview)(main); } catch (e) { main.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
function paintMaintBanner() {
  const b = document.querySelector('.mbn'); if (!b) return;
  b.innerHTML = S.counts.maintenance ? `<a class="maintbar" href="#/maintenance">${icon('timer')}<span><b>Bakım modu açık.</b> Kullanıcılar uygulamaya giremiyor.</span><span class="go">Yönet</span></a>` : '';
}
async function refreshCounts() {
  try {
    const o = await api('/overview');
    const changed = ['songsPending', 'errorsOpen', 'supportOpen', 'reportsOpen', 'photosOpen', 'appealsOpen', 'falPending', 'flagsOpen', 'verifyOpen', 'ordersPaid', 'payoutsOpen', 'marketOpen', 'legalOpen', 'maintenance'].some((k) => S.counts[k] !== o[k]);
    if (S.counts.users && (o.supportOpen || 0) > (S.counts.supportOpen || 0)) { toast('🎧 Yeni destek mesajı var.'); ding(); }
    S.counts = o;
    paintMaintBanner();
    if (changed) document.querySelectorAll('.nav').forEach((a) => {
      const k = SECTIONS.find((s) => a.getAttribute('href') === `#/${s[0]}`)?.[3];
      if (!k) return;
      a.querySelector('.n')?.remove();
      if (o[k]) a.insertAdjacentHTML('beforeend', `<span class="n">${o[k]}</span>`);
    });
  } catch {}
}
const head = (title, sub, actions = '') => `<div class="head"><h1>${title}</h1>${actions}${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
// Çizelge yer tutucusu: HTML'e yazılır, sayfaya eklenince drawCharts() çizer (chart.js)
const CH = new Map(); let chN = 0;
const bars = (series, opts = {}) => { const id = `ch${++chN}`; CH.set(id, { series, opts: typeof opts === 'function' ? {} : opts }); return `<div class="vzh" data-ch="${id}"></div>`; };
function drawCharts(root = document) { root.querySelectorAll('.vzh[data-ch]').forEach((h) => { const c = CH.get(h.dataset.ch); if (!c) return; CH.delete(h.dataset.ch); h.removeAttribute('data-ch'); if (c.multi) chart(h, c.multi); else daySeries(h, c.series, c.opts); }); }
const multiChart = (cfg) => { const id = `ch${++chN}`; CH.set(id, { multi: cfg }); return `<div class="vzh" data-ch="${id}"></div>`; };
new MutationObserver(() => { if (document.querySelector('.vzh[data-ch]')) drawCharts(); }).observe(document.documentElement, { childList: true, subtree: true });

// ================= Bölümler =================
const VIEWS = {};

VIEWS.overview = async (main) => {
  const [o, reps, apps] = await Promise.all([api('/overview'), api('/reports?status=open'), api('/appeals?status=open')]);
  S.counts = o;
  const st = (n, l, alert, href) => `<div class="stat ${alert && n ? 'alert' : ''}"><b>${n}</b><span>${l}</span>${href && n ? `<a href="${href}">Görüntüle</a>` : ''}</div>`;
  main.innerHTML = `${head('Genel bakış', `Veri deposu: ${o.store === 'redis' ? 'Render Key Value' : o.store === 'postgres' ? 'PostgreSQL' : 'Sunucu diski'} · medya ${o.mediaMB} MB`)}
    <div class="stats">
      ${st(o.users, 'Toplam üye')}${st(o.newToday, 'Bugün katılan')}${st(o.new7, 'Son 7 gün katılan')}${st(o.online, 'Şu an çevrimiçi')}${st(o.active24, 'Son 24 saatte aktif')}
      ${st(o.messagesToday, 'Bugün gönderilen mesaj')}${st(o.matches, 'Toplam eşleşme')}${st(o.posts, 'Gönderi ve vitrin videosu')}${st(o.stories, 'Yayında hikaye')}${st(o.banned, 'Askıda / yasaklı', true, '#/users')}
      ${st(o.reportsOpen, 'Açık şikayet', true, '#/reports')}${st(o.appealsOpen, 'Bekleyen itiraz', true, '#/appeals')}${st(o.falPending, 'Bekleyen fal', true, '#/fal')}
      ${st(o.flagsOpen, 'Moderasyon işareti', true, '#/flags')}${st(o.verifyOpen, 'Doğrulama bekleyen', true, '#/verify')}${st(o.ordersPaid, 'Onay bekleyen ödeme', true, '#/orders')}${st(o.legalOpen, 'Hukuk: açık başvuru / iade / bildirim', true, '#/hukuk')}${st(o.payoutsOpen, 'Ödeme talebi', true, '#/payouts')}
      ${st(o.plusUsers, 'SwipeUp+ üye')}${o.plusTrialTotal ? st(`${o.plusTrials} / ${o.plusTrialBought}`, `Denemede / denemeden satın alan (toplam ${o.plusTrialTotal})`) : ''}${st(o.verifiedUsers, 'Mavi tikli üye')}
      <div class="stat"><b class="money in">${tl(o.income)}</b><span>Bu ay gelir</span></div>
      <div class="stat"><b class="money out">${tl(o.expense)}</b><span>Bu ay gider</span></div>
      <div class="stat"><b class="money ${o.income - o.expense >= 0 ? 'in' : 'out'}">${tl(o.income - o.expense)}</b><span>Bu ay net</span><a href="#/erp/gelir">Gelir ve gider</a></div>
    </div>
    <div class="grid g3">
      <div class="panel"><div class="ph"><h3>Yeni üyeler · 14 gün</h3></div><div class="pb">${bars(o.series.users, { name: 'Yeni üye' })}</div></div>
      <div class="panel"><div class="ph"><h3>Mesajlar · 14 gün</h3></div><div class="pb">${bars(o.series.messages, { name: 'Mesaj' })}</div></div>
      <div class="panel"><div class="ph"><h3>Eşleşmeler · 14 gün</h3></div><div class="pb">${bars(o.series.matches, { name: 'Eşleşme' })}</div></div>
    </div>
    <div class="grid g2" style="margin-top:14px">
      <div class="panel"><div class="ph"><h3>Son şikayetler</h3><a class="btn sm" href="#/reports">Tümü</a></div>${reps.length ? reps.slice(0, 5).map((r) => `<div class="case"><div class="who">${userCell(r.toUser)}<span class="chip warn">${esc(REASON[r.reason] || r.reason)}</span></div><div class="muted">${dt(r.at)} · bildiren @${esc(r.fromUser?.username)}</div></div>`).join('') : '<div class="empty">Açık şikayet yok.</div>'}</div>
      <div class="panel"><div class="ph"><h3>Bekleyen itirazlar</h3><a class="btn sm" href="#/appeals">Tümü</a></div>${apps.length ? apps.slice(0, 5).map((a) => `<div class="case"><div class="who">${userCell(a.user)}</div><div class="det">${esc(a.text.slice(0, 200))}</div></div>`).join('') : '<div class="empty">Bekleyen itiraz yok.</div>'}</div>
    </div>`;
};

// ---- Kullanıcılar ----
VIEWS.users = async (main) => {
  let q = ''; let status = 'all';
  main.innerHTML = `${head('Kullanıcılar')}
    <div class="row" style="margin-bottom:12px;flex-wrap:wrap"><input class="field q" placeholder="Ad, kullanıcı adı ya da e-posta ara" style="max-width:340px">
      <div class="tabs" style="margin:0">${[['all', 'Tümü'], ['active', 'Aktif'], ['suspended', 'Askıda'], ['banned', 'Yasaklı']].map(([k, l], i) => `<button data-s="${k}" class="${i ? '' : 'on'}">${l}</button>`).join('')}</div></div>
    <div class="panel"><div class="tw lst"><div class="spin"></div></div></div>`;
  const lst = main.querySelector('.lst');
  const load = async () => {
    const r = await api(`/users?q=${encodeURIComponent(q)}&status=${status}`);
    lst.innerHTML = r.items.length ? `<table class="tbl"><thead><tr><th>Kullanıcı</th><th>E-posta</th><th>Katılım</th><th>Son görülme</th><th class="num">Gönderi</th><th class="num">Eşleşme</th><th class="num">Şikayet</th><th>Durum</th></tr></thead><tbody>
      ${r.items.map((u) => `<tr class="click" data-id="${esc(u.id)}"><td>${userCell(u)}</td><td class="muted">${esc(u.email || '—')}</td><td>${d(u.createdAt)}</td><td>${u.online ? '<span class="chip ok">Çevrimiçi</span>' : dt(u.lastSeen)}</td><td class="num">${u.posts}</td><td class="num">${u.matches}</td><td class="num">${u.reports ? `<b style="color:var(--bad)">${u.reports}</b>` : 0}</td><td>${statusChip(u.status)}</td></tr>`).join('')}
      </tbody></table><div class="muted" style="padding:10px 12px">${r.total} kullanıcı</div>` : '<div class="empty">Kullanıcı bulunamadı.</div>';
  };
  let t; main.querySelector('.q').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { q = e.target.value; load(); }, 250); };
  main.querySelector('.tabs').onclick = (e) => { const b = e.target.closest('[data-s]'); if (!b) return; status = b.dataset.s; main.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b)); load(); };
  lst.onclick = (e) => { const tr = e.target.closest('[data-id]'); if (tr) userDrawer(tr.dataset.id, load); };
  await load();
};

async function userDrawer(id, onChange) {
  const bg = el('<div class="drawer-bg"></div>');
  const dr = el('<aside class="drawer"><div class="spin"></div></aside>');
  const close = () => { bg.remove(); dr.remove(); };
  bg.onclick = close;
  document.body.append(bg, dr);
  const paint = async () => {
    const u = await api(`/users/${id}`);
    dr.innerHTML = `<div class="dh"><img class="av lg" src="${esc(u.avatar)}" alt=""><div class="grow"><h2>${esc(u.name)}</h2><div class="muted">@${esc(u.username)}</div><div class="row" style="margin-top:6px;flex-wrap:wrap">${statusChip(u.status)}${u.verified ? '<span class="chip info">Doğrulandı</span>' : ''}${u.plusUntil && u.plusUntil > Date.now() ? `<span class="chip gold">SwipeUp+ · ${d(u.plusUntil)}</span>` : ''}${u.role === 'falci' ? '<span class="chip info">Falcı</span>' : ''}${u.online ? '<span class="chip ok">Çevrimiçi</span>' : ''}</div></div><button class="btn sm x">${icon('close')}</button></div>
      <div class="db">
        ${u.refundList?.length || u.coinDebt || u.clawbacks?.length ? `<div class="case" style="padding:12px;border-radius:12px;background:color-mix(in srgb,var(--warn, #e0a526) 12%,transparent)"><b>${icon('flag')} Not: satın alma iadesi</b>
          <div style="font-size:13px;margin-top:4px">${[u.refundList?.length ? `${u.refundList.length} satın alması iade edildi` : '', u.coinDebt ? `<b>${u.coinDebt} jeton borcu var</b> (harcanmış jetonların iadesi; borç kapanana kadar jeton harcayamaz)` : '', u.clawbacks?.length ? `${u.clawbacks.length} kez, iade edilen jetonlarla gönderilmiş hediye aldı` : ''].filter(Boolean).join(' · ')}</div>
          ${u.refundList?.length ? `<table class="tbl" style="margin-top:8px"><tbody>${u.refundList.map((o) => `<tr><td>${dt(o.at)}</td><td>${esc(o.title)}<div class="muted" style="font-size:11.5px">${esc(o.code)}</div></td><td class="num">${tl(o.amount)}</td><td>${o.channel === 'apple' ? 'App Store' : o.channel === 'google' ? 'Google Play' : 'Havale/EFT'}${o.test ? ' · <span class="chip">deneme</span>' : ''}</td><td class="muted" style="font-size:12px">${o.taken != null ? `${o.taken} jeton geri alındı${o.debt ? ` · ${o.debt} borç` : ''}` : esc(o.note)}</td></tr>`).join('')}</tbody></table>` : ''}
          ${u.clawbacks?.length ? `<div style="font-size:12.5px;margin-top:8px">${u.clawbacks.map((c) => `@${esc(c.from)}’in iade ettiği jetonlardan ${tl(c.amount)} hediye · ${c.deducted != null ? `${tl(c.deducted)} kazançtan düşüldü` : c.status === 'open' ? 'incelemede (Siparişler → İade incelemeleri)' : 'kapatıldı'}`).join('<br>')}</div>` : ''}</div>` : ''}
        ${u.status !== 'active' ? `<div class="case" style="padding:12px;border-radius:12px;background:color-mix(in srgb,var(--bad) 8%,transparent)"><b>${u.status === 'banned' ? 'Kalıcı yasaklı' : `Askıda · ${dt(u.bannedUntil)} tarihine kadar`}</b>${u.banReason ? `<div>${esc(u.banReason)}</div>` : ''}</div>` : ''}
        <div class="panel"><div class="ph"><h3>İşlemler</h3></div><div class="pb" style="display:grid;gap:10px">
          ${can('users_ban') ? `<div class="row" style="flex-wrap:wrap"><input class="field wt" placeholder="Uyarı metni" style="flex:1;min-width:180px"><button class="btn warn-b">${icon('flag')} Uyar</button></div>
          <div class="row" style="flex-wrap:wrap"><input class="field br" placeholder="Gerekçe (kullanıcı görür)" style="flex:1;min-width:180px">
            <select class="field bd" style="width:auto"><option value="1">1 gün</option><option value="3">3 gün</option><option value="7" selected>7 gün</option><option value="30">30 gün</option><option value="">Kalıcı</option></select>
            <button class="btn solid-danger ban">${icon('block')} Uygula</button></div>` : ''}
          ${can('users_edit') ? `<div class="row" style="flex-wrap:wrap"><input class="field gc" type="number" placeholder="Jeton (+/−)" style="width:130px"><select class="field gd" style="width:auto"><option value="">Üyelik ekleme</option><option value="7">+7 gün SwipeUp+</option><option value="30">+30 gün SwipeUp+</option><option value="90">+90 gün SwipeUp+</option><option value="-1">Üyeliği kaldır</option></select>
            <select class="field gk" style="width:auto" title="Kullanıcıya giden mesaj"><option value="payment">Ödeme karşılığı (hesabına tanımlandı)</option><option value="gift">Hediye</option></select>
            <input class="field ga" type="number" step="0.01" placeholder="Alınan ödeme ₺ (gelire yazılır)" style="width:190px">
            <input class="field gn" placeholder="Not (kullanıcı görür)" style="flex:1;min-width:140px"><button class="btn grant">${icon('check')} Tanımla</button></div>` : ''}
          <div class="row" style="flex-wrap:wrap">
            ${u.verified && can('users_edit') ? `<button class="btn unv">${icon('close')} Mavi tiki kaldır</button>` : ''}
            ${u.status !== 'active' && can('users_ban') ? `<button class="btn ok unban">${icon('check')} Yasağı kaldır</button>` : ''}
            ${can('users_edit') ? `<button class="btn pw">${icon('key')} Geçici şifre ver</button>` : ''}
            ${can('users_edit') ? `<button class="btn ptest">${icon('bell')} Test bildirimi</button>` : ''}
            ${can('users_edit') && u.role !== 'falci' ? `<button class="btn danger del">${icon('trash')} Hesabı sil</button>` : ''}
          </div></div></div>
        ${can('tags') ? '<div class="panel utags-p"><div class="ph"><h3>Özel etiketler</h3><a class="btn sm" href="#/tags">Etiketleri yönet</a></div><div class="pb"><div class="spin"></div></div></div>' : ''}
        <div class="panel"><div class="ph"><h3>Bilgiler</h3></div><div class="pb"><dl class="kv">
          <dt>E-posta</dt><dd>${esc(u.email || '—')}</dd><dt>Katılım</dt><dd>${dt(u.createdAt)}</dd><dt>Son görülme</dt><dd>${dt(u.lastSeen)}</dd>
          <dt>Yaş / şehir</dt><dd>${esc([u.age, u.city].filter(Boolean).join(' · ') || '—')}</dd><dt>Biyografi</dt><dd>${esc(u.bio || '—')}</dd>
          <dt>Takipçi / takip</dt><dd>${u.followers} / ${u.following}</dd><dt>Gönderilen mesaj</dt><dd>${u.messagesSent}</dd><dt>Eşleşme</dt><dd>${u.matches}</dd>
          <dt>Yaptığı şikayet</dt><dd>${u.reportsBy}</dd>
          <dt>Doğum tarihi</dt><dd>${esc(u.birthdate || '—')}</dd><dt>Jeton</dt><dd>${u.coins}</dd><dt>Kazanç (bakiye)</dt><dd>${tl(u.earnings)}</dd></dl></div></div>
        <div class="panel akt-p"><div class="ph"><h3>Hareketler</h3><a class="btn sm" href="#/aktivite?u=${encodeURIComponent(u.username)}">Tam ekran</a></div><div class="pb akt-box"><div class="spin"></div></div></div>
        ${u.recentPosts.length ? `<div class="panel"><div class="ph"><h3>Son gönderiler</h3></div><div class="pb thumbs">${u.recentPosts.map((p) => (p.type === 'reel' ? `<video src="${esc(p.media)}" ${p.poster ? `poster="${esc(p.poster)}"` : ''} muted></video>` : `<img src="${esc(p.media)}" alt="">`)).join('')}</div></div>` : ''}
        <div class="panel"><div class="ph"><h3>Hakkındaki şikayetler · ${u.reportsAbout.length}</h3></div>${u.reportsAbout.length ? u.reportsAbout.map((r) => `<div class="case"><div class="row"><span class="chip warn">${esc(REASON[r.reason] || r.reason)}</span><span class="muted">${dt(r.at)} · @${esc(r.fromUser?.username || '?')}</span><span class="chip">${r.status === 'open' ? 'Açık' : 'Kapandı'}</span></div>${r.details ? `<div class="det">${esc(r.details)}</div>` : ''}</div>`).join('') : '<div class="empty">Şikayet yok.</div>'}</div>
        ${u.appeals.length ? `<div class="panel"><div class="ph"><h3>İtirazları</h3></div>${u.appeals.map((a) => `<div class="case"><div class="row"><span class="chip">${{ open: 'Bekliyor', accepted: 'Kabul', rejected: 'Ret' }[a.status]}</span><span class="muted">${dt(a.at)}</span></div><div class="det">${esc(a.text)}</div></div>`).join('')}</div>` : ''}
        ${u.history.length ? `<div class="panel"><div class="ph"><h3>Yönetici işlemleri</h3></div>${u.history.map((h) => `<div class="case"><div><b>${esc(h.action)}</b> <span class="muted">· ${esc(h.admin)} · ${dt(h.at)}</span></div>${h.detail ? `<div class="muted">${esc(h.detail)}</div>` : ''}</div>`).join('')}</div>` : ''}
      </div>`;
    const act = async (fn, msg) => { try { await fn(); toast(msg); await paint(); onChange?.(); refreshCounts(); } catch (e) { toast(e.message); } };
    dr.querySelector('.x').onclick = close;
    const ab = dr.querySelector('.akt-box'); if (ab) aktList(ab, `/users/${id}/aktivite`, false);
    const tp = dr.querySelector('.utags-p .pb');
    if (tp) api('/tags').then((T) => {
      let sel = new Set(u.tags || []);
      const draw = () => { tp.innerHTML = T.list.length ? `<div class="tagpick">${T.list.map((t) => `<button class="tpk t-${esc(t.color)} ${sel.has(t.id) ? 'on' : ''}" data-t="${esc(t.id)}">${t.em} ${esc(t.name)}</button>`).join('')}</div><button class="btn sm primary svt" style="margin-top:10px">Kaydet</button>` : '<div class="muted">Henüz etiket yok. “Etiketleri yönet”ten oluştur.</div>'; };
      draw();
      tp.onclick = (e) => {
        const b = e.target.closest('[data-t]'); if (b) { const k = b.dataset.t; sel.has(k) ? sel.delete(k) : sel.add(k); draw(); return; }
        if (e.target.closest('.svt')) act(() => api(`/users/${id}/tags`, { body: { tags: [...sel] } }), 'Etiketler kaydedildi.');
      };
    }).catch(() => { tp.innerHTML = ''; });
    dr.querySelector('.warn-b') && (dr.querySelector('.warn-b').onclick = () => act(() => api(`/users/${id}/warn`, { body: { text: dr.querySelector('.wt').value } }), 'Uyarı gönderildi.'));
    if (dr.querySelector('.ban')) dr.querySelector('.ban').onclick = () => {
      const days = dr.querySelector('.bd').value;
      if (!confirm(days ? `${days} gün askıya alınsın mı?` : 'Hesap kalıcı olarak yasaklansın mı?')) return;
      act(() => api(`/users/${id}/ban`, { body: { days: days ? +days : null, reason: dr.querySelector('.br').value } }), days ? 'Askıya alındı.' : 'Yasaklandı.');
    };
    if (dr.querySelector('.grant')) dr.querySelector('.grant').onclick = () => {
      const coins = +dr.querySelector('.gc').value || 0; const plusDays = +dr.querySelector('.gd').value || 0;
      if (!coins && !plusDays) return toast('Jeton ya da üyelik seç.');
      act(() => api(`/users/${id}/grant`, { body: { coins, plusDays, note: dr.querySelector('.gn').value, kind: dr.querySelector('.gk').value, amount: +dr.querySelector('.ga').value || 0 } }), 'Tanımlandı.');
    };
    dr.querySelector('.unv')?.addEventListener('click', () => { if (confirm('Mavi tik kaldırılsın mı?')) act(() => api(`/users/${id}/unverify`, { body: {} }), 'Mavi tik kaldırıldı.'); });
    dr.querySelector('.unban')?.addEventListener('click', () => act(() => api(`/users/${id}/unban`, { body: {} }), 'Yasak kaldırıldı.'));
    dr.querySelector('.ptest')?.addEventListener('click', async () => {
      try {
        const r = await api(`/users/${id}/push-test`, { body: {} });
        if (!r.results.length) return alert('Bu kullanıcının kayıtlı bildirim cihazı yok. Uygulamada bildirimleri açması gerekiyor.');
        alert(r.results.map((x) => `${x.device}: ${x.ok ? 'gönderildi ✓' : `HATA ${x.status || ''} ${x.error || ''}`}`).join('\n'));
      } catch (e) { toast(e.message); }
    });
    if (dr.querySelector('.pw')) dr.querySelector('.pw').onclick = async () => {
      if (!confirm('Kullanıcının şifresi sıfırlanıp geçici bir şifre üretilsin mi?')) return;
      try { const r = await api(`/users/${id}/password`, { body: {} }); prompt('Geçici şifre (kullanıcıya ilet):', r.password); } catch (e) { toast(e.message); }
    };
    dr.querySelector('.del')?.addEventListener('click', () => {
      if (!confirm(`@${u.username} ve tüm içerikleri kalıcı olarak silinsin mi? Bu geri alınamaz.`)) return;
      act(async () => { await api(`/users/${id}`, { method: 'DELETE' }); close(); }, 'Hesap silindi.');
    });
  };
  paint().catch((e) => { dr.innerHTML = `<div class="empty">${esc(e.message)}</div>`; });
}

// ---- Şikayetler ----
VIEWS.reports = async (main) => {
  let status = 'open';
  main.innerHTML = `${head('Şikayetler', 'Kullanıcıların bildirdiği hesaplar ve içerikler.')}
    <div class="tabs">${[['open', 'Açık'], ['resolved', 'Çözüldü'], ['dismissed', 'Yoksayıldı'], ['all', 'Tümü']].map(([k, l], i) => `<button data-s="${k}" class="${i ? '' : 'on'}">${l}</button>`).join('')}</div>
    <div class="panel lst"><div class="spin"></div></div>`;
  const lst = main.querySelector('.lst');
  const media = (c) => (c?.media ? (c.type === 'reel' || c.mediaType === 'video' ? `<video src="${esc(c.media)}" ${c.poster ? `poster="${esc(c.poster)}"` : ''} muted controls></video>` : `<img src="${esc(c.media)}" alt="">`) : '');
  const load = async () => {
    const list = await api(`/reports?status=${status}`);
    lst.innerHTML = list.length ? list.map((r) => `<div class="case" data-id="${esc(r.id)}">
      <div class="who">${userCell(r.fromUser)}<span class="arrow">→</span>${userCell(r.toUser)}${r.toUser ? statusChip(r.toUser.status) : ''}</div>
      <div class="row" style="flex-wrap:wrap"><span class="chip warn">${esc(REASON[r.reason] || r.reason)}</span><span class="muted">${dt(r.at)}</span>${r.sameTarget > 1 ? `<span class="chip bad">Bu kişi hakkında ${r.sameTarget} şikayet</span>` : ''}${r.status !== 'open' ? `<span class="chip">${esc(r.resolution || r.status)} · ${esc(r.resolvedBy || '')}</span>` : ''}</div>
      ${r.details ? `<div class="det">${esc(r.details)}</div>` : ''}
      ${r.content ? `<div><div class="muted" style="font-size:12px;margin-bottom:4px">Bildirilen içerik (${{ post: 'gönderi', message: 'özel mesaj', genel: 'genel sohbet mesajı', comment: 'yorum', story: 'hikaye', gone: 'silinmiş' }[r.content.kind] || r.content.kind}${r.snapshot?.chat ? ` · ${esc(r.snapshot.chat)}` : ''})</div>
        ${r.content.text || r.content.caption ? `<div class="det">${esc(r.content.text || r.content.caption)}</div>` : ''}
        ${r.snapshot && r.snapshot.text && r.snapshot.text !== r.content.text ? `<div class="muted" style="font-size:12px;margin:6px 0 4px">Bildirildiği andaki hali (${dt(r.snapshot.at)})</div><div class="det">${esc(r.snapshot.text)}</div>` : ''}
        <div class="media">${media(r.content)}</div></div>` : ''}
      ${r.status === 'open' ? `<div class="acts"><input class="field nt" placeholder="Not / uyarı metni (isteğe bağlı)">
        <button class="btn sm" data-a="dismiss">Yoksay</button><button class="btn sm" data-a="warn">${icon('flag')} Uyar</button>
        ${r.content && r.content.kind !== 'gone' ? `<button class="btn sm danger" data-a="delete">${icon('trash')} İçeriği sil</button>` : ''}
        <button class="btn sm danger" data-a="suspend">7 gün askıya al</button><button class="btn sm solid-danger" data-a="ban">Yasakla</button>
        ${r.toUser ? `<button class="btn sm" data-u="${esc(r.toUser.id)}">Profili incele</button>` : ''}</div>` : ''}
    </div>`).join('') : '<div class="empty">Bu listede şikayet yok.</div>';
  };
  main.querySelector('.tabs').onclick = (e) => { const b = e.target.closest('[data-s]'); if (!b) return; status = b.dataset.s; main.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b)); load(); };
  lst.onclick = async (e) => {
    const u = e.target.closest('[data-u]'); if (u) return userDrawer(u.dataset.u, load);
    const b = e.target.closest('[data-a]'); if (!b) return;
    const card = b.closest('.case');
    if (['ban', 'suspend', 'delete'].includes(b.dataset.a) && !confirm('Bu işlem uygulansın mı?')) return;
    try { await api(`/reports/${card.dataset.id}`, { body: { action: b.dataset.a, note: card.querySelector('.nt').value, days: 7 } }); toast('Şikayet kapatıldı.'); load(); refreshCounts(); } catch (er) { toast(er.message); }
  };
  await load();
};

// ---- İtirazlar ----
VIEWS.appeals = async (main) => {
  let status = 'open';
  main.innerHTML = `${head('İtirazlar', 'Askıya alınan ya da yasaklanan kullanıcıların itirazları. Kabul edilirse hesap hemen açılır.')}
    <div class="tabs">${[['open', 'Bekleyen'], ['accepted', 'Kabul edilen'], ['rejected', 'Reddedilen'], ['all', 'Tümü']].map(([k, l], i) => `<button data-s="${k}" class="${i ? '' : 'on'}">${l}</button>`).join('')}</div>
    <div class="panel lst"><div class="spin"></div></div>`;
  const lst = main.querySelector('.lst');
  const load = async () => {
    const list = await api(`/appeals?status=${status}`);
    lst.innerHTML = list.length ? list.map((a) => `<div class="case" data-id="${esc(a.id)}">
      <div class="who">${userCell(a.user)}${a.user ? statusChip(a.user.status) : ''}<span class="muted">${dt(a.at)}</span></div>
      <div class="muted">Yasak: ${a.ban?.kind === 'banned' ? 'kalıcı' : `askı (${dt(a.ban?.until)} tarihine kadar)`}${a.ban?.reason ? ` · ${esc(a.ban.reason)}` : ''}</div>
      <div class="det">${esc(a.text)}</div>
      ${a.status === 'open' ? `<div class="acts"><input class="field nt" placeholder="Kullanıcıya yanıt (isteğe bağlı)"><button class="btn sm ok" data-ok="1">${icon('check')} Kabul et, hesabı aç</button><button class="btn sm danger" data-ok="0">Reddet</button>${a.user ? `<button class="btn sm" data-u="${esc(a.user.id)}">Profili incele</button>` : ''}</div>`
    : `<div class="row"><span class="chip ${a.status === 'accepted' ? 'ok' : 'bad'}">${a.status === 'accepted' ? 'Kabul edildi' : 'Reddedildi'}</span><span class="muted">${esc(a.decidedBy || '')} · ${dt(a.decidedAt)}</span></div>${a.note ? `<div class="muted">Yanıt: ${esc(a.note)}</div>` : ''}`}
    </div>`).join('') : '<div class="empty">Bu listede itiraz yok.</div>';
  };
  main.querySelector('.tabs').onclick = (e) => { const b = e.target.closest('[data-s]'); if (!b) return; status = b.dataset.s; main.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b)); load(); };
  lst.onclick = async (e) => {
    const u = e.target.closest('[data-u]'); if (u) return userDrawer(u.dataset.u, load);
    const b = e.target.closest('[data-ok]'); if (!b) return;
    const card = b.closest('.case');
    try { await api(`/appeals/${card.dataset.id}`, { body: { accept: b.dataset.ok === '1', note: card.querySelector('.nt').value } }); toast(b.dataset.ok === '1' ? 'Hesap açıldı.' : 'İtiraz reddedildi.'); load(); refreshCounts(); } catch (er) { toast(er.message); }
  };
  await load();
};

// ---- Gelir ve gider ----
VIEWS.ledger = async (main) => {
  const now = new Date();
  let month = ymd(now).slice(0, 7);
  let editing = null;
  main.innerHTML = `${head('Gelir ve gider', 'Bu kayıtlar sadece yönetim panelinde tutulur; uygulama kullanıcıları görmez.', `<input type="month" class="field mo" value="${month}" style="width:auto"><button class="btn csv">${icon('share')} CSV indir</button>`)}
    <div class="stats sm"></div>
    <div class="panel" style="margin-bottom:14px"><div class="ph"><h3 class="ft">Yeni kayıt</h3></div><form class="pb form-row">
      <div class="seg tp"><button type="button" data-t="gelir" class="on g">Gelir</button><button type="button" data-t="gider" class="r">Gider</button></div>
      <input class="field am" inputmode="decimal" placeholder="Tutar (₺)" required>
      <select class="field ct"></select>
      <input class="field dt" type="date" value="${today()}">
      <input class="field nt" placeholder="Açıklama">
      <select class="field acc" title="Kasa / banka hesabı" style="width:auto"><option value="">Hesap (isteğe bağlı)</option></select>
      <div class="row"><button class="btn primary sv">Ekle</button><button type="button" class="btn cancel" hidden>Vazgeç</button></div></form></div>
    <div class="grid g21">
      <div class="panel"><div class="ph"><h3>Kayıtlar</h3></div><div class="tw lst"><div class="spin"></div></div></div>
      <div class="grid" style="align-content:start">
        <div class="panel"><div class="ph"><h3>Son 6 ay</h3></div><div class="pb mchart"></div></div>
        <div class="panel"><div class="ph"><h3>Kategoriler</h3></div><div class="pb cats"></div></div>
      </div></div>`;
  let type = 'gelir'; let data = null;
  const f = main.querySelector('form');
  let accs = [];
  api('/erp/accounts').then((a) => { accs = a.filter((x) => !x.archived); f.querySelector('.acc').insertAdjacentHTML('beforeend', accs.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')); }).catch(() => { f.querySelector('.acc').hidden = true; });
  const setType = (t) => {
    type = t;
    main.querySelectorAll('.tp button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
    f.querySelector('.ct').innerHTML = (data?.categories[t] || []).map((c) => `<option>${esc(c)}</option>`).join('');
  };
  main.querySelector('.tp').onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) setType(b.dataset.t); };
  const resetForm = () => { editing = null; f.reset(); f.querySelector('.dt').value = today(); main.querySelector('.ft').textContent = 'Yeni kayıt'; f.querySelector('.sv').textContent = 'Ekle'; f.querySelector('.cancel').hidden = true; setType('gelir'); };
  f.querySelector('.cancel').onclick = resetForm;
  const load = async () => {
    const [y, m] = month.split('-').map(Number);
    const from = `${month}-01`; const to = ymd(new Date(y, m, 0));
    data = await api(`/ledger?from=${from}&to=${to}`);
    if (!f.querySelector('.ct').options.length) setType(type);
    const items = data.items;
    const inc = items.filter((x) => x.type === 'gelir').reduce((a, x) => a + x.amount, 0);
    const exp = items.filter((x) => x.type === 'gider').reduce((a, x) => a + x.amount, 0);
    const all = Object.values(data.byMonth).reduce((a, v) => ({ g: a.g + v.gelir, c: a.c + v.gider }), { g: 0, c: 0 });
    main.querySelector('.stats').innerHTML = `<div class="stat"><b class="money in">${tl(inc)}</b><span>Gelir · ${esc(month)}</span></div><div class="stat"><b class="money out">${tl(exp)}</b><span>Gider · ${esc(month)}</span></div>
      <div class="stat"><b class="money ${inc - exp >= 0 ? 'in' : 'out'}">${tl(inc - exp)}</b><span>Net · ${esc(month)}</span></div><div class="stat"><b class="money ${all.g - all.c >= 0 ? 'in' : 'out'}">${tl(all.g - all.c)}</b><span>Tüm zamanlar net</span></div>`;
    main.querySelector('.lst').innerHTML = items.length ? `<table class="tbl"><thead><tr><th>Tarih</th><th>Tür</th><th>Kategori</th><th>Açıklama</th><th class="num">Tutar</th><th></th></tr></thead><tbody>
      ${items.map((x) => `<tr data-id="${esc(x.id)}"><td>${d(x.date)}</td><td><span class="chip ${x.type === 'gelir' ? 'ok' : 'bad'}">${x.type === 'gelir' ? 'Gelir' : 'Gider'}</span></td><td>${esc(x.category)}</td><td class="muted">${esc(x.note || '—')}<div style="font-size:11.5px">${esc(x.by)}</div></td><td class="num money ${x.type === 'gelir' ? 'in' : 'out'}">${x.type === 'gelir' ? '+' : '−'}${tl(x.amount)}</td>
        <td class="num"><button class="btn sm ed">${icon('edit')}</button> <button class="btn sm danger rm">${icon('trash')}</button></td></tr>`).join('')}</tbody></table>`
      : '<div class="empty">Bu ay için kayıt yok. Yukarıdan ilk gelir ya da gideri ekle.</div>';
    // son 6 ay
    const months = Array.from({ length: 6 }, (_, i) => ymd(new Date(y, m - 1 - (5 - i), 1)).slice(0, 7));
    main.querySelector('.mchart').innerHTML = multiChart({ title: 'Son 6 ay gelir ve gider', xName: 'Ay', labels: months.map((k) => new Date(`${k}-01T12:00:00`).toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' })), fmt: tl,
      tipLabel: (i) => new Date(`${months[i]}-01T12:00:00`).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }),
      series: [{ name: 'Gelir', color: 'var(--ch-in)', values: months.map((k) => data.byMonth[k]?.gelir || 0) }, { name: 'Gider', color: 'var(--ch-out)', values: months.map((k) => data.byMonth[k]?.gider || 0) }] });
    const byCat = {};
    items.forEach((x) => { const k = `${x.type}|${x.category}`; byCat[k] = (byCat[k] || 0) + x.amount; });
    main.querySelector('.cats').innerHTML = Object.keys(byCat).length ? Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => { const [t, c] = k.split('|'); return `<div class="row" style="padding:5px 0"><span class="chip ${t === 'gelir' ? 'ok' : 'bad'}">${t === 'gelir' ? '+' : '−'}</span><span class="grow">${esc(c)}</span><span class="money">${tl(v)}</span></div>`; }).join('') : '<div class="muted">Bu ay kayıt yok.</div>';
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const body = { type, amount: f.querySelector('.am').value, category: f.querySelector('.ct').value, date: f.querySelector('.dt').value, note: f.querySelector('.nt').value, accountId: f.querySelector('.acc').value };
    try {
      if (editing) await api(`/ledger/${editing}`, { method: 'PUT', body }); else await api('/ledger', { body });
      toast(editing ? 'Kayıt güncellendi.' : 'Kayıt eklendi.'); resetForm(); load();
    } catch (er) { toast(er.message); }
  };
  main.querySelector('.lst').onclick = async (e) => {
    const tr = e.target.closest('[data-id]'); if (!tr) return;
    const x = data.items.find((i) => i.id === tr.dataset.id);
    if (e.target.closest('.rm')) { if (!confirm('Bu kayıt silinsin mi?')) return; await api(`/ledger/${x.id}`, { method: 'DELETE' }); toast('Silindi.'); load(); }
    if (e.target.closest('.ed')) {
      editing = x.id; setType(x.type);
      f.querySelector('.am').value = x.amount; f.querySelector('.ct').value = x.category; f.querySelector('.dt').value = x.date; f.querySelector('.nt').value = x.note || ''; f.querySelector('.acc').value = x.accountId || '';
      main.querySelector('.ft').textContent = 'Kaydı düzenle'; f.querySelector('.sv').textContent = 'Kaydet'; f.querySelector('.cancel').hidden = false;
      f.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
  main.querySelector('.mo').onchange = (e) => { month = e.target.value || month; load(); };
  main.querySelector('.csv').onclick = () => {
    const rows = [['Tarih', 'Tür', 'Kategori', 'Açıklama', 'Tutar (TRY)', 'Ekleyen'], ...data.items.map((x) => [x.date, x.type, x.category, x.note || '', (x.type === 'gider' ? -x.amount : x.amount).toFixed(2).replace('.', ','), x.by])];
    const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `swipeup-gelir-gider-${month}.csv`; a.click();
  };
  await load();
};

// ---- Şirket yönetimi (ERP) ----
VIEWS.erp = async (main) => {
  const [{ default: erp }, adm] = await Promise.all([import('./erp.js'), api('/admins').catch(() => ({ items: [] }))]);
  await erp(main, { api, esc, toast, head, tl, d, today, icon, multiChart, ledgerView: (c) => VIEWS.ledger(c), admins: adm.items || [] });
};

// ---- Şarkı yarışması ----
// Fotoğraf denetimi: yapay zekanın sınırda bulduğu fotoğraflar ve engellenen yüklemeler
VIEWS.photomod = async (main) => {
  const d = await api('/photomod'); const pc = (n) => `%${Math.round((n || 0) * 100)}`;
  const card = (f, open) => `<div class="pmc" data-id="${esc(f.id)}">
      <div class="pmi">${f.url ? `<img src="${esc(f.url)}" alt="" loading="lazy">` : `<span class="pmx">${icon(f.verdict === 'block' ? 'block' : 'image')}<small>${f.verdict === 'block' ? 'Kaydedilmedi' : 'Silindi'}</small></span>`}</div>
      <div class="pmb">${userCell(f.user)}
        <div class="pmt"><span class="chip ${f.verdict === 'block' ? 'bad' : f.verdict === 'queue' ? 'info' : 'warn'}">${esc(f.label || '')}${f.score != null ? ` ${pc(f.score)}` : ''}</span>${f.kind === 'profil' ? '<span class="chip">profil fotoğrafı</span>' : ''}${f.userBlocked > 1 ? `<span class="chip bad">${f.userBlocked} engellenen yükleme</span>` : ''}<span class="muted">${dt(f.at)}</span></div>
        ${open ? `<div class="row" style="gap:6px"><button class="btn sm pm-ok">${icon('check')} Uygun</button><button class="btn sm danger pm-rm">${icon('trash')} Kaldır</button></div>` : `<small class="muted">${{ approved: 'Onaylandı', removed: 'Kaldırıldı', blocked: 'Yüklenirken engellendi' }[f.status] || ''}${f.by ? ` · ${esc(f.by)}` : ''}</small>`}</div></div>`;
  main.innerHTML = `${head('Fotoğraf denetimi', 'Yüklenen her fotoğraf yapay zekayla taranır. Açık cinsel içerik hiç kaydedilmez; sınırda kalanlar yayına çıkar ve burada incelemeni bekler.')}
    ${d.enabled ? `<div class="stats"><div class="stat"><b>${d.stats.checked}</b><span>Taranan (açılıştan beri)</span></div><div class="stat"><b>${d.stats.blocked}</b><span>Engellenen</span></div><div class="stat"><b>${d.stats.review}</b><span>İncelemeye düşen</span></div><div class="stat${d.stats.failed ? ' alert' : ''}"><b>${d.stats.failed}</b><span>Servis hatası</span></div></div>${d.stats.lastError ? `<p class="erp-hint" style="margin-top:12px">${icon('shield')} Son servis hatası: ${esc(d.stats.lastError)}. Hata olduğunda yüklemeler engellenmez.</p>` : ''}`
    : `<div class="panel"><div class="pb"><b>Otomatik denetim kapalı.</b> <span class="muted">Bu sürede yeni profil fotoğrafları aşağıdaki listeye düşer${''} ve senin onayını bekler (yapay zeka açıksa önce ona sorulur, sorunsuz olanlar listeye düşmez).</span><p class="muted" style="margin:6px 0 0;max-width:70ch">Sightengine hesabı açıp Render'da <code>SIGHTENGINE_USER</code> ve <code>SIGHTENGINE_SECRET</code> ortam değişkenlerini tanımlayınca otomatik başlar. Ücretsiz planda ayda 2.000 tarama var.</p></div></div>`}
    <div class="panel" style="margin-top:16px"><div class="ph"><h3>İnceleme bekleyenler · ${d.open.length}</h3></div><div class="pb">${d.open.length ? `<div class="pmg">${d.open.map((f) => card(f, true)).join('')}</div>` : '<div class="empty">İnceleme bekleyen fotoğraf yok.</div>'}</div></div>
    <div class="panel" style="margin-top:16px"><div class="ph"><h3>Son kararlar</h3></div><div class="pb">${d.recent.length ? `<div class="pmg">${d.recent.map((f) => card(f, false)).join('')}</div>` : '<div class="empty">Henüz kayıt yok.</div>'}</div></div>`;
  main.addEventListener('click', async (e) => {
    const b = e.target.closest('.pm-ok, .pm-rm'); if (!b) return; const id = b.closest('.pmc').dataset.id; const rm = b.classList.contains('pm-rm');
    if (rm && !confirm('Fotoğraf kalıcı olarak silinsin ve kullanıcıya bildirilsin mi?')) return;
    try { await api(`/photomod/${id}`, { body: { action: rm ? 'remove' : 'approve' } }); toast(rm ? 'Fotoğraf kaldırıldı.' : 'Fotoğraf uygun bulundu.'); VIEWS.photomod(main); } catch (er) { toast(er.message); }
  }, { once: true });
};
VIEWS.karaoke = async (main) => {
  const { default: karaoke } = await import('./karaoke.js');
  await karaoke(main, { api, esc, toast, head, d, icon, can, token: () => null });
};
VIEWS.songs = async (main) => {
  const { default: songs } = await import('./songs.js');
  await songs(main, { api, esc, toast, head, d, dt, icon, userCell, can, token: () => null });
};

VIEWS.errors = async (main) => {
  const { default: m } = await import('./errors.js');
  await m(main, { api, esc, toast, head, d, dt, icon, userCell, can });
};
VIEWS.contests = async (main) => {
  const { default: m } = await import('./contests.js');
  await m(main, { api, esc, toast, head, d, dt, icon, userCell, can });
};

// ---- Fal ----
VIEWS.fal = async (main) => {
  const [r, ai, dy] = await Promise.all([api('/fal'), api('/falai').catch(() => null), api('/falai/daily').catch(() => null)]);
  S.counts.falPending = r.pending;
  main.innerHTML = `${head('Fal', 'Falcı Teyze hesabına gelen istekler. Cevaplar uygulamada Falcı Teyze hesabından verilir.')}
    <div class="stats"><div class="stat"><b>${r.total}</b><span>Toplam istek</span></div><div class="stat ${r.pending ? 'alert' : ''}"><b>${r.pending}</b><span>Bekleyen</span></div>
      <div class="stat"><b>${r.avgMin == null ? '—' : r.avgMin < 60 ? `${r.avgMin} dk` : `${(r.avgMin / 60).toFixed(1)} sa`}</b><span>Ortalama cevap süresi</span></div>
      ${Object.entries(FAL).map(([k, l]) => `<div class="stat"><b>${r.byType[k] || 0}</b><span>${l} · ${r.prices[k] || 0} jeton</span></div>`).join('')}</div>
    ${ai ? `<div class="panel aip" style="margin-bottom:14px"><div class="ph"><h3>✨ Yapay zeka (Google Gemini)</h3>${ai.hasKey ? '<span class="chip ok">Anahtar tanımlı</span>' : '<span class="chip bad">GEMINI_API_KEY yok</span>'}</div><div class="pb" style="display:grid;gap:12px">
      <div class="seg3">${[['off', 'Kapalı', 'Falcı Teyze kendisi yazar'], ['draft', 'Taslak', 'Yapay zeka yazar, Falcı Teyze kontrol edip gönderir'], ['auto', 'Otomatik', 'Cevap, bekleme süresi dolunca kendiliğinden gider']].map(([k, t, d]) => `<button data-mode="${k}" class="${ai.saved === k ? 'on' : ''}" ${can('fal') && ai.hasKey ? '' : 'disabled'}><b>${t}</b><small>${d}</small></button>`).join('')}</div>
      <div class="muted" style="font-size:12.5px">Modeller: ${esc((ai.stats.models || []).join(' → ') || '—')} · Başarılı: ${ai.stats.ok} · Hatalı: ${ai.stats.fail}${ai.stats.lastModel ? ` · Son kullanılan: ${esc(ai.stats.lastModel)}` : ''}<br>Toplam ${ai.counts.total} taslak · ${ai.counts.sent} gönderildi (${ai.counts.auto} otomatik, ${ai.counts.edited} düzenlenerek)${ai.stats.lastError ? `<br><span style="color:var(--bad)">Son hata: ${esc(ai.stats.lastError)}</span>` : ''}</div>
      <div class="row" style="gap:8px"><button class="btn sm aitest" ${ai.hasKey ? '' : 'disabled'}>Bağlantıyı test et</button><span class="muted ait" style="font-size:12.5px"></span></div>
      <div class="aiout" hidden></div>
      <p class="muted" style="margin:0;font-size:12px">Ücretsiz katmanda günlük istek sınırı vardır; sınır dolunca istekler Falcı Teyze'nin kuyruğunda bekler. Ücretsiz katmanda gönderilen içerik Google tarafından ürün geliştirme için kullanılabilir.</p>
    </div></div>` : ''}
    ${dy ? `<form class="panel dyp" style="margin-bottom:14px"><div class="ph"><h3>Günlük burç, tarot paylaşımı ve sabah bildirimi</h3><label class="row" style="gap:6px;font-size:13px"><input type="checkbox" name="on" ${dy.settings.enabled ? 'checked' : ''} ${can('fal') ? '' : 'disabled'}> Açık</label></div><div class="pb" style="display:grid;gap:12px">
      <div class="muted" style="font-size:12.5px">Falcı Teyze her gün belirlediğin saatte akışa bir görsel paylaşır; herkesin ana sayfasına düşer. Sırayla: ${dy.kinds.map((k) => esc(k.label)).join(', ')}. Metni yapay zeka Falcı Teyze ağzından yazar${dy.hasAi ? '' : ' (anahtar olmadığı için hazır metinler kullanılır)'}.</div>
      <div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end"><label style="display:grid;gap:4px;font-size:12.5px">Saat (Türkiye)<input class="field" type="time" name="t" value="${String(dy.settings.hour).padStart(2, '0')}:${String(dy.settings.minute).padStart(2, '0')}" style="width:130px"></label>
        <div style="display:flex;gap:10px;flex-wrap:wrap">${dy.kinds.map((k) => `<label class="row" style="gap:6px;font-size:13px"><input type="checkbox" name="k_${k.id}" ${dy.settings.kinds.includes(k.id) ? 'checked' : ''}> ${esc(k.label)}</label>`).join('')}</div></div>
      <div class="muted" style="font-size:12.5px">Sıradaki: <b>${esc(dy.next.label)} · ${esc(dy.next.title)}</b> (${esc(dy.next.date)})</div>
      <div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end;padding-top:8px;border-top:1px solid var(--line)"><label class="row" style="gap:6px;font-size:13px"><input type="checkbox" name="mon" ${dy.settings.mEnabled ? 'checked' : ''}> Burcuna özel sabah bildirimi</label>
        <label style="display:grid;gap:4px;font-size:12.5px">Saat<input class="field" type="time" name="mt" value="${String(dy.settings.mHour).padStart(2, '0')}:${String(dy.settings.mMinute).padStart(2, '0')}" style="width:130px"></label>
        <span class="muted" style="font-size:12.5px">${dy.morning ? `Son gönderim: ${esc(dy.morning.id)} · ${dy.morning.count} kişi` : 'Henüz gönderilmedi.'} Pazartesileri haftalık burç yorumu da haber verilir. Kullanıcılar Bildirimler ayarından kapatabilir.</span></div>
      ${can('fal') ? `<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary sm">${icon('check')} Kaydet</button><button type="button" class="btn sm dynow">Bugünkünü şimdi paylaş</button><button type="button" class="btn sm dyre">Bugünkünü yeniden oluştur</button>${dy.morning?.id === dy.today ? '' : '<button type="button" class="btn sm dym">Sabah bildirimini şimdi gönder</button>'}</div>` : ''}
      ${dy.list.length ? `<div class="dyl">${dy.list.map((x) => `<div class="dyi">${x.media ? `<img src="${esc(x.media)}" alt="">` : '<div class="dyx">Silindi</div>'}<div class="grow"><b>${esc(x.label)}</b> <span class="muted">${esc(x.id)} · ${x.ai ? 'yapay zeka' : 'hazır metin'} · ${esc(x.by)}</span><div class="muted" style="font-size:12px">${x.likes} beğeni · ${x.comments} yorum</div><p>${esc(x.caption.slice(0, 220))}${x.caption.length > 220 ? '…' : ''}</p></div></div>`).join('')}</div>` : '<div class="muted" style="font-size:12.5px">Henüz paylaşım yapılmadı.</div>'}
    </div></form>` : ''}
    ${ai?.delay ? `<form class="panel dlp" style="margin-bottom:14px"><div class="ph"><h3>⏳ Cevap bekleme süresi</h3><label class="row" style="gap:6px;font-size:13px"><input type="checkbox" name="den" ${ai.delay.enabled ? 'checked' : ''} ${can('fal') ? '' : 'disabled'}> Açık</label></div><div class="pb" style="display:grid;gap:12px">
      <div class="muted" style="font-size:12.5px">Falcı Teyze fala hemen cevap vermez. Her fal için aşağıdaki aralıkta rastgele bir süre seçilir; bu süre dolmadan yazılan cevaplar (yapay zeka, taslak ya da elle yazılan) bekletilir ve zamanı gelince iletilir. Falcı Teyze isterse “Şimdi gönder” diyebilir.${ai.holds ? ` Şu an bekleyen cevap: <b>${ai.holds}</b>` : ''}</div>
      <div class="tw"><table class="tbl"><thead><tr><th>Fal türü</th><th class="num">En az (dk)</th><th class="num">En fazla (dk)</th></tr></thead><tbody>${Object.entries(FAL).map(([k, l]) => `<tr><td>${l}</td><td class="num"><input class="field" type="number" min="0" max="240" name="lo_${k}" value="${ai.delay.ranges[k]?.[0] ?? 15}" style="width:90px" ${can('fal') ? '' : 'disabled'}></td><td class="num"><input class="field" type="number" min="0" max="240" name="hi_${k}" value="${ai.delay.ranges[k]?.[1] ?? 20}" style="width:90px" ${can('fal') ? '' : 'disabled'}></td></tr>`).join('')}</tbody></table></div>
      ${can('fal') ? `<div><button class="btn primary sm">${icon('check')} Kaydet</button></div>` : ''}</div></form>` : ''}
    ${r.falci ? `<div class="panel" style="margin-bottom:14px"><div class="ph"><h3>Falcı Teyze kazancı</h3><a class="btn sm" href="#/settings">Fiyatlar</a></div><div class="pb"><div class="stats sm" style="margin:0">
      <div class="stat"><b>${r.paidCount}</b><span>Ücretli fal</span></div>
      <div class="stat"><b>${r.coinsSpent}</b><span>Harcanan jeton</span></div>
      <div class="stat"><b class="money in">${tl(r.falci.totalTL)}</b><span>Toplam kazanç (%${Math.round(r.share * 100)} pay)</span></div>
      <div class="stat"><b class="money">${tl(r.falci.balanceTL)}</b><span>Ödenmemiş bakiye</span>${r.falci.balance > 0 && can('payouts') ? `<button class="btn sm settle" data-id="${esc(r.falci.id)}">Ödendi olarak işaretle</button>` : ''}</div>
    </div></div></div>` : ''}
    <div class="panel"><div class="tw">${r.items.length ? `<table class="tbl"><thead><tr><th>Kullanıcı</th><th>Tür</th><th>Not</th><th>Gönderildi</th><th>Durum</th></tr></thead><tbody>
      ${r.items.map((x) => `<tr><td>${userCell(x.user)}</td><td>${FAL[x.type]}${x.price ? `<div class="muted" style="font-size:11.5px">${x.price} jeton</div>` : ''}</td><td class="muted" style="max-width:320px">${esc((x.note || '').slice(0, 120)) || '—'}${x.images?.length ? ` · ${x.images.length} fotoğraf` : ''}</td><td>${dt(x.at)}</td><td>${x.status === 'answered' ? `<span class="chip ok">Cevaplandı</span><div class="muted" style="font-size:11.5px">${dt(x.answeredAt)}</div>` : '<span class="chip warn">Bekliyor</span>'}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Henüz fal isteği yok.</div>'}</div></div>`;
  main.querySelector('.seg3')?.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-mode]'); if (!b || b.disabled) return;
    if (b.dataset.mode === 'auto' && !confirm('Otomatik modda fal cevapları Falcı Teyze kontrol etmeden gönderilir. Açılsın mı?')) return;
    try { await api('/falai', { method: 'PUT', body: { mode: b.dataset.mode } }); toast('Kaydedildi.'); VIEWS.fal(main); } catch (er) { toast(er.message); }
  });
  main.querySelector('.dlp')?.addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target;
    const ranges = Object.fromEntries(Object.keys(FAL).map((k) => [k, [+f[`lo_${k}`].value, +f[`hi_${k}`].value]]));
    try { await api('/falai/delay', { method: 'PUT', body: { enabled: f.den.checked, ranges } }); toast('Cevap süreleri kaydedildi.'); VIEWS.fal(main); } catch (er) { toast(er.message); }
  });
  const dyf = main.querySelector('.dyp');
  dyf?.addEventListener('submit', async (e) => {
    e.preventDefault(); const [h, m] = (dyf.t.value || '10:00').split(':');
    const kinds = dy.kinds.map((k) => k.id).filter((k) => dyf[`k_${k}`].checked);
    const [mh, mm] = (dyf.mt.value || '09:00').split(':');
    try { await api('/falai/daily', { method: 'PUT', body: { enabled: dyf.on.checked, hour: +h, minute: +m, kinds, mEnabled: dyf.mon.checked, mHour: +mh, mMinute: +mm } }); toast('Günlük paylaşım ayarı kaydedildi.'); VIEWS.fal(main); } catch (er) { toast(er.message); }
  });
  const dyGo = async (b, replace) => {
    if (replace && !confirm('Bugünkü paylaşım silinip yenisi oluşturulsun mu? Beğeni ve yorumları da silinir.')) return;
    b.disabled = true; b.textContent = 'Hazırlanıyor…';
    try { await api('/falai/daily/now', { body: { replace } }); toast('Falcı Teyze paylaştı.'); VIEWS.fal(main); } catch (er) { toast(er.message); b.disabled = false; }
  };
  main.querySelector('.dynow')?.addEventListener('click', (e) => dyGo(e.target, false));
  main.querySelector('.dym')?.addEventListener('click', async (e) => {
    if (!confirm('Burcu belli olan herkese bugünün sabah burç bildirimi gönderilsin mi?')) return;
    e.target.disabled = true;
    try { const x = await api('/falai/daily/morning', { body: {} }); toast(`Bildirim ${x.morning?.count || 0} kişiye gönderildi.`); VIEWS.fal(main); } catch (er) { toast(er.message); e.target.disabled = false; }
  });
  main.querySelector('.dyre')?.addEventListener('click', (e) => dyGo(e.target, true));
  main.querySelector('.aitest')?.addEventListener('click', async (e) => {
    const t = main.querySelector('.ait'); const out = main.querySelector('.aiout');
    e.target.disabled = true; t.textContent = 'Deneniyor…';
    try { const x = await api('/falai/test', { body: {} }); t.textContent = `✓ Çalışıyor · ${esc(x.model)} · ${(x.ms / 1000).toFixed(1)} sn`; out.hidden = false; out.innerHTML = `<div class="aisample">${esc(x.text).replace(/\n/g, '<br>')}</div>`; } catch (er) { t.textContent = `✗ ${er.message}`; }
    e.target.disabled = false;
  });
  main.querySelector('.settle')?.addEventListener('click', async (e) => {
    if (!confirm(`Falcı Teyze'nin ${tl(r.falci.balanceTL)} kazancı ödendi olarak işaretlensin mi? Gelir-gidere gider olarak eklenir.`)) return;
    try { await api(`/users/${e.target.dataset.id}/settle`, { body: {} }); toast('Ödendi olarak işaretlendi.'); VIEWS.fal(main); } catch (er) { toast(er.message); }
  });
};

// ---- İçerik ----
VIEWS.content = async (main) => {
  let kind = 'posts';
  main.innerHTML = `${head('İçerik', 'Son paylaşılan gönderiler, vitrin videoları ve hikayeler.')}
    <div class="tabs"><button data-k="posts" class="on">Gönderiler ve vitrin videoları</button><button data-k="stories">Hikayeler (24 saat)</button></div><div class="lst"><div class="spin"></div></div>`;
  const lst = main.querySelector('.lst');
  const load = async () => {
    const list = await api(`/content?kind=${kind}`);
    lst.innerHTML = list.length ? `<div class="cgrid">${list.map((c) => `<div class="citem" data-id="${esc(c.id)}">
      ${c.type === 'reel' || c.mediaType === 'video' ? `<video src="${esc(c.media)}" ${c.poster ? `poster="${esc(c.poster)}"` : ''} muted preload="metadata"></video>` : `<img src="${esc(c.media)}" alt="" loading="lazy">`}
      <div class="cb">${userCell(c.user)}${c.caption ? `<div class="ell">${esc(c.caption)}</div>` : ''}<div class="muted">${dt(c.at)}${c.likes != null ? ` · ❤️ ${c.likes} · 💬 ${c.comments}` : ` · 👁 ${c.views}`}</div>
      <button class="btn sm danger rm">${icon('trash')} Kaldır</button></div></div>`).join('')}</div>` : '<div class="empty">İçerik yok.</div>';
  };
  main.querySelector('.tabs').onclick = (e) => { const b = e.target.closest('[data-k]'); if (!b) return; kind = b.dataset.k; main.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b)); load(); };
  lst.onclick = async (e) => {
    const b = e.target.closest('.rm'); if (!b) return;
    if (!confirm('Bu içerik kaldırılsın mı?')) return;
    try { await api(`/content/${b.closest('[data-id]').dataset.id}`, { method: 'DELETE' }); toast('Kaldırıldı.'); load(); } catch (er) { toast(er.message); }
  };
  await load();
};


// ---- Medya: atılan görsel, video ve sesler ----
VIEWS.media = async (main) => {
  let kind = 'all'; let q = '';
  const sel = new Map();
  const TABS = [['all', 'Tümü'], ['post', 'Gönderi'], ['reel', 'Vitrin'], ['story', 'Hikaye'], ['chat', 'Özel mesaj'], ['genel', 'Genel sohbet'], ['profile', 'Profil'], ['music', 'Müzik'], ['orphan', 'Sahipsiz']];
  main.innerHTML = `${head('Medya', 'Uygulamaya yüklenen tüm görseller, videolar ve sesler. Seçip kaldırdığında içerik uygulamadan da çıkar ve dosya silinir.')}
    <div class="stats sm mstat"></div>
    <div class="row" style="flex-wrap:wrap;margin-bottom:10px"><div class="tabs" style="margin:0;flex-wrap:wrap">${TABS.map(([k, l], i) => `<button data-k="${k}" class="${i ? '' : 'on'}">${l}<span class="tc" data-c="${k}"></span></button>`).join('')}</div>
      <input class="field q" placeholder="Kullanıcı adına göre" style="max-width:220px;margin-left:auto"></div>
    <div class="mbar" hidden><b class="nsel">0 seçili</b><input class="field rs" placeholder="Gerekçe (kullanıcıya gider, isteğe bağlı)" style="flex:1;min-width:200px"><label class="row" style="gap:6px"><input type="checkbox" class="nt" checked> Kullanıcıya bildir</label>
      <button class="btn sm clr">Seçimi temizle</button><button class="btn sm solid-danger del">${icon('trash')} Seçilenleri kaldır</button></div>
    <div class="lst"><div class="spin"></div></div>`;
  const lst = main.querySelector('.lst');
  const bar = main.querySelector('.mbar');
  const paintBar = () => { bar.hidden = !sel.size; main.querySelector('.nsel').textContent = `${sel.size} seçili`; };
  const kb = (n) => (n == null ? '' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  const thumb = (m) => {
    const t = m.mime || '';
    if (t.startsWith('audio') || m.kind === 'music') return `<div class="mt-audio">${icon('music')}<audio src="${esc(m.url)}" controls preload="none"></audio></div>`;
    if (t.startsWith('video') || m.kind === 'reel' || (m.kind === 'story' && !t.startsWith('image'))) return `<video src="${esc(m.url)}#t=0.5" muted preload="metadata" playsinline></video><span class="vtag">${icon('play')}</span>`;
    return `<img src="${esc(m.url)}" alt="" loading="lazy">`;
  };
  let items = [];
  const load = async () => {
    const r = await api(`/media?kind=${kind}&q=${encodeURIComponent(q)}`);
    items = r.items;
    main.querySelector('.mstat').innerHTML = `<div class="stat"><b>${r.total}</b><span>Bu listede medya</span></div><div class="stat"><b>${r.storeMB} MB</b><span>${r.kind === 'redis' ? 'Key Value (kalıcı)' : r.kind === 'postgres' ? 'PostgreSQL' : 'Sunucu diski'} kullanımı</span></div><div class="stat"><b>${r.trackedMB} MB</b><span>Kayıtlı yüklemeler</span></div>`;
    main.querySelectorAll('.tc').forEach((c) => { const n = c.dataset.c === 'all' ? '' : r.counts[c.dataset.c]; c.textContent = n ? ` ${n}` : ''; });
    lst.innerHTML = items.length ? `<div class="mgrid">${items.map((m, i) => `<div class="mitem ${sel.has(m.url + m.refId) ? 'on' : ''}" data-i="${i}">
      <div class="mthumb">${thumb(m)}<label class="mcheck"><input type="checkbox" ${sel.has(m.url + m.refId) ? 'checked' : ''}></label><a class="mopen" href="${esc(m.url)}" target="_blank" rel="noopener" title="Aç">${icon('eye')}</a></div>
      <div class="mb"><div class="row" style="gap:6px"><span class="chip ${m.kind === 'orphan' ? 'warn' : ''}">${esc(m.label)}</span><span class="muted" style="margin-left:auto;font-size:11.5px">${kb(m.size)}</span></div>
        ${m.user ? `<div class="ell"><b>@${esc(m.user.username)}</b></div>` : '<div class="muted">—</div>'}
        <div class="muted" style="font-size:11.5px">${dt(m.at)}</div>
        <button class="btn sm danger rm1">${icon('trash')} Kaldır</button></div></div>`).join('')}</div>
      ${items.length >= 240 ? '<div class="muted" style="padding:10px">İlk 240 gösteriliyor; filtre ya da kullanıcı adıyla daralt.</div>' : ''}` : '<div class="panel"><div class="empty">Bu listede medya yok.</div></div>';
    paintBar();
  };
  const remove = async (list) => {
    if (!list.length) return;
    if (!confirm(`${list.length} medya kaldırılsın mı? Bu işlem geri alınamaz.`)) return;
    try {
      const r = await api('/media/delete', { body: { items: list.map((m) => ({ url: m.url, kind: m.kind, refId: m.refId })), reason: main.querySelector('.rs').value, notify: main.querySelector('.nt').checked } });
      toast(`${r.removed} medya kaldırıldı${r.freedMB ? ` · ${r.freedMB} MB boşaldı` : ''}${r.notified ? ` · ${r.notified} kişiye bildirildi` : ''}.`);
      list.forEach((m) => sel.delete(m.url + m.refId));
      load();
    } catch (er) { toast(er.message); }
  };
  main.querySelector('.tabs').onclick = (e) => { const b = e.target.closest('[data-k]'); if (!b) return; kind = b.dataset.k; main.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b)); load(); };
  let t; main.querySelector('.q').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { q = e.target.value; load(); }, 300); };
  lst.addEventListener('change', (e) => {
    const box = e.target.closest('.mcheck input'); if (!box) return;
    const card = box.closest('[data-i]'); const m = items[+card.dataset.i];
    if (box.checked) sel.set(m.url + m.refId, m); else sel.delete(m.url + m.refId);
    card.classList.toggle('on', box.checked); paintBar();
  });
  lst.addEventListener('click', (e) => { const b = e.target.closest('.rm1'); if (!b) return; remove([items[+b.closest('[data-i]').dataset.i]]); });
  main.querySelector('.del').onclick = () => remove([...sel.values()]);
  main.querySelector('.clr').onclick = () => { sel.clear(); load(); };
  await load();
};

// ---- Duyurular ----
VIEWS.announce = async (main) => {
  const list = await api('/announcements');
  const LINKS = [['/#/notifications', 'Bildirimler'], ['/#/', 'Ana sayfa'], ['/#/store', 'Mağaza (SwipeUp+ / jeton)'], ['/#/genel', 'Genel sohbet'], ['/#/fal', 'Fal'], ['/#/vitrin', 'Vitrin'], ['/#/swipe', 'Keşfet (kaydır)'], ['/#/secki', 'Günlük seçki'], ['/#/soru', 'Günün sorusu'], ['/#/kulupler', 'Kulüpler'], ['/#/seriler', 'Seriler'], ['/#/karaoke', 'Karaoke odası'], ['/#/gorevler', 'Günlük görevler'], ['/#/create', 'Paylaşım oluştur'], ['/#/verify', 'Profil doğrulama'], ['/#/live', 'Canlı yayın aç']];
  const AUD = [['custom', 'Özel kitle (filtrelerle)…'], ['all', 'Herkes'], ['online', 'Şu an çevrimiçi olanlar'], ['plus', 'SwipeUp+ üyeleri'], ['free', 'Ücretsiz üyeler'], ['verified', 'Mavi tikliler'], ['new7', 'Son 7 günde katılanlar'], ['inactive', '7 gündür girmeyenler'], ['city', 'Şehre göre…'], ['user', 'Tek kullanıcı…']];
  const ZOD = [['koc', 'Koç'], ['boga', 'Boğa'], ['ikizler', 'İkizler'], ['yengec', 'Yengeç'], ['aslan', 'Aslan'], ['basak', 'Başak'], ['terazi', 'Terazi'], ['akrep', 'Akrep'], ['yay', 'Yay'], ['oglak', 'Oğlak'], ['kova', 'Kova'], ['balik', 'Balık']];
  const PRESETS = [
    ['Kaybolanlar: İstanbul, 18–25, 7 gündür girmeyen', { city: 'İstanbul', ageMin: 18, ageMax: 25, inactiveDays: 7 }],
    ['30 gündür girmeyen herkes', { inactiveDays: 30 }],
    ['Son 3 günde katılan, tiksiz', { newDays: 3, verified: 'no' }],
    ['Aktif ama ücretsiz üyeler', { activeDays: 3, plan: 'free' }],
  ];
  main.innerHTML = `${head('Bildirim gönder', 'Seçtiğin kişilere uygulama içi bildirim ve telefonlarına anlık bildirim (push) gönderir. İstersen uygulama açılınca duyuru penceresi de çıkar.')}
    <details class="panel apns-p" hidden style="margin-bottom:14px"><summary class="pb" style="cursor:pointer"><b>iPhone uygulaması bildirimleri</b> <span class="muted apns-st" style="font-size:12.5px"></span></summary><div class="pb apns-b"></div></details>
    <div class="grid g21">
      <div class="panel"><div class="ph"><h3>Yeni bildirim</h3></div><form class="pb ann" style="display:grid;gap:12px">
        <label class="fl">Başlık<input class="field" name="title" maxlength="60" placeholder="SwipeUp"></label>
        <label class="fl">Mesaj<textarea class="field" name="t" rows="3" maxlength="300" placeholder="Örn. Bu hafta sonu SwipeUp+ %30 indirimde! 🎉"></textarea><span class="muted cnt" style="justify-self:end;font-size:12px">0 / 300</span></label>
        <div class="row" style="flex-wrap:wrap;gap:10px">
          <label class="fl" style="flex:1;min-width:200px">Kime<select class="field" name="aud">${AUD.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
          <label class="fl xcity" style="flex:1;min-width:160px" hidden>Şehir<input class="field" name="city" placeholder="Örn. İstanbul"></label>
          <label class="fl xuser" style="flex:1;min-width:160px" hidden>Kullanıcı adı<input class="field" name="username" placeholder="@kullanici"></label>
        </div>
        <fieldset class="xcust aud-f"><legend>Özel kitle · filtrelerin hepsi birlikte uygulanır</legend>
          <div class="aud-pre">${PRESETS.map(([l], i) => `<button type="button" class="btn sm" data-pre="${i}">${esc(l)}</button>`).join('')}</div>
          <div class="aud-g">
            <label class="fl">Şehir(ler)<input class="field" name="fcity" placeholder="İstanbul, İzmir"></label>
            <label class="fl">Yaş<span class="row" style="gap:6px"><input class="field" type="number" name="fmin" min="18" max="99" placeholder="18"><span>–</span><input class="field" type="number" name="fmax" min="18" max="99" placeholder="25"></span></label>
            <label class="fl">Cinsiyet<select class="field" name="fgen"><option value="">Hepsi</option><option value="k">Kadın</option><option value="e">Erkek</option><option value="d">Diğer</option></select></label>
            <label class="fl">Kaç gündür girmeyen<input class="field" type="number" name="fina" min="0" max="365" placeholder="7"></label>
            <label class="fl">Son kaç günde aktif<input class="field" type="number" name="fact" min="0" max="365" placeholder="—"></label>
            <label class="fl">Son kaç günde katılan<input class="field" type="number" name="fnew" min="0" max="365" placeholder="—"></label>
            <label class="fl">Üyelik<select class="field" name="fplan"><option value="">Hepsi</option><option value="plus">SwipeUp+</option><option value="free">Ücretsiz</option></select></label>
            <label class="fl">Mavi tik<select class="field" name="fver"><option value="">Hepsi</option><option value="yes">Var</option><option value="no">Yok</option></select></label>
            <label class="fl">Burç<select class="field" name="fzod"><option value="">Hepsi</option>${ZOD.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
            <label class="fl">İlgi alanı<input class="field" name="fint" placeholder="Örn. müzik"></label>
            <label class="fl">En az jeton<input class="field" type="number" name="fcoin" min="0" placeholder="—"></label>
            <label class="fl">Push<select class="field" name="fpush"><option value="">Hepsi</option><option value="yes">Sadece push açık olanlar</option></select></label>
          </div>
          <div class="muted aud-s" style="font-size:12.5px"></div>
        </fieldset>
        <label class="fl">Dokununca açılacak yer<select class="field" name="url">${LINKS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
        <label class="row" style="gap:8px;cursor:pointer"><input type="checkbox" name="marketing" style="width:18px;height:18px;accent-color:var(--brand)"><span><b>Kampanya / tanıtım bildirimi</b> <span class="muted">— yalnızca kampanya bildirimlerine izin veren üyelere gider</span></span></label>
        <label class="row xmail" style="gap:8px;cursor:pointer" hidden><input type="checkbox" name="email" style="width:18px;height:18px;accent-color:var(--brand)"><span><b>E-posta olarak da gönder</b> <span class="muted">— yalnızca kampanya e-postasına izin verenlere (İYS); gönderen bilgisi ve tek tıkla ret bağlantısı otomatik eklenir</span></span></label>
        <label class="row" style="gap:8px;cursor:pointer"><input type="checkbox" name="popup" style="width:18px;height:18px;accent-color:var(--brand)"><span><b>Açılış duyurusu</b> <span class="muted">— uygulamayı açan herkese pencere olarak da gösterilir (7 gün)</span></span></label>
        <div class="row"><span class="muted grow reach">Alıcı sayısı hesaplanıyor…</span><button class="btn primary send">${icon('bell')} Gönder</button></div>
      </form></div>
      <div class="panel"><div class="ph"><h3>Önizleme</h3></div><div class="pb">
        <div class="phone-pv"><div class="np"><img src="/icons/mark.png" alt=""><div class="grow"><div class="row"><b class="pv-t">SwipeUp</b><span class="muted" style="margin-left:auto;font-size:11px">şimdi</span></div><div class="pv-m muted">Mesajın burada görünecek.</div></div></div>
        <div class="pv-pop" hidden><img src="/icons/mark.png" alt=""><b class="pv-t">SwipeUp</b><div class="pv-m"></div><span class="btn sm primary">Tamam</span></div></div>
      </div></div>
    </div>
    <div class="panel" style="margin-top:14px"><div class="ph"><h3>Gönderilenler</h3><button class="btn sm rmpop">${icon('close')} Açılış duyurusunu kaldır</button></div><div class="tw">${list.length ? `<table class="tbl"><thead><tr><th>Bildirim</th><th>Kime</th><th class="num">Alıcı</th><th class="num">Push açık</th><th>Gönderen</th><th>Tarih</th></tr></thead><tbody>
      ${list.map((a) => `<tr><td style="max-width:420px"><b>${esc(a.title || 'SwipeUp')}</b>${a.popup ? ' <span class="chip info">Açılış duyurusu</span>' : ''}<div class="muted">${esc(a.text)}</div></td><td>${esc(a.audienceLabel || 'Herkes')}</td><td class="num">${a.reach}</td><td class="num">${a.pushReach ?? '—'}</td><td>${esc(a.by)}</td><td>${dt(a.at)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Henüz bildirim gönderilmedi.</div>'}</div></div>`;
  const f = main.querySelector('form');
  // iPhone uygulamasına Apple üzerinden bildirim (APNs) anahtarı: yalnız sahip görür
  const ap = main.querySelector('.apns-p');
  const apPaint = (r) => {
    ap.hidden = false;
    ap.querySelector('.apns-st').textContent = r.on ? `açık · ${r.devices} iPhone` : 'kapalı: uygulamaya bildirimler web üzerinden ("from swipeup") gider';
    ap.querySelector('.apns-b').innerHTML = `<p class="muted" style="font-size:12.5px;margin:0 0 8px">developer.apple.com → Certificates, IDs &amp; Profiles → <b>Keys</b> → + → <b>Apple Push Notifications service (APNs)</b> seç, Environment: <b>Sandbox &amp; Production</b>. İndirdiğin .p8 dosyasını metin düzenleyiciyle açıp içeriğini aşağı yapıştır. Key ID anahtar sayfasında, Team ID sağ üstte yazar. Anahtar bir kez indirilebilir, güvenli bir yerde sakla.</p>
      ${r.on ? `<p style="margin:0 0 8px"><span class="chip ok">açık</span> <span class="mono">${esc(r.keyId)}</span> · ekip <span class="mono">${esc(r.teamId)}</span> · ${esc(r.bundle)}${r.fromEnv ? ' · sunucu ortam değişkeninden' : ''}</p>` : ''}
      <div style="display:grid;gap:6px"><div class="row" style="gap:6px;flex-wrap:wrap"><input class="field ak" placeholder="Key ID (10 karakter)" value="${esc(r.keyId || '')}" style="flex:1"><input class="field at" placeholder="Team ID (10 karakter)" value="${esc(r.teamId || '')}" style="flex:1"><input class="field ab" value="${esc(r.bundle || 'app.swipeup.ios')}" style="flex:1"></div>
        <textarea class="field mono ap8" rows="4" placeholder="-----BEGIN PRIVATE KEY-----"></textarea>
        <div class="row" style="gap:8px"><button type="button" class="btn sm primary aps">Kaydet</button>${r.on && !r.fromEnv ? '<button type="button" class="btn sm danger apd">Kaldır</button>' : ''}</div></div>`;
    ap.querySelector('.aps').onclick = async () => {
      try { apPaint(await api('/apns', { body: { keyId: ap.querySelector('.ak').value, teamId: ap.querySelector('.at').value, bundle: ap.querySelector('.ab').value, key: ap.querySelector('.ap8').value } })); toast('iPhone bildirim anahtarı kaydedildi.'); } catch (er) { toast(er.message); }
    };
    const d = ap.querySelector('.apd'); if (d) d.onclick = async () => { if (!confirm('Anahtar kaldırılsın mı? iPhone uygulamasına bildirimler durur.')) return; try { apPaint(await api('/apns', { method: 'DELETE' })); } catch (er) { toast(er.message); } };
  };
  api('/apns').then(apPaint).catch(() => {});
  const num = (v) => (v === '' ? undefined : +v);
  const filters = () => ({ city: f.fcity.value.trim() || undefined, ageMin: num(f.fmin.value), ageMax: num(f.fmax.value), gender: f.fgen.value || undefined, inactiveDays: num(f.fina.value), activeDays: num(f.fact.value), newDays: num(f.fnew.value), plan: f.fplan.value || undefined, verified: f.fver.value || undefined, zodiac: f.fzod.value || undefined, interest: f.fint.value.trim() || undefined, minCoins: num(f.fcoin.value), push: f.fpush.value || undefined });
  const body = () => ({ title: f.title.value, text: f.t.value, url: f.url.value, audience: f.aud.value, city: f.city.value, username: f.username.value, popup: f.popup.checked, marketing: f.marketing.checked, email: f.marketing.checked && f.email.checked, filters: f.aud.value === 'custom' ? filters() : undefined });
  const setF = (o) => { const map = { city: 'fcity', ageMin: 'fmin', ageMax: 'fmax', gender: 'fgen', inactiveDays: 'fina', activeDays: 'fact', newDays: 'fnew', plan: 'fplan', verified: 'fver', zodiac: 'fzod', interest: 'fint', minCoins: 'fcoin', push: 'fpush' }; Object.values(map).forEach((n) => { f[n].value = ''; }); Object.entries(o).forEach(([k, v]) => { if (map[k]) f[map[k]].value = v; }); };
  main.querySelector('.aud-pre').onclick = (e) => { const b = e.target.closest('[data-pre]'); if (!b) return; setF(PRESETS[+b.dataset.pre][1]); pv(); reach(); };
  const pv = () => {
    main.querySelectorAll('.pv-t').forEach((x) => { x.textContent = f.title.value || 'SwipeUp'; });
    main.querySelectorAll('.pv-m').forEach((x) => { x.textContent = f.t.value ? `📣 ${f.t.value}` : 'Mesajın burada görünecek.'; });
    main.querySelector('.pv-pop').hidden = !f.popup.checked;
    main.querySelector('.xmail').hidden = !f.marketing.checked;
    main.querySelector('.cnt').textContent = `${f.t.value.length} / 300`;
    main.querySelector('.xcity').hidden = f.aud.value !== 'city';
    main.querySelector('.xuser').hidden = f.aud.value !== 'user';
    main.querySelector('.xcust').hidden = f.aud.value !== 'custom';
  };
  let rt;
  const reach = () => {
    clearTimeout(rt);
    rt = setTimeout(async () => {
      try {
        const r = await api('/announcements/preview', { body: body() });
        main.querySelector('.reach').textContent = (r.count || r.mails) ? `${r.count} kişiye gidecek · ${r.push} telefona push${f.marketing.checked && f.email.checked ? ` · ${r.mails} e-posta${r.mailOn ? '' : ' (e-posta ayarlı değil, gönderilmez)'}` : ''}` : 'Bu seçimde kimse yok';
        main.querySelector('.aud-s').textContent = f.aud.value === 'custom' && r.sample?.length ? `Örnek: ${r.sample.map((x) => `@${x}`).join(', ')}${r.count > r.sample.length ? '…' : ''}` : '';
      } catch {}
    }, 250);
  };
  f.oninput = () => { pv(); reach(); };
  f.onchange = () => { pv(); reach(); };
  pv(); reach();
  f.onsubmit = async (e) => {
    e.preventDefault();
    if (!f.t.value.trim()) return toast('Mesaj yaz.');
    const label = f.aud.selectedOptions[0].textContent.replace('…', '');
    if (!confirm(`Bildirim gönderilsin mi?\n\nKime: ${label}\n${main.querySelector('.reach').textContent}`)) return;
    try { const a = await api('/announcements', { body: body() }); toast(`${a.reach} kişiye gönderildi${a.pushReach ? ` (${a.pushReach} telefona push)` : ''}${a.emailReach ? ` · ${a.emailReach} e-posta sıraya alındı` : ''}.`); VIEWS.announce(main); } catch (er) { toast(er.message); }
  };
  main.querySelector('.rmpop').onclick = async () => {
    if (!confirm('Aktif açılış duyurusu kaldırılsın mı?')) return;
    try { await api('/announcements/popup', { method: 'DELETE' }); toast('Kaldırıldı.'); } catch (er) { toast(er.message); }
  };
};

// ---- Notlar ----
VIEWS.notes = async (main) => {
  const list = await api('/notes');
  main.innerHTML = `${head('Notlar', 'Yönetici ekibinin ortak notları. Uygulamada görünmez.')}
    <div class="panel" style="margin-bottom:14px"><form class="pb row"><input class="field" name="t" placeholder="Yeni not"><button class="btn primary">Ekle</button></form></div>
    <div class="panel lst">${list.length ? list.map((n) => `<div class="case" data-id="${esc(n.id)}"><div class="row"><div class="grow" style="white-space:pre-wrap">${n.pinned ? '📌 ' : ''}${esc(n.text)}</div>
      <button class="btn sm pin">${n.pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}</button><button class="btn sm danger rm">${icon('trash')}</button></div><div class="muted">${esc(n.by)} · ${dt(n.at)}</div></div>`).join('') : '<div class="empty">Not yok.</div>'}</div>`;
  main.querySelector('form').onsubmit = async (e) => { e.preventDefault(); try { await api('/notes', { body: { text: e.target.t.value } }); VIEWS.notes(main); } catch (er) { toast(er.message); } };
  main.querySelector('.lst').onclick = async (e) => {
    const c = e.target.closest('[data-id]'); if (!c) return;
    const n = list.find((x) => x.id === c.dataset.id);
    if (e.target.closest('.pin')) { await api(`/notes/${n.id}`, { method: 'PATCH', body: { pinned: !n.pinned } }); VIEWS.notes(main); }
    if (e.target.closest('.rm') && confirm('Not silinsin mi?')) { await api(`/notes/${n.id}`, { method: 'DELETE' }); VIEWS.notes(main); }
  };
};

// ---- İşlem kaydı ----
VIEWS.audit = async (main) => {
  const list = await api('/audit');
  main.innerHTML = `${head('İşlem kaydı', 'Yöneticilerin yaptığı her işlem burada saklanır.')}
    <div class="panel"><div class="tw">${list.length ? `<table class="tbl"><thead><tr><th>Zaman</th><th>Yönetici</th><th>İşlem</th><th>Kullanıcı</th><th>Ayrıntı</th></tr></thead><tbody>
      ${list.map((x) => `<tr><td>${dt(x.at)}</td><td>@${esc(x.admin)}</td><td><b>${esc(x.action)}</b></td><td>${x.targetUser ? `@${esc(x.targetUser.username)}` : '—'}</td><td class="muted">${esc(x.detail || '')}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Kayıt yok.</div>'}</div></div>`;
};

// ---- Yöneticiler ----
VIEWS.admins = async (main) => {
  const r = await api('/admins');
  const owner = S.me.role === 'owner';
  const groups = [...new Set(r.perms.map((p) => p[2]))];
  const permBoxes = (sel, dis) => groups.map((g) => `<div class="pgrp"><b>${esc(g)}</b>${r.perms.filter((p) => p[2] === g).map(([k, l]) => `<label><input type="checkbox" value="${k}" ${sel.includes(k) ? 'checked' : ''} ${dis ? 'disabled' : ''}> ${esc(l)}</label>`).join('')}</div>`).join('');
  main.innerHTML = `${head('Yöneticiler', 'İki rol var: <b>Sahip</b> her şeyi yapar. <b>Moderatör</b> sadece seçtiğin yetkileri kullanır; yetkisi olmayan bölümler panelinde görünmez.')}
    <div class="adm-list">${r.items.map((a) => `<div class="panel adm" data-id="${esc(a.id)}"><div class="ph"><div class="row" style="gap:10px"><span class="adm-av">${esc((a.name || a.username)[0].toUpperCase())}</span><div><b>${esc(a.name)}</b> <span class="muted">@${esc(a.username)}</span><div class="muted" style="font-size:12px">Son giriş: ${dt(a.lastLogin)}${a.disabled ? ' · <b style="color:var(--bad)">Kapalı</b>' : ''}</div></div></div>
        <div class="row" style="gap:6px">${owner ? `<select class="field rl" style="width:auto" ${a.id === S.me.id ? 'disabled' : ''}><option value="owner" ${a.role === 'owner' ? 'selected' : ''}>👑 Sahip</option><option value="moderator" ${a.role !== 'owner' ? 'selected' : ''}>🛡️ Moderatör</option></select>` : `<span class="chip ${a.role === 'owner' ? 'info' : ''}">${a.role === 'owner' ? '👑 Sahip' : '🛡️ Moderatör'}</span>`}</div></div>
      ${a.role === 'owner' ? '<div class="pb muted" style="font-size:13px">Sahip tüm yetkilere sahip.</div>' : `<div class="pb"><div class="perms">${permBoxes(a.perms, !owner)}</div></div>`}
      ${owner ? `<div class="pb row adm-acts" style="gap:8px;flex-wrap:wrap;border-top:1px solid var(--line)">${a.role !== 'owner' ? '<button class="btn primary sm sv">Yetkileri kaydet</button><button class="btn sm allp">Tümünü seç</button><button class="btn sm nonep">Temizle</button>' : ''}<button class="btn sm pwr">${icon('key')} Şifre sıfırla</button>${a.totp && a.id !== S.me.id ? '<button class="btn sm r2f">Doğrulamayı sıfırla</button>' : ''}${a.id !== S.me.id ? `<button class="btn sm ${a.disabled ? '' : 'danger'} dis">${a.disabled ? 'Hesabı aç' : 'Hesabı kapat'}</button><button class="btn sm danger rm">${icon('trash')} Sil</button>` : ''}</div>` : ''}
    </div>`).join('')}</div>
    <div class="grid g2" style="margin-top:14px">
      ${owner ? `<form class="panel add"><div class="ph"><h3>Yönetici ekle</h3></div><div class="pb" style="display:grid;gap:8px">
        <input class="field" name="u" placeholder="Kullanıcı adı" autocapitalize="none"><input class="field" name="n" placeholder="Ad"><input class="field" name="p" type="password" placeholder="Şifre (en az 8 karakter)">
        <select class="field" name="r"><option value="moderator">🛡️ Moderatör (seçtiğin yetkiler)</option><option value="owner">👑 Sahip (tam yetki)</option></select>
        <div class="perms add-perms">${permBoxes(r.modDefault, false)}</div>
        <button class="btn primary">Ekle</button></div></form>` : ''}
      <div class="panel me-sec"><div class="ph"><h3>Hesabım · giriş güvenliği</h3></div><div class="pb" style="display:grid;gap:10px">
        <div class="row" style="gap:8px"><span class="chip ${S.me.totp ? 'ok' : 'warn'}">${S.me.totp ? 'İki adımlı doğrulama açık' : 'İki adımlı doğrulama kurulmadı'}</span><span class="muted">Kurtarma kodu: ${S.me.recoveryLeft ?? 0} tane</span></div>
        <form class="row rcf" style="gap:8px"><input class="field" name="c" inputmode="numeric" maxlength="7" placeholder="Uygulamadaki kod" style="max-width:170px"><button class="btn sm">Kurtarma kodlarını yenile</button></form>
        <div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><b>Google:</b> ${S.me.google ? `<span>${esc(S.me.google)}</span><button type="button" class="btn sm ung">Bağlantıyı kaldır</button>` : '<div class="lkg" style="min-width:240px"></div>'}</div>
        ${CFG?.oauth?.apple ? `<div class="row" style="gap:8px;align-items:center"><b>Apple:</b> ${S.me.apple ? `<span>${esc(S.me.apple)}</span><button type="button" class="btn sm una">Bağlantıyı kaldır</button>` : '<button type="button" class="btn sm lka">Apple hesabını bağla</button>'}</div>` : ''}
        <p class="muted" style="margin:0;font-size:12.5px">Bağlanan Google / Apple hesabıyla şifresiz girersin; doğrulama kodu yine istenir.</p></div></div>
      <div class="panel"><div class="ph"><h3>Şifremi değiştir</h3></div><form class="pb pw" style="display:grid;gap:8px"><input class="field" name="c" type="password" placeholder="Mevcut şifre"><input class="field" name="p" type="password" placeholder="Yeni şifre (en az 8 karakter)"><button class="btn primary">Değiştir</button></form></div>
    </div>`;
  const checked = (box) => [...box.querySelectorAll('.perms input:checked')].map((x) => x.value);
  const add = main.querySelector('.add');
  if (add) { add.r.onchange = () => { add.querySelector('.add-perms').hidden = add.r.value === 'owner'; }; add.onsubmit = async (e) => {
    e.preventDefault();
    try { await api('/admins', { body: { username: add.u.value, name: add.n.value, password: add.p.value, role: add.r.value, perms: checked(add) } }); toast('Yönetici eklendi.'); VIEWS.admins(main); } catch (er) { toast(er.message); }
  }; }
  main.querySelector('.pw').onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    try { const r = await api('/me/password', { body: { current: f.c.value, password: f.p.value } }); toast('Şifren değişti. Diğer cihazlardaki panel oturumların kapandı.'); f.reset(); } catch (er) { toast(er.message); }
  };
  // Hesabım: Google / Apple bağla, kurtarma kodları
  await getCfg();
  const meSec = main.querySelector('.me-sec');
  const relink = (a) => { S.me = { ...S.me, ...a }; VIEWS.admins(main); };
  if (!S.me.google) googleButton(meSec.querySelector('.lkg'), async (c) => { try { relink(await api('/me/oauth', { body: { provider: 'google', credential: c } })); toast('Google hesabın bağlandı.'); } catch (er) { toast(er.message); } }, 'continue_with').then((ok) => { if (!ok) meSec.querySelector('.lkg').textContent = 'Google ile giriş açık değil (GOOGLE_CLIENT_ID).'; }).catch((er) => toast(er.message));
  meSec.querySelector('.ung')?.addEventListener('click', async () => { if (confirm('Google bağlantısı kaldırılsın mı?')) relink(await api('/me/oauth/google', { method: 'DELETE' })); });
  meSec.querySelector('.una')?.addEventListener('click', async () => { if (confirm('Apple bağlantısı kaldırılsın mı?')) relink(await api('/me/oauth/apple', { method: 'DELETE' })); });
  meSec.querySelector('.lka')?.addEventListener('click', async () => { try { const c = await appleCredential(); if (c) { relink(await api('/me/oauth', { body: { provider: 'apple', credential: c } })); toast('Apple hesabın bağlandı.'); } } catch (er) { toast(er.message || 'Apple bağlanamadı.'); } });
  meSec.querySelector('.rcf').onsubmit = async (e) => {
    e.preventDefault();
    try { const r2 = await api('/me/recovery', { body: { code: e.target.c.value } }); S.me.recoveryLeft = r2.recovery.length; showRecovery(r2.recovery, () => render()); } catch (er) { toast(er.message); }
  };
  main.querySelector('.adm-list').onclick = async (e) => {
    const card = e.target.closest('.adm'); if (!card) return; const id = card.dataset.id;
    const put = (body, msg) => api(`/admins/${id}`, { method: 'PUT', body }).then(() => { toast(msg); VIEWS.admins(main); }).catch((er) => toast(er.message));
    if (e.target.closest('.allp')) card.querySelectorAll('.perms input').forEach((x) => { x.checked = true; });
    if (e.target.closest('.nonep')) card.querySelectorAll('.perms input').forEach((x) => { x.checked = false; });
    if (e.target.closest('.sv')) put({ perms: checked(card) }, 'Yetkiler kaydedildi.');
    if (e.target.closest('.dis')) { const a = r.items.find((x) => x.id === id); if (confirm(a.disabled ? 'Hesap açılsın mı?' : 'Bu yönetici panele giremeyecek. Kapatılsın mı?')) put({ disabled: !a.disabled }, 'Kaydedildi.'); }
    if (e.target.closest('.pwr')) {
      const pw = prompt('Yeni şifre (en az 8 karakter):'); if (!pw) return;
      try { await api(`/admins/${id}/password`, { body: { password: pw } }); toast('Şifre değiştirildi. Yeni şifreyi kendisine ilet.'); } catch (er) { toast(er.message); }
    }
    if (e.target.closest('.r2f')) { if (!confirm('Bu yöneticinin doğrulama uygulaması sıfırlansın mı? Panelden çıkarılır; bir sonraki girişte yeniden kurar.')) return; try { await api(`/admins/${id}/reset2fa`, { body: {} }); toast('Doğrulama sıfırlandı.'); VIEWS.admins(main); } catch (er) { toast(er.message); } }
    if (e.target.closest('.rm')) { if (!confirm('Bu yönetici silinsin mi?')) return; try { await api(`/admins/${id}`, { method: 'DELETE' }); VIEWS.admins(main); } catch (er) { toast(er.message); } }
  };
  main.querySelectorAll('.rl').forEach((s) => { s.onchange = () => {
    const id = s.closest('.adm').dataset.id;
    if (s.value === 'owner' && !confirm('Bu kişi sahip olursa her şeye tam yetkisi olur (diğer yöneticileri de yönetebilir). Emin misin?')) { s.value = 'moderator'; return; }
    api(`/admins/${id}`, { method: 'PUT', body: { role: s.value } }).then(() => { toast('Rol değişti.'); VIEWS.admins(main); }).catch((er) => { toast(er.message); VIEWS.admins(main); });
  }; });
};

// ---- Otomatik moderasyon ----
VIEWS.flags = async (main) => {
  let status = 'open';
  main.innerHTML = `${head('Moderasyon', 'Mesajlarda otomatik tespit edilen tehdit ve ağır hakaretler, spam (aynı mesajı çok kişiye atma, yeni hesabın link/telefon yayması, bot gibi kaydırma) ve sahte hesap şüphesi (aynı cihazdan/ağdan çok hesap). Herkese açık metinlerdeki küfürler zaten otomatik yıldızlanır.')}
    <div class="tabs">${[['open', 'Açık'], ['resolved', 'İşlem yapıldı'], ['dismissed', 'Yoksayıldı'], ['all', 'Tümü']].map(([k, l], i) => `<button data-s="${k}" class="${i ? '' : 'on'}">${l}</button>`).join('')}</div>
    <div class="panel lst"><div class="spin"></div></div>`;
  const lst = main.querySelector('.lst');
  const load = async () => {
    const list = await api(`/flags?status=${status}`);
    lst.innerHTML = list.length ? list.map((f) => `<div class="case" data-id="${esc(f.id)}">
      <div class="who">${userCell(f.user)}${f.user ? statusChip(f.user.status) : ''}<span class="arrow">→</span>${f.to.map((u) => `<span class="muted">@${esc(u.username)}</span>`).join(', ')}</div>
      <div class="row" style="flex-wrap:wrap"><span class="chip ${f.level === 'high' ? 'bad' : 'warn'}">${esc(f.reason)}</span><span class="muted">${dt(f.at)}</span>${f.userFlags > 1 ? `<span class="chip bad">Bu kişinin ${f.userFlags} kaydı var</span>` : ''}${f.status !== 'open' ? `<span class="chip">${esc(f.resolution || f.status)} · ${esc(f.by || '')}</span>` : ''}</div>
      <div class="convo">${f.context.length ? f.context.map((m) => `<div class="${m.flagged ? 'hit' : ''}"><b>@${esc(m.from || '?')}</b> ${esc(m.text || '(medya)')} <small class="muted">${dt(m.at)}</small></div>`).join('') : `<div class="hit">${esc(f.text)}</div>`}</div>
      ${f.status === 'open' ? `<div class="acts"><input class="field nt" placeholder="Not / uyarı metni (isteğe bağlı)">
        <button class="btn sm" data-a="dismiss">Yoksay</button><button class="btn sm" data-a="warn">${icon('flag')} Uyar</button><button class="btn sm danger" data-a="delete">${icon('trash')} Mesajı sil</button>
        <button class="btn sm danger" data-a="suspend">7 gün askıya al</button><button class="btn sm solid-danger" data-a="ban">Yasakla</button>
        ${f.user ? `<button class="btn sm" data-u="${esc(f.user.id)}">Profili incele</button>` : ''}</div>` : ''}
    </div>`).join('') : '<div class="empty">Bu listede kayıt yok.</div>';
  };
  main.querySelector('.tabs').onclick = (e) => { const b = e.target.closest('[data-s]'); if (!b) return; status = b.dataset.s; main.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b)); load(); };
  lst.onclick = async (e) => {
    const u = e.target.closest('[data-u]'); if (u) return userDrawer(u.dataset.u, load);
    const b = e.target.closest('[data-a]'); if (!b) return;
    const card = b.closest('.case');
    if (['ban', 'suspend'].includes(b.dataset.a) && !confirm('Bu işlem uygulansın mı?')) return;
    try { await api(`/flags/${card.dataset.id}`, { body: { action: b.dataset.a, note: card.querySelector('.nt').value, days: 7 } }); toast('Kaydedildi.'); load(); refreshCounts(); } catch (er) { toast(er.message); }
  };
  await load();
};

// ---- Profil doğrulama ----
VIEWS.verify = async (main) => {
  let status = 'pending';
  main.innerHTML = `${head('Doğrulama', 'Selfiedeki kişi istenen pozu veriyor ve profil fotoğraflarıyla aynı kişiyse onayla. Onaylanan profile mavi tik gelir.')}
    <div class="tabs">${[['pending', 'Bekleyen'], ['approved', 'Onaylanan'], ['rejected', 'Reddedilen'], ['all', 'Tümü']].map(([k, l], i) => `<button data-s="${k}" class="${i ? '' : 'on'}">${l}</button>`).join('')}</div>
    <div class="lst"><div class="spin"></div></div>`;
  const lst = main.querySelector('.lst');
  const load = async () => {
    const list = await api(`/verifications?status=${status}`);
    lst.innerHTML = list.length ? `<div class="vgrid">${list.map((v) => `<div class="panel vcard" data-id="${esc(v.id)}">
      <div class="ph">${userCell(v.user)}</div>
      <div class="pb"><div class="pose-req">${esc(v.poseInfo.em || '')} <b>İstenen poz:</b> ${esc(v.poseInfo.text)}</div>
        <div class="vimgs"><figure><img src="${esc(v.selfie)}" alt=""><figcaption>Selfie</figcaption></figure>
          ${[v.user?.avatar, ...(v.user?.photos || [])].filter(Boolean).slice(0, 4).map((p) => `<figure><img src="${esc(p)}" alt="" loading="lazy"><figcaption>Profil</figcaption></figure>`).join('')}</div>
        ${v.ai ? (v.ai.error ? `<div class="vai muted">Yapay zeka kontrolü yapılamadı: ${esc(v.ai.error)}</div>` : `<div class="vai ${v.ai.pose && v.ai.live && v.ai.same ? 'ok' : 'warn'}"><b>Yapay zeka:</b> Poz ${v.ai.pose ? '✅' : '❌'} · Canlı ${v.ai.live ? '✅' : '❌'} · Aynı kişi ${v.ai.same === null ? '❔' : v.ai.same ? '✅' : '❌'} · Güven %${Math.round(v.ai.confidence * 100)}${v.ai.note ? `<div class="muted">${esc(v.ai.note)}</div>` : ''}</div>`) : ''}
        <div class="muted" style="font-size:12px">${dt(v.at)}${v.status !== 'pending' ? ` · ${v.status === 'approved' ? 'Onaylandı' : 'Reddedildi'} (${esc(v.by || '')})${v.note ? ` · ${esc(v.note)}` : ''}` : ''}</div>
        ${v.status === 'pending' ? `<div class="acts"><input class="field nt" placeholder="Ret nedeni (kullanıcı görür)"><button class="btn sm ok" data-ok="1">${icon('check')} Onayla</button><button class="btn sm danger" data-ok="0">Reddet</button></div>` : ''}
      </div></div>`).join('')}</div>` : '<div class="panel"><div class="empty">Bu listede başvuru yok.</div></div>';
  };
  main.querySelector('.tabs').onclick = (e) => { const b = e.target.closest('[data-s]'); if (!b) return; status = b.dataset.s; main.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b)); load(); };
  lst.onclick = async (e) => {
    const b = e.target.closest('[data-ok]'); if (!b) return;
    const card = b.closest('[data-id]');
    try { await api(`/verifications/${card.dataset.id}`, { body: { approve: b.dataset.ok === '1', note: card.querySelector('.nt').value } }); toast(b.dataset.ok === '1' ? 'Mavi tik verildi.' : 'Reddedildi.'); load(); refreshCounts(); } catch (er) { toast(er.message); }
  };
  await load();
};

// ---- Siparişler (havale/EFT) ----
const OST = { pending: ['warn', 'Ödeme bekleniyor'], paid: ['info', 'Ödendi bildirildi'], approved: ['ok', 'Onaylandı'], rejected: ['bad', 'Reddedildi'], cancelled: ['', 'İptal'], refunded: ['bad', 'İade edildi'] };
VIEWS.orders = async (main) => {
  let status = 'open';
  main.innerHTML = `${head('Siparişler', 'Havale/EFT siparişleri. Banka hesabına gelen ödemeyi açıklamadaki sipariş koduyla eşleştirip onayla; jeton ya da üyelik anında tanımlanır ve gelir olarak kaydedilir.')}
    <div class="stats sm sum"></div>
    <div class="panel mh-panel"><div class="pb row" style="gap:8px;flex-wrap:wrap;align-items:flex-end">
      <span class="grow"><b>Muhasebe dökümü</b><div class="muted" style="font-size:12.5px">e-Arşiv fatura için onaylanan satışlar ve iadeler (KDV ayrıştırılmış, Excel uyumlu). Alıcı bilgisi içerdiği için indirme kayda geçer.</div></span>
      <label class="muted" style="font-size:12px">Başlangıç<input class="field" type="date" name="mf" value="${ymd(new Date(Date.now() - 30 * 86400000))}"></label>
      <label class="muted" style="font-size:12px">Bitiş<input class="field" type="date" name="mt" value="${today()}"></label>
      <label class="muted" style="font-size:12px">KDV %<input class="field" type="number" name="mk" value="20" min="0" max="30" style="width:80px"></label>
      <button class="btn sm mh-dl">${icon('download')} İndir</button></div></div>
    <div class="panel rv-p" hidden style="margin-bottom:14px"><div class="ph"><h3>İade incelemeleri <span class="chip bad rv-n"></span></h3><span class="muted" style="font-size:12.5px">Mağazadan iade alınan jetonların harcanmış kısmı</span></div><div class="pb rv-b"></div></div>
    <div class="tabs">${[['open', 'Bekleyen'], ['approved', 'Onaylanan'], ['store', 'App Store / Google Play'], ['havale', 'Havale/EFT'], ['refunded', 'İade edilen'], ['rejected', 'Reddedilen'], ['all', 'Tümü']].map(([k, l], i) => `<button data-s="${k}" class="${i ? '' : 'on'}">${l}</button>`).join('')}</div>
    <div class="panel"><div class="tw lst"><div class="spin"></div></div></div>`;
  const lst = main.querySelector('.lst');
  const mh = main.querySelector('.mh-panel');
  // Mağaza iadesi: harcanmış jetonlar borç yazıldı; hediye olarak gittiyse alıcının kazancı ödeme öncesi kontrol edilir
  const rv = main.querySelector('.rv-p');
  const rvPaint = (r) => {
    rv.hidden = !r.items.length; if (!r.items.length) return;
    rv.querySelector('.rv-n').textContent = r.open;
    rv.querySelector('.rv-b').innerHTML = `<p class="muted" style="font-size:12.5px;margin:0 0 10px">Kullanıcı App Store / Google Play’den iade aldığında satın aldığı jetonlar geri alınır. Önceden harcadığı kısım <b>borç</b> olarak yazılır: borç kapanana kadar jeton harcayamaz, yeni jetonları önce borcu kapatır. Harcadığı jetonlar hediye olarak birine gittiyse o kişinin kazancı aşağıda; ödeme yapmadan önce kontrol et, gerekirse kazançtan düş.</p>
      ${r.items.map((x) => `<div class="rv" data-id="${esc(x.id)}" style="border-top:1px solid var(--line);padding:10px 0">
        <div class="row" style="gap:8px;flex-wrap:wrap"><b>@${esc(x.user?.username || '?')}</b><span class="muted">${esc(x.title)} · ${x.channel === 'apple' ? 'App Store' : 'Google Play'} iadesi · ${dt(x.at)}</span><span class="grow"></span>
          <span class="chip">${x.taken} jeton geri alındı</span><span class="chip bad">${x.debt} jeton borç${x.user && x.user.debt !== x.debt ? ` (şu an ${x.user.debt})` : ''}</span></div>
        ${x.recipients.length ? `<table class="tbl" style="margin-top:6px"><thead><tr><th>Hediyeyi alan</th><th class="num">İadeden sonraki hediyeler</th><th class="num">Bekleyen kazancı</th><th></th></tr></thead><tbody>${x.recipients.map((y) => `<tr><td>@${esc(y.username)}${y.payoutPending ? ' <span class="chip warn">ödeme talebi bekliyor</span>' : ''}</td><td class="num">${tl(y.amount)}</td><td class="num">${tl(y.earnings)}</td>
          <td>${y.deducted != null ? `<span class="chip ok">${tl(y.deducted)} düşüldü</span>` : x.status === 'open' ? `<button class="btn sm danger rv-cut" data-u="${esc(y.userId)}">Kazançtan düş</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="muted" style="font-size:12.5px;margin:6px 0 0">Harcanan jetonlar başka birine kazanç olarak gitmemiş (boost, fal, oyun vb.).</p>'}
        ${x.status === 'open' ? `<div class="row" style="gap:6px;margin-top:8px"><button class="btn sm rv-close">İncelemeyi kapat</button>${x.user?.debt ? '<button class="btn sm rv-forgive">Borcu sil</button>' : ''}</div>` : `<div class="muted" style="font-size:12px;margin-top:6px">${x.status === 'closed' ? `Kapatıldı${x.by ? ` · ${esc(x.by)}` : ''}` : 'Bilgi'}</div>`}</div>`).join('')}`;
  };
  const rvLoad = () => api('/refundreviews?status=open').then(rvPaint).catch(() => {});
  rvLoad();
  rv.onclick = async (e) => {
    const box = e.target.closest('[data-id]'); if (!box) return; const id = box.dataset.id;
    try {
      if (e.target.closest('.rv-cut')) { if (!confirm('Bu kişinin bekleyen kazancından, iade edilen jetonlardan gelen kısım düşülsün mü? Kişiye bildirim gider.')) return; await api(`/refundreviews/${id}`, { body: { action: 'deduct', userId: e.target.closest('.rv-cut').dataset.u } }); toast('Düşüldü.'); }
      else if (e.target.closest('.rv-close')) { await api(`/refundreviews/${id}`, { body: { action: 'close' } }); toast('Kapatıldı.'); }
      else if (e.target.closest('.rv-forgive')) { if (!confirm('Kullanıcının jeton borcu silinsin mi?')) return; await api(`/refundreviews/${id}`, { body: { action: 'forgive' } }); toast('Borç silindi.'); }
      else return;
      rvLoad();
    } catch (er) { toast(er.message); }
  };
  mh.querySelector('.mh-dl').onclick = () => { const v = (n) => mh.querySelector(`[name=${n}]`).value; download(`/muhasebe.csv?from=${v('mf')}&to=${v('mt')}&kdv=${v('mk')}`, `muhasebe-${v('mf')}_${v('mt')}.csv`); };
  const load = async () => {
    const r = await api(`/orders?status=${status}`);
    const mb = r.monthBy || {};
    main.querySelector('.sum').innerHTML = `<div class="stat"><b class="money in">${tl(r.monthTotal)}</b><span>Bu ay onaylanan satış</span></div><div class="stat"><b>${r.monthCount}</b><span>Bu ay sipariş</span></div>
      <div class="stat"><b class="money">${tl(mb.havale || 0)}</b><span>Havale/EFT</span></div><div class="stat"><b class="money">${tl(mb.apple || 0)}</b><span>App Store</span></div><div class="stat"><b class="money">${tl(mb.google || 0)}</b><span>Google Play</span></div>`;
    lst.innerHTML = r.items.length ? `<table class="tbl"><thead><tr><th>Kod</th><th>Kullanıcı</th><th>Ürün</th><th class="num">Tutar</th><th>Ödeme / gönderen</th><th>Tarih</th><th>Durum</th><th></th></tr></thead><tbody>
      ${r.items.map((o) => `<tr data-id="${esc(o.id)}" ${o.cart ? `data-cart="${esc(o.cart)}" data-st="${esc(o.status)}" data-amt="${o.amount}"` : ''}><td><b class="mono">${esc(o.code)}</b>${o.cart ? `<div class="muted" style="font-size:11.5px">Sepet <b class="mono">${esc(o.cart)}</b>${o.cartPct ? ` · %${o.cartPct} indirim` : ''}</div>` : ''}</td><td>${userCell(o.user)}</td><td>${esc(o.title)}</td><td class="num"><b>${tl(o.amount)}</b>${o.listPrice > o.amount ? `<div class="muted" style="font-size:11px"><s>${tl(o.listPrice)}</s></div>` : ''}</td><td>${o.channel ? `<span class="chip ${o.channel === 'apple' ? 'info' : 'ok'}">${o.channel === 'apple' ? 'App Store' : 'Google Play'}</span>` : esc(o.sender || '—')}</td><td>${dt(o.paidAt || o.at)}</td>
        <td>${o.channel && o.status === 'approved' ? `<span class="chip ok">Otomatik onaylandı</span><div class="muted" style="font-size:11.5px">${o.channel === 'apple' ? 'App Store' : 'Google Play'} ödemeyi doğruladı${o.test ? ' · <b>deneme satın alması (para çekilmedi)</b>' : ''}</div>` : `<span class="chip ${OST[o.status][0]}">${o.status === 'refunded' && o.channel ? `${o.channel === 'apple' ? 'App Store' : 'Google Play'} iadesi` : OST[o.status][1]}</span>`}${o.note ? `<div class="muted" style="font-size:11.5px">${esc(o.note)}</div>` : ''}${o.refundDebt ? `<div class="muted" style="font-size:11.5px">${o.refundTaken} jeton geri alındı · ${o.refundDebt} jeton harcanmıştı, borç yazıldı</div>` : ''}${o.cartBonus ? '<div class="muted" style="font-size:11.5px">Sepet kampanyası hediyesi verildi</div>' : ''}</td>
        <td>${['pending', 'paid'].includes(o.status) ? `<div class="row"><button class="btn sm ok" data-ok="1">${icon('check')} Onayla</button><button class="btn sm danger" data-ok="0">Reddet</button></div>` : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Bu listede sipariş yok.</div>';
  };
  main.querySelector('.tabs').onclick = (e) => { const b = e.target.closest('[data-s]'); if (!b) return; status = b.dataset.s; main.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b)); load(); };
  lst.onclick = async (e) => {
    const b = e.target.closest('[data-ok]'); if (!b) return;
    const row = b.closest('[data-id]'); const id = row.dataset.id;
    const ok = b.dataset.ok === '1';
    // Sepet siparişi: aynı sepet kodundaki bütün açık siparişler tek havaleyle ödenir, birlikte sonuçlanır
    const group = row.dataset.cart ? [...lst.querySelectorAll(`[data-cart="${CSS.escape(row.dataset.cart)}"]`)].filter((x) => ['pending', 'paid'].includes(x.dataset.st)) : [row];
    const sum = group.reduce((a, x) => a + (+x.dataset.amt || 0), 0);
    let note = '';
    if (ok && !confirm(group.length > 1 ? `Sepet ${row.dataset.cart}: ${group.length} siparişin toplamı ${tl(sum)}. Bu tutar banka hesabına ulaştı mı? Onaylanınca hepsi kullanıcıya tanımlanır.` : 'Ödeme banka hesabına ulaştı mı? Onaylanınca ürün kullanıcıya tanımlanır.')) return;
    if (!ok) { note = prompt(group.length > 1 ? `Sepetteki ${group.length} sipariş reddedilecek. Ret nedeni (kullanıcı görür):` : 'Ret nedeni (kullanıcı görür):', 'Ödeme hesabımıza ulaşmadı.'); if (note === null) return; }
    try { for (const x of group) await api(`/orders/${x.dataset.id}`, { body: { approve: ok, note } }); toast(ok ? `Onaylandı, kullanıcıya tanımlandı${group.length > 1 ? ` (${group.length} sipariş)` : ''}.` : 'Reddedildi.'); load(); refreshCounts(); } catch (er) { toast(er.message); load(); }
  };
  await load();
};

// ---- SwipeUp Store ----
const MST = {
  odeme_bekliyor: ['', 'Ödeme bekleniyor'], odeme_kontrol: ['warn', 'Ödeme bildirildi'], odendi: ['info', 'Emanette · kargo bekleniyor'], kargoda: ['info', 'Kargoda'],
  bulusma: ['info', 'Elden · buluşma'], teslim_onay: ['warn', 'Elden · onay bekliyor'], sorunlu: ['bad', 'Sorun bildirildi'], iade_bekliyor: ['bad', 'İade yapılacak'],
  iade_edildi: ['', 'İade edildi'], tamamlandi: ['ok', 'Tamamlandı'], iptal: ['', 'İptal'],
};
const MACTS = {
  odeme_kontrol: [['confirm_payment', 'Ödeme geldi', 'ok'], ['reject_payment', 'Ödeme yok', 'danger']],
  odendi: [['refund', 'İptal et, iade', 'danger']],
  kargoda: [['release', 'Teslimi onayla, satıcıya öde', 'ok'], ['refund', 'Alıcıya iade', 'danger']],
  teslim_onay: [['release', 'Teslimi onayla', 'ok'], ['refund', 'Siparişi iptal et', 'danger']],
  sorunlu: [['release', 'Satıcı haklı · satıcıya öde', 'ok'], ['refund', 'Alıcı haklı · iade', 'danger']],
  iade_bekliyor: [['refunded', 'İadeyi yaptım', 'ok']],
};
const MCONFIRM = {
  confirm_payment: 'Bu tutar SwipeUp hesabına açıklamada sipariş koduyla ulaştı mı? Onaylayınca satıcıya "kargola" bildirimi gider.',
  release: 'Sipariş satıcı lehine kapanacak ve tutar satıcının Store bakiyesine geçecek. Emin misin?',
  refund: 'Sipariş alıcı lehine kapanacak. Kargolu siparişlerde tutarı alıcının IBAN’ına iade etmen gerekecek. Emin misin?',
  refunded: 'Tutarı alıcının IBAN’ına gönderdin mi?',
};
VIEWS.market = async (main) => {
  let tab = 'action'; let q = '';
  const pics = (t, arr) => (arr?.length ? `<div class="mkev"><span>${t}</span>${arr.map((u) => `<a href="${esc(u)}" target="_blank"><img src="${esc(u)}" alt=""></a>`).join('')}</div>` : '');
  main.innerHTML = `${head('SwipeUp Store', 'İkinci el pazar · komisyon yok. Kargolu siparişlerde alıcı tutarı SwipeUp hesabına havale eder; ödemeyi onaylayınca para emanete alınır, alıcı teslim aldığını onaylayınca (ya da süre dolunca) satıcının Store bakiyesine geçer. Satıcı ödemeleri <a href="#/payouts">Kazançlar</a> bölümünde.')}
    <div class="mvis"></div>
    <div class="stats sm sum"></div>
    <div class="row" style="gap:10px;flex-wrap:wrap;margin-bottom:12px"><div class="tabs mtabs" style="margin:0"></div><input class="field mq" placeholder="Kod, ürün, kullanıcı ya da takip kodu ara" style="max-width:320px"></div>
    <div class="panel"><div class="tw lst"><div class="spin"></div></div></div>
    <div class="msettings"></div>`;
  const lst = main.querySelector('.lst');
  const TABS = [['action', 'İşlem bekleyen'], ['emanet', 'Emanette'], ['elden', 'Elden'], ['bekleyen', 'Ödeme bekleyen'], ['biten', 'Bitenler'], ['tumu', 'Tümü'], ['items', 'İlanlar']];
  let rows = [];
  const load = async () => {
    const r = await api(`/market?tab=${tab === 'items' ? 'action' : tab}&q=${encodeURIComponent(q)}`);
    const s = r.stats;
    const vis = !!r.settings.enabled;
    main.querySelector('.mvis').innerHTML = `<div class="panel mvisp ${vis ? 'on' : ''}"><div class="pb row" style="gap:12px;flex-wrap:wrap">
      <span class="dot"></span><div class="grow"><b>${vis ? 'Store uygulamada görünüyor' : 'Store uygulamada gizli'}</b><div class="muted" style="font-size:12.5px">${vis ? 'Kullanıcılar ana sayfadaki kartla ve Ayarlar’dan Store’a girebiliyor.' : 'Ana sayfa kartı, Ayarlar bağlantısı ve Store sayfaları kullanıcılara kapalı. İlanlar, siparişler ve bakiyeler silinmedi; açınca kaldığı yerden devam eder.'}</div></div>
      ${can('market') ? `<button class="btn ${vis ? '' : 'primary'} mvt">${vis ? 'Gizle' : 'Uygulamada göster'}</button>` : ''}</div></div>`;
    main.querySelector('.mvt')?.addEventListener('click', async () => {
      if (!confirm(vis ? 'Store uygulamadan gizlensin mi? Açık siparişler panelden yönetilmeye devam eder.' : 'Store tüm kullanıcılara açılsın mı?')) return;
      try { await api('/market/visibility', { method: 'PUT', body: { enabled: !vis } }); toast(vis ? 'Store gizlendi.' : 'Store yayında!'); load(); } catch (er) { toast(er.message); }
    });
    main.querySelector('.sum').innerHTML = `<div class="stat"><b>${s.active}</b><span>Aktif ilan</span></div><div class="stat"><b class="money">${tl(s.heldTL)}</b><span>Emanette (${s.heldCount} sipariş)</span></div>
      <div class="stat"><b class="money in">${tl(s.monthTL)}</b><span>Bu ay tamamlanan (${s.monthCount})</span></div><div class="stat"><b class="money">${tl(s.balancesTL)}</b><span>Satıcı bakiyeleri</span></div>
      <div class="stat ${s.payoutsPending ? 'alert' : ''}"><b>${s.payoutsPending}</b><span>Bekleyen satıcı ödemesi</span>${s.payoutsPending ? '<a href="#/payouts">Görüntüle</a>' : ''}</div>`;
    main.querySelector('.mtabs').innerHTML = TABS.map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${l}${k !== 'items' && s.counts[k] ? ` <span class="tc">${s.counts[k]}</span>` : ''}</button>`).join('');
    if (can('market') && !main.querySelector('.msettings form')) {
      main.querySelector('.msettings').innerHTML = `<form class="panel eco" style="margin-top:14px;max-width:640px"><div class="ph"><h3>Store kuralları</h3></div><div class="pb fgrid">
        <label>Satıcının kargolama süresi (gün)<input class="field" type="number" name="shipDays" value="${r.settings.shipDays}"></label>
        <label>Kargodan sonra otomatik teslim onayı (gün)<input class="field" type="number" name="autoDays" value="${r.settings.autoDays}"></label>
        <label>En az ödeme talebi (₺)<input class="field" type="number" name="minPayout" value="${r.settings.minPayout}"></label>
        <button class="btn primary" style="justify-self:start">${icon('check')} Kaydet</button></div></form>`;
      main.querySelector('.msettings form').onsubmit = async (e) => { e.preventDefault(); const f = e.target; try { await api('/market/settings', { method: 'PUT', body: { shipDays: f.shipDays.value, autoDays: f.autoDays.value, minPayout: f.minPayout.value } }); toast('Store kuralları kaydedildi.'); } catch (er) { toast(er.message); } };
    }
    if (tab === 'items') return loadItems();
    rows = r.orders;
    lst.innerHTML = rows.length ? `<table class="tbl"><thead><tr><th>Kod</th><th>Ürün</th><th>Alıcı</th><th>Satıcı</th><th class="num">Tutar</th><th>Durum</th><th>Tarih</th><th></th></tr></thead><tbody>
      ${rows.map((o) => `<tr data-id="${esc(o.id)}" class="mrow"><td><b class="mono">${esc(o.code)}</b><div class="muted" style="font-size:11.5px">${o.method === 'kargo' ? '📦 Kargo' : '🤝 Elden'}</div></td>
        <td><div class="row"><img class="av sq" src="${esc(o.photo)}" alt=""><span class="ell" style="max-width:180px">${esc(o.title)}</span></div></td>
        <td>${userCell(o.buyer)}</td><td>${userCell(o.seller)}</td><td class="num"><b>${tl(o.amount)}</b></td>
        <td><span class="chip ${MST[o.status][0]}">${MST[o.status][1]}</span></td><td>${dt(o.at)}</td>
        <td><div class="row" style="gap:6px;flex-wrap:wrap">${(MACTS[o.status] || []).filter(([a]) => !(o.method === 'elden' && a === 'refunded')).map(([a, l, c]) => `<button class="btn sm ${c}" data-a="${a}">${l}</button>`).join('')}<button class="btn sm det">Ayrıntı</button></div></td></tr>
        <tr class="mdet" data-for="${esc(o.id)}" hidden><td colspan="8"><div class="mdbox">
          <div class="mdcol"><b>Sipariş</b>${o.method === 'kargo' ? `<div>Ürün ${tl(o.price)} + kargo ${tl(o.shipFee)} (${o.shipPayer === 'satici' ? 'satıcı öder' : 'alıcı öder'})</div>` : '<div>Elden teslim · ödeme yüz yüze</div>'}
            ${o.sender ? `<div>Gönderen: <b>${esc(o.sender)}</b></div>` : ''}${o.buyerIban ? `<div>İade IBAN: <b class="mono">${esc(o.buyerIban)}</b></div>` : ''}
            ${o.address ? `<div>Adres: ${esc(o.address.name)} · ${esc(o.address.phone)}<br>${esc(o.address.text)}</div>` : ''}
            ${o.tracking ? `<div>Kargo: <b>${esc(o.carrierName || '')}</b> <span class="mono">${esc(o.tracking)}</span> ${o.trackUrl ? `<a href="${esc(o.trackUrl)}" target="_blank">takip</a>` : ''}</div>` : ''}
            ${o.problem ? `<div class="mprob"><b>Sorun:</b> ${esc(o.problem.text)}</div>` : ''}</div>
          <div class="mdcol">${pics('Paketin içi', o.packInside)}${pics('Paketin dışı', o.packOutside)}${pics('Satıcı teslim', o.sellerPhoto)}${pics('Alıcı teslim', o.buyerPhoto)}${pics('Sorun fotoğrafları', o.problem?.photos)}</div>
          <div class="mdcol mlog"><b>Geçmiş</b>${(o.log || []).slice().reverse().map((l) => `<div><span class="muted">${dt(l.at)}</span> ${esc(l.text)}</div>`).join('')}</div>
        </div></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Bu listede sipariş yok.</div>';
  };
  const loadItems = async () => {
    const items = await api(`/market/items?status=all&q=${encodeURIComponent(q)}`);
    const IST = { active: ['ok', 'Yayında'], reserved: ['warn', 'Rezerve'], sold: ['info', 'Satıldı'], removed: ['', 'Kaldırıldı'] };
    lst.innerHTML = items.length ? `<table class="tbl"><thead><tr><th>İlan</th><th>Satıcı</th><th class="num">Fiyat</th><th>Durum</th><th class="num">Görüntülenme</th><th>Şikayet</th><th>Tarih</th><th></th></tr></thead><tbody>
      ${items.map((i) => `<tr data-item="${esc(i.id)}"><td><div class="row"><img class="av sq" src="${esc(i.photo)}" alt=""><div class="grow"><div class="ell" style="max-width:240px"><b>${esc(i.title)}</b></div><div class="muted ell" style="max-width:240px;font-size:12px">${esc(i.desc || '')}</div></div></div></td>
        <td>${userCell(i.seller)}</td><td class="num"><b>${tl(i.price)}</b></td><td><span class="chip ${IST[i.status]?.[0] || ''}">${IST[i.status]?.[1] || i.status}</span></td><td class="num">${i.views}</td>
        <td>${i.reports ? `<span class="chip bad">${i.reports}</span>` : '—'}</td><td>${dt(i.at)}</td>
        <td>${['active'].includes(i.status) ? `<button class="btn sm danger" data-rm="1">${icon('trash')} Kaldır</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">İlan yok.</div>';
  };
  main.querySelector('.mtabs').onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b) return; tab = b.dataset.t; load(); };
  let qt = null;
  main.querySelector('.mq').oninput = (e) => { clearTimeout(qt); qt = setTimeout(() => { q = e.target.value.trim(); load(); }, 300); };
  lst.onclick = async (e) => {
    const det = e.target.closest('.det');
    if (det) { const id = det.closest('[data-id]').dataset.id; const r = lst.querySelector(`.mdet[data-for="${CSS.escape(id)}"]`); r.hidden = !r.hidden; return; }
    const rm = e.target.closest('[data-rm]');
    if (rm) {
      const id = rm.closest('[data-item]').dataset.item;
      const reason = prompt('Kaldırma nedeni (satıcı görür):', 'Topluluk kurallarına aykırı ilan'); if (reason === null) return;
      try { await api(`/market/items/${id}/remove`, { body: { reason } }); toast('İlan kaldırıldı.'); load(); } catch (er) { toast(er.message); }
      return;
    }
    const b = e.target.closest('[data-a]'); if (!b) return;
    const id = b.closest('[data-id]').dataset.id; const a = b.dataset.a;
    const o = rows.find((x) => x.id === id);
    if (MCONFIRM[a] && !confirm(MCONFIRM[a] + (a === 'refunded' && o?.buyerIban ? `\n\nIBAN: ${o.buyerIban}\nTutar: ${tl(o.amount)}` : ''))) return;
    let note = '';
    if (['reject_payment', 'refund', 'release'].includes(a)) { note = prompt('Not (iki taraf da görür, isteğe bağlı):', a === 'reject_payment' ? 'Ödeme hesabımıza ulaşmadı.' : ''); if (note === null) return; }
    try { await api(`/market/orders/${id}`, { body: { action: a, note } }); toast('İşlem tamam.'); load(); refreshCounts(); } catch (er) { toast(er.message); }
  };
  await load();
};

// ---- Bakım modu ----
VIEWS.maintenance = async (main) => {
  const m = await api('/maintenance');
  const owner = can('maintenance');
  const p = m.plan;
  const dtl2 = (ms) => { if (!ms) return ''; const x = new Date(ms); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
  const REM = [[0, 'Hatırlatma yok'], [15, '15 dakika önce'], [30, '30 dakika önce'], [60, '1 saat önce'], [120, '2 saat önce'], [1440, '1 gün önce']];
  const left = (t) => { const d = t - Date.now(); if (d <= 0) return 'şimdi'; const h = Math.floor(d / 3600000); const mi = Math.round((d % 3600000) / 60000); return h >= 24 ? `${Math.floor(h / 24)} gün ${h % 24} saat sonra` : h ? `${h} saat ${mi} dk sonra` : `${mi} dk sonra`; };
  const def = new Date(); def.setDate(def.getDate() + 1); def.setHours(3, 0, 0, 0);
  const planPanel = () => {
    if (p && !p.started) {
      return `<div class="panel maintp" style="max-width:640px"><div class="ph"><h3>${icon('timer')} Planlı bakım</h3><span class="chip warn">${esc(left(p.start))}</span></div><div class="pb" style="display:grid;gap:10px">
        <div class="kv"><span>Başlangıç</span><b>${dt(p.start)}</b></div>
        <div class="kv"><span>Bitiş</span><b>${p.end ? `${dt(p.end)}${p.autoEnd ? ' · otomatik açılır' : ''}` : 'Elle bitirilecek'}</b></div>
        ${p.message ? `<div class="kv"><span>Mesaj</span><b>${esc(p.message)}</b></div>` : ''}
        <div class="kv"><span>Duyuru</span><b>${p.announced ? `${dt(p.announced)} · ${p.reach} kişiye gönderildi` : 'Gönderilmedi'}</b></div>
        <div class="kv"><span>Hatırlatma</span><b>${p.remind ? `${(REM.find((r) => r[0] === p.remind) || [0, ''])[1]}${p.reminded ? ' · gönderildi' : ''}` : 'Yok'}</b></div>
        <div class="kv"><span>Bildirimler</span><b>${[p.notifyStart && 'başlarken', p.notifyEnd && p.end && 'bitince'].filter(Boolean).join(', ') || 'yok'}</b></div>
        <p class="muted" style="margin:0;font-size:12.5px">Zamanı gelince uygulama kendiliğinden bakıma girer; uygulamada ana sayfada “Planlı bakım” kartı görünür.</p>
        ${owner ? `<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn" data-edit>Düzenle</button><button class="btn danger" data-cancel>Planı iptal et</button></div>` : ''}
      </div></div>`;
    }
    return '';
  };
  const planForm = (x) => `<form class="panel maintf planf" style="max-width:640px" ${p && !p.started && !x ? 'hidden' : ''}><div class="ph"><h3>${icon('timer')} İleri tarihli bakım planla</h3></div><div class="pb" style="display:grid;gap:14px">
      <div class="grid g2" style="gap:12px">
        <label class="fl">Başlangıç<input class="field" type="datetime-local" name="start" value="${dtl2(x?.start || def.getTime())}" min="${dtl2(Date.now())}"></label>
        <label class="fl">Bitiş (isteğe bağlı)<input class="field" type="datetime-local" name="end" value="${dtl2(x?.end || def.getTime() + 3600000)}"></label>
      </div>
      <label class="fl">Kullanıcılara gösterilecek mesaj<textarea class="field" name="message" rows="2" maxlength="300" placeholder="ör. Sunucu güncellemesi yapıyoruz.">${esc(x?.message || '')}</textarea></label>
      <label class="fl">Hatırlatma bildirimi<select class="field" name="remind">${REM.map(([v, l]) => `<option value="${v}" ${(x ? x.remind : 30) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="checks">
        <label><input type="checkbox" name="announce" checked> Şimdi tüm kullanıcılara duyur <span class="muted">(${m.users} kişi, telefon bildirimi + uygulama içi)</span></label>
        <label><input type="checkbox" name="notifyStart" ${x && !x.notifyStart ? '' : 'checked'}> Bakım başlayınca bildirim gönder</label>
        <label><input type="checkbox" name="notifyEnd" ${x && !x.notifyEnd ? '' : 'checked'}> Bakım bitince “yeniden açıldık” bildirimi gönder</label>
        <label><input type="checkbox" name="autoEnd" ${x && !x.autoEnd ? '' : 'checked'}> Bitiş saatinde uygulamayı otomatik aç</label>
      </div>
      <div class="preview muted" style="font-size:12.5px"></div>
      ${owner ? `<div class="row" style="gap:8px"><button class="btn primary" data-plan>${icon('check')} ${x ? 'Planı güncelle' : 'Bakımı planla'}</button>${x ? '<button type="button" class="btn" data-close>Vazgeç</button>' : ''}</div>` : '<p class="muted">Bakım planını sadece sahip yönetici yapabilir.</p>'}
    </div></form>`;
  main.innerHTML = `${head('Bakım modu', 'Açıkken kullanıcılar uygulamaya giremez ve “Bakımdayız” ekranını görür; açık oturumlar hemen kapanır. Yönetim paneli çalışmaya devam eder. Kapatınca uygulama herkeste kendiliğinden geri açılır.')}
    <div style="display:grid;gap:16px">
    <form class="panel maintf now ${m.on ? 'on' : ''}" style="max-width:640px"><div class="pb" style="display:grid;gap:14px">
      <div class="mstate"><span class="dot"></span><div><b>${m.on ? 'Bakım modu AÇIK' : 'Uygulama açık'}</b><div class="muted">${m.on ? `${dt(m.at)} tarihinde ${esc(m.by || '')} açtı. Kullanıcılar şu an giremiyor.${m.planId && p?.autoEnd && p.end ? ` ${dt(p.end)} tarihinde otomatik açılacak.` : ''}` : 'Kullanıcılar uygulamayı normal kullanıyor.'}</div></div></div>
      <label class="fl">Kullanıcılara gösterilecek mesaj<textarea class="field" name="message" rows="3" maxlength="300" placeholder="ör. Yeni özellikler için kısa bir bakım yapıyoruz. 30 dakika içinde döneceğiz.">${esc(m.message || '')}</textarea></label>
      <label class="fl">Tahmini dönüş (isteğe bağlı)<input class="field" type="datetime-local" name="until" value="${dtl2(m.until)}"></label>
      <div class="checks"><label><input type="checkbox" name="notify" checked> ${m.on ? 'Bitirince kullanıcılara “yeniden açıldık” bildirimi gönder' : 'Kullanıcılara bakım bildirimi gönder'}</label></div>
      ${owner ? `<div class="row" style="gap:8px;flex-wrap:wrap">${m.on
    ? `<button class="btn ok" data-on="0">${icon('check')} Bakımı bitir, uygulamayı aç</button><button class="btn" data-on="1">Mesajı güncelle</button>`
    : `<button class="btn danger" data-on="1">${icon('timer')} Bakım modunu şimdi aç</button>`}</div>` : '<p class="muted">Bakım modunu sadece sahip yönetici açıp kapatabilir.</p>'}
    </div></form>
    ${planPanel()}
    ${m.on ? '' : planForm(null)}
    </div>`;
  const now = main.querySelector('form.now');
  now.onclick = async (e) => {
    const b = e.target.closest('[data-on]'); if (!b) return;
    e.preventDefault();
    const on = b.dataset.on === '1';
    if (on && !m.on && !confirm('Bakım modu şimdi açılsın mı? Uygulamadaki herkesin oturumu hemen kapanacak.')) return;
    try {
      await api('/maintenance', { method: 'PUT', body: { on, message: now.message.value, until: now.until.value ? new Date(now.until.value).getTime() : null, notify: now.notify.checked } });
      toast(on ? 'Bakım modu açık.' : 'Bakım bitti, uygulama açıldı.'); refreshCounts(); render();
    } catch (er) { toast(er.message); }
  };
  const wirePlan = (f) => {
    if (!f) return;
    const prev = () => {
      const st = f.start.value ? new Date(f.start.value) : null; const en = f.end.value ? new Date(f.end.value) : null;
      f.querySelector('.preview').textContent = st ? `Duyuru metni: “🛠️ Planlı bakım: ${st.toLocaleString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}${en ? `–${en.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} arasında SwipeUp kullanılamayacak.` : ' itibarıyla SwipeUp bir süre bakımda olacak.'}${f.message.value ? ` ${f.message.value}` : ''}”` : '';
      f.autoEnd.disabled = !f.end.value; f.notifyEnd.disabled = !f.end.value && !f.autoEnd.checked;
    };
    f.oninput = prev; prev();
    f.onclick = async (e) => {
      if (e.target.closest('[data-close]')) { e.preventDefault(); render(); return; }
      if (!e.target.closest('[data-plan]')) return;
      e.preventDefault();
      if (!f.start.value) return toast('Başlangıç zamanını seç.');
      const body = {
        start: new Date(f.start.value).getTime(), end: f.end.value ? new Date(f.end.value).getTime() : null, message: f.message.value, remind: +f.remind.value,
        announce: f.announce.checked, notifyStart: f.notifyStart.checked, notifyEnd: f.notifyEnd.checked, autoEnd: f.autoEnd.checked,
      };
      if (body.announce && !confirm(`Bakım planı ${m.users} kullanıcıya bildirim olarak gönderilecek. Devam edilsin mi?`)) return;
      try { await api('/maintenance/plan', { method: 'PUT', body }); toast(body.announce ? 'Bakım planlandı ve kullanıcılara duyuruldu.' : 'Bakım planlandı.'); render(); } catch (er) { toast(er.message); }
    };
  };
  wirePlan(main.querySelector('form.planf'));
  main.querySelector('[data-edit]')?.addEventListener('click', () => {
    const f = main.querySelector('form.planf'); if (!f) return;
    f.outerHTML = planForm(p); const nf = main.querySelector('form.planf'); nf.announce.checked = !!p.announced; wirePlan(nf);
    nf.scrollIntoView({ behavior: 'smooth' });
  });
  main.querySelector('[data-cancel]')?.addEventListener('click', async () => {
    const tell = p.announced ? confirm('Plan iptal edilsin mi?\n\nKullanıcılara önceden duyurulmuştu; iptal bildirimi gönderilecek. (İptal için Tamam)') : confirm('Plan iptal edilsin mi?');
    if (!tell) return;
    try { await api('/maintenance/plan', { method: 'DELETE' }); toast('Bakım planı iptal edildi.'); render(); } catch (er) { toast(er.message); }
  });
};

// ---- Kazançlar ve ödeme talepleri ----
VIEWS.payouts = async (main) => {
  const r = await api('/payouts');
  const PS = { pending: ['warn', 'Bekliyor'], paid: ['ok', 'Ödendi'], rejected: ['bad', 'Reddedildi'] };
  main.innerHTML = `${head('Kazançlar', `Canlı yayın hediyeleri ve ücretli fallardan kullanıcılara kalan pay. Kazanç TL olarak tutulur (1 birim = ${tl(r.coinTL)}); hediye edilen satın alınmış her jetondan yayıncıya pay düşer.`)}
    <div class="grid g2">
      <div class="panel"><div class="ph"><h3>Ödeme talepleri</h3></div><div class="tw">${r.items.length ? `<table class="tbl"><thead><tr><th>Kullanıcı</th><th class="num">Tutar</th><th>IBAN / ad</th><th>Tarih</th><th></th></tr></thead><tbody>
        ${r.items.map((p) => `<tr data-id="${esc(p.id)}"><td>${userCell(p.user)}</td><td class="num"><b>${tl(p.amount)}</b><div class="muted" style="font-size:11.5px">${p.kind === 'store' ? '🛍️ Store satışı' : 'Hediye / fal kazancı'}</div>${p.refundReview && p.status === 'pending' ? '<span class="chip bad" title="Bu kişiye gönderilen hediyelerin bir kısmı, gönderenin mağaza iadesiyle geri alındı. Siparişler → İade incelemeleri.">İade incelemesi var</span>' : ''}</td><td><span class="mono">${esc(p.iban)}</span><div class="muted">${esc(p.name)}</div></td><td>${dt(p.at)}</td>
          <td>${p.status === 'pending' ? `<div class="row"><button class="btn sm ok" data-ok="1">Ödendi</button><button class="btn sm danger" data-ok="0">Reddet</button></div>` : `<span class="chip ${PS[p.status][0]}">${PS[p.status][1]}</span>`}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Ödeme talebi yok.</div>'}</div></div>
      <div class="panel"><div class="ph"><h3>En çok kazananlar</h3></div><div class="tw">${r.earners.length ? `<table class="tbl"><thead><tr><th>Kullanıcı</th><th class="num">Toplam</th><th class="num">Bakiye</th></tr></thead><tbody>
        ${r.earners.map((u) => `<tr><td>${userCell(u)}</td><td class="num">${tl(u.total * r.coinTL)}</td><td class="num">${tl(u.balanceTL)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Henüz kazanç yok.</div>'}</div></div>
    </div>`;
  main.onclick = async (e) => {
    const b = e.target.closest('[data-ok]'); if (!b) return;
    const ok = b.dataset.ok === '1';
    if (ok && !confirm('Bu tutarı kullanıcının IBAN’ına gönderdin mi? Gider olarak kaydedilecek.')) return;
    let note = '';
    if (!ok) { note = prompt('Ret nedeni (kullanıcı görür):', ''); if (note === null) return; }
    try { await api(`/payouts/${b.closest('[data-id]').dataset.id}`, { body: { paid: ok, note } }); toast('Kaydedildi.'); VIEWS.payouts(main); refreshCounts(); } catch (er) { toast(er.message); }
  };
};


// ---- Veritabanı ----
const COL_TR = { users: 'Kullanıcılar', messages: 'Mesajlar', notifications: 'Bildirimler', posts: 'Gönderiler', follows: 'Takipler', swipes: 'Kaydırmalar', matches: 'Eşleşmeler', chats: 'Sohbetler', stories: 'Hikayeler', pub_msgs: 'Genel sohbet', media_meta: 'Medya kayıtları', reports: 'Şikayetler', flags: 'Moderasyon', orders: 'Siparişler', coin_tx: 'Jeton hareketleri', earn_tx: 'Kazanç hareketleri', payouts: 'Ödeme talepleri', verifications: 'Doğrulamalar', blocks: 'Engellemeler', pushSubs: 'Bildirim abonelikleri', appeals: 'İtirazlar', settings: 'Ayarlar', meta: 'Sistem', adm_audit: 'Panel işlem kaydı', adm_ledger: 'Gelir-gider', adm_admins: 'Yöneticiler', adm_announcements: 'Bildirimler (panel)', adm_notes: 'Notlar', resets: 'Şifre sıfırlama', deleted_accounts: 'Silinen hesaplar' };
VIEWS.database = async (main) => {
  const d = await api('/database');
  const name = d.kind === 'postgres' ? (/supabase/.test(d.host || '') ? 'Supabase (PostgreSQL)' : 'PostgreSQL') : d.kind === 'redis' ? 'Render Key Value' : 'Sunucu diski (geçici)';
  const used = d.dbMB ?? d.mediaMB;
  const pct = d.limitMB ? Math.min(100, Math.round((used / d.limitMB) * 100)) : null;
  main.innerHTML = `${head('Veritabanı', 'Uygulama ve yönetim paneli verilerinin tutulduğu yer. Her değişiklik anında buraya yazılır.', can('database') ? `<a class="btn" href="#" data-bk>${icon('download')} Yedek indir</a>` : '')}
    <div class="stats">
      <div class="stat"><b style="font-size:20px">${esc(name)}</b><span>${d.connected ? `<span class="chip ok">Bağlı</span>${d.pingMs != null ? ` · ${d.pingMs} ms` : ''}` : `<span class="chip bad">Bağlantı yok</span> ${esc(d.error || '')}`}</span></div>
      <div class="stat"><b>${d.docs.toLocaleString('tr-TR')}</b><span>Kayıt</span></div>
      <div class="stat"><b>${d.mediaCount}</b><span>Veritabanındaki medya · ${d.mediaMB} MB</span></div>
      <div class="stat"><b>${d.pending}</b><span>Yazılmayı bekleyen</span><span class="muted" style="font-size:11.5px">${d.lastWrite ? `Son yazma ${dt(d.lastWrite)}` : ''}</span></div>
    </div>
    ${pct != null ? `<div class="panel" style="margin-bottom:14px"><div class="pb"><div class="row"><b>Kullanılan alan</b><span class="muted" style="margin-left:auto">${used} MB / ${d.limitMB} MB (ücretsiz plan)</span></div>
      <div class="dbbar"><i style="width:${pct}%;background:${pct > 85 ? 'var(--bad)' : pct > 60 ? 'var(--warn)' : 'var(--ok)'}"></i></div>
      ${d.docsMB != null ? `<div class="muted" style="font-size:12.5px;margin-top:6px">Kayıtlar ${d.docsMB} MB · medya ${d.mediaTableMB} MB${d.version ? ` · ${esc(d.version)}` : ''}${d.host ? ` · ${esc(d.host)}${d.schema ? ` / şema ${esc(d.schema)}` : ''}` : ''}</div>` : ''}</div></div>` : ''}
    ${d.disk ? `<div class="panel" style="margin-bottom:14px"><div class="pb"><div class="row"><b>Fotoğraf ve video deposu · Sunucu diski</b><span class="muted" style="margin-left:auto">${(d.disk.bytes / 1048576).toFixed(1)} MB · ${d.disk.count} dosya</span></div>
      <div class="muted" style="font-size:12.5px;margin-top:6px">${d.disk.backup ? 'Her dosyanın sunucuda ikinci bir kopyası tutulur; silinen dosyanın kopyası 7 gün sonra temizlenir.' : ''}${d.disk.move ? ` ${dt(d.disk.move.at)} · veritabanından ${d.disk.move.moved} dosya (${d.disk.move.mb} MB) buraya taşındı.` : ''}</div></div></div>` : '' }
    ${d.disk ? '' : d.storage ? `<div class="panel" style="margin-bottom:14px"><div class="pb"><div class="row"><b>Fotoğraf ve video deposu · Supabase Storage</b><span class="muted" style="margin-left:auto">${d.storage.mb ?? '?'} MB / ${d.storage.limitMB} MB · ${d.storage.count ?? '?'} dosya</span></div>
      <div class="dbbar"><i style="width:${Math.min(100, Math.round(((d.storage.mb || 0) / d.storage.limitMB) * 100))}%;background:var(--info)"></i></div>
      ${d.storage.move ? `<div class="muted" style="font-size:12.5px;margin-top:6px">${dt(d.storage.move.at)} · veritabanından ${d.storage.move.moved} dosya (${d.storage.move.mb} MB) buraya taşındı.</div>` : ''}</div></div>`
    : `<div class="case" style="background:color-mix(in srgb,var(--warn) 10%,transparent);border-radius:12px;margin-bottom:14px"><b>Fotoğraf ve videolar veritabanında tutuluyor</b><div class="muted">${d.storageError ? `Supabase Storage bağlanamadı: ${esc(d.storageError)}` : 'Ayrı depoya (Supabase Storage, 1 GB ücretsiz) geçmek için Render’a SUPABASE_URL ve SUPABASE_SECRET_KEY eklenmeli.'}</div></div>`}
    ${d.lastError ? `<div class="case" style="background:color-mix(in srgb,var(--bad) 8%,transparent);border-radius:12px;margin-bottom:14px"><b>Son yazma hatası</b><div class="muted">${dt(d.lastError.at)} · ${esc(d.lastError.message)}</div></div>` : ''}
    ${d.migration ? `<div class="panel" style="margin-bottom:14px"><div class="pb row" style="gap:12px">${icon('check')}<div><b>Taşıma tamamlandı</b><div class="muted">${dt(d.migration.at)} · Render Key Value’dan ${d.migration.docs} kayıt ve ${d.migration.media} medya (${d.migration.mediaMB} MB) taşındı.</div></div></div></div>` : ''}
    ${can('database') ? '<div class="panel bks" style="margin-bottom:14px"><div class="ph"><h3>Otomatik yedekler</h3><button class="btn sm bk-now">Şimdi yedek al</button></div><div class="pb"><div class="spin"></div></div></div>' : ''}
    <div class="panel"><div class="ph"><h3>Tablolar</h3></div><div class="tw"><table class="tbl"><thead><tr><th>Veri</th><th>Koleksiyon</th><th class="num">Kayıt</th></tr></thead><tbody>
      ${d.collections.map((c) => `<tr><td>${esc(COL_TR[c.name] || c.name)}</td><td class="muted mono">${esc(c.name)}</td><td class="num">${c.count.toLocaleString('tr-TR')}</td></tr>`).join('')}</tbody></table></div></div>`;
  // Gece yedekleri
  const bks = main.querySelector('.bks .pb');
  const loadBk = async () => {
    if (!bks) return;
    try {
      const r = await api('/backups');
      bks.innerHTML = `<p class="muted" style="margin:0 0 10px;font-size:13px">Kimse panele girmese de ${r.everyMin || 5} dakikada bir, kayıtlarda değişiklik varsa bütün kayıtlar sıkıştırılıp burada (sunucunun dışında) saklanır: son 1 saatin hepsi ve son ${r.days || 14} günün her günü için bir yedek.${r.local ? ` Aynı yedekler sunucu diskinde de tutuluyor (${r.local.count} dosya, Sunucu sekmesi).` : ''} Fotoğraf ve videolar bu yedeğe girmez.</p>
        ${r.lastError ? `<div class="case" style="background:color-mix(in srgb,var(--bad) 8%,transparent);border-radius:10px;margin-bottom:10px"><b>Son yedek alınamadı</b><div class="muted">${dt(r.lastError.at)} · ${esc(r.lastError.message)}</div></div>` : ''}
        ${r.list.length ? `<div class="tw"><table class="tbl"><thead><tr><th>Tarih</th><th>Alan</th><th class="num">Kayıt</th><th class="num">Boyut</th><th></th></tr></thead><tbody>${r.list.map((b) => `<tr><td>${dt(b.at)}</td><td class="muted">${esc(b.by)}</td><td class="num">${b.docs.toLocaleString('tr-TR')}</td><td class="num">${(b.size / 1024).toFixed(0)} KB</td><td class="num"><button class="btn sm" data-dl="${esc(b.id)}">${icon('download')} İndir</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="muted">Henüz yedek yok. İlk yedek birkaç dakika içinde alınacak.</div>'}`;
    } catch (er) { bks.textContent = er.message; }
  };
  loadBk();
  main.querySelector('.bk-now')?.addEventListener('click', async (e) => { e.target.disabled = true; try { await api('/backups', { body: {} }); toast('Yedek alındı.'); loadBk(); } catch (er) { toast(er.message); } e.target.disabled = false; });
  bks?.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-dl]'); if (!b) return;
    try {
      const r = await fetch(`${BASE}/api/backups/${b.dataset.dl}`, { headers: PANEL_H, credentials: 'same-origin' });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'İndirilemedi.');
      const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = `swipeup-${b.dataset.dl}.json.gz`; a.click();
    } catch (er) { toast(er.message); }
  });
  main.querySelector('[data-bk]')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      const r = await fetch(BASE + '/api/database/backup', { headers: PANEL_H, credentials: 'same-origin' });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'İndirilemedi.');
      const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = `swipeup-yedek-${today()}.json`; a.click();
      toast('Yedek indirildi.');
    } catch (er) { toast(er.message); }
  });
};

// ================= Sunucu ve alan adı (Yöncü VDS + Hostinger) =================
const bytes = (n) => { if (n == null) return '—'; const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; let v = n; while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; } return `${v.toFixed(v < 10 && i ? 1 : 0)} ${u[i]}`; };
const dur = (ms) => { const m = Math.floor(ms / 60000); const d = Math.floor(m / 1440); const h = Math.floor((m % 1440) / 60); return d ? `${d} gün ${h} sa` : h ? `${h} sa ${m % 60} dk` : `${m % 60} dk`; };
const meter = (pct) => `<div class="dbbar"><i style="width:${Math.min(100, pct)}%;background:${pct > 90 ? 'var(--bad)' : pct > 70 ? 'var(--warn)' : 'var(--ok)'}"></i></div>`;
const PANEL_FIX = 'curl -fsSL https://raw.githubusercontent.com/ert545855-cloud/JAHDFJLGBPOCGDRJG45222/main/scripts/vds/panel-yetki.sh | bash';
VIEWS.sunucu = async (main) => {
  main.innerHTML = `${head('Sunucu ve alan adı', 'Uygulamanın çalıştığı sunucu (Yöncü) ve swipeup.live alan adı (Hostinger). Buradaki her işlem işlem kaydına yazılır.')}<div class="spin"></div>`;
  let d;
  try { d = await api('/sunucu'); } catch (e) { main.querySelector('.spin').outerHTML = `<div class="case">${esc(e.message)}</div>`; return; }
  const memUsed = d.mem.total - d.mem.avail; const memPct = Math.round((memUsed / d.mem.total) * 100);
  const diskPct = d.disk ? Math.round(((d.disk.total - d.disk.free) / d.disk.total) * 100) : 0;
  const certDays = d.cert ? Math.floor((d.cert.validTo - Date.now()) / 86400000) : null;
  const unitChip = (u) => `<span class="chip ${u.active === 'active' ? 'ok' : u.active === 'failed' ? 'bad' : 'warn'}">${u.active === 'active' ? (u.sub === 'waiting' ? 'Bekliyor' : 'Çalışıyor') : u.active === 'failed' ? 'Hata' : esc(u.active)}</span>`;
  const permsOk = !d.vds || (d.perms?.sudo && d.perms?.journal);
  main.innerHTML = `${head('Sunucu ve alan adı', 'Uygulamanın çalıştığı sunucu (Yöncü) ve swipeup.live alan adı (Hostinger). Buradaki her işlem işlem kaydına yazılır.',
    `<a class="btn" href="${esc(d.links.yoncu)}" target="_blank" rel="noopener">Yöncü paneli</a> <a class="btn" href="${esc(d.links.hostinger)}" target="_blank" rel="noopener">Hostinger paneli</a>`)}
    ${!d.vds ? '<div class="case" style="margin-bottom:14px">Uygulama şu an kendi sunucumuzda (VDS) çalışmıyor; sunucu işlemleri kapalı.</div>' : ''}
    ${d.vds && !permsOk ? `<div class="case" style="background:color-mix(in srgb,var(--warn) 12%,transparent);border-radius:12px;margin-bottom:14px"><b>Panel izinleri bir kez kurulmalı</b>
      <div class="muted" style="margin:4px 0 8px">Güncelle / yeniden başlat / yedek düğmeleri ve kayıtlar için sunucuya SSH ile girip şu komutu bir kez çalıştır:</div>
      <div class="row" style="gap:8px"><code class="mono" style="flex:1;min-width:0;overflow:auto;white-space:nowrap;padding:8px;background:var(--soft);border-radius:8px">${esc(PANEL_FIX)}</code><button class="btn sm cpfix">${icon('copy')} Kopyala</button></div></div>` : ''}
    <div class="stats">
      <div class="stat"><b>%${d.cpu}</b><span>İşlemci · ${d.cpus} çekirdek</span>${meter(d.cpu)}<span class="muted" style="font-size:11.5px">Yük ${d.load.join(' / ')}</span></div>
      <div class="stat"><b>${bytes(memUsed)}</b><span>Bellek · ${bytes(d.mem.total)} içinden</span>${meter(memPct)}${d.mem.swapTotal ? `<span class="muted" style="font-size:11.5px">Takas ${bytes(d.mem.swapTotal - d.mem.swapFree)} / ${bytes(d.mem.swapTotal)}</span>` : ''}</div>
      <div class="stat"><b>${d.disk ? bytes(d.disk.total - d.disk.free) : '—'}</b><span>Disk · ${d.disk ? bytes(d.disk.total) : '?'} içinden</span>${meter(diskPct)}</div>
      <div class="stat"><b>${dur(d.uptime)}</b><span>Sunucu açık</span><span class="muted" style="font-size:11.5px">Uygulama ${dur(d.proc.uptime)} · ${bytes(d.proc.rss)}</span></div>
    </div>
    <div class="grid2" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px;margin-bottom:14px">
      <div class="panel"><div class="ph"><h3>Durum</h3></div><div class="tw"><table class="tbl"><tbody>
        ${d.units.map((u) => `<tr><td>${esc(u.name)}</td><td>${unitChip(u)}</td><td class="muted" style="font-size:12.5px">${u.next ? `Sıradaki ${dt(u.next)}` : u.last ? `Son çalışma ${dt(u.last)}` : u.since ? `${dt(u.since)}’den beri` : ''}</td></tr>`).join('')}
        <tr><td>HTTPS sertifikası</td><td>${d.cert ? `<span class="chip ${certDays > 14 ? 'ok' : 'warn'}">${certDays} gün</span>` : '<span class="chip bad">Okunamadı</span>'}</td><td class="muted" style="font-size:12.5px">${d.cert ? `${esc(d.cert.issuer)} · kendiliğinden yenilenir` : ''}</td></tr>
        <tr><td>Sürüm</td><td class="mono">${esc(d.git?.hash || '?')}</td><td class="muted" style="font-size:12.5px">${d.git ? `${esc(d.git.subject).slice(0, 70)} · ${dt(d.git.at)}` : ''}</td></tr>
        <tr><td>Sistem</td><td colspan="2" class="muted" style="font-size:12.5px">${esc(d.os)} · Node ${esc(d.node)} · ${esc(d.host)} · ${esc(d.ips.join(', '))}</td></tr>
        ${d.updates.pending != null || d.updates.reboot ? `<tr><td>İşletim sistemi</td><td colspan="2">${d.updates.pending ? `<span class="chip ${d.updates.security ? 'warn' : ''}">${d.updates.pending} güncelleme${d.updates.security ? ` · ${d.updates.security} güvenlik` : ''}</span> ` : '<span class="chip ok">Güncel</span> '}${d.updates.reboot ? '<span class="chip warn">Yeniden başlatma bekliyor</span>' : ''}</td></tr>` : ''}
      </tbody></table></div></div>
      <div class="panel"><div class="ph"><h3>İşlemler</h3></div><div class="pb" style="display:grid;gap:10px">
        <div class="row" style="gap:10px"><button class="btn primary" data-act="guncelle" ${d.vds ? '' : 'disabled'}>${icon('download')} Şimdi güncelle</button><span class="muted" style="font-size:12.5px">GitHub’daki son sürümü hemen alır. Normalde 5 dakikada bir kendisi bakar.</span></div>
        <div class="row" style="gap:10px"><button class="btn" data-act="yedek" ${d.vds ? '' : 'disabled'}>${icon('shield')} Yedek al</button><span class="muted" style="font-size:12.5px">Veritabanının tam yedeği. Her gece 04:10’da kendiliğinden alınır, 7 gün saklanır.</span></div>
        <div class="row" style="gap:10px"><button class="btn" data-act="yeniden-baslat" ${d.vds ? '' : 'disabled'}>${icon('undo')} Uygulamayı yeniden başlat</button><span class="muted" style="font-size:12.5px">Takılma olursa. Site birkaç saniye kesilir.</span></div>
        <div class="row" style="gap:10px"><button class="btn danger" data-act="reboot" ${d.vds ? '' : 'disabled'}>${icon('bolt')} Sunucuyu yeniden başlat</button><span class="muted" style="font-size:12.5px">İşletim sistemi güncellemesinden sonra. Site 1–2 dakika kapanır.</span></div>
      </div></div>
    </div>
    <div class="panel" style="margin-bottom:14px"><div class="ph"><h3>Gece veritabanı yedekleri</h3><span class="muted" style="font-size:12.5px">Her gece 04:10 · tam PostgreSQL dökümü (hareket ve trafik kayıtları dahil) · pg_restore ile geri yüklenir</span></div>
      ${d.backups == null ? '<div class="pb muted">Yedek klasörü okunamadı (panel izinleri).</div>' : d.backups.length ? `<div class="tw"><table class="tbl"><thead><tr><th>Dosya</th><th>Tarih</th><th class="num">Boyut</th><th></th></tr></thead><tbody>${d.backups.map((b) => `<tr><td class="mono">${esc(b.name)}</td><td>${dt(b.at)}</td><td class="num">${bytes(b.size)}</td><td class="num"><button class="btn sm" data-bk="${esc(b.name)}">${icon('download')} İndir</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="pb muted">Henüz sunucu yedeği yok. İlki bu gece 04:10’da alınacak ya da “Yedek al”a bas.</div>'}</div>
    ${d.media ? `<div class="panel" style="margin-bottom:14px"><div class="pb"><div class="row"><b>Fotoğraf ve videolar · sunucu diski</b><span class="muted" style="margin-left:auto">${bytes(d.media.bytes)} · ${d.media.count} dosya</span></div>
      <div class="muted" style="font-size:12.5px;margin-top:6px">${d.media.backupDir ? `Her dosyanın ikinci kopyası ${esc(d.media.backupDir)} klasöründe; silinen dosyanın kopyası 7 gün sonra temizlenir.` : 'İkinci kopya kapalı.'}${d.media.move ? ` ${dt(d.media.move.at)} · veritabanından ${d.media.move.moved} dosya (${d.media.move.mb} MB) taşındı.` : ''}</div></div></div>` : ''}
    ${d.snapshots?.dir ? `<div class="panel" style="margin-bottom:14px"><div class="ph"><h3>5 dakikalık kayıt yedekleri</h3><span class="muted" style="font-size:12.5px">${d.snapshots.count} dosya · ${bytes(d.snapshots.bytes)} · 24 saat hepsi, 7 gün saatlik, 30 gün günlük</span></div>
      ${d.snapshots.list.length ? `<div class="tw" style="max-height:320px;overflow:auto"><table class="tbl"><thead><tr><th>Dosya</th><th>Tarih</th><th class="num">Boyut</th><th></th></tr></thead><tbody>${d.snapshots.list.map((b) => `<tr><td class="mono">${esc(b.name)}</td><td>${dt(b.at)}</td><td class="num">${bytes(b.size)}</td><td class="num"><button class="btn sm" data-bk="${esc(b.name)}">${icon('download')} İndir</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="pb muted">İlk yedek birkaç dakika içinde alınacak.</div>'}</div>` : ''}
    <div class="panel mailp" style="margin-bottom:14px"><div class="ph"><h3>E-posta</h3></div><div class="pb"><div class="spin"></div></div></div>
    <div class="panel andp" style="margin-bottom:14px"><div class="ph"><h3>Android uygulaması</h3></div><div class="pb"><div class="spin"></div></div></div>
    <div class="panel dnsp" style="margin-bottom:14px"><div class="ph"><h3>Alan adı ve DNS · Hostinger</h3></div><div class="pb"><div class="spin"></div></div></div>
    <div class="panel logp"><div class="ph"><h3>Kayıtlar</h3>
      <div class="row" style="gap:6px;margin-left:auto"><select class="field lu" style="width:auto"><option value="swipeup">Uygulama</option><option value="caddy">HTTPS (Caddy)</option><option value="guncelle">Güncellemeler</option><option value="yedek">Yedekler</option></select>
      <label class="row muted" style="gap:4px;font-size:13px"><input type="checkbox" class="le"> Sadece uyarı ve hatalar</label>
      <input class="field lq" placeholder="Ara" style="width:140px"><button class="btn sm lr">${icon('undo')} Yenile</button></div></div>
      <pre class="logbox mono"></pre></div>`;

  main.querySelector('.cpfix')?.addEventListener('click', async () => { await navigator.clipboard?.writeText(PANEL_FIX); toast('Komut kopyalandı.'); });
  main.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
    const act = b.dataset.act; let confirmTxt;
    if (act === 'reboot') { confirmTxt = prompt('Sunucu yeniden başlayacak, site 1–2 dakika kapalı kalacak. Onaylamak için YENIDEN BASLAT yaz:'); if (confirmTxt == null) return; }
    else if (act === 'yeniden-baslat' && !confirm('Uygulama yeniden başlatılsın mı? Site birkaç saniye kesilir.')) return;
    b.disabled = true;
    try { const r = await api('/sunucu/islem', { body: { act, confirm: confirmTxt } }); toast(r.message, { ms: 6000 }); } catch (e) { toast(e.message); }
    setTimeout(() => { b.disabled = false; }, 4000);
  }));
  main.querySelectorAll('[data-bk]').forEach((b) => b.addEventListener('click', async () => {
    try {
      const r = await fetch(`${BASE}/api/sunucu/yedek/${encodeURIComponent(b.dataset.bk)}`, { headers: PANEL_H, credentials: 'same-origin' });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'İndirilemedi.');
      const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = b.dataset.bk; a.click();
    } catch (e) { toast(e.message); }
  }));

  // Kayıtlar
  const lb = main.querySelector('.logbox'); const lu = main.querySelector('.lu'); const le = main.querySelector('.le'); const lq = main.querySelector('.lq');
  const loadLog = async () => {
    lb.textContent = 'Yükleniyor…';
    try {
      const r = await api(`/sunucu/log?unit=${lu.value}&n=200${le.checked ? '&err=1' : ''}${lq.value.trim() ? `&q=${encodeURIComponent(lq.value.trim())}` : ''}`);
      lb.textContent = r.lines.length ? r.lines.join('\n') : (d.perms && !d.perms.journal ? 'Kayıtları görmek için yukarıdaki panel izinleri komutunu çalıştır.' : 'Kayıt yok.');
      lb.scrollTop = lb.scrollHeight;
    } catch (e) { lb.textContent = e.message; }
  };
  lu.onchange = loadLog; le.onchange = loadLog; main.querySelector('.lr').onclick = loadLog;
  lq.onkeydown = (e) => { if (e.key === 'Enter') loadLog(); };
  loadLog();

  // E-posta: durum, doğrulama kayıtları, test
  const mp = main.querySelector('.mailp .pb');
  const loadMail = () => api('/sunucu/eposta').then((m) => {
    const c = m.config; const d = m.dns;
    const chip = (ok, yes, no) => `<span class="chip ${ok ? 'ok' : 'bad'}">${ok ? yes : no}</span>`;
    mp.innerHTML = `<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px">
        ${c ? `<b>${esc(c.kind === 'gmail' ? `Gmail · ${c.user}` : `${c.from || c.user} · ${c.host}:${c.port}`)}</b>` : '<span class="chip bad">E-posta ayarlı değil</span>'}
        ${c ? chip(m.verify?.ok, 'Sunucuya bağlanıyor', 'Bağlanamıyor') : ''}</div>
      ${c && !m.verify?.ok && m.verify?.error ? `<div style="color:var(--bad);font-size:12.5px;margin:-2px 0 6px">${esc(m.verify.error)}</div>` : ''}
      ${c ? `<div class="muted" style="font-size:12.5px;margin:-2px 0 8px">Giriş kullanıcısı: <b>${esc(c.user || '—')}</b> · ${c.source === 'panel' ? 'panelden kaydedildi' : 'sunucu ayar dosyasından (/etc/swipeup.env)'}</div>` : ''}
      ${d ? `<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px">${chip(d.spfOk, 'SPF tamam', 'SPF eksik')} ${chip(!d.missing.length, `DKIM tamam (${d.dkim.length})`, `DKIM eksik: ${d.missing.length}`)} ${chip(!!d.dmarc, 'DMARC var', 'DMARC yok')} ${chip(d.mx.length > 0, 'MX var', 'MX yok')}</div>
        ${d.missing.length || !d.spf ? `<button class="btn sm primary mfix">${icon('check')} Eksik kayıtları ekle</button> <span class="muted" style="font-size:12.5px">E-postaların spam'e düşmemesi ve Gmail'in kabul etmesi için gerekli.</span>` : ''}` : m.dnsError ? `<div class="muted" style="font-size:12.5px">DNS okunamadı: ${esc(m.dnsError)}</div>` : ''}
      <form class="mtest row" style="gap:8px;flex-wrap:wrap;margin-top:12px"><input class="field" name="to" type="email" placeholder="Deneme e-postası gidecek adres" style="flex:1;min-width:220px"><button class="btn">${icon('mail')} Test e-postası gönder</button></form>
      <div class="mres muted" style="font-size:12.5px;margin-top:6px"></div>
      <details class="macc" style="margin-top:12px"${c && m.verify?.ok ? '' : ' open'}><summary style="cursor:pointer;font-weight:650">E-posta hesabını düzelt</summary>
        <p class="muted" style="font-size:12.5px;margin:8px 0">Hostinger panelinde <b>E-postalar → Hesaplar</b> bölümünden bu e-posta hesabının şifresini belirle (ya da sıfırla) ve buraya yaz. Kaydetmeden önce sunucuya gerçekten giriş denenir; şifre bir daha gösterilmez.</p>
        <form class="mform" style="display:grid;gap:8px;max-width:460px" autocomplete="off">
          <input class="field" name="user" type="email" placeholder="E-posta adresi (info@swipeup.live)" value="${esc(c?.user || 'info@swipeup.live')}" required>
          <input class="field" name="pass" type="password" placeholder="E-posta hesabının şifresi" autocomplete="new-password" required>
          <div class="row" style="gap:8px"><input class="field" name="host" value="${esc(c?.kind === 'smtp' && c.host ? c.host : 'smtp.hostinger.com')}" style="flex:2"><input class="field" name="port" type="number" value="${esc(c?.kind === 'smtp' && c.port ? c.port : 465)}" style="flex:1"></div>
          <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary">${icon('check')} Dene ve kaydet</button>${c?.source === 'panel' ? '<button type="button" class="btn sm mdel">Panel kaydını kaldır</button>' : ''}</div>
          <div class="mferr" style="font-size:12.5px"></div>
        </form></details>`;
    const mf = mp.querySelector('.mform');
    mf.onsubmit = async (e) => {
      e.preventDefault(); const out = mf.querySelector('.mferr'); const btn = mf.querySelector('.btn.primary');
      out.innerHTML = '<span class="muted">Hostinger\'a giriş deneniyor…</span>'; btn.disabled = true;
      try { await api('/sunucu/eposta/hesap', { body: { user: mf.user.value, pass: mf.pass.value, host: mf.host.value, port: +mf.port.value } }); mf.pass.value = ''; toast('E-posta hesabı doğrulandı ve kaydedildi.'); loadMail(); }
      catch (er) { out.innerHTML = `<span style="color:var(--bad)">${esc(er.message)}</span>`; btn.disabled = false; }
    };
    mp.querySelector('.mdel')?.addEventListener('click', async () => { try { await api('/sunucu/eposta/hesap', { method: 'DELETE' }); toast('Panel kaydı kaldırıldı; sunucu ayar dosyasındaki hesap kullanılıyor.'); loadMail(); } catch (er) { toast(er.message); } });
    mp.querySelector('.mfix')?.addEventListener('click', async (e) => { e.target.disabled = true; try { const r = await api('/sunucu/eposta/dns', { body: {} }); toast(r.added.length ? `Eklendi: ${r.added.join(', ')}` : 'Eksik kayıt yok.'); loadMail(); } catch (er) { toast(er.message); e.target.disabled = false; } });
    mp.querySelector('.mtest').onsubmit = async (e) => {
      e.preventDefault(); const out = mp.querySelector('.mres'); out.textContent = 'Gönderiliyor…';
      try { const r = await api('/sunucu/eposta/test', { body: { to: e.target.to.value } }); out.innerHTML = r.rejected.length ? `<span style="color:var(--bad)">Reddedildi: ${esc(r.rejected.join(', '))}</span>` : `✓ Sunucu kabul etti (${esc(r.response)}). Birkaç dakika içinde gelmezse Spam klasörüne bak.`; } catch (er) { out.innerHTML = `<span style="color:var(--bad)">${esc(er.message)}</span>`; }
    };
  }).catch((e) => { mp.textContent = e.message; });
  loadMail();

  // Android imza anahtarı
  const ap = main.querySelector('.andp .pb');
  api('/sunucu/android').then((a) => {
    ap.innerHTML = `<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px">${a.has ? '<span class="chip ok">Kalıcı imza anahtarı sunucuda</span>' : '<span class="chip bad">İmza anahtarı yok</span>'}
        <a class="btn sm" href="${esc(a.release)}" target="_blank" rel="noopener">${icon('download')} Son APK (GitHub)</a></div>
      ${a.sha256.length ? `<div class="muted" style="font-size:12.5px">SHA-256: <span class="mono" style="word-break:break-all">${a.sha256.map(esc).join('<br>')}</span></div>` : ''}
      ${a.files.length ? `<p class="muted" style="font-size:12.5px;margin:10px 0 6px">Anahtar kaybolursa uygulama bir daha güncellenemez. İkisini de indirip sunucu dışında (ör. kendi bilgisayarın ve bir USB bellek) sakla:</p>
        <div class="row" style="gap:6px;flex-wrap:wrap">${a.files.map((f) => `<button class="btn sm" data-and="${esc(f)}">${icon(f.endsWith('.txt') ? 'key' : 'download')} ${f.endsWith('.txt') ? 'Şifre dosyası' : 'Anahtar dosyası'} · ${esc(f.slice(16, 29))}</button>`).join('')}</div>`
      : `<p class="muted" style="font-size:12.5px;margin:8px 0 0">${a.has ? 'Anahtarın sunucuda kopya dosyası yok.' : 'Anahtar üretmek için sunucuda bir kez şunu çalıştır:'}</p>${a.has ? '' : '<code class="mono" style="display:block;padding:8px;background:var(--soft);border-radius:8px;overflow:auto">curl -fsSL https://raw.githubusercontent.com/ert545855-cloud/JAHDFJLGBPOCGDRJG45222/main/scripts/vds/android-anahtar.sh | bash</code>'}`}`;
    ap.querySelectorAll('[data-and]').forEach((b) => b.addEventListener('click', async () => {
      try {
        const r = await fetch(`${BASE}/api/sunucu/android/${encodeURIComponent(b.dataset.and)}`, { headers: PANEL_H, credentials: 'same-origin' });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'İndirilemedi.');
        const x = document.createElement('a'); x.href = URL.createObjectURL(await r.blob()); x.download = b.dataset.and; x.click();
      } catch (e) { toast(e.message); }
    }));
  }).catch((e) => { ap.textContent = e.message; });

  // Hostinger DNS
  const dp = main.querySelector('.dnsp .pb');
  const TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'CAA', 'NS', 'SRV'];
  const loadDns = async () => {
    if (!d.hostinger) {
      dp.innerHTML = `<p class="muted" style="margin:0 0 8px">Hostinger bağlı değil. DNS kayıtlarını buradan görüp düzenlemek için Hostinger’dan bir API anahtarı al (hPanel → Profil → API → Yeni token) ve sunucudaki ayarlara ekle:</p>
        <code class="mono" style="display:block;padding:8px;background:var(--soft);border-radius:8px;overflow:auto">echo 'HOSTINGER_API_TOKEN=anahtar' &gt;&gt; /etc/swipeup.env &amp;&amp; systemctl restart swipeup</code>`;
      return;
    }
    dp.innerHTML = '<div class="spin"></div>';
    let z;
    try { z = await api('/sunucu/dns'); } catch (e) { dp.innerHTML = `<div class="case">${esc(e.message)}</div>`; return; }
    const apex = z.records.find((r) => r.name === '@' && r.type === 'A');
    const pointsHere = apex && z.ips.length && apex.records.some((r) => z.ips.includes(r.content));
    const exp = z.info?.expires; const expDays = exp ? Math.floor((exp - Date.now()) / 86400000) : null;
    dp.innerHTML = `<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px"><b>${esc(z.domain)}</b>
        ${z.ips.length ? (pointsHere ? '<span class="chip ok">Bu sunucuya bağlı</span>' : '<span class="chip bad">Ana kayıt bu sunucuyu göstermiyor</span>') : ''}
        ${exp ? `<span class="chip ${expDays < 30 ? 'warn' : ''}">Bitiş ${new Date(exp).toLocaleDateString('tr-TR')} · ${expDays} gün</span>` : ''}</div>
      <div class="tw"><table class="tbl"><thead><tr><th>Tür</th><th>Ad</th><th>İçerik</th><th class="num">TTL</th><th></th></tr></thead><tbody>
        ${z.records.map((r, i) => `<tr><td><span class="chip">${esc(r.type)}</span></td><td class="mono">${esc(r.name)}</td><td class="mono" style="max-width:420px;word-break:break-all;font-size:12.5px">${r.records.map((x) => esc(x.content)).join('<br>')}</td><td class="num">${r.ttl}</td>
          <td class="num" style="white-space:nowrap"><button class="btn sm" data-ed="${i}">${icon('edit')}</button> <button class="btn sm danger" data-rm="${i}" aria-label="Sil">${icon('trash')}</button></td></tr>`).join('')}
      </tbody></table></div>
      <form class="dnsf row" style="gap:8px;flex-wrap:wrap;margin-top:12px;align-items:flex-end">
        <label style="display:grid;gap:3px"><span class="muted" style="font-size:12px">Tür</span><select class="field" name="type" style="width:auto">${TYPES.map((t) => `<option>${t}</option>`).join('')}</select></label>
        <label style="display:grid;gap:3px"><span class="muted" style="font-size:12px">Ad (ana alan adı için @)</span><input class="field" name="name" value="@" style="width:150px"></label>
        <label style="display:grid;gap:3px;flex:1;min-width:220px"><span class="muted" style="font-size:12px">İçerik (birden çok değer için her satıra bir tane)</span><textarea class="field" name="content" rows="1" placeholder="${esc(z.ips[0] || '185.114.21.168')}"></textarea></label>
        <label style="display:grid;gap:3px"><span class="muted" style="font-size:12px">TTL (sn)</span><input class="field" name="ttl" type="number" value="300" min="60" style="width:90px"></label>
        <button class="btn primary">${icon('check')} Kaydet</button></form>
      <p class="muted" style="font-size:12.5px;margin:8px 0 0">Aynı ad ve türdeki kayıtların yerine geçer. Değişiklik genelde birkaç dakikada yayılır. E-posta (MX, SPF, DKIM) kayıtlarına dokunursan info@swipeup.live çalışmayabilir.</p>
      ${z.snapshots.length ? `<details style="margin-top:12px"><summary class="muted" style="cursor:pointer">Önceki DNS hâlleri (geri al)</summary><div class="tw" style="margin-top:8px"><table class="tbl"><tbody>${z.snapshots.map((s) => `<tr><td>${s.at ? dt(s.at) : '—'}</td><td class="muted">${esc(s.reason)}</td><td class="num"><button class="btn sm" data-snap="${s.id}">${icon('undo')} Bu hâle dön</button></td></tr>`).join('')}</tbody></table></div></details>` : ''}`;
    const f = dp.querySelector('.dnsf');
    dp.querySelectorAll('[data-ed]').forEach((b) => b.addEventListener('click', () => {
      const r = z.records[+b.dataset.ed];
      f.type.value = r.type; f.name.value = r.name; f.content.value = r.records.map((x) => x.content).join('\n'); f.ttl.value = r.ttl;
      f.content.rows = Math.min(6, r.records.length); f.content.focus(); f.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }));
    dp.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', async () => {
      const r = z.records[+b.dataset.rm];
      let conf;
      if (r.name === '@' && r.type === 'A') { conf = prompt('Bu kayıt siteyi sunucuya bağlıyor. Silersen swipeup.live açılmaz. Yine de silmek için SIL yaz:'); if (conf == null) return; }
      else if (!confirm(`${r.type} ${r.name} kaydı silinsin mi?`)) return;
      try { await api('/sunucu/dns', { method: 'DELETE', body: { name: r.name, type: r.type, confirm: conf } }); toast('Kayıt silindi.'); loadDns(); } catch (e) { toast(e.message); }
    }));
    dp.querySelectorAll('[data-snap]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('DNS kayıtları bu hâle döndürülsün mü? Sonraki değişiklikler kaybolur.')) return;
      try { await api(`/sunucu/dns/geri/${b.dataset.snap}`, { body: {} }); toast('DNS eski hâline döndü.'); loadDns(); } catch (e) { toast(e.message); }
    }));
    f.onsubmit = async (e) => {
      e.preventDefault();
      const records = f.content.value.split('\n').map((x) => x.trim()).filter(Boolean);
      try { await api('/sunucu/dns', { method: 'PUT', body: { type: f.type.value, name: f.name.value, ttl: +f.ttl.value, records } }); toast('Kayıt kaydedildi.'); loadDns(); } catch (er) { toast(er.message); }
    };
  };
  loadDns();
};

// ---- Etkinlik teması (ör. Cadılar Bayramı haftası) ----
const dtl = (ms) => { if (!ms) return ''; const d = new Date(ms); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const fdt = (ms) => new Date(ms).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const EV_EMOJI = { halloween: '🎃', yilbasi: '🎄', sevgililer: '💘' };
function evRow(e, kinds, owner, nowMs) {
  const st = !e.start || !e.end ? '' : nowMs >= e.end ? '<span class="chip">Bitti</span>' : nowMs >= e.start ? '<span class="chip ok">Şu an açık</span>' : '<span class="chip warn">Bekliyor</span>';
  return `<div class="evrow">
    <select class="field" data-k="kind" ${owner ? '' : 'disabled'}>${kinds.map((k) => `<option value="${k.id}" ${e.kind === k.id ? 'selected' : ''}>${EV_EMOJI[k.id] || ''} ${esc(k.name)}</option>`).join('')}</select>
    <input class="field" type="datetime-local" data-k="start" value="${dtl(e.start)}" ${owner ? '' : 'disabled'}>
    <input class="field" type="datetime-local" data-k="end" value="${dtl(e.end)}" ${owner ? '' : 'disabled'}>
    <span class="evst">${st}</span>
    ${owner ? `<button type="button" class="btn sm danger rme" aria-label="Sil">${icon('trash')}</button>` : ''}</div>`;
}
function eventPanel(s, owner) {
  const a = s.active;
  const head = !a ? 'Takvimde etkinlik yok' : s.now < a.start ? `Sıradaki: ${EV_EMOJI[a.id] || ''} ${a.name} · ${fdt(a.start)}` : `Şu an açık: ${EV_EMOJI[a.id] || ''} ${a.name} · ${fdt(a.end)} tarihinde biter`;
  return `<form class="panel evf" style="margin-top:14px;max-width:860px"><div class="ph"><h3>Etkinlik temaları</h3><span class="chip ${a && s.now >= a.start ? 'ok' : ''}">${esc(head)}</span></div><div class="pb">
    <div class="evhead"><span>Tema</span><span>Başlangıç</span><span>Bitiş</span><span></span></div>
    <div class="evlist">${s.list.map((e) => evRow(e, s.kinds, owner, s.now)).join('')}</div>
    <p class="muted" style="margin:10px 0 0;font-size:12.5px">Her tema kendi tarihinde herkeste kendiliğinden açılır, bitince kalkar ve herkesin kendi seçtiği tema geri gelir. Kullanıcılar Ayarlar’dan kapatabilir.
      <br>🎃 Yarasa, örümcek, hayalet · 🎄 Kar, yılbaşı ışıkları, kızak, yeni yıl geri sayımı ve gece yarısı havai fişek · 💘 Uçuşan kalpler, gül yaprakları, açık pembe tema.</p>
    ${owner ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn primary">${icon('check')} Takvimi kaydet</button><button type="button" class="btn adde">${icon('plus')} Etkinlik ekle</button></div>` : ''}</div></form>`;
}
function wireEventPanel(main, s) {
  const f = main.querySelector('.evf'); if (!f) return;
  f.onclick = (ev) => {
    if (ev.target.closest('.rme')) ev.target.closest('.evrow').remove();
    if (ev.target.closest('.adde')) {
      const last = [...f.querySelectorAll('.evrow')].map((r) => new Date(r.querySelector('[data-k=end]').value).getTime()).filter(Boolean).pop() || Date.now();
      const st = Math.max(last, Date.now());
      f.querySelector('.evlist').insertAdjacentHTML('beforeend', evRow({ kind: s.kinds[0].id, start: st, end: st + 7 * 86400000 }, s.kinds, true, Date.now()));
    }
  };
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const list = [...f.querySelectorAll('.evrow')].map((r) => ({
      kind: r.querySelector('[data-k=kind]').value,
      start: new Date(r.querySelector('[data-k=start]').value).getTime(),
      end: new Date(r.querySelector('[data-k=end]').value).getTime(),
    }));
    try {
      const r = await api('/event', { method: 'PUT', body: { list } });
      toast(r.active ? 'Etkinlik takvimi kaydedildi.' : 'Takvim kaydedildi; yaklaşan etkinlik yok.');
      render();
    } catch (er) { toast(er.message); }
  };
}

// ---- Etkinlik odaları ----
const DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
async function roomsPanel(box, owner) {
  const r = await api('/rooms').catch(() => null);
  if (!r) return;
  const row = (x) => `<div class="room-row">
      <input class="field" data-k="em" value="${esc(x.em || '💬')}" style="width:56px" aria-label="Emoji">
      <input class="field" data-k="name" value="${esc(x.name || '')}" placeholder="Oda adı" style="width:150px">
      <input class="field" data-k="desc" value="${esc(x.desc || '')}" placeholder="Kısa açıklama" style="flex:1;min-width:160px">
      <input type="hidden" data-k="id" value="${esc(x.id || '')}">
      <label class="chk"><input type="checkbox" data-k="always" ${x.always ? 'checked' : ''}> Her zaman açık</label>
      <span class="days">${DAYS.map((d, i) => `<label class="dchip"><input type="checkbox" data-d="${i}" ${(x.days || []).includes(i) ? 'checked' : ''}><span>${d}</span></label>`).join('')}</span>
      <input class="field" data-k="from" value="${esc(x.from || '20:00')}" style="width:74px" placeholder="20:00" aria-label="Açılış">
      <input class="field" data-k="to" value="${esc(x.to || '24:00')}" style="width:74px" placeholder="24:00" aria-label="Kapanış">
      ${x.open != null ? `<span class="chip ${x.open ? "ok" : ""}">${x.open ? 'Açık' : 'Kapalı'}</span>` : ''}
      <button type="button" class="btn sm danger rmroom">${icon('trash')}</button></div>`;
  box.innerHTML = `<div class="panel" style="margin-top:16px"><div class="ph"><h3>Etkinlik odaları</h3>${owner ? `<button type="button" class="btn sm addroom">${icon('plus')} Oda</button>` : ''}</div>
    <div class="pb"><p class="muted" style="margin:0 0 10px;font-size:12.5px">Odalar seçilen günlerde ve saatlerde (Türkiye saati) açılır. Gece yarısını geçen saatler (21:00–01:00) desteklenir. “Genel Sohbet” her zaman açıktır.</p>
    <div class="room-list">${r.list.map(row).join('')}</div>
    ${owner ? `<div style="margin-top:12px;display:flex;gap:8px"><button class="btn primary saveroom">${icon('check')} Odaları kaydet</button></div>` : ''}</div></div>`;
  const list = box.querySelector('.room-list');
  box.onclick = async (e) => {
    if (e.target.closest('.addroom')) list.insertAdjacentHTML('beforeend', row({ days: [0, 1, 2, 3, 4, 5, 6] }));
    else if (e.target.closest('.rmroom')) e.target.closest('.room-row').remove();
    else if (e.target.closest('.saveroom')) {
      const out = [...list.querySelectorAll('.room-row')].map((rw) => {
        const o = { days: [...rw.querySelectorAll('[data-d]:checked')].map((c) => +c.dataset.d) };
        rw.querySelectorAll('[data-k]').forEach((x) => { o[x.dataset.k] = x.type === 'checkbox' ? x.checked : x.value.trim(); });
        if (!o.id) o.id = o.name.toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^a-z0-9]/g, '').slice(0, 20);
        return o;
      });
      try { await api('/rooms', { method: 'PUT', body: { list: out } }); toast('Odalar kaydedildi.'); roomsPanel(box, owner); } catch (er) { toast(er.message); }
    }
  };
}

// ---- Özel etiketler ----
VIEWS.tags = async (main) => {
  const r = await api('/tags');
  let list = r.list.map((t) => ({ ...t }));
  const row = (t, i) => `<div class="tag-row" data-i="${i}"><input class="field em" value="${esc(t.em)}" style="width:60px" aria-label="Emoji"><input class="field nm" value="${esc(t.name)}" placeholder="Etiket adı (ör. Yarışma 1.si)" style="flex:1;min-width:160px">
      <select class="field cl" style="width:auto">${r.colors.map((c) => `<option value="${c}" ${t.color === c ? 'selected' : ''}>${{ gold: 'Altın', pink: 'Pembe', purple: 'Mor', blue: 'Mavi', green: 'Yeşil', orange: 'Turuncu', red: 'Kırmızı', gray: 'Gri' }[c]}</option>`).join('')}</select>
      <span class="utag t-${esc(t.color)} pv">${esc(t.em)} ${esc(t.name || 'Önizleme')}</span><span class="muted" style="font-size:12px">${t.count || 0} kişi</span><button class="btn sm danger rmt">${icon('trash')}</button></div>`;
  const paint = () => {
    main.innerHTML = `${head('Özel etiketler', 'Falcı Teyze etiketi gibi, istediğin kişilere özel etiket ver: “🏆 Yarışma 1.si”, “⭐ Kurucu üye”, “🎤 Yayıncı” gibi. Etiket profilde ve kaydırma kartında görünür; verildiğinde kullanıcıya bildirim gider.')}
      <div class="panel"><div class="ph"><h3>Etiketler</h3><button class="btn sm addt">${icon('plus')} Etiket</button></div><div class="pb tags-l">${list.map(row).join('') || '<div class="muted">Henüz etiket yok.</div>'}</div><div class="pb"><button class="btn primary svl">${icon('check')} Kaydet</button></div></div>
      <div class="panel" style="margin-top:14px"><div class="ph"><h3>Kullanıcıya etiket ver</h3></div><div class="pb" style="display:grid;gap:10px">
        <div class="row" style="gap:8px;flex-wrap:wrap"><input class="field uq" placeholder="Kullanıcı adı ya da isim ara" style="flex:1;min-width:200px"><button class="btn sm srch">${icon('search')} Ara</button></div><div class="uqr"></div>
        <p class="muted" style="margin:0;font-size:12.5px">Kullanıcıya tıklayınca açılan pencerede “Özel etiketler” bölümünden etiket seçebilirsin.</p></div></div>
      ${r.list.filter((t) => t.count).map((t) => `<div class="panel" style="margin-top:14px"><div class="ph"><h3><span class="utag t-${esc(t.color)}">${esc(t.em)} ${esc(t.name)}</span></h3><span class="muted">${t.count} kişi</span></div><div class="pb row" style="gap:10px;flex-wrap:wrap">${t.users.map((u) => `<button class="btn sm ou" data-u="${esc(u.id)}">@${esc(u.username)}</button>`).join('')}</div></div>`).join('')}`;
  };
  paint();
  const collect = () => { main.querySelectorAll('.tag-row').forEach((rw) => { const t = list[+rw.dataset.i]; t.em = rw.querySelector('.em').value; t.name = rw.querySelector('.nm').value; t.color = rw.querySelector('.cl').value; }); };
  main.oninput = (e) => { const rw = e.target.closest('.tag-row'); if (!rw) return; collect(); const t = list[+rw.dataset.i]; const pv = rw.querySelector('.pv'); pv.className = `utag t-${t.color} pv`; pv.textContent = `${t.em} ${t.name || 'Önizleme'}`; };
  main.onchange = main.oninput;
  main.onclick = async (e) => {
    if (e.target.closest('.addt')) { collect(); list.push({ em: '🏆', name: '', color: 'gold' }); paint(); return; }
    if (e.target.closest('.rmt')) { collect(); const i = +e.target.closest('.tag-row').dataset.i; if (list[i].count && !confirm(`Bu etiket ${list[i].count} kişiden de kaldırılacak. Silinsin mi?`)) return; list.splice(i, 1); paint(); return; }
    if (e.target.closest('.svl')) { collect(); try { await api('/tags', { method: 'PUT', body: { list } }); toast('Etiketler kaydedildi.'); VIEWS.tags(main); } catch (er) { toast(er.message); } return; }
    if (e.target.closest('.srch')) {
      const q = main.querySelector('.uq').value.trim(); if (!q) return;
      const us = await api(`/users?q=${encodeURIComponent(q)}`); const items = us.items || us;
      main.querySelector('.uqr').innerHTML = items.slice(0, 12).map((u) => `<button class="btn sm ou" data-u="${esc(u.id)}" style="margin:0 6px 6px 0">@${esc(u.username)} · ${esc(u.name)}</button>`).join('') || '<span class="muted">Bulunamadı.</span>';
      return;
    }
    const ou = e.target.closest('.ou'); if (ou) userDrawer(ou.dataset.u, () => VIEWS.tags(main));
  };
};

// ---- Büyüme panosu ----
VIEWS.growth = async (main) => {
  const days = +(sessionStorage.getItem('su_gdays') || 30);
  const g = await api(`/growth?days=${days}`);
  const T = g.totals; const pct = (v) => (v == null ? '—' : `%${v}`);
  const trend = (a, b) => (!b ? (a ? '<span class="tr up">yeni</span>' : '') : `<span class="tr ${a >= b ? 'up' : 'down'}">${a >= b ? '▲' : '▼'} %${Math.abs(Math.round(((a - b) / b) * 100))}</span>`);
  const short = (x) => x.day.slice(8);
  main.innerHTML = `${head('Büyüme', `Aktif kullanıcılar, elde tutma ve özelliklerin ne kadar kullanıldığı. Aktiflik ölçümü ${esc(g.tracking)} tarihinde başladı; elde tutma oranları bu tarihten sonra kayıt olanlarla hesaplanır.`, `<div class="tabs gd" style="margin:0">${[7, 30, 90].map((d) => `<button data-d="${d}" class="${d === days ? 'on' : ''}">${d} gün</button>`).join('')}</div>`)}
    <div class="stats">
      <div class="stat"><b>${T.dau}</b><span>Bugün aktif (DAU)</span></div>
      <div class="stat"><b>${T.wau}</b><span>Son 7 gün aktif (WAU)</span></div>
      <div class="stat"><b>${T.mau}</b><span>Son 30 gün aktif (MAU)</span></div>
      <div class="stat"><b>${pct(T.stickiness)}</b><span>Bağlılık (DAU/MAU)</span></div>
      <div class="stat"><b>${T.users}</b><span>Toplam kullanıcı · son 7 gün +${T.new7}</span></div>
      <div class="stat"><b>${pct(T.d1)}</b><span>1. gün geri gelen</span></div>
      <div class="stat"><b>${pct(T.d7)}</b><span>7. gün geri gelen</span></div>
      <div class="stat"><b>${pct(T.d30)}</b><span>30. gün geri gelen</span></div>
      ${g.flags.spamOpen || g.flags.multiOpen ? `<div class="stat alert"><b>${g.flags.spamOpen + g.flags.multiOpen}</b><span>Açık spam / sahte hesap kaydı</span><a href="#/flags">Görüntüle</a></div>` : ''}
    </div>
    <div class="panel fnl" style="margin-bottom:14px"><div class="ph"><h3>Kayıt hunisi</h3><span class="muted" style="font-size:12px">Son ${days} günde kaydolanlar</span></div><div class="pb"><div class="spin"></div></div></div>
    <div class="grid g2">
      <div class="panel"><div class="ph"><h3>Günlük aktif kullanıcı</h3></div><div class="pb">${bars(g.dau, { name: 'Aktif kullanıcı' })}</div></div>
      <div class="panel"><div class="ph"><h3>Yeni kayıt</h3></div><div class="pb">${bars(g.newUsers, { name: 'Yeni kayıt' })}</div></div>
    </div>
    <div class="panel" style="margin-top:14px"><div class="ph"><h3>Özellik kullanımı</h3><span class="muted" style="font-size:12px">Satıra tıkla: günlük grafik</span></div><div class="tw"><table class="tbl feat"><thead><tr><th>Özellik</th><th class="num">Bugün</th><th class="num">Son 7 gün</th><th class="num">Önceki 7 güne göre</th><th class="num">Son ${days} gün</th></tr></thead><tbody>
      ${g.features.sort((a, b) => b.d7 - a.d7).map((f, i) => `<tr data-i="${i}" style="cursor:pointer"><td><b>${esc(f.name)}</b></td><td class="num">${f.today}</td><td class="num">${f.d7}</td><td class="num">${trend(f.d7, f.prev7)}</td><td class="num">${f.d30}</td></tr><tr class="fx" data-x="${i}" hidden><td colspan="5">${bars(f.series, { name: f.name })}</td></tr>`).join('')}
    </tbody></table></div></div>`;
  main.querySelector('.gd').onclick = (e) => { const b = e.target.closest('[data-d]'); if (!b) return; sessionStorage.setItem('su_gdays', b.dataset.d); VIEWS.growth(main); };
  // Kayıt hunisi: kayıt → profil fotoğrafı → ilk eşleşme → ilk mesaj
  api(`/funnel?days=${days}`).then((f) => {
    const box = main.querySelector('.fnl .pb'); if (!box) return;
    const max = Math.max(1, f.steps[0].n);
    box.innerHTML = `<div class="fn-steps">${f.steps.map((s, i) => `<div class="fn-st"><div class="fn-bar" style="--w:${Math.max(2, Math.round((s.n / max) * 100))}%"><span>${esc(s.label)}</span><b>${s.n}</b></div><div class="fn-m">%${s.pct}${i ? `<small> · ${s.drop} kişi düştü${f.steps[i - 1].n ? ` (%${Math.round((s.drop / f.steps[i - 1].n) * 100)})` : ''}</small>` : ''}</div></div>`).join('')}</div>
      ${f.medianHoursToMatch != null ? `<p class="muted" style="font-size:12.5px;margin:10px 0 0">Kayıttan ilk eşleşmeye ortanca süre: ${f.medianHoursToMatch < 48 ? `${f.medianHoursToMatch} saat` : `${Math.round(f.medianHoursToMatch / 24)} gün`}</p>` : ''}
      <div class="tw" style="margin-top:10px"><table><thead><tr><th>Kayıt haftası</th><th class="num">Kayıt</th><th class="num">Fotoğraf</th><th class="num">Eşleşme</th><th class="num">Mesaj</th></tr></thead><tbody>
      ${f.weeks.filter((w) => w.n).reverse().map((w) => { const p = (v) => `${v} <small class="muted">%${Math.round((v / w.n) * 100)}</small>`; return `<tr><td>${d(w.from)}</td><td class="num">${w.n}</td><td class="num">${p(w.photo)}</td><td class="num">${p(w.match)}</td><td class="num">${p(w.msg)}</td></tr>`; }).join('') || '<tr><td colspan="5" class="muted">Bu dönemde kayıt yok.</td></tr>'}</tbody></table></div>`;
  }).catch((er) => { const box = main.querySelector('.fnl .pb'); if (box) box.textContent = er.message; });
  main.querySelector('.feat').onclick = (e) => { const r = e.target.closest('[data-i]'); if (!r) return; const x = main.querySelector(`[data-x="${r.dataset.i}"]`); x.hidden = !x.hidden; };
};

// ---- Reklamlar (öne çıkarma) ----
const PST2 = { active: ['ok', 'Yayında'], done: ['', 'Bitti'], stopped: ['', 'Kullanıcı durdurdu'], stopped_admin: ['bad', 'Durduruldu'] };
let promoSt = 'active';
VIEWS.promos = async (main) => {
  const r = await api(`/promos?status=${promoSt}`);
  const c = r.cfg; const owner = can('promos');
  main.innerHTML = `${head('Reklamlar', 'Kullanıcıların jetonla öne çıkardığı gönderi ve vitrin videoları. Akışta ve Vitrin’de “Sponsorlu” etiketiyle gösterilir; bütçesi yüksek olan daha sık çıkar. Kullanılmayan jeton süre bitince iade edilir.')}
    <div class="stats"><div class="stat"><b>${r.totals.active}</b><span>Yayında</span></div><div class="stat"><b>${r.totals.count}</b><span>Toplam</span></div>
      <div class="stat"><b>${r.totals.spent.toLocaleString('tr-TR')}</b><span>Harcanan jeton (iade düşülmüş)</span></div><div class="stat"><b>${r.totals.shown.toLocaleString('tr-TR')}</b><span>Toplam gösterim</span></div></div>
    <form class="panel promo-set" style="margin-bottom:14px"><div class="ph"><h3>Ayarlar</h3><label class="row" style="gap:6px;font-size:13px"><input type="checkbox" name="en" ${c.enabled ? 'checked' : ''} ${owner ? '' : 'disabled'}> Öne çıkarma açık</label></div><div class="pb fgrid">
      <label>1 jeton = kaç gösterim<input class="field" type="number" name="ipc" value="${c.impPerCoin}" ${owner ? '' : 'disabled'}></label>
      <label>En az bütçe (jeton)<input class="field" type="number" name="min" value="${c.minCoins}" ${owner ? '' : 'disabled'}></label>
      <label>En fazla bütçe (jeton)<input class="field" type="number" name="max" value="${c.maxCoins}" ${owner ? '' : 'disabled'}></label>
      <label>Bir kişiye günde en fazla gösterim<input class="field" type="number" name="pvd" value="${c.perViewerDay}" ${owner ? '' : 'disabled'}></label>
      ${owner ? `<div><button class="btn primary sm">${icon('check')} Kaydet</button></div>` : ''}</div></form>
    <div class="tabs pst">${[['active', 'Yayında'], ['ended', 'Bitenler'], ['all', 'Tümü']].map(([k, l]) => `<button data-s="${k}" class="${promoSt === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="panel"><div class="tw">${r.items.length ? `<table class="tbl"><thead><tr><th>İçerik</th><th>Kullanıcı</th><th class="num">Bütçe</th><th class="num">Gösterim</th><th class="num">Kişi</th><th class="num">Etkileşim</th><th>Hedef</th><th>Durum</th><th></th></tr></thead><tbody>
      ${r.items.map((p) => `<tr data-id="${esc(p.id)}"><td><a href="/#/${p.type === 'reel' ? 'vitrin' : 'p'}/${esc(p.postId)}" target="_blank" rel="noopener" class="row" style="gap:8px">${p.post?.image ? `<img src="${esc(p.post.image)}" alt="" style="width:40px;height:50px;object-fit:cover;border-radius:8px">` : '🎬'}<span class="muted ell" style="max-width:160px">${esc(p.post?.caption || (p.type === 'reel' ? 'Vitrin videosu' : 'Gönderi'))}</span></a></td>
        <td>${userCell(p.user)}</td><td class="num">${p.coins}<div class="muted" style="font-size:11px">${p.days} gün${p.refunded ? ` · ${p.refunded} iade` : ''}</div></td><td class="num">${p.shown.toLocaleString('tr-TR')} / ${p.impressions.toLocaleString('tr-TR')}</td><td class="num">${p.reach || 0}</td><td class="num">${p.hits || 0}<div class="muted" style="font-size:11px">+${p.likesGained} beğeni</div></td>
        <td class="muted" style="font-size:12px">${p.target.gender === 'k' ? 'Kadın' : p.target.gender === 'e' ? 'Erkek' : 'Herkes'} · ${p.target.ageMin}–${p.target.ageMax}${p.target.city ? ` · ${esc(p.target.city)}` : ''}</td>
        <td><span class="chip ${PST2[p.status]?.[0] || ''}">${PST2[p.status]?.[1] || p.status}</span><div class="muted" style="font-size:11px">${dt(p.at)}</div></td>
        <td>${p.status === 'active' ? '<button class="btn sm danger stopp">Durdur</button>' : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Kayıt yok.</div>'}</div></div>`;
  main.querySelector('.pst').onclick = (e) => { const b = e.target.closest('[data-s]'); if (!b) return; promoSt = b.dataset.s; VIEWS.promos(main); };
  main.querySelector('.promo-set').onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    try { await api('/promos/settings', { method: 'PUT', body: { enabled: f.en.checked, impPerCoin: +f.ipc.value, minCoins: +f.min.value, maxCoins: +f.max.value, perViewerDay: +f.pvd.value } }); toast('Kaydedildi.'); } catch (er) { toast(er.message); }
  };
  main.querySelector('.panel .tw')?.addEventListener('click', async (e) => {
    const b = e.target.closest('.stopp'); if (!b) return;
    const reason = prompt('Durdurma nedeni (kullanıcıya bildirilir, kalan jeton iade edilir):', 'Topluluk kurallarına aykırı içerik');
    if (reason === null) return;
    try { await api(`/promos/${b.closest('[data-id]').dataset.id}/stop`, { body: { reason } }); toast('Durduruldu, kalan jeton iade edildi.'); VIEWS.promos(main); } catch (er) { toast(er.message); }
  });
};

// ---- Sepet indirimleri ----
const WDAYS = [[1, 'Pzt'], [2, 'Sal'], [3, 'Çar'], [4, 'Per'], [5, 'Cum'], [6, 'Cmt'], [0, 'Paz']];
VIEWS.cartpromos = async (main) => {
  const paint = (r) => {
    const st = r.stats;
    main.innerHTML = `${head('Sepet indirimleri', 'Seçtiğin günlerde sepette en az belirlenen sayıda ürün olunca indirim. Web sitesinde (havale/EFT) indirim fiyata uygulanır. Android ve iOS uygulamasında fiyatı Google Play / App Store belirlediği için aynı oran <b>hediye</b> olarak verilir: jeton paketlerinde %X ekstra jeton, SwipeUp+ sürelerinde %X ekstra gün. Aynı anda birden çok kampanya geçerliyse en yüksek oran uygulanır.')}
      <div class="stats"><div class="stat"><b>${st.webCarts}</b><span>Web sepet siparişi (30 gün)</span></div><div class="stat"><b class="money">${tl(st.webDiscount)}</b><span>Web’de yapılan indirim</span></div>
        <div class="stat"><b>${st.appCarts}</b><span>Uygulamada hediyeli sepet</span></div><div class="stat"><b>${st.bonusCoins.toLocaleString('tr-TR')} · ${st.bonusDays}</b><span>Hediye jeton · SwipeUp+ günü</span></div></div>
      <div class="panel"><div class="ph"><h3>Kampanyalar</h3><span class="muted" style="font-size:12.5px">Bugün: ${esc(r.todayName)}</span></div><div class="tw">${r.list.length ? `<table class="tbl"><thead><tr><th>Ad</th><th>Günler</th><th class="num">En az ürün</th><th class="num">Oran</th><th>Tarih aralığı</th><th>Durum</th><th></th></tr></thead><tbody>
        ${r.list.map((c) => `<tr data-id="${esc(c.id)}"><td><b>${esc(c.title)}</b></td><td>${c.days.length === 7 ? 'Her gün' : esc(c.dayNames.join(', '))}</td><td class="num">${c.minItems}</td><td class="num"><b>%${c.pct}</b></td>
          <td class="muted" style="font-size:12.5px">${c.from || c.to ? `${c.from ? d(c.from + 'T12:00:00') : '…'} – ${c.to ? d(c.to + 'T12:00:00') : '…'}` : 'Süresiz'}</td>
          <td>${!c.on ? '<span class="chip">Kapalı</span>' : c.active ? '<span class="chip ok">Bugün geçerli</span>' : '<span class="chip info">Açık · bugün değil</span>'}</td>
          <td><div class="row" style="gap:6px"><button class="btn sm tg">${c.on ? 'Kapat' : 'Aç'}</button><button class="btn sm ed">Düzenle</button><button class="btn sm danger dl">Sil</button></div></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Henüz kampanya yok. Aşağıdan ekle.</div>'}</div></div>
      <form class="panel cp-form" style="margin-top:14px"><div class="ph"><h3 class="cp-h">Yeni kampanya</h3></div><div class="pb fgrid">
        <label>Kampanya adı<input class="field" name="title" maxlength="60" placeholder="Hafta sonu sepet indirimi" required></label>
        <label>İndirim oranı (%)<input class="field" type="number" name="pct" min="1" max="70" value="20" required></label>
        <label>Sepette en az ürün<input class="field" type="number" name="minItems" min="2" max="10" value="2" required></label>
        <label>Başlangıç (isteğe bağlı)<input class="field" type="date" name="from"></label>
        <label>Bitiş (isteğe bağlı)<input class="field" type="date" name="to"></label>
        <div><span class="muted" style="font-size:12.5px">Geçerli günler</span><div class="row cp-days" style="gap:6px;flex-wrap:wrap;margin-top:6px">${WDAYS.map(([v, l]) => `<label class="chip" style="cursor:pointer;gap:4px"><input type="checkbox" name="d" value="${v}" ${v === 6 || v === 0 ? 'checked' : ''}> ${l}</label>`).join('')}</div></div>
        <div class="row" style="gap:8px"><button class="btn primary sm">${icon('check')} <span class="cp-sv">Ekle</span></button><button type="button" class="btn sm cp-cancel" hidden>Vazgeç</button></div></div></form>
      <p class="muted" style="font-size:12.5px;margin:10px 2px">Fiyat Etiketi Yönetmeliği: kampanya, sepette gösterilen fiyat ve sipariş belgelerinde (ön bilgilendirme formu, sözleşme) sepet dışı fiyatla birlikte yazılır. Uygulama mağazalarında hediye, kullanıcıya “ekstra jeton / gün” olarak gösterilir; mağaza fiyatı değiştirilmez.</p>`;
    const f = main.querySelector('.cp-form'); let editing = null;
    const fill = (c) => { editing = c?.id || null; f.title.value = c?.title || ''; f.pct.value = c?.pct || 20; f.minItems.value = c?.minItems || 2; f.from.value = c?.from || ''; f.to.value = c?.to || '';
      f.querySelectorAll('[name=d]').forEach((x) => { x.checked = c ? c.days.includes(+x.value) : ['6', '0'].includes(x.value); });
      main.querySelector('.cp-h').textContent = c ? `Düzenle: ${c.title}` : 'Yeni kampanya'; main.querySelector('.cp-sv').textContent = c ? 'Kaydet' : 'Ekle'; main.querySelector('.cp-cancel').hidden = !c; if (c) f.scrollIntoView({ behavior: 'smooth' }); };
    main.querySelector('.cp-cancel').onclick = () => fill(null);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const body = { title: f.title.value, pct: +f.pct.value, minItems: +f.minItems.value, from: f.from.value, to: f.to.value, days: [...f.querySelectorAll('[name=d]:checked')].map((x) => +x.value) };
      try { paint(await api(editing ? `/cartpromos/${editing}` : '/cartpromos', editing ? { method: 'PUT', body } : { body })); toast('Kaydedildi.'); } catch (er) { toast(er.message); }
    };
    main.querySelector('.tw').onclick = async (e) => {
      const row = e.target.closest('[data-id]'); if (!row) return; const c = r.list.find((x) => x.id === row.dataset.id);
      if (e.target.closest('.ed')) return fill(c);
      try {
        if (e.target.closest('.tg')) paint(await api(`/cartpromos/${c.id}`, { method: 'PUT', body: { on: !c.on } }));
        if (e.target.closest('.dl') && confirm(`“${c.title}” silinsin mi?`)) paint(await api(`/cartpromos/${c.id}`, { method: 'DELETE' }));
      } catch (er) { toast(er.message); }
    };
  };
  paint(await api('/cartpromos'));
};

// ---- Günlük görevler ----
VIEWS.quests = async (main) => {
  const q = await api('/quests');
  const owner = can('quests');
  const maxDay = q.list.filter((x) => x.goal > 0).reduce((a, x) => a + x.coins, 0) + q.bonus;
  main.innerHTML = `${head('Günlük görevler', 'Kullanıcıların her gün uygulamaya dönmesi için küçük görevler. Hedef 0 yapılan görev gizlenir. Görevler her gece 00:00’da (TR) yenilenir.')}
    <div class="stats"><div class="stat"><b>${q.stats.usersToday}</b><span>Bugün görev ilerleten</span></div><div class="stat"><b>${q.stats.allDoneToday}</b><span>Bugün hepsini bitiren</span></div>
      <div class="stat"><b>${q.stats.coins7d}</b><span>Son 7 günde dağıtılan jeton</span></div><div class="stat"><b>${maxDay}</b><span>Kişi başı günlük en fazla jeton</span></div></div>
    <form class="panel qform"><div class="ph"><h3>Görevler</h3><label class="row" style="gap:6px;font-size:13px"><input type="checkbox" name="en" ${q.enabled ? 'checked' : ''} ${owner ? '' : 'disabled'}> Görevler açık</label></div>
      <div class="tw"><table class="tbl"><thead><tr><th>Görev</th><th class="num">Hedef</th><th class="num">Ödül (jeton)</th><th class="num">Bugün tamamlayan</th></tr></thead><tbody>
      ${q.list.map((x) => `<tr data-id="${esc(x.id)}"><td>${x.em} ${esc(x.title)}</td><td class="num"><input class="field" type="number" min="0" max="100" data-k="goal" value="${x.goal}" style="width:80px" ${owner ? '' : 'disabled'}></td><td class="num"><input class="field" type="number" min="0" max="1000" data-k="coins" value="${x.coins}" style="width:80px" ${owner ? '' : 'disabled'}></td><td class="num">${q.stats.byQuest[x.id] || 0}</td></tr>`).join('')}
      <tr><td>🎁 Hepsini tamamla bonusu</td><td></td><td class="num"><input class="field" type="number" min="0" max="1000" name="bonus" value="${q.bonus}" style="width:80px" ${owner ? '' : 'disabled'}></td><td></td></tr>
      </tbody></table></div>${owner ? `<div class="pb"><button class="btn primary">${icon('check')} Kaydet</button></div>` : ''}</form>`;
  main.querySelector('.qform').onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    const list = [...f.querySelectorAll('tr[data-id]')].map((r) => ({ id: r.dataset.id, goal: +r.querySelector('[data-k="goal"]').value, coins: +r.querySelector('[data-k="coins"]').value }));
    try { await api('/quests', { method: 'PUT', body: { enabled: f.en.checked, bonus: +f.bonus.value, list } }); toast('Kaydedildi.'); VIEWS.quests(main); } catch (er) { toast(er.message); }
  };
  // ---- Hediye çarkı ----
  const w = await api('/wheel');
  const wbox = document.createElement('div'); main.append(wbox);
  const TYPES = { coins: 'Jeton', plus: 'SwipeUp+ (gün)', boost: 'Boost (dakika)' };
  const wimg = (type, amount) => `/img/wheel/${type === 'plus' ? (amount >= 7 ? 'diamond.svg' : 'crown.svg') : type === 'boost' ? 'boost.png' : amount >= 75 ? 'coins-l.png' : amount >= 20 ? 'coins-m.png' : 'coins-s.png'}`;
  const wrow = (s) => `<tr class="wr"><td><img class="wimg" src="${wimg(s.type, +s.amount)}" alt="" style="width:40px;height:40px;object-fit:contain;display:block"></td><td><input class="field" data-k="label" value="${esc(s.label)}" style="width:150px" ${owner ? '' : 'disabled'}></td>
    <td><select class="field" data-k="type" ${owner ? '' : 'disabled'}>${Object.entries(TYPES).map(([k, l]) => `<option value="${k}" ${s.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
    <td class="num"><input class="field" type="number" data-k="amount" value="${s.amount}" style="width:80px" ${owner ? '' : 'disabled'}></td><td class="num"><input class="field" type="number" step="0.1" data-k="chance" value="${s.chance}" style="width:80px" ${owner ? '' : 'disabled'}></td>
    <td class="num">${w.stats.by[s.id] || 0}</td><td>${owner ? `<button type="button" class="btn sm danger wrm">${icon('trash')}</button>` : ''}<input type="hidden" data-k="id" value="${esc(s.id || '')}"></td></tr>`;
  wbox.innerHTML = `<form class="panel wform" style="margin-top:16px"><div class="ph"><h3>🎡 Hediye çarkı</h3><div class="row" style="gap:12px;font-size:13px"><label class="row" style="gap:6px"><input type="checkbox" name="en" ${w.enabled ? 'checked' : ''} ${owner ? '' : 'disabled'}> Çark açık</label><label class="row" style="gap:6px"><input type="checkbox" name="an" ${w.announce ? 'checked' : ''} ${owner ? '' : 'disabled'}> Cuma 12:00 “çark yenilendi” bildirimi</label></div></div>
    <div class="pb muted" style="font-size:12.5px">Herkes her hafta (cumadan cumaya) bir kez çevirir. Aşağıdaki ihtimallerin toplamı hediye çıkma şansıdır; kalanı “PAS” (çarkta 4 PAS dilimi görünür). Ödül görseli türe ve miktara göre otomatik seçilir; kazanma oranı kullanıcıya gösterilmez. Bu hafta: <b>${w.stats.spins}</b> çevirme, <b>${w.stats.wins}</b> hediye, <b>${w.stats.coins}</b> jeton dağıtıldı.</div>
    <div class="tw"><table class="tbl"><thead><tr><th></th><th>Hediye</th><th>Tür</th><th class="num">Miktar</th><th class="num">İhtimal %</th><th class="num">Bu hafta</th><th></th></tr></thead><tbody class="wl">${w.slices.map(wrow).join('')}</tbody></table></div>
    <div class="pb row" style="gap:10px;justify-content:space-between;flex-wrap:wrap"><span class="wsum"></span>${owner ? `<span class="row" style="gap:8px"><button type="button" class="btn sm wadd">${icon('plus')} Hediye</button><button class="btn primary">${icon('check')} Kaydet</button></span>` : ''}</div></form>
    ${w.recent.length ? `<div class="panel" style="margin-top:14px"><div class="ph"><h3>Bu hafta kazananlar</h3></div><div class="pb row" style="gap:8px;flex-wrap:wrap">${w.recent.map((s) => `<span class="chip"><img src="${esc(s.prize.img)}" alt="" style="width:18px;height:18px;object-fit:contain;vertical-align:-4px"> ${esc(s.prize.label)} · @${esc(s.user?.username || '?')}</span>`).join('')}</div></div>` : ''}`;
  const wf = wbox.querySelector('.wform');
  const sum = () => { const t = [...wf.querySelectorAll('[data-k="chance"]')].reduce((a, x) => a + (+x.value || 0), 0); wf.querySelector('.wsum').innerHTML = `Hediye çıkma şansı: <b style="color:${t > 100 ? 'var(--bad)' : 'inherit'}">%${Math.round(t * 10) / 10}</b> · PAS: %${Math.max(0, Math.round((100 - t) * 10) / 10)}`; };
  sum(); wf.oninput = (e) => { sum(); const tr = e.target.closest('.wr'); if (tr) tr.querySelector('.wimg').src = wimg(tr.querySelector('[data-k="type"]').value, +tr.querySelector('[data-k="amount"]').value); };
  wf.onclick = (e) => {
    if (e.target.closest('.wadd')) { wf.querySelector('.wl').insertAdjacentHTML('beforeend', wrow({ label: '', type: 'coins', amount: 10, chance: 1 })); sum(); }
    if (e.target.closest('.wrm')) { e.target.closest('tr').remove(); sum(); }
  };
  wf.onsubmit = async (e) => {
    e.preventDefault();
    const slices = [...wf.querySelectorAll('.wr')].map((r) => Object.fromEntries([...r.querySelectorAll('[data-k]')].map((x) => [x.dataset.k, x.value])));
    try { await api('/wheel', { method: 'PUT', body: { enabled: wf.en.checked, announce: wf.an.checked, slices } }); toast('Çark kaydedildi.'); VIEWS.quests(main); } catch (er) { toast(er.message); }
  };
};

const egImg = (k) => `<img src="/img/eg/${k}.svg" width="24" height="24" alt="" style="vertical-align:-6px;margin-right:8px;border-radius:7px">`;
// ---- Etkileşim: seriler, günün sorusu, kulüpler, seçki, karaoke, paketler, yapay zeka denetimi ----
VIEWS.engage = async (main) => {
  const r = await api('/engage');
  const c = r.settings; const st = r.stats;
  const owner = S.me.role === 'owner' || can('engage');
  const dis = owner ? '' : 'disabled';
  const ms = (o) => Object.entries(o || {}).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(', ');
  const chk = (name, on, label, sub = '') => `<label class="row eg-chk"><input type="checkbox" name="${name}" ${on ? 'checked' : ''} ${dis}><span><b>${label}</b>${sub ? `<small class="muted">${sub}</small>` : ''}</span></label>`;
  const numF = (name, v, label, min, max) => `<label class="fl">${label}<input class="field" type="number" name="${name}" value="${v}" min="${min}" max="${max}" ${dis}></label>`;
  main.innerHTML = `${head('Etkileşim', 'Kullanıcıları her gün geri getiren özellikler: sohbet ve giriş serileri, günün sorusu, kulüpler, günlük seçki, karaoke, Falcı Teyze paketleri ve yapay zeka denetimi.')}
    <div class="stats">
      <div class="stat"><b>${st.chatStreaks}</b><span>Aktif sohbet serisi · en uzun ${st.longestChat} gün</span></div>
      <div class="stat"><b>${st.loginActive}</b><span>Giriş serisi süren · 7+ gün: ${st.login7}</span></div>
      <div class="stat"><b>${st.dqToday}</b><span>Bugün günün sorusuna cevap</span></div>
      <div class="stat"><b>${st.picksToday}</b><span>Bugün seçki açan</span></div>
      <div class="stat"><b>${st.karaokeWeek}</b><span>Bu hafta karaoke · sırada ${st.karaokeQueue}${st.karaokeLive ? ` · sahnede @${esc(st.karaokeLive)}` : ''}</span></div>
      <div class="stat"><b>${st.nowPlaying}</b><span>“Şu an dinlediğim” paylaşan</span></div>
      <div class="stat"><b>${st.packsSold30}</b><span>Son 30 gün fal paketi</span></div>
      <div class="stat"><b>${st.gifts30}</b><span>Son 30 gün sohbette hediye</span></div>
      <div class="stat"><b>${st.aiWarnFlags}</b><span>Son 7 gün yapay zeka uyarısına rağmen gönderilen</span></div>
    </div>
    <form class="eg-form">
      <div class="grid g2">
        <div class="panel"><div class="ph"><h3>${egImg('seri')}Sohbet serisi</h3></div><div class="pb eg-pb">
          ${chk('sEn', c.streak.enabled, 'Sohbet serileri açık', 'İki kişi aynı gün birbirine yazınca seri bir gün uzar.')}
          <label class="fl">Ödüller (gün:jeton, ikisine de)<input class="field" name="sMs" value="${esc(ms(c.streak.milestones))}" ${dis}></label>
          ${numF('sWarn', c.streak.warnHour, '“Serin bitiyor” uyarı saati (TR)', 0, 23)}
        </div></div>
        <div class="panel"><div class="ph"><h3>${egImg('koruyucu')}Günlük giriş serisi</h3></div><div class="pb eg-pb">
          ${chk('lEn', c.login.enabled, 'Giriş serisi açık', 'Her gün uygulamaya giren kullanıcının serisi büyür.')}
          <label class="fl">Ödüller (gün:jeton)<input class="field" name="lMs" value="${esc(ms(c.login.milestones))}" ${dis}></label>
          <div class="row" style="gap:10px">${numF('lFz', c.login.freezeCoins, 'Seri koruyucu (jeton)', 0, 10000)}${numF('lMax', c.login.maxFreezes, 'En fazla koruyucu', 0, 10)}${numF('lWarn', c.login.warnHour, 'Uyarı saati', 0, 23)}</div>
        </div></div>
        <div class="panel"><div class="ph"><h3>${egImg('secki')}Günlük seçki</h3></div><div class="pb eg-pb">
          ${chk('pEn', c.picks.enabled, 'Günlük seçki açık', 'Her sabah ilgi alanı, burç ve konuma göre kişiler seçilir, bildirim gider.')}
          <div class="row" style="gap:10px">${numF('pCnt', c.picks.count, 'Kişi sayısı', 1, 20)}${numF('pHour', c.picks.notifyHour, 'Bildirim saati (TR)', 5, 12)}</div>
        </div></div>
        <div class="panel"><div class="ph"><h3>${egImg('karaoke')}Karaoke odası</h3></div><div class="pb eg-pb">
          ${chk('kEn', c.karaoke.enabled, 'Karaoke açık')}
          ${numF('kMin', c.karaoke.turnMinutes, 'Sahne süresi (dakika)', 2, 15)}
        </div></div>
        <div class="panel"><div class="ph"><h3>${egImg('gorev')}Yapay zeka denetimi (Gemini)</h3><span class="chip ${r.ai.enabled ? 'ok' : 'warn'}">${r.ai.enabled ? 'Bağlı' : 'GEMINI_API_KEY yok'}</span></div><div class="pb eg-pb">
          ${chk('aTxt', c.ai.textCheck, 'Mesajları kontrol et', 'Hakaret içeren mesajda gönderen “Emin misin?” uyarısı görür. Kelime listesi her zaman açık.')}
          ${chk('aImg', c.ai.imageCheck, 'Fotoğrafları kontrol et', 'Uygunsuz fotoğrafta uyarı çıkar; yine de gönderilirse Moderasyon’a düşer.')}
          ${chk('aVer', c.ai.verifyCheck, 'Selfie doğrulamada ön kontrol', 'Poz, canlılık ve profil fotoğrafıyla benzerlik puanı Doğrulama sayfasında görünür.')}
          ${chk('aAuto', c.ai.verifyAuto, 'Çok emin olunca otomatik mavi tik', 'Poz + canlı + aynı kişi ve güven %85 üstüyse onaylanır.')}
          <small class="muted">Başarılı çağrı: ${r.ai.ok || 0} · Hata: ${r.ai.fail || 0}${r.ai.lastError ? ` · Son hata: ${esc(r.ai.lastError)}` : ''}</small>
        </div></div>
        <div class="panel"><div class="ph"><h3>${egImg('fal-burc')}Falcı Teyze paketleri</h3></div><div class="tw"><table class="tbl"><thead><tr><th>Paket</th><th class="num">Jeton</th><th>Açık</th></tr></thead><tbody>
          ${c.packs.map((p) => `<tr data-pk="${esc(p.id)}"><td>${egImg(`pack-${p.id}`)}<b>${esc(p.name)}</b><div class="muted" style="font-size:12px">${esc(p.desc)}</div></td><td class="num"><input class="field" type="number" min="0" data-k="coins" value="${p.coins}" style="width:90px" ${dis}></td><td><input type="checkbox" data-k="enabled" ${p.enabled !== false ? 'checked' : ''} ${dis}></td></tr>`).join('')}
        </tbody></table></div></div>
      </div>
      <div class="panel" style="margin-top:14px"><div class="ph"><h3>${egImg('kulup')}Kulüpler</h3>${owner ? `<button type="button" class="btn sm cl-add">${icon('plus')} Kulüp</button>` : ''}</div><div class="tw"><table class="tbl"><thead><tr><th>Simge</th><th>Kimlik</th><th>Ad</th><th>Açıklama</th><th class="num">Üye</th><th class="num">Paylaşım</th><th></th></tr></thead><tbody class="cl-l">
        ${c.clubs.map((k) => { const x = st.clubs.find((y) => y.id === k.id) || {}; return clubRow(k, x, dis); }).join('')}
      </tbody></table></div></div>
      ${owner ? `<div class="row" style="margin:14px 0;justify-content:flex-end"><button class="btn primary">${icon('check')} Ayarları kaydet</button></div>` : ''}
    </form>
    <div class="panel"><div class="ph"><h3>${egImg('soru')}Günün sorusu</h3></div><div class="pb">
      <p style="margin:0 0 10px">Bugün: <b>${esc(st.dqQuestion)}</b> <span class="muted">· ${st.dqToday} cevap</span></p>
      ${owner ? `<form class="row dq-f" style="gap:8px;flex-wrap:wrap"><input class="field" type="date" name="day" value="${today()}" style="width:auto"><input class="field" name="q" maxlength="160" placeholder="O güne özel soru (boş bırakılırsa havuzdan seçilir)" style="flex:1;min-width:240px"><button class="btn primary">Kaydet</button></form>` : ''}
      ${Object.keys(c.dq).length ? `<div class="tw" style="margin-top:10px"><table class="tbl"><tbody>${Object.entries(c.dq).sort().map(([k, v]) => `<tr><td style="width:120px">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted" style="font-size:13px;margin:10px 0 0">Özel soru planlanmadı; her gün 40 soruluk havuzdan biri sorulur.</p>'}
    </div></div>`;
  const form = main.querySelector('.eg-form');
  form.querySelector('.cl-add')?.addEventListener('click', () => form.querySelector('.cl-l').insertAdjacentHTML('beforeend', clubRow({ id: '', em: '⭐', name: '', desc: '' }, {}, '')));
  form.querySelector('.cl-l').onclick = (e) => { if (e.target.closest('.cl-rm') && confirm('Kulüp listeden kaldırılsın mı? Üyelik ve paylaşımlar silinmez.')) e.target.closest('tr').remove(); };
  form.onsubmit = async (e) => {
    e.preventDefault(); const f = form;
    const body = {
      streak: { enabled: f.sEn.checked, milestones: f.sMs.value, warnHour: +f.sWarn.value },
      login: { enabled: f.lEn.checked, milestones: f.lMs.value, freezeCoins: +f.lFz.value, maxFreezes: +f.lMax.value, warnHour: +f.lWarn.value },
      picks: { enabled: f.pEn.checked, count: +f.pCnt.value, notifyHour: +f.pHour.value },
      karaoke: { enabled: f.kEn.checked, turnMinutes: +f.kMin.value },
      ai: { textCheck: f.aTxt.checked, imageCheck: f.aImg.checked, verifyCheck: f.aVer.checked, verifyAuto: f.aAuto.checked },
      packs: [...f.querySelectorAll('[data-pk]')].map((tr) => ({ id: tr.dataset.pk, coins: +tr.querySelector('[data-k="coins"]').value, enabled: tr.querySelector('[data-k="enabled"]').checked })),
      clubs: [...f.querySelectorAll('.cl-l tr')].map((tr) => Object.fromEntries([...tr.querySelectorAll('[data-k]')].map((x) => [x.dataset.k, x.value.trim()]))),
    };
    try { await api('/engage', { method: 'PUT', body }); toast('Etkileşim ayarları kaydedildi.'); VIEWS.engage(main); } catch (er) { toast(er.message); }
  };
  main.querySelector('.dq-f')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api('/engage/dq', { method: 'PUT', body: { day: e.target.day.value, q: e.target.q.value } }); toast('Günün sorusu kaydedildi.'); VIEWS.engage(main); } catch (er) { toast(er.message); }
  });
};
function clubRow(k, x, dis) {
  return `<tr><td><input class="field" data-k="em" value="${esc(k.em)}" maxlength="4" style="width:56px;text-align:center" ${dis}></td><td><input class="field" data-k="id" value="${esc(k.id)}" maxlength="20" placeholder="ornek" style="width:110px" ${k.id ? 'readonly' : ''} ${dis}></td>
    <td><input class="field" data-k="name" value="${esc(k.name)}" maxlength="30" style="width:150px" ${dis}></td><td><input class="field" data-k="desc" value="${esc(k.desc)}" maxlength="80" style="min-width:220px" ${dis}></td>
    <td class="num">${x.members ?? '—'}</td><td class="num">${x.posts ?? '—'}</td><td>${dis ? '' : `<button type="button" class="btn sm danger cl-rm">${icon('trash')}</button>`}</td></tr>`;
}

// ---- Bildirimler (bu cihaz) ----
function ding() { try { const a = new AudioContext(); const o = a.createOscillator(); const g = a.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(0.12, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.5); o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + 0.5); } catch {} }
const pushOk = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
async function adminPushState() {
  if (!pushOk()) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration(BASE + '/');
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : Notification.permission === 'denied' ? 'denied' : 'off';
}
async function enableAdminPush() {
  const cfg = await fetch('/api/config').then((r) => r.json());
  if (!cfg.vapidPublicKey) throw new Error('Sunucuda bildirim anahtarı yok.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Tarayıcı bildirim iznini vermedi.');
  const reg = await navigator.serviceWorker.register(BASE + '/sw.js', { scope: BASE + '/' });
  await navigator.serviceWorker.ready;
  const key = Uint8Array.from(atob(cfg.vapidPublicKey.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (cfg.vapidPublicKey.length % 4)) % 4)), (c) => c.charCodeAt(0));
  const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await api('/push', { body: { sub: sub.toJSON() } });
}
async function disableAdminPush() {
  const reg = await navigator.serviceWorker.getRegistration(BASE + '/');
  const sub = await reg?.pushManager.getSubscription();
  if (sub) { await api('/push', { method: 'DELETE', body: { endpoint: sub.endpoint } }).catch(() => {}); await sub.unsubscribe(); }
}

// ---- Destek talepleri ----
const SUPST = { open: ['warn', 'Cevap bekliyor'], answered: ['ok', 'Cevaplandı'], closed: ['', 'Kapandı'] };
const QUICK = [
  ['Selamlama', 'Merhaba, bize yazdığın için teşekkürler. '],
  ['Jeton yüklendi', 'Merhaba, ödemeni kontrol ettik ve jetonların hesabına yüklendi. İyi eğlenceler!'],
  ['Bilgi iste', 'Merhaba, sorununu inceleyebilmemiz için biraz daha ayrıntı (ne zaman oldu, hangi ekranda, varsa ekran görüntüsü) paylaşabilir misin?'],
  ['Çözüldü', 'Sorununu çözdük. Başka bir konuda yardıma ihtiyacın olursa buradan yazabilirsin.'],
];
let supFilter = 'open';
VIEWS.support = async (main) => {
  const openId = (location.hash.split('/')[2] || '');
  const [r, ps] = await Promise.all([api(`/support?status=${supFilter}`), adminPushState().catch(() => 'unsupported')]);
  S.counts.supportOpen = r.counts.open;
  const pushBtn = ps === 'on' ? `<button class="btn sm pushx">${icon('bell')} Bildirimler açık</button><button class="btn sm pusht">Dene</button>`
    : ps === 'denied' ? '<span class="chip bad">Tarayıcı bildirimleri engelli</span>' : ps === 'unsupported' ? '<span class="chip">Bu tarayıcı bildirim desteklemiyor</span>' : `<button class="btn primary sm pushon">${icon('bell')} Bu cihazda bildirim al</button>`;
  main.innerHTML = `${head('Destek', 'Kullanıcıların açtığı destek talepleri. Cevabın uygulamada kullanıcıya bildirim olarak gider. Yeni talep ya da cevap gelince bildirim almak için bu cihazda bildirimleri aç (telefonda da açabilirsin).', `<div class="row" style="gap:6px">${pushBtn}</div>`)}
    <div class="tabs supt">${[['open', 'Cevap bekleyen'], ['answered', 'Cevaplanan'], ['closed', 'Kapalı'], ['all', 'Tümü']].map(([k, l]) => `<button data-s="${k}" class="${supFilter === k ? 'on' : ''}">${l} <span class="muted">${r.counts[k]}</span></button>`).join('')}</div>
    <div class="supgrid"><div class="panel suplist">${r.items.length ? r.items.map((t) => `<a class="supi ${t.adminUnread ? 'unread' : ''} ${t.id === openId ? 'on' : ''}" href="#/support/${esc(t.id)}">
        <img class="av" src="${esc(t.user?.avatar || '')}" alt=""><div class="grow"><div class="ell"><b>${esc(t.subject)}</b></div><div class="muted ell">#${t.no} · ${esc(t.user?.name || 'Silinmiş')} · ${esc(t.categoryLabel)}</div><div class="ell" style="font-size:12.5px">${t.lastFrom === 'admin' ? '↩︎ ' : ''}${esc(t.last)}</div></div>
        <div style="text-align:right"><span class="chip ${SUPST[t.status][0]}">${SUPST[t.status][1]}</span><div class="muted" style="font-size:11px;margin-top:4px">${dt(t.lastAt)}</div></div></a>`).join('') : '<div class="empty">Bu listede talep yok.</div>'}</div>
      <div class="panel supth"><div class="empty">Soldan bir talep seç.</div></div></div>`;
  main.querySelector('.supt').onclick = (e) => { const b = e.target.closest('[data-s]'); if (!b) return; supFilter = b.dataset.s; VIEWS.support(main); };
  main.querySelector('.pushon')?.addEventListener('click', async () => { try { await enableAdminPush(); toast('Bildirimler açıldı.'); VIEWS.support(main); } catch (er) { toast(er.message); } });
  main.querySelector('.pushx')?.addEventListener('click', async () => { if (!confirm('Bu cihazda bildirimler kapatılsın mı?')) return; await disableAdminPush(); VIEWS.support(main); });
  main.querySelector('.pusht')?.addEventListener('click', async () => { try { await api('/push/test', { body: {} }); toast('Deneme bildirimi gönderildi.'); } catch (er) { toast(er.message); } });
  const th = main.querySelector('.supth');
  const openT = async (id) => {
    const t = await api(`/support/${id}`);
    th.innerHTML = `<div class="ph"><div><h3>${esc(t.subject)} <span class="muted">#${t.no}</span></h3><div class="muted" style="font-size:12.5px">${esc(t.categoryLabel)} · ${dt(t.at)} · <span class="chip ${SUPST[t.status][0]}">${SUPST[t.status][1]}</span></div></div>
        <div class="row" style="gap:6px">${t.status !== 'closed' ? '<button class="btn sm st" data-st="closed">Kapat</button>' : '<button class="btn sm st" data-st="open">Yeniden aç</button>'}</div></div>
      <div class="supuser">${userCell(t.user)}<div class="muted" style="font-size:12px">${t.user ? `${t.user.email ? esc(t.user.email) + ' · ' : ''}${t.user.coins} jeton${t.user.plus ? ' · SwipeUp+' : ''} · üye: ${d(t.user.createdAt)}${t.others ? ` · ${t.others} başka talep` : ''}` : ''}</div>${t.user ? `<a class="btn sm" href="#/users/${esc(t.user.id)}">Profil</a>` : ''}</div>
      <div class="supmsgs">${t.msgs.map((m) => `<div class="sm ${m.from}"><div class="b">${m.image ? `<a href="${esc(m.image)}" target="_blank" rel="noopener"><img src="${esc(m.image)}" alt=""></a>` : ''}${esc(m.text).replace(/\n/g, '<br>')}</div><small>${m.from === 'admin' ? `@${esc(m.by || '')} · ` : ''}${dt(m.at)}</small></div>`).join('')}</div>
      <form class="suprep"><div class="quick">${QUICK.map(([l], i) => `<button type="button" class="btn sm" data-q="${i}">${esc(l)}</button>`).join('')}</div>
        <textarea class="field" name="t" rows="4" maxlength="3000" placeholder="Cevabını yaz… (kullanıcıya bildirim olarak gider)"></textarea>
        <div class="row" style="gap:8px;justify-content:flex-end"><label class="row" style="gap:6px;font-size:13px"><input type="checkbox" name="c"> Cevapla ve kapat</label><button class="btn primary">${icon('send')} Gönder</button></div></form>
      ${t.device ? `<div class="muted" style="font-size:11px;padding:0 16px 12px">Cihaz: ${esc(t.device)}</div>` : ''}`;
    const ms = th.querySelector('.supmsgs'); ms.scrollTop = ms.scrollHeight;
    const f = th.querySelector('form');
    f.querySelector('.quick').onclick = (e) => { const b = e.target.closest('[data-q]'); if (!b) return; f.t.value = (f.t.value ? `${f.t.value}\n` : '') + QUICK[+b.dataset.q][1]; f.t.focus(); };
    f.onsubmit = async (e) => {
      e.preventDefault();
      try { await api(`/support/${id}/reply`, { body: { text: f.t.value, close: f.c.checked } }); toast('Cevap gönderildi.'); refreshCounts(); VIEWS.support(main); } catch (er) { toast(er.message); }
    };
    th.querySelector('.st').onclick = async (e) => { await api(`/support/${id}/status`, { body: { status: e.target.dataset.st } }); VIEWS.support(main); };
    main.querySelectorAll('.supi').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#/support/${id}`));
    main.querySelector('.supi.on')?.classList.remove('unread');
  };
  if (openId) openT(openId).catch((er) => { th.innerHTML = `<div class="empty">${esc(er.message)}</div>`; });
};

// ---- Ayarlar: ödeme, fiyatlar, yasal ----
VIEWS.settings = async (main) => {
  const [e, legal, evs] = await Promise.all([api('/economy'), api('/legal'), api('/event').catch(() => null)]);
  const owner = can('settings');
  const rows = (list, cols) => list.map((x, i) => `<div class="erow" data-i="${i}">${cols.map(([k, ph, w, type]) => `<input class="field" data-k="${k}" value="${esc(x[k] ?? '')}" placeholder="${ph}" style="width:${w}" ${type ? `type="${type}" step="any"` : ''}>`).join('')}<button type="button" class="btn sm danger rmr">${icon('trash')}</button></div>`).join('');
  const PACK = [['coins', 'Jeton', '90px', 'number'], ['price', 'Fiyat ₺', '100px', 'number'], ['tag', 'Etiket', '110px'], ['salePrice', 'Kampanya ₺', '110px', 'number'], ['saleUntil', 'Bitiş', '150px', 'date']];
  const PLAN = [['days', 'Gün', '80px', 'number'], ['price', 'Fiyat ₺', '100px', 'number'], ['tag', 'Etiket', '110px'], ['salePrice', 'Kampanya ₺', '110px', 'number'], ['saleUntil', 'Bitiş', '150px', 'date']];
  const saleHint = '<p class="muted" style="margin:6px 0 0;font-size:12.5px">Kampanya: kampanya fiyatı ve bitiş tarihi gir. Mağazada eski fiyat olarak son 30 günün en düşük fiyatı ve gerçek indirim oranı kendiliğinden gösterilir (yönetmelik gereği). “İndirim” yazan etiket kullanılamaz.</p>';
  const saleNow = (list) => list.filter((p) => p.was).map((p) => `<span class="chip ok">${esc(p.id)}: ${tl(p.was)} → ${tl(p.now)} (%${p.off}) · ${esc(p.saleUntil)}</span>`).join(' ');
  const GIFT = [['em', 'Emoji', '70px'], ['name', 'Ad', '120px'], ['coins', 'Jeton', '90px', 'number']];
  main.innerHTML = `${head('Ayarlar', owner ? 'Uygulamadaki mağaza, fiyatlar ve yasal iletişim bilgileri.' : 'Bu ayarları sadece sahip yönetici değiştirebilir.')}
    <details class="panel asw-p" hidden style="margin-bottom:14px"><summary class="pb" style="cursor:pointer"><b>Apple ile giriş (web / Android)</b> <span class="muted asw-st" style="font-size:12.5px"></span></summary><div class="pb asw-b"></div></details>
    <details class="panel iap-p" hidden style="margin-bottom:14px"><summary class="pb" style="cursor:pointer"><b>Mağaza içi satın alma</b> <span class="muted iap-st" style="font-size:12.5px"></span></summary><div class="pb iap-b"></div></details>
    <details class="panel asc-p" hidden style="margin-bottom:14px"><summary class="pb" style="cursor:pointer"><b>App Store ürünleri ve fiyatları</b> <span class="muted asc-st" style="font-size:12.5px"></span></summary><div class="pb asc-b"></div></details>
    <form class="grid g2 eco">
      <div class="panel"><div class="ph"><h3>Havale / EFT bilgileri</h3></div><div class="pb fgrid">
        <label>IBAN<input class="field" name="iban" value="${esc(e.bank.iban)}" placeholder="TR00 0000 0000 0000 0000 0000 00"></label>
        <label>Alıcı adı<input class="field" name="bname" value="${esc(e.bank.name)}" placeholder="Hesap sahibi"></label>
        <label>Banka<input class="field" name="bbank" value="${esc(e.bank.bankName)}"></label>
        <label>Not<input class="field" name="bnote" value="${esc(e.bank.note)}"></label>
        <p class="muted" style="margin:0;font-size:12.5px">IBAN boşsa uygulamada satın alma kapalı görünür.</p></div></div>
      <div class="panel"><div class="ph"><h3>Fal fiyatları ve paylar</h3></div><div class="pb fgrid">
        ${Object.entries(FAL).map(([k, l]) => `<label>${l} (jeton)<input class="field" type="number" name="fal_${k}" value="${e.falPrices[k]}"></label>`).join('')}
        <label>Falcı Teyze payı (0–1)<input class="field" type="number" step="0.05" name="falciShare" value="${e.falciShare}"></label>
        <label>Yayıncıya 1 jeton hediye başına (₺)<input class="field" type="number" step="0.05" name="creatorShare" value="${e.creatorShare}"></label>
        <label>1 kazanç biriminin TL karşılığı<input class="field" type="number" step="0.01" name="coinTL" value="${e.coinTL}"></label></div></div>
      <div class="panel"><div class="ph"><h3>SwipeUp+ planları</h3><button type="button" class="btn sm add" data-l="plans">${icon('plus')}</button></div><div class="pb"><div class="list-plans">${rows(e.plusPlans, PLAN)}</div>${saleNow(e.plusPlans)}${saleHint}</div></div>
      <div class="panel"><div class="ph"><h3>Jeton paketleri</h3><button type="button" class="btn sm add" data-l="packs">${icon('plus')}</button></div><div class="pb"><div class="list-packs">${rows(e.coinPacks, PACK)}</div>${saleNow(e.coinPacks)}${saleHint}</div></div>
      <div class="panel"><div class="ph"><h3>Canlı yayın hediyeleri</h3><button type="button" class="btn sm add" data-l="gifts">${icon('plus')}</button></div><div class="pb list-gifts">${rows(e.gifts, GIFT)}</div></div>
      <div class="panel"><div class="ph"><h3>Sınırlar ve boost</h3></div><div class="pb fgrid">
        <label>Ücretsiz günlük beğeni<input class="field" type="number" name="freeLikes" value="${e.freeLikes}"></label>
        <label>Ücretsiz günlük süper beğeni<input class="field" type="number" name="freeSupers" value="${e.freeSupers}"></label>
        <label>SwipeUp+ günlük süper beğeni<input class="field" type="number" name="plusSupers" value="${e.plusSupers}"></label>
        <label>Boost fiyatı (jeton)<input class="field" type="number" name="boostCoins" value="${e.boostCoins}"></label>
        <label>Boost süresi (dakika)<input class="field" type="number" name="boostMinutes" value="${e.boostMinutes}"></label>
        <label>5'li süper beğeni (jeton)<input class="field" type="number" name="sp0" value="${(e.superPacks || [])[0]?.coins ?? 40}"></label>
        <label>15'li süper beğeni (jeton)<input class="field" type="number" name="sp1" value="${(e.superPacks || [])[1]?.coins ?? 100}"></label>
        <label>Aylık davet yarışı ödülleri (1. / 2. / 3., jeton)<input class="field" name="invP" value="${(e.invitePrizes || [300, 150, 75]).join(' / ')}"></label>
        <label>Yeni üyeye SwipeUp+ denemesi (gün, 0 = kapalı)<input class="field" type="number" name="plusTrialDays" min="0" max="30" value="${e.plusTrialDays ?? 3}"></label></div></div>
      <div class="panel"><div class="ph"><h3>Tanışma özellikleri</h3></div><div class="pb fgrid">
        <label>Süper mesaj (jeton)<input class="field" type="number" name="superMsgCoins" value="${e.superMsgCoins ?? 30}"></label>
        <label>Davet ödülü (iki tarafa, jeton)<input class="field" type="number" name="inviteCoins" value="${e.inviteCoins ?? 50}"></label>
        <label>Falcı Teyze aylık abonelik (jeton)<input class="field" type="number" name="falSubCoins" value="${e.falSubCoins ?? 250}"></label>
        <p class="muted" style="margin:0;font-size:12.5px">Abonelik: her pazartesi burç yorumu ve ayda bir kahve falı. Falcı Teyze payı abonelikte de geçerli.</p></div></div>
      <div class="panel"><div class="ph"><h3>Satıcı ve künye bilgileri</h3><a class="btn sm" href="#/hukuk">Hukuk ve uyum</a></div><div class="pb fgrid">
        <label>Satıcı / veri sorumlusu (şirket unvanı ya da ad soyad)<input class="field" name="lcompany" value="${esc(legal.company || '')}"></label>
        <label>Marka adı<input class="field" name="lbrand" value="${esc(legal.brand || '')}" placeholder="SwipeUp"></label>
        <label>Açık adres<input class="field" name="laddress" value="${esc(legal.address || '')}" placeholder="Mahalle, cadde, no, ilçe / il"></label>
        <label>İletişim e-postası<input class="field" name="lemail" type="email" value="${esc(legal.email || '')}"></label>
        <label>Telefon<input class="field" name="lphone" type="tel" value="${esc(legal.phone || '')}" placeholder="0 (5xx) xxx xx xx"></label>
        <label>KEP adresi<input class="field" name="lkep" type="email" value="${esc(legal.kep || '')}" placeholder="unvan@hs01.kep.tr"></label>
        <label>MERSİS no (şirketse, 16 hane)<input class="field" name="lmersis" inputmode="numeric" value="${esc(legal.mersis || '')}"></label>
        <label>Vergi kimlik no (şahıs şirketinde T.C. kimlik no)<input class="field" name="lvkn" inputmode="numeric" value="${esc(legal.vkn || '')}"></label>
        <label>Vergi dairesi<input class="field" name="ltaxOffice" value="${esc(legal.taxOffice || '')}"></label>
        <label>Ticaret sicil no<input class="field" name="lsicil" value="${esc(legal.sicil || '')}"></label>
        <label>ETBİS kayıt bağlantısı ya da kayıt no<input class="field" name="letbis" value="${esc(legal.etbis || '')}" placeholder="https://etbis.ticaret.gov.tr/..."></label>
        <label>Ödeme onayından sonra teslim süresi (saat, 1–72)<input class="field" type="number" min="1" max="72" name="ldeliveryHours" value="${esc(legal.deliveryHours ?? 24)}"></label>
        <label>Ödenmeyen siparişin iptal süresi (saat, 24–168)<input class="field" type="number" min="24" max="168" name="lpayHours" value="${esc(legal.payHours ?? 72)}"></label>
        <label class="row" style="gap:8px;cursor:pointer;font-weight:500"><input type="checkbox" name="lrefund14" ${legal.refund14 === false ? '' : 'checked'} style="width:18px;height:18px;accent-color:var(--brand)"><span><b>14 gün içinde harcanmamış jeton iadesi</b> <span class="muted">— kanunen zorunlu değil, güven için önerilir</span></span></label>
        <p class="muted" style="margin:0;font-size:12.5px">Bu bilgiler Künye, KVKK aydınlatma metni, ön bilgilendirme formu ve mesafeli satış sözleşmesinde gösterilir. Eksik bilgiler Hukuk ve uyum bölümünde listelenir.</p></div></div>
      ${owner ? `<div class="savebar"><button class="btn primary">${icon('check')} Kaydet</button></div>` : ''}
    </form>
    ${evs ? eventPanel(evs, owner) : ''}
    <div class="rooms-panel"></div>`;
  // Apple ile giriş (web): Services ID + dönüş adresi. Yalnız sahip görür; sunucu ayar dosyasında varsa o geçerlidir.
  const asw = main.querySelector('.asw-p');
  const aswPaint = (r) => {
    asw.hidden = false;
    asw.querySelector('.asw-st').textContent = r.on ? `açık · ${r.clientId}` : 'kapalı: Android ve tarayıcıda Apple düğmesi görünmez';
    asw.querySelector('.asw-b').innerHTML = `<p class="muted" style="font-size:12.5px;margin:0 0 8px">developer.apple.com → Identifiers → <b>Services IDs</b> → kimliğini aç → Sign in with Apple → Configure: Primary App ID <b>app.swipeup.ios</b>, Domains <b>swipeup.live</b>, Return URL aşağıdaki dönüş adresi. iPhone uygulamasındaki Apple girişi bu ayardan bağımsız çalışır.</p>
      ${r.fromEnv ? '<p class="muted" style="font-size:12.5px;margin:0 0 8px">Sunucu ayar dosyasında (APPLE_CLIENT_ID) değer var; o geçerli.</p>' : ''}
      <div style="display:grid;gap:6px"><label class="muted" style="font-size:12.5px">Services ID<input class="field asi" placeholder="app.swipeup.web" value="${esc(r.clientId || '')}"></label>
        <label class="muted" style="font-size:12.5px">Dönüş adresi (Return URL)<input class="field asr" value="${esc(r.redirect || r.suggest)}"></label>
        <div class="row" style="gap:8px"><button type="button" class="btn sm primary ass">Kaydet</button>${r.saved ? '<button type="button" class="btn sm danger asd">Kaldır</button>' : ''}</div></div>`;
    asw.querySelector('.ass').onclick = async () => {
      try { aswPaint(await api('/applesignin', { body: { clientId: asw.querySelector('.asi').value, redirect: asw.querySelector('.asr').value } })); toast('Apple ile giriş ayarı kaydedildi.'); } catch (er) { toast(er.message); }
    };
    const d = asw.querySelector('.asd'); if (d) d.onclick = async () => { if (!confirm('Apple ile giriş (web) ayarı kaldırılsın mı?')) return; try { aswPaint(await api('/applesignin', { method: 'DELETE' })); } catch (er) { toast(er.message); } };
  };
  api('/applesignin').then(aswPaint).catch(() => {});
  // Google Play / App Store anahtarları ve ürün kimlikleri (yalnız sahip görür)
  const ip = main.querySelector('.iap-p');
  const iapPaint = (r) => {
    ip.hidden = false; const g = r.google; const a = r.apple;
    ip.querySelector('.iap-st').textContent = `Google Play: ${g.on ? 'açık' : 'kapalı'} · App Store: ${a.on ? 'açık' : 'kapalı'}${r.count ? ` · ${r.count} satın alma` : ''}`;
    ip.querySelector('.iap-b').innerHTML = `<p class="muted" style="font-size:13px;margin:0 0 8px"><b>Sepet:</b> aynı üründen birden çok adet tek ödemede alınır. App Store’da ek ayar gerekmez; Google Play’de her ürünün ayarında <b>“Çoklu adet” (multi-quantity)</b> seçeneğini aç, yoksa her adet için ayrı pencere açılır.</p><p class="muted" style="font-size:13px;margin:0 0 8px">Android ve iOS uygulamasında jeton ve SwipeUp+ mağazanın kendi ödemesiyle satılır (mağazalar dijital ürünlerde bunu şart koşar). Ürünleri <b>aynı kimliklerle</b> açman yeterli: Play Console → Para kazanma → Uygulama içi ürünler; App Store’daki ürünleri ve fiyatları aşağıdaki <b>“App Store ürünleri ve fiyatları”</b> bölümü kendisi açar ve günceller. SwipeUp+ otomatik yenilenmez.</p>
      <div class="tw"><table class="tbl"><thead><tr><th>Ürün kimliği</th><th>Ürün</th></tr></thead><tbody>${r.skus.map((x) => `<tr><td><b class="mono">${esc(x.sku)}</b></td><td>${esc(x.title)}</td></tr>`).join('')}</tbody></table></div>
      <h4 style="margin:14px 0 6px">Google Play ${g.on ? `<span class="chip ok">açık</span> <span class="muted" style="font-size:12px">${esc(g.email)} · ${esc(g.pkg)}</span>` : '<span class="chip">kapalı</span>'}</h4>
      <form class="iap-g row" style="flex-direction:column;align-items:stretch;gap:6px"><p class="muted" style="font-size:12.5px;margin:0">Google Cloud’da bir hizmet hesabı oluştur, JSON anahtarını indir; Play Console → Kullanıcılar ve izinler’de bu hesaba “Finansal verileri görüntüleme” ve “Siparişleri yönetme” izni ver. Dosyanın içeriğini aşağıya yapıştır; kaydetmeden önce Google’a giriş denenir.</p>
        <input class="field" name="pkg" value="${esc(g.pkg)}" placeholder="Paket adı (app.swipeup.twa)"><textarea class="field mono" name="json" rows="4" placeholder='{"type": "service_account", ...}'></textarea>
        <div class="row" style="gap:8px"><button class="btn sm primary">Kaydet</button>${g.on ? '<button type="button" class="btn sm danger iap-del" data-k="google">Kaldır</button>' : ''}</div></form>
      <h4 style="margin:14px 0 6px">App Store ${a.on ? `<span class="chip ok">açık</span> <span class="muted" style="font-size:12px">${esc(a.keyId)} · ${esc(a.bundleId)}</span>` : '<span class="chip">kapalı</span>'}</h4>
      <form class="iap-a row" style="flex-direction:column;align-items:stretch;gap:6px"><p class="muted" style="font-size:12.5px;margin:0">App Store Connect → Kullanıcılar ve Erişim → Entegrasyonlar → <b>Uygulama İçi Satın Alma</b> anahtarı oluştur, .p8 dosyasını indir. Issuer ID aynı sayfanın üstünde yazar.</p><p class="muted" style="font-size:12.5px;margin:0">İadeler: App Store Connect → uygulaman → Uygulama Bilgileri → <b>App Store Sunucu Bildirimleri</b> → Sürüm 2 → Üretim ve Sandbox adresine <b class="mono">${esc(location.origin)}/api/iap/apple/notify</b> yaz; iade olunca jeton anında düşer. Yazmazsan son 90 günün satın almaları 12 saatte bir Apple’a sorulur. Google Play iadeleri 6 saatte bir kontrol edilir.</p>
        <div class="row" style="gap:6px;flex-wrap:wrap"><input class="field" name="keyId" placeholder="Key ID (10 karakter)" value="${esc(a.keyId || '')}" style="flex:1"><input class="field" name="issuerId" placeholder="Issuer ID" value="${esc(a.issuerId || '')}" style="flex:2"><input class="field" name="bundleId" value="${esc(a.bundleId)}" placeholder="Paket kimliği" style="flex:1"></div>
        <textarea class="field mono" name="key" rows="4" placeholder="-----BEGIN PRIVATE KEY-----"></textarea>
        <div class="row" style="gap:8px"><button class="btn sm primary">Kaydet</button>${a.on ? '<button type="button" class="btn sm danger iap-del" data-k="apple">Kaldır</button>' : ''}</div></form>
      ${r.recent.length ? `<h4 style="margin:14px 0 6px">Son satın almalar</h4><div class="tw"><table class="tbl"><tbody>${r.recent.map((x) => `<tr><td>${dt(x.at)}</td><td>@${esc(x.user)}</td><td class="mono">${esc(x.sku)}</td><td>${x.channel === 'google' ? 'Google Play' : 'App Store'}${x.test ? ' · <span class="chip">deneme</span>' : ''}${x.status === 'refunded' ? ' · <span class="chip bad">iade</span>' : ''}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
    const gf = ip.querySelector('.iap-g'); const af = ip.querySelector('.iap-a');
    gf.onsubmit = async (e) => { e.preventDefault(); try { iapPaint(await api('/iap/google', { body: { pkg: gf.pkg.value, json: gf.json.value } })); toast('Google Play bağlantısı doğrulandı ve kaydedildi.'); } catch (er) { toast(er.message); } };
    af.onsubmit = async (e) => { e.preventDefault(); try { iapPaint(await api('/iap/apple', { body: { keyId: af.keyId.value, issuerId: af.issuerId.value, bundleId: af.bundleId.value, key: af.key.value } })); toast('App Store anahtarı kaydedildi.'); } catch (er) { toast(er.message); } };
    ip.querySelectorAll('.iap-del').forEach((b) => { b.onclick = async () => { if (!confirm('Anahtar kaldırılsın mı? Uygulamada o mağazadan satış durur.')) return; try { iapPaint(await api(`/iap/${b.dataset.k}`, { method: 'DELETE' })); } catch (er) { toast(er.message); } }; });
  };
  api('/iap').then(iapPaint).catch(() => {});
  // App Store Connect: ürünleri aç, fiyatları paneldeki fiyattan eşitle (yalnız sahip görür)
  const ap = main.querySelector('.asc-p'); let apT = null;
  const trl = (v) => (v == null ? '—' : `₺${(+v).toFixed(2).replace('.', ',')}`);
  const ascPaint = (r) => {
    ap.hidden = false; clearTimeout(apT);
    const bad = r.items.filter((x) => x.err).length; const miss = r.items.filter((x) => !x.state).length;
    ap.querySelector('.asc-st').textContent = !r.on ? 'bağlı değil' : r.running ? 'eşitleniyor…' : bad ? `${bad} üründe hata` : miss ? 'eşitlenmedi' : 'eşit';
    ap.querySelector('.asc-b').innerHTML = !r.on ? `
      <p class="muted" style="font-size:13px;margin:0 0 8px">Bağlayınca jeton paketleri ve SwipeUp+ süreleri App Store'da <b>kendiliğinden açılır</b>, Türkçe adı ve açıklaması yazılır; buradaki fiyat değişince App Store fiyatı da birkaç saniye içinde güncellenir. App Store Connect'e girmen gerekmez.</p>
      <p class="muted" style="font-size:12.5px;margin:0 0 8px">App Store Connect → Kullanıcılar ve Erişim → Entegrasyonlar → <b>Ekip Anahtarları</b> (App Store Connect API) → rolü <b>Uygulama Yöneticisi</b> ya da <b>Yönetici</b> olan bir anahtar oluştur, .p8 dosyasını indir. Bu, yukarıdaki “Uygulama İçi Satın Alma” anahtarından farklıdır; uygulamayı yüklemek için açtığın anahtarı da kullanabilirsin.</p>
      <form class="asc-k" style="display:flex;flex-direction:column;gap:6px"><div class="row" style="gap:6px;flex-wrap:wrap"><input class="field" name="keyId" placeholder="Key ID (10 karakter)" style="flex:1"><input class="field" name="issuerId" placeholder="Issuer ID" style="flex:2"></div>
        <textarea class="field mono" name="key" rows="4" placeholder="-----BEGIN PRIVATE KEY-----"></textarea><div><button class="btn sm primary">Bağla</button></div></form>` : `
      <p class="muted" style="font-size:12.5px;margin:0 0 8px">Bağlı: <span class="mono">${esc(r.keyId)}</span> · ${esc(r.bundleId)}${r.last ? ` · son eşitleme ${dt(r.last.at)}` : ''}. Apple yalnız hazır fiyat basamaklarını kabul eder; en yakın basamak seçilir (ör. ₺100 → ₺99,99). Diğer ülkelerin fiyatını Apple kurla hesaplar.</p>
      <div class="row" style="gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
        <label class="muted" style="font-size:12.5px">App Store fiyat farkı %<input class="field asc-mk" type="number" min="0" max="100" step="0.5" value="${r.markup}" style="width:80px;margin-left:6px"></label>
        <label class="muted" style="font-size:12.5px"><input type="checkbox" class="asc-au" ${r.auto ? 'checked' : ''}> Fiyat değişince otomatik gönder</label>
        <button class="btn sm primary asc-go" ${r.running ? 'disabled' : ''}>${r.running ? 'Eşitleniyor…' : 'Şimdi eşitle'}</button>
        <button class="btn sm asc-del danger">Bağlantıyı kaldır</button></div>
      <p class="muted" style="font-size:12px;margin:0 0 8px">Fark yüzdesi: Apple'ın komisyonunu karşılamak için App Store fiyatını sitedekinden bu kadar yüksek tutar (ör. 15 → ₺100'lük paket ₺114,99). Sitedeki ve Google Play'deki fiyat değişmez.</p>
      <div class="tw"><table class="tbl"><thead><tr><th>Ürün</th><th>Panel fiyatı</th><th>App Store</th><th>Durum</th></tr></thead><tbody>${r.items.map((x) => `<tr><td><b>${esc(x.title)}</b><div class="muted mono" style="font-size:11.5px">${esc(x.sku)}</div></td><td>${trl(x.price)}${x.target !== x.price ? `<div class="muted" style="font-size:11.5px">hedef ${trl(x.target)}</div>` : ''}</td><td>${trl(x.apple)}${x.pending && x.apple != null ? ' <span class="chip">bekliyor</span>' : ''}</td><td>${x.err ? `<span class="chip bad">hata</span> <span class="muted" style="font-size:12px">${esc(x.err)}</span>` : x.state ? `<span class="chip ${x.stateKey === 'APPROVED' ? 'ok' : ''}">${esc(x.state)}</span>${x.miss?.length ? `<div class="muted" style="font-size:11.5px;margin-top:4px">Eksik: ${esc(x.miss.join(' · '))}</div>` : x.stateKey === 'MISSING_METADATA' ? '<div class="muted" style="font-size:11.5px;margin-top:4px">Ürün bilgileri tam; Apple ilk ürünleri uygulama sürümüyle birlikte istiyor.</div>' : ''}` : '<span class="muted">henüz açılmadı</span>'}</td></tr>`).join('')}</tbody></table></div>
      <h4 style="margin:14px 0 6px">İnceleme görseli ${r.shot ? `<span class="chip ok">yüklendi</span> <span class="muted" style="font-size:12px">${r.shot.size ? `${r.shot.size} · ` : ''}${dt(r.shot.at)}</span>` : '<span class="chip">yok</span>'}</h4>
      <p class="muted" style="font-size:12.5px;margin:0 0 6px">Apple her ürün için satın alma ekranının bir görüntüsünü ister. Telefonda Mağaza sayfasının ekran görüntüsünü al ve <b>kırpmadan, düzenlemeden</b> seç (Apple orijinal ekran boyutunu ister); bütün ürünlere eklenir.</p>
      <input type="file" class="asc-shot" accept="image/png,image/jpeg">
      ${r.last?.log?.length ? `<details style="margin-top:10px"><summary class="muted" style="cursor:pointer;font-size:12.5px">Son eşitleme kaydı</summary><ul style="font-size:12.5px;margin:6px 0 0;padding-left:18px">${r.last.log.map((l) => `<li${l.err ? ' style="color:var(--bad,#c33)"' : ''}><span class="mono">${esc(l.sku)}</span> ${esc(l.text)}</li>`).join('')}</ul></details>` : ''}`;
    const kf = ap.querySelector('.asc-k');
    if (kf) kf.onsubmit = async (e) => { e.preventDefault(); const b = kf.querySelector('button'); b.disabled = true; try { ascPaint(await api('/asc/key', { body: { keyId: kf.keyId.value, issuerId: kf.issuerId.value, key: kf.key.value } })); toast('App Store Connect bağlandı. Şimdi “Şimdi eşitle”ye bas.'); } catch (er) { toast(er.message); b.disabled = false; } };
    const q = (c) => ap.querySelector(c);
    if (q('.asc-go')) q('.asc-go').onclick = async () => { try { ascPaint(await api('/asc/sync', { body: {} })); } catch (er) { toast(er.message); } };
    if (q('.asc-mk')) q('.asc-mk').onchange = async (e) => { try { ascPaint(await api('/asc/settings', { body: { markup: e.target.value } })); toast('Fark kaydedildi; otomatik gönderim açıksa App Store fiyatları güncelleniyor.'); } catch (er) { toast(er.message); } };
    if (q('.asc-au')) q('.asc-au').onchange = async (e) => { try { ascPaint(await api('/asc/settings', { body: { auto: e.target.checked } })); } catch (er) { toast(er.message); } };
    if (q('.asc-del')) q('.asc-del').onclick = async () => { if (!confirm('App Store Connect bağlantısı kaldırılsın mı? Ürünler App Store’da kalır, sadece fiyatlar artık buradan güncellenmez.')) return; try { ascPaint(await api('/asc/key', { method: 'DELETE' })); } catch (er) { toast(er.message); } };
    if (q('.asc-shot')) q('.asc-shot').onchange = async (e) => { const f = e.target.files?.[0]; if (!f) return; // olduğu gibi gönderilir: Apple orijinal ekran boyutunu ister
      if (!/^image\/(png|jpeg)$/.test(f.type)) { toast('PNG ya da JPG bir ekran görüntüsü seç.'); return; }
      try { const r = await fetch(BASE + '/api/admin/asc/shot', { method: 'POST', headers: { 'Content-Type': f.type, ...PANEL_H }, credentials: 'same-origin', body: f }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Yüklenemedi.'); ascPaint(d); toast('Görsel kaydedildi, ürünlere ekleniyor.'); } catch (er) { toast(er.message); } };
    if (r.running) apT = setTimeout(() => api('/asc').then(ascPaint).catch(() => {}), 2500);
  };
  api('/asc').then(ascPaint).catch(() => {});
  if (evs) wireEventPanel(main, evs);
  roomsPanel(main.querySelector('.rooms-panel'), owner);
  const f = main.querySelector('form');
  const COLS = { plans: PLAN, packs: PACK, gifts: GIFT };
  f.onclick = (ev) => {
    const add = ev.target.closest('.add');
    if (add) { const box = f.querySelector(`.list-${add.dataset.l}`); box.insertAdjacentHTML('beforeend', rows([{}], COLS[add.dataset.l])); return; }
    const rm = ev.target.closest('.rmr'); if (rm) rm.closest('.erow').remove();
  };
  const read = (l, idp) => [...f.querySelectorAll(`.list-${l} .erow`)].map((r, i) => {
    const o = { id: `${idp}${i}` };
    r.querySelectorAll('[data-k]').forEach((x) => { o[x.dataset.k] = x.type === 'number' ? +x.value : x.value; });
    return o;
  });
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const v = (n) => f.elements[n].value;
    try {
      await api('/economy', {
        method: 'PUT',
        body: {
          bank: { iban: v('iban'), name: v('bname'), bankName: v('bbank'), note: v('bnote') },
          falPrices: Object.fromEntries(Object.keys(FAL).map((k) => [k, +v(`fal_${k}`)])),
          falciShare: +v('falciShare'), creatorShare: +v('creatorShare'), coinTL: +v('coinTL'),
          freeLikes: +v('freeLikes'), freeSupers: +v('freeSupers'), plusSupers: +v('plusSupers'), boostCoins: +v('boostCoins'), boostMinutes: +v('boostMinutes'),
          superMsgCoins: +v('superMsgCoins'), inviteCoins: +v('inviteCoins'), falSubCoins: +v('falSubCoins'), plusTrialDays: +v('plusTrialDays'), invitePrizes: v('invP').split(/[^\d]+/).filter(Boolean).map(Number).slice(0, 3), superPacks: [{ ...((e.superPacks || [])[0] || { id: 's5', n: 5 }), coins: +v('sp0') }, { ...((e.superPacks || [])[1] || { id: 's15', n: 15, tag: 'Avantajlı' }), coins: +v('sp1') }],
          plusPlans: read('plans', 'p').map((p) => { const old = e.plusPlans.find((x) => +x.days === +p.days); return { ...p, id: old?.id || `p${p.days}` }; }),
          coinPacks: read('packs', 'c').map((p) => { const old = e.coinPacks.find((x) => +x.coins === +p.coins); return { ...p, id: old?.id || `c${p.coins}` }; }),
          gifts: read('gifts', 'g').map((g, i) => ({ ...g, id: e.gifts[i]?.id || `g${i}${Date.now() % 1000}` })),
        },
      });
      await api('/legal', { method: 'PUT', body: { company: v('lcompany'), email: v('lemail'), address: v('laddress'), brand: v('lbrand'), phone: v('lphone'), kep: v('lkep'), mersis: v('lmersis'), vkn: v('lvkn'), taxOffice: v('ltaxOffice'), sicil: v('lsicil'), etbis: v('letbis'), deliveryHours: v('ldeliveryHours'), payHours: v('lpayHours'), refund14: f.elements.lrefund14.checked } });
      toast('Ayarlar kaydedildi.');
    } catch (er) { toast(er.message); }
  };
};

// ---- Kullanıcı hareketleri ----
const AKT_IC = { hesap: '👤', giris: '🔑', kaydirma: '👆', eslesme: '💞', mesaj: '💬', paylasim: '📷', hikaye: '⭕', profil: '🪪', sosyal: '❤️', oyun: '🎲', canli: '📹', magaza: '🪙', fal: '🔮', guvenlik: '🛡️', destek: '🆘', diger: '•' };
function aktList(box, path, withUser, opts = {}) {
  let kat = opts.kat || ''; let before = null; let K = null; const seen = new Set();
  const rowHtml = (x) => `<div class="akt ${x.ok ? '' : 'bad'}" data-id="${esc(x.id)}"><span class="akt-ic" title="${esc(K?.[x.kat] || x.kat)}">${AKT_IC[x.kat] || '•'}</span>
    <div class="grow">${withUser && x.user ? `<button class="akt-u" data-u="${esc(x.user.id || '')}">${x.user.avatar ? `<img class="av sm" src="${esc(x.user.avatar)}" alt="">` : ''}<b>${esc(x.user.name || '')}</b> <span class="muted">@${esc(x.user.username || '')}</span></button> ` : ''}<span>${esc(x.text)}</span>${x.ok ? '' : ' <span class="chip bad">başarısız</span>'}
    <div class="muted akt-m">${dt(x.at)}${x.ip ? ` · IP ${esc(x.ip)}` : ''}${x.meta?.kanal ? ' · canlı bağlantı' : ''}</div></div></div>`;
  const draw = (items, append) => {
    const list = box.querySelector('.akt-list'); const fresh = items.filter((x) => !seen.has(x.id)); fresh.forEach((x) => seen.add(x.id));
    if (append) list.insertAdjacentHTML('beforeend', fresh.map(rowHtml).join(''));
    else list.innerHTML = fresh.map(rowHtml).join('') || '<div class="empty">Bu filtrede hareket yok.</div>';
    box.querySelector('.akt-more').hidden = items.length < (withUser ? 80 : 60);
  };
  const q = (b) => `${path}${path.includes('?') ? '&' : '?'}${kat ? `kat=${kat}&` : ''}${b ? `before=${encodeURIComponent(b)}` : ''}`;
  const load = async (append) => {
    const r = await api(q(append ? before : null)); K = r.kat;
    if (!box.querySelector('.akt-list')) {
      box.innerHTML = `<div class="akt-f"><button class="chip on" data-k="">Tümü</button>${Object.entries(K).map(([k, l]) => `<button class="chip" data-k="${k}">${AKT_IC[k] || ''} ${esc(l)}</button>`).join('')}</div>
        <div class="akt-list"></div><button class="btn sm akt-more" hidden>Daha eski hareketler</button>
        <p class="muted" style="font-size:12px;margin:8px 0 0">Mesaj, yorum ve gönderi metinleri kaydedilmez; yalnızca işlemin türü, zamanı, karşı taraf ve IP adresi. Kayıtlar ${Math.round((r.keepDays || 365) / 30)} ay saklanır, görüntülemeler işlem kaydına geçer.</p>`;
      box.querySelector('.akt-f').onclick = (e) => { const b = e.target.closest('[data-k]'); if (!b) return; kat = b.dataset.k; box.querySelectorAll('.akt-f .chip').forEach((x) => x.classList.toggle('on', x === b)); seen.clear(); before = null; load(false).catch((er) => toast(er.message)); };
      box.querySelector('.akt-more').onclick = () => load(true).catch((er) => toast(er.message));
      box.querySelector('.akt-list').onclick = (e) => { const u = e.target.closest('[data-u]'); if (u?.dataset.u) userDrawer(u.dataset.u); };
    }
    if (r.items.length) before = r.items[r.items.length - 1].id;
    draw(r.items, append);
    return r;
  };
  load(false).catch((er) => { box.innerHTML = `<div class="empty">${esc(er.message)}</div>`; });
  return { refresh: async () => { const r = await api(q(null)); const fresh = r.items.filter((x) => !seen.has(x.id)); if (!fresh.length) return; fresh.forEach((x) => seen.add(x.id)); const list = box.querySelector('.akt-list'); list.querySelector('.empty')?.remove(); list.insertAdjacentHTML('afterbegin', fresh.map(rowHtml).join('')); } };
}
VIEWS.aktivite = async (main) => {
  const pre = new URLSearchParams(location.hash.split('?')[1] || '').get('u') || '';
  main.innerHTML = `${head('Hareketler', 'Üyelerin uygulamada yaptığı işlemler: giriş, kaydırma, mesaj, paylaşım, oyun, satın alma, güvenlik. En yeni üstte.')}
    <form class="panel ak-f"><div class="pb row" style="gap:8px;flex-wrap:wrap;align-items:flex-end">
      <label class="muted" style="font-size:12px">Kullanıcı adı (boşsa herkes)<input class="field" name="u" value="${esc(pre)}" placeholder="@kullanici"></label>
      <button class="btn sm primary">${icon('search')} Göster</button>
      <label class="row" style="gap:6px;font-size:13px"><input type="checkbox" name="live" checked> Canlı akış (10 sn’de bir yenile)</label></div></form>
    <div class="panel"><div class="pb ak-box"><div class="spin"></div></div></div>`;
  const f = main.querySelector('.ak-f'); const box = main.querySelector('.ak-box');
  let ctl = null;
  const run = () => { box.innerHTML = '<div class="spin"></div>'; const u = f.u.value.trim().replace(/^@/, ''); ctl = aktList(box, `/aktivite${u ? `?username=${encodeURIComponent(u)}` : ''}`, true); };
  f.onsubmit = (e) => { e.preventDefault(); run(); };
  run();
  const t = setInterval(() => { if (!document.body.contains(box)) return clearInterval(t); if (f.live.checked && !document.hidden) ctl?.refresh().catch(() => {}); }, 10000);
};

// ---- Hukuk ve uyum: KVKK başvuruları (m.13: 30 gün), iade talepleri, hak ihlali bildirimleri, izin kayıtları ----
const CONSENT_NAMES = { marketing: 'Kampanya bildirimi (uygulama içi / anlık)', marketingEmail: 'Kampanya e-postası (İYS)', location: 'Yaklaşık konum', ai: 'Fal için yurt dışı yapay zeka aktarımı', orientation: 'Kaydırma tercihi (özel nitelikli)' };
const TD_KIND = { telif: 'Telif hakkı', kisilik: 'Kişilik hakkı', diger: 'Diğer' };
const left = (due) => { const n = Math.ceil((due - Date.now()) / 86400000); return n < 0 ? `<span class="chip bad">${-n} gün gecikti</span>` : `<span class="chip ${n <= 5 ? 'warn' : 'info'}">${n} gün kaldı</span>`; };
async function download(path, name) {
  try {
    const r = await fetch(BASE + '/api' + path, { headers: PANEL_H, credentials: 'same-origin' });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'İndirilemedi.');
    const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch (e) { toast(e.message); }
}
VIEWS.hukuk = async (main) => {
  let tab = 'kvkk';
  main.innerHTML = `${head('Hukuk ve uyum', 'KVKK başvuruları en geç 30 gün içinde, iadeler 14 gün içinde sonuçlandırılmalı. Yanıtlar kullanıcıya bildirim ve e-postayla gider.', '<div class="row" style="gap:6px"><button class="btn sm" data-dl="iys">İYS e-posta izinleri (CSV)</button><button class="btn sm" data-dl="consents">Rıza kayıtları (CSV)</button></div>')}
    <div class="hk-top"><div class="spin"></div></div>
    <div class="tabs">${[['kvkk', 'KVKK başvuruları'], ['refunds', 'İade talepleri'], ['takedowns', 'Hak ihlali bildirimleri'], ['ihlal', 'Veri ihlali'], ['trafik', 'Trafik kayıtları (5651)'], ['imha', 'Saklama ve imha'], ['uyari', 'Yönetici uyarıları']].map(([k, l], i) => `<button data-s="${k}" class="${i ? '' : 'on'}">${l}</button>`).join('')}</div>
    <div class="panel lst"><div class="spin"></div></div>`;
  const top = main.querySelector('.hk-top'); const lst = main.querySelector('.lst');
  let D = null;
  const paint = () => {
    const open = (a) => a.filter((x) => x.status === 'open').length;
    main.querySelectorAll('.tabs button').forEach((b) => { const n = open(D[b.dataset.s] || []); b.querySelector('.n')?.remove(); if (n) b.insertAdjacentHTML('beforeend', ` <span class="n">${n}</span>`); });
    top.innerHTML = `${D.missing.length ? `<div class="panel hk-miss"><div class="pb"><b>Satış belgelerinde eksik bilgi var.</b> 6563 sayılı Kanun ve Mesafeli Sözleşmeler Yönetmeliği satıcının kimlik ve iletişim bilgilerinin gösterilmesini ister: ${D.missing.map(esc).join(', ')}. <a href="#/settings">Ayarlar › Satıcı ve künye bilgileri</a></div></div>` : ''}
      <div class="stats">
        <div class="stat ${D.termsOld ? 'alert' : ''}"><b>${D.termsOld}</b><span>Güncel koşulları henüz onaylamamış üye (sürüm ${esc(D.ver.kosullar)})</span></div>
        ${Object.entries(CONSENT_NAMES).map(([k, l]) => `<div class="stat"><b>${D.consents[k] || 0}</b><span>${l} izni veren</span></div>`).join('')}
        <div class="stat"><b>${Number(D.thh.limit).toLocaleString('tr-TR')} ₺</b><span>${D.thh.year} tüketici hakem heyeti sınırı</span></div>
      </div>`;
    if (EXTRA[tab]) { lst.innerHTML = '<div class="spin"></div>'; EXTRA[tab](lst).catch((er) => { lst.innerHTML = `<div class="empty">${esc(er.message)}</div>`; }); return; }
    const L = D[tab] || [];
    if (!L.length) { lst.innerHTML = '<div class="empty">Bu listede kayıt yok.</div>'; return; }
    if (tab === 'kvkk') lst.innerHTML = L.map((k) => `<div class="case" data-id="${esc(k.id)}">
      <div class="who">${userCell(k.user)}<b>${esc(k.no)}</b><span class="muted">${dt(k.at)}</span>${k.status === 'open' ? left(k.due) : `<span class="chip ${k.status === 'answered' ? 'ok' : 'bad'}">${k.status === 'answered' ? 'Yanıtlandı' : 'Reddedildi'}</span>`}</div>
      <div><ul class="hk-ul">${k.typeNames.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>${k.note ? `<div class="det">${esc(k.note)}</div>` : ''}
      ${k.status === 'open' ? `<div class="acts hk-acts"><textarea class="field nt" rows="3" placeholder="Yanıt (gerekçesiyle). Kullanıcıya bildirim ve e-postayla gider."></textarea><button class="btn sm ok" data-k="answer">${icon('check')} Yanıtla</button><button class="btn sm danger" data-k="reject">Gerekçeyle reddet</button>${k.user?.id ? `<button class="btn sm" data-u="${esc(k.user.id)}">Hesabı incele</button>` : ''}</div>`
    : `<div class="muted">Yanıt (${dt(k.answeredAt)}): ${esc(k.answer || '')}</div>`}</div>`).join('');
    if (tab === 'refunds') lst.innerHTML = L.map((r) => `<div class="case" data-id="${esc(r.id)}">
      <div class="who">${userCell(r.user)}<b>${esc(r.order?.code || '')}</b><span>${esc(r.order?.title || '')}</span><b>${tl(r.amount)}</b><span class="muted">${dt(r.at)}</span>${r.status === 'open' ? left(r.due) : `<span class="chip ${r.status === 'approved' ? 'ok' : 'bad'}">${r.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}</span>`}</div>
      <div class="muted">Gerekçe: <b>${esc(r.reasonText || r.reason)}</b>${r.order?.coins ? ` · paket ${r.order.coins} jeton, kullanıcının şu anki bakiyesi ${r.coinsNow}` : ''}</div>
      <div class="det">IBAN: ${esc(r.iban)} · Alıcı: ${esc(r.name)}${r.note ? `\nNot: ${esc(r.note)}` : ''}</div>
      ${r.status === 'open' ? `<div class="acts"><input class="field nt" placeholder="Not (reddederken gerekçe yaz)"><button class="btn sm ok" data-r="approve">${icon('check')} Onayla</button><button class="btn sm danger" data-r="reject">Reddet</button></div><div class="muted" style="font-size:12.5px">Onaylarsan tutarı 14 gün içinde bu IBAN’a gönder ve Şirket (ERP) bölümüne gider olarak işle.${r.reason === 'cayma14' ? ' Cayma iadesinde paket jetonları bakiyeden düşülür.' : ''}</div>`
    : `<div class="muted">${esc(r.by || '')} · ${dt(r.closedAt)}${r.note2 ? ` · ${esc(r.note2)}` : ''}</div>`}</div>`).join('');
    if (tab === 'takedowns') lst.innerHTML = L.map((t) => `<div class="case" data-id="${esc(t.id)}">
      <div class="who"><span class="chip warn">${TD_KIND[t.kind] || t.kind}</span><b class="ell" style="max-width:420px">${esc(t.target)}</b><span class="muted">${dt(t.at)}</span>${t.status === 'open' ? '<span class="chip info">Açık</span>' : `<span class="chip ${t.status === 'removed' ? 'ok' : 'bad'}">${t.status === 'removed' ? 'İçerik kaldırıldı' : 'Kaldırılmadı'}</span>`}</div>
      <div class="muted">Bildiren: ${esc(t.name)} · ${esc(t.email)}${t.user ? ` · üye @${esc(t.user.username)}` : ''}</div><div class="det">${esc(t.desc)}</div>
      ${t.status === 'open' ? `<div class="acts"><input class="field nt" placeholder="Bildirene açıklama (isteğe bağlı)"><button class="btn sm ok" data-t="removed">${icon('check')} İçeriği kaldırdım</button><button class="btn sm danger" data-t="rejected">Kaldırılmayacak</button></div><div class="muted" style="font-size:12.5px">5651 sayılı Kanun: kişilik hakkı bildirimleri en geç 24 saat içinde sonuçlandırılmalı. İçeriği ilgili bölümden (Kullanıcılar, İçerik, Şikayetler) kaldırıp sonra burayı işaretle.</div>`
    : `<div class="muted">${esc(t.by || '')} · ${dt(t.closedAt)}${t.note ? ` · ${esc(t.note)}` : ''}</div>`}</div>`).join('');
  };
  const load = async () => { D = await api('/hukuk'); paint(); };
  const EXTRA = { ihlal: hkIhlal, trafik: hkTrafik, imha: hkImha, uyari: hkUyari };
  main.querySelector('.head').onclick = (e) => { const b = e.target.closest('[data-dl]'); if (!b) return; download(`/hukuk/${b.dataset.dl}.csv`, b.dataset.dl === 'iys' ? 'iys-eposta-izinleri.csv' : 'riza-kayitlari.csv'); };
  main.querySelector('.tabs').onclick = (e) => { const b = e.target.closest('[data-s]'); if (!b) return; tab = b.dataset.s; main.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b)); paint(); };
  lst.onclick = async (e) => {
    const u = e.target.closest('[data-u]'); if (u && !EXTRA[tab]) return userDrawer(u.dataset.u, load);
    const b = e.target.closest('[data-k],[data-r],[data-t]'); if (!b || EXTRA[tab]) return;
    const card = b.closest('.case'); const note = card.querySelector('.nt')?.value || '';
    try {
      if (b.dataset.k) await api(`/hukuk/kvkk/${card.dataset.id}`, { body: { action: b.dataset.k, text: note } });
      if (b.dataset.r) await api(`/hukuk/refunds/${card.dataset.id}`, { body: { action: b.dataset.r, note } });
      if (b.dataset.t) await api(`/hukuk/takedowns/${card.dataset.id}`, { body: { action: b.dataset.t, note } });
      toast('Kaydedildi.'); await load(); refreshCounts();
    } catch (er) { toast(er.message); }
  };
  await load();
};

// ---- Hukuk: veri ihlali kayıtları (KVKK m.12/5: Kurul'a 72 saat içinde) ----
const ihDtl = (t) => (t ? new Date(t - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
const hoursLeft = (x) => { if (x.kurulAt) return `<span class="chip ok">Kurul’a bildirildi · ${dt(x.kurulAt)}</span>`; const h = Math.floor((x.deadline - Date.now()) / 3600000); return h < 0 ? `<span class="chip bad">72 saat ${-h} saat önce doldu</span>` : `<span class="chip ${h < 24 ? 'warn' : 'info'}">Kurul bildirimi için ${h} saat kaldı</span>`; };
async function hkIhlal(box) {
  const r = await api('/hukuk/ihlal');
  const form = (x = {}) => `<form class="ih-f pb fgrid" data-id="${esc(x.id || '')}">
    <label>Başlık<input class="field" name="title" value="${esc(x.title || '')}" placeholder="ör. Yedek dosyası yanlış kişiyle paylaşıldı" required></label>
    <div class="grid g3" style="gap:8px"><label>Başlangıç<input class="field" type="datetime-local" name="startedAt" value="${ihDtl(x.startedAt)}"></label><label>Bitiş<input class="field" type="datetime-local" name="endedAt" value="${ihDtl(x.endedAt)}"></label><label>Tespit<input class="field" type="datetime-local" name="detectedAt" value="${ihDtl(x.detectedAt || Date.now())}"></label></div>
    <label>Ne oldu, nasıl fark edildi<textarea class="field" name="desc" rows="3">${esc(x.desc || '')}</textarea></label>
    <label>Nedeni / kaynağı<textarea class="field" name="cause" rows="2">${esc(x.cause || '')}</textarea></label>
    <div><b style="font-size:13px">Etkilenen veri kategorileri</b><div class="ih-cats">${r.cats.map((c) => `<label class="row" style="gap:6px;font-weight:500"><input type="checkbox" name="cat" value="${esc(c)}" ${(x.categories || []).includes(c) ? 'checked' : ''}>${esc(c)}</label>`).join('')}</div></div>
    <div class="grid g2" style="gap:8px"><label>Etkilenen kişi grubu<input class="field" name="subjects" value="${esc(x.subjects || 'Uygulama üyeleri')}"></label><label>Yaklaşık kişi sayısı<input class="field" type="number" min="0" name="people" value="${esc(x.people ?? '')}"></label></div>
    <label>Olası sonuçlar<textarea class="field" name="consequences" rows="2">${esc(x.consequences || '')}</textarea></label>
    <label>Alınan / alınacak tedbirler<textarea class="field" name="measures" rows="2">${esc(x.measures || '')}</textarea></label>
    <div class="grid g2" style="gap:8px"><label>İrtibat kişisi (Kurul için)<input class="field" name="contact" value="${esc(x.contact || '')}" placeholder="Ad soyad, telefon, e-posta"></label><label>Kurul’a bildirim zamanı<input class="field" type="datetime-local" name="kurulAt" value="${ihDtl(x.kurulAt)}"></label></div>
    <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm primary">${icon('check')} ${x.id ? 'Kaydet' : 'İhlal kaydı aç'}</button>${x.id ? `<button type="button" class="btn sm ih-tx">Kurul bildirim taslağı</button><button type="button" class="btn sm ih-nt">Etkilenenlere bildir</button><button type="button" class="btn sm ${x.status === 'closed' ? '' : 'danger'} ih-cl">${x.status === 'closed' ? 'Yeniden aç' : 'Kapat'}</button>` : ''}</div></form>`;
  box.innerHTML = `<div class="case"><div class="muted">Kişisel verilerin yetkisiz kişilerce ele geçirildiğini fark ettiğin an kayıt aç. KVKK’ya göre Kurul’a <b>en geç 72 saat</b> içinde bildirim yapılır (kvkk.gov.tr › Veri İhlali Bildirimi), etkilenen kişilere de makul en kısa sürede haber verilir. Kurula bildirim gerekmese bile ihlal kayıt altında tutulur.</div>
    <details class="ih-new"><summary class="btn sm" style="width:max-content">${icon('plus')} Yeni ihlal kaydı</summary>${form()}</details></div>
    ${r.items.map((x) => `<div class="case"><div class="who"><b class="mono">${esc(x.no)}</b><b>${esc(x.title)}</b>${x.status === 'closed' ? '<span class="chip">Kapandı</span>' : hoursLeft(x)}${x.usersAt ? `<span class="chip ok">${x.usersCount} kişiye bildirildi</span>` : ''}<span class="muted">tespit ${dt(x.detectedAt)} · ${esc(x.by)}</span></div>
      <details><summary class="muted" style="cursor:pointer">Ayrıntılar ve düzenleme</summary>${form(x)}</details><pre class="ih-out det" hidden></pre></div>`).join('') || '<div class="empty">İhlal kaydı yok.</div>'}`;
  const read = (f) => { const v = (n) => f.elements[n].value; const t = (n) => (v(n) ? new Date(v(n)).toISOString() : null); return { title: v('title'), desc: v('desc'), cause: v('cause'), subjects: v('subjects'), people: v('people'), consequences: v('consequences'), measures: v('measures'), contact: v('contact'), startedAt: t('startedAt'), endedAt: t('endedAt'), detectedAt: t('detectedAt'), kurulAt: t('kurulAt'), categories: [...f.querySelectorAll('[name=cat]:checked')].map((x) => x.value) }; };
  box.querySelectorAll('.ih-f').forEach((f) => {
    const id = f.dataset.id; const out = f.closest('.case').querySelector('.ih-out');
    f.onsubmit = async (e) => { e.preventDefault(); try { await api(id ? `/hukuk/ihlal/${id}` : '/hukuk/ihlal', { method: id ? 'PUT' : 'POST', body: read(f) }); toast('Kaydedildi.'); refreshCounts(); hkIhlal(box); } catch (er) { toast(er.message); } };
    f.querySelector('.ih-tx')?.addEventListener('click', async () => { try { const t = await api(`/hukuk/ihlal/${id}/taslak`); out.hidden = false; out.textContent = t.text; navigator.clipboard?.writeText(t.text).then(() => toast('Taslak panoya kopyalandı.')).catch(() => {}); } catch (er) { toast(er.message); } });
    f.querySelector('.ih-cl')?.addEventListener('click', async () => { const x = r.items.find((i) => i.id === id); try { await api(`/hukuk/ihlal/${id}`, { method: 'PUT', body: { status: x.status === 'closed' ? 'open' : 'closed' } }); refreshCounts(); hkIhlal(box); } catch (er) { toast(er.message); } });
    f.querySelector('.ih-nt')?.addEventListener('click', () => {
      out.hidden = false; out.outerHTML = `<form class="ih-nf det" style="display:grid;gap:8px"><b>Etkilenen kişilere bildirim</b><textarea class="field" name="text" rows="6" placeholder="Ne oldu, hangi verilerin etkilendi, ne yaptık, kişinin ne yapması gerekir (ör. şifresini değiştirmesi), kime başvurabilir."></textarea>
        <label class="row" style="gap:6px"><input type="radio" name="aud" value="list" checked> Şu kullanıcılara:</label><input class="field" name="usernames" placeholder="@kullanici1, @kullanici2">
        <label class="row" style="gap:6px"><input type="radio" name="aud" value="all"> Tüm üyelere</label><button class="btn sm primary">Bildirimi gönder (uygulama içi + e-posta)</button></form>`;
      const nf = f.closest('.case').querySelector('.ih-nf');
      nf.onsubmit = async (e) => { e.preventDefault(); const all = nf.aud.value === 'all'; if (!confirm(all ? 'Tüm üyelere güvenlik bildirimi gönderilsin mi?' : 'Bildirim gönderilsin mi?')) return; try { const x = await api(`/hukuk/ihlal/${id}/notify`, { body: { text: nf.text.value, audience: all ? 'all' : 'list', usernames: nf.usernames.value } }); toast(`${x.count} kişiye bildirildi (${x.mails} e-posta).`); hkIhlal(box); } catch (er) { toast(er.message); } };
    });
  });
}
// ---- Hukuk: 5651 trafik kayıtları ----
async function hkTrafik(box) {
  const st = await api('/hukuk/trafik/stats');
  box.innerHTML = `<div class="case"><div class="muted">5651 sayılı Kanun gereği girişler, içerik oluşturan / değiştiren işlemler ve canlı bağlantılar IP adresi ve zamanıyla <b>2 yıl</b> saklanır, sonra kendiliğinden silinir. Kayıtlar zincirleme özetle korunur; arada silinen ya da değiştirilen kayıt doğrulamada ortaya çıkar. Yalnızca resmi bir talep (mahkeme, savcılık, BTK) ya da hukuki bir ihtiyaç için dışa aktar; her dışa aktarma sahibe bildirilir.</div>
    <div class="stats sm"><div class="stat"><b>${st.count.toLocaleString('tr-TR')}</b><span>Kayıt (${esc(st.kind)})</span></div><div class="stat"><b>${st.oldest ? d(st.oldest) : '—'}</b><span>En eski kayıt</span></div><div class="stat"><b>${st.seals}</b><span>Günlük mühür</span></div><div class="stat"><b>${Math.round(st.keepDays / 365)} yıl</b><span>Saklama süresi</span></div></div></div>
    <form class="case tr-f"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:flex-end">
      <label class="muted" style="font-size:12px">Kullanıcı adı (boşsa hepsi)<input class="field" name="u" placeholder="@kullanici"></label>
      <label class="muted" style="font-size:12px">Başlangıç<input class="field" type="date" name="f" value="${ymd(new Date(Date.now() - 7 * 86400000))}"></label>
      <label class="muted" style="font-size:12px">Bitiş<input class="field" type="date" name="t" value="${today()}"></label>
      <button class="btn sm primary">${icon('download')} CSV indir</button><button type="button" class="btn sm tr-v">Bütünlüğü doğrula</button></div><div class="tr-out"></div></form>`;
  const f = box.querySelector('.tr-f'); const q = () => `from=${f.f.value}&to=${f.t.value}`;
  f.onsubmit = (e) => { e.preventDefault(); download(`/hukuk/trafik.csv?${q()}&username=${encodeURIComponent(f.u.value.trim())}`, `trafik-${f.f.value}_${f.t.value}.csv`); };
  f.querySelector('.tr-v').onclick = async () => { const o = f.querySelector('.tr-out'); o.innerHTML = '<div class="spin"></div>'; try { const v = await api(`/hukuk/trafik/verify?${q()}`); o.innerHTML = `<div class="det" style="margin-top:10px">${v.ok ? `✅ Zincir sağlam: ${v.count} kayıt (${v.first ? dt(v.first) : '—'} – ${v.last ? dt(v.last) : '—'}).` : `❌ Zincir ${esc(String(v.brokenAt.id))} numaralı kayıtta (${dt(v.brokenAt.at)}) bozuluyor. Kayıt silinmiş ya da değiştirilmiş olabilir; bu aralığı dışa aktarıp saklayın ve teknik inceleme başlatın.`}</div>`; } catch (er) { o.innerHTML = `<div class="empty">${esc(er.message)}</div>`; } };
}
// ---- Hukuk: saklama ve imha ----
async function hkImha(box) {
  const r = await api('/hukuk/imha'); const RS = r.settings; const own = can('owner');
  const CN = { selfie: 'selfie', notif: 'bildirim', clientErr: 'hata kaydı', reset: 'sıfırlama kodu', pendingPref: 'bekleyen tercih', deletedAcc: 'silinen hesap kaydı', cases: 'kapanmış kayıt', kvkk: 'KVKK / bildirim', consentGone: 'rıza kaydı', loginEv: 'giriş kaydı', shares: 'buluşma paylaşımı', money: 'mali kayıt', inactive: 'pasif hesap silindi', inactiveWarn: 'pasif hesaba uyarı' };
  box.innerHTML = `<div class="case"><div class="muted">Süresi dolan veriler 12 saatte bir kendiliğinden silinir ya da yok edilir; her imha aşağıya kaydedilir ve kayıtlar 3 yıl saklanır. Kullanıcılara gösterilen özet: Ayarlar › Saklama ve imha politikası.</div>
    <table class="tbl"><thead><tr><th>Veri</th><th>Saklama süresi</th></tr></thead><tbody>${r.rules.map((x) => `<tr><td>${esc(x.label)}</td><td>${esc(x.keep)}</td></tr>`).join('')}</tbody></table></div>
    <form class="case im-f"><b>Uzun süre kullanılmayan hesaplar</b><div class="row" style="gap:10px;flex-wrap:wrap;align-items:center">
      <label class="row" style="gap:6px"><input type="checkbox" name="on" ${RS.inactiveOn ? 'checked' : ''} ${own ? '' : 'disabled'}> Otomatik sil</label>
      <label class="row" style="gap:6px">Kullanılmama süresi <input class="field" type="number" name="m" min="12" max="60" value="${RS.inactiveMonths}" style="width:80px" ${own ? '' : 'disabled'}> ay</label>
      ${own ? '<button class="btn sm primary">Kaydet</button><button type="button" class="btn sm im-run">Şimdi çalıştır</button>' : ''}</div>
      <div class="muted" style="font-size:12.5px">Silmeden ${RS.warnDays} gün önce bildirim ve e-postayla uyarılır; giriş yaparsa silinmez. Jeton bakiyesi, kazancı ya da açık siparişi olan hesaplar silinmez. Son çalışma: ${RS.lastRun ? dt(RS.lastRun) : '—'}</div></form>
    <div class="case"><b>İmha kayıtları</b>${r.log.length ? `<table class="tbl"><thead><tr><th>Zaman</th><th>Tetikleyen</th><th>Silinen</th></tr></thead><tbody>${r.log.map((x) => `<tr><td>${dt(x.at)}</td><td>${esc(x.trigger)}${x.by ? ` · ${esc(x.by)}` : ''}</td><td>${Object.entries(x.counts).map(([k, n]) => `${n} ${CN[k] || k}`).join(', ')}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Henüz imha kaydı yok.</div>'}</div>`;
  const f = box.querySelector('.im-f');
  if (own) {
    f.onsubmit = async (e) => { e.preventDefault(); try { await api('/hukuk/imha', { method: 'PUT', body: { inactiveOn: f.on.checked, inactiveMonths: f.m.value } }); toast('Kaydedildi.'); hkImha(box); } catch (er) { toast(er.message); } };
    f.querySelector('.im-run').onclick = async () => { try { const x = await api('/hukuk/imha/run', { body: {} }); toast(Object.keys(x.counts).length ? `İmha tamamlandı: ${Object.entries(x.counts).map(([k, n]) => `${n} ${CN[k] || k}`).join(', ')}` : 'Silinecek süresi dolmuş veri yok.'); hkImha(box); } catch (er) { toast(er.message); } };
  }
}
// ---- Hukuk: yönetici güvenlik uyarıları ----
async function hkUyari(box) {
  const r = await api('/hukuk/ihlal');
  box.innerHTML = `<div class="case"><div class="muted">Toplu dışa aktarmalar (yedek, izin kayıtları, trafik ve muhasebe dökümü) ve 10 dakikada 40’tan fazla profil incelemesi burada listelenir ve sahip yöneticinin telefonuna bildirilir. Beklenmeyen bir kayıt görürsen ilgili yöneticinin yetkisini kısıtla ve gerekirse veri ihlali kaydı aç.</div></div>
    ${r.alerts.map((a) => `<div class="case"><div class="who"><span class="chip ${a.kind === 'toplu-inceleme' ? 'warn' : 'info'}">${a.kind === 'toplu-inceleme' ? 'Toplu inceleme' : 'Dışa aktarma'}</span><b>@${esc(a.admin)}</b><span>${esc(a.text)}</span><span class="muted">${dt(a.at)}</span></div></div>`).join('') || '<div class="empty">Uyarı yok.</div>'}`;
}

document.addEventListener('error', (e) => {
  const t = e.target;
  if (t.tagName === 'IMG' && !t.dataset.fb) { t.dataset.fb = '1'; t.src = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#e5e5ea"/></svg>'); }
}, true);
window.addEventListener('hashchange', render);
render();
// Telefonda en üstteyken aşağı çekince sayfa yenilenir (ana uygulamadaki ile aynı)
import('/js/ptr.js').then((m) => m.initPtr({ enabled: () => !!S.token && !document.querySelector('.drawer.on, .drawer.open, dialog[open]'), refresh: () => Promise.all([render(), refreshCounts?.()]) })).catch(() => {});
setInterval(() => { if (S.token && document.visibilityState === 'visible') refreshCounts(); }, 20000);

// ---- Yeni sürüm: panel kendini yeniler (yazı yazılıyorsa düğmeyle) ----
let panelVersion = null;
async function checkPanelVersion() {
  try {
    const { version } = await (await fetch('/api/version', { cache: 'no-store' })).json();
    if (!panelVersion) { panelVersion = version; return; }
    if (version === panelVersion || document.querySelector('.upd')) return;
    const typing = document.activeElement?.matches('input, textarea, select');
    const b = el(`<div class="upd"><span>✨ Panelin yeni sürümü yayında</span><button class="btn sm primary">Yenile</button></div>`);
    b.querySelector('button').onclick = () => location.reload();
    document.body.append(b);
    if (!typing) setTimeout(() => { if (!document.activeElement?.matches('input, textarea, select')) location.reload(); }, 3000);
  } catch {}
}
checkPanelVersion();
setInterval(() => { if (document.visibilityState === 'visible') checkPanelVersion(); }, 60000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkPanelVersion(); });

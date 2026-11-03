// SwipeUp Yönetim paneli
import { icon } from '/js/icons.js';

const S = { token: localStorage.getItem('su_admin'), me: null, counts: {} };
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
  const r = await fetch('/api/admin' + path, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: { ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && S.token) { localStorage.removeItem('su_admin'); S.token = null; render(); throw new Error(data.error); }
  if (!r.ok) throw new Error(data.error || 'İşlem başarısız.');
  return data;
}

const STATUS = { active: ['ok', 'Aktif'], suspended: ['warn', 'Askıda'], banned: ['bad', 'Yasaklı'] };
const statusChip = (s) => `<span class="chip ${STATUS[s]?.[0] || ''}">${STATUS[s]?.[1] || s}</span>`;
const vt = (u) => (u?.verified ? `<span class="vt" title="Doğrulanmış">${icon('verified')}</span>` : '') + (u?.plus ? '<span class="chip gold">+</span>' : '');
const userCell = (u) => (u ? `<div class="row"><img class="av" src="${esc(u.avatar)}" alt="" loading="lazy"><div class="grow"><div class="ell"><b>${esc(u.name)}</b>${vt(u)}${u.role === 'falci' ? ' <span class="chip info">Falcı</span>' : ''}</div><div class="muted ell">@${esc(u.username)}</div></div></div>` : '<span class="muted">Silinmiş hesap</span>');
const REASON = { tehdit: 'Tehdit / şiddet', nefret: 'Nefret söylemi', spam: 'Spam / sahte hesap', taciz: 'Taciz veya zorbalık', uygunsuz: 'Uygunsuz içerik', dolandirici: 'Dolandırıcılık', yas: '18 yaş altı olabilir', diger: 'Diğer' };
const FAL = { kahve: '☕️ Kahve falı', tarot: '🔮 Tarot', burc: '✨ Burç', uyum: '💞 Aşk uyumu' };

const SECTIONS = [
  ['overview', 'Genel bakış', 'home'],
  ['users', 'Kullanıcılar', 'users'],
  ['reports', 'Şikayetler', 'flag', 'reportsOpen'],
  ['appeals', 'İtirazlar', 'reply', 'appealsOpen'],
  ['flags', 'Moderasyon', 'shield', 'flagsOpen'],
  ['verify', 'Doğrulama', 'verified', 'verifyOpen'],
  ['orders', 'Siparişler', 'coin', 'ordersPaid'],
  ['payouts', 'Kazançlar', 'gift', 'payoutsOpen'],
  ['market', 'Store', 'bag', 'marketOpen'],
  ['ledger', 'Gelir ve gider', 'sliders'],
  ['fal', 'Fal', 'star', 'falPending'],
  ['content', 'İçerik', 'grid'],
  ['media', 'Medya', 'image'],
  ['announce', 'Bildirim gönder', 'bell'],
  ['notes', 'Notlar', 'edit'],
  ['audit', 'İşlem kaydı', 'eye'],
  ['database', 'Veritabanı', 'grid'],
  ['maintenance', 'Bakım modu', 'timer'],
  ['settings', 'Ayarlar', 'settings'],
  ['admins', 'Yöneticiler', 'key'],
];

// ================= Giriş =================
function login() {
  root.innerHTML = `<div class="login"><form>
    <div class="brand"><img class="mark" src="/icons/mark.png" alt="">swipeup <small>yönetim</small></div>
    <p>Yönetici hesabınla giriş yap.</p>
    <input class="field" name="u" placeholder="Kullanıcı adı" autocomplete="username" autocapitalize="none" required>
    <input class="field" name="p" type="password" placeholder="Şifre" autocomplete="current-password" required>
    <button class="btn primary" style="height:42px">Giriş yap</button><div class="err"></div></form></div>`;
  const f = root.querySelector('form');
  f.onsubmit = async (e) => {
    e.preventDefault();
    try {
      const r = await api('/login', { body: { username: f.u.value, password: f.p.value } });
      S.token = r.token; S.me = r.admin; localStorage.setItem('su_admin', r.token); render();
    } catch (er) { f.querySelector('.err').textContent = er.message; }
  };
}

// ================= Kabuk =================
async function render() {
  if (!S.token) return login();
  if (!S.me) { try { S.me = await api('/me'); } catch { return; } }
  const cur = (location.hash.slice(2) || 'overview').split('/')[0];
  const nav = (cls) => SECTIONS.map(([k, l, ic, cnt]) => `<a class="nav ${cur === k ? 'on' : ''}" href="#/${k}">${icon(ic)}<span>${l}</span>${cnt && S.counts[cnt] ? `<span class="n">${S.counts[cnt]}</span>` : ''}</a>`).join('');
  root.innerHTML = `<div class="shell">
    <aside class="side"><div class="brand"><img class="mark" src="/icons/mark.png" alt="">swipeup <small>yönetim</small></div>${nav()}
      <div class="who"><b>${esc(S.me.name)}</b><span class="muted">@${esc(S.me.username)} · ${S.me.role === 'owner' ? 'Sahip' : 'Yönetici'}</span>
      <div class="row"><a class="btn sm" href="/" target="_blank" rel="noopener">Uygulamayı aç</a><button class="btn sm lo">Çıkış</button></div></div></aside>
    <div><nav class="topnav">${nav()}</nav><div class="mbn"></div><main class="main"></main></div></div>`;
  root.querySelector('.lo').onclick = () => { localStorage.removeItem('su_admin'); S.token = null; S.me = null; render(); };
  const main = root.querySelector('.main');
  main.innerHTML = '<div class="spin"></div>';
  if (!S.counts.users) refreshCounts(); else paintMaintBanner();
  try { await (VIEWS[cur] || VIEWS.overview)(main); } catch (e) { main.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
function paintMaintBanner() {
  const b = document.querySelector('.mbn'); if (!b) return;
  b.innerHTML = S.counts.maintenance ? `<a class="maintbar" href="#/maintenance">${icon('timer')}<span><b>Bakım modu açık.</b> Kullanıcılar uygulamaya giremiyor.</span><span class="go">Yönet</span></a>` : '';
}
async function refreshCounts() {
  try {
    const o = await api('/overview');
    const changed = ['reportsOpen', 'appealsOpen', 'falPending', 'flagsOpen', 'verifyOpen', 'ordersPaid', 'payoutsOpen', 'marketOpen', 'maintenance'].some((k) => S.counts[k] !== o[k]);
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
const bars = (series, label = (x) => x.day.slice(8)) => {
  const max = Math.max(1, ...series.map((s) => s.n));
  return `<div class="chart">${series.map((s) => `<div class="b" title="${esc(s.day)}: ${s.n}"><em>${s.n || ''}</em><i style="height:${(s.n / max) * 100}%"></i><small>${label(s)}</small></div>`).join('')}</div>`;
};

// ================= Bölümler =================
const VIEWS = {};

VIEWS.overview = async (main) => {
  const [o, reps, apps] = await Promise.all([api('/overview'), api('/reports?status=open'), api('/appeals?status=open')]);
  S.counts = o;
  const st = (n, l, alert, href) => `<div class="stat ${alert && n ? 'alert' : ''}"><b>${n}</b><span>${l}</span>${href && n ? `<a href="${href}">Görüntüle</a>` : ''}</div>`;
  main.innerHTML = `${head('Genel bakış', `Veri deposu: ${o.store === 'redis' ? 'Render Key Value' : o.store === 'postgres' ? 'PostgreSQL' : 'Sunucu diski'} · medya ${o.mediaMB} MB`)}
    <div class="stats">
      ${st(o.users, 'Toplam üye')}${st(o.newToday, 'Bugün katılan')}${st(o.new7, 'Son 7 gün katılan')}${st(o.online, 'Şu an çevrimiçi')}${st(o.active24, 'Son 24 saatte aktif')}
      ${st(o.messagesToday, 'Bugün gönderilen mesaj')}${st(o.matches, 'Toplam eşleşme')}${st(o.posts, 'Gönderi ve dalga')}${st(o.stories, 'Yayında hikaye')}${st(o.banned, 'Askıda / yasaklı', true, '#/users')}
      ${st(o.reportsOpen, 'Açık şikayet', true, '#/reports')}${st(o.appealsOpen, 'Bekleyen itiraz', true, '#/appeals')}${st(o.falPending, 'Bekleyen fal', true, '#/fal')}
      ${st(o.flagsOpen, 'Moderasyon işareti', true, '#/flags')}${st(o.verifyOpen, 'Doğrulama bekleyen', true, '#/verify')}${st(o.ordersPaid, 'Onay bekleyen ödeme', true, '#/orders')}${st(o.payoutsOpen, 'Ödeme talebi', true, '#/payouts')}
      ${st(o.plusUsers, 'SwipeUp+ üye')}${st(o.verifiedUsers, 'Mavi tikli üye')}
      <div class="stat"><b class="money in">${tl(o.income)}</b><span>Bu ay gelir</span></div>
      <div class="stat"><b class="money out">${tl(o.expense)}</b><span>Bu ay gider</span></div>
      <div class="stat"><b class="money ${o.income - o.expense >= 0 ? 'in' : 'out'}">${tl(o.income - o.expense)}</b><span>Bu ay net</span><a href="#/ledger">Gelir ve gider</a></div>
    </div>
    <div class="grid g3">
      <div class="panel"><div class="ph"><h3>Yeni üyeler · 14 gün</h3></div><div class="pb">${bars(o.series.users)}</div></div>
      <div class="panel"><div class="ph"><h3>Mesajlar · 14 gün</h3></div><div class="pb">${bars(o.series.messages)}</div></div>
      <div class="panel"><div class="ph"><h3>Eşleşmeler · 14 gün</h3></div><div class="pb">${bars(o.series.matches)}</div></div>
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
        ${u.status !== 'active' ? `<div class="case" style="padding:12px;border-radius:12px;background:color-mix(in srgb,var(--bad) 8%,transparent)"><b>${u.status === 'banned' ? 'Kalıcı yasaklı' : `Askıda · ${dt(u.bannedUntil)} tarihine kadar`}</b>${u.banReason ? `<div>${esc(u.banReason)}</div>` : ''}</div>` : ''}
        <div class="panel"><div class="ph"><h3>İşlemler</h3></div><div class="pb" style="display:grid;gap:10px">
          <div class="row" style="flex-wrap:wrap"><input class="field wt" placeholder="Uyarı metni" style="flex:1;min-width:180px"><button class="btn warn-b">${icon('flag')} Uyar</button></div>
          <div class="row" style="flex-wrap:wrap"><input class="field br" placeholder="Gerekçe (kullanıcı görür)" style="flex:1;min-width:180px">
            <select class="field bd" style="width:auto"><option value="1">1 gün</option><option value="3">3 gün</option><option value="7" selected>7 gün</option><option value="30">30 gün</option><option value="">Kalıcı</option></select>
            <button class="btn solid-danger ban">${icon('block')} Uygula</button></div>
          <div class="row" style="flex-wrap:wrap"><input class="field gc" type="number" placeholder="Jeton (+/−)" style="width:130px"><select class="field gd" style="width:auto"><option value="">Üyelik ekleme</option><option value="7">+7 gün SwipeUp+</option><option value="30">+30 gün SwipeUp+</option><option value="90">+90 gün SwipeUp+</option><option value="-1">Üyeliği kaldır</option></select>
            <input class="field gn" placeholder="Not (kullanıcı görür)" style="flex:1;min-width:140px"><button class="btn grant">${icon('gift')} Ver</button></div>
          <div class="row" style="flex-wrap:wrap">
            ${u.verified ? `<button class="btn unv">${icon('close')} Mavi tiki kaldır</button>` : ''}
            ${u.status !== 'active' ? `<button class="btn ok unban">${icon('check')} Yasağı kaldır</button>` : ''}
            <button class="btn pw">${icon('key')} Geçici şifre ver</button>
            ${S.me.role === 'owner' && u.role !== 'falci' ? `<button class="btn danger del">${icon('trash')} Hesabı sil</button>` : ''}
          </div></div></div>
        <div class="panel"><div class="ph"><h3>Bilgiler</h3></div><div class="pb"><dl class="kv">
          <dt>E-posta</dt><dd>${esc(u.email || '—')}</dd><dt>Katılım</dt><dd>${dt(u.createdAt)}</dd><dt>Son görülme</dt><dd>${dt(u.lastSeen)}</dd>
          <dt>Yaş / şehir</dt><dd>${esc([u.age, u.city].filter(Boolean).join(' · ') || '—')}</dd><dt>Biyografi</dt><dd>${esc(u.bio || '—')}</dd>
          <dt>Takipçi / takip</dt><dd>${u.followers} / ${u.following}</dd><dt>Gönderilen mesaj</dt><dd>${u.messagesSent}</dd><dt>Eşleşme</dt><dd>${u.matches}</dd>
          <dt>Yaptığı şikayet</dt><dd>${u.reportsBy}</dd>
          <dt>Doğum tarihi</dt><dd>${esc(u.birthdate || '—')}</dd><dt>Jeton</dt><dd>${u.coins}</dd><dt>Kazanç (bakiye)</dt><dd>${u.earnings} jeton</dd></dl></div></div>
        ${u.recentPosts.length ? `<div class="panel"><div class="ph"><h3>Son gönderiler</h3></div><div class="pb thumbs">${u.recentPosts.map((p) => (p.type === 'reel' ? `<video src="${esc(p.media)}" ${p.poster ? `poster="${esc(p.poster)}"` : ''} muted></video>` : `<img src="${esc(p.media)}" alt="">`)).join('')}</div></div>` : ''}
        <div class="panel"><div class="ph"><h3>Hakkındaki şikayetler · ${u.reportsAbout.length}</h3></div>${u.reportsAbout.length ? u.reportsAbout.map((r) => `<div class="case"><div class="row"><span class="chip warn">${esc(REASON[r.reason] || r.reason)}</span><span class="muted">${dt(r.at)} · @${esc(r.fromUser?.username || '?')}</span><span class="chip">${r.status === 'open' ? 'Açık' : 'Kapandı'}</span></div>${r.details ? `<div class="det">${esc(r.details)}</div>` : ''}</div>`).join('') : '<div class="empty">Şikayet yok.</div>'}</div>
        ${u.appeals.length ? `<div class="panel"><div class="ph"><h3>İtirazları</h3></div>${u.appeals.map((a) => `<div class="case"><div class="row"><span class="chip">${{ open: 'Bekliyor', accepted: 'Kabul', rejected: 'Ret' }[a.status]}</span><span class="muted">${dt(a.at)}</span></div><div class="det">${esc(a.text)}</div></div>`).join('')}</div>` : ''}
        ${u.history.length ? `<div class="panel"><div class="ph"><h3>Yönetici işlemleri</h3></div>${u.history.map((h) => `<div class="case"><div><b>${esc(h.action)}</b> <span class="muted">· ${esc(h.admin)} · ${dt(h.at)}</span></div>${h.detail ? `<div class="muted">${esc(h.detail)}</div>` : ''}</div>`).join('')}</div>` : ''}
      </div>`;
    const act = async (fn, msg) => { try { await fn(); toast(msg); await paint(); onChange?.(); refreshCounts(); } catch (e) { toast(e.message); } };
    dr.querySelector('.x').onclick = close;
    dr.querySelector('.warn-b').onclick = () => act(() => api(`/users/${id}/warn`, { body: { text: dr.querySelector('.wt').value } }), 'Uyarı gönderildi.');
    dr.querySelector('.ban').onclick = () => {
      const days = dr.querySelector('.bd').value;
      if (!confirm(days ? `${days} gün askıya alınsın mı?` : 'Hesap kalıcı olarak yasaklansın mı?')) return;
      act(() => api(`/users/${id}/ban`, { body: { days: days ? +days : null, reason: dr.querySelector('.br').value } }), days ? 'Askıya alındı.' : 'Yasaklandı.');
    };
    dr.querySelector('.grant').onclick = () => {
      const coins = +dr.querySelector('.gc').value || 0; const plusDays = +dr.querySelector('.gd').value || 0;
      if (!coins && !plusDays) return toast('Jeton ya da üyelik seç.');
      act(() => api(`/users/${id}/grant`, { body: { coins, plusDays, note: dr.querySelector('.gn').value } }), 'Tanımlandı.');
    };
    dr.querySelector('.unv')?.addEventListener('click', () => { if (confirm('Mavi tik kaldırılsın mı?')) act(() => api(`/users/${id}/unverify`, { body: {} }), 'Mavi tik kaldırıldı.'); });
    dr.querySelector('.unban')?.addEventListener('click', () => act(() => api(`/users/${id}/unban`, { body: {} }), 'Yasak kaldırıldı.'));
    dr.querySelector('.pw').onclick = async () => {
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
      <div class="row"><button class="btn primary sv">Ekle</button><button type="button" class="btn cancel" hidden>Vazgeç</button></div></form></div>
    <div class="grid g21">
      <div class="panel"><div class="ph"><h3>Kayıtlar</h3></div><div class="tw lst"><div class="spin"></div></div></div>
      <div class="grid" style="align-content:start">
        <div class="panel"><div class="ph"><h3>Son 6 ay</h3><span class="chip ok">Gelir</span><span class="chip bad">Gider</span></div><div class="pb mchart"></div></div>
        <div class="panel"><div class="ph"><h3>Kategoriler</h3></div><div class="pb cats"></div></div>
      </div></div>`;
  let type = 'gelir'; let data = null;
  const f = main.querySelector('form');
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
    const max = Math.max(1, ...months.map((k) => Math.max(data.byMonth[k]?.gelir || 0, data.byMonth[k]?.gider || 0)));
    main.querySelector('.mchart').innerHTML = `<div class="chart">${months.map((k) => { const v = data.byMonth[k] || { gelir: 0, gider: 0 }; return `<div class="b two" title="${k}: +${tl(v.gelir)} / −${tl(v.gider)}"><i style="height:${(v.gelir / max) * 100}%"></i><i style="height:${(v.gider / max) * 100}%"></i><small>${new Date(`${k}-01`).toLocaleDateString('tr-TR', { month: 'short' })}</small></div>`; }).join('')}</div>`;
    const byCat = {};
    items.forEach((x) => { const k = `${x.type}|${x.category}`; byCat[k] = (byCat[k] || 0) + x.amount; });
    main.querySelector('.cats').innerHTML = Object.keys(byCat).length ? Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => { const [t, c] = k.split('|'); return `<div class="row" style="padding:5px 0"><span class="chip ${t === 'gelir' ? 'ok' : 'bad'}">${t === 'gelir' ? '+' : '−'}</span><span class="grow">${esc(c)}</span><span class="money">${tl(v)}</span></div>`; }).join('') : '<div class="muted">Bu ay kayıt yok.</div>';
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const body = { type, amount: f.querySelector('.am').value, category: f.querySelector('.ct').value, date: f.querySelector('.dt').value, note: f.querySelector('.nt').value };
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
      f.querySelector('.am').value = x.amount; f.querySelector('.ct').value = x.category; f.querySelector('.dt').value = x.date; f.querySelector('.nt').value = x.note || '';
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

// ---- Fal ----
VIEWS.fal = async (main) => {
  const r = await api('/fal');
  S.counts.falPending = r.pending;
  main.innerHTML = `${head('Fal', 'Falcı Teyze hesabına gelen istekler. Cevaplar uygulamada Falcı Teyze hesabından verilir.')}
    <div class="stats"><div class="stat"><b>${r.total}</b><span>Toplam istek</span></div><div class="stat ${r.pending ? 'alert' : ''}"><b>${r.pending}</b><span>Bekleyen</span></div>
      <div class="stat"><b>${r.avgMin == null ? '—' : r.avgMin < 60 ? `${r.avgMin} dk` : `${(r.avgMin / 60).toFixed(1)} sa`}</b><span>Ortalama cevap süresi</span></div>
      ${Object.entries(FAL).map(([k, l]) => `<div class="stat"><b>${r.byType[k] || 0}</b><span>${l} · ${r.prices[k] || 0} jeton</span></div>`).join('')}</div>
    ${r.falci ? `<div class="panel" style="margin-bottom:14px"><div class="ph"><h3>Falcı Teyze kazancı</h3><a class="btn sm" href="#/settings">Fiyatlar</a></div><div class="pb"><div class="stats sm" style="margin:0">
      <div class="stat"><b>${r.paidCount}</b><span>Ücretli fal</span></div>
      <div class="stat"><b>${r.coinsSpent}</b><span>Harcanan jeton</span></div>
      <div class="stat"><b class="money in">${tl(r.falci.totalTL)}</b><span>Toplam kazanç (%${Math.round(r.share * 100)} pay · ${r.falci.total} jeton)</span></div>
      <div class="stat"><b class="money">${tl(r.falci.balanceTL)}</b><span>Ödenmemiş bakiye (${r.falci.balance} jeton)</span>${r.falci.balance > 0 && S.me.role === 'owner' ? `<button class="btn sm settle" data-id="${esc(r.falci.id)}">Ödendi olarak işaretle</button>` : ''}</div>
    </div></div></div>` : ''}
    <div class="panel"><div class="tw">${r.items.length ? `<table class="tbl"><thead><tr><th>Kullanıcı</th><th>Tür</th><th>Not</th><th>Gönderildi</th><th>Durum</th></tr></thead><tbody>
      ${r.items.map((x) => `<tr><td>${userCell(x.user)}</td><td>${FAL[x.type]}${x.price ? `<div class="muted" style="font-size:11.5px">${x.price} jeton</div>` : ''}</td><td class="muted" style="max-width:320px">${esc((x.note || '').slice(0, 120)) || '—'}${x.images?.length ? ` · ${x.images.length} fotoğraf` : ''}</td><td>${dt(x.at)}</td><td>${x.status === 'answered' ? `<span class="chip ok">Cevaplandı</span><div class="muted" style="font-size:11.5px">${dt(x.answeredAt)}</div>` : '<span class="chip warn">Bekliyor</span>'}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Henüz fal isteği yok.</div>'}</div></div>`;
  main.querySelector('.settle')?.addEventListener('click', async (e) => {
    if (!confirm(`Falcı Teyze'nin ${tl(r.falci.balanceTL)} kazancı ödendi olarak işaretlensin mi? Gelir-gidere gider olarak eklenir.`)) return;
    try { await api(`/users/${e.target.dataset.id}/settle`, { body: {} }); toast('Ödendi olarak işaretlendi.'); VIEWS.fal(main); } catch (er) { toast(er.message); }
  });
};

// ---- İçerik ----
VIEWS.content = async (main) => {
  let kind = 'posts';
  main.innerHTML = `${head('İçerik', 'Son paylaşılan gönderiler, dalgalar ve hikayeler.')}
    <div class="tabs"><button data-k="posts" class="on">Gönderiler ve dalgalar</button><button data-k="stories">Hikayeler (24 saat)</button></div><div class="lst"><div class="spin"></div></div>`;
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
  const TABS = [['all', 'Tümü'], ['post', 'Gönderi'], ['reel', 'Dalga'], ['story', 'Hikaye'], ['chat', 'Özel mesaj'], ['genel', 'Genel sohbet'], ['profile', 'Profil'], ['music', 'Müzik'], ['orphan', 'Sahipsiz']];
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
  const LINKS = [['/#/notifications', 'Bildirimler'], ['/#/', 'Ana sayfa'], ['/#/store', 'Mağaza (SwipeUp+ / jeton)'], ['/#/genel', 'Genel sohbet'], ['/#/fal', 'Fal'], ['/#/dalga', 'Dalga'], ['/#/swipe', 'Keşfet (kaydır)'], ['/#/create', 'Paylaşım oluştur'], ['/#/verify', 'Profil doğrulama'], ['/#/live', 'Canlı yayın aç']];
  const AUD = [['all', 'Herkes'], ['online', 'Şu an çevrimiçi olanlar'], ['plus', 'SwipeUp+ üyeleri'], ['free', 'Ücretsiz üyeler'], ['verified', 'Mavi tikliler'], ['new7', 'Son 7 günde katılanlar'], ['inactive', '7 gündür girmeyenler'], ['city', 'Şehre göre…'], ['user', 'Tek kullanıcı…']];
  main.innerHTML = `${head('Bildirim gönder', 'Seçtiğin kişilere uygulama içi bildirim ve telefonlarına anlık bildirim (push) gönderir. İstersen uygulama açılınca duyuru penceresi de çıkar.')}
    <div class="grid g21">
      <div class="panel"><div class="ph"><h3>Yeni bildirim</h3></div><form class="pb ann" style="display:grid;gap:12px">
        <label class="fl">Başlık<input class="field" name="title" maxlength="60" placeholder="SwipeUp"></label>
        <label class="fl">Mesaj<textarea class="field" name="t" rows="3" maxlength="300" placeholder="Örn. Bu hafta sonu SwipeUp+ %30 indirimde! 🎉"></textarea><span class="muted cnt" style="justify-self:end;font-size:12px">0 / 300</span></label>
        <div class="row" style="flex-wrap:wrap;gap:10px">
          <label class="fl" style="flex:1;min-width:200px">Kime<select class="field" name="aud">${AUD.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
          <label class="fl xcity" style="flex:1;min-width:160px" hidden>Şehir<input class="field" name="city" placeholder="Örn. İstanbul"></label>
          <label class="fl xuser" style="flex:1;min-width:160px" hidden>Kullanıcı adı<input class="field" name="username" placeholder="@kullanici"></label>
        </div>
        <label class="fl">Dokununca açılacak yer<select class="field" name="url">${LINKS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
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
  const body = () => ({ title: f.title.value, text: f.t.value, url: f.url.value, audience: f.aud.value, city: f.city.value, username: f.username.value, popup: f.popup.checked });
  const pv = () => {
    main.querySelectorAll('.pv-t').forEach((x) => { x.textContent = f.title.value || 'SwipeUp'; });
    main.querySelectorAll('.pv-m').forEach((x) => { x.textContent = f.t.value ? `📣 ${f.t.value}` : 'Mesajın burada görünecek.'; });
    main.querySelector('.pv-pop').hidden = !f.popup.checked;
    main.querySelector('.cnt').textContent = `${f.t.value.length} / 300`;
    main.querySelector('.xcity').hidden = f.aud.value !== 'city';
    main.querySelector('.xuser').hidden = f.aud.value !== 'user';
  };
  let rt;
  const reach = () => {
    clearTimeout(rt);
    rt = setTimeout(async () => {
      try { const r = await api('/announcements/preview', { body: body() }); main.querySelector('.reach').textContent = r.count ? `${r.count} kişiye gidecek` : 'Bu seçimde kimse yok'; } catch {}
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
    try { const a = await api('/announcements', { body: body() }); toast(`${a.reach} kişiye gönderildi${a.pushReach ? ` (${a.pushReach} telefona push)` : ''}.`); VIEWS.announce(main); } catch (er) { toast(er.message); }
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
  const list = await api('/admins');
  const owner = S.me.role === 'owner';
  main.innerHTML = `${head('Yöneticiler')}
    <div class="grid g2">
      <div class="panel"><div class="ph"><h3>Yönetici hesapları</h3></div>${list.map((a) => `<div class="case" data-id="${esc(a.id)}"><div class="row"><div class="grow"><b>${esc(a.name)}</b> <span class="muted">@${esc(a.username)}</span><div class="muted">Son giriş: ${dt(a.lastLogin)}</div></div><span class="chip ${a.role === 'owner' ? 'info' : ''}">${a.role === 'owner' ? 'Sahip' : 'Yönetici'}</span>${owner && a.role !== 'owner' ? `<button class="btn sm danger rm">${icon('trash')}</button>` : ''}</div></div>`).join('')}
        ${owner ? `<form class="pb add" style="display:grid;gap:8px;border-top:1px solid var(--line)"><b>Yönetici ekle</b><input class="field" name="u" placeholder="Kullanıcı adı" autocapitalize="none"><input class="field" name="n" placeholder="Ad"><input class="field" name="p" type="password" placeholder="Şifre (en az 8 karakter)"><button class="btn primary">Ekle</button></form>` : ''}</div>
      <div class="panel"><div class="ph"><h3>Şifremi değiştir</h3></div><form class="pb pw" style="display:grid;gap:8px"><input class="field" name="c" type="password" placeholder="Mevcut şifre"><input class="field" name="p" type="password" placeholder="Yeni şifre (en az 8 karakter)"><button class="btn primary">Değiştir</button></form></div>
    </div>`;
  main.querySelector('.add')?.addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target;
    try { await api('/admins', { body: { username: f.u.value, name: f.n.value, password: f.p.value } }); toast('Yönetici eklendi.'); VIEWS.admins(main); } catch (er) { toast(er.message); }
  });
  main.querySelector('.pw').onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    try { await api('/me/password', { body: { current: f.c.value, password: f.p.value } }); toast('Şifren değişti.'); f.reset(); } catch (er) { toast(er.message); }
  };
  main.onclick = async (e) => {
    const b = e.target.closest('.rm'); if (!b) return;
    if (!confirm('Bu yönetici silinsin mi?')) return;
    try { await api(`/admins/${b.closest('[data-id]').dataset.id}`, { method: 'DELETE' }); VIEWS.admins(main); } catch (er) { toast(er.message); }
  };
};


// ---- Otomatik moderasyon ----
VIEWS.flags = async (main) => {
  let status = 'open';
  main.innerHTML = `${head('Moderasyon', 'Mesajlarda otomatik tespit edilen tehdit ve ağır hakaretler. Herkese açık metinlerdeki küfürler zaten otomatik yıldızlanır.')}
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
const OST = { pending: ['warn', 'Ödeme bekleniyor'], paid: ['info', 'Ödendi bildirildi'], approved: ['ok', 'Onaylandı'], rejected: ['bad', 'Reddedildi'], cancelled: ['', 'İptal'] };
VIEWS.orders = async (main) => {
  let status = 'open';
  main.innerHTML = `${head('Siparişler', 'Havale/EFT siparişleri. Banka hesabına gelen ödemeyi açıklamadaki sipariş koduyla eşleştirip onayla; jeton ya da üyelik anında tanımlanır ve gelir olarak kaydedilir.')}
    <div class="stats sm sum"></div>
    <div class="tabs">${[['open', 'Bekleyen'], ['approved', 'Onaylanan'], ['rejected', 'Reddedilen'], ['all', 'Tümü']].map(([k, l], i) => `<button data-s="${k}" class="${i ? '' : 'on'}">${l}</button>`).join('')}</div>
    <div class="panel"><div class="tw lst"><div class="spin"></div></div></div>`;
  const lst = main.querySelector('.lst');
  const load = async () => {
    const r = await api(`/orders?status=${status}`);
    main.querySelector('.sum').innerHTML = `<div class="stat"><b class="money in">${tl(r.monthTotal)}</b><span>Bu ay onaylanan satış</span></div><div class="stat"><b>${r.monthCount}</b><span>Bu ay sipariş</span></div>`;
    lst.innerHTML = r.items.length ? `<table class="tbl"><thead><tr><th>Kod</th><th>Kullanıcı</th><th>Ürün</th><th class="num">Tutar</th><th>Gönderen</th><th>Tarih</th><th>Durum</th><th></th></tr></thead><tbody>
      ${r.items.map((o) => `<tr data-id="${esc(o.id)}"><td><b class="mono">${esc(o.code)}</b></td><td>${userCell(o.user)}</td><td>${esc(o.title)}</td><td class="num"><b>${tl(o.amount)}</b></td><td>${esc(o.sender || '—')}</td><td>${dt(o.paidAt || o.at)}</td>
        <td><span class="chip ${OST[o.status][0]}">${OST[o.status][1]}</span>${o.note ? `<div class="muted" style="font-size:11.5px">${esc(o.note)}</div>` : ''}</td>
        <td>${['pending', 'paid'].includes(o.status) ? `<div class="row"><button class="btn sm ok" data-ok="1">${icon('check')} Onayla</button><button class="btn sm danger" data-ok="0">Reddet</button></div>` : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Bu listede sipariş yok.</div>';
  };
  main.querySelector('.tabs').onclick = (e) => { const b = e.target.closest('[data-s]'); if (!b) return; status = b.dataset.s; main.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b)); load(); };
  lst.onclick = async (e) => {
    const b = e.target.closest('[data-ok]'); if (!b) return;
    const id = b.closest('[data-id]').dataset.id;
    const ok = b.dataset.ok === '1';
    let note = '';
    if (ok && !confirm('Ödeme banka hesabına ulaştı mı? Onaylanınca ürün kullanıcıya tanımlanır.')) return;
    if (!ok) { note = prompt('Ret nedeni (kullanıcı görür):', 'Ödeme hesabımıza ulaşmadı.'); if (note === null) return; }
    try { await api(`/orders/${id}`, { body: { approve: ok, note } }); toast(ok ? 'Onaylandı, kullanıcıya tanımlandı.' : 'Reddedildi.'); load(); refreshCounts(); } catch (er) { toast(er.message); }
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
      ${S.me.role === 'owner' ? `<button class="btn ${vis ? '' : 'primary'} mvt">${vis ? 'Gizle' : 'Uygulamada göster'}</button>` : ''}</div></div>`;
    main.querySelector('.mvt')?.addEventListener('click', async () => {
      if (!confirm(vis ? 'Store uygulamadan gizlensin mi? Açık siparişler panelden yönetilmeye devam eder.' : 'Store tüm kullanıcılara açılsın mı?')) return;
      try { await api('/market/visibility', { method: 'PUT', body: { enabled: !vis } }); toast(vis ? 'Store gizlendi.' : 'Store yayında!'); load(); } catch (er) { toast(er.message); }
    });
    main.querySelector('.sum').innerHTML = `<div class="stat"><b>${s.active}</b><span>Aktif ilan</span></div><div class="stat"><b class="money">${tl(s.heldTL)}</b><span>Emanette (${s.heldCount} sipariş)</span></div>
      <div class="stat"><b class="money in">${tl(s.monthTL)}</b><span>Bu ay tamamlanan (${s.monthCount})</span></div><div class="stat"><b class="money">${tl(s.balancesTL)}</b><span>Satıcı bakiyeleri</span></div>
      <div class="stat ${s.payoutsPending ? 'alert' : ''}"><b>${s.payoutsPending}</b><span>Bekleyen satıcı ödemesi</span>${s.payoutsPending ? '<a href="#/payouts">Görüntüle</a>' : ''}</div>`;
    main.querySelector('.mtabs').innerHTML = TABS.map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${l}${k !== 'items' && s.counts[k] ? ` <span class="tc">${s.counts[k]}</span>` : ''}</button>`).join('');
    if (S.me.role === 'owner' && !main.querySelector('.msettings form')) {
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
  const owner = S.me.role === 'owner';
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
  main.innerHTML = `${head('Kazançlar', `Canlı yayın hediyeleri ve ücretli fallardan kullanıcılara kalan pay. 1 kazanç jetonu = ${tl(r.coinTL)}.`)}
    <div class="grid g2">
      <div class="panel"><div class="ph"><h3>Ödeme talepleri</h3></div><div class="tw">${r.items.length ? `<table class="tbl"><thead><tr><th>Kullanıcı</th><th class="num">Tutar</th><th>IBAN / ad</th><th>Tarih</th><th></th></tr></thead><tbody>
        ${r.items.map((p) => `<tr data-id="${esc(p.id)}"><td>${userCell(p.user)}</td><td class="num"><b>${tl(p.amount)}</b><div class="muted" style="font-size:11.5px">${p.kind === 'store' ? '🛍️ Store satışı' : `${p.coins} jeton`}</div></td><td><span class="mono">${esc(p.iban)}</span><div class="muted">${esc(p.name)}</div></td><td>${dt(p.at)}</td>
          <td>${p.status === 'pending' ? `<div class="row"><button class="btn sm ok" data-ok="1">Ödendi</button><button class="btn sm danger" data-ok="0">Reddet</button></div>` : `<span class="chip ${PS[p.status][0]}">${PS[p.status][1]}</span>`}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Ödeme talebi yok.</div>'}</div></div>
      <div class="panel"><div class="ph"><h3>En çok kazananlar</h3></div><div class="tw">${r.earners.length ? `<table class="tbl"><thead><tr><th>Kullanıcı</th><th class="num">Toplam</th><th class="num">Bakiye</th></tr></thead><tbody>
        ${r.earners.map((u) => `<tr><td>${userCell(u)}</td><td class="num">${u.total}</td><td class="num">${u.balance} <div class="muted" style="font-size:11.5px">${tl(u.balanceTL)}</div></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Henüz kazanç yok.</div>'}</div></div>
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
  main.innerHTML = `${head('Veritabanı', 'Uygulama ve yönetim paneli verilerinin tutulduğu yer. Her değişiklik anında buraya yazılır.', S.me.role === 'owner' ? `<a class="btn" href="#" data-bk>${icon('download')} Yedek indir</a>` : '')}
    <div class="stats">
      <div class="stat"><b style="font-size:20px">${esc(name)}</b><span>${d.connected ? `<span class="chip ok">Bağlı</span>${d.pingMs != null ? ` · ${d.pingMs} ms` : ''}` : `<span class="chip bad">Bağlantı yok</span> ${esc(d.error || '')}`}</span></div>
      <div class="stat"><b>${d.docs.toLocaleString('tr-TR')}</b><span>Kayıt</span></div>
      <div class="stat"><b>${d.mediaCount}</b><span>Veritabanındaki medya · ${d.mediaMB} MB</span></div>
      <div class="stat"><b>${d.pending}</b><span>Yazılmayı bekleyen</span><span class="muted" style="font-size:11.5px">${d.lastWrite ? `Son yazma ${dt(d.lastWrite)}` : ''}</span></div>
    </div>
    ${pct != null ? `<div class="panel" style="margin-bottom:14px"><div class="pb"><div class="row"><b>Kullanılan alan</b><span class="muted" style="margin-left:auto">${used} MB / ${d.limitMB} MB (ücretsiz plan)</span></div>
      <div class="dbbar"><i style="width:${pct}%;background:${pct > 85 ? 'var(--bad)' : pct > 60 ? 'var(--warn)' : 'var(--ok)'}"></i></div>
      ${d.docsMB != null ? `<div class="muted" style="font-size:12.5px;margin-top:6px">Kayıtlar ${d.docsMB} MB · medya ${d.mediaTableMB} MB${d.version ? ` · ${esc(d.version)}` : ''}${d.host ? ` · ${esc(d.host)}${d.schema ? ` / şema ${esc(d.schema)}` : ''}` : ''}</div>` : ''}</div></div>` : ''}
    ${d.storage ? `<div class="panel" style="margin-bottom:14px"><div class="pb"><div class="row"><b>Fotoğraf ve video deposu · Supabase Storage</b><span class="muted" style="margin-left:auto">${d.storage.mb ?? '?'} MB / ${d.storage.limitMB} MB · ${d.storage.count ?? '?'} dosya</span></div>
      <div class="dbbar"><i style="width:${Math.min(100, Math.round(((d.storage.mb || 0) / d.storage.limitMB) * 100))}%;background:var(--info)"></i></div>
      ${d.storage.move ? `<div class="muted" style="font-size:12.5px;margin-top:6px">${dt(d.storage.move.at)} · veritabanından ${d.storage.move.moved} dosya (${d.storage.move.mb} MB) buraya taşındı.</div>` : ''}</div></div>`
    : `<div class="case" style="background:color-mix(in srgb,var(--warn) 10%,transparent);border-radius:12px;margin-bottom:14px"><b>Fotoğraf ve videolar veritabanında tutuluyor</b><div class="muted">${d.storageError ? `Supabase Storage bağlanamadı: ${esc(d.storageError)}` : 'Ayrı depoya (Supabase Storage, 1 GB ücretsiz) geçmek için Render’a SUPABASE_URL ve SUPABASE_SECRET_KEY eklenmeli.'}</div></div>`}
    ${d.lastError ? `<div class="case" style="background:color-mix(in srgb,var(--bad) 8%,transparent);border-radius:12px;margin-bottom:14px"><b>Son yazma hatası</b><div class="muted">${dt(d.lastError.at)} · ${esc(d.lastError.message)}</div></div>` : ''}
    ${d.migration ? `<div class="panel" style="margin-bottom:14px"><div class="pb row" style="gap:12px">${icon('check')}<div><b>Taşıma tamamlandı</b><div class="muted">${dt(d.migration.at)} · Render Key Value’dan ${d.migration.docs} kayıt ve ${d.migration.media} medya (${d.migration.mediaMB} MB) taşındı.</div></div></div></div>` : ''}
    <div class="panel"><div class="ph"><h3>Tablolar</h3></div><div class="tw"><table class="tbl"><thead><tr><th>Veri</th><th>Koleksiyon</th><th class="num">Kayıt</th></tr></thead><tbody>
      ${d.collections.map((c) => `<tr><td>${esc(COL_TR[c.name] || c.name)}</td><td class="muted mono">${esc(c.name)}</td><td class="num">${c.count.toLocaleString('tr-TR')}</td></tr>`).join('')}</tbody></table></div></div>`;
  main.querySelector('[data-bk]')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      const r = await fetch('/api/admin/database/backup', { headers: { Authorization: 'Bearer ' + S.token } });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'İndirilemedi.');
      const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = `swipeup-yedek-${today()}.json`; a.click();
      toast('Yedek indirildi.');
    } catch (er) { toast(er.message); }
  });
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

// ---- Ayarlar: ödeme, fiyatlar, yasal ----
VIEWS.settings = async (main) => {
  const [e, legal, evs] = await Promise.all([api('/economy'), api('/legal'), api('/event').catch(() => null)]);
  const owner = S.me.role === 'owner';
  const rows = (list, cols) => list.map((x, i) => `<div class="erow" data-i="${i}">${cols.map(([k, ph, w, type]) => `<input class="field" data-k="${k}" value="${esc(x[k] ?? '')}" placeholder="${ph}" style="width:${w}" ${type ? `type="${type}" step="any"` : ''}>`).join('')}<button type="button" class="btn sm danger rmr">${icon('trash')}</button></div>`).join('');
  const PACK = [['coins', 'Jeton', '100px', 'number'], ['price', 'Fiyat ₺', '110px', 'number'], ['tag', 'Etiket', '130px']];
  const PLAN = [['days', 'Gün', '90px', 'number'], ['price', 'Fiyat ₺', '110px', 'number'], ['tag', 'Etiket', '130px']];
  const GIFT = [['em', 'Emoji', '70px'], ['name', 'Ad', '120px'], ['coins', 'Jeton', '90px', 'number']];
  main.innerHTML = `${head('Ayarlar', owner ? 'Uygulamadaki mağaza, fiyatlar ve yasal iletişim bilgileri.' : 'Bu ayarları sadece sahip yönetici değiştirebilir.')}
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
        <label>Yayıncı hediye payı (0–1)<input class="field" type="number" step="0.05" name="creatorShare" value="${e.creatorShare}"></label>
        <label>1 kazanç jetonu (₺)<input class="field" type="number" step="0.01" name="coinTL" value="${e.coinTL}"></label></div></div>
      <div class="panel"><div class="ph"><h3>SwipeUp+ planları</h3><button type="button" class="btn sm add" data-l="plans">${icon('plus')}</button></div><div class="pb list-plans">${rows(e.plusPlans, PLAN)}</div></div>
      <div class="panel"><div class="ph"><h3>Jeton paketleri</h3><button type="button" class="btn sm add" data-l="packs">${icon('plus')}</button></div><div class="pb list-packs">${rows(e.coinPacks, PACK)}</div></div>
      <div class="panel"><div class="ph"><h3>Canlı yayın hediyeleri</h3><button type="button" class="btn sm add" data-l="gifts">${icon('plus')}</button></div><div class="pb list-gifts">${rows(e.gifts, GIFT)}</div></div>
      <div class="panel"><div class="ph"><h3>Sınırlar ve boost</h3></div><div class="pb fgrid">
        <label>Ücretsiz günlük beğeni<input class="field" type="number" name="freeLikes" value="${e.freeLikes}"></label>
        <label>Ücretsiz günlük süper beğeni<input class="field" type="number" name="freeSupers" value="${e.freeSupers}"></label>
        <label>SwipeUp+ günlük süper beğeni<input class="field" type="number" name="plusSupers" value="${e.plusSupers}"></label>
        <label>Boost fiyatı (jeton)<input class="field" type="number" name="boostCoins" value="${e.boostCoins}"></label>
        <label>Boost süresi (dakika)<input class="field" type="number" name="boostMinutes" value="${e.boostMinutes}"></label></div></div>
      <div class="panel"><div class="ph"><h3>Tanışma özellikleri</h3></div><div class="pb fgrid">
        <label>Süper mesaj (jeton)<input class="field" type="number" name="superMsgCoins" value="${e.superMsgCoins ?? 30}"></label>
        <label>Davet ödülü (iki tarafa, jeton)<input class="field" type="number" name="inviteCoins" value="${e.inviteCoins ?? 50}"></label>
        <label>Falcı Teyze aylık abonelik (jeton)<input class="field" type="number" name="falSubCoins" value="${e.falSubCoins ?? 250}"></label>
        <p class="muted" style="margin:0;font-size:12.5px">Abonelik: her pazartesi burç yorumu ve ayda bir kahve falı. Falcı Teyze payı abonelikte de geçerli.</p></div></div>
      <div class="panel"><div class="ph"><h3>Yasal iletişim bilgileri</h3></div><div class="pb fgrid">
        <label>Veri sorumlusu (şirket / ad soyad)<input class="field" name="lcompany" value="${esc(legal.company || '')}"></label>
        <label>İletişim e-postası<input class="field" name="lemail" type="email" value="${esc(legal.email || '')}"></label>
        <label>Adres<input class="field" name="laddress" value="${esc(legal.address || '')}"></label>
        <p class="muted" style="margin:0;font-size:12.5px">Gizlilik politikası ve KVKK metninde gösterilir.</p></div></div>
      ${owner ? `<div class="savebar"><button class="btn primary">${icon('check')} Kaydet</button></div>` : ''}
    </form>
    ${evs ? eventPanel(evs, owner) : ''}
    <div class="rooms-panel"></div>`;
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
          superMsgCoins: +v('superMsgCoins'), inviteCoins: +v('inviteCoins'), falSubCoins: +v('falSubCoins'),
          plusPlans: read('plans', 'p').map((p) => { const old = e.plusPlans.find((x) => +x.days === +p.days); return { ...p, id: old?.id || `p${p.days}` }; }),
          coinPacks: read('packs', 'c').map((p) => { const old = e.coinPacks.find((x) => +x.coins === +p.coins); return { ...p, id: old?.id || `c${p.coins}` }; }),
          gifts: read('gifts', 'g').map((g, i) => ({ ...g, id: e.gifts[i]?.id || `g${i}${Date.now() % 1000}` })),
        },
      });
      await api('/legal', { method: 'PUT', body: { company: v('lcompany'), email: v('lemail'), address: v('laddress') } });
      toast('Ayarlar kaydedildi.');
    } catch (er) { toast(er.message); }
  };
};

document.addEventListener('error', (e) => {
  const t = e.target;
  if (t.tagName === 'IMG' && !t.dataset.fb) { t.dataset.fb = '1'; t.src = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#e5e5ea"/></svg>'); }
}, true);
window.addEventListener('hashchange', render);
render();
setInterval(() => { if (S.token && document.visibilityState === 'visible') refreshCounts(); }, 30000);

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

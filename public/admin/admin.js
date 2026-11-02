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
const userCell = (u) => (u ? `<div class="row"><img class="av" src="${esc(u.avatar)}" alt="" loading="lazy"><div class="grow"><div class="ell"><b>${esc(u.name)}</b>${u.role === 'falci' ? ' <span class="chip info">Falcı</span>' : ''}</div><div class="muted ell">@${esc(u.username)}</div></div></div>` : '<span class="muted">Silinmiş hesap</span>');
const REASON = { spam: 'Spam / sahte hesap', taciz: 'Taciz veya zorbalık', uygunsuz: 'Uygunsuz içerik', dolandirici: 'Dolandırıcılık', yas: '18 yaş altı olabilir', diger: 'Diğer' };
const FAL = { kahve: '☕️ Kahve falı', tarot: '🔮 Tarot', burc: '✨ Burç', uyum: '💞 Aşk uyumu' };

const SECTIONS = [
  ['overview', 'Genel bakış', 'home'],
  ['users', 'Kullanıcılar', 'users'],
  ['reports', 'Şikayetler', 'flag', 'reportsOpen'],
  ['appeals', 'İtirazlar', 'reply', 'appealsOpen'],
  ['ledger', 'Gelir ve gider', 'sliders'],
  ['fal', 'Fal', 'star', 'falPending'],
  ['content', 'İçerik', 'grid'],
  ['announce', 'Duyurular', 'bell'],
  ['notes', 'Notlar', 'edit'],
  ['audit', 'İşlem kaydı', 'eye'],
  ['admins', 'Yöneticiler', 'key'],
];

// ================= Giriş =================
function login() {
  root.innerHTML = `<div class="login"><form>
    <div class="brand"><span class="mark">${icon('arrowUp')}</span>swipeup <small>yönetim</small></div>
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
    <aside class="side"><div class="brand"><span class="mark">${icon('arrowUp')}</span>swipeup <small>yönetim</small></div>${nav()}
      <div class="who"><b>${esc(S.me.name)}</b><span class="muted">@${esc(S.me.username)} · ${S.me.role === 'owner' ? 'Sahip' : 'Yönetici'}</span>
      <div class="row"><a class="btn sm" href="/" target="_blank" rel="noopener">Uygulamayı aç</a><button class="btn sm lo">Çıkış</button></div></div></aside>
    <div><nav class="topnav">${nav()}</nav><main class="main"></main></div></div>`;
  root.querySelector('.lo').onclick = () => { localStorage.removeItem('su_admin'); S.token = null; S.me = null; render(); };
  const main = root.querySelector('.main');
  main.innerHTML = '<div class="spin"></div>';
  if (!S.counts.users) refreshCounts();
  try { await (VIEWS[cur] || VIEWS.overview)(main); } catch (e) { main.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
async function refreshCounts() {
  try {
    const o = await api('/overview');
    const changed = ['reportsOpen', 'appealsOpen', 'falPending'].some((k) => S.counts[k] !== o[k]);
    S.counts = o;
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
    dr.innerHTML = `<div class="dh"><img class="av lg" src="${esc(u.avatar)}" alt=""><div class="grow"><h2>${esc(u.name)}</h2><div class="muted">@${esc(u.username)}</div><div class="row" style="margin-top:6px">${statusChip(u.status)}${u.role === 'falci' ? '<span class="chip info">Falcı</span>' : ''}${u.online ? '<span class="chip ok">Çevrimiçi</span>' : ''}</div></div><button class="btn sm x">${icon('close')}</button></div>
      <div class="db">
        ${u.status !== 'active' ? `<div class="case" style="padding:12px;border-radius:12px;background:color-mix(in srgb,var(--bad) 8%,transparent)"><b>${u.status === 'banned' ? 'Kalıcı yasaklı' : `Askıda · ${dt(u.bannedUntil)} tarihine kadar`}</b>${u.banReason ? `<div>${esc(u.banReason)}</div>` : ''}</div>` : ''}
        <div class="panel"><div class="ph"><h3>İşlemler</h3></div><div class="pb" style="display:grid;gap:10px">
          <div class="row" style="flex-wrap:wrap"><input class="field wt" placeholder="Uyarı metni" style="flex:1;min-width:180px"><button class="btn warn-b">${icon('flag')} Uyar</button></div>
          <div class="row" style="flex-wrap:wrap"><input class="field br" placeholder="Gerekçe (kullanıcı görür)" style="flex:1;min-width:180px">
            <select class="field bd" style="width:auto"><option value="1">1 gün</option><option value="3">3 gün</option><option value="7" selected>7 gün</option><option value="30">30 gün</option><option value="">Kalıcı</option></select>
            <button class="btn solid-danger ban">${icon('block')} Uygula</button></div>
          <div class="row" style="flex-wrap:wrap">
            ${u.status !== 'active' ? `<button class="btn ok unban">${icon('check')} Yasağı kaldır</button>` : ''}
            <button class="btn pw">${icon('key')} Geçici şifre ver</button>
            ${S.me.role === 'owner' && u.role !== 'falci' ? `<button class="btn danger del">${icon('trash')} Hesabı sil</button>` : ''}
          </div></div></div>
        <div class="panel"><div class="ph"><h3>Bilgiler</h3></div><div class="pb"><dl class="kv">
          <dt>E-posta</dt><dd>${esc(u.email || '—')}</dd><dt>Katılım</dt><dd>${dt(u.createdAt)}</dd><dt>Son görülme</dt><dd>${dt(u.lastSeen)}</dd>
          <dt>Yaş / şehir</dt><dd>${esc([u.age, u.city].filter(Boolean).join(' · ') || '—')}</dd><dt>Biyografi</dt><dd>${esc(u.bio || '—')}</dd>
          <dt>Takipçi / takip</dt><dd>${u.followers} / ${u.following}</dd><dt>Gönderilen mesaj</dt><dd>${u.messagesSent}</dd><dt>Eşleşme</dt><dd>${u.matches}</dd>
          <dt>Yaptığı şikayet</dt><dd>${u.reportsBy}</dd></dl></div></div>
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
      ${r.content ? `<div><div class="muted" style="font-size:12px;margin-bottom:4px">Şikayet edilen içerik (${{ post: 'gönderi', message: 'mesaj', story: 'hikaye', gone: 'silinmiş' }[r.content.kind]})</div>
        ${r.content.text || r.content.caption ? `<div class="det">${esc(r.content.text || r.content.caption)}</div>` : ''}<div class="media">${media(r.content)}</div></div>` : ''}
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
      ${Object.entries(FAL).map(([k, l]) => `<div class="stat"><b>${r.byType[k] || 0}</b><span>${l}</span></div>`).join('')}</div>
    <div class="panel"><div class="tw">${r.items.length ? `<table class="tbl"><thead><tr><th>Kullanıcı</th><th>Tür</th><th>Not</th><th>Gönderildi</th><th>Durum</th></tr></thead><tbody>
      ${r.items.map((x) => `<tr><td>${userCell(x.user)}</td><td>${FAL[x.type]}</td><td class="muted" style="max-width:320px">${esc((x.note || '').slice(0, 120)) || '—'}${x.images?.length ? ` · ${x.images.length} fotoğraf` : ''}</td><td>${dt(x.at)}</td><td>${x.status === 'answered' ? `<span class="chip ok">Cevaplandı</span><div class="muted" style="font-size:11.5px">${dt(x.answeredAt)}</div>` : '<span class="chip warn">Bekliyor</span>'}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Henüz fal isteği yok.</div>'}</div></div>`;
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

// ---- Duyurular ----
VIEWS.announce = async (main) => {
  const list = await api('/announcements');
  main.innerHTML = `${head('Duyurular', 'Tüm aktif kullanıcılara uygulama içi bildirim ve anlık bildirim gönderir.')}
    <div class="panel" style="margin-bottom:14px"><form class="pb" style="display:grid;gap:10px"><textarea class="field" name="t" rows="3" maxlength="300" placeholder="Örn. Bu akşam 22:00'de kısa bir bakım çalışması yapılacak."></textarea>
      <div class="row"><span class="muted grow cnt">0 / 300</span><button class="btn primary">${icon('bell')} Duyuruyu gönder</button></div></form></div>
    <div class="panel">${list.length ? list.map((a) => `<div class="case"><div>${esc(a.text)}</div><div class="muted">${dt(a.at)} · ${esc(a.by)} · ${a.reach} kişiye</div></div>`).join('') : '<div class="empty">Henüz duyuru gönderilmedi.</div>'}</div>`;
  const f = main.querySelector('form');
  f.t.oninput = () => { main.querySelector('.cnt').textContent = `${f.t.value.length} / 300`; };
  f.onsubmit = async (e) => {
    e.preventDefault();
    if (!f.t.value.trim()) return;
    if (!confirm('Duyuru tüm kullanıcılara gönderilsin mi?')) return;
    try { const a = await api('/announcements', { body: { text: f.t.value } }); toast(`${a.reach} kişiye gönderildi.`); VIEWS.announce(main); } catch (er) { toast(er.message); }
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

document.addEventListener('error', (e) => {
  const t = e.target;
  if (t.tagName === 'IMG' && !t.dataset.fb) { t.dataset.fb = '1'; t.src = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#e5e5ea"/></svg>'); }
}, true);
window.addEventListener('hashchange', render);
render();
setInterval(() => { if (S.token && document.visibilityState === 'visible') refreshCounts(); }, 30000);

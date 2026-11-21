// iPhone uygulaması bildirimleri: Apple Push Notification service (APNs), HTTP/2 + JWT (ES256, .p8 anahtar).
// Web bildirimleri (web-push) iPhone'da "from swipeup" ibaresiyle gelir; uygulamadan gelen bildirim doğrudan SwipeUp'tan görünür.
// Cihaz jetonları pushSubs koleksiyonunda { userId, apns: { token, env } } olarak tutulur (web abonelikleri { sub } ile).
// Anahtar: Yönetim → Ayarlar → iPhone bildirimleri (yalnız sahip) ya da APNS_KEY_ID / APNS_TEAM_ID / APNS_KEY / APNS_BUNDLE.
const http2 = require('http2');
const crypto = require('crypto');

const HOSTS = { production: 'https://api.push.apple.com', sandbox: 'https://api.sandbox.push.apple.com' };
const GONE = new Set(['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic', 'ExpiredToken']); // jeton artık geçersiz

function create(store) {
  const now = () => Date.now();
  const cfg = () => {
    const s = store.get('meta', 'secrets')?.apns || {};
    const key = s.key || (process.env.APNS_KEY || '').replace(/\\n/g, '\n');
    return { keyId: s.keyId || process.env.APNS_KEY_ID || '', teamId: s.teamId || process.env.APNS_TEAM_ID || '', key, bundle: s.bundle || process.env.APNS_BUNDLE || process.env.IOS_BUNDLE || 'app.swipeup.ios', at: s.at || null, fromEnv: !s.key && !!key };
  };
  const ready = () => { const c = cfg(); return !!(c.keyId && c.teamId && c.key); };

  // Apple, sağlayıcı jetonunun 20–60 dakikada bir yenilenmesini ister
  let jwt = null;
  function token(c = cfg()) {
    if (jwt && jwt.kid === c.keyId && now() - jwt.at < 45 * 60000) return jwt.v;
    const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const data = `${b({ alg: 'ES256', kid: c.keyId })}.${b({ iss: c.teamId, iat: Math.floor(now() / 1000) })}`;
    const sig = crypto.sign('sha256', Buffer.from(data), { key: c.key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
    jwt = { v: `${data}.${sig}`, kid: c.keyId, at: now() };
    return jwt.v;
  }

  const sessions = new Map(); // ortam → açık HTTP/2 bağlantısı (Apple bağlantının açık tutulmasını önerir)
  function session(env) {
    const host = process.env.APNS_HOST || HOSTS[env] || HOSTS.production;
    let s = sessions.get(host);
    if (s && !s.closed && !s.destroyed) return s;
    s = http2.connect(host);
    s.on('error', () => sessions.delete(host)); s.on('close', () => sessions.delete(host)); s.on('goaway', () => sessions.delete(host));
    s.setTimeout(10 * 60000, () => s.close()); s.unref?.();
    sessions.set(host, s);
    return s;
  }

  // payload: web bildirimindeki gövde { title, body, url, tag, call, uid }. Dönen söz: başarı ya da { statusCode, body } hatası.
  function send(dev, payload, opts = {}) {
    const c = cfg();
    if (!ready()) return Promise.reject(Object.assign(new Error('APNs anahtarı yok'), { statusCode: 0, body: 'APNs anahtarı yok' }));
    const aps = { alert: { title: String(payload.title || 'SwipeUp').slice(0, 120), body: String(payload.body || '').slice(0, 600) }, sound: 'default', ...(payload.tag ? { 'thread-id': String(payload.tag).slice(0, 64) } : {}), ...(Number.isInteger(payload.badge) && payload.badge >= 0 ? { badge: payload.badge } : {}), ...(payload.call ? { 'interruption-level': 'active' } : {}) };
    const body = JSON.stringify({ aps, url: payload.url || '/#/notifications', uid: payload.uid || null });
    const headers = {
      ':method': 'POST', ':path': `/3/device/${dev.token}`, authorization: `bearer ${token(c)}`,
      'apns-topic': c.bundle, 'apns-push-type': 'alert', 'apns-priority': opts.urgent === false ? '5' : '10',
      'apns-expiration': String(Math.floor((now() + (opts.ttl || 3600) * 1000) / 1000)),
      ...(payload.tag ? { 'apns-collapse-id': String(payload.tag).slice(0, 64) } : {}),
      'content-type': 'application/json',
    };
    return new Promise((resolve, reject) => {
      let req;
      try { req = session(dev.env).request(headers); } catch (e) { return reject(Object.assign(e, { statusCode: 0 })); }
      let status = 0; let txt = '';
      const timer = setTimeout(() => { req.close(); reject(Object.assign(new Error('APNs zaman aşımı'), { statusCode: 0, body: 'zaman aşımı' })); }, 15000);
      req.on('response', (h) => { status = h[':status']; });
      req.setEncoding('utf8'); req.on('data', (d) => { txt += d; });
      req.on('end', () => {
        clearTimeout(timer);
        if (status === 200) return resolve({ ok: true });
        let reason = ''; try { reason = JSON.parse(txt).reason || ''; } catch { reason = txt; }
        if (status === 403 && /ExpiredProviderToken|InvalidProviderToken/.test(reason)) jwt = null;
        // Kalıcı jeton hataları web aboneliğiyle aynı biçimde (410) bildirilir: pushResult kaydı siler
        reject(Object.assign(new Error(`APNs ${status} ${reason}`), { statusCode: GONE.has(reason) ? 410 : status, body: reason || txt }));
      });
      req.on('error', (e) => { clearTimeout(timer); reject(Object.assign(e, { statusCode: 0, body: e.message })); });
      req.end(body);
    });
  }

  return { cfg, ready, send, token, reset: () => { jwt = null; sessions.forEach((s) => s.close()); sessions.clear(); } };
}

// Uç noktalar: cihaz jetonu kaydı (kullanıcı) ve anahtar ayarı (yalnız sahip)
function routes(app, { store, auth, admin: A, apns, limited }) {
  const now = () => Date.now();
  const hex = (s) => String(s || '').toLowerCase().replace(/[^0-9a-f]/g, '');
  const idOf = (tok, uid) => crypto.createHash('sha1').update(`apns|${tok}|${uid}`).digest('hex');
  app.post('/api/push/apns', auth, (req, res) => {
    const tok = hex(req.body?.token); const env = req.body?.env === 'sandbox' ? 'sandbox' : 'production';
    if (tok.length < 32 || tok.length > 200) return res.status(400).json({ error: 'Cihaz jetonu geçersiz.' });
    if (limited?.(`apns:${req.user.id}`, 30, 3600000)) return res.status(429).json({ error: 'Biraz yavaş.' });
    const id = idOf(tok, req.user.id); const cur = store.get('pushSubs', id);
    if (cur && cur.apns?.env === env) return res.json({ ok: true, ready: apns.ready() });
    store.put('pushSubs', { id, userId: req.user.id, apns: { token: tok, env }, at: now() });
    res.json({ ok: true, ready: apns.ready() });
  });
  app.post('/api/push/apns/remove', auth, (req, res) => { const tok = hex(req.body?.token); if (tok) store.del('pushSubs', idOf(tok, req.user.id)); res.json({ ok: true }); });

  const gate = [A.adminAuth, A.owner];
  const out = () => { const c = apns.cfg(); return { on: apns.ready(), keyId: c.keyId || null, teamId: c.teamId || null, bundle: c.bundle, at: c.at, fromEnv: c.fromEnv, devices: store.filter('pushSubs', (s) => !!s.apns).length }; };
  app.get('/api/admin/apns', ...gate, (req, res) => res.json(out()));
  app.post('/api/admin/apns', ...gate, (req, res) => {
    const b = req.body || {}; const a = { keyId: String(b.keyId || '').trim(), teamId: String(b.teamId || '').trim(), key: String(b.key || '').trim(), bundle: String(b.bundle || 'app.swipeup.ios').trim() };
    if (!/^[A-Z0-9]{10}$/.test(a.keyId)) return res.status(400).json({ error: 'Anahtar kimliği (Key ID) 10 karakter olmalı.' });
    if (!/^[A-Z0-9]{10}$/.test(a.teamId)) return res.status(400).json({ error: 'Ekip kimliği (Team ID) 10 karakter olmalı.' });
    if (!/^[a-z][\w-]*(\.[\w-]+)+$/i.test(a.bundle)) return res.status(400).json({ error: 'Paket kimliği geçersiz (ör. app.swipeup.ios).' });
    try { crypto.createPrivateKey(a.key); apns.token(a); } catch { return res.status(400).json({ error: '.p8 anahtar dosyasının içeriğini (BEGIN PRIVATE KEY satırlarıyla) olduğu gibi yapıştır.' }); }
    const s = store.get('meta', 'secrets') || { id: 'secrets' };
    store.put('meta', { ...s, id: 'secrets', apns: { ...a, at: now() } }); apns.reset();
    A.audit?.(req.admin, 'iPhone bildirim anahtarını (APNs) kaydetti', null, a.keyId); res.json(out());
  });
  app.delete('/api/admin/apns', ...gate, (req, res) => {
    const s = store.get('meta', 'secrets') || { id: 'secrets' }; store.put('meta', { ...s, id: 'secrets', apns: null }); apns.reset();
    A.audit?.(req.admin, 'iPhone bildirim anahtarını (APNs) kaldırdı'); res.json(out());
  });
}

module.exports = { create, routes };

import { icon } from '../icons.js';
import {
  shareSheet, state, api, esc, on, toast, el, sheet, needCoins, tick, FILTERS, filterCss,
} from '../core.js';
import { giftIcon } from '../eg-icons.js';
import { openCamera, switchCamera } from '../cam.js';
import { lyricView } from '../lyrics.js';

// Yayıncı efekt seçici (izleyicilerde de aynı efekt görünür)
export function effectSheet(cur, onPick) {
  sheet('Efektler', `<div class="fstrip big">${FILTERS.map(([id, name, css]) => `<button data-f="${id}" class="${(cur || '') === id ? 'on' : ''}"><span style="background:linear-gradient(135deg,#ff8a3d,#7c3aed 55%,#22c55e);filter:${css}"></span>${name}</button>`).join('')}</div>`, {
    onMount(sh, close) {
      sh.querySelector('.fstrip').onclick = (e) => { const b = e.target.closest('[data-f]'); if (!b) return; onPick(b.dataset.f); close(); };
    },
  });
}

// Hediye seçici
async function giftSheet(hostId) {
  const g = await api('/gifts').catch(() => null);
  if (!g) return;
  sheet('Hediye gönder', `<div class="gift-grid">${g.gifts.map((x) => `<button data-g="${esc(x.id)}">${giftIcon(x, 48, 'em')}<b>${esc(x.name)}</b><small>${x.coins} jeton</small></button>`).join('')}</div>
    <div class="gift-foot"><span>Bakiye: <b class="bal">${g.coins}</b> jeton</span><a class="link" href="#/store">Jeton al</a></div>`, {
    onMount(sh) {
      sh.querySelector('.gift-grid').onclick = (e) => {
        const b = e.target.closest('[data-g]'); if (!b) return;
        b.disabled = true;
        state.socket.emit('live:gift', { hostId, giftId: b.dataset.g }, (r) => {
          b.disabled = false;
          if (r?.error) { if (r.needCoins) needCoins('Bu hediye için jetonun yetmiyor.'); else toast(r.error); return; }
          sh.querySelector('.bal').textContent = r.coins;
          state.me.coins = r.coins;
          b.classList.add('sent'); setTimeout(() => b.classList.remove('sent'), 500);
        });
      };
    },
  });
}

const rtcConfig = () => ({ iceServers: state.config?.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }] });

export function makePeer(remoteId, onTrack) {
  const pc = new RTCPeerConnection(rtcConfig());
  const pending = [];
  pc.onicecandidate = (e) => { if (e.candidate) state.socket.emit('live:signal', { to: remoteId, data: { candidate: e.candidate } }); };
  if (onTrack) pc.ontrack = onTrack;
  pc.handle = async (data) => {
    if (data.sdp) {
      await pc.setRemoteDescription(data.sdp);
      while (pending.length) await pc.addIceCandidate(pending.shift()).catch(() => {});
      if (data.sdp.type === 'offer') {
        await pc.setLocalDescription(await pc.createAnswer());
        state.socket.emit('live:signal', { to: remoteId, data: { sdp: pc.localDescription } });
      }
    } else if (data.candidate) {
      if (pc.remoteDescription) await pc.addIceCandidate(data.candidate).catch(() => {});
      else pending.push(data.candidate);
    }
  };
  return pc;
}

export function chrome(view, user, { host }) {
  view.innerHTML = `<div class="live">
    <video playsinline autoplay ${host ? 'muted class="mirror"' : ''}></video>
    <div class="ks-bg" aria-hidden="true"><i></i><i></i><i></i><span class="ks-av"><img src="${esc(user.avatar)}" alt=""></span><b class="ks-title"></b></div>
    <div class="shade"></div>
    <div class="lt">
      <img class="av av-32" src="${esc(user.avatar)}" alt="">
      <span class="u">${esc(user.username)}${tick(user)}</span>
      <span class="badge-g" hidden>${icon('gift')}<span class="gc">0</span></span>
      <span class="badge-live" hidden>CANLI</span>
      <span class="badge-v" hidden>${icon('eye')}<span class="vc">0</span></span>
      <button class="x" aria-label="${host ? 'Yayını bitir' : 'Kapat'}">${icon('close')}</button>
    </div>
    <div class="hearts"></div><div class="gifts-fx"></div>
    <div class="comments" aria-live="polite"></div>
    <div class="slot"></div>
  </div>`;
  return view.querySelector('.live');
}

export function wireChat(root, hostId) {
  const cm = root.querySelector('.comments');
  const hearts = root.querySelector('.hearts');
  const addComment = (c) => {
    cm.append(el(`<div class="c ${c.system ? 'sys' : ''}"><img class="av av-32" src="${esc(c.user?.avatar)}" alt=""><div><b>${esc(c.user?.username)}</b>${esc(c.text)}</div></div>`));
    while (cm.children.length > 40) cm.firstElementChild.remove();
  };
  const addHeart = () => {
    const h = el(`<i style="--dx:${Math.round(Math.random() * 60 - 40)}px">${['❤️', '💖', '💜', '🧡', '💛'][Math.floor(Math.random() * 5)]}</i>`);
    hearts.append(h); setTimeout(() => h.remove(), 2300);
  };
  const fx = root.querySelector('.gifts-fx');
  const addGift = (gv) => {
    const b = root.querySelector('.badge-g'); b.hidden = false; b.querySelector('.gc').textContent = gv.total;
    cm.append(el(`<div class="c gift"><img class="av av-32" src="${esc(gv.user?.avatar)}" alt=""><div><b>${esc(gv.user?.username)}</b>${giftIcon(gv.gift, 20, 'gi-inl')} ${esc(gv.gift.name)} gönderdi</div></div>`));
    while (cm.children.length > 40) cm.firstElementChild.remove();
    const big = el(`<div class="gfx ${gv.gift.coins >= 150 ? 'huge' : ''}"><span>${giftIcon(gv.gift, gv.gift.coins >= 150 ? 140 : 96)}</span><b>${esc(gv.user?.username)}</b></div>`);
    fx.append(big); setTimeout(() => big.remove(), 2600);
  };
  const offs = [
    on('live:gift', (gv) => { if (gv.hostId === hostId) addGift(gv); }),
    on('live:comment', (c) => { if (c.hostId === hostId) addComment(c); }),
    on('live:heart', (h) => { if (h.hostId === hostId) addHeart(); }),
    on('live:count', ({ hostId: h, viewers }) => { if (h === hostId) root.querySelector('.vc').textContent = viewers; }),
  ];
  const bar = el(`<form class="lb"><input placeholder="Yorum yap..." maxlength="200" aria-label="Yorum">${hostId !== state.me.id ? `<button type="button" class="gb" aria-label="Hediye gönder">${icon('gift')}</button>` : ''}<button type="button" class="hb" aria-label="Kalp gönder">${icon('heart')}</button><button type="button" class="sh" aria-label="Paylaş">${icon('send')}</button></form>`);
  bar.onsubmit = (e) => {
    e.preventDefault();
    const inp = bar.querySelector('input'); const text = inp.value.trim(); if (!text) return;
    state.socket.emit('live:comment', { hostId, text }); inp.value = '';
  };
  bar.querySelector('.hb').onclick = () => state.socket.emit('live:heart', { hostId });
  bar.querySelector('.gb')?.addEventListener('click', () => giftSheet(hostId));
  bar.querySelector('.sh').onclick = () => shareSheet({ ref: { kind: 'live', id: hostId }, url: `${location.origin}/#/live/${hostId}`, title: 'Canlı yayın', text: 'SwipeUp’ta canlı yayındayız, gel! 🔴' });
  root.append(bar);
  return () => offs.forEach((f) => f());
}

// ------------ Yayıncı ------------
// Yayıncı çekirdeği: her izleyiciye bağlantı kurar. Görüntü izi sonradan eklenebilir, değiştirilebilir ya da kapatılabilir
// (sesli yayın, kamerayı çevirme, karaoke sahnesi bunu kullanır).
export function caster(getStream) {
  const peers = new Map(); let live = false; let vtrack = null;
  const offer = async (id, pc, n = 0) => {
    if (peers.get(id) !== pc) return;
    if (pc.signalingState !== 'stable') { if (n < 10) setTimeout(() => offer(id, pc, n + 1), 400); return; } // önceki el sıkışma bitsin
    try { await pc.setLocalDescription(await pc.createOffer()); state.socket.emit('live:signal', { to: id, data: { sdp: pc.localDescription } }); } catch { /* bağlantı kapanmış olabilir */ }
  };
  const offs = [
    on('live:viewer', async ({ viewerId }) => {
      if (!live) return;
      peers.get(viewerId)?.close();
      const pc = makePeer(viewerId); peers.set(viewerId, pc);
      const s = getStream(); s.getAudioTracks().forEach((t) => pc.addTrack(t, s));
      if (vtrack) pc.vs = pc.addTrack(vtrack, s);
      await offer(viewerId, pc);
    }),
    on('live:signal', ({ from, data }) => { peers.get(from)?.handle(data).catch(() => {}); }),
    on('live:viewer-left', ({ viewerId }) => { peers.get(viewerId)?.close(); peers.delete(viewerId); }),
  ];
  return {
    get on() { return live; },
    start() { live = true; },
    // Görüntü izi: yeni iz (kamera açıldı ya da çevrildi) veya null (kamera kapandı)
    setVideo(track) {
      vtrack = track || null;
      peers.forEach((pc, id) => {
        if (pc.vs) pc.vs.replaceTrack(vtrack).catch(() => {});
        else if (vtrack) { pc.vs = pc.addTrack(vtrack, getStream()); offer(id, pc); }
      });
    },
    stop() { live = false; peers.forEach((pc) => pc.close()); peers.clear(); },
    off() { offs.forEach((f) => f()); },
  };
}

async function host(view) {
  const root = chrome(view, state.me, { host: true });
  const video = root.querySelector('video');
  const slot = root.querySelector('.slot');
  let stream; let facing = 'user'; let offChat = null; let fx = ''; let busy = false;
  const cast = caster(() => stream);
  const hasCam = () => !!stream?.getVideoTracks().length;
  const say = () => state.socket.emit('live:k', { cam: hasCam() });
  const showCam = () => { // önizlemeyi tazele (aynı akış yeniden bağlanmazsa bazı tarayıcılar eski görüntüde kalır)
    root.classList.toggle('audio', !hasCam()); video.srcObject = null;
    if (hasCam()) { video.srcObject = stream; video.play?.().catch(() => {}); }
    video.classList.toggle('mirror', facing === 'user');
  };

  if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
    slot.innerHTML = '<div class="center-msg">Bu tarayıcı canlı yayını desteklemiyor.</div>';
  } else {
    const audio = { echoCancellation: true, noiseSuppression: true };
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 720 }, height: { ideal: 1280 }, aspectRatio: { ideal: 9 / 16 } }, audio });
    } catch {
      try { stream = await navigator.mediaDevices.getUserMedia({ audio }); toast('Kamera açılamadı. İstersen yalnızca sesli yayın yapabilirsin.'); } catch {
        slot.innerHTML = `<div class="center-msg"><div>${icon('mic')}<p>Canlı yayın için mikrofon izni gerekiyor. Tarayıcı ayarlarından izin verip sayfayı yenile.</p></div></div>`;
      }
    }
  }

  async function flip() {
    if (busy || !hasCam()) return; busy = true;
    const r = await switchCamera(stream, facing === 'user' ? 'environment' : 'user'); busy = false;
    facing = r.facing; cast.setVideo(r.track); showCam(); tools();
    if (!r.ok) toast(r.track ? 'Diğer kameraya geçilemedi.' : 'Kamera açılamadı.');
    if (cast.on) say();
  }
  async function toggleCam() {
    if (busy) return; busy = true;
    if (hasCam()) { const t = stream.getVideoTracks()[0]; stream.removeTrack(t); t.stop(); cast.setVideo(null); } else {
      try { const t = await openCamera(facing); stream.addTrack(t); cast.setVideo(t); } catch { toast('Kamera açılamadı. Tarayıcı ayarlarından kamera iznini kontrol et.'); }
    }
    busy = false; showCam(); tools(); if (cast.on) say();
  }
  function tools() {
    let t = root.querySelector('.tools'); if (!t) { t = el('<div class="tools"></div>'); root.append(t); }
    const micOn = stream.getAudioTracks()[0]?.enabled !== false;
    t.innerHTML = `<button class="cam" aria-label="${hasCam() ? 'Kamerayı kapat' : 'Kamerayı aç'}">${icon(hasCam() ? 'video' : 'videoOff')}</button>
      ${hasCam() ? `<button class="flip" aria-label="Kamerayı çevir">${icon('flip')}</button>` : ''}
      <button class="mic" aria-label="${micOn ? 'Mikrofonu kapat' : 'Mikrofonu aç'}">${icon(micOn ? 'mic' : 'micOff')}</button>
      ${hasCam() ? `<button class="fx" aria-label="Efektler">${icon('wand')}</button>` : ''}`;
    t.querySelector('.cam').onclick = toggleCam;
    t.querySelector('.flip')?.addEventListener('click', flip);
    t.querySelector('.mic').onclick = () => { const a = stream.getAudioTracks()[0]; if (!a) return; a.enabled = !a.enabled; tools(); };
    t.querySelector('.fx')?.addEventListener('click', () => effectSheet(fx, (f) => {
      fx = f; video.style.filter = filterCss(f);
      if (cast.on) state.socket.emit('live:filter', { filter: f });
      const n = FILTERS.find((x) => x[0] === f)?.[1]; if (n) toast(`Efekt: ${n}`, { ms: 1200 });
    }));
  }

  if (stream) {
    showCam(); tools();
    slot.innerHTML = `<div class="setup">
      <input class="title" placeholder="Yayına bir başlık ekle (isteğe bağlı)" maxlength="80">
      <button class="go-live">Canlı yayına başla</button>
      <p style="margin:0;text-align:center;opacity:.8;font-size:13px">Takipçilerine bildirim gidecek. Kamerayı sağ üstten kapatıp yalnızca sesli de yayın yapabilirsin.</p></div>`;
    slot.querySelector('.go-live').onclick = () => {
      const title = slot.querySelector('.title').value;
      state.socket.emit('live:start', { title }, () => {
        cast.setVideo(stream.getVideoTracks()[0] || null); cast.start();
        slot.innerHTML = '';
        root.querySelector('.badge-live').hidden = false;
        root.querySelector('.badge-v').hidden = false;
        offChat = wireChat(root, state.me.id);
        say(); if (fx) state.socket.emit('live:filter', { filter: fx });
      });
    };
  }

  const stop = () => {
    if (cast.on) state.socket.emit('live:stop');
    cast.stop();
    stream?.getTracks().forEach((t) => t.stop());
  };
  root.querySelector('.x').onclick = () => {
    if (cast.on && !confirm('Canlı yayın bitirilsin mi?')) return;
    stop(); history.length > 1 ? history.back() : (location.hash = '#/');
  };
  return () => { stop(); cast.off(); offChat?.(); };
}

// ------------ İzleyici ------------
async function watch(view, hostId) {
  const host_ = await api(`/users/${hostId}`).catch(() => null);
  if (!host_) { view.innerHTML = '<div class="empty"><h2>Kullanıcı bulunamadı</h2><a class="link" href="#/">Ana sayfa</a></div>'; return null; }
  const root = chrome(view, host_, { host: false });
  const video = root.querySelector('video');
  const slot = root.querySelector('.slot');
  slot.innerHTML = '<div class="center-msg"><div class="spinner"></div></div>';
  let pc = null;

  // Sesli yayın / karaoke durumu: kamera açık mı, hangi şarkı çalıyor, sözlerin neresindeyiz
  const kl = el('<div class="kl" hidden></div>'); root.append(kl);
  const lv = lyricView(kl);
  let k = null; let kAt = 0; let kKey = null;
  const tickK = () => { if (k && lv.has) lv.at(k.pos + (k.playing ? (performance.now() - kAt) / 1000 : 0), k.dur || 0, k.playing); };
  const applyK = (m, age = 0) => {
    if (typeof m.lyr !== 'string') m.lyr = k?.lyr || '';
    k = m; kAt = performance.now() - age;
    root.classList.toggle('audio', !m.cam);
    root.querySelector('.ks-title').textContent = m.title || '';
    const key = `${m.timed ? 1 : 0}|${m.lyr}`; if (key !== kKey) { kKey = key; lv.set(m.lyr, { timed: !!m.timed }); }
    root.classList.toggle('kar', lv.has);
    if (m.kar && !root.querySelector('.lb .rb')) { // karaoke: dinleyici yayından çıkmadan puan verebilsin
      const b = el(`<button type="button" class="rb" aria-label="Puan ver">${icon('star')}</button>`);
      root.querySelector('.lb .hb')?.before(b);
      b.onclick = () => sheet('Performansa puan ver', `<div class="kr-stars big">${[1, 2, 3, 4, 5].map((i) => `<button class="kr-st" data-s="${i}" aria-label="${i} yıldız">★</button>`).join('')}</div><p class="muted" style="text-align:center;margin:10px 0 0;font-size:13px">Puanın şarkı bitince ortalamaya eklenir.</p>`, {
        onMount(sh, close) {
          sh.querySelector('.kr-stars').onclick = async (e) => {
            const st = e.target.closest('.kr-st'); if (!st) return;
            try { await api('/karaoke/score', { body: { score: +st.dataset.s } }); toast(`${st.dataset.s} puan verdin`); close(); } catch (er) { toast(er.message); }
          };
        },
      });
    }
    tickK();
  };
  const kTimer = setInterval(tickK, 120);

  const ended = () => {
    pc?.close(); pc = null;
    video.srcObject = null; clearInterval(kTimer); kl.hidden = true; root.classList.remove('audio', 'kar');
    root.querySelector('.lb')?.remove();
    root.querySelector('.badge-live').hidden = true;
    slot.innerHTML = `<div class="center-msg"><div><img class="av av-56" src="${esc(host_.avatar)}" alt="" style="margin:0 auto 12px"><h2 style="margin:0 0 6px">Canlı yayın sona erdi</h2>
      <p style="opacity:.8">${esc(host_.username)} tekrar yayına başladığında bildirim alırsın.</p>
      <a class="btn primary" href="#/u/${esc(host_.username)}">Profile git</a></div></div>`;
  };

  const offs = [
    on('live:signal', async ({ from, data }) => {
      if (!pc) {
        pc = makePeer(from, (e) => {
          video.srcObject = e.streams[0];
          video.play().then(() => { slot.innerHTML = ''; }).catch(() => {
            video.muted = true; video.play().catch(() => {});
            slot.innerHTML = `<div class="center-msg"><button class="btn primary">${icon('volume')} Sesi aç</button></div>`;
            slot.querySelector('button').onclick = () => { video.muted = false; video.play(); slot.innerHTML = ''; };
          });
        });
        pc.onconnectionstatechange = () => {
          if (pc?.connectionState === 'failed') slot.innerHTML = '<div class="center-msg">Bağlantı kurulamadı. Ağın canlı yayını engelliyor olabilir; Wi‑Fi ile tekrar dene.</div>';
        };
      }
      await pc.handle(data);
    }),
    on('live:ended', ({ userId }) => { if (userId === hostId) ended(); }),
    on('live:filter', ({ hostId: h, filter }) => { if (h === hostId) video.style.filter = filterCss(filter); }),
    on('live:k', (m) => { if (m.hostId === hostId) applyK(m); }),
  ];

  const r = await new Promise((res) => state.socket.emit('live:join', { hostId }, res));
  let offChat = null;
  if (r?.error) ended();
  else {
    root.querySelector('.badge-live').hidden = false;
    root.querySelector('.badge-v').hidden = false;
    root.querySelector('.vc').textContent = r.live.viewers;
    video.style.filter = filterCss(r.live.filter);
    offChat = wireChat(root, hostId);
    if (r.k) applyK({ hostId, ...r.k }, Math.max(0, (r.now || 0) - (r.k.at || 0)));
    let last = 0;
    video.addEventListener('click', () => { const t = Date.now(); if (t - last < 300) state.socket.emit('live:heart', { hostId }); last = t; });
  }
  root.querySelector('.x').onclick = () => (history.length > 1 ? history.back() : (location.hash = '#/'));
  return () => { state.socket.emit('live:leave'); clearInterval(kTimer); pc?.close(); offs.forEach((f) => f()); offChat?.(); };
}

export default function live(view, hostId) {
  if (!hostId || hostId === state.me.id) return host(view);
  return watch(view, hostId);
}

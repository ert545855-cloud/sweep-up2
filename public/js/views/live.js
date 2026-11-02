import { icon } from '../icons.js';
import {
  state, api, esc, on, toast, el, sheet, needCoins, tick,
} from '../core.js';

// Hediye seçici
async function giftSheet(hostId) {
  const g = await api('/gifts').catch(() => null);
  if (!g) return;
  sheet('Hediye gönder', `<div class="gift-grid">${g.gifts.map((x) => `<button data-g="${esc(x.id)}"><span class="em">${x.em}</span><b>${esc(x.name)}</b><small>${x.coins} jeton</small></button>`).join('')}</div>
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

function makePeer(remoteId, onTrack) {
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

function chrome(view, user, { host }) {
  view.innerHTML = `<div class="live">
    <video playsinline autoplay ${host ? 'muted class="mirror"' : ''}></video>
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

function wireChat(root, hostId) {
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
    cm.append(el(`<div class="c gift"><img class="av av-32" src="${esc(gv.user?.avatar)}" alt=""><div><b>${esc(gv.user?.username)}</b>${gv.gift.em} ${esc(gv.gift.name)} gönderdi</div></div>`));
    while (cm.children.length > 40) cm.firstElementChild.remove();
    const big = el(`<div class="gfx ${gv.gift.coins >= 150 ? 'huge' : ''}"><span>${gv.gift.em}</span><b>${esc(gv.user?.username)}</b></div>`);
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
  bar.querySelector('.sh').onclick = async () => {
    const url = `${location.origin}/#/live/${hostId}`;
    if (navigator.share) navigator.share({ title: 'Canlı yayın', url }).catch(() => {});
    else { await navigator.clipboard?.writeText(url); toast('Yayın bağlantısı kopyalandı.'); }
  };
  root.append(bar);
  return () => offs.forEach((f) => f());
}

// ------------ Yayıncı ------------
async function host(view) {
  const root = chrome(view, state.me, { host: true });
  const video = root.querySelector('video');
  const slot = root.querySelector('.slot');
  let stream; let facing = 'user'; let live = false; let offChat = null;
  const peers = new Map();

  if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
    slot.innerHTML = '<div class="center-msg">Bu tarayıcı kamera ile canlı yayını desteklemiyor.</div>';
  } else {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 720 }, height: { ideal: 1280 } }, audio: { echoCancellation: true, noiseSuppression: true } });
      video.srcObject = stream;
    } catch {
      slot.innerHTML = `<div class="center-msg"><div>${icon('camera')}<p>Canlı yayın için kamera ve mikrofon izni gerekiyor. Tarayıcı ayarlarından izin verip sayfayı yenile.</p></div></div>`;
    }
  }

  if (stream) {
    slot.innerHTML = `<div class="setup">
      <input class="title" placeholder="Yayına bir başlık ekle (isteğe bağlı)" maxlength="80">
      <button class="go-live">Canlı yayına başla</button>
      <p style="margin:0;text-align:center;opacity:.8;font-size:13px">Takipçilerine bildirim gidecek.</p></div>`;
    slot.querySelector('.go-live').onclick = () => {
      const title = slot.querySelector('.title').value;
      state.socket.emit('live:start', { title }, () => {
        live = true;
        slot.innerHTML = `<div class="tools">
          <button class="flip" aria-label="Kamerayı çevir">${icon('flip')}</button>
          <button class="mic" aria-label="Mikrofonu kapat">${icon('mic')}</button></div>`;
        root.querySelector('.badge-live').hidden = false;
        root.querySelector('.badge-v').hidden = false;
        offChat = wireChat(root, state.me.id);
        slot.querySelector('.flip').onclick = flip;
        slot.querySelector('.mic').onclick = (e) => {
          const t = stream.getAudioTracks()[0]; if (!t) return;
          t.enabled = !t.enabled;
          e.currentTarget.innerHTML = icon(t.enabled ? 'mic' : 'micOff');
        };
      });
    };
  }

  async function flip() {
    facing = facing === 'user' ? 'environment' : 'user';
    try {
      const ns = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } });
      const nt = ns.getVideoTracks()[0];
      const old = stream.getVideoTracks()[0];
      stream.removeTrack(old); old.stop(); stream.addTrack(nt);
      peers.forEach((pc) => pc.getSenders().find((x) => x.track?.kind === 'video')?.replaceTrack(nt));
      video.srcObject = stream;
      video.classList.toggle('mirror', facing === 'user');
    } catch { toast('Diğer kameraya geçilemedi.'); }
  }

  const offs = [
    on('live:viewer', async ({ viewerId }) => {
      if (!live) return;
      const pc = makePeer(viewerId);
      peers.set(viewerId, pc);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      await pc.setLocalDescription(await pc.createOffer());
      state.socket.emit('live:signal', { to: viewerId, data: { sdp: pc.localDescription } });
    }),
    on('live:signal', ({ from, data }) => peers.get(from)?.handle(data)),
    on('live:viewer-left', ({ viewerId }) => { peers.get(viewerId)?.close(); peers.delete(viewerId); }),
  ];

  const stop = () => {
    if (live) state.socket.emit('live:stop');
    live = false;
    peers.forEach((pc) => pc.close()); peers.clear();
    stream?.getTracks().forEach((t) => t.stop());
  };
  root.querySelector('.x').onclick = () => {
    if (live && !confirm('Canlı yayın bitirilsin mi?')) return;
    stop(); history.length > 1 ? history.back() : (location.hash = '#/');
  };
  return () => { stop(); offs.forEach((f) => f()); offChat?.(); };
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

  const ended = () => {
    pc?.close(); pc = null;
    video.srcObject = null;
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
  ];

  const r = await new Promise((res) => state.socket.emit('live:join', { hostId }, res));
  let offChat = null;
  if (r?.error) ended();
  else {
    root.querySelector('.badge-live').hidden = false;
    root.querySelector('.badge-v').hidden = false;
    root.querySelector('.vc').textContent = r.live.viewers;
    offChat = wireChat(root, hostId);
    let last = 0;
    video.addEventListener('click', () => { const t = Date.now(); if (t - last < 300) state.socket.emit('live:heart', { hostId }); last = t; });
  }
  root.querySelector('.x').onclick = () => (history.length > 1 ? history.back() : (location.hash = '#/'));
  return () => { state.socket.emit('live:leave'); pc?.close(); offs.forEach((f) => f()); offChat?.(); };
}

export default function live(view, hostId) {
  if (!hostId || hostId === state.me.id) return host(view);
  return watch(view, hostId);
}

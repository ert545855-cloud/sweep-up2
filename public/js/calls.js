// Birebir sesli / görüntülü arama (WebRTC, sinyal Socket.IO üzerinden)
import { icon } from './icons.js';
import { state, on, esc, el, toast, fmtDur } from './core.js';

let cur = null; // { id, peer, video, role, stream, pc, ui, timer, pending }

function ringtone() {
  let ctx; let iv;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const beep = () => {
      [0, 0.25].forEach((d) => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.frequency.value = 660; o.type = 'sine';
        g.gain.setValueAtTime(0.0001, ctx.currentTime + d);
        g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + d + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d + 0.2);
        o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.22);
      });
      navigator.vibrate?.([300, 200, 300]);
    };
    beep(); iv = setInterval(beep, 2000);
  } catch {}
  return () => { clearInterval(iv); ctx?.close().catch(() => {}); navigator.vibrate?.(0); };
}

function ui(peer, video, status) {
  const root = el(`<div class="call ${video ? 'is-video' : ''}" role="dialog" aria-label="Arama">
    <video class="remote" playsinline autoplay hidden></video>
    <video class="local" playsinline autoplay muted hidden></video>
    <div class="who"><img src="${esc(peer.avatar)}" alt="" class="pulse"><h2>${esc(peer.name)}</h2><div class="st">${esc(status)}</div></div>
    <div class="ctrls"></div></div>`);
  document.body.append(root);
  return root;
}

function setStatus(t) { cur?.ui.querySelector('.st') && (cur.ui.querySelector('.st').textContent = t); }

function controls(kind) {
  const c = cur.ui.querySelector('.ctrls');
  if (kind === 'incoming') {
    c.innerHTML = `<button class="end" aria-label="Reddet">${icon('phoneOff')}</button><button class="ok" aria-label="Cevapla">${icon(cur.video ? 'video' : 'phone')}</button>`;
    c.querySelector('.end').onclick = () => { state.socket.emit('call:reject', { callId: cur.id }); teardown(); };
    c.querySelector('.ok').onclick = accept;
    return;
  }
  c.innerHTML = `<button class="mic" aria-label="Mikrofon">${icon('mic')}</button>
    ${cur.video ? `<button class="cam" aria-label="Kamera">${icon('video')}</button>` : ''}
    <button class="end" aria-label="Kapat">${icon('phoneOff')}</button>`;
  c.querySelector('.end').onclick = () => { state.socket.emit('call:end', { callId: cur.id }); teardown('Arama bitti'); };
  c.querySelector('.mic').onclick = (e) => {
    const t = cur.stream?.getAudioTracks()[0]; if (!t) return;
    t.enabled = !t.enabled; e.currentTarget.classList.toggle('off', !t.enabled);
    e.currentTarget.innerHTML = icon(t.enabled ? 'mic' : 'micOff');
  };
  c.querySelector('.cam')?.addEventListener('click', (e) => {
    const t = cur.stream?.getVideoTracks()[0]; if (!t) return;
    t.enabled = !t.enabled; e.currentTarget.classList.toggle('off', !t.enabled);
    e.currentTarget.innerHTML = icon(t.enabled ? 'video' : 'videoOff');
  });
}

async function getMedia(video) {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: video ? { facingMode: 'user', width: { ideal: 720 } } : false });
  } catch {
    if (video) { toast('Kamera açılamadı, sesli devam ediliyor.'); return navigator.mediaDevices.getUserMedia({ audio: true }); }
    throw new Error('Mikrofon izni gerekiyor. Tarayıcı ayarlarından izin ver.');
  }
}

function showLocal() {
  const lv = cur.ui.querySelector('.local');
  if (cur.stream.getVideoTracks().length) { lv.srcObject = cur.stream; lv.hidden = false; }
}

function makePc(remoteSocket) {
  const pc = new RTCPeerConnection({ iceServers: state.config?.iceServers });
  cur.pc = pc; cur.remote = remoteSocket; cur.pending = [];
  cur.stream.getTracks().forEach((t) => pc.addTrack(t, cur.stream));
  pc.onicecandidate = (e) => { if (e.candidate) state.socket.emit('call:signal', { to: remoteSocket, data: { candidate: e.candidate } }); };
  pc.ontrack = (e) => {
    const rv = cur.ui.querySelector('.remote');
    rv.srcObject = e.streams[0];
    rv.hidden = false;
    rv.play().catch(() => {});
    if (e.track.kind === 'video') cur.ui.classList.add('has-video');
  };
  pc.onconnectionstatechange = () => {
    if (!cur) return;
    if (pc.connectionState === 'connected') connected();
    if (pc.connectionState === 'failed') { setStatus('Bağlantı kurulamadı'); setTimeout(() => { state.socket.emit('call:end', { callId: cur?.id }); teardown(); }, 1500); }
  };
  return pc;
}

function connected() {
  if (cur.started) return;
  cur.started = Date.now();
  cur.ui.classList.add('connected');
  cur.ui.querySelector('.who img').classList.remove('pulse');
  cur.timer = setInterval(() => setStatus(fmtDur((Date.now() - cur.started) / 1000)), 1000);
}

async function handleSignal({ from, data }) {
  if (!cur) return;
  if (!cur.pc) { if (data.sdp?.type !== 'offer') { cur.queue = [...(cur.queue || []), { from, data }]; return; } makePc(from); }
  const pc = cur.pc;
  if (data.sdp) {
    await pc.setRemoteDescription(data.sdp);
    while (cur.pending.length) await pc.addIceCandidate(cur.pending.shift()).catch(() => {});
    if (data.sdp.type === 'offer') {
      await pc.setLocalDescription(await pc.createAnswer());
      state.socket.emit('call:signal', { to: from, data: { sdp: pc.localDescription } });
    }
    (cur.queue || []).splice(0).forEach(handleSignal);
  } else if (data.candidate) {
    if (pc.remoteDescription) await pc.addIceCandidate(data.candidate).catch(() => {});
    else cur.pending.push(data.candidate);
  }
}

async function accept() {
  cur.stopRing?.();
  setStatus('Bağlanıyor...');
  try {
    cur.stream = await getMedia(cur.video);
    showLocal();
    controls('active');
    state.socket.emit('call:accept', { callId: cur.id });
  } catch (e) { toast(e.message); state.socket.emit('call:reject', { callId: cur.id }); teardown(); }
}

function teardown(msg) {
  if (!cur) return;
  cur.stopRing?.();
  clearInterval(cur.timer);
  cur.pc?.close();
  cur.stream?.getTracks().forEach((t) => t.stop());
  cur.ui.remove();
  cur = null;
  if (msg) toast(msg, { ms: 2000 });
}

export async function startCall(chatId, peer, video) {
  if (cur) return toast('Zaten bir görüşmedesin.');
  if (!window.RTCPeerConnection || !navigator.mediaDevices) return toast('Bu tarayıcı aramayı desteklemiyor.');
  cur = { id: null, peer, video, role: 'caller', ui: ui(peer, video, 'Aranıyor...') };
  controls('active');
  try {
    cur.stream = await getMedia(video);
    if (!cur) { return; }
    showLocal();
  } catch (e) { toast(e.message); teardown(); return; }
  state.socket.emit('call:start', { chatId, video }, (r) => {
    if (!cur) return;
    if (r?.error) { toast(r.error); teardown(); return; }
    cur.id = r.callId;
    setStatus(r.peer?.online ? 'Çalıyor...' : 'Aranıyor...');
  });
}

export function initCalls() {
  on('call:incoming', ({ callId, video, from }) => {
    if (cur) { if (cur.id !== callId) state.socket.emit('call:reject', { callId }); return; }
    cur = { id: callId, peer: from, video, role: 'callee', ui: ui(from, video, video ? 'Görüntülü arama' : 'Sesli arama') };
    controls('incoming');
    cur.stopRing = ringtone();
  });
  on('call:accepted', async ({ callId, peerSocket }) => {
    if (!cur || cur.id !== callId) return;
    setStatus('Bağlanıyor...');
    const pc = makePc(peerSocket);
    await pc.setLocalDescription(await pc.createOffer());
    state.socket.emit('call:signal', { to: peerSocket, data: { sdp: pc.localDescription } });
  });
  on('call:signal', handleSignal);
  on('call:taken', ({ callId }) => { if (cur?.id === callId) teardown(); });
  on('call:ended', ({ callId, reason }) => {
    if (!cur || (cur.id && cur.id !== callId)) return;
    const msg = cur.started ? 'Arama bitti' : reason === 'rejected' ? (cur.role === 'caller' ? 'Meşgul' : null) : reason === 'timeout' ? (cur.role === 'caller' ? 'Cevap yok' : 'Cevapsız arama') : 'Arama bitti';
    teardown(msg);
  });
}

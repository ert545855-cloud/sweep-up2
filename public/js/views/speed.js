// Canlı hızlı tanışma: 3 dakikalık görüntülü turlar, sonunda iki taraf da "devam" derse eşleşme.
import { icon } from '../icons.js';
import { state, esc, on, toast, tick } from '../core.js';

const pad = (n) => String(n).padStart(2, '0');
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };

export default async function speed(view) {
  const s = state.socket;
  if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) {
    view.innerHTML = `<div class="empty"><div class="big">${icon('video')}</div><h2>Bu tarayıcı desteklemiyor</h2>Hızlı tanışma için görüntülü görüşme destekleyen bir tarayıcı gerekiyor.<p><a class="btn primary" href="#/">Ana sayfa</a></p></div>`;
    return null;
  }
  view.innerHTML = `<div class="speed">
    <header class="topbar dark"><button class="ib back" aria-label="Geri">${icon('back')}</button><div class="center">⚡ Hızlı tanışma</div><span class="ib"></span></header>
    <div class="sp-stage">
      <video class="sp-remote" playsinline autoplay hidden></video>
      <video class="sp-local" playsinline autoplay muted></video>
      <div class="sp-peer" hidden></div>
      <div class="sp-timer" hidden></div>
      <div class="sp-panel"></div>
    </div></div>`;
  const remoteV = view.querySelector('.sp-remote');
  const localV = view.querySelector('.sp-local');
  const panel = view.querySelector('.sp-panel');
  const peerEl = view.querySelector('.sp-peer');
  const timerEl = view.querySelector('.sp-timer');
  let stream = null; let pc = null; let round = null; let pending = []; let tmr = null; let phase = 'lobby'; let counts = { waiting: 0, live: 0 };
  let muted = false; let camOff = false;

  const stopPc = () => { try { pc?.close(); } catch {} pc = null; pending = []; remoteV.srcObject = null; remoteV.hidden = true; };
  const stopAll = () => { clearInterval(tmr); stopPc(); stream?.getTracks().forEach((t) => t.stop()); stream = null; };

  async function cam() {
    if (stream) return stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: { facingMode: 'user', width: { ideal: 640 } } });
    } catch { toast('Kamera ve mikrofon izni gerekiyor.'); return null; }
    localV.srcObject = stream; localV.play().catch(() => {});
    return stream;
  }

  const countsHtml = () => `<div class="sp-counts"><span><b>${counts.waiting}</b> bekliyor</span><span><b>${Math.floor(counts.live / 2)}</b> görüşme sürüyor</span></div>`;
  function lobby(msg) {
    phase = 'lobby'; clearInterval(tmr); peerEl.hidden = true; timerEl.hidden = true; view.querySelector('.speed').classList.remove('in-round');
    panel.innerHTML = `<div class="sp-card">
      ${msg ? `<p class="sp-msg">${msg}</p>` : ''}
      <h2>3 dakikada tanış</h2>
      <p>Rastgele biriyle görüntülü eşleşirsin. Süre bitince ikiniz de <b>Devam</b> derseniz eşleşir, sohbete geçersiniz. İstemezsen <b>Geç</b>; kimse bilmez.</p>
      ${countsHtml()}
      <button class="btn primary block sp-join">${icon('video')} Başla</button>
      <p class="sp-rules">Kurallara aykırı davranışı bildir: kaba, müstehcen ya da 18 yaş altı görünen kişiler hesabından olur.</p></div>`;
    panel.querySelector('.sp-join').onclick = join;
  }
  async function join() {
    if (!(await cam())) return;
    if (!s?.connected) return toast('Bağlantı yok, biraz sonra dene.');
    s.emit('speed:join', {}, (r) => {
      if (r?.error) { toast(r.error); return; }
      phase = 'waiting';
      panel.innerHTML = `<div class="sp-card wait"><div class="sp-radar"><i></i><i></i><i></i></div><h2>Biri aranıyor…</h2>${countsHtml()}<button class="btn block sp-cancel">Vazgeç</button></div>`;
      panel.querySelector('.sp-cancel').onclick = () => { s.emit('speed:cancel'); lobby(); };
    });
  }

  function makePc(remote) {
    pc = new RTCPeerConnection({ iceServers: state.config?.iceServers });
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    pc.onicecandidate = (e) => { if (e.candidate) s.emit('speed:signal', { to: remote, data: { candidate: e.candidate } }); };
    pc.ontrack = (e) => { remoteV.srcObject = e.streams[0]; remoteV.hidden = false; remoteV.play().catch(() => {}); };
    pc.onconnectionstatechange = () => { if (pc?.connectionState === 'failed') toast('Bağlantı zayıf, görüntü gelmeyebilir.'); };
    return pc;
  }
  async function onSignal({ from, data }) {
    if (!round || from !== round.peerSocket) return;
    if (!pc) makePc(from);
    if (data.sdp) {
      await pc.setRemoteDescription(data.sdp);
      while (pending.length) await pc.addIceCandidate(pending.shift()).catch(() => {});
      if (data.sdp.type === 'offer') { await pc.setLocalDescription(await pc.createAnswer()); s.emit('speed:signal', { to: from, data: { sdp: pc.localDescription } }); }
    } else if (data.candidate) {
      if (pc.remoteDescription) await pc.addIceCandidate(data.candidate).catch(() => {}); else pending.push(data.candidate);
    }
  }

  async function onPaired(r) {
    round = { ...r, skew: Date.now() - r.now };
    phase = 'round';
    view.querySelector('.speed').classList.add('in-round');
    const p = r.peer;
    peerEl.hidden = false;
    peerEl.innerHTML = `<img src="${esc(p.avatar)}" alt=""><div><b>${esc(p.name.split(' ')[0])}${p.age ? `, ${p.age}` : ''}${tick(p)}</b><small>${esc([p.city, ...(p.interests || []).slice(0, 2)].filter(Boolean).join(' · '))}</small>
      ${p.prompt ? `<em>${esc(p.prompt.q)} ${esc(p.prompt.a)}</em>` : ''}</div>`;
    timerEl.hidden = false;
    clearInterval(tmr);
    const paint = () => { const left = r.end + round.skew - Date.now(); timerEl.textContent = mmss(left); timerEl.classList.toggle('low', left < 30000); };
    paint(); tmr = setInterval(paint, 500);
    panel.innerHTML = `<div class="sp-ctrl"><button class="sp-b mute" aria-label="Mikrofon">${icon('mic')}</button><button class="sp-b cam" aria-label="Kamera">${icon('video')}</button>
      <button class="sp-b skip" aria-label="Geç">${icon('close')}<span>Geç</span></button><button class="sp-b like" aria-label="Devam">${icon('heart')}<span>Devam</span></button></div>`;
    wireCtrl();
    stopPc();
    if (!(await cam())) return;
    if (r.offerer) {
      makePc(r.peerSocket);
      await pc.setLocalDescription(await pc.createOffer());
      s.emit('speed:signal', { to: r.peerSocket, data: { sdp: pc.localDescription } });
    }
  }
  function wireCtrl() {
    const m = panel.querySelector('.mute'); const c = panel.querySelector('.cam');
    m.classList.toggle('off', muted); c.classList.toggle('off', camOff);
    m.onclick = () => { muted = !muted; stream?.getAudioTracks().forEach((t) => { t.enabled = !muted; }); m.classList.toggle('off', muted); };
    c.onclick = () => { camOff = !camOff; stream?.getVideoTracks().forEach((t) => { t.enabled = !camOff; }); c.classList.toggle('off', camOff); };
    panel.querySelector('.skip').onclick = () => vote('gec');
    panel.querySelector('.like').onclick = () => vote('devam');
  }
  function vote(v) {
    if (!round) return;
    s.emit('speed:vote', { roundId: round.roundId, vote: v });
    if (v === 'devam') {
      panel.querySelector('.like')?.classList.add('on');
      if (phase === 'vote') panel.innerHTML = '<div class="sp-card"><h2>💞 Devam dedin</h2><p>Karşı tarafın cevabı bekleniyor…</p></div>';
      else toast('Devam dedin. Süre bitince sonucu göreceksin.');
    }
  }
  function onVote({ roundId, until }) {
    if (!round || round.roundId !== roundId) return;
    phase = 'vote';
    clearInterval(tmr);
    const paint = () => { timerEl.textContent = mmss(until + round.skew - Date.now()); };
    paint(); tmr = setInterval(paint, 500); timerEl.classList.add('low');
    const already = panel.querySelector('.like.on');
    panel.innerHTML = already ? '<div class="sp-card"><h2>💞 Devam dedin</h2><p>Karşı tarafın cevabı bekleniyor…</p></div>'
      : `<div class="sp-card"><h2>Süre doldu!</h2><p>${esc(round.peer.name.split(' ')[0])} ile devam etmek ister misin? Cevabını o göremez; ikiniz de devam derseniz eşleşirsiniz.</p>
        <div class="sp-vote"><button class="btn sp-no">Geç</button><button class="btn primary sp-yes">${icon('heart')} Devam</button></div></div>`;
    panel.querySelector('.sp-no')?.addEventListener('click', () => { vote('gec'); panel.innerHTML = '<div class="sp-card"><h2>Tamam</h2><p>Sıradaki tur birazdan…</p></div>'; });
    panel.querySelector('.sp-yes')?.addEventListener('click', () => vote('devam'));
  }
  function onResult(r) {
    if (!round || round.roundId !== r.roundId) return;
    const peer = round.peer; round = null; stopPc(); clearInterval(tmr);
    peerEl.hidden = true; timerEl.hidden = true; timerEl.classList.remove('low');
    view.querySelector('.speed').classList.remove('in-round');
    if (r.match) {
      phase = 'match';
      panel.innerHTML = `<div class="sp-card match"><div class="sp-hearts">💞</div><h2>Eşleştiniz!</h2><p>İkiniz de devam dediniz. ${esc(peer.name.split(' ')[0])} ile sohbetiniz hazır.</p>
        <a class="btn primary block" href="#/chat/${esc(r.chatId)}">${icon('send')} Mesaj gönder</a><button class="btn block sp-again">Yeni tur</button></div>`;
      panel.querySelector('.sp-again').onclick = join;
      return;
    }
    lobby(r.reason === 'left' ? 'Karşı taraf ayrıldı.' : r.reason === 'skipped' ? 'Tur bitti. Yeni biriyle dene!' : 'Bu sefer olmadı. Sıradaki seni bekliyor!');
  }

  const offs = [
    on('speed:count', (c) => { counts = c; panel.querySelectorAll('.sp-counts').forEach((x) => { x.outerHTML = countsHtml(); }); }),
    on('speed:paired', onPaired),
    on('speed:signal', onSignal),
    on('speed:vote', onVote),
    on('speed:result', onResult),
    on('reconnected', () => { s?.emit('speed:watch'); if (phase !== 'lobby') lobby('Bağlantı koptu, yeniden başla.'); }),
  ];
  s?.emit('speed:watch');
  lobby();
  cam();
  view.querySelector('.back').onclick = () => { history.length > 1 ? history.back() : (location.hash = '#/'); };

  return () => { s?.emit('speed:leave'); offs.forEach((f) => f()); stopAll(); };
}

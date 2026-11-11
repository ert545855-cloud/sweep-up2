// Karaoke sahnesi: sırası gelen kişi burada söyler. Kamera isteğe bağlıdır. Müzik (vokalsiz kayıt) telefonda çalar,
// mikrofonla karıştırılıp dinleyicilere tek ses olarak gider; şarkı sözleri altta akar.
import { icon } from '../icons.js';
import { state, api, esc, on, toast, el, sheet, FILTERS, filterCss } from '../core.js';
import { chrome, wireChat, caster, effectSheet, makePeer } from './live.js';
import { openCamera, switchCamera } from '../cam.js';
import { lyricView, parseLyrics } from '../lyrics.js';
import { leaveTo } from '../nav.js';
import { uploadFile } from '../core.js';

const mmss = (s) => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// Ses motoru: mikrofon + müzik tek akışta birleşir. Vokal kısma: stereo kaydın ortasındaki sesi (L−R) siler, basları korur.
function engine(mic) {
  const au = new Audio(); au.preload = 'auto';
  const AC = window.AudioContext || window.webkitAudioContext;
  try {
    const ctx = new AC(); if (!ctx.createMediaStreamDestination) throw new Error('yok');
    const out = ctx.createMediaStreamDestination();
    const micG = ctx.createGain(); ctx.createMediaStreamSource(mic).connect(micG); micG.connect(out);
    const src = ctx.createMediaElementSource(au);
    const split = ctx.createChannelSplitter(2); const inv = ctx.createGain(); inv.gain.value = -1; const side = ctx.createGain(); side.gain.value = 1.35;
    src.connect(split); split.connect(side, 0); split.connect(inv, 1); inv.connect(side);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 160; side.connect(hp);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160; src.connect(lp);
    const dry = ctx.createGain(); const wet = ctx.createGain(); wet.gain.value = 0; src.connect(dry); hp.connect(wet); lp.connect(wet);
    const music = ctx.createGain(); music.gain.value = 0.8; dry.connect(music); wet.connect(music); music.connect(ctx.destination); music.connect(out);
    const solo = ctx.createMediaStreamDestination(); micG.connect(solo); music.connect(solo); // düet konuğuna giden karışım: kendi sesi yok
    return {
      au, mixed: true, track: out.stream.getAudioTracks()[0], soloTrack: solo.stream.getAudioTracks()[0],
      // Düet konuğunun sesi: hem dinleyicilere hem şarkıcının hoparlörüne. Dönen işlev konuğu çıkarır.
      addGuest(stream) { const src2 = ctx.createMediaStreamSource(stream); const g = ctx.createGain(); src2.connect(g); g.connect(out); g.connect(ctx.destination); return () => { try { src2.disconnect(); g.disconnect(); } catch { /* zaten kopmuş */ } }; },
      resume: () => ctx.resume().catch(() => {}),
      setVox(v) { dry.gain.value = v ? 0 : 1; wet.gain.value = v ? 1 : 0; },
      setVol(v) { music.gain.value = v; },
      close() { au.pause(); au.removeAttribute('src'); ctx.close().catch(() => {}); },
    };
  } catch { // ses karıştırma desteklenmiyorsa: müzik yalnızca hoparlörden çalar, mikrofon olduğu gibi gider
    return { au, mixed: false, track: mic.getAudioTracks()[0], resume: async () => {}, setVox() {}, setVol(v) { au.volume = v; }, close() { au.pause(); au.removeAttribute('src'); } };
  }
}

export default async function sahne(view) {
  let d;
  try { d = await api('/karaoke'); } catch (e) { toast(e.message); leaveTo('#/karaoke'); return null; }
  if (!d.myTurn) { toast('Şu an sahnede değilsin. Sıraya gir, sıran gelince sahne senin.'); leaveTo('#/karaoke'); return null; }

  const root = chrome(view, state.me, { host: true }); root.classList.add('ks', 'audio');
  const video = root.querySelector('video'); const slot = root.querySelector('.slot');
  root.querySelector('.x').before(el('<span class="ks-left" title="Kalan sahne süresi"></span>'));
  const S = { title: d.cur.song, lyrics: '', audio: '', file: '', vox: false, vol: 0.8, off: 0, facing: 'user', fx: '' };
  let mic = null; let cam = null; let eng = null; let out = null; let offChat = null; let busy = false; let gone = false; let lv = null; let sentLyr = null;
  let duo = null; let rec = null; let recParts = []; let recDraw = null; // duo: düet konuğu { id, name, pc, off }
  const cast = caster(() => out);
  const timed = () => !!S.audio && parseLyrics(S.lyrics).synced;
  const pos = () => (eng && S.audio ? Math.max(0, eng.au.currentTime + S.off) : 0);
  root.querySelector('.ks-title').textContent = S.title;

  // Dinleyicilere durum: kamera, şarkı, kaçıncı saniye; sözler yalnızca değişince gider
  const say = () => {
    if (!cast.on) return;
    const m = { cam: !!cam, title: duo ? `${S.title} · @${duo.name} ile düet` : S.title, playing: !!(eng && S.audio && !eng.au.paused), timed: timed(), pos: pos(), dur: eng?.au.duration || 0 };
    if (S.lyrics !== sentLyr) { sentLyr = S.lyrics; m.lyr = S.lyrics; }
    state.socket.emit('live:k', m);
  };
  const showCam = () => {
    root.classList.toggle('audio', !cam); video.srcObject = null;
    if (cam) { video.srcObject = new MediaStream([cam]); video.play?.().catch(() => {}); }
    video.classList.toggle('mirror', S.facing === 'user'); video.style.filter = cam ? filterCss(S.fx) : '';
  };
  async function toggleCam() {
    if (busy) return; busy = true;
    if (cam) { out?.removeTrack(cam); cam.stop(); cam = null; cast.setVideo(null); } else {
      try { cam = await openCamera(S.facing); out?.addTrack(cam); cast.setVideo(cam); } catch { toast('Kamera açılamadı. Kamerasız da söyleyebilirsin.'); }
    }
    busy = false; showCam(); paint(); say();
  }
  async function flip() {
    if (busy || !cam) return; busy = true;
    const box = new MediaStream([cam]); const r = await switchCamera(box, S.facing === 'user' ? 'environment' : 'user'); busy = false;
    if (out) { out.getVideoTracks().forEach((t) => out.removeTrack(t)); if (r.track) out.addTrack(r.track); }
    cam = r.track; S.facing = r.facing; cast.setVideo(cam); showCam(); paint(); say();
    if (!r.ok) toast(cam ? 'Diğer kameraya geçilemedi.' : 'Kamera açılamadı.');
  }
  const pickFile = () => new Promise((res) => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'audio/*'; i.onchange = () => res(i.files[0] || null); i.click(); });
  async function chooseMusic() {
    const f = await pickFile(); if (!f) return;
    if (!/^audio\//.test(f.type) && !/\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(f.name)) return toast('Bir ses dosyası seç (MP3, M4A, WAV).');
    if (S.audio.startsWith('blob:')) URL.revokeObjectURL(S.audio);
    S.audio = URL.createObjectURL(f); S.file = f.name.replace(/\.[^.]+$/, '').slice(0, 60); S.vox = true; // kendi dosyasında büyük ihtimalle vokal var
    if (eng) { eng.au.src = S.audio; eng.setVox(S.vox); eng.au.play().catch(() => {}); lv?.set(S.lyrics, { timed: timed() }); }
    paint(); say();
  }
  function editLyrics() {
    sheet('Şarkı sözleri', `<textarea class="field ks-ta" rows="9" placeholder="Sözleri buraya yapıştır. Satır başında [01:23.45] gibi zaman damgaları varsa sözler müzikle birlikte ilerler.">${esc(S.lyrics)}</textarea>
      <div class="row" style="gap:8px;margin-top:10px"><button class="btn ks-find">${icon('search')} Sözleri bul</button><span class="grow"></span><button class="btn primary ks-save">Kaydet</button></div>`, {
      onMount(sh, close) {
        const ta = sh.querySelector('textarea');
        sh.querySelector('.ks-find').onclick = async (e) => {
          const b = e.currentTarget; b.disabled = true;
          try { const r = await api(`/karaoke/lyrics?q=${encodeURIComponent(S.title)}`); if (r.lyrics) { ta.value = r.lyrics; toast(r.synced ? 'Zaman ayarlı sözler bulundu.' : 'Sözler bulundu.'); } else toast('Bu şarkının sözleri bulunamadı. Elle yapıştırabilirsin.'); } catch (er) { toast(er.message); }
          b.disabled = false;
        };
        sh.querySelector('.ks-save').onclick = () => { S.lyrics = ta.value.trim().slice(0, 12000); lv?.set(S.lyrics, { timed: timed() }); root.classList.toggle('nol', !S.lyrics); paint(); say(); close(); };
      },
    });
  }
  function musicSheet() {
    sheet('Müzik ayarları', `<div class="ks-opts">
        <label class="ks-row"><div class="grow"><b>Vokali kıs</b><small>Kayıttaki şarkıcının sesini azaltır. Stereo kayıtlarda işe yarar; en temiz sonuç vokalsiz kayıtla alınır.</small></div><input type="checkbox" class="sw ks-vx" ${S.vox ? 'checked' : ''} ${S.audio ? '' : 'disabled'}></label>
        <label class="ks-row"><div class="grow"><b>Müzik sesi</b></div><input type="range" class="ks-vol" min="0" max="100" value="${Math.round(S.vol * 100)}" aria-label="Müzik sesi"></label>
        <div class="ks-row"><div class="grow"><b>Söz zamanlaması</b><small>Sözler müzikten erken ya da geç kalıyorsa kaydır.</small></div><button class="btn sm ks-om" aria-label="Sözleri geciktir">−</button><b class="ks-ov">${S.off.toFixed(1)} sn</b><button class="btn sm ks-op" aria-label="Sözleri öne al">+</button></div>
        <button class="btn block ks-mf">${icon('music')} ${S.audio ? 'Başka bir müzik dosyası seç' : 'Telefonundan müzik dosyası seç'}</button></div>`, {
      onMount(sh, close) {
        sh.querySelector('.ks-vx').onchange = (e) => { S.vox = e.target.checked; eng?.setVox(S.vox); paint(); };
        sh.querySelector('.ks-vol').oninput = (e) => { S.vol = e.target.value / 100; eng?.setVol(S.vol); };
        const ov = sh.querySelector('.ks-ov'); const nudge = (x) => { S.off = Math.max(-10, Math.min(10, +(S.off + x).toFixed(1))); ov.textContent = `${S.off.toFixed(1)} sn`; say(); };
        sh.querySelector('.ks-om').onclick = () => nudge(-0.5); sh.querySelector('.ks-op').onclick = () => nudge(0.5);
        sh.querySelector('.ks-mf').onclick = () => { close(); chooseMusic(); };
      },
    });
  }

  // ---- Görünüm ----
  const musicLine = () => (S.audio ? (S.file ? `Kendi dosyan: ${S.file}` : 'Vokalsiz kayıt hazır') + (S.vox ? ' · vokal kısılıyor' : '') : 'Bu şarkının müziği yok. İstersen telefonundan seç ya da müziksiz söyle.');
  const lyrLine = () => (S.lyrics ? (parseLyrics(S.lyrics).synced ? (S.audio ? 'Sözler müzikle birlikte ilerleyecek' : 'Sözler hazır') : 'Sözler hazır, elle kaydırılır') : 'Söz bulunamadı. Yapıştırabilir ya da aratabilirsin.');
  function tools() {
    let t = root.querySelector('.tools'); if (!t) { t = el('<div class="tools"></div>'); root.append(t); }
    const micOn = mic?.getAudioTracks()[0]?.enabled !== false;
    t.innerHTML = `<button class="cam" aria-label="${cam ? 'Kamerayı kapat' : 'Kamerayı aç'}">${icon(cam ? 'video' : 'videoOff')}</button>
      ${cam ? `<button class="flip" aria-label="Kamerayı çevir">${icon('flip')}</button><button class="fx" aria-label="Efektler">${icon('wand')}</button>` : ''}
      <button class="mic" aria-label="${micOn ? 'Mikrofonu kapat' : 'Mikrofonu aç'}">${icon(micOn ? 'mic' : 'micOff')}</button>
      <button class="mus" aria-label="Müzik ayarları">${icon('sliders')}</button>
      <button class="lyr" aria-label="Şarkı sözleri">${icon('text')}</button>
      ${duo ? `<button class="duo on" aria-label="Düeti bitir">${icon('users')}</button>` : ''}`;
    t.querySelector('.duo')?.addEventListener('click', () => { if (confirm(`@${duo.name} ile düet bitirilsin mi?`)) endDuet(true); });
    t.querySelector('.cam').onclick = toggleCam; t.querySelector('.flip')?.addEventListener('click', flip);
    t.querySelector('.mic').onclick = () => { const a = mic.getAudioTracks()[0]; if (a) { a.enabled = !a.enabled; tools(); } };
    t.querySelector('.mus').onclick = musicSheet; t.querySelector('.lyr').onclick = editLyrics;
    t.querySelector('.fx')?.addEventListener('click', () => effectSheet(S.fx, (f) => {
      S.fx = f; video.style.filter = filterCss(f); if (cast.on) state.socket.emit('live:filter', { filter: f });
      const n = FILTERS.find((x) => x[0] === f)?.[1]; if (n) toast(`Efekt: ${n}`, { ms: 1200 });
    }));
  }
  function paint() {
    if (gone || !mic) return;
    tools();
    if (!cast.on) { // sahneye çıkmadan önce: hazırlık kartı
      slot.innerHTML = `<div class="setup ks-set">
        <h2>${esc(S.title)}</h2>
        <div class="ks-row"><span class="ks-ic">${icon('music')}</span><div class="grow"><b>Müzik</b><small>${esc(musicLine())}</small></div><button class="btn sm ks-m">${S.audio ? 'Ayarla' : 'Dosya seç'}</button></div>
        <div class="ks-row"><span class="ks-ic">${icon('text')}</span><div class="grow"><b>Sözler</b><small>${esc(lyrLine())}</small></div><button class="btn sm ks-l">${S.lyrics ? 'Düzenle' : 'Ekle'}</button></div>
        <label class="ks-row"><span class="ks-ic">${icon('camera')}</span><div class="grow"><b>Kamera</b><small>Zorunlu değil. Kapalıyken dinleyiciler sahne ışıklarını ve sözleri görür.</small></div><input type="checkbox" class="sw ks-c" ${cam ? 'checked' : ''}></label>
        <button class="go-live">Sahneye çık</button>
        <p class="ks-note">Kulaklık takarsan sesin dinleyicilere daha temiz gider.</p></div>`;
      slot.querySelector('.ks-m').onclick = () => (S.audio ? musicSheet() : chooseMusic());
      slot.querySelector('.ks-l').onclick = editLyrics;
      slot.querySelector('.ks-c').onchange = toggleCam;
      slot.querySelector('.go-live').onclick = go;
      return;
    }
    const bar = root.querySelector('.ks-bar'); if (!bar) return;
    bar.innerHTML = S.audio
      ? `<button class="ks-pp" aria-label="${eng.au.paused ? 'Müziği başlat' : 'Müziği duraklat'}">${icon(eng.au.paused ? 'play' : 'pause')}</button>
        <div class="ks-meta"><b>${esc(S.title)}</b><span class="ks-time"></span></div>
        <button class="ks-re" aria-label="Şarkıyı baştan başlat">${icon('undo')}</button>`
      : `<div class="ks-meta"><b>${esc(S.title)}</b><span>Müziksiz söylüyorsun</span></div><button class="btn sm ks-add">${icon('music')} Müzik seç</button>`;
    bar.querySelector('.ks-pp')?.addEventListener('click', () => { if (eng.au.paused) eng.au.play().catch(() => toast('Müzik başlatılamadı.')); else eng.au.pause(); });
    bar.querySelector('.ks-re')?.addEventListener('click', () => { eng.au.currentTime = 0; eng.au.play().catch(() => {}); });
    bar.querySelector('.ks-add')?.addEventListener('click', chooseMusic);
  }

  async function go() {
    if (busy) return; busy = true;
    eng = engine(mic); await eng.resume(); eng.setVox(S.vox); eng.setVol(S.vol);
    if (S.audio) { // tarayıcı, müziği sonradan kendiliğinden başlatmaya izin versin diye dokunuş anında bir kez çal-durdur
      eng.au.src = S.audio; eng.au.muted = true;
      try { await eng.au.play(); eng.au.pause(); eng.au.currentTime = 0; } catch { /* çalınamazsa kullanıcı düğmeyle başlatır */ }
      eng.au.muted = false;
    }
    out = new MediaStream([eng.track]); if (cam) out.addTrack(cam);
    const late = setTimeout(() => { if (!cast.on && !gone) { busy = false; toast('Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.'); } }, 7000);
    state.socket.emit('live:start', { title: `🎤 ${S.title}`.slice(0, 80), kar: true }, () => {
      clearTimeout(late); busy = false; if (gone || cast.on) return;
      cast.setVideo(cam); cast.start(); root.classList.add('on');
      slot.innerHTML = '';
      root.querySelector('.badge-live').hidden = false; root.querySelector('.badge-v').hidden = false;
      offChat = wireChat(root, state.me.id);
      const dock = el('<div class="ks-dock"><div class="ks-bar"></div><div class="ks-prog"><i></i></div><div class="ks-ly"></div></div>'); root.append(dock);
      lv = lyricView(dock.querySelector('.ks-ly')); lv.set(S.lyrics, { timed: timed() }); root.classList.toggle('nol', !S.lyrics);
      ['play', 'pause', 'seeked', 'ended', 'loadedmetadata'].forEach((ev) => eng.au.addEventListener(ev, () => { paint(); say(); }));
      eng.au.addEventListener('ended', () => toast('Şarkı bitti! İstersen baştan başlat ya da sahneden in.', { ms: 5000 }));
      paint(); say(); if (S.fx) state.socket.emit('live:filter', { filter: S.fx });
      startRec();
      if (S.audio) { // kısa geri sayım, sonra müzik
        const c = el('<div class="ks-count">3</div>'); root.append(c); let n = 3;
        const iv = setInterval(() => { n -= 1; if (n > 0 && !gone) { c.textContent = n; return; } clearInterval(iv); c.remove(); if (!gone) eng.au.play().catch(() => toast('Müziği başlatmak için oynat düğmesine dokun.')); }, 800);
      }
    });
  }

  let told = false; const done = () => { if (told) return Promise.resolve(); told = true; return api('/karaoke/done', { body: {} }); };
  function stopAll() {
    if (gone) return; gone = true; endDuet(true);
    if (cast.on) state.socket.emit('live:stop');
    cast.stop(); eng?.close(); mic?.getTracks().forEach((t) => t.stop()); cam?.stop();
    if (S.audio.startsWith('blob:')) URL.revokeObjectURL(S.audio);
  }
  async function finish(ask) {
    if (ask && cast.on && !confirm('Sahneden inip sıradakine geçilsin mi?')) return;
    const was = cast.on; const clip = was ? stopRec() : null; stopAll();
    if (was) { try { await done(); toast('Teşekkürler! Puanların birazdan bildirim olarak gelecek.'); } catch { /* süre zaten dolmuş olabilir */ } }
    leaveTo('#/karaoke'); clip?.then((c) => setTimeout(() => offerClip(c), 800)) /* sayfa değişimi açık pencereleri kapatır: sonra aç */;
  }
  root.querySelector('.x').onclick = () => finish(true);

  // ---- Düet: bir dinleyici mikrofonuyla katılır; sesi karışıma eklenir, kendisine konuksuz karışım gider ----
  function endDuet(tell) {
    if (!duo) return; const g = duo; duo = null;
    if (tell) state.socket.emit('live:signal', { to: g.id, data: { duet: { end: true } } });
    g.off?.(); g.pc?.close(); if (eng?.mixed) cast.setAudioFor(g.id, eng.track);
    if (!gone) { toast(`@${g.name} düetten ayrıldı.`); paint(); say(); }
  }
  cast.onLeft = (id) => { if (duo?.id === id) endDuet(false); };
  cast.onDuet = (from, m) => {
    const no = (why) => state.socket.emit('live:signal', { to: from, data: { duet: { no: why } } });
    if (m.ask) {
      if (!cast.on || !eng?.mixed || !cast.has(from)) return no('Şarkıcı şu an düet açamıyor.');
      if (duo) return no('Sahnede zaten bir düet var.');
      const name = String(m.name || 'biri').slice(0, 24); let answered = false;
      sheet('Düet isteği', `<p style="margin:0 0 14px">@${esc(name)} seninle düet yapmak istiyor. Kabul edersen sesi sahneye eklenir.</p><div class="row" style="gap:8px"><button class="btn dn">Şimdi değil</button><span class="grow"></span><button class="btn primary dy">${icon('users')} Kabul et</button></div>`, {
        onMount(sh, close) {
          sh.querySelector('.dn').onclick = () => { answered = true; no('Şarkıcı şimdilik tek söylemek istiyor.'); close(); };
          sh.querySelector('.dy').onclick = () => {
            answered = true; close(); if (duo || gone || !cast.has(from)) return no('Düet açılamadı.');
            const g = { id: from, name }; duo = g;
            g.pc = makePeer(from, (e) => { if (duo !== g) return; g.off?.(); g.off = eng.addGuest(e.streams[0] || new MediaStream([e.track])); cast.setAudioFor(from, eng.soloTrack); }, 'duet');
            g.pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(g.pc.connectionState) && duo === g) endDuet(false); };
            state.socket.emit('live:signal', { to: from, data: { duet: { yes: true } } }); paint(); say(); toast(`@${name} düete katılıyor.`);
          };
        },
        onClose() { if (!answered) no('Şarkıcı yanıt vermedi.'); },
      });
    } else if (m.end) { if (duo?.id === from) endDuet(false); } else if (duo?.id === from) duo.pc.handle(m).catch(() => {});
  };

  // ---- Performans kaydı: sahne (kamera ya da sahne kartı) + karışık ses tek videoya yazılır ----
  function startRec() {
    if (!window.MediaRecorder || !eng?.mixed) return;
    const type = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t)); if (!type) return;
    try {
      const cv = document.createElement('canvas'); cv.width = 480; cv.height = 854; const g = cv.getContext('2d'); const av = new Image(); av.crossOrigin = 'anonymous'; av.src = state.me.avatar || '';
      const wrap = (text, y, size, max) => { g.font = `700 ${size}px system-ui, sans-serif`; const words = String(text).split(' '); let line = ''; const lines = []; words.forEach((w) => { if (g.measureText(`${line} ${w}`).width > 430 && line) { lines.push(line); line = w; } else line = line ? `${line} ${w}` : w; }); lines.push(line); lines.slice(0, max).forEach((l, i) => g.fillText(l, 240, y + i * size * 1.25)); };
      const draw = () => {
        const gr = g.createLinearGradient(0, 0, 0, 854); gr.addColorStop(0, '#7c2d9c'); gr.addColorStop(0.75, '#1d0b33'); g.fillStyle = gr; g.fillRect(0, 0, 480, 854);
        if (cam && video.videoWidth) { const s = Math.max(480 / video.videoWidth, 854 / video.videoHeight); const w = video.videoWidth * s; const h = video.videoHeight * s; g.save(); if (S.facing === 'user') { g.translate(480, 0); g.scale(-1, 1); } g.drawImage(video, (480 - w) / 2, (854 - h) / 2, w, h); g.restore(); }
        else if (av.complete && av.naturalWidth) { g.save(); g.beginPath(); g.arc(240, 330, 96, 0, Math.PI * 2); g.clip(); try { g.drawImage(av, 144, 234, 192, 192); } catch { /* yabancı kaynak */ } g.restore(); g.strokeStyle = '#ffd778'; g.lineWidth = 5; g.beginPath(); g.arc(240, 330, 97, 0, Math.PI * 2); g.stroke(); }
        g.fillStyle = 'rgba(12,6,24,.55)'; g.fillRect(0, 640, 480, 214); g.textAlign = 'center'; g.fillStyle = '#ffd34d'; wrap(root.querySelector('.ks-ly .cu')?.textContent || '♪', 700, 26, 2);
        g.fillStyle = '#fff'; wrap(S.title, 790, 18, 1); g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '600 15px system-ui, sans-serif'; g.fillText(`@${state.me.username} · SwipeUp Karaoke`, 240, 826);
      };
      draw(); recDraw = setInterval(draw, 80);
      const st = cv.captureStream(12); st.addTrack(eng.track.clone()); recParts = [];
      rec = new MediaRecorder(st, { mimeType: type, videoBitsPerSecond: 900000, audioBitsPerSecond: 96000 });
      rec.ondataavailable = (e) => { if (e.data.size) recParts.push(e.data); }; rec.start(1000);
    } catch { rec = null; clearInterval(recDraw); }
  }
  // Kaydı kapatır; en az 10 saniyelik kayıt varsa { blob, url, type } döner
  function stopRec() {
    if (!rec || rec.state === 'inactive') { clearInterval(recDraw); return null; }
    const r = rec; rec = null; const began = d.cur?.startedAt || 0;
    return new Promise((res) => { r.onstop = () => { clearInterval(recDraw); r.stream.getTracks().forEach((t) => t.stop()); const blob = new Blob(recParts, { type: r.mimeType.split(';')[0] }); recParts = []; res(blob.size > 150000 ? { blob, type: blob.type, song: S.title, began } : null); }; try { r.stop(); } catch { res(null); } });
  }
  function offerClip(c) {
    if (!c) return; const url = URL.createObjectURL(c.blob); const ext = c.type.includes('mp4') ? 'mp4' : 'webm'; const mb = (c.blob.size / 1048576).toFixed(1);
    sheet('Performansın kaydedildi', `<video src="${url}" controls playsinline style="width:100%;max-height:46vh;border-radius:14px;background:#000"></video>
      <p class="muted" style="margin:10px 0;font-size:13px">${esc(c.song)} · ${mb} MB. Paylaşmazsan kayıt silinir.</p>
      <div style="display:grid;gap:8px"><button class="btn primary block cs">${icon('reels')} Reels’te paylaş</button><a class="btn block" href="${url}" download="karaoke-${Date.now()}.${ext}">${icon('download')} Cihaza indir</a></div>`, {
      onMount(sh, close) {
        sh.querySelector('.cs').onclick = async (e) => {
          const b = e.currentTarget; if (c.blob.size > 39 * 1048576) return toast('Kayıt 40 MB sınırını aşıyor. Cihaza indirip kısaltabilirsin.');
          b.disabled = true; b.textContent = 'Yükleniyor…';
          try { const up = await uploadFile(new File([c.blob], `karaoke.${ext}`, { type: c.type }), (p) => { b.textContent = `Yükleniyor… %${Math.round(p * 100)}`; }); await api('/posts', { body: { type: 'reel', items: [{ media: up.url, type: 'video' }], caption: `🎤 ${c.song} #karaoke` } }); toast('Performansın Reels’te paylaşıldı 🎉'); close(); } catch (er) { toast(er.message); b.disabled = false; b.innerHTML = `${icon('reels')} Reels’te paylaş`; }
        };
      },
      onClose() { setTimeout(() => URL.revokeObjectURL(url), 1000); },
    });
  }

  // Mikrofon şart, kamera değil
  if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) { slot.innerHTML = '<div class="center-msg">Bu tarayıcı canlı karaokeyi desteklemiyor.</div>'; }
  else {
    const ask = async () => {
      try { mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); paint(); } catch {
        slot.innerHTML = `<div class="center-msg"><div>${icon('mic')}<p>Karaoke için mikrofon izni gerekiyor. Kamera açmak zorunda değilsin.</p><button class="btn primary ks-retry">Mikrofona izin ver</button></div></div>`;
        slot.querySelector('.ks-retry').onclick = ask;
      }
    };
    await ask();
  }
  // Şarkının müziği ve sözleri: katalogdaysa oradan, değilse sözler açık veritabanında aranır
  (async () => {
    if (d.cur.sid) { const s = await api(`/karaoke/songs/${d.cur.sid}`).catch(() => null); if (s && !gone) { S.audio = S.audio || s.audio || ''; S.lyrics = S.lyrics || s.lyrics || ''; S.vox = !!s.vox; } }
    if (!S.lyrics && !gone) { const r = await api(`/karaoke/lyrics?q=${encodeURIComponent(S.title)}`).catch(() => null); if (r?.lyrics && !S.lyrics && !gone) S.lyrics = r.lyrics; }
    if (gone) return;
    if (cast.on) { lv?.set(S.lyrics, { timed: timed() }); root.classList.toggle('nol', !S.lyrics); if (S.audio && !eng.au.src) { eng.au.src = S.audio; eng.setVox(S.vox); } }
    paint(); say();
  })();

  const timer = setInterval(() => {
    const left = Math.max(0, (d.cur?.endsAt || 0) - Date.now()); const lf = root.querySelector('.ks-left');
    if (lf) { lf.textContent = mmss(left / 1000); lf.classList.toggle('low', left < 30000); }
    if (cast.on && eng && S.audio) say();
  }, 4000);
  const fast = setInterval(() => {
    if (!cast.on || !eng) return;
    const a = eng.au; const dur = a.duration || 0;
    lv?.at(pos(), dur, S.audio && !a.paused);
    const tm = root.querySelector('.ks-time'); if (tm) tm.textContent = `${mmss(a.currentTime)}${dur ? ` / ${mmss(dur)}` : ''}`;
    const pr = root.querySelector('.ks-prog i'); if (pr) pr.style.transform = `scaleX(${dur ? Math.min(1, a.currentTime / dur).toFixed(4) : 0})`;
  }, 100);
  root.querySelector('.ks-left').textContent = mmss(((d.cur?.endsAt || 0) - Date.now()) / 1000);

  let pend = null;
  const refresh = async () => { // süre dolduysa ya da sahne başkasına geçtiyse yayını kapat
    try { d = await api('/karaoke'); } catch { return; }
    if (!d.myTurn && !gone) { const was = cast.on; told = true; const clip = was ? stopRec() : null; clip?.then((c) => setTimeout(() => offerClip(c), 800)) /* sayfa değişimi açık pencereleri kapatır: sonra aç */; stopAll(); toast(was ? 'Sahne süren doldu. Teşekkürler!' : 'Sahneye çıkmadığın için sıra bir sonrakine geçti.', { ms: 5000 }); leaveTo('#/karaoke'); }
  };
  const offs = [
    on('karaoke', () => { clearTimeout(pend); pend = setTimeout(refresh, 400); }),
    on('reconnected', refresh),
  ];
  return () => { clearInterval(timer); clearInterval(fast); clearTimeout(pend); const was = cast.on; stopAll(); if (was) done().catch(() => {}); cast.off(); offs.forEach((f) => f()); offChat?.(); };
}

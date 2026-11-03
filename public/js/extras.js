// Profil ekstraları: sesli tanıtım, profil soruları, süper mesaj, profil kartı paylaşımı, buluşma güvenliği.
import { icon } from './icons.js';
import { state, api, esc, toast, sheet, audioRecorder, uploadFile, fmtDur, needCoins, el } from './core.js';

// ---------- Sesli tanıtım ----------
let voiceAudio = null; let voiceBtn = null;
export const voiceChip = (v, cls = '') => (v?.url ? `<button type="button" class="vchip ${cls}" data-src="${esc(v.url)}" aria-label="Sesli tanıtımı dinle"><span class="pi">${icon('play')}</span><span class="wv">${'<i></i>'.repeat(12)}</span><b>${fmtDur(v.dur || 0)}</b></button>` : '');
document.addEventListener('click', (e) => {
  const b = e.target.closest('.vchip');
  if (!b) return;
  e.preventDefault(); e.stopPropagation();
  if (voiceBtn === b && voiceAudio) { if (voiceAudio.paused) voiceAudio.play().catch(() => {}); else voiceAudio.pause(); return; }
  stopVoice();
  voiceAudio = new Audio(b.dataset.src); voiceBtn = b;
  const set = (on) => { b.classList.toggle('on', on); b.querySelector('.pi').innerHTML = icon(on ? 'pause' : 'play'); };
  voiceAudio.onplay = () => set(true); voiceAudio.onpause = () => set(false);
  voiceAudio.onended = () => { set(false); voiceAudio = null; voiceBtn = null; };
  voiceAudio.play().catch(() => toast('Ses oynatılamadı.'));
}, true);
// pointerdown'ı kartın sürüklemesine bırakma
document.addEventListener('pointerdown', (e) => { if (e.target.closest('.vchip')) e.stopPropagation(); }, true);
export function stopVoice() { voiceAudio?.pause(); voiceAudio = null; voiceBtn?.classList.remove('on'); voiceBtn = null; }
window.addEventListener('hashchange', stopVoice);

// Düzenleme ekranındaki kaydedici (en fazla 15 sn)
export function voiceEditor(box, cur, onChange) {
  let voice = cur || null;
  const rec = audioRecorder();
  let tmr = null;
  const paint = (recording) => {
    box.innerHTML = recording
      ? `<div class="vrec on"><button type="button" class="stop" aria-label="Durdur"><i></i></button><div class="grow"><b>Kaydediliyor…</b><div class="vbar"><i></i></div></div><span class="t">0:00</span></div>`
      : voice
        ? `<div class="vrec">${voiceChip(voice)}<div class="grow"></div><button type="button" class="btn sm re">Yeniden kaydet</button><button type="button" class="ib del" aria-label="Sil">${icon('trash')}</button></div>`
        : `<div class="vrec"><button type="button" class="mic" aria-label="Kaydet">${icon('mic')}</button><div class="grow"><b>Sesli tanıtım ekle</b><span class="muted">15 saniyede kendini anlat. Kartında “dinle” düğmesi görünür.</span></div></div>`;
    box.querySelector('.mic, .re')?.addEventListener('click', start);
    box.querySelector('.stop')?.addEventListener('click', () => finish());
    box.querySelector('.del')?.addEventListener('click', () => { voice = null; onChange(null); paint(); });
  };
  async function start() {
    if (!rec.supported) return toast('Bu tarayıcı ses kaydını desteklemiyor.');
    try { await rec.start(); } catch { return toast('Mikrofon izni gerekiyor.'); }
    stopVoice(); paint(true);
    tmr = setInterval(() => {
      const s = rec.elapsed();
      box.querySelector('.t').textContent = fmtDur(s);
      box.querySelector('.vbar i').style.width = `${Math.min(100, (s / 15) * 100)}%`;
      if (s >= 15) finish();
    }, 100);
  }
  async function finish() {
    clearInterval(tmr);
    const out = await rec.stop(false);
    if (!out || out.duration < 2) { toast('Biraz daha uzun konuş (en az 2 sn).'); paint(); return; }
    box.innerHTML = '<div class="vrec"><div class="spinner" style="margin:6px auto"></div></div>';
    try {
      const up = await uploadFile(out.file);
      voice = { url: up.url, dur: Math.min(15, Math.round(out.duration)) };
      onChange(voice);
    } catch (e) { toast(e.message); }
    paint();
  }
  paint();
}

// ---------- Profil soruları ----------
let PROMPTS = null;
export const getPrompts = async () => (PROMPTS ||= await api('/prompts'));
export function promptsEditor(box, cur, onChange) {
  let list = [...(cur || [])];
  const paint = async () => {
    const all = await getPrompts();
    const q = (id) => all.find((p) => p.id === id)?.q || '';
    box.innerHTML = list.map((p, i) => `<div class="pq-e"><div class="grow"><small>${esc(q(p.id))}</small><b>${esc(p.a)}</b></div><button type="button" class="ib ed" data-i="${i}" aria-label="Düzenle">${icon('edit')}</button><button type="button" class="ib rm" data-i="${i}" aria-label="Kaldır">${icon('close')}</button></div>`).join('')
      + (list.length < 3 ? `<button type="button" class="pq-add">${icon('plus')}<span>Soru ekle <small>(${list.length}/3)</small></span></button>` : '');
  };
  const ask = async (idx) => {
    const all = await getPrompts();
    const used = new Set(list.map((p, i) => i !== idx && p.id));
    const curP = idx != null ? list[idx] : null;
    sheet(curP ? 'Cevabını düzenle' : 'Bir soru seç', `<form class="form pq-f">
      <select class="field" name="q">${all.filter((p) => !used.has(p.id)).map((p) => `<option value="${p.id}" ${curP?.id === p.id ? 'selected' : ''}>${esc(p.q)}</option>`).join('')}</select>
      <textarea class="field" name="a" rows="3" maxlength="150" placeholder="Cevabın (en fazla 150 karakter)">${esc(curP?.a || '')}</textarea>
      <button class="btn primary block">Kaydet</button></form>`, {
      onMount(sh, close) {
        const f = sh.querySelector('form');
        setTimeout(() => f.a.focus(), 60);
        f.onsubmit = (e) => {
          e.preventDefault();
          const a = f.a.value.trim();
          if (a.length < 2) return toast('Cevabını yaz.');
          const item = { id: f.q.value, a };
          if (idx != null) list[idx] = item; else list.push(item);
          onChange(list); close(); paint();
        };
      },
    });
  };
  box.onclick = (e) => {
    if (e.target.closest('.pq-add')) return ask(null);
    const b = e.target.closest('[data-i]'); if (!b) return;
    if (b.classList.contains('rm')) { list.splice(+b.dataset.i, 1); onChange(list); paint(); } else ask(+b.dataset.i);
  };
  paint();
}
export const promptCards = (u, { reply } = {}) => (u.prompts || []).map((p) => `<div class="pq" data-pid="${esc(p.id)}"><small>${esc(p.q || '')}</small><p>${esc(p.a)}</p>${reply ? `<button class="pq-r" aria-label="Yanıtla">${icon('comment')}</button>` : ''}</div>`).join('');
export function promptReply(u, pid) {
  const p = (u.prompts || []).find((x) => x.id === pid); if (!p) return;
  sheet(null, `<form class="form pq-rf"><div class="pq"><small>${esc(p.q || '')}</small><p>${esc(p.a)}</p></div>
    <textarea class="field" name="t" rows="3" maxlength="500" placeholder="${esc(u.name.split(' ')[0])} kişisine bu cevapla ilgili yaz…"></textarea>
    <button class="btn primary block">${icon('send')} Gönder</button></form>`, {
    onMount(sh, close) {
      const f = sh.querySelector('form'); setTimeout(() => f.t.focus(), 60);
      f.onsubmit = async (e) => {
        e.preventDefault();
        try { const r = await api(`/users/${u.id}/prompt-reply`, { body: { promptId: pid, text: f.t.value } }); close(); toast('Gönderildi 💬', { href: `#/chat/${r.chatId}` }); } catch (er) { toast(er.message); }
      };
    },
  });
}

// ---------- Süper mesaj ----------
export async function superMessage(u) {
  const st = await api('/store').catch(() => ({}));
  const cost = state.config?.superMsgCoins || 30;
  sheet(null, `<form class="form sm-f"><div class="sm-h"><span>💌</span><div><b>Süper mesaj</b><small>${esc(u.name.split(' ')[0])} eşleşmeden mesajını görür; mesajın öne çıkar ve süper beğeni olarak da sayılır.</small></div></div>
    <textarea class="field" name="t" rows="4" maxlength="500" placeholder="Dikkatini çekecek bir şey yaz…"></textarea>
    <button class="btn primary block">${icon('send')} Gönder · ${cost} jeton</button><p class="muted" style="margin:0;text-align:center;font-size:12.5px">Jetonun: ${st.coins ?? state.me.coins ?? 0}</p></form>`, {
    onMount(sh, close) {
      const f = sh.querySelector('form'); setTimeout(() => f.t.focus(), 60);
      f.onsubmit = async (e) => {
        e.preventDefault();
        try {
          const r = await api(`/users/${u.id}/super-message`, { body: { text: f.t.value } });
          state.me.coins = r.coins; close(); toast('💌 Süper mesajın gönderildi!', { href: `#/chat/${r.chatId}` });
        } catch (er) { if (/jeton/.test(er.message)) { close(); needCoins(er.message); } else toast(er.message); }
      };
    },
  });
}

// ---------- Paylaşılabilir profil kartı (Instagram hikayesi 1080×1920) ----------
const loadImg = (src) => new Promise((res) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
function wrap(ctx, text, x, y, maxW, lh, maxLines) {
  const words = String(text || '').split(/\s+/); let line = ''; let n = 0;
  for (let i = 0; i < words.length; i++) {
    const t = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(t).width > maxW && line) {
      n++; if (n >= maxLines) { ctx.fillText(`${line}…`, x, y); return y + lh; }
      ctx.fillText(line, x, y); y += lh; line = words[i];
    } else line = t;
  }
  if (line) { ctx.fillText(line, x, y); y += lh; }
  return y;
}
export async function profileCard(u) {
  const W = 1080; const H = 1920;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  await document.fonts?.ready;
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#ff8a3d'); g.addColorStop(0.5, '#ff3d6e'); g.addColorStop(1, '#7c3aed');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // yumuşak ışıklar
  [[180, 260, 420, 'rgba(255,255,255,.18)'], [940, 1500, 520, 'rgba(255,255,255,.12)']].forEach(([cx, cy, r, col]) => { const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = rg; x.fillRect(0, 0, W, H); });
  // kart
  const cx = 90; const cy = 300; const cw = W - 180; const ch = 1240;
  x.fillStyle = 'rgba(255,255,255,.96)'; x.beginPath(); x.roundRect(cx, cy, cw, ch, 64); x.fill();
  const photo = await loadImg((u.photos || [])[0] || u.avatar);
  const pw = cw - 80; const ph = 720;
  x.save(); x.beginPath(); x.roundRect(cx + 40, cy + 40, pw, ph, 44); x.clip();
  if (photo) { const s = Math.max(pw / photo.width, ph / photo.height); x.drawImage(photo, cx + 40 + (pw - photo.width * s) / 2, cy + 40 + (ph - photo.height * s) / 2, photo.width * s, photo.height * s); } else { x.fillStyle = '#eee'; x.fillRect(cx + 40, cy + 40, pw, ph); }
  const sh = x.createLinearGradient(0, cy + 40 + ph - 260, 0, cy + 40 + ph); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.6)');
  x.fillStyle = sh; x.fillRect(cx + 40, cy + 40, pw, ph);
  x.restore();
  x.fillStyle = '#fff'; x.font = '800 76px "Bricolage Grotesque", Inter, sans-serif';
  x.fillText(`${u.name.split(' ')[0]}${u.age ? `, ${u.age}` : ''}${u.verified ? ' ✓' : ''}`, cx + 80, cy + 40 + ph - 70);
  if (u.city) { x.font = '600 38px Inter, sans-serif'; x.fillStyle = 'rgba(255,255,255,.9)'; x.fillText(`📍 ${u.city}`, cx + 82, cy + 40 + ph - 20); }
  let y = cy + 40 + ph + 80;
  x.fillStyle = '#2a1630';
  const pr = (u.prompts || [])[0];
  if (pr) {
    x.font = '700 32px Inter, sans-serif'; x.fillStyle = '#e7358b'; x.fillText(pr.q || '', cx + 60, y); y += 56;
    x.font = '700 46px "Bricolage Grotesque", Inter, sans-serif'; x.fillStyle = '#2a1630'; y = wrap(x, pr.a, cx + 60, y, cw - 120, 58, 3);
  } else if (u.bio) { x.font = '600 42px Inter, sans-serif'; y = wrap(x, u.bio, cx + 60, y, cw - 120, 56, 4); }
  y += 20;
  x.font = '700 32px Inter, sans-serif'; let ix = cx + 60;
  (u.interests || []).slice(0, 4).forEach((t) => { const w = x.measureText(t).width + 48; if (ix + w > cx + cw - 60) return; x.fillStyle = '#f5e9f1'; x.beginPath(); x.roundRect(ix, y - 40, w, 60, 30); x.fill(); x.fillStyle = '#7a3a6a'; x.fillText(t, ix + 24, y); ix += w + 14; });
  // logo ve bağlantı
  const logo = await loadImg('/icons/icon-192.png');
  if (logo) x.drawImage(logo, W / 2 - 170, 140, 96, 96);
  x.fillStyle = '#fff'; x.font = '800 74px "Bricolage Grotesque", Inter, sans-serif'; x.fillText('swipeup', W / 2 - 54, 214);
  x.textAlign = 'center'; x.font = '800 54px "Bricolage Grotesque", Inter, sans-serif'; x.fillText('Benimle SwipeUp’ta tanış 💘', W / 2, 1680);
  x.font = '600 38px Inter, sans-serif'; x.fillStyle = 'rgba(255,255,255,.92)'; x.fillText(`${location.host}/#/u/${u.username}`, W / 2, 1750);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const file = new File([blob], `swipeup-${u.username}.png`, { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  sheet('Profil kartın', `<div class="pcard"><img src="${url}" alt="Profil kartı"><div class="two" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <button class="btn outline dl">${icon('download')} Kaydet</button><button class="btn primary sh">${icon('share')} Paylaş</button></div>
    <p class="muted" style="margin:0;font-size:12.5px;text-align:center">Instagram hikayene ekle; bağlantı profiline açılır.</p></div>`, {
    onMount(shEl) {
      shEl.querySelector('.dl').onclick = () => { const a = document.createElement('a'); a.href = url; a.download = file.name; document.body.append(a); a.click(); a.remove(); };
      shEl.querySelector('.sh').onclick = async () => {
        try {
          if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'SwipeUp profilim', text: `${location.origin}/#/u/${u.username}` });
          else if (navigator.share) await navigator.share({ title: 'SwipeUp profilim', url: `${location.origin}/#/u/${u.username}` });
          else shEl.querySelector('.dl').click();
        } catch {}
      };
    },
  });
}

// ---------- Buluşma sonrası "iyi misin?" ----------
export async function checkSafety() {
  const list = await api('/safety/pending').catch(() => []);
  const s = list.find((x) => x.when < Date.now());
  if (!s || document.querySelector('.sheet')) return;
  sheet(null, `<div class="sf-ask"><span>💛</span><h3>Buluşman nasıl geçti?</h3><p class="muted">${esc(s.with?.name || '')} ile ${esc(s.place)} buluşmanı arkadaşınla paylaşmıştın. İyi olduğunu bildirelim mi?</p>
    <button class="btn primary block ok">İyiyim, haber ver</button><button class="btn block later">Daha sonra</button></div>`, {
    onMount(sh, close) {
      sh.querySelector('.ok').onclick = async () => { try { await api(`/safety/${s.id}/ok`, { body: {} }); close(); toast('Arkadaşına iyi olduğunu bildirdik 💛'); } catch (e) { toast(e.message); } };
      sh.querySelector('.later').onclick = close;
    },
  });
}

// Davet kodunu bağlantıdan yakala (?ref=KOD)
try { const r = new URLSearchParams(location.search).get('ref'); if (r) localStorage.setItem('su_ref', r.toUpperCase()); } catch {}
export const pendingRef = () => { try { return localStorage.getItem('su_ref') || ''; } catch { return ''; } };
export { el };

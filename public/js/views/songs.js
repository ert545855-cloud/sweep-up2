// Şarkı yarışması: 3 ayda bir. Başvuru → oylama → kazanan şarkı Spotify'da yayınlanır.
import { icon } from '../icons.js';
import { api, esc, toast, avatar, nm, sheet, pickFile, uploadFile, compressImage, fmtDur, fileType, state } from '../core.js';

const back = (to) => `<a class="ib" href="${to}" aria-label="Geri">${icon('back')}</a>`;
const COVER = '/img/songs/cassette.svg';
const ST = { pending: ['wait', 'İnceleniyor'], approved: ['ok', 'Yarışmada'], rejected: ['bad', 'Alınamadı'] };
const dt = (t) => new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
const left = (t) => {
  const ms = Math.max(0, t - Date.now()); const d = Math.floor(ms / 86400000); const h = Math.floor((ms % 86400000) / 3600000);
  return d ? `${d} gün ${h} saat` : `${h} saat ${Math.floor((ms % 3600000) / 60000)} dakika`;
};

export default async function songs(view, sub) {
  if (sub === 'yukle') return uploadForm(view);
  view.innerHTML = `<header class="topbar">${back('#/')}<div class="center">Şarkı yarışması</div><span class="ib"></span></header><div class="sg"><div class="spinner"></div></div>`;
  const box = view.querySelector('.sg');
  const audio = new Audio(); audio.preload = 'none';
  let d; let playing = null; let counted = new Set();

  const load = async () => { d = await api('/songs'); paint(); };

  const timeline = (c) => {
    const steps = [['submit', 'Başvuru', `${dt(c.submitStart)} – ${dt(c.submitEnd)}`], ['vote', 'Oylama', `${dt(c.submitEnd)} – ${dt(c.voteEnd)}`], ['ended', 'Sonuç', `${dt(c.voteEnd)}`]];
    const order = ['soon', 'submit', 'vote', 'ended'];
    const cur = order.indexOf(c.phase);
    return `<ol class="sg-tl">${steps.map(([k, l, when]) => { const i = order.indexOf(k); return `<li class="${i < cur ? 'done' : i === cur ? 'now' : ''}"><i></i><b>${l}</b><small>${when}</small></li>`; }).join('')}</ol>`;
  };
  const countdown = (c) => (c.phase === 'soon' ? `Başvurular <b>${left(c.submitStart)}</b> sonra açılıyor`
    : c.phase === 'submit' ? `Başvurular <b>${left(c.submitEnd)}</b> sonra kapanıyor`
      : c.phase === 'vote' ? `Oylama <b>${left(c.voteEnd)}</b> sonra bitiyor`
        : c.phase === 'ended' ? 'Yarışma sonuçlandı' : 'Yarışma iptal edildi');

  const card = (s) => `<article class="sg-card ${s.winner ? 'win' : ''} ${playing === s.id ? 'on' : ''}" data-id="${esc(s.id)}">
      <button class="sg-cov" aria-label="${playing === s.id && !audio.paused ? 'Durdur' : 'Dinle'}"><img src="${esc(s.cover || COVER)}" alt="" loading="lazy"><span class="sg-pp">${icon(playing === s.id && !audio.paused ? 'pause' : 'play')}</span>${s.rank ? `<span class="sg-rank r${s.rank}">${s.rank}</span>` : ''}</button>
      <div class="sg-mid">
        <button class="sg-ti">${esc(s.title)}${s.explicit ? '<span class="sg-e" title="Açık içerik">E</span>' : ''}</button>
        <div class="sg-ar">${esc(s.artist)}${s.feat ? ` <span class="muted">ft. ${esc(s.feat)}</span>` : ''}</div>
        <div class="sg-meta">${esc(s.genre)} · ${s.duration ? fmtDur(s.duration) : esc(s.language)}${s.votes != null ? ` · <b>${s.votes}</b> oy` : ''}</div>
        <div class="sg-prog"><i style="width:${playing === s.id && audio.duration ? (audio.currentTime / audio.duration) * 100 : 0}%"></i></div>
      </div>
      ${d.contest.phase === 'vote' && !s.mine ? `<button class="sg-vote ${s.voted ? 'on' : ''}" aria-pressed="${s.voted}">${icon(s.voted ? 'check' : 'vote')}<span>${s.voted ? 'Oy verdin' : 'Oy ver'}</span></button>`
        : s.winner ? `<span class="sg-crown"><img src="/img/songs/trophy.svg" alt="Kazanan"></span>` : ''}
    </article>`;

  function paint() {
    const c = d.contest;
    if (!c) {
      box.innerHTML = `<section class="sg-hero"><img class="sg-art" src="/img/songs/hero.svg" alt=""><div class="sg-hb"><h1>Şarkı yarışması</h1><p>Yeni sezon yakında başlıyor. Şarkını hazırla!</p></div></section>${winnersHtml()}`;
      return;
    }
    const votesLeft = d.rules.votesPerUser - d.myVotes.length;
    const canSubmit = c.phase === 'submit' && d.mine.filter((s) => ['pending', 'approved'].includes(s.status)).length < d.rules.maxPerUser;
    box.innerHTML = `<section class="sg-hero"><img class="sg-art" src="/img/songs/hero.svg" alt="">
        <div class="sg-hb"><span class="sg-ph ${c.phase}">${esc(c.phaseLabel)}</span><h1>${esc(c.title)}</h1><p>${esc(c.desc)}</p>
        <div class="sg-cd">${icon('timer')}<span>${countdown(c)}</span></div></div></section>
      ${timeline(c)}
      <div class="sg-prize"><img src="/img/songs/trophy.svg" alt=""><div class="grow"><b>Ödül</b><small>${esc(c.prize || 'Kazanan şarkı SwipeUp tarafından Spotify’da yayınlanır.')}</small></div></div>
      ${canSubmit ? `<a class="btn primary block sg-cta" href="#/sarki/yukle">${icon('upload')} Şarkını yükle</a>` : ''}
      ${c.phase === 'vote' ? `<div class="sg-votes">${Array.from({ length: d.rules.votesPerUser }, (_, i) => `<i class="${i < d.myVotes.length ? 'on' : ''}"></i>`).join('')}<span>${votesLeft ? `<b>${votesLeft}</b> oy hakkın kaldı` : 'Bütün oy haklarını kullandın; değiştirmek için bir oyunu geri alabilirsin'}</span></div>` : ''}
      ${d.mine.length ? `<h3 class="shop-h">Şarkıların</h3><div class="sg-mine">${d.mine.map((s) => `<div class="sg-my"><img src="${esc(s.cover || COVER)}" alt=""><div class="grow"><b>${esc(s.title)}</b><small>${esc(s.artist)}${s.status === 'rejected' && s.reason ? ` · ${esc(s.reason)}` : ''}</small></div><span class="pill ${ST[s.status]?.[0] || ''}">${ST[s.status]?.[1] || ''}</span>${c.phase === 'submit' || s.status !== 'approved' ? `<button class="ib sg-wd" data-id="${esc(s.id)}" aria-label="Geri çek">${icon('trash')}</button>` : ''}</div>`).join('')}</div>` : ''}
      ${d.songs.length ? `<h3 class="shop-h">${c.phase === 'ended' ? 'Sonuçlar' : 'Yarışan şarkılar'} <small class="muted">${d.songs.length}</small></h3><div class="sg-list">${d.songs.map(card).join('')}</div>`
        : `<div class="sg-empty"><img src="/img/songs/cassette.svg" alt=""><p>${c.phase === 'submit' || c.phase === 'soon' ? 'Henüz yarışmaya alınan şarkı yok. İlk sen ol!' : 'Bu sezonda yarışan şarkı yok.'}</p></div>`}
      ${c.phase === 'ended' && c.release?.spotifyUrl ? `<a class="btn block sg-spot" href="${esc(c.release.spotifyUrl)}" target="_blank" rel="noopener">${icon('music')} Kazanan şarkıyı Spotify’da dinle</a>` : c.phase === 'ended' && c.winnerId ? `<div class="sg-rel">${icon('disc')}<span>Kazanan şarkı: <b>${esc(c.release?.label || 'Yayına hazırlanıyor')}</b></span></div>` : ''}
      ${winnersHtml(c.id)}
      <details class="sg-rules"><summary>Nasıl işler?</summary><ol>
        <li>Yarışma 3 ayda bir yapılır. İlk iki ay başvuru, son ay oylama dönemidir.</li>
        <li>Her kullanıcı bir sezonda en fazla <b>${d.rules.maxPerUser}</b> şarkı gönderebilir; şarkılar ekibimizce incelendikten sonra yarışmaya alınır.</li>
        <li>Oylamada herkesin <b>${d.rules.votesPerUser}</b> oy hakkı vardır; kendi şarkına oy veremezsin. Oyunu oylama bitene kadar geri alıp başka şarkıya verebilirsin.</li>
        <li>En çok oyu alan şarkıyı SwipeUp olarak Spotify’da yayınlarız. Yayın için kazananla iletişime geçeriz.</li>
        <li>Şarkının sözü, müziği ve kaydı sana (ya da izin aldığın kişilere) ait olmalıdır. Başkasına ait şarkılar yarışmadan çıkarılır.</li>
      </ol></details><div style="height:30px"></div>`;
  }
  function winnersHtml(skip) {
    const w = (d.winners || []).filter((x) => x.contest.id !== skip);
    if (!w.length) return '';
    return `<h3 class="shop-h">Geçmiş kazananlar</h3><div class="sg-hall">${w.map((x) => `<div class="sg-hw"><img src="${esc(x.song.cover || COVER)}" alt=""><div class="grow"><b>${esc(x.song.title)}</b><small>${esc(x.song.artist)} · ${esc(x.contest.title)}</small></div>${x.contest.release.spotifyUrl ? `<a class="btn sm" href="${esc(x.contest.release.spotifyUrl)}" target="_blank" rel="noopener">Spotify</a>` : `<span class="pill">${esc(x.contest.release.label)}</span>`}</div>`).join('')}</div>`;
  }

  const songById = (id) => d.songs.find((s) => s.id === id) || d.winners?.find((x) => x.song.id === id)?.song;
  const repaintCard = (id) => { const el = box.querySelector(`.sg-card[data-id="${CSS.escape(id)}"]`); const s = songById(id); if (el && s) el.outerHTML = card(s); };
  function play(id) {
    const s = songById(id); if (!s) return;
    if (playing === id) { if (audio.paused) audio.play().catch(() => {}); else audio.pause(); return; }
    const prev = playing; playing = id;
    audio.src = s.audio; audio.play().catch((e) => toast('Şarkı çalınamadı: ' + e.message));
    if (prev) repaintCard(prev);
    repaintCard(id);
  }
  const syncBtn = () => { if (playing) repaintCard(playing); };
  audio.onplay = syncBtn; audio.onpause = syncBtn;
  audio.onended = () => { const p = playing; playing = null; if (p) repaintCard(p); };
  audio.ontimeupdate = () => {
    const el = box.querySelector(`.sg-card[data-id="${CSS.escape(playing || '')}"] .sg-prog i`);
    if (el && audio.duration) el.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
    if (playing && audio.currentTime > 10 && !counted.has(playing)) { counted.add(playing); api(`/songs/${playing}/play`, { body: {} }).catch(() => {}); }
  };

  function details(s) {
    const cr = [['Besteci', s.composer], ['Söz yazarı', s.lyricist], ['Prodüktör / aranjör', s.producer], ['Tür', s.genre], ['Dil', s.language]].filter(([, v]) => v && v !== '-');
    sheet(s.title, `<div class="sg-det"><img class="sg-dc" src="${esc(s.cover || COVER)}" alt=""><div class="sg-da"><b>${esc(s.artist)}${s.feat ? ` ft. ${esc(s.feat)}` : ''}</b>
        <a class="sg-du" href="#/u/${esc(s.user?.username)}">${avatar(s.user, 26, { dot: false })}<span>${nm(s.user, 'username')}</span></a></div>
      <dl class="sg-cr">${cr.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      ${s.about ? `<p class="sg-ab">${esc(s.about)}</p>` : ''}<div class="sg-ly"><div class="spinner sm"></div></div></div>`, {
      onMount: async (root) => {
        const ly = root.querySelector('.sg-ly');
        try { const full = await api(`/songs/${s.id}`); ly.innerHTML = full.lyrics ? `<h4>Şarkı sözleri</h4><pre>${esc(full.lyrics)}</pre>` : ''; } catch { ly.innerHTML = ''; }
      },
    });
  }

  box.addEventListener('click', async (e) => {
    const cardEl = e.target.closest('.sg-card'); const id = cardEl?.dataset.id;
    if (e.target.closest('.sg-cov')) return play(id);
    if (e.target.closest('.sg-prog') && playing === id && audio.duration) { const r = e.target.closest('.sg-prog').getBoundingClientRect(); audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration; return; }
    if (e.target.closest('.sg-ti')) return details(songById(id));
    const vb = e.target.closest('.sg-vote');
    if (vb) {
      const s = songById(id); vb.disabled = true;
      try {
        const r = await api(`/songs/${id}/vote`, s.voted ? { method: 'DELETE' } : { body: {} });
        s.voted = r.voted; if (r.votes != null) s.votes = r.votes;
        d.myVotes = s.voted ? [...new Set([...d.myVotes, id])] : d.myVotes.filter((x) => x !== id);
        navigator.vibrate?.(12);
        const y = window.scrollY; paint(); window.scrollTo(0, y);
      } catch (er) { toast(er.message); vb.disabled = false; }
      return;
    }
    const wd = e.target.closest('.sg-wd');
    if (wd && confirm('Şarkını yarışmadan geri çekmek istiyor musun?')) {
      try { await api(`/songs/${wd.dataset.id}`, { method: 'DELETE' }); toast('Şarkın geri çekildi.'); load(); } catch (er) { toast(er.message); }
    }
  });

  await load();
  const tickT = setInterval(() => { const cd = box.querySelector('.sg-cd span'); if (cd && d.contest) cd.innerHTML = countdown(d.contest); }, 60000);
  return () => { clearInterval(tickT); audio.pause(); audio.src = ''; };
}

// ---------- Şarkı yükleme formu ----------
async function uploadForm(view) {
  view.innerHTML = `<header class="topbar">${back('#/sarki')}<div class="center">Şarkını yükle</div><span class="ib"></span></header><form class="form sg-f"><div class="spinner"></div></form>`;
  const f = view.querySelector('form');
  const d = await api('/songs');
  const c = d.contest;
  if (!c || c.phase !== 'submit') { f.innerHTML = '<div class="empty">Şu an başvuru kabul edilmiyor.</div>'; return; }
  let audioUrl = null; let duration = 0; let cover = null; let upP = null;
  const opts = (list, sel) => list.map((x) => `<option ${x === sel ? 'selected' : ''}>${esc(x)}</option>`).join('');
  f.innerHTML = `<div class="sg-fh"><img src="/img/songs/hero.svg" alt=""><div><b>${esc(c.title)}</b><small>Başvurular ${dt(c.submitEnd)} tarihinde kapanıyor</small></div></div>
    <fieldset class="sg-fs"><legend>Şarkı dosyası</legend>
      <button type="button" class="sg-drop"><span class="sg-di">${icon('upload')}</span><span class="grow"><b class="sg-fn">Ses dosyasını seç</b><small class="sg-fi">MP3, M4A ya da WAV · en fazla ${d.rules.maxMB} MB · 30 sn – 10 dk</small></span></button>
      <div class="sg-up" hidden><i></i></div>
      <div class="sg-cvr"><button type="button" class="sg-cb"><img src="${COVER}" alt=""><span>${icon('image')} Kapak</span></button><small class="muted">İsteğe bağlı. Kare (1:1) bir görsel seç; Spotify yayınında da kullanılabilir.</small></div>
    </fieldset>
    <fieldset class="sg-fs"><legend>Şarkı bilgileri</legend>
      <label>Şarkı adı<input class="field" name="title" maxlength="80" required placeholder="Şarkının adı"></label>
      <label>Sanatçı adı<input class="field" name="artist" maxlength="60" required value="${esc(state.me?.name || '')}" placeholder="Spotify’da bu adla görünür"></label>
      <label><span>Düet / konuk sanatçı <small class="muted" style="font-weight:500">(isteğe bağlı)</small></span><input class="field" name="feat" maxlength="80" placeholder="ör. Deniz Ay"></label>
      <div class="sg-2"><label>Tür<select class="field" name="genre">${opts(d.genres, 'Pop')}</select></label><label>Dil<select class="field" name="language">${opts(d.langs, 'Türkçe')}</select></label></div>
      <label class="sg-ck"><input type="checkbox" name="explicit"><span>Sözlerde küfür ya da açık içerik var</span></label>
    </fieldset>
    <fieldset class="sg-fs"><legend>Emeği geçenler</legend>
      <label>Besteci<input class="field" name="composer" maxlength="120" required placeholder="Müziği yapan kişi(ler)"></label>
      <label>Söz yazarı<input class="field" name="lyricist" maxlength="120" placeholder="Sözleri yazan kişi(ler) · enstrümantalse “-”"></label>
      <label><span>Prodüktör / aranjör <small class="muted" style="font-weight:500">(isteğe bağlı)</small></span><input class="field" name="producer" maxlength="120"></label>
    </fieldset>
    <fieldset class="sg-fs"><legend>Şarkı hakkında</legend>
      <label><span>Kısa açıklama <small class="muted" style="font-weight:500">(isteğe bağlı)</small></span><textarea class="field" name="about" rows="3" maxlength="500" placeholder="Şarkının hikayesi, ne anlatıyor?"></textarea></label>
      <label><span>Şarkı sözleri <small class="muted" style="font-weight:500">(isteğe bağlı)</small></span><textarea class="field" name="lyrics" rows="6" maxlength="6000"></textarea></label>
    </fieldset>
    <fieldset class="sg-fs"><legend>Yayın için iletişim</legend>
      <p class="muted sg-note">${icon('lock')} Bu bilgiler herkese gösterilmez; sadece kazanırsan Spotify yayını ve sözleşme için kullanılır.</p>
      <label>Adın ve soyadın<input class="field" name="legalName" maxlength="80" required autocomplete="name"></label>
      <label>E-posta ya da telefon<input class="field" name="contact" maxlength="120" required placeholder="ornek@mail.com"></label>
    </fieldset>
    <label class="sg-ck sg-rights"><input type="checkbox" name="rightsOk" required><span>Bu şarkının sözü, müziği ve kaydı bana (ya da izin aldığım kişilere) ait. Kazanırsam SwipeUp’ın şarkıyı Spotify ve diğer müzik platformlarında yayınlamasına izin veriyorum.</span></label>
    <button class="btn primary block sg-send">Yarışmaya gönder</button>`;

  const fn = f.querySelector('.sg-fn'); const fi = f.querySelector('.sg-fi'); const bar = f.querySelector('.sg-up'); const drop = f.querySelector('.sg-drop');
  drop.onclick = async () => {
    const file = await pickFile('audio/*,.mp3,.m4a,.wav'); if (!file) return;
    const type = fileType(file);
    if (!type.startsWith('audio/') && !/\.(mp3|m4a|wav|aac|flac|ogg)$/i.test(file.name)) return toast('Bir ses dosyası seç (MP3, M4A, WAV).');
    if (file.size > d.rules.maxMB * 1024 * 1024) return toast(`Dosya en fazla ${d.rules.maxMB} MB olabilir.`);
    duration = await new Promise((res) => { const a = new Audio(); a.preload = 'metadata'; a.onloadedmetadata = () => res(Math.round(a.duration) || 0); a.onerror = () => res(0); a.src = URL.createObjectURL(file); setTimeout(() => res(0), 8000); });
    if (duration && duration < 30) return toast('Şarkı en az 30 saniye olmalı.');
    if (duration > 600) return toast('Şarkı en fazla 10 dakika olabilir.');
    audioUrl = null; drop.classList.remove('ok');
    fn.textContent = file.name; fi.textContent = `${(file.size / 1048576).toFixed(1)} MB${duration ? ' · ' + fmtDur(duration) : ''} · yükleniyor…`;
    bar.hidden = false; bar.firstElementChild.style.width = '0%';
    if (!f.title.value) f.title.value = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 80);
    upP = uploadFile(file, (p) => { bar.firstElementChild.style.width = `${Math.round(p * 100)}%`; })
      .then((r) => { audioUrl = r.url; drop.classList.add('ok'); fi.textContent = `${(file.size / 1048576).toFixed(1)} MB${duration ? ' · ' + fmtDur(duration) : ''} · yüklendi`; bar.hidden = true; })
      .catch((e) => { toast(e.message); fn.textContent = 'Ses dosyasını seç'; fi.textContent = 'Yükleme başarısız, tekrar dene.'; bar.hidden = true; })
      .finally(() => { upP = null; });
  };
  f.querySelector('.sg-cb').onclick = async () => {
    const file = await pickFile('image/*'); if (!file) return;
    const img = f.querySelector('.sg-cb img'); img.style.opacity = '.4';
    try { cover = (await uploadFile(await compressImage(file, 1200))).url; img.src = cover; } catch (e) { toast(e.message); }
    img.style.opacity = '';
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const btn = f.querySelector('.sg-send');
    if (upP) { btn.disabled = true; btn.textContent = 'Dosya yükleniyor…'; await upP; btn.textContent = 'Yarışmaya gönder'; btn.disabled = false; }
    if (!audioUrl) return toast('Önce şarkı dosyasını yükle.');
    btn.disabled = true;
    const v = (k) => f[k].value;
    try {
      await api('/songs', { body: { title: v('title'), artist: v('artist'), feat: v('feat'), genre: v('genre'), language: v('language'), explicit: f.explicit.checked, composer: v('composer'), lyricist: v('lyricist'), producer: v('producer'), about: v('about'), lyrics: v('lyrics'), legalName: v('legalName'), contact: v('contact'), rightsOk: f.rightsOk.checked, audio: audioUrl, cover, duration } });
      toast('Şarkın alındı! İncelendikten sonra yarışmaya eklenecek.');
      location.hash = '#/sarki';
    } catch (er) { toast(er.message); btn.disabled = false; }
  };
}

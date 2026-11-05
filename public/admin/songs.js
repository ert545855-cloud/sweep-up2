// Şarkı yarışması — yönetim paneli modülü
export default async function songsAdmin(main, H) {
  const { api, esc, toast, head, d, dt, icon, userCell, can, token } = H;
  const may = can('songs');
  const COVER = '/img/songs/cassette.svg';
  const PH = { soon: ['', 'Yakında'], submit: ['info', 'Başvuru'], vote: ['warn', 'Oylama'], ended: ['ok', 'Sonuçlandı'], cancelled: ['bad', 'İptal'] };
  const SST = { pending: ['warn', 'Bekliyor'], approved: ['ok', 'Onaylı'], rejected: ['bad', 'Reddedildi'] };
  const fmtDur = (s) => (s ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '—');
  const mb = (n) => (n ? `${(n / 1048576).toFixed(1)} MB` : '');
  // datetime-local <-> zaman damgası (tarayıcı saatine göre)
  const toLocal = (t) => { if (!t) return ''; const x = new Date(t); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  const fromLocal = (v) => (v ? new Date(v).getTime() : null);

  const modal = (title, html, onMount) => {
    const bg = document.createElement('div'); bg.className = 'drawer-bg';
    const dr = document.createElement('aside'); dr.className = 'drawer sgd';
    dr.innerHTML = `<div class="dh"><h2 class="grow">${title}</h2><button class="btn sm x">${icon('close')}</button></div><div class="db">${html}</div>`;
    const close = () => { dr.querySelectorAll('audio').forEach((a) => a.pause()); bg.remove(); dr.remove(); };
    bg.onclick = close; dr.querySelector('.x').onclick = close;
    document.body.append(bg, dr); onMount?.(dr, close); return close;
  };
  const upload = (file, onProgress) => new Promise((resolve, reject) => {
    const fd = new FormData(); fd.append('file', file);
    const x = new XMLHttpRequest(); x.open('POST', '/api/admin/songs/upload'); x.setRequestHeader('Authorization', 'Bearer ' + token());
    x.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    x.onload = () => { let r = {}; try { r = JSON.parse(x.responseText); } catch {} x.status < 300 ? resolve(r) : reject(new Error(r.error || 'Yükleme başarısız.')); };
    x.onerror = () => reject(new Error('Bağlantı hatası.')); x.send(fd);
  });
  const pick = (accept) => new Promise((res) => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = () => res(i.files[0] || null); i.click(); });

  const all = await api('/songs');
  let sel = (location.hash.split('/')[2]) || all.contests.find((c) => ['submit', 'vote', 'soon'].includes(c.phase))?.id || all.contests[0]?.id;
  const rerender = () => songsAdmin(main, H);

  main.innerHTML = `${head('Şarkı yarışması', 'Her 3 ayda bir yeni sezon otomatik açılır: ilk iki ay başvuru, son ay oylama. En çok oy alan şarkıyı Spotify’da yayınlayıp linkini buraya girersin; kazanan ve kullanıcılar bilgilendirilir.', may ? `<div class="row" style="gap:6px"><button class="btn sm newc">${icon('plus')} Yeni yarışma</button>${sel ? `<button class="btn primary sm adds">${icon('upload')} Şarkı ekle</button>` : ''}</div>` : '')}
    ${all.contests.length ? `<div class="tabs sgt">${all.contests.map((c) => `<a href="#/songs/${esc(c.id)}" class="${c.id === sel ? 'on' : ''}">${esc(c.title)} <span class="chip ${PH[c.phase][0]}">${PH[c.phase][1]}</span>${c.counts.pending ? ` <span class="badge">${c.counts.pending}</span>` : ''}</a>`).join('')}</div>` : `<div class="panel"><div class="empty">Henüz yarışma yok. ${all.settings.auto ? 'Otomatik sezon açık; birkaç dakika içinde bu çeyreğin yarışması oluşur.' : '“Yeni yarışma” ile oluştur.'}</div></div>`}
    <div class="sgbody"></div>
    <form class="panel sgset" style="margin-top:16px"><div class="ph"><h3>Yarışma ayarları</h3></div><div class="pb sgsg">
      <label class="row"><input type="checkbox" name="auto" ${all.settings.auto ? 'checked' : ''} ${may ? '' : 'disabled'}> Her çeyrekte yarışmayı otomatik aç</label>
      <label class="row"><input type="checkbox" name="announce" ${all.settings.announce ? 'checked' : ''} ${may ? '' : 'disabled'}> Başvuru ve oylama başlayınca herkese bildirim gönder</label>
      <label class="row"><input type="checkbox" name="showVotes" ${all.settings.showVotes ? 'checked' : ''} ${may ? '' : 'disabled'}> Oylama sırasında oy sayılarını kullanıcılara göster</label>
      <div class="sg4">${[['votesPerUser', 'Kişi başı oy hakkı'], ['maxPerUser', 'Kişi başı şarkı'], ['maxMB', 'Dosya sınırı (MB)'], ['minAccountDays', 'Oy için hesap yaşı (gün)']].map(([k, l]) => `<label>${l}<input class="field" type="number" name="${k}" value="${all.settings[k]}" ${may ? '' : 'disabled'}></label>`).join('')}</div>
      ${may ? `<div><button class="btn primary sm">${icon('check')} Ayarları kaydet</button></div>` : ''}
      <div class="muted" style="font-size:12px">Sıradaki sezon: <b>${esc(all.next.title)}</b> · başvuru ${d(all.next.submitStart)} – ${d(all.next.submitEnd)} · oylama ${d(all.next.voteEnd)} tarihine kadar.</div></div></form>`;

  main.querySelector('.sgset').onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    try { await api('/songs/settings', { method: 'PUT', body: { auto: f.auto.checked, announce: f.announce.checked, showVotes: f.showVotes.checked, votesPerUser: f.votesPerUser.value, maxPerUser: f.maxPerUser.value, maxMB: f.maxMB.value, minAccountDays: f.minAccountDays.value } }); toast('Ayarlar kaydedildi.'); rerender(); } catch (er) { toast(er.message); }
  };
  main.querySelector('.newc')?.addEventListener('click', () => contestForm(null));
  main.querySelector('.adds')?.addEventListener('click', () => addSong(sel));

  function contestForm(c) {
    const v = c || { title: all.next.title, season: all.next.season, desc: 'Kendi şarkını yükle, topluluk oylasın. En çok oyu alan şarkıyı SwipeUp olarak Spotify’da yayınlıyoruz!', prize: 'Kazanan şarkı SwipeUp tarafından Spotify’da yayınlanır.', submitStart: all.next.submitStart, submitEnd: all.next.submitEnd, voteEnd: all.next.voteEnd };
    modal(c ? 'Yarışmayı düzenle' : 'Yeni yarışma', `<form class="sgform">
      <label>Yarışma adı<input class="field" name="title" maxlength="80" value="${esc(v.title)}"></label>
      ${c ? '' : `<label>Sezon kodu<input class="field" name="season" maxlength="20" value="${esc(v.season)}"><small class="muted">Aynı sezona ikinci yarışma açılamaz. Özel yarışma için boş bırak.</small></label>`}
      <label>Açıklama<textarea class="field" name="desc" rows="3" maxlength="600">${esc(v.desc)}</textarea></label>
      <label>Ödül<input class="field" name="prize" maxlength="160" value="${esc(v.prize)}"></label>
      <div class="sg3"><label>Başvuru başlangıcı<input class="field" type="datetime-local" name="submitStart" value="${toLocal(v.submitStart)}"></label><label>Başvuru bitişi / oylama başlangıcı<input class="field" type="datetime-local" name="submitEnd" value="${toLocal(v.submitEnd)}"></label><label>Oylama bitişi<input class="field" type="datetime-local" name="voteEnd" value="${toLocal(v.voteEnd)}"></label></div>
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary">${icon('check')} Kaydet</button>${c && c.status !== 'cancelled' ? '<button type="button" class="btn danger cnl">Yarışmayı iptal et</button>' : ''}${c && c.status === 'cancelled' ? '<button type="button" class="btn act">Yeniden etkinleştir</button>' : ''}${c && !c.counts.total ? '<button type="button" class="btn danger del">Sil</button>' : ''}</div></form>`, (dr, close) => {
      const f = dr.querySelector('form');
      const body = () => ({ title: f.title.value, season: f.season?.value, desc: f.desc.value, prize: f.prize.value, submitStart: fromLocal(f.submitStart.value), submitEnd: fromLocal(f.submitEnd.value), voteEnd: fromLocal(f.voteEnd.value) });
      f.onsubmit = async (e) => {
        e.preventDefault();
        try { const r = c ? await api(`/songs/contests/${c.id}`, { method: 'PUT', body: body() }) : await api('/songs/contests', { body: body() }); toast('Kaydedildi.'); close(); location.hash = `#/songs/${r.id}`; rerender(); } catch (er) { toast(er.message); }
      };
      dr.querySelector('.cnl')?.addEventListener('click', async () => { if (!confirm('Yarışma iptal edilsin mi? Kullanıcılar artık göremez.')) return; try { await api(`/songs/contests/${c.id}`, { method: 'PUT', body: { ...body(), status: 'cancelled' } }); close(); rerender(); } catch (er) { toast(er.message); } });
      dr.querySelector('.act')?.addEventListener('click', async () => { try { await api(`/songs/contests/${c.id}`, { method: 'PUT', body: { ...body(), status: 'active' } }); close(); rerender(); } catch (er) { toast(er.message); } });
      dr.querySelector('.del')?.addEventListener('click', async () => { if (!confirm('Yarışma silinsin mi?')) return; try { await api(`/songs/contests/${c.id}`, { method: 'DELETE' }); close(); location.hash = '#/songs'; rerender(); } catch (er) { toast(er.message); } });
    });
  }

  function songFields(s = {}) {
    const opt = (list, v) => list.map((x) => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');
    return `<div class="sg2"><label>Şarkı adı<input class="field" name="title" maxlength="80" value="${esc(s.title || '')}"></label><label>Sanatçı adı<input class="field" name="artist" maxlength="60" value="${esc(s.artist || '')}"></label></div>
      <label>Düet / konuk sanatçı<input class="field" name="feat" maxlength="80" value="${esc(s.feat || '')}"></label>
      <div class="sg2"><label>Tür<select class="field" name="genre">${opt(all.genres, s.genre || 'Pop')}</select></label><label>Dil<select class="field" name="language">${opt(all.langs, s.language || 'Türkçe')}</select></label></div>
      <div class="sg3"><label>Besteci<input class="field" name="composer" maxlength="120" value="${esc(s.composer || '')}"></label><label>Söz yazarı<input class="field" name="lyricist" maxlength="120" value="${esc(s.lyricist || '')}"></label><label>Prodüktör / aranjör<input class="field" name="producer" maxlength="120" value="${esc(s.producer || '')}"></label></div>
      <label class="row"><input type="checkbox" name="explicit" ${s.explicit ? 'checked' : ''}> Açık içerik (küfür vb.)</label>
      <label>Açıklama<textarea class="field" name="about" rows="2" maxlength="500">${esc(s.about || '')}</textarea></label>
      <label>Şarkı sözleri<textarea class="field" name="lyrics" rows="5" maxlength="6000">${esc(s.lyrics || '')}</textarea></label>
      <div class="sg2"><label>Gerçek ad soyad (sözleşme)<input class="field" name="legalName" maxlength="80" value="${esc(s.legalName || '')}"></label><label>İletişim (e-posta / telefon)<input class="field" name="contact" maxlength="120" value="${esc(s.contact || '')}"></label></div>`;
  }
  const readFields = (f) => ({ title: f.title.value, artist: f.artist.value, feat: f.feat.value, genre: f.genre.value, language: f.language.value, composer: f.composer.value, lyricist: f.lyricist.value, producer: f.producer.value, explicit: f.explicit.checked, about: f.about.value, lyrics: f.lyrics.value, legalName: f.legalName.value, contact: f.contact.value });

  function addSong(cid) {
    let audio = null; let cover = null; let duration = 0;
    modal('Yarışmaya şarkı ekle', `<form class="sgform">
      <div class="sgup"><button type="button" class="btn pa">${icon('upload')} Ses dosyası seç</button><span class="muted pan">MP3, M4A, WAV</span><div class="sgbar" hidden><i></i></div></div>
      <div class="sgup"><button type="button" class="btn pc">${icon('image')} Kapak görseli</button><img class="sgcv" src="${COVER}" alt=""></div>
      ${songFields()}
      <label>Bağlanacak kullanıcı adı<input class="field" name="username" placeholder="@kullaniciadi (boşsa resmi SwipeUp hesabı)"><small class="muted">Şarkı bu kullanıcının adıyla görünür ve kullanıcıya bildirim gider. Yönetimden eklenen şarkılar doğrudan onaylı olur.</small></label>
      <button class="btn primary">${icon('check')} Şarkıyı ekle</button></form>`, (dr, close) => {
      const f = dr.querySelector('form'); const bar = dr.querySelector('.sgbar');
      dr.querySelector('.pa').onclick = async () => {
        const file = await pick('audio/*,.mp3,.m4a,.wav'); if (!file) return;
        duration = await new Promise((res) => { const a = new Audio(); a.preload = 'metadata'; a.onloadedmetadata = () => res(Math.round(a.duration) || 0); a.onerror = () => res(0); a.src = URL.createObjectURL(file); });
        dr.querySelector('.pan').textContent = `${file.name} · ${mb(file.size)} · ${fmtDur(duration)}`;
        if (!f.title.value) f.title.value = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 80);
        bar.hidden = false; audio = null;
        try { audio = (await upload(file, (p) => { bar.firstElementChild.style.width = `${p * 100}%`; })).url; bar.hidden = true; dr.querySelector('.pan').textContent += ' · yüklendi'; } catch (er) { toast(er.message); bar.hidden = true; }
      };
      dr.querySelector('.pc').onclick = async () => {
        const file = await pick('image/*'); if (!file) return;
        try { cover = (await upload(file)).url; dr.querySelector('.sgcv').src = cover; } catch (er) { toast(er.message); }
      };
      f.onsubmit = async (e) => {
        e.preventDefault();
        if (!audio) return toast('Önce ses dosyasını yükle.');
        try { await api(`/songs/contests/${cid}/songs`, { body: { ...readFields(f), audio, cover, duration, username: f.username.value } }); toast('Şarkı eklendi.'); close(); rerender(); } catch (er) { toast(er.message); }
      };
    });
  }

  function songDrawer(s, c, reload) {
    modal(esc(s.title), `<div class="sgdh"><img src="${esc(s.cover || COVER)}" alt=""><div class="grow"><b>${esc(s.artist)}${s.feat ? ` ft. ${esc(s.feat)}` : ''}</b><div class="muted">${esc(s.genre)} · ${esc(s.language)} · ${fmtDur(s.duration)} · ${mb(s.audioSize)} · ${s.plays} dinlenme</div>
        <div class="row" style="gap:6px;margin-top:6px"><span class="chip ${SST[s.status][0]}">${SST[s.status][1]}</span>${s.rank ? `<span class="chip">${s.rank}. sırada · ${s.votes} oy</span>` : ''}${s.winner ? '<span class="chip ok">Kazanan</span>' : ''}</div></div></div>
      <audio controls preload="none" src="${esc(s.audio)}" style="width:100%"></audio>
      <div class="row" style="gap:6px;flex-wrap:wrap"><a class="btn sm" href="${esc(s.audio)}" download="${esc(`${s.artist} - ${s.title}`)}">${icon('download')} Ses dosyasını indir</a>${s.cover ? `<a class="btn sm" href="${esc(s.cover)}" download>${icon('image')} Kapağı indir</a>` : ''}</div>
      <div class="panel"><div class="pb">${userCell(s.user)}<div class="muted" style="font-size:12px;margin-top:6px">Gönderim: ${dt(s.createdAt)} · haklar onaylandı: ${dt(s.rightsAt)}${s.reviewedBy ? ` · inceleyen: @${esc(s.reviewedBy)}` : ''}${s.reason ? ` · sebep: ${esc(s.reason)}` : ''}</div></div></div>
      ${s.status !== 'approved' ? `<button class="btn primary ok1">${icon('check')} Onayla ve yarışmaya al</button>` : ''}
      ${s.status !== 'rejected' ? `<div class="row" style="gap:6px"><input class="field rr" placeholder="Reddetme sebebi (kullanıcıya gösterilir)" style="flex:1"><button class="btn danger rj">Reddet</button></div>` : ''}
      ${s.status === 'approved' && may ? `<button class="btn sm ww">${icon('trophy')} Kazanan olarak seç</button>` : ''}
      <form class="sgform">${songFields(s)}<div class="row" style="gap:8px"><button class="btn primary sm">${icon('check')} Bilgileri kaydet</button><button type="button" class="btn sm danger dl">${icon('trash')} Sil</button></div></form>
      <div class="panel"><div class="ph"><h3>Oy verenler</h3></div><div class="pb vt"><div class="spin"></div></div></div>`, async (dr, close) => {
      const done = () => { close(); reload(); };
      dr.querySelector('.ok1')?.addEventListener('click', async () => { try { await api(`/songs/${s.id}/review`, { body: { status: 'approved' } }); toast('Onaylandı; kullanıcıya bildirildi.'); done(); } catch (er) { toast(er.message); } });
      dr.querySelector('.rj')?.addEventListener('click', async () => { try { await api(`/songs/${s.id}/review`, { body: { status: 'rejected', reason: dr.querySelector('.rr').value } }); toast('Reddedildi; kullanıcıya bildirildi.'); done(); } catch (er) { toast(er.message); } });
      dr.querySelector('.ww')?.addEventListener('click', async () => { if (!confirm(`“${s.title}” kazanan olarak seçilsin mi?`)) return; const notify = confirm('Kazanana ve katılımcılara bildirim gönderilsin mi?'); try { await api(`/songs/contests/${c.id}/winner`, { body: { songId: s.id, notify } }); toast('Kazanan seçildi.'); done(); } catch (er) { toast(er.message); } });
      dr.querySelector('form').onsubmit = async (e) => { e.preventDefault(); try { await api(`/songs/${s.id}`, { method: 'PUT', body: readFields(e.target) }); toast('Kaydedildi.'); done(); } catch (er) { toast(er.message); } };
      dr.querySelector('.dl').onclick = async () => { if (!confirm('Şarkı ve oyları kalıcı olarak silinsin mi?')) return; try { await api(`/songs/${s.id}`, { method: 'DELETE' }); toast('Silindi.'); done(); } catch (er) { toast(er.message); } };
      const vt = dr.querySelector('.vt');
      try { const v = await api(`/songs/${s.id}/voters`); vt.innerHTML = v.length ? `<div class="sgvl">${v.map((x) => `<div class="row">${userCell(x.user)}<span class="muted" style="font-size:12px;white-space:nowrap">${dt(x.at)}${x.createdAt && x.at - x.createdAt < 3 * 86400000 ? ' · <span class="chip warn">yeni hesap</span>' : ''}${x.flagged ? ' <span class="chip bad">işaretli</span>' : ''}</span></div>`).join('')}</div>` : '<div class="muted">Henüz oy yok.</div>'; } catch { vt.innerHTML = ''; }
    });
  }

  const body = main.querySelector('.sgbody');
  if (!sel) return;
  const load = async () => {
    const r = await api(`/songs/contests/${sel}`); const c = r.contest;
    const win = r.songs.find((s) => s.id === c.winnerId);
    const top = r.songs.filter((s) => s.status === 'approved').slice(0, 5);
    const maxV = Math.max(1, ...top.map((s) => s.votes || 0));
    body.innerHTML = `<div class="stats"><div class="stat"><b>${c.counts.total}</b><span>Gönderilen şarkı</span></div><div class="stat"><b>${c.counts.pending}</b><span>İnceleme bekleyen</span></div><div class="stat"><b>${c.counts.approved}</b><span>Yarışan</span></div><div class="stat"><b>${c.counts.votes}</b><span>Toplam oy</span></div><div class="stat"><b>${c.counts.voters}</b><span>Oy veren kişi</span></div></div>
      <div class="sggrid">
        <div class="panel"><div class="ph"><h3>${esc(c.title)}</h3>${may ? `<button class="btn sm edc">${icon('edit')} Düzenle</button>` : ''}</div><div class="pb sgtl">
          <div><span class="muted">Durum</span><b><span class="chip ${PH[c.phase][0]}">${PH[c.phase][1]}</span></b></div>
          <div><span class="muted">Başvuru</span><b>${dt(c.submitStart)} – ${dt(c.submitEnd)}</b></div>
          <div><span class="muted">Oylama</span><b>${dt(c.submitEnd)} – ${dt(c.voteEnd)}</b></div>
          <div><span class="muted">Ödül</span><b>${esc(c.prize || '—')}</b></div></div></div>
        <div class="panel"><div class="ph"><h3>${icon('trophy')} Kazanan ve Spotify yayını</h3></div><div class="pb" style="display:grid;gap:10px">
          ${win ? `<div class="sgwin"><img src="${esc(win.cover || COVER)}" alt=""><div class="grow"><b>${esc(win.title)}</b><div class="muted">${esc(win.artist)} · ${win.votes} oy · @${esc(win.username)}</div><div class="muted" style="font-size:12px">${esc(win.legalName || '')}${win.contact ? ' · ' + esc(win.contact) : ''}</div></div><a class="btn sm" href="${esc(win.audio)}" download="${esc(`${win.artist} - ${win.title}`)}">${icon('download')} İndir</a></div>
            <form class="sgrel"><div class="sg2"><label>Yayın durumu<select class="field" name="status">${Object.entries(all.release).map(([k, l]) => `<option value="${k}" ${c.release.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label>Spotify linki<input class="field" name="url" placeholder="https://open.spotify.com/track/…" value="${esc(c.release.spotifyUrl || '')}"></label></div>
              <label>Not (iç not)<input class="field" name="note" maxlength="300" value="${esc(c.release.note || '')}"></label>
              <label class="row"><input type="checkbox" name="all"> Yayına girince tüm kullanıcılara duyur</label>
              ${may ? `<div><button class="btn primary sm">${icon('check')} Yayın durumunu kaydet</button></div>` : ''}</form>`
            : `<div class="muted">${c.phase === 'ended' ? (c.noWinner ? 'Oy verilmediği için kazanan çıkmadı.' : 'Kazanan henüz belirlenmedi.') : 'Oylama bitince en çok oy alan şarkı otomatik kazanan olur; kazanana ve katılımcılara bildirim gider.'}</div>
              ${may && c.counts.approved ? `<div><button class="btn sm auto">${icon('trophy')} Şimdi oylara göre kazananı belirle</button></div>` : ''}`}
          ${top.length && top.some((s) => s.votes) ? `<div class="sgbars">${top.map((s) => `<div class="sgb"><span class="ell">${s.rank}. ${esc(s.title)}</span><i style="width:${((s.votes || 0) / maxV) * 100}%"></i><b>${s.votes || 0}</b></div>`).join('')}</div>` : ''}
        </div></div></div>
      <div class="panel" style="margin-top:16px"><div class="ph"><h3>Şarkılar</h3><div class="tabs sgf">${[['all', 'Tümü'], ['pending', 'Bekleyen'], ['approved', 'Onaylı'], ['rejected', 'Reddedilen']].map(([k, l]) => `<button data-f="${k}" class="${k === filt ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <div class="tw"><table class="tbl"><thead><tr><th class="num">#</th><th>Şarkı</th><th>Gönderen</th><th>Tür</th><th class="num">Süre</th><th class="num">Dinlenme</th><th class="num">Oy</th><th>Durum</th><th></th></tr></thead><tbody>
        ${r.songs.filter((s) => filt === 'all' || s.status === filt).map((s) => `<tr data-id="${esc(s.id)}" class="${s.winner ? 'sgw' : ''}"><td class="num">${s.rank || '—'}</td>
          <td><div class="row"><button class="sgplay" data-a="${esc(s.audio)}"><img src="${esc(s.cover || COVER)}" alt="">${icon('play')}</button><div class="grow"><div class="ell"><b>${esc(s.title)}</b>${s.explicit ? ' <span class="chip">E</span>' : ''}</div><div class="muted ell">${esc(s.artist)}${s.feat ? ` ft. ${esc(s.feat)}` : ''}</div></div></div></td>
          <td>${userCell(s.user)}</td><td><span class="muted">${esc(s.genre)}</span></td><td class="num">${fmtDur(s.duration)}</td><td class="num">${s.plays}</td><td class="num"><b>${s.votes ?? 0}</b></td>
          <td><span class="chip ${SST[s.status][0]}">${SST[s.status][1]}</span>${s.winner ? ' <span class="chip ok">Kazanan</span>' : ''}</td><td><button class="btn sm op">Aç</button></td></tr>`).join('') || '<tr><td colspan="9"><div class="empty">Bu listede şarkı yok.</div></td></tr>'}
        </tbody></table></div></div>`;
    body.querySelector('.edc')?.addEventListener('click', () => contestForm(c));
    body.querySelector('.auto')?.addEventListener('click', async () => { if (!confirm('En çok oy alan şarkı kazanan olarak belirlensin mi?')) return; try { await api(`/songs/contests/${c.id}/winner`, { body: { auto: true } }); toast('Kazanan belirlendi.'); load(); } catch (er) { toast(er.message); } });
    body.querySelector('.sgrel')?.addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target;
      try { await api(`/songs/contests/${c.id}/release`, { method: 'PUT', body: { status: f.status.value, spotifyUrl: f.url.value, note: f.note.value, announceAll: f.all.checked } }); toast('Yayın durumu kaydedildi.'); load(); } catch (er) { toast(er.message); }
    });
    body.querySelector('.sgf').onclick = (e) => { const b = e.target.closest('[data-f]'); if (!b) return; filt = b.dataset.f; load(); };
    let player = null; let pBtn = null;
    body.querySelector('tbody').onclick = (e) => {
      const pb = e.target.closest('.sgplay');
      if (pb) {
        if (pBtn === pb && player && !player.paused) { player.pause(); pb.classList.remove('on'); return; }
        player?.pause(); pBtn?.classList.remove('on');
        player = new Audio(pb.dataset.a); player.play().catch((er) => toast(er.message)); pBtn = pb; pb.classList.add('on');
        player.onended = () => pb.classList.remove('on');
        return;
      }
      const tr = e.target.closest('tr[data-id]'); if (!tr || !e.target.closest('.op')) return;
      player?.pause();
      songDrawer(r.songs.find((s) => s.id === tr.dataset.id), c, load);
    };
  };
  let filt = 'all';
  await load();
}

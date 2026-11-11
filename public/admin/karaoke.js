// Karaoke şarkı kataloğu — yönetim paneli modülü.
// Her şarkıya vokalsiz (enstrümantal) kayıt ve sözler eklenir; şarkıcı sahneye çıkınca müzik çalar, sözler altta akar.
export default async function karaokeAdmin(main, H) {
  const { api, esc, toast, head, icon, can, token, d } = H;
  const may = can('engage');
  const mb = (n) => (n ? `${(n / 1048576).toFixed(1)} MB` : '');
  const lineCount = (t) => String(t || '').split('\n').filter((l) => l.replace(/\[[^\]]*\]/g, '').trim()).length;

  const upload = (file, onProgress) => new Promise((resolve, reject) => {
    const fd = new FormData(); fd.append('file', file);
    const x = new XMLHttpRequest(); x.open('POST', '/api/admin/songs/upload'); x.setRequestHeader('Authorization', 'Bearer ' + token());
    x.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    x.onload = () => { let r = {}; try { r = JSON.parse(x.responseText); } catch { /* boş yanıt */ } if (x.status < 300) resolve(r); else reject(new Error(r.error || 'Yükleme başarısız.')); };
    x.onerror = () => reject(new Error('Bağlantı hatası.')); x.send(fd);
  });
  const modal = (title, html, onMount) => {
    const bg = document.createElement('div'); bg.className = 'drawer-bg';
    const dr = document.createElement('aside'); dr.className = 'drawer sgd';
    dr.innerHTML = `<div class="dh"><h2 class="grow">${title}</h2><button class="btn sm x">${icon('close')}</button></div><div class="db">${html}</div>`;
    const close = () => { dr.querySelectorAll('audio').forEach((a) => a.pause()); bg.remove(); dr.remove(); };
    bg.onclick = close; dr.querySelector('.x').onclick = close;
    document.body.append(bg, dr); onMount?.(dr, close); return close;
  };
  const rerender = () => karaokeAdmin(main, H);

  const { songs } = await api('/karaoke/songs');
  const ready = songs.filter((s) => s.hasAudio && s.hasLyrics).length;
  main.innerHTML = `${head('Karaoke şarkıları', 'Karaoke odasında seçilebilen şarkılar. Her şarkıya vokalsiz kaydı ve sözlerini ekle: şarkıcı sahneye çıkınca müzik çalar, sözler altta akar, kamera açmak zorunda kalmaz.', may ? `<button class="btn primary sm kadd">${icon('plus')} Şarkı ekle</button>` : '')}
    <div class="stats"><div class="stat"><b>${songs.length}</b><span>Şarkı</span></div><div class="stat"><b>${ready}</b><span>Müziği ve sözleri hazır</span></div><div class="stat"><b>${songs.filter((s) => s.synced).length}</b><span>Sözleri müzikle ilerleyen</span></div></div>
    <div class="panel"><div class="ph"><h3>Katalog</h3><input class="field kq" placeholder="Şarkı ya da sanatçı ara" style="max-width:240px"></div>
      <div class="pb" style="padding:0">${songs.length ? `<table class="tbl"><thead><tr><th>Şarkı</th><th>Müzik</th><th>Sözler</th><th>Eklendi</th><th></th></tr></thead><tbody class="kbody"></tbody></table>` : `<div class="empty">Henüz şarkı yok. “Şarkı ekle” ile ilk şarkını yükle: vokalsiz kayıt (MP3 ya da M4A) ve şarkı sözleri yeterli.</div>`}</div></div>
    <div class="panel" style="margin-top:16px"><div class="ph"><h3>Nasıl çalışır?</h3></div><div class="pb khelp">
      <p><b>Müzik:</b> Şarkının vokalsiz (enstrümantal ya da karaoke) kaydını yükle. Elinde yalnızca vokalli kayıt varsa “Kayıtta vokal var” seçeneğini işaretle; uygulama stereo kayıtlarda şarkıcının sesini kısar. En temiz sonuç vokalsiz kayıtla alınır.</p>
      <p><b>Sözler:</b> “Sözleri bul” düğmesi açık söz veritabanında arar. Satır başında <code>[01:23.45]</code> gibi zaman damgası olan sözler müzikle birlikte satır satır ilerler; düz metin ise şarkı boyunca ağır ağır kayar.</p>
      <p><b>Telif:</b> Yüklediğin kayıtların ve sözlerin kullanım hakkı sende olmalı. Ticari kullanımda meslek birliklerinden (MESAM, MSG, MÜ-YAP) izin gerekebilir.</p></div></div>`;

  const body = main.querySelector('.kbody');
  const rows = (q = '') => {
    if (!body) return;
    const f = q.toLocaleLowerCase('tr-TR').trim();
    const list = songs.filter((s) => !f || `${s.title} ${s.artist}`.toLocaleLowerCase('tr-TR').includes(f));
    body.innerHTML = list.length ? list.map((s) => `<tr data-id="${esc(s.id)}">
      <td><b>${esc(s.title)}</b><div class="muted" style="font-size:12.5px">${esc(s.artist)}</div></td>
      <td>${s.hasAudio ? `<span class="chip ok">Var</span>${s.vox ? ' <span class="chip warn">vokal kısılır</span>' : ''}<div class="muted" style="font-size:12px">${mb(s.size)}</div>` : '<span class="chip bad">Yok</span>'}</td>
      <td>${s.hasLyrics ? `<span class="chip ${s.synced ? 'ok' : 'info'}">${s.synced ? 'Zamanlı' : 'Düz metin'}</span><div class="muted" style="font-size:12px">${lineCount(s.lyrics)} satır</div>` : '<span class="chip bad">Yok</span>'}</td>
      <td class="muted" style="white-space:nowrap">${d(s.at)}</td>
      <td style="text-align:right"><button class="btn sm ked">${icon('edit')} Düzenle</button></td></tr>`).join('') : '<tr><td colspan="5" class="muted" style="text-align:center;padding:22px">Aramana uyan şarkı yok.</td></tr>';
  };
  rows();
  main.querySelector('.kq')?.addEventListener('input', (e) => rows(e.target.value));

  function edit(s) {
    const cur = { audio: s?.audio || '', size: s?.size || 0 };
    modal(s ? 'Şarkıyı düzenle' : 'Karaoke şarkısı ekle', `<form class="sgform kform">
        <div class="sg2"><label>Şarkı adı<input class="field" name="title" maxlength="80" required value="${esc(s?.title || '')}"></label><label>Sanatçı<input class="field" name="artist" maxlength="60" required value="${esc(s?.artist || '')}"></label></div>
        <div class="kfile"><div class="grow"><b>Müzik dosyası</b><div class="muted kfn" style="font-size:12.5px"></div></div><button type="button" class="btn sm kup">${icon('upload')} Dosya seç</button><button type="button" class="btn sm danger kdel" hidden>${icon('trash')}</button></div>
        <audio class="kau" controls preload="none" hidden style="width:100%"></audio>
        <label class="row"><input type="checkbox" name="vox" ${s?.vox ? 'checked' : ''}> Kayıtta vokal var: şarkıcının sesini otomatik kıs</label>
        <label>Sözler <span class="muted" style="font-weight:400">(düz metin ya da [dk:sn.xx] zaman damgalı)</span><textarea class="field" name="lyrics" rows="14" maxlength="12000" style="font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:1.5">${esc(s?.lyrics || '')}</textarea></label>
        <div class="row" style="gap:8px;flex-wrap:wrap"><button type="button" class="btn sm kfind">${icon('search')} Sözleri bul</button><span class="muted kls" style="font-size:12.5px"></span></div>
        <div class="row" style="gap:8px;margin-top:6px"><button class="btn primary">${icon('check')} Kaydet</button>${s ? `<button type="button" class="btn danger krm">${icon('trash')} Sil</button>` : ''}</div></form>`, (dr, close) => {
      const f = dr.querySelector('form'); const fn = dr.querySelector('.kfn'); const au = dr.querySelector('.kau'); const del = dr.querySelector('.kdel'); const ls = dr.querySelector('.kls');
      const show = () => { fn.textContent = cur.audio ? `Yüklendi${cur.size ? ` · ${mb(cur.size)}` : ''}` : 'MP3, M4A ya da WAV · en çok 40 MB'; au.hidden = !cur.audio; del.hidden = !cur.audio; if (cur.audio) au.src = cur.audio; else au.removeAttribute('src'); };
      const lyr = () => { const t = f.lyrics.value; const n = lineCount(t); ls.textContent = n ? `${n} satır · ${(t.match(/\[\d{1,3}:\d{2}/g) || []).length >= 2 ? 'zaman damgalı, müzikle ilerler' : 'düz metin, şarkı boyunca kayar'}` : ''; };
      show(); lyr(); f.lyrics.addEventListener('input', lyr);
      dr.querySelector('.kup').onclick = () => {
        const i = document.createElement('input'); i.type = 'file'; i.accept = 'audio/*,.mp3,.m4a,.wav,.aac,.ogg';
        i.onchange = async () => {
          const file = i.files[0]; if (!file) return;
          if (file.size > 40 * 1048576) return toast('Dosya 40 MB sınırını aşıyor.');
          const b = dr.querySelector('.kup'); b.disabled = true;
          try { const r = await upload(file, (p) => { fn.textContent = `Yükleniyor… %${Math.round(p * 100)}`; }); if (r.type !== 'audio') throw new Error('Bu bir ses dosyası değil.'); cur.audio = r.url; cur.size = r.size || file.size; toast('Müzik yüklendi.'); } catch (er) { toast(er.message); }
          b.disabled = false; show();
        };
        i.click();
      };
      del.onclick = () => { cur.audio = ''; cur.size = 0; show(); };
      dr.querySelector('.kfind').onclick = async (e) => {
        const title = f.title.value.trim(); if (title.length < 2) return toast('Önce şarkı adını yaz.');
        if (f.lyrics.value.trim() && !confirm('Yazılı sözlerin yerine bulunan sözler konsun mu?')) return;
        const b = e.currentTarget; b.disabled = true; ls.textContent = 'Aranıyor…';
        try {
          const r = await api(`/karaoke/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(f.artist.value.trim())}`);
          if (r.lyrics) { f.lyrics.value = r.lyrics; toast(r.synced ? 'Zaman damgalı sözler bulundu.' : 'Sözler bulundu (zaman damgasız).'); } else toast('Bu şarkının sözleri bulunamadı. Elle yapıştırabilirsin.');
        } catch (er) { toast(er.message); }
        b.disabled = false; lyr();
      };
      f.onsubmit = async (e) => {
        e.preventDefault();
        try { await api('/karaoke/songs', { body: { id: s?.id, title: f.title.value, artist: f.artist.value, audio: cur.audio, lyrics: f.lyrics.value, vox: f.vox.checked } }); toast(s ? 'Şarkı güncellendi.' : 'Şarkı kataloğa eklendi.'); close(); rerender(); } catch (er) { toast(er.message); }
      };
      dr.querySelector('.krm')?.addEventListener('click', async () => {
        if (!confirm(`“${s.title}” katalogdan silinsin mi?`)) return;
        try { await api(`/karaoke/songs/${s.id}`, { method: 'DELETE' }); toast('Şarkı silindi.'); close(); rerender(); } catch (er) { toast(er.message); }
      });
    });
  }
  main.querySelector('.kadd')?.addEventListener('click', () => edit(null));
  body?.addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr && e.target.closest('.ked')) edit(songs.find((s) => s.id === tr.dataset.id)); });
}

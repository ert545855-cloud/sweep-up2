// Genel yarışmalar — yönetim paneli
export default async function contestsAdmin(main, H) {
  const { api, esc, toast, head, dt, icon, userCell, can } = H;
  const may = can('contests');
  const PH = { soon: ['info', 'Yakında'], live: ['ok', 'Devam ediyor'], ended: ['warn', 'Bitti'], cancelled: ['bad', 'İptal'] };
  const toLocal = (t) => { if (!t) return ''; const x = new Date(t); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  const fromLocal = (v) => (v ? new Date(v).getTime() : null);
  const prizeTxt = (p) => [p.coins ? `${p.coins} jeton` : '', p.plusDays ? `${p.plusDays} gün Plus` : '', p.tag ? `${p.tag.em} ${p.tag.name}` : ''].filter(Boolean).join(' + ') || '—';
  const r = await api('/contests');
  const rerender = () => contestsAdmin(main, H);

  const modal = (title, html, onMount) => {
    const bg = document.createElement('div'); bg.className = 'drawer-bg';
    const dr = document.createElement('aside'); dr.className = 'drawer sgd';
    dr.innerHTML = `<div class="dh"><h2 class="grow">${title}</h2><button class="btn sm x">${icon('close')}</button></div><div class="db">${html}</div>`;
    const close = () => { bg.remove(); dr.remove(); };
    bg.onclick = close; dr.querySelector('.x').onclick = close;
    document.body.append(bg, dr); onMount?.(dr, close); return close;
  };

  main.innerHTML = `${head('Yarışmalar', 'En çok gönderi paylaşan, en çok beğeni ya da yorum alan gibi ölçütlerle yarışma aç. Puanlar seçtiğin tarihler arasındaki gerçek etkinliklerden hesaplanır; yarışma bitince ödüller (jeton, SwipeUp+, özel etiket) kazananlara kendiliğinden verilir ve bildirim gider.', may ? `<button class="btn primary sm newc">${icon('plus')} Yeni yarışma</button>` : '')}
    ${r.items.length ? `<div class="ctg">${r.items.map((c) => `<div class="panel ctc" data-id="${esc(c.id)}"><div class="ph"><h3><span style="font-size:22px">${esc(c.em)}</span> ${esc(c.title)}</h3><span class="chip ${PH[c.status === 'cancelled' ? 'cancelled' : c.phase][0]}">${PH[c.status === 'cancelled' ? 'cancelled' : c.phase][1]}</span></div>
      <div class="pb" style="display:grid;gap:8px;font-size:13.5px">
        <div><b>${esc(c.metricLabel)}</b>${c.verifiedOnly ? ' · <span class="chip">Sadece doğrulanmış</span>' : ''}</div>
        <div class="muted">${dt(c.start)} – ${dt(c.end)} · ${c.participants} katılımcı · ${c.winners} kazanan</div>
        <div class="ctp">${c.prizes.map((p, i) => `<span class="chip">${i + 1}. ${esc(prizeTxt(p))}</span>`).join('')}</div>
        ${c.top.length ? `<div class="ctt">${c.top.slice(0, 3).map((x) => `<div class="row" style="gap:8px"><b style="width:22px">${x.rank}.</b>${userCell(x.user)}<b style="margin-left:auto">${x.n} ${esc(c.unit)}</b></div>`).join('')}</div>` : '<div class="muted">Henüz puan alan yok.</div>'}
        ${c.awardedAt ? `<div class="chip ok" style="justify-self:start">Ödüller verildi · ${dt(c.awardedAt)} · ${esc(c.awardedBy || '')}</div>` : ''}
        <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm lb">Sıralama</button>${may ? `<button class="btn sm ed">${icon('edit')} Düzenle</button>${!c.awardedAt && c.status !== 'cancelled' ? `<button class="btn sm aw">${icon('trophy')} ${c.phase === 'ended' ? 'Ödülleri ver' : 'Erken bitir, ödül ver'}</button>` : ''}` : ''}</div>
      </div></div>`).join('')}</div>` : '<div class="panel"><div class="empty">Henüz yarışma yok. “Yeni yarışma” ile başla.</div></div>'}`;

  function form(c) {
    const v = c || { title: '', desc: '', em: '🏆', metric: 'likes', start: Date.now(), end: Date.now() + 7 * 86400000, winners: 3, rawPrizes: [{ coins: 500, plusDays: 30 }, { coins: 250, plusDays: 7 }, { coins: 100 }], verifiedOnly: false, announce: true };
    const prizes = v.rawPrizes || [];
    const prow = (p, i) => `<div class="ctpr" data-i="${i}"><b>${i + 1}.</b><label>Jeton<input class="field" type="number" min="0" name="c${i}" value="${p?.coins || 0}"></label><label>Plus (gün)<input class="field" type="number" min="0" name="p${i}" value="${p?.plusDays || 0}"></label>
      <label>Etiket<select class="field" name="t${i}"><option value="">—</option>${r.tags.map((t) => `<option value="${esc(t.id)}" ${p?.tagId === t.id ? 'selected' : ''}>${esc(t.em)} ${esc(t.name)}</option>`).join('')}</select></label></div>`;
    modal(c ? 'Yarışmayı düzenle' : 'Yeni yarışma', `<form class="sgform">
      <div class="sg3" style="grid-template-columns:80px minmax(0,1fr)"><label>Simge<input class="field" name="em" maxlength="4" value="${esc(v.em)}"></label><label>Yarışma adı<input class="field" name="title" maxlength="80" value="${esc(v.title)}" placeholder="ör. Kasımın en sevileni"></label></div>
      <label>Açıklama<textarea class="field" name="desc" rows="3" maxlength="800" placeholder="Kurallar, nasıl katılınır…">${esc(v.desc)}</textarea></label>
      <label>Ölçüt<select class="field" name="metric" ${c?.awardedAt ? 'disabled' : ''}>${r.metrics.map((m) => `<option value="${m.id}" ${v.metric === m.id ? 'selected' : ''}>${m.em} ${esc(m.label)}</option>`).join('')}</select></label>
      <div class="sg2"><label>Başlangıç<input class="field" type="datetime-local" name="start" value="${toLocal(v.start)}"></label><label>Bitiş<input class="field" type="datetime-local" name="end" value="${toLocal(v.end)}"></label></div>
      <div class="sg2"><label>Kazanan sayısı<input class="field" type="number" min="1" max="10" name="winners" value="${v.winners}"></label><div></div></div>
      <div class="ctprs">${Array.from({ length: v.winners }, (_, i) => prow(prizes[i], i)).join('')}</div>
      <label class="row"><input type="checkbox" name="vo" ${v.verifiedOnly ? 'checked' : ''}> Sadece doğrulanmış (mavi tikli) hesaplar katılabilir</label>
      <label class="row"><input type="checkbox" name="an" ${v.announce ? 'checked' : ''}> Başlayınca herkese bildirim gönder</label>
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary">${icon('check')} Kaydet</button>${c && c.status !== 'cancelled' && !c.awardedAt ? '<button type="button" class="btn danger cnl">İptal et</button>' : ''}${c && !c.awardedAt ? '<button type="button" class="btn danger del">Sil</button>' : ''}</div></form>`, (dr, close) => {
      const f = dr.querySelector('form');
      f.winners.oninput = () => {
        const n = Math.max(1, Math.min(10, +f.winners.value || 1)); const box = dr.querySelector('.ctprs');
        const cur = [...box.querySelectorAll('.ctpr')].map((x, i) => ({ coins: +f[`c${i}`].value, plusDays: +f[`p${i}`].value, tagId: f[`t${i}`].value }));
        box.innerHTML = Array.from({ length: n }, (_, i) => prow(cur[i] || prizes[i], i)).join('');
      };
      const body = () => {
        const n = dr.querySelectorAll('.ctpr').length;
        return { em: f.em.value, title: f.title.value, desc: f.desc.value, metric: f.metric.value, start: fromLocal(f.start.value), end: fromLocal(f.end.value), winners: n, prizes: Array.from({ length: n }, (_, i) => ({ coins: +f[`c${i}`].value || 0, plusDays: +f[`p${i}`].value || 0, tagId: f[`t${i}`].value || null })), verifiedOnly: f.vo.checked, announce: f.an.checked };
      };
      f.onsubmit = async (e) => {
        e.preventDefault();
        try { if (c) await api(`/contests/${c.id}`, { method: 'PUT', body: body() }); else await api('/contests', { body: body() }); toast('Kaydedildi.'); close(); rerender(); } catch (er) { toast(er.message); }
      };
      dr.querySelector('.cnl')?.addEventListener('click', async () => { if (!confirm('Yarışma iptal edilsin mi? Kullanıcılar artık göremez.')) return; try { await api(`/contests/${c.id}`, { method: 'PUT', body: { ...body(), status: 'cancelled' } }); close(); rerender(); } catch (er) { toast(er.message); } });
      dr.querySelector('.del')?.addEventListener('click', async () => { if (!confirm('Yarışma silinsin mi?')) return; try { await api(`/contests/${c.id}`, { method: 'DELETE' }); close(); rerender(); } catch (er) { toast(er.message); } });
    });
  }
  main.querySelector('.newc')?.addEventListener('click', () => form(null));
  main.querySelector('.ctg')?.addEventListener('click', async (e) => {
    const card = e.target.closest('.ctc'); if (!card) return;
    const c = r.items.find((x) => x.id === card.dataset.id);
    if (e.target.closest('.ed')) return form(c);
    if (e.target.closest('.aw')) {
      if (!confirm(c.phase === 'ended' ? 'Ödüller kazananlara şimdi verilsin mi?' : 'Yarışma şimdi bitirilip ödüller verilsin mi?')) return;
      try { await api(`/contests/${c.id}/award`, { body: { now: true } }); toast('Ödüller verildi; kazananlara bildirim gitti.'); rerender(); } catch (er) { toast(er.message); }
      return;
    }
    if (e.target.closest('.lb')) {
      modal(`${esc(c.em)} ${esc(c.title)} · sıralama`, `${c.given?.length ? `<div class="panel"><div class="ph"><h3>Verilen ödüller</h3></div><div class="pb" style="display:grid;gap:8px">${c.given.map((g) => `<div class="row" style="gap:8px"><b>${g.rank}.</b>${userCell(g.user)}<span class="muted" style="margin-left:auto">${esc(g.prize || '—')}</span></div>`).join('')}</div></div>` : ''}
        <div class="tw"><table class="tbl"><thead><tr><th class="num">#</th><th>Kullanıcı</th><th class="num">${esc(c.unit)}</th></tr></thead><tbody>${c.top.map((x) => `<tr><td class="num">${x.rank}</td><td>${userCell(x.user)}</td><td class="num"><b>${x.n}</b></td></tr>`).join('') || '<tr><td colspan="3"><div class="empty">Henüz puan yok.</div></td></tr>'}</tbody></table></div>`);
    }
  });
}

// Şirket yönetimi (ERP) — yönetim paneli modülü
export default async function erp(main, H) {
  const { api, esc, toast, head, tl, d, today, icon, ledgerView, admins } = H;
  const TABS = [['ozet', 'Özet', 'gauge'], ['gelir', 'Gelir-gider', 'sliders'], ['faturalar', 'Faturalar', 'doc'], ['cariler', 'Cariler', 'users'], ['hesaplar', 'Kasa ve banka', 'wallet'], ['personel', 'Personel ve maaş', 'person'], ['gorevler', 'Görevler', 'check'], ['raporlar', 'Raporlar', 'poll'], ['sirket', 'Şirket bilgileri', 'settings']];
  const parts = location.hash.slice(2).split('/');
  const tab = TABS.some((t) => t[0] === parts[1]) ? parts[1] : 'ozet';
  main.innerHTML = `${head('Şirket yönetimi', 'Muhasebe, fatura, cari, kasa-banka, personel ve görevler. Bu veriler sadece yönetim panelinde tutulur.')}
    <div class="tabs erp-tabs">${TABS.map(([k, l, ic]) => `<a href="#/erp/${k}" class="${k === tab ? 'on' : ''}">${icon(ic)} ${l}</a>`).join('')}</div><div class="erp-body"><div class="spin"></div></div>`;
  const body = main.querySelector('.erp-body');
  const money = (n, cls = '') => `<span class="money ${cls}">${tl(n)}</span>`;
  const mlabel = (m) => new Date(`${m}-15`).toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' });
  const modal = (title, html, onMount) => {
    const bg = document.createElement('div'); bg.className = 'drawer-bg';
    const dr = document.createElement('aside'); dr.className = 'drawer erp-dr';
    dr.innerHTML = `<div class="dh"><h2 class="grow">${title}</h2><button class="btn sm x">${icon('close')}</button></div><div class="db">${html}</div>`;
    const close = () => { bg.remove(); dr.remove(); };
    bg.onclick = close; dr.querySelector('.x').onclick = close;
    document.body.append(bg, dr); onMount?.(dr, close); return close;
  };
  const val = (f, n) => f.querySelector(`[name="${n}"]`)?.value ?? '';
  const accOpts = (accs, sel) => `<option value="">— Hesap seç —</option>${accs.filter((a) => !a.archived).map((a) => `<option value="${esc(a.id)}" ${a.id === sel ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}`;
  const csv = (name, rows) => { const s = '﻿' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([s], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click(); };
  const fmtN = (n) => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const T = {};
  // ================= ÖZET =================
  T.ozet = async () => {
    const s = await api('/erp/summary');
    const max = Math.max(1, ...s.chart.map((c) => Math.max(c.gelir, c.gider)));
    const KIND = { odeme: ['bad', 'Ödeme'], tahsilat: ['ok', 'Tahsilat'], maas: ['warn', 'Maaş'], gorev: ['info', 'Görev'] };
    body.innerHTML = `${!s.company?.title ? `<a class="erp-hint" href="#/erp/sirket">${icon('settings')} Önce şirket bilgilerini gir; faturalarda görünür.</a>` : ''}
      <div class="stats">
        <div class="stat"><b class="money in">${tl(s.income)}</b><span>Bu ay gelir</span></div><div class="stat"><b class="money out">${tl(s.expense)}</b><span>Bu ay gider</span></div>
        <div class="stat"><b class="money ${s.income - s.expense >= 0 ? 'in' : 'out'}">${tl(s.income - s.expense)}</b><span>Bu ay net kâr</span></div>
        <div class="stat"><b class="money">${tl(s.cash)}</b><span>Kasa + banka</span><a href="#/erp/hesaplar">Hesaplar</a></div>
        <div class="stat ${s.overdue ? 'alert' : ''}"><b class="money in">${tl(s.receivable)}</b><span>Alacak (tahsil edilecek)${s.overdue ? ` · ${s.overdue} gecikmiş` : ''}</span><a href="#/erp/faturalar">Faturalar</a></div>
        <div class="stat"><b class="money out">${tl(s.payable)}</b><span>Borç (ödenecek)</span></div>
        <div class="stat"><b class="money">${tl(s.vat.out - s.vat.in)}</b><span>Bu ay KDV farkı (hesaplanan ${tl(s.vat.out)} − indirilecek ${tl(s.vat.in)})</span></div>
        <div class="stat"><b>${s.staff.count}</b><span>Personel · aylık ${tl(s.staff.monthly)}${s.staff.unpaid ? ` · ${s.staff.unpaid} maaş ödenmedi` : ''}</span><a href="#/erp/personel">Personel</a></div>
        <div class="stat ${s.tasks.overdue ? 'alert' : ''}"><b>${s.tasks.todo + s.tasks.doing}</b><span>Açık görev${s.tasks.overdue ? ` · ${s.tasks.overdue} gecikmiş` : ''}</span><a href="#/erp/gorevler">Görevler</a></div>
      </div>
      <div class="grid g21">
        <div class="panel"><div class="ph"><h3>Son 12 ay gelir / gider</h3><span class="chip ok">Gelir</span><span class="chip bad">Gider</span></div><div class="pb"><div class="chart">${s.chart.map((c) => `<div class="b two" title="${c.month}: +${tl(c.gelir)} / −${tl(c.gider)}"><i style="height:${(c.gelir / max) * 100}%"></i><i style="height:${(c.gider / max) * 100}%"></i><small>${mlabel(c.month)}</small></div>`).join('')}</div></div></div>
        <div class="panel"><div class="ph"><h3>Yaklaşanlar</h3></div><div class="pb">${s.upcoming.length ? s.upcoming.map((u) => `<div class="row erp-up ${u.date < today() ? 'late' : ''}"><span class="chip ${KIND[u.kind][0]}">${KIND[u.kind][1]}</span><span class="grow">${esc(u.text)}<div class="muted" style="font-size:11.5px">${d(u.date)}${u.date < today() ? ' · gecikti' : ''}</div></span>${u.amount != null ? money(u.amount) : ''}</div>`).join('') : '<div class="muted">Yaklaşan ödeme, tahsilat ya da görev yok.</div>'}</div></div>
      </div>
      <div class="panel" style="margin-top:14px"><div class="ph"><h3>Hesap bakiyeleri</h3><a class="btn sm" href="#/erp/hesaplar">Yönet</a></div><div class="pb row" style="gap:10px;flex-wrap:wrap">${s.accounts.length ? s.accounts.map((a) => `<div class="acc-chip"><small>${esc({ kasa: 'Kasa', banka: 'Banka', pos: 'POS', kredi: 'Kredi kartı' }[a.type])}</small><b>${esc(a.name)}</b>${money(a.balance, a.balance < 0 ? 'out' : '')}</div>`).join('') : '<span class="muted">Henüz hesap yok. Kasa ve banka hesaplarını ekle.</span>'}</div></div>`;
  };

  // ================= GELİR-GİDER =================
  T.gelir = async () => { await ledgerView(body); body.querySelector('.head')?.remove(); };

  // ================= HESAPLAR =================
  T.hesaplar = async () => {
    const [accs, trs] = await Promise.all([api('/erp/accounts'), api('/erp/transfers')]);
    const name = (id) => accs.find((a) => a.id === id)?.name || '?';
    body.innerHTML = `<div class="row" style="gap:8px;margin-bottom:12px"><button class="btn primary nacc">${icon('plus')} Hesap</button><button class="btn tr">${icon('sliders')} Virman (hesaplar arası)</button></div>
      <div class="acc-grid">${accs.map((a) => `<div class="panel acc ${a.archived ? 'arch' : ''}" data-id="${esc(a.id)}"><div class="pb"><small class="muted">${esc({ kasa: 'Kasa', banka: 'Banka', pos: 'POS', kredi: 'Kredi kartı' }[a.type])}${a.bank ? ` · ${esc(a.bank)}` : ''}${a.archived ? ' · arşiv' : ''}</small><h3 style="margin:4px 0">${esc(a.name)}</h3><b class="money ${a.balance < 0 ? 'out' : ''}" style="font-size:22px">${tl(a.balance)}</b>${a.iban ? `<div class="mono muted" style="font-size:12px;margin-top:6px">${esc(a.iban)}</div>` : ''}<div class="row" style="gap:6px;margin-top:10px"><button class="btn sm ed">${icon('edit')} Düzenle</button><button class="btn sm danger rm">${icon('trash')}</button></div></div></div>`).join('') || '<div class="empty">Henüz hesap yok. “Hesap” ile kasa ya da banka hesabı ekle; gelir-gider kayıtlarında hesap seçince bakiyeler kendiliğinden hesaplanır.</div>'}</div>
      ${trs.length ? `<div class="panel" style="margin-top:14px"><div class="ph"><h3>Virmanlar</h3></div><div class="tw"><table class="tbl"><thead><tr><th>Tarih</th><th>Nereden</th><th>Nereye</th><th>Açıklama</th><th class="num">Tutar</th><th></th></tr></thead><tbody>${trs.map((t) => `<tr data-t="${esc(t.id)}"><td>${d(t.date)}</td><td>${esc(name(t.from))}</td><td>${esc(name(t.to))}</td><td class="muted">${esc(t.note || '')}</td><td class="num">${money(t.amount)}</td><td><button class="btn sm danger rmt">${icon('trash')}</button></td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
    const form = (a = {}) => modal(a.id ? 'Hesabı düzenle' : 'Yeni hesap', `<form class="fgrid erp-f">
      <label>Hesap adı<input class="field" name="name" value="${esc(a.name || '')}" placeholder="ör. Ziraat TL, Merkez kasa"></label>
      <label>Tür<select class="field" name="type">${[['banka', 'Banka'], ['kasa', 'Kasa (nakit)'], ['pos', 'POS / sanal POS'], ['kredi', 'Kredi kartı']].map(([k, l]) => `<option value="${k}" ${a.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>Banka<input class="field" name="bank" value="${esc(a.bank || '')}"></label><label>IBAN<input class="field" name="iban" value="${esc(a.iban || '')}"></label>
      <label>Açılış bakiyesi (₺)<input class="field" name="opening" value="${a.opening ?? ''}" inputmode="decimal"></label><label>Not<input class="field" name="note" value="${esc(a.note || '')}"></label>
      <label class="row" style="gap:6px"><input type="checkbox" name="archived" ${a.archived ? 'checked' : ''}> Arşivle (listelerde gösterme)</label>
      <button class="btn primary">Kaydet</button></form>`, (dr, close) => {
      dr.querySelector('form').onsubmit = async (e) => { e.preventDefault(); const f = e.target; const b = { name: val(f, 'name'), type: val(f, 'type'), bank: val(f, 'bank'), iban: val(f, 'iban'), opening: val(f, 'opening'), note: val(f, 'note'), archived: f.archived.checked };
        try { a.id ? await api(`/erp/accounts/${a.id}`, { method: 'PUT', body: b }) : await api('/erp/accounts', { body: b }); close(); toast('Kaydedildi.'); T.hesaplar(); } catch (er) { toast(er.message); } };
    });
    body.querySelector('.nacc').onclick = () => form();
    body.querySelector('.tr').onclick = () => modal('Virman', `<form class="fgrid erp-f"><label>Nereden<select class="field" name="from">${accOpts(accs)}</select></label><label>Nereye<select class="field" name="to">${accOpts(accs)}</select></label>
      <label>Tutar (₺)<input class="field" name="amount" inputmode="decimal"></label><label>Tarih<input class="field" type="date" name="date" value="${today()}"></label><label>Açıklama<input class="field" name="note"></label><button class="btn primary">Kaydet</button></form>`, (dr, close) => {
      dr.querySelector('form').onsubmit = async (e) => { e.preventDefault(); const f = e.target; try { await api('/erp/transfers', { body: { from: val(f, 'from'), to: val(f, 'to'), amount: val(f, 'amount'), date: val(f, 'date'), note: val(f, 'note') } }); close(); toast('Virman kaydedildi.'); T.hesaplar(); } catch (er) { toast(er.message); } };
    });
    body.onclick = async (e) => {
      const c = e.target.closest('[data-id]'); const a = c && accs.find((x) => x.id === c.dataset.id);
      if (e.target.closest('.ed') && a) form(a);
      if (e.target.closest('.rm') && a) { if (!confirm('Hesap silinsin mi?')) return; try { await api(`/erp/accounts/${a.id}`, { method: 'DELETE' }); T.hesaplar(); } catch (er) { toast(er.message); } }
      const t = e.target.closest('.rmt'); if (t) { if (!confirm('Virman silinsin mi?')) return; await api(`/erp/transfers/${t.closest('[data-t]').dataset.t}`, { method: 'DELETE' }); T.hesaplar(); }
    };
  };

  // ================= CARİLER =================
  T.cariler = async () => {
    const list = await api('/erp/parties');
    let q = ''; let kind = 'all';
    const KIND = { musteri: 'Müşteri', tedarikci: 'Tedarikçi', ikisi: 'Müşteri + tedarikçi' };
    const draw = () => {
      const items = list.filter((p) => (kind === 'all' || p.kind === kind || p.kind === 'ikisi') && (!q || `${p.name} ${p.person} ${p.taxNo} ${p.city}`.toLocaleLowerCase('tr').includes(q)));
      body.querySelector('.plist').innerHTML = items.length ? `<table class="tbl"><thead><tr><th>Cari</th><th>Tür</th><th>İletişim</th><th class="num">Alacak</th><th class="num">Borç</th><th></th></tr></thead><tbody>${items.map((p) => `<tr data-id="${esc(p.id)}"><td><b>${esc(p.name)}</b><div class="muted" style="font-size:12px">${esc([p.person, p.taxNo && `VKN/TCKN ${p.taxNo}`, p.city].filter(Boolean).join(' · '))}</div></td><td>${KIND[p.kind]}</td><td class="muted" style="font-size:12.5px">${esc([p.phone, p.email].filter(Boolean).join(' · ') || '—')}</td>
        <td class="num">${p.receivable ? money(p.receivable, 'in') : '—'}</td><td class="num">${p.payable ? money(p.payable, 'out') : '—'}</td><td class="num"><button class="btn sm ex">Ekstre</button> <button class="btn sm ed">${icon('edit')}</button> <button class="btn sm danger rm">${icon('trash')}</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Cari yok. Müşteri ve tedarikçilerini ekle; faturalar ve ödemeler cariye bağlanır.</div>';
    };
    body.innerHTML = `<div class="row" style="gap:8px;margin-bottom:12px;flex-wrap:wrap"><button class="btn primary np">${icon('plus')} Cari</button><input class="field pq" placeholder="Ara (ad, vergi no, şehir)" style="max-width:260px"><div class="tabs pk" style="margin:0">${[['all', 'Tümü'], ['musteri', 'Müşteriler'], ['tedarikci', 'Tedarikçiler']].map(([k, l]) => `<button data-k="${k}" class="${k === kind ? 'on' : ''}">${l}</button>`).join('')}</div>
      <button class="btn csvp">${icon('download')} CSV</button></div><div class="panel"><div class="tw plist"></div></div>`;
    draw();
    const form = (p = {}) => modal(p.id ? 'Cariyi düzenle' : 'Yeni cari', `<form class="fgrid erp-f">
      <label>Tür<select class="field" name="kind">${Object.entries(KIND).map(([k, l]) => `<option value="${k}" ${p.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>Unvan / ad soyad<input class="field" name="name" value="${esc(p.name || '')}"></label><label>Yetkili kişi<input class="field" name="person" value="${esc(p.person || '')}"></label>
      <label>VKN / TCKN<input class="field" name="taxNo" value="${esc(p.taxNo || '')}"></label><label>Vergi dairesi<input class="field" name="taxOffice" value="${esc(p.taxOffice || '')}"></label>
      <label>Telefon<input class="field" name="phone" value="${esc(p.phone || '')}"></label><label>E-posta<input class="field" name="email" value="${esc(p.email || '')}"></label>
      <label>Şehir<input class="field" name="city" value="${esc(p.city || '')}"></label><label>IBAN<input class="field" name="iban" value="${esc(p.iban || '')}"></label>
      <label style="grid-column:1/-1">Adres<input class="field" name="address" value="${esc(p.address || '')}"></label><label style="grid-column:1/-1">Not<input class="field" name="note" value="${esc(p.note || '')}"></label>
      <button class="btn primary">Kaydet</button></form>`, (dr, close) => {
      dr.querySelector('form').onsubmit = async (e) => { e.preventDefault(); const f = e.target; const b = Object.fromEntries(['kind', 'name', 'person', 'taxNo', 'taxOffice', 'phone', 'email', 'city', 'iban', 'address', 'note'].map((k) => [k, val(f, k)]));
        try { p.id ? await api(`/erp/parties/${p.id}`, { method: 'PUT', body: b }) : await api('/erp/parties', { body: b }); close(); toast('Kaydedildi.'); T.cariler(); } catch (er) { toast(er.message); } };
    });
    body.querySelector('.np').onclick = () => form();
    body.querySelector('.pq').oninput = (e) => { q = e.target.value.toLocaleLowerCase('tr'); draw(); };
    body.querySelector('.pk').onclick = (e) => { const b = e.target.closest('[data-k]'); if (!b) return; kind = b.dataset.k; body.querySelectorAll('.pk button').forEach((x) => x.classList.toggle('on', x === b)); draw(); };
    body.querySelector('.csvp').onclick = () => csv('cariler.csv', [['Ad', 'Tür', 'VKN/TCKN', 'Vergi dairesi', 'Telefon', 'E-posta', 'Şehir', 'Alacak', 'Borç'], ...list.map((p) => [p.name, KIND[p.kind], p.taxNo, p.taxOffice, p.phone, p.email, p.city, fmtN(p.receivable), fmtN(p.payable)])]);
    body.querySelector('.plist').onclick = async (e) => {
      const tr = e.target.closest('[data-id]'); if (!tr) return; const p = list.find((x) => x.id === tr.dataset.id);
      if (e.target.closest('.ed')) form(p);
      if (e.target.closest('.rm')) { if (!confirm(`${p.name} silinsin mi?`)) return; try { await api(`/erp/parties/${p.id}`, { method: 'DELETE' }); T.cariler(); } catch (er) { toast(er.message); } }
      if (e.target.closest('.ex')) {
        const s = await api(`/erp/parties/${p.id}/statement`);
        modal(`${esc(p.name)} · ekstre`, `<div class="stats sm"><div class="stat"><b class="money in">${tl(s.party.receivable)}</b><span>Alacak</span></div><div class="stat"><b class="money out">${tl(s.party.payable)}</b><span>Borç</span></div></div>
          <div class="tw"><table class="tbl"><thead><tr><th>Tarih</th><th>Belge</th><th>Açıklama</th><th class="num">Borç</th><th class="num">Alacak</th><th class="num">Bakiye</th></tr></thead><tbody>${s.rows.map((r) => `<tr><td>${d(r.date)}</td><td class="mono">${esc(r.doc)}</td><td>${esc(r.desc)}</td><td class="num">${r.debit ? fmtN(r.debit) : ''}</td><td class="num">${r.credit ? fmtN(r.credit) : ''}</td><td class="num"><b>${fmtN(r.balance)}</b></td></tr>`).join('') || '<tr><td colspan="6" class="muted">Hareket yok.</td></tr>'}</tbody></table></div>
          <button class="btn exc" style="margin-top:10px">${icon('download')} CSV</button>`, (dr) => { dr.querySelector('.exc').onclick = () => csv(`ekstre-${p.name}.csv`, [['Tarih', 'Belge', 'Açıklama', 'Borç', 'Alacak', 'Bakiye'], ...s.rows.map((r) => [r.date, r.doc, r.desc, fmtN(r.debit), fmtN(r.credit), fmtN(r.balance)])]); });
      }
    };
  };

  // ================= FATURALAR =================
  T.faturalar = async () => {
    const [list, parties, accs, cats] = await Promise.all([api('/erp/invoices'), api('/erp/parties'), api('/erp/accounts'), api('/ledger?from=2100-01-01').then((r) => r.categories).catch(() => ({ gelir: [], gider: [] }))]);
    let kind = 'satis';
    const ST = { odendi: ['ok', 'Ödendi'], kismi: ['warn', 'Kısmi ödendi'], bekliyor: ['', 'Bekliyor'], gecikti: ['bad', 'Gecikti'], taslak: ['', 'Taslak'], iptal: ['', 'İptal'] };
    const draw = () => {
      const items = list.filter((i) => i.kind === kind);
      const sum = (k) => items.filter((i) => !['iptal', 'taslak'].includes(i.status)).reduce((a, i) => a + i[k], 0);
      body.querySelector('.ilist').innerHTML = `<div class="stats sm" style="margin:12px"><div class="stat"><b class="money">${tl(sum('total'))}</b><span>Toplam (KDV dahil)</span></div><div class="stat"><b class="money">${tl(sum('vat'))}</b><span>KDV</span></div><div class="stat"><b class="money ${kind === 'satis' ? 'in' : 'out'}">${tl(sum('remaining'))}</b><span>${kind === 'satis' ? 'Tahsil edilecek' : 'Ödenecek'}</span></div></div>
        ${items.length ? `<table class="tbl"><thead><tr><th>No</th><th>Cari</th><th>Tarih</th><th>Vade</th><th class="num">Tutar</th><th class="num">Kalan</th><th>Durum</th><th></th></tr></thead><tbody>${items.map((i) => `<tr data-id="${esc(i.id)}"><td class="mono">${esc(i.no)}${i.extNo ? `<div class="muted" style="font-size:11px">${esc(i.extNo)}</div>` : ''}</td><td>${esc(i.party?.name || '?')}</td><td>${d(i.date)}</td><td>${i.due ? d(i.due) : '—'}</td><td class="num">${money(i.total)}</td><td class="num">${i.remaining ? money(i.remaining) : '—'}</td><td><span class="chip ${ST[i.status][0]}">${ST[i.status][1]}</span></td>
          <td class="num" style="white-space:nowrap">${i.remaining > 0 && !['iptal', 'taslak'].includes(i.status) ? `<button class="btn sm ok pay">${kind === 'satis' ? 'Tahsilat' : 'Ödeme'}</button> ` : ''}<button class="btn sm prt">${icon('doc')}</button> <button class="btn sm ed">${icon('edit')}</button> <button class="btn sm danger rm">${icon('trash')}</button></td></tr>`).join('')}</tbody></table>` : `<div class="empty">${kind === 'satis' ? 'Satış faturası yok.' : 'Alış faturası (gider faturası) yok.'}</div>`}`;
    };
    body.innerHTML = `<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary ni">${icon('plus')} Fatura</button><div class="tabs ik" style="margin:0"><button data-k="satis" class="on">Satış faturaları</button><button data-k="alis">Alış faturaları</button></div><button class="btn csvi">${icon('download')} CSV</button></div><div class="panel" style="margin-top:12px"><div class="tw ilist"></div></div>`;
    draw();
    body.querySelector('.ik').onclick = (e) => { const b = e.target.closest('[data-k]'); if (!b) return; kind = b.dataset.k; body.querySelectorAll('.ik button').forEach((x) => x.classList.toggle('on', x === b)); draw(); };
    body.querySelector('.csvi').onclick = () => csv(`faturalar-${kind}.csv`, [['No', 'Dış no', 'Cari', 'Tarih', 'Vade', 'Ara toplam', 'KDV', 'Tevkifat', 'Toplam', 'Ödenen', 'Kalan', 'Durum'], ...list.filter((i) => i.kind === kind).map((i) => [i.no, i.extNo, i.party?.name, i.date, i.due, fmtN(i.sub), fmtN(i.vat), fmtN(i.withholding), fmtN(i.total), fmtN(i.paid), fmtN(i.remaining), ST[i.status][1]])]);
    const lineRow = (l = {}) => `<tr class="ln"><td><input class="field" data-k="desc" value="${esc(l.desc || '')}" placeholder="Ürün / hizmet"></td><td><input class="field" data-k="qty" value="${l.qty ?? 1}" style="width:64px" inputmode="decimal"></td><td><input class="field" data-k="unit" value="${esc(l.unit || 'Adet')}" style="width:70px"></td>
      <td><input class="field" data-k="price" value="${l.price ?? ''}" style="width:100px" inputmode="decimal" placeholder="Birim fiyat"></td><td><input class="field" data-k="disc" value="${l.disc || 0}" style="width:56px" inputmode="decimal"></td><td><select class="field" data-k="vat">${[20, 10, 1, 0].map((v) => `<option value="${v}" ${(l.vat ?? 20) === v ? 'selected' : ''}>%${v}</option>`).join('')}</select></td><td class="num lt"></td><td><button type="button" class="btn sm danger rml">${icon('close')}</button></td></tr>`;
    const form = (inv = { kind, lines: [{}] }) => modal(inv.id ? `Faturayı düzenle · ${esc(inv.no)}` : (inv.kind === 'satis' ? 'Yeni satış faturası' : 'Yeni alış faturası'), `<form class="erp-f inv-f">
      <div class="fgrid"><label>Tür<select class="field" name="kind" ${inv.id ? 'disabled' : ''}><option value="satis" ${inv.kind === 'satis' ? 'selected' : ''}>Satış (gelir)</option><option value="alis" ${inv.kind === 'alis' ? 'selected' : ''}>Alış (gider)</option></select></label>
        <label>Cari<select class="field" name="partyId"><option value="">— Seç —</option>${parties.map((p) => `<option value="${esc(p.id)}" ${p.id === inv.partyId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
        <label>Fatura tarihi<input class="field" type="date" name="date" value="${inv.date || today()}"></label><label>Vade<input class="field" type="date" name="due" value="${inv.due || ''}"></label>
        <label>Kategori (gelir-gidere yazılır)<select class="field" name="category"></select></label><label>Karşı tarafın fatura no (alışta)<input class="field" name="extNo" value="${esc(inv.extNo || '')}"></label>
        <label>Durum<select class="field" name="status">${[['kesildi', 'Kesildi'], ['taslak', 'Taslak'], ['iptal', 'İptal']].map(([k, l]) => `<option value="${k}" ${(inv.status === k || (k === 'kesildi' && !['taslak', 'iptal'].includes(inv.status))) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label>KDV tevkifatı<select class="field" name="withholding">${[0, 2, 3, 4, 5, 7, 9].map((v) => `<option value="${v}" ${(inv.withholding || 0) === v ? 'selected' : ''}>${v ? `${v}/10` : 'Yok'}</option>`).join('')}</select></label></div>
      <div class="tw" style="margin-top:12px"><table class="tbl lines"><thead><tr><th>Açıklama</th><th>Miktar</th><th>Birim</th><th>Fiyat (₺)</th><th>İsk. %</th><th>KDV</th><th class="num">Tutar</th><th></th></tr></thead><tbody>${(inv.lines || [{}]).map(lineRow).join('')}</tbody></table></div>
      <button type="button" class="btn sm addl" style="margin:8px 0">${icon('plus')} Kalem</button>
      <div class="inv-tot"></div>
      <label style="display:grid;gap:4px;margin-top:8px">Not<input class="field" name="note" value="${esc(inv.note || '')}"></label>
      <button class="btn primary" style="margin-top:12px">Kaydet</button></form>`, (dr, close) => {
      const f = dr.querySelector('form');
      const setCats = () => { const k = (f.kind.value === 'alis' ? cats.gider : cats.gelir) || []; f.category.innerHTML = k.map((c) => `<option ${c === inv.category ? 'selected' : ''}>${esc(c)}</option>`).join(''); };
      setCats(); f.kind.onchange = setCats;
      const calc = () => {
        let sub = 0; let vat = 0;
        f.querySelectorAll('.ln').forEach((r) => { const g = (k) => parseFloat(String(r.querySelector(`[data-k="${k}"]`).value).replace(',', '.')) || 0; const base = g('qty') * g('price') * (1 - g('disc') / 100); sub += base; vat += base * g('vat') / 100; r.querySelector('.lt').textContent = fmtN(base); });
        const wh = vat * (+f.withholding.value || 0) / 10;
        f.querySelector('.inv-tot').innerHTML = `<div><span>Ara toplam</span><b>${tl(sub)}</b></div><div><span>KDV</span><b>${tl(vat)}</b></div>${wh ? `<div><span>Tevkifat</span><b>−${tl(wh)}</b></div>` : ''}<div class="gt"><span>Genel toplam</span><b>${tl(sub + vat - wh)}</b></div>`;
      };
      calc(); f.oninput = calc; f.onchange = calc;
      f.onclick = (e) => { if (e.target.closest('.addl')) { f.querySelector('.lines tbody').insertAdjacentHTML('beforeend', lineRow()); calc(); } if (e.target.closest('.rml')) { e.target.closest('tr').remove(); calc(); } };
      f.onsubmit = async (e) => {
        e.preventDefault();
        const lines = [...f.querySelectorAll('.ln')].map((r) => Object.fromEntries([...r.querySelectorAll('[data-k]')].map((x) => [x.dataset.k, x.value])));
        const b = { kind: f.kind.value, partyId: f.partyId.value, date: f.date.value, due: f.due.value, category: f.category.value, extNo: f.extNo.value, status: f.status.value, withholding: f.withholding.value, note: f.note.value, lines };
        try { inv.id ? await api(`/erp/invoices/${inv.id}`, { method: 'PUT', body: b }) : await api('/erp/invoices', { body: b }); close(); toast('Fatura kaydedildi.'); T.faturalar(); } catch (er) { toast(er.message); }
      };
    });
    body.querySelector('.ni').onclick = () => { if (!parties.length) { toast('Önce bir cari ekle.'); location.hash = '#/erp/cariler'; return; } form({ kind, lines: [{}] }); };
    body.querySelector('.ilist').onclick = async (e) => {
      const tr = e.target.closest('[data-id]'); if (!tr) return; const inv = list.find((x) => x.id === tr.dataset.id);
      if (e.target.closest('.ed')) form(inv);
      if (e.target.closest('.rm')) { if (!confirm(`${inv.no} silinsin mi?`)) return; try { await api(`/erp/invoices/${inv.id}`, { method: 'DELETE' }); T.faturalar(); } catch (er) { toast(er.message); } }
      if (e.target.closest('.pay')) modal(`${esc(inv.no)} · ${inv.kind === 'satis' ? 'tahsilat' : 'ödeme'}`, `<form class="fgrid erp-f"><label>Tutar (₺) · kalan ${tl(inv.remaining)}<input class="field" name="amount" value="${inv.remaining}" inputmode="decimal"></label>
        <label>Hesap<select class="field" name="accountId">${accOpts(accs)}</select></label><label>Tarih<input class="field" type="date" name="date" value="${today()}"></label><button class="btn primary">Kaydet</button>
        <p class="muted" style="grid-column:1/-1;font-size:12.5px;margin:0">Gelir-gider defterine “${esc(inv.category || '')}” olarak yazılır ve seçtiğin hesabın bakiyesine işlenir.</p></form>`, (dr, close) => {
        dr.querySelector('form').onsubmit = async (ev) => { ev.preventDefault(); const f = ev.target; try { await api(`/erp/invoices/${inv.id}/pay`, { body: { amount: val(f, 'amount'), accountId: val(f, 'accountId'), date: val(f, 'date') } }); close(); toast('Kaydedildi.'); T.faturalar(); } catch (er) { toast(er.message); } };
      });
      if (e.target.closest('.prt')) printInvoice(inv);
    };
  };
  async function printInvoice(inv) {
    const [c, parties] = await Promise.all([api('/erp/company'), api('/erp/parties')]);
    const p = parties.find((x) => x.id === inv.partyId) || {};
    const me = { title: c.title || 'Şirket unvanı', lines: [c.address, c.phone && `Tel: ${c.phone}`, c.email, c.taxOffice && `${c.taxOffice} V.D.`, c.taxNo && `VKN: ${c.taxNo}`, c.mersis && `MERSİS: ${c.mersis}`].filter(Boolean) };
    const them = { title: p.name || '', lines: [p.address, p.city, p.taxOffice && `${p.taxOffice} V.D.`, p.taxNo && `VKN/TCKN: ${p.taxNo}`, p.phone, p.email].filter(Boolean) };
    const [seller, buyer] = inv.kind === 'satis' ? [me, them] : [them, me];
    const w = window.open('', '_blank');
    w.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${esc(inv.no)}</title><style>
      body{font:13px/1.45 -apple-system,Segoe UI,Roboto,sans-serif;color:#111;margin:32px}h1{font-size:22px;margin:0}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{padding:7px 8px;border-bottom:1px solid #ddd;text-align:left}th{background:#f4f4f6;font-size:12px}.n{text-align:right}
      .top{display:flex;justify-content:space-between;gap:20px}.box{border:1px solid #ddd;border-radius:8px;padding:12px;width:48%}.box b{display:block;font-size:14px;margin-bottom:4px}.meta td{border:0;padding:2px 8px}.tot{width:280px;margin-left:auto}.tot td{border:0}.gt td{font-size:16px;font-weight:800;border-top:2px solid #111}.note{margin-top:24px;color:#555;font-size:12px}@media print{button{display:none}}
      </style></head><body><button onclick="print()" style="float:right;padding:8px 14px">Yazdır / PDF</button>
      <div class="top"><div><h1>${inv.kind === 'satis' ? 'SATIŞ FATURASI' : 'ALIŞ FATURASI'}</h1><table class="meta"><tr><td>Fatura no</td><td><b>${esc(inv.no)}</b>${inv.extNo ? ` (${esc(inv.extNo)})` : ''}</td></tr><tr><td>Tarih</td><td>${d(inv.date)}</td></tr>${inv.due ? `<tr><td>Vade</td><td>${d(inv.due)}</td></tr>` : ''}</table></div></div>
      <div class="top" style="margin-top:16px"><div class="box"><small>Satıcı</small><b>${esc(seller.title)}</b>${seller.lines.map((l) => `<div>${esc(l)}</div>`).join('')}</div><div class="box"><small>Alıcı</small><b>${esc(buyer.title)}</b>${buyer.lines.map((l) => `<div>${esc(l)}</div>`).join('')}</div></div>
      <table><thead><tr><th>#</th><th>Açıklama</th><th class="n">Miktar</th><th class="n">Birim fiyat</th><th class="n">İsk.</th><th class="n">KDV</th><th class="n">Tutar</th></tr></thead><tbody>${inv.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.desc)}</td><td class="n">${l.qty} ${esc(l.unit)}</td><td class="n">${fmtN(l.price)}</td><td class="n">${l.disc ? `%${l.disc}` : ''}</td><td class="n">%${l.vat}</td><td class="n">${fmtN(l.qty * l.price * (1 - (l.disc || 0) / 100))}</td></tr>`).join('')}</tbody></table>
      <table class="tot"><tr><td>Ara toplam</td><td class="n">${fmtN(inv.sub)} ₺</td></tr><tr><td>KDV</td><td class="n">${fmtN(inv.vat)} ₺</td></tr>${inv.withholding ? `<tr><td>KDV tevkifatı (${inv.withholding ? `${Math.round((inv.withholding / (inv.vat || 1)) * 10)}/10` : ''})</td><td class="n">−${fmtN(inv.withholding)} ₺</td></tr>` : ''}<tr class="gt"><td>Genel toplam</td><td class="n">${fmtN(inv.total)} ₺</td></tr></table>
      <div class="note">${inv.note ? `${esc(inv.note)}<br>` : ''}${c.iban && inv.kind === 'satis' ? `Ödeme: ${esc(c.bank || '')} ${esc(c.iban)}<br>` : ''}${esc(c.invoiceNote || '')}<br><i>Bu belge iç takip amaçlıdır; resmi e-Fatura / e-Arşiv yerine geçmez.</i></div></body></html>`);
    w.document.close();
  }

  // ================= PERSONEL =================
  T.personel = async () => {
    const month0 = today().slice(0, 7);
    let month = month0;
    const [emps, accs] = await Promise.all([api('/erp/employees'), api('/erp/accounts')]);
    const draw = async () => {
      const pr = await api(`/erp/payroll?month=${month}`);
      const unpaid = pr.items.filter((e) => e.status === 'aktif' && !e.paid);
      body.innerHTML = `<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:12px"><button class="btn primary ne">${icon('plus')} Personel</button><input type="month" class="field pm" value="${month}" style="width:auto"><button class="btn csve">${icon('download')} CSV</button></div>
        <div class="stats sm"><div class="stat"><b>${emps.filter((e) => e.status === 'aktif').length}</b><span>Aktif personel</span></div><div class="stat"><b class="money out">${tl(pr.total)}</b><span>Aylık toplam maliyet</span></div><div class="stat ${unpaid.length ? 'alert' : ''}"><b>${unpaid.length}</b><span>${esc(month)} ödenmemiş maaş</span></div></div>
        ${unpaid.length ? `<div class="panel" style="margin-bottom:14px"><div class="pb row" style="gap:10px;flex-wrap:wrap;align-items:flex-end"><div class="grow"><b>${esc(month)} maaşlarını öde</b><div class="muted" style="font-size:12.5px">${unpaid.length} kişi · ${tl(unpaid.reduce((a, e) => a + e.salary + (e.employerCost || 0), 0))} · gelir-gidere “Maaş” ve “Vergi” olarak yazılır</div></div>
          <select class="field pacc" style="width:auto">${accOpts(accs)}</select><input type="date" class="field pdate" value="${today()}" style="width:auto"><button class="btn primary payall">${icon('check')} Maaşları öde</button></div></div>` : ''}
        <div class="panel"><div class="tw">${pr.items.length ? `<table class="tbl"><thead><tr><th>Personel</th><th>Görev</th><th>İşe giriş</th><th class="num">Net maaş</th><th class="num">SGK + vergi</th><th>Maaş günü</th><th>${esc(month)}</th><th></th></tr></thead><tbody>${pr.items.map((e) => `<tr data-id="${esc(e.id)}"><td><b>${esc(e.name)}</b>${e.status === 'ayrildi' ? ' <span class="chip">Ayrıldı</span>' : ''}<div class="muted" style="font-size:12px">${esc([e.phone, e.email].filter(Boolean).join(' · '))}</div></td><td>${esc([e.title, e.dept].filter(Boolean).join(' · ') || '—')}</td><td>${d(e.startDate)}</td><td class="num">${money(e.salary)}</td><td class="num">${e.employerCost ? money(e.employerCost) : '—'}</td><td>Ayın ${e.payDay}’i</td>
          <td>${e.paid ? `<span class="chip ok">Ödendi · ${d(e.paid.date)}</span> <button class="btn sm undo" data-p="${esc(e.paid.id)}">Geri al</button>` : e.status === 'aktif' ? '<span class="chip warn">Ödenmedi</span>' : '—'}</td><td class="num" style="white-space:nowrap"><button class="btn sm lv">İzin</button> <button class="btn sm ed">${icon('edit')}</button> <button class="btn sm danger rm">${icon('trash')}</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Personel yok.</div>'}</div></div>`;
      body.querySelector('.pm').onchange = (e) => { month = e.target.value || month0; draw(); };
      body.querySelector('.ne').onclick = () => form();
      body.querySelector('.csve').onclick = () => csv('personel.csv', [['Ad', 'Görev', 'Departman', 'TC', 'Telefon', 'E-posta', 'IBAN', 'İşe giriş', 'Net maaş', 'SGK+vergi', 'Durum'], ...emps.map((e) => [e.name, e.title, e.dept, e.tc, e.phone, e.email, e.iban, e.startDate, fmtN(e.salary), fmtN(e.employerCost), e.status])]);
      body.querySelector('.payall')?.addEventListener('click', async () => {
        if (!confirm(`${unpaid.length} kişinin ${month} maaşı ödendi olarak işlensin mi?`)) return;
        try { const r = await api('/erp/payroll', { body: { month, accountId: body.querySelector('.pacc').value, date: body.querySelector('.pdate').value } }); toast(`${r.count} maaş işlendi.`); draw(); } catch (er) { toast(er.message); }
      });
      body.querySelector('.tw').onclick = async (e) => {
        const u = e.target.closest('.undo'); if (u) { if (!confirm('Bu maaş ödemesi geri alınsın mı? Gelir-gider kayıtları da silinir.')) return; await api(`/erp/payroll/${u.dataset.p}`, { method: 'DELETE' }); draw(); return; }
        const tr = e.target.closest('[data-id]'); if (!tr) return; const emp = emps.find((x) => x.id === tr.dataset.id);
        if (e.target.closest('.ed')) form(emp);
        if (e.target.closest('.rm')) { if (!confirm(`${emp.name} silinsin mi? (Ayrılan personel için “Ayrıldı” durumunu kullanman önerilir.)`)) return; await api(`/erp/employees/${emp.id}`, { method: 'DELETE' }); T.personel(); }
        if (e.target.closest('.lv')) leaves(emp);
      };
    };
    const form = (e = {}) => modal(e.id ? 'Personeli düzenle' : 'Yeni personel', `<form class="fgrid erp-f">
      <label>Ad soyad<input class="field" name="name" value="${esc(e.name || '')}"></label><label>Görev<input class="field" name="title" value="${esc(e.title || '')}"></label>
      <label>Departman<input class="field" name="dept" value="${esc(e.dept || '')}"></label><label>TC kimlik no<input class="field" name="tc" value="${esc(e.tc || '')}" inputmode="numeric"></label>
      <label>Telefon<input class="field" name="phone" value="${esc(e.phone || '')}"></label><label>E-posta<input class="field" name="email" value="${esc(e.email || '')}"></label>
      <label>IBAN<input class="field" name="iban" value="${esc(e.iban || '')}"></label><label>İşe giriş<input class="field" type="date" name="startDate" value="${e.startDate || today()}"></label>
      <label>Net maaş (₺)<input class="field" name="salary" value="${e.salary ?? ''}" inputmode="decimal"></label><label>İşveren SGK + vergi (₺, aylık)<input class="field" name="employerCost" value="${e.employerCost ?? ''}" inputmode="decimal"></label>
      <label>Maaş günü (1–28)<input class="field" type="number" min="1" max="28" name="payDay" value="${e.payDay || 1}"></label>
      <label>Durum<select class="field" name="status"><option value="aktif">Aktif</option><option value="ayrildi" ${e.status === 'ayrildi' ? 'selected' : ''}>Ayrıldı</option></select></label><label>Ayrılış tarihi<input class="field" type="date" name="endDate" value="${e.endDate || ''}"></label>
      <label style="grid-column:1/-1">Not<input class="field" name="note" value="${esc(e.note || '')}"></label><button class="btn primary">Kaydet</button></form>`, (dr, close) => {
      dr.querySelector('form').onsubmit = async (ev) => { ev.preventDefault(); const f = ev.target; const b = Object.fromEntries(['name', 'title', 'dept', 'tc', 'phone', 'email', 'iban', 'startDate', 'salary', 'employerCost', 'payDay', 'status', 'endDate', 'note'].map((k) => [k, val(f, k)]));
        try { e.id ? await api(`/erp/employees/${e.id}`, { method: 'PUT', body: { ...b, leaves: e.leaves } }) : await api('/erp/employees', { body: b }); close(); toast('Kaydedildi.'); T.personel(); } catch (er) { toast(er.message); } };
    });
    const leaves = (emp) => modal(`${esc(emp.name)} · izinler`, `<div class="lvl">${(emp.leaves || []).map((l, i) => `<div class="row" style="gap:8px;padding:6px 0;border-bottom:1px solid var(--line)"><span class="chip">${esc(l.type)}</span><span class="grow">${d(l.from)} – ${d(l.to)} <span class="muted">· ${Math.round((new Date(l.to) - new Date(l.from)) / 86400000) + 1} gün${l.note ? ` · ${esc(l.note)}` : ''}</span></span><button class="btn sm danger rlv" data-i="${i}">${icon('trash')}</button></div>`).join('') || '<div class="muted">Kayıtlı izin yok.</div>'}</div>
      <form class="fgrid erp-f" style="margin-top:12px"><label>Tür<select class="field" name="type"><option>Yıllık izin</option><option>Rapor</option><option>Mazeret izni</option><option>Ücretsiz izin</option></select></label><label>Başlangıç<input class="field" type="date" name="from"></label><label>Bitiş<input class="field" type="date" name="to"></label><label>Not<input class="field" name="note"></label><button class="btn primary">İzin ekle</button></form>`, (dr, close) => {
      const save = async (lv) => { try { await api(`/erp/employees/${emp.id}`, { method: 'PUT', body: { leaves: lv } }); close(); toast('Kaydedildi.'); T.personel(); } catch (er) { toast(er.message); } };
      dr.querySelector('form').onsubmit = (ev) => { ev.preventDefault(); const f = ev.target; if (!val(f, 'from') || !val(f, 'to')) return toast('Tarihleri seç.'); save([...(emp.leaves || []), { type: val(f, 'type'), from: val(f, 'from'), to: val(f, 'to'), note: val(f, 'note') }]); };
      dr.querySelector('.lvl').onclick = (ev) => { const b = ev.target.closest('.rlv'); if (b) save((emp.leaves || []).filter((_, i) => i !== +b.dataset.i)); };
    });
    await draw();
  };

  // ================= GÖREVLER =================
  T.gorevler = async () => {
    const tasks = await api('/erp/tasks');
    const COLSK = [['todo', 'Yapılacak'], ['doing', 'Sürüyor'], ['done', 'Bitti']];
    const PRI = { acil: ['bad', 'Acil'], yuksek: ['warn', 'Yüksek'], normal: ['', 'Normal'], dusuk: ['', 'Düşük'] };
    const projects = [...new Set(tasks.map((t) => t.project).filter(Boolean))];
    let pf = '';
    const draw = () => {
      const list = tasks.filter((t) => !pf || t.project === pf);
      body.querySelector('.kb').innerHTML = COLSK.map(([k, l]) => `<div class="kcol" data-c="${k}"><div class="kh">${l} <span class="muted">${list.filter((t) => t.status === k).length}</span></div>
        ${list.filter((t) => t.status === k).sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).map((t) => `<div class="kcard ${t.due && t.due < today() && k !== 'done' ? 'late' : ''}" data-id="${esc(t.id)}"><b>${esc(t.title)}</b>${t.desc ? `<div class="muted" style="font-size:12px">${esc(t.desc.slice(0, 120))}</div>` : ''}
          <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:6px">${t.priority !== 'normal' ? `<span class="chip ${PRI[t.priority][0]}">${PRI[t.priority][1]}</span>` : ''}${t.project ? `<span class="chip info">${esc(t.project)}</span>` : ''}${t.assignee ? `<span class="chip">@${esc(t.assignee)}</span>` : ''}${t.due ? `<span class="muted" style="font-size:11.5px">${d(t.due)}</span>` : ''}</div>
          <div class="row kact" style="gap:4px;margin-top:8px">${k !== 'todo' ? `<button class="btn sm mv" data-to="${k === 'done' ? 'doing' : 'todo'}">←</button>` : ''}${k !== 'done' ? `<button class="btn sm mv" data-to="${k === 'todo' ? 'doing' : 'done'}">→</button>` : ''}<span class="grow"></span><button class="btn sm ed">${icon('edit')}</button><button class="btn sm danger rm">${icon('trash')}</button></div></div>`).join('')}</div>`).join('');
    };
    body.innerHTML = `<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:12px"><button class="btn primary nt">${icon('plus')} Görev</button>${projects.length ? `<select class="field pf" style="width:auto"><option value="">Tüm projeler</option>${projects.map((p) => `<option>${esc(p)}</option>`).join('')}</select>` : ''}</div><div class="kb"></div>`;
    draw();
    body.querySelector('.pf')?.addEventListener('change', (e) => { pf = e.target.value; draw(); });
    const form = (t = {}) => modal(t.id ? 'Görevi düzenle' : 'Yeni görev', `<form class="fgrid erp-f">
      <label style="grid-column:1/-1">Başlık<input class="field" name="title" value="${esc(t.title || '')}"></label><label style="grid-column:1/-1">Açıklama<textarea class="field" name="desc" rows="4">${esc(t.desc || '')}</textarea></label>
      <label>Proje<input class="field" name="project" value="${esc(t.project || '')}" list="projl"><datalist id="projl">${projects.map((p) => `<option>${esc(p)}</option>`).join('')}</datalist></label>
      <label>Sorumlu<select class="field" name="assignee"><option value="">—</option>${admins.map((a) => `<option value="${esc(a.username)}" ${t.assignee === a.username ? 'selected' : ''}>${esc(a.name)} (@${esc(a.username)})</option>`).join('')}</select></label>
      <label>Öncelik<select class="field" name="priority">${Object.entries(PRI).map(([k, [, l]]) => `<option value="${k}" ${(t.priority || 'normal') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label>Son tarih<input class="field" type="date" name="due" value="${t.due || ''}"></label>
      <label>Durum<select class="field" name="status">${COLSK.map(([k, l]) => `<option value="${k}" ${(t.status || 'todo') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label><button class="btn primary">Kaydet</button></form>`, (dr, close) => {
      dr.querySelector('form').onsubmit = async (ev) => { ev.preventDefault(); const f = ev.target; const b = Object.fromEntries(['title', 'desc', 'project', 'assignee', 'priority', 'due', 'status'].map((k) => [k, val(f, k)]));
        try { t.id ? await api(`/erp/tasks/${t.id}`, { method: 'PUT', body: b }) : await api('/erp/tasks', { body: b }); close(); toast('Kaydedildi.'); T.gorevler(); } catch (er) { toast(er.message); } };
    });
    body.querySelector('.nt').onclick = () => form();
    body.querySelector('.kb').onclick = async (e) => {
      const c = e.target.closest('[data-id]'); if (!c) return; const t = tasks.find((x) => x.id === c.dataset.id);
      const mv = e.target.closest('.mv'); if (mv) { t.status = mv.dataset.to; await api(`/erp/tasks/${t.id}`, { method: 'PUT', body: { status: t.status } }); draw(); return; }
      if (e.target.closest('.ed')) form(t);
      if (e.target.closest('.rm')) { if (!confirm('Görev silinsin mi?')) return; await api(`/erp/tasks/${t.id}`, { method: 'DELETE' }); T.gorevler(); }
    };
  };

  // ================= RAPORLAR =================
  T.raporlar = async () => {
    let year = today().slice(0, 4);
    const draw = async () => {
      const r = await api(`/erp/report?year=${year}`);
      const tot = r.monthly.reduce((a, m) => ({ g: a.g + m.gelir, c: a.c + m.gider, vo: a.vo + m.vatOut, vi: a.vi + m.vatIn, s: a.s + m.sales, p: a.p + m.purchases }), { g: 0, c: 0, vo: 0, vi: 0, s: 0, p: 0 });
      const max = Math.max(1, ...r.monthly.map((m) => Math.max(m.gelir, m.gider)));
      body.innerHTML = `<div class="row" style="gap:8px;margin-bottom:12px"><select class="field yr" style="width:auto">${[0, 1, 2, 3].map((i) => +today().slice(0, 4) - i).map((y) => `<option ${String(y) === year ? 'selected' : ''}>${y}</option>`).join('')}</select><button class="btn csvr">${icon('download')} Kâr-zarar CSV</button></div>
        <div class="stats"><div class="stat"><b class="money in">${tl(tot.g)}</b><span>${year} gelir</span></div><div class="stat"><b class="money out">${tl(tot.c)}</b><span>${year} gider</span></div><div class="stat"><b class="money ${tot.g - tot.c >= 0 ? 'in' : 'out'}">${tl(tot.g - tot.c)}</b><span>${year} net kâr</span></div><div class="stat"><b class="money">${tl(tot.vo - tot.vi)}</b><span>KDV farkı (hesaplanan − indirilecek)</span></div></div>
        <div class="panel"><div class="ph"><h3>Aylık kâr-zarar</h3></div><div class="pb"><div class="chart">${r.monthly.map((m) => `<div class="b two" title="${m.month}"><i style="height:${(m.gelir / max) * 100}%"></i><i style="height:${(m.gider / max) * 100}%"></i><small>${mlabel(m.month)}</small></div>`).join('')}</div></div>
          <div class="tw"><table class="tbl"><thead><tr><th>Ay</th><th class="num">Gelir</th><th class="num">Gider</th><th class="num">Net</th><th class="num">Satış fat.</th><th class="num">Alış fat.</th><th class="num">Hesaplanan KDV</th><th class="num">İndirilecek KDV</th><th class="num">KDV farkı</th></tr></thead><tbody>
          ${r.monthly.map((m) => `<tr><td>${mlabel(m.month)}</td><td class="num">${fmtN(m.gelir)}</td><td class="num">${fmtN(m.gider)}</td><td class="num"><b class="money ${m.net >= 0 ? 'in' : 'out'}">${fmtN(m.net)}</b></td><td class="num">${fmtN(m.sales)}</td><td class="num">${fmtN(m.purchases)}</td><td class="num">${fmtN(m.vatOut)}</td><td class="num">${fmtN(m.vatIn)}</td><td class="num"><b>${fmtN(m.vatOut - m.vatIn)}</b></td></tr>`).join('')}
          <tr style="font-weight:800"><td>Toplam</td><td class="num">${fmtN(tot.g)}</td><td class="num">${fmtN(tot.c)}</td><td class="num">${fmtN(tot.g - tot.c)}</td><td class="num">${fmtN(tot.s)}</td><td class="num">${fmtN(tot.p)}</td><td class="num">${fmtN(tot.vo)}</td><td class="num">${fmtN(tot.vi)}</td><td class="num">${fmtN(tot.vo - tot.vi)}</td></tr></tbody></table></div></div>
        <div class="grid g3" style="margin-top:14px">
          <div class="panel"><div class="ph"><h3>Kategoriler</h3></div><div class="pb">${r.categories.map((c) => `<div class="row" style="padding:4px 0"><span class="chip ${c.type === 'gelir' ? 'ok' : 'bad'}">${c.type === 'gelir' ? '+' : '−'}</span><span class="grow">${esc(c.category)}</span>${money(c.amount)}</div>`).join('') || '<span class="muted">Kayıt yok.</span>'}</div></div>
          <div class="panel"><div class="ph"><h3>En çok satış yapılan müşteriler</h3></div><div class="pb">${r.customers.map((c) => `<div class="row" style="padding:4px 0"><span class="grow">${esc(c.name)}</span>${money(c.total)}</div>`).join('') || '<span class="muted">Satış faturası yok.</span>'}</div></div>
          <div class="panel"><div class="ph"><h3>En çok alım yapılan tedarikçiler</h3></div><div class="pb">${r.suppliers.map((c) => `<div class="row" style="padding:4px 0"><span class="grow">${esc(c.name)}</span>${money(c.total)}</div>`).join('') || '<span class="muted">Alış faturası yok.</span>'}</div></div></div>
        <p class="muted" style="font-size:12px;margin-top:12px">Raporlar şirket içi takip içindir; resmi beyanname ve defterler için mali müşavirinle kontrol et.</p>`;
      body.querySelector('.yr').onchange = (e) => { year = e.target.value; draw(); };
      body.querySelector('.csvr').onclick = () => csv(`kar-zarar-${year}.csv`, [['Ay', 'Gelir', 'Gider', 'Net', 'Satış faturaları', 'Alış faturaları', 'Hesaplanan KDV', 'İndirilecek KDV'], ...r.monthly.map((m) => [m.month, fmtN(m.gelir), fmtN(m.gider), fmtN(m.net), fmtN(m.sales), fmtN(m.purchases), fmtN(m.vatOut), fmtN(m.vatIn)])]);
    };
    await draw();
  };

  // ================= ŞİRKET BİLGİLERİ =================
  T.sirket = async () => {
    const c = await api('/erp/company');
    const F = [['title', 'Şirket unvanı', 'ör. SwipeUp Teknoloji A.Ş.'], ['short', 'Kısa ad'], ['taxNo', 'Vergi no'], ['taxOffice', 'Vergi dairesi'], ['mersis', 'MERSİS no'], ['phone', 'Telefon'], ['email', 'E-posta'], ['web', 'Web sitesi'], ['bank', 'Banka'], ['iban', 'IBAN'], ['address', 'Adres'], ['invoiceNote', 'Fatura alt notu']];
    body.innerHTML = `<form class="panel"><div class="pb fgrid">${F.map(([k, l, ph]) => `<label ${['address', 'invoiceNote'].includes(k) ? 'style="grid-column:1/-1"' : ''}>${l}<input class="field" name="${k}" value="${esc(c[k] || '')}" placeholder="${esc(ph || '')}"></label>`).join('')}<div><button class="btn primary">${icon('check')} Kaydet</button></div></div></form>`;
    body.querySelector('form').onsubmit = async (e) => { e.preventDefault(); try { await api('/erp/company', { method: 'PUT', body: Object.fromEntries(F.map(([k]) => [k, val(e.target, k)])) }); toast('Kaydedildi.'); } catch (er) { toast(er.message); } };
  };

  try { await T[tab](); } catch (e) { body.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

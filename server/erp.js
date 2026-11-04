// Şirket yönetimi (ERP): kasa/banka hesapları, cariler, faturalar (KDV), tahsilat/ödeme, personel ve maaş,
// projeler/görevler, raporlar. Hepsi yönetim verisidir (adm_ledger ile birlikte çalışır), kullanıcılar görmez.
const { nanoid } = require('nanoid');

const DAY = 86400000;
const r2 = (n) => Math.round((+n || 0) * 100) / 100;
const num = (v) => { let s = String(v ?? '').trim().replace(/\s|₺/g, ''); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); return r2(parseFloat(s) || 0); };
const str = (v, n = 200) => String(v ?? '').trim().slice(0, n);
const ymdOk = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s : null);
const todayTR = () => new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);

module.exports = function erp(app, ctx) {
  const { store } = ctx;
  const A = ctx.admin;
  if (!A?.adminAuth) return;
  const auth = A.adminAuth;
  const now = () => Date.now();
  const ledger = () => store.all('adm_ledger');

  // ---------- Hesaplama ----------
  const invTotals = (inv) => {
    let sub = 0; let vat = 0; let disc = 0;
    (inv.lines || []).forEach((l) => { const base = r2(l.qty * l.price); const dsc = r2(base * (l.disc || 0) / 100); sub += base - dsc; disc += dsc; vat += r2((base - dsc) * (l.vat || 0) / 100); });
    const withholding = r2(vat * (inv.withholding || 0) / 10); // tevkifat (ör. 5/10)
    return { sub: r2(sub), discount: r2(disc), vat: r2(vat), withholding, total: r2(sub + vat - withholding) };
  };
  const invPaid = (inv) => r2(ledger().filter((l) => l.invoiceId === inv.id).reduce((a, l) => a + l.amount, 0));
  const invOut = (inv) => {
    const t = invTotals(inv); const paid = invPaid(inv);
    const status = inv.status === 'iptal' || inv.status === 'taslak' ? inv.status : paid >= t.total - 0.009 ? 'odendi' : paid > 0 ? 'kismi' : (inv.due && inv.due < todayTR() ? 'gecikti' : 'bekliyor');
    const party = store.get('erp_parties', inv.partyId);
    return { ...inv, ...t, paid, remaining: r2(Math.max(0, t.total - paid)), status, party: party ? { id: party.id, name: party.name } : null };
  };
  const accBalance = (acc) => {
    let b = acc.opening || 0;
    ledger().forEach((l) => { if (l.accountId === acc.id) b += l.type === 'gelir' ? l.amount : -l.amount; });
    store.all('erp_transfers').forEach((t) => { if (t.to === acc.id) b += t.amount; if (t.from === acc.id) b -= t.amount; });
    return r2(b);
  };
  const partyBalance = (p) => {
    const invs = store.filter('erp_invoices', (i) => i.partyId === p.id && !['iptal', 'taslak'].includes(i.status));
    const sales = invs.filter((i) => i.kind === 'satis').reduce((a, i) => a + invTotals(i).total, 0);
    const buys = invs.filter((i) => i.kind === 'alis').reduce((a, i) => a + invTotals(i).total, 0);
    const got = ledger().filter((l) => l.partyId === p.id && l.type === 'gelir').reduce((a, l) => a + l.amount, 0);
    const paidOut = ledger().filter((l) => l.partyId === p.id && l.type === 'gider').reduce((a, l) => a + l.amount, 0);
    // pozitif: bize borçlu (alacağımız), negatif: biz borçluyuz
    return { receivable: r2(sales - got), payable: r2(buys - paidOut), net: r2((sales - got) - (buys - paidOut)) };
  };
  const nextNo = (kind) => {
    const y = todayTR().slice(0, 4); const key = `erp_seq_${kind}_${y}`;
    const s = store.get('settings', key) || { id: key, n: 0 }; s.n += 1; store.put('settings', s);
    return `${kind === 'satis' ? 'SAT' : 'ALI'}-${y}-${String(s.n).padStart(4, '0')}`;
  };

  // ---------- Temizleyiciler ----------
  const CLEAN = {
    erp_accounts: (b) => ({ name: str(b.name, 60) || 'Hesap', type: ['kasa', 'banka', 'pos', 'kredi'].includes(b.type) ? b.type : 'banka', bank: str(b.bank, 60), iban: str(b.iban, 40), opening: num(b.opening), currency: 'TRY', note: str(b.note, 200), archived: !!b.archived }),
    erp_parties: (b) => ({ kind: ['musteri', 'tedarikci', 'ikisi'].includes(b.kind) ? b.kind : 'musteri', name: str(b.name, 100), person: str(b.person, 60), taxNo: str(b.taxNo, 20), taxOffice: str(b.taxOffice, 60), phone: str(b.phone, 30), email: str(b.email, 80), address: str(b.address, 300), city: str(b.city, 40), iban: str(b.iban, 40), note: str(b.note, 500) }),
    erp_employees: (b) => ({ name: str(b.name, 80), title: str(b.title, 60), dept: str(b.dept, 60), phone: str(b.phone, 30), email: str(b.email, 80), tc: str(b.tc, 11), iban: str(b.iban, 40), startDate: ymdOk(b.startDate) || todayTR(), endDate: ymdOk(b.endDate), salary: num(b.salary), employerCost: num(b.employerCost), payDay: Math.max(1, Math.min(28, parseInt(b.payDay, 10) || 1)), status: b.status === 'ayrildi' ? 'ayrildi' : 'aktif', note: str(b.note, 500), leaves: (Array.isArray(b.leaves) ? b.leaves : []).slice(0, 100).map((l) => ({ from: ymdOk(l.from), to: ymdOk(l.to), type: str(l.type, 30) || 'Yıllık izin', note: str(l.note, 120) })).filter((l) => l.from && l.to) }),
    erp_tasks: (b) => ({ title: str(b.title, 140), desc: str(b.desc, 2000), project: str(b.project, 60), status: ['todo', 'doing', 'done'].includes(b.status) ? b.status : 'todo', priority: ['dusuk', 'normal', 'yuksek', 'acil'].includes(b.priority) ? b.priority : 'normal', assignee: str(b.assignee, 40), due: ymdOk(b.due) }),
    erp_invoices: (b) => ({
      kind: b.kind === 'alis' ? 'alis' : 'satis', partyId: str(b.partyId, 20), date: ymdOk(b.date) || todayTR(), due: ymdOk(b.due), extNo: str(b.extNo, 40),
      category: str(b.category, 40), note: str(b.note, 500), status: ['taslak', 'kesildi', 'iptal'].includes(b.status) ? b.status : 'kesildi', withholding: Math.max(0, Math.min(10, parseInt(b.withholding, 10) || 0)),
      lines: (Array.isArray(b.lines) ? b.lines : []).slice(0, 50).map((l) => ({ desc: str(l.desc, 200), unit: str(l.unit, 12) || 'Adet', qty: num(l.qty) || 1, price: num(l.price), vat: [0, 1, 8, 10, 18, 20].includes(+l.vat) ? +l.vat : 20, disc: Math.max(0, Math.min(100, num(l.disc))) })).filter((l) => l.desc || l.price),
    }),
  };
  const COLS = { accounts: 'erp_accounts', parties: 'erp_parties', employees: 'erp_employees', tasks: 'erp_tasks', invoices: 'erp_invoices' };
  const LABEL = { accounts: 'hesap', parties: 'cari', employees: 'personel', tasks: 'görev', invoices: 'fatura' };
  const outOf = (k, x) => (k === 'invoices' ? invOut(x) : k === 'accounts' ? { ...x, balance: accBalance(x) } : k === 'parties' ? { ...x, ...partyBalance(x) } : x);

  app.get('/api/admin/erp/company', auth, (req, res) => res.json(store.get('settings', 'erp_company') || { id: 'erp_company' }));
  app.put('/api/admin/erp/company', auth, (req, res) => {
    const b = req.body || {};
    const c = store.put('settings', { id: 'erp_company', title: str(b.title, 120), short: str(b.short, 40), taxNo: str(b.taxNo, 20), taxOffice: str(b.taxOffice, 60), mersis: str(b.mersis, 30), address: str(b.address, 300), phone: str(b.phone, 30), email: str(b.email, 80), web: str(b.web, 80), iban: str(b.iban, 40), bank: str(b.bank, 60), invoiceNote: str(b.invoiceNote, 300) });
    A.audit(req.admin, 'şirket bilgilerini güncelledi');
    res.json(c);
  });

  // ---------- Genel CRUD ----------
  app.get('/api/admin/erp/:col', auth, (req, res, next) => {
    const col = COLS[req.params.col]; if (!col) return next();
    let list = store.all(col);
    if (req.params.col === 'invoices') { const k = req.query.kind; if (k) list = list.filter((i) => i.kind === k); list.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt); }
    else list.sort((a, b) => (a.name || a.title || '').localeCompare(b.name || b.title || '', 'tr'));
    res.json(list.map((x) => outOf(req.params.col, x)));
  });
  app.post('/api/admin/erp/:col', auth, (req, res, next) => {
    const k = req.params.col; const col = COLS[k]; if (!col) return next();
    const data = CLEAN[col](req.body || {});
    if (!(data.name || data.title || data.lines)) return res.status(400).json({ error: 'Ad / başlık gerekli.' });
    if (k === 'invoices') {
      if (!store.get('erp_parties', data.partyId)) return res.status(400).json({ error: 'Cari seç (müşteri ya da tedarikçi).' });
      if (!data.lines.length) return res.status(400).json({ error: 'En az bir kalem ekle.' });
      data.no = nextNo(data.kind);
    }
    const x = store.put(col, { id: nanoid(10), ...data, by: req.admin.username, createdAt: now() });
    A.audit(req.admin, `${LABEL[k]} ekledi`, null, x.no || x.name || x.title);
    res.json(outOf(k, x));
  });
  app.put('/api/admin/erp/:col/:id', auth, (req, res, next) => {
    const k = req.params.col; const col = COLS[k]; if (!col) return next();
    const x = store.get(col, req.params.id); if (!x) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
    const data = CLEAN[col]({ ...x, ...(req.body || {}) });
    if (k === 'invoices' && invPaid(x) > 0 && req.body?.lines) {
      const t = invTotals({ ...x, ...data });
      if (t.total < invPaid(x) - 0.009) return res.status(400).json({ error: 'Fatura toplamı yapılan ödemeden küçük olamaz.' });
    }
    store.update(col, x.id, { ...data, editedBy: req.admin.username, editedAt: now() });
    A.audit(req.admin, `${LABEL[k]} düzenledi`, null, x.no || x.name || x.title);
    res.json(outOf(k, store.get(col, x.id)));
  });
  app.delete('/api/admin/erp/:col/:id', auth, (req, res, next) => {
    const k = req.params.col; const col = COLS[k]; if (!col) return next();
    const x = store.get(col, req.params.id); if (!x) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
    if (k === 'invoices' && invPaid(x) > 0) return res.status(400).json({ error: 'Ödemesi olan fatura silinemez; iptal edebilirsin.' });
    if (k === 'parties' && store.find('erp_invoices', (i) => i.partyId === x.id)) return res.status(400).json({ error: 'Faturası olan cari silinemez.' });
    if (k === 'accounts' && (ledger().some((l) => l.accountId === x.id) || store.find('erp_transfers', (t) => t.from === x.id || t.to === x.id))) return res.status(400).json({ error: 'Hareketi olan hesap silinemez; arşivleyebilirsin.' });
    store.del(col, x.id);
    A.audit(req.admin, `${LABEL[k]} sildi`, null, x.no || x.name || x.title);
    res.json({ ok: true });
  });

  // ---------- Fatura tahsilat / ödeme ----------
  app.post('/api/admin/erp/invoices/:id/pay', auth, (req, res) => {
    const inv = store.get('erp_invoices', req.params.id); if (!inv) return res.status(404).json({ error: 'Fatura bulunamadı.' });
    if (['iptal', 'taslak'].includes(inv.status)) return res.status(400).json({ error: 'İptal ya da taslak faturaya ödeme girilemez.' });
    const o = invOut(inv);
    const amount = Math.min(num(req.body?.amount) || o.remaining, o.remaining);
    if (!(amount > 0)) return res.status(400).json({ error: 'Faturanın kalan tutarı yok.' });
    const acc = store.get('erp_accounts', req.body?.accountId);
    const party = store.get('erp_parties', inv.partyId);
    const e = store.put('adm_ledger', {
      id: nanoid(10), type: inv.kind === 'satis' ? 'gelir' : 'gider', amount, date: ymdOk(req.body?.date) || todayTR(),
      category: inv.category || (inv.kind === 'satis' ? 'Diğer' : 'Diğer'), note: `${inv.no}${inv.extNo ? ` (${inv.extNo})` : ''} · ${party?.name || ''} ${inv.kind === 'satis' ? 'tahsilatı' : 'ödemesi'}`,
      currency: 'TRY', by: req.admin.username, accountId: acc?.id || null, partyId: inv.partyId, invoiceId: inv.id, createdAt: now(),
    });
    A.audit(req.admin, inv.kind === 'satis' ? 'tahsilat girdi' : 'ödeme girdi', null, `${inv.no} · ${amount} ₺`);
    res.json({ entry: e, invoice: invOut(store.get('erp_invoices', inv.id)) });
  });
  // Cari ekstresi
  app.get('/api/admin/erp/parties/:id/statement', auth, (req, res) => {
    const p = store.get('erp_parties', req.params.id); if (!p) return res.status(404).json({ error: 'Cari bulunamadı.' });
    const rows = [];
    store.filter('erp_invoices', (i) => i.partyId === p.id && !['iptal', 'taslak'].includes(i.status)).forEach((i) => { const t = invTotals(i); rows.push({ date: i.date, doc: i.no, desc: `${i.kind === 'satis' ? 'Satış' : 'Alış'} faturası`, debit: i.kind === 'satis' ? t.total : 0, credit: i.kind === 'alis' ? t.total : 0 }); });
    ledger().filter((l) => l.partyId === p.id).forEach((l) => rows.push({ date: l.date, doc: '', desc: l.type === 'gelir' ? 'Tahsilat' : 'Ödeme', debit: l.type === 'gider' ? l.amount : 0, credit: l.type === 'gelir' ? l.amount : 0 }));
    rows.sort((a, b) => a.date.localeCompare(b.date));
    let bal = 0; rows.forEach((r) => { bal = r2(bal + r.debit - r.credit); r.balance = bal; });
    res.json({ party: { ...p, ...partyBalance(p) }, rows });
  });

  // ---------- Virman (hesaplar arası) ----------
  app.get('/api/admin/erp/transfers', auth, (req, res) => res.json(store.all('erp_transfers').sort((a, b) => b.date.localeCompare(a.date))));
  app.post('/api/admin/erp/transfers', auth, (req, res) => {
    const b = req.body || {};
    if (!store.get('erp_accounts', b.from) || !store.get('erp_accounts', b.to) || b.from === b.to) return res.status(400).json({ error: 'İki farklı hesap seç.' });
    const amount = num(b.amount); if (!(amount > 0)) return res.status(400).json({ error: 'Tutar gir.' });
    const t = store.put('erp_transfers', { id: nanoid(10), from: b.from, to: b.to, amount, date: ymdOk(b.date) || todayTR(), note: str(b.note, 200), by: req.admin.username, createdAt: now() });
    A.audit(req.admin, 'virman yaptı', null, `${amount} ₺`);
    res.json(t);
  });
  app.delete('/api/admin/erp/transfers/:id', auth, (req, res) => { store.del('erp_transfers', req.params.id); res.json({ ok: true }); });

  // ---------- Maaş ödemesi (bordro) ----------
  app.get('/api/admin/erp/payroll', auth, (req, res) => {
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : todayTR().slice(0, 7);
    const paid = store.filter('erp_payroll', (p) => p.month === month);
    const emps = store.filter('erp_employees', (e) => e.status === 'aktif' || paid.some((p) => p.empId === e.id));
    res.json({ month, items: emps.map((e) => ({ ...e, paid: paid.find((p) => p.empId === e.id) || null })), total: r2(emps.filter((e) => e.status === 'aktif').reduce((a, e) => a + e.salary + (e.employerCost || 0), 0)) });
  });
  app.post('/api/admin/erp/payroll', auth, (req, res) => {
    const b = req.body || {};
    const month = /^\d{4}-\d{2}$/.test(b.month || '') ? b.month : todayTR().slice(0, 7);
    const ids = Array.isArray(b.ids) ? b.ids : null;
    const acc = store.get('erp_accounts', b.accountId);
    const date = ymdOk(b.date) || todayTR();
    const done = [];
    store.filter('erp_employees', (e) => e.status === 'aktif' && (!ids || ids.includes(e.id))).forEach((e) => {
      if (store.find('erp_payroll', (p) => p.month === month && p.empId === e.id)) return;
      const entries = [];
      if (e.salary > 0) entries.push(store.put('adm_ledger', { id: nanoid(10), type: 'gider', amount: e.salary, date, category: 'Maaş', note: `${month} maaşı · ${e.name}`, currency: 'TRY', by: req.admin.username, accountId: acc?.id || null, employeeId: e.id, createdAt: now() }).id);
      if (e.employerCost > 0) entries.push(store.put('adm_ledger', { id: nanoid(10), type: 'gider', amount: e.employerCost, date, category: 'Vergi', note: `${month} SGK ve vergi · ${e.name}`, currency: 'TRY', by: req.admin.username, accountId: acc?.id || null, employeeId: e.id, createdAt: now() }).id);
      done.push(store.put('erp_payroll', { id: nanoid(10), month, empId: e.id, salary: e.salary, employerCost: e.employerCost || 0, entries, date, by: req.admin.username, at: now() }));
    });
    if (!done.length) return res.status(400).json({ error: 'Bu ay için ödenecek maaş kalmadı.' });
    A.audit(req.admin, 'maaş ödedi', null, `${month} · ${done.length} kişi · ${r2(done.reduce((a, p) => a + p.salary + p.employerCost, 0))} ₺`);
    res.json({ ok: true, count: done.length });
  });
  app.delete('/api/admin/erp/payroll/:id', auth, (req, res) => {
    const p = store.get('erp_payroll', req.params.id); if (!p) return res.status(404).json({ error: 'Bulunamadı.' });
    (p.entries || []).forEach((id) => store.del('adm_ledger', id));
    store.del('erp_payroll', p.id);
    A.audit(req.admin, 'maaş ödemesini geri aldı', null, p.month);
    res.json({ ok: true });
  });

  // ---------- Özet ----------
  app.get('/api/admin/erp/summary', auth, (req, res) => {
    const today = todayTR(); const month = today.slice(0, 7);
    const L = ledger();
    const sumM = (m, type) => r2(L.filter((l) => l.date.startsWith(m) && l.type === type).reduce((a, l) => a + l.amount, 0));
    const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(`${month}-15T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - (11 - i)); return d.toISOString().slice(0, 7); });
    const accs = store.filter('erp_accounts', (a) => !a.archived).map((a) => ({ id: a.id, name: a.name, type: a.type, balance: accBalance(a) }));
    const invs = store.all('erp_invoices').map(invOut).filter((i) => !['iptal', 'taslak'].includes(i.status));
    const open = (k) => invs.filter((i) => i.kind === k && i.remaining > 0);
    const mInv = invs.filter((i) => i.date.startsWith(month));
    const emps = store.filter('erp_employees', (e) => e.status === 'aktif');
    const paidThisMonth = new Set(store.filter('erp_payroll', (p) => p.month === month).map((p) => p.empId));
    const tasks = store.all('erp_tasks');
    const upcoming = [
      ...open('alis').filter((i) => i.due).map((i) => ({ date: i.due, kind: 'odeme', text: `${i.no}${i.extNo ? ` (${i.extNo})` : ''} · ${i.party?.name || ''} ödemesi`, amount: i.remaining })),
      ...open('satis').filter((i) => i.due).map((i) => ({ date: i.due, kind: 'tahsilat', text: `${i.no} · ${i.party?.name || ''} tahsilatı`, amount: i.remaining })),
      ...emps.filter((e) => !paidThisMonth.has(e.id)).map((e) => ({ date: `${month}-${String(e.payDay).padStart(2, '0')}`, kind: 'maas', text: `${e.name} maaşı`, amount: r2(e.salary + (e.employerCost || 0)) })),
      ...tasks.filter((t) => t.status !== 'done' && t.due).map((t) => ({ date: t.due, kind: 'gorev', text: t.title, amount: null })),
    ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 15);
    res.json({
      month, income: sumM(month, 'gelir'), expense: sumM(month, 'gider'),
      chart: months.map((m) => ({ month: m, gelir: sumM(m, 'gelir'), gider: sumM(m, 'gider') })),
      cash: r2(accs.reduce((a, x) => a + x.balance, 0)), accounts: accs,
      receivable: r2(open('satis').reduce((a, i) => a + i.remaining, 0)), payable: r2(open('alis').reduce((a, i) => a + i.remaining, 0)),
      overdue: invs.filter((i) => i.status === 'gecikti').length,
      vat: { out: r2(mInv.filter((i) => i.kind === 'satis').reduce((a, i) => a + i.vat - i.withholding, 0)), in: r2(mInv.filter((i) => i.kind === 'alis').reduce((a, i) => a + i.vat, 0)) },
      staff: { count: emps.length, monthly: r2(emps.reduce((a, e) => a + e.salary + (e.employerCost || 0), 0)), unpaid: emps.filter((e) => !paidThisMonth.has(e.id)).length },
      tasks: { todo: tasks.filter((t) => t.status === 'todo').length, doing: tasks.filter((t) => t.status === 'doing').length, overdue: tasks.filter((t) => t.status !== 'done' && t.due && t.due < today).length },
      upcoming, company: store.get('settings', 'erp_company') || null,
    });
  });

  // ---------- Raporlar ----------
  app.get('/api/admin/erp/report', auth, (req, res) => {
    const year = /^\d{4}$/.test(req.query.year || '') ? req.query.year : todayTR().slice(0, 4);
    const L = ledger().filter((l) => l.date.startsWith(year));
    const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
    const invs = store.all('erp_invoices').map(invOut).filter((i) => i.date.startsWith(year) && !['iptal', 'taslak'].includes(i.status));
    const cat = {}; L.forEach((l) => { const k = `${l.type}|${l.category}`; cat[k] = r2((cat[k] || 0) + l.amount); });
    const cust = {}; invs.filter((i) => i.kind === 'satis').forEach((i) => { const k = i.party?.name || '?'; cust[k] = r2((cust[k] || 0) + i.total); });
    const supp = {}; invs.filter((i) => i.kind === 'alis').forEach((i) => { const k = i.party?.name || '?'; supp[k] = r2((supp[k] || 0) + i.total); });
    res.json({
      year,
      monthly: months.map((m) => {
        const g = r2(L.filter((l) => l.date.startsWith(m) && l.type === 'gelir').reduce((a, l) => a + l.amount, 0));
        const c = r2(L.filter((l) => l.date.startsWith(m) && l.type === 'gider').reduce((a, l) => a + l.amount, 0));
        const mi = invs.filter((i) => i.date.startsWith(m));
        return { month: m, gelir: g, gider: c, net: r2(g - c), vatOut: r2(mi.filter((i) => i.kind === 'satis').reduce((a, i) => a + i.vat - i.withholding, 0)), vatIn: r2(mi.filter((i) => i.kind === 'alis').reduce((a, i) => a + i.vat, 0)), sales: r2(mi.filter((i) => i.kind === 'satis').reduce((a, i) => a + i.total, 0)), purchases: r2(mi.filter((i) => i.kind === 'alis').reduce((a, i) => a + i.total, 0)) };
      }),
      categories: Object.entries(cat).map(([k, v]) => ({ type: k.split('|')[0], category: k.split('|')[1], amount: v })).sort((a, b) => b.amount - a.amount),
      customers: Object.entries(cust).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 10),
      suppliers: Object.entries(supp).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 10),
    });
  });
  ctx.erpInvoice = (id) => { const i = store.get('erp_invoices', id); return i ? invOut(i) : null; };
};
